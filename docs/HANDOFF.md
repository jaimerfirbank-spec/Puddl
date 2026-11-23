# Handoff note, updated 23 November 2026

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
- Systems maps (PR #31): plus/minus import fixes and a plain-English report section (`_systemsReportHTML`):
  how to read the signs, loop tiles, signs donut, each loop in words with up/down trails, limits to
  growth, starting points and end results. Built from `computeInsights` (`loopSteps`, `polLinks`).
- Report charts (PR #32): every bar, column and donut slice has a hover tip (`data-tip`, `_tipA`). The
  bottleneck score shows its share of all routes (`_bottleneckCell`) with a "how it is worked out" note.
- Fresh map (PR #33): reset, new map, replace-import, opening a saved map and loading a file call
  `freshMapPanels()`, which closes Search & filter and clears the old filters and timeline date.
- Connections (PR #35): strong, moderate and weak only. Bold, dashed and double are gone; saved maps that
  used them are moved over on load (`_retireConnStyles`). Settings > Connections has a colour picker for
  each strength; picking one switches on "Colour connections by strength".
- Start screen (PR #36): saved maps sit beside the "name your project" card instead of a pop-up.
- Node panel (PRs #37, #39): lean version. One line per field, a count line (7 strong, 7 moderate, 1 weak)
  plus the five strongest as tags with "+N more" (`hpToggleConns`), no "Imported from spreadsheet" line.
- Hover in view mode (PR #38): the node and its direct connections stay bright, the next ring out is faded,
  the rest dims. The faded outer ring (hover, a clicked insight, a filter's neighbours) is drawn in one muted
  gold (`OUTER_RING_COL`, PR #40) so it cannot be mistaken for the bright first ring.

## Test assets

- `demo/carrfield-neighbourhood.csv` and `.xlsx`: 130 invented organisations in an invented neighbourhood, dated
  across a year. Thirty small groups reach the rest only through the Volunteer Centre, so it cuts off 30 and
  the Academy cuts off 9. Regenerate the xlsx from the csv with openpyxl if the csv changes.
- `demo/systems-service-demand.csv`: a systems map with plus/minus and a known set of 7 loops. Import it as a
  Systems map. (An Excel copy without the two warning rows exists only outside the repo; recreate it from the
  csv by dropping the `Quality of Care > Complaints` and `Morale > Burnout` rows.)
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

- Pull request #41: wording only, "crossed a sector line" becomes "cross-sector links" (uses the grouping word, so
  a map grouped by place reads "cross-place links"). Waiting for Jaime's yes.
- Branch `claude/vcfs-label` (no pull request yet): renames the demo sector "Community and VCS" to "VCFS" in
  the Carrfield files, the partner returns file and the collection template. Data only. Jaime asked for it
  but wanted no changes before his Monday meeting.
- Codex's draft pull requests #12 (saving and recovery), #13 (photo import) and #16 (Puddle Lens) are
  untouched by Claude. #12 should be reviewed and tested before any customer puts real data in. The start
  screen change (#36) is merged, so #16 will need to rebase onto it.
- Most older `claude/*` branches show as unmerged only because pull requests were squash-merged.

## Next jobs, in this order

1. **Shared and saved presentations do not work properly (fix first).** In the shared viewer file the notes
   divider cannot be dragged, and "Explore the map" switches to the map but pan, zoom and hover do nothing.
   Likely cause, not confirmed: `tools/build-viewer.py` keeps only code reachable from its entry points, and
   the divider drag (the IIFE under "Draggable divider for split panel") and the canvas listeners
   (`canvas.addEventListener('wheel'|'mousedown'|...)`) are stand-alone statements it leaves out. Fix by
   emitting those pieces for the viewer (view-only parts only, never editing), then save a real presentation
   with stops and open it as a recipient would. Do not weaken the `FORBIDDEN` check.
2. A "Connection matrix" tab repeats the sector grid on maps over 60 nodes. Hide one or say it is the same view.
3. The word "group" in Insights ("group of 130") means a connected network, which confuses people. Rename it
   (for example "one connected network of 130").
4. Analysis ideas to choose from, each a click not code: a menu of plain questions ("Who would we lose first?");
   one Excel table per organisation (connections, strength mix, bottleneck score, group, cut-off count);
   quiet influencers (few links, high bottleneck); suggested introductions (many shared partners, not linked);
   look-alike organisations; confirmed versus one-sided connections; a before/after between two dates;
   a bottleneck infographic (100-dot grid showing the share, with bars for the next four).
5. Shared workspace for a team: one shared map, named members, view and edit roles, a warning when someone
   else is editing, a change history, backups. Scope it before building; live co-editing is probably not needed.
6. Known gaps: see below.

## Not built, and why

- Splitting a merged node back into two. The merge record says what was joined, but not which connections
  belonged to which spelling. It would need each edge tagged at import with the spelling it came from.
- Shared team maps (see next jobs). Maps belong to one account today; there is no guest or shared access.
- Two-step loops (two things that affect each other) are not searched for, and Puddl keeps one line per pair,
  so opposite signs in two directions between the same pair cannot both be stored.
- Name matching misses surname-first order, nicknames and abbreviations.
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

## Systems maps and the + / - (detail)

- Demo file: `demo/systems-service-demand.csv`. Known answer: 7 loops listed (2 reinforcing, 4 balancing, 1
  with a missing sign), 8 found before near-duplicates are folded. Loops up to 8 steps are searched
  exhaustively; a loop with an unsigned link is "not yet classifiable", never guessed.
- A link written both ways between the same two things keeps only the first; the import summary now says
  which one was left out.
- Hand-drawn loop lines (arrow none, no sign) must never replace a real signed link when loops are classified.
