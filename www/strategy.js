// One strategy file used by the app (browser) and the bot (Node). Binance data only.
(function (g) {
  const PAIRS = { XAUUSD: 'XAUUSDT', BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT', BNBUSD: 'BNBUSDT',
    SOLUSD: 'SOLUSDT', XRPUSD: 'XRPUSDT', DOGEUSD: 'DOGEUSDT', ADAUSD: 'ADAUSDT' };
  const HOSTS = ['https://fapi.binance.com/fapi/v1/klines', 'https://data-api.binance.vision/api/v3/klines'];

  async function klines(sym, tf, limit) {
    const errs = [];
    for (const h of HOSTS) {
      try {
        const r = await fetch(`${h}?symbol=${sym}&interval=${tf}&limit=${limit}`);
        if (!r.ok) throw new Error(r.status + ' ' + new URL(h).host);
        const k = (await r.json()).map((x) => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5], +x[6]]).filter((x) => x[6] < Date.now());
        if (k.length > 100) return k;
        errs.push('few candles');
      } catch (e) { errs.push(e.message); }
    }
    throw new Error(errs.join(' | '));
  }

  const ema = (a, p) => { const k = 2 / (p + 1); let e = a[0]; return a.map((v, i) => (i ? (e = v * k + e * (1 - k)) : e)); };
  function rsi(c, p = 14) {
    const r = Array(c.length).fill(50); let g = 0, l = 0;
    for (let i = 1; i < c.length; i++) {
      const d = c[i] - c[i - 1], u = Math.max(d, 0), w = Math.max(-d, 0);
      if (i <= p) { g += u / p; l += w / p; } else { g = (g * (p - 1) + u) / p; l = (l * (p - 1) + w) / p; }
      if (i >= p) r[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return r;
  }
  function atr(h, l, c, p = 14) {
    const t = h.map((x, i) => (i ? Math.max(x - l[i], Math.abs(x - c[i - 1]), Math.abs(l[i] - c[i - 1])) : x - l[i]));
    let a = t[0]; return t.map((v, i) => (i ? (a = (a * (p - 1) + v) / p) : a));
  }
  function adx(h, l, c, p = 14) {
    const n = c.length, out = Array(n).fill(0), dx = []; let sT = 0, sP = 0, sM = 0, a = 0;
    for (let i = 1; i < n; i++) {
      const u = h[i] - h[i - 1], d = l[i - 1] - l[i];
      const t = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
      const P = u > d && u > 0 ? u : 0, M = d > u && d > 0 ? d : 0;
      if (i <= p) { sT += t; sP += P; sM += M; } else { sT = sT - sT / p + t; sP = sP - sP / p + P; sM = sM - sM / p + M; }
      if (i >= p) {
        const pi = 100 * sP / sT, mi = 100 * sM / sT, x = 100 * Math.abs(pi - mi) / ((pi + mi) || 1);
        if (i < 2 * p) { dx.push(x); if (i === 2 * p - 1) a = dx.reduce((s, v) => s + v, 0) / p; } else a = (a * (p - 1) + x) / p;
        out[i] = a;
      }
    }
    return out;
  }
  const dp = (p) => (p >= 1000 ? 2 : p >= 10 ? 3 : p >= 1 ? 4 : 5);

  // k = 15m candles, k1 = 1h candles: [openTime, o, h, l, c, vol, closeTime]
  function signals(pair, k, k1) {
    const o = k.map((x) => x[1]), h = k.map((x) => x[2]), l = k.map((x) => x[3]), c = k.map((x) => x[4]),
      v = k.map((x) => x[5]), ct = k.map((x) => x[6]);
    const e9 = ema(c, 9), e21 = ema(c, 21), e50 = ema(c, 50), R = rsi(c), A = atr(h, l, c), X = adx(h, l, c);
    const c1 = k1.map((x) => x[4]), t1 = k1.map((x) => x[6]), f50 = ema(c1, 50), f200 = ema(c1, 200);
    const out = []; let j = -1, last = -99;
    for (let i = 60; i < k.length; i++) {
      while (j + 1 < k1.length && t1[j + 1] <= ct[i]) j++;
      if (j < 200) continue;
      const vavg = v.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20;
      const upT = c1[j] > f200[j] && f50[j] > f200[j], dnT = c1[j] < f200[j] && f50[j] < f200[j];
      const buy = upT && e9[i - 1] <= e21[i - 1] && e9[i] > e21[i] && c[i] > e50[i] && R[i] >= 50 && R[i] <= 68 && c[i] > o[i];
      const sell = dnT && e9[i - 1] >= e21[i - 1] && e9[i] < e21[i] && c[i] < e50[i] && R[i] <= 50 && R[i] >= 32 && c[i] < o[i];
      if (!(buy || sell) || X[i] < 20 || v[i] < vavg * 0.9 || i - last < 4) continue;
      last = i;
      const s = buy ? 1 : -1, en = c[i], a = A[i];
      const sw = buy ? Math.min(...l.slice(i - 9, i + 1)) : Math.max(...h.slice(i - 9, i + 1));
      const d = Math.min(Math.max(Math.abs(en - sw) + 0.2 * a, 1.2 * a), 2.5 * a), n = dp(en);
      out.push({ id: pair + ct[i], pair, side: buy ? 'BUY' : 'SELL', time: ct[i], src: 'Binance',
        entry: en.toFixed(n), tp1: (en + s * d * 1.5).toFixed(n), tp2: (en + s * d * 3).toFixed(n), sl: (en - s * d).toFixed(n) });
    }
    return out;
  }

  const api = { PAIRS, klines, signals };
  g.Strategy = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
