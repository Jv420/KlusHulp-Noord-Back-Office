import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let ready=false;
async function schema(){
 if(ready)return;
 await pool.query(`CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration VARCHAR(20) NOT NULL UNIQUE,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(120) NOT NULL,
  vehicle_type VARCHAR(60) NOT NULL DEFAULT 'bestelbus',
  year INT NULL,
  fuel_type VARCHAR(40) NULL,
  vin VARCHAR(80) NULL,
  current_mileage INT NOT NULL DEFAULT 0,
  assigned_to VARCHAR(190) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'actief',
  purchase_date DATE NULL,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  lease_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  insurance_expiry DATE NULL,
  apk_expiry DATE NULL,
  road_tax_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vehicle_status(status), INDEX idx_vehicle_apk(apk_expiry)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS vehicle_mileage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  trip_date DATE NOT NULL,
  driver VARCHAR(190) NULL,
  start_mileage INT NOT NULL,
  end_mileage INT NOT NULL,
  business_km INT NOT NULL DEFAULT 0,
  private_km INT NOT NULL DEFAULT 0,
  from_location VARCHAR(190) NULL,
  to_location VARCHAR(190) NULL,
  purpose VARCHAR(255) NULL,
  work_order_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vm_vehicle(vehicle_id), INDEX idx_vm_date(trip_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS vehicle_costs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  cost_date DATE NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  amount_ex_vat DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  mileage INT NULL,
  supplier VARCHAR(190) NULL,
  reference VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vc_vehicle(vehicle_id), INDEX idx_vc_date(cost_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT NOT NULL,
  maintenance_type VARCHAR(80) NOT NULL,
  description TEXT NULL,
  planned_date DATE NULL,
  completed_date DATE NULL,
  planned_mileage INT NULL,
  completed_mileage INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'gepland',
  supplier VARCHAR(190) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vmaint_vehicle(vehicle_id), INDEX idx_vmaint_date(planned_date), INDEX idx_vmaint_status(status)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 ready=true;
}
async function auth(permission:string){const s=await readSession();return can(s,permission)?s:null}
const today=()=>new Date().toISOString().slice(0,10);

export async function GET(req:Request){
 const s=await auth('data.read');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();
 const id=Number(new URL(req.url).searchParams.get('id')||0);
 const [vehicles]:any=await pool.query(`SELECT v.*,
  COALESCE(c.total_cost,0) total_cost,
  COALESCE(m.business_km,0) business_km,
  COALESCE(m.private_km,0) private_km,
  CASE WHEN v.apk_expiry IS NOT NULL THEN DATEDIFF(v.apk_expiry,CURDATE()) ELSE NULL END apk_days
  FROM vehicles v
  LEFT JOIN (SELECT vehicle_id,SUM(amount_ex_vat+vat_amount) total_cost FROM vehicle_costs GROUP BY vehicle_id) c ON c.vehicle_id=v.id
  LEFT JOIN (SELECT vehicle_id,SUM(business_km) business_km,SUM(private_km) private_km FROM vehicle_mileage GROUP BY vehicle_id) m ON m.vehicle_id=v.id
  ${id?'WHERE v.id=?':''} ORDER BY v.status='actief' DESC,v.registration`,id?[id]:[]);
 if(!id){
  const [alerts]:any=await pool.query(`SELECT id,registration,brand,model,apk_expiry,insurance_expiry FROM vehicles WHERE status='actief' AND ((apk_expiry IS NOT NULL AND apk_expiry<=DATE_ADD(CURDATE(),INTERVAL 60 DAY)) OR (insurance_expiry IS NOT NULL AND insurance_expiry<=DATE_ADD(CURDATE(),INTERVAL 60 DAY))) ORDER BY LEAST(COALESCE(apk_expiry,'2999-12-31'),COALESCE(insurance_expiry,'2999-12-31'))`);
  return NextResponse.json({vehicles,alerts,kpis:{active:vehicles.filter((v:any)=>v.status==='actief').length,totalCosts:vehicles.reduce((a:number,v:any)=>a+Number(v.total_cost||0),0),businessKm:vehicles.reduce((a:number,v:any)=>a+Number(v.business_km||0),0),apkSoon:vehicles.filter((v:any)=>v.apk_days!==null&&Number(v.apk_days)<=60).length}});
 }
 const [[mileage],[costs],[maintenance],[workOrders]]:any=await Promise.all([
  pool.query('SELECT * FROM vehicle_mileage WHERE vehicle_id=? ORDER BY trip_date DESC,id DESC',[id]),
  pool.query('SELECT * FROM vehicle_costs WHERE vehicle_id=? ORDER BY cost_date DESC,id DESC',[id]),
  pool.query('SELECT * FROM vehicle_maintenance WHERE vehicle_id=? ORDER BY COALESCE(planned_date,completed_date) DESC,id DESC',[id]),
  pool.query("SELECT id,work_order_number,title,scheduled_date FROM work_orders ORDER BY id DESC LIMIT 300")
 ]);
 return NextResponse.json({vehicle:vehicles[0]||null,mileage,costs,maintenance,workOrders});
}

export async function POST(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json(),d=b.data||{};
 if(b.action==='vehicle'){
  if(!d.registration||!d.brand||!d.model)return NextResponse.json({error:'Kenteken, merk en model zijn verplicht'},{status:400});
  const [r]:any=await pool.query(`INSERT INTO vehicles (registration,brand,model,vehicle_type,year,fuel_type,vin,current_mileage,assigned_to,status,purchase_date,purchase_price,lease_monthly,insurance_expiry,apk_expiry,road_tax_monthly,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[String(d.registration).toUpperCase(),d.brand,d.model,d.vehicle_type||'bestelbus',d.year||null,d.fuel_type||null,d.vin||null,Number(d.current_mileage||0),d.assigned_to||null,d.status||'actief',d.purchase_date||null,Number(d.purchase_price||0),Number(d.lease_monthly||0),d.insurance_expiry||null,d.apk_expiry||null,Number(d.road_tax_monthly||0),d.notes||null]);
  return NextResponse.json({id:r.insertId});
 }
 if(b.action==='mileage'){
  if(!d.vehicle_id||!d.trip_date)return NextResponse.json({error:'Voertuig en datum zijn verplicht'},{status:400});
  const start=Number(d.start_mileage||0),end=Number(d.end_mileage||0);if(end<start)return NextResponse.json({error:'Eindstand mag niet lager zijn dan beginstand'},{status:400});
  const total=end-start,privateKm=Math.max(0,Number(d.private_km||0)),businessKm=Math.max(0,total-privateKm);
  const [r]:any=await pool.query(`INSERT INTO vehicle_mileage (vehicle_id,trip_date,driver,start_mileage,end_mileage,business_km,private_km,from_location,to_location,purpose,work_order_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,[d.vehicle_id,d.trip_date,d.driver||null,start,end,businessKm,privateKm,d.from_location||null,d.to_location||null,d.purpose||null,d.work_order_id||null]);
  await pool.query('UPDATE vehicles SET current_mileage=GREATEST(current_mileage,?) WHERE id=?',[end,d.vehicle_id]);return NextResponse.json({id:r.insertId,business_km:businessKm});
 }
 if(b.action==='cost'){
  if(!d.vehicle_id||!d.cost_date||!d.cost_type)return NextResponse.json({error:'Voertuig, datum en kostensoort zijn verplicht'},{status:400});
  const [r]:any=await pool.query(`INSERT INTO vehicle_costs (vehicle_id,cost_date,cost_type,description,amount_ex_vat,vat_amount,mileage,supplier,reference) VALUES (?,?,?,?,?,?,?,?,?)`,[d.vehicle_id,d.cost_date,d.cost_type,d.description||null,Number(d.amount_ex_vat||0),Number(d.vat_amount||0),d.mileage||null,d.supplier||null,d.reference||null]);return NextResponse.json({id:r.insertId});
 }
 if(b.action==='maintenance'){
  if(!d.vehicle_id||!d.maintenance_type)return NextResponse.json({error:'Voertuig en onderhoudstype zijn verplicht'},{status:400});
  const [r]:any=await pool.query(`INSERT INTO vehicle_maintenance (vehicle_id,maintenance_type,description,planned_date,completed_date,planned_mileage,completed_mileage,status,supplier,amount) VALUES (?,?,?,?,?,?,?,?,?,?)`,[d.vehicle_id,d.maintenance_type,d.description||null,d.planned_date||null,d.completed_date||null,d.planned_mileage||null,d.completed_mileage||null,d.status||'gepland',d.supplier||null,Number(d.amount||0)]);return NextResponse.json({id:r.insertId});
 }
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}

export async function PUT(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json(),d=b.data||{},id=Number(d.id);if(!id)return NextResponse.json({error:'Voertuig ontbreekt'},{status:400});
 const allowed=['registration','brand','model','vehicle_type','year','fuel_type','vin','current_mileage','assigned_to','status','purchase_date','purchase_price','lease_monthly','insurance_expiry','apk_expiry','road_tax_monthly','notes'];const keys=allowed.filter(k=>Object.prototype.hasOwnProperty.call(d,k));if(!keys.length)return NextResponse.json({ok:true});
 await pool.query(`UPDATE vehicles SET ${keys.map(k=>'`'+k+'`=?').join(',')} WHERE id=?`,[...keys.map(k=>k==='registration'?String(d[k]).toUpperCase():(d[k]===''?null:d[k])),id]);return NextResponse.json({ok:true});
}

export async function DELETE(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json(),id=Number(b.id);if(!id)return NextResponse.json({error:'Ongeldig item'},{status:400});
 const tables:Record<string,string>={mileage:'vehicle_mileage',cost:'vehicle_costs',maintenance:'vehicle_maintenance'};const table=tables[b.type];if(!table)return NextResponse.json({error:'Ongeldig type'},{status:400});await pool.query(`DELETE FROM ${table} WHERE id=?`,[id]);return NextResponse.json({ok:true});
}
