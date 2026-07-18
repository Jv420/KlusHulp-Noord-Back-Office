'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';

const euro=(n:any)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(n||0));
const num=(n:any)=>new Intl.NumberFormat('nl-NL',{maximumFractionDigits:0}).format(Number(n||0));
const date=(v:any)=>v?new Date(v).toLocaleDateString('nl-NL'):'-';
const time=(v:any)=>v?new Date(v).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):'-';

export default function DashboardPro(){
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);const r=await fetch('/api/dashboard-pro',{cache:'no-store'}),j=await r.json();setLoading(false);if(!r.ok)setError(j.error||'Dashboard laden mislukt');else{setData(j);setError('')}}
 useEffect(()=>{load();const id=setInterval(load,60000);return()=>clearInterval(id)},[]);
 const maxRevenue=useMemo(()=>Math.max(1,...(data?.monthlyRevenue||[]).map((x:any)=>Number(x.value||0))),[data]);
 if(loading&&!data)return <main className="page"><h1>Dashboard Pro</h1><p>Laden...</p></main>;
 const k=data?.kpi||{};
 return <main className="page">
  <header><div><small>KlusHulp Noord · Administratie v7</small><h1>Dashboard Pro</h1><p>Alles wat vandaag aandacht nodig heeft op één plek.</p></div><div className="headerActions"><span>Laatst bijgewerkt: {data?.generated_at?new Date(data.generated_at).toLocaleTimeString('nl-NL'):'-'}</span><button onClick={load}>Vernieuwen</button></div></header>
  {error&&<div className="error">{error}</div>}
  <section className="quick"><Link href="/?new=customer">+ Klant</Link><Link href="/?new=invoice">+ Factuur</Link><Link href="/werkbonnen">+ Werkbon</Link><Link href="/planning-pro">+ Afspraak</Link><Link href="/contracten">+ Contract</Link><Link href="/magazijn">+ Voorraad</Link></section>
  <section className="stats">
   <Card title="Omzet vandaag" value={euro(k.revenue_today)}/><Card title="Omzet deze maand" value={euro(k.revenue_month)}/><Card title="Winst deze maand" value={euro(k.profit_month)}/><Card title="Omzet dit jaar" value={euro(k.revenue_year)}/>
   <Card title="Open facturen" value={num(k.open_invoices)} sub={euro(k.open_invoice_amount)}/><Card title="Open werkbonnen" value={num(k.open_work_orders)}/><Card title="Afspraken vandaag" value={num(k.appointments_today)}/><Card title="Lage voorraad" value={num(k.low_stock)}/>
  </section>
  <section className="mainGrid">
   <Panel title="Omzet laatste 12 maanden"><div className="chart">{(data?.monthlyRevenue||[]).map((x:any)=><div className="month" key={x.month}><div className="bar"><i style={{height:`${Math.max(3,Number(x.value)/maxRevenue*100)}%`}} title={euro(x.value)}/></div><span>{x.month.slice(5)}</span></div>)}</div></Panel>
   <Panel title="Meldingen"><div className="alerts">{(data?.alerts||[]).length?(data.alerts||[]).map((x:any,i:number)=><div className={'alert '+x.type} key={i}><b>{x.message}</b><span>{date(x.due_date)}</span></div>):<p>Geen urgente meldingen.</p>}</div></Panel>
  </section>
  <section className="triple">
   <Panel title="Planning vandaag"><List empty="Geen afspraken vandaag.">{(data?.todayAppointments||[]).map((x:any)=><div className="row" key={x.id}><div><b>{time(x.start_at)} · {x.title}</b><span>{x.customer_name||'Geen klant'} · {x.location||'-'}</span></div><Link href="/planning-pro">Open</Link></div>)}</List></Panel>
   <Panel title="Open werkbonnen"><List empty="Geen open werkbonnen.">{(data?.openWorkOrders||[]).map((x:any)=><div className="row" key={x.id}><div><b>{x.work_order_number} · {x.title}</b><span>{x.customer_name||'Geen klant'} · {x.assigned_to||'Geen monteur'}</span></div><Link href="/werkbonnen">Open</Link></div>)}</List></Panel>
   <Panel title="Voorraadwaarschuwingen"><List empty="Voorraad is op peil.">{(data?.lowStock||[]).map((x:any)=><div className="row" key={x.id}><div><b>{x.name}</b><span>{x.stock} {x.unit} · minimum {x.min_stock}</span></div><Link href="/magazijn">Open</Link></div>)}</List></Panel>
  </section>
  <section className="triple">
   <Panel title="Recente klanten"><List empty="Nog geen klanten.">{(data?.recentCustomers||[]).map((x:any)=><div className="row" key={x.id}><div><b>{x.name}</b><span>{x.city||'-'} · {x.phone||x.email||'-'}</span></div></div>)}</List></Panel>
   <Panel title="Recente documenten"><List empty="Nog geen documenten.">{(data?.recentDocuments||[]).map((x:any)=><div className="row" key={x.id}><div><b>{x.document_number||x.type}</b><span>{date(x.document_date)} · {x.status} · {euro(x.total)}</span></div></div>)}</List></Panel>
   <Panel title="Recente werkbonnen"><List empty="Nog geen werkbonnen.">{(data?.recentOrders||[]).map((x:any)=><div className="row" key={x.id}><div><b>{x.work_order_number}</b><span>{x.title} · {x.status}</span></div></div>)}</List></Panel>
  </section>
  <section className="summary"><Metric n="Totaal klanten" v={num(k.customers)}/><Metric n="Actieve contracten" v={num(k.active_contracts)}/><Metric n="Periodieke contractwaarde" v={euro(k.contract_value)}/><Metric n="Kosten deze maand" v={euro(k.costs_month)}/></section>
  <style jsx>{`main{padding:28px;display:grid;gap:18px;background:#f8fafc;min-height:100vh;color:#0f172a}header{display:flex;justify-content:space-between;gap:20px;align-items:center}header h1{margin:4px 0}header p,header small,.headerActions span{color:#64748b}.headerActions,.quick{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.quick a,button,.row a{padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;text-decoration:none;color:inherit;cursor:pointer}.quick a:first-child{background:#0f172a;color:#fff}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card,.panel,.summary{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:17px;box-shadow:0 5px 20px #0f172a08}.card{display:grid;gap:5px}.card b{font-size:25px}.card span,.row span{color:#64748b}.mainGrid{display:grid;grid-template-columns:2fr 1fr;gap:14px}.triple{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.panel h2{font-size:18px;margin:0 0 14px}.chart{height:220px;display:flex;align-items:end;gap:10px;border-bottom:1px solid #cbd5e1;padding:10px}.month{height:100%;flex:1;display:grid;grid-template-rows:1fr auto;gap:7px;text-align:center;font-size:12px}.bar{display:flex;align-items:end;height:100%}.bar i{display:block;width:100%;background:linear-gradient(180deg,#2563eb,#60a5fa);border-radius:8px 8px 2px 2px}.alerts,.list{display:grid;gap:8px}.alert,.row{display:flex;justify-content:space-between;gap:12px;padding:11px;border:1px solid #e2e8f0;border-radius:11px}.alert{display:grid}.alert.contract{background:#fff7ed}.alert.onderhoud,.alert.werkbon{background:#fef2f2}.row div{display:grid;gap:4px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{display:grid;gap:4px}.metric span{color:#64748b}.error{background:#fee2e2;padding:12px;border-radius:10px}@media(max-width:1100px){.stats,.summary{grid-template-columns:repeat(2,1fr)}.mainGrid,.triple{grid-template-columns:1fr}}@media(max-width:650px){main{padding:16px}header{align-items:flex-start;flex-direction:column}.stats,.summary{grid-template-columns:1fr}.headerActions{align-items:flex-start}}`}</style>
 </main>
}
function Card({title,value,sub}:{title:string,value:any,sub?:any}){return <article className="card"><span>{title}</span><b>{value}</b>{sub&&<small>{sub}</small>}</article>}
function Panel({title,children}:{title:string,children:any}){return <article className="panel"><h2>{title}</h2>{children}</article>}
function List({children,empty}:{children:any,empty:string}){return <div className="list">{Array.isArray(children)&&children.length?children:<p>{empty}</p>}</div>}
function Metric({n,v}:{n:string,v:any}){return <div className="metric"><span>{n}</span><b>{v}</b></div>}
