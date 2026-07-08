export function fmtCur(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));
}

export function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return String(value);
  }
}

export function normalizePlan(plan) {
  const p = String(plan || "starter").toLowerCase();

  if (p === "mensal" || p === "pro" || p === "pro_mensal") return "pro";
  if (p === "premium" || p === "anual" || p === "premium_anual") return "premium";
  if (p === "starter" || p === "teste" || p === "free") return "starter";

  return p;
}
