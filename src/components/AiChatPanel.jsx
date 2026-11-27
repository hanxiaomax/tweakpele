import { useEffect, useRef, useState } from 'react';
import {
  LuSettings2 as Settings2, LuX as X, LuSend as Send, LuEraser as Eraser,
} from 'react-icons/lu';
import { IconButton } from './ui.jsx';
import { chatCompletions } from '../ai/client.js';
import { buildMessages, extractMermaidFence } from '../ai/prompt.js';
import { loadThread, saveThread } from '../ai/threads.js';
import {
  loadSettings, saveSettings, loadApiKey, storeApiKey, clearApiKey,
} from '../ai/settings.js';

/**
 * Right-side AI chat inside the focused view: generate or revise the current
 * Mermaid diagram from natural language, using the user's own API key
 * (memory-only unless 记住这台设备). Applying a diagram is always explicit
 * (一键应用) — replies never touch the editor on their own.
 */
export default function AiChatPanel({ diagram, onChangeSource, onClose, notify }) {
  const [settings, setSettings] = useState(loadSettings);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [settingsOpen, setSettingsOpen] = useState(() => !loadApiKey());
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

  // Test hook: inject replies / plant keys without touching a real API. Never logs the key.
  useEffect(() => {
    window.__tweakpeleAi = {
      injectAssistant(content) {
        setThread((prev) => {
          const next = [...prev, { role: 'assistant', content: String(content) }];
          saveThread(idRef.current, next);
          return next;
        });
      },
      getPublicSettings() {
        return { baseUrl: settings.baseUrl, model: settings.model, remember: settings.remember, hasKey: !!apiKey };
      },
      setKey(key, { remember } = {}) {
        const k = key || '';
        setApiKey(k);
        const next = remember === undefined ? settings : { ...settings, remember };
        if (remember !== undefined) { setSettings(next); saveSettings(next); }
        storeApiKey(k, next.remember);
      },
      clearKey() { wipeKey(); },
    };
    return () => { if (window.__tweakpeleAi) delete window.__tweakpeleAi; };
  }, [diagram.id, settings, apiKey]);

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    storeApiKey(apiKey, next.remember); // keep the stored secret in sync with remember
  };

  const changeKey = (key) => {
    setApiKey(key);
    storeApiKey(key, settings.remember);
  };

  const wipeKey = () => {
    clearApiKey();
    setApiKey('');
    const next = { ...settings, remember: false };
    setSettings(next);
    saveSettings(next);
  };

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
        baseUrl: settings.baseUrl,
        apiKey,
        model: settings.model,
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
        <IconButton Icon={Settings2} label="AI settings (toggle)" pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)} />
        <IconButton Icon={X} label="Close AI chat" onClick={onClose} />
      </header>

      {settingsOpen && (
        <div className="ai-chat-settings">
          <label>
            <span>API key</span>
            <span className="ai-key-row">
              <input
                type="password" value={apiKey} spellCheck="false" autoComplete="off"
                placeholder="sk-…" aria-label="API key"
                onChange={(e) => changeKey(e.target.value)}
              />
              <IconButton Icon={Eraser} label="Clear API key" className="tiny" onClick={() => changeKey('')} />
            </span>
          </label>
          <label className="ai-check">
            <input
              type="checkbox" checked={settings.remember}
              onChange={(e) => updateSettings({ remember: e.target.checked })}
            />
            <span>记住这台设备 <small>(otherwise the key is forgotten on reload)</small></span>
          </label>
          <label>
            <span>Base URL</span>
            <input
              type="text" value={settings.baseUrl} spellCheck="false"
              aria-label="Base URL"
              onChange={(e) => updateSettings({ baseUrl: e.target.value })}
            />
          </label>
          <label>
            <span>Model</span>
            <input
              type="text" value={settings.model} spellCheck="false"
              aria-label="Model"
              onChange={(e) => updateSettings({ model: e.target.value })}
            />
          </label>
          <button type="button" className="btn ai-clear-key-btn" onClick={wipeKey}>
            Clear key
          </button>
          <p className="ai-chat-note">
            This app has no backend: your key is sent only to the base URL above,
            straight from this browser, and is forgotten on reload unless remembered.
          </p>
        </div>
      )}

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
      {!apiKey && <div className="ai-chat-keyhint">Send is disabled — an API key is required (settings above).</div>}
    </aside>
  );
}
