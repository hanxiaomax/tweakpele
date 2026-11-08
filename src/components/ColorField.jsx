import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v || '').trim());
function expandHex(hex) {
  const h = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
  return h || '#888888';
}

const VAR_REF_RE = /^var\(\s*(--pele-[\w-]+)\s*\)$/i;
function parseVarRef(value) {
  const m = String(value || '').trim().match(VAR_REF_RE);
  return m ? m[1] : null;
}

export default function ColorField({
  label, value, onChange, onClear, paletteTokens, overridden = false, clearDisabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const selectedToken = parseVarRef(value);
  const tokenValue = selectedToken
    ? paletteTokens?.find((t) => t.name === selectedToken)?.value
    : null;
  const hex = isHexColor(value) ? expandHex(value) : '#888888';
  const swatchBg = isHexColor(value) ? hex : (tokenValue || '');
  const empty = !swatchBg;

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const { offsetWidth: pw, offsetHeight: ph } = popRef.current;
    let left = Math.min(r.right + 6, window.innerWidth - pw - 8);
    let top = r.top - ph - 6;
    if (top < 8) top = Math.min(r.bottom + 6, window.innerHeight - ph - 8);
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const el = popRef.current;
    const stopWheel = (e) => e.stopPropagation();
    if (el) el.addEventListener('wheel', stopWheel);
    const onPointerDown = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      if (el) el.removeEventListener('wheel', stopWheel);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <div className={'c4-color-field' + (overridden ? ' set' : '')}>
      <span className="c4-field-label">{label}</span>
      <div className="c4-color-row">
        <button
          ref={btnRef}
          type="button"
          className={'c4-color-trigger' + (empty ? ' empty' : '')}
          title="Pick color"
          aria-label={`Pick ${label} color`}
          aria-expanded={open}
          style={empty ? undefined : { background: swatchBg }}
          onClick={() => { setOpen((o) => !o); setPos(null); }}
        />
        <span className="c4-color-value">{value || ''}</span>
        <button type="button" className="ibtn ghost tiny" title={`Clear ${label}`} aria-label={`Clear ${label}`}
          onClick={onClear} disabled={clearDisabled}>✕</button>
      </div>
      {open && createPortal(
        <div
          ref={popRef}
          className="color-pop"
          style={pos ? pos : { left: -9999, top: -9999, visibility: 'hidden' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="c4-color-controls">
            <input
              type="color"
              aria-label={`${label} color`}
              value={hex}
              onChange={(e) => onChange(e.target.value)}
            />
            <input
              type="text"
              spellCheck="false"
              autoComplete="off"
              placeholder="#hex or var(--pele-…)"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
          {paletteTokens && paletteTokens.length > 0 && (
            <div className="c4-palette-swatches" role="list" aria-label={`${label} palette tokens`}>
              {paletteTokens.map((tok) => {
                const active = selectedToken === tok.name;
                return (
                  <button
                    key={tok.name}
                    type="button"
                    role="listitem"
                    className={'c4-swatch' + (active ? ' active' : '')}
                    title={`${tok.label} · ${tok.name}`}
                    aria-label={`Use ${tok.name}`}
                    aria-pressed={active}
                    style={{ background: tok.value || '#888' }}
                    onClick={() => onChange(`var(${tok.name})`)}
                  />
                );
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
