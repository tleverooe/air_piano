import { buildKeys, midiToName, isBlack } from './keyboard.js';

// Bumped whenever the keyboard layout changes, so older saved positions don't carry over.
const STORE_KEY = 'air-piano-settings-v5';
const DEFAULTS = { low: 48, high: 72, black: true, top: 58, sens: 5, mode: 'hand', sustain: false }; // C3–C5 with black keys
const KEYBOARD_HEIGHT = 0.3; // front-to-back depth on screen, as a fraction of frame height
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

// Wires up the controls and calls onChange({ keys, geom, threshold, mode, sustain }) now and on every change.
export function initSettings(onChange) {
  const lowSel = document.getElementById('lowSel');
  const highSel = document.getElementById('highSel');
  const blackChk = document.getElementById('blackChk');
  const modeSel = document.getElementById('modeSel');
  const sustainChk = document.getElementById('sustainChk');
  const topRange = document.getElementById('topRange');
  const sensRange = document.getElementById('sensRange');
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
  modeSel.value = s.mode;
  sustainChk.checked = s.sustain;
  topRange.value = s.top;
  sensRange.value = s.sens;

  function emit() {
    let low = Number(lowSel.value);
    let high = Number(highSel.value);
    if (low > high) [low, high] = [high, low];
    const black = blackChk.checked;
    const mode = modeSel.value;
    const sustain = sustainChk.checked;
    const top = Number(topRange.value);
    const sens = Number(sensRange.value);
    save({ low, high, black, top, sens, mode, sustain });

    const keys = buildKeys(low, high, black);
    const whites = keys.filter((k) => !k.black).length;
    keyCount.textContent = `${keys.length} 个键` + (whites > 22 ? '，白键太多会比较难对准' : '');
    onChange({
      mode,
      sustain,
      keys,
      geom: { top: top / 100, height: KEYBOARD_HEIGHT },
      // Sensitivity 1..10 maps to how far (in hand sizes) a finger must bend down to press.
      threshold: 0.45 - 0.04 * sens,
    });
  }

  for (const el of [modeSel, sustainChk, lowSel, highSel, blackChk, topRange, sensRange]) el.addEventListener('input', emit);
  emit();
}
