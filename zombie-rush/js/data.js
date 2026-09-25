// Static game data: rarities, gear, skills, chests, chapters.

const RARITIES = [
  { id: 'common',    name: 'Common',    color: '#9aa7b4', dark: '#5d6b78', mult: 1,   salvage: 20 },
  { id: 'rare',      name: 'Rare',      color: '#3d9bff', dark: '#1d5fb8', mult: 1.6, salvage: 60 },
  { id: 'epic',      name: 'Epic',      color: '#b35cff', dark: '#6f2cb0', mult: 2.5, salvage: 180 },
  { id: 'legendary', name: 'Legendary', color: '#ffb81c', dark: '#b87800', mult: 4,   salvage: 500 },
  { id: 'mythic',    name: 'Mythic',    color: '#ff3d5e', dark: '#a8142f', mult: 6.5, salvage: 1500 },
];

// Four gear slots, each boosting one stat.
const SLOTS = [
  { id: 'helmet', name: 'Helmet', stat: 'hp',   label: 'Health',      base: 40,   fmt: v => `+${Math.round(v)} HP` },
  { id: 'rifle',  name: 'Rifle',  stat: 'dmg',  label: 'Damage',      base: 6,    fmt: v => `+${Math.round(v)} DMG` },
  { id: 'gloves', name: 'Gloves', stat: 'rate', label: 'Fire speed',  base: 0.08, fmt: v => `+${Math.round(v * 100)}% fire speed` },
  { id: 'scope',  name: 'Scope',  stat: 'crit', label: 'Crit chance', base: 0.03, fmt: v => `+${(v * 100).toFixed(1)}% crit` },
];

const GEAR_NAMES = {
  helmet: ['Recruit Helmet', 'Ranger Helmet', 'Commando Helmet', 'Warlord Helmet', 'Titan Helmet'],
  rifle:  ['Training Rifle', 'Scout Carbine', 'Storm Rifle', 'Dragon Rifle', 'Doomsday Rifle'],
  gloves: ['Cotton Gloves', 'Tactical Gloves', 'Quickdraw Gloves', 'Blaze Gloves', 'Chrono Gloves'],
  scope:  ['Iron Sight', 'Red Dot', 'Hawk Scope', 'Eagle Eye', 'Oracle Scope'],
};

const SKILLS = [
  { id: 'hp',   name: 'Toughness',      desc: 'Max health',  per: 0.12,  fmt: l => `+${Math.round(l * 12)}% health` },
  { id: 'dmg',  name: 'Firepower',      desc: 'Bullet damage', per: 0.10, fmt: l => `+${Math.round(l * 10)}% damage` },
  { id: 'rate', name: 'Trigger Finger', desc: 'Fire speed',  per: 0.06,  fmt: l => `+${Math.round(l * 6)}% fire speed` },
  { id: 'crit', name: 'Sharpshooter',   desc: 'Crit chance', per: 0.015, fmt: l => `+${(l * 1.5).toFixed(1)}% crit` },
];
const SKILL_MAX = 20;
const skillCost = lvl => Math.round(120 * Math.pow(1.38, lvl));

// Drop odds per rarity (common..mythic), in percent.
const CHESTS = [
  { id: 'wood',   name: 'Supply Crate', price: 400, currency: 'coins', odds: [70, 25, 5, 0, 0],   color: '#b9763a' },
  { id: 'silver', name: 'Silver Chest', price: 120, currency: 'gems',  odds: [0, 60, 32, 7, 1],   color: '#a9c2d9' },
  { id: 'gold',   name: 'Golden Chest', price: 350, currency: 'gems',  odds: [0, 0, 60, 33, 7],   color: '#ffc632' },
];

const COIN_PACKS = [
  { coins: 1000, gems: 80 },
  { coins: 3000, gems: 200 },
  { coins: 10000, gems: 600 },
];

// Test-only gem packs: there is no real money in this build.
const GEM_PACKS = [
  { gems: 100, label: 'Handful' },
  { gems: 500, label: 'Pouch' },
  { gems: 2000, label: 'Crate' },
];

const CHAPTERS = [
  {
    id: 'ch1',
    name: 'Dead City',
    levels: [
      { name: 'Gas Station',  length: 180, zhp: 12, zdmg: 10, density: 0.9, types: ['walker'],
        boss: { name: 'Brute',            hp: 700,  dmg: 14, color: '#7dbb4a', size: 1.5 } },
      { name: 'Main Street',      length: 200, zhp: 17, zdmg: 11, density: 1.0, types: ['walker', 'runner'],
        boss: { name: 'Chomper',          hp: 1100, dmg: 16, color: '#8cc63f', size: 1.55 } },
      { name: 'Broken Bridge',  length: 220, zhp: 23, zdmg: 12, density: 1.1, types: ['walker', 'runner'],
        boss: { name: 'Big Mouth',        hp: 1600, dmg: 18, color: '#6aa84f', size: 1.6 } },
      { name: 'Subway Tunnel',     length: 240, zhp: 30, zdmg: 14, density: 1.15, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Sewer Hulk',       hp: 2300, dmg: 20, color: '#5e9e6e', size: 1.7 } },
      { name: 'Toxic Factory',   length: 260, zhp: 38, zdmg: 16, density: 1.2, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Toxic Butcher',    hp: 3200, dmg: 23, color: '#a3d13b', size: 1.75 } },
      { name: 'City Hall', length: 280, zhp: 48, zdmg: 18, density: 1.3, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Mayor Rot',        hp: 5000, dmg: 26, color: '#79b04a', size: 2.0, final: true } },
    ],
  },
];

const ZOMBIE_TYPES = {
  walker: { hpMult: 1,   speed: 1.2, size: 1,    color: '#f28a3c', score: 10 },
  runner: { hpMult: 0.6, speed: 3.4, size: 0.85, color: '#e8563a', score: 12 },
  tank:   { hpMult: 3.5, speed: 1.0, size: 1.35, color: '#8cbf4a', score: 30 },
};

const BOT_NAMES = [
  'ZedHunter', 'Sgt_Snow', 'CaptainCrunch', 'Nova', 'BulletBob', 'IceQueen', 'Rambo_Jr', 'FrostByte',
  'Kobra', 'MissFire', 'TankYou', 'Dr.Boom', 'PvtPuddle', 'Ghost', 'Maverick', 'Luna', 'Blitz',
  'SnowFox', 'Tiny', 'Major_Pain', 'Viper', 'Echo', 'Hawk', 'Bravo6', 'Pixel', 'Sarge', 'Rookie99',
  'Zulu', 'Tango', 'Nomad', 'Pebbles', 'Shadow', 'Rex', 'Duke', 'Waffles', 'Onyx', 'Scout', 'Fury',
  'Iceman', 'Blaze',
];
