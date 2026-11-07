import { memo, useEffect, useRef } from 'react';
import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2, LuPlus as Plus, LuFocus as Focus,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';
import { clamp } from '../lib.js';

const COL_MIN = 1;
const COL_MAX = 6;
/** Wheel delta accumulated before stepping one column (trackpad-friendly). */
const WHEEL_STEP = 90;

const Card = memo(function Card({
  d, optionsFor, styleApi,
  onOpen, onDuplicate, onDelete, onFocus, onCardMenu,
}) {
  const dirty = d.source !== d.original;

  return (
    <article
      className={'card' + (dirty ? ' edited' : '')}
      data-card={d.id}
      onClick={() => onFocus(d.id)}
      onContextMenu={(e) => { e.preventDefault(); onCardMenu(e, d); }}
      title={`Focus “${d.title}”`}
    >
      <header className="card-title">
        <b>{d.title}</b>
        <code>{d.keyword || ''}</code>
        <span className="card-actions" onClick={(e) => e.stopPropagation()}>
          <IconButton Icon={Focus} label={`Focus ${d.title}`} onClick={() => onFocus(d.id)} />
          <IconButton Icon={Pencil} label={`Edit ${d.title}`} onClick={() => onOpen(d.id)} />
          <IconButton Icon={Copy} label={`Duplicate / Save as ${d.title}`} onClick={() => onDuplicate(d.id)} />
          <IconButton Icon={Trash2} label={`Delete ${d.title}`} kind="danger" onClick={() => onDelete(d.id)} />
        </span>
      </header>
      <div className="card-body" style={styleApi?.varsStyleFor?.(d.id)}>
        <PeleHost source={d.source} options={optionsFor(d.id)} lazy />
      </div>
    </article>
  );
});

/**
 * Gallery grid. Column density via Ctrl+wheel (1–6).
 * At cols=1 App auto-enters FocusedView (slide carousel) — this grid stays underneath.
 */
export default function Gallery({
  diagrams, optionsFor, styleApi,
  cols, onColsChange,
  onOpen, onDuplicate, onDelete, onNew, onFocus, onFocusPrev, onFocusNext,
  onCardMenu, onBoardMenu,
}) {
  const rootRef = useRef(null);
  const wheelAcc = useRef(0);
  const single = cols === 1;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      if (e.target.closest && e.target.closest('input, textarea, select, button, a, .diagram-style-panel')) return;
      const dy = e.deltaY;
      if (!dy) return;
      e.preventDefault();
      wheelAcc.current += dy;
      while (wheelAcc.current <= -WHEEL_STEP) {
        wheelAcc.current += WHEEL_STEP;
        onColsChange((c) => clamp(c - 1, COL_MIN, COL_MAX));
      }
      while (wheelAcc.current >= WHEEL_STEP) {
        wheelAcc.current -= WHEEL_STEP;
        onColsChange((c) => clamp(c + 1, COL_MIN, COL_MAX));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onColsChange]);

  return (
    <section
      ref={rootRef}
      className="gallery"
      aria-label="Diagram gallery"
      data-cols={cols}
      style={{ '--gallery-cols': Math.max(cols, 2) }}
      onContextMenu={(e) => {
        if (e.target.closest('[data-card]')) return;
        e.preventDefault();
        onBoardMenu(e);
      }}
    >
      {diagrams.length > 0 && (
        <div className="gallery-carousel" onClick={(e) => e.stopPropagation()}>
          <IconButton Icon={ChevronLeft} label="Previous diagram" onClick={onFocusPrev} />
          <IconButton Icon={ChevronRight} label="Next diagram" onClick={onFocusNext} />
          <span className="muted">
            {single
              ? `${diagrams.length} diagrams · 1×1 focus · Ctrl+wheel for grid`
              : `${diagrams.length} diagrams · ${cols} cols · Ctrl+wheel density · click to focus`}
          </span>
        </div>
      )}
      {diagrams.length > 0 && (
        <div className="gallery-hint">
          <span>
            {single
              ? '1×1 opens focus (slide ←/→) · Ctrl+wheel returns to grid'
              : 'Ctrl+wheel zooms columns · click a card for the same focus UI as 1×1'}
          </span>
          <span>Right-click empty space to create · Duplicate / Save as from the card menu</span>
        </div>
      )}
      {diagrams.length === 0 && (
        <div className="empty">
          <p>No diagrams yet.</p>
          <p><button type="button" className="btn" onClick={onNew}>New diagram…</button></p>
          <p className="muted">Right-click the empty gallery to create one, or restore the built-in samples from the top bar.</p>
        </div>
      )}
      {/* At cols=1 FocusedView covers this; keep a dormant multi-col layout underneath. */}
      {!single && diagrams.map((d) => (
        <Card
          key={d.id} d={d} optionsFor={optionsFor} styleApi={styleApi}
          onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete}
          onFocus={onFocus} onCardMenu={onCardMenu}
        />
      ))}
      {!single && diagrams.length > 0 && (
        <button type="button" className="card new-card" onClick={onNew} title="New diagram">
          <Plus aria-hidden="true" />
          <span>New diagram</span>
        </button>
      )}
      {single && diagrams.length > 0 && (
        <div className="gallery-1x1-placeholder" aria-hidden="true">
          Focused view active
        </div>
      )}
    </section>
  );
}

