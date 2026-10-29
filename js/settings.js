import { buildKeys, midiToName, isBlack } from './keyboard.js';

// Bumped whenever the keyboard layout changes, so older saved positions don't carry over.
const STORE_KEY = 'air-piano-settings-v4';
const DEFAULTS = { low: 48, high: 72, black: true, top: 30, plane: 40 }; // C3–C5 with black keys
const KEYBOARD_HEIGHT = 0.5; // fraction of frame height
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

// Wires up the controls and calls onChange({ keys, geom, planeCm }) now and on every change.
// Returns { setPlane(cm) } so calibration can move the plane slider.
export function initSettings(onChange) {
  const lowSel = document.getElementById('lowSel');
  const highSel = document.getElementById('highSel');
  const blackChk = document.getElementById('blackChk');
  const topRange = document.getElementById('topRange');
  const planeRange = document.getElementById('planeRange');
  const planeOut = document.getElementById('planeOut');
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
  topRange.value = s.top;
  planeRange.value = s.plane;

  function emit() {
    let low = Number(lowSel.value);
    let high = Number(highSel.value);
    if (low > high) [low, high] = [high, low];
    const black = blackChk.checked;
    const top = Number(topRange.value);
    const plane = Number(planeRange.value);
    save({ low, high, black, top, plane });
    planeOut.textContent = `${plane} cm`;

    const keys = buildKeys(low, high, black);
    const whites = keys.filter((k) => !k.black).length;
    keyCount.textContent = `${keys.length} 个键` + (whites > 22 ? '，白键太多会比较难对准' : '');
    onChange({
      keys,
      geom: { top: top / 100, height: KEYBOARD_HEIGHT },
      planeCm: plane,
    });
  }

  for (const el of [lowSel, highSel, blackChk, topRange, planeRange]) el.addEventListener('input', emit);
  emit();

  return {
    setPlane(cm) {
      planeRange.value = Math.round(cm);
      emit();
    },
  };
}
