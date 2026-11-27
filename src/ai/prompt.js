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
].join(' ');

/** Fresh context each turn so the model always sees the live diagram. */
function contextPrompt(diagram) {
  return `Current diagram — title: ${diagram.title}; keyword: ${diagram.keyword || '(none)'}.\n`
    + 'Mermaid source:\n```mermaid\n' + (diagram.source || '') + '\n```';
}

export function buildMessages({ diagram, thread }) {
  return [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${contextPrompt(diagram)}` },
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
