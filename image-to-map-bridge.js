(function () {
  let importing=false;
  async function importImageMap() {
    if(importing||document.readyState!=='complete'||!_authUser) return;
    const params=new URLSearchParams(location.search);
    if(params.get('imageImport')!=='1') return;
    importing=true;
    try {
      const payload=JSON.parse(sessionStorage.getItem('puddl_image_import')||'null');
      if(!payload||!Array.isArray(payload.nodes)||!payload.nodes.length||!Array.isArray(payload.edges)) throw Error('The photo reading is missing. Return to the photo review page.');
      const ids=new Map();
      const iw=Number(payload.imageWidth)||1000,ih=Number(payload.imageHeight)||1000;
      if(!Number.isFinite(iw)||!Number.isFinite(ih)||iw<=0||ih<=0) throw Error('Invalid photo dimensions.');
      const scale=Math.min(W/zoom/iw,H/zoom/ih)*0.8;
      const cx=(W/2-panX)/zoom,cy=(H/2-panY)/zoom;
      const draftNodes=payload.nodes.map((source,index)=>{
        if(!source||typeof source.id!=='string'||ids.has(source.id)) throw Error('The reading contains duplicate or invalid nodes.');
        for(const k of ['x','y','width','height']) if(!Number.isFinite(source[k])||source[k]<0||source[k]>1000) throw Error('The reading contains invalid positions.');
        const id=index+1;ids.set(source.id,id);
        const x=cx+((source.x+source.width/2)/1000-0.5)*iw*scale;
        const y=cy+((source.y+source.height/2)/1000-0.5)*ih*scale;
        return {id,x,y,pinned:true,label:String(source.label||'Unnamed node'),colour:'#A8D8EA',shape:source.shape==='rectangle'?'rectangle':'circle',nodeSize:source.width>170?'large':'medium',titleSize:'medium',notes:String(source.notes||''),videoUrl:'',customFields:{},tags:[],history:[{ts:Date.now(),text:'Imported from a hand-drawn photo'}],date:new Date().toISOString().slice(0,10),type:'process',lastUpdated:Date.now()};
      });
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
