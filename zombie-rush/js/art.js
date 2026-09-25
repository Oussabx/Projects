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

function drawSoldierBack(ctx, cx, footY, height, t = 0, flash = 0) {
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

  // Rifle pointing forward (up the screen)
  rr(ctx, 18, -100, 9, 44, 3); blob(ctx, '#2a2d33', lw);
  rr(ctx, 20, -110, 5, 12, 2); blob(ctx, '#2a2d33', lw);
  rr(ctx, 16, -72, 13, 10, 3); blob(ctx, '#7a4a28', lw);

  if (flash > 0) {
    ctx.save();
    ctx.translate(22.5, -116);
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

function drawZombie(ctx, cx, footY, height, t, opts) {
  const { color = '#7cbf5a', flash = 0, wide = 1, boss = false, final = false, shirt = '#6b6f9a' } = opts || {};
  const u = height / 100;
  const skin = flash > 0 ? '#ffffff' : color;
  const sway = Math.sin(t * 6) * 3;
  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(u * wide, u);
  const lw = 2.8 / wide;

  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 6, 0, 0, Math.PI * 2); ctx.fill();

  // Legs
  for (const s of [-1, 1]) {
    const lift = Math.max(0, Math.sin(t * 6) * s) * 5;
    rr(ctx, s * 10 - 8, -28 - lift, 16, 26, 5); blob(ctx, '#4b4f6e', lw);
    ctx.beginPath(); ctx.ellipse(s * 10, -3 - lift, 10, 5, 0, 0, Math.PI * 2); blob(ctx, skin, lw);
  }

  ctx.rotate(sway * 0.01);
  // Arms reaching toward the camera
  for (const s of [-1, 1]) {
    limb(ctx, s * 18, -52, s * 30, -64 + Math.sin(t * 6 + s) * 3, 10, skin, lw);
    ctx.beginPath(); ctx.arc(s * 31, -66 + Math.sin(t * 6 + s) * 3, 6, 0, Math.PI * 2); blob(ctx, skin, lw);
  }

  // Torso with torn shirt
  rr(ctx, -21, -60, 42, 34, 10); blob(ctx, flash > 0 ? '#fff' : shirt, lw);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(0, -36); ctx.lineTo(6, -26); ctx.fill();
  ctx.fillStyle = 'rgba(120,20,20,.5)';
  ctx.beginPath(); ctx.arc(10, -48, 3.5, 0, Math.PI * 2); ctx.fill();

  if (boss) {
    // Spiked shoulder pads
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * 22, -58, 12, 8, 0, 0, Math.PI * 2); blob(ctx, '#5b5f73', lw);
      ctx.beginPath(); ctx.moveTo(s * 16, -64); ctx.lineTo(s * 24, -78); ctx.lineTo(s * 28, -62); ctx.closePath();
      blob(ctx, '#d9e6f2', lw);
    }
  }

  // Head
  ctx.beginPath(); ctx.arc(0, -78, 23, 0, Math.PI * 2); blob(ctx, skin, lw);
  // Messy hair
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-20, -86);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-20 + i * 6.6, -99 - (i % 2) * 6);
  ctx.lineTo(20, -86); ctx.quadraticCurveTo(0, -94, -20, -86); ctx.fill();
  // Eyes
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(s * 9, -80, 6, 0, Math.PI * 2); blob(ctx, '#fff8c4', 2);
    ctx.fillStyle = '#e0242c';
    ctx.beginPath(); ctx.arc(s * 9, -80, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // Mouth
  ctx.beginPath(); ctx.ellipse(0, -65, 8, 5, 0, 0, Math.PI * 2); blob(ctx, '#5a1a22', 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-5, -70, 3, 3); ctx.fillRect(2, -70, 3, 3);

  if (final) {
    // Officer cap for the chapter boss
    ctx.beginPath(); ctx.ellipse(0, -98, 26, 9, 0, 0, Math.PI * 2); blob(ctx, '#2d3e66', lw);
    rr(ctx, -20, -114, 40, 16, 6); blob(ctx, '#2d3e66', lw);
    ctx.beginPath(); ctx.arc(0, -106, 5, 0, Math.PI * 2); blob(ctx, '#ffc632', 1.5);
  }

  ctx.restore();
}

// ---------- Props ----------

function drawBarrel(ctx, cx, footY, w, h, hp) {
  ctx.save();
  ctx.translate(cx, footY);
  const lw = Math.max(1.5, w / 40);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, w * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  rr(ctx, -w / 2, -h, w, h, w * 0.08); blob(ctx, '#d8322f', lw);
  ctx.fillStyle = '#a81f22';
  for (const f of [0.25, 0.75]) ctx.fillRect(-w / 2, -h * f - h * 0.04, w, h * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(-w * 0.38, -h * 0.95, w * 0.08, h * 0.85);
  ctx.beginPath(); ctx.ellipse(0, -h, w / 2, w * 0.12, 0, 0, Math.PI * 2); blob(ctx, '#f0544f', lw);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, w / 18);
  ctx.font = `900 ${Math.round(h * 0.34)}px "Lilita One", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(hp, 0, -h * 0.5);
  ctx.fillText(hp, 0, -h * 0.5);
  ctx.restore();
}

function drawGate(ctx, x1, x2, footY, h, label, good) {
  ctx.save();
  const w = x2 - x1;
  const top = footY - h;
  const grad = ctx.createLinearGradient(0, top, 0, footY);
  if (good) { grad.addColorStop(0, 'rgba(70,170,255,.85)'); grad.addColorStop(1, 'rgba(40,110,230,.45)'); }
  else { grad.addColorStop(0, 'rgba(255,90,90,.85)'); grad.addColorStop(1, 'rgba(220,40,60,.45)'); }
  rr(ctx, x1, top, w, h, Math.min(10, w * 0.08));
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = Math.max(2, w / 45); ctx.strokeStyle = good ? '#bfe3ff' : '#ffd0d0'; ctx.stroke();
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
  ctx.strokeText(label, x1 + w / 2, top + h * 0.5);
  ctx.fillText(label, x1 + w / 2, top + h * 0.5);
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
  pause: () => `<rect x="14" y="10" width="12" height="44" rx="3" fill="#fff" stroke="${INK}" stroke-width="4"/><rect x="38" y="10" width="12" height="44" rx="3" fill="#fff" stroke="${INK}" stroke-width="4"/>`,
};

function icon(name, color = '#ffc632', size = 28) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${ICONS[name](color)}</svg>`;
}
