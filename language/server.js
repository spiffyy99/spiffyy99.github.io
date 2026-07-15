const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Strip trailing slash except for root
  if (urlPath.length > 1 && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);

  let filePath = path.join(ROOT, urlPath);

  const tryServe = (fp) => {
    fs.stat(fp, (err, stat) => {
      if (!err && stat.isDirectory()) {
        return tryServe(path.join(fp, 'index.html'));
      }
      if (err || !stat.isFile()) {
        // SPA fallback: serve the nearest index.html up the tree
        const parts = urlPath.split('/').filter(Boolean);
        while (parts.length) {
          parts.pop();
          const candidate = path.join(ROOT, ...parts, 'index.html');
          if (fs.existsSync(candidate)) {
            return serve(candidate, res);
          }
        }
        res.writeHead(404); res.end('Not found');
        return;
      }
      serve(fp, res);
    });
  };

  tryServe(filePath);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

function serve(fp, res) {
  const ext = path.extname(fp).toLowerCase();
  const ct = MIME[ext] || 'application/octet-stream';
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(500); res.end('Error'); return; }
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
}
