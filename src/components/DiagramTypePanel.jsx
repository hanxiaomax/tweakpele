import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPalette as Palette, LuChevronDown as ChevronDown, LuChevronRight as ChevronRight } from 'react-icons/lu';
import { VAR_META } from '../constants.js';
import { typeSpecificVars, typeSpecificOpts, overrideKeyCount } from '../diagramOverrides.js';

const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v || '').trim());
function expandHex(hex) {
  const h = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
  return h || '#888888';
}

const VAR_REF_RE = /^var\(\s*(--pele-[\w-]+)\s*\)$/i;
function parseVarRef(value) {
  const m = String(value || '').trim().match(VAR_REF_RE);
  return m ? m[1] : null;
}

function ColorField({ label, value, onChange, onClear, paletteTokens, overridden = false }) {
  const hex = isHexColor(value) ? expandHex(value) : '#888888';
  const selectedToken = parseVarRef(value);
  return (
    <div className={'c4-color-field' + (overridden ? ' set' : '')}>
      <span className="c4-field-label">{label}</span>
      <div className="c4-color-stack">
        <span className="c4-color-controls">
          <input
            type="color"
            aria-label={`${label} color`}
            value={hex}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            spellCheck="false"
            autoComplete="off"
            placeholder="#hex or var(--pele-…)"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="button" className="ibtn ghost tiny" title={`Clear ${label} (inherit global)`} aria-label={`Clear ${label}`}
            onClick={onClear} disabled={!overridden}>✕</button>
        </span>
        {paletteTokens && paletteTokens.length > 0 && (
          <div className="c4-palette-swatches" role="list" aria-label={`${label} palette tokens`}>
            {paletteTokens.map((tok) => {
              const active = selectedToken === tok.name;
              return (
                <button
                  key={tok.name}
                  type="button"
                  role="listitem"
                  className={'c4-swatch' + (active ? ' active' : '')}
                  title={`${tok.label} · ${tok.name}`}
                  aria-label={`Use ${tok.name}`}
                  aria-pressed={active}
                  style={{ background: tok.value || '#888' }}
                  onClick={() => onChange(`var(${tok.name})`)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OptField({ o, effective, overridden, onChange, onClear }) {
  let ctl = null;
  if (o.kind === 'num') {
    ctl = (
      <input
        type="number"
        min={o.min} max={o.max} step={o.step || 1}
        placeholder={o.def !== undefined ? String(o.def) : 'default'}
        value={effective !== undefined && effective !== '' ? effective : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        aria-label={o.key}
      />
    );
  } else if (o.kind === 'bool' || o.kind === 'enum') {
    const vals = o.kind === 'bool' ? ['true', 'false'] : o.values;
    ctl = (
      <select aria-label={o.key} value={String(effective ?? '')} onChange={(e) => {
        let v = e.target.value;
        if (o.kind === 'bool') v = v === '' ? undefined : v === 'true';
        else if (v === '' && !o.required) v = undefined;
        onChange(v);
      }}>
        <option value="">inherit</option>
        {vals.map((v) => <option key={v} value={v}>{v === '' ? '(default)' : v}</option>)}
      </select>
    );
  } else if (o.kind === 'checks') {
    const list = Array.isArray(effective) ? effective : [];
    ctl = (
      <div className="opt-checks diagram-opt-checks">
        {o.values.map((v) => (
          <label key={v}>
            <input type="checkbox" checked={list.includes(v)}
              onChange={(e) => {
                const cur = new Set(list);
                e.target.checked ? cur.add(v) : cur.delete(v);
                onChange(cur.size ? [...cur] : undefined);
              }} />
            {v}
          </label>
        ))}
      </div>
    );
  } else if (o.kind === 'date') {
    ctl = (
      <input type="date" aria-label={o.key} value={effective || ''}
        onChange={(e) => onChange(e.target.value || undefined)} />
    );
  } else {
    ctl = (
      <input type="text" spellCheck="false" aria-label={o.key} value={effective || ''}
        onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <div className={'diagram-opt-row' + (overridden ? ' set' : '')} title={o.hint || o.key}>
      <span className="c4-field-label">{o.key}</span>
      <span className="diagram-opt-ctl">
        {ctl}
        <button type="button" className="ibtn ghost tiny" title={`Clear ${o.key} (inherit global)`}
          aria-label={`Clear ${o.key}`} onClick={onClear} disabled={!overridden}>✕</button>
      </span>
    </div>
  );
}

/**
 * Per-diagram, type-specific style panel (bottom-left, mirrors C4StylePanel).
 * Shows only CSS vars / render options whose kinds explicitly include the
 * diagram type; global-only controls stay in the sidebar Toolbox.
 * Values shown are effective (override ?? global); ✕ / "Reset" drops the
 * override key so the diagram inherits the global value again.
 */
export default function DiagramTypePanel({
  diagramType, globalVars = {}, globalOptVals = {}, override,
  onChangeOpt, onChangeVar, onResetAll, compact = false, defaultCollapsed = false,
}) {
  const tsVars = useMemo(() => typeSpecificVars(diagramType), [diagramType]);
  const tsOpts = useMemo(() => typeSpecificOpts(diagramType), [diagramType]);
  const [open, setOpen] = useState(!defaultCollapsed);
  const rootRef = useRef(null);

  // Native wheel stop: panel scrolling must not pan/zoom the canvas viewport
  // (its wheel listener sits on an ancestor and React stopPropagation is too late).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('wheel', stop);
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const paletteTokens = useMemo(() => VAR_META
    .filter((m) => m.kind === 'color')
    .map((m) => ({ name: m.name, label: m.label || m.name, value: globalVars[m.name] || '' }))
    .filter((t) => t.value),
  [globalVars]);

  if (!tsVars.length && !tsOpts.length) return null;

  const ovOpts = override?.opts || {};
  const ovVars = override?.vars || {};
  const overriddenCount = overrideKeyCount(override);

  const setVar = (name, value) => onChangeVar(name, value);

  return (
    <aside
      ref={rootRef}
      className={
        'diagram-style-panel'
        + (compact ? ' compact' : '')
        + (open ? '' : ' collapsed')
      }
      aria-label={`${diagramType} style editor`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="diagram-style-head" onClick={() => setOpen((o) => !o)}
        aria-expanded={open} title={open ? 'Collapse style panel' : 'Expand style panel'}>
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <Palette aria-hidden="true" />
        <b>{diagramType} style</b>
        {overriddenCount > 0 && (
          <span className="diagram-style-count" title="Per-diagram overrides set">{overriddenCount}</span>
        )}
        <span className="c4-style-hint">per-diagram · global defaults in toolbox</span>
      </button>

      {open && (
        <div className="c4-style-body diagram-style-body">
          {tsVars.length > 0 && (
            <>
              <div className="diagram-style-group">Colors · {diagramType}</div>
              {tsVars.map((meta) => (
                <ColorField
                  key={meta.name}
                  label={meta.label || meta.name}
                  value={ovVars[meta.name] ?? globalVars[meta.name] ?? ''}
                  overridden={meta.name in ovVars}
                  paletteTokens={paletteTokens}
                  onChange={(v) => setVar(meta.name, v)}
                  onClear={() => setVar(meta.name, undefined)}
                />
              ))}
            </>
          )}
          {tsVars.some((m) => m.kind !== 'color') && (
            <>
              <div className="diagram-style-group">Text vars</div>
              {tsVars.filter((m) => m.kind !== 'color').map((meta) => (
                <OptField
                  key={meta.name}
                  o={{ key: meta.label || meta.name, kind: 'text', hint: meta.hint }}
                  effective={ovVars[meta.name] ?? globalVars[meta.name]}
                  overridden={meta.name in ovVars}
                  onChange={(v) => setVar(meta.name, v)}
                  onClear={() => setVar(meta.name, undefined)}
                />
              ))}
            </>
          )}
          {tsOpts.length > 0 && (
            <>
              <div className="diagram-style-group">Render options · {diagramType}</div>
              {tsOpts.map((o) => (
                <OptField
                  key={o.id}
                  o={o}
                  effective={o.kind === 'font' ? undefined : (o.id in ovOpts ? ovOpts[o.id] : globalOptVals[o.id])}
                  overridden={o.id in ovOpts}
                  onChange={(v) => onChangeOpt(o.id, v)}
                  onClear={() => onChangeOpt(o.id, undefined)}
                />
              ))}
            </>
          )}
          <div className="c4-style-actions">
            <button type="button" className="btn" onClick={onResetAll} disabled={!overriddenCount}>
              Reset to global
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
