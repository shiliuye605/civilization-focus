import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { ERAS as HOME_ERAS, SCENES, SCENES_BY_ERA } from '../src/scene-catalog.mjs';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.VERIFY_URL || 'http://localhost:4173/';
// cx/cy 四舍五入、rx/ry 向上取整，单边投影读数最多比真实轮廓外扩 1.5px。
const DIAL_PROJECTION_EPSILON = 1.5;

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`FAIL ${name} ${extra}`);
  }
}

function baseSeed(over = {}) {
  return {
    version: 1,
    settings: { focusMinutes: 25, breakMinutes: 5 },
    run: { mode: 'focus', status: 'idle', durationMs: 1500000, deadline: null, remainingMs: 1500000, roundId: null, completion: null },
    ...over,
    // 覆盖 progress 也默认属于新规则档；迁移用例必须显式 delete 此字段。
    progress: { legacyEraFloor: 'stone', completedRounds: 0, focusMinutes: 0, lastSettledRoundId: null, viewEra: 'stone', ...over.progress }
  };
}

const CLOCK_PATCH = `
  (() => {
    const real = Date.now.bind(Date);
    let off = 0;
    let frozen = null;
    window.__advance = (ms) => { off += ms; };
    // 新验收用冻结的 Date.now 精确验证 3999/4000ms；RAF/转场仍使用真实时间。
    window.__freezeClock = () => { frozen = real(); };
    Date.now = () => (frozen === null ? real() : frozen) + off;
    window.__osc = 0;
    window.__srcLog = [];
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !AC.prototype.__patched) {
      const orig = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function (...a) { window.__osc += 1; return orig.apply(this, a); };
      const od = AC.prototype.decodeAudioData;
      AC.prototype.decodeAudioData = function (data) {
        const size = data.byteLength;
        const p = od.call(this, data);
        p.then((b) => { b.__bytes = size; });
        return p;
      };
      const os = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) {
        window.__srcLog.push({ at: performance.now(), bytes: this.buffer ? this.buffer.__bytes : null });
        return os.apply(this, a);
      };
      AC.prototype.__patched = true;
    }
  })();
`;

async function newPage(browser, seed, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1280, height: 800 } });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') page.errors.push(m.text());
  });
  await page.addInitScript(([s, clock, extra, seedAudio]) => {
    if (!localStorage.getItem('wmf:v1:formal')) localStorage.setItem('wmf:v1:formal', JSON.stringify(s));
    if (seedAudio && !localStorage.getItem('wmf:v1:audio')) localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null }));
    if (clock) eval(clock);
    if (extra) eval(extra);
  }, [seed, opts.clock === false ? null : CLOCK_PATCH, opts.extraInit || null, opts.audioSeed !== false]);
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (opts.route) await page.route(opts.route.pattern, opts.route.handler);
  if (opts.routes) for (const r of opts.routes) await page.route(r.pattern, r.handler);
  await page.goto(URL);
  await waitForHomeReady(page);
  return page;
}

async function waitForHomeReady(page) {
  await page.waitForSelector('body[data-app-ready="true"]');
  // app-ready 早于异步 GLB 加载；几何采样必须等模型或可见降级入口就绪。
  await page.waitForFunction(() => {
    const visible = (el) => el && !el.hidden && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const dial = document.getElementById('dial-canvas');
    return (visible(dial) && dial.dataset.ready === 'true' && ['cx', 'cy', 'rx', 'ry'].every((key) => Number.isFinite(Number(dial.dataset[key]))) && +dial.dataset.rx > 0 && +dial.dataset.ry > 0) || visible(document.getElementById('dial-fallback'));
  });
  await page.waitForFunction(() => document.getElementById('home-dock').getAnimations().every((animation) => animation.playState === 'finished'));
}

async function waitForHomeNear(page) {
  await page.waitForSelector('body[data-view="home"][data-dial="near"]');
  await page.waitForSelector('#civilization-entry', { state: 'visible' });
}

async function dialCenter(page) {
  await waitForHomeReady(page);
  if (await page.locator('#dial-canvas').isVisible()) {
    return page.evaluate(() => {
      const c = document.getElementById('dial-canvas');
      return { x: +c.dataset.cx, y: +c.dataset.cy };
    });
  }
  const b = await page.locator('#dial-fallback').boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function browseScene(page) {
  // 近看时钟不是文明导航；已在场景时不能再点击首页 canvas。
  if ((await page.getAttribute('body', 'data-view')) !== 'scene') {
    await page.click('#civilization-entry');
    await page.waitForSelector('body[data-view="scene"]');
    await page.waitForTimeout(2100);
  }
  await page.waitForFunction(() => !document.body.classList.contains('is-zooming') && !document.getElementById('fx-canvas').classList.contains('is-active'));
}

async function enterScene(page) {
  await browseScene(page);
  const start = page.locator('#plaque-controls [data-action="start"]');
  if (await start.count()) await start.click();
}

const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wmf:v1:formal')));
const prefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wmf:v1:audio')));
const page2Dock = (page) => page.evaluate(() => ({
  state: document.getElementById('home-control').dataset.state,
  button: document.getElementById('home-start').textContent,
  caption: document.getElementById('era-caption').textContent,
  inputHidden: document.getElementById('home-minutes').hidden
}));
const audioFetches = (page) => page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\.(ogg|m4a)$/.test(r.name)).map((r) => {
  const f = r.name.split('/').pop();
  const m = f.match(/^(forest|field|steam|space).*\.(ogg|m4a)$/);
  return m ? `${m[1]}.${m[2]}` : f;
}));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

/* ---------- 首页与入口 ---------- */
{
  const page = await newPage(browser, baseSeed());
  const home = await page.evaluate(() => {
    const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const ctrl = document.getElementById('home-control').getBoundingClientRect();
    return {
      dial: vis(document.getElementById('dial-canvas')),
      dialLabel: document.getElementById('dial-canvas').getAttribute('aria-label'),
      dialView: document.body.dataset.dial,
      viewBtn: vis(document.getElementById('dial-view-btn')),
      civilizationEntry: vis(document.getElementById('civilization-entry')),
      clock: vis(document.getElementById('clock')),
      settings: vis(document.getElementById('settings-btn')),
      fallbackHidden: document.getElementById('dial-fallback').hidden,
      caption: vis(document.getElementById('era-caption')),
      control: vis(document.getElementById('home-control')),
      startBtn: vis(document.getElementById('home-start')),
      minutesInput: vis(document.getElementById('home-minutes')),
      ctrlInVp: ctrl.bottom <= window.innerHeight && ctrl.right <= window.innerWidth && ctrl.left >= 0,
      dockPE: getComputedStyle(document.getElementById('home-dock')).pointerEvents,
      ctrlPE: getComputedStyle(document.getElementById('home-control')).pointerEvents,
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      clockText: document.getElementById('clock').textContent,
      dialBottom: +document.getElementById('dial-canvas').dataset.cy + +document.getElementById('dial-canvas').dataset.ry,
      capTop: document.getElementById('era-caption').getBoundingClientRect().top,
      capBottom: document.getElementById('era-caption').getBoundingClientRect().bottom,
      ctrlTop: document.getElementById('home-control').getBoundingClientRect().top
    };
  });
  ok('01 首页元素齐全且无滚动', home.dial && home.clock && home.settings && home.fallbackHidden && home.caption && home.control && home.startBtn && home.minutesInput && home.viewBtn && home.civilizationEntry && home.ctrlInVp && home.dockPE === 'none' && home.ctrlPE === 'auto' && home.scrollW <= home.innerW && home.scrollH <= home.innerH, JSON.stringify(home));
  ok('01b 时钟全景投影与说明间距≥24 说明与控件 10-14', home.capTop - home.dialBottom + DIAL_PROJECTION_EPSILON >= 24 && home.ctrlTop - home.capBottom >= 10 && home.ctrlTop - home.capBottom <= 14, JSON.stringify({ gap: home.capTop - home.dialBottom, capCtrl: home.ctrlTop - home.capBottom }));
  ok('01c 首页为宇宙时钟全景', home.dialView === 'far' && home.dialLabel.includes('宇宙时钟'), JSON.stringify(home));
  ok('02 时钟 HH:mm 24h', /^\d{2}:\d{2}$/.test(home.clockText), home.clockText);
  const initialRun = (await state(page)).run;
  const center = await dialCenter(page);
  await page.mouse.click(center.x, center.y);
  await waitForHomeNear(page);
  ok('02b 点击时钟只近看不进文明或开始计时', JSON.stringify((await state(page)).run) === JSON.stringify(initialRun) && (await page.locator('#scene').isHidden()) && (await page.locator('#civilization-entry').isVisible()));
  for (const view of ['far', 'near', 'far']) {
    await page.click('#dial-view-btn');
    await page.waitForSelector(`body[data-view="home"][data-dial="${view}"]`);
    ok(`02c 视角按钮切换 ${view} 不改计时且文明入口可见`, JSON.stringify((await state(page)).run) === JSON.stringify(initialRun) && (await page.locator('#civilization-entry').isVisible()) && (await page.getAttribute('#dial-canvas', 'aria-label')).includes('宇宙时钟'));
  }
  await browseScene(page);
  let s = await state(page);
  ok('03 独立文明入口进入场景保持待开始', s.run.status === 'idle' && s.run.roundId === null && (await page.textContent('#plaque-status')) === '— 待开始 —', JSON.stringify(s.run));
  await page.click('[data-action="start"]');
  s = await state(page);
  ok('03b 场景内开始才进入 running', s.run.status === 'running' && (await page.textContent('#plaque-status')) === '— 专注中 —');
  const controls = await page.evaluate(() => [...document.querySelectorAll('#plaque-controls [data-action]')].map((b) => b.dataset.action));
  ok('04 控制区与三节点', ['pause', 'reset', 'back-home'].every((a) => controls.includes(a)) && (await page.locator('.node').count()) === 3, controls.join(','));
  await page.click('[data-action="pause"]');
  ok('05 暂停/继续', (await page.textContent('#plaque-status')) === '— 已暂停 —' && (await state(page)).run.status === 'paused');
  await page.click('[data-action="resume"]');
  ok('05b 继续 running', (await state(page)).run.status === 'running');
  await page.click('[data-action="reset"]');
  ok('06 重置需确认', await page.locator('#confirm-dialog[open]').count() === 1);
  await page.click('[data-action="confirm-reset"]');
  ok('06b 确认后待开始', (await state(page)).run.status === 'idle');
  await page.click('[data-action="start"]');
  const roundId = (await state(page)).run.roundId;
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1400);
  s = await state(page);
  ok('07 返回首页计时不中断', s.run.status === 'running' && s.run.roundId === roundId);
  await enterScene(page);
  ok('07b 再进入同一轮', (await state(page)).run.roundId === roundId);
  await page.click('[data-hotspot="tools"]');
  const codex = await page.evaluate(() => ({
    open: document.getElementById('codex-dialog').open,
    title: document.getElementById('codex-title').textContent,
    slice: !document.getElementById('codex-slice').hidden
  }));
  ok('08 热点图鉴含切片', codex.open && codex.title === '打制石器' && codex.slice);
  await page.keyboard.press('Escape');
  ok('08b Esc 关闭且焦点回热点', await page.evaluate(() => document.activeElement?.dataset?.hotspot === 'tools'));
  ok('08c 控制台无错误', page.errors.length === 0, page.errors.join('|'));
  await page.close();
}

/* ---------- 设置 ---------- */
{
  const page = await newPage(browser, baseSeed());
  await page.click('#settings-btn');
  const defaults = await page.evaluate(() => [document.getElementById('focus-minutes').value, document.getElementById('break-minutes').value]);
  ok('09 默认 25/5', defaults[0] === '25' && defaults[1] === '5', defaults.join('/'));
  for (const bad of ['', '0', '-2', '1.5', 'x']) {
    await page.fill('#focus-minutes', bad);
    await page.click('#settings-form button[type="submit"]');
    const st = await page.evaluate(() => ({ open: document.getElementById('settings-dialog').open, err: !document.getElementById('focus-error').hidden }));
    ok(`10 非法输入 "${bad}" 报错且不关闭`, st.open && st.err);
  }
  await page.fill('#focus-minutes', '3');
  await page.fill('#break-minutes', '2');
  await page.click('#settings-form button[type="submit"]');
  await enterScene(page);
  let s = await state(page);
  ok('11 保存 3/2 新轮 180000', s.run.durationMs === 180000, String(s.run.durationMs));
  const rid = s.run.roundId;
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1400);
  await page.click('#settings-btn');
  await page.fill('#focus-minutes', '4');
  await page.click('#settings-form button[type="submit"]');
  s = await state(page);
  ok('12 修改设置不影响当前轮', s.run.durationMs === 180000 && s.run.roundId === rid && s.settings.focusMinutes === 4);
  await page.close();
}

/* ---------- 完成 / 解锁 / 休息 ---------- */
{
  // 最后 3 分钟跨过首个门槛；不是把短轮按轮数直接解锁。
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 3, breakMinutes: 2 }, progress: { legacyEraFloor: 'stone', completedRounds: 0, focusMinutes: 47, lastSettledRoundId: null, viewEra: 'stone' } }));
  await enterScene(page);
  await page.evaluate(() => window.__advance(3 * 60000 + 1000));
  await page.waitForTimeout(600);
  let s = await state(page);
  const done = await page.evaluate(() => ({
    status: document.getElementById('plaque-status').textContent,
    choices: [...document.querySelectorAll('#plaque-choices [data-action]')].map((b) => b.dataset.action),
    theme: document.body.dataset.theme,
    aria: document.getElementById('scene-canvas').getAttribute('aria-label'),
    current: document.querySelector('.node.is-current')?.dataset.node
  }));
  ok('13 快进结算完成态', s.run.status === 'done' && s.progress.completedRounds === 1 && done.status === '— 本轮完成 —' && done.choices.includes('start-break') && done.choices.includes('start-next'));
  ok('13b 解锁切换 tang 主题', done.theme === 'tang' && done.aria.includes('盛唐') && done.current === 'tang', JSON.stringify(done));
  await page.waitForSelector('#unlock-dialog[open]', { timeout: 5000 });
  const rows = await page.evaluate(() => [...document.getElementById('unlock-rows').children].map((li) => li.textContent));
  ok('14 解锁卡三行真实内容', rows.length === 3 && rows[1].includes('极光天幕') && rows[2].includes('田园流水'), rows.join('|'));
  await page.click('[data-action="close-unlock"]');
  await page.waitForFunction(() => !document.getElementById('fx-canvas').classList.contains('is-active'), null, { timeout: 5000 });
  await page.click('[data-action="start-break"]');
  ok('15 休息 02:00 休息中', (await page.textContent('#plaque-count')) === '02:00' && (await page.textContent('#plaque-status')) === '— 休息中 —');
  await page.evaluate(() => window.__advance(2 * 60000 + 1000));
  await page.waitForTimeout(600);
  s = await state(page);
  ok('15b 休息结束回待开始轮数不增', s.run.status === 'idle' && s.progress.completedRounds === 1);
  await page.click('.node[data-node="stone"]');
  await page.waitForTimeout(900);
  ok('16 节点回看石器', (await page.evaluate(() => document.getElementById('scene-canvas').getAttribute('aria-label'))).includes('石器'));
  await page.close();
}

/* ---------- 非解锁轮 / 刷新不重复 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 50, lastSettledRoundId: 'old', viewEra: 'tang' } }));
  await enterScene(page);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(600);
  const s = await state(page);
  ok('17 非解锁轮不弹卡', s.progress.completedRounds === 3 && s.run.completion.unlockedEra === null && (await page.locator('#unlock-dialog[open]').count()) === 0);
  await page.reload();
  await waitForHomeReady(page);
  await enterScene(page);
  ok('18 刷新后不重复弹卡', (await page.locator('#unlock-dialog[open]').count()) === 0 && (await page.textContent('#plaque-status')) === '— 本轮完成 —', await page.textContent('#plaque-status'));
  await page.close();
}

/* ---------- 刷新恢复 / 旧档 ---------- */
{
  const page = await newPage(browser, baseSeed());
  await enterScene(page);
  const rid = (await state(page)).run.roundId;
  await page.reload();
  await waitForHomeReady(page);
  ok('19 运行中刷新回首页', (await page.evaluate(() => document.body.dataset.view)) === 'home');
  await enterScene(page);
  ok('19b 恢复同一 running 轮', (await state(page)).run.roundId === rid && (await state(page)).run.status === 'running', JSON.stringify((await state(page)).run));
  await page.click('[data-action="pause"]');
  const digits = await page.textContent('#plaque-count');
  await page.reload();
  await waitForHomeReady(page);
  await enterScene(page);
  ok('20 暂停刷新保持 paused 与数字', (await state(page)).run.status === 'paused' && (await page.textContent('#plaque-count')) === digits, `${(await state(page)).run.status} ${await page.textContent('#plaque-count')} vs ${digits}`);
  await page.close();

  const legacySeed = baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 25, viewEra: 'tang' } });
  delete legacySeed.settings;
  delete legacySeed.progress.legacyEraFloor; // 真正的旧档才允许从轮数迁移开放资格。
  const legacy = await newPage(browser, legacySeed);
  await legacy.click('#settings-btn');
  const legacyVals = await legacy.evaluate(() => ({
    focus: document.getElementById('focus-minutes').value,
    break: document.getElementById('break-minutes').value,
    rounds: JSON.parse(localStorage.getItem('wmf:v1:formal')).progress.completedRounds
  }));
  ok('21 旧档无 settings 按默认', legacyVals.focus === '25' && legacyVals.break === '5' && legacyVals.rounds === 1, JSON.stringify(legacyVals));
  await legacy.close();
}

