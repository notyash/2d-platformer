const http = require('http');
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            console.log('[BROWSER LOG]', body);
            res.writeHead(200);
            res.end();
        });
    } else {
        res.writeHead(200);
        res.end('OK');
    }
});
server.listen(3000, () => console.log('Logger listening on port 3000'));
