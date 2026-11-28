/** Per-diagram chat threads (`tweakpele.ai.threads.v1`).
 *  Messages plus optional user-message `attachments` metadata (editor excerpt
 *  remnants) — never the API key or settings (those live elsewhere). */
import { loadJSON, saveJSON } from '../lib.js';

const THREADS_KEY = 'tweakpele.ai.threads.v1';
const MAX_MESSAGES = 60; // cap per thread so localStorage stays bounded
const MAX_ATTACHMENTS = 8; // per message, remnant previews only

/** Safe excerpt remnant: numeric offsets/lines + string text, nothing else. */
function sanitizeAttachments(a) {
  if (!Array.isArray(a)) return undefined;
  const out = [];
  for (const x of a) {
    if (!x || typeof x !== 'object') continue;
    const ok = [x.start, x.end, x.startLine, x.endLine].every((n) => Number.isFinite(n));
    if (!ok || typeof x.text !== 'string') continue;
    out.push({
      start: x.start, end: x.end,
      startLine: x.startLine, endLine: x.endLine,
      text: x.text.slice(0, 800),
    });
    if (out.length >= MAX_ATTACHMENTS) break;
  }
  return out.length ? out : undefined;
}

export function loadThread(diagramId) {
  const all = loadJSON(THREADS_KEY, {}) || {};
  const t = all[diagramId];
  if (!t || !Array.isArray(t.messages)) return [];
  return t.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant')
      && typeof m.content === 'string')
    .map((m) => {
      if (m.role !== 'user') return { role: m.role, content: m.content };
      const attachments = sanitizeAttachments(m.attachments);
      return attachments ? { role: m.role, content: m.content, attachments } : { role: m.role, content: m.content };
    });
}

export function saveThread(diagramId, messages) {
  const all = loadJSON(THREADS_KEY, {}) || {};
  if (messages.length) all[diagramId] = { messages: messages.slice(-MAX_MESSAGES) };
  else delete all[diagramId];
  saveJSON(THREADS_KEY, all);
}
