import { useCallback, useEffect, useMemo, useState } from 'react';
import { VAR_META, ALL_OPTS, REMEASURE_VARS } from '../constants.js';
import { loadJSON, saveJSON, useDebounced, usePersistedState, newId } from '../lib.js';
import { buildDiagramMountOptions, mergeDiagramVars, varsStyleFrom } from '../diagramOverrides.js';

const LIB_KEY = 'tweakpele.library.v1';
const OVERRIDES_KEY = 'tweakpele.diagramOverrides.v1';

function seedLibrary() {
  return (window.TWEAKPELE_DIAGRAMS || []).map((m) => ({
    id: m.id, title: m.title, keyword: m.keyword,
    source: m.source, original: m.source, builtin: true,
  }));
}

/** Diagram library + per-diagram style/render overrides: CRUD, override editing,
 *  and the per-view mount options each diagram actually renders with.
 *  While `sessionActive` (shared canvas session), overrides live in memory only. */
export function useDiagrams({ theme, notify, setStatus, sessionActive = false }) {
  // library persists a versioned wrapper, so it keeps its explicit load/save pair
  const [diagrams, setDiagrams] = useState(() => {
    const stored = loadJSON(LIB_KEY, null);
    if (stored && Array.isArray(stored.diagrams)
      && stored.diagrams.every((d) => typeof d.id === 'string' && typeof d.source === 'string')) {
      return stored.diagrams;
    }
    return seedLibrary();
  });
  // Per-diagram style/render overrides: { [diagramId]: { opts: { [optId]: value }, vars: { [cssVar]: value } } }
  const [storedOverrides, setStoredOverrides] = usePersistedState(OVERRIDES_KEY, (v) => (
    v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  ));
  const [sessionOverrides, setSessionOverrides] = useState({});
  const diagramOverrides = sessionActive ? sessionOverrides : storedOverrides;
  const setDiagramOverrides = sessionActive ? setSessionOverrides : setStoredOverrides;

  const {
    vars, optVals, remeasureTick, forgetMeasures,
    mountOptions, debouncedOptVals, debouncedVars,
  } = theme;

  useEffect(() => { saveJSON(LIB_KEY, { formatVersion: 1, diagrams }); }, [diagrams]);

  useEffect(() => {
    setStatus(`${diagrams.length} diagrams · ${VAR_META.length} variables · ${ALL_OPTS.length} render options`);
  }, [diagrams.length]);

  // ------------------------------------------------------------------ shared view bases
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
  }, [setDiagramOverrides]);

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
  }, [setDiagramOverrides]);

  const styleApi = useMemo(() => ({
    overrides: diagramOverrides,
    globalVars: vars,
    globalOptVals: optVals,
    setOpt: onDiagramOptChange,
    setVar: onDiagramVarChange,
    resetAll: onDiagramOverrideReset,
    varsStyleFor,
  }), [diagramOverrides, vars, optVals, onDiagramOptChange, onDiagramVarChange, onDiagramOverrideReset, varsStyleFor]);

  // ------------------------------------------------------------------ library actions
  // stable identities where possible: they are passed to memoized Cards/Frames/PeleHosts
  const findDiagram = useCallback((id) => diagrams.find((d) => d.id === id), [diagrams]);

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
  }, [setDiagramOverrides]);

  const createDiagram = (starter) => {
    const d = {
      id: newId(), title: starter.title, keyword: starter.keyword,
      source: starter.source, original: starter.source, builtin: false,
    };
    setDiagrams((list) => [...list, d]);
    return d;
  };
  const duplicateDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return;
    const newDiagramId = newId();
    insertCopyAfter(id, { ...src, id: newDiagramId, title: `${src.title} (copy)`, builtin: false });
    copyDiagramOverride(id, newDiagramId);
    notify(`Duplicated “${src.title}”`);
  }, [findDiagram, insertCopyAfter, notify, copyDiagramOverride]);
  const saveAsCopy = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return null;
    const d = { ...src, id: newId(), title: `${src.title} (copy)`, original: src.source, builtin: false };
    insertCopyAfter(id, d);
    copyDiagramOverride(id, d.id);
    return d;
  }, [findDiagram, insertCopyAfter, copyDiagramOverride]);
  const removeDiagram = useCallback((id) => {
    const src = findDiagram(id);
    if (!src) return null;
    setDiagrams((list) => list.filter((x) => x.id !== id));
    setDiagramOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return src;
  }, [findDiagram]);
  const changeSource = useCallback((id, source) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, source } : d))), []);
  const changeTitle = useCallback((id, title) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, title } : d))), []);
  const resetSource = useCallback((id) => setDiagrams((list) => list.map((d) => (d.id === id ? { ...d, source: d.original } : d))), []);
  const restoreSamples = () => {
    setDiagrams((list) => [...seedLibrary(), ...list.filter((d) => !d.builtin)]);
    notify('Built-in samples restored');
  };

  return {
    diagrams, setDiagrams,
    diagramOverrides, setDiagramOverrides,
    findDiagram, styleApi,
    galleryOptions,
    optionsForDiagram, galleryOptionsFor, canvasOptionsFor,
    onDiagramOptChange, onDiagramVarChange, onDiagramOverrideReset,
    createDiagram, duplicateDiagram, saveAsCopy, removeDiagram,
    changeSource, changeTitle, resetSource, restoreSamples,
  };
}
