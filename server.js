// ⟁ Void Commander | server.js
// Node.js / Express — Vercel Blob — All Unlocked
// Works on Termux (local) and Vercel (serverless)

import express  from 'express';
import cors     from 'cors';
import path     from 'path';
import fs       from 'fs';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── VERCEL BLOB (native fetch — Node 18+) ────────────────────────────────────
const BLOB_TOKEN  = process.env.BLOB_READ_WRITE_TOKEN || '';
const BLOB_BASE   = 'https://blob.vercel-storage.com';
const BLOB_PREFIX = 'void-commander';

async function blobPut(pathname, buffer, contentType = 'application/octet-stream') {
  if (!BLOB_TOKEN) return null;
  try {
    const res = await fetch(`${BLOB_BASE}/${BLOB_PREFIX}/${pathname}`, {
      method: 'PUT',
      headers: {
        Authorization:         `Bearer ${BLOB_TOKEN}`,
        'Content-Type':        contentType,
        'x-add-random-suffix': '0',
      },
      body: buffer,
    });
    if (res.ok) return (await res.json()).url || null;
  } catch (e) { console.error('[BLOB PUT]', e.message); }
  return null;
}

async function blobFindUrl(pathname) {
  if (!BLOB_TOKEN) return null;
  try {
    const url = `${BLOB_BASE}?prefix=${encodeURIComponent(BLOB_PREFIX + '/' + pathname)}&limit=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BLOB_TOKEN}` } });
    if (res.ok) return (await res.json()).blobs?.[0]?.url || null;
  } catch (e) { console.error('[BLOB LIST]', e.message); }
  return null;
}

async function blobGetJson(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return res.json();
  } catch (e) { console.error('[BLOB GET]', e.message); }
  return null;
}

// ── LOCAL FALLBACK (Termux / dev) ─────────────────────────────────────────────
// On Vercel the filesystem is read-only; use /tmp for any local writes
const DATA_DIR  = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'player.json');
if (!process.env.VERCEL) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');
}

// ── GAME DATA ─────────────────────────────────────────────────────────────────
const ALL_SHIPS    = ['phantom','vortex','titan','specter','nova'];
const ALL_UPGRADES = ['shield_pack','ammo_boost','engine_tune','damage_core'];
const ALL_PASSIVES = ['lucky_charm','auto_repair'];

const SHIPS = {
  phantom: { id:'phantom', name:'PHANTOM X-9',    price:0, speed:7,  shield:80,  fireRate:3,   damage:15, color:'#00c8ff', trailColor:'#0066ff', description:'Balanced interceptor. The legend starts here.', rarity:'STARTER'   },
  vortex:  { id:'vortex',  name:'VORTEX WRAITH',  price:0, speed:10, shield:60,  fireRate:5,   damage:12, color:'#ff00aa', trailColor:'#aa0055', description:'Blazing speed, glass jaw. For the reckless.',   rarity:'RARE'      },
  titan:   { id:'titan',   name:'TITAN FORTRESS', price:0, speed:4,  shield:200, fireRate:1.5, damage:40, color:'#ffaa00', trailColor:'#ff5500', description:'Slow, unstoppable. A walking apocalypse.',      rarity:'EPIC'      },
  specter: { id:'specter', name:'SPECTER VOID',   price:0, speed:9,  shield:100, fireRate:6,   damage:20, color:'#aa00ff', trailColor:'#5500aa', description:'Phase through debris. Born in a black hole.',   rarity:'LEGENDARY' },
  nova:    { id:'nova',    name:'NOVA BLASTER',   price:0, speed:8,  shield:150, fireRate:8,   damage:35, color:'#ffffff', trailColor:'#ffff00', description:'Tri-shot cannon. Stars fear this ship.',         rarity:'MYTHIC'    },
};

const POWERUPS = {
  shield_boost: { name:'SHIELD SURGE',  color:'#00ff88', icon:'shield',    duration:8000 },
  rapid_fire:   { name:'RAPID FIRE',    color:'#ff6600', icon:'bolt',      duration:6000 },
  slow_time:    { name:'TIME WARP',     color:'#aa88ff', icon:'hourglass', duration:5000 },
  magnet:       { name:'CREDIT MAGNET', color:'#ffdd00', icon:'magnet',    duration:7000 },
  invincible:   { name:'NOVA SHIELD',   color:'#ffffff', icon:'star',      duration:3000 },
  double_dmg:   { name:'DOUBLE DAMAGE', color:'#ff2244', icon:'fire',      duration:5000 },
  freeze:       { name:'CRYO BLAST',    color:'#aaeeff', icon:'snowflake', duration:4000 },
  triple_shot:  { name:'TRIPLE SHOT',   color:'#ff88ff', icon:'rocket',    duration:6000 },
};

