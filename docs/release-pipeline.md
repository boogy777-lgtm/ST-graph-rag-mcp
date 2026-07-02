# Release Pipeline Architecture

## Repository Topology

```mermaid
flowchart LR
  A[boogy777-lgtm/trust-platform] -->|"workflow: lsp-release.yml → publishes trust-lsp.exe zip on tag push"| R1[trust-platform Releases/latest]
  R1 -->|"curl GitHub API → download artifact"| B[boogy777-lgtm/ST-graph-rag-mcp]
  B -->|"workflow: release.yml → bun build + embed LSP"| R2[ST-graph-rag-mcp Releases/v*]
```

| Repo | Workflow File | Artifact | Trigger |
|------|---------------|----------|---------|
| `boogy777-lgtm/trust-platform` | `.github/workflows/lsp-release.yml` | `trust-lsp-win32-x64.zip` (contains `trust-lsp.exe`) | push tag `v*` |
| `boogy777-lgtm/ST-graph-rag-mcp` | `.github/workflows/release.yml` | `st-graph-rag-mcp-<ver>-win-x64.zip` (contains 3 .exe + config) | push tag `v*` |

## trust-lsp dependency contract

The Rust LSP binary is built and published by **`boogy777-lgtm/trust-platform`** (separate repository). It is NOT built inside this repo's CI.

`ST-graph-rag-mcp`'s release workflow:

1. Calls GitHub REST API: `GET /repos/boogy777-lgtm/trust-platform/releases/latest`
2. Resolves the asset named **`trust-lsp-win32-x64.zip`** from that release
3. Downloads it into `bin/`, extracts `trust-lsp.exe`
4. Continues with `bun run build` (creates `st-graph-rag-mcp.exe` + `obsidian-export.exe`)

**Consequence:** when `trust-platform` ships a new LSP release, every new `ST-graph-rag-mcp` release automatically pulls the latest compatible LSP. This is "auto-tracking". Pin a specific version only by overriding the workflow step (not currently exposed as input).

## Required counterpart workflow

The following workflow **must exist** in `boogy777-lgtm/trust-platform` for this pipeline to function. The expected file is `.github/workflows/lsp-release.yml` and it should produce an asset called `trust-lsp-win32-x64.zip` containing a file named `trust-lsp.exe`.

```yaml
# boogy777-lgtm/trust-platform/.github/workflows/lsp-release.yml
name: lsp-release
on:
  push:
    tags: ["v*"]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: dtolnay/rust-toolchain@stable
      - name: Build trust-lsp
        run: cargo build --release -p trust-lsp --target-cpu=native
      - name: Package
        shell: pwsh
        run: |
          Compress-Archive -Path "target/release/trust-lsp.exe" -DestinationPath "trust-lsp-win32-x64.zip"
      - name: Upload release asset
        uses: softprops/action-gh-release@v2
        with:
          files: trust-lsp-win32-x64.zip
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Local reproduction

The release pipeline can be reproduced locally without going through GitHub:

```bash
# Step 1 — fetch the LSP (from latest release)
pwsh -Command "
  \$url = (Invoke-RestMethod https://api.github.com/repos/boogy777-lgtm/trust-platform/releases/latest).assets |
    Where-Object { \$_.name -eq 'trust-lsp-win32-x64.zip' } |
    Select-Object -ExpandProperty browser_download_url
  Invoke-WebRequest \$url -OutFile bin/trust-lsp.zip
  Expand-Archive bin/trust-lsp.zip bin -Force
  Remove-Item bin/trust-lsp.zip
"

# Step 2 — build the bun-бинарники
bun run build

# Step 3 — smoke
bun run smoke
```

## Rationale: why NOT bundle the LSP build here?

```yaml
separated_builds:
  reason: "trust-lsp is a Rust crate owned by a separate repo (boogy777-lgtm/trust-platform)."
  benefits:
    - "Independent versioning: LSP can cut v1.1.0 without forcing ST-graph-rag-mcp release."
    - "Build isolation: Rust toolchain (~10 min cold) doesn't block TS rebuilds (~6 sec)."
    - "Surface locality: LSP bugs reported in its own repo, not mixed with MCP issues."
  tradeoffs_acknowledged:
    - "Cross-repo coupling: a breaking LSP change can silently break prod releases."
      mitigation: "Future: add smoke test that actually invokes index on a fixture."
    - "trust-platform release must exist before ST-graph-rag-mcp can release."
      acceptable: "trust-platform already publishes v1.0.2 stable per scripts/setup.ts fallback."
```

## Submodule is intentionally NOT initialized in release CI

`.gitmodules` still references `trust-platform` because local development occasionally
needs the LSP sources (e.g. when iterating on both repos). The CI workflow uses:

```yaml
- uses: actions/checkout@v4
  with:
    submodules: false   # ← NOT initializing
```

If you need to build the Rust LSP from source inside this repo (e.g. for a fork
where trust-platform does not yet publish releases), change to `submodules: true`
and add a `cargo build --release -p trust-lsp` step before `bun run build`.
