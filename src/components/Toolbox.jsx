import { VAR_META, OPT_GROUPS, ALL_OPTS } from '../constants.js';

const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v).trim());
function expandHex(hex) {
  const h = hex.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
  return h;
}

function VarRow({ meta, value, onChange }) {
  return (
    <div className="var-row">
      <div className="var-meta">
        <span className="var-name">{meta.name}</span>
        <span className="var-hint">{meta.hint}</span>
      </div>
      <div className="var-controls">
        {meta.kind === 'color' && (
          <input
            type="color" title={meta.name} aria-label={meta.name}
            value={isHexColor(value) ? expandHex(value) : '#000000'}
            onChange={(e) => onChange(meta.name, e.target.value)}
          />
        )}
        <input
          type="text" spellCheck="false" autoComplete="off" aria-label={meta.name + ' value'}
          value={value}
          onChange={(e) => onChange(meta.name, e.target.value)}
        />
      </div>
    </div>
  );
}

function OptRow({ o, value, onChange, onReset }) {
  const set = (v) => onChange(o, v);
  let ctl = null;
  if (o.kind === 'num') {
    const shown = value !== undefined ? value : (o.def !== undefined ? o.def : o.min);
    ctl = (<>
      <input type="range" aria-label={o.id} min={o.min} max={o.max} step={o.step || 1} value={shown}
        onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />
      <input type="number" aria-label={o.id + ' number'} min={o.min} max={o.max} step={o.step || 1}
        placeholder={o.def !== undefined ? String(o.def) : 'default'}
        value={value !== undefined ? value : ''}
        onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />
    </>);
  } else if (o.kind === 'bool' || o.kind === 'enum') {
    const vals = o.kind === 'bool' ? ['true', 'false'] : o.values;
    ctl = (
      <select aria-label={o.id} value={value === undefined ? '' : String(value)} onChange={(e) => {
        let v = e.target.value;
        if (o.kind === 'bool') v = v === '' ? undefined : v === 'true';
        else if (v === '' && !o.required) v = undefined;
        set(v);
      }}>
        {!o.required && <option value="">default</option>}
        {vals.map((v) => <option key={v} value={v}>{v === '' ? '(default)' : v}</option>)}
      </select>
    );
  } else if (o.kind === 'font') {
    ctl = (<>
      <select aria-label={o.id + ' preset'} onChange={(e) => { if (e.target.value) { set(e.target.value); e.target.value = ''; } }}>
        <option value="">preset…</option>
        {o.presets.map((p) => <option key={p} value={p}>{p.replace(/"/g, '')}</option>)}
      </select>
      <input type="text" spellCheck="false" aria-label={o.id} value={value || ''} onChange={(e) => set(e.target.value)} />
    </>);
  } else if (o.kind === 'checks') {
    ctl = (
      <div className="opt-checks">
        {o.values.map((v) => (
          <label key={v}>
            <input type="checkbox" checked={!!(value && value.includes(v))}
              onChange={(e) => {
                const cur = new Set(value || []);
                e.target.checked ? cur.add(v) : cur.delete(v);
                set(cur.size ? [...cur] : undefined);
              }} />
            {v}
          </label>
        ))}
      </div>
    );
  } else if (o.kind === 'date') {
    ctl = <input type="date" aria-label={o.id} value={value || ''} onChange={(e) => set(e.target.value || undefined)} />;
  }
  const modified = o.kind !== 'font' && value !== undefined && value !== o.factory;
  const def = o.def !== undefined ? ` · default ${o.def}` : '';
  return (
    <div className={'opt-row' + (o.kind === 'font' || o.kind === 'checks' ? ' wide' : '') + (modified ? ' set' : '')}>
      <label className="opt-name">{o.key}
        <span className="opt-hint">{(o.path ? o.path.join('.') : o.key) + def}</span>
        {o.hint && <span className="opt-hint">{o.hint}</span>}
      </label>
      <div className="opt-ctl">
        {ctl}
        {o.kind !== 'font' && (
          <button type="button" className="ibtn ghost tiny" title={`Reset ${o.key} to default`} aria-label={`Reset ${o.key} to default`}
            onClick={() => onReset(o)}>✕</button>
        )}
      </div>
    </div>
  );
}

export default function Toolbox({ vars, onVarChange, optVals, onOptChange, onOptReset, cssBlock, optionsJson }) {
  const optValue = (o) => (o.kind === 'font' ? vars[o.cssVar] : optVals[o.id]);
  return (
    <aside className="toolbox" aria-label="Toolbox">
      <details className="section" open>
        <summary className="panel-head">CSS variables <span className="count">{VAR_META.length}</span></summary>
        <div className="vars-list">
          {VAR_META.map((meta) => (
            <VarRow key={meta.name} meta={meta} value={vars[meta.name]} onChange={onVarChange} />
          ))}
        </div>
      </details>
      <details className="section" open>
        <summary className="panel-head">Render options <span className="count">Pele / Mermaid API</span></summary>
        <div className="opts-list">
          {OPT_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="opt-group">{g.title}{g.note && <small>{g.note}</small>}</div>
              {g.items.map((o) => (
                <OptRow key={o.id} o={o} value={optValue(o)} onChange={onOptChange} onReset={onOptReset} />
              ))}
            </div>
          ))}
        </div>
      </details>
      <details className="section" open>
        <summary className="panel-head">Output</summary>
        <div className="outputs">
          <div className="out-head">.pele CSS</div>
          <pre className="out">{cssBlock}</pre>
          <div className="out-head">pele.mount / render options (JSON)</div>
          <pre className="out">{optionsJson}</pre>
        </div>
      </details>
    </aside>
  );
}

export { ALL_OPTS };
