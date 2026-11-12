import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clamp, loadJSON, saveJSON, useHashRoute, usePersistedState, navigate, sortDiagramsSpatially,
} from '../lib.js';

const TOOLBOX_KEY = 'tweakpele.toolbox.collapsed';
const VIEW_KEY = 'tweakpele.viewMode';
const SPLIT_KEY = 'tweakpele.split.v1';
const POS_KEY = 'tweakpele.canvasPos.v1';
const GALLERY_COLS_KEY = 'tweakpele.galleryCols.v1';
const GALLERY_COLS_MULTI_KEY = 'tweakpele.galleryColsLastMulti.v1';
const GALLERY_COL_MIN = 1;
const GALLERY_COL_MAX = 6;
const LAST_EDIT_KEY = 'tweakpele.lastEditId';

/** View state: hash route, gallery↔canvas mode, editor split, focus carousel,
 *  gallery column density, canvas positions, toolbox collapse, global shortcuts. */
export function useViewState({ diagrams }) {
  const [toolboxCollapsed, setToolboxCollapsed] = usePersistedState(TOOLBOX_KEY, (v) => (v === false ? false : true));
  const [viewMode, setViewMode] = usePersistedState(VIEW_KEY, (v) => (v === 'canvas' ? 'canvas' : 'gallery'));
  const [canvasPositions, setCanvasPositions] = usePersistedState(POS_KEY, (v) => (
    v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  ));
  const [focusedId, setFocusedId] = useState(null);
  const [focusSlideDir, setFocusSlideDir] = useState(0);
  const [galleryCols, setGalleryCols] = usePersistedState(GALLERY_COLS_KEY, (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? clamp(Math.round(n), GALLERY_COL_MIN, GALLERY_COL_MAX) : 3;
  });
  const [galleryColsLastMulti, setGalleryColsLastMulti] = usePersistedState(GALLERY_COLS_MULTI_KEY, (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? clamp(Math.round(n), 2, GALLERY_COL_MAX) : 3;
  });
  const galleryColsRef = useRef(galleryCols);
  galleryColsRef.current = galleryCols;
  // Sidebar width in px (was a % split pre-v4; small stored values fall back to the default).
  const [split, setSplit] = usePersistedState(SPLIT_KEY, (v) => (
    Number.isFinite(v) && v >= 200 ? Math.round(v) : 380
  ));
  const route = useHashRoute();

  // Default mode = editor: first open with no hash focuses the last-edited diagram with the sidebar.
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

  // '#/edit/<id>' = that diagram focused with the editor sidebar open (deep links / lastEditId / prev-next).
  useEffect(() => {
    if (route.view === 'edit' && route.id) setFocusedId(route.id);
  }, [route.view, route.id]);

  const openEditor = useCallback((id) => {
    setFocusSlideDir(0);
    setFocusedId(id);
    navigate({ view: 'edit', id });
  }, []);
  const backToGallery = useCallback(() => navigate({ view: 'gallery' }), []);

  const focusDiagram = useCallback((id) => {
    setFocusSlideDir(0);
    setFocusedId(id);
  }, []);
  /** Exit focus. Leaving gallery 1×1 also restores the last multi-column grid;
   *  exiting while the edit sidebar is open also closes it. */
  const clearFocus = useCallback(() => {
    if (viewMode === 'gallery' && galleryColsRef.current === 1) {
      setGalleryCols(galleryColsLastMulti || 3);
    }
    setFocusSlideDir(0);
    setFocusedId(null);
    if (route.view === 'edit') backToGallery();
  }, [viewMode, galleryColsLastMulti, setGalleryCols, route.view, backToGallery]);
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
    setFocusSlideDir(dir);
    setFocusedId(focusOrder[next].id);
    // keep the sidebar (edit route) on the new diagram
    if (route.view === 'edit' && route.id !== focusOrder[next].id) navigate({ view: 'edit', id: focusOrder[next].id });
  }, [focusOrder, focusedId, route.view, route.id]);
  const focusPrev = useCallback(() => focusStep(-1), [focusStep]);
  const focusNext = useCallback(() => focusStep(1), [focusStep]);

  const bumpGalleryCols = useCallback((delta) => {
    setGalleryCols((c) => clamp(c + delta, GALLERY_COL_MIN, GALLERY_COL_MAX));
  }, [setGalleryCols]);

  // Gallery 1×1 → auto-enter the same FocusedView as click-to-focus (centered slide UI).
  const prevGalleryCols = useRef(galleryCols);
  useEffect(() => {
    const prev = prevGalleryCols.current;
    prevGalleryCols.current = galleryCols;
    if (route.view !== 'gallery' || viewMode !== 'gallery') return;
    if (galleryCols >= 2) {
      setGalleryColsLastMulti(galleryCols);
      if (prev === 1) {
        setFocusSlideDir(0);
        setFocusedId(null);
      }
      return;
    }
    // cols === 1
    if (!diagrams.length) {
      setFocusedId(null);
      return;
    }
    setFocusedId((id) => {
      if (id && diagrams.some((d) => d.id === id)) return id;
      return diagrams[0].id;
    });
  }, [galleryCols, route.view, viewMode, diagrams, setGalleryColsLastMulti]);

  // Global shortcuts: T toggles the toolbox; Esc/F exit focus (or close the sidebar first);
  // arrows step diagrams — also while the edit sidebar is open (hash follows the new id).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.closest && t.closest('input, textarea, select, [contenteditable]'))) return;
      if (e.key === 't' || e.key === 'T') setToolboxCollapsed((c) => !c);
      else if (route.view === 'snapshot') {
        if (e.key === 'Escape') backToGallery();
      } else if (route.view === 'edit') {
        if (e.key === 'Escape') backToGallery();
        else if (e.key === 'f' || e.key === 'F') clearFocus();
        else if (e.key === 'ArrowLeft') { e.preventDefault(); focusPrev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); focusNext(); }
      } else {
        if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') clearFocus();
        else if (e.key === 'ArrowLeft') { e.preventDefault(); focusPrev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); focusNext(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route.view, clearFocus, focusPrev, focusNext, backToGallery]);

  /** Cleanup after a diagram is removed: drop its canvas position, exit focus/edit if it was active. */
  const onDiagramDeleted = useCallback((id) => {
    setCanvasPositions((pos) => {
      if (!pos || !(id in pos)) return pos;
      const next = { ...pos };
      delete next[id];
      return next;
    });
    if (focusedId === id) setFocusedId(null);
    if (route.view === 'edit' && route.id === id) backToGallery();
  }, [focusedId, route.view, route.id, backToGallery, setCanvasPositions]);

  return {
    route, openEditor, backToGallery,
    viewMode, setViewMode,
    toolboxCollapsed, setToolboxCollapsed,
    split, setSplit,
    canvasPositions, setCanvasPositions,
    focusedId, setFocusedId, focusSlideDir, focusOrder,
    focusDiagram, clearFocus, focusPrev, focusNext,
    galleryCols, setGalleryCols, bumpGalleryCols,
    onDiagramDeleted,
  };
}
