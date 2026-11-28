/** Custom palettes stored in this browser (`tweakpele.custom-palettes.v1`).
 *  Built-in THEME_PRESETS stay read-only; custom ids are prefixed `custom-`.
 *  Typography / radius always come from PAPER_TYPE / INK_TYPE per tone. */
import { loadJSON, saveJSON, newId } from './lib.js';
import { VAR_META, FACTORY, DARK, PAPER_TYPE, INK_TYPE, THEME_PRESETS } from './constants.js';

const KEY = 'tweakpele.custom-palettes.v1';

export const COLOR_VARS = VAR_META.filter((m) => m.kind === 'color');

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const isHexColor = (v) => HEX_RE.test(String(v).trim());

/** 3/8-digit hex → 6-digit form for <input type="color">. */
export function expandHex(hex) {
  const h = String(hex).trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : '#000000';
}
const BUILT_IN_IDS = new Set(THEME_PRESETS.map((p) => p.id));

/** Fill gaps, validate hex, and force tone-owned typography. Keeps a usable
 *  `custom-` id when given one (rename), otherwise mints a new id. */
export function normalizePalette(raw, { tone } = {}) {
  const t = tone === 'dark' || (!tone && raw?.tone === 'dark') ? 'dark' : 'light';
  const base = t === 'dark' ? DARK : FACTORY;
  const vars = { ...(t === 'dark' ? INK_TYPE : PAPER_TYPE) };
  for (const { name } of COLOR_VARS) {
    const v = raw?.vars?.[name];
    vars[name] = typeof v === 'string' && isHexColor(v) ? v.trim() : base[name];
  }
  const id = raw && typeof raw.id === 'string' && raw.id.startsWith('custom-') && !BUILT_IN_IDS.has(raw.id)
    ? raw.id
    : `custom-${newId()}`;
  return {
    id,
    label: String(raw?.label || '').trim() || 'Custom palette',
    tone: t,
    description: String(raw?.description || '').trim(),
    vars,
  };
}

export function loadCustomPalettes() {
  const list = loadJSON(KEY, []);
  return Array.isArray(list) ? list.map((p) => normalizePalette(p)) : [];
}

export function saveCustomPalettes(list) {
  saveJSON(KEY, list);
}
