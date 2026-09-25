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
    theme: {
      sky: ['#4f8fe8', '#8fc4ff', '#d8ecff'], sun: 'rgba(255,250,220,.95)',
      ground: ['#48b83e', '#56c94a'], shoulder: '#98a4ef', road: '#a7abb4',
      curb: ['#ff4d5e', '#ffffff'], line: '#ffffff',
      skyline: ['#3b2a8f', '#4a35a8'], windows: '#ffd35a', menuGround: ['#7b86d6', '#5561b8'],
      props: [],
      bridge: true,
    },
    levels: [
      { name: 'Gas Station',  length: 200, zhp: 26, zdmg: 15, density: 1.0, power: 400, types: ['walker'],
        boss: { name: 'Brute',            hp: 1500,  dmg: 20, color: '#7dbb4a', size: 1.5 } },
      { name: 'Main Street',      length: 220, zhp: 32, zdmg: 18, density: 1.1, power: 650, types: ['walker', 'runner'],
        boss: { name: 'Chomper',          hp: 2500, dmg: 24, color: '#8cc63f', size: 1.55 } },
      { name: 'Broken Bridge',  length: 240, zhp: 38, zdmg: 21, density: 1.2, power: 1000, types: ['walker', 'runner'],
        boss: { name: 'Big Mouth',        hp: 3800, dmg: 28, color: '#6aa84f', size: 1.6 } },
      { name: 'Subway Tunnel',     length: 260, zhp: 50, zdmg: 25, density: 1.3, power: 1500, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Sewer Hulk',       hp: 6500, dmg: 32, color: '#5e9e6e', size: 1.7 } },
      { name: 'Toxic Factory',   length: 280, zhp: 64, zdmg: 29, density: 1.4, power: 2300, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Toxic Butcher',    hp: 9500, dmg: 37, color: '#a3d13b', size: 1.75 } },
      { name: 'City Hall', length: 300, zhp: 80, zdmg: 34, density: 1.5, power: 3400, types: ['walker', 'runner', 'tank'],
        boss: { name: 'Mayor Rot',        hp: 15000, dmg: 44, color: '#79b04a', size: 2.0, final: true } },
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
      mesas: true,
      props: ['cactus', 'cactus', 'rock', 'tires', 'drum', 'car', 'cone'],
    },
    levels: [
      { name: 'Dusty Outskirts', length: 260, zhp: 82,  zdmg: 34, density: 1.5,  power: 5000,  types: ['walker', 'runner', 'armored'],
        boss: { name: 'Sand Brute',   hp: 16000, dmg: 48, color: '#d4a84a', size: 1.6 } },
      { name: 'Cactus Canyon',   length: 270, zhp: 88,  zdmg: 36, density: 1.53, power: 6000,  types: ['walker', 'runner', 'armored', 'bomber'],
        boss: { name: 'Cactus Jack',  hp: 18000, dmg: 52, color: '#5fbf6a', size: 1.65 } },
      { name: 'Rusty Junkyard',  length: 280, zhp: 95, zdmg: 38, density: 1.56,  power: 7000,  types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Scrap King',   hp: 21000, dmg: 56, color: '#c77d45', size: 1.7 } },
      { name: 'Oil Refinery',    length: 290, zhp: 103, zdmg: 40, density: 1.59, power: 8200,  types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Oil Slick',    hp: 24000, dmg: 60, color: '#6f6a9a', size: 1.75 } },
      { name: 'Sandstorm Pass',  length: 300, zhp: 112, zdmg: 42, density: 1.62,  power: 9600,  types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'Dune Stalker', hp: 27000, dmg: 64, color: '#e08a4a', size: 1.8 } },
      { name: 'Warlord Fort',    length: 320, zhp: 122, zdmg: 45, density: 1.65, power: 11200, types: ['walker', 'runner', 'armored', 'bomber', 'tank'],
        boss: { name: 'The Warlord',  hp: 34000, dmg: 70, color: '#9a5fd6', size: 2.1, final: true } },
    ],
  },
];

const ZOMBIE_TYPES = {
  walker: { hpMult: 1,   speed: 1.6, size: 1,    color: '#f28a3c', score: 10 },
  runner: { hpMult: 0.6, speed: 4.0, size: 0.85, color: '#e8563a', score: 12 },
  tank:   { hpMult: 3,   speed: 1.1, size: 1.35, color: '#8cbf4a', score: 30 },
  armored: { hpMult: 2.2, speed: 1.3, size: 1.1, color: '#e0a04a', score: 20, helmet: true },
  bomber:  { hpMult: 0.5, speed: 4.6, size: 0.8, color: '#ff5a4a', score: 15, bomb: true, contact: 2.5 },
};

const BOT_NAMES = [
  'ZedHunter', 'Sgt_Snow', 'CaptainCrunch', 'Nova', 'BulletBob', 'IceQueen', 'Rambo_Jr', 'FrostByte',
  'Kobra', 'MissFire', 'TankYou', 'Dr.Boom', 'PvtPuddle', 'Ghost', 'Maverick', 'Luna', 'Blitz',
  'SnowFox', 'Tiny', 'Major_Pain', 'Viper', 'Echo', 'Hawk', 'Bravo6', 'Pixel', 'Sarge', 'Rookie99',
  'Zulu', 'Tango', 'Nomad', 'Pebbles', 'Shadow', 'Rex', 'Duke', 'Waffles', 'Onyx', 'Scout', 'Fury',
  'Iceman', 'Blaze',
];
