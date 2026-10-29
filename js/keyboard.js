const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);

const BLACK_WIDTH = 0.58;  // black key width, as a fraction of a white key
export const BLACK_LEN = 0.62; // black key length, as a fraction of the keyboard height

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

// x: 0..1 across the screen. u: 0 at the back (top) edge of the keyboard, 1 at the front edge.
export function keyAt(keys, x, u) {
  if (x < 0 || x >= 1 || u < 0 || u > 1) return null;
  if (u < BLACK_LEN) {
    const black = keys.find((k) => k.black && x >= k.x0 && x < k.x1);
    if (black) return black;
  }
  return keys.find((k) => !k.black && x >= k.x0 && x < k.x1) || null;
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

// geom: { top, height } of the keyboard as fractions of the frame height.
export function drawKeys(ctx, w, h, keys, geom, fingers, held) {
  if (!keys.length) return;
  const top = geom.top * h;
  const kh = geom.height * h;

  // Keys a hovering finger is over, so you can see where a tap would land.
  const hover = new Set();
  for (const f of fingers) {
    if (f.down) continue;
    const k = keyAt(keys, f.x, Math.min(1, Math.max(0, (f.y - geom.top) / geom.height)));
    if (k && f.y > geom.top - 0.08 && f.y < geom.top + geom.height) hover.add(k.midi);
  }

  // Fallboard with the red felt strip, like the edge behind real keys.
  const board = Math.max(6, kh * 0.08);
  ctx.fillStyle = 'rgba(17, 19, 26, 0.85)';
  ctx.fillRect(0, top - board, w, board);
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
    ctx.fillStyle = active ? BRASS : 'rgba(236, 230, 214, 0.82)';
    ctx.fill();
    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.stroke();
    }
    ctx.fillStyle = k.midi % 12 === 0 ? INK : 'rgba(17, 19, 26, 0.55)';
    ctx.fillText(k.name, x + kw / 2, top + kh - 8);
  }

  for (const k of blacks) {
    const x = k.x0 * w;
    const kw = (k.x1 - k.x0) * w;
    const active = held.has(k.midi);
    roundedBottomRect(ctx, x, top, kw, kh * BLACK_LEN, Math.min(5, kw * 0.12));
    ctx.fillStyle = active ? BRASS : 'rgba(17, 19, 26, 0.94)';
    ctx.fill();
    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.stroke();
    } else if (!active) {
      // A faint highlight down the key so it reads as raised.
      ctx.fillStyle = 'rgba(236, 230, 214, 0.12)';
      ctx.fillRect(x + kw * 0.2, top + 2, kw * 0.12, kh * BLACK_LEN - 8);
    }
  }
  ctx.fillStyle = IVORY; // leave the context in a neutral state
}
