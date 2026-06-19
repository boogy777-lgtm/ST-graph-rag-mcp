# Obsidian Vault Integration

ST-Graph-RAG-MCP includes a powerful feature to export your entire PLC codebase into an [Obsidian](https://obsidian.md/) Markdown vault. This turns abstract code into a highly visual, navigable knowledge base.

## How It Works

The exporter reads the semantic graph from the local SQLite database (`.code-graph-rag/st-graph.db`) and generates a folder structure filled with Markdown files.

It operates incrementally: it caches the SHA-256 hash of the generated markdown. If the underlying code hasn't changed, the file write is skipped, making repeated exports nearly instantaneous (usually <20ms).

## Triggering an Export

You can trigger the export in two ways:

### 1. Via AI Assistant (MCP)
Simply ask your LLM (OpenCode, Claude, Cursor):
> *"Export the current project to an Obsidian vault at D:\MyVault"*

The LLM will call the `obsidian_export` tool.

### 2. Via CLI
If you want to integrate this into a CI/CD pipeline or build script, use the standalone binary:

```bash
bun run obsidian:export "D:\Path\To\Workspace" "D:\Path\To\Vault_Output"
```

## Vault Structure

The generated vault looks like this:

```text
MyVault/
├── _index.md            # Root entry point with Mermaid graph and high-level stats
├── pous/
│   ├── PRG_Main.md      # A Program
│   ├── FB_Motor.md      # A Function Block
│   └── ...
├── types/
│   ├── ST_Config.md     # A Struct/DUT
│   ├── E_State.md       # An Enum
│   └── ...
└── .code-graph-rag-cache.json # Incremental cache (do not edit)
```

## Anatomy of a Generated Markdown File

Every `.md` file is richly formatted for both human reading and machine querying.

### 1. YAML Frontmatter
Designed for the [Obsidian Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin.

```yaml
---
name: FB_PID
type: FUNCTION_BLOCK
file: D:\workspace\src\FB_PID.st
start_line: 10
end_line: 45
variable_count: 8
dependencies_count: 2
dependents_count: 5
tags: ["function_block", "pou"]
schema_version: 1
---
```

**Dataview Example:** Find the most complex Function Blocks:
```sql
TABLE dependencies_count, variable_count
FROM "pous"
WHERE type = "FUNCTION_BLOCK"
SORT dependencies_count DESC
LIMIT 10
```

### 2. Wikilinks (`[[ ]]`)
Every time a POU calls another POU, or extends a base class, it is rendered as an Obsidian wikilink. 

```markdown
## Calls
Outgoing CALLS (1) from [[PRG_Main]]:
- [[FB_Motor]]
```

Clicking `FB_Motor` in Obsidian instantly navigates to its definition. If two entities share the same name in different files, the exporter automatically disambiguates them using the `[[Slug|Display Name]]` alias syntax.

### 3. Source Code Embeds
The actual Structured Text source code is appended at the bottom of the file in a standard `st` code block, allowing the LLM or developer to read the implementation without leaving Obsidian.
