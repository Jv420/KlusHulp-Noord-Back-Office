import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const tables=['customers','documents','document_items','inventory','inventory_movements','vehicles','vehicle_costs','time_entries','expenses','appointments','settings'];
const customerColumns:Record<string,string>={
 status:"VARCHAR(30) NOT NULL DEFAULT 'actief'",house_number:"VARCHAR(30) DEFAULT NULL",province:"VARCHAR(100) DEFAULT NULL",country:"VARCHAR(100) NOT NULL DEFAULT 'Nederland'",secondary_email:"VARCHAR(190) DEFAULT NULL",mobile:"VARCHAR(60) DEFAULT NULL",website:"VARCHAR(190) DEFAULT NULL",vat_rate:"DECIMAL(5,2) NOT NULL DEFAULT 21.00",discount_percentage:"DECIMAL(5,2) NOT NULL DEFAULT 0.00",direct_debit:"TINYINT(1) NOT NULL DEFAULT 0",tags:"VARCHAR(255) DEFAULT NULL",active:"TINYINT(1) NOT NULL DEFAULT 1",color:"VARCHAR(20) NOT NULL DEFAULT '#f5c400'",logo_url:"VARCHAR(500) DEFAULT NULL"
};
let schemaReady=false;
async function ensureSchema(){
 if(schemaReady)return;
 const [rows]:any=await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='customers'",[process.env.DB_NAME]);
 const existing=new Set(rows.map((r:any)=>r.COLUMN_NAME));
 for(const [name,definition] of Object.entries(customerColumns))if(!existing.has(name))await pool.query(`ALTER TABLE customers ADD COLUMN \`${name}\` ${definition}`);
 await pool.query(`CREATE TABLE IF NOT EXISTS document_sequences (
   document_type VARCHAR(30) NOT NULL,
   sequence_year INT NOT NULL,
   last_number INT NOT NULL DEFAULT 0,
   updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (document_type,sequence_year)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 schemaReady=true;
}
async function nextCustomerNumber(){
 const [rows]:any=await pool.query("SELECT customer_number FROM customers WHERE customer_number LIKE 'KHN-%' ORDER BY id DESC LIMIT 1");
 const current=rows[0]?.customer_number||'KHN-000000';
 return `KHN-${String(Number(String(current).replace(/\D/g,''))+1).padStart(6,'0')}`;
}
const prefixes:Record<string,string>={offerte:'OFF',factuur:'FAC',werkbon:'WRK',creditfactuur:'CRD'};
async function reserveDocumentNumber(type:string,issueDate?:string){
 const prefix=prefixes[type];
 if(!prefix)throw new Error('Ongeldig documenttype');
 const year=issueDate&&/^\d{4}-\d{2}-\d{2}$/.test(issueDate)?Number(issueDate.slice(0,4)):new Date().getFullYear();
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  await conn.query('INSERT IGNORE INTO document_sequences (document_type,sequence_year,last_number) VALUES (?,?,0)',[type,year]);
  const [rows]:any=await conn.query('SELECT last_number FROM document_sequences WHERE document_type=? AND sequence_year=? FOR UPDATE',[type,year]);
  const next=Number(rows[0]?.last_number||0)+1;
  await conn.query('UPDATE document_sequences SET last_number=? WHERE document_type=? AND sequence_year=?',[next,type,year]);
  await conn.commit();
  return `${prefix}-${year}-${String(next).padStart(4,'0')}`;
 }catch(error){await conn.rollback();throw error}finally{conn.release()}
}
export async function GET(){
 const s=await readSession();if(!can(s,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();const out:any={};for(const t of tables){const [r]=await pool.query(`SELECT * FROM ${t} ORDER BY id DESC`);out[t]=r}return NextResponse.json(out);
}
export async function POST(req:Request){
 const s=await readSession();if(!can(s,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();const {table,data}=await req.json();
 if(!tables.includes(table)||table==='document_items'||table==='inventory_movements')return NextResponse.json({error:'Ongeldige tabel'},{status:400});
 if(table==='customers'&&!data.customer_number)data.customer_number=await nextCustomerNumber();
 if(table==='documents'){
  data.number=await reserveDocumentNumber(data.type,data.issue_date);
  if(!data.issue_date)data.issue_date=new Date().toISOString().slice(0,10);
 }
 const keys=Object.keys(data).filter(k=>k!=='id'&&k!=='created_at'&&k!=='updated_at');
 const vals=keys.map(k=>data[k]??null);const sql=`INSERT INTO ${table} (${keys.map(k=>'`'+k+'`').join(',')}) VALUES (${keys.map(()=>'?').join(',')})`;
 try{const [r]:any=await pool.query(sql,vals);return NextResponse.json({id:r.insertId,number:data.number||null})}catch(error:any){return NextResponse.json({error:error?.code==='ER_DUP_ENTRY'?'Documentnummer bestaat al. Probeer opnieuw.':'Opslaan mislukt'},{status:500})}
}
export async function PUT(req:Request){
 const s=await readSession();if(!can(s,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 await ensureSchema();const {table,id,data}=await req.json();if(!tables.includes(table))return NextResponse.json({error:'Ongeldige tabel'},{status:400});
 const keys=Object.keys(data).filter(k=>!['id','created_at','updated_at'].includes(k)&&!(table==='documents'&&k==='number'));
 const stamp=['customers','documents','inventory','vehicles','settings'].includes(table)?', updated_at=NOW()':'';
 await pool.query(`UPDATE ${table} SET ${keys.map(k=>'`'+k+'`=?').join(',')}${stamp} WHERE id=?`,[...keys.map(k=>data[k]??null),id]);return NextResponse.json({ok:true});
}
export async function DELETE(req:Request){
 const s=await readSession();if(!can(s,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const {table,id}=await req.json();if(!tables.includes(table))return NextResponse.json({error:'Ongeldige tabel'},{status:400});
 if(table==='documents')return NextResponse.json({error:'Documenten worden niet verwijderd vanwege de doorlopende nummering. Zet de status op geannuleerd.'},{status:400});
 await pool.query(`DELETE FROM ${table} WHERE id=?`,[id]);return NextResponse.json({ok:true});
}