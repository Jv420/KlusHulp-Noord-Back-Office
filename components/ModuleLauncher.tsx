'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';

type MenuItem={href?:string;legacyLabel?:string;label:string;icon:string;group:'Werkruimte'|'Administratie'|'Beheer'};

const menu:MenuItem[]=[
 {href:'/',legacyLabel:'Dashboard',label:'Dashboard',icon:'⌂',group:'Werkruimte'},
 {legacyLabel:'Klanten',label:'Klanten',icon:'👥',group:'Werkruimte'},
 {href:'/planning',label:'Planning',icon:'📅',group:'Werkruimte'},
 {href:'/werkbonnen',label:'Werkbonnen',icon:'🛠',group:'Werkruimte'},
 {href:'/offertes',label:'Offertes',icon:'📄',group:'Administratie'},
 {href:'/facturen',label:'Facturen',icon:'🧾',group:'Administratie'},
 {href:'/voorraad',label:'Voorraad',icon:'📦',group:'Administratie'},
 {href:'/voertuigen',label:'Voertuigen',icon:'🚐',group:'Administratie'},
 {href:'/rapportages',label:'Rapportages',icon:'📊',group:'Administratie'},
 {legacyLabel:'Urenregistratie',label:'Urenregistratie',icon:'⏱',group:'Beheer'},
 {legacyLabel:'Uitgaven',label:'Kosten & uitgaven',icon:'💶',group:'Beheer'},
 {href:'/beheer',label:'ZZP-beheer',icon:'👤',group:'Beheer'},
 {legacyLabel:'Instellingen',label:'Instellingen',icon:'⚙',group:'Beheer'}
];

const titles:Record<string,string>={
 '/':'Dashboard','/planning':'Planning','/werkbonnen':'Werkbonnen','/offertes':'Offertes','/facturen':'Facturen','/facturatie':'Betalingen & herinneringen','/voorraad':'Voorraad','/voertuigen':'Voertuigen','/rapportages':'Rapportages','/beheer':'ZZP-beheer'
};

