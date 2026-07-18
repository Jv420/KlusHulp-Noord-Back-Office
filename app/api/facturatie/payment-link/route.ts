import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const appUrl=()=>String(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||'').replace(/\/$/,'');

export async function POST(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 if(!process.env.MOLLIE_API_KEY)return NextResponse.json({error:'MOLLIE_API_KEY ontbreekt in Vercel'},{status:503});
 const {document_id}=await req.json();
 const id=Number(document_id);
 if(!id)return NextResponse.json({error:'Factuur ontbreekt'},{status:400});
 const [rows]:any=await pool.query(`SELECT d.id,d.number,d.type,d.total,d.payment_status,d.external_payment_url,c.email,c.name,c.company_name,COALESCE(p.paid,0) paid FROM documents d LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN (SELECT document_id,SUM(amount) paid FROM payments GROUP BY document_id) p ON p.document_id=d.id WHERE d.id=?`,[id]);
 const doc=rows[0];
 if(!doc)return NextResponse.json({error:'Factuur niet gevonden'},{status:404});
 if(doc.type!=='factuur')return NextResponse.json({error:'Alleen voor facturen kan een betaallink worden gemaakt'},{status:400});
 const amount=Math.max(0,Number(doc.total||0)-Number(doc.paid||0));
 if(amount<0.01)return NextResponse.json({error:'Deze factuur is al volledig betaald'},{status:400});
 const base=appUrl();
 if(!base)return NextResponse.json({error:'APP_URL of NEXT_PUBLIC_APP_URL ontbreekt in Vercel'},{status:503});
 const response=await fetch('https://api.mollie.com/v2/payments',{method:'POST',headers:{Authorization:`Bearer ${process.env.MOLLIE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({amount:{currency:'EUR',value:amount.toFixed(2)},description:`Factuur ${doc.number}`,redirectUrl:`${base}/facturatie/document/${doc.id}?payment=return`,webhookUrl:`${base}/api/facturatie/payment-link/webhook`,metadata:{document_id:doc.id,document_number:doc.number},billingEmail:doc.email||undefined})});
 const payment:any=await response.json();
 if(!response.ok)return NextResponse.json({error:payment?.detail||payment?.title||'Mollie-betaallink maken mislukt'},{status:502});
 const checkoutUrl=payment?._links?.checkout?.href;
 if(!checkoutUrl)return NextResponse.json({error:'Mollie gaf geen checkout-link terug'},{status:502});
 await pool.query(`UPDATE documents SET external_payment_url=?,external_payment_provider='mollie' WHERE id=?`,[checkoutUrl,id]);
 return NextResponse.json({url:checkoutUrl,payment_id:payment.id,amount});
}
