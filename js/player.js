import { keyAt } from './keyboard.js';

const SMOOTH = 0.55;    // 0..1, higher follows the hand faster, lower is steadier
const REARM = 0.035;    // finger must rise this far above the line before it can strike again
const LOST_MS = 150;    // a finger missing this long is treated as lifted

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Turns fingertip positions into note on / note off.
// A note sounds when a fingertip crosses the strike line moving down,
// and stops when the fingertip comes back up above the line.
export function createPlayer(piano) {
  const fingers = new Map();
  const held = new Map(); // midi -> how many fingers are holding it

  function press(f, key) {
    const velocity = clamp(0.3 + (f.vy || 0) * 0.3, 0.3, 1);
    piano.triggerAttack(key.name, undefined, velocity);
    held.set(key.midi, (held.get(key.midi) || 0) + 1);
    f.down = true;
    f.key = key;
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

    update(tips, now, keys, lineY) {
      for (const t of tips) {
        let f = fingers.get(t.id);
        if (!f) {
          f = { x: t.x, y: t.y, vy: 0, t: now, armed: t.y < lineY, down: false, key: null };
          fingers.set(t.id, f);
        } else {
          const dt = Math.max(1, now - f.t) / 1000;
          const y = f.y + SMOOTH * (t.y - f.y);
          f.vy = (y - f.y) / dt;
          f.x += SMOOTH * (t.x - f.x);
          f.y = y;
          f.t = now;
        }
        f.seen = now;

        if (!f.down && f.armed && f.y >= lineY) {
          const key = keyAt(keys, f.x);
          if (key) press(f, key);
        } else if (f.y < lineY - REARM) {
          if (f.down) release(f);
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
