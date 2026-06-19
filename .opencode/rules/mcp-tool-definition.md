---
paths: ["src/mcp/handlers/**/*.ts"]
topic: mcp-tool-definition
---

# MCP Tool Definition (scope: src/mcp/handlers/**)

## Naming

- Tool name: `kebab_case`, namespace prefix (e.g. `code_graph_rag_st_search`)
- Each tool in own file: `src/mcp/handlers/<tool>.ts`
- Export `async function handle<Name>(args): Promise<Result>`
- Register: `server.tool(name, schema, handler)` in `src/mcp/handlers/index.ts`

## Categories (21 tools total in v2.9)

| Category | Count | Examples |
|----------|-------|----------|
| Core | 6 | index, search, references, call_hierarchy, batch_index, health |
| Analysis | 6 | variable_flow, fb_instances, call_chain, global_vars, impact_analysis, metrics |
| Advanced | 2 | state_machine, data_flow_graph |
| SQL Graph | 4 | list_file_entities, get_graph, get_entity_source, detect_code_clones |
| Utility | 2 | get_version, reset_graph |
| Export | 1 | **obsidian_export** (NEW in v2.9) |

## Example: obsidian_export

```typescript
// src/mcp/handlers/obsidian-export.ts
import { z } from "zod";
import { ToolHelpers } from "../registry.js";
import { exportVault } from "../../obsidian/exporter.js";

export const ObsidianExportSchema = z.object({
  outputDir: z.string().min(1),
  force: z.boolean().optional().default(false),
  includeMermaid: z.boolean().optional().default(true),
}).strict();

export type ObsidianExportArgs = z.infer<typeof ObsidianExportSchema>;

export async function handleObsidianExport(
  args: ObsidianExportArgs,
  helpers: ToolHelpers,
): Promise<{ success: boolean; written: number; skipped: number; error?: string }> {
  try {
    const stats = await exportVault(helpers.sqliteManager, args);
    return { success: true, written: stats.written, skipped: stats.skipped };
  } catch (err) {
    return { success: false, written: 0, skipped: 0, error: (err as Error).message };
  }
}
```

Frontmatter generated per POU/TYPE (P6 F6 fix):

```yaml
---
name: FB_Motor
type: FUNCTION_BLOCK
file: src/motor.st
start_line: 12
end_line: 87
variable_count: 5
dependencies_count: 3
dependents_count: 7
tags: ["function_block", "pou"]
schema_version: 1
---
```

## Anti-patterns

- ❌ Default exports for handlers
- ❌ Side effects at module top level (DB init, file reads)
- ❌ Hardcoded paths — use `workspace-manager` context
- ❌ Throwing raw `Error` to client — catch and format `{success:false, error}`
- ❌ Inline Zod schemas in handlers — extract to `src/mcp/handlers/schemas.ts`

## Reference

- @src/mcp/handlers/core.ts
- @src/mcp/handlers/obsidian-export.ts
- @src/index.ts
