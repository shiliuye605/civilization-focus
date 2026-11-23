# V0.3 验证记录（场景转场版）

## 环境

| 项目 | 值 |
| --- | --- |
| 系统 | Windows 10.0.19045（x64） |
| Node.js | 24.16.0 |
| Vite | 7.3.8 |
| three | 0.187.0 |
| 浏览器 | 系统 Chrome 150.0.7871.250（无头 Chromium，WebGL / SwiftShader） |
| 驱动 | Playwright Core 临时安装，未写入 `package.json` / 锁文件 |
| 验收地址 | `npm run build` + `npm run preview` → http://localhost:4173 |

## 方法

1. `npm ci`、`npm run build`、`npm run preview`。
2. 临时 Playwright 脚本在生产构建上执行：点击/轻触地球、转场等待、牌匾控制、设置校验、假时钟快进、刷新恢复、节点回看、热点图鉴、像素静止比对、移动端视口测量。
3. 截图归档于 `docs/screenshots/`。

最终结果：**39 / 39 项回归通过**；控制台无错误、无页面异常。

## 首页与入口

- 首页可见元素：地球画布、时钟、设置，以及地球下方的时代说明 + 统一主控件（V0.7 起；早期版本仅前三者），无横向/纵向滚动。
- 时钟 `HH:mm` 24 小时制；Cinzel 字体加载成功。
- 点击地球 → 拉近 + 像素转场 → 场景视图，**保持待开始（不自动建轮）**；场景内「开始专注」才 running，牌匾「— 专注中 —」（V0.8 起；V0.7 及以前为进入即 running）。
- 控制区含 暂停 / 重置 / 首页；进度条 3 节点。
- 暂停 → 「— 已暂停 —」；继续 → running；重置需确认 → 待开始；待开始可开始。
- 返回首页计时不中断、roundId 不变；再进入恢复同一轮。
- 热点「石器」打开图鉴弹窗、可关闭。

## 设置 / 完成 / 解锁 / 休息

- 默认 25/5；空、0、-2、1.5、x 均给出明确错误且弹窗不关闭。
- 保存 3/2 后新轮次 durationMs=180000；返回修改 4/2 时当前轮仍 180000、roundId 不变。
- 假时钟快进完成：牌匾「— 本轮完成 —」+ 休息/再学选择；completedRounds=1；主题 tang；场景 aria 含「盛唐」；盛唐节点 is-current。
- 开始休息显示 02:00「— 休息中 —」；快进结束回待开始、轮数不增。
- 点击石器节点回看石器场景。

## 刷新恢复

- 运行中刷新回首页，再进入恢复同一 running 轮。
- 暂停刷新后再进入仍 paused 且倒计时数字一致。

## 移动端

- 390×844 与 320×568：首页元素齐全、主控件在视口内、无滚动；轻触进入场景。
- 牌匾与底部进度/提示完整位于视口内（实测 boundingRect 均在 viewport 内）。

## 动效

- 减少动态偏好：场景画布两次 `toDataURL` 完全一致（静止）。
- 转场在减少动态下压缩为快速切换（约 0.1s），功能不变。

## 视觉检查（截图）

- 首页体素地球：阶梯崖壁、雪顶、河流瀑布、海岸浪沫、针叶林、木屋炊烟、瞭望塔、篝火、离岛、大气边缘光。
- 转场中段截图可见镜头推近、时钟/齿轮淡出。
- 石器场景：岩洞壁画、茅草大屋、帐篷、晾皮架、石器架、篝火/烤肉、村民活动、鹿/鸟、河流踏石瀑布；石牌 HUD + 金色进度 + 提示。
- 盛唐场景：梯田、水渠、水车、唐屋、宝塔、织棚、柳/花树、农夫/织工/小舟；木牌 HUD。
- 完成态截图：牌匾显示选择按钮。
- 移动端场景 cover 裁切居中营地，HUD 不溢出。

## 构建

- `npm run build` 成功；产物 `dist/index.html` + `assets/index-*.css/js` + `assets/three-*.js`；无 chunk 警告。

## 未验证 / 待补

- Firefox / Safari / iPhone / Android / Edge 真机；字体跨内核渲染差异。
- 真机拖拽手感、横屏、浏览器缩放、WebGL 禁用降级分支。
- 25 分钟完整真实等待（用短时长 + 假时钟验证结算）。
- Qoder Sites 公网发布与无痕验收。
- 手动主题切换与工业时代不在本轮范围。
---

## V0.4 增补（M4/M5 实测）

### 声音合规（浏览器实测）

- 首屏与刷新后：`performance.getEntriesByType('resource')` 中无任何音频请求；开启意图保留为 paused。
- 设置内开启（真实手势）后才请求 forest.ogg；静音→「已静音」；静音中拖音量→自动取消静音并保存。
- 场景声音按钮：paused 显示「点击恢复声音」，点击后 playing（aria「静音」）；playing 点击→muted。
- 完成提示音：playing 且音量>0 的轮次结算时 `createOscillator` 计数 +2；muted 轮次与 volume=0 轮次结算计数不变。
- 环境音与计时解耦：结算/休息/回首页不停止环境音。

### 图鉴与解锁卡

- 图鉴面板：0 轮仅「石器聚落」1 标签 3 卡片；3 轮 3 标签 9 卡片；标签切换 aria-selected 正确；卡片切片 240×160 PNG 真实解码。
- 热点弹窗含场景切片；Esc 关闭、焦点回触发按钮。
- 解锁卡：0→1 轮仅展示「图鉴新增 3 张」行（极光/田园流水未就绪时不出现背景/环境音行）；P1 就绪后同流程展示三行。
- 非解锁轮（2→3）不弹卡；刷新后不重复弹卡；完成态保留「休息 / 再学一轮」选择。

### 移动端（Playwright + 系统 Chrome，320×568 / 390×844）

- 首页无横向滚动；设置弹窗完整在视口内且可滚动。
- 场景工具按钮竖排右下：与牌匾、底部进度 boundingRect 无交集，且整体在视口内。
- 图鉴面板单列（gridTemplateColumns 1 列），弹窗上下边均在视口内。
- 截图：tools/shots/mobile-{320,390}-{home,settings,scene,codex}.png。

### P1 音频测量（ffmpeg ebur128 + 解码回环检查）

| 文件 | 综合响度 | 真峰值 | 循环接缝（wrap Δ vs 内部 p99.9） |
| --- | --- | --- | --- |
| forest.ogg | -19.7 LUFS | -2.7 dBFS | 0.0089 / 0.1929 ✓ |
| forest.m4a | -19.7 LUFS | -2.7 dBFS | 0.0003 / 0.1925 ✓ |
| field.ogg | -19.8 LUFS | -2.8 dBFS | 0.1013 / 0.2052 ✓ |
| field.m4a | -19.9 LUFS | -3.4 dBFS | 0.0327 / 0.2027 ✓ |
| steam.ogg | -20.0 LUFS | -4.4 dBFS | 0.0041 / 0.2754 ✓ |
| steam.m4a | -20.1 LUFS | -4.4 dBFS | 0.1056 / 0.2560 ✓ |

- 三条环境音响度差 ≤0.4 LU；单文件 ≤500KB；P0（forest 双容器）≈730KB ≤1.5MB。
- 接缝判定：解码后首尾样本差小于文件内部相邻样本差 p99.9，即循环点不产生可闻爆音。

## V0.4 最终回归（M6，生产构建）

- 流程：`npm run build`（Vite 7，无警告；Three.js 独立分包 540KB / gzip 134KB，主包 102.5KB / gzip 37KB）→ `vite preview`（4173）→ `npm run regression`（tests/regression.mjs，Playwright + 系统 Chrome 无头 WebGL）。
- 结果：**76 项全部通过，0 失败**（tools/regression-final.log）。
- 覆盖：首页元素（地球/时钟/设置/时代说明/主控件/完成态休息入口）/无滚动/时钟/球体外轮廓与说明间距；点击·轻触·键盘·降级按钮仅浏览进入与拖拽防误触、场景内显式开始；转场后 HUD 状态与控制；暂停/继续/重置确认/返回不中断/再进入同轮；运行与暂停刷新恢复；旧档无 settings 回落；设置五类非法输入与保存持久化、当前轮不变；假时钟一次性结算；1/2 轮主题·地球 aria·背景·节点同步；解锁卡真实三行、非解锁轮不弹、刷新不重复；休息流程轮数不增；节点回看与未解锁灰化真实条件；9 图鉴热点+面板切片 240×160、标签 aria、Esc 焦点；声音首屏/刷新零请求、手势开启、静音/音量/更换交叉淡化、刷新 paused 需点击恢复、NotAllowedError 可见重试、提示音 playing +2 osc / 静音与音量 0 不响；三背景静态 checksum 与重绘无横滚；减少动态像素静止；320/390 布局与工具区无重叠、图鉴单列；PNG 全拦截程序化降级不黑屏且计时正常、无 JS 异常；WebGL 禁用降级按钮可浏览与开始；长任务 0、rAF 间隔 p95 < 45ms；素材预算达标。V0.8 追加：导航/开始拆分、完成态首页可编辑+休息入口、保存失败同次点击不建轮、非法草稿不阻断浏览、到期瞬间命令守卫、三轮解锁与全解锁回看、休息自然/手动结束、演示/正式通知隔离、安全整数溢出、四视口×三态布局间距、模拟键盘压缩视口（130–141、01b/03b/42c–e/122b/123c/126g）。
- 过程中修正的均为测试脚本自身问题（解锁卡/转场与点击竞态、dataURL 前缀截取长度、结算轮数断言、生产哈希文件名匹配、故意 abort 的预期资源错误），应用代码无缺陷。
- 截图更新：docs/screenshots/ 新增 home-steam / scene-steam / codex-panel / unlock-card，重拍 home-stone / home-tang / scene-stone / scene-tang / scene-done / settings，移动端截图同步 V0.4 版本。

