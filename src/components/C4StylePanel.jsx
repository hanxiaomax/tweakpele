import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPalette as Palette, LuX as X } from 'react-icons/lu';
import {
  parseC4Model, upsertElementStyle, upsertRelStyle, upsertLayoutConfig, isC4Source,
} from '../c4.js';
import { VAR_META } from '../constants.js';
import useDragOffset from '../useDragOffset.js';

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

function ColorField({ label, value, onChange, onClear, paletteTokens }) {
  const hex = isHexColor(value) ? expandHex(value) : '#888888';
  const selectedToken = parseVarRef(value);
  return (
    <div className="c4-color-field">
      <span className="c4-field-label">{label}</span>
      <div className="c4-color-picker-panel">
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
          <button type="button" className="ibtn ghost tiny" title={`Clear ${label}`} aria-label={`Clear ${label}`}
            onClick={onClear} disabled={!value}>✕</button>
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

function NumberField({ label, value, onChange, onClear, placeholder }) {
  return (
    <label className="c4-number-field">
      <span className="c4-field-label">{label}</span>
      <span className="c4-number-controls">
        <input
          type="number"
          step="1"
          placeholder={placeholder || '0'}
          value={value == null || value === '' ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <button type="button" className="ibtn ghost tiny" title={`Clear ${label}`} aria-label={`Clear ${label}`}
          onClick={onClear} disabled={value == null || value === ''}>✕</button>
      </span>
    </label>
  );
}

/**
 * Interactive C4 UpdateElementStyle / UpdateRelStyle / UpdateLayoutConfig editor.
 * selection: {type:'element', alias} | {type:'rel', from, to, key} | null
 * vars: current global Pele CSS variable map (for palette swatches)
 */
export default function C4StylePanel({
  source, onChangeSource, selection, onSelect, compact = false, vars = null,
}) {
  const model = useMemo(() => parseC4Model(source), [source]);
  const [mode, setMode] = useState(
    selection?.type === 'rel' ? 'rel' : (selection?.type === 'element' ? 'element' : 'element'),
  );
  const rootRef = useRef(null);
  const { handleProps } = useDragOffset(rootRef);

  const paletteTokens = useMemo(() => {
    const map = vars || {};
    return VAR_META
      .filter((m) => m.kind === 'color')
      .map((m) => ({
        name: m.name,
        label: m.label || m.name,
        value: map[m.name] || '',
      }))
      .filter((t) => t.value);
  }, [vars]);

  useEffect(() => {
    if (selection?.type === 'rel') setMode('rel');
    else if (selection?.type === 'element') setMode('element');
  }, [selection]);

  if (!isC4Source(source)) return null;

  const elAlias = selection?.type === 'element'
    ? selection.alias
    : (model.elements[0]?.alias || '');
  const relKey = selection?.type === 'rel'
    ? selection.key
    : (model.rels[0]?.key || '');
  const activeRel = model.rels.find((r) => r.key === relKey) || model.rels[0];
  const elStyle = (elAlias && model.elStyles[elAlias]) || {};
  const relStyle = (activeRel && model.relStyles[activeRel.key]) || {};
  const layout = model.layoutConfig || {};

  const pickElement = (alias) => {
    onSelect?.({ type: 'element', alias });
    setMode('element');
  };
  const pickRel = (rel) => {
    onSelect?.({ type: 'rel', from: rel.from, to: rel.to, key: rel.key });
    setMode('rel');
  };

  const setEl = (patch) => {
    if (!elAlias) return;
    const next = { ...elStyle, ...patch };
    onChangeSource(upsertElementStyle(source, elAlias, next));
  };
  const clearEl = () => {
    if (!elAlias) return;
    onChangeSource(upsertElementStyle(source, elAlias, {}));
  };
  const setRel = (patch) => {
    if (!activeRel) return;
    const next = { ...relStyle, ...patch };
    onChangeSource(upsertRelStyle(source, activeRel.from, activeRel.to, next));
  };
  const clearRel = () => {
    if (!activeRel) return;
    onChangeSource(upsertRelStyle(source, activeRel.from, activeRel.to, {}));
  };
  const setLayout = (patch) => {
    const next = { ...layout, ...patch };
    onChangeSource(upsertLayoutConfig(source, next));
  };
  const clearLayout = () => {
    onChangeSource(upsertLayoutConfig(source, {}));
  };

  const elHasStyle = !!(elStyle.bgColor || elStyle.fontColor || elStyle.borderColor);
  const relHasStyle = !!(relStyle.textColor || relStyle.lineColor
    || relStyle.offsetX || relStyle.offsetY);
  const layoutHas = !!(layout.c4ShapeInRow || layout.c4BoundaryInRow);

  return (
    <aside ref={rootRef} className={'c4-style-panel' + (compact ? ' compact' : '')} aria-label="C4 style editor">
      <div {...handleProps} />
      <header className="c4-style-head">
        <Palette aria-hidden="true" />
        <b>C4 style</b>
        <span className="c4-style-hint">Click shape/arrow · palette → var(--pele-…)</span>
        {selection && (
          <button type="button" className="ibtn ghost tiny" title="Clear selection" aria-label="Clear selection"
            onClick={() => onSelect?.(null)}>
            <X aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="c4-style-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'element'}
          className={mode === 'element' ? 'active' : ''}
          onClick={() => setMode('element')}>Elements</button>
        <button type="button" role="tab" aria-selected={mode === 'rel'}
          className={mode === 'rel' ? 'active' : ''}
          onClick={() => setMode('rel')}>Rels</button>
        <button type="button" role="tab" aria-selected={mode === 'layout'}
          className={mode === 'layout' ? 'active' : ''}
          onClick={() => setMode('layout')}>Layout</button>
      </div>

      {mode === 'element' && (
        <div className="c4-style-body">
          {model.elements.length === 0 ? (
            <p className="c4-style-empty">No C4 elements found in source.</p>
          ) : (
            <>
              <label className="c4-style-select">
                <span>Element</span>
                <select
                  value={elAlias}
                  onChange={(e) => pickElement(e.target.value)}
                  aria-label="C4 element"
                >
                  {model.elements.map((el) => (
                    <option key={el.alias} value={el.alias}>
                      {el.alias} · {el.kind}
                    </option>
                  ))}
                </select>
              </label>
              <ColorField label="Background" value={elStyle.bgColor} paletteTokens={paletteTokens}
                onChange={(v) => setEl({ bgColor: v })} onClear={() => setEl({ bgColor: '' })} />
              <ColorField label="Font" value={elStyle.fontColor} paletteTokens={paletteTokens}
                onChange={(v) => setEl({ fontColor: v })} onClear={() => setEl({ fontColor: '' })} />
              <ColorField label="Border" value={elStyle.borderColor} paletteTokens={paletteTokens}
                onChange={(v) => setEl({ borderColor: v })} onClear={() => setEl({ borderColor: '' })} />
              <div className="c4-style-actions">
                <button type="button" className="btn" onClick={clearEl} disabled={!elHasStyle}>
                  Clear element styles
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'rel' && (
        <div className="c4-style-body">
          {model.rels.length === 0 ? (
            <p className="c4-style-empty">No C4 relationships found in source.</p>
          ) : (
            <>
              <label className="c4-style-select">
                <span>Relationship</span>
                <select
                  value={activeRel?.key || ''}
                  onChange={(e) => {
                    const rel = model.rels.find((r) => r.key === e.target.value);
                    if (rel) pickRel(rel);
                  }}
                  aria-label="C4 relationship"
                >
                  {model.rels.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.from} → {r.to}
                    </option>
                  ))}
                </select>
              </label>
              <ColorField label="Text" value={relStyle.textColor} paletteTokens={paletteTokens}
                onChange={(v) => setRel({ textColor: v })} onClear={() => setRel({ textColor: '' })} />
              <ColorField label="Line" value={relStyle.lineColor} paletteTokens={paletteTokens}
                onChange={(v) => setRel({ lineColor: v })} onClear={() => setRel({ lineColor: '' })} />
              <NumberField label="Offset X" value={relStyle.offsetX} placeholder="0"
                onChange={(v) => setRel({ offsetX: v })} onClear={() => setRel({ offsetX: '' })} />
              <NumberField label="Offset Y" value={relStyle.offsetY} placeholder="0"
                onChange={(v) => setRel({ offsetY: v })} onClear={() => setRel({ offsetY: '' })} />
              <div className="c4-style-actions">
                <button type="button" className="btn" onClick={clearRel} disabled={!relHasStyle}>
                  Clear relationship styles
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'layout' && (
        <div className="c4-style-body">
          <p className="c4-style-empty">Diagram-wide UpdateLayoutConfig (defaults 4 / 2).</p>
          <NumberField label="Shapes / row" value={layout.c4ShapeInRow} placeholder="4"
            onChange={(v) => setLayout({ c4ShapeInRow: v })}
            onClear={() => setLayout({ c4ShapeInRow: '' })} />
          <NumberField label="Bounds / row" value={layout.c4BoundaryInRow} placeholder="2"
            onChange={(v) => setLayout({ c4BoundaryInRow: v })}
            onClear={() => setLayout({ c4BoundaryInRow: '' })} />
          <div className="c4-style-actions">
            <button type="button" className="btn" onClick={clearLayout} disabled={!layoutHas}>
              Clear layout config
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
