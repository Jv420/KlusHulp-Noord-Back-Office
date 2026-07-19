'use client';

import {useEffect} from 'react';

export default function CustomerRouteBridge(){
 useEffect(()=>{
  function routeCustomers(event:MouseEvent){
   const target=event.target as HTMLElement|null;
   const button=target?.closest('button');
   if(!button)return;
   const label=button.textContent?.trim().toLowerCase();
   if(label==='klanten'){
    event.preventDefault();
    event.stopPropagation();
    window.location.href='/klanten';
   }
  }
  document.addEventListener('click',routeCustomers,true);
  return()=>document.removeEventListener('click',routeCustomers,true);
 },[]);
 return null;
}
