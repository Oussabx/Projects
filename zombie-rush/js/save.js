// Player save data (localStorage) and derived stats.

const SAVE_KEY = 'soldier-rush-save-v1';

function defaultSave() {
  return {
    v: 1,
    name: 'Rookie',
    coins: 500,
    gems: 150,
    skills: { hp: 0, dmg: 0, rate: 0, crit: 0 },
    inventory: [
      { id: 1, slot: 'rifle', rarity: 0, roll: 1, kind: 'rifle', lvl: 1 },
      { id: 2, slot: 'helmet', rarity: 0, roll: 1, lvl: 1 },
    ],
    freeChestAt: 0,
    equipped: { helmet: 2, rifle: 1, gloves: null, scope: null },
    nextId: 3,
    settings: { music: 0.5, sfx: 0.8, muted: false },
    progress: {
      ch1: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0] },
      ch2: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0] },
      ch3: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0] },
      ch4: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0] },
      ch5: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0] },
      ch6: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0] },
    },
    chests: [],
    modes: { touchline: 0, survival: 0, extraction: 0, ammo: 0 },
    daily: { day: '', picks: [], prog: {}, claimed: [], bonus: false },
  };
}

let save = loadSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const def = defaultSave();
      const data = Object.assign(def, JSON.parse(raw));
      // Older saves: add any chapters and fields they are missing.
      data.progress = Object.assign(defaultSave().progress, data.progress);
      data.settings = Object.assign(defaultSave().settings, data.settings);
      data.chests = data.chests || [];
      data.inventory.forEach(i => { if (i.slot === 'rifle' && !i.kind) i.kind = 'rifle'; if (!i.lvl) i.lvl = 1; });
      if (data.freeChestAt === undefined) data.freeChestAt = 0;
      data.modes = Object.assign(defaultSave().modes, data.modes);
      data.daily = Object.assign(defaultSave().daily, data.daily);
      return data;
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return defaultSave();
}

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

function resetSave() {
  save = defaultSave();
  persist();
}

// ---------- Gear ----------

function itemStat(item) {
  const slot = SLOTS.find(s => s.id === item.slot);
  return slot.base * RARITIES[item.rarity].mult * item.roll * (1 + 0.15 * ((item.lvl || 1) - 1));
}

function itemName(item) {
  if (item.slot === 'rifle') return `${RARITY_PREFIX[item.rarity]} ${WEAPONS[item.kind || 'rifle'].name}`;
  return GEAR_NAMES[item.slot][item.rarity];
}

function upgradeItem(id) {
  const item = getItem(id);
  if (!item || (item.lvl || 1) >= GEAR_MAX_LVL) return false;
  const cost = gearUpgradeCost(item);
  if (save.coins < cost) return false;
  save.coins -= cost;
  item.lvl = (item.lvl || 1) + 1;
  persist();
  return true;
}

function equippedWeapon() {
  const it = getItem(save.equipped.rifle);
  return it ? it.kind || 'rifle' : 'rifle';
}

function getItem(id) {
  return save.inventory.find(i => i.id === id) || null;
}

function addItem(slot, rarity) {
  const item = { id: save.nextId++, slot, rarity, roll: +(0.9 + Math.random() * 0.2).toFixed(2), lvl: 1 };
  if (slot === 'rifle') {
    const kinds = Object.keys(WEAPONS).filter(k => WEAPONS[k].minRarity <= rarity);
    item.kind = kinds[Math.floor(Math.random() * kinds.length)];
  }
  save.inventory.push(item);
  return item;
}

function equip(id) {
  const item = getItem(id);
  if (item) save.equipped[item.slot] = id;
  persist();
}

function salvage(id) {
  const item = getItem(id);
  if (!item || save.equipped[item.slot] === id) return 0;
  save.inventory = save.inventory.filter(i => i.id !== id);
  const value = RARITIES[item.rarity].salvage * (item.lvl || 1);
  save.coins += value;
  persist();
  return value;
}

