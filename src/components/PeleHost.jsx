import { useEffect, useRef } from 'react';

/**
 * Imperative wrapper around pele.mount().
 * - Mounts once, destroys on unmount.
 * - `update(source, options)` on every source/options change (live re-render in place).
 * - `bindController` exposes the mount controller (result / zoom / refresh) to the parent.
 */
export default function PeleHost({ source, options, bindController, onResult, onError, className }) {
  const hostRef = useRef(null);
  const ctlRef = useRef(null);
  const firstRef = useRef(true);
  const cbRef = useRef({});
  cbRef.current = { onResult, onError };

  // fresh callback closures for every update call
  const optsWithCallbacks = (opts) => ({
    ...opts,
    onRender: (r) => cbRef.current.onResult && cbRef.current.onResult(r),
    onError: (e) => cbRef.current.onError && cbRef.current.onError(e),
  });

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof pele === 'undefined' || typeof pele.mount !== 'function') return;
    try {
      ctlRef.current = pele.mount(el, source, optsWithCallbacks(options));
      bindController && bindController(ctlRef.current);
    } catch (e) {
      cbRef.current.onError && cbRef.current.onError(e);
    }
    return () => {
      bindController && bindController(null);
      try { ctlRef.current && ctlRef.current.destroy(); } catch (_) { /* ignore */ }
      ctlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; } // initial mount already rendered
    const ctl = ctlRef.current;
    if (!ctl) return;
    try { ctl.update(source, optsWithCallbacks(options)); }
    catch (e) { cbRef.current.onError && cbRef.current.onError(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, options]);

  return <div ref={hostRef} className={'pele-host' + (className ? ' ' + className : '')} />;
}
