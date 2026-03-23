/* ══════════════════════════════════════════════════════════
   VOID COMMANDER — GAME ENGINE
   Hand-Gesture Controlled Space Shooter
══════════════════════════════════════════════════════════ */

const GAME = (() => {

// ── CONFIG ─────────────────────────────────────────────────────────────────
const CFG = {
  targetFPS: 60,
  starLayers: [80, 50, 30],
  maxBullets: 60,
  maxParticles: 400,
  waveInterval: 30000, // ms per wave
  debrisTypes: ['asteroid', 'comet', 'shard', 'ring', 'nebula'],
  powerupChance: 0.004,
  creditChance: 0.006,
};

// ── STATE ───────────────────────────────────────────────────────────────────
let canvas, ctx, W, H;
let running = false;
let animId = null;
let lastTime = 0;

let state = {
  score: 0, credits: 0, kills: 0,
  wave: 1, waveTimer: 0,
  shield: 100, maxShield: 100,
  shieldRegen: false,
  ship: null,
  bullets: [], debris: [], particles: [],
  powerups: [], creditDrops: [],
  activePowerups: {},
  stars: [],
  gameOver: false,
  frameCount: 0,
  magnetActive: false,
  slowTime: false,
  invincible: false,
  rapidFire: false,
  doubleShot: false, tripleShot: false,
  doubleDamage: false, freeze: false,
  lastFire: 0, fireRate: 300,
  bombCooldown: 0,
};

let playerData = {};
let shipConfig = {};

// ── HAND TRACKING STATE ────────────────────────────────────────────────────
let handX = 0.5, handY = 0.5;
let gesture = 'none'; // open, point, peace, fist, v
let gestureConfidence = 0;
let lerpX = 0, lerpY = 0;

// ── SHIP DEFINITIONS (visual renderers) ────────────────────────────────────
const SHIP_RENDERERS = {
  phantom: (ctx, x, y, color) => {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -30, 0, 20);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(14, 12); ctx.lineTo(6, 8);
    ctx.lineTo(0, 14); ctx.lineTo(-6, 8); ctx.lineTo(-14, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cockpit
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(0, -10, 4, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  },
  vortex: (ctx, x, y, color) => {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -35, 0, 20);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    // Swept delta wing
    ctx.beginPath();
    ctx.moveTo(0, -35); ctx.lineTo(20, 15); ctx.lineTo(10, 8);
    ctx.lineTo(0, 18); ctx.lineTo(-10, 8); ctx.lineTo(-20, 15); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Twin engines
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(-12, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(12, 20); ctx.stroke();
    ctx.restore();
  },
  titan: (ctx, x, y, color) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = color + '33'; ctx.strokeStyle = color; ctx.lineWidth = 2;
    // Wide hull
    ctx.beginPath();
    ctx.moveTo(0, -28); ctx.lineTo(22, 0); ctx.lineTo(18, 18);
    ctx.lineTo(0, 22); ctx.lineTo(-18, 18); ctx.lineTo(-22, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Heavy guns
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-18, -5); ctx.lineTo(-28, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -5); ctx.lineTo(28, -18); ctx.stroke();
    // Shield dome
    ctx.fillStyle = 'rgba(255,170,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, -5, 12, 8, 0, Math.PI, Math.PI*2); ctx.fill();
    ctx.restore();
  },
  specter: (ctx, x, y, color) => {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -32, 0, 18);
    g.addColorStop(0, color); g.addColorStop(0.5, color + '88'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.strokeStyle = color; ctx.lineWidth = 1;
    // Ghostly diamond shape
    ctx.beginPath();
    ctx.moveTo(0, -32); ctx.lineTo(16, 0); ctx.lineTo(8, 8);
    ctx.lineTo(0, 18); ctx.lineTo(-8, 8); ctx.lineTo(-16, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Phase wings
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(-32, 8); ctx.lineTo(-20, 12); ctx.lineTo(-16, 0); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(32, 8); ctx.lineTo(20, 12); ctx.lineTo(16, 0); ctx.fill();
    ctx.restore();
  },
  nova: (ctx, x, y, color) => {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -30, 0, 25);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, color); g.addColorStop(1, '#ffff00');
    ctx.fillStyle = g; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    // Tri-cannon star shape
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(10, -10); ctx.lineTo(24, -5);
    ctx.lineTo(12, 8); ctx.lineTo(14, 22); ctx.lineTo(0, 14);
    ctx.lineTo(-14, 22); ctx.lineTo(-12, 8); ctx.lineTo(-24, -5);
    ctx.lineTo(-10, -10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Center crystal
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
};

// ── DEBRIS RENDERERS (CSS + canvas planet debris) ──────────────────────────
function drawDebris(d) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);

  if (d.type === 'asteroid') {
    ctx.fillStyle = '#3d2e22';
    ctx.strokeStyle = '#6b5a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < d.verts.length; i++) {
      const v = d.verts[i];
      i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (d.type === 'comet') {
    ctx.fillStyle = '#4488ff';
    ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI*2); ctx.fill();
  } else if (d.type === 'shard') {
    ctx.fillStyle = '#004433';
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < d.verts.length; i++) {
      const v = d.verts[i];
      i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (d.type === 'ring') {
    ctx.strokeStyle = '#cc8833';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, d.r, d.r*0.3, 0, 0, Math.PI*2); ctx.stroke();
  } else if (d.type === 'nebula') {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── BOSS DEBRIS ────────────────────────────────────────────────────────────
function makeBossDebris(wave) {
  const r = 60 + Math.random() * 30 + wave * 4;
  const d = {
    type: 'asteroid', x: Math.random() * W, y: -r - 20,
    r, vx: (Math.random() - 0.5) * 1.5,
    vy: (1.0 + wave * 0.12),
    rot: 0, rotSpeed: (Math.random() - 0.5) * 0.02,
    hp: Math.round(r * (4 + wave * 0.5)),
    maxHp: Math.round(r * (4 + wave * 0.5)),
    dead: false, isBoss: true,
    verts: [], craters: [], blobs: [], color: '#ff4400'
  };
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rv = r * (0.75 + Math.random() * 0.25);
    d.verts.push({ x: Math.cos(a) * rv, y: Math.sin(a) * rv });
  }
  return d;
}

function makeDebris(wave) {
  const type = CFG.debrisTypes[Math.floor(Math.random() * CFG.debrisTypes.length)];
  const r = 18 + Math.random() * 28 + wave * 2;
  const x = Math.random() * W;
  const speedMul = state.slowTime ? 0.35 : 1;
  const baseSpeed = (2.2 + Math.random() * 2.8 + wave * 0.28) * speedMul;

  const d = {
    type, x, y: -r - 10, r,
    vx: (Math.random() - 0.5) * 1.2,
    vy: baseSpeed,
    rot: 0, rotSpeed: (Math.random() - 0.5) * 0.04,
    hp: Math.round(r * (1.8 + wave * 0.18)),
    maxHp: Math.round(r * (1.8 + wave * 0.18)),
    dead: false,
    verts: [], craters: [], blobs: [], color: '#aa44ff'
  };

  if (type === 'asteroid' || type === 'shard') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const rv = r * (0.7 + Math.random() * 0.3);
      d.verts.push({ x: Math.cos(a)*rv, y: Math.sin(a)*rv });
    }
  }
  if (type === 'nebula') {
    const colors = ['#ff0088','#0088ff','#ff8800','#00ffaa','#aa00ff'];
    d.color = colors[Math.floor(Math.random()*colors.length)];
  }
  return d;
}

