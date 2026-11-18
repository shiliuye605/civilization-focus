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
import { createBackground } from './background.js';
import { createAudio } from './audio.js';
import { loadAudioPrefs, saveAudioPrefs } from './audio-prefs.js';
import { AMBIENCES, unlockedAmbiences, backgroundForEra } from './rewards.js';

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
  const background = createBackground(ui.els.bgCanvas, { reducedMotion: reduced });

  const audioLoaded = loadAudioPrefs();
  const audioPrefs = audioLoaded.prefs;
  if (audioLoaded.recovered) console.warn('文明专注：声音偏好读取失败，已恢复默认声音设置。');
  const audio = createAudio({
    onState: (next) => {
      ui.setSoundButton(next);
      if (ui.els.settingsDialog.open) ui.renderSoundState(soundVM());
      if (next === 'playing') ui.announce('环境音正在播放');
      if (next === 'blocked') ui.announce('浏览器阻止了声音，可点击再次尝试');
      if (next === 'failed') ui.announce('声音素材加载失败，可点击重试');
    }
  });
  let pendingUnlock = null;

  function availableAmbiences() {
    return unlockedAmbiences(state.progress.completedRounds);
  }

  function reconcileAudioPrefs() {
    const list = availableAmbiences();
    if (!list.some((a) => a.id === audioPrefs.ambienceId)) {
      audioPrefs.ambienceId = list.length ? list[0].id : null;
    }
    if (!list.length) audioPrefs.enabled = false;
  }

  function persistAudio() {
    if (!saveAudioPrefs(audioPrefs)) console.warn('文明专注：声音偏好保存失败。');
  }

  function soundVM() {
    return {
      enabled: audioPrefs.enabled,
      muted: audioPrefs.muted,
      volume: audioPrefs.volume,
      ambienceId: audioPrefs.ambienceId,
      list: availableAmbiences().map((a) => ({ id: a.id, name: a.name })),
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

  const focusMs = () => state.settings.focusMinutes * 60000;
  const breakMs = () => state.settings.breakMinutes * 60000;

  function highestAvailable() {
    const rounds = state.progress.completedRounds;
    if (rounds >= 2 && ERAS.steam.available) return 'steam';
    if (rounds >= 1 && ERAS.tang.available) return 'tang';
    return 'stone';
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
    background.setEra(theme.id, state.progress.completedRounds);
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

    const nodes = ERA_ORDER.map((id, i) => {
      const era = ERAS[id];
      const unlocked = era.available && rounds >= era.unlockRounds;
      return {
        id,
        label: era.name,
        icon: ['stone', 'wheat', 'gear'][i],
        locked: !unlocked,
        current: state.progress.viewEra === id,
        tag: unlocked ? null : era.available ? `完成 ${era.unlockRounds} 轮解锁` : '后续版本开放'
      };
    });

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
          if (pendingUnlock) {
            const eraId = pendingUnlock;
            pendingUnlock = null;
            showUnlockCard(eraId);
          }
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

  /* ---------- rewards ---------- */

  function showUnlockCard(eraId) {
    const era = ERAS[eraId];
    const rows = [`图鉴新增 3 张：${era.codex.map((c) => c.title).join('、')}`];
    const bg = backgroundForEra(eraId, state.progress.completedRounds);
    if (bg && bg.eraId === eraId) rows.push(`背景 · ${bg.name}`);
    const amb = availableAmbiences().find((a) => a.eraId === eraId);
    if (amb) rows.push(`环境音 · ${amb.name}（可在设置中开启）`);
    ui.openUnlock({ name: era.name, tagline: era.tagline, rows });
  }

  function openCodexPanel(activeEra) {
    const rounds = state.progress.completedRounds;
    const eras = ERA_ORDER.filter((id) => ERAS[id].available && rounds >= ERAS[id].unlockRounds).map((id) => ({
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
    if (!already) audio.playComplete();
    reconcileAudioPrefs();
    refreshSoundUI();

    if (view === 'scene') {
      if (newEra) {
        swapSceneEra(newEra, () => showUnlockCard(newEra));
      } else {
        renderScene();
      }
    } else if (newEra) {
      pendingUnlock = newEra;
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
    persistAudio();
    audio.syncPrefs(audioPrefs);
    if (on && audioPrefs.ambienceId) audio.enable(audioPrefs.ambienceId);
    else audio.disable();
    refreshSoundUI();
  }

  function selectAmbience(id) {
    audioPrefs.ambienceId = id;
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
    else if (state === 'paused' || state === 'blocked' || state === 'failed') audio.resume();
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
    'sound-retry': () => audio.resume()
  };

  ui.bind({
    onAction: (id) => actions[id]?.(),
    onSettingsOpen: openSettings,
    onSettingsSubmit: saveSettings,
    onHotspot: openHotspot,
    onNode: browseEra,
    onSoundEnabled: setSoundEnabled,
    onSoundSelect: selectAmbience,
    onSoundVolume: setSoundVolume
  });

  reducedQuery.addEventListener('change', (event) => {
    reduced = event.matches;
    globe.setReduced(reduced);
    scene.setReduced(reduced);
    fx.setReduced(reduced);
    background.setReduced(reduced);
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
  reconcileAudioPrefs();
  audio.syncPrefs(audioPrefs);
  if (audioPrefs.enabled && audioPrefs.ambienceId) audio.markPaused();
  refreshSoundUI();
  checkNow();
  ui.showView('home');
  globe.setActive(true);
  scene.preload(state.progress.viewEra);
  document.body.dataset.appReady = 'true';
}