<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg" height="80" alt="TypeScript" />
  <img src="https://bun.sh/logo.svg" height="80" alt="Bun" />
  <h1>ST-Graph-RAG-MCP</h1>
  <p><strong>Model Context Protocol (MCP) Server for IEC 61131-3 Structured Text</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Bun-1.1%2B-black?logo=bun&style=flat-square" alt="Bun" />
    <img src="https://img.shields.io/badge/Protocol-MCP-blue?style=flat-square" alt="MCP Protocol" />
    <img src="https://img.shields.io/badge/Language-Structured%20Text-darkgreen?style=flat-square" alt="Structured Text" />
    <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&style=flat-square" alt="SQLite" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</div>

---

ST-Graph-RAG-MCP connects your AI assistant (like OpenCode, Claude, or Cursor) directly to your PLC codebase. 

It uses a highly optimized **Rust-based LSP parser** to read `.st`/`.pou` files, indexes the AST and cross-references into an embedded **Bun SQLite** database, and exposes the exact semantic context your AI needs to write, refactor, and review industrial automation code.

## 🌟 Key Features

- **Semantic Code Understanding:** 21 specialized MCP tools to query relationships, call chains, variables, and cross-file dependencies.
- **Blazing Fast Indexing:** Powered by a native Rust LSP and `bun:sqlite` (up to 3x faster than traditional Node.js SQLite bindings).
- **Obsidian Vault Exporter:** Instantly visualize your PLC architecture! Exports your entire codebase as interconnected `.md` files with YAML frontmatter and `[[wikilinks]]`.
- **Zero Configuration DB:** Graph database is auto-managed and stored locally in `.code-graph-rag/st-graph.db`.

## 🏗️ Architecture

```mermaid
graph LR
    subgraph PLC Project
        ST[/*.st, /*.pou]
    end

    subgraph Rust
        LSP[trust-lsp.exe]
    end

    subgraph Bun MCP Server
        MCP_HANDLER[21 MCP Tools]
        OBSIDIAN[Obsidian Exporter]
        SQLITE[(bun:sqlite)]
    end

    subgraph Clients
        LLM[OpenCode / Claude]
        OBS_VAULT[Obsidian Vault]
    end

    ST -->|Parse| LSP
    LSP -->|AST & Symbols| MCP_HANDLER
    MCP_HANDLER -->|Persist| SQLITE
    MCP_HANDLER <-->|JSON-RPC| LLM
    SQLITE -->|Query| OBSIDIAN
    OBSIDIAN -->|Markdown| OBS_VAULT
```

## 🚀 Quick Start

### 1. Requirements
- **[Bun](https://bun.sh/)** >= 1.1 installed on your system.
- **Rust/Cargo** (https://rustup.rs/) to build the LSP server.
- **Windows OS** (The underlying `trust-lsp.exe` is currently compiled for Windows x64).

### 2. Installation & Setup

Clone the repository and run the setup script. The setup script will download submodules, build the TypeScript MCP server, build the Rust LSP binary, and optionally clean up source files to leave you with a lightweight installation:

```bash
git clone https://github.com/boogy777-lgtm/ST-graph-rag-mcp.git
cd ST-graph-rag-mcp
bun run setup
```

*During setup, you will be asked if you want to delete source code and keep only the compiled binaries. If you just want to use the extension, type `y`.*

### 3. Configuration (OpenCode / Claude Desktop)

Add the server to your `opencode.json` (or `claude_desktop_config.json`):

```json
{
  "mcp": {
    "code-graph-rag-st": {
      "type": "local",
      "command": ["bun", "D:\\path\\to\\ST-graph-rag-mcp\\dist\\index.js"],
      "environment": {
        "TRUST_LSP_PATH": "D:\\path\\to\\ST-graph-rag-mcp\\bin\\trust-lsp.exe"
      }
    }
  }
}
```

## 🛠️ Available MCP Tools

The server exposes 21 granular tools for the LLM to explore your codebase:

| Category | Tools | Description |
|----------|-------|-------------|
| **Core** | `index`, `search`, `references`, `call_hierarchy`, `batch_index`, `health` | Build the graph and find exact usages. |
| **Analysis** | `variable_flow`, `fb_instances`, `call_chain`, `global_vars`, `impact_analysis`, `metrics` | Trace IO variables, depth analysis, and complexity. |
| **Advanced** | `state_machine`, `data_flow_graph` | Detect CASE-based state machines and structural data flow. |
| **SQL Graph**| `list_file_entities`, `get_graph`, `get_entity_source`, `detect_code_clones` | Raw AST extraction and code duplication detection. |
| **Utility** | `get_version`, `reset_graph` | Server metadata and DB wipe. |
| **Export** | `obsidian_export` | Render the SQLite graph to Markdown. |

## 📓 Obsidian Vault Export

Turn your PLC codebase into a navigable knowledge base. You can trigger this via the LLM (using the `obsidian_export` tool) or directly from your terminal:

```bash
# Export the indexed workspace to a local vault folder
bun run obsidian:export "D:\My_PLC_Project" "D:\Obsidian\My_Vault"
```

The exporter generates:
- Individual `.md` files for every `PROGRAM`, `FUNCTION_BLOCK`, `METHOD`, and `TYPE`.
- Rich YAML frontmatter for [Dataview](https://github.com/blacksmithgu/obsidian-dataview) querying (`dependencies_count`, `variable_count`, etc.).
- Internal `[[wikilinks]]` mapping your exact `CALLS`, `EXTENDS`, and `IMPLEMENTS` relationships.
- Mermaid diagrams for visual topology.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development instructions, testing guides, and architectural rules.

## 📝 License

This project is licensed under the [MIT License](LICENSE).
