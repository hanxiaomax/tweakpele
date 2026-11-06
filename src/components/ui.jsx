import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Icon-only button (React Icons / Lucide). Always labelled for a11y. */
export function IconButton({ Icon, label, onClick, kind, disabled, className }) {
  return (
    <button
      type="button"
      className={'ibtn' + (kind ? ' ' + kind : '') + (className ? ' ' + className : '')}
      title={label} aria-label={label}
      onClick={onClick} disabled={disabled}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
    </button>
  );
}

/** Right-click menu. `menu` = { x, y, items: [{label, Icon, onClick, danger}] } | null */
export function ContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!menu) return;
    // Ignore presses inside the menu so item onClick can fire (capture would otherwise unmount first).
    const onPointerDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onScroll = (e) => {
      if (!ref.current) return;
      if (e.target === document || e.target === document.documentElement) onClose();
      else if (e.target.contains && e.target.contains(ref.current)) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [menu, onClose]);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const el = ref.current;
    const w = el.offsetWidth || 200;
    const h = el.offsetHeight || (40 + menu.items.length * 30);
    const pad = 8;
    let x = menu.x;
    let y = menu.y;
    // Shift left if overflowing the right edge.
    if (x + w + pad > window.innerWidth) x = Math.max(pad, window.innerWidth - w - pad);
    // Flip above the cursor if overflowing the bottom; never jump solely because y is small.
    if (y + h + pad > window.innerHeight) {
      const above = y - h;
      y = above >= pad ? above : Math.max(pad, window.innerHeight - h - pad);
    }
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    setPos({ menu, left: Math.round(x), top: Math.round(y) });
  }, [menu]);

  if (!menu) return null;
  const style = pos?.menu === menu
    ? { left: pos.left, top: pos.top }
    : { left: menu.x, top: menu.y };
  return (
    <div className="ctxmenu" ref={ref} style={style} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) => (
        <button
          key={i} type="button" role="menuitem" className={'ctxitem' + (it.danger ? ' danger' : '')}
          onClick={() => { onClose(); it.onClick && it.onClick(); }}
        >
          {it.Icon ? <it.Icon aria-hidden="true" /> : null}<span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Modal dialog with Escape / backdrop close. */
export function Dialog({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <b>{title}</b>
          <button type="button" className="ibtn ghost" onClick={onClose} title="Close" aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  return <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">{toast || ''}</div>;
}
