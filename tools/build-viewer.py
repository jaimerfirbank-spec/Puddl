#!/usr/bin/env python3
"""
Generate viewer.html from index.html.

The viewer is the page people are sent when a map is shared. It must draw a map
exactly as Puddl does, and must not contain the editor: the old share file was
the whole 742 KB app with a CSS class applied, so anyone who opened it had a
working copy of the product.

Rather than keep a second renderer in step by hand, this walks the call graph
out from the viewer's entry points and emits only what is reachable. Editing,
importing, exporting, saving, the account and the cloud are unreachable from
those entry points, so none of it is emitted. Re-run after changing index.html.

    python3 tools/build-viewer.py
"""
import io, re, os, sys

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC    = os.path.join(ROOT, 'index.html')
OUT    = os.path.join(ROOT, 'viewer.html')

# What a viewer may do. Everything these reach is kept; everything else is cut.
ENTRIES = [
    'draw', 'restoreSnap', 'nodeAt', 'fitAll', 'zoomBy', 'zoomReset',
    'enterPresentationMode', 'exitPresentationMode', 'presGoToStop', 'presPlayStart',
    'showHoverPanel', 'renderHoverPanel', 'toggleHoverDock',
    'renderInsights', 'computeInsights', 'toggleInsights', 'toggleSec',
    'setTheme', 'restoreNodeImages', 'loadNodeImage',
    'applyFilters', 'rebuildCatFilter', 'updateColourLegend', 'buildSim',
    'resize', 'screenToWorld', 'syncLabelsBtn',
    # Ways of looking, all read-only
    'toggleSearchPanel', 'toggleNodeLabels', 'toggleFullscreen',
    'toggleHoverPanelEnabled', 'presTimelineSeek', 'timelinePlay',
    'toggleLegend', 'updateTimelineUI', 'setAsAt',
]

# Saving, undo and logging. A viewer never writes anything, but the drawing and
# filtering code calls these constantly, so they are emitted as no-ops and never
# traversed - otherwise the walk drags in autosave, which drags in the cloud.
STUBS = {
    'saveState': 'function saveState(){}',
    'markUnsaved': 'function markUnsaved(){}',
    'markSaved': 'function markSaved(){}',
    'autoSave': 'function autoSave(){}',
    'showAutoSaveToast': 'function showAutoSaveToast(){}',
    'addLog': 'function addLog(){}',
    'renderLog': 'function renderLog(){}',
    'showStatus': 'function showStatus(){}',
}

# Must never appear in the output. The whole point of the exercise.
FORBIDDEN = [
    'saveFile', 'saveShareFile', 'exportJSON', 'importJSON', 'exportPNGSnapshot',
    'cloudSaveCurrent', 'cloudOpenMap', 'cloudDeleteMap', 'openMyMaps', 'cloudInit',
    'openCustomizePanel', 'confirmWho', 'applyNodeIcon', 'loadDemo', '_executeReset',
    'handleNodeImageUpload', 'togglePresentationEditMode', 'signInWithPassword',
    'SUPABASE_ANON_KEY', 'SUPABASE_URL',
]


def read_source():
    s = io.open(SRC, encoding='utf-8').read()
    style = s[s.index('<style>') + len('<style>'): s.index('</style>')]
    js_start = s.index('<script>', s.index('xlsx.full.min.js'))
    js_start = s.index('>', js_start) + 1
    js = s[js_start: s.index('</script>', js_start)]
    return s, style, js


def canvas_markup(s):
    """The map surface: canvas, hover panel, search and insights, legend."""
    i = s.index('<div id="canvas-area">')
    depth, j = 0, i
    while True:
        a, b = s.find('<div', j), s.find('</div>', j)
        if b == -1:
            break
        if a != -1 and a < b:
            depth += 1; j = a + 4
        else:
            depth -= 1; j = b + 6
            if depth == 0:
                break
    return s[i:j]


