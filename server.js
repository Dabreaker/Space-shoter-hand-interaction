// ⟁ Project: Void Commander | File: server.js
// ʘ Author: Dabreakr | Node.js/Express | Vercel Blob | All Unlocked

import express     from 'express';
import cors        from 'cors';
import path        from 'path';
import fs          from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── VERCEL BLOB ───────────────────────────────────────────────────────────────
const BLOB_TOKEN  = process.env.BLOB_READ_WRITE_TOKEN || '';
const BLOB_BASE   = 'https://blob.vercel-storage.com';
const BLOB_PREFIX = 'void-commander';

async function blobPut(pathname, buffer, contentType = 'application/octet-stream') {
  if (!BLOB_TOKEN) return null;
  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(`${BLOB_BASE}/${BLOB_PREFIX}/${pathname}`, {
      method: 'PUT',
      headers: {
        Authorization:       `Bearer ${BLOB_TOKEN}`,
        'Content-Type':      contentType,
        'x-add-random-suffix': '0',
      },
      body: buffer,
    });
    if (res.ok) {
      const json = await res.json();
      return json.url || null;
    }
  } catch (e) { console.error('[BLOB PUT]', e.message); }
  return null;
}

async function blobFindUrl(pathname) {
  if (!BLOB_TOKEN) return null;
  try {
    const { default: fetch } = await import('node-fetch');
    const url = `${BLOB_BASE}?prefix=${encodeURIComponent(BLOB_PREFIX + '/' + pathname)}&limit=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BLOB_TOKEN}` }
    });
    if (res.ok) {
      const json = await res.json();
      return json.blobs?.[0]?.url || null;
    }
  } catch (e) { console.error('[BLOB LIST]', e.message); }
  return null;
}

async function blobGetJson(url) {
  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(url);
    if (res.ok) return res.json();
  } catch (e) { console.error('[BLOB GET]', e.message); }
  return null;
}

// ── LOCAL FALLBACK ────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'player.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');

// ── GAME DATA ─────────────────────────────────────────────────────────────────
const ALL_SHIP_IDS    = ['phantom','vortex','titan','specter','nova'];
const ALL_UPGRADE_IDS = ['shield_pack','ammo_boost','engine_tune','damage_core'];
const ALL_PASSIVE_IDS = ['lucky_charm','auto_repair'];

const SHIPS = {
  phantom: { id:'phantom', name:'PHANTOM X-9',    price:0, speed:7,  shield:80,  fireRate:3,   damage:15, color:'#00c8ff', trailColor:'#0066ff', description:'Balanced interceptor. The legend starts here.', rarity:'STARTER'   },
  vortex:  { id:'vortex',  name:'VORTEX WRAITH',  price:0, speed:10, shield:60,  fireRate:5,   damage:12, color:'#ff00aa', trailColor:'#aa0055', description:'Blazing speed, glass jaw. For the reckless.',   rarity:'RARE'      },
  titan:   { id:'titan',   name:'TITAN FORTRESS', price:0, speed:4,  shield:200, fireRate:1.5, damage:40, color:'#ffaa00', trailColor:'#ff5500', description:'Slow, unstoppable. A walking apocalypse.',      rarity:'EPIC'      },
  specter:  { id:'specter', name:'SPECTER VOID',   price:0, speed:9,  shield:100, fireRate:6,   damage:20, color:'#aa00ff', trailColor:'#5500aa', description:'Phase through debris. Born in a black hole.',   rarity:'LEGENDARY' },
  nova:    { id:'nova',    name:'NOVA BLASTER',   price:0, speed:8,  shield:150, fireRate:8,   damage:35, color:'#ffffff', trailColor:'#ffff00', description:'Tri-shot cannon. Stars fear this ship.',         rarity:'MYTHIC'    },
};

const POWERUPS = {
  shield_boost: { name:'SHIELD SURGE',   color:'#00ff88', icon:'shield',    duration:8000 },
  rapid_fire:   { name:'RAPID FIRE',     color:'#ff6600', icon:'bolt',      duration:6000 },
  slow_time:    { name:'TIME WARP',      color:'#aa88ff', icon:'hourglass', duration:5000 },
  magnet:       { name:'CREDIT MAGNET',  color:'#ffdd00', icon:'magnet',    duration:7000 },
  invincible:   { name:'NOVA SHIELD',    color:'#ffffff', icon:'star',      duration:3000 },
  double_dmg:   { name:'DOUBLE DAMAGE',  color:'#ff2244', icon:'fire',      duration:5000 },
  freeze:       { name:'CRYO BLAST',     color:'#aaeeff', icon:'snowflake', duration:4000 },
  triple_shot:  { name:'TRIPLE SHOT',    color:'#ff88ff', icon:'rocket',    duration:6000 },
};

