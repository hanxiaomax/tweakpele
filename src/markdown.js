/** Markdown splitting shared by the preview view and the render CLI. */

// Fenced ```mermaid blocks: ``` or ~~~ fences (>=3 chars, <=3 spaces indent), exact info string.
export function findMermaidBlocks(lines) {
  const blocks = [];
  const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fence);
    if (!m || m[2].trim() !== 'mermaid') continue;
    const ch = m[1][0];
    const len = m[1].length;
    const indent = lines[i].length - lines[i].trimStart().length;
    const close = new RegExp(`^ {0,3}${ch === '`' ? '`' : '~'}{${len},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !close.test(lines[j])) j++;
    if (j >= lines.length) continue;
    const dedent = new RegExp(`^ {0,${indent}}`);
    blocks.push({ line: i + 1, closeIdx: j, source: lines.slice(i + 1, j).map((l) => l.replace(dedent, '')).join('\n') });
    i = j;
  }
  return blocks;
}

// The image line the render CLI inserts after a closing fence (any relative path, hash-named svg).
const CLI_IMAGE_LINE = /^!\[\]\([^)\s]*[0-9a-f]{10}\.svg\)$/;

/** Split Markdown text into { kind: 'md', text } and { kind: 'mermaid', source } segments,
 *  in document order; the CLI image line after a block is skipped (the live diagram replaces it). */
export function markdownSegments(text) {
  const lines = String(text || '').split(/\r?\n/);
  const segments = [];
  let cursor = 0;
  for (const b of findMermaidBlocks(lines)) {
    const md = lines.slice(cursor, b.line - 1).join('\n');
    if (md.trim()) segments.push({ kind: 'md', text: md });
    segments.push({ kind: 'mermaid', source: b.source });
    cursor = b.closeIdx + 1;
    if (cursor < lines.length && CLI_IMAGE_LINE.test(lines[cursor].trim())) cursor++;
    else if (cursor + 1 < lines.length && lines[cursor].trim() === '' && CLI_IMAGE_LINE.test(lines[cursor + 1].trim())) cursor += 2;
  }
  const tail = lines.slice(cursor).join('\n');
  if (tail.trim()) segments.push({ kind: 'md', text: tail });
  return segments;
}
