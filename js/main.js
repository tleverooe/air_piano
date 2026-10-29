import { startCamera, cameraErrorText } from './camera.js';
import { createTracker } from './tracker.js';
import { unlockAudio, createPiano } from './audio.js';
import { drawKeys } from './keyboard.js';
import { createPlayer } from './player.js';
import { initSettings } from './settings.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const calibBtn = document.getElementById('calibBtn');
const distReadout = document.getElementById('distReadout');

const READY_TEXT = '手指往前伸到按键平面就会响，往回收就松开';

let tracker = null;
let player = null;
let keys = [];
let geom = { top: 0.3, height: 0.5 }; // keyboard position, as fractions of frame height
let planeCm = 40;                     // the virtual keyboard plane's distance from the camera

const settings = initSettings((s) => {
  player?.releaseAll();
  keys = s.keys;
  geom = s.geom;
  planeCm = s.planeCm;
});

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

// Each fingertip gets a ring that shrinks onto it as the finger approaches the plane.
function drawFingers(fingers) {
  const { width: w, height: h } = canvas;
  const r = Math.max(6, w * 0.008);
  for (const f of fingers) {
    if (!f.down && f.dist !== undefined) {
      const t = Math.min(1, Math.max(0, (f.dist - planeCm) / 20));
      ctx.beginPath();
      ctx.arc(f.x * w, f.y * h, r * (1.6 + 3 * t), 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(217, 164, 65, ${0.9 - 0.6 * t})`;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(f.x * w, f.y * h, f.down ? r * 1.5 : r, 0, Math.PI * 2);
    ctx.fillStyle = f.down ? '#d9a441' : 'rgba(236, 230, 214, 0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#11131a';
    ctx.stroke();
  }
}

let lastReadout = 0;
function updateReadout(now) {
  if (!player || now - lastReadout < 150) return;
  lastReadout = now;
  const d = player.nearest();
  distReadout.textContent = d === null ? '最近的手指：没看到手' : `最近的手指：${Math.round(d)} cm`;
}

function frame(now) {
  const { width: w, height: h } = canvas;
  drawVideo();
  const tips = tracker ? tracker.detect(video, now) : [];
  if (player) player.update(tips, now, keys, geom, planeCm);
  updateReadout(now);
  const fingers = player ? [...player.fingers()] : tips.filter((t) => t.extended);
  drawKeys(ctx, w, h, keys, geom, fingers, player ? player.held : new Map());
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
  calibBtn.disabled = false;
  setStatus(READY_TEXT);
}

// Countdown, then average the nearest fingertip's distance for half a second and put the plane there.
async function calibrate() {
  calibBtn.disabled = true;
  for (let n = 3; n > 0; n--) {
    setStatus(`把指尖伸到你想要的按键位置，停住… ${n}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const samples = [];
  const end = performance.now() + 500;
  while (performance.now() < end) {
    const d = player.nearest();
    if (d !== null) samples.push(d);
    await new Promise((r) => setTimeout(r, 50));
  }
  calibBtn.disabled = false;
  if (!samples.length) {
    setStatus('没看到手，再试一次', 'error');
    return;
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  settings.setPlane(avg);
  setStatus(`按键平面设在 ${Math.round(avg)} cm。${READY_TEXT}`);
}

startBtn.addEventListener('click', start);
calibBtn.addEventListener('click', calibrate);
