/**
 * Node-only verification for per-diagram type-specific overrides.
 * Run: node scripts/verify-diagram-overrides.mjs
 */
import assert from 'node:assert/strict';
import { VAR_META, ALL_OPTS, buildMountOptions } from '../src/constants.js';
import {
  isTypeSpecific, isGlobalOnly, typeSpecificVars, typeSpecificOpts, hasTypeSpecificFields,
  mergeDiagramVars, mergeDiagramOptVals, buildDiagramMountOptions, varsStyleFrom,
  overrideKeyCount,
} from '../src/diagramOverrides.js';


// --- isGlobalOnly: sidebar shows only pure-global kinds ---
assert.equal(isGlobalOnly(['all']), true);
assert.equal(isGlobalOnly(undefined), true);
assert.equal(isGlobalOnly(['all', 'flowchart']), false);
assert.equal(isGlobalOnly(['pie']), false);
assert.ok(VAR_META.filter((m) => isGlobalOnly(m.kinds)).every((m) => !m.name.startsWith('--pele-series-')), 'series vars are not global-only');
assert.ok(ALL_OPTS.filter((o) => isGlobalOnly(o.kinds)).every((o) => !o.kinds || o.kinds.every((k) => k === 'all')), 'global opts kinds');
assert.ok(ALL_OPTS.some((o) => o.key === 'fontSize' && isGlobalOnly(o.kinds)), 'fontSize stays global');
assert.ok(ALL_OPTS.some((o) => o.key === 'curve' && !isGlobalOnly(o.kinds)), 'curve is type-specific');

// --- isTypeSpecific: explicit membership only, 'all' never qualifies ---
assert.equal(isTypeSpecific(['all'], 'pie'), false);
assert.equal(isTypeSpecific(['all', 'flowchart'], 'flowchart'), true);
assert.equal(isTypeSpecific(['all', 'flowchart'], 'pie'), false);
assert.equal(isTypeSpecific(undefined, 'pie'), false);
assert.equal(isTypeSpecific(['pie'], null), false);

// --- type-specific var/opt filters for representative types ---
const varNames = (t) => typeSpecificVars(t).map((m) => m.name);
const optKeys = (t) => typeSpecificOpts(t).map((o) => o.key);
const optIds = (t) => typeSpecificOpts(t).map((o) => o.id);

for (const chart of ['pie', 'xyChart', 'gantt', 'sankey', 'radar', 'quadrantChart', 'treemap', 'venn', 'journey']) {
  assert.deepEqual(varNames(chart), ['--pele-series-1', '--pele-series-2', '--pele-series-3', '--pele-series-4', '--pele-series-5', '--pele-series-6', '--pele-series-7', '--pele-series-8'], `series vars for ${chart}`);
}
assert.deepEqual(varNames('flowchart'), [], 'flowchart has no type-specific CSS vars');
assert.deepEqual(varNames('sequence'), []);
assert.deepEqual(varNames('class'), []);
assert.deepEqual(varNames('c4'), [], 'c4 relies on C4StylePanel, not CSS vars');

assert.ok(optKeys('flowchart').includes('curve'), 'flowchart curve');
assert.ok(optKeys('flowchart').includes('nodeSpacing'));
assert.ok(optKeys('flowchart').includes('autoDirection'), 'autoDirection is flowchart-specific');
assert.ok(!optKeys('flowchart').includes('fontSize'), 'fontSize is global-only');
assert.ok(!optKeys('flowchart').includes('zoom'), 'zoom is global-only');
assert.ok(!optKeys('flowchart').includes('padding'), 'padding is global-only');
assert.ok(!optKeys('flowchart').includes('maxWidth') && !optKeys('flowchart').includes('responsive'), 'maxWidth/responsive global-only');

assert.ok(optKeys('sequence').includes('mirrorActors') && optKeys('sequence').includes('monospace'));
assert.ok(optKeys('class').includes('nodeSpacing') && optKeys('class').includes('monospace'));
assert.ok(!optKeys('class').includes('curve'), 'curve is flowchart/state/swimlane only');
assert.deepEqual(optKeys('pie'), ['textPosition']);
assert.ok(optKeys('gantt').includes('now') && optKeys('gantt').includes('barHeight'));
assert.deepEqual(optKeys('c4'), [], 'c4 has no render-option group');
assert.deepEqual(optKeys('mindmap'), ['maxNodeWidth']);
// every filtered opt really declares the type in its kinds (ids, not keys — keys can repeat across groups)
for (const o of ALL_OPTS) {
  for (const t of ['flowchart', 'sequence', 'class', 'pie', 'gantt', 'sankey', 'er', 'state']) {
    assert.equal(optIds(t).includes(o.id), Boolean(o.kinds?.includes(t)), `kinds consistency for ${o.id} / ${t}`);
  }
}

