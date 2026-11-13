import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VAR_META, FACTORY, DARK, REMEASURE_VARS,
  factoryOpts, buildMountOptions, exportOptions, peleCssBlock,
} from '../constants.js';
import { useDebounced, usePersistedState } from '../lib.js';

const VARS_KEY = 'tweakpele.vars.v1';
const OPTS_KEY = 'tweakpele.opts.v1';
const THEME_KEY = 'tweakpele.siteTheme';

/** Global theme state: light/dark site theme, CSS vars, render options,
 *  and the derived CSS block / options JSON / shared mount options.
 *  A session overlay (share snapshot) shadows vars/optVals without writing localStorage. */
export function useThemeState({ notify, setStatus }) {
  const [siteTheme, setSiteTheme] = usePersistedState(THEME_KEY, (v) => (v === 'dark' ? 'dark' : 'light'));
  const [storedVars, setStoredVars] = usePersistedState(VARS_KEY, (v) => ({ ...FACTORY, ...v }));
  const [storedOptVals, setStoredOptVals] = usePersistedState(OPTS_KEY, (v) => ({ ...factoryOpts(), ...v }));
  const [session, setSession] = useState(null); // { vars, optVals } | null
  const [remeasureTick, setRemeasureTick] = useState(0);

  useEffect(() => { document.documentElement.dataset.theme = siteTheme; }, [siteTheme]);

  const vars = session ? session.vars : storedVars;
  const optVals = session ? session.optVals : storedOptVals;

  const setVars = useCallback((updater) => {
    const apply = (prev) => (typeof updater === 'function' ? updater(prev) : updater);
    if (session) setSession((s) => ({ ...s, vars: apply(s.vars) }));
    else setStoredVars(updater);
  }, [session]);

  const setOptVals = useCallback((updater) => {
    const apply = (prev) => (typeof updater === 'function' ? updater(prev) : updater);
    if (session) setSession((s) => ({ ...s, optVals: apply(s.optVals) }));
    else setStoredOptVals(updater);
  }, [session]);

  const forgetMeasures = useCallback(() => {
    try { pele.forgetTextWidths(); } catch (_) { /* pele not loaded */ }
    setRemeasureTick((t) => t + 1);
  }, []);

  const applySnapshotTheme = useCallback((nextVars, nextOptVals) => {
    setSession({
      vars: { ...FACTORY, ...nextVars },
      optVals: { ...factoryOpts(), ...nextOptVals },
    });
    forgetMeasures();
  }, [forgetMeasures]);

  const clearSnapshotTheme = useCallback(() => {
    setSession(null);
    forgetMeasures();
  }, [forgetMeasures]);

  // ------------------------------------------------------------------ derived
  const cssBlock = useMemo(() => peleCssBlock(vars), [vars]);
  const optionsJson = useMemo(() => JSON.stringify(exportOptions(optVals, vars), null, 2), [optVals, vars]);
  const mountOptions = useMemo(
    () => buildMountOptions(optVals, vars),
    // fonts feed mount options; the tick covers radius/weight changes that need a re-measure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optVals, vars['--pele-font'], vars['--pele-font-mono'], remeasureTick]
  );
  const varsStyle = useMemo(() => {
    const o = {};
    for (const { name } of VAR_META) o[name] = vars[name];
    return o;
  }, [vars]);

  // Debounced raw inputs so per-diagram option rebuilds stay as calm as the shared bases.
  const debouncedOptVals = useDebounced(optVals, 280);
  const debouncedVars = useDebounced(vars, 280);

  // ------------------------------------------------------------------ theme actions
  const applyTheme = useCallback(({ vars: nextVars, optVals: nextOptVals }) => {
    setVars(nextVars);
    setOptVals(nextOptVals);
    forgetMeasures();
  }, [setVars, setOptVals, forgetMeasures]);
  const applyPresetVars = useCallback((presetVars) => {
    setVars({ ...presetVars });
    forgetMeasures();
  }, [forgetMeasures, setVars]);
  const applyThemePreset = useCallback((preset) => {
    applyPresetVars(preset.vars);
    notify(`Applied ${preset.label}`);
    setStatus(`Theme · ${preset.label}`);
    // bridge may not exist yet on first render of this callback identity; App's effect wires the push
    try { window.__tweakpelePushTheme?.(preset.id); } catch (_) { /* ignore */ }
  }, [applyPresetVars, notify]);

  const toggleTheme = () => {
    const next = siteTheme === 'light' ? 'dark' : 'light';
    if (!session) setSiteTheme(next);
    notify(`Site theme · ${next}`);
  };
  const resetFactory = () => {
    setOptVals(factoryOpts());
    applyPresetVars(FACTORY);
    notify('Factory theme & options restored');
  };
  const loadDarkSample = () => {
    applyPresetVars(DARK);
    notify('Dark ink sample applied');
  };

  // ------------------------------------------------------------------ toolbox actions
  const onVarChange = useCallback((name, value) => {
    if (REMEASURE_VARS.has(name)) forgetMeasures();
    setVars((v) => (v[name] === value ? v : { ...v, [name]: value }));
    setStatus(name);
  }, [forgetMeasures, setVars]);
  const onOptChange = useCallback((o, value) => {
    setOptVals((v) => ({ ...v, [o.id]: value }));
    setStatus(o.path ? o.path.join('.') : o.key);
  }, [setOptVals]);
  const onOptReset = useCallback((o) => {
    setOptVals((v) => {
      const next = { ...v };
      if (o.factory !== undefined) next[o.id] = o.factory; else delete next[o.id];
      return next;
    });
    setStatus(`${o.key} → default`);
  }, [setOptVals]);

  return {
    siteTheme, vars, optVals, setVars, setOptVals, remeasureTick, forgetMeasures,
    cssBlock, optionsJson, mountOptions, varsStyle,
    debouncedOptVals, debouncedVars,
    applyPresetVars, applyThemePreset, applyTheme, toggleTheme, resetFactory, loadDarkSample,
    onVarChange, onOptChange, onOptReset,
    snapshotActive: !!session, applySnapshotTheme, clearSnapshotTheme,
  };
}
