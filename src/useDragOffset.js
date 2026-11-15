import { useCallback, useEffect, useRef } from 'react';

/**
 * Drag a floating element inside its offset parent with a translate3d offset.
 *
 * Performance notes (why this is smooth):
 * - Bounds are measured once on pointerdown, never inside pointermove (no layout thrash).
 * - Moves are coalesced into one requestAnimationFrame write per frame.
 * - The `dragging` class is toggled directly on the element: no React re-render while dragging.
 * - Only `transform` is written; visual effects (hover scale, open animation) live on children,
 *   so they never fight the drag transform.
 */
export default function useDragOffset(elRef) {
  const offset = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);

  const apply = useCallback((el, p) => {
    el.style.transform = p.x || p.y ? `translate3d(${p.x}px, ${p.y}px, 0)` : '';
  }, []);

  /** Keep the element inside its parent (call after its size changes). */
  const reclamp = useCallback(() => {
    const el = elRef.current;
    const parent = el && (el.offsetParent || el.parentElement);
    if (!el || !parent) return;
    const maxX = parent.clientWidth - el.offsetWidth - el.offsetLeft;
    const maxY = parent.clientHeight - el.offsetHeight - el.offsetTop;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
    const next = {
      x: clamp(offset.current.x, -el.offsetLeft, maxX),
      y: clamp(offset.current.y, -el.offsetTop, maxY),
    };
    if (next.x !== offset.current.x || next.y !== offset.current.y) {
      offset.current = next;
      apply(el, next);
    }
  }, [elRef, apply]);

  /**
   * Start a drag from a pointerdown. `threshold` (px) lets the same element act as a
   * button: movement below it is a click, above it becomes a drag and swallows the click.
   */
  const startDrag = useCallback((e, threshold = 0) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = elRef.current;
    const parent = el && (el.offsetParent || el.parentElement);
    if (!el || !parent) return;
    e.stopPropagation();

    // Measure once.
    const bounds = {
      minX: -el.offsetLeft,
      maxX: parent.clientWidth - el.offsetWidth - el.offsetLeft,
      minY: -el.offsetTop,
      maxY: parent.clientHeight - el.offsetHeight - el.offsetTop,
    };
    const start = { px: e.clientX, py: e.clientY, x: offset.current.x, y: offset.current.y };
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    let active = threshold === 0;
    let frame = 0;
    let last = null;

    const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
    const begin = () => {
      active = true;
      el.classList.add('dragging');
      try { target.setPointerCapture(pointerId); } catch { /* pointer already gone */ }
    };
    if (active) { e.preventDefault(); begin(); }

    const flush = () => {
      frame = 0;
      if (!last) return;
      const next = {
        x: clamp(start.x + last.x - start.px, bounds.minX, bounds.maxX),
        y: clamp(start.y + last.y - start.py, bounds.minY, bounds.maxY),
      };
      offset.current = next;
      apply(el, next);
    };
    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      if (!active) {
        if (Math.hypot(ev.clientX - start.px, ev.clientY - start.py) <= threshold) return;
        suppressClick.current = true;
        begin();
      }
      ev.preventDefault();
      last = { x: ev.clientX, y: ev.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (frame) { cancelAnimationFrame(frame); flush(); }
      el.classList.remove('dragging');
      try { target.releasePointerCapture(pointerId); } catch { /* not captured */ }
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [elRef, apply]);

  const reset = useCallback(() => {
    offset.current = { x: 0, y: 0 };
    const el = elRef.current;
    if (el) apply(el, offset.current);
  }, [elRef, apply]);

  /** Swallow the click that ends a drag (attach as onClickCapture). */
  const onClickCapture = useCallback((e) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Parent resizes (window, sidebar splitter) must not strand the element outside.
  useEffect(() => {
    const el = elRef.current;
    const parent = el && (el.offsetParent || el.parentElement);
    if (!el || !parent) return undefined;
    const ro = new ResizeObserver(() => reclamp());
    ro.observe(parent);
    ro.observe(el);
    return () => ro.disconnect();
  }, [elRef, reclamp]);

  return { startDrag, reclamp, reset, onClickCapture };
}