// ── POWERUP DROPS ──────────────────────────────────────────────────────────
const POWERUP_TYPES = [
  { id:'shield_boost', color:'#00ff88', icon:'🛡', label:'SHIELD SURGE', duration:8000 },
  { id:'rapid_fire', color:'#ff6600', icon:'⚡', label:'RAPID FIRE', duration:6000 },
  { id:'slow_time', color:'#aa88ff', icon:'⏱', label:'TIME WARP', duration:5000 },
  { id:'magnet', color:'#ffdd00', icon:'🧲', label:'MAGNET', duration:7000 },
  { id:'invincible', color:'#ffffff', icon:'💫', label:'NOVA SHIELD', duration:3000 },
  { id:'double_dmg', color:'#ff2244', icon:'💥', label:'DBL DAMAGE', duration:5000 },
  { id:'freeze', color:'#aaeeff', icon:'❄', label:'CRYO BLAST', duration:4000 },
  { id:'triple_shot', color:'#ff88ff', icon:'🔱', label:'TRIPLE SHOT', duration:6000 },
];

function makePowerup(x, y) {
  const t = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  return { ...t, x, y, vy: 1.2, r: 14, pulse: 0, dead: false };
}

function makeCreditDrop(x, y) {
  return {
    x, y, vy: 1.0, r: 8, val: 5 + Math.floor(Math.random()*15),
    dead: false, pulse: 0
  };
}

