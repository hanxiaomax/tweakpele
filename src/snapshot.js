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

export async function decodeSnapshotToken(token) {
  if (!token) throw new Error('empty snapshot token');
  const codec = token[0];
  const body = token.slice(1);
  let bytes;
  if (codec === '1') bytes = await inflateBytes(b64urlDecode(body));
  else if (codec === '0') bytes = b64urlDecode(body);
  else throw new Error('unknown snapshot codec');
  const snap = parseSnapshot(new TextDecoder().decode(bytes));
  if (!snap) throw new Error('invalid snapshot');
  return snap;
}

export function shareUrl(token) {
  return `${location.origin}${location.pathname}${location.search}#/s/${token}`;
}

export function isShareUrlTooLong(url) {
  return url.length > SHARE_URL_MAX;
}
