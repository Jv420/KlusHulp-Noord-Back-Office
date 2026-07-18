'use client';

import Link from 'next/link';
import {useState} from 'react';

const modules=[
 {href:'/',label:'Dashboard',icon:'🏠'},
 {href:'/facturatie',label:'Facturatie Pro',icon:'🧾'},
 {href:'/werkbonnen',label:'Werkbonnen Pro',icon:'🛠️'},
 {href:'/voertuigen',label:'Voertuigen Pro',icon:'🚐'},
 {href:'/voorraad',label:'Voorraad',icon:'📦'},
 {href:'/planning',label:'Planning',icon:'📅'},
 {href:'/beheer',label:'ZZP Beheer',icon:'⚙️'}
];

export default function ModuleLauncher(){
 const [open,setOpen]=useState(false);
 return <>
  <button className="khn-launcher-button" aria-label="Open modules" aria-expanded={open} onClick={()=>setOpen(!open)}>☰ <span>Modules</span></button>
  {open&&<div className="khn-launcher-backdrop" onClick={()=>setOpen(false)}>
   <nav className="khn-launcher-panel" aria-label="KlusHulp Noord modules" onClick={e=>e.stopPropagation()}>
    <div className="khn-launcher-head"><div><strong>KlusHulp Noord</strong><small>Back Office v9.4</small></div><button onClick={()=>setOpen(false)} aria-label="Sluiten">×</button></div>
    <div className="khn-launcher-grid">{modules.map(m=><Link key={m.href} href={m.href} onClick={()=>setOpen(false)}><span>{m.icon}</span><b>{m.label}</b></Link>)}</div>
   </nav>
  </div>}
  <style jsx global>{`
   .khn-launcher-button{position:fixed;right:18px;bottom:18px;z-index:9998;border:0;border-radius:999px;padding:13px 17px;background:#173f35;color:#fff;font:700 14px system-ui;box-shadow:0 12px 30px #0003;cursor:pointer}
   .khn-launcher-backdrop{position:fixed;inset:0;z-index:9999;background:#0f172a99;display:flex;align-items:flex-end;justify-content:center;padding:16px}
   .khn-launcher-panel{width:min(720px,100%);background:#fff;border-radius:22px;padding:18px;box-shadow:0 24px 70px #0005;margin-bottom:max(0px,env(safe-area-inset-bottom))}
   .khn-launcher-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;color:#17202a}
   .khn-launcher-head strong{display:block;font-size:20px}.khn-launcher-head small{display:block;color:#667085;margin-top:2px}
   .khn-launcher-head button{border:0;background:#eef2f0;border-radius:50%;width:38px;height:38px;font-size:24px;cursor:pointer;color:#173f35}
   .khn-launcher-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
   .khn-launcher-grid a{display:flex;align-items:center;gap:11px;padding:14px;border:1px solid #dfe7e3;border-radius:14px;text-decoration:none;color:#173f35;background:#f8faf9}
   .khn-launcher-grid a:hover{background:#edf5f1;border-color:#9fc2b3}.khn-launcher-grid span{font-size:22px}
   @media(min-width:720px){.khn-launcher-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.khn-launcher-panel{margin-bottom:18px}.khn-launcher-button{right:26px;bottom:26px}}
  `}</style>
 </>;
}
