(function(){
'use strict';
if(window.__mxRejectedHistoryV171)return;
window.__mxRejectedHistoryV171=true;
var MAINT='El sistema se encuentra en mantenimiento. En cuanto se restablezca, se conectará automáticamente.';
var cache=[],busy=false,timer=0;
function txt(v){return String(v==null?'':v).trim()}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cfg(){try{return window.mxViewerGetCfg?window.mxViewerGetCfg():{}}catch(e){return{}}}
function branch(){var c=cfg();return txt(c.branch||c.unitId||'HGAM').toUpperCase()||'HGAM'}
function key(v){try{return txt(window.mxUnifiedActivation&&window.mxUnifiedActivation.keyOf?window.mxUnifiedActivation.keyOf(v):v).replace(/[.#$\[\]\/]/g,'_')}catch(e){return txt(v).replace(/[.#$\[\]\/]/g,'_')}}
function apps(r){try{return window.mxUnifiedActivation&&window.mxUnifiedActivation.applications?window.mxUnifiedActivation.applications(r):(r&&r.applications&&typeof r.applications==='object'?r.applications:{})}catch(e){return r&&r.applications&&typeof r.applications==='object'?r.applications:{}}}
function code(v){try{return txt(window.mxUnifiedActivation&&window.mxUnifiedActivation.code?window.mxUnifiedActivation.code(v):v).toUpperCase()}catch(e){return txt(v).toUpperCase()}}
function label(v){try{return txt(window.mxUnifiedActivation&&window.mxUnifiedActivation.label?window.mxUnifiedActivation.label(v):v)||'Visor'}catch(e){return txt(v)||'Visor'}}
function maintenance(a){var s=txt(a&&a.status).toUpperCase();return !!a&&(a.maintenanceMode===true||/MAINTENANCE|MANTENIMIENTO|SERVICE_PAUSE/.test(s))}
function active(a){var s=txt(a&&a.status).toUpperCase();return !!a&&!maintenance(a)&&(a.active===true||/ACTIVE|ACTIVA|ACTIVO|VIGENTE/.test(s))}
function pending(a){var s=txt(a&&a.status).toUpperCase();return !!a&&!maintenance(a)&&!active(a)&&!/SUSPEND|REVOK|CANCEL|INACTIV|DESACTIV|VENC|EXPIR/.test(s)}
function fmt(v){var d=new Date(v||'');return isNaN(d.getTime())?'—':d.toLocaleString('es-MX')}
function get(path){if(typeof window.mxViewerFetchJson!=='function')return Promise.reject(new Error('Conexión no lista'));return window.mxViewerFetchJson(path)}
function put(path,data){if(typeof window.mxViewerPutJson!=='function')return Promise.reject(new Error('Conexión no lista'));return window.mxViewerPutJson(path,data)}
function rest(path){if(typeof window.mxViewerRestUrl!=='function')return'';return window.mxViewerRestUrl(path,false)}
async function patch(path,data){var u=rest(path);if(!u)throw new Error('Conexión no lista');var r=await fetch(u,{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});if(!r.ok)throw new Error('Firebase HTTP '+r.status);return r.json().catch(function(){return null})}
function style(){
 if(document.getElementById('mxRejectedHistoryStyleV171'))return;
 var st=document.createElement('style');st.id='mxRejectedHistoryStyleV171';
 st.textContent='.mx-vrej-panel{margin-top:14px;border:1px solid #fecaca;border-radius:13px;background:#fff;overflow:hidden}.mx-vrej-panel>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;background:#fff7f7;color:#7f1d1d;font-size:11px;font-weight:950}.mx-vrej-panel>summary::-webkit-details-marker{display:none}.mx-vrej-count{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;padding:0 7px;border-radius:999px;background:#b91c1c;color:#fff;font-size:10px}.mx-vrej-help{margin-left:auto;color:#64748b;font-size:9px}.mx-vrej-wrap{padding:9px}.mx-vrej-table table{min-width:1040px}.mx-vrej-table th{font-size:9px}.mx-vrej-table td{font-size:10px;vertical-align:top}.mx-vrej-state{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:950;white-space:nowrap}.mx-vrej-state.rejected{background:#fee2e2;color:#991b1b}.mx-vrej-state.rerequest{background:#fff7ed;color:#9a3412}.mx-vrej-state.authorized{background:#dcfce7;color:#166534}.mx-vrej-new{display:block;margin-top:3px;color:#9a3412;font-weight:900;font-size:9px}.mx-vrej-actions{display:flex;gap:5px;flex-wrap:wrap;min-width:195px}.mx-vrej-actions .ok{background:#166534!important;color:#fff!important}.mx-vrej-actions .danger{background:#b91c1c!important;color:#fff!important}';
 document.head.appendChild(st);
}
function panel(){
 style();
 var old=document.getElementById('mxViewerRejectedHistoryV171');if(old)return old;
 var host=document.querySelector('#viewerAuthView .mx-vauth-card');if(!host)return null;
 var box=document.createElement('details');box.id='mxViewerRejectedHistoryV171';box.className='mx-vrej-panel';box.open=true;
 box.innerHTML='<summary>🗂 Historial de rechazados <span class="mx-vrej-count" id="mxViewerRejectedCountV171">0</span><span class="mx-vrej-help">Si el usuario vuelve a solicitar, aparecerá aquí para decidir nuevamente.</span></summary><div class="mx-vrej-wrap"><div class="table-wrap mx-vrej-table"><table><thead><tr><th>Solicitante</th><th>Visor</th><th>Dispositivo</th><th>Rechazado</th><th>Nueva solicitud</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="mxViewerRejectedBodyV171"><tr><td colspan="7" class="mx-vauth-empty">Sin solicitudes rechazadas.</td></tr></tbody></table></div></div>';
 host.appendChild(box);
 box.addEventListener('click',historyClick);
 return box;
}
function collect(raw){
 var out=[];if(!raw||typeof raw!=='object')return out;
 Object.keys(raw).forEach(function(recordKey){
  var rec=raw[recordKey];if(!rec||typeof rec!=='object')return;
  var all=apps(rec), hist=rec.rejectedActivationHistory&&typeof rec.rejectedActivationHistory==='object'?rec.rejectedActivationHistory:{}, covered={};
  Object.keys(hist).forEach(function(hid){
   var h=hist[hid];if(!h||typeof h!=='object')return;
   var c=code(h.appCode||h.appName),a=all[c]||{},rej=txt(h.rejectedAt||h.maintenanceAt||a.maintenanceAt),rm=Date.parse(rej||0)||0;
   var rr=txt(h.reRequestAt||a.reRequestAt),lr=txt(a.lastRequestAt),up=txt(a.updatedAt);
   if(!rr&&lr&&(Date.parse(lr)||0)>rm&&(pending(a)||a.manualReviewRequested===true||txt(a.requestType)==='re_request_after_rejection'))rr=lr;
   if(!rr&&maintenance(a)&&up&&(Date.parse(up)||0)>rm+500)rr=up;
   var ap=txt(h.authorizedAfterRejectionAt||((active(a)&&(Date.parse(a.approvedAt||0)||0)>rm)?a.approvedAt:''));
   out.push({recordKey:recordKey,historyId:hid,rec:rec,app:a,appCode:c,appName:label(h.appName||c),rejectedAt:rej,rejectedBy:txt(h.rejectedBy||h.maintenanceBy),reRequestAt:rr,approvedAt:ap,state:ap?'authorized':(rr&&(Date.parse(rr)||0)>rm?'rerequest':'rejected'),sort:Math.max(rm,Date.parse(rr||0)||0,Date.parse(ap||0)||0)});
   covered[c]=true;
  });
  Object.keys(all).forEach(function(k){
   var a=all[k],c=code(a&&a.appCode||k);if(!c||covered[c]||(!maintenance(a)&&!txt(a&&a.maintenanceAt)))return;
   var rej=txt(a.maintenanceAt||a.lastRejectedAt||rec.maintenanceAt);if(!rej)return;
   var rm=Date.parse(rej||0)||0,lr=txt(a.lastRequestAt),up=txt(a.updatedAt),rr=txt(a.reRequestAt);
   if(!rr&&lr&&(Date.parse(lr)||0)>rm&&(pending(a)||a.manualReviewRequested===true||txt(a.requestType)==='re_request_after_rejection'))rr=lr;
   if(!rr&&maintenance(a)&&up&&(Date.parse(up)||0)>rm+500)rr=up;
   var ap=active(a)&&(Date.parse(a.approvedAt||0)||0)>rm?txt(a.approvedAt):'';
   out.push({recordKey:recordKey,historyId:'',rec:rec,app:a,appCode:c,appName:label(c),rejectedAt:rej,rejectedBy:txt(a.maintenanceBy||a.lastRejectedBy||'Control Central'),reRequestAt:rr,approvedAt:ap,state:ap?'authorized':(rr&&(Date.parse(rr)||0)>rm?'rerequest':'rejected'),sort:Math.max(rm,Date.parse(rr||0)||0,Date.parse(ap||0)||0),legacy:true});
  });
 });
 out.sort(function(a,b){return b.sort-a.sort});return out;
}
function render(){
 panel();var tb=document.getElementById('mxViewerRejectedBodyV171'),ct=document.getElementById('mxViewerRejectedCountV171');if(!tb)return;
 var q=txt(document.getElementById('mxViewerAuthSearchV167')&&document.getElementById('mxViewerAuthSearchV167').value).toLowerCase();
 var rows=cache.filter(function(x){var r=x.rec||{};return !q||[r.fullName,r.name,r.nombre,r.phone,r.telefono,r.email,r.correo,r.deviceId,x.recordKey,x.appName,x.appCode].some(function(v){return txt(v).toLowerCase().indexOf(q)>=0})});
 if(ct)ct.textContent=String(cache.length);
 if(!rows.length){tb.innerHTML='<tr><td colspan="7" class="mx-vauth-empty">'+(cache.length?'No hay rechazados que coincidan con la búsqueda.':'Sin solicitudes rechazadas.')+'</td></tr>';return}
 tb.innerHTML=rows.map(function(x){
  var r=x.rec||{},who=txt(r.fullName||r.name||r.nombre||'Sin nombre'),phone=txt(r.phone||r.telefono||'—'),mail=txt(r.email||r.correo||'—'),dev=txt(r.deviceId||x.recordKey);
  var state=x.state==='authorized'?'AUTORIZADO DESPUÉS':x.state==='rerequest'?'VOLVIÓ A SOLICITAR':'RECHAZADO',cls=x.state==='authorized'?'authorized':x.state==='rerequest'?'rerequest':'rejected';
  var act=x.state==='rerequest'?'<button class="btn ok" data-vrej-grant>✅ Autorizar ahora</button><button class="btn danger" data-vrej-keep>✖ Mantener rechazo</button>':'<small style="color:#64748b">Sin nueva solicitud</small>';
  return '<tr data-vrej-key="'+esc(x.recordKey)+'" data-vrej-app="'+esc(x.appCode)+'" data-vrej-history="'+esc(x.historyId||'')+'"><td class="mx-vauth-person"><b>'+esc(who)+'</b><small>'+esc(phone)+'</small><small>'+esc(mail)+'</small></td><td class="mx-vauth-app"><b>'+esc(x.appName)+'</b><small>'+esc(x.app&&x.app.version||r.version||'')+'</small></td><td class="mx-vauth-device"><code>'+esc(dev)+'</code><small>'+esc(r.platform||'')+'</small></td><td><b>'+esc(fmt(x.rejectedAt))+'</b><small style="display:block;color:#64748b">'+esc(x.rejectedBy||'Control Central')+'</small></td><td>'+(x.reRequestAt?'<b>'+esc(fmt(x.reRequestAt))+'</b><span class="mx-vrej-new">Nueva solicitud recibida</span>':'—')+'</td><td><span class="mx-vrej-state '+cls+'">'+state+'</span>'+(x.approvedAt?'<small style="display:block;margin-top:3px;color:#166534">'+esc(fmt(x.approvedAt))+'</small>':'')+'</td><td><div class="mx-vrej-actions">'+act+'</div></td></tr>';
 }).join('');
}
async function refresh(){
 if(busy)return;busy=true;
 try{var raw=await get('/viewer_licenses/'+encodeURIComponent(branch()));cache=collect(raw);render()}catch(e){}finally{busy=false}
}
async function saveRejectedSnapshot(recordKey,c){
 var br=branch(),path='/viewer_licenses/'+encodeURIComponent(br)+'/'+encodeURIComponent(recordKey),before=await get(path).catch(function(){return null});
 if(!before)return;
 setTimeout(async function(){
  try{
   var rec=await get(path),a=apps(rec)[c];if(!rec||!a||!maintenance(a))return;
   var rej=txt(a.maintenanceAt||rec.maintenanceAt||new Date().toISOString()),hist=rec.rejectedActivationHistory&&typeof rec.rejectedActivationHistory==='object'?rec.rejectedActivationHistory:{};
   var exists=Object.keys(hist).some(function(hid){var h=hist[hid];return code(h&&h.appCode||h&&h.appName)===c&&txt(h&&h.rejectedAt)===rej});
   if(!exists){
    var hid='RJ_'+Date.now().toString(36).toUpperCase()+'_'+key(recordKey).slice(-10)+'_'+key(c).slice(0,16),h={historyId:hid,recordKey:recordKey,appCode:c,appName:label(c),fullName:txt(rec.fullName||rec.name||rec.nombre),phone:txt(rec.phone||rec.telefono),email:txt(rec.email||rec.correo),deviceId:txt(rec.deviceId||recordKey),platform:txt(rec.platform),requestAt:txt(a.requestedAt||before.lastRequestAt||before.requestedAt),rejectedAt:rej,rejectedBy:txt(a.maintenanceBy||'Control Central'),status:'rejected',source:'CONTROL_CENTRAL'};
    await put(path+'/rejectedActivationHistory/'+encodeURIComponent(hid),h);
    await patch(path+'/applications/'+encodeURIComponent(c),{lastRejectedHistoryId:hid,lastRejectedAt:rej,lastRejectedBy:h.rejectedBy});
   }
   await refresh();
  }catch(e){}
 },700);
}
async function markHistory(recordKey,c,hid,patchData){
 if(!hid)return;
 var p='/viewer_licenses/'+encodeURIComponent(branch())+'/'+encodeURIComponent(recordKey)+'/rejectedActivationHistory/'+encodeURIComponent(hid);
 await patch(p,patchData).catch(function(){});
}
async function authorizeAgain(recordKey,c,hid){
 var br=branch(),path='/viewer_licenses/'+encodeURIComponent(br)+'/'+encodeURIComponent(recordKey),rec=await get(path),a=apps(rec)[c];
 if(!rec||!a)throw new Error('Solicitud no encontrada.');
 var rm=Date.parse(a.maintenanceAt||0)||0,rr=txt(a.reRequestAt||a.lastRequestAt||a.updatedAt),rms=Date.parse(rr||0)||0;
 if(!pending(a)&&!(maintenance(a)&&rms>rm+500))throw new Error('No hay una nueva solicitud para revisar.');
 if(maintenance(a)){
  var all=apps(rec),now=new Date().toISOString();all[c]=Object.assign({},a,{status:'pending',active:false,maintenanceMode:false,maintenanceMessage:'',manualValidationRequired:true,autoLinkBlocked:true,manualReviewRequested:true,lastRequestAt:rr||now,updatedAt:now});
  var next=Object.assign({},rec,{applications:all,status:rec.active===true?'active':'pending',maintenanceMode:false,maintenanceMessage:'',pendingAppCode:c,pendingAppName:label(c),manualValidationRequired:true,lastRequestAt:rr||now,updatedAt:now});
  await put(path,next);
 }
 await markHistory(recordKey,c,hid,{status:'re_requested_pending_review',reRequestAt:rr||new Date().toISOString(),updatedAt:new Date().toISOString()});
 if(typeof window.mxControlCentralViewerAuthResume==='function')await window.mxControlCentralViewerAuthResume();
 await new Promise(function(resolve){setTimeout(resolve,180)});
 var rows=document.querySelectorAll('#mxViewerAuthBodyV167 tr[data-mx-vauth-key]');
 for(var i=0;i<rows.length;i++){if(rows[i].dataset.mxVauthKey===recordKey&&rows[i].dataset.mxVauthApp===c){var b=rows[i].querySelector('[data-mx-vauth-grant]');if(b){b.click();setTimeout(refresh,900);return}}}
 throw new Error('La solicitud pasó a pendientes. Pulsa Actualizar y autorízala desde la tabla superior.');
}
async function keepRejected(recordKey,c,hid){
 var br=branch(),path='/viewer_licenses/'+encodeURIComponent(br)+'/'+encodeURIComponent(recordKey),rec=await get(path),a=apps(rec)[c];
 if(!rec||!a)throw new Error('Solicitud no encontrada.');
 var now=new Date().toISOString(),all=apps(rec),nh='RJ_'+Date.now().toString(36).toUpperCase()+'_'+key(recordKey).slice(-10)+'_'+key(c).slice(0,16);
 all[c]=Object.assign({},a,{status:'maintenance',active:false,maintenanceMode:true,maintenanceMessage:MAINT,maintenanceAt:now,maintenanceBy:'Control Central',lastRejectedAt:now,lastRejectedBy:'Control Central',lastRejectedHistoryId:nh,reRequestAt:'',manualReviewRequested:false,autoLinkBlocked:true,updatedAt:now});
 var any=Object.keys(all).some(function(k){return active(all[k])}),next=Object.assign({},rec,{applications:all,status:any?'active':'maintenance',active:any,maintenanceMode:!any,maintenanceMessage:!any?MAINT:'',maintenanceAt:!any?now:'',pendingAppCode:'',pendingAppName:'',updatedAt:now}),h={historyId:nh,recordKey:recordKey,appCode:c,appName:label(c),fullName:txt(rec.fullName||rec.name||rec.nombre),phone:txt(rec.phone||rec.telefono),email:txt(rec.email||rec.correo),deviceId:txt(rec.deviceId||recordKey),platform:txt(rec.platform),requestAt:txt(a.lastRequestAt||a.reRequestAt),rejectedAt:now,rejectedBy:'Control Central',status:'rejected',repeatRejection:true,source:'CONTROL_CENTRAL'};
 next.rejectedActivationHistory=Object.assign({},rec.rejectedActivationHistory||{});next.rejectedActivationHistory[nh]=h;
 await put(path,next);await markHistory(recordKey,c,hid,{status:'rejected_again',reviewedAt:now,updatedAt:now});await refresh();
}
async function historyClick(e){
 var g=e.target.closest&&e.target.closest('[data-vrej-grant]'),k=e.target.closest&&e.target.closest('[data-vrej-keep]'),b=g||k;if(!b)return;
 var tr=b.closest('tr[data-vrej-key]');if(!tr)return;var rk=tr.dataset.vrejKey,c=tr.dataset.vrejApp,hid=tr.dataset.vrejHistory;
 if(k&&!confirm('¿Mantener rechazada esta nueva solicitud?\\n\\nEl usuario seguirá viendo el mensaje de mantenimiento.'))return;
 tr.querySelectorAll('button').forEach(function(x){x.disabled=true});
 try{if(g)await authorizeAgain(rk,c,hid);else await keepRejected(rk,c,hid)}catch(err){alert(err&&err.message||String(err))}finally{tr.querySelectorAll('button').forEach(function(x){x.disabled=false})}
}
document.addEventListener('click',function(e){
 var b=e.target.closest&&e.target.closest('[data-mx-vauth-reject]');if(!b)return;
 var tr=b.closest('tr[data-mx-vauth-key]');if(!tr)return;
 saveRejectedSnapshot(tr.dataset.mxVauthKey,tr.dataset.mxVauthApp).catch(function(){});
},true);
document.addEventListener('input',function(e){if(e.target&&e.target.id==='mxViewerAuthSearchV167')render()},true);
window.addEventListener('mx-viewer-config-changed',function(){cache=[];setTimeout(refresh,300)});
window.addEventListener('mx-operational-sync',function(e){if(e&&e.detail&&e.detail.changed&&e.detail.changed.indexOf('activations')>=0)setTimeout(refresh,100)});
function boot(){panel();refresh();timer=setInterval(function(){if(!document.hidden)refresh()},6000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();