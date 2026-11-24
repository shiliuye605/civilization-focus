// The framing is defined in the moving hand's screen space. Panning therefore
// keeps the chosen neighbourhood in view even while the clock revolves.
export function createSettlementInspection(canvas, canInspect, redraw) {
  const points = new Map();
  let zoom = 1,
    pan = 0;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function magnify(factor) {
    zoom = clamp(zoom * factor, 1, 2.6);
    if (zoom === 1) pan = 0;
  }
  function move(fraction) {
    pan = clamp(pan + fraction, -1, 1);
  }
  function span() {
    const [a, b] = points.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!canInspect() || e.ctrlKey) return;
      e.preventDefault();
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1);
      magnify(Math.exp(-clamp(pixels, -400, 400) * 0.0018));
      redraw();
    },
    { passive: false },
  );
  canvas.addEventListener('pointerdown', (e) => {
    if (!canInspect() || e.button !== 0 || points.size >= 2) return;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const old = points.get(e.pointerId);
    if (!old || !canInspect()) return;
    const dx = e.clientX - old.x,
      previous = points.size === 2 ? span() : 0;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (previous > 4) magnify(span() / previous);
    else if (zoom > 1.01) move((-2 * dx) / (canvas.clientWidth * (zoom - 1)));
    redraw();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, (e) => points.delete(e.pointerId));
  }
  canvas.addEventListener('keydown', (e) => {
    if (!canInspect()) return;
    switch (e.key) {
      case '+':
      case '=':
        magnify(1.25);
        break;
      case '-':
        magnify(0.8);
        break;
      case 'ArrowLeft':
        move(-0.25);
        break;
      case 'ArrowRight':
        move(0.25);
        break;
      default:
        return;
    }
    e.preventDefault();
    redraw();
  });
  return {
    get zoom() {
      return zoom;
    },
    get pan() {
      return pan;
    },
    reset() {
      zoom = 1;
      pan = 0;
      points.clear();
    },
  };
}
