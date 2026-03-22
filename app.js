/* ══════════════════════════════════════════════════════════
   VOID COMMANDER — APP CONTROLLER v2
   + Vercel Blob | Face Capture | All Unlocked
══════════════════════════════════════════════════════════ */

// ── STATE ────────────────────────────────────────────────────────────────────
let playerData    = {};
let shipsData     = {};
let storeData     = {};
let selectedShip  = 'phantom';
let handTrackingInit = false;
let currentTab    = 'ships';

// ── FACE CAPTURE STATE ───────────────────────────────────────────────────────
let faceCaptured    = false;   // Resets each game launch
let capturePhotoURL = null;    // Data URL shown locally
let captureTimer    = null;
let countdownInterval = null;

// ── API ───────────────────────────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

// ── FACE CAPTURE ─────────────────────────────────────────────────────────────
function startFaceCapture() {
  if (faceCaptured) return;
  faceCaptured = true; // Lock now so retrigger can't happen

  let remaining = 5;
  const overlay = document.getElementById('scan-countdown');
  const numEl   = document.getElementById('scan-num');
  overlay.classList.add('active');
  numEl.textContent = remaining;

  countdownInterval = setInterval(() => {
    remaining--;
    numEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      numEl.textContent = '📸';
      captureFacePhoto().finally(() => {
        setTimeout(() => overlay.classList.remove('active'), 800);
      });
    }
  }, 1000);
}

