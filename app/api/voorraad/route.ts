import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

let ready=false;
async function schema(){
 if(ready)return;
 await pool.query(`CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(80) NOT NULL UNIQUE,
  barcode VARCHAR(120) NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  category VARCHAR(120) NULL,
  supplier VARCHAR(190) NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'stuk',
  stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  reserved_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  max_stock DECIMAL(12,3) NULL,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  sales_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
  location VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inventory_name(name), INDEX idx_inventory_category(category), INDEX idx_inventory_stock(stock), INDEX idx_inventory_active(active)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS warehouse_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  movement_type VARCHAR(40) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NULL,
  reference_type VARCHAR(40) NULL,
  reference_id INT NULL,
  notes TEXT NULL,
  created_by VARCHAR(190) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movement_inventory(inventory_id), INDEX idx_movement_created(created_at), INDEX idx_movement_reference(reference_type,reference_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await pool.query(`CREATE TABLE IF NOT EXISTS inventory_counts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  expected_stock DECIMAL(12,3) NOT NULL,
  counted_stock DECIMAL(12,3) NOT NULL,
  difference_stock DECIMAL(12,3) NOT NULL,
  notes TEXT NULL,
  counted_by VARCHAR(190) NULL,
  counted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_count_inventory(inventory_id), INDEX idx_count_date(counted_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 ready=true;
}
async function auth(permission:string){const s=await readSession();return can(s,permission)?s:null}
const actor=(s:any)=>s?.name||s?.email||'gebruiker';

export async function GET(req:Request){
 const s=await auth('data.read');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();
 const url=new URL(req.url),id=Number(url.searchParams.get('id')||0),q=String(url.searchParams.get('q')||'').trim(),low=url.searchParams.get('low')==='1';
 const params:any[]=[];let where='WHERE i.active<>0';if(id){where+=' AND i.id=?';params.push(id)}if(q){where+=' AND (i.name LIKE ? OR i.sku LIKE ? OR i.barcode LIKE ? OR i.category LIKE ?)';const like=`%${q}%`;params.push(like,like,like,like)}if(low)where+=' AND i.stock<=i.min_stock';
 const [items]:any=await pool.query(`SELECT i.*,GREATEST(i.stock-i.reserved_stock,0) available_stock,(i.stock*i.purchase_price) stock_value,CASE WHEN i.stock<=i.min_stock THEN 1 ELSE 0 END low_stock FROM inventory i ${where} ORDER BY low_stock DESC,i.name`,params);
 const [movements]:any=await pool.query(`SELECT m.*,i.sku,i.name inventory_name,i.unit FROM warehouse_movements m JOIN inventory i ON i.id=m.inventory_id ${id?'WHERE m.inventory_id=?':''} ORDER BY m.created_at DESC,m.id DESC LIMIT 500`,id?[id]:[]);
 const [counts]:any=id?await pool.query('SELECT * FROM inventory_counts WHERE inventory_id=? ORDER BY counted_at DESC',[id]):[[]];
 const [cats]:any=await pool.query("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL AND category<>'' ORDER BY category");
 const kpis={articles:items.length,lowStock:items.filter((x:any)=>x.low_stock).length,stockValue:items.reduce((a:number,x:any)=>a+Number(x.stock_value||0),0),salesValue:items.reduce((a:number,x:any)=>a+Number(x.stock||0)*Number(x.sales_price||0),0),outOfStock:items.filter((x:any)=>Number(x.stock)<=0).length};
 return NextResponse.json({items,movements,counts,categories:cats.map((x:any)=>x.category),kpis});
}

export async function POST(req:Request){
 const s:any=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json();
 if(b.action==='create'){
  const d=b.data||{};if(!d.sku||!d.name)return NextResponse.json({error:'Artikelnummer en naam zijn verplicht'},{status:400});
  try{const [r]:any=await pool.query(`INSERT INTO inventory(sku,barcode,name,description,category,supplier,unit,stock,reserved_stock,min_stock,max_stock,purchase_price,sales_price,vat_rate,location,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[d.sku,d.barcode||null,d.name,d.description||null,d.category||null,d.supplier||null,d.unit||'stuk',Number(d.stock||0),Number(d.reserved_stock||0),Number(d.min_stock||0),d.max_stock===''||d.max_stock==null?null:Number(d.max_stock),Number(d.purchase_price||0),Number(d.sales_price||0),Number(d.vat_rate??21),d.location||null,d.active===0?0:1]);if(Number(d.stock||0)!==0)await pool.query(`INSERT INTO warehouse_movements(inventory_id,movement_type,quantity,unit_price,reference_type,notes,created_by) VALUES(?,?,?,?,?,?,?)`,[r.insertId,'beginvoorraad',Number(d.stock),Number(d.purchase_price||0),'inventory','Beginvoorraad',actor(s)]);return NextResponse.json({id:r.insertId});}catch(e:any){return NextResponse.json({error:e?.code==='ER_DUP_ENTRY'?'Artikelnummer bestaat al':'Artikel aanmaken mislukt'},{status:400})}
 }
 if(b.action==='movement'){
  const d=b.data||{},id=Number(d.inventory_id),qty=Number(d.quantity);if(!id||!qty)return NextResponse.json({error:'Artikel en hoeveelheid zijn verplicht'},{status:400});const conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]:any=await conn.query('SELECT stock FROM inventory WHERE id=? FOR UPDATE',[id]);if(!rows[0])throw new Error('Artikel niet gevonden');const next=Number(rows[0].stock)+qty;if(next<0)throw new Error('Onvoldoende voorraad');await conn.query('UPDATE inventory SET stock=? WHERE id=?',[next,id]);const [r]:any=await conn.query(`INSERT INTO warehouse_movements(inventory_id,movement_type,quantity,unit_price,reference_type,reference_id,notes,created_by) VALUES(?,?,?,?,?,?,?,?)`,[id,d.movement_type||'correctie',qty,d.unit_price==null?null:Number(d.unit_price),d.reference_type||null,d.reference_id||null,d.notes||null,actor(s)]);await conn.commit();return NextResponse.json({id:r.insertId,stock:next});}catch(e:any){await conn.rollback();return NextResponse.json({error:e?.message||'Voorraadmutatie mislukt'},{status:400})}finally{conn.release()}
 }
 if(b.action==='count'){
  const d=b.data||{},id=Number(d.inventory_id),counted=Number(d.counted_stock);if(!id||Number.isNaN(counted)||counted<0)return NextResponse.json({error:'Artikel en geldige telling zijn verplicht'},{status:400});const conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]:any=await conn.query('SELECT stock FROM inventory WHERE id=? FOR UPDATE',[id]);if(!rows[0])throw new Error('Artikel niet gevonden');const expected=Number(rows[0].stock),difference=counted-expected;const [r]:any=await conn.query('INSERT INTO inventory_counts(inventory_id,expected_stock,counted_stock,difference_stock,notes,counted_by) VALUES(?,?,?,?,?,?)',[id,expected,counted,difference,d.notes||null,actor(s)]);if(difference!==0){await conn.query('UPDATE inventory SET stock=? WHERE id=?',[counted,id]);await conn.query(`INSERT INTO warehouse_movements(inventory_id,movement_type,quantity,reference_type,reference_id,notes,created_by) VALUES(?,?,?,?,?,?,?)`,[id,'telling',difference,'inventory_count',r.insertId,d.notes||'Voorraadtelling',actor(s)])}await conn.commit();return NextResponse.json({id:r.insertId,difference});}catch(e:any){await conn.rollback();return NextResponse.json({error:e?.message||'Telling verwerken mislukt'},{status:400})}finally{conn.release()}
 }
 return NextResponse.json({error:'Ongeldige actie'},{status:400});
}

export async function PUT(req:Request){const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const b=await req.json(),d=b.data||{},id=Number(d.id);if(!id)return NextResponse.json({error:'Artikel ontbreekt'},{status:400});const allowed=['sku','barcode','name','description','category','supplier','unit','reserved_stock','min_stock','max_stock','purchase_price','sales_price','vat_rate','location','active'];const keys=allowed.filter(k=>Object.prototype.hasOwnProperty.call(d,k));if(!keys.length)return NextResponse.json({ok:true});await pool.query(`UPDATE inventory SET ${keys.map(k=>`\`${k}\`=?`).join(',')} WHERE id=?`,[...keys.map(k=>d[k]===''?null:d[k]),id]);return NextResponse.json({ok:true});}

export async function DELETE(req:Request){const s=await auth('data.write');if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});await schema();const id=Number(new URL(req.url).searchParams.get('id')||0);if(!id)return NextResponse.json({error:'Artikel ontbreekt'},{status:400});const [used]:any=await pool.query('SELECT COUNT(*) n FROM work_order_materials WHERE inventory_id=?',[id]);if(Number(used[0]?.n||0)>0){await pool.query('UPDATE inventory SET active=0 WHERE id=?',[id]);return NextResponse.json({ok:true,archived:true})}await pool.query('DELETE FROM inventory WHERE id=?',[id]);return NextResponse.json({ok:true});}
