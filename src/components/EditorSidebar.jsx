import { useEffect, useRef, useState } from 'react';
import {
  LuRotateCcw as RotateCcw, LuClipboardCopy as ClipboardCopy, LuCopy as Copy,
  LuDownload as Download, LuLink as Link,
} from 'react-icons/lu';
import { IconButton, MenuButton } from './ui.jsx';
import { errorLine } from '../lib.js';

/**
 * Left source editor inside the focused view: title, Mermaid textarea, render
 * status line, and the source/export/share actions. The live preview is the
 * focused body next to it; render status comes from its PeleHost.
 */
export default function EditorSidebar({
  diagram, status, onClose, notify,
  onChangeTitle, onChangeSource, onResetSource, onCopySource, onCopyMermaidSource,
  onExport, onCopySvg, canCopySvg, onCopyShareLink, onDownloadSnapshot,
}) {
  const [text, setText] = useState(diagram.source);
  const [scrollTop, setScrollTop] = useState(0);
  const [metrics, setMetrics] = useState({ lh: 19.4, pt: 12 });
  const areaRef = useRef(null);
  const timerRef = useRef(null);
  const idRef = useRef(diagram.id);

  // switching diagrams: drop local edits state for the previous one
  if (idRef.current !== diagram.id) {
    idRef.current = diagram.id;
    setText(diagram.source);
  }

  // external source changes (reset / C4 panel) land in the textarea unless it's focused
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

  // line metrics for the gutter and the error band (re-measured on resize)
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return undefined;
    const measure = () => {
      const cs = getComputedStyle(area);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.55;
      setMetrics({ lh, pt: parseFloat(cs.paddingTop) || 0 });
      setScrollTop(area.scrollTop);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // value changes can clamp/reset textarea scroll without firing a scroll event
  useEffect(() => {
    if (areaRef.current) setScrollTop(areaRef.current.scrollTop);
  }, [text]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      // execCommand keeps the insert on the textarea's native undo stack
      if (!document.execCommand('insertText', false, '  ')) {
        const { selectionStart: s, selectionEnd: en } = e.target;
        e.target.setRangeText('  ', s, en, 'end');
      }
      applyText(e.target.value, true);
    }
  };

  const dirty = diagram.source !== diagram.original;
  const empty = !diagram.source || !diagram.source.trim();

  const errMsg = status && status.error ? status.error : null;
  const errLine = errMsg ? errorLine(errMsg) : null;

  return (
    <aside className="editor-sidebar" aria-label="Diagram source editor">
      <div className="editor-sidebar-head">
        <input
          className="title-input" value={diagram.title} spellCheck="false"
          aria-label="Diagram title"
          onChange={(e) => onChangeTitle(diagram.id, e.target.value)}
        />
        {dirty && <span className="dirty-dot" title="Edited — source differs from the built-in sample">●</span>}
      </div>
      <div className="editor-area" style={{ '--line-h': `${metrics.lh}px` }}>
        <div className="editor-gutter" aria-hidden="true">
          <div className="editor-gutter-inner" style={{ transform: `translateY(${-scrollTop}px)` }}>
            {Array.from({ length: text.split('\n').length }, (_, i) => (
              <div key={i} className={i + 1 === errLine ? 'err' : undefined}>{i + 1}</div>
            ))}
          </div>
        </div>
        <div className="editor-text-wrap">
          {errLine != null && (
            <div
              className="editor-error-band"
              style={{ top: metrics.pt + (errLine - 1) * metrics.lh - scrollTop, height: metrics.lh }}
            />
          )}
          <textarea
            ref={areaRef} value={text} spellCheck="false" autoComplete="off" autoCapitalize="off" wrap="off"
            aria-label="Mermaid source"
            onChange={(e) => applyText(e.target.value, true)}
            onKeyDown={onKeyDown}
            onScroll={(e) => setScrollTop(e.target.scrollTop)}
          />
        </div>
      </div>
      <div className="editor-sidebar-foot">
        <span className="editor-status" aria-live="polite">
          {empty ? 'Empty' : status ? (status.info || '') : 'rendering…'}
        </span>
        <span className="editor-actions">
          <IconButton Icon={RotateCcw} label="Reset source to original" disabled={!dirty}
            onClick={() => { onResetSource(diagram.id); notify('Source reset'); }} />
          <MenuButton Icon={diagram.builtin ? Copy : ClipboardCopy} text="Copy" label="Copy source" items={() => [
            { label: 'Copy Mermaid source', Icon: Copy, onClick: () => onCopySource(diagram) },
            { label: 'Copy source with Mermaid theme', Icon: ClipboardCopy, onClick: () => onCopyMermaidSource?.(diagram) },
          ]} />
          <MenuButton Icon={Download} text="Export" label="Export and share" items={() => [
            { label: 'Download PNG', onClick: () => onExport('png', true) },
            { label: 'Download PNG (transparent)', onClick: () => onExport('png', false) },
            { sep: true },
            { label: 'Copy SVG', Icon: Copy, disabled: !canCopySvg, onClick: onCopySvg },
            { label: 'Download SVG', onClick: () => onExport('svg', true) },
            { label: 'Download SVG (transparent)', onClick: () => onExport('svg', false) },
            { sep: true },
            { label: 'Copy share link', Icon: Link, onClick: () => onCopyShareLink?.() },
            { label: 'Download snapshot', Icon: Download, onClick: () => onDownloadSnapshot?.() },
          ]} />
        </span>
      </div>
    </aside>
  );
}