// ── PARTICLES ──────────────────────────────────────────────────────────────
function spawnExplosion(x, y, color='#ff8800', count=20) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 4;
    state.particles.push({
      x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      life: 1, decay: 0.02 + Math.random()*0.03,
      size: 1 + Math.random()*3, color
    });
  }
}

function spawnTrail(x, y, color) {
  state.particles.push({
    x: x + (Math.random()-0.5)*6, y: y + 14,
    vx: (Math.random()-0.5)*0.5, vy: 1.5 + Math.random(),
    life: 0.7, decay: 0.04, size: 2 + Math.random()*3, color
  });
}

function spawnBulletHit(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({
      x, y, vx: Math.cos(a)*3, vy: Math.sin(a)*3,
      life: 0.6, decay: 0.08, size: 2, color: '#ffff88'
    });
  }
}

// ── STARS (parallax) ───────────────────────────────────────────────────────
function initStars() {
  state.stars = [];
  CFG.starLayers.forEach((count, layer) => {
    const speed = 0.2 + layer * 0.3;
    const size = 0.5 + layer * 0.5;
    for (let i = 0; i < count; i++) {
      state.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        size, speed, opacity: 0.3 + Math.random() * 0.7,
        layer
      });
    }
  });
}

// ── BULLET FACTORY ────────────────────────────────────────────────────────
function fireBullet() {
  const now = performance.now();
  const fr = state.rapidFire ? state.fireRate * 0.3 : state.fireRate;
  if (now - state.lastFire < fr) return;
  state.lastFire = now;

  const dmg = (shipConfig.damage || 15) * (state.doubleDamage ? 2 : 1);
  const col = shipConfig.color || '#00c8ff';
  const bx = lerpX, by = lerpY - 30;

  const addBullet = (vx) => state.bullets.push({
    x: bx, y: by, vx, vy: -14, dmg, color: col,
    dead: false, r: 4, trail: []
  });

  addBullet(0);
  if (state.tripleShot) { addBullet(-4); addBullet(4); }
  else if (shipConfig.id === 'nova' && state.doubleShot) { addBullet(-3); addBullet(3); }
}

// ── BOMB (fist gesture) ────────────────────────────────────────────────────
function triggerBomb() {
  const now = performance.now();
  if (now - state.bombCooldown < 8000) return;
  state.bombCooldown = now;

  // Screen flash
  const flash = document.createElement('div');
  flash.className = 'damage-flash';
  flash.style.background = 'rgba(0,200,255,0.3)';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  // Destroy all debris
  state.debris.forEach(d => {
    if (!d.dead) {
      d.dead = true;
      spawnExplosion(d.x, d.y, '#00c8ff', 30);
      state.score += 50; state.kills++;
      if (Math.random() < 0.3) state.creditDrops.push(makeCreditDrop(d.x, d.y));
    }
  });
  state.debris = [];
}

// ── COLLISION DETECTION ────────────────────────────────────────────────────
function dist(ax, ay, bx, by) {
  return Math.sqrt((ax-bx)**2 + (ay-by)**2);
}

