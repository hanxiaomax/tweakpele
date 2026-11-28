import { useEffect, useRef, useState } from 'react';
import {
  LuX as X, LuSend as Send, LuMessageSquarePlus as MessageSquarePlus,
  LuPencil as Pencil, LuTrash2 as Trash2,
} from 'react-icons/lu';
import { IconButton } from './ui.jsx';
import { chatCompletions } from '../ai/client.js';
import { buildMessages, extractMermaidFence } from '../ai/prompt.js';
import { loadThread, saveThread } from '../ai/threads.js';
import { commentLocationHint } from '../ai/comments.js';
import { useAiSettings, openSettings } from '../ai/useAiSettings.js';

const rangeLabel = (a) => (a.startLine === a.endLine
  ? `第 ${a.startLine} 行`
  : `第 ${a.startLine}–${a.endLine} 行`);

/**
 * Right-side AI chat inside the focused view: generate or revise the current
 * Mermaid diagram from natural language, using the product-level AI settings
 * (top bar). Applying a diagram is always explicit (一键应用) — replies never
 * touch the editor on their own.
 * The header also hosts the canvas comment-pin tool (Pele view) and the panel
 * lists that diagram's comments; editor 「加入对话」 excerpts arrive as
 * removable chips on the composer.
 */
export default function AiChatPanel({
  diagram, onChangeSource, onClose, notify,
  pinTool = false, onPinToolChange, pinToolEnabled = true,
  comments = [], onUpdateComment, onDeleteComment,
  excerpts = [], onExcerptsChange,
}) {
  const { apiKey, baseUrl, model } = useAiSettings();
  const [thread, setThread] = useState(() => loadThread(diagram.id));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // { id, text } while editing a comment in the list
  const abortRef = useRef(null);
  const idRef = useRef(diagram.id);
  // fresh values for the test hook without re-binding it every keystroke
  const latestRef = useRef({});
  latestRef.current = { diagram, thread, comments, excerpts, input };

  // switching diagrams: abort in-flight work and swap to that diagram's thread
  if (idRef.current !== diagram.id) {
    idRef.current = diagram.id;
    abortRef.current?.abort();
    setThread(loadThread(diagram.id));
    setError(null);
    setEditing(null);
  }
  useEffect(() => () => abortRef.current?.abort(), []);

  // Test hook: inject replies / preview messages without touching a real API.
  // Settings methods live on the App-level object and survive this panel
  // unmounting. Never logs or exposes the key.
  useEffect(() => {
    const hook = window.__tweakpeleAi || (window.__tweakpeleAi = {});
    hook.injectAssistant = (content) => {
      setThread((prev) => {
        const next = [...prev, { role: 'assistant', content: String(content) }];
        saveThread(idRef.current, next);
        return next;
      });
    };
    // Messages array that would be sent this turn (no network, no key).
    hook.previewMessages = ({ text } = {}) => {
      const cur = latestRef.current;
      const draft = text !== undefined ? String(text) : cur.input;
      const msgs = [...cur.thread];
      if (draft.trim()) msgs.push({ role: 'user', content: draft });
      return buildMessages({
        diagram: cur.diagram, thread: msgs,
        comments: cur.comments, excerpts: cur.excerpts,
      });
    };
    hook.getComments = () => (latestRef.current.comments || []).map((c) => ({ ...c }));
    return () => {
      if (hook.injectAssistant) hook.injectAssistant = undefined;
      if (hook.previewMessages) hook.previewMessages = undefined;
      if (hook.getComments) hook.getComments = undefined;
    };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || !apiKey || busy) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    // excerpt remnants live in message metadata; the excerpts themselves go
    // into the per-turn system context (see buildMessages), not the content
    const userMsg = excerpts.length
      ? {
        role: 'user', content: text,
        attachments: excerpts.map((x) => ({ ...x, text: x.text.slice(0, 800) })),
      }
      : { role: 'user', content: text };
    const nextThread = [...thread, userMsg];
    setThread(nextThread);
    saveThread(diagram.id, nextThread);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const reply = await chatCompletions({
        baseUrl,
        apiKey,
        model,
        messages: buildMessages({ diagram, thread: nextThread, comments, excerpts }),
        signal: ctl.signal,
      });
      const done = [...nextThread, { role: 'assistant', content: reply }];
      setThread(done);
      saveThread(diagram.id, done);
      onExcerptsChange?.([]); // sent — chips only survive failed/aborted sends
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      setError(String(e && e.message ? e.message : e));
    } finally {
      if (abortRef.current === ctl) { abortRef.current = null; setBusy(false); }
    }
  };

  const applyDiagram = (source) => {
    onChangeSource(diagram.id, source);
    notify?.('Diagram applied to editor');
  };

  const commitEdit = () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (text) onUpdateComment?.(editing.id, text);
    setEditing(null);
  };

  return (
    <aside className="ai-chat-panel" aria-label="AI chat">
      <header className="ai-chat-head">
        <b>AI chat</b>
        <IconButton
          Icon={MessageSquarePlus} label="Place comment on diagram (toggle)"
          pressed={pinTool} disabled={!pinToolEnabled}
          onClick={() => onPinToolChange?.(!pinTool)}
        />
        <IconButton Icon={X} label="Close AI chat" onClick={onClose} />
      </header>

      <div className="ai-chat-log">
        {thread.length === 0 && (
          <div className="ai-chat-empty">
            Describe a diagram to create, or ask for a change to the current one.
            Replies with a Mermaid block get a 一键应用 button.
          </div>
        )}
        {thread.map((m, i) => {
          const fence = m.role === 'assistant' ? extractMermaidFence(m.content) : null;
          const prose = fence != null
            ? m.content.replace(/```mermaid[ \t]*\r?\n[\s\S]*?```/gi, '').trim()
            : m.content;
          return (
            <div key={i} className={`ai-msg ${m.role}`}>
              {prose}
              {m.role === 'user' && Array.isArray(m.attachments) && m.attachments.map((a, j) => (
                <div key={j} className="ai-attach-note" title={a.text}>
                  {rangeLabel(a)} · {a.text.slice(0, 80)}
                </div>
              ))}
              {fence != null && (
                <>
                  <pre>{fence}</pre>
                  <button
                    type="button" className="btn ai-apply-btn"
                    aria-label="Apply diagram to editor" title="Apply diagram to editor"
                    onClick={() => applyDiagram(fence)}
                  >
                    一键应用
                  </button>
                </>
              )}
            </div>
          );
        })}
        {busy && <div className="ai-msg assistant ai-msg-pending">…</div>}
      </div>

      {comments.length > 0 && (
        <div className="ai-comments-list" aria-label="Diagram comments">
          <span className="ai-comments-head">画布评论 · pins on the diagram</span>
          {comments.map((c) => (editing && editing.id === c.id ? (
            <div key={c.id} className="ai-comment-row editing">
              <span className="ai-comment-badge">{c.n}</span>
              <input
                value={editing.text}
                aria-label={`Edit comment ${c.n}`}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                }}
              />
              <IconButton Icon={Send} label="Save comment" className="tiny" onClick={commitEdit} />
              <IconButton Icon={X} label="Cancel editing comment" className="tiny" onClick={() => setEditing(null)} />
            </div>
          ) : (
            <div key={c.id} className="ai-comment-row">
              <span className="ai-comment-badge">{c.n}</span>
              <span className="ai-comment-text" title={`${c.text} — ${commentLocationHint(c)}`}>
                {c.text}
              </span>
              <IconButton
                Icon={Pencil} label={`Edit comment ${c.n}`} className="tiny"
                onClick={() => setEditing({ id: c.id, text: c.text })}
              />
              <IconButton
                Icon={Trash2} label={`Delete comment ${c.n}`} kind="danger" className="tiny"
                onClick={() => onDeleteComment?.(c.id)}
              />
            </div>
          )))}
        </div>
      )}

      {error && <div className="ai-chat-error" role="alert">{error}</div>}

      {excerpts.length > 0 && (
        <div className="ai-chat-chips" aria-label="Attached editor selections">
          {excerpts.map((x, i) => (
            <span key={`${x.start}-${x.end}-${i}`} className="ai-excerpt-chip" title={x.text}>
              <span className="ai-excerpt-range">{rangeLabel(x)}</span>
              <code>{x.text}</code>
              <IconButton
                Icon={X} label={`Remove selection ${rangeLabel(x)}`} className="tiny"
                onClick={() => onExcerptsChange?.(excerpts.filter((_, j) => j !== i))}
              />
            </span>
          ))}
        </div>
      )}

      <div className="ai-chat-composer">
        <textarea
          value={input} aria-label="Message"
          placeholder={apiKey ? 'Describe the diagram…' : 'Add an API key in settings first'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <IconButton Icon={Send} label="Send message" onClick={send}
          disabled={!apiKey || busy || !input.trim()} />
      </div>
      {!apiKey && (
        <div className="ai-chat-keyhint">
          Send is disabled — an API key is required.
          <button type="button" className="btn ai-open-settings-btn" aria-label="Open settings" onClick={openSettings}>
            Open settings
          </button>
        </div>
      )}
    </aside>
  );
}
