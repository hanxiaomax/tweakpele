import { useEffect, useRef } from 'react';

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
  useEffect(() => {
    if (!menu) return;
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onScroll = (e) => { if (ref.current && e.target.contains && e.target.contains(ref.current)) onClose(); };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [menu, onClose]);
  if (!menu) return null;
  const clamp = (v, sz, total) => Math.max(8, Math.min(v - sz - 8 > 0 ? v : total - sz - 8, total - sz - 8));
  const style = {
    left: 0, top: 0,
    transform: `translate(${Math.round(clamp(menu.x, 200, innerWidth))}px, ${Math.round(clamp(menu.y, 40 + menu.items.length * 30, innerHeight))}px)`,
  };
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
