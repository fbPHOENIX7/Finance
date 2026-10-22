(()=>{
'use strict';
const el=document.getElementById('debt-strategy');
if(!el)return;
const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const date=new Date();
function simulate(debts,extra,method){
 const ds=debts.map(d=>({name:d.name,balance:+d.balance,rate:+d.rate||0,payment:+d.payment||0,status:d.status}));
 const total=ds.reduce((a,d)=>a+d.balance,0);
 if(!total)return {months:0,interest:0,events:[],total:0};
 let interest=0,events=[],months=0;
 while(months<360&&ds.some(d=>d.balance>0.01)){
  months++;
  let pool=Math.max(0,extra);
  const previous=ds.reduce((a,d)=>a+d.balance,0);
  for(const d of ds){const charge=d.balance*d.rate/1200;d.balance+=charge;interest+=charge}
  for(const d of ds){const pay=Math.min(d.balance,d.payment);d.balance-=pay;pool+=Math.max(0,d.payment-pay)}
  // Redirect only the unused part of each scheduled payment.
  const sorted=[...ds].filter(d=>d.balance>.01).sort((a,b)=>method==='snowball'?a.balance-b.balance:b.rate-a.rate||a.balance-b.balance);
  for(const d of sorted){const pay=Math.min(pool,d.balance);d.balance-=pay;pool-=pay}
  const remaining=ds.reduce((a,d)=>a+d.balance,0);
  if(remaining>=previous-.01)return {error:'Los pagos no alcanzan para reducir el saldo con estas tasas. Revisá cuotas, intereses y alternativas de refinanciación.'};
  if(months%3===0||remaining<=.01)events.push({month:months,remaining});
 }
 return months>=360?{error:'La proyección supera los 30 años; revisá los importes.'}:{months,interest,events,total};
}
function render(){
 const debts=state.debts.filter(d=>Number(d.balance)>0);
 const incomes=state.moves.filter(x=>x.type==='income'&&x.date?.slice(0,7)===new Date().toLocaleDateString('en-CA').slice(0,7)).reduce((a,x)=>a+(+x.amount||0),0);
 const expenses=state.moves.filter(x=>x.type==='expense'&&x.date?.slice(0,7)===new Date().toLocaleDateString('en-CA').slice(0,7)).reduce((a,x)=>a+(+x.amount||0),0);
 const payments=debts.reduce((a,d)=>a+(+d.payment||0),0);
 const margin=incomes-expenses-payments;
 el.innerHTML='<h2>Ruta para salir de las deudas</h2><p class="hint">Compará estrategias de cancelación. Es una simulación orientativa: no reemplaza el resumen del banco, las condiciones del préstamo ni una negociación real.</p><div class="grid"><div class="card"><small>Saldo pendiente</small><div class="number">'+fmt(debts.reduce((a,d)=>a+(+d.balance||0),0))+'</div></div><div class="card"><small>Cuotas previstas</small><div class="number">'+fmt(payments)+'</div></div><div class="card"><small>Margen del mes</small><div class="number '+(margin<0?'red':'green')+'">'+fmt(margin)+'</div></div><div class="card"><small>Deudas activas</small><div class="number">'+debts.length+'</div></div></div><div class="cols" style="margin-top:18px"><label>Pago extra mensual que podrías sostener ($)<input type="number" id="strategy-extra" min="0" step="1000" value="0"></label><label>Estrategia<select id="strategy-method"><option value="avalanche">Avalancha: tasa más alta primero</option><option value="snowball">Bola de nieve: saldo menor primero</option></select></label></div><p class="hint">El pago extra es adicional a las cuotas que cargaste. No uses todo tu margen sin reservar dinero para gastos esenciales e imprevistos.</p><div id="strategy-result"></div>';
 const extra=document.getElementById('strategy-extra'),method=document.getElementById('strategy-method'),result=document.getElementById('strategy-result');
 function calc(){
  if(!debts.length){result.innerHTML='<p class="hint">Registrá tus deudas para construir una estrategia.</p>';return}
  if(debts.some(d=>!Number(d.payment))){result.innerHTML='<p class="hint">Completá el pago mensual previsto de todas las deudas antes de simular. No se puede estimar un plazo confiable con cuotas faltantes.</p>';return}
  const amount=Math.max(0,Number(extra.value)||0),type=method.value;
  const a=simulate(debts,amount,type);
  if(a.error){result.innerHTML='<p class="red">'+esc(a.error)+'</p>';return}
  const alternative=simulate(debts,amount,type==='avalanche'?'snowball':'avalanche');
  const over=debts.filter(d=>d.status==='overdue').length;
  let note=over?'<p class="hint"><b>Prioridad:</b> tenés '+over+' deuda(s) marcadas como vencidas. Antes de aplicar una estrategia, verificá mora, consecuencias y condiciones de regularización.</p>':'';
  if(incomes<=0)note+='<p class="hint">Faltan ingresos registrados este mes: el sistema no puede verificar si este pago es sostenible.</p>';
  else if(amount>margin)note+='<p class="red">El pago extra supera el margen estimado del mes. Ajustalo antes de comprometerte.</p>';
  const order=[...debts].sort((a,b)=>type==='avalanche'?(+b.rate||0)-(+a.rate||0):(+a.balance)-(+b.balance));
  result.innerHTML='<div class="cols" style="margin-top:18px"><div class="card"><small>Plazo estimado</small><div class="number green">'+a.months+' meses</div><p class="hint">Intereses aproximados: '+fmt(a.interest)+'</p></div><div class="card"><small>Comparación con la otra estrategia</small><div class="number">'+(alternative.error?'No calculable':alternative.months+' meses')+'</div><p class="hint">'+(alternative.error?esc(alternative.error):'Intereses aproximados: '+fmt(alternative.interest))+'</p></div></div>'+note+'<h3 style="margin-top:18px">Orden orientativo de atención</h3><div class="list">'+order.map((d,i)=>'<div class="item"><div><b>'+(i+1)+'. '+esc(d.name)+'</b><div class="meta">Tasa anual '+(+d.rate||0)+'% · Cuota '+fmt(d.payment)+'</div></div><b>'+fmt(d.balance)+'</b></div>').join('')+'</div><p class="hint">Cálculo simplificado con interés mensual de tasa anual / 12, tasas constantes, pagos al fin de mes y redirección de cuotas liberadas. No incluye impuestos, UVA, punitorios, seguros ni cambios de tasa. La estrategia por tasa alta suele minimizar intereses; la de saldo pequeño puede facilitar avances visibles.</p>';
 }
 extra.oninput=calc;method.onchange=calc;calc();
}
const button=document.getElementById('strategy-refresh');if(button)button.onclick=render;
render();
})();