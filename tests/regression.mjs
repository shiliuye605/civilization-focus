import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.VERIFY_URL || 'http://localhost:4173/';

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
    progress: { completedRounds: 0, focusMinutes: 0, lastSettledRoundId: null, viewEra: 'stone' },
    run: { mode: 'focus', status: 'idle', durationMs: 1500000, deadline: null, remainingMs: 1500000, roundId: null, completion: null },
    ...over
  };
}

const CLOCK_PATCH = `
  (() => {
    const real = Date.now.bind(Date);
    let off = 0;
    window.__advance = (ms) => { off += ms; };
    Date.now = () => real() + off;
    window.__osc = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !AC.prototype.__patched) {
      const orig = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function (...a) { window.__osc += 1; return orig.apply(this, a); };
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
  await page.addInitScript(([s, clock]) => {
    if (!localStorage.getItem('wmf:v1:formal')) localStorage.setItem('wmf:v1:formal', JSON.stringify(s));
    if (!localStorage.getItem('wmf:v1:audio')) localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null }));
    if (clock) eval(clock);
  }, [seed, opts.clock === false ? null : CLOCK_PATCH]);
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (opts.route) await page.route(opts.route.pattern, opts.route.handler);
  await page.goto(URL);
  await page.waitForSelector('body[data-app-ready="true"]');
  return page;
}

async function enterScene(page) {
  const globe = page.locator('#globe-canvas');
  if (await globe.isVisible()) {
    const b = await globe.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  } else {
    await page.click('#globe-fallback');
  }
  await page.waitForSelector('body[data-view="scene"]');
  await page.waitForTimeout(2100);
}

const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wmf:v1:formal')));
const prefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('wmf:v1:audio')));
const audioFetches = (page) => page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\.(ogg|m4a)$/.test(r.name)).map((r) => {
  const f = r.name.split('/').pop();
  const m = f.match(/^(forest|field|steam).*\.(ogg|m4a)$/);
  return m ? `${m[1]}.${m[2]}` : f;
}));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

/* ---------- 首页与入口 ---------- */
{
  const page = await newPage(browser, baseSeed());
  const home = await page.evaluate(() => {
    const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    return {
      globe: vis(document.getElementById('globe-canvas')),
      clock: vis(document.getElementById('clock')),
      settings: vis(document.getElementById('settings-btn')),
      fallbackHidden: document.getElementById('globe-fallback').hidden,
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      clockText: document.getElementById('clock').textContent
    };
  });
  ok('01 首页三元素且无滚动', home.globe && home.clock && home.settings && home.fallbackHidden && home.scrollW <= home.innerW && home.scrollH <= home.innerH, JSON.stringify(home));
  ok('02 时钟 HH:mm 24h', /^\d{2}:\d{2}$/.test(home.clockText), home.clockText);
  await enterScene(page);
  let s = await state(page);
  ok('03 点击地球进入场景并立即 running', s.run.status === 'running' && (await page.textContent('#plaque-status')) === '— 专注中 —');
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
  const page = await newPage(browser, baseSeed({ settings: { focusMinutes: 3, breakMinutes: 2 } }));
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
  const page = await newPage(browser, baseSeed({ progress: { completedRounds: 2, focusMinutes: 50, lastSettledRoundId: 'old', viewEra: 'steam' } }));
  await enterScene(page);
  await page.evaluate(() => window.__advance(25 * 60000 + 1000));
  await page.waitForTimeout(600);
  const s = await state(page);
  ok('17 非解锁轮不弹卡', s.progress.completedRounds === 3 && s.run.completion.unlockedEra === null && (await page.locator('#unlock-dialog[open]').count()) === 0);
  await page.reload();
  await page.waitForSelector('body[data-app-ready="true"]');
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
  await page.waitForSelector('body[data-app-ready="true"]');
  ok('19 运行中刷新回首页', (await page.evaluate(() => document.body.dataset.view)) === 'home');
  await enterScene(page);
  ok('19b 恢复同一 running 轮', (await state(page)).run.roundId === rid && (await state(page)).run.status === 'running', JSON.stringify((await state(page)).run));
  await page.click('[data-action="pause"]');
  const digits = await page.textContent('#plaque-count');
  await page.reload();
  await page.waitForSelector('body[data-app-ready="true"]');
  await enterScene(page);
  ok('20 暂停刷新保持 paused 与数字', (await state(page)).run.status === 'paused' && (await page.textContent('#plaque-count')) === digits, `${(await state(page)).run.status} ${await page.textContent('#plaque-count')} vs ${digits}`);
  await page.close();

  const legacy = await newPage(browser, { version: 1, progress: { completedRounds: 1, focusMinutes: 25, viewEra: 'tang' }, run: { mode: 'focus', status: 'idle', durationMs: 1500000, deadline: null, remainingMs: 1500000, roundId: null, completion: null } });
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
  ok('22b 默认关闭且仅 forest', off.checked === false && off.radios.join(',') === 'forest' && off.disabled === true, JSON.stringify(off));
  await page.evaluate(() => document.getElementById('sound-enabled').focus());
  await page.keyboard.press('Space');
  await page.waitForTimeout(900);
  ok('23 手势开启后请求 forest 并 playing', (await audioFetches(page)).includes('forest.ogg') && (await page.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音');
  await page.click('#sound-mute');
  ok('24 静音状态', (await prefs(page)).muted === true && (await page.textContent('#sound-status')) === '已静音。');
  await page.evaluate(() => {
    const v = document.getElementById('sound-volume');
    v.value = '30';
    v.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ok('25 拖音量取消静音并保存', (await prefs(page)).muted === false && (await prefs(page)).volume === 0.3);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('body[data-app-ready="true"]');
  ok('26 刷新 paused 无请求', (await audioFetches(page)).length === 0 && (await page.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '点击恢复声音');
  await enterScene(page);
  await page.click('#sound-btn');
  await page.waitForTimeout(900);
  ok('26b 点击恢复 playing', (await page.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-label'))) === '静音');
  await page.close();
}

/* ---------- 声音：解锁列表 / 切换 / 提示音 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { completedRounds: 1, focusMinutes: 25, lastSettledRoundId: 'x', viewEra: 'tang' } }));
  await page.click('#settings-btn');
  const list = await page.evaluate(() => [...document.querySelectorAll('#sound-list input')].map((i) => i.value));
  ok('27 一轮后列出 forest+field', list.join(',') === 'forest,field', list.join(','));
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
  const page = await newPage(browser, baseSeed({ progress: { completedRounds: 3, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'steam' } }));
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
    const page = await newPage(browser, baseSeed({ progress: { completedRounds: rounds, focusMinutes: rounds * 25, lastSettledRoundId: 'x', viewEra: era } }));
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
  const page = await newPage(browser, baseSeed({ progress: { completedRounds: 2, focusMinutes: 50, lastSettledRoundId: 'x', viewEra: 'steam' } }), { reduced: true });
  await enterScene(page);
  const shot2 = await page.evaluate(() => document.getElementById('scene-canvas').toDataURL());
  await page.waitForTimeout(700);
  const shot1b = await page.evaluate(() => document.getElementById('scene-canvas').toDataURL());
  ok('37 减少动态场景静止', shot2 === shot1b && shot2.length > 10000);
  await page.close();
}

/* ---------- 工业链路 / 门禁 ---------- */
{
  const page = await newPage(browser, baseSeed({ progress: { completedRounds: 2, focusMinutes: 50, lastSettledRoundId: 'x', viewEra: 'steam' } }));
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

  const locked = await newPage(browser, baseSeed({ progress: { completedRounds: 0, focusMinutes: 0, lastSettledRoundId: null, viewEra: 'steam' } }));
  const g = await locked.evaluate(() => ({ theme: document.body.dataset.theme }));
  await enterScene(locked);
  const tags = await locked.evaluate(() => ({
    steam: document.querySelector('.node[data-node="steam"]').disabled,
    steamTag: document.querySelector('.node[data-node="steam"] .node-tag')?.textContent,
    tangTag: document.querySelector('.node[data-node="tang"] .node-tag')?.textContent
  }));
  ok('39 0 轮门禁与 viewEra 回退', g.theme === 'stone' && tags.steam === true && tags.steamTag === '完成 2 轮解锁' && tags.tangTag === '完成 1 轮解锁', JSON.stringify(tags));
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
}

/* ---------- 移动端 ---------- */
for (const [w, h] of [[320, 568], [390, 844]]) {
  const page = await newPage(browser, baseSeed({ progress: { completedRounds: 3, focusMinutes: 75, lastSettledRoundId: 'x', viewEra: 'tang' } }), { viewport: { width: w, height: h } });
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
  await page.focus('#globe-canvas');
  await page.keyboard.press('Enter');
  await page.waitForSelector('body[data-view="scene"]');
  ok('50 键盘 Enter 进入场景', true);
  await page.waitForTimeout(2100);
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

await browser.close();

/* ---------- WebGL 降级 ---------- */
{
  const b2 = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-webgl', '--disable-webgl2'] });
  const page = await newPage(b2, baseSeed());
  const fb = await page.evaluate(() => !document.getElementById('globe-fallback').hidden);
  ok('42 WebGL 禁用显示降级按钮', fb);
  if (fb) {
    await page.click('#globe-fallback');
    await page.waitForSelector('body[data-view="scene"]');
    ok('42b 降级按钮可进入计时', (await state(page)).run.status === 'running');
  }
  await b2.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log('失败项：' + failures.join('；'));
process.exit(fail ? 1 : 0);