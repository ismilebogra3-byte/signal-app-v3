// Runs on GitHub Actions (or any server) every ~5 min: Binance candles -> signals -> Firebase push
const fs = require('fs');
const S = require('../www/strategy.js');
const FILE = 'data/signals.json';

async function main() {
  const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const before = JSON.stringify(db);
  const fresh = [];
  for (const [p, sym] of Object.entries(S.PAIRS)) {
    db[p] = db[p] || [];
    try {
      const [k, k1] = await Promise.all([S.klines(sym, '15m', 500), S.klines(sym, '1h', 500)]);
      const m = new Map(db[p].map((x) => [x.id, x]));
      for (const s of S.signals(p, k, k1)) if (!m.has(s.id)) { m.set(s.id, s); if (Date.now() - s.time < 45 * 60 * 1000) fresh.push(s); }
      db[p] = [...m.values()].sort((a, b) => b.time - a.time).slice(0, 40);
    } catch (e) { console.error(p, 'failed:', e.message); }
  }
  if (fresh.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!sa) console.error('FIREBASE_SERVICE_ACCOUNT secret missing, no push sent');
    else {
      const admin = require('firebase-admin');
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
      for (const s of fresh.sort((a, b) => a.time - b.time)) {
        await admin.messaging().send({
          topic: 'signals',
          notification: { title: `${s.pair} ${s.side}`, body: `Entry ${s.entry} | TP1 ${s.tp1} | TP2 ${s.tp2} | SL ${s.sl}` },
          data: { pair: s.pair, side: s.side },
          android: { priority: 'high', notification: { channelId: 'signals' } },
        });
        console.log('pushed', s.id);
      }
    }
  }
  const after = JSON.stringify(db);
  if (after !== before) fs.writeFileSync(FILE, JSON.stringify(db));
}
main().catch((e) => { console.error(e); process.exit(1); });
