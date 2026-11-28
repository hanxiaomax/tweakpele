/** Shared live AI settings (key / base URL / model / remember) + settings-dialog
 *  open state. One module-level store so the dialog, chat panel, and palette
 *  generator never drift; persistence stays in ./settings.js. */
import { useCallback, useSyncExternalStore } from 'react';
import {
  loadSettings, saveSettings, loadApiKey, storeApiKey, clearApiKey,
} from './settings.js';

let state = null;
const listeners = new Set();

/** Public snapshot only — never expose the key through this shape's callers. */
function snapshot() {
  if (!state) {
    const s = loadSettings();
    state = { apiKey: loadApiKey(), baseUrl: s.baseUrl, model: s.model, remember: s.remember };
  }
  return state;
}

function commit(next) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function publicSnapshot() {
  const s = snapshot();
  return { baseUrl: s.baseUrl, model: s.model, remember: s.remember, hasKey: !!s.apiKey };
}

/** Persist public settings and notify every consumer. */
function persistSettings({ baseUrl, model, remember }) {
  saveSettings({ baseUrl, model, remember });
  return { baseUrl, model, remember };
}

/** All AI features share this hook; updates are live across instances. */
export function useAiSettings() {
  const s = useSyncExternalStore(subscribe, snapshot);
  const updateSettings = useCallback((patch) => {
    const cur = snapshot();
    const next = { baseUrl: cur.baseUrl, model: cur.model, remember: cur.remember, ...patch };
    persistSettings(next);
    storeApiKey(cur.apiKey, next.remember); // keep the stored secret in sync with remember
    commit({ ...cur, ...next });
  }, []);
  const changeKey = useCallback((key) => {
    const cur = snapshot();
    storeApiKey(key, cur.remember); // keep the remembered secret in sync
    commit({ ...cur, apiKey: String(key || '') });
  }, []);
  const wipeKey = useCallback(() => { clearKey(); }, []);
  return {
    apiKey: s.apiKey, baseUrl: s.baseUrl, model: s.model, remember: s.remember,
    hasKey: !!s.apiKey, updateSettings, changeKey, wipeKey,
  };
}

/** Plain (non-hook) key writes for the test console hook. */
export function setKey(key, { remember } = {}) {
  const cur = snapshot();
  const next = persistSettings({
    baseUrl: cur.baseUrl, model: cur.model,
    remember: remember === undefined ? cur.remember : !!remember,
  });
  storeApiKey(key || '', next.remember);
  commit({ ...next, apiKey: String(key || '') });
}

/** Wipe the key everywhere and turn remember off. */
export function clearKey() {
  clearApiKey();
  const cur = snapshot();
  commit({ ...cur, apiKey: '', ...persistSettings({ baseUrl: cur.baseUrl, model: cur.model, remember: false }) });
}

export { publicSnapshot as getPublicSettings };

// ------------------------------------------------------------------ dialog open state
let settingsOpen = false;
const openListeners = new Set();

export function useAiSettingsOpen() {
  return useSyncExternalStore(
    (l) => { openListeners.add(l); return () => openListeners.delete(l); },
    () => settingsOpen,
  );
}

export function openSettings() {
  settingsOpen = true;
  for (const l of openListeners) l();
}

export function closeSettings() {
  settingsOpen = false;
  for (const l of openListeners) l();
}

/** Test hook, available even before App mounts. Never includes the key string. */
if (typeof window !== 'undefined') {
  const hook = window.__tweakpeleAi || {};
  hook.getPublicSettings = publicSnapshot;
  hook.setKey = setKey;
  hook.clearKey = clearKey;
  hook.openSettings = openSettings;
  hook.closeSettings = closeSettings;
  window.__tweakpeleAi = hook;
}
