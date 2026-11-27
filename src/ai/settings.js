/** Bring-your-own-key settings. The API key is memory-only unless 记住这台设备. */
import { loadJSON, saveJSON } from '../lib.js';

const SETTINGS_KEY = 'tweakpele.ai.settings.v1';
const SECRET_KEY = 'tweakpele.ai.secret.v1';

export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_MODEL = 'gpt-4o';

// Survives remounts within the page session; never written anywhere unless remembered.
let memoryKey = '';

/** Public settings only — this object never contains the key. */
export function loadSettings() {
  const s = loadJSON(SETTINGS_KEY, {}) || {};
  return {
    baseUrl: typeof s.baseUrl === 'string' && s.baseUrl.trim() ? s.baseUrl.trim() : DEFAULT_BASE_URL,
    model: typeof s.model === 'string' && s.model.trim() ? s.model.trim() : DEFAULT_MODEL,
    remember: s.remember === true,
  };
}

export function saveSettings({ baseUrl, model, remember }) {
  saveJSON(SETTINGS_KEY, { baseUrl: String(baseUrl).trim(), model: String(model).trim(), remember: !!remember });
}

/** Key visible this session: memory first, then the remembered one. */
export function loadApiKey() {
  if (memoryKey) return memoryKey;
  if (!loadSettings().remember) return '';
  try {
    const v = localStorage.getItem(SECRET_KEY);
    return typeof v === 'string' ? v : '';
  } catch (_) { return ''; }
}

/** Memory always; localStorage (`tweakpele.ai.secret.v1`) only while remembered. */
export function storeApiKey(key, remember) {
  memoryKey = String(key || '');
  try {
    if (remember && memoryKey) localStorage.setItem(SECRET_KEY, memoryKey);
    else localStorage.removeItem(SECRET_KEY);
  } catch (_) { /* private mode */ }
}

/** Wipe the key everywhere and turn remember off. */
export function clearApiKey() {
  memoryKey = '';
  try { localStorage.removeItem(SECRET_KEY); } catch (_) { /* private mode */ }
}
