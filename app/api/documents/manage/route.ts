import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const allowedTypes=['offerte','factuur','werkbon','creditfactuur'];
const allowedStatuses=['concept','verzonden','geaccepteerd','afgewezen','gefactureerd','betaald','geannuleerd'];

async function ensureSchema(){
 await pool.query(`CREATE TABLE IF NOT EXISTS document_revisions (
  id INT NOT NULL AUTO_INCREMENT,
  document_id INT NOT NULL,
  revision_number INT NOT NULL,
  snapshot LONGTEXT NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY uq_document_revision(document_id,revision_number),
  KEY idx_document_revisions_document(document_id),
  CONSTRAINT fk_document_revisions_document FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 const [cols]:any=await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='document_items'",[process.env.DB_NAME]);
 const set=new Set(cols.map((x:any)=>x.COLUMN_NAME));
 if(!set.has('line_type'))await pool.query("ALTER TABLE document_items ADD COLUMN line_type VARCHAR(30) NOT NULL DEFAULT 'artikel'");
 if(!set.has('discount_percentage'))await pool.query("ALTER TABLE document_items ADD COLUMN discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00");
 if(!set.has('position'))await pool.query("ALTER TABLE document_items ADD COLUMN position INT NOT NULL DEFAULT 0");
}
function cleanItem(i:any,index:number){
 const quantity=Number(i.quantity||0),unitPrice=Number(i.unit_price||0),discount=Number(i.discount_percentage||0),vat=Number(i.vat_rate||0);
 const net=quantity*unitPrice*(1-discount/100);
 return {description:String(i.description||'').slice(0,255),quantity,unit:String(i.unit||'stuk').slice(0,30),unit_price:unitPrice,vat_rate:vat,total:Number(net.toFixed(2)),inventory_id:i.inventory_id||null,line_type:String(i.line_type||'artikel').slice(0,30),discount_percentage:discount,position:index};
}
async function snapshot(connection:any,id:number,userId?:number){
 const [docs]:any=await connection.query('SELECT * FROM documents WHERE id=?',[id]);
 const [items]:any=await connection.query('SELECT * FROM document_items WHERE document_id=? ORDER BY position,id',[id]);
 if(!docs.length)return;
 const [r]:any=await connection.query('SELECT COALESCE(MAX(revision_number),0)+1 AS n FROM document_revisions WHERE document_id=? FOR UPDATE',[id]);
 await connection.query('INSERT INTO document_revisions(document_id,revision_number,snapshot,created_by) VALUES(?,?,?,?)',[id,r[0].n,JSON.stringify({document:docs[0],items}),userId||null]);
}
export async function GET(req:Request){
 const s:any=await readSession();if(!can(s,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();
 const {searchParams}=new URL(req.url),id=Number(searchParams.get('id'));
 if(id){
  const [d]:any=await pool.query('SELECT * FROM documents WHERE id=?',[id]);if(!d.length)return NextResponse.json({error:'Niet gevonden'},{status:404});
  const [items]:any=await pool.query('SELECT * FROM document_items WHERE document_id=? ORDER BY position,id',[id]);
  const [revisions]:any=await pool.query('SELECT id,revision_number,created_at FROM document_revisions WHERE document_id=? ORDER BY revision_number DESC',[id]);
  return NextResponse.json({document:d[0],items,revisions});
 }
 const [customers]:any=await pool.query('SELECT id,customer_number,name,company_name,contact_person,payment_term,vat_rate,discount_percentage FROM customers WHERE active=1 ORDER BY company_name,name');
 const [inventory]:any=await pool.query('SELECT id,sku,name,unit,sale_price FROM inventory ORDER BY name');
 return NextResponse.json({customers,inventory});
}
export async function POST(req:Request){
 const s:any=await readSession();if(!can(s,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();const body=await req.json();const action=body.action||'save';
 const connection=await pool.getConnection();
 try{
  await connection.beginTransaction();
  if(action==='status'){
   const id=Number(body.id),status=String(body.status);if(!allowedStatuses.includes(status))throw new Error('Ongeldige status');
   await snapshot(connection,id,s?.id);await connection.query('UPDATE documents SET status=?,updated_at=NOW() WHERE id=?',[status,id]);await connection.commit();return NextResponse.json({ok:true});
  }
  if(action==='convert'){
   const sourceId=Number(body.id),targetType=String(body.targetType);if(!allowedTypes.includes(targetType))throw new Error('Ongeldig documenttype');
   const [src]:any=await connection.query('SELECT * FROM documents WHERE id=? FOR UPDATE',[sourceId]);if(!src.length)throw new Error('Brondocument niet gevonden');
   const [items]:any=await connection.query('SELECT * FROM document_items WHERE document_id=? ORDER BY position,id',[sourceId]);
   const [counter]:any=await connection.query('SELECT next_number FROM document_counters WHERE document_type=? AND year=? FOR UPDATE',[targetType,new Date().getFullYear()]);
   const year=new Date().getFullYear(),prefix:{[k:string]:string}={offerte:'OFF',factuur:'FAC',werkbon:'WRK',creditfactuur:'CRD'};
   let n=counter[0]?.next_number||1;if(counter.length)await connection.query('UPDATE document_counters SET next_number=? WHERE document_type=? AND year=?',[n+1,targetType,year]);else await connection.query('INSERT INTO document_counters(document_type,year,next_number) VALUES(?,?,?)',[targetType,year,2]);
   const number=`${prefix[targetType]}-${year}-${String(n).padStart(4,'0')}`;
   const [ins]:any=await connection.query('INSERT INTO documents(type,number,customer_id,issue_date,due_date,status,subtotal,vat_total,total,notes) VALUES(?,?,?,CURDATE(),DATE_ADD(CURDATE(),INTERVAL 14 DAY),?,?,?,?,?)',[targetType,number,src[0].customer_id,'concept',src[0].subtotal,src[0].vat_total,src[0].total,`Omgezet vanuit ${src[0].number}. ${src[0].notes||''}`]);
   for(const i of items)await connection.query('INSERT INTO document_items(document_id,description,quantity,unit,unit_price,vat_rate,total,inventory_id,line_type,discount_percentage,position) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[ins.insertId,i.description,i.quantity,i.unit,i.unit_price,i.vat_rate,i.total,i.inventory_id,i.line_type||'artikel',i.discount_percentage||0,i.position||0]);
   await connection.query("UPDATE documents SET status='gefactureerd',updated_at=NOW() WHERE id=? AND type='offerte'",[sourceId]);await connection.commit();return NextResponse.json({id:ins.insertId,number});
  }
  const doc=body.document||{},items=(body.items||[]).map(cleanItem);if(!allowedTypes.includes(doc.type))throw new Error('Ongeldig documenttype');if(!doc.customer_id)throw new Error('Kies een klant');if(!items.length)throw new Error('Voeg minimaal één regel toe');
  const subtotal=items.reduce((a:number,i:any)=>a+i.total,0),vatTotal=items.reduce((a:number,i:any)=>a+i.total*i.vat_rate/100,0),total=subtotal+vatTotal;
  let id=Number(doc.id||0);
  if(id){
   await snapshot(connection,id,s?.id);
   await connection.query('UPDATE documents SET customer_id=?,issue_date=?,due_date=?,status=?,subtotal=?,vat_total=?,total=?,notes=?,updated_at=NOW() WHERE id=?',[doc.customer_id,doc.issue_date||null,doc.due_date||null,allowedStatuses.includes(doc.status)?doc.status:'concept',subtotal.toFixed(2),vatTotal.toFixed(2),total.toFixed(2),doc.notes||null,id]);
   await connection.query('DELETE FROM document_items WHERE document_id=?',[id]);
  }else{
   const year=new Date(doc.issue_date||Date.now()).getFullYear(),prefix:{[k:string]:string}={offerte:'OFF',factuur:'FAC',werkbon:'WRK',creditfactuur:'CRD'};
   const [counter]:any=await connection.query('SELECT next_number FROM document_counters WHERE document_type=? AND year=? FOR UPDATE',[doc.type,year]);let n=counter[0]?.next_number||1;
   if(counter.length)await connection.query('UPDATE document_counters SET next_number=? WHERE document_type=? AND year=?',[n+1,doc.type,year]);else await connection.query('INSERT INTO document_counters(document_type,year,next_number) VALUES(?,?,?)',[doc.type,year,2]);
   const number=`${prefix[doc.type]}-${year}-${String(n).padStart(4,'0')}`;
   const [ins]:any=await connection.query('INSERT INTO documents(type,number,customer_id,issue_date,due_date,status,subtotal,vat_total,total,notes) VALUES(?,?,?,?,?,?,?,?,?,?)',[doc.type,number,doc.customer_id,doc.issue_date||null,doc.due_date||null,'concept',subtotal.toFixed(2),vatTotal.toFixed(2),total.toFixed(2),doc.notes||null]);id=ins.insertId;
  }
  for(const i of items)await connection.query('INSERT INTO document_items(document_id,description,quantity,unit,unit_price,vat_rate,total,inventory_id,line_type,discount_percentage,position) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,i.description,i.quantity,i.unit,i.unit_price,i.vat_rate,i.total,i.inventory_id,i.line_type,i.discount_percentage,i.position]);
  await snapshot(connection,id,s?.id);await connection.commit();return NextResponse.json({id});
 }catch(e:any){await connection.rollback();return NextResponse.json({error:e.message||'Opslaan mislukt'},{status:400})}finally{connection.release()}
}