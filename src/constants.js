/**
 * tweakpele v3 — static data: Pele CSS-variable metadata, factory/dark presets,
 * render options, and starters for the "New diagram" dialog.
 * Values verified against Pele 1.13.0 (vendor/pele.global.js).
 */

export const VAR_META = [
  { name: '--pele-bg', hint: 'page background', kind: 'color' },
  { name: '--pele-fg', hint: 'primary foreground', kind: 'color' },
  { name: '--pele-fg-on-light', hint: 'text on light fills', kind: 'color' },
  { name: '--pele-fg-on-dark', hint: 'text on dark fills', kind: 'color' },
  { name: '--pele-muted', hint: 'muted text', kind: 'color' },
  { name: '--pele-line', hint: 'edges & arrows', kind: 'color' },
  { name: '--pele-surface', hint: 'node surface', kind: 'color' },
  { name: '--pele-surface-alt', hint: 'subgraph & alt surface', kind: 'color' },
  { name: '--pele-border', hint: 'borders', kind: 'color' },
  { name: '--pele-accent', hint: 'accent', kind: 'color' },
  { name: '--pele-critical', hint: 'critical', kind: 'color' },
  { name: '--pele-error', hint: 'error', kind: 'color' },
  { name: '--pele-font', hint: 'body font stack', kind: 'text' },
  { name: '--pele-font-mono', hint: 'mono font stack', kind: 'text' },
  { name: '--pele-title-weight', hint: 'title weight', kind: 'text' },
  { name: '--pele-heading-weight', hint: 'heading weight', kind: 'text' },
  { name: '--pele-bold-weight', hint: 'bold weight', kind: 'text' },
  { name: '--pele-radius', hint: 'corner radius', kind: 'text' },
  { name: '--pele-series-1', hint: 'chart series 1', kind: 'color' },
  { name: '--pele-series-2', hint: 'chart series 2', kind: 'color' },
  { name: '--pele-series-3', hint: 'chart series 3', kind: 'color' },
  { name: '--pele-series-4', hint: 'chart series 4', kind: 'color' },
  { name: '--pele-series-5', hint: 'chart series 5', kind: 'color' },
  { name: '--pele-series-6', hint: 'chart series 6', kind: 'color' },
  { name: '--pele-series-7', hint: 'chart series 7', kind: 'color' },
  { name: '--pele-series-8', hint: 'chart series 8', kind: 'color' },
];

/** Light "paper" preset — Pele factory look. */
export const FACTORY = {
  '--pele-bg': '#F4F3EF',
  '--pele-fg': '#000000',
  '--pele-fg-on-light': '#000000',
  '--pele-fg-on-dark': '#FFFFFF',
  '--pele-muted': '#555555',
  '--pele-line': '#000000',
  '--pele-surface': '#FFFFFF',
  '--pele-surface-alt': '#EAE5DF',
  '--pele-border': '#000000',
  '--pele-accent': '#E06A1A',
  '--pele-critical': '#B8450C',
  '--pele-error': '#B8450C',
  '--pele-font': '"Noto Sans", "Noto Sans CJK SC", sans-serif',
  '--pele-font-mono': '"Noto Sans Mono", "DejaVu Sans Mono", monospace',
  '--pele-title-weight': 'bold',
  '--pele-heading-weight': 'bold',
  '--pele-bold-weight': 'bold',
  '--pele-radius': '6px',
  '--pele-series-1': '#F3C48A',
  '--pele-series-2': '#EFA85C',
  '--pele-series-3': '#E8923A',
  '--pele-series-4': '#D9741F',
  '--pele-series-5': '#B8450C',
  '--pele-series-6': '#4A4A48',
  '--pele-series-7': '#EAE5DF',
  '--pele-series-8': '#FFFFFF',
};

