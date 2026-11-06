/* Macroxel HPS Control Central — Conteo QR Almacen.
   Los conteos son borradores. Sin modificacion destructiva de existencias. */
(()=>{
'use strict';if(window.__mxInventarioQr)return;window.__mxInventarioQr=true;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=s=>String(s??'').trim().toUpperCase();
const qty=v=>Math.max(0,Math.floor(Number(v)||0));
const storage='mx-hps-conteo-qr-almacen-v1';
let root,scanner=null,scanning=false,processing=false,stock=[],unclassified=0,count=new Map(),last='',lastAt=0;
// Aislar exclusivamente las existencias de ALMACEN antes de proponer bajas.
function normalizePlace(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function warehouseQty(r){
 const fields=[r.ubicacion,r.ubicación,r.area,r.zona,r.deposito,r.depósito,r.tipoUbicacion,r.tipo_ubicacion,r.localizacion].filter(v=>v!=null&&String(v).trim());
 if(fields.length){
  const names=fields.map(normalizePlace);
  if(names.some(v=>/estante|anaquel|exhibicion|mostrador|vitrina/.test(v)))return null;
  if(!names.some(v=>/almacen|bodega/.test(v)))return null;
  return qty(r.existencia??r.piezas??r.cantidad??r.stock??r.disponible);
 }
 const explicit=r.existencia_almacen??r.existenciaAlmacen??r.stock_almacen??r.stockAlmacen??r.piezas_almacen??r.piezasAlmacen??r.almacenPzs;
 if(explicit!==undefined&&explicit!==null)return qty(explicit);
 return null;
}
function toRow(r){
 const existencia=warehouseQty(r);
 if(existencia===null)return null;
 return {clave:String(r.clave||r.codigo||''),lote:String(r.lote||r.lot||''),caducidad:String(r.caducidad||r.fecha_caducidad||''),existencia,ubicacion:'ALMACEN',descripcion:String(r.descripcion||r.nombre||r.producto||'')};
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
 if(!window.confirm('¿Cancelar este inventario QR? Se borrarán todos los productos escaneados en este conteo. El inventario del sistema principal NO se modificará.'))return;
 await stop();
 count.clear();stock=[];unclassified=0;last='';lastAt=0;processing=false;
 try{localStorage.removeItem(storage);}catch(_){}
 const input=$('mxInvQrManual');if(input)input.value='';
 $('mxInvQrCamera').textContent='📷 Activar cámara';
 closeFinal();
 table();
 notify('Inventario QR cancelado. No se modificaron existencias.');
 root.hidden=true;
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
 if(!hub)throw Error('No hay conexión con el inventario del sistema principal.');
 let items=hub.localStocks?.()?.items;
 if(!Array.isArray(items)||!items.length)items=await hub.allLotsRows?.(false);
 if(!Array.isArray(items))throw Error('No se pudo consultar el inventario.');
 const classified=items.map(toRow);
 unclassified=classified.filter(r=>r===null).length;
 stock=classified.filter(r=>r&&r.clave);
 if(!stock.length)throw Error('No se pudieron identificar existencias de ALMACÉN con certeza. Por seguridad, se bloquean las propuestas de baja.');
 return stock;
}
function table(){
 const matched=new Set(count.keys());
 let rows=[...count.entries()],missing=stock.filter(r=>!matched.has(ident(r)));
 $('mxInvQrSummary').textContent='Escaneados: '+rows.length+' lotes · '+rows.reduce((n,[id,r])=>n+r.contado,0)+' piezas · No escaneados en ALMACÉN: '+missing.length+' lotes';
 $('mxInvQrRows').innerHTML=rows.slice(-120).reverse().map(([id,r])=>'<tr><td>'+escape(r.clave)+'</td><td>'+escape(r.lote)+'</td><td>'+escape(r.caducidad)+'</td><td><input data-mx-qty="'+escape(id)+'" type="number" min="0" step="1" value="'+r.contado+'" style="width:75px"></td><td><button type="button" data-mx-remove="'+escape(id)+'" aria-label="Quitar lote del conteo" style="background:#aa2e32;color:#fff">Eliminar</button></td></tr>').join('')||'<tr><td colspan="5">Sin escaneos</td></tr>';
 $('mxInvQrMissing').textContent='Sin escanear en ALMACÉN: '+missing.length+' lotes. Excluidos por Estantes o ubicación no confirmada: '+unclassified+'. Ninguno de estos últimos se propondrá para baja.';
}
async function register(raw){
 const now=Date.now();if(processing||(raw===last&&now-lastAt<1400))return;
 processing=true;last=raw;lastAt=now;
 try{
 const d=decode(raw);
 const matches=stock.filter(r=>key(r.clave)===key(d.clave)&&key(r.lote)===key(d.lote)&&(!d.caducidad||key(r.caducidad)===key(d.caducidad)));
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
 if(!stock.length)return notify('No hay existencias de ALMACÉN verificadas; se bloqueó la baja.');
 const missing=stock.filter(r=>!count.has(ident(r)));
 const modal=$('mxInvQrFinal');modal.hidden=false;
 $('mxInvQrFinalSummary').textContent=count.size+' lotes escaneados y '+missing.length+' lotes sin escanear de ALMACÉN. ESTANTES queda fuera de la propuesta. Elige qué hacer con los no encontrados.';
}
function closeFinal(){ $('mxInvQrFinal').hidden=true; }
function end(mode){
 if(!stock.length)return notify('No hay stock de ALMACÉN verificado.');
 if(mode!=='conservar'&&mode!=='eliminar')return;
 const scanned=[...count.values()].map(r=>({...r,accion:'CONTADO'}));
 const untouched=stock.filter(r=>r.ubicacion==='ALMACEN'&&!count.has(ident(r))).map(r=>({...r,contado:mode==='conservar'?r.existencia:0,accion:mode==='conservar'?'CONSERVAR_ALMACEN':'PROPONER_BAJA_ALMACEN'}));
 // No escribir en Firebase a través de métodos no verificados.
 exportCsv([...scanned,...untouched],'MACROXEL_AUDITORIA_QR_ALMACEN_'+mode+'.csv');
 notify('Revisión '+mode+' exportada. Seguridad: aún NO se ha aplicado ninguna baja o ajuste al sistema principal.');
 closeFinal();
}
function open(){
 root=$('mxInvQrOverlay');root.hidden=false;
 loadStock().then(()=>{table();notify('Existencias de ALMACÉN cargadas. Estantes está excluido del conteo y las bajas.');}).catch(e=>notify(e.message));
}
function init(){
 const style=document.createElement('style');style.textContent='#mxInvQrFlash{position:fixed;inset:0;z-index:2147483600;background:rgba(41,220,125,.55);opacity:0;pointer-events:none}#mxInvQrFlash.mx-inv-flash-on{animation:mxInvQrFlash .45s ease-out forwards}@keyframes mxInvQrFlash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}#mxInvQrCancelInventory{background:#ad3333!important}'+'#mxInvQrOverlay[hidden],#mxInvQrFinal[hidden]{display:none!important}#mxInvQrOverlay{position:fixed;inset:0;z-index:2147483000;background:#102b38eb;padding:14px;overflow:auto}#mxInvQrPanel{background:#fff;color:#173846;border-radius:15px;max-width:700px;margin:auto;padding:18px}#mxInvQrPanel button{padding:10px 14px;border-radius:8px;border:0;background:#0c5363;color:white;font-weight:700;cursor:pointer;margin:3px}#mxInvQrRows td,#mxInvQrPanel th{border-bottom:1px solid #dbe5e8;padding:6px;text-align:left}#mxInvQrFinal{border:2px solid #ad6a19;padding:15px;background:#fff9e8;border-radius:12px;margin-top:12px}#mxInvQrReader{max-width:430px;margin:auto}';document.head.appendChild(style);
 root=document.createElement('div');root.id='mxInvQrOverlay';root.hidden=true;
 root.innerHTML='<div id="mxInvQrFlash" aria-hidden="true"></div><div id="mxInvQrPanel"><h2>📦 Inventario QR · Almacén</h2><p>Conteo independiente. Nada se elimina automáticamente.</p><button id="mxInvQrCamera">📷 Activar cámara</button><button id="mxInvQrClose">Cerrar</button><button id="mxInvQrCancelInventory" type="button">Cancelar inventario</button><div id="mxInvQrReader"></div><p><input id="mxInvQrManual" placeholder="Pega QR MXCPM1|..." style="width:75%;padding:10px"><button id="mxInvQrAdd">Agregar</button></p><p id="mxInvQrStatus" role="status"></p><strong id="mxInvQrSummary"></strong><div style="max-height:35vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Clave</th><th>Lote</th><th>Caducidad</th><th>Contadas</th><th>Acción</th></tr></thead><tbody id="mxInvQrRows"></tbody></table></div><p id="mxInvQrMissing"></p><button id="mxInvQrFinish">Finalizar conteo</button><div id="mxInvQrFinal" hidden><h3>Productos no escaneados</h3><p id="mxInvQrFinalSummary"></p><button id="mxInvQrKeep">Conservar no encontrados</button><button id="mxInvQrDelete">Preparar baja de no encontrados</button><button id="mxInvQrCancel">Volver</button><p>Por seguridad se exportará una propuesta para revisión: no elimina todavía inventario real.</p></div></div>';
 document.body.appendChild(root);restore();
 $('mxInvQrCamera').onclick=()=>void camera();
 $('mxInvQrClose').onclick=()=>{void stop();root.hidden=true;};
 $('mxInvQrCancelInventory').onclick=()=>void cancelInventory();
 $('mxInvQrAdd').onclick=()=>{void register($('mxInvQrManual').value);$('mxInvQrManual').value='';};
 $('mxInvQrManual').onkeydown=e=>{if(e.key==='Enter')$('mxInvQrAdd').click();};
 $('mxInvQrFinish').onclick=finalize;$('mxInvQrKeep').onclick=()=>end('conservar');$('mxInvQrDelete').onclick=()=>end('eliminar');$('mxInvQrCancel').onclick=closeFinal;
 $('mxInvQrRows').addEventListener('click',e=>{
   const button=e.target.closest('button[data-mx-remove]');
   if(!button)return;
   const id=button.dataset.mxRemove;
   const row=count.get(id);
   if(!row)return;
   if(!window.confirm('¿Eliminar del conteo QR la clave '+row.clave+', lote '+row.lote+', caducidad '+row.caducidad+'? No se modificará el inventario del sistema principal.'))return;
   count.delete(id);
   last='';lastAt=0;
   save();table();
   notify('Producto/lote eliminado del conteo: '+row.clave+' · '+row.lote+'.');
 });
 $('mxInvQrRows').onchange=e=>{const id=e.target.dataset.mxQty;if(!id||!count.has(id))return;count.get(id).contado=qty(e.target.value);save();table();};
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