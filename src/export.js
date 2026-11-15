export function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'diagram';
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Parse SVG markup (e.g. the stored Pele render); null when it is not a valid svg. */
export function parseSvgMarkup(markup) {
  if (!markup) return null;
  try {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const svg = doc.documentElement;
    if (doc.querySelector('parsererror') || !svg || svg.localName !== 'svg') return null;
    return svg;
  } catch (_) {
    return null;
  }
}

/** Resolve --pele-* vars referenced by the markup from a live element in the themed scope. */
export function peleStyleVars(markup, scopeEl) {
  const vars = {};
  if (!scopeEl) return vars;
  const names = new Set(['--pele-bg']);
  for (const [, name] of String(markup).matchAll(/var\((--pele-[a-z0-9-]+)/g)) names.add(name);
  const computed = getComputedStyle(scopeEl);
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) vars[name] = value;
  }
  return vars;
}

function buildExportSvg(svg, background, vars) {
  const clone = svg.cloneNode(true);
  const viewBox = (clone.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const [x, y, w, h] = viewBox.length === 4 && viewBox.every((n) => Number.isFinite(n))
    ? viewBox
    : [0, 0, parseFloat(clone.getAttribute('width')) || 0, parseFloat(clone.getAttribute('height')) || 0];

  let resolved = vars;
  if (!resolved) {
    resolved = {};
    const computed = getComputedStyle(svg);
    const markup = new XMLSerializer().serializeToString(clone);
    for (const [, name] of markup.matchAll(/var\((--pele-[a-z0-9-]+)/g)) {
      const value = computed.getPropertyValue(name).trim();
      if (value) resolved[name] = value;
    }
  }
  for (const [name, value] of Object.entries(resolved)) clone.style.setProperty(name, value);

  clone.style.removeProperty('max-width');
  clone.style.removeProperty('height');
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);

  if (background) {
    const fill = clone.style.getPropertyValue('--pele-bg') || '#fff';
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', fill);
    clone.insertBefore(rect, clone.firstChild);
  }

  clone.querySelectorAll('.c4-selected').forEach((el) => el.classList.remove('c4-selected'));
  clone.classList.remove('c4-selected');

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { markup: new XMLSerializer().serializeToString(clone), width: w, height: h };
}

function svgToPng(markup, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((out) => {
          URL.revokeObjectURL(url);
          if (out) resolve(out);
          else reject(new Error('PNG encoding failed'));
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image load failed'));
    };
    img.src = url;
  });
}

/** `svg` is a live svg element or Pele SVG markup; `vars` (optional) overrides computed-style reads. */
export async function exportDiagram(svg, { format, background, filename, vars }) {
  const el = typeof svg === 'string' ? parseSvgMarkup(svg) : svg;
  if (!el) throw new Error('Nothing to export');
  const { markup, width, height } = buildExportSvg(el, background, vars);
  if (format === 'svg') {
    download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
    return `${filename}.svg`;
  }
  const blob = await svgToPng(markup, width, height);
  download(blob, `${filename}.png`);
  return `${filename}.png`;
}
