/** Lazy-load stock Mermaid (the version Pele states parity with) and render a diagram source to SVG. */
let loadPromise = null;
let counter = 0;

function loadMermaid() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.min.js';
    s.integrity = 'sha384-EbBpjO7rlR6eqZEcG7GaPpyk9H9WrMyPWX4d3KvPYltgt8Z8l0z6R56B1qP40pR4';
    s.crossOrigin = 'anonymous';
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
