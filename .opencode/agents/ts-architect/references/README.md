# Put reference materials here.

Long-form knowledge that the agent loads via {file:./references/X.md} in agent.md.

Examples:
- solid-principles.md
- gof-patterns.md
- v8-internals.md
- bun-vs-node-differences.md
- type-level-ts-cheatsheet.md

Refer from agent.md:
```yaml
prompt: "{file:./agent.md}"
references:
  - "{file:./references/solid-principles.md}"
  - "{file:./references/gof-patterns.md}"
```
