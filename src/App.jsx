import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuSun as Sun, LuMoon as Moon, LuPanelLeftClose as PanelLeftClose, LuPanelLeftOpen as PanelLeftOpen,
  LuFilePlus2 as FilePlus2, LuClipboardCopy as ClipboardCopy, LuBraces as Braces,
  LuRotateCcw as RotateCcw, LuMoonStar as MoonStar, LuArchiveRestore as ArchiveRestore,
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuLayoutGrid as LayoutGrid, LuInfinity as InfinityIcon,
  LuFocus as Focus, LuSave as Save,
} from 'react-icons/lu';
import Toolbox from './components/Toolbox.jsx';
import Gallery from './components/Gallery.jsx';
import Canvas from './components/Canvas.jsx';
import EditorView from './components/EditorView.jsx';
import FocusedView from './components/FocusedView.jsx';
import { ContextMenu, Dialog, IconButton, Toast } from './components/ui.jsx';
import {
  VAR_META, FACTORY, DARK, THEME_PRESETS, REMEASURE_VARS, ALL_OPTS, OPT_GROUPS, STARTERS,
  factoryOpts, buildMountOptions, exportOptions, peleCssBlock,
} from './constants.js';
import { loadJSON, saveJSON, copyText, clamp, useHashRoute, navigate, useDebounced, usePersistedState, newId } from './lib.js';

const LIB_KEY = 'tweakpele.library.v1';
const VARS_KEY = 'tweakpele.vars.v1';
const OPTS_KEY = 'tweakpele.opts.v1';
const THEME_KEY = 'tweakpele.siteTheme';
const SPLIT_KEY = 'tweakpele.split.v1';
const TOOLBOX_KEY = 'tweakpele.toolbox.collapsed';
const VIEW_KEY = 'tweakpele.viewMode';

function seedLibrary() {
  return (window.TWEAKPELE_DIAGRAMS || []).map((m) => ({
    id: m.id, title: m.title, keyword: m.keyword,
    source: m.source, original: m.source, builtin: true,
  }));
}