## V0.4.1 牌匾时代化（计时 HUD 三套皮肤）

- 石器：缺角石牌改为斑驳岩面 + 裂纹线 + 苔痕；Cinzel 凿刻深色数字（大字对比 ≥4:1），状态/当地时间为深墨色（≥4.5:1）；燧石 chips、赭石主按钮。
- 盛唐：木牌保留木纹直边；数字改 Ma Shan Zheng 毛笔字形；深木 chips、琥珀主按钮。
- 工业：铆接铁牌（切角八边 + 黄铜内框 + 四角铆钉 + 拉丝铁纹）；Share Tech Mono 琥珀数字嵌凹面仪表窗；阶段句前状态指示灯随 run.status 变化（running 琥珀发光 / paused 暗铜 / done 绿 / idle 灰，plaque[data-state] 由 ui.renderScene 写入）；铁壳铜边 chips、黄铜主按钮、左下警示条纹。
- 实测：生产构建回归 76/76 通过；320×568 与 390×844 牌匾/工具区/底栏无重叠、工具区在视口内、图鉴单列；牌匾专项截图 tools/shots/plaque-{stone,tang,steam}.png、plaque-steam-done2.png（完成态绿灯 + 黄铜选择按钮）。
- docs/screenshots 场景/完成态/设置截图已按新牌匾重拍。

## V0.5 M0 基线确认与问题复现（2026-11-19）

- 环境：Windows 10.0.26300，系统 Chrome（Playwright Core 无头），Vite dev 5173；基线 package.json 0.4.0（含 V0.4.1 牌匾皮肤，commit 8033e0e，分支 v0.4）。
- 方法：只读静态检查 + `tools/repro-v05.mjs` 动态复现（临时脚本，不入库）。插桩方式：addInitScript 补丁 `AudioContext.decodeAudioData`（解码前记录 ArrayBuffer 字节数作为素材指纹）与 `AudioBufferSourceNode.start`（记录真实启动时间与指纹），路由仅拦截 resourceType=fetch 的音频请求（Vite 将 .ogg 作为模块引入，误拦截会阻断启动）；假时钟 `window.__advance` 推进 Date.now。
- 结果（12 项检查，11 项复现）：
  - R1 复现（S1）：开启森林音（延迟 1500ms）后 150ms 内关闭，加载完成后仍启动播放；prefs.enabled=false 但 UI 显示"正在播放环境音"，且关闭标记之后仍有 BufferSource.start。
  - R2 复现（S1）：加载窗口内 forest→field→steam 连续切换，最终 prefs=steam、UI 播放中，但实际唯一启动的素材是 forest（字节指纹判定）；field/steam 从未发声（select 在无 current 时不触发播放）。
  - R3 复现（S1）：forest 播放中→steam 慢加载（2500ms 后 abort）→field 成功播放→steam 的过期失败把状态覆盖为"加载失败"，此时 field 仍在发声。
  - R4 复现（S2/计时边界）：到期后点击暂停得到 status=paused、remainingMs=0 的零秒暂停，无法自然结束。
  - R5 复现（S2）：返回首页转场中到期解锁蒸汽，结算的 swapSceneEra 与 closeScene 并发（swapSceneEra 无 busy 守卫），最终卡在 scene 视图、theme=steam、解锁卡在首页流程外弹出，地球画布不可见、无法再进入。
  - R6 复现（M1）：390×844 与 320×568 下三时代热点出屏。390 蒸汽 engine 中心 x=−180、rail x=594（与方案 §6.1 静态计算一致）；390 石器 campfire/tent、盛唐 field 出屏；320 各时代同样 1–2 个热点出屏。
  - R7 未复现：加载期间静音，play 结束时读取 prefs.muted，最终状态"已静音"正确。该项无需修复，M1 验收仍覆盖。
- S3 静态确认：app.js 五处保存/读取失败仅 console.warn（启动存档恢复、存储不可用、声音偏好恢复、声音偏好保存、进度保存），无用户可见反馈。
- 未验证项：真机触摸、其他浏览器、公网环境（留待 M4）；本轮未修改任何应用代码。

## V0.5 M1 关键边界修复 + 保存提示 + 全景热点（2026-11-19）

- 修复内容：
  - `src/audio.js`：播放意图递增令牌；每次异步等待后校验令牌；关闭使在途请求失效；加载期间 select 也会发起新意图；过期失败不再覆盖新状态；syncPrefs/setMuted 不覆盖 loading 状态。
  - `src/app.js`：暂停前先结算到期轮次（消除零秒暂停）；结算遇转场 busy 时改走 pendingUnlock，不再并发 swap；swapSceneEra 增加 busy 守卫并以结算时代优先（takeover），旧回调不覆盖新状态。
  - 保存反馈：index.html 新增可关闭通知条 `#storage-notice` 与设置内 `#storage-status`；ui.js 区分进度保存失败 / 声音偏好保存失败 / 存档读取异常 / 声音偏好读取异常 / 存储不可用五类；同类失败不重复弹通知，设置中持续可见；不阻断计时。
  - 全景：scene.js `setFit('panorama'|'immersive')`，全景按扣除牌匾与底部进度安全区后的可用区域 contain 缩放，热点共用同一坐标变换；窄屏工具区新增 `#fit-btn`（进入全景后任何宽度保留按钮）；全景命中区 ≥44px、关闭暗角、时代深色底填充；切换不重建计时。
- 复现脚本复测（dev 5173）：R1–R5 全部不再复现；R6 全景切换后 390×844 与 320×568 三时代共 18 个热点全部在视口内、不与牌匾/底栏重叠；沉浸默认裁切按方案保留。
- 回归（生产构建 + preview 4173）：**98 项通过 0 失败**（原 76 项 + 新增 53–69：慢加载关闭、连续切换字节指纹判定最终素材、过期失败不覆盖、加载期静音、到期暂停优先结算、返回首页/回看转场中结算、隐藏期间到期、解锁卡打开时刷新不重复结算、全景可达/图鉴/计时不变/横竖切换/切回沉浸、保存失败通知与设置状态、存储不可用启动提示）。
- 测试脚本修正：音频路由 glob 由 `forest.*` 改为 `forest*` 以匹配生产哈希文件名；横屏 >640px 时全景按钮按设计隐藏，用例先转回竖屏。
- 辅助入口：窄屏密集热点除全景外仍可用图鉴面板（工具区按钮）访问全部九张内容。
- 未验证项：真机触摸与横屏实机（留待 M4）。

## V0.5 M2 独立演示模式与正式数据隔离（2026-11-19）

- 实现：设置内新增演示入口与说明（每轮专注 15 秒、休息 5 秒，不计入正式记录）；正式轮运行中进入需经确认弹窗先暂停保存；演示状态仅存内存（`app.js` 状态指针切换，`persist/persistAudio` 按模式分流，演示零写入 `wmf:v1:formal` 与 `wmf:v1:audio`）；场景顶部与设置内均有演示标识；演示声音偏好为正式偏好副本，退出恢复正式选择；退出回首页并恢复正式轮（保持暂停），刷新自动回正式模式；重置仅作用于演示当前轮；复用同一套计时/结算/解锁逻辑，仅时长参数区分（eras.js 既有 DEMO_FOCUS_MS/DEMO_BREAK_MS）。
- 回归（生产构建）：**106 项通过 0 失败**（新增 70–76：入口与 15 秒轮、两轮解锁三时代且正式轮数/分钟为零、重置不删正式、重新进入归零、运行中进入暂停正式且退出可继续、刷新回正式、演示声音不覆盖正式偏好、演示中设置标识与关闭）。
- 未验证项：真机演示流程手感（留待 M4 录屏）。

