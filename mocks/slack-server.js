const http = require('http');
const PORT = 3002;
const routes = {
  '/api/chat.postMessage': { ok: true, channel: 'C01234567', ts: Date.now() },
  '/api/conversations.list': { ok: true, channels: [{ id: 'C01234567', name: 'procurement-approvals' }] },
  '/api/users.lookupByEmail': { ok: true, user: { id: 'U012345678', name: 'Manager' } },
};
const server = http.createServer((req, res) => {
  const path = Object.keys(routes).find(p => req.url.startsWith(p));
  if (path) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(routes[path]));
    console.log(`[SLACK MOCK] ${req.method} ${req.url}`);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
  }
});
server.listen(PORT, () => console.log(`🎭 Slack Mock on http://localhost:${PORT}`));
