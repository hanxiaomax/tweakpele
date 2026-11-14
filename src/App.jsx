import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LuSun as Sun, LuMoon as Moon, LuPanelLeftClose as PanelLeftClose, LuPanelLeftOpen as PanelLeftOpen,
  LuFilePlus2 as FilePlus2, LuClipboardCopy as ClipboardCopy, LuBraces as Braces,
  LuRotateCcw as RotateCcw, LuArchiveRestore as ArchiveRestore,
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuLayoutGrid as LayoutGrid, LuInfinity as InfinityIcon,
  LuFocus as Focus, LuSave as Save, LuDownload as Download, LuFolderOpen as FolderOpen,
  LuUpload as Upload, LuUndo2 as Undo2, LuRedo2 as Redo2,
  LuFileCode2 as FileCode2,
  LuFileText as FileText,
} from 'react-icons/lu';
import Toolbox from './components/Toolbox.jsx';
import Gallery from './components/Gallery.jsx';
import Canvas from './components/Canvas.jsx';
import FocusedView from './components/FocusedView.jsx';
import MarkdownView from './components/MarkdownView.jsx';
import { ContextMenu, Dialog, IconButton, Toast } from './components/ui.jsx';
import { ALL_OPTS, OPT_GROUPS, STARTERS, THEME_PRESETS, themeFileJson } from './constants.js';
import { copyText, navigate, newId, useHashRoute } from './lib.js';
import { download } from './export.js';
import { slugify } from './export.js';
import { mergeDiagramVars } from './diagramOverrides.js';
import { mermaidConfig, mermaidFrontmatter, withMermaidFrontmatter } from './mermaidConfig.js';
import {
  buildSnapshot, snapshotFileJson, parseSnapshot, parseThemeFile, snapshotTheme, diagramFromSnapshot,
  buildCanvasSnapshot, parseCanvasSnapshot, canvasSessionFromSnapshot,
  encodeSnapshotToken, decodeSnapshotToken, shareUrl, isShareUrlTooLong,
} from './snapshot.js';
import { useTweakpeleBridge } from './bridge.js';
import { useThemeState } from './state/useThemeState.js';
import { useDiagrams } from './state/useDiagrams.js';
import { useViewState } from './state/useViewState.js';
import { useHistory } from './state/useHistory.js';

const NO_DIAGRAMS = [];
const NO_POSITIONS = {};

