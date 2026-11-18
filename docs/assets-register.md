# 素材登记册 · V0.4

每条素材与代码注册表 / 仓库文件一一对应。许可文本随项目保存于 `src/assets/` 对应目录。

## 字体

| 资产 ID | 类型 | 文件路径 | 来源 | 作者与链接 | 许可 | 获取日期 | 修改说明 | AI 参与 | 使用范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| font-cinzel | 字体 | src/assets/fonts/cinzel-digits.woff2 | Google Fonts 子集 | Cinzel Project Authors, https://fonts.google.com/specimen/Cinzel | SIL OFL 1.1（OFL-Cinzel.txt） | V0.2 | 仅数字与冒号子集 | 无 | 项目与比赛展示 |
| font-mashanzheng | 字体 | src/assets/fonts/mashanzheng-digits.woff2 | Google Fonts 子集 | Ma Shan Zheng Project Authors, https://fonts.google.com/specimen/Ma+Shan+Zheng | SIL OFL 1.1（OFL-MaShanZheng.txt） | V0.2 | 仅数字与冒号子集 | 无 | 项目与比赛展示 |
| font-sharetechmono | 字体 | src/assets/fonts/sharetechmono-digits.woff2 | Google Fonts 子集 | Share Tech Mono Project Authors, https://fonts.google.com/specimen/Share+Tech+Mono | SIL OFL 1.1（OFL-ShareTechMono.txt） | 2026-11-18 | 仅数字与冒号子集（css2 text= API） | 无 | 项目与比赛展示 |

## 场景分层底图（方案 A）

生产链：ImageGen 生成 1792×1024 原图 → `tools/asset-pipeline.mjs` 盒式降采样至 640×360 → 去水印 → 品红色键反解（mid/near）→ 时代色板量化 + Bayer 有序抖动 → 2× 最近邻放大至 1280×720 → PNG 打包。动态元素、人物、火焰、水车、火车仍由 `src/scene.js` 代码绘制；缺失叙事道具（岩洞口、石器架）以程序化贴花补绘。

| 资产 ID | 类型 | 文件路径 | 来源 | 作者与链接 | 许可 | 获取日期 | 修改说明 | AI 参与 | 使用范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| scene-stone-far | 背景底图 | src/assets/scenes/stone/far.png | 生成 | 本项目 ImageGen 会话 | 项目自有（生成物） | 2026-11-18 | 降采样/量化/抖动/去水印 | ImageGen，提示词见 docs/AI-DISCLOSURE.md | 项目与比赛展示 |
| scene-stone-mid | 背景底图 | src/assets/scenes/stone/mid.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 + 品红色键 | 同上 | 项目与比赛展示 |
| scene-stone-near | 背景底图 | src/assets/scenes/stone/near.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 + 品红色键 | 同上 | 项目与比赛展示 |
| scene-tang-far | 背景底图 | src/assets/scenes/tang/far.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 | 同上 | 项目与比赛展示 |
| scene-tang-mid | 背景底图 | src/assets/scenes/tang/mid.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 + 品红色键 | 同上 | 项目与比赛展示 |
| scene-tang-near | 背景底图 | src/assets/scenes/tang/near.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 + 品红色键 | 同上 | 项目与比赛展示 |
| scene-steam-far | 背景底图 | src/assets/scenes/steam/far.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 | 同上 | 项目与比赛展示 |
| scene-steam-mid | 背景底图 | src/assets/scenes/steam/mid.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 + 品红色键 | 同上 | 项目与比赛展示 |
| scene-steam-near | 背景底图 | src/assets/scenes/steam/near.png | 生成 | 同上 | 项目自有 | 2026-11-18 | 同上 + 品红色键 | 同上 | 项目与比赛展示 |

## 音频

| 资产 ID | 类型 | 文件路径 | 来源 | 作者与链接 | 许可 | 获取日期 | 修改说明 | AI 参与 | 使用范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| amb-forest | 音效 | src/assets/audio/forest.ogg / forest.m4a | 项目内合成 | 本项目 tools/audio-forge.mjs | 项目自有 | 2026-11-18 | Node DSP 合成鸟鸣/树叶噪声 → 响度统一 → 过零循环 + 0.4s 交叉淡化 → ffmpeg 双容器 | 无（程序化合成） | 项目与比赛展示 |
| amb-field | 音效 | src/assets/audio/field.ogg / field.m4a | 项目内合成 | 同上 | 项目自有 | 2026-11-18 | 同上（水渠/溪流 + 偶发鸟鸣 + 木轮声） | 无 | 项目与比赛展示 |
| amb-steam | 音效 | src/assets/audio/steam.ogg / steam.m4a | 项目内合成 | 同上 | 项目自有 | 2026-11-18 | 同上（低频机械嗡鸣 + 蒸汽泄压 + 远处轨道） | 无 | 项目与比赛展示 |
| sfx-complete | 音效 | 无文件（Web Audio 运行时合成） | 项目内合成 | src/audio.js | 项目自有 | 2026-11-18 | 两声木质/钟铃短音 ≤1.5s | 无 | 项目与比赛展示 |

响度与循环实测（2026-11-18，ffmpeg ebur128 + 解码回环检查，详见 docs/verification.md）：

- forest：-19.7 LUFS / -2.7 dBFS；field：-19.8~-19.9 LUFS / -2.8~-3.4 dBFS；steam：-20.0~-20.1 LUFS / -4.4 dBFS（ogg/m4a 两容器）。
- 目标 -20 LUFS、真峰值 ≤ -1.5 dBTP 全部满足；三条环境音响度差 ≤0.4 LU。
- 循环点过零 + 0.4s 等功率交叉淡化；解码后首尾样本差均小于内部相邻样本差 p99.9（无缝）。
- 单文件 ≤500KB；P0（forest 双容器）≈730KB ≤1.5MB；六文件合计 ≈2.1MB。

## 图标与背景

| 资产 ID | 类型 | 文件路径 | 来源 | 许可 | AI 参与 |
| --- | --- | --- | --- | --- | --- |
| icons-inline | 图标 | src/ui.js 内联 SVG | 自制 | 项目自有 | 无 |
| bg-galaxy / bg-aurora / bg-nebula | 背景底图 | 无文件（src/background.js 运行时种子化绘制并缓存） | 自制程序化 | 项目自有 | 无 |
| codex-slices | 图鉴切片 | 无文件（运行时从合成底图裁切） | 自制程序化 | 项目自有 | 无 |