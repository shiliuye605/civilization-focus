import {
  createIdleRun,
  formatRemaining,
  isDue,
  pauseRun,
  remainingOf,
  resumeRun,
  startRun
} from './timer.js';
import { loadState, saveState, storageAvailable } from './store.js';
import { THEMES } from './themes.js';
import { ERA_ORDER, ERAS, unlockedEras, highestUnlockedEra, nextLockedEra, canEnterEra, DEMO_FOCUS_MS, DEMO_BREAK_MS } from './eras.js';
import { createDial } from './dial.js';
import { createScene } from './scene.js';
import { createClock } from './clock.js';
import { createUI, createFx } from './ui.js';
import { createBackground } from './background.js';
import { createAudio } from './audio.js';
import { loadAudioPrefs, saveAudioPrefs } from './audio-prefs.js';
import { AMBIENCES, unlockedAmbiences, backgroundForEra } from './rewards.js';
import { ERAS as PLACE_ERAS, SCENES, SCENES_BY_ERA } from './scene-catalog.mjs';
import { loadScenePrefs, saveScenePrefs } from './scene-prefs.js';

function parseMinutes(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const minutes = Number(text);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return null;
  const ms = minutes * 60000;
  if (!Number.isSafeInteger(ms) || !Number.isSafeInteger(Date.now() + ms)) return null;
  return minutes;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function localTimeString() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function boot() {
  const loaded = loadState();
  const formal = loaded.state;
  let state = formal;
  let demoActive = false;
  let storageOK = storageAvailable();
  let view = 'home';
  let busy = false;
  let theme = null;
  let fitMode = 'immersive';
  let homeDirty = false;
  let dialNear = false;
  const formalPlaces = loadScenePrefs();
  let places = formalPlaces;

  if (loaded.recovered) console.warn('文明专注：存档读取失败，已恢复可用的初始进度。');
  if (!storageOK || loaded.storageFailed) console.warn('文明专注：浏览器存储不可用，本次进度可能无法保存。');

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;

  const ui = createUI();
  if (loaded.recovered) ui.setStorageStatus('load-recovered');
  if (!storageOK || loaded.storageFailed) ui.setStorageStatus('storage-unavailable');
  const fx = createFx(ui.els.fxCanvas, { reducedMotion: reduced });
  const clock = createClock(ui.els.clock);
  const scene = createScene(ui.els.sceneCanvas, { reducedMotion: reduced });
  const dial = createDial(ui.els.dialCanvas, {
    fallback: ui.els.dialFallback,
    reducedMotion: reduced,
    getRun: () => state.run,
    onActivate: () => setDialNear(!dialNear),
    onFallback: () => {
      if (ERAS[clampViewEra()].mapLabel) browseScene();
      else ui.els.homeStart.focus();
    },
    onReady: () => { ui.els.dialViewBtn.disabled = false; },
    onFailure: () => {
      ui.els.dialViewBtn.disabled = true;
      ui.els.sceneSelect.disabled = true;
      ui.els.lifeNext.disabled = true;
      ui.setCivilizationStatus({ status: 'ready' }, '');
      ui.els.placeName.textContent = '3D 地点暂不可用';
      ui.els.placeName.removeAttribute('title');
    },
    onCivilizationState: (status) => {
      ui.setCivilizationStatus(status, SCENES[status.target].label);
      ui.setPlaceInfo(status.sceneId ? SCENES[status.sceneId] : null);
      syncLifeControl();
      syncDialLayout();
    }
  });
  const background = createBackground(ui.els.bgCanvas, { reducedMotion: reduced });

  const audioLoaded = loadAudioPrefs();
  const formalAudio = audioLoaded.prefs;
  let audioPrefs = formalAudio;
  if (audioLoaded.recovered) {
    console.warn('文明专注：声音偏好读取失败，已恢复默认声音设置。');
    ui.setStorageStatus('audio-recovered');
  }
  const audio = createAudio({
    onState: (next) => {
      ui.setSoundButton(next);
      if (ui.els.settingsDialog.open) ui.renderSoundState(soundVM());
      if (next === 'playing') ui.announce('环境音正在播放');
      if (next === 'blocked') ui.announce('浏览器阻止了声音，可点击再次尝试');
      if (next === 'failed') ui.announce('声音素材加载失败，可点击重试');
      if (audioPrefs.enabled && (next === 'blocked' || next === 'failed')) armGestureUnlock();
      else disarmGestureUnlock();
    }
  });
  let pendingUnlock = { formal: null, demo: null };
  let homeFlash = null;
  let homeCommitFailed = false;
  let confirmContext = null;
  let gestureUnlockArmed = false;

  function onGestureUnlock(event) {
    const target = event.target;
    if (target instanceof Element && target.closest('#settings-dialog, [data-action="sound-quick"], [data-action="sound-mute"], [data-action="sound-retry"]')) return;
    if (!audioPrefs.enabled) return;
    const s = audio.getState();
    if (s === 'blocked' || s === 'failed') audio.resume();
  }

  function armGestureUnlock() {
    if (gestureUnlockArmed) return;
    gestureUnlockArmed = true;
    window.addEventListener('pointerdown', onGestureUnlock, true);
    window.addEventListener('keydown', onGestureUnlock, true);
  }

  function disarmGestureUnlock() {
    if (!gestureUnlockArmed) return;
    gestureUnlockArmed = false;
    window.removeEventListener('pointerdown', onGestureUnlock, true);
    window.removeEventListener('keydown', onGestureUnlock, true);
  }

  function availableAmbiences() {
    return unlockedAmbiences(state.progress, demoActive);
  }

  function reconcileAudioPrefs() {
    const list = availableAmbiences();
    if (!list.length) {
      audioPrefs.enabled = false;
      audioPrefs.ambienceId = null;
      return;
    }
    if (!audioPrefs.followDefault && !list.some((a) => a.id === audioPrefs.ambienceId)) {
      audioPrefs.followDefault = true;
      audioPrefs.ambienceId = null;
    }
  }

  let ambTarget = null;

  function resolveAmbience() {
    const list = availableAmbiences();
    if (!list.length) return null;
    if (!audioPrefs.followDefault && list.some((a) => a.id === audioPrefs.ambienceId)) return audioPrefs.ambienceId;
    if (view === 'home') {
      const home = list.find((a) => a.home);
      if (home) return home.id;
    }
    const era = list.find((a) => a.eraId === clampViewEra());
    return (era || list[0]).id;
  }

  function syncAmbience() {
    const target = resolveAmbience();
    if (!target || target === ambTarget) return;
    ambTarget = target;
    audioPrefs.ambienceId = target;
    if (audioPrefs.enabled) persistAudio();
    audio.syncPrefs(audioPrefs);
    if (audioPrefs.enabled) audio.select(target);
    refreshSoundUI();
  }

  function persistAudio() {
    if (demoActive) return;
    if (!saveAudioPrefs(audioPrefs)) {
      console.warn('文明专注：声音偏好保存失败。');
      ui.setStorageStatus('audio-save');
    }
  }

  function soundVM() {
    return {
      enabled: audioPrefs.enabled,
      muted: audioPrefs.muted,
      volume: audioPrefs.volume,
      ambienceId: audioPrefs.followDefault ? '' : audioPrefs.ambienceId,
      list: [{ id: '', name: '自动 · 首页太空 / 场景随时代' }, ...availableAmbiences().map((a) => ({ id: a.id, name: a.name }))],
      state: audio.getState()
    };
  }

  function refreshSoundUI() {
    ui.setSoundButton(audio.getState());
    if (ui.els.settingsDialog.open) {
      ui.renderSoundList(soundVM());
      ui.renderSoundState(soundVM());
    }
  }

  const focusMs = () => (demoActive ? DEMO_FOCUS_MS : state.settings.focusMinutes * 60000);
  const breakMs = () => (demoActive ? DEMO_BREAK_MS : state.settings.breakMinutes * 60000);

  function highestAvailable() {
    return highestUnlockedEra(state.progress, demoActive);
  }

  function clampViewEra() {
    const era = state.progress.viewEra;
    const unlocked = canEnterEra(era, state.progress, demoActive);
    if (!unlocked) state.progress.viewEra = highestAvailable();
    return state.progress.viewEra;
  }

  function persist() {
    if (demoActive) return true;
    const ok = saveState(state);
    if (!ok) {
      storageOK = false;
      console.warn('文明专注：进度保存失败，本次进度可能无法保存。');
      ui.setStorageStatus('progress-save');
    }
    return ok;
  }

  function syncTheme({ animate = true } = {}) {
    const id = clampViewEra();
    const next = THEMES[id];
    const changed = !theme || next.id !== theme.id;
    theme = next;
    document.body.dataset.theme = theme.id;
    clock.setTheme(theme);
    background.setEra(theme.id, state.progress, demoActive);
    syncAmbience();
    syncPlace(animate);
    ui.setHomeEras(Object.keys(PLACE_ERAS).map((eraId) => ({
      id: eraId,
      name: PLACE_ERAS[eraId].name,
      unlocked: canEnterEra(eraId, state.progress, demoActive),
      requirement: demoActive ? `演示完成 ${ERAS[eraId].unlockRounds} 轮解锁` : `累计专注 ${ERAS[eraId].unlockMinutes} 分钟解锁`
    })), id);
    return changed;
  }

  function syncPlace(animate = true) {
    const era = clampViewEra();
    const id = places[era];
    const hasClassicScene = Boolean(ERAS[era].mapLabel);
    ui.setLocations(SCENES_BY_ERA[era].map((sceneId) => SCENES[sceneId]), id);
    ui.els.civilizationEntry.disabled = !hasClassicScene;
    ui.els.civilizationEntry.title = hasClassicScene ? '打开经典文明场景' : '信息时代仅在时钟上展示';
    ui.els.dialFallback.querySelector('span').textContent = hasClassicScene ? '点击进入经典文明场景' : '使用下方计时器';
    dial.setScene(id, { animate });
  }

  function selectPlace(id) {
    const era = clampViewEra();
    if (!Object.hasOwn(SCENES, id) || SCENES[id].era !== era || !canEnterEra(era, state.progress, demoActive)) return;
    if (places[era] === id) return;
    places[era] = id;
    if (!demoActive && !saveScenePrefs(places)) ui.setStorageStatus('places-save');
    syncPlace();
    ui.announce(`查看${SCENES[id].label}`);
  }

  function digitsForRun(run) {
    if (run.status === 'idle') return formatRemaining(focusMs());
    if (run.status === 'done') return '00:00';
    return formatRemaining(remainingOf(run, Date.now()));
  }

  function fillPercent() {
    const value = demoActive
      ? state.progress.completedRounds * 50
      : Math.max(state.progress.focusMinutes, ERAS[highestAvailable()].unlockMinutes);
    return Math.max(0, Math.min(100, value));
  }

  function setFeedback(text, run, type) {
    homeFlash = { owner: state, roundId: run.roundId, type, text, expiresAt: null };
    ui.announce(text);
  }

  function feedbackText(surface) {
    if (!homeFlash || homeFlash.owner !== state) return null;
    if (homeFlash.type === 'focus' && homeFlash.roundId !== state.run.roundId) return null;
    if (homeFlash.type === 'break' && state.run.status !== 'idle') return null;
    if (homeFlash.expiresAt === null) {
      if (view !== surface || document.hidden) return null;
      homeFlash.expiresAt = Date.now() + 4000;
    }
    if (Date.now() >= homeFlash.expiresAt) {
      homeFlash = null;
      return null;
    }
    return homeFlash.text;
  }

  function buildSceneVM() {
    const run = state.run;
    const isBreak = run.mode === 'break';
    const local = `当地时间 ${localTimeString()}`;
    let status;
    let hint;
    let controls = [];
    let choices = null;

    if (run.status === 'idle') {
      status = '— 待开始 —';
      hint = homeCaption(ERAS[clampViewEra()]);
      controls = [
        { id: 'start', label: '开始专注', icon: 'play', primary: true },
        { id: 'back-home', label: '首页', icon: 'home' }
      ];
    } else if (run.status === 'running') {
      if (isBreak) {
        status = '— 休息中 —';
        hint = '休息片刻，让文明喘口气';
        controls = [
          { id: 'pause', label: '暂停', icon: 'pause', primary: true },
          { id: 'end-break', label: '结束休息', icon: 'stop' },
          { id: 'back-home', label: '首页', icon: 'home' }
        ];
      } else {
        status = '— 专注中 —';
        hint = homeCaption(ERAS[clampViewEra()]);
        controls = [
          { id: 'pause', label: '暂停', icon: 'pause', primary: true },
          { id: 'reset', label: '重置', icon: 'reset' },
          { id: 'back-home', label: '首页', icon: 'home' }
        ];
      }
    } else if (run.status === 'paused') {
      status = isBreak ? '— 休息暂停 —' : '— 已暂停 —';
      hint = '已暂停 · 剩余时间已保存';
      controls = [
        { id: 'resume', label: '继续', icon: 'play', primary: true },
        isBreak ? { id: 'end-break', label: '结束休息', icon: 'stop' } : { id: 'reset', label: '重置', icon: 'reset' },
        { id: 'back-home', label: '首页', icon: 'home' }
      ];
    } else {
      status = '— 本轮完成 —';
      hint = homeCaption(ERAS[clampViewEra()]);
      choices = [
        { id: 'start-break', label: demoActive ? '休息 5 秒' : `休息 ${state.settings.breakMinutes} 分钟`, icon: 'play', primary: true },
        { id: 'start-next', label: demoActive ? '开始专注 · 15 秒' : '开始专注', icon: 'reset' }
      ];
    }

    const nodes = ERA_ORDER.filter((id) => ERAS[id].mapLabel).map((id, i) => {
      const era = ERAS[id];
      const unlocked = canEnterEra(id, state.progress, demoActive);
      return {
        id,
        label: era.name,
        icon: ['stone', 'wheat', 'gear'][i],
        locked: !unlocked,
        current: state.progress.viewEra === id,
        tag: unlocked ? null : era.available
          ? demoActive ? `演示 · 完成 ${era.unlockRounds} 轮解锁` : `累计 ${era.unlockMinutes} 分钟解锁`
          : '后续版本开放'
      };
    });

    return {
      count: digitsForRun(run),
      status,
      local,
      hint: feedbackText('scene') || hint,
      controls,
      choices,
      nodes,
      runState: run.status,
      fill: fillPercent()
    };
  }

  function renderScene() {
    scene.setPaused(state.run.status === 'paused');
    ui.renderScene(buildSceneVM());
  }

  /* ---------- home dock ---------- */

  function homeCaption(era) {
    const next = nextLockedEra(state.progress, demoActive);
    if (demoActive) {
      return next
        ? `${era.name} · 演示 · 完成 ${next.unlockRounds} 轮解锁${next.name}`
        : `${era.name} · 演示 · 已完成 ${state.progress.completedRounds} 轮`;
    }
    return next
      ? `${era.name} · 距解锁${next.name}还差 ${Math.ceil(next.unlockMinutes - state.progress.focusMinutes)} 分钟`
      : `${era.name} · 已累计专注 ${state.progress.focusMinutes} 分钟`;
  }

  const homeEditable = () =>
    !demoActive && (state.run.status === 'idle' || (state.run.status === 'done' && state.run.mode === 'focus'));

  function buildHomeVM() {
    const run = state.run;
    const caption = feedbackText('home') || homeCaption(ERAS[clampViewEra()]);
    if (run.status === 'idle' || (run.status === 'done' && run.mode === 'focus')) {
      return {
        state: run.status,
        caption,
        buttonLabel: demoActive ? '开始专注 · 15 秒' : '开始专注',
        hideInput: !homeEditable(),
        minutes: state.settings.focusMinutes,
        breakLabel: run.status === 'done' ? (demoActive ? '休息 5 秒' : `休息 ${state.settings.breakMinutes} 分钟`) : null
      };
    }
    const remain = formatRemaining(remainingOf(run, Date.now()));
    if (run.status === 'paused') {
      return { state: 'paused', caption, buttonLabel: `${run.mode === 'break' ? '休息暂停' : '已暂停'} · ${remain}`, hideInput: true, breakLabel: null, segment: 'resume', isBreak: run.mode === 'break' };
    }
    return { state: 'running', caption, buttonLabel: `${run.mode === 'break' ? '返回休息' : '返回专注'} · ${remain}`, hideInput: true, breakLabel: null, segment: 'pause', isBreak: run.mode === 'break' };
  }

  function syncDialLayout() {
    if (view !== 'home') return;
    const dock = ui.els.homeDock;
    const top = ui.els.homeTop;
    const gap = window.innerWidth < 700 || window.innerHeight < 620 ? 16 : 24;
    // dock-in 入场动画会移动 getBoundingClientRect，用不受 transform 影响的几何量取最终留白
    const bottom = parseFloat(getComputedStyle(dock).bottom) || 0;
    const dockInset = bottom + dock.offsetHeight + gap;
    // Keep the camera distance stable when the timer row appears.
    const timerSpace = ui.els.dialSession.hidden
      ? parseFloat(getComputedStyle(ui.els.dialCount).lineHeight) + parseFloat(getComputedStyle(dock).rowGap)
      : 0;
    dial.setInsets({
      top: top.offsetTop + top.offsetHeight + gap / 2,
      nearTop: top.offsetTop + top.offsetHeight + gap / 2,
      bottom: dockInset,
      framingBottom: dockInset + timerSpace
    });
  }

  function renderHome() {
    const vm = buildHomeVM();
    vm.count = state.run.status === 'idle' ? '' : digitsForRun(state.run);
    vm.statusLabel = `${demoActive ? '演示 · ' : ''}${state.run.mode === 'break' ? '休息' : '专注'} · ${state.run.status === 'paused' ? '已暂停' : state.run.status === 'done' ? '已完成' : '进行中'}`;
    vm.inputLocked = homeDirty || document.activeElement === ui.els.homeMinutes;
    ui.renderHome(vm);
    syncLifeControl();
    syncDialLayout();
  }

  function syncLifeControl() {
    const { civilizationStatus, flipping } = ui.els.dialCanvas.dataset;
    ui.els.lifeNext.disabled = reduced || state.run.status === 'paused' || civilizationStatus !== 'ready' || flipping === 'true';
  }

  function applySettings(next) {
    const prevSettings = { ...state.settings };
    const prevDuration = state.run.durationMs;
    state.settings = { focusMinutes: next.focusMinutes, breakMinutes: next.breakMinutes };
    if (state.run.status === 'idle') state.run.durationMs = next.focusMinutes * 60000;
    if (!persist()) {
      state.settings = prevSettings;
      state.run.durationMs = prevDuration;
      return false;
    }
    return true;
  }

  function commitHomeFocus(minutes) {
    if (!applySettings({ focusMinutes: minutes, breakMinutes: state.settings.breakMinutes })) {
      homeDirty = true;
      ui.setHomeError('本地保存失败，请重试');
      return false;
    }
    homeDirty = false;
    homeCommitFailed = false;
    ui.setHomeError('');
    renderHome();
    ui.announce('学习时长已保存');
    return true;
  }

  function commitHomeDraft(source) {
    const raw = ui.getHomeMinutes();
    const minutes = parseMinutes(raw);
    if (minutes == null) {
      homeDirty = true;
      ui.setHomeError(String(raw).trim() === '' ? '请输入学习时长' : '请输入大于 0 的整数分钟');
      return false;
    }
    if (minutes === state.settings.focusMinutes) {
      homeDirty = false;
      homeCommitFailed = false;
      ui.setHomeError('');
      return true;
    }
    const ok = commitHomeFocus(minutes);
    if (!ok && source === 'start-blur') homeCommitFailed = true;
    return ok;
  }

  function browseScene() {
    if (busy || view === 'scene') return;
    openScene();
  }

  function setDialNear(next) {
    if (busy || view !== 'home' || next === dialNear || (next && !dial.isReady())) return;
    dialNear = next;
    dial.setNear(next);
    ui.setDialView(next);
    renderHome();
    ui.announce(next ? '随指针观察' : '时钟全景');
  }

  function homeStart() {
    if (busy || view === 'scene') return;
    if (homeCommitFailed) {
      homeCommitFailed = false;
      return;
    }
    const intent = state.run.status;
    settleIfDue(Date.now());
    const run = state.run;
    if (intent === 'running' || intent === 'paused' || run.status === 'running' || run.status === 'paused') {
      setDialNear(true);
      renderHome();
      return;
    }
    if (homeEditable() && !commitHomeDraft('click')) {
      ui.focusHomeMinutes();
      return;
    }
    if (state.run.status === 'idle' || (state.run.status === 'done' && state.run.mode === 'focus')) {
      state.run = startRun('focus', focusMs(), Date.now(), run);
      pendingUnlock[demoActive ? 'demo' : 'formal'] = null;
      homeFlash = null;
      persist();
      ui.announce('学习开始');
    }
    setDialNear(true);
    renderHome();
  }

  function homeBreak() {
    if (busy || view === 'scene') return;
    settleIfDue(Date.now());
    if (state.run.status !== 'done' || state.run.mode !== 'focus') return;
    state.run = startRun('break', breakMs(), Date.now(), state.run);
    pendingUnlock[demoActive ? 'demo' : 'formal'] = null;
    homeFlash = null;
    persist();
    ui.announce('休息开始');
    setDialNear(true);
    renderHome();
  }

  function homePauseToggle() {
    if (busy || view !== 'home') return;
    const intent = state.run.status;
    settleIfDue(Date.now());
    if (state.run.status !== intent) {
      renderHome();
      return;
    }
    if (intent === 'running') pauseTimer();
    else if (intent === 'paused') resumeTimer();
  }

  function homeResetRequest() {
    if (busy || view !== 'home') return;
    settleIfDue(Date.now());
    const status = state.run.status;
    if (status !== 'running' && status !== 'paused') {
      renderHome();
      return;
    }
    requestReset();
  }

  function onHomeInput() {
    homeDirty = true;
    homeCommitFailed = false;
    ui.setHomeError('');
  }

  function onHomeCommit(source) {
    if (!homeDirty) {
      ui.setHomeError('');
      return;
    }
    if (!homeEditable()) {
      homeDirty = false;
      return;
    }
    commitHomeDraft(source);
  }

  function onHomeCancel() {
    homeDirty = false;
    homeCommitFailed = false;
    ui.setHomeError('');
    ui.setHomeMinutesValue(state.settings.focusMinutes);
    ui.els.homeMinutes.blur();
  }

  function positionHotspots() {
    if (view !== 'scene') return;
    const items = scene.hotspots().map((h) => {
      const pos = scene.toScreen(h.x, h.y);
      const codex = ERAS[scene.getEra()].codex.find((c) => c.id === h.id);
      return { id: h.id, x: pos.x, y: pos.y, title: codex ? codex.title : h.id };
    });
    ui.renderHotspots(items);
  }

  function updateLive() {
    if (view === 'scene') {
      ui.setCount(digitsForRun(state.run));
      ui.setLocal(`当地时间 ${localTimeString()}`);
      ui.setFill(fillPercent());
      ui.els.hintText.textContent = buildSceneVM().hint;
    } else if (view === 'home') {
      renderHome();
    }
  }

  /* ---------- transitions ---------- */

  function openScene() {
    if (busy || view === 'scene' || !ERAS[clampViewEra()].mapLabel) return;
    busy = true;
    document.body.classList.add('is-zooming');
    dial.dive(() => {
      fx.cover(340, () => {
        view = 'scene';
        ui.showView('scene');
        syncAmbience();
        dial.setActive(false);
        if (ERAS[clampViewEra()].mapLabel) scene.setEra(clampViewEra());
        renderScene();
        scene.start();
        positionHotspots();
        fx.reveal(430, () => {
          document.body.classList.remove('is-zooming');
          finishSceneTransition();
        });
      });
    });
  }

  function closeScene() {
    if (busy || view === 'home') return;
    busy = true;
    fx.cover(300, () => {
      view = 'home';
      ui.showView('home');
      renderHome();
      syncAmbience();
      scene.stop();
      dial.setActive(true);
      let waiting = 2;
      const done = () => {
        waiting -= 1;
        if (!waiting) busy = false;
      };
      fx.reveal(360, done);
      dial.surface(done);
    });
  }

  function finishSceneTransition(event = null) {
    busy = false;
    if (view !== 'scene') return;
    if (!ERAS[clampViewEra()].mapLabel) { closeScene(); return; }
    scene.setEra(clampViewEra());
    renderScene();
    positionHotspots();
    const slot = demoActive ? 'demo' : 'formal';
    const pending = pendingUnlock[slot] || event;
    pendingUnlock[slot] = null;
    if (pending) showUnlockCard(pending);
  }

  function swapSceneEra(id) {
    if (busy) return;
    const owner = state;
    busy = true;
    fx.cover(260, () => {
      if (owner !== state) {
        fx.reveal(320, () => finishSceneTransition());
        return;
      }
      const slot = demoActive ? 'demo' : 'formal';
      const pending = pendingUnlock[slot];
      const takeover = pending && pending.roundId === state.run.roundId ? pending : null;
      const target = takeover?.eraId || id;
      if (takeover) pendingUnlock[slot] = null;
      state.progress.viewEra = target;
      persist();
      syncTheme();
      if (ERAS[target].mapLabel) scene.setEra(target);
      renderScene();
      positionHotspots();
      fx.reveal(320, () => finishSceneTransition(owner === state ? takeover : null));
    });
  }

  function browseHomeEra(id) {
    if (busy || view !== 'home' || !canEnterEra(id, state.progress, demoActive)) return;
    if (id === state.progress.viewEra) return;
    state.progress.viewEra = id;
    persist();
    syncTheme();
    renderHome();
    ui.announce(`查看${ERAS[id].name}`);
  }

  function browseEra(id) {
    if (busy || view !== 'scene') return;
    if (!ERAS[id] || !ERAS[id].available) return;
    if (!canEnterEra(id, state.progress, demoActive)) return;
    if (id === state.progress.viewEra) return;
    swapSceneEra(id);
    ui.announce(`进入${ERAS[id].name}`);
  }

  /* ---------- rewards ---------- */

  function showUnlockCard(event) {
    if (state.run.status !== 'done' || state.run.roundId !== event.roundId) return;
    const eras = event.eraIds.filter((id) => canEnterEra(id, state.progress, demoActive)).map((id) => ERAS[id]);
    if (!eras.length) return;
    const rows = eras.flatMap((era) => {
      const items = era.codex.length
        ? [`${era.name} · 图鉴新增 ${era.codex.length} 张：${era.codex.map((c) => c.title).join('、')}`]
        : [`${era.name} · 时钟开放 ${SCENES_BY_ERA[era.id].length} 处地点`];
      const bg = backgroundForEra(era.id, state.progress, demoActive);
      if (bg?.eraId === era.id) items.push(`背景 · ${bg.name}`);
      const amb = availableAmbiences().find((a) => a.eraId === era.id);
      if (amb) items.push(`环境音 · ${amb.name}（可在设置中开启）`);
      return items;
    });
    ui.openUnlock({ name: eras.map((era) => era.name).join('、'), tagline: eras[eras.length - 1].tagline, rows });
  }

  function openCodexPanel(activeEra) {
    const eras = unlockedEras(state.progress, demoActive).filter((id) => ERAS[id].codex.length).map((id) => ({
      id,
      name: ERAS[id].name,
      items: ERAS[id].codex.map((c) => ({
        ...c,
        slice: scene.sliceAt(id, (c.x / 100) * 1280, (c.y / 100) * 720)
      }))
    }));
    if (!eras.length) return;
    const active = eras.some((e) => e.id === activeEra) ? activeEra : eras[eras.length - 1].id;
    ui.openCodexPanel({ eras, activeEra: active });
  }

  /* ---------- timer ---------- */

  function settleIfDue(now, allowTransition = true) {
    const run = state.run;
    if (!isDue(run, now)) return null;

    if (run.mode === 'break') {
      state.run = createIdleRun(focusMs());
      homeDirty = false;
      ui.setHomeError('');
      persist();
      setFeedback('休息结束 · 可以开始专注', run, 'break');
      audio.playComplete();
      if (view === 'scene') renderScene();
      return { type: 'break' };
    }

    const progress = state.progress;
    const already = run.roundId && progress.lastSettledRoundId === run.roundId;
    let completion = run.completion || { unlockedEra: null, futureEra: null, at: now };
    let newEras = [];
    const addedMinutes = run.durationMs / 60000;
    if (!already) {
      const before = unlockedEras(progress, demoActive);
      progress.completedRounds += 1;
      progress.focusMinutes += addedMinutes;
      if (run.roundId) progress.lastSettledRoundId = run.roundId;
      newEras = unlockedEras(progress, demoActive).filter((id) => !before.includes(id));
      completion = { unlockedEra: newEras.at(-1) || null, unlockedEras: newEras, futureEra: null, at: now };
    }
    const newEra = newEras.at(-1) || null;
    state.run = { ...run, status: 'done', deadline: null, remainingMs: 0, completion };
    if (newEra) progress.viewEra = newEra;
    persist();
    syncTheme({ animate: view === 'home' && !busy && !document.hidden && document.body.dataset.appReady === 'true' });
    if (!already) {
      const names = newEras.map((id) => ERAS[id].name).join('、');
      const text = demoActive
        ? names ? `演示 · ${names}已解锁` : '演示专注完成'
        : names ? `${names}已解锁${newEras.length === 1 ? ` · +${addedMinutes} 分钟` : ''}` : `专注完成 · +${addedMinutes} 分钟`;
      setFeedback(text, run, 'focus');
      audio.playComplete();
    }
    reconcileAudioPrefs();
    refreshSoundUI();

    if (newEra) {
      pendingUnlock[demoActive ? 'demo' : 'formal'] = { eraId: newEra, eraIds: newEras, roundId: run.roundId };
    }
    if (view === 'scene' && !busy && allowTransition) {
      if (newEra && !ERAS[newEra].mapLabel) closeScene();
      else if (newEra) swapSceneEra(newEra);
      else renderScene();
    }
    return { type: 'focus', newEra, newEras };
  }

  function checkNow() {
    settleIfDue(Date.now());
    updateLive();
  }

  function startFocus() {
    settleIfDue(Date.now());
    const run = state.run;
    if (!(run.status === 'idle' || (run.status === 'done' && run.mode === 'focus'))) return;
    state.run = startRun('focus', focusMs(), Date.now(), run);
    pendingUnlock[demoActive ? 'demo' : 'formal'] = null;
    homeFlash = null;
    persist();
    renderScene();
    updateLive();
    ui.announce('学习开始');
  }

  function startBreak() {
    settleIfDue(Date.now());
    if (state.run.status !== 'done' || state.run.mode !== 'focus') return;
    state.run = startRun('break', breakMs(), Date.now(), state.run);
    pendingUnlock[demoActive ? 'demo' : 'formal'] = null;
    homeFlash = null;
    persist();
    renderScene();
    updateLive();
    ui.announce('休息开始');
  }

  function pauseTimer() {
    const target = state.run.roundId;
    const mode = state.run.mode;
    const now = Date.now();
    settleIfDue(now);
    const run = state.run;
    if (run.status !== 'running' || run.roundId !== target || run.mode !== mode) return;
    state.run = pauseRun(run, now);
    persist();
    renderScene();
    updateLive();
    ui.announce('已暂停');
  }

  function resumeTimer() {
    const target = state.run.roundId;
    const mode = state.run.mode;
    settleIfDue(Date.now());
    const run = state.run;
    if (run.status !== 'paused' || run.roundId !== target || run.mode !== mode) return;
    state.run = resumeRun(run, Date.now());
    persist();
    renderScene();
    updateLive();
    ui.announce(state.run.mode === 'break' ? '继续休息' : '继续专注');
  }

  function requestReset() {
    settleIfDue(Date.now());
    if (state.run.status !== 'running' && state.run.status !== 'paused') return;
    confirmContext = { demo: demoActive, roundId: state.run.roundId, mode: state.run.mode };
    ui.openConfirm();
  }

  function confirmReset() {
    const ctx = confirmContext;
    confirmContext = null;
    ui.closeConfirm();
    settleIfDue(Date.now());
    const run = state.run;
    if (!ctx || ctx.demo !== demoActive || run.roundId !== ctx.roundId || run.mode !== ctx.mode) return;
    if (run.status !== 'running' && run.status !== 'paused') return;
    state.run = createIdleRun(focusMs());
    persist();
    renderScene();
    updateLive();
    ui.announce('本轮已重置');
  }

  function endBreak() {
    const target = state.run.roundId;
    settleIfDue(Date.now());
    const run = state.run;
    if (run.mode !== 'break' || run.roundId !== target) return;
    if (run.status !== 'running' && run.status !== 'paused') return;
    state.run = createIdleRun(focusMs());
    persist();
    setFeedback('休息已结束', run, 'break');
    renderScene();
    updateLive();
  }

  /* ---------- demo mode ---------- */

  function enterDemo() {
    if (demoActive || busy) return;
    settleIfDue(Date.now());
    if (state.run.status === 'running') {
      ui.openDemoConfirm();
      return;
    }
    startDemo();
  }

  function startDemo() {
    if (demoActive) return;
    settleIfDue(Date.now(), false);
    pendingUnlock.formal = null;
    ui.closeUnlock();
    if (state.run.status === 'running') {
      state.run = pauseRun(state.run, Date.now());
      persist();
    }
    demoActive = true;
    places = { ...formalPlaces };
    pendingUnlock.demo = null;
    homeFlash = null;
    homeCommitFailed = false;
    state = {
      settings: { ...state.settings },
      progress: { completedRounds: 0, focusMinutes: 0, legacyEraFloor: 'stone', lastSettledRoundId: null, viewEra: 'stone' },
      run: createIdleRun(DEMO_FOCUS_MS)
    };
    audioPrefs = { ...formalAudio };
    ui.closeSettings();
    ui.closeDemoConfirm();
    ui.setDemoMode(true);
    clampViewEra();
    reconcileAudioPrefs();
    syncTheme();
    audio.syncPrefs(audioPrefs);
    refreshSoundUI();
    if (view === 'scene') {
      scene.setEra(clampViewEra());
      renderScene();
      positionHotspots();
    } else {
      homeDirty = false;
      ui.setHomeError('');
      renderHome();
    }
    ui.announce('已进入演示模式：每轮专注 15 秒，不计入正式记录');
  }

  function exitDemo() {
    if (!demoActive || busy) return;
    demoActive = false;
    places = formalPlaces;
    state = formal;
    audioPrefs = formalAudio;
    pendingUnlock.demo = null;
    homeFlash = null;
    homeCommitFailed = false;
    ui.setDemoMode(false);
    clampViewEra();
    reconcileAudioPrefs();
    syncTheme();
    audio.syncPrefs(audioPrefs);
    ambTarget = null;
    syncAmbience();
    if (!audioPrefs.enabled) audio.disable();
    refreshSoundUI();
    if (view === 'scene') closeScene();
    else {
      homeDirty = false;
      ui.setHomeError('');
      renderHome();
    }
    if (ui.els.settingsDialog.open) ui.closeSettings();
    ui.announce('已退出演示模式，正式进度已恢复');
  }

  /* ---------- settings ---------- */

  function openSettings() {
    ui.setDemoMode(demoActive);
    ui.openSettings(state.settings);
    ui.renderSoundList(soundVM());
    ui.renderSoundState(soundVM());
  }

  function saveSettings() {
    const input = ui.getSettingsInput();
    const errors = {};
    const focusMinutes = parseMinutes(input.focus);
    const breakMinutes = parseMinutes(input.break);
    if (!input.focus.trim()) errors.focus = '请输入学习时长';
    else if (focusMinutes == null) errors.focus = '请输入大于 0 的整数分钟';
    if (!input.break.trim()) errors.break = '请输入休息时长';
    else if (breakMinutes == null) errors.break = '请输入大于 0 的整数分钟';
    if (Object.keys(errors).length) {
      ui.setSettingsErrors(errors);
      return;
    }
    if (!applySettings({ focusMinutes, breakMinutes })) {
      ui.setSettingsErrors({ form: '本地保存失败，请检查浏览器存储权限后重试。' });
      return;
    }
    ui.closeSettings();
    homeDirty = false;
    homeCommitFailed = false;
    ui.setHomeError('');
    if (view === 'scene') renderScene();
    else renderHome();
    ui.announce('计时设置已保存');
  }

  function openHotspot(id) {
    const eraId = scene.getEra();
    const codex = ERAS[eraId].codex.find((c) => c.id === id);
    if (!codex) return;
    const spot = scene.hotspots().find((h) => h.id === id);
    const slice = spot ? scene.sliceAt(eraId, spot.x, spot.y) : null;
    ui.openCodex(codex, slice);
  }

  function setSoundEnabled(on) {
    audioPrefs.enabled = on;
    reconcileAudioPrefs();
    const target = on ? resolveAmbience() : null;
    if (target) {
      ambTarget = target;
      audioPrefs.ambienceId = target;
    }
    persistAudio();
    audio.syncPrefs(audioPrefs);
    if (target) audio.enable(target);
    else audio.disable();
    refreshSoundUI();
  }

  function selectAmbience(id) {
    if (id && !availableAmbiences().some((entry) => entry.id === id)) return;
    if (!id) {
      audioPrefs.followDefault = true;
      persistAudio();
      audio.syncPrefs(audioPrefs);
      ambTarget = null;
      syncAmbience();
      ui.announce('已恢复自动：首页太空，场景随时代');
      return;
    }
    audioPrefs.followDefault = false;
    audioPrefs.ambienceId = id;
    ambTarget = id;
    persistAudio();
    audio.syncPrefs(audioPrefs);
    audio.select(id);
    refreshSoundUI();
    const entry = AMBIENCES.find((a) => a.id === id);
    if (entry) ui.announce(`已选择环境音：${entry.name}`);
  }

  function setSoundVolume(volume) {
    audioPrefs.volume = volume;
    if (volume > 0 && audioPrefs.muted) audioPrefs.muted = false;
    persistAudio();
    audio.syncPrefs(audioPrefs);
    audio.setVolume(volume);
    refreshSoundUI();
  }

  function toggleMute() {
    audioPrefs.muted = !audioPrefs.muted;
    persistAudio();
    audio.syncPrefs(audioPrefs);
    audio.setMuted(audioPrefs.muted);
    refreshSoundUI();
    ui.announce(audioPrefs.muted ? '已静音' : '取消静音');
  }

  function soundQuick() {
    const state = audio.getState();
    if (state === 'playing') toggleMute();
    else if (state === 'muted') toggleMute();
    else if (state === 'blocked' || state === 'failed') audio.resume();
    else if (state === 'off') setSoundEnabled(true);
  }

  const actions = {
    'back-home': closeScene,
    start: startFocus,
    'start-next': startFocus,
    'start-break': startBreak,
    pause: pauseTimer,
    resume: resumeTimer,
    reset: requestReset,
    'confirm-reset': confirmReset,
    'cancel-reset': () => ui.closeConfirm(),
    'end-break': endBreak,
    'home-pause': homePauseToggle,
    'home-reset': homeResetRequest,
    'dial-view': () => setDialNear(!dialNear),
    'dial-scene': browseScene,
    'civilization-retry': () => syncPlace(),
    'life-next': () => dial.nextLifePhase(),
    'close-settings': () => ui.closeSettings(),
    'close-codex': () => ui.closeCodex(),
    'open-codex-panel': () => openCodexPanel(scene.getEra()),
    'close-codex-panel': () => ui.closeCodexPanel(),
    'close-unlock': () => ui.closeUnlock(),
    'unlock-codex': () => {
      const eraId = state.run.completion?.unlockedEra || state.progress.viewEra;
      ui.closeUnlock();
      openCodexPanel(eraId);
    },
    'sound-quick': soundQuick,
    'sound-mute': toggleMute,
    'sound-retry': () => audio.resume(),
    'dismiss-storage': () => ui.dismissStorage(),
    'demo-enter': enterDemo,
    'demo-confirm': startDemo,
    'demo-cancel': () => ui.closeDemoConfirm(),
    'demo-exit': exitDemo,
    'toggle-fit': () => {
      fitMode = fitMode === 'immersive' ? 'panorama' : 'immersive';
      scene.setFit(fitMode);
      document.body.dataset.fit = fitMode;
      ui.setFitButton(fitMode);
      positionHotspots();
      ui.announce(fitMode === 'panorama' ? '全景视图，完整地图' : '沉浸视图');
    }
  };

  ui.bind({
    onAction: (id) => actions[id]?.(),
    onSettingsOpen: openSettings,
    onSettingsSubmit: saveSettings,
    onHotspot: openHotspot,
    onNode: browseEra,
    onSoundEnabled: setSoundEnabled,
    onSoundSelect: selectAmbience,
    onSoundVolume: setSoundVolume,
    onHomeEra: browseHomeEra,
    onHomeScene: selectPlace,
    onHomeStart: homeStart,
    onHomeStartIntent: () => { homeCommitFailed = false; },
    onHomeBreak: homeBreak,
    onHomeInput,
    onHomeCommit,
    onHomeCancel
  });

  reducedQuery.addEventListener('change', (event) => {
    reduced = event.matches;
    dial.setReduced(reduced);
    syncLifeControl();
    scene.setReduced(reduced);
    fx.setReduced(reduced);
    background.setReduced(reduced);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkNow();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !dialNear || view !== 'home') return;
    if (document.querySelector('dialog[open]') || event.target === ui.els.homeMinutes) return;
    setDialNear(false);
  });

  window.addEventListener('resize', () => {
    positionHotspots();
    syncDialLayout();
  });

  window.setInterval(checkNow, 250);
  window.setInterval(() => {
    clock.tick();
    if (view === 'scene') ui.setLocal(`当地时间 ${localTimeString()}`);
  }, 1000);

  clampViewEra();
  reconcileAudioPrefs();
  syncTheme();
  audio.syncPrefs(audioPrefs);
  refreshSoundUI();
  checkNow();
  ui.showView('home');
  renderHome();
  ui.setFitButton(fitMode);
  ui.setDemoMode(false);
  ui.setDialView(false);
  document.body.dataset.fit = fitMode;
  dial.setActive(true);
  scene.preload(state.progress.viewEra);
  document.body.dataset.appReady = 'true';
}
