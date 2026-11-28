# Puddl — where we're up to

Last updated: 28 Nov 2026. Keep this short. Update it at the end of a working session ("save progress").

## Now / next
- **Animated connections — phase 1 DONE** (this session). Flowing dashes along arrow direction on systems maps: toggle button + hover kick, forward/backward/both-ways, RAF loop paused when tab hidden or edges>400. In editor + carried into viewer (hover only there). Flow is a view pref, not saved to the map.
- Phase 1b / next: persistent flow in the viewer (toggle is stripped from viewer, so it only flows on hover there — decide if a share should auto-flow); then **node pulse** (size-based, on hover); then **polarity +/- interaction**. Build in that order.
- Still open from before: the AI-insights **coverage audit** (for each map type, which user questions insights answer vs miss). Not started.
- Note: Puddle is desktop only (small-screen gate confirmed), so no mobile perf worry.

## Recently done
- Connection flow animation phase 1 (see Now/next). Entry points: `toggleFlow`, `_flowShouldRun`, `flowTick`, overlay code inside `draw()` edge branches; button `btn-flow-toggle`.
- #20 (merged): structural insights (critical links, bottlenecks, overloaded hubs, density) now show per map type with type-specific wording.
- CLAUDE.md turned into a task-to-symbol map so sessions grep by name, not line number.

## In flight (Codex drafts, none merged — don't edit their areas)
- #12 reliable map saving / recovery / imported data
- #13 photo-to-map (OpenAI via Vercel function, per-user allowance; api/ files live on this branch only)
- #16 Puddle Lens phone companion + private photo inbox

## Planning thread: AI-assisted insights (not built)
- Keep existing insights as deterministic maths. Add one API call: computed insights + node labels + sector → plain-English interpretation. No agent.
- Hand-written sector lenses (NHS, child services, education). Build an anonymise mode before any NHS/child-services outreach.
- Build the endpoint only after #13 merges.

## Open questions
1. Niche per account or per map?
2. Puddl SaaS users, consultancy clients, or both?
3. AI insights paid-only?
4. Final name: Puddl or Puddle?
5. Selling to councils while employed at one — check employment terms / outside-interests rules.

## Notes
- Planning/strategy lives in the "Puddle" Project in normal Claude, not here. This file is dev state only. No council content, no secrets.
