from pathlib import Path
import re
p=Path('MACROXEL-VISORES-CENTRAL/CONTROL-CENTRAL/index.html')
s=p.read_text(encoding='utf-8')
marker='mxAbxVerifiedSequenceV286'
if marker in s:
 print('Control Central ya corregido v286')
 raise SystemExit(0)
a=s.index('/* ===== MACROXEL CANONICAL SOURCE: mx-transfer-antibiotic-capacity-v205 ===== */')
b=s.index('</script>',a)
central=s[a:b]
regex=r'(?m)^([ \t]*)const verified\s*=\s*[^;\n]*(?:\n[^;]*)?;'
matches=list(re.finditer(regex,central))
if len(matches)!=1:
 print('Verificadores:',len(matches))
 i=central.find('const verified')
 print(central[max(0,i-150):i+600])
 raise SystemExit(1)
m=matches[0]
assert 'capacity' in m.group(0) and 'inventoryMeta' in m.group(0)
indent=m.group(1)
new=f'''{indent}// mxAbxVerifiedSequenceV286: secuencia autoritativa sin depender de huella antigua.
{indent}const verifiedAgeV286=Date.parse(capacity?.updatedAt||'')||0;
{indent}const verifiedRecentV286=verifiedAgeV286>0&&verifiedAgeV286<=Date.now()+120000&&Date.now()-verifiedAgeV286<15*60*1000;
{indent}const verified=verifiedRecentV286&&!!inventoryMeta&&!!capacity&&N(capacity?.schemaVersion)>=278&&
{indent}  T(inventoryMeta?.sourceAuthority)==='INVENTARIO_PRINCIPAL'&&T(capacity?.source)==='SISTEMA_PRINCIPAL_ANALISIS'&&
{indent}  (matchesRevision||matchesSeq);
{indent}state.confirmationIssue=verified?'':!capacity?'El principal todavía no publicó el resumen de capacidad.':!verifiedRecentV286?'El cálculo publicado no está vigente.':!(matchesSeq||matchesRevision)?'La revisión de inventario no coincide con el cálculo publicado.':'Falta confirmación del Inventario Principal.';'''
central=central[:m.start()]+new+central[m.end():]
old="reconstructed?'⚠️ CÁLCULO POR VALIDAR'"
new="reconstructed?(r.estimated==null||r.avg<=0?'⚪ SIN BASE DE CONSUMO':(r.cannot?'🟠 NO ALCANZA · SIN CONFIRMAR':'🟠 ALCANZARÍA · SIN CONFIRMAR'))"
if old in central:central=central.replace(old,new,1)
for old in [
 'Cálculo provisional con solicitudes recientes y existencias físicas del Principal. Verificar en el sistema antes de surtir o abrir tratamientos.',
 'Cálculo provisional con solicitudes recientes y existencias físicas del Inventario Principal. Debe confirmarse en el Principal antes de abrir tratamientos o surtir.'
]:
 if old in central:
  central=central.replace(old,'Capacidad provisional sin autorización; consulta el resumen actualizado del Principal antes de abrir o surtir.',1)
  break
s=s[:a]+central+s[b:]
p.write_text(s,encoding='utf-8')
print('Visor Central v286 corregido.')
