import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Landmark indices of the five fingertips: thumb, index, middle, ring, pinky.
export const TIP_IDS = [4, 8, 12, 16, 20];

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
    // Returns fingertips as { id, x, y } in 0..1, x already mirrored to match the screen.
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
        for (const tip of TIP_IDS) {
          tips.push({ id: `${label}-${tip}`, x: 1 - hand[tip].x, y: hand[tip].y });
        }
      });
      lastTips = tips;
      return tips;
    },
  };
}
