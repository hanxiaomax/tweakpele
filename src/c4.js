/**
 * C4 Mermaid helpers: detect diagrams, list elements/rels, and
 * sync UpdateElementStyle / UpdateRelStyle / UpdateLayoutConfig in source text.
 */

const C4_HEADERS = /^(C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i;

const ELEMENT_FNS = [
  'Person', 'Person_Ext',
  'System', 'System_Ext', 'SystemDb', 'SystemQueue',
  'SystemDb_Ext', 'SystemQueue_Ext',
  'Container', 'Container_Ext', 'ContainerDb', 'ContainerQueue',
  'ContainerDb_Ext', 'ContainerQueue_Ext',
  'Component', 'Component_Ext', 'ComponentDb', 'ComponentQueue',
  'ComponentDb_Ext', 'ComponentQueue_Ext',
  'Enterprise_Boundary', 'System_Boundary', 'Container_Boundary', 'Boundary',
  'Deployment_Node', 'Node', 'Node_L', 'Node_R',
];

const REL_FNS = [
  'Rel', 'BiRel', 'Rel_U', 'Rel_Up', 'Rel_D', 'Rel_Down',
  'Rel_L', 'Rel_Left', 'Rel_R', 'Rel_Right', 'Rel_Back', 'RelIndex',
];

const ELEMENT_RE = new RegExp(
  `^\\s*(${ELEMENT_FNS.join('|')})\\s*\\(\\s*([A-Za-z_][\\w-]*)\\s*(?:,|\\))`,
  'i',
);
const REL_RE = new RegExp(
  `^\\s*(${REL_FNS.join('|')})\\s*\\(\\s*([A-Za-z_][\\w-]*)\\s*,\\s*([A-Za-z_][\\w-]*)\\s*(?:,|\\))`,
  'i',
);

const UPDATE_EL_RE = /^\s*UpdateElementStyle\s*\(\s*([A-Za-z_][\w-]*)\s*(?:,([\s\S]*))?\)\s*$/i;
const UPDATE_REL_RE = /^\s*UpdateRelStyle\s*\(\s*([A-Za-z_][\w-]*)\s*,\s*([A-Za-z_][\w-]*)\s*(?:,([\s\S]*))?\)\s*$/i;
const UPDATE_LAYOUT_RE = /^\s*UpdateLayoutConfig\s*\(\s*([\s\S]*?)\s*\)\s*$/i;

const LAYOUT_KEYS = ['c4ShapeInRow', 'c4BoundaryInRow'];
const REL_STYLE_KEYS = ['textColor', 'lineColor', 'offsetX', 'offsetY'];
const EL_STYLE_KEYS = ['bgColor', 'fontColor', 'borderColor'];

/** True when source is a Mermaid C4 diagram. */
export function isC4Source(source) {
  if (!source) return false;
  for (const raw of String(source).split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line === '---' || line.startsWith('---')) continue;
    if (line.startsWith('%%{') || line.startsWith('%%}')) continue;
    return C4_HEADERS.test(line);
  }
  return false;
}

