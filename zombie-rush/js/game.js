// In-level gameplay: a forward-scrolling street where the soldier auto-fires
// at zombie hordes, shoots through gates and barrels, then fights a boss.

const Game = (() => {
  const Z_FAR = 40;        // spawn distance
  const CAM_D = 5.5;       // camera distance behind the player
  const ROAD = 1;          // road half-width in world units
  const BULLET_SPEED = 42;
  const RUN_SPEED = 6;
  const MAX_SHOTS = 5;

  let canvas, ctx, W = 0, H = 0, roadW = 0, baseY = 0, horizon = 0;
  let run = null, onEnd = null, raf = 0, last = 0;
  let hud = {};
  const keys = new Set();

  // ---------- Setup ----------

  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    hud = {
      hpFill: document.getElementById('hud-hp-fill'),
      hpText: document.getElementById('hud-hp-text'),
      prog: document.getElementById('hud-progress-fill'),
      level: document.getElementById('hud-level'),
      buffs: document.getElementById('hud-buffs'),
      boss: document.getElementById('hud-boss'),
      bossName: document.getElementById('hud-boss-name'),
      bossFill: document.getElementById('hud-boss-fill'),
      banner: document.getElementById('hud-banner'),
      kills: document.getElementById('hud-kills'),
    };
    new ResizeObserver(resize).observe(canvas.parentElement);

    let dragStart = null;
    canvas.addEventListener('pointerdown', e => {
      if (!run) return;
      dragStart = { px: e.clientX, x: run.targetX };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!run || !dragStart) return;
      run.targetX = clamp(dragStart.x + (e.clientX - dragStart.px) / (roadW * 0.75), -0.85, 0.85);
    });
    const endDrag = () => { dragStart = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    window.addEventListener('keydown', e => {
      if (!run) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.add(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') keys.add(1);
      if (e.key === 'Escape' || e.key === 'p') UI.togglePause();
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.delete(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') keys.delete(1);
    });
    window.addEventListener('blur', () => keys.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && run && run.state === 'playing') UI.togglePause(true);
    });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    roadW = Math.min(W * 0.44, H * 0.28);
    baseY = H * 0.83;
    horizon = H * 0.04;
    if (run && run.state !== 'playing') draw();
  }

  function proj(x, z) {
    const s = CAM_D / (z + CAM_D);
    return { x: W / 2 + x * roadW * s, y: horizon + (baseY - horizon) * s, s };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- Run lifecycle ----------

  function start(lvlIdx, endCallback) {
    const cfg = CHAPTERS[0].levels[lvlIdx];
    const stats = playerStats();
    onEnd = endCallback;
    run = {
      lvlIdx, cfg, stats,
      hp: stats.hp, maxHp: stats.hp,
      x: 0, targetX: 0, dist: 0, speed: RUN_SPEED, t: 0,
      dmgMult: 1, rateMult: 1, shots: 1,
      shield: 0, rage: 0, hurt: 0, flash: 0, shake: 0,
      fireCd: 0.3,
      zombies: [], barrels: [], gates: [], bullets: [], rocks: [], fx: [], texts: [], props: [],
      nextSpawn: 16, nextGate: 22, nextProp: 0,
      boss: null, bossTimer: 0, bossSummon: 0, bossThrow: 0,
      kills: 0, coins: 0, state: 'playing', endTimer: 0,
      banner: null,
    };
    hud.level.textContent = `${lvlIdx + 1}. ${cfg.name}`;
    hud.boss.hidden = true;
    for (let z = 0; z < Z_FAR; z += 5) spawnProp(z);
    showBanner('ZOMBIES INCOMING', 2);
    Sound.setMode('battle');
    resize();
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
  function quit() { cancelAnimationFrame(raf); run = null; keys.clear(); Sound.setMode('menu'); }

  function finish(win) {
    const r = run;
    const hpPct = Math.max(0, r.hp) / r.maxHp;
    const stars = win ? (hpPct > 0.7 ? 3 : hpPct > 0.35 ? 2 : 1) : 0;
    const coins = r.coins + r.kills * 3 + (win ? 150 + r.lvlIdx * 100 : 0);
    const score = r.kills * 10 + (win ? 1000 * (r.lvlIdx + 1) + Math.round(hpPct * 1000) : 0);
    cancelAnimationFrame(raf);
    Sound.setMode('menu');
    Sound.play(win ? 'victory' : 'defeat');
    const cb = onEnd;
    run = null;
    cb({ win, lvlIdx: r.lvlIdx, kills: r.kills, coins, stars, score, reached: r.dist / r.cfg.length });
  }

  function showBanner(text, dur, kind = '') {
    run.banner = { text, t: dur };
    hud.banner.innerHTML = `<svg class="warn-sign" viewBox="0 0 80 70"><path d="M40 4 76 66H4z" fill="#fff" stroke="#1b1f2a" stroke-width="4" stroke-linejoin="round"/><path d="M40 17 65 60H15z" fill="#e0242c"/><rect x="36" y="28" width="8" height="18" rx="3" fill="#fff"/><circle cx="40" cy="52" r="4" fill="#fff"/></svg><div class="warn-text">${text}</div>`;
    hud.banner.classList.toggle('boss', kind === 'boss');
    hud.banner.classList.toggle('good', kind === 'good');
    hud.banner.hidden = false;
    if (kind !== 'good') Sound.play('warn');
    hud.banner.classList.remove('show'); void hud.banner.offsetWidth; hud.banner.classList.add('show');
  }

  // ---------- Spawning ----------

  function spawnProp(z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const kind = pick(['cone', 'crate', 'tires', 'hydrant', 'bush', 'bush', 'car']);
    const far = kind === 'car' || kind === 'bush';
    run.props.push({
      x: side * (far ? rand(2.05, 2.6) : rand(1.3, 1.8)), z, kind,
      h: kind === 'car' ? rand(0.32, 0.4) : kind === 'bush' ? rand(0.3, 0.45) : rand(0.22, 0.32),
      color: pick(['#ff4d5e', '#29a8ff', '#ffc933', '#a55cff', '#4fd645', '#ff8a1f']),
    });
  }

  function zombieType() {
    const types = run.cfg.types;
    const r = Math.random();
    if (types.includes('tank') && r < 0.12) return 'tank';
    if (types.includes('runner') && r < 0.35) return 'runner';
    return 'walker';
  }

  function spawnZombie(x, z, type) {
    const zt = ZOMBIE_TYPES[type];
    const hp = Math.round(run.cfg.zhp * zt.hpMult);
    run.zombies.push({
      type, x, z, hp, maxHp: hp, speed: zt.speed * rand(0.85, 1.15), size: zt.size,
      color: zt.color, score: zt.score, flash: 0, t: Math.random() * 10,
      shirt: pick(['#5b6cff', '#ff5fb4', '#2fb8e0', '#a55cff', '#ffb000', '#4fd645']),
    });
  }

  function spawnGroup(z) {
    const cfg = run.cfg;
    const count = Math.round((4 + Math.random() * 4) * cfg.density);
    const cx = rand(-0.5, 0.5);
    for (let i = 0; i < count; i++) {
      spawnZombie(clamp(cx + rand(-0.45, 0.45), -0.9, 0.9), z + rand(0, 3.5), zombieType());
    }
  }

  function spawnBarrel(z) {
    const hp = Math.round((25 + run.lvlIdx * 22) * rand(0.8, 1.8));
    run.barrels.push({
      x: rand(-0.65, 0.65), z, hp, maxHp: hp,
      drop: pick(['shield', 'rage', 'medkit', 'grenade', 'coins', 'rage', 'medkit']),
    });
  }

  function gateOption(good) {
    if (good) {
      return pick([
        { type: 'dmg', val: Math.round(rand(15, 40)) },
        { type: 'rate', val: Math.round(rand(15, 40)) },
        { type: 'shot', val: 1 },
        { type: 'heal', val: 30 },
      ]);
    }
    return pick([
      { type: 'dmg', val: -Math.round(rand(10, 30)) },
      { type: 'rate', val: -Math.round(rand(10, 30)) },
    ]);
  }

  function spawnGate(z) {
    const a = gateOption(true);
    let b = gateOption(Math.random() < 0.3);
    if (b.type === a.type && a.type !== 'dmg' && a.type !== 'rate') b = gateOption(false);
    const sides = Math.random() < 0.5 ? [a, b] : [b, a];
    run.gates.push({ z, sides: [{ side: -1, ...sides[0] }, { side: 1, ...sides[1] }] });
  }

  function gateLabel(g) {
    const sign = g.val >= 0 ? '+' : '';
    if (g.type === 'dmg') return `DMG ${sign}${g.val}%`;
    if (g.type === 'rate') return `FIRE ${sign}${g.val}%`;
    if (g.type === 'shot') return '+1 GUN';
    return `HEAL +${g.val}%`;
  }

  function spawnBoss() {
    const b = run.cfg.boss;
    run.boss = {
      ...b, x: 0, z: 24, hp: b.hp, maxHp: b.hp, flash: 0, t: 0,
    };
    run.bossThrow = 2;
    run.bossSummon = 3;
    hud.bossName.textContent = b.name;
    hud.boss.hidden = false;
    showBanner(b.final ? 'FINAL BOSS' : 'BOSS INCOMING', 2.2, 'boss');
  }

  // ---------- Update ----------

  function update(dt) {
    const r = run;
    r.t += dt;
    r.hurt = Math.max(0, r.hurt - dt);
    r.flash = Math.max(0, r.flash - dt);
    r.shake = Math.max(0, r.shake - dt);
    r.shield = Math.max(0, r.shield - dt);
    r.rage = Math.max(0, r.rage - dt);
    if (r.banner && (r.banner.t -= dt) <= 0) { r.banner = null; hud.banner.hidden = true; }

    if (r.state === 'ending') {
      r.endTimer -= dt;
      updateFx(dt);
      if (r.endTimer <= 0) finish(r.hp > 0);
      return;
    }

    // Movement
    let kdir = 0;
    for (const k of keys) kdir += k;
    if (kdir) r.targetX = clamp(r.targetX + kdir * 2.2 * dt, -0.85, 0.85);
    r.x += (r.targetX - r.x) * Math.min(1, dt * 16);

    // Forward motion; stop for the boss fight.
    const inBoss = r.dist >= r.cfg.length;
    if (inBoss) r.speed = Math.max(0, r.speed - dt * 8);
    const move = r.speed * dt;
    r.dist += move;

    if (!inBoss) {
      while (r.nextSpawn < r.dist + Z_FAR && r.nextSpawn < r.cfg.length - 10) {
        const z = r.nextSpawn - r.dist;
        if (r.nextSpawn >= r.nextGate) { spawnGate(z); r.nextGate += rand(40, 55); }
        else if (Math.random() < 0.25) spawnBarrel(z);
        else spawnGroup(z);
        r.nextSpawn += rand(9, 14) / r.cfg.density;
      }
    } else if (!r.boss) {
      spawnBoss();
    }
    while (r.nextProp < r.dist + Z_FAR) { spawnProp(r.nextProp - r.dist); r.nextProp += rand(2.5, 5); }

    for (const p of r.props) p.z -= move;
    r.props = r.props.filter(p => p.z > -CAM_D + 0.5);

    // Firing
    r.fireCd -= dt;
    const rate = r.stats.rate * r.rateMult * (r.rage > 0 ? 2 : 1);
    while (r.fireCd <= 0) {
      fire();
      r.fireCd += 1 / Math.max(rate, 0.5);
    }

    updateBullets(dt);
    updateZombies(dt, move);
    updateBarrels(move);
    updateGates(move);
    if (r.boss) updateBoss(dt);
    updateRocks(dt);
    updateFx(dt);
    if (r.state !== 'playing') return;

    if (r.hp <= 0) {
      r.hp = 0;
      r.state = 'ending';
      r.endTimer = 1.1;
      burst(r.x, 0, '#e0242c', 30);
    }
  }

  function fire() {
    const r = run;
    const n = r.shots;
    const gap = 0.13;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      r.bullets.push({ x: r.x + 0.08 + off, z: 0.9, vx: off * 0.25 });
    }
    r.flash = 0.06;
    Sound.play('shoot');
  }

  function bulletDamage() {
    const r = run;
    const crit = Math.random() < r.stats.crit;
    const dmg = Math.max(1, Math.round(r.stats.dmg * r.dmgMult * (crit ? 2 : 1) * rand(0.9, 1.1)));
    return { dmg, crit };
  }

  function updateBullets(dt) {
    const r = run;
    for (let i = r.bullets.length - 1; i >= 0; i--) {
      const b = r.bullets[i];
      const prevZ = b.z;
      b.z += BULLET_SPEED * dt;
      b.x += b.vx * dt;
      let hit = false;

      // Gates are hit when the bullet crosses their plane.
      for (const g of r.gates) {
        if (prevZ < g.z && b.z >= g.z) {
          const side = g.sides.find(s => Math.sign(b.x || 0.001) === s.side);
          if (side && (side.type === 'dmg' || side.type === 'rate')) {
            side.val = Math.min(side.val + 1, 90);
            break;
          }
        }
      }

      if (!hit) {
        let target = null, bestZ = Infinity;
        for (const z of r.zombies) {
          const rad = 0.13 * z.size + 0.05;
          if (Math.abs(z.x - b.x) < rad && z.z > prevZ - 0.6 && z.z < b.z + 0.3 && z.z < bestZ) { target = z; bestZ = z.z; }
        }
        for (const br of r.barrels) {
          if (Math.abs(br.x - b.x) < 0.24 && br.z > prevZ - 0.4 && br.z < b.z + 0.2 && br.z < bestZ) { target = br; bestZ = br.z; }
        }
        const boss = r.boss;
        if (boss && boss.hp > 0 && Math.abs(boss.x - b.x) < 0.34 * boss.size && boss.z > prevZ - 0.8 && boss.z < b.z + 0.4 && boss.z < bestZ) {
          target = boss;
        }
        if (target) {
          hit = true;
          const { dmg, crit } = bulletDamage();
          target.hp -= dmg;
          Sound.play('hit');
          target.flash = 0.08;
          const p = proj(target.x, target.z);
          const hgt = target === r.boss ? 0.8 * target.size : r.barrels.includes(target) ? 0.3 : 0.5 * (target.size || 1);
          addText(p.x + rand(-10, 10), p.y - hgt * roadW * p.s, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd23a' : '#fff', crit ? 18 : 13);
          if (target.hp <= 0) onKill(target);
        }
      }

      if (hit || b.z > Z_FAR) r.bullets.splice(i, 1);
    }
  }

  function onKill(t) {
    const r = run;
    if (r.zombies.includes(t)) {
      r.zombies.splice(r.zombies.indexOf(t), 1);
      r.kills++;
      Sound.play('kill');
      burst(t.x, t.z, t.color, 7);
      burst(t.x, t.z, pick(['#ffe14d', '#ff5fb4', '#2fe0c4', '#8fd2ff']), 4);
    } else if (r.barrels.includes(t)) {
      r.barrels.splice(r.barrels.indexOf(t), 1);
      burst(t.x, t.z, '#ff5a3a', 18);
      Sound.play('explode');
      applyDrop(t.drop, t);
    } else if (t === r.boss) {
      burst(t.x, t.z, t.color, 60);
      r.kills += 20;
      r.zombies.forEach(z => burst(z.x, z.z, z.color, 6));
      r.kills += r.zombies.length;
      r.zombies = [];
      r.rocks = [];
      r.state = 'ending';
      r.endTimer = 1.4;
      showBanner('BOSS DEFEATED', 1.4, 'good');
      Sound.play('explode');
    }
  }

  function applyDrop(drop, at) {
    const r = run;
    const p = proj(at.x, at.z);
    const say = (t, c) => addText(p.x, p.y - 40, t, c, 22, 1.2);
    Sound.play(drop === 'coins' ? 'coin' : 'powerup');
    if (drop === 'shield') { r.shield = 6; say('SHIELD!', '#6fd3ff'); }
    else if (drop === 'rage') { r.rage = 6; say('RAGE x2!', '#ff6a3a'); }
    else if (drop === 'medkit') { r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.25); say('+25% HP', '#5dff8a'); }
    else if (drop === 'coins') { const c = 25 + r.lvlIdx * 15; r.coins += c; say(`+${c} COINS`, '#ffd23a'); }
    else if (drop === 'grenade') {
      say('GRENADE!', '#ffd23a');
      const dmg = r.stats.dmg * r.dmgMult * 8;
      for (const z of [...r.zombies]) {
        if (z.z < 22) { z.hp -= dmg; z.flash = 0.1; if (z.hp <= 0) onKill(z); }
      }
      if (r.boss && r.boss.z < 22) { r.boss.hp -= dmg; if (r.boss.hp <= 0) onKill(r.boss); }
      r.fx.push({ type: 'boom', x: 0, z: 10, t: 0.5, max: 0.5 });
      r.shake = 0.3;
    }
  }

  function hurtPlayer(dmg) {
    const r = run;
    if (r.shield > 0) { addText(W / 2, baseY - roadW * 0.8, 'BLOCKED', '#6fd3ff', 16); Sound.play('block'); return; }
    r.hp -= dmg;
    Sound.play('hurt');
    r.hurt = 0.4;
    r.shake = 0.25;
    const p = proj(r.x, 0);
    addText(p.x, p.y - roadW * 0.7, `-${Math.round(dmg)}`, '#ff4a4a', 20);
  }

  function updateZombies(dt, move) {
    const r = run;
    for (let i = r.zombies.length - 1; i >= 0; i--) {
      const z = r.zombies[i];
      z.t += dt;
      z.flash = Math.max(0, z.flash - dt);
      z.z -= move + z.speed * dt;
      if (z.z < 14) z.x += clamp(r.x - z.x, -1, 1) * 0.6 * dt;
      if (z.z < 0.45 && z.z > -0.5 && Math.abs(z.x - r.x) < 0.25 + 0.1 * z.size) {
        hurtPlayer(r.cfg.zdmg * (z.type === 'tank' ? 2 : 1));
        burst(z.x, z.z, z.color, 8);
        r.zombies.splice(i, 1);
      } else if (z.z < -1.5) {
        r.zombies.splice(i, 1);
      }
    }
  }

  function updateBarrels(move) {
    const r = run;
    for (let i = r.barrels.length - 1; i >= 0; i--) {
      const b = r.barrels[i];
      b.z -= move;
      b.flash = Math.max(0, (b.flash || 0) - 0.016);
      if (b.z < 0.35 && b.z > -0.4 && Math.abs(b.x - r.x) < 0.38) {
        hurtPlayer(r.cfg.zdmg * 1.5);
        burst(b.x, b.z, '#ff5a3a', 14);
        r.barrels.splice(i, 1);
      } else if (b.z < -2) {
        r.barrels.splice(i, 1);
      }
    }
  }

  function updateGates(move) {
    const r = run;
    for (let i = r.gates.length - 1; i >= 0; i--) {
      const g = r.gates[i];
      g.z -= move;
      if (g.z <= 0.2) {
        const s = g.sides.find(s => s.side === (r.x < 0 ? -1 : 1));
        applyGate(s);
        r.gates.splice(i, 1);
      }
    }
  }

  function applyGate(g) {
    const r = run;
    const good = g.val >= 0;
    Sound.play(good ? 'gateGood' : 'gateBad');
    if (g.type === 'dmg') r.dmgMult = Math.max(0.2, r.dmgMult * (1 + g.val / 100));
    else if (g.type === 'rate') r.rateMult = Math.max(0.2, r.rateMult * (1 + g.val / 100));
    else if (g.type === 'shot') r.shots = Math.min(MAX_SHOTS, r.shots + 1);
    else if (g.type === 'heal') r.hp = Math.min(r.maxHp, r.hp + r.maxHp * g.val / 100);
    addText(W / 2, baseY - roadW * 1.1, gateLabel(g), good ? '#6fd3ff' : '#ff5a5a', 24, 1.2);
  }

  function updateBoss(dt) {
    const r = run, b = r.boss;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.z > 7) b.z -= 3 * dt;
    b.x = Math.sin(b.t * 0.7) * 0.45;

    r.bossThrow -= dt;
    if (r.bossThrow <= 0 && b.z <= 12) {
      const count = b.final ? 3 : r.lvlIdx >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const tx = clamp(r.x + (i ? rand(-0.5, 0.5) : 0), -0.85, 0.85);
        r.rocks.push({ x0: b.x, z0: b.z, tx, t: 0, dur: 1.05 });
        Sound.play('throw');
      }
      r.bossThrow = b.final ? 1.1 : Math.max(1.3, 2 - r.lvlIdx * 0.12);
    }
    r.bossSummon -= dt;
    if (r.bossSummon <= 0) {
      const n = 4 + r.lvlIdx * 2;
      for (let i = 0; i < n; i++) spawnZombie(rand(-0.8, 0.8), b.z + rand(-1, 2), zombieType());
      r.bossSummon = 4.5;
    }
  }

  function updateRocks(dt) {
    const r = run;
    for (let i = r.rocks.length - 1; i >= 0; i--) {
      const k = r.rocks[i];
      k.t += dt;
      if (k.t >= k.dur) {
        if (Math.abs(k.tx - r.x) < 0.3) hurtPlayer(r.boss ? r.boss.dmg : 15);
        burst(k.tx, 0, '#8fd13b', 12);
        Sound.play('thud');
        r.rocks.splice(i, 1);
      }
    }
  }

  function burst(x, z, color, n) {
    const p = proj(x, z);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(60, 220) * p.s + 30;
      run.fx.push({ type: 'spark', sx: p.x, sy: p.y - 20 * p.s, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, t: 0.5, max: 0.5, color, r: rand(2, 5) * (0.5 + p.s) });
    }
  }

  function addText(x, y, text, color, size, dur = 0.6) {
    if (run.texts.length > 70) run.texts.shift();
    run.texts.push({ x, y, text, color, size, t: dur, max: dur });
  }

  function updateFx(dt) {
    const r = run;
    for (let i = r.fx.length - 1; i >= 0; i--) {
      const f = r.fx[i];
      f.t -= dt;
      if (f.type === 'spark') { f.sx += f.vx * dt; f.sy += f.vy * dt; f.vy += 500 * dt; }
      if (f.t <= 0) r.fx.splice(i, 1);
    }
    for (let i = r.texts.length - 1; i >= 0; i--) {
      const t = r.texts[i];
      t.t -= dt;
      t.y -= 40 * dt;
      if (t.t <= 0) r.texts.splice(i, 1);
    }
  }

  // ---------- Drawing ----------

  function quad(x1, z1, x2, z2, color) {
    const a = proj(x1, z1), b = proj(x2, z1), c = proj(x2, z2), d = proj(x1, z2);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
  }

  function drawGround() {
    const r = run;
    const zNear = -CAM_D + 0.6;
    const far = proj(0, Z_FAR).y;

    // Park grass with scrolling mow stripes
    ctx.fillStyle = '#48b83e';
    ctx.fillRect(0, far, W, H - far);
    const gOff = r.dist % 4;
    for (let z = -gOff - 4; z < Z_FAR; z += 4) {
      quad(-12, Math.max(z, zNear), 12, Math.max(z + 2, zNear), '#56c94a');
    }

    // Sidewalks with tiles
    for (const s of [-1, 1]) {
      quad(s * 1.08, zNear, s * 1.95, Z_FAR, '#98a4ef');
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1.5;
      const tOff = r.dist % 1;
      for (let z = -tOff; z < Z_FAR; z += 1) {
        const a = proj(s * 1.08, z), b = proj(s * 1.95, z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const a = proj(s * 1.52, zNear), b = proj(s * 1.52, Z_FAR);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // Grass edge line
      const e1 = proj(s * 1.95, zNear), e2 = proj(s * 1.95, Z_FAR);
      ctx.strokeStyle = '#14132b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
    }

    // Road
    quad(-ROAD, zNear, ROAD, Z_FAR, '#4a4d86');
    quad(-ROAD, zNear, -ROAD + 0.12, Z_FAR, 'rgba(0,0,0,.12)');
    quad(ROAD - 0.12, zNear, ROAD, Z_FAR, 'rgba(0,0,0,.12)');

    // Red/white striped curbs
    const cOff = r.dist % 1.2;
    for (const s of [-1, 1]) {
      for (let z = -cOff - 1.2; z < Z_FAR; z += 1.2) {
        const z1 = Math.max(z, zNear), z2 = Math.max(z + 0.6, zNear), z3 = Math.max(z + 1.2, zNear);
        quad(s * ROAD, z1, s * 1.08, z2, '#ff4d5e');
        quad(s * ROAD, z2, s * 1.08, z3, '#ffffff');
      }
      const a = proj(s * ROAD, zNear), b = proj(s * ROAD, Z_FAR);
      ctx.strokeStyle = '#14132b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Dashed yellow center line
    const dash = 3, off2 = r.dist % dash;
    for (let z = -off2 - CAM_D + 1; z < Z_FAR; z += dash) {
      quad(-0.035, Math.max(z, zNear), 0.035, Math.max(z + 1.4, zNear), '#ffd35a');
    }

    // Cracks and paint splats for texture
    ctx.strokeStyle = 'rgba(20,19,43,.4)';
    ctx.lineWidth = 1.5;
    const coff = r.dist % 9;
    for (let k = 0; k < 6; k++) {
      const z = k * 9 - coff + 3;
      const x = ((k * 37) % 13) / 13 * 1.4 - 0.7;
      const a = proj(x, z), b = proj(x + 0.15, z + 0.5), c = proj(x + 0.05, z + 1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }

    // Sunset sky at the far end
    const sky = ctx.createLinearGradient(0, 0, 0, far + 2);
    sky.addColorStop(0, '#5a3fd6'); sky.addColorStop(0.6, '#ff6fae'); sky.addColorStop(1, '#ffc46b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, far + 2);
    const haze = ctx.createLinearGradient(0, far, 0, far + H * 0.12);
    haze.addColorStop(0, 'rgba(255,196,107,.85)');
    haze.addColorStop(1, 'rgba(255,196,107,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, far, W, H * 0.12);
  }

  function draw() {
    const r = run;
    if (!r) return;
    ctx.save();
    if (r.shake > 0) ctx.translate(rand(-5, 5) * r.shake * 4, rand(-5, 5) * r.shake * 4);
    drawGround();

    // Boss rock target markers on the ground
    for (const k of r.rocks) {
      const p = proj(k.tx, 0);
      const pulse = 0.5 + 0.5 * Math.sin(r.t * 20);
      ctx.strokeStyle = `rgba(255,50,50,${0.5 + pulse * 0.5})`;
      ctx.fillStyle = 'rgba(255,50,50,.2)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.3 * roadW, 0.09 * roadW, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Depth-sorted scene
    const list = [];
    for (const p of r.props) list.push({ z: p.z, fn: () => drawProp(p) });
    for (const b of r.barrels) list.push({ z: b.z, fn: () => { const p = proj(b.x, b.z); drawBarrel(ctx, p.x, p.y, 0.42 * roadW * p.s, 0.5 * roadW * p.s, Math.max(0, Math.ceil(b.hp))); } });
    for (const z of r.zombies) list.push({ z: z.z, fn: () => { const p = proj(z.x, z.z); drawZombie(ctx, p.x, p.y, 0.5 * z.size * roadW * p.s, z.t, { color: z.color, flash: z.flash, wide: z.type === 'tank' ? 1.25 : 1, shirt: z.shirt }); } });
    for (const g of r.gates) list.push({ z: g.z, fn: () => drawGatePair(g) });
    if (r.boss && r.boss.hp > 0) {
      const b = r.boss;
      list.push({ z: b.z, fn: () => { const p = proj(b.x, b.z); drawZombie(ctx, p.x, p.y, 0.8 * b.size * roadW * p.s, b.t, { color: b.color, flash: b.flash, wide: 1.2, boss: true, final: b.final, shirt: '#4a4f66' }); } });
    }
    if (!(r.state === 'ending' && r.hp <= 0)) {
      list.push({ z: 0, fn: drawPlayer });
    }
    list.sort((a, b) => b.z - a.z);
    for (const it of list) it.fn();

    // Bullets
    for (const b of r.bullets) {
      const p = proj(b.x, b.z), q = proj(b.x, b.z - 0.8);
      ctx.lineCap = 'round';
      const hy = 0.45 * roadW;
      ctx.beginPath(); ctx.moveTo(q.x, q.y - hy * q.s); ctx.lineTo(p.x, p.y - hy * p.s);
      ctx.strokeStyle = r.rage > 0 ? 'rgba(255,90,40,.55)' : 'rgba(255,150,40,.5)';
      ctx.lineWidth = Math.max(4, 14 * p.s);
      ctx.stroke();
      ctx.strokeStyle = r.rage > 0 ? '#ffd0a0' : '#fff6a0';
      ctx.lineWidth = Math.max(2, 6 * p.s);
      ctx.stroke();
    }

    // Rocks in flight
    for (const k of r.rocks) {
      const f = k.t / k.dur;
      const x = k.x0 + (k.tx - k.x0) * f, z = k.z0 * (1 - f);
      const p = proj(x, z);
      const arc = Math.sin(f * Math.PI) * roadW * 1.1 + 0.4 * roadW * p.s;
      drawRock(ctx, p.x, p.y - arc, 0.14 * roadW * p.s + 4, r.t);
    }

    // FX
    for (const f of r.fx) {
      const a = f.t / f.max;
      if (f.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.sx, f.sy, f.r, 0, Math.PI * 2); ctx.fill();
      } else if (f.type === 'boom') {
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = '#ffb02e';
        ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.globalAlpha = 1;

    // Floating numbers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of r.texts) {
      ctx.globalAlpha = Math.min(1, t.t / t.max * 2);
      ctx.font = `900 ${t.size}px "Lilita One", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size / 4);
      ctx.strokeStyle = '#1b1f2a';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Hurt vignette
    if (r.hurt > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${r.hurt})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawProp(p) {
    const q = proj(p.x, p.z);
    const h = p.h * roadW * q.s;
    if (p.kind === 'cone') drawCone(ctx, q.x, q.y, h);
    else if (p.kind === 'crate') drawCrate(ctx, q.x, q.y, h);
    else if (p.kind === 'hydrant') drawHydrant(ctx, q.x, q.y, h);
    else if (p.kind === 'bush') drawBush(ctx, q.x, q.y, h);
    else if (p.kind === 'car') drawCar(ctx, q.x, q.y, h, p.color);
    else drawTires(ctx, q.x, q.y, h);
  }

  function drawGatePair(g) {
    for (const s of g.sides) {
      const inner = s.side * 0.03, outer = s.side * 0.97;
      const a = proj(Math.min(inner, outer), g.z), b = proj(Math.max(inner, outer), g.z);
      const h = 0.5 * roadW * a.s;
      const good = s.val >= 0;
      drawGate(ctx, a.x, b.x, a.y, h, gateLabel(s), good);
    }
  }

  function drawPlayer() {
    const r = run;
    const p = proj(r.x, 0);
    const h = 0.62 * roadW;
    if (r.hurt > 0 && Math.floor(r.hurt * 25) % 2) return;
    // Extra guns from "+1 GUN" gates appear as buddy muzzles
    drawSoldierBack(ctx, p.x, p.y, h, r.t, r.flash);
    if (r.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(r.t * 10);
      ctx.fillStyle = '#6fd3ff';
      ctx.strokeStyle = '#d6f4ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - h * 0.5, h * 0.5, h * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (r.rage > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff6a3a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, h * 0.4, h * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- HUD ----------

  let lastBuffs = '';
  function updateHud() {
    const r = run;
    if (!r) return;
    const pct = Math.max(0, r.hp / r.maxHp);
    hud.hpFill.style.width = `${pct * 100}%`;
    hud.hpFill.classList.toggle('low', pct < 0.3);
    hud.hpText.textContent = `${Math.ceil(Math.max(0, r.hp))}`;
    hud.prog.style.width = `${Math.min(1, r.dist / r.cfg.length) * 100}%`;
    hud.kills.textContent = r.kills;
    if (r.boss) hud.bossFill.style.width = `${Math.max(0, r.boss.hp / r.boss.maxHp) * 100}%`;

    const chips = [];
    const chip = (cls, ic, color, text) => chips.push(`<span class="buff tx ${cls}">${icon(ic, color, 18)}${text}</span>`);
    if (r.shots > 1) chip('guns', 'rifle', '#fff', `x${r.shots}`);
    if (Math.abs(r.dmgMult - 1) > 0.01) chip(r.dmgMult < 1 ? 'bad' : '', 'burst', '#ff8a1f', `${Math.round(r.dmgMult * 100)}%`);
    if (Math.abs(r.rateMult - 1) > 0.01) chip(r.rateMult < 1 ? 'bad' : '', 'fire', '#ffc933', `${Math.round(r.rateMult * 100)}%`);
    if (r.shield > 0) chip('shield', 'helmet', '#8fd2ff', `${Math.ceil(r.shield)}s`);
    if (r.rage > 0) chip('rage', 'fire', '#ff4d5e', `${Math.ceil(r.rage)}s`);
    const html = chips.join('');
    if (html !== lastBuffs) { hud.buffs.innerHTML = html; lastBuffs = html; }
  }

  function loop(now) {
    if (!run || (run.state !== 'playing' && run.state !== 'ending')) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    if (!run) return; // finished this frame
    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  return { init, start, pause, resume, quit };
})();
