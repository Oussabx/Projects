(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = canvas.parentElement;

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    best: document.getElementById('best'),
    overlay: document.getElementById('overlay'),
    title: document.getElementById('title'),
    message: document.getElementById('message'),
    start: document.getElementById('start'),
    pause: document.getElementById('pause'),
  };

  const BEST_KEY = 'bubble-pup-best';
  const MAX_LIVES = 3;

  // Item types: weight controls spawn odds.
  const ITEMS = {
    bubble: { points: 1, weight: 70, radius: 16 },
    bone: { points: 5, weight: 8, radius: 18 },
    mud: { points: 0, weight: 22, radius: 17 },
  };

  let W = 0, H = 0;
  let state = 'menu'; // menu | playing | paused | over
  let score = 0, lives = MAX_LIVES, best = loadBest();
  let items = [], sparks = [];
  let spawnTimer = 0, elapsed = 0, hurtTimer = 0;
  let lastTime = 0;

  const pup = { x: 0, y: 0, w: 70, h: 50, speed: 460, targetX: null, dir: 0 };
  const keys = new Set();

  function loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage unavailable */ }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = stage.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pup.y = H - pup.h - 14;
    pup.x = Math.min(Math.max(pup.x || W / 2, pup.w / 2), W - pup.w / 2);
    if (state !== 'playing') draw();
  }

  function updateHud() {
    ui.score.textContent = score;
    ui.lives.textContent = '❤'.repeat(lives) + '♡'.repeat(MAX_LIVES - lives);
    ui.best.textContent = best;
  }

  function reset() {
    score = 0;
    lives = MAX_LIVES;
    items = [];
    sparks = [];
    spawnTimer = 0;
    elapsed = 0;
    hurtTimer = 0;
    pup.x = W / 2;
    pup.targetX = null;
    updateHud();
  }

  function start() {
    reset();
    state = 'playing';
    ui.overlay.hidden = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function showOverlay(title, message, button) {
    ui.title.textContent = title;
    ui.message.innerHTML = message;
    ui.start.textContent = button;
    ui.overlay.hidden = false;
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      showOverlay('Paused', 'Take a breather.', 'Resume');
    } else if (state === 'paused') {
      state = 'playing';
      ui.overlay.hidden = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function gameOver() {
    state = 'over';
    const newBest = score > best;
    if (newBest) { best = score; saveBest(best); }
    updateHud();
    showOverlay(
      newBest ? 'New best!' : 'Muddy pup!',
      `You scored <strong>${score}</strong>.${newBest ? '' : `<br>Best: ${best}`}`,
      'Play again'
    );
  }

  // Difficulty ramps with time survived.
  function difficulty() {
    return Math.min(1 + elapsed / 30, 3.2);
  }

  function pickType() {
    const total = Object.values(ITEMS).reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const [name, t] of Object.entries(ITEMS)) {
      if ((r -= t.weight) < 0) return name;
    }
    return 'bubble';
  }

  function spawn() {
    const type = pickType();
    const r = ITEMS[type].radius;
    const d = difficulty();
    items.push({
      type,
      r,
      x: r + Math.random() * (W - r * 2),
      y: -r,
      vy: (120 + Math.random() * 80) * d,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 140;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  }

  function update(dt) {
    elapsed += dt;
    hurtTimer = Math.max(0, hurtTimer - dt);

    // Movement: keyboard takes priority over a touch/mouse target.
    const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    if (dir !== 0) {
      pup.targetX = null;
      pup.x += dir * pup.speed * dt;
      pup.dir = dir;
    } else if (pup.targetX !== null) {
      const dx = pup.targetX - pup.x;
      const step = pup.speed * 1.4 * dt;
      pup.x += Math.abs(dx) < step ? dx : Math.sign(dx) * step;
      if (Math.abs(dx) > 2) pup.dir = Math.sign(dx);
    }
    pup.x = Math.min(Math.max(pup.x, pup.w / 2), W - pup.w / 2);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawn();
      spawnTimer = (0.55 + Math.random() * 0.4) / difficulty();
    }

    const catchTop = pup.y + 6;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.wobble += dt * 4;

      const hit =
        it.y + it.r > catchTop &&
        it.y - it.r < pup.y + pup.h &&
        Math.abs(it.x - pup.x) < pup.w / 2 + it.r * 0.6;

      if (hit) {
        items.splice(i, 1);
        if (it.type === 'mud') {
          lives--;
          hurtTimer = 0.6;
          burst(it.x, it.y, '#7a5230', 14);
          updateHud();
          if (lives <= 0) { gameOver(); return; }
        } else {
          score += ITEMS[it.type].points;
          burst(it.x, it.y, it.type === 'bone' ? '#ffc24b' : '#9fd8ff', it.type === 'bone' ? 16 : 8);
          updateHud();
        }
      } else if (it.y - it.r > H) {
        items.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) sparks.splice(i, 1);
    }
  }

  // ---------- Drawing ----------

  function drawBackground() {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, dark ? '#221d4a' : '#f1e9ff');
    g.addColorStop(1, dark ? '#15122f' : '#fff8ec');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Tiled bathroom floor.
    ctx.fillStyle = dark ? '#2c2660' : '#cabbf9';
    ctx.fillRect(0, H - 14, W, 14);
  }

  function drawBubble(it) {
    const x = it.x + Math.sin(it.wobble) * 3;
    ctx.beginPath();
    ctx.arc(x, it.y, it.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(159, 216, 255, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6ab8f0';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - it.r * 0.35, it.y - it.r * 0.35, it.r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  }

  function drawBone(it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(Math.sin(it.wobble) * 0.4);
    ctx.fillStyle = '#ffc24b';
    ctx.strokeStyle = '#241f5c';
    ctx.lineWidth = 2;
    const L = it.r * 0.8, k = it.r * 0.38;
    ctx.beginPath();
    ctx.rect(-L, -k * 0.6, L * 2, k * 1.2);
    for (const [cx, cy] of [[-L, -k * 0.7], [-L, k * 0.7], [L, -k * 0.7], [L, k * 0.7]]) {
      ctx.moveTo(cx + k, cy);
      ctx.arc(cx, cy, k, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawMud(it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.fillStyle = '#7a5230';
    ctx.strokeStyle = '#4a3019';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = it.r * (0.85 + 0.15 * Math.sin(a * 5 + it.wobble));
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a0764a';
    ctx.beginPath();
    ctx.arc(-it.r * 0.3, -it.r * 0.25, it.r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPup() {
    const { x, y, w, h } = pup;
    const blink = hurtTimer > 0 && Math.floor(hurtTimer * 20) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pup.dir < 0 ? -1 : 1, 1);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#241f5c';

    // Tub
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-w / 2, h * 0.45);
    ctx.lineTo(w / 2, h * 0.45);
    ctx.quadraticCurveTo(w / 2 - 4, h, w / 2 - 14, h);
    ctx.lineTo(-w / 2 + 14, h);
    ctx.quadraticCurveTo(-w / 2 + 4, h, -w / 2, h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = '#f5c98a';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.25, w * 0.26, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.fillStyle = '#c98f4f';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * w * 0.25, h * 0.2, w * 0.09, h * 0.22, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Eyes & nose
    ctx.fillStyle = '#241f5c';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * w * 0.09 + 3, h * 0.17, hurtTimer > 0 ? 1.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(4, h * 0.32, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Foam on top of tub
    ctx.fillStyle = '#ffffff';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * w * 0.2, h * 0.47, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    drawBackground();
    for (const it of items) {
      if (it.type === 'bubble') drawBubble(it);
      else if (it.type === 'bone') drawBone(it);
      else drawMud(it);
    }
    for (const p of sparks) {
      ctx.globalAlpha = Math.max(p.life / 0.5, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPup();
  }

  function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    draw();
    if (state === 'playing') requestAnimationFrame(loop);
  }

  // ---------- Input ----------

  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };

  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.key]) { keys.add(KEYMAP[e.key]); e.preventDefault(); }
    else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    else if ((e.key === 'Enter' || e.key === ' ') && state !== 'playing') {
      e.preventDefault();
      state === 'paused' ? togglePause() : start();
    }
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) keys.delete(KEYMAP[e.key]); });

  function pointerTo(e) {
    const rect = canvas.getBoundingClientRect();
    pup.targetX = e.clientX - rect.left;
  }
  canvas.addEventListener('pointerdown', (e) => { pointerTo(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') pointerTo(e); });

  ui.start.addEventListener('click', () => (state === 'paused' ? togglePause() : start()));
  ui.pause.addEventListener('click', togglePause);

  // Auto-pause when the tab loses focus.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });
  window.addEventListener('blur', () => keys.clear());

  new ResizeObserver(resize).observe(stage);
  resize();
  updateHud();
})();
