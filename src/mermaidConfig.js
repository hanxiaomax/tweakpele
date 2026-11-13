/**
 * Export a Pele theme vars object as an equivalent Mermaid `theme: base` config
 * (plain data, no React) — for VS Code Markdown preview, mmdc, and frontmatter.
 */

const ctx2d = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

/** Normalize any CSS color to '#rrggbb' / 'rgba(...)' via canvas; null when unparseable. */
function normalizeColor(v) {
  if (!ctx2d) return null;
  const s = String(v ?? '').trim();
  if (!s) return null;
  ctx2d.fillStyle = '#000000';
  ctx2d.fillStyle = s;
  const a = ctx2d.fillStyle;
  ctx2d.fillStyle = '#ffffff';
  ctx2d.fillStyle = s;
  const b = ctx2d.fillStyle;
  return a === b ? a : null;
}

/** WCAG relative luminance of a normalized color (null when unknown shape). */
function luminance(color) {
  let m = /^#([0-9a-f]{6})$/i.exec(color);
  let r, g, b;
  if (m) {
    r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16);
  } else {
    m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
    if (!m) return null;
    r = +m[1]; g = +m[2]; b = +m[3];
  }
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const COLOR_GROUPS = [
  ['bg', ['background', 'edgeLabelBackground']],
  ['surface', ['primaryColor', 'mainBkg', 'nodeBkg', 'actorBkg', 'labelBoxBkgColor']],
  ['surface-alt', ['secondaryColor', 'tertiaryColor', 'clusterBkg', 'noteBkgColor', 'activationBkgColor']],
  ['fg', ['primaryTextColor', 'secondaryTextColor', 'tertiaryTextColor', 'textColor', 'nodeTextColor', 'titleColor', 'actorTextColor', 'signalTextColor', 'labelTextColor', 'loopTextColor', 'noteTextColor']],
  ['border', ['primaryBorderColor', 'secondaryBorderColor', 'tertiaryBorderColor', 'nodeBorder', 'clusterBorder', 'actorBorder', 'labelBoxBorderColor', 'noteBorderColor', 'activationBorderColor']],
  ['line', ['lineColor', 'defaultLinkColor', 'signalColor', 'actorLineColor']],
  ['critical', ['critBkgColor', 'critBorderColor']],
  ['error', ['errorBkgColor', 'errorTextColor']],
];

function themeCss(vars) {
  const rules = [];
  const radius = parseFloat(vars['--pele-radius']);
  if (Number.isFinite(radius)) rules.push(`.node rect, .cluster rect, rect.actor, .note { rx: ${radius}px; ry: ${radius}px; }`);
  const weight = String(vars['--pele-title-weight'] || '').trim();
  if (weight) rules.push(`.pieTitleText, .titleText, .cluster text { font-weight: ${weight}; }`);
  return rules.join('\n');
}

/** Build a Mermaid `theme: base` config from a Pele vars object. Frontmatter only honours the top-level fontFamily. */
export function mermaidConfig(vars) {
  const tv = {};
  let bg = null;
  for (const [src, keys] of COLOR_GROUPS) {
    const c = normalizeColor(vars[`--pele-${src}`]);
    if (!c) continue;
    if (src === 'bg') bg = c;
    for (const k of keys) tv[k] = c;
  }
  const series = [];
  for (let i = 1; i <= 8; i++) series.push(normalizeColor(vars[`--pele-series-${i}`]));
  series.forEach((c, i) => {
    if (!c) return;
    tv[`pie${i + 1}`] = c;
    tv[`cScale${i}`] = c;
    tv[`git${i}`] = c;
  });
  const palette = series.filter(Boolean).join(', ');
  if (palette) tv.xyChart = { plotColorPalette: palette };
  const font = String(vars['--pele-font'] || '').trim();
  if (font) tv.fontFamily = font;
  if (bg) {
    const lum = luminance(bg);
    if (lum !== null) tv.darkMode = lum < 0.5;
  }
  return { theme: 'base', ...(font && { fontFamily: font }), themeVariables: tv, themeCSS: themeCss(vars) };
}

/** Minimal YAML emitter for nested objects of strings/booleans/numbers. */
function yamlEmit(obj, indent = '') {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (v && typeof v === 'object') {
      const nested = yamlEmit(v, indent + '  ');
      if (nested) lines.push(`${indent}${k}:`, nested);
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${indent}${k}: ${v}`);
    } else {
      lines.push(`${indent}${k}: ${JSON.stringify(String(v))}`);
    }
  }
  return lines.join('\n');
}

/** Mermaid YAML frontmatter block (with trailing newline) carrying the config. */
export function mermaidFrontmatter(vars) {
  const body = yamlEmit({ config: mermaidConfig(vars) });
  return `---\n${body}\n---\n`;
}

/** Prepend the Mermaid config frontmatter, replacing any existing `config:` block. */
export function withMermaidFrontmatter(source, vars) {
  const cfgBlock = yamlEmit({ config: mermaidConfig(vars) });
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!m) return `---\n${cfgBlock}\n---\n` + source;
  const kept = [];
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^config:\s*$/.test(lines[i])) {
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) i++;
      continue;
    }
    kept.push(lines[i]);
  }
  const keptBlock = kept.join('\n').replace(/^\n+|\n+$/g, '');
  return `---\n${keptBlock ? `${cfgBlock}\n${keptBlock}` : cfgBlock}\n---\n` + source.slice(m[0].length);
}
