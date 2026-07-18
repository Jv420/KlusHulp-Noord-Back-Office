import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

const xml=(value:any)=>String(value??'').replace(/[<>&'\"]/g,(c)=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c]||c));
const amount=(value:any)=>Number(value||0).toFixed(2);
const isoDate=(value:any)=>String(value||'').slice(0,10);

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>|{id:string}}){
 const session=await readSession();
 if(!can(session,'data.read'))return NextResponse.json({error:'Geen toegang'},{status:403});
 const resolved=await Promise.resolve(params),id=Number(resolved.id);
 if(!id)return NextResponse.json({error:'Ongeldig document'},{status:400});
 const [docs]:any=await pool.query(`SELECT d.*,c.name customer_name,c.company_name,c.email customer_email,c.address customer_address,c.postal_code customer_postal_code,c.city customer_city,c.country customer_country,c.vat_number customer_vat_number FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.id=?`,[id]);
 const d=docs[0];
 if(!d)return NextResponse.json({error:'Document niet gevonden'},{status:404});
 if(!['factuur','creditfactuur'].includes(d.type))return NextResponse.json({error:'UBL is alleen beschikbaar voor facturen en creditfacturen'},{status:400});
 const [items]:any=await pool.query('SELECT * FROM document_items WHERE document_id=? ORDER BY id',[id]);
 const [settings]:any=await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
 const s=settings[0]||{};
 const customer=d.company_name||d.customer_name||'Klant';
 const supplier=s.company_name||s.name||'KlusHulp Noord';
 const subtotal=Number(d.subtotal??d.total_ex_vat??0);
 const vat=Number(d.vat_amount??d.tax_amount??(Number(d.total||0)-subtotal));
 const total=Number(d.total||subtotal+vat);
 const currency=d.currency||'EUR';
 const isCredit=d.type==='creditfactuur';
 const root=isCredit?'CreditNote':'Invoice';
 const lineTag=isCredit?'CreditNoteLine':'InvoiceLine';
 const qtyTag=isCredit?'CreditedQuantity':'InvoicedQuantity';
 const lines=(items.length?items:[{description:d.description||d.notes||d.number,quantity:1,unit_price:subtotal,vat_rate:vat&&subtotal?vat/subtotal*100:21,total:subtotal}]).map((i:any,index:number)=>{
  const qty=Number(i.quantity??i.qty??1),price=Number(i.unit_price??i.price??0),line=Number(i.total??i.line_total??qty*price),rate=Number(i.vat_rate??i.tax_rate??21);
  return `<cac:${lineTag}><cbc:ID>${index+1}</cbc:ID><cbc:${qtyTag} unitCode="C62">${qty}</cbc:${qtyTag}><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(Math.abs(line))}</cbc:LineExtensionAmount><cac:Item><cbc:Description>${xml(i.description||i.name||'Werkzaamheden')}</cbc:Description><cbc:Name>${xml(i.name||i.description||'Werkzaamheden')}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${amount(Math.abs(price))}</cbc:PriceAmount></cac:Price></cac:${lineTag}>`;
 }).join('');
 const documentXml=`<?xml version="1.0" encoding="UTF-8"?>
<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID><cbc:ID>${xml(d.number||id)}</cbc:ID><cbc:IssueDate>${xml(isoDate(d.issue_date)||new Date().toISOString().slice(0,10))}</cbc:IssueDate>${d.due_date?`<cbc:DueDate>${xml(isoDate(d.due_date))}</cbc:DueDate>`:''}<cbc:${isCredit?'CreditNoteTypeCode':'InvoiceTypeCode'}>${isCredit?'381':'380'}</cbc:${isCredit?'CreditNoteTypeCode':'InvoiceTypeCode'}><cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>${xml(supplier)}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>${xml(s.address||'')}</cbc:StreetName><cbc:PostalZone>${xml(s.postal_code||'')}</cbc:PostalZone><cbc:CityName>${xml(s.city||'')}</cbc:CityName><cac:Country><cbc:IdentificationCode>${xml(s.country_code||'NL')}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${s.vat_number?`<cac:PartyTaxScheme><cbc:CompanyID>${xml(s.vat_number)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`:''}<cac:PartyLegalEntity><cbc:RegistrationName>${xml(supplier)}</cbc:RegistrationName>${s.kvk_number?`<cbc:CompanyID>${xml(s.kvk_number)}</cbc:CompanyID>`:''}</cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>${xml(customer)}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>${xml(d.customer_address||'')}</cbc:StreetName><cbc:PostalZone>${xml(d.customer_postal_code||'')}</cbc:PostalZone><cbc:CityName>${xml(d.customer_city||'')}</cbc:CityName><cac:Country><cbc:IdentificationCode>${xml(d.customer_country==='Nederland'||!d.customer_country?'NL':d.customer_country)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${d.customer_vat_number?`<cac:PartyTaxScheme><cbc:CompanyID>${xml(d.customer_vat_number)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`:''}<cac:PartyLegalEntity><cbc:RegistrationName>${xml(customer)}</cbc:RegistrationName></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>${xml(d.customer_email||'')}</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${amount(Math.abs(vat))}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${amount(Math.abs(subtotal))}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${amount(Math.abs(vat))}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${subtotal?amount(Math.abs(vat/subtotal*100)):21}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(Math.abs(subtotal))}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${amount(Math.abs(subtotal))}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${amount(Math.abs(total))}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${xml(currency)}">${amount(Math.abs(total))}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</${root}>`;
 return new NextResponse(documentXml,{status:200,headers:{'Content-Type':'application/xml; charset=utf-8','Content-Disposition':`attachment; filename="${String(d.number||id).replace(/[^a-zA-Z0-9_-]/g,'_')}.xml"`,'Cache-Control':'no-store'}});
}
