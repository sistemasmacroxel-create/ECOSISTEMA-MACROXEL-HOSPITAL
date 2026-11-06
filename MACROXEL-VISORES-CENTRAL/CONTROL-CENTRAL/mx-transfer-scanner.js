/* Macroxel Control Central - camara de transferencias, extension v1.
   No modifica inventarios: utiliza el carrito y validacion existentes. */
(function(){
  'use strict';
  if(window.__mxTransferCameraV1)return;
  window.__mxTransferCameraV1=true;
  const $=id=>document.getElementById(id);
  let overlay=null,video=null,status=null,stream=null,detector=null,reader=null,readerControls=null;
  let active=false,busy=false,cycle=0,torch=false,trackedCode='';
  const clean=s=>String(s==null?'':s).trim().replace(/\s+/g,'');
  const onlyDigits=s=>clean(s).replace(/\D/g,'');
  function notice(message){if(status)status.textContent=message;}
  function buildUI(){
    if(overlay)return;
    const css=document.createElement('style');css.id='mx-scan-transfer-style';css.textContent=
      '#mxTransferScanner{min-height:42px;padding:8px 12px;border-radius:10px;background:#064e62;color:white;border:0;font-weight:800;white-space:nowrap;cursor:pointer}' +
      '#mxScanOverlay{position:fixed;inset:0;z-index:2147483100;background:rgba(2,16,30,.9);display:none;align-items:center;justify-content:center;padding:12px}' +
      '#mxScanOverlay.mx-open{display:flex}' +
      '#mxScanBox{width:min(520px,100%);background:#fff;color:#163240;border-radius:17px;padding:15px;box-shadow:0 20px 70px #001a2b}' +
      '#mxScanVideo{display:block;width:100%;aspect-ratio:4/3;max-height:66vh;object-fit:cover;background:#071e29;border-radius:10px}' +
      '#mxScanBox button{min-height:42px;padding:9px 13px;border:0;border-radius:8px;font-weight:800;cursor:pointer}' +
      '#mxScanBox .mx-scan-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin:12px 0}' +
      '#mxScanManual{width:100%;min-height:44px;padding:8px;border:1px solid #aebfc7;border-radius:8px;font-size:17px;letter-spacing:.3px}' +
      '#mxScanBox .mx-scan-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
      '#mxScanClose{background:#e7eef2;color:#193843}' +
      '#mxScanTorch{background:#dfecf2;color:#1a5465}' +
      '#mxScanSearch{background:#0d5162;color:white}' +
      '#mxScanStatus{font-size:12px;color:#33576a;min-height:28px;margin:9px 0;line-height:1.4}';
    document.head.appendChild(css);
    overlay=document.createElement('div');
    overlay.id='mxScanOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Escanear productos para transferencia');
    overlay.innerHTML='<div id="mxScanBox"><div class="mx-scan-heading"><h3 style="margin:4px 0 12px">📷 Escáner de transferencias</h3><button type="button" id="mxScanClose" aria-label="Cerrar cámara">✕</button></div>'+
      '<video id="mxScanVideo" autoplay playsinline muted></video><p id="mxScanStatus" role="status">Preparando cámara...</p>'+
      '<div class="mx-scan-actions"><button type="button" id="mxScanTorch">🔦 Linterna</button></div>'+
      '<label for="mxScanManual" style="font-size:12px;font-weight:800">Código manual (si la cámara no reconoce)</label>'+
      '<input id="mxScanManual" autocomplete="off" placeholder="0570.00 o código de barras" />'+
      '<div class="mx-scan-actions"><button type="button" id="mxScanSearch">Buscar producto</button></div>'+
      '<p style="font-size:11px;color:#607781;margin:0">Al reconocer un producto se abrirá el lote y la cantidad para confirmar su incorporación al carrito. No registra una transferencia automáticamente.</p></div>';
    document.body.appendChild(overlay);
    video=$('mxScanVideo');status=$('mxScanStatus');
    $('mxScanClose').addEventListener('click',stop);
    overlay.addEventListener('click',e=>{if(e.target===overlay)stop();});
    $('mxScanTorch').addEventListener('click',async()=>{
      const track=stream?.getVideoTracks?.()[0];
      if(!track||typeof track.applyConstraints!=='function'){notice('La linterna no está disponible en esta cámara.');return;}
      try{torch=!torch;await track.applyConstraints({advanced:[{torch}]});}
      catch(_e){torch=false;notice('Tu dispositivo no admite encender la linterna.');}
    });
    $('mxScanManual').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();handleCode($('mxScanManual').value);}});
    $('mxScanSearch').addEventListener('click',()=>handleCode($('mxScanManual').value));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)stop();});
    window.addEventListener('pagehide',stop);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    window.addEventListener('mx-module-active-change',e=>{if(active&&e.detail?.active!=='transfer')stop();});
  }
  function stop(){
    active=false;cycle++;busy=false;torch=false;
    try{readerControls?.stop?.();}catch(_e){}
    try{reader?.reset?.();}catch(_e){}
    readerControls=null;reader=null;
    try{stream?.getTracks?.().forEach(t=>t.stop());}catch(_e){}
    stream=null;
    try{if(video){video.pause();video.srcObject=null;}}catch(_e){}
    if(overlay)overlay.classList.remove('mx-open');
  }
  function keyCandidates(value){
    const raw=clean(value).toUpperCase();
    const d=onlyDigits(raw);
    const variants=new Set([raw]);
    if(/^\d{3}\.\d{3}\.\d{4}\.\d{2}$/.test(raw))variants.add(raw.slice(-7));
    if(/^\d{6}$/.test(d))variants.add(d.slice(0,4)+'.'+d.slice(4));
    if(/^\d{4}$/.test(d))variants.add(d+'.00');
    if(/^\d{1,3}$/.test(d))variants.add(d.padStart(4,'0')+'.00');
    return variants;
  }
  async function resolveCode(value){
    const raw=clean(value);
    if(!raw)return null;
    const normal=raw.toUpperCase(),numeric=onlyDigits(raw),codes=keyCandidates(raw);
    const cpm=Array.isArray(window.MX_DEFAULT_CPM)?window.MX_DEFAULT_CPM:[];
    const found=cpm.filter(p=>{const key=clean(p.clave).toUpperCase(),short=key.slice(-7);return codes.has(key)||codes.has(short)||short.replace(/\D/g,'')===numeric||key.replace(/\D/g,'')===numeric;});
    if(found.length===1)return{key:found[0].clave,barcode:'',candidateCount:1};
    if(found.length>1)return{key:raw,barcode:'',candidateCount:found.length};
    const hub=window.mxSharedInventoryHub;
    try{
      let lots=hub?.localStocks?.()?.items||[];
      let byBarcode=lots.filter(r=>[r.codigo_barras,r.codigoBarras,r.barcode].some(x=>clean(x)===raw));
      if(!byBarcode.length&&typeof hub?.allLotsRows==='function'){
        lots=await hub.allLotsRows(false);
        byBarcode=(Array.isArray(lots)?lots:[]).filter(r=>[r.codigo_barras,r.codigoBarras,r.barcode].some(x=>clean(x)===raw));
      }
      if(byBarcode.length){
        const keys=[...new Set(byBarcode.map(r=>clean(r.clave)).filter(Boolean))];
        if(keys.length===1)return{key:keys[0],barcode:raw,candidateCount:1};
        return{key:raw,barcode:raw,candidateCount:keys.length};
      }
    }catch(_e){}
    return{key:raw,barcode:'',candidateCount:0};
  }
  async function handleCode(raw){
    if(busy||!clean(raw))return;
    busy=true;
    try{
      notice('Buscando el producto escaneado...');
      const item=await resolveCode(raw);
      if(!item){notice('Escribe o escanea una clave válida.');return;}
      trackedCode=item.barcode;
      const q=$('transferQ');
      if(!q){notice('No se encontró el buscador de Transferencias.');return;}
      q.value=item.key;
      q.dispatchEvent(new Event('input',{bubbles:true}));
      const dir=$('transferDirection');
      stop();
      const activeView=$('transferView');
      if(activeView?.classList.contains('mx-hidden'))window.mxTransferStableNavigation?.open?.('transfer');
      if(!dir?.value){dir?.focus();const st=$('transferInventoryStatus');if(st)st.textContent='Código escaneado: '+item.key+'. Selecciona Almacén → Estantes o Estantes → Almacén para continuar.';return;}
      // La búsqueda existente decide qué lotes y cantidades están disponibles.
      await new Promise(resolve=>setTimeout(resolve,180));
      let matches=[...document.querySelectorAll('#transferResults [data-prod-i]')];
      if(!matches.length && typeof window.mxTransferBackgroundSync==='function'){
        await window.mxTransferBackgroundSync(false).catch(()=>{});
        q.dispatchEvent(new Event('input',{bubbles:true}));
        await new Promise(resolve=>setTimeout(resolve,180));
        matches=[...document.querySelectorAll('#transferResults [data-prod-i]')];
      }
      const selected=matches.filter(b=>{const val=(b.querySelector('.tr-key')?.textContent||'').trim();return val===item.key||val.endsWith(item.key.slice(-7));});
      if(selected.length===1)selected[0].click();
      else if(matches.length===1)matches[0].click();
      else{
        const st=$('transferInventoryStatus');
        if(st)st.textContent=(matches.length?'Selecciona el producto correcto entre los resultados: ':'No hay producto disponible para esta clave: ')+item.key;
      }
      // Si hay varios lotes, solo se elige automáticamente cuando coincide exactamente
      // el código físico del lote; en otro caso el usuario elige su lote.
      if(trackedCode){
        const lotsModal=$('transferLotsModal');
        for(let attempt=0;attempt<16;attempt++){
          if($('transferQtyModal')?.classList.contains('show'))break;
          if(lotsModal?.classList.contains('show')){
            const options=[...lotsModal.querySelectorAll('[data-lot-i]')];
            const exact=options.filter(b=>((b.querySelector('.tr-desc')?.textContent||'').split('Código ').pop().trim()===trackedCode));
            if(exact.length===1)exact[0].click();
            break;
          }
          await new Promise(resolve=>setTimeout(resolve,150));
        }
      }
    }catch(e){
      const st=$('transferInventoryStatus');if(st)st.textContent='No se pudo procesar el código: '+(e?.message||e);
      stop();
    }finally{busy=false;}
  }
  async function loadZXing(){
    if(window.ZXing?.BrowserMultiFormatReader)return true;
    const url='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    return new Promise(resolve=>{
      const s=document.createElement('script');s.src=url;s.async=true;
      s.onload=()=>resolve(!!window.ZXing?.BrowserMultiFormatReader);
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    });
  }
  async function scanLoop(myCycle){
    if(!active||cycle!==myCycle||!detector)return;
    try{
      if(video?.readyState>=2){
        const results=await detector.detect(video);
        if(results.length&&active&&cycle===myCycle){
          handleCode(results[0].rawValue);
          return;
        }
      }
    }catch(_e){}
    if(active&&cycle===myCycle)setTimeout(()=>scanLoop(myCycle),140);
  }
  async function start(){
    buildUI();stop();overlay.classList.add('mx-open');active=true;const myCycle=cycle;
    notice('Solicitando permiso para usar la cámara trasera…');
    if(!navigator.mediaDevices?.getUserMedia){notice('Este navegador no permite abrir cámara. Usa Chrome o Safari en HTTPS, o ingresa la clave manualmente.');return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      if(!active||cycle!==myCycle){stream.getTracks().forEach(t=>t.stop());return;}
      video.srcObject=stream;
      await video.play().catch(()=>{});
      if(typeof window.BarcodeDetector==='function'){
        const supported=await window.BarcodeDetector.getSupportedFormats?.().catch(()=>[])||[];
        const formats=['code_128','ean_13','ean_8','upc_a','qr_code','code_39','itf'].filter(f=>supported.includes(f));
        if(formats.length){
          detector=new window.BarcodeDetector({formats});notice('Apunta al código de barras o QR. El reconocimiento es automático.');
          scanLoop(myCycle);return;
        }
      }
      notice('Activando lector compatible con este navegador…');
      if(await loadZXing()){
        reader=new window.ZXing.BrowserMultiFormatReader();
        const controls=await reader.decodeFromVideoElement(video,(result,err)=>{
          if(result&&active&&cycle===myCycle)handleCode(result.getText?.()||String(result.text||''));
        });
        readerControls=controls;
        notice('Apunta al código de barras o QR.');
      }else notice('No se pudo cargar el lector en este navegador. Introduce la clave manualmente.');
    }catch(e){notice('No se pudo abrir la cámara: '+(e?.message||e)+'. Comprueba permisos y conexión segura.');}
  }
  function boot(){
    const b=$('mxTransferScanner');if(!b)return;
    b.addEventListener('click',e=>{e.preventDefault();start();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();