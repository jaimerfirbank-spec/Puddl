# AI Collaboration Workflow

This repository is worked on with both Claude Code and OpenAI Codex. Follow these rules before changing code.

## Non-negotiable rules

1. Never work directly on `main`.
2. Claude branches start with `claude/`; Codex branches start with `codex/`.
3. Use separate Git worktrees or separate local folders. Never run both agents in the same working directory.
4. One agent owns a feature at a time. Do not assign the same feature, bug, or files to both agents simultaneously.
5. Before starting, inspect open branches and pull requests for overlapping work.
6. State the intended feature and likely files in the branch name, commit, or draft pull request.
7. If another active branch touches the same section of `index.html`, stop and resolve ownership before editing.
8. Never push directly to `main`. Commit to the agent branch and use a pull request.
9. Test the branch before requesting a merge.
10. Merge only one pull request at a time. After a merge, update every remaining branch from `main`, resolve conflicts, and retest.
11. Never expose, commit, or overwrite Supabase secrets, service-role keys, Vercel secrets, or local environment files.
12. Do not deploy production or run destructive Supabase/database operations unless Jaime explicitly asks.

## Starting work

1. Confirm the requested outcome and boundaries.
2. Check `git status`; do not discard unrelated user changes.
3. Fetch the latest remote state.
4. Review open pull requests and recently changed files for overlap.
5. Create a fresh branch from the latest `main`.
6. For parallel work, use a dedicated worktree/folder.
7. Read the repository-specific instructions before editing:
   - Claude: `CLAUDE.md`
   - Codex: `AGENTS.md`
8. Search for the relevant symbols and read only targeted sections of the large HTML files.

## Finishing work

1. Review the diff for accidental or unrelated changes.
2. Run the relevant tests or browser checks.
3. If rendering, hover panels, insights, or presentations changed, run:
   ```bash
   python3 tools/build-viewer.py
   ```
4. Confirm no secrets or environment values entered the diff.
5. Commit with a clear message.
6. Open a pull request describing:
   - What changed
   - Files/areas touched
   - Checks performed
   - Known risks or remaining work
7. Do not merge automatically unless Jaime has explicitly requested it.

## Handling overlap

If Claude and Codex changes overlap:

1. Pause the newer task.
2. Finish and merge one pull request first.
3. Update the second branch from the new `main`.
4. Resolve conflicts deliberately; never blindly accept all changes from either side.
5. Retest the second branch before merging.

Git branches and pull requests are the source of truth for active work. Do not use this file as a live task-status board because simultaneous status edits would themselves create conflicts.
