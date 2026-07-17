import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let ready=false;
async function schema(){
 if(ready)return;
 await pool.query(`CREATE TABLE IF NOT EXISTS service_contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'concept',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  renewal_type VARCHAR(30) NOT NULL DEFAULT 'geen',
  notice_days INT NOT NULL DEFAULT 30,
  interval_type VARCHAR(30) NOT NULL DEFAULT 'maandelijks',
  interval_count INT NOT NULL DEFAULT 1,
  next_service_date DATE NULL,
  preferred_day TINYINT NULL,
  assigned_to VARCHAR(190) NULL,
  location VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
  billing_interval VARCHAR(30) NOT NULL DEFAULT 'maandelijks',
  next_invoice_date DATE NULL,
  auto_create_work_order TINYINT(1) NOT NULL DEFAULT 1,
  auto_invoice TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sc_customer(customer_id), INDEX idx_sc_status(status), INDEX idx_sc_service(next_service_date), INDEX idx_sc_invoice(next_invoice_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS contract_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  planned_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'gepland',
  work_order_id INT NULL,
  appointment_id INT NULL,
  completed_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contract_visit(contract_id,planned_date),
  INDEX idx_cv_contract(contract_id), INDEX idx_cv_date(planned_date), INDEX idx_cv_status(status)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS contract_invoice_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  period_start DATE NULL,
  period_end DATE NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
  status VARCHAR(30) NOT NULL DEFAULT 'klaarstaand',
  document_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contract_invoice(contract_id,invoice_date),
  INDEX idx_cir_contract(contract_id), INDEX idx_cir_status(status)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 ready=true;
}
async function auth(p:string){const s=await readSession();return can(s,p)?s:null}
async function nextNumber(){const y=new Date().getFullYear();const [r]:any=await pool.query('SELECT contract_number n FROM service_contracts WHERE contract_number LIKE ? ORDER BY id DESC LIMIT 1',[`CON-${y}-%`]);const n=Number(String(r[0]?.n||'').split('-').pop()||0)+1;return `CON-${y}-${String(n).padStart(4,'0')}`}
function addInterval(date:string,type:string,count:number){const d=new Date(date+'T12:00:00');if(type==='wekelijks')d.setDate(d.getDate()+7*count);else if(type==='jaarlijks')d.setFullYear(d.getFullYear()+count);else if(type==='kwartaal')d.setMonth(d.getMonth()+3*count);else d.setMonth(d.getMonth()+count);return d.toISOString().slice(0,10)}
export async function GET(){
 const s=await auth('data.read');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();
 const [[contracts],[customers],[visits],[invoiceRuns]]:any=await Promise.all([
  pool.query(`SELECT c.*,cu.name customer_name FROM service_contracts c LEFT JOIN customers cu ON cu.id=c.customer_id ORDER BY c.id DESC`),
  pool.query('SELECT id,name,email,phone,street,house_number,postal_code,city FROM customers ORDER BY name'),
  pool.query(`SELECT v.*,c.contract_number,c.name contract_name,cu.name customer_name FROM contract_visits v JOIN service_contracts c ON c.id=v.contract_id LEFT JOIN customers cu ON cu.id=c.customer_id ORDER BY v.planned_date DESC LIMIT 500`),
  pool.query(`SELECT r.*,c.contract_number,c.name contract_name,cu.name customer_name FROM contract_invoice_runs r JOIN service_contracts c ON c.id=r.contract_id LEFT JOIN customers cu ON cu.id=c.customer_id ORDER BY r.invoice_date DESC LIMIT 500`)
 ]);
 return NextResponse.json({contracts,customers,visits,invoiceRuns});
}
export async function POST(req:Request){
 const s:any=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json();
 if(b.action==='contract'){
  const d=b.data||{};if(!d.customer_id||!d.name||!d.start_date)return NextResponse.json({error:'Klant, naam en startdatum zijn verplicht'},{status:400});
  const number=await nextNumber();const [r]:any=await pool.query(`INSERT INTO service_contracts (contract_number,customer_id,name,description,status,start_date,end_date,renewal_type,notice_days,interval_type,interval_count,next_service_date,preferred_day,assigned_to,location,amount,vat_rate,billing_interval,next_invoice_date,auto_create_work_order,auto_invoice,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[number,d.customer_id,d.name,d.description||null,d.status||'actief',d.start_date,d.end_date||null,d.renewal_type||'geen',Number(d.notice_days||30),d.interval_type||'maandelijks',Number(d.interval_count||1),d.next_service_date||d.start_date,d.preferred_day||null,d.assigned_to||null,d.location||null,Number(d.amount||0),Number(d.vat_rate??21),d.billing_interval||'maandelijks',d.next_invoice_date||d.start_date,d.auto_create_work_order?1:0,d.auto_invoice?1:0,d.notes||null]);return NextResponse.json({id:r.insertId,number});
 }
 if(b.action==='generate'){
  const until=String(b.until||new Date(Date.now()+90*86400000).toISOString().slice(0,10));const [rows]:any=await pool.query("SELECT * FROM service_contracts WHERE status='actief'");let visits=0,invoices=0;
  for(const c of rows){let d=c.next_service_date?String(c.next_service_date).slice(0,10):null;let guard=0;while(d&&d<=until&&guard++<60){await pool.query('INSERT IGNORE INTO contract_visits (contract_id,planned_date) VALUES (?,?)',[c.id,d]);visits++;d=addInterval(d,c.interval_type,Number(c.interval_count||1))}if(d)await pool.query('UPDATE service_contracts SET next_service_date=? WHERE id=?',[d,c.id]);let inv=c.next_invoice_date?String(c.next_invoice_date).slice(0,10):null;guard=0;while(c.auto_invoice&&inv&&inv<=until&&guard++<60){await pool.query('INSERT IGNORE INTO contract_invoice_runs (contract_id,invoice_date,amount,vat_rate) VALUES (?,?,?,?)',[c.id,inv,c.amount,c.vat_rate]);invoices++;inv=addInterval(inv,c.billing_interval,1)}if(inv)await pool.query('UPDATE service_contracts SET next_invoice_date=? WHERE id=?',[inv,c.id])}
  return NextResponse.json({ok:true,visits,invoices});
 }
 if(b.action==='workorder'){
  const id=Number(b.visit_id);const [rows]:any=await pool.query(`SELECT v.*,c.*,cu.street,cu.house_number,cu.postal_code,cu.city FROM contract_visits v JOIN service_contracts c ON c.id=v.contract_id LEFT JOIN customers cu ON cu.id=c.customer_id WHERE v.id=?`,[id]);const x=rows[0];if(!x)return NextResponse.json({error:'Onderhoudsbeurt niet gevonden'},{status:404});if(x.work_order_id)return NextResponse.json({id:x.work_order_id});
  const y=new Date().getFullYear();const [n]:any=await pool.query('SELECT work_order_number n FROM work_orders WHERE work_order_number LIKE ? ORDER BY id DESC LIMIT 1',[`WB-${y}-%`]);const no=`WB-${y}-${String(Number(String(n[0]?.n||'').split('-').pop()||0)+1).padStart(4,'0')}`;const address=x.location||[x.street,x.house_number].filter(Boolean).join(' ');const [r]:any=await pool.query(`INSERT INTO work_orders (work_order_number,customer_id,title,description,status,priority,assigned_to,scheduled_date,address,postal_code,city,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[no,x.customer_id,`Onderhoud: ${x.name}`,x.description||x.notes||null,'concept','normaal',x.assigned_to||null,String(x.planned_date).slice(0,10),address||null,x.postal_code||null,x.city||null,s.name||s.email||'gebruiker']);await pool.query("UPDATE contract_visits SET work_order_id=?,status='werkbon' WHERE id=?",[r.insertId,id]);return NextResponse.json({id:r.insertId,number:no});
 }
 if(b.action==='complete'){await pool.query("UPDATE contract_visits SET status='gereed',completed_at=NOW() WHERE id=?",[Number(b.visit_id)]);return NextResponse.json({ok:true})}
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}
export async function PUT(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json(),d=b.data||{},id=Number(d.id);if(!id)return NextResponse.json({error:'Contract ontbreekt'},{status:400});const allowed=['customer_id','name','description','status','start_date','end_date','renewal_type','notice_days','interval_type','interval_count','next_service_date','preferred_day','assigned_to','location','amount','vat_rate','billing_interval','next_invoice_date','auto_create_work_order','auto_invoice','notes'];const keys=allowed.filter(k=>Object.prototype.hasOwnProperty.call(d,k));await pool.query(`UPDATE service_contracts SET ${keys.map(k=>'`'+k+'`=?').join(',')} WHERE id=?`,[...keys.map(k=>d[k]??null),id]);return NextResponse.json({ok:true});
}
