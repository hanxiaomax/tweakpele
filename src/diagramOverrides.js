/**
 * Per-diagram style/render override helpers.
 * Edits made in a diagram's own DiagramTypePanel are stored as overrides on
 * top of the global toolbox state (defaults stay in the sidebar).
 */
import { VAR_META, ALL_OPTS, buildMountOptions } from './constants.js';

/** True iff the kinds array explicitly lists `type` (not merely via 'all'). */
export function isTypeSpecific(kinds, type) {
  return Boolean(type && Array.isArray(kinds) && kinds.includes(type));
}

/** True when kinds are global-only (only 'all' / empty) — sidebar toolbox territory. */
export function isGlobalOnly(kinds) {
  const list = kinds && kinds.length ? kinds : ['all'];
  return list.every((k) => k === 'all');
}

/** VAR_META entries that specifically apply to `type` (e.g. series colors for pie). */
export function typeSpecificVars(type) {
  return type ? VAR_META.filter((m) => isTypeSpecific(m.kinds, type)) : [];
}

/** Render options whose kinds explicitly include `type` (global-only opts excluded). */
export function typeSpecificOpts(type) {
  return type ? ALL_OPTS.filter((o) => isTypeSpecific(o.kinds, type)) : [];
}

/** True when DiagramTypePanel has anything to show for this type. */
export function hasTypeSpecificFields(type) {
  return typeSpecificVars(type).length > 0 || typeSpecificOpts(type).length > 0;
}

function clean(src) {
  const out = {};
  if (!src) return out;
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

/** Global vars with per-diagram overrides layered on top. */
export function mergeDiagramVars(global, overrideVars) {
  return { ...global, ...clean(overrideVars) };
}

/** Global option values with per-diagram overrides layered on top. */
export function mergeDiagramOptVals(global, overrideOpts) {
  return { ...global, ...clean(overrideOpts) };
}

/** pele.mount options for one diagram: global toolbox + override, then view patch. */
export function buildDiagramMountOptions(globalOptVals, globalVars, override, viewPatch) {
  const o = override || {};
  const out = buildMountOptions(
    mergeDiagramOptVals(globalOptVals, o.opts),
    mergeDiagramVars(globalVars, o.vars),
  );
  return viewPatch ? { ...out, ...viewPatch } : out;
}

/** React style object carrying every Pele CSS variable (used to scope overrides). */
export function varsStyleFrom(vars) {
  const o = {};
  for (const { name } of VAR_META) o[name] = vars[name];
  return o;
}

/** Number of override keys set on a diagram entry (0 when inheriting fully). */
export function overrideKeyCount(override) {
  if (!override) return 0;
  return Object.keys(override.opts || {}).length + Object.keys(override.vars || {}).length;
}
