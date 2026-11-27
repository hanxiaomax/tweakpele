/** Per-diagram chat threads (`tweakpele.ai.threads.v1`).
 *  Messages only — never the API key or settings (those live elsewhere). */
import { loadJSON, saveJSON } from '../lib.js';

const THREADS_KEY = 'tweakpele.ai.threads.v1';
const MAX_MESSAGES = 60; // cap per thread so localStorage stays bounded

export function loadThread(diagramId) {
  const all = loadJSON(THREADS_KEY, {}) || {};
  const t = all[diagramId];
  if (!t || !Array.isArray(t.messages)) return [];
  return t.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant')
    && typeof m.content === 'string');
}

export function saveThread(diagramId, messages) {
  const all = loadJSON(THREADS_KEY, {}) || {};
  if (messages.length) all[diagramId] = { messages: messages.slice(-MAX_MESSAGES) };
  else delete all[diagramId];
  saveJSON(THREADS_KEY, all);
}
