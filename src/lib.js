/** Shared helpers: persistence, clipboard, hash routing, timing. */
import { useEffect, useState } from 'react';

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : v;
  } catch (_) { return fallback; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* private mode */ }
}

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (_) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }
}

/** Hash route: '#/' gallery · '#/edit/<id>' split editor.
 *  Empty hash (first open) is redirected to editor by App — editor is the default mode. */
export function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  const m = h.match(/^\/edit\/(.+)$/);
  if (m) return { view: 'edit', id: decodeURIComponent(m[1]) };
  return { view: 'gallery' };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(route) {
  const h = route.view === 'edit' ? `#/edit/${encodeURIComponent(route.id)}` : '#/';
  if (location.hash !== h) location.hash = h;
}

/** Debounce a fast-changing value (used so 36 gallery cards don't re-render per slider tick). */
export function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** useState that persists to localStorage under `key`. `init` is a value or (stored) => value. */
export function usePersistedState(key, init) {
  const [value, setValue] = useState(() => {
    const stored = loadJSON(key, undefined);
    return typeof init === 'function' ? init(stored) : stored ?? init;
  });
  useEffect(() => { saveJSON(key, value); }, [key, value]);
  return [value, setValue];
}

export function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
