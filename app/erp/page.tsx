'use client';
import Link from 'next/link';

const groups=[
 {title:'Dagelijks werk',items:[
  {href:'/dashboard-pro',icon:'🏠',name:'Dashboard Pro',text:'Live KPI’s, meldingen en snelle acties.'},
  {href:'/planning-pro',icon:'📅',name:'Planning Pro',text:'Afspraken, monteurs en dagplanning.'},
  {href:'/werkbonnen',icon:'🔧',name:'Werkbonnen Pro',text:'Uitvoering, uren, materialen en ondertekening.'}
 ]},
 {title:'Relaties & administratie',items:[
  {href:'/',icon:'👥',name:'Klanten & documenten',text:'CRM, offertes, facturen, uren en uitgaven.'},
  {href:'/contracten',icon:'📝',name:'Contractbeheer',text:'Onderhoudscontracten en periodieke planning.'},
  {href:'/rapportages',icon:'📊',name:'Rapportages Pro',text:'Financiële en operationele analyses.'}
 ]},
 {title:'Materieel & voorraad',items:[
  {href:'/magazijn',icon:'📦',name:'Magazijnbeheer',text:'Voorraad, leveranciers, inkoop en mutaties.'}
 ]}
];

export default function Erp(){
 return <main className="page">
  <header><div><small>KlusHulp Noord · Administratie v7</small><h1>ERP Startcentrum</h1><p>Alle bedrijfsmodules vanaf één overzichtelijke plek.</p></div><Link className="primary" href="/dashboard-pro">Open Dashboard Pro</Link></header>
  {groups.map(g=><section key={g.title}><h2>{g.title}</h2><div className="grid">{g.items.map(x=><Link className="card" href={x.href} key={x.href}><span className="icon">{x.icon}</span><div><h3>{x.name}</h3><p>{x.text}</p></div><b>Open →</b></Link>)}</div></section>)}
  <section className="status"><div><b>Administratie v7</b><span>Planning, magazijn, werkbonnen, contracten, rapportages en Dashboard Pro zijn gekoppeld.</span></div><Link href="/rapportages">Bekijk bedrijfsresultaten</Link></section>
  <style jsx>{`main{min-height:100vh;background:#f8fafc;padding:32px;color:#0f172a;display:grid;gap:26px}header{display:flex;justify-content:space-between;gap:20px;align-items:center}header h1{font-size:36px;margin:4px 0}header p,header small{color:#64748b}.primary,.status a{background:#0f172a;color:#fff;text-decoration:none;padding:12px 17px;border-radius:11px}section h2{font-size:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;text-decoration:none;color:inherit;box-shadow:0 6px 22px #0f172a08}.card:hover{transform:translateY(-2px);border-color:#94a3b8}.card h3{margin:0 0 6px}.card p{margin:0;color:#64748b}.icon{font-size:29px}.status{display:flex;justify-content:space-between;align-items:center;gap:20px;background:#dbeafe;border:1px solid #93c5fd;border-radius:16px;padding:20px}.status div{display:grid;gap:4px}.status span{color:#475569}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){main{padding:18px}header,.status{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}}`}</style>
 </main>
}