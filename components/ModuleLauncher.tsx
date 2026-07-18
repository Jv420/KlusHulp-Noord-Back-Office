'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';

const menu=[
 {href:'/',label:'Dashboard',icon:'⌂'},
 {href:'/?view=customers',label:'Klanten',icon:'👥'},
 {href:'/planning',label:'Planning',icon:'📅'},
 {href:'/werkbonnen',label:'Werkbonnen',icon:'🛠'},
 {href:'/facturatie',label:'Offertes & facturen',icon:'🧾'},
 {href:'/voorraad',label:'Voorraad',icon:'📦'},
 {href:'/voertuigen',label:'Voertuigen',icon:'🚐'},
 {href:'/beheer',label:'ZZP-beheer',icon:'👤'}
];

export default function ModuleLauncher(){
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 useEffect(()=>{document.body.classList.add('khn-v10-shell');return()=>document.body.classList.remove('khn-v10-shell')},[]);
 useEffect(()=>setOpen(false),[pathname]);
 const active=(href:string)=>href==='/'?pathname==='/':href.startsWith('/?')?pathname==='/':pathname.startsWith(href);
 return <>
  <button className="khn-mobile-menu" onClick={()=>setOpen(true)} aria-label="Menu openen">☰</button>
  {open&&<button className="khn-sidebar-backdrop" onClick={()=>setOpen(false)} aria-label="Menu sluiten"/>}
  <aside className={`khn-official-sidebar ${open?'open':''}`}>
   <div className="khn-brand"><div className="khn-mark">KHN</div><div><strong>KlusHulp Noord</strong><small>Back Office v10</small></div><button onClick={()=>setOpen(false)} aria-label="Sluiten">×</button></div>
   <nav aria-label="Hoofdnavigatie">
    <span className="khn-section">Werkruimte</span>
    {menu.slice(0,4).map(item=><Link className={active(item.href)?'active':''} href={item.href} key={item.href}><i>{item.icon}</i><span>{item.label}</span></Link>)}
    <span className="khn-section">Administratie</span>
    {menu.slice(4).map(item=><Link className={active(item.href)?'active':''} href={item.href} key={item.href}><i>{item.icon}</i><span>{item.label}</span></Link>)}
   </nav>
   <div className="khn-sidebar-footer"><div className="khn-status-dot"/><div><b>PWA gereed</b><small>Mobiel en desktop</small></div></div>
  </aside>
  <style jsx global>{`
   :root{--khn-sidebar:270px;--khn-green:#173f35;--khn-yellow:#f5c400}
   .khn-official-sidebar{position:fixed;inset:0 auto 0 0;width:var(--khn-sidebar);z-index:9000;background:#102f28;color:#fff;display:flex;flex-direction:column;padding:18px 14px;box-shadow:8px 0 30px #0f172a18;font-family:Inter,system-ui,sans-serif}
   .khn-brand{display:flex;align-items:center;gap:11px;padding:5px 7px 22px;border-bottom:1px solid #ffffff18}.khn-brand strong,.khn-brand small{display:block}.khn-brand strong{font-size:15px}.khn-brand small{margin-top:3px;color:#b7cbc4;font-size:11px}.khn-brand>button{display:none;margin-left:auto;border:0;background:transparent;color:#fff;font-size:26px}.khn-mark{width:43px;height:43px;border-radius:13px;background:var(--khn-yellow);color:#17211e;display:grid;place-items:center;font-weight:900;font-size:13px}
   .khn-official-sidebar nav{display:flex;flex-direction:column;gap:4px;padding:16px 0;overflow:auto}.khn-section{padding:15px 12px 6px;color:#8eb0a5;text-transform:uppercase;letter-spacing:.09em;font-size:10px;font-weight:800}.khn-official-sidebar nav a{display:flex;align-items:center;gap:12px;color:#dce9e5;text-decoration:none;padding:11px 12px;border-radius:11px;font-size:14px;font-weight:650}.khn-official-sidebar nav a i{width:23px;text-align:center;font-style:normal;font-size:17px}.khn-official-sidebar nav a:hover{background:#ffffff0f;color:#fff}.khn-official-sidebar nav a.active{background:var(--khn-yellow);color:#17211e;box-shadow:0 8px 22px #0002}
   .khn-sidebar-footer{margin-top:auto;border-top:1px solid #ffffff18;padding:16px 10px 5px;display:flex;align-items:center;gap:10px}.khn-sidebar-footer b,.khn-sidebar-footer small{display:block}.khn-sidebar-footer b{font-size:12px}.khn-sidebar-footer small{font-size:10px;color:#9db8af;margin-top:2px}.khn-status-dot{width:9px;height:9px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 4px #4ade8022}
   .khn-mobile-menu,.khn-sidebar-backdrop{display:none}
   body.khn-v10-shell{padding-left:var(--khn-sidebar)!important;background:#f3f5f4!important}
   body.khn-v10-shell>.shell,body.khn-v10-shell #__next>.shell{min-height:100vh}
   body.khn-v10-shell .shell>aside{display:none!important}
   body.khn-v10-shell .shell>main{margin-left:0!important;width:100%!important}
   @media(max-width:900px){
    body.khn-v10-shell{padding-left:0!important;padding-top:58px!important}
    .khn-official-sidebar{transform:translateX(-105%);transition:transform .22s ease;width:min(290px,88vw)}.khn-official-sidebar.open{transform:translateX(0)}.khn-brand>button{display:block}.khn-mobile-menu{display:grid;place-items:center;position:fixed;top:10px;left:12px;z-index:8999;width:42px;height:42px;border:0;border-radius:11px;background:var(--khn-green);color:#fff;font-size:20px;box-shadow:0 6px 20px #0003}.khn-sidebar-backdrop{display:block;position:fixed;inset:0;z-index:8998;border:0;background:#0f172a88}
   }
  `}</style>
 </>;
}
