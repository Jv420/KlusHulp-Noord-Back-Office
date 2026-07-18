import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const q=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;
const n=(v:any)=>Number(v||0).toFixed(2).replace('.',',');

export async function GET(req:Request){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const url=new URL(req.url),now=new Date(),year=Number(url.searchParams.get('year')||now.getFullYear()),quarter=Math.min(4,Math.max(1,Number(url.searchParams.get('quarter')||Math.floor(now.getMonth()/3)+1)));
 const start=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`,end=new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10);
 const [rows]:any=await pool.query(`SELECT d.issue_date,d.number,d.type,d.status,COALESCE(c.company_name,c.name) customer,d.subtotal,d.vat_total,d.total,d.payment_status FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.issue_date BETWEEN ? AND ? AND d.type IN ('factuur','creditfactuur') ORDER BY d.issue_date,d.id`,[start,end]);
 const header=['Datum','Nummer','Type','Status','Klant','Bedrag excl. BTW','BTW','Bedrag incl. BTW','Betaalstatus'];
 const lines=[header.map(q).join(';'),...rows.map((r:any)=>[String(r.issue_date).slice(0,10),r.number,r.type,r.status,r.customer,n(r.subtotal),n(r.vat_total),n(r.total),r.payment_status].map(q).join(';'))];
 const csv='\uFEFF'+lines.join('\r\n');
 return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="btw-rapport-${year}-Q${quarter}.csv"`}});
}
