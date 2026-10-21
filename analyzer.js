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
function financialDiagnosis(){
 const now=new Date(),monthKey=now.toLocaleDateString('en-CA').slice(0,7);
 const moves=state.moves.filter(m=>m.date?.slice(0,7)===monthKey);
 const income=moves.filter(m=>m.type==='income').reduce((a,m)=>a+(Number(m.amount)||0),0);
 const expenses=moves.filter(m=>m.type==='expense').reduce((a,m)=>a+(Number(m.amount)||0),0);
 const active=state.debts.filter(d=>Number(d.balance)>0);
 const debt=active.reduce((a,d)=>a+(Number(d.balance)||0),0);
 const payments=active.reduce((a,d)=>a+(Number(d.payment)||0),0);
 const overdue=active.filter(d=>d.status==='overdue'||(d.due&&d.due<now.toLocaleDateString('en-CA'))).length;
 const missing=active.filter(d=>!(Number(d.payment)>0)).length;
 const free=income-expenses-payments;
 const ratio=income>0?payments/income:null;
 const alerts=[],steps=[];
 if(income<=0){alerts.push('No hay ingresos registrados este mes. No es posible medir tu capacidad real de pago sin ese dato.');steps.push('Registrá tus ingresos del mes para obtener un diagnóstico más confiable.')}
 if(overdue){alerts.push(overdue+' compromiso(s) aparecen vencidos por fecha o estado. Verificá con cada acreedor si existen recargos, cortes de servicio u otras consecuencias.');steps.push('Contactá primero a los acreedores con vencimientos críticos para conocer el saldo actualizado y opciones de regularización.')}
 if(income>0&&free<0){alerts.push('Los gastos y pagos previstos superan tus ingresos del mes en '+cash(Math.abs(free))+'.');steps.push('Revisá gastos postergables y negociá cuotas antes de asumir nuevos compromisos.')}
 if(income>0&&ratio>=.4){alerts.push('Los pagos previstos de deudas representan '+Math.round(ratio*100)+'% de tus ingresos registrados; es una señal para revisar el presupuesto, no un diagnóstico definitivo.')}
 if(missing){alerts.push(missing+' deuda(s) tienen saldo pero ningún pago mensual previsto. La proyección puede subestimar tus obligaciones.');steps.push('Completá los pagos mínimos o cuotas de cada deuda y sus vencimientos.')}
 if(!active.length)steps.push('No hay deudas pendientes registradas. Mantené al día los gastos y reservá un pequeño margen para imprevistos si es posible.');
 if(active.length){steps.push('Priorizá vivienda, alimentos, servicios esenciales y compromisos con consecuencias inmediatas; después compará intereses y costos de financiación.');steps.push('Pedí por escrito saldo total, tasa, cargos y condiciones antes de aceptar refinanciaciones.')}
 if(income>0&&free>0&&debt>0)steps.push('Tu margen mensual estimado es '+cash(free)+'. No lo destines íntegramente a deuda sin contemplar gastos irregulares e imprevistos.');
 let level='Información insuficiente',reason='Faltan datos para evaluar el riesgo.';
 if(income>0){level=free<0||overdue?'Atención prioritaria':ratio!==null&&ratio>=.4?'Presupuesto ajustado':'Situación a revisar';reason=free<0?'Los compromisos superan los ingresos registrados.':overdue?'Hay compromisos vencidos.':ratio>=.4?'Las cuotas ocupan una parte elevada de los ingresos.':'No aparecen desequilibrios graves en los registros actuales, aunque pueden faltar datos.'}
 const box=document.getElementById('financial-diagnosis');if(!box)return;
 box.innerHTML='<h2>Tu diagnóstico financiero</h2><p class="hint">Orientativo y basado exclusivamente en los datos que cargaste en Mi Balance; no analiza cuentas bancarias ni consulta tu historial crediticio.</p><div class="grid" style="margin:14px 0"><div class="card"><small>Ingresos del mes</small><div class="number">'+cash(income)+'</div></div><div class="card"><small>Gastos del mes</small><div class="number">'+cash(expenses)+'</div></div><div class="card"><small>Cuotas previstas</small><div class="number">'+cash(payments)+'</div></div><div class="card"><small>Margen estimado</small><div class="number '+(free<0?'red':'green')+'">'+cash(free)+'</div></div></div><h3>'+clean(level)+'</h3><p class="hint">'+clean(reason)+'</p><h3>Qué revisar</h3>'+alerts.map(x=>'<p class="hint">• '+clean(x)+'</p>').join('')+'<h3>Próximos pasos posibles</h3>'+steps.map((x,i)=>'<p class="hint">'+(i+1)+'. '+clean(x)+'</p>').join('')+'<p class="hint">Importante: un gasto registrado y una cuota de deuda no deben contarse dos veces. Si faltan ingresos, gastos o cuotas, el diagnóstico puede cambiar. Este análisis no reemplaza asesoramiento financiero profesional.</p>';
}
function renderAdvice(){financialDiagnosis();
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
document.getElementById('doc-diagnose').onclick=financialDiagnosis;
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
financialDiagnosis();
})();