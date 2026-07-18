import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';
import {appUrl,getStripe} from '@/lib/stripe';

async function ensureColumns(){
 const [cols]:any=await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='documents'",[process.env.DB_NAME]);
 const existing=new Set(cols.map((x:any)=>x.COLUMN_NAME));
 const additions:Record<string,string>={stripe_checkout_session_id:'VARCHAR(255) NULL',stripe_payment_intent_id:'VARCHAR(255) NULL',stripe_receipt_url:'TEXT NULL',stripe_payment_method:'VARCHAR(60) NULL'};
 for(const [name,definition] of Object.entries(additions))if(!existing.has(name))await pool.query(`ALTER TABLE documents ADD COLUMN \`${name}\` ${definition}`);
}

export async function POST(req:Request){
 try{
  const session=await readSession();
  if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
  await ensureColumns();
  const {document_id}=await req.json();
  const [rows]:any=await pool.query(`SELECT d.*,c.email customer_email,COALESCE(NULLIF(c.company_name,''),c.name) customer_name FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.id=?`,[Number(document_id)]);
  const invoice=rows[0];
  if(!invoice||invoice.type!=='factuur')return NextResponse.json({error:'Factuur niet gevonden'},{status:404});
  if(invoice.payment_status==='betaald')return NextResponse.json({error:'Deze factuur is al betaald'},{status:400});
  const amount=Math.round(Math.max(0,Number(invoice.total)-Number(invoice.paid_amount||0))*100);
  if(amount<50)return NextResponse.json({error:'Het openstaande bedrag is te laag voor Stripe'},{status:400});
  const stripe=getStripe(),origin=appUrl(req);
  if(invoice.stripe_checkout_session_id){
   try{const old=await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_session_id);if(old.status==='open'&&old.url)return NextResponse.json({url:old.url,session_id:old.id});}catch{}
  }
  const checkout=await stripe.checkout.sessions.create({
   mode:'payment',
   locale:'nl',
   payment_method_types:['ideal','card'],
   customer_email:invoice.customer_email||undefined,
   client_reference_id:String(invoice.id),
   metadata:{document_id:String(invoice.id),invoice_number:String(invoice.number)},
   line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:amount,product_data:{name:`Factuur ${invoice.number}`,description:`Betaling aan KlusHulp Noord${invoice.customer_name?` – ${invoice.customer_name}`:''}`}}}],
   payment_intent_data:{description:`Factuur ${invoice.number}`,metadata:{document_id:String(invoice.id),invoice_number:String(invoice.number)},receipt_email:invoice.customer_email||undefined},
   success_url:`${origin}/betaling/geslaagd?session_id={CHECKOUT_SESSION_ID}`,
   cancel_url:`${origin}/facturatie/document/${invoice.id}`,
   expires_at:Math.floor(Date.now()/1000)+86400
  });
  await pool.query("UPDATE documents SET external_payment_url=?,external_payment_provider='stripe',stripe_checkout_session_id=? WHERE id=?",[checkout.url,checkout.id,invoice.id]);
  return NextResponse.json({url:checkout.url,session_id:checkout.id});
 }catch(error:any){return NextResponse.json({error:error?.message||'Stripe-betaling kon niet worden aangemaakt'},{status:500});}
}