export default function App() {
  const [siteTheme, setSiteTheme] = usePersistedState(THEME_KEY, (v) => (v === 'dark' ? 'dark' : 'light'));
  const [vars, setVars] = usePersistedState(VARS_KEY, (v) => ({ ...FACTORY, ...v }));
  const [optVals, setOptVals] = usePersistedState(OPTS_KEY, (v) => ({ ...factoryOpts(), ...v }));
  // library persists a versioned wrapper, so it keeps its explicit load/save pair
  const [diagrams, setDiagrams] = useState(() => {
    const stored = loadJSON(LIB_KEY, null);
    if (stored && Array.isArray(stored.diagrams)
      && stored.diagrams.every((d) => typeof d.id === 'string' && typeof d.source === 'string')) {
      return stored.diagrams;
    }
    return seedLibrary();
  });
  const [toolboxCollapsed, setToolboxCollapsed] = usePersistedState(TOOLBOX_KEY, (v) => v === true);
  const [viewMode, setViewMode] = usePersistedState(VIEW_KEY, (v) => (v === 'canvas' ? 'canvas' : 'gallery'));
  const [focusedId, setFocusedId] = useState(null);
  const [split, setSplit] = usePersistedState(SPLIT_KEY, (v) => (Number.isFinite(v) ? clamp(v, 16, 84) : 42));
  const [remeasureTick, setRemeasureTick] = useState(0);
  const route = useHashRoute();
  const [toastMsg, setToastMsg] = useState('');
  const [status, setStatus] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const toastTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 1800);
  }, []);

  // ------------------------------------------------------------------ derived
  const cssBlock = useMemo(() => peleCssBlock(vars), [vars]);
  const optionsJson = useMemo(() => JSON.stringify(exportOptions(optVals, vars), null, 2), [optVals, vars]);
  const mountOptions = useMemo(
    () => buildMountOptions(optVals, vars),
    // fonts feed mount options; the tick covers radius/weight changes that need a re-measure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optVals, vars['--pele-font'], vars['--pele-font-mono'], remeasureTick]
  );
  const debouncedMountOptions = useDebounced(mountOptions, 280);
  const galleryOptions = useMemo(() => ({ ...debouncedMountOptions, zoom: false }), [debouncedMountOptions]);
  // Canvas: natural full diagrams — no Pele in-diagram zoom, generous maxWidth, never crop.
  const canvasOptions = useMemo(() => ({
    ...debouncedMountOptions,
    zoom: false,
    maxWidth: Math.max(Number(debouncedMountOptions.maxWidth) || 0, 1600),
    responsive: false,
  }), [debouncedMountOptions]);
  const varsStyle = useMemo(() => {
    const o = {};
    for (const { name } of VAR_META) o[name] = vars[name];
    return o;
  }, [vars]);

  // ------------------------------------------------------------------ effects
  useEffect(() => { document.documentElement.dataset.theme = siteTheme; }, [siteTheme]);
  useEffect(() => { saveJSON(LIB_KEY, { formatVersion: 1, diagrams }); }, [diagrams]);

  useEffect(() => {
    setStatus(`${diagrams.length} diagrams · ${VAR_META.length} variables · ${ALL_OPTS.length} render options`);
  }, [diagrams.length]);


  const forgetMeasures = useCallback(() => {
    try { pele.forgetTextWidths(); } catch (_) { /* pele not loaded */ }
    setRemeasureTick((t) => t + 1);
  }, []);

  // ------------------------------------------------------------------ theme actions
  const applyPresetVars = useCallback((presetVars) => {
    setVars({ ...presetVars });
    forgetMeasures();
  }, [forgetMeasures]);
  const applyThemePreset = useCallback((preset) => {
    applyPresetVars(preset.vars);
    notify(`Applied ${preset.label}`);
    setStatus(`Theme · ${preset.label}`);
  }, [applyPresetVars, notify]);
  const toggleTheme = () => {
    const next = siteTheme === 'light' ? 'dark' : 'light';
    setSiteTheme(next);
    const preset = THEME_PRESETS.find((p) => p.id === (next === 'dark' ? 'dark-ink' : 'paper'));
    applyPresetVars(preset ? preset.vars : (next === 'dark' ? DARK : FACTORY));
    notify(next === 'dark' ? 'Dark ink theme' : 'Light paper theme');
  };
  const resetFactory = () => {
    setOptVals(factoryOpts());
    applyPresetVars(FACTORY);
    notify('Factory theme & options restored');
  };
  const loadDarkSample = () => {
    applyPresetVars(DARK);
    notify('Dark ink sample applied');
  };

  // ------------------------------------------------------------------ toolbox actions
  const onVarChange = useCallback((name, value) => {
    if (REMEASURE_VARS.has(name)) forgetMeasures();
    setVars((v) => (v[name] === value ? v : { ...v, [name]: value }));
    setStatus(name);
  }, [forgetMeasures]);
  const onOptChange = useCallback((o, value) => {
    setOptVals((v) => ({ ...v, [o.id]: value }));
    setStatus(o.path ? o.path.join('.') : o.key);
  }, []);
  const onOptReset = useCallback((o) => {
    setOptVals((v) => {
      const next = { ...v };
      if (o.factory !== undefined) next[o.id] = o.factory; else delete next[o.id];
      return next;
    });
    setStatus(`${o.key} → default`);
  }, []);

  // ------------------------------------------------------------------ copy actions
  const doCopy = async (text, label) => {
    const ok = await copyText(text);
    notify(ok ? `Copied ${label}` : 'Copy failed — select manually');
    setStatus(ok ? `Copied ${label}` : 'Copy failed');
  };

  // ------------------------------------------------------------------ library actions
  // stable identities where possible: they are passed to memoized Cards/Frames/PeleHosts
  const findDiagram = useCallback((id) => diagrams.find((d) => d.id === id), [diagrams]);

  const focusDiagram = useCallback((id) => setFocusedId(id), []);
  const clearFocus = useCallback(() => setFocusedId(null), []);
  const focusStep = useCallback((dir) => {
    if (!diagrams.length) return;
    const i = diagrams.findIndex((d) => d.id === focusedId);
    let next;
    if (i < 0) next = dir > 0 ? 0 : diagrams.length - 1;
    else next = (i + dir + diagrams.length) % diagrams.length;
    setFocusedId(diagrams[next].id);
  }, [diagrams, focusedId]);
  const focusPrev = useCallback(() => focusStep(-1), [focusStep]);
  const focusNext = useCallback(() => focusStep(1), [focusStep]);

  // Global shortcuts: T toggles the toolbox; Esc/F exit focus; arrows step diagrams.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.closest && t.closest('input, textarea, select, [contenteditable]'))) return;
      if (e.key === 't' || e.key === 'T') setToolboxCollapsed((c) => !c);
      else if (e.key === 'Escape' && route.view === 'edit') navigate({ view: 'gallery' });
      else if (route.view !== 'edit') {
        if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') clearFocus();
        else if (e.key === 'ArrowLeft') { e.preventDefault(); focusPrev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); focusNext(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route.view, diagrams, focusedId, clearFocus, focusPrev, focusNext]);

  const insertCopyAfter = useCallback((id, d) => {
    setDiagrams((list) => {
      const i = list.findIndex((x) => x.id === id);
      const out = [...list];
      out.splice(i + 1, 0, d);
      return out;
    });
  }, []);

  const saveAsDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return;
    const d = { ...src, id: newId(), title: `${src.title} (copy)`, original: src.source, builtin: false };
    insertCopyAfter(id, d);
    setFocusedId(d.id);
    notify(`Saved as “${d.title}”`);
  }, [findDiagram, insertCopyAfter, notify]);

  const openEditor = useCallback((id) => navigate({ view: 'edit', id }), []);
  const backToGallery = useCallback(() => navigate({ view: 'gallery' }), []);

  const addDiagram = (starter) => {
    const d = {
      id: newId(), title: starter.title, keyword: starter.keyword,
      source: starter.source, original: starter.source, builtin: false,
    };
    setDiagrams((list) => [...list, d]);
    setNewOpen(false);
    openEditor(d.id);
    notify(`Created “${d.title}”`);
  };
  const duplicateDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return;
    insertCopyAfter(id, { ...src, id: newId(), title: `${src.title} (copy)`, builtin: false });
    notify(`Duplicated “${src.title}”`);
  }, [findDiagram, insertCopyAfter, notify]);
  const deleteDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return;
    setDiagrams((list) => list.filter((x) => x.id !== id));
    if (focusedId === id) setFocusedId(null);
    if (route.view === 'edit' && route.id === id) backToGallery();
    notify(`Deleted “${src.title}”`);
  }, [findDiagram, focusedId, route.view, route.id, backToGallery, notify]);
  const changeSource = useCallback((id, source) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, source } : d))), []);
  const changeTitle = useCallback((id, title) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, title } : d))), []);
  const resetSource = useCallback((id) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, source: d.original } : d))), []);
  const restoreSamples = () => {
    setDiagrams((list) => [...seedLibrary(), ...list.filter((d) => !d.builtin)]);
    notify('Built-in samples restored');
  };

  // ------------------------------------------------------------------ context menus
  const boardMenu = useCallback((e) => {
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'New diagram…', Icon: FilePlus2, onClick: () => setNewOpen(true) },
      ],
    });
  }, []);
  const cardMenu = useCallback((e, d) => {
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Focus', Icon: Focus, onClick: () => focusDiagram(d.id) },
        { label: `Edit “${d.title}”`, Icon: Pencil, onClick: () => openEditor(d.id) },
        { label: 'Duplicate', Icon: Copy, onClick: () => duplicateDiagram(d.id) },
        { label: 'Save as…', Icon: Save, onClick: () => saveAsDiagram(d.id) },
        { label: 'Delete', Icon: Trash2, danger: true, onClick: () => deleteDiagram(d.id) },
      ],
    });
  }, [focusDiagram, openEditor, duplicateDiagram, saveAsDiagram, deleteDiagram]);

  // console handle
  useEffect(() => {
    window.tweakpele = {
      diagrams: () => diagrams, vars: () => vars, optVals: () => optVals,
      setVar: (n, v) => onVarChange(n, v),
      setOpt: (groupTitle, key, v) => {
        const o = ALL_OPTS.find((x) => x.group === groupTitle && x.key === key);
        if (o) onOptChange(o, v);
      },
      mountOptions: () => mountOptions, STARTERS, OPT_GROUPS,
    };
  }, [diagrams, vars, optVals, mountOptions, onVarChange, onOptChange]);

  const current = route.view === 'edit' ? findDiagram(route.id) : null;
  const focusedIdx = focusedId ? diagrams.findIndex((d) => d.id === focusedId) : -1;
  const focusedDiagram = focusedIdx >= 0 ? diagrams[focusedIdx] : null;
  const peleMissing = typeof pele === 'undefined' || typeof pele.mount !== 'function';

  return (
    <div className={'app' + (toolboxCollapsed ? ' toolbox-off' : '')}>
      <header className="topbar">
        <IconButton
          Icon={toolboxCollapsed ? PanelLeftOpen : PanelLeftClose}
          label={toolboxCollapsed ? 'Show toolbox (T)' : 'Hide toolbox (T)'}
          onClick={() => setToolboxCollapsed((c) => !c)}
          aria-expanded={!toolboxCollapsed}
        />
        <h1>tweakpele <small>Pele theme &amp; render playground</small></h1>
        <span className="status" aria-live="polite">{status}</span>
        <span className="top-actions">
          <IconButton Icon={siteTheme === 'light' ? Moon : Sun}
            label={siteTheme === 'light' ? 'Switch to dark ink theme' : 'Switch to light paper theme'}
            onClick={toggleTheme} />
          {route.view !== 'edit' && (
            <IconButton
              Icon={viewMode === 'gallery' ? InfinityIcon : LayoutGrid}
              label={viewMode === 'gallery' ? 'Switch to infinite canvas' : 'Switch to gallery'}
              onClick={() => setViewMode((m) => (m === 'gallery' ? 'canvas' : 'gallery'))}
            />
          )}
          <IconButton Icon={FilePlus2} label="New diagram" onClick={() => setNewOpen(true)} />
          <IconButton Icon={ClipboardCopy} label="Copy .pele CSS" onClick={() => doCopy(cssBlock, '.pele CSS')} />
          <IconButton Icon={Braces} label="Copy render options JSON" onClick={() => doCopy(optionsJson, 'render options JSON')} />
          <IconButton Icon={RotateCcw} label="Reset factory theme & options" onClick={resetFactory} />
          <IconButton Icon={MoonStar} label="Apply dark ink sample" onClick={loadDarkSample} />
          <IconButton Icon={ArchiveRestore} label="Restore built-in samples" onClick={restoreSamples} />
        </span>
      </header>

      <main className="layout">
        <Toolbox
          vars={vars} onVarChange={onVarChange} onApplyPreset={applyThemePreset}
          optVals={optVals} onOptChange={onOptChange} onOptReset={onOptReset}
          cssBlock={cssBlock} optionsJson={optionsJson}
        />
        <div className="pele-scope" style={varsStyle}>
          {peleMissing && <div className="fatal">Pele failed to load (vendor/pele.global.js).</div>}
          {route.view === 'gallery' && (
            <div className="view-holder">
              {/* Keep overview geometry and state while focus occupies the same content slot. */}
              <div className="overview-view" aria-hidden={!!focusedDiagram} inert={focusedDiagram ? '' : undefined}>
                {viewMode === 'gallery' ? (
                  <Gallery
                    diagrams={diagrams} galleryOptions={galleryOptions}
                    onOpen={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                    onNew={() => setNewOpen(true)}
                    onFocus={focusDiagram} onFocusPrev={focusPrev} onFocusNext={focusNext}
                    onCardMenu={cardMenu} onBoardMenu={boardMenu}
                  />
                ) : (
                  <Canvas
                    diagrams={diagrams} canvasOptions={canvasOptions}
                    onOpen={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                    onFocus={focusDiagram} onFocusPrev={focusPrev} onFocusNext={focusNext}
                    onFrameMenu={cardMenu} onBoardMenu={boardMenu}
                  />
                )}
              </div>
              {focusedDiagram && (
                <FocusedView
                  key={focusedDiagram.id}
                  diagram={focusedDiagram}
                  options={viewMode === 'gallery' ? galleryOptions : canvasOptions}
                  index={focusedIdx} total={diagrams.length}
                  onClose={clearFocus} onPrev={focusPrev} onNext={focusNext}
                  onEdit={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                  onMenu={cardMenu}
                />
              )}
            </div>
          )}
          {route.view === 'edit' && (current
            ? <EditorView
                key={current.id}
                diagram={current} mountOptions={mountOptions}
                split={split} onSplitChange={setSplit}
                onBack={backToGallery} onChangeTitle={changeTitle}
                onChangeSource={changeSource} onResetSource={resetSource}
                onCopySource={(d) => doCopy(d.source, `${d.title} source`)}
                notify={notify}
              />
            : <div className="empty editor-missing"><p>This diagram no longer exists.</p>
               <p><button type="button" className="btn" onClick={backToGallery}>Back to gallery</button></p></div>)}
        </div>
      </main>

      <button
        type="button" className="edge-toggle" title={toolboxCollapsed ? 'Show toolbox (T)' : 'Hide toolbox (T)'}
        aria-label={toolboxCollapsed ? 'Show toolbox' : 'Hide toolbox'}
        onClick={() => setToolboxCollapsed((c) => !c)}
      >{toolboxCollapsed ? '›' : '‹'}</button>

      <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />
      {newOpen && (
        <Dialog title="New diagram" onClose={() => setNewOpen(false)}>
          <p className="muted">Pick a starter — titles, source and theme stay fully editable.</p>
          <div className="starter-grid">
            {STARTERS.map((s) => (
              <button key={s.title} type="button" className="starter" onClick={() => addDiagram(s)}>
                <b>{s.title}</b>
                <code>{s.keyword}</code>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      <Toast toast={toastMsg} />
    </div>
  );
}
