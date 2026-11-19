const ICONS = {
  pause: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
  reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.7 1.8v3h-3"/></svg>',
  home: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5 8 2.5l5.5 5"/><path d="M4 7v6.5h8V7"/></svg>',
  stop: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>',
  stone: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 15l3-5 3 3 2-3 4 5z"/><circle cx="8" cy="17.5" r="2"/><circle cx="13" cy="18" r="2.4"/><circle cx="17.5" cy="17" r="1.8"/></svg>',
  wheat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 21V8"/><path d="M12 12c-3 0-4.5-1.6-4.5-4C10.5 8 12 9.6 12 12z"/><path d="M12 12c3 0 4.5-1.6 4.5-4C13.5 8 12 9.6 12 12z"/><path d="M12 16c-3 0-4.5-1.6-4.5-4C10.5 12 12 13.6 12 16z"/><path d="M12 16c3 0 4.5-1.6 4.5-4C13.5 12 12 13.6 12 16z"/><path d="M12 8c-1-1.4-1-3 0-4.5C13 5 13 6.6 12 8z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></svg>'
};

export function createUI() {
  const $ = (id) => document.getElementById(id);
  const els = {
    home: $('home'),
    scene: $('scene'),
    globeCanvas: $('globe-canvas'),
    globeFallback: $('globe-fallback'),
    clock: $('clock'),
    settingsBtn: $('settings-btn'),
    sceneCanvas: $('scene-canvas'),
    hotspots: $('hotspots'),
    plaque: $('plaque'),
    plaqueCount: $('plaque-count'),
    plaqueStatus: $('plaque-status'),
    plaqueLocal: $('plaque-local'),
    plaqueControls: $('plaque-controls'),
    plaqueChoices: $('plaque-choices'),
    hintText: $('scene-hint-text'),
    progressFill: $('progress-fill'),
    progressNodes: $('progress-nodes'),
    fxCanvas: $('fx-canvas'),
    settingsDialog: $('settings-dialog'),
    settingsForm: $('settings-form'),
    focusInput: $('focus-minutes'),
    breakInput: $('break-minutes'),
    focusError: $('focus-error'),
    breakError: $('break-error'),
    settingsError: $('settings-error'),
    confirmDialog: $('confirm-dialog'),
    codexDialog: $('codex-dialog'),
    codexTag: $('codex-tag'),
    codexTitle: $('codex-title'),
    codexUse: $('codex-use'),
    codexText: $('codex-text'),
    codexSlice: $('codex-slice'),
    bgCanvas: $('bg-canvas'),
    soundBtn: $('sound-btn'),
    codexPanelBtn: $('codex-panel-btn'),
    soundEnabled: $('sound-enabled'),
    soundList: $('sound-list'),
    soundVolume: $('sound-volume'),
    soundVolumeValue: $('sound-volume-value'),
    soundMute: $('sound-mute'),
    soundStatus: $('sound-status'),
    soundRetry: $('sound-retry'),
    codexPanelDialog: $('codex-panel-dialog'),
    codexTabs: $('codex-tabs'),
    codexCards: $('codex-cards'),
    unlockDialog: $('unlock-dialog'),
    unlockTitle: $('unlock-title'),
    unlockTagline: $('unlock-tagline'),
    unlockRows: $('unlock-rows'),
    srStatus: $('sr-status')
  };

  let handlers = {
    onAction: () => {},
    onSettingsOpen: () => {},
    onSettingsSubmit: () => {},
    onHotspot: () => {},
    onNode: () => {},
    onSoundEnabled: () => {},
    onSoundSelect: () => {},
    onSoundVolume: () => {}
  };
  let lastConfirmTrigger = null;
  let lastHotspotTrigger = null;
  let lastPanelTrigger = null;
  let lastUnlockTrigger = null;
  let panelVM = null;

  document.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      handlers.onAction(actionEl.dataset.action, actionEl);
      return;
    }
    const nodeEl = event.target.closest('[data-node]');
    if (nodeEl && !nodeEl.disabled) handlers.onNode(nodeEl.dataset.node);
  });

  els.settingsBtn.addEventListener('click', () => handlers.onSettingsOpen());
  els.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSettingsSubmit();
  });

  function clearFieldError(field) {
    const input = field === 'focus' ? els.focusInput : els.breakInput;
    const err = field === 'focus' ? els.focusError : els.breakError;
    err.hidden = true;
    err.textContent = '';
    input.removeAttribute('aria-invalid');
    els.settingsError.hidden = true;
    els.settingsError.textContent = '';
  }

  els.focusInput.addEventListener('input', () => clearFieldError('focus'));
  els.breakInput.addEventListener('input', () => clearFieldError('break'));

  for (const dialog of [els.settingsDialog, els.confirmDialog, els.codexDialog, els.codexPanelDialog, els.unlockDialog]) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
  els.settingsDialog.addEventListener('close', () => els.settingsBtn.focus({ preventScroll: true }));
  els.confirmDialog.addEventListener('close', () => lastConfirmTrigger?.focus({ preventScroll: true }));
  els.codexDialog.addEventListener('close', () => lastHotspotTrigger?.focus({ preventScroll: true }));
  els.codexPanelDialog.addEventListener('close', () => lastPanelTrigger?.focus({ preventScroll: true }));
  els.unlockDialog.addEventListener('close', () => lastUnlockTrigger?.focus({ preventScroll: true }));

  els.soundEnabled.addEventListener('change', () => handlers.onSoundEnabled(els.soundEnabled.checked));
  els.soundVolume.addEventListener('input', () => handlers.onSoundVolume(Number(els.soundVolume.value) / 100));
  els.soundList.addEventListener('change', (event) => {
    if (event.target.name === 'ambience') handlers.onSoundSelect(event.target.value);
  });

  function bind(next) {
    handlers = { ...handlers, ...next };
  }

  function showView(view) {
    els.home.hidden = view !== 'home';
    els.scene.hidden = view !== 'scene';
    document.body.dataset.view = view;
  }

  function chipButton(action, label, icon, primary = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip-btn${primary ? ' primary' : ''}`;
    b.dataset.action = action;
    b.innerHTML = `${ICONS[icon] || ''}<span>${label}</span>`;
    return b;
  }

  function renderScene(vm) {
    els.plaqueCount.textContent = vm.count;
    els.plaqueStatus.textContent = vm.status;
    els.plaqueLocal.textContent = vm.local;
    els.plaque.dataset.state = vm.runState;
    els.hintText.textContent = vm.hint;

    const focused = els.plaque.contains(document.activeElement) ? document.activeElement.dataset?.action : null;
    els.plaqueControls.innerHTML = '';
    els.plaqueChoices.innerHTML = '';
    els.plaqueChoices.hidden = true;

    if (vm.choices) {
      els.plaqueChoices.hidden = false;
      vm.choices.forEach((c) => els.plaqueChoices.appendChild(chipButton(c.id, c.label, c.icon, c.primary)));
      els.plaqueControls.appendChild(chipButton('back-home', '首页', 'home'));
    } else {
      vm.controls.forEach((c) => els.plaqueControls.appendChild(chipButton(c.id, c.label, c.icon, c.primary)));
    }
    if (focused) {
      const same = els.plaque.querySelector(`[data-action="${focused}"]`);
      if (same) same.focus({ preventScroll: true });
    }

    els.progressFill.style.width = `${vm.fill}%`;
    els.progressNodes.innerHTML = '';
    vm.nodes.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `node${n.current ? ' is-current' : ''}${n.locked ? ' is-locked' : ' is-unlocked'}`;
      b.dataset.node = n.id;
      b.disabled = n.locked;
      b.setAttribute('aria-label', `${n.label}${n.locked ? '（未解锁）' : ''}`);
      b.innerHTML = `
        <span class="node-medal">${ICONS[n.icon]}</span>
        <span class="node-label">${n.label}</span>
        ${n.tag ? `<span class="node-tag">${n.tag}</span>` : ''}
      `;
      els.progressNodes.appendChild(b);
    });
  }

  function setCount(text) {
    if (els.plaqueCount.textContent !== text) els.plaqueCount.textContent = text;
  }

  function setLocal(text) {
    if (els.plaqueLocal.textContent !== text) els.plaqueLocal.textContent = text;
  }

  function setFill(pct) {
    els.progressFill.style.width = `${pct}%`;
  }

  function renderHotspots(items) {
    els.hotspots.innerHTML = '';
    items.forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hotspot';
      b.style.left = `${item.x}px`;
      b.style.top = `${item.y}px`;
      b.dataset.hotspot = item.id;
      b.setAttribute('aria-label', `查看图鉴：${item.title}`);
      b.innerHTML = `<span class="hotspot-ring"><span class="hotspot-dot"></span></span><span class="hotspot-label">${item.title}</span>`;
      b.addEventListener('click', () => {
        lastHotspotTrigger = b;
        handlers.onHotspot(item.id);
      });
      els.hotspots.appendChild(b);
    });
  }

  function openCodex(item, sliceUrl) {
    els.codexTag.textContent = item.tag;
    els.codexTitle.textContent = item.title;
    els.codexUse.textContent = `用途 · ${item.use}`;
    els.codexText.textContent = item.text;
    if (sliceUrl) {
      els.codexSlice.src = sliceUrl;
      els.codexSlice.hidden = false;
    } else {
      els.codexSlice.hidden = true;
      els.codexSlice.removeAttribute('src');
    }
    if (!els.codexDialog.open) els.codexDialog.showModal();
  }

  function closeCodex() {
    if (els.codexDialog.open) els.codexDialog.close();
  }

  function renderCodexCards(eraId) {
    const era = panelVM.eras.find((e) => e.id === eraId);
    els.codexCards.innerHTML = '';
    if (!era) return;
    era.items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'codex-card';
      const img = document.createElement('img');
      img.className = 'codex-slice';
      img.src = item.slice;
      img.alt = `${item.title} 场景切片`;
      const h = document.createElement('h3');
      h.textContent = item.title;
      const use = document.createElement('p');
      use.className = 'codex-use';
      use.textContent = `用途 · ${item.use}`;
      const text = document.createElement('p');
      text.className = 'codex-text';
      text.textContent = item.text;
      card.append(img, h, use, text);
      els.codexCards.appendChild(card);
    });
    [...els.codexTabs.children].forEach((tab) => {
      const on = tab.dataset.era === eraId;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
  }

  function openCodexPanel(vm) {
    panelVM = vm;
    lastPanelTrigger = document.activeElement;
    els.codexTabs.innerHTML = '';
    vm.eras.forEach((era) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'codex-tab';
      tab.role = 'tab';
      tab.dataset.era = era.id;
      tab.id = `codex-tab-${era.id}`;
      tab.textContent = era.name;
      tab.addEventListener('click', () => renderCodexCards(era.id));
      els.codexTabs.appendChild(tab);
    });
    renderCodexCards(vm.activeEra);
    if (!els.codexPanelDialog.open) els.codexPanelDialog.showModal();
  }

  function closeCodexPanel() {
    if (els.codexPanelDialog.open) els.codexPanelDialog.close();
  }

  function openUnlock(vm) {
    lastUnlockTrigger = document.activeElement;
    els.unlockTitle.textContent = vm.name;
    els.unlockTagline.textContent = vm.tagline;
    els.unlockRows.innerHTML = '';
    vm.rows.forEach((row) => {
      const li = document.createElement('li');
      li.textContent = row;
      els.unlockRows.appendChild(li);
    });
    if (!els.unlockDialog.open) els.unlockDialog.showModal();
  }

  function closeUnlock() {
    if (els.unlockDialog.open) els.unlockDialog.close();
  }

  function renderSoundList(vm) {
    els.soundList.innerHTML = '';
    vm.list.forEach((item) => {
      const label = document.createElement('label');
      label.className = 'sound-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'ambience';
      input.value = item.id;
      input.checked = item.id === vm.ambienceId;
      const span = document.createElement('span');
      span.textContent = item.name;
      label.append(input, span);
      els.soundList.appendChild(label);
    });
    els.soundList.hidden = vm.list.length === 0;
  }

  const SOUND_STATUS = {
    off: '声音已关闭。开启后才会加载与播放环境音。',
    loading: '加载中…',
    playing: '正在播放环境音。',
    muted: '已静音。',
    paused: '已保留开启偏好，点击恢复声音后继续播放。',
    blocked: '浏览器阻止了声音，点击再次尝试。',
    failed: '声音素材加载失败，点击重试。'
  };

  function renderSoundState(vm) {
    els.soundEnabled.checked = vm.enabled;
    els.soundVolume.value = String(Math.round(vm.volume * 100));
    els.soundVolumeValue.textContent = String(Math.round(vm.volume * 100));
    els.soundMute.setAttribute('aria-pressed', String(vm.muted));
    els.soundMute.setAttribute('aria-label', vm.muted ? '取消静音' : '静音');
    els.soundMute.classList.toggle('is-muted', vm.muted);
    els.soundStatus.textContent = vm.list.length ? SOUND_STATUS[vm.state] || '' : '当前进度下暂无可用环境音。';
    els.soundRetry.hidden = !(vm.state === 'blocked' || vm.state === 'failed');
    els.soundEnabled.disabled = vm.list.length === 0;
    els.soundVolume.disabled = !vm.enabled;
    els.soundMute.disabled = !vm.enabled;
    [...els.soundList.querySelectorAll('input')].forEach((input) => {
      input.disabled = !vm.enabled;
    });
  }

  function setSoundButton(state) {
    const btn = els.soundBtn;
    btn.classList.toggle('is-muted', state === 'muted' || state === 'off');
    btn.classList.toggle('is-blocked', state === 'blocked' || state === 'failed');
    const labels = {
      off: '开启声音',
      loading: '声音加载中',
      playing: '静音',
      muted: '取消静音',
      paused: '点击恢复声音',
      blocked: '浏览器阻止了声音，点击再次尝试',
      failed: '声音加载失败，点击重试'
    };
    btn.setAttribute('aria-label', labels[state] || '声音');
    btn.title = labels[state] || '声音';
  }

  function openSettings(settings) {
    clearFieldError('focus');
    clearFieldError('break');
    els.focusInput.value = String(settings.focusMinutes);
    els.breakInput.value = String(settings.breakMinutes);
    if (!els.settingsDialog.open) els.settingsDialog.showModal();
    els.focusInput.focus({ preventScroll: true });
    els.focusInput.select();
  }

  function closeSettings() {
    if (els.settingsDialog.open) els.settingsDialog.close();
  }

  function getSettingsInput() {
    return { focus: els.focusInput.value, break: els.breakInput.value };
  }

  function setSettingsErrors(errors = {}) {
    const apply = (input, err, message) => {
      if (message) {
        err.hidden = false;
        err.textContent = message;
        input.setAttribute('aria-invalid', 'true');
      } else {
        err.hidden = true;
        err.textContent = '';
        input.removeAttribute('aria-invalid');
      }
    };
    apply(els.focusInput, els.focusError, errors.focus);
    apply(els.breakInput, els.breakError, errors.break);
    if (errors.form) {
      els.settingsError.hidden = false;
      els.settingsError.textContent = errors.form;
    } else {
      els.settingsError.hidden = true;
      els.settingsError.textContent = '';
    }
    if (errors.focus) els.focusInput.focus({ preventScroll: true });
    else if (errors.break) els.breakInput.focus({ preventScroll: true });
  }

  function openConfirm() {
    lastConfirmTrigger = document.activeElement;
    if (!els.confirmDialog.open) els.confirmDialog.showModal();
  }

  function closeConfirm() {
    if (els.confirmDialog.open) els.confirmDialog.close();
  }

  function announce(text) {
    els.srStatus.textContent = '';
    window.setTimeout(() => {
      els.srStatus.textContent = text;
    }, 60);
  }

  return {
    els,
    bind,
    showView,
    renderScene,
    setCount,
    setLocal,
    setFill,
    renderHotspots,
    openCodex,
    closeCodex,
    openCodexPanel,
    closeCodexPanel,
    openUnlock,
    closeUnlock,
    renderSoundList,
    renderSoundState,
    setSoundButton,
    openSettings,
    closeSettings,
    getSettingsInput,
    setSettingsErrors,
    openConfirm,
    closeConfirm,
    announce
  };
}

/* ---------------- pixel dissolve transition ---------------- */

export function createFx(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  let reduced = reducedMotion;
  let cells = [];
  let raf = 0;
  let active = false;

  function layout() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const size = 26;
    const cols = Math.ceil(canvas.width / size);
    const rows = Math.ceil(canvas.height / size);
    cells = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const r = h - Math.floor(h);
        cells.push({ x: x * size, y: y * size, t: r, tone: (x * 7 + y * 13) % 5 });
      }
    }
  }

  function draw(p) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (p <= 0) return;
    for (const c of cells) {
      if (c.t > p) continue;
      const shade = c.tone === 0 ? '#12203a' : c.tone === 1 ? '#0b1526' : c.tone === 2 ? '#0e1a2e' : c.tone === 3 ? '#13223c' : '#0a1220';
      ctx.fillStyle = shade;
      ctx.fillRect(c.x, c.y, 26, 26);
      if (c.tone === 4 && p > 0.5) {
        ctx.fillStyle = 'rgba(240,169,95,0.16)';
        ctx.fillRect(c.x + 8, c.y + 8, 10, 10);
      }
    }
  }

  function tween(from, to, duration, onDone) {
    if (raf) cancelAnimationFrame(raf);
    if (reduced || duration <= 0) {
      draw(to);
      onDone?.();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t * t * (3 - 2 * t);
      draw(from + (to - from) * e);
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(step);
  }

  layout();
  window.addEventListener('resize', () => {
    layout();
    if (active) draw(1);
  });

  return {
    cover(duration, cb) {
      active = true;
      canvas.classList.add('is-active');
      tween(0, 1, reduced ? 100 : duration, cb);
    },
    reveal(duration, cb) {
      tween(1, 0, reduced ? 100 : duration, () => {
        active = false;
        canvas.classList.remove('is-active');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cb?.();
      });
    },
    setReduced(next) {
      reduced = next;
    },
    isActive: () => active
  };
}