async function captureFacePhoto() {
  let stream = null;
  try {
    // Open a dedicated high-res stream for the photo (natural ratio, best quality)
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width:  { ideal: 1280, min: 480 },
        height: { ideal: 960,  min: 360 },
      }
    });

    const vid = document.createElement('video');
    vid.srcObject = stream;
    vid.muted     = true;
    vid.autoplay  = true;
    await new Promise(res => {
      vid.onloadeddata = res;
      setTimeout(res, 2500);
    });
    await vid.play().catch(() => {});

    // Use the video's natural resolution — no forced ratio
    const W = vid.videoWidth  || 640;
    const H = vid.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Mirror (selfie feels right) + enhanced colours
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.filter = 'saturate(1.75) contrast(1.12) brightness(1.06)';
    ctx.drawImage(vid, 0, 0, W, H);
    ctx.filter = 'none';
    ctx.restore();

    // Cyan-magenta colour cast overlay
    ctx.globalCompositeOperation = 'overlay';
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(0,200,255,0.10)');
    grad.addColorStop(1, 'rgba(180,0,255,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Subtle scan-lines
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;

    // Neon frame
    const bord = 10;
    ctx.strokeStyle = '#00c8ff';
    ctx.lineWidth   = bord;
    ctx.shadowColor = '#00c8ff';
    ctx.shadowBlur  = 28;
    ctx.strokeRect(bord / 2, bord / 2, W - bord, H - bord);

    // Corner accents
    drawCornerAccents(ctx, W, H, '#00c8ff');

    // Inner magenta accent
    ctx.strokeStyle = '#ff00cc';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur  = 12;
    ctx.strokeRect(bord * 2, bord * 2, W - bord * 4, H - bord * 4);
    ctx.shadowBlur = 0;

    // Text overlay — top
    ctx.fillStyle = '#00c8ff';
    ctx.shadowColor = '#00c8ff'; ctx.shadowBlur = 12;
    ctx.font = `bold ${Math.round(W * 0.035)}px Orbitron, monospace`;
    ctx.fillText('▸ PILOT SCAN', bord * 2.5, bord * 5);

    // Ship name — top right
    const shipName = (shipsData[selectedShip]?.name || 'PHANTOM X-9').toUpperCase();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff00cc';
    ctx.shadowColor = '#ff00cc';
    ctx.font = `${Math.round(W * 0.025)}px Orbitron, monospace`;
    ctx.fillText(shipName, W - bord * 2.5, bord * 5);

    // Bottom timestamp
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,224,255,0.85)';
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(W * 0.022)}px Rajdhani, monospace`;
    const stamp = new Date().toISOString().replace('T', '  ').substring(0, 19);
    ctx.fillText(stamp, bord * 2.5, H - bord * 2.5);

    // VOID COMMANDER watermark — bottom right
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,200,255,0.5)';
    ctx.font = `${Math.round(W * 0.02)}px Orbitron, monospace`;
    ctx.fillText('VOID COMMANDER', W - bord * 2.5, H - bord * 2.5);

    // Export at high quality
    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    capturePhotoURL = dataURL;

    // Upload to server (non-blocking)
    uploadPhoto(dataURL);

  } catch (err) {
    console.warn('[FaceCapture] high-res stream failed, falling back to MediaPipe video:', err);
    captureFromMediPipeVideo();
  } finally {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }
}

function captureFromMediPipeVideo() {
  // Fallback: grab frame from the existing low-res MediaPipe video
  const vid = document.getElementById('input_video');
  if (!vid || !vid.videoWidth) return;
  const W = vid.videoWidth, H = vid.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.filter = 'saturate(1.8) contrast(1.1)';
  ctx.drawImage(vid, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.restore();
  drawCornerAccents(ctx, W, H, '#00c8ff');
  const dataURL = canvas.toDataURL('image/jpeg', 0.9);
  capturePhotoURL = dataURL;
  uploadPhoto(dataURL);
}

function drawCornerAccents(ctx, W, H, color) {
  const len = Math.min(W, H) * 0.07;
  const off = 18;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 16;
  const corners = [
    [off, off, off + len, off, off, off + len],
    [W - off, off, W - off - len, off, W - off, off + len],
    [off, H - off, off + len, H - off, off, H - off - len],
    [W - off, H - off, W - off - len, H - off, W - off, H - off - len],
  ];
  corners.forEach(([x, y, x2, y2, x3, y3]) => {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x2, y2);
    ctx.moveTo(x, y); ctx.lineTo(x3, y3);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;
}

async function uploadPhoto(dataURL) {
  try {
    const res = await api('/api/save_photo', 'POST', { imageData: dataURL });
    if (res.success && res.url) {
      console.log('[FaceCapture] saved to:', res.url);
      // If server returned a remote URL, prefer that (better quality storage)
      if (res.url.startsWith('http')) capturePhotoURL = null; // Use server URL for display
    }
  } catch (e) {
    console.warn('[FaceCapture] upload failed (photo still shown locally):', e);
  }
}

// ── APP CONTROLLER ────────────────────────────────────────────────────────────
const App = {
  currentScreen: 'boot',

  async init() {
    playerData = await api('/api/player');
    shipsData  = await api('/api/ships');
    storeData  = await api('/api/store');

    if (!handTrackingInit) {
      GAME.initHandTracking();
      handTrackingInit = true;
    }
    this.spawnBootStars();
    this.updateCreditsDisplay();
    this.goTo('boot');
  },

  spawnBootStars() {
    const container = document.getElementById('bootStars');
    if (!container) return;
    for (let i = 0; i < 200; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const size = Math.random() * 2.5 + 0.5;
      s.style.cssText = `
        left:${Math.random()*100}%;top:${Math.random()*100}%;
        width:${size}px;height:${size}px;
        --dur:${2+Math.random()*4}s;
        --min-op:${0.1+Math.random()*0.3};
        --max-op:${0.5+Math.random()*0.5};
        animation-delay:${Math.random()*4}s;`;
      container.appendChild(s);
    }
  },

  updateCreditsDisplay() {
    const val = '∞'; // Everything is free / unlimited
    document.getElementById('boot-credits').textContent    = val;
    document.getElementById('hangar-credits').textContent  = val;
    document.getElementById('store-credits').textContent   = val;
  },

  goTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screenId);
    if (target) target.classList.add('active');
    this.currentScreen = screenId;
    if (screenId === 'hangar')      this.initHangar();
    if (screenId === 'store')       Store.init();
    if (screenId === 'leaderboard') Leaderboard.load();
    if (screenId !== 'game')        GAME.stopGame();
  },

  initHangar() {
    const carousel = document.getElementById('shipCarousel');
    carousel.innerHTML = '';
    Object.values(shipsData).forEach(ship => {
      const card = document.createElement('div');
      card.className = 'ship-card' + (ship.id === selectedShip ? ' selected' : '');
      card.dataset.shipId = ship.id;
      card.innerHTML = `
        <div class="ship-card-art">
          <svg class="ship-mini-svg" width="80" height="80" viewBox="-40 -40 80 80"
            style="--ship-color:${ship.color}">${this.shipSVG(ship)}</svg>
        </div>
        <div class="ship-card-name">${ship.name}</div>
        <div class="ship-card-rarity rarity-${ship.rarity}">${ship.rarity}</div>
        <div class="ship-card-price" style="color:#00ff88">✓ UNLOCKED</div>`;
      card.addEventListener('click', () => this.selectShipCard(ship.id));
      carousel.appendChild(card);
    });
    this.selectShipCard(selectedShip);
  },

  shipSVG(ship) {
    const c = ship.color;
    const svgMap = {
      phantom:`<polygon points="0,-30 14,12 6,8 0,14 -6,8 -14,12" fill="${c}44" stroke="${c}" stroke-width="1.5"/>
               <ellipse cx="0" cy="-10" rx="4" ry="7" fill="rgba(255,255,255,0.6)"/>`,
      vortex: `<polygon points="0,-35 20,15 10,8 0,18 -10,8 -20,15" fill="${c}44" stroke="${c}" stroke-width="1.5"/>
               <line x1="-12" y1="10" x2="-12" y2="20" stroke="${c}" stroke-width="3"/>
               <line x1="12" y1="10" x2="12" y2="20" stroke="${c}" stroke-width="3"/>`,
      titan:  `<polygon points="0,-28 22,0 18,18 0,22 -18,18 -22,0" fill="${c}44" stroke="${c}" stroke-width="2"/>
               <line x1="-18" y1="-5" x2="-28" y2="-18" stroke="${c}" stroke-width="4"/>
               <line x1="18" y1="-5" x2="28" y2="-18" stroke="${c}" stroke-width="4"/>`,
      specter:`<polygon points="0,-32 16,0 8,8 0,18 -8,8 -16,0" fill="${c}55" stroke="${c}" stroke-width="1"/>
               <polygon points="-16,0 -32,8 -20,12" fill="${c}44"/>
               <polygon points="16,0 32,8 20,12" fill="${c}44"/>`,
      nova:   `<polygon points="0,-30 10,-10 24,-5 12,8 14,22 0,14 -14,22 -12,8 -24,-5 -10,-10" fill="white" opacity="0.9" stroke="${c}" stroke-width="1.5"/>
               <circle cx="0" cy="0" r="4" fill="white"/>`,
    };
    return svgMap[ship.id] || svgMap.phantom;
  },

  selectShipCard(shipId) {
    selectedShip = shipId;
    document.querySelectorAll('.ship-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.shipId === shipId);
    });
    const ship = shipsData[shipId];
    const detail = document.getElementById('shipDetail');
    const stats = [
      { label: 'SPEED',     val: ship.speed,    max: 12 },
      { label: 'SHIELD',    val: ship.shield,   max: 200 },
      { label: 'FIRE RATE', val: ship.fireRate, max: 10 },
      { label: 'DAMAGE',    val: ship.damage,   max: 50 },
    ];
    detail.innerHTML = `
      <div class="sdp-stats">
        <div class="sdp-desc">${ship.description}</div>
        ${stats.map(s => `
          <div class="stat-row">
            <div class="stat-label">${s.label}</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${(s.val/s.max)*100}%"></div></div>
            <div class="stat-val">${s.val}</div>
          </div>`).join('')}
      </div>`;
    const buyBtn    = document.getElementById('buyShipBtn');
    const launchBtn = document.getElementById('launchBtn');
    buyBtn.style.display  = 'none';
    launchBtn.textContent = '🚀 LAUNCH';
  },

  async launchGame() {
    await api('/api/select_ship', 'POST', { ship_id: selectedShip });
    const ship = shipsData[selectedShip];
    playerData.activeShip = selectedShip;
    this.goTo('game');

    // Reset capture for this gameplay session
    faceCaptured    = false;
    capturePhotoURL = null;
    clearTimeout(captureTimer);
    clearInterval(countdownInterval);

    GAME.startGame(playerData, { ...ship });
    window._onGameOver = this.onGameOver.bind(this);
    captureTimer = setTimeout(startFaceCapture, 800);
  },

  async onGameOver(score, kills, credits) {
    clearTimeout(captureTimer);
    clearInterval(countdownInterval);
    document.getElementById('scan-countdown').classList.remove('active');

    const r = await api('/api/game_over', 'POST', { score, kills, credits });
    playerData.credits   = r.credits;
    playerData.highScore = r.highScore;
    this.updateCreditsDisplay();
    this.showGameOver(score, kills, credits, r);
  },

  showGameOver(score, kills, credits, serverData) {
    this.goTo('gameover');

    document.getElementById('goStats').innerHTML = `
      <div class="go-stat"><div class="go-stat-val">${score.toLocaleString()}</div><div class="go-stat-label">SCORE</div></div>
      <div class="go-stat"><div class="go-stat-val">${kills}</div><div class="go-stat-label">KILLS</div></div>
      <div class="go-stat"><div class="go-stat-val">⚡${credits}</div><div class="go-stat-label">CREDITS</div></div>
      <div class="go-stat"><div class="go-stat-val">${serverData.highScore.toLocaleString()}</div><div class="go-stat-label">HIGH SCORE</div></div>
    `;

    const achEl = document.getElementById('goAchievements');
    achEl.innerHTML = (serverData.newAchievements || []).map(a =>
      `<div class="go-ach">🏆 ${a}</div>`).join('');

    // Pilot photo
    const photoFrame = document.getElementById('go-pilot-frame');
    const photoImg   = document.getElementById('go-pilot-photo');
    if (capturePhotoURL) {
      photoImg.src          = capturePhotoURL;
      photoFrame.style.display = 'flex';
    } else {
      photoFrame.style.display = 'none';
    }

    // Particle burst
    const goCanvas = document.getElementById('goCanvas');
    const gc = goCanvas.getContext('2d');
    goCanvas.width = window.innerWidth;
    goCanvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#00c8ff','#ff00cc','#ffaa00','#00ff88','#ff2244'];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: window.innerWidth/2, y: window.innerHeight/2,
        vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12,
        life: 1, color: colors[Math.floor(Math.random()*colors.length)]
      });
    }
    const goanim = () => {
      gc.clearRect(0, 0, goCanvas.width, goCanvas.height);
      particles.forEach(p => {
        gc.globalAlpha = p.life;
        gc.fillStyle   = p.color;
        gc.beginPath(); gc.arc(p.x, p.y, 3, 0, Math.PI*2); gc.fill();
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.014;
      });
      gc.globalAlpha = 1;
      if (particles.some(p => p.life > 0)) requestAnimationFrame(goanim);
    };
    goanim();
  }
};

// ── STORE ─────────────────────────────────────────────────────────────────────
const Store = {
  init() { this.switchTab('ships'); },

  switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
      b.classList.toggle('active', ['ships','upgrades','powerups'][i] === tab);
    });
    this.renderGrid();
  },

  renderGrid() {
    const grid = document.getElementById('storeGrid');
    grid.innerHTML = '';
    if (currentTab === 'ships') {
      Object.values(storeData.ships || {}).forEach(ship => {
        const card = document.createElement('div');
        card.className = 'store-card';
        card.innerHTML = `
          <div class="store-card-owned">FREE</div>
          <div class="store-card-icon">
            <svg width="60" height="60" viewBox="-35 -35 70 70">${App.shipSVG(ship)}</svg>
          </div>
          <div class="store-card-name">${ship.name}</div>
          <div class="store-card-rarity rarity-${ship.rarity}">${ship.rarity}</div>
          <div class="store-card-desc">${ship.description}</div>
          <div class="store-card-price" style="color:#00ff88">✓ UNLOCKED</div>`;
        grid.appendChild(card);
      });
    } else if (currentTab === 'upgrades') {
      Object.entries(storeData.items || {}).forEach(([id, item]) => {
        const card = document.createElement('div');
        card.className = 'store-card';
        card.innerHTML = `
          <div class="store-card-owned">FREE</div>
          <div class="store-card-icon">${item.icon}</div>
          <div class="store-card-name">${item.name}</div>
          <div class="store-card-desc">${item.description}</div>
          <div class="store-card-price" style="color:#00ff88">✓ ACTIVE</div>`;
        grid.appendChild(card);
      });
    } else if (currentTab === 'powerups') {
      Object.values(storeData.powerups || {}).forEach(pu => {
        const card = document.createElement('div');
        card.className = 'store-card';
        card.innerHTML = `
          <div class="store-card-icon" style="font-size:40px">${pu.icon}</div>
          <div class="store-card-name" style="color:${pu.color}">${pu.name}</div>
          <div class="store-card-desc">Duration: ${pu.duration/1000}s<br>Drops randomly in-game</div>
          <div class="store-card-price" style="color:${pu.color}">AUTO DROP</div>`;
        grid.appendChild(card);
      });
    }
  },

  showMsg(text) {
    const el = document.getElementById('store-msg');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }
};

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
const Leaderboard = {
  async load() {
    const entries = await api('/api/leaderboard');
    const list    = document.getElementById('lbList');
    list.innerHTML = '';
    entries.forEach((entry, i) => {
      const isYou = entry.name === 'YOU';
      const el    = document.createElement('div');
      el.className = 'lb-entry' + (isYou ? ' you' : '');
      const medals = ['🥇','🥈','🥉'];
      const rank   = i < 3 ? medals[i] : `#${i+1}`;
      el.innerHTML = `
        <div class="lb-rank ${['gold','silver','bronze'][i]||''}">${rank}</div>
        <div>
          <div class="lb-name">${isYou ? '▶ YOU' : entry.name}</div>
          <div class="lb-ship">${(entry.ship||'').toUpperCase()}</div>
        </div>
        <div class="lb-score">${(entry.score||0).toLocaleString()}</div>`;
      list.appendChild(el);
    });
  }
};

// ── BOOT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { App.init(); });
