const KEY = 'wmf:v1:audio';

export function defaultAudioPrefs() {
  return { version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null };
}

export function loadAudioPrefs() {
  const fallback = defaultAudioPrefs();
  let raw;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return { prefs: fallback, recovered: false };
  }
  if (!raw) return { prefs: fallback, recovered: false };
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error('bad shape');
    const volume = Number(data.volume);
    return {
      prefs: {
        version: 1,
        enabled: data.enabled === true,
        muted: data.muted === true,
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : fallback.volume,
        ambienceId: typeof data.ambienceId === 'string' ? data.ambienceId : null
      },
      recovered: false
    };
  } catch {
    return { prefs: fallback, recovered: true };
  }
}

export function saveAudioPrefs(prefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...prefs, version: 1 }));
    return true;
  } catch {
    return false;
  }
}