import { useEffect, useLayoutEffect, useRef } from 'react';
import { LuPalette as Palette, LuX as X } from 'react-icons/lu';
import useDragOffset from '../useDragOffset.js';

/**
 * Floating, draggable style panel used by the per-diagram and C4 style editors.
 *
 * Collapsed: a round palette button (click = open, drag = move).
 * Open: a card whose header is the drag handle, with title / hint on the left and
 * the action buttons + close (×) pinned to the top-right corner.
 *
 * The outer <aside> only carries position + drag transform; all visuals live on
 * children so hover / open animations never conflict with the drag transform.
 */
export default function StylePanelShell({
  className, compact = false, open, onOpenChange,
  title, hint, badge = 0, dot = false, actions = null,
  ariaLabel, children,
}) {
  const rootRef = useRef(null);
  const { startDrag, reclamp, reset, onClickCapture } = useDragOffset(rootRef);

  // Size changes on open/close: clamp before paint so the card never flashes off-screen.
  useLayoutEffect(() => { reclamp(); }, [open, reclamp]);

  // Escape must close the panel even when focus is on document.body (the FAB
  // unmounts on click). Capture phase is required so this runs before the
  // bubble-phase shortcut listener in useViewState, which would leave the edit
  // route; stopPropagation keeps that listener from firing. While a popover /
  // menu / modal that owns its own Escape handling is open, let it go first —
  // it registered after us, so it only sees the event if we let it through.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.color-pop, .ctxmenu, .dialog-backdrop, .dialog')) return;
      e.stopPropagation();
      onOpenChange(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onOpenChange]);

  // Native wheel stop: panel scrolling must not pan/zoom the canvas behind it
  // (that listener sits on an ancestor and React stopPropagation is too late).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('wheel', stop);
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const onHeaderPointerDown = (e) => {
    if (e.target.closest('button, input, select, textarea, a')) return;
    startDrag(e, 0);
  };

  return (
    <aside
      ref={rootRef}
      className={`${className} style-dock${compact ? ' compact' : ''}${open ? ' open' : ' collapsed'}`}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!open ? (
        <button
          type="button"
          className="style-panel-fab"
          aria-expanded={false}
          aria-label={`Open ${title}`}
          title={`${title} · click to open · drag to move`}
          onPointerDown={(e) => startDrag(e, 4)}
          onClickCapture={onClickCapture}
          onClick={() => onOpenChange(true)}
        >
          <Palette aria-hidden="true" />
          {badge > 0 && <span className="style-panel-badge">{badge}</span>}
          {!badge && dot && <span className="style-panel-dot" aria-hidden="true" />}
        </button>
      ) : (
        <div className="style-panel-card" role="dialog" aria-label={title}>
          <header
            className="style-panel-header"
            onPointerDown={onHeaderPointerDown}
            onDoubleClick={reset}
            title="Drag to move · double-click to reset position"
          >
            <span className="style-panel-icon" aria-hidden="true"><Palette /></span>
            <span className="style-panel-titles">
              <b>{title}{badge > 0 && <span className="diagram-style-count" title="Per-diagram overrides set">{badge}</span>}</b>
              {hint && <small>{hint}</small>}
            </span>
            <span className="style-panel-actions">
              {actions}
              <button
                type="button"
                className="style-panel-iconbtn"
                title="Close (Esc)"
                aria-label={`Close ${title}`}
                onClick={() => onOpenChange(false)}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          </header>
          <div className="style-panel-body">{children}</div>
        </div>
      )}
    </aside>
  );
}