## V0.5 M3 三时代基础人物精灵与活动接入（2026-11-19）

- 素材管线（方案 §7.10/§7.11）：`tools/make-characters.mjs` 以手绘像素部件图（头/躯干/腿/臂/工具 + 时代色板）经 Node zlib PNG 编码合成三张 192×256 精灵表（`src/assets/characters/{stone/craftsman,tang/farmer,steam/worker}.png`）：48×64 格、4 行（待机 1 帧 / 行走 4 帧 fps5 / 劳作 4 帧 fps4 / 坐姿 2 帧 fps3），脚底基线 y=58，1px 深色轮廓（剪影描边 pass）；每材质三级明暗、接触阴影由场景侧 `shadow()` 提供。未调用生成式图像模型。
- 样稿 gate（§7.2）：先石器 ×3 放大预览（tools/char-preview-stone.png，临时）确认约 3 头身、五官、包裹式兽皮束带、石锤握点连手，再推广唐（交领袍布腰带布巾 + 锄）与蒸汽（衬衫背带裤工帽 + 扳手）；参考图仅借鉴比例/五官/明暗，未复制背景与草帽背带裤。
- 配置与接入：新增 `src/characters.js`（CHAR_CELL/CHAR_ANCHOR(24,58)/CHAR_ACTIONS/POSE_ACTION 姿势复用 stand→idle、walk→walk、sit/kneel→sit、pick→idle+篮、fish→idle+代码鱼竿、hoe→work、weave→sit/CHAR_MIRROR 唐不镜像（右衽）/CHAR_TOOL_GRIP）；`src/scene.js` 新增 `drawChar()` 替换 26 处活动调用（石器 13、唐 8、蒸汽 5），帧索引由场景时钟驱动、相位按对象 frame 错开；搬运木料/篮/束与鱼竿仍为代码层；程序化 `person()` 仅保留为加载失败降级。
- 前景层次修正（§7.4）：V0.4 的 near.png 除局部遮挡物外带全局半透明火光氛围（α≈36–40，覆盖全画布 77.6 万像素）。原前景 pass 将其整体压在动态对象之上，导致精灵像素被染色（探针实测：drawImage 后立即回读轮廓色 (43,29,18) 纯 187 像素，帧末变为 (60,34,22) 混合色，与 α=38/255 叠 (154,60,47) 的计算完全吻合）。修复：预加载时按 α<128 / α≥128 拆分 near 为氛围层与遮挡层，氛围垫在动态之下、遮挡留在动态之上；图鉴切片同序叠加，像素集合不变故切片观感不变。修复后帧末轮廓纯像素 172（差值为不透明兽皮道具正常覆盖）。**该分层调整其后按用户指令整体回退至 V0.4 原序，见文末「V0.5 补记」；本段保留为根因历史记录。**
- 回归（生产构建 + preview 4173）：**114 项通过 0 失败**（新增 77–81：77 石器轮廓纯色出现、78 待机 600ms 像素不变、79 行走区像素随时间变化、77b/77c 唐/蒸汽精灵在位且无页面错误、80 减少动态整画布静止且人物在位、81 精灵加载失败降级程序人物）。
- 测试脚本修正：81 原用路由拦截 `**/craftsman*`，但生产包将 <4KB 精灵表内联为 data URL 致拦截失效（此前因染色 bug 轮廓恒 0 而假通过）；改为按 PNG 头 192×256 从 dist 提取 data URL 前缀，在 addInitScript 中阻断 `HTMLImageElement.src` 赋值（dev 下按 /characters/ 路径阻断），降级路径真实生效。
- 证据截图：docs/screenshots/char-stone.png / char-tang.png / char-steam.png（1280×800，a/b 双帧间隔 450ms 验证行走/劳作相位推进、静态人物像素不变）、char-stone-panorama.png（390×844 全景剪影可读）。
- 未验证项：真机触摸与其他浏览器实机（留待 M4）；本轮未新增场景底图/环境音/背景。

## V0.5 M4 真实计时/实机/发布验收与交付材料（2026-11-19）

- 版本标记：package.json 与 package-lock.json 同步 0.5.0；最终生产构建复跑回归 **114 项通过 0 失败**（系统 Chrome 无头，preview 4173）。
- 真实完整轮（`tools/real-round.mjs`，临时脚本不入库；真实时钟、无假时钟插桩）：25 分钟专注按 deadline 结算（检测于 1500.8s，含 ≤20s 轮询间隔），completedRounds 0→1、focusMinutes 0→25、牌匾 00:00、盛唐解锁卡出现一次；随后 5 分钟休息结算（deadline 300s，检测于 315.2s 含 ≤15s 轮询间隔），回到 focus idle 25:00、轮数与分钟不变。证据：docs/screenshots/real-round-focus.png / real-round-break.png，数据 tools/shots/real-round.json。
- 实机项 D1–D10（`tools/real-device.mjs`，临时脚本不入库；系统 Chrome、生产构建、真实时钟）全通过：真实启动 running；后台停留 75s 后剩余按 deadline 正确推进（无头模式无法切换 visibilityState，改用 CDP `Page.setWebLifecycleState` frozen→active 实测后台冻结恢复，方法如实记录）；运行中刷新恢复 running 且剩余连续（回首页视图，再进入续同一轮）；暂停剩余冻结 / 恢复继续倒计时；手势开启环境音 AudioContext running 且偏好落盘；快捷静音 / 取消静音落盘；刷新后不自动发声、偏好保留、声音入口可恢复播放。数据 tools/shots/real-device.json。
- 排查记录：首轮实机脚本误报 D2/D3/D5，根因均为测试脚本自身（addInitScript 在每次导航重播种子覆盖存档；running 态存档 remainingMs 为 null 须按 deadline 换算；headless bringToFront 不改变 visibilityState），应用行为经原始存档探针确认无误，未改应用代码。
- 展示材料：`docs/demo-script.md`（2～3 分钟演示流程表）+ `docs/demo-recording.webm`（约 70 秒无声录屏，1280×800 实跑：首页→演示入口→石器与图鉴面板→两轮演示结算解锁盛唐/蒸汽→声音开关/静音→退出演示；录屏结束正式 progress 为零）。录屏依赖 playwright ffmpeg helper（`node node_modules/playwright-core/cli.js install ffmpeg`，仅本地缓存）。抽帧核验盛唐/蒸汽段画面与演示徽标正确。webm 约 24MB，作为本地交付件不入库。
- 文档同步：README 标题与本轮完成（V0.5）节、目录树（characters.js / assets/characters / make-characters.mjs / demo-script.md）、回归计数 114、已验证与未验证清单；docs/assets-register.md 角色精灵节；docs/AI-DISCLOSURE.md 第 5 节角色精灵与声明补充。
- 发布决策（用户 2026-11-19 答复）：**暂不提交**（不 commit / 不 push，工作区保留全部 V0.5 改动待后续指示）；**仅本地交付**（不发布公网）。故 §12.5「公网地址无痕可用」本轮未执行，列入未验证项；README「发布到 Qoder Sites」保留为后续可选流程。
- 未验证项：Firefox / Safari / Edge 与 iPhone / Android 真机；真机触摸与横屏手感；公网无痕验收（用户选择仅本地交付）；录屏未覆盖窄屏全景段（现场按演示流程表补演）。

## V0.5 补记：场景图层回退至 V0.4（2026-11-20，用户指令）

- 用户反馈：只允许修改人物，不允许改动场景。M3 曾按方案 §7.4 引入前景遮挡分层（把 near 拆成氛围层/遮挡层分别垫底/压顶），改变了前景植物岩石与火焰炊烟水光的叠放顺序、并使程序化贴花被氛围染色——属于超出人物范围的画面变化，用户不予接受。
- 回退内容：`src/scene.js` 删除 `splitNear`、`layerNear`、`layerNearUnder` 及 `draw()`/`sliceAt()` 的前景 pass；`preload` 恢复 `compositeLayers(eraId, imgs)` 整三层合成（贴花在其上），与 V0.4 逐行一致；沉浸模式 layout 公式与 V0.4 相同。
- 保留内容：人物精灵与 `drawChar` 接入、精灵帧时钟 `now`、全景 `setFit/getFit`（M1 既有功能，默认沉浸不启用）。
- 核对证据：`git diff HEAD -- src/scene.js` 剩余 hunk 仅人物调用替换、`now = t`、全景分支与 API；`src/assets/scenes/**` 无任何改动；重建后回归 **114/114**；重拍 docs/screenshots 全组与 char-* 证据（石器垂钓者回到芦苇之上、水光在前景之上，与 V0.4 叠放一致）。
- 方案偏差记录：§7.4 前景遮挡与 §12.3「遮挡顺序」项本轮不按方案执行，以用户指令为准；人物像素清晰不受影响（V0.4 顺序中火光氛围本就在人物之下）。M3 节中「前景层次修正」段保留为历史记录，以本补记为准。

