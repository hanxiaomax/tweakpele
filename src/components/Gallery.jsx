import { memo, useEffect, useRef } from 'react';
import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2, LuPlus as Plus, LuFocus as Focus,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight, LuMaximize2 as Maximize2,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';

const Card = memo(function Card({ d, galleryOptions, focused, onOpen, onDuplicate, onDelete, onFocus, onCardMenu }) {
  const dirty = d.source !== d.original;
  const ref = useRef(null);

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [focused]);

  return (
    <article
      ref={ref}
      className={'card' + (dirty ? ' edited' : '') + (focused ? ' focused' : '')}
      data-card={d.id}
      onClick={() => onFocus(d.id)}
      onDoubleClick={() => onOpen(d.id)}
      onContextMenu={(e) => { e.preventDefault(); onCardMenu(e, d); }}
      title={`Focus “${d.title}” · double-click to edit`}
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
      <div className="card-body">
        <PeleHost source={d.source} options={galleryOptions} lazy />
      </div>
    </article>
  );
});

export default function Gallery({
  diagrams, galleryOptions, focusedId,
  onOpen, onDuplicate, onDelete, onNew, onFocus, onClearFocus, onFocusPrev, onFocusNext,
  onCardMenu, onBoardMenu,
}) {
  const idx = diagrams.findIndex((d) => d.id === focusedId);
  const focused = idx >= 0 ? diagrams[idx] : null;

  return (
    <section
      className={'gallery' + (focusedId ? ' focus-mode' : '')}
      aria-label="Diagram gallery"
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
          <IconButton Icon={Maximize2} label="Clear focus / show all" onClick={onClearFocus} disabled={!focusedId} />
          <span className="muted">
            {focusedId ? `${idx + 1} / ${diagrams.length} · ${focused?.title || ''}` : `${diagrams.length} diagrams · click to focus`}
          </span>
        </div>
      )}
      {diagrams.length > 0 && (
        <div className="gallery-hint">
          <span>Click a card to focus · double-click to edit · ←/→ prev/next</span>
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
      {diagrams.map((d) => (
        <Card
          key={d.id} d={d} galleryOptions={galleryOptions} focused={focusedId === d.id}
          onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete}
          onFocus={onFocus} onCardMenu={onCardMenu}
        />
      ))}
      {diagrams.length > 0 && (
        <button type="button" className="card new-card" onClick={onNew} title="New diagram">
          <Plus aria-hidden="true" />
          <span>New diagram</span>
        </button>
      )}
    </section>
  );
}