const STORE_ITEMS = {
  shield_pack:  { name:'SHIELD PACK',  price:0, description:'+50 Shield',        icon:'shield', type:'upgrade' },
  ammo_boost:   { name:'AMMO BOOST',   price:0, description:'+2 Fire Rate',      icon:'bolt',   type:'upgrade' },
  engine_tune:  { name:'ENGINE TUNE',  price:0, description:'+1 Speed',          icon:'rocket', type:'upgrade' },
  damage_core:  { name:'DAMAGE CORE',  price:0, description:'+10 Damage',        icon:'fire',   type:'upgrade' },
  lucky_charm:  { name:'LUCKY CHARM',  price:0, description:'2x Credits earned', icon:'clover', type:'passive' },
  auto_repair:  { name:'AUTO REPAIR',  price:0, description:'Slow shield regen', icon:'wrench', type:'passive' },
};

const NPC_LEADERBOARD = [
  { name:'VOID_RACER',  score:25600, ship:'specter' },
  { name:'COSMO_X',     score:19000, ship:'nova'    },
  { name:'STAR_KILLER', score:14400, ship:'vortex'  },
  { name:'NEBULA_7',    score:10200, ship:'titan'   },
  { name:'DARKMATTER',  score:6600,  ship:'phantom' },
];

// ── PLAYER HELPERS ────────────────────────────────────────────────────────────
function getDefaults() {
  return {
    credits: 99999, highScore: 0, totalGames: 0, totalKills: 0,
    ownedShips:  [...ALL_SHIP_IDS],
    activeShip:  'phantom',
    upgrades:    [...ALL_UPGRADE_IDS],
    passives:    [...ALL_PASSIVE_IDS],
    achievements: [],
    photoUrl: null,
  };
}

function applyDefaults(data) {
  const defs = getDefaults();
  for (const k of Object.keys(defs)) {
    if (!(k in data)) data[k] = defs[k];
  }
  for (const id of ALL_SHIP_IDS)    if (!data.ownedShips.includes(id))  data.ownedShips.push(id);
  for (const id of ALL_UPGRADE_IDS) if (!data.upgrades.includes(id))    data.upgrades.push(id);
  for (const id of ALL_PASSIVE_IDS) if (!data.passives.includes(id))    data.passives.push(id);
  return data;
}

async function loadPlayer() {
  if (BLOB_TOKEN) {
    const url  = await blobFindUrl('player.json');
    if (url) {
      const data = await blobGetJson(url);
      if (data) return applyDefaults(data);
    }
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return applyDefaults(JSON.parse(raw));
  } catch {
    return getDefaults();
  }
}

async function savePlayer(player) {
  const raw = JSON.stringify(player, null, 2);
  if (BLOB_TOKEN) {
    await blobPut('player.json', Buffer.from(raw), 'application/json');
  }
  try { fs.writeFileSync(DATA_FILE, raw, 'utf8'); } catch (e) { console.error('[LOCAL SAVE]', e.message); }
}

// ── EXPRESS APP ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Need large limit for base64 photos
app.use('/static', express.static(path.join(__dirname, 'static')));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// ── API ROUTES ────────────────────────────────────────────────────────────────

app.get('/api/player', async (req, res) => {
  res.json(await loadPlayer());
});

app.get('/api/ships', async (req, res) => {
  const ships = Object.fromEntries(
    Object.entries(SHIPS).map(([k, v]) => [k, { ...v, owned: true }])
  );
  res.json(ships);
});

app.get('/api/store', (req, res) => {
  res.json({ ships: SHIPS, items: STORE_ITEMS, powerups: POWERUPS });
});

app.post('/api/buy_ship', async (req, res) => {
  const { ship_id } = req.body || {};
  if (!SHIPS[ship_id]) return res.json({ success: false, msg: 'Unknown ship' });
  const player = await loadPlayer();
  if (!player.ownedShips.includes(ship_id)) player.ownedShips.push(ship_id);
  await savePlayer(player);
  res.json({ success: true, credits: player.credits });
});

