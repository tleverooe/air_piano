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

// s: 0..1 across the keyboard (low to high). u: 0 at the top edge (where black keys start), 1 at the bottom edge.
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

// The keyboard is an upright panel standing a few cm in front of the screen, facing the player,
// with black keys along the top like a piano seen from the front.
// geom: { top, height } as fractions of frame height.
export function toKeyboard(geom, x, y) {
  return { s: x, u: (y - geom.top) / geom.height };
}

const INK = '#11131a';
const IVORY = '#ece6d6';
const BRASS = '#d9a441';
const FELT = '#8c2f2a';

function roundedBottomRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.closePath();
}

export function drawKeys(ctx, w, h, keys, geom, fingers, held) {
  if (!keys.length) return;
  const top = geom.top * h;
  const kh = geom.height * h;

  // Keys a finger is pointing at, so you can see what pushing forward would play.
  const hover = new Set();
  for (const f of fingers) {
    if (f.down) continue;
    const { s, u } = f.aim || toKeyboard(geom, f.x, f.y);
    const k = keyAt(keys, s, u);
    if (k) hover.add(k.midi);
  }

  ctx.fillStyle = 'rgba(17, 19, 26, 0.85)';
  ctx.fillRect(0, top - Math.max(6, kh * 0.05), w, Math.max(6, kh * 0.05));
  ctx.fillStyle = FELT;
  ctx.fillRect(0, top - 3, w, 3);

  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);
  const fontSize = Math.round(Math.max(10, Math.min((w / whites.length) * 0.22, 18)));
  ctx.font = `600 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  for (const k of whites) {
    const x = k.x0 * w;
    const kw = (k.x1 - k.x0) * w;
    const active = held.has(k.midi);
    roundedBottomRect(ctx, x + 1, top, kw - 2, kh, Math.min(8, kw * 0.12));
    ctx.fillStyle = active ? BRASS : 'rgba(236, 230, 214, 0.6)';
    ctx.fill();
    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.stroke();
    }
    ctx.fillStyle = k.midi % 12 === 0 ? INK : 'rgba(17, 19, 26, 0.6)';
    ctx.fillText(k.name, x + kw / 2, top + kh - 8);
  }

  for (const k of blacks) {
    const x = k.x0 * w;
    const kw = (k.x1 - k.x0) * w;
    const active = held.has(k.midi);
    roundedBottomRect(ctx, x, top, kw, kh * BLACK_LEN, Math.min(5, kw * 0.12));
    ctx.fillStyle = active ? BRASS : 'rgba(17, 19, 26, 0.85)';
    ctx.fill();
    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.stroke();
    }
  }
  ctx.fillStyle = IVORY;
}