/* ---------- 声音 ---------- */
{
  const page = await newPage(browser, baseSeed());
  ok('22 首屏无音频请求', (await audioFetches(page)).length === 0);
  await page.click('#settings-btn');
  const off = await page.evaluate(() => ({
    checked: document.getElementById('sound-enabled').checked,
    radios: [...document.querySelectorAll('#sound-list input')].map((i) => i.value),
    disabled: document.getElementById('sound-volume').disabled
  }));
  ok('22b 默认关闭且自动+forest+space', off.checked === false && off.radios.join(',') === ',forest,space' && off.disabled === true, JSON.stringify(off));
  await page.close();

  const fresh = await newPage(browser, baseSeed(), { audioSeed: false });
  await fresh.waitForTimeout(800);
  const freshBoot = await fresh.evaluate(() => ({
    enabled: JSON.parse(localStorage.getItem('wmf:v1:audio')).enabled,
    label: document.getElementById('home-sound-btn').getAttribute('aria-label'),
    blocked: document.getElementById('home-sound-btn').classList.contains('is-blocked'),
    fetches: performance.getEntriesByType('resource').filter((r) => /\.(ogg|m4a)$/.test(r.name)).length
  }));
  ok('22c 首次默认开启且被拒时首页可见状态', freshBoot.enabled === true && freshBoot.blocked && freshBoot.label.includes('再次尝试') && freshBoot.fetches === 0, JSON.stringify(freshBoot));
  const fc = await dialCenter(fresh);
  await fresh.mouse.click(fc.x, fc.y);
  await waitForHomeNear(fresh);
  await fresh.waitForTimeout(900);
  ok('22c1 点击时钟留在首页也恢复太空音', (await audioFetches(fresh)).includes('space.ogg') && (await state(fresh)).run.status === 'idle');
  await browseScene(fresh);
  await fresh.waitForTimeout(900);
  ok('22c2 任意点击自动开始播放', (await fresh.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音' && (await audioFetches(fresh)).includes('forest.ogg'), JSON.stringify(await audioFetches(fresh)));
  await fresh.close();

  const offHome = await newPage(browser, baseSeed());
  await offHome.click('#home-sound-btn');
  await offHome.waitForTimeout(900);
  ok('22d 首页声音按钮一键开启', (await prefs(offHome)).enabled === true && (await audioFetches(offHome)).includes('space.ogg') && (await offHome.evaluate(() => document.getElementById('home-sound-btn').getAttribute('aria-label'))) === '静音');
  await offHome.close();

  const page23 = await newPage(browser, baseSeed());
  await page23.click('#settings-btn');
  await page23.evaluate(() => document.getElementById('sound-enabled').focus());
  await page23.keyboard.press('Space');
  await page23.waitForTimeout(900);
  ok('23 首页手势开启默认太空并 playing', (await audioFetches(page23)).includes('space.ogg') && (await page23.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音');
  await page23.click('#sound-mute');
  ok('24 静音状态', (await prefs(page23)).muted === true && (await page23.textContent('#sound-status')) === '已静音。');
  await page23.evaluate(() => {
    const v = document.getElementById('sound-volume');
    v.value = '30';
    v.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ok('25 拖音量取消静音并保存', (await prefs(page23)).muted === false && (await prefs(page23)).volume === 0.3);
  await page23.keyboard.press('Escape');
  await page23.reload();
  await waitForHomeReady(page23);
  await page23.waitForTimeout(800);
  ok('26 刷新自动尝试播放被拒时无请求且可见', (await audioFetches(page23)).length === 0 && (await page23.evaluate(() => document.getElementById('home-sound-btn').getAttribute('aria-label'))).includes('再次尝试'), JSON.stringify(await audioFetches(page23)));
  await enterScene(page23);
  await page23.waitForTimeout(900);
  ok('26b 任意手势自动恢复并随时代切换', (await audioFetches(page23)).includes('forest.ogg') && (await page23.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音');
  await page23.click('[data-action="back-home"]');
  await page23.waitForTimeout(1600);
  await page23.click('#home-sound-btn');
  ok('26c 首页按钮一键静音', (await prefs(page23)).muted === true && (await page23.evaluate(() => document.getElementById('home-sound-btn').getAttribute('aria-label'))) === '取消静音');
  await page23.click('#home-sound-btn');
  await page23.waitForTimeout(300);
  ok('26c2 再点取消静音', (await prefs(page23)).muted === false && (await page23.evaluate(() => document.getElementById('home-sound-btn').getAttribute('aria-label'))) === '静音');
  await page23.close();

  const blockInit = `window.__block = true; (() => { const AC = window.AudioContext || window.webkitAudioContext; const orig = AC.prototype.resume; AC.prototype.resume = function () { if (window.__block) return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })); return orig.call(this); }; })();`;
  const blockSeed = `localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: true, muted: false, volume: 0.6, ambienceId: 'space', followDefault: true })); ${blockInit}`;
  const bp = await newPage(browser, baseSeed(), { extraInit: blockSeed });
  await bp.waitForTimeout(700);
  const bpBoot = await bp.evaluate(() => ({
    label: document.getElementById('home-sound-btn').getAttribute('aria-label'),
    blocked: document.getElementById('home-sound-btn').classList.contains('is-blocked'),
    fetches: performance.getEntriesByType('resource').filter((r) => /\.(ogg|m4a)$/.test(r.name)).length
  }));
  ok('26d 自动播放被拒时首页可见状态且无请求', bpBoot.fetches === 0 && bpBoot.blocked && bpBoot.label.includes('再次尝试'), JSON.stringify(bpBoot));
  await bp.evaluate(() => { window.__block = false; });
  const bc = await dialCenter(bp);
  await bp.mouse.click(bc.x, bc.y);
  await waitForHomeNear(bp);
  await bp.waitForTimeout(900);
  ok('26d1 点击时钟在首页恢复播放不开始计时', (await audioFetches(bp)).includes('space.ogg') && (await state(bp)).run.status === 'idle');
  await browseScene(bp);
  await bp.waitForTimeout(900);
  ok('26d2 任意点击自动恢复不碰声音控件', (await bp.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音' && (await audioFetches(bp)).includes('forest.ogg'), JSON.stringify(await audioFetches(bp)));
  await bp.close();

  const kp = await newPage(browser, baseSeed(), { extraInit: blockSeed });
  await kp.waitForTimeout(700);
  await kp.evaluate(() => { window.__block = false; });
  await kp.keyboard.press('Tab');
  await kp.waitForTimeout(900);
  ok('26e 键盘手势自动恢复', (await kp.evaluate(() => document.getElementById('home-sound-btn').getAttribute('aria-label'))) === '静音' && (await audioFetches(kp)).includes('space.ogg'));
  await kp.close();
}

/* ---------- 声音：解锁列表 / 切换 / 提示音 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' } }));
  await page.click('#settings-btn');
  const list = await page.evaluate(() => [...document.querySelectorAll('#sound-list input')].map((i) => i.value));
  ok('27 累计 75 分钟列出自动+forest+field+space', list.join(',') === ',forest,field,space', list.join(','));
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const r = document.querySelector('#sound-list input[value="field"]');
    r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  ok('28 切换交叉淡化请求 field', (await audioFetches(page)).includes('field.ogg') && (await prefs(page)).ambienceId === 'field');
  await page.keyboard.press('Escape');
  await enterScene(page);
  const oscBefore = await page.evaluate(() => window.__osc);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(700);
  ok('29 完成提示音遵守设置（playing 响）', (await page.evaluate(() => window.__osc)) === oscBefore + 2);
  await page.waitForSelector('#unlock-dialog[open]', { timeout: 5000 });
  await page.click('[data-action="close-unlock"]');
  await page.waitForFunction(() => !document.getElementById('fx-canvas').classList.contains('is-active'), null, { timeout: 5000 });
  await page.click('[data-action="start-next"]');
  await page.click('#sound-btn');
  const oscMuted = await page.evaluate(() => window.__osc);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(700);
  const oscAfterMuted = await page.evaluate(() => window.__osc);
  const roundsAfterMuted = (await state(page)).progress.completedRounds;
  ok('29b 静音轮不响', oscAfterMuted === oscMuted && roundsAfterMuted === 3, `osc ${oscMuted}->${oscAfterMuted}, rounds ${roundsAfterMuted}`);
  await page.close();
}

/* ---------- 声音：自动播放拒绝 ---------- */
{
  const page = await newPage(browser, baseSeed());
  await page.evaluate(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    window.__origResume = AC.prototype.resume;
    AC.prototype.resume = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  });
  await page.click('#settings-btn');
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  const blocked = await page.evaluate(() => ({
    status: document.getElementById('sound-status').textContent,
    retry: !document.getElementById('sound-retry').hidden,
    label: document.getElementById('sound-btn').getAttribute('aria-label')
  }));
  ok('30 拒绝播放可见重试', blocked.retry && blocked.status.includes('阻止') && blocked.label.includes('再次尝试'), JSON.stringify(blocked));
  await page.evaluate(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    AC.prototype.resume = window.__origResume;
  });
  await page.click('#sound-retry');
  await page.waitForTimeout(900);
  ok('30b 重试恢复 playing', (await page.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音');
  await page.close();
}

/* ---------- 图鉴面板 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 3, focusMinutes: 100, lastSettledRoundId: 'x', viewEra: 'steam' } }));
  await enterScene(page);
  await page.click('#codex-panel-btn');
  await page.waitForSelector('#codex-panel-dialog[open]');
  await page.waitForTimeout(500);
  const panel = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.codex-tab')].map((t) => t.textContent),
    cards: [...document.querySelectorAll('.codex-card h3')].map((h) => h.textContent),
    slices: [...document.querySelectorAll('.codex-card img')].map((i) => [i.naturalWidth, i.naturalHeight])
  }));
  ok('31 面板三标签九卡切片真实', panel.tabs.length === 3 && panel.cards.length === 3 && panel.slices.every(([w, h]) => w === 240 && h === 160), JSON.stringify(panel));
  await page.click('.codex-tab[data-era="stone"]');
  const stone = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('.codex-card h3')].map((h) => h.textContent),
    sel: [...document.querySelectorAll('.codex-tab')].map((t) => t.getAttribute('aria-selected'))
  }));
  ok('32 标签切换', stone.cards.join(',') === '打制石器,篝火,兽皮帐篷' && stone.sel.join(',') === 'true,false,false');
  await page.keyboard.press('Escape');
  ok('34 面板 Esc 焦点回工具按钮', await page.evaluate(() => document.activeElement?.id === 'codex-panel-btn'));
  const hs = await page.evaluate(() => {
    document.querySelector('[data-hotspot="engine"]').click();
    const img = document.getElementById('codex-slice');
    return { title: document.getElementById('codex-title').textContent, src: img.src.slice(0, 14) };
  });
  await page.waitForTimeout(400);
  const dims = await page.evaluate(() => {
    const i = document.getElementById('codex-slice');
    return [i.naturalWidth, i.naturalHeight];
  });
  ok('33 工业热点切片', hs.title === '蒸汽机' && hs.src === 'data:image/png' && dims[0] === 240 && dims[1] === 160);
  ok('34b 控制台无错误', page.errors.length === 0, page.errors.join('|'));
  await page.close();
}

/* ---------- 背景 ---------- */
{
  for (const [era, rounds, id] of [['stone', 0, 'galaxy'], ['tang', 1, 'aurora'], ['steam', 2, 'nebula']]) {
    const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: rounds, focusMinutes: rounds * 50, lastSettledRoundId: 'x', viewEra: era } }));
    await page.waitForTimeout(600);
    const sum = () => page.evaluate(() => {
      const c = document.getElementById('bg-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) >>> 0;
      return h;
    });
    const a = await sum();
    await page.waitForTimeout(800);
    const b = await sum();
    ok(`35 ${era} 背景静态`, a === b && a !== 0);
    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(500);
    const c2 = await sum();
    ok(`36 ${era} 尺寸变化重绘无横滚`, c2 !== b && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)));
    await page.close();
  }
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 100, lastSettledRoundId: 'x', viewEra: 'steam' } }), { reduced: true });
  await enterScene(page);
  const shot2 = await page.evaluate(() => document.getElementById('scene-canvas').toDataURL());
  await page.waitForTimeout(700);
  const shot1b = await page.evaluate(() => document.getElementById('scene-canvas').toDataURL());
  ok('37 减少动态场景静止', shot2 === shot1b && shot2.length > 10000);
  await page.close();
}

/* ---------- 工业链路 / 门禁 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 100, lastSettledRoundId: 'x', viewEra: 'steam' } }));
  const gate = await page.evaluate(() => ({
    theme: document.body.dataset.theme,
    clock: document.getElementById('clock').className
  }));
  await enterScene(page);
  const steamLocked = await page.evaluate(() => document.querySelector('.node[data-node="steam"]').disabled);
  ok('38 工业主题与时钟字体', gate.theme === 'steam' && gate.clock.includes('clock--industrial') && steamLocked === false, JSON.stringify(gate));
  ok('38b 工业场景 aria', (await page.evaluate(() => document.getElementById('scene-canvas').getAttribute('aria-label'))).includes('蒸汽'));
  const hotspots = await page.evaluate(() => [...document.querySelectorAll('[data-hotspot]')].map((h) => h.dataset.hotspot));
  ok('40 工业三热点', hotspots.join(',') === 'engine,loom,rail', hotspots.join(','));
  await page.close();

  const locked = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 0, focusMinutes: 0, lastSettledRoundId: null, viewEra: 'steam' } }));
  const g = await locked.evaluate(() => ({ theme: document.body.dataset.theme }));
  await enterScene(locked);
  const tags = await locked.evaluate(() => ({
    steam: document.querySelector('.node[data-node="steam"]').disabled,
    steamTag: document.querySelector('.node[data-node="steam"] .node-tag')?.textContent,
    tangTag: document.querySelector('.node[data-node="tang"] .node-tag')?.textContent
  }));
  ok('39 0 分钟门禁与 viewEra 回退', g.theme === 'stone' && tags.steam === true && /100.*分钟/.test(tags.steamTag) && /50.*分钟/.test(tags.tangTag) && !/轮/.test(tags.steamTag + tags.tangTag), JSON.stringify(tags));
  await locked.close();
}

/* ---------- 素材失败降级 ---------- */
{
  const page = await newPage(browser, baseSeed(), { route: { pattern: '**/*.png', handler: (r) => r.abort() } });
  await enterScene(page);
  const varied = await page.evaluate(() => {
    const c = document.getElementById('scene-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4001) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return seen.size;
  });
  ok('41 底图失败回退程序化不黑屏', varied > 20, String(varied));
  ok('41b 降级不阻断计时', (await state(page)).run.status === 'running');
  const realErrors = page.errors.filter((e) => !e.includes('Failed to load resource'));
  ok('41c 降级无页面异常', realErrors.length === 0, realErrors.join('|'));
  await page.close();
}

/* ---------- 性能 ---------- */
{
  const page = await newPage(browser, baseSeed());
  await page.evaluate(() => {
    window.__longtasks = 0;
    new PerformanceObserver((list) => { window.__longtasks += list.getEntries().length; }).observe({ entryTypes: ['longtask'] });
    window.__gaps = [];
    let last = performance.now();
    const loop = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await enterScene(page);
  await page.waitForTimeout(4000);
  const perf = await page.evaluate(() => {
    const g = window.__gaps.slice(30).sort((a, b) => a - b);
    return { longtasks: window.__longtasks, p95: g[Math.floor(g.length * 0.95)] || 0, n: g.length };
  });
  ok('43 无长任务且帧间隔 p95<45ms', perf.longtasks === 0 && perf.p95 < 45, JSON.stringify(perf));
  await page.close();

  const sizeOf = (dir) => {
    let total = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      total += e.isDirectory() ? sizeOf(p) : fs.statSync(p).size;
    }
    return total;
  };
  const scenes = sizeOf('src/assets/scenes');
  const audioDir = 'src/assets/audio';
  const files = fs.readdirSync(audioDir);
  const p0 = fs.statSync(path.join(audioDir, 'forest.ogg')).size + fs.statSync(path.join(audioDir, 'forest.m4a')).size;
  const maxFile = Math.max(...files.map((f) => fs.statSync(path.join(audioDir, f)).size));
  ok('44 资源预算 场景≤4MB P0≤1.5MB 单音频≤500KB', scenes <= 4 * 1024 * 1024 && p0 <= 1.5 * 1024 * 1024 && maxFile <= 500 * 1024, `scenes=${scenes} p0=${p0} max=${maxFile}`);
  // 仅为新增的约 1MB GLB 与 48KB logo 单列增量，不放宽旧资源或帧性能预算。
  const model = fs.statSync(path.resolve('src/assets/models/terratock-clock.glb')).size;
  const logo = fs.statSync(path.resolve('src/assets/brand/terratock-logo.webp')).size;
  ok('44b 宇宙时钟增量预算 模型≤1.05MB logo≤48KB', model > 0 && model <= 1.05 * 1024 * 1024 && logo > 0 && logo <= 48 * 1024, `model=${model} logo=${logo} added=${model + logo}`);
  // 实测新版目录 20 个地点共 26,527,880 B，最大 information 为 2,578,744 B。
  // 独立固定增量上限，不把新模型并入或放宽旧像素场景/时钟/音频预算。
  const catalogSizes = Object.values(SCENES).map(({ file }) => fs.statSync(new globalThis.URL(`../src/assets/models/${file}`, import.meta.url)).size);
  const catalogTotal = catalogSizes.reduce((sum, size) => sum + size, 0);
  const catalogMax = Math.max(...catalogSizes);
  ok('44c 地点 GLB 增量预算 合计≤25.3MB 单文件≤2.46MB', catalogSizes.length === 20 && catalogSizes.every((size) => size > 0) && catalogTotal <= 25.3 * 1024 * 1024 && catalogMax <= 2.46 * 1024 * 1024, `catalog=${catalogTotal} max=${catalogMax}`);
}

/* ---------- 移动端 ---------- */
for (const [w, h] of [[320, 568], [390, 844]]) {
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 3, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' } }), { viewport: { width: w, height: h } });
  const home = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await enterScene(page);
  const rects = await page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const ov = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const tools = r('.scene-tools'); const plaque = r('#plaque'); const bottom = r('.scene-bottom');
    return { overlap: ov(tools, plaque) || ov(tools, bottom), inVp: tools.l >= 0 && tools.t >= 0 && tools.r <= window.innerWidth && tools.b <= window.innerHeight };
  });
  ok(`46 ${w}px 工具区不重叠且在视口内`, home && !rects.overlap && rects.inVp, JSON.stringify(rects));
  await page.click('#codex-panel-btn');
  await page.waitForSelector('#codex-panel-dialog[open]');
  const cols = await page.evaluate(() => getComputedStyle(document.getElementById('codex-cards')).gridTemplateColumns.split(' ').length);
  ok(`47 ${w}px 图鉴单列`, cols === 1, String(cols));
  await page.close();
}

/* ---------- 键盘 ---------- */
{
  const page = await newPage(browser, baseSeed());
  await page.focus('#dial-canvas');
  await page.keyboard.press('Enter');
  await waitForHomeNear(page);
  ok('50a 时钟键盘 Enter 只近看不开始', (await state(page)).run.status === 'idle' && (await state(page)).run.roundId === null);
  await page.focus('#dial-view-btn');
  await page.keyboard.press('Enter');
  await page.waitForSelector('body[data-view="home"][data-dial="far"]');
  await page.focus('#dial-canvas');
  await page.keyboard.press('Space');
  await waitForHomeNear(page);
  ok('50b 时钟键盘 Space 只近看且文明入口独立', (await state(page)).run.status === 'idle' && (await page.locator('#civilization-entry').isVisible()));
  await page.focus('#civilization-entry');
  await page.keyboard.press('Enter');
  await page.waitForSelector('body[data-view="scene"]');
  await browseScene(page);
  ok('50 文明入口键盘 Enter 仅浏览不开始', (await state(page)).run.status === 'idle' && (await page.textContent('#plaque-status')) === '— 待开始 —');
  await page.click('[data-action="start"]');
  await page.click('[data-action="reset"]');
  await page.keyboard.press('Escape');
  ok('51 确认弹窗 Esc 关闭', (await page.locator('#confirm-dialog[open]').count()) === 0);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1400);
  await page.click('#settings-btn');
  await page.fill('#focus-minutes', '');
  await page.click('#settings-form button[type="submit"]');
  ok('52 错误聚焦输入框', await page.evaluate(() => document.activeElement?.id === 'focus-minutes'));
  await page.close();
}

