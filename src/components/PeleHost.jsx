import { memo, useEffect, useRef, useState } from 'react';


/** Limit concurrent pele.mount calls so opening gallery/canvas does not jam the main thread. */
let inflight = 0;
const MAX_INFLIGHT = 3;
const waiters = [];
function acquireMountSlot() {
  return new Promise((resolve) => {
    const go = () => {
      if (inflight >= MAX_INFLIGHT) { waiters.push(go); return; }
      inflight += 1;
      resolve(() => {
        inflight = Math.max(0, inflight - 1);
        const next = waiters.shift();
        if (next) next();
      });
    };
    go();
  });
}

function optsKey(options) {
  try { return JSON.stringify(options); } catch (_) { return String(options); }
}

/** Wrap pele options with onRender/onError trampolines through the ref (stable identities). */
function withCallbacks(cbRef, opts) {
  return {
    ...opts,
    onRender: (r) => cbRef.current.onResult && cbRef.current.onResult(r),
    onError: (e) => cbRef.current.onError && cbRef.current.onError(e),
  };
}

/**
 * Imperative wrapper around pele.mount().
 * - Mounts once (or when `active` becomes true), destroys on unmount / inactive.
 * - `update(source, options)` only when source or options content actually change.
 * - `lazy`: wait until near viewport (IntersectionObserver) before mounting.
 */
function PeleHost({ source, options, bindController, onResult, onError, className, lazy = false, active = true }) {
  const hostRef = useRef(null);
  const wrapRef = useRef(null);
  const ctlRef = useRef(null);
  const mountedSrcRef = useRef(null);
  const mountedOptsRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onResult, onError, bindController };

  const [visible, setVisible] = useState(!lazy);

  useEffect(() => {
    if (!lazy) { setVisible(true); return; }
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    let shown = false;
    const io = new IntersectionObserver((entries) => {
      if (!shown && entries.some((e) => e.isIntersecting || e.intersectionRatio > 0)) {
        shown = true;
        setVisible(true);
      }
    }, { root: null, rootMargin: '200px 0px', threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [lazy]);

  const shouldMount = active && visible;

  useEffect(() => {
    let cancelled = false;
    let release = null;
    if (!shouldMount) {
      if (ctlRef.current) {
        try { ctlRef.current.destroy(); } catch (_) { /* ignore */ }
        ctlRef.current = null;
        mountedSrcRef.current = null;
        mountedOptsRef.current = null;
        cbRef.current.bindController && cbRef.current.bindController(null);
      }
      return;
    }
    const el = hostRef.current;
    if (!el || typeof pele === 'undefined' || typeof pele.mount !== 'function') return;

    (async () => {
      release = await acquireMountSlot();
      if (cancelled || !hostRef.current) { release && release(); return; }
      try {
        ctlRef.current = pele.mount(hostRef.current, source, withCallbacks(cbRef, options));
        mountedSrcRef.current = source;
        mountedOptsRef.current = optsKey(options);
        cbRef.current.bindController && cbRef.current.bindController(ctlRef.current);
      } catch (e) {
        cbRef.current.onError && cbRef.current.onError(e);
      } finally {
        release && release();
        release = null;
      }
    })();

    return () => {
      cancelled = true;
      cbRef.current.bindController && cbRef.current.bindController(null);
      try { ctlRef.current && ctlRef.current.destroy(); } catch (_) { /* ignore */ }
      ctlRef.current = null;
      mountedSrcRef.current = null;
      mountedOptsRef.current = null;
      if (release) release();
    };
    // remount only when becoming active/visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMount]);

  useEffect(() => {
    if (!shouldMount || !ctlRef.current) return;
    const nextOpts = optsKey(options);
    if (mountedSrcRef.current === source && mountedOptsRef.current === nextOpts) return;
    mountedSrcRef.current = source;
    mountedOptsRef.current = nextOpts;
    try {
      ctlRef.current.update(source, withCallbacks(cbRef, options));
    } catch (e) {
      cbRef.current.onError && cbRef.current.onError(e);
    }
  }, [source, options, shouldMount]);

  return (
    <div ref={wrapRef} className={'pele-host-wrap' + (className ? ' ' + className : '')}>
      {shouldMount
        ? <div ref={hostRef} className="pele-host" />
        : <div className="pele-host pele-host-placeholder" aria-hidden="true" />}
    </div>
  );
}

export default memo(PeleHost);
