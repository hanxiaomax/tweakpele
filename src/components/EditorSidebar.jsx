import { useEffect, useRef, useState } from 'react';
import {
  LuRotateCcw as RotateCcw, LuClipboardCopy as ClipboardCopy, LuCopy as Copy,
  LuDownload as Download, LuShare2 as Share2, LuLink as Link, LuFolderOpen as FolderOpen,
} from 'react-icons/lu';
import { ContextMenu, IconButton } from './ui.jsx';

/**
 * Left source editor inside the focused view: title, Mermaid textarea, render
 * status line, and the source/export/share actions. The live preview is the
 * focused body next to it; render status comes from its PeleHost.
 */
export default function EditorSidebar({
  diagram, status, onClose, notify,
  onChangeTitle, onChangeSource, onResetSource, onCopySource,
  onExport, onCopyShareLink, onDownloadSnapshot, onOpenSnapshot,
}) {
  const [text, setText] = useState(diagram.source);
  const [exportMenu, setExportMenu] = useState(null);
  const [shareMenu, setShareMenu] = useState(null);
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

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = e.target;
      e.target.setRangeText('  ', s, en, 'end');
      applyText(e.target.value, true);
    }
  };

  const openExportMenu = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setExportMenu({
      x: rect.left,
      y: rect.bottom + 4,
      items: [
        { label: 'PNG', onClick: () => onExport('png', true) },
        { label: 'PNG (transparent)', onClick: () => onExport('png', false) },
        { label: 'SVG', onClick: () => onExport('svg', true) },
        { label: 'SVG (transparent)', onClick: () => onExport('svg', false) },
      ],
    });
  };

  const openShareMenu = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setShareMenu({
      x: rect.left,
      y: rect.bottom + 4,
      items: [
        { label: 'Copy share link', Icon: Link, onClick: () => onCopyShareLink?.() },
        { label: 'Download snapshot', Icon: Download, onClick: () => onDownloadSnapshot?.() },
        { label: 'Open snapshot file', Icon: FolderOpen, onClick: () => onOpenSnapshot?.() },
      ],
    });
  };

  const dirty = diagram.source !== diagram.original;
  const empty = !diagram.source || !diagram.source.trim();

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
      <textarea
        ref={areaRef} value={text} spellCheck="false" autoComplete="off" autoCapitalize="off" wrap="off"
        aria-label="Mermaid source"
        onChange={(e) => applyText(e.target.value, true)}
        onKeyDown={onKeyDown}
      />
      <div className="editor-sidebar-foot">
        <span className={'editor-status' + (status && status.error ? ' error' : '')} aria-live="polite">
          {empty ? 'Empty' : status ? (status.error ? status.error : status.info) : 'rendering…'}
        </span>
        <span className="editor-actions">
          <IconButton Icon={RotateCcw} label="Reset source to original" disabled={!dirty}
            onClick={() => { onResetSource(diagram.id); notify('Source reset'); }} />
          <IconButton Icon={diagram.builtin ? Copy : ClipboardCopy} label="Copy Mermaid source"
            onClick={() => onCopySource(diagram)} />
          <IconButton Icon={Download} label="Export image" onClick={openExportMenu} />
          <IconButton Icon={Share2} label="Share snapshot" onClick={openShareMenu} />
        </span>
      </div>
      <ContextMenu menu={exportMenu} onClose={() => setExportMenu(null)} />
      <ContextMenu menu={shareMenu} onClose={() => setShareMenu(null)} />
    </aside>
  );
}
