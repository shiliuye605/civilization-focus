import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultState } from '../src/store.js';

const URL = process.env.CLOCK_VERIFY_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = path.resolve('docs/screenshots');
const KEY = 'wmf:v1:formal';
let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  console.log(`PASS ${++passed} ${label}`);
}
const equal = (a, b, epsilon = 0.00001) => Math.abs(a - b) < epsilon;
const sameVector = (a, b) => a.every((n, i) => equal(n, b[i]));
const state = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);

async function open(browser, { width = 1440, height = 900, reduced = false, failure = false, controlled = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width <= 640, hasTouch: width <= 640, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.addInitScript(({ seed, controlled }) => {
    if (!localStorage.getItem('wmf:v1:formal')) localStorage.setItem('wmf:v1:formal', JSON.stringify(seed));
    localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null }));
    if (controlled) {
      window.__now = Number(sessionStorage.getItem('clock-test-now')) || 1900000000000;
      Date.now = () => window.__now;
    }
  }, { seed: defaultState(), controlled });
  await page.route('**/src/dial.js*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes('renderer.render(scene, camera);'), 'dev renderer instrumentation available');
    await route.fulfill({ response, body: source.replace('renderer.render(scene, camera);', 'window.__dialTest = { camera, clock, focusHand, secondsHand, civilizationMount, renderer, arc, progress, target: target.clone(), renderedAt: now }; window.__logDialFrame?.(progress, run.status); renderer.render(scene, camera);') });
  });
  if (failure) await page.route('**/*.glb', (route) => route.abort());
  await page.goto(URL);
  await page.waitForSelector('body[data-app-ready="true"]');
  await page.waitForFunction(() => document.querySelector('#dial-canvas').dataset.ready === 'true' || !document.querySelector('#dial-fallback').hidden);
  if (!failure) await page.waitForFunction(() => document.querySelector('#dial-canvas').dataset.civilizationStatus === 'ready' || !document.querySelector('#dial-fallback').hidden);
  return page;
}

async function advance(page, ms) {
  await page.evaluate((ms) => {
    window.__now += ms;
    sessionStorage.setItem('clock-test-now', String(window.__now));
    document.dispatchEvent(new Event('visibilitychange'));
  }, ms);
  await page.waitForTimeout(80);
}

async function view(page, near) {
  if ((await page.getAttribute('body', 'data-dial')) !== (near ? 'near' : 'far')) await page.click('#dial-view-btn');
  await page.waitForFunction((z) => window.__dialTest?.progress === z, near ? 1 : 0);
}

