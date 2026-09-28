// Menus, bottom navbar, modals and the glue between menus and the game.

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const TAB_IDS = ['shop', 'gear', 'play', 'skills', 'modes'];
  const STAT_ICON = { hp: ['heart', '#ff4d5e'], dmg: ['burst', '#ff8a1f'], rate: ['fire', '#ff6a2a'], crit: ['target', '#2fe0c4'] };
  let tab = 2;
  let selectedLevel = 0;
  let selectedChapter = 0;
  let gearFilter = 'all';
  let shopTab = 'chests';
  let sceneRaf = 0;
  let paused = false;
  let modesTab = 'modes';
  let currentMode = null;   // mode being played, or null for a chapter level

  // ---------- Helpers ----------

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }

  function fmtTime(ms) {
    const m = Math.ceil(ms / 60000), h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  }

  // Currency counters tick up/down to their new value.
  const shown = {};
  function countTo(id, value) {
    const el = document.getElementById(id);
    const from = shown[id] ?? value;
    shown[id] = value;
    if (from === value) { el.textContent = fmt(value); return; }
    el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump');
    const t0 = performance.now(), dur = 600;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && shown[id] === value) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 1600);
  }

  function sheet(title, body, opts = {}) {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet ${opts.cls || ''}">
      <div class="ribbon ${opts.ribbon || ''}"><span class="tx">${title}</span></div>
      ${opts.close ? `<button class="close" id="m-close" aria-label="Close">${icon('close')}</button>` : ''}
      ${body}
    </div>`;
    m.hidden = false;
    const c = $('#m-close');
    if (c) c.onclick = closeModal;
    return m;
  }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

  function slotDef(id) { return SLOTS.find(s => s.id === id); }
  function progress(ch = selectedChapter) { return save.progress[CHAPTERS[ch].id]; }

  function itemIcon(item) { return item.slot === 'rifle' ? item.kind || 'rifle' : item.slot; }

  function tile(item, opts = {}) {
    const rar = RARITIES[item.rarity];
    const eq = save.equipped[item.slot] === item.id;
    const stars = '<span class="tile-stars">' + '★'.repeat(item.rarity + 1) + '</span>';
    return `<button class="tile r-${rar.id} ${opts.cls || ''}" data-item="${item.id}" aria-label="${rar.name} ${itemName(item)}">
      <span class="tile-shine"></span>
      ${icon(itemIcon(item), '#ffffff', 64)}
      ${stars}
      ${(item.lvl || 1) > 1 ? `<span class="tile-lvl tx">Lv${item.lvl}</span>` : ''}
      ${eq && !opts.noTag ? '<span class="tag tx">ON</span>' : ''}
    </button>`;
  }

  function statIcon(stat) { const [n, c] = STAT_ICON[stat]; return icon(n, c, 26); }

  // ---------- Top bar ----------

  function renderTop() {
    countTo('coins', save.coins);
    countTo('gems', save.gems);
    $('#profile-name').textContent = save.name;
    $('#profile-power').textContent = fmt(playerStats().power);
    $('#profile-lvl').textContent = 1 + totalStars();
    const c = $('#avatar-canvas').getContext('2d');
    c.clearRect(0, 0, 96, 96);
    drawSoldierFront(c, 48, 150, 140, 0);
    renderNavDots();
  }

  function renderNavDots() {
    const canSkill = SKILLS.some(s => save.skills[s.id] < SKILL_MAX && save.coins >= skillCost(save.skills[s.id]));
    const canChest = CHESTS.some(c => save[c.currency] >= c.price) || save.freeChestAt <= Date.now();
    const upgrade = SLOTS.some(s => {
      const cur = getItem(save.equipped[s.id]);
      return save.inventory.some(i => i.slot === s.id && (!cur || itemStat(i) > itemStat(cur)));
    });
    const d = dailyState();
    const canClaim = d.picks.some((pk, i) => !d.claimed[i] && (d.prog[CHALLENGE_POOL.find(c => c.id === pk.id).stat] || 0) >= pk.goal);
    const dots = { 0: canChest, 1: upgrade, 2: save.chests.length > 0 && tab !== 2, 3: canSkill, 4: canClaim };
    document.querySelectorAll('.navbar .tab').forEach(b => {
      b.querySelector('.tab-dot')?.remove();
      if (dots[b.dataset.tab]) b.insertAdjacentHTML('beforeend', '<span class="tab-dot"></span>');
    });
  }

  // ---------- Navigation ----------

  function setTab(i) {
    tab = i;
    $('#track').style.transform = `translateX(-${i * 20}%)`;
    document.querySelectorAll('.navbar .tab').forEach((b, j) => b.classList.toggle('active', j === i));
    render(TAB_IDS[i]);
  }

  function render(id) {
    ({ shop: renderShop, gear: renderGear, play: renderPlay, skills: renderSkills, modes: renderModes })[id]();
    renderTop();
    if (tab === 2 && $('#game-view').hidden) startScene(); else stopScene();
  }

  // ---------- Play ----------

  function renderPlay() {
    const pr = progress();
    const ch = CHAPTERS[selectedChapter];
    selectedLevel = Math.min(selectedLevel, pr.unlocked - 1);
    const lvl = ch.levels[selectedLevel];
    const power = playerStats().power;
    const stars = pr.stars.reduce((a, b) => a + b, 0);
    const starRow = n => [0, 1, 2].map(s => icon('star', s < n ? '#ffc933' : '#2a2f6e', 14)).join('');
    const nodes = ch.levels.map((l, i) => {
      const locked = i >= pr.unlocked;
      const state = locked ? 'locked' : pr.stars[i] > 0 ? 'done' : 'open';
      const cls = [state, i === selectedLevel ? 'selected' : '', l.boss.final ? 'boss' : ''].join(' ');
      const face = locked ? icon('lock', '', 26) : l.boss.final ? icon('skull', '#fff', 26) : `<span class="tx">${i + 1}</span>`;
      return `<button class="node ${cls}" data-level="${i}" aria-label="Level ${i + 1}">
        <span class="node-ball">${face}</span>
        <span class="node-stars">${locked ? '' : starRow(pr.stars[i])}</span>
      </button>`;
    }).join('');
    const fill = Math.min(pr.unlocked - 1, 5) / 5 * 80;
    const weak = power < lvl.power;
    const hasPrev = selectedChapter > 0, hasNext = selectedChapter < CHAPTERS.length - 1;
    const nextOpen = hasNext && chapterUnlocked(selectedChapter + 1);
    const queued = save.chests.length;
    const nextChest = queued ? CHESTS.find(c => c.id === save.chests[0]) : null;

    $('#screen-play').innerHTML = `
      <div class="chapter-bar">
        <button class="chapter-arrow left" id="prev-ch" ${hasPrev ? '' : 'disabled'} aria-label="Previous chapter">${icon('arrow', '#ffc933')}</button>
        <div class="chapter-title"><small class="tx">CHAPTER ${selectedChapter + 1}</small><span class="tx">${ch.name}</span></div>
        <button class="chapter-arrow ${nextOpen ? '' : 'locked'}" id="next-ch" ${hasNext ? '' : 'disabled'} aria-label="Next chapter">${nextOpen || !hasNext ? icon('arrow', '#ffc933') : icon('lock')}</button>
      </div>
      <div class="scene">
        <canvas id="scene-canvas"></canvas>
        <div class="scene-badges">
          <span class="badge tx">${icon('bolt', '#ffc933')}${fmt(power)}</span>
          <span class="badge tx">${icon('star', '#ffc933')}${stars}/18</span>
        </div>
        ${queued ? `<button class="chest-btn" id="chest-btn" aria-label="Open saved chest">${icon('chest', nextChest.color)}<span class="chest-count tx">${queued}</span><span class="chest-label tx">OPEN</span></button>` : ''}
      </div>
      <div class="panel"><div class="path"><div class="path-fill" style="width:${fill}%"></div>${nodes}</div></div>
      <div class="panel level-card">
        <div>
          <div class="name tx">Level ${selectedChapter + 1}-${selectedLevel + 1} · ${lvl.name}</div>
          <div class="level-meta">
            <span class="chip tx">${icon('skull', '#ff9aa4')}${lvl.boss.name}</span>
            <span class="chip tx ${weak ? 'warn' : 'ok'}">${icon('bolt', '#ffc933')}Rec. ${fmt(lvl.power)}</span>
            <span class="chip tx">${icon('ranks', '#ffc933')}Best ${fmt(pr.best[selectedLevel])}</span>
          </div>
        </div>
        <canvas class="boss-portrait" id="boss-portrait" width="128" height="128"></canvas>
      </div>
      <button class="btn battle-btn" id="battle-btn"><span class="tx">BATTLE!</span></button>`;

    const bp = $('#boss-portrait').getContext('2d');
    drawBoss(bp, 64, 178, 118, 0, { color: lvl.boss.color, name: lvl.boss.name, final: lvl.boss.final, wide: 0.9 });

    $('#screen-play').querySelectorAll('.node').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.level;
      if (i >= pr.unlocked) { toast('Beat the previous level first'); return; }
      selectedLevel = i;
      render('play');
    }));
    $('#prev-ch').onclick = () => { selectedChapter--; selectedLevel = progress().unlocked - 1; render('play'); };
    $('#next-ch').onclick = () => {
      if (!nextOpen) { toast(`Beat ${ch.name} level 6 to unlock`); return; }
      selectedChapter++; selectedLevel = progress().unlocked - 1; render('play');
    };
    const cb = $('#chest-btn');
    if (cb) cb.onclick = openSavedChest;
    $('#battle-btn').onclick = () => startLevel(selectedChapter, selectedLevel);
  }

  // Earned chests wait in storage until you open them.
  function openSavedChest(after) {
    const id = save.chests.shift();
    const chest = CHESTS.find(c => c.id === id);
    if (!chest) return;
    persist();
    chestOpening(chest, typeof after === 'function' ? after : null);
  }

  // Animated street scene behind the hero on the Play tab.
  function startScene() {
    stopScene();
    const cv = document.getElementById('scene-canvas');
    if (!cv) return;
    const c = cv.getContext('2d');
    const lvl = CHAPTERS[selectedChapter].levels[selectedLevel];
    const theme = CHAPTERS[selectedChapter].theme;
    const colors = ['#8fbf5a', '#b5c95a', '#9ab872', '#6f9a74'];
    const walkers = Array.from({ length: 7 }, (_, i) => ({ x: (i / 6) * 1.6 - 0.8, z: 0.3 + ((i * 37) % 10) / 20, t: i * 1.3, color: colors[i % 4] }));
    const t0 = performance.now();
    const frame = now => {
      const t = (now - t0) / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w && h) {
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawMenuScene(c, w, h, t, lvl, walkers, theme);
      }
      sceneRaf = requestAnimationFrame(frame);
    };
    sceneRaf = requestAnimationFrame(frame);
  }
  function stopScene() { cancelAnimationFrame(sceneRaf); }

  function drawMenuScene(c, w, h, t, lvl, walkers, th) {
    const hz = h * 0.46;
    const sky = c.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.55, th.sky[1]); sky.addColorStop(1, th.sky[2]);
    c.fillStyle = sky; c.fillRect(0, 0, w, hz);
    c.fillStyle = th.sun;
    c.beginPath(); c.arc(w * 0.72, hz * 0.5, h * 0.09, 0, Math.PI * 2); c.fill();
    const bd = th.backdrop || (th.mesas ? 'mesas' : 'city');
    if (bd === 'mesas') {
      const tops = [[0, 0.55], [0.18, 0.7], [0.42, 0.45], [0.62, 0.62], [0.85, 0.5]];
      tops.forEach(([x, hh], i) => {
        c.fillStyle = th.skyline[i % 2];
        const mw = w * 0.26, top = hz - hz * hh * 0.6;
        c.beginPath(); c.moveTo(w * x - mw * 0.1, hz); c.lineTo(w * x + mw * 0.08, top); c.lineTo(w * x + mw * 0.72, top); c.lineTo(w * x + mw * 0.9, hz); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.fillRect(w * x + mw * 0.08, top, mw * 0.64, 4);
      });
    } else if (bd === 'peaks') {
      [[0.05, 0.75], [0.3, 0.95], [0.55, 0.7], [0.8, 0.9], [1.02, 0.65]].forEach(([x, hh], i) => {
        const top = hz - hz * hh * 0.85, bw = w * 0.34;
        c.fillStyle = th.skyline[i % 2];
        c.beginPath(); c.moveTo(w * x - bw / 2, hz); c.lineTo(w * x, top); c.lineTo(w * x + bw / 2, hz); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.moveTo(w * x - bw * 0.14, top + hz * 0.18); c.lineTo(w * x, top); c.lineTo(w * x + bw * 0.14, top + hz * 0.18);
        c.lineTo(w * x + bw * 0.05, top + hz * 0.13); c.lineTo(w * x - bw * 0.04, top + hz * 0.2); c.closePath(); c.fill();
      });
    } else if (bd === 'swamp') {
      c.fillStyle = th.skyline[0];
      c.beginPath(); c.moveTo(0, hz);
      for (let i = 0; i <= 10; i++) c.lineTo(w * i / 10, hz - hz * (0.15 + 0.1 * Math.sin(i * 1.7)));
      c.lineTo(w, hz); c.fill();
      for (let i = 0; i < 6; i++) drawDeadTree(c, w * (0.08 + i * 0.18), hz + 2, hz * (0.5 + (i % 3) * 0.12));
      c.fillStyle = 'rgba(200,255,120,.18)';
      c.fillRect(0, hz - hz * 0.25, w, hz * 0.25);
    } else if (bd === 'volcano') {
      c.fillStyle = th.skyline[0];
      c.beginPath(); c.moveTo(w * 0.1, hz); c.lineTo(w * 0.42, hz * 0.25); c.lineTo(w * 0.58, hz * 0.25); c.lineTo(w * 0.9, hz); c.fill();
      const glow = 0.6 + 0.4 * Math.sin(t * 2);
      c.fillStyle = `rgba(255,${Math.round(90 + 60 * glow)},30,1)`;
      c.beginPath(); c.moveTo(w * 0.44, hz * 0.26); c.lineTo(w * 0.56, hz * 0.26); c.lineTo(w * 0.53, hz * 0.55); c.lineTo(w * 0.49, hz * 0.4); c.lineTo(w * 0.46, hz * 0.6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(80,60,70,.6)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(w * (0.47 + i * 0.03), hz * (0.18 - i * 0.05) - (t * 8 % 10), hz * (0.06 + i * 0.02), 0, Math.PI * 2); c.fill(); }
    } else {
      const bw = w / 9;
      for (let i = 0; i < 10; i++) {
        const bh = hz * (0.35 + ((i * 53) % 7) / 12);
        const x = i * bw - bw * 0.3;
        c.fillStyle = th.skyline[i % 2];
        c.fillRect(x, hz - bh, bw * 0.92, bh);
        c.fillStyle = th.windows;
        for (let wy = hz - bh + 8; wy < hz - 8; wy += 12) {
          for (let wx = x + 6; wx < x + bw * 0.92 - 8; wx += 10) {
            if (((wx * 7 + wy * 3 + i) | 0) % 5 === 0) c.fillRect(wx, wy, 4, 6);
          }
        }
      }
    }
    const g = c.createLinearGradient(0, hz, 0, h);
    g.addColorStop(0, th.menuGround[0]); g.addColorStop(1, th.menuGround[1]);
    c.fillStyle = g; c.fillRect(0, hz, w, h - hz);
    c.fillStyle = th.road;
    c.beginPath(); c.moveTo(w * 0.36, hz); c.lineTo(w * 0.64, hz); c.lineTo(w * 1.05, h); c.lineTo(-w * 0.05, h); c.fill();
    c.fillStyle = th.line;
    for (let i = 0; i < 5; i++) {
      const f0 = (i + (t * 0.6) % 1) / 5, f1 = f0 + 0.08;
      const y0 = hz + (h - hz) * f0 * f0, y1 = hz + (h - hz) * f1 * f1;
      const w0 = 1 + f0 * 5, w1 = 1 + f1 * 5;
      c.beginPath(); c.moveTo(w / 2 - w0, y0); c.lineTo(w / 2 + w0, y0); c.lineTo(w / 2 + w1, y1); c.lineTo(w / 2 - w1, y1); c.fill();
    }
    drawBoss(c, w * 0.8, hz + h * 0.12, h * 0.44, t, { color: lvl.boss.color, name: lvl.boss.name, final: lvl.boss.final });
    const ch2 = selectedChapter > 0;
    walkers.forEach((z, i) => {
      const y = hz + (h - hz) * z.z * 0.55;
      drawZombie(c, w / 2 + z.x * w * 0.45, y, h * 0.16 * (0.6 + z.z), t + z.t, { color: th.skin ? shadeHex(th.skin, (i % 3) * 0.08) : z.color, shirt: ['#5b6cff', '#ff5fb4', '#2fb8e0', '#a55cff'][i % 4], seed: i * 1.37, helmet: ch2 && i % 3 === 0, bomb: ch2 && i % 3 === 1 });
    });
    const bdp = th.backdrop || (th.mesas ? 'mesas' : 'city');
    if (bdp === 'mesas') { drawCactus(c, w * 0.1, h * 0.95, h * 0.26); drawDrum(c, w * 0.9, h * 0.97, h * 0.15); }
    else if (bdp === 'peaks') { drawPine(c, w * 0.1, h * 0.97, h * 0.4); drawSnowman(c, w * 0.9, h * 0.97, h * 0.2); }
    else if (bdp === 'swamp') { drawDeadTree(c, w * 0.08, h * 0.97, h * 0.35); drawToxicBarrel(c, w * 0.9, h * 0.97, h * 0.16, t); }
    else if (bdp === 'volcano') { drawLavaRock(c, w * 0.1, h * 0.97, h * 0.2, t); drawLavaRock(c, w * 0.9, h * 0.97, h * 0.16, t + 1); }
    else if (selectedChapter > 0) { drawNeonLamp(c, w * 0.08, h * 0.97, h * 0.5, t, -1); drawBarrel(c, w * 0.9, h * 0.97, h * 0.12, h * 0.15, ''); }
    else { drawCone(c, w * 0.1, h * 0.93, h * 0.13); drawBarrel(c, w * 0.9, h * 0.97, h * 0.12, h * 0.15, ''); }
    drawSoldierFront(c, w * 0.42, h * 0.97, h * 0.62, t);
  }

  // ---------- Gear ----------

  function renderGear() {
    const st = playerStats();
    const slotHtml = s => {
      const it = getItem(save.equipped[s.id]);
      return `<div class="slot-wrap">${it ? tile(it, { noTag: true }) : `<div class="tile empty">${icon(s.id, '#ffffff', 64)}</div>`}<span class="slot-name tx">${s.name}</span></div>`;
    };
    const inv = save.inventory
      .filter(i => gearFilter === 'all' || i.slot === gearFilter)
      .sort((a, b) => b.rarity - a.rarity || itemStat(b) - itemStat(a));
    const filters = [['all', 'All', ''], ...SLOTS.map(s => [s.id, '', icon(s.id, '#fff', 20)])]
      .map(([id, name, ic]) => `<button class="filter tx ${gearFilter === id ? 'on' : ''}" data-filter="${id}" aria-label="${id}">${ic}${name}</button>`).join('');
    const stat = (k, val) => `<div class="stat">${statIcon(k)}<span class="stat-val tx">${val}</span></div>`;

    $('#screen-gear').innerHTML = `
      <div class="ribbon purple"><span class="tx">Gear</span></div>
      <div class="panel gear-stage">
        <div class="gear-col">${slotHtml(SLOTS[0])}${slotHtml(SLOTS[2])}</div>
        <div class="gear-hero"><canvas id="gear-canvas" width="300" height="345"></canvas></div>
        <div class="gear-col">${slotHtml(SLOTS[1])}${slotHtml(SLOTS[3])}</div>
      </div>
      <div class="stats-row">
        ${stat('hp', fmt(st.hp))}${stat('dmg', fmt(st.dmg))}${stat('rate', st.rate.toFixed(1) + '/s')}${stat('crit', Math.round(st.crit * 100) + '%')}
      </div>
      <div class="sub-head"><h3 class="tx">Backpack · ${save.inventory.length}</h3><div class="filters">${filters}</div></div>
      <div class="inventory" id="inventory">${inv.length ? inv.map(i => tile(i)).join('') : '<div class="empty-note">No gear here yet. Open chests in the Shop to find some.</div>'}</div>
      <div class="gear-actions">
        <button class="btn purple" id="merge-btn">${icon('merge', '#fff', 22)}<span class="tx">Merge</span>${mergeableCount() ? `<span class="merge-dot tx">${mergeableCount()}</span>` : ''}</button>
        <button class="btn green" id="equip-best"><span class="tx">Equip best</span></button>
      </div>`;

    const gc = $('#gear-canvas').getContext('2d');
    drawSoldierFront(gc, 135, 330, 290, 0);
    drawWeaponSide(gc, equippedWeapon(), 205, 250, 150, { rot: -1.05 });
    fitInventory();
    const s = $('#screen-gear');
    s.querySelectorAll('[data-item]').forEach(b => b.addEventListener('click', () => itemDetail(+b.dataset.item)));
    s.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { gearFilter = b.dataset.filter; render('gear'); }));
    $('#equip-best').onclick = () => { equipBest(); Sound.play('equip'); render('gear'); toast('Best gear equipped'); };
    $('#merge-btn').onclick = () => mergeSheet([]);
  }

  // ---------- Merge: 3 of a rarity -> 1 random item of the next rarity ----------

  const canMerge = i => i.rarity < RARITIES.length - 1 && save.equipped[i.slot] !== i.id;
  // How many merges are possible right now (for the badge on the button).
  function mergeableCount() {
    const by = {};
    save.inventory.filter(canMerge).forEach(i => { by[i.rarity] = (by[i.rarity] || 0) + 1; });
    return Object.values(by).reduce((n, c) => n + Math.floor(c / 3), 0);
  }

  function mergeSheet(picked) {
    picked = picked.filter(id => getItem(id));
    const first = picked.length ? getItem(picked[0]) : null;
    const pool = save.inventory.filter(canMerge).sort((a, b) => a.rarity - b.rarity || itemStat(a) - itemStat(b));
    const next = first ? RARITIES[first.rarity + 1] : null;
    const slotBox = i => picked[i] ? tile(getItem(picked[i]), { noTag: true, cls: 'merge-in' }) : `<div class="tile empty merge-empty"><span class="tx">${i + 1}</span></div>`;
    sheet('Merge', `
      <p class="merge-help">Pick <b>3</b> items of the same rarity. You get a random piece of gear <b>one rarity higher</b>. Upgrade coins are refunded.</p>
      <div class="merge-row">
        ${slotBox(0)}<span class="merge-plus tx">+</span>${slotBox(1)}<span class="merge-plus tx">+</span>${slotBox(2)}
        <span class="merge-arrow tx">➜</span>
        <div class="tile merge-out ${next ? 'r-' + next.id : 'empty'}" style="${next ? '--glow:' + next.color : ''}"><span class="tx">?</span>${next ? `<span class="merge-rar tx" style="color:${next.color}">${next.name}</span>` : ''}</div>
      </div>
      <div class="merge-grid">${pool.length ? pool.map(i => {
        const on = picked.includes(i.id), off = !on && ((first && i.rarity !== first.rarity) || picked.length >= 3);
        return `<div class="merge-pick ${on ? 'on' : ''} ${off ? 'off' : ''}">${tile(i, { noTag: true })}${on ? '<span class="merge-check tx">✓</span>' : ''}</div>`;
      }).join('') : '<div class="empty-note">No gear to merge yet. Equipped and Mythic items can\'t be merged.</div>'}</div>
      <div class="actions">
        <button class="btn blue" id="m-auto"><span class="tx">Auto pick</span></button>
        <button class="btn green" id="m-merge" ${picked.length === 3 ? '' : 'disabled'}><span class="tx">Merge</span></button>
      </div>`, { close: true, ribbon: 'purple', cls: 'merge-sheet' });
    document.querySelectorAll('.merge-grid [data-item]').forEach(b => b.addEventListener('click', () => {
      const id = +b.dataset.item, it = getItem(id);
      if (picked.includes(id)) mergeSheet(picked.filter(x => x !== id));
      else if (picked.length < 3 && (!first || it.rarity === first.rarity)) { Sound.play('click'); mergeSheet([...picked, id]); }
      else toast(first && it.rarity !== first.rarity ? 'Pick items of the same rarity' : 'Three items max');
    }));
    document.querySelectorAll('.merge-row [data-item]').forEach(b => b.addEventListener('click', () => mergeSheet(picked.filter(x => x !== +b.dataset.item))));
    $('#m-auto').onclick = () => {
      // Lowest rarity that has three mergeable items, weakest first.
      for (let r = 0; r < RARITIES.length - 1; r++) {
        const c = pool.filter(i => i.rarity === r);
        if (c.length >= 3) { mergeSheet(c.slice(0, 3).map(i => i.id)); return; }
      }
      toast('You need 3 items of the same rarity');
    };
    $('#m-merge').onclick = () => {
      const res = mergeItems(picked);
      if (!res) return;
      const { item, refund } = res;
      const rar = RARITIES[item.rarity];
      sheet('Merge', `
        <div class="merge-anim">${picked.map((_, k) => `<span class="merge-fly f${k}">${icon('chest', '#fff', 40)}</span>`).join('')}<div class="merge-flash"></div></div>
        <p>Merging…</p>`, { ribbon: 'purple' });
      Sound.play('chest');
      setTimeout(() => {
        Sound.play('reveal');
        const cur = getItem(save.equipped[item.slot]);
        const better = !cur || itemStat(item) > itemStat(cur);
        sheet('Merged!', `
          <div class="rays-wrap" style="--glow:${rar.color}"><div class="rays"></div>${tile(item, { noTag: true, cls: 'big reveal' })}</div>
          <div class="rarity tx" style="color:${rar.color}">${rar.name}!</div>
          <div class="item-name tx">${itemName(item)}</div>
          ${statLine(item)}
          ${refund ? `<span class="delta up tx">+${fmt(refund)} coins refunded</span>` : ''}
          <div class="actions">
            <button class="btn grey" id="m-again"><span class="tx">Merge more</span></button>
            ${better ? '<button class="btn green" id="m-equip"><span class="tx">Equip</span></button>' : '<button class="btn green" id="m-ok"><span class="tx">OK</span></button>'}
          </div>`, { ribbon: item.rarity >= 3 ? '' : 'purple' });
        render('gear');
        $('#m-again').onclick = () => mergeSheet([]);
        if (better) $('#m-equip').onclick = () => { equip(item.id); Sound.play('equip'); closeModal(); render('gear'); toast('Equipped'); };
        else $('#m-ok').onclick = () => { closeModal(); render('gear'); };
      }, 1200);
    };
  }

  // Backpack scrolls sideways: use as many rows as fit the leftover height.
  function fitInventory() {
    const inv = $('#inventory');
    if (!inv || tab !== 1) return;
    const size = Math.min(76, Math.max(56, Math.floor(inv.clientHeight / 2) - 12));
    const rows = Math.max(1, Math.floor((inv.clientHeight + 10) / (size + 10)));
    inv.style.setProperty('--tile', size + 'px');
    inv.style.setProperty('--rows', rows);
  }

  function statLine(item) {
    const slot = slotDef(item.slot);
    return `<span class="item-stat tx">${statIcon(slot.stat)}${slot.fmt(itemStat(item))}</span>`;
  }

  function itemDetail(id) {
    const item = getItem(id);
    if (!item) return;
    const rar = RARITIES[item.rarity];
    const slot = slotDef(item.slot);
    const cur = getItem(save.equipped[item.slot]);
    const isEq = cur && cur.id === item.id;
    const lvl = item.lvl || 1;
    const maxed = lvl >= GEAR_MAX_LVL;
    const cost = gearUpgradeCost(item);
    const w = item.slot === 'rifle' ? WEAPONS[item.kind || 'rifle'] : null;
    let delta = '';
    if (!isEq) {
      const d = itemStat(item) - (cur ? itemStat(cur) : 0);
      delta = `<span class="delta tx ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${slot.fmt(Math.abs(d)).replace('+', '')} vs equipped</span>`;
    }
    const next = maxed ? '' : `<span class="next tx">→ ${slot.fmt(itemStat({ ...item, lvl: lvl + 1 }))}</span>`;
    sheet(slot.name, `
      <div class="item-hero" style="--glow:${rar.color}">
        <div class="rays"></div>
        ${w ? `<canvas id="m-weapon" width="440" height="200"></canvas>` : tile(item, { noTag: true, cls: 'big reveal' })}
      </div>
      <div class="rarity-row"><span class="rarity-pill tx" style="background:${rar.color}">${rar.name}</span><span class="lvl-pill tx">Lv ${lvl}/${GEAR_MAX_LVL}</span></div>
      <div class="item-name tx">${itemName(item)}</div>
      ${w ? `<div class="trait">${w.trait}</div>` : ''}
      <div class="item-stat tx">${statIcon(slot.stat)}${slot.fmt(itemStat(item))} ${next}</div>
      ${w ? `<div class="wstats">
        <div><small>Damage</small><div class="meter"><i style="width:${Math.min(100, w.dmg * 28)}%"></i></div></div>
        <div><small>Fire rate</small><div class="meter"><i style="width:${Math.min(100, w.rate * 38)}%"></i></div></div>
      </div>` : ''}
      ${delta}
      <button class="btn blue wide" id="m-upgrade" ${maxed || save.coins < cost ? 'disabled' : ''}>
        ${maxed ? '<span class="tx">MAX LEVEL</span>' : `<span class="tx">Upgrade</span>${icon('coin')}<span class="tx">${fmt(cost)}</span>`}
      </button>
      <div class="actions">
        ${isEq ? '<button class="btn grey" disabled><span class="tx">Equipped</span></button>'
               : `<button class="btn red" id="m-salvage"><span class="tx">Sell</span>${icon('coin')}<span class="tx">${rar.salvage * lvl}</span></button>
                  <button class="btn green" id="m-equip"><span class="tx">Equip</span></button>`}
      </div>`, { close: true, ribbon: 'purple' });
    if (w) drawWeaponSide($('#m-weapon').getContext('2d'), item.kind || 'rifle', 220, 100, 330, { rot: -0.12, accent: rar.color });
    $('#m-upgrade').onclick = () => {
      if (upgradeItem(item.id)) { Sound.play('upgrade'); render('gear'); itemDetail(item.id); toast(`${itemName(item)} Lv ${item.lvl}`); }
    };
    if (!isEq) {
      $('#m-equip').onclick = () => { equip(item.id); Sound.play('equip'); closeModal(); render('gear'); toast('Equipped'); };
      $('#m-salvage').onclick = () => { const v = salvage(item.id); Sound.play('coin'); closeModal(); render('gear'); toast(`Sold for ${v} coins`); };
    }
  }

  // ---------- Skills ----------

  function renderSkills() {
    const bg = { hp: 'linear-gradient(#ff9aa4,#e0243a)', dmg: 'linear-gradient(#ffc27a,#ff7a1a)', rate: 'linear-gradient(#ffe98a,#ffb000)', crit: 'linear-gradient(#8ff5e4,#1fb8a0)' };
    $('#screen-skills').innerHTML = `
      <div class="ribbon green"><span class="tx">Skills</span></div>
      ${SKILLS.map(s => {
        const lvl = save.skills[s.id];
        const max = lvl >= SKILL_MAX;
        const cost = skillCost(lvl);
        return `<div class="panel skill">
          <div class="skill-icon" style="background:${bg[s.id]}">${icon(STAT_ICON[s.id][0], '#fff', 38)}<span class="lv tx">Lv ${lvl}</span></div>
          <div>
            <div class="skill-name tx">${s.name}</div>
            <div class="skill-desc">${s.desc} ${s.fmt(lvl).split(' ')[0]}${max ? '' : ` → <b>${s.fmt(lvl + 1).split(' ')[0]}</b>`}</div>
            <div class="pips">${Array.from({ length: SKILL_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          </div>
          <button class="btn small ${max ? 'grey' : 'green'}" data-skill="${s.id}" ${max || save.coins < cost ? 'disabled' : ''}>
            ${max ? '<span class="tx">MAX</span>' : `<span class="tx">${icon('coin')}${fmt(cost)}</span><small class="tx">UPGRADE</small>`}
          </button>
        </div>`;
      }).join('')}`;
    $('#screen-skills').querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.skill;
      const cost = skillCost(save.skills[id]);
      if (save.coins < cost) return;
      save.coins -= cost;
      save.skills[id]++;
      persist();
      Sound.play('upgrade');
      render('skills');
      toast(`${SKILLS.find(s => s.id === id).name} Lv ${save.skills[id]}`);
    }));
  }

  // ---------- Shop ----------

  function renderShop() {
    const chestStyle = { wood: ['', 'rgba(255,170,80,.7)', ''], silver: ['teal', 'rgba(160,255,240,.7)', ''], gold: ['purple', 'rgba(255,215,90,.85)', 'BEST'] };
    const odds = o => o.map((p, i) => p ? `<span class="tx" style="color:${RARITIES[i].color}">${RARITIES[i].name.slice(0, 4)} ${p}%</span>` : '').join('');
    const tabs = [['chests', 'Chests', 'chest', '#c98b4a'], ['coins', 'Coins', 'coin', ''], ['gems', 'Gems', 'gem', '']]
      .map(([id, label, ic, c]) => `<button class="seg tx ${shopTab === id ? 'on' : ''}" data-shoptab="${id}">${icon(ic, c)}${label}</button>`).join('');
    let cards = '', freeCard = '';
    if (shopTab === 'chests') {
      const wait = save.freeChestAt - Date.now();
      freeCard = `<div class="panel free-card ${wait > 0 ? '' : 'ready'}">
        <div class="free-art">${icon('chest', '#c98b4a', 64)}</div>
        <div class="free-text"><div class="tx">Free Supply Crate</div><small id="free-timer">${wait > 0 ? 'Next in ' + fmtTime(wait) : 'Ready to open!'}</small></div>
        <button class="btn green" id="free-btn" ${wait > 0 ? 'disabled' : ''}><span class="tx">${wait > 0 ? 'WAIT' : 'FREE'}</span></button>
      </div>`;
      cards = CHESTS.map(c => {
        const [cls, glow, flag] = chestStyle[c.id];
        return `<div class="panel offer ${cls}" style="--glow:${glow}">
          ${flag ? `<span class="flag tx">${flag}</span>` : ''}
          <div class="art">${icon('chest', c.color)}</div>
          <div class="title tx">${c.name}</div>
          <div class="odds">${odds(c.odds)}</div>
          <button class="btn ${c.currency === 'gems' ? 'blue' : ''}" data-chest="${c.id}">${icon(c.currency === 'gems' ? 'gem' : 'coin')}<span class="tx">${fmt(c.price)}</span></button>
        </div>`;
      }).join('');
    } else if (shopTab === 'coins') {
      cards = COIN_PACKS.map((p, i) => `<div class="panel offer orange" style="--glow:rgba(255,230,120,.8)">
        ${i === 2 ? '<span class="flag tx">+25%</span>' : ''}
        <div class="art">${icon('coin')}</div>
        <div class="title tx">${fmt(p.coins)} coins</div>
        <button class="btn blue" data-coins="${i}">${icon('gem')}<span class="tx">${p.gems}</span></button>
      </div>`).join('');
    } else {
      cards = GEM_PACKS.map((p, i) => `<div class="panel offer teal" style="--glow:rgba(120,255,200,.8)">
        <span class="flag tx">TEST</span>
        <div class="art">${icon('gem')}</div>
        <div class="title tx">${fmt(p.gems)} gems</div>
        <button class="btn green" data-gems="${i}"><span class="tx">FREE</span></button>
      </div>`).join('');
    }
    const notes = {
      chests: 'Every chest gives one piece of gear. Better chests give higher rarities.',
      coins: 'Trade gems for coins to upgrade your skills faster.',
      gems: 'Test build: gem packs are free so you can try chests. There are no real payments.',
    };
    $('#screen-shop').innerHTML = `
      <div class="ribbon pink"><span class="tx">Shop</span></div>
      <div class="segs">${tabs}</div>
      ${freeCard}
      ${shopTab === 'chests' ? `<div class="crate-head tx">${icon('ad', '', 22)}Gear Crates <small>watch a video · unlimited</small></div>
      <div class="crate-grid">${GEAR_CRATES.map(c => `<button class="panel crate-card" data-crate="${c.id}">
        <span class="crate-art">${icon('chest', c.color, 56)}<span class="crate-slot">${icon(c.slot, SLOT_COLORS[c.slot], 28)}</span></span>
        <span class="crate-name tx">${c.name.replace(' Crate', '')}</span>
        <span class="crate-btn tx">▶ WATCH</span></button>`).join('')}</div>` : ''}
      <div class="shop-grid ${shopTab === 'chests' ? 'compact' : ''}">${cards}</div>
      <p class="note">${notes[shopTab]}</p>`;

    const s = $('#screen-shop');
    const fb = $('#free-btn');
    if (fb) fb.onclick = () => {
      if (save.freeChestAt > Date.now()) return;
      save.freeChestAt = Date.now() + FREE_CHEST_MS;
      persist();
      chestOpening(CHESTS[0]);
    };
    s.querySelectorAll('[data-shoptab]').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.shoptab; render('shop'); }));
    s.querySelectorAll('[data-crate]').forEach(b => b.addEventListener('click', () => {
      const c = GEAR_CRATES.find(x => x.id === b.dataset.crate);
      Ads.showRewarded({ title: c.name, desc: `Watch to open a free ${c.name}.`, claim: 'Open crate!', draw: (ctx, w, h, t) => drawCrateAd(ctx, w, h, c, t) },
        rewarded => { if (rewarded) chestOpening(c); else toast('Watch the full video to open the crate'); });
    }));
    s.querySelectorAll('[data-chest]').forEach(b => b.addEventListener('click', () => {
      const c = CHESTS.find(x => x.id === b.dataset.chest);
      if (save[c.currency] < c.price) { toast(`Not enough ${c.currency}`); return; }
      save[c.currency] -= c.price;
      persist();
      renderTop();
      chestOpening(c);
    }));
    s.querySelectorAll('[data-coins]').forEach(b => b.addEventListener('click', () => {
      const p = COIN_PACKS[+b.dataset.coins];
      if (save.gems < p.gems) { toast('Not enough gems'); return; }
      save.gems -= p.gems; save.coins += p.coins; persist(); Sound.play('coin'); render('shop'); toast(`+${fmt(p.coins)} coins`);
    }));
    s.querySelectorAll('[data-gems]').forEach(b => b.addEventListener('click', () => {
      const p = GEM_PACKS[+b.dataset.gems];
      save.gems += p.gems; persist(); Sound.play('coin'); render('shop'); toast(`+${fmt(p.gems)} gems`);
    }));
  }

  const SLOT_COLORS = { helmet: '#5d8f46', rifle: '#8a93a6', gloves: '#c98b4a', scope: '#3a4a5a' };

  // Demo video for gear crates: the crate bounces under light rays with its gear piece floating above.
  const crateImgs = {};
  function svgImg(markup) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    return img;
  }
  function drawCrateAd(c, w, h, crate, t) {
    const imgs = crateImgs[crate.id] || (crateImgs[crate.id] = { chest: svgImg(icon('chest', crate.color, 200)), gear: svgImg(icon(crate.slot, SLOT_COLORS[crate.slot], 120)) });
    const bg = c.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.7);
    bg.addColorStop(0, '#5a6cff'); bg.addColorStop(1, '#1b1f5a');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h * 0.55); c.rotate(t * 0.4);
    c.fillStyle = 'rgba(255,255,255,.08)';
    for (let k = 0; k < 12; k++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(w, -60); c.lineTo(w, 60); c.fill(); }
    c.restore();
    const hop = Math.abs(Math.sin(t * 3)) * 22;
    if (imgs.chest.complete) c.drawImage(imgs.chest, w / 2 - 100, h * 0.5 - 60 - hop, 200, 200);
    if (imgs.gear.complete) c.drawImage(imgs.gear, w / 2 - 60, h * 0.12 + Math.sin(t * 2) * 10, 120, 120);
    for (let k = 0; k < 8; k++) {
      const a = t * 1.5 + k * 0.8, rr = 150 + Math.sin(t * 3 + k) * 20;
      c.fillStyle = RARITIES[k % 5].color;
      c.beginPath(); c.arc(w / 2 + Math.cos(a) * rr, h * 0.55 + Math.sin(a) * rr * 0.6, 6, 0, Math.PI * 2); c.fill();
    }
  }

  function chestOpening(chest, after) {
    const item = openChest(chest);
    const rar = RARITIES[item.rarity];
    sheet(chest.name, `
      <div class="rays-wrap" style="--glow:${chest.color}"><div class="rays"></div><div class="shake">${icon('chest', chest.color, 120)}</div></div>
      <p>Opening…</p>`);
    Sound.play('chest');
    setTimeout(() => {
      Sound.play('reveal');
      const cur = getItem(save.equipped[item.slot]);
      const better = !cur || itemStat(item) > itemStat(cur);
      sheet(chest.name, `
        <div class="rays-wrap" style="--glow:${rar.color}"><div class="rays"></div>${tile(item, { noTag: true, cls: 'big reveal' })}</div>
        <div class="rarity tx" style="color:${rar.color}">${rar.name}!</div>
        <div class="item-name tx">${itemName(item)}</div>
        ${statLine(item)}
        ${better ? '<span class="delta up tx">▲ Better than what you have on</span>' : ''}
        <div class="actions">
          <button class="btn ${better ? 'grey' : ''}" id="m-ok"><span class="tx">OK</span></button>
          ${better ? '<button class="btn green" id="m-equip"><span class="tx">Equip</span></button>' : ''}
        </div>`, { ribbon: item.rarity >= 3 ? '' : item.rarity === 2 ? 'purple' : 'blue' });
      const done = () => { closeModal(); render(TAB_IDS[tab]); after && after(); };
      $('#m-ok').onclick = done;
      if (better) $('#m-equip').onclick = () => { equip(item.id); Sound.play('equip'); toast('Equipped'); done(); };
    }, 1100);
  }


  // ---------- Modes + daily challenges ----------

  const MODES = [
    { id: 'touchline', name: 'Touchline', color: '#ff4d5e', ribbon: 'red', desc: 'Not one zombie gets past you. 3 breaches and the line falls.', best: v => v ? `Best: wave ${v}` : 'No record yet' },
    { id: 'survival', name: 'Survival', color: '#a55cff', ribbon: 'purple', desc: 'Endless waves with elites and bosses. Last as long as you can.', best: v => v ? `Best: wave ${v}` : 'No record yet' },
    { id: 'extraction', name: 'Extraction', color: '#2fb8e0', ribbon: 'blue', desc: 'Free-roam map. Grab supplies, reach the chopper. Stay longer, earn more.', best: v => v ? `Best haul: ${fmt(v)}` : 'No record yet' },
    { id: 'ammo', name: 'Ammo Crisis', color: '#ffb000', ribbon: '', desc: 'Barely any bullets. Aim, blow up barrels, scavenge ammo.', best: v => v ? `Best: ${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : 'No record yet' },
  ];

  function renderModes() {
    const d = dailyState();
    const claimable = d.picks.some((pk, i) => !d.claimed[i] && (d.prog[challengeDef(pk).stat] || 0) >= pk.goal);
    const tabs = `<div class="segs two">
      <button class="seg tx ${modesTab === 'modes' ? 'on' : ''}" data-mtab="modes">${icon('modes', '#ff8a1f')}Modes</button>
      <button class="seg tx ${modesTab === 'daily' ? 'on' : ''}" data-mtab="daily">${icon('calendar', '#ff4d5e')}Daily${claimable ? '<span class="seg-dot"></span>' : ''}</button>
    </div>`;
    let body;
    if (modesTab === 'modes') {
      body = `<div class="mode-grid">${MODES.map(m => `<button class="mode-card" data-mode="${m.id}" style="--c:${m.color}">
        <canvas class="mode-art" data-art="${m.id}" width="320" height="180"></canvas>
        <span class="mode-name tx">${m.name}</span>
        <span class="mode-desc">${m.desc}</span>
        <span class="mode-best tx">${m.best(save.modes[m.id] || 0)}</span>
        <span class="mode-play tx">PLAY</span>
      </button>`).join('')}</div>`;
    } else {
      const reset = new Date(); reset.setHours(24, 0, 0, 0);
      const allClaimed = d.claimed.every(Boolean);
      body = `<div class="daily-head tx">${icon('calendar', '#ff4d5e', 22)}Daily Challenges <small>New in ${fmtTime(reset - Date.now())}</small></div>
        <div class="daily-list">${d.picks.map((pk, i) => {
          const c = challengeDef(pk), cur = Math.min(pk.goal, d.prog[c.stat] || 0), done = cur >= pk.goal, rw = challengeReward(pk);
          return `<div class="panel daily-row ${d.claimed[i] ? 'claimed' : done ? 'done' : ''}">
            <span class="daily-ic">${icon(c.icon, '#ffc933', 34)}</span>
            <div class="daily-mid"><div class="daily-text tx">${c.text(pk.goal)}</div>
              <div class="daily-bar"><i style="width:${cur / pk.goal * 100}%"></i><span class="tx">${cur}/${pk.goal}</span></div></div>
            ${d.claimed[i] ? '<span class="daily-ok tx">✓</span>'
              : `<button class="btn ${done ? 'green' : 'grey'} daily-claim" data-claim="${i}" ${done ? '' : 'disabled'}>
                  <span class="daily-rw tx">${icon('coin', '', 16)}${rw.coins}</span><span class="daily-rw tx">${icon('gem', '', 16)}${rw.gems}</span></button>`}
          </div>`;
        }).join('')}</div>
        <div class="panel daily-bonus ${allClaimed && !d.bonus ? 'ready' : ''}">
          <span class="daily-ic">${icon('chest', CHESTS[1].color, 44)}</span>
          <div class="daily-mid"><div class="daily-text tx">Complete all 3</div><small>Bonus: ${CHESTS[1].name}</small></div>
          ${d.bonus ? '<span class="daily-ok tx">✓</span>' : `<button class="btn ${allClaimed ? 'purple' : 'grey'}" id="daily-bonus" ${allClaimed ? '' : 'disabled'}><span class="tx">OPEN</span></button>`}
        </div>`;
    }
    $('#screen-modes').innerHTML = `<div class="ribbon orange"><span class="tx">${modesTab === 'modes' ? 'Game Modes' : 'Challenges'}</span></div>${tabs}${body}`;
    const scr = $('#screen-modes');
    scr.querySelectorAll('[data-mtab]').forEach(b => b.addEventListener('click', () => { modesTab = b.dataset.mtab; render('modes'); }));
    scr.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => startMode(b.dataset.mode)));
    scr.querySelectorAll('[data-art]').forEach(cv => drawModeArt(cv.getContext('2d'), cv.dataset.art));
    scr.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.claim, pk = d.picks[i], rw = challengeReward(pk);
      if (d.claimed[i] || (d.prog[challengeDef(pk).stat] || 0) < pk.goal) return;
      d.claimed[i] = true; save.coins += rw.coins; save.gems += rw.gems; persist();
      Sound.play('coin'); toast(`+${rw.coins} coins · +${rw.gems} gems`); render('modes');
    }));
    const bonus = $('#daily-bonus');
    if (bonus) bonus.onclick = () => { if (!d.claimed.every(Boolean) || d.bonus) return; d.bonus = true; persist(); chestOpening(CHESTS[1], () => render('modes')); };
  }

  function challengeDef(pk) { return CHALLENGE_POOL.find(c => c.id === pk.id); }

  // Small illustration for each mode card.
  function drawModeArt(c, id) {
    const w = 320, h = 180;
    const sky = c.createLinearGradient(0, 0, 0, h);
    const cols = { touchline: ['#ff8a7a', '#ffd2b0'], survival: ['#5b3a9a', '#b98ae8'], extraction: ['#3aa0d8', '#bfeaff'], ammo: ['#d88a1a', '#ffe0a0'] }[id];
    sky.addColorStop(0, cols[0]); sky.addColorStop(1, cols[1]);
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, h * 0.62, w, h);
    if (id === 'touchline') {
      c.fillStyle = '#8a8f9c'; c.beginPath(); c.moveTo(w * 0.35, h * 0.3); c.lineTo(w * 0.65, h * 0.3); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 7; c.setLineDash([16, 10]); c.beginPath(); c.moveTo(0, h * 0.86); c.lineTo(w, h * 0.86); c.stroke();
      c.strokeStyle = '#ff3b3b'; c.lineDashOffset = 13; c.beginPath(); c.moveTo(0, h * 0.86); c.lineTo(w, h * 0.86); c.stroke(); c.setLineDash([]);
      [[0.33, 0.62, 58], [0.55, 0.52, 44], [0.72, 0.66, 62], [0.45, 0.45, 34]].forEach(([x, y, s2], i) => drawZombie(c, w * x, h * y, s2 * 1.25, i, { seed: i * 0.2 }));
      drawSoldierBack(c, w * 0.5, h * 0.99, 70, 0, 0, 'rifle');
    } else if (id === 'survival') {
      for (let i = 0; i < 9; i++) drawZombie(c, w * (0.1 + (i % 5) * 0.2 + (i > 4 ? 0.1 : 0)), h * (i > 4 ? 0.98 : 0.72), i > 4 ? 90 : 62, i * 0.7, { seed: i * 0.13, color: i === 2 ? '#e0763a' : undefined, spit: i === 2 });
      drawBoss(c, w * 0.5, h * 0.62, 120, 0.3, { color: '#7aa84a', name: 'Sewer Hulk' });
    } else if (id === 'extraction') {
      c.fillStyle = 'rgba(40,45,60,.5)'; c.beginPath(); c.ellipse(w * 0.62, h * 0.85, 90, 26, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd23a'; c.lineWidth = 4; c.setLineDash([10, 6]); c.stroke(); c.setLineDash([]);
      drawHeli(c, w * 0.62, h * 0.38, 120, 0.4, false);
      drawZombie(c, w * 0.15, h * 0.95, 80, 0.2, { seed: 0.1 }); drawZombie(c, w * 0.9, h * 0.98, 84, 1.2, { seed: 0.3 });
      drawSoldierFront(c, w * 0.36, h * 0.98, 84, 0);
    } else {
      [[0.2, 0.7], [0.82, 0.74]].forEach(([x, y]) => {
        const bw = 34, bh = 46, X = w * x, Y = h * y;
        c.fillStyle = '#e0303a'; c.strokeStyle = '#14132b'; c.lineWidth = 3; c.fillRect(X - bw / 2, Y - bh, bw, bh); c.strokeRect(X - bw / 2, Y - bh, bw, bh);
        c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(X, Y - bh * 0.7); c.lineTo(X + 9, Y - bh * 0.35); c.lineTo(X - 9, Y - bh * 0.35); c.closePath(); c.fill(); c.stroke();
      });
      drawZombie(c, w * 0.52, h * 0.78, 86, 0.4, { seed: 0.2 });
      for (let i = 0; i < 3; i++) { c.save(); c.translate(w * (0.35 + i * 0.08), h * 0.22); c.rotate(0.3); c.fillStyle = '#ffd23a'; c.strokeStyle = '#14132b'; c.lineWidth = 3; c.beginPath(); c.roundRect ? c.roundRect(-7, -22, 14, 36, 7) : c.rect(-7, -22, 14, 36); c.fill(); c.stroke(); c.fillStyle = '#c98a2a'; c.fillRect(-7, 6, 14, 8); c.restore(); }
      c.font = '900 30px "Lilita One", system-ui'; c.fillStyle = '#fff'; c.strokeStyle = '#14132b'; c.lineWidth = 6; c.strokeText('3', w * 0.72, h * 0.3); c.fillText('3', w * 0.72, h * 0.3);
    }
  }

  function startMode(id) {
    stopScene();
    paused = false;
    closeModal();
    currentMode = id;
    if (id === 'touchline' || id === 'survival') {
      $('#game-view').hidden = false;
      const hint = $('#hud-hint');
      hint.style.animation = 'none'; void hint.offsetWidth; hint.style.animation = '';
      Game.start(0, 0, onModeEnd, id);
    } else {
      $('#arena-view').hidden = false;
      Arena.start(id, onModeEnd);
    }
  }

  function onModeEnd(res) {
    const m = MODES.find(x => x.id === res.mode);
    const score = res.mode === 'extraction' ? (res.win ? res.coins : 0) : res.mode === 'ammo' ? res.time : res.waves;
    const newBest = score > (save.modes[res.mode] || 0);
    if (newBest) save.modes[res.mode] = score;
    save.coins += res.coins; save.gems += res.gems;
    if (res.chest) save.chests.push(res.chest);
    persist();
    const time = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const good = res.mode === 'extraction' ? res.win : score > 0;
    const title = res.mode === 'extraction' ? (res.win ? 'Extracted!' : 'Mission Failed')
      : res.mode === 'ammo' ? `Lasted ${time(res.time)}` : `Wave ${res.waves}`;
    const lines = res.mode === 'extraction'
      ? [['Time', time(res.time)], ['Supplies', res.found], ['Kills', res.kills]]
      : res.mode === 'ammo' ? [['Time', time(res.time)], ['Kills', res.kills]]
      : [['Waves cleared', res.waves], ['Kills', res.kills]].concat(res.mode === 'touchline' ? [['Breaches', `${res.breaches}/3`]] : []);
    sheet(title, `
      ${newBest && score ? '<div class="new-best tx">NEW BEST!</div>' : ''}
      <div class="mode-result">${lines.map(([k, v]) => `<div><small>${k}</small><b class="tx">${v}</b></div>`).join('')}</div>
      <div class="rewards">
        <span class="reward tx">${icon('coin')}+${fmt(res.coins)}</span>
        ${res.gems ? `<span class="reward tx">${icon('gem')}+${res.gems}</span>` : ''}
        ${res.chest ? `<span class="reward tx">${icon('chest', CHESTS[1].color)}Silver Chest</span>` : ''}
      </div>
      ${res.mode === 'extraction' && !res.win ? '<p class="note">You only keep 25% of the loot if you don\'t make it out.</p>' : ''}
      <div class="actions">
        <button class="btn blue" id="m-modes"><span class="tx">Modes</span></button>
        <button class="btn green" id="m-retry"><span class="tx">Play again</span></button>
      </div>`, { ribbon: good ? m.ribbon : 'blue', cls: good ? '' : 'defeat' });
    Sound.play('coin');
    $('#m-modes').onclick = () => leaveGame(4);
    $('#m-retry').onclick = () => startMode(res.mode);
  }

  function settings() {
    const st = save.settings;
    sheet('Settings', `
      <div class="profile-card">
        <span class="avatar big"><canvas id="m-avatar" width="120" height="120"></canvas></span>
        <div>
          <div class="item-name tx">${save.name}</div>
          <div class="profile-power tx">${icon('bolt', '#ffc933')}${fmt(playerStats().power)} · ${icon('star', '#ffc933')}${totalStars()}/${CHAPTERS.length * 18}</div>
        </div>
      </div>
      <label class="set-row" for="set-music">${icon('music', '#ff5fb4')}<span class="tx">Music</span>
        <input type="range" id="set-music" min="0" max="100" value="${Math.round(st.music * 100)}"><b class="tx" id="set-music-v">${Math.round(st.music * 100)}</b></label>
      <label class="set-row" for="set-sfx">${icon('sound', '#29a8ff')}<span class="tx">Sound FX</span>
        <input type="range" id="set-sfx" min="0" max="100" value="${Math.round(st.sfx * 100)}"><b class="tx" id="set-sfx-v">${Math.round(st.sfx * 100)}</b></label>
      <div class="set-grid">
        <button class="btn small blue" id="m-rename"><span class="tx">Change name</span></button>
        <button class="btn small purple" id="m-credits"><span class="tx">Credits</span></button>
        <button class="btn small" id="m-privacy"><span class="tx">Privacy</span></button>
        <button class="btn small red" id="m-reset"><span class="tx">Reset progress</span></button>
      </div>
      <p class="version">Zombie Rush · test build</p>`, { close: true, ribbon: 'blue' });
    drawSoldierFront($('#m-avatar').getContext('2d'), 60, 190, 180, 0);
    const bind = key => {
      const input = $(`#set-${key}`);
      input.style.setProperty('--fill', input.value + '%');
      input.addEventListener('input', () => {
        input.style.setProperty('--fill', input.value + '%');
        save.settings[key] = input.value / 100;
        save.settings.muted = false;
        $(`#set-${key}-v`).textContent = input.value;
        applySettings();
      });
      input.addEventListener('change', () => { persist(); if (key === 'sfx') Sound.play('coin'); });
    };
    bind('music'); bind('sfx');
    $('#m-rename').onclick = rename;
    $('#m-credits').onclick = credits;
    $('#m-privacy').onclick = privacy;
    $('#m-reset').onclick = confirmReset;
  }

  function applySettings() {
    const st = save.settings;
    Sound.setVolumes(st.muted ? 0 : st.music, st.muted ? 0 : st.sfx);
    const m = document.getElementById('hud-mute');
    if (m) m.innerHTML = icon(st.muted ? 'mute' : 'sound', '#fff');
  }

  function subPage(title, body, ribbon) {
    sheet(title, `<div class="doc">${body}</div>
      <div class="actions"><button class="btn grey" id="m-back"><span class="tx">Back</span></button></div>`, { close: true, ribbon });
    $('#m-back').onclick = settings;
  }

  function credits() {
    subPage('Credits', `
      <dl>
        <dt class="tx">Game</dt><dd>Zombie Rush</dd>
        <dt class="tx">Design &amp; code</dt><dd>Made with Claude Code</dd>
        <dt class="tx">Art</dt><dd>Hand-drawn in code: every soldier, zombie and prop is drawn live on a canvas</dd>
        <dt class="tx">Music &amp; sound</dt><dd>Synthesized live in your browser with the Web Audio API</dd>
        <dt class="tx">Font</dt><dd>Lilita One by Juan Montoreano (SIL Open Font License)</dd>
      </dl>
      <p>Thanks for playing!</p>`, 'purple');
  }

  function privacy() {
    subPage('Privacy', `
      <p>Your progress (coins, gems, gear, skills, level stars, name and sound settings) is saved only on this device, in your browser's local storage.</p>
      <p>Nothing is sent to a server. There are no accounts, ads, analytics or tracking.</p>
      <p>The other leaderboard players are local bots. Clearing your browser data or using Reset progress deletes your save.</p>`, '');
  }

  function confirmReset() {
    sheet('Reset?', `<p>This deletes all coins, gear and level progress on this device.</p>
      <div class="actions"><button class="btn grey" id="m-no"><span class="tx">Cancel</span></button><button class="btn red" id="m-yes"><span class="tx">Reset</span></button></div>`, { ribbon: 'red' });
    $('#m-no').onclick = settings;
    $('#m-yes').onclick = () => { resetSave(); applySettings(); selectedLevel = 0; closeModal(); setTab(2); toast('Progress reset'); };
  }

  function rename() {
    sheet('Your name', `<input class="name-input" id="m-name" maxlength="14" aria-label="Your name">
      <div class="actions"><button class="btn grey" id="m-no"><span class="tx">Cancel</span></button><button class="btn green" id="m-yes"><span class="tx">Save</span></button></div>`, { ribbon: 'blue' });
    const input = $('#m-name');
    input.value = save.name;
    input.focus(); input.select();
    $('#m-no').onclick = settings;
    $('#m-yes').onclick = () => {
      const v = input.value.replace(/[<>&"]/g, '').trim().slice(0, 14);
      if (v) { save.name = v; persist(); }
      render(TAB_IDS[tab]);
      settings();
    };
  }

  // ---------- Level flow ----------

  function startLevel(ch, i) {
    currentMode = null;
    stopScene();
    paused = false;
    closeModal();
    selectedChapter = ch;
    selectedLevel = i;
    $('#game-view').hidden = false;
    const hint = $('#hud-hint');
    hint.style.animation = 'none'; void hint.offsetWidth; hint.style.animation = '';
    Game.start(ch, i, onLevelEnd);
  }

  function leaveGame(toTab = 2) {
    Game.quit();
    Arena.quit();
    closeModal();
    $('#game-view').hidden = true;
    $('#arena-view').hidden = true;
    currentMode = null;
    setTab(toTab);
  }

  const engine = () => $('#arena-view').hidden ? Game : Arena;

  // ---------- Support calls, unlocked by a rewarded ad ----------

  let adOpen = false;

  // Button art is rendered once from the same drawings used in the level.
  function abilityArt(id) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    if (id === 'air') { g.translate(80, 84); g.rotate(-0.55); drawJet(g, 0, 0, 132, 0.3); }
    else if (id === 'tank') drawTank(g, 80, 132, 128, 0.2, 0);
    else if (id === 'heli') {
      // Side-view gunship
      g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#14132b'; g.lineWidth = 6;
      g.fillStyle = '#3d5a80';
      g.beginPath(); g.moveTo(92, 70); g.lineTo(150, 62); g.lineTo(150, 76); g.lineTo(96, 92); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#4f76a8'; g.beginPath(); g.ellipse(143, 56, 7, 16, 0.3, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#4f76a8';
      g.beginPath(); g.moveTo(22, 88); g.bezierCurveTo(20, 56, 52, 46, 82, 50); g.bezierCurveTo(108, 52, 114, 74, 108, 96); g.bezierCurveTo(90, 112, 40, 112, 22, 88); g.fill(); g.stroke();
      g.fillStyle = '#8fd2ff'; g.beginPath(); g.moveTo(28, 82); g.bezierCurveTo(28, 64, 44, 58, 58, 58); g.lineTo(58, 84); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#2a2f3a'; g.fillRect(34, 98, 30, 10); g.strokeRect(34, 98, 30, 10);
      g.beginPath(); g.moveTo(40, 108); g.lineTo(36, 124); g.moveTo(92, 104); g.lineTo(96, 124); g.moveTo(22, 124); g.lineTo(112, 124); g.stroke();
      g.fillStyle = '#2a2f3a'; g.fillRect(60, 36, 16, 14); g.strokeRect(60, 36, 16, 14);
      g.lineWidth = 12; g.beginPath(); g.moveTo(6, 34); g.lineTo(130, 34); g.stroke();
      g.strokeStyle = '#8a93a6'; g.lineWidth = 5; g.beginPath(); g.moveTo(9, 34); g.lineTo(127, 34); g.stroke();
    }
    else {
      // Ice crystal
      g.translate(80, 80);
      g.lineCap = 'round';
      for (const [w, col] of [[20, '#14132b'], [11, '#bff0ff'], [4, '#ffffff']]) {
        g.strokeStyle = col; g.lineWidth = w;
        for (let k = 0; k < 6; k++) {
          g.save(); g.rotate(k * Math.PI / 3);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -62);
          g.moveTo(0, -30); g.lineTo(-16, -44); g.moveTo(0, -30); g.lineTo(16, -44);
          g.moveTo(0, -48); g.lineTo(-10, -58); g.moveTo(0, -48); g.lineTo(10, -58);
          g.stroke(); g.restore();
        }
      }
      g.fillStyle = '#fff'; g.strokeStyle = '#14132b'; g.lineWidth = 5;
      g.beginPath();
      for (let k = 0; k < 6; k++) g.lineTo(Math.cos(k * Math.PI / 3) * 15, Math.sin(k * Math.PI / 3) * 15);
      g.closePath(); g.fill(); g.stroke();
    }
    return c.toDataURL();
  }

  function buildAbilities() {
    const btn = a => `<button class="ab-btn" data-ab="${a.id}" style="--c:${a.color};--c-hi:${shadeHex(a.color, 0.45)};--c-lo:${shadeHex(a.color, -0.45)}" aria-label="${a.name}, watch an ad to use">
      <span class="ab-tile"><img class="ab-art" src="${abilityArt(a.id)}" alt=""><span class="ab-sheen"></span><span class="ab-dur"><i></i></span></span>
      <span class="ab-ad">${icon('ad', '', 18)}</span>
      <span class="ab-foot tx"><span class="off">${a.short || a.name}</span><span class="on">▶ ${a.short || a.name}</span></span></button>`;
    $('#ab-left').innerHTML = ABILITIES.slice(0, 2).map(btn).join('');
    $('#ab-right').innerHTML = ABILITIES.slice(2).map(btn).join('');
    document.querySelectorAll('.ab-btn').forEach(b => b.addEventListener('click', () => requestAbility(b.dataset.ab)));
  }

  function requestAbility(id) {
    if (adOpen || paused || $('#game-view').hidden) return;
    const a = ABILITIES.find(x => x.id === id);
    if (!a) return;
    if (!Game.abilityReady(id)) {
      const el = document.querySelector(`.ab-btn[data-ab="${id}"]`);
      if (el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
      Sound.play('block');
      return;
    }
    Sound.play('click');
    Game.pause();
    adOpen = true;
    Ads.showRewarded({ title: a.name, desc: a.desc, claim: `Call ${a.name}!`, draw: (c, w, h, t) => drawAdScene(c, w, h, a.id, t) }, rewarded => {
      adOpen = false;
      Game.resume();
      if (rewarded) Game.useAbility(id);
      else toast('Watch the full ad to call in support');
    });
  }

  // Rewarded ad. This is a built-in demo ad; a real ad network (e.g. AdMob in the Android app)
  // plugs in here: show its rewarded ad and call done(true) only when it reports the reward was earned.
  const AD_SECONDS = 5;
  const Ads = {
    // opts: { title, desc, claim, draw(ctx, w, h, t) }; done(rewarded) runs when the ad closes.
    showRewarded(opts, done) {
      const view = $('#ad-view'), claim = $('#ad-claim'), claimText = $('#ad-claim-text'), timer = $('#ad-timer'), fill = $('#ad-bar-fill');
      $('#ad-body').innerHTML = `<canvas class="ad-canvas" id="ad-canvas" width="600" height="420"></canvas>
        <div class="ad-title tx">${opts.title.toUpperCase()}</div><div class="ad-desc">${opts.desc}</div>
        <div class="ad-note">Demo ad. Real video ads show here once an ad network is connected.</div>`;
      view.hidden = false;
      claim.disabled = true;
      const cv = $('#ad-canvas'), c = cv.getContext('2d');
      const t0 = performance.now();
      let raf = 0, earned = false;
      const frame = now => {
        const t = (now - t0) / 1000, left = Math.max(0, AD_SECONDS - t);
        fill.style.width = `${Math.min(1, t / AD_SECONDS) * 100}%`;
        timer.textContent = left > 0 ? `Reward in ${Math.ceil(left)}s` : 'Reward earned!';
        if (left <= 0 && !earned) {
          earned = true;
          claim.disabled = false;
          claim.classList.add('pulse');
          Sound.play('coin');
        }
        claimText.textContent = earned ? opts.claim : `Wait ${Math.ceil(left)}…`;
        opts.draw(c, cv.width, cv.height, t);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      const close = rewarded => {
        cancelAnimationFrame(raf);
        view.hidden = true;
        claim.classList.remove('pulse');
        claim.onclick = null; $('#ad-close').onclick = null;
        done(rewarded);
      };
      claim.onclick = () => { if (earned) close(true); };
      $('#ad-close').onclick = () => close(earned);
    },
  };

  // Little animated showcase of the support call, used as the demo ad's video.
  function drawAdScene(c, w, h, id, t) {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, id === 'freeze' ? '#9fdcff' : '#5ec8ff');
    sky.addColorStop(1, id === 'freeze' ? '#e8f7ff' : '#bfeaff');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    // Road in perspective
    c.fillStyle = '#6a6f7c';
    c.beginPath(); c.moveTo(w * 0.42, h * 0.35); c.lineTo(w * 0.58, h * 0.35); c.lineTo(w * 0.95, h); c.lineTo(w * 0.05, h); c.fill();
    c.fillStyle = id === 'freeze' ? '#f4fbff' : '#5aa845';
    c.fillRect(0, h * 0.33, w, h * 0.04);
    c.strokeStyle = '#fff'; c.lineWidth = 6; c.setLineDash([30, 30]); c.lineDashOffset = -t * 120;
    c.beginPath(); c.moveTo(w / 2, h * 0.37); c.lineTo(w / 2, h); c.stroke(); c.setLineDash([]);
    const zx = [0.4, 0.5, 0.6];
    const zColor = id === 'freeze' ? '#bfe8ff' : '#7cc24a';
    zx.forEach((x, i) => {
      const k = id === 'freeze' ? 0.55 : ((t * 0.25 + i * 0.33) % 1);
      const s = 0.3 + k * 0.7;
      drawZombie(c, w * (0.5 + (x - 0.5) * (0.6 + k * 1.4)), h * (0.4 + k * 0.45), 110 * s, id === 'freeze' ? 0 : t + i, { color: zColor, seed: i + 1 });
    });
    if (id === 'air') {
      const k = (t * 0.45) % 1;
      drawJet(c, w * (0.9 - k * 0.8), h * (1.1 - k * 1.3), 150, t);
      if (Math.sin(t * 5) > 0.6) { c.fillStyle = 'rgba(255,176,46,.8)'; c.beginPath(); c.arc(w * 0.5, h * 0.62, 70, 0, Math.PI * 2); c.fill(); }
    } else if (id === 'tank') {
      drawTank(c, w * (0.5 + Math.sin(t) * 0.12), h * 0.98, 230, t, Math.sin(t * 4) > 0.8 ? 1 : 0);
    } else if (id === 'heli') {
      drawHeli(c, w * (0.5 + Math.sin(t * 1.2) * 0.2), h * 0.3 + Math.sin(t * 3) * 8, 170, t, true);
    } else {
      c.save(); c.translate(w * 0.5, h * 0.25); c.rotate(t * 0.8);
      c.globalAlpha = 0.9;
      const img = icon('freeze', '#8fe0ff', 160);
      if (!drawAdScene.snow) { drawAdScene.snow = new Image(); drawAdScene.snow.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(img.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); }
      if (drawAdScene.snow.complete) c.drawImage(drawAdScene.snow, -80, -80, 160, 160);
      c.restore();
    }
  }

  function togglePause(forceOn) {
    if (adOpen) return;
    if (paused && !forceOn) {
      paused = false;
      closeModal();
      engine().resume();
      return;
    }
    if (paused) return;
    if (!engine().debug()) return;
    paused = true;
    engine().pause();
    sheet('Paused', `<p>Take a breather. The horde will wait.</p>
      <div class="actions"><button class="btn red" id="m-quit"><span class="tx">Quit</span></button><button class="btn green" id="m-resume"><span class="tx">Resume</span></button></div>`, { ribbon: 'blue' });
    $('#m-resume').onclick = () => togglePause();
    $('#m-quit').onclick = () => leaveGame(currentMode ? 4 : 2);
  }

  function onLevelEnd(res) {
    const pr = progress(res.chIdx);
    const chapter = CHAPTERS[res.chIdx];
    const firstClear = res.win && pr.stars[res.lvlIdx] === 0;
    const final = res.win && chapter.levels[res.lvlIdx].boss.final;
    const hasNextChapter = final && res.chIdx < CHAPTERS.length - 1;
    let gems = 0, chest = null;
    if (res.win) {
      pr.stars[res.lvlIdx] = Math.max(pr.stars[res.lvlIdx], res.stars);
      pr.unlocked = Math.max(pr.unlocked, Math.min(res.lvlIdx + 2, 6));
      if (firstClear) {
        gems = 30 + (res.chIdx * 6 + res.lvlIdx) * 10;
        chest = final ? CHESTS[2] : res.chIdx > 0 ? CHESTS[1] : CHESTS[0];
        // Chests are stored right away, so leaving the screen never loses them.
        save.chests.push(chest.id);
      }
    }
    const prevBest = pr.best[res.lvlIdx];
    pr.best[res.lvlIdx] = Math.max(prevBest, res.score);
    save.coins += res.coins;
    save.gems += gems;
    persist();
    paused = true; // ignore pause toggles while the result is up

    const newBest = res.score > prevBest;
    const rewards = `<div class="rewards">
      <div class="reward">${icon('coin')}<span class="tx">+${fmt(res.coins)}</span></div>
      ${gems ? `<div class="reward">${icon('gem')}<span class="tx">+${gems}</span></div>` : ''}
      ${chest ? `<div class="reward">${icon('chest', chest.color)}<span class="tx">x1</span></div>` : ''}
    </div>`;
    const stats = `<div class="result-stats">
      <div><small>Kills</small><b class="tx">${res.kills}</b></div>
      <div><small>Score</small><b class="tx">${fmt(res.score)}</b></div>
      <div><small>${newBest ? 'New best!' : 'Best'}</small><b class="tx" style="color:${newBest ? '#b4ffa8' : '#fff'}">${fmt(pr.best[res.lvlIdx])}</b></div>
    </div>`;

    if (res.win) {
      const stars = [0, 1, 2].map(i => icon('star', i < res.stars ? '#ffc933' : '#2a2f6e')).join('');
      const nextBtn = hasNextChapter ? `<button class="btn green" id="m-nextch"><span class="tx">Chapter ${res.chIdx + 2}!</span></button>`
        : res.lvlIdx < 5 ? '<button class="btn green" id="m-next"><span class="tx">Next</span></button>'
        : '<button class="btn green" id="m-retry"><span class="tx">Replay</span></button>';
      sheet(final ? 'Chapter clear!' : 'Victory!', `
        <div class="rays-wrap"><div class="rays"></div><div class="stars">${stars}</div></div>
        ${stats}${rewards}
        ${chest ? '<p>Your chest is saved. Open it now or later from the Battle screen.</p>' : ''}
        ${hasNextChapter ? `<p>${CHAPTERS[res.chIdx + 1].name} is now unlocked!</p>` : ''}
        ${chest ? '<button class="btn blue wide" id="m-chest"><span class="tx">Open chest</span></button>' : ''}
        <div class="actions">
          <button class="btn grey" id="m-home"><span class="tx">Home</span></button>
          ${nextBtn}
        </div>`);
    } else {
      const pct = Math.round(Math.min(1, res.reached) * 100);
      sheet('Defeated', `
        <canvas class="result-art" id="m-art" width="300" height="260"></canvas>
        <div class="reach">
          <div class="reach-track"><div class="reach-fill" style="width:${pct}%"></div></div>
          <small>${res.reached >= 1 ? 'You reached the boss!' : `You made it ${pct}% of the way.`}</small>
        </div>
        ${stats}${rewards}
        <p>Get stronger, then try again:</p>
        <div class="tips">
          <button class="btn small green" id="m-skills">${icon('skills', '#fff')}<span class="tx">Skills</span></button>
          <button class="btn small purple" id="m-gear">${icon('gear', '#fff')}<span class="tx">Gear</span></button>
        </div>
        <div class="actions">
          <button class="btn grey" id="m-home"><span class="tx">Home</span></button>
          <button class="btn" id="m-retry"><span class="tx">Retry</span></button>
        </div>`, { ribbon: 'red', cls: 'defeat' });
      drawZombie($('#m-art').getContext('2d'), 150, 250, 230, 0.4, { color: '#8fbf5a', shirt: '#6b4fb8', seed: 0.2 });
      $('#m-skills').onclick = () => leaveGame(3);
      $('#m-gear').onclick = () => leaveGame(1);
    }

    if (res.win && res.lvlIdx < 5) selectedLevel = res.lvlIdx + 1;
    if (hasNextChapter) { selectedChapter = res.chIdx + 1; selectedLevel = 0; }

    $('#m-home').onclick = () => {
      leaveGame();
      if (save.chests.length) toast('Chest saved: tap it on the Battle screen');
    };
    const next = $('#m-next'), nextCh = $('#m-nextch'), retry = $('#m-retry'), open = $('#m-chest');
    if (next) next.onclick = () => startLevel(res.chIdx, res.lvlIdx + 1);
    if (nextCh) nextCh.onclick = () => startLevel(res.chIdx + 1, 0);
    if (retry) retry.onclick = () => startLevel(res.chIdx, res.lvlIdx);
    if (open) open.onclick = () => {
      Game.quit();
      $('#game-view').hidden = true;
      openSavedChest(() => setTab(2));
    };
  }

  // ---------- Init ----------

  function init() {
    const colors = { shop: '#ff5fb4', gear: '#5d8f46', play: '#ff8a1f', skills: '#ffc933', ranks: '#ffc933', modes: '#2fb8e0', calendar: '#ff4d5e', rifle: '#ffe14d', heart: '#ff4d5e', skull: '#ffffff', helmet: '#2f8ff0' };
    document.querySelectorAll('[data-icon]').forEach(el => {
      const target = el.classList.contains('tab') ? el.querySelector('i') : el;
      target.innerHTML = icon(el.dataset.icon, colors[el.dataset.icon] || '#ffc933');
    });
    $('#hud-pause').innerHTML = icon('pause');
    $('#hud-mute').addEventListener('click', () => { save.settings.muted = !save.settings.muted; persist(); applySettings(); });
    $('#hud-pause').addEventListener('click', () => togglePause());
    $('#ax-pause').innerHTML = icon('pause');
    $('#ax-pause').addEventListener('click', () => togglePause());
    buildAbilities();
    document.querySelectorAll('.navbar .tab').forEach(b => b.addEventListener('click', () => setTab(+b.dataset.tab)));
    document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => setTab(+b.dataset.goto)));
    $('#profile-btn').addEventListener('click', settings);
    // Soft click for every menu button (the game view has its own sounds).
    document.getElementById('app').addEventListener('pointerdown', e => {
      if (e.target.closest('button') && $('#game-view').hidden) Sound.play('click');
      else if (e.target.closest('.hud-pause, .sheet button')) Sound.play('click');
    });
    window.addEventListener('resize', () => { fitInventory(); });
    // Screens slide with a transform; never let focus or scrollIntoView nudge them.
    const lockScroll = el => el.addEventListener('scroll', () => { el.scrollLeft = 0; el.scrollTop = 0; });
    lockScroll(document.querySelector('.screens'));
    document.querySelectorAll('.screen').forEach(lockScroll);
    applySettings();
    setInterval(() => {
      const ft = document.getElementById('free-timer');
      if (ft && tab === 0) { const w = save.freeChestAt - Date.now(); if (w <= 0) render('shop'); else ft.textContent = 'Next in ' + fmtTime(w); }
    }, 30000);
    const sp = document.createElement('div');
    sp.className = 'sparkles';
    sp.innerHTML = Array.from({ length: 16 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${6 + (i % 5) * 1.7}s;--dl:${-(i * 1.3)}s;--s:${3 + (i % 3) * 2}px"></i>`).join('');
    document.querySelector('.screens').prepend(sp);
    $('#modal').addEventListener('click', e => {
      if (e.target.id === 'modal' && $('#m-close')) closeModal();
    });
    for (let c = CHAPTERS.length - 1; c >= 0; c--) if (chapterUnlocked(c)) { selectedChapter = c; break; }
    selectedLevel = Math.max(0, progress().unlocked - 1);
    Game.init();
    Arena.init();
    setTab(2);
    if (document.fonts) document.fonts.ready.then(() => render(TAB_IDS[tab]));
  }

  return { init, togglePause, requestAbility, toast };
})();

UI.init();
