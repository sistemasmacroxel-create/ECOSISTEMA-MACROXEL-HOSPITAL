/* Macroxel HPS Control Central — Conteo QR Almacen.
   Los conteos son borradores. Sin modificacion destructiva de existencias. */
(()=>{
'use strict';if(window.__mxInventarioQr)return;window.__mxInventarioQr=true;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=s=>String(s??'').trim().toUpperCase();
const qty=v=>Math.max(0,Math.floor(Number(v)||0));
const storage='mx-hps-conteo-qr-almacen-v1';
let root,scanner=null,scanning=false,processing=false,stock=[],count=new Map(),last='',lastAt=0;
function toRow(r){return {clave:String(r.clave||r.codigo||''),lote:String(r.lote||r.lot||''),caducidad:String(r.caducidad||r.fecha_caducidad||''),existencia:qty(r.existencia??r.piezas??r.cantidad??r.stock??r.disponible),descripcion:String(r.descripcion||r.nombre||r.producto||'')};}
function ident(r){return key(r.clave)+'|'+key(r.lote)+'|'+key(r.caducidad);}
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
 stock=items.map(toRow).filter(r=>r.clave);
 return stock;
}
function table(){
 const matched=new Set(count.keys());
 let rows=[...count.values()],missing=stock.filter(r=>!matched.has(ident(r)));
 $('mxInvQrSummary').textContent='Escaneados: '+rows.length+' lotes · '+rows.reduce((n,r)=>n+r.contado,0)+' piezas · No escaneados: '+missing.length+' lotes';
 $('mxInvQrRows').innerHTML=rows.slice(-120).reverse().map(r=>'<tr><td>'+escape(r.clave)+'</td><td>'+escape(r.lote)+'</td><td>'+escape(r.caducidad)+'</td><td><input data-mx-qty="'+escape(ident(r))+'" type="number" min="0" step="1" value="'+r.contado+'" style="width:75px"></td></tr>').join('')||'<tr><td colspan="4">Sin escaneos</td></tr>';
 $('mxInvQrMissing').textContent='Productos del sistema principal que no se escanearon: '+missing.length+' lotes. No serán alterados mientras no exista una operación de ajuste validada.';
}
async function register(raw){
 const now=Date.now();if(processing||(raw===last&&now-lastAt<1400))return;
 processing=true;last=raw;lastAt=now;
 try{
 const d=decode(raw);
 const matches=stock.filter(r=>key(r.clave)===key(d.clave)&&key(r.lote)===key(d.lote)&&(!d.caducidad||key(r.caducidad)===key(d.caducidad)));
 if(matches.length>1)throw Error('Hay lotes duplicados; verifica la caducidad del QR.');
 const row=matches[0]||{clave:d.clave,lote:d.lote,caducidad:d.caducidad,existencia:0,descripcion:'No encontrado en inventario'};
 const id=ident(row),prev=count.get(id);
 count.set(id,{...row,contado:(prev?.contado||0)+d.pzs});
 save();table();notify('✓ '+d.clave+' · '+d.lote+' · +'+d.pzs+' piezas');try{navigator.vibrate?.(80);}catch{}
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
 const fields=['clave','lote','caducidad','existencia','contado','accion'];
 const csv='\ufeff'+fields.join(',')+'\n'+data.map(row=>fields.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(',')).join('\n');
 const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
}
function finalize(){
 if(!count.size)return notify('Escanea por lo menos un producto.');
 const missing=stock.filter(r=>!count.has(ident(r)));
 const modal=$('mxInvQrFinal');modal.hidden=false;
 $('mxInvQrFinalSummary').textContent=count.size+' lotes escaneados y '+missing.length+' lotes sin escanear. Elige qué hacer con los no encontrados.';
}
function closeFinal(){ $('mxInvQrFinal').hidden=true; }
function end(mode){
 const scanned=[...count.values()].map(r=>({...r,accion:'CONTADO'}));
 const untouched=stock.filter(r=>!count.has(ident(r))).map(r=>({...r,contado:mode==='conservar'?r.existencia:0,accion:mode==='conservar'?'CONSERVAR':'PROPONER_BAJA'}));
 // No escribir en Firebase a través de métodos no verificados.
 exportCsv([...scanned,...untouched],'MACROXEL_AUDITORIA_QR_ALMACEN_'+mode+'.csv');
 notify('Revisión '+mode+' exportada. Seguridad: aún NO se ha aplicado ninguna baja o ajuste al sistema principal.');
 closeFinal();
}
function open(){
 root=$('mxInvQrOverlay');root.hidden=false;
 loadStock().then(()=>{table();notify('Inventario de Almacén cargado. Escanea las etiquetas QR.');}).catch(e=>notify(e.message));
}
function init(){
 const style=document.createElement('style');style.textContent='#mxInvQrOverlay[hidden],#mxInvQrFinal[hidden]{display:none!important}#mxInvQrOverlay{position:fixed;inset:0;z-index:2147483000;background:#102b38eb;padding:14px;overflow:auto}#mxInvQrPanel{background:#fff;color:#173846;border-radius:15px;max-width:700px;margin:auto;padding:18px}#mxInvQrPanel button{padding:10px 14px;border-radius:8px;border:0;background:#0c5363;color:white;font-weight:700;cursor:pointer;margin:3px}#mxInvQrRows td,#mxInvQrPanel th{border-bottom:1px solid #dbe5e8;padding:6px;text-align:left}#mxInvQrFinal{border:2px solid #ad6a19;padding:15px;background:#fff9e8;border-radius:12px;margin-top:12px}#mxInvQrReader{max-width:430px;margin:auto}';document.head.appendChild(style);
 root=document.createElement('div');root.id='mxInvQrOverlay';root.hidden=true;
 root.innerHTML='<div id="mxInvQrPanel"><h2>📦 Inventario QR · Almacén</h2><p>Conteo independiente. Nada se elimina automáticamente.</p><button id="mxInvQrCamera">📷 Activar cámara</button><button id="mxInvQrClose">Cerrar</button><div id="mxInvQrReader"></div><p><input id="mxInvQrManual" placeholder="Pega QR MXCPM1|..." style="width:75%;padding:10px"><button id="mxInvQrAdd">Agregar</button></p><p id="mxInvQrStatus" role="status"></p><strong id="mxInvQrSummary"></strong><div style="max-height:35vh;overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Clave</th><th>Lote</th><th>Caducidad</th><th>Contadas</th></tr></thead><tbody id="mxInvQrRows"></tbody></table></div><p id="mxInvQrMissing"></p><button id="mxInvQrFinish">Finalizar conteo</button><div id="mxInvQrFinal" hidden><h3>Productos no escaneados</h3><p id="mxInvQrFinalSummary"></p><button id="mxInvQrKeep">Conservar no encontrados</button><button id="mxInvQrDelete">Preparar baja de no encontrados</button><button id="mxInvQrCancel">Volver</button><p>Por seguridad se exportará una propuesta para revisión: no elimina todavía inventario real.</p></div></div>';
 document.body.appendChild(root);restore();
 $('mxInvQrCamera').onclick=()=>void camera();
 $('mxInvQrClose').onclick=()=>{void stop();root.hidden=true;};
 $('mxInvQrAdd').onclick=()=>{void register($('mxInvQrManual').value);$('mxInvQrManual').value='';};
 $('mxInvQrManual').onkeydown=e=>{if(e.key==='Enter')$('mxInvQrAdd').click();};
 $('mxInvQrFinish').onclick=finalize;$('mxInvQrKeep').onclick=()=>end('conservar');$('mxInvQrDelete').onclick=()=>end('eliminar');$('mxInvQrCancel').onclick=closeFinal;
 $('mxInvQrRows').onchange=e=>{const id=e.target.dataset.mxQty;if(!id||!count.has(id))return;count.get(id).contado=qty(e.target.value);save();table();};
 // Se coloca junto a la opción de inventario Almacén dentro del módulo Ajustar inventario.
 const observer=new MutationObserver(()=>{
   if($('mxInventarioQrLaunch'))return;
   const candidates=[...document.querySelectorAll('button,h1,h2,h3,label,span,strong')].filter(e=>/inventario\s+almac[eé]n/i.test(e.textContent||'')&&e.children.length===0);
   const anchor=candidates.find(e=>e.offsetParent!==null)||candidates[0];
   if(!anchor)return;
   const b=document.createElement('button');b.id='mxInventarioQrLaunch';b.type='button';b.textContent='📷 Inventario escáner QR';
   b.style.cssText='padding:10px 15px;margin:8px;background:#075b70;color:white;border:0;border-radius:9px;font-weight:800;cursor:pointer';
   b.onclick=e=>{e.preventDefault();open();};anchor.insertAdjacentElement('afterend',b);
 });observer.observe(document.body,{childList:true,subtree:true});
 window.mxOpenInventarioQrAlmacen=open;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();