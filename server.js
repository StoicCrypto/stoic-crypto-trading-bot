const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Stoic Crypto Bot Active'));
app.listen(3000);
