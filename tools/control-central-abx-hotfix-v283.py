from pathlib import Path
p=Path('MACROXEL-VISORES-CENTRAL/CONTROL-CENTRAL/index.html')
s=p.read_text(encoding='utf-8')
mark='/* ===== MACROXEL CANONICAL SOURCE: mx-transfer-antibiotic-capacity-v205 ===== */'
assert mark in s
head,src=s.split(mark,1)
assert 'mxAbxStockFallbackV283' not in src
helper=r'''async function mxAbxStockFallbackV283(branch,meta,capacity){
  if(!meta||String(meta.sourceAuthority||'')!=='INVENTARIO_PRINCIPAL'||N(meta.seq)<=0)return false;
  let raw;try{raw=await get('/inventory_cpm_totals/'+branch+'/items')}catch(_e){return false}
  if(raw==null)return false;
  const records=Array.isArray(raw)?raw:Object.values(raw.items||raw);
  const previous=new Set(mxAbxValues(capacity?.items||{}).map(r=>K(r.clave||r.c)).filter(Boolean));
  let catalog=[];
  try{const res=await window.mxCpmCache?.syncCatalog?.(false);catalog=Array.isArray(res?.catalog)?res.catalog:[]}catch(_e){}
  const info=new Map(catalog.map(r=>[K(r.clave||r.csg||r.c),r]).filter(x=>x[0]));
  const rows=[];
  for(const r of records){
    if(!r||typeof r!=='object')continue;
    const clave=T(r.c||r.clave||r.codigo||r.csg),key=K(clave),existence=Math.max(0,N(r.e??r.existencia??r.total));
    if(!key||!existence)continue;
    const p=info.get(key)||{},descripcion=T(r.d||r.descripcion||r.nombre||p.descripcion||clave);
    const metaAbx={descripcion,clasificacion:r.cl||r.clasificacion||r.one?.[7]||p.clasificacion||'',restriccion:r.rs||r.restriccion||r.one?.[8]||p.restriccion||''};
    if(!isAbxMeta(metaAbx)&&!previous.has(key)&&r.antibiotico!==true&&r.isAntibiotico!==true)continue;
    rows.push({clave,descripcion,existence});
  }
  rows.sort((a,b)=>b.existence-a.existence||a.descripcion.localeCompare(b.descripcion,'es'));
  state.rows=rows;state.source='inventory_stock_only';state.at=Date.now();state.capacityUpdatedAt='';
  return true;
}
'''
anchor='async function load(force=false){\n  if(!force&&state.at&&Date.now()-state.at<60000&&state.rows.length)return state;if(busy)return busy;'
assert src.count(anchor)==1,src.count(anchor)
src=src.replace(anchor,helper+anchor,1)
old="    state.rows=[];state.source='inventory_pending_capacity';state.capacityUpdatedAt='';state.at=Date.now();return state;"
assert src.count(old)==1
src=src.replace(old,"    if(await mxAbxStockFallbackV283(branch,inventoryMeta,capacity))return state;\n"+old,1)
anchor2="  const rows=filterRows(document.getElementById('transferAntibioticsQ')?.value),danger=state.rows.filter(r=>r.cannot);"
assert src.count(anchor2)==1
extra=r'''  if(state.source==='inventory_stock_only'){
    const rows=filterRows(document.getElementById('transferAntibioticsQ')?.value);
    body.innerHTML=rows.length?rows.map(r=>'<tr><td><b>'+E(abxShortKey(r.clave))+'</b></td><td>'+E(abxShortDescription(r.descripcion))+'</td><td><b>'+Math.round(r.existence)+'</b></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>SOLO EXISTENCIA</td></tr>').join(''):'<tr><td colspan="10" class="empty">No se identificaron antibióticos con existencias verificadas. Revisa su clasificación en Inventario.</td></tr>';
    if(status)status.textContent='Existencias físicas verificadas desde Inventario Principal. Compromisos, reserva y disponible pendientes de cálculo; no utilizar el total físico como capacidad para nuevos tratamientos.';
    if(alert)alert.classList.add('mx-hidden');return;
  }
'''
src=src.replace(anchor2,extra+anchor2,1)
p.write_text(head+mark+src,encoding='utf-8')
print('Patch applied:',len(src))
