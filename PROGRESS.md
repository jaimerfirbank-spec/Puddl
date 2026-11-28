# Puddl — where we're up to

Last updated: 28 Nov 2026. Keep this short. Update it at the end of a working session ("save progress").

## Now / next
- **Flow animation rebased onto current main** on branch `claude/flow-animation` (this session). Systems-map directed edges show moving dashes along the arrow direction; toolbar toggle (btn-flow-toggle), toggle-only, throttled (~22fps, auto-pauses when tab hidden or edges>400). Not a saved map property. Not merged yet — preview it, then decide on merging.
- Phase 1b / next: persistent flow in the shared viewer (currently viewer only shows flow if toggled, and the toggle is stripped from the viewer, so effectively off there). Then node pulse on hover, then polarity interaction.

## Recently done
- Merged #81 (fold Explore, spreadsheet template) and #82 (clustering, smooth zoom, 2s hover highlight, text-only nodes, Map Editor rename) into main. Code-reviewed #82 first; Codex fixed four findings before merge (cluster-delete crash, clusterBounds guard, hidden notes in insights, edge-preview autosave).

## Branch housekeeping (still messy)
- ~59 claude/ and ~10 codex/ branches exist. main is now the current truth after #81/#82. Old branch `ccr-96a2b833-y73ecq` holds superseded flow work on a stale base — ignore/delete it. A proper branch tidy-up is still outstanding.
- CLAUDE.md on main is the OLDER version; the name-based rewrite from the earlier session was on the stale branch and needs re-doing against #82's new structure (Map Editor, clusters, new hover/edge functions). Not yet carried over.

## Planning thread: AI-assisted insights (not built)
- Deterministic insights stay as-is. Add one API call: computed insights + node labels + sector -> plain-English interpretation. No agent. Hand-written sector lenses (NHS, child services, education). Anonymise mode before any NHS/child-services outreach. Photo-to-map (#13) and Puddle Lens (#16) remain unfinished drafts.

## Open questions
1. Niche per account or per map?  2. SaaS users, consultancy clients, or both?  3. AI insights paid-only?  4. Final name: Puddl or Puddle?  5. Selling to councils while employed at one — check terms.

## Notes
- Planning/strategy lives in the "Puddle" Project in normal Claude, not here. Dev state only. No council content, no secrets.
- Puddle is desktop only (small-screen gate), so no mobile perf worry.
