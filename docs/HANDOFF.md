# Handoff note, updated 24 November 2026 (evening)

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

## State at handover to Codex, 24 November evening

Everything below is merged to `main` and live except where it says otherwise. Read `AI_WORKFLOW.md` first and use a `codex/<task>` branch.

- **Live and working:** side panel (Explore), Refresh from spreadsheet, Google Sheet link, saving fix, Focus, thinned names, community colours,
  arrow size and gradient, Ask rebuild (31 questions), plain-English ripple bar, dotted connection line, arrow and +/- when adding a connection,
  no empty name box. Tests run on every pull request (`tests/README.md`).
- **Built but NOT live:** the shared workspace (share a map, view-only role, team list, last saved by, history). It needs five database
  migrations, in order, none applied: `20261117`, `20261124`, `20261125`, `20261126`, `20261127` in `supabase/migrations/`. The steps, with
  backup and a staging check first, are in `docs/DATABASE-ROLLOUT.md`. **Do not apply them to the live database without Jaime saying so.**
- **Waiting on Jaime:** his evening walk-through (checklist), a real-Google check of the Google Sheet link, a Supabase spare project and backup
  before the migrations, whether the first customer team and owner exist in the database, and the first real tester.
- **Branding branch** (`codex/ask-the-map`: plush logos, opening animation) has no pull request and clashes with `main`. Jaime wants the new logo
  live: update it against current `main` (the panel, toolbar and Ask button have all changed), open a pull request and show him a picture first.
  Do not bring back the floating Ask Puddle button or the toolbar "Ask the map" button; both were removed on purpose.
- **Drafts #13 (photo import) and #16 (Puddle Lens)** predate today's changes and need updating and a production setup. #12 is replaced by the
  saving fix and can be closed; #43 (demo sector rename) is parked and can be closed.
- **Next jobs, in order:** see "Next jobs" below. After the walk-through: the data side (one Excel table per organisation, a kind-of-relationship
  field, filter by any field, saved views), then public-body readiness (accessibility, a plain data-storage note), then comments on shared maps
  only if a customer asks.
- **Rules that bit us:** never read `index.html` whole (grep, then read a range); run `python3 tools/build-viewer.py` after any drawing, hover,
  insight or presentation change (CI fails if `viewer.html` is stale); no customer names, prices or day-job material in the repo; Jaime listens
  to replies as audio, so report in plain before-and-after words and end with one decision question.

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

