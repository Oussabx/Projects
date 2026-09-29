// Cartoon art: canvas drawing for characters/props and inline SVG icons.

const INK = '#1b1f2a';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function blob(ctx, fill, lw) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}

function limb(ctx, x1, y1, x2, y2, width, color, lw) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + lw * 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

// ---------- Soldier ----------
// All characters are drawn in a 100-unit tall box with feet at (0, 0).

const CAMO = '#56803d', CAMO_DARK = '#3e602b', SKIN = '#ffd9b3', HELMET = '#3f6b2e', HELMET_LIGHT = '#5d8f46';

function camoSpots(ctx, x, y, w, h) {
  ctx.fillStyle = CAMO_DARK;
  const spots = [[0.2, 0.3], [0.7, 0.2], [0.45, 0.65], [0.85, 0.7], [0.1, 0.8]];
  for (const [sx, sy] of spots) {
    ctx.beginPath();
    ctx.ellipse(x + w * sx, y + h * sy, w * 0.1, h * 0.09, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Realistic soldier (pre-rendered 3D sprite sheets) ----------
// back: 16-frame run seen from behind/above (lane squad + leader); front: 3/4 standing pose (menus);
// arena: 8 facing directions x 12 run frames seen from above (dir d faces 90deg + 45deg*d on screen).
const SOLDIER = {
  back:  { img: new Image(), ready: false, cols: 8, n: 16, fw: 200, fh: 250, foot: 224.9, modelH: 192.6 },
  front: { img: new Image(), ready: false, cols: 1, n: 1, fw: 320, fh: 400, foot: 371.8, modelH: 331 },
  arena: { img: new Image(), ready: false, cols: 12, n: 12, fw: 160, fh: 200, foot: 153.1, modelH: 102.4 },
};
// muzzle position per back-view frame (px inside the 200x250 frame)
const SOLDIER_MUZ = [[93.7,77.7],[92.9,76.6],[91,75.8],[88.5,75.3],[85.7,75.2],[83,75.6],[80.9,76.3],[79.6,77.3],[79.4,78.4],[80.3,76.6],[82.1,75.1],[84.6,73.9],[87.4,73.5],[90.1,73.7],[92.2,74.6],[93.5,76]];
// Off: the pilot model didn't look right in game. Flip to true once a better model/animation is rendered.
const USE_REAL_SOLDIER = false;
if (USE_REAL_SOLDIER) for (const [k, file] of [['back', 'soldier_back'], ['front', 'soldier_front'], ['arena', 'soldier_arena']]) {
  const sh = SOLDIER[k];
  sh.img.onload = () => { sh.ready = true; window.dispatchEvent(new Event('soldier-ready')); };
  sh.img.src = `assets/${file}.png`;
}
function soldierShadow(ctx, cx, footY, r) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(cx, footY, r, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
}
function soldierFrame(ctx, sh, i, row, cx, footY, k) {
  const col = row == null ? i % sh.cols : i;
  const r = row == null ? Math.floor(i / sh.cols) : row;
  ctx.drawImage(sh.img, col * sh.fw, r * sh.fh, sh.fw, sh.fh,
    cx - sh.fw / 2 * k, footY - sh.foot * k, sh.fw * k, sh.fh * k);
}
function muzzleFlash(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.4, 'rgba(255,200,70,.9)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
// Running away from the camera. phase in radians (matches the old sin(t*14 + phase) stride).
function drawSoldierRun(ctx, cx, footY, height, t, phase = 0, flash = 0) {
  const sh = SOLDIER.back, k = height * 1.08 / sh.modelH;
  const f = Math.floor((((t * 14 + phase) / (Math.PI * 2)) % 1 + 1) % 1 * sh.n) % sh.n;
  soldierShadow(ctx, cx, footY, sh.modelH * k * 0.2);
  soldierFrame(ctx, sh, f, null, cx, footY, k);
  if (flash > 0) {
    const [mx, my] = SOLDIER_MUZ[f];
    muzzleFlash(ctx, cx + (mx - sh.fw / 2) * k, footY + (my - sh.foot) * k - 6 * k, 30 * k);
  }
}
function drawSoldierStand(ctx, cx, footY, height, t = 0) {
  const sh = SOLDIER.front, k = height * 1.12 / sh.modelH;
  soldierShadow(ctx, cx, footY, sh.modelH * k * 0.2);
  ctx.save();
  // subtle breathing
  const b = 1 + Math.sin(t * 2.2) * 0.006;
  ctx.translate(cx, footY); ctx.scale(1, b); ctx.translate(-cx, -footY);
  soldierFrame(ctx, sh, 0, 0, cx, footY, k);
  ctx.restore();
}

function drawSoldierFront(ctx, cx, footY, height, t = 0) {
  if (SOLDIER.front.ready) return drawSoldierStand(ctx, cx, footY, height, t);
  const u = height / 100;
  const bob = Math.sin(t * 3) * 1.2;
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u, u);
  const lw = 2.6;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 6, 0, 0, Math.PI * 2); ctx.fill();

  // Boots & legs
  for (const s of [-1, 1]) {
    rr(ctx, s * 11 - 9, -30, 18, 22, 5); blob(ctx, CAMO, lw);
    rr(ctx, s * 11 - 10, -11, 20, 11, 5); blob(ctx, '#3b2a1e', lw);
  }

  ctx.translate(0, bob);
  // Left arm (hanging)
  limb(ctx, 20, -52, 25, -32, 10, CAMO, lw);
  ctx.beginPath(); ctx.arc(25, -30, 5.5, 0, Math.PI * 2); blob(ctx, SKIN, lw);

  // Torso
  rr(ctx, -22, -60, 44, 34, 11); blob(ctx, CAMO, lw);
  ctx.save(); rr(ctx, -22, -60, 44, 34, 11); ctx.clip(); camoSpots(ctx, -22, -60, 44, 34); ctx.restore();
  rr(ctx, -22, -60, 44, 34, 11); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // Straps + belt + pouches
  ctx.fillStyle = '#2c3a22';
  ctx.fillRect(-13, -60, 5, 30); ctx.fillRect(8, -60, 5, 30);
  rr(ctx, -22, -33, 44, 6, 2); blob(ctx, '#2c3a22', 0);
  rr(ctx, -4, -34, 8, 8, 2); blob(ctx, '#c9a44a', 1.5);

  // Right arm saluting
  limb(ctx, -19, -54, -34, -66, 10, CAMO, lw);
  limb(ctx, -34, -66, -24, -84, 9, CAMO, lw);
  ctx.beginPath(); ctx.ellipse(-21, -86, 6, 5, -0.6, 0, Math.PI * 2); blob(ctx, SKIN, lw);

  // Head
  ctx.beginPath(); ctx.arc(0, -76, 23, 0, Math.PI * 2); blob(ctx, SKIN, lw);
  // Blush
  ctx.fillStyle = 'rgba(255,120,120,.45)';
  ctx.beginPath(); ctx.ellipse(-13, -68, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13, -68, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(s * 8.5, -74, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s * 8.5 - 1.3, -76, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 4, -81); ctx.lineTo(s * 13, -83); ctx.stroke();
  }
  // Mouth
  ctx.beginPath(); ctx.moveTo(-3, -64); ctx.quadraticCurveTo(0, -65.5, 3, -64);
  ctx.lineWidth = 1.8; ctx.stroke();

  // Helmet
  ctx.beginPath();
  ctx.ellipse(0, -84, 30, 25, 0, Math.PI, 0);
  ctx.closePath();
  blob(ctx, HELMET, lw);
  ctx.beginPath(); ctx.ellipse(0, -84, 32, 6, 0, 0, Math.PI * 2); blob(ctx, HELMET, lw);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(-11, -100, 7, 4, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-1, -104, 2.4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawSoldierBack(ctx, cx, footY, height, t = 0, flash = 0, weapon = 'rifle') {
  if (SOLDIER.back.ready) return drawSoldierRun(ctx, cx, footY, height, t, 0, flash);
  const u = height / 100;
  const step = Math.sin(t * 14);
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u, u);
  const lw = 2.6;

  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Legs running
  for (const s of [-1, 1]) {
    const lift = Math.max(0, step * s) * 7;
    rr(ctx, s * 10 - 9, -30 - lift, 18, 20, 5); blob(ctx, CAMO, lw);
    rr(ctx, s * 10 - 10, -12 - lift, 20, 12, 5); blob(ctx, '#3b2a1e', lw);
  }

  const bob = Math.abs(step) * 2;
  ctx.translate(0, -bob);

  // Torso
  rr(ctx, -22, -60, 44, 34, 11); blob(ctx, CAMO, lw);
  ctx.save(); rr(ctx, -22, -60, 44, 34, 11); ctx.clip(); camoSpots(ctx, -22, -60, 44, 34); ctx.restore();

  // Arms reaching forward to the rifle
  limb(ctx, -19, -54, -8, -64, 10, CAMO, lw);
  limb(ctx, 19, -54, 22, -68, 10, CAMO, lw);

  // Backpack
  rr(ctx, -16, -58, 32, 26, 8); blob(ctx, '#8a6a3c', lw);
  rr(ctx, -12, -44, 24, 10, 4); blob(ctx, '#a07c47', 2);

  // Neck + helmet from behind
  ctx.beginPath(); ctx.ellipse(0, -62, 11, 5, 0, 0, Math.PI * 2); blob(ctx, SKIN, lw);
  ctx.beginPath(); ctx.ellipse(0, -76, 28, 22, 0, 0, Math.PI * 2); blob(ctx, HELMET, lw);
  ctx.beginPath(); ctx.ellipse(0, -66, 30, 6, 0, 0, Math.PI); blob(ctx, HELMET, lw);
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.beginPath(); ctx.ellipse(-9, -88, 8, 4, -0.4, 0, Math.PI * 2); ctx.fill();

  // Weapon held on the right shoulder, pointing forward (up the screen)
  const big = weapon === 'minigun' || weapon === 'rocket';
  const wl = big ? 78 : weapon === 'sniper' ? 70 : weapon === 'smg' ? 46 : 60;
  const wx = big ? 20 : 22;
  drawWeaponSide(ctx, weapon, wx, -72 - wl * 0.25, wl, { rot: -Math.PI / 2 });
  const tipY = -72 - wl * 0.25 - wl * 0.52;

  if (flash > 0) {
    ctx.save();
    ctx.translate(wx, tipY - 4);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 ? 5 : 13;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// Chibi hero for the top-down arena: turns toward where it aims, holds its weapon in both hands.
// aim: radians in screen space (0 = right, -PI/2 = up). walk: animation phase, moving: legs step.
function drawArenaHero(ctx, cx, footY, height, opts = {}) {
  const { aim = Math.PI / 2, walk = 0, moving = false, flash = 0, weapon = 'rifle' } = opts;
  if (SOLDIER.arena.ready) {
    const sh = SOLDIER.arena, k = height * 1.3 / sh.modelH;
    const d = ((Math.round((aim - Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
    const f = moving ? Math.floor(((walk / (Math.PI * 2)) % 1 + 1) % 1 * sh.n) % sh.n : 0;
    soldierShadow(ctx, cx, footY, height * 0.26);
    soldierFrame(ctx, sh, f, d, cx, footY, k);
    if (flash > 0) {
      const fx = Math.cos(aim), fy = Math.sin(aim);
      muzzleFlash(ctx, cx + fx * height * 0.5, footY - height * 0.5 + fy * height * 0.3, height * 0.16);
    }
    return;
  }
  const u = height / 100;
  const fx = Math.cos(aim), fy = Math.sin(aim);
  const back = fy < -0.3;                        // aiming away from the camera
  const side = fx >= 0 ? 1 : -1;
  const lw = 2.8;
  const step = moving ? Math.sin(walk) : 0;
  const bob = moving ? Math.abs(Math.cos(walk)) * 2.2 : Math.sin(walk * 0.3) * 0.6;

  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u, u);

  // Boots and legs, stepping
  for (const s of [-1, 1]) {
    const lift = Math.max(0, step * s) * 7, fwd = step * s * 2.5;
    rr(ctx, s * 9 - 7 + fwd * 0.3, -30 - lift, 14, 20, 5); blob(ctx, CAMO_DARK, lw);
    rr(ctx, s * 9 - 8.5 + fwd * 0.3, -13 - lift, 17, 11, 5); blob(ctx, '#3b2a1e', lw);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(s * 9 - 5 + fwd * 0.3, -11 - lift, 8, 2.5);
  }
  ctx.translate(0, -bob);

  // Weapon geometry: gripped at chest height, foreshortened when pointing toward or away from the camera.
  const big = weapon === 'minigun' || weapon === 'rocket';
  const len = big ? 74 : weapon === 'sniper' ? 70 : weapon === 'smg' ? 50 : 62;
  const gx = side * (back ? 11 : 6), gy = back ? -52 : -44;
  const shorten = 0.5 + 0.5 * Math.abs(fx);
  const drawGun = () => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(aim);
    ctx.scale(shorten, fx < 0 ? -1 : 1);
    drawWeaponSide(ctx, weapon, len * 0.2, 0, len);
    if (flash > 0) {
      const tip = len * 0.72;
      const g = ctx.createRadialGradient(tip, 0, 0, tip, 0, 16);
      g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.45, 'rgba(255,200,60,.95)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tip, 0, 16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  // Hands on the grip and the fore-grip, arms from the shoulders
  const hand1 = [gx + fx * 4 * shorten, gy + fy * 4];
  const hand2 = [gx + fx * 20 * shorten, gy + fy * 20 * 0.8];
  const drawArms = () => {
    limb(ctx, -side * 15, -54, hand1[0], hand1[1], 9, CAMO, lw);
    limb(ctx, side * 15, -54, hand2[0], hand2[1], 9, CAMO, lw);
    for (const [hx, hy] of [hand1, hand2]) { ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, Math.PI * 2); blob(ctx, SKIN, lw); }
  };

  if (back) { drawGun(); drawArms(); }

  // Torso: camo jacket, vest and belt
  rr(ctx, -19, -62, 38, 34, 11); blob(ctx, CAMO, lw);
  ctx.save(); rr(ctx, -19, -62, 38, 34, 11); ctx.clip(); camoSpots(ctx, -19, -62, 38, 34); ctx.restore();
  rr(ctx, -19, -62, 38, 34, 11); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  if (back) {
    // Backpack with bedroll
    rr(ctx, -14, -60, 28, 27, 7); blob(ctx, '#7a5a34', lw);
    rr(ctx, -12, -48, 24, 11, 4); blob(ctx, '#6a4c2a', 2);
    rr(ctx, -15, -66, 30, 8, 4); blob(ctx, '#4a6a8a', 2);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-10, -57, 12, 3);
  } else {
    ctx.fillStyle = '#2c3a22';
    ctx.fillRect(-12, -62, 5, 31); ctx.fillRect(7, -62, 5, 31);
    rr(ctx, -9, -50, 8, 9, 2); blob(ctx, '#4a5a2a', 1.8);
    rr(ctx, 1, -50, 8, 9, 2); blob(ctx, '#4a5a2a', 1.8);
  }
  rr(ctx, -19, -34, 38, 6, 2); blob(ctx, '#2c3a22', 0);
  rr(ctx, -4, -35, 8, 8, 2); blob(ctx, '#c9a44a', 1.5);

  // Head: big chibi head under a helmet
  const hx = back ? 0 : fx * 2.5;
  if (back) {
    // Back of the head: ears and short hair under the helmet
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 20, -76, 4.5, 6, 0, 0, Math.PI * 2); blob(ctx, SKIN, 2.2); }
    ctx.beginPath(); ctx.arc(0, -78, 20, 0, Math.PI * 2); blob(ctx, '#5a3d27', lw);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.6;
    for (const x of [-9, -3, 3, 9]) { ctx.beginPath(); ctx.moveTo(x, -72); ctx.lineTo(x * 0.8, -62); ctx.stroke(); }
    rr(ctx, -6, -63, 12, 6, 3); blob(ctx, SKIN, 2);
  } else {
    ctx.beginPath(); ctx.arc(hx, -78, 21, 0, Math.PI * 2); blob(ctx, SKIN, lw);
  }
  if (!back) {
    const ex = fx * 3.5, ey = fy * 1.5;
    ctx.fillStyle = 'rgba(255,120,120,.45)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * 12, -70, 4.5, 2.8, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const s of [-1, 1]) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(hx + s * 7.5 + ex, -76 + ey, 3.6, 4.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hx + s * 7.5 + ex - 1.2, -78 + ey, 1.5, 0, Math.PI * 2); ctx.fill();
      // Determined brows
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx + s * 3.5 + ex, -82 + ey); ctx.lineTo(hx + s * 11.5 + ex, -84.5 + ey); ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx - 3 + ex, -67); ctx.lineTo(hx + 3 + ex, -67.5); ctx.stroke();
  }
  // Helmet: dome with a rim and a shine
  ctx.beginPath(); ctx.ellipse(hx, back ? -80 : -85, 27, back ? 25 : 22, 0, Math.PI, 0); ctx.closePath(); blob(ctx, HELMET, lw);
  if (back) { ctx.beginPath(); ctx.ellipse(hx, -80, 27, 13, 0, 0, Math.PI); ctx.closePath(); blob(ctx, HELMET, lw); }
  ctx.beginPath(); ctx.ellipse(hx, back ? -80 : -85, 29, 5.5, 0, 0, Math.PI * 2); blob(ctx, HELMET_LIGHT, lw);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.ellipse(hx - 10, -98, 7, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,40,10,.35)';
  ctx.beginPath(); ctx.ellipse(hx + 8, -94, 4, 2.5, 0.3, 0, Math.PI * 2); ctx.ellipse(hx - 2, -88, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

  if (!back) { drawGun(); drawArms(); }
  ctx.restore();
}

// ---------- Zombies ----------

// Mix a hex color toward black (amt < 0) or white (amt > 0).
const _shadeCache = {};
function shadeHex(hex, amt) {
  const key = hex + amt;
  if (_shadeCache[key]) return _shadeCache[key];
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
  r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k);
  return (_shadeCache[key] = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1));
}

// ---------- 3D mutant (pre-rendered walk cycle) ----------
// assets/mutant_walk.png holds 16 frames of the rigged Mutant model walking toward the camera.
// Every zombie type is this mutant: a colour-tinted copy of the sheet plus a little gear.
// Walk sheet: Mixamo motion-captured zombie walk retargeted onto the Mutant model (v2).
// Set MUTANT_V1 = true to go back to the previous hand-animated sheet.
const MUTANT_V1 = false;
const MUTANT = MUTANT_V1
  ? { img: new Image(), ready: false, frames: 16, fw: 200, fh: 250, foot: 237.5, modelH: 212, speed: 1, sheets: {} }
  : { img: new Image(), ready: false, frames: 16, fw: 200, fh: 250, foot: 237.5, modelH: 201, speed: 0.55, sheets: {} };
MUTANT.img.onload = () => { MUTANT.ready = true; window.dispatchEvent(new Event('mutant-ready')); };
MUTANT.img.src = MUTANT_V1 ? 'assets/mutant_walk_v1.png' : 'assets/mutant_walk.png';

const MUTANT_TINT = {
  runner: 'saturate(1.15) brightness(1.05)',
  tank: 'saturate(.7) brightness(.7) contrast(1.15)',
  armored: 'saturate(.5) brightness(.9)',
  bomber: 'hue-rotate(-45deg) saturate(1.5)',
  spitter: 'hue-rotate(-75deg) saturate(2) brightness(1.05)',
  hopper: 'hue-rotate(185deg) saturate(1.4)',
  screamer: 'saturate(.1) brightness(1.4)',
  digger: 'sepia(.7) saturate(1.3) brightness(.8)',
  shocker: 'hue-rotate(115deg) saturate(1.6) brightness(1.1)',
  brute: 'hue-rotate(-30deg) saturate(1.5) brightness(.75) contrast(1.1)',
  flash: 'brightness(2) saturate(.4)',
  frozen: 'hue-rotate(115deg) saturate(.5) brightness(1.45)',
};
// Tinted sheets are built once per look and reused.
function mutantSheet(key) {
  if (!MUTANT_TINT[key]) return MUTANT.img;
  let s = MUTANT.sheets[key];
  if (!s) {
    s = document.createElement('canvas');
    s.width = MUTANT.img.width; s.height = MUTANT.img.height;
    const g = s.getContext('2d');
    g.filter = MUTANT_TINT[key];
    g.drawImage(MUTANT.img, 0, 0);
    MUTANT.sheets[key] = s;
  }
  return s;
}

// height: zombie size unit (the drawn figure is a bit taller). rate: walk cycles per second.
function drawMutant(ctx, cx, footY, height, t, opts = {}) {
  if (!MUTANT.ready) return;
  const { type = 'walker', flash = 0, frozen = false, rate = (type === 'runner' ? 1.4 : 0.9) * MUTANT.speed, seed = 0, wide = type === 'tank' ? 1.3 : type === 'brute' ? 1.35 : 1, charging = false } = opts;
  const k = height * 1.12 / MUTANT.modelH;
  const w = MUTANT.fw * k * wide, h = MUTANT.fh * k;
  const frame = Math.floor((((t + seed) * rate) % 1 + 1) % 1 * MUTANT.frames);
  // Soft contact shadow
  const g = ctx.createRadialGradient(cx, footY, 1, cx, footY, height * 0.42 * wide);
  g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, footY, height * 0.42 * wide, height * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  if (charging) {
    const cg = ctx.createRadialGradient(cx, footY - height * 0.6, 2, cx, footY - height * 0.6, height * 0.8);
    cg.addColorStop(0, 'rgba(190,240,255,.55)'); cg.addColorStop(1, 'rgba(190,240,255,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, footY - height * 0.6, height * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  const sheet = mutantSheet(flash > 0 ? 'flash' : frozen ? 'frozen' : type);
  ctx.drawImage(sheet, frame * MUTANT.fw, 0, MUTANT.fw, MUTANT.fh, cx - w / 2, footY - MUTANT.foot * k, w, h);
  if (flash > 0 || frozen) return;

  // Gear that marks the special types
  const H = MUTANT.modelH * k;
  const headY = footY - 0.925 * H, hr = 0.075 * H, mouthY = footY - 0.855 * H, chestY = footY - 0.69 * H;
  const lw = Math.max(1, H * 0.012);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#14132b'; ctx.lineWidth = lw;
  if (type === 'armored' || type === 'digger') {
    const mine = type === 'digger';
    const hg = ctx.createLinearGradient(cx - hr * 1.4, 0, cx + hr * 1.4, 0);
    hg.addColorStop(0, mine ? '#b88a00' : '#4a505c'); hg.addColorStop(0.4, mine ? '#ffd23a' : '#a8b0bc'); hg.addColorStop(1, mine ? '#8a6500' : '#3a3f4a');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(cx, headY - hr * 0.05, hr * 1.35, hr * 1.15, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, headY - hr * 0.05, hr * 1.6, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (mine) {
      ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(cx, headY - hr * 0.7, hr * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const lg = ctx.createRadialGradient(cx, headY - hr * 0.7, 1, cx, headY - hr * 0.7, hr * 2.2);
      lg.addColorStop(0, 'rgba(255,250,200,.6)'); lg.addColorStop(1, 'rgba(255,250,200,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, headY - hr * 0.7, hr * 2.2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === 'hopper') {
    ctx.fillStyle = '#e0303a';
    ctx.beginPath(); ctx.rect(cx - hr * 1.15, headY - hr * 0.35, hr * 2.3, hr * 0.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + hr * 1.1, headY - hr * 0.2); ctx.lineTo(cx + hr * 2, headY + hr * 0.3 + Math.sin(t * 12) * hr * 0.3); ctx.lineTo(cx + hr * 1.7, headY - hr * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (type === 'shocker') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cx + s * hr * 0.5, headY - hr * 0.8); ctx.lineTo(cx + s * hr * 1.1, headY - hr * 2.2); ctx.stroke();
      ctx.fillStyle = '#bfefff'; ctx.beginPath(); ctx.arc(cx + s * hr * 1.1, headY - hr * 2.3, hr * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = charging ? '#ffffff' : '#8fe8ff'; ctx.lineWidth = lw * (charging ? 1.6 : 1);
    ctx.beginPath(); ctx.moveTo(cx - hr * 1.1, headY - hr * 2.3);
    for (let i = 1; i <= 4; i++) ctx.lineTo(cx - hr * 1.1 + i * hr * 0.55, headY - hr * 2.3 + (Math.random() - 0.5) * hr * 0.9);
    ctx.stroke();
  } else if (type === 'bomber') {
    ctx.fillStyle = '#6b4a2b';
    ctx.beginPath(); ctx.rect(cx - H * 0.13, chestY - H * 0.05, H * 0.26, H * 0.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0303a';
    for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.rect(cx + d * H * 0.075 - H * 0.025, chestY - H * 0.08, H * 0.05, H * 0.15); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx, chestY - H * 0.08); ctx.quadraticCurveTo(cx + H * 0.04, chestY - H * 0.14, cx + H * 0.02, chestY - H * 0.17); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffe14d' : '#ff7a1a';
    ctx.beginPath(); ctx.arc(cx + H * 0.02, chestY - H * 0.175, H * 0.022, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'spitter') {
    const fl = 1 + Math.sin(t * 20) * 0.15;
    const sg = ctx.createRadialGradient(cx, mouthY, 1, cx, mouthY, hr * 1.8 * fl);
    sg.addColorStop(0, 'rgba(255,245,160,1)'); sg.addColorStop(0.35, 'rgba(255,150,40,.9)'); sg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, mouthY, hr * 1.8 * fl, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'screamer') {
    ctx.fillStyle = 'rgba(40,5,10,.85)';
    ctx.beginPath(); ctx.ellipse(cx, mouthY, hr * 0.45, hr * (0.55 + Math.abs(Math.sin(t * 8)) * 0.25), 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- Atmosphere for menu scenes ----------

// Moody colour grade, horizon haze and a vignette over a finished scene.
function moodPass(c, w, h, hz, opts = {}) {
  const { grade = 'rgba(70,60,95,1)', gradeAmt = 0.32, haze = '205,210,220', vignette = 0.5 } = opts;
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = gradeAmt; c.fillStyle = grade; c.fillRect(0, 0, w, h);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  const fg = c.createLinearGradient(0, hz - h * 0.14, 0, hz + h * 0.22);
  fg.addColorStop(0, `rgba(${haze},0)`); fg.addColorStop(0.45, `rgba(${haze},.42)`); fg.addColorStop(1, `rgba(${haze},0)`);
  c.fillStyle = fg; c.fillRect(0, hz - h * 0.14, w, h * 0.36);
  const vg = c.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(8,6,16,${vignette})`);
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
  c.restore();
}

// A dark blood pool on the ground (flattened by perspective).
function drawBloodPool(c, x, y, r, seed = 0) {
  c.save();
  c.fillStyle = 'rgba(88,8,12,.78)';
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = seed * 7 + i * 1.9, d = (0.3 + ((seed * 13 + i * 7) % 5) / 10) * r;
    const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d * 0.32, br = r * (0.35 + ((i * 3 + seed * 5) % 4) / 10);
    c.moveTo(bx + br, by); c.ellipse(bx, by, br, br * 0.32, 0, 0, Math.PI * 2);
  }
  c.fill();
  c.fillStyle = 'rgba(150,20,26,.4)';
  c.beginPath(); c.ellipse(x - r * 0.1, y - r * 0.05, r * 0.45, r * 0.13, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---------- Bosses ----------
// A hulking mutant: small hunched head, glowing eyes, roaring jaw, one or two mutated flesh arms with
// bone claws, torn vest, ripped jeans and spiked boots. Every boss mixes its own parts (see BOSS_LOOKS).

// arm: which arm is mutated (L, R or both). head: hair, mohawk, bald, horns, tophat, cowboy, bandana,
// hood, gasmask, helmet, visor, longhair, plague. chest: ribs, mouth, core, plates, stitches.
// growth: what bursts from the mutated shoulder. extra: accessories. crown: none, gold, junk, ice, fire.
const BOSS_LOOKS = {
  'Brute':               { arm: 'R', head: 'hair', chest: 'ribs', growth: 'bone', extra: [] },
  'Chomper':             { arm: 'L', head: 'bald', chest: 'stitches', growth: 'bone', extra: ['chains'], jaw: 'maw' },
  'Big Mouth':           { arm: 'R', head: 'mohawk', chest: 'mouth', growth: 'pustules', extra: [], jaw: 'maw' },
  'Sewer Hulk':          { arm: 'both', head: 'bald', chest: 'ribs', growth: 'pustules', extra: ['drip', 'chains'] },
  'Toxic Butcher':       { arm: 'L', head: 'bandana', chest: 'stitches', growth: 'bone', extra: ['cleaver', 'tank', 'apron'] },
  'Mayor Rot':           { arm: 'R', head: 'tophat', chest: 'core', growth: 'bone', extra: ['sash', 'cape'], crown: 'none' },
  'Sand Brute':          { arm: 'L', head: 'bandana', chest: 'ribs', growth: 'rock', extra: [] },
  'Cactus Jack':         { arm: 'R', head: 'cowboy', chest: 'stitches', growth: 'cactus', extra: ['chains'] },
  'Scrap King':          { arm: 'both', head: 'bald', chest: 'plates', growth: 'armor', extra: ['blades'], crown: 'junk' },
  'Oil Slick':           { arm: 'L', head: 'hair', chest: 'mouth', growth: 'pustules', extra: ['drip', 'tank'] },
  'Dune Stalker':        { arm: 'R', head: 'hood', chest: 'ribs', growth: 'bone', extra: ['blades'] },
  'The Warlord':         { arm: 'L', head: 'helmet', chest: 'plates', growth: 'armor', extra: ['chains', 'cape', 'cleaver'], crown: 'none' },
  'Yeti Brute':          { arm: 'R', head: 'longhair', chest: 'ribs', growth: 'ice', extra: ['fur'] },
  'Frostbite':           { arm: 'L', head: 'bald', chest: 'core', growth: 'ice', extra: ['fur'], three: true },
  'Ice Maw':             { arm: 'R', head: 'horns', chest: 'mouth', growth: 'ice', extra: [], jaw: 'maw' },
  'Snow Hulk':           { arm: 'both', head: 'hair', chest: 'ribs', growth: 'ice', extra: ['fur', 'chains'] },
  'Blizzard King':       { arm: 'L', head: 'longhair', chest: 'core', growth: 'ice', extra: ['cape', 'fur'], crown: 'ice' },
  'The Frost Titan':     { arm: 'both', head: 'horns', chest: 'plates', growth: 'ice', extra: ['cape', 'fur'], crown: 'ice' },
  'Bog Crawler':         { arm: 'R', head: 'longhair', chest: 'ribs', growth: 'pustules', extra: ['drip'] },
  'Sludge Belly':        { arm: 'L', head: 'bald', chest: 'mouth', growth: 'pustules', extra: ['drip', 'tank'] },
  'Swamp Hag':           { arm: 'R', head: 'longhair', chest: 'stitches', growth: 'bone', extra: ['drip', 'chains'], three: true },
  'Mutant Brute':        { arm: 'both', head: 'mohawk', chest: 'core', growth: 'pustules', extra: [], three: true },
  'Dr. Rot':             { arm: 'L', head: 'gasmask', chest: 'stitches', growth: 'bone', extra: ['tank', 'apron'] },
  'The Plague Lord':     { arm: 'both', head: 'plague', chest: 'core', growth: 'pustules', extra: ['cape', 'drip', 'chains'], crown: 'gold' },
  'Ember Brute':         { arm: 'R', head: 'hair', chest: 'ribs', growth: 'rock', extra: ['cracks'] },
  'Magma Maw':           { arm: 'L', head: 'horns', chest: 'mouth', growth: 'rock', extra: ['cracks'], jaw: 'maw' },
  'Obsidian Golem':      { arm: 'both', head: 'bald', chest: 'plates', growth: 'rock', extra: ['cracks'] },
  'Fire Priest':         { arm: 'R', head: 'hood', chest: 'core', growth: 'bone', extra: ['cracks', 'cape', 'chains'] },
  'Lava Behemoth':       { arm: 'both', head: 'horns', chest: 'core', growth: 'rock', extra: ['cracks', 'drip'] },
  'The Inferno Emperor': { arm: 'both', head: 'horns', chest: 'core', growth: 'rock', extra: ['cracks', 'cape'], crown: 'fire' },
  'Neon Brute':          { arm: 'R', head: 'mohawk', chest: 'ribs', growth: 'bone', extra: ['blades'] },
  'Glitch':              { arm: 'L', head: 'visor', chest: 'core', growth: 'armor', extra: ['blades'] },
  'Subway Terror':       { arm: 'R', head: 'gasmask', chest: 'ribs', growth: 'pustules', extra: ['chains', 'tank'] },
  'Skyline Ripper':      { arm: 'both', head: 'visor', chest: 'plates', growth: 'armor', extra: ['blades'] },
  'Royal Guard':         { arm: 'L', head: 'helmet', chest: 'plates', growth: 'armor', extra: ['cape', 'cleaver'] },
  'The Zombie King':     { arm: 'both', head: 'longhair', chest: 'core', growth: 'bone', extra: ['cape', 'chains', 'sash'], crown: 'gold' },
};

function bossLook(name, final) {
  let look = BOSS_LOOKS[name];
  if (!look) {
    // Unknown names still get a stable, distinct mix.
    let h = [...(name || 'boss')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
    const pickH = arr => arr[(h = (h * 1103515245 + 12345) >>> 0) % arr.length];
    look = { arm: pickH(['L', 'R', 'both']), head: pickH(['hair', 'mohawk', 'bald', 'horns', 'hood', 'gasmask', 'longhair']),
      chest: pickH(['ribs', 'mouth', 'core', 'plates', 'stitches']), growth: pickH(['bone', 'pustules', 'rock', 'armor']), extra: [pickH(['chains', 'drip', 'blades', 'tank'])] };
  }
  return { jaw: 'roar', three: false, crown: final ? 'gold' : 'none', ...look };
}

function drawBoss(ctx, cx, footY, height, t, opts = {}) {
  const { color = '#8fa585', flash = 0, name = '', final = false, rage = false, wide = 1.15 } = opts;
  const L = bossLook(name, final);
  // Hits flash bright instead of turning solid white, so the boss stays readable under fire.
  const hit = false;
  const W = c => hit ? '#ffffff' : c;
  const skin = W(color), skinDk = W(shadeHex(color, -0.3)), skinLt = W(shadeHex(color, 0.3)), sore = W(shadeHex(color, -0.45));
  const fire = L.extra.includes('cracks'), ice = L.growth === 'ice';
  const flesh = W(fire ? '#b0401e' : ice ? '#7a4a6a' : '#9a302a'), fleshDk = W(fire ? '#6a1e0a' : ice ? '#4a2a4a' : '#5e1a18');
  const bone = W(ice ? '#e8fbff' : '#f0e2c0'), denim = W('#34363f'), denimDk = W('#24252c'), leather = W('#4a3524');
  const glowC = fire ? '#ffb02e' : ice ? '#9fe8ff' : rage ? '#ff4a3a' : '#ffe680';
  const lw = 3;
  const walk = t * 3.2;
  const sw = Math.sin(walk);
  const breathe = Math.sin(t * 2.2) * 1.2;
  const u = height / 100;
  const mutL = L.arm === 'L' || L.arm === 'both', mutR = L.arm === 'R' || L.arm === 'both';

  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u * wide, u);
  if (flash > 0) ctx.filter = 'brightness(1.6) saturate(.7)';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(0, 0, 50, 8, 0, 0, Math.PI * 2); ctx.fill();

  // Cape behind the body
  if (L.extra.includes('cape')) {
    const capeC = W(fire ? '#8a1e1e' : ice ? '#2f5f9a' : final ? '#6a1e8a' : '#5a1e1e');
    ctx.beginPath();
    ctx.moveTo(-30, -80); ctx.quadraticCurveTo(-48, -40, -44 + sw * 2, -6);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-44 + i * 14.6 + sw * 2, -6 + (i % 2 ? -7 : 0));
    ctx.quadraticCurveTo(48, -40, 30, -80); ctx.closePath();
    blob(ctx, capeC, lw);
    ctx.fillStyle = hit ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.moveTo(10, -78); ctx.quadraticCurveTo(40, -40, 40, -10); ctx.lineTo(20, -8); ctx.quadraticCurveTo(24, -40, 10, -78); ctx.fill();
  }
  // Canister strapped to the back, poking over the shoulder
  if (L.extra.includes('tank')) {
    const tc = W(fire ? '#c05a2a' : '#5aa02a');
    rr(ctx, 6, -112, 20, 34, 8); blob(ctx, tc, lw);
    ctx.fillStyle = hit ? '#fff' : 'rgba(255,255,255,.35)'; ctx.fillRect(10, -106, 4, 22);
    rr(ctx, 11, -118, 10, 7, 2); blob(ctx, W('#5b6070'), 2);
    ctx.fillStyle = W('#ffd23a'); ctx.beginPath(); ctx.moveTo(16, -101); ctx.lineTo(21, -93); ctx.lineTo(11, -93); ctx.closePath(); ctx.fill();
  }

  // Legs: wide stance, ripped jeans, heavy spiked boots
  for (const s of [-1, 1]) {
    const lift = Math.max(0, sw * s) * 5;
    ctx.beginPath();
    ctx.moveTo(s * 5, -46); ctx.lineTo(s * 26, -46); ctx.lineTo(s * 25, -14 - lift);
    ctx.lineTo(s * 20, -11 - lift); ctx.lineTo(s * 15, -14 - lift); ctx.lineTo(s * 10, -11 - lift); ctx.lineTo(s * 6, -14 - lift);
    ctx.closePath(); blob(ctx, denim, lw);
    ctx.fillStyle = denimDk; ctx.fillRect(s * 15 - 1.5, -44, 3, 28 - lift);
    ctx.beginPath(); ctx.ellipse(s * 15, -28 - lift * 0.5, 5, 3.5, 0.3 * s, 0, Math.PI * 2); blob(ctx, skinDk, 2);
    // Boot
    const by = -lift;
    rr(ctx, s * 16 - 14, by - 16, 28, 14, 6); blob(ctx, leather, lw);
    rr(ctx, s * 16 - 15, by - 5, 30, 6, 3); blob(ctx, bone, 2.4);
    ctx.fillStyle = W('#9aa3ad');
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(s * 16 + k * 9 - 2.5, by - 1); ctx.lineTo(s * 16 + k * 9, by + 3); ctx.lineTo(s * 16 + k * 9 + 2.5, by - 1); ctx.fill(); }
    ctx.strokeStyle = W('#8a7a5a'); ctx.lineWidth = 1.5;
    for (const ly of [-13, -10]) { ctx.beginPath(); ctx.moveTo(s * 16 - 5, by + ly); ctx.lineTo(s * 16 + 5, by + ly); ctx.stroke(); }
  }
  // Belt with a hanging chain
  rr(ctx, -27, -50, 54, 8, 3); blob(ctx, leather, 2.4);
  rr(ctx, -5, -51, 10, 10, 2); blob(ctx, W('#c9a44a'), 2);
  ctx.strokeStyle = W('#9aa3ad'); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(10, -44); ctx.quadraticCurveTo(18, -30 + sw * 2, 26, -44); ctx.stroke();

  // Upper body leans forward and breathes
  ctx.translate(0, breathe * 0.5 - Math.abs(sw) * 1.5);

  // Hulking torso
  ctx.beginPath();
  ctx.moveTo(-24, -48);
  ctx.lineTo(-38, -76); ctx.quadraticCurveTo(-20, -92, 0, -90); ctx.quadraticCurveTo(20, -92, 38, -76);
  ctx.lineTo(24, -48); ctx.closePath();
  blob(ctx, skin, lw);
  ctx.save(); ctx.clip();
  ctx.fillStyle = skinDk; ctx.beginPath(); ctx.ellipse(26, -64, 14, 30, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skinLt; ctx.beginPath(); ctx.ellipse(-16, -80, 12, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Muscles: pecs and abs
  ctx.strokeStyle = W('rgba(20,30,20,.35)'); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-26, -72); ctx.quadraticCurveTo(-12, -64, 0, -72); ctx.quadraticCurveTo(12, -64, 26, -72); ctx.stroke();
  for (const y of [-62, -56]) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -50); ctx.stroke();
  ctx.fillStyle = sore;
  for (const [x, y, r] of [[-18, -60, 2.5], [14, -80, 2], [20, -54, 1.8]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // Torn vest hanging off the sides, plus a strap across the chest
  const vest = W(L.extra.includes('apron') ? '#d8d2c0' : '#b8ae96');
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 20, -89); ctx.lineTo(s * 37, -77); ctx.lineTo(s * 25, -49);
    ctx.lineTo(s * 20, -54); ctx.lineTo(s * 17, -50); ctx.lineTo(s * 14, -58); ctx.lineTo(s * 16, -70);
    ctx.closePath(); blob(ctx, vest, 2.4);
  }
  if (L.extra.includes('apron')) {
    // Butcher's apron, bloodied
    ctx.beginPath(); ctx.moveTo(-15, -70); ctx.lineTo(15, -70); ctx.lineTo(19, -30); ctx.lineTo(-19, -30); ctx.closePath(); blob(ctx, W('#e6e0d0'), 2.4);
    ctx.fillStyle = hit ? 'rgba(0,0,0,0)' : 'rgba(140,20,20,.7)';
    for (const [x, y, r] of [[-6, -58, 4], [7, -46, 5], [-10, -40, 3], [3, -64, 2.5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = leather; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-26, -84); ctx.lineTo(22, -50); ctx.stroke();
  if (L.extra.includes('sash')) {
    ctx.strokeStyle = W('#c0303a'); ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(24, -86); ctx.lineTo(-22, -50); ctx.stroke();
    ctx.fillStyle = W('#ffd23a'); ctx.beginPath(); ctx.arc(2, -68, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Chest: the mutation
  if (L.chest === 'ribs') {
    ctx.beginPath(); ctx.ellipse(-2, -64, 11, 9, 0, 0, Math.PI * 2); blob(ctx, W('#5a1a18'), 2.4);
    ctx.strokeStyle = bone; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const y of [-69, -64.5, -60]) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.quadraticCurveTo(-2, y - 3, 6, y); ctx.stroke(); }
  } else if (L.chest === 'mouth') {
    // A second mouth in the belly
    const o = 3 + Math.abs(Math.sin(t * 4)) * 4;
    ctx.beginPath(); ctx.ellipse(0, -60, 12, o, 0, 0, Math.PI * 2); blob(ctx, W('#3a0f12'), 2.4);
    ctx.fillStyle = bone;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 4.5 - 2, -60 - o + 0.5); ctx.lineTo(i * 4.5, -60 - o + 5); ctx.lineTo(i * 4.5 + 2, -60 - o + 0.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(i * 4.5 - 2, -60 + o - 0.5); ctx.lineTo(i * 4.5, -60 + o - 5); ctx.lineTo(i * 4.5 + 2, -60 + o - 0.5); ctx.fill();
    }
  } else if (L.chest === 'core') {
    const g = ctx.createRadialGradient(0, -64, 1, 0, -64, 12);
    g.addColorStop(0, hit ? '#fff' : '#ffffff'); g.addColorStop(0.35, hit ? '#fff' : glowC); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -64, 12 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = W('#3a1a18'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -64, 7, 0, Math.PI * 2); ctx.stroke();
  } else if (L.chest === 'plates') {
    const pc = W(fire ? '#3a3040' : ice ? '#bfe6f2' : '#6a7280');
    for (const [x, y] of [[-11, -76], [11, -76], [-8, -62], [8, -62]]) { rr(ctx, x - 8, y - 6, 16, 12, 3); blob(ctx, pc, 2.4); }
    ctx.fillStyle = W('#c9ced8'); for (const [x, y] of [[-15, -80], [15, -80], [-12, -66], [12, -66]]) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.strokeStyle = W('#4a1a1a'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -74); ctx.quadraticCurveTo(-2, -62, 10, -54); ctx.stroke();
    for (let i = 0; i < 5; i++) { const x = -10 + i * 5, y = -72 + i * 4.2; ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 3, y - 2); ctx.stroke(); }
  }
  if (L.extra.includes('chains')) {
    ctx.strokeStyle = W('#8a939e'); ctx.lineWidth = 2.6;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 7.5, -84 + i * 4, 3.4, 2, 0.5, 0, Math.PI * 2); ctx.stroke(); }
  }
  if (fire) {
    // Glowing magma cracks across the skin
    ctx.strokeStyle = hit ? '#fff' : `rgba(255,${150 + Math.sin(t * 5) * 40},40,.95)`; ctx.lineWidth = 2;
    for (const pts of [[[-30, -76], [-24, -70], [-27, -62]], [[18, -84], [24, -76], [20, -68], [26, -60]], [[-8, -52], [-2, -56], [6, -52]]]) {
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
  }

  // Arms. A mutated arm is a huge flesh mass with bone claws dragging near the ground.
  const drawArm = (s, mutated) => {
    const swing = Math.sin(walk + (s > 0 ? 0 : Math.PI)) * 3;
    if (mutated) {
      const ex = s * 50, ey = -50 + swing * 0.3, hx = s * 54 + swing * 0.5, hy = -18 + swing;
      // Swollen muscle masses: bicep and a huge forearm, over a thick core limb
      limb(ctx, s * 36, -74, ex, ey, 16, flesh, lw);
      limb(ctx, ex, ey, hx, hy, 14, flesh, lw);
      const mass = (x, y, rx, ry, rot) => {
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        if (hit) { blob(ctx, '#fff', lw); return; }
        const g = ctx.createRadialGradient(x - s * rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
        g.addColorStop(0, shadeHex(fire ? '#b0401e' : ice ? '#7a4a6a' : '#9a302a', 0.3)); g.addColorStop(0.6, flesh); g.addColorStop(1, fleshDk);
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
      };
      mass(s * 44, -62, 12, 15, s * 0.35);
      mass(s * 53, -36, 13, 17, -s * 0.1);
      // Patches of normal skin still clinging to the mutated arm
      ctx.save(); ctx.beginPath(); ctx.ellipse(s * 53, -36, 13, 17, -s * 0.1, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(s * 46, -42, 7, 10, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Muscle striations and veins
      ctx.strokeStyle = fleshDk; ctx.lineWidth = 1.6;
      for (const k of [-1, 0, 1]) {
        ctx.beginPath(); ctx.moveTo(s * (40 + k * 4), -72); ctx.quadraticCurveTo(s * (48 + k * 3), -62, s * (45 + k * 4), -50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * (50 + k * 4), -48); ctx.quadraticCurveTo(s * (58 + k * 3), -36, s * (54 + k * 3), -22); ctx.stroke();
      }
      ctx.fillStyle = bone;
      for (const [x, y, r] of [[s * 48, -66, 3], [s * 58, -42, 2.6], [s * 51, -28, 3.2], [s * 60, -30, 2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = fleshDk; ctx.lineWidth = 1.2; ctx.stroke(); }
      if (!hit) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(s * 41, -67, 3, 6, s * 0.4, 0, Math.PI * 2); ctx.ellipse(s * 49, -42, 3, 7, 0, 0, Math.PI * 2); ctx.fill(); }
      // Big claw hand
      ctx.beginPath(); ctx.ellipse(hx, hy + 2, 13, 10, 0, 0, Math.PI * 2); blob(ctx, flesh, lw);
      for (let k = 0; k < 4; k++) {
        const fx = hx + (k - 1.5) * 6.5, tip = hy + 20 + (k === 0 || k === 3 ? -3 : 0);
        ctx.beginPath(); ctx.moveTo(fx - 3.2, hy + 6); ctx.quadraticCurveTo(fx + s * 2, hy + 14, fx + (k - 1.5) * 1.5, tip); ctx.lineTo(fx + 3.2, hy + 7); ctx.closePath();
        blob(ctx, bone, 2.2);
      }
      if (L.extra.includes('blades')) {
        ctx.beginPath(); ctx.moveTo(ex + s * 6, ey - 4); ctx.lineTo(ex + s * 26, ey + 6); ctx.lineTo(ex + s * 6, ey + 8); ctx.closePath(); blob(ctx, W('#c9ced8'), 2.2);
      }
    } else {
      const ex = s * 44, ey = -56 + swing * 0.3, hx = s * 42 + swing * 0.4, hy = -34 + swing;
      limb(ctx, s * 32, -76, ex, ey, 16, skin, lw);
      limb(ctx, ex, ey, hx, hy, 14, skin, lw);
      ctx.fillStyle = sore; ctx.beginPath(); ctx.arc(ex, ey, 2.4, 0, Math.PI * 2); ctx.fill();
      rr(ctx, hx - 9, hy - 9, 18, 7, 2); blob(ctx, leather, 2.2);
      ctx.fillStyle = W('#9aa3ad'); for (const k of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(hx + k, hy - 5.5, 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(hx, hy + 3, 9, 7, 0, 0, Math.PI * 2); blob(ctx, skin, lw);
      for (let k = 0; k < 4; k++) {
        const fx = hx + (k - 1.5) * 4.2;
        limb(ctx, fx, hy + 6, fx + (k - 1.5) * 1.2, hy + 14, 3.4, skin, 1.8);
        ctx.fillStyle = bone; ctx.beginPath(); ctx.arc(fx + (k - 1.5) * 1.2, hy + 15, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      if (L.extra.includes('cleaver')) {
        // Rusty cleaver gripped in the normal hand
        ctx.save(); ctx.translate(hx, hy + 6); ctx.rotate(s * 0.25);
        rr(ctx, -3, -4, 6, 16, 2); blob(ctx, leather, 2);
        ctx.beginPath(); ctx.moveTo(-4 * s, 10); ctx.lineTo(18 * s, 10); ctx.lineTo(20 * s, 34); ctx.lineTo(-4 * s, 30); ctx.closePath();
        ctx.fillStyle = W('#aab2bc'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.fillStyle = hit ? 'rgba(0,0,0,0)' : 'rgba(140,20,20,.75)'; ctx.beginPath(); ctx.arc(12 * s, 28, 4, 0, Math.PI * 2); ctx.arc(6 * s, 30, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  };
  drawArm(-1, mutL);
  drawArm(1, mutR);

  // What erupts from each mutated shoulder
  const growth = s => {
    const gx = s * 34, gy = -80;
    ctx.beginPath(); ctx.ellipse(gx, gy + 4, 17, 14, 0, 0, Math.PI * 2); blob(ctx, L.growth === 'armor' ? W('#6a7280') : L.growth === 'rock' ? W('#4a4048') : flesh, lw);
    if (L.growth === 'bone' || L.growth === 'pustules') {
      ctx.fillStyle = bone;
      for (const [x, y, r] of [[gx - s * 6, gy + 8, 3], [gx + s * 8, gy + 2, 2.5], [gx, gy - 2, 2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    const spikes = L.growth === 'pustules' ? [] : [[-0.5, 22], [0.1, 28], [0.7, 20]];
    for (const [a, len] of spikes) {
      const bx = gx + Math.sin(a) * 8 * s, byy = gy - 4;
      const tx = bx + Math.sin(a + 0.3 * s) * len * s, ty = byy - Math.cos(a) * len;
      ctx.beginPath(); ctx.moveTo(bx - 4, byy + 2); ctx.lineTo(tx, ty); ctx.lineTo(bx + 4, byy + 2); ctx.closePath();
      if (L.growth === 'ice') { ctx.fillStyle = W('rgba(190,240,255,.95)'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
      else if (L.growth === 'cactus') { blob(ctx, W('#4f9a4a'), 2.2); }
      else if (L.growth === 'rock') { blob(ctx, W(fire ? '#2a2028' : '#6a5a50'), 2.2); }
      else if (L.growth === 'armor') { blob(ctx, W('#aab2bc'), 2.2); }
      else blob(ctx, bone, 2.2);
    }
    if (L.growth === 'cactus') { ctx.strokeStyle = W('#f0e6c0'); ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { const x = gx + (k - 2.5) * 5, y = gy + (k % 2) * 6 - 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 3, y - 3); ctx.stroke(); } }
    if (L.growth === 'pustules') {
      for (const [x, y, r] of [[gx - s * 4, gy - 8, 5], [gx + s * 9, gy - 4, 4], [gx + s * 2, gy - 14, 3.4]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); blob(ctx, W('#e8d890'), 1.8);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  if (mutL) growth(-1);
  if (mutR) growth(1);
  if (L.growth === 'armor' && !(mutL && mutR)) {
    // Normal shoulder gets a metal pauldron too
    const s = mutL ? 1 : -1;
    ctx.beginPath(); ctx.ellipse(s * 30, -80, 13, 9, 0, Math.PI, 0); ctx.closePath(); blob(ctx, W('#8a939e'), 2.4);
  }
  if (L.extra.includes('fur')) {
    // Fur collar
    ctx.fillStyle = W('#e8eef2'); ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI, rr2 = i % 2 ? 26 : 32; ctx.lineTo(Math.cos(a) * rr2, -84 + Math.sin(a) * rr2 * 0.35 + 6); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Head: small, hunched low between the shoulders
  ctx.save();
  ctx.translate(0, -92);
  ctx.rotate(Math.sin(walk * 0.5) * 0.08);
  const skull = () => {
    ctx.beginPath();
    ctx.moveTo(-14, -2); ctx.bezierCurveTo(-17, -24, 17, -24, 14, -2);
    ctx.lineTo(16, 8); ctx.bezierCurveTo(14, 18, -14, 18, -16, 8); ctx.closePath();
  };
  if (L.head === 'longhair') {
    // Stringy locks hanging past the jaw
    ctx.fillStyle = W(ice ? '#e8eef2' : '#3a2a22');
    ctx.beginPath(); ctx.moveTo(-15, -14);
    ctx.quadraticCurveTo(-24, 4, -21, 24);
    for (const [x, y] of [[-17, 17], [-15, 27], [-11, 16], [11, 16], [15, 27], [17, 17]]) ctx.lineTo(x, y);
    ctx.lineTo(21, 24); ctx.quadraticCurveTo(24, 4, 15, -14); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
  }
  skull(); blob(ctx, skin, lw);
  ctx.save(); skull(); ctx.clip();
  ctx.fillStyle = skinDk; ctx.beginPath(); ctx.ellipse(11, 2, 8, 20, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,20,.18)'; ctx.beginPath(); ctx.ellipse(-9, 6, 4, 6, 0.3, 0, Math.PI * 2); ctx.ellipse(9, 6, 4, 6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  skull(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();

  // Glowing eyes (a third one for the worst mutants)
  const eyes = L.three ? [[-6.5, -5, 3.6], [6.5, -5, 3.6], [0, -12, 3]] : [[-6.5, -5, 4], [6.5, -5, 4]];
  if (!['gasmask', 'visor', 'plague'].includes(L.head)) {
    for (const [ex, ey, er] of eyes) {
      ctx.fillStyle = hit ? '#ddd' : shadeHex(color, -0.65);
      ctx.beginPath(); ctx.ellipse(ex, ey, er + 2.5, er + 2, 0, 0, Math.PI * 2); ctx.fill();
      if (!hit) {
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 2.4);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.3, glowC); g.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, er * 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); blob(ctx, hit ? '#fff' : '#fff6c8', 1.6);
      ctx.fillStyle = rage ? '#c0141e' : '#3a2a10'; ctx.beginPath(); ctx.arc(ex, ey + 0.4, er * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // Furious brow
    ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-13, -12); ctx.lineTo(-2, -8); ctx.moveTo(2, -8); ctx.lineTo(13, -12); ctx.stroke();
  }

  // Jaw: roaring, or a huge unhinged maw
  const maw = L.jaw === 'maw';
  const open = (maw ? 8 : 5) + Math.abs(Math.sin(t * 3.5)) * (maw ? 6 : 3);
  if (!['gasmask', 'plague', 'bandana'].includes(L.head)) {
    const mw = maw ? 13 : 10;
    ctx.beginPath();
    ctx.moveTo(-mw, 3); ctx.quadraticCurveTo(0, 1, mw, 3);
    ctx.quadraticCurveTo(mw - 1, 4 + open, 0, 5 + open); ctx.quadraticCurveTo(-mw + 1, 4 + open, -mw, 3);
    ctx.closePath(); blob(ctx, hit ? '#ddd' : '#3a0f12', 2.2);
    ctx.fillStyle = bone;
    const n = maw ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const x = -mw + 2 + i * ((mw * 2 - 4) / (n - 1)), fang = i === 1 || i === n - 2;
      ctx.beginPath(); ctx.moveTo(x - 1.6, 3); ctx.lineTo(x, 3 + (fang ? 5 : 3)); ctx.lineTo(x + 1.6, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 1.4, 5 + open); ctx.lineTo(x, 5 + open - (fang ? 5 : 2.6)); ctx.lineTo(x + 1.4, 5 + open); ctx.fill();
    }
    if (ice && maw) { ctx.fillStyle = W('#dff8ff'); for (const x of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x - 2, 6 + open); ctx.lineTo(x, 13 + open); ctx.lineTo(x + 2, 6 + open); ctx.fill(); } }
    if (!hit && (L.extra.includes('drip') || maw)) {
      const dr = (t * 1.2) % 1;
      ctx.fillStyle = fire ? 'rgba(255,150,40,.9)' : L.extra.includes('drip') && L.growth === 'pustules' ? 'rgba(40,40,50,.85)' : 'rgba(170,220,120,.85)';
      ctx.beginPath(); ctx.ellipse(5, 7 + open + dr * 7, 1.6, 2.2 + dr * 2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Headgear
  const hair = W('#2a2220');
  if (L.head === 'longhair') {
    ctx.fillStyle = W(ice ? '#e8eef2' : '#3a2a22');
    ctx.beginPath(); ctx.moveTo(-15, -6); ctx.quadraticCurveTo(-16, -24, 0, -23); ctx.quadraticCurveTo(16, -24, 15, -6);
    for (const [x, y] of [[11, -12], [7, -8], [3, -13], [-2, -9], [-6, -13], [-10, -8]]) ctx.lineTo(x, y);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  } else if (L.head === 'hair') {
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-15, -10);
    for (const [x, y] of [[-16, -22], [-9, -17], [-6, -26], [0, -18], [5, -27], [8, -18], [14, -24], [15, -10]]) ctx.lineTo(x, y);
    ctx.quadraticCurveTo(0, -16, -15, -10); ctx.fill();
  } else if (L.head === 'mohawk') {
    const mc = W(color === '#c08ae8' ? '#ff4df0' : fire ? '#ff6a1a' : '#e0303a');
    ctx.beginPath(); ctx.moveTo(-4, -17);
    for (let i = 0; i < 6; i++) { ctx.lineTo(-4 + i * 1.6, -30 - (i % 2) * 6); ctx.lineTo(-3 + i * 1.6, -19); }
    ctx.lineTo(5, -17); ctx.closePath(); blob(ctx, mc, 2);
  } else if (L.head === 'bald') {
    ctx.strokeStyle = W('#4a1a1a'); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(4, -20); ctx.stroke();
    for (let i = 0; i < 4; i++) { const x = -8 + i * 3.8; ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 1, -15); ctx.stroke(); }
  } else if (L.head === 'horns') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 9, -16); ctx.quadraticCurveTo(s * 26, -18, s * 24, -36); ctx.quadraticCurveTo(s * 18, -24, s * 5, -20); ctx.closePath();
      blob(ctx, fire ? W('#2a2028') : ice ? W('#dff8ff') : bone, 2.2);
    }
  } else if (L.head === 'tophat') {
    rr(ctx, -12, -44, 24, 26, 3); blob(ctx, W('#1b1f2a'), 2.4);
    ctx.fillStyle = W('#c0303a'); ctx.fillRect(-12, -24, 24, 4);
    ctx.beginPath(); ctx.ellipse(0, -18, 20, 4, 0, 0, Math.PI * 2); blob(ctx, W('#1b1f2a'), 2.4);
  } else if (L.head === 'cowboy') {
    ctx.beginPath(); ctx.ellipse(0, -16, 26, 6, 0, 0, Math.PI * 2); blob(ctx, W('#8a5530'), 2.4);
    ctx.beginPath(); ctx.moveTo(-12, -16); ctx.quadraticCurveTo(-12, -34, 0, -30); ctx.quadraticCurveTo(12, -34, 12, -16); ctx.closePath(); blob(ctx, W('#9a6538'), 2.4);
    ctx.fillStyle = W('#3a2a1a'); ctx.fillRect(-12, -20, 24, 3);
  } else if (L.head === 'bandana') {
    ctx.fillStyle = W(L.extra.includes('apron') ? '#e6e0d0' : '#c0303a');
    ctx.beginPath(); ctx.moveTo(-15, 1); ctx.quadraticCurveTo(0, -2, 15, 1); ctx.lineTo(10, 16); ctx.lineTo(0, 20); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(0, -26, 14, -12); ctx.quadraticCurveTo(0, -18, -14, -12); ctx.fill();
  } else if (L.head === 'hood') {
    const hc = W(fire ? '#5a1414' : '#5a4a3a');
    ctx.beginPath(); ctx.moveTo(-20, 14); ctx.quadraticCurveTo(-24, -30, 0, -30); ctx.quadraticCurveTo(24, -30, 20, 14); ctx.lineTo(14, 12); ctx.quadraticCurveTo(16, -18, 0, -19); ctx.quadraticCurveTo(-16, -18, -14, 12); ctx.closePath();
    blob(ctx, hc, 2.4);
  } else if (L.head === 'gasmask' || L.head === 'plague') {
    const plague = L.head === 'plague';
    ctx.beginPath(); ctx.ellipse(0, -1, 15, 13, 0, 0, Math.PI * 2); blob(ctx, W(plague ? '#2a2420' : '#3f4a3a'), 2.4);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * 6.5, -5, 4.6, 0, Math.PI * 2); blob(ctx, W('#9aa3ad'), 2);
      if (!hit) { const g = ctx.createRadialGradient(s * 6.5, -5, 0, s * 6.5, -5, 4); g.addColorStop(0, '#fff'); g.addColorStop(0.5, glowC); g.addColorStop(1, 'rgba(255,230,120,.4)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s * 6.5, -5, 3.6, 0, Math.PI * 2); ctx.fill(); }
    }
    if (plague) {
      // Long plague-doctor beak
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.quadraticCurveTo(0, 26, 2, 30); ctx.quadraticCurveTo(6, 18, 5, 2); ctx.closePath(); blob(ctx, W('#3a302a'), 2.2);
      ctx.beginPath(); ctx.ellipse(0, -16, 22, 5, 0, 0, Math.PI * 2); blob(ctx, W('#1b1f2a'), 2.2);
      rr(ctx, -12, -30, 24, 14, 3); blob(ctx, W('#1b1f2a'), 2.2);
    } else {
      rr(ctx, -5, 3, 10, 10, 3); blob(ctx, W('#2a2d33'), 2);
      ctx.fillStyle = W('#9aa3ad'); for (const y of [6, 9]) ctx.fillRect(-4, y, 8, 1.3);
      ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(0, -26, 14, -12); ctx.quadraticCurveTo(0, -17, -14, -12); ctx.fill();
    }
  } else if (L.head === 'helmet') {
    const royal = L.extra.includes('cleaver') && L.extra.includes('cape') && !L.extra.includes('chains');
    ctx.beginPath(); ctx.moveTo(-17, -2); ctx.quadraticCurveTo(-18, -26, 0, -27); ctx.quadraticCurveTo(18, -26, 17, -2); ctx.lineTo(9, -2); ctx.lineTo(9, -8); ctx.lineTo(-9, -8); ctx.lineTo(-9, -2); ctx.closePath();
    blob(ctx, W(royal ? '#c9a44a' : '#6a7280'), 2.4);
    if (royal) { ctx.fillStyle = W('#e0303a'); ctx.beginPath(); ctx.moveTo(-2, -27); ctx.quadraticCurveTo(0, -42, 8, -44); ctx.quadraticCurveTo(4, -34, 3, -27); ctx.fill(); }
    else for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 13, -18); ctx.quadraticCurveTo(s * 30, -22, s * 28, -40); ctx.quadraticCurveTo(s * 22, -28, s * 10, -24); ctx.closePath(); blob(ctx, bone, 2.2); }
  } else if (L.head === 'visor') {
    rr(ctx, -16, -10, 32, 9, 4); blob(ctx, W('#1b1f2a'), 2.2);
    if (!hit) {
      const g = ctx.createLinearGradient(-15, 0, 15, 0);
      g.addColorStop(0, '#2fe0ff'); g.addColorStop(0.5, '#ff4df0'); g.addColorStop(1, '#2fe0ff');
      ctx.fillStyle = g; ctx.fillRect(-14, -8 + (Math.random() < 0.08 ? 1 : 0), 28, 4);
    }
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(0, -26, 14, -12); ctx.quadraticCurveTo(0, -18, -14, -12); ctx.fill();
  }

  // Crowns for chapter bosses
  if (L.crown === 'gold' || L.crown === 'junk' || L.crown === 'ice' || L.crown === 'fire') {
    const cy = L.head === 'longhair' || L.head === 'bald' ? -18 : L.head === 'horns' ? -20 : -22;
    if (L.crown === 'fire') {
      for (let i = -2; i <= 2; i++) {
        const fh = 12 + Math.sin(t * 9 + i) * 3 + (i === 0 ? 5 : 0);
        ctx.fillStyle = hit ? '#fff' : i % 2 ? '#ffd23a' : '#ff6a1a';
        ctx.beginPath(); ctx.moveTo(i * 5 - 4, cy); ctx.quadraticCurveTo(i * 5 - 3, cy - fh * 0.6, i * 5, cy - fh); ctx.quadraticCurveTo(i * 5 + 3, cy - fh * 0.6, i * 5 + 4, cy); ctx.fill();
      }
      rr(ctx, -13, cy - 3, 26, 6, 2); blob(ctx, W('#2a2028'), 2);
    } else {
      const cc = W(L.crown === 'ice' ? '#bfeefc' : L.crown === 'junk' ? '#8a939e' : '#ffc632');
      ctx.beginPath(); ctx.moveTo(-13, cy);
      const pts = L.crown === 'junk' ? [[-12, cy - 9], [-7, cy - 5], [-3, cy - 13], [2, cy - 6], [6, cy - 11], [10, cy - 4], [13, cy - 10]]
        : [[-13, cy - 12], [-7, cy - 6], [0, cy - 15], [7, cy - 6], [13, cy - 12]];
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(13, cy); ctx.closePath(); blob(ctx, cc, 2.4);
      ctx.fillStyle = W(L.crown === 'ice' ? '#5fa0e8' : '#e0303a');
      ctx.beginPath(); ctx.arc(0, cy - 4, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Final bosses glow with power
  if (final && !hit) {
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4);
    const g = ctx.createRadialGradient(0, -60, 10, 0, -60, 70);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, glowC); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -60, 70, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Circular saw half-sunk in a floor slot, spinning, throwing sparks. blood: 0..1 after it hits the squad.
function drawSaw(ctx, x, footY, R, t, blood = 0) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x - R * 1.6, footY - R * 2.4, R * 3.2, R * 2.4 + R * 0.05); ctx.clip();
  const cy = footY + R * 0.28;
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(t * 16);
  const n = 18;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 0.55) / n * Math.PI * 2, c = (i + 1) / n * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84);
    ctx.lineTo(Math.cos(b) * R * 1.04, Math.sin(b) * R * 1.04);
    ctx.lineTo(Math.cos(c) * R * 0.86, Math.sin(c) * R * 0.86);
  }
  ctx.closePath();
  ctx.fillStyle = '#b8c0cc'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, R * 0.06); ctx.stroke();
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.05, 0, 0, R * 0.86);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#c9d0da'); g.addColorStop(1, '#6a727e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,19,43,.5)'; ctx.lineWidth = Math.max(1, R * 0.03);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
  if (blood > 0) {
    ctx.fillStyle = `rgba(170,20,30,${0.75 * blood})`;
    for (let k = 0; k < 5; k++) { const a = k * 1.3; ctx.beginPath(); ctx.ellipse(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.16, R * 0.08, a, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = '#2d3140';
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, R * 0.08, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2); ctx.fillStyle = '#e0303a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, R * 0.05); ctx.stroke();
  ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 0, R * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Speed blur on the rim
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1.5, R * 0.08);
  ctx.beginPath(); ctx.arc(x, cy, R * 0.94, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
  // Sparks where the blade meets the slot
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const sd = Math.random() < 0.5 ? -1 : 1, ax = x + sd * R * (0.5 + Math.random() * 0.3), len = R * (0.3 + Math.random() * 0.5);
    ctx.strokeStyle = Math.random() < 0.5 ? '#ffe14d' : '#ffb02e'; ctx.lineWidth = Math.max(1, R * 0.05);
    ctx.beginPath(); ctx.moveTo(ax, footY - R * 0.05); ctx.lineTo(ax + sd * len, footY - len * 0.7); ctx.stroke();
  }
  ctx.restore();
}

// ---------- Props ----------

function drawBarrel(ctx, cx, footY, w, h, hp) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, w / 36);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, w * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // Bulging wooden body
  ctx.beginPath();
  ctx.moveTo(-w * 0.44, 0);
  ctx.quadraticCurveTo(-w * 0.56, -h * 0.5, -w * 0.44, -h);
  ctx.lineTo(w * 0.44, -h);
  ctx.quadraticCurveTo(w * 0.56, -h * 0.5, w * 0.44, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#9a5a2a'); g.addColorStop(0.35, '#d99a55'); g.addColorStop(1, '#8a4f22');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // Staves
  ctx.strokeStyle = 'rgba(90,45,15,.45)'; ctx.lineWidth = lw * 0.7;
  for (const f of [-0.25, 0, 0.25]) { ctx.beginPath(); ctx.moveTo(w * f, -h * 0.02); ctx.quadraticCurveTo(w * f * 1.2, -h * 0.5, w * f, -h * 0.98); ctx.stroke(); }
  // Metal hoops
  ctx.fillStyle = '#5b5f6e';
  for (const f of [0.18, 0.82]) { ctx.beginPath(); ctx.ellipse(0, -h * f, w * 0.52, h * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0, -h, w * 0.44, w * 0.1, 0, 0, Math.PI * 2); blob(ctx, '#c98b4a', lw);
  if (hp !== '') {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, w / 14);
    ctx.lineJoin = 'round';
    ctx.font = `900 ${Math.round(h * 0.36)}px "Lilita One", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(hp, 0, -h * 0.5);
    ctx.fillText(hp, 0, -h * 0.5);
  }
  ctx.restore();
}

function drawGate(ctx, x1, x2, footY, h, label, good, hp) {
  ctx.save();
  const w = x2 - x1;
  const top = footY - h;
  const grad = ctx.createLinearGradient(0, top, 0, footY);
  if (good) { grad.addColorStop(0, 'rgba(70,170,255,.85)'); grad.addColorStop(1, 'rgba(40,110,230,.45)'); }
  else { grad.addColorStop(0, 'rgba(255,90,90,.85)'); grad.addColorStop(1, 'rgba(220,40,60,.45)'); }
  rr(ctx, x1, top, w, h, Math.min(10, w * 0.08));
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = Math.max(2, w / 45); ctx.strokeStyle = good ? '#bfe3ff' : '#ffd0d0'; ctx.stroke();
  if (hp) {
    // Shootable sign: damage drains a bright fill from the top, with an HP pill below the label.
    const lost = 1 - Math.max(0, hp.frac);
    ctx.save();
    rr(ctx, x1, top, w, h, Math.min(10, w * 0.08)); ctx.clip();
    ctx.fillStyle = 'rgba(10,20,60,.45)';
    ctx.fillRect(x1, top, w, h * lost);
    if (hp.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${hp.flash * 4})`; ctx.fillRect(x1, top, w, h); }
    ctx.restore();
    const ps = Math.max(7, h * 0.2);
    ctx.font = `900 ${Math.round(ps)}px "Lilita One", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const txt = hp.text, pw = ctx.measureText(txt).width + ps;
    ctx.fillStyle = 'rgba(20,19,43,.8)';
    rr(ctx, x1 + w / 2 - pw / 2, top + h * 0.72, pw, ps * 1.3, ps * 0.6); ctx.fill();
    ctx.fillStyle = '#ffe36e';
    ctx.fillText(txt, x1 + w / 2, top + h * 0.72 + ps * 0.68);
  }
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  let fs = Math.max(8, h * 0.32);
  ctx.font = `900 ${Math.round(fs)}px "Lilita One", system-ui, sans-serif`;
  const tw = ctx.measureText(label).width;
  if (tw > w * 0.86) {
    fs *= (w * 0.86) / tw;
    ctx.font = `900 ${Math.round(fs)}px "Lilita One", system-ui, sans-serif`;
  }
  ctx.lineWidth = Math.max(2, fs / 5);
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ly = top + h * (hp ? 0.4 : 0.5);
  ctx.strokeText(label, x1 + w / 2, ly);
  ctx.fillText(label, x1 + w / 2, ly);
  ctx.restore();
}

function drawCone(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 22);
  rr(ctx, -h * 0.4, -h * 0.1, h * 0.8, h * 0.1, h * 0.03); blob(ctx, '#ff7a1a', lw);
  ctx.beginPath(); ctx.moveTo(-h * 0.28, -h * 0.1); ctx.lineTo(-h * 0.06, -h); ctx.lineTo(h * 0.06, -h); ctx.lineTo(h * 0.28, -h * 0.1); ctx.closePath();
  blob(ctx, '#ff7a1a', lw);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-h * 0.2, -h * 0.38); ctx.lineTo(-h * 0.14, -h * 0.58); ctx.lineTo(h * 0.14, -h * 0.58); ctx.lineTo(h * 0.2, -h * 0.38); ctx.fill();
  ctx.restore();
}

function drawCrate(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 20);
  rr(ctx, -h / 2, -h, h, h, h * 0.08); blob(ctx, '#c98b4a', lw);
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = lw * 1.4;
  ctx.beginPath(); ctx.moveTo(-h * 0.42, -h * 0.08); ctx.lineTo(h * 0.42, -h * 0.92); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = lw;
  ctx.strokeRect(-h * 0.42, -h * 0.92, h * 0.84, h * 0.84);
  ctx.restore();
}

function drawTires(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 20);
  for (let i = 0; i < 3; i++) {
    const y = -h * (0.17 + i * 0.3);
    ctx.beginPath(); ctx.ellipse(0, y, h * 0.42, h * 0.17, 0, 0, Math.PI * 2); blob(ctx, '#2f3238', lw);
    ctx.beginPath(); ctx.ellipse(0, y - h * 0.03, h * 0.2, h * 0.07, 0, 0, Math.PI * 2); blob(ctx, '#15171b', 0);
  }
  ctx.restore();
}

function drawCar(ctx, cx, footY, h, color) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 18);
  const w = h * 1.6;
  rr(ctx, -w / 2, -h * 0.62, w, h * 0.45, h * 0.12); blob(ctx, color, lw);
  rr(ctx, -w * 0.3, -h, w * 0.6, h * 0.42, h * 0.12); blob(ctx, color, lw);
  ctx.fillStyle = '#bfe8ff';
  rr(ctx, -w * 0.24, -h * 0.92, w * 0.48, h * 0.26, h * 0.06); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(-w * 0.45, -h * 0.55, w * 0.9, h * 0.06);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(s * w * 0.3, -h * 0.17, h * 0.17, 0, Math.PI * 2); blob(ctx, '#23232f', lw);
    ctx.beginPath(); ctx.arc(s * w * 0.3, -h * 0.17, h * 0.07, 0, Math.PI * 2); blob(ctx, '#c9cde0', 0);
  }
  ctx.fillStyle = '#ffe36e';
  ctx.beginPath(); ctx.arc(-w * 0.44, -h * 0.45, h * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.44, -h * 0.45, h * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHydrant(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 16);
  rr(ctx, -h * 0.22, -h * 0.8, h * 0.44, h * 0.8, h * 0.08); blob(ctx, '#ff3b4e', lw);
  ctx.beginPath(); ctx.ellipse(0, -h * 0.82, h * 0.26, h * 0.2, 0, Math.PI, 0); blob(ctx, '#ff3b4e', lw);
  rr(ctx, -h * 0.36, -h * 0.55, h * 0.72, h * 0.16, h * 0.06); blob(ctx, '#e0202f', lw);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-h * 0.14, -h * 0.75, h * 0.06, h * 0.6);
  ctx.restore();
}

function drawBush(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 16);
  ctx.beginPath();
  ctx.arc(-h * 0.35, -h * 0.35, h * 0.35, Math.PI * 0.5, Math.PI * 1.6);
  ctx.arc(0, -h * 0.6, h * 0.42, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(h * 0.38, -h * 0.35, h * 0.35, Math.PI * 1.4, Math.PI * 0.5);
  ctx.closePath();
  blob(ctx, '#3fbf4a', lw);
  ctx.fillStyle = '#6fe06a';
  ctx.beginPath(); ctx.arc(-h * 0.1, -h * 0.72, h * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5fb4';
  for (const [x, y] of [[-0.4, -0.35], [0.25, -0.6], [0.45, -0.25]]) { ctx.beginPath(); ctx.arc(h * x, h * y, h * 0.06, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawCactus(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 18);
  const w = h * 0.22;
  rr(ctx, -h * 0.42, -h * 0.72, w * 0.8, h * 0.34, w * 0.4); blob(ctx, '#3fae5a', lw);
  rr(ctx, -h * 0.42, -h * 0.46, h * 0.3, w * 0.7, w * 0.35); blob(ctx, '#3fae5a', lw);
  rr(ctx, h * 0.24, -h * 0.62, w * 0.8, h * 0.3, w * 0.4); blob(ctx, '#3fae5a', lw);
  rr(ctx, h * 0.1, -h * 0.4, h * 0.3, w * 0.7, w * 0.35); blob(ctx, '#3fae5a', lw);
  rr(ctx, -w / 2, -h, w, h, w / 2); blob(ctx, '#46c263', lw);
  ctx.strokeStyle = 'rgba(20,70,40,.45)'; ctx.lineWidth = Math.max(1, h / 40);
  ctx.beginPath(); ctx.moveTo(0, -h * 0.92); ctx.lineTo(0, -h * 0.08); ctx.stroke();
  ctx.fillStyle = '#ff5fb4';
  ctx.beginPath(); ctx.arc(0, -h, w * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDesertRock(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 16);
  ctx.beginPath();
  ctx.moveTo(-h * 0.7, 0); ctx.lineTo(-h * 0.55, -h * 0.6); ctx.lineTo(-h * 0.1, -h); ctx.lineTo(h * 0.4, -h * 0.75); ctx.lineTo(h * 0.7, 0);
  ctx.closePath(); blob(ctx, '#b86a45', lw);
  ctx.fillStyle = '#d98a5a';
  ctx.beginPath(); ctx.moveTo(-h * 0.5, -h * 0.55); ctx.lineTo(-h * 0.1, -h * 0.92); ctx.lineTo(0, -h * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawDrum(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 16);
  const w = h * 0.7;
  rr(ctx, -w / 2, -h, w, h, w * 0.1); blob(ctx, '#2f7fe0', lw);
  ctx.fillStyle = '#1c55a8';
  ctx.fillRect(-w / 2, -h * 0.68, w, h * 0.08); ctx.fillRect(-w / 2, -h * 0.34, w, h * 0.08);
  ctx.beginPath(); ctx.ellipse(0, -h, w / 2, w * 0.14, 0, 0, Math.PI * 2); blob(ctx, '#5aa8ff', lw);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath(); ctx.moveTo(0, -h * 0.62); ctx.lineTo(w * 0.18, -h * 0.4); ctx.lineTo(-w * 0.18, -h * 0.4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------- Squad trooper (blue helmet, like the ad's crowd) ----------

function drawTrooper(ctx, cx, footY, height, t, opts = {}) {
  const { back = true, helmet = '#2f8ff0', flash = 0, phase = 0 } = opts;
  if (back && SOLDIER.back.ready) return drawSoldierRun(ctx, cx, footY, height * 0.95, t, phase);
  if (!back && SOLDIER.front.ready) return drawSoldierStand(ctx, cx, footY, height * 0.95, 0);
  const u = height / 100;
  const step = Math.sin(t * 14 + phase);
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u, u);
  const lw = 3.2;
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
  // Legs
  for (const sgn of [-1, 1]) {
    const lift = Math.max(0, step * sgn) * 6;
    rr(ctx, sgn * 9 - 7, -28 - lift, 14, 22, 5); blob(ctx, '#2f5fb8', lw);
    rr(ctx, sgn * 9 - 8, -10 - lift, 16, 10, 4); blob(ctx, '#23273a', lw);
  }
  const bob = Math.abs(step) * 2;
  ctx.translate(0, -bob);
  // Body: white tee
  rr(ctx, -19, -58, 38, 32, 10); blob(ctx, flash > 0 ? '#ffe' : '#f4f6fb', lw);
  ctx.fillStyle = '#2f5fb8'; ctx.fillRect(-19, -32, 38, 6);
  if (back) {
    limb(ctx, -16, -52, -6, -62, 9, '#ffd9b3', lw);
    limb(ctx, 16, -52, 8, -64, 9, '#ffd9b3', lw);
    rr(ctx, 1, -90, 8, 32, 3); blob(ctx, '#2a2d33', lw);
    ctx.beginPath(); ctx.ellipse(0, -72, 21, 19, 0, 0, Math.PI * 2); blob(ctx, helmet, lw);
    ctx.beginPath(); ctx.ellipse(0, -62, 23, 6, 0, 0, Math.PI); blob(ctx, helmet, lw);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.ellipse(-7, -82, 7, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // Front: facing the camera, holding a rifle across the chest
    ctx.beginPath(); ctx.arc(0, -70, 18, 0, Math.PI * 2); blob(ctx, '#ffd9b3', lw);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(-6, -69, 2.6, 0, Math.PI * 2); ctx.arc(6, -69, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -80, 22, 17, 0, Math.PI, 0); ctx.closePath(); blob(ctx, helmet, lw);
    ctx.beginPath(); ctx.ellipse(0, -79, 24, 5, 0, 0, Math.PI * 2); blob(ctx, helmet, lw);
    ctx.save(); ctx.rotate(-0.5);
    rr(ctx, -4, -62, 36, 8, 3); blob(ctx, '#2a2d33', lw);
    ctx.restore();
    limb(ctx, -16, -52, -4, -44, 9, '#ffd9b3', lw);
    limb(ctx, 16, -52, 10, -58, 9, '#ffd9b3', lw);
  }
  ctx.restore();
}

// Side view of each weapon, pointing right, centered on (cx, cy); len = overall length.
function drawWeaponSide(ctx, kind, cx, cy, len, opts = {}) {
  const L = len / 100;
  ctx.save();
  ctx.translate(cx, cy);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.scale(L, L);
  const lw = 3.2;
  const dark = '#2a2d38', wood = '#8a5530', metal = '#5b6070';
  const glow = opts.accent;
  const R = (x, y, w, h, r, c) => { rr(ctx, x, y, w, h, r); blob(ctx, c, lw); };
  if (kind === 'smg') {
    R(-30, -10, 52, 18, 4, dark); R(20, -5, 22, 7, 2, metal); R(-6, 6, 10, 26, 3, dark); R(-26, 6, 10, 16, 3, dark);
    R(-44, -6, 16, 8, 3, metal);
  } else if (kind === 'shotgun') {
    R(-50, -4, 26, 16, 6, wood); R(-26, -9, 40, 15, 3, dark); R(12, -8, 40, 8, 3, metal); R(10, 0, 30, 8, 3, wood);
    R(-20, 6, 8, 12, 3, dark);
  } else if (kind === 'sniper') {
    R(-52, -4, 28, 14, 6, wood); R(-26, -8, 38, 14, 3, '#3f5f4a'); R(10, -5, 44, 6, 2, metal);
    R(-18, -24, 30, 11, 5, dark); ctx.fillStyle = '#8fd2ff'; ctx.fillRect(9, -22, 3, 7);
    R(-14, 6, 8, 12, 3, dark); R(28, 1, 3, 14, 1, dark);
  } else if (kind === 'minigun') {
    R(-44, -16, 40, 32, 8, '#e0b43a'); R(-50, -6, 10, 26, 4, dark);
    for (const y of [-10, -2, 6]) R(-6, y - 3, 56, 7, 3, metal);
    R(46, -14, 8, 28, 3, dark); R(-30, 14, 12, 18, 4, dark);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-40, -12, 30, 5);
  } else if (kind === 'rocket') {
    R(-50, -11, 84, 22, 9, '#4f8a3a'); R(-54, -13, 10, 26, 4, dark); R(30, -13, 8, 26, 3, dark);
    ctx.beginPath(); ctx.moveTo(38, -10); ctx.lineTo(56, 0); ctx.lineTo(38, 10); ctx.closePath(); blob(ctx, '#e0303a', lw);
    R(-18, 10, 9, 18, 3, dark); R(0, 10, 9, 14, 3, dark);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(-30, -3, 40, 6);
  } else {
    // Assault rifle
    R(-50, -4, 24, 14, 5, wood); R(-26, -9, 44, 16, 4, dark); R(16, -5, 30, 7, 2, metal); R(44, -8, 5, 13, 2, dark);
    R(-2, 6, 10, 20, 3, dark); ctx.save(); ctx.translate(8, 8); ctx.rotate(0.25); R(0, 0, 10, 20, 3, dark); ctx.restore();
    R(-14, -16, 18, 7, 3, dark);
  }
  if (glow) {
    ctx.strokeStyle = glow; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(-24, -1); ctx.lineTo(8, -1); ctx.stroke();
  }
  ctx.restore();
}

function drawRocketShot(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,170,60,.6)';
  ctx.beginPath(); ctx.ellipse(0, s * 1.2, s * 0.35, s * (0.9 + Math.sin(t * 40) * 0.2), 0, 0, Math.PI * 2); ctx.fill();
  rr(ctx, -s * 0.28, -s * 0.5, s * 0.56, s * 1.3, s * 0.2); blob(ctx, '#e8e8f0', Math.max(1, s / 8));
  ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * 0.5); ctx.lineTo(0, -s * 1.05); ctx.lineTo(s * 0.28, -s * 0.5); ctx.closePath(); blob(ctx, '#e0303a', Math.max(1, s / 8));
  ctx.restore();
}

// Gatling gun reward (drawn on top of barrels).
function drawGatling(ctx, cx, cy, s, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.25);
  const lw = Math.max(1.5, s / 14);
  rr(ctx, -s * 0.55, -s * 0.18, s * 0.5, s * 0.36, s * 0.08); blob(ctx, '#ffc933', lw);
  for (let i = -1; i <= 1; i++) { rr(ctx, -s * 0.08, i * s * 0.1 - s * 0.045, s * 0.7, s * 0.09, s * 0.03); blob(ctx, '#3a3f4f', lw * 0.8); }
  rr(ctx, s * 0.55, -s * 0.2, s * 0.1, s * 0.4, s * 0.03); blob(ctx, '#ffc933', lw);
  rr(ctx, -s * 0.4, s * 0.12, s * 0.16, s * 0.3, s * 0.05); blob(ctx, '#7a4a28', lw);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-s * 0.5, -s * 0.14, s * 0.35, s * 0.06);
  ctx.restore();
}

// Floating power-up orbs shown on top of barrels.
function drawPickup(ctx, cx, cy, s, kind, t) {
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 4) * s * 0.06);
  const lw = Math.max(1.5, s / 12);
  const col = { shield: '#3aa0ff', rage: '#ff6a2a', medkit: '#ffffff', grenade: '#4fb84a', coins: '#ffc933' }[kind] || '#fff';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); blob(ctx, col, lw);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.ellipse(-s * 0.14, -s * 0.16, s * 0.12, s * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = kind === 'medkit' ? '#ff4d5e' : '#fff';
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.7;
  if (kind === 'medkit') { ctx.fillRect(-s * 0.08, -s * 0.24, s * 0.16, s * 0.48); ctx.fillRect(-s * 0.24, -s * 0.08, s * 0.48, s * 0.16); }
  else if (kind === 'shield') { ctx.beginPath(); ctx.moveTo(0, -s * 0.25); ctx.lineTo(s * 0.2, -s * 0.15); ctx.lineTo(s * 0.16, s * 0.1); ctx.lineTo(0, s * 0.26); ctx.lineTo(-s * 0.16, s * 0.1); ctx.lineTo(-s * 0.2, -s * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (kind === 'rage') { ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.28); ctx.lineTo(-s * 0.14, s * 0.04); ctx.lineTo(0, s * 0.04); ctx.lineTo(-s * 0.05, s * 0.28); ctx.lineTo(s * 0.15, -s * 0.05); ctx.lineTo(0, -s * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (kind === 'grenade') { ctx.beginPath(); ctx.arc(0, s * 0.03, s * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillRect(-s * 0.04, -s * 0.24, s * 0.08, s * 0.1); }
  else if (kind === 'coins') { ctx.font = `900 ${Math.round(s * 0.45)}px "Lilita One", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText('$', 0, s * 0.02); ctx.fillText('$', 0, s * 0.02); }
  ctx.restore();
}

function drawPine(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 30);
  rr(ctx, -h * 0.05, -h * 0.16, h * 0.1, h * 0.16, h * 0.02); blob(ctx, '#6b4a32', lw);
  for (const [y, r] of [[0.14, 0.34], [0.38, 0.27], [0.6, 0.19]]) {
    ctx.beginPath(); ctx.moveTo(-h * r, -h * y); ctx.lineTo(0, -h * (y + 0.4)); ctx.lineTo(h * r, -h * y); ctx.closePath();
    blob(ctx, '#2f6a52', lw);
    ctx.fillStyle = '#f5faff';
    ctx.beginPath(); ctx.moveTo(-h * r * 0.5, -h * (y + 0.2)); ctx.lineTo(0, -h * (y + 0.4)); ctx.lineTo(h * r * 0.5, -h * (y + 0.2));
    ctx.quadraticCurveTo(0, -h * (y + 0.16), -h * r * 0.5, -h * (y + 0.2)); ctx.fill();
  }
  ctx.restore();
}

function drawSnowman(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 22);
  ctx.beginPath(); ctx.arc(0, -h * 0.26, h * 0.26, 0, Math.PI * 2); blob(ctx, '#f7fbff', lw);
  ctx.beginPath(); ctx.arc(0, -h * 0.68, h * 0.19, 0, Math.PI * 2); blob(ctx, '#f7fbff', lw);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-h * 0.06, -h * 0.72, h * 0.025, 0, Math.PI * 2); ctx.arc(h * 0.06, -h * 0.72, h * 0.025, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath(); ctx.moveTo(0, -h * 0.67); ctx.lineTo(h * 0.16, -h * 0.64); ctx.lineTo(0, -h * 0.62); ctx.fill();
  rr(ctx, -h * 0.2, -h * 0.9, h * 0.4, h * 0.05, h * 0.02); blob(ctx, '#2b2342', lw);
  rr(ctx, -h * 0.13, -h * 1.04, h * 0.26, h * 0.15, h * 0.03); blob(ctx, '#2b2342', lw);
  ctx.fillStyle = '#e0303a'; ctx.fillRect(-h * 0.16, -h * 0.52, h * 0.32, h * 0.06);
  ctx.restore();
}

function drawDeadTree(ctx, cx, footY, h) {
  ctx.save();
  ctx.translate(cx, footY);
  ctx.lineCap = 'round';
  const branch = (x1, y1, x2, y2, w) => {
    ctx.strokeStyle = INK; ctx.lineWidth = w + Math.max(2, h / 30);
    ctx.beginPath(); ctx.moveTo(x1 * h, y1 * h); ctx.lineTo(x2 * h, y2 * h); ctx.stroke();
    ctx.strokeStyle = '#4a3a2e'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1 * h, y1 * h); ctx.lineTo(x2 * h, y2 * h); ctx.stroke();
  };
  branch(0, 0, 0.02, -0.75, h * 0.09);
  branch(0.01, -0.45, -0.28, -0.72, h * 0.045); branch(0.02, -0.6, 0.26, -0.85, h * 0.04);
  branch(-0.18, -0.62, -0.26, -0.9, h * 0.025); branch(0.02, -0.75, -0.06, -1.0, h * 0.03);
  ctx.fillStyle = 'rgba(160,220,90,.8)';
  ctx.beginPath(); ctx.ellipse(-0.27 * h, -0.66 * h, h * 0.03, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawToxicBarrel(ctx, cx, footY, h, t = 0) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 16);
  const w = h * 0.7;
  ctx.fillStyle = 'rgba(160,255,60,.35)';
  ctx.beginPath(); ctx.ellipse(w * 0.2, 0, w * 0.9, w * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  rr(ctx, -w / 2, -h, w, h, w * 0.1); blob(ctx, '#e0c21a', lw);
  ctx.fillStyle = '#2b2342';
  ctx.fillRect(-w / 2, -h * 0.72, w, h * 0.07); ctx.fillRect(-w / 2, -h * 0.32, w, h * 0.07);
  ctx.beginPath(); ctx.arc(0, -h * 0.5, w * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -h, w / 2, w * 0.13, 0, 0, Math.PI * 2); blob(ctx, '#9ae03a', lw);
  ctx.fillStyle = '#c8ff6a';
  ctx.beginPath(); ctx.arc(w * 0.1, -h - Math.abs(Math.sin(t * 3)) * h * 0.12, w * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawLavaRock(ctx, cx, footY, h, t = 0) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 16);
  ctx.fillStyle = 'rgba(255,110,30,.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, h * 0.9, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-h * 0.7, 0); ctx.lineTo(-h * 0.5, -h * 0.55); ctx.lineTo(-h * 0.1, -h * 0.85); ctx.lineTo(h * 0.35, -h * 0.7); ctx.lineTo(h * 0.7, 0);
  ctx.closePath(); blob(ctx, '#3a2a30', lw);
  const glow = 0.7 + 0.3 * Math.sin(t * 4 + cx);
  ctx.strokeStyle = `rgba(255,${Math.round(120 + 80 * glow)},40,1)`; ctx.lineWidth = Math.max(1.5, h / 14); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-h * 0.3, -h * 0.1); ctx.lineTo(-h * 0.15, -h * 0.45); ctx.lineTo(h * 0.05, -h * 0.55);
  ctx.moveTo(h * 0.2, -h * 0.15); ctx.lineTo(h * 0.3, -h * 0.4); ctx.stroke();
  ctx.restore();
}

function drawNeonLamp(ctx, cx, footY, h, t = 0, side = 1) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, h / 30);
  rr(ctx, -h * 0.03, -h, h * 0.06, h, h * 0.02); blob(ctx, '#2f2a5a', lw);
  rr(ctx, -h * 0.03, -h, -side * h * 0.3, h * 0.05, h * 0.02); blob(ctx, '#2f2a5a', lw);
  const lx = -side * h * 0.28;
  const g = ctx.createRadialGradient(lx, -h * 0.92, 0, lx, -h * 0.92, h * 0.45);
  g.addColorStop(0, 'rgba(255,95,208,.55)'); g.addColorStop(1, 'rgba(255,95,208,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, -h * 0.92, h * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(lx, -h * 0.93, h * 0.08, h * 0.04, 0, 0, Math.PI * 2); blob(ctx, '#ffd0f4', lw);
  ctx.fillStyle = Math.sin(t * 3 + cx) > -0.9 ? '#2fe0ff' : '#1a8aa0';
  ctx.fillRect(-h * 0.1, -h * 0.55, h * 0.2, h * 0.12);
  ctx.restore();
}

function drawFireball(ctx, x, y, r, t) {
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = `rgba(255,${80 + i * 30},30,${0.18 * i})`;
    ctx.beginPath(); ctx.ellipse(x, y - r * i * 0.9, r * (1 - i * 0.18), r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff7a1a'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r / 5);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.1, r * 0.6 * (1 + Math.sin(t * 25) * 0.1), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDirtMound(ctx, x, footY, w, t) {
  ctx.save();
  ctx.translate(x, footY);
  const lw = Math.max(1.5, w / 20);
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, w * 0.22, 0, Math.PI, 0); ctx.closePath(); blob(ctx, '#7a5a3a', lw);
  ctx.fillStyle = '#9a7a52';
  for (let i = 0; i < 4; i++) {
    const a = t * 6 + i * 1.6;
    ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.35, -w * 0.12 - Math.abs(Math.sin(a * 1.3)) * w * 0.2, w * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffc933'; ctx.beginPath(); ctx.ellipse(0, -w * 0.16, w * 0.14, w * 0.06, 0, Math.PI, 0); ctx.fill();
  ctx.restore();
}

function drawRock(ctx, cx, cy, r, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 5);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rr2 = r * (0.8 + (i % 3) * 0.12);
    ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
  }
  ctx.closePath();
  blob(ctx, '#8fd13b', Math.max(1.5, r / 8));
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- SVG icons ----------

const ICONS = {
  shop: c => `<path d="M8 22h48l-5 30H13z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M20 22c0-10 5-14 12-14s12 4 12 14" fill="none" stroke="${INK}" stroke-width="4"/><circle cx="32" cy="36" r="6" fill="#ffd54a" stroke="${INK}" stroke-width="3"/>`,
  gear: c => `<path d="M8 38a24 22 0 0 1 48 0z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="4" y="36" width="56" height="9" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/><ellipse cx="22" cy="24" rx="6" ry="3" fill="#fff" opacity=".6"/>`,
  play: c => `<path d="M14 50 44 14l6 2 -2 6-36 30z" fill="#dfe7f0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M50 50 20 14l-6 2 2 6 36 30z" fill="#dfe7f0" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="8" y="44" width="14" height="6" rx="2" transform="rotate(-45 15 47)" fill="${c}" stroke="${INK}" stroke-width="3"/><rect x="42" y="44" width="14" height="6" rx="2" transform="rotate(45 49 47)" fill="${c}" stroke="${INK}" stroke-width="3"/>`,
  skills: c => `<path d="M32 6 40 24l20 2-15 13 5 19-18-10-18 10 5-19L4 26l20-2z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  ranks: c => `<path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M18 14H8c0 10 5 14 11 14M46 14h10c0 10-5 14-11 14" fill="none" stroke="${INK}" stroke-width="4"/><rect x="28" y="36" width="8" height="10" fill="${c}" stroke="${INK}" stroke-width="3"/><rect x="18" y="46" width="28" height="10" rx="3" fill="#8a5a2b" stroke="${INK}" stroke-width="4"/>`,
  coin: () => `<circle cx="32" cy="32" r="26" fill="#ffc632" stroke="${INK}" stroke-width="5"/><circle cx="32" cy="32" r="16" fill="none" stroke="#e39a00" stroke-width="5"/><ellipse cx="22" cy="20" rx="6" ry="4" fill="#fff" opacity=".6"/>`,
  gem: () => `<path d="M16 8h32l12 16-28 34L4 24z" fill="#3fe0a6" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M4 24h56M20 8l12 50 12-50" fill="none" stroke="#1d9e72" stroke-width="3"/>`,
  helmet: c => `<path d="M8 40a24 24 0 0 1 48 0z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="4" y="38" width="56" height="9" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/><ellipse cx="22" cy="26" rx="6" ry="3" fill="#fff" opacity=".6"/>`,
  rifle: c => `<path d="M6 34h40l4-6h8v8l-6 4H30l-6 14h-10l4-14H6z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="24" y="26" width="14" height="6" rx="2" fill="${INK}"/>`,
  gloves: c => `<path d="M18 56V30l-6-12a4 4 0 0 1 7-4l5 9V10a4 4 0 0 1 8 0v14-16a4 4 0 0 1 8 0v16-12a4 4 0 0 1 8 0v26c0 12-6 18-14 18z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  scope: c => `<circle cx="32" cy="32" r="22" fill="${c}" stroke="${INK}" stroke-width="5"/><circle cx="32" cy="32" r="12" fill="#bfe8ff" stroke="${INK}" stroke-width="4"/><path d="M32 16v8M32 40v8M16 32h8M40 32h8" stroke="${INK}" stroke-width="4"/>`,
  chest: c => `<rect x="6" y="26" width="52" height="30" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/><path d="M6 28c0-14 8-20 26-20s26 6 26 20z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="26" y="22" width="12" height="14" rx="3" fill="#ffd54a" stroke="${INK}" stroke-width="3"/><path d="M6 40h52" stroke="${INK}" stroke-width="3" opacity=".5"/>`,
  lock: () => `<rect x="12" y="28" width="40" height="30" rx="6" fill="#9aa7b4" stroke="${INK}" stroke-width="4"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="${INK}" stroke-width="5"/>`,
  star: c => `<path d="M32 4 40 22l20 2-15 13 5 20-18-10-18 10 5-20L4 24l20-2z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  skull: c => `<path d="M32 6C18 6 8 16 8 29c0 8 4 13 9 16v9a4 4 0 0 0 4 4h22a4 4 0 0 0 4-4v-9c5-3 9-8 9-16C56 16 46 6 32 6z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="22" cy="31" rx="6" ry="7" fill="${INK}"/><ellipse cx="42" cy="31" rx="6" ry="7" fill="${INK}"/><path d="M29 44l3-6 3 6z" fill="${INK}"/><path d="M26 58v-6M32 58v-6M38 58v-6" stroke="${INK}" stroke-width="3"/>`,
  heart: c => `<path d="M32 56S6 40 6 22a13 13 0 0 1 26-3 13 13 0 0 1 26 3c0 18-26 34-26 34z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="19" cy="20" rx="5" ry="3.5" fill="#fff" opacity=".6"/>`,
  bolt: c => `<path d="M36 4 10 36h18l-4 24 28-34H34z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  fire: c => `<path d="M32 58c-12 0-20-8-20-19 0-10 7-15 9-24 5 4 7 9 7 13 3-3 4-9 3-20 12 7 23 18 23 31 0 11-9 19-22 19z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M32 52c-5 0-8-3-8-8 0-4 3-6 4-10 5 3 12 7 12 11 0 4-3 7-8 7z" fill="#ffe36e"/>`,
  target: c => `<circle cx="32" cy="32" r="24" fill="${c}" stroke="${INK}" stroke-width="4"/><circle cx="32" cy="32" r="15" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="${c}" stroke="${INK}" stroke-width="3"/>`,
  burst: c => `<path d="M32 4l6 14 15-5-6 14 13 7-14 6 5 15-15-6-4 15-6-14-14 7 4-15-14-6 13-7-6-14 15 5z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  plus: () => `<rect x="4" y="4" width="56" height="56" rx="14" fill="#58d14a" stroke="${INK}" stroke-width="5"/><path d="M32 16v32M16 32h32" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`,
  close: () => `<circle cx="32" cy="32" r="27" fill="#ff4d4d" stroke="${INK}" stroke-width="5"/><path d="M22 22l20 20M42 22 22 42" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  arrow: c => `<path d="M22 8l24 24-24 24" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 8l24 24-24 24" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  music: c => `<path d="M24 46V14l30-6v32" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><ellipse cx="17" cy="47" rx="9" ry="7" fill="${c}" stroke="${INK}" stroke-width="4"/><ellipse cx="47" cy="41" rx="9" ry="7" fill="${c}" stroke="${INK}" stroke-width="4"/><path d="M24 22l30-6" stroke="${INK}" stroke-width="5"/>`,
  sound: c => `<path d="M8 24h12l14-12v40L20 40H8z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M42 22c4 5 4 15 0 20M49 15c8 9 8 25 0 34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  mute: () => `<path d="M8 24h12l14-12v40L20 40H8z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M42 24l14 16M56 24 42 40" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  back: () => `<path d="M28 10 8 30l20 20V38c12 0 20 4 26 14 0-16-8-28-26-28z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  smg: c => `<rect x="10" y="22" width="34" height="14" rx="3" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="42" y="26" width="14" height="6" rx="2" fill="${c}" stroke="${INK}" stroke-width="3"/><rect x="24" y="34" width="8" height="20" rx="2" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="12" y="34" width="8" height="12" rx="2" fill="${c}" stroke="${INK}" stroke-width="4"/>`,
  shotgun: c => `<path d="M4 34l14-8h40v8H24l-4 10H8z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="30" y="34" width="18" height="7" rx="2" fill="${c}" stroke="${INK}" stroke-width="3"/>`,
  sniper: c => `<path d="M4 36l12-6h46v5H24l-4 9H6z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="20" y="16" width="20" height="9" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/><path d="M26 25v5M34 25v5" stroke="${INK}" stroke-width="3"/>`,
  minigun: c => `<rect x="6" y="18" width="26" height="26" rx="6" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="30" y="20" width="28" height="6" rx="2" fill="${c}" stroke="${INK}" stroke-width="3"/><rect x="30" y="28" width="28" height="6" rx="2" fill="${c}" stroke="${INK}" stroke-width="3"/><rect x="30" y="36" width="28" height="6" rx="2" fill="${c}" stroke="${INK}" stroke-width="3"/><rect x="14" y="42" width="8" height="14" rx="2" fill="${c}" stroke="${INK}" stroke-width="4"/>`,
  rocket: c => `<rect x="4" y="24" width="44" height="16" rx="7" fill="${c}" stroke="${INK}" stroke-width="4"/><path d="M46 22l14 10-14 10z" fill="#ff4d5e" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="16" y="38" width="8" height="14" rx="2" fill="${c}" stroke="${INK}" stroke-width="4"/>`,
  pause: () => `<rect x="14" y="10" width="12" height="44" rx="3" fill="#fff" stroke="${INK}" stroke-width="4"/><rect x="38" y="10" width="12" height="44" rx="3" fill="#fff" stroke="${INK}" stroke-width="4"/>`,
  jet: c => `<path d="M32 4c4 0 6 6 6 14v8l20 14v6l-20-6v10l7 6v4l-13-3-13 3v-4l7-6V40L6 46v-6l20-14v-8c0-8 2-14 6-14z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="32" cy="16" rx="3" ry="6" fill="#bfe8ff"/>`,
  tank: c => `<rect x="6" y="36" width="52" height="16" rx="8" fill="#555c66" stroke="${INK}" stroke-width="4"/><circle cx="16" cy="44" r="3" fill="#9aa3ad"/><circle cx="32" cy="44" r="3" fill="#9aa3ad"/><circle cx="48" cy="44" r="3" fill="#9aa3ad"/><path d="M10 36l4-10h36l4 10z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="20" y="16" width="22" height="12" rx="4" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="40" y="18" width="20" height="6" rx="2" fill="${c}" stroke="${INK}" stroke-width="3"/>`,
  heli: c => `<rect x="4" y="10" width="56" height="5" rx="2" fill="${INK}"/><rect x="30" y="12" width="4" height="10" fill="${INK}"/><path d="M12 30c0-6 6-10 14-10h8c8 0 12 6 12 12s-6 12-14 12H22c-6 0-10-6-10-14z" fill="${c}" stroke="${INK}" stroke-width="4"/><path d="M46 30h12l2-6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M18 30c0-4 3-6 8-6v10h-8z" fill="#bfe8ff"/><path d="M20 44l-4 8M40 44l4 8M12 52h38" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  freeze: c => `<g stroke="${INK}" stroke-width="10" stroke-linecap="round"><path d="M32 6v52M9 19l46 26M9 45l46-26"/></g><g stroke="${c}" stroke-width="5" stroke-linecap="round"><path d="M32 6v52M9 19l46 26M9 45l46-26M24 10l8 7 8-7M24 54l8-7 8 7"/></g><circle cx="32" cy="32" r="7" fill="#fff" stroke="${INK}" stroke-width="3"/>`,
  merge: c => `<path d="M10 10v14c0 8 6 12 14 12h4" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M54 10v14c0 8-6 12-14 12h-4" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M32 36v18" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M10 10v14c0 8 6 12 14 12h4M54 10v14c0 8-6 12-14 12h-4M32 36v18" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/><path d="M22 46l10 12 10-12z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  bomb: c => `<circle cx="30" cy="38" r="20" fill="${c}" stroke="${INK}" stroke-width="4"/><rect x="24" y="12" width="12" height="9" rx="2" fill="#5a5f73" stroke="${INK}" stroke-width="3"/><path d="M36 14c6-6 12-6 16-2" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="54" cy="11" r="5" fill="#ffd23a" stroke="${INK}" stroke-width="2"/><ellipse cx="23" cy="31" rx="6" ry="4" fill="#fff" opacity=".45"/>`,
  modes: c => `<path d="M12 22h40c6 0 9 5 9 12v10c0 6-4 9-9 7l-8-6H20l-8 6c-5 2-9-1-9-7V34c0-7 3-12 9-12z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M20 30v12M14 36h12" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="32" r="3.5" fill="#ff4d5e" stroke="${INK}" stroke-width="2"/><circle cx="49" cy="39" r="3.5" fill="#2fe0c4" stroke="${INK}" stroke-width="2"/><path d="M28 16c0-6 8-6 8 0v6" fill="none" stroke="${INK}" stroke-width="4"/>`,
  calendar: c => `<rect x="8" y="12" width="48" height="44" rx="7" fill="#fff" stroke="${INK}" stroke-width="4"/><path d="M8 19a7 7 0 0 1 7-7h34a7 7 0 0 1 7 7v7H8z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M20 6v12M44 6v12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M22 40l7 7 13-14" fill="none" stroke="#2fa82a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  ad: () => `<rect x="4" y="12" width="56" height="40" rx="8" fill="#ffc933" stroke="${INK}" stroke-width="4"/><path d="M26 22v20l16-10z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
};

// ---------- Support vehicles (shaded pseudo-3D, lit from the top-left) ----------

function _lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function _poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }

// Fighter jet seen from above, flying up the screen, casting a shadow below.
function drawJet(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  const body = [[0, -0.58], [0.07, -0.42], [0.1, -0.12], [0.56, 0.14], [0.56, 0.26], [0.1, 0.2], [0.1, 0.36], [0.26, 0.48], [0.26, 0.56], [0.06, 0.52], [0, 0.56],
    [-0.06, 0.52], [-0.26, 0.56], [-0.26, 0.48], [-0.1, 0.36], [-0.1, 0.2], [-0.56, 0.26], [-0.56, 0.14], [-0.1, -0.12], [-0.07, -0.42]].map(([a, b]) => [a * s, b * s]);
  // Drop shadow far below
  ctx.save(); ctx.translate(s * 0.35, s * 0.55); ctx.scale(0.8, 0.8);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; _poly(ctx, body); ctx.fill();
  ctx.restore();
  // Afterburners
  for (const ex of [-0.045, 0.045]) {
    const fl = 0.85 + 0.15 * Math.sin(t * 60 + ex * 99);
    const g = ctx.createRadialGradient(ex * s, s * 0.6, 0, ex * s, s * 0.66, s * 0.2 * fl);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.35, 'rgba(255,190,70,.9)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex * s, s * 0.68, s * 0.07, s * 0.2 * fl, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Airframe with cylindrical shading
  _poly(ctx, body);
  ctx.fillStyle = _lin(ctx, -s * 0.56, 0, s * 0.56, 0, [[0, '#5d6874'], [0.42, '#aab6c2'], [0.5, '#c9d3dd'], [0.62, '#8995a2'], [1, '#4b5561']]);
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.03); ctx.stroke();
  // Wing leading-edge highlights and panel lines
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, s * 0.015);
  ctx.beginPath(); ctx.moveTo(-0.1 * s, -0.1 * s); ctx.lineTo(-0.54 * s, 0.15 * s); ctx.moveTo(0.1 * s, -0.1 * s); ctx.lineTo(0.54 * s, 0.15 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,25,35,.35)'; ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.beginPath(); ctx.moveTo(-0.32 * s, 0.05 * s); ctx.lineTo(-0.32 * s, 0.22 * s); ctx.moveTo(0.32 * s, 0.05 * s); ctx.lineTo(0.32 * s, 0.22 * s);
  ctx.moveTo(0, 0.05 * s); ctx.lineTo(0, 0.5 * s); ctx.stroke();
  // Roundels
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#1f3f8a'; ctx.beginPath(); ctx.arc(sx * 0.4 * s, 0.17 * s, 0.045 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 0.4 * s, 0.17 * s, 0.028 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0242c'; ctx.beginPath(); ctx.arc(sx * 0.4 * s, 0.17 * s, 0.014 * s, 0, Math.PI * 2); ctx.fill();
  }
  // Glass canopy
  const cg = ctx.createLinearGradient(-0.05 * s, -0.4 * s, 0.05 * s, -0.1 * s);
  cg.addColorStop(0, '#e8fbff'); cg.addColorStop(0.35, '#5fb8ff'); cg.addColorStop(1, '#1b4f8a');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, -0.26 * s, 0.05 * s, 0.14 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.02); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-0.018 * s, -0.31 * s, 0.012 * s, 0.05 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Tank seen from behind and above, driving up the road: tracks, hull box, turret and a long barrel.
function drawTank(ctx, x, footY, s, t, recoil = 0) {
  ctx.save();
  ctx.translate(x, footY);
  ctx.lineJoin = 'round';
  const lw = Math.max(1.5, s * 0.025);
  const bob = Math.sin(t * 18) * s * 0.006;
  // Soft ground shadow
  const sh = ctx.createRadialGradient(0, -s * 0.2, s * 0.1, 0, -s * 0.2, s * 0.75);
  sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.72, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();

  const OL = '#5f7f38', OM = '#7a9c47', OH = '#a6c76a', OD = '#3f5a24';
  // Tracks (outer boxes), with moving treads on top
  for (const sx of [-1, 1]) {
    const rear = [[sx * 0.4, -0.2], [sx * 0.6, -0.2], [sx * 0.6, 0.0], [sx * 0.4, 0.0]];
    const top = [[sx * 0.4, -0.2], [sx * 0.6, -0.2], [sx * 0.49, -0.7], [sx * 0.34, -0.7]];
    _poly(ctx, top.map(([a, b]) => [a * s, b * s + bob]));
    ctx.fillStyle = _lin(ctx, 0, -0.7 * s, 0, -0.2 * s, [[0, '#3a3f47'], [1, '#555c66']]); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
    ctx.save(); _poly(ctx, top.map(([a, b]) => [a * s, b * s + bob])); ctx.clip();
    ctx.strokeStyle = 'rgba(15,17,22,.7)'; ctx.lineWidth = Math.max(1, s * 0.018);
    for (let k = 0; k < 9; k++) {
      const f = ((k / 9) + t * 0.9) % 1, yy = (-0.2 - f * 0.5) * s + bob;
      ctx.beginPath(); ctx.moveTo(-0.7 * s, yy); ctx.lineTo(0.7 * s, yy); ctx.stroke();
    }
    ctx.restore();
    _poly(ctx, rear.map(([a, b]) => [a * s, b * s + bob]));
    ctx.fillStyle = '#2b2f36'; ctx.fill(); ctx.stroke();
    // Drive sprocket
    ctx.fillStyle = _lin(ctx, 0, -0.18 * s, 0, 0, [[0, '#9aa3ad'], [1, '#5a626c']]);
    ctx.beginPath(); ctx.arc(sx * 0.5 * s, -0.1 * s + bob, 0.065 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(sx * 0.5 * s, -0.1 * s + bob, 0.022 * s, 0, Math.PI * 2); ctx.fill();
  }
  // Hull: rear face and sloped top deck
  const deck = [[-0.42, -0.24], [0.42, -0.24], [0.34, -0.68], [-0.34, -0.68]].map(([a, b]) => [a * s, b * s + bob]);
  _poly(ctx, deck);
  ctx.fillStyle = _lin(ctx, -0.42 * s, -0.68 * s, 0.42 * s, -0.24 * s, [[0, OH], [0.5, OM], [1, OL]]); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  const back = [[-0.42, -0.24], [0.42, -0.24], [0.42, -0.04], [-0.42, -0.04]].map(([a, b]) => [a * s, b * s + bob]);
  _poly(ctx, back);
  ctx.fillStyle = _lin(ctx, 0, -0.24 * s, 0, -0.04 * s, [[0, OL], [1, OD]]); ctx.fill(); ctx.stroke();
  // Engine grille, tail lights, exhausts
  ctx.fillStyle = 'rgba(20,25,15,.45)';
  for (let k = 0; k < 5; k++) ctx.fillRect((-0.16 + k * 0.07) * s, -0.36 * s + bob, 0.035 * s, 0.09 * s);
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(sx * 0.33 * s, -0.15 * s + bob, 0.028 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,190,.9)'; ctx.beginPath(); ctx.arc(sx * 0.33 * s - 0.008 * s, -0.158 * s + bob, 0.01 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.ellipse(sx * 0.2 * s, -0.08 * s + bob, 0.035 * s, 0.022 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Exhaust puffs
  for (let k = 0; k < 3; k++) {
    const f = (t * 1.3 + k / 3) % 1;
    ctx.fillStyle = `rgba(90,95,100,${0.35 * (1 - f)})`;
    ctx.beginPath(); ctx.arc((0.2 + f * 0.1) * s, (-0.08 + f * 0.25) * s, (0.03 + f * 0.07) * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc((-0.2 - f * 0.1) * s, (-0.08 + f * 0.25) * s, (0.03 + f * 0.07) * s, 0, Math.PI * 2); ctx.fill();
  }
  // Barrel (tapered cylinder), recoils when firing
  const by0 = -0.55 * s + bob, by1 = (-1.02 + recoil * 0.08) * s + bob;
  _poly(ctx, [[-0.05 * s, by0], [0.05 * s, by0], [0.036 * s, by1], [-0.036 * s, by1]]);
  ctx.fillStyle = _lin(ctx, -0.05 * s, 0, 0.05 * s, 0, [[0, OD], [0.35, OH], [1, OD]]); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  rr(ctx, -0.052 * s, by1 - 0.04 * s, 0.104 * s, 0.07 * s, 0.015 * s);
  ctx.fillStyle = _lin(ctx, -0.05 * s, 0, 0.05 * s, 0, [[0, '#3a3f47'], [0.4, '#8a939e'], [1, '#3a3f47']]); ctx.fill(); ctx.stroke();
  // Turret: cylinder side band + domed top
  const ty = -0.46 * s + bob, trx = 0.24 * s, try_ = 0.14 * s, th = 0.09 * s;
  ctx.beginPath(); ctx.ellipse(0, ty + th, trx, try_, 0, 0, Math.PI); ctx.lineTo(-trx, ty); ctx.ellipse(0, ty, trx, try_, 0, Math.PI, 0, true); ctx.closePath();
  ctx.fillStyle = _lin(ctx, -trx, 0, trx, 0, [[0, OL], [0.4, OM], [1, OD]]); ctx.fill(); ctx.stroke();
  const dome = ctx.createRadialGradient(-trx * 0.35, ty - try_ * 0.4, trx * 0.1, 0, ty, trx * 1.1);
  dome.addColorStop(0, '#cfe79a'); dome.addColorStop(0.45, OM); dome.addColorStop(1, OL);
  ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(0, ty, trx, try_, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Hatch, periscope, antenna
  ctx.fillStyle = _lin(ctx, 0, ty - 0.06 * s, 0, ty + 0.02 * s, [[0, OH], [1, OL]]);
  ctx.beginPath(); ctx.ellipse(-0.08 * s, ty - 0.01 * s, 0.065 * s, 0.04 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  rr(ctx, 0.06 * s, ty - 0.06 * s, 0.07 * s, 0.04 * s, 0.01 * s); ctx.fillStyle = '#2b2f36'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.beginPath(); ctx.moveTo(0.17 * s, ty); ctx.quadraticCurveTo(0.2 * s + Math.sin(t * 9) * 0.02 * s, ty - 0.2 * s, 0.24 * s, ty - 0.34 * s); ctx.stroke();
  // Star on the turret back
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5, rad = (k % 2 ? 0.022 : 0.052) * s;
    ctx.lineTo(Math.cos(a) * rad, ty + th * 0.9 + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
  if (recoil > 0.5) {
    const g = ctx.createRadialGradient(0, by1 - 0.08 * s, 0, 0, by1 - 0.08 * s, 0.16 * s);
    g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.4, 'rgba(255,190,60,.9)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, by1 - 0.08 * s, 0.16 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Attack helicopter seen from behind and above: glossy fuselage, stub wings with rocket pods, tail boom, spinning rotor.
function drawHeli(ctx, x, y, s, t, firing, still = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.5, s * 0.025);
  const BD = '#34495f', BM = '#4f6d8f', BH = '#8fb3d6';
  // Tail boom coming toward the viewer, with fin and tail rotor
  _poly(ctx, [[-0.07 * s, 0.05 * s], [0.07 * s, 0.05 * s], [0.045 * s, 0.62 * s], [-0.045 * s, 0.62 * s]]);
  ctx.fillStyle = _lin(ctx, -0.07 * s, 0, 0.07 * s, 0, [[0, BD], [0.4, BH], [1, BD]]); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  _poly(ctx, [[-0.02 * s, 0.5 * s], [0.02 * s, 0.5 * s], [0.02 * s, 0.72 * s], [-0.02 * s, 0.7 * s]]);
  ctx.fillStyle = BM; ctx.fill(); ctx.stroke();
  rr(ctx, -0.17 * s, 0.56 * s, 0.34 * s, 0.05 * s, 0.02 * s); ctx.fillStyle = _lin(ctx, 0, 0.56 * s, 0, 0.61 * s, [[0, BH], [1, BD]]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(200,210,225,.35)';
  ctx.beginPath(); ctx.ellipse(0.05 * s, 0.66 * s, 0.02 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.fill();
  // Skids
  ctx.strokeStyle = '#1c232c'; ctx.lineWidth = Math.max(2, s * 0.03);
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 0.22 * s, -0.32 * s); ctx.lineTo(sx * 0.26 * s, 0.26 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx * 0.14 * s, -0.12 * s); ctx.lineTo(sx * 0.24 * s, -0.1 * s); ctx.moveTo(sx * 0.14 * s, 0.1 * s); ctx.lineTo(sx * 0.25 * s, 0.12 * s); ctx.stroke();
  }
  // Stub wings with rocket pods
  for (const sx of [-1, 1]) {
    _poly(ctx, [[sx * 0.1 * s, -0.1 * s], [sx * 0.4 * s, -0.08 * s], [sx * 0.4 * s, 0.0], [sx * 0.1 * s, 0.02 * s]]);
    ctx.fillStyle = _lin(ctx, 0, -0.1 * s, 0, 0.02 * s, [[0, BH], [1, BD]]); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
    rr(ctx, sx * 0.36 * s - 0.045 * s, -0.2 * s, 0.09 * s, 0.26 * s, 0.045 * s);
    ctx.fillStyle = _lin(ctx, sx * 0.36 * s - 0.045 * s, 0, sx * 0.36 * s + 0.045 * s, 0, [[0, '#2b2f36'], [0.4, '#7a838e'], [1, '#2b2f36']]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#14171c';
    for (const [ox, oy] of [[-0.018, -0.17], [0.018, -0.17], [0, -0.14]]) { ctx.beginPath(); ctx.arc(sx * 0.36 * s + ox * s, oy * s, 0.012 * s, 0, Math.PI * 2); ctx.fill(); }
    if (firing && Math.sin(t * 50 + sx) > 0.3) {
      const g = ctx.createRadialGradient(sx * 0.36 * s, -0.26 * s, 0, sx * 0.36 * s, -0.26 * s, 0.1 * s);
      g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.5, 'rgba(255,200,60,.85)'); g.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx * 0.36 * s, -0.26 * s, 0.1 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Fuselage: glossy teardrop
  ctx.beginPath();
  ctx.moveTo(0, -0.46 * s);
  ctx.bezierCurveTo(0.2 * s, -0.44 * s, 0.2 * s, 0.02 * s, 0.08 * s, 0.12 * s);
  ctx.lineTo(-0.08 * s, 0.12 * s);
  ctx.bezierCurveTo(-0.2 * s, 0.02 * s, -0.2 * s, -0.44 * s, 0, -0.46 * s);
  ctx.closePath();
  const fg = ctx.createRadialGradient(-0.06 * s, -0.22 * s, 0.02 * s, 0, -0.15 * s, 0.3 * s);
  fg.addColorStop(0, BH); fg.addColorStop(0.5, BM); fg.addColorStop(1, BD);
  ctx.fillStyle = fg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  // Canopy glass up front
  ctx.beginPath(); ctx.ellipse(0, -0.3 * s, 0.1 * s, 0.13 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = _lin(ctx, -0.1 * s, -0.43 * s, 0.1 * s, -0.17 * s, [[0, '#e8fbff'], [0.35, '#5fb8ff'], [1, '#12355f']]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-0.04 * s, -0.35 * s, 0.018 * s, 0.06 * s, 0.3, 0, Math.PI * 2); ctx.fill();
  // Engine housing + exhaust
  rr(ctx, -0.08 * s, -0.16 * s, 0.16 * s, 0.16 * s, 0.05 * s);
  ctx.fillStyle = _lin(ctx, -0.08 * s, 0, 0.08 * s, 0, [[0, BD], [0.4, BH], [1, BD]]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#14171c';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.045 * s, 0.02 * s, 0.025 * s, 0.018 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  // Main rotor: translucent disc + blurred blades + hub
  const hubY = -0.1 * s, R = 0.78 * s;
  if (!still) {
    const disc = ctx.createRadialGradient(0, hubY, R * 0.1, 0, hubY, R);
    disc.addColorStop(0, 'rgba(40,45,60,.05)'); disc.addColorStop(0.8, 'rgba(40,45,60,.16)'); disc.addColorStop(1, 'rgba(40,45,60,.04)');
    ctx.fillStyle = disc; ctx.beginPath(); ctx.ellipse(0, hubY, R, R * 0.92, 0, 0, Math.PI * 2); ctx.fill();
  }
  const blades = still ? 2 : 4;
  for (let k = 0; k < blades; k++) {
    const a = (still ? 0.785 : t * 28) + k * Math.PI / (still ? 1 : 2);
    for (const [trail, alpha] of still ? [[0, 1]] : [[0, 0.8], [0.12, 0.35], [0.24, 0.15]]) {
      ctx.save(); ctx.translate(0, hubY); ctx.rotate(a - trail); ctx.scale(1, 0.92);
      ctx.globalAlpha = alpha;
      rr(ctx, 0, -0.022 * s, R, 0.044 * s, 0.02 * s);
      ctx.fillStyle = '#20252e'; ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = _lin(ctx, 0, hubY - 0.05 * s, 0, hubY + 0.05 * s, [[0, '#8a939e'], [1, '#2b2f36']]);
  ctx.beginPath(); ctx.arc(0, hubY, 0.05 * s, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  ctx.restore();
}

function icon(name, color = '#ffc632', size = 28) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${ICONS[name](color)}</svg>`;
}
