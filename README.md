# 空中钢琴 Air Piano

用摄像头识别手指，在空中弹钢琴。纯网页，不用安装任何东西。

## 怎么弹

1. 打开网页，点「开始」，允许使用摄像头。
2. 画面下方是一排琴键，琴键上边缘是一条虚线（触发线）。
3. 手指从虚线**上方往下穿过**虚线，就会弹下指尖下面那个键；手指抬回虚线上方，声音松开。
4. 往下穿得越快，声音越响。
5. 两只手、十根手指都可以同时弹。

## 设置

- **最低音 / 最高音**：选这一排琴键的范围（C2 到 C7）。
- **黑键也排进这一排**：勾上后黑键按半音顺序插在同一排里；不勾就只有白键。
- **触发线高度**：把虚线往上或往下挪，找到你手最舒服的位置。

设置会记在浏览器里，下次打开还在。

## 小提示

- 光线亮一点、背景简单一点，识别会更稳。
- 手离摄像头半米到一米左右效果最好。
- 键太多（超过 20 个左右）手指会不好对准。

## 部署到 GitHub Pages

仓库 Settings → Pages → Build and deployment，Source 选 **Deploy from a branch**，Branch 选 `main`、目录 `/ (root)`，保存。
一两分钟后就能在 `https://tleverooe.github.io/air_piano/` 打开。

摄像头只能在 https 或 localhost 下使用，所以直接双击打开本地的 `index.html` 是不行的。本地测试可以在项目目录运行：

```
python3 -m http.server 8000
```

然后打开 http://localhost:8000 。

## 用到的东西

- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)：手部 21 个关键点识别
- [Tone.js](https://tonejs.github.io/)：播放声音
- Salamander Grand Piano：钢琴采样（由 Tone.js 托管）
