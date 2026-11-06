import { useEffect, useRef, useState } from 'react';
import { LuArrowLeft as ArrowLeft, LuRotateCcw as RotateCcw, LuClipboardCopy as ClipboardCopy, LuCopy as Copy, LuMaximize as Maximize } from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import C4StylePanel from './C4StylePanel.jsx';
import DiagramTypePanel from './DiagramTypePanel.jsx';
import { IconButton } from './ui.jsx';
import { clamp, detectDiagramType } from '../lib.js';
import { hasTypeSpecificFields } from '../diagramOverrides.js';
import { isC4Source, parseC4Model, selectionFromSvgTarget, applySelectionHighlight } from '../c4.js';

/**
 * Split editor view: left = Mermaid source, right = live Pele preview
 * (Pele native zoom via the mount `zoom` option). Not an overlay — a full view.
 * C4 diagrams get an interactive style panel (UpdateElementStyle / UpdateRelStyle / Layout);
 * other types get a per-diagram type-specific style panel (overrides on the global toolbox).
 */
export default function EditorView({
  diagram, mountOptions, split, onSplitChange,
  onBack, onChangeTitle, onChangeSource, onResetSource, onCopySource, notify,
  onRenderFeedback, vars, styleApi,
}) {
  const [text, setText] = useState(diagram.source);
  const [status, setStatus] = useState(null);   // { info } | { error }
  const [c4Sel, setC4Sel] = useState(null);
  const areaRef = useRef(null);
  const splitRef = useRef(null);
  const previewRef = useRef(null);
  const ctlRef = useRef(null);
  const timerRef = useRef(null);
  const idRef = useRef(diagram.id);

  const c4 = isC4Source(diagram.source);

  // switching diagrams: drop local edits state for the previous one
  if (idRef.current !== diagram.id) {
    idRef.current = diagram.id;
    setText(diagram.source);
    setStatus(null);
    setC4Sel(null);
  }

  // external source changes (reset / restore / C4 panel) land in the textarea unless it's focused
  useEffect(() => {
    if (diagram.source !== text && document.activeElement !== areaRef.current) setText(diagram.source);
  }, [diagram.source]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep SVG selection highlight in sync after re-render
  useEffect(() => {
    if (!c4) return;
    const root = previewRef.current;
    if (!root) return;
    const t = requestAnimationFrame(() => applySelectionHighlight(root, c4Sel));
    return () => cancelAnimationFrame(t);
  }, [c4, c4Sel, diagram.source, status]);

  const applyText = (value, fromInput) => {
    setText(value);
    if (!fromInput) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChangeSource(diagram.id, value), 250);
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onBack(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = e.target;
      e.target.setRangeText('  ', s, en, 'end');
      applyText(e.target.value, true);
    }
  };

  // draggable split (wide screens only — narrow screens stack via CSS)
  const startDrag = (e) => {
    if (!window.matchMedia('(min-width: 981px)').matches) return;
    e.preventDefault();
    const el = splitRef.current;
    if (!el) return;
    const rect = el.parentElement.getBoundingClientRect();
    document.body.classList.add('dragging-split');
    const move = (ev) => {
      const pct = clamp(((ev.clientX - rect.left) / rect.width) * 100, 16, 84);
      onSplitChange(pct);
    };
    const up = () => {
      document.body.classList.remove('dragging-split');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onPreviewClick = (e) => {
    if (!c4) return;
    // Ignore Pele zoom chrome clicks
    if (e.target.closest && e.target.closest('.pele-zoom, button, a, .c4-style-panel, .diagram-style-panel, input, select, label')) return;
    const model = parseC4Model(diagram.source);
    const sel = selectionFromSvgTarget(e.target, model);
    if (sel) {
      e.preventDefault();
      e.stopPropagation();
      setC4Sel(sel);
    }
  };

  const dirty = diagram.source !== diagram.original;

  return (
    <section className="editor-view" aria-label="Diagram editor">
      <header className="editor-bar">
        <IconButton Icon={ArrowLeft} label="Back to gallery (Esc)" onClick={onBack} />
        <input
          className="title-input" value={diagram.title} spellCheck="false"
          aria-label="Diagram title"
          onChange={(e) => onChangeTitle(diagram.id, e.target.value)}
        />
        {dirty && <span className="dirty-dot" title="Edited — source differs from the built-in sample">●</span>}
        <span className={'editor-status' + (status && status.error ? ' error' : '')} aria-live="polite">
          {status ? (status.error ? status.error : status.info) : 'rendering…'}
        </span>
        <span className="editor-actions">
          <IconButton Icon={Maximize} label="Reset preview zoom"
            onClick={() => { try { ctlRef.current?.zoom?.reset(); } catch (_) { /* ignore */ } }} />
          <IconButton Icon={RotateCcw} label="Reset source to original" disabled={!dirty}
            onClick={() => { onResetSource(diagram.id); notify('Source reset'); setC4Sel(null); }} />
          <IconButton Icon={diagram.builtin ? Copy : ClipboardCopy} label="Copy Mermaid source"
            onClick={() => onCopySource(diagram)} />
        </span>
      </header>
      <div className="editor-split" ref={splitRef} style={{ '--split': `${split}%` }}>
        <div className="source-pane">
          <textarea
            ref={areaRef} value={text} spellCheck="false" autoComplete="off" autoCapitalize="off" wrap="off"
            aria-label="Mermaid source"
            onChange={(e) => applyText(e.target.value, true)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="splitter" onPointerDown={startDrag} title="Drag to resize · double-click to reset" onDoubleClick={() => onSplitChange(42)} role="separator" aria-orientation="vertical" />
        <div className={'preview-pane' + (c4 ? ' c4-interactive' : '')} ref={previewRef}
          title={c4 ? 'Click a C4 shape or arrow to edit style · Pele zoom: wheel / pinch' : 'Pele native zoom: wheel / pinch, +− overlay, +/− keys, double-click to fit'}
          onClick={onPreviewClick}
          style={styleApi?.varsStyleFor?.(diagram.id)}
        >
          <PeleHost
            source={diagram.source}
            options={mountOptions}
            bindController={(c) => { ctlRef.current = c; }}
            onResult={(r) => {
              const info = `${r.mermaidType} · ${Math.round(r.width)}×${Math.round(r.height)} px`;
              setStatus({ info });
              onRenderFeedback?.({
                ok: true, diagramId: diagram.id, info,
                mermaidType: r.mermaidType, width: r.width, height: r.height,
              });
              // re-apply highlight after Pele redraw
              requestAnimationFrame(() => applySelectionHighlight(previewRef.current, c4Sel));
            }}
            onError={(e) => {
              const error = String(e && e.message ? e.message : e);
              setStatus({ error });
              onRenderFeedback?.({ ok: false, diagramId: diagram.id, error });
            }}
          />
          {c4 && (
            <C4StylePanel
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
      </div>
    </section>
  );
}