export default function App() {
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

  const route = useHashRoute();
  const isSharedCanvas = route.view === 'sharedCanvas';
  const [sessionCanvas, setSessionCanvas] = useState(null);
  const [sessionSidebarOpen, setSessionSidebarOpen] = useState(false);
  const sessionNonceRef = useRef(0);

  const theme = useThemeState({ notify, setStatus });
  const {
    siteTheme, vars, optVals, cssBlock, optionsJson, mountOptions, varsStyle,
    setVars, setOptVals, forgetMeasures,
    applyPresetVars, applyThemePreset, applyTheme, toggleTheme, resetFactory,
    onVarChange, onOptChange, onOptReset,
    applySnapshotTheme, clearSnapshotTheme,
  } = theme;
  const diagramsApi = useDiagrams({ theme, notify, setStatus, sessionActive: isSharedCanvas });
  const {
    diagrams, setDiagrams, diagramOverrides, setDiagramOverrides, findDiagram,
    styleApi, galleryOptions, optionsForDiagram, galleryOptionsFor, canvasOptionsFor,
    onDiagramOptChange, onDiagramVarChange, onDiagramOverrideReset,
    createDiagram, duplicateDiagram, saveAsCopy, removeDiagram,
    changeSource, changeTitle, resetSource, restoreSamples,
  } = diagramsApi;
  const view = useViewState({
    diagrams: isSharedCanvas ? (sessionCanvas ? sessionCanvas.diagrams : NO_DIAGRAMS) : diagrams,
    positions: isSharedCanvas ? (sessionCanvas ? sessionCanvas.positions : NO_POSITIONS) : undefined,
    sessionActive: isSharedCanvas,
    route,
  });
  const {
    openEditor, backToGallery, viewMode, setViewMode,
    toolboxCollapsed, setToolboxCollapsed, split, setSplit,
    canvasPositions, setCanvasPositions,
    focusedId, setFocusedId, focusSlideDir, focusOrder, focusDiagram, clearFocus, focusPrev, focusNext,
    galleryCols, setGalleryCols, bumpGalleryCols, onDiagramDeleted,
  } = view;

  const applyDocState = useCallback((s) => {
    setVars(s.vars);
    setOptVals(s.optVals);
    setDiagramOverrides(s.overrides);
    setDiagrams(s.diagrams);
    forgetMeasures();
  }, [setVars, setOptVals, setDiagramOverrides, setDiagrams, forgetMeasures]);
  const history = useHistory({
    state: { vars, optVals, overrides: diagramOverrides, diagrams },
    apply: applyDocState,
    enabled: route.view !== 'snapshot' && route.view !== 'sharedCanvas',
    onAction: notify,
  });

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
    if (route.view === 'sharedCanvas') return;
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

  // ------------------------------------------------------------------ copy actions
  const doCopy = async (text, label) => {
    const ok = await copyText(text);
    notify(ok ? `Copied ${label}` : 'Copy failed — select manually');
    setStatus(ok ? `Copied ${label}` : 'Copy failed');
  };

  const downloadTheme = () => {
    const filename = 'pele-theme.json';
    download(new Blob([themeFileJson(vars, optVals)], { type: 'application/json;charset=utf-8' }), filename);
    notify(`Downloaded ${filename}`);
    setStatus(`Downloaded ${filename}`);
  };

  const downloadMermaidConfig = () => {
    const filename = 'mermaid.config.json';
    download(new Blob([JSON.stringify(mermaidConfig(vars), null, 2) + '\n'], { type: 'application/json;charset=utf-8' }), filename);
    notify(`Downloaded ${filename}`);
    setStatus(`Downloaded ${filename}`);
  };

  const mermaidMenu = (e) => {
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Copy Mermaid frontmatter', Icon: Copy, onClick: () => doCopy(mermaidFrontmatter(vars), 'Mermaid frontmatter') },
        { label: 'Download mermaid.config.json', Icon: Download, onClick: downloadMermaidConfig },
      ],
    });
  };

  const themeFileRef = useRef(null);

  const importThemeFile = async (file) => {
    try {
      const data = parseThemeFile(await file.text());
      if (!data) { notify('Not a valid theme file'); return; }
      applyTheme(snapshotTheme(data));
      notify(`Imported ${file.name}`);
      setStatus(`Imported ${file.name}`);
    } catch (_) {
      notify('Not a valid theme file');
    }
  };

  const onThemeFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) importThemeFile(file);
  };

  const snapshotFileRef = useRef(null);
  const [sessionDiagram, setSessionDiagram] = useState(null);

  const snapshotOf = (diagram) => {
    if (!diagram) return null;
    const ov = diagramOverrides[diagram.id];
    const shareVars = { ...vars, ...(ov?.vars || {}) };
    const shareOptVals = { ...optVals, ...(ov?.opts || {}) };
    return buildSnapshot(shareVars, shareOptVals, diagram);
  };

  const applySnapshot = (snap) => {
    const themeNext = snapshotTheme(snap);
    applySnapshotTheme(themeNext.vars, themeNext.optVals);
    setSessionDiagram(diagramFromSnapshot(snap));
  };

  const applyCanvasSnapshot = (snap) => {
    const { overrides, ...cs } = canvasSessionFromSnapshot(snap);
    const themeNext = snapshotTheme(snap);
    applySnapshotTheme(themeNext.vars, themeNext.optVals);
    setDiagramOverrides(overrides);
    setSessionCanvas({ ...cs, nonce: ++sessionNonceRef.current });
    setSessionSidebarOpen(false);
    setFocusedId(null);
  };

  // Opening #/s/<token> or #/c/<token> applies the snapshot for this session only — it must not write localStorage.
  useEffect(() => {
    if (route.view !== 'snapshot' && route.view !== 'sharedCanvas') {
      if (sessionDiagram || sessionCanvas) {
        setSessionDiagram(null);
        setSessionCanvas(null);
        setFocusedId(null);
        clearSnapshotTheme();
      }
      return;
    }
    if (route.view !== 'snapshot') return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await decodeSnapshotToken(route.token);
        if (cancelled) return;
        applySnapshot(snap);
      } catch (_) {
        if (cancelled) return;
        notify('Share link is invalid');
        navigate({ view: 'gallery' });
      }
    })();
    return () => { cancelled = true };
    // applySnapshot is recreated each render; token/view are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.view, route.token]);

  useEffect(() => {
    if (route.view !== 'sharedCanvas') return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await decodeSnapshotToken(route.token, parseCanvasSnapshot);
        if (!cancelled) applyCanvasSnapshot(snap);
      } catch (_) {
        if (cancelled) return;
        notify('Share link is invalid');
        navigate({ view: 'gallery' });
      }
    })();
    return () => { cancelled = true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.view, route.token]);

  const copyShareLink = async (diagram) => {
    const snap = snapshotOf(diagram);
    if (!snap) { notify('Nothing to share'); return; }
    try {
      const token = await encodeSnapshotToken(snap);
      const url = shareUrl(token);
      if (isShareUrlTooLong(url)) {
        const filename = `${slugify(diagram.title)}.tweakpele.json`;
        download(new Blob([JSON.stringify(snap, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }), filename);
        notify('Link too long — downloaded snapshot file instead');
        return;
      }
      const ok = await copyText(url);
      notify(ok ? 'Copied share link' : 'Copy failed — download the snapshot file instead');
    } catch (_) {
      notify('Could not build share link');
    }
  };

  const downloadSnapshot = (diagram) => {
    if (!diagram) { notify('Nothing to share'); return; }
    const ov = diagramOverrides[diagram.id];
    const shareVars = { ...vars, ...(ov?.vars || {}) };
    const shareOptVals = { ...optVals, ...(ov?.opts || {}) };
    const filename = `${slugify(diagram.title)}.tweakpele.json`;
    download(new Blob([snapshotFileJson(shareVars, shareOptVals, diagram)], { type: 'application/json;charset=utf-8' }), filename);
    notify(`Downloaded ${filename}`);
  };

  const canvasSnapshotOf = (cam) => buildCanvasSnapshot(
    vars, optVals, diagrams, diagramOverrides, canvasPositions,
    { x: cam?.x ?? 40, y: cam?.y ?? 40, zoom: cam?.s ?? 1 },
  );

  const copyCanvasLink = async (cam) => {
    if (!diagrams.length) { notify('Nothing to share'); return; }
    const snap = canvasSnapshotOf(cam);
    try {
      const token = await encodeSnapshotToken(snap);
      const url = shareUrl(token, 'c');
      if (isShareUrlTooLong(url)) {
        download(new Blob([JSON.stringify(snap, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }), 'canvas.tweakpele.json');
        notify('Link too long — downloaded canvas file instead');
        return;
      }
      const ok = await copyText(url);
      notify(ok ? 'Copied canvas link' : 'Copy failed — download the canvas file instead');
    } catch (_) {
      notify('Could not build canvas link');
    }
  };

  const downloadCanvasFile = (cam) => {
    const filename = 'canvas.tweakpele.json';
    download(new Blob([JSON.stringify(canvasSnapshotOf(cam), null, 2) + '\n'], { type: 'application/json;charset=utf-8' }), filename);
    notify(`Downloaded ${filename}`);
  };

  const openSnapshotFile = () => snapshotFileRef.current?.click();

  const onSnapshotFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = parseThemeFile(await file.text());
      const snap = !raw ? null : raw.kind === 'canvas' ? parseCanvasSnapshot(raw) : parseSnapshot(raw);
      if (!snap) { notify('Not a valid snapshot file'); return; }
      const isCanvas = snap.kind === 'canvas';
      const token = await encodeSnapshotToken(snap);
      const hash = `#/${isCanvas ? 'c' : 's'}/${token}`;
      // Prefer putting the token in the hash so refresh keeps it; even long hashes work in the address bar.
      if (location.hash !== hash) location.hash = hash;
      else if (isCanvas) applyCanvasSnapshot(snap);
      else applySnapshot(snap);
      notify(isShareUrlTooLong(shareUrl(token, isCanvas ? 'c' : 's')) ? 'Opened snapshot (link would be too long to share)' : 'Opened snapshot');
    } catch (_) {
      notify('Could not open snapshot file');
    }
  };

  const inCanvasSession = (id) => isSharedCanvas && sessionCanvas && sessionCanvas.diagrams.some((d) => d.id === id);
  const patchSessionDiagram = (id, patch) => setSessionCanvas((s) => (
    s ? { ...s, diagrams: s.diagrams.map((d) => (d.id === id ? { ...d, ...patch } : d)) } : s
  ));
  const changeSourceSafe = (id, source) => {
    if (sessionDiagram && id === sessionDiagram.id) {
      setSessionDiagram((d) => ({ ...d, source }));
      return;
    }
    if (inCanvasSession(id)) { patchSessionDiagram(id, { source }); return; }
    changeSource(id, source);
  };
  const changeTitleSafe = (id, title) => {
    if (sessionDiagram && id === sessionDiagram.id) {
      setSessionDiagram((d) => ({ ...d, title }));
      return;
    }
    if (inCanvasSession(id)) { patchSessionDiagram(id, { title }); return; }
    changeTitle(id, title);
  };
  const resetSourceSafe = (id) => {
    if (sessionDiagram && id === sessionDiagram.id) {
      setSessionDiagram((d) => ({ ...d, source: d.original }));
      return;
    }
    if (inCanvasSession(id)) {
      const d = sessionCanvas.diagrams.find((x) => x.id === id);
      if (d) patchSessionDiagram(id, { source: d.original });
      return;
    }
    resetSource(id);
  };

  // ------------------------------------------------------------------ shared-canvas session actions (in memory only)
  const setSessionPositions = useCallback((p) => {
    setSessionCanvas((s) => (s ? { ...s, positions: p } : s));
  }, []);
  const sessionOpen = (id) => {
    focusDiagram(id);
    setSessionSidebarOpen(true);
  };
  const sessionDuplicate = (id) => {
    const src = sessionCanvas?.diagrams.find((d) => d.id === id);
    if (!src) return;
    const nid = newId();
    setSessionCanvas((s) => {
      const i = s ? s.diagrams.findIndex((d) => d.id === id) : -1;
      if (i < 0) return s;
      const next = [...s.diagrams];
      next.splice(i + 1, 0, { ...src, id: nid, title: `${src.title} (copy)`, builtin: false });
      return { ...s, diagrams: next };
    });
    const ov = diagramOverrides[id];
    if (ov) setDiagramOverrides((prev) => ({ ...prev, [nid]: { opts: { ...ov.opts }, vars: { ...ov.vars } } }));
    notify(`Duplicated “${src.title}”`);
  };
  const sessionDelete = (id) => {
    setSessionCanvas((s) => {
      if (!s) return s;
      const positions = { ...s.positions };
      delete positions[id];
      return { ...s, diagrams: s.diagrams.filter((d) => d.id !== id), positions };
    });
    setDiagramOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (focusedId === id) setFocusedId(null);
    notify('Deleted from shared canvas');
  };
  const sessionCardMenu = (e, d) => {
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Focus', Icon: Focus, onClick: () => focusDiagram(d.id) },
        { label: `Edit “${d.title}”`, Icon: Pencil, onClick: () => sessionOpen(d.id) },
        { label: 'Duplicate', Icon: Copy, onClick: () => sessionDuplicate(d.id) },
        { label: 'Delete', Icon: Trash2, danger: true, onClick: () => sessionDelete(d.id) },
      ],
    });
  };
  const exitSession = () => {
    setFocusedId(null);
    backToGallery();
  };

  // ------------------------------------------------------------------ library actions spanning view state
  const addDiagram = (starter) => {
    const d = createDiagram(starter);
    setNewOpen(false);
    openEditor(d.id);
    notify(`Created “${d.title}”`);
  };
  const saveAsDiagram = useCallback((id) => {
    const d = saveAsCopy(id);
    if (!d) return;
    setFocusedId(d.id);
    if (route.view === 'edit') navigate({ view: 'edit', id: d.id });
    notify(`Saved as “${d.title}”`);
  }, [saveAsCopy, setFocusedId, route.view, notify]);
  const deleteDiagram = useCallback((id) => {
    const src = removeDiagram(id);
    if (!src) return;
    onDiagramDeleted(id);
    notify(`Deleted “${src.title}”`);
  }, [removeDiagram, onDiagramDeleted, notify]);

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

  const isSnapshot = route.view === 'snapshot';
  const inSession = isSnapshot || isSharedCanvas;
  // '#/edit/<id>' and '#/s/<token>' both render the focused view with the editor sidebar open;
  // in a shared-canvas session the sidebar is toggled without leaving the '#/c/' route.
  const sidebarOpen = isSnapshot || route.view === 'edit' || (isSharedCanvas && sessionSidebarOpen);
  const focusedIdx = focusedId ? focusOrder.findIndex((d) => d.id === focusedId) : -1;
  const focusedDiagram = isSnapshot ? sessionDiagram
    : focusedIdx >= 0 ? focusOrder[focusedIdx] : (focusedId && !isSharedCanvas ? findDiagram(focusedId) : null);
  const peleMissing = typeof pele === 'undefined' || typeof pele.mount !== 'function';

  const toggleSidebar = () => {
    if (isSharedCanvas) setSessionSidebarOpen((o) => !o);
    else if (sidebarOpen) backToGallery();
    else if (focusedDiagram) openEditor(focusedDiagram.id);
  };

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
            label={siteTheme === 'light' ? 'Switch to dark site theme' : 'Switch to light site theme'}
            onClick={toggleTheme} />
          {!inSession && route.view !== 'markdown' && (
            <IconButton
              Icon={viewMode === 'gallery' ? InfinityIcon : LayoutGrid}
              label={viewMode === 'gallery' ? 'Switch to infinite canvas' : 'Switch to gallery'}
              onClick={() => setViewMode((m) => (m === 'gallery' ? 'canvas' : 'gallery'))}
            />
          )}
          <IconButton Icon={Undo2} label="Undo" disabled={!history.canUndo} onClick={history.undo} />
          <IconButton Icon={Redo2} label="Redo" disabled={!history.canRedo} onClick={history.redo} />
          <IconButton Icon={FilePlus2} label="New diagram" onClick={() => setNewOpen(true)} />
          <IconButton Icon={ClipboardCopy} label="Copy .pele CSS" onClick={() => doCopy(cssBlock, '.pele CSS')} />
          <IconButton Icon={Braces} label="Copy render options JSON" onClick={() => doCopy(optionsJson, 'render options JSON')} />
          <IconButton Icon={FileCode2} label="Export for Mermaid" onClick={mermaidMenu} />
          {!inSession && (
            <IconButton Icon={FileText} label="Markdown preview" onClick={() => navigate({ view: 'markdown' })} />
          )}
          <IconButton Icon={Download} label="Download theme file" onClick={downloadTheme} />
          <IconButton Icon={Upload} label="Import theme file" onClick={() => themeFileRef.current?.click()} />
          <IconButton Icon={FolderOpen} label="Open snapshot file" onClick={openSnapshotFile} />
          <IconButton Icon={RotateCcw} label="Reset factory theme & options" onClick={resetFactory} />
          <IconButton Icon={ArchiveRestore} label="Restore built-in samples" onClick={restoreSamples} />
        </span>
      </header>

      <main className="layout">
        <Toolbox
          vars={vars} onVarChange={onVarChange} onApplyPreset={applyThemePreset}
          optVals={optVals} onOptChange={onOptChange} onOptReset={onOptReset}
          cssBlock={cssBlock} optionsJson={optionsJson}
          onImportThemeFile={importThemeFile}
        />
        <div className="pele-scope" style={varsStyle}>
          {peleMissing && <div className="fatal">Pele failed to load (vendor/pele.global.js).</div>}
          {(isSnapshot && !sessionDiagram) || (isSharedCanvas && !sessionCanvas) ? (
            <div className="empty editor-missing"><p>{isSnapshot ? 'Opening shared snapshot…' : 'Opening shared canvas…'}</p></div>
          ) : route.view === 'markdown' ? (
            <MarkdownView options={galleryOptions} onClose={backToGallery} notify={notify} />
          ) : (
            <div className="view-holder">
              {/* Keep overview geometry and state while focus occupies the same content slot. */}
              <div className="overview-view" aria-hidden={!!focusedDiagram} inert={focusedDiagram ? '' : undefined}>
                {viewMode === 'gallery' && !isSharedCanvas ? (
                  <Gallery
                    diagrams={diagrams} optionsFor={galleryOptionsFor}
                    styleApi={styleApi}
                    cols={galleryCols} onColsChange={setGalleryCols}
                    onOpen={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                    onNew={() => setNewOpen(true)}
                    onFocus={focusDiagram} onFocusPrev={focusPrev} onFocusNext={focusNext}
                    onCardMenu={cardMenu} onBoardMenu={boardMenu}
                  />
                ) : (
                  <Canvas
                    key={isSharedCanvas ? `shared-${sessionCanvas.nonce}` : 'own'}
                    diagrams={isSharedCanvas ? sessionCanvas.diagrams : diagrams}
                    optionsFor={canvasOptionsFor}
                    styleApi={styleApi}
                    positions={isSharedCanvas ? sessionCanvas.positions : canvasPositions}
                    onPositionsChange={isSharedCanvas ? setSessionPositions : setCanvasPositions}
                    initialCam={isSharedCanvas ? sessionCanvas.cam : undefined}
                    onOpen={isSharedCanvas ? sessionOpen : openEditor}
                    onDuplicate={isSharedCanvas ? sessionDuplicate : duplicateDiagram}
                    onDelete={isSharedCanvas ? sessionDelete : deleteDiagram}
                    onFocus={focusDiagram} onFocusPrev={focusPrev} onFocusNext={focusNext}
                    onFrameMenu={isSharedCanvas ? sessionCardMenu : cardMenu}
                    onBoardMenu={isSharedCanvas ? undefined : boardMenu}
                    onCopyCanvasLink={isSharedCanvas ? undefined : copyCanvasLink}
                    onDownloadCanvasFile={isSharedCanvas ? undefined : downloadCanvasFile}
                    onExitSession={isSharedCanvas ? exitSession : undefined}
                  />
                )}
              </div>
              {focusedDiagram && (
                <FocusedView
                  key={focusedDiagram.id}
                  diagram={focusedDiagram}
                  options={optionsForDiagram(focusedDiagram.id, 'focused')}
                  index={isSnapshot ? 0 : focusedIdx}
                  total={isSnapshot ? 1 : focusOrder.length}
                  slideDir={focusSlideDir}
                  onClose={isSnapshot ? backToGallery : clearFocus}
                  onPrev={focusPrev} onNext={focusNext}
                  sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar}
                  split={split} onSplitChange={setSplit}
                  onDuplicate={isSharedCanvas ? sessionDuplicate : duplicateDiagram}
                  onDelete={isSharedCanvas ? sessionDelete : deleteDiagram}
                  onMenu={isSharedCanvas ? sessionCardMenu : cardMenu}
                  onChangeSource={changeSourceSafe}
                  onChangeTitle={changeTitleSafe}
                  onResetSource={resetSourceSafe}
                  onCopySource={(d) => doCopy(d.source, `${d.title} source`)}
                  onCopyMermaidSource={(d) => doCopy(
                    withMermaidFrontmatter(d.source, mergeDiagramVars(vars, diagramOverrides[d.id]?.vars)),
                    `${d.title} source with Mermaid theme`,
                  )}
                  notify={notify}
                  onRenderFeedback={sidebarOpen ? (fb) => { bridge.pushFeedback?.(fb); } : undefined}
                  onCopyShareLink={() => copyShareLink(focusedDiagram)}
                  onDownloadSnapshot={() => downloadSnapshot(focusedDiagram)}
                  onOpenSnapshot={openSnapshotFile}
                  vars={vars}
                  styleApi={styleApi}
                  onCtrlWheelCols={!inSession && viewMode === 'gallery' ? bumpGalleryCols : undefined}
                  enableSlideWheel={!inSession && viewMode === 'gallery' && galleryCols === 1}
                />
              )}
            </div>
          )}
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
      <input ref={snapshotFileRef} type="file" accept="application/json,.json,.tweakpele.json" hidden onChange={onSnapshotFile} />
      <input ref={themeFileRef} type="file" accept=".json,application/json" hidden onChange={onThemeFile} />
      <Toast toast={toastMsg} />
    </div>
  );
}
