import { useMemo, useState } from 'react';
import { VAR_META } from '../constants.js';
import { typeSpecificVars, typeSpecificOpts, overrideKeyCount } from '../diagramOverrides.js';
import ColorField from './ColorField.jsx';
import StylePanelShell from './StylePanelShell.jsx';

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
  onChangeOpt, onChangeVar, onResetAll, compact = false,
}) {
  const tsVars = useMemo(() => typeSpecificVars(diagramType), [diagramType]);
  const tsOpts = useMemo(() => typeSpecificOpts(diagramType), [diagramType]);
  const [open, setOpen] = useState(false);

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
    <StylePanelShell
      className="diagram-style-panel"
      compact={compact}
      open={open}
      onOpenChange={setOpen}
      title={`${diagramType} style`}
      hint="Per-diagram · global in toolbox"
      badge={overriddenCount}
      ariaLabel={`${diagramType} style editor`}
    >
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
                  clearDisabled={!(meta.name in ovVars)}
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
    </StylePanelShell>
  );
}
