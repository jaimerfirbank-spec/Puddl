# Puddl — Developer Reference

## Working file
**`~/Desktop/Puddl/index.html`** (git repo: `jaimerfirbank-spec/Puddl`, deploys to puddl.vercel.app)

Single-file HTML app. All CSS, HTML, and JS are inline. No build step, no npm. Open directly in a browser or via the preview server (port 7890, `python3 -m http.server 7890`).

The file is ~735k tokens (2,940,093 bytes / 12,721 lines) — never read it wholesale. Always use `grep -n` to find line numbers, then `Read` with `offset`/`limit`.


> **Line numbers below are from April 2026 and have drifted.**
> Verified 13 Nov 2026: `draw()` is at line 3226 (doc says ~2046); `nodeAt()` at 2870.
> The `let nodes = [], edges = [], loops = []` globals block no longer matches as written.
> Always `grep -n` for the symbol rather than trusting a line number here.

---

## Tech stack
- **D3.js** (force simulation, drag) — loaded from CDN
- **HTML5 Canvas** (`<canvas id="bg">`) — all graph rendering
- **Vanilla JS** — no framework, no bundler
- **CSS custom properties** for theming (`--surf`, `--ink`, `--bdr`, `--radius`, `--shadow-xl`, etc.)
- **Fonts**: DM Sans (Google Fonts)

---

## Key global state (~line 1800)
```js
let nodes = [], edges = [], loops = [];
let zoom = 1, panX = 0, panY = 0;
let mode = 'move';            // 'move' | 'connect' | 'delconn' | 'loop'
let connectFrom = null;
let loopNodes = [], loopDirection = 'cw', loopAddingNode = false;
let selectedLoopId = null;
let dragLoopId = null, dragLoopInitPos = {}, ...;
let ctxMenuNodeId = null, _ctxClientX = 0, _ctxClientY = 0;
let LOOP_CONNECTION_STYLE = { id, label, colour, lineWidth, dashPattern, arrowScale, isDouble };
let CONNECTION_STYLES = [...];   // array of style objects, same shape as above
let _iconGridBuilt = false;
```

---

## Coordinate system
- **World coords**: node `x`, `y` positions
- **Canvas pixel** = `worldX * zoom + panX`, `worldY * zoom + panY`
- `draw()` calls `ctx.save(); ctx.translate(panX, panY); ctx.scale(zoom, zoom);` — all drawing is in world coords
- `nodeAt(offsetX, offsetY)` converts canvas pixel → world to hit-test nodes

---

## Core rendering (`draw()`, ~line 2046)
Draw order (back to front):
1. Background (fill / bg image)
2. Dot grid
3. Loop group indicators (lock badge only — fill and ring have been removed)
4. Edges (quadratic Bezier for normal; `ctx.arc()` for loop edges)
5. Loop mode preview (while building a loop)
6. Nodes (shape fill → image/icon → label)
7. Hover panel, connect preview

**Never call `ctx.save()` without a matching `ctx.restore()`.**  
All line widths, font sizes, dash patterns must be divided by `zoom` to stay screen-constant.

---

## Node structure
```js
{
  id,          // integer
  x, y,        // world position
  fx, fy,      // D3 pin (set to x,y when pinned; null when free)
  pinned,      // boolean
  label,       // display name
  type,        // 'process' | 'centre'
  shape,       // 'circle' | 'square' | 'rectangle' | 'diamond' | 'triangle'
  colour,      // hex string
  nodeImg,     // data URL (uploaded photo OR SVG icon data URL) — null if none
  _nodeImgObj, // Image object, populated by loadNodeImage(n) — transient, not serialised
}
```

### Node sizing — `nodeDims(n)` (~line 1877)
Returns `{ r, w, h, FS }`. `r` is the primary radius used everywhere.  
- `centre` type: `r=65`, large label
- Default process node: `r=40`

### Shape helpers
- `drawNodeShape(ctx, x, y, r, shape, zoom)` — clips/fills the shape path
- `shapeImageBox(x, y, r, shape)` — returns `{x,y,w,h}` bounding box for image fill
- `nodeEdgePt(node, tx, ty)` — point on node's shape border toward `(tx,ty)`; handles circle/square/diamond/triangle via `rayPolyEdge()`
- `rayPolyEdge(ox,oy,ux,uy,verts)` — ray–polygon intersection

Both `nodeEdgePt` and `rayPolyEdge` are defined **inside** `draw()` — not globally accessible.

---

## Edge structure
```js
{
  id,          // string
  source,      // node id (int) — D3 may replace with object reference after sim runs
  target,      // node id (int) — same caveat
  strength,    // 'weak' | 'moderate' | 'strong' | 'loop'
  isLoop,      // boolean — true for loop-generated edges
  note,        // optional label string
  colour,      // optional override hex
}
```

