import { useMemo, useState } from "react";

const LS_ROWS = "erpmini_saas_master_rows";
const LS_LICENSES = "erpmini_saas_master_licenses";
const LS_REQUESTS = "erpmini_saas_master_requests";
const LS_MSG = "erpmini_saas_master_msg";
const LS_MANUAL_EMAILS = "erpmini_saas_master_manual_emails";

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
  const [newClient, setNewClient] = useState({
    companyName: "",
    cnpj: "",
    responsibleName: "",
    email: "",
    phone: "",
    plan: "pro",
    expiresAt: addMonths(1),
    monthlyValue: "69.90",
    notes: ""
  });

  const keepMsg = (value) => { setMsg(value); saveSafe(LS_MSG, value); };
  const keepRows = (value) => { setRows(value); saveSafe(LS_ROWS, value); };
  const keepLicenses = (value) => { setLicenses(value); saveSafe(LS_LICENSES, value); };
  const keepRequests = (value) => { setRequests(value); saveSafe(LS_REQUESTS, value); };

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
    const totalToday = sales.filter((s) => String(s.date || "").slice(0, 10) === todayKey).reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const creditFromSales = sales.filter((s) => s.fiado && !s.fiado.paid).reduce((sum, s) => sum + Math.max(0, (Number(s.total) || 0) - (Number(s.fiado?.paidAmount) || 0)), 0);
    const creditFromReceivables = receivables.filter((r) => !r.paid).reduce((sum, r) => sum + Math.max(0, (Number(r.amount) || 0) - (Number(r.paidAmount) || 0)), 0);
    return { row, id: row.user_id, store, email, license, products, clients, sales, receivables, totalSold, totalToday, creditOpen: creditFromSales || creditFromReceivables, lowStock: products.filter((p) => (Number(p.stock) || 0) <= 5).length, lastSync: row.updated_at || data.__saved_at || "" };
  };

  const allCards = useMemo(() => {
    const storeCards = rows.map(rowSummary);
    const usedEmails = new Set(storeCards.map((c) => c.email).filter(Boolean));
    const licenseOnly = licenses.filter((lic) => !usedEmails.has(String(lic.email || "").trim().toLowerCase())).map((lic) => ({ row: null, id: `license-${lic.email}`, store: "Licença sem loja sincronizada", email: String(lic.email || "").trim().toLowerCase(), license: lic, products: [], clients: [], sales: [], receivables: [], totalSold: 0, totalToday: 0, creditOpen: 0, lowStock: 0, lastSync: "" }));
    return [...storeCards, ...licenseOnly];
  }, [rows, licenses, manualEmails]);

  const filteredCards = allCards.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(item.store || "").toLowerCase().includes(q) || String(item.email || "").toLowerCase().includes(q) || String(item.id || "").toLowerCase().includes(q);
  });

  const totals = allCards.reduce((acc, item) => {
    acc.clients += item.clients.length;
    acc.products += item.products.length;
    acc.sales += item.sales.length;
    acc.totalSold += item.totalSold;
    acc.today += item.totalToday;
    acc.creditOpen += item.creditOpen;
    const status = String(item.license?.status || "").toLowerCase();
    const expired = item.license?.expires_at && item.license.expires_at < todayDate();
    if (status === "ativo" && !expired) acc.active += 1;
    if (!item.license || status !== "ativo" || expired) acc.blocked += 1;
    return acc;
  }, { clients: 0, products: 0, sales: 0, totalSold: 0, today: 0, creditOpen: 0, active: 0, blocked: 0 });

  const loadMaster = async () => {
    setLoading(true);
    keepMsg("Buscando clientes, lojas e licenças...");
    try {
      const [cloudResp, licResp, reqResp] = await Promise.all([
        supabase.from(cloudTable).select("user_id,data,updated_at").order("updated_at", { ascending: false }),
        supabase.from("erpmini_licenses").select("email,status,expires_at,plan,notes,updated_at").order("email", { ascending: true }),
        supabase.from("erpmini_signup_requests").select("*").order("created_at", { ascending: false })
      ]);
      if (cloudResp.error) { keepMsg("Erro ao carregar lojas: " + cloudResp.error.message); return; }
      if (licResp.error) { keepMsg("Erro ao carregar licenças: " + licResp.error.message); return; }
      keepRows(cloudResp.data || []);
      keepLicenses(licResp.data || []);
      keepRequests(reqResp.error ? [] : reqResp.data || []);
      keepMsg(`Carregado: ${(cloudResp.data || []).length} loja(s), ${(licResp.data || []).length} licença(s).`);
    } catch (err) {
      keepMsg("Erro inesperado: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const makeNotes = (extra) => {
    const parts = [];
    if (extra.companyName) parts.push(`Empresa: ${extra.companyName}`);
    if (extra.cnpj) parts.push(`CNPJ: ${extra.cnpj}`);
    if (extra.responsibleName) parts.push(`Responsável: ${extra.responsibleName}`);
    if (extra.phone) parts.push(`Telefone: ${extra.phone}`);
    if (extra.monthlyValue) parts.push(`Valor: ${extra.monthlyValue}`);
    if (extra.notes) parts.push(`Obs: ${extra.notes}`);
    return parts.join(" | ") || null;
  };

  const saveLicense = async (email, patch) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) { keepMsg("Informe um e-mail válido."); return false; }
    const current = getLicenseByEmail(cleanEmail) || {};
    const plan = normalizePlan(patch.plan ?? current.plan ?? "starter");
    const payload = { email: cleanEmail, status: patch.status ?? current.status ?? "ativo", plan, expires_at: plan === "starter" ? null : patch.expires_at ?? current.expires_at ?? addMonths(1), notes: patch.notes ?? current.notes ?? null, updated_at: new Date().toISOString() };
    setLoading(true);
    const { error } = await supabase.from("erpmini_licenses").upsert(payload, { onConflict: "email" });
    setLoading(false);
    if (error) { keepMsg("Erro ao salvar licença: " + error.message); return false; }
    keepMsg("Licença salva.");
    await loadMaster();
    return true;
  };

  const linkEmailToStore = async (item) => {
    if (!item.row) { keepMsg("Esta licença ainda não possui loja sincronizada."); return; }
    const cleanEmail = String(manualEmails?.[item.row.user_id] || item.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) { keepMsg("Informe um e-mail válido para vincular à loja."); return; }
    const currentData = safeData(item.row);
    const nextData = { ...currentData, erpmini_owner_email: cleanEmail };
    setLoading(true);
    const { error } = await supabase.from(cloudTable).upsert({ user_id: item.row.user_id, data: nextData, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setLoading(false);
    if (error) { keepMsg("Erro ao vincular e-mail: " + error.message); return; }
    await saveLicense(cleanEmail, { status: "ativo", plan: item.license?.plan || "starter", expires_at: item.license?.expires_at || null, notes: `Loja: ${item.store} | E-mail vinculado pelo Painel Master.` });
  };

  const changePlan = async (item, plan) => {
    const p = normalizePlan(plan);
    let expiresAt = item.license?.expires_at || null;
    if (p === "pro" && !expiresAt) expiresAt = addMonths(1);
    if (p === "premium" && !expiresAt) expiresAt = addYears(1);
    await saveLicense(item.email, { plan: p, status: "ativo", expires_at: p === "starter" ? null : expiresAt, notes: `Loja: ${item.store} | Plano ${p} definido pelo Painel Master.` });
  };

  const changeStatus = async (item, status) => {
    await saveLicense(item.email, { status, plan: item.license?.plan || "starter", expires_at: item.license?.expires_at || null });
  };

  const changeExpires = async (item, value) => {
    await saveLicense(item.email, { status: item.license?.status || "ativo", plan: item.license?.plan || "pro", expires_at: value });
  };

  const deleteAccess = async (item) => {
    if (!item.email) { keepMsg("Este cliente não possui e-mail para excluir acesso."); return; }
    if (!window.confirm(`Excluir o acesso/licença do e-mail ${item.email}?`)) return;
    setLoading(true);
    const { error } = await supabase.from("erpmini_licenses").delete().eq("email", item.email);
    setLoading(false);
    if (error) { keepMsg("Erro ao excluir acesso: " + error.message); return; }
    keepMsg("Acesso excluído.");
    await loadMaster();
  };

  const deleteStore = async (item) => {
    if (!item.row?.user_id) { keepMsg("Este cliente ainda não possui loja sincronizada para excluir."); return; }
    if (!window.confirm(`Excluir a loja "${item.store}"?\n\nIsso apaga produtos, clientes, vendas, caixa e dados sincronizados desta loja.\n\nEsta ação não pode ser desfeita.`)) return;
    setLoading(true);
    const { error } = await supabase.from(cloudTable).delete().eq("user_id", item.row.user_id);
    setLoading(false);
    if (error) { keepMsg("Erro ao excluir loja: " + error.message); return; }
    keepMsg("Loja excluída.");
    await loadMaster();
  };

  const createLicense = async () => {
    const cleanEmail = String(newClient.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) { keepMsg("Informe o e-mail do cliente."); return; }
    const plan = normalizePlan(newClient.plan);
    const expiresAt = plan === "starter" ? null : newClient.expiresAt || addMonths(1);
    const ok = await saveLicense(cleanEmail, { status: "ativo", plan, expires_at: expiresAt, notes: makeNotes(newClient) });
    if (ok) setNewClient({ companyName: "", cnpj: "", responsibleName: "", email: "", phone: "", plan: "pro", expiresAt: addMonths(1), monthlyValue: "69.90", notes: "" });
  };

  const approveRequest = async (email) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const ok = await saveLicense(cleanEmail, { status: "ativo", plan: "pro", expires_at: addMonths(1), notes: "Aprovado pelo Painel Master." });
    if (ok) { await supabase.from("erpmini_signup_requests").update({ status: "aprovado" }).eq("email", cleanEmail); await loadMaster(); }
  };

  const rejectRequest = async (email) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    await supabase.from("erpmini_signup_requests").update({ status: "recusado" }).eq("email", cleanEmail);
    await loadMaster();
  };

  const pendingRequests = requests.filter((r) => String(r.status || "").toLowerCase() === "pendente");

  return (
    <div style={card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
        <div>
          <div style={{ fontWeight:"900", fontSize:"19px", color:"#0f172a" }}>Painel Master SaaS</div>
          <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>Clientes, lojas, planos, vencimentos e acessos do ERPmini.</div>
        </div>
        <button style={{ ...btn("#0f172a"), padding:"9px 12px", fontSize:"12px" }} onClick={loadMaster} disabled={loading}>{loading ? "Carregando..." : "Atualizar"}</button>
      </div>
      {msg && <div style={{ background:msg.startsWith("Erro") ? "#fef2f2" : "#fff7ed", border:"1px solid #fed7aa", color:msg.startsWith("Erro") ? "#991b1b" : "#9a3412", borderRadius:"12px", padding:"10px", fontSize:"12px", fontWeight:"800", marginBottom:"12px" }}>{msg}</div>}
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"8px", marginBottom:"12px" }}>
        <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"12px", padding:"10px" }}><div style={{ color:"#1d4ed8", fontSize:"11px", fontWeight:"900" }}>Clientes</div><div style={{ color:"#2563eb", fontSize:"22px", fontWeight:"900" }}>{allCards.length}</div></div>
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"12px", padding:"10px" }}><div style={{ color:"#166534", fontSize:"11px", fontWeight:"900" }}>Ativos</div><div style={{ color:"#16a34a", fontSize:"22px", fontWeight:"900" }}>{totals.active}</div></div>
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"12px", padding:"10px" }}><div style={{ color:"#991b1b", fontSize:"11px", fontWeight:"900" }}>Bloq./vencidos</div><div style={{ color:"#dc2626", fontSize:"22px", fontWeight:"900" }}>{totals.blocked}</div></div>
        <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"12px", padding:"10px" }}><div style={{ color:"#9a3412", fontSize:"11px", fontWeight:"900" }}>Crediário lojas</div><div style={{ color:"#f97316", fontSize:"18px", fontWeight:"900" }}>{fmtCur(totals.creditOpen)}</div></div>
      </div>
      <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"16px", padding:"12px", marginBottom:"12px" }}>
        <div style={{ fontWeight:"900", color:"#0f172a", marginBottom:"8px" }}>+ Nova licença</div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:"8px" }}>
          <input style={inp} value={newClient.companyName} onChange={(e)=>setNewClient({...newClient, companyName:e.target.value})} placeholder="Empresa / Nome fantasia" />
          <input style={inp} value={newClient.cnpj} onChange={(e)=>setNewClient({...newClient, cnpj:e.target.value})} placeholder="CNPJ" />
          <input style={inp} value={newClient.responsibleName} onChange={(e)=>setNewClient({...newClient, responsibleName:e.target.value})} placeholder="Responsável" />
          <input style={inp} value={newClient.email} onChange={(e)=>setNewClient({...newClient, email:e.target.value})} placeholder="E-mail de acesso" />
          <input style={inp} value={newClient.phone} onChange={(e)=>setNewClient({...newClient, phone:e.target.value})} placeholder="Telefone / WhatsApp" />
          <input style={inp} value={newClient.monthlyValue} onChange={(e)=>setNewClient({...newClient, monthlyValue:e.target.value})} placeholder="Valor mensal" />
          <select style={inp} value={newClient.plan} onChange={(e)=>setNewClient({...newClient, plan:e.target.value})}><option value="starter">Starter grátis</option><option value="pro">Pro mensal</option><option value="premium">Premium anual</option></select>
          <input style={inp} type="date" value={newClient.expiresAt} onChange={(e)=>setNewClient({...newClient, expiresAt:e.target.value})} />
        </div>
        <input style={{ ...inp, marginTop:"8px" }} value={newClient.notes} onChange={(e)=>setNewClient({...newClient, notes:e.target.value})} placeholder="Observações" />
        <button style={{ ...btn("#16a34a"), width:"100%", marginTop:"8px" }} onClick={createLicense} disabled={loading}>Criar licença</button>
      </div>
      {pendingRequests.length > 0 && <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:"16px", padding:"12px", marginBottom:"12px" }}><div style={{ fontWeight:"900", color:"#9a3412", marginBottom:"8px" }}>Solicitações pendentes</div><div style={{ display:"grid", gap:"8px" }}>{pendingRequests.map((r) => <div key={r.email} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}><div style={{ fontWeight:"900", color:"#0f172a", wordBreak:"break-all" }}>{r.email}</div><div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700", marginBottom:"8px" }}>{r.created_at ? fmtDate(r.created_at) : "-"}</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}><button style={{ ...btnSm("#16a34a") }} onClick={()=>approveRequest(r.email)} disabled={loading}>Aprovar</button><button style={{ ...btnSm("#ef4444") }} onClick={()=>rejectRequest(r.email)} disabled={loading}>Recusar</button></div></div>)}</div></div>}
      <input style={{ ...inp, marginBottom:"12px" }} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por empresa, e-mail ou ID..." />
      <div style={{ display:"grid", gap:"12px" }}>
        {filteredCards.length === 0 ? <div style={{ color:"#94a3b8", fontWeight:"800", textAlign:"center", padding:"18px 0" }}>Nenhum cliente encontrado.</div> : filteredCards.map((item) => {
          const status = String(item.license?.status || "").toLowerCase();
          const expired = item.license?.expires_at && item.license.expires_at < todayDate();
          const active = status === "ativo" && !expired;
          const statusText = active ? "Ativo" : expired ? "Vencido" : item.license ? "Bloqueado" : "Sem plano";
          const statusBg = active ? "#dcfce7" : "#fee2e2";
          const statusColor = active ? "#166534" : "#991b1b";
          const plan = normalizePlan(item.license?.plan || "starter");
          return <div key={item.id} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"16px", padding:"12px", boxShadow:"0 6px 18px rgba(15,23,42,.04)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}><div style={{ minWidth:0 }}><div style={{ fontWeight:"900", color:"#0f172a", fontSize:"18px" }}>{item.store}</div><div style={{ color:item.email ? "#64748b" : "#dc2626", fontSize:"12px", fontWeight:"800", wordBreak:"break-all" }}>E-mail: {item.email || "não vinculado"}</div><div style={{ color:"#94a3b8", fontSize:"11px", fontWeight:"700", wordBreak:"break-all" }}>ID: {item.id}</div></div><span style={{ borderRadius:"999px", padding:"5px 9px", fontSize:"11px", fontWeight:"900", color:statusColor, background:statusBg, whiteSpace:"nowrap" }}>{statusText}</span></div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"8px", marginTop:"10px" }}><div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}><div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Plano</div><div style={{ fontWeight:"900" }}>{planLabel(item.license?.plan)}</div></div><div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}><div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Vencimento</div><div style={{ fontWeight:"900" }}>{item.license?.expires_at || "sem venc."}</div></div><div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}><div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Faturamento</div><div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(item.totalSold)}</div></div><div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}><div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Crediário</div><div style={{ fontWeight:"900", color:"#f97316" }}>{fmtCur(item.creditOpen)}</div></div></div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"9px" }}><span style={{ background:"#eff6ff", color:"#2563eb", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{item.products.length} produto(s)</span><span style={{ background:"#f5f3ff", color:"#7c3aed", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{item.clients.length} cliente(s)</span><span style={{ background:"#fdf2f8", color:"#e94560", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{item.sales.length} venda(s)</span></div>
            {item.row && <div style={{ marginTop:"10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}><label style={{ fontSize:"11px", fontWeight:"900", color:"#64748b", display:"block", marginBottom:"5px" }}>E-mail responsável</label><div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr auto", gap:"8px" }}><input style={inp} value={manualEmails[item.row.user_id] ?? item.email ?? ""} onChange={(e)=>keepManualEmail(item.row.user_id, e.target.value)} placeholder="email@cliente.com" /><button style={{ ...btnSm("#2563eb"), minWidth:isMobile ? "100%" : "120px" }} onClick={()=>linkEmailToStore(item)} disabled={loading}>Vincular</button></div></div>}
            <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:"8px", marginTop:"10px" }}><select style={inp} value={plan} onChange={(e)=>changePlan(item, e.target.value)} disabled={!item.email || loading}><option value="starter">Starter grátis</option><option value="pro">Pro mensal</option><option value="premium">Premium anual</option></select><input style={inp} type="date" value={item.license?.expires_at || ""} onChange={(e)=>changeExpires(item, e.target.value)} disabled={!item.email || plan === "starter" || loading} /></div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:"6px", marginTop:"8px" }}><button style={{ ...btnSm("#16a34a") }} onClick={()=>changeStatus(item, "ativo")} disabled={!item.email || loading}>Liberar</button><button style={{ ...btnSm("#ef4444") }} onClick={()=>changeStatus(item, "bloqueado")} disabled={!item.email || loading}>Bloquear</button><button style={{ ...btnSm("#f97316") }} onClick={()=>deleteAccess(item)} disabled={!item.email || loading}>Excluir acesso</button><button style={{ ...btnSm("#991b1b") }} onClick={()=>deleteStore(item)} disabled={loading}>Excluir loja</button></div>
            <button style={{ ...btnSm("#6366f1"), marginTop:"10px", width:"100%" }} onClick={()=>setOpenId(openId === item.id ? null : item.id)}>{openId === item.id ? "Ocultar detalhes" : "Ver detalhes"}</button>
            {openId === item.id && <div style={{ marginTop:"10px", background:"#f8fafc", borderRadius:"12px", padding:"10px" }}><div style={{ fontWeight:"900", marginBottom:"8px" }}>Detalhes</div><div style={{ display:"grid", gap:"6px", fontSize:"12px" }}><div><strong>Última sincronização:</strong> {item.lastSync ? fmtDate(item.lastSync) : "-"}</div><div><strong>Produtos:</strong> {item.products.length}</div><div><strong>Clientes:</strong> {item.clients.length}</div><div><strong>Vendas:</strong> {item.sales.length}</div><div><strong>Estoque baixo:</strong> {item.lowStock}</div><div><strong>Observação licença:</strong> {item.license?.notes || "-"}</div></div></div>}
          </div>;
        })}
      </div>
    </div>
  );
}
