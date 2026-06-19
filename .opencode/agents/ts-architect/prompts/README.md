# Put subagent-specific prompts here.

When ts-architect delegates to specialists (code-reviewer, refactorer, profiler, etc.),
the delegation prompts can be stored here as reusable templates.

Examples:
- code-review-prompt.md
- refactor-prompt.md
- profile-prompt.md
- devil-advocate-prompt.md

Use:
```typescript
// In agent code:
const reviewPrompt = await readFile('./prompts/code-review-prompt.md', 'utf-8');
await delegate('code-reviewer', reviewPrompt);
```