/* ---------- V0.5 M1：音频意图 / 计时转场边界 / 保存反馈 / 全景 ---------- */
const M1_AUDIO = path.resolve('src/assets/audio');
const M1_BYTES = {
  forest: fs.statSync(path.join(M1_AUDIO, 'forest.ogg')).size,
  field: fs.statSync(path.join(M1_AUDIO, 'field.ogg')).size,
  steam: fs.statSync(path.join(M1_AUDIO, 'steam.ogg')).size,
  space: fs.statSync(path.join(M1_AUDIO, 'space.ogg')).size
};
const m1Pin = (id) => `localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: '${id}', followDefault: false }));`;
const m1IdOf = (b) => Object.keys(M1_BYTES).find((k) => M1_BYTES[k] === b) || null;
const m1OnlyFetch = (fn) => (r) => (r.request().resourceType() === 'fetch' ? fn(r) : r.continue());
const m1Delay = (ms) => m1OnlyFetch((r) => new Promise((res) => setTimeout(() => res(r.continue()), ms)));
const m1Status = (page) => page.evaluate(() => document.getElementById('sound-status').textContent);
const m1SrcLog = (page) => page.evaluate(() => window.__srcLog);
async function m1ToggleEnabled(page) {
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
}
async function m1Pick(page, id) {
  await page.evaluate((v) => {
    const r = document.querySelector(`#sound-list input[value="${v}"]`);
    r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  }, id);
}
const m1Running = (ms) => ({ mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + ms, remainingMs: null, roundId: 'm1-' + ms, completion: null });

{
  const page = await newPage(browser, baseSeed(), { routes: [{ pattern: '**/forest*', handler: m1Delay(1200) }], extraInit: m1Pin('forest') });
  await page.click('#settings-btn');
  await m1ToggleEnabled(page);
  await page.waitForTimeout(150);
  await page.evaluate(() => { window.__markDisable = performance.now(); });
  await m1ToggleEnabled(page);
  await page.waitForTimeout(1800);
  const sl = await m1SrcLog(page);
  const markDisable = await page.evaluate(() => window.__markDisable);
  const late = sl.some((s) => s.at > markDisable);
  ok('53 慢加载期间关闭后保持关闭', (await prefs(page)).enabled === false && !late && !(await m1Status(page)).includes('正在播放'), `late=${late} status=${await m1Status(page)}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 100, lastSettledRoundId: 'x', viewEra: 'steam' } }), {
    routes: [
      { pattern: '**/forest*', handler: m1Delay(1200) },
      { pattern: '**/field*', handler: m1Delay(500) },
      { pattern: '**/steam*', handler: m1Delay(800) }
    ],
    extraInit: m1Pin('steam')
  });
  await page.click('#settings-btn');
  await m1ToggleEnabled(page);
  await page.waitForTimeout(100);
  await m1Pick(page, 'field');
  await page.waitForTimeout(100);
  await m1Pick(page, 'steam');
  await page.waitForTimeout(2200);
  const sl = await m1SrcLog(page);
  const checked = await page.evaluate(() => [...document.querySelectorAll('#sound-list input')].filter((i) => i.checked).map((i) => i.value));
  ok('54 连续切换只播放最终选择', (await prefs(page)).ambienceId === 'steam' && checked.join(',') === 'steam' && sl.length === 1 && m1IdOf(sl[0].bytes) === 'steam' && (await m1Status(page)).includes('正在播放'), `starts=${sl.map((s) => m1IdOf(s.bytes)).join(',')} checked=${checked}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 100, lastSettledRoundId: 'x', viewEra: 'steam' } }), {
    routes: [{ pattern: '**/steam*', handler: m1OnlyFetch((r) => new Promise((res) => setTimeout(() => res(r.abort()), 2500))) }],
    extraInit: m1Pin('steam')
  });
  await page.click('#settings-btn');
  await m1ToggleEnabled(page);
  await page.waitForTimeout(700);
  await m1Pick(page, 'steam');
  await page.waitForTimeout(300);
  await m1Pick(page, 'field');
  await page.waitForTimeout(900);
  const before = await m1Status(page);
  await page.waitForTimeout(2200);
  const after = await m1Status(page);
  ok('55 过期失败不覆盖新播放', before.includes('正在播放') && after.includes('正在播放'), `before=${before} after=${after}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed(), { routes: [{ pattern: '**/forest*', handler: m1Delay(1200) }], extraInit: m1Pin('forest') });
  await page.click('#settings-btn');
  await m1ToggleEnabled(page);
  await page.waitForTimeout(200);
  await page.click('#sound-mute');
  await page.waitForTimeout(1800);
  const mute = await page.evaluate(() => document.getElementById('sound-mute').getAttribute('aria-pressed'));
  ok('56 加载期间静音生效', mute === 'true' && (await m1Status(page)).includes('静音'), `mute=${mute} status=${await m1Status(page)}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ run: m1Running(6000) }));
  await enterScene(page);
  await page.evaluate(() => {
    window.__advance(3600);
    document.querySelector('[data-action="pause"]').click();
  });
  const st = await state(page);
  ok('57 到期瞬间暂停优先结算', st.run.status === 'done' && st.progress.completedRounds === 1, `status=${st.run.status} rounds=${st.progress.completedRounds}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' }, run: m1Running(6500) }));
  await enterScene(page);
  await page.click('[data-action="back-home"]');
  await page.evaluate(() => window.__advance(3300));
  await page.waitForTimeout(2600);
  const snap = await page.evaluate(() => ({
    view: document.body.dataset.view,
    theme: document.body.dataset.theme,
    unlock: !!document.querySelector('#unlock-dialog[open]'),
    zooming: document.body.classList.contains('is-zooming')
  }));
  await enterScene(page);
  const re = await page.evaluate(() => ({
    view: document.body.dataset.view,
    theme: document.body.dataset.theme,
    unlock: !!document.querySelector('#unlock-dialog[open]'),
    rounds: JSON.parse(localStorage.getItem('wmf:v1:formal')).progress.completedRounds
  }));
  ok('58 返回首页转场中到期不竞态', snap.view === 'home' && !snap.unlock && !snap.zooming && re.view === 'scene' && re.theme === 'steam' && re.unlock && re.rounds === 2, JSON.stringify({ snap, re }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' }, run: m1Running(6500) }));
  await enterScene(page);
  await page.click('[data-node="stone"]');
  await page.evaluate(() => window.__advance(3300));
  await page.waitForTimeout(2600);
  const snap = await page.evaluate(() => ({
    view: document.body.dataset.view,
    theme: document.body.dataset.theme,
    unlock: !!document.querySelector('#unlock-dialog[open]'),
    spots: [...document.querySelectorAll('.hotspot')].map((h) => h.dataset.hotspot).join(',')
  }));
  ok('59 回看转场中解锁以结算为准', snap.view === 'scene' && snap.theme === 'steam' && snap.unlock && snap.spots === 'engine,loom,rail', JSON.stringify(snap));
  await page.close();
}

for (const [w, h, era, rounds] of [[390, 844, 'stone', 0], [320, 568, 'steam', 2]]) {
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: rounds, focusMinutes: rounds * 50, lastSettledRoundId: 'x', viewEra: era } }), { viewport: { width: w, height: h } });
  await enterScene(page);
  const runBefore = await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('wmf:v1:formal')).run;
    return { deadline: r.deadline, status: r.status, roundId: r.roundId };
  });
  await page.click('#fit-btn');
  await page.waitForTimeout(400);
  const pano = await page.evaluate(() => {
    const vp = { w: window.innerWidth, h: window.innerHeight };
    const pb = document.getElementById('plaque').getBoundingClientRect();
    const bb = document.querySelector('.scene-bottom').getBoundingClientRect();
    const hs = [...document.querySelectorAll('.hotspot')].map((el) => {
      const b = el.getBoundingClientRect();
      return { id: el.dataset.hotspot, l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
    });
    return {
      vp,
      plaqueBottom: pb.bottom,
      bottomTop: bb.top,
      hs,
      fit: document.body.dataset.fit,
      pressed: document.getElementById('fit-btn').getAttribute('aria-pressed')
    };
  });
  const inVp = pano.hs.every((x) => x.l >= 0 && x.t >= 0 && x.r <= pano.vp.w && x.b <= pano.vp.h);
  const noHud = pano.hs.every((x) => x.t >= pano.plaqueBottom && x.b <= pano.bottomTop);
  const hit = pano.hs.every((x) => x.w >= 44 && x.h >= 44);
  ok(`60 ${w}px ${era} 全景热点完整可达`, pano.fit === 'panorama' && pano.pressed === 'true' && pano.hs.length === 3 && inVp && noHud && hit, JSON.stringify(pano));
  await page.evaluate(() => document.querySelector('.hotspot').click());
  await page.waitForSelector('#codex-dialog[open]');
  const codexTitle = await page.evaluate(() => document.getElementById('codex-title').textContent);
  await page.keyboard.press('Escape');
  ok(`61 ${w}px ${era} 全景热点打开图鉴`, codexTitle.length > 0, codexTitle);
  const runAfter = await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('wmf:v1:formal')).run;
    return { deadline: r.deadline, status: r.status, roundId: r.roundId };
  });
  const eraAfter = await page.evaluate(() => document.body.dataset.theme);
  ok(`62 ${w}px 全景切换不改计时与时代`, runAfter.deadline === runBefore.deadline && runAfter.status === runBefore.status && runAfter.roundId === runBefore.roundId && eraAfter === era, `${JSON.stringify(runBefore)}->${JSON.stringify(runAfter)} ${era}->${eraAfter}`);
  await page.setViewportSize({ width: h, height: w });
  await page.waitForTimeout(400);
  const rotated = await page.evaluate(() => {
    const vp = { w: window.innerWidth, h: window.innerHeight };
    return [...document.querySelectorAll('.hotspot')].every((el) => {
      const b = el.getBoundingClientRect();
      return b.left >= 0 && b.top >= 0 && b.right <= vp.w && b.bottom <= vp.h;
    });
  });
  ok(`63 ${w}px 横竖切换后热点不漂移`, rotated);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  await page.click('#fit-btn');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => document.body.dataset.fit);
  ok(`64 ${w}px 可切回沉浸`, back === 'immersive', back);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed(), {
    extraInit: `const os = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'wmf:v1:formal') throw new Error('quota'); return os.call(this, k, v); };`
  });
  await enterScene(page);
  const notice = await page.evaluate(() => ({
    hidden: document.getElementById('storage-notice').hidden,
    text: document.getElementById('storage-notice-text').textContent
  }));
  ok('65 进度保存失败可见提示', !notice.hidden && notice.text.includes('无法保存进度'), JSON.stringify(notice));
  await page.click('[data-action="dismiss-storage"]');
  const dismissed = await page.evaluate(() => document.getElementById('storage-notice').hidden);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1600);
  await page.click('#settings-btn');
  const status = await page.evaluate(() => ({
    hidden: document.getElementById('storage-status').hidden,
    text: document.getElementById('storage-status').textContent
  }));
  ok('66 提示可关闭且设置仍可见状态', dismissed && !status.hidden && status.text.includes('存储状态'), JSON.stringify(status));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed(), {
    extraInit: `Storage.prototype.setItem = function () { throw new Error('quota'); };`
  });
  const notice = await page.evaluate(() => ({
    hidden: document.getElementById('storage-notice').hidden,
    text: document.getElementById('storage-notice-text').textContent
  }));
  ok('67 存储不可用启动即提示', !notice.hidden && notice.text.includes('存储不可用'), JSON.stringify(notice));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ run: m1Running(6000) }));
  await enterScene(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__advance(3600);
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    document.querySelector('[data-action="pause"]')?.click();
  });
  const st = await state(page);
  ok('68 隐藏期间到期返回即结算且可操作', st.run.status === 'done' && st.progress.completedRounds === 1, `status=${st.run.status} rounds=${st.progress.completedRounds}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' }, run: m1Running(6500) }));
  await enterScene(page);
  await page.evaluate(() => window.__advance(4000));
  await page.waitForSelector('#unlock-dialog[open]');
  const before = await state(page);
  await page.reload();
  await waitForHomeReady(page);
  const after = await state(page);
  await enterScene(page);
  const post = await page.evaluate(() => ({
    unlock: !!document.querySelector('#unlock-dialog[open]'),
    choices: !document.getElementById('plaque-choices').hidden,
    rounds: JSON.parse(localStorage.getItem('wmf:v1:formal')).progress.completedRounds
  }));
  ok('69 解锁提示打开时刷新不重复结算', before.progress.completedRounds === 2 && after.progress.completedRounds === 2 && after.run.status === 'done' && !post.unlock && post.choices && post.rounds === 2, JSON.stringify({ before: before.progress.completedRounds, after: after.progress.completedRounds, post }));
  await page.close();
}

/* ---------- V0.5 M2：演示模式与正式数据隔离 ---------- */
const m1RunningDemo = (ms) => ({ mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + ms, remainingMs: null, roundId: 'm2-' + ms, completion: null });
async function m2CloseUnlock(page) {
  if (await page.locator('#unlock-dialog[open]').count()) {
    await page.click('[data-action="close-unlock"]');
    await page.waitForFunction(() => !document.getElementById('fx-canvas').classList.contains('is-active'), null, { timeout: 5000 });
  }
}
async function m2EnterDemo(page) {
  await page.click('#settings-btn');
  await page.click('#demo-enter-btn');
  if (await page.locator('#demo-confirm-dialog[open]').count()) await page.click('[data-action="demo-confirm"]');
  await page.waitForTimeout(300);
}

{
  const page = await newPage(browser, baseSeed());
  await m2EnterDemo(page);
  const entered = await page.evaluate(() => ({
    demo: document.body.dataset.demo,
    settingsOpen: document.getElementById('settings-dialog').open,
    formHidden: document.getElementById('settings-form').hidden
  }));
  await enterScene(page);
  const count = await page.evaluate(() => document.getElementById('plaque-count').textContent);
  const badge = await page.evaluate(() => !document.getElementById('demo-badge').hidden);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]');
  await m2CloseUnlock(page);
  const st = await state(page);
  const choice = await page.evaluate(() => [...document.querySelectorAll('#plaque-choices .chip-btn')].map((b) => b.textContent).join('|'));
  ok('70 演示入口与 15 秒轮次', entered.demo === 'true' && !entered.settingsOpen && /^00:1[2-5]$/.test(count) && badge && st.progress.completedRounds === 0 && choice.includes('15 秒') && choice.includes('5 秒'), JSON.stringify({ entered, count, badge, rounds: st.progress.completedRounds, choice }));
  await page.click('[data-action="start-next"]');
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]');
  const st2 = await state(page);
  const theme = await page.evaluate(() => document.body.dataset.theme);
  ok('71 两轮演示解锁三时代且不计正式', theme === 'steam' && st2.progress.completedRounds === 0 && st2.progress.focusMinutes === 0, `theme=${theme} formal=${JSON.stringify(st2.progress)}`);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 100, lastSettledRoundId: 'x', viewEra: 'steam' } }));
  await m2EnterDemo(page);
  await enterScene(page);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]');
  await m2CloseUnlock(page);
  await page.click('[data-action="start-next"]');
  await page.click('[data-action="reset"]');
  await page.click('[data-action="confirm-reset"]');
  const st = await state(page);
  const count = await page.evaluate(() => document.getElementById('plaque-count').textContent);
  ok('72 重置演示不删正式进度', st.progress.completedRounds === 2 && st.progress.focusMinutes === 100 && count === '00:15', `formal=${st.progress.completedRounds} count=${count}`);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1600);
  await page.click('#settings-btn');
  await page.click('#demo-exit-btn');
  await page.waitForTimeout(1600);
  await m2EnterDemo(page);
  await enterScene(page);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]');
  const fresh = await page.evaluate(() => document.getElementById('unlock-title').textContent);
  ok('72b 重新进入演示进度归零', fresh.includes('盛唐'), fresh);
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ run: m1RunningDemo(600000) }));
  await page.click('#settings-btn');
  await page.click('#demo-enter-btn');
  await page.waitForSelector('#demo-confirm-dialog[open]');
  await page.click('[data-action="demo-confirm"]');
  await page.waitForTimeout(300);
  const paused = await state(page);
  await enterScene(page);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]');
  await m2CloseUnlock(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1600);
  await page.click('#settings-btn');
  await page.click('#demo-exit-btn');
  await page.waitForTimeout(1800);
  const restored = await state(page);
  const demoOff = await page.evaluate(() => document.body.dataset.demo);
  await enterScene(page);
  await page.click('[data-action="resume"]');
  const resumed = await state(page);
  ok('73 进入暂停正式轮退出可继续', paused.run.status === 'paused' && paused.run.remainingMs > 590000 && restored.run.status === 'paused' && demoOff === 'false' && resumed.run.status === 'running', JSON.stringify({ paused: paused.run.status, remaining: paused.run.remainingMs, restored: restored.run.status, resumed: resumed.run.status }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ run: m1RunningDemo(600000) }));
  await m2EnterDemo(page);
  await enterScene(page);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForTimeout(400);
  await page.reload();
  await waitForHomeReady(page);
  const after = await state(page);
  const uiState = await page.evaluate(() => ({
    demo: document.body.dataset.demo,
    badge: !document.getElementById('demo-badge').hidden,
    formHidden: document.getElementById('settings-form').hidden
  }));
  ok('74 刷新回到正式模式', after.run.status === 'paused' && after.progress.completedRounds === 0 && uiState.demo === 'false' && !uiState.badge && !uiState.formHidden, JSON.stringify({ run: after.run.status, uiState }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed());
  await m2EnterDemo(page);
  await enterScene(page);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]');
  await m2CloseUnlock(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1600);
  await page.click('#settings-btn');
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const r = document.querySelector('#sound-list input[value="field"]');
    r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(600);
  const formalPrefs = await prefs(page);
  const demoChecked = await page.evaluate(() => [...document.querySelectorAll('#sound-list input')].filter((i) => i.checked).map((i) => i.value));
  await page.click('#demo-exit-btn');
  await page.waitForTimeout(800);
  const afterPrefs = await prefs(page);
  const status = await m1Status(page);
  ok('75 演示声音选择不覆盖正式偏好', formalPrefs.enabled === false && formalPrefs.ambienceId === null && demoChecked.join(',') === 'field' && afterPrefs.enabled === false && !status.includes('正在播放'), JSON.stringify({ formalPrefs, demoChecked, afterPrefs, status }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed());
  await m2EnterDemo(page);
  await page.click('#settings-btn');
  const demoSettings = await page.evaluate(() => ({
    formHidden: document.getElementById('settings-form').hidden,
    exitVisible: !document.getElementById('demo-exit-btn').hidden,
    note: document.querySelector('.demo-note').textContent
  }));
  await page.click('#demo-close-btn');
  const closed = await page.evaluate(() => !document.getElementById('settings-dialog').open);
  ok('76 演示中设置标识与关闭', demoSettings.formHidden && demoSettings.exitVisible && demoSettings.note.includes('15 秒') && closed, JSON.stringify(demoSettings));
  await page.close();
}

/* ---------- M3 人物精灵 ---------- */
const crop = (page, x, y, w, h) => page.evaluate(([x, y, w, h]) => {
  const c = document.getElementById('scene-canvas');
  const d = c.getContext('2d').getImageData(x, y, w, h).data;
  let sum = 0;
  let alpha = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) alpha += 1;
    sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000000007;
  }
  return { sum, alpha };
}, [x, y, w, h]);

