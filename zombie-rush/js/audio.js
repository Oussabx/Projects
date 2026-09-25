// Tiny synthesized sound engine: clean SFX and a looping chiptune-ish track.
// Everything is generated with WebAudio, so there are no audio files.

const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf = null;
  let vol = { music: 0.5, sfx: 0.8 };
  const last = {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      applyVolumes();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function applyVolumes() {
    if (!ctx) return;
    // Squared curve feels more natural on a slider.
    sfxBus.gain.setTargetAtTime(vol.sfx * vol.sfx, ctx.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(vol.music * vol.music * 0.6, ctx.currentTime, 0.05);
  }

  function setVolumes(music, sfx) {
    vol = { music, sfx };
    applyVolumes();
  }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function tone({ freq, to, dur = 0.1, type = 'sine', vol: v = 0.3, delay = 0, attack = 0.004, bus = sfxBus, at }) {
    const t = (at ?? ctx.currentTime) + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.1, vol: v = 0.2, freq = 1200, to, type = 'lowpass', q = 0.8, delay = 0, bus = sfxBus, at }) {
    const t = (at ?? ctx.currentTime) + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const arp = (notes, step, opts) => notes.forEach((n, i) => tone({ freq: midi(n), delay: i * step, ...opts }));

  const SFX = {
    click:    () => tone({ freq: 740, to: 980, dur: 0.06, type: 'triangle', vol: 0.18 }),
    shoot:    () => { tone({ freq: 1100, to: 420, dur: 0.045, type: 'square', vol: 0.03 }); noise({ dur: 0.03, vol: 0.03, freq: 5000, type: 'highpass' }); },
    hit:      () => noise({ dur: 0.035, vol: 0.06, freq: 2600, type: 'bandpass', q: 2 }),
    kill:     () => tone({ freq: 420, to: 140, dur: 0.1, type: 'triangle', vol: 0.14 }),
    coin:     () => { tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.06 }); tone({ freq: 1319, dur: 0.14, type: 'square', vol: 0.06, delay: 0.07 }); },
    gateGood: () => arp([72, 76, 79, 84], 0.05, { dur: 0.14, type: 'triangle', vol: 0.16 }),
    gateBad:  () => arp([67, 63, 58], 0.07, { dur: 0.16, type: 'sawtooth', vol: 0.07 }),
    powerup:  () => arp([67, 71, 74, 79, 83], 0.04, { dur: 0.12, type: 'square', vol: 0.06 }),
    explode:  () => { noise({ dur: 0.45, vol: 0.35, freq: 1400, to: 120 }); tone({ freq: 140, to: 40, dur: 0.35, type: 'sine', vol: 0.35 }); },
    hurt:     () => { tone({ freq: 200, to: 70, dur: 0.2, type: 'sawtooth', vol: 0.12 }); noise({ dur: 0.12, vol: 0.12, freq: 600 }); },
    block:    () => tone({ freq: 1400, to: 900, dur: 0.12, type: 'triangle', vol: 0.12 }),
    throw:    () => noise({ dur: 0.35, vol: 0.12, freq: 400, to: 2400, type: 'bandpass', q: 3 }),
    thud:     () => { tone({ freq: 110, to: 45, dur: 0.22, type: 'sine', vol: 0.3 }); noise({ dur: 0.15, vol: 0.12, freq: 500 }); },
    warn:     () => { for (let i = 0; i < 2; i++) { tone({ freq: 660, dur: 0.16, type: 'square', vol: 0.06, delay: i * 0.36 }); tone({ freq: 495, dur: 0.16, type: 'square', vol: 0.06, delay: i * 0.36 + 0.18 }); } },
    victory:  () => { arp([72, 76, 79], 0.12, { dur: 0.2, type: 'triangle', vol: 0.2 }); tone({ freq: midi(84), dur: 0.6, type: 'triangle', vol: 0.2, delay: 0.38 }); tone({ freq: midi(79), dur: 0.6, type: 'sine', vol: 0.1, delay: 0.38 }); },
    defeat:   () => arp([67, 64, 60, 55], 0.18, { dur: 0.3, type: 'triangle', vol: 0.16 }),
    chest:    () => { for (let i = 0; i < 6; i++) noise({ dur: 0.06, vol: 0.1, freq: 900, type: 'bandpass', q: 3, delay: i * 0.13 }); },
    reveal:   () => { arp([72, 76, 79, 83, 86], 0.05, { dur: 0.3, type: 'triangle', vol: 0.14 }); noise({ dur: 0.5, vol: 0.05, freq: 6000, type: 'highpass' }); },
    upgrade:  () => arp([64, 71, 76], 0.06, { dur: 0.14, type: 'square', vol: 0.07 }),
    equip:    () => { noise({ dur: 0.06, vol: 0.15, freq: 1800, type: 'bandpass', q: 1.5 }); tone({ freq: 520, to: 780, dur: 0.1, type: 'triangle', vol: 0.12, delay: 0.03 }); },
  };

  // Minimum gap (ms) between repeats of rapid-fire sounds.
  const THROTTLE = { shoot: 55, hit: 45, kill: 40, coin: 60, throw: 100 };

  function play(name) {
    if (vol.sfx <= 0 || !ensure() || ctx.state !== 'running') return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap && last[name] && now - last[name] < gap) return;
    last[name] = now;
    SFX[name]?.();
  }

  // ---------- Music ----------
  // A four-chord loop (Am F C G). Menu: calm arpeggio. Battle: faster with drums.

  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  let mode = 'menu', step = 0, nextTime = 0, timer = null;

  function playStep(s, t) {
    const battle = mode === 'battle';
    const chord = CHORDS[Math.floor(s / 8) % 4];
    const beat = s % 8;
    const bus = musicBus;
    if (beat === 0 || beat === 4) tone({ freq: midi(chord[0] - 12), dur: battle ? 0.28 : 0.5, type: 'triangle', vol: 0.22, bus, at: t });
    if (battle || beat % 2 === 0) {
      const n = chord[(beat + (battle ? Math.floor(s / 4) : 0)) % 3] + 12;
      tone({ freq: midi(n), dur: 0.16, type: battle ? 'square' : 'sine', vol: battle ? 0.035 : 0.09, bus, at: t });
    }
    if (battle) {
      if (beat % 4 === 0) tone({ freq: 130, to: 45, dur: 0.14, type: 'sine', vol: 0.4, bus, at: t });
      if (beat % 4 === 2) noise({ dur: 0.1, vol: 0.12, freq: 1800, type: 'bandpass', q: 0.7, bus, at: t });
      if (beat % 2 === 1) noise({ dur: 0.04, vol: 0.05, freq: 7000, type: 'highpass', bus, at: t });
    }
  }

  function tick() {
    const bpm = mode === 'battle' ? 132 : 92;
    const stepDur = 60 / bpm / 2;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.15) {
      if (vol.music > 0) playStep(step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % 32;
    }
  }

  function startMusic() {
    if (timer || !ensure()) return;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 30);
  }

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    step = 0;
  }

  // Browsers only allow audio after a user gesture.
  function unlock() {
    if (ensure()) startMusic();
  }
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return { play, setVolumes, setMode };
})();
