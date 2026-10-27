from pathlib import Path

p=Path('MACROXEL-VISORES-CENTRAL/CONTROL-CENTRAL/index.html')
s=p.read_text(encoding='utf-8')
tag='mxAbxAutoRefreshV285'
if tag not in s:
    old="r.cannot?'🔴 SIN CAPACIDAD PARA OTRO':'🟢 PUEDE ABRIR NUEVO'"
    new="(r.estimated==null||r.avg<=0)?'⚪ SIN BASE DE CONSUMO':(r.cannot?'🔴 NO PUEDE ABRIR TRATAMIENTO':'🟢 PUEDE ABRIR TRATAMIENTO')"
    print('Coincidencias semaforo:',s.count(old))
    if s.count(old)==1:s=s.replace(old,new,1)
    marker='/* ===== MACROXEL CANONICAL SOURCE: mx-transfer-antibiotic-capacity-v205 ===== */'
    assert marker in s
    pos=s.index('</script>',s.index(marker))
    refresh="""
;(()=>{ // mxAbxAutoRefreshV285
  setInterval(()=>{
    if(document.hidden)return;
    const visible=window.mxTransferStableNavigation?.active==='antibiotics'||location.hash.toLowerCase().includes('antibioticos')||location.hash.toLowerCase().includes('antibiotics');
    if(!visible)return;
    try{window.__mxInitNativeAntibiotics?.()}catch(e){console.warn('[ABX V285] Recarga',e)}
  },90000);
})();
"""
    s=s[:pos]+refresh+s[pos:]
    p.write_text(s,encoding='utf-8')
assert tag in s
