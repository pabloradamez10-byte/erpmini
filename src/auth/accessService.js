import { normalizePlan } from "../domain/plans.js";
import { supabase } from "../services/supabaseClient.js";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";

function readLocalJsonSafe(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function createPendingLicenseForCurrentUser(email, businessType = "comercio") {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanBusinessType = businessType === "servicos" ? "servicos" : "comercio";
  addDiagnosticLog("SIGNUP", "Verificando solicitação existente", "info", cleanEmail);
  if (!cleanEmail) {
    addDiagnosticLog("SIGNUP", "E-mail inválido", "error");
    return { ok: false, message: "E-mail invalido." };
  }

  const { data: existing, error: readError } = await supabase
    .from("erpmini_signup_requests")
    .select("id,status")
    .eq("email", cleanEmail)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestRequest = !readError ? existing?.[0] : null;

  if (String(latestRequest?.status || "").toLowerCase() === "pendente") {
    addDiagnosticLog("SIGNUP", "Solicitação já existente", "success", cleanEmail);
    return { ok: true, existing: true, message: "Solicitacao ja existente." };
  }

  if (latestRequest) {
    addDiagnosticLog("SIGNUP", "Solicitação anterior encerrada; tentando reabrir", "info", `${cleanEmail} • ${latestRequest.status || "sem status"}`);
    const reopenQuery = supabase
      .from("erpmini_signup_requests")
      .update({ status: "pendente", business_type: cleanBusinessType, updated_at: new Date().toISOString() });
    const { error: reopenError } = latestRequest.id
      ? await reopenQuery.eq("id", latestRequest.id)
      : await reopenQuery.eq("email", cleanEmail);

    if (!reopenError) {
      addDiagnosticLog("SIGNUP", "Solicitação reaberta", "success", cleanEmail);
      return { ok: true, reopened: true, message: "Solicitacao reaberta." };
    }

    addDiagnosticLog("SIGNUP", "Não foi possível reabrir; tentando novo INSERT", "warning", reopenError.message);
  }

  const { error } = await supabase.from("erpmini_signup_requests").insert([{
    email: cleanEmail,
    status: "pendente",
    business_type: cleanBusinessType
  }]);

  if (error) {
    addDiagnosticLog("SIGNUP", "INSERT da solicitação falhou", "error", error.message);
    const message = String(error.message || "").toLowerCase();
    if (message.includes("duplicate") || message.includes("already exists")) {
      return { ok: true, message: "Solicitacao ja existente." };
    }
    return { ok: false, message: error.message };
  }

  addDiagnosticLog("SIGNUP", "Solicitação criada", "success", cleanEmail);
  return { ok: true, message: "Solicitacao criada." };
}

export async function checkLicenseByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  addDiagnosticLog("LOGIN", "Validando licença", "info", normalizedEmail);

  if (!normalizedEmail) {
    return { ok: false, title: "Licenca nao encontrada", message: "Nao foi possivel identificar o e-mail do usuario." };
  }

  const cachedLicenseKey = `erpmini_cached_license_${normalizedEmail}`;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const cached = readLocalJsonSafe(cachedLicenseKey);
    if (cached?.ok) return { ...cached, offlineCached: true, message: "Licenca validada pelo ultimo acesso online." };
    return { ok: false, title: "Sem conexao", message: "Abra o ERPmini uma vez com internet para validar a licenca neste aparelho." };
  }

  try {
    const { data, error } = await supabase
      .from("erpmini_licenses")
      .select("email, status, expires_at, plan, notes")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      addDiagnosticLog("LOGIN", "Consulta da licença falhou", "error", error.message);
      console.warn("ERPmini license error:", error);
      const cached = readLocalJsonSafe(cachedLicenseKey);
      if (cached?.ok) return { ...cached, offlineCached: true, message: "Licenca validada pelo ultimo acesso online." };
      return { ok: false, title: "Erro ao validar licenca", message: "Nao foi possivel validar sua licenca agora. Verifique a conexao ou fale com o suporte." };
    }

    if (!data) {
      addDiagnosticLog("LOGIN", "Licença não encontrada", "warning", normalizedEmail);
      return { ok: false, title: "Licenca nao liberada", message: "Este e-mail ainda nao esta liberado para usar o ERPmini." };
    }

    const licenseStatus = String(data.status || "").toLowerCase();
    if (licenseStatus === "pendente") {
      addDiagnosticLog("LOGIN", "Licença pendente", "warning", normalizedEmail);
      return { ok: false, title: "Cadastro aguardando aprovacao", message: "Sua conta foi criada. Aguarde o administrador liberar seu acesso." };
    }
    if (licenseStatus !== "ativo") {
      addDiagnosticLog("LOGIN", "Licença bloqueada", "warning", normalizedEmail);
      return { ok: false, title: "Licenca bloqueada", message: "Sua licenca esta bloqueada. Regularize o pagamento para liberar o acesso." };
    }

    const planName = normalizePlan(data.plan || "starter");
    if (planName !== "starter") {
      if (!data.expires_at) return { ok: false, title: "Licenca sem vencimento", message: "Sua licenca ainda nao possui data de vencimento. Fale com o suporte." };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expires = new Date(`${data.expires_at}T00:00:00`);
      if (expires < today) return { ok: false, title: "Licenca vencida", message: `Sua licenca venceu em ${data.expires_at}. Regularize o pagamento para liberar o acesso.` };
    }

    addDiagnosticLog("LOGIN", "Licença validada", "success", `${normalizedEmail} • ${planName}`);
    return { ok: true, license: data };
  } catch (error) {
    addDiagnosticLog("LOGIN", "Exceção ao validar licença", "error", error?.message || String(error));
    console.warn("ERPmini license exception:", error);
    return { ok: false, title: "Erro ao validar licenca", message: "Ocorreu um erro inesperado ao validar sua licenca." };
  }
}
