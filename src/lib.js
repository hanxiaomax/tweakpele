/** Shared helpers: persistence, clipboard, hash routing, timing. */
import { useEffect, useState } from 'react';

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : v;
  } catch (_) { return fallback; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* private mode */ }
}

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (_) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }
}

/** Hash route: '#/' gallery · '#/edit/<id>' split editor.
 *  Empty hash (first open) is redirected to editor by App — editor is the default mode. */
export function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  const m = h.match(/^\/edit\/(.+)$/);
  if (m) return { view: 'edit', id: decodeURIComponent(m[1]) };
  return { view: 'gallery' };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(route) {
  const h = route.view === 'edit' ? `#/edit/${encodeURIComponent(route.id)}` : '#/';
  if (location.hash !== h) location.hash = h;
}

/** Debounce a fast-changing value (used so 36 gallery cards don't re-render per slider tick). */
export function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** useState that persists to localStorage under `key`. `init` is a value or (stored) => value. */
export function usePersistedState(key, init) {
  const [value, setValue] = useState(() => {
    const stored = loadJSON(key, undefined);
    return typeof init === 'function' ? init(stored) : stored ?? init;
  });
  useEffect(() => { saveJSON(key, value); }, [key, value]);
  return [value, setValue];
}

export function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Normalize a Mermaid keyword / first-token into a toolbox diagram kind. */
const KIND_ALIASES = {
  flowchart: 'flowchart', graph: 'flowchart',
  sequencediagram: 'sequence', sequence: 'sequence',
  classdiagram: 'class', class: 'class',
  statediagram: 'state', 'statediagram-v2': 'state', state: 'state',
  erdiagram: 'er', er: 'er',
  gantt: 'gantt',
  pie: 'pie',
  gitgraph: 'gitGraph',
  mindmap: 'mindmap',
  timeline: 'timeline',
  sankey: 'sankey', 'sankey-beta': 'sankey',
  xychart: 'xyChart', 'xychart-beta': 'xyChart',
  quadrantchart: 'quadrantChart',
  kanban: 'kanban',
  architecture: 'architecture', 'architecture-beta': 'architecture',
  radar: 'radar',
  packet: 'packet', 'packet-beta': 'packet',
  treemap: 'treemap', 'treemap-beta': 'treemap',
  railroad: 'railroad', 'railroad-beta': 'railroad',
  treeview: 'treeView', 'tree-view': 'treeView',
  cynefin: 'cynefin', 'cynefin-beta': 'cynefin',
  usecase: 'usecase', usecasediagram: 'usecase',
  agentflow: 'agentflow', 'agentflow-beta': 'agentflow',
  block: 'block', 'block-beta': 'block',
  journey: 'journey',
  swimlane: 'swimlane', 'swimlane-beta': 'swimlane',
  requirement: 'requirement', requirementdiagram: 'requirement',
  c4context: 'c4', c4container: 'c4', c4component: 'c4', c4dynamic: 'c4', c4deployment: 'c4',
  venn: 'venn', 'venn-beta': 'venn',
  wardley: 'wardley',
  ishikawa: 'ishikawa',
  eventmodeling: 'eventmodeling',
  info: 'info',
};

export function normalizeDiagramKind(raw) {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  if (!k) return null;
  if (KIND_ALIASES[k]) return KIND_ALIASES[k];
  const stripped = k.replace(/-beta$/, '').replace(/diagram$/, '');
  return KIND_ALIASES[stripped] || KIND_ALIASES[k.replace(/-beta$/, '')] || null;
}

/** Detect Mermaid diagram kind from keyword and/or source text. */
export function detectDiagramType(source, keyword) {
  const fromKw = normalizeDiagramKind(keyword);
  if (fromKw) return fromKw;
  if (!source) return null;
  for (const raw of String(source).split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    if (line.startsWith('%%')) continue;
    if (line === '---' || line.startsWith('---')) continue;
    // Mermaid init / frontmatter directives
    if (line.startsWith('%%{') || line.startsWith('%%}')) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)/);
    if (!m) continue;
    const kind = normalizeDiagramKind(m[1]);
    if (kind) return kind;
  }
  return null;
}

/** Strip separators so "node spac" matches nodeSpacing. */
function normFuzzy(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Lightweight fuzzy score for toolbox search.
 * 0 = no match; higher is better. Empty query matches everything (score 1).
 */
export function fuzzyScore(query, text) {
  const rawQ = String(query || '').trim().toLowerCase();
  if (!rawQ) return 1;
  const rawT = String(text || '').toLowerCase();
  if (!rawT) return 0;
  if (rawT === rawQ) return 100;
  if (rawT.startsWith(rawQ)) return 80;
  const idx = rawT.indexOf(rawQ);
  if (idx >= 0) return 60 - Math.min(idx, 40);

  const q = normFuzzy(rawQ);
  const t = normFuzzy(rawT);
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 90;
  if (t.startsWith(q)) return 70;
  const nidx = t.indexOf(q);
  if (nidx >= 0) return 50 - Math.min(nidx, 30);

  // subsequence match on normalized strings
  let ti = 0;
  let score = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) { found = j; break; }
    }
    if (found < 0) return 0;
    score += found === ti ? 2 : 1;
    ti = found + 1;
  }
  return Math.max(1, score);
}

export function fuzzyMatch(query, parts) {
  if (!String(query || '').trim()) return true;
  return parts.some((p) => fuzzyScore(query, p) > 0);
}

/** Sort diagrams top-to-bottom, left-to-right by canvas positions (y then x).
 *  Missing positions keep their relative input order after positioned ones. */
export function sortDiagramsSpatially(diagrams, positions) {
  const pos = positions && typeof positions === 'object' ? positions : {};
  return diagrams
    .map((d, i) => {
      const p = pos[d.id];
      const x = p && Number.isFinite(p.x) ? p.x : null;
      const y = p && Number.isFinite(p.y) ? p.y : null;
      return { d, i, x, y, has: x !== null && y !== null };
    })
    .sort((a, b) => {
      if (a.has && b.has) {
        if (a.y !== b.y) return a.y - b.y;
        if (a.x !== b.x) return a.x - b.x;
        return a.i - b.i;
      }
      if (a.has !== b.has) return a.has ? -1 : 1;
      return a.i - b.i;
    })
    .map(({ d }) => d);
}

