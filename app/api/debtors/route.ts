import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS payment_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  reminder_type VARCHAR(40) NOT NULL DEFAULT 'herinnering',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recipient VARCHAR(190) NULL,
  subject VARCHAR(255) NULL,
  message TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'geregistreerd',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reminder_document (document_id),
  INDEX idx_reminder_sent (sent_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function GET(){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const [invoices]:any=await pool.query(`SELECT d.id,d.number,d.customer_id,d.issue_date,d.due_date,d.status,d.total,
  c.customer_number,c.name,c.company_name,c.contact_person,c.email,c.secondary_email,c.phone,c.mobile,c.payment_term,
  COALESCE(SUM(p.amount),0) paid_amount,
  GREATEST(d.total-COALESCE(SUM(p.amount),0),0) outstanding_amount,
  DATEDIFF(CURDATE(),d.due_date) days_overdue,
  MAX(r.sent_at) last_reminder_at,
  COUNT(DISTINCT r.id) reminder_count
  FROM documents d
  LEFT JOIN customers c ON c.id=d.customer_id
  LEFT JOIN payments p ON p.document_id=d.id
  LEFT JOIN payment_reminders r ON r.document_id=d.id
  WHERE d.type='factuur' AND d.status<>'geannuleerd'
  GROUP BY d.id
  HAVING outstanding_amount>0.005
  ORDER BY (d.due_date<CURDATE()) DESC,d.due_date ASC,d.id DESC`);
 const [reminders]:any=await pool.query(`SELECT r.*,d.number,c.name,c.company_name,c.contact_person
  FROM payment_reminders r
  JOIN documents d ON d.id=r.document_id
  LEFT JOIN customers c ON c.id=d.customer_id
  ORDER BY r.sent_at DESC,r.id DESC LIMIT 250`);
 return NextResponse.json({invoices,reminders});
}

export async function POST(req:Request){
 const session:any=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const body=await req.json();
 const documentId=Number(body.document_id);
 if(!Number.isInteger(documentId)||documentId<1)return NextResponse.json({error:'Ongeldige factuur'},{status:400});
 const [rows]:any=await pool.query(`SELECT d.id,d.number,d.total,d.status,c.email,c.secondary_email,c.name,c.company_name,c.contact_person,
  GREATEST(d.total-COALESCE((SELECT SUM(amount) FROM payments WHERE document_id=d.id),0),0) outstanding_amount
  FROM documents d LEFT JOIN customers c ON c.id=d.customer_id
  WHERE d.id=? AND d.type='factuur' LIMIT 1`,[documentId]);
 if(!rows.length)return NextResponse.json({error:'Factuur niet gevonden'},{status:404});
 if(Number(rows[0].outstanding_amount)<=0.005)return NextResponse.json({error:'Deze factuur staat niet meer open'},{status:400});
 const recipient=String(body.recipient||rows[0].email||rows[0].secondary_email||'').trim();
 const type=['herinnering','tweede_herinnering','aanmaning'].includes(body.reminder_type)?body.reminder_type:'herinnering';
 const subject=String(body.subject||`Betalingsherinnering factuur ${rows[0].number}`).slice(0,255);
 const message=String(body.message||'').trim();
 await pool.query(`INSERT INTO payment_reminders(document_id,reminder_type,sent_at,recipient,subject,message,status,created_by)
  VALUES(?,?,?,?,?,?,?,?)`,[documentId,type,body.sent_at||new Date(),recipient||null,subject,message||null,'geregistreerd',session?.userId||session?.id||null]);
 if(!['betaald','geannuleerd'].includes(rows[0].status))await pool.query(`UPDATE documents SET status='verzonden' WHERE id=? AND status='concept'`,[documentId]);
 return NextResponse.json({ok:true});
}
