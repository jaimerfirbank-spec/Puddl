# AGENTS.md

## Repository instructions for Codex

Read `CLAUDE.md` for the application's architecture, conventions, and verified implementation details. Treat its technical rules as applying to Codex as well.

Before any change, read and follow `AI_WORKFLOW.md`. In particular:

- Never work directly on `main`; use a `codex/<task>` branch.
- Check open branches and pull requests for overlapping Claude work.
- Do not edit a feature or section currently owned by another active branch.
- Use a separate worktree/folder from Claude Code.
- Do not push, merge, deploy, or perform destructive Supabase operations unless the user explicitly authorizes the relevant action.
- Keep edits minimal and targeted.
- Do not read the very large `index.html` or `viewer.html` wholesale. Search for symbols, then inspect only the required ranges.
- Do not hand-edit `viewer.html`; regenerate it with `python3 tools/build-viewer.py` when required by `CLAUDE.md`.
- Preserve unrelated user changes.
- Test proportionately, review the diff, and report exactly what was checked.
