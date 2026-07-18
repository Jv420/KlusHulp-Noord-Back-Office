import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const iso=(d:Date)=>d.toISOString().slice(0,10);

function range(url:URL){
 const now=new Date(),year=Number(url.searchParams.get('year')||now.getFullYear()),quarter=Math.min(4,Math.max(1,Number(url.searchParams.get('quarter')||Math.floor(now.getMonth()/3)+1)));
 const start=new Date(Date.UTC(year,(quarter-1)*3,1)),end=new Date(Date.UTC(year,quarter*3,0));
 return {year,quarter,start:iso(start),end:iso(end)};
}

export async function GET(req:Request){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const period=range(new URL(req.url));
 const params=[period.start,period.end];
 const [summaryRows]:any=await pool.query(`SELECT
  COALESCE(SUM(CASE WHEN type='factuur' THEN subtotal ELSE 0 END),0) omzet_ex,
  COALESCE(SUM(CASE WHEN type='factuur' THEN vat_total ELSE 0 END),0) btw_verkoop,
  COALESCE(SUM(CASE WHEN type='factuur' THEN total ELSE 0 END),0) omzet_incl,
  COALESCE(SUM(CASE WHEN type='creditfactuur' THEN ABS(subtotal) ELSE 0 END),0) credit_ex,
  COALESCE(SUM(CASE WHEN type='creditfactuur' THEN ABS(vat_total) ELSE 0 END),0) credit_btw,
  COALESCE(SUM(CASE WHEN type='creditfactuur' THEN ABS(total) ELSE 0 END),0) credit_incl,
  SUM(CASE WHEN type='factuur' THEN 1 ELSE 0 END) facturen,
  SUM(CASE WHEN type='creditfactuur' THEN 1 ELSE 0 END) creditfacturen
 FROM documents WHERE issue_date BETWEEN ? AND ?`,params);
 const [vatRows]:any=await pool.query(`SELECT ROUND(COALESCE(i.vat_rate,0),2) vat_rate,
  COALESCE(SUM(CASE WHEN d.type='factuur' THEN i.line_total ELSE 0 END),0)-COALESCE(SUM(CASE WHEN d.type='creditfactuur' THEN ABS(i.line_total) ELSE 0 END),0) taxable,
  COALESCE(SUM(CASE WHEN d.type='factuur' THEN i.line_total*(i.vat_rate/100) ELSE 0 END),0)-COALESCE(SUM(CASE WHEN d.type='creditfactuur' THEN ABS(i.line_total)*(i.vat_rate/100) ELSE 0 END),0) vat
 FROM document_items i JOIN documents d ON d.id=i.document_id
 WHERE d.issue_date BETWEEN ? AND ? AND d.type IN ('factuur','creditfactuur')
 GROUP BY ROUND(COALESCE(i.vat_rate,0),2) ORDER BY vat_rate DESC`,params);
 const [monthly]:any=await pool.query(`SELECT DATE_FORMAT(issue_date,'%Y-%m') month,
  COALESCE(SUM(CASE WHEN type='factuur' THEN total WHEN type='creditfactuur' THEN -ABS(total) ELSE 0 END),0) revenue,
  COALESCE(SUM(CASE WHEN type='factuur' THEN vat_total WHEN type='creditfactuur' THEN -ABS(vat_total) ELSE 0 END),0) vat
 FROM documents WHERE issue_date BETWEEN ? AND ? AND type IN ('factuur','creditfactuur') GROUP BY DATE_FORMAT(issue_date,'%Y-%m') ORDER BY month`,params);
 const [outstanding]:any=await pool.query(`SELECT COALESCE(SUM(GREATEST(ABS(d.total)-COALESCE(p.paid,0),0)),0) amount,
  SUM(CASE WHEN d.due_date<CURDATE() AND GREATEST(ABS(d.total)-COALESCE(p.paid,0),0)>0 THEN 1 ELSE 0 END) overdue_count
 FROM documents d LEFT JOIN (SELECT document_id,SUM(amount) paid FROM payments GROUP BY document_id)p ON p.document_id=d.id WHERE d.type='factuur'`);
 const s=summaryRows[0]||{};
 const summary={
  omzet_ex:Number(s.omzet_ex||0)-Number(s.credit_ex||0),
  btw_verkoop:Number(s.btw_verkoop||0)-Number(s.credit_btw||0),
  omzet_incl:Number(s.omzet_incl||0)-Number(s.credit_incl||0),
  facturen:Number(s.facturen||0),creditfacturen:Number(s.creditfacturen||0),
  openstaand:Number(outstanding[0]?.amount||0),te_laat:Number(outstanding[0]?.overdue_count||0)
 };
 return NextResponse.json({period,summary,vat:vatRows,monthly});
}