// Merge three unequipped items of one rarity into a random item one rarity higher.
// Coins spent upgrading the three items are refunded.
function mergeItems(ids) {
  const items = ids.map(getItem);
  if (items.length !== 3 || items.some(i => !i) || new Set(ids).size !== 3) return null;
  const rarity = items[0].rarity;
  if (rarity >= RARITIES.length - 1 || items.some(i => i.rarity !== rarity || save.equipped[i.slot] === i.id)) return null;
  let refund = 0;
  for (const it of items) for (let l = 1; l < (it.lvl || 1); l++) refund += gearUpgradeCost({ ...it, lvl: l });
  save.inventory = save.inventory.filter(i => !ids.includes(i.id));
  save.coins += refund;
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)].id;
  const item = addItem(slot, rarity + 1);
  track('merges', 1);
  persist();
  return { item, refund };
}

function equipBest() {
  for (const slot of SLOTS) {
    const best = save.inventory
      .filter(i => i.slot === slot.id)
      .sort((a, b) => itemStat(b) - itemStat(a))[0];
    if (best) save.equipped[slot.id] = best.id;
  }
  persist();
}

function openChest(chest) {
  const r = Math.random() * 100;
  let acc = 0, rarity = 0;
  for (let i = 0; i < chest.odds.length; i++) {
    acc += chest.odds[i];
    if (r < acc) { rarity = i; break; }
  }
  const slot = chest.slot || SLOTS[Math.floor(Math.random() * SLOTS.length)].id;
  const item = addItem(slot, rarity);
  track('chests', 1);
  persist();
  return item;
}

// ---------- Stats ----------

function gearBonus(stat) {
  let total = 0;
  for (const slot of SLOTS) {
    if (slot.stat !== stat) continue;
    const item = getItem(save.equipped[slot.id]);
    if (item) total += itemStat(item);
  }
  return total;
}

function playerStats() {
  const s = save.skills;
  const hp = Math.round((100 + gearBonus('hp')) * (1 + s.hp * 0.12));
  const dmg = Math.round((10 + gearBonus('dmg')) * (1 + s.dmg * 0.10));
  const rate = 4.5 * (1 + gearBonus('rate') + s.rate * 0.06);
  const crit = Math.min(0.05 + gearBonus('crit') + s.crit * 0.015, 0.75);
  const power = Math.round(hp * 0.6 + dmg * rate * 4 * (1 + crit));
  return { hp, dmg, rate, crit, power };
}

function totalScore() {
  return Object.values(save.progress).reduce((sum, ch) => sum + ch.best.reduce((a, b) => a + b, 0), 0);
}

function chapterUnlocked(ch) {
  return ch === 0 || save.progress[CHAPTERS[ch - 1].id].stars[5] > 0;
}

function totalStars() {
  return Object.values(save.progress).reduce((sum, ch) => sum + ch.stars.reduce((a, b) => a + b, 0), 0);
}

// ---------- Daily challenges ----------

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Three challenges a day, picked from the pool with the date as the seed.
function dailyState() {
  const day = todayKey();
  if (save.daily.day !== day) {
    let seed = [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const pool = CHALLENGE_POOL.slice();
    const picks = [];
    for (let i = 0; i < 3; i++) {
      const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const k = Math.floor(rnd() * c.goals.length);
      picks.push({ id: c.id, goal: c.goals[k], k });
    }
    save.daily = { day, picks, prog: {}, claimed: [false, false, false], bonus: false };
    persist();
  }
  return save.daily;
}

// Record progress for daily challenges. 'max' stats keep the best value reached today.
function track(stat, n = 1, mode = 'add') {
  const d = dailyState();
  const cur = d.prog[stat] || 0;
  d.prog[stat] = mode === 'max' ? Math.max(cur, n) : cur + n;
  persist();
}

function challengeReward(pick) {
  return { coins: 250 * (pick.k + 1), gems: 15 * (pick.k + 1) };
}
