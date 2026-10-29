import { startCamera, cameraErrorText } from './camera.js';

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

function frame() {
  drawVideo();
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
  setStatus('摄像头已开启');
  requestAnimationFrame(frame);
}

startBtn.addEventListener('click', start);