app.post('/api/select_ship', async (req, res) => {
  const { ship_id } = req.body || {};
  const player = await loadPlayer();
  player.activeShip = ship_id;
  if (!player.ownedShips.includes(ship_id)) player.ownedShips.push(ship_id);
  await savePlayer(player);
  res.json({ success: true });
});

app.post('/api/buy_item', async (req, res) => {
  const { item_id } = req.body || {};
  if (!STORE_ITEMS[item_id]) return res.json({ success: false, msg: 'Unknown item' });
  const player = await loadPlayer();
  const item = STORE_ITEMS[item_id];
  if (item.type === 'upgrade' && !player.upgrades.includes(item_id)) player.upgrades.push(item_id);
  if (item.type === 'passive' && !player.passives.includes(item_id)) player.passives.push(item_id);
  await savePlayer(player);
  res.json({ success: true, credits: player.credits });
});

app.post('/api/game_over', async (req, res) => {
  const { score = 0, kills = 0, credits = 0 } = req.body || {};
  const player = await loadPlayer();
  const earned = player.passives.includes('lucky_charm') ? credits * 2 : credits;
  player.credits    += earned;
  player.totalGames += 1;
  player.totalKills += kills;
  if (score > player.highScore) player.highScore = score;

  const newAch = [];
  const checks = [
    ['first_game', player.totalGames >= 1,    'FIRST LAUNCH 🚀'],
    ['score_5k',   player.highScore >= 5000,   'WARP JUMPER ⭐'],
    ['score_15k',  player.highScore >= 15000,  'VOID LEGEND 💀'],
    ['killer_50',  player.totalKills >= 50,    'ASTEROID SLAYER 💥'],
    ['killer_200', player.totalKills >= 200,   'MASS EXTINCTION 🌑'],
    ['vet_10',     player.totalGames >= 10,    'VOID VETERAN 🎖'],
  ];
  for (const [key, cond, label] of checks) {
    if (cond && !player.achievements.includes(key)) {
      player.achievements.push(key);
      newAch.push(label);
    }
  }

  await savePlayer(player);
  res.json({ credits: player.credits, highScore: player.highScore, newAchievements: newAch });
});

app.post('/api/save_photo', async (req, res) => {
  let { imageData = '' } = req.body || {};
  if (imageData.includes(',')) imageData = imageData.split(',')[1];

  let buf;
  try { buf = Buffer.from(imageData, 'base64'); }
  catch (e) { return res.json({ success: false, msg: `decode error: ${e.message}` }); }

  const ts       = Date.now();
  const filename = `photos/face-${ts}.jpg`;

  // Try Vercel Blob
  if (BLOB_TOKEN) {
    const url = await blobPut(filename, buf, 'image/jpeg');
    if (url) {
      const player = await loadPlayer();
      player.photoUrl = url;
      await savePlayer(player);
      return res.json({ success: true, url });
    }
  }

  // Local fallback
  const photoDir = path.join(__dirname, 'static', 'photos');
  fs.mkdirSync(photoDir, { recursive: true });
  const localPath = path.join(photoDir, `face-${ts}.jpg`);
  try {
    fs.writeFileSync(localPath, buf);
    const localUrl = `/static/photos/face-${ts}.jpg`;
    const player = await loadPlayer();
    player.photoUrl = localUrl;
    await savePlayer(player);
    res.json({ success: true, url: localUrl });
  } catch (e) {
    res.json({ success: false, msg: e.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  const player  = await loadPlayer();
  const entries = [...NPC_LEADERBOARD];
  if (player.highScore > 0) {
    entries.push({ name: 'YOU', score: player.highScore, ship: player.activeShip });
  }
  entries.sort((a, b) => b.score - a.score);
  res.json(entries.slice(0, 10));
});

// ── START ─────────────────────────────────────────────────────────────────────
import { networkInterfaces } from 'os';

function getLocalIP() {
  try {
    for (const list of Object.values(networkInterfaces())) {
      for (const n of list) {
        if (n.family === 'IPv4' && !n.internal) return n.address;
      }
    }
  } catch {}
  return '127.0.0.1';
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n🟢 VOID COMMANDER running!`);
  console.log(`🎮 Local:  http://127.0.0.1:${PORT}`);
  console.log(`📱 LAN:    http://${ip}:${PORT}\n`);
});
