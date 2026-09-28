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
  { id: 'rifle',  name: 'Weapon', stat: 'dmg',  label: 'Damage',      base: 6,    fmt: v => `+${Math.round(v)} DMG` },
  { id: 'gloves', name: 'Gloves', stat: 'rate', label: 'Fire speed',  base: 0.08, fmt: v => `+${Math.round(v * 100)}% fire speed` },
  { id: 'scope',  name: 'Scope',  stat: 'crit', label: 'Crit chance', base: 0.03, fmt: v => `+${(v * 100).toFixed(1)}% crit` },
];

const GEAR_NAMES = {
  helmet: ['Recruit Helmet', 'Ranger Helmet', 'Commando Helmet', 'Warlord Helmet', 'Titan Helmet'],
  rifle:  ['Training Rifle', 'Scout Carbine', 'Storm Rifle', 'Dragon Rifle', 'Doomsday Rifle'],
  gloves: ['Cotton Gloves', 'Tactical Gloves', 'Quickdraw Gloves', 'Blaze Gloves', 'Chrono Gloves'],
  scope:  ['Iron Sight', 'Red Dot', 'Hawk Scope', 'Eagle Eye', 'Oracle Scope'],
};

// Weapon types for the Rifle slot. Each fires differently in levels.
// dmg/rate scale the leader's shots; minRarity gates heavy weapons to better chests.
const WEAPONS = {
  rifle:   { name: 'Assault Rifle',   dmg: 1,    rate: 1,    minRarity: 0, trait: 'Balanced all-rounder',           color: '#6b7f4a' },
  smg:     { name: 'SMG',             dmg: 0.65, rate: 1.7,  minRarity: 0, trait: 'Very fast fire',                  color: '#4a6fa5' },
  shotgun: { name: 'Shotgun',         dmg: 0.38,  rate: 0.7,  minRarity: 1, trait: 'Fires 5 pellets in a spread',     color: '#a5643a', pellets: 5 },
  sniper:  { name: 'Sniper Rifle',    dmg: 2.8,  rate: 0.45, minRarity: 1, trait: 'Huge damage, pierces 3 enemies',  color: '#3f5f4a', pierce: 3 },
  minigun: { name: 'Minigun',         dmg: 0.5,  rate: 2.6,  minRarity: 2, trait: 'Bullet storm',                    color: '#c9a23a' },
  rocket:  { name: 'Rocket Launcher', dmg: 3.6,  rate: 0.4,  minRarity: 2, trait: 'Rockets explode in an area',      color: '#4f8a3a', splash: 0.55 },
};
const RARITY_PREFIX = ['Rusty', 'Tactical', 'Elite', 'Golden', 'Mythic'];
const GEAR_MAX_LVL = 25;
const gearUpgradeCost = item => Math.round(80 * (item.rarity + 1) * Math.pow(item.lvl || 1, 1.45));
const FREE_CHEST_MS = 4 * 60 * 60 * 1000;

const SKILLS = [
  { id: 'hp',   name: 'Toughness',      desc: 'Max health',  per: 0.12,  fmt: l => `+${Math.round(l * 12)}% health` },
  { id: 'dmg',  name: 'Firepower',      desc: 'Bullet damage', per: 0.10, fmt: l => `+${Math.round(l * 10)}% damage` },
  { id: 'rate', name: 'Trigger Finger', desc: 'Fire speed',  per: 0.06,  fmt: l => `+${Math.round(l * 6)}% fire speed` },
  { id: 'crit', name: 'Sharpshooter',   desc: 'Crit chance', per: 0.015, fmt: l => `+${(l * 1.5).toFixed(1)}% crit` },
];
const SKILL_MAX = 50;
const skillCost = lvl => Math.round(120 + 60 * Math.pow(lvl, 1.85));

// Drop odds per rarity (common..mythic), in percent.
const CHESTS = [
  { id: 'wood',   name: 'Supply Crate', price: 400, currency: 'coins', odds: [70, 25, 5, 0, 0],   color: '#b9763a' },
  { id: 'silver', name: 'Silver Chest', price: 120, currency: 'gems',  odds: [0, 60, 32, 7, 1],   color: '#a9c2d9' },
  { id: 'gold',   name: 'Golden Chest', price: 350, currency: 'gems',  odds: [0, 0, 60, 33, 7],   color: '#ffc632' },
];