DEF_RE = re.compile(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=')
ID_RE  = re.compile(r'[A-Za-z_$][\w$]*')


def split_defs(js):
    """Top-level definitions, each trimmed to its own body.

    Lines between one definition and the next include stray top-level
    statements - button wiring and init calls for parts of the app the viewer
    does not have. Trimming at the closing brace leaves those behind, which is
    what we want: they would only throw on elements that are not there.
    """
    lines = js.split('\n')
    marks = []
    for i, l in enumerate(lines):
        m = DEF_RE.match(l)
        if m:
            marks.append(((m.group(1) or m.group(2)), i, bool(m.group(1))))

    blocks = {}
    for k, (name, i, is_fn) in enumerate(marks):
        limit = marks[k + 1][1] if k + 1 < len(marks) else len(lines)
        if is_fn:
            end = limit
            for j in range(i, limit):
                if lines[j] == '}':
                    end = j + 1
                    break
        else:
            depth, end = 0, limit
            for j in range(i, limit):
                depth += lines[j].count('(') + lines[j].count('[') + lines[j].count('{')
                depth -= lines[j].count(')') + lines[j].count(']') + lines[j].count('}')
                if depth <= 0 and lines[j].rstrip().endswith(';'):
                    end = j + 1
                    break
        blocks.setdefault(name, []).append((i, end))
    return lines, blocks


def reachable(blocks, lines):
    names = set(blocks)
    refs = {}
    for name, spans in blocks.items():
        seen = set()
        for (i, j) in spans:
            for tok in ID_RE.findall('\n'.join(lines[i:j])):
                if tok in names and tok != name:
                    seen.add(tok)
        refs[name] = seen

    keep, stack = set(), list(ENTRIES)
    while stack:
        n = stack.pop()
        if n in keep or n not in names or n in STUBS:
            continue
        keep.add(n)
        stack.extend(refs.get(n, ()))
    return keep


# Anything the boot script wires up itself, so it must not be stripped.
BOOT_WIRED = {'viewer-explore', 'viewer-present', 'viewer-theme'}

ONCLICK_RE = re.compile(r'<(button|a)\b[^>]*\bonclick="([A-Za-z_$][\w$]*)\s*\(', re.I)


def strip_dead_controls(markup, keep):
    """Remove buttons whose handler was not emitted.

    The markup is lifted whole from the app, so it still offers edit mode, loop
    editing, the demo tour and so on. None of that code is in the viewer, so the
    buttons would sit there doing nothing. Driving this off what was actually
    emitted means it keeps itself right as the app changes, rather than needing
    a hand-written list.
    """
    live = set(keep) | set(STUBS) | BOOT_WIRED
    removed = []
    while True:
        m = ONCLICK_RE.search(markup)
        found = None
        for m in ONCLICK_RE.finditer(markup):
            if m.group(2) not in live:
                found = m
                break
        if not found:
            break
        tag = found.group(1)
        # Walk to this element's matching close tag.
        depth, j = 0, found.start()
        open_re = re.compile(r'<%s\b' % tag, re.I)
        close_re = re.compile(r'</%s>' % tag, re.I)
        while True:
            a = open_re.search(markup, j)
            b = close_re.search(markup, j)
            if not b:
                break
            if a and a.start() < b.start():
                depth += 1; j = a.end()
            else:
                depth -= 1; j = b.end()
                if depth == 0:
                    break
        removed.append(found.group(2))
        markup = markup[:found.start()] + markup[j:]

    # Whole panels that only exist for editing or for the signed-in demo.
    for el_id in ('demo-banner', 'loop-controls', 'loop-panel'):
        markup = re.sub(r'<div id="%s".*?</div>\s*' % el_id, '', markup, count=1, flags=re.S)

    # Editing the title in place is editing.
    markup = markup.replace(' onclick="editMapTitle()"', '')
    print('  dead controls cut: %d (%s)' % (len(removed), ', '.join(sorted(set(removed))[:6])))
    return markup


def main():
    s, style, js = read_source()
    lines, blocks = split_defs(js)
    keep = reachable(blocks, lines)

    spans = sorted((i, j) for n in keep for (i, j) in blocks.get(n, []))
    out, last = [], -1
    for (i, j) in spans:                       # source order, no overlaps
        if i < last:
            continue
        out.append('\n'.join(lines[i:j]))
        last = j
    body_js = '\n'.join(sorted(STUBS.values())) + '\n' + '\n'.join(out)

    leaked = [f for f in FORBIDDEN if re.search(r'\b%s\b' % re.escape(f), body_js)]
    if leaked:
        sys.exit('REFUSING TO WRITE: editor code reachable from the viewer: %s' % ', '.join(leaked))

    markup = canvas_markup(s)
    # The presentation editor is markup for building a presentation. Viewers watch.
    markup = re.sub(r'<div id="pres-edit-panel">.*?\n  </div>', '', markup, flags=re.S)
    markup = strip_dead_controls(markup, keep)

    html = VIEWER_SHELL.replace('/*__STYLE__*/', style) \
                       .replace('<!--__MARKUP__-->', markup) \
                       .replace('/*__APP__*/', body_js)
    io.open(OUT, 'w', encoding='utf-8').write(html)

    print('viewer.html written')
    print('  definitions kept : %d of %d' % (len(keep), len(blocks)))
    print('  js lines kept    : %d of %d' % (body_js.count('\n'), len(lines)))
    print('  size             : %.0f KB' % (len(html) / 1024.0))
    print('  editor code      : none')


VIEWER_SHELL = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Puddl map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/*__STYLE__*/

/* Viewer chrome */
#viewer-bar{position:fixed;top:0;left:0;right:0;height:46px;z-index:60;display:flex;
  align-items:center;gap:10px;padding:0 14px;background:var(--surf);
  border-bottom:1px solid var(--bdr);font-family:'DM Sans',sans-serif;}
