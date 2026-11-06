import { useEffect, useMemo, useState } from 'react';
import { LuPalette as Palette, LuX as X } from 'react-icons/lu';
import {
  parseC4Model, upsertElementStyle, upsertRelStyle, isC4Source,
} from '../c4.js';

const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v || '').trim());
function expandHex(hex) {
  const h = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
  return h || '#888888';
}

function ColorField({ label, value, onChange, onClear }) {
  const hex = isHexColor(value) ? expandHex(value) : '#888888';
  return (
    <label className="c4-color-field">
      <span>{label}</span>
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
    </label>
  );
}

/**
 * Interactive C4 UpdateElementStyle / UpdateRelStyle editor.
 * selection: {type:'element', alias} | {type:'rel', from, to, key} | null
 */
export default function C4StylePanel({
  source, onChangeSource, selection, onSelect, compact = false,
}) {
  const model = useMemo(() => parseC4Model(source), [source]);
  const [mode, setMode] = useState(selection?.type === 'rel' ? 'rel' : 'element');

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

  return (
    <aside className={'c4-style-panel' + (compact ? ' compact' : '')} aria-label="C4 color editor">
      <header className="c4-style-head">
        <Palette aria-hidden="true" />
        <b>C4 colors</b>
        <span className="c4-style-hint">Click a shape or arrow · writes Update*Style into source</span>
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
          onClick={() => setMode('rel')}>Relationships</button>
      </div>

      {mode === 'element' ? (
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
              <ColorField label="Background" value={elStyle.bgColor}
                onChange={(v) => setEl({ bgColor: v })} onClear={() => setEl({ bgColor: '' })} />
              <ColorField label="Font" value={elStyle.fontColor}
                onChange={(v) => setEl({ fontColor: v })} onClear={() => setEl({ fontColor: '' })} />
              <ColorField label="Border" value={elStyle.borderColor}
                onChange={(v) => setEl({ borderColor: v })} onClear={() => setEl({ borderColor: '' })} />
              <div className="c4-style-actions">
                <button type="button" className="btn" onClick={clearEl}
                  disabled={!(elStyle.bgColor || elStyle.fontColor || elStyle.borderColor)}>
                  Clear element styles
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
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
              <ColorField label="Text" value={relStyle.textColor}
                onChange={(v) => setRel({ textColor: v })} onClear={() => setRel({ textColor: '' })} />
              <ColorField label="Line" value={relStyle.lineColor}
                onChange={(v) => setRel({ lineColor: v })} onClear={() => setRel({ lineColor: '' })} />
              <div className="c4-style-actions">
                <button type="button" className="btn" onClick={clearRel}
                  disabled={!(relStyle.textColor || relStyle.lineColor)}>
                  Clear relationship styles
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
