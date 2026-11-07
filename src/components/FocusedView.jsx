import { useEffect, useRef, useState } from 'react';
import {
  LuPencil as Pencil, LuCopy as Copy, LuTrash2 as Trash2,
  LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight,
  LuMinimize2 as Minimize2, LuMaximize2 as Maximize,
} from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import C4StylePanel from './C4StylePanel.jsx';
import DiagramTypePanel from './DiagramTypePanel.jsx';
import { IconButton } from './ui.jsx';
import { detectDiagramType } from '../lib.js';
import { hasTypeSpecificFields } from '../diagramOverrides.js';
import { isC4Source, parseC4Model, selectionFromSvgTarget, applySelectionHighlight } from '../c4.js';

const WHEEL_STEP = 90;

/** Expand a diagram inside the current view (same UI for click-focus and gallery 1×1). */
export default function FocusedView({
  diagram, options, index, total, slideDir = 0,
  onClose, onPrev, onNext, onEdit, onDuplicate, onDelete, onMenu,
  onChangeSource, vars, styleApi,
  /** When set, Ctrl+wheel adjusts gallery column density (1×1 ↔ grid). */
  onCtrlWheelCols,
  /** Plain wheel steps prev/next only in gallery 1×1 (Pele keeps wheel zoom otherwise). */
  enableSlideWheel = false,
}) {
  const ctlRef = useRef(null);
  const bodyRef = useRef(null);
  const rootRef = useRef(null);
  const slideAcc = useRef(0);
  const colsAcc = useRef(0);
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

  // Plain wheel → prev/next slide; Ctrl+wheel → gallery density (when provided).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select, button, a, .diagram-style-panel, .c4-style-panel, .pele-zoom')) {
        // Still allow Ctrl+wheel density over chrome except form fields
        if (!(e.ctrlKey && onCtrlWheelCols) || e.target.closest('input, textarea, select')) return;
      }
      const dy = e.deltaY;
      if (!dy) return;

      if (e.ctrlKey && onCtrlWheelCols) {
        e.preventDefault();
        e.stopPropagation();
        colsAcc.current += dy;
        while (colsAcc.current <= -WHEEL_STEP) {
          colsAcc.current += WHEEL_STEP;
          onCtrlWheelCols(-1);
        }
        while (colsAcc.current >= WHEEL_STEP) {
          colsAcc.current -= WHEEL_STEP;
          onCtrlWheelCols(1);
        }
        return;
      }

      // Plain wheel → slides only in gallery 1×1; otherwise leave wheel to Pele zoom.
      if (!enableSlideWheel) return;
      if (Math.abs(dy) < 8) return;
      e.preventDefault();
      e.stopPropagation();
      slideAcc.current += dy;
      while (slideAcc.current <= -WHEEL_STEP) {
        slideAcc.current += WHEEL_STEP;
        onPrev();
      }
      while (slideAcc.current >= WHEEL_STEP) {
        slideAcc.current -= WHEEL_STEP;
        onNext();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [onPrev, onNext, onCtrlWheelCols, enableSlideWheel]);

  const onBodyClick = (e) => {
    if (!c4 || !onChangeSource) return;
    if (e.target.closest && e.target.closest('.pele-zoom, button, a, .c4-style-panel, .diagram-style-panel')) return;
    const model = parseC4Model(diagram.source);
    const sel = selectionFromSvgTarget(e.target, model);
    if (sel) {
      e.preventDefault();
      e.stopPropagation();
      setC4Sel(sel);
    }
  };

  const slideClass = slideDir > 0 ? ' slide-next' : slideDir < 0 ? ' slide-prev' : '';

  return (
    <article
      ref={rootRef}
      className={'focused-view' + slideClass}
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
        title={c4
          ? 'Click a C4 shape or arrow to edit style · wheel: prev/next · Ctrl+wheel: grid density · Pele pinch / +/− zoom'
          : 'Wheel: prev/next slide · Ctrl+wheel: grid density · Pele pinch / +/− overlay to zoom'}
        onClick={onBodyClick}
        style={styleApi?.varsStyleFor?.(diagram.id)}
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
            vars={vars}
          />
        )}
        {!c4 && styleApi && (() => {
          const type = detectDiagramType(diagram.source, diagram.keyword);
          if (!type || !hasTypeSpecificFields(type)) return null;
          return (
            <DiagramTypePanel
              compact
              diagramType={type}
              globalVars={styleApi.globalVars}
              globalOptVals={styleApi.globalOptVals}
              override={styleApi.overrides[diagram.id]}
              onChangeOpt={(optId, v) => styleApi.setOpt(diagram.id, optId, v)}
              onChangeVar={(name, v) => styleApi.setVar(diagram.id, name, v)}
              onResetAll={() => styleApi.resetAll(diagram.id)}
            />
          );
        })()}
      </div>
    </article>
  );
}
