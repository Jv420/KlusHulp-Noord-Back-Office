'use client';

import {useEffect,useMemo,useState} from 'react';

type Customer={id:number;customer_number?:string;type?:string;status?:string;name?:string;company_name?:string;contact_person?:string;street?:string;house_number?:string;postal_code?:string;city?:string;country?:string;email?:string;secondary_email?:string;phone?:string;mobile?:string;website?:string;kvk?:string;vat_number?:string;iban?:string;payment_term?:number;vat_rate?:number;discount_percentage?:number;tags?:string;notes?:string;active?:number;color?:string};
type Data={customers?:Customer[];documents?:any[];appointments?:any[];time_entries?:any[]};

const emptyCustomer:Partial<Customer>={type:'particulier',status:'actief',country:'Nederland',payment_term:14,vat_rate:21,discount_percentage:0,active:1};

export default function CustomerWorkspace(){
 const [data,setData]=useState<Data>({});
 const [selectedId,setSelectedId]=useState<number|null>(null);
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('alle');
 const [editing,setEditing]=useState<Partial<Customer>|null>(null);
 const [loading,setLoading]=useState(true);

 async function load(){
  setLoading(true);
  const response=await fetch('/api/data',{cache:'no-store'});
  const next=await response.json();
  setData(next);
  setSelectedId(current=>current??next.customers?.[0]?.id??null);
  setLoading(false);
 }
 useEffect(()=>{load()},[]);

 const customers=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return (data.customers||[]).filter(customer=>{
   const matchesStatus=status==='alle'||(status==='inactief'?Number(customer.active)===0:customer.status===status);
   const matchesQuery=!needle||JSON.stringify(customer).toLowerCase().includes(needle);
   return matchesStatus&&matchesQuery;
  });
 },[data.customers,query,status]);
 const customer=(data.customers||[]).find(item=>item.id===selectedId)||null;

 async function saveCustomer(value:Partial<Customer>){
  const method=value.id?'PUT':'POST';
  const body=value.id?{table:'customers',id:value.id,data:value}:{table:'customers',data:value};
  const response=await fetch('/api/data',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){alert((await response.json()).error||'Opslaan mislukt');return}
  setEditing(null);
  await load();
 }

 if(loading)return <main className="customerWorkspace"><div className="customerLoading">Klanten laden…</div></main>;
 return <main className="customerWorkspace">
  <section className="customerPageHead">
   <div><span className="eyebrow">Relatiebeheer</span><h1>Klanten</h1><p>Alle contactgegevens, afspraken, uren, offertes en facturen per klant op één plek.</p></div>
   <button className="primaryAction" onClick={()=>setEditing({...emptyCustomer})}>+ Nieuwe klant</button>
  </section>

  <section className="customerKpis">
   <Kpi value={(data.customers||[]).length} label="Totaal"/>
   <Kpi value={(data.customers||[]).filter(c=>Number(c.active)!==0).length} label="Actief"/>
   <Kpi value={(data.customers||[]).filter(c=>c.type==='zakelijk').length} label="Zakelijk"/>
   <Kpi value={(data.customers||[]).filter(c=>c.status==='prospect').length} label="Prospects"/>
  </section>

  <section className="customerLayout">
   <aside className="customerListPanel">
    <div className="customerFilters"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Zoek naam, plaats, e-mail…"/><select value={status} onChange={event=>setStatus(event.target.value)}><option value="alle">Alle statussen</option><option value="actief">Actief</option><option value="prospect">Prospect</option><option value="oud-klant">Oud-klant</option><option value="inactief">Inactief</option></select></div>
    <div className="customerList">{customers.map(item=><button key={item.id} className={item.id===selectedId?'selected':''} onClick={()=>setSelectedId(item.id)}><span className="customerAvatar" style={{borderColor:item.color||'#f5c400'}}>{displayName(item).slice(0,1).toUpperCase()||'?'}</span><span><b>{displayName(item)||'Naamloos'}</b><small>{item.city||'Geen plaats'} · {item.status||'actief'}</small></span><i>›</i></button>)}{!customers.length&&<p className="emptyState">Geen klanten gevonden.</p>}</div>
   </aside>

   <section className="customerDetailPanel">{customer?<CustomerDetail customer={customer} data={data} edit={()=>setEditing(customer)}/>:<div className="emptyCustomer"><h2>Selecteer een klant</h2><p>Kies links een klant om het complete dossier te openen.</p></div>}</section>
  </section>
  {editing&&<CustomerModal value={editing} close={()=>setEditing(null)} save={saveCustomer}/>} 
 </main>
}

