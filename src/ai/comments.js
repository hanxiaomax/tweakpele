/** Per-diagram canvas comment pins (`tweakpele.ai.comments.v1`).
 *  Browser-local only — never snapshots, share URLs, or the API-key store
 *  (the key lives in tweakpele.ai.secret.v1 and is never mixed in here). */
import { loadJSON, saveJSON } from '../lib.js';

const COMMENTS_KEY = 'tweakpele.ai.comments.v1';
const MAX_PER_DIAGRAM = 50;

function sanitizeComment(c, n) {
  if (!c || typeof c !== 'object') return null;
  const nx = Number(c.nx);
  const ny = Number(c.ny);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  const text = typeof c.text === 'string' ? c.text.slice(0, 500) : '';
  if (!text.trim()) return null;
  return {
    id: typeof c.id === 'string' && c.id ? c.id : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    n,
    text: text.trim(),
    nx, ny,
    nearby: typeof c.nearby === 'string' ? c.nearby.slice(0, 60) : '',
  };
}

/** Current diagram's comments (renumbered 1..n), or [] — no secrets involved. */
export function loadComments(diagramId) {
  const all = loadJSON(COMMENTS_KEY, {}) || {};
  const t = all && all[diagramId];
  if (!t || !Array.isArray(t.comments)) return [];
  return t.comments
    .map((c, i) => sanitizeComment(c, i + 1))
    .filter(Boolean)
    .slice(0, MAX_PER_DIAGRAM);
}

export function saveComments(diagramId, comments) {
  const all = loadJSON(COMMENTS_KEY, {}) || {};
  const clean = (comments || [])
    .map((c, i) => sanitizeComment(c, i + 1))
    .filter(Boolean)
    .slice(0, MAX_PER_DIAGRAM);
  if (clean.length) all[diagramId] = { comments: clean };
  else delete all[diagramId];
  saveJSON(COMMENTS_KEY, all);
  return clean;
}

/** Short human hint like `42% from left, 18% from top, near "Web App"`. */
export function commentLocationHint(c) {
  const pos = `${Math.round(c.nx * 100)}% from left, ${Math.round(c.ny * 100)}% from top`;
  return c.nearby ? `${pos}, near "${c.nearby}"` : pos;
}