// One crate per gear slot, opened by watching a rewarded video (no cooldown).
const GEAR_CRATES = SLOTS.map(sl => ({
  id: 'crate-' + sl.id, slot: sl.id, name: `${sl.name} Crate`, odds: [60, 28, 10, 2, 0], color: '#6f8fb8', ad: true,
}));

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
    theme: {
      sky: ['#4f8fe8', '#8fc4ff', '#d8ecff'], sun: 'rgba(255,250,220,.95)',
      ground: ['#48b83e', '#56c94a'], shoulder: '#98a4ef', road: '#a7abb4',
      curb: ['#ff4d5e', '#ffffff'], line: '#ffffff',
      skyline: ['#3b2a8f', '#4a35a8'], windows: '#ffd35a', menuGround: ['#7b86d6', '#5561b8'],
      props: [],
      bridge: true,
    },
    levels: [
      { name: 'Gas Station',  length: 200, zhp: 18, zdmg: 10, density: 0.8, power: 400, types: ['walker'],
        boss: { name: 'Brute',            hp: 1200,  dmg: 20, color: '#7dbb4a', size: 1.5 } },
      { name: 'Main Street',      length: 220, zhp: 20, zdmg: 14, density: 1.1, power: 800, types: ['walker', 'runner'],
        boss: { name: 'Chomper',          hp: 2800, dmg: 24, color: '#8cc63f', size: 1.55 } },
      { name: 'Broken Bridge',  length: 240, zhp: 28, zdmg: 17, density: 1.2, power: 1300, types: ['walker', 'runner'],
        boss: { name: 'Big Mouth',        hp: 4400, dmg: 28, color: '#6aa84f', size: 1.6 } },
      { name: 'Subway Tunnel',     length: 260, zhp: 55, zdmg: 22, density: 1.3, power: 2500, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Sewer Hulk',       hp: 8000, dmg: 32, color: '#5e9e6e', size: 1.7 } },
      { name: 'Toxic Factory',   length: 280, zhp: 96, zdmg: 29, density: 1.4, power: 4500, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Toxic Butcher',    hp: 13300, dmg: 37, color: '#a3d13b', size: 1.75 } },
      { name: 'City Hall', length: 300, zhp: 120, zdmg: 34, density: 1.5, power: 8000, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Mayor Rot',        hp: 21000, dmg: 44, color: '#79b04a', size: 2.0, final: true } },
    ],
  },
  {
    id: 'ch2',
    name: 'Scorched Highway',
    theme: {
      sky: ['#b5367a', '#ff7a3a', '#ffd27a'], sun: 'rgba(255,250,210,.95)',
      ground: ['#f0b35a', '#f7c472'], shoulder: '#d9925a', road: '#6a4f63',
      curb: ['#ffd23a', '#2b2342'], line: '#ffffff',
      skyline: ['#b8502f', '#d0673a'], windows: null, menuGround: ['#e8a55a', '#c9803f'],
      mesas: true, backdrop: 'mesas',
      props: ['cactus', 'cactus', 'rock', 'tires', 'drum', 'car', 'cone'],
    },
    levels: [
      { name: 'Dusty Outskirts', length: 260, zhp: 123,  zdmg: 34, density: 1.5,  power: 9000,  types: ['walker', 'runner', 'armored'],
        boss: { name: 'Sand Brute',   hp: 22400, dmg: 48, color: '#d4a84a', size: 1.6 } },
      { name: 'Cactus Canyon',   length: 270, zhp: 132,  zdmg: 36, density: 1.53, power: 11000,  types: ['walker', 'runner', 'armored', 'bomber'],
        boss: { name: 'Cactus Jack',  hp: 25200, dmg: 52, color: '#5fbf6a', size: 1.65 } },
      { name: 'Rusty Junkyard',  length: 280, zhp: 142, zdmg: 38, density: 1.56,  power: 14000,  types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Scrap King',   hp: 29400, dmg: 56, color: '#c77d45', size: 1.7 } },
      { name: 'Oil Refinery',    length: 290, zhp: 154, zdmg: 40, density: 1.59, power: 18000,  types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Oil Slick',    hp: 33600, dmg: 60, color: '#6f6a9a', size: 1.75 } },
      { name: 'Sandstorm Pass',  length: 300, zhp: 168, zdmg: 42, density: 1.62,  power: 23000,  types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Dune Stalker', hp: 37800, dmg: 64, color: '#e08a4a', size: 1.8 } },
      { name: 'Warlord Fort',    length: 320, zhp: 183, zdmg: 45, density: 1.65, power: 30000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'The Warlord',  hp: 47600, dmg: 70, color: '#9a5fd6', size: 2.1, final: true } },
    ],
  },
  {
    id: 'ch3',
    name: 'Frozen Peaks',
    theme: {
      sky: ['#5f98d8', '#a9d2ff', '#eef7ff'],
      sun: 'rgba(255,255,255,.95)',
      ground: ['#e6f0fb', '#f5f9ff'],
      shoulder: '#b9cde6',
      road: '#7a88a6',
      curb: ['#3aa0ff', '#ffffff'],
      line: '#ffe36e',
      skyline: ['#9fb8d8', '#bcd0ea'],
      windows: null,
      menuGround: ['#dde9f7', '#b9cde6'],
      backdrop: 'peaks',
      skin: '#8fd0e0',
      props: ['pine', 'pine', 'snowman', 'pine', 'crate'],
    },
    levels: [
      { name: 'Snowy Outpost', length: 270, zhp: 231, zdmg: 40, density: 1.6, power: 40000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Yeti Brute', hp: 43700, dmg: 57, color: '#bfe6f2', size: 1.65 } },
      { name: 'Frozen Lake', length: 282, zhp: 248, zdmg: 42, density: 1.62, power: 43000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Frostbite', hp: 49100, dmg: 61, color: '#8fd0e0', size: 1.7 } },
      { name: 'Ice Cave', length: 294, zhp: 268, zdmg: 45, density: 1.64, power: 47000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Ice Maw', hp: 57300, dmg: 66, color: '#7ac0e8', size: 1.75 } },
      { name: 'Avalanche Road', length: 306, zhp: 290, zdmg: 47, density: 1.66, power: 50000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Snow Hulk', hp: 65500, dmg: 71, color: '#d6eef7', size: 1.8 } },
      { name: 'Blizzard Base', length: 318, zhp: 317, zdmg: 50, density: 1.68, power: 54000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Blizzard King', hp: 73700, dmg: 76, color: '#6fb0e0', size: 1.85 } },
      { name: 'Glacier Throne', length: 330, zhp: 344, zdmg: 53, density: 1.7, power: 59000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'The Frost Titan', hp: 92800, dmg: 83, color: '#5fa0e8', size: 2.15, final: true } },
    ],
  },
  {
    id: 'ch4',
    name: 'Toxic Swamp',
    theme: {
      sky: ['#1f3a2e', '#5f8a3a', '#c9e06a'],
      sun: 'rgba(220,255,140,.85)',
      ground: ['#3f5a2a', '#4d6b32'],
      shoulder: '#6b5a3a',
      road: '#4a3f46',
      curb: ['#9ad13b', '#2b2342'],
      line: '#c9ff5a',
      skyline: ['#233a26', '#2e4a2e'],
      windows: null,
      menuGround: ['#4a6a30', '#33502a'],
      backdrop: 'swamp',
      skin: '#a6e040',
      props: ['deadtree', 'toxic', 'deadtree', 'tires', 'toxic'],
    },
    levels: [
      { name: 'Murky Dock', length: 270, zhp: 440, zdmg: 47, density: 1.65, power: 63000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Bog Crawler', hp: 85700, dmg: 67, color: '#8fbf3a', size: 1.65 } },
      { name: 'Rotten Marsh', length: 282, zhp: 473, zdmg: 50, density: 1.67, power: 68000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Sludge Belly', hp: 96400, dmg: 72, color: '#a6d13b', size: 1.7 } },
      { name: 'Sludge Plant', length: 294, zhp: 508, zdmg: 53, density: 1.69, power: 74000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Swamp Hag', hp: 112500, dmg: 78, color: '#7fae4a', size: 1.75 } },
      { name: 'Bayou Bridge', length: 306, zhp: 551, zdmg: 56, density: 1.71, power: 80000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Mutant Brute', hp: 128500, dmg: 84, color: '#b8e03a', size: 1.8 } },
      { name: 'Mutant Lab', length: 318, zhp: 600, zdmg: 58, density: 1.73, power: 86000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Dr. Rot', hp: 144500, dmg: 89, color: '#6f9e3a', size: 1.85 } },
      { name: 'Plague Heart', length: 330, zhp: 654, zdmg: 63, density: 1.75, power: 93000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'The Plague Lord', hp: 182100, dmg: 97, color: '#9ad13b', size: 2.15, final: true } },
    ],
  },
  {
    id: 'ch5',
    name: 'Volcano Ridge',
    theme: {
      sky: ['#1f0a18', '#7a2230', '#ff7a2a'],
      sun: 'rgba(255,200,120,.9)',
      ground: ['#2e1a1a', '#ff5a1a'],
      shoulder: '#4a3030',
      road: '#3a2f38',
      curb: ['#ff8a1f', '#2b2342'],
      line: '#ffd23a',
      skyline: ['#3a1a1a', '#4a2222'],
      windows: null,
      menuGround: ['#4a2a2a', '#2e1a1a'],
      backdrop: 'volcano',
      skin: '#b88a7a',
      props: ['lavarock', 'lavarock', 'drum', 'tires', 'lavarock'],
    },
    levels: [
      { name: 'Ash Fields', length: 270, zhp: 862, zdmg: 56, density: 1.7, power: 100000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Ember Brute', hp: 173900, dmg: 79, color: '#c9805a', size: 1.65 } },
      { name: 'Magma Pass', length: 282, zhp: 925, zdmg: 59, density: 1.72, power: 108000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Magma Maw', hp: 195500, dmg: 85, color: '#d9703a', size: 1.7 } },
      { name: 'Obsidian Mine', length: 294, zhp: 996, zdmg: 62, density: 1.74, power: 117000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Obsidian Golem', hp: 228200, dmg: 92, color: '#6a5a6a', size: 1.75 } },
      { name: 'Fire Temple', length: 306, zhp: 1079, zdmg: 66, density: 1.76, power: 126000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Fire Priest', hp: 260800, dmg: 99, color: '#e08a4a', size: 1.8 } },
      { name: 'Molten Core', length: 318, zhp: 1178, zdmg: 69, density: 1.78, power: 136000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Lava Behemoth', hp: 293500, dmg: 105, color: '#c95a3a', size: 1.85 } },
      { name: 'Crater Throne', length: 330, zhp: 1283, zdmg: 74, density: 1.8, power: 147000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'The Inferno Emperor', hp: 369400, dmg: 115, color: '#ff6a3a', size: 2.15, final: true } },
    ],
  },
  {
    id: 'ch6',
    name: 'Neon Capital',
    theme: {
      sky: ['#0b0a2a', '#2a1a5a', '#7a2a9a'],
      sun: 'rgba(255,120,230,.8)',
      ground: ['#1a1840', '#221f50'],
      shoulder: '#3a3570',
      road: '#26234a',
      curb: ['#ff3dce', '#2fe0ff'],
      line: '#2fe0ff',
      skyline: ['#1a1640', '#231d58'],
      windows: '#ff5fd0',
      menuGround: ['#2a2660', '#1a1840'],
      backdrop: 'city',
      skin: '#b48ae0',
      props: ['lamp', 'car', 'lamp', 'cone', 'hydrant'],
    },
    levels: [
      { name: 'Downtown', length: 270, zhp: 1632, zdmg: 66, density: 1.75, power: 159000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Neon Brute', hp: 340200, dmg: 93, color: '#c08ae8', size: 1.65 } },
      { name: 'Neon Strip', length: 282, zhp: 1752, zdmg: 70, density: 1.77, power: 172000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Glitch', hp: 382800, dmg: 101, color: '#8ae0e8', size: 1.7 } },
      { name: 'Metro Station', length: 294, zhp: 1884, zdmg: 74, density: 1.79, power: 185000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Subway Terror', hp: 446400, dmg: 109, color: '#a07ad8', size: 1.75 } },
      { name: 'Skyscraper Row', length: 306, zhp: 2043, zdmg: 78, density: 1.8, power: 200000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Skyline Ripper', hp: 510300, dmg: 116, color: '#d08ae0', size: 1.8 } },
      { name: 'Tower Plaza', length: 318, zhp: 2229, zdmg: 81, density: 1.8, power: 216000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Royal Guard', hp: 574200, dmg: 124, color: '#9a6ae0', size: 1.85 } },
      { name: 'Zombie Capitol', length: 330, zhp: 2427, zdmg: 87, density: 1.8, power: 233000, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'The Zombie King', hp: 723000, dmg: 136, color: '#e05fd0', size: 2.15, final: true } },
    ],
  },
];

const ZOMBIE_TYPES = {
  walker: { hpMult: 1,   speed: 1.6, size: 1,    color: '#8fbf5a', score: 10 },
  runner: { hpMult: 0.7, speed: 4.4, size: 0.85, color: '#b5c95a', score: 12 },
  tank:   { hpMult: 3,   speed: 1.1, size: 1.35, color: '#6f9a74', score: 30 },
  armored: { hpMult: 2.2, speed: 1.3, size: 1.1, color: '#9ab872', score: 20, helmet: true },
  bomber:  { hpMult: 0.6, speed: 5.0, size: 0.8, color: '#a6c46a', score: 15, bomb: true, contact: 2.5 },
  // Special zombies, mixed in by level (see SPECIALS in game.js).
  spitter:  { hpMult: 1.2, speed: 1.1, size: 1,    color: '#e0763a', score: 20, spit: true },      // lobs fireballs down its lane
  hopper:   { hpMult: 0.8, speed: 1.8, size: 0.85, color: '#a878e0', score: 15, hop: true },       // the only one that changes lanes
  screamer: { hpMult: 1.3, speed: 1.2, size: 0.95, color: '#e2dcc4', score: 20, scream: true },    // speeds up its lane
  digger:   { hpMult: 1.4, speed: 2.2, size: 1,    color: '#9a8a55', score: 20, dig: true },       // tunnels underground, can't be shot
  shocker:  { hpMult: 1.2, speed: 1.0, size: 1,    color: '#6ec8f0', score: 20, zap: true },       // charges, then lightning strikes its lane
  brute:    { hpMult: 26,  speed: 0.8, size: 1.9,  color: '#7aa84a', score: 150, mini: true, contact: 8 }, // Fat Brute miniboss
};

const BOT_NAMES = [
  'ZedHunter', 'Sgt_Snow', 'CaptainCrunch', 'Nova', 'BulletBob', 'IceQueen', 'Rambo_Jr', 'FrostByte',
  'Kobra', 'MissFire', 'TankYou', 'Dr.Boom', 'PvtPuddle', 'Ghost', 'Maverick', 'Luna', 'Blitz',
  'SnowFox', 'Tiny', 'Major_Pain', 'Viper', 'Echo', 'Hawk', 'Bravo6', 'Pixel', 'Sarge', 'Rookie99',
  'Zulu', 'Tango', 'Nomad', 'Pebbles', 'Shadow', 'Rex', 'Duke', 'Waffles', 'Onyx', 'Scout', 'Fury',
  'Iceman', 'Blaze',
];

// In-level support calls. Each use costs one rewarded ad; there is no cooldown.
const ABILITIES = [
  { id: 'air', name: 'Airstrike', icon: 'jet', color: '#ff8a1f', desc: 'A jet drops 4 bombs on the horde.' },
  { id: 'tank', name: 'Tank', icon: 'tank', color: '#7fb04e', desc: 'A tank rolls in, shelling and crushing zombies.' },
  { id: 'heli', name: 'Helicopter', short: 'Heli', icon: 'heli', color: '#4f9cf0', desc: 'A gunship rains bullets for 8 seconds.' },
  { id: 'freeze', name: 'Freeze', icon: 'freeze', color: '#8fe0ff', desc: 'Everything freezes solid for 4 seconds.' },
];
