// In-level gameplay: a forward-scrolling street where the soldier auto-fires
// at zombie hordes, shoots through gates and barrels, then fights a boss.

const Game = (() => {
  const Z_FAR = 40;        // spawn distance
  const CAM_D = 9;         // camera distance behind the player
  const ROAD = 1;          // road half-width in world units
  const BULLET_SPEED = 30;
  const RANGE = 13;        // bullets fade out here, so fights happen mid-screen
  const RUN_SPEED = 2;        // you creep forward; enemies walk to you
  const MAX_SHOTS = 5;
  const MAX_SQUAD = 500;
  const SHOW_SQUAD = 130;   // soldiers drawn; the rest are only counted
  const XS = 1.32;          // horizontal stretch: wider road without bigger characters
  const MAX_VOLLEY = 40;    // bullets drawn per volley

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
      bossHp: document.getElementById('hud-boss-hp'),
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
      run.targetX = clamp(dragStart.x + (e.clientX - dragStart.px) / (roadW * XS * 0.75), -0.85, 0.85);
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
    roadW = Math.min(W * 0.36, H * 0.2);
    baseY = H * 0.64;
    horizon = H * 0.04;
    if (run && run.state !== 'playing') draw();
  }

  function proj(x, z) {
    const s = CAM_D / (z + CAM_D);
    return { x: W / 2 + x * XS * roadW * s, y: horizon + (baseY - horizon) * s, s };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- Run lifecycle ----------

  function start(chIdx, lvlIdx, endCallback) {
    const cfg = CHAPTERS[chIdx].levels[lvlIdx];
    const stats = playerStats();
    onEnd = endCallback;
    run = {
      chIdx, lvlIdx, gl: chIdx * 6 + lvlIdx, cfg, stats, len: Math.round(cfg.length * 0.4), theme: CHAPTERS[chIdx].theme,
      hp: stats.hp, maxHp: stats.hp,
      x: 0, targetX: 0, dist: 0, speed: RUN_SPEED, t: 0,
      dmgMult: 1, rateMult: 1, shots: 1,
      squad: 6, squadPeak: 6, cx: 0, slots: [], hw: 0, groups: {}, nextGid: 1,
      combo: 0, comboT: 9, comboPop: 0,
      shield: 0, rage: 0, hurt: 0, flash: 0, shake: 0,
      fireCd: 0.3,
      zombies: [], barrels: [], gates: [], bullets: [], rocks: [], fx: [], texts: [], props: [],
      nextSpawn: 9, nextGate: 14, nextProp: 0,
      boss: null, bossTimer: 0, bossSummon: 0, bossThrow: 0,
      kills: 0, coins: 0, state: 'playing', endTimer: 0,
      banner: null,
    };
    hud.level.textContent = `${chIdx + 1}-${lvlIdx + 1} · ${cfg.name}`;
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
    const keep = Math.min(hpPct, (r.squad + 1) / (r.squadPeak + 1) * 1.5);
    const stars = win ? (keep > 0.7 ? 3 : keep > 0.35 ? 2 : 1) : 0;
    const coins = r.coins + r.kills * 1 + (win ? 150 + r.gl * 100 : 0);
    const score = r.kills * 10 + (win ? 1000 * (r.gl + 1) + Math.round(keep * 1000) : 0);
    cancelAnimationFrame(raf);
    Sound.setMode('menu');
    Sound.play(win ? 'victory' : 'defeat');
    const cb = onEnd;
    run = null;
    cb({ win, chIdx: r.chIdx, lvlIdx: r.lvlIdx, kills: r.kills, coins, stars, score, squad: r.squad, reached: r.dist / r.len });
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
    if (!run.theme.props.length) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const kind = pick(run.theme.props);
    const far = kind === 'car' || kind === 'bush' || kind === 'cactus' || kind === 'rock';
    run.props.push({
      x: side * (far ? rand(2.05, 2.6) : rand(1.3, 1.8)), z, kind,
      h: kind === 'car' ? rand(0.32, 0.4) : kind === 'bush' || kind === 'rock' ? rand(0.3, 0.45) : kind === 'cactus' ? rand(0.45, 0.65) : rand(0.22, 0.32),
      color: pick(['#ff4d5e', '#29a8ff', '#ffc933', '#a55cff', '#4fd645', '#ff8a1f']),
    });
  }

  const TYPE_WEIGHT = { walker: 5, runner: 2.2, tank: 1, armored: 2, bomber: 1.3 };
  function zombieType() {
    const types = run.cfg.types;
    let r = Math.random() * types.reduce((sum, t) => sum + TYPE_WEIGHT[t], 0);
    for (const t of types) if ((r -= TYPE_WEIGHT[t]) < 0) return t;
    return 'walker';
  }

  function spawnZombie(x, z, type, gid = 0) {
    const zt = ZOMBIE_TYPES[type];
    const hp = Math.round(run.cfg.zhp * zt.hpMult);
    run.zombies.push({
      gid, acc: 0, accT: 0,
      type, x, z, hp, maxHp: hp, speed: zt.speed * 1.6 * rand(0.85, 1.15), size: zt.size,
      color: zt.color, score: zt.score, flash: 0, t: Math.random() * 10, helmet: !!zt.helmet, bomb: !!zt.bomb, contact: zt.contact || (type === 'tank' ? 2 : 1),
      shirt: pick(['#5b6cff', '#ff5fb4', '#2fb8e0', '#a55cff', '#ffb000', '#4fd645']),
    });
  }

  function spawnGroup(z) {
    const cfg = run.cfg;
    const count = Math.round((6 + Math.random() * 6) * cfg.density + run.gl * 0.8);
    const cx = rand(-0.45, 0.45);
    const gid = run.nextGid++;
    run.groups[gid] = { total: count, alive: count };
    // Packed crowd, like the ad's enemy squads
    const cols = Math.ceil(Math.sqrt(count * 1.3));
    for (let i = 0; i < count; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = clamp(cx + (col - (cols - 1) / 2) * 0.17 + rand(-0.04, 0.04), -0.92, 0.92);
      spawnZombie(x, z + row * 0.32 + rand(-0.08, 0.08), zombieType(), gid);
    }
  }

  // Barrels carry a reward on top: shoot the number to 0 to claim it.
  function spawnBarrel(z) {
    const both = Math.random() < 0.45;
    const xs = both ? [-0.5, 0.5] : [rand(-0.6, 0.6)];
    for (const x of xs) {
      const roll = Math.random();
      const drop = roll < 0.5 ? 'squad' : roll < 0.65 ? 'gatling' : pick(['shield', 'rage', 'medkit', 'grenade', 'coins']);
      const base = drop === 'squad' ? 1.3 : drop === 'gatling' ? 1.6 : 1;
      const hp = Math.round((40 + run.gl * 45) * base * rand(0.8, 1.6) / 10) * 10;
      const gain = Math.round(rand(4, 8) + run.gl * 1.3);
      run.barrels.push({ x, z, hp, maxHp: hp, drop, gain, acc: 0, accT: 0, t: Math.random() * 9 });
    }
  }

  function gateOption(good) {
    if (good) {
      return pick([
        { type: 'squad', val: Math.round(rand(5, 12) + run.gl) },
        { type: 'squad', val: Math.round(rand(5, 12) + run.gl) },
        { type: 'mult', val: 2 },
        { type: 'dmg', val: Math.round(rand(15, 40)) },
        { type: 'rate', val: Math.round(rand(15, 40)) },
        { type: 'shot', val: 1 },
        { type: 'heal', val: 30 },
      ]);
    }
    return pick([
      { type: 'squad', val: -Math.round(rand(8, 20) + run.gl * 2) },
      { type: 'squad', val: -Math.round(rand(8, 20) + run.gl * 2) },
      { type: 'dmg', val: -Math.round(rand(10, 30)) },
      { type: 'rate', val: -Math.round(rand(10, 30)) },
    ]);
  }

  function spawnGate(z) {
    const a = gateOption(true);
    let b = gateOption(Math.random() < 0.3);
    if (b.type === a.type && a.type !== 'dmg' && a.type !== 'rate' && a.type !== 'squad') b = gateOption(false);
    const sides = Math.random() < 0.5 ? [a, b] : [b, a];
    run.gates.push({ z, sides: [{ side: -1, ...sides[0] }, { side: 1, ...sides[1] }] });
  }

  function gateLabel(g) {
    const v = Math.round(g.val);
    const sign = v >= 0 ? '+' : '';
    if (g.type === 'squad') return `${sign}${v}`;
    if (g.type === 'mult') return 'x2';
    if (g.type === 'dmg') return `DMG ${sign}${v}%`;
    if (g.type === 'rate') return `FIRE ${sign}${v}%`;
    if (g.type === 'shot') return '+1 GUN';
    return `HEAL +${v}%`;
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
    r.comboT += dt;
    r.comboPop = Math.max(0, r.comboPop - dt * 4);
    if (r.comboT > 2.2) r.combo = 0;

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
    layoutSquad(dt);

    // Forward motion; stop for the boss fight.
    const inBoss = r.dist >= r.len;
    if (inBoss) r.speed = Math.max(0, r.speed - dt * 8);
    const move = r.speed * dt;
    r.dist += move;

    if (!inBoss) {
      while (r.nextSpawn < r.dist + Z_FAR && r.nextSpawn < r.len - 10) {
        const z = r.nextSpawn - r.dist;
        if (r.nextSpawn >= r.nextGate) { spawnGate(z); r.nextGate += rand(15, 20); }
        else if (Math.random() < 0.5) spawnBarrel(z);
        else spawnGroup(z);
        r.nextSpawn += rand(4.5, 7) / r.cfg.density;
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
    flushDamage(dt);
    updateFx(dt);
    if (r.state !== 'playing') return;

    if (r.hp <= 0) {
      r.hp = 0;
      r.state = 'ending';
      r.endTimer = 1.1;
      burst(r.x, 0, '#e0242c', 30);
    }
  }

  // Formation behind the leader: rows of up to 9, centered on the road.
  function layoutSquad(dt) {
    const r = run;
    const n = Math.min(r.squad, SHOW_SQUAD);
    const cols = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(n * 2))));
    const sp = 0.14;
    r.hw = n ? (Math.min(n, cols) - 1) * sp / 2 + 0.08 : 0;
    const tx = clamp(r.x, -0.95 + r.hw, 0.95 - r.hw);
    r.cx += (tx - r.cx) * Math.min(1, dt * 9);
    const slots = r.slots;
    slots.length = n;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      const jx = Math.sin(i * 12.9898) * 0.025, jz = Math.cos(i * 78.233) * 0.05;
      slots[i] = { x: r.cx + (col - (inRow - 1) / 2) * sp + jx, z: -0.55 - row * 0.26 + jz, ph: i * 1.7 };
    }
  }

  function fire() {
    const r = run;
    const n = r.shots;
    const gap = 0.13;
    // Soldiers deal 40% of the leader's damage. Bullets drawn are capped, so each carries a share.
    const vis = Math.min(n + r.squad, MAX_VOLLEY);
    const share = (n + r.squad * 0.3) / vis;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      r.bullets.push({ x: r.x + 0.08 + off, z: 0.9, vx: off * 0.25, m: share });
    }
    const extra = vis - n;
    const slots = r.slots;
    for (let i = 0; i < extra && slots.length; i++) {
      const sl = slots[Math.floor(Math.random() * slots.length)];
      r.bullets.push({ x: sl.x + 0.05, z: sl.z + 0.45 + Math.random() * 0.3, vx: 0, m: share });
    }
    r.flash = 0.06;
    Sound.play('shoot');
  }

  function bulletDamage(m = 1) {
    const r = run;
    const crit = Math.random() < r.stats.crit;
    const dmg = Math.max(1, Math.round(r.stats.dmg * r.dmgMult * m * (crit ? 2 : 1) * rand(0.9, 1.1)));
    return { dmg, crit };
  }

  // Damage numbers are summed per target and shown a few times a second, like "-420".
  function flushDamage(dt) {
    const r = run;
    const show = t => {
      t.accT += dt;
      if (t.acc > 0 && t.accT > 0.3) {
        const p = proj(t.x, t.z);
        const hgt = t === r.boss ? 0.9 * t.size : t.maxHp && t.drop ? 0.75 : 0.6 * (t.size || 1);
        addText(p.x + rand(-12, 12), p.y - hgt * roadW * p.s, `-${fmtN(t.acc)}`, '#ffb02e', 15 + Math.min(10, t.acc / 60));
        t.acc = 0; t.accT = 0;
      }
    };
    for (const b of r.barrels) show(b);
    if (r.boss) show(r.boss);
  }
  const fmtN = n => n >= 10000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));

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
          if (side && (side.type === 'dmg' || side.type === 'rate' || side.type === 'squad')) {
            // Shooting a sign raises its value (red signs climb toward positive).
            side.val = Math.min(side.val + (side.type === 'squad' ? 0.12 : 0.2) * b.m * 2, side.type === 'squad' ? 60 : 90);
            break;
          }
        }
      }

      if (!hit) {
        let target = null, bestZ = Infinity;
        for (const z of r.zombies) {
          const rad = 0.15 * z.size + 0.05;
          if (Math.abs(z.x - b.x) < rad && z.z > prevZ - 0.6 && z.z < b.z + 0.3 && z.z < bestZ) { target = z; bestZ = z.z; }
        }
        for (const br of r.barrels) {
          if (Math.abs(br.x - b.x) < 0.33 && br.z > prevZ - 0.4 && br.z < b.z + 0.2 && br.z < bestZ) { target = br; bestZ = br.z; }
        }
        const boss = r.boss;
        if (boss && boss.hp > 0 && Math.abs(boss.x - b.x) < 0.34 * boss.size && boss.z > prevZ - 0.8 && boss.z < b.z + 0.4 && boss.z < bestZ) {
          target = boss;
        }
        if (target) {
          hit = true;
          const { dmg } = bulletDamage(b.m);
          target.hp -= dmg;
          target.acc = (target.acc || 0) + dmg;
          if (target.accT === undefined) target.accT = 0;
          Sound.play('hit');
          target.flash = 0.08;
          if (target.hp <= 0) onKill(target);
        }
      }

      if (hit || b.z > RANGE) r.bullets.splice(i, 1);
    }
  }

  function onKill(t) {
    const r = run;
    if (r.zombies.includes(t)) {
      r.zombies.splice(r.zombies.indexOf(t), 1);
      r.kills++;
      r.combo++; r.comboT = 0; r.comboPop = 1;
      if (t.gid && r.groups[t.gid]) r.groups[t.gid].alive--;
      Sound.play('kill');
      burst(t.x, t.z, t.color, 7);
      burst(t.x, t.z, pick(['#ffe14d', '#ff5fb4', '#2fe0c4', '#8fd2ff']), 4);
    } else if (r.barrels.includes(t)) {
      r.barrels.splice(r.barrels.indexOf(t), 1);
      planks(t.x, t.z);
      if (t.acc) { const p = proj(t.x, t.z); addText(p.x, p.y - 0.75 * roadW * p.s, `-${fmtN(t.acc)}`, '#ffb02e', 20); t.acc = 0; }
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
    const say = (t, c) => addText(W / 2, H * 0.42, t, c, 26, 1.2);
    Sound.play(drop === 'coins' ? 'coin' : 'powerup');
    if (drop === 'squad') { addSquad(at.gain); say(`+${at.gain} SOLDIERS`, '#8fd2ff'); }
    else if (drop === 'gatling') { r.shots = Math.min(MAX_SHOTS, r.shots + 1); r.rateMult *= 1.15; say('GATLING!', '#ffd23a'); }
    else if (drop === 'shield') { r.shield = 6; say('SHIELD!', '#6fd3ff'); }
    else if (drop === 'rage') { r.rage = 6; say('RAGE x2!', '#ff6a3a'); }
    else if (drop === 'medkit') { r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.25); say('+25% HP', '#5dff8a'); }
    else if (drop === 'coins') { const c = 25 + r.gl * 15; r.coins += c; say(`+${c} COINS`, '#ffd23a'); }
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

  function addSquad(n) {
    const r = run;
    r.squad = clamp(Math.round(r.squad + n), 0, MAX_SQUAD);
    r.squadPeak = Math.max(r.squadPeak, r.squad);
  }

  function loseSoldiers(k, x, z) {
    const r = run;
    const lost = Math.min(r.squad, Math.ceil(k));
    if (!lost) return;
    r.squad -= lost;
    burst(x, z, '#3aa0ff', 6 + lost * 2);
    const p = proj(x, Math.min(z, -0.5));
    addText(p.x, p.y - roadW * 0.4, `-${lost}`, '#ff4a4a', 20);
    Sound.play('hurt');
    r.shake = Math.max(r.shake, 0.12);
  }

  // Something reached the player: soldiers take the hit first, then the leader.
  function contact(x, dmg, soldiers, rad = 0.12) {
    const r = run;
    const nearLeader = Math.abs(x - r.x) < 0.22 + rad;
    const nearSquad = r.squad > 0 && Math.abs(x - r.cx) < r.hw + rad;
    if (r.squad > 0 && (nearSquad || nearLeader)) { loseSoldiers(soldiers, x, -0.6); return true; }
    if (nearLeader) { hurtPlayer(dmg); return true; }
    return false;
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
      if (z.z < 0.45 && z.z > -0.5 && contact(z.x, r.cfg.zdmg * z.contact, z.contact, 0.08 * z.size)) {
        if (z.gid && r.groups[z.gid]) r.groups[z.gid].alive--;
        burst(z.x, z.z, z.color, 8);
        if (z.bomb) { burst(z.x, z.z, '#ffb02e', 20); Sound.play('explode'); r.shake = 0.35; }
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
      b.t += 0.016;
      if (b.z < 0.35 && b.z > -0.4 && contact(b.x, r.cfg.zdmg * 1.5, 3, 0.2)) {
        planks(b.x, b.z);
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
    const good = Math.round(g.val) >= 0;
    Sound.play(good ? 'gateGood' : 'gateBad');
    if (g.type === 'dmg') r.dmgMult = Math.max(0.2, r.dmgMult * (1 + g.val / 100));
    else if (g.type === 'rate') r.rateMult = Math.max(0.2, r.rateMult * (1 + g.val / 100));
    else if (g.type === 'shot') r.shots = Math.min(MAX_SHOTS, r.shots + 1);
    else if (g.type === 'heal') r.hp = Math.min(r.maxHp, r.hp + r.maxHp * g.val / 100);
    else if (g.type === 'squad') { if (g.val >= 0) addSquad(g.val); else loseSoldiers(-Math.round(g.val), r.cx, -0.6); }
    else if (g.type === 'mult') addSquad(Math.max(1, r.squad));
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
      const count = b.final ? 3 : r.gl >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const tx = clamp(r.x + (i ? rand(-0.5, 0.5) : 0), -0.85, 0.85);
        r.rocks.push({ x0: b.x, z0: b.z, tx, t: 0, dur: 1.05 });
        Sound.play('throw');
      }
      r.bossThrow = b.final ? 1.1 : Math.max(1.2, 2 - r.gl * 0.1);
    }
    r.bossSummon -= dt;
    if (r.bossSummon <= 0) {
      const n = 8 + Math.min(r.gl, 8) * 3;
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
        contact(k.tx, r.boss ? r.boss.dmg : 15, 2 + r.gl * 0.5, 0.25);
        burst(k.tx, 0, '#8fd13b', 12);
        Sound.play('thud');
        r.rocks.splice(i, 1);
      }
    }
  }

  function planks(x, z) {
    const p = proj(x, z);
    for (let i = 0; i < 16; i++) {
      const a = rand(-Math.PI, 0), sp = rand(120, 380) * (0.5 + p.s * 0.5);
      run.fx.push({ type: 'plank', sx: p.x + rand(-10, 10), sy: p.y - 0.3 * roadW * p.s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rand(0, 6), vr: rand(-12, 12),
        w: rand(10, 22) * (0.4 + p.s * 0.6), h: rand(5, 9) * (0.4 + p.s * 0.6), color: pick(['#c98b4a', '#a86a35', '#e0a766']), t: 0.8, max: 0.8 });
    }
    Sound.play('explode');
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
      if (f.type === 'spark' || f.type === 'plank') { f.sx += f.vx * dt; f.sy += f.vy * dt; f.vy += 700 * dt; if (f.rot !== undefined) f.rot += f.vr * dt; }
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

    const th = r.theme;
    if (th.bridge) { drawBridge(zNear, far); return; }
    // Park grass with scrolling mow stripes
    ctx.fillStyle = th.ground[0];
    ctx.fillRect(0, far, W, H - far);
    const gOff = r.dist % 4;
    for (let z = -gOff - 4; z < Z_FAR; z += 4) {
      quad(-12, Math.max(z, zNear), 12, Math.max(z + 2, zNear), th.ground[1]);
    }

    // Sidewalks with tiles
    for (const s of [-1, 1]) {
      quad(s * 1.08, zNear, s * 1.95, Z_FAR, th.shoulder);
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
    quad(-ROAD, zNear, ROAD, Z_FAR, th.road);
    quad(-ROAD, zNear, -ROAD + 0.12, Z_FAR, 'rgba(0,0,0,.12)');
    quad(ROAD - 0.12, zNear, ROAD, Z_FAR, 'rgba(0,0,0,.12)');

    // Red/white striped curbs
    const cOff = r.dist % 1.2;
    for (const s of [-1, 1]) {
      for (let z = -cOff - 1.2; z < Z_FAR; z += 1.2) {
        const z1 = Math.max(z, zNear), z2 = Math.max(z + 0.6, zNear), z3 = Math.max(z + 1.2, zNear);
        quad(s * ROAD, z1, s * 1.08, z2, th.curb[0]);
        quad(s * ROAD, z2, s * 1.08, z3, th.curb[1]);
      }
      const a = proj(s * ROAD, zNear), b = proj(s * ROAD, Z_FAR);
      ctx.strokeStyle = '#14132b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Dashed yellow center line
    const dash = 3, off2 = r.dist % dash;
    for (let z = -off2 - CAM_D + 1; z < Z_FAR; z += dash) {
      quad(-0.035, Math.max(z, zNear), 0.035, Math.max(z + 1.4, zNear), th.line);
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
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.6, th.sky[1]); sky.addColorStop(1, th.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, far + 2);
    const haze = ctx.createLinearGradient(0, far, 0, far + H * 0.12);
    haze.addColorStop(0, th.sky[2] + 'd9');
    haze.addColorStop(1, th.sky[2] + '00');
    ctx.fillStyle = haze;
    ctx.fillRect(0, far, W, H * 0.12);
  }

  // Suspension bridge over water, like the ad.
  function drawBridge(zNear, far) {
    const r = run, th = r.theme;
    const water = ctx.createLinearGradient(0, far, 0, H);
    water.addColorStop(0, '#6fb8e8'); water.addColorStop(1, '#2f7fc4');
    ctx.fillStyle = water; ctx.fillRect(0, far, W, H - far);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    const wOff = r.dist % 3;
    for (let z = -wOff; z < Z_FAR; z += 3) {
      for (const s of [-1, 1]) {
        const a = proj(s * 2.2, z), b = proj(s * 3.4, z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - 4 * a.s, b.x, b.y); ctx.stroke();
      }
    }
    // Deck edge (shadow side), sidewalks, road
    quad(-1.5, zNear, 1.5, Z_FAR, '#6b707c');
    quad(-1.42, zNear, 1.42, Z_FAR, '#c3c7cf');
    quad(-ROAD, zNear, ROAD, Z_FAR, th.road);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.5;
    const jOff = r.dist % 4;
    for (let z = -jOff; z < Z_FAR; z += 4) {
      const a = proj(-ROAD, z), b = proj(ROAD, z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const s of [-1, 1]) {
      const a = proj(s * ROAD, zNear), b = proj(s * ROAD, Z_FAR);
      ctx.strokeStyle = '#8d929c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const dash = 3, off2 = r.dist % dash;
    for (let z = -off2 - CAM_D + 1; z < Z_FAR; z += dash) {
      quad(-0.03, Math.max(z, zNear), 0.03, Math.max(z + 1.3, zNear), th.line);
    }
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, far + 2);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.6, th.sky[1]); sky.addColorStop(1, th.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, far + 2);
    // Red railings, hanger cables and towers (drawn back to front)
    const span = 30, tOff = r.dist % span;
    const railH = 0.16, rail = '#d8322f';
    for (const s of [-1, 1]) {
      const x = s * 1.46;
      const start = Math.floor((r.dist - CAM_D) / 1) * 1 - r.dist;
      // Hangers follow a sag between towers
      ctx.strokeStyle = 'rgba(216,50,47,.85)';
      for (let z = Z_FAR; z > zNear + 1; z -= 1) {
        const zz = Math.round(z + r.dist) - r.dist;
        const ph = (((zz + r.dist) % span) + span) % span / span;
        const sag = 0.35 + 2.4 * Math.pow(ph * 2 - 1, 2);
        const a = proj(x, zz);
        ctx.lineWidth = Math.max(1, 1.6 * a.s);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - sag * roadW * a.s); ctx.stroke();
      }
      // Posts + top rail
      for (let z = Z_FAR; z > zNear + 0.5; z -= 0.5) {
        const zz = Math.round((z + r.dist) * 2) / 2 - r.dist;
        const a = proj(x, zz);
        ctx.fillStyle = rail;
        ctx.fillRect(a.x - Math.max(1, 2 * a.s), a.y - railH * roadW * a.s, Math.max(2, 4 * a.s), railH * roadW * a.s);
      }
      const a = proj(x, zNear + 0.6), b = proj(x, Z_FAR);
      ctx.strokeStyle = rail; ctx.lineWidth = Math.max(2, 5 * a.s * 0.4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y - railH * roadW * a.s); ctx.lineTo(b.x, b.y - railH * roadW * b.s); ctx.stroke();
      ctx.strokeStyle = '#8f1f1d'; ctx.lineWidth = Math.max(1.5, 3 * a.s * 0.4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y - railH * 0.5 * roadW * a.s); ctx.lineTo(b.x, b.y - railH * 0.5 * roadW * b.s); ctx.stroke();
      void start;
    }
    // Tower pillars at the sides only (no beams across the view)
    for (let z = Z_FAR - ((r.dist + Z_FAR) % span); z > 2; z -= span) {
      if (z > Z_FAR) continue;
      const fade = Math.min(1, (z - 2) / 4);
      ctx.globalAlpha = fade;
      for (const x of [-1.62, 1.62]) {
        const q = proj(x, z);
        const th2 = 2.6 * roadW * q.s, tw = Math.max(4, 0.14 * roadW * q.s);
        ctx.fillStyle = '#c42a28'; ctx.strokeStyle = '#14132b'; ctx.lineWidth = 2;
        ctx.fillRect(q.x - tw / 2, q.y - th2, tw, th2); ctx.strokeRect(q.x - tw / 2, q.y - th2, tw, th2);
      }
      ctx.globalAlpha = 1;
    }
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
    for (const b of r.barrels) list.push({ z: b.z, fn: () => drawRewardBarrel(b) });
    const slots = r.slots;
    if (!(r.state === 'ending' && r.hp <= 0)) {
      for (let i = 0; i < slots.length; i++) {
        const sl = slots[i];
        list.push({ z: sl.z, fn: () => { const p = proj(sl.x, sl.z); drawTrooper(ctx, p.x, p.y, 0.4 * roadW * p.s, r.t, { phase: sl.ph }); } });
      }
    }
    for (const z of r.zombies) list.push({ z: z.z, fn: () => { const p = proj(z.x, z.z); drawZombie(ctx, p.x, p.y, 0.62 * z.size * roadW * p.s, z.t, { color: z.color, flash: z.flash, wide: z.type === 'tank' ? 1.25 : 1, shirt: z.shirt, helmet: z.helmet, bomb: z.bomb }); } });
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
    const hy = 0.3 * roadW;
    ctx.fillStyle = r.rage > 0 ? '#ff8a4a' : '#ffd23a';
    ctx.beginPath();
    for (const b of r.bullets) {
      const p = proj(b.x, b.z), q = proj(b.x, b.z - 0.55);
      const w = Math.max(1.6, 4.5 * p.s);
      const ty = p.y - hy * p.s, by = q.y - hy * q.s;
      ctx.moveTo(p.x, ty - w);
      ctx.quadraticCurveTo(p.x + w, ty, q.x, by);
      ctx.quadraticCurveTo(p.x - w, ty, p.x, ty - w);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,.9)';
    ctx.beginPath();
    for (const b of r.bullets) {
      const p = proj(b.x, b.z);
      ctx.moveTo(p.x, p.y - hy * p.s);
      ctx.arc(p.x, p.y - hy * p.s, Math.max(0.8, 1.8 * p.s), 0, Math.PI * 2);
    }
    ctx.fill();

    drawGroupCounters();

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
      } else if (f.type === 'plank') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.save(); ctx.translate(f.sx, f.sy); ctx.rotate(f.rot);
        ctx.fillStyle = f.color; ctx.strokeStyle = '#14132b'; ctx.lineWidth = 1.5;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h);
        ctx.restore();
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

    if (r.combo >= 3) drawCombo();

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

  function drawRewardBarrel(b) {
    const p = proj(b.x, b.z);
    const w = 0.66 * roadW * p.s, h = 0.72 * roadW * p.s;
    drawBarrel(ctx, p.x, p.y, w, h, Math.max(0, Math.ceil(b.hp)));
    const top = p.y - h - w * 0.08;
    if (b.drop === 'squad') {
      const th = 0.36 * roadW * p.s;
      drawTrooper(ctx, p.x - w * 0.2, top, th, 0, { back: false, phase: 1 });
      drawTrooper(ctx, p.x + w * 0.2, top, th, 0, { back: false, phase: 2 });
      tag(`+${b.gain}`, p.x, top - th * 1.05, Math.max(10, 0.2 * roadW * p.s), '#8fd2ff');
    } else if (b.drop === 'gatling') {
      drawGatling(ctx, p.x, top - w * 0.25, w * 0.95, run.t);
    } else {
      drawPickup(ctx, p.x, top - w * 0.3, w * 0.6, b.drop, run.t);
    }
  }

  function tag(text, x, y, size, color) {
    ctx.font = `900 ${Math.round(size)}px "Lilita One", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 4); ctx.strokeStyle = '#14132b';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  // Skull + bar + count over each enemy crowd.
  function drawGroupCounters() {
    const r = run;
    const g = {};
    for (const z of r.zombies) {
      if (!z.gid) continue;
      const e = g[z.gid] || (g[z.gid] = { sx: 0, n: 0, zmax: -99 });
      e.sx += z.x; e.n++; e.zmax = Math.max(e.zmax, z.z);
    }
    for (const id in g) {
      const e = g[id], grp = r.groups[id];
      if (!grp || e.zmax > Z_FAR - 2) continue;
      const p = proj(e.sx / e.n, e.zmax + 0.2);
      const y = p.y - 0.9 * roadW * p.s;
      const bw = Math.max(60, 1.3 * roadW * p.s), bh = Math.max(8, 0.1 * roadW * p.s);
      const x0 = p.x - bw / 2;
      ctx.fillStyle = 'rgba(20,19,43,.75)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y, bw, bh, bh / 2) : ctx.rect(x0, y, bw, bh); ctx.fill();
      ctx.fillStyle = '#ff4d5e';
      const f = Math.max(0, grp.alive / grp.total);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 + 2, y + 2, (bw - 4) * f, bh - 4, (bh - 4) / 2) : ctx.rect(x0 + 2, y + 2, (bw - 4) * f, bh - 4); ctx.fill();
      const sr = bh * 1.1;
      ctx.fillStyle = '#ff4d5e'; ctx.strokeStyle = '#14132b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, y - sr * 1.1, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#14132b';
      ctx.beginPath(); ctx.arc(p.x - sr * 0.35, y - sr * 1.15, sr * 0.22, 0, Math.PI * 2); ctx.arc(p.x + sr * 0.35, y - sr * 1.15, sr * 0.22, 0, Math.PI * 2); ctx.fill();
      tag(String(Math.max(0, e.n)), p.x, y + bh / 2, Math.max(11, bh * 1.5), '#fff');
    }
  }

  // Big slanted "19 kill" streak counter.
  function drawCombo() {
    const r = run;
    const fade = Math.min(1, (2.2 - r.comboT) * 2);
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(W * 0.8, H * 0.3);
    ctx.rotate(-0.12);
    const sc = 1 + r.comboPop * 0.35;
    ctx.scale(sc, sc);
    const size = Math.min(58, W * 0.14);
    ctx.font = `italic 900 ${size}px "Lilita One", system-ui, sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const g = ctx.createLinearGradient(0, -size, 0, 0);
    g.addColorStop(0, '#fff7c2'); g.addColorStop(0.5, '#ffd23a'); g.addColorStop(1, '#ff9a1f');
    ctx.lineWidth = size / 7; ctx.strokeStyle = 'rgba(120,60,0,.85)';
    ctx.strokeText(r.combo, 0, 0);
    ctx.fillStyle = g; ctx.fillText(r.combo, 0, 0);
    ctx.font = `italic 900 ${size * 0.34}px "Lilita One", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineWidth = size / 14;
    ctx.strokeText('kill', 4, 0); ctx.fillText('kill', 4, 0);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(-size * 1.2, size * 0.18); ctx.lineTo(size * 0.9, size * 0.06); ctx.lineTo(size * 0.9, size * 0.12); ctx.closePath(); ctx.fill();
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
    else if (p.kind === 'cactus') drawCactus(ctx, q.x, q.y, h);
    else if (p.kind === 'rock') drawDesertRock(ctx, q.x, q.y, h);
    else if (p.kind === 'drum') drawDrum(ctx, q.x, q.y, h);
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
    hud.prog.style.width = `${Math.min(1, r.dist / r.len) * 100}%`;
    hud.kills.textContent = r.squad;
    if (r.boss) {
      const bp = Math.max(0, r.boss.hp);
      hud.bossFill.style.width = `${bp / r.boss.maxHp * 100}%`;
      hud.bossHp.textContent = bp > 0 ? fmtN(Math.ceil(bp)) : '';
      if (bp <= 0) hud.boss.hidden = true;
    }

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
