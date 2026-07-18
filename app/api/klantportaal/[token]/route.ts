import {NextResponse} from 'next/server';
import pool from '@/lib/db';

async function getPortal(token:string){
 const [links]:any=await pool.query(`SELECT l.*,d.*,c.name customer_name,c.company_name,c.contact_person,c.email customer_email,c.street,c.house_number,c.postal_code,c.city FROM customer_portal_links l JOIN documents d ON d.id=l.document_id LEFT JOIN customers c ON c.id=d.customer_id WHERE l.token=? LIMIT 1`,[token]);
 return links[0];
}

export async function GET(_:Request,{params}:{params:{token:string}}){
 const token=String(params.token||'');
 const portal=await getPortal(token);
 if(!portal)return NextResponse.json({error:'Link niet gevonden'},{status:404});
 if(portal.expires_at&&new Date(portal.expires_at).getTime()<Date.now())return NextResponse.json({error:'Deze link is verlopen'},{status:410});
 await pool.query('UPDATE customer_portal_links SET last_opened_at=NOW() WHERE id=?',[portal.id]);
 const [items]:any=await pool.query('SELECT description,quantity,unit,unit_price,vat_rate,line_total FROM document_items WHERE document_id=? ORDER BY id',[portal.document_id]);
 return NextResponse.json({document:{id:portal.document_id,number:portal.number,type:portal.type,status:portal.status,issue_date:portal.issue_date,due_date:portal.due_date,subtotal:portal.subtotal,vat_total:portal.vat_total,total:portal.total,notes:portal.notes,external_payment_url:portal.external_payment_url,external_payment_provider:portal.external_payment_provider,payment_status:portal.payment_status,paid_amount:portal.paid_amount},customer:{name:portal.company_name||portal.customer_name,contact_person:portal.contact_person,email:portal.customer_email,address:[portal.street,portal.house_number].filter(Boolean).join(' '),postal_code:portal.postal_code,city:portal.city},items,response:{accepted_at:portal.accepted_at,rejected_at:portal.rejected_at,signer_name:portal.signer_name,response_note:portal.response_note}});
}

export async function POST(req:Request,{params}:{params:{token:string}}){
 const token=String(params.token||'');
 const portal=await getPortal(token);
 if(!portal)return NextResponse.json({error:'Link niet gevonden'},{status:404});
 if(portal.expires_at&&new Date(portal.expires_at).getTime()<Date.now())return NextResponse.json({error:'Deze link is verlopen'},{status:410});
 if(portal.type!=='offerte')return NextResponse.json({error:'Alleen offertes kunnen worden geaccepteerd of afgewezen'},{status:400});
 if(portal.accepted_at||portal.rejected_at)return NextResponse.json({error:'Er is al op deze offerte gereageerd'},{status:409});
 const body=await req.json();
 const action=String(body.action||'');
 const name=String(body.name||'').trim(),email=String(body.email||'').trim(),note=String(body.note||'').trim();
 if(!['accept','reject'].includes(action))return NextResponse.json({error:'Ongeldige actie'},{status:400});
 if(!name)return NextResponse.json({error:'Naam is verplicht'},{status:400});
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||null;
 if(action==='accept'){
  await pool.query('UPDATE customer_portal_links SET accepted_at=NOW(),signer_name=?,signer_email=?,signer_ip=?,response_note=? WHERE id=?',[name,email||null,ip,note||null,portal.id]);
  await pool.query("UPDATE documents SET status='geaccepteerd' WHERE id=?",[portal.document_id]);
 }else{
  await pool.query('UPDATE customer_portal_links SET rejected_at=NOW(),signer_name=?,signer_email=?,signer_ip=?,response_note=? WHERE id=?',[name,email||null,ip,note||null,portal.id]);
  await pool.query("UPDATE documents SET status='afgewezen' WHERE id=?",[portal.document_id]);
 }
 return NextResponse.json({ok:true,status:action==='accept'?'geaccepteerd':'afgewezen'});
}
