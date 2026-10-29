import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { isExtended } from './fingers.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Landmark indices of the five fingertips: thumb, index, middle, ring, pinky.
export const TIP_IDS = [4, 8, 12, 16, 20];

// Rough distance estimate from a single camera:
// a hand looks smaller the farther away it is, and MediaPipe's z says how far each fingertip
// sits in front of or behind the wrist. Together they give each fingertip's distance in cm.
const HAND_CM = 9;      // typical wrist-to-middle-knuckle length
const LENS = 1.25;      // 2·tan(half the camera's horizontal field of view), about 64° for a webcam

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
    // Returns fingertips as { id, x, y, dist, extended }: x, y in 0..1 (x mirrored to match the screen),
    // dist the estimated distance from the camera in cm, extended false for a finger curled into the palm.
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
        for (const tip of TIP_IDS) {
          // hand[tip].z is relative to the wrist, in frame-width units; negative is nearer the camera.
          const dist = (HAND_CM * (1 / LENS + hand[tip].z)) / scale;
          tips.push({ id: `${label}-${tip}`, x: 1 - hand[tip].x, y: hand[tip].y, dist, extended: isExtended(hand, tip, aspect) });
        }
      });
      lastTips = tips;
      return tips;
    },
  };
}
