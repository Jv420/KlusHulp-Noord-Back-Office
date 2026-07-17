import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS technician_job_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  work_date DATE NOT NULL,
  hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  kilometers DECIMAL(8,2) NOT NULL DEFAULT 0,
  materials TEXT NULL,
  notes TEXT NULL,
  customer_signature LONGTEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'onderweg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_technician_document (document_id),
  INDEX idx_technician_status (status),
  INDEX idx_technician_date (work_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function GET(){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const [jobs]:any=await pool.query(`SELECT d.id,d.number,d.issue_date,d.due_date,d.status document_status,d.notes document_notes,d.total,
  c.name,c.company_name,c.contact_person,c.phone,c.email,c.address,c.postal_code,c.city,
  t.work_date,t.hours,t.kilometers,t.materials,t.notes,t.customer_signature,t.status technician_status,t.updated_at
  FROM documents d
  LEFT JOIN customers c ON c.id=d.customer_id
  LEFT JOIN technician_job_updates t ON t.document_id=d.id
  WHERE d.type='werkbon'
  ORDER BY COALESCE(t.work_date,d.issue_date) DESC,d.id DESC`);
 return NextResponse.json({jobs});
}

export async function POST(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const body=await req.json();
 const documentId=Number(body.document_id);
 if(!Number.isInteger(documentId)||documentId<1)return NextResponse.json({error:'Ongeldige werkbon'},{status:400});
 const [docs]:any=await pool.query(`SELECT id FROM documents WHERE id=? AND type='werkbon' LIMIT 1`,[documentId]);
 if(!docs.length)return NextResponse.json({error:'Werkbon niet gevonden'},{status:404});
 const allowed=['onderweg','gestart','gepauzeerd','afgerond'];
 const status=allowed.includes(body.status)?body.status:'gestart';
 const hours=Math.max(0,Number(body.hours||0));
 const kilometers=Math.max(0,Number(body.kilometers||0));
 await pool.query(`INSERT INTO technician_job_updates(document_id,work_date,hours,kilometers,materials,notes,customer_signature,status)
  VALUES(?,?,?,?,?,?,?,?)
  ON DUPLICATE KEY UPDATE work_date=VALUES(work_date),hours=VALUES(hours),kilometers=VALUES(kilometers),materials=VALUES(materials),notes=VALUES(notes),customer_signature=VALUES(customer_signature),status=VALUES(status)`,[
  documentId,body.work_date||new Date().toISOString().slice(0,10),hours,kilometers,body.materials||null,body.notes||null,body.customer_signature||null,status
 ]);
 if(status==='afgerond')await pool.query(`UPDATE documents SET status='afgerond' WHERE id=?`,[documentId]);
 return NextResponse.json({ok:true});
}
