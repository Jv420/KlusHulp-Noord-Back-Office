import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const today=()=>new Date().toISOString().slice(0,10);
const prefixes:Record<string,string>={factuur:'FAC'};

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS document_sequences (document_type VARCHAR(30) NOT NULL,sequence_year INT NOT NULL,last_number INT NOT NULL DEFAULT 0,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,PRIMARY KEY(document_type,sequence_year)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS automation_runs (id INT AUTO_INCREMENT PRIMARY KEY,run_type VARCHAR(40) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'success',created_documents INT NOT NULL DEFAULT 0,created_reminders INT NOT NULL DEFAULT 0,details TEXT NULL,started_at DATETIME NOT NULL,finished_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_automation_runs_type(run_type),INDEX idx_automation_runs_date(started_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS payment_reminders (id INT AUTO_INCREMENT PRIMARY KEY,document_id INT NOT NULL,reminder_type VARCHAR(30) NOT NULL DEFAULT 'herinnering',reminder_date DATE NOT NULL,due_date DATE NULL,status VARCHAR(30) NOT NULL DEFAULT 'concept',subject VARCHAR(190) NULL,message TEXT NULL,sent_at DATETIME NULL,created_by VARCHAR(190) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_reminders_document(document_id),INDEX idx_reminders_date(reminder_date),INDEX idx_reminders_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function reserveNumber(){
 const year=new Date().getFullYear(),type='factuur',prefix=prefixes[type];
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  await conn.query('INSERT IGNORE INTO document_sequences(document_type,sequence_year,last_number) VALUES(?,?,0)',[type,year]);
  const [rows]:any=await conn.query('SELECT last_number FROM document_sequences WHERE document_type=? AND sequence_year=? FOR UPDATE',[type,year]);
  const next=Number(rows[0]?.last_number||0)+1;
  await conn.query('UPDATE document_sequences SET last_number=? WHERE document_type=? AND sequence_year=?',[next,type,year]);
  await conn.commit();
  return `${prefix}-${year}-${String(next).padStart(4,'0')}`;
 }catch(error){await conn.rollback();throw error}finally{conn.release()}
}

function nextDate(current:string,interval:string){
 const d=new Date(`${String(current).slice(0,10)}T12:00:00Z`);
 if(interval==='jaarlijks')d.setUTCFullYear(d.getUTCFullYear()+1);
 else if(interval==='kwartaal')d.setUTCMonth(d.getUTCMonth()+3);
 else d.setUTCMonth(d.getUTCMonth()+1);
 return d.toISOString().slice(0,10);
}

async function runAutomation(){
 await ensureSchema();
 const started=new Date();
 const [runResult]:any=await pool.query(`INSERT INTO automation_runs(run_type,status,started_at) VALUES('daily','running',NOW())`);
 let createdDocuments=0,createdReminders=0;
 const details:string[]=[];
 try{
  const [recurring]:any=await pool.query(`SELECT r.*,COALESCE(c.payment_term,14) payment_term FROM recurring_invoices r LEFT JOIN customers c ON c.id=r.customer_id WHERE r.active=1 AND r.next_invoice_date<=CURDATE() ORDER BY r.next_invoice_date,r.id LIMIT 100`);
  for(const row of recurring){
   const number=await reserveNumber();
   const issue=today(),due=new Date(`${issue}T12:00:00Z`);due.setUTCDate(due.getUTCDate()+Math.max(1,Number(row.payment_term||14)));
   const subtotal=Number(row.amount_ex_vat||0),vatRate=Number(row.vat_rate||0),vat=subtotal*vatRate/100,total=subtotal+vat;
   const [doc]:any=await pool.query(`INSERT INTO documents(type,number,customer_id,issue_date,due_date,status,subtotal,vat_total,total,notes,payment_status) VALUES('factuur',?,?,?,?,?,?,?,?,?,'open')`,[number,row.customer_id,issue,due.toISOString().slice(0,10),'concept',subtotal,vat,total,row.description||row.name]);
   await pool.query(`INSERT INTO document_items(document_id,description,quantity,unit,unit_price,vat_rate,line_total) VALUES(?,?,1,'stuk',?,?,?)`,[doc.insertId,row.description||row.name,subtotal,vatRate,subtotal]);
   await pool.query(`UPDATE recurring_invoices SET last_document_id=?,next_invoice_date=? WHERE id=?`,[doc.insertId,nextDate(row.next_invoice_date,row.interval_type),row.id]);
   createdDocuments++;
  }

  const [overdue]:any=await pool.query(`SELECT d.id,d.number,d.due_date,c.name,c.company_name FROM documents d LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN (SELECT document_id,SUM(amount) paid FROM payments GROUP BY document_id) p ON p.document_id=d.id WHERE d.type='factuur' AND d.due_date<CURDATE() AND ABS(d.total)-COALESCE(p.paid,0)>0.009 AND NOT EXISTS(SELECT 1 FROM payment_reminders r WHERE r.document_id=d.id AND r.reminder_date>=DATE_SUB(CURDATE(),INTERVAL 7 DAY)) LIMIT 100`);
  for(const doc of overdue){
   const customer=doc.company_name||doc.name||'klant';
   await pool.query(`INSERT INTO payment_reminders(document_id,reminder_type,reminder_date,due_date,status,subject,message,created_by) VALUES(?, 'herinnering', CURDATE(), DATE_ADD(CURDATE(),INTERVAL 7 DAY),'concept',?,?, 'Automatisering')`,[doc.id,`Betalingsherinnering ${doc.number}`,`Beste ${customer}, volgens onze administratie staat factuur ${doc.number} nog open. Wilt u deze binnen 7 dagen voldoen?`]);
   createdReminders++;
  }
  details.push(`${createdDocuments} periodieke facturen aangemaakt`,`${createdReminders} herinneringen klaargezet`);
  await pool.query(`UPDATE automation_runs SET status='success',created_documents=?,created_reminders=?,details=?,finished_at=NOW() WHERE id=?`,[createdDocuments,createdReminders,details.join('; '),runResult.insertId]);
  return {ok:true,created_documents:createdDocuments,created_reminders:createdReminders,started_at:started.toISOString(),finished_at:new Date().toISOString()};
 }catch(error:any){
  await pool.query(`UPDATE automation_runs SET status='failed',created_documents=?,created_reminders=?,details=?,finished_at=NOW() WHERE id=?`,[createdDocuments,createdReminders,String(error?.message||error),runResult.insertId]);
  throw error;
 }
}

function cronAllowed(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return false;
 return req.headers.get('authorization')===`Bearer ${secret}`;
}

export async function GET(req:Request){
 if(cronAllowed(req))return NextResponse.json(await runAutomation());
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const [runs]:any=await pool.query(`SELECT * FROM automation_runs ORDER BY started_at DESC,id DESC LIMIT 50`);
 const [dueRecurring]:any=await pool.query(`SELECT COUNT(*) count FROM recurring_invoices WHERE active=1 AND next_invoice_date<=CURDATE()`);
 const [overdue]:any=await pool.query(`SELECT COUNT(*) count FROM documents d LEFT JOIN (SELECT document_id,SUM(amount) paid FROM payments GROUP BY document_id) p ON p.document_id=d.id WHERE d.type='factuur' AND d.due_date<CURDATE() AND ABS(d.total)-COALESCE(p.paid,0)>0.009`);
 return NextResponse.json({runs,due_recurring:Number(dueRecurring[0]?.count||0),overdue_invoices:Number(overdue[0]?.count||0)});
}

export async function POST(){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 try{return NextResponse.json(await runAutomation())}catch(error:any){return NextResponse.json({error:error?.message||'Automatisering mislukt'},{status:500})}
}
