(function(){
 'use strict';
 const KEY='puddl_lens_reviews_v1',L=window.PuddleLens;
 function read(){try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
 function write(value){try{localStorage.setItem(KEY,JSON.stringify(value))}catch{throw Error('Could not save this approval in the browser. Free some browser storage and try again.')}}
 function validGraph(value){
  if(!value||value.version!==1||!Array.isArray(value.nodes)||!value.nodes.length||value.nodes.length>2000||!Array.isArray(value.edges)||value.edges.length>4000)return false;
  const ids=new Set();
  for(const node of value.nodes){if(!node||typeof node.id!=='string'||ids.has(node.id))return false;ids.add(node.id);for(const key of ['x','y','width','height'])if(!Number.isFinite(node[key])||node[key]<0||node[key]>1000)return false;}
  return value.edges.every(edge=>edge&&ids.has(edge.source)&&ids.has(edge.target)&&['source_to_target','target_to_source','both','unclear'].includes(edge.direction));
 }
 function forUser(userId){const value=read()[userId];return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
 function get(userId,name){const value=forUser(userId)[name];return validGraph(value)?value:null}
 function save(userId,name,title,data,imageWidth,imageHeight){
  if(!userId||!L.validFilename(name))throw Error('This Lens photo cannot be approved. Open it again from the inbox.');
  const value={version:1,title:String(title||L.titleFromFilename(name)||'Photo map').slice(0,80),approvedAt:new Date().toISOString(),imageWidth:Number(imageWidth)||1000,imageHeight:Number(imageHeight)||1000,nodes:data.nodes.map(node=>({...node,notes:String(node.notes||'')})),edges:data.edges.map(edge=>({...edge,notes:''}))};
  if(!validGraph(value))throw Error('Check every node and connection before approving this map.');
  const root=read();root[userId]={...forUser(userId),[name]:value};write(root);return value;
 }
 function remove(userId,name){const root=read(),user=root[userId];if(!user||!Object.hasOwn(user,name))return;delete user[name];if(Object.keys(user).length)root[userId]=user;else delete root[userId];write(root)}
 function combine(items,title='Combined Lens map'){
  const approved=items.filter(validGraph);if(!approved.length)throw Error('Select at least one approved photo.');const count=approved.length,nodes=[],edges=[];
  approved.forEach((item,index)=>{
   const ids=new Map(),group=String(item.title||('Group '+(index+1))).slice(0,80);
   item.nodes.forEach(node=>{const id='g'+index+'_'+node.id;ids.set(node.id,id);nodes.push({...node,id,x:(index*1000+node.x)/count,width:node.width/count,nodeSize:node.width>170?'large':'medium',groupTitle:group,notes:[String(node.notes||''),'Imported from '+group].filter(Boolean).join('\n')})});
   item.edges.forEach(edge=>edges.push({...edge,source:ids.get(edge.source),target:ids.get(edge.target),notes:''}));
  });
  return {version:1,title,nodes,edges,imageWidth:count*1000,imageHeight:1000,sourceGroups:approved.map(item=>item.title)};
 }
 window.PuddleLensReviews={get,save,remove,combine,validGraph};
})();
