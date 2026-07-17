import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let ready=false;
async function schema(){
 if(ready)return;
 await pool.query(`CREATE TABLE IF NOT EXISTS work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id INT NULL,
  appointment_id INT NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'concept',
  priority VARCHAR(20) NOT NULL DEFAULT 'normaal',
  assigned_to VARCHAR(190) NULL,
  scheduled_date DATE NULL,
  scheduled_start TIME NULL,
  scheduled_end TIME NULL,
  address VARCHAR(255) NULL,
  postal_code VARCHAR(20) NULL,
  city VARCHAR(120) NULL,
  kilometers DECIMAL(10,2) NOT NULL DEFAULT 0,
  internal_notes TEXT NULL,
  customer_notes TEXT NULL,
  completed_at DATETIME NULL,
  invoiced_at DATETIME NULL,
  invoice_id INT NULL,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wo_customer(customer_id), INDEX idx_wo_appointment(appointment_id), INDEX idx_wo_status(status), INDEX idx_wo_date(scheduled_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS work_order_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  inventory_id INT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(40) NOT NULL DEFAULT 'stuk',
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  deducted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wom_order(work_order_id), INDEX idx_wom_inventory(inventory_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS work_order_hours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  employee_name VARCHAR(190) NULL,
  work_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  break_minutes INT NOT NULL DEFAULT 0,
  hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_woh_order(work_order_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS work_order_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  photo_type VARCHAR(20) NOT NULL DEFAULT 'voor',
  filename VARCHAR(255) NULL,
  mime_type VARCHAR(100) NULL,
  data MEDIUMTEXT NOT NULL,
  caption VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wop_order(work_order_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS work_order_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  signer_type VARCHAR(20) NOT NULL,
  signer_name VARCHAR(190) NULL,
  signature MEDIUMTEXT NOT NULL,
  signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wos(work_order_id,signer_type)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS work_order_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  note_type VARCHAR(20) NOT NULL DEFAULT 'intern',
  note TEXT NOT NULL,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_won_order(work_order_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 ready=true;
}
async function auth(permission:string){const s=await readSession();return can(s,permission)?s:null}
async function nextNumber(){const y=new Date().getFullYear();const [rows]:any=await pool.query('SELECT work_order_number n FROM work_orders WHERE work_order_number LIKE ? ORDER BY id DESC LIMIT 1',[`WB-${y}-%`]);const n=Number(String(rows[0]?.n||'').split('-').pop()||0)+1;return `WB-${y}-${String(n).padStart(4,'0')}`}
const userName=(s:any)=>s?.name||s?.email||'gebruiker';
export async function GET(req:Request){
 const s=await auth('data.read');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();
 const id=Number(new URL(req.url).searchParams.get('id')||0);
 const [[orders],[customers],[appointments],[inventory]]:any=await Promise.all([
  pool.query(`SELECT w.*,c.name customer_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id ${id?'WHERE w.id=?':''} ORDER BY w.id DESC`,id?[id]:[]),
  pool.query('SELECT id,name,email,phone,street,house_number,postal_code,city FROM customers ORDER BY name'),
  pool.query('SELECT id,title,start_at,end_at,customer_id FROM appointments ORDER BY start_at DESC LIMIT 500'),
  pool.query('SELECT id,name,sku,stock,unit,purchase_price,sales_price,min_stock FROM inventory ORDER BY name')
 ]);
 if(!id)return NextResponse.json({orders,customers,appointments,inventory});
 const [[materials],[hours],[photos],[signatures],[notes]]:any=await Promise.all([
  pool.query('SELECT m.*,i.sku FROM work_order_materials m LEFT JOIN inventory i ON i.id=m.inventory_id WHERE m.work_order_id=? ORDER BY m.id',[id]),
  pool.query('SELECT * FROM work_order_hours WHERE work_order_id=? ORDER BY work_date,id',[id]),
  pool.query('SELECT id,work_order_id,photo_type,filename,mime_type,data,caption,created_at FROM work_order_photos WHERE work_order_id=? ORDER BY id',[id]),
  pool.query('SELECT * FROM work_order_signatures WHERE work_order_id=? ORDER BY id',[id]),
  pool.query('SELECT * FROM work_order_notes WHERE work_order_id=? ORDER BY id DESC',[id])
 ]);
 return NextResponse.json({order:orders[0]||null,materials,hours,photos,signatures,notes,customers,appointments,inventory});
}
export async function POST(req:Request){
 const s:any=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json();
 if(b.action==='create'){
  const d=b.data||{};if(!d.title)return NextResponse.json({error:'Titel is verplicht'},{status:400});const number=await nextNumber();
  const [r]:any=await pool.query(`INSERT INTO work_orders (work_order_number,customer_id,appointment_id,title,description,status,priority,assigned_to,scheduled_date,scheduled_start,scheduled_end,address,postal_code,city,kilometers,internal_notes,customer_notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[number,d.customer_id||null,d.appointment_id||null,d.title,d.description||null,d.status||'concept',d.priority||'normaal',d.assigned_to||null,d.scheduled_date||null,d.scheduled_start||null,d.scheduled_end||null,d.address||null,d.postal_code||null,d.city||null,Number(d.kilometers||0),d.internal_notes||null,d.customer_notes||null,userName(s)]);
  return NextResponse.json({id:r.insertId,number});
 }
 if(b.action==='material'){
  const d=b.data||{};if(!d.work_order_id||!d.description||!Number(d.quantity))return NextResponse.json({error:'Werkbon, materiaal en aantal zijn verplicht'},{status:400});
  const conn=await pool.getConnection();try{await conn.beginTransaction();let deducted=0;if(d.inventory_id){const [rows]:any=await conn.query('SELECT stock FROM inventory WHERE id=? FOR UPDATE',[d.inventory_id]);if(!rows[0])throw new Error('Artikel niet gevonden');if(Number(rows[0].stock)<Number(d.quantity))return NextResponse.json({error:'Onvoldoende voorraad'},{status:400});await conn.query('UPDATE inventory SET stock=stock-? WHERE id=?',[Number(d.quantity),d.inventory_id]);deducted=1;try{await conn.query('INSERT INTO warehouse_movements (inventory_id,movement_type,quantity,reference_type,reference_id,notes,created_by) VALUES (?,?,?,?,?,?,?)',[d.inventory_id,'werkbon',-Math.abs(Number(d.quantity)),'work_order',d.work_order_id,d.description,userName(s)])}catch{}}
   const [r]:any=await conn.query('INSERT INTO work_order_materials (work_order_id,inventory_id,description,quantity,unit,unit_price,deducted) VALUES (?,?,?,?,?,?,?)',[d.work_order_id,d.inventory_id||null,d.description,Number(d.quantity),d.unit||'stuk',Number(d.unit_price||0),deducted]);await conn.commit();return NextResponse.json({id:r.insertId})}catch(e:any){await conn.rollback();return NextResponse.json({error:e?.message||'Materiaal toevoegen mislukt'},{status:500})}finally{conn.release()}
 }
 if(b.action==='hours'){
  const d=b.data||{};if(!d.work_order_id||!d.work_date)return NextResponse.json({error:'Werkbon en datum zijn verplicht'},{status:400});let hours=Number(d.hours||0);if(!hours&&d.start_time&&d.end_time){const [sh,sm]=d.start_time.split(':').map(Number),[eh,em]=d.end_time.split(':').map(Number);hours=Math.max(0,((eh*60+em)-(sh*60+sm)-Number(d.break_minutes||0))/60)}
  const [r]:any=await pool.query('INSERT INTO work_order_hours (work_order_id,employee_name,work_date,start_time,end_time,break_minutes,hours,hourly_rate,description) VALUES (?,?,?,?,?,?,?,?,?)',[d.work_order_id,d.employee_name||userName(s),d.work_date,d.start_time||null,d.end_time||null,Number(d.break_minutes||0),hours,Number(d.hourly_rate||0),d.description||null]);return NextResponse.json({id:r.insertId,hours});
 }
 if(b.action==='note'){const d=b.data||{};if(!d.work_order_id||!d.note)return NextResponse.json({error:'Notitie is verplicht'},{status:400});const [r]:any=await pool.query('INSERT INTO work_order_notes (work_order_id,note_type,note,created_by) VALUES (?,?,?,?)',[d.work_order_id,d.note_type||'intern',d.note,userName(s)]);return NextResponse.json({id:r.insertId})}
 if(b.action==='photo'){const d=b.data||{};if(!d.work_order_id||!d.data)return NextResponse.json({error:'Foto ontbreekt'},{status:400});if(String(d.data).length>7000000)return NextResponse.json({error:'Foto is te groot'},{status:413});const [r]:any=await pool.query('INSERT INTO work_order_photos (work_order_id,photo_type,filename,mime_type,data,caption) VALUES (?,?,?,?,?,?)',[d.work_order_id,d.photo_type||'voor',d.filename||null,d.mime_type||null,d.data,d.caption||null]);return NextResponse.json({id:r.insertId})}
 if(b.action==='signature'){const d=b.data||{};if(!d.work_order_id||!d.signature||!d.signer_type)return NextResponse.json({error:'Handtekening ontbreekt'},{status:400});await pool.query(`INSERT INTO work_order_signatures (work_order_id,signer_type,signer_name,signature,signed_at) VALUES (?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE signer_name=VALUES(signer_name),signature=VALUES(signature),signed_at=NOW()`,[d.work_order_id,d.signer_type,d.signer_name||null,d.signature]);return NextResponse.json({ok:true})}
 if(b.action==='status'){const id=Number(b.id),status=String(b.status||'concept');await pool.query(`UPDATE work_orders SET status=?,completed_at=IF(?='gereed',COALESCE(completed_at,NOW()),completed_at),invoiced_at=IF(?='gefactureerd',COALESCE(invoiced_at,NOW()),invoiced_at) WHERE id=?`,[status,status,status,id]);return NextResponse.json({ok:true})}
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}
export async function PUT(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json(),d=b.data||{},id=Number(d.id);if(!id)return NextResponse.json({error:'Werkbon ontbreekt'},{status:400});
 const allowed=['customer_id','appointment_id','title','description','status','priority','assigned_to','scheduled_date','scheduled_start','scheduled_end','address','postal_code','city','kilometers','internal_notes','customer_notes'];const keys=allowed.filter(k=>Object.prototype.hasOwnProperty.call(d,k));if(!keys.length)return NextResponse.json({ok:true});await pool.query(`UPDATE work_orders SET ${keys.map(k=>'`'+k+'`=?').join(',')} WHERE id=?`,[...keys.map(k=>d[k]||null),id]);return NextResponse.json({ok:true});
}
export async function DELETE(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json();
 if(b.type==='photo'){await pool.query('DELETE FROM work_order_photos WHERE id=?',[Number(b.id)]);return NextResponse.json({ok:true})}
 if(b.type==='material'){const conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]:any=await conn.query('SELECT * FROM work_order_materials WHERE id=? FOR UPDATE',[Number(b.id)]);const x=rows[0];if(x?.deducted&&x.inventory_id)await conn.query('UPDATE inventory SET stock=stock+? WHERE id=?',[x.quantity,x.inventory_id]);await conn.query('DELETE FROM work_order_materials WHERE id=?',[Number(b.id)]);await conn.commit();return NextResponse.json({ok:true})}catch{await conn.rollback();return NextResponse.json({error:'Verwijderen mislukt'},{status:500})}finally{conn.release()}}
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}