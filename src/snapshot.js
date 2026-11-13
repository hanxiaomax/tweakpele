import { themeFileObject, optValsFromOptions, FACTORY, VAR_META } from './constants.js';
import { detectDiagramType } from './lib.js';

/** Full share URL above this length is copied as a last resort; we also offer a file. */
export const SHARE_URL_MAX = 8000;

export const SNAPSHOT_DIAGRAM_ID = 'tweakpele-snapshot';

export function buildSnapshot(vars, optVals, diagram) {
  return {
    ...themeFileObject(vars, optVals),
    diagram: {
      title: String(diagram?.title || 'diagram'),
      keyword: diagram?.keyword || detectDiagramType(diagram?.source, diagram?.keyword) || 'flowchart',
      source: String(diagram?.source || ''),
    },
  };
}

export function snapshotFileJson(vars, optVals, diagram) {
  return JSON.stringify(buildSnapshot(vars, optVals, diagram), null, 2) + '\n';
}

export function parseSnapshot(data) {
  data = parseThemeFile(data);
  if (!data || !data.diagram || typeof data.diagram !== 'object' || typeof data.diagram.source !== 'string') return null;
  return data;
}

/** Shipped source for a built-in diagram id, so unchanged built-ins travel as a reference. */
function builtinSource(id) {
  return (window.TWEAKPELE_DIAGRAMS || []).find((m) => m.id === id)?.source;
}

export function buildCanvasSnapshot(vars, optVals, diagrams, overrides, positions, view) {
  return {
    ...themeFileObject(vars, optVals),
    kind: 'canvas',
    diagrams: diagrams.map((d) => (builtinSource(d.id) === d.source
      ? { id: d.id, title: d.title, builtin: true }
      : { id: d.id, title: d.title, keyword: d.keyword, source: d.source })),
    overrides: overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {},
    positions: positions && typeof positions === 'object' && !Array.isArray(positions) ? positions : {},
    view: view && typeof view === 'object' ? view : { x: 40, y: 40, zoom: 1 },
  };
}

export function parseCanvasSnapshot(data) {
  data = parseThemeFile(data);
  if (!data || data.kind !== 'canvas' || !Array.isArray(data.diagrams)
    || !data.diagrams.every((d) => d && typeof d === 'object'
      && (typeof d.source === 'string' || (d.builtin === true && typeof builtinSource(d.id) === 'string')))) return null;
  return data;
}

/** Sanitized in-memory session state from a canvas snapshot. */
export function canvasSessionFromSnapshot(snap) {
  const used = new Set();
  const diagrams = snap.diagrams.map((d, i) => {
    let id = typeof d.id === 'string' && d.id ? d.id : `shared-${i + 1}`;
    while (used.has(id)) id = `${id}-${i + 1}`;
    used.add(id);
    const source = typeof d.source === 'string' ? d.source : builtinSource(d.id);
    return {
      id,
      title: String(d.title || `Diagram ${i + 1}`),
      keyword: d.keyword || detectDiagramType(source) || 'flowchart',
      source,
      original: source,
      builtin: false,
    };
  });
  const ids = new Set(diagrams.map((d) => d.id));
  const overrides = {};
  const rawOv = snap.overrides && typeof snap.overrides === 'object' && !Array.isArray(snap.overrides) ? snap.overrides : {};
  for (const [id, ov] of Object.entries(rawOv)) {
    if (!ov || typeof ov !== 'object' || Array.isArray(ov) || !ids.has(id)) continue;
    const opts = ov.opts && typeof ov.opts === 'object' && !Array.isArray(ov.opts) ? ov.opts : {};
    const vars = ov.vars && typeof ov.vars === 'object' && !Array.isArray(ov.vars) ? ov.vars : {};
    if (!Object.keys(opts).length && !Object.keys(vars).length) continue;
    overrides[id] = { opts: { ...opts }, vars: { ...vars } };
  }
  const positions = {};
  const rawPos = snap.positions && typeof snap.positions === 'object' && !Array.isArray(snap.positions) ? snap.positions : {};
  for (const id of ids) {
    const p = rawPos[id];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) positions[id] = { x: p.x, y: p.y };
  }
  const v = snap.view;
  const cam = v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom)
    ? { x: v.x, y: v.y, s: v.zoom }
    : null;
  return { diagrams, overrides, positions, cam };
}

/** A theme file or snapshot file minus the `diagram` part; null when unusable. */
export function parseThemeFile(data) {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (_) { return null; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!data.vars || typeof data.vars !== 'object' || Array.isArray(data.vars)) return null;
  return data;
}

export function snapshotTheme(snap) {
  const vars = { ...FACTORY };
  for (const { name } of VAR_META) {
    const v = snap.vars?.[name];
    if (typeof v === 'string' && v.trim()) vars[name] = v.trim();
  }
  return { vars, optVals: optValsFromOptions(snap.options) };
}

export function diagramFromSnapshot(snap) {
  const source = String(snap.diagram.source || '');
  return {
    id: SNAPSHOT_DIAGRAM_ID,
    title: String(snap.diagram.title || 'Shared diagram'),
    keyword: snap.diagram.keyword || detectDiagramType(source) || 'flowchart',
    source,
    original: source,
    builtin: false,
  };
}

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(token) {
  const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4));
  const bin = atob(token.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deflateBytes(bytes) {
  const cs = new CompressionStream('deflate');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer());
}

async function inflateBytes(bytes) {
  const ds = new DecompressionStream('deflate');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());
}

/** Compact hash token: `1` + deflate + base64url. Fallback `0` + raw if deflate is unavailable. */
export async function encodeSnapshotToken(snap) {
  const json = JSON.stringify(snap);
  const raw = new TextEncoder().encode(json);
  try {
    const packed = await deflateBytes(raw);
    return '1' + b64urlEncode(packed);
  } catch (_) {
    return '0' + b64urlEncode(raw);
  }
}

export async function decodeSnapshotToken(token, parse = parseSnapshot) {
  if (!token) throw new Error('empty snapshot token');
  const codec = token[0];
  const body = token.slice(1);
  let bytes;
  if (codec === '1') bytes = await inflateBytes(b64urlDecode(body));
  else if (codec === '0') bytes = b64urlDecode(body);
  else throw new Error('unknown snapshot codec');
  const snap = parse(new TextDecoder().decode(bytes));
  if (!snap) throw new Error('invalid snapshot');
  return snap;
}

export function shareUrl(token, kind = 's') {
  return `${location.origin}${location.pathname}${location.search}#/${kind}/${token}`;
}

export function isShareUrlTooLong(url) {
  return url.length > SHARE_URL_MAX;
}