/** Dark "ink" sample preset. */
export const DARK = {
  '--pele-bg': '#1c1b1a',
  '--pele-fg': '#cecdc3',
  '--pele-fg-on-light': '#1f1f1f',
  '--pele-fg-on-dark': '#ffffff',
  '--pele-muted': '#878580',
  '--pele-line': '#cecdc3',
  '--pele-surface': '#282726',
  '--pele-surface-alt': '#343331',
  '--pele-border': '#403e3c',
  '--pele-accent': '#4385be',
  '--pele-critical': '#d14d41',
  '--pele-error': '#e45756',
  '--pele-font': '-apple-system, BlinkMacSystemFont, "Inter Variable", Inter, "Segoe UI", Helvetica, Arial, sans-serif',
  '--pele-font-mono': 'ui-monospace, SFMono-Regular, "Cascadia Code", "IBM Plex Mono", "Roboto Mono", "DejaVu Sans Mono", "Liberation Mono", Menlo, Monaco, "Consolas", "Source Code Pro", monospace',
  '--pele-title-weight': 'bold',
  '--pele-heading-weight': 'bold',
  '--pele-bold-weight': 'bold',
  '--pele-radius': '6px',
  '--pele-series-1': '#d14d41',
  '--pele-series-2': '#da702c',
  '--pele-series-3': '#d0a215',
  '--pele-series-4': '#879a39',
  '--pele-series-5': '#3aa99f',
  '--pele-series-6': '#4385be',
  '--pele-series-7': '#8b7ec8',
  '--pele-series-8': '#ce5d97',
};

export const REMEASURE_VARS = new Set([
  '--pele-font',
  '--pele-font-mono',
  '--pele-radius',
  '--pele-title-weight',
  '--pele-heading-weight',
  '--pele-bold-weight',
]);

