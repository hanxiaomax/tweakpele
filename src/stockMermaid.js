/** Lazy-load stock Mermaid (the version Pele states parity with) and render a diagram source to SVG. */
let loadPromise = null;
let counter = 0;

function loadMermaid() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.min.js';
    s.onload = () => resolve(window.mermaid);
    s.onerror = () => {
      loadPromise = null;
      s.remove();
      reject(new Error('Failed to load Mermaid from jsDelivr'));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

export async function renderStockMermaid(source, theme) {
  const mermaid = await loadMermaid();
  await mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme,
  });
  const { svg } = await mermaid.render(`tp-mermaid-${++counter}`, source);
  return svg;
}
