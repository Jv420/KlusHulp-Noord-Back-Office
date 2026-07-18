import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';
import {getStripe} from '@/lib/stripe';

export async function POST(req:Request){
 try{
  const session=await readSession();
  if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
  const {document_id}=await req.json();
  const [rows]:any=await pool.query(`SELECT d.*,c.email customer_email FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.id=?`,[Number(document_id)]);
  const invoice=rows[0];
  if(!invoice||invoice.type!=='factuur')return NextResponse.json({error:'Factuur niet gevonden'},{status:404});
  if(invoice.payment_status==='betaald')return NextResponse.json({error:'Deze factuur is al betaald'},{status:400});
  const amount=Math.round(Math.max(0,Number(invoice.total)-Number(invoice.paid_amount||0))*100);
  if(amount<50)return NextResponse.json({error:'Het openstaande bedrag is te laag'},{status:400});
  const intent=await getStripe().paymentIntents.create({amount,currency:'eur',payment_method_types:['card_present'],capture_method:'automatic',description:`Factuur ${invoice.number}`,receipt_email:invoice.customer_email||undefined,metadata:{document_id:String(invoice.id),invoice_number:String(invoice.number)}});
  await pool.query(`UPDATE documents SET stripe_payment_intent_id=?,external_payment_provider='stripe_terminal' WHERE id=?`,[intent.id,invoice.id]);
  return NextResponse.json({client_secret:intent.client_secret,payment_intent_id:intent.id,amount});
 }catch(error:any){return NextResponse.json({error:error?.message||'Terminalbetaling kon niet worden gestart'},{status:500});}
}
