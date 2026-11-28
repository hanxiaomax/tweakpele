import { memo } from 'react';
import {
  LuPlus as Plus, LuPencil as Pencil, LuTrash2 as Trash2,
} from 'react-icons/lu';
import { IconButton } from './ui.jsx';

const SWATCH_KEYS = [
  '--pele-bg',
  '--pele-surface',
  '--pele-accent',
  '--pele-series-1',
  '--pele-fg',
];

/** Shared card body: swatch preview + label / tone / description meta. */
export const PresetCardBody = memo(function PresetCardBody({ preset }) {
  return (
    <>
      <span className="theme-preset-preview" aria-hidden="true">
        <span className="theme-preset-swatches">
          {SWATCH_KEYS.map((key) => (
            <i key={key} style={{ background: preset.vars[key] }} />
          ))}
        </span>
      </span>
      <span className="theme-preset-meta">
        <span className="theme-preset-meta-row">
          <b>{preset.label}</b>
          <small className={'theme-preset-tone ' + (preset.tone || 'light')}>
            {preset.tone === 'dark' ? 'Dark' : 'Light'}
          </small>
        </span>
        {preset.description ? <span className="theme-preset-desc">{preset.description}</span> : null}
      </span>
    </>
  );
});

/** Read-only built-in preset card. */
export const PresetCard = memo(function PresetCard({ preset, selected, onSelect }) {
  return (
    <button
      type="button"
      className={'theme-preset' + (selected ? ' selected' : '')}
      aria-pressed={selected}
      title={preset.description || preset.label}
      onClick={() => onSelect(preset)}
    >
      <PresetCardBody preset={preset} />
    </button>
  );
});

/** Custom palette card: same chrome plus rename / delete (never on built-ins). */
export const CustomPresetCard = memo(function CustomPresetCard({ preset, selected, onSelect, onRename, onDelete }) {
  return (
    <div className={'custom-preset' + (selected ? ' selected' : '')}>
      <button
        type="button"
        className="custom-preset-main"
        aria-pressed={selected}
        title={preset.description || preset.label}
        onClick={() => onSelect(preset)}
      >
        <PresetCardBody preset={preset} />
      </button>
      <span className="custom-preset-actions">
        <IconButton Icon={Pencil} label={`Rename palette ${preset.label}`} className="tiny"
          onClick={() => onRename(preset)} />
        <IconButton Icon={Trash2} label={`Delete palette ${preset.label}`} className="tiny"
          onClick={() => onDelete(preset)} />
      </span>
    </div>
  );
});

/** Add card — same grid chrome, always last in the preset grid. */
export const AddPaletteCard = memo(function AddPaletteCard({ onAdd }) {
  return (
    <button type="button" className="theme-preset add-palette" aria-label="Add palette" title="Add palette" onClick={onAdd}>
      <span className="theme-preset-preview add-palette-preview" aria-hidden="true">
        <Plus />
      </span>
      <span className="theme-preset-meta">
        <span className="theme-preset-meta-row"><b>Add</b></span>
      </span>
    </button>
  );
});

/** Non-interactive preview card (AI generation result). */
export const PresetPreview = memo(function PresetPreview({ preset }) {
  return (
    <div className="custom-preset preset-preview" title={preset.description || preset.label}>
      <div className="custom-preset-main">
        <PresetCardBody preset={preset} />
      </div>
    </div>
  );
});
