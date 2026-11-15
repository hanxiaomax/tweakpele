/** The Pele playground's output switch (Pele / Mermaid / SVG / Compare) for a single diagram. */
import { useEffect, useState } from 'react';
import { LuCopy as Copy } from 'react-icons/lu';
import PeleHost from './PeleHost.jsx';
import { IconButton } from './ui.jsx';
import { copyText } from '../lib.js';
import { renderStockMermaid } from '../stockMermaid.js';
import { isDarkBackground, isDarkComposite } from '../mermaidConfig.js';

const VIEWS = ['pele', 'mermaid', 'svg', 'compare'];
const VIEW_LABELS = { pele: 'Pele', mermaid: 'Mermaid', svg: 'SVG', compare: 'Compare' };

/** View + Pele SVG state for one diagram; resets when the diagram (resetKey) changes. */
export function useDiagramViews({ source, bg, surface, notify, resetKey }) {
  const [view, setView] = useState('pele');
  const [peleSvg, setPeleSvg] = useState('');
  const [stock, setStock] = useState({ svg: '', error: '' });
  const needsStock = view === 'mermaid' || view === 'compare';
  // Switch ink follows the focused title bar (surface 92% over bg), not the diagram bg.
  const tone = isDarkComposite(surface || bg, bg) ? 'dark' : 'light';

  useEffect(() => {
    setView('pele');
    setPeleSvg('');
  }, [resetKey]);

  // Stock Mermaid is only loaded on first switch away from Pele.
  useEffect(() => {
    if (!needsStock) return;
    let cancelled = false;
    setStock({ svg: '', error: '' });
    renderStockMermaid(source, isDarkBackground(bg) ? 'dark' : 'default')
      .then((svg) => { if (!cancelled) setStock({ svg, error: '' }); })
      .catch((err) => { if (!cancelled) setStock({ svg: '', error: err?.message || String(err) }); });
    return () => { cancelled = true; };
  }, [needsStock, source, bg]);

  const copySvg = async () => {
    const ok = await copyText(peleSvg);
    notify(ok ? 'Copied SVG' : 'Copy failed');
  };

  return { view, setView, peleSvg, setPeleSvg, stock, tone, copySvg };
}

/** Segmented view buttons plus Copy SVG (copies the Pele output, like the playground). */
export function DiagramViewSwitch({ view, onChange, onCopy, canCopy, tone }) {
  return (
    <div className="diagram-views-bar" data-tone={tone}>
      <div className="diagram-views" role="group" aria-label="Output view">
        {VIEWS.map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => onChange(v)}>
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
      <IconButton Icon={Copy} label="Copy SVG" onClick={onCopy} disabled={!canCopy} />
    </div>
  );
}

/** The non-Pele panes; the Pele pane stays in the host view so its interactions are untouched. */
export function DiagramAltBody({ view, source, options, peleSvg, onPeleSvg, stock }) {
  if (view === 'pele') return null;

  const mermaidBody = stock.error
    ? <div className="diagram-view-error">{stock.error}</div>
    : stock.svg
      ? <div className="diagram-mermaid" dangerouslySetInnerHTML={{ __html: stock.svg }} />
      : <div>Loading Mermaid…</div>;

  if (view === 'mermaid') return mermaidBody;
  if (view === 'svg') return <pre className="diagram-svg"><code>{peleSvg}</code></pre>;

  return (
    <div className="diagram-compare">
      <figure>
        <figcaption>Pele</figcaption>
        <PeleHost source={source} options={options} onResult={(r) => onPeleSvg(r.svg)} />
      </figure>
      <figure>
        <figcaption>Mermaid</figcaption>
        {mermaidBody}
      </figure>
    </div>
  );
}
