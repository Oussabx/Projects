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
    },
    chests: [],
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
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)].id;
  const item = addItem(slot, rarity);
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
