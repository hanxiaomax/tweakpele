/** System prompt + robust JSON extraction for AI palette generation. */

import { COLOR_VARS } from '../palettes.js';

export function buildPaletteMessages(prompt) {
  const tokens = COLOR_VARS.map((m) => m.name).join(', ');
  const system = [
    'You design color palettes for Pele diagram themes.',
    'Reply with ONLY a JSON object, no prose, shaped like',
    '{"label": string, "tone": "light"|"dark", "description": string, "vars": {…}}.',
    `"vars" must define every color token: ${tokens}.`,
    'Values are hex colors such as "#1c1b1a". Pick the tone first, then a coherent, readable palette for it.',
    'Do NOT invent fonts, sizes, weights, or radii — those tokens are applied locally and any you send are overwritten.',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: String(prompt || '').trim() },
  ];
}

/** Parse raw JSON or a ```json fence out of a model reply; null when unusable. */
export function extractPaletteJson(reply) {
  const text = String(reply || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}
