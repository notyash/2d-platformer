const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.text());
app.post('/log', (req, res) => {
    console.log('[BROWSER LOG]', req.body);
    res.sendStatus(200);
});
app.listen(3000, () => console.log('Logger listening on port 3000'));
