import { LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2, LuPlus as Plus } from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';

function Card({ d, galleryOptions, onOpen, onDuplicate, onDelete, onCardMenu }) {
  const dirty = d.source !== d.original;
  return (
    <article
      className={'card' + (dirty ? ' edited' : '')}
      data-card={d.id}
      onClick={() => onOpen(d.id)}
      onContextMenu={(e) => { e.preventDefault(); onCardMenu(e, d); }}
      title={`Open “${d.title}” in the editor`}
    >
      <header className="card-title">
        <b>{d.title}</b>
        <code>{d.keyword || ''}</code>
        <span className="card-actions" onClick={(e) => e.stopPropagation()}>
          <IconButton Icon={Pencil} label={`Edit ${d.title}`} onClick={() => onOpen(d.id)} />
          <IconButton Icon={Copy} label={`Duplicate ${d.title}`} onClick={() => onDuplicate(d.id)} />
          <IconButton Icon={Trash2} label={`Delete ${d.title}`} kind="danger" onClick={() => onDelete(d.id)} />
        </span>
      </header>
      <div className="card-body">
        <PeleHost source={d.source} options={galleryOptions} />
      </div>
    </article>
  );
}

export default function Gallery({ diagrams, galleryOptions, onOpen, onDuplicate, onDelete, onNew, onCardMenu, onBoardMenu }) {
  return (
    <section
      className="gallery"
      aria-label="Diagram gallery"
      onContextMenu={(e) => {
        if (e.target.closest('[data-card]')) return; // cards open their own menu
        e.preventDefault();
        onBoardMenu(e);
      }}
    >
      {diagrams.length > 0 && (
        <div className="gallery-hint">
          <span>Click a card to edit · right-click a card for actions</span>
          <span>Right-click the empty gallery to create a new diagram</span>
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
        <Card key={d.id} d={d} galleryOptions={galleryOptions}
          onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} onCardMenu={onCardMenu} />
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