function CustomerDetail({customer,data,edit}:{customer:Customer;data:Data;edit:()=>void}){
 const documents=(data.documents||[]).filter(item=>Number(item.customer_id)===Number(customer.id));
 const appointments=(data.appointments||[]).filter(item=>Number(item.customer_id)===Number(customer.id)).sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at)));
 const hours=(data.time_entries||[]).filter(item=>Number(item.customer_id)===Number(customer.id));
 const invoices=documents.filter(item=>item.type==='factuur');
 const quotes=documents.filter(item=>item.type==='offerte');
 const outstanding=invoices.filter(item=>!['betaald','geannuleerd'].includes(item.status)).reduce((sum,item)=>sum+Number(item.total||0),0);
 const paid=invoices.filter(item=>item.status==='betaald').reduce((sum,item)=>sum+Number(item.total||0),0);
 const totalHours=hours.reduce((sum,item)=>sum+Number(item.hours||0),0);
 const mapsAddress=address(customer);
 return <div className="customerDossier">
  <header className="customerHero"><div className="heroIdentity"><span className="customerAvatar large" style={{borderColor:customer.color||'#f5c400'}}>{displayName(customer).slice(0,1).toUpperCase()||'?'}</span><div><small>{customer.customer_number||'Klantdossier'}</small><h2>{displayName(customer)}</h2><p>{mapsAddress||'Geen adres ingevuld'}</p><div className="badges"><span>{customer.status||'actief'}</span><span>{customer.type||'particulier'}</span></div></div></div><div className="heroActions">{customer.phone||customer.mobile?<a href={`tel:${customer.mobile||customer.phone}`}>Bellen</a>:null}{customer.email?<a href={`mailto:${customer.email}`}>E-mail</a>:null}{mapsAddress?<a target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsAddress)}`}>Navigeren</a>:null}<button onClick={edit}>Wijzigen</button></div></header>
  <div className="dossierStats"><Kpi value={`€ ${outstanding.toFixed(2)}`} label="Openstaand"/><Kpi value={`€ ${paid.toFixed(2)}`} label="Betaalde omzet"/><Kpi value={documents.length} label="Documenten"/><Kpi value={totalHours.toFixed(1)} label="Geregistreerde uren"/></div>
  <div className="dossierGrid">
   <Card title="Contact"><Info label="E-mail" value={customer.email}/><Info label="Tweede e-mail" value={customer.secondary_email}/><Info label="Telefoon" value={customer.phone}/><Info label="Mobiel" value={customer.mobile}/><Info label="Website" value={customer.website}/><Info label="Adres" value={mapsAddress}/></Card>
   <Card title="Bedrijf & financieel"><Info label="Contactpersoon" value={customer.contact_person}/><Info label="KvK" value={customer.kvk}/><Info label="BTW-nummer" value={customer.vat_number}/><Info label="IBAN" value={customer.iban}/><Info label="Betaaltermijn" value={`${customer.payment_term||14} dagen`}/><Info label="BTW-tarief" value={`${customer.vat_rate??21}%`}/></Card>
   <Card title="Facturen" action={<a href={`/facturen?customer=${customer.id}`}>Alles openen</a>}>{invoices.slice(0,5).map(item=><Row key={item.id} left={item.number||`#${item.id}`} sub={item.status} right={`€ ${Number(item.total||0).toFixed(2)}`}/>)}{!invoices.length&&<Empty text="Nog geen facturen."/>}</Card>
   <Card title="Offertes" action={<a href={`/offertes?customer=${customer.id}`}>Alles openen</a>}>{quotes.slice(0,5).map(item=><Row key={item.id} left={item.number||`#${item.id}`} sub={item.status} right={`€ ${Number(item.total||0).toFixed(2)}`}/>)}{!quotes.length&&<Empty text="Nog geen offertes."/>}</Card>
   <Card title="Planning" action={<a href={`/planning?customer=${customer.id}`}>Afspraak maken</a>}>{appointments.slice(0,5).map(item=><Row key={item.id} left={item.title} sub={formatDate(item.start_at)} right={item.status}/>)}{!appointments.length&&<Empty text="Geen afspraken gepland."/>}</Card>
   <Card title="Urenregistratie" action={<a href={`/urenregistratie?customer=${customer.id}`}>Uren toevoegen</a>}>{hours.slice(0,5).map(item=><Row key={item.id} left={item.description||'Werkzaamheden'} sub={formatDate(item.work_date)} right={`${Number(item.hours||0).toFixed(1)} uur`}/>)}{!hours.length&&<Empty text="Nog geen uren geregistreerd."/>}</Card>
  </div>
  <Card title="Notities & bijzonderheden"><p className="customerNotes">{customer.notes||'Nog geen notities voor deze klant.'}</p>{customer.tags&&<div className="customerTags">{customer.tags.split(',').map(tag=><span key={tag}>{tag.trim()}</span>)}</div>}</Card>
  <div className="customerQuickActions"><a href={`/werkbonnen?customer=${customer.id}`}>+ Nieuwe werkbon</a><a href={`/offertes?customer=${customer.id}&new=1`}>+ Nieuwe offerte</a><a href={`/facturen?customer=${customer.id}&new=1`}>+ Nieuwe factuur</a><a href={`/planning?customer=${customer.id}&new=1`}>+ Nieuwe afspraak</a></div>
 </div>
}