async function probe(page) {
  return page.evaluate(() => {
    const d = window.__dialTest;
    d.camera.updateMatrixWorld(true);
    const p = d.camera.position.clone();
    const relative = d.focusHand.worldToLocal(p.clone()).toArray();
    const target = d.focusHand.worldToLocal(d.target.clone()).toArray();
    function project(point) {
      const v = point.clone().project(d.camera);
      return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2];
    }
    function bounds(root) {
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      root.traverse((mesh) => {
        const attribute = mesh.geometry?.getAttribute('position');
        if (!attribute) return;
        for (let i = 0; i < attribute.count; i += 1) {
          const point = p.clone().fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld);
          const [x, y] = project(point);
          l = Math.min(l, x); r = Math.max(r, x);
          t = Math.min(t, y); b = Math.max(b, y);
        }
      });
      return { l, r, t, b };
    }
    const pivot = project(d.focusHand.localToWorld(p.clone().set(0, 0.25, 0)));
    const tip = project(d.focusHand.localToWorld(p.clone().set(3.22, 0.25, 0)));
    const mark = project(p.clone().set(3.0, 0.03, 0));
    const logo = document.querySelector('#home-logo').getBoundingClientRect();
    const bar = document.querySelector('#dial-bar').getBoundingClientRect();
    const caption = document.querySelector('#era-caption').getBoundingClientRect();
    const dock = document.querySelector('#home-dock').getBoundingClientRect();
    const controls = document.querySelector('#home-control').getBoundingClientRect();
    const run = JSON.parse(localStorage.getItem('wmf:v1:formal')).run;
    const remaining = run.status === 'running' ? Math.max(0, run.deadline - d.renderedAt) : run.status === 'paused' ? run.remainingMs : run.status === 'done' ? 0 : run.durationMs;
    const arc = d.arc.mesh.geometry;
    const positions = arc.attributes.position;
    const last = arc.drawRange.count / 3;
    return {
      angle: d.focusHand.rotation.y, seconds: d.secondsHand.rotation.y,
      secondsHeading: p.clone().set(1, 0, 0).applyQuaternion(d.secondsHand.quaternion).toArray(),
      hour: d.clock.getObjectByName('HourHandPivot').rotation.y,
      wheel: d.clock.getObjectByName('BarrelWheel').quaternion.toArray(),
      pinion: d.clock.getObjectByName('TransferWheel').quaternion.toArray(),
      balance: d.clock.getObjectByName('BalanceWheel').quaternion.toArray(),
      arcAngles: last > 0 ? [0, last].map(i => Math.atan2(-positions.getZ(i), positions.getX(i))) : [],
      relative, target, up: d.camera.up.toArray(), pivot, tip, mark,
      mountChildren: d.civilizationMount.children.length, mountParent: d.civilizationMount.parent.name,
      full: bounds(d.clock), settlement: bounds(d.civilizationMount),
      run, remaining, count: document.querySelector('#dial-count').textContent,
      width: innerWidth, height: innerHeight, logoLoaded: document.querySelector('#home-logo').naturalWidth > 0,
      logoBottom: logo.bottom, barBottom: bar.bottom, captionTop: caption.top, dockTop: dock.top,
      controlsFit: controls.left >= 0 && controls.right <= innerWidth && controls.bottom <= innerHeight,
      noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight
    };
  });
}

