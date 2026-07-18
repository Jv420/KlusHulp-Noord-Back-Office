'use client';
import {useEffect,useState} from 'react';

const money=(v:any)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(v||0));
const currentQuarter=()=>Math.floor(new Date().getMonth()/3)+1;

export default function RapportagePage(){
 const [year,setYear]=useState(new Date().getFullYear()),[quarter,setQuarter]=useState(currentQuarter()),[data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);const r=await fetch(`/api/facturatie/rapportage?year=${year}&quarter=${quarter}`,{cache:'no-store'}),j=await r.json();setLoading(false);if(!r.ok)setError(j.error||'Rapportage laden mislukt');else{setData(j);setError('')}}
 useEffect(()=>{load()},[year,quarter]);
 const years=Array.from({length:7},(_,i)=>new Date().getFullYear()-3+i);
 return <main className="wrap">
  <header><div><small>KlusHulp Noord ERP v8.5</small><h1>BTW & Omzetrapportage</h1><p>Kwartaaloverzicht voor omzet, verschuldigde BTW, creditfacturen en openstaande posten.</p></div><div className="actions"><a href="/facturatie">Facturatie</a><a className="export" href={`/api/facturatie/rapportage/csv?year=${year}&quarter=${quarter}`}>CSV exporteren</a></div></header>
  <section className="filters"><label>Jaar<select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Kwartaal<select value={quarter} onChange={e=>setQuarter(Number(e.target.value))}>{[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}</select></label></section>
  {error&&<div className="error">{error}</div>}
  {loading?<p>Laden…</p>:data&&<>
   <section className="stats"><Stat label="Omzet excl. BTW" value={money(data.summary.omzet_ex)}/><Stat label="Verschuldigde BTW" value={money(data.summary.btw_verkoop)}/><Stat label="Omzet incl. BTW" value={money(data.summary.omzet_incl)}/><Stat label="Openstaand totaal" value={money(data.summary.openstaand)}/><Stat label="Te laat" value={String(data.summary.te_laat)}/></section>
   <section className="grid"><article className="card"><h2>BTW per tarief</h2><div className="table"><div className="tr head"><span>Tarief</span><span>Grondslag</span><span>BTW</span></div>{data.vat.length?data.vat.map((x:any)=><div className="tr" key={x.vat_rate}><span>{Number(x.vat_rate)}%</span><span>{money(x.taxable)}</span><span>{money(x.vat)}</span></div>):<p>Geen facturen in deze periode.</p>}</div></article>
   <article className="card"><h2>Per maand</h2><div className="table"><div className="tr head"><span>Maand</span><span>Omzet incl.</span><span>BTW</span></div>{data.monthly.length?data.monthly.map((x:any)=><div className="tr" key={x.month}><span>{x.month}</span><span>{money(x.revenue)}</span><span>{money(x.vat)}</span></div>):<p>Geen omzet in deze periode.</p>}</div></article></section>
   <section className="card note"><h2>Aangiftecontrole</h2><p>Facturen: <b>{data.summary.facturen}</b> · Creditfacturen: <b>{data.summary.creditfacturen}</b></p><p>Dit overzicht is bedoeld als administratieve ondersteuning. Controleer de bedragen altijd met je boekhouding voordat je de BTW-aangifte indient.</p></section>
  </>}
  <style jsx>{`*{box-sizing:border-box}.wrap{max-width:1350px;margin:auto;padding:28px;background:#f4f6f8;min-height:100vh;color:#18212f}header{display:flex;justify-content:space-between;gap:20px;align-items:center}h1{font-size:36px;margin:4px 0}header p,small{color:#667085}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions a{padding:11px 15px;border-radius:10px;background:#172033;color:#fff;text-decoration:none;font-weight:800}.actions .export{background:#067647}.filters{display:flex;gap:12px;margin:22px 0}.filters label{display:grid;gap:6px;font-weight:700}.filters select{min-width:150px;border:1px solid #d0d5dd;border-radius:9px;padding:10px;background:#fff}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.stat,.card{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:18px;box-shadow:0 8px 24px #1018280a}.stat{display:grid;gap:5px}.stat b{font-size:22px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card h2{margin-top:0}.tr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:11px;border-bottom:1px solid #eee}.head{font-size:12px;color:#667085;font-weight:800}.note{margin-top:18px}.note p:last-child{color:#667085}.error{background:#fee4e2;color:#912018;padding:12px;border-radius:10px;margin:14px 0}@media(max-width:900px){header{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}}`}</style>
 </main>
}
function Stat({label,value}:{label:string,value:string}){return <article className="stat"><small>{label}</small><b>{value}</b></article>}
