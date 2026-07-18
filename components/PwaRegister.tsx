'use client';

import {useEffect,useState} from 'react';

type InstallPromptEvent=Event&{
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};

export default function PwaRegister(){
 const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
 const [online,setOnline]=useState(true);

 useEffect(()=>{
  setOnline(navigator.onLine);
  if('serviceWorker' in navigator){
   navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
  const onBeforeInstall=(event:Event)=>{
   event.preventDefault();
   setInstallPrompt(event as InstallPromptEvent);
  };
  const onOnline=()=>setOnline(true);
  const onOffline=()=>setOnline(false);
  window.addEventListener('beforeinstallprompt',onBeforeInstall);
  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  return()=>{
   window.removeEventListener('beforeinstallprompt',onBeforeInstall);
   window.removeEventListener('online',onOnline);
   window.removeEventListener('offline',onOffline);
  };
 },[]);

 async function install(){
  if(!installPrompt)return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  setInstallPrompt(null);
 }

 return <>
  {!online&&<div role="status" style={{position:'fixed',left:12,right:12,bottom:12,zIndex:9999,padding:'12px 16px',borderRadius:14,background:'#8a3b12',color:'white',boxShadow:'0 8px 30px rgba(0,0,0,.22)',fontWeight:700}}>Je werkt offline. Eerder geopende pagina&apos;s blijven beschikbaar; wijzigingen worden verzonden zodra je weer verbinding hebt.</div>}
  {installPrompt&&<button onClick={install} style={{position:'fixed',right:16,bottom:16,zIndex:9998,border:0,borderRadius:999,padding:'12px 18px',background:'#173f35',color:'white',fontWeight:800,boxShadow:'0 8px 30px rgba(0,0,0,.22)',cursor:'pointer'}}>Installeer app</button>}
 </>;
}
