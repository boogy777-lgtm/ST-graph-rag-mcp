# ST-Graph-RAG-MCP UI (src/ui/)

Vite + React + Tailwind dashboard bundled into the MCP binary via `bun build --compile --asset`.

## Develop

```bash
cd src/ui
bun install
bun run dev      # Vite dev server at http://localhost:5173 (auto-reload)
bun run build    # tsc -b + vite build → dist/
```

The dev server connects to the MCP telemetry WS via `ws://localhost:5173/ws` —
proxy `/ws` to your local MCP instance (port is random, see `.code-graph-rag/ui.port`).

## Architecture

| File | Role |
|------|------|
| `index.html` | Vite HTML entry (relative `./assets/` paths) |
| `src/main.tsx` | React root mount |
| `src/App.tsx` | Shell: Sidebar + MainPanel + WS state |
| `src/Sidebar.tsx` | Left nav (Radar / Graph / Analytics) |
| `src/MainPanel.tsx` | Section switcher + headers |
| `src/EventStream.tsx` | Live tail of telemetry events |
| `src/StatusBar.tsx` | Connection state + event count |
| `src/ws-client.ts` | WebSocket client (reconnect, replay) |
| `src/types.ts` | Wire-protocol types + runtime guards |
| `vite.config.ts` | Output to `dist/`, `base: "./"` |
| `tailwind.config.ts` | Tailwind v4 content scan |
| `postcss.config.js` | Tailwind + Autoprefixer |

## Build → MCP binary

`scripts/build.ts` (root) runs `bun install && bun run build` here, then:

```bash
bun build --compile \
  --asset ./src/ui/dist=./ui \
  --outfile bin/st-graph-rag-mcp \
  src/index.ts
```

At runtime the WS server reads files via `Bun.file("./ui/...")`.

## Design tokens (Tailwind v4)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg` | `#0e1116` | App background |
| `--color-panel` | `#161b22` | Sidebar, headers, status bar |
| `--color-panel-2` | `#1c2128` | Active nav, hovered rows |
| `--color-border` | `#30363d` | Dividers |
| `--color-fg` | `#e6edf3` | Primary text |
| `--color-fg-muted` | `#8b949e` | Secondary text |
| `--color-fg-dim` | `#6e7681` | Tertiary text, timestamps |
| `--color-accent` | `#2f81f7` | Active section, links |
| `--color-success` | `#3fb950` | `index_completed`, open WS |
| `--color-warning` | `#d29922` | `diagnostic`, overflow |
| `--color-danger` | `#f85149` | `index_failed`, errors |
