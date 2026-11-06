import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
  LuMaximize2 as Maximize2,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';

/**
 * Fullscreen card-style preview for the focused diagram.
 * Keeps chrome (title bar + border); does not enter edit mode.
 */
export default function FocusOverlay({
  diagram, options, index, total,
  onClose, onPrev, onNext, onEdit, onDuplicate, onDelete, onMenu,
}) {
  if (!diagram) return null;

  return (
    <div
      className="focus-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Focus ${diagram.title}`}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="focus-overlay-panel"
        data-card={diagram.id}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMenu && onMenu(e, diagram);
        }}
      >
        <header className="focus-overlay-title">
          <b>{diagram.title}</b>
          <code>{diagram.keyword || ''}</code>
          <span className="focus-overlay-actions">
            <IconButton Icon={ChevronLeft} label="Previous diagram" onClick={onPrev} disabled={total <= 1} />
            <IconButton Icon={ChevronRight} label="Next diagram" onClick={onNext} disabled={total <= 1} />
            <span className="muted focus-overlay-count">{index + 1} / {total}</span>
            <IconButton Icon={Pencil} label={`Edit ${diagram.title}`} onClick={() => onEdit(diagram.id)} />
            <IconButton Icon={Copy} label={`Duplicate ${diagram.title}`} onClick={() => onDuplicate(diagram.id)} />
            <IconButton Icon={Trash2} label={`Delete ${diagram.title}`} kind="danger" onClick={() => onDelete(diagram.id)} />
            <IconButton Icon={Maximize2} label="Close focus" onClick={onClose} />
          </span>
        </header>
        <div className="focus-overlay-body">
          <PeleHost source={diagram.source} options={options} />
        </div>
      </div>
    </div>
  );
}
