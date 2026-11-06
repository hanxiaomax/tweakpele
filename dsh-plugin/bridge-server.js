/**
 * Minimal localhost bridge for tweakpele ↔ dsh agent tools.
 * HTTP JSON API + Server-Sent Events; serves the static tweakpele build.
 */
import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.mmd': 'text/plain; charset=utf-8',
};

function defaultStaticRoot() {
  if (process.env.TWEAKPELE_ROOT) return resolve(process.env.TWEAKPELE_ROOT);
  return resolve(__dirname, '..');
}

function readPresets() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'presets-meta.json'), 'utf8'));
  } catch {
    return [];
  }
}

function seedDiagrams(staticRoot) {
  const fallback = [{
    id: 'scratch',
    title: 'Scratch',
    keyword: 'flowchart',
    source: 'flowchart LR\n  A[Start] --> B[Edit me]\n',
    original: 'flowchart LR\n  A[Start] --> B[Edit me]\n',
    builtin: false,
  }];
  const bundlePath = join(staticRoot, 'diagrams', 'bundle.js');
  if (!existsSync(bundlePath)) return fallback;
  const raw = readFileSync(bundlePath, 'utf8');
  const m = raw.match(/window\.TWEAKPELE_DIAGRAMS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return fallback;
  try {
    const list = JSON.parse(m[1]);
    return list.map((d) => ({
      id: d.id,
      title: d.title,
      keyword: d.keyword,
      source: d.source,
      original: d.source,
      builtin: true,
    }));
  } catch {
    return fallback;
  }
}

export function createBridgeState(staticRoot) {
  const diagrams = seedDiagrams(staticRoot);
  return {
    revision: 1,
    mode: 'edit',
    activeId: diagrams[0]?.id ?? null,
    diagrams,
    themePresetId: 'paper',
    vars: null,
    optVals: null,
    feedback: null,
  };
}

export function createBridgeServer(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = Number(options.port) || 3847;
  const staticRoot = resolve(options.staticRoot || defaultStaticRoot());
  const presets = readPresets();
  const state = createBridgeState(staticRoot);
  /** @type {Set<import('node:http').ServerResponse>} */
  const sseClients = new Set();
  let server = null;
  let started = false;

  function snapshot() {
    return {
      revision: state.revision,
      mode: state.mode,
      activeId: state.activeId,
      diagrams: state.diagrams,
      themePresetId: state.themePresetId,
      vars: state.vars,
      optVals: state.optVals,
      feedback: state.feedback,
      clients: sseClients.size,
      url: `http://${host}:${port}/?bridge=1#/edit/${encodeURIComponent(state.activeId || '')}`,
      presetsCount: presets.length,
    };
  }

  function bump(patch = {}) {
    Object.assign(state, patch);
    state.revision += 1;
    broadcast();
    return snapshot();
  }

  function broadcast() {
    const payload = `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of sseClients) {
      try { res.write(payload); } catch { /* ignore */ }
    }
  }

  function findDiagram(id) {
    return state.diagrams.find((d) => d.id === id);
  }

  function ensureActive() {
    if (state.activeId && findDiagram(state.activeId)) return state.activeId;
    state.activeId = state.diagrams[0]?.id ?? null;
    return state.activeId;
  }

  function applyPatch(body) {
    const patch = {};
    if (body.mode === 'edit' || body.mode === 'gallery') patch.mode = body.mode;
    if (typeof body.themePresetId === 'string') patch.themePresetId = body.themePresetId;
    if (body.vars && typeof body.vars === 'object') patch.vars = body.vars;
    if (body.optVals && typeof body.optVals === 'object') patch.optVals = body.optVals;

    if (Array.isArray(body.diagrams)) {
      patch.diagrams = body.diagrams.map((d) => ({
        id: String(d.id),
        title: String(d.title || 'Untitled'),
        keyword: String(d.keyword || 'flowchart'),
        source: String(d.source || ''),
        original: String(d.original ?? d.source ?? ''),
        builtin: Boolean(d.builtin),
      }));
    }

    if (typeof body.activeId === 'string') {
      const id = body.activeId;
      const list = patch.diagrams || state.diagrams;
      if (list.some((d) => d.id === id)) patch.activeId = id;
    }

    if (typeof body.source === 'string') {
      const id = body.diagramId || body.activeId || state.activeId;
      patch.diagrams = (patch.diagrams || state.diagrams).map((d) => (
        d.id === id ? { ...d, source: body.source } : d
      ));
      if (id) patch.activeId = id;
      patch.mode = 'edit';
    }

    if (typeof body.title === 'string') {
      const id = body.diagramId || body.activeId || state.activeId;
      patch.diagrams = (patch.diagrams || state.diagrams).map((d) => (
        d.id === id ? { ...d, title: body.title } : d
      ));
    }

    if (body.create && typeof body.create === 'object') {
      const id = body.create.id || `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const source = String(body.create.source || 'flowchart LR\n  A --> B\n');
      const d = {
        id,
        title: String(body.create.title || 'New diagram'),
        keyword: String(body.create.keyword || 'flowchart'),
        source,
        original: source,
        builtin: false,
      };
      patch.diagrams = [...(patch.diagrams || state.diagrams), d];
      patch.activeId = id;
      patch.mode = 'edit';
    }

    if (body.feedback && typeof body.feedback === 'object') {
      patch.feedback = {
        at: new Date().toISOString(),
        diagramId: body.feedback.diagramId || state.activeId,
        ok: Boolean(body.feedback.ok),
        error: body.feedback.error ? String(body.feedback.error) : null,
        info: body.feedback.info ? String(body.feedback.info) : null,
        mermaidType: body.feedback.mermaidType || null,
        width: body.feedback.width ?? null,
        height: body.feedback.height ?? null,
      };
    }

    return bump(patch);
  }

  async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!chunks.length) return {};
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  }

  function sendJson(res, code, data) {
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end(JSON.stringify(data));
  }

  function safeStaticPath(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const rel = decoded === '/' ? '/index.html' : decoded;
    const full = normalize(join(staticRoot, rel));
    if (!full.startsWith(staticRoot + sep) && full !== staticRoot) return null;
    return full;
  }

  async function serveStatic(req, res, urlPath) {
    const filePath = safeStaticPath(urlPath);
    if (!filePath) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    try {
      const st = await stat(filePath);
      if (!st.isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'content-type': type,
        'cache-control': 'no-cache',
        'access-control-allow-origin': '*',
      });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  }

  function handleApi(req, res, pathname) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return true;
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, revision: state.revision, clients: sseClients.size, staticRoot });
      return true;
    }
    if (pathname === '/api/presets' && req.method === 'GET') {
      sendJson(res, 200, { presets });
      return true;
    }
    if (pathname === '/api/state' && req.method === 'GET') {
      ensureActive();
      sendJson(res, 200, snapshot());
      return true;
    }
    if (pathname === '/api/state' && req.method === 'POST') {
      readJson(req).then((body) => {
        try { sendJson(res, 200, applyPatch(body)); }
        catch (e) { sendJson(res, 400, { error: String(e?.message || e) }); }
      }).catch((e) => sendJson(res, 400, { error: String(e?.message || e) }));
      return true;
    }
    if (pathname === '/api/feedback' && req.method === 'POST') {
      readJson(req).then((body) => {
        try { sendJson(res, 200, applyPatch({ feedback: body })); }
        catch (e) { sendJson(res, 400, { error: String(e?.message || e) }); }
      }).catch((e) => sendJson(res, 400, { error: String(e?.message || e) }));
      return true;
    }
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'access-control-allow-origin': '*',
      });
      res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
      sseClients.add(res);
      req.on('close', () => { sseClients.delete(res); });
      return true;
    }
    return false;
  }

  function onRequest(req, res) {
    const hostHdr = req.headers.host || `${host}:${port}`;
    const url = new URL(req.url || '/', `http://${hostHdr}`);
    if (handleApi(req, res, url.pathname)) return;
    serveStatic(req, res, url.pathname === '/' ? '/index.html' : url.pathname);
  }

  async function start() {
    if (started && server) return info();
    if (!existsSync(join(staticRoot, 'index.html'))) {
      throw new Error(`tweakpele static root missing index.html: ${staticRoot}`);
    }
    server = createServer(onRequest);
    await new Promise((resolvePromise, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        started = true;
        resolvePromise();
      });
    });
    return info();
  }

  function info() {
    ensureActive();
    const base = `http://${host}:${port}`;
    return {
      host,
      port,
      baseUrl: base,
      editorUrl: `${base}/?bridge=1#/edit/${encodeURIComponent(state.activeId || '')}`,
      galleryUrl: `${base}/?bridge=1#/`,
      staticRoot,
      revision: state.revision,
      clients: sseClients.size,
    };
  }

  async function stop() {
    for (const res of sseClients) {
      try { res.end(); } catch { /* ignore */ }
    }
    sseClients.clear();
    if (!server) return;
    const s = server;
    server = null;
    started = false;
    await new Promise((resolvePromise) => s.close(() => resolvePromise()));
  }

  return {
    start,
    stop,
    info,
    snapshot,
    applyPatch,
    presets: () => presets,
    get state() { return state; },
    get started() { return started; },
  };
}

// silence unused import lint for readFile (kept for future HTML injection)