// ---------------------------------------------------------------------------
// Render options (Pele RenderOptions / MountOptions + Mermaid `config` sections).
// value === undefined → option not passed (Pele default).
// ---------------------------------------------------------------------------
const L = (key, kind, extra) => ({ key, kind, ...extra });
export const OPT_GROUPS = [
  {
    title: 'RenderOptions', note: 'pele.mount(el, text, options)',
    items: [
      L('fontFamily', 'font', { path: ['fontFamily'], cssVar: '--pele-font', hint: 'label font (measure + draw, synced with --pele-font)',
        presets: ['"Noto Sans", "Noto Sans CJK SC", sans-serif', 'system-ui, sans-serif', 'Georgia, "Noto Serif CJK SC", serif', '"Noto Sans Mono", monospace', '-apple-system, BlinkMacSystemFont, "Inter Variable", Inter, "Segoe UI", Helvetica, Arial, sans-serif'] }),
      L('fontFamilyMono', 'font', { path: ['fontFamilyMono'], cssVar: '--pele-font-mono', hint: 'mono font (synced with --pele-font-mono)',
        presets: ['"Noto Sans Mono", "DejaVu Sans Mono", monospace', 'ui-monospace, monospace', '"DejaVu Sans Mono", monospace'] }),
      L('fontSize', 'num', { path: ['fontSize'], min: 8, max: 32, step: 1, def: 16, hint: 'base font size px (default 16)' }),
      L('padding', 'num', { path: ['padding'], min: 0, max: 80, step: 1, def: 8, factory: 16, hint: 'diagram padding px' }),
      L('maxWidth', 'num', { path: ['maxWidth'], min: 160, max: 2000, step: 10, hint: 'override available width; unset = follow the card / pane' }),
      L('responsive', 'bool', { path: ['responsive'], def: true, hint: 'false = fixed pixel size, never shrink' }),
      L('autoDirection', 'bool', { path: ['autoDirection'], def: true, hint: 'allow LR→TB flip in narrow containers' }),
      L('directionBreakpoint', 'num', { path: ['directionBreakpoint'], min: 0, max: 2000, step: 10, def: 640, hint: 'autoDirection width threshold px' }),
      L('monospace', 'checks', { path: ['monospace'], values: ['members', 'attributes', 'files', 'messages'], hint: 'measure/draw with the mono font: class members / ER attributes / tree files / sequence messages' }),
      L('now', 'date', { path: ['now'], hint: 'reference time for the Gantt "today" marker' }),
      L('zoom', 'enum', { path: ['zoom'], values: ['false', 'auto', 'true'], factory: 'true', required: true, hint: 'Pele native zoom in the preview pane: +/− overlay, wheel & pinch pan-zoom, +/− keys' }),
    ],
  },
  {
    title: 'config.flowchart', note: 'flowchart · state · swimlane (curve)',
    items: [
      L('curve', 'enum', { path: ['config', 'flowchart', 'curve'], values: ['rounded', 'linear', 'step', 'stepBefore', 'stepAfter'], hint: 'edge shape (also state / swimlane)' }),
      L('nodeSpacing', 'num', { path: ['config', 'flowchart', 'nodeSpacing'], min: 4, max: 200, step: 2, def: 40 }),
      L('rankSpacing', 'num', { path: ['config', 'flowchart', 'rankSpacing'], min: 4, max: 240, step: 2, def: 48 }),
      L('wrappingWidth', 'num', { path: ['config', 'flowchart', 'wrappingWidth'], min: 30, max: 500, step: 5, def: 200, hint: 'node label wrap width' }),
    ],
  },
  { title: 'config.class', items: [
    L('nodeSpacing', 'num', { path: ['config', 'class', 'nodeSpacing'], min: 4, max: 200, step: 2 }),
    L('rankSpacing', 'num', { path: ['config', 'class', 'rankSpacing'], min: 4, max: 240, step: 2 }),
  ] },
  { title: 'config.state', items: [
    L('nodeSpacing', 'num', { path: ['config', 'state', 'nodeSpacing'], min: 4, max: 200, step: 2 }),
    L('rankSpacing', 'num', { path: ['config', 'state', 'rankSpacing'], min: 4, max: 240, step: 2 }),
  ] },
  { title: 'config.er', items: [
    L('nodeSpacing', 'num', { path: ['config', 'er', 'nodeSpacing'], min: 4, max: 200, step: 2 }),
    L('rankSpacing', 'num', { path: ['config', 'er', 'rankSpacing'], min: 4, max: 240, step: 2 }),
  ] },
  { title: 'config.sequence', items: [
    L('mirrorActors', 'bool', { path: ['config', 'sequence', 'mirrorActors'], def: true, hint: 'repeat actors at the bottom' }),
    L('actorMargin', 'num', { path: ['config', 'sequence', 'actorMargin'], min: 4, max: 200, step: 2, def: 40 }),
    L('width', 'num', { path: ['config', 'sequence', 'width'], min: 40, max: 300, step: 2, def: 64, hint: 'actor box min width' }),
    L('height', 'num', { path: ['config', 'sequence', 'height'], min: 20, max: 160, step: 2, hint: 'actor box height' }),
    L('messageMargin', 'num', { path: ['config', 'sequence', 'messageMargin'], min: 0, max: 120, step: 2 }),
    L('noteMargin', 'num', { path: ['config', 'sequence', 'noteMargin'], min: 0, max: 60, step: 1 }),
    L('messageAlign', 'enum', { path: ['config', 'sequence', 'messageAlign'], values: ['center', 'left', 'right'] }),
  ] },
  { title: 'config.gantt', items: [
    L('barHeight', 'num', { path: ['config', 'gantt', 'barHeight'], min: 4, max: 80, step: 1 }),
    L('barGap', 'num', { path: ['config', 'gantt', 'barGap'], min: 0, max: 40, step: 1 }),
    L('fontSize', 'num', { path: ['config', 'gantt', 'fontSize'], min: 6, max: 32, step: 1 }),
    L('sectionFontSize', 'num', { path: ['config', 'gantt', 'sectionFontSize'], min: 6, max: 32, step: 1 }),
    L('topPadding', 'num', { path: ['config', 'gantt', 'topPadding'], min: 0, max: 160, step: 2 }),
    L('leftPadding', 'num', { path: ['config', 'gantt', 'leftPadding'], min: 0, max: 400, step: 5 }),
    L('rightPadding', 'num', { path: ['config', 'gantt', 'rightPadding'], min: 0, max: 300, step: 5 }),
    L('numberSectionStyles', 'num', { path: ['config', 'gantt', 'numberSectionStyles'], min: 1, max: 8, step: 1 }),
    L('useWidth', 'num', { path: ['config', 'gantt', 'useWidth'], min: 300, max: 2000, step: 10, hint: 'chart draw width' }),
    L('topAxis', 'bool', { path: ['config', 'gantt', 'topAxis'], def: false }),
    L('displayMode', 'enum', { path: ['config', 'gantt', 'displayMode'], values: ['', 'compact'] }),
  ] },
  { title: 'config.pie', items: [
    L('textPosition', 'num', { path: ['config', 'pie', 'textPosition'], min: 0, max: 1, step: 0.05, hint: 'sector label radial position' }),
  ] },
  { title: 'config.gitGraph', items: [
    L('showBranches', 'bool', { path: ['config', 'gitGraph', 'showBranches'], def: true }),
    L('showCommitLabel', 'bool', { path: ['config', 'gitGraph', 'showCommitLabel'], def: true }),
    L('rotateCommitLabel', 'bool', { path: ['config', 'gitGraph', 'rotateCommitLabel'], def: true }),
  ] },
  { title: 'config.xyChart', items: [
    L('width', 'num', { path: ['config', 'xyChart', 'width'], min: 200, max: 1600, step: 10, def: 700 }),
    L('height', 'num', { path: ['config', 'xyChart', 'height'], min: 150, max: 1200, step: 10, def: 500 }),
    L('chartOrientation', 'enum', { path: ['config', 'xyChart', 'chartOrientation'], values: ['vertical', 'horizontal'] }),
    L('showDataLabel', 'bool', { path: ['config', 'xyChart', 'showDataLabel'], def: false }),
  ] },
  { title: 'config.quadrantChart', items: [
    L('chartWidth', 'num', { path: ['config', 'quadrantChart', 'chartWidth'], min: 200, max: 1200, step: 10, def: 500 }),
    L('chartHeight', 'num', { path: ['config', 'quadrantChart', 'chartHeight'], min: 200, max: 1200, step: 10, def: 500 }),
    L('pointRadius', 'num', { path: ['config', 'quadrantChart', 'pointRadius'], min: 1, max: 20, step: 1 }),
    L('quadrantPadding', 'num', { path: ['config', 'quadrantChart', 'quadrantPadding'], min: 0, max: 60, step: 1 }),
  ] },
  { title: 'config.sankey', items: [
    L('showValues', 'bool', { path: ['config', 'sankey', 'showValues'], def: true }),
    L('nodeWidth', 'num', { path: ['config', 'sankey', 'nodeWidth'], min: 2, max: 60, step: 1, def: 10 }),
    L('nodePadding', 'num', { path: ['config', 'sankey', 'nodePadding'], min: 0, max: 80, step: 1 }),
    L('nodeAlignment', 'enum', { path: ['config', 'sankey', 'nodeAlignment'], values: ['justify', 'left', 'right', 'center'] }),
    L('linkColor', 'enum', { path: ['config', 'sankey', 'linkColor'], values: ['gradient', 'source', 'target'] }),
    L('width', 'num', { path: ['config', 'sankey', 'width'], min: 200, max: 1600, step: 10 }),
    L('height', 'num', { path: ['config', 'sankey', 'height'], min: 150, max: 1200, step: 10, def: 400 }),
  ] },
  { title: 'config.radar', items: [
    L('width', 'num', { path: ['config', 'radar', 'width'], min: 200, max: 1200, step: 10 }),
    L('height', 'num', { path: ['config', 'radar', 'height'], min: 200, max: 1200, step: 10 }),
  ] },
  { title: 'config.packet', items: [
    L('bitsPerRow', 'num', { path: ['config', 'packet', 'bitsPerRow'], min: 8, max: 64, step: 8, def: 32 }),
    L('bitWidth', 'num', { path: ['config', 'packet', 'bitWidth'], min: 8, max: 60, step: 1 }),
    L('rowHeight', 'num', { path: ['config', 'packet', 'rowHeight'], min: 16, max: 80, step: 1 }),
    L('showBits', 'bool', { path: ['config', 'packet', 'showBits'], def: true }),
  ] },
  { title: 'config.treemap', items: [
    L('diagramPadding', 'num', { path: ['config', 'treemap', 'diagramPadding'], min: 0, max: 60, step: 1, def: 8 }),
    L('padding', 'num', { path: ['config', 'treemap', 'padding'], min: 0, max: 30, step: 1 }),
    L('showValues', 'bool', { path: ['config', 'treemap', 'showValues'], def: true }),
  ] },
  { title: 'config.railroad', items: [
    L('arcRadius', 'num', { path: ['config', 'railroad', 'arcRadius'], min: 0, max: 30, step: 1 }),
    L('verticalSeparation', 'num', { path: ['config', 'railroad', 'verticalSeparation'], min: 2, max: 60, step: 1 }),
    L('horizontalSeparation', 'num', { path: ['config', 'railroad', 'horizontalSeparation'], min: 2, max: 60, step: 1 }),
    L('strokeWidth', 'num', { path: ['config', 'railroad', 'strokeWidth'], min: 0.5, max: 6, step: 0.5 }),
  ] },
  { title: 'config.treeView', items: [
    L('rowIndent', 'num', { path: ['config', 'treeView', 'rowIndent'], min: 4, max: 80, step: 1 }),
    L('lineThickness', 'num', { path: ['config', 'treeView', 'lineThickness'], min: 0.5, max: 6, step: 0.5 }),
  ] },
  { title: 'config.architecture', items: [
    L('iconSize', 'num', { path: ['config', 'architecture', 'iconSize'], min: 20, max: 140, step: 2 }),
    L('padding', 'num', { path: ['config', 'architecture', 'padding'], min: 0, max: 100, step: 2 }),
  ] },
  { title: 'config.cynefin', items: [
    L('boundaryAmplitude', 'num', { path: ['config', 'cynefin', 'boundaryAmplitude'], min: 0, max: 40, step: 1, hint: 'domain boundary wobble' }),
    L('width', 'num', { path: ['config', 'cynefin', 'width'], min: 300, max: 1400, step: 10 }),
  ] },
  { title: 'config.usecase', items: [
    L('nodeSpacing', 'num', { path: ['config', 'usecase', 'nodeSpacing'], min: 4, max: 200, step: 2 }),
    L('rankSpacing', 'num', { path: ['config', 'usecase', 'rankSpacing'], min: 4, max: 240, step: 2 }),
  ] },
  { title: 'config.agentflow', items: [
    L('rankSpacing', 'num', { path: ['config', 'agentflow', 'rankSpacing'], min: 4, max: 240, step: 2 }),
  ] },
  { title: 'config.mindmap', items: [
    L('maxNodeWidth', 'num', { path: ['config', 'mindmap', 'maxNodeWidth'], min: 40, max: 500, step: 5, def: 200 }),
  ] },
  { title: 'config.kanban', items: [
    L('sectionWidth', 'num', { path: ['config', 'kanban', 'sectionWidth'], min: 80, max: 500, step: 5 }),
  ] },
  { title: 'config.block', items: [
    L('padding', 'num', { path: ['config', 'block', 'padding'], min: 0, max: 60, step: 1 }),
  ] },
];
export const ALL_OPTS = [];
OPT_GROUPS.forEach((g, gi) => g.items.forEach((o, oi) => { o.id = `g${gi}-${o.key}-${oi}`; o.group = g.title; ALL_OPTS.push(o); }));

