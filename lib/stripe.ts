import Stripe from 'stripe';

let client:Stripe|null=null;

export function getStripe(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key)throw new Error('STRIPE_SECRET_KEY ontbreekt');
 if(!client)client=new Stripe(key,{apiVersion:'2025-06-30.basil'});
 return client;
}

export function appUrl(req?:Request){
 const configured=process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL;
 if(configured)return configured.replace(/\/$/,'');
 if(req)return new URL(req.url).origin;
 return 'http://localhost:3000';
}
