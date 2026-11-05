import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2, LuFocus as Focus,
  LuMaximize2 as Maximize2, LuZoomIn as ZoomIn, LuZoomOut as ZoomOut,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';
import { clamp } from '../lib.js';

const MIN_S = 0.03;
const MAX_S = 6;
const GAP = 48;
const COLS = 5;
const PAD = 24;
const FALLBACK_W = 640;
const FALLBACK_H = 280;

const Frame = memo(function Frame({ d, options, onOpen, onDuplicate, onDelete, onFocus, onFrameMenu, onSize, focused }) {
  const dirty = d.source !== d.original;
  const shellRef = useRef(null);

  const report = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    onSize(d.id, el.offsetWidth, el.offsetHeight);
  }, [d.id, onSize]);
  const reportWhenPainted = useCallback(() => requestAnimationFrame(report), [report]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => report());
    ro.observe(el);
    return () => ro.disconnect();
  }, [report]);

  return (
    <article
      ref={shellRef}
      className={'canvas-frame' + (dirty ? ' edited' : '') + (focused ? ' focused' : '')}
      data-frame={d.id}
      onDoubleClick={(e) => { e.stopPropagation(); onFocus(d.id); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onFrameMenu(e, d); }}
    >
      <header className="canvas-frame-title">
        <b>{d.title}</b>
        <code>{d.keyword || ''}</code>
        <span className="card-actions" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <IconButton Icon={Focus} label={`Focus ${d.title}`} onClick={() => onFocus(d.id)} />
          <IconButton Icon={Pencil} label={`Edit ${d.title}`} onClick={() => onOpen(d.id)} />
          <IconButton Icon={Copy} label={`Duplicate ${d.title}`} onClick={() => onDuplicate(d.id)} />
          <IconButton Icon={Trash2} label={`Delete ${d.title}`} kind="danger" onClick={() => onDelete(d.id)} />
        </span>
      </header>
      <div className="canvas-frame-body">
        <PeleHost
          source={d.source}
          options={options}
          lazy
          onResult={reportWhenPainted}
          onError={reportWhenPainted}
        />
      </div>
    </article>
  );
});

