const express = require('express');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Symbol configuration
// qty = 100 / currentPrice, rounded to the step for each symbol
const SYMBOL_CONFIG = {
  BTCUSDT:  { category: 'linear', decimals: 3 },  // step 0.001
  ETHUSDT:  { category: 'linear', decimals: 2 },  // step 0.01
  LINKUSDT: { category: 'linear', decimals: 1 },  // step 0.1
  STXUSDT:  { category: 'linear', decimals: 0, minQty: 1 }, // step 1, min 1
  NEXOUSDT: { category: 'spot',   decimals: 0, minQty: 1 }, // step 1, min 1
};

// Fetch live price from Bybit demo public ticker
async function getLivePrice(symbol, category) {
  const hostname = 'api-demo.bybit.com';
  const path = `/v5/market/tickers?category=${category}&symbol=${symbol}`;
  const parsed = await httpsGet(hostname, path);
  if (parsed.retCode !== 0) {
    throw new Error(`Ticker error for ${symbol}: ${parsed.retMsg}`);
  }
  const price = parseFloat(parsed.result.list[0].lastPrice);
  if (!price || price <= 0) throw new Error(`Invalid price for ${symbol}: ${price}`);
  return price;
}

// Calculate quantity
function calcQty(price, decimals, minQty = 0) {
  const raw = 100 / price;
  let qty = parseFloat(raw.toFixed(decimals));
  if (minQty > 0 && qty < minQty) qty = minQty;
  return qty;
}

// Place order on Bybit demo
async function placeBybitOrder(apiKey, apiSecret, orderParams) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';

  const body = JSON.stringify(orderParams);

  const crypto = require('crypto');
  const preSign = timestamp + apiKey + recvWindow + body;
  const signature = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-METHOD': 'HmacSHA256',
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'Content-Length': Buffer.byteLength(body),
  };

  return await httpsPost('api-demo.bybit.com', '/v5/order/create', headers, body);
}

// Health check
app.get('/', (req, res) => res.send('Stoic Crypto Bot Active'));

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('=== WEBHOOK HIT ===', new Date().toISOString());
    console.log('Body:', JSON.stringify(req.body));
    console.log('=== WEBHOOK RECEIVED ===', JSON.stringify(req.body));

    const apiKey    = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('Missing BYBIT_API_KEY or BYBIT_API_SECRET env vars');
      return res.status(500).json({ error: 'Missing API credentials' });
    }

    const { symbol, side, action, positionIdx } = req.body;

    if (!symbol || !side || !action) {
      console.error('Missing required fields: symbol, side, action');
      return res.status(400).json({ error: 'Missing required fields: symbol, side, action' });
    }

    const config = SYMBOL_CONFIG[symbol];
    if (!config) {
      console.error(`Unknown symbol: ${symbol}`);
      return res.status(400).json({ error: `Unknown symbol: ${symbol}` });
    }

    // 1. Fetch live price
    console.log(`Fetching live price for ${symbol} (${config.category})...`);
    const price = await getLivePrice(symbol, config.category);
    console.log(`Live price for ${symbol}: ${price}`);

    // 2. Calculate qty
    const qty = calcQty(price, config.decimals, config.minQty || 0);
    console.log(`Calculated qty for ${symbol}: ${qty} (100 / ${price} = ${(100/price).toFixed(8)}, rounded to ${config.decimals} dp)`);

    // 3. Build order params
    let orderParams;

    if (config.category === 'spot') {
      if (action === 'open') {
        orderParams = {
          category: 'spot',
          symbol: symbol,
          side: 'Buy',
          orderType: 'Market',
          qty: qty.toString(),
        };
      } else if (action === 'close') {
        orderParams = {
          category: 'spot',
          symbol: symbol,
          side: 'Sell',
          orderType: 'Market',
          qty: qty.toString(),
        };
      } else {
        return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } else {
      if (action === 'open') {
        orderParams = {
          category: 'linear',
          symbol: symbol,
          side: side,
          orderType: 'Market',
          qty: qty.toString(),
          positionIdx: positionIdx !== undefined ? positionIdx : 0,
        };
      } else if (action === 'close') {
        const closeSide = side === 'Buy' ? 'Sell' : 'Buy';
        orderParams = {
          category: 'linear',
          symbol: symbol,
          side: closeSide,
          orderType: 'Market',
          qty: qty.toString(),
          reduceOnly: true,
          positionIdx: positionIdx !== undefined ? positionIdx : 0,
        };
      } else {
        return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    }

    console.log(`Placing order:`, JSON.stringify(orderParams));

    // 4. Place order
    const result = await placeBybitOrder(apiKey, apiSecret, orderParams);
    console.log(`${symbol} -> retCode: ${result.retCode}, retMsg: ${result.retMsg}, orderId: ${result.result?.orderId}`);

    // 5. Log full Bybit response for Railway logs
    console.log(`=== BYBIT ORDER RESPONSE for ${symbol} ===`);
    console.log(`retCode: ${result.retCode}`);
    console.log(`retMsg:  ${result.retMsg}`);
    console.log(`result:  ${JSON.stringify(result.result)}`);
    console.log(`Full response: ${JSON.stringify(result)}`);

    if (result.retCode === 0) {
      console.log(`Order placed successfully for ${symbol}: orderId=${result.result?.orderId}`);
      return res.json({ success: true, symbol, qty, price, orderId: result.result?.orderId, retCode: result.retCode, retMsg: result.retMsg });
    } else {
      console.error(`Order FAILED for ${symbol}: retCode=${result.retCode} retMsg=${result.retMsg}`);
      return res.status(502).json({ success: false, symbol, retCode: result.retCode, retMsg: result.retMsg, result: result.result });
    }
  } catch (err) {
    console.error(`Error processing webhook: ${err.message}`, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
// Keep-alive ping every 4 minutes to prevent Railway from sleeping
setInterval(() => {
  http.get(`http://localhost:${PORT}/`, (res) => {
    res.resume();
    console.log('Keep-alive ping sent');
  }).on('error', err => console.error('Keep-alive error:', err.message));
}, 4 * 60 * 1000);
console.log('Keep-alive interval started');

app.listen(PORT, () => {
  console.log(`Stoic Crypto Bot running on port ${PORT}`);
  console.log('Configured symbols:', Object.keys(SYMBOL_CONFIG).join(', '));
});