{
  const page = await newPage(browser, baseSeed());
  await enterScene(page);
  // 目标格绘制验证：idle 行发束亮色 + sit 行石芯色，落在锚点换算后的精确格位
  const cells = await page.evaluate(() => {
    const g = document.getElementById('scene-canvas').getContext('2d');
    const count = (x, y, w, h, r, gg, b) => {
      const d = g.getImageData(x, y, w, h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === gg && d[i + 2] === b && d[i + 3] === 255) n += 1;
      return n;
    };
    return {
      idleHair: count(385, 257, 10, 2, 106, 74, 48),
      sitCore: count(366, 556, 7, 5, 124, 132, 140)
    };
  });
  ok('77 石器图集 idle/sit 目标格按锚点绘制', cells.idleHair > 4 && cells.sitCore > 8, JSON.stringify(cells));
  const idleA = await crop(page, 366, 255, 30, 60);
  const walkA = await crop(page, 380, 395, 260, 60);
  await page.waitForTimeout(600);
  const idleB = await crop(page, 366, 255, 30, 60);
  const walkB = await crop(page, 380, 395, 260, 60);
  ok('78 待机脚点与外观稳定无抖动', idleA.alpha > 0 && idleA.sum === idleB.sum, JSON.stringify({ idleA, idleB }));
  ok('79 行走路线帧动画推进', walkA.alpha > 0 && walkA.sum !== walkB.sum, JSON.stringify({ walkA, walkB }));
  ok('79b 精灵接入无页面错误', page.errors.length === 0, JSON.stringify(page.errors));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 8, focusMinutes: 200, lastSettledRoundId: null, viewEra: 'tang' } }));
  await enterScene(page);
  const px = await crop(page, 325, 440, 60, 70);
  const straw = await page.evaluate(() => {
    const d = document.getElementById('scene-canvas').getContext('2d').getImageData(326, 437, 48, 22).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 240 && d[i + 1] === 212 && d[i + 2] === 138 && d[i + 3] === 255) n += 1;
    return n;
  });
  ok('77b 盛唐人物笠冠目标色绘制且无错误', px.alpha > 0 && straw > 15 && page.errors.length === 0, JSON.stringify({ alpha: px.alpha, straw, errors: page.errors }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 8, focusMinutes: 200, lastSettledRoundId: null, viewEra: 'steam' } }));
  await enterScene(page);
  const px = await crop(page, 318, 450, 48, 60);
  const shirt = await page.evaluate(() => {
    const d = document.getElementById('scene-canvas').getContext('2d').getImageData(318, 450, 48, 60).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 232 && d[i + 1] === 232 && d[i + 2] === 224 && d[i + 3] === 255) n += 1;
    return n;
  });
  ok('77c 蒸汽 operate 点位衬衣目标色绘制且无错误', px.alpha > 0 && shirt > 15 && page.errors.length === 0, JSON.stringify({ alpha: px.alpha, shirt, errors: page.errors }));
  // work 行断言：扳手金属色只可能来自 work 行颚口格位，且帧随时间推进
  const jawCount = () => page.evaluate(() => {
    const d = document.getElementById('scene-canvas').getContext('2d').getImageData(318, 466, 16, 24).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 140 && d[i + 1] === 148 && d[i + 2] === 156 && d[i + 3] === 255) n += 1;
    return n;
  });
  const wA = await crop(page, 318, 450, 48, 60);
  const jA = await jawCount();
  await page.waitForTimeout(260);
  const wB = await crop(page, 318, 450, 48, 60);
  const jB = await jawCount();
  ok('77d 工业 operate 点位读取 work 行并推进', wA.sum !== wB.sum && jA > 3 && jB > 3, JSON.stringify({ changed: wA.sum !== wB.sum, jA, jB }));
  await page.close();
}

{
  // Node 侧解码内联图集：work 行颚口格位含扳手金属色、idle 行同格位不含，证明场景探针色来源为 work 行
  const decodePNG = (buf) => {
    let off = 8;
    let w = 0;
    let h = 0;
    const idat = [];
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString('ascii', off + 4, off + 8);
      const data = buf.subarray(off + 8, off + 8 + len);
      if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
      if (type === 'IDAT') idat.push(data);
      off += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * 4;
    const out = Buffer.alloc(h * stride);
    const paeth = (a, b, c) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    for (let y = 0; y < h; y += 1) {
      const f = raw[y * (stride + 1)];
      for (let x = 0; x < stride; x += 1) {
        const i = y * (stride + 1) + 1 + x;
        const a = x >= 4 ? out[y * stride + x - 4] : 0;
        const b = y > 0 ? out[(y - 1) * stride + x] : 0;
        const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
        let v = raw[i];
        if (f === 1) v += a;
        else if (f === 2) v += b;
        else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) v += paeth(a, b, c);
        out[y * stride + x] = v & 255;
      }
    }
    return { w, h, data: out };
  };
  const zoneCount = (img, ox, oy, r, g, b) => {
    let n = 0;
    for (let y = 20; y < 27; y += 1) {
      for (let x = 40; x < 47; x += 1) {
        const i = ((oy + y) * img.w + ox + x) * 4;
        if (img.data[i] === r && img.data[i + 1] === g && img.data[i + 2] === b && img.data[i + 3] === 255) n += 1;
      }
    }
    return n;
  };
  let workRowProof = null;
  try {
    for (const f of fs.readdirSync('dist/assets').filter((n) => n.endsWith('.js'))) {
      const s = fs.readFileSync(path.join('dist/assets', f), 'utf8');
      for (const m of s.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]{32,})/g)) {
        const buf = Buffer.from(m[1], 'base64');
        if (buf.readUInt32BE(16) !== 192 || buf.readUInt32BE(20) !== 256) continue;
        const img = decodePNG(buf);
        const work = zoneCount(img, 0, 128, 140, 148, 156);
        const idle = zoneCount(img, 0, 0, 140, 148, 156);
        if (work > 5 && idle === 0) workRowProof = { work, idle };
      }
    }
  } catch (e) { workRowProof = { error: String(e) }; }
  ok('77e 图集 work 行颚口格位含扳手色且 idle 行不含', Boolean(workRowProof && workRowProof.work > 5 && workRowProof.idle === 0), JSON.stringify(workRowProof));
}

{
  // 火车遮挡：冻结场景时钟于三档相位——停驶(20s)/驶过站台(31.23s)/驶离(45s)
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 8, focusMinutes: 200, lastSettledRoundId: null, viewEra: 'steam' } }), {
    extraInit: `(() => {
  const base = performance.now();
  const realRaf = window.requestAnimationFrame.bind(window);
  let frozen = null;
  window.__freezeAt = (ms) => { frozen = base + ms; };
  window.requestAnimationFrame = (cb) => realRaf((ts) => cb(frozen === null ? ts : frozen));
})();`
  });
  await enterScene(page);
  const legs = () => page.evaluate(() => {
    const g = document.getElementById('scene-canvas').getContext('2d');
    const d = g.getImageData(886, 566, 44, 16).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if ((d[i] === 74 && d[i + 1] === 74 && d[i + 2] === 84) || (d[i] === 52 && d[i + 1] === 52 && d[i + 2] === 62)) n += 1;
    }
    const q = g.getImageData(900, 575, 1, 1).data;
    return { pants: n, iron: q[0] === 34 && q[1] === 38 && q[2] === 43 };
  });
  await page.evaluate(() => window.__freezeAt(20000));
  await page.waitForTimeout(150);
  const parked = await legs();
  await page.evaluate(() => window.__freezeAt(31230));
  await page.waitForTimeout(150);
  const passing = await legs();
  await page.evaluate(() => window.__freezeAt(45000));
  await page.waitForTimeout(150);
  const gone = await legs();
  ok('77f 火车驶过覆盖站台人物且驶离后恢复', parked.pants > 30 && passing.pants === 0 && passing.iron && gone.pants > 30, JSON.stringify({ parked, passing, gone }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed(), { reduced: true });
  await enterScene(page);
  const a = await page.evaluate(() => document.getElementById('scene-canvas').toDataURL());
  await page.waitForTimeout(600);
  const b = await page.evaluate(() => document.getElementById('scene-canvas').toDataURL());
  const px = await crop(page, 366, 255, 30, 60);
  ok('80 减少动态时人物静止且画面有意义', a === b && px.alpha > 0, JSON.stringify({ same: a === b, alpha: px.alpha }));
  await page.close();
}

{
  // 缺图降级：内联 data URL 按 PNG 头尺寸提取前缀在页面内阻断；若构建输出哈希独立资源则同时路由阻断该 URL
  const sheetPrefixes = [];
  const hashedSheets = [];
  try {
    for (const f of fs.readdirSync('dist/assets')) {
      if (/\.png$/.test(f) && /(craftsman|farmer|worker)/.test(f)) hashedSheets.push(f);
      if (!f.endsWith('.js')) continue;
      const s = fs.readFileSync(path.join('dist/assets', f), 'utf8');
      for (const m of s.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]{32,})/g)) {
        const b = Buffer.from(m[1].slice(0, 32), 'base64');
        if (b.readUInt32BE(16) === 192 && b.readUInt32BE(20) === 256) sheetPrefixes.push(m[1].slice(0, 64));
      }
    }
  } catch {}
  const page = await newPage(browser, baseSeed(), {
    routes: hashedSheets.map((f) => [`**/${f}`, (route) => route.abort()]),
    extraInit: `const P = ${JSON.stringify(sheetPrefixes)};
const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  configurable: true,
  get() { return d.get.call(this); },
  set(v) {
    if (typeof v === 'string' && (/\\/characters\\/(stone|tang|steam)\\//.test(v) || P.some((p) => v.startsWith('data:image/png;base64,' + p)))) return;
    d.set.call(this, v);
  }
});`
  });
  await enterScene(page);
  const px = await crop(page, 366, 255, 30, 60);
  const spriteColor = await page.evaluate(() => {
    const d = document.getElementById('scene-canvas').getContext('2d').getImageData(360, 250, 60, 70).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 106 && d[i + 1] === 74 && d[i + 2] === 48 && d[i + 3] === 255) n += 1;
    return n;
  });
  const realErrors = page.errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e));
  ok('81 精灵加载失败降级为程序人物', px.alpha > 0 && spriteColor === 0 && realErrors.length === 0, JSON.stringify({ alpha: px.alpha, spriteColor, realErrors, hashedSheets }));
  await page.close();
}

/* ---------- V0.6+ 环境音随时代 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 8, focusMinutes: 200, lastSettledRoundId: null, viewEra: 'stone' } }), {
    extraInit: `localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: true, muted: false, volume: 0.6, ambienceId: 'forest' }));`
  });
  await enterScene(page);
  await page.waitForTimeout(900);
  const a0 = await audioFetches(page);
  await page.click('.node[data-node="tang"]');
  await page.waitForTimeout(1200);
  const a1 = await audioFetches(page);
  await page.click('.node[data-node="steam"]');
  await page.waitForTimeout(1200);
  const a2 = await audioFetches(page);
  const p2 = await prefs(page);
  ok('118 环境音随时代切换且偏好同步', a0.includes('forest.ogg') && a1.includes('field.ogg') && a2.includes('steam.ogg') && p2.ambienceId === 'steam', JSON.stringify({ a0, a1, a2, amb: p2.ambienceId }));
  await page.close();
}

/* ---------- V0.6+ 首页太空默认 / 手动钉住 / 自动恢复 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 8, focusMinutes: 200, lastSettledRoundId: null, viewEra: 'stone' } }), {
    extraInit: `localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null }));`
  });
  await page.click('#settings-btn');
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
  await page.waitForTimeout(900);
  const h0 = await audioFetches(page);
  const autoChecked = await page.evaluate(() => [...document.querySelectorAll('#sound-list input')].filter((i) => i.checked).map((i) => i.value));
  await page.keyboard.press('Escape');
  await enterScene(page);
  await page.waitForTimeout(900);
  const s0 = await audioFetches(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1800);
  const sl119 = await m1SrcLog(page);
  const last119 = sl119.length ? m1IdOf(sl119[sl119.length - 1].bytes) : null;
  const p1 = await prefs(page);
  ok('119 首页默认太空且往返跟随', h0.includes('space.ogg') && autoChecked.join(',') === '' && s0.includes('forest.ogg') && last119 === 'space' && p1.ambienceId === 'space' && p1.followDefault !== false, JSON.stringify({ h0, autoChecked, s0, last119, p1 }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 8, focusMinutes: 200, lastSettledRoundId: null, viewEra: 'stone' } }), {
    extraInit: `localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null }));`
  });
  await page.click('#settings-btn');
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const r = document.querySelector('#sound-list input[value="field"]');
    r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await enterScene(page);
  await page.waitForTimeout(700);
  await page.click('.node[data-node="steam"]');
  await page.waitForTimeout(1200);
  const pinned = await prefs(page);
  const aPinned = await audioFetches(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1800);
  await page.click('#settings-btn');
  const pinnedChecked = await page.evaluate(() => [...document.querySelectorAll('#sound-list input')].filter((i) => i.checked).map((i) => i.value));
  await page.evaluate(() => {
    const r = document.querySelector('#sound-list input[value=""]');
    r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  const autoHome = await prefs(page);
  await page.keyboard.press('Escape');
  await enterScene(page);
  await page.waitForTimeout(1000);
  const autoState = await prefs(page);
  const aAuto = await audioFetches(page);
  ok('120 手动钉住跨时代不跟随且自动恢复', pinned.followDefault === false && pinned.ambienceId === 'field' && pinnedChecked.join(',') === 'field' && !aPinned.includes('steam.ogg') && autoHome.followDefault === true && autoHome.ambienceId === 'space' && autoState.ambienceId === 'steam' && aAuto.includes('steam.ogg'), JSON.stringify({ pinned, pinnedChecked, aPinned, autoHome, autoState, aAuto }));
  await page.close();
}

/* ---------- V0.7 首页主控件：时长输入 / 一键开始 / 状态显示 ---------- */
{
  const page = await newPage(browser, baseSeed());
  const d = await page.evaluate(() => ({
    caption: document.getElementById('era-caption').textContent,
    button: document.getElementById('home-start').textContent,
    value: document.getElementById('home-minutes').value,
    unit: document.getElementById('home-unit').textContent
  }));
  ok('121 待开始主控件与时代说明', d.caption === '石器聚落 · 距解锁盛唐田园还差 50 分钟' && d.button === '开始专注' && d.value === '25' && d.unit === '分钟', JSON.stringify(d));
  await page.fill('#home-minutes', '40');
  await page.press('#home-minutes', 'Enter');
  await page.waitForTimeout(250);
  let s = await state(page);
  const after = await page.evaluate(() => ({ view: document.body.dataset.view, value: document.getElementById('home-minutes').value, button: document.getElementById('home-start').textContent }));
  ok('122 输入 40 Enter 仅保存停留首页', s.settings.focusMinutes === 40 && s.run.status === 'idle' && after.view === 'home' && after.value === '40' && after.button === '开始专注', JSON.stringify({ f: s.settings.focusMinutes, ...after }));
  await page.reload();
  await waitForHomeReady(page);
  ok('122b 刷新后设置与首页均 40', (await state(page)).settings.focusMinutes === 40 && (await page.inputValue('#home-minutes')) === '40');
  await page.close();
}

{
  const page = await newPage(browser, baseSeed());
  await page.fill('#home-minutes', '40');
  await page.click('#home-start');
  await waitForHomeNear(page);
  let s = await state(page);
  ok('123a 输入 40 点按钮按 40 分钟开始', s.run.status === 'running' && s.run.durationMs === 2400000 && s.settings.focusMinutes === 40, JSON.stringify({ d: s.run.durationMs, f: s.settings.focusMinutes }));
  await page.close();

  const p2 = await newPage(browser, baseSeed());
  await p2.fill('#home-minutes', '40');
  await browseScene(p2);
  s = await state(p2);
  ok('123b 输入 40 点文明入口仅浏览且失焦保存 40', s.run.status === 'idle' && s.run.roundId === null && s.settings.focusMinutes === 40, JSON.stringify({ st: s.run.status, f: s.settings.focusMinutes }));
  await p2.click('[data-action="start"]');
  s = await state(p2);
  ok('123c 浏览后场景内开始按保存值 40 分钟', s.run.status === 'running' && s.run.durationMs === 2400000, String(s.run.durationMs));
  await p2.close();
}

{
  const page = await newPage(browser, baseSeed());
  await page.click('#settings-btn');
  await page.fill('#focus-minutes', '30');
  await page.click('#settings-form button[type="submit"]');
  await page.waitForTimeout(250);
  let v = await page.inputValue('#home-minutes');
  ok('124a 设置 30 首页立即 30', v === '30' && (await state(page)).settings.focusMinutes === 30, v);
  await page.reload();
  await waitForHomeReady(page);
  v = await page.inputValue('#home-minutes');
  ok('124b 刷新仍 30', v === '30', v);
  await page.close();
}

{
  for (const bad of ['', '0', '-2', '1.5', 'x']) {
    const page = await newPage(browser, baseSeed());
    await page.fill('#home-minutes', bad);
    await page.click('#home-start');
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({
      view: document.body.dataset.view,
      errHidden: document.getElementById('home-error').hidden,
      err: document.getElementById('home-error').textContent,
      value: document.getElementById('home-minutes').value
    }));
    const s = await state(page);
    ok(`125 非法 "${bad}" 保留草稿阻止开始`, s.run.status === 'idle' && r.view === 'home' && !r.errHidden && r.err.length > 0 && r.value === bad, JSON.stringify(r));
    await page.close();
  }
}

{
  const running = baseSeed({ run: { mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + 1122000, remainingMs: null, roundId: 'h-run', completion: null } });
  const page = await newPage(browser, running);
  let d = await page.evaluate(() => ({ state: document.getElementById('home-control').dataset.state, button: document.getElementById('home-start').textContent, inputHidden: document.getElementById('home-minutes').hidden }));
  ok('126a 专注中首页返回标签', d.state === 'running' && /^返回专注 · \d{2}:\d{2}$/.test(d.button) && d.inputHidden, JSON.stringify(d));
  await page.click('#home-start');
  await waitForHomeNear(page);
  ok('126b 专注中返回同一轮', (await state(page)).run.roundId === 'h-run' && (await state(page)).run.status === 'running');
  await page.close();

  const paused = baseSeed({ run: { mode: 'focus', status: 'paused', durationMs: 1500000, deadline: null, remainingMs: 1122000, roundId: 'h-pause', completion: null } });
  const p2 = await newPage(browser, paused);
  d = await page2Dock(p2);
  ok('126c 已暂停首页标签', d.state === 'paused' && d.button === '已暂停 · 18:42', JSON.stringify(d));
  await p2.click('#home-start');
  await waitForHomeNear(p2);
  ok('126d 已暂停返回保持暂停', (await state(p2)).run.status === 'paused' && (await state(p2)).run.roundId === 'h-pause');
  await p2.close();

  const done = baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 50, lastSettledRoundId: 'h-done', viewEra: 'tang' }, run: { mode: 'focus', status: 'done', durationMs: 1500000, deadline: null, remainingMs: 0, roundId: 'h-done', completion: { unlockedEra: 'tang', futureEra: null, at: Date.now() } } });
  const p3 = await newPage(browser, done);
  d = await page2Dock(p3);
  const doneExtra = await p3.evaluate(() => ({
    value: document.getElementById('home-minutes').value,
    breakHidden: document.getElementById('home-break').hidden,
    breakLabel: document.getElementById('home-break').textContent
  }));
  ok('126e 完成态首页可编辑开始与休息入口', d.state === 'done' && d.button === '开始专注' && !d.inputHidden && doneExtra.value === '25' && !doneExtra.breakHidden && doneExtra.breakLabel === '休息 5 分钟' && d.caption === '盛唐田园 · 距解锁蒸汽城镇还差 50 分钟', JSON.stringify({ ...d, ...doneExtra }));
  await p3.click('#home-start');
  await waitForHomeNear(p3);
  const nextRun = await state(p3);
  ok('126f 完成态首页一键开始新一轮', nextRun.run.status === 'running' && nextRun.run.roundId !== 'h-done' && nextRun.run.durationMs === 1500000, JSON.stringify(nextRun.run));
  await p3.close();

  const p4 = await newPage(browser, done);
  await p4.click('#home-break');
  await waitForHomeNear(p4);
  await browseScene(p4);
  const brk = await state(p4);
  ok('126g 完成态首页休息入口按设置开始休息', brk.run.status === 'running' && brk.run.mode === 'break' && brk.run.durationMs === 300000 && (await p4.textContent('#plaque-status')) === '— 休息中 —', JSON.stringify(brk.run));
  await p4.close();
}

