import { memo } from 'react';
import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2, LuPlus as Plus, LuFocus as Focus,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';

const Card = memo(function Card({ d, galleryOptions, onOpen, onDuplicate, onDelete, onFocus, onCardMenu }) {
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
      <div className="card-body">
        <PeleHost source={d.source} options={galleryOptions} lazy />
      </div>
    </article>
  );
});

export default function Gallery({
  diagrams, galleryOptions,
  onOpen, onDuplicate, onDelete, onNew, onFocus, onFocusPrev, onFocusNext,
  onCardMenu, onBoardMenu,
}) {
  return (
    <section
      className="gallery"
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
          <span className="muted">
            {`${diagrams.length} diagrams · click to focus`}
          </span>
        </div>
      )}
      {diagrams.length > 0 && (
        <div className="gallery-hint">
          <span>Click a card to focus · Pele zoom in focus · ←/→ prev/next · Esc/F exit</span>
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
          key={d.id} d={d} galleryOptions={galleryOptions}
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
