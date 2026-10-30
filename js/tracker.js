import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Landmark indices of the five fingertips: thumb, index, middle, ring, pinky.
export const TIP_IDS = [4, 8, 12, 16, 20];
// Reference point for each fingertip: pressing the finger down moves its tip down relative to this.
// Fingers use their own knuckle. The thumb presses by swinging the whole thumb down from near the wrist,
// so its own knuckle moves with the tip; it's measured against the index knuckle instead, which stays put.
const KNUCKLE_OF = { 4: 5, 8: 5, 12: 9, 16: 13, 20: 17 };

async function createLandmarker(fileset, delegate) {
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function createTracker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  let landmarker;
  try {
    landmarker = await createLandmarker(fileset, 'GPU');
  } catch {
    landmarker = await createLandmarker(fileset, 'CPU');
  }

  let lastVideoTime = -1;
  let lastTips = [];

  return {
    // Returns fingertips as { id, hand, x, y, bend }: x, y in 0..1 (x mirrored to match the screen).
    // bend is how far the tip hangs below its own knuckle, in hand sizes; it grows as the finger presses down.
    // palmX, palmY: the middle of the hand's knuckle row (same for all five tips of a hand).
    // palmSize: the hand's size (wrist to middle knuckle) in frame-height units.
    // slot: 0..4, the finger's place in the hand from left to right on screen (thumb is 0 or 4).
    detect(video, now) {
      if (video.currentTime === lastVideoTime) return lastTips;
      lastVideoTime = video.currentTime;

      const result = landmarker.detectForVideo(video, now);
      const tips = [];
      const seen = new Set();
      result.landmarks.forEach((hand, h) => {
        let label = result.handedness[h]?.[0]?.categoryName ?? 'Hand';
        if (seen.has(label)) label += h;
        seen.add(label);
        // Hand size as a fraction of frame width (y converted to the same units).
        const aspect = video.videoHeight / video.videoWidth;
        const scale = Math.max(0.01, Math.hypot(hand[9].x - hand[0].x, (hand[9].y - hand[0].y) * aspect));
        // Knuckles are steadier than fingertips, so they set the hand's position and orientation.
        const row = [5, 9, 13, 17];
        const palmX = 1 - row.reduce((a, i) => a + hand[i].x, 0) / row.length;
        const palmY = row.reduce((a, i) => a + hand[i].y, 0) / row.length;
        // On the mirrored screen: if the index knuckle is left of the pinky knuckle, the thumb is on the left.
        const thumbLeft = 1 - hand[5].x < 1 - hand[17].x;
        TIP_IDS.forEach((tip, i) => {
          const bend = ((hand[tip].y - hand[KNUCKLE_OF[tip]].y) * aspect) / scale;
          tips.push({
            id: `${label}-${tip}`,
            hand: label,
            x: 1 - hand[tip].x,
            y: hand[tip].y,
            bend,
            thumb: tip === 4,
            slot: thumbLeft ? i : 4 - i,
            palmX,
            palmY,
            palmSize: scale / aspect,
          });
        });
      });
      lastTips = tips;
      return tips;
    },
  };
}
