export function fmtCur(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(value) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(,|$))/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function fmtPercent(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
}
