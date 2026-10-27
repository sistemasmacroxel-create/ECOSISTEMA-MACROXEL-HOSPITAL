from pathlib import Path
import sys
p=Path('MACROXEL-VISORES-CENTRAL/CONTROL-CENTRAL/index.html')
s=p.read_text(encoding='utf-8')
tag='mxAbxRebuildVerifiedLiveV284'
if tag in s:
 print('Control Central ya integrado v284')
 sys.exit(0)
mark='/* ===== MACROXEL CANONICAL SOURCE: mx-transfer-antibiotic-capacity-v205 ===== */'
assert s.count(mark)==1
head,tail=s.split(mark,1)
anchor='async function mxAbxStockFallbackV283(branch,meta,capacity){'
assert tail.count(anchor)==1
add="""async function mxAbxRebuildVerifiedLiveV284(branch,rows){
  if(!rows.length)return false;
  const paths=['/antibiotic_patient_list/'+branch,'/patient_catalog/'+branch,
    '/antibiotic_patient_history/'+branch,'/service_orders/'+branch,
    '/ecosystem_controls/'+branch];
  const results=await Promise.allSettled(paths.map(p=>get(p)));
  const nodes=results.map(r=>r.status==='fulfilled'?r.value:null);
  // Solo datos recientes de la unidad vinculada. Existencias solo del inventario actual.
  const treatments=dedupe([...collectPatientList(nodes[0]||{}),
    ...collectPatientList(nodes[1]||{}),...collectHistory(nodes[2]||{}),
    ...collectOrders(nodes[3]||{})]);
  const now=Date.now(),today=td(),yesterday=yd();
  const liveActivity=treatments.some(r=>(r.day===today||r.day===yesterday)&&!r.closed);
  const updated=mxAbxStamp(nodes[0]?.updatedAt);
  const recent=updated>0&&updated<=now+120000&&now-updated<36*3600000;
  if(!liveActivity&&!recent)return false;
  state.treatments=treatments;
  state.stocks=rows.map(r=>({clave:r.clave,descripcion:r.descripcion,
    existencia:r.existence,clasificacion:'ANTIBIOTICO'}));
  state.lots=[];state.controls={reserve:Math.max(0,N(nodes[4]?.colectivosReservaPiezas))};
  buildRows();
  state.source='firebase_recomputed_unverified';state.at=Date.now();
  state.capacityUpdatedAt='';
  return true;
}
"""
tail=tail.replace(anchor,add+anchor,1)
needle="  state.rows=rows;state.source='inventory_stock_only';state.at=Date.now();state.capacityUpdatedAt='';\n  return true;"
assert tail.count(needle)==1
tail=tail.replace(needle,"  if(await mxAbxRebuildVerifiedLiveV284(branch,rows))return true;\n"+needle,1)
a=tail.index('function renderAntibiotics(){')
b=tail.index('async function openAntibiotics(',a)
seg=tail[a:b]
before="const rows=filterRows(document.getElementById('transferAntibioticsQ')?.value),danger=state.rows.filter(r=>r.cannot);"
after="const rows=filterRows(document.getElementById('transferAntibioticsQ')?.value),reconstructed=state.source==='firebase_recomputed_unverified',danger=reconstructed?[]:state.rows.filter(r=>r.cannot);"
assert seg.count(before)==1
seg=seg.replace(before,after,1)
old='$'+"{r.cannot?'🔴 SIN CAPACIDAD PARA OTRO':'🟢 PUEDE ABRIR NUEVO'}"
new='$'+"{reconstructed?'⚠️ CÁLCULO POR VALIDAR':(r.cannot?'🔴 SIN CAPACIDAD PARA OTRO':'🟢 PUEDE ABRIR NUEVO')}"
assert seg.count(old)==1
seg=seg.replace(old,new,1)
target='  if(alert){if(danger.length)'
assert seg.count(target)==1
seg=seg.replace(target,"  if(reconstructed&&status)status.textContent='Cálculo provisional con solicitudes recientes y existencias físicas del Inventario Principal. Debe confirmarse en el Principal antes de abrir tratamientos o surtir.';\n"+target,1)
tail=tail[:a]+seg+tail[b:]
p.write_text(head+mark+tail,encoding='utf-8')
print('Control Central v284',p.stat().st_size)
