const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Symbol configuration Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// qty = 100 / currentPrice, rounded to the step for each symbol
const SYMBOL_CONFIG = {
  BTCUSDT:  { category: 'linear', decimals: 3 },  // step 0.001
  ETHUSDT:  { category: 'linear', decimals: 2 },  // step 0.01
  LINKUSDT: { category: 'linear', decimals: 1 },  // step 0.1
  STXUSDT:  { category: 'linear', decimals: 0, minQty: 1 }, // step 1, min 1
  NEXOUSDT: { category: 'spot',   decimals: 0, minQty: 1 }, // step 1, min 1
};

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Fetch live price from Bybit demo public ticker Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function getLivePrice(symbol, category) {
  return new Promise((resolve, reject) => {
    const url = `https://api-demo.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.retCode !== 0) {
            return reject(new Error(`Ticker error for ${symbol}: ${parsed.retMsg}`));
          }
          const price = parseFloat(parsed.result.list[0].lastPrice);
          if (!price || price <= 0) return reject(new Error(`Invalid price for ${symbol}: ${price}`));
          resolve(price);
        } catch (e) {
          reject(new Error(`Failed to parse ticker for ${symbol}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Calculate quantity Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function calcQty(price, decimals, minQty = 0) {
  const raw = 100 / price;
  let qty = parseFloat(raw.toFixed(decimals));
  if (minQty > 0 && qty < minQty) qty = minQty;
  return qty;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Place order on Bybit demo Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function placeBybitOrder(apiKey, apiSecret, orderParams) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    const recvWindow = '5000';

    const body = JSON.stringify(orderParams);

    // HMAC-SHA256 signature: timestamp + apiKey + recvWindow + body
    const crypto = require('crypto');
    const preSign = timestamp + apiKey + recvWindow + body;
    const signature = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');

    const options = {
      hostname: 'api-demo.bybit.com',
      path: '/v5/order/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-SIGN-METHOD': 'HmacSHA256',
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse order response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Health check Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
app.get('/', (req, res) => res.send('Stoic Crypto Bot Active'));

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Webhook endpoint Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
app.post('/webhook', async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===', JSON.stringify(req.body));

  const apiKey    = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('Missing BYBIT_API_KEY or BYBIT_API_SECRET env vars');
    return res.status(500).json({ error: 'Missing API credentials' });
  }

  // Payload from TradingView alert (or similar)
  // Expected fields: symbol, side, action ('open' or 'close'), positionIdx (optional)
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

  try {
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
      // SPOT orders (NEXOUSDT)
      if (action === 'open') {
        // Regular Buy to open long
        orderParams = {
          category: 'spot',
          symbol: symbol,
          side: 'Buy',
          orderType: 'Market',
          qty: qty.toString(),
        };
      } else if (action === 'close') {
        // Regular Sell to close long (no reduceOnly on spot)
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
      // LINEAR (perpetual futures) orders
      if (action === 'open') {
        orderParams = {
          category: 'linear',
          symbol: symbol,
          side: side,           // 'Buy' or 'Sell'
          orderType: 'Market',
          qty: qty.toString(),
          positionIdx: positionIdx !== undefined ? positionIdx : 0,
        };
      } else if (action === 'close') {
        // Reverse side to close: if opened Buy, close with Sell; and vice versa
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
    console.error(`Error processing ${symbol}: ${err.message}`, err.stack);
    return res.status(500).json({ error: err.message });
  }
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Start server Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const PORT = process.env.PORT || 3000;
// Keep-alive ping every 4 minutes to prevent Railway from sleeping
setInterval(() => {
  fetch(`http://localhost:${PORT}/`)
    .then(() => console.log('Keep-alive ping sent'))
    .catch(err => console.error('Keep-alive error:', err.message));
}, 4 * 60 * 1000);
console.log('Keep-alive interval started');

app.listen(PORT, () => {
  console.log(`Stoic Crypto Bot running on port ${PORT}`);
  console.log('Configured symbols:', Object.keys(SYMBOL_CONFIG).join(', '));
});
