// Tiny synthesized sound engine: soft, rounded SFX and a looping soundtrack.
// Everything is generated with WebAudio, so there are no audio files.

const Sound = (() => {
  let ctx = null, out, sfxBus, musicBus, echo, noiseBuf = null;
  let vol = { music: 0.5, sfx: 0.8 };
  const last = {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();

      // Gentle compressor keeps many overlapping sounds from clipping.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.2;
      out = ctx.createGain();
      out.gain.value = 0.9;
      comp.connect(out).connect(ctx.destination);

      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(comp);
      musicBus.connect(comp);

      // Soft echo send used by music and a few sparkly effects.
      echo = ctx.createGain();
      echo.gain.value = 0.22;
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.27;
      const fb = ctx.createGain(); fb.gain.value = 0.3;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
      echo.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(comp);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function applyVolumes() {
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(vol.sfx * vol.sfx * 0.9, ctx.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(vol.music * vol.music * 0.55, ctx.currentTime, 0.05);
  }

  function setVolumes(music, sfx) { vol = { music, sfx }; applyVolumes(); }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const jitter = (v, amt) => v * (1 + (Math.random() * 2 - 1) * amt);

  // One enveloped voice through a low-pass filter: rounded, never harsh.
  function voice({ freq, to, dur = 0.15, type = 'sine', vol: v = 0.2, attack = 0.005, cutoff = 4000, cutTo, delay = 0, bus = sfxBus, send = 0, at, detune = 0 }) {
    const t = (at ?? ctx.currentTime) + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.9);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    if (cutTo) f.frequency.exponentialRampToValueAtTime(cutTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(echo); }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.1, vol: v = 0.2, freq = 1200, to, type = 'lowpass', q = 0.7, delay = 0, bus = sfxBus, at, attack = 0.002 }) {
    const t = (at ?? ctx.currentTime) + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // A soft bell: sine plus a quiet octave partial.
  function bell(note, { delay = 0, vol: v = 0.12, dur = 0.35, send = 0.3 } = {}) {
    voice({ freq: midi(note), dur, vol: v, delay, send, attack: 0.004 });
    voice({ freq: midi(note + 12), dur: dur * 0.6, vol: v * 0.3, delay, send });
  }

  const SFX = {
    click:    () => voice({ freq: 1250, to: 900, dur: 0.05, vol: 0.08, cutoff: 3000 }),
    shoot:    () => {
      noise({ dur: 0.05, vol: 0.05, freq: jitter(2400, 0.15), to: 700, type: 'bandpass', q: 1.2 });
      voice({ freq: jitter(220, 0.08), to: 90, dur: 0.06, vol: 0.07, cutoff: 900 });
    },
    hit:      () => noise({ dur: 0.03, vol: 0.035, freq: jitter(3200, 0.2), type: 'bandpass', q: 3 }),
    kill:     () => {
      voice({ freq: jitter(520, 0.12), to: 180, dur: 0.12, vol: 0.12, type: 'triangle', cutoff: 1800 });
      noise({ dur: 0.08, vol: 0.05, freq: 900, type: 'lowpass' });
    },
    coin:     () => { bell(88, { vol: 0.08, dur: 0.12 }); bell(93, { delay: 0.07, vol: 0.09, dur: 0.3 }); },
    gateGood: () => [72, 76, 79, 84].forEach((n, i) => bell(n, { delay: i * 0.055, vol: 0.1, dur: 0.4 })),
    gateBad:  () => [67, 63, 60].forEach((n, i) => voice({ freq: midi(n), dur: 0.22, vol: 0.1, type: 'triangle', cutoff: 1200, delay: i * 0.08 })),
    powerup:  () => { voice({ freq: 300, to: 1200, dur: 0.25, vol: 0.08, type: 'triangle', cutoff: 3000, send: 0.3 }); bell(84, { delay: 0.18, vol: 0.08 }); },
    explode:  () => {
      noise({ dur: 0.6, vol: 0.28, freq: 1600, to: 90, attack: 0.004 });
      voice({ freq: 110, to: 38, dur: 0.45, vol: 0.32, cutoff: 400 });
    },
    hurt:     () => { voice({ freq: 160, to: 70, dur: 0.2, vol: 0.2, type: 'triangle', cutoff: 700 }); noise({ dur: 0.12, vol: 0.08, freq: 500 }); },
    block:    () => bell(91, { vol: 0.08, dur: 0.2, send: 0.2 }),
    throw:    () => noise({ dur: 0.4, vol: 0.08, freq: 350, to: 1800, type: 'bandpass', q: 2, attack: 0.08 }),
    thud:     () => { voice({ freq: 90, to: 40, dur: 0.3, vol: 0.28, cutoff: 300 }); noise({ dur: 0.18, vol: 0.1, freq: 400 }); },
    warn:     () => { for (let i = 0; i < 2; i++) { voice({ freq: midi(76), dur: 0.22, vol: 0.09, type: 'triangle', cutoff: 2000, delay: i * 0.46 }); voice({ freq: midi(71), dur: 0.22, vol: 0.09, type: 'triangle', cutoff: 2000, delay: i * 0.46 + 0.23 }); } },
    victory:  () => {
      [72, 76, 79].forEach((n, i) => bell(n, { delay: i * 0.13, vol: 0.13, dur: 0.3 }));
      [60, 64, 67, 72].forEach(n => voice({ freq: midi(n), dur: 1.4, vol: 0.05, type: 'triangle', cutoff: 1800, attack: 0.08, delay: 0.4, send: 0.4 }));
      bell(84, { delay: 0.4, vol: 0.14, dur: 1 });
    },
    defeat:   () => [69, 65, 62, 57].forEach((n, i) => voice({ freq: midi(n), dur: 0.5, vol: 0.1, type: 'triangle', cutoff: 1200, delay: i * 0.22, send: 0.3 })),
    chest:    () => { for (let i = 0; i < 5; i++) noise({ dur: 0.07, vol: 0.09, freq: jitter(700, 0.2), type: 'bandpass', q: 2, delay: i * 0.17 }); },
    reveal:   () => { [79, 83, 86, 91].forEach((n, i) => bell(n, { delay: i * 0.06, vol: 0.09, dur: 0.6, send: 0.45 })); noise({ dur: 0.7, vol: 0.03, freq: 7000, type: 'highpass', attack: 0.1 }); },
    upgrade:  () => [67, 74, 79].forEach((n, i) => bell(n, { delay: i * 0.07, vol: 0.1, dur: 0.3 })),
    equip:    () => { noise({ dur: 0.05, vol: 0.1, freq: 1500, type: 'bandpass', q: 1.5 }); bell(79, { delay: 0.04, vol: 0.08, dur: 0.2, send: 0.1 }); },
  };

  // Minimum gap (ms) between repeats of rapid-fire sounds.
  const THROTTLE = { shoot: 70, hit: 60, kill: 45, coin: 70, throw: 120, click: 40 };

  function play(name) {
    if (vol.sfx <= 0 || !ensure() || ctx.state !== 'running') return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap && last[name] && now - last[name] < gap) return;
    last[name] = now;
    SFX[name]?.();
  }

  // ---------- Music ----------
  // Menu: warm major loop (C Am F G). Battle: driving minor loop (Am F C G).

  const SONGS = {
    menu: {
      bpm: 96,
      chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
      melody: [[72, null, 76, null, 79, null, 76, 74], [72, null, 69, null, 72, 74, 76, null], [77, null, 76, null, 72, null, 69, null], [71, null, 74, 76, 74, null, 71, null]],
    },
    battle: {
      bpm: 128,
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      melody: [[69, 72, 76, 72, 81, 76, 72, 76], [69, 72, 77, 72, 81, 77, 72, 77], [67, 72, 76, 72, 79, 76, 72, 76], [67, 71, 74, 71, 79, 74, 71, 74]],
    },
  };
  let mode = 'menu', step = 0, nextTime = 0, timer = null;

  function playStep(s, t) {
    const song = SONGS[mode];
    const bar = Math.floor(s / 8) % 4;
    const beat = s % 8;
    const chord = song.chords[bar];
    const bus = musicBus;
    const beatLen = 60 / song.bpm;
    const battle = mode === 'battle';

    // Pad: soft detuned chord at the start of each bar.
    if (beat === 0) {
      for (const n of chord) {
        for (const d of [-7, 7]) voice({ freq: midi(n), dur: beatLen * 4.2, vol: battle ? 0.025 : 0.035, type: 'triangle', cutoff: 1400, attack: 0.25, bus, at: t, detune: d, send: 0.25 });
      }
    }
    // Bass
    if (battle ? beat % 2 === 0 : beat % 4 === 0) {
      voice({ freq: midi(chord[0] - 12), dur: beatLen * (battle ? 0.9 : 1.8), vol: battle ? 0.16 : 0.14, type: 'triangle', cutoff: 600, attack: 0.01, bus, at: t });
    }
    // Melody: plucky, filtered, with a touch of echo.
    const note = song.melody[bar][beat];
    if (note) voice({ freq: midi(note), dur: battle ? 0.22 : 0.4, vol: battle ? 0.06 : 0.07, type: battle ? 'square' : 'triangle', cutoff: 2200, cutTo: 700, bus, at: t, send: 0.35 });
    // Light drums in battle only.
    if (battle) {
      if (beat % 4 === 0) voice({ freq: 120, to: 45, dur: 0.16, vol: 0.32, cutoff: 500, bus, at: t });
      if (beat % 4 === 2) noise({ dur: 0.12, vol: 0.07, freq: 1600, type: 'bandpass', q: 0.8, bus, at: t });
      noise({ dur: 0.03, vol: beat % 2 ? 0.025 : 0.015, freq: 8000, type: 'highpass', bus, at: t });
    }
  }

  function tick() {
    const stepDur = 60 / SONGS[mode].bpm / 2;
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
  function unlock() { if (ensure()) startMusic(); }
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return { play, setVolumes, setMode };
})();