## V0.6 人物精修版（2026-11-20，方案 E:\番茄钟\output\plans\iteration-v0.6-character-art-plan.md）

范围约束：只改人物、随身工具与对应场景动作点位；`src/assets/scenes/**` 与 V0.4 底图图层顺序零改动（用户指令沿用）。D8 后按用户反馈追加一项动态层遮挡修正：蒸汽火车驶过须覆盖轨道后方人物（见 D7 问题⑦），仅调整 `drawSteamDynamic` 内火车与人物绘制先后，底图与其余动态元素不变。版本 0.6.0（package.json / package-lock.json 同步）。

### D1–D2 选型与规格

- 基线：三时代同机位旧图 tools/shots/v06/baseline-scene-{era}.png 与旧图集 before-{era}.png；参考图本地副本 reference-farmer.png（自然尺寸 188×161，人物 bbox (76,40)-(116,104)，帽顶到鞋底 60px）。
- 唐代三候选（tools/candidates/tang-{a,b,c}.png）与参考、旧图等高并排 d1-compare.png + 候选贴回田间 field-tang-{a,b,c}.png/-crop：选 A（宽檐三档明暗、檐下鬓发托脸、右衽斜襟、腰结、绑腿双鞋）。
- 三时代站姿母版 {era}-stand.png/-stand-zoom.png 与三人并排 + 剪影 d2-trio.png；倍率决策：scale085/100-{era}.png 实机对比选 **1.0**（人/门洞比例≈0.60，与参考一致）；第 2 天定稿一套规格（48×64、锚点 (24,58)、11 有效帧/人）。
- 组图器改造：make-characters.mjs 三模式（candidates/stands/final），旧生成器隔离 tools/legacy/make-characters-v05.mjs。

### D3–D6 图集、接入与实机尺寸

- 三张定稿图集 33 有效帧：stone 3363 B / tang 3658 B / steam 3197 B（均 <4KB，生产包仍内联为 data URL）。劳动接触帧逐帧目检（×3 预览 char-preview-{era}.png）：唐锄刃 f2 抵土 y56–58 带土屑、前倾自髋帽肩同步；石器 sit f1 锤面 (21,40,7,4) 压膝上石芯顶 y44、托石手两帧稳定；蒸汽颚口 f0–f2 固定 (40,20)、f3 卸力复位 (36,32)。
- 接入：characters.js 新增 `operate: 'work'`；scene.js 仅 drawChar 倍率 ds=s/3、阴影随 ds、携物偏移改 ds 单位、蒸汽原 (760,585) 站姿改 **(342,508) operate flip**——镜像换算后颚口落飞轮黄铜轮毂 R(314,464,12,12)，脚底线与机座齐平；篮筐/木料/鱼竿仍场景绘制且与新手位连接（points-{era}-c0/c1.png 目检）。
- 移动端：mobile-{390,320}-{era}-{default,panorama}.png 共 12 张，scrollWidth 溢出全 0；全景剪影与默认视图道具可读。

### D7 回归改造与劳动录像

- 回归（生产构建 + preview 4173，系统 Chrome 无头）：**117 项通过 0 失败**。M3 检测重写：77 改为目标格绘制验证（idle 发束亮色 (106,74,48) 于 (385,257,10,2) + sit 石芯色 (124,132,140) 于 (366,556,7,5)，锚点换算格位）；77b 笠冠 strawL (240,212,138)；77c 裁切移至 operate 点位 (318,450,48,60) + 衬衣色 (232,232,224)；**新增 77d** operate 区 260ms 两帧像素和变化 + 扳手金属色 (140,148,156) 持续在颚口探针区（证明读取 work 行且推进）；**新增 77e** Node 侧 zlib 解码内联图集，work 行颚口格位 (40–46,20–26) 含扳手色 >5 且 idle 行同格位为 0（证明场景探针色来源为 work 行）；**新增 77f** 火车遮挡：rAF 时间戳冻结于三档相位（20s 停驶 / 31.23s 驶过站台 / 45s 驶离），站台人物裤色探针 144 → 0（且探针点变为车体 ironDark (34,38,43)）→ 144，证明火车驶过覆盖人物、驶离后恢复；81 缺图降级改断言新调色板色消失（旧描边 RGB 检测全部移除），内联前缀阻断保留，另加哈希独立资源路由阻断分支——当前构建未输出哈希 character 文件（<4KB 内联），该分支为条件覆盖，如实记录。
- 劳动录像：tools/shots/v06/labor-{stone,tang,steam}.webm（playwright recordVideo 1280×800 实跑，专注 running、0 页面错误）+ 同名 .mp4（项目内 ffmpeg-static libx264 转码，crf18）。每段含入场转场后 ≥2 个完整劳动循环（stone sit 循环 0.67s 实录约 6 循环；tang/steam work 循环 1s 实录约 4–5 循环）；抽帧 frameA/frameB 像素差证明动画推进；frameA 目检三处劳动点位接地与接触正确。
- 问题清单（发现→处理）：① 蒸汽候选工作点 (702,512) 脚落雨棚屋顶坡面悬空→改 (342,508) 飞轮区；② 石器发顶杂像素似双角→移两侧鬓发；③ 轮廓 pass 对触格边 x47 的工具跨格串像（唐锄刃/蒸汽颚口在邻格 x0 留描边竖线）→锄刃内收 2px、颚口 7px 收窄 5px（对齐格位不变），复验全表 x0/x47 不透明像素为 0；④ 参考图裁切误设 250×250→实测 188×161 重裁；⑤ playwright 自带 ffmpeg 无 libx264/libvpx(vp8)→改用项目 devDependency ffmpeg-static 转码 mp4；⑥ 回归 77c 旧裁切 (735,530) 指向已移除站姿→移 operate 点位；⑦ 用户反馈火车驶过被人压在车身之上（动态层先画火车后画人物）→ `drawSteamDynamic` 改为先画全部人物（脚点 y508/585 均在轨道平面 y631 之后）再画火车，驶过即遮挡；冻结相位截图 occl-20000/31230/45000.png 与回归 77f 佐证。无遗留未修问题。

### D8 前后对照、盲测、边缘与登记

- 等高前后对照 d8-compare.png：三时代各列 参考图 / V0.5 idle / V0.6 idle（各自不透明顶–底跨度归一到参考 60px→180px 显示）+ 实机 1× 行；五项（头部体积、脸部明暗、衣袖与手分离、腰腿结构、双脚接地）逐项目检均不低于参考可读性。
- 时代识别盲测 d8-blind.png：三张未标名站姿、工具遮罩、中性灰底、乱序 A/B/C；由**未接触设计稿的新 AI 会话**盲评（方案要求"没看过设计稿的人"，本轮以新会话代替人工，如实披露）：A=工业（鸭舌帽+马甲衬衫皮靴）、B=石器（单肩兽皮袒臂露膝）、C=唐代（宽檐笠+交领右衽束腰），**3/3 正确**，各给一条服饰依据。
- 像素边缘 d8-edges.png：idle 与 work 接触帧 ×4 于深底 #181210 / 浅底 #f2ead8，walk 四帧 ×4 条带；帽檐与工具尖端无削切、无邻格串像、深浅底无残留底色、帧间帽/襟/鞋尖一致。
- 最终游戏截图：points-{era}.png（1280×800、100% 缩放：明亮田垄 / 篝火边缘 / 暗色厂房，脸、持物手、支点可直接指出），副本 docs/screenshots/v06-scene-{era}.png。
- 文档同步：assets-register.md 角色节改 V0.6 定稿登记（含母版/候选/组图器/参考用途对应关系）、AI-DISCLOSURE.md 第 1/5/6 节、README 标题与 V0.6 节及回归计数 116、demo-script.md 人物看点；本文件本节。
- 交付决策沿用用户 2026-11-19 答复：**暂不提交、仅本地交付**；V0.6 全部改动保留工作区。tools/v06-*.mjs 为本地临时验证 harness（不入库口径），证据件保留于 tools/shots/v06/ 与 tools/candidates/。
- 未验证项：人工盲评（以新会话盲测代替）；Firefox/Safari/真机沿用 V0.5 未验证清单；哈希独立资源形式的缺图路由分支当前构建未触发（条件覆盖）。

## V0.6+ 环境音：四条实录 + 首页太空默认（2026-11-20，用户指令"工业换蒸汽火车、响度一致；首页专属太空背景音默认播放、不影响手动选择"）

