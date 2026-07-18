import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let ready=false;
async function ensureSchema(){
 if(ready)return;
 await pool.query(`CREATE TABLE IF NOT EXISTS ledger_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  type VARCHAR(30) NOT NULL,
  vat_code VARCHAR(20) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  source_type VARCHAR(40) NULL,
  source_id INT NULL,
  reference VARCHAR(190) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'definitief',
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_journal_date(entry_date),INDEX idx_journal_source(source_type,source_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS journal_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id INT NOT NULL,
  ledger_account_id INT NOT NULL,
  description VARCHAR(255) NULL,
  debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_line_entry(journal_entry_id),INDEX idx_line_account(ledger_account_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name VARCHAR(190) NOT NULL,
  invoice_number VARCHAR(100) NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NULL,
  description TEXT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  ledger_account_id INT NULL,
  journal_entry_id INT NULL,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchase_date(invoice_date),INDEX idx_purchase_status(status)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 const defaults=[
  ['1000','Bank','activa',null],['1010','Kas','activa',null],['1300','Debiteuren','activa',null],['1600','Crediteuren','passiva',null],
  ['1520','Te betalen BTW','passiva','hoog'],['1521','Te vorderen BTW','activa','hoog'],['8000','Omzet werkzaamheden','opbrengsten','hoog'],
  ['4000','Inkoop materialen','kosten','hoog'],['4100','Autokosten','kosten','hoog'],['4200','Gereedschap','kosten','hoog'],['4300','Overige bedrijfskosten','kosten','hoog']
 ];
 for(const x of defaults)await pool.query('INSERT IGNORE INTO ledger_accounts(code,name,type,vat_code) VALUES(?,?,?,?)',x);
 ready=true;
}
const actor=(s:any)=>s?.name||s?.email||'gebruiker';
async function auth(permission:string){const s=await readSession();return can(s,permission)?s:null}
async function accountId(code:string){const [r]:any=await pool.query('SELECT id FROM ledger_accounts WHERE code=?',[code]);if(!r[0])throw new Error(`Grootboekrekening ${code} ontbreekt`);return Number(r[0].id)}

async function createJournal(data:{date:string;description:string;sourceType?:string;sourceId?:number;reference?:string;createdBy:string;lines:Array<{accountId:number;description?:string;debit?:number;credit?:number;vat?:number}>}){
 const debit=data.lines.reduce((s,x)=>s+Number(x.debit||0),0),credit=data.lines.reduce((s,x)=>s+Number(x.credit||0),0);
 if(Math.abs(debit-credit)>0.01)throw new Error('Journaalpost is niet in balans');
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const [r]:any=await conn.query(`INSERT INTO journal_entries(entry_date,description,source_type,source_id,reference,created_by) VALUES(?,?,?,?,?,?)`,[data.date,data.description,data.sourceType||null,data.sourceId||null,data.reference||null,data.createdBy]);for(const l of data.lines)await conn.query(`INSERT INTO journal_lines(journal_entry_id,ledger_account_id,description,debit,credit,vat_amount) VALUES(?,?,?,?,?,?)`,[r.insertId,l.accountId,l.description||null,Number(l.debit||0),Number(l.credit||0),Number(l.vat||0)]);await conn.commit();return Number(r.insertId)}catch(e){await conn.rollback();throw e}finally{conn.release()}
}

export async function GET(req:Request){
 const s=await auth('data.read');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await ensureSchema();
 const url=new URL(req.url),year=Math.max(2000,Math.min(2100,Number(url.searchParams.get('year'))||new Date().getFullYear()));
 const [accounts]:any=await pool.query(`SELECT a.*,COALESCE(SUM(l.debit),0) debit,COALESCE(SUM(l.credit),0) credit,COALESCE(SUM(l.debit-l.credit),0) balance FROM ledger_accounts a LEFT JOIN journal_lines l ON l.ledger_account_id=a.id LEFT JOIN journal_entries j ON j.id=l.journal_entry_id AND YEAR(j.entry_date)=? GROUP BY a.id ORDER BY a.code`,[year]);
 const [entries]:any=await pool.query(`SELECT j.*,COUNT(l.id) line_count,COALESCE(SUM(l.debit),0) debit,COALESCE(SUM(l.credit),0) credit FROM journal_entries j LEFT JOIN journal_lines l ON l.journal_entry_id=j.id WHERE YEAR(j.entry_date)=? GROUP BY j.id ORDER BY j.entry_date DESC,j.id DESC LIMIT 250`,[year]);
 const [purchases]:any=await pool.query(`SELECT p.*,a.code ledger_code,a.name ledger_name FROM purchase_invoices p LEFT JOIN ledger_accounts a ON a.id=p.ledger_account_id WHERE YEAR(p.invoice_date)=? ORDER BY p.invoice_date DESC,p.id DESC`,[year]);
 const [profitRows]:any=await pool.query(`SELECT a.type,SUM(l.debit-l.credit) balance FROM journal_lines l JOIN journal_entries j ON j.id=l.journal_entry_id JOIN ledger_accounts a ON a.id=l.ledger_account_id WHERE YEAR(j.entry_date)=? AND a.type IN ('kosten','opbrengsten') GROUP BY a.type`,[year]);
 const profitMap=Object.fromEntries(profitRows.map((x:any)=>[x.type,Number(x.balance||0)]));const revenue=Math.abs(profitMap.opbrengsten||0),costs=Math.max(0,profitMap.kosten||0);
 const [vatRows]:any=await pool.query(`SELECT a.code,a.name,SUM(l.debit) debit,SUM(l.credit) credit,SUM(l.vat_amount) vat FROM journal_lines l JOIN journal_entries j ON j.id=l.journal_entry_id JOIN ledger_accounts a ON a.id=l.ledger_account_id WHERE YEAR(j.entry_date)=? AND a.code IN ('1520','1521') GROUP BY a.id ORDER BY a.code`,[year]);
 return NextResponse.json({year,accounts,entries,purchases,vat:vatRows,kpis:{revenue,costs,profit:revenue-costs,purchases:purchases.reduce((s:number,x:any)=>s+Number(x.total||0),0),openPurchases:purchases.filter((x:any)=>x.status!=='betaald').reduce((s:number,x:any)=>s+Number(x.total||0),0)}});
}

export async function POST(req:Request){
 const s:any=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await ensureSchema();const b=await req.json();
 if(b.action==='account'){
  if(!b.code||!b.name||!b.type)return NextResponse.json({error:'Code, naam en type zijn verplicht'},{status:400});
  const [r]:any=await pool.query(`INSERT INTO ledger_accounts(code,name,type,vat_code,active) VALUES(?,?,?,?,?)`,[String(b.code).trim(),String(b.name).trim(),b.type,b.vat_code||null,b.active===0?0:1]);return NextResponse.json({id:r.insertId});
 }
 if(b.action==='purchase'){
  const subtotal=Number(b.subtotal||0),vat=Number(b.vat_total||0),total=Number(b.total||subtotal+vat);if(!b.supplier_name||!b.invoice_date||total<=0)return NextResponse.json({error:'Leverancier, datum en geldig bedrag zijn verplicht'},{status:400});
  const expenseId=Number(b.ledger_account_id)||await accountId('4300'),creditorId=await accountId('1600'),vatId=await accountId('1521');
  const conn=await pool.getConnection();try{await conn.beginTransaction();const [r]:any=await conn.query(`INSERT INTO purchase_invoices(supplier_name,invoice_number,invoice_date,due_date,description,subtotal,vat_total,total,status,ledger_account_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[b.supplier_name,b.invoice_number||null,b.invoice_date,b.due_date||null,b.description||null,subtotal,vat,total,b.status||'open',expenseId,actor(s)]);await conn.commit();const lines:any[]=[{accountId:expenseId,debit:subtotal,description:b.description||b.supplier_name}];if(vat>0)lines.push({accountId:vatId,debit:vat,vat});lines.push({accountId:creditorId,credit:total});const journalId=await createJournal({date:b.invoice_date,description:`Inkoopfactuur ${b.invoice_number||b.supplier_name}`,sourceType:'purchase_invoice',sourceId:r.insertId,reference:b.invoice_number,createdBy:actor(s),lines});await pool.query('UPDATE purchase_invoices SET journal_entry_id=? WHERE id=?',[journalId,r.insertId]);return NextResponse.json({id:r.insertId,journal_entry_id:journalId});}catch(e){await conn.rollback();throw e}finally{conn.release()}
 }
 if(b.action==='purchase_payment'){
  const id=Number(b.id);const [rows]:any=await pool.query('SELECT * FROM purchase_invoices WHERE id=?',[id]);const p=rows[0];if(!p)return NextResponse.json({error:'Inkoopfactuur niet gevonden'},{status:404});if(p.status==='betaald')return NextResponse.json({error:'Inkoopfactuur is al betaald'},{status:400});const bankId=await accountId('1000'),creditorId=await accountId('1600');const journalId=await createJournal({date:b.payment_date||new Date().toISOString().slice(0,10),description:`Betaling inkoopfactuur ${p.invoice_number||p.supplier_name}`,sourceType:'purchase_payment',sourceId:id,reference:b.reference||p.invoice_number,createdBy:actor(s),lines:[{accountId:creditorId,debit:Number(p.total)},{accountId:bankId,credit:Number(p.total)}]});await pool.query("UPDATE purchase_invoices SET status='betaald' WHERE id=?",[id]);return NextResponse.json({ok:true,journal_entry_id:journalId});
 }
 if(b.action==='manual_journal'){
  const lines=(b.lines||[]).map((x:any)=>({accountId:Number(x.ledger_account_id),description:x.description,debit:Number(x.debit||0),credit:Number(x.credit||0),vat:Number(x.vat_amount||0)})).filter((x:any)=>x.accountId&&(x.debit>0||x.credit>0));if(!b.entry_date||!b.description||lines.length<2)return NextResponse.json({error:'Datum, omschrijving en minimaal twee regels zijn verplicht'},{status:400});const id=await createJournal({date:b.entry_date,description:b.description,reference:b.reference,createdBy:actor(s),lines});return NextResponse.json({id});
 }
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}
