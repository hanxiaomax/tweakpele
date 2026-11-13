/** Markdown preview: prose via marked, ```mermaid blocks render live with the current Pele theme. */
import { useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { LuFolderOpen as FolderOpen, LuX as X } from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';
import { usePersistedState } from '../lib.js';
import { markdownSegments } from '../markdown.js';

export default function MarkdownView({ options, onClose, notify }) {
  const [doc, setDoc] = usePersistedState('tweakpele.markdown.v1', null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const openFile = async (file) => {
    if (!file) return;
    setDoc({ name: file.name, text: await file.text() });
    notify(`Opened ${file.name}`);
  };

  const onFileInput = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    openFile(file);
  };

  const segments = useMemo(() => markdownSegments(doc?.text).map((seg) => (
    seg.kind === 'md' ? { ...seg, html: marked.parse(seg.text, { gfm: true }) } : seg
  )), [doc?.text]);

  return (
    <div
      className={'md-view' + (dragging ? ' dragging' : '')}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        openFile(e.dataTransfer.files && e.dataTransfer.files[0]);
      }}
    >
      <header className="md-bar">
        <b className="md-name">{doc ? doc.name : 'Markdown preview'}</b>
        <IconButton Icon={FolderOpen} label="Open Markdown file" onClick={() => fileRef.current?.click()} />
        <IconButton Icon={X} label="Close Markdown preview" onClick={onClose} />
      </header>
      {doc ? (
        <div className="md-body">
          <article className="md-doc">
            {segments.map((seg, i) => seg.kind === 'md'
              ? <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
              : (
                <figure key={i} className="md-diagram">
                  <PeleHost source={seg.source} options={options} lazy />
                </figure>
              ))}
          </article>
        </div>
      ) : (
        <div className="empty md-empty">
          <p>Open or drop a Markdown file — ```mermaid blocks render with your Pele theme.</p>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Open Markdown file</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown" hidden onChange={onFileInput} />
    </div>
  );
}