function stripQuotes(s) {
  const t = String(s || '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Parse $name="value" / $name=value / positional args from Update* tail. */
export function parseStyleArgs(tail, namedKeys, positionalKeys) {
  const out = {};
  if (!tail || !String(tail).trim()) return out;
  const parts = [];
  let cur = '';
  let q = null;
  for (let i = 0; i < tail.length; i++) {
    const ch = tail[i];
    if (q) {
      cur += ch;
      if (ch === q && tail[i - 1] !== '\\') q = null;
      continue;
    }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ',') { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  let pos = 0;
  for (const part of parts) {
    if (!part) continue;
    const named = part.match(/^\$?([A-Za-z_][\w]*)\s*=\s*([\s\S]+)$/);
    if (named) {
      const key = named[1];
      const val = stripQuotes(named[2]);
      if (namedKeys.includes(key) && val !== '') out[key] = val;
      continue;
    }
    // Skip slots already filled by named args so mixed forms stay sane.
    while (pos < positionalKeys.length && out[positionalKeys[pos]] != null) pos += 1;
    if (pos < positionalKeys.length) {
      const val = stripQuotes(part);
      if (val !== '') out[positionalKeys[pos]] = val;
      pos += 1;
    }
  }
  return out;
}

/** Parse UpdateLayoutConfig from source (last wins). */
export function parseLayoutConfig(source) {
  let layout = {};
  for (const raw of String(source || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    const m = line.match(UPDATE_LAYOUT_RE);
    if (m) {
      layout = parseStyleArgs(m[1] || '', LAYOUT_KEYS, LAYOUT_KEYS);
    }
  }
  return layout;
}

export function parseC4Model(source) {
  const elements = [];
  const rels = [];
  const elStyles = {};
  const relStyles = {};
  let layoutConfig = {};
  const seenEl = new Set();
  const seenRel = new Set();

  for (const raw of String(source || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;

    let m = line.match(UPDATE_EL_RE);
    if (m) {
      const alias = m[1];
      elStyles[alias] = parseStyleArgs(m[2] || '', EL_STYLE_KEYS, EL_STYLE_KEYS);
      continue;
    }
    m = line.match(UPDATE_REL_RE);
    if (m) {
      const key = `${m[1]}->${m[2]}`;
      relStyles[key] = {
        from: m[1],
        to: m[2],
        ...parseStyleArgs(m[3] || '', REL_STYLE_KEYS, REL_STYLE_KEYS),
      };
      continue;
    }
    m = line.match(UPDATE_LAYOUT_RE);
    if (m) {
      layoutConfig = parseStyleArgs(m[1] || '', LAYOUT_KEYS, LAYOUT_KEYS);
      continue;
    }

    m = line.match(ELEMENT_RE);
    if (m) {
      const kind = m[1];
      const alias = m[2];
      if (!seenEl.has(alias)) {
        seenEl.add(alias);
        elements.push({ alias, kind });
      }
      continue;
    }
    m = line.match(REL_RE);
    if (m) {
      const from = m[2];
      const to = m[3];
      const key = `${from}->${to}`;
      if (!seenRel.has(key)) {
        seenRel.add(key);
        rels.push({ from, to, kind: m[1], key });
      }
    }
  }

  return { elements, rels, elStyles, relStyles, layoutConfig };
}

function quoteStyleValue(v) {
  const s = String(v);
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s) || /^[A-Za-z][\w-]*$/.test(s)) return `"${s}"`;
  if (/^-?\d+(\.\d+)?$/.test(s)) return `"${s}"`;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function formatNamed(entries) {
  return entries
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `$${k}=${quoteStyleValue(String(v).trim())}`)
    .join(', ');
}

function isStyleEmpty(style, keys) {
  if (!style) return true;
  return keys.every((k) => style[k] == null || String(style[k]).trim() === '');
}

/**
 * Replace or append UpdateElementStyle for `alias`.
 * Pass null/empty colors to remove the statement.
 */
export function upsertElementStyle(source, alias, style) {
  const lines = String(source || '').split(/\r?\n/);
  const empty = isStyleEmpty(style, EL_STYLE_KEYS);
  const stmt = empty
    ? null
    : `UpdateElementStyle(${alias}, ${formatNamed([
      ['bgColor', style.bgColor],
      ['fontColor', style.fontColor],
      ['borderColor', style.borderColor],
    ])})`;

  let found = false;
  const next = [];
  for (const line of lines) {
    const m = line.trim().match(UPDATE_EL_RE);
    if (m && m[1] === alias) {
      found = true;
      if (stmt) next.push(stmt);
      continue;
    }
    next.push(line);
  }
  if (!found && stmt) {
    while (next.length && next[next.length - 1].trim() === '') next.pop();
    next.push(stmt);
  }
  return next.join('\n').replace(/\s+$/, '') + (next.length ? '\n' : '');
}

/** Replace or append UpdateRelStyle for from→to (colors + label offsets). */
export function upsertRelStyle(source, from, to, style) {
  const lines = String(source || '').split(/\r?\n/);
  const empty = isStyleEmpty(style, REL_STYLE_KEYS);
  const stmt = empty
    ? null
    : `UpdateRelStyle(${from}, ${to}, ${formatNamed([
      ['textColor', style.textColor],
      ['lineColor', style.lineColor],
      ['offsetX', style.offsetX],
      ['offsetY', style.offsetY],
    ])})`;

  let found = false;
  const next = [];
  for (const line of lines) {
    const m = line.trim().match(UPDATE_REL_RE);
    if (m && m[1] === from && m[2] === to) {
      found = true;
      if (stmt) next.push(stmt);
      continue;
    }
    next.push(line);
  }
  if (!found && stmt) {
    while (next.length && next[next.length - 1].trim() === '') next.pop();
    next.push(stmt);
  }
  return next.join('\n').replace(/\s+$/, '') + (next.length ? '\n' : '');
}

/**
 * Replace or append UpdateLayoutConfig.
 * Pass empty/null fields to remove the statement.
 */
export function upsertLayoutConfig(source, layout) {
  const lines = String(source || '').split(/\r?\n/);
  const empty = isStyleEmpty(layout, LAYOUT_KEYS);
  const stmt = empty
    ? null
    : `UpdateLayoutConfig(${formatNamed([
      ['c4ShapeInRow', layout.c4ShapeInRow],
      ['c4BoundaryInRow', layout.c4BoundaryInRow],
    ])})`;

  let found = false;
  const next = [];
  for (const line of lines) {
    const m = line.trim().match(UPDATE_LAYOUT_RE);
    if (m) {
      found = true;
      if (stmt) next.push(stmt);
      continue;
    }
    next.push(line);
  }
  if (!found && stmt) {
    while (next.length && next[next.length - 1].trim() === '') next.pop();
    next.push(stmt);
  }
  return next.join('\n').replace(/\s+$/, '') + (next.length ? '\n' : '');
}

/**
 * Resolve a clicked SVG node to a C4 selection.
 * Pele C4 uses data-id=alias on nodes/clusters and data-id="from-to" on edges.
 */
export function selectionFromSvgTarget(target, model) {
  if (!target || !target.closest) return null;
  const edge = target.closest('g.pele-edge[data-id]');
  if (edge) {
    const id = edge.getAttribute('data-id') || '';
    const hit = model.rels.find((r) => `${r.from}-${r.to}` === id || r.key === id);
    if (hit) return { type: 'rel', from: hit.from, to: hit.to, key: hit.key };
    // fallback: split on last '-' that yields known aliases
    for (const r of model.rels) {
      if (id === `${r.from}-${r.to}`) return { type: 'rel', from: r.from, to: r.to, key: r.key };
    }
  }
  const node = target.closest('g.pele-node[data-id], g.pele-cluster[data-id]');
  if (node) {
    const alias = node.getAttribute('data-id');
    if (alias && model.elements.some((e) => e.alias === alias)) {
      return { type: 'element', alias };
    }
    if (alias) return { type: 'element', alias };
  }
  return null;
}

export function applySelectionHighlight(root, selection) {
  if (!root) return;
  root.querySelectorAll('.c4-hit.c4-selected').forEach((el) => el.classList.remove('c4-selected'));
  if (!selection) return;
  let el = null;
  if (selection.type === 'element') {
    el = root.querySelector(`g.pele-node[data-id="${cssEscape(selection.alias)}"], g.pele-cluster[data-id="${cssEscape(selection.alias)}"]`);
  } else if (selection.type === 'rel') {
    const id = `${selection.from}-${selection.to}`;
    el = root.querySelector(`g.pele-edge[data-id="${cssEscape(id)}"]`);
  }
  if (el) {
    el.classList.add('c4-hit', 'c4-selected');
  }
}

function cssEscape(s) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return String(s).replace(/"/g, '\\"');
}
