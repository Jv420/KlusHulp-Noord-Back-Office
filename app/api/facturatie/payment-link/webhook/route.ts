import {NextResponse} from 'next/server';
import pool from '@/lib/db';

async function refreshPaymentStatus(documentId:number){
 const [[doc],[paid]]:any=await Promise.all([pool.query('SELECT total FROM documents WHERE id=?',[documentId]),pool.query('SELECT COALESCE(SUM(amount),0) amount FROM payments WHERE document_id=?',[documentId])]);
 if(!doc[0])return;
 const total=Math.abs(Number(doc[0].total||0)),amount=Number(paid[0]?.amount||0),status=amount<=0?'open':amount+0.005>=total?'betaald':'gedeeltelijk';
 await pool.query(`UPDATE documents SET paid_amount=?,payment_status=?,paid_at=${status==='betaald'?'NOW()':'NULL'},status=CASE WHEN type='factuur' AND ?='betaald' THEN 'betaald' ELSE status END WHERE id=?`,[amount,status,status,documentId]);
}

export async function POST(req:Request){
 if(!process.env.MOLLIE_API_KEY)return new NextResponse('Mollie niet geconfigureerd',{status:503});
 const form=await req.formData();
 const paymentId=String(form.get('id')||'');
 if(!paymentId)return new NextResponse('Ontbrekend payment-id',{status:400});
 const response=await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Bearer ${process.env.MOLLIE_API_KEY}`},cache:'no-store'});
 if(!response.ok)return new NextResponse('Payment ophalen mislukt',{status:502});
 const payment:any=await response.json();
 const documentId=Number(payment?.metadata?.document_id||0);
 if(!documentId)return new NextResponse('OK',{status:200});
 if(payment.status==='paid'){
  const [existing]:any=await pool.query('SELECT id FROM payments WHERE reference=? LIMIT 1',[paymentId]);
  if(!existing.length){
   await pool.query(`INSERT INTO payments(document_id,amount,payment_date,payment_method,reference,notes,created_by) VALUES(?,?,?,?,?,?,?)`,[documentId,Number(payment.amount?.value||0),String(payment.paidAt||new Date().toISOString()).slice(0,10),'mollie',paymentId,'Automatisch geregistreerd via Mollie-webhook','Mollie']);
  }
  await refreshPaymentStatus(documentId);
 }
 return new NextResponse('OK',{status:200});
}
