import { useCallback, useEffect, useRef, useState } from 'react';

// offsetLeft/offsetTop ignore transforms, so they stay the CSS anchor while dragging.
function clampOffset(el, x, y) {
  const parent = el.offsetParent || el.parentElement;
  if (!parent) return { x, y };
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  return {
    x: clamp(x, -el.offsetLeft, parent.clientWidth - el.offsetWidth - el.offsetLeft),
    y: clamp(y, -el.offsetTop, parent.clientHeight - el.offsetHeight - el.offsetTop),
  };
}

export default function useDragOffset(panelRef) {
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = panelRef.current;
    if (!el) return;
    const start = { px: e.clientX, py: e.clientY, x: offsetRef.current.x, y: offsetRef.current.y };
    setDragging(true);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev) => {
      ev.stopPropagation();
      const next = clampOffset(el, start.x + ev.clientX - start.px, start.y + ev.clientY - start.py);
      offsetRef.current = next;
      el.style.transform = next.x || next.y ? `translate(${next.x}px, ${next.y}px)` : '';
    };
    const onUp = (ev) => {
      ev.stopPropagation();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      setDragging(false);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }, [panelRef]);

  const onDoubleClick = useCallback((e) => {
    e.stopPropagation();
    offsetRef.current = { x: 0, y: 0 };
    const el = panelRef.current;
    if (el) el.style.transform = '';
  }, [panelRef]);

  useEffect(() => {
    const el = panelRef.current;
    const parent = el && (el.offsetParent || el.parentElement);
    if (!el || !parent) return undefined;
    const ro = new ResizeObserver(() => {
      const next = clampOffset(el, offsetRef.current.x, offsetRef.current.y);
      if (next.x !== offsetRef.current.x || next.y !== offsetRef.current.y) {
        offsetRef.current = next;
        el.style.transform = next.x || next.y ? `translate(${next.x}px, ${next.y}px)` : '';
      }
    });
    ro.observe(parent);
    ro.observe(el);
    return () => ro.disconnect();
  }, [panelRef]);

  return {
    handleProps: {
      className: 'panel-drag-handle' + (dragging ? ' dragging' : ''),
      title: 'Drag to move · double-click to reset',
      onPointerDown,
      onDoubleClick,
    },
  };
}
