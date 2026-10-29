import { startCamera, cameraErrorText } from './camera.js';
import { createTracker } from './tracker.js';
import { unlockAudio, createPiano } from './audio.js';
import { buildKeys, drawKeys } from './keyboard.js';
import { createPlayer } from './player.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');

let tracker = null;
let player = null;
let keys = buildKeys(60, 72, false); // C4 to C5, white keys
let lineY = 0.62;                    // strike line, as a fraction of frame height

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function fitCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  stage.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
}

// Mirror the camera so moving your right hand moves things to the right on screen.
function drawVideo() {
  const { width: w, height: h } = canvas;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}

function drawFingers(fingers) {
  const { width: w, height: h } = canvas;
  const r = Math.max(6, w * 0.008);
  for (const f of fingers) {
    ctx.beginPath();
    ctx.arc(f.x * w, f.y * h, f.down ? r * 1.5 : r, 0, Math.PI * 2);
    ctx.fillStyle = f.down ? '#d9a441' : 'rgba(236, 230, 214, 0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#11131a';
    ctx.stroke();
  }
}

function frame(now) {
  const { width: w, height: h } = canvas;
  drawVideo();
  const tips = tracker ? tracker.detect(video, now) : [];
  if (player) player.update(tips, now, keys, lineY);
  const fingers = player ? [...player.fingers()] : tips;
  drawKeys(ctx, w, h, keys, lineY, fingers, player ? player.held : new Map());
  drawFingers(fingers);
  requestAnimationFrame(frame);
}

async function start() {
  startBtn.disabled = true;
  setStatus('正在打开摄像头…');
  try {
    await unlockAudio();
    await startCamera(video);
  } catch (err) {
    startBtn.disabled = false;
    setStatus(cameraErrorText(err), 'error');
    return;
  }
  fitCanvas();
  startBtn.hidden = true;
  requestAnimationFrame(frame);

  setStatus('正在加载手部识别模型和钢琴音色…');
  try {
    const [t, piano] = await Promise.all([createTracker(), createPiano()]);
    tracker = t;
    player = createPlayer(piano);
  } catch (err) {
    setStatus(`加载失败，请刷新重试：${err?.message || err}`, 'error');
    return;
  }
  setStatus('手指从虚线上方往下穿过去就会发声');
}

startBtn.addEventListener('click', start);
