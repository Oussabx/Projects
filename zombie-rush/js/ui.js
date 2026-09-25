// Menus, bottom navbar, modals and the glue between menus and the game.

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const TAB_IDS = ['shop', 'gear', 'play', 'skills', 'ranks'];
  const STAT_ICON = { hp: ['heart', '#ff4d5e'], dmg: ['burst', '#ff8a1f'], rate: ['fire', '#ff6a2a'], crit: ['target', '#2fe0c4'] };
  let tab = 2;
  let selectedLevel = 0;
  let selectedChapter = 0;
  let gearFilter = 'all';
  let shopTab = 'chests';
  let sceneRaf = 0;
  let paused = false;

  // ---------- Helpers ----------

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
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

  function tile(item, opts = {}) {
    const rar = RARITIES[item.rarity];
    const eq = save.equipped[item.slot] === item.id;
    return `<button class="tile r-${rar.id} ${opts.cls || ''}" data-item="${item.id}" aria-label="${rar.name} ${itemName(item)}">
      ${icon(item.slot, '#ffffff', 64)}<span class="gem-dot"></span>
      ${eq && !opts.noTag ? '<span class="tag tx">ON</span>' : ''}
    </button>`;
  }

  function statIcon(stat) { const [n, c] = STAT_ICON[stat]; return icon(n, c, 26); }

  // ---------- Top bar ----------

  function renderTop() {
    $('#coins').textContent = fmt(save.coins);
    $('#gems').textContent = fmt(save.gems);
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
    const canChest = CHESTS.some(c => save[c.currency] >= c.price);
    const upgrade = SLOTS.some(s => {
      const cur = getItem(save.equipped[s.id]);
      return save.inventory.some(i => i.slot === s.id && (!cur || itemStat(i) > itemStat(cur)));
    });
    const dots = { 0: canChest, 1: upgrade, 2: save.chests.length > 0 && tab !== 2, 3: canSkill };
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
    ({ shop: renderShop, gear: renderGear, play: renderPlay, skills: renderSkills, ranks: renderRanks })[id]();
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
    drawZombie(bp, 64, 200, 170, 0, { color: lvl.boss.color, boss: true, final: lvl.boss.final, wide: 1.15, shirt: '#4a3f7a' });

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
    const colors = ['#f28a3c', '#e8563a', '#ff9d4a', '#8cbf4a'];
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
    if (th.mesas) {
      // Desert mesas
      const tops = [[0, 0.55], [0.18, 0.7], [0.42, 0.45], [0.62, 0.62], [0.85, 0.5]];
      tops.forEach(([x, hh], i) => {
        c.fillStyle = th.skyline[i % 2];
        const mw = w * 0.26, top = hz - hz * hh * 0.6;
        c.beginPath(); c.moveTo(w * x - mw * 0.1, hz); c.lineTo(w * x + mw * 0.08, top); c.lineTo(w * x + mw * 0.72, top); c.lineTo(w * x + mw * 0.9, hz); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.fillRect(w * x + mw * 0.08, top, mw * 0.64, 4);
      });
    } else {
      // Skyline with lit windows
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
    drawZombie(c, w * 0.8, hz + h * 0.12, h * 0.44, t, { color: lvl.boss.color, boss: true, final: lvl.boss.final, wide: 1.2, shirt: '#4a3f7a' });
    const ch2 = !!th.mesas;
    walkers.forEach((z, i) => {
      const y = hz + (h - hz) * z.z * 0.55;
      drawZombie(c, w / 2 + z.x * w * 0.45, y, h * 0.16 * (0.6 + z.z), t + z.t, { color: z.color, shirt: '#6b4fb8', helmet: ch2 && i % 3 === 0, bomb: ch2 && i % 3 === 1 });
    });
    if (ch2) { drawCactus(c, w * 0.1, h * 0.95, h * 0.26); drawDrum(c, w * 0.9, h * 0.97, h * 0.15); }
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
      <button class="btn green" id="equip-best"><span class="tx">Equip best</span></button>`;

    drawSoldierFront($('#gear-canvas').getContext('2d'), 150, 330, 290, 0);
    fitInventory();
    const s = $('#screen-gear');
    s.querySelectorAll('[data-item]').forEach(b => b.addEventListener('click', () => itemDetail(+b.dataset.item)));
    s.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { gearFilter = b.dataset.filter; render('gear'); }));
    $('#equip-best').onclick = () => { equipBest(); Sound.play('equip'); render('gear'); toast('Best gear equipped'); };
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
    let delta = '';
    if (!isEq) {
      const d = itemStat(item) - (cur ? itemStat(cur) : 0);
      delta = `<span class="delta tx ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${slot.fmt(Math.abs(d)).replace('+', '')} vs equipped</span>`;
    }
    sheet(slot.name, `
      <div class="rays-wrap" style="--glow:${rar.color}"><div class="rays"></div>${tile(item, { noTag: true, cls: 'big reveal' })}</div>
      <div class="rarity tx" style="color:${rar.color}">${rar.name}</div>
      <div class="item-name tx">${itemName(item)}</div>
      ${statLine(item)}
      ${delta}
      <div class="actions">
        ${isEq ? '<button class="btn grey" disabled><span class="tx">Equipped</span></button>'
               : `<button class="btn red" id="m-salvage"><span class="tx">Sell</span>${icon('coin')}<span class="tx">${rar.salvage}</span></button>
                  <button class="btn green" id="m-equip"><span class="tx">Equip</span></button>`}
      </div>`, { close: true, ribbon: 'purple' });
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
    let cards = '';
    if (shopTab === 'chests') {
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
      <div class="shop-grid">${cards}</div>
      <p class="note">${notes[shopTab]}</p>`;

    const s = $('#screen-shop');
    s.querySelectorAll('[data-shoptab]').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.shoptab; render('shop'); }));
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

  // ---------- Ranks ----------

  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function avatar(p) {
    const colors = ['#ff8a1f', '#29a8ff', '#4fd645', '#a55cff', '#ffc933', '#ff4d5e', '#2fe0c4', '#ff5fb4'];
    const faces = ['skull', 'star', 'bolt', 'heart', 'fire', 'target'];
    const h = hash(p.name);
    if (p.me) return `<span class="ava" style="background:#ffc933">${icon('helmet', '#3f6b2e')}</span>`;
    return `<span class="ava" style="background:${colors[h % colors.length]}">${icon(faces[(h >>> 3) % faces.length], '#fff')}</span>`;
  }

  function renderRanks() {
    const bots = BOT_NAMES.map((n, i) => ({ name: n, score: 400 + (hash(n) % 21000) + (i < 5 ? 12000 : 0), me: false }));
    const all = [...bots, { name: save.name, score: totalScore(), me: true }].sort((a, b) => b.score - a.score);
    const meIdx = all.findIndex(p => p.me);
    const pod = (p, place, cls) => `<div class="pod ${cls}">
      ${avatar(p)}<span class="nm tx">${p.name}${p.me ? ' (you)' : ''}</span><span class="sc tx">${fmt(p.score)}</span>
      <div class="block tx">${place}</div></div>`;
    const row = (p, i) => `<div class="rank ${p.me ? 'me' : ''}">
      <span class="pos tx">${i + 1}</span>${avatar(p)}
      <span class="nm tx">${p.name}${p.me ? ' (you)' : ''}</span>
      <span class="sc tx">${icon('ranks', '#ffc933')}${fmt(p.score)}</span>
    </div>`;
    $('#screen-ranks').innerHTML = `
      <div class="ribbon blue"><span class="tx">Leaderboard</span></div>
      <div class="podium">${pod(all[1], 2, 'second')}${pod(all[0], 1, 'first')}${pod(all[2], 3, 'third')}</div>
      <div class="rank-list" id="rank-list">${all.slice(3).map((p, i) => p.me ? '' : row(p, i + 3)).join('')}</div>
      ${meIdx >= 3 ? row(all[meIdx], meIdx) : ''}`;
    fitRanks();
  }

  // Show only the rows that fit, so the screen never scrolls.
  function fitRanks() {
    const list = $('#rank-list');
    if (!list || tab !== 4) return;
    while (list.lastElementChild && list.scrollHeight > list.clientHeight + 1) list.lastElementChild.remove();
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
    closeModal();
    $('#game-view').hidden = true;
    setTab(toTab);
  }

  function togglePause(forceOn) {
    if (paused && !forceOn) {
      paused = false;
      closeModal();
      Game.resume();
      return;
    }
    if (paused) return;
    paused = true;
    Game.pause();
    sheet('Paused', `<p>Take a breather. The horde will wait.</p>
      <div class="actions"><button class="btn red" id="m-quit"><span class="tx">Quit</span></button><button class="btn green" id="m-resume"><span class="tx">Resume</span></button></div>`, { ribbon: 'blue' });
    $('#m-resume').onclick = () => togglePause();
    $('#m-quit').onclick = () => leaveGame();
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
      drawZombie($('#m-art').getContext('2d'), 150, 250, 230, 0.4, { color: '#f28a3c', shirt: '#6b4fb8' });
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
    const colors = { shop: '#ff5fb4', gear: '#5d8f46', play: '#ff8a1f', skills: '#ffc933', ranks: '#ffc933', heart: '#ff4d5e', skull: '#ffffff', helmet: '#2f8ff0' };
    document.querySelectorAll('[data-icon]').forEach(el => {
      const target = el.classList.contains('tab') ? el.querySelector('i') : el;
      target.innerHTML = icon(el.dataset.icon, colors[el.dataset.icon] || '#ffc933');
    });
    $('#hud-pause').innerHTML = icon('pause');
    $('#hud-mute').addEventListener('click', () => { save.settings.muted = !save.settings.muted; persist(); applySettings(); });
    $('#hud-pause').addEventListener('click', () => togglePause());
    document.querySelectorAll('.navbar .tab').forEach(b => b.addEventListener('click', () => setTab(+b.dataset.tab)));
    document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => setTab(+b.dataset.goto)));
    $('#profile-btn').addEventListener('click', settings);
    // Soft click for every menu button (the game view has its own sounds).
    document.getElementById('app').addEventListener('pointerdown', e => {
      if (e.target.closest('button') && $('#game-view').hidden) Sound.play('click');
      else if (e.target.closest('.hud-pause, .sheet button')) Sound.play('click');
    });
    window.addEventListener('resize', () => { fitInventory(); if (tab === 4) renderRanks(); });
    // Screens slide with a transform; never let focus or scrollIntoView nudge them.
    const lockScroll = el => el.addEventListener('scroll', () => { el.scrollLeft = 0; el.scrollTop = 0; });
    lockScroll(document.querySelector('.screens'));
    document.querySelectorAll('.screen').forEach(lockScroll);
    applySettings();
    $('#modal').addEventListener('click', e => {
      if (e.target.id === 'modal' && $('#m-close')) closeModal();
    });
    for (let c = CHAPTERS.length - 1; c >= 0; c--) if (chapterUnlocked(c)) { selectedChapter = c; break; }
    selectedLevel = Math.max(0, progress().unlocked - 1);
    Game.init();
    setTab(2);
    if (document.fonts) document.fonts.ready.then(() => render(TAB_IDS[tab]));
  }

  return { init, togglePause, toast };
})();

UI.init();