export function factoryOpts() {
  const v = {};
  for (const o of ALL_OPTS) if (o.factory !== undefined) v[o.id] = o.factory;
  return v;
}

/** Collect non-empty toolbox values into a nested options object. */
function collectOptions(optVals, vars) {
  const out = {};
  const put = (path, v) => {
    let cur = out;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] ??= {};
    cur[path[path.length - 1]] = v;
  };
  for (const o of ALL_OPTS) {
    const v = o.kind === 'font' ? vars[o.cssVar] : optVals[o.id];
    if (v === undefined || v === '' || v === null) continue;
    if (o.kind === 'checks' && !v.length) continue;
    put(o.path, v);
  }
  return out;
}

/** JSON shown in the Output panel / "Copy render JSON" (dates serialized, zoom readable). */
export const exportOptions = collectOptions;

/** Build pele.mount options from toolbox state (no callbacks). */
export function buildMountOptions(optVals, vars) {
  const out = collectOptions(optVals, vars);
  if (out.zoom !== undefined) out.zoom = out.zoom === 'auto' ? 'auto' : out.zoom !== 'false';
  if (out.now) out.now = new Date(out.now + 'T12:00:00');
  return out;
}

export function peleCssBlock(vars) {
  return `.pele {\n${VAR_META.map(({ name }) => `  ${name}: ${String(vars[name]).trim()};`).join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// New-diagram starters — English labels, no hardcoded colors.
// ---------------------------------------------------------------------------
export const STARTERS = [
  { title: 'Blank flowchart', keyword: 'flowchart', source: 'flowchart TD\n  A[Start] --> B{Choice}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]\n  C --> E[Done]\n  D --> E\n' },
  { title: 'Flowchart LR', keyword: 'flowchart', source: 'flowchart LR\n  Ingest[Ingest] --> Process[Process]\n  Process --> Store[(Store)]\n  Store --> Serve[Serve]\n' },
  { title: 'Sequence', keyword: 'sequenceDiagram', source: 'sequenceDiagram\n  autonumber\n  participant U as User\n  participant S as Server\n  U->>S: Request data\n  S-->>U: Data payload\n  Note over U,S: Round trip complete\n' },
  { title: 'Class', keyword: 'classDiagram', source: 'classDiagram\n  class Diagram {\n    +String title\n    +render()\n  }\n  Diagram <|-- Flowchart\n  Diagram <|-- Chart\n' },
  { title: 'State', keyword: 'stateDiagram-v2', source: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review: submit\n  Review --> Published: approve\n  Review --> Draft: revise\n  Published --> [*]\n' },
  { title: 'Entity relationship', keyword: 'erDiagram', source: 'erDiagram\n  USER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains\n  PRODUCT ||--o{ LINE_ITEM : "appears in"\n' },
  { title: 'Mindmap', keyword: 'mindmap', source: 'mindmap\n  root((tweakpele))\n    Theme\n      CSS vars\n      Presets\n    Render\n      Options\n      Live preview\n' },
  { title: 'Timeline', keyword: 'timeline', source: 'timeline\n  title Project timeline\n  section Q1\n    Design : Wireframes\n    Design : Spec\n  section Q2\n    Build : Editor\n    Build : Gallery\n' },
  { title: 'Pie', keyword: 'pie', source: 'pie showData\n  title Time spent\n  "Editing" : 45\n  "Previewing" : 35\n  "Tweaking theme" : 20\n' },
  { title: 'Gantt', keyword: 'gantt', source: 'gantt\n  title Release plan\n  dateFormat YYYY-MM-DD\n  section Build\n    Editor :a1, 2026-11-01, 8d\n    Gallery :a2, after a1, 5d\n  section Ship\n    Pages deploy :2026-11-20, 2d\n' },
  { title: 'Git graph', keyword: 'gitGraph', source: 'gitGraph\n  commit id: "init"\n  branch feature\n  commit\n  commit\n  checkout main\n  merge feature\n' },
  { title: 'Kanban', keyword: 'kanban', source: 'kanban\n  Backlog\n    [Add export]\n    [Try dark ink]\n  In Progress\n    [Split editor]\n  Done\n    [Gallery grid]\n' },
  { title: 'User journey', keyword: 'journey', source: 'journey\n  title Diagram day\n  section Morning\n    Open gallery: 5: Me\n    Tweak theme: 4: Me\n  section Evening\n    Ship it: 5: Me, Team\n' },
  { title: 'Quadrant', keyword: 'quadrantChart', source: 'quadrantChart\n  title Feature matrix\n  x-axis Low effort --> High effort\n  y-axis Low impact --> High impact\n  "Theme presets": [0.3, 0.8]\n  "Zoom API": [0.4, 0.6]\n  "Custom pan-zoom": [0.8, 0.2]\n' },
];
