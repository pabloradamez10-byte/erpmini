export const PLAN_LIMITS = {
  starter: { products: 30, clients: 20, salesMonth: 50 },
  pro: { products: Infinity, clients: Infinity, salesMonth: Infinity },
  premium: { products: Infinity, clients: Infinity, salesMonth: Infinity },
  mensal: { products: Infinity, clients: Infinity, salesMonth: Infinity }
};

export function normalizePlan(plan) {
  const value = String(plan || "starter").toLowerCase();

  if (["free", "gratis", "gratuito", "teste"].includes(value)) return "starter";
  if (["mensal", "pro_mensal"].includes(value)) return "pro";
  if (["anual", "premium_anual"].includes(value)) return "premium";
  if (["starter", "pro", "premium"].includes(value)) return value;

  return "starter";
}

export function allowedTabsForPlan(plan, isAdmin = false) {
  if (isAdmin) return ["inicio", "pdv", "servicos", "estoque", "cliente", "caixa", "config"];
  const value = normalizePlan(plan);
  if (value === "pro" || value === "premium") return ["inicio", "pdv", "servicos", "estoque", "cliente", "caixa", "config"];
  return ["inicio", "pdv", "servicos", "estoque", "cliente", "config"];
}

export function hasPlanAccess(tab, plan, isAdmin = false) {
  return allowedTabsForPlan(plan, isAdmin).includes(String(tab || "").toLowerCase());
}

export function getBusinessTypeFromLicense(license) {
  const raw = String(license?.business_type || license?.businessType || license?.notes || "").toLowerCase();
  if (["tipo:servicos", "business:servicos", "servico", "serviço"].some((value) => raw.includes(value))) return "servicos";
  return "comercio";
}

export function countSalesThisMonth(sales = []) {
  const month = new Date().toISOString().slice(0, 7);
  return (sales || []).filter((sale) => String(sale.date || sale.createdAt || sale.created_at || sale.data || "").slice(0, 7) === month).length;
}

export function isLimitReached(type, plan, counts) {
  const limits = PLAN_LIMITS[normalizePlan(plan)] || PLAN_LIMITS.starter;
  if (type === "products") return counts.products >= limits.products;
  if (type === "clients") return counts.clients >= limits.clients;
  if (type === "salesMonth") return counts.salesMonth >= limits.salesMonth;
  return false;
}

export function planLimitMessage(type, plan) {
  const limits = PLAN_LIMITS[normalizePlan(plan)] || PLAN_LIMITS.starter;
  if (type === "products") return `Voce atingiu o limite de ${limits.products} produtos do plano Starter.`;
  if (type === "clients") return `Voce atingiu o limite de ${limits.clients} clientes do plano Starter.`;
  if (type === "salesMonth") return `Voce atingiu o limite de ${limits.salesMonth} vendas mensais do plano Starter.`;
  return "Limite do plano atingido.";
}
