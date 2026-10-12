// node scripts/backtest.js  -> honest check of the strategy on recent Binance history (needs internet)
const S = require('../www/strategy.js');
(async () => {
  const T = { n: 0, tp1: 0, tp2: 0, sl: 0 };
  for (const [pair, sym] of Object.entries(S.PAIRS)) {
    try {
      const k = await S.klines(sym, '15m', 1500), k1 = await S.klines(sym, '1h', 1000);
      const r = { n: 0, tp1: 0, tp2: 0, sl: 0 };
      for (const s of S.signals(pair, k, k1)) {
        const i = k.findIndex((x) => x[6] === s.time), b = s.side === 'BUY', sl = +s.sl, t1 = +s.tp1, t2 = +s.tp2;
        let st = 0, res = null;
        for (let m = i + 1; m < Math.min(k.length, i + 97); m++) {
          const hi = k[m][2], lo = k[m][3], stop = b ? lo <= sl : hi >= sl, h1 = b ? hi >= t1 : lo <= t1, h2 = b ? hi >= t2 : lo <= t2;
          if (!st) { if (stop) { res = 'sl'; break; } if (h1) { st = 1; if (h2) { res = 'tp2'; break; } } }
          else { if (h2) { res = 'tp2'; break; } if (stop) { res = 'tp1'; break; } }
        }
        if (!res && st) res = 'tp1';
        if (!res) continue; // unresolved
        r.n++; r[res]++;
      }
      for (const x of ['n', 'tp1', 'tp2', 'sl']) T[x] += r[x];
      const w = r.tp1 + r.tp2;
      console.log(pair.padEnd(8), 'signals', r.n, '| TP1+ ', w, '| SL', r.sl);
    } catch (e) { console.log(pair, 'failed:', e.message); }
  }
  const w = T.tp1 + T.tp2, wr = w / (T.n || 1);
  console.log(`\nTOTAL ${T.n} signals | TP1 reached ${(wr * 100).toFixed(0)}% | SL ${(100 - wr * 100).toFixed(0)}% | TP2 ${T.tp2}`);
  console.log(`Expectancy if you exit at TP1: ${(wr * 1.5 - (1 - wr)).toFixed(2)} R per trade (before fees/slippage). Small sample, not a guarantee.`);
})();