export default function ModuleLauncher(){
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 const [legacyActive,setLegacyActive]=useState('Dashboard');
 const [searchOpen,setSearchOpen]=useState(false);
 const [query,setQuery]=useState('');

 useEffect(()=>{document.body.classList.add('khn-v10-shell');return()=>document.body.classList.remove('khn-v10-shell')},[]);
 useEffect(()=>{setOpen(false);setSearchOpen(false);setLegacyActive(pathname==='/'?'Dashboard':'')},[pathname]);

 function openLegacy(label:string){
  if(pathname!=='/'){location.href=label==='Dashboard'?'/':`/?view=${encodeURIComponent(label)}`;return}
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.shell>aside nav button'));
  const target=buttons.find(button=>button.textContent?.trim().toLowerCase()===label.toLowerCase());
  if(target){target.click();setLegacyActive(label);setOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
 }

 const pageTitle=pathname==='/'?legacyActive:(titles[pathname]||pathname.startsWith('/facturatie/document/')?'Documentweergave':'Back Office');
 const results=useMemo(()=>query.trim()?menu.filter(item=>item.label.toLowerCase().includes(query.toLowerCase())):menu,[query]);
 const active=(item:MenuItem)=>item.legacyLabel?pathname==='/'&&legacyActive===item.legacyLabel:!!item.href&&(item.href==='/'?pathname==='/'&&legacyActive==='Dashboard':pathname.startsWith(item.href));

 function MenuEntry({item}:{item:MenuItem}){
  const cls=active(item)?'active':'';
  if(item.legacyLabel)return <button className={cls} onClick={()=>openLegacy(item.legacyLabel!)}><i>{item.icon}</i><span>{item.label}</span></button>;
  return <Link className={cls} href={item.href!}><i>{item.icon}</i><span>{item.label}</span></Link>;
 }

 return <>
  <header className="khn-topbar">
   <button className="khn-mobile-menu" onClick={()=>setOpen(true)} aria-label="Menu openen">☰</button>
   <div className="khn-breadcrumb"><small>KlusHulp Noord /</small><b>{pageTitle}</b></div>
   <button className="khn-search-trigger" onClick={()=>setSearchOpen(!searchOpen)} aria-label="Zoeken">⌕ <span>Zoeken</span></button>
   <Link className="khn-quick" href="/werkbonnen">+ Nieuwe werkbon</Link>
   <div className="khn-profile"><span>JV</span><div><b>Jochem</b><small>Eigenaar</small></div></div>
  </header>
  {searchOpen&&<div className="khn-global-search"><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek een onderdeel..."/><div>{results.map(item=><div key={item.label}><MenuEntry item={item}/></div>)}</div></div>}
  {open&&<button className="khn-sidebar-backdrop" onClick={()=>setOpen(false)} aria-label="Menu sluiten"/>}
  <aside className={`khn-official-sidebar ${open?'open':''}`}>
   <div className="khn-brand"><div className="khn-mark">KHN</div><div><strong>KlusHulp Noord</strong><small>Back Office v10</small></div><button onClick={()=>setOpen(false)} aria-label="Sluiten">×</button></div>
   <nav aria-label="Hoofdnavigatie">
    {(['Werkruimte','Administratie','Beheer'] as const).map(group=><div className="khn-nav-group" key={group}><span className="khn-section">{group}</span>{menu.filter(item=>item.group===group).map(item=><MenuEntry item={item} key={item.label}/>)}</div>)}
   </nav>
   <div className="khn-sidebar-footer"><div className="khn-status-dot"/><div><b>Systeem online</b><small>PWA · mobiel · desktop</small></div></div>
  </aside>
  <style jsx global>{`
   :root{--khn-sidebar:252px;--khn-topbar:72px;--khn-green:#173f35;--khn-green-dark:#102f28;--khn-yellow:#f5c400}
   .khn-official-sidebar{position:fixed;inset:0 auto 0 0;width:var(--khn-sidebar);z-index:9000;background:var(--khn-green-dark);color:#fff;display:flex;flex-direction:column;padding:18px 14px;box-shadow:8px 0 30px #0f172a18;font-family:Inter,system-ui,sans-serif}
   .khn-brand{display:flex;align-items:center;gap:11px;padding:5px 7px 22px;border-bottom:1px solid #ffffff18}.khn-brand strong,.khn-brand small{display:block}.khn-brand strong{font-size:15px}.khn-brand small{margin-top:3px;color:#b7cbc4;font-size:11px}.khn-brand>button{display:none;margin-left:auto;border:0;background:transparent;color:#fff;font-size:26px}.khn-mark{width:43px;height:43px;border-radius:13px;background:var(--khn-yellow);color:#17211e;display:grid;place-items:center;font-weight:900;font-size:13px}
   .khn-official-sidebar nav{display:flex;flex-direction:column;padding:10px 0;overflow:auto}.khn-nav-group{display:flex;flex-direction:column;gap:4px}.khn-section{padding:15px 12px 6px;color:#8eb0a5;text-transform:uppercase;letter-spacing:.09em;font-size:10px;font-weight:800}.khn-official-sidebar nav a,.khn-official-sidebar nav button{display:flex;align-items:center;gap:12px;width:100%;border:0;color:#dce9e5;text-decoration:none;padding:11px 12px;border-radius:11px;font:650 14px Inter,system-ui,sans-serif;background:transparent;cursor:pointer;text-align:left}.khn-official-sidebar nav i{width:23px;text-align:center;font-style:normal;font-size:17px}.khn-official-sidebar nav a:hover,.khn-official-sidebar nav button:hover{background:#ffffff0f;color:#fff}.khn-official-sidebar nav .active{background:var(--khn-yellow);color:#17211e;box-shadow:0 8px 22px #0002}
   .khn-sidebar-footer{margin-top:auto;border-top:1px solid #ffffff18;padding:16px 10px 5px;display:flex;align-items:center;gap:10px}.khn-sidebar-footer b,.khn-sidebar-footer small{display:block}.khn-sidebar-footer b{font-size:12px}.khn-sidebar-footer small{font-size:10px;color:#9db8af;margin-top:2px}.khn-status-dot{width:9px;height:9px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 4px #4ade8022}
   .khn-topbar{position:fixed;top:0;left:var(--khn-sidebar);right:0;height:var(--khn-topbar);z-index:8500;display:flex;align-items:center;gap:16px;padding:0 24px;background:#fff;border-bottom:1px solid #e3e8e6;box-shadow:0 4px 18px #0f172a08;font-family:Inter,system-ui,sans-serif}.khn-breadcrumb{display:flex;align-items:center;gap:7px;margin-right:auto}.khn-breadcrumb small{color:#86938e}.khn-breadcrumb b{color:#17211e}.khn-search-trigger,.khn-quick{border:1px solid #dce4e1;border-radius:10px;background:#fff;color:#34433e;padding:10px 13px;text-decoration:none;font-weight:700;cursor:pointer}.khn-quick{background:var(--khn-green);color:#fff;border-color:var(--khn-green)}.khn-profile{display:flex;align-items:center;gap:9px;border-left:1px solid #e3e8e6;padding-left:16px}.khn-profile>span{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#e8f0ed;color:var(--khn-green);font-weight:900}.khn-profile b,.khn-profile small{display:block}.khn-profile b{font-size:13px}.khn-profile small{font-size:10px;color:#74827d}
   .khn-global-search{position:fixed;top:62px;right:210px;width:min(430px,calc(100vw - 32px));z-index:9200;background:#fff;border:1px solid #dfe6e3;border-radius:16px;padding:12px;box-shadow:0 24px 60px #0f172a30}.khn-global-search input{width:100%;box-sizing:border-box;border:1px solid #ccd7d3;border-radius:10px;padding:12px;font:inherit;margin-bottom:8px}.khn-global-search>div{max-height:360px;overflow:auto}.khn-global-search>div>div a,.khn-global-search>div>div button{display:flex;width:100%;align-items:center;gap:10px;border:0;background:#fff;color:#24332e;text-decoration:none;padding:10px;border-radius:9px;cursor:pointer;text-align:left}.khn-global-search i{font-style:normal;width:24px}
   .khn-mobile-menu,.khn-sidebar-backdrop{display:none}
   body.khn-v10-shell{padding-left:var(--khn-sidebar)!important;padding-top:var(--khn-topbar)!important;background:#f3f5f4!important;overflow-x:hidden}
   body.khn-v10-shell .shell{display:block!important;grid-template-columns:1fr!important;width:100%!important;max-width:none!important;min-height:calc(100vh - var(--khn-topbar))!important}
   body.khn-v10-shell .shell>aside{display:none!important}
   body.khn-v10-shell .shell>main{display:block!important;margin:0!important;padding:28px 32px!important;width:100%!important;max-width:none!important;min-width:0!important}
   body.khn-v10-shell .shell>main>header{display:none!important}
   body.khn-v10-shell .shell>main>section{width:100%!important;max-width:1440px!important;margin-left:auto!important;margin-right:auto!important}
   @media(max-width:1100px){:root{--khn-sidebar:230px}body.khn-v10-shell .shell>main{padding:22px!important}}
   @media(max-width:900px){body.khn-v10-shell{padding-left:0!important;padding-top:58px!important}.khn-topbar{left:0;height:58px;padding:0 12px 0 62px}.khn-breadcrumb small,.khn-search-trigger span,.khn-quick,.khn-profile div{display:none}.khn-profile{padding-left:8px}.khn-official-sidebar{transform:translateX(-105%);transition:transform .22s ease;width:min(290px,88vw)}.khn-official-sidebar.open{transform:translateX(0)}.khn-brand>button{display:block}.khn-mobile-menu{display:grid;place-items:center;position:fixed;top:8px;left:12px;z-index:8999;width:42px;height:42px;border:0;border-radius:11px;background:var(--khn-green);color:#fff;font-size:20px;box-shadow:0 6px 20px #0003}.khn-sidebar-backdrop{display:block;position:fixed;inset:0;z-index:8998;border:0;background:#0f172a88}.khn-global-search{top:64px;right:16px}body.khn-v10-shell .shell>main{padding:16px!important}}
  `}</style>
 </>;
}
