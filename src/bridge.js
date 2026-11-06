/**
 * Optional live bridge to the dsh @local/tweakpele plugin.
 * Activates when ?bridge=1 (or ?bridge=http://host:port) is present.
 * Syncs diagram source / active id / theme preset both ways over SSE + POST.
 */
import { useEffect, useRef } from 'react';

export function bridgeEndpoint() {
  try {
    const q = new URLSearchParams(location.search);
    const raw = q.get('bridge');
    if (!raw) return null;
    if (raw === '1' || raw === 'true') return location.origin;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
    return null;
  } catch {
    return null;
  }
}

async function postJson(base, path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bridge ${path} → ${res.status}`);
  return res.json();
}

/**
 * Hook: keep App library/theme in sync with the dsh bridge while connected.
 * Handlers are read from a ref so the EventSource stays stable.
 */
export function useTweakpeleBridge(handlers) {
  const base = bridgeEndpoint();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const applyingRef = useRef(false);
  const lastRevRef = useRef(0);

  useEffect(() => {
    if (!base) return undefined;
    let closed = false;
    let es;

    const applyRemote = (snap) => {
      if (!snap || typeof snap.revision !== 'number') return;
      if (snap.revision <= lastRevRef.current) return;
      lastRevRef.current = snap.revision;
      applyingRef.current = true;
      try {
        handlersRef.current.onRemoteState?.(snap);
      } finally {
        // allow local echo to settle before pushing back
        queueMicrotask(() => { applyingRef.current = false; });
      }
    };

    (async () => {
      try {
        const snap = await fetch(`${base}/api/state`).then((r) => r.json());
        if (!closed) applyRemote(snap);
      } catch (e) {
        console.warn('[tweakpele bridge] initial state failed', e);
      }
      if (closed) return;
      es = new EventSource(`${base}/api/events`);
      es.addEventListener('state', (ev) => {
        try { applyRemote(JSON.parse(ev.data)); }
        catch (e) { console.warn('[tweakpele bridge] bad SSE', e); }
      });
      es.onerror = () => { /* browser auto-reconnects */ };
    })();

    return () => {
      closed = true;
      try { es?.close(); } catch { /* ignore */ }
    };
  }, [base]);

  const pushLocal = async (body) => {
    if (!base || applyingRef.current) return null;
    try {
      const snap = await postJson(base, '/api/state', body);
      if (snap?.revision) lastRevRef.current = Math.max(lastRevRef.current, snap.revision);
      return snap;
    } catch (e) {
      console.warn('[tweakpele bridge] push failed', e);
      return null;
    }
  };

  const pushFeedback = async (feedback) => {
    if (!base) return null;
    try {
      return await postJson(base, '/api/feedback', feedback);
    } catch (e) {
      console.warn('[tweakpele bridge] feedback failed', e);
      return null;
    }
  };

  return { enabled: !!base, base, pushLocal, pushFeedback, isApplying: () => applyingRef.current };
}
