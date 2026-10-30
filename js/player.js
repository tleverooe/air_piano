import { keyAt, toKeyboard, U_MIN, U_MAX } from './keyboard.js';

const SMOOTH = 0.5;       // 0..1, higher follows the hand faster, lower is steadier
const RELEASE = 0.45;     // a pressed finger releases once its press depth falls below this fraction of the threshold
const REST_DRIFT = 0.03;  // how quickly a finger's resting position follows it when it settles lower (per frame)
const CHORD = 0.7;        // within one hand, a finger must press at least this fraction as deep as the deepest to play
const LOST_MS = 150;      // a finger missing this long is treated as lifted
const THUMB = 0.6;        // the thumb presses at an angle and shows less movement on camera, so it needs less
const HAND_KEYS = 5;      // in hand mode, each hand covers this many white keys
const SHIFT_HYST = 0.35;  // in hand mode, how far (in white keys) past a boundary the hand must move to shift
// In hand mode, pushing the hand forward (toward the screen) raises every finger a semitone.
// On camera a push moves the knuckle row down, so it's measured against where that hand usually sits:
// its knuckles must drop this many hand sizes below their usual height to switch, and come back
// within the smaller amount to switch back. The usual height follows the hand slowly when it settles.
const PUSH_IN = 0.12;
const PUSH_OUT = 0.06;
const HOME_DRIFT = 0.02;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Turns finger presses into note on / note off.
//
// Each finger is compared only with itself: we keep track of where its tip rests relative to its
// own knuckle, and it counts as pressed once it bends down a set amount below that. Fingers of
// different lengths, and the whole hand moving around, don't matter.
//
// Positions rather than speeds are used, with a gap between the press and release depths,
// so a still hand stays silent and a held note doesn't flicker.
//
// Within one hand only the finger pressing deepest plays (plus any pressing nearly as deep, for chords),
// so neighbours that get dragged along stay silent.
//
// Which key a finger plays depends on the mode:
//  - 'hand': the hand's position picks 5 neighbouring white keys and each finger owns one of them,
//    left to right, like a hand resting on a real keyboard. Move the hand to reach other keys.
//  - 'aim': the key under the fingertip.
// Either way the key is chosen while the finger is relaxed and locked in until it lifts.
export function createPlayer(piano) {
  const fingers = new Map();
  const held = new Map(); // midi -> how many fingers are holding it
  const windows = new Map(); // hand -> index of the leftmost white key it covers (hand mode)
  const hands = new Map();   // hand -> { x, y, home, push, sharp } (hand mode)

  // Picks the hand's 5-key window from where its knuckles are, with some stickiness at the boundaries.
  function handWindow(hand, palmX, palmY, whites, geom) {
    const n = whites.length;
    const maxStart = Math.max(0, n - HAND_KEYS);
    // Only the hand's sideways position counts: read it at a fixed height on the keyboard, so pushing
    // forward (which moves the knuckles down on screen) doesn't slide the keys across through perspective.
    const want = toKeyboard(geom, palmX, geom.top + geom.height / 2).s * n - HAND_KEYS / 2;
    let start = windows.get(hand);
    if (start === undefined || Math.abs(want - start) > 0.5 + SHIFT_HYST) start = Math.round(want);
    start = clamp(start, 0, maxStart);
    windows.set(hand, start);
    return start;
  }

  function press(f, key, threshold) {
    const velocity = clamp(0.35 + 0.6 * ((f.depth - threshold) / threshold), 0.35, 1);
    piano.triggerAttack(key.name, undefined, velocity);
    held.set(key.midi, (held.get(key.midi) || 0) + 1);
    f.down = true;
    f.key = key;
  }

  function release(f) {
    if (f.key) {
      const n = (held.get(f.key.midi) || 1) - 1;
      if (n <= 0) {
        held.delete(f.key.midi);
        piano.triggerRelease(f.key.name);
      } else {
        held.set(f.key.midi, n);
      }
    }
    f.down = false;
    f.key = null;
  }

  return {
    held,
    fingers: () => fingers.values(),
    // Hand mode: each hand's knuckle position and how far it's pushed forward, for the debug display.
    hands: () => [...hands.values()].map((h) => ({ x: h.x, y: h.y, push: h.push / PUSH_IN, sharp: h.sharp })),

    // threshold: how far (in hand sizes) a finger must bend below its resting position to press.
    // mode: 'hand' or 'aim' (see above).
    update(tips, now, keys, geom, threshold, mode = 'hand') {
      const whites = keys.filter((k) => !k.black);
      const starts = new Map();
      if (mode === 'hand') {
        for (const t of tips) {
          if (!starts.has(t.hand)) starts.set(t.hand, handWindow(t.hand, t.palmX, t.palmY, whites, geom));
        }
      }
      for (const hand of windows.keys()) if (!starts.has(hand)) windows.delete(hand);

      for (const t of tips) {
        let f = fingers.get(t.id);
        if (!f) {
          f = { hand: t.hand, thumb: t.thumb, x: t.x, y: t.y, bend: t.bend, rest: t.bend, depth: 0, down: false, key: null };
          fingers.set(t.id, f);
        } else {
          f.bend += SMOOTH * (t.bend - f.bend);
          f.x += SMOOTH * (t.x - f.x);
          f.y += SMOOTH * (t.y - f.y);
        }
        f.seen = now;
        f.slot = t.slot;
        f.need = f.thumb ? threshold * THUMB : threshold;

        if (!f.down) {
          // Resting position: jumps up at once when the finger lifts higher,
          // and drifts down slowly when the hand settles into a new resting shape.
          if (f.bend < f.rest) f.rest = f.bend;
          else f.rest += REST_DRIFT * (f.bend - f.rest);
        }
        f.depth = f.bend - f.rest;

        f.relaxed = !f.down && f.depth < f.need * RELEASE;
      }

      // Hand mode: is each hand pushed forward onto the black keys?
      if (mode === 'hand') {
        const busy = new Set(); // hands with a finger pressed: pressing can dip the knuckles, so don't judge then
        for (const f of fingers.values()) if (f.seen === now && !f.relaxed) busy.add(f.hand);
        const done = new Set();
        for (const t of tips) {
          if (done.has(t.hand)) continue;
          done.add(t.hand);
          let h = hands.get(t.hand);
          if (!h) {
            h = { x: t.palmX, y: t.palmY, home: t.palmY, push: 0, sharp: false };
            hands.set(t.hand, h);
          }
          h.x += SMOOTH * (t.palmX - h.x);
          h.y += SMOOTH * (t.palmY - h.y);
          if (busy.has(t.hand)) continue;
          if (h.y < h.home) h.home = h.y; // moved back past its usual spot: that's the new usual spot
          else if (!h.sharp) h.home += HOME_DRIFT * (h.y - h.home);
          h.push = (h.y - h.home) / t.palmSize;
          if (!h.sharp && h.push > PUSH_IN) h.sharp = true;
          else if (h.sharp && h.push < PUSH_OUT) h.sharp = false;
        }
        for (const hand of hands.keys()) if (!starts.has(hand)) hands.delete(hand);
      }
      const byMidi = new Map(keys.map((k) => [k.midi, k]));

      for (const f of fingers.values()) {
        if (f.seen !== now || !f.relaxed) continue;
        // Relaxed: work out which key this finger would play, and let it play again.
        if (mode === 'hand') {
          const white = whites[starts.get(f.hand) + f.slot] || null;
          // Pushed forward: the black key just above, where there is one (not after E or B).
          const up = white && byMidi.get(white.midi + 1);
          f.aimKey = hands.get(f.hand)?.sharp && up && up.black ? up : white;
        } else {
          const { s, u } = toKeyboard(geom, f.x, f.y);
          f.aimKey = u >= U_MIN && u <= U_MAX ? keyAt(keys, s, clamp(u, 0, 1)) : null;
        }
        f.blocked = false;
      }

      // Deepest press per hand, counting fingers already held down.
      const deepest = new Map();
      for (const f of fingers.values()) {
        if (f.seen === now) deepest.set(f.hand, Math.max(deepest.get(f.hand) || 0, f.depth));
      }

      for (const f of fingers.values()) {
        if (f.seen !== now) continue;
        if (f.down) {
          if (f.depth < f.need * RELEASE) release(f);
        } else if (f.depth > f.need && !f.blocked && f.aimKey) {
          if (f.depth < CHORD * deepest.get(f.hand)) {
            f.blocked = true; // dragged along by a neighbour: must relax before it can play
            continue;
          }
          press(f, f.aimKey, f.need);
        }
      }

      for (const [id, f] of fingers) {
        if (now - f.seen > LOST_MS) {
          release(f);
          fingers.delete(id);
        }
      }
    },

    releaseAll() {
      for (const f of fingers.values()) release(f);
    },
  };
}