- Wording (PR #41, #46): "cross-sector links" (follows the grouping word), "one connected network" instead of
  "group of 130", and a plain-words glossary. The product name is Puddle everywhere people see it.
- Ask Puddle (PRs #47 to #49): questions are matched by scored everyday words (`_askRank`, `_askDecide`):
  an exact answer, a "I took that to mean..." guess, a short list of close questions, or a list of everything.
  Typing a word such as "connections" lists every question that mentions it. No microphone.
- Shared and saved presentations (PRs #48, #49, #50): the shared file now drags the notes divider, and
  "Explore the map" pans, zooms and hovers (Codex fixed `tools/build-viewer.py`). Presentation setup has a
  Save presentation button that says it worked (`presSaveDraft`).
- Report (PR #51): when questions are chosen in Ask, the report shows only those, with Selected questions and
  Full report buttons (`REPORT_SELECTED_ONLY`). The charts section is renamed.
- Side panel (PRs #52, #54): one docked panel at the left, about 30% of the screen (25% to 40%, dragged by the
  grey bar, remembered per browser), with four tabs: At a glance, Ask, Filter, Report. Fold away hides it. The
  top-left Panel button opens it. Pop out turns Ask back into the draggable floating box; Dock puts it back.
  The old Search & filter pop-up is the Filter tab. At a glance is the short summary (counts, who the map
  depends on, biggest go-betweens, top three findings); Show more opens the long lists (`_insFull`).
  The panel is built by moving the existing elements in (`_dockBuild`), so their ids and code are unchanged.
  It sits in `#workspace` beside `#canvas-area` and is hidden whenever the canvas area is hidden (start and
  saved-maps screens) by a CSS sibling rule. It folds away during presentation editing, through a DOM event
  (`puddl-presedit`) so the generated viewer never reaches panel code.
- Look (PR #53): connections bow in proportion to their length (`EDGE_CURVE`, default 0.2), a Line strength
  setting (`EDGE_OPACITY`), a Spread-out dial (`NODE_BREATHING`), and size by go-between score
  (`setSizeBy('betweenness')`). All are saved with the map.
- Refresh from spreadsheet (PR #55): a button at the foot of the Filter tab. The map remembers how the columns
  were matched (`LINKED_SHEET`: key, file name, column roles). A refresh reuses the importer and goes straight
  to a summary (`_refreshDiff`, `_refreshSummaryRows`): new, changed with old and new values, unchanged, back,
  and no longer in the spreadsheet. The sheet wins for the columns it carries; blank cells never clear anything.
  Items not in the file are marked (`missingSince`: dashed amber ring, hover line, At a glance tag, a list with
  Dismiss in the Filter tab) and never deleted. Nodes carry `fromSheet` and `sheetKey`. A file that matches
  almost nothing is flagged and the marking defaults to off. In Chrome and Edge the file handle is kept in
  IndexedDB; elsewhere the file is picked each time. A OneDrive file synced to the computer is just a file.
- Google Sheet link (PR #56): paste a link to a sheet shared as "Anyone with the link" (`loadGoogleSheet`). It is
  read as CSV and handed to the same importer; the link is kept in `LINKED_SHEET.url` and Refresh then reads it
  with no file to pick. Saved files drop the address and shared files drop the whole link. **Not verified
  against live Google** (see below).

- Saving and recovery (PR #58, Codex's #12 brought up to date with three fixes): saves wait for in-flight work and a
  failed online save stops a map switch or logout; browser recovery copies per account and map; strict checks on loaded
  map data (`validateMapSnapshot`); imported text escaped across the app. Fixes added: renaming the open map takes the new
  row timestamp, named versions stay out of undo history, a full browser store no longer blocks the online save, and a map's
  browser copy is dropped when it is safe online and left. **The database change (`supabase/migrations/20261117_reliable_map_limits.sql`)
  is NOT applied.** It needs a backup and a staging check, and it stops the app changing a map's owner, team or scope, which
  the shared team workspace will need to get around.
- Focus (PR #59): hover-panel Focus button or right-click "Focus on this and its neighbours" hides everything further than
  1 to 6 steps (`FOCUS_VIEW`, `_focusHidden`), with a bar to widen, narrow or Show everything. View only; At a glance and the
  report still describe the whole map. Ends on restoring a map.
- Names thinned on a busy map (PR #60): only names that fit are drawn, most important first (`_computeLabelSet`), scaled up to
  be readable when zoomed out; hovered and lit-up items keep theirs. Setting `LABEL_THIN`, saved with the map.
- Colour by community (PR #61): Settings > Map > Colour by > Community. Louvain modularity (`_communityRefresh`), deterministic,
  strong/moderate/weak weighted 3/2/1; legend names each community after its best-connected member and clicking lights it up.
- Arrow size and gradient lines (PR #62): `ARROW_SIZE` and `EDGE_GRADIENT` in Settings > Connections.

- Panel tidy and connection options (this branch, after #77): the side panel button is now called **Explore**, the panel opens by default
  the first time on a screen at least 1100px wide (then stays as left), the toolbar "Ask the map" button is gone (the floating Ask
  Puddle button shows only while the panel is folded away), and the panel has more room on the left and a visible left edge. Adding a
  connection now lets you choose arrow direction first (none, forward, back, both) and, on systems and stakeholder maps, a + or -
  sign (a sign on a plain line gives it forward, as editing a connection already did). A node with no name no longer gets an empty
  white box that stopped lines short of it. Also fixed: At a glance was left blank when a map was loaded with the panel open
  (`clearSearch` collapsed the old dropdown).

- Ripple wording, dotted line, no floating Ask button (after #78): the ripple bar now reads in plain words ("If X goes up: 5 things go up;
  3 things go down; ...") with one line saying how it is worked out; the floating Ask Puddle button is gone for good (Explore, then the
  Ask tab, is the way in; the pop-out Ask window still exists); a connection can be drawn **Dotted** (`edge.dotted`, saved with the map,
  chosen when adding a connection and in the edit popup). Dotted is a look only: it does not change strength counts or any figure, and it
  means "informal, planned or unconfirmed" only by the tooltip. If Jaime wants it to carry a meaning (a kind-of-relationship field),
  that is the data-side job.

## Test assets

- Note on the sector name: the demo files still say "Community and VCS". Jaime is renaming it to VCFS in his own
  spreadsheets, so pull request #43 (data only) is parked and can be closed.
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
- Tests now live in `tests/` (see `tests/README.md`) and run on every pull request through `.github/workflows/tests.yml`:
  `checks` (Ask golden and phrasing tests, browser tests in headless Chromium, Codex's reliability tests, and a check that
  `viewer.html` is not stale) and `database` (real Postgres 16 running `tests/sql/`, a stub of Supabase's auth plus the real
  `supabase/schema.sql` and migrations). It is real Postgres, not Supabase itself. Run `bash tests/sql/run.sh` locally with Postgres.
- When testing by hand in a sandbox: the sandbox blocks the CDNs, so fetch `d3@7.9.0` and `xlsx@0.18.5` with `npm pack` and answer the CDN
  requests from disk; stub the Supabase client; hide `#auth-modal` and `#who-modal-bg`; `#canvas-area` is
  `display:none` until the start flow runs, so set it to `block` before taking a screenshot of the panels;
  `page.screenshot` does not capture the canvas, so read it with `canvas.toDataURL`.

## In progress, not merged

- Pull request #43 (`claude/vcfs-label`): VCFS rename in the demo files. Parked, see above.
- Codex's draft pull requests #12 (saving and recovery), #13 (photo import) and #16 (Puddle Lens) are untouched by
  Claude. #12 should be reviewed and tested before any customer puts real data in. They were written before the
  side panel, Refresh and the Google Sheet link, so expect conflicts in `index.html` and `viewer.html`.
- `codex/ask-the-map` now holds branding and opening-animation work only (plush logos, splash screen, header and map picker
  artwork). Its Ask work was merged through #47 and the old PR #45 is closed, so the branding has no pull request and
  conflicts with `main`. Codex will update it against `main` and open a fresh pull request when Jaime asks. Voice-to-text from that
  branch is not live.
- Most older `claude/*` branches show as unmerged only because pull requests were squash-merged.

## Next jobs, in this order

The plan Jaime and Claude agreed is "about 80% of what Kumu does, without the code": each ability goes in once as a
plain question and then appears in Ask, At a glance and the report. It is not in the repository; this is the summary.

1. **Check the Google Sheet link with a real shared sheet** on the live site. If the browser blocks the read
   (Google's cross-site rules; web reports disagree), build a small server-side relay that fetches only
   `docs.google.com` sheet addresses it builds itself from a validated id. There is no `api/` folder on `main` yet,
   and Codex's #13 adds one, so coordinate.
2. **Ask rebuild: done** (PRs #63, #65, #66, #67, #68, #69). Every question is one entry in `ASK_REGISTRY` (wording, group, weighted phrases,
   related words `syn`, meaning, `how` text, `next` follow-ups, `systems`/`noSystems`/`named` flags, answer function). 31 questions, including
   communities, quietly important, introductions, lose the top three, single-connection dependence, well placed (eigenvector), reaches
   everyone fastest (closeness), look-alikes, who gained the most, and three about named organisations (connected to, leaves, route between).
   Matching scores listed phrases plus word stems weighted by rarity (`_askRank`), finds names loosely (`_askNames`), and shows live "did you mean".
   **Two tests guard it:** `tests/ask-golden.cjs` (every answer, meaning and highlight on three demo maps must not change; add new questions
   with `--write`) and `tests/ask-phrases.cjs` (231 typed phrasings, fails on a wrong guess). Honest accuracy: on 42 phrasings written fresh and
   run before tuning, a third were answered directly and three quarters at least offered; the 231-set figures (86% / 99%) are flattering because
   failures were added to it. Word matching has a ceiling. Ideas not done: a rules checker, gaps by field, reciprocity.
3. The readability set (Focus, names, communities, arrows) is done. Original list for reference, to add as questions: who is close to the important people
   (eigenvector), who reaches everyone fastest (closeness), what communities exist, quiet influencers, suggested
   introductions, look-alike organisations, "if we lost the top three", before and after two dates, questions about
   one named organisation.
4. **Data side:** a kind-of-relationship field with a filter, filter by any field, a data table inside the app, one
   Excel table of figures per organisation, saved views.
5. **Shared workspace for a team** (Jaime said yes to starting; invites for the first customer will be sent by hand, Supabase plan
   is Basic for now). Slices 1 (PR #72) and 2 done. Slice 2: roles owner / member (can edit) / viewer (read only), enforced by
   the database (`supabase/migrations/20261125_team_roles.sql`, NOT applied, needs 20261117 and 20261124 first). Owner can switch
   someone between can edit and view only, and remove them, from a Team button in Your maps; any member sees the team list.
   Viewers get a "View only" notice and nothing they do is saved. People are still added by hand in the Supabase SQL editor
   (use `viewer` as the role for view-only). Removing someone keeps their private maps in the database, unseen. Slice 3 done: the database records who last saved a map (`updated_by`, set by the database so it cannot be forged;
   `supabase/migrations/20261126_edited_by.sql`, NOT applied; the app still lists maps without it). Shared maps show "last saved by
   ben@..." in Your maps, and a save clash now says who saved first and offers a copy download, once. Four migrations now wait
   (20261117, 20261124, 20261125, 20261126), to be applied in that order after a backup. Slice 4 done: shared maps keep earlier versions
   (at most one every 15 minutes, newest 20, shared maps only; `supabase/migrations/20261127_map_history.sql`, NOT applied, a fifth)
   with a History button in Your maps; anyone in the team can look, owners and members can go back, and going back keeps the current
   version first. Watch the database size: 20 versions of a big shared map is tens of megabytes. Next: 5 comments. The team and owner
   may not exist in the live database yet; check first (read-only queries). Keep customer names out of the repo.
6. Smaller: a bottleneck infographic (100-dot grid); the "Connection matrix" tab repeats the sector grid on maps over
   60 nodes; accessibility (the map is a canvas; offer the table as the accessible version).
7. Known gaps: see below.

## Not built, and why

- Splitting a merged node back into two. The merge record says what was joined, but not which connections
  belonged to which spelling. It would need each edge tagged at import with the spelling it came from.
- Shared workspace slices 2 to 5 (see next jobs). Slice 1 is merged (PR #72): a map's maker can Share it with their team and
  Make private again, and My maps lists the team's shared maps. It depends on `supabase/migrations/20261124_share_maps.sql`,
  which is NOT applied; until it is, the Share button says a database update is needed. That migration builds on 20261117
  (also NOT applied). Apply both together, in order, only after a backup and a staging check, on Jaime's say-so.
- Refresh does not remove a connection that has been deleted from the spreadsheet; it only adds new ones. Matching is by
  organisation name, so a rename in the sheet looks like a new item plus a missing one unless the near-duplicate
  review catches it.
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
- A new field on a node is lost on save unless it is added to the node list inside `snap()`. `fromSheet`, `sheetKey`
  and `missingSince` are there; `LINKED_SHEET` is saved as `linkedSheet`.
- The generated viewer takes only the `#canvas-area` markup and the code reachable from its entry points. Anything
  that sits outside `#canvas-area` (the side panel) is not in it. Do not reference panel functions from code the viewer
  reaches; use a DOM event, as presentation editing does.
- `freshMapPanels()` now also clears `LINKED_SHEET`, so a new or replaced map starts unlinked.
- Vercel: `main` deploys to production; every branch gets a preview address; the previous production build
  can be promoted back from the Vercel dashboard.

## Naming and wording

- The product is spelled **Puddle** in everything people see. "Puddl" survives only in the repository name, the
  web address (puddl.vercel.app) and some older notes. Do not change the app text to "Puddl".
- On-screen terms are plain; `_glossaryHTML` (Insights panel and report) lists each next to its standard name:
  go-between score (betweenness centrality), critical node (cut vertex), critical link (bridge), connected
  network (connected component). Keep the glossary in step if a term changes.

## Systems maps and the + / - (detail)

- Demo file: `demo/systems-service-demand.csv`. Known answer: 7 loops listed (2 reinforcing, 4 balancing, 1
  with a missing sign), 8 found before near-duplicates are folded. Loops up to 8 steps are searched
  exhaustively; a loop with an unsigned link is "not yet classifiable", never guessed.
- A link written both ways between the same two things keeps only the first; the import summary now says
  which one was left out.
- Hand-drawn loop lines (arrow none, no sign) must never replace a real signed link when loops are classified.
