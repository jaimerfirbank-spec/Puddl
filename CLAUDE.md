# Puddl — Developer Reference

## Working file
**`index.html`** (git repo: `jaimerfirbank-spec/Puddl`, deploys to puddl.vercel.app)

Single-file HTML app. All CSS, HTML and JS are inline. No build step, no npm. Open directly in a browser or via `python3 -m http.server 7890`.

The file is ~955 KB / ~13,600 lines with 624 functions. **Never read it wholesale.** Work by name:

```
grep -n "function theFunctionName" index.html   # get the current line
```

then `Read` with `offset`/`limit` around it.

### The one rule that keeps this doc from rotting
**Grep for the symbol name, never trust a line number.** Line numbers in a file this size move on almost every commit. This doc deliberately names functions and globals instead. The table in "Anchor lines" is a dated convenience only — if a number is wrong, grep the name and move on, don't go hunting.

---

## How to orient at the start of a session
You do **not** need to re-read `index.html`. Do this instead:
0. Read **`PROGRESS.md`** first — it says where we're up to, what's in flight and what's next.
1. Read this file (it auto-loads as project instructions anyway).
2. Identify the task area in "Task map" below.
3. `grep -n` the named entry point(s) for that area, read a few hundred lines around each, edit.
4. If rendering, hover panel, insights or presentation changed, regenerate the viewer (see "Sharing").

That's the whole loop. The map below is the thing that replaces re-reading.

---

## Task map — where things live by job
Grep the named symbol to land in the right place.

| If you're changing… | Start at these symbols |
|---|---|
| **Insights (the maths)** | `computeInsights` → returns an object `I` used everywhere |
| **Insights (the panel UI)** | `renderInsights`, `insightSummaryLines`, `refreshInsightsIfOpen` |
| **Systems-map insight logic** | `classifySystemsLoop`, and grep `MAP_TYPE==='systems'` |
| **Stakeholder-map insight logic** | grep `MAP_TYPE==='stakeholder'` inside `renderInsights` / `computeInsights` |
| **Per-map-type wording** | grep `MAP_TYPE` (75 refs); nouns via `nounFor` / `NOUN` |
| **Canvas rendering** | `draw` (everything draws in here) |
| **Node hit-testing** | `nodeAt`, `nodeDims` |
| **Node shapes / image fill** | `drawNodeShape`, `shapeImageBox`; `nodeEdgePt`, `rayPolyEdge` (both defined **inside** `draw`) |
| **Force layout** | `buildSim` |
| **Add/edit connections** | `addEdge`, `confirmConnection`, `setMode`, `setEdgePolarity` |
| **Loops** | `confirmLoop`, `cancelLoop`, `deleteLoop`, `classifySystemsLoop` |
| **Node images / icons** | `loadNodeImage`, `applyNodeIcon`, `PUDDL_ICONS`, `ctxUploadImage` |
| **Hover panel** | `showHoverPanel`, `renderHoverPanel` |
| **Reports** | `buildSummaryReport`, `buildMatrixReport`, `buildStrengthReport`, `buildChangeReport`, `buildPrintReport`, `argumentAnalysis` |
| **Presentations** | `enterPresentation*`, `enterPresentationMode`, `capturePresStop`, `presentationStops` |
| **Map-type choice / startup** | `pickMapType`, `confirmWho`, `MAP_TYPES`, `MAP_TYPE_LABELS` |
| **Undo / redo / snapshot** | `snap`, `saveState`, `restoreSnap`, `history` |
| **Local + cloud save** | `autoSave`, and the `cloud*` functions (`cloudSaveCurrent`, `cloudOpenMap`, …) |
| **Export / import files** | `exportJSON`, `importJSON`, `saveFile`, `saveShareFile`, `exportPNGSnapshot` |
| **Auth / Supabase** | `supabaseClient`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, the `signIn*` block |
| **Settings panel** | `openCustomizePanel`, connection-style + loop-style controls |
| **Status / modes** | `showStatus`, `setMode` |

