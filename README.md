# Signals app v3 (Binance only, gold + 7 crypto, strong filter, Firebase push)

Pairs: XAUUSD, BTC, ETH, BNB, SOL, XRP, DOGE, ADA (list: www/strategy.js -> PAIRS). Data: Binance only.

## Strong signal rules (15m entry + 1h trend)
BUY: 1h close > EMA200 and EMA50 > EMA200; 15m EMA9 crosses above EMA21; price > 15m EMA50;
RSI 50-68; bullish candle; ADX > 20; volume >= 90% of 20-candle average; min 1h gap between signals.
SELL = mirror. SL = recent swing +/- 0.2 ATR (limited to 1.2-2.5 ATR). TP1 = 1.5R, TP2 = 3R.

## Backtest (Termux/PC, Node 20): node scripts/backtest.js

## Setup (ekbar)
1. Firebase -> Android app, package `com.mysignals.app` -> google-services.json
2. GitHub PUBLIC repo -> Settings -> Secrets: GOOGLE_SERVICES_JSON, FIREBASE_SERVICE_ACCOUNT
3. Settings -> Actions -> General -> Workflow permissions: Read and write
4. Push -> Actions "Build APK" -> Artifacts theke APK install
5. Test: Actions -> "Signal Bot" -> Run workflow

## Jodi Actions log-e "451" ba "restricted location" dekhen
Binance GitHub-er US server block kore. Tokhon bot-ta US-er baire server/Termux-e chalan:
  cd scripts && npm i firebase-admin && cd .. && FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/signal.js
(5 minute por por cron diye). Ar bot-er pore data/signals.json GitHub-e push kora lagbe.
Server na thakle app nijei phone theke Binance data niye signal dekhabe (kintu app-off notification ashbe na).
