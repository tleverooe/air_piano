import { keyAt, toKeyboard } from './keyboard.js';

const SMOOTH_XY = 0.5;    // 0..1, higher follows the hand faster, lower is steadier
const SMOOTH_DIST = 0.35; // distance estimates are noisier, so they're smoothed more
const RELEASE_GAP = 2;    // cm: a finger must pull back this far past the plane to release (stops flicker)
const LOST_MS = 150;      // a finger missing this long is treated as lifted

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The keyboard is a virtual upright plane planeCm away from the camera.
// A note sounds when a fingertip reaches the plane and stops when it pulls back.
// The key is the one the fingertip was pointing at just before it reached the plane,
// and it stays the same while the finger is held in, so a still hand never jumps between keys.
export function createPlayer(piano) {
  const fingers = new Map();
  const held = new Map(); // midi -> how many fingers are holding it

  function press(f, key) {
    // Faster approach plays louder: about 20 cm/s is soft, 80 cm/s or more is full.
    const velocity = clamp(0.3 + (f.speed || 0) / 110, 0.35, 1);
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

    // The nearest fingertip's distance in cm, or null when no hand is visible.
    nearest() {
      let d = null;
      for (const f of fingers.values()) if (d === null || f.dist < d) d = f.dist;
      return d;
    },

    update(tips, now, keys, geom, planeCm) {
      for (const t of tips) {
        // Curled fingers are ignored; one that curls while held is released once it counts as lost.
        if (!t.extended) continue;
        let f = fingers.get(t.id);
        if (!f) {
          f = { x: t.x, y: t.y, dist: t.dist, speed: 0, t: now, down: false, key: null };
          fingers.set(t.id, f);
        } else {
          const dt = Math.max(1, now - f.t) / 1000;
          const dist = f.dist + SMOOTH_DIST * (t.dist - f.dist);
          f.speed = (f.dist - dist) / dt; // cm/s toward the camera
          f.dist = dist;
          f.x += SMOOTH_XY * (t.x - f.x);
          f.y += SMOOTH_XY * (t.y - f.y);
          f.t = now;
        }
        f.seen = now;

        if (f.down) {
          if (f.dist > planeCm + RELEASE_GAP) release(f);
        } else if (f.dist <= planeCm) {
          const aim = f.aim || toKeyboard(geom, f.x, f.y);
          const key = keyAt(keys, aim.s, aim.u);
          if (key) press(f, key);
        } else if (f.dist > planeCm + RELEASE_GAP) {
          // Still clearly in front of the plane: keep track of which key it's pointing at.
          f.aim = toKeyboard(geom, f.x, f.y);
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
