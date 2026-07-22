import { useEffect, useMemo, useState } from "react";
import { addDiagnosticLog, clearDiagnosticLogs, getDiagnosticLogs, subscribeDiagnosticLogs } from "../utils/diagnosticLog.js";

const LS_ROWS = "erpmini_saas_master_rows";
const LS_LICENSES = "erpmini_saas_master_licenses";
const LS_REQUESTS = "erpmini_saas_master_requests";
const LS_MSG = "erpmini_saas_master_msg";
const LS_MANUAL_EMAILS = "erpmini_saas_master_manual_emails";
const LS_SHOW_NEW = "erpmini_saas_show_new_license";

function loadSafe(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveSafe(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addYears(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function businessTypeFromNotes(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("tipo:servicos") || raw.includes("business:servicos") || raw.includes("servico") || raw.includes("serviço")) return "servicos";
  return "comercio";
}

function cleanBusinessNote(notes) {
  return String(notes || "").replace(/\[tipo:(comercio|servicos)\]/gi, "").trim();
}

function withBusinessNote(notes, type) {
  const clean = cleanBusinessNote(notes);
  return `${clean ? clean + " " : ""}[tipo:${type === "servicos" ? "servicos" : "comercio"}]`;
}

function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export default function MasterSaasPanel({
  supabase,
  cloudTable,
  isMobile,
  fmtCur,
  fmtDate,
  normalizePlan,
  btn,
  btnSm,
  inp,
  card
}) {
  const [rows, setRows] = useState(() => loadSafe(LS_ROWS, []));
  const [licenses, setLicenses] = useState(() => loadSafe(LS_LICENSES, []));
  const [requests, setRequests] = useState(() => loadSafe(LS_REQUESTS, []));
  const [msg, setMsg] = useState(() => loadSafe(LS_MSG, ""));
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [manualEmails, setManualEmails] = useState(() => loadSafe(LS_MANUAL_EMAILS, {}));
  const [showNewLicense, setShowNewLicense] = useState(() => loadSafe(LS_SHOW_NEW, false));
  const [confirmAction, setConfirmAction] = useState(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState(() => getDiagnosticLogs());
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => subscribeDiagnosticLogs(() => setDiagnosticLogs(getDiagnosticLogs())), []);

  const [newClient, setNewClient] = useState({
    companyName: "",
    businessType: "comercio",
    cnpj: "",
    responsibleName: "",
    email: "",
    phone: "",
    plan: "pro",
    expiresAt: addMonths(1),
    monthlyValue: "69.90",
    notes: ""
  });

  const ui = {
    softCard: {
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "18px",
      padding: "14px",
      boxShadow: "0 8px 22px rgba(15,23,42,.05)"
    },
    label: {
      fontSize: "11px",
      color: "#64748b",
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: ".03em"
    },
    value: {
      fontSize: "18px",
      color: "#0f172a",
      fontWeight: 900
    },
    pill: (bg, color) => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "999px",
      padding: "5px 9px",
      background: bg,
      color,
      fontSize: "11px",
      fontWeight: 900,
      whiteSpace: "nowrap"
    })
  };

  const keepMsg = (value) => {
    setMsg(value);
    saveSafe(LS_MSG, value);
  };

  const keepRows = (value) => {
    setRows(value);
    saveSafe(LS_ROWS, value);
  };

  const keepLicenses = (value) => {
    setLicenses(value);
    saveSafe(LS_LICENSES, value);
  };

  const keepRequests = (value) => {
    setRequests(value);
    saveSafe(LS_REQUESTS, value);
  };

  const toggleNewLicense = () => {
    const next = !showNewLicense;
    setShowNewLicense(next);
    saveSafe(LS_SHOW_NEW, next);
  };

  const keepManualEmail = (rowId, email) => {
    const next = { ...manualEmails, [rowId]: String(email || "").trim().toLowerCase() };
    setManualEmails(next);
    saveSafe(LS_MANUAL_EMAILS, next);
  };

  const safeData = (row) => row?.data || {};
  const safeArr = (obj, key) => Array.isArray(obj?.[key]) ? obj[key] : [];

  const getStoreName = (row) => {
    const data = safeData(row);
    const profile = data.erpmini_company_profile || {};
    return profile.nomeFantasia || profile.razaoSocial || data.erpmini_storename || "Sem nome";
  };

  const getOwnerEmail = (row) => {
    const data = safeData(row);
    const profile = data.erpmini_company_profile || {};
    const synced = String(data.erpmini_owner_email || data.ownerEmail || profile.email || "").trim().toLowerCase();
    const manual = String(manualEmails?.[row.user_id] || "").trim().toLowerCase();
    return synced || manual;
  };

  const getLicenseByEmail = (email) => {
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) return null;
    return licenses.find((l) => String(l.email || "").trim().toLowerCase() === clean) || null;
  };

  const planLabel = (plan) => {
    const p = normalizePlan(plan || "starter");
    if (p === "starter") return "Starter grátis";
    if (p === "pro") return "Pro mensal";
    if (p === "premium") return "Premium anual";
    return p || "sem plano";
  };

  const planColor = (plan) => {
    const p = normalizePlan(plan || "starter");
    if (p === "premium") return ["#f5f3ff", "#7c3aed"];
    if (p === "pro") return ["#eff6ff", "#2563eb"];
    return ["#f8fafc", "#64748b"];
  };

  const rowSummary = (row) => {
    const data = safeData(row);
    const products = safeArr(data, "erpmini_products");
    const clients = safeArr(data, "erpmini_clients");
    const sales = safeArr(data, "erpmini_sales");
    const receivables = safeArr(data, "erpmini_receivables");
    const store = getStoreName(row);
    const email = getOwnerEmail(row);
    const license = getLicenseByEmail(email);

    const totalSold = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const todayKey = todayDate();
    const totalToday = sales
      .filter((s) => String(s.date || "").slice(0, 10) === todayKey)
      .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    const creditFromSales = sales
      .filter((s) => s.fiado && !s.fiado.paid)
      .reduce((sum, s) => sum + Math.max(0, (Number(s.total) || 0) - (Number(s.fiado?.paidAmount) || 0)), 0);

    const creditFromReceivables = receivables
      .filter((r) => !r.paid)
      .reduce((sum, r) => sum + Math.max(0, (Number(r.amount) || 0) - (Number(r.paidAmount) || 0)), 0);

    return {
      row,
      id: row.user_id,
      store,
      email,
      license,
      products,
      clients,
      sales,
      receivables,
      totalSold,
      totalToday,
      creditOpen: creditFromSales || creditFromReceivables,
      lowStock: products.filter((p) => (Number(p.stock) || 0) <= 5).length,
      lastSync: row.updated_at || data.__saved_at || ""
    };
  };

  const allCards = useMemo(() => {
    const storeCards = rows.map(rowSummary);
    const usedEmails = new Set(storeCards.map((c) => c.email).filter(Boolean));

    const licenseOnly = licenses
      .filter((lic) => !usedEmails.has(String(lic.email || "").trim().toLowerCase()))
      .map((lic) => ({
        row: null,
        id: `license-${lic.email}`,
        store: lic.company_name || lic.companyName || "Licença sem loja sincronizada",
        email: String(lic.email || "").trim().toLowerCase(),
        license: lic,
        products: [],
        clients: [],
        sales: [],
        receivables: [],
        totalSold: 0,
        totalToday: 0,
        creditOpen: 0,
        lowStock: 0,
        lastSync: ""
      }));

    return [...storeCards, ...licenseOnly];
  }, [rows, licenses, manualEmails]);

  const filteredCards = allCards.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(item.store || "").toLowerCase().includes(q) ||
      String(item.email || "").toLowerCase().includes(q) ||
      String(item.id || "").toLowerCase().includes(q)
    );
  });

  const getStatusInfo = (item) => {
    const status = String(item.license?.status || "").toLowerCase();
    const expired = item.license?.expires_at && item.license.expires_at < todayDate();

    if (status === "ativo" && !expired) return { text: "Ativo", bg: "#dcfce7", color: "#166534" };
    if (expired) return { text: "Vencido", bg: "#fff7ed", color: "#9a3412" };
    if (item.license) return { text: "Bloqueado", bg: "#fee2e2", color: "#991b1b" };
    return { text: "Sem plano", bg: "#f1f5f9", color: "#64748b" };
  };

  const totals = allCards.reduce(
    (acc, item) => {
      acc.clients += item.clients.length;
      acc.products += item.products.length;
      acc.sales += item.sales.length;
      acc.totalSold += item.totalSold;
      acc.today += item.totalToday;
      acc.creditOpen += item.creditOpen;

      const st = getStatusInfo(item).text;
      if (st === "Ativo") acc.active += 1;
      if (st !== "Ativo") acc.blocked += 1;

      const value = Number(String(item.license?.monthly_value || item.license?.monthlyValue || 0).replace(",", "."));
      if (getStatusInfo(item).text === "Ativo") acc.mrr += Number.isFinite(value) ? value : 0;

      return acc;
    },
    { clients: 0, products: 0, sales: 0, totalSold: 0, today: 0, creditOpen: 0, active: 0, blocked: 0, mrr: 0 }
  );

  const loadMaster = async () => {
    setLoading(true);
    keepMsg("Buscando clientes, lojas e licenças...");
    addDiagnosticLog("ADMIN", "Atualização iniciada", "info");

    try {
      const [cloudResp, licResp, reqResp] = await Promise.all([
        supabase.from(cloudTable).select("user_id,data,updated_at").order("updated_at", { ascending: false }),
        supabase.from("erpmini_licenses").select("*").order("email", { ascending: true }),
        supabase.from("erpmini_signup_requests").select("*").order("created_at", { ascending: false })
      ]);

      if (cloudResp.error) {
        addDiagnosticLog("ADMIN", "Falha ao carregar empresas", "error", cloudResp.error.message);
        keepMsg("Erro ao carregar lojas: " + cloudResp.error.message);
        setLoading(false);
        return;
      }

      if (licResp.error) {
        addDiagnosticLog("ADMIN", "Falha ao carregar licenças", "error", licResp.error.message);
        keepMsg("Erro ao carregar licenças: " + licResp.error.message);
        setLoading(false);
        return;
      }

      keepRows(cloudResp.data || []);
      keepLicenses(licResp.data || []);
      keepRequests(reqResp.error ? [] : reqResp.data || []);
      addDiagnosticLog("ADMIN", "Empresas carregadas", "success", `${(cloudResp.data || []).length} registro(s)`);
      addDiagnosticLog("ADMIN", "Licenças carregadas", "success", `${(licResp.data || []).length} registro(s)`);
      if (reqResp.error) {
        addDiagnosticLog("ADMIN", "Falha ao carregar solicitações", "error", reqResp.error.message);
      } else {
        addDiagnosticLog("ADMIN", "Solicitações carregadas", "success", `${(reqResp.data || []).length} registro(s)`);
      }
      keepMsg(`Carregado: ${(cloudResp.data || []).length} loja(s), ${(licResp.data || []).length} licença(s), ${(reqResp.data || []).length} solicitação(ões).`);
    } catch (err) {
      addDiagnosticLog("ADMIN", "Atualização interrompida", "error", err?.message || String(err));
      keepMsg("Erro inesperado: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const saveLicense = async (email, patch) => {
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      keepMsg("Informe um e-mail válido.");
      return false;
    }

    const existingLicense = getLicenseByEmail(cleanEmail);
    const current = existingLicense || {};
    const plan = normalizePlan(patch.plan ?? current.plan ?? "starter");

    const payload = {
      ...current,
      email: cleanEmail,
      status: patch.status ?? current.status ?? "ativo",
      plan,
      expires_at: plan === "starter" ? null : patch.expires_at ?? current.expires_at ?? addMonths(1),
      notes: patch.notes ?? current.notes ?? null,
      company_name: patch.company_name ?? current.company_name ?? null,
      responsible_name: patch.responsible_name ?? current.responsible_name ?? null,
      phone: patch.phone ?? current.phone ?? null,
      cnpj: patch.cnpj ?? current.cnpj ?? null,
      monthly_value: patch.monthly_value ?? current.monthly_value ?? null,
      updated_at: new Date().toISOString()
    };

    setLoading(true);

    const licenseQuery = supabase.from("erpmini_licenses");
    const { error } = existingLicense
      ? await licenseQuery.update(payload).eq("email", cleanEmail)
      : await licenseQuery.insert(payload);

    setLoading(false);

    if (error) {
      keepMsg("Erro ao salvar licença: " + error.message);
      return false;
    }

    keepMsg("Licença salva.");
    await loadMaster();
    return true;
  };

  const linkEmailToStore = async (item) => {
    if (!item.row) {
      keepMsg("Esta licença ainda não possui loja sincronizada.");
      return;
    }

    const cleanEmail = String(manualEmails?.[item.row.user_id] || item.email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      keepMsg("Informe um e-mail válido para vincular à loja.");
      return;
    }

    const currentData = safeData(item.row);
    const nextData = { ...currentData, erpmini_owner_email: cleanEmail };

    setLoading(true);
    const { error } = await supabase
      .from(cloudTable)
      .upsert(
        { user_id: item.row.user_id, data: nextData, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    setLoading(false);

    if (error) {
      keepMsg("Erro ao vincular e-mail: " + error.message);
      return;
    }

    await saveLicense(cleanEmail, {
      status: "ativo",
      plan: item.license?.plan || "starter",
      expires_at: item.license?.expires_at || null,
      company_name: item.store,
      notes: "E-mail vinculado pelo Painel Master."
    });

    keepMsg("E-mail vinculado à loja.");
    await loadMaster();
  };

  const changePlan = async (item, plan) => {
    const p = normalizePlan(plan);
    let expiresAt = null;

    if (p === "pro") expiresAt = addMonths(1);
    if (p === "premium") expiresAt = addYears(1);

    await saveLicense(item.email, {
      plan: p,
      status: "ativo",
      expires_at: p === "starter" ? null : expiresAt,
      company_name: item.store,
      notes: `Plano ${p} definido pelo Painel Master.`
    });
  };

  const changeStatus = async (item, status) => {
    await saveLicense(item.email, {
      status,
      plan: item.license?.plan || "starter",
      expires_at: item.license?.expires_at || null,
      company_name: item.store
    });
  };

  const changeExpires = async (item, value) => {
    await saveLicense(item.email, {
      status: item.license?.status || "ativo",
      plan: item.license?.plan || "pro",
      expires_at: value,
      company_name: item.store
    });
  };

  const deleteAccess = async (item) => {
    if (!item.email) {
      keepMsg("Este cliente não possui e-mail para excluir acesso.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("erpmini_licenses").delete().eq("email", item.email);
    setLoading(false);

    if (error) {
      keepMsg("Erro ao excluir acesso: " + error.message);
      return;
    }

    setConfirmAction(null);
    keepMsg("Acesso excluído.");
    await loadMaster();
  };

  const deleteStore = async (item) => {
    if (!item.row?.user_id) {
      keepMsg("Este cliente ainda não possui loja sincronizada para excluir.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from(cloudTable).delete().eq("user_id", item.row.user_id);
    setLoading(false);

    if (error) {
      keepMsg("Erro ao excluir loja: " + error.message);
      return;
    }

    setConfirmAction(null);
    keepMsg("Loja excluída.");
    await loadMaster();
  };

  const createLicense = async () => {
    const cleanEmail = String(newClient.email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      keepMsg("Informe o e-mail do cliente.");
      return;
    }

    const plan = normalizePlan(newClient.plan);
    const expiresAt = plan === "starter" ? null : newClient.expiresAt || addMonths(1);

    const ok = await saveLicense(cleanEmail, {
      status: "ativo",
      plan,
      expires_at: expiresAt,
      company_name: newClient.companyName,
      responsible_name: newClient.responsibleName,
      phone: newClient.phone,
      cnpj: newClient.cnpj,
      monthly_value: newClient.monthlyValue,
      notes: withBusinessNote(newClient.notes || "Licença criada pelo Painel Master.", newClient.businessType)
    });

    if (ok) {
      setNewClient({
        companyName: "",
        businessType: "comercio",
        cnpj: "",
        responsibleName: "",
        email: "",
        phone: "",
        plan: "pro",
        expiresAt: addMonths(1),
        monthlyValue: "69.90",
        notes: ""
      });
      setShowNewLicense(false);
      saveSafe(LS_SHOW_NEW, false);
    }
  };

  const approveRequest = async (request) => {
    const cleanEmail = String(request?.email || "").trim().toLowerCase();
    const requestBusinessType = request?.business_type === "servicos" ? "servicos" : "comercio";

    const ok = await saveLicense(cleanEmail, {
      status: "ativo",
      plan: "pro",
      expires_at: addMonths(1),
      notes: withBusinessNote("Aprovado pelo Painel Master.", requestBusinessType)
    });

    if (ok) {
      await supabase.from("erpmini_signup_requests").update({ status: "aprovado" }).eq("email", cleanEmail);
      await loadMaster();
    }
  };

  const rejectRequest = async (email) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    await supabase.from("erpmini_signup_requests").update({ status: "recusado" }).eq("email", cleanEmail);
    await loadMaster();
  };

  const deleteSignupRequest = async (request) => {
    const confirmed = window.confirm(`Excluir a solicitação de ${request.email}?\n\nO usuário poderá enviar uma nova solicitação no próximo login.`);
    if (!confirmed) return;

    setLoading(true);
    const query = supabase
      .from("erpmini_signup_requests")
      .update({ status: "excluido", updated_at: new Date().toISOString() });
    const { error } = request.id
      ? await query.eq("id", request.id)
      : await query.eq("email", String(request.email || "").trim().toLowerCase());
    setLoading(false);

    if (error) {
      addDiagnosticLog("ADMIN", "Falha ao excluir solicitação", "error", error.message);
      keepMsg("Erro ao excluir solicitação: " + error.message);
      return;
    }

    addDiagnosticLog("ADMIN", "Solicitação excluída", "success", request.email);
    keepMsg("Solicitação excluída. O usuário poderá enviar uma nova no próximo login.");
    await loadMaster();
  };

  const normalizeRequestStatus = (status) => String(status || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const isPendingRequest = (request) => ["pendente", "pending", "aguardando"].includes(normalizeRequestStatus(request?.status));
  const visibleRequests = requests.filter((request) => !["excluido", "excluida", "deleted"].includes(normalizeRequestStatus(request?.status)));
  const pendingRequests = visibleRequests.filter(isPendingRequest);

  const clearLogs = () => {
    clearDiagnosticLogs();
    setDiagnosticLogs([]);
  };

  const confirmTitle = confirmAction?.type === "store" ? "Excluir loja sincronizada" : "Excluir acesso";
  const confirmDescription = confirmAction?.type === "store"
    ? "Isso apaga produtos, clientes, vendas, caixa e dados sincronizados desta loja. Esta ação não pode ser desfeita."
    : "Isso remove o e-mail/licença do cliente. A loja sincronizada permanece salva, se existir.";

  return (
    <div style={{ ...card, padding:isMobile ? "14px" : "18px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
        <div>
          <div style={{ fontWeight:"900", fontSize:"21px", color:"#0f172a", letterSpacing:"-.03em" }}>Painel Master SaaS</div>
          <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>
            Administração comercial do ERPmini.
          </div>
        </div>
        <button style={{ ...btn("#0f172a"), padding:"10px 13px", fontSize:"12px" }} onClick={loadMaster} disabled={loading}>
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </div>

      {msg && (
        <div style={{ background:msg.startsWith("Erro") ? "#fef2f2" : "#fff7ed", border:"1px solid #fed7aa", color:msg.startsWith("Erro") ? "#991b1b" : "#9a3412", borderRadius:"14px", padding:"10px", fontSize:"12px", fontWeight:"800", marginBottom:"12px" }}>
          {msg}
        </div>
      )}

      <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"16px", padding:"12px", marginBottom:"12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", marginBottom:visibleRequests.length ? "10px" : 0 }}>
          <div>
            <div style={{ fontWeight:"900", color:"#9a3412" }}>Solicitações de acesso</div>
            <div style={{ color:"#c2410c", fontSize:"11px", fontWeight:"800" }}>
              {pendingRequests.length} pendente(s) • {visibleRequests.length} total
            </div>
          </div>
        </div>

        {visibleRequests.length === 0 ? (
          <div style={{ color:"#9a3412", fontSize:"12px", fontWeight:"700" }}>Nenhuma solicitação encontrada.</div>
        ) : (
          <div style={{ display:"grid", gap:"8px", maxHeight:"360px", overflowY:"auto" }}>
            {visibleRequests.map((r, index) => {
              const pending = isPendingRequest(r);
              const rawStatus = String(r.status || "sem status");
              return (
                <div key={r.id || `${r.email}-${r.created_at || index}`} style={{ background:"#fff", border:"1px solid #fed7aa", borderRadius:"12px", padding:"10px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"8px", flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontWeight:"900", color:"#0f172a", wordBreak:"break-all" }}>{r.email || "E-mail não informado"}</div>
                      <div style={{ color:"#64748b", fontSize:"11px", fontWeight:"700" }}>{r.created_at ? fmtDate(r.created_at) : "Data não informada"}</div>
                    </div>
                    <span style={ui.pill(pending ? "#fef3c7" : normalizeRequestStatus(r.status) === "aprovado" ? "#dcfce7" : "#f1f5f9", pending ? "#92400e" : normalizeRequestStatus(r.status) === "aprovado" ? "#166534" : "#64748b")}>
                      {rawStatus}
                    </span>
                  </div>
                  <div style={{ marginTop:"6px" }}>
                    <span style={ui.pill(r.business_type === "servicos" ? "#ecfdf5" : "#eff6ff", r.business_type === "servicos" ? "#047857" : "#2563eb")}>
                      {r.business_type === "servicos" ? "Serviços" : "Comércio"}
                    </span>
                  </div>
                  {pending && (
                    <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:"8px", marginTop:"8px" }}>
                      <button style={{ ...btnSm("#16a34a") }} onClick={()=>approveRequest(r)} disabled={loading}>Aprovar</button>
                      <button style={{ ...btnSm("#ef4444") }} onClick={()=>rejectRequest(r.email)} disabled={loading}>Recusar</button>
                    </div>
                  )}
                  <button style={{ ...btnSm("#991b1b"), width:"100%", marginTop:"8px" }} onClick={()=>deleteSignupRequest(r)} disabled={loading}>
                    Excluir solicitação
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background:"#0f172a", borderRadius:"16px", padding:"12px", marginBottom:"12px", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }}>
          <div>
            <div style={{ fontWeight:"900" }}>Diagnóstico do sistema</div>
            <div style={{ color:"#94a3b8", fontSize:"11px", fontWeight:"700" }}>{diagnosticLogs.length} evento(s) neste aparelho</div>
          </div>
          <button style={{ ...btnSm("#334155"), padding:"8px 10px" }} onClick={()=>setShowDiagnostics(!showDiagnostics)}>
            {showDiagnostics ? "Ocultar" : "Ver logs"}
          </button>
        </div>

        {showDiagnostics && (
          <div style={{ marginTop:"10px" }}>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"8px" }}>
              <button style={{ ...btnSm("#991b1b"), padding:"7px 10px" }} onClick={clearLogs} disabled={!diagnosticLogs.length}>Limpar logs</button>
            </div>
            <div style={{ display:"grid", gap:"6px", maxHeight:"320px", overflowY:"auto" }}>
              {diagnosticLogs.length === 0 ? (
                <div style={{ color:"#94a3b8", fontSize:"12px", textAlign:"center", padding:"12px" }}>Nenhum evento registrado.</div>
              ) : diagnosticLogs.map((log) => {
                const color = log.status === "success" ? "#4ade80" : log.status === "error" ? "#f87171" : log.status === "warning" ? "#fbbf24" : "#60a5fa";
                const icon = log.status === "success" ? "✔" : log.status === "error" ? "✖" : log.status === "warning" ? "!" : "•";
                return (
                  <div key={log.id} style={{ background:"#1e293b", borderRadius:"10px", padding:"8px 9px", fontSize:"11px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:"8px" }}>
                      <strong style={{ color }}>{icon} {log.scope} — {log.step}</strong>
                      <span style={{ color:"#94a3b8", whiteSpace:"nowrap" }}>{new Date(log.at).toLocaleTimeString("pt-BR")}</span>
                    </div>
                    {log.detail && <div style={{ color:"#cbd5e1", marginTop:"3px", wordBreak:"break-word" }}>{log.detail}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap:"8px", marginBottom:"12px" }}>
        {[
          ["Clientes", allCards.length, "#2563eb", "#eff6ff", "#bfdbfe"],
          ["Ativos", totals.active, "#16a34a", "#f0fdf4", "#bbf7d0"],
          ["Bloq./venc.", totals.blocked, "#dc2626", "#fef2f2", "#fecaca"],
          ["MRR", fmtCur(totals.mrr), "#7c3aed", "#f5f3ff", "#ddd6fe"],
          ["Crediário", fmtCur(totals.creditOpen), "#f97316", "#fff7ed", "#fed7aa"]
        ].map(([label, value, color, bg, border], idx) => (
          <div key={idx} style={{ background:bg, border:`1px solid ${border}`, borderRadius:"14px", padding:"11px" }}>
            <div style={{ color, fontSize:"11px", fontWeight:"900" }}>{label}</div>
            <div style={{ color, fontSize:String(value).length > 8 ? "16px" : "24px", fontWeight:"900", marginTop:"2px" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr auto", gap:"8px", marginBottom:"12px" }}>
        <input style={inp} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por empresa, e-mail ou ID..." />
        <button style={{ ...btn("#2563eb"), padding:"12px 16px" }} onClick={toggleNewLicense}>
          {showNewLicense ? "Fechar cadastro" : "+ Nova licença"}
        </button>
      </div>

      {showNewLicense && (
        <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"18px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <div>
              <div style={{ fontWeight:"900", color:"#0f172a", fontSize:"17px" }}>Nova licença</div>
              <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>Crie acesso para um cliente sem depender de loja sincronizada.</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:"8px" }}>
            <input style={inp} value={newClient.companyName} onChange={(e)=>setNewClient({...newClient, companyName:e.target.value})} placeholder="Empresa / Nome fantasia" />
            <select style={inp} value={newClient.businessType} onChange={(e)=>setNewClient({...newClient, businessType:e.target.value})}>
              <option value="comercio">Comércio</option>
              <option value="servicos">Serviços</option>
            </select>
            <input style={inp} value={newClient.cnpj} onChange={(e)=>setNewClient({...newClient, cnpj:formatCnpj(e.target.value)})} placeholder="CNPJ" />
            <input style={inp} value={newClient.responsibleName} onChange={(e)=>setNewClient({...newClient, responsibleName:e.target.value})} placeholder="Responsável" />
            <input style={inp} value={newClient.email} onChange={(e)=>setNewClient({...newClient, email:e.target.value})} placeholder="E-mail de acesso" />
            <input style={inp} value={newClient.phone} onChange={(e)=>setNewClient({...newClient, phone:formatPhone(e.target.value)})} placeholder="Telefone / WhatsApp" />
            <input style={inp} value={newClient.monthlyValue} onChange={(e)=>setNewClient({...newClient, monthlyValue:e.target.value})} placeholder="Valor mensal" />
            <select style={inp} value={newClient.plan} onChange={(e)=>setNewClient({...newClient, plan:e.target.value, expiresAt:e.target.value === "premium" ? addYears(1) : e.target.value === "pro" ? addMonths(1) : ""})}>
              <option value="starter">Starter grátis</option>
              <option value="pro">Pro mensal</option>
              <option value="premium">Premium anual</option>
            </select>
            <input style={inp} type="date" value={newClient.expiresAt} onChange={(e)=>setNewClient({...newClient, expiresAt:e.target.value})} disabled={newClient.plan === "starter"} />
          </div>

          <input style={{ ...inp, marginTop:"8px" }} value={newClient.notes} onChange={(e)=>setNewClient({...newClient, notes:e.target.value})} placeholder="Observações" />
          <button style={{ ...btn("#16a34a"), width:"100%", marginTop:"8px" }} onClick={createLicense} disabled={loading}>
            Criar licença
          </button>
        </div>
      )}

      <div style={{ display:"grid", gap:"12px" }}>
        {filteredCards.length === 0 ? (
          <div style={{ color:"#94a3b8", fontWeight:"800", textAlign:"center", padding:"18px 0" }}>
            Nenhum cliente encontrado.
          </div>
        ) : filteredCards.map((item) => {
          const statusInfo = getStatusInfo(item);
          const plan = normalizePlan(item.license?.plan || "starter");
          const [planBg, planText] = planColor(plan);
          const isLicenseOnly = !item.row;

          return (
            <div key={item.id} style={{ ...ui.softCard }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"5px" }}>
                    <span style={ui.pill(statusInfo.bg, statusInfo.color)}>{statusInfo.text}</span>
                    <span style={ui.pill(planBg, planText)}>{planLabel(plan)}</span>
                    <span style={ui.pill(businessTypeFromNotes(item.license?.notes) === "servicos" ? "#ecfdf5" : "#eff6ff", businessTypeFromNotes(item.license?.notes) === "servicos" ? "#047857" : "#2563eb")}>
                      {businessTypeFromNotes(item.license?.notes) === "servicos" ? "Serviços" : "Comércio"}
                    </span>
                    {isLicenseOnly && <span style={ui.pill("#f1f5f9", "#64748b")}>Aguardando 1º sync</span>}
                  </div>

                  <div style={{ fontWeight:"900", color:"#0f172a", fontSize:"19px", lineHeight:1.05 }}>{item.store}</div>
                  <div style={{ color:item.email ? "#64748b" : "#dc2626", fontSize:"12px", fontWeight:"800", wordBreak:"break-all", marginTop:"4px" }}>
                    {item.email ? item.email : "E-mail não vinculado"}
                  </div>
                  <div style={{ color:"#94a3b8", fontSize:"11px", fontWeight:"700", wordBreak:"break-all", marginTop:"2px" }}>
                    ID: {item.id}
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"8px", marginTop:"12px" }}>
                <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"9px" }}>
                  <div style={ui.label}>Vencimento</div>
                  <div style={{ ...ui.value, fontSize:"15px" }}>{item.license?.expires_at || "sem venc."}</div>
                </div>
                <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"9px" }}>
                  <div style={ui.label}>Mensalidade</div>
                  <div style={{ ...ui.value, color:"#7c3aed" }}>{fmtCur(Number(String(item.license?.monthly_value || 0).replace(",", ".")))}</div>
                </div>
                <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"9px" }}>
                  <div style={ui.label}>Faturamento loja</div>
                  <div style={{ ...ui.value, color:"#16a34a" }}>{fmtCur(item.totalSold)}</div>
                </div>
                <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"9px" }}>
                  <div style={ui.label}>Crediário loja</div>
                  <div style={{ ...ui.value, color:"#f97316" }}>{fmtCur(item.creditOpen)}</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"10px" }}>
                <span style={ui.pill("#eff6ff", "#2563eb")}>{item.products.length} produto(s)</span>
                <span style={ui.pill("#f5f3ff", "#7c3aed")}>{item.clients.length} cliente(s)</span>
                <span style={ui.pill("#fdf2f8", "#e94560")}>{item.sales.length} venda(s)</span>
                <span style={ui.pill("#fff7ed", "#9a3412")}>Sync: {item.lastSync ? fmtDate(item.lastSync) : "-"}</span>
              </div>

              {item.row && (
                <div style={{ marginTop:"10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}>
                  <label style={{ fontSize:"11px", fontWeight:"900", color:"#64748b", display:"block", marginBottom:"5px" }}>E-mail responsável</label>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr auto", gap:"8px" }}>
                    <input style={inp} value={manualEmails[item.row.user_id] ?? item.email ?? ""} onChange={(e)=>keepManualEmail(item.row.user_id, e.target.value)} placeholder="email@cliente.com" />
                    <button style={{ ...btnSm("#2563eb"), minWidth:isMobile ? "100%" : "120px" }} onClick={()=>linkEmailToStore(item)} disabled={loading}>
                      Vincular
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr 1fr", gap:"8px", marginTop:"10px" }}>
                <select style={inp} value={plan} onChange={(e)=>changePlan(item, e.target.value)} disabled={!item.email || loading}>
                  <option value="starter">Starter grátis</option>
                  <option value="pro">Pro mensal</option>
                  <option value="premium">Premium anual</option>
                </select>
                <select style={inp} value={businessTypeFromNotes(item.license?.notes)} onChange={(e)=>saveLicense(item.email, { notes: withBusinessNote(item.license?.notes || "", e.target.value) })} disabled={!item.email || loading}>
                  <option value="comercio">Comércio</option>
                  <option value="servicos">Serviços</option>
                </select>
                <input style={inp} type="date" value={item.license?.expires_at || ""} onChange={(e)=>changeExpires(item, e.target.value)} disabled={!item.email || plan === "starter" || loading} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(3,1fr)", gap:"6px", marginTop:"8px" }}>
                <button style={{ ...btnSm(plan === "starter" ? "#64748b" : "#94a3b8") }} onClick={()=>changePlan(item, "starter")} disabled={!item.email || loading}>Starter</button>
                <button style={{ ...btnSm(plan === "pro" ? "#2563eb" : "#94a3b8") }} onClick={()=>changePlan(item, "pro")} disabled={!item.email || loading}>Pro mensal</button>
                <button style={{ ...btnSm(plan === "premium" ? "#7c3aed" : "#94a3b8") }} onClick={()=>changePlan(item, "premium")} disabled={!item.email || loading}>Premium</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"6px", marginTop:"8px" }}>
                <button style={{ ...btnSm("#16a34a") }} onClick={()=>changeStatus(item, "ativo")} disabled={!item.email || loading}>Liberar</button>
                <button style={{ ...btnSm("#ef4444") }} onClick={()=>changeStatus(item, "bloqueado")} disabled={!item.email || loading}>Bloquear</button>
                <button style={{ ...btnSm("#f97316") }} onClick={()=>setConfirmAction({ type:"access", item })} disabled={!item.email || loading}>Excluir acesso</button>
                <button style={{ ...btnSm("#991b1b") }} onClick={()=>setConfirmAction({ type:"store", item })} disabled={!item.row || loading}>Excluir loja</button>
              </div>

              <button style={{ ...btnSm("#6366f1"), marginTop:"10px", width:"100%" }} onClick={()=>setOpenId(openId === item.id ? null : item.id)}>
                {openId === item.id ? "Ocultar detalhes" : "Ver detalhes"}
              </button>

              {openId === item.id && (
                <div style={{ marginTop:"10px", background:"#f8fafc", borderRadius:"12px", padding:"10px" }}>
                  <div style={{ fontWeight:"900", marginBottom:"8px" }}>Detalhes do cliente</div>
                  <div style={{ display:"grid", gap:"6px", fontSize:"12px", color:"#334155" }}>
                    <div><strong>Última sincronização:</strong> {item.lastSync ? fmtDate(item.lastSync) : "-"}</div>
                    <div><strong>Produtos:</strong> {item.products.length}</div>
                    <div><strong>Clientes:</strong> {item.clients.length}</div>
                    <div><strong>Vendas:</strong> {item.sales.length}</div>
                    <div><strong>Estoque baixo:</strong> {item.lowStock}</div>
                    <div><strong>Observações:</strong> {item.license?.notes || "-"}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmAction && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"18px" }}>
          <div style={{ background:"#fff", borderRadius:"22px", padding:"18px", width:"100%", maxWidth:"420px", boxShadow:"0 25px 80px rgba(0,0,0,.35)" }}>
            <div style={{ fontWeight:"900", color:"#0f172a", fontSize:"21px", marginBottom:"8px" }}>{confirmTitle}</div>
            <div style={{ color:"#64748b", fontWeight:"700", lineHeight:1.4, marginBottom:"12px" }}>{confirmDescription}</div>
            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"14px", padding:"10px", marginBottom:"12px" }}>
              <div style={{ fontWeight:"900", color:"#0f172a" }}>{confirmAction.item.store}</div>
              <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"800", wordBreak:"break-all" }}>{confirmAction.item.email || "sem e-mail"}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
              <button style={{ ...btnSm("#64748b"), padding:"12px" }} onClick={()=>setConfirmAction(null)}>Cancelar</button>
              <button style={{ ...btnSm("#991b1b"), padding:"12px" }} onClick={()=>confirmAction.type === "store" ? deleteStore(confirmAction.item) : deleteAccess(confirmAction.item)}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
