let fallbackSeq = 0;

export function newRoundId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* file:// or old browser */
  }
  fallbackSeq += 1;
  return `r-${Date.now().toString(36)}-${fallbackSeq.toString(36)}`;
}

export function createIdleRun(focusMs) {
  return {
    mode: 'focus',
    status: 'idle',
    durationMs: focusMs,
    deadline: null,
    remainingMs: null,
    roundId: null,
    completion: null
  };
}

export function startRun(mode, durationMs, now) {
  return {
    mode,
    status: 'running',
    durationMs,
    deadline: now + durationMs,
    remainingMs: null,
    roundId: newRoundId(),
    completion: null
  };
}

export function pauseRun(run, now) {
  if (run.status !== 'running') return run;
  const remainingMs = Math.max(0, run.deadline - now);
  return {
    ...run,
    status: 'paused',
    deadline: null,
    remainingMs
  };
}

export function resumeRun(run, now) {
  if (run.status !== 'paused') return run;
  const remainingMs = Math.max(0, run.remainingMs ?? run.durationMs);
  return {
    ...run,
    status: 'running',
    deadline: now + remainingMs,
    remainingMs: null
  };
}

export function remainingOf(run, now) {
  if (run.status === 'running' && run.deadline != null) {
    return Math.max(0, run.deadline - now);
  }
  if (run.status === 'paused') {
    return Math.max(0, run.remainingMs ?? run.durationMs);
  }
  if (run.status === 'done') return 0;
  return run.durationMs;
}

export function isDue(run, now) {
  return run.status === 'running' && run.deadline != null && now >= run.deadline;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
