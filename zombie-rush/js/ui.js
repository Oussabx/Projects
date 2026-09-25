// Menus, bottom navbar, modals and the glue between menus and the game.

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const TAB_IDS = ['shop', 'gear', 'play', 'skills', 'ranks'];
  let tab = 2;
  let selectedLevel = 0;
  let heroRaf = 0;
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

  function modal(html) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-card">${html}</div>`;
    m.hidden = false;
    return m;
  }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

  function slotDef(id) { return SLOTS.find(s => s.id === id); }

  function itemTile(item, opts = {}) {
    const rar = RARITIES[item.rarity];
    const eq = save.equipped[item.slot] === item.id;
    return `<button class="item rar-${rar.id}" data-item="${item.id}" aria-label="${itemName(item)}">
      ${icon(item.slot, '#ffffff', opts.size || 40)}
      ${eq && !opts.noTag ? '<span class="equipped-tag">ON</span>' : ''}
    </button>`;
  }

  function progress() { return save.progress.ch1; }

  // ---------- Top bar ----------

  function renderTop() {
    $('#coins').textContent = fmt(save.coins);
    $('#gems').textContent = fmt(save.gems);
    $('#profile-name').textContent = save.name;
    $('#profile-power').textContent = fmt(playerStats().power);
    const c = $('#avatar-canvas').getContext('2d');
    c.clearRect(0, 0, 80, 80);
    drawSoldierFront(c, 40, 118, 110, 0);
    renderNavDots();
  }

  function renderNavDots() {
    // Red dot on Skills when an upgrade is affordable.
    const affordable = SKILLS.some(s => save.skills[s.id] < SKILL_MAX && save.coins >= skillCost(save.skills[s.id]));
    const btn = document.querySelector('.navbar [data-tab="3"]');
    btn.querySelector('.nav-dot')?.remove();
    if (affordable) btn.insertAdjacentHTML('beforeend', '<span class="nav-dot"></span>');
  }

  // ---------- Navigation ----------

  function setTab(i) {
    tab = i;
    $('#track').style.transform = `translateX(-${i * 20}%)`;
    document.querySelectorAll('.navbar button').forEach((b, j) => b.classList.toggle('active', j === i));
    render(TAB_IDS[i]);
    if (i === 2) startHero(); else stopHero();
  }

  function render(id) {
    ({ shop: renderShop, gear: renderGear, play: renderPlay, skills: renderSkills, ranks: renderRanks })[id]();
    renderTop();
  }

  // ---------- Play ----------

  function renderPlay() {
    const pr = progress();
    const ch = CHAPTERS[0];
    selectedLevel = Math.min(selectedLevel, pr.unlocked - 1);
    const lvl = ch.levels[selectedLevel];
    const stars = pr.stars.reduce((a, b) => a + b, 0);
    const nodes = ch.levels.map((l, i) => {
      const locked = i >= pr.unlocked;
      const done = pr.stars[i] > 0;
      const cls = [locked ? 'locked' : done ? 'done' : 'open', i === selectedLevel ? 'selected' : '', i === 5 ? 'boss' : ''].join(' ');
      const starHtml = [0, 1, 2].map(s => s < pr.stars[i] ? '<b>★</b>' : '★').join('');
      return `<button class="lvl ${cls}" data-level="${i}">
        <div class="lvl-node">${locked ? icon('lock', '', 24) : i === 5 ? '☠' : i + 1}</div>
        <div class="lvl-stars">${locked ? '' : starHtml}</div>
      </button>`;
    }).join('');

    $('#screen-play').innerHTML = `
      <div class="play-screen">
        <div class="chapter-card">
          <div class="chapter-head"><h2>Chapter 1</h2><span class="chapter-sub">${ch.name}</span></div>
          <div class="hero-wrap">
            <div class="power-badge">⚡ ${fmt(playerStats().power)}</div>
            <div class="power-badge stars-badge">★ ${stars}/18</div>
            <canvas id="hero-canvas" width="360" height="380"></canvas>
          </div>
          <div class="level-path">${nodes}</div>
          <div class="level-info">
            <div>
              <div class="name outline">Level ${selectedLevel + 1}: ${lvl.name}</div>
              <div class="boss-name">Boss: ${lvl.boss.name} · Best ${fmt(pr.best[selectedLevel])}</div>
            </div>
          </div>
        </div>
        <div class="battle-row"><button class="btn big" id="battle-btn">BATTLE!</button></div>
        <div class="panel locked-card">${icon('lock', '', 28)}<div class="outline">Chapter 2 · Coming soon</div></div>
      </div>`;

    $('#screen-play').querySelectorAll('.lvl').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.level;
      if (i >= pr.unlocked) { toast('Beat the previous level first'); return; }
      selectedLevel = i;
      renderPlay();
    }));
    $('#battle-btn').addEventListener('click', () => startLevel(selectedLevel));
    if (tab === 2 && $('#game-view').hidden) startHero();
  }

  function startHero() {
    stopHero();
    const cv = document.getElementById('hero-canvas');
    if (!cv) return;
    const c = cv.getContext('2d');
    const t0 = performance.now();
    const frame = now => {
      const t = (now - t0) / 1000;
      c.clearRect(0, 0, cv.width, cv.height);
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.beginPath(); c.ellipse(180, 350, 110, 20, 0, 0, Math.PI * 2); c.fill();
      drawSoldierFront(c, 180, 350, 300, t);
      heroRaf = requestAnimationFrame(frame);
    };
    heroRaf = requestAnimationFrame(frame);
  }
  function stopHero() { cancelAnimationFrame(heroRaf); }

  // ---------- Gear ----------

  function renderGear() {
    const st = playerStats();
    const slotHtml = s => {
      const it = getItem(save.equipped[s.id]);
      return it
        ? `<div style="position:relative">${itemTile(it, { noTag: true }).replace('class="item', 'class="slot item')}<div class="slot-label">${s.label}</div></div>`
        : `<div style="position:relative"><div class="slot empty">${icon(s.id, '#ffffff', 40)}</div><div class="slot-label">${s.label}</div></div>`;
    };
    const inv = [...save.inventory].sort((a, b) => b.rarity - a.rarity || itemStat(b) - itemStat(a));

    $('#screen-gear').innerHTML = `
      <h2>Gear</h2>
      <div class="panel">
        <div class="gear-top">
          <div class="gear-col">${slotHtml(SLOTS[0])}${slotHtml(SLOTS[2])}</div>
          <canvas id="gear-canvas" width="320" height="368"></canvas>
          <div class="gear-col">${slotHtml(SLOTS[1])}${slotHtml(SLOTS[3])}</div>
        </div>
        <div class="stats-grid">
          <div class="stat-row">❤ Health <b>${fmt(st.hp)}</b></div>
          <div class="stat-row">💥 Damage <b>${fmt(st.dmg)}</b></div>
          <div class="stat-row">🔥 Fire/s <b>${st.rate.toFixed(1)}</b></div>
          <div class="stat-row">🎯 Crit <b>${Math.round(st.crit * 100)}%</b></div>
        </div>
      </div>
      <div class="inv-head"><h3>Backpack (${inv.length})</h3><button class="btn small green" id="equip-best">Equip best</button></div>
      <div class="inventory">${inv.length ? inv.map(i => itemTile(i)).join('') : '<div class="empty-note">Open chests in the Shop to get gear.</div>'}</div>`;

    const c = $('#gear-canvas').getContext('2d');
    drawSoldierFront(c, 160, 350, 300, 0);

    $('#screen-gear').querySelectorAll('[data-item]').forEach(b => b.addEventListener('click', () => itemDetail(+b.dataset.item)));
    $('#equip-best').addEventListener('click', () => { equipBest(); renderGear(); renderTop(); toast('Best gear equipped'); });
  }

  function itemDetail(id) {
    const item = getItem(id);
    if (!item) return;
    const rar = RARITIES[item.rarity];
    const slot = slotDef(item.slot);
    const cur = getItem(save.equipped[item.slot]);
    const isEq = cur && cur.id === item.id;
    let compare = '';
    if (!isEq) {
      const diff = itemStat(item) - (cur ? itemStat(cur) : 0);
      compare = `<div class="compare">vs equipped: <span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${slot.fmt(Math.abs(diff)).replace('+', '')}</span></div>`;
    }
    modal(`
      <div class="reveal">${itemTile(item, { size: 64, noTag: true })}</div>
      <div class="rarity-label outline" style="color:${rar.color}">${rar.name}</div>
      <h2 style="font-size:1.4rem">${itemName(item)}</h2>
      <div class="item-stat">${slot.fmt(itemStat(item))}</div>
      ${compare}
      <div class="modal-actions">
        ${isEq ? '<button class="btn grey" disabled>Equipped</button>' : '<button class="btn green" id="m-equip">Equip</button>'}
        ${isEq ? '' : `<button class="btn red" id="m-salvage">Salvage ${icon('coin', '', 18)}${rar.salvage}</button>`}
      </div>
      <div class="modal-actions"><button class="btn grey small" id="m-close">Close</button></div>`);
    $('#m-close').onclick = closeModal;
    if (!isEq) {
      $('#m-equip').onclick = () => { equip(item.id); closeModal(); renderGear(); renderTop(); };
      $('#m-salvage').onclick = () => { const v = salvage(item.id); closeModal(); renderGear(); renderTop(); toast(`+${v} coins`); };
    }
  }

  // ---------- Skills ----------

  function renderSkills() {
    const colors = { hp: '#ff5a5a', dmg: '#ff9a2e', rate: '#ffd23a', crit: '#3d9bff' };
    const icons = { hp: '❤', dmg: '💥', rate: '🔥', crit: '🎯' };
    $('#screen-skills').innerHTML = `
      <h2>Skills</h2>
      ${SKILLS.map(s => {
        const lvl = save.skills[s.id];
        const max = lvl >= SKILL_MAX;
        const cost = skillCost(lvl);
        return `<div class="panel skill">
          <div class="skill-icon" style="background:${colors[s.id]};font-size:1.6rem">${icons[s.id]}</div>
          <div>
            <div class="skill-name outline">${s.name} <span style="color:var(--yellow)">Lv ${lvl}</span></div>
            <div class="skill-desc">${s.desc}: ${s.fmt(lvl)}${max ? '' : ` → <span style="color:#8ef08e">${s.fmt(lvl + 1)}</span>`}</div>
            <div class="pips">${Array.from({ length: SKILL_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          </div>
          <button class="btn small ${max ? 'grey' : 'green'}" data-skill="${s.id}" ${max || save.coins < cost ? 'disabled' : ''}>
            ${max ? 'MAX' : `${icon('coin', '', 16)}${fmt(cost)}`}
          </button>
        </div>`;
      }).join('')}
      <p class="test-note">Skills are permanent upgrades. Win levels to earn coins.</p>`;
    $('#screen-skills').querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.skill;
      const cost = skillCost(save.skills[id]);
      if (save.coins < cost) return;
      save.coins -= cost;
      save.skills[id]++;
      persist();
      renderSkills();
      renderTop();
    }));
  }

  // ---------- Shop ----------

  function renderShop() {
    const oddsHtml = odds => odds.map((o, i) => o ? `<span style="color:${RARITIES[i].color}">${RARITIES[i].name[0]} ${o}%</span>` : '').join('');
    $('#screen-shop').innerHTML = `
      <h2>Shop</h2>
      <h3>Chests</h3>
      <div class="shop-grid">
        ${CHESTS.map(c => `<div class="panel shop-card">
          ${icon('chest', c.color, 64)}
          <div class="title outline">${c.name}</div>
          <div class="odds">${oddsHtml(c.odds)}</div>
          <button class="btn ${c.currency === 'gems' ? 'blue' : ''}" data-chest="${c.id}">${icon(c.currency === 'gems' ? 'gem' : 'coin', '', 18)}${fmt(c.price)}</button>
        </div>`).join('')}
      </div>
      <h3>Coins</h3>
      <div class="shop-grid">
        ${COIN_PACKS.map((p, i) => `<div class="panel shop-card">
          ${icon('coin', '', 48)}
          <div class="title outline">${fmt(p.coins)} coins</div>
          <button class="btn blue" data-coins="${i}">${icon('gem', '', 18)}${p.gems}</button>
        </div>`).join('')}
      </div>
      <h3>Gems</h3>
      <div class="shop-grid">
        ${GEM_PACKS.map((p, i) => `<div class="panel shop-card">
          ${icon('gem', '', 48)}
          <div class="title outline">${fmt(p.gems)} gems</div>
          <button class="btn green" data-gems="${i}">FREE</button>
        </div>`).join('')}
      </div>
      <p class="test-note">Test build: gem packs are free so you can try chests. No real payments.</p>`;

    const s = $('#screen-shop');
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
      save.gems -= p.gems; save.coins += p.coins; persist(); renderTop(); toast(`+${fmt(p.coins)} coins`);
    }));
    s.querySelectorAll('[data-gems]').forEach(b => b.addEventListener('click', () => {
      const p = GEM_PACKS[+b.dataset.gems];
      save.gems += p.gems; persist(); renderTop(); toast(`+${fmt(p.gems)} gems`);
    }));
  }

  function chestOpening(chest, after) {
    const item = openChest(chest);
    const rar = RARITIES[item.rarity];
    modal(`
      <h2>${chest.name}</h2>
      <div class="chest-stage" id="chest-stage"><div class="shake">${icon('chest', chest.color, 120)}</div></div>
      <p>Opening…</p>`);
    setTimeout(() => {
      const cur = getItem(save.equipped[item.slot]);
      const better = !cur || itemStat(item) > itemStat(cur);
      modal(`
        <h2>${chest.name}</h2>
        <div class="chest-stage" style="--glow:${rar.color}">
          <div class="chest-rays"></div>
          <div class="reveal">${itemTile(item, { size: 64, noTag: true })}</div>
        </div>
        <div class="rarity-label outline" style="color:${rar.color}">${rar.name}</div>
        <h2 style="font-size:1.35rem">${itemName(item)}</h2>
        <div class="item-stat">${slotDef(item.slot).fmt(itemStat(item))}</div>
        ${better ? '<div class="compare"><span class="up">▲ Better than equipped</span></div>' : ''}
        <div class="modal-actions">
          ${better ? '<button class="btn green" id="m-equip">Equip</button>' : ''}
          <button class="btn" id="m-ok">OK</button>
        </div>`);
      $('#m-ok').onclick = () => { closeModal(); render(TAB_IDS[tab]); after && after(); };
      if (better) $('#m-equip').onclick = () => { equip(item.id); closeModal(); render(TAB_IDS[tab]); toast('Equipped!'); after && after(); };
    }, 1100);
  }

  // ---------- Ranks ----------

  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function renderRanks() {
    const bots = BOT_NAMES.map((n, i) => ({ name: n, score: 400 + (hash(n) % 21000) + (i < 5 ? 12000 : 0), me: false }));
    const me = { name: save.name, score: totalScore(), me: true };
    const all = [...bots, me].sort((a, b) => b.score - a.score);
    const colors = ['#ff7a1a', '#3d9bff', '#5dd65d', '#b35cff', '#ffd23a', '#ff4a4a'];
    const faces = ['☠', '★', '⚡', '♦', '♠', '♥'];
    $('#screen-ranks').innerHTML = `
      <h2>Leaderboard</h2>
      <div class="rank-list">
        ${all.map((p, i) => {
          const h = hash(p.name);
          return `<div class="rank ${p.me ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}">
            <div class="pos outline">${i + 1}</div>
            <div class="ava" style="background:${p.me ? '#ffd23a' : colors[h % colors.length]}">${p.me ? '🪖' : faces[h % faces.length]}</div>
            <div class="nm outline">${p.name}${p.me ? ' (you)' : ''}</div>
            <div class="sc outline">🏆 ${fmt(p.score)}</div>
          </div>`;
        }).join('')}
      </div>
      <p class="test-note">Score = sum of your best score on every level. Other players are local test bots.</p>
      <div class="modal-actions">
        <button class="btn small" id="rename-btn">Change name</button>
        <button class="btn small red" id="reset-btn">Reset progress</button>
      </div>`;
    $('#rename-btn').onclick = rename;
    $('#reset-btn').onclick = () => {
      modal(`<h2>Reset?</h2><p>This wipes all coins, gear and progress on this device.</p>
        <div class="modal-actions"><button class="btn grey" id="m-no">Cancel</button><button class="btn red" id="m-yes">Reset</button></div>`);
      $('#m-no').onclick = closeModal;
      $('#m-yes').onclick = () => { resetSave(); selectedLevel = 0; closeModal(); setTab(2); toast('Progress reset'); };
    };
  }

  function rename() {
    modal(`<h2>Your name</h2><input class="name-input" id="m-name" maxlength="14" value="${save.name.replace(/"/g, '')}">
      <div class="modal-actions"><button class="btn grey" id="m-no">Cancel</button><button class="btn green" id="m-yes">Save</button></div>`);
    const input = $('#m-name');
    input.focus(); input.select();
    $('#m-no').onclick = closeModal;
    $('#m-yes').onclick = () => {
      const v = input.value.replace(/[<>&"]/g, '').trim().slice(0, 14);
      if (v) { save.name = v; persist(); }
      closeModal();
      render(TAB_IDS[tab]);
    };
  }

  // ---------- Level flow ----------

  function startLevel(i) {
    stopHero();
    paused = false;
    $('#game-view').hidden = false;
    const hint = $('#hud-hint');
    hint.style.animation = 'none'; void hint.offsetWidth; hint.style.animation = '';
    Game.start(i, onLevelEnd);
  }

  function exitLevel() {
    Game.quit();
    closeModal();
    $('#game-view').hidden = true;
    setTab(2);
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
    modal(`<h2>Paused</h2>
      <div class="modal-actions"><button class="btn red" id="m-quit">Quit</button><button class="btn green" id="m-resume">Resume</button></div>`);
    $('#m-resume').onclick = () => togglePause();
    $('#m-quit').onclick = exitLevel;
  }

  function onLevelEnd(res) {
    const pr = progress();
    const firstClear = res.win && pr.stars[res.lvlIdx] === 0;
    let gems = 0;
    let chest = null;
    if (res.win) {
      pr.stars[res.lvlIdx] = Math.max(pr.stars[res.lvlIdx], res.stars);
      pr.unlocked = Math.max(pr.unlocked, Math.min(res.lvlIdx + 2, 6));
      if (firstClear) {
        gems = 30 + res.lvlIdx * 10;
        chest = CHAPTERS[0].levels[res.lvlIdx].boss.final ? CHESTS[2] : CHESTS[0];
      }
    }
    const newBest = res.score > pr.best[res.lvlIdx];
    pr.best[res.lvlIdx] = Math.max(pr.best[res.lvlIdx], res.score);
    save.coins += res.coins;
    save.gems += gems;
    persist();

    const starSvg = [0, 1, 2].map(i => icon('star', i < res.stars ? '#ffd23a' : '#4a505e', 54)).join('');
    const final = res.win && CHAPTERS[0].levels[res.lvlIdx].boss.final;
    modal(`
      <h2 style="color:${res.win ? '#ffd23a' : '#ff6a6a'}">${final ? 'CHAPTER CLEAR!' : res.win ? 'VICTORY!' : 'DEFEATED'}</h2>
      ${res.win ? `<div class="result-stars">${starSvg}</div>` : '<p>The horde got you. Upgrade skills or gear and try again!</p>'}
      <p>Kills ${res.kills} · Score ${fmt(res.score)}${newBest ? ' · <span style="color:#8ef08e">New best!</span>' : ''}</p>
      <div class="rewards">
        <div class="reward">${icon('coin', '', 22)} +${fmt(res.coins)}</div>
        ${gems ? `<div class="reward">${icon('gem', '', 22)} +${gems}</div>` : ''}
        ${chest ? `<div class="reward">${icon('chest', chest.color, 22)} ${chest.name}</div>` : ''}
      </div>
      <div class="modal-actions">
        ${chest ? '<button class="btn blue" id="m-chest">Open chest</button>' : ''}
        <button class="btn grey" id="m-home">Home</button>
        ${res.win && res.lvlIdx < 5 ? '<button class="btn green" id="m-next">Next</button>' : '<button class="btn green" id="m-retry">Retry</button>'}
      </div>`);

    const home = () => { closeModal(); $('#game-view').hidden = true; setTab(2); };
    $('#m-home').onclick = home;
    const next = $('#m-next'), retry = $('#m-retry');
    if (next) next.onclick = () => { closeModal(); selectedLevel = res.lvlIdx + 1; startLevel(selectedLevel); };
    if (retry) retry.onclick = () => { closeModal(); startLevel(res.lvlIdx); };
    if (chest) $('#m-chest').onclick = () => {
      // Chest was earned, not bought: open it free, then return home.
      $('#game-view').hidden = true;
      chestOpening(chest, () => setTab(2));
    };
    if (res.win && res.lvlIdx < 5) selectedLevel = res.lvlIdx + 1;
  }

  // ---------- Init ----------

  function init() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      const target = el.tagName === 'BUTTON' ? el.querySelector('i') : el;
      const size = el.classList.contains('center') ? 40 : el.tagName === 'BUTTON' ? 32 : 22;
      const colors = { shop: '#ffd23a', gear: '#5d8f46', play: '#ff7a1a', skills: '#ffd23a', ranks: '#ffd23a' };
      target.innerHTML = icon(el.dataset.icon, colors[el.dataset.icon] || '#ffd23a', size);
    });
    $('#hud-pause').innerHTML = icon('pause', '', 22);
    $('#hud-pause').addEventListener('click', () => togglePause());
    document.querySelectorAll('.navbar button').forEach(b => b.addEventListener('click', () => setTab(+b.dataset.tab)));
    $('#profile-btn').addEventListener('click', rename);
    $('#modal').addEventListener('click', e => {
      // Tapping the backdrop closes simple modals (not results/pause).
      if (e.target.id === 'modal' && $('#m-close')) closeModal();
    });
    selectedLevel = Math.max(0, progress().unlocked - 1);
    Game.init();
    setTab(2);
    // Redraw once the game font has loaded.
    if (document.fonts) document.fonts.ready.then(() => render(TAB_IDS[tab]));
  }

  return { init, togglePause, toast };
})();

UI.init();