---

## Tech stack
- **D3.js** (force simulation, drag) — CDN, loaded near the end of `<body>`
- **HTML5 Canvas** (`<canvas id="bg">`) — all graph rendering
- **Supabase JS** — CDN, loaded in `<head>` (`@supabase/supabase-js@2`)
- **xlsx** — CDN, for spreadsheet import/export
- **Vanilla JS** — no framework, no bundler
- **CSS custom properties** for theming
- **Fonts**: DM Sans (Google Fonts)

### File layout inside index.html
- `<style>` … `</style>` — all CSS (roughly the first ~1,080 lines)
- `<body>` begins, then the HTML markup for modals, toolbar, panels
- several `<script>` blocks; the large one holds the whole app
- D3 and xlsx `<script src>` tags sit **after** the markup

---

## Key global state
Grep each name; these are the ones worth knowing.

```js
let nodes=[], edges=[], loops=[];
let zoom=1, panX=0, panY=0;
let mode='move';                 // 'move' | 'connect' | 'delconn' | 'loop'
let connectFrom=null;
let loopNodes=[], loopDirection='cw', loopAddingNode=false;
let selectedLoopId=null;
let dragLoopId=null, dragLoopInitPos={}, ...;
let ctxMenuNodeId=null, _ctxClientX=0, _ctxClientY=0;
let selectedEdgeIdx=null;
let MAP_TYPE='general';          // 'general'|'network'|'systems'|'stakeholder'|'argument'
const MAP_TYPES=['general','network','systems','stakeholder','argument'];
const MAP_TYPE_LABELS={general:'General map',network:'Network map',systems:'Systems map',stakeholder:'Stakeholder map',argument:'Argument map'};
let history=[], histIdx=-1;      // undo/redo
let presentationStops=[];        // the presentation being built
let LOOP_CONNECTION_STYLE={...}; // single loop-edge style
let CONNECTION_STYLES=[...];     // array of normal-edge styles, same shape
let _iconGridBuilt=false;

// Cloud (grep the names):
const SUPABASE_URL='https://…supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_…';  // publishable key, RLS-protected — safe client-side, do NOT treat as a secret to remove
let supabaseClient=null;
let _cloudReady=false, _cloudTeam=null, _cloudMapId=null, _cloudDirty=false;
```

---

## Map types
`MAP_TYPE` drives wording and which insights show. The types:
- **general** — nodes/nodes
- **network** — people and groups (social / asset map)
- **systems** — factors that affect each other (causal loop diagram); supports edge polarity and delay, loop R/B classification, Limits to Growth
- **stakeholder** — everyone around one project; power dynamics insights (Silent Giants, Gridlock, Influence Bridges, Alignment Health)
- **argument** — one claim, reasons for/against; tree layout; hidden from the new-map picker but still functional

When touching insights or copy, grep `MAP_TYPE` and handle each branch. Argument maps usually opt out of the structural insights.

---

## Coordinate system
- **World coords**: node `x`, `y`
- **Canvas pixel** = `worldX * zoom + panX`, `worldY * zoom + panY`
- `draw()` does `ctx.save(); ctx.translate(panX,panY); ctx.scale(zoom,zoom);` — everything after draws in world coords
- `nodeAt(sx, sy)` converts a canvas pixel back to world to hit-test
- **All line widths, font sizes and dash patterns are divided by `zoom`** to stay screen-constant

---

## Core rendering — `draw()`
Draw order (back to front):
1. Background (fill / bg image)
2. Dot grid
3. Loop group indicators (lock badge only — fill and ring were removed; do not re-add)
4. Edges (quadratic Bezier for normal; `ctx.arc()` for loop edges)
5. Loop-mode preview (while building)
6. Nodes (shape fill → image/icon → label)
7. Hover panel, connect preview

**Never call `ctx.save()` without a matching `ctx.restore()`.**

`rayPolyEdge`, `nodeEdgePt` and the `loopEdgeCentroid` Map are defined **inside** `draw()`, so they're not globally callable.