{
  const page = await newPage(browser, baseSeed());
  await m2EnterDemo(page);
  const d = await page2Dock(page);
  ok('127a 演示首页只读 15 秒', d.button === '开始专注 · 15 秒' && d.inputHidden, JSON.stringify(d));
  // 此处验证轮次时长，而非两步导航耗时；只冻结业务时钟，镜头/揭幕照常运行。
  await page.evaluate(() => window.__freezeClock());
  await page.click('#home-start');
  await waitForHomeNear(page);
  await browseScene(page);
  const count = await page.textContent('#plaque-count');
  const s = await state(page);
  ok('127b 演示 15 秒不覆盖正式时长', /^00:1[2-5]$/.test(count) && s.settings.focusMinutes === 25 && s.run.status === 'idle' && s.progress.completedRounds === 0, JSON.stringify({ count, f: s.settings.focusMinutes, formal: s.run.status }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed());
  await page.click('#home-minutes');
  await page.keyboard.type('40');
  await page.waitForTimeout(700);
  let edit = await page.evaluate(() => ({ value: document.getElementById('home-minutes').value, focused: document.activeElement?.id === 'home-minutes' }));
  ok('128a 编辑草稿不被定时刷新覆盖', edit.value === '40' && edit.focused, JSON.stringify(edit));
  await page.keyboard.press('Escape');
  edit = await page.evaluate(() => ({ value: document.getElementById('home-minutes').value, focused: document.activeElement?.id === 'home-minutes' }));
  ok('128b Esc 放弃恢复上次保存值', edit.value === '25' && !edit.focused, JSON.stringify(edit));
  await page.click('#home-minutes');
  await page.keyboard.type('35');
  await page.click('#clock');
  await page.waitForTimeout(250);
  const s = await state(page);
  ok('128c 合法失焦保存 35', s.settings.focusMinutes === 35 && (await page.inputValue('#home-minutes')) === '35', String(s.settings.focusMinutes));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed());
  await page.fill('#home-minutes', '40');
  await page.dblclick('#home-start');
  await waitForHomeNear(page);
  const rid = (await state(page)).run.roundId;
  ok('129a 连点只产生一轮', (await state(page)).run.status === 'running' && (await state(page)).run.durationMs === 2400000 && (await state(page)).progress.completedRounds === 0, rid);
  await browseScene(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1500);
  if ((await page.getAttribute('body', 'data-dial')) !== 'far') await page.click('#dial-view-btn');
  await page.waitForSelector('body[data-view="home"][data-dial="far"]');
  await page.waitForTimeout(1100); // 镜头回到全景后再验证拖拽不会被误判为点击。
  const b = await dialCenter(page);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x + 90, b.y + 20, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const drag = await page.evaluate(() => ({ view: document.body.dataset.view, dial: document.body.dataset.dial, status: JSON.parse(localStorage.getItem('wmf:v1:formal')).run.status, roundId: JSON.parse(localStorage.getItem('wmf:v1:formal')).run.roundId }));
  ok('129b 拖拽不切换视角或进入文明且轮次不变', drag.view === 'home' && drag.dial === 'far' && drag.status === 'running' && drag.roundId === rid, JSON.stringify(drag));
  await page.close();
}

/* ---------- V0.8 方案：导航/开始拆分 · 完成态首页 · 命令守卫 · 布局 ---------- */
{
  const page = await newPage(browser, baseSeed(), {
    extraInit: `window.__failFormal = true; const os = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'wmf:v1:formal' && window.__failFormal) throw new Error('quota'); return os.call(this, k, v); };`
  });
  await page.fill('#home-minutes', '40');
  await page.click('#home-start');
  await page.waitForTimeout(250);
  let r = await page.evaluate(() => ({ view: document.body.dataset.view, err: document.getElementById('home-error').textContent, errHidden: document.getElementById('home-error').hidden, value: document.getElementById('home-minutes').value }));
  let s = await state(page);
  ok('130a 保存失败同次点击不建轮且保留草稿', r.view === 'home' && !r.errHidden && r.err.includes('保存失败') && r.value === '40' && s.settings.focusMinutes === 25 && s.run.status === 'idle' && s.run.roundId === null, JSON.stringify({ r, f: s.settings.focusMinutes }));
  await page.evaluate(() => { window.__failFormal = false; });
  await page.click('#home-start');
  await waitForHomeNear(page);
  s = await state(page);
  ok('130b 恢复存储后重试按 40 开始', s.run.status === 'running' && s.run.durationMs === 2400000 && s.settings.focusMinutes === 40, JSON.stringify({ d: s.run.durationMs, f: s.settings.focusMinutes }));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed());
  await page.fill('#home-minutes', 'abc');
  await browseScene(page);
  let s = await state(page);
  ok('131a 非法草稿不阻断浏览且设置不变', s.run.status === 'idle' && s.run.roundId === null && s.settings.focusMinutes === 25, JSON.stringify({ st: s.run.status, f: s.settings.focusMinutes }));
  await page.click('[data-action="start"]');
  s = await state(page);
  ok('131b 场景开始使用已保存 25 分钟', s.run.status === 'running' && s.run.durationMs === 1500000, String(s.run.durationMs));
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1500);
  const home = await page.evaluate(() => ({ value: document.getElementById('home-minutes').value, errHidden: document.getElementById('home-error').hidden }));
  ok('131c 返回首页草稿与错误保留', home.value === 'abc' && !home.errHidden, JSON.stringify(home));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' }, run: m1Running(6000) }));
  await enterScene(page);
  await page.click('[data-action="reset"]');
  await page.evaluate(() => window.__advance(7000));
  await page.waitForSelector('#unlock-dialog[open]');
  await page.click('[data-action="close-unlock"]');
  await page.waitForFunction(() => !document.getElementById('fx-canvas').classList.contains('is-active'), null, { timeout: 5000 });
  await page.click('[data-action="confirm-reset"]');
  const s = await state(page);
  ok('132a 过期后确认重置仅关闭不撤销完成', s.run.status === 'done' && s.progress.completedRounds === 2 && (await page.locator('#confirm-dialog[open]').count()) === 0, JSON.stringify({ st: s.run.status, rounds: s.progress.completedRounds }));
  await page.close();

  const p2 = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' }, run: m1Running(6000) }));
  await p2.evaluate(() => {
    window.__advance(7000);
    document.getElementById('home-start').click();
  });
  await waitForHomeNear(p2);
  const s2 = await state(p2);
  ok('132b 到期瞬间返回专注只近看不建新轮', s2.run.status === 'done' && s2.run.roundId === 'm1-6000' && s2.progress.completedRounds === 2, JSON.stringify(s2.run));
  await browseScene(p2);
  ok('132c 到期后经文明入口仍展示首次解锁卡', (await p2.locator('#unlock-dialog[open]').count()) === 1);
  await p2.close();
}

{
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 3, breakMinutes: 2 } }));
  for (let i = 0; i < 3; i += 1) {
    if (i === 0) await enterScene(page);
    else {
      await page.click('#home-start');
      await waitForHomeNear(page);
      await browseScene(page);
    }
    await page.evaluate(() => window.__advance(3 * 60000 + 1000));
    await page.waitForTimeout(800);
    ok(`133-${i + 1} 短轮不按轮数解锁`, (await page.locator('#unlock-dialog[open]').count()) === 0 && (await state(page)).progress.viewEra === 'stone');
    await page.click('[data-action="back-home"]');
    await page.waitForTimeout(1500);
    const d = await page2Dock(page);
    const s = await state(page);
    const brk = await page.evaluate(() => ({ hidden: document.getElementById('home-break').hidden, label: document.getElementById('home-break').textContent }));
    ok(`133-${i + 1} 第 ${i + 1} 轮结算后首页完成态控件`, s.progress.completedRounds === i + 1 && d.state === 'done' && d.button === '开始专注' && !d.inputHidden && !brk.hidden && brk.label === '休息 2 分钟', JSON.stringify({ d, brk, rounds: s.progress.completedRounds }));
  }
  const s = await state(page);
  await page.evaluate(() => window.__advance(4100));
  await page.waitForTimeout(300);
  const cap = await page.textContent('#era-caption');
  ok('133-4 三轮累计分钟正确', s.progress.focusMinutes === 9, String(s.progress.focusMinutes));
  ok('133-5 三个短轮后仍距盛唐 41 分钟', cap === '石器聚落 · 距解锁盛唐田园还差 41 分钟', cap);
  await page.close();
}

{
  const revisit = baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 3, focusMinutes: 100, lastSettledRoundId: 'rev', viewEra: 'stone' }, run: { mode: 'focus', status: 'done', durationMs: 1500000, deadline: null, remainingMs: 0, roundId: 'rev', completion: { unlockedEra: null, futureEra: null, at: Date.now() } } });
  const page = await newPage(browser, revisit);
  let d = await page2Dock(page);
  const brkHidden = await page.evaluate(() => document.getElementById('home-break').hidden);
  ok('134a 旧三代开放后回看完成态可直接开始与休息', d.button === '开始专注' && !d.inputHidden && !brkHidden && d.caption === '石器聚落 · 距解锁信息时代还差 50 分钟', JSON.stringify({ ...d, brkHidden }));
  await page.reload();
  await waitForHomeReady(page);
  d = await page2Dock(page);
  ok('134b 刷新不重放庆祝', d.caption === '石器聚落 · 距解锁信息时代还差 50 分钟' && (await page.locator('#unlock-dialog[open]').count()) === 0, JSON.stringify(d));
  await page.click('#home-start');
  await waitForHomeNear(page);
  await browseScene(page);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(800);
  const s = await state(page);
  ok('134c 回看后新轮到期才累计', s.progress.completedRounds === 4 && s.progress.focusMinutes === 125, JSON.stringify(s.progress));
  await page.close();
}

{
  const doneRun = { mode: 'focus', status: 'done', durationMs: 1500000, deadline: null, remainingMs: 0, roundId: 'd1', completion: { unlockedEra: null, futureEra: null, at: Date.now() } };
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 25, lastSettledRoundId: 'd1', viewEra: 'stone' }, run: doneRun }));
  await page.click('#home-break');
  await waitForHomeNear(page);
  await browseScene(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1500);
  let d = await page2Dock(page);
  ok('135a 休息中首页返回休息标签', d.state === 'running' && /^返回休息 · \d{2}:\d{2}$/.test(d.button) && d.inputHidden, JSON.stringify(d));
  await page.evaluate(() => window.__advance(5 * 60000 + 1000));
  await page.waitForTimeout(800);
  let s = await state(page);
  d = await page2Dock(page);
  ok('135b 休息自然到期回待开始不计进度', s.run.status === 'idle' && s.progress.completedRounds === 1 && s.progress.focusMinutes === 25 && d.button === '开始专注' && !d.inputHidden, JSON.stringify({ st: s.run.status, d }));
  await page.click('#home-start');
  await waitForHomeNear(page);
  await browseScene(page);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(800);
  await page.waitForSelector('#unlock-dialog[open]', { timeout: 5000 });
  await page.click('[data-action="close-unlock"]');
  await page.waitForFunction(() => !document.getElementById('fx-canvas').classList.contains('is-active'), null, { timeout: 5000 });
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1500);
  await page.click('#home-break');
  await waitForHomeNear(page);
  await browseScene(page);
  await page.click('#plaque-controls [data-action="end-break"]');
  s = await state(page);
  ok('135c 手动结束休息回待开始', s.run.status === 'idle' && s.progress.completedRounds === 2 && (await page.textContent('#plaque-status')) === '— 待开始 —', JSON.stringify({ st: s.run.status, rounds: s.progress.completedRounds }));
  await page.close();

  const p2 = await newPage(browser, baseSeed({ run: { mode: 'break', status: 'paused', durationMs: 300000, deadline: null, remainingMs: 200000, roundId: 'bp', completion: null } }));
  d = await page2Dock(p2);
  ok('135d 休息暂停首页标签', d.state === 'paused' && d.button === '休息暂停 · 03:20' && d.inputHidden, JSON.stringify(d));
  await p2.click('#home-start');
  await waitForHomeNear(p2);
  ok('135e 休息暂停返回保持暂停', (await state(p2)).run.status === 'paused' && (await state(p2)).run.roundId === 'bp');
  await p2.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' }, run: m1Running(6000) }));
  await page.evaluate(() => window.__advance(7000));
  await page.waitForTimeout(800);
  let cap = await page.textContent('#era-caption');
  ok('136a 首页一次性解锁反馈', cap === '蒸汽城镇已解锁 · +25 分钟', cap);
  await m2EnterDemo(page);
  const demoCap = await page.textContent('#era-caption');
  const demoDock = await page2Dock(page);
  ok('136b 演示不显示正式解锁反馈', demoCap.includes('演示') && demoCap.includes('完成 1 轮解锁盛唐田园') && demoDock.button === '开始专注 · 15 秒', JSON.stringify({ demoCap, demoDock }));
  await page.click('#home-start');
  await waitForHomeNear(page);
  await browseScene(page);
  await page.evaluate(() => window.__advance(16000));
  await page.waitForSelector('#unlock-dialog[open]', { timeout: 5000 });
  const demoTitle = await page.textContent('#unlock-title');
  ok('136c 演示只解锁自己的盛唐', demoTitle.includes('盛唐'), demoTitle);
  await m2CloseUnlock(page);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1500);
  const dd = await page2Dock(page);
  const db = await page.evaluate(() => ({ hidden: document.getElementById('home-break').hidden, label: document.getElementById('home-break').textContent, inputHidden: document.getElementById('home-minutes').hidden }));
  ok('136d 演示完成态只读 15 秒与休息 5 秒', dd.button === '开始专注 · 15 秒' && db.inputHidden && !db.hidden && db.label === '休息 5 秒', JSON.stringify({ dd, db }));
  await page.click('#settings-btn');
  await page.click('#demo-exit-btn');
  await page.waitForTimeout(1600);
  cap = await page.textContent('#era-caption');
  const s = await state(page);
  ok('136e 退出演示回正式完成态且通知不重放', s.run.status === 'done' && s.progress.completedRounds === 2 && cap === '蒸汽城镇 · 距解锁信息时代还差 50 分钟', JSON.stringify({ cap, rounds: s.progress.completedRounds }));
  await page.reload();
  await waitForHomeReady(page);
  cap = await page.textContent('#era-caption');
  ok('136f 刷新不重放解锁反馈', cap === '蒸汽城镇 · 距解锁信息时代还差 50 分钟', cap);
  await page.click('#home-start');
  await waitForHomeNear(page);
  await browseScene(page);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(800);
  await page.click('[data-action="back-home"]');
  await page.waitForTimeout(1500);
  cap = await page.textContent('#era-caption');
  ok('136g 新一轮完成显示普通反馈而非上轮解锁', cap === '专注完成 · +25 分钟', cap);
  await page.evaluate(() => window.__advance(4100));
  await page.waitForTimeout(300);
  ok('136h 普通反馈到期恢复真实累计', (await page.textContent('#era-caption')) === '蒸汽城镇 · 距解锁信息时代还差 25 分钟');
  await page.close();
}

for (const bad of ['99999999999999999999', '150000000000000']) {
  const page = await newPage(browser, baseSeed());
  await page.fill('#home-minutes', bad);
  await page.click('#home-start');
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({ view: document.body.dataset.view, err: document.getElementById('home-error').textContent, errHidden: document.getElementById('home-error').hidden }));
  const s = await state(page);
  ok(`137 超安全整数 ${bad.slice(0, 8)}… 拒绝且不影响轮次`, r.view === 'home' && !r.errHidden && r.err === '请输入大于 0 的整数分钟' && s.run.status === 'idle', JSON.stringify(r));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 2, focusMinutes: 50, lastSettledRoundId: 'h-done', viewEra: 'tang' }, run: { mode: 'focus', status: 'done', durationMs: 1500000, deadline: null, remainingMs: 0, roundId: 'h-done', completion: { unlockedEra: 'tang', futureEra: null, at: Date.now() } } }));
  await page.fill('#home-minutes', '40');
  await page.press('#home-minutes', 'Enter');
  await page.waitForTimeout(250);
  let s = await state(page);
  ok('138a 完成态输入 40 保存且轮次不变', s.settings.focusMinutes === 40 && s.run.status === 'done' && s.run.roundId === 'h-done' && s.run.durationMs === 1500000, JSON.stringify({ f: s.settings.focusMinutes, st: s.run.status }));
  await page.click('#settings-btn');
  const inSettings = await page.inputValue('#focus-minutes');
  await page.fill('#focus-minutes', '30');
  await page.click('#settings-form button[type="submit"]');
  await page.waitForTimeout(250);
  s = await state(page);
  ok('138b 设置 30 双向同步且完成轮不变', inSettings === '40' && (await page.inputValue('#home-minutes')) === '30' && s.settings.focusMinutes === 30 && s.run.durationMs === 1500000, JSON.stringify({ inSettings, f: s.settings.focusMinutes }));
  await page.click('#home-start');
  await waitForHomeNear(page);
  s = await state(page);
  ok('138c 完成态保存后开始按新值 30 分钟', s.run.status === 'running' && s.run.durationMs === 1800000 && s.run.roundId !== 'h-done', JSON.stringify({ d: s.run.durationMs, st: s.run.status }));
  await page.close();
}

for (const [w, h] of [[1280, 800], [1017, 555], [390, 844], [320, 568]]) {
  const need = w < 700 || h < 620 ? 16 : 24;
  for (const mode of ['idle', 'done', 'error', 'running', 'paused']) {
    const seed = mode === 'done'
      ? baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 25, lastSettledRoundId: 'd1', viewEra: 'stone' }, run: { mode: 'focus', status: 'done', durationMs: 1500000, deadline: null, remainingMs: 0, roundId: 'd1', completion: { unlockedEra: null, futureEra: null, at: Date.now() } } })
      : mode === 'running'
        ? baseSeed({ run: { mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + 1122000, remainingMs: null, roundId: 'l-run', completion: null } })
        : mode === 'paused'
          ? baseSeed({ run: { mode: 'focus', status: 'paused', durationMs: 1500000, deadline: null, remainingMs: 1122000, roundId: 'l-pause', completion: null } })
          : baseSeed();
    const page = await newPage(browser, seed, { viewport: { width: w, height: h } });
    if (mode === 'error') {
      await page.fill('#home-minutes', 'x');
      await page.click('#clock');
      await page.waitForTimeout(300);
    }
    const m = await page.evaluate(() => {
      const c = document.getElementById('dial-canvas');
      const cap = document.getElementById('era-caption').getBoundingClientRect();
      const ctrl = document.getElementById('home-control').getBoundingClientRect();
      const brk = document.getElementById('home-break');
      const err = document.getElementById('home-error');
      return {
        dialBottom: +c.dataset.cy + +c.dataset.ry,
        capTop: cap.top,
        capBottom: cap.bottom,
        ctrlTop: ctrl.top,
        ctrlBottom: ctrl.bottom,
        ctrlLeft: ctrl.left,
        ctrlRight: ctrl.right,
        brkBottom: brk.hidden ? 0 : brk.getBoundingClientRect().bottom,
        errBottom: err.hidden ? 0 : err.getBoundingClientRect().bottom,
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
        innerW: window.innerWidth,
        innerH: window.innerHeight
      };
    });
    const lowest = Math.max(m.ctrlBottom, m.brkBottom, m.errBottom);
    ok(`139 ${w}x${h} ${mode} 外轮廓间距与无滚动`, m.capTop - m.dialBottom + DIAL_PROJECTION_EPSILON >= need && m.ctrlTop - m.capBottom >= 10 && m.ctrlTop - m.capBottom <= 14 && lowest <= m.innerH && m.ctrlLeft >= 0 && m.ctrlRight <= m.innerW && m.scrollW <= m.innerW && m.scrollH <= m.innerH, JSON.stringify({ gap: Math.round(m.capTop - m.dialBottom), capCtrl: Math.round(m.ctrlTop - m.capBottom), lowest: Math.round(lowest), ctrlLeft: Math.round(m.ctrlLeft), ctrlRight: Math.round(m.ctrlRight) }));
    await page.close();
  }
}

