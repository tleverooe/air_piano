import { keyAt, toKeyboard } from './keyboard.js';

const SMOOTH = 0.6;     // 0..1, higher follows the hand faster, lower is steadier
const LIFT = 0.1;       // how far (in hand sizes) a finger must come back up to release the note
const LOST_MS = 150;    // a finger missing this long is treated as lifted
const CHORD = 0.85;     // within one hand, other fingers must move at least this fraction as fast as the fastest to also play
const FOLLOW_MS = 120;  // how long a hand's last tap still counts when judging fingers that move a moment later
// A hovering fingertip sits higher on screen than the key under it, so allow some room past the front edge.
const U_MIN = -0.1;
const U_MAX = 1.35;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Turns finger taps into note on / note off.
// A tap is the fingertip moving down quickly relative to its own knuckle,
// so moving the whole hand up and down doesn't play anything.
// Within one hand only the fastest finger plays (plus any moving nearly as fast, for chords),
// so neighbouring fingers that get dragged along stay silent.
// The key played is the one the finger was resting over just before the tap (the highlighted key),
// not where the tip ends up, because pressing down also moves the tip on screen.
export function createPlayer(piano) {
  const fingers = new Map();
  const held = new Map(); // midi -> how many fingers are holding it
  const lastTap = new Map(); // hand -> { t, v } of its most recent tap

  function press(f, key, threshold) {
    const velocity = clamp(0.3 + 0.25 * (f.v / threshold), 0.35, 1);
    piano.triggerAttack(key.name, undefined, velocity);
    held.set(key.midi, (held.get(key.midi) || 0) + 1);
    f.down = true;
    f.key = key;
    f.peak = f.rel;
    f.armed = false;
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

    // geom: { top, height } of the keyboard; threshold: tap speed needed, in hand sizes per second.
    update(tips, now, keys, geom, threshold) {
      const candidates = [];

      for (const t of tips) {
        const rel = (t.y - t.ky) / t.scale; // how far the tip hangs below its knuckle
        let f = fingers.get(t.id);
        if (!f) {
          f = { x: t.x, y: t.y, rel, v: 0, t: now, armed: false, down: false, key: null, peak: 0 };
          fingers.set(t.id, f);
        } else {
          const dt = Math.max(1, now - f.t) / 1000;
          const nextRel = f.rel + SMOOTH * (rel - f.rel);
          f.v = (nextRel - f.rel) / dt;
          f.rel = nextRel;
          f.x += SMOOTH * (t.x - f.x);
          f.y += SMOOTH * (t.y - f.y);
          f.t = now;
        }
        f.seen = now;

        if (f.down) {
          f.peak = Math.max(f.peak, f.rel);
          if (f.rel < f.peak - LIFT) release(f);
        } else if (f.v < threshold * 0.3) {
          // Settled: remember where the finger is aiming, and allow the next tap.
          const { s, u } = toKeyboard(geom, f.x, f.y);
          f.aimS = s;
          f.aimU = u;
          f.armed = true;
        } else if (f.armed && f.v > threshold && f.aimS !== undefined) {
          const overKeys = f.aimU >= U_MIN && f.aimU <= U_MAX && f.aimS >= 0 && f.aimS < 1;
          const key = overKeys && keyAt(keys, f.aimS, clamp(f.aimU, 0, 1));
          if (key) candidates.push({ f, key, hand: t.id.split('-')[0] });
        }
      }

      const fastest = new Map();
      for (const [hand, tap] of lastTap) {
        if (now - tap.t < FOLLOW_MS) fastest.set(hand, tap.v);
      }
      for (const c of candidates) fastest.set(c.hand, Math.max(fastest.get(c.hand) || 0, c.f.v));
      for (const c of candidates) {
        if (c.f.v >= CHORD * fastest.get(c.hand)) {
          press(c.f, c.key, threshold);
          const prev = lastTap.get(c.hand);
          const v = prev && now - prev.t < FOLLOW_MS ? Math.max(prev.v, c.f.v) : c.f.v;
          lastTap.set(c.hand, { t: now, v });
        } else {
          c.f.armed = false; // a dragged-along finger has to settle before it can tap
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
      for (const f of fingers.values()) {
        release(f);
        f.armed = false;
      }
    },
  };
}