---

## Node structure
```js
{
  id, x, y, fx, fy, pinned,
  label, type,          // 'process' | 'centre'
  shape,                // 'circle'|'square'|'rectangle'|'diamond'|'triangle'
  colour,
  nodeImg,              // data URL (photo or SVG icon) or null
  iconId,              // set when an icon was applied
  _nodeImgObj,          // Image object from loadNodeImage(n), transient, not serialised
}
```
Sizing via `nodeDims(n)` → `{r, w, h, FS}`. `centre` type ~r65, default process ~r40.

Photos: large uploads go to **Supabase Storage** (bucket `map-images`), not into the map JSON — grep `loadNodeImage` and the storage upload/signed-URL helpers.

---

## Edge structure
```js
{
  id, source, target,   // node ids (int); D3 may swap in object refs after sim runs
  strength,             // 'weak'|'moderate'|'strong'|'loop'
  isLoop,               // true for loop-generated edges
  note, colour,         // optional
  polarity, hasDelay,   // systems maps: '+'/'-' and delay marker
}
```
Resolve ends with `typeof e.source==='object' ? e.source : nodes.find(n=>n.id===e.source)`.
- **Loop edges** (`isLoop` / `strength==='loop'`) draw as `ctx.arc()` using `loopEdgeCentroid`.
- **Normal edges** draw as quadratic Bezier.
- Style from `LOOP_CONNECTION_STYLE` (loop) or `CONNECTION_STYLES` (normal).

---

## Loop structure
```js
{ id, nodeIds, direction, locked, cx, cy, radius }
```
- `loopEdgeCentroid` Map is rebuilt every `draw()`; uses locked `cx/cy/radius` when locked, live centroid when not.
- `classifySystemsLoop` labels reinforcing (R) vs balancing (B) from edge polarities.

---

## Insights — the shape
`computeInsights()` runs pure graph maths for **every** map type and returns an object (commonly `I`) with things like critical links (bridges), betweenness/bottlenecks, density, overloaded hubs, in/out degree, feedback loops. It does **not** know about map type.

`renderInsights()` decides what to **show** and how to word it per `MAP_TYPE`. `insightSummaryLines(I)` builds the short summary. If you add a metric, compute it in `computeInsights` and surface it in `renderInsights`.

> **Planned (not built):** an optional AI layer that takes the computed `I` + node labels + the user's sector and returns plain-English interpretation. It must not recompute metrics. See the Puddl planning notes / decisions log, not this file.

---

## Persistence
- **Undo/redo**: `saveState()` pushes `snap()` JSON onto `history`; `restoreSnap(s)` rebuilds (re-links edge source/target, reloads node images, calls `buildSim()` + `draw()`).
- `snap()` serialises nodes, edges, loops, loop style, projectName, bgImageData.
- **Local + cloud autosave**: `autoSave()` and the `cloud*` functions. Cloud writes go through `supabaseClient`; a single-blob-per-map model means concurrent editors would overwrite each other (why shared team maps are deferred — see `supabase/schema.sql`).
- **Files**: `exportJSON`/`importJSON` (.puddl), `exportPNGSnapshot` (PNG).

After any user-driven data change: `saveState(); markUnsaved();` then `draw()`, plus `buildSim()` after structural changes.

---

## Cloud / Supabase
- `SUPABASE_ANON_KEY` is a **publishable** key (prefix `sb_publishable_`). It's meant to live in the client and is protected by Row Level Security. **It is not a secret — leave it in place, don't "fix" it.** The real secrets (service-role keys, any OpenAI key) live only in Vercel env vars and must never enter the repo.
- Data model and access rules: `supabase/schema.sql`. Teams are the billable unit, created by hand in the Supabase dashboard. Read the comments there before touching anything cloud.

---

