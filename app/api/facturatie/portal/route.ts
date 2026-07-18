import {NextResponse} from 'next/server';
import {randomBytes} from 'crypto';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const appUrl=()=>String(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||'').replace(/\/$/,'');

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS customer_portal_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  token VARCHAR(96) NOT NULL UNIQUE,
  expires_at DATETIME NULL,
  last_opened_at DATETIME NULL,
  accepted_at DATETIME NULL,
  rejected_at DATETIME NULL,
  signer_name VARCHAR(190) NULL,
  signer_email VARCHAR(190) NULL,
  signer_ip VARCHAR(64) NULL,
  response_note TEXT NULL,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_portal_document(document_id),
  INDEX idx_portal_expires(expires_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function POST(req:Request){
 const session:any=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const {document_id,expires_in_days=30}=await req.json();
 const id=Number(document_id);
 if(!id)return NextResponse.json({error:'Document ontbreekt'},{status:400});
 const [rows]:any=await pool.query('SELECT id,number,type,status FROM documents WHERE id=?',[id]);
 const doc=rows[0];
 if(!doc)return NextResponse.json({error:'Document niet gevonden'},{status:404});
 if(!['offerte','factuur'].includes(doc.type))return NextResponse.json({error:'Klantportaal is alleen beschikbaar voor offertes en facturen'},{status:400});
 const token=randomBytes(32).toString('hex');
 const days=Math.min(365,Math.max(1,Number(expires_in_days)||30));
 await pool.query(`INSERT INTO customer_portal_links(document_id,token,expires_at,created_by) VALUES(?,?,DATE_ADD(NOW(),INTERVAL ? DAY),?)`,[id,token,days,session?.name||session?.email||'gebruiker']);
 const base=appUrl();
 if(!base)return NextResponse.json({error:'APP_URL of NEXT_PUBLIC_APP_URL ontbreekt in Vercel'},{status:503});
 return NextResponse.json({url:`${base}/klantportaal/${token}`,token,expires_in_days:days});
}
