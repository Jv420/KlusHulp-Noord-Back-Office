import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

type Row=Record<string,any>;
async function auth(){const s=await readSession();return can(s,'data.read')?s:null}
async function q(sql:string,params:any[]=[]){try{const [rows]:any=await pool.query(sql,params);return rows as Row[]}catch{return []}}
const one=(rows:Row[],key='value')=>Number(rows[0]?.[key]||0);

export async function GET(){
 const s=await auth();if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});
 const today=new Date().toISOString().slice(0,10),month=today.slice(0,7)+'-01',year=today.slice(0,4)+'-01-01';
 const [customers,todayAppointments,openWorkOrders,lowStock,contracts,documents,revenueToday,revenueMonth,revenueYear,expensesMonth,recentCustomers,recentDocuments,recentOrders,alerts,monthlyRevenue]=await Promise.all([
  q('SELECT COUNT(*) value FROM customers'),
  q('SELECT a.*,c.name customer_name FROM appointments a LEFT JOIN customers c ON c.id=a.customer_id WHERE DATE(a.start_at)=? ORDER BY a.start_at LIMIT 12',[today]),
  q("SELECT w.*,c.name customer_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id WHERE w.status IN ('concept','onderweg','bezig') ORDER BY COALESCE(w.scheduled_date,CURDATE()),w.id DESC LIMIT 12"),
  q('SELECT id,name,sku,stock,min_stock,unit FROM inventory WHERE stock<=min_stock ORDER BY stock ASC LIMIT 12'),
  q("SELECT COUNT(*) active,COALESCE(SUM(amount),0) value FROM service_contracts WHERE status='actief'"),
  q("SELECT COUNT(*) open_invoices,COALESCE(SUM(total),0) open_amount FROM documents WHERE type='invoice' AND status NOT IN ('paid','betaald','cancelled','geannuleerd')"),
  q("SELECT COALESCE(SUM(total),0) value FROM documents WHERE type='invoice' AND status IN ('sent','paid','betaald','verzonden') AND document_date=?",[today]),
  q("SELECT COALESCE(SUM(total),0) value FROM documents WHERE type='invoice' AND status IN ('sent','paid','betaald','verzonden') AND document_date BETWEEN ? AND ?",[month,today]),
  q("SELECT COALESCE(SUM(total),0) value FROM documents WHERE type='invoice' AND status IN ('sent','paid','betaald','verzonden') AND document_date BETWEEN ? AND ?",[year,today]),
  q('SELECT COALESCE(SUM(amount),0) value FROM expenses WHERE expense_date BETWEEN ? AND ?',[month,today]),
  q('SELECT id,name,email,phone,city,created_at FROM customers ORDER BY id DESC LIMIT 8'),
  q('SELECT id,document_number,type,status,total,document_date,customer_id FROM documents ORDER BY id DESC LIMIT 8'),
  q("SELECT w.id,w.work_order_number,w.title,w.status,w.scheduled_date,w.assigned_to,c.name customer_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id ORDER BY w.id DESC LIMIT 8"),
  q("SELECT 'contract' type,CONCAT(contract_number,' loopt binnenkort af') message,end_date due_date FROM service_contracts WHERE status='actief' AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 30 DAY) UNION ALL SELECT 'onderhoud',CONCAT(contract_number,' onderhoud achterstallig'),next_service_date FROM service_contracts WHERE status='actief' AND next_service_date<CURDATE() UNION ALL SELECT 'werkbon',CONCAT(work_order_number,' heeft geen monteur'),scheduled_date FROM work_orders WHERE status IN ('concept','onderweg','bezig') AND (assigned_to IS NULL OR assigned_to='') LIMIT 20"),
  q("SELECT DATE_FORMAT(document_date,'%Y-%m') month,COALESCE(SUM(total),0) value FROM documents WHERE type='invoice' AND status IN ('sent','paid','betaald','verzonden') AND document_date>=DATE_SUB(CURDATE(),INTERVAL 11 MONTH) GROUP BY 1 ORDER BY 1")
 ]);
 const monthRevenue=one(revenueMonth),monthCosts=one(expensesMonth);
 return NextResponse.json({
  generated_at:new Date().toISOString(),
  kpi:{customers:one(customers),appointments_today:todayAppointments.length,open_work_orders:openWorkOrders.length,low_stock:lowStock.length,active_contracts:one(contracts,'active'),contract_value:one(contracts,'value'),open_invoices:one(documents,'open_invoices'),open_invoice_amount:one(documents,'open_amount'),revenue_today:one(revenueToday),revenue_month:monthRevenue,revenue_year:one(revenueYear),costs_month:monthCosts,profit_month:monthRevenue-monthCosts},
  todayAppointments,openWorkOrders,lowStock,recentCustomers,recentDocuments,recentOrders,alerts,monthlyRevenue
 });
}