function checkCollisions() {
  const shipR = 16;

  // Bullets vs debris
  state.bullets.forEach(b => {
    if (b.dead) return;
    state.debris.forEach(d => {
      if (d.dead) return;
      if (dist(b.x, b.y, d.x, d.y) < d.r + b.r) {
        b.dead = true;
        d.hp -= b.dmg;
        spawnBulletHit(b.x, b.y);
        if (d.hp <= 0) {
          d.dead = true;
          state.kills++; state.score += Math.round(d.r * 2 + state.wave * 20);
          spawnExplosion(d.x, d.y, '#ff8800', 25);
          if (Math.random() < CFG.powerupChance * 100) state.powerups.push(makePowerup(d.x, d.y));
          if (Math.random() < CFG.creditChance * 100) state.creditDrops.push(makeCreditDrop(d.x, d.y));
        }
      }
    });
  });

  // Debris vs ship
  if (!state.invincible) {
    state.debris.forEach(d => {
      if (d.dead) return;
      if (dist(lerpX, lerpY, d.x, d.y) < d.r + shipR) {
        d.dead = true;
        spawnExplosion(d.x, d.y, '#ff4400', 30);
        const dmgAmt = 25 + Math.round(d.r * 1.4);
        state.shield = Math.max(0, state.shield - dmgAmt);
        document.getElementById('shieldBar').style.width = (state.shield / state.maxShield * 100) + '%';
        document.getElementById('shieldBar').style.background = state.shield < 30 ? '#ff2244' : '';
        document.getElementById('shieldVal').textContent = Math.round(state.shield);

        // Screen flash
        const flash = document.createElement('div');
        flash.className = 'damage-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 300);

        if (state.shield <= 0) endGame();
      }
    });
  }

  // Powerups
  state.powerups.forEach(p => {
    if (p.dead) return;
    const grab = state.magnetActive ? 120 : 24;
    if (dist(lerpX, lerpY, p.x, p.y) < grab) {
      p.dead = true;
      activatePowerup(p);
      showPickupText(p.x, p.y, p.icon + ' ' + p.label, p.color);
    }
  });

  // Credit drops
  state.creditDrops.forEach(c => {
    if (c.dead) return;
    const grab = state.magnetActive ? 150 : 24;
    if (dist(lerpX, lerpY, c.x, c.y) < grab) {
      c.dead = true;
      state.credits += c.val;
      document.getElementById('hud-credits').textContent = state.credits;
      showPickupText(c.x, c.y, '+' + c.val + '⚡', '#ffdd00');
    }
  });
}

