import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS planning_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NULL,
  technician_name VARCHAR(190) NULL,
  title VARCHAR(190) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'gepland',
  priority VARCHAR(30) NOT NULL DEFAULT 'normaal',
  location VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_planning_start(start_at),
  INDEX idx_planning_status(status),
  INDEX idx_planning_customer(customer_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
 await pool.query(`CREATE TABLE IF NOT EXISTS technician_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_name VARCHAR(190) NOT NULL,
  availability_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'beschikbaar',
  start_time TIME NULL,
  end_time TIME NULL,
  notes VARCHAR(255) NULL,
  UNIQUE KEY uq_tech_date(technician_name,availability_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function GET(req:Request){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const {searchParams}=new URL(req.url);
 const from=searchParams.get('from')||new Date().toISOString().slice(0,10);
 const to=searchParams.get('to')||from;
 const [events]:any=await pool.query(`SELECT p.*,c.name,c.company_name,c.contact_person,c.phone,c.mobile
  FROM planning_events p LEFT JOIN customers c ON c.id=p.customer_id
  WHERE DATE(p.start_at) BETWEEN ? AND ? ORDER BY p.start_at,p.id`,[from,to]);
 const [customers]:any=await pool.query(`SELECT id,name,company_name,contact_person,street,house_number,postal_code,city,phone,mobile FROM customers WHERE active<>0 ORDER BY COALESCE(company_name,name,contact_person)`);
 const [availability]:any=await pool.query(`SELECT * FROM technician_availability WHERE availability_date BETWEEN ? AND ? ORDER BY availability_date,technician_name`,[from,to]);
 return NextResponse.json({events,customers,availability});
}

export async function POST(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const b=await req.json();
 if(!b.title||!b.start_at||!b.end_at)return NextResponse.json({error:'Titel, start en einde zijn verplicht'},{status:400});
 if(new Date(b.end_at)<=new Date(b.start_at))return NextResponse.json({error:'Eindtijd moet na de starttijd liggen'},{status:400});
 const [r]:any=await pool.query(`INSERT INTO planning_events(customer_id,technician_name,title,start_at,end_at,status,priority,location,notes) VALUES(?,?,?,?,?,?,?,?,?)`,[
  b.customer_id||null,b.technician_name||null,b.title,b.start_at,b.end_at,b.status||'gepland',b.priority||'normaal',b.location||null,b.notes||null
 ]);
 return NextResponse.json({ok:true,id:r.insertId});
}

export async function PUT(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const b=await req.json();
 const id=Number(b.id);
 if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'Ongeldige planning'},{status:400});
 const allowed=['customer_id','technician_name','title','start_at','end_at','status','priority','location','notes'];
 const keys=allowed.filter(k=>Object.prototype.hasOwnProperty.call(b,k));
 if(!keys.length)return NextResponse.json({error:'Geen wijzigingen ontvangen'},{status:400});
 await pool.query(`UPDATE planning_events SET ${keys.map(k=>`\`${k}\`=?`).join(',')} WHERE id=?`,[...keys.map(k=>b[k]||null),id]);
 return NextResponse.json({ok:true});
}

export async function DELETE(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const {id}=await req.json();
 await pool.query('DELETE FROM planning_events WHERE id=?',[Number(id)]);
 return NextResponse.json({ok:true});
}