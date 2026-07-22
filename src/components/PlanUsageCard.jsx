import { countSalesThisMonth, normalizePlan, PLAN_LIMITS } from "../domain/plans.js";

export default function PlanUsageCard({ plan, products = [], clients = [], sales = [] }) {
  const normalizedPlan = normalizePlan(plan);
  const limits = PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.starter;
  const counts = {
    products: products.length,
    clients: clients.length,
    salesMonth: countSalesThisMonth(sales)
  };

  if (normalizedPlan !== "starter") {
    return (
      <div style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:"16px", padding:"14px", marginBottom:"12px" }}>
        <div style={{ fontWeight:"900", color:"#166534" }}>Plano {normalizedPlan.toUpperCase()}</div>
        <div style={{ color:"#166534", fontSize:"13px", fontWeight:"700" }}>Produtos, clientes e vendas liberados.</div>
      </div>
    );
  }

  const row = (label, used, max) => {
    const percentage = Math.min(100, Math.round((used / max) * 100));
    const danger = percentage >= 90;
    return (
      <div style={{ marginTop:"10px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"900", color:danger?"#991b1b":"#334155", fontSize:"13px" }}>
          <span>{label}</span><span>{used}/{max}</span>
        </div>
        <div style={{ height:"9px", background:"#e2e8f0", borderRadius:"999px", overflow:"hidden", marginTop:"5px" }}>
          <div style={{ width:`${percentage}%`, height:"100%", background:danger?"#dc2626":"#16a34a" }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:"16px", padding:"14px", marginBottom:"12px" }}>
      <div style={{ fontWeight:"900", color:"#9a3412" }}>Plano Starter</div>
      <div style={{ color:"#9a3412", fontSize:"13px", fontWeight:"700" }}>Limites do plano gratuito.</div>
      {row("Produtos", counts.products, limits.products)}
      {row("Clientes", counts.clients, limits.clients)}
      {row("Vendas no mês", counts.salesMonth, limits.salesMonth)}
    </div>
  );
}
