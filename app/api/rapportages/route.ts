import {NextResponse} from 'next/server';
import pool from '@/lib/db';
import {can,readSession} from '@/lib/auth';

type Row=Record<string,any>;
async function auth(){const s=await readSession();return can(s,'data.read')?s:null}
async function q(sql:string,params:any[]=[]){try{const [rows]:any=await pool.query(sql,params);return rows as Row[]}catch(error){console.error('Rapportagequery mislukt',error);return []}}
const one=(rows:Row[],key='value')=>Number(rows[0]?.[key]||0);

export async function GET(req:Request){
 const s=await auth();if(!s)return NextResponse.json({error:'Geen toegang'},{status:403});
 const u=new URL(req.url),from=u.searchParams.get('from')||`${new Date().getFullYear()}-01-01`,to=u.searchParams.get('to')||new Date().toISOString().slice(0,10);
 const invoiceStatuses=['verzonden','betaald','gedeeltelijk','sent','paid'];
 const placeholders=invoiceStatuses.map(()=>'?').join(',');
 const invoiceParams=[...invoiceStatuses,from,to];
 const [customers,workOrders,hours,inventory,contracts,visits,expenses,documents,monthlyRevenue,monthlyCosts,topCustomers,mechanics,materials]=await Promise.all([
  q('SELECT COUNT(*) value FROM customers'),
  q("SELECT COUNT(*) total,SUM(status='concept') concept,SUM(status='onderweg') onderweg,SUM(status='bezig') bezig,SUM(status='gereed') gereed,SUM(status='gefactureerd') gefactureerd FROM work_orders"),
  q('SELECT COALESCE(SUM(hours),0) total_hours,COALESCE(SUM(hours*hourly_rate),0) labor_value FROM work_order_hours WHERE work_date BETWEEN ? AND ?',[from,to]),
  q('SELECT COUNT(*) items,COALESCE(SUM(stock*purchase_price),0) purchase_value,COALESCE(SUM(stock*sale_price),0) sales_value,SUM(stock<=min_stock) low_stock FROM inventory'),
  q("SELECT COUNT(*) total,SUM(status='actief') active,COALESCE(SUM(CASE WHEN status='actief' THEN amount ELSE 0 END),0) recurring_value FROM service_contracts"),
  q("SELECT COUNT(*) total,SUM(status<>'gereed' AND planned_date<CURDATE()) overdue,SUM(status='gepland') planned FROM contract_visits"),
  q('SELECT COALESCE(SUM(amount_inc_vat),0) value FROM expenses WHERE expense_date BETWEEN ? AND ?',[from,to]),
  q(`SELECT COALESCE(SUM(CASE WHEN type='creditfactuur' THEN -ABS(total) ELSE total END),0) revenue,COUNT(*) count FROM documents WHERE type IN ('factuur','creditfactuur') AND status IN (${placeholders}) AND issue_date BETWEEN ? AND ?`,invoiceParams),
  q(`SELECT DATE_FORMAT(issue_date,'%Y-%m') month,COALESCE(SUM(CASE WHEN type='creditfactuur' THEN -ABS(total) ELSE total END),0) value FROM documents WHERE type IN ('factuur','creditfactuur') AND status IN (${placeholders}) AND issue_date BETWEEN ? AND ? GROUP BY 1 ORDER BY 1`,invoiceParams),
  q("SELECT DATE_FORMAT(expense_date,'%Y-%m') month,COALESCE(SUM(amount_inc_vat),0) value FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY 1 ORDER BY 1",[from,to]),
  q(`SELECT c.id,COALESCE(NULLIF(c.company_name,''),c.name,'Onbekende klant') name,COUNT(d.id) invoices,COALESCE(SUM(CASE WHEN d.type='creditfactuur' THEN -ABS(d.total) ELSE d.total END),0) revenue FROM customers c LEFT JOIN documents d ON d.customer_id=c.id AND d.type IN ('factuur','creditfactuur') AND d.status IN (${placeholders}) AND d.issue_date BETWEEN ? AND ? GROUP BY c.id,c.company_name,c.name ORDER BY revenue DESC LIMIT 10`,invoiceParams),
  q("SELECT COALESCE(NULLIF(employee_name,''),'Onbekend') name,COUNT(DISTINCT work_order_id) work_orders,COALESCE(SUM(hours),0) hours,COALESCE(SUM(hours*hourly_rate),0) value FROM work_order_hours WHERE work_date BETWEEN ? AND ? GROUP BY employee_name ORDER BY hours DESC",[from,to]),
  q('SELECT description,COALESCE(SUM(quantity),0) quantity,COALESCE(SUM(quantity*unit_price),0) value FROM work_order_materials GROUP BY description ORDER BY quantity DESC LIMIT 10')
 ]);
 const revenue=one(documents,'revenue'),costs=one(expenses),labor=one(hours,'labor_value');
 const work=workOrders[0]||{};
 return NextResponse.json({period:{from,to},kpi:{revenue,costs,gross_profit:revenue-costs,customers:one(customers),work_orders:one(workOrders,'total'),open_work_orders:Number(work.concept||0)+Number(work.onderweg||0)+Number(work.bezig||0),hours:one(hours,'total_hours'),labor_value:labor,inventory_purchase_value:one(inventory,'purchase_value'),inventory_sales_value:one(inventory,'sales_value'),low_stock:one(inventory,'low_stock'),active_contracts:one(contracts,'active'),contract_value:one(contracts,'recurring_value'),overdue_visits:one(visits,'overdue')},workOrders:work,contracts:contracts[0]||{},visits:visits[0]||{},monthlyRevenue,monthlyCosts,topCustomers,mechanics,materials});
}
