import {NextResponse} from 'next/server';
import {randomBytes} from 'crypto';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const appUrl=()=>String(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||'').replace(/\/$/,'');
const euro=(value:any)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(value||0));
const esc=(value:any)=>String(value??'').replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#039;'}[c]||c));

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS customer_portal_links (id INT AUTO_INCREMENT PRIMARY KEY,document_id INT NOT NULL,token VARCHAR(96) NOT NULL UNIQUE,expires_at DATETIME NULL,last_opened_at DATETIME NULL,accepted_at DATETIME NULL,rejected_at DATETIME NULL,signer_name VARCHAR(190) NULL,signer_email VARCHAR(190) NULL,signer_ip VARCHAR(64) NULL,response_note TEXT NULL,created_by VARCHAR(190) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_portal_document(document_id),INDEX idx_portal_expires(expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS document_emails (id INT AUTO_INCREMENT PRIMARY KEY,document_id INT NOT NULL,recipient VARCHAR(190) NOT NULL,subject VARCHAR(255) NOT NULL,template_type VARCHAR(40) NOT NULL,message_id VARCHAR(190) NULL,status VARCHAR(30) NOT NULL DEFAULT 'sent',error_message TEXT NULL,sent_by VARCHAR(190) NULL,sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_email_document(document_id),INDEX idx_email_recipient(recipient),INDEX idx_email_sent(sent_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function template(doc:any,url:string,customMessage?:string){
 const isQuote=doc.type==='offerte';
 const title=isQuote?`Offerte ${doc.number}`:`Factuur ${doc.number}`;
 const intro=customMessage?.trim()|| (isQuote?'Wij hebben een offerte voor u klaargezet. Via onderstaande knop kunt u de offerte bekijken en direct accepteren of afwijzen.':'Uw factuur staat voor u klaar. Via onderstaande knop kunt u de factuur bekijken en, indien beschikbaar, direct betalen.');
 const button=isQuote?'Offerte bekijken':'Factuur bekijken';
 return `<!doctype html><html lang="nl"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#18212f"><div style="max-width:640px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e7ec"><div style="background:#172033;color:#fff;padding:26px"><div style="font-size:13px;opacity:.8">KlusHulp Noord</div><h1 style="margin:8px 0 0;font-size:26px">${esc(title)}</h1></div><div style="padding:28px"><p>Beste ${esc(doc.contact_person||doc.customer_name||doc.company_name||'klant')},</p><p style="line-height:1.7">${esc(intro)}</p><div style="background:#f8fafc;border-radius:12px;padding:18px;margin:22px 0"><div><strong>Document:</strong> ${esc(doc.number)}</div><div style="margin-top:8px"><strong>Datum:</strong> ${esc(String(doc.issue_date||'').slice(0,10))}</div><div style="margin-top:8px"><strong>Totaal:</strong> ${esc(euro(doc.total))}</div>${doc.due_date?`<div style="margin-top:8px"><strong>Vervaldatum:</strong> ${esc(String(doc.due_date).slice(0,10))}</div>`:''}</div><p style="margin:28px 0"><a href="${esc(url)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">${button}</a></p><p style="font-size:13px;color:#667085;line-height:1.6">Werkt de knop niet? Kopieer dan deze link:<br><a href="${esc(url)}">${esc(url)}</a></p><p style="margin-top:28px">Met vriendelijke groet,<br><strong>KlusHulp Noord</strong></p></div></div></body></html>`;
}

export async function GET(){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const [logs]:any=await pool.query(`SELECT e.*,d.number document_number,d.type FROM document_emails e JOIN documents d ON d.id=e.document_id ORDER BY e.sent_at DESC,e.id DESC LIMIT 200`);
 return NextResponse.json({logs});
}

export async function POST(req:Request){
 const session:any=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 if(!process.env.RESEND_API_KEY)return NextResponse.json({error:'RESEND_API_KEY ontbreekt in Vercel'},{status:503});
 await ensureSchema();
 const body=await req.json();
 const documentId=Number(body.document_id);
 if(!documentId)return NextResponse.json({error:'Document ontbreekt'},{status:400});
 const [rows]:any=await pool.query(`SELECT d.*,c.email customer_email,c.name customer_name,c.company_name,c.contact_person FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.id=?`,[documentId]);
 const doc=rows[0];
 if(!doc)return NextResponse.json({error:'Document niet gevonden'},{status:404});
 if(!['offerte','factuur'].includes(doc.type))return NextResponse.json({error:'Alleen offertes en facturen kunnen per e-mail worden verstuurd'},{status:400});
 const recipient=String(body.recipient||doc.customer_email||'').trim();
 if(!recipient||!/^\S+@\S+\.\S+$/.test(recipient))return NextResponse.json({error:'Een geldig e-mailadres is verplicht'},{status:400});
 const base=appUrl();
 if(!base)return NextResponse.json({error:'APP_URL of NEXT_PUBLIC_APP_URL ontbreekt in Vercel'},{status:503});
 const token=randomBytes(32).toString('hex');
 await pool.query(`INSERT INTO customer_portal_links(document_id,token,expires_at,created_by) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 30 DAY),?)`,[documentId,token,session?.name||session?.email||'gebruiker']);
 const portalUrl=`${base}/klantportaal/${token}`;
 const subject=String(body.subject||`${doc.type==='offerte'?'Offerte':'Factuur'} ${doc.number} van KlusHulp Noord`).slice(0,255);
 const from=String(process.env.RESEND_FROM_EMAIL||'KlusHulp Noord <administratie@klushulpnoord.nl>');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[recipient],subject,html:template(doc,portalUrl,body.message),reply_to:process.env.RESEND_REPLY_TO||undefined})});
 const result:any=await response.json().catch(()=>({}));
 if(!response.ok){
  await pool.query(`INSERT INTO document_emails(document_id,recipient,subject,template_type,status,error_message,sent_by) VALUES(?,?,?,?,?,?,?)`,[documentId,recipient,subject,doc.type,'failed',result?.message||'Versturen mislukt',session?.name||session?.email||'gebruiker']);
  return NextResponse.json({error:result?.message||'E-mail versturen mislukt'},{status:502});
 }
 await pool.query(`INSERT INTO document_emails(document_id,recipient,subject,template_type,message_id,status,sent_by) VALUES(?,?,?,?,?,'sent',?)`,[documentId,recipient,subject,doc.type,result?.id||null,session?.name||session?.email||'gebruiker']);
 await pool.query(`UPDATE documents SET status=CASE WHEN status='concept' THEN 'verzonden' ELSE status END,sent_at=COALESCE(sent_at,NOW()) WHERE id=?`,[documentId]);
 return NextResponse.json({ok:true,message_id:result?.id,url:portalUrl,recipient});
}
