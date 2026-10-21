(()=>{
'use strict';
const root=document.getElementById('recurring-insights');
if(!root)return;
const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\b\d{2,}\b/g,' ').replace(/\s+/g,' ').trim();
function duplicates(move,others=state.moves){
 return others.filter(x=>x.id!==move.id&&x.type===move.type&&Math.abs(Number(x.amount)-Number(move.amount))<0.01&&x.date===move.date&&norm(x.description)===norm(move.description));
}
window.miBalanceDuplicates=duplicates;
function recurring(){
 const moves=state.moves.filter(x=>x.type==='expense'&&Number(x.amount)>0);
 const groups=new Map();
 moves.forEach(x=>{const k=norm(x.description);if(k.length<3)return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});
 const results=[];
 for(const [key,items] of groups){
  const months=new Map();
  items.forEach(x=>{const m=x.date?.slice(0,7);if(m){const prev=months.get(m);if(!prev||x.date>prev.date)months.set(m,x)}});
  if(months.size<2)continue;
  const ordered=[...months.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const gaps=[];for(let i=1;i<ordered.length;i++){const a=new Date(ordered[i-1].date+'T12:00:00'),b=new Date(ordered[i].date+'T12:00:00');gaps.push((b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth())}
  if(!gaps.some(g=>g===1)||gaps.some(g=>g>3))continue;
  const amounts=ordered.map(x=>Number(x.amount)).sort((a,b)=>a-b),mid=amounts[Math.floor(amounts.length/2)];
  if(ordered.some(x=>Math.abs(Number(x.amount)-mid)>Math.max(100,mid*.35)))continue;
  results.push({name:ordered.at(-1).description,amount:mid,count:months.size,last:ordered.at(-1).date,flagged:ordered.some(x=>x.frequency==='monthly')});
 }
 return results.sort((a,b)=>b.amount-a.amount);
}
function draw(){
 const rec=recurring(),monthly=state.moves.filter(x=>x.type==='expense'&&x.frequency==='monthly');
 const flagged=new Map(monthly.map(x=>[norm(x.description),x]));
 const combined=[...rec];for(const x of flagged.values())if(!combined.some(y=>norm(y.name)===norm(x.description)))combined.push({name:x.description,amount:Number(x.amount),count:1,last:x.date,flagged:true});
 const sum=combined.reduce((a,x)=>a+x.amount,0);
 const duplicatesList=[];const seen=new Set();
 for(const x of state.moves){const k=x.type+'|'+x.date+'|'+Number(x.amount).toFixed(2)+'|'+norm(x.description);if(seen.has(k))duplicatesList.push(x);seen.add(k)}
 root.innerHTML='<div class="row"><h2>Gastos recurrentes y control de duplicados</h2><button id="rec-refresh" type="button">Actualizar análisis</button></div><p class="hint">Detección local orientativa. Los pagos marcados como mensuales no se crean de nuevo automáticamente.</p><div class="grid" style="margin:15px 0"><div class="card"><small>Gasto mensual identificado</small><div class="number">'+fmt(sum)+'</div></div><div class="card"><small>Proyección anual simple</small><div class="number">'+fmt(sum*12)+'</div></div><div class="card"><small>Conceptos recurrentes</small><div class="number">'+combined.length+'</div></div><div class="card"><small>Posibles duplicados</small><div class="number">'+duplicatesList.length+'</div></div></div><h3>Pagos habituales</h3><div class="list">'+(combined.map(x=>'<div class="item"><div><b>'+esc(x.name)+'</b><div class="meta">'+(x.count>1?'Detectado en '+x.count+' meses':'Marcado como mensual')+' · Último registro '+esc(x.last)+'</div></div><b>'+fmt(x.amount)+'/mes</b></div>').join('')||'<p class="hint">Todavía no hay suficiente historial para detectar recurrencias. Marcá los gastos habituales como “Mensual” al registrarlos.</p>')+'</div><h3 style="margin-top:22px">Posibles registros duplicados</h3><div class="list">'+(duplicatesList.slice(0,15).map(x=>'<div class="item"><div><b>'+esc(x.description)+'</b><div class="meta">'+esc(x.date)+' · '+fmt(x.amount)+'</div></div><span class="hint">Revisar</span></div>').join('')||'<p class="hint">No se encontraron coincidencias exactas de fecha, importe y descripción.</p>')+'</div><p class="hint">Una coincidencia no significa necesariamente que sea un error. Verificá cada caso en Movimientos antes de borrar algo.</p>';
 document.getElementById('rec-refresh').onclick=draw;
}
window.miBalanceRefreshInsights=draw;
draw();
})();