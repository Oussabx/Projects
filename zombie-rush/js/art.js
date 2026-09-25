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

function drawSoldierFront(ctx, cx, footY, height, t = 0) {
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

// Cartoon zombie facing the camera, feet at (cx, footY), ~100 units tall.
function drawZombie(ctx, cx, footY, height, t, opts) {
  const { color = '#8fbf5a', flash = 0, wide = 1, boss = false, final = false, shirt = '#6b6f9a',
    helmet = false, bomb = false, seed = 0 } = opts || {};
  const hit = flash > 0;
  const skin = hit ? '#ffffff' : color;
  const skinDk = hit ? '#e8e8e8' : shadeHex(color, -0.3);
  const skinLt = hit ? '#ffffff' : shadeHex(color, 0.22);
  const cloth = hit ? '#ffffff' : shirt;
  const clothDk = hit ? '#e0e0e0' : shadeHex(shirt, -0.32);
  const pants = hit ? '#e0e0e0' : '#3d3a5c';
  const v = Math.abs(Math.floor(seed * 7)) % 3;        // hairstyle / face variant
  const walk = t * 6 + seed * 3;
  const sw = Math.sin(walk);
  const u = height / 100;
  const lw = 3;

  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u * wide, u);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 27, 6, 0, 0, Math.PI * 2); ctx.fill();

  // Legs: one drags behind with a limp
  for (const s of [-1, 1]) {
    const lift = Math.max(0, sw * s) * (s < 0 ? 7 : 3);
    rr(ctx, s * 10 - 8, -34 - lift, 16, 30, 6); blob(ctx, pants, lw);
    ctx.fillStyle = hit ? '#fff' : 'rgba(0,0,0,.18)';
    ctx.fillRect(s * 10 - 6, -18 - lift, 12, 3);
    ctx.beginPath(); ctx.ellipse(s * 11, -4 - lift, 11, 6, 0, 0, Math.PI * 2); blob(ctx, skinDk, lw);
    ctx.fillStyle = hit ? '#fff' : shadeHex(color, -0.45);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(s * 11 + i * 4, -1 - lift, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }

  // Upper body lurches side to side
  ctx.translate(0, -Math.abs(sw) * 2);
  ctx.rotate(Math.sin(walk * 0.5) * 0.07);

  // Torso: torn shirt with a jagged hem
  ctx.beginPath();
  ctx.moveTo(-22, -64);
  ctx.quadraticCurveTo(0, -70, 22, -64);
  ctx.lineTo(19, -34);
  for (let i = 0; i <= 8; i++) ctx.lineTo(19 - i * 4.75, -32 + (i % 2 ? -6 : 1));
  ctx.closePath();
  blob(ctx, cloth, lw);
  // Shirt shading and rips
  ctx.fillStyle = hit ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.16)';
  ctx.beginPath(); ctx.moveTo(8, -66); ctx.quadraticCurveTo(22, -64, 19, -36); ctx.lineTo(10, -36); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -52); ctx.lineTo(-4, -56); ctx.lineTo(0, -50); ctx.lineTo(-3, -42); ctx.lineTo(-11, -44); ctx.closePath();
  blob(ctx, skin, 2);
  ctx.strokeStyle = hit ? '#ccc' : skinDk; ctx.lineWidth = 1.8;
  for (const y of [-51, -47]) { ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(-2, y - 1); ctx.stroke(); }
  if (!hit) {
    ctx.fillStyle = 'rgba(140,20,30,.7)';
    ctx.beginPath(); ctx.arc(11, -46, 4, 0, Math.PI * 2); ctx.arc(14, -41, 2.4, 0, Math.PI * 2); ctx.arc(9, -38, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // Collar
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, -67); ctx.lineTo(0, -60); ctx.lineTo(8, -67); ctx.stroke();

  if (boss) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * 22, -62, 13, 9, 0, 0, Math.PI * 2); blob(ctx, hit ? '#fff' : '#5b5f73', lw);
      for (const dx of [-5, 4]) {
        ctx.beginPath(); ctx.moveTo(s * (18 + dx), -68); ctx.lineTo(s * (21 + dx), -84); ctx.lineTo(s * (25 + dx), -67); ctx.closePath();
        blob(ctx, '#e6eef7', 2.4);
      }
    }
  }

  if (bomb) {
    rr(ctx, -16, -52, 32, 14, 4); blob(ctx, hit ? '#fff' : '#6b4a2b', 2.5);
    for (const x of [-11, 0, 11]) { rr(ctx, x - 4, -58, 8, 18, 3); blob(ctx, hit ? '#fff' : '#e0303a', 2); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -58); ctx.quadraticCurveTo(6, -66, 3, -70); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffe14d' : '#ff7a1a';
    ctx.beginPath(); ctx.arc(3, -71, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Arms reaching forward, clawed hands
  for (const s of [-1, 1]) {
    const reach = Math.sin(walk + s) * 4;
    const ex = s * 30, ey = -50 + reach * 0.4;
    const hx = s * 33, hy = -56 + reach;
    limb(ctx, s * 18, -62, ex, ey, 11, cloth, lw);
    limb(ctx, ex, ey, hx, hy, 9, skin, lw);
    ctx.beginPath(); ctx.ellipse(hx, hy - 3, 7, 6, 0, 0, Math.PI * 2); blob(ctx, skin, lw);
    ctx.fillStyle = hit ? '#fff' : '#f2ecd0'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    for (const f of [-4, 0, 4]) {
      ctx.beginPath(); ctx.moveTo(hx + f - 2, hy - 7); ctx.lineTo(hx + f, hy - 14); ctx.lineTo(hx + f + 2, hy - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // Head, tilted and bobbing
  ctx.save();
  ctx.translate(0, -84);
  ctx.rotate(Math.sin(walk * 0.5 + 1) * 0.12 + (v - 1) * 0.08);

  // Ears
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 22, 2, 5, 7, 0, 0, Math.PI * 2); blob(ctx, skinDk, 2.4); }
  // Skull with a heavier jaw
  ctx.beginPath();
  ctx.moveTo(-21, -4);
  ctx.bezierCurveTo(-23, -28, 23, -28, 21, -4);
  ctx.bezierCurveTo(22, 10, 16, 20, 0, 21);
  ctx.bezierCurveTo(-16, 20, -22, 10, -21, -4);
  ctx.closePath();
  blob(ctx, skin, lw);
  // Side shading and forehead highlight
  ctx.save();
  ctx.clip();
  ctx.fillStyle = skinDk;
  ctx.beginPath(); ctx.ellipse(16, 4, 12, 24, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skinLt;
  ctx.beginPath(); ctx.ellipse(-8, -15, 9, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  // Sunken cheeks
  ctx.fillStyle = hit ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.12)';
  ctx.beginPath(); ctx.ellipse(-12, 8, 5, 7, 0.3, 0, Math.PI * 2); ctx.ellipse(12, 8, 5, 7, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-21, -4); ctx.bezierCurveTo(-23, -28, 23, -28, 21, -4); ctx.bezierCurveTo(22, 10, 16, 20, 0, 21); ctx.bezierCurveTo(-16, 20, -22, 10, -21, -4);
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();

  // Stitched scar
  ctx.strokeStyle = hit ? '#bbb' : '#5a1f2a'; ctx.lineWidth = 1.8;
  const sx = v === 1 ? 6 : -14;
  ctx.beginPath(); ctx.moveTo(sx, -18); ctx.lineTo(sx + 9, -10); ctx.stroke();
  for (let i = 0; i < 3; i++) { const px = sx + 1.5 + i * 3, py = -16.5 + i * 2.7; ctx.beginPath(); ctx.moveTo(px - 2, py + 2); ctx.lineTo(px + 2, py - 2); ctx.stroke(); }

  // Eye sockets
  ctx.fillStyle = hit ? '#ddd' : 'rgba(40,10,40,.35)';
  ctx.beginPath(); ctx.ellipse(-9, -4, 8, 8, 0, 0, Math.PI * 2); ctx.ellipse(9, -3, 7, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  // Big bulging eye
  const glow = boss ? '#ff3b3b' : '#e0242c';
  ctx.beginPath(); ctx.arc(-9, -4, 6.8, 0, Math.PI * 2); blob(ctx, '#fff8c4', 2.2);
  ctx.fillStyle = glow;
  const look = Math.sin(t * 2 + seed) * 1.2;
  ctx.beginPath(); ctx.arc(-9 + look, -3, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-10.5 + look, -5, 1.2, 0, Math.PI * 2); ctx.fill();
  // Droopy half-closed eye
  ctx.beginPath(); ctx.arc(9, -2, 5, 0, Math.PI * 2); blob(ctx, '#fff8c4', 2.2);
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(9, -1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skinDk;
  ctx.beginPath(); ctx.moveTo(3.5, -2.5); ctx.quadraticCurveTo(9, -9, 14.5, -2.5); ctx.lineTo(14.5, -7); ctx.lineTo(3.5, -7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(3.5, -2.5); ctx.quadraticCurveTo(9, -7, 14.5, -2.5); ctx.stroke();
  // Heavy brow
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-17, -13); ctx.lineTo(-3, -9); ctx.moveTo(3, -9); ctx.lineTo(16, -11); ctx.stroke();
  // Nose holes
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(-2, 5, 1.3, 0, Math.PI * 2); ctx.arc(2, 5, 1.3, 0, Math.PI * 2); ctx.fill();

  // Gaping mouth with jagged teeth
  const jaw = 3 + Math.abs(Math.sin(t * 5 + seed)) * 3;
  ctx.beginPath();
  ctx.moveTo(-10, 10); ctx.quadraticCurveTo(0, 7, 10, 10);
  ctx.quadraticCurveTo(9, 13 + jaw, 0, 14 + jaw);
  ctx.quadraticCurveTo(-9, 13 + jaw, -10, 10);
  ctx.closePath();
  blob(ctx, hit ? '#ddd' : '#4a1520', 2.2);
  ctx.fillStyle = hit ? '#fff' : '#fff6d8';
  for (let i = 0; i < 5; i++) {
    if (i === (v + 1) % 5) continue;                 // a missing tooth
    const tx = -8 + i * 4;
    ctx.beginPath(); ctx.moveTo(tx - 1.6, 9.5); ctx.lineTo(tx, 13); ctx.lineTo(tx + 1.6, 9.5); ctx.closePath(); ctx.fill();
  }
  for (const tx of [-5, 4]) { ctx.beginPath(); ctx.moveTo(tx - 1.5, 13 + jaw); ctx.lineTo(tx, 10 + jaw); ctx.lineTo(tx + 1.5, 13 + jaw); ctx.closePath(); ctx.fill(); }
  if (!hit) {
    ctx.fillStyle = 'rgba(170,230,120,.85)';
    const dr = (t * 1.5 + seed) % 1;
    ctx.beginPath(); ctx.ellipse(6, 15 + jaw + dr * 5, 1.4, 2 + dr * 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Hair
  ctx.fillStyle = hit ? '#fff' : (boss ? '#1b1f2a' : ['#2b2233', '#4a3a2a', '#3a2a4a'][v]);
  if (v === 0) {
    // Messy spikes
    ctx.beginPath(); ctx.moveTo(-20, -12);
    const pts = [[-18, -26], [-12, -20], [-7, -30], [-1, -22], [5, -31], [9, -21], [15, -28], [16, -18], [21, -12]];
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.quadraticCurveTo(0, -20, -20, -12); ctx.fill();
  } else if (v === 1) {
    // Balding with a few strands
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2.2;
    for (const [x0, c] of [[-8, -10], [-2, -4], [4, 3]]) { ctx.beginPath(); ctx.moveTo(x0, -21); ctx.quadraticCurveTo(x0 + c, -30, x0 + c * 1.6, -24); ctx.stroke(); }
    if (!hit) { ctx.fillStyle = 'rgba(140,20,30,.7)'; ctx.beginPath(); ctx.arc(10, -17, 3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    // Swept fringe
    ctx.beginPath(); ctx.moveTo(-21, -8); ctx.bezierCurveTo(-24, -30, 14, -34, 22, -12);
    ctx.quadraticCurveTo(8, -22, -4, -16); ctx.quadraticCurveTo(-12, -14, -21, -8); ctx.fill();
  }

  if (helmet) {
    ctx.beginPath(); ctx.ellipse(0, -12, 27, 20, 0, Math.PI, 0); ctx.closePath(); blob(ctx, hit ? '#fff' : '#7d8699', lw);
    ctx.beginPath(); ctx.ellipse(0, -12, 30, 5, 0, 0, Math.PI * 2); blob(ctx, hit ? '#fff' : '#646c80', lw);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-9, -24, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(12, -20, 2, 0, Math.PI * 2); ctx.fill();   // bullet dent
  }
  if (final) {
    ctx.beginPath(); ctx.ellipse(0, -22, 26, 9, 0, 0, Math.PI * 2); blob(ctx, '#2d3e66', lw);
    rr(ctx, -20, -38, 40, 16, 6); blob(ctx, '#2d3e66', lw);
    ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); blob(ctx, '#ffc632', 1.5);
  }
  ctx.restore();

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
};

function icon(name, color = '#ffc632', size = 28) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${ICONS[name](color)}</svg>`;
}
