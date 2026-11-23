import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultState, loadState } from '../src/store.js';
import { SCENES, SCENES_BY_ERA, ERAS } from '../src/scene-catalog.mjs';
import { loadScenePrefs, SCENE_PREFS_KEY } from '../src/scene-prefs.js';

const URL = process.env.LOCATION_VERIFY_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const KEY = 'wmf:v1:formal';
const NOW = 1900000000000;
let passed = 0;
function check(name, value, detail) {
  assert.ok(value, `${name}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
  console.log(`PASS ${++passed} ${name}`);
}
const state = (p) => p.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const sleepFrames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
function seed(minutes = 150, era = 'stone') {
  const s = defaultState();
  s.progress.focusMinutes = minutes;
  s.progress.viewEra = era;
  return s;
}
function same(a, b, tolerance = 0.00001) { return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < tolerance); }

async function open(browser, { width = 1440, height = 900, initial = seed(), prefs, reduced = false, route } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.addInitScript(({ initial, prefs, key, prefKey, now }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    if (prefs && !localStorage.getItem(prefKey)) localStorage.setItem(prefKey, JSON.stringify(prefs));
    localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, volume: 0.6 }));
    window.__now = Number(sessionStorage.getItem('test-now')) || now;
    Date.now = () => window.__now;
    window.__advance = (ms) => { window.__now += ms; sessionStorage.setItem('test-now', String(window.__now)); document.dispatchEvent(new Event('visibilitychange')); };
    window.__assets = [];
    window.__flips = 0;
    new MutationObserver((records) => {
      for (const r of records) if (r.target.id === 'dial-canvas' && r.oldValue === 'false' && r.target.dataset.flipping === 'true') window.__flips++;
    }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-flipping'] });
  }, { initial, prefs, key: KEY, prefKey: SCENE_PREFS_KEY, now: NOW });
  await p.route('**/src/dial.js*', async (r) => {
    const response = await r.fetch();
    const source = await response.text();
    await r.fulfill({ response, body: source.replace('renderer.render(scene, camera);', 'window.__dial = { camera, focusHand, civilizationMount, target: target.clone() }; renderer.render(scene, camera);') });
  });
  await p.route('**/src/civilizations.js*', async (r) => {
    const response = await r.fetch();
    const source = await response.text();
    await r.fulfill({ response, body: source.replace('asset.life.seek(0);', 'asset.life.seek(0); window.__assets.push(asset);') });
  });
  if (route) await route(p);
  await p.goto(URL);
  await p.waitForSelector('#dial-canvas[data-ready="true"]');
  return p;
}
async function ready(p, id) {
  await p.waitForSelector(`#dial-canvas[data-scene="${id}"][data-civilization-status="ready"][data-flipping="false"]`);
  await sleepFrames(p);
}
async function near(p) {
  if (await p.getAttribute('body', 'data-dial') !== 'near') await p.click('#dial-view-btn');
  await p.waitForSelector('#dial-canvas[data-zoom="1.00"]');
}
async function choose(p, id) {
  const era = SCENES[id].era;
  if (await p.getAttribute('body', 'data-theme') !== era) {
    await p.click(`[data-home-era="${era}"]`);
    await p.waitForFunction(() => document.querySelector('#dial-canvas').dataset.flipping === 'false' && document.querySelector('#dial-canvas').dataset.civilizationStatus === 'ready');
  }
  await p.selectOption('#scene-select', id);
  await ready(p, id);
}
async function advance(p, ms) { await p.evaluate((ms) => window.__advance(ms), ms); await p.waitForTimeout(150); }
async function sample(p) {
  return p.evaluate(() => {
    const d = window.__dial;
    const root = d.civilizationMount.children.find((n) => n.userData.sceneId);
    const asset = window.__assets.find((a) => a.root === root);
    d.focusHand.updateMatrixWorld(true); d.camera.updateMatrixWorld(true);
    const project = (v) => { v.project(d.camera); return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2]; };
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    root?.traverse((n) => {
      if (!n.geometry) return;
      n.geometry.computeBoundingBox();
      const box = n.geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const [px, py] = project(d.camera.position.clone().set(x,y,z).applyMatrix4(n.matrixWorld));
        l = Math.min(l,px); r = Math.max(r,px); t = Math.min(t,py); b = Math.max(b,py);
      }
    });
    const posed = [];
    root?.traverse((n) => { if (n.name.includes('Resident') || n.name.includes('_Arm') || n.name.includes('_Heading')) posed.push(...n.position.toArray(), ...n.quaternion.toArray()); });
    const rect = (id) => { const b=document.getElementById(id).getBoundingClientRect(); return {l:b.left,r:b.right,t:b.top,b:b.bottom}; };
    return {
      id:root?.userData.sceneId, uuid:root?.uuid, p:root?.position.toArray(), q:root?.quaternion.toArray(), s:root?.scale.toArray(), internalScale:root?.children[0].scale.toArray(),
      seconds:asset?.seconds, activity:asset?.life?.activity(), posed,
      camera:d.focusHand.worldToLocal(d.camera.position.clone()).toArray(), target:d.focusHand.worldToLocal(d.target.clone()).toArray(), world:root?.matrixWorld.toArray(),
      angle:d.focusHand.rotation.y, box:{l,r,t,b}, top:rect('home-top'), dock:rect('home-dock'), select:rect('scene-select'), width:innerWidth,height:innerHeight,
      fits:l>=0&&r<=innerWidth&&t>=0&&b<=innerHeight, scroll:document.documentElement.scrollWidth>innerWidth, flips:window.__flips,
      count:document.querySelector('#dial-count').textContent,
      assets:window.__assets.map(a=>({id:a.id,mounted:!!a.root.parent,life:!!a.life,actions:a.mixer?.stats.actions.inUse}))
    };
  });
}
async function close(p) { check('无页面脚本异常', !p.errors.length, p.errors); await p.context().close(); }

