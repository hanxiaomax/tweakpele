import { useEffect, useRef, useState } from 'react';
import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
  LuMinimize2 as Minimize2, LuMaximize2 as Maximize,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import C4StylePanel from './C4StylePanel.jsx';
import { IconButton } from './ui.jsx';
import { isC4Source, parseC4Model, selectionFromSvgTarget, applySelectionHighlight } from '../c4.js';

/** Expand a diagram inside the current view, retaining its card chrome. */
export default function FocusedView({
  diagram, options, index, total,
  onClose, onPrev, onNext, onEdit, onDuplicate, onDelete, onMenu,
  onChangeSource,
}) {
  const ctlRef = useRef(null);
  const bodyRef = useRef(null);
  const [c4Sel, setC4Sel] = useState(null);
  const c4 = isC4Source(diagram.source);

  useEffect(() => { setC4Sel(null); }, [diagram.id]);

  useEffect(() => {
    if (!c4) return;
    const root = bodyRef.current;
    if (!root) return;
    const t = requestAnimationFrame(() => applySelectionHighlight(root, c4Sel));
    return () => cancelAnimationFrame(t);
  }, [c4, c4Sel, diagram.source]);

  const onBodyClick = (e) => {
    if (!c4 || !onChangeSource) return;
    if (e.target.closest && e.target.closest('.pele-zoom, button, a, .c4-style-panel')) return;
    const model = parseC4Model(diagram.source);
    const sel = selectionFromSvgTarget(e.target, model);
    if (sel) {
      e.preventDefault();
      e.stopPropagation();
      setC4Sel(sel);
    }
  };

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
          <IconButton Icon={Maximize} label="Reset Pele zoom"
            onClick={() => { try { ctlRef.current?.zoom?.reset(); } catch (_) { /* ignore */ } }} />
          <IconButton Icon={Pencil} label={`Edit ${diagram.title}`} onClick={() => onEdit(diagram.id)} />
          <IconButton Icon={Copy} label={`Duplicate ${diagram.title}`} onClick={() => onDuplicate(diagram.id)} />
          <IconButton Icon={Trash2} label={`Delete ${diagram.title}`} kind="danger" onClick={() => onDelete(diagram.id)} />
          <IconButton Icon={Minimize2} label="Exit focus (Esc / F)" onClick={onClose} />
        </span>
      </header>
      <div
        className={'focused-view-body' + (c4 ? ' c4-interactive' : '')}
        ref={bodyRef}
        title={c4 ? 'Click a C4 shape or arrow to edit colors · Pele zoom: wheel / pinch' : 'Pele native zoom: wheel / pinch, +/− overlay, +/− keys, double-click to fit'}
        onClick={onBodyClick}
      >
        <PeleHost
          source={diagram.source}
          options={options}
          bindController={(c) => { ctlRef.current = c; }}
          onResult={() => {
            requestAnimationFrame(() => applySelectionHighlight(bodyRef.current, c4Sel));
          }}
        />
        {c4 && onChangeSource && (
          <C4StylePanel
            compact
            source={diagram.source}
            selection={c4Sel}
            onSelect={setC4Sel}
            onChangeSource={(next) => onChangeSource(diagram.id, next)}
          />
        )}
      </div>
    </article>
  );
}
