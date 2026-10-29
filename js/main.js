import { startCamera, cameraErrorText } from './camera.js';
import { createTracker } from './tracker.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');

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

let tracker = null;

function drawTips(tips) {
  const { width: w, height: h } = canvas;
  const r = Math.max(6, w * 0.008);
  for (const t of tips) {
    ctx.beginPath();
    ctx.arc(t.x * w, t.y * h, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236, 230, 214, 0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#11131a';
    ctx.stroke();
  }
}

function frame(now) {
  drawVideo();
  if (tracker) drawTips(tracker.detect(video, now));
  requestAnimationFrame(frame);
}

async function start() {
  startBtn.disabled = true;
  setStatus('正在打开摄像头…');
  try {
    await startCamera(video);
  } catch (err) {
    startBtn.disabled = false;
    setStatus(cameraErrorText(err), 'error');
    return;
  }
  fitCanvas();
  startBtn.hidden = true;
  requestAnimationFrame(frame);

  setStatus('正在加载手部识别模型…');
  try {
    tracker = await createTracker();
  } catch (err) {
    setStatus(`手部识别模型加载失败：${err?.message || err}`, 'error');
    return;
  }
  setStatus('把手举到镜头前');
}

startBtn.addEventListener('click', start);