{
  const page = await newPage(browser, baseSeed(), { viewport: { width: 390, height: 844 } });
  await page.click('#home-minutes');
  await page.keyboard.type('40');
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const inp = document.getElementById('home-minutes').getBoundingClientRect();
    const cap = document.getElementById('era-caption').getBoundingClientRect();
    const c = document.getElementById('dial-canvas');
    return { inpBottom: inp.bottom, inpTop: inp.top, capTop: cap.top, dialBottom: +c.dataset.cy + +c.dataset.ry, innerH: window.innerHeight, scrollH: document.documentElement.scrollHeight, focused: document.activeElement?.id === 'home-minutes', value: document.getElementById('home-minutes').value };
  });
  ok('141 模拟键盘压缩视口后输入与说明仍可见', m.focused && m.value === '40' && m.inpBottom <= m.innerH && m.inpTop >= 0 && m.capTop - m.dialBottom + DIAL_PROJECTION_EPSILON >= 16 && m.scrollH <= m.innerH, JSON.stringify(m));
  await page.close();
}

{
  const page = await newPage(browser, baseSeed(), { reduced: true });
  const c = await dialCenter(page);
  await page.mouse.click(c.x, c.y);
  await waitForHomeNear(page);
  ok('140a 减少动态点击时钟只近看', (await state(page)).run.status === 'idle' && (await state(page)).run.roundId === null);
  await browseScene(page);
  ok('140 减少动态首页仍可经文明入口浏览', (await state(page)).run.status === 'idle');
  await page.close();
}

/* ---------- V0.10 首页三段控件 ---------- */
{
  const runSeed = () => baseSeed({ run: { mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + 1122000, remainingMs: null, roundId: 'h-run', completion: null } });
  const segs = (page) => page.evaluate(() => {
    const p = document.getElementById('home-pause');
    const r = document.getElementById('home-reset');
    return {
      view: document.body.dataset.view,
      state: document.getElementById('home-control').dataset.state,
      button: document.getElementById('home-start').textContent,
      pauseHidden: p.hidden,
      resetHidden: r.hidden,
      sepLeftHidden: document.getElementById('home-sep-left').hidden,
      sepRightHidden: document.getElementById('home-sep-right').hidden,
      pauseLabel: p.getAttribute('aria-label'),
      pauseMode: p.dataset.mode,
      resetLabel: r.getAttribute('aria-label'),
      resetAction: r.dataset.action,
      resetText: r.textContent.trim(),
      inputHidden: document.getElementById('home-minutes').hidden
    };
  });

  const page = await newPage(browser, runSeed());
  let d = await segs(page);
  ok('142a 运行首页三段齐全', d.view === 'home' && d.state === 'running' && !d.pauseHidden && !d.resetHidden && !d.sepLeftHidden && !d.sepRightHidden && d.pauseLabel === '暂停本轮' && d.pauseMode === 'pause' && d.resetLabel === '重置本轮' && d.resetAction === 'home-reset' && d.inputHidden && /^返回专注 · \d{2}:\d{2}$/.test(d.button), JSON.stringify(d));
  await page.click('#home-pause');
  await page.waitForTimeout(300);
  let s = await state(page);
  d = await segs(page);
  ok('142b 首页暂停原地冻结', s.run.status === 'paused' && s.run.roundId === 'h-run' && s.run.remainingMs <= 1122000 && s.run.remainingMs >= 1114000 && d.view === 'home' && d.state === 'paused' && d.pauseLabel === '继续本轮' && d.pauseMode === 'resume' && /^已暂停 · \d{2}:\d{2}$/.test(d.button), JSON.stringify({ st: s.run.status, rem: s.run.remainingMs, d }));
  await page.click('#home-pause');
  await page.waitForTimeout(300);
  s = await state(page);
  d = await segs(page);
  ok('142c 首页继续原地推进', s.run.status === 'running' && s.run.deadline !== null && d.view === 'home' && d.state === 'running' && d.pauseMode === 'pause' && /^返回专注 · \d{2}:\d{2}$/.test(d.button), JSON.stringify({ st: s.run.status, d }));
  await page.click('#home-reset');
  ok('142d 首页重置需确认且取消文字明确', (await page.locator('#confirm-dialog[open]').count()) === 1 && (await page.textContent('[data-action="cancel-reset"]')).trim() === '取消');
  await page.click('[data-action="cancel-reset"]');
  await page.waitForTimeout(200);
  s = await state(page);
  ok('142d2 取消重置保持原轮', s.run.status === 'running' && s.run.roundId === 'h-run' && (await page.locator('#confirm-dialog[open]').count()) === 0, JSON.stringify(s.run));
  await page.click('#home-reset');
  await page.click('[data-action="confirm-reset"]');
  await page.waitForTimeout(300);
  s = await state(page);
  d = await segs(page);
  ok('142e 确认重置回待开始', s.run.status === 'idle' && s.progress.completedRounds === 0 && s.progress.focusMinutes === 0 && d.state === 'idle' && d.pauseHidden && d.resetHidden && !d.inputHidden && d.button === '开始专注', JSON.stringify({ st: s.run.status, d }));
  await page.close();

  const p2 = await newPage(browser, baseSeed({ run: { mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + 400, remainingMs: null, roundId: 'h-exp', completion: null } }));
  await p2.evaluate(() => { window.__advance(1000); document.getElementById('home-pause').click(); });
  await p2.waitForTimeout(300);
  s = await state(p2);
  d = await segs(p2);
  ok('142f 到期瞬间首页暂停只结算完成', s.run.status === 'done' && s.progress.completedRounds === 1 && d.view === 'home' && d.state === 'done' && d.pauseHidden && d.resetHidden, JSON.stringify({ st: s.run.status, rounds: s.progress.completedRounds, d }));
  await p2.close();

  const p3 = await newPage(browser, baseSeed({ run: { mode: 'focus', status: 'running', durationMs: 1500000, deadline: Date.now() + 60000, remainingMs: null, roundId: 'h-stale', completion: null } }));
  await p3.click('#home-reset');
  await p3.evaluate(() => { window.__advance(120000); document.querySelector('[data-action="confirm-reset"]').click(); });
  await p3.waitForTimeout(300);
  s = await state(p3);
  ok('142g 过期重置确认仅关闭不撤销完成', s.run.status === 'done' && s.progress.completedRounds === 1 && (await p3.locator('#confirm-dialog[open]').count()) === 0, JSON.stringify({ st: s.run.status, rounds: s.progress.completedRounds }));
  await p3.close();

  const p4 = await newPage(browser, baseSeed({ progress: { legacyEraFloor: 'stone', completedRounds: 1, focusMinutes: 25, lastSettledRoundId: 'b0', viewEra: 'stone' }, run: { mode: 'break', status: 'running', durationMs: 300000, deadline: Date.now() + 200000, remainingMs: null, roundId: 'b-run', completion: null } }));
  d = await segs(p4);
  ok('142h 休息运行三段与结束休息命令', d.state === 'running' && !d.pauseHidden && !d.resetHidden && d.resetText === '结束休息' && d.resetLabel === '结束休息' && d.resetAction === 'end-break' && /^返回休息 · \d{2}:\d{2}$/.test(d.button), JSON.stringify(d));
  await p4.click('#home-pause');
  await p4.waitForTimeout(250);
  s = await state(p4);
  d = await segs(p4);
  ok('142h2 休息暂停原地标签', s.run.status === 'paused' && s.run.mode === 'break' && d.view === 'home' && d.pauseMode === 'resume' && /^休息暂停 · \d{2}:\d{2}$/.test(d.button), JSON.stringify({ st: s.run.status, d }));
  await p4.click('#home-pause');
  await p4.waitForTimeout(250);
  s = await state(p4);
  ok('142h3 休息继续原地推进', s.run.status === 'running' && s.run.mode === 'break' && (await segs(p4)).view === 'home', JSON.stringify(s.run));
  await p4.click('#home-reset');
  ok('142i0 结束休息无需重置确认', (await p4.locator('#confirm-dialog[open]').count()) === 0 && (await p4.textContent('#era-caption')) === '休息已结束');
  await p4.waitForTimeout(250);
  s = await state(p4);
  d = await segs(p4);
  ok('142i 休息重置回待开始不计进度', s.run.status === 'idle' && s.progress.completedRounds === 1 && s.progress.focusMinutes === 25 && d.state === 'idle' && d.pauseHidden, JSON.stringify({ st: s.run.status, rounds: s.progress.completedRounds, d }));
  await p4.close();

  const p5 = await newPage(browser, baseSeed());
  await m2EnterDemo(p5);
  await p5.click('#home-start');
  await waitForHomeNear(p5);
  await browseScene(p5);
  await p5.click('[data-action="back-home"]');
  await p5.waitForTimeout(1700);
  d = await segs(p5);
  ok('142j 演示首页运行显示三段', d.state === 'running' && !d.pauseHidden && !d.resetHidden, JSON.stringify(d));
  await p5.click('#home-reset');
  await p5.click('[data-action="confirm-reset"]');
  await p5.waitForTimeout(300);
  const formal = await state(p5);
  const demoDock = await segs(p5);
  ok('142j2 演示重置不碰正式且输入仍只读', formal.run.status === 'idle' && formal.run.roundId === null && demoDock.state === 'idle' && demoDock.inputHidden && demoDock.button === '开始专注 · 15 秒', JSON.stringify({ formal: formal.run, demoDock }));
  await p5.close();

  const p6 = await newPage(browser, runSeed());
  const order = await p6.evaluate(() => [...document.querySelectorAll('#home-control button:not([hidden])')].map((b) => b.id));
  await p6.focus('#home-pause');
  await p6.keyboard.press('Tab');
  const f1 = await p6.evaluate(() => document.activeElement.id);
  await p6.keyboard.press('Tab');
  const f2 = await p6.evaluate(() => document.activeElement.id);
  await p6.keyboard.press('Enter');
  const confOpen = (await p6.locator('#confirm-dialog[open]').count()) === 1;
  await p6.keyboard.press('Escape');
  await p6.waitForTimeout(200);
  const confClosed = (await p6.locator('#confirm-dialog[open]').count()) === 0;
  s = await state(p6);
  ok('142k 焦点左中右与 Esc 不改计时', order.join(',') === 'home-pause,home-start,home-reset' && f1 === 'home-start' && f2 === 'home-reset' && confOpen && confClosed && s.run.status === 'running', JSON.stringify({ order, f1, f2, confOpen, confClosed }));
  await p6.close();

  for (const w of [320, 390]) {
    const p7 = await newPage(browser, runSeed(), { viewport: { width: w, height: 568 } });
    const m = await p7.evaluate(() => {
      const ctrl = document.getElementById('home-control').getBoundingClientRect();
      const p = document.getElementById('home-pause').getBoundingClientRect();
      const r = document.getElementById('home-reset').getBoundingClientRect();
      return { left: ctrl.left, right: ctrl.right, innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth, pw: p.width, ph: p.height, rw: r.width, rh: r.height, bottom: ctrl.bottom, innerH: window.innerHeight };
    });
    ok(`142l ${w} 三段胶囊在视口内且命中区达标`, m.left >= 0 && m.right <= m.innerW && m.scrollW <= m.innerW && m.pw >= 44 && m.ph >= 40 && m.rw >= 44 && m.rh >= 40 && m.bottom <= m.innerH, JSON.stringify(m));
    await p7.close();
  }
}

/* ---------- 50 分钟解锁方案：A1–A14 ---------- */
// 经典像素场景、图鉴与音频仍只有旧三代；首页大类来自四时代目录。
const A_ERAS = ['stone', 'tang', 'steam'];
const A_NAMES = ['石器聚落', '盛唐田园', '蒸汽城镇'];
const aProgress = (focusMinutes = 0, completedRounds = 0, viewEra = 'stone') => ({
  legacyEraFloor: 'stone', focusMinutes, completedRounds, viewEra, lastSettledRoundId: null
});
const aRun = (minutes, mode = 'focus', id = 'acceptance-run') => ({
  mode, status: 'running', durationMs: minutes * 60000, deadline: Date.now() + minutes * 60000,
  remainingMs: null, roundId: id, completion: null
});
const A_FROZEN = 'window.__freezeClock();';
const aSameProgress = (a, b) => ['legacyEraFloor', 'focusMinutes', 'completedRounds', 'viewEra', 'lastSettledRoundId'].every((key) => a[key] === b[key]);
async function aAdvance(page, ms) {
  await page.evaluate((n) => window.__advance(n), ms);
  await page.waitForTimeout(350); // checkNow 的 250ms tick；不假造结算事件。
}
async function aHome(page) {
  await page.click('[data-action="back-home"]');
  await page.waitForSelector('body[data-view="home"]');
  await page.waitForTimeout(1500);
}
async function aReload(page) {
  await page.reload();
  await waitForHomeReady(page);
}
async function aWatchUnlocks(page) {
  await page.evaluate(() => {
    window.__unlockTitles = [];
    window.__eraTransitions = 0;
    const show = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function (...args) {
      if (this.id === 'unlock-dialog') window.__unlockTitles.push(document.getElementById('unlock-title').textContent);
      return show.apply(this, args);
    };
    const fx = document.getElementById('fx-canvas');
    new MutationObserver((records) => {
      for (const r of records) {
        if (!/(^|\s)is-active(\s|$)/.test(r.oldValue || '') && fx.classList.contains('is-active')) window.__eraTransitions += 1;
      }
    }).observe(fx, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
}
async function aBackground(page) {
  return page.evaluate(() => {
    const c = document.getElementById('bg-canvas');
    const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let hash = 2166136261;
    for (let i = 0; i < bytes.length; i += 97) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
    return hash;
  });
}
async function aGates(page, expected, label, fill) {
  const nodes = await page.evaluate(() => [...document.querySelectorAll('.node')].map((n) => ({ id: n.dataset.node, locked: n.disabled, aria: n.getAttribute('aria-label') })));
  ok(`${label} 场景节点/无障碍门禁`, nodes.length === 3 && nodes.every((n) => n.locked === !expected.includes(n.id) && n.aria.includes('未解锁') === n.locked), JSON.stringify(nodes));
  if (fill !== undefined) {
    const width = await page.evaluate(() => parseFloat(document.getElementById('progress-fill').style.width));
    ok(`${label} 进度条仅用已结算分钟`, Math.abs(width - fill) < 0.01, `${width} vs ${fill}`);
  }
  const before = await page.evaluate(() => document.body.dataset.theme);
  // 绕过 disabled 的合成冒泡事件也必须被业务门禁拒绝。
  await page.evaluate(() => document.querySelectorAll('.node:disabled').forEach((n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }))));
  await page.waitForTimeout(700);
  ok(`${label} 锁定节点不能回看`, (await page.evaluate(() => document.body.dataset.theme)) === before);
  await page.click('#codex-panel-btn');
  const tabs = await page.locator('.codex-tab').evaluateAll((ns) => ns.map((n) => n.dataset.era));
  ok(`${label} 图鉴只列开放时代`, tabs.join(',') === expected.join(','), tabs.join(','));
  for (const era of expected) {
    await page.click(`.codex-tab[data-era="${era}"]`);
    ok(`${label} ${era} 图鉴可选且三卡`, (await page.locator('.codex-tab[aria-selected="true"]').getAttribute('data-era')) === era && (await page.locator('.codex-card').count()) === 3);
  }
  await page.keyboard.press('Escape');
  await aHome(page);
  await page.click('#settings-btn');
  const sounds = await page.locator('#sound-list input').evaluateAll((ns) => ns.map((n) => n.value));
  const allowedSounds = ['', ...expected.map((id) => ({ stone: 'forest', tang: 'field', steam: 'steam' })[id]), 'space'];
  ok(`${label} 环境音门禁含首页专属太空`, sounds.join(',') === allowedSounds.join(','), sounds.join(','));
  // 关闭声音时也能保存合法选择，不必依赖网络加载证明门禁。
  for (const id of allowedSounds.slice(1)) {
    await m1Pick(page, id);
    ok(`${label} 可选择 ${id}`, (await prefs(page)).ambienceId === id);
  }
  for (const id of ['field', 'steam'].filter((id) => !allowedSounds.includes(id))) {
    const before = await prefs(page);
    await page.evaluate((value) => {
      const forged = document.createElement('input');
      forged.type = 'radio'; forged.name = 'ambience'; forged.value = value;
      document.getElementById('sound-list').appendChild(forged);
      forged.dispatchEvent(new Event('change', { bubbles: true }));
      forged.remove();
    }, id);
    ok(`${label} 业务层拒绝未开放环境音 ${id}`, (await prefs(page)).ambienceId === before.ambienceId);
  }
  await page.keyboard.press('Escape');
}

// A1：真实四轮默认番茄钟，门槛差集必须只出现在第 2 / 4 轮。
{
  const page = await newPage(browser, baseSeed(), { extraInit: A_FROZEN });
  await aWatchUnlocks(page);
  const ids = new Set();
  for (let round = 1; round <= 4; round += 1) {
    await page.click('#home-start');
    await waitForHomeNear(page);
    await browseScene(page);
    const started = await state(page);
    ids.add(started.run.roundId);
    await aHome(page);
    await aAdvance(page, 25 * 60000);
    const s = await state(page);
    const era = round < 2 ? 'stone' : round < 4 ? 'tang' : 'steam';
    const unlocked = round === 2 ? 'tang' : round === 4 ? 'steam' : null;
    const message = unlocked ? `${A_NAMES[A_ERAS.indexOf(unlocked)]}已解锁 · +25 分钟` : '专注完成 · +25 分钟';
    ok(`A1.${round} 累计 ${round * 25} / 轮数 / 解锁差集`, s.progress.focusMinutes === round * 25 && s.progress.completedRounds === round && s.progress.legacyEraFloor === 'stone' && s.progress.viewEra === era && s.run.durationMs === 1500000 && s.run.completion.unlockedEra === unlocked && s.progress.lastSettledRoundId === started.run.roundId, JSON.stringify(s));
    ok(`A1.${round} 首页到期反馈与立即可用主控件`, (await page.textContent('#era-caption')) === message && !(await page.locator('#home-minutes').isHidden()) && (await page.textContent('#home-start')) === '开始专注' && (await page.locator('#home-break').isVisible()));
    await browseScene(page);
    if (unlocked) {
      await page.waitForSelector('#unlock-dialog[open]');
      ok(`A1.${round} 只提示新开放时代`, (await page.textContent('#unlock-title')) === A_NAMES[A_ERAS.indexOf(unlocked)]);
      await m2CloseUnlock(page);
    } else ok(`A1.${round} 普通轮没有卡片`, (await page.locator('#unlock-dialog[open]').count()) === 0);
    const available = await page.locator('.node:not(:disabled)').evaluateAll((ns) => ns.map((n) => n.dataset.node));
    ok(`A1.${round} 开放集合一致`, available.join(',') === A_ERAS.slice(0, A_ERAS.indexOf(era) + 1).join(','), available.join(','));
    await aHome(page);
    await aAdvance(page, 4000);
    const normal = round === 4 ? '蒸汽城镇 · 距解锁信息时代还差 50 分钟' : `${A_NAMES[A_ERAS.indexOf(era)]} · 距解锁${round < 2 ? '盛唐田园' : '蒸汽城镇'}还差 ${round < 2 ? 50 - round * 25 : 100 - round * 25} 分钟`;
    ok(`A1.${round} 常态剩余门槛`, (await page.textContent('#era-caption')) === normal);
  }
  ok('A1 四个独立 roundId / 总共两张卡', ids.size === 4 && (await page.evaluate(() => window.__unlockTitles.join('|'))) === '盛唐田园|蒸汽城镇');
  await page.close();
}

// A2：真实值比较，倒计时进行到最后一毫秒也不能先记分钟。
for (const [minutes, target] of [[49, 'tang'], [99, 'steam']]) {
  const current = minutes < 50 ? 'stone' : 'tang';
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 1, breakMinutes: 5 }, progress: aProgress(minutes, 7, current) }), { extraInit: A_FROZEN });
  await enterScene(page);
  await aAdvance(page, 59999);
  ok(`A2 ${minutes} 最后一毫秒仍未开放`, (await state(page)).progress.focusMinutes === minutes && (await page.locator(`.node[data-node="${target}"]`).isDisabled()) && parseFloat(await page.locator('#progress-fill').evaluate((n) => n.style.width)) === minutes);
  await aAdvance(page, 1);
  await page.waitForSelector('#unlock-dialog[open]');
  const s = await state(page);
  ok(`A2 ${minutes + 1} 恰到门槛开放`, s.progress.focusMinutes === minutes + 1 && s.progress.completedRounds === 8 && s.progress.viewEra === target && !(await page.locator(`.node[data-node="${target}"]`).isDisabled()), JSON.stringify(s.progress));
  await page.close();
}
{
  const page = await newPage(browser, baseSeed({ progress: aProgress(49.5, 20, 'steam') }), { extraInit: A_FROZEN });
  ok('A2 49.5 不因舍入或轮数提前解锁', (await page.textContent('#era-caption')) === '石器聚落 · 距解锁盛唐田园还差 1 分钟' && (await page.evaluate(() => document.body.dataset.theme)) === 'stone');
  await browseScene(page);
  await aGates(page, ['stone'], 'A2 49.5', 49.5);
  await page.close();
}