const STORE_ITEMS = {
  shield_pack: { name:'SHIELD PACK', price:0, description:'+50 Shield',       icon:'shield', type:'upgrade' },
  ammo_boost:  { name:'AMMO BOOST',  price:0, description:'+2 Fire Rate',     icon:'bolt',   type:'upgrade' },
  engine_tune: { name:'ENGINE TUNE', price:0, description:'+1 Speed',         icon:'rocket', type:'upgrade' },
  damage_core: { name:'DAMAGE CORE', price:0, description:'+10 Damage',       icon:'fire',   type:'upgrade' },
  lucky_charm: { name:'LUCKY CHARM', price:0, description:'2x Credits earned',icon:'clover', type:'passive' },
  auto_repair: { name:'AUTO REPAIR', price:0, description:'Slow shield regen',icon:'wrench', type:'passive' },
};

const NPC_LB = [
  { name:'VOID_RACER',  score:25600, ship:'specter' },
  { name:'COSMO_X',     score:19000, ship:'nova'    },
  { name:'STAR_KILLER', score:14400, ship:'vortex'  },
  { name:'NEBULA_7',    score:10200, ship:'titan'   },
  { name:'DARKMATTER',  score:6600,  ship:'phantom' },
];

// ── PLAYER HELPERS ────────────────────────────────────────────────────────────
const defaults = () => ({
  credits:99999, highScore:0, totalGames:0, totalKills:0,
  ownedShips:[...ALL_SHIPS], activeShip:'phantom',
  upgrades:[...ALL_UPGRADES], passives:[...ALL_PASSIVES],
  achievements:[], photoUrl:null,
});

function applyDefaults(d) {
  const def = defaults();
  for (const k of Object.keys(def)) if (!(k in d)) d[k] = def[k];
  for (const id of ALL_SHIPS)    if (!d.ownedShips.includes(id))  d.ownedShips.push(id);
  for (const id of ALL_UPGRADES) if (!d.upgrades.includes(id))    d.upgrades.push(id);
  for (const id of ALL_PASSIVES) if (!d.passives.includes(id))    d.passives.push(id);
  return d;
}

