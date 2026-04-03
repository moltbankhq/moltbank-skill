# Legacy Reference (Archived)

This document is archived and no longer part of the active MoltBank skill runtime.

As of April 2026, the active architecture is:

- Canonical `moltbank` CLI
- JSON-first command outputs (`--json`)
- Explicit human-run auth via `moltbank auth login`
- Optional local MCP bridge via `moltbank mcp stdio`
- No host-environment mutation, no global OpenClaw config edits, no detached onboarding jobs

Use the current guidance in `SKILL.md`.

If you need details that were historically in this file, recover from git history and adapt them to the CLI/MCP-first model before reuse.
