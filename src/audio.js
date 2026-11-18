import { ambienceById } from './rewards.js';

const CROSSFADE = 0.5;

export function createAudio({ onState = () => {} } = {}) {
  let ctx = null;
  let master = null;
  let current = null;
  let state = 'off';
  let prefs = { enabled: false, muted: false, volume: 0.6, ambienceId: null };
  let wantedId = null;
  const buffers = new Map();

  function setState(next) {
    state = next;
    onState(next);
  }

  function applyVolume() {
    if (master) master.gain.value = prefs.muted ? 0 : prefs.volume;
  }

  function ensureContext() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('unsupported');
      ctx = new Ctor();
      master = ctx.createGain();
      master.connect(ctx.destination);
      applyVolume();
    }
    return ctx;
  }

  function pickFile(files) {
    const probe = document.createElement('audio');
    if (files.ogg && probe.canPlayType('audio/ogg; codecs="opus"')) return files.ogg;
    if (files.m4a && probe.canPlayType('audio/mp4; codecs="mp4a.40.2"')) return files.m4a;
    return files.ogg || files.m4a;
  }

  async function fetchBuffer(id) {
    if (buffers.has(id)) return buffers.get(id);
    const entry = ambienceById(id);
    if (!entry || !entry.files) throw new Error('missing');
    const res = await fetch(pickFile(entry.files));
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(data);
    buffers.set(id, buffer);
    return buffer;
  }

  function fadeOutCurrent(seconds) {
    if (!current) return;
    const { src, gain } = current;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + seconds);
    src.stop(t + seconds + 0.05);
    current = null;
  }

  async function play(id, fade = CROSSFADE) {
    wantedId = id;
    setState('loading');
    try {
      ensureContext();
      await ctx.resume();
      if (ctx.state !== 'running') {
        const err = new Error('blocked');
        err.name = 'NotAllowedError';
        throw err;
      }
      const buffer = await fetchBuffer(id);
      const gain = ctx.createGain();
      gain.connect(master);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + fade);
      src.start(t);
      fadeOutCurrent(fade);
      current = { src, gain, id };
      setState(prefs.muted ? 'muted' : 'playing');
    } catch (err) {
      setState(err && err.name === 'NotAllowedError' ? 'blocked' : 'failed');
    }
  }

  return {
    syncPrefs(next) {
      prefs = next;
      applyVolume();
      if (current) setState(prefs.muted ? 'muted' : 'playing');
    },
    markPaused() {
      wantedId = prefs.ambienceId;
      setState('paused');
    },
    enable(id) {
      play(id);
    },
    resume() {
      const id = wantedId || prefs.ambienceId;
      if (id) play(id);
    },
    disable() {
      if (ctx && current) fadeOutCurrent(0.3);
      setState('off');
    },
    select(id) {
      wantedId = id;
      if (current) play(id);
    },
    setMuted(muted) {
      prefs = { ...prefs, muted };
      applyVolume();
      if (current) setState(muted ? 'muted' : 'playing');
    },
    setVolume(volume) {
      prefs = { ...prefs, volume };
      applyVolume();
    },
    playComplete() {
      if (!prefs.enabled || prefs.muted || prefs.volume <= 0) return;
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      [[660, 0], [880, 0.22]].forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + at);
        gain.gain.linearRampToValueAtTime(0.4, t + at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + at + 0.6);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t + at);
        osc.stop(t + at + 0.65);
      });
    },
    getState: () => state,
    getCurrentId: () => (current ? current.id : null)
  };
}