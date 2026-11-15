import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Icon-only button (React Icons / Lucide). Always labelled for a11y. */
export function IconButton({ Icon, label, onClick, kind, disabled, className, pressed, ...rest }) {
  return (
    <button
      type="button"
      className={'ibtn' + (kind ? ' ' + kind : '') + (className ? ' ' + className : '')}
      title={label} aria-label={label}
      aria-pressed={pressed === undefined ? undefined : !!pressed}
      onClick={onClick} disabled={disabled}
      {...rest}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
    </button>
  );
}

/**
 * Menu anchored to a trigger button (see MenuButton) or at raw coordinates (right-click).
 * `menu` = { x, y, items: [{label, Icon, onClick, danger, disabled} | {sep: true}], trigger? } | null
 */
export function ContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const close = () => {
    // Menu buttons get their focus back; raw right-click menus have no trigger.
    if (menu?.trigger) menu.trigger.focus?.();
    onClose();
  };

  const enabledItems = () =>
    Array.from(ref.current?.querySelectorAll('button.ctxitem:not(:disabled)') || []);

  useEffect(() => {
    if (!menu) return;
    // Ignore presses inside the menu so item onClick can fire (capture would otherwise unmount first).
    // Presses on the trigger are left to the button itself so it can toggle (not reopen).
    const onPointerDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (menu.trigger && menu.trigger.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        // Stop Escape/Tab from also closing the editor sidebar or exiting focus.
        e.preventDefault(); e.stopPropagation();
        close();
        return;
      }
      const items = enabledItems();
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      const move = (n) => { e.preventDefault(); items[n].focus(); };
      if (e.key === 'ArrowDown') move(idx < 0 ? 0 : (idx + 1) % items.length);
      else if (e.key === 'ArrowUp') move(idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length);
      else if (e.key === 'Home') move(0);
      else if (e.key === 'End') move(items.length - 1);
    };
    const onScroll = (e) => {
      if (!ref.current) return;
      if (e.target === document || e.target === document.documentElement) close();
      else if (e.target.contains && e.target.contains(ref.current)) close();
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
    enabledItems()[0]?.focus();
  }, [menu]);

  if (!menu) return null;
  const style = pos?.menu === menu
    ? { left: pos.left, top: pos.top }
    : { left: menu.x, top: menu.y };
  return (
    <div className="ctxmenu" ref={ref} style={style} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) => (it.sep ? (
        <div key={i} role="separator" className="ctxsep" />
      ) : (
        <button
          key={i} type="button" role="menuitem" className={'ctxitem' + (it.danger ? ' danger' : '')}
          disabled={!!it.disabled}
          onClick={() => { close(); it.onClick && it.onClick(); }}
        >
          {it.Icon ? <it.Icon aria-hidden="true" /> : null}<span>{it.label}</span>
        </button>
      )))}
    </div>
  );
}

/** Labeled trigger button opening a ContextMenu anchored below itself. */
export function MenuButton({ Icon, label, items, text, kind, className, disabled }) {
  const btnRef = useRef(null);
  const [menu, setMenu] = useState(null);
  // `items` as a function re-evaluates on open so disabled state stays fresh.
  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({
      x: r.left, y: r.bottom + 4,
      items: typeof items === 'function' ? items() : items,
      trigger: btnRef.current,
    });
  };
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'ibtn' + (kind ? ' ' + kind : '') + (text ? ' menu-btn' : '') + (className ? ' ' + className : '')}
        title={label} aria-label={label}
        aria-haspopup="menu" aria-expanded={!!menu}
        onClick={() => (menu ? setMenu(null) : open())}
        disabled={disabled}
      >
        {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
        {text ? <span>{text}</span> : null}
      </button>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </>
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
