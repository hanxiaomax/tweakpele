import { useEffect, useRef, useState } from 'react';
import { LuArrowLeft as ArrowLeft, LuRotateCcw as RotateCcw, LuClipboardCopy as ClipboardCopy, LuCopy as Copy, LuMaximize as Maximize } from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';

/**
 * Split editor view: left = Mermaid source, right = live Pele preview
 * (Pele native zoom via the mount `zoom` option). Not an overlay — a full view.
 */
export default function EditorView({
  diagram, mountOptions, split, onSplitChange,
  onBack, onChangeTitle, onChangeSource, onResetSource, onCopySource, notify,
}) {
  const [text, setText] = useState(diagram.source);
  const [status, setStatus] = useState(null);   // { info } | { error }
  const areaRef = useRef(null);
  const splitRef = useRef(null);
  const ctlRef = useRef(null);
  const timerRef = useRef(null);
  const idRef = useRef(diagram.id);

  // switching diagrams: drop local edits state for the previous one
  if (idRef.current !== diagram.id) {
    idRef.current = diagram.id;
    setText(diagram.source);
    setStatus(null);
  }

  // external source changes (reset / restore) land in the textarea unless it's focused
  useEffect(() => {
    if (diagram.source !== text && document.activeElement !== areaRef.current) setText(diagram.source);
  }, [diagram.source]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const pct = Math.max(16, Math.min(84, ((ev.clientX - rect.left) / rect.width) * 100));
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
            onClick={() => { try { ctlRef.current && ctlRef.current.zoom && ctlRef.current.zoom.reset(); } catch (_) { /* ignore */ } }} />
          <IconButton Icon={RotateCcw} label="Reset source to original" disabled={!dirty}
            onClick={() => { onResetSource(diagram.id); notify('Source reset'); }} />
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
        <div className="preview-pane" title="Pele native zoom: wheel / pinch, +− overlay, +/− keys, double-click to fit">
          <PeleHost
            source={diagram.source}
            options={mountOptions}
            bindController={(c) => { ctlRef.current = c; }}
            onResult={(r) => setStatus({ info: `${r.mermaidType} · ${Math.round(r.width)}×${Math.round(r.height)} px` })}
            onError={(e) => setStatus({ error: String(e && e.message ? e.message : e) })}
          />
        </div>
      </div>
    </section>
  );
}
