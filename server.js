'use strict';

const https   = require('https');
const http    = require('http');
const crypto  = require('crypto');
const url     = require('url');
const express = require('express');

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Global error guards Ã¢ÂÂ log but never crash Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Bybit credentials Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const BYBIT_API_KEY    = process.env.BYBIT_API_KEY    || '';
const BYBIT_API_SECRET = process.env.BYBIT_API_SECRET || '';
const RECV_WINDOW      = '5000';

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Fixed quantities (no dynamic pricing for now) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const SYMBOL_CONFIG = {
  BTCUSDT:  { category: 'linear', qty: '0.001' },
  ETHUSDT:  { category: 'linear', qty: '0.05'  },
  LINKUSDT: { category: 'linear', qty: '8'     },
  STXUSDT:  { category: 'linear', qty: '120'   },
  NEXOUSDT: { category: 'spot',   qty: '80'    },
};

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ placeOrder Ã¢ÂÂ native https.request, never fetch() Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function placeOrder(symbol, category, side, qty, reduceOnly) {
  return new Promise((resolve) => {
    try {
      const timestamp = Date.now().toString();
      const bodyObj = { category, symbol, side, orderType: 'Market', qty, timeInForce: 'IOC' };
      if (reduceOnly) bodyObj.reduceOnly = true;
      const bodyStr  = JSON.stringify(bodyObj);
      const signStr  = timestamp + BYBIT_API_KEY + RECV_WINDOW + bodyStr;
      const signature = crypto.createHmac('sha256', BYBIT_API_SECRET).update(signStr).digest('hex');

      const options = {
        hostname: 'api-demo.bybit.com',
        path:     '/v5/order/create',
        method:   'POST',
        headers: {
          'Content-Type':        'application/json',
          'Content-Length':      Buffer.byteLength(bodyStr),
          'X-BAPI-API-KEY':      BYBIT_API_KEY,
          'X-BAPI-TIMESTAMP':    timestamp,
          'X-BAPI-SIGN':         signature,
          'X-BAPI-RECV-WINDOW':  RECV_WINDOW,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`${symbol} raw response:`, data);
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve({ error: 'parse error', raw: data }); }
        });
      });

      req.on('error', (e) => {
        console.error(`${symbol} request error:`, e.message);
        resolve({ error: e.message });
      });

      req.write(bodyStr);
      req.end();
    } catch (e) {
      console.error(`${symbol} caught error:`, e.message);
      resolve({ error: e.message });
    }
  });
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Express app Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const app = express();
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Webhook Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
app.post('/webhook', async (req, res) => {
  try {
    console.log('[webhook] body:', JSON.stringify(req.body));

    const { symbol, action } = req.body || {};

    if (!symbol || !action) {
      console.warn('[webhook] missing symbol or action');
      return res.status(200).json({ error: 'missing symbol or action' });
    }

    const cfg = SYMBOL_CONFIG[symbol.toUpperCase()];
    if (!cfg) {
      console.warn(`[webhook] unknown symbol: ${symbol}`);
      return res.status(200).json({ error: `unknown symbol: ${symbol}` });
    }

    const sym      = symbol.toUpperCase();
    const { category, qty } = cfg;

    console.log(`[webhook] symbol=${sym} category=${category} action=${action} qty=${qty}`);

    let result;

    if (action === 'buy') {
      // Close any short first (reduceOnly Sell is a no-op if no position exists on spot)
      if (category === 'linear') {
        console.log(`[webhook] closing short for ${sym}`);
        const close = await placeOrder(sym, category, 'Buy', qty, true);
        console.log(`[webhook] close-short result:`, JSON.stringify(close));
      }
      console.log(`[webhook] opening long for ${sym}`);
      result = await placeOrder(sym, category, 'Buy', qty, false);

    } else if (action === 'sell') {
      // Close any long first
      if (category === 'linear') {
        console.log(`[webhook] closing long for ${sym}`);
        const close = await placeOrder(sym, category, 'Sell', qty, true);
        console.log(`[webhook] close-long result:`, JSON.stringify(close));
      }
      console.log(`[webhook] opening short / selling ${sym}`);
      result = await placeOrder(sym, category, 'Sell', qty, false);

    } else {
      console.warn(`[webhook] unknown action: ${action}`);
      return res.status(200).json({ error: `unknown action: ${action}` });
    }

    console.log(`[webhook] final result for ${sym}:`, JSON.stringify(result));
    return res.status(200).json({ ok: true, symbol: sym, action, result });

  } catch (err) {
    // Never let the server return 502 Ã¢ÂÂ always respond 200
    console.error('[webhook] unexpected error:', err.message, err.stack);
    return res.status(200).json({ error: err.message });
  }
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Self-ping keep-alive (prevents Railway idle sleep) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const PORT = process.env.PORT || 3000;
app.get('/ping', (req, res) => res.json({ pong: true, time: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stoic Crypto Bot running on port ${PORT}`);
  console.log(`Configured symbols: ${PAIRS.map(p => p.symbol).join(', ')}`);
  console.log('Keep-alive interval started');
});
      req.on('error', (e) => console.error('[keep-alive] error:', e.message));
    } catch (e) {
      console.error('[keep-alive] caught:', e.message);
    }
  }, pingIntervalMs);
});
