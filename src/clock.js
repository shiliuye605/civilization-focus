function pad(value) {
  return String(value).padStart(2, '0');
}

export function createClock(el) {
  let timeEl = null;
  let lastText = '';
  let styleId = '';
  let destroyed = false;

  el.classList.add('clock');
  timeEl = document.createElement('span');
  timeEl.className = 'clock-time';
  el.replaceChildren(timeEl);

  function tick() {
    if (destroyed) return;
    const now = new Date();
    const text = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (text !== lastText) {
      timeEl.textContent = text;
      lastText = text;
    }
  }

  function setTheme(theme) {
    const next =
      theme.clockStyle === 'wood'
        ? 'wood'
        : theme.clockStyle === 'industrial'
          ? 'industrial'
          : 'stone';
    if (next === styleId) {
      tick();
      return;
    }
    styleId = next;
    el.classList.remove('clock--stone', 'clock--wood', 'clock--industrial');
    el.classList.add(`clock--${next}`);
    tick();
  }

  const interval = window.setInterval(tick, 1000);
  tick();

  return {
    setTheme,
    tick,
    destroy() {
      destroyed = true;
      window.clearInterval(interval);
    }
  };
}