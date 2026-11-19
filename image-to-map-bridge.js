(function () {
  let importing=false;
  function photoLayoutScale(nodes,viewportScale){
    // Scale positions together, so the drawing's proportions survive while
    // standard Puddle node sizes and below-node labels have room to render.
    const boxes=nodes.map(node=>{
      const r=node.nodeSize==='large'?60:40;
      const width=Math.max(node.shape==='rectangle'?r*2.9:r*2,Math.min(String(node.label).length*8,r*3.5));
      return {width:width+16,height:(node.shape==='rectangle'?r*1.7:r*2)+32};
    });
    let scale=viewportScale;
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const dx=Math.abs(nodes[i].x-nodes[j].x),dy=Math.abs(nodes[i].y-nodes[j].y);
      if(dx<1e-8&&dy<1e-8) continue;
      const xScale=dx>1e-8?((boxes[i].width+boxes[j].width)/2+24)/dx:Infinity;
      const yScale=dy>1e-8?((boxes[i].height+boxes[j].height)/2+24)/dy:Infinity;
      scale=Math.max(scale,Math.min(xScale,yScale));
    }
    return scale;
  }
  async function importImageMap() {
    if(importing||document.readyState!=='complete'||!_authUser||!_cloudAuthInitialized) return;
    const params=new URLSearchParams(location.search);
    if(params.get('imageImport')!=='1') return;
    importing=true;
    try {
      const payload=JSON.parse(sessionStorage.getItem('puddl_image_import')||'null');
      if(!payload||!Array.isArray(payload.nodes)||!payload.nodes.length||!Array.isArray(payload.edges)) throw Error('The photo reading is missing. Return to the photo review page.');
      const ids=new Map();
      const iw=Number(payload.imageWidth)||1000,ih=Number(payload.imageHeight)||1000;
      if(!Number.isFinite(iw)||!Number.isFinite(ih)||iw<=0||ih<=0) throw Error('Invalid photo dimensions.');
      const viewportScale=Math.min(W/zoom/iw,H/zoom/ih)*0.8;
      const cx=(W/2-panX)/zoom,cy=(H/2-panY)/zoom;
      const draftNodes=payload.nodes.map((source,index)=>{
        if(!source||typeof source.id!=='string'||ids.has(source.id)) throw Error('The reading contains duplicate or invalid nodes.');
        for(const k of ['x','y','width','height']) if(!Number.isFinite(source[k])||source[k]<0||source[k]>1000) throw Error('The reading contains invalid positions.');
        const id=index+1;ids.set(source.id,id);
        const x=((source.x+source.width/2)/1000-0.5)*iw;
        const y=((source.y+source.height/2)/1000-0.5)*ih;
        return {id,x,y,pinned:true,label:String(source.label||'Unnamed node'),colour:'#A8D8EA',shape:source.shape==='rectangle'?'rectangle':'circle',nodeSize:source.nodeSize==='large'||source.width>170?'large':'medium',titleSize:'medium',notes:String(source.notes||''),videoUrl:'',customFields:{},tags:source.groupTitle?[String(source.groupTitle)]:[],history:[{ts:Date.now(),text:'Imported from a hand-drawn photo'}],date:new Date().toISOString().slice(0,10),type:'process',lastUpdated:Date.now()};
      });
      const scale=photoLayoutScale(draftNodes,viewportScale);
      draftNodes.forEach(node=>{node.x=cx+node.x*scale;node.y=cy+node.y*scale;});
      const draftEdges=payload.edges.map(source=>{
        let from=ids.get(source.source),to=ids.get(source.target);
        if(from==null||to==null||!['source_to_target','target_to_source','both','unclear'].includes(source.direction)) throw Error('Check the connection endpoints and directions before creating the map.');
        if(source.direction==='target_to_source') [from,to]=[to,from];
        const style=CONNECTION_STYLES.find(item=>item.id==='moderate');
        return {from,to,strength:'moderate',colour:style?style.colour:'#888888',arrow:source.direction==='both'?'both':source.direction==='unclear'?'none':'forward',twoWay:source.direction==='both',note:String(source.notes||''),date:''};
      });
      const draft={nodes:draftNodes,edges:draftEdges,mapTitle:String(payload.title||'Photo map'),mapType:'general',currentMapMode:'team'};
      validateMapSnapshot(draft);
      if(!await saveBeforeMapChange()) return;
      _executeReset();
      restoreSnap(JSON.stringify(draft));
      const title=document.getElementById('header-project-name');
      if(title) title.textContent=mapTitle;
      document.getElementById('who-modal-bg').style.display='none';
      saveState();markUnsaved();fitAll();
      sessionStorage.removeItem('puddl_image_import');
      showStatus('New photo map created. Check arrow directions, then set connection strengths.');
      params.delete('imageImport');
      window.history.replaceState({},'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);
    } catch(error) {
      showStatus(error.message||'The photo map could not be created. Your browser recovery copies are available in Your maps.');
    } finally { importing=false; }
  }
  window.addEventListener('load',importImageMap);
  window.addEventListener('puddl-auth-ready',importImageMap);
  if(document.readyState==='complete') importImageMap();
})();
