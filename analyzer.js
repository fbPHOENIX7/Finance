(()=>{
'use strict';
const panel=document.getElementById('analizador'), file=document.getElementById('doc-file'), status=document.getElementById('doc-status'), preview=document.getElementById('doc-preview'), review=document.getElementById('doc-review'), advice=document.getElementById('doc-advice');
let extracted='',lines=[],sourceName='';
const clean=s=>String(s||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n);
const parseMoney=s=>{let v=s.replace(/[$\s]/g,'').replace(/[^\d,.-]/g,'');if(!v)return NaN;const c=v.lastIndexOf(','),d=v.lastIndexOf('.');if(c>=0&&d>=0)v=c>d?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'');else if(c>=0){const parts=v.split(',');v=parts.at(-1).length<=2?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'')}else if(d>=0){const parts=v.split('.');if(parts.at(-1).length===3)v=v.replace(/\./g,'')}return Number(v)};
const patterns=[/(?:ARS|AR\$|\$)\s*(-?\s*[\d.,]+)/gi,/\b(?:total|importe|saldo|pago mínimo|pago minimo|vencimiento|cuota)\s*[:$]?\s*(-?[\d.,]+)/gi];
function analyze(text){
 const found=[];const seen=new Set();const rows=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 rows.forEach((row,i)=>{if(row.length>240)return;for(const pattern of patterns){pattern.lastIndex=0;for(const match of row.matchAll(pattern)){const amount=parseMoney(match[1]);if(!Number.isFinite(amount)||amount<=0||amount>1e12)continue;const key=i+':'+amount;if(seen.has(key))continue;seen.add(key);found.push({label:row.slice(0,110),amount,kind:/pago m[ií]nimo/i.test(row)?'minimum':/saldo|total a pagar|deuda|financiaci[oó]n/i.test(row)?'balance':/total|importe total/i.test(row)?'total':'item',line:i})}}});
 return found.slice(0,80);
}
async function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo descargar el lector. Comprobá tu conexión.'));document.head.appendChild(s)})}
async function readPDF(f){
 if(!window.pdfjsLib)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
 if(pdf.numPages>30)throw Error('El PDF supera el límite de 30 páginas.');
 let all='';for(let p=1;p<=pdf.numPages;p++){status.textContent='Leyendo página '+p+' de '+pdf.numPages+'…';const page=await pdf.getPage(p);const content=await page.getTextContent();let prevY=null;for(const x of content.items){const y=x.transform?.[5];if(prevY!==null&&Math.abs(y-prevY)>3)all+='\n';all+=x.str+' ';prevY=y}all+='\n'}
 return all;
}
async function readImage(f){
 if(!window.Tesseract)await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
 const worker=await Tesseract.createWorker('spa',1,{logger:m=>{if(m.status==='recognizing text')status.textContent='Leyendo imagen: '+Math.round((m.progress||0)*100)+'%'}});
 try{return (await worker.recognize(f)).data.text}finally{await worker.terminate()}
}
function renderAdvice(){
 const kind=document.getElementById('doc-type').value, detected=lines;
 const totals=detected.filter(x=>x.kind==='balance'||x.kind==='total').sort((a,b)=>b.amount-a.amount);
 const min=detected.find(x=>x.kind==='minimum');
 const due=(extracted.match(/(?:vencimiento|vence|fecha de pago)[^\n]{0,35}?\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i)||[])[1];
 const overdue=/vencid[oa]|mora|intimaci[oó]n|cobranza|intereses punitorios|atrasad[oa]/i.test(extracted);
 const items=[];
 if(overdue)items.push('<b>Atención prioritaria:</b> el documento menciona mora, vencimiento o cobranza. Confirmá el estado real con el emisor y consultá cargos y opciones de regularización.');
 if(due)items.push('<b>Fecha encontrada:</b> '+clean(due)+'. Verificá que sea el vencimiento vigente.');
 if(totals.length)items.push('<b>Importe destacado:</b> '+cash(totals[0].amount)+'. Puede ser total, saldo o importe a pagar; revisá el concepto antes de registrarlo.');
 if(min)items.push('<b>Pago mínimo detectado:</b> '+cash(min.amount)+'. Pagar solo el mínimo puede generar intereses sobre el saldo restante.');
 if(kind==='card')items.push('Para una tarjeta, diferenciá consumos, cuotas, pago mínimo y saldo del resumen. No cargues el total y todos los consumos como gastos adicionales.');
 if(kind==='bill')items.push('Para una factura, verificá el período facturado, el vencimiento y si ya fue pagada antes de cargarla como deuda.');
 if(kind==='ticket')items.push('Para un ticket, revisá que el importe sea el total final y que no se haya registrado antes.');
 if(!items.length)items.push('No se identificaron señales claras de mora o endeudamiento. Eso no significa que el documento esté libre de riesgos.');
 items.push('Para ordenar tus finanzas: priorizá necesidades básicas y vencimientos con consecuencias importantes, revisá tasas y recargos, consultá planes de pago con el acreedor y evitá asumir nuevas cuotas sin calcular tu margen mensual.');
 items.push('Este análisis usa reglas locales, no inteligencia artificial ni asesoramiento financiero profesional. Puede interpretar mal importes o fechas: verificá el documento original.');
 advice.innerHTML='<h3>Lectura orientativa y próximos pasos</h3><div class="list">'+items.map(x=>'<p class="hint" style="margin:4px 0">'+x+'</p>').join('')+'</div>';
}
function renderReview(){
 lines=analyze(extracted);review.classList.remove('hidden');
 document.getElementById('doc-count').textContent=lines.length+' importe(s) posibles detectados. Elegí solo los que correspondan.';
 document.getElementById('doc-rows').innerHTML=lines.map((x,i)=>'<label class="doc-row"><input type="checkbox" data-pick="'+i+'"><span>'+clean(x.label)+'</span><b>'+cash(x.amount)+'</b></label>').join('')||'<p class="hint">No se detectaron importes con suficiente confianza. Podés copiarlos manualmente desde el documento.</p>';
 preview.value=extracted.slice(0,25000);renderAdvice();
}
file.addEventListener('change',async()=>{
 const f=file.files?.[0];if(!f)return;
 sourceName=f.name;review.classList.add('hidden');advice.innerHTML='';status.textContent='Procesando '+sourceName+'…';
 try{
  if(f.size>12*1024*1024)throw Error('El archivo supera los 12 MB.');
  const ext=f.name.split('.').pop().toLowerCase();
  if(f.type==='application/pdf'||ext==='pdf')extracted=await readPDF(f);
  else if(f.type.startsWith('image/')&&['jpg','jpeg','png','webp'].includes(ext))extracted=await readImage(f);
  else if(['txt','csv'].includes(ext))extracted=await f.text();
  else throw Error('Formato no admitido. Usá PDF, JPG, PNG, WEBP, TXT o CSV.');
  if(!extracted.trim())throw Error('No se pudo extraer texto. Si es un PDF escaneado, convertí la página a imagen y volvé a cargarla.');
  status.textContent='Lectura finalizada. Revisá cuidadosamente los resultados.';renderReview();
 }catch(err){status.textContent='Error: '+err.message}
});
document.getElementById('doc-reanalyze').onclick=()=>{extracted=preview.value;renderReview()};
document.getElementById('doc-type').onchange=renderAdvice;
document.getElementById('doc-save').onclick=()=>{
 const picked=[...document.querySelectorAll('[data-pick]:checked')].map(x=>lines[Number(x.dataset.pick)]).filter(Boolean);
 if(!picked.length)return alert('Seleccioná al menos un importe.');
 const mode=document.getElementById('doc-mode').value;
 if(mode==='debt'&&picked.length!==1)return alert('Para registrar una deuda, seleccioná un único saldo total. No sumes cuotas, consumos y total.');
 if(!confirm('¿Guardar '+picked.length+' registro(s)? Revisá que no estén duplicados.'))return;
 const date=new Date().toLocaleDateString('en-CA');
 if(mode==='debt'){const x=picked[0];state.debts.push({id:crypto.randomUUID(),name:sourceName+' — '+x.label.slice(0,65),balance:x.amount,rate:0,payment:0,due:'',status:'current'})}
 else{picked.forEach(x=>state.moves.push({id:crypto.randomUUID(),description:(sourceName+' — '+x.label).slice(0,120),amount:x.amount,type:'expense',category:'Otros',date,frequency:'once'}))}
 save();status.textContent='Se guardaron '+picked.length+' registro(s). Podés editarlos en Movimientos o Deudas.';show(mode==='debt'?'deudas':'movimientos');
};
})();