const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) || null, setItem: (key,v) => memory.set(key,v) };
for (const raw of [null, {}, {version:1,lastByEra:{stone:'nope',tang:'zhoukoudian',information:'__proto__'}}]) {
  memory.set(SCENE_PREFS_KEY, JSON.stringify(raw));
  check('缺失或非法地点按各时代默认回退', Object.entries(loadScenePrefs()).every(([era,id])=>id===ERAS[era].defaultId));
}
const legacy=seed(0,'steam'); delete legacy.progress.legacyEraFloor; legacy.progress.completedRounds=20;
memory.set(KEY,JSON.stringify(legacy));
check('旧20轮档只迁移原蒸汽资格不开放信息时代',loadState().state.progress.legacyEraFloor==='steam' && loadState().state.progress.focusMinutes===0);
delete globalThis.localStorage;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const width of [1440,390]) {
    const p = await open(browser,{width,height:width===1440?900:844});
    await ready(p,'stone'); await near(p);
    const initial = JSON.stringify(await state(p));
    for (const [era, ids] of Object.entries(SCENES_BY_ERA)) {
      for (const id of ids) {
        await choose(p,id);
        const s=await sample(p);
        check(`${width} ${id} 模型独立加载且内缩放保留`, s.id===id && same(s.p,[0,0,0]) && same(s.q,[0,0,0,1]) && same(s.s,[1,1,1]) && same(s.internalScale,[.89,.89,.89]));
        check(`${width} ${id} 地点人物日程与取景正确`, s.activity.length >=4 && s.fits && s.box.t>s.top.b && s.box.b<s.dock.t && !s.scroll, {box:s.box,top:s.top,dock:s.dock});
        check(`${width} ${id} 中文地名及大区域显示`, (await p.textContent('#place-name')).includes(SCENES[id].label) && (await p.textContent('#place-name')).includes(SCENES[id].region));
        const formal=await state(p); check(`${width} ${id} 地点选择不增加专注进度`, formal.progress.focusMinutes===150 && formal.progress.completedRounds===0 && formal.run.status==='idle');
        if (['zhoukoudian','nile','ruhr','shenzhen'].includes(id)) await p.screenshot({path:path.resolve(`docs/screenshots/location-${id}-${width}.png`)});
      }
      const remembered=ids.at(-1); await p.reload(); await ready(p,remembered); await near(p);
      check(`${era} 刷新恢复最近地点`,await p.inputValue('#scene-select')===remembered);
    }
    const s=await sample(p); const before=JSON.stringify(await state(p));
    await p.selectOption('#scene-select',s.id); await sleepFrames(p);
    const repeat=await sample(p);
    check('重复选择相同地点不重建、不重播翻页',s.uuid===repeat.uuid && s.flips===repeat.flips && before===JSON.stringify(await state(p)));
    await p.click('#life-next'); const next=await sample(p);
    check('下一生活时段只推进人物日程',next.seconds>s.seconds+1 && JSON.stringify(await state(p))===before);
    const start=await sample(p); await p.click('#home-start'); await advance(p,61000);
    const after=await sample(p);
    check('指针转动带动文明，镜头局部绑定不变',!same(start.world,after.world)&&same(start.camera,after.camera)&&same(start.target,after.target)&&after.count==='23:59');
    await p.click('#home-pause'); const paused=await sample(p); await p.waitForTimeout(450); const later=await sample(p);
    check('暂停专注不冻结场景生活',same(paused.camera,later.camera)&&paused.angle===later.angle&&paused.count===later.count&&later.seconds>paused.seconds);
    await p.emulateMedia({reducedMotion:'reduce'}); await sleepFrames(p); const reduced=await sample(p); await p.waitForTimeout(450); const still=await sample(p);
    check('减少动态为静帧并禁用日程快进',same(reduced.posed,still.posed)&&reduced.seconds===still.seconds&&await p.locator('#life-next').isDisabled());
    await choose(p,'helsinki'); check('减少动态跨地点即时且无翻页', (await sample(p)).flips===still.flips);
    await p.emulateMedia({reducedMotion:'no-preference'}); await sleepFrames(p);
    const background=await p.evaluate(async()=>{
      const a=window.__assets.find(a=>a.root.parent&&a.root.userData.sceneId==='helsinki');
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
      const before=a.seconds;await new Promise(r=>setTimeout(r,1100));const hidden=a.seconds;
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {before,hidden,after:a.seconds};
    });
    check('后台不推进生活，回来不补跑长间隔',background.before===background.hidden&&background.after-background.hidden<.2,background);
    await close(p);
  }

  {
    const p=await open(browser,{width:320,height:568,initial:seed(0)}); await ready(p,'stone'); await near(p);
    check('初始石器5处地点全部可选、其余时代锁定',(await p.locator('#scene-select option').count())===5 && await p.locator('[data-home-era=information]').isDisabled()&&await p.locator('[data-home-era=tang]').isDisabled());
    await choose(p,'patagonia'); await p.click('#home-start');await advance(p,1000);const s=await sample(p);
    check('320竖屏选择器和人物不挡计时',s.fits&&s.box.t>s.top.b&&s.box.b<s.dock.t&&s.select.l>=0&&s.select.r<=320&&!s.scroll,{box:s.box,top:s.top,dock:s.dock});
    await p.screenshot({path:path.resolve('docs/screenshots/location-patagonia-320.png')});
    await close(p);
  }

  {
    const initial=seed(125,'steam'); const p=await open(browser,{initial}); await ready(p,'steam');await near(p);await p.click('#home-start');await advance(p,1500000);
    await ready(p,'information');const s=await state(p);check('150分钟开放信息时代及其5处地点',s.progress.focusMinutes===150&&s.progress.viewEra==='information'&&s.run.completion.unlockedEra==='information'&&(await p.locator('#scene-select option').count())===5);
    check('信息时代仅时钟端浏览，不冒充旧像素图',await p.locator('#civilization-entry').isDisabled());
    await p.reload();await ready(p,'information');check('刷新不重复解锁或翻页',(await sample(p)).flips===0&&(await state(p)).progress.focusMinutes===150);
    await close(p);
  }
  {
    const p=await open(browser,{initial:seed(125,'steam')});await ready(p,'steam');await p.click('#civilization-entry');await p.waitForSelector('body[data-view=scene]');await p.waitForFunction(()=>!document.querySelector('#fx-canvas').classList.contains('is-active'));
    await p.click('[data-action=start]');await advance(p,1500000);await p.waitForSelector('body[data-view=home]');await ready(p,'information');
    check('旧场景里达到信息门槛安全回时钟、不渲染错误旧图',(await state(p)).progress.focusMinutes===150);await close(p);
  }

  {
    let reject=true;
    const p=await open(browser,{route:async p=>p.route('**/nile.glb',r=>reject?r.abort():r.continue())});await ready(p,'stone');await near(p);await choose(p,'tang');const old=await sample(p);await p.selectOption('#scene-select','nile');await p.waitForSelector('#civilization-retry:visible');
    check('目标失败保留原模型并标注原地点',(await sample(p)).uuid===old.uuid&&(await p.textContent('#place-name')).includes('盛唐田园'));
    await p.click('#home-start');await advance(p,2000);check('地点失败不影响计时',await p.textContent('#dial-count')==='24:58');reject=false;await p.click('#civilization-retry');await ready(p,'nile');
    check('失败重试成功才替换',(await sample(p)).id==='nile');await close(p);
  }
  {
    let release,requested;
    const requestedPromise=new Promise(r=>requested=r);const gate=new Promise(r=>release=r);
    const p=await open(browser,{route:async p=>p.route('**/olduvai.glb',async r=>{const response=await r.fetch();requested();await gate;await r.fulfill({response});})});await ready(p,'stone');await near(p);await p.selectOption('#scene-select','olduvai');await requestedPromise;await choose(p,'vezere');const latest=await sample(p);release();await p.waitForTimeout(500);
    check('慢请求迟到不能覆盖最后选择',(await sample(p)).uuid===latest.uuid&&await p.inputValue('#scene-select')==='vezere');
    await p.selectOption('#scene-select','patagonia');await p.waitForSelector('#dial-canvas[data-flipping=true]');await p.selectOption('#scene-select','zhoukoudian');await ready(p,'zhoukoudian');
    check('翻页中再选地点最终只挂一个正确模型',(await p.evaluate(()=>window.__dial.civilizationMount.children.filter(n=>n.userData.sceneId).length))===1);await close(p);
  }
  {
    const p=await open(browser,{prefs:{version:1,lastByEra:{stone:'invalid',tang:'shenzhen',information:'shenzhen'}}});await ready(p,'stone');await p.click('[data-home-era=information]');await ready(p,'shenzhen');
    check('非法跨时代记忆回退，同代有效记忆恢复',await p.inputValue('#scene-select')==='shenzhen');await close(p);
  }
  {
    const p=await open(browser);await ready(p,'stone');await choose(p,'olduvai');const formalPrefs=await p.evaluate(key=>localStorage.getItem(key),SCENE_PREFS_KEY);
    await p.click('#settings-btn');await p.click('#demo-enter-btn');await ready(p,'olduvai');await choose(p,'zhoukoudian');
    for(let round=1;round<=3;round++){await p.click('#home-start');await advance(p,15000);await ready(p,['stone','tang','steam','information'][round]);}
    check('演示第3轮开放信息时代且正式地点记忆独立',await p.getAttribute('body','data-theme')==='information'&&(await p.evaluate(key=>localStorage.getItem(key),SCENE_PREFS_KEY))===formalPrefs);
    await p.click('#settings-btn');await p.click('#demo-exit-btn');await ready(p,'olduvai');check('退出演示恢复正式最近地点',await p.inputValue('#scene-select')==='olduvai');await close(p);
  }
} finally { await browser.close(); }
console.log(`\n${passed} location checks passed`);