## Sharing — `viewer.html` is generated, never hand-edited
`viewer.html` is what people are sent. Regenerate it after any change to rendering, the hover panel, insights or presentation:
```
python3 tools/build-viewer.py
```
The generator (`tools/build-viewer.py`) walks the call graph from a list of `ENTRIES` (viewer entry points) and emits only what's reachable, so there's one copy of the drawing code. Editing, import, export, saving, account and cloud are unreachable and not emitted. `STUBS` replaces writers (`saveState`, `autoSave`, …) with no-ops. `FORBIDDEN` names things that must never appear (`saveFile`, `exportJSON`, `SUPABASE_*`, …); the build refuses to write if any leak through, and strips buttons whose handlers weren't emitted.

`saveFile()` fetches `viewer.html` at save time and injects the snapshot into `#puddl-viewer-data` (viewer reads this) and `#puddl-saved-state` (Puddl's importer reads this). It needs the app online. `viewer.html?src=<url>` loads a map from a URL.

Why it exists: the old view-only export was the whole working app, so a customer could export once and keep Puddl forever. The viewer has no editor.

---

## Icons
Right-click node → "Choose icon" → `ctxOpenIconPicker()`. Icons are in `PUDDL_ICONS`. `applyNodeIcon(icon)` builds an SVG data URL and sets `n.nodeImg` (and `n.iconId`). Grid built once, gated by `_iconGridBuilt`.

---

## UI patterns
- **Status**: `showStatus(text)`
- **Modes**: `setMode(m)` cleans up the previous mode
- **Theme**: `data-theme="dark"` on `<html>`; in `draw()`, `_dark` reflects it
- **Startup**: the who/name modal → `confirmWho()` sets `projectName`
- **CSS vars**: `--surf`, `--surf-2`, `--surf-3`, `--ink`, `--ink-2`, `--ink-h`, `--bdr`, `--bdr-m`, `--radius`, `--radius-lg`, `--shadow-lg`, `--shadow-xl`, `--acc`, `--txt-m`

---

## Conventions
- **Never read the full file** — grep the name, then targeted read.
- All canvas measurements divided by `zoom`.
- Match existing UI style: `var(--surf)`, `var(--bdr)`, DM Sans, `var(--radius-lg)`, `var(--shadow-xl)`.
- `ctx.save()`/`ctx.restore()` around every state-changing draw block.
- After user-driven data changes: `saveState(); markUnsaved();` → `draw()`; add `buildSim()` after structural changes.
- Prefer minimal edits: grep → targeted read → Edit. Don't rewrite the file.
- Don't hand-edit `viewer.html`; regenerate it.
- Keep the publishable anon key and any committed config as they are; never add real secrets.

---

## Anchor lines (dated convenience — verified 28 Nov 2026; grep if wrong)
`buildSim` 2846 · `nodeDims` 2942 · `nodeAt` 2985 · `snap` 3026 · `saveState` 3069 · `restoreSnap` 3081 · `draw` 3364 · `rayPolyEdge`/`nodeEdgePt`/`loopEdgeCentroid` ~3400-3490 · `drawNodeShape` 4107 · `computeInsights` 4501 · `classifySystemsLoop` 4840 · `argumentAnalysis` 4881 · `insightSummaryLines` 4914 · `renderInsights` 4974 · `addEdge` 6970 · `setMode` 7105 · `confirmLoop` 7236 · `showStatus` 7277 · `buildSummaryReport` 8620 · `pickMapType` 10367 · `autoSave` 10507 · `ctxMenuNodeId` 10888 · `loadNodeImage` 11055 · `PUDDL_ICONS` 11096 · `applyNodeIcon` 11168 · `showHoverPanel` 13095 · `SUPABASE_URL` 13570 · `supabaseClient` 13573

---

## Claude and Codex coordination
Before starting work, read and follow `AI_WORKFLOW.md`. Use a `claude/<task>` branch and a separate worktree/folder from Codex. Check active branches and pull requests for overlapping work, and don't edit an area another agent currently owns. `api/` files (photo-to-map, OpenAI) live on Codex's draft branches, not on `main` — check before assuming they're here.
