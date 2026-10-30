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
const debugChk = document.getElementById('debugChk');

let tracker = null;
let player = null;
let keys = [];
let geom = { top: 0.58, height: 0.3 }; // keyboard position, as fractions of frame height
let threshold = 0.25;                  // how far a finger must bend down to press, in hand sizes
let mode = 'hand';                     // 'hand': hand position picks the keys; 'aim': fingertip picks the key

initSettings((s) => {
  player?.releaseAll();
  keys = s.keys;
  geom = s.geom;
  threshold = s.threshold;
  mode = s.mode;
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
    if (mode === 'hand' && f.aimKey && !debugChk.checked) {
      // Show which note each finger owns right now.
      const label = (f.down && f.key ? f.key : f.aimKey).name;
      ctx.font = `600 ${Math.round(r * 1.6)}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(17, 19, 26, 0.85)';
      ctx.strokeText(label, f.x * w, f.y * h - r * 1.6);
      ctx.fillStyle = f.down ? '#d9a441' : '#ece6d6';
      ctx.fillText(label, f.x * w, f.y * h - r * 1.6);
    }
    if (debugChk.checked && f.depth !== undefined) drawDebugBar(f, w, h, r);
  }
}

// Debug: a horizontal bar at each hand's knuckles showing how far it's pushed forward.
// Full = switched to black keys.
function drawPushBars(hands) {
  const { width: w, height: h } = canvas;
  const bw = Math.max(60, w * 0.08);
  const bh = Math.max(6, h * 0.012);
  for (const hd of hands) {
    const x = hd.x * w - bw / 2;
    const y = hd.y * h - bh * 3;
    ctx.fillStyle = 'rgba(17, 19, 26, 0.75)';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = hd.sharp ? '#d9a441' : '#7fc4a8';
    ctx.fillRect(x, y, bw * Math.min(1, Math.max(0, hd.push)), bh);
    ctx.font = `600 ${Math.round(bh * 1.8)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ece6d6';
    ctx.fillText(hd.sharp ? '黑键' : '往前推', hd.x * w, y - 2);
  }
}

// Debug: a bar beside each fingertip showing how far it is bent below its resting position.
// The white line is the press point, the dashed line the release point.
// Gold = playing, grey = ignored because a neighbour moved it, red = not over the keyboard.
function drawDebugBar(f, w, h, r) {
  const bw = Math.max(6, r * 0.9);
  const bh = Math.max(40, h * 0.09);
  const x = f.x * w + r * 1.8;
  const bottom = f.y * h + bh / 2;
  const full = (f.need || threshold) * 2; // the bar's height represents twice the press depth
  const fill = Math.min(1, Math.max(0, f.depth / full));
  const off = !f.aimKey;

  ctx.fillStyle = 'rgba(17, 19, 26, 0.75)';
  ctx.fillRect(x, bottom - bh, bw, bh);
  ctx.fillStyle = f.down ? '#d9a441' : f.blocked ? '#8b90a1' : off ? '#ef7a6b' : '#7fc4a8';
  ctx.fillRect(x, bottom - bh * fill, bw, bh * fill);

  ctx.fillStyle = '#ece6d6';
  ctx.fillRect(x - 2, bottom - bh / 2 - 1, bw + 4, 2);
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = '#ece6d6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 2, bottom - (bh / 2) * 0.45);
  ctx.lineTo(x + bw + 2, bottom - (bh / 2) * 0.45);
  ctx.stroke();
  ctx.restore();
}

function frame(now) {
  const { width: w, height: h } = canvas;
  drawVideo();
  const tips = tracker ? tracker.detect(video, now) : [];
  if (player) player.update(tips, now, keys, geom, threshold, mode);
  const fingers = player ? [...player.fingers()] : tips;
  drawKeys(ctx, w, h, keys, geom, fingers, player ? player.held : new Map());
  drawFingers(fingers);
  if (player && debugChk.checked && mode === 'hand') drawPushBars(player.hands());
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
  setStatus('手背放平，手指往下按就会响；左右移动手来换音');
}

startBtn.addEventListener('click', start);
