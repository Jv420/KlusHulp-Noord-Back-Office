import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
 return {
  name:'KlusHulp Noord Back Office',
  short_name:'KlusHulp Noord',
  description:'Mobiele administratie, planning, werkbonnen, facturatie en bedrijfsbeheer voor KlusHulp Noord.',
  start_url:'/',
  display:'standalone',
  background_color:'#f7f7f2',
  theme_color:'#173f35',
  orientation:'portrait-primary',
  scope:'/',
  lang:'nl-NL',
  categories:['business','productivity','finance'],
  icons:[
   {src:'/icons/icon-192.svg',sizes:'192x192',type:'image/svg+xml',purpose:'any'},
   {src:'/icons/icon-512.svg',sizes:'512x512',type:'image/svg+xml',purpose:'any'},
   {src:'/icons/maskable-512.svg',sizes:'512x512',type:'image/svg+xml',purpose:'maskable'}
  ],
  shortcuts:[
   {name:'Werkbonnen',short_name:'Werkbonnen',url:'/werkbonnen',icons:[{src:'/icons/icon-192.svg',sizes:'192x192',type:'image/svg+xml'}]},
   {name:'Planning',short_name:'Planning',url:'/planning',icons:[{src:'/icons/icon-192.svg',sizes:'192x192',type:'image/svg+xml'}]},
   {name:'Facturatie',short_name:'Facturatie',url:'/facturatie',icons:[{src:'/icons/icon-192.svg',sizes:'192x192',type:'image/svg+xml'}]},
   {name:'Voorraad',short_name:'Voorraad',url:'/voorraad',icons:[{src:'/icons/icon-192.svg',sizes:'192x192',type:'image/svg+xml'}]}
  ]
 };
}