function CustomerModal({value,close,save}:{value:Partial<Customer>;close:()=>void;save:(value:Partial<Customer>)=>void}){
 const [form,setForm]=useState({...emptyCustomer,...value});
 const set=(key:keyof Customer,val:any)=>setForm(current=>({...current,[key]:val}));
 return <div className="customerModalBackdrop"><div className="customerModal"><header><div><small>{form.id?'Klant bewerken':'Nieuwe klant'}</small><h2>{displayName(form)||'Klantgegevens'}</h2></div><button onClick={close}>×</button></header><div className="customerFormGrid"><Field label="Type"><select value={form.type||'particulier'} onChange={e=>set('type',e.target.value)}><option value="particulier">Particulier</option><option value="zakelijk">Zakelijk</option></select></Field><Field label="Status"><select value={form.status||'actief'} onChange={e=>set('status',e.target.value)}><option value="actief">Actief</option><option value="prospect">Prospect</option><option value="oud-klant">Oud-klant</option></select></Field><Field label="Naam"><input value={form.name||''} onChange={e=>set('name',e.target.value)}/></Field><Field label="Bedrijfsnaam"><input value={form.company_name||''} onChange={e=>set('company_name',e.target.value)}/></Field><Field label="Contactpersoon"><input value={form.contact_person||''} onChange={e=>set('contact_person',e.target.value)}/></Field><Field label="E-mail"><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></Field><Field label="Telefoon"><input value={form.phone||''} onChange={e=>set('phone',e.target.value)}/></Field><Field label="Mobiel"><input value={form.mobile||''} onChange={e=>set('mobile',e.target.value)}/></Field><Field label="Straat"><input value={form.street||''} onChange={e=>set('street',e.target.value)}/></Field><Field label="Huisnummer"><input value={form.house_number||''} onChange={e=>set('house_number',e.target.value)}/></Field><Field label="Postcode"><input value={form.postal_code||''} onChange={e=>set('postal_code',e.target.value)}/></Field><Field label="Plaats"><input value={form.city||''} onChange={e=>set('city',e.target.value)}/></Field><Field label="KvK"><input value={form.kvk||''} onChange={e=>set('kvk',e.target.value)}/></Field><Field label="BTW-nummer"><input value={form.vat_number||''} onChange={e=>set('vat_number',e.target.value)}/></Field><Field label="IBAN"><input value={form.iban||''} onChange={e=>set('iban',e.target.value)}/></Field><Field label="Betaaltermijn"><input type="number" value={form.payment_term||14} onChange={e=>set('payment_term',Number(e.target.value))}/></Field></div><Field label="Notities"><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></Field><footer><button className="secondary" onClick={close}>Annuleren</button><button onClick={()=>save(form)}>Klant opslaan</button></footer></div></div>
}

function Kpi({value,label}:{value:any;label:string}){return <div className="customerKpi"><b>{value}</b><span>{label}</span></div>}
function Card({title,action,children}:{title:string;action?:React.ReactNode;children:React.ReactNode}){return <article className="dossierCard"><header><h3>{title}</h3>{action}</header>{children}</article>}
function Info({label,value}:{label:string;value:any}){return <div className="customerInfo"><small>{label}</small><b>{value||'Niet ingevuld'}</b></div>}
function Row({left,sub,right}:{left:any;sub?:any;right?:any}){return <div className="customerRow"><span><b>{left}</b><small>{sub}</small></span><strong>{right}</strong></div>}
function Empty({text}:{text:string}){return <p className="emptyState">{text}</p>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="customerField"><span>{label}</span>{children}</label>}
function displayName(customer:Partial<Customer>){return customer.company_name||customer.name||customer.contact_person||''}
function address(customer:Partial<Customer>){return [customer.street,customer.house_number,customer.postal_code,customer.city,customer.country].filter(Boolean).join(' ')}
function formatDate(value:any){if(!value)return 'Geen datum';const date=new Date(value);return isNaN(date.getTime())?String(value):date.toLocaleString('nl-NL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