#viewer-title{font-size:13px;font-weight:600;color:var(--ink);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
#viewer-bar button{height:28px;padding:0 12px;font-size:11px;font-weight:600;
  font-family:inherit;border:1px solid var(--bdr);border-radius:var(--radius);
  background:var(--surf);color:var(--ink);cursor:pointer;flex-shrink:0;}
#viewer-bar button.primary{background:var(--ink);color:var(--surf);border-color:var(--ink);}
#canvas-area{top:46px !important;}
#viewer-small{display:none;position:fixed;inset:0;z-index:100;background:var(--surf);
  align-items:center;justify-content:center;padding:24px;text-align:center;
  font-family:'DM Sans',sans-serif;}
@media (max-width:800px){
  #viewer-small{display:flex;}
  #viewer-bar,#canvas-area{display:none !important;}
}
</style>
</head>
<body>

<div id="viewer-small">
  <div style="max-width:360px;">
    <div style="font-size:40px;margin-bottom:16px;">🐑</div>
    <h1 style="font-size:20px;font-weight:600;color:var(--ink);margin:0 0 10px 0;">This map needs a bigger screen</h1>
    <p style="font-size:14px;line-height:1.5;color:var(--ink-m);margin:0;">Open it on a laptop or desktop.</p>
  </div>
</div>

<div id="viewer-bar">
  <div id="viewer-title">Puddl map</div>
  <button type="button" id="viewer-explore" class="primary">Explore the map</button>
  <button type="button" id="viewer-present" class="primary" style="display:none;">Back to presentation</button>
  <button type="button" id="viewer-theme" title="Light or dark">◐</button>
</div>

<!--__MARKUP__-->

<div id="puddl-viewer-data" style="display:none;"></div>
<!-- Same JSON again, under the name Puddl's own importer looks for, so a
     shared file can be opened back up in the app by someone who has one. -->
<div id="puddl-saved-state" style="display:none;"></div>
<div id="bg-image-data" style="display:none;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<script>
/*__APP__*/
</script>
<script>
// ── Boot ──────────────────────────────────────────────────────────────────
// Everything above is Puddl's own drawing code, lifted unchanged so a shared
// map looks exactly like the real thing. Nothing that edits, imports, exports
// or saves is in this file.
(function(){
  var raw='';
  try{ raw=(document.getElementById('puddl-viewer-data').textContent||'').trim(); }catch(e){}

  // A shared file carries the map inside it. A shared link points at one
  // instead, so the same page serves both.
  var src=null;
  try{ src=new URLSearchParams(window.location.search).get('src'); }catch(e){}
  if(!raw && src){
    fetch(src).then(function(r){ return r.text(); }).then(function(t){ boot(t); })
              .catch(function(){ document.getElementById('viewer-title').textContent='This map could not be loaded'; });
    return;
  }
  boot(raw);

  function boot(raw){
  if(!raw){ document.getElementById('viewer-title').textContent='No map in this file'; return; }

  try{ restoreSnap(raw); }
  catch(err){ document.getElementById('viewer-title').textContent='This map could not be read'; return; }

  try{ document.getElementById('viewer-title').textContent = (typeof mapTitle!=='undefined' && mapTitle) ? mapTitle : 'Puddl map'; }catch(e){}

  var hasPres = false;
  try{ hasPres = !!(presentationStops && presentationStops.length); }catch(e){}

  var explore = document.getElementById('viewer-explore');
  var present = document.getElementById('viewer-present');

  function toMap(){
    try{ exitPresentationMode(); }catch(e){}
    explore.style.display='none';
    present.style.display = hasPres ? '' : 'none';
    try{ fitAll(); }catch(e){}
  }
  function toPres(){
    present.style.display='none';
    explore.style.display='';
    try{ enterPresentationMode(); }catch(e){}
  }
  explore.onclick = toMap;
  present.onclick = toPres;

  // A shared map opens on the presentation when there is one, because that is
  // the point the sender was making. Explore steps out of it.
  if(hasPres){ setTimeout(toPres, 120); }
  else { explore.style.display='none'; try{ fitAll(); }catch(e){} }

  document.getElementById('viewer-theme').onclick=function(){
    var dark = document.documentElement.getAttribute('data-theme')==='dark';
    try{ setTheme(dark?'light':'dark'); }
    catch(e){ document.documentElement.setAttribute('data-theme', dark?'light':'dark'); }
    try{ draw(); }catch(_){}
  };
  }
})();
</script>
</body>
</html>
'''

if __name__ == '__main__':
    main()
