// Top-down arena modes (survivor.io style): Extraction and Ammo Crisis.
// Joystick at the bottom center, zombies from every direction, XP crystals and level-up skills,
// breakable power-up crates, and objectives marked by arrows at the screen edge.

const Arena = (() => {
  let canvas, ctx, W = 0, H = 0, dpr = 1, S = 1, raf = 0, last = 0, run = null, onEnd = null;
  const keys = new Set();
  const joy = { active: false, id: null, bx: 0, by: 0, x: 0, y: 0 };
  const hud = {};
  const WORLD = 3200;
  const JOY_R = 56;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Zombie types in the arena (speeds in world units per second).
  const TYPES = {
    walker:  { hp: 1,   sp: 70,  size: 1,    xp: 1 },
    runner:  { hp: 0.7, sp: 118, size: 0.95, xp: 1 },
    tank:    { hp: 3,   sp: 50,  size: 1.2,  xp: 3, wide: 1.25 },
    spitter: { hp: 1.2, sp: 62,  size: 1,    xp: 2, spit: true },
    armored: { hp: 2.2, sp: 64,  size: 1,    xp: 2, helmet: true },
    hopper:  { hp: 0.8, sp: 88,  size: 0.9,  xp: 2, hop: true },
    brute:   { hp: 38,  sp: 46,  size: 1.9,  xp: 25, wide: 1.45, fat: true, mini: true },
  };
  // Which types can spawn after how many seconds.
  const UNLOCKS = [['walker', 0], ['runner', 15], ['spitter', 40], ['tank', 60], ['armored', 90], ['hopper', 120]];

  // Level-up skills. ammo: allowed in Ammo Crisis (no auto-weapons there).
  const SKILLS_A = [
    { id: 'dmg', name: 'Firepower', desc: '+25% damage', icon: 'burst', color: '#ff8a1f', ammo: true },
    { id: 'rate', name: 'Rapid Fire', desc: '+20% fire rate', icon: 'fire', color: '#ffc933' },
    { id: 'multi', name: 'Double Shot', desc: '+1 bullet per shot', icon: 'rifle', color: '#8fd2ff', ammo: true },
    { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pass through +1 zombie', icon: 'target', color: '#2fe0c4', ammo: true },
    { id: 'speed', name: 'Sprint', desc: '+12% move speed', icon: 'bolt', color: '#ffe14d', ammo: true },
    { id: 'hp', name: 'Vitality', desc: '+20% max health and heal', icon: 'heart', color: '#ff4d5e', ammo: true },
    { id: 'magnet', name: 'Magnet', desc: '+40% pickup range', icon: 'gem', color: '#5fd3ff', ammo: true },
    { id: 'drone', name: 'Combat Drone', desc: 'A drone circles you and shoots', icon: 'heli', color: '#4f9cf0' },
    { id: 'blades', name: 'Spinning Blades', desc: 'Blades orbit and slice zombies', icon: 'burst', color: '#d0d8e8', ammo: true },
    { id: 'grenade', name: 'Grenades', desc: 'Auto-throw grenades at the horde', icon: 'bomb', color: '#7fb04e' },
    { id: 'regen', name: 'Regeneration', desc: 'Heal 1% health per second', icon: 'heart', color: '#6fe06a', ammo: true },
  ];
  const SKILL_MAX = 5;

  // Obstacles when the chapter has no roadside props of its own.
  const CITY_PROPS = ['car', 'crate', 'tires', 'drum', 'hydrant', 'cone'];

  function init() {
    canvas = document.getElementById('arena-canvas');
    ctx = canvas.getContext('2d');
    ['hp', 'hpText', 'xp', 'lvl', 'obj', 'time', 'kills', 'loot', 'levelup', 'ammo'].forEach(k => { hud[k] = document.getElementById('ax-' + k); });
    new ResizeObserver(resize).observe(canvas.parentElement);

    // Joystick: touch anywhere on the lower part of the screen; it rests at the bottom center.
    // In Ammo Crisis, a tap on the upper part fires toward that point.
    canvas.addEventListener('pointerdown', e => {
      if (!run || run.state !== 'playing') return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (!joy.active && (y > H * 0.55 || run.mode !== 'ammo')) {
        Object.assign(joy, { active: true, id: e.pointerId, bx: x, by: y, x, y });
        canvas.setPointerCapture(e.pointerId);
      } else if (run.mode === 'ammo') {
        shootAt(x, y);
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!joy.active || e.pointerId !== joy.id) return;
      const r = canvas.getBoundingClientRect();
      joy.x = e.clientX - r.left; joy.y = e.clientY - r.top;
    });
    const end = e => { if (e.pointerId === joy.id) { joy.active = false; joy.id = null; } };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    window.addEventListener('keydown', e => {
      if (!run) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) keys.add(k);
      if (k === 'escape' || k === 'p') UI.togglePause();
    });
    window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => keys.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && run && run.state === 'playing') UI.togglePause(true);
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W / 560, H / 900);
    if (run && run.state !== 'playing') draw();
  }

  // World → screen
  const sx = x => (x - run.cam.x) * S + W / 2;
  const sy = y => (y - run.cam.y) * S + H * 0.47;

  // ---------- Run lifecycle ----------

  function start(mode, endCallback) {
    let gl = 0;
    CHAPTERS.forEach((c, ci) => { if (chapterUnlocked(ci)) gl = Math.max(gl, ci * 6 + save.progress[c.id].unlocked - 1); });
    const ch = Math.floor(gl / 6);
    const theme = CHAPTERS[ch].theme;
    const stats = playerStats();
    const wpn = WEAPONS[equippedWeapon()];
    onEnd = endCallback;
    run = {
      mode, theme, stats, wpn, weapon: equippedWeapon(), gl, t: 0, state: 'playing', endTimer: 0, win: false,
      p: { x: WORLD / 2, y: WORLD / 2, vx: 0, vy: 0, aim: Math.PI / 2, aimHold: 0, moving: false, hurt: 0, flash: 0, walk: 0 },
      hp: stats.hp, maxHp: stats.hp,
      cam: { x: WORLD / 2, y: WORLD / 2 },
      zombies: [], bullets: [], gems: [], pickups: [], crates: [], obstacles: [], barrels: [], fireballs: [], grenades: [], fx: [], texts: [],
      supplies: [], ammoBoxes: [], extract: null, holdT: 0,
      skills: {}, lvl: 1, xp: 0, xpNeed: 5, pendingLevels: 0,
      fireCd: 0.5, spawnCd: 1.2, nextBrute: 75, nextCrate: 18, nextBonus: 0, droneCd: 0, grenadeCd: 3, bladeA: 0,
      kills: 0, loot: 0, found: 0, bonusFound: 0, rage: 0, shield: 0, shake: 0,
      ammo: mode === 'ammo' ? 30 : Infinity, nextAmmo: 12, milestone: 60,
      decals: [],
    };
    buildWorld();
    resize();
    banner(mode === 'ammo' ? 'AMMO CRISIS' : 'EXTRACTION', mode === 'ammo' ? 'Every bullet counts. Tap to shoot.' : 'Find 5 supply cases');
    Sound.setMode('battle');
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function pause() { if (run && run.state === 'playing') run.state = 'paused'; }
  function resume() {
    if (run && run.state === 'paused') {
      run.state = 'playing';
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  function quit() { cancelAnimationFrame(raf); run = null; keys.clear(); joy.active = false; hud.levelup.hidden = true; Sound.setMode('menu'); }

  function finish() {
    const r = run;
    const secs = Math.floor(r.t);
    let coins, gems = 0, chest = null;
    if (r.mode === 'extraction') {
      const mult = 1 + r.t / 120;
      if (r.win) {
        coins = Math.round((r.loot + r.kills * 2) * mult);
        gems = 10 + r.found * 3 + r.bonusFound * 4;
        if (r.t >= 240) chest = 'silver';
        track('extracts', 1);
      } else coins = Math.round((r.loot + r.kills * 2) * 0.25);
    } else {
      coins = r.kills * 2 + secs * 3;
      gems = Math.floor(secs / 30) * 5;
      track('ammoTime', secs, 'max');
    }
    track('kills', r.kills);
    cancelAnimationFrame(raf);
    Sound.setMode('menu');
    Sound.play(r.win || r.mode === 'ammo' && secs >= 60 ? 'victory' : 'defeat');
    const cb = onEnd;
    run = null;
    hud.levelup.hidden = true;
    cb({ mode: r.mode, win: r.win, time: secs, kills: r.kills, coins, gems, chest, found: r.found + r.bonusFound });
  }

  // ---------- World ----------

  function freeSpot(minD, maxD, from, pad = 60) {
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, d = rand(minD, maxD);
      const x = clamp(from.x + Math.cos(a) * d, 120, WORLD - 120), y = clamp(from.y + Math.sin(a) * d, 120, WORLD - 120);
      if (!run.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + pad)) return { x, y };
    }
    return { x: clamp(from.x + minD, 120, WORLD - 120), y: from.y };
  }

  function buildWorld() {
    const r = run;
    const kinds = r.theme.props.length ? r.theme.props.filter(k => k !== 'lamp') : CITY_PROPS;
    for (let i = 0; i < 70; i++) {
      const x = rand(100, WORLD - 100), y = rand(100, WORLD - 100);
      if (Math.hypot(x - r.p.x, y - r.p.y) < 220) continue;
      const kind = pick(kinds.length ? kinds : CITY_PROPS);
      const rad = { car: 62, pine: 34, deadtree: 30, bush: 34, cactus: 26, rock: 44, lavarock: 44, snowman: 28 }[kind] || 30;
      r.obstacles.push({ x, y, r: rad, kind, color: pick(['#ff4d5e', '#29a8ff', '#ffc933', '#a55cff', '#4fd645']) });
    }
    for (let i = 0; i < 220; i++) r.decals.push({ x: rand(0, WORLD), y: rand(0, WORLD), k: Math.floor(rand(0, 4)), s: rand(0.6, 1.4), a: rand(0, 6) });
    for (let i = 0; i < 7; i++) r.crates.push({ ...freeSpot(200, 1200, r.p), hp: 2, t: rand(0, 9) });
    if (r.mode === 'extraction') {
      for (let i = 0; i < 5; i++) r.supplies.push({ ...freeSpot(450 + i * 120, 1300, r.p), t: rand(0, 9) });
    } else {
      for (let i = 0; i < 18; i++) r.barrels.push({ ...freeSpot(250, 1400, r.p, 80), r: 26 });
      for (let i = 0; i < 4; i++) r.ammoBoxes.push({ ...freeSpot(300, 900, r.p), t: rand(0, 9) });
    }
  }

  // ---------- Spawning ----------

  function diff() { return 1 + run.t / 60 * 0.55; }

  function spawnZombie(type, at) {
    const r = run, zt = TYPES[type];
    let pos = at;
    if (!pos) {
      const a = Math.random() * Math.PI * 2, R = Math.hypot(W, H) / 2 / S + 70;
      pos = { x: clamp(r.p.x + Math.cos(a) * R, 40, WORLD - 40), y: clamp(r.p.y + Math.sin(a) * R, 40, WORLD - 40) };
    }
    const hp = r.stats.dmg * 2.4 * zt.hp * diff() * (r.mode === 'ammo' ? 1.6 : 1);
    const base = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.walker;
    const own = { spitter: 1, hopper: 1 }[type];
    r.zombies.push({
      type, ...pos, hp, maxHp: hp, sp: zt.sp * rand(0.9, 1.1) * (1 + r.t / 400), size: zt.size, wide: zt.wide || 1,
      color: own || !r.theme.skin ? base.color : shadeHex(r.theme.skin, { runner: 0.14, tank: -0.2, armored: 0.07, brute: -0.12 }[type] || 0),
      t: rand(0, 5), flash: 0, hitCd: 0, spitCd: rand(1.5, 3), dashT: 0, dashCd: rand(1, 2.5), bladeCd: 0, mini: !!zt.mini,
    });
  }

  function updateSpawns(dt) {
    const r = run;
    r.spawnCd -= dt;
    const cap = r.mode === 'ammo' ? 45 : 90;
    if (r.spawnCd <= 0 && r.zombies.length < cap) {
      r.spawnCd = Math.max(r.mode === 'ammo' ? 0.55 : 0.22, (r.mode === 'ammo' ? 1.6 : 1.0) - r.t * 0.004);
      const types = UNLOCKS.filter(([, at]) => r.t >= at).map(([t]) => t);
      const n = r.t > 90 && Math.random() < 0.35 ? 3 : r.t > 30 && Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) spawnZombie(Math.random() < 0.55 ? 'walker' : pick(types));
      // Now and then a horde closes in from one side.
      if (r.t > 45 && Math.random() < 0.03) {
        const a = Math.random() * Math.PI * 2, R = Math.hypot(W, H) / 2 / S + 80;
        for (let k = 0; k < 8; k++) spawnZombie('walker', { x: clamp(r.p.x + Math.cos(a) * R + rand(-80, 80), 40, WORLD - 40), y: clamp(r.p.y + Math.sin(a) * R + rand(-80, 80), 40, WORLD - 40) });
      }
    }
    if (r.t >= r.nextBrute) {
      r.nextBrute += 90;
      spawnZombie('brute');
      banner('MINIBOSS', 'A Fat Brute is coming', true);
    }
    if (r.t >= r.nextCrate) {
      r.nextCrate += 20;
      if (r.crates.length < 10) r.crates.push({ ...freeSpot(260, 600, r.p), hp: 2, t: 0 });
    }
    if (r.mode === 'ammo' && r.t >= r.nextAmmo) {
      r.nextAmmo += 12;
      if (r.ammoBoxes.length < 6) r.ammoBoxes.push({ ...freeSpot(300, 750, r.p), t: 0 });
    }
    // Extraction: bonus supply cases keep appearing for players who stay longer.
    if (r.mode === 'extraction' && r.extract && r.t >= r.nextBonus) {
      r.nextBonus = r.t + 25;
      r.supplies.push({ ...freeSpot(450, 900, r.p), t: 0, bonus: true });
    }
  }

  // ---------- Combat ----------

  function bulletDmg(mult = 1) {
    const r = run;
    const crit = Math.random() < r.stats.crit;
    const lv = r.skills.dmg || 0;
    return { dmg: r.stats.dmg * r.wpn.dmg * (1 + lv * 0.25) * mult * (crit ? 2 : 1) * (r.mode === 'ammo' ? 2.5 : 1), crit };
  }

  function nearest(from, range) {
    let best = null, bd = range;
    for (const z of run.zombies) { const d = dist(z, from); if (d < bd) { bd = d; best = z; } }
    return best;
  }

  function fireVolley(tx, ty) {
    const r = run, p = r.p;
    const shots = 1 + (r.skills.multi || 0);
    const base = Math.atan2(ty - (p.y - 40), tx - p.x);
    const pellets = r.wpn.pellets || 1;
    const n = pellets > 1 ? pellets + (shots - 1) * 2 : shots;
    const spread = pellets > 1 ? 0.14 : 0.1;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const sp = r.wpn.splash ? 520 : 900;
      r.bullets.push({ x: p.x + Math.cos(a) * 24, y: p.y - 40 + Math.sin(a) * 24, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7,
        m: r.wpn.pellets ? 0.55 : 1, pierce: (r.wpn.pierce || 0) + (r.skills.pierce || 0), splash: r.wpn.splash ? 75 : 0, hits: new Set() });
    }
    p.aim = base;
    p.aimHold = 0.7;
    p.flash = 0.07;
    Sound.play(r.wpn.splash ? 'throw' : 'shoot');
  }

  // Ammo Crisis: tap to shoot. Taps near a zombie snap onto it.
  function shootAt(scrX, scrY) {
    const r = run;
    if (r.ammo <= 0) { Sound.play('block'); addText(r.p.x, r.p.y - 110, 'NO AMMO!', '#ff4a4a', 20); return; }
    let tx = (scrX - W / 2) / S + r.cam.x, ty = (scrY - H * 0.47) / S + r.cam.y;
    // Aim assist: a tapped barrel wins, otherwise snap to the closest zombie near the tap.
    const barrel = r.barrels.find(b => Math.hypot(b.x - tx, b.y - 25 - ty) < 45);
    const near = barrel ? null : nearest({ x: tx, y: ty }, 70);
    if (barrel) { tx = barrel.x; ty = barrel.y - 25; }
    else if (near) { tx = near.x; ty = near.y - 35 * near.size; }
    r.ammo--;
    fireVolley(tx, ty);
  }

  function hitZombie(z, dmg, crit) {
    const r = run;
    z.hp -= dmg; z.flash = 0.08;
    if (Math.random() < 0.35 || crit) addText(z.x + rand(-10, 10), z.y - 90 * z.size, String(Math.round(dmg)), crit ? '#ff5a3a' : '#ffe36e', crit ? 18 : 14);
    if (z.hp <= 0) killZombie(z);
  }

  function killZombie(z) {
    const r = run;
    const i = r.zombies.indexOf(z);
    if (i < 0) return;
    r.zombies.splice(i, 1);
    r.kills++;
    burst(z.x, z.y - 30, z.color, z.mini ? 30 : 8);
    Sound.play('kill');
    const xp = TYPES[z.type].xp;
    if (z.mini) {
      // Rainbow drop: a big XP pile and a crate full of power-ups.
      for (let k = 0; k < 12; k++) r.gems.push({ x: z.x + rand(-60, 60), y: z.y + rand(-60, 60), v: 3 });
      r.pickups.push({ x: z.x, y: z.y, kind: 'magnet', t: 0 });
      r.pendingLevels++;
      banner('BRUTE DOWN', '+1 skill', false);
      r.shake = 0.4;
      Sound.play('explode');
    } else r.gems.push({ x: z.x, y: z.y, v: xp });
  }

  function explode(x, y, rad, dmgMult, hurtsPlayer) {
    const r = run;
    const { dmg } = bulletDmg(dmgMult);
    for (const z of [...r.zombies]) if (Math.hypot(z.x - x, z.y - y) < rad + 20 * z.size) hitZombie(z, dmg, false);
    for (const c of [...r.crates]) if (Math.hypot(c.x - x, c.y - y) < rad) breakCrate(c);
    if (hurtsPlayer && Math.hypot(r.p.x - x, r.p.y - y) < rad) hurt(r.maxHp * 0.2);
    r.fx.push({ type: 'boom', x, y, rad, t: 0.45, max: 0.45 });
    burst(x, y, '#ffb02e', 26); burst(x, y, '#ff5a3a', 16); burst(x, y, '#4a4a4a', 10);
    Sound.play('explode');
    r.shake = Math.max(r.shake, 0.35);
  }

  function hurt(dmg) {
    const r = run;
    if (r.shield > 0 || r.p.hurt > 0.3) return;
    r.hp -= dmg;
    r.p.hurt = 0.5;
    r.shake = Math.max(r.shake, 0.2);
    Sound.play('hurt');
    addText(r.p.x, r.p.y - 110, `-${Math.round(dmg)}`, '#ff4a4a', 18);
  }

  function breakCrate(c) {
    const r = run;
    const i = r.crates.indexOf(c);
    if (i < 0) return;
    r.crates.splice(i, 1);
    burst(c.x, c.y - 20, '#c98b4a', 16);
    Sound.play('explode');
    const kinds = r.mode === 'ammo' ? ['ammo', 'ammo', 'medkit', 'shield', 'magnet', 'bomb'] : ['medkit', 'magnet', 'bomb', 'rage', 'shield', 'medkit'];
    r.pickups.push({ x: c.x, y: c.y, kind: pick(kinds), t: 0 });
  }

  function applyPickup(k) {
    const r = run;
    Sound.play('powerup');
    if (k === 'medkit') { r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.3); say('+30% HEALTH', '#6fe06a'); }
    else if (k === 'magnet') { r.gems.forEach(g => { g.pull = true; }); say('MAGNET', '#5fd3ff'); }
    else if (k === 'bomb') {
      say('BOMB!', '#ffb02e');
      r.fx.push({ type: 'flash', t: 0.3, max: 0.3 });
      for (const z of [...r.zombies]) {
        if (Math.abs(sx(z.x) - W / 2) > W / 2 + 40 || Math.abs(sy(z.y) - H / 2) > H / 2 + 40) continue;
        if (z.mini) hitZombie(z, z.maxHp * 0.3, false); else killZombie(z);
      }
      Sound.play('explode'); r.shake = 0.5;
    }
    else if (k === 'rage') { r.rage = 8; say('RAGE x2', '#ff5a3a'); }
    else if (k === 'shield') { r.shield = 6; say('SHIELD', '#8fd2ff'); }
    else if (k === 'ammo') { r.ammo += 10; say('+10 AMMO', '#ffe14d'); }
  }

  function say(text, color) { addText(run.p.x, run.p.y - 120, text, color, 22, 1.1); }

  // ---------- Update ----------

  function update(dt) {
    const r = run;
    r.t += dt;
    r.shake = Math.max(0, r.shake - dt);
    r.rage = Math.max(0, r.rage - dt);
    r.shield = Math.max(0, r.shield - dt);
    const p = r.p;
    p.hurt = Math.max(0, p.hurt - dt);
    p.flash = Math.max(0, p.flash - dt);

    if (r.state === 'ending') {
      r.endTimer -= dt;
      updateFx(dt);
      if (r.endTimer <= 0) finish();
      return;
    }

    // Movement: joystick or keys
    let mx = 0, my = 0;
    if (joy.active) {
      const dx = joy.x - joy.bx, dy = joy.y - joy.by, d = Math.hypot(dx, dy);
      if (d > 6) { const k = Math.min(1, d / JOY_R); mx = dx / d * k; my = dy / d * k; }
    }
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const speed = 190 * (1 + (r.skills.speed || 0) * 0.12);
    p.vx = mx * speed; p.vy = my * speed;
    p.x = clamp(p.x + p.vx * dt, 40, WORLD - 40);
    p.y = clamp(p.y + p.vy * dt, 60, WORLD - 30);
    p.moving = ml > 0.1;
    p.walk += dt * (p.moving ? 11 : 3);
    // Face the last shot for a moment, otherwise turn toward where we walk.
    p.aimHold -= dt;
    if (p.aimHold <= 0 && p.moving) {
      let d = Math.atan2(my, mx) - p.aim;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.aim += d * Math.min(1, dt * 10);
    }
    for (const o of r.obstacles) pushOut(p, o.x, o.y, o.r + 18);
    for (const b of r.barrels) pushOut(p, b.x, b.y, b.r + 18);
    r.cam.x += (p.x - r.cam.x) * Math.min(1, dt * 8);
    r.cam.y += (p.y - r.cam.y) * Math.min(1, dt * 8);

    updateSpawns(dt);

    // Auto-fire at the nearest zombie (Extraction). Ammo Crisis fires only on taps.
    if (r.mode === 'extraction') {
      r.fireCd -= dt;
      const rate = r.stats.rate * 0.5 * r.wpn.rate * (1 + (r.skills.rate || 0) * 0.2) * (r.rage > 0 ? 2 : 1);
      if (r.fireCd <= 0) {
        const tgt = nearest(p, 430);
        if (tgt) { fireVolley(tgt.x, tgt.y - 35 * tgt.size); r.fireCd = 1 / Math.max(0.4, rate); }
        else r.fireCd = 0.05;
      }
    }
    updateSkills(dt);
    updateBullets(dt);
    updateZombies(dt);
    updatePickups(dt);
    updateObjectives(dt);
    updateFx(dt);

    if (r.skills.regen) r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.01 * r.skills.regen * dt);
    if (r.pendingLevels > 0 && r.state === 'playing') { r.pendingLevels--; levelUp(); }
    if (r.mode === 'ammo' && r.t >= r.milestone) { banner(`${r.milestone}s SURVIVED`, 'Keep going!', false); r.milestone += 60; }

    if (r.hp <= 0 && r.state === 'playing') {
      r.hp = 0;
      r.state = 'ending';
      r.endTimer = 1.3;
      burst(p.x, p.y - 30, '#e0242c', 30);
      banner(r.mode === 'extraction' ? 'MISSION FAILED' : 'OVERRUN', r.mode === 'extraction' ? 'You keep 25% of the loot' : `You lasted ${Math.floor(r.t)}s`, true);
    }
  }

  function pushOut(a, ox, oy, rad) {
    const dx = a.x - ox, dy = a.y - oy, d = Math.hypot(dx, dy);
    if (d < rad && d > 0.01) { a.x = ox + dx / d * rad; a.y = oy + dy / d * rad; }
  }

  function updateSkills(dt) {
    const r = run, p = r.p;
    // Drones: orbit and shoot the nearest zombie
    if (r.skills.drone) {
      r.droneCd -= dt;
      if (r.droneCd <= 0) {
        r.droneCd = Math.max(0.35, 1 - r.skills.drone * 0.12);
        for (let k = 0; k < r.skills.drone; k++) {
          const a = r.t * 2 + k * Math.PI * 2 / r.skills.drone;
          const dx = p.x + Math.cos(a) * 70, dy = p.y - 60 + Math.sin(a) * 40;
          const tgt = nearest({ x: dx, y: dy }, 380);
          if (!tgt) continue;
          const ang = Math.atan2(tgt.y - 35 - dy, tgt.x - dx);
          r.bullets.push({ x: dx, y: dy, vx: Math.cos(ang) * 800, vy: Math.sin(ang) * 800, life: 0.6, m: 0.6, pierce: 0, splash: 0, hits: new Set(), drone: true });
        }
      }
    }
    // Spinning blades
    if (r.skills.blades) {
      r.bladeA += dt * 3.2;
      const n = 1 + r.skills.blades;
      for (const z of [...r.zombies]) {
        z.bladeCd = Math.max(0, z.bladeCd - dt);
        if (z.bladeCd > 0) continue;
        for (let k = 0; k < n; k++) {
          const a = r.bladeA + k * Math.PI * 2 / n;
          const bx = p.x + Math.cos(a) * 95, by = p.y - 30 + Math.sin(a) * 95;
          if (Math.hypot(z.x - bx, z.y - 30 - by) < 30 * z.size) {
            z.bladeCd = 0.35;
            const { dmg, crit } = bulletDmg(0.8);
            hitZombie(z, dmg, crit);
            break;
          }
        }
      }
    }
    // Grenades
    if (r.skills.grenade) {
      r.grenadeCd -= dt;
      if (r.grenadeCd <= 0) {
        r.grenadeCd = Math.max(1.2, 3.6 - r.skills.grenade * 0.45);
        const near = r.zombies.filter(z => dist(z, p) < 420);
        if (near.length) {
          const tgt = pick(near);
          r.grenades.push({ x0: p.x, y0: p.y - 40, x1: tgt.x, y1: tgt.y, t: 0, dur: 0.6 });
          Sound.play('throw');
        }
      }
    }
    for (let i = r.grenades.length - 1; i >= 0; i--) {
      const g = r.grenades[i];
      g.t += dt;
      if (g.t >= g.dur) { explode(g.x1, g.y1, 95, 2.4, false); r.grenades.splice(i, 1); }
    }
  }

  function updateBullets(dt) {
    const r = run;
    for (let i = r.bullets.length - 1; i >= 0; i--) {
      const b = r.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && r.obstacles.some(o => Math.hypot(o.x - b.x, o.y - 20 - b.y) < o.r * 0.8)) dead = true;
      if (!dead) {
        for (const br of r.barrels) {
          if (Math.hypot(br.x - b.x, br.y - 25 - b.y) < br.r + 6) {
            r.barrels.splice(r.barrels.indexOf(br), 1);
            explode(br.x, br.y, 160, 6, true);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const c of r.crates) {
          if (Math.hypot(c.x - b.x, c.y - 22 - b.y) < 26) {
            c.hp--; c.flash = 0.1;
            if (c.hp <= 0) breakCrate(c);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const z of r.zombies) {
          if (b.hits.has(z)) continue;
          if (Math.hypot(z.x - b.x, (z.y - 38 * z.size) - b.y) < 26 * z.size * z.wide) {
            if (b.splash) { explode(b.x, b.y, b.splash, 1.2, false); dead = true; break; }
            const { dmg, crit } = bulletDmg(b.m);
            hitZombie(z, dmg, crit);
            Sound.play('hit');
            b.hits.add(z);
            if (b.pierce-- <= 0) { dead = true; break; }
          }
        }
      }
      if (dead) r.bullets.splice(i, 1);
    }
  }

  function updateZombies(dt) {
    const r = run, p = r.p;
    for (const z of r.zombies) {
      z.t += dt;
      z.flash = Math.max(0, z.flash - dt);
      z.hitCd = Math.max(0, z.hitCd - dt);
      const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy) || 1;
      let sp = z.sp;
      // Spitters keep their distance and lob fireballs.
      if (TYPES[z.type].spit) {
        if (d < 300) sp = d < 240 ? -z.sp * 0.6 : 0;
        if ((z.spitCd -= dt) <= 0 && d < 520) {
          z.spitCd = rand(2.2, 3.2);
          const a = Math.atan2(dy, dx);
          r.fireballs.push({ x: z.x, y: z.y - 40, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 3 });
          Sound.play('throw');
        }
      }
      // Hoppers pounce in short bursts.
      if (TYPES[z.type].hop) {
        if (z.dashT > 0) { z.dashT -= dt; sp = 360; }
        else if ((z.dashCd -= dt) <= 0 && d < 380) { z.dashT = 0.35; z.dashCd = rand(1.8, 2.8); }
      }
      z.x += dx / d * sp * dt;
      z.y += dy / d * sp * dt;
      z.jump = z.dashT > 0 ? Math.sin((0.35 - z.dashT) / 0.35 * Math.PI) : 0;
      for (const o of r.obstacles) pushOut(z, o.x, o.y, o.r + 14);
      if (d < 34 + 16 * z.size && z.hitCd <= 0) {
        z.hitCd = 0.7;
        hurt(r.maxHp * (z.mini ? 0.14 : 0.05) * (1 + r.t / 60 * 0.25));
      }
    }
    // Keep zombies from stacking into one blob.
    const zs = r.zombies;
    for (let i = 0; i < zs.length; i++) {
      for (let j = i + 1; j < zs.length; j++) {
        const a = zs[i], b = zs[j];
        const dx = b.x - a.x, dy = b.y - a.y, min = 26 * (a.size + b.size) * 0.5;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; a.y -= dy / d * push;
          b.x += dx / d * push; b.y += dy / d * push;
        }
      }
    }
    // Despawn stragglers far behind so the horde follows the player.
    r.zombies = zs.filter(z => z.mini || dist(z, p) < 1500);
    for (let i = r.fireballs.length - 1; i >= 0; i--) {
      const f = r.fireballs[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
      if (Math.hypot(f.x - p.x, f.y - (p.y - 40)) < 30) { hurt(r.maxHp * 0.08); burst(f.x, f.y, '#ff7a1a', 12); r.fireballs.splice(i, 1); }
      else if (f.life <= 0) r.fireballs.splice(i, 1);
    }
  }

  function updatePickups(dt) {
    const r = run, p = r.p;
    const magnet = 95 * (1 + (r.skills.magnet || 0) * 0.4);
    for (let i = r.gems.length - 1; i >= 0; i--) {
      const g = r.gems[i];
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (g.pull || d < magnet) {
        g.pull = true;
        const sp = 520 + (g.sp = (g.sp || 0) + dt * 900);
        g.x += (p.x - g.x) / (d || 1) * sp * dt;
        g.y += (p.y - g.y) / (d || 1) * sp * dt;
      }
      if (d < 26) {
        r.gems.splice(i, 1);
        r.xp += g.v;
        Sound.play('coin');
        while (r.xp >= r.xpNeed) { r.xp -= r.xpNeed; r.xpNeed = Math.round(r.xpNeed * 1.28 + 3); r.pendingLevels++; }
      }
    }
    for (let i = r.pickups.length - 1; i >= 0; i--) {
      const k = r.pickups[i];
      k.t += dt;
      if (Math.hypot(k.x - p.x, k.y - p.y) < 44) { r.pickups.splice(i, 1); applyPickup(k.kind); }
    }
    for (let i = r.ammoBoxes.length - 1; i >= 0; i--) {
      const a = r.ammoBoxes[i];
      a.t += dt;
      if (Math.hypot(a.x - p.x, a.y - p.y) < 46) { r.ammoBoxes.splice(i, 1); r.ammo += 12; Sound.play('powerup'); say('+12 AMMO', '#ffe14d'); }
    }
    // Walking into a crate breaks it too.
    for (const c of [...r.crates]) if (Math.hypot(c.x - p.x, c.y - p.y) < 40) breakCrate(c);
  }

  function updateObjectives(dt) {
    const r = run, p = r.p;
    if (r.mode !== 'extraction') return;
    for (let i = r.supplies.length - 1; i >= 0; i--) {
      const s = r.supplies[i];
      s.t += dt;
      if (Math.hypot(s.x - p.x, s.y - p.y) < 50) {
        r.supplies.splice(i, 1);
        Sound.play('chest');
        if (s.bonus) { r.bonusFound++; r.loot += 140; say('BONUS SUPPLIES +140', '#ffd23a'); }
        else {
          r.found++; r.loot += 80;
          r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.1);
          say(`SUPPLIES ${r.found}/5`, '#ffd23a');
          if (r.found === 5) {
            r.extract = { ...freeSpot(800, 1100, p, 140), r: 120 };
            r.nextBonus = r.t + 20;
            banner('EXTRACTION READY', 'Reach the chopper, or stay for more loot', false);
          }
        }
      }
    }
    if (r.extract) {
      const inside = Math.hypot(r.extract.x - p.x, r.extract.y - p.y) < r.extract.r;
      r.holdT = inside ? r.holdT + dt : Math.max(0, r.holdT - dt * 2);
      if (r.holdT >= 4 && r.state === 'playing') {
        r.win = true;
        r.state = 'ending';
        r.endTimer = 1.6;
        Sound.play('victory');
        banner('EXTRACTED!', `Loot x${(1 + r.t / 120).toFixed(1)}`, false);
      }
    }
  }

  // ---------- Level up ----------

  function levelUp() {
    const r = run;
    r.lvl++;
    const pool = SKILLS_A.filter(s => (r.skills[s.id] || 0) < SKILL_MAX && (r.mode !== 'ammo' || s.ammo));
    const opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!opts.length) return;
    r.state = 'levelup';
    Sound.play('upgrade');
    hud.levelup.innerHTML = `<div class="lu-title tx">LEVEL UP!</div><div class="lu-sub">Choose a skill</div>
      <div class="lu-cards">${opts.map(s => {
        const lv = r.skills[s.id] || 0;
        return `<button class="lu-card" data-skill="${s.id}" style="--c:${s.color}">
          <span class="lu-icon">${icon(s.icon, s.color, 44)}</span>
          <span class="lu-name tx">${s.name}</span>
          <span class="lu-stars">${'★'.repeat(lv + 1)}${'☆'.repeat(SKILL_MAX - lv - 1)}</span>
          <span class="lu-desc">${s.desc}</span>
          ${lv === 0 ? '<span class="lu-new tx">NEW</span>' : ''}</button>`;
      }).join('')}</div>`;
    hud.levelup.hidden = false;
    hud.levelup.querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.skill;
      r.skills[id] = (r.skills[id] || 0) + 1;
      if (id === 'hp') { r.maxHp *= 1.2; r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.3); }
      hud.levelup.hidden = true;
      Sound.play('equip');
      r.state = 'playing';
      last = performance.now();
    }));
  }

  // ---------- FX ----------

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(60, 240);
      run.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0.5, max: 0.5, color, r: rand(2, 5) });
    }
  }
  function addText(x, y, text, color, size, dur = 0.7) {
    if (run.texts.length > 50) run.texts.shift();
    run.texts.push({ x, y, text, color, size, t: dur, max: dur });
  }
  function updateFx(dt) {
    const r = run;
    for (let i = r.fx.length - 1; i >= 0; i--) {
      const f = r.fx[i];
      f.t -= dt;
      if (f.type === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 500 * dt; }
      if (f.t <= 0) r.fx.splice(i, 1);
    }
    for (let i = r.texts.length - 1; i >= 0; i--) {
      const t = r.texts[i];
      t.t -= dt; t.y -= 50 * dt;
      if (t.t <= 0) r.texts.splice(i, 1);
    }
  }

  let bannerTimer = 0;
  function banner(title, sub, bad) {
    const el = document.getElementById('ax-banner');
    el.innerHTML = `<div class="ab-title tx">${title}</div>${sub ? `<div class="ab-sub tx">${sub}</div>` : ''}`;
    el.classList.toggle('bad', !!bad);
    el.hidden = false;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.hidden = true; }, 2200);
    if (bad) Sound.play('warn');
  }

  // ---------- Drawing ----------


  function drawGroundLayer() {
    const r = run, th = r.theme;
    ctx.fillStyle = th.ground ? th.ground[0] : '#5a9e3e';
    ctx.fillRect(0, 0, W, H);
    // Checker tiles for depth
    const tile = 160;
    const x0 = Math.floor((r.cam.x - W / 2 / S) / tile) * tile, y0 = Math.floor((r.cam.y - H / S) / tile) * tile;
    ctx.fillStyle = th.ground ? th.ground[1] : '#66ad48';
    for (let x = x0; x < r.cam.x + W / S; x += tile) {
      for (let y = y0; y < r.cam.y + H / S; y += tile) {
        if (((x + y) / tile) % 2 === 0) ctx.fillRect(sx(x), sy(y), tile * S + 1, tile * S + 1);
      }
    }
    // Decals: cracks, tufts, stains
    for (const d of r.decals) {
      const X = sx(d.x), Y = sy(d.y);
      if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) continue;
      ctx.save(); ctx.translate(X, Y); ctx.rotate(d.a); ctx.scale(d.s * S, d.s * S);
      if (d.k === 0) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-4, 6); ctx.lineTo(8, -3); ctx.lineTo(22, 4); ctx.stroke(); }
      else if (d.k === 1) { ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (d.k === 2) { ctx.fillStyle = 'rgba(120,20,20,.22)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.arc(12, 5, 5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-3, -6); ctx.moveTo(0, 6); ctx.lineTo(1, -8); ctx.moveTo(5, 6); ctx.lineTo(7, -5); ctx.stroke(); }
      ctx.restore();
    }
    // World border
    ctx.strokeStyle = 'rgba(20,19,43,.7)'; ctx.lineWidth = 14 * S;
    ctx.strokeRect(sx(0), sy(0), WORLD * S, WORLD * S);
  }

  function drawObstacle(o) {
    const X = sx(o.x), Y = sy(o.y), h = o.r * 1.7 * S;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(X, Y, o.r * S, o.r * 0.4 * S, 0, 0, Math.PI * 2); ctx.fill();
    const k = o.kind;
    if (k === 'car') drawCar(ctx, X, Y, h * 0.75, o.color);
    else if (k === 'crate') drawCrate(ctx, X, Y, h);
    else if (k === 'hydrant') drawHydrant(ctx, X, Y, h);
    else if (k === 'bush') drawBush(ctx, X, Y, h);
    else if (k === 'cactus') drawCactus(ctx, X, Y, h * 1.4);
    else if (k === 'rock') drawDesertRock(ctx, X, Y, h * 0.8);
    else if (k === 'drum') drawDrum(ctx, X, Y, h);
    else if (k === 'pine') drawPine(ctx, X, Y, h * 2);
    else if (k === 'snowman') drawSnowman(ctx, X, Y, h * 1.3);
    else if (k === 'deadtree') drawDeadTree(ctx, X, Y, h * 2);
    else if (k === 'toxic') drawToxicBarrel(ctx, X, Y, h, run.t);
    else if (k === 'lavarock') drawLavaRock(ctx, X, Y, h * 0.8, run.t);
    else if (k === 'cone') drawCone(ctx, X, Y, h);
    else drawTires(ctx, X, Y, h);
  }

  function drawPlayer() {
    const r = run, p = r.p;
    const X = sx(p.x), Y = sy(p.y), h = 96 * S;
    // Ground marker: soft glow ring with a chevron pointing where we aim
    const fx = Math.cos(p.aim), fy = Math.sin(p.aim);
    const ring = ctx.createRadialGradient(X, Y, 4, X, Y, 34 * S);
    ring.addColorStop(0, 'rgba(0,0,0,.28)'); ring.addColorStop(0.7, 'rgba(0,0,0,.12)'); ring.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ring;
    ctx.beginPath(); ctx.ellipse(X, Y, 34 * S, 12 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,200,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(X, Y, 32 * S, 11.5 * S, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.translate(X + fx * 42 * S, Y + fy * 15 * S);
    ctx.scale(1, 0.38); ctx.rotate(p.aim);
    ctx.fillStyle = 'rgba(90,200,255,.95)'; ctx.strokeStyle = 'rgba(20,19,43,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12 * S, 0); ctx.lineTo(-6 * S, -11 * S); ctx.lineTo(-2 * S, 0); ctx.lineTo(-6 * S, 11 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (p.hurt > 0 && Math.floor(p.hurt * 25) % 2) return;
    drawArenaHero(ctx, X, Y, h, { aim: p.aim, walk: p.walk, moving: p.moving, flash: p.flash, weapon: r.weapon });
    if (r.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(r.t * 10);
      ctx.fillStyle = '#6fd3ff'; ctx.strokeStyle = '#d6f4ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(X, Y - h * 0.5, h * 0.55, h * 0.65, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (r.rage > 0) {
      ctx.strokeStyle = 'rgba(255,90,40,.7)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(X, Y, 38 * S, 14 * S, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawSupply(s) {
    const X = sx(s.x), Y = sy(s.y), bob = Math.sin(s.t * 3) * 4 * S;
    const g = ctx.createRadialGradient(X, Y - 20 * S, 4, X, Y - 20 * S, 70 * S);
    g.addColorStop(0, s.bonus ? 'rgba(255,210,60,.55)' : 'rgba(120,220,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y - 20 * S, 70 * S, 0, Math.PI * 2); ctx.fill();
    const w = 54 * S, h = 38 * S;
    ctx.save(); ctx.translate(X, Y - 8 * S + bob);
    rr(ctx, -w / 2, -h, w, h, 6 * S); ctx.fillStyle = s.bonus ? '#ffc933' : '#3f6fb8'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w / 2 + 4, -h + 4, w - 8, 6 * S);
    ctx.fillStyle = '#fff'; ctx.fillRect(-4 * S, -h + 6 * S, 8 * S, h - 12 * S); ctx.fillRect(-12 * S, -h / 2 - 4 * S, 24 * S, 8 * S);
    ctx.restore();
  }

  function drawAmmoBox(a) {
    const X = sx(a.x), Y = sy(a.y), bob = Math.sin(a.t * 3) * 3 * S;
    const w = 46 * S, h = 30 * S;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(X, Y, 26 * S, 8 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(X, Y - 4 * S + bob);
    rr(ctx, -w / 2, -h, w, h, 5 * S); ctx.fillStyle = '#5d6b3a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd23a';
    for (let k = -1; k <= 1; k++) { rr(ctx, k * 11 * S - 3 * S, -h - 12 * S, 6 * S, 16 * S, 3 * S); ctx.fill(); ctx.stroke(); }
    ctx.font = `900 ${Math.round(11 * S)}px "Lilita One", system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('AMMO', 0, -h / 2 + 4 * S);
    ctx.restore();
  }

  function drawExplosiveBarrel(b) {
    const X = sx(b.x), Y = sy(b.y), w = 36 * S, h = 48 * S;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(X, Y, 24 * S, 8 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(X, Y);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#8f1420'); g.addColorStop(0.4, '#ff4a4a'); g.addColorStop(1, '#8f1420');
    rr(ctx, -w / 2, -h, w, h, 6 * S); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-w / 2, -h * 0.7, w, 4 * S); ctx.fillRect(-w / 2, -h * 0.3, w, 4 * S);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(0, -h * 0.62); ctx.lineTo(9 * S, -h * 0.38); ctx.lineTo(-9 * S, -h * 0.38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-1.5 * S, -h * 0.57, 3 * S, 8 * S);
    ctx.beginPath(); ctx.ellipse(0, -h, w / 2, 6 * S, 0, 0, Math.PI * 2); ctx.fillStyle = '#c21e2c'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawCrateObj(c) {
    const X = sx(c.x), Y = sy(c.y);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(X, Y, 24 * S, 8 * S, 0, 0, Math.PI * 2); ctx.fill();
    drawCrate(ctx, X, Y, 44 * S);
    // A glowing "?" shows it holds a power-up
    ctx.font = `900 ${Math.round(18 * S)}px "Lilita One", system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('?', X, Y - 58 * S + Math.sin(run.t * 4 + c.x) * 3);
    ctx.fillStyle = '#ffe14d'; ctx.fillText('?', X, Y - 58 * S + Math.sin(run.t * 4 + c.x) * 3);
  }

  function drawPickupObj(k) {
    const X = sx(k.x), Y = sy(k.y) - 26 * S + Math.sin(k.t * 5) * 4 * S, s = 34 * S;
    const g = ctx.createRadialGradient(X, Y, 2, X, Y, s);
    g.addColorStop(0, 'rgba(255,255,200,.7)'); g.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, s, 0, Math.PI * 2); ctx.fill();
    if (k.kind === 'magnet') {
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 11 * S;
      ctx.beginPath(); ctx.arc(X, Y, 11 * S, Math.PI, 0); ctx.moveTo(X - 11 * S, Y); ctx.lineTo(X - 11 * S, Y + 10 * S); ctx.moveTo(X + 11 * S, Y); ctx.lineTo(X + 11 * S, Y + 10 * S); ctx.stroke();
      ctx.strokeStyle = '#e0242c'; ctx.lineWidth = 6 * S;
      ctx.beginPath(); ctx.arc(X, Y, 11 * S, Math.PI, 0); ctx.moveTo(X - 11 * S, Y); ctx.lineTo(X - 11 * S, Y + 5 * S); ctx.moveTo(X + 11 * S, Y); ctx.lineTo(X + 11 * S, Y + 5 * S); ctx.stroke();
      ctx.strokeStyle = '#dfe6f0'; ctx.beginPath(); ctx.moveTo(X - 11 * S, Y + 5 * S); ctx.lineTo(X - 11 * S, Y + 10 * S); ctx.moveTo(X + 11 * S, Y + 5 * S); ctx.lineTo(X + 11 * S, Y + 10 * S); ctx.stroke();
    } else if (k.kind === 'bomb' || k.kind === 'ammo') {
      drawPickup(ctx, X, Y, s * 0.9, k.kind === 'bomb' ? 'grenade' : 'shield', run.t);
      if (k.kind === 'ammo') { ctx.font = `900 ${Math.round(11 * S)}px "Lilita One", system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeText('AMMO', X, Y + s * 0.7); ctx.fillText('AMMO', X, Y + s * 0.7); }
    } else drawPickup(ctx, X, Y, s * 0.9, k.kind, run.t);
  }

  function drawGem(g) {
    const X = sx(g.x), Y = sy(g.y) - 8 * S, s = (g.v >= 3 ? 9 : 6) * S;
    ctx.fillStyle = g.v >= 3 ? '#b36bff' : '#3fd0ff';
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X, Y - s * 1.3); ctx.lineTo(X + s, Y); ctx.lineTo(X, Y + s * 1.3); ctx.lineTo(X - s, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(X, Y - s * 1.1); ctx.lineTo(X + s * 0.4, Y - s * 0.2); ctx.lineTo(X, Y); ctx.closePath(); ctx.fill();
  }

  function drawExtraction() {
    const r = run, e = r.extract;
    if (!e) return;
    const X = sx(e.x), Y = sy(e.y);
    // Helipad
    ctx.fillStyle = 'rgba(40,45,60,.55)';
    ctx.beginPath(); ctx.ellipse(X, Y, e.r * S, e.r * 0.62 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 6; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -r.t * 30;
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `900 ${Math.round(60 * S)}px "Lilita One", system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('H', X, Y);
    // Hold progress ring
    if (r.holdT > 0) {
      ctx.strokeStyle = '#6fe06a'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(X, Y, e.r * S + 10, e.r * 0.62 * S + 10, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, r.holdT / 4)); ctx.stroke();
    }
  }

  function drawJoystick() {
    const r = run;
    const bx = joy.active ? joy.bx : W / 2, by = joy.active ? joy.by : H - 110;
    let kx = bx, ky = by;
    if (joy.active) {
      const dx = joy.x - joy.bx, dy = joy.y - joy.by, d = Math.hypot(dx, dy);
      const k = d > JOY_R ? JOY_R / d : 1;
      kx = bx + dx * k; ky = by + dy * k;
    }
    ctx.save();
    ctx.globalAlpha = joy.active ? 0.9 : 0.55;
    const g = ctx.createRadialGradient(bx, by, 10, bx, by, JOY_R + 12);
    g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,.28)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx, by, JOY_R + 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const kg = ctx.createRadialGradient(kx - 8, ky - 8, 4, kx, ky, 30);
    kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#9fb4d8');
    ctx.fillStyle = kg; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(kx, ky, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (!joy.active && r.t < 6) {
      ctx.font = '900 15px "Lilita One", system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
      const msg = r.mode === 'ammo' ? 'Drag here to move · tap above to shoot' : 'Drag here to move';
      ctx.strokeText(msg, W / 2, H - 185); ctx.fillText(msg, W / 2, H - 185);
    }
  }

  // Arrow at the screen edge pointing to an off-screen target.
  function drawArrow(tx, ty, color, label) {
    const r = run;
    const X = sx(tx), Y = sy(ty);
    const m = 34;
    if (X > m && X < W - m && Y > 130 && Y < H - 190) return;
    const cx = W / 2, cy = H * 0.47;
    const a = Math.atan2(Y - cy, X - cx);
    const k = Math.min(Math.abs((W / 2 - m) / Math.cos(a)), Math.abs(((Y < cy ? cy - 130 : H - 190 - cy)) / Math.sin(a)));
    const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
    ctx.save(); ctx.translate(ax, ay);
    ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(16, -8); ctx.lineTo(16, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.font = '900 11px "Lilita One", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    const dm = Math.round(Math.hypot(tx - r.p.x, ty - r.p.y) / 10) + 'm';
    ctx.strokeText(label || dm, ax, ay); ctx.fillText(label || dm, ax, ay);
  }

  function draw() {
    const r = run;
    if (!r) return;
    ctx.save();
    if (r.shake > 0) ctx.translate(rand(-6, 6) * r.shake * 3, rand(-6, 6) * r.shake * 3);
    drawGroundLayer();
    drawExtraction();

    // Y-sorted scene
    const vis = (x, y, pad = 120) => { const X = sx(x), Y = sy(y); return X > -pad && X < W + pad && Y > -pad && Y < H + pad * 2; };
    const list = [];
    for (const o of r.obstacles) if (vis(o.x, o.y, 160)) list.push({ y: o.y, fn: () => drawObstacle(o) });
    for (const b of r.barrels) if (vis(b.x, b.y)) list.push({ y: b.y, fn: () => drawExplosiveBarrel(b) });
    for (const c of r.crates) if (vis(c.x, c.y)) list.push({ y: c.y, fn: () => drawCrateObj(c) });
    for (const s of r.supplies) if (vis(s.x, s.y)) list.push({ y: s.y, fn: () => drawSupply(s) });
    for (const a of r.ammoBoxes) if (vis(a.x, a.y)) list.push({ y: a.y, fn: () => drawAmmoBox(a) });
    for (const k of r.pickups) if (vis(k.x, k.y)) list.push({ y: k.y, fn: () => drawPickupObj(k) });
    for (const z of r.zombies) {
      if (!vis(z.x, z.y)) continue;
      list.push({ y: z.y, fn: () => {
        const X = sx(z.x), Y = sy(z.y) - (z.jump || 0) * 30 * S;
        drawMutant(ctx, X, Y, 80 * S * z.size, z.t, { type: z.type, flash: z.flash, seed: z.x * 0.01 });
        if (z.mini || z.hp < z.maxHp) {
          const w = (z.mini ? 90 : 36) * S, y = Y - 96 * S * z.size;
          ctx.fillStyle = 'rgba(20,19,43,.85)'; ctx.fillRect(X - w / 2 - 1, y - 1, w + 2, 7);
          const f = Math.max(0, z.hp / z.maxHp);
          ctx.fillStyle = f > 0.5 ? '#6fe06a' : f > 0.25 ? '#ffc933' : '#ff4d5e'; ctx.fillRect(X - w / 2, y, w * f, 5);
        }
      } });
    }
    if (r.state !== 'ending' || r.win) list.push({ y: r.p.y, fn: drawPlayer });
    if (r.extract) {
      // The rescue chopper hovers over the far edge of the pad
      const e = r.extract;
      list.push({ y: e.y - e.r * 0.6, fn: () => drawHeli(ctx, sx(e.x), sy(e.y - e.r * 0.55) - 110 * S + Math.sin(r.t * 2) * 6, 130 * S, r.t, false) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.fn();

    for (const g of r.gems) if (vis(g.x, g.y, 20)) drawGem(g);

    // Bullets as bright tracers
    ctx.lineCap = 'round';
    for (const b of r.bullets) {
      const X = sx(b.x), Y = sy(b.y);
      if (b.splash) { drawRocketShot(ctx, X, Y, 9 * S + 3, r.t); continue; }
      const len = 0.03;
      ctx.strokeStyle = b.drone ? '#8fe8ff' : '#ffd23a'; ctx.lineWidth = 5 * S + 1;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - b.vx * len * S, Y - b.vy * len * S); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * S + 0.5;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - b.vx * len * 0.5 * S, Y - b.vy * len * 0.5 * S); ctx.stroke();
    }
    for (const f of r.fireballs) drawFireball(ctx, sx(f.x), sy(f.y), 12 * S + 2, r.t);
    for (const g of r.grenades) {
      const k = g.t / g.dur;
      const X = sx(g.x0 + (g.x1 - g.x0) * k), Y = sy(g.y0 + (g.y1 - g.y0) * k) - Math.sin(k * Math.PI) * 90 * S;
      drawPickup(ctx, X, Y, 18 * S, 'grenade', r.t);
    }

    // Skills drawn around the player
    const p = r.p;
    if (r.skills.blades) {
      const n = 1 + r.skills.blades;
      for (let k = 0; k < n; k++) {
        const a = r.bladeA + k * Math.PI * 2 / n;
        const X = sx(p.x + Math.cos(a) * 95), Y = sy(p.y - 30 + Math.sin(a) * 95);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(r.t * 14);
        ctx.fillStyle = '#e6edf7'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let q = 0; q < 8; q++) { const rr2 = q % 2 ? 6 * S : 18 * S; ctx.lineTo(Math.cos(q * Math.PI / 4) * rr2, Math.sin(q * Math.PI / 4) * rr2); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    if (r.skills.drone) {
      for (let k = 0; k < r.skills.drone; k++) {
        const a = r.t * 2 + k * Math.PI * 2 / r.skills.drone;
        const X = sx(p.x + Math.cos(a) * 70), Y = sy(p.y - 60 + Math.sin(a) * 40) - 30 * S;
        drawHeli(ctx, X, Y, 34 * S, r.t, false);
      }
    }

    // FX
    for (const f of r.fx) {
      const a = f.t / f.max;
      if (f.type === 'spark') {
        ctx.globalAlpha = a; ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), f.r * S + 1, 0, Math.PI * 2); ctx.fill();
      } else if (f.type === 'boom') {
        const k = 1 - a;
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(sx(f.x), sy(f.y), 0, sx(f.x), sy(f.y), f.rad * S * (0.5 + k));
        g.addColorStop(0, 'rgba(255,255,210,1)'); g.addColorStop(0.35, 'rgba(255,170,50,.9)'); g.addColorStop(1, 'rgba(255,80,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), f.rad * S * (0.5 + k), 0, Math.PI * 2); ctx.fill();
      } else if (f.type === 'flash') {
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.globalAlpha = 1;

    // Floating texts
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const t of r.texts) {
      ctx.globalAlpha = Math.min(1, t.t / t.max * 2);
      ctx.font = `900 ${t.size}px "Lilita One", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size / 4); ctx.strokeStyle = '#1b1f2a';
      ctx.strokeText(t.text, sx(t.x), sy(t.y)); ctx.fillStyle = t.color; ctx.fillText(t.text, sx(t.x), sy(t.y));
    }
    ctx.globalAlpha = 1;

    // Objective arrows
    if (r.mode === 'extraction') {
      if (r.extract) drawArrow(r.extract.x, r.extract.y, '#6fe06a');
      const near = r.supplies.slice().sort((a, b) => dist(a, p) - dist(b, p));
      for (const s of near.slice(0, r.extract ? 2 : 3)) drawArrow(s.x, s.y, s.bonus ? '#ffc933' : '#5fb8ff');
    } else if (r.ammo <= 12) {
      const near = r.ammoBoxes.slice().sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (near) drawArrow(near.x, near.y, '#ffe14d');
    }

    // Mood: darker grade and vignette so the arena matches the realistic zombies
    moodPass(ctx, W, H, -H, { gradeAmt: 0.25, vignette: 0.5 });

    // Damage vignette
    if (p.hurt > 0 || r.hp < r.maxHp * 0.3) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${Math.max(p.hurt * 0.8, r.hp < r.maxHp * 0.3 ? 0.25 + 0.1 * Math.sin(r.t * 6) : 0)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    if (r.state === 'playing' || r.state === 'paused') drawJoystick();
  }

  function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function updateHud() {
    const r = run;
    if (!r) return;
    const pct = Math.max(0, r.hp / r.maxHp);
    hud.hp.style.width = `${pct * 100}%`;
    hud.hp.classList.toggle('low', pct < 0.3);
    hud.hpText.textContent = Math.ceil(Math.max(0, r.hp));
    hud.xp.style.width = `${Math.min(1, r.xp / r.xpNeed) * 100}%`;
    hud.lvl.textContent = `Lv ${r.lvl}`;
    hud.time.textContent = fmtTime(r.t);
    hud.kills.textContent = r.kills;
    if (r.mode === 'extraction') {
      hud.obj.textContent = r.extract ? (r.holdT > 0 ? `Extracting… ${Math.ceil(4 - r.holdT)}` : 'Reach the chopper!') : `Supplies ${r.found}/5`;
      hud.loot.textContent = `${Math.round(r.loot + r.kills * 2)} ×${(1 + r.t / 120).toFixed(1)}`;
      hud.ammo.hidden = true;
      hud.loot.parentElement.hidden = false;
    } else {
      hud.obj.textContent = r.ammo > 0 ? 'Survive · aim carefully' : 'OUT OF AMMO! Find a box';
      hud.ammo.hidden = false;
      hud.ammo.querySelector('span').textContent = r.ammo;
      hud.ammo.classList.toggle('low', r.ammo <= 5);
      hud.loot.parentElement.hidden = true;
    }
  }

  function loop(now) {
    if (!run) return;
    if (run.state === 'paused') return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (run.state !== 'levelup') update(dt);
    if (!run) return;
    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  // debug(): read-only peek at the current run, used by automated playtests.
  return { init, start, pause, resume, quit, debug: () => run };
})();
