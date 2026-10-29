// Decides whether a finger is stretched out or curled into the palm,
// from MediaPipe's 21 hand landmarks (x, y in 0..1 of frame width/height, z in frame-width units).
// MediaPipe always reports five fingertips, even for a fist, where curled tips land near the knuckles;
// those shouldn't play notes.

// Middle joint (PIP) of each finger, keyed by its fingertip index.
const MIDDLE_JOINT = { 8: 6, 12: 10, 16: 14, 20: 18 };
const WRIST = 0;
const MIDDLE_KNUCKLE = 9;
const THUMB_TIP = 4;
const THUMB_JOINT = 3;

function dist(a, b, aspect) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * aspect, a.z - b.z);
}

// aspect = frame height / frame width, so x and y distances are in the same units.
export function isExtended(hand, tip, aspect) {
  if (tip === THUMB_TIP) {
    // A thumb tucked across the palm ends up close to the middle knuckle.
    const k = hand[MIDDLE_KNUCKLE];
    return dist(hand[THUMB_TIP], k, aspect) > dist(hand[THUMB_JOINT], k, aspect);
  }
  // A straight (or only slightly bent) finger's tip is farther from the wrist than its middle joint;
  // a curled finger folds the tip back in past it.
  const w = hand[WRIST];
  return dist(hand[tip], w, aspect) > dist(hand[MIDDLE_JOINT[tip]], w, aspect);
}
