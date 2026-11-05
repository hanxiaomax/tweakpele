/**
 * tweakpele v2 — live Pele theme + render-option editor on an infinite canvas.
 * Every Mermaid type Pele 1.13.0 supports gets one frame; sources live in diagrams/<id>.mmd.
 */
(function () {
  'use strict';

  const VAR_META = [
    { name: '--pele-bg', hint: '页面 / 图底色 · page background', kind: 'color' },
    { name: '--pele-fg', hint: '主文字色 · primary foreground', kind: 'color' },
    { name: '--pele-fg-on-light', hint: '浅底上的字色 · text on light fill', kind: 'color' },
    { name: '--pele-fg-on-dark', hint: '深底上的字色 · text on dark fill', kind: 'color' },
    { name: '--pele-muted', hint: '次要文字 · muted text', kind: 'color' },
    { name: '--pele-line', hint: '连线 / 箭头 · edges & arrows', kind: 'color' },
    { name: '--pele-surface', hint: '节点表面 · node surface', kind: 'color' },
    { name: '--pele-surface-alt', hint: '子图 / 交替面 · subgraph & alt surface', kind: 'color' },
    { name: '--pele-border', hint: '边框 · borders', kind: 'color' },
    { name: '--pele-accent', hint: '强调色 · accent', kind: 'color' },
    { name: '--pele-critical', hint: '危急 · critical', kind: 'color' },
    { name: '--pele-error', hint: '错误 · error', kind: 'color' },
    { name: '--pele-font', hint: '正文字体 · body font stack', kind: 'text' },
    { name: '--pele-font-mono', hint: '等宽字体 · mono font stack', kind: 'text' },
    { name: '--pele-title-weight', hint: '标题字重 · title weight', kind: 'text' },
    { name: '--pele-heading-weight', hint: '小标题字重 · heading weight', kind: 'text' },
    { name: '--pele-bold-weight', hint: '加粗字重 · bold weight', kind: 'text' },
    { name: '--pele-radius', hint: '圆角 · corner radius', kind: 'text' },
    { name: '--pele-series-1', hint: '系列色 1 · chart series', kind: 'color' },
    { name: '--pele-series-2', hint: '系列色 2', kind: 'color' },
    { name: '--pele-series-3', hint: '系列色 3', kind: 'color' },
    { name: '--pele-series-4', hint: '系列色 4', kind: 'color' },
    { name: '--pele-series-5', hint: '系列色 5', kind: 'color' },
    { name: '--pele-series-6', hint: '系列色 6', kind: 'color' },
    { name: '--pele-series-7', hint: '系列色 7', kind: 'color' },
    { name: '--pele-series-8', hint: '系列色 8', kind: 'color' },
  ];

  const FACTORY = {
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

  const DARK = {
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

  const REMEASURE_VARS = new Set([
    '--pele-font',
    '--pele-font-mono',
    '--pele-radius',
    '--pele-title-weight',
    '--pele-heading-weight',
    '--pele-bold-weight',
  ]);


  // ---------------------------------------------------------------------------
  // Render options (Pele RenderOptions / MountOptions + Mermaid `config` sections)
  // Each entry was verified against Pele 1.13.0 to change the rendered SVG.
  // value === undefined  → option not passed (Pele default).
  // ---------------------------------------------------------------------------
  const L = (key, kind, extra) => ({ key, kind, ...extra });
  const OPT_GROUPS = [
    {
      title: '容器 / 画板', note: 'frame 尺寸 → mount() 以容器宽度作为 maxWidth 重排',
      items: [
        L('frameWidth', 'num', { layout: true, min: 240, max: 1600, step: 10, factory: 640, hint: 'frame 内容宽度 px（Pele 按容器宽度重排/换行/切方向）' }),
        L('frameHeight', 'num', { layout: true, min: 0, max: 1600, step: 10, factory: 0, hint: 'frame 内容高度 px，0 = 跟随图高' }),
        L('fit', 'enum', { layout: true, values: ['natural', 'contain'], factory: 'natural', required: true, hint: 'natural：宽度≤容器；contain：SVG 等比缩放填满 frame（配合高度）' }),
        L('columns', 'num', { layout: true, min: 1, max: 12, step: 1, factory: 6, hint: '网格列数' }),
        L('gap', 'num', { layout: true, min: 0, max: 240, step: 4, factory: 48, hint: 'frame 间距 px' }),
      ],
    },
    {
      title: 'RenderOptions', note: 'pele.mount(el, text, options)',
      items: [
        L('fontFamily', 'font', { path: ['fontFamily'], cssVar: '--pele-font', hint: '标签字体（测量 + 显示，与 --pele-font 同步）',
          presets: ['"Noto Sans", "Noto Sans CJK SC", sans-serif', 'system-ui, sans-serif', 'Georgia, "Noto Serif CJK SC", serif', '"Noto Sans Mono", monospace', '-apple-system, BlinkMacSystemFont, "Inter Variable", Inter, "Segoe UI", Helvetica, Arial, sans-serif'] }),
        L('fontFamilyMono', 'font', { path: ['fontFamilyMono'], cssVar: '--pele-font-mono', hint: '等宽字体（与 --pele-font-mono 同步）',
          presets: ['"Noto Sans Mono", "DejaVu Sans Mono", monospace', 'ui-monospace, monospace', '"DejaVu Sans Mono", monospace'] }),
        L('fontSize', 'num', { path: ['fontSize'], min: 8, max: 32, step: 1, def: 16, hint: '基础字号 px（默认 16）' }),
        L('padding', 'num', { path: ['padding'], min: 0, max: 80, step: 1, def: 8, factory: 16, hint: '图四周留白 px' }),
        L('maxWidth', 'num', { path: ['maxWidth'], min: 160, max: 2000, step: 10, hint: '覆盖可用宽度；不设 = 跟随 frame 宽度' }),
        L('responsive', 'bool', { path: ['responsive'], def: true, hint: 'false = 固定像素尺寸，不随容器缩小' }),
        L('autoDirection', 'bool', { path: ['autoDirection'], def: true, hint: '窄容器时允许 LR→TB 自动换向' }),
        L('directionBreakpoint', 'num', { path: ['directionBreakpoint'], min: 0, max: 2000, step: 10, def: 640, hint: 'autoDirection 的宽度阈值 px' }),
        L('monospace', 'checks', { path: ['monospace'], values: ['members', 'attributes', 'files', 'messages'], hint: '用等宽字体测量/绘制：class 成员 / ER 属性 / tree 文件名 / sequence 消息' }),
        L('now', 'date', { path: ['now'], hint: 'Gantt "今天" 标记的参考时间' }),
        L('zoom', 'enum', { path: ['zoom'], values: ['false', 'auto', 'true'], factory: 'false', required: true, hint: 'Pele 自带图内缩放（画板已有缩放，默认关）' }),
      ],
    },
    {
      title: 'config.flowchart', note: 'flowchart · state · swimlane(curve)',
      items: [
        L('curve', 'enum', { path: ['config', 'flowchart', 'curve'], values: ['rounded', 'linear', 'step', 'stepBefore', 'stepAfter'], hint: '连线形态（也作用于 state / swimlane）' }),
        L('nodeSpacing', 'num', { path: ['config', 'flowchart', 'nodeSpacing'], min: 4, max: 200, step: 2, def: 40 }),
        L('rankSpacing', 'num', { path: ['config', 'flowchart', 'rankSpacing'], min: 4, max: 240, step: 2, def: 48 }),
        L('wrappingWidth', 'num', { path: ['config', 'flowchart', 'wrappingWidth'], min: 30, max: 500, step: 5, def: 200, hint: '节点文字换行宽度' }),
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
      L('mirrorActors', 'bool', { path: ['config', 'sequence', 'mirrorActors'], def: true, hint: '底部重复参与者' }),
      L('actorMargin', 'num', { path: ['config', 'sequence', 'actorMargin'], min: 4, max: 200, step: 2, def: 40 }),
      L('width', 'num', { path: ['config', 'sequence', 'width'], min: 40, max: 300, step: 2, def: 64, hint: '参与者框最小宽度' }),
      L('height', 'num', { path: ['config', 'sequence', 'height'], min: 20, max: 160, step: 2, hint: '参与者框高度' }),
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
      L('useWidth', 'num', { path: ['config', 'gantt', 'useWidth'], min: 300, max: 2000, step: 10, hint: '图表绘制宽度' }),
      L('topAxis', 'bool', { path: ['config', 'gantt', 'topAxis'], def: false }),
      L('displayMode', 'enum', { path: ['config', 'gantt', 'displayMode'], values: ['', 'compact'] }),
    ] },
    { title: 'config.pie', items: [
      L('textPosition', 'num', { path: ['config', 'pie', 'textPosition'], min: 0, max: 1, step: 0.05, hint: '扇区标签半径比例' }),
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
      L('boundaryAmplitude', 'num', { path: ['config', 'cynefin', 'boundaryAmplitude'], min: 0, max: 40, step: 1, hint: '域边界波动幅度' }),
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
  const ALL_OPTS = [];
  OPT_GROUPS.forEach((g, gi) => g.items.forEach((o, oi) => { o.id = `g${gi}-${o.key}-${oi}`; o.group = g.title; ALL_OPTS.push(o); }));

  function factoryOpts() {
    const v = {};
    for (const o of ALL_OPTS) if (o.factory !== undefined) v[o.id] = o.factory;
    return v;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let theme = { ...FACTORY };
  let optVals = factoryOpts();
  const frames = []; // { meta, el, host, title, mount, result }
  const cam = { x: 0, y: 0, s: 1 };
  const view = { mode: 'overview', focused: null, userMoved: false };

  const $ = (id) => document.getElementById(id);
  const els = {
    list: $('vars-list'), opts: $('opts-list'), liveStyle: $('live-theme'), themeRoot: $('theme-root'),
    world: $('world'), status: $('status'), toast: $('toast'), outCss: $('out-css'), outOpts: $('out-opts'),
    select: $('frame-select'), zoomLabel: $('zoom-label'),
  };

  const isHexColor = (v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v).trim());
  function expandHex(hex) {
    const h = hex.trim();
    if (/^#[0-9a-fA-F]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (/^#[0-9a-fA-F]{8}$/.test(h)) return h.slice(0, 7);
    return h;
  }
  const setStatus = (m) => { els.status.textContent = m || ''; };
  function showToast(msg) {
    els.toast.textContent = msg; els.toast.classList.add('show');
    clearTimeout(showToast._t); showToast._t = setTimeout(() => els.toast.classList.remove('show'), 1600);
  }

  // ---------------------------------------------------------------------------
  // Theme (CSS vars)
  // ---------------------------------------------------------------------------
  function buildPeleCssBlock() {
    return `.pele {\n${VAR_META.map(({ name }) => `  ${name}: ${String(theme[name]).trim()};`).join('\n')}\n}`;
  }

  function remeasureAll() {
    try { pele.forgetTextWidths(); } catch (_) { /* ignore */ }
    // fonts feed the mount options too, so push fresh options (re-render) rather than only refresh()
    applyOptions();
    for (const f of frames) { try { f.mount && f.mount.refresh(); } catch (_) { /* ignore */ } }
  }

  function applyTheme({ remeasure = false, changedName = null } = {}) {
    for (const { name } of VAR_META) els.themeRoot.style.setProperty(name, theme[name]);
    els.liveStyle.textContent = buildPeleCssBlock();
    els.outCss.textContent = buildPeleCssBlock();
    if (remeasure || (changedName && REMEASURE_VARS.has(changedName))) remeasureAll();
  }

  function syncVarInputs() {
    for (const { name, kind } of VAR_META) {
      const text = els.list.querySelector(`[data-text="${CSS.escape(name)}"]`);
      if (text && document.activeElement !== text) text.value = theme[name];
      if (kind === 'color') {
        const c = els.list.querySelector(`[data-color="${CSS.escape(name)}"]`);
        if (c && isHexColor(theme[name])) c.value = expandHex(theme[name]);
      }
    }
  }

  function onVarChange(name, value) {
    theme[name] = value;
    syncVarInputs();
    syncOptInputs();
    applyTheme({ changedName: name });
    setStatus(name);
  }

  function buildVarList() {
    const frag = document.createDocumentFragment();
    for (const meta of VAR_META) {
      const row = document.createElement('div');
      row.className = 'var-row'; row.dataset.var = meta.name;
      row.innerHTML = `<div class="var-meta"><span class="var-name">${meta.name}</span><span class="var-hint">${meta.hint}</span></div>`;
      const controls = document.createElement('div');
      controls.className = 'var-controls';
      if (meta.kind === 'color') {
        const color = document.createElement('input');
        color.type = 'color'; color.dataset.color = meta.name; color.title = meta.name;
        color.value = isHexColor(theme[meta.name]) ? expandHex(theme[meta.name]) : '#000000';
        color.addEventListener('input', () => onVarChange(meta.name, color.value));
        controls.appendChild(color);
      }
      const text = document.createElement('input');
      text.type = 'text'; text.dataset.text = meta.name; text.spellcheck = false; text.autocomplete = 'off';
      text.value = theme[meta.name];
      text.addEventListener('input', () => onVarChange(meta.name, text.value));
      controls.appendChild(text);
      row.appendChild(controls);
      frag.appendChild(row);
    }
    els.list.appendChild(frag);
    $('vars-count').textContent = `${VAR_META.length} 个`;
  }

  function setTheme(next, announce) {
    theme = { ...next };
    syncVarInputs();
    syncOptInputs();
    applyTheme({ remeasure: true });
    if (announce) setStatus(announce);
  }

  // ---------------------------------------------------------------------------
  // Render options
  // ---------------------------------------------------------------------------
  function optValue(o) {
    if (o.kind === 'font') return theme[o.cssVar];
    return optVals[o.id];
  }

  function buildMountOptions() {
    const out = {};
    const put = (path, v) => {
      let cur = out;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] ??= {};
      cur[path[path.length - 1]] = v;
    };
    for (const o of ALL_OPTS) {
      if (o.layout) continue;
      let v = optValue(o);
      if (v === undefined || v === '' || v === null) continue;
      if (o.kind === 'checks' && !v.length) continue;
      if (o.key === 'zoom') v = v === 'auto' ? 'auto' : v === 'true';
      put(o.path, v);
    }
    return out;
  }

  function exportOptions() {
    const opts = buildMountOptions();
    if (opts.now) opts.now = String(opts.now);
    const layout = {};
    for (const o of ALL_OPTS) if (o.layout && optVals[o.id] !== undefined) layout[o.key] = optVals[o.id];
    return { ...opts, _tweakpeleLayout: layout };
  }

  function liveOptions() {
    const o = buildMountOptions();
    if (o.now) o.now = new Date(o.now + 'T12:00:00');
    return o;
  }

  let applyQueued = 0;
  function applyOptions() {
    els.outOpts.textContent = JSON.stringify(exportOptions(), null, 2);
    const base = liveOptions();
    for (const f of frames) {
      if (!f.mount || !f.source) continue;
      try { f.mount.update(f.source, mountOptsFor(f, base)); } catch (e) { console.error(e); }
    }
    scheduleLayout();
  }
  function queueApply() {
    cancelAnimationFrame(applyQueued);
    applyQueued = requestAnimationFrame(applyOptions);
  }

  function mountOptsFor(f, base) {
    return {
      ...base,
      onRender(result) {
        f.result = result;
        f.meta_el.textContent = `${result.mermaidType} · ${Math.round(result.width)}×${Math.round(result.height)}`;
        f.errEl.textContent = '';
        scheduleLayout();
      },
      onError(err) {
        console.warn('pele', f.meta.id, err && err.message ? err.message : err);
        f.errEl.textContent = String(err && err.message ? err.message : err);
        scheduleLayout();
      },
    };
  }

  function rowHtml(o) {
    const hint = o.hint ? `<span class="opt-hint">${o.hint}</span>` : '';
    const def = o.def !== undefined ? ` · 默认 ${o.def}` : '';
    const name = `<label class="opt-name" for="${o.id}">${o.key}<span class="opt-hint">${(o.path ? o.path.join('.') : 'layout.' + o.key)}${def}</span>${hint}</label>`;
    return name;
  }

  function buildOptList() {
    const frag = document.createDocumentFragment();
    for (const g of OPT_GROUPS) {
      const head = document.createElement('div');
      head.className = 'opt-group';
      head.innerHTML = `${g.title}${g.note ? `<small>${g.note}</small>` : ''}`;
      frag.appendChild(head);
      for (const o of g.items) {
        const row = document.createElement('div');
        row.className = 'opt-row' + (o.kind === 'font' || o.kind === 'checks' ? ' wide' : '');
        row.dataset.opt = o.id;
        row.innerHTML = rowHtml(o);
        const ctl = document.createElement('div');
        ctl.className = 'opt-ctl';
        if (o.kind === 'num') {
          const r = document.createElement('input');
          r.type = 'range'; r.min = o.min; r.max = o.max; r.step = o.step || 1;
          const n = document.createElement('input');
          n.type = 'number'; n.id = o.id; n.min = o.min; n.max = o.max; n.step = o.step || 1; n.style.width = '62px'; n.style.flex = 'none';
          n.placeholder = o.def !== undefined ? String(o.def) : '默认';
          const set = (raw) => {
            const v = raw === '' ? undefined : Number(raw);
            optVals[o.id] = Number.isFinite(v) ? v : undefined;
            syncOptInputs(); onOptChange(o);
          };
          r.addEventListener('input', () => set(r.value));
          n.addEventListener('input', () => set(n.value));
          ctl.append(r, n);
        } else if (o.kind === 'bool' || o.kind === 'enum') {
          const s = document.createElement('select');
          s.id = o.id;
          const vals = o.kind === 'bool' ? ['true', 'false'] : o.values;
          s.innerHTML = (o.required ? '' : '<option value="">默认</option>') +
            vals.map((v) => `<option value="${v}">${v === '' ? '(default)' : v}</option>`).join('');
          s.addEventListener('change', () => {
            let v = s.value;
            if (o.kind === 'bool') v = v === '' ? undefined : v === 'true';
            else if (v === '' && !o.required) v = undefined;
            optVals[o.id] = v; syncOptInputs(); onOptChange(o);
          });
          ctl.append(s);
        } else if (o.kind === 'font') {
          const s = document.createElement('select');
          s.innerHTML = '<option value="">预设…</option>' + o.presets.map((p) => `<option>${p.replace(/"/g, '&quot;')}</option>`).join('');
          s.style.flex = 'none'; s.style.width = '78px';
          const t = document.createElement('input');
          t.type = 'text'; t.id = o.id; t.spellcheck = false;
          s.addEventListener('change', () => { if (s.value) { onVarChange(o.cssVar, s.value); s.value = ''; } });
          t.addEventListener('input', () => onVarChange(o.cssVar, t.value));
          ctl.append(s, t);
        } else if (o.kind === 'checks') {
          ctl.classList.add('opt-checks');
          ctl.innerHTML = o.values.map((v) => `<label><input type="checkbox" value="${v}" data-check="${o.id}"> ${v}</label>`).join('');
          ctl.addEventListener('change', () => {
            const vs = [...ctl.querySelectorAll('input:checked')].map((i) => i.value);
            optVals[o.id] = vs.length ? vs : undefined; syncOptInputs(); onOptChange(o);
          });
        } else if (o.kind === 'date') {
          const d = document.createElement('input');
          d.type = 'date'; d.id = o.id;
          d.addEventListener('input', () => { optVals[o.id] = d.value || undefined; syncOptInputs(); onOptChange(o); });
          ctl.append(d);
        }
        if (o.kind !== 'font') {
          const x = document.createElement('button');
          x.type = 'button'; x.className = 'secondary icon'; x.textContent = '×'; x.title = '恢复默认';
          x.style.width = '22px'; x.style.padding = '2px 0';
          x.addEventListener('click', () => { optVals[o.id] = o.required ? o.factory : undefined; syncOptInputs(); onOptChange(o); });
          ctl.append(x);
        }
        row.appendChild(ctl);
        frag.appendChild(row);
      }
    }
    els.opts.appendChild(frag);
  }

  function syncOptInputs() {
    for (const o of ALL_OPTS) {
      const row = els.opts.querySelector(`[data-opt="${o.id}"]`);
      if (!row) continue;
      const v = optValue(o);
      row.classList.toggle('set', o.kind !== 'font' && v !== undefined && v !== o.factory);
      if (o.kind === 'num') {
        const [r, n] = row.querySelectorAll('input');
        const shown = v !== undefined ? v : (o.def !== undefined ? o.def : o.min);
        r.value = shown;
        if (document.activeElement !== n) n.value = v !== undefined ? v : '';
      } else if (o.kind === 'bool') {
        row.querySelector('select').value = v === undefined ? '' : String(v);
      } else if (o.kind === 'enum') {
        row.querySelector('select').value = v === undefined ? '' : v;
      } else if (o.kind === 'font') {
        const t = row.querySelector('input'); if (document.activeElement !== t) t.value = v || '';
      } else if (o.kind === 'checks') {
        row.querySelectorAll('input').forEach((i) => { i.checked = !!(v && v.includes(i.value)); });
      } else if (o.kind === 'date') {
        row.querySelector('input').value = v || '';
      }
    }
  }

  function onOptChange(o) {
    setStatus(o.path ? o.path.join('.') : 'layout.' + o.key);
    if (o.layout) { applyLayoutOptions(); els.outOpts.textContent = JSON.stringify(exportOptions(), null, 2); }
    else queueApply();
  }

  // ---------------------------------------------------------------------------
  // Frames + infinite canvas
  // ---------------------------------------------------------------------------
  const L_ = (k) => optVals[ALL_OPTS.find((o) => o.layout && o.key === k).id];

  function applyLayoutOptions() {
    const w = L_('frameWidth') || 640, h = L_('frameHeight') || 0, fit = L_('fit') || 'natural';
    for (const f of frames) {
      f.el.style.width = `${w + 26}px`;
      f.el.classList.toggle('fixed-h', h > 0);
      f.host.style.height = h > 0 ? `${h}px` : '';
      f.el.classList.toggle('fit-contain', fit === 'contain' && h > 0);
    }
    scheduleLayout();
  }

  let layoutQueued = 0;
  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = requestAnimationFrame(() => { layoutQueued = 0; layout(); });
  }

  function layout() {
    const cols = Math.max(1, L_('columns') || 6), gap = L_('gap') ?? 48;
    let y = 0;
    for (let r = 0; r * cols < frames.length; r++) {
      const row = frames.slice(r * cols, r * cols + cols);
      let x = 0, rowH = 0;
      for (const f of row) {
        f.el.style.left = `${x}px`; f.el.style.top = `${y}px`;
        x += f.el.offsetWidth + gap;
        rowH = Math.max(rowH, f.el.offsetHeight);
      }
      y += rowH + gap;
    }
    if (!view.userMoved) {
      if (view.mode === 'focus' && view.focused) focusFrame(view.focused, { animate: false, keepUser: true });
      else fitAll({ animate: false, keepUser: true });
    }
  }

  function frameRect(f) {
    return { x: f.el.offsetLeft, y: f.el.offsetTop, w: f.el.offsetWidth, h: f.el.offsetHeight };
  }
  function worldBounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of frames) {
      const r = frameRect(f);
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    }
    return frames.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 1, h: 1 };
  }

  const MIN_S = 0.03, MAX_S = 6;
  function applyCam(animate) {
    els.world.classList.toggle('animating', !!animate);
    els.world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`;
    els.zoomLabel.textContent = `${Math.round(cam.s * 100)}%`;
    if (animate) { clearTimeout(applyCam._t); applyCam._t = setTimeout(() => els.world.classList.remove('animating'), 480); }
  }
  function fitRect(r, margin, animate) {
    const vw = els.themeRoot.clientWidth, vh = els.themeRoot.clientHeight;
    const s = Math.min(MAX_S, Math.max(MIN_S, Math.min((vw - 2 * margin) / r.w, (vh - 2 * margin) / r.h)));
    cam.s = s; cam.x = (vw - r.w * s) / 2 - r.x * s; cam.y = (vh - r.h * s) / 2 - r.y * s;
    applyCam(animate);
  }
  function fitAll({ animate = true, keepUser = false } = {}) {
    view.mode = 'overview'; view.focused = null;
    if (!keepUser) view.userMoved = false;
    frames.forEach((f) => f.el.classList.remove('focused'));
    els.select.value = '';
    fitRect(worldBounds(), 32, animate);
  }
  function focusFrame(id, { animate = true, keepUser = false } = {}) {
    const f = frames.find((x) => x.meta.id === id);
    if (!f) return;
    view.mode = 'focus'; view.focused = id;
    if (!keepUser) view.userMoved = false;
    frames.forEach((x) => x.el.classList.toggle('focused', x === f));
    els.select.value = id;
    fitRect(frameRect(f), 28, animate);
    setStatus(`聚焦 ${f.meta.title}`);
  }
  function stepFocus(d) {
    const i = frames.findIndex((f) => f.meta.id === view.focused);
    const n = frames[(i < 0 ? (d > 0 ? 0 : frames.length - 1) : (i + d + frames.length) % frames.length)];
    focusFrame(n.meta.id);
  }
  function zoomAt(px, py, factor, animate) {
    const s = Math.min(MAX_S, Math.max(MIN_S, cam.s * factor));
    const wx = (px - cam.x) / cam.s, wy = (py - cam.y) / cam.s;
    cam.s = s; cam.x = px - wx * s; cam.y = py - wy * s;
    view.userMoved = true;
    applyCam(animate);
  }
  function zoomCenter(factor) {
    zoomAt(els.themeRoot.clientWidth / 2, els.themeRoot.clientHeight / 2, factor, true);
  }

  function setupCanvas() {
    const vp = els.themeRoot;
    const pts = new Map();
    let drag = null, pinch = null, moved = false;
    const local = (e) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('button, input, select, a, [data-pele-zoom]')) return;
      pts.set(e.pointerId, local(e));
      moved = false;
      if (pts.size === 1) drag = { ...local(e), cx: cam.x, cy: cam.y };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s };
        drag = null;
      }
    });
    vp.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.s * d / pinch.d) / cam.s, false);
        moved = true;
      } else if (drag) {
        const dx = p.x - drag.x, dy = p.y - drag.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) { moved = true; try { vp.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
        vp.classList.add('panning');
        cam.x = drag.cx + dx; cam.y = drag.cy + dy; view.userMoved = true;
        applyCam(false);
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) { drag = null; vp.classList.remove('panning'); }
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    // swallow the click that ends a drag so a frame title doesn't focus
    vp.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      if (e.shiftKey && !e.ctrlKey) { cam.x -= e.deltaY || e.deltaX; view.userMoved = true; applyCam(false); return; }
      const k = e.ctrlKey ? 0.01 : 0.0018; // pinch on trackpads arrives as ctrl+wheel
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(p.x, p.y, Math.exp(-dy * k), false);
    }, { passive: false });
    // Safari gesture events
    vp.addEventListener('gesturestart', (e) => { e.preventDefault(); vp._gs = cam.s; });
    vp.addEventListener('gesturechange', (e) => {
      e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, (vp._gs * e.scale) / cam.s, false);
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.key === 'Escape') fitAll();
      else if (e.key === 'f' || e.key === 'F') fitAll();
      else if (e.key === '+' || e.key === '=') zoomCenter(1.25);
      else if (e.key === '-' || e.key === '_') zoomCenter(0.8);
      else if (e.key === 'ArrowRight') stepFocus(1);
      else if (e.key === 'ArrowLeft') stepFocus(-1);
    });
    new ResizeObserver(() => {
      if (view.userMoved) return;
      if (view.mode === 'focus') focusFrame(view.focused, { animate: false, keepUser: true });
      else fitAll({ animate: false, keepUser: true });
    }).observe(vp);

    $('btn-fit').addEventListener('click', () => fitAll());
    $('btn-overview').addEventListener('click', () => fitAll());
    $('btn-zoom-in').addEventListener('click', () => zoomCenter(1.25));
    $('btn-zoom-out').addEventListener('click', () => zoomCenter(0.8));
    $('btn-zoom-100').addEventListener('click', () => {
      zoomAt(els.themeRoot.clientWidth / 2, els.themeRoot.clientHeight / 2, 1 / cam.s, true);
    });
    $('btn-prev').addEventListener('click', () => stepFocus(-1));
    $('btn-next').addEventListener('click', () => stepFocus(1));
    els.select.addEventListener('change', () => { if (els.select.value) focusFrame(els.select.value); else fitAll(); });
  }

  async function loadDiagrams() {
    const bundled = window.TWEAKPELE_DIAGRAMS || [];
    let manifest = bundled;
    try {
      const res = await fetch('./diagrams/manifest.json', { cache: 'no-store' });
      if (res.ok) manifest = await res.json();
    } catch (_) { /* file:// → use bundle */ }
    return Promise.all(manifest.map(async (m) => {
      const file = `diagrams/${m.id}.mmd`;
      let source = (bundled.find((b) => b.id === m.id) || {}).source;
      try {
        const res = await fetch('./' + file, { cache: 'no-store' });
        if (res.ok) source = await res.text();
      } catch (_) { /* fallback */ }
      return { ...m, file, source: source || '' };
    }));
  }

  function buildFrames(list) {
    const base = liveOptions();
    for (const meta of list) {
      const el = document.createElement('section');
      el.className = 'frame'; el.dataset.frame = meta.id;
      el.innerHTML =
        `<header class="frame-title" title="点击聚焦"><b>${meta.title}</b><code>${meta.file}</code><span class="meta"></span></header>` +
        `<div class="frame-body"><div class="host" id="host-${meta.id}"></div><div class="frame-error"></div></div>`;
      els.world.appendChild(el);
      const f = { meta, el, source: meta.source, host: el.querySelector('.host'), titleEl: el.querySelector('.frame-title'),
        meta_el: el.querySelector('.meta'), errEl: el.querySelector('.frame-error'), mount: null, result: null };
      f.titleEl.addEventListener('click', () => {
        if (view.mode === 'focus' && view.focused === meta.id) fitAll(); else focusFrame(meta.id);
      });
      frames.push(f);
      const opt = document.createElement('option');
      opt.value = meta.id; opt.textContent = meta.title;
      els.select.appendChild(opt);
    }
    applyLayoutOptions();
    for (const f of frames) {
      try { f.mount = pele.mount(f.host, f.source, mountOptsFor(f, base)); }
      catch (e) { console.error(e); f.errEl.textContent = String(e); }
    }
    new ResizeObserver(scheduleLayout).observe(els.world);
    frames.forEach((f) => new ResizeObserver(scheduleLayout).observe(f.el));
  }

  // ---------------------------------------------------------------------------
  // Copy + presets
  // ---------------------------------------------------------------------------
  async function copyText(text, label) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { showToast('复制失败，请手动选中'); ta.remove(); return; }
      ta.remove();
    }
    window.__lastCopied = text;
    showToast(`已复制 ${label}`); setStatus('已复制');
  }

  async function init() {
    if (typeof pele === 'undefined' || typeof pele.mount !== 'function') { setStatus('Pele 未加载'); return; }
    buildVarList();
    buildOptList();
    syncOptInputs();
    applyTheme();
    els.outOpts.textContent = JSON.stringify(exportOptions(), null, 2);
    setupCanvas();
    const list = await loadDiagrams();
    buildFrames(list);

    $('btn-copy').addEventListener('click', () => copyText(buildPeleCssBlock(), '.pele CSS'));
    $('btn-copy-opts').addEventListener('click', () => copyText(JSON.stringify(exportOptions(), null, 2), '渲染参数'));
    $('btn-factory').addEventListener('click', () => {
      optVals = factoryOpts();
      setTheme(FACTORY, '已重置 factory（主题 + 渲染参数）');
      applyLayoutOptions();
    });
    $('btn-dark').addEventListener('click', () => setTheme(DARK, '已加载深色样例'));
    setStatus(`${frames.length} 张图 · ${VAR_META.length} 个变量 · ${ALL_OPTS.length} 个渲染参数`);
    window.tweakpele = { frames, cam, view, fitAll, focusFrame, zoomAt, optVals: () => optVals, theme: () => theme,
      setOpt(groupTitle, key, v) { const o = ALL_OPTS.find((x) => x.group === groupTitle && x.key === key); optVals[o.id] = v; syncOptInputs(); onOptChange(o); },
      buildPeleCssBlock, exportOptions, ALL_OPTS };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
