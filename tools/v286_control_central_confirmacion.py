from pathlib import Path
p=Path('MACROXEL-VISORES-CENTRAL/CONTROL-CENTRAL/index.html')
s=p.read_text(encoding='utf-8')
marker='mxAbxVerifiedSequenceV286'
if marker in s:
    print('Visor ya corregido v286')
    raise SystemExit(0)
old="""    const verified=freshCapacity&&!!inventoryMeta&&!!capacity&&N(capacity?.schemaVersion)>=278&&
      (matchesRevision||(!T(inventoryMeta?.revision)&&(matchesSeq||(inventoryTime>0&&capacityTime>=inventoryTime))));"""
new="""    // mxAbxVerifiedSequenceV286: la secuencia autoritativa identifica la misma foto de Inventario.
    // La huella puede variar entre versiones. Conservar verificacion de origen y vigencia.
    const principalSource=T(capacity?.source)==='SISTEMA_PRINCIPAL_ANALISIS';
    const principalInventory=T(inventoryMeta?.sourceAuthority)==='INVENTARIO_PRINCIPAL';
    const verified=freshCapacity&&!!inventoryMeta&&!!capacity&&N(capacity?.schemaVersion)>=278&&
      principalSource&&principalInventory&&(matchesRevision||matchesSeq);
    state.confirmationIssue=verified?'':!capacity?'El principal todavía no publicó el resumen de capacidad.':!principalInventory?'La fotografía física no está confirmada por Inventario Principal.':!principalSource?'El resumen no procede del análisis principal.':!freshCapacity?'La última capacidad publicada ya no está vigente.':'La secuencia y revisión del resumen no coinciden con el inventario actual.';"""
if s.count(old)!=1:raise SystemExit('Verificador actual diferente: '+str(s.count(old)))
s=s.replace(old,new,1)
old="reconstructed?'⚠️ CÁLCULO POR VALIDAR':(r.estimated==null||r.avg<=0?'⚪ SIN BASE PARA DETERMINAR':(r.cannot?'🔴 NO PUEDE ABRIR':'🟢 PUEDE ABRIR TRATAMIENTO'))"
new="reconstructed?(r.estimated==null||r.avg<=0?'⚪ SIN BASE DE CONSUMO':(r.cannot?'🟠 NO ALCANZA · SIN CONFIRMAR':'🟠 ALCANZARÍA · SIN CONFIRMAR')):(r.estimated==null||r.avg<=0?'⚪ SIN BASE PARA DETERMINAR':(r.cannot?'🔴 NO PUEDE ABRIR TRATAMIENTO':'🟢 PUEDE ABRIR TRATAMIENTO'))"
if s.count(old)!=1:raise SystemExit('Estado anterior diferente: '+str(s.count(old)))
s=s.replace(old,new,1)
old="'Cálculo provisional con solicitudes recientes y existencias físicas del Principal. Verificar en el sistema antes de surtir o abrir tratamientos.'"
new="'Capacidad informativa sin autorización: '+(state.confirmationIssue||'Esperando confirmación del Principal.')+' El Principal debe publicar el resumen vigente antes de autorizar o surtir.'"
if s.count(old)!=1:raise SystemExit('Aviso anterior diferente: '+str(s.count(old)))
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('Visor ABX v286 parche aplicado y no se modificaron transferencias.')