function showPickupText(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'powerup-collect';
  el.style.cssText = `left:${x}px;top:${y}px;color:${color};font-family:'Orbitron',monospace;font-size:14px;letter-spacing:2px;`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ── POWERUP ACTIVATION ─────────────────────────────────────────────────────
function activatePowerup(p) {
  const now = performance.now();
  state.activePowerups[p.id] = { ...p, startTime: now, endTime: now + p.duration };

  switch(p.id) {
    case 'shield_boost': state.shield = Math.min(state.maxShield, state.shield + 50); break;
    case 'rapid_fire': state.rapidFire = true; break;
    case 'slow_time': state.slowTime = true; break;
    case 'magnet': state.magnetActive = true; break;
    case 'invincible': state.invincible = true; break;
    case 'double_dmg': state.doubleDamage = true; break;
    case 'freeze':
      state.freeze = true;
      state.debris.forEach(d => { d._savedVy = d.vy; d.vy = 0; });
      break;
    case 'triple_shot': state.tripleShot = true; break;
  }
  updatePowerupTray();
}

function tickPowerups() {
  const now = performance.now();
  Object.entries(state.activePowerups).forEach(([id, p]) => {
    if (now > p.endTime) {
      delete state.activePowerups[id];
      switch(id) {
        case 'rapid_fire': state.rapidFire = false; break;
        case 'slow_time': state.slowTime = false; break;
        case 'magnet': state.magnetActive = false; break;
        case 'invincible': state.invincible = false; break;
        case 'double_dmg': state.doubleDamage = false; break;
        case 'freeze':
          state.freeze = false;
          state.debris.forEach(d => { if(d._savedVy) { d.vy = d._savedVy; delete d._savedVy; } });
          break;
        case 'triple_shot': state.tripleShot = false; break;
      }
      updatePowerupTray();
    }
  });
}

function updatePowerupTray() {
  const tray = document.getElementById('powerup-tray');
  tray.innerHTML = '';
  const now = performance.now();
  Object.values(state.activePowerups).forEach(p => {
    const pct = ((p.endTime - now) / p.duration) * 100;
    const chip = document.createElement('div');
    chip.className = 'pu-chip';
    chip.innerHTML = `
      <span class="pu-icon">${p.icon}</span>
      <div>
        <div style="font-size:10px;letter-spacing:2px;color:${p.color}">${p.label}</div>
        <div class="pu-bar"><div class="pu-fill" style="width:${pct}%;background:${p.color}"></div></div>
      </div>`;
    tray.appendChild(chip);
  });
}

// ── WAVE SYSTEM ────────────────────────────────────────────────────────────
function tickWave(dt) {
  state.waveTimer += dt;
  if (state.waveTimer > CFG.waveInterval) {
    state.wave++;
    state.waveTimer = 0;
    document.getElementById('hud-wave').textContent = `WAVE ${state.wave}`;
    // Wave announce
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      font-family:'Orbitron',monospace;font-size:42px;font-weight:900;
      color:#00c8ff;letter-spacing:4px;z-index:200;pointer-events:none;
      text-shadow:0 0 30px rgba(0,200,255,0.8);
      animation:puIn 0.5s ease,flashFade 1.5s 0.5s forwards;`;
    el.textContent = `WAVE ${state.wave}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

// ── SHIELD REGEN ───────────────────────────────────────────────────────────
let regenTimer = 0;
function tickRegen(dt) {
  if (!state.shieldRegen) return;
  regenTimer += dt;
  if (regenTimer > 2000) {
    regenTimer = 0;
    if (state.shield < state.maxShield) {
      state.shield = Math.min(state.maxShield, state.shield + 2);
      document.getElementById('shieldBar').style.width = (state.shield/state.maxShield*100)+'%';
      document.getElementById('shieldVal').textContent = Math.round(state.shield);
    }
  }
}

// ── DRAW ────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Deep space background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#000005');
  bg.addColorStop(1, '#000010');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars parallax
  state.stars.forEach(s => {
    ctx.globalAlpha = s.opacity;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Nebula background glow
  const t = state.frameCount * 0.002;
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = `hsl(${240 + Math.sin(t)*20}, 100%, 50%)`;
  ctx.beginPath(); ctx.arc(W*0.3, H*0.4, 300, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `hsl(${280 + Math.cos(t)*20}, 100%, 50%)`;
  ctx.beginPath(); ctx.arc(W*0.7, H*0.6, 250, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // Particles
  state.particles = state.particles.filter(p => p.life > 0);
  state.particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05; p.life -= p.decay;
  });
  ctx.globalAlpha = 1;

  // Debris
  state.debris.forEach(d => {
    if (!d.dead) {
      // HP bar
      if (d.hp < d.maxHp) {
        const bw = d.r * 2; const bh = d.isBoss ? 6 : 3;
        const bx = d.x - d.r; const by = d.y + d.r + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = d.isBoss ? '#ff0000' : '#ff4400'; ctx.fillRect(bx, by, bw * (d.hp/d.maxHp), bh);
      }
      if (d.isBoss) { ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 30; }
      drawDebris(d);
      ctx.shadowBlur = 0;
    }
  });

  // Bullets
  state.bullets.forEach(b => {
    if (b.dead) return;
    // Trail
    ctx.globalAlpha = 0.3;
    b.trail.forEach((t, i) => {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, b.r * (i/b.trail.length), 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Bullet glow
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r*2);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, b.color);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r*2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r*0.5, 0, Math.PI*2); ctx.fill();
  });

  // Credit drops
  state.creditDrops.forEach(c => {
    if (c.dead) return;
    const pulse = Math.sin(c.pulse * 0.1) * 2;
    ctx.fillStyle = '#ffdd00';
    ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r + pulse, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.font = 'bold 9px Orbitron';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡', c.x, c.y);
  });

  // Powerup drops
  state.powerups.forEach(p => {
    if (p.dead) return;
    const pulse = Math.sin(p.pulse * 0.08) * 3;
    ctx.fillStyle = p.color + '33';
    ctx.strokeStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + pulse, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, p.x, p.y);
  });

  // Ship engine trail
  const trailColor = shipConfig.trailColor || '#0066ff';
  spawnTrail(lerpX, lerpY, trailColor);

  // Invincible shield ring
  if (state.invincible) {
    const t2 = state.frameCount * 0.05;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20;
    ctx.globalAlpha = 0.6 + Math.sin(t2) * 0.3;
    ctx.beginPath(); ctx.arc(lerpX, lerpY, 30, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // Draw ship
  const renderer = SHIP_RENDERERS[shipConfig.id] || SHIP_RENDERERS.phantom;
  ctx.shadowColor = shipConfig.color;
  ctx.shadowBlur = 15;
  renderer(ctx, lerpX, lerpY, shipConfig.color || '#00c8ff');
  ctx.shadowBlur = 0;

  // Gesture indicator ring
  if (gesture !== 'none') {
    ctx.strokeStyle = shipConfig.color || '#00c8ff';
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(lerpX, lerpY, 40, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Bomb cooldown ring
  const now = performance.now();
  const bombPct = Math.min(1, (now - state.bombCooldown) / 8000);
  if (bombPct < 1) {
    ctx.strokeStyle = '#00c8ff';
    ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(lerpX, lerpY, 22, -Math.PI/2, -Math.PI/2 + bombPct * Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ── MAIN LOOP ──────────────────────────────────────────────────────────────
function loop(timestamp) {
  if (!running) return;
  const dt = timestamp - lastTime;
  lastTime = timestamp;
  state.frameCount++;

  // Merge button input with hand tracking (buttons take priority when active)
  const btn = window._btnInput || {};
  const tx = (btn.active ? btn.x : handX) * W;
  const ty = (btn.active ? btn.y : handY) * H;
  lerpX += (tx - lerpX) * 0.18;
  lerpY += (ty - lerpY) * 0.18;
  lerpX = Math.max(20, Math.min(W-20, lerpX));
  lerpY = Math.max(20, Math.min(H-20, lerpY));

  // Fire: gesture OR button
  if (gesture === 'point' || gesture === 'peace' || gesture === 'nova' || btn.firing) fireBullet();

  // Bomb: gesture OR button
  if (gesture === 'fist' || btn.bomb) { triggerBomb(); if (btn.bomb) btn.bomb = false; }

  // Update stars
  state.stars.forEach(s => {
    s.y += s.speed * (state.slowTime ? 0.4 : 1);
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
  });

  // Update bullets
  state.bullets.forEach(b => {
    if (!b.dead) {
      b.trail.unshift({x: b.x, y: b.y});
      if (b.trail.length > 6) b.trail.pop();
      b.x += b.vx; b.y += b.vy;
      if (b.y < -20 || b.x < -20 || b.x > W+20) b.dead = true;
    }
  });
  state.bullets = state.bullets.filter(b => !b.dead).slice(-CFG.maxBullets);

  // Spawn debris
  const debrisRate = Math.max(12, 65 - state.wave * 7);
  if (state.frameCount % debrisRate === 0) {
    state.debris.push(makeDebris(state.wave));
    // Double spawn starting wave 3
    if (state.wave >= 3 && Math.random() < 0.35) state.debris.push(makeDebris(state.wave));
    // Boss debris every 5 waves
    if (state.wave >= 5 && state.frameCount % (debrisRate * 40) === 0) state.debris.push(makeBossDebris(state.wave));
  }

  // Update debris
  state.debris.forEach(d => {
    if (!d.dead) {
      const speedMul = state.slowTime ? 0.35 : 1;
      d.x += d.vx * speedMul;
      d.y += (d._savedVy !== undefined ? 0 : d.vy) * speedMul;
      d.rot += d.rotSpeed;
      if (d.y > H + 60) d.dead = true;
    }
  });
  state.debris = state.debris.filter(d => !d.dead).slice(-80);

  // Update powerups
  state.powerups.forEach(p => {
    if (!p.dead) { p.y += p.vy; p.pulse++; if (p.y > H+20) p.dead = true; }
  });
  state.powerups = state.powerups.filter(p => !p.dead);

  // Update credit drops
  state.creditDrops.forEach(c => {
    if (!c.dead) {
      if (state.magnetActive) {
        const dx = lerpX - c.x, dy = lerpY - c.y;
        const d2 = Math.sqrt(dx*dx+dy*dy);
        c.x += dx/d2 * 4; c.y += dy/d2 * 4;
      } else { c.y += c.vy; }
      c.pulse++;
      if (c.y > H+20) c.dead = true;
    }
  });
  state.creditDrops = state.creditDrops.filter(c => !c.dead);

  // Spontaneous powerup spawn
  if (Math.random() < CFG.powerupChance) state.powerups.push(makePowerup(Math.random()*W, -20));
  if (Math.random() < CFG.creditChance) state.creditDrops.push(makeCreditDrop(Math.random()*W, -20));

  checkCollisions();
  tickPowerups();
  tickWave(dt);
  tickRegen(dt);

  // Update HUD
  document.getElementById('hud-score-val').textContent = state.score.toLocaleString();
  document.getElementById('hud-kills').textContent = state.kills;
  document.getElementById('hud-credits').textContent = state.credits;

  draw();
  animId = requestAnimationFrame(loop);
}

// ── INIT / START / END ─────────────────────────────────────────────────────
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  lerpX = W / 2; lerpY = H * 0.75;
}

function startGame(player, ship) {
  playerData = player;
  shipConfig = ship;

  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resize();

  // Apply upgrades
  let extraShield = 0, extraFireRate = 0, extraSpeed = 0;
  (player.upgrades || []).forEach(u => {
    if (u === 'shield_pack') extraShield += 50;
    if (u === 'ammo_boost') extraFireRate += 2;
    if (u === 'engine_tune') extraSpeed += 1;
    if (u === 'damage_core') ship.damage = (ship.damage||15) + 10;
  });

  state = {
    score: 0, credits: 0, kills: 0,
    wave: 1, waveTimer: 0,
    shield: ship.shield + extraShield,
    maxShield: ship.shield + extraShield,
    shieldRegen: (player.passives||[]).includes('auto_repair'),
    ship,
    bullets: [], debris: [], particles: [],
    powerups: [], creditDrops: [],
    activePowerups: {},
    stars: [],
    gameOver: false,
    frameCount: 0,
    magnetActive: false, slowTime: false, invincible: false,
    rapidFire: false, doubleShot: ship.id === 'nova',
    tripleShot: false, doubleDamage: false, freeze: false,
    lastFire: 0,
    fireRate: Math.round(1000 / (ship.fireRate + extraFireRate)),
    bombCooldown: 0,
  };

  document.getElementById('shieldBar').style.width = '100%';
  document.getElementById('shieldBar').style.background = '';
  document.getElementById('shieldVal').textContent = state.shield;
  document.getElementById('hud-wave').textContent = 'WAVE 1';

  initStars();
  running = true;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function endGame() {
  if (state.gameOver) return;
  state.gameOver = true;
  running = false;
  if (animId) cancelAnimationFrame(animId);
  // Callback to App
  if (window._onGameOver) window._onGameOver(state.score, state.kills, state.credits);
}

function stopGame() {
  running = false;
  if (animId) cancelAnimationFrame(animId);
}

// ── HAND TRACKING ─────────────────────────────────────────────────────────
function initHandTracking() {
  const video = document.getElementById('input_video');
  if (!video) return;

  const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.75, minTrackingConfidence: 0.75 });

  hands.onResults(results => {
    const ghud = document.getElementById('gesture-hud');
    if (!results.multiHandLandmarks?.length) {
      gesture = 'none';
      if (ghud) ghud.textContent = 'NO HAND';
      return;
    }
    const h = results.multiHandLandmarks[0];

    // Mirror x for natural feel
    handX = 1 - h[0].x;
    handY = h[0].y * 0.85 + 0.05;

    // Gesture detection
    const up = (tip, base) => h[tip].y < h[base].y;
    const i = up(8,6), m = up(12,10), r = up(16,14), p = up(20,18), t = up(4,3);

    if (!i && !m && !r && !p) gesture = 'fist';
    else if (i && m && r && p) gesture = 'open';
    else if (i && !m && !r && !p) gesture = 'point';
    else if (i && m && !r && !p) gesture = 'peace';
    else if (i && m && r && !p) gesture = 'nova';
    else gesture = 'open';

    const gestureLabels = {
      fist: '✊ BOMB', open: '✋ MOVE', point: '👆 FIRE',
      peace: '✌️ RAPID', nova: '🤙 TRIPLE', none: 'NO HAND'
    };
    if (ghud) ghud.textContent = gestureLabels[gesture] || gesture.toUpperCase();
  });

  const cam = new Camera(video, {
    onFrame: async () => {
      if (video.readyState >= 2) await hands.send({ image: video });
    },
    width: 320, height: 240
  });
  cam.start().catch(e => console.warn('Camera error:', e));
}

window.addEventListener('resize', () => { if (canvas) resize(); });

return { startGame, stopGame, initHandTracking };
})();
