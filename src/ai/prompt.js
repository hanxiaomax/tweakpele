/** System prompt + per-turn diagram context + mermaid fence extraction. */

const SUPPORTED_TYPES = [
  'flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie', 'gitGraph', 'mindmap',
  'timeline', 'sankey', 'xyChart', 'quadrantChart', 'kanban', 'architecture', 'radar',
  'packet', 'treemap', 'railroad', 'treeView', 'cynefin', 'usecase', 'agentflow', 'block',
  'journey', 'swimlane', 'requirement', 'c4 (C4Context / C4Container / C4Component)', 'venn',
  'wardley', 'ishikawa', 'eventmodeling', 'info',
];

export const SYSTEM_PROMPT = [
  'You are a diagramming assistant inside tweakpele, a Mermaid theme and render playground.',
  'When you create or revise a diagram, answer with a single ```mermaid fenced code block',
  '(plus at most one short sentence around it). Keep any prose brief.',
  `Use only diagram types the app supports: ${SUPPORTED_TYPES.join(', ')}.`,
  'Do not invent Pele-only syntax — plain Mermaid source only.',
  'Canvas comments and editor excerpts, when present, are the exact spots the user is',
  'pointing at — focus on them while still considering the whole diagram.',
].join(' ');

/** 1-based start/end line of a selection offset range inside `source`. */
export function lineRangeFromOffsets(source, start, end) {
  const src = String(source || '');
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(src.length, Math.max(start, end));
  const before = src.slice(0, s);
  const sel = src.slice(s, e);
  const startLine = before.split('\n').length;
  const lines = sel.split('\n').length;
  return { startLine, endLine: startLine + lines - 1 };
}

/** Fresh context each turn so the model always sees the live diagram. */
function contextPrompt(diagram, { comments = [], excerpts = [] } = {}) {
  let out = `Current diagram — title: ${diagram.title}; keyword: ${diagram.keyword || '(none)'}.\n`
    + 'Mermaid source:\n```mermaid\n' + (diagram.source || '') + '\n```';
  if (comments.length) {
    out += '\n\nCanvas comments (numbered pins on the rendered diagram):';
    for (const c of comments) {
      const pos = `${Math.round(c.nx * 100)}% from left, ${Math.round(c.ny * 100)}% from top`;
      out += `\n#${c.n} at ${pos}${c.nearby ? `, near "${c.nearby}"` : ''} — ${c.text}`;
    }
  }
  if (excerpts.length) {
    out += '\n\nEditor selections the user pointed at:';
    for (const x of excerpts) {
      const range = x.startLine === x.endLine ? `line ${x.startLine}` : `lines ${x.startLine}–${x.endLine}`;
      out += `\n${range}:\n${x.text}`;
    }
  }
  return out;
}

export function buildMessages({ diagram, thread, comments, excerpts }) {
  return [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${contextPrompt(diagram, { comments, excerpts })}` },
    ...thread.map((m) => ({ role: m.role, content: m.content })),
  ];
}

/** Source of the last (or only) ```mermaid fence in a reply, or null. */
export function extractMermaidFence(text) {
  const re = /```mermaid[ \t]*\r?\n([\s\S]*?)```/gi;
  let m;
  let last = null;
  while ((m = re.exec(String(text)))) last = m[1];
  return last === null ? null : last.replace(/\s+$/, '');
}