### Edge rendering
- Source/target resolved: `typeof e.source==='object' ? e.source : nodes.find(n=>n.id===e.source)`
- **Loop edges** (`isLoop===true` or `strength==='loop'`): drawn as `ctx.arc()` using `loopEdgeCentroid` map
- **Normal edges**: quadratic Bezier with control point offset perpendicular to chord
- Arrowhead: loop edges use circle tangent at `arcEndAngle`; normal edges use Bezier derivative at `t=0.88`
- Style sourced from `LOOP_CONNECTION_STYLE` (loop edges) or `CONNECTION_STYLES` (normal)

---

## Loop structure
```js
{
  id,          // 'loop_' + timestamp
  nodeIds,     // ordered array of node ids (the sequence clicked)
  direction,   // 'cw' | 'ccw'
  locked,      // boolean — true after confirmLoop()
  cx, cy,      // loop circle centre (world coords)
  radius,      // loop circle radius
}
```

### Loop rendering pipeline
1. **`loopEdgeCentroid` Map** (rebuilt every `draw()`, ~line 2108):  
   Key = `"srcId_tgtId"` → `{x, y, r, n, dir}`  
   Uses `loop.cx/cy/radius` when locked (stable), live centroid when unlocked.

2. **Arc drawing** (~line 2180):  
   `ctx.arc(loopC.x, loopC.y, loopC.r, startAngle, endAngle, antiCW)`  
   `antiCW = loopC.dir === 'ccw'` (false = CW = anticlockwise=false in canvas API)

3. **Arrow**: tangent at `arcEndAngle`: CW → `(-sin θ, cos θ)`, CCW → `(sin θ, -cos θ)`

### Loop group indicator (drawn before nodes, ~line 2324)
Currently renders: lock badge (🔒) only.  
**Removed**: blue fill, dashed ring — do not re-add these.

---

## Icon picker
Right-click context menu → "Choose icon" → `ctxOpenIconPicker()`  
Icons defined in `PUDDL_ICONS` array (~line 5920) — 30 Feather-style SVG icons.  
`applyNodeIcon(icon)` generates SVG data URL with `stroke="rgba(255,255,255,0.92)"` on transparent bg, sets as `n.nodeImg`.  
Grid is built once (`_iconGridBuilt` flag) and cached in `#icon-picker-grid`.

---

## Persistence
### Undo/redo
- `saveState()` → pushes `snap()` JSON onto `history[]`
- `restoreSnap(s)` → restores from JSON; re-links edge source/target objects, reloads node images, calls `buildSim()` + `draw()`
- `snap()` serialises: `nodes`, `edges`, `loops`, `loopConnectionStyle`, `projectName`, `bgImageData`

### File save/load
- `exportJSON()` / `importJSON()` — download/upload `.puddl` JSON file
- `exportPNGSnapshot()` — renders canvas to PNG download

---

## Settings panel
Opened via the sliders button in the toolbar.  
Contains: connection style presets, loop connector style (5 presets + colour/width/dash/arrow/double controls with live preview), background image upload, export/import buttons.

---

## UI patterns
- **Status messages**: `showStatus(text)` — appears in toolbar
- **Mode switching**: `setMode(m)` — cleans up previous mode state
- **Dark/light theme**: `document.documentElement.setAttribute('data-theme','dark')`  
  `_dark` local variable in `draw()` = `getAttribute('data-theme')==='dark'`
- **Startup modal**: `#who-modal-bg` → `confirmWho()` dismisses it and sets `projectName`
- **CSS variables**: `--surf`, `--surf-2`, `--surf-3`, `--ink`, `--ink-2`, `--bdr`, `--bdr-m`, `--radius`, `--radius-lg`, `--shadow-lg`, `--shadow-xl`, `--acc` (accent blue)

---

## Context menu (`#node-ctx-menu`, ~line 864)
Right-click on node → shows:
- Reposition (only if node is pinned and not centre)
- Upload image
- Choose icon
- Remove image (only if node has `nodeImg`)

`ctxMenuNodeId` tracks which node was right-clicked.  
`_ctxClientX`, `_ctxClientY` track the click position (used to position icon picker).

---

## Conventions to follow
- **Never read the full file** — grep for line numbers, then targeted reads
- **All canvas measurements divided by `zoom`** for screen-constant sizes
- Match existing UI style: `var(--surf)`, `var(--bdr)`, `DM Sans`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-xl)`
- Use `ctx.save()` / `ctx.restore()` around every drawing block that changes state
- Call `saveState(); markUnsaved();` after any user-driven data change
- Call `draw()` to refresh the canvas
- Add `buildSim()` after structural changes that affect the force simulation
- Prefer minimal edits — grep → targeted read → Edit tool (never rewrite the file)
