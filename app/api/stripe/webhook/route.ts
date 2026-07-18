import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {getStripe} from '@/lib/stripe';

export const runtime='nodejs';

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS stripe_events (id VARCHAR(255) PRIMARY KEY,event_type VARCHAR(120) NOT NULL,processed_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 const [cols]:any=await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='documents'",[process.env.DB_NAME]);
 const existing=new Set(cols.map((x:any)=>x.COLUMN_NAME));
 const additions:Record<string,string>={stripe_checkout_session_id:'VARCHAR(255) NULL',stripe_payment_intent_id:'VARCHAR(255) NULL',stripe_receipt_url:'TEXT NULL',stripe_payment_method:'VARCHAR(60) NULL'};
 for(const [name,definition] of Object.entries(additions))if(!existing.has(name))await pool.query(`ALTER TABLE documents ADD COLUMN \`${name}\` ${definition}`);
}

async function registerPaid(documentId:number,intentId:string,provider:string){
 const stripe=getStripe();
 const intent:any=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']});
 if(intent.status!=='succeeded')return;
 const charge=typeof intent.latest_charge==='object'?intent.latest_charge:null;
 const method=intent.payment_method_types?.[0]||provider;
 const receiptUrl=charge?.receipt_url||null;
 const [docs]:any=await pool.query('SELECT total,number FROM documents WHERE id=?',[documentId]);
 const doc=docs[0];if(!doc)return;
 const [existing]:any=await pool.query('SELECT id FROM payments WHERE reference=? LIMIT 1',[intentId]);
 if(!existing.length)await pool.query(`INSERT INTO payments(document_id,amount,payment_date,payment_method,reference,notes,created_by) VALUES(?,ABS(?),CURDATE(),?,?,?,?)`,[documentId,Number(doc.total||0),method,intentId,`Automatisch verwerkt via ${provider}`,'Stripe webhook']);
 await pool.query(`UPDATE documents SET paid_amount=ABS(total),payment_status='betaald',status='betaald',paid_at=NOW(),stripe_payment_intent_id=?,stripe_receipt_url=?,stripe_payment_method=?,external_payment_provider=? WHERE id=?`,[intentId,receiptUrl,method,provider,documentId]);
}

export async function POST(req:Request){
 const stripe=getStripe(),secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:'STRIPE_WEBHOOK_SECRET ontbreekt'},{status:500});
 let event:any;
 try{event=stripe.webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature')||'',secret);}catch(error:any){return NextResponse.json({error:`Ongeldige webhook: ${error.message}`},{status:400});}
 try{
  await ensureSchema();
  const [seen]:any=await pool.query('SELECT id FROM stripe_events WHERE id=?',[event.id]);
  if(seen.length)return NextResponse.json({received:true,duplicate:true});
  if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
   const checkout:any=event.data.object;
   const documentId=Number(checkout.metadata?.document_id||checkout.client_reference_id||0);
   const intentId=typeof checkout.payment_intent==='string'?checkout.payment_intent:checkout.payment_intent?.id;
   if(documentId&&intentId&&checkout.payment_status==='paid')await registerPaid(documentId,intentId,'stripe');
  }
  if(event.type==='payment_intent.succeeded'){
   const intent:any=event.data.object,documentId=Number(intent.metadata?.document_id||0);
   if(documentId&&intent.payment_method_types?.includes('card_present'))await registerPaid(documentId,intent.id,'stripe_terminal');
  }
  if(event.type==='charge.refunded'){
   const charge:any=event.data.object,intentId=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
   if(intentId)await pool.query(`UPDATE documents SET payment_status='terugbetaald',status='terugbetaald' WHERE stripe_payment_intent_id=?`,[intentId]);
  }
  await pool.query('INSERT INTO stripe_events(id,event_type,processed_at) VALUES(?,?,NOW())',[event.id,event.type]);
  return NextResponse.json({received:true});
 }catch(error:any){return NextResponse.json({error:error?.message||'Webhookverwerking mislukt'},{status:500});}
}
