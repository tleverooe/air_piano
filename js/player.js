import { keyAt } from './keyboard.js';

const SMOOTH = 0.6;     // 0..1, higher follows the hand faster, lower is steadier
const LIFT = 0.1;       // how far (in hand sizes) a finger must come back up to release the note
const LOST_MS = 150;    // a finger missing this long is treated as lifted
const ABOVE = 0.08;     // a fingertip this far above the keyboard (fraction of frame height) still counts

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Turns finger taps into note on / note off.
// A tap is the fingertip moving down quickly relative to its own knuckle,
// so moving the whole hand up and down doesn't play anything.
// The key played is the one under the fingertip at that moment.
export function createPlayer(piano) {
  const fingers = new Map();
  const held = new Map(); // midi -> how many fingers are holding it

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

        const u = (f.y - geom.top) / geom.height;
        const overKeys = f.y > geom.top - ABOVE && u <= 1;

        if (f.down) {
          f.peak = Math.max(f.peak, f.rel);
          if (f.rel < f.peak - LIFT || !overKeys) release(f);
        } else if (f.armed && overKeys && f.v > threshold) {
          const key = keyAt(keys, f.x, clamp(u, 0, 1));
          if (key) press(f, key, threshold);
        } else if (f.v < threshold * 0.3) {
          // Only allow the next tap once this downward movement has settled.
          f.armed = true;
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
