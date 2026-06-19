# Put executable tools here.

Scripts the agent can invoke via bash permission. These are NOT loaded into context —
they're runtime utilities the agent calls.

Examples:
- profile-bottleneck.sh
- check-bundle-size.sh
- find-circular-deps.sh
- type-coverage.sh

Note: tools here require `bash: allow` permission in agent.md.
Keep them small and self-contained (Node.js / Bun / shell only, no external deps).
