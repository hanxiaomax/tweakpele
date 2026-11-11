import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LuSun as Sun, LuMoon as Moon, LuPanelLeftClose as PanelLeftClose, LuPanelLeftOpen as PanelLeftOpen,
  LuFilePlus2 as FilePlus2, LuClipboardCopy as ClipboardCopy, LuBraces as Braces,
  LuRotateCcw as RotateCcw, LuMoonStar as MoonStar, LuArchiveRestore as ArchiveRestore,
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuLayoutGrid as LayoutGrid, LuInfinity as InfinityIcon,
  LuFocus as Focus, LuSave as Save, LuDownload as Download, LuFolderOpen as FolderOpen,
} from 'react-icons/lu';
import Toolbox from './components/Toolbox.jsx';
import Gallery from './components/Gallery.jsx';
import Canvas from './components/Canvas.jsx';
import EditorView from './components/EditorView.jsx';
import FocusedView from './components/FocusedView.jsx';
import { ContextMenu, Dialog, IconButton, Toast } from './components/ui.jsx';
import { ALL_OPTS, OPT_GROUPS, STARTERS, THEME_PRESETS, themeFileJson } from './constants.js';
import { copyText, navigate } from './lib.js';
import { download } from './export.js';
import { slugify } from './export.js';
import {
  buildSnapshot, snapshotFileJson, parseSnapshot, snapshotTheme, diagramFromSnapshot,
  encodeSnapshotToken, decodeSnapshotToken, shareUrl, isShareUrlTooLong,
} from './snapshot.js';
import { useTweakpeleBridge } from './bridge.js';
import { useThemeState } from './state/useThemeState.js';
import { useDiagrams } from './state/useDiagrams.js';
import { useViewState } from './state/useViewState.js';

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

  const theme = useThemeState({ notify, setStatus });
  const {
    siteTheme, vars, optVals, cssBlock, optionsJson, mountOptions, varsStyle,
    applyPresetVars, applyThemePreset, toggleTheme, resetFactory, loadDarkSample,
    onVarChange, onOptChange, onOptReset,
    applySnapshotTheme, clearSnapshotTheme,
  } = theme;
  const diagramsApi = useDiagrams({ theme, notify, setStatus });
  const {
    diagrams, setDiagrams, diagramOverrides, setDiagramOverrides, findDiagram,
    styleApi, optionsForDiagram, galleryOptionsFor, canvasOptionsFor,
    onDiagramOptChange, onDiagramVarChange, onDiagramOverrideReset,
    createDiagram, duplicateDiagram, saveAsCopy, removeDiagram,
    changeSource, changeTitle, resetSource, restoreSamples,
  } = diagramsApi;
  const view = useViewState({ diagrams });
  const {
    route, openEditor, backToGallery, viewMode, setViewMode,
    toolboxCollapsed, setToolboxCollapsed, split, setSplit,
    canvasPositions, setCanvasPositions,
    focusedId, setFocusedId, focusSlideDir, focusOrder, focusDiagram, clearFocus, focusPrev, focusNext,
    galleryCols, setGalleryCols, bumpGalleryCols, onDiagramDeleted,
  } = view;

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

  // Opening #/s/<token> applies the snapshot for this session only — it must not write localStorage.
  useEffect(() => {
    if (route.view !== 'snapshot') {
      if (sessionDiagram) {
        setSessionDiagram(null);
        clearSnapshotTheme();
      }
      return;
    }
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

  const openSnapshotFile = () => snapshotFileRef.current?.click();

  const onSnapshotFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const snap = parseSnapshot(await file.text());
      if (!snap) { notify('Not a valid snapshot file'); return; }
      const token = await encodeSnapshotToken(snap);
      const url = shareUrl(token);
      // Prefer putting the token in the hash so refresh keeps it; even long hashes work in the address bar.
      if (location.hash !== `#/s/${token}`) location.hash = `#/s/${token}`;
      else applySnapshot(snap);
      notify(isShareUrlTooLong(url) ? 'Opened snapshot (link would be too long to share)' : 'Opened snapshot');
    } catch (_) {
      notify('Could not open snapshot file');
    }
  };

  const changeSourceSafe = (id, source) => {
    if (sessionDiagram && id === sessionDiagram.id) {
      setSessionDiagram((d) => ({ ...d, source }));
      return;
    }
    changeSource(id, source);
  };
  const changeTitleSafe = (id, title) => {
    if (sessionDiagram && id === sessionDiagram.id) {
      setSessionDiagram((d) => ({ ...d, title }));
      return;
    }
    changeTitle(id, title);
  };
  const resetSourceSafe = (id) => {
    if (sessionDiagram && id === sessionDiagram.id) {
      setSessionDiagram((d) => ({ ...d, source: d.original }));
      return;
    }
    resetSource(id);
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
    notify(`Saved as “${d.title}”`);
  }, [saveAsCopy, focusDiagram, notify]);
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

  const current = route.view === 'snapshot' ? sessionDiagram
    : route.view === 'edit' ? findDiagram(route.id) : null;
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
          {route.view !== 'edit' && route.view !== 'snapshot' && (
            <IconButton
              Icon={viewMode === 'gallery' ? InfinityIcon : LayoutGrid}
              label={viewMode === 'gallery' ? 'Switch to infinite canvas' : 'Switch to gallery'}
              onClick={() => setViewMode((m) => (m === 'gallery' ? 'canvas' : 'gallery'))}
            />
          )}
          <IconButton Icon={FilePlus2} label="New diagram" onClick={() => setNewOpen(true)} />
          <IconButton Icon={ClipboardCopy} label="Copy .pele CSS" onClick={() => doCopy(cssBlock, '.pele CSS')} />
          <IconButton Icon={Braces} label="Copy render options JSON" onClick={() => doCopy(optionsJson, 'render options JSON')} />
          <IconButton Icon={Download} label="Download theme file" onClick={downloadTheme} />
          <IconButton Icon={FolderOpen} label="Open snapshot file" onClick={openSnapshotFile} />
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
                    cols={galleryCols} onColsChange={setGalleryCols}
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
                  slideDir={focusSlideDir}
                  onClose={clearFocus} onPrev={focusPrev} onNext={focusNext}
                  onEdit={openEditor} onDuplicate={duplicateDiagram} onDelete={deleteDiagram}
                  onMenu={cardMenu}
                  onChangeSource={changeSource}
                  vars={vars}
                  styleApi={styleApi}
                  onCtrlWheelCols={viewMode === 'gallery' ? bumpGalleryCols : undefined}
                  enableSlideWheel={viewMode === 'gallery' && galleryCols === 1}
                />
              )}
            </div>
          )}
          {(route.view === 'edit' || route.view === 'snapshot') && (current
            ? <EditorView
                key={current.id}
                diagram={current} mountOptions={optionsForDiagram(current.id, 'editor')}
                split={split} onSplitChange={setSplit}
                onBack={backToGallery} onChangeTitle={changeTitleSafe}
                onChangeSource={changeSourceSafe} onResetSource={resetSourceSafe}
                onCopySource={(d) => doCopy(d.source, `${d.title} source`)}
                notify={notify}
                onRenderFeedback={(fb) => { bridge.pushFeedback?.(fb); }}
                vars={vars}
                styleApi={styleApi}
                onCopyShareLink={() => copyShareLink(current)}
                onDownloadSnapshot={() => downloadSnapshot(current)}
                onOpenSnapshot={openSnapshotFile}
              />
            : <div className="empty editor-missing">{route.view === 'snapshot'
                ? <p>Opening shared snapshot…</p>
                : <><p>This diagram no longer exists.</p>
               <p><button type="button" className="btn" onClick={backToGallery}>Back to gallery</button></p></>}</div>)}
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
      <Toast toast={toastMsg} />
    </div>
  );
}
