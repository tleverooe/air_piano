# 空中钢琴 Air Piano

用摄像头识别手指，在空中弹钢琴。纯网页，不用安装任何东西。

## 怎么弹

1. 打开网页，点「开始」，允许使用摄像头。
2. 画面下方是一排像真钢琴一样的键盘：白键连成一排，黑键短一截叠在白键上半部分。
3. 手悬在键盘上方，**手指往下点一下**，就会弹出指尖下面那个键；手指抬回来，声音松开。
   - 指尖落在键盘上半部分、正对黑键时弹黑键，落在下半部分弹白键。
   - 判断的是手指相对指根的弯曲动作，所以整只手上下移动不会误触。
4. 点得越快，声音越响。
5. 两只手、十根手指都可以同时弹。

## 设置

- **最低音 / 最高音**：选键盘的范围（C2 到 C7），默认 C3 到 C5。
- **显示黑键**：默认打开；关掉就只有白键。
- **键盘位置**：把键盘在画面里往上或往下挪，找到你手最舒服的位置。
- **灵敏度**：容易误触就调低，点了没反应就调高。

设置会记在浏览器里，下次打开还在。

## 小提示

- 光线亮一点、背景简单一点，识别会更稳。
- 手离摄像头半米到一米左右效果最好。
- 白键太多（超过 20 个左右）手指会不好对准。

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
