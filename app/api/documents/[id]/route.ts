import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

export async function GET(_:Request,{params}:{params:{id:string}}){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const id=Number(params.id);
 if(!Number.isInteger(id)||id<1)return NextResponse.json({error:'Ongeldig document'},{status:400});
 const [docs]:any=await pool.query(`SELECT d.*,c.customer_number,c.type AS customer_type,c.name AS customer_name,c.company_name,c.contact_person,c.street,c.house_number,c.postal_code,c.city,c.country,c.email,c.phone,c.mobile,c.kvk AS customer_kvk,c.vat_number AS customer_vat_number FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.id=? LIMIT 1`,[id]);
 if(!docs.length)return NextResponse.json({error:'Document niet gevonden'},{status:404});
 const [items]:any=await pool.query('SELECT * FROM document_items WHERE document_id=? ORDER BY id ASC',[id]);
 const [settingsRows]:any=await pool.query('SELECT setting_key,setting_value FROM settings');
 const settings=Object.fromEntries(settingsRows.map((r:any)=>[r.setting_key,r.setting_value]));
 return NextResponse.json({document:docs[0],items,settings});
}
