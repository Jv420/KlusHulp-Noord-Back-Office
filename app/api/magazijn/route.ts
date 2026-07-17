import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let ready=false;
async function schema(){
 if(ready)return;
 await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_number VARCHAR(40) UNIQUE,
  name VARCHAR(190) NOT NULL,
  contact_person VARCHAR(190) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(60) NULL,
  street VARCHAR(190) NULL,
  house_number VARCHAR(30) NULL,
  postal_code VARCHAR(20) NULL,
  city VARCHAR(120) NULL,
  kvk VARCHAR(40) NULL,
  vat_number VARCHAR(50) NULL,
  iban VARCHAR(50) NULL,
  payment_term INT NOT NULL DEFAULT 14,
  active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  supplier_id INT NULL,
  order_date DATE NOT NULL,
  expected_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'concept',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  received_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_po_supplier(supplier_id), INDEX idx_po_status(status)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  inventory_id INT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(40) NOT NULL DEFAULT 'stuk',
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  received_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  INDEX idx_poi_order(purchase_order_id), INDEX idx_poi_inventory(inventory_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS warehouse_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  movement_type VARCHAR(30) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reference_type VARCHAR(40) NULL,
  reference_id INT NULL,
  notes VARCHAR(255) NULL,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wm_inventory(inventory_id), INDEX idx_wm_reference(reference_type,reference_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 ready=true;
}
async function nextNumber(table:string,column:string,prefix:string){
 const year=new Date().getFullYear();
 const [rows]:any=await pool.query(`SELECT \`${column}\` n FROM \`${table}\` WHERE \`${column}\` LIKE ? ORDER BY id DESC LIMIT 1`,[`${prefix}-${year}-%`]);
 const last=Number(String(rows[0]?.n||'').split('-').pop()||0)+1;
 return `${prefix}-${year}-${String(last).padStart(4,'0')}`;
}
async function auth(permission:string){const s=await readSession();return can(s,permission)?s:null}
export async function GET(){
 const s=await auth('data.read');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});
 await schema();
 const [[suppliers],[orders],[items],[inventory],[movements]]:any=await Promise.all([
  pool.query('SELECT * FROM suppliers ORDER BY name'),
  pool.query(`SELECT po.*,s.name supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id ORDER BY po.id DESC`),
  pool.query('SELECT * FROM purchase_order_items ORDER BY id'),
  pool.query('SELECT * FROM inventory ORDER BY name'),
  pool.query(`SELECT wm.*,i.name inventory_name,i.sku FROM warehouse_movements wm LEFT JOIN inventory i ON i.id=wm.inventory_id ORDER BY wm.id DESC LIMIT 100`)
 ]);
 return NextResponse.json({suppliers,orders,items,inventory,movements});
}
export async function POST(req:Request){
 const s:any=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});
 await schema();const b=await req.json();
 if(b.action==='supplier'){
  const d=b.data||{};if(!d.name)return NextResponse.json({error:'Naam is verplicht'},{status:400});
  if(!d.supplier_number)d.supplier_number=await nextNumber('suppliers','supplier_number','LEV');
  const keys=Object.keys(d).filter(k=>k!=='id');const [r]:any=await pool.query(`INSERT INTO suppliers (${keys.map(k=>'`'+k+'`').join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,keys.map(k=>d[k]??null));
  return NextResponse.json({id:r.insertId,number:d.supplier_number});
 }
 if(b.action==='order'){
  const d=b.data||{},items=Array.isArray(b.items)?b.items:[];if(!d.supplier_id)return NextResponse.json({error:'Leverancier is verplicht'},{status:400});
  const orderNumber=await nextNumber('purchase_orders','order_number','INK');
  const subtotal=items.reduce((a:number,x:any)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0);
  const vat=items.reduce((a:number,x:any)=>a+(Number(x.quantity||0)*Number(x.unit_price||0))*Number(x.vat_rate??21)/100,0);
  const conn=await pool.getConnection();try{await conn.beginTransaction();const [r]:any=await conn.query('INSERT INTO purchase_orders (order_number,supplier_id,order_date,expected_date,status,subtotal,vat_total,total,notes) VALUES (?,?,?,?,?,?,?,?,?)',[orderNumber,d.supplier_id,d.order_date||new Date().toISOString().slice(0,10),d.expected_date||null,d.status||'concept',subtotal,vat,subtotal+vat,d.notes||null]);for(const x of items){if(!x.description)continue;const line=Number(x.quantity||0)*Number(x.unit_price||0);await conn.query('INSERT INTO purchase_order_items (purchase_order_id,inventory_id,description,quantity,unit,unit_price,vat_rate,line_total) VALUES (?,?,?,?,?,?,?,?)',[r.insertId,x.inventory_id||null,x.description,Number(x.quantity||0),x.unit||'stuk',Number(x.unit_price||0),Number(x.vat_rate??21),line])}await conn.commit();return NextResponse.json({id:r.insertId,number:orderNumber})}catch(e){await conn.rollback();return NextResponse.json({error:'Inkooporder opslaan mislukt'},{status:500})}finally{conn.release()}
 }
 if(b.action==='receive'){
  const id=Number(b.id);const conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]:any=await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id=? FOR UPDATE',[id]);for(const x of rows){const remaining=Number(x.quantity)-Number(x.received_quantity);if(remaining<=0||!x.inventory_id)continue;await conn.query('UPDATE inventory SET stock=stock+? WHERE id=?',[remaining,x.inventory_id]);await conn.query('UPDATE purchase_order_items SET received_quantity=quantity WHERE id=?',[x.id]);await conn.query('INSERT INTO warehouse_movements (inventory_id,movement_type,quantity,reference_type,reference_id,notes,created_by) VALUES (?,?,?,?,?,?,?)',[x.inventory_id,'inkoop',remaining,'purchase_order',id,x.description,s.name||s.email||'gebruiker'])}await conn.query("UPDATE purchase_orders SET status='ontvangen',received_at=NOW() WHERE id=?",[id]);await conn.commit();return NextResponse.json({ok:true})}catch(e){await conn.rollback();return NextResponse.json({error:'Ontvangst verwerken mislukt'},{status:500})}finally{conn.release()}
 }
 if(b.action==='movement'){
  const q=Number(b.quantity);if(!b.inventory_id||!q)return NextResponse.json({error:'Artikel en aantal zijn verplicht'},{status:400});
  const signed=b.movement_type==='uit'? -Math.abs(q):Math.abs(q);const conn=await pool.getConnection();try{await conn.beginTransaction();await conn.query('UPDATE inventory SET stock=stock+? WHERE id=?',[signed,b.inventory_id]);await conn.query('INSERT INTO warehouse_movements (inventory_id,movement_type,quantity,notes,created_by) VALUES (?,?,?,?,?)',[b.inventory_id,b.movement_type||'correctie',signed,b.notes||null,s.name||s.email||'gebruiker']);await conn.commit();return NextResponse.json({ok:true})}catch(e){await conn.rollback();return NextResponse.json({error:'Voorraadmutatie mislukt'},{status:500})}finally{conn.release()}
 }
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}
export async function PUT(req:Request){
 const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json();
 if(b.action!=='supplier')return NextResponse.json({error:'Ongeldige actie'},{status:400});const d=b.data||{},id=Number(d.id);const keys=Object.keys(d).filter(k=>!['id','created_at','updated_at'].includes(k));await pool.query(`UPDATE suppliers SET ${keys.map(k=>'`'+k+'`=?').join(',')} WHERE id=?`,[...keys.map(k=>d[k]??null),id]);return NextResponse.json({ok:true});
}
