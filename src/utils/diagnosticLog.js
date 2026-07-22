const LOG_KEY = "erpmini_diagnostic_logs";
const LOG_EVENT = "erpmini-diagnostic-log";
const MAX_LOGS = 200;

function readLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getDiagnosticLogs() {
  return readLogs();
}

export function addDiagnosticLog(scope, step, status = "info", detail = "") {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    scope: String(scope || "SYSTEM").toUpperCase(),
    step: String(step || "Evento"),
    status: ["success", "error", "warning", "info"].includes(status) ? status : "info",
    detail: String(detail || "").slice(0, 500)
  };

  try {
    const next = [entry, ...readLogs()].slice(0, MAX_LOGS);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(LOG_EVENT, { detail: entry }));
  } catch {}

  return entry;
}

export function clearDiagnosticLogs() {
  try {
    localStorage.removeItem(LOG_KEY);
    window.dispatchEvent(new CustomEvent(LOG_EVENT));
  } catch {}
}

export function subscribeDiagnosticLogs(listener) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOG_EVENT, listener);
  return () => window.removeEventListener(LOG_EVENT, listener);
}
