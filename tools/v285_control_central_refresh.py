from pathlib import Path

p=Path('MACROXEL-VISORES-CENTRAL/CONTROL-CENTRAL/index.html')
s=p.read_text(encoding='utf-8')
if 'mxAbxAutoRefreshV285' not in s:
    old="window.mxTransferAntibioticsResumeSync=()=>openAntibiotics(false,true);"
    new="""window.mxTransferAntibioticsResumeSync=()=>openAntibiotics(false,true); // mxAbxAutoRefreshV285
setInterval(()=>{if(document.hidden||window.mxTransferStableNavigation?.active!=='antibiotics')return;void openAntibiotics(true,true)},90000);"""
    assert s.count(old)==1,'No se encuentra la recarga de Antibioticos esperada'
    s=s.replace(old,new,1)
    old="r.cannot?'🔴 SIN CAPACIDAD PARA OTRO':'🟢 PUEDE ABRIR NUEVO'"
    new="(r.estimated==null||r.avg<=0)?'⚪ SIN BASE DE CONSUMO':(r.cannot?'🔴 NO PUEDE ABRIR TRATAMIENTO':'🟢 PUEDE ABRIR TRATAMIENTO')"
    assert s.count(old)==1,'No se encuentra el semaforo de apertura esperado'
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
assert 'mxAbxAutoRefreshV285' in s
