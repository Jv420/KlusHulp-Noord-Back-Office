import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let schemaReady=false;
async function ensureSchema(){
 if(schemaReady)return;
 const additions:Record<string,string>={
  appointment_type:"VARCHAR(40) NOT NULL DEFAULT 'klus'",
  priority:"VARCHAR(20) NOT NULL DEFAULT 'normaal'",
  assigned_to:"INT DEFAULT NULL",
  all_day:"TINYINT(1) NOT NULL DEFAULT 0",
  color:"VARCHAR(20) NOT NULL DEFAULT '#f5c400'",
  reminder_minutes:"INT NOT NULL DEFAULT 60",
  completed_at:"DATETIME DEFAULT NULL"
 };
 const [rows]:any=await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='appointments'",[process.env.DB_NAME]);
 const existing=new Set(rows.map((r:any)=>r.COLUMN_NAME));
 for(const [name,definition] of Object.entries(additions))if(!existing.has(name))await pool.query(`ALTER TABLE appointments ADD COLUMN \`${name}\` ${definition}`);
 schemaReady=true;
}

export async function GET(req:Request){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const {searchParams}=new URL(req.url);
 const from=searchParams.get('from');
 const to=searchParams.get('to');
 const params:any[]=[];
 let where='1=1';
 if(from){where+=' AND a.start_at>=?';params.push(from)}
 if(to){where+=' AND a.start_at<?';params.push(to)}
 const [appointments]:any=await pool.query(`SELECT a.*,c.customer_number,c.name AS customer_name,c.company_name,c.contact_person,c.phone,c.mobile,c.email FROM appointments a LEFT JOIN customers c ON c.id=a.customer_id WHERE ${where} ORDER BY a.start_at ASC`,params);
 const [customers]:any=await pool.query("SELECT id,customer_number,name,company_name,contact_person,street,house_number,postal_code,city,color FROM customers WHERE active=1 ORDER BY company_name,name");
 const [users]:any=await pool.query("SELECT id,name,email FROM users WHERE active=1 ORDER BY name");
 return NextResponse.json({appointments,customers,users});
}

export async function POST(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const b=await req.json();
 if(!b.title||!b.start_at)return NextResponse.json({error:'Titel en starttijd zijn verplicht'},{status:400});
 const end=b.end_at||b.start_at;
 const [r]:any=await pool.query(`INSERT INTO appointments (customer_id,title,start_at,end_at,status,location,notes,appointment_type,priority,assigned_to,all_day,color,reminder_minutes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
  b.customer_id||null,b.title,b.start_at,end,b.status||'gepland',b.location||null,b.notes||null,b.appointment_type||'klus',b.priority||'normaal',b.assigned_to||null,Number(b.all_day||0),b.color||'#f5c400',Number(b.reminder_minutes??60)
 ]);
 return NextResponse.json({id:r.insertId});
}

export async function PUT(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const b=await req.json();
 if(!b.id)return NextResponse.json({error:'Afspraak ontbreekt'},{status:400});
 const completed=b.status==='afgerond'?'NOW()':'NULL';
 await pool.query(`UPDATE appointments SET customer_id=?,title=?,start_at=?,end_at=?,status=?,location=?,notes=?,appointment_type=?,priority=?,assigned_to=?,all_day=?,color=?,reminder_minutes=?,completed_at=${completed} WHERE id=?`,[
  b.customer_id||null,b.title,b.start_at,b.end_at||b.start_at,b.status||'gepland',b.location||null,b.notes||null,b.appointment_type||'klus',b.priority||'normaal',b.assigned_to||null,Number(b.all_day||0),b.color||'#f5c400',Number(b.reminder_minutes??60),b.id
 ]);
 return NextResponse.json({ok:true});
}

export async function DELETE(req:Request){
 const session=await readSession();
 if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const {id}=await req.json();
 await pool.query("UPDATE appointments SET status='geannuleerd' WHERE id=?",[id]);
 return NextResponse.json({ok:true});
}