export default function Canvas({
  diagrams, canvasOptions, focusedId, onFocus, onClearFocus, onFocusPrev, onFocusNext,
  onOpen, onDuplicate, onDelete, onFrameMenu, onBoardMenu,
}) {
  const vpRef = useRef(null);
  const camRef = useRef({ x: 40, y: 40, s: 1 });
  const userMovedRef = useRef(false);
  const sizesRef = useRef(new Map());
  const [cam, setCam] = useState({ x: 40, y: 40, s: 1 });
  const [layoutTick, setLayoutTick] = useState(0);
  const [animating, setAnimating] = useState(false);

  const applyCam = useCallback((next, animate) => {
    camRef.current = next;
    setCam(next);
    if (animate) {
      setAnimating(true);
      clearTimeout(applyCam._t);
      applyCam._t = setTimeout(() => setAnimating(false), 420);
    }
  }, []);

  const positions = useMemo(() => {
    const map = new Map();
    let y = PAD;
    for (let r = 0; r * COLS < diagrams.length; r++) {
      const row = diagrams.slice(r * COLS, r * COLS + COLS);
      let x = PAD;
      let rowH = 0;
      for (const d of row) {
        const sz = sizesRef.current.get(d.id);
        const w = sz?.w || FALLBACK_W;
        const h = sz?.h || FALLBACK_H;
        map.set(d.id, { x, y, w, h });
        x += w + GAP;
        rowH = Math.max(rowH, h);
      }
      y += rowH + GAP;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagrams, layoutTick]);

  const worldBounds = useCallback(() => {
    if (!diagrams.length) return { x: 0, y: 0, w: 1, h: 1 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const d of diagrams) {
      const p = positions.get(d.id) || { x: PAD, y: PAD, w: FALLBACK_W, h: FALLBACK_H };
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h);
    }
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }, [diagrams, positions]);

  const fitRect = useCallback((r, margin, animate) => {
    const vp = vpRef.current;
    if (!vp) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const s = clamp(Math.min((vw - 2 * margin) / r.w, (vh - 2 * margin) / r.h), MIN_S, MAX_S);
    applyCam({
      s,
      x: (vw - r.w * s) / 2 - r.x * s,
      y: (vh - r.h * s) / 2 - r.y * s,
    }, animate);
  }, [applyCam]);

  const fitAll = useCallback((animate = true) => {
    onClearFocus();
    if (animate !== false) userMovedRef.current = false;
    fitRect(worldBounds(), 36, animate !== false);
  }, [fitRect, worldBounds, onClearFocus]);

  const focusFrame = useCallback((id, animate = true) => {
    const p = positions.get(id);
    if (!p) return;
    if (animate) userMovedRef.current = false;
    fitRect({ x: p.x, y: p.y, w: p.w, h: p.h }, 28, animate);
  }, [fitRect, positions]);

  const zoomAt = useCallback((px, py, factor, animate) => {
    const c = camRef.current;
    const s = clamp(c.s * factor, MIN_S, MAX_S);
    const wx = (px - c.x) / c.s, wy = (py - c.y) / c.s;
    userMovedRef.current = true;
    applyCam({ s, x: px - wx * s, y: py - wy * s }, !!animate);
  }, [applyCam]);

  const zoomCenter = useCallback((factor) => {
    const vp = vpRef.current;
    if (!vp) return;
    zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, factor, true);
  }, [zoomAt]);

  const sizeTimer = useRef(0);
  const onSize = useCallback((id, w, h) => {
    const prev = sizesRef.current.get(id);
    if (prev && Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2) return;
    sizesRef.current.set(id, { w, h });
    clearTimeout(sizeTimer.current);
    sizeTimer.current = setTimeout(() => setLayoutTick((t) => t + 1), 48);
  }, []);

  // Camera policy: keep the focused frame (or the whole world) in view unless the user panned away.
  const followCamera = useCallback((animate = false) => {
    if (userMovedRef.current) return;
    if (focusedId) focusFrame(focusedId, animate);
    else fitRect(worldBounds(), 36, animate);
  }, [focusedId, focusFrame, fitRect, worldBounds]);
  const followCameraRef = useRef(followCamera);
  followCameraRef.current = followCamera;

  // Camera follows focus / overview when layout settles
  useLayoutEffect(() => { followCamera(); }, [followCamera]);

  // When focusedId changes from outside, camera-follow (allow animate)
  useEffect(() => {
    userMovedRef.current = false;
    if (focusedId) focusFrame(focusedId, true);
  }, [focusedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const pts = new Map();
    let drag = null;
    let pinch = null;
    let moved = false;
    const local = (e) => {
      const r = vp.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('button, a, input, textarea, select, [data-pele-zoom], .ctxmenu')) return;
      pts.set(e.pointerId, local(e));
      moved = false;
      if (pts.size === 1) {
        const p = local(e);
        drag = { ...p, cx: camRef.current.x, cy: camRef.current.y };
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: camRef.current.s };
        drag = null;
      }
    };
    const onMove = (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.s * d / pinch.d) / camRef.current.s, false);
        moved = true;
      } else if (drag) {
        const dx = p.x - drag.x, dy = p.y - drag.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) {
          moved = true;
          try { vp.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        vp.classList.add('panning');
        userMovedRef.current = true;
        applyCam({ ...camRef.current, x: drag.cx + dx, y: drag.cy + dy }, false);
      }
    };
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) { drag = null; vp.classList.remove('panning'); }
    };
    const onClickCapture = (e) => {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    };
    const onWheel = (e) => {
      e.preventDefault();
      const p = local(e);
      if (e.shiftKey && !e.ctrlKey) {
        userMovedRef.current = true;
        applyCam({ ...camRef.current, x: camRef.current.x - (e.deltaY || e.deltaX), y: camRef.current.y }, false);
        return;
      }
      const k = e.ctrlKey ? 0.01 : 0.0018;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(p.x, p.y, Math.exp(-dy * k), false);
    };
    const ro = new ResizeObserver(() => followCameraRef.current());
    ro.observe(vp);

    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('click', onClickCapture, true);
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      vp.removeEventListener('pointerdown', onDown);
      vp.removeEventListener('pointermove', onMove);
      vp.removeEventListener('pointerup', end);
      vp.removeEventListener('pointercancel', end);
      vp.removeEventListener('click', onClickCapture, true);
      vp.removeEventListener('wheel', onWheel);
    };
  }, [applyCam, zoomAt]);

  const label = focusedId
    ? (diagrams.find((d) => d.id === focusedId)?.title || 'Focused')
    : 'Overview';

  return (
    <section
      className="canvas-viewport"
      ref={vpRef}
      aria-label="Infinite canvas"
      onContextMenu={(e) => {
        if (e.target.closest('[data-frame]')) return;
        e.preventDefault();
        onBoardMenu(e);
      }}
      onDoubleClick={(e) => {
        if (e.target.closest('[data-frame]')) return;
        fitAll(true);
      }}
    >
      <div className="canvas-toolbar" onPointerDown={(e) => e.stopPropagation()}>
        <IconButton Icon={ChevronLeft} label="Previous diagram" onClick={onFocusPrev} disabled={!diagrams.length} />
        <IconButton Icon={ChevronRight} label="Next diagram" onClick={onFocusNext} disabled={!diagrams.length} />
        <span className="canvas-zoom-label" title={label}>{focusedId ? 'Focus' : `${Math.round(cam.s * 100)}%`}</span>
        <IconButton Icon={Maximize2} label="Fit all (Esc / F)" onClick={() => fitAll(true)} />
        <IconButton Icon={ZoomOut} label="Zoom out" onClick={() => zoomCenter(0.8)} />
        <IconButton Icon={ZoomIn} label="Zoom in" onClick={() => zoomCenter(1.25)} />
      </div>
      <div
        className={'canvas-world' + (animating ? ' animating' : '')}
        style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }}
      >
        {diagrams.length === 0 && (
          <div className="empty canvas-empty">
            <p>No diagrams yet.</p>
            <p className="muted">Right-click empty space to create one, or use Duplicate / Save as.</p>
          </div>
        )}
        {diagrams.map((d) => {
          const p = positions.get(d.id) || { x: PAD, y: PAD };
          return (
            <div key={d.id} className="canvas-frame-slot" style={{ left: p.x, top: p.y }}>
              <Frame
                d={d}
                options={canvasOptions}
                onOpen={onOpen}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onFocus={onFocus}
                onFrameMenu={onFrameMenu}
                onSize={onSize}
                focused={focusedId === d.id}
              />
            </div>
          );
        })}
      </div>
      <div className="canvas-hint">
        Drag to pan · scroll to zoom · double-click a diagram to focus · ←/→ prev/next · Esc/F fit all · right-click empty to create
      </div>
    </section>
  );
}
