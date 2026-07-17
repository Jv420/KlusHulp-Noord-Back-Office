import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'bank',
  reference VARCHAR(190) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_document (document_id),
  INDEX idx_payments_date (payment_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function GET(){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const [invoices]:any=await pool.query(`SELECT d.id,d.number,d.issue_date,d.due_date,d.status,d.subtotal,d.vat_total,d.total,
  c.customer_number,c.name,c.company_name,c.contact_person,
  COALESCE(SUM(p.amount),0) paid_amount,
  GREATEST(d.total-COALESCE(SUM(p.amount),0),0) outstanding_amount
  FROM documents d
  LEFT JOIN customers c ON c.id=d.customer_id
  LEFT JOIN payments p ON p.document_id=d.id
  WHERE d.type='factuur'
  GROUP BY d.id
  ORDER BY d.issue_date DESC,d.id DESC`);
 const [payments]:any=await pool.query(`SELECT p.*,d.number,c.name,c.company_name,c.contact_person
  FROM payments p JOIN documents d ON d.id=p.document_id
  LEFT JOIN customers c ON c.id=d.customer_id
  ORDER BY p.payment_date DESC,p.id DESC LIMIT 250`);
 const [vat]:any=await pool.query(`SELECT YEAR(issue_date) year,QUARTER(issue_date) quarter,
  ROUND(SUM(subtotal),2) revenue_ex_vat,ROUND(SUM(vat_total),2) vat_due,ROUND(SUM(total),2) revenue_inc_vat
  FROM documents WHERE type='factuur' AND status<>'geannuleerd'
  GROUP BY YEAR(issue_date),QUARTER(issue_date) ORDER BY year DESC,quarter DESC`);
 return NextResponse.json({invoices,payments,vat});
}

export async function POST(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const body=await req.json();
 const documentId=Number(body.document_id),amount=Number(body.amount);
 if(!Number.isInteger(documentId)||documentId<1)return NextResponse.json({error:'Ongeldige factuur'},{status:400});
 if(!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:'Bedrag moet groter zijn dan nul'},{status:400});
 const [docs]:any=await pool.query(`SELECT id,total,status FROM documents WHERE id=? AND type='factuur' LIMIT 1`,[documentId]);
 if(!docs.length)return NextResponse.json({error:'Factuur niet gevonden'},{status:404});
 if(docs[0].status==='geannuleerd')return NextResponse.json({error:'Geannuleerde factuur kan niet worden betaald'},{status:400});
 const [sumRows]:any=await pool.query('SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE document_id=?',[documentId]);
 const remaining=Math.max(Number(docs[0].total)-Number(sumRows[0].paid),0);
 if(amount>remaining+0.005)return NextResponse.json({error:`Bedrag is hoger dan het openstaande bedrag (€ ${remaining.toFixed(2)})`},{status:400});
 await pool.query(`INSERT INTO payments(document_id,payment_date,amount,payment_method,reference,notes) VALUES(?,?,?,?,?,?)`,[
  documentId,body.payment_date||new Date().toISOString().slice(0,10),amount,body.payment_method||'bank',body.reference||null,body.notes||null
 ]);
 const newPaid=Number(sumRows[0].paid)+amount;
 if(newPaid+0.005>=Number(docs[0].total))await pool.query(`UPDATE documents SET status='betaald' WHERE id=?`,[documentId]);
 else if(!['verzonden','deels_betaald'].includes(docs[0].status))await pool.query(`UPDATE documents SET status='deels_betaald' WHERE id=?`,[documentId]);
 return NextResponse.json({ok:true});
}
