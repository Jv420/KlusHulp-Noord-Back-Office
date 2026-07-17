import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS customer_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  contact_type VARCHAR(40) NOT NULL DEFAULT 'notitie',
  subject VARCHAR(190) NULL,
  notes TEXT NOT NULL,
  contact_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_contacts_customer (customer_id),
  INDEX idx_customer_contacts_date (contact_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 await pool.query(`CREATE TABLE IF NOT EXISTS customer_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  tag VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_tag (customer_id,tag),
  INDEX idx_customer_tags_customer (customer_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function GET(req:Request){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const id=Number(new URL(req.url).searchParams.get('id')||0);
 const [customers]:any=await pool.query(`SELECT c.*,
  COUNT(DISTINCT d.id) document_count,
  COALESCE(SUM(CASE WHEN d.type='factuur' AND d.status<>'geannuleerd' THEN d.total ELSE 0 END),0) total_revenue,
  COALESCE(SUM(CASE WHEN d.type='factuur' AND d.status<>'geannuleerd' THEN GREATEST(d.total-COALESCE(pp.paid,0),0) ELSE 0 END),0) outstanding,
  MAX(d.issue_date) last_document_date,
  MAX(cc.contact_date) last_contact_date
  FROM customers c
  LEFT JOIN documents d ON d.customer_id=c.id
  LEFT JOIN (SELECT document_id,SUM(amount) paid FROM payments GROUP BY document_id) pp ON pp.document_id=d.id
  LEFT JOIN customer_contacts cc ON cc.customer_id=c.id
  ${id?'WHERE c.id=?':''}
  GROUP BY c.id ORDER BY COALESCE(MAX(cc.contact_date),MAX(d.issue_date)) DESC,c.id DESC`,id?[id]:[]);
 if(id&&!customers.length)return NextResponse.json({error:'Klant niet gevonden'},{status:404});
 if(!id)return NextResponse.json({customers});
 const [documents]:any=await pool.query(`SELECT d.*,COALESCE(SUM(p.amount),0) paid_amount,GREATEST(d.total-COALESCE(SUM(p.amount),0),0) outstanding_amount FROM documents d LEFT JOIN payments p ON p.document_id=d.id WHERE d.customer_id=? GROUP BY d.id ORDER BY d.issue_date DESC,d.id DESC`,[id]);
 const [contacts]:any=await pool.query(`SELECT * FROM customer_contacts WHERE customer_id=? ORDER BY contact_date DESC,id DESC`,[id]);
 const [tags]:any=await pool.query(`SELECT id,tag FROM customer_tags WHERE customer_id=? ORDER BY tag`,[id]);
 const [reminders]:any=await pool.query(`SELECT r.*,d.number FROM payment_reminders r JOIN documents d ON d.id=r.document_id WHERE d.customer_id=? ORDER BY r.reminder_date DESC,r.id DESC`,[id]).catch(()=>[[]] as any);
 return NextResponse.json({customer:customers[0],documents,contacts,tags,reminders});
}

export async function POST(req:Request){
 const session:any=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const body=await req.json();
 const customerId=Number(body.customer_id);
 if(!Number.isInteger(customerId)||customerId<1)return NextResponse.json({error:'Ongeldige klant'},{status:400});
 if(body.action==='tag'){
  const tag=String(body.tag||'').trim();
  if(!tag)return NextResponse.json({error:'Vul een label in'},{status:400});
  await pool.query(`INSERT IGNORE INTO customer_tags(customer_id,tag) VALUES(?,?)`,[customerId,tag.slice(0,80)]);
  return NextResponse.json({ok:true});
 }
 const notes=String(body.notes||'').trim();
 if(!notes)return NextResponse.json({error:'Vul een notitie in'},{status:400});
 await pool.query(`INSERT INTO customer_contacts(customer_id,contact_type,subject,notes,contact_date,created_by) VALUES(?,?,?,?,?,?)`,[
  customerId,String(body.contact_type||'notitie'),String(body.subject||'').trim()||null,notes,body.contact_date||new Date(),session?.email||session?.name||null
 ]);
 return NextResponse.json({ok:true});
}

export async function DELETE(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const url=new URL(req.url),id=Number(url.searchParams.get('id')||0),type=url.searchParams.get('type');
 if(!id)return NextResponse.json({error:'Ongeldig item'},{status:400});
 if(type==='tag')await pool.query('DELETE FROM customer_tags WHERE id=?',[id]);
 else await pool.query('DELETE FROM customer_contacts WHERE id=?',[id]);
 return NextResponse.json({ok:true});
}