// A3：一轮跨两个门槛，只转场一次、合并一张卡、完整奖励。
{
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 100, breakMinutes: 5 } }), { extraInit: A_FROZEN });
  await enterScene(page);
  await aWatchUnlocks(page); // 不把首页进入场景计为时代转场。
  await aAdvance(page, 100 * 60000);
  await page.waitForSelector('#unlock-dialog[open]');
  const s = await state(page);
  const rows = await page.textContent('#unlock-rows');
  ok('A3 单轮 100 分钟只加一轮并保存最高时代', s.progress.focusMinutes === 100 && s.progress.completedRounds === 1 && s.progress.legacyEraFloor === 'stone' && s.progress.viewEra === 'steam' && s.run.completion.unlockedEra === 'steam', JSON.stringify(s));
  ok('A3 合并卡标题/两份图鉴背景声音奖励', (await page.textContent('#unlock-title')) === '盛唐田园、蒸汽城镇' && ['极光天幕', '深空星云', '田园流水', '蒸汽火车'].every((v) => rows.includes(v)) && (await page.locator('#unlock-rows > li').count()) === 6, rows);
  ok('A3 合并场景反馈', (await page.textContent('#scene-hint-text')) === '盛唐田园、蒸汽城镇已解锁');
  await m2CloseUnlock(page);
  await page.waitForTimeout(1000);
  const events = await page.evaluate(() => ({ titles: window.__unlockTitles, transitions: window.__eraTransitions }));
  ok('A3 一次转场一次通知，不连续弹卡', events.titles.join('|') === '盛唐田园、蒸汽城镇' && events.transitions === 1 && (await page.locator('#unlock-dialog[open]').count()) === 0, JSON.stringify(events));
  const steamBg = await aBackground(page);
  await aGates(page, A_ERAS, 'A3 全奖励', 100);
  const reference = await newPage(browser, baseSeed({ progress: aProgress(100, 4, 'steam') }));
  await reference.waitForTimeout(600);
  ok('A3 背景与正式 100 分钟蒸汽背景一致', steamBg === await aBackground(reference));
  await reference.close();
  await page.close();
}

// A4：两个短轮并非旧档，不得触发轮数迁移兜底。
{
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 1, breakMinutes: 5 } }), { extraInit: A_FROZEN });
  await enterScene(page);
  for (let i = 1; i <= 2; i += 1) {
    if (i > 1) await page.click('[data-action="start-next"]');
    await aAdvance(page, 60000);
    ok(`A4 第 ${i} 个短轮未开放盛唐`, (await state(page)).progress.focusMinutes === i && (await page.locator('.node[data-node="tang"]').isDisabled()) && (await page.locator('#unlock-dialog[open]').count()) === 0);
  }
  await aReload(page);
  const s = await state(page);
  ok('A4 刷新保留新档 floor / 2 分钟 / 2 轮', s.progress.legacyEraFloor === 'stone' && s.progress.focusMinutes === 2 && s.progress.completedRounds === 2 && (await page.textContent('#era-caption')) === '石器聚落 · 距解锁盛唐田园还差 48 分钟', JSON.stringify(s.progress));
  await browseScene(page);
  await aGates(page, ['stone'], 'A4 刷新后', 2);
  await page.close();
}

// A5：只删除字段的旧档可以迁移。两次加载验证幂等与运行上下文保留。
for (const [rounds, minutes, floor, era] of [[1, 25, 'tang', 'tang'], [2, 50, 'steam', 'steam'], [0, 100, 'stone', 'stone'], [20, 2, 'steam', 'steam']]) {
  const seed = baseSeed({ settings: { focusMinutes: 31, breakMinutes: 7 }, progress: { ...aProgress(minutes, rounds, era), lastSettledRoundId: 'old-settled' }, run: { mode: 'focus', status: 'paused', durationMs: 1860000, deadline: null, remainingMs: 123456, roundId: 'legacy-paused', completion: null } });
  delete seed.progress.legacyEraFloor;
  const page = await newPage(browser, seed, { extraInit: A_FROZEN });
  for (let load = 1; load <= 2; load += 1) {
    if (load > 1) await aReload(page);
    const caption = await page.textContent('#era-caption');
    ok(`A5 ${rounds} 轮旧档加载 ${load} 保留视图且无庆祝`, (await page.evaluate(() => document.body.dataset.theme)) === era && (await page.locator('#unlock-dialog[open]').count()) === 0 && !(caption.includes('已解锁')) && (await page.evaluate(() => window.__osc)) === 0 && (await page.locator('[data-home-era="information"]').isDisabled()) && caption === (floor === 'tang' ? '盛唐田园 · 距解锁蒸汽城镇还差 75 分钟' : `${A_NAMES[A_ERAS.indexOf(era)]} · 距解锁信息时代还差 ${150 - minutes} 分钟`), caption);
    await page.click('#settings-btn');
    await page.click('#settings-form button[type="submit"]'); // 每次成功保存必须写出迁移字段。
    const s = await state(page);
    ok(`A5 ${rounds} 轮旧档加载 ${load} 迁移不改设置/累计/原轮`, s.progress.legacyEraFloor === floor && s.progress.focusMinutes === minutes && s.progress.completedRounds === rounds && s.progress.lastSettledRoundId === 'old-settled' && s.progress.viewEra === era && s.settings.focusMinutes === 31 && s.settings.breakMinutes === 7 && s.run.status === 'paused' && s.run.roundId === 'legacy-paused' && s.run.durationMs === 1860000 && s.run.remainingMs === 123456 && s.run.deadline === null, JSON.stringify(s));
    await browseScene(page);
    const open = await page.locator('.node:not(:disabled)').evaluateAll((ns) => ns.map((n) => n.dataset.node));
    const fill = await page.locator('#progress-fill').evaluate((n) => parseFloat(n.style.width));
    ok(`A5 ${rounds} 轮旧档保留开放节点而非虚增分钟`, open.join(',') === (floor === 'tang' ? 'stone,tang' : 'stone,tang,steam') && fill === (floor === 'tang' ? 50 : 100));
    await aHome(page);
  }
  await page.close();
}
for (const badFloor of [null, '', 'future', 2, {}]) {
  const seed = baseSeed({ progress: { ...aProgress(2, 20, 'steam'), legacyEraFloor: badFloor }, run: { mode: 'focus', status: 'done', durationMs: 60000, deadline: null, remainingMs: 0, roundId: 'unknown-completion', completion: { unlockedEra: 'unknown-era', unlockedEras: ['unknown-era'], futureEra: 'unknown-era', at: Date.now() } } });
  const page = await newPage(browser, seed, { extraInit: A_FROZEN });
  await page.click('#settings-btn');
  await page.click('#settings-form button[type="submit"]');
  const s = await state(page);
  ok(`A5 非法已有 floor ${JSON.stringify(badFloor)} 不走轮数迁移`, s.progress.legacyEraFloor === 'stone' && s.progress.focusMinutes === 2 && s.progress.completedRounds === 20 && s.progress.viewEra === 'stone' && s.run.completion.unlockedEra === null && s.run.completion.futureEra === null && page.errors.length === 0, JSON.stringify(s));
  await browseScene(page);
  ok('A5 未知 completion 安全读取且不弹卡发声', (await page.locator('#unlock-dialog[open]').count()) === 0 && (await page.locator('.node:not(:disabled)').count()) === 1 && (await page.evaluate(() => window.__osc)) === 0 && page.errors.length === 0, page.errors.join('|'));
  await page.close();
}
{
  const seed = baseSeed({ settings: { focusMinutes: 1, breakMinutes: 9 }, progress: { ...aProgress(49, 1, 'tang'), lastSettledRoundId: 'previous' }, run: aRun(1, 'focus', 'legacy-deadline') });
  delete seed.progress.legacyEraFloor;
  const page = await newPage(browser, seed, { extraInit: A_FROZEN });
  await page.click('#settings-btn');
  await page.click('#settings-form button[type="submit"]');
  const before = await state(page);
  ok('A5 迁移保留运行 deadline/id/已结算 ID', before.run.deadline === seed.run.deadline && before.run.roundId === seed.run.roundId && before.progress.lastSettledRoundId === 'previous' && before.run.durationMs === 60000);
  await aAdvance(page, 61000);
  await aReload(page);
  const after = await state(page);
  ok('A5 旧运行轮到期只结算一次', after.progress.focusMinutes === 50 && after.progress.completedRounds === 2 && after.progress.legacyEraFloor === 'tang' && after.progress.lastSettledRoundId === 'legacy-deadline' && after.run.status === 'done' && (await page.locator('#unlock-dialog[open]').count()) === 0, JSON.stringify(after));
  await page.close();
}

// A6：刷新前跨截止时间与后台补结算各一条；重载不重复累计。
for (const route of ['reload', 'background']) {
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 1, breakMinutes: 5 }, progress: aProgress(49, 3), run: aRun(1, 'focus', `A6-${route}`) }), { extraInit: `${A_FROZEN}
    if (!sessionStorage.getItem('A6-armed')) {
      const s = JSON.parse(localStorage.getItem('wmf:v1:formal'));
      s.run.deadline = Date.now() + 60000;
      localStorage.setItem('wmf:v1:formal', JSON.stringify(s));
      sessionStorage.setItem('A6-armed', 'true');
    }
    window.__advance(Number(sessionStorage.getItem('A6-offset') || 0));` });
  await aAdvance(page, 59000);
  ok(`A6 ${route} 到期前累计不变`, (await state(page)).progress.focusMinutes === 49 && (await state(page)).run.status === 'running');
  if (route === 'reload') {
    await page.evaluate(() => sessionStorage.setItem('A6-offset', '61000'));
    await aReload(page);
  } else {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.__advance(2000);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(350);
  }
  let s = await state(page);
  ok(`A6 ${route} 跨门槛只结算一次`, s.progress.focusMinutes === 50 && s.progress.completedRounds === 4 && s.progress.lastSettledRoundId === `A6-${route}` && s.progress.viewEra === 'tang', JSON.stringify(s.progress));
  await aReload(page);
  s = await state(page);
  await browseScene(page);
  ok(`A6 ${route} 已结算刷新保留开放不庆祝`, s.progress.focusMinutes === 50 && s.progress.completedRounds === 4 && (await page.locator('#unlock-dialog[open]').count()) === 0 && !(await page.locator('.node[data-node="tang"]').isDisabled()) && (await page.evaluate(() => window.__osc)) === 0);
  await page.close();
}

// A7：非完成动作全部不增加累计；暂停时取消重置也不能意外恢复。
{
  const page = await newPage(browser, baseSeed({ progress: aProgress(49, 8), run: aRun(25) }), { extraInit: A_FROZEN });
  const baseline = (await state(page)).progress;
  await page.click('#home-pause');
  await aAdvance(page, 30 * 60000);
  await page.click('#home-reset');
  ok('A7 暂停重置确认取消文字', (await page.textContent('[data-action="cancel-reset"]')).trim() === '取消');
  await page.click('[data-action="cancel-reset"]');
  ok('A7 取消后仍是同一暂停轮', (await state(page)).run.status === 'paused' && (await state(page)).run.roundId === 'acceptance-run');
  await browseScene(page);
  await aHome(page);
  if ((await page.getAttribute('body', 'data-dial')) !== 'far') await page.click('#dial-view-btn');
  await page.waitForSelector('body[data-view="home"][data-dial="far"]');
  await page.waitForTimeout(1100);
  const c = await dialCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 80, c.y + 15, { steps: 8 });
  await page.mouse.up();
  ok('A7 拖拽时钟不切换视角或进入场景', (await page.getAttribute('body', 'data-view')) === 'home' && (await page.getAttribute('body', 'data-dial')) === 'far');
  await page.click('#home-reset');
  await page.click('[data-action="confirm-reset"]');
  ok('A7 暂停/取消/导航/拖拽/重置均不增累计或开放', aSameProgress((await state(page)).progress, baseline) && (await state(page)).run.status === 'idle' && (await page.locator('#unlock-dialog[open]').count()) === 0);
  await page.close();
  for (const status of ['running', 'paused']) {
    const run = aRun(5, 'break', `A7-${status}`);
    if (status === 'paused') Object.assign(run, { status, deadline: null, remainingMs: 180000 });
    const p = await newPage(browser, baseSeed({ progress: aProgress(49, 8), run }), { extraInit: A_FROZEN });
    const before = (await state(p)).progress;
    await p.click('#home-reset');
    ok(`A7 ${status} 结束休息无需确认不加进度`, (await state(p)).run.status === 'idle' && aSameProgress((await state(p)).progress, before) && (await p.locator('#confirm-dialog[open]').count()) === 0 && (await p.textContent('#era-caption')) === '休息已结束');
    await p.close();
  }
}

// A8：确认进入演示与正式到期重合；刻意让正式转场回调排在切模式之后。
{
  const seed = baseSeed({ settings: { focusMinutes: 1, breakMinutes: 7 }, progress: aProgress(49, 3), run: aRun(1, 'focus', 'A8-formal') });
  const page = await newPage(browser, seed, { extraInit: A_FROZEN });
  await browseScene(page);
  await aWatchUnlocks(page);
  // 从场景触发设置处理器，以覆盖已排队的场景转场（不依赖隐藏按钮的点击命中区）。
  await page.evaluate(() => document.getElementById('settings-btn').click());
  await page.click('#demo-enter-btn');
  await page.waitForSelector('#demo-confirm-dialog[open]');
  await page.evaluate(() => {
    window.__advance(61000);
    document.querySelector('[data-action="pause"]').click(); // 先结算并排队正式转场。
    document.querySelector('[data-action="demo-confirm"]').click(); // 同一任务中切换，迟到回调必须失效。
  });
  await page.waitForTimeout(1800);
  const formal = await state(page);
  ok('A8 正式到期先结算且原设置完整', formal.progress.focusMinutes === 50 && formal.progress.completedRounds === 4 && formal.progress.viewEra === 'tang' && formal.progress.lastSettledRoundId === 'A8-formal' && formal.settings.focusMinutes === 1 && formal.settings.breakMinutes === 7 && formal.run.status === 'done', JSON.stringify(formal));
  const demo = await page.evaluate(() => ({ on: document.body.dataset.demo, theme: document.body.dataset.theme, aria: document.getElementById('scene-canvas').getAttribute('aria-label'), cards: window.__unlockTitles }));
  ok('A8 过期正式转场不能污染演示石器或弹卡', demo.on === 'true' && demo.theme === 'stone' && demo.aria.includes('石器') && demo.cards.length === 0 && (await page.locator('.node:not(:disabled)').count()) === 1, JSON.stringify(demo));
  for (let i = 1; i <= 2; i += 1) {
    await page.click(i === 1 ? '[data-action="start"]' : '[data-action="start-next"]');
    await aAdvance(page, 15000);
    await page.waitForSelector('#unlock-dialog[open]');
    ok(`A8 演示第 ${i} 轮按轮数开放`, (await page.textContent('#unlock-title')) === A_NAMES[i] && (await page.locator('.node:not(:disabled)').count()) === i + 1 && JSON.stringify((await state(page)).progress) === JSON.stringify(formal.progress));
    await m2CloseUnlock(page);
  }
  await aHome(page);
  await aAdvance(page, 4000);
  ok('A8 演示常态使用轮数不使用正式分钟', (await page.textContent('#era-caption')) === '蒸汽城镇 · 演示 · 完成 3 轮解锁信息时代');
  await page.click('#settings-btn');
  await page.click('#demo-exit-btn');
  await aAdvance(page, 5000);
  await page.waitForTimeout(1000);
  ok('A8 退出演示后过期反馈/回调不重放', (await page.evaluate(() => document.body.dataset.demo)) === 'false' && (await page.textContent('#era-caption')) === '盛唐田园 · 距解锁蒸汽城镇还差 50 分钟' && JSON.stringify((await state(page)).progress) === JSON.stringify(formal.progress) && (await page.locator('#unlock-dialog[open]').count()) === 0 && (await page.evaluate(() => window.__unlockTitles.join('|'))) === '盛唐田园|蒸汽城镇');
  await page.close();
}

