import { LuEraser as Eraser } from 'react-icons/lu';
import { Dialog, IconButton } from './ui.jsx';
import { useAiSettings } from '../ai/useAiSettings.js';

/** Product-level AI settings (top bar): one key / base URL / model shared by
 *  every AI feature. Storage and the memory-only-key rule live in ai/settings.js. */
export default function AiSettingsDialog({ onClose }) {
  const { apiKey, baseUrl, model, remember, updateSettings, changeKey, wipeKey } = useAiSettings();
  return (
    <Dialog title="AI settings" onClose={onClose}>
      <div className="ai-chat-settings ai-settings-dialog">
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
            type="checkbox" checked={remember}
            onChange={(e) => updateSettings({ remember: e.target.checked })}
          />
          <span>记住这台设备 <small>(otherwise the key is forgotten on reload)</small></span>
        </label>
        <label>
          <span>Base URL</span>
          <input
            type="text" value={baseUrl} spellCheck="false"
            aria-label="Base URL"
            onChange={(e) => updateSettings({ baseUrl: e.target.value })}
          />
        </label>
        <label>
          <span>Model</span>
          <input
            type="text" value={model} spellCheck="false"
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
    </Dialog>
  );
}