function fits(box, width, height) {
  return box.l >= -1 && box.r <= width + 1 && box.t >= -1 && box.b <= height + 1;
}
function poseMatches(s) {
  const elapsed = Math.min(s.run.durationMs, Math.max(0, s.run.durationMs - s.remaining));
  const origin = s.run.dialOriginSeconds ?? 0;
  return equal(s.angle, Math.PI / 2 - Math.PI / 30 * ((origin % 3600) + elapsed / 1000) / 60)
    && equal(s.seconds, Math.PI / 2 - Math.PI / 30 * ((origin % 60) + elapsed / 1000))
    && equal(s.hour, Math.PI / 2 - Math.PI * 2 * ((origin + elapsed / 1000) % 43200) / 43200);
}
const sameAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.00001;
const sameHands = (a, b) => ['angle', 'seconds', 'hour'].every(key => sameAngle(a[key], b[key]));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone'], [320, 568, 'small-phone']]) {
    const page = await open(browser, { width, height });
    await page.waitForTimeout(850);
    let s = await probe(page);
    check(`${label} 全景完整、logo、控件不遮挡且无滚动`, fits(s.full, width, height) && s.full.t > s.barBottom && s.full.b < s.captionTop - 15 && s.logoLoaded && s.controlsFit && s.noScroll);
    check(`${label} 默认25/5且文明挂在指针台面`, s.run.durationMs === 1500000 && (await state(page)).settings.breakMinutes === 5 && s.mountChildren === 1 && s.mountParent === 'FocusHandPivot');
    await advance(page, 3250);
    const idle = await probe(page);
    const localSecond = await page.evaluate(() => {
      const now = new Date(Date.now());
      return now.getSeconds() + now.getMilliseconds() / 1000;
    });
    const yaw = Math.PI / 2 - localSecond * Math.PI / 30;
    check(`${label} 待机秒针实体在正确的刻度方向`, sameVector(idle.secondsHeading, [Math.cos(yaw), 0, -Math.sin(yaw)]));
    check(`${label} 待机时三针、传动齿轮和摆轮一起走动`, idle.angle !== s.angle && idle.hour !== s.hour && idle.seconds !== s.seconds && !sameVector(idle.wheel, s.wheel) && !sameVector(idle.pinion, s.pinion) && !sameVector(idle.balance, s.balance));
    if (label !== 'small-phone') await page.screenshot({ path: path.join(SHOTS, `clock-${label}-panorama.png`) });
    await page.mouse.click(8, Math.min(height - 150, 230));
    check(`${label} 空白点击不拉近`, await page.getAttribute('body', 'data-dial') === 'far');
    const center = await page.locator('#dial-canvas').evaluate((c) => ({ x: Number(c.dataset.cx), y: Number(c.dataset.cy) }));
    if (width <= 640) await page.touchscreen.tap(center.x, center.y);
    else await page.mouse.click(center.x, center.y);
    await page.waitForFunction(() => { const z = Number(document.querySelector('#dial-canvas').dataset.zoom); return z > 0 && z < 1; });
    check(`${label} 推近有平滑中间帧`, await page.getAttribute('body', 'data-dial') === 'near');
    await view(page, true);
    check(`${label} 点击钟面只变视角不开始`, (await state(page)).run.status === 'idle' && await page.getAttribute('body', 'data-view') === 'home');
    s = await probe(page);
    check(`${label} 聚落放大、完整入镜且指针朝右`, fits(s.settlement, width, height) && s.pivot[0] < s.tip[0] && s.settlement.r - s.settlement.l > width * .61 && s.settlement.t > s.barBottom && s.settlement.b < s.dockTop);
    check(`${label} 低位侧视、目标与镜头绑定且世界向上`, sameVector(s.target, [1.67, 0.43, 0]) && sameVector(s.up, [0, 1, 0]) && s.relative[1] > 0.43 && (s.relative[1] - 0.43) / (s.relative[2]) < 0.4);
    await page.click('#home-start');
    const rid = (await state(page)).run.roundId;
    check(`${label} 开始25分钟仍留在时钟近景`, (await state(page)).run.status === 'running' && await page.getAttribute('body', 'data-view') === 'home');
    const started = await probe(page);
    check(`${label} 开始时三针、机芯与近景取景连续`, sameHands(s, started) && sameVector(s.wheel, started.wheel) && sameVector(s.balance, started.balance) && sameVector(s.relative, started.relative) && sameVector(s.target, started.target) && equal(s.settlement.l, started.settlement.l));
    await advance(page, 60000);
    const first = await probe(page);
    check(`${label} 一分钟宽针顺时针6度、秒针360度、读数24:00`, poseMatches(first) && first.count === '24:00');
    check(`${label} 进度弧从起跑角度连到当前宽针`, sameAngle(first.arcAngles[0], started.angle) && sameAngle(first.arcAngles[1], first.angle));
    await advance(page, 1000);
    const second = await probe(page);
    check(`${label} 一秒秒针6度且镜头目标相对指针不变`, equal(first.seconds - second.seconds, Math.PI / 30) && sameVector(first.relative, second.relative) && sameVector(first.target, second.target));
    for (const minutes of [6, 6, 6]) {
      const before = await probe(page);
      await advance(page, minutes * 60000);
      const after = await probe(page);
      check(`${label} 累计转动${Math.round((started.angle - after.angle) * 180 / Math.PI)}度跟随不翻转、刻度掠过`, sameVector(first.relative, after.relative) && sameVector(first.target, after.target) && after.pivot[0] < after.tip[0] && fits(after.settlement, width, height) && Math.hypot(after.mark[0] - before.mark[0], after.mark[1] - before.mark[1]) > 2);
    }
    if (label !== 'small-phone') await page.screenshot({ path: path.join(SHOTS, `clock-${label}-follow.png`) });
    await page.click('#home-pause');
    const paused = await probe(page);
    await advance(page, 12750);
    s = await probe(page);
    check(`${label} 暂停指针读数均不动`, equal(paused.angle, s.angle) && equal(paused.seconds, s.seconds) && paused.count === s.count && s.run.status === 'paused');
    check(`${label} 暂停同时锁住小时盘、齿轮和摆轮`, equal(paused.hour, s.hour) && sameVector(paused.wheel, s.wheel) && sameVector(paused.balance, s.balance));
    await page.reload();
    await page.waitForSelector('#dial-canvas[data-ready="true"]');
    s = await probe(page);
    check(`${label} 暂停刷新恢复同一轮同一角度`, poseMatches(s) && s.run.roundId === rid && s.run.status === 'paused' && equal(s.seconds, paused.seconds) && s.count === paused.count);
    await page.click('#home-pause');
    await advance(page, 750);
    s = await probe(page);
    check(`${label} 继续从暂停角度前进`, poseMatches(s) && s.run.status === 'running' && equal(paused.seconds - s.seconds, Math.PI / 40));
    await page.reload();
    await page.waitForSelector('#dial-canvas[data-ready="true"]');
    s = await probe(page);
    check(`${label} 运行刷新恢复同轮读数及角度`, poseMatches(s) && s.run.roundId === rid && s.run.status === 'running');
    await view(page, true);
    await view(page, false);
    const far = await probe(page);
    await advance(page, 1250);
    s = await probe(page);
    check(`${label} 返回全景继续计时且前台校准`, s.run.roundId === rid && s.run.status === 'running' && poseMatches(s) && s.seconds < far.seconds);
    await advance(page, s.remaining);
    check(`${label} 到期仅累计25分钟一次`, (await state(page)).run.status === 'done' && (await state(page)).progress.focusMinutes === 25 && (await state(page)).progress.completedRounds === 1);
    const finished = await probe(page);
    await page.click('#home-break');
    check(`${label} 休息从上一轮结束的位置开始`, sameHands(finished, await probe(page)));
    check(`${label} 休息为5分钟且不离开时钟`, (await state(page)).run.durationMs === 300000 && (await state(page)).run.mode === 'break' && await page.getAttribute('body', 'data-view') === 'home');
    await view(page, true);
    await advance(page, 1000);
    s = await probe(page);
    check(`${label} 休息按本轮已用时间推进`, poseMatches(s) && s.count === '04:59');
    await page.click('#home-pause');
    const bp = await probe(page);
    await advance(page, 2500);
    s = await probe(page);
    check(`${label} 休息暂停停针`, equal(bp.seconds, s.seconds));
    await page.reload();
    await page.waitForSelector('#dial-canvas[data-ready="true"]');
    s = await probe(page);
    check(`${label} 休息刷新保持暂停角度`, poseMatches(s) && s.run.mode === 'break' && s.run.status === 'paused' && equal(bp.seconds, s.seconds));
    await page.click('#home-pause');
    await advance(page, 299000);
    check(`${label} 休息结束回待开始、不增加文明累计`, (await state(page)).run.status === 'idle' && (await state(page)).progress.focusMinutes === 25);
    check(`${label} 无脚本异常`, page.errors.length === 0);
    await page.close();
  }

  {
    const page = await open(browser);
    const local = await page.evaluate(() => new Date(2030, 1, 1, 20, 37, 25, 250).getTime() - Date.now());
    await advance(page, local);
    const before = await probe(page);
    await page.evaluate(() => {
      window.__dialFrames = [];
      window.__logDialFrame = (push, status) => {
        if (status !== 'running') return;
        const {focusHand, camera} = window.__dialTest;
        window.__dialFrames.push({push, angle: focusHand.rotation.y, camera: camera.position.toArray(), offset: [camera.view.offsetX, camera.view.offsetY]});
      };
    });
    const framing = await page.evaluate(() => {
      const camera = window.__dialTest.camera;
      return {camera: camera.position.toArray(), offset: [camera.view.offsetX, camera.view.offsetY]};
    });
    await page.click('#home-start');
    await view(page, true);
    const frames = await page.evaluate(() => window.__dialFrames);
    check('20:37 从全景开始时先保留宽针及原画面，再连续推近', frames.length > 2 && frames[0].push < 0.1 && frames.some(f => f.push > 0.2 && f.push < 0.8) && frames.every(f => sameAngle(f.angle, before.angle)) && Math.hypot(...frames[0].camera.map((n,i) => n - framing.camera[i])) < 0.35 && Math.hypot(...frames[0].offset.map((n,i) => n - framing.offset[i])) < 3);
    await page.close();
  }

  {
    const page = await open(browser, { reduced: true });
    await page.focus('#dial-canvas');
    await page.keyboard.press('Enter');
    await view(page, true);
    check('减少动态键盘直接切近景且不开始', (await state(page)).run.status === 'idle');
    await page.mouse.move(720, 520);
    await page.mouse.wheel(0, -390);
    await page.waitForFunction(() => window.__dialTest.camera.zoom > 1.8);
    const offset = () => page.evaluate(() => window.__dialTest.camera.view.offsetX);
    const centre = await offset();
    await page.mouse.down();
    await page.mouse.move(605, 520, { steps: 5 });
    await page.mouse.up();
    check('滚轮放大后拖动能沿聚落取景', (await offset()) > centre + 50);
    await page.focus('#dial-canvas');
    await page.keyboard.press('ArrowLeft');
    check('方向键能移回相邻街区', (await offset()) < centre + 90);
    await view(page, false);
    await view(page, true);
    check('再次近看恢复整个聚落且没有启动计时', (await page.evaluate(() => window.__dialTest.camera.zoom)) === 1 && (await state(page)).run.status === 'idle');
    const quiet = await probe(page);
    await page.click('#home-start');
    await advance(page, 7500);
    const s = await probe(page);
    check('减少动态仍精确共享实际已用时', poseMatches(s) && s.count === '24:53');
    check('减少动态保留计时且停止装饰机芯', sameVector(quiet.wheel, s.wheel) && sameVector(quiet.balance, s.balance));
    await page.click('#home-pause');
    await advance(page, 1111);
    await page.click('#home-pause');
    const resumed = await probe(page);
    check('减少动态恢复不回退', equal(s.angle, resumed.angle) && equal(s.seconds, resumed.seconds));
    await page.keyboard.press('Escape');
    await view(page, false);
    check('Escape返回全景不暂停', (await state(page)).run.status === 'running');
    await page.close();
  }

  {
    const page = await open(browser);
    await page.click('#settings-btn');
    await page.fill('#focus-minutes', '40');
    await page.fill('#break-minutes', '7');
    await page.click('#settings-form button[type="submit"]');
    await page.click('#home-start');
    await view(page, true);
    await advance(page, 60000);
    const s = await probe(page);
    check('自定义40分钟仍每分钟6度、不按轮次归一化', s.run.durationMs === 2400000 && poseMatches(s) && s.count === '39:00');
    await page.click('#settings-btn');
    await page.fill('#focus-minutes', '10');
    await page.click('#settings-form button[type="submit"]');
    check('修改时长不改变当前轮锁定时长与角度', (await state(page)).run.durationMs === 2400000 && equal((await probe(page)).angle, s.angle));
    await page.click('#civilization-entry');
    await page.waitForSelector('body[data-view="scene"]');
    await page.waitForFunction(() => !document.querySelector('#fx-canvas').classList.contains('is-active'));
    check('原文明场景独立入口保留同一计时', (await state(page)).run.status === 'running' && await page.locator('#scene-canvas').isVisible());
    await page.click('[data-action="back-home"]');
    await page.waitForSelector('body[data-view="home"]');
    await page.waitForFunction(() => !document.querySelector('#fx-canvas').classList.contains('is-active'));
    await view(page, true);
    check('从文明场景返回保留跟随与轮次', (await state(page)).run.roundId === s.run.roundId && poseMatches(await probe(page)));
    await page.close();
  }

  for (const kind of ['load-failure', 'context-loss']) {
    const page = await open(browser, { width: 390, height: 844, failure: kind === 'load-failure' });
    if (kind === 'context-loss') await page.evaluate(() => window.__dialTest.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
    await page.waitForSelector('#dial-fallback:visible');
    check(`${kind} 3D 地点及人物操作停用并显示说明`, await page.locator('#scene-select').isDisabled() && await page.locator('#life-next').isDisabled() && (await page.textContent('#place-name')) === '3D 地点暂不可用');
    await page.click('#home-start');
    await advance(page, 2000);
    check(`${kind} 仍可开始、读秒、暂停与继续`, (await state(page)).run.status === 'running' && await page.textContent('#dial-count') === '24:58');
    await page.click('#home-pause');
    await advance(page, 1000);
    check(`${kind} 暂停不丢计时`, (await state(page)).run.remainingMs === 1498000 && await page.textContent('#dial-count') === '24:58');
    await page.click('#home-pause');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('#dial-canvas').dataset.cx) - innerWidth / 2) < 1);
    const box = await page.locator('#dial-fallback').boundingBox();
    check(`${kind} 降级转屏重新布局`, box.x >= 0 && box.y >= 0 && box.x + box.width <= 844 && box.y + box.height <= 390);
    check(`${kind} 无未捕获异常`, page.errors.length === 0);
    await page.close();
  }

  {
    const page = await open(browser, { controlled: false });
    await page.click('#home-start');
    await view(page, true);
    const before = await probe(page);
    await page.waitForFunction(() => document.querySelector('#dial-count').textContent === '24:57');
    const after = await probe(page);
    check('真实时间运行3秒后读数和两针前进', after.angle < before.angle && after.seconds < before.seconds);
    await page.click('#home-pause');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const paused = await probe(page);
    await page.waitForTimeout(1150);
    const later = await probe(page);
    check('真实时间暂停超过1秒保持角度', equal(paused.seconds, later.seconds) && paused.count === later.count);
    await page.click('#home-pause');
    await page.waitForFunction((angle) => window.__dialTest.secondsHand.rotation.y < angle - 0.05, paused.seconds);
    check('真实时间继续平滑转动', (await state(page)).run.status === 'running');
    const cdp = await page.context().newCDPSession(page);
    const freezeStart = await probe(page);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await page.waitForTimeout(1600);
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await page.waitForFunction((angle) => window.__dialTest.secondsHand.rotation.y < angle - 0.15, freezeStart.seconds);
    const awake = await probe(page);
    check('浏览器实际冻结再激活后按deadline校准三针', poseMatches(awake));
    await page.close();
  }
} finally {
  await browser.close();
}

const no3d = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-webgl', '--disable-webgl2'] });
try {
  const page = await open(no3d, { width: 320, height: 568 });
  check('WebGL禁用可见降级且设置保留', await page.locator('#dial-fallback').isVisible() && await page.locator('#settings-btn').isVisible());
  await page.click('#home-start');
  await advance(page, 1000);
  check('WebGL禁用仍可计时', (await state(page)).run.status === 'running' && await page.textContent('#dial-count') === '24:59');
  await page.click('#home-pause');
  await page.reload();
  await page.waitForSelector('#dial-fallback:visible');
  check('WebGL禁用暂停刷新恢复', (await state(page)).run.status === 'paused' && await page.textContent('#dial-count') === '24:59');
  check('WebGL禁用无未捕获异常', page.errors.length === 0);
} finally {
  await no3d.close();
}
console.log(`\n${passed} clock checks passed`);
