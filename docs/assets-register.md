# 素材登记册

每条素材与代码注册表 / 仓库文件一一对应。许可文本随项目保存于 `src/assets/` 对应目录。

## 宇宙时钟与微缩文明

- `src/assets/models/terratock-clock.glb` 是时拓的宇宙时钟模型，含表盘、计时指针及文明挂载点 `CivilizationMount`。
- `src/assets/models/` 中另有 20 个由 Codex 辅助制作的原创微缩文明 GLB。地点、区域、模型文件与地理灵感来源登记在 [地点目录](../src/scene-catalog.mjs)。信息时代有 5 处地点。
- `src/assets/brand/terratock-logo.webp` 是时拓首页使用的品牌图。

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
| forest | 环境音 | src/assets/audio/forest.ogg / forest.m4a | 实录（用户提供 mp3，源为 Freesound 414098） | Felix Blume · https://freesound.org/people/felix.blume/sounds/414098/ | CC0 1.0（页面核实） | 2026-11-20 | 取 64s 起 40.6s 稳定窗 → 单声道 44.1k → 0.6s 等功率交叉淡化无缝循环 → K 加权响度统一 → Opus 80k constrained / AAC 96k 双容器 | 无（脚本选窗/淡化/响度，tools/ambience-import.mjs） | 项目与比赛展示 |
| field | 环境音 | src/assets/audio/field.ogg / field.m4a | 实录（用户提供 田园流水.m4a，56:30） | 用户提供，未署名 | 未声明（仅本地交付使用，不随公网发布） | 2026-11-20 | 取 3120s 起 40.6s 稳定窗 → 同上处理链 | 无 | 同上 |
| steam | 环境音 | src/assets/audio/steam.ogg / steam.m4a | 实录（用户提供 蒸汽火车.m4a，替换旧 工业.m4a） | 用户提供，未署名 | 未声明（仅本地交付使用，不随公网发布） | 2026-11-20 | 取 1916s 起 40.6s 稳定窗 → 同上处理链；展示名"蒸汽火车" | 无 | 同上 |
| space | 环境音 | src/assets/audio/space.ogg / space.m4a | 实录（用户提供 太空首页1.m4a） | 用户提供，未署名 | 未声明（仅本地交付使用，不随公网发布） | 2026-11-20 | 取 1244s 起 40.6s 稳定窗 → 同上处理链；首页地球专属默认（home:true，不参与时代解锁门禁） | 无 | 同上 |
| sfx-complete | 音效 | 无文件（Web Audio 运行时合成） | 项目内合成 | src/audio.js | 项目自有 | 2026-11-18 | 两声木质/钟铃短音 ≤1.5s | 无 | 项目与比赛展示 |

响度与循环实测（2026-11-20 替换实录后，ffmpeg ebur128 + 解码回环检查，详见 docs/verification.md 与 tools/shots/v06/ambience-import.json、ambience-seam-all.json）：

- 八文件（四曲目 × ogg/m4a）积分响度统一为 **-20.0 LUFS，极差 0.0 LU**；真峰值 -2.6 ~ -5.1 dBTP，全部 ≤ -1.5 dBTP。
- 选窗规则：2s 块 RMS 变异系数 + 静块惩罚 + 峰值因子惩罚最小者（forest cv 0.065 / field 0.051 / steam 0.044 / space 0.188）。
- 循环：40s 成品 + 0.6s 等功率交叉淡化 baked；解码后互相关对齐 + 修剪编解码 priming/padding，首尾样本差 ≤ 内部相邻样本差 p99.9 + 2×编解码噪声底（超稳态火车嗡鸣的 Opus 量化噪声须计入），八文件全部无缝。
- 单文件 ≤500KB（最大 field.m4a 506248 B）；P0（forest 双容器）≈874KB ≤1.5MB；八文件合计 ≈3.60MB。
- 时代分配：forest→石器、field→盛唐、steam→蒸汽（按用户提供的文件名语义）；space→首页地球专属默认。开启声音后首页自动播太空、进入场景随时代切换（src/app.js resolveAmbience/syncAmbience）；设置内选具体曲目即手动钉住（followDefault=false，跨视图/时代不跟随），选"自动 · 首页太空 / 场景随时代"恢复默认。
- 历史：2026-11-18 版本为 tools/audio-forge.mjs 程序化合成（-19.7~-20.1 LUFS），已于 2026-11-20 被实录替换；steam 旧源 工业.m4a 因用户不喜欢同日被 蒸汽火车.m4a 替换；合成链保留为工具与降级参考。

## 图标与背景

