const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);

// One flat row of equal-width keys from lo to hi (MIDI numbers, inclusive).
export function buildKeys(lo, hi, includeBlack) {
  const keys = [];
  for (let midi = lo; midi <= hi; midi++) {
    if (includeBlack || !isBlack(midi)) {
      keys.push({ midi, name: midiToName(midi), black: isBlack(midi) });
    }
  }
  return keys;
}

export function keyAt(keys, x) {
  if (!keys.length || x < 0 || x >= 1) return null;
  return keys[Math.min(keys.length - 1, Math.floor(x * keys.length))];
}

const INK = '#11131a';
const IVORY = '#ece6d6';
const BRASS = '#d9a441';

// Keys occupy the band from the strike line down to the bottom of the frame.
export function drawKeys(ctx, w, h, keys, lineY, fingers, held) {
  if (!keys.length) return;
  const top = lineY * h;
  const bandH = h - top;
  const kw = w / keys.length;

  const hover = new Set();
  for (const f of fingers) {
    if (!f.down && f.y < lineY && f.y > lineY - 0.2) {
      const k = keyAt(keys, f.x);
      if (k) hover.add(k.midi);
    }
  }

  const fontSize = Math.round(Math.max(11, Math.min(kw * 0.26, 22)));
  ctx.font = `600 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  keys.forEach((k, i) => {
    const x = i * kw;
    const active = held.has(k.midi);
    ctx.fillStyle = active
      ? 'rgba(217, 164, 65, 0.9)'
      : k.black ? 'rgba(17, 19, 26, 0.75)' : 'rgba(236, 230, 214, 0.55)';
    ctx.fillRect(x + 1, top, kw - 2, bandH);

    if (hover.has(k.midi) && !active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = BRASS;
      ctx.strokeRect(x + 2.5, top + 1.5, kw - 5, bandH - 3);
    }

    ctx.fillStyle = active || !k.black ? INK : IVORY;
    ctx.fillText(k.name, x + kw / 2, h - 10);
  });

  ctx.save();
  ctx.setLineDash([14, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = BRASS;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, top);
  ctx.stroke();
  ctx.restore();
}
