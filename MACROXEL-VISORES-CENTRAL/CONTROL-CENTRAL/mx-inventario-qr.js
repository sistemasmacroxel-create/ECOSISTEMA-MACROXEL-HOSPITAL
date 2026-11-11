/* Macroxel HPS Control Central — Conteo QR Almacen.
   Los conteos son borradores. Sin modificacion destructiva de existencias. */
(()=>{
'use strict';if(window.__mxInventarioQr)return;window.__mxInventarioQr=true;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=s=>String(s??'').trim().toUpperCase();
const qty=v=>Math.max(0,Math.floor(Number(v)||0));
const storage='mx-hps-conteo-qr-almacen-v1';
const pendingStorage='mx-hps-conteo-qr-almacen-pendientes-v319';
let stockVerified=false,warehouseSnapshotAt='',reviewSignature='',sending=false,finishing=false;
const sameCode=(a,b)=>{const norm=v=>key(v).replace(/[^A-Z0-9.]/g,'');const x=norm(a),y=norm(b);return x===y||x.endsWith('.'+y)||y.endsWith('.'+x)};
let root,scanner=null,scanning=false,processing=false,stock=[],unclassified=0,count=new Map(),last='',lastAt=0;
// Aislar exclusivamente las existencias de ALMACEN antes de proponer bajas.
function normalizePlace(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function warehouseQty(r){
 // Una ubicación física ESTANTE no invalida el campo separado ALMACEN;
 // 0 es un valor legítimo de almacén y no significa "registro inexistente".
 const explicit=r.almacen??r.almacén??r.alm??r.pzs_almacen??r.pzsAlmacen??r.existencia_almacen??r.existenciaAlmacen??r.stock_almacen??r.stockAlmacen??r.piezas_almacen??r.piezasAlmacen??r.almacenPzs;
 if(explicit!==undefined&&explicit!==null&&explicit!=='')return qty(explicit);
 const fields=[r.ubicacion,r.ubicación,r.area,r.zona,r.deposito,r.depósito,r.tipoUbicacion,r.tipo_ubicacion,r.localizacion].filter(v=>v!=null&&String(v).trim());
 const names=fields.map(normalizePlace);
 if(names.some(v=>/estante|anaquel|exhibicion|mostrador|vitrina/.test(v)))return null;
 if(names.some(v=>/almacen|bodega/.test(v)))return qty(r.existencia??r.piezas??r.cantidad??r.stock??r.disponible);
 return null;
}
function toRow(r){
 const existencia=warehouseQty(r);
 if(existencia===null)return null;
 return {inventoryId:String(r.inventoryId??r._id??r.id??''),clave:String(r.clave||r.codigo||''),lote:String(r.lote||r.lot||''),caducidad:String(r.caducidad||r.fecha_caducidad||r.cad||''),codigo_barras:String(r.codigo_barras||r.codigoBarras||''),existencia,estantes:qty(r.estantes??r.est??r.pzs_estantes??r.existencia_estantes),ubicacion:'ALMACEN',descripcion:String(r.descripcion||r.nombre||r.producto||''),unidad:String(r.unidad||r.presentacion||'')};
}
// Identificador compuesto: cada lote y caducidad se contabilizan por separado.
function ident(r){return JSON.stringify([key(r.clave),key(r.lote),key(r.caducidad)]);}
function flash(){
 const layer=$('mxInvQrFlash');if(!layer)return;
 layer.classList.remove('mx-inv-flash-on');
 void layer.offsetWidth;
 layer.classList.add('mx-inv-flash-on');
}
async function cancelInventory(){
 if(sending||finishing)return notify('Hay un envío en proceso, no puede cancelarse.');
 const p=getPending(),message=p&&!p.sent?'¿Cancelar y descartar también el conteo pendiente de envío? NO modifica Sistema Principal.':'¿Cancelar inventario QR y borrar todos los escaneos locales? NO modifica Sistema Principal.';
 if(!window.confirm(message))return;
 await stop();count.clear();stock=[];unclassified=0;stockVerified=false;last='';lastAt=0;processing=false;
 try{localStorage.removeItem(storage);localStorage.removeItem(pendingStorage)}catch(_){}
 $('mxInvQrCamera').textContent='📷 Activar cámara';closeFinal();table();
 notify('Inventario QR cancelado sin cambios en el Sistema Principal.');root.hidden=true;
}
function decode(raw){
  const v=String(raw||'').trim();if(!v.startsWith('MXCPM1|'))throw Error('Usa el QR de las etiquetas Macroxel (MXCPM1).');
  const p=v.split('|');if(p.length!==5)throw Error('QR incompleto.');
  const a=p.slice(1).map(decodeURIComponent);
  return {clave:a[0],lote:a[1],caducidad:a[2],pzs:qty(a[3])||1};
}
function notify(s){if($('mxInvQrStatus'))$('mxInvQrStatus').textContent=s;}
function save(){try{localStorage.setItem(storage,JSON.stringify([...count.entries()]));}catch(e){notify('No se pudo guardar el borrador local.');}}
function restore(){try{count=new Map(JSON.parse(localStorage.getItem(storage)||'[]'));}catch{count=new Map();}}
async function loadStock(){
 const hub=window.mxSharedInventoryHub;
 if(!hub){stockVerified=false;stock=[];return stock}
 let items=null;
 // La fotografía de todos los lotes incluye los que tienen ALMACEN=0;
 // las cachés de solo existencias positivas no sirven para iniciar desde cero.
 try{items=await hub.allLotsRows?.(false)}catch(_e){}
 if(!Array.isArray(items)||!items.length)items=hub.localStocks?.()?.items;
 if(!Array.isArray(items)){stockVerified=false;stock=[];return stock}
 const classified=items.map(toRow);
 unclassified=classified.filter(r=>r===null).length;
 stock=classified.filter(r=>r&&r.clave);
 stockVerified=true;warehouseSnapshotAt=new Date().toISOString();
 return stock;
}
function countFingerprint(){
 const scanned=[...count.values()].map(r=>[key(r.clave),key(r.lote),key(r.caducidad),qty(r.contado)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const missing=unscannedWarehouse().map(r=>[key(r.clave),key(r.lote),key(r.caducidad),r.existencia]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return JSON.stringify({scanned,missing,verified:stockVerified});
}
function unscannedWarehouse(){return stock.filter(r=>r.existencia>0&&![...count.values()].some(c=>sameCode(c.clave,r.clave)&&key(c.lote)===key(r.lote)&&key(c.caducidad)===key(r.caducidad)))}
function table(){
 const matched=new Set(count.keys());
 let rows=[...count.entries()],missing=count.size?unscannedWarehouse():[];
 $('mxInvQrSummary').textContent='Escaneados: '+rows.length+' lotes · '+rows.reduce((n,[id,r])=>n+r.contado,0)+' piezas · No escaneados en ALMACÉN: '+missing.length+' lotes';
 $('mxInvQrRows').innerHTML=rows.slice(-120).reverse().map(([id,r])=>'<tr><td>'+escape(r.clave)+'</td><td>'+escape(r.lote)+'</td><td>'+escape(r.caducidad)+'</td><td><input data-mx-qty="'+escape(id)+'" type="number" min="0" step="1" value="'+r.contado+'" style="width:75px"></td><td><button type="button" data-mx-remove="'+escape(id)+'" aria-label="Quitar lote del conteo" style="background:#aa2e32;color:#fff">Eliminar</button></td></tr>').join('')||'<tr><td colspan="5">Sin escaneos</td></tr>';
 $('mxInvQrMissing').textContent=count.size?'Sin escanear en ALMACÉN: '+missing.length+' lotes. Excluidos por Estantes o ubicación no confirmada: '+unclassified+'. Ninguno se pondrá en cero sin confirmación.':'No hay conteo activo. Escanea un QR para iniciar un inventario nuevo.';
  const pending=getPending(),resend=$('mxInvQrSendPending');if(resend)resend.hidden=!pending||!!pending.sent;
  // Solo mostrar Cancelar inventario cuando existan lotes escaneados o un borrador pendiente.
  const cancelBtn=$('mxInvQrCancelInventory');if(cancelBtn)cancelBtn.hidden=!(count.size>0||!!pending?.request?.items?.length);
}
async function register(raw){
 if(sending||finishing||getPending())return notify('Hay un conteo pendiente. Envíalo o cancélalo antes de escanear más.');
  const now=Date.now();if(processing||(raw===last&&now-lastAt<1400))return;
 processing=true;last=raw;lastAt=now;
 try{
 const d=decode(raw);
 const matches=stock.filter(r=>sameCode(r.clave,d.clave)&&key(r.lote)===key(d.lote)&&(!d.caducidad||key(r.caducidad)===key(d.caducidad)));
 if(matches.length>1)throw Error('Hay varios registros para la misma clave y lote. Verifica la caducidad del QR antes de sumar.');
 if(!d.lote)throw Error('El QR no indica lote. No se permite mezclar productos sin lote.');
 const row=matches[0]||{clave:d.clave,lote:d.lote,caducidad:d.caducidad,existencia:0,descripcion:'No encontrado en inventario'};
 // Si el lote existe, usar su identificador exacto. Claves iguales nunca mezclan lotes distintos.
 const id=ident(row),prev=count.get(id);
 count.set(id,{...row,contado:(prev?.contado||0)+d.pzs});
 save();table();flash();notify('✓ '+d.clave+' · '+d.lote+' · +'+d.pzs+' piezas');try{navigator.vibrate?.(80);}catch{}
 }catch(e){notify(e.message||String(e));}finally{processing=false;}
}
async function stop(){scanning=false;const s=scanner;scanner=null;if(!s)return;try{if(s.isScanning)await s.stop();}catch{}try{await s.clear();}catch{}}
async function camera(){
 if(scanning){await stop();$('mxInvQrCamera').textContent='📷 Activar cámara';return;}
 if(!window.isSecureContext) return notify('La cámara requiere HTTPS.');
 if(typeof window.Html5Qrcode!=='function'){
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('html5-qrcode.min.js',document.baseURI).href;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);}).catch(()=>{});
 }
 if(typeof window.Html5Qrcode!=='function')return notify('No cargó el lector QR.');
 const formats=window.Html5QrcodeSupportedFormats||{};
 const s=new Html5Qrcode('mxInvQrReader',{formatsToSupport:[formats.QR_CODE],verbose:false});
 scanner=s;scanning=true;$('mxInvQrCamera').textContent='Detener cámara';
 try{await s.start({facingMode:'environment'},{fps:12,qrbox:{width:230,height:230}},v=>void register(v),()=>{});notify('Escanea las etiquetas QR de Almacén.');}
 catch(e){await stop();$('mxInvQrCamera').textContent='📷 Activar cámara';notify('No se pudo abrir la cámara: '+(e?.message||e));}
}
function exportCsv(data,name){
 const fields=['clave','lote','caducidad','ubicacion','existencia','contado','accion'];
 const csv='\ufeff'+fields.join(',')+'\n'+data.map(row=>fields.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(',')).join('\n');
 const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
}
function finalize(){
 if(!count.size)return notify('Escanea por lo menos un producto.');
 if(sending||finishing)return notify('El conteo está en proceso.');
 if(getPending())return notify('Hay un conteo guardado pendiente. Envíalo o cancélalo.');
 const missing=unscannedWarehouse(),units=missing.reduce((n,r)=>n+r.existencia,0);
 reviewSignature=countFingerprint();
 $('mxInvQrFinal').hidden=false;
 $('mxInvQrFinalSummary').textContent=count.size+' lotes contados. Hay '+missing.length+' lotes NO escaneados ('+units+' piezas registradas en ALMACÉN). Elige una opción ANTES de enviar:';
 $('mxInvQrKeep').textContent='✅ CONSERVAR cantidades de no escaneados';
 $('mxInvQrDelete').textContent='⚠️ PONER EN CERO no escaneados (solo ALMACÉN)';
 $('mxInvQrDelete').disabled=!stockVerified||!missing.length;
 $('mxInvQrFinalNote').textContent=stockVerified?'ESTANTES siempre se conserva. Los cambios se aplicarán al validarse en Sistema Principal.':'Sin inventario completo de ALMACÉN verificado no es seguro poner en cero. Puedes CONSERVAR.';
}
function closeFinal(){ $('mxInvQrFinal').hidden=true;reviewSignature=''; }
function getPending(){try{return JSON.parse(localStorage.getItem(pendingStorage)||'null')}catch(_e){return null}}
function setPending(p){try{localStorage.setItem(pendingStorage,JSON.stringify(p));return true}catch(_e){notify('Espacio local insuficiente: guarda un respaldo CSV antes de cerrar.');return false}}
function getBranch(){const cfg=window.mxViewerGetCfg?.()||{};return String(cfg.branch||cfg.systemId||window.mxFixedPrincipalBinding?.currentId?.()||window.mxFixedPrincipalBinding?.systemId||'').toUpperCase().trim()}
function activeOperator(){return String(window.mxViewerGetCfg?.()?.usuario||window.mxViewerGetCfg?.()?.operator||'USUARIO VISOR QR')}
async function buildRequest(mode){
 // Usar inventario con lotes incluso en 0. No limitarse a las existencias positivas.
 try{await loadStock()}catch(_e){}
   if(!reviewSignature||reviewSignature!==countFingerprint())throw Error('Cambió el inventario desde la revisión. Revisa nuevamente los NO escaneados antes de enviar.');
  const all=[...count.values()],notFound=[],items=[],now=new Date(),session='qr-warehouse-'+now.getTime();
 for(const c of all){
  if(!Number.isInteger(Number(c.contado))||Number(c.contado)<0)throw Error('Cantidad de conteo inválida: '+c.clave+' / '+c.lote);
  const candidates=stock.filter(r=>sameCode(r.clave,c.clave)&&key(r.lote)===key(c.lote)&&key(r.caducidad)===key(c.caducidad));
  if(candidates.length>1){notFound.push(c.clave+' / '+c.lote+' (varios registros, requiere revisión)');continue}
  const r=candidates[0];
  if(!r){
    const catalog=window.mxCpmCache?.getLocal?.()||[];
    const cat=Array.isArray(catalog)?catalog.find(x=>sameCode(x.clave||x.csg||x.codigo,c.clave)):null;
    const desc=String(c.descripcion||'').trim(),name=desc&&!/No encontrado en inventario/i.test(desc)?desc:String(cat?.descripcion||cat?.nombre||'').trim();
    if(!name){notFound.push(c.clave+' / '+c.lote+' (sin descripción en Inventario/Catálogo)');continue}
    items.push({createNew:true,isNew:true,clave:c.clave,descripcion:name,unidad:String(c.unidad||cat?.unidad||cat?.presentacion||''),lote:c.lote,caducidad:c.caducidad,almacenNuevo:qty(c.contado),estantesNuevo:0,ubicacion:'ALMACEN',countSessionId:session});continue;
  }
  items.push({inventoryId:r.inventoryId,clave:r.clave,codigo_barras:r.codigo_barras,descripcion:r.descripcion,unidad:r.unidad,lote:r.lote,caducidad:r.caducidad,expectedAlmacen:r.existencia,expectedEstantes:r.estantes,almacenNuevo:qty(c.contado),estantesNuevo:r.estantes,reconcileMovements:true,reconcileFields:['almacen'],countSessionId:session,countedAt:now.toISOString(),countedAtMs:now.getTime(),ubicacion:'ALMACEN'});
 }
 if(notFound.length)throw Error('Se conservó el conteo, pero '+notFound.length+' lote(s) necesitan vinculación con Inventario o Catálogo antes de enviarse: '+notFound.slice(0,6).join('; '));
 if(mode==='eliminar'){
  if(!stockVerified)throw Error('No hay una fotografía verificada de ALMACEN. Solo puede conservar los no escaneados.');
  for(const r of unscannedWarehouse())items.push({inventoryId:r.inventoryId,clave:r.clave,descripcion:r.descripcion,lote:r.lote,caducidad:r.caducidad,expectedAlmacen:r.existencia,expectedEstantes:r.estantes,almacenNuevo:0,estantesNuevo:r.estantes,reconcileMovements:true,reconcileFields:['almacen'],autoZeroUncounted:true,countSessionId:session,ubicacion:'ALMACEN'});
 }
 const branch=getBranch(),id='invcount_qr_'+now.getTime()+'_'+Math.random().toString(36).slice(2,9);
 const req={id,status:'pending',estado:'PENDIENTE_VALIDACION',source:'VISOR_CENTRAL_INVENTARIO_QR_ALMACEN',branch,systemId:branch,inventoryMode:'almacen',inventoryModeLabel:'Inventario QR · Almacén',createdAt:now.toISOString(),createdAtMs:now.getTime(),createdBy:activeOperator(),totalProductos:items.length,items,viewerVersion:'1.0.321',uncountedPolicy:mode==='eliminar'?'zero':'keep',uncountedZeroed:mode==='eliminar'?unscannedWarehouse().length:0,snapshotAt:warehouseSnapshotAt,countSessionId:session,reason:'Conteo físico QR de almacén',untouchedPolicy:mode==='eliminar'?'ZERO_ONLY_VERIFIED_WAREHOUSE':'KEEP_EXISTING',untouchedProducts:mode==='eliminar'?0:unscannedWarehouse().length};
 return req;
}
async function resetAfterConfirmedSend(req){
 // Nunca borrar si no se comprobó la recepción del mismo folio remoto.
 await stop();count.clear();stock=[];unclassified=0;stockVerified=false;reviewSignature='';last='';lastAt=0;processing=false;
 try{localStorage.removeItem(storage);localStorage.removeItem(pendingStorage)}catch(_){}
 $('mxInvQrCamera').textContent='📷 Activar cámara';closeFinal();table();
 notify('✓ Conteo '+req.id+' ENVIADO, recibido y registros locales LIMPIADOS. Actualizando inventario para un conteo nuevo…');
 try{await loadStock()}catch(_e){}
 table();
 notify('✓ Conteo '+req.id+' ENVIADO y registros locales LIMPIADOS. Listo para empezar otro conteo. Los ajustes aún requieren VALIDACIÓN en Sistema Principal.');
}
async function sendPending(){
 const p=getPending();if(!p?.request?.items?.length){notify('No hay conteo guardado pendiente.');return false}
 if(sending||finishing){notify('Ya se procesa este envío.');return false}
 if(p.sent){await resetAfterConfirmedSend(p.request);return true}
 const req=p.request,branch=getBranch();
 if(!/^MACROXEL-[A-Z0-9_-]{4,}$/.test(branch)){notify('Conteo guardado localmente. Vincula el visor al Sistema Principal para enviar.');return false}
 req.branch=branch;req.systemId=branch;
 if(navigator.onLine===false||typeof window.mxViewerPutJson!=='function'||typeof window.mxViewerFetchJson!=='function'){notify('Conteo guardado sin enviar. Al recuperar señal pulsa Enviar conteo guardado.');return false}
 const path='/inventory_count_requests/'+encodeURIComponent(branch)+'/'+encodeURIComponent(req.id);
 sending=true;
 try{
   await window.mxViewerPutJson(path,req);
   const check=await window.mxViewerFetchJson(path);
   if(!check||String(check.id)!==String(req.id)||!Array.isArray(check.items)||check.items.length!==req.items.length)throw Error('No hay confirmación íntegra del conteo en Firebase.');
   setPending({request:req,sent:true,sentAt:new Date().toISOString()});
   await resetAfterConfirmedSend(req);return true;
 }catch(e){setPending({request:req,sent:false});notify('No se confirmó el envío, los escaneos NO se borraron. Reintenta con Enviar conteo guardado: '+(e?.message||e));return false}
 finally{sending=false}
}
async function end(mode){
 if(mode!=='conservar'&&mode!=='eliminar')return;
 if(sending||finishing)return notify('Ya se procesa el conteo.');
 if(!count.size)return notify('No hay escaneos para enviar.');
 if(!reviewSignature||reviewSignature!==countFingerprint())return notify('El conteo cambió. Abre Finalizar conteo para revisar de nuevo.');
 if(mode==='eliminar'&&!stockVerified)return notify('No hay inventario ALMACÉN verificado. Conserva no escaneados.');
 if(getPending())return notify('Hay un conteo pendiente, envíalo o cancélalo.');
 const missing=unscannedWarehouse(),units=missing.reduce((n,r)=>n+r.existencia,0);
 if(mode==='eliminar'&&!window.confirm('¿CONFIRMAS poner en CERO '+missing.length+' lotes NO escaneados ('+units+' piezas) SOLO en ALMACÉN? ESTANTES permanecerá intacto.'))return;
 finishing=true;let saved=false;
 try{const req=await buildRequest(mode);if(!setPending({request:req,sent:false}))return;saved=true;closeFinal();notify('Conteo guardado. Enviando a Sistema Principal…')}
 catch(e){notify('NO se borró el conteo: '+(e?.message||e))}
 finally{finishing=false}
 if(saved)await sendPending();
}
function open(){
 root=$('mxInvQrOverlay');root.hidden=false;table();
  const oldPending=getPending();if(oldPending?.sent){void resetAfterConfirmedSend(oldPending.request);return;}
 loadStock().then(()=>{table();notify('Conteo listo: los lotes en cero pueden registrarse. Estantes permanece intacto.');}).catch(e=>{table();notify('Conteo local disponible sin conexión. '+(e?.message||e));});
}
function init(){
 const style=document.createElement('style');style.textContent='#mxInvQrFlash{position:fixed;inset:0;z-index:2147483600;background:rgba(41,220,125,.55);opacity:0;pointer-events:none}#mxInvQrFlash.mx-inv-flash-on{animation:mxInvQrFlash .45s ease-out forwards}@keyframes mxInvQrFlash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}#mxInvQrCancelInventory{background:#ad3333!important}#mxInvQrCancelInventory[hidden]{display:none!important}'+'#mxInvQrOverlay[hidden],#mxInvQrFinal[hidden]{display:none!important}#mxInvQrOverlay{position:fixed;inset:0;z-index:2147483000;background:#102b38eb;padding:14px;overflow:auto}#mxInvQrPanel{background:#fff;color:#173846;border-radius:15px;max-width:700px;margin:auto;padding:18px}#mxInvQrPanel button{padding:10px 14px;border-radius:8px;border:0;background:#0c5363;color:white;font-weight:700;cursor:pointer;margin:3px}#mxInvQrRows td,#mxInvQrPanel th{border-bottom:1px solid #dbe5e8;padding:6px;text-align:left}#mxInvQrFinal{border:2px solid #ad6a19;padding:15px;background:#fff9e8;border-radius:12px;margin-top:12px}#mxInvQrReader{max-width:430px;margin:auto}';document.head.appendChild(style);
 root=document.createElement('div');root.id='mxInvQrOverlay';root.hidden=true;
 root.innerHTML='<div id="mxInvQrFlash" aria-hidden="true"></div><div id="mxInvQrPanel"><h2>📦 Inventario QR · Almacén</h2><p>Conteo independiente. Nada se elimina automáticamente.</p><button id="mxInvQrCamera">📷 Activar cámara</button><button id="mxInvQrClose">Cerrar</button><button id="mxInvQrCancelInventory" type="button" hidden>Cancelar inventario</button><div id="mxInvQrReader"></div><p id="mxInvQrStatus" role="status"></p><strong id="mxInvQrSummary"></strong><div style="max-height:35vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Clave</th><th>Lote</th><th>Caducidad</th><th>Contadas</th><th>Acción</th></tr></thead><tbody id="mxInvQrRows"></tbody></table></div><p id="mxInvQrMissing"></p><button id="mxInvQrFinish">Finalizar conteo</button><button id="mxInvQrSendPending" type="button">📤 Enviar conteo guardado</button><div id="mxInvQrFinal" hidden><h3>Productos no escaneados</h3><p id="mxInvQrFinalSummary"></p><button id="mxInvQrKeep">✅ CONSERVAR cantidades</button><button id="mxInvQrDelete">⚠️ PONER EN CERO (ALMACÉN)</button><button id="mxInvQrCancel">Volver sin enviar</button><p id="mxInvQrFinalNote"></p><p>Elige una opción para enviar. Tras confirmarse su recepción, se limpia el conteo local. La aplicación de ajustes requiere VALIDACIÓN del Sistema Principal.</p></div></div>';
 document.body.appendChild(root);restore();
 $('mxInvQrCamera').onclick=()=>void camera();
 $('mxInvQrClose').onclick=()=>{void stop();root.hidden=true;};
 $('mxInvQrCancelInventory').onclick=()=>void cancelInventory();
 $('mxInvQrSendPending').onclick=()=>void sendPending();
 $('mxInvQrFinish').onclick=finalize;$('mxInvQrKeep').onclick=()=>end('conservar');$('mxInvQrDelete').onclick=()=>end('eliminar');$('mxInvQrCancel').onclick=closeFinal;
 $('mxInvQrRows').addEventListener('click',e=>{
   const button=e.target.closest('button[data-mx-remove]');
   if(!button)return;
   if(sending||finishing||getPending())return notify('Conteo pendiente: envíalo o cancélalo para editar.');
    const id=button.dataset.mxRemove;
   const row=count.get(id);
   if(!row)return;
   if(!window.confirm('¿Eliminar del conteo QR la clave '+row.clave+', lote '+row.lote+', caducidad '+row.caducidad+'? No se modificará el inventario del sistema principal.'))return;
   count.delete(id);
   last='';lastAt=0;
   save();table();
   notify('Producto/lote eliminado del conteo: '+row.clave+' · '+row.lote+'.');
 });
 $('mxInvQrRows').onchange=e=>{if(sending||finishing||getPending())return notify('Conteo pendiente: envíalo o cancélalo para editar.');const id=e.target.dataset.mxQty;if(!id||!count.has(id))return;count.get(id).contado=qty(e.target.value);save();table();};
 // Se coloca junto a la opción de inventario Almacén dentro del módulo Ajustar inventario.
 const observer=new MutationObserver(()=>{
   if($('mxInventarioQrLaunch'))return;
   const candidates=[...document.querySelectorAll('button,h1,h2,h3,label,span,strong')].filter(e=>/inventario\s+almac[eé]n/i.test(e.textContent||'')&&e.children.length===0);
   const anchor=candidates.find(e=>e.offsetParent!==null)||candidates[0];
   const adjustView=$('transferAdjustView');
   if(!anchor&&!adjustView)return;
   const b=document.createElement('button');b.id='mxInventarioQrLaunch';b.type='button';b.textContent='📷 Inventario escáner QR';
   b.style.cssText='padding:10px 15px;margin:8px;background:#075b70;color:white;border:0;border-radius:9px;font-weight:800;cursor:pointer';
   b.onclick=e=>{e.preventDefault();open();};
   if(anchor)anchor.insertAdjacentElement('afterend',b);
   else adjustView.insertAdjacentElement('afterbegin',b);
 });observer.observe(document.body,{childList:true,subtree:true});
 window.mxOpenInventarioQrAlmacen=open;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();