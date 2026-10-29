import { buildKeys, midiToName, isBlack } from './keyboard.js';

const STORE_KEY = 'air-piano-settings';
const DEFAULTS = { low: 60, high: 72, black: false, line: 62 }; // C4–C5, white keys only
const RANGE_MIN = 36; // C2
const RANGE_MAX = 96; // C7

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked (private window etc.): settings just won't be remembered.
  }
}

// Wires up the controls and calls onChange({ keys, lineY }) now and on every change.
export function initSettings(onChange) {
  const lowSel = document.getElementById('lowSel');
  const highSel = document.getElementById('highSel');
  const blackChk = document.getElementById('blackChk');
  const lineRange = document.getElementById('lineRange');
  const keyCount = document.getElementById('keyCount');

  for (let midi = RANGE_MIN; midi <= RANGE_MAX; midi++) {
    if (isBlack(midi)) continue;
    lowSel.add(new Option(midiToName(midi), midi));
    highSel.add(new Option(midiToName(midi), midi));
  }

  const s = load();
  lowSel.value = s.low;
  highSel.value = s.high;
  blackChk.checked = s.black;
  lineRange.value = s.line;

  function emit() {
    let low = Number(lowSel.value);
    let high = Number(highSel.value);
    if (low > high) [low, high] = [high, low];
    const black = blackChk.checked;
    const line = Number(lineRange.value);
    save({ low, high, black, line });

    const keys = buildKeys(low, high, black);
    keyCount.textContent = `${keys.length} 个键` + (keys.length > 20 ? '，键多了会比较难对准' : '');
    onChange({ keys, lineY: line / 100 });
  }

  for (const el of [lowSel, highSel, blackChk, lineRange]) el.addEventListener('input', emit);
  emit();
}
