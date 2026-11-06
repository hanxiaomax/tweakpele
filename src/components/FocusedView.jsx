import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
  LuMinimize2 as Minimize2,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';

/** Expand a diagram inside the current view, retaining its card chrome. */
export default function FocusedView({
  diagram, options, index, total,
  onClose, onPrev, onNext, onEdit, onDuplicate, onDelete, onMenu,
}) {
  return (
    <article
      className="focused-view"
      aria-label={`Focused diagram: ${diagram.title}`}
      data-card={diagram.id}
      onContextMenu={(e) => {
        if (!onMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onMenu(e, diagram);
      }}
    >
      <header className="focused-view-title">
        <b>{diagram.title}</b>
        <code>{diagram.keyword || ''}</code>
        <span className="focused-view-actions">
          <IconButton Icon={ChevronLeft} label="Previous diagram" onClick={onPrev} disabled={total <= 1} />
          <IconButton Icon={ChevronRight} label="Next diagram" onClick={onNext} disabled={total <= 1} />
          <span className="focused-view-count">{index + 1} / {total}</span>
          <IconButton Icon={Pencil} label={`Edit ${diagram.title}`} onClick={() => onEdit(diagram.id)} />
          <IconButton Icon={Copy} label={`Duplicate ${diagram.title}`} onClick={() => onDuplicate(diagram.id)} />
          <IconButton Icon={Trash2} label={`Delete ${diagram.title}`} kind="danger" onClick={() => onDelete(diagram.id)} />
          <IconButton Icon={Minimize2} label="Exit focus (Esc / F)" onClick={onClose} />
        </span>
      </header>
      <div className="focused-view-body">
        <PeleHost source={diagram.source} options={options} />
      </div>
    </article>
  );
}
