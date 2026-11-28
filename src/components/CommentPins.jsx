import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LuCheck as Check, LuTrash2 as Trash2, LuX as X,
} from 'react-icons/lu';
import { IconButton } from './ui.jsx';
import { clamp } from '../lib.js';

/**
 * Canvas comment pins over the focused Pele diagram (AI panel open, Pele view).
 * Pins are stored in diagram space — normalized against the SVG's intrinsic
 * width/height attributes — so Pele zoom/pan (viewBox changes) and resets keep
 * them on the same diagram spot; screen positions are recomputed via
 * getScreenCTM() on every viewBox/size/svg-node mutation.
 */

const DRAFT_KEY = '__draft__';
const NEARBY_RADIUS = 140; // px screen distance for capturing nearby node text

function findSvg(body) {
  return body ? body.querySelector('.pele-host svg.pele') : null;
}

function intrinsicSize(svg) {
  const w = parseFloat(svg.getAttribute('width'));
  const h = parseFloat(svg.getAttribute('height'));
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const vw = Number.isFinite(vb[2]) && vb[2] > 0 ? vb[2] : 0;
  const vh = Number.isFinite(vb[3]) && vb[3] > 0 ? vb[3] : 0;
  return {
    w: Number.isFinite(w) && w > 0 ? w : vw || 300,
    h: Number.isFinite(h) && h > 0 ? h : vh || 150,
  };
}

/** clientX/clientY → SVG user coordinates (current viewBox space). */
function svgUserPoint(svg, clientX, clientY) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}

/** SVG user point → client coordinates. */
function svgUserToClient(svg, x, y) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const p = pt.matrixTransform(ctm);
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}

/** Shortest-distance visible <text>/<tspan> under the click, or ''. */
function nearbyText(svg, clientX, clientY) {
  let best = '';
  let bestD = NEARBY_RADIUS * NEARBY_RADIUS;
  for (const el of svg.querySelectorAll('text, tspan')) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) { best = t.slice(0, 60); bestD = d; }
    }
  }
  return best;
}

export default function CommentPins({ bodyRef, comments, pinTool, onAdd, onUpdate, onDelete }) {
  // draft: { id?, n?, nx, ny, nearby, text } — placing a new pin or editing one
  const [draft, setDraft] = useState(null);
  const [pos, setPos] = useState({});      // key → { left, top } inside the layer
  const layerRef = useRef(null);
  const inputRef = useRef(null);
  const [tick, setTick] = useState(0);

  // Watch for svg node replacement (Pele redraw) + viewBox/size mutations + resizes.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const host = body.querySelector('.pele-host');
    let svg = null;
    let svgMo = null;
    const bump = () => setTick((t) => t + 1);
    const bindSvg = () => {
      const next = findSvg(body);
      if (next === svg) return;
      svg = next;
      svgMo?.disconnect();
      svgMo = svg
        ? new MutationObserver(bump)
        : null;
      // 'style' too: vendor zoom shrinks the SVG via inline maxWidth/margin
      // (controls-overlap fit) without changing the viewBox.
      if (svgMo) svgMo.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'width', 'height', 'style'] });
      bump();
    };
    const hostMo = new MutationObserver(bindSvg);
    if (host) hostMo.observe(host, { childList: true, subtree: true });
    const ro = host ? new ResizeObserver(bump) : null;
    if (ro) ro.observe(host);
    window.addEventListener('resize', bump);
    bindSvg();
    return () => {
      hostMo.disconnect();
      svgMo?.disconnect();
      ro?.disconnect();
      window.removeEventListener('resize', bump);
    };
  }, [bodyRef]);

  // Project every pin (and the open draft) from diagram space into layer pixels.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const layer = layerRef.current;
    if (!body || !layer) return;
    const svg = findSvg(body);
    const rect = layer.getBoundingClientRect();
    const next = {};
    if (svg) {
      const { w, h } = intrinsicSize(svg);
      const items = draft ? [...comments, { ...draft, id: DRAFT_KEY }] : comments;
      for (const c of items) {
        const p = svgUserToClient(svg, c.nx * w, c.ny * h);
        if (!p) continue;
        next[c.id] = { left: p.x - rect.left, top: p.y - rect.top };
      }
    }
    setPos(next);
  }, [bodyRef, comments, draft, tick]);

  // Pin tool active: a click on the Pele SVG places a draft pin there.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const onClick = (e) => {
      if (!pinTool) return;
      if (e.target.closest && e.target.closest(
        '.pele-zoom, button, a, input, textarea, select, .c4-style-panel, .diagram-style-panel, .ai-pin-layer',
      )) return;
      const svg = e.target.closest && e.target.closest('svg.pele');
      if (!svg) return;
      const p = svgUserPoint(svg, e.clientX, e.clientY);
      if (!p) return;
      const { w, h } = intrinsicSize(svg);
      e.preventDefault();
      e.stopPropagation();
      setDraft({
        nx: clamp(p.x / w, 0, 1),
        ny: clamp(p.y / h, 0, 1),
        nearby: nearbyText(svg, e.clientX, e.clientY),
        text: '',
      });
    };
    body.addEventListener('click', onClick, true);
    return () => body.removeEventListener('click', onClick, true);
  }, [bodyRef, pinTool]);

  useEffect(() => {
    if (draft) {
      const t = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
    return undefined;
  }, [draft && draft.id, !!draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitDraft = () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) { setDraft(null); return; } // empty confirm cancels, no pin left behind
    if (draft.id) onUpdate(draft.id, text);
    else onAdd(draft.nx, draft.ny, draft.nearby, text);
    setDraft(null);
  };
  const cancelDraft = () => setDraft(null);

  const draftPos = draft ? pos[DRAFT_KEY] : null;
  const flipDraft = !!draftPos
    && draftPos.left > (layerRef.current?.clientWidth || Infinity) - 220;

  return (
    <div className="ai-pin-layer" ref={layerRef} aria-label="Diagram comments">
      {comments.map((c) => (pos[c.id] ? (
        <button
          key={c.id} type="button" className="ai-pin"
          style={pos[c.id]}
          title={`${c.text}${c.nearby ? ` · near "${c.nearby}"` : ''}`}
          aria-label={`Edit comment ${c.n}: ${c.text}`}
          onClick={(e) => { e.stopPropagation(); setDraft({ ...c, text: c.text }); }}
        >{c.n}</button>
      ) : null))}
      {draft && draftPos && (
        <div
          className={'ai-pin-draft' + (flipDraft ? ' flip' : '')} style={draftPos}
          onClick={(e) => e.stopPropagation()}
          role="group" aria-label="Comment draft"
        >
          <span className="ai-pin-draft-badge">{draft.n || '＋'}</span>
          <input
            ref={inputRef}
            value={draft.text}
            placeholder="评论… Enter 放置"
            aria-label="Comment text"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancelDraft(); }
            }}
          />
          <IconButton Icon={Check} label={draft.id ? 'Save comment' : 'Place comment'} className="tiny" onClick={commitDraft} />
          <IconButton Icon={X} label="Cancel comment" className="tiny" onClick={cancelDraft} />
          {draft.id && (
            <IconButton
              Icon={Trash2} label="Delete comment" kind="danger" className="tiny"
              onClick={() => { onDelete(draft.id); setDraft(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
