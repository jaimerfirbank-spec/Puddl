(function () {
  function importImageMap() {
    const params = new URLSearchParams(location.search);
    if (params.get('imageImport') !== '1') return;

    let payload;
    try { payload = JSON.parse(sessionStorage.getItem('puddl_image_import') || 'null'); }
    catch (_) { payload = null; }
    if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) return;

    try {
      nodes.length = 0;
      edges.length = 0;
      if (Array.isArray(loops)) loops.length = 0;
      idCtr = 0;

      const worldLeft = -panX / zoom;
      const worldTop = -panY / zoom;
      const worldWidth = W / zoom;
      const worldHeight = H / zoom;
      const idMap = new Map();

      payload.nodes.forEach(function (source) {
        const id = ++idCtr;
        idMap.set(source.id, id);
        const centreX = (Number(source.x || 0) + Number(source.width || 80) / 2) / 1000;
        const centreY = (Number(source.y || 0) + Number(source.height || 80) / 2) / 1000;
        const node = {
          id: id,
          x: worldLeft + worldWidth * (0.1 + centreX * 0.8),
          y: worldTop + worldHeight * (0.1 + centreY * 0.8),
          fx: null,
          fy: null,
          vx: 0,
          vy: 0,
          pinned: true,
          label: String(source.label || 'Unnamed node'),
          colour: '#A8D8EA',
          shape: source.shape === 'rectangle' ? 'rectangle' : 'circle',
          nodeSize: Number(source.width || 0) > 170 ? 'large' : 'medium',
          titleSize: 'medium',
          notes: source.notes || '',
          videoUrl: '',
          customFields: {},
          tags: [],
          history: [{ ts: Date.now(), text: 'Imported from a hand-drawn photo' }],
          date: new Date().toISOString().slice(0, 10),
          type: 'process',
          lastUpdated: Date.now()
        };
        node.fx = node.x;
        node.fy = node.y;
        nodes.push(node);
      });

      payload.edges.forEach(function (source) {
        let from = idMap.get(source.source);
        let to = idMap.get(source.target);
        if (from == null || to == null || from === to) return;
        let arrow = 'forward';
        let twoWay = false;
        if (source.direction === 'target_to_source') { const swap = from; from = to; to = swap; }
        if (source.direction === 'both') { arrow = 'both'; twoWay = true; }
        if (source.direction === 'unclear') arrow = 'none';
        const style = CONNECTION_STYLES.find(function (item) { return item.id === 'moderate'; });
        edges.push({
          source: from,
          target: to,
          strength: 'moderate',
          colour: style ? style.colour : '#888888',
          arrow: arrow,
          twoWay: twoWay,
          note: source.notes || '',
          date: ''
        });
      });

      mapTitle = payload.title || 'Photo map';
      const title = document.getElementById('header-project-name');
      if (title) title.textContent = mapTitle;
      sessionStorage.removeItem('puddl_image_import');
      history.length = 0;
      histIdx = -1;
      saveState();
      markUnsaved();
      buildSim();
      draw();
      showStatus('Photo map created. Check it, then add connection strengths.');
      window.history.replaceState({}, '', location.pathname);
    } catch (error) {
      console.error('Could not create map from photo', error);
      if (typeof showStatus === 'function') showStatus('The photo was read, but the map could not be created.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', importImageMap);
  else setTimeout(importImageMap, 0);
})();
