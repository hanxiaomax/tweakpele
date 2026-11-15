/** Local dev server: esbuild watch + diagram bundler + static HTTP server with SSE live reload. */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, watch } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { bundleDiagrams, createEsbuildOptions } from './build.mjs';

const ROOT = process.cwd();
const HOST = process.env.HOST || '127.0.0.1';
const BASE_PORT = Number(process.env.PORT || 5173);
const PORT_PINNED = Boolean(process.env.PORT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mmd': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const RELOAD_SNIPPET = `<script>
(() => {
  const es = new EventSource('/__dev_reload');
  es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
})();
</script>`;

const sseClients = new Set();
function broadcastReload(reason) {
  for (const res of sseClients) {
    res.write(`data: reload\n\n`);
  }
  if (reason) console.log(`[dev] reloaded (${reason})`);
}

function resolveStaticPath(urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const full = resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  if (!existsSync(full)) return null;
  const st = statSync(full);
  if (st.isDirectory()) {
    const idx = resolve(full, 'index.html');
    return existsSync(idx) && statSync(idx).isFile() ? idx : null;
  }
  return st.isFile() ? full : null;
}

const server = createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/__dev_reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(':\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  const filePath = resolveStaticPath(req.url);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  let body = readFileSync(filePath);
  if (filePath === resolve(ROOT, 'index.html')) {
    body = Buffer.from(body.toString('utf8').replace('</body>', `${RELOAD_SNIPPET}\n</body>`));
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
});

const count = bundleDiagrams();
console.log(`[dev] bundled ${count} diagrams`);

let firstBuild = true;
const ctx = await esbuild.context({
  ...createEsbuildOptions({ dev: true }),
  plugins: [
    {
      name: 'dev-reload',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) return;
          if (firstBuild) {
            firstBuild = false;
            console.log('[dev] initial build ready');
          } else {
            broadcastReload('src');
          }
        });
      },
    },
  ],
});
await ctx.watch();

const watchers = [];
let diagramTimer = null;
watchers.push(
  watch(resolve(ROOT, 'diagrams'), (_evt, filename) => {
    if (!filename || (!filename.endsWith('.mmd') && filename !== 'manifest.json')) return;
    clearTimeout(diagramTimer);
    diagramTimer = setTimeout(() => {
      try {
        const n = bundleDiagrams();
        console.log(`[dev] re-bundled ${n} diagrams`);
        broadcastReload(filename);
      } catch (err) {
        console.error('[dev] diagram bundle error:', err.message);
      }
    }, 80);
  }),
);

for (const file of ['tweakpele.css', 'index.html']) {
  let timer = null;
  watchers.push(
    watch(resolve(ROOT, file), () => {
      clearTimeout(timer);
      timer = setTimeout(() => broadcastReload(file), 60);
    }),
  );
}

function listenOnPort(port) {
  return new Promise((resolvePort, rejectPort) => {
    const onError = (err) => {
      server.off('listening', onListen);
      if (err.code === 'EADDRINUSE' && !PORT_PINNED && port < BASE_PORT + 20) {
        resolvePort(listenOnPort(port + 1));
      } else {
        rejectPort(err);
      }
    };
    const onListen = () => {
      server.off('error', onError);
      resolvePort(port);
    };
    server.once('error', onError);
    server.once('listening', onListen);
    server.listen(port, HOST);
  });
}

const activePort = await listenOnPort(BASE_PORT);
console.log(`[dev] tweakpele running at http://${HOST}:${activePort}`);

async function shutdown() {
  for (const w of watchers) w.close();
  for (const client of sseClients) client.end();
  await ctx.dispose();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