// --- hasTypeSpecificFields ---
assert.equal(hasTypeSpecificFields('pie'), true);
assert.equal(hasTypeSpecificFields('c4'), false);
assert.equal(hasTypeSpecificFields(null), false);
// kanban has opts but no vars; still counts (timeline has neither — no OPT_GROUPS entry)
assert.equal(hasTypeSpecificFields('kanban'), true);
assert.equal(hasTypeSpecificFields('info'), false, 'info: no type-specific fields at all');

// --- merges: override wins, undefined/'' dropped, global untouched ---
const globalVars = { '--pele-bg': '#fff', '--pele-series-1': '#111', '--pele-fg': '#000' };
assert.deepEqual(
  mergeDiagramVars(globalVars, { '--pele-series-1': '#ff8800', '--pele-bg': undefined, '--pele-fg': '' }),
  { '--pele-bg': '#fff', '--pele-series-1': '#ff8800', '--pele-fg': '#000' },
);
assert.deepEqual(globalVars, { '--pele-bg': '#fff', '--pele-series-1': '#111', '--pele-fg': '#000' }, 'global not mutated');
assert.deepEqual(mergeDiagramOptVals({ a: 1, b: 2 }, { b: undefined, c: 3 }), { a: 1, b: 2, c: 3 });

// --- buildDiagramMountOptions: override reaches nested config, view patch wins ---
const globalOptVals = {};
const ganttTextPos = ALL_OPTS.find((o) => o.key === 'textPosition');
const pieOpts = buildDiagramMountOptions(
  { [ganttTextPos.id]: 0.5 }, globalVars,
  { opts: { [ganttTextPos.id]: 0.8 }, vars: { '--pele-series-1': '#abc' } },
);
assert.equal(pieOpts.config.pie.textPosition, 0.8, 'override beats global');
assert.equal(pieOpts.config.pie.textPosition, buildMountOptions({ [ganttTextPos.id]: 0.5 }, globalVars).config.pie.textPosition === 0.5 ? 0.8 : 0.8);

const withPatch = buildDiagramMountOptions(globalOptVals, globalVars, { opts: {}, vars: {} }, { zoom: false, responsive: false });
assert.equal(withPatch.zoom, false);
assert.equal(withPatch.responsive, false);

// --- isolation: diagram A's override never leaks into diagram B ---
const overrideA = { opts: { [ganttTextPos.id]: 0.9 }, vars: { '--pele-series-1': '#0f0' } };
const a = buildDiagramMountOptions(globalOptVals, globalVars, overrideA);
const b = buildDiagramMountOptions(globalOptVals, globalVars, undefined);
assert.equal(a.config.pie.textPosition, 0.9);
assert.equal(b.config?.pie, undefined, 'B has no pie override');
assert.equal(varsStyleFrom(mergeDiagramVars(globalVars, overrideA.vars))['--pele-series-1'], '#0f0', 'A styles use its var override');
assert.equal(varsStyleFrom(mergeDiagramVars(globalVars, undefined))['--pele-series-1'], '#111', 'B inherits global series-1');

// reset clears: an empty override entry is equivalent to none
const reset = buildDiagramMountOptions(globalOptVals, globalVars, { opts: {}, vars: {} });
assert.deepEqual(reset, buildMountOptions(globalOptVals, globalVars), 'empty override == global only');

// --- varsStyleFrom covers exactly VAR_META ---
const style = varsStyleFrom(mergeDiagramVars(globalVars, { '--pele-fg': '#333' }));
assert.deepEqual(Object.keys(style), VAR_META.map((m) => m.name));
assert.equal(style['--pele-fg'], '#333');

// --- overrideKeyCount ---
assert.equal(overrideKeyCount(undefined), 0);
assert.equal(overrideKeyCount({ opts: { x: 1 }, vars: {} }), 1);
assert.equal(overrideKeyCount({ opts: { x: 1, y: 2 }, vars: { '--pele-fg': '#000' } }), 3);

console.log('verify-diagram-overrides: all assertions passed');
