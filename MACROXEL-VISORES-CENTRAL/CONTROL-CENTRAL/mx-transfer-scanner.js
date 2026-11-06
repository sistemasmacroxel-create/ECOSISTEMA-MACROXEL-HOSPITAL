/* Macroxel Control Central - camara de transferencias, extension v1.
   No modifica inventarios: utiliza el carrito y validacion existentes. */
(function(){
  'use strict';
  if(window.__mxTransferCameraV1)return;
  window.__mxTransferCameraV1=true;
  const $=id=>document.getElementById(id);
  let overlay=null,status=null,html5Scanner=null,starting=null,scannerSupported=false;
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
      '#mxScanReader{width:100%;height:auto;min-height:220px;max-height:60vh;overflow:hidden;background:#061d29;border-radius:10px}' +
      '#mxScanReader video{width:100%!important;max-height:55vh!important;object-fit:contain!important}' +
      '#mxScanReader img{display:none!important}' +
      '#mxScanPhoto{display:none}' +
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
      '<div id="mxScanReader" aria-label="Vista de cámara escaneando códigos"></div><p id="mxScanStatus" role="status">Preparando cámara...</p>'+
      '<div class="mx-scan-actions"><button type="button" id="mxScanTorch">🔦 Linterna</button><button type="button" id="mxScanUpload">🖼 Leer foto del código</button><input id="mxScanPhoto" type="file" accept="image/*" /></div>'+
      '<label for="mxScanManual" style="font-size:12px;font-weight:800">Código manual (si la cámara no reconoce)</label>'+
      '<input id="mxScanManual" autocomplete="off" placeholder="0570.00 o código de barras" />'+
      '<div class="mx-scan-actions"><button type="button" id="mxScanSearch">Buscar producto</button></div>'+
      '<p style="font-size:11px;color:#607781;margin:0">Al reconocer un producto se abrirá el lote y la cantidad para confirmar su incorporación al carrito. No registra una transferencia automáticamente.</p></div>';
    document.body.appendChild(overlay);
    status=$('mxScanStatus');
    $('mxScanClose').addEventListener('click',stop);
    overlay.addEventListener('click',e=>{if(e.target===overlay)stop();});
    $('mxScanTorch').addEventListener('click',async()=>{
      try{
        if(!html5Scanner?.isScanning){notice('La cámara todavía no está activa.');return;}
        torch=!torch;
        await html5Scanner.applyVideoConstraints({advanced:[{torch}]});
        notice(torch?'Linterna encendida. Apunta al centro del código.':'Linterna apagada.');
      }catch(_e){torch=false;notice('Esta cámara no admite linterna desde el navegador.');}
    });
    $('mxScanUpload').addEventListener('click',()=>{$('mxScanPhoto')?.click();});
    $('mxScanPhoto').addEventListener('change',async(e)=>{
      const file=e.currentTarget.files?.[0];if(!file)return;
      try{
        notice('Leyendo fotografía del código...');
        await releaseCamera();
        if(!active)return;
        const ready=await ensureLibrary();
        if(!ready)throw new Error('No se pudo iniciar el lector local.');
        const scanner=new Html5Qrcode('mxScanReader',{formatsToSupport:acceptedFormats(),verbose:false});
        html5Scanner=scanner;
        const result=await scanner.scanFile(file,false);
        await handleCode(result);
      }catch(error){notice('No se pudo leer la fotografía. Acerca el código, evita reflejos y vuelve a intentar. '+(error?.message||''));}
      finally{e.currentTarget.value='';}
    });
      $('mxScanManual').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();handleCode($('mxScanManual').value);}});
    $('mxScanSearch').addEventListener('click',()=>handleCode($('mxScanManual').value));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)stop();});
    window.addEventListener('pagehide',stop);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    window.addEventListener('mx-module-active-change',e=>{if(active&&e.detail?.active!=='transfer')stop();});
  }
  async function releaseCamera(){
    const current=html5Scanner;html5Scanner=null;torch=false;
    if(!current)return;
    try{if(current.isScanning)await current.stop();}catch(_e){}
    try{await current.clear();}catch(_e){}
  }
  function stop(){
    active=false;cycle++;busy=false;
    if(overlay)overlay.classList.remove('mx-open');
    void releaseCamera();
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
  function decodeLabelQr(raw){
    const value=String(raw??'').trim();
    if(!value.startsWith('MXCPM1|'))return null;
    const parts=value.split('|');
    if(parts.length!==5)throw new Error('QR de etiqueta incompleto.');
    const data=parts.slice(1).map(v=>decodeURIComponent(v));
    return{clave:data[0],lote:data[1],caducidad:data[2],pzs:data[3]};
  }
  async function handleCode(raw){
    if(busy||!clean(raw))return;
    busy=true;
    try{
      const structured=decodeLabelQr(raw);
      const resolved=structured?null:await resolveCode(raw);
      const payload=structured||{clave:resolved?.key||'',barcode:resolved?.barcode||'',pzs:1};
      notice('Código leído. Validando lote y piezas con el inventario...');
      if(!payload.clave)throw new Error('El código leído no corresponde a una clave CPM.');
      if(!requireTransferDirection())throw new Error('Selecciona el sentido de transferencia antes de agregar productos.');
      if(typeof window.mxTransferScanAdd!=='function')throw new Error('No se cargó el carrito de Transferencias. Actualiza la página.');
      const result=await window.mxTransferScanAdd(payload);
      stop();
      const st=$('transferInventoryStatus');
      if(st)st.textContent=result?.message||'No se pudo incorporar el código.';
      if(!result?.ok){
        const cartSt=$('transferSendStatus');
        if(cartSt){cartSt.textContent=result?.message||'Código no encontrado.';cartSt.style.color='#991b1b';}
      }
      $('transferQ').value=payload.clave;
      $('transferQ').dispatchEvent(new Event('input',{bubbles:true}));
    }catch(e){
      const message='No se pudo agregar el escaneo: '+(e?.message||e);
      stop();
      const st=$('transferInventoryStatus');if(st)st.textContent=message;
      const cartSt=$('transferSendStatus');if(cartSt){cartSt.textContent=message;cartSt.style.color='#991b1b';}
    }finally{busy=false;}
  }
  function acceptedFormats(){
    const f=window.Html5QrcodeSupportedFormats||{};
    return ['QR_CODE','CODE_128','CODE_39','EAN_13','EAN_8','UPC_A','UPC_E','ITF','CODE_93']
      .map(k=>f[k]).filter(x=>Number.isInteger(x));
  }
  function ensureLibrary(){
    if(typeof window.Html5Qrcode==='function')return Promise.resolve(true);
    // La librería está incluida en el mismo repositorio; nunca depende de un CDN.
    const old=document.querySelector('script[data-mx-scanner-vendor]');
    if(old)return new Promise(resolve=>{
      if(typeof window.Html5Qrcode==='function')return resolve(true);
      old.addEventListener('load',()=>resolve(typeof window.Html5Qrcode==='function'),{once:true});
      old.addEventListener('error',()=>resolve(false),{once:true});
      setTimeout(()=>resolve(typeof window.Html5Qrcode==='function'),9000);
    });
    return new Promise(resolve=>{
      const s=document.createElement('script');s.dataset.mxScannerVendor='1';
      s.src=new URL('html5-qrcode.min.js',document.baseURI).href;
      s.onload=()=>resolve(typeof window.Html5Qrcode==='function');
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
      setTimeout(()=>resolve(typeof window.Html5Qrcode==='function'),9000);
    });
  }
  async function startCamera(myCycle){
    const scanner=new Html5Qrcode('mxScanReader',{
      formatsToSupport:acceptedFormats(),verbose:false,
      experimentalFeatures:{useBarCodeDetectorIfSupported:false}
    });
    html5Scanner=scanner;
    const config={fps:12,aspectRatio:1.33333};
    const onSuccess=(value)=>{
      if(!active||myCycle!==cycle||busy||!clean(value))return;
      notice('✓ Código leído: '+value+'. Buscando producto...');
      const input=$('mxScanManual');if(input)input.value=value;
      try{navigator.vibrate?.(100)}catch(_e){}
      void handleCode(value);
    };
    // Si la cámara trasera falla, se intenta una de las disponibles.
    try{
      await scanner.start({facingMode:'environment'},config,onSuccess,()=>{});
    }catch(primaryError){
      if(!active||cycle!==myCycle)return;
      const devices=await Html5Qrcode.getCameras().catch(()=>[]);
      const rear=devices.find(d=>/back|rear|environment|trasera|posterior/i.test(d.label))||devices.at(-1);
      if(!rear)throw primaryError;
      await scanner.start(rear.id,config,onSuccess,()=>{});
    }
    if(!active||myCycle!==cycle){await releaseCamera();return;}
    notice('Cámara activa ✓ Apunta al código de barras o QR. Centra el código y deja que enfoque.');
  }
  function requireTransferDirection(){
    const direction=$('transferDirection');
    if(direction?.value)return true;
    const msg='Selecciona primero el sentido de transferencia: Almacén → Estantes o Estantes → Almacén. Después activa el escáner.';
    const status=$('transferInventoryStatus');
    if(status)status.textContent=msg;
    const send=$('transferSendStatus');
    if(send){send.textContent=msg;send.style.color='#92400e';}
    if(direction){
      direction.focus();
      direction.scrollIntoView({block:'center',behavior:'smooth'});
    }
    return false;
  }
  function askTransferDirection(){
    buildUI();
    let choice=$('mxScanDirectionOverlay');
    if(!choice){
      choice=document.createElement('div');
      choice.id='mxScanDirectionOverlay';
      choice.style.cssText='position:fixed;inset:0;z-index:2147483200;background:rgba(2,16,30,.88);display:flex;align-items:center;justify-content:center;padding:16px';
      choice.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="mxScanDirectionTitle" style="background:white;color:#143543;width:min(450px,100%);border-radius:16px;padding:22px;box-shadow:0 18px 65px #00182b">'+
        '<h3 id="mxScanDirectionTitle" style="margin:0 0 12px;font-size:20px">Sentido de transferencia</h3>'+
        '<p style="margin:0 0 18px">Antes de activar el escáner, selecciona hacia dónde moverás los productos.</p>'+
        '<button type="button" data-mx-scan-dir="almacen" style="display:block;width:100%;padding:15px;margin:0 0 12px;background:#07596a;color:white;border:0;border-radius:10px;font-weight:800;font-size:16px">Almacén → Estantes</button>'+
        '<button type="button" data-mx-scan-dir="estantes" style="display:block;width:100%;padding:15px;margin:0 0 12px;background:#07596a;color:white;border:0;border-radius:10px;font-weight:800;font-size:16px">Estantes → Almacén</button>'+
        '<button type="button" data-mx-scan-cancel style="display:block;width:100%;padding:12px;border:1px solid #ccd6dc;background:#f3f6f8;border-radius:10px">Cancelar</button></div>';
      document.body.appendChild(choice);
      choice.querySelector('[data-mx-scan-cancel]').addEventListener('click',()=>choice.remove());
      choice.addEventListener('click',e=>{if(e.target===choice)choice.remove();});
      choice.querySelectorAll('[data-mx-scan-dir]').forEach(btn=>btn.addEventListener('click',()=>{
        const direction=$('transferDirection');
        const wanted=btn.dataset.mxScanDir;
        if(!direction){alert('No se encontró el selector de sentido de transferencia. Actualiza el visor.');return;}
        // Valores reales del selector del visor hospitalario: A2E y E2A.
        const requiredValue=wanted==='almacen'?'A2E':'E2A';
        const available=[...direction.options].some(option=>option.value===requiredValue);
        if(!available){
          alert('El selector de Transferencias no contiene el sentido '+requiredValue+'. Actualiza el visor.');
          return;
        }
        direction.value=requiredValue;
        direction.dispatchEvent(new Event('input',{bubbles:true}));
        direction.dispatchEvent(new Event('change',{bubbles:true}));
        choice.remove();
        if(!requireTransferDirection())return;
        void startCameraFlow();
      }));
    }
    choice.style.display='flex';
    choice.querySelector('[data-mx-scan-dir]')?.focus();
  }
  async function startCameraFlow(){
    if(!requireTransferDirection())return;
    buildUI();stop();overlay.classList.add('mx-open');active=true;
    const myCycle=cycle;
    notice('Preparando lector de códigos y cámara…');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      notice('Para escanear necesitas abrir este visor en HTTPS y permitir la cámara. También puedes buscar la clave manualmente o leer una fotografía.');
      return;
    }
    try{
      const ready=await ensureLibrary();
      if(!ready)throw new Error('No se pudo cargar el lector integrado. Actualiza la página y comprueba que html5-qrcode.min.js exista junto al visor.');
      if(!active||myCycle!==cycle)return;
      scannerSupported=true;
      await startCamera(myCycle);
    }catch(e){
      if(!active||myCycle!==cycle)return;
      const text=String(e?.message||e);
      notice('La cámara no pudo iniciar: '+text+'. Revisa los permisos o utiliza Leer foto del código.');
    }
  }
    function boot(){
    const b=$('mxTransferScanner');if(!b)return;
    b.addEventListener('click',e=>{e.preventDefault();askTransferDirection();});
  }
  // Extensión Inventario QR para Ajustar inventario → Almacén.
  if(!document.querySelector('script[data-mx-inventario-qr]')){
    const extra=document.createElement('script');
    extra.dataset.mxInventarioQr='1';
    extra.src=new URL('mx-inventario-qr.js?v=20261105d',document.baseURI).href;
    extra.onerror=()=>console.warn('Macroxel: no pudo cargar el modulo Inventario QR.');
    document.head.appendChild(extra);
  }
  // Instalar mejoras de flujo en el iframe Etiquetas (mismo origen que Control Central).
  function installLabelsFlow(){
    const frame=document.getElementById('mxEtiquetasFrame');
    if(!frame)return false;
    const attach=()=>{
      try{
        const doc=frame.contentDocument;
        if(!doc||!doc.documentElement||doc.querySelector('[data-mx-labels-flow]'))return;
        const script=doc.createElement('script');
        script.dataset.mxLabelsFlow='1';
        script.src=new URL('mx-etiquetas-flujo.js?v=20261105a',document.baseURI).href;
        (doc.head||doc.documentElement).appendChild(script);
      }catch(e){console.warn('No fue posible instalar flujo de etiquetas:',e);}
    };
    frame.addEventListener('load',attach);
    if(frame.contentDocument?.readyState==='complete')attach();
    return true;
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      if(!installLabelsFlow()){
        const obs=new MutationObserver(()=>{if(installLabelsFlow())obs.disconnect();});
        obs.observe(document.documentElement,{childList:true,subtree:true});
      }
    },{once:true});
  }else if(!installLabelsFlow()){
    const obs=new MutationObserver(()=>{if(installLabelsFlow())obs.disconnect();});
    obs.observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();