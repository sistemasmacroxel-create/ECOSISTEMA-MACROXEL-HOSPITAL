/* Macroxel HPS - flujo ágil de preparación de etiquetas. Carga en iframe del visor. */
(function(){
'use strict';
if(window.__mxEtiquetasFlujo)return;
window.__mxEtiquetasFlujo=true;
const $=id=>document.getElementById(id);
function init(){
 const search=$('search-input'),add=$('add-btn'),lots=$('mxInventoryLotsRows'),lot=$('lot-input'),expiry=$('expiry-input');
 if(!search||!add||!lots||!lot||!expiry)return;
 const box=search.closest('.search-box')||search.parentElement;
 if(!box)return;
 search.setAttribute('inputmode','numeric');
 search.setAttribute('enterkeyhint','search');
 search.setAttribute('autocomplete','off');
 const toggle=document.createElement('button');
 toggle.type='button';toggle.id='mxEtiquetasKeyboard';toggle.textContent='ABC';
 toggle.title='Cambiar de teclado numérico a letras';
 toggle.setAttribute('aria-label','Cambiar teclado numérico a letras');
 toggle.style.cssText='font-size:13px;padding:7px 10px;border:1px solid #b8cbd0;background:#eaf3f4;border-radius:8px;color:#164e5e;font-weight:800;flex:none;min-width:48px;cursor:pointer';
 box.appendChild(toggle);
 toggle.addEventListener('click',()=>{
  const text=search.getAttribute('inputmode')!=='text';
  search.setAttribute('inputmode',text?'text':'numeric');
  toggle.textContent=text?'123':'ABC';
  toggle.title=text?'Usar teclado numérico':'Usar teclado de letras';
  // En móviles el teclado ya abierto puede necesitar reabrirse para adoptar el modo.
  search.blur();
  setTimeout(()=>search.focus({preventScroll:true}),60);
 });
 function focusDetails(){
  const target=lot.closest('.fields-grid')||lot.closest('.field-group')||lot;
  requestAnimationFrame(()=>{
   target.scrollIntoView({block:'center',behavior:'smooth'});
   try{lot.focus({preventScroll:true});}catch(_){}
  });
 }
 // Captura tanto selección manual como elección de lote hecha por el propio visor.
 lots.addEventListener('click',e=>{
  if(!e.target.closest('[data-mx-lot]'))return;
  setTimeout(focusDetails,30);
 });
 // Si el inventario elige automáticamente el único lote, también muestra la captura.
 const observer=new MutationObserver(()=>{
  if($('mxInventoryLotsPanel')?.hidden)return;
  if(lot.value && expiry.value && document.activeElement===search && lots.querySelectorAll('[data-mx-lot]').length===1){
   observer.disconnect();focusDetails();setTimeout(()=>observer.observe(lot,{attributes:true,attributeFilter:['value']}),400);
  }
 });
 // El caso normal se atiende por click: no observar mutaciones del documento entero.
 let beforeCount=0;
 add.addEventListener('click',()=>{
  const count=$('label-count');
  beforeCount=parseInt(count?.textContent||'0',10)||0;
  setTimeout(()=>{
   const after=parseInt(count?.textContent||'0',10)||0;
   // Solo volver al buscador si se agregó o actualizó correctamente.
   const cleared=!!$('chosen-product')?.hidden && !lot.value && !expiry.value && !search.value;
   if(after>beforeCount || cleared){
    $('tab-editor')?.click();
    search.scrollIntoView({block:'center',behavior:'smooth'});
    search.focus({preventScroll:true});
    try{search.select();}catch(_){}
   }
  },90);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();