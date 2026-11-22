/* Browser-owned installation: show a button only when Chrome offers a real prompt. */
(function(){
 'use strict';
 const button=document.getElementById('install-lens'),message=document.getElementById('install-status'),help=document.getElementById('install-help');
 const mode=window.matchMedia('(display-mode: standalone)');let pending=null;
 function installed(){return mode.matches||window.navigator.standalone===true;}
 function refresh(){button.hidden=installed()||!pending;help.hidden=installed();message.textContent=installed()?'Lens is running in its own app window.':'';}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;refresh();});
 button.addEventListener('click',async()=>{
  if(!pending||installed())return;const event=pending;pending=null;button.disabled=true;
  try{await event.prompt();const choice=await event.userChoice;message.textContent=choice.outcome==='accepted'?'Finish installation, then open Puddle Lens from your app icon.':'Installation cancelled. You can still use Lens in Chrome.';}
  catch{message.textContent='Open Chrome’s ⋮ menu and choose Add to Home screen, then Install if offered.';}
  finally{button.disabled=false;button.hidden=true;}
 });
 window.addEventListener('appinstalled',()=>{pending=null;button.hidden=true;message.textContent='Puddle Lens installed. Open it from your app icon.';});
 mode.addEventListener('change',refresh);refresh();
})();
