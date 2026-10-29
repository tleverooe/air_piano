import { keyAt, toKeyboard, U_MIN, U_MAX } from './keyboard.js';

const SMOOTH = 0.5;       // 0..1, higher follows the hand faster, lower is steadier
const RELEASE = 0.45;     // a pressed finger releases once its press depth falls below this fraction of the threshold
const REST_DRIFT = 0.03;  // how quickly a finger's resting position follows it when it settles lower (per frame)
const CHORD = 0.7;        // within one hand, a finger must press at least this fraction as deep as the deepest to play
const LOST_MS = 150;      // a finger missing this long is treated as lifted

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
// so neighbours that get dragged along stay silent. The key is the one the finger was resting over,
// locked in until the finger lifts.
export function createPlayer(piano) {
  const fingers = new Map();
  const held = new Map(); // midi -> how many fingers are holding it

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

    // threshold: how far (in hand sizes) a finger must bend below its resting position to press.
    update(tips, now, keys, geom, threshold) {
      for (const t of tips) {
        let f = fingers.get(t.id);
        if (!f) {
          f = { hand: t.hand, x: t.x, y: t.y, bend: t.bend, rest: t.bend, depth: 0, down: false, key: null };
          fingers.set(t.id, f);
        } else {
          f.bend += SMOOTH * (t.bend - f.bend);
          f.x += SMOOTH * (t.x - f.x);
          f.y += SMOOTH * (t.y - f.y);
        }
        f.seen = now;

        if (!f.down) {
          // Resting position: jumps up at once when the finger lifts higher,
          // and drifts down slowly when the hand settles into a new resting shape.
          if (f.bend < f.rest) f.rest = f.bend;
          else f.rest += REST_DRIFT * (f.bend - f.rest);
        }
        f.depth = f.bend - f.rest;

        if (!f.down && f.depth < threshold * RELEASE) {
          // Relaxed: keep track of which key this finger is over, and let it play again.
          f.aim = toKeyboard(geom, f.x, f.y);
          f.blocked = false;
        }
      }

      // Deepest press per hand, counting fingers already held down.
      const deepest = new Map();
      for (const f of fingers.values()) {
        if (f.seen === now) deepest.set(f.hand, Math.max(deepest.get(f.hand) || 0, f.depth));
      }

      for (const f of fingers.values()) {
        if (f.seen !== now) continue;
        if (f.down) {
          if (f.depth < threshold * RELEASE) release(f);
        } else if (f.depth > threshold && !f.blocked && f.aim) {
          if (f.depth < CHORD * deepest.get(f.hand)) {
            f.blocked = true; // dragged along by a neighbour: must relax before it can play
            continue;
          }
          const { s, u } = f.aim;
          if (u >= U_MIN && u <= U_MAX) {
            const key = keyAt(keys, s, clamp(u, 0, 1));
            if (key) press(f, key, threshold);
          }
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
