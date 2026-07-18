import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

async function allowed(permission:string){const s=await readSession();return can(s,permission)}
async function ensure(){await pool.query(`CREATE TABLE IF NOT EXISTS company_settings (
 id TINYINT PRIMARY KEY DEFAULT 1,
 legal_name VARCHAR(190) NOT NULL DEFAULT 'KlusHulp Noord',
 trade_name VARCHAR(190) NOT NULL DEFAULT 'KlusHulp Noord',
 owner_name VARCHAR(190) NULL,
 street VARCHAR(190) NULL, house_number VARCHAR(30) NULL, postal_code VARCHAR(20) NULL, city VARCHAR(120) NULL, country VARCHAR(80) NOT NULL DEFAULT 'Nederland',
 email VARCHAR(190) NULL, phone VARCHAR(50) NULL, website VARCHAR(190) NULL,
 kvk_number VARCHAR(30) NULL, vat_id VARCHAR(40) NULL, iban VARCHAR(60) NULL, bic VARCHAR(20) NULL,
 payment_term_days INT NOT NULL DEFAULT 14, quote_valid_days INT NOT NULL DEFAULT 30,
 invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'FAC', quote_prefix VARCHAR(20) NOT NULL DEFAULT 'OFF',
 default_vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
 footer_text TEXT NULL, terms_text TEXT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);await pool.query(`INSERT IGNORE INTO company_settings(id,legal_name,trade_name,country) VALUES(1,'KlusHulp Noord','KlusHulp Noord','Nederland')`)}

export async function GET(){if(!await allowed('data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});await ensure();const [rows]:any=await pool.query('SELECT * FROM company_settings WHERE id=1');return NextResponse.json(rows[0]||{})}
export async function POST(req:Request){if(!await allowed('data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});await ensure();const d=await req.json();await pool.query(`UPDATE company_settings SET legal_name=?,trade_name=?,owner_name=?,street=?,house_number=?,postal_code=?,city=?,country=?,email=?,phone=?,website=?,kvk_number=?,vat_id=?,iban=?,bic=?,payment_term_days=?,quote_valid_days=?,invoice_prefix=?,quote_prefix=?,default_vat_rate=?,footer_text=?,terms_text=? WHERE id=1`,[d.legal_name||'KlusHulp Noord',d.trade_name||'KlusHulp Noord',d.owner_name||null,d.street||null,d.house_number||null,d.postal_code||null,d.city||null,d.country||'Nederland',d.email||null,d.phone||null,d.website||null,d.kvk_number||null,d.vat_id||null,d.iban||null,d.bic||null,Number(d.payment_term_days||14),Number(d.quote_valid_days||30),d.invoice_prefix||'FAC',d.quote_prefix||'OFF',Number(d.default_vat_rate??21),d.footer_text||null,d.terms_text||null]);return NextResponse.json({ok:true})}