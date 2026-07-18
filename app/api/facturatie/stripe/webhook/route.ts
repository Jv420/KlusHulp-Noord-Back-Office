import {createHmac,timingSafeEqual} from 'crypto';
import {NextResponse} from 'next/server';
import pool from '@/lib/db';

export const runtime='nodejs';

function validSignature(payload:string,header:string,secret:string){
 const parts=header.split(',').map(x=>x.split('='));
 const timestamp=parts.find(x=>x[0]==='t')?.[1]||'';
 const signatures=parts.filter(x=>x[0]==='v1').map(x=>x[1]);
 if(!timestamp||!signatures.length)return false;
 if(Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const expected=createHmac('sha256',secret).update(`${timestamp}.${payload}`,'utf8').digest('hex');
 return signatures.some(sig=>{try{const a=Buffer.from(expected,'hex'),b=Buffer.from(sig,'hex');return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}});
}
async function refreshPaymentStatus(documentId:number){
 const [[doc],[paid]]:any=await Promise.all([pool.query('SELECT total FROM documents WHERE id=?',[documentId]),pool.query('SELECT COALESCE(SUM(amount),0) amount FROM payments WHERE document_id=?',[documentId])]);
 if(!doc[0])return;
 const total=Math.abs(Number(doc[0].total||0)),amount=Number(paid[0]?.amount||0),status=amount<=0?'open':amount+0.005>=total?'betaald':'gedeeltelijk';
 await pool.query(`UPDATE documents SET paid_amount=?,payment_status=?,paid_at=${status==='betaald'?'NOW()':'NULL'},status=CASE WHEN type='factuur' AND ?='betaald' THEN 'betaald' ELSE status END WHERE id=?`,[amount,status,status,documentId]);
}

export async function POST(req:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret)return new NextResponse('Stripe webhook niet geconfigureerd',{status:503});
 const payload=await req.text(),signature=req.headers.get('stripe-signature')||'';
 if(!validSignature(payload,signature,secret))return new NextResponse('Ongeldige Stripe-handtekening',{status:400});
 let event:any;try{event=JSON.parse(payload)}catch{return new NextResponse('Ongeldige JSON',{status:400})}
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
  const checkout=event.data?.object||{};
  if(checkout.payment_status==='paid'){
   const documentId=Number(checkout.metadata?.document_id||0),reference=String(checkout.payment_intent||checkout.id||'');
   if(documentId&&reference){
    const [existing]:any=await pool.query('SELECT id FROM payments WHERE reference=? LIMIT 1',[reference]);
    if(!existing.length)await pool.query(`INSERT INTO payments(document_id,amount,payment_date,payment_method,reference,notes,created_by) VALUES(?,?,?,?,?,?,?)`,[documentId,Number(checkout.amount_total||0)/100,new Date(Number(checkout.created||Date.now()/1000)*1000).toISOString().slice(0,10),'stripe',reference,'Automatisch geregistreerd via Stripe-webhook','Stripe']);
    await refreshPaymentStatus(documentId);
   }
  }
 }
 return NextResponse.json({received:true});
}
