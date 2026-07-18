import Link from 'next/link';
import {getStripe} from '@/lib/stripe';

const money=(cents:number,currency='eur')=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:currency.toUpperCase()}).format(cents/100);

export default async function PaymentSuccess({searchParams}:{searchParams:{session_id?:string}}){
 const id=searchParams.session_id;
 if(!id)return <main style={{maxWidth:680,margin:'80px auto',padding:24}}><h1>Betaalbevestiging</h1><p>Er ontbreekt een Stripe-sessie.</p></main>;
 try{
  const session:any=await getStripe().checkout.sessions.retrieve(id,{expand:['payment_intent.latest_charge']});
  const paid=session.payment_status==='paid';
  const intent:any=typeof session.payment_intent==='object'?session.payment_intent:null;
  const charge:any=intent&&typeof intent.latest_charge==='object'?intent.latest_charge:null;
  return <main style={{maxWidth:680,margin:'70px auto',padding:30,fontFamily:'Arial,sans-serif'}}><section style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:18,padding:32,boxShadow:'0 12px 35px #0001'}}><div style={{fontSize:48}}>{paid?'✅':'⏳'}</div><h1>{paid?'Betaling geslaagd':'Betaling wordt verwerkt'}</h1><p>{paid?'Hartelijk dank. Je betaling is veilig verwerkt door Stripe.':'Je betaling is ontvangen en wordt nog door de bank verwerkt.'}</p><dl style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,background:'#f7f8fa',padding:18,borderRadius:12}}><dt>Factuur</dt><dd><b>{session.metadata?.invoice_number||session.client_reference_id||'–'}</b></dd><dt>Bedrag</dt><dd><b>{money(Number(session.amount_total||0),session.currency)}</b></dd><dt>Status</dt><dd><b>{paid?'Betaald':'In behandeling'}</b></dd><dt>Betaalreferentie</dt><dd style={{wordBreak:'break-all'}}>{intent?.id||session.id}</dd></dl><p style={{color:'#667085'}}>Stripe stuurt het betaalbewijs naar het opgegeven e-mailadres. Bewaar deze pagina eventueel voor je administratie.</p>{charge?.receipt_url&&<p><a href={charge.receipt_url} target="_blank" rel="noreferrer" style={{display:'inline-block',background:'#172033',color:'#fff',padding:'12px 16px',borderRadius:10,textDecoration:'none',fontWeight:700}}>Open officieel Stripe-betaalbewijs</a></p>}<p><Link href="/">Terug naar KlusHulp Noord</Link></p></section></main>;
 }catch{return <main style={{maxWidth:680,margin:'80px auto',padding:24}}><h1>Betaalbevestiging</h1><p>De betaalstatus kon niet worden opgehaald. Controleer je Stripe-betaalbewijs per e-mail.</p></main>}
}
