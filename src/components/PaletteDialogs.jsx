import { useEffect, useRef, useState } from 'react';
import { Dialog } from './ui.jsx';
import { PresetPreview } from './PresetCards.jsx';
import { COLOR_VARS, normalizePalette, isHexColor, expandHex } from '../palettes.js';
import { chatCompletions } from '../ai/client.js';
import { buildPaletteMessages, extractPaletteJson } from '../ai/palettePrompt.js';
import { useAiSettings } from '../ai/useAiSettings.js';

/** Add-palette dialog: pick a path, then create manually or generate with AI. */
export function AddPaletteDialog({ vars, onClose, onSave, onOpenAiSettings }) {
  const [mode, setMode] = useState('choose'); // choose | manual | ai
  return (
    <Dialog title="Add palette" onClose={onClose}>
      {mode === 'choose' && (
        <div className="palette-add-choice">
          <p className="muted">Build a palette by hand, or describe one and let AI draft it.</p>
          <div className="palette-add-buttons">
            <button type="button" className="btn" aria-label="Create palette manually" onClick={() => setMode('manual')}>
              Create manually
            </button>
            <button type="button" className="btn" aria-label="Generate palette with AI" onClick={() => setMode('ai')}>
              Generate with AI
            </button>
          </div>
        </div>
      )}
      {mode === 'manual' && (
        <ManualPaletteForm vars={vars} onBack={() => setMode('choose')} onSave={onSave} />
      )}
      {mode === 'ai' && (
        <AiPaletteForm onBack={() => setMode('choose')} onClose={onClose} onSave={onSave}
          onOpenAiSettings={onOpenAiSettings} />
      )}
    </Dialog>
  );
}

/** Manual editor: colors start from the current theme vars; typography / radius
 *  come from PAPER_TYPE / INK_TYPE by tone on save (not editable here). */
function ManualPaletteForm({ vars, onBack, onSave }) {
  const [label, setLabel] = useState('');
  const [tone, setTone] = useState('light');
  const [description, setDescription] = useState('');
  const [colors, setColors] = useState(() =>
    Object.fromEntries(COLOR_VARS.map((m) => [m.name, vars?.[m.name] || ''])));
  const setColor = (name, v) => setColors((c) => ({ ...c, [name]: v }));
  const save = () => {
    onSave(normalizePalette({ label, tone, description, vars: colors }, { tone }));
  };
  return (
    <div className="palette-editor">
      <label className="palette-field">
        <span>Name</span>
        <input type="text" aria-label="Palette name" value={label} placeholder="My palette"
          onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="palette-field">
        <span>Tone</span>
        <select aria-label="Palette tone" value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <label className="palette-field">
        <span>Description</span>
        <input type="text" aria-label="Palette description" value={description} placeholder="Short description"
          onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="palette-colors">
        {COLOR_VARS.map((m) => (
          <div className="palette-color-row" key={m.name}>
            <span className="palette-color-label" title={m.name}>{m.label}</span>
            <input type="color" aria-label={m.name}
              value={isHexColor(colors[m.name]) ? expandHex(colors[m.name]) : '#000000'}
              onChange={(e) => setColor(m.name, e.target.value)} />
            <input type="text" spellCheck="false" autoComplete="off" aria-label={m.name + ' value'}
              value={colors[m.name]} onChange={(e) => setColor(m.name, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="palette-dialog-actions">
        <button type="button" className="btn" aria-label="Save palette" onClick={save}>Save</button>
        <button type="button" className="btn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

/** AI generation: one-sentence style prompt → preview → save / regenerate / discard. */
function AiPaletteForm({ onBack, onClose, onSave, onOpenAiSettings }) {
  const { apiKey, baseUrl, model } = useAiSettings();
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async () => {
    const p = prompt.trim();
    if (!p || !apiKey || busy) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setError('');
    setBusy(true);
    try {
      const reply = await chatCompletions({
        baseUrl, apiKey, model,
        messages: buildPaletteMessages(p),
        signal: ctl.signal,
      });
      const raw = extractPaletteJson(reply);
      if (!raw || typeof raw !== 'object') throw new Error('The model did not return palette JSON.');
      setPreview(normalizePalette(raw, { tone: raw.tone }));
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      setError(String(e && e.message ? e.message : e));
    } finally {
      if (abortRef.current === ctl) { abortRef.current = null; setBusy(false); }
    }
  };

  if (!apiKey) {
    return (
      <div className="palette-ai-keyhint">
        An API key is required to generate palettes with AI.
        <div className="palette-dialog-actions">
          <button type="button" className="btn" aria-label="Open settings" onClick={onOpenAiSettings}>Open settings</button>
          <button type="button" className="btn" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }
  return (
    <div className="palette-ai">
      <textarea aria-label="Palette prompt" placeholder="Describe the style in one sentence…"
        value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <div className="palette-dialog-actions">
        <button type="button" className="btn" aria-label="Generate palette" disabled={busy || !prompt.trim()} onClick={generate}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
        <button type="button" className="btn" onClick={onBack}>Back</button>
      </div>
      {error && <div className="palette-ai-error" role="alert">{error}</div>}
      {preview && (
        <div className="palette-ai-preview">
          <PresetPreview preset={preview} />
          <div className="palette-dialog-actions">
            <button type="button" className="btn" aria-label="Save palette" onClick={() => onSave(preview)}>Save</button>
            <button type="button" className="btn" aria-label="Regenerate palette" disabled={busy} onClick={generate}>Regenerate</button>
            <button type="button" className="btn" aria-label="Discard palette" onClick={onClose}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Rename a custom palette (label only; id and colors stay). */
export function RenamePaletteDialog({ preset, onClose, onSave }) {
  const [label, setLabel] = useState(preset.label);
  return (
    <Dialog title={`Rename ${preset.label}`} onClose={onClose}>
      <div className="palette-editor">
        <label className="palette-field">
          <span>Name</span>
          <input type="text" aria-label="Palette name" value={label}
            onChange={(e) => setLabel(e.target.value)} />
        </label>
        <div className="palette-dialog-actions">
          <button type="button" className="btn" aria-label="Save palette" disabled={!label.trim()}
            onClick={() => onSave(preset, label.trim())}>Save</button>
        </div>
      </div>
    </Dialog>
  );
}
