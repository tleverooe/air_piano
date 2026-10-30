const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);

const BLACK_WIDTH = 0.58;  // black key width, as a fraction of a white key
export const BLACK_LEN = 0.62; // black key length, as a fraction of the keyboard height
// Black keys are easier to hit than they look: their touch area is wider and longer than drawn.
const BLACK_HIT_WIDTH = 1.3;
const BLACK_HIT_LEN = 0.72;

// Lays the range out like a real piano seen from the front:
// white keys side by side across the full width, black keys sitting on the boundaries between them.
// x0 / x1 are 0..1 across the screen.
export function buildKeys(lo, hi, includeBlack) {
  const whites = [];
  for (let midi = lo; midi <= hi; midi++) if (!isBlack(midi)) whites.push(midi);
  const ww = 1 / whites.length;

  const keys = whites.map((midi, i) => ({
    midi, name: midiToName(midi), black: false, x0: i * ww, x1: (i + 1) * ww,
  }));

  if (includeBlack) {
    for (let midi = lo; midi <= hi; midi++) {
      if (!isBlack(midi)) continue;
      const left = whites.indexOf(midi - 1);
      if (left < 0 || left === whites.length - 1) continue;
      const cx = (left + 1) * ww;
      const bw = ww * BLACK_WIDTH;
      keys.push({ midi, name: midiToName(midi), black: true, x0: cx - bw / 2, x1: cx + bw / 2 });
    }
  }
  return keys;
}

// s: 0..1 across the keyboard (low to high). u: 0 at the back edge (where black keys start), 1 at the front edge.
export function keyAt(keys, s, u) {
  if (s < 0 || s >= 1 || u < 0 || u > 1) return null;
  if (u < BLACK_HIT_LEN) {
    const black = keys.find((k) => {
      if (!k.black) return false;
      const c = (k.x0 + k.x1) / 2;
      const half = ((k.x1 - k.x0) * BLACK_HIT_WIDTH) / 2;
      return s >= c - half && s < c + half;
    });
    if (black) return black;
  }
  return keys.find((k) => !k.black && s >= k.x0 && s < k.x1) || null;
}

// The keyboard lies flat on the desk and is seen from the laptop camera, like a mirror behind the piano:
// the back edge (black keys) is nearest the camera, so it sits lower on screen and wider;
// the front edge of the white keys is nearest the player, so it sits higher and narrower.
// geom: { top, height } as fractions of frame height: top = front edge, top + height = back edge.
const BACK_HALF = 0.49;  // half-width of the back edge, as a fraction of frame width
const FRONT_HALF = 0.36; // half-width of the front edge

// How far outside the drawn keys a fingertip still counts as over them. A hovering fingertip sits a
// little above (on screen) the key it's over, so allow a small margin past the front edge.
export const U_MIN = -0.1;
export const U_MAX = 1.15;

const halfAt = (u) => BACK_HALF + (FRONT_HALF - BACK_HALF) * u;

// Keyboard coordinates (s, u) to screen position (0..1).
export function project(geom, s, u) {
  return { x: 0.5 + (s - 0.5) * 2 * halfAt(u), y: geom.top + geom.height * (1 - u) };
}

// Screen position (0..1) to keyboard coordinates. u can fall outside 0..1 off the keyboard.
export function toKeyboard(geom, x, y) {
  const u = (geom.top + geom.height - y) / geom.height;
  return { s: (x - 0.5) / (2 * halfAt(u)) + 0.5, u };
}

const INK = '#11131a';
const BRASS = '#d9a441';
const FELT = '#8c2f2a';

function quad(ctx, w, h, geom, s0, s1, u0, u1) {
  const pts = [project(geom, s0, u0), project(geom, s1, u0), project(geom, s1, u1), project(geom, s0, u1)];
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h)));
  ctx.closePath();
}

export function drawKeys(ctx, w, h, keys, geom, fingers, held) {
  if (!keys.length) return;

  // Keys the relaxed fingers would play, so you can see where a press would land.
  const hover = new Set();
  for (const f of fingers) {
    if (!f.down && f.aimKey) hover.add(f.aimKey.midi);
  }

  // Fallboard between the keys and the camera, with the red felt strip along the back edge.
  const back = geom.top + geom.height;
  const boardH = geom.height * 0.12;
  const bx = (0.5 - BACK_HALF * 1.02) * w;
  ctx.fillStyle = 'rgba(17, 19, 26, 0.88)';
  ctx.fillRect(bx, back * h, BACK_HALF * 2.04 * w, boardH * h);
  ctx.fillStyle = FELT;
  ctx.fillRect(bx, back * h, BACK_HALF * 2.04 * w, 3);

  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);
  const gap = 0.12 / whites.length / 10;

  const frontKeyPx = (2 * FRONT_HALF * w) / whites.length;
  const fontSize = Math.round(Math.max(10, Math.min(frontKeyPx * 0.3, 18)));
  ctx.font = `600 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const k of whites) {
    const active = held.has(k.midi);
    quad(ctx, w, h, geom, k.x0 + gap, k.x1 - gap, 0, 1);
    ctx.fillStyle = active ? BRASS : 'rgba(236, 230, 214, 0.82)';
    ctx.fill();
    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.stroke();
    }
    const p = project(geom, (k.x0 + k.x1) / 2, 0.86);
    ctx.fillStyle = k.midi % 12 === 0 ? INK : 'rgba(17, 19, 26, 0.55)';
    ctx.fillText(k.name, p.x * w, p.y * h);
  }

  for (const k of blacks) {
    const active = held.has(k.midi);
    quad(ctx, w, h, geom, k.x0, k.x1, 0, BLACK_LEN);
    ctx.fillStyle = active ? BRASS : 'rgba(17, 19, 26, 0.94)';
    ctx.fill();
    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.stroke();
    }
  }
}
