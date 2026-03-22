/* ══════════════════════════════════════════════════════════
   VOID COMMANDER — APP CONTROLLER v2
   + Vercel Blob | Face-detect Capture | All Unlocked
══════════════════════════════════════════════════════════ */

// ── STATE ─────────────────────────────────────────────────
let playerData   = {};
let shipsData    = {};
let storeData    = {};
let selectedShip = 'phantom';
let handTrackingInit = false;
let currentTab   = 'ships';

// ── FACE CAPTURE STATE ────────────────────────────────────
let faceCaptured    = false;
let capturePhotoURL = null;   // local data URL shown on game-over
let capturePhotoBlob = null;  // remote blob URL (for display if available)
let faceWatchInterval = null; // interval that polls for face presence
let faceSeenSince     = null; // timestamp when face was first detected
let countdownInterval = null;
let countdownActive   = false;
let countdownRemaining = 0;

// ── API ───────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

// ═══════════════════════════════════════════════════════════
//  FACE CAPTURE — uses the EXISTING input_video stream
//  (MediaPipe already owns the camera, never open a 2nd one)
// ═══════════════════════════════════════════════════════════

/**
 * Sample the centre region of input_video.
 * Returns true if non-black pixels found (face / person present).
 */
function isFacePresent() {
  const vid = document.getElementById('input_video');
  if (!vid || vid.readyState < 2 || !vid.videoWidth) return false;

  // Tiny offscreen canvas — just 32×24 for speed
  const W = 32, H = 24;
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const ctx = tmp.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(vid, 0, 0, W, H);

  // Sample a 5×5 grid in the centre third
  const data = ctx.getImageData(W/3, H/3, W/3, H/3).data;
  let bright = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Average luminance
    if ((data[i] + data[i+1] + data[i+2]) / 3 > 20) bright++;
  }
  // If more than 20% of sampled pixels are non-black → something is there
  return bright > (data.length / 4) * 0.2;
}

/**
 * Start watching for a face in frame.
 * Once face is present for 5 continuous seconds → capture.
 */
function startFaceWatch() {
  if (faceCaptured) return;
  stopFaceWatch(); // clear any previous watcher

  const overlay  = document.getElementById('scan-countdown');
  const numEl    = document.getElementById('scan-num');

  faceWatchInterval = setInterval(() => {
    if (faceCaptured) { stopFaceWatch(); return; }

    const present = isFacePresent();

    if (present) {
      if (!faceSeenSince) {
        faceSeenSince = Date.now();
        // Show overlay
        overlay.classList.add('active');
        countdownActive    = true;
        countdownRemaining = 5;
        numEl.textContent  = countdownRemaining;

        countdownInterval = setInterval(() => {
          countdownRemaining--;
          numEl.textContent = countdownRemaining > 0 ? countdownRemaining : '📸';
          if (countdownRemaining <= 0) {
            clearInterval(countdownInterval);
          }
        }, 1000);
      }

      // Has face been present for >= 5 seconds?
      if (Date.now() - faceSeenSince >= 5000) {
        stopFaceWatch();
        faceCaptured = true;
        captureFromVideo();
        setTimeout(() => overlay.classList.remove('active'), 900);
      }

    } else {
      // Face left — reset countdown
      if (faceSeenSince) {
        faceSeenSince = null;
        clearInterval(countdownInterval);
        overlay.classList.remove('active');
        countdownActive = false;
      }
    }
  }, 200); // poll every 200 ms
}

function stopFaceWatch() {
  clearInterval(faceWatchInterval);
  clearInterval(countdownInterval);
  faceWatchInterval = null;
  faceSeenSince     = null;
}

/**
 * Capture a frame from the EXISTING input_video (already running via MediaPipe).
 * Add neon overlay + metadata, then upload.
 */
