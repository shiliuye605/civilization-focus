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
import { ERA_ORDER, ERAS, unlockedLevel } from './eras.js';
import { createGlobe } from './globe.js';
import { createScene } from './scene.js';
import { createClock } from './clock.js';
import { createUI, createFx } from './ui.js';

function parseMinutes(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const minutes = Number(text);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
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
  const state = loaded.state;
  let storageOK = storageAvailable();
  let view = 'home';
  let busy = false;
  let theme = null;

  if (loaded.recovered) console.warn('文明专注：存档读取失败，已恢复可用的初始进度。');
  if (!storageOK || loaded.storageFailed) console.warn('文明专注：浏览器存储不可用，本次进度可能无法保存。');

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;

  const ui = createUI();
  const fx = createFx(ui.els.fxCanvas, { reducedMotion: reduced });
  const clock = createClock(ui.els.clock);
  const scene = createScene(ui.els.sceneCanvas, { reducedMotion: reduced });
  const globe = createGlobe(ui.els.globeCanvas, {
    fallback: ui.els.globeFallback,
    reducedMotion: reduced,
    onActivate: openScene
  });

  const focusMs = () => state.settings.focusMinutes * 60000;
  const breakMs = () => state.settings.breakMinutes * 60000;

  function highestAvailable() {
    return state.progress.completedRounds >= 1 ? 'tang' : 'stone';
  }

  function clampViewEra() {
    const era = state.progress.viewEra;
    const unlocked = ERAS[era] && ERAS[era].available && unlockedLevel(state.progress.completedRounds) >= ERAS[era].unlockRounds + 1;
    if (!unlocked) state.progress.viewEra = highestAvailable();
    return state.progress.viewEra;
  }

  function persist() {
    const ok = saveState(state);
    if (!ok) {
      storageOK = false;
      console.warn('文明专注：进度保存失败，本次进度可能无法保存。');
    }
    return ok;
  }

  function syncTheme() {
    const id = clampViewEra();
    const next = THEMES[id];
    const changed = !theme || next.id !== theme.id;
    theme = next;
    document.body.dataset.theme = theme.id;
    clock.setTheme(theme);
    if (changed) globe.setTheme(theme);
    return changed;
  }

  function digitsForRun(run) {
    if (run.status === 'idle') return formatRemaining(focusMs());
    if (run.status === 'done') return '00:00';
    return formatRemaining(remainingOf(run, Date.now()));
  }

  function fillPercent() {
    const run = state.run;
    let frac = 0;
    if (run.mode === 'focus' && (run.status === 'running' || run.status === 'paused')) {
      const remain = remainingOf(run, Date.now());
      frac = run.durationMs > 0 ? 1 - remain / run.durationMs : 0;
    }
    const value = (state.progress.completedRounds + frac) / 2;
    return Math.max(0, Math.min(100, value * 100));
  }

  function buildSceneVM() {
    const run = state.run;
    const rounds = state.progress.completedRounds;
    const isBreak = run.mode === 'break';
    const local = `当地时间 ${localTimeString()}`;
    let status;
    let hint;
    let controls = [];
    let choices = null;

    if (run.status === 'idle') {
      status = '— 待开始 —';
      hint = '点击开始，继续你的文明';
      controls = [
        { id: 'start', label: '开始学习', icon: 'play', primary: true },
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
        hint = rounds < 1 ? '完成本轮专注，解锁盛唐田园' : '保持专注，文明持续生长';
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
      const newEra = run.completion?.unlockedEra;
      hint = newEra ? `${ERAS[newEra].name}已解锁 · 选择下一步` : '本轮完成 · 选择下一步';
      choices = [
        { id: 'start-break', label: `休息 ${state.settings.breakMinutes} 分钟`, icon: 'play', primary: true },
        { id: 'start-next', label: `再学一轮 ${state.settings.focusMinutes} 分钟`, icon: 'reset' }
      ];
    }

    const nodes = [
      { id: 'stone', label: '石器聚落', icon: 'stone', locked: false, current: state.progress.viewEra === 'stone', tag: null },
      {
        id: 'tang',
        label: '盛唐田园',
        icon: 'wheat',
        locked: rounds < 1,
        current: state.progress.viewEra === 'tang',
        tag: rounds < 1 ? '完成 1 轮解锁' : null
      },
      { id: 'steam', label: '蒸汽城镇', icon: 'gear', locked: true, current: false, tag: '后续版本开放' }
    ];

    return {
      count: digitsForRun(run),
      status,
      local,
      hint,
      controls,
      choices,
      nodes,
      fill: fillPercent()
    };
  }

  function renderScene() {
    ui.renderScene(buildSceneVM());
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
    if (view !== 'scene') return;
    ui.setCount(digitsForRun(state.run));
    ui.setLocal(`当地时间 ${localTimeString()}`);
    ui.setFill(fillPercent());
  }

  /* ---------- transitions ---------- */

  function openScene() {
    if (busy || view === 'scene') return;
    if (state.run.status === 'idle') {
      state.run = startRun('focus', focusMs(), Date.now());
      persist();
      ui.announce('学习开始');
    }
    busy = true;
    document.body.classList.add('is-zooming');
    globe.zoomIn(780, () => {
      fx.cover(340, () => {
        view = 'scene';
        ui.showView('scene');
        globe.setActive(false);
        scene.setEra(clampViewEra());
        scene.start();
        renderScene();
        positionHotspots();
        fx.reveal(430, () => {
          busy = false;
          document.body.classList.remove('is-zooming');
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
      scene.stop();
      globe.setActive(true);
      globe.setZoom(1);
      fx.reveal(360);
      globe.zoomOut(780, () => {
        busy = false;
      });
    });
  }

  function swapSceneEra(id, after) {
    busy = true;
    fx.cover(260, () => {
      state.progress.viewEra = id;
      persist();
      syncTheme();
      scene.setEra(id);
      renderScene();
      positionHotspots();
      fx.reveal(320, () => {
        busy = false;
        after?.();
      });
    });
  }

  function browseEra(id) {
    if (busy || view !== 'scene') return;
    if (!ERAS[id] || !ERAS[id].available) return;
    if (unlockedLevel(state.progress.completedRounds) < ERAS[id].unlockRounds + 1) return;
    if (id === state.progress.viewEra) return;
    swapSceneEra(id);
    ui.announce(`进入${ERAS[id].name}`);
  }

  /* ---------- timer ---------- */

  function settleIfDue(now) {
    const run = state.run;
    if (!isDue(run, now)) return null;

    if (run.mode === 'break') {
      state.run = createIdleRun(focusMs());
      persist();
      if (view === 'scene') renderScene();
      ui.announce('休息结束，可以开始新一轮学习');
      return { type: 'break' };
    }

    const progress = state.progress;
    const already = run.roundId && progress.lastSettledRoundId === run.roundId;
    let completion;
    let newEra = null;
    if (!already) {
      const before = progress.completedRounds;
      progress.completedRounds = before + 1;
      progress.focusMinutes += Math.round(run.durationMs / 60000);
      if (run.roundId) progress.lastSettledRoundId = run.roundId;
      const beforeLevel = unlockedLevel(before);
      const afterLevel = unlockedLevel(progress.completedRounds);
      if (afterLevel > beforeLevel) {
        const eraId = ERA_ORDER[afterLevel - 1];
        if (ERAS[eraId]?.available) {
          newEra = eraId;
          completion = { unlockedEra: eraId, futureEra: null, at: now };
        } else {
          completion = { unlockedEra: null, futureEra: eraId, at: now };
        }
      } else {
        completion = { unlockedEra: null, futureEra: null, at: now };
      }
    } else {
      completion = run.completion || { unlockedEra: null, futureEra: null, at: now };
    }

    state.run = { ...run, status: 'done', deadline: null, remainingMs: 0, completion };
    if (newEra) state.progress.viewEra = newEra;
    persist();
    syncTheme();

    if (view === 'scene') {
      if (newEra) {
        swapSceneEra(newEra);
      } else {
        renderScene();
      }
    }
    ui.announce(newEra ? `${ERAS[newEra].name}已解锁` : '本轮学习完成');
    return { type: 'focus', newEra };
  }

  function checkNow() {
    settleIfDue(Date.now());
    updateLive();
  }

  function startFocus() {
    if (state.run.status === 'running' || state.run.status === 'paused') return;
    state.run = startRun('focus', focusMs(), Date.now());
    persist();
    renderScene();
    updateLive();
    ui.announce('学习开始');
  }

  function startBreak() {
    if (state.run.status !== 'done' || state.run.mode !== 'focus') return;
    state.run = startRun('break', breakMs(), Date.now());
    persist();
    renderScene();
    updateLive();
    ui.announce('休息开始');
  }

  function pauseTimer() {
    if (state.run.status !== 'running') return;
    state.run = pauseRun(state.run, Date.now());
    persist();
    renderScene();
    updateLive();
    ui.announce('已暂停');
  }

  function resumeTimer() {
    if (state.run.status !== 'paused') return;
    state.run = resumeRun(state.run, Date.now());
    persist();
    renderScene();
    updateLive();
    ui.announce(state.run.mode === 'break' ? '继续休息' : '继续专注');
  }

  function requestReset() {
    if (state.run.status !== 'running' && state.run.status !== 'paused') return;
    ui.openConfirm();
  }

  function confirmReset() {
    state.run = createIdleRun(focusMs());
    persist();
    ui.closeConfirm();
    renderScene();
    updateLive();
    ui.announce('本轮已重置');
  }

  function endBreak() {
    state.run = createIdleRun(focusMs());
    persist();
    renderScene();
    updateLive();
    ui.announce('休息结束，可以开始新一轮学习');
  }

  /* ---------- settings ---------- */

  function openSettings() {
    ui.openSettings(state.settings);
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
    const prevSettings = { ...state.settings };
    const prevDuration = state.run.durationMs;
    state.settings = { focusMinutes, breakMinutes };
    if (state.run.status === 'idle') state.run.durationMs = focusMinutes * 60000;
    if (!persist()) {
      state.settings = prevSettings;
      state.run.durationMs = prevDuration;
      ui.setSettingsErrors({ form: '本地保存失败，请检查浏览器存储权限后重试。' });
      return;
    }
    ui.closeSettings();
    if (view === 'scene') renderScene();
    ui.announce('计时设置已保存');
  }

  function openHotspot(id) {
    const codex = ERAS[scene.getEra()].codex.find((c) => c.id === id);
    if (codex) ui.openCodex(codex);
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
    'close-settings': () => ui.closeSettings(),
    'close-codex': () => ui.closeCodex()
  };

  ui.bind({
    onAction: (id) => actions[id]?.(),
    onSettingsOpen: openSettings,
    onSettingsSubmit: saveSettings,
    onHotspot: openHotspot,
    onNode: browseEra
  });

  reducedQuery.addEventListener('change', (event) => {
    reduced = event.matches;
    globe.setReduced(reduced);
    scene.setReduced(reduced);
    fx.setReduced(reduced);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkNow();
  });

  window.addEventListener('resize', () => {
    positionHotspots();
  });

  window.setInterval(checkNow, 250);
  window.setInterval(() => {
    clock.tick();
    if (view === 'scene') ui.setLocal(`当地时间 ${localTimeString()}`);
  }, 1000);

  clampViewEra();
  syncTheme();
  checkNow();
  ui.showView('home');
  globe.setActive(true);
  document.body.dataset.appReady = 'true';
}