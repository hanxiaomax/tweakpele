# @local/tweakpele — DeepSeek Harness plugin

Integrates [tweakpele](https://hanxiaomax.github.io/tweakpele/) (Pele Mermaid theme playground) into `dsh` so the agent can **edit diagrams in real time** with you. The playground opens in **editor mode** by default (split Mermaid source + live preview).

## What you get

| Tool | Purpose |
|---|---|
| `tweakpele_start` | Start local bridge; return editor URL (`?bridge=1#/edit/...`) |
| `tweakpele_status` | Active diagram, theme, clients, last render feedback |
| `tweakpele_list_diagrams` | Library listing |
| `tweakpele_open_editor` | Select diagram + editor mode (default UX) |
| `tweakpele_get_source` / `tweakpele_set_source` | Read/write Mermaid; live push to browser |
| `tweakpele_create_diagram` | New diagram in editor |
| `tweakpele_list_presets` / `tweakpele_apply_theme` | tweakcn-aligned Pele presets |
| `tweakpele_get_feedback` | Latest Pele render ok/error from the browser |

The Host plugin serves the tweakpele static build from this repo and syncs state over HTTP + SSE (`/api/state`, `/api/events`, `/api/feedback`).

## Install into a dsh profile

From any directory (pnpm must be on `PATH`):

```bash
# headless (CLI one-shot / automation)
dsh plugin --profile headless add /absolute/path/to/tweakpele/dsh-plugin

# web UI profile (first run initializes it)
dsh plugin --profile web add /absolute/path/to/tweakpele/dsh-plugin
```

`dsh plugin add` installs the package and **activates** new bundles by default. Confirm:

```bash
dsh --profile headless --dump-config | rg tweakpele
```

You should see a row `id: tweakpele` / `name: '@local/tweakpele'`.

## Run

```bash
# one-shot agent that can call tweakpele_* tools
dsh headless "Start tweakpele, open the flowchart in the editor, and change the title node to Hello"

# or the web app
dsh web
```

Then open the printed `editorUrl` (or ask the agent to call `tweakpele_start`). Keep that tab open so `tweakpele_get_feedback` can report Pele render results.

### Config (profile `cordis.patch.yml` override)

```yaml
- id: tweakpele
  config:
    host: 127.0.0.1
    port: 3847
    autoStart: true
    openBrowser: false
    # staticRoot: /path/to/tweakpele   # optional; defaults to the repo next to this plugin
```

Env override for the static root: `TWEAKPELE_ROOT=/path/to/tweakpele`.

## Editor as default

- Opening tweakpele with **no hash** navigates to `#/edit/<last-or-first-id>`.
- Bridge URLs from the plugin always use editor mode: `/?bridge=1#/edit/...`.
- Gallery remains available via the back control (`#/`).

## Dev notes

- Bundle manifest: `package.json` → `dsh.bundle.patch` → `cordis.patch.yml`.
- Host exports: named `name` / `inject` / `apply` only (no `default` export).
- Rebuild the web UI after frontend changes: `npm run build` in the repo root.
