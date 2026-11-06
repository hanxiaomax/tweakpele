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
import { loadJSON, saveJSON, copyText, clamp, useHashRoute, navigate, useDebounced, usePersistedState, newId, sortDiagramsSpatially } from './lib.js';
import { useTweakpeleBridge } from './bridge.js';
import {
  buildDiagramMountOptions, mergeDiagramVars, varsStyleFrom,
} from './diagramOverrides.js';

const LIB_KEY = 'tweakpele.library.v1';
const VARS_KEY = 'tweakpele.vars.v1';
const OPTS_KEY = 'tweakpele.opts.v1';
const THEME_KEY = 'tweakpele.siteTheme';
const SPLIT_KEY = 'tweakpele.split.v1';
const TOOLBOX_KEY = 'tweakpele.toolbox.collapsed';
const VIEW_KEY = 'tweakpele.viewMode';
const POS_KEY = 'tweakpele.canvasPos.v1';
const OVERRIDES_KEY = 'tweakpele.diagramOverrides.v1';

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
  const [toolboxCollapsed, setToolboxCollapsed] = usePersistedState(TOOLBOX_KEY, (v) => (v === false ? false : true));
  const [viewMode, setViewMode] = usePersistedState(VIEW_KEY, (v) => (v === 'canvas' ? 'canvas' : 'gallery'));
  const [canvasPositions, setCanvasPositions] = usePersistedState(POS_KEY, (v) => (
    v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  ));
  // Per-diagram style/render overrides: { [diagramId]: { opts: { [optId]: value }, vars: { [cssVar]: value } } }
  const [diagramOverrides, setDiagramOverrides] = usePersistedState(OVERRIDES_KEY, (v) => (
    v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  ));
  const [focusedId, setFocusedId] = useState(null);
  const [split, setSplit] = usePersistedState(SPLIT_KEY, (v) => (Number.isFinite(v) ? clamp(v, 16, 84) : 42));
  const [remeasureTick, setRemeasureTick] = useState(0);
  const route = useHashRoute();
  const LAST_EDIT_KEY = 'tweakpele.lastEditId';

  // Default mode = editor: first open with no hash lands in the split editor.
  useEffect(() => {
    if (location.hash) return;
    if (!diagrams.length) return;
    const last = loadJSON(LAST_EDIT_KEY, null);
    const id = (last && diagrams.some((d) => d.id === last) ? last : null) || diagrams[0].id;
    navigate({ view: 'edit', id });
  }, [diagrams]);

  useEffect(() => {
    if (route.view === 'edit' && route.id) saveJSON(LAST_EDIT_KEY, route.id);
  }, [route.view, route.id]);

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
  // Focus: Pele native zoom/pan. Host CSS fills the body so SVG is not mid-box clipped;
  // keep FocusedView chrome (card) as-is — do not reintroduce scrim/overview dimming.
  const focusedOptions = useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1600;
    return {
      ...debouncedMountOptions,
      zoom: debouncedMountOptions.zoom === false ? true : (debouncedMountOptions.zoom ?? true),
      maxWidth: Math.max(Number(debouncedMountOptions.maxWidth) || 0, 1600, Math.floor(vw * 1.25)),
      responsive: false,
    };
  }, [debouncedMountOptions]);
  const varsStyle = useMemo(() => {
    const o = {};
    for (const { name } of VAR_META) o[name] = vars[name];
    return o;
  }, [vars]);

  // Debounced raw inputs so per-diagram option rebuilds stay as calm as the shared bases.
  const debouncedOptVals = useDebounced(optVals, 280);
  const debouncedVars = useDebounced(vars, 280);

  // Per-diagram mount options: diagrams with overrides get global + override merged
  // (then the same view patch as the shared base); others reuse the shared object.
  const optionsForDiagram = useCallback((id, view) => {
    const base = view === 'gallery' ? galleryOptions
      : view === 'canvas' ? canvasOptions
        : view === 'focused' ? focusedOptions
          : mountOptions;
    const ov = diagramOverrides[id];
    if (!ov || (!Object.keys(ov.opts || {}).length && !Object.keys(ov.vars || {}).length)) return base;
    const built = buildDiagramMountOptions(debouncedOptVals, debouncedVars, ov);
    if (view === 'gallery') return { ...built, zoom: false };
    if (view === 'canvas') return {
      ...built, zoom: false,
      maxWidth: Math.max(Number(built.maxWidth) || 0, 1600),
      responsive: false,
    };
    if (view === 'focused') {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1600;
      return {
        ...built,
        zoom: built.zoom === false ? true : (built.zoom ?? true),
        maxWidth: Math.max(Number(built.maxWidth) || 0, 1600, Math.floor(vw * 1.25)),
        responsive: false,
      };
    }
    return built;
    // remeasureTick mirrors the shared mountOptions dependency (font/radius re-measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramOverrides, debouncedOptVals, debouncedVars, galleryOptions, canvasOptions, focusedOptions, mountOptions, remeasureTick]);

  // Scoped CSS custom properties for a diagram with var overrides (undefined = inherit global scope).
  const varsStyleFor = useCallback((id) => {
    const ov = diagramOverrides[id];
    if (!ov || !Object.keys(ov.vars || {}).length) return undefined;
    return varsStyleFrom(mergeDiagramVars(vars, ov.vars));
  }, [vars, diagramOverrides]);

  const galleryOptionsFor = useCallback((id) => optionsForDiagram(id, 'gallery'), [optionsForDiagram]);
  const canvasOptionsFor = useCallback((id) => optionsForDiagram(id, 'canvas'), [optionsForDiagram]);

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
    // bridge may not exist yet on first render of this callback identity; push in effect below via ref
    try { window.__tweakpelePushTheme?.(preset.id); } catch (_) { /* ignore */ }
  }, [applyPresetVars, notify]);

  const skipBridgePush = useRef(false);
  const bridge = useTweakpeleBridge({
    onRemoteState: (snap) => {
      skipBridgePush.current = true;
      if (Array.isArray(snap.diagrams) && snap.diagrams.length) {
        setDiagrams(snap.diagrams.map((d) => ({
          id: d.id,
          title: d.title,
          keyword: d.keyword || 'flowchart',
          source: d.source,
          original: d.original ?? d.source,
          builtin: Boolean(d.builtin),
        })));
      }
      if (snap.themePresetId) {
        const preset = THEME_PRESETS.find((p) => p.id === snap.themePresetId);
        if (preset) {
          applyPresetVars(preset.vars);
          setStatus(`Theme · ${preset.label} (bridge)`);
        }
      }
      if (snap.diagramOverrides && typeof snap.diagramOverrides === 'object' && !Array.isArray(snap.diagramOverrides)) {
        setDiagramOverrides(snap.diagramOverrides);
      }
      if (snap.mode === 'edit' && snap.activeId) navigate({ view: 'edit', id: snap.activeId });
      else if (snap.mode === 'gallery') navigate({ view: 'gallery' });
    },
  });

  useEffect(() => {
    if (!bridge.enabled) return;
    if (skipBridgePush.current) { skipBridgePush.current = false; return; }
    if (bridge.isApplying()) return;
    bridge.pushLocal({
      diagrams,
      diagramOverrides,
      activeId: route.view === 'edit' ? route.id : undefined,
      mode: route.view === 'edit' ? 'edit' : 'gallery',
    });
  }, [diagrams, diagramOverrides, route.view, route.id, bridge.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.__tweakpelePushTheme = (presetId) => {
      if (!bridge.enabled || bridge.isApplying()) return;
      bridge.pushLocal({ themePresetId: presetId });
    };
    return () => { delete window.__tweakpelePushTheme; };
  }, [bridge.enabled, bridge.pushLocal]);

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

  // ------------------------------------------------------------------ per-diagram override actions
  const setDiagramOverride = useCallback((id, mutate) => {
    setDiagramOverrides((prev) => {
      const cur = prev[id] || {};
      const draft = { opts: { ...cur.opts }, vars: { ...cur.vars } };
      mutate(draft);
      const opts = {};
      const v = {};
      for (const [k, val] of Object.entries(draft.opts)) if (val !== undefined && val !== null && val !== '') opts[k] = val;
      for (const [k, val] of Object.entries(draft.vars)) if (val !== undefined && val !== null && val !== '') v[k] = val;
      if (!Object.keys(opts).length && !Object.keys(v).length) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { opts, vars: v } };
    });
  }, []);

  const onDiagramOptChange = useCallback((id, optId, value) => {
    setDiagramOverride(id, (d) => {
      if (value === undefined) delete d.opts[optId];
      else d.opts[optId] = value;
    });
  }, [setDiagramOverride]);
  const onDiagramVarChange = useCallback((id, name, value) => {
    if (value !== undefined && REMEASURE_VARS.has(name)) forgetMeasures();
    setDiagramOverride(id, (d) => {
      if (value === undefined) delete d.vars[name];
      else d.vars[name] = value;
    });
  }, [forgetMeasures, setDiagramOverride]);
  const onDiagramOverrideReset = useCallback((id) => {
    setDiagramOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setStatus('Diagram style → global');
  }, []);

  const styleApi = useMemo(() => ({
    overrides: diagramOverrides,
    globalVars: vars,
    globalOptVals: optVals,
    setOpt: onDiagramOptChange,
    setVar: onDiagramVarChange,
    resetAll: onDiagramOverrideReset,
    varsStyleFor,
  }), [diagramOverrides, vars, optVals, onDiagramOptChange, onDiagramVarChange, onDiagramOverrideReset, varsStyleFor]);

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
  // Canvas focus carousel: top→bottom, left→right by saved positions. Gallery keeps library order.
  const focusOrder = useMemo(() => {
    if (viewMode === 'canvas') return sortDiagramsSpatially(diagrams, canvasPositions);
    return diagrams;
  }, [viewMode, diagrams, canvasPositions]);
  const focusStep = useCallback((dir) => {
    if (!focusOrder.length) return;
    const i = focusOrder.findIndex((d) => d.id === focusedId);
    let next;
    if (i < 0) next = dir > 0 ? 0 : focusOrder.length - 1;
    else next = (i + dir + focusOrder.length) % focusOrder.length;
    setFocusedId(focusOrder[next].id);
  }, [focusOrder, focusedId]);
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

  // Duplicate / save-as carries the per-diagram style overrides to the new id.
  const copyDiagramOverride = useCallback((fromId, toId) => {
    setDiagramOverrides((prev) => {
      const src = prev[fromId];
      if (!src || !src.opts || !src.vars) return prev;
      if (!Object.keys(src.opts).length && !Object.keys(src.vars).length) return prev;
      return { ...prev, [toId]: { opts: { ...src.opts }, vars: { ...src.vars } } };
    });
  }, []);

  const saveAsDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return;
    const d = { ...src, id: newId(), title: `${src.title} (copy)`, original: src.source, builtin: false };
    insertCopyAfter(id, d);
    copyDiagramOverride(id, d.id);
    setFocusedId(d.id);
    notify(`Saved as “${d.title}”`);
  }, [findDiagram, insertCopyAfter, notify, copyDiagramOverride]);

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
    const newDiagramId = newId();
    insertCopyAfter(id, { ...src, id: newDiagramId, title: `${src.title} (copy)`, builtin: false });
    copyDiagramOverride(id, newDiagramId);
    notify(`Duplicated “${src.title}”`);
  }, [findDiagram, insertCopyAfter, notify, copyDiagramOverride]);
  const deleteDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return;
    setDiagrams((list) => list.filter((x) => x.id !== id));
    setCanvasPositions((pos) => {
      if (!pos || !(id in pos)) return pos;
      const next = { ...pos };
      delete next[id];
      return next;
    });
    setDiagramOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
      diagramOverrides: () => diagramOverrides,
      setVar: (n, v) => onVarChange(n, v),
      setOpt: (groupTitle, key, v) => {
        const o = ALL_OPTS.find((x) => x.group === groupTitle && x.key === key);
        if (o) onOptChange(o, v);
      },
      setDiagramVar: (id, n, v) => onDiagramVarChange(id, n, v),
      setDiagramOpt: (id, optId, v) => onDiagramOptChange(id, optId, v),
      resetDiagramOverrides: (id) => onDiagramOverrideReset(id),
      mountOptions: () => mountOptions, STARTERS, OPT_GROUPS,
    };
  }, [diagrams, vars, optVals, diagramOverrides, mountOptions, onVarChange, onOptChange, onDiagramVarChange, onDiagramOptChange, onDiagramOverrideReset]);

  const current = route.view === 'edit' ? findDiagram(route.id) : null;
  const focusedIdx = focusedId ? focusOrder.findIndex((d) => d.id === focusedId) : -1;
  const focusedDiagram = focusedIdx >= 0 ? focusOrder[focusedIdx] : (focusedId ? findDiagram(focusedId) : null);
  // Editor → open diagram; gallery → focused diagram. Drives toolbox type filter.
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
                    diagrams={diagrams} optionsFor={galleryOptionsFor}
                    styleApi={styleApi}
                    onOpen={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                    onNew={() => setNewOpen(true)}
                    onFocus={focusDiagram} onFocusPrev={focusPrev} onFocusNext={focusNext}
                    onCardMenu={cardMenu} onBoardMenu={boardMenu}
                  />
                ) : (
                  <Canvas
                    diagrams={diagrams} optionsFor={canvasOptionsFor}
                    styleApi={styleApi}
                    positions={canvasPositions} onPositionsChange={setCanvasPositions}
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
                  options={optionsForDiagram(focusedDiagram.id, 'focused')}
                  index={focusedIdx} total={focusOrder.length}
                  onClose={clearFocus} onPrev={focusPrev} onNext={focusNext}
                  onEdit={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                  onMenu={cardMenu}
                  onChangeSource={changeSource}
                  vars={vars}
                  styleApi={styleApi}
                />
              )}
            </div>
          )}
          {route.view === 'edit' && (current
            ? <EditorView
                key={current.id}
                diagram={current} mountOptions={optionsForDiagram(current.id, 'editor')}
                split={split} onSplitChange={setSplit}
                onBack={backToGallery} onChangeTitle={changeTitle}
                onChangeSource={changeSource} onResetSource={resetSource}
                onCopySource={(d) => doCopy(d.source, `${d.title} source`)}
                notify={notify}
                onRenderFeedback={(fb) => { bridge.pushFeedback?.(fb); }}
                vars={vars}
                styleApi={styleApi}
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
