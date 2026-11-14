/** Markdown preview: sanitized prose via marked, ```mermaid blocks render live with the current Pele theme. */
import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { LuCopy as Copy, LuFolderOpen as FolderOpen, LuX as X } from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';
import { copyText, usePersistedState } from '../lib.js';
import { markdownSegments } from '../markdown.js';
import { renderStockMermaid } from '../stockMermaid.js';

const SANITIZE_CONFIG = { USE_PROFILES: { html: true } };

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const VIEWS = ['pele', 'mermaid', 'svg', 'compare'];
const VIEW_LABELS = { pele: 'Pele', mermaid: 'Mermaid', svg: 'SVG', compare: 'Compare' };

/** One ```mermaid card: Pele render plus the playground's Pele / Mermaid / SVG / Compare switch. */
function MdDiagram({ source, options, mermaidTheme, notify }) {
  const [view, setView] = useState('pele');
  const [peleSvg, setPeleSvg] = useState('');
  const [stock, setStock] = useState({ svg: '', error: '' });
  const needsStock = view === 'mermaid' || view === 'compare';

  useEffect(() => {
    if (!needsStock) return;
    let cancelled = false;
    setStock({ svg: '', error: '' });
    renderStockMermaid(source, mermaidTheme)
      .then((svg) => { if (!cancelled) setStock({ svg, error: '' }); })
      .catch((err) => { if (!cancelled) setStock({ svg: '', error: err?.message || String(err) }); });
    return () => { cancelled = true; };
  }, [needsStock, source, mermaidTheme]);

  const onCopy = async () => {
    const ok = await copyText(peleSvg);
    notify(ok ? 'Copied SVG' : 'Copy failed');
  };

  const mermaidBody = stock.error
    ? <div className="md-diagram-error">{stock.error}</div>
    : stock.svg
      ? <div className="md-mermaid" dangerouslySetInnerHTML={{ __html: stock.svg }} />
      : <div>Loading Mermaid…</div>;

  return (
    <figure className="md-diagram" data-view={view}>
      <div className="md-diagram-bar">
        <div className="md-views" role="group" aria-label="Output view">
          {VIEWS.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <IconButton Icon={Copy} label="Copy SVG" onClick={onCopy} disabled={!peleSvg} />
      </div>
      {view === 'pele' && <PeleHost source={source} options={options} lazy onResult={(r) => setPeleSvg(r.svg)} />}
      {view === 'mermaid' && mermaidBody}
      {view === 'svg' && <pre className="md-svg"><code>{peleSvg}</code></pre>}
      {view === 'compare' && (
        <div className="md-compare">
          <figure>
            <figcaption>Pele</figcaption>
            <PeleHost source={source} options={options} lazy onResult={(r) => setPeleSvg(r.svg)} />
          </figure>
          <figure>
            <figcaption>Mermaid</figcaption>
            {mermaidBody}
          </figure>
        </div>
      )}
    </figure>
  );
}

export default function MarkdownView({ options, onClose, notify, mermaidTheme }) {
  const [doc, setDoc] = usePersistedState('tweakpele.markdown.v1', null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  const onDocClick = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    let id;
    try {
      id = decodeURIComponent(a.getAttribute('href').slice(1));
    } catch {
      return;
    }
    docRef.current?.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth' });
  };

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
    seg.kind === 'md' ? { ...seg, html: DOMPurify.sanitize(marked.parse(seg.text, { gfm: true }), SANITIZE_CONFIG) } : seg
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
          <article ref={docRef} className="md-doc" onClick={onDocClick}>
            {segments.map((seg, i) => seg.kind === 'md'
              ? <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
              : <MdDiagram key={i} source={seg.source} options={options} mermaidTheme={mermaidTheme} notify={notify} />)}
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
