# Handoff note, 22 November 2026

Written so another coding agent (Codex) can pick up if Claude Code is unavailable. It is a snapshot,
not a status board. Git branches and pull requests are the source of truth for active work, so check
`git log`, `git branch -r` and the open pull requests before trusting anything below.

If you are an AI without access to the repository (for example ChatGPT in a browser), ask Jaime to
paste this file and `CLAUDE.md` to you, and give him changes as small, exact edits rather than whole files.

## Read first, in this order

1. `CLAUDE.md` (architecture, conventions, how to report to Jaime)
2. `AI_WORKFLOW.md` (branches, worktrees, one agent per feature, no direct pushes to `main`)
3. `AGENTS.md`
4. This note

## How Jaime wants to be worked with

- He listens back to replies as audio. Tell him what changed in plain words: what the software did
  before, what it does now. No file names, function names, line numbers, test output or step-by-step history.
  That detail belongs in the commit message.
- Be honest, including about doubts. Do not hype. No em dashes.
- Before changing something on screen, show him what it will look like (a mock-up or picture) and how you
  will do it, and wait for a yes. For anything big, ask the questions first.
- Do not merge, push to `main` or deploy unless he says so for that action. A merge to `main` deploys to
  production at once.
- Draft emails and messages for him; never send them.

## What is live on main

Everything below is merged and deployed. Pull requests #26 to #29 hold the detail.

- Import: duplicate names are now found inside a spreadsheet, not only against the map, and a
  misspelled name typed in a "Connected to" cell is offered its nearest match instead of being dropped.
  Names are compared by word (`_looksLikeSameName`), because character similarity alone scores
  "Carrfield Pharmacy" against "Carrfield Academy" at 0.93.
- Auto-arrange: single-connection items fan out round what they join (`fanSingleConnections`), items are
  pushed off lines that are not theirs (`clearLinesOffNodes`), the finished map is stretched to the screen
  shape (`stretchToScreen`), and spacing is one setting (`NODE_BREATHING`).
- Insights: click any name or link to light it up on the map (`focusInsight`, `_focusFor`, `_applyFocus`).
  The panel follows the timeline date.
- Merge record: every import merge stores the other spelling on the node (`mergedFrom`), listed in Insights
  and the report, with a Show/Hide switch for the badge (`SHOW_MERGE_MARKS`).
- Findings and report: a "What this map tells you" card (`computeFindings`), and a report summary built
  around colour-coded charts, the findings in plain English, a group-by-group grid, and a change table.
  The report follows the current selection and the timeline date, and says what it covers.
- Settings "What each item is" (`MAP_NOUN`): people, organisations, services, items.
- Open pull requests #21 to #25 (plus/minus import, shortest loops, insight cards, stakeholder cards,
  root causes) were merged in one go.

## Test assets

- `demo/carrfield-neighbourhood.csv`: 100 invented organisations in an invented neighbourhood, dated across a year.
- `demo/carrfield-partner-returns.csv`: eight messy rows to import on top, to show the duplicate checks.
- `demo/south-yorkshire-partnerships.csv`: 98 invented organisations across four places and a regional layer.
- `templates/partnership-map-collection.xlsx`: the sheet partners fill in. Rebuild it with
  `python3 tools/make-collection-template.py`. It imports cleanly into Puddl.
- All of this data is invented. Keep it that way. Do not put real organisations' names against invented relationships.
- There is no test suite for `index.html`. Claude tested in headless Chromium (Playwright). Things to know:
  the sandbox blocks the CDNs, so fetch `d3@7.9.0` and `xlsx@0.18.5` with `npm pack` and answer the CDN
  requests from disk; stub the Supabase client; hide `#auth-modal` and `#who-modal-bg`; `#canvas-area` is
  `display:none` until the start flow runs, so set it to `block` before taking a screenshot of the panels;
  `page.screenshot` does not capture the canvas, so read it with `canvas.toDataURL`.

## In progress, not merged

- Branch `claude/start-screen-maps` (preview built, not live): puts the saved-maps list beside the "name your
  project" card on the start screen instead of a pop-up over it. It is held because it clashes with
  `codex/puddle-lens`, which changes `afterSignIn` so the pop-up opens at start-up to list browser recovery
  copies. Decision for Jaime: hold until after Monday 23 November, then fold the recovery copies into the new card.
  Whichever lands second must rebase onto the first.
- Codex's draft pull requests (#12, #13, #16) have not been touched by Claude.

## Not built, and why

- Splitting a merged node back into two. The merge record says what was joined, but not which connections
  belonged to which spelling. It would need each edge tagged at import with the spelling it came from.
- Shared team maps and per-seat pricing: an idea Jaime wants to talk through. No code, no decision.
- Phone layout: out of scope. Mobile is handled by Puddle Lens.

## Things that bit us, so they do not bite you

- A textually clean merge can still be broken at runtime. Merging the polarity import onto the import split
  produced `polarityUnreadable is not defined` on every import. Run the import flow after any merge.
- `getVisibleNodes` treats only a filter or search as a selection, never an item that is merely lit up
  (pinned). Do not make it depend on `highlightIds.size` again.
- The "% of possible connections" figure falls as a map grows (nodes arrive faster than links). Do not quote
  it across a timeline.
- New saved-map fields are optional (`mergedFrom`, `showMergeMarks`, `mapNoun`); older maps must keep loading.
- `viewer.html` is generated. Run `python3 tools/build-viewer.py` after changing rendering, insights or the
  presentation. It refuses to write if editor code becomes reachable.
- Never read `index.html` wholesale. Search for the symbol, then read the range.
- Vercel: `main` deploys to production; every branch gets a preview address; the previous production build
  can be promoted back from the Vercel dashboard.