async function loadPlayer() {
  if (BLOB_TOKEN) {
    const url  = await blobFindUrl('player.json');
    if (url) { const d = await blobGetJson(url); if (d) return applyDefaults(d); }
  }
  try {
    return applyDefaults(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch { return defaults(); }
}

async function savePlayer(p) {
  const raw = JSON.stringify(p, null, 2);
  if (BLOB_TOKEN) await blobPut('player.json', Buffer.from(raw), 'application/json');
  try { fs.writeFileSync(DATA_FILE, raw, 'utf8'); } catch {}
}

// ── EXPRESS ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── STATIC FILES (served from root) ──────────────────────────────────────────
app.get('/',         (_, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/game.js',  (_, res) => res.sendFile(path.join(__dirname, 'game.js')));
app.get('/app.js',   (_, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/main.css', (_, res) => res.sendFile(path.join(__dirname, 'main.css')));

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/player', async (_, res) => res.json(await loadPlayer()));

app.get('/api/ships', (_, res) => {
  res.json(Object.fromEntries(Object.entries(SHIPS).map(([k,v]) => [k, {...v, owned:true}])));
});

app.get('/api/store', (_, res) => res.json({ ships:SHIPS, items:STORE_ITEMS, powerups:POWERUPS }));

app.post('/api/buy_ship', async (req, res) => {
  const { ship_id } = req.body || {};
  if (!SHIPS[ship_id]) return res.json({ success:false, msg:'Unknown ship' });
  const p = await loadPlayer();
  if (!p.ownedShips.includes(ship_id)) p.ownedShips.push(ship_id);
  await savePlayer(p);
  res.json({ success:true, credits:p.credits });
});

app.post('/api/select_ship', async (req, res) => {
  const { ship_id } = req.body || {};
  const p = await loadPlayer();
  p.activeShip = ship_id;
  if (!p.ownedShips.includes(ship_id)) p.ownedShips.push(ship_id);
  await savePlayer(p);
  res.json({ success:true });
});

app.post('/api/buy_item', async (req, res) => {
  const { item_id } = req.body || {};
  if (!STORE_ITEMS[item_id]) return res.json({ success:false, msg:'Unknown item' });
  const p = await loadPlayer();
  const item = STORE_ITEMS[item_id];
  if (item.type === 'upgrade' && !p.upgrades.includes(item_id)) p.upgrades.push(item_id);
  if (item.type === 'passive' && !p.passives.includes(item_id)) p.passives.push(item_id);
  await savePlayer(p);
  res.json({ success:true, credits:p.credits });
});

app.post('/api/game_over', async (req, res) => {
  const { score=0, kills=0, credits=0 } = req.body || {};
  const p = await loadPlayer();
  p.credits    += p.passives.includes('lucky_charm') ? credits * 2 : credits;
  p.totalGames += 1;
  p.totalKills += kills;
  if (score > p.highScore) p.highScore = score;
  const newAch = [];
  for (const [key, cond, label] of [
    ['first_game', p.totalGames >= 1,   'FIRST LAUNCH 🚀'],
    ['score_5k',   p.highScore >= 5000,  'WARP JUMPER ⭐'],
    ['score_15k',  p.highScore >= 15000, 'VOID LEGEND 💀'],
    ['killer_50',  p.totalKills >= 50,   'ASTEROID SLAYER 💥'],
    ['killer_200', p.totalKills >= 200,  'MASS EXTINCTION 🌑'],
    ['vet_10',     p.totalGames >= 10,   'VOID VETERAN 🎖'],
  ]) {
    if (cond && !p.achievements.includes(key)) { p.achievements.push(key); newAch.push(label); }
  }
  await savePlayer(p);
  res.json({ credits:p.credits, highScore:p.highScore, newAchievements:newAch });
});

app.post('/api/save_photo', async (req, res) => {
  let { imageData = '' } = req.body || {};
  if (imageData.includes(',')) imageData = imageData.split(',')[1];
  let buf;
  try { buf = Buffer.from(imageData, 'base64'); }
  catch (e) { return res.json({ success:false, msg:`decode error: ${e.message}` }); }

  const ts       = Date.now();
  const filename = `photos/face-${ts}.jpg`;

  if (BLOB_TOKEN) {
    const url = await blobPut(filename, buf, 'image/jpeg');
    if (url) {
      const p = await loadPlayer(); p.photoUrl = url; await savePlayer(p);
      return res.json({ success:true, url });
    }
  }

  // Local fallback (Termux only — Vercel filesystem is read-only)
  if (!process.env.VERCEL) {
    const dir = path.join(__dirname, 'photos');
    fs.mkdirSync(dir, { recursive:true });
    const localPath = path.join(dir, `face-${ts}.jpg`);
    try {
      fs.writeFileSync(localPath, buf);
      // Serve photo files from /photos route
      const localUrl = `/photos/face-${ts}.jpg`;
      const p = await loadPlayer(); p.photoUrl = localUrl; await savePlayer(p);
      return res.json({ success:true, url:localUrl });
    } catch (e) { return res.json({ success:false, msg:e.message }); }
  }
  res.json({ success:false, msg:'No BLOB_READ_WRITE_TOKEN configured' });
});

// Serve locally saved photos (Termux only)
app.use('/photos', express.static(path.join(__dirname, 'photos')));

app.get('/api/leaderboard', async (_, res) => {
  const p = await loadPlayer();
  const entries = [...NPC_LB];
  if (p.highScore > 0) entries.push({ name:'YOU', score:p.highScore, ship:p.activeShip });
  entries.sort((a,b) => b.score - a.score);
  res.json(entries.slice(0, 10));
});

// ── EXPORT for Vercel serverless ──────────────────────────────────────────────
export default app;

// ── LOCAL START (Termux / dev) ────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    let ip = '127.0.0.1';
    try {
      for (const list of Object.values(networkInterfaces())) {
        for (const n of list) {
          if (n.family === 'IPv4' && !n.internal) { ip = n.address; break; }
        }
      }
    } catch {}
    console.log(`\n🟢 VOID COMMANDER running!`);
    console.log(`🎮 Local:  http://127.0.0.1:${PORT}`);
    console.log(`📱 LAN:    http://${ip}:${PORT}\n`);
  });
}
