import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuSun as Sun, LuMoon as Moon, LuPanelLeftClose as PanelLeftClose, LuPanelLeftOpen as PanelLeftOpen,
  LuFilePlus2 as FilePlus2, LuPlus as Plus, LuClipboardCopy as ClipboardCopy, LuBraces as Braces,
  LuRotateCcw as RotateCcw, LuMoonStar as MoonStar, LuArchiveRestore as ArchiveRestore,
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuLayoutGrid as LayoutGrid, LuInfinity as InfinityIcon,
  LuFocus as Focus, LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
  LuSave as Save,
} from 'react-icons/lu';
import Toolbox from './components/Toolbox.jsx';
import Gallery from './components/Gallery.jsx';
import Canvas from './components/Canvas.jsx';
import EditorView from './components/EditorView.jsx';
import { ContextMenu, Dialog, IconButton, Toast } from './components/ui.jsx';
import {
  VAR_META, FACTORY, DARK, REMEASURE_VARS, ALL_OPTS, OPT_GROUPS, STARTERS,
  factoryOpts, buildMountOptions, exportOptions, peleCssBlock,
} from './constants.js';
import { loadJSON, saveJSON, copyText, useHashRoute, navigate, useDebounced, newId } from './lib.js';

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
  const [siteTheme, setSiteTheme] = useState(() => (loadJSON(THEME_KEY, 'light') === 'dark' ? 'dark' : 'light'));
  const [vars, setVars] = useState(() => ({ ...FACTORY, ...loadJSON(VARS_KEY, {}) }));
  const [optVals, setOptVals] = useState(() => ({ ...factoryOpts(), ...loadJSON(OPTS_KEY, {}) }));
  const [diagrams, setDiagrams] = useState(() => {
    const stored = loadJSON(LIB_KEY, null);
    if (stored && Array.isArray(stored.diagrams)
      && stored.diagrams.every((d) => typeof d.id === 'string' && typeof d.source === 'string')) {
      return stored.diagrams;
    }
    return seedLibrary();
  });
  const [toolboxCollapsed, setToolboxCollapsed] = useState(() => loadJSON(TOOLBOX_KEY, false) === true);
  const [viewMode, setViewMode] = useState(() => (loadJSON(VIEW_KEY, 'gallery') === 'canvas' ? 'canvas' : 'gallery'));
  const [focusedId, setFocusedId] = useState(null);
  const [split, setSplit] = useState(() => {
    const v = loadJSON(SPLIT_KEY, 42);
    return Number.isFinite(v) ? Math.max(16, Math.min(84, v)) : 42;
  });
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
  const debouncedMountOptions = useDebounced(mountOptions, 160);
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
  useEffect(() => { saveJSON(THEME_KEY, siteTheme); }, [siteTheme]);
  useEffect(() => { saveJSON(VARS_KEY, vars); }, [vars]);
  useEffect(() => { saveJSON(OPTS_KEY, optVals); }, [optVals]);
  useEffect(() => { saveJSON(LIB_KEY, { formatVersion: 1, diagrams }); }, [diagrams]);
  useEffect(() => { saveJSON(TOOLBOX_KEY, toolboxCollapsed); }, [toolboxCollapsed]);
  useEffect(() => { saveJSON(VIEW_KEY, viewMode); }, [viewMode]);
  useEffect(() => { saveJSON(SPLIT_KEY, split); }, [split]);

  useEffect(() => {
    setStatus(`${diagrams.length} diagrams · ${VAR_META.length} variables · ${ALL_OPTS.length} render options`);
  }, [diagrams.length]);

  // global shortcuts: T = toolbox, Esc = back to gallery
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
  }, [route.view, diagrams, focusedId]);

  const forgetMeasures = () => {
    try { pele.forgetTextWidths(); } catch (_) { /* pele not loaded */ }
    setRemeasureTick((t) => t + 1);
  };

  // ------------------------------------------------------------------ theme actions
  const applyPreset = (preset) => { setVars({ ...preset }); forgetMeasures(); };
  const toggleTheme = () => {
    const next = siteTheme === 'light' ? 'dark' : 'light';
    setSiteTheme(next);
    applyPreset(next === 'dark' ? DARK : FACTORY);
    notify(next === 'dark' ? 'Dark ink theme' : 'Light paper theme');
  };
  const resetFactory = () => { setOptVals(factoryOpts()); applyPreset(FACTORY); notify('Factory theme & options restored'); };
  const loadDarkSample = () => { applyPreset(DARK); notify('Dark ink sample applied'); };

  // ------------------------------------------------------------------ toolbox actions
  const onVarChange = (name, value) => {
    if (REMEASURE_VARS.has(name)) forgetMeasures();
    setVars((v) => (v[name] === value ? v : { ...v, [name]: value }));
    setStatus(name);
  };
  const onOptChange = (o, value) => {
    setOptVals((v) => ({ ...v, [o.id]: value }));
    setStatus(o.path ? o.path.join('.') : o.key);
  };
  const onOptReset = (o) => {
    setOptVals((v) => {
      const next = { ...v };
      if (o.factory !== undefined) next[o.id] = o.factory; else delete next[o.id];
      return next;
    });
    setStatus(`${o.key} → default`);
  };

  // ------------------------------------------------------------------ copy actions
  const doCopy = async (text, label) => {
    const ok = await copyText(text);
    notify(ok ? `Copied ${label}` : 'Copy failed — select manually');
    setStatus(ok ? `Copied ${label}` : 'Copy failed');
  };

  // ------------------------------------------------------------------ library actions
  const findDiagram = (id) => diagrams.find((d) => d.id === id);

  const focusDiagram = (id) => setFocusedId(id);
  const clearFocus = () => setFocusedId(null);
  const focusStep = (dir) => {
    if (!diagrams.length) return;
    const i = diagrams.findIndex((d) => d.id === focusedId);
    let next;
    if (i < 0) next = dir > 0 ? 0 : diagrams.length - 1;
    else next = (i + dir + diagrams.length) % diagrams.length;
    setFocusedId(diagrams[next].id);
  };
  const focusPrev = () => focusStep(-1);
  const focusNext = () => focusStep(1);
  const saveAsDiagram = (id) => {
    const src = findDiagram(id);
    if (!src) return;
    const d = {
      ...src, id: newId(), title: `${src.title} (copy)`,
      original: src.source, builtin: false,
    };
    setDiagrams((list) => {
      const i = list.findIndex((x) => x.id === id);
      const out = [...list];
      out.splice(i + 1, 0, d);
      return out;
    });
    setFocusedId(d.id);
    notify(`Saved as “${d.title}”`);
  };

  const openEditor = (id) => navigate({ view: 'edit', id });
  const backToGallery = () => navigate({ view: 'gallery' });

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
  const duplicateDiagram = (id) => {
    const src = findDiagram(id);
    if (!src) return;
    const d = { ...src, id: newId(), title: `${src.title} (copy)`, builtin: false };
    setDiagrams((list) => {
      const i = list.findIndex((x) => x.id === id);
      const out = [...list];
      out.splice(i + 1, 0, d);
      return out;
    });
    notify(`Duplicated “${src.title}”`);
  };
  const deleteDiagram = (id) => {
    const src = findDiagram(id);
    if (!src) return;
    setDiagrams((list) => list.filter((x) => x.id !== id));
    if (focusedId === id) setFocusedId(null);
    if (route.view === 'edit' && route.id === id) backToGallery();
    notify(`Deleted “${src.title}”`);
  };
  const changeSource = (id, source) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, source } : d)));
  const changeTitle = (id, title) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, title } : d)));
  const resetSource = (id) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, source: d.original } : d)));
  const restoreSamples = () => {
    setDiagrams((list) => [...seedLibrary(), ...list.filter((d) => !d.builtin)]);
    notify('Built-in samples restored');
  };

  // ------------------------------------------------------------------ context menus
  const boardMenu = (e) => {
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'New diagram…', Icon: FilePlus2, onClick: () => setNewOpen(true) },
      ],
    });
  };
  const cardMenu = (e, d) => {
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
  };

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
  });

  const current = route.view === 'edit' ? findDiagram(route.id) : null;
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
          vars={vars} onVarChange={onVarChange}
          optVals={optVals} onOptChange={onOptChange} onOptReset={onOptReset}
          cssBlock={cssBlock} optionsJson={optionsJson}
        />
        <div className="pele-scope" style={varsStyle}>
          {peleMissing && <div className="fatal">Pele failed to load (vendor/pele.global.js).</div>}
          <div className="view-holder" style={{ display: route.view === 'gallery' ? '' : 'none' }}>
            {viewMode === 'gallery' ? (
              <Gallery
                diagrams={diagrams} galleryOptions={galleryOptions} focusedId={focusedId}
                onOpen={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                onNew={() => setNewOpen(true)}
                onFocus={focusDiagram} onClearFocus={clearFocus}
                onFocusPrev={focusPrev} onFocusNext={focusNext}
                onCardMenu={cardMenu} onBoardMenu={boardMenu}
              />
            ) : (
              <Canvas
                diagrams={diagrams} canvasOptions={canvasOptions} focusedId={focusedId}
                onOpen={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                onFocus={focusDiagram} onClearFocus={clearFocus}
                onFocusPrev={focusPrev} onFocusNext={focusNext}
                onFrameMenu={cardMenu} onBoardMenu={boardMenu}
              />
            )}
          </div>
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