// A9 / A10：只拒绝一次正式 setItem。失败后立即恢复，而非持续失败掩盖二次保存。
async function aFailNextSave(page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__formalWrites = [];
    window.__failuresLeft = 1;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'wmf:v1:formal') {
        const s = JSON.parse(value);
        const failed = window.__failuresLeft > 0;
        window.__formalWrites.push({ failed, status: s.run.status, roundId: s.run.roundId, minutes: s.settings.focusMinutes });
        if (failed) { window.__failuresLeft -= 1; throw new Error('one-shot quota'); }
      }
      return original.call(this, key, value);
    };
  });
}
for (const intent of ['direct', 'tab']) {
  const page = await newPage(browser, baseSeed());
  const initial = (await state(page)).run;
  await aFailNextSave(page);
  await page.fill('#home-minutes', '40');
  if (intent === 'direct') await page.click('#home-start');
  else await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
  const label = intent === 'direct' ? 'A9' : 'A10';
  let s = await state(page);
  const error = await page.textContent('#home-error');
  const writes = await page.evaluate(() => window.__formalWrites);
  ok(`${label} 一次性失败保留 40 草稿和错误且没有新轮`, (await page.evaluate(() => document.body.dataset.view)) === 'home' && (await page.inputValue('#home-minutes')) === '40' && (await page.locator('#home-error').isVisible()) && error === '本地保存失败，请重试' && s.settings.focusMinutes === 25 && JSON.stringify(s.run) === JSON.stringify(initial) && writes.length === 1 && writes[0].failed, JSON.stringify({ error, writes, run: s.run }));
  await page.click('#home-start'); // 新的 pointerdown；Tab 后也不得吞掉这次独立意图。
  await waitForHomeNear(page);
  s = await state(page);
  const committed = await page.evaluate(() => window.__formalWrites.filter((w) => !w.failed && w.status === 'running').map((w) => w.roundId));
  ok(`${label} 独立重试仅建一个 40 分钟轮`, s.settings.focusMinutes === 40 && s.run.durationMs === 2400000 && s.run.status === 'running' && s.run.roundId !== initial.roundId && committed.length > 0 && new Set(committed).size === 1 && committed[0] === s.run.roundId && s.progress.completedRounds === 0 && s.progress.focusMinutes === 0, JSON.stringify({ run: s.run, committed }));
  await page.close();
}

// A11：静音不影响反馈；精确 4 秒，往返首页/场景不得重新计时。
const aAudioSeed = (muted, volume = 0.6) => `localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: true, muted: ${muted}, volume: ${volume}, ambienceId: null, followDefault: true }));`;
for (const kind of ['focus', 'natural-break', 'manual-break']) {
  const focus = kind === 'focus';
  const page = await newPage(browser, baseSeed({ progress: aProgress(focus ? 0 : 25, focus ? 0 : 1), run: aRun(focus ? 25 : 5, focus ? 'focus' : 'break', `A11-${kind}`) }), { extraInit: A_FROZEN + aAudioSeed(true) });
  const before = await state(page);
  if (kind === 'manual-break') await page.click('#home-reset');
  else await aAdvance(page, (focus ? 25 : 5) * 60000 + 1000);
  const text = focus ? '专注完成 · +25 分钟' : kind === 'natural-break' ? '休息结束 · 可以开始专注' : '休息已结束';
  ok(`A11 ${kind} 静音反馈和立即可用主控件`, (await page.textContent('#era-caption')) === text && (await page.textContent('#home-start')) === '开始专注' && (await page.locator('#home-minutes').isVisible()) && (await page.evaluate(() => window.__osc)) === 0);
  const s = await state(page);
  ok(`A11 ${kind} 只在专注到期累计`, s.progress.focusMinutes === 25 && s.progress.completedRounds === 1 && s.run.status === (focus ? 'done' : 'idle') && (focus || s.progress.lastSettledRoundId === before.progress.lastSettledRoundId), JSON.stringify(s));
  await aAdvance(page, 2000);
  await browseScene(page);
  ok(`A11 ${kind} 场景共享同一反馈`, (await page.textContent('#scene-hint-text')) === text);
  await aAdvance(page, 1500);
  await aHome(page);
  await aAdvance(page, 499);
  ok(`A11 ${kind} 3999ms 往返仍可见`, (await page.textContent('#era-caption')) === text);
  await aAdvance(page, 1);
  ok(`A11 ${kind} 4000ms 恢复常态而非重置时长`, (await page.textContent('#era-caption')) === '石器聚落 · 距解锁盛唐田园还差 25 分钟' && (await page.evaluate(() => window.__osc)) === 0);
  await page.close();
}
{
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 40, breakMinutes: 5 }, run: aRun(25) }), { extraInit: A_FROZEN });
  await aAdvance(page, 25 * 60000 + 1000);
  ok('A11 累计使用锁定的 25 分钟而非已改设置 40', (await state(page)).progress.focusMinutes === 25 && (await page.textContent('#era-caption')) === '专注完成 · +25 分钟');
  await page.click('#home-start');
  await waitForHomeNear(page);
  ok('A11 首页开始新轮立即清除上一轮反馈', !(await page.textContent('#era-caption')).includes('专注完成'));
  await browseScene(page);
  ok('A11 开始新轮立即清除上一轮反馈并使用新时长', (await state(page)).run.status === 'running' && (await state(page)).run.durationMs === 2400000 && !(await page.textContent('#scene-hint-text')).includes('专注完成'));
  await page.close();
}
{
  const page = await newPage(browser, baseSeed({ progress: aProgress(49, 1) }), { extraInit: A_FROZEN });
  await m2EnterDemo(page);
  await enterScene(page);
  await aWatchUnlocks(page);
  await aAdvance(page, 15000);
  await page.waitForSelector('#unlock-dialog[open]');
  await m2CloseUnlock(page);
  await aHome(page);
  ok('A11 退出演示前反馈尚未过期', (await page.textContent('#era-caption')) === '演示 · 盛唐田园已解锁');
  await page.click('#settings-btn');
  await page.click('#demo-exit-btn');
  const normal = '石器聚落 · 距解锁盛唐田园还差 1 分钟';
  ok('A11 退出演示立即清除所属演示的反馈', (await page.textContent('#era-caption')) === normal && (await state(page)).progress.focusMinutes === 49);
  await aAdvance(page, 5000);
  await page.waitForTimeout(1000);
  await browseScene(page);
  ok('A11 退出演示后过期回调不能改画面/弹卡/重置文案', (await page.textContent('#scene-hint-text')) === normal && (await page.evaluate(() => document.body.dataset.theme)) === 'stone' && (await page.locator('.node[data-node="tang"]').isDisabled()) && (await page.locator('#unlock-dialog[open]').count()) === 0 && (await page.evaluate(() => window.__unlockTitles.length)) === 1);
  await page.close();
}

async function aEnableAudio(page) {
  await page.waitForFunction(() => document.getElementById('home-sound-btn').getAttribute('aria-label') !== '声音加载中');
  if ((await page.locator('#home-sound-btn').getAttribute('aria-label')) !== '静音') await page.click('#home-sound-btn');
  await page.waitForFunction(() => document.getElementById('home-sound-btn').getAttribute('aria-label') === '静音');
}

// A12：自然休息到期只响一组双音，主动结束、切换视图、刷新不补响。
{
  const page = await newPage(browser, baseSeed({ progress: aProgress(25, 1), run: aRun(1, 'break', 'A12-break') }), { extraInit: A_FROZEN + aAudioSeed(false) });
  await aEnableAudio(page);
  ok('A12 音频已可播放', (await page.locator('#home-sound-btn').getAttribute('aria-label')) === '静音');
  const before = await state(page);
  const tones = await page.evaluate(() => window.__osc);
  await aAdvance(page, 61000);
  ok('A12 自然休息到期恰好一组双音', (await page.evaluate(() => window.__osc)) === tones + 2 && (await page.textContent('#era-caption')) === '休息结束 · 可以开始专注');
  await browseScene(page);
  await aHome(page);
  await aAdvance(page, 10000);
  const s = await state(page);
  ok('A12 导航/重复 tick 不重响不加分钟轮数', (await page.evaluate(() => window.__osc)) === tones + 2 && s.run.status === 'idle' && aSameProgress(s.progress, before.progress));
  await aReload(page);
  await aEnableAudio(page);
  ok('A12 已结束休息刷新不补播', (await page.evaluate(() => window.__osc)) === 0 && (await state(page)).run.status === 'idle' && aSameProgress((await state(page)).progress, before.progress));
  await page.close();
}
for (const status of ['running', 'paused']) {
  const run = aRun(5, 'break', 'A12-manual');
  if (status === 'paused') Object.assign(run, { status, deadline: null, remainingMs: 120000 });
  const page = await newPage(browser, baseSeed({ run }), { extraInit: A_FROZEN + aAudioSeed(false) });
  await aEnableAudio(page);
  const before = await page.evaluate(() => window.__osc);
  await page.click('#home-reset');
  await aAdvance(page, 360000);
  ok(`A12 开声音主动结束 ${status} 也永不补音`, (await page.evaluate(() => window.__osc)) === before && (await state(page)).run.status === 'idle');
  await page.close();
}
for (const restriction of ['zero-volume', 'blocked']) {
  const block = restriction === 'blocked' ? `const AC = window.AudioContext || window.webkitAudioContext; AC.prototype.resume = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));` : '';
  const page = await newPage(browser, baseSeed({ run: aRun(1, 'break') }), { extraInit: A_FROZEN + aAudioSeed(false, restriction === 'zero-volume' ? 0 : 0.6) + block });
  await page.click('#clock');
  await page.waitForTimeout(600);
  await aAdvance(page, 61000);
  ok(`A12 ${restriction} 禁止提示音但不丢文字`, (await page.evaluate(() => window.__osc)) === 0 && (await page.textContent('#era-caption')) === '休息结束 · 可以开始专注');
  await page.close();
}

// A13：逐门槛逐入口，故意使用不成比例的轮数，不能被轮数旁路放行。
const aBackgrounds = new Map();
for (const [minutes, era] of [[0, 'stone'], [50, 'tang'], [100, 'steam']]) {
  const page = await newPage(browser, baseSeed({ progress: aProgress(minutes, 0, era) }));
  await page.waitForTimeout(650);
  aBackgrounds.set(era, await aBackground(page));
  await page.close();
}
ok('A13 三种时代背景确实不同', new Set(aBackgrounds.values()).size === 3);
for (const minutes of [0, 49, 50, 99, 100]) {
  const expected = A_ERAS.slice(0, minutes < 50 ? 1 : minutes < 100 ? 2 : 3);
  const highest = expected.at(-1);
  const page = await newPage(browser, baseSeed({ progress: aProgress(minutes, 12, 'steam') }), { extraInit: A_FROZEN });
  await page.waitForTimeout(650);
  const home = await page.evaluate(() => ({ theme: document.body.dataset.theme, dial: document.getElementById('dial-canvas').getAttribute('aria-label'), caption: document.getElementById('era-caption').textContent }));
  ok(`A13 ${minutes} 首页主题/说明门禁`, home.theme === highest && home.caption.startsWith(A_NAMES[A_ERAS.indexOf(highest)]), JSON.stringify(home));
  ok(`A13 ${minutes} 时钟 aria 独立于时代`, home.dial.includes('宇宙时钟') && !A_NAMES.some((name) => home.dial.includes(name)), home.dial);
  ok(`A13 ${minutes} 背景使用同一开放集合`, (await aBackground(page)) === aBackgrounds.get(highest));
  await browseScene(page);
  await aGates(page, expected, `A13 ${minutes}`, Math.min(minutes, 100));
  await browseScene(page);
  for (const era of expected) {
    await page.click(`.node[data-node="${era}"]`);
    await page.waitForTimeout(850);
    ok(`A13 ${minutes} 回看 ${era} 的场景/背景`, (await page.evaluate(() => document.body.dataset.theme)) === era && (await page.locator('#scene-canvas').getAttribute('aria-label')).includes(A_NAMES[A_ERAS.indexOf(era)]) && (await aBackground(page)) === aBackgrounds.get(era));
  }
  await page.click('.node[data-node="stone"]');
  await page.waitForTimeout(850);
  const hint = await page.textContent('#scene-hint-text');
  const globalGoal = minutes < 50 ? `距解锁盛唐田园还差 ${50 - minutes} 分钟` : minutes < 100 ? `距解锁蒸汽城镇还差 ${100 - minutes} 分钟` : '距解锁信息时代还差 50 分钟';
  ok(`A13 ${minutes} 回看石器仍显示全局下一门槛`, hint === `石器聚落 · ${globalGoal}`, hint);
  await aHome(page);
  ok(`A13 ${minutes} 首页回看同步全局目标`, (await page.textContent('#era-caption')) === `石器聚落 · ${globalGoal}`);
  await page.close();
}
{
  const done = baseSeed({ progress: { ...aProgress(100, 4, 'stone'), lastSettledRoundId: 'A13-done' }, run: { mode: 'focus', status: 'done', durationMs: 1500000, deadline: null, remainingMs: 0, roundId: 'A13-done', completion: { unlockedEra: 'steam', at: Date.now() } } });
  for (const action of ['#home-start', '#home-break']) {
    const page = await newPage(browser, done, { extraInit: A_FROZEN });
    ok(`A13 旧三代开放后回看石器 ${action} 入口仍可用`, (await page.locator('#home-minutes').isVisible()) && (await page.locator('#home-break').isVisible()));
    await page.click(action);
    await waitForHomeNear(page);
    const s = await state(page);
    ok(`A13 旧三代开放后回看可开始 ${action}`, s.run.status === 'running' && s.run.mode === (action === '#home-start' ? 'focus' : 'break') && s.progress.focusMinutes === 100 && s.progress.completedRounds === 4);
    await page.close();
  }
}

// A14：实际长反馈/一次保存失败/休息反馈的布局，不用手工塞文案替代结算。
for (const [width, height] of [[1017, 555], [320, 568]]) {
  for (const kind of ['double-unlock', 'save-error', 'natural-break', 'manual-break']) {
    const run = kind === 'double-unlock' ? aRun(100) : kind.endsWith('break') ? aRun(5, 'break') : null;
    const page = await newPage(browser, baseSeed(run ? { run } : {}), { viewport: { width, height }, extraInit: A_FROZEN });
    if (kind === 'save-error') {
      await aFailNextSave(page);
      await page.fill('#home-minutes', '40');
      await page.click('#home-start');
    } else if (kind === 'manual-break') await page.click('#home-reset');
    else await aAdvance(page, (kind === 'double-unlock' ? 100 : 5) * 60000 + 1000);
    await page.waitForTimeout(400);
    const expected = kind === 'double-unlock' ? '盛唐田园、蒸汽城镇已解锁' : kind === 'natural-break' ? '休息结束 · 可以开始专注' : kind === 'manual-break' ? '休息已结束' : '本地保存失败，请重试';
    ok(`A14 ${width}x${height} ${kind} 真实反馈`, (await page.textContent(kind === 'save-error' ? '#home-error' : '#era-caption')) === expected);
    const m = await page.evaluate(() => {
      const dial = document.getElementById('dial-canvas');
      // 全景是真实投影包围框，横纵半径不同，不能再用球体 outer。
      const cx = +dial.dataset.cx, cy = +dial.dataset.cy, rx = +dial.dataset.rx, ry = +dial.dataset.ry;
      const cap = document.getElementById('era-caption');
      const cb = cap.getBoundingClientRect();
      const control = document.getElementById('home-control').getBoundingClientRect();
      const visible = ['home-control', 'era-caption', 'home-error', 'home-break', 'dial-view-btn', 'civilization-entry'].map((id) => document.getElementById(id)).filter((n) => !n.hidden);
      return {
        dialFits: rx > 0 && ry > 0 && cx - rx >= 0 && cy - ry >= 0 && cx + rx <= innerWidth && cy + ry <= innerHeight,
        gap: cb.top - cy - ry, controlGap: control.top - cb.bottom,
        allFit: visible.every((n) => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }),
        captionUnclipped: cap.scrollWidth <= cap.clientWidth && cap.scrollHeight <= cap.clientHeight,
        noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight
      };
    });
    ok(`A14 ${width}x${height} ${kind} 时钟投影/说明/控件完整无滚动`, m.dialFits && m.gap + DIAL_PROJECTION_EPSILON >= 16 && m.controlGap >= 10 && m.controlGap <= 14 && m.allFit && m.captionUnclipped && m.noScroll, JSON.stringify(m));
    await page.close();
  }
}

for (const route of ['entry', 'browse']) {
  const seed = baseSeed({
    progress: aProgress(route === 'entry' ? 0 : 75, route === 'entry' ? 0 : 3, route === 'entry' ? 'stone' : 'tang'),
    run: { ...aRun(route === 'entry' ? 100 : 25, 'focus', `reveal-${route}`), deadline: Date.now() + 60000 }
  });
  const page = await newPage(browser, seed, { extraInit: A_FROZEN });
  await aWatchUnlocks(page);
  if (route === 'entry') {
    // 不调用 browseScene 的转场等待：刻意在文明入口揭幕期间触发到期。
    await page.click('#civilization-entry');
    await page.waitForFunction(() => document.body.dataset.view === 'scene' && document.getElementById('fx-canvas').classList.contains('is-active'));
  } else {
    await browseScene(page);
    await page.click('.node[data-node="stone"]');
    await page.waitForFunction(() => document.body.dataset.theme === 'stone' && document.getElementById('fx-canvas').classList.contains('is-active'));
  }
  const revealing = await page.locator('#fx-canvas').evaluate((n) => n.classList.contains('is-active'));
  await page.evaluate(() => {
    window.__advance(61000);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForSelector('#unlock-dialog[open]');
  const s = await state(page);
  ok(`A6 ${route} 揭幕期间到期后同步地图/按钮/单次卡片`, revealing && s.progress.focusMinutes === 100 && s.run.status === 'done' && (await page.getAttribute('body', 'data-theme')) === 'steam' && (await page.getAttribute('#scene-canvas', 'aria-label')).includes('蒸汽城镇') && (await page.textContent('#plaque-status')) === '— 本轮完成 —' && (await page.locator('[data-action="start-next"]').isVisible()) && (await page.evaluate(() => window.__unlockTitles.length)) === 1, JSON.stringify(s));
  await page.close();
}

await browser.close();

/* ---------- WebGL 降级 ---------- */
{
  const b2 = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-webgl', '--disable-webgl2'] });
  const page = await newPage(b2, baseSeed());
  const fb = await page.evaluate(() => !document.getElementById('dial-fallback').hidden);
  ok('42 WebGL 禁用显示降级按钮', fb);
  if (fb) {
    await page.click('#dial-fallback');
    await page.waitForSelector('body[data-view="scene"]');
    await page.waitForTimeout(600);
    ok('42b 降级按钮仅浏览保持待开始', (await state(page)).run.status === 'idle');
    await page.click('[data-action="start"]');
    ok('42c 降级场景内可开始计时', (await state(page)).run.status === 'running');
    await page.click('[data-action="back-home"]');
    await page.waitForTimeout(1600);
    const fbLayout = await page.evaluate(() => {
      const f = document.getElementById('dial-fallback').getBoundingClientRect();
      const cap = document.getElementById('era-caption').getBoundingClientRect();
      return { gap: cap.top - f.bottom, inVp: f.top >= 0 && f.left >= 0 && f.right <= window.innerWidth && f.bottom <= window.innerHeight };
    });
    ok('42d 降级按钮位于说明上方留白内', fbLayout.gap >= 16 && fbLayout.inVp, JSON.stringify(fbLayout));
    await page.mouse.click(20, 300);
    await page.waitForTimeout(300);
    ok('42e 空白点击不进入场景', (await page.evaluate(() => document.body.dataset.view)) === 'home');
  }
  await b2.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log('失败项：' + failures.join('；'));
process.exit(fail ? 1 : 0);