| 资产 ID | 类型 | 文件路径 | 来源 | 许可 | AI 参与 |
| --- | --- | --- | --- | --- | --- |
| icons-inline | 图标 | src/ui.js 内联 SVG | 自制 | 项目自有 | 无 |
| bg-galaxy / bg-aurora / bg-nebula | 背景底图 | 无文件（src/background.js 运行时种子化绘制并缓存） | 自制程序化 | 项目自有 | 无 |
| codex-slices | 图鉴切片 | 无文件（运行时从合成底图裁切） | 自制程序化 | 项目自有 | 无 |

## 角色精灵（V0.6 人物精修版，2026-11-20 定稿）

| 资产 ID | 类型 | 文件路径 | 来源 | 作者与链接 | 许可 | 获取日期 | 修改说明 | AI 参与 | 使用范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| char-stone | 角色精灵表 | src/assets/characters/stone/craftsman.png | 项目内自制 | 本项目 tools/char-frames.mjs + char-actions.mjs → make-characters.mjs 组图 | 项目自有 | 2026-11-20 | V0.6 定稿 192×256（3363 B）：48×64 格、4 行 11 有效帧（idle1/walk4/work4/sit2），锚点 (24,58)；发束侧散 + 单肩斜兽皮 + 麻绳束腰 + 露膝绑腿 + 双鞋受光鞋尖；sit 两帧托石手稳定、持石手举落且落点在石芯上 | AI 辅助编写分层部件图与动作表（未调用生成式图像模型） | 项目与比赛展示 |
| char-tang | 角色精灵表 | src/assets/characters/tang/farmer.png | 项目内自制 | 同上 | 项目自有 | 2026-11-20 | V0.6 定稿（3658 B）：宽沿竹笠三档明暗 + 檐底衬脸 + 鬓发；交领右衽短衣 + 布带腰结 + 靛青窄裤绑腿 + 棕鞋；work 四帧锄地（蓄力/送柄/刃入土/回收），前倾自髋部、帽肩同步；运行时不镜像保右衽 | 同上 | 项目与比赛展示 |
| char-steam | 角色精灵表 | src/assets/characters/steam/worker.png | 项目内自制 | 同上 | 项目自有 | 2026-11-20 | V0.6 定稿（3197 B）：低冠布帽含檐底暗面 + 卷袖亮前臂 + 马甲边 + 工裤厚底靴；work 四帧扳手（搭上/压柄/至止点/卸力复位），颚口固定同一机件格位；场景 operate 点位镜像后压飞轮黄铜轮毂 | 同上 | 项目与比赛展示 |

- 规格与动作表：V0.6 方案 §5（48×64 单帧、192×256 整张、4 列×4 行、锚点 (24,58)、walk 5fps / work 4fps / sit 3fps、行走上下摆动 ≤1 素材像素）；工具尖端与帽檐单帧内留透明边距（格边 x0/x47 无不透明像素，Node 逐格核验）。
- 分层母版与对应关系：`tools/char-frames.mjs` 保留头帽/躯干/前后臂/腿/手持物分层部件与三时代色板；`tools/char-actions.mjs` 以母版为底稿派生 walk/work/sit 并 `buildFinal` 写出正式图集与 ×3 预览（tools/char-preview-{era}.png）；`tools/make-characters.mjs` 改为组图器（candidates / stands / final 三模式），V0.5 旧生成器隔离于 `tools/legacy/make-characters-v05.mjs`，不再写正式素材。
- 选型证据：唐代三候选 tools/candidates/tang-{a,b,c}.png（含 -idle / -zoom）与参考等高对照 tools/shots/v06/d1-compare.png（选 A）；三时代站姿母版 tools/candidates/{era}-stand.png 与三人并排剪影 tools/shots/v06/d2-trio.png；倍率 0.85/1.0 实机对比 scale085/100-*.png（选 1.0，人/门洞比例≈0.60 与参考一致）。
- 风格参考：用户提供的草帽农人像素参考图（本地副本 tools/shots/v06/reference-farmer.png，原图在用户桌面，未入库、不再分发），仅作精细度下限与比例/光向参照（帽顶到鞋底 60 截图像素仍可读帽檐、脸、袖手、双鞋）；未复制其背景、背带裤与配色。V0.5 的两张微信参考图沿用此前登记口径。
- 运行时配置见 `src/characters.js`（格尺寸、锚点、动作帧率、姿势复用含 operate→work、镜像规则、工具握点）；篮筐/木料/鱼竿仍由 `src/scene.js` 代码层绘制并按新手位修偏移；加载失败降级为程序化人物。
- 验收证据：等高前后对照 tools/shots/v06/d8-compare.png、盲测配对 d8-blind.png、深浅底像素边缘 d8-edges.png、实机全图与近景 points-{era}.png（副本 docs/screenshots/v06-scene-{era}.png）、劳动录像 labor-{era}.webm/.mp4（各 ≥2 轮循环）、移动端 mobile-{390,320}-*.png；详见 docs/verification.md V0.6 节。
