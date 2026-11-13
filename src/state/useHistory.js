import { useCallback, useEffect, useRef, useState } from 'react';

const CAP = 100;
const SETTLE_MS = 400;

function sameDoc(a, b) {
  return a.vars === b.vars && a.optVals === b.optVals
    && a.overrides === b.overrides && a.diagrams === b.diagrams;
}

/** Session-only undo/redo over an immutable doc state { vars, optVals, overrides, diagrams }.
 *  Bursts coalesce: a step is recorded only after the state stays unchanged for SETTLE_MS.
 *  Restoring via undo/redo sets the state back to the committed step, so it never records.
 *  While `enabled` is false (share-snapshot session) nothing records and undo/redo no-op. */
export function useHistory({ state, apply, enabled = true, onAction }) {
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const committedRef = useRef(state); // last state history considers "current"
  const pendingRef = useRef(null); // un-settled state awaiting its step
  const timerRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const record = (before, after) => {
    committedRef.current = after;
    setPast((p) => [...p, before].slice(-CAP));
    setFuture([]);
  };

  const flush = () => {
    if (!timerRef.current) return false;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    record(committedRef.current, pendingRef.current);
    pendingRef.current = null;
    return true;
  };

  useEffect(() => {
    if (!enabled) return undefined;
    if (sameDoc(committedRef.current, state)) return undefined;
    pendingRef.current = state;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      record(committedRef.current, pendingRef.current);
      pendingRef.current = null;
    }, SETTLE_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.vars, state.optVals, state.overrides, state.diagrams, enabled]);

  // Session start/end: drop everything so session state never leaks into history (or vice versa).
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    setPast([]);
    setFuture([]);
    committedRef.current = stateRef.current;
  }, [enabled]);

  const undo = useCallback(() => {
    if (!enabled) return false;
    flush();
    if (!past.length) return false;
    const prev = past[past.length - 1];
    const cur = committedRef.current;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [cur, ...f]);
    committedRef.current = prev;
    apply(prev);
    onAction?.('Undo');
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, past, apply, onAction]);

  const redo = useCallback(() => {
    if (!enabled) return false;
    // A settled-but-unrecorded edit just landed: record it (clearing future), redo stays a no-op.
    if (flush()) return false;
    if (!future.length) return false;
    const next = future[0];
    const cur = committedRef.current;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, cur].slice(-CAP));
    committedRef.current = next;
    apply(next);
    onAction?.('Redo');
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, future, apply, onAction]);

  const undoRef = useRef(undo); undoRef.current = undo;
  const redoRef = useRef(redo); redoRef.current = redo;

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const isUndo = k === 'z' && !e.shiftKey;
      const isRedo = k === 'y' || (k === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
      const done = isUndo ? undoRef.current() : redoRef.current();
      if (done) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { undo, redo, canUndo: enabled && past.length > 0, canRedo: enabled && future.length > 0 };
}
