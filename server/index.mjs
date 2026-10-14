import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
import { ScheduleStore, StoreError } from './store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const store = new ScheduleStore(process.env.PLANNER_DATA_DIR || path.join(root, '.data'));
let vite;
if (dev) {
  const { createServer } = await import('vite');
  vite = await createServer({ root, server: { middlewareMode: true, host: '127.0.0.1', hmr: { host: '127.0.0.1' } }, appType: 'spa' });
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new StoreError('文件过大，最大支持 8 MB。', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new StoreError('请求内容不是有效的 JSON。'); }
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
    if (url.pathname.startsWith('/api/')) {
      // A local application should not accept writes from unrelated websites.
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: '仅允许从本工具页面访问。' });
      if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: '仅允许从本工具页面访问。' });
      if (url.pathname !== '/api/schedule') return send(res, 404, { error: '未找到接口。' });
      if (req.method === 'GET') return send(res, 200, await store.read());
      if (req.method === 'PUT') {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: '需要使用 JSON 格式。' });
        return send(res, 200, await store.write(await readBody(req)));
      }
      return send(res, 405, { error: '不支持此操作。' });
    }
    if (vite) return vite.middlewares(req, res, () => { res.writeHead(404); res.end('Not found'); });
    const dist = path.join(root, 'dist');
    const requested = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    if (requested !== dist && !requested.startsWith(`${dist}${path.sep}`)) { res.writeHead(403); return res.end(); }
    let file = requested;
    try { if (!(await stat(file)).isFile()) file = path.join(dist, 'index.html'); }
    catch { file = path.join(dist, 'index.html'); }
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' });
    res.end(content);
  } catch (error) {
    if (res.headersSent) return res.end();
    send(res, error.status || 500, { error: error.status ? error.message : (dev ? '服务暂时无法处理请求。' : '请先运行 npm run build，再启动工具。') });
  }
});
server.listen(port, host, () => console.log(`秋招日程已启动：http://${host}:${port}\n日程保存在 ${store.directory}`));
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用。如果工具已启动，请直接打开 http://${host}:${port} 。` : `服务无法启动：${error.message}`);
  process.exit(1);
});
async function shutdown() { await vite?.close(); server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
