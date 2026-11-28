import { useEffect, useRef, useState } from 'react';
import {
  LuX as X, LuSend as Send,
} from 'react-icons/lu';
import { IconButton } from './ui.jsx';
import { chatCompletions } from '../ai/client.js';
import { buildMessages, extractMermaidFence } from '../ai/prompt.js';
import { loadThread, saveThread } from '../ai/threads.js';
import { useAiSettings, openSettings } from '../ai/useAiSettings.js';

/**
 * Right-side AI chat inside the focused view: generate or revise the current
 * Mermaid diagram from natural language, using the product-level AI settings
 * (top bar). Applying a diagram is always explicit (一键应用) — replies never
 * touch the editor on their own.
 */
export default function AiChatPanel({ diagram, onChangeSource, onClose, notify }) {
  const { apiKey, baseUrl, model } = useAiSettings();
  const [thread, setThread] = useState(() => loadThread(diagram.id));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const idRef = useRef(diagram.id);

  // switching diagrams: abort in-flight work and swap to that diagram's thread
  if (idRef.current !== diagram.id) {
    idRef.current = diagram.id;
    abortRef.current?.abort();
    setThread(loadThread(diagram.id));
    setError(null);
  }
  useEffect(() => () => abortRef.current?.abort(), []);

  // Test hook entry for injecting replies; the settings methods live on the
  // App-level object and survive this panel unmounting.
  useEffect(() => {
    const hook = window.__tweakpeleAi || (window.__tweakpeleAi = {});
    hook.injectAssistant = (content) => {
      setThread((prev) => {
        const next = [...prev, { role: 'assistant', content: String(content) }];
        saveThread(idRef.current, next);
        return next;
      });
    };
    return () => { if (hook.injectAssistant) hook.injectAssistant = undefined; };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || !apiKey || busy) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const nextThread = [...thread, { role: 'user', content: text }];
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
        messages: buildMessages({ diagram, thread: nextThread }),
        signal: ctl.signal,
      });
      const done = [...nextThread, { role: 'assistant', content: reply }];
      setThread(done);
      saveThread(diagram.id, done);
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

  return (
    <aside className="ai-chat-panel" aria-label="AI chat">
      <header className="ai-chat-head">
        <b>AI chat</b>
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

      {error && <div className="ai-chat-error" role="alert">{error}</div>}

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
