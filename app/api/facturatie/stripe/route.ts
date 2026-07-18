import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const appUrl=()=>String(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||'').replace(/\/$/,'');

export async function POST(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:'STRIPE_SECRET_KEY ontbreekt in Vercel'},{status:503});
 const {document_id}=await req.json();
 const id=Number(document_id);
 if(!id)return NextResponse.json({error:'Factuur ontbreekt'},{status:400});
 const [rows]:any=await pool.query(`SELECT d.id,d.number,d.type,d.total,c.email,COALESCE(p.paid,0) paid FROM documents d LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN (SELECT document_id,SUM(amount) paid FROM payments GROUP BY document_id) p ON p.document_id=d.id WHERE d.id=?`,[id]);
 const doc=rows[0];
 if(!doc)return NextResponse.json({error:'Factuur niet gevonden'},{status:404});
 if(doc.type!=='factuur')return NextResponse.json({error:'Alleen voor facturen kan een Stripe-betaallink worden gemaakt'},{status:400});
 const amount=Math.max(0,Number(doc.total||0)-Number(doc.paid||0));
 if(amount<0.01)return NextResponse.json({error:'Deze factuur is al volledig betaald'},{status:400});
 const base=appUrl();
 if(!base)return NextResponse.json({error:'APP_URL of NEXT_PUBLIC_APP_URL ontbreekt in Vercel'},{status:503});
 const form=new URLSearchParams();
 form.set('mode','payment');
 form.set('success_url',`${base}/facturatie/document/${doc.id}?payment=stripe-success&session_id={CHECKOUT_SESSION_ID}`);
 form.set('cancel_url',`${base}/facturatie?payment=stripe-cancelled`);
 form.set('payment_method_types[0]','card');
 form.set('payment_method_types[1]','ideal');
 form.set('line_items[0][price_data][currency]','eur');
 form.set('line_items[0][price_data][unit_amount]',String(Math.round(amount*100)));
 form.set('line_items[0][price_data][product_data][name]',`Factuur ${doc.number}`);
 form.set('line_items[0][quantity]','1');
 form.set('metadata[document_id]',String(doc.id));
 form.set('metadata[document_number]',String(doc.number));
 form.set('payment_intent_data[metadata][document_id]',String(doc.id));
 form.set('payment_intent_data[metadata][document_number]',String(doc.number));
 if(doc.email)form.set('customer_email',String(doc.email));
 const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
 const checkout:any=await response.json();
 if(!response.ok)return NextResponse.json({error:checkout?.error?.message||'Stripe Checkout maken mislukt'},{status:502});
 if(!checkout.url)return NextResponse.json({error:'Stripe gaf geen checkout-link terug'},{status:502});
 await pool.query(`UPDATE documents SET external_payment_url=?,external_payment_provider='stripe' WHERE id=?`,[checkout.url,id]);
 return NextResponse.json({url:checkout.url,session_id:checkout.id,amount});
}