- 来源与分配：森林鸟鸣-Felix-Blume-414098.mp3 → forest/石器（Freesound 414098，Felix Blume，**CC0 1.0**，页面核实并署名登记）；田园流水.m4a（56:30）→ field/盛唐；**蒸汽火车.m4a → steam/蒸汽（替换用户不喜欢的旧"工业.m4a"工业声景，展示名改"蒸汽火车"）**；**太空首页1.m4a → space/首页地球（新增第四条，home:true，不参与时代解锁门禁）**。后三条用户提供、许可未声明，仅本地交付。
- 处理链 `tools/ambience-import.mjs`（复用 audio-forge 的 K 加权 LUFS/真峰值/软膝归一）：8k 单声道分析 → 2s 块 RMS 变异系数 + 静块惩罚 + 峰值因子惩罚选最稳 40.6s 窗（forest 64s / field 3120s / steam 1916s / space 1244s 起）→ 44.1k 单声道提取 → 0.6s 等功率交叉淡化 baked 循环（成品 40s）→ 预限 -4 dBTP 归一 → 双容器编码（**Opus 80k constrained VBR 48k / AAC 96k 44.1k**）→ **逐容器实测再 trim + 八文件公共响度对齐**。
- 实测（ffmpeg ebur128=peak=true，tools/shots/v06/ambience-import.json；回环 tools/shots/v06/ambience-seam-all.json）：

| 文件 | 字节 | 积分响度 | 真峰值 | 循环首尾差 / 内部 p99.9 |
| --- | --- | --- | --- | --- |
| forest.ogg | 405559 | -20.0 LUFS | -4.1 dBTP | 0.0161 / 0.2214 ✓ |
| forest.m4a | 489587 | -20.0 LUFS | -4.1 dBTP | 0.0033 / 0.2243 ✓（修剪 AAC 尾部 padding 352 样本后） |
| field.ogg | 405707 | -20.0 LUFS | -3.0 dBTP | 0.0125 / 0.2298 ✓ |
| field.m4a | 506248 | -20.0 LUFS | -2.6 dBTP | 0.0146 / 0.2263 ✓（padding 355） |
| steam.ogg | 405573 | -20.0 LUFS | -4.7 dBTP | 0.0039 / 0.0485 ✓（编解码噪声底 0.0138） |
| steam.m4a | 489389 | -20.0 LUFS | -4.6 dBTP | 0.0514 / 0.0486 ✓（padding 352，噪声底 0.0029） |
| space.ogg | 405571 | -20.0 LUFS | -5.1 dBTP | 0.0199 / 0.0266 ✓ |
| space.m4a | 490263 | -20.0 LUFS | -5.0 dBTP | 0.0260 / 0.0266 ✓（padding 356，噪声底 0.0008） |

- **音量一致证据**：八文件积分响度极差 **0.0 LU**（全部 -20.0 LUFS）；真峰值全部 ≤ -1.5 dBTP；单文件 ≤500KB（最大 field.m4a 506248 B）、P0 forest 双容器 ≈874KB ≤1.5MB、八文件合计 ≈3.60MB。
- 回环判据（编解码感知）：解码 44.1k 单声道后与预编码波形做互相关对齐（起点 k∈[0,2000] 步长 4，中段 200 样本 MSE 最小），按最大偏差 >0.06 修剪尾部 priming/padding，首尾差 ≤ 内部相邻样本差 p99.9 + 2×编解码噪声底（噪声底=中段 |解码−预编码| 中位数）。**超稳态素材（蒸汽火车低频嗡鸣）内部 p99.9 极小，Opus 量化噪声本身即达 0.0138，故必须计入噪声底，否则无缝循环被误判**；预编码首尾差同样 ≤ p99.9（ambience-import.json preBoundary）。
- 实机播放探针 `tools/v06-ambience-play.mjs`（系统 Chrome、生产构建、真实手势，5 组）：① 首页默认太空——手势开启后仅请求 space.ogg、状态"正在播放环境音。"、页内解码 40.00s，进入石器场景自动切 forest；②③④ 三时代各自仅请求对应 ogg（forest/field/steam），解码均 40.00s，声音按钮 aria-label="静音"（playing）；⑤ 手动钉住 field 跨时代不跟随（stone→steam 节点切换无 steam.ogg 请求、prefs.followDefault=false/ambienceId=field），选回"自动"后首页恢复 space、再入蒸汽场景恢复 steam。全程 0 控制台/页面错误；数据 tools/shots/v06/ambience-play.json。页内 RMS 因频谱差异不同，响度一致以 K 加权 LUFS 为准。
- 首页默认 / 手动钉住 / 自动恢复策略（`src/app.js`）：新增 `resolveAmbience()`（手动 followDefault=false 且 id 有效→钉住；否则首页→home 条目 space、场景→当前时代条目）与 `syncAmbience()`（ambTarget 去重，避免同曲重启；开启声音时落盘有效 id）；syncTheme / openScene / closeScene / 演示进出均接入。设置声音列表首项新增 **"自动 · 首页太空 / 场景随时代"**（value=''）；选具体曲目即钉住（followDefault=false），选自动即恢复默认。声音总开关仍默认关闭、首屏零音频请求、需用户手势（浏览器自动播放限制 + 既定规格）；"首页默认播放"指声音开启/恢复后首页自动播太空，无需手动选曲。`src/audio-prefs.js` 新增 followDefault 字段（旧档缺省视为 true）。
- 时代跟随：**回归 118**（stone→tang→steam 节点切换，请求序列 forest.ogg→field.ogg→steam.ogg 且 prefs.ambienceId=steam）；**新增回归 119**（首页默认太空 + 自动单选 + 首页↔场景往返跟随，以 BufferSource 启动日志末项=space 证明回首页复用缓存缓冲不重复请求）与 **120**（手动 field 钉住跨时代不跟随 + 选回自动后首页 space/场景 steam 恢复）。回归 22b/23/27 更新为含自动项与首页 space 默认；V0.5 M1 音频竞态用例（53–56）改用手动钉住种子以保持原意图。
- 全量回归：**120 项通过 0 失败**（生产构建 + preview 4173）。
- 问题清单（发现→处理）：① 旧工业声景用户不喜欢 → 整条替换为蒸汽火车.m4a（选窗 1916s，cv 0.044 比旧工业 0.494 更稳）；② steam.ogg 回环首尾差 0.0901>内部 p99.9 0.0455 假失败 → 排查发现是 Opus 48k 对超稳态火车嗡鸣的量化噪声（解码−预编码恒定 ~0.05），非循环接缝 → 判据加入编解码噪声底；③ 试 Opus 96k 降噪后 field.ogg 577547B 超 500KB 预算 → 定稿 **Opus 80k constrained VBR**（四条 ogg 均 ≈405.5KB）+ 探针互相关对齐，八文件回环全过；④ AAC 解码尾部 padding（352/355/356 样本）超出预编码长度使 MSE 变 NaN → 比较窗取解码/预编码长度最小值、对齐后再修剪；⑤ 首页默认太空使原"首页开启播时代曲"的回归/M1 用例失效 → 22b/23/27 改断言 space 与自动项，53–56 改手动钉住种子，新增 119/120 覆盖新策略；⑥ 新回归初版种子 enabled:true 导致 Space 勾选反而关闭声音、且在首页点击仅场景可见的 #sound-btn 超时 → 改 enabled:false 种子并经设置勾选开启，复测通过（测试脚本问题，非产品缺陷）。
- 文档同步：assets-register.md 音频节（四条来源/许可/处理链/八文件实测 + 首页默认策略）、AI-DISCLOSURE.md §3/§6（第四条实录口径）、README 环境音条目与回归计数 120、DESIGN.md 奖赏表（蒸汽火车 + 太空首页）；本文件本节。交付决策沿用：**暂不提交、仅本地交付**。

## V0.7 首页主控件：直接输入时长 · 一键开始 · 状态感知（2026-11-20，用户指令"打开网页直接输入本轮专注时长、一键开始、看懂专注如何推动文明进步"）

