import { memo, useEffect, useMemo, useState } from 'react';
import {
  VAR_META, OPT_GROUPS, THEME_PRESETS, matchThemePreset,
  DIAGRAM_KINDS, matchesDiagramKind,
} from '../constants.js';
import { fuzzyMatch, fuzzyScore } from '../lib.js';

const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v).trim());
function expandHex(hex) {
  const h = hex.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
  return h;
}

const SWATCH_KEYS = [
  '--pele-bg',
  '--pele-surface',
  '--pele-accent',
  '--pele-series-1',
  '--pele-fg',
];

const PresetCard = memo(function PresetCard({ preset, selected, onSelect }) {
  return (
    <button
      type="button"
      className={'theme-preset' + (selected ? ' selected' : '')}
      aria-pressed={selected}
      title={preset.description || preset.label}
      onClick={() => onSelect(preset)}
    >
      <span className="theme-preset-preview" aria-hidden="true">
        <span className="theme-preset-swatches">
          {SWATCH_KEYS.map((key) => (
            <i key={key} style={{ background: preset.vars[key] }} />
          ))}
        </span>
      </span>
      <span className="theme-preset-meta">
        <span className="theme-preset-meta-row">
          <b>{preset.label}</b>
          <small className={'theme-preset-tone ' + (preset.tone || 'light')}>
            {preset.tone === 'dark' ? 'Dark' : 'Light'}
          </small>
        </span>
        {preset.description ? <span className="theme-preset-desc">{preset.description}</span> : null}
      </span>
    </button>
  );
});

const VarRow = memo(function VarRow({ meta, value, onChange }) {
  const short = meta.label || meta.name.replace(/^--pele-/, '');
  return (
    <div className="var-row">
      <div className="var-meta">
        <span className="var-label">{short}</span>
        <span className="var-name" title={meta.name}>{meta.name}</span>
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
});

const OptRow = memo(function OptRow({ o, value, onChange, onReset }) {
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
  const pathHint = o.path ? o.path.join('.') : o.key;
  const kindTag = (o.kinds && !o.kinds.includes('all'))
    ? o.kinds.join(', ')
    : 'all';
  return (
    <div className={'opt-row' + (o.kind === 'font' || o.kind === 'checks' ? ' wide' : '') + (modified ? ' set' : '')}>
      <label className="opt-name">
        <span className="opt-key">{o.key}</span>
        <span className="opt-hint">{pathHint}{def}</span>
        {o.hint && <span className="opt-hint">{o.hint}</span>}
        <span className="opt-kind-tag" title="Affects diagram kinds">{kindTag}</span>
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
});

function ListFilterBar({
  search, onSearch, searchPlaceholder,
  typeFilter, onTypeFilter, autoType, kinds,
}) {
  return (
    <div className="list-filter-bar">
      <input
        type="search"
        className="list-filter-search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        aria-label={searchPlaceholder}
      />
      <select
        className="list-filter-type"
        value={typeFilter}
        onChange={(e) => onTypeFilter(e.target.value)}
        aria-label="Filter by diagram type"
        title={autoType ? `Auto: ${autoType}` : 'All diagram types'}
      >
        <option value="all">All types</option>
        {kinds.map((k) => (
          <option key={k} value={k}>{k}{autoType === k ? ' · focused' : ''}</option>
        ))}
      </select>
      {autoType && typeFilter === autoType && (
        <span className="list-filter-auto" title="Filter follows focused / edited diagram">auto</span>
      )}
      {typeFilter !== 'all' && typeFilter !== autoType && (
        <button type="button" className="list-filter-clear" onClick={() => onTypeFilter(autoType || 'all')}>
          {autoType ? 'Reset auto' : 'Clear'}
        </button>
      )}
    </div>
  );
}

export default function Toolbox({
  vars, onVarChange, onApplyPreset, optVals, onOptChange, onOptReset,
  cssBlock, optionsJson, diagramType = null,
}) {
  const optValue = (o) => (o.kind === 'font' ? vars[o.cssVar] : optVals[o.id]);
  const active = matchThemePreset(vars);

  const [varQuery, setVarQuery] = useState('');
  const [optQuery, setOptQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // When focusing / editing a Mermaid of a known type, auto-apply that type filter.
  useEffect(() => {
    if (diagramType) setTypeFilter(diagramType);
    else setTypeFilter('all');
  }, [diagramType]);

  const filteredVars = useMemo(() => {
    const scored = VAR_META
      .filter((meta) => matchesDiagramKind(meta.kinds, typeFilter))
      .map((meta) => {
        const hay = [meta.label, meta.name, meta.hint, meta.name.replace(/^--pele-/, '')];
        if (!fuzzyMatch(varQuery, hay)) return null;
        const score = Math.max(...hay.map((h) => fuzzyScore(varQuery, h)));
        return { meta, score };
      })
      .filter(Boolean);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.meta);
  }, [varQuery, typeFilter]);

  const filteredGroups = useMemo(() => {
    return OPT_GROUPS.map((g) => {
      const items = g.items
        .filter((o) => matchesDiagramKind(o.kinds || g.kinds, typeFilter))
        .map((o) => {
          const hay = [o.key, o.hint, o.group, g.title, g.note, (o.path || []).join('.'), (o.kinds || []).join(' ')];
          if (!fuzzyMatch(optQuery, hay)) return null;
          const score = Math.max(...hay.map((h) => fuzzyScore(optQuery, h)));
          return { o, score };
        })
        .filter(Boolean);
      items.sort((a, b) => b.score - a.score);
      return { ...g, items: items.map((x) => x.o) };
    }).filter((g) => g.items.length > 0);
  }, [optQuery, typeFilter]);

  const visibleOptCount = filteredGroups.reduce((n, g) => n + g.items.length, 0);

  return (
    <aside className="toolbox" aria-label="Toolbox">
      <details className="section" open>
        <summary className="panel-head">
          Theme presets
          <span className="count">{active ? active.label : 'Custom'}</span>
        </summary>
        <div className="theme-preset-grid" role="list">
          {THEME_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={active?.id === preset.id}
              onSelect={onApplyPreset}
            />
          ))}
        </div>
      </details>
      <details className="section" open>
        <summary className="panel-head">
          CSS variables
          <span className="count">{filteredVars.length}/{VAR_META.length}</span>
        </summary>
        <ListFilterBar
          search={varQuery}
          onSearch={setVarQuery}
          searchPlaceholder="Search CSS vars…"
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          autoType={diagramType}
          kinds={DIAGRAM_KINDS}
        />
        <div className="vars-list">
          {filteredVars.length === 0 ? (
            <div className="list-empty">No CSS variables match.</div>
          ) : filteredVars.map((meta) => (
            <VarRow key={meta.name} meta={meta} value={vars[meta.name]} onChange={onVarChange} />
          ))}
        </div>
      </details>
      <details className="section" open>
        <summary className="panel-head">
          Render options
          <span className="count">{visibleOptCount} shown · Pele / Mermaid</span>
        </summary>
        <ListFilterBar
          search={optQuery}
          onSearch={setOptQuery}
          searchPlaceholder="Search render options…"
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          autoType={diagramType}
          kinds={DIAGRAM_KINDS}
        />
        <div className="opts-list">
          {filteredGroups.length === 0 ? (
            <div className="list-empty">No render options match this type / search.</div>
          ) : filteredGroups.map((g) => (
            <div key={g.title}>
              <div className="opt-group">
                {g.title}
                {g.note && <small>{g.note}</small>}
                {g.kinds && !g.kinds.includes('all') && (
                  <small className="opt-group-kinds">{g.kinds.join(' · ')}</small>
                )}
              </div>
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
