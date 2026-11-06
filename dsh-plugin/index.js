/**
 * @local/tweakpele — Cordis Host plugin for DeepSeek Harness.
 * Registers model-facing tools that drive a local tweakpele bridge
 * (Mermaid source + theme presets) with editor mode as the default open URL.
 *
 * Named exports only (no default) so Cordis loader keeps `inject`.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { createBridgeServer } from './bridge-server.js';
import { spawn } from 'node:child_process';

export const name = 'tweakpele';

export const inject = ['tools', 'systemPrompt'];

/**
 * @typedef {object} Config
 * @property {string} [host]
 * @property {number} [port]
 * @property {string} [staticRoot]
 * @property {boolean} [autoStart]
 * @property {boolean} [openBrowser]
 */

/** @param {import('@deepseek-ai/cordis').Context} ctx @param {Config} [config] */
export function apply(ctx, config = {}) {
  const host = typeof config.host === 'string' && config.host ? config.host : '127.0.0.1';
  const port = Number.isFinite(Number(config.port)) ? Number(config.port) : 3847;
  const staticRoot = typeof config.staticRoot === 'string' && config.staticRoot
    ? config.staticRoot
    : undefined;
  const autoStart = config.autoStart !== false;
  const openBrowser = config.openBrowser === true;

  const bridge = createBridgeServer({ host, port, staticRoot });
  let startPromise = null;

  async function ensureStarted() {
    if (bridge.started) return bridge.info();
    if (!startPromise) {
      startPromise = bridge.start().catch((err) => {
        startPromise = null;
        throw err;
      });
    }
    return startPromise;
  }

  function maybeOpen(url) {
    if (!openBrowser) return;
    try {
      const cmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'cmd'
          : 'xdg-open';
      const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
      spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    } catch { /* optional */ }
  }

  function activeDiagram() {
    const snap = bridge.snapshot();
    return snap.diagrams.find((d) => d.id === snap.activeId) || null;
  }

  const text = (value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }];

  ctx.effect(() => {
    if (autoStart) {
      ensureStarted().catch((err) => {
        ctx.emit?.('logger/error', err) || console.error('[tweakpele] autoStart failed:', err);
      });
    }
    return () => {
      startPromise = null;
      return bridge.stop();
    };
  });

  ctx.systemPrompt.section({
    name: 'tool:tweakpele',
    order: 5200,
    text: () => [
      '## tweakpele (Mermaid + Pele themes)',
      'Use tweakpele_* tools to edit diagrams with the user in real time.',
      'Workflow: tweakpele_start → tweakpele_set_source / tweakpele_apply_theme → tweakpele_get_feedback.',
      'The playground opens in **editor mode** by default (split Mermaid source + live preview).',
      'After each source change, call tweakpele_get_feedback (wait briefly if clients=0) to read render ok/error from the browser.',
      'Prefer iterative small edits over rewriting the whole diagram unless asked.',
    ].join('\n'),
  });

  ctx.tools.register(defineTool({
    name: 'tweakpele_start',
    description: 'Start the local tweakpele bridge (static playground + live sync API) and return the editor URL. Idempotent.',
    parameters: {
      openBrowser: {
        type: 'boolean',
        description: 'If true, try to open the editor URL in a browser once.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          editorUrl: { type: 'string', required: true },
          baseUrl: { type: 'string', required: true },
          port: { type: 'number', required: true },
          activeId: { type: 'string' },
          clients: { type: 'number' },
        },
      },
      render: (_args, value) => text(value),
    },
    async execute(args) {
      const info = await ensureStarted();
      const snap = bridge.snapshot();
      if (args.openBrowser === true || openBrowser) maybeOpen(info.editorUrl);
      return {
        ...info,
        activeId: snap.activeId,
        clients: snap.clients,
        mode: 'edit',
        hint: 'Open editorUrl; browser connects via ?bridge=1 for live AI sync.',
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_status',
    description: 'Read current tweakpele bridge state: active diagram, source preview, theme preset, connected browser clients, last render feedback.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute() {
      if (!bridge.started) await ensureStarted();
      const snap = bridge.snapshot();
      const d = activeDiagram();
      return {
        started: bridge.started,
        revision: snap.revision,
        mode: snap.mode,
        activeId: snap.activeId,
        title: d?.title ?? null,
        source: d?.source ?? null,
        themePresetId: snap.themePresetId,
        clients: snap.clients,
        feedback: snap.feedback,
        editorUrl: snap.url,
        diagramCount: snap.diagrams.length,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_list_diagrams',
    description: 'List diagrams in the tweakpele library (id, title, keyword).',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute() {
      if (!bridge.started) await ensureStarted();
      const snap = bridge.snapshot();
      return {
        activeId: snap.activeId,
        diagrams: snap.diagrams.map((d) => ({ id: d.id, title: d.title, keyword: d.keyword })),
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_open_editor',
    description: 'Select a diagram and switch the playground to editor mode (default UX). Broadcasts to connected browsers.',
    parameters: {
      id: { type: 'string', description: 'Diagram id. Omit to keep the current active diagram.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute(args) {
      if (!bridge.started) await ensureStarted();
      const patch = { mode: 'edit' };
      if (typeof args.id === 'string' && args.id) patch.activeId = args.id;
      const snap = bridge.applyPatch(patch);
      const d = snap.diagrams.find((x) => x.id === snap.activeId);
      return {
        activeId: snap.activeId,
        title: d?.title ?? null,
        mode: snap.mode,
        editorUrl: snap.url,
        clients: snap.clients,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_get_source',
    description: 'Get the Mermaid source of the active diagram (or a named id).',
    parameters: {
      id: { type: 'string', description: 'Diagram id; defaults to the active editor diagram.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute(args) {
      if (!bridge.started) await ensureStarted();
      const snap = bridge.snapshot();
      const id = args.id || snap.activeId;
      const d = snap.diagrams.find((x) => x.id === id);
      if (!d) throw new Error(`diagram not found: ${id}`);
      return { id: d.id, title: d.title, keyword: d.keyword, source: d.source };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_set_source',
    description: 'Replace Mermaid source for a diagram and push live to connected tweakpele browsers (editor updates immediately).',
    parameters: {
      source: { type: 'string', required: true, description: 'Full Mermaid source text.' },
      id: { type: 'string', description: 'Diagram id; defaults to active.' },
      title: { type: 'string', description: 'Optional new title.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute(args) {
      if (!bridge.started) await ensureStarted();
      const source = String(args.source ?? '');
      if (!source.trim()) throw new Error('source must be a non-empty string');
      const body = { source, mode: 'edit' };
      if (args.id) body.diagramId = args.id;
      if (typeof args.title === 'string') body.title = args.title;
      const snap = bridge.applyPatch(body);
      const d = snap.diagrams.find((x) => x.id === snap.activeId);
      return {
        ok: true,
        activeId: snap.activeId,
        title: d?.title ?? null,
        sourceLength: source.length,
        clients: snap.clients,
        revision: snap.revision,
        note: snap.clients === 0
          ? 'No browser connected yet — open editorUrl from tweakpele_start; feedback will appear after connect.'
          : 'Pushed to connected browsers; call tweakpele_get_feedback after a short wait.',
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_create_diagram',
    description: 'Create a new diagram, select it in editor mode, and optionally set initial Mermaid source.',
    parameters: {
      title: { type: 'string', description: 'Diagram title.' },
      source: { type: 'string', description: 'Initial Mermaid source.' },
      keyword: { type: 'string', description: 'Diagram type keyword (flowchart, sequenceDiagram, …).' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute(args) {
      if (!bridge.started) await ensureStarted();
      const snap = bridge.applyPatch({
        create: {
          title: args.title,
          source: args.source,
          keyword: args.keyword,
        },
      });
      const d = snap.diagrams.find((x) => x.id === snap.activeId);
      return {
        id: snap.activeId,
        title: d?.title ?? null,
        source: d?.source ?? null,
        editorUrl: snap.url,
        clients: snap.clients,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_list_presets',
    description: 'List tweakcn-aligned Pele theme preset ids and labels available in tweakpele.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute() {
      return { presets: bridge.presets() };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_apply_theme',
    description: 'Apply a named theme preset (tweakcn-aligned) to the playground; connected browsers update CSS variables live.',
    parameters: {
      presetId: {
        type: 'string',
        required: true,
        description: 'Preset id from tweakpele_list_presets (e.g. paper, dark-ink, catppuccin, vercel).',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute(args) {
      if (!bridge.started) await ensureStarted();
      const id = String(args.presetId || '').trim();
      const found = bridge.presets().find((p) => p.id === id || p.label.toLowerCase() === id.toLowerCase());
      if (!found) throw new Error(`unknown preset: ${id}`);
      const snap = bridge.applyPatch({ themePresetId: found.id });
      return {
        ok: true,
        themePresetId: found.id,
        label: found.label,
        clients: snap.clients,
        revision: snap.revision,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'tweakpele_get_feedback',
    description: 'Read the latest Pele render feedback from the browser (ok / error / size). Use after set_source to verify the diagram.',
    parameters: {
      waitMs: {
        type: 'number',
        description: 'Optional wait (ms) for fresh feedback when a browser is connected. Caps at 8000.',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_a, v) => text(v),
    },
    async execute(args, exec) {
      if (!bridge.started) await ensureStarted();
      const waitMs = Math.min(Math.max(Number(args.waitMs) || 0, 0), 8000);
      const before = bridge.snapshot().feedback?.at || null;
      if (waitMs > 0) {
        const start = Date.now();
        while (Date.now() - start < waitMs) {
          if (exec.signal?.aborted) throw new Error('aborted');
          const snap = bridge.snapshot();
          if (snap.feedback && snap.feedback.at !== before) break;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      const snap = bridge.snapshot();
      return {
        clients: snap.clients,
        feedback: snap.feedback,
        activeId: snap.activeId,
        note: !snap.clients
          ? 'No browser connected — open the editorUrl from tweakpele_start.'
          : snap.feedback
            ? undefined
            : 'Browser connected but no render feedback yet; wait and retry.',
      };
    },
  }));
}