- 结构（`index.html`）：`#home` 内新增 `.home-dock`（时代说明 `#era-caption` + 统一控件 `#home-control` + 错误位 `#home-error`）。控件为视觉一体的胶囊，但 HTML 是两个兄弟元素：左 `#home-start` 真按钮、右 `#home-minutes` 真输入（`inputmode=numeric`、`pattern=[0-9]*`、聚焦全选、移动端弹数字键盘）+ 固定「分钟」单位 `#home-unit`，输入带下划线提示可编辑。
- 布局（`src/styles.css`）：dock 底部居中、`pointer-events:none`，仅 `.home-control` `pointer-events:auto`，地球拖拽/空白点击不受影响；球心仍在视口中心，命中检测不变；`body.is-zooming` 淡出；640px 断点收窄。实测控件 boundingRect 在 1280×800 / 390×844 / 320×568 均完整在视口内、无滚动。
- 状态感知（`src/app.js` `buildHomeVM`/`homeCaption`）：待开始→「开始专注 │ N 分钟」（可编辑）；专注中/休息中→「专注中/休息中 · mm:ss」；已暂停→「已暂停 · mm:ss」（休息暂停为「休息暂停」）；完成→「选择下一步」。剩余用既有 `remainingOf`/`formatRemaining`。时代说明用既有 era 名/解锁条件/进度：当前时代且可解锁下一时代→「{时代} · 完成一轮/再完成 N 轮，解锁{下一时代}」；最终时代或回看旧时代→「{时代} · 已累计专注 X 分钟」；完成态优先轮次反馈「本轮已完成」，若本轮解锁→「本轮已完成 · {era}已解锁」（取 `run.completion.unlockedEra`）。区分 `settings.focusMinutes`（每轮）与 `progress.focusMinutes`（累计）。
- 时长共享与提交：抽出 `applySettings()`（设置保存与首页提交共用，含保存失败回滚 `state.settings`/`run.durationMs`）。首页编辑只改 focus、保留 break；Enter/合法失焦保存、Esc 放弃恢复上次保存值并失焦；非法（空→「请输入学习时长」，0/负/小数/非法→「请输入大于 0 的整数分钟」）保留草稿、阻止开始并聚焦输入；`homeDirty` + `activeElement` 守卫使 250ms 刷新不覆盖草稿/不移光标/不抢焦点。开始（按钮或地球，含键盘与 WebGL 降级入口）先 `commitHomeDraft()` 校验提交再 `openScene()`；`busy`/`view` 守卫 + idle→running 使连点只产生一轮。设置保存重置 `homeDirty`，首页即时同步且刷新保留；首页不读设置弹窗未保存表单。演示只读「开始专注 · 15 秒」，退出恢复正式设置。
- 回归（`tests/regression.mjs`，新增 24 项，编号 121–129）：121 待开始控件与说明；122 输入 40 Enter 仅保存停留首页；123a/b 按钮与地球均按 40 分钟开始；124a/b 设置 30 首页即时同步 + 刷新仍 30；125×5 非法（""/0/-2/1.5/x）保留草稿阻止开始；126a–f 专注中/已暂停/完成态标签与返回同一轮（暂停保持暂停、完成进入选择下一步、解锁反馈文案）；127a/b 演示只读 15 秒不覆盖正式时长；128a–c 草稿不被刷新覆盖 + Esc 恢复 + 失焦保存；129a/b 连点一轮 + 拖拽（>6px）不进入且轮次不变。case 01 扩展为含时代说明/控件/按钮/输入可见、控件在视口内、dock `pointer-events:none`/控件 `auto`。
- 实机探针 `tools/home-probe.mjs`（系统 Chrome、生产构建，临时脚本不入库）：31/31 通过，覆盖上述 ①–⑥ 场景与三视口控件可见性/指针事件；待开始首页截图 `docs/screenshots/home-idle-desktop.png` / `home-idle-390.png` / `home-idle-320.png`（地球居中、说明一行、胶囊一体、25 带下划线可编辑、无裁切/滚动）。
- 全量回归：**144 项通过 0 失败**（生产构建 + preview 4173；120 既有 + 24 新增）。既有时钟/地球拖拽/快捷点击/WebGL 降级检查保留。
- 文档同步：README 回归计数 144 与首页条目、V0.7  bullet、截图清单；DESIGN.md §1/§3 首页元素与底部主控件布局；本文件首页/移动端口径与本节。交付决策沿用：**暂不提交、仅本地交付**。

## V0.8 导航与开始拆分 · 完成态首页 · 命令守卫 · 球体布局（2026-11-20，方案 `E:\番茄钟\output\plans\civilization-focus-timer-implementation-plan.md`，用户指令"按这个方案再来改"）

- 导航/开始拆分（`src/app.js` `browseGlobe`/`homeStart`/`homeBreak`/`startFocus`/`startBreak`，`src/globe.js` onActivate 仅浏览）：地球轻触、键盘 Enter/Space、WebGL 降级按钮一律 `openScene()` 导航，不建轮；首页主控件与场景「开始专注」、完成态「休息 N 分钟」为显式开始命令。`enterScene` 回归助手拆为 `browseScene`（按 canvas `data-cx/cy` 真实投影中心点击）+ 仅 idle 时补点场景 start，保留原断言意图。
- 命令守卫：轮次相关命令先记录目标 roundId/mode、单次采样 now、先 `settleIfDue` 再校验 phase/status/roundId；`homeStart` 记录点击前 intent，到期瞬间的「返回专注」只导航看完成态、不建新轮（132b 同步 advance+click 证明）；过期重置确认 `confirmContext` 失配仅关闭（132a）；演示确认先结算、仅仍 running 才暂停。
- 完成态首页（`buildHomeVM`/`index.html` `#home-break`/`styles.css` `.home-break`）：done+focus 恢复可编辑「开始专注 │ N 分钟」+ 次级「休息 N 分钟」（演示为只读「开始专注 · 15 秒」+「休息 5 秒」）；休息自然/手动到期回 idle、轮数分钟不变（135b/c）；running/paused 标签「返回专注/返回休息/已暂停/休息暂停 · mm:ss」，返回保持原状态（126a–d、135a/d/e）。
- 输入与存储：`parseMinutes` 增加安全整数与 `minutes*60000`、`Date.now()+ms` 溢出拒绝（137×2）；blur 保存失败保留失败草稿+错误并置 `homeCommitFailed`，紧随的同次 start 点击消费该 flag 不建轮，恢复存储后重试按草稿开始（130a/b）；非法草稿不阻断地球浏览、场景开始用已保存值、返回首页草稿与错误保留（131a–c）；完成态输入与设置双向同步且不改当前轮 durationMs（138a/b）。
- 解锁归属：`pendingUnlock = {formal, demo}` 各持 `{eraId, roundId, homeDone}`；首页一次性短反馈「{era}已解锁 · 本轮已完成」在 caption 位消费一次（homeDone），场景首解卡独立消费一次，二者互不串 mode；新轮开始/演示进出清空各自 slot 与 homeFlash；刷新后内存通知不重放（136a–g、134b、69）。三轮连做每轮 rounds+1、前两轮各弹卡一次、三轮首页均完成态控件（133-1…5）；全解锁回看旧时代 done 刷新后首页可直接开始/休息、说明为累计分钟、新轮到期才累计（134a–c）。
- 球体布局（`src/globe.js` `computeLayout`/`setBottomReserve`/`applyCamera` yOff/`isPointOnGlobe`/`placeFallback`，`app.syncGlobeLayout`）：reserve = innerHeight − dock.top + gap（桌面 24 / 窄屏或矮窗 16）；半径 = min(旧公式×0.85, 可用高/(2×1.22))，球心 = 顶留白 10 + 可用高/2；相机 y 偏移随 zoom 渐隐；命中圆、键盘、降级按钮同区域；canvas `data-cx/cy/r/outer`（outer = 最大突出地块真实投影 r×1.2/0.996）供验收，**不再用整屏 canvas 矩形当球界**。实测外轮廓底→说明顶间距（px）：
  | 视口 | idle | done+休息 | 输入错误 |
  | --- | --- | --- | --- |
  | 1280×800 | 83 | 58 | 69 |
  | 1017×555 | 37 | 18 | 23 |
  | 390×844 | 215 | 193 | 201 |
  | 320×568 | 105 | 83 | 91 |
  说明→控件间距桌面 12 / 移动 10（要求 10–14）；四视口×三态均无滚动、最低元素在视口内（139×12）；1017×555 done 为最紧工况，球自动再缩至 r149。截图目视复核光晕外缘亦不触及说明（`docs/screenshots/home-*-1017.png` 等 12 张）。
