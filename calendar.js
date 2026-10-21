(()=>{
'use strict';
const root=document.getElementById('payment-calendar');
if(!root)return;
const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
let offset=0;
const monthKey=(y,m)=>y+'-'+pad(m+1);
const dateStr=(y,m,d)=>y+'-'+pad(m+1)+'-'+pad(d);
const now=new Date();
function renderCalendar(){
 const d=new Date(now.getFullYear(),now.getMonth()+offset,1),y=d.getFullYear(),m=d.getMonth(),days=new Date(y,m+1,0).getDate(),start=(d.getDay()+6)%7;
 const key=monthKey(y,m);
 const entries=state.debts.filter(x=>Number(x.balance)>0&&x.due&&/^\d{4}-\d{2}-\d{2}$/.test(x.due)).map(x=>({...x,amount:Number(x.payment)||0}));
 const dueThisMonth=entries.filter(x=>x.due.slice(0,7)===key);
 const dueUndated=state.debts.filter(x=>Number(x.balance)>0&&!x.due);
 const scheduled=dueThisMonth.reduce((a,x)=>a+x.amount,0);
 const monthly=state.moves.filter(x=>x.date?.slice(0,7)===key);
 const income=monthly.filter(x=>x.type==='income').reduce((a,x)=>a+(Number(x.amount)||0),0);
 const expenses=monthly.filter(x=>x.type==='expense').reduce((a,x)=>a+(Number(x.amount)||0),0);
 const deficit=income-expenses-scheduled;
 let html='<div class="row"><h2>Calendario de vencimientos</h2><div class="actions"><button id="cal-prev" type="button" aria-label="Mes anterior">←</button><b>'+esc(d.toLocaleDateString('es-AR',{month:'long',year:'numeric'}))+'</b><button id="cal-next" type="button" aria-label="Mes siguiente">→</button></div></div>';
 html+='<p class="hint">Se muestran las fechas de vencimiento que cargaste en Deudas. No se realizan pagos ni se generan cuotas automáticamente.</p>';
 html+='<div class="calendar-grid">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>'<div class="cal-week">'+x+'</div>').join('');
 for(let i=0;i<start;i++)html+='<div class="cal-empty"></div>';
 for(let day=1;day<=days;day++){
  const dayKey=dateStr(y,m,day),items=dueThisMonth.filter(x=>x.due===dayKey),isPast=dayKey<new Date().toLocaleDateString('en-CA');
  html+='<div class="cal-day'+(items.length?' cal-due':'')+'"><strong>'+day+'</strong>'+items.map(x=>'<div class="cal-entry" title="'+esc(x.name)+'">'+esc(x.name)+'<span>'+fmt(x.amount)+'</span>'+(x.status==='overdue'||isPast?'<em>Revisar vencimiento</em>':'')+'</div>').join('')+'</div>';
 }
 html+='</div><div class="cols" style="margin-top:18px"><div class="card"><small>Pagos con fecha este mes</small><div class="number">'+fmt(scheduled)+'</div><p class="hint">'+dueThisMonth.length+' vencimiento(s) registrados</p></div><div class="card"><small>Margen estimado del mes</small><div class="number '+(deficit<0?'red':'green')+'">'+fmt(deficit)+'</div><p class="hint">Ingresos menos gastos y pagos con fecha del mes. No incluye deudas sin vencimiento.</p></div></div>';
 if(dueUndated.length)html+='<p class="hint"><b>Atención:</b> '+dueUndated.length+' deuda(s) no tienen fecha de vencimiento. Completalas para que aparezcan en el calendario.</p>';
 const priority=[...entries].filter(x=>x.due<=dateStr(y,m,days)&&x.balance>0).sort((a,b)=>a.due.localeCompare(b.due)||Number(b.rate)-Number(a.rate));
 html+='<h3 style="margin-top:20px">Orden sugerido de revisión</h3><div class="list">'+(priority.slice(0,8).map((x,i)=>'<div class="item"><div><b>'+(i+1)+'. '+esc(x.name)+'</b><div class="meta">Vence '+esc(x.due)+' · Saldo '+fmt(x.balance)+'</div></div><b>'+fmt(x.amount)+'</b></div>').join('')||'<p class="hint">No hay compromisos con fecha registrada hasta este mes.</p>')+'</div>';
 html+='<p class="hint">Priorizá servicios esenciales y vencimientos con consecuencias importantes. Entre deudas comparables, revisá intereses y cargos. El calendario muestra fechas registradas, no predice cuotas futuras ni reemplaza acuerdos con acreedores.</p>';
 root.innerHTML=html;
 document.getElementById('cal-prev').onclick=()=>{offset--;renderCalendar()};
 document.getElementById('cal-next').onclick=()=>{offset++;renderCalendar()};
}
const original=window.render;
if(typeof original==='function')window.render=function(){original();renderCalendar()};
const originalShow=window.show;
if(typeof originalShow==='function')window.show=function(tab){originalShow(tab);if(tab==='calendario')renderCalendar()};
renderCalendar();
})();