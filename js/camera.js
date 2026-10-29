// Opens the front camera and resolves once the first frame is available.
export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('这个浏览器不支持摄像头，请用最新版 Chrome / Edge / Safari，并通过 https 打开');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (video.readyState < 2) {
    await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
  }
  return stream;
}

export function cameraErrorText(err) {
  if (err?.name === 'NotAllowedError') return '摄像头权限被拒绝了。点地址栏左边的图标允许摄像头，然后刷新页面。';
  if (err?.name === 'NotFoundError') return '没有找到摄像头。';
  if (err?.name === 'NotReadableError') return '摄像头被别的程序占用了，关掉它再试。';
  return `打不开摄像头：${err?.message || err}`;
}