- 移动端键盘：`interactive-widget=resizes-content` + 141 以 390×844 聚焦输入后压缩视口至 390×420 **模拟**键盘占位，输入/说明/错误仍可见、球再缩、无滚动；**真机软键盘未实测**（无真机环境），如实记录。
- 流程证据（`tools/flow-evidence.mjs`，系统 Chrome + 生产构建，临时脚本不入库；截图副本 `docs/screenshots/v08-flow-*.png`）：01 草稿 40（settings 仍 25）→ 02 点地球仅浏览 idle/roundId null/失焦已存 40 → 03 场景开始 durationMs 2400000 → 04 快进结算 rounds1/minutes40/unlocked tang → 05 完成态首页「开始专注│40」+「休息 5 分钟」→ 06 首页休息入口 break running 300000 → 07 结束休息回 idle 且 rounds/minutes 不变 → 08 一键新一轮 2400000 → 09 全解锁回看 done 首页可编辑+休息、说明累计 75 → 10 一键开始 1500000。
- 回归（生产构建 + preview 4173，系统 Chrome 无头）：**199 项通过 0 失败**（144 既有口径改造 + 55 新增/拆分：01b、03/03b、42b–e、50、122b、123b/c、126e–g、129b、130–141、138c）。改造保留原断言意图：03/50/42b 改「浏览 idle + 显式开始 running」；123b 改「浏览保存 40 + 场景开始 2400000」；126e/f 改完成态可编辑+休息入口+一键新轮；129b 拖拽改用真实投影中心；138c 完成态保存新值后一键开始按新值建轮。
- 问题清单（发现→处理）：① 初版布局预算误用 (1+K)r 导致 1017×555 done 外轮廓压说明 −4px → 改对称外轮廓 2Kr 预算后 +18px；② 首页消费解锁通知即清空 slot 使场景首解卡丢失（58 回归失败）→ 改 homeDone 标记、每模式各消费一次；③ 136e 原期望退出演示后重放首页反馈，与"每模式消费一次"冲突 → 断言改为不重放（累计说明）；④ 132b _advance 后异步点击存在 tick 竞态 → 改同步 advance+click 精确复现"到期瞬间"；⑤ 新用例在场景结算弹解锁卡后直接点被遮挡按钮超时 → 统一先关卡并等 fx 结束（m2CloseUnlock 加 fx 等待）。
- 文档同步：README  tagline/简介/回归计数 199/V0.8 bullet/截图清单；DESIGN.md §1/§3/§6/无障碍（球心布局、浏览语义、休息入口）；requirements.md §3 与 §6 V0.8 修订注、§12 验收 1；本文件首页口径与覆盖清单及本节。交付决策沿用：**暂不提交、仅本地交付**。
- 未验证项：真机软键盘遮挡（仅视口压缩模拟）、真机触摸拖拽（无头鼠标事件等效）、多标签页同步（方案明确本轮不做）、Safari/Firefox（仅 Chromium 无头）。

## V0.9 · 打开即播修复（2026-11-21）

- 用户报障：打开网页音乐不自动播放，必须进设置手动拨开关才起效。
- 根因（两层，均实测复现）：① 启动 `audio.markPaused()` 置 `paused`，而 `audio.select()` 旧守卫 `current || state==='loading'` 在该状态空转 → 打开/刷新后地球浏览、开始专注等正常操作都不出声，只有设置开关（`enable`）能播；② 真实自动播放策略下 `AudioContext.resume()` 被拦截时 promise **永久 pending**（probe 注入日志：`resume-call suspended` 后无 resolve/reject），播放卡 `loading`：无音频请求、无重试、无可见提示。
- 修复（`src/audio-prefs.js` / `src/audio.js` / `src/app.js` / `index.html` / `src/ui.js` / `src/styles.css`）：
  - 默认 `enabled:true`；启动 `syncTheme→syncAmbience→select` 即尝试播放，删除 boot `markPaused` 与 `select` 空转守卫（`select` 改为 enabled 即播）。
  - `play()` 以 `Promise.race([ctx.resume(), 400ms])` 判定：超时仍未 running 抛 `NotAllowedError` → `blocked` 可见态（不再卡 loading）。
  - `blocked/failed` 且 enabled 时挂载一次性任意手势恢复（`pointerdown`/`keydown` capture；跳过 `#settings-dialog` 与 `sound-quick/mute/retry` 控件避免双播）；`playing/muted/off` 摘除监听。
  - 首页齿轮左侧新增 `#home-sound-btn`（复用 `.settings-btn` 圆形样式，桌面 right+50 / 移动 +46，转场 `is-zooming` 淡出）；`ui.setSoundButton` 同步首页与场景两按钮；被拒琥珀色 `is-blocked`；行为同 `soundQuick`（off→开启、playing/muted→静音切换、blocked/failed→恢复）。
  - 关闭声音时首屏仍零音频请求；静音/音量/曲目刷新保留并自动恢复；设置内「再次尝试」保留。
- 实测（系统 Chrome + 生产构建 preview 4173；headed 与 headless 各一轮）：
  - 本机 Chrome 允许无手势 WebAudio 自播：enabled 存档打开即播 space（probe A/F）；关闭存档首屏 0 请求（probe G）。
  - 默认策略 headless（resume pending 路径）：刷新后 `blocked`、0 音频请求、首页按钮琥珀「浏览器阻止了声音，点击再次尝试」；**点地球任意一下**自动恢复并随时代切 forest（probe-h / 26b / 22c2）；键盘 Tab 同样恢复（26e）；注入 resume 拒绝的确定性路径同结论（26d/26d2）。
  - 首页按钮：关闭态一键开启（22d）；播放态一键静音/再点取消（26c/26c2）；390/320 可点、无溢出。
  - 截图：`docs/screenshots/v09-home-{blocked,playing}-{desktop,390,320}.png`（被拒琥珀斜杠图标 / 播放波纹图标；320 下时钟 18–69px 与按钮 220px 起不重叠）。
- 连带布局修复：回归 139（1017×555 done）一度 gap 6px —— `dock-in` 0.7s 入场动画使 `getBoundingClientRect().top` 漂移，`syncGlobeLayout` 采样到动画中间值。改为不受 transform 影响的几何量：`reserve = computed bottom + dock.offsetHeight + gap`。复测 t0/t400/t1600 gap 34/23/18（全程 ≥16），球半径/球心恒定 r149/cy192。
- 回归（生产构建 + preview 4173，系统 Chrome 无头）：**207 项通过 0 失败**。新增/改造：22c/22c2（默认开启+被拒可见+任意点击即播）、22d（首页一键开启）、26/26b（刷新自动尝试+被拒无请求可见+任意手势恢复随时代）、26c/26c2（首页一键静音/取消）、26d/26d2/26e（注入拒绝→任意点击/键盘恢复）；118 去除多余 `#sound-btn` 点击（boot 已自动播）。其余 199 项口径不变全通过。
- 文档同步：README 简介/声音 bullet/回归计数 207/V0.9 bullet/截图清单；DESIGN.md §1 首页元素、§3 齿轮几何、§6 转场淡出、§设置声音区、§12 状态机与打开即播；requirements.md §3/§9/§12.7 V0.9 修订注；本文件本节。
- 未验证项：iOS Safari / Android 真机自动播放策略（任意手势路径已覆盖被拒情形，但未真机实测）；浏览器高参与度（MEI）自动放行场景依赖浏览器自身积累。
- 交付决策沿用：**暂不提交、仅本地交付**；临时探针 `tools/audio-probe.mjs`、`tools/probe-h.mjs`、`tools/probe-139.mjs`、`tools/shoot-v09.mjs` 不入库。

## V0.10 · 首页运行/暂停态三段控件（2026-11-21）

- 需求：用户指出首页运行态只有「返回专注 · mm:ss」一个入口，逻辑不完整（大量用户在首页学习）；批准方案 A——运行/暂停态胶囊改三段 `[暂停/继续] │ [返回 · mm:ss] │ [重置]`，原地生效、不新增视图；要求零多余修改、零新 bug。
- 改动仅五文件：`index.html`（`#home-pause` + `#home-sep-left` 置于 `#home-start` 前、`#home-sep-right` + `#home-reset` 置于 `#home-unit` 后，均默认 hidden；16×16 线性 SVG：暂停双竖线 / 继续三角 / 重置环箭头，无新素材）；`src/styles.css`（`.home-seg` 44px 宽、`align-self:stretch` 随胶囊高度、hover 琥珀 `--accent-soft`、重置 hover `--danger`  tint、`focus-visible` 内描边、`data-mode` 切换图标）；`src/ui.js`（els 四引用 + `renderHome` 按 `vm.segment` 显隐三段与 aria-label/title 切换，其余渲染逻辑不动）；`src/app.js`（`buildHomeVM` 运行/暂停分支加 `segment:'pause'/'resume'`；新增 `homePauseToggle`/`homeResetRequest` 挂到 actions `home-pause`/`home-reset`，走既有文档级 `[data-action]` 委托）；`tests/regression.mjs`（142a–l 17 项 + 139 扩展 running/paused × 四视口 8 项 + 139 增加胶囊左右边界断言）。
- 守卫链与场景完全同源：`homePauseToggle` 记录点击意图 → `settleIfDue(now)` → 状态变化（到期结算）只 `renderHome` 不执行命令；否则 running→`pauseTimer()`、paused→`resumeTimer()`（二者自带 roundId/mode 校验与 announce）。`homeResetRequest` 同链后交 `requestReset()`（confirmContext 记 demo/roundId/mode）→ 既有确认弹窗 → `confirmReset()` 过期仅关闭。两 handler 均 `busy || view!=='home'` 前置守卫，转场期间不误触。中段 `#home-start` 的 id、标签、点击语义与待开始/完成态渲染完全未动。
- 实测几何（系统 Chrome 无头 + 生产构建 preview 4173，`tools/shoot-v10.mjs`）：
  - 高度三态一致：桌面 idle/running/paused 均 58px；390/320 均 54.4px → `syncGlobeLayout` 留白不变，球外轮廓底/说明顶三态逐像素相同（桌面 601/683.8；390 527/741.6；320 361/465.6）。
  - 宽度只增不溢：桌面 idle 302.4 → running 327.6 / paused 320（≤460 dock）；390 idle 248.4 → running 291.1；320 running 291.1 ≤ 92vw=294.4，left 14.4 / right 305.6 全在视口内 → **方案中「≤360px 降级文案」条件未触发，未引入降级文案**（中段标签全视口一致）。
  - 命中区：桌面 44×44；窄屏 44×40.4（与胶囊内主按钮同高，保持 dock 高度不变的前提）；四视口 scrollW/H 均等于视口。