function captureFromVideo() {
  const vid = document.getElementById('input_video');
  if (!vid || !vid.videoWidth) return;

  const W = vid.videoWidth;
  const H = vid.videoHeight;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Mirror + colour boost
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.filter = 'saturate(1.8) contrast(1.15) brightness(1.08)';
  ctx.drawImage(vid, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.restore();

  // Colour-cast overlay
  ctx.globalCompositeOperation = 'overlay';
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, 'rgba(0,200,255,0.12)');
  grad.addColorStop(1, 'rgba(180,0,255,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // Scan-lines
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;

  // Neon frame
  const b = 8;
  ctx.strokeStyle = '#00c8ff';
  ctx.lineWidth   = b;
  ctx.shadowColor = '#00c8ff';
  ctx.shadowBlur  = 24;
  ctx.strokeRect(b/2, b/2, W - b, H - b);

  // Corner accents
  drawCornerAccents(ctx, W, H, '#00c8ff');

  // Inner magenta frame
  ctx.strokeStyle = '#ff00cc';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#ff00cc';
  ctx.shadowBlur  = 10;
  ctx.strokeRect(b*2.5, b*2.5, W - b*5, H - b*5);
  ctx.shadowBlur  = 0;

  // Top-left label
  ctx.textAlign   = 'left';
  ctx.fillStyle   = '#00c8ff';
  ctx.shadowColor = '#00c8ff';
  ctx.shadowBlur  = 12;
  ctx.font        = `bold ${Math.max(10, Math.round(W * 0.055))}px Orbitron, monospace`;
  ctx.fillText('▸ PILOT SCAN', b * 2.5, b * 5.5);

  // Top-right ship name
  const shipName = (shipsData[selectedShip]?.name || 'PHANTOM X-9').toUpperCase();
  ctx.textAlign   = 'right';
  ctx.fillStyle   = '#ff00cc';
  ctx.shadowColor = '#ff00cc';
  ctx.font        = `${Math.max(8, Math.round(W * 0.04))}px Orbitron, monospace`;
  ctx.fillText(shipName, W - b * 2.5, b * 5.5);

  // Bottom timestamp
  ctx.textAlign   = 'left';
  ctx.fillStyle   = 'rgba(200,224,255,0.9)';
  ctx.shadowBlur  = 0;
  ctx.font        = `${Math.max(7, Math.round(W * 0.038))}px Rajdhani, monospace`;
  const stamp = new Date().toISOString().replace('T', '  ').slice(0, 19);
  ctx.fillText(stamp, b * 2.5, H - b * 2.5);

  // Bottom-right watermark
  ctx.textAlign   = 'right';
  ctx.fillStyle   = 'rgba(0,200,255,0.55)';
  ctx.font        = `${Math.max(6, Math.round(W * 0.03))}px Orbitron, monospace`;
  ctx.fillText('VOID COMMANDER', W - b * 2.5, H - b * 2.5);

  const dataURL = canvas.toDataURL('image/jpeg', 0.95);
  capturePhotoURL = dataURL; // always keep local copy for display

  uploadPhoto(dataURL);
}

function drawCornerAccents(ctx, W, H, color) {
  const len = Math.min(W, H) * 0.09;
  const off = 14;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14;
  [
    [off, off,     off+len, off,     off,     off+len],
    [W-off, off,   W-off-len, off,   W-off,   off+len],
    [off, H-off,   off+len, H-off,   off,     H-off-len],
    [W-off, H-off, W-off-len, H-off, W-off,   H-off-len],
  ].forEach(([x,y,x2,y2,x3,y3]) => {
    ctx.beginPath();
    ctx.moveTo(x,y);  ctx.lineTo(x2,y2);
    ctx.moveTo(x,y);  ctx.lineTo(x3,y3);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;
}

async function uploadPhoto(dataURL) {
  try {
    const res = await api('/api/save_photo', 'POST', { imageData: dataURL });
    if (res.success) {
      console.log('[FaceCapture] uploaded:', res.url);
      // Keep the remote URL for display; fall back to local if it's not remote
      if (res.url && res.url.startsWith('http')) {
        capturePhotoBlob = res.url; // remote CDN URL
      }
    } else {
      console.warn('[FaceCapture] server error:', res.msg);
    }
  } catch (e) {
    console.warn('[FaceCapture] upload failed (local copy still shown):', e);
  }
}

// ── APP CONTROLLER ────────────────────────────────────────
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
    const c = document.getElementById('bootStars');
    if (!c) return;
    for (let i = 0; i < 200; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 2.5 + 0.5;
      s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;
        width:${sz}px;height:${sz}px;
        --dur:${2+Math.random()*4}s;
        --min-op:${0.1+Math.random()*0.3};
        --max-op:${0.5+Math.random()*0.5};
        animation-delay:${Math.random()*4}s;`;
      c.appendChild(s);
    }
  },

  updateCreditsDisplay() {
    ['boot-credits','hangar-credits','store-credits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '∞';
    });
  },

  goTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const t = document.getElementById('screen-' + screenId);
    if (t) t.classList.add('active');
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
    return ({
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
    })[ship.id] || '';
  },

  selectShipCard(shipId) {
    selectedShip = shipId;
    document.querySelectorAll('.ship-card').forEach(c =>
      c.classList.toggle('selected', c.dataset.shipId === shipId));
    const ship = shipsData[shipId];
    const stats = [
      { label:'SPEED',     val:ship.speed,    max:12  },
      { label:'SHIELD',    val:ship.shield,   max:200 },
      { label:'FIRE RATE', val:ship.fireRate, max:10  },
      { label:'DAMAGE',    val:ship.damage,   max:50  },
    ];
    document.getElementById('shipDetail').innerHTML = `
      <div class="sdp-stats">
        <div class="sdp-desc">${ship.description}</div>
        ${stats.map(s => `
          <div class="stat-row">
            <div class="stat-label">${s.label}</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${(s.val/s.max)*100}%"></div></div>
            <div class="stat-val">${s.val}</div>
          </div>`).join('')}
      </div>`;
    document.getElementById('buyShipBtn').style.display = 'none';
    document.getElementById('launchBtn').textContent    = '🚀 LAUNCH';
  },

  async launchGame() {
    await api('/api/select_ship', 'POST', { ship_id: selectedShip });
    const ship = shipsData[selectedShip];
    playerData.activeShip = selectedShip;
    this.goTo('game');

    // Reset capture state for this session
    faceCaptured     = false;
    capturePhotoURL  = null;
    capturePhotoBlob = null;
    stopFaceWatch();

    GAME.startGame(playerData, { ...ship });
    window._onGameOver = this.onGameOver.bind(this);

    // Start watching for a face — will auto-capture when face present 5s
    startFaceWatch();
  },

  async onGameOver(score, kills, credits) {
    stopFaceWatch();
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
      <div class="go-stat"><div class="go-stat-val">${serverData.highScore.toLocaleString()}</div><div class="go-stat-label">HIGH SCORE</div></div>`;

    document.getElementById('goAchievements').innerHTML =
      (serverData.newAchievements || []).map(a => `<div class="go-ach">🏆 ${a}</div>`).join('');

    // Show photo — prefer blob URL, fall back to local data URL
    const photoSrc    = capturePhotoBlob || capturePhotoURL;
    const photoFrame  = document.getElementById('go-pilot-frame');
    const photoImg    = document.getElementById('go-pilot-photo');
    if (photoSrc) {
      photoImg.src           = photoSrc;
      photoFrame.style.display = 'flex';
    } else {
      photoFrame.style.display = 'none';
    }

    // Particle burst
    const goCanvas = document.getElementById('goCanvas');
    const gc = goCanvas.getContext('2d');
    goCanvas.width  = window.innerWidth;
    goCanvas.height = window.innerHeight;
    const colors = ['#00c8ff','#ff00cc','#ffaa00','#00ff88','#ff2244'];
    const parts  = Array.from({ length: 120 }, () => ({
      x: window.innerWidth/2, y: window.innerHeight/2,
      vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12,
      life: 1, color: colors[Math.floor(Math.random()*colors.length)]
    }));
    const goanim = () => {
      gc.clearRect(0, 0, goCanvas.width, goCanvas.height);
      parts.forEach(p => {
        gc.globalAlpha = p.life;
        gc.fillStyle   = p.color;
        gc.beginPath(); gc.arc(p.x, p.y, 3, 0, Math.PI*2); gc.fill();
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.014;
      });
      gc.globalAlpha = 1;
      if (parts.some(p => p.life > 0)) requestAnimationFrame(goanim);
    };
    goanim();
  }
};

// ── STORE ─────────────────────────────────────────────────
const Store = {
  init() { this.switchTab('ships'); },
  switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach((b, i) =>
      b.classList.toggle('active', ['ships','upgrades','powerups'][i] === tab));
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
          <div class="store-card-icon"><svg width="60" height="60" viewBox="-35 -35 70 70">${App.shipSVG(ship)}</svg></div>
          <div class="store-card-name">${ship.name}</div>
          <div class="store-card-rarity rarity-${ship.rarity}">${ship.rarity}</div>
          <div class="store-card-desc">${ship.description}</div>
          <div class="store-card-price" style="color:#00ff88">✓ UNLOCKED</div>`;
        grid.appendChild(card);
      });
    } else if (currentTab === 'upgrades') {
      Object.entries(storeData.items || {}).forEach(([, item]) => {
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
    } else {
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
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove('show'), 2500);
  }
};

// ── LEADERBOARD ───────────────────────────────────────────
const Leaderboard = {
  async load() {
    const entries = await api('/api/leaderboard');
    const list    = document.getElementById('lbList');
    list.innerHTML = '';
    entries.forEach((e, i) => {
      const isYou = e.name === 'YOU';
      const el    = document.createElement('div');
      el.className = 'lb-entry' + (isYou ? ' you' : '');
      const medals = ['🥇','🥈','🥉'];
      el.innerHTML = `
        <div class="lb-rank ${['gold','silver','bronze'][i]||''}">${i < 3 ? medals[i] : '#'+(i+1)}</div>
        <div>
          <div class="lb-name">${isYou ? '▶ YOU' : e.name}</div>
          <div class="lb-ship">${(e.ship||'').toUpperCase()}</div>
        </div>
        <div class="lb-score">${(e.score||0).toLocaleString()}</div>`;
      list.appendChild(el);
    });
  }
};

// ── BOOT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => App.init());