- 回归（生产构建 + preview 4173）：**232 项通过 0 失败**（207 + 25）。新增 142a 三段齐全与 aria、142b 原地暂停冻结（remainingMs 守恒）、142c 原地继续（deadline 重建）、142d/d2 重置需确认/取消保持原轮、142e 确认回待开始且历史为零、142f 到期瞬间暂停只结算 done、142g 过期确认仅关闭不撤销完成、142h/h2/h3 休息三段暂停继续、142i 休息重置回待开始不计进度、142j/j2 演示三段与重置不碰正式（输入仍只读 15 秒）、142k 焦点左中右 + Enter 开确认 + Esc 不改计时、142l 320/390 胶囊在视口内且命中区达标；139 增 running/paused × [1280×800, 1017×555, 390×844, 320×568] 8 项（外轮廓间距、说明-控件 10–14px、胶囊左右边界、无滚动）。既有 207 项口径未改全通过（含 126a–g/135a–e 中段标签断言）。
- 截图：`docs/screenshots/v10-home-{running,paused}-{desktop,390,320}.png` 六张，目视确认三段分隔线、图标字形、琥珀中段胶囊与地球留白；320 运行态胶囊两端留边均匀、无裁切。
- 零改动确认：场景 HUD、转场、音频状态机、解锁归属、设置弹窗、地球渲染均未触碰；`git status` 仅上述五文件 + 四文档 + 六截图（截图与临时脚本不入库）。
- 文档同步：README 回归计数 232 / 覆盖 bullet / V0.10 bullet / 截图清单；DESIGN.md §3 三段矩阵与几何；requirements.md §3/§6 V0.10 修订注 + §12 验收第 9 条；本文件本节。
- 交付决策沿用：**暂不提交、仅本地交付**；临时脚本 `tools/shoot-v10.mjs` 不入库。

## V0.11 · 累计分钟解锁、保存边界与结束反馈（2026-11-21）

### 实施范围

- 正式门槛改为已完成专注 0 / 50 / 100 分钟；`completedRounds` 继续统计，不再作为新档门禁。所有场景、图鉴、主题、背景、环境音使用统一开放集合，进度条只显示已结算分钟。
- `legacyEraFloor` 仅为缺字段的旧档迁移资格，新档和非法现有字段为 `stone`；保留真实分钟、合法视图、设置、轮次和防重标识。单轮跨两门槛一次转场、合并一张卡。
- 首页保存通过指针启动意图区分同次失焦失败与后续独立点击；保留草稿及错误，Tab 失焦失败后的独立重试可启动。
- 首页和场景共享首次显示起 4 秒的完成反馈；新轮和模式切换清理旧反馈。自然休息到期播放一次双音，主动结束不播放；首页休息右按钮为「结束休息」，重置取消文字为「取消」。
- 补修揭幕阶段到期的同步竞态：转场结束重新同步地图、完成态按钮和待展示解锁卡；正式转场延迟回调核验模式归属，不覆盖演示场景。

### 本轮执行环境与结果

- Windows、本机 Chrome **156.0.8078.80**、Node **24.18.0**（实际 Git Bash 测试进程）；Playwright Core 调用系统 Chrome。开发服务器 5174，独立生产预览 `http://127.0.0.1:4183/`（原 4173 已占用，未停止原服务）。
- `npm run build`：通过；`node --check` 与本轮修改文件的 `git diff --check`：通过。
- 首轮回归在 135c 因「结束休息」选择器命中隐藏首页按钮超时；已限定到场景控制区，未删除或放宽断言。初次日志保留为 `tools/shots/v11-regression-initial.log`。分组复测135组5项、旧回归尾段53项通过。新增验收首跑248通过/3失败，均来自音频固定900ms等待未确认就绪；改为实际播放状态就绪后触发到期，音频组8项复测通过，保留原提示音计数断言。最终完整回归 **488 项通过、0 失败**（含A1–A14、入场/回看揭幕到期及既有降级覆盖）；完整命令 `VERIFY_URL=http://127.0.0.1:4183/ npm run regression`，退出码0，最终日志 `tools/shots/v11-regression.log`。
- 独立浏览器定点检查已通过：四轮 25 分钟累计 25/50/75/100，仅第 2/4 轮解锁；单轮 100 分钟合并卡与下一轮；旧档 1轮/25分钟和2轮/50分钟保资格；新档2轮/2分钟及非法字段49.5分钟不提前开放；单次保存失败与 Tab 独立重试；正式到50分钟与确认演示重合、演示两轮后退出不污染正式进度。
- 休息定点检查：自然结束只创建 2 个提示音振荡器（一组双音），重复 tick 不增加；不增加正式分钟和轮数；静音仍显示反馈，3999ms 保留、4000ms 恢复常态。入场及回看揭幕期间到期均同步蒸汽地图、完成态按钮及一次卡片。
- 真实等待检查：未修改 `Date.now`，实际完成 1 分钟专注 + 1 分钟自然休息；累计仍为1分钟/1轮，盛唐保持锁定，休息回到待开始。证据：`tools/shots/v11-real-minute.json`。
- 内置浏览器实际操作已验证开始→场景暂停→返回首页→重置取消保持暂停，控制台无 error/warn。截图已逐项检查主要状态，320px 双时代合并卡完整位于视口内，继续后可开下一轮。

### 可核对证据

- `tools/shots/v11-minute-evidence.json`：四轮结算快照、首次保存失败/独立重试、Tab 重试、两种视口几何与休息反馈。
- `docs/screenshots/v11-25-remaining-1017.png`：累计25分钟、仍距盛唐25分钟。
- `docs/screenshots/v11-50-unlock-320.png`：累计50分钟的盛唐反馈。
- `docs/screenshots/v11-100-all-1017.png`：累计100分钟、全部开放后仍可开始/休息。
- `docs/screenshots/v11-double-unlock-{1017,320}.png`、`v11-merged-card-320.png`：双门槛合并反馈与卡片。
- `docs/screenshots/v11-save-failure-{1017,320}.png`：40分钟草稿与单次保存失败。
- `docs/screenshots/v11-break-control-320.png`、`v11-break-ended-320.png`、`v11-natural-break-{1017,320}.png`：结束休息操作、主动及自然结束反馈。

### 验证边界

- 本轮长计时采用 `Date.now` 假时钟快进，不冒充重新真实等待100分钟；视口测试不是手机真机测试。
- 未验证 iOS Safari、Android 真机、Edge/Firefox、多标签同时写入、手机键盘和操作系统杀进程后的恢复。未公开部署、未替换音源，原音频授权限制继续保留。
- 保留既有未提交工作，仅本地修改与验证；未 commit、未 push、未发布。

## 宇宙时钟与四时代二十处地点（2026-11-23）

- Windows 上使用系统 Chrome 的无头模式验证。地点专项 209 项、时钟专项 101 项、文明专项 299 项通过。覆盖模型加载、人物日程、跟随镜头、主动切换的单次翻页、重新加载后的地点记忆、旧档迁移以及正式与演示各自的解锁和存档。
- 修复 WebGL 不可用时地点与人物控件仍可操作的问题。信息时代的降级界面可把焦点移到首页计时器。模型加载失败保留已显示的地点，可独立重试。
- 全量回归首轮 512 项通过。唯一失败项为第 141 项，窄屏被软键盘压缩时表盘和底部说明间距不足。修复后在生产预览中原样复跑该用例及整个布局组，23 项通过，包含 390×420 压缩视口。
- 项目从空的依赖目录安装并构建成功。生产预览中验证了地点切换、刷新恢复、累计 150 分钟解锁信息时代，以及 WebGL 禁用后的计时。手机尺寸与触摸由浏览器模拟。
