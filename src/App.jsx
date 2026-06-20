import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";


const SUPABASE_URL = "https://fxahftlnanvcyzxwejhe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PAIUP7LETrzQfZLMWcpsfw_8v8IeXTx";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createPendingLicenseForCurrentUser(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return { ok: false, message: "E-mail invalido." };

  const { error } = await supabase
    .from("erpmini_signup_requests")
    .insert([
      {
        email: cleanEmail,
        status: "pendente"
      }
    ]);

  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("already exists")) {
      return { ok: true, message: "Solicitacao ja existente." };
    }
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "Solicitacao criada." };
}

async function fetchSignupRequests() {
  const { data, error } = await supabase
    .from("erpmini_signup_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

async function markSignupRequestApproved(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  await supabase
    .from("erpmini_signup_requests")
    .update({ status: "aprovado" })
    .eq("email", cleanEmail);
}

async function markSignupRequestRejected(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  await supabase
    .from("erpmini_signup_requests")
    .update({ status: "recusado" })
    .eq("email", cleanEmail);
}


const CLOUD_TABLE = "erpmini_cloud_data";
const CLOUD_KEYS = [
  "erpmini_activation_key",
  "erpmini_backup_history",
  "erpmini_backup_last_date",
  "erpmini_backup_latest",
  "erpmini_cash_closures",
  "erpmini_cash_ops",
  "erpmini_clients",
  "erpmini_payables",
  "erpmini_products",
  "erpmini_receivables",
  "erpmini_salecounter",
  "erpmini_sales",
  "erpmini_storename"
];

let cloudUserId = null;
let cloudSaveTimer = null;
let cloudApplyingRemote = false;

const OFFLINE_PENDING_KEY = "erpmini_offline_pending";
const OFFLINE_LAST_SYNC_KEY = "erpmini_offline_last_sync";

function setOfflinePending(value) {
  try {
    localStorage.setItem(OFFLINE_PENDING_KEY, JSON.stringify(!!value));
    window.dispatchEvent(new CustomEvent("erpmini-sync-state", { detail: { pending: !!value } }));
  } catch {}
}

function getOfflinePending() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_PENDING_KEY) || "false");
  } catch {
    return false;
  }
}

function setOfflineLastSync() {
  try {
    localStorage.setItem(OFFLINE_LAST_SYNC_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("erpmini-sync-state", { detail: { pending: false } }));
  } catch {}
}


function readLocalJsonSafe(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function collectCloudPayload() {
  const payload = {};
  CLOUD_KEYS.forEach((key) => {
    payload[key] = readLocalJsonSafe(key);
  });
  payload.__saved_at = new Date().toISOString();
  payload.__app_version = APP_VERSION;
  return payload;
}

async function uploadCloudSnapshotNow() {
  if (!cloudUserId || cloudApplyingRemote) return { ok: false, skipped: true };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOfflinePending(true);
    return { ok: false, offline: true };
  }

  try {
    const payload = collectCloudPayload();
    const { error } = await supabase
      .from(CLOUD_TABLE)
      .upsert(
        { user_id: cloudUserId, data: payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) throw error;

    setOfflinePending(false);
    setOfflineLastSync();
    return { ok: true };
  } catch (err) {
    setOfflinePending(true);
    console.warn("ERPmini cloud save error:", err);
    return { ok: false, error: err };
  }
}

function scheduleCloudSave() {
  if (!cloudUserId || cloudApplyingRemote) return;
  setOfflinePending(true);
  clearTimeout(cloudSaveTimer);

  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  cloudSaveTimer = setTimeout(uploadCloudSnapshotNow, 2500);
}

async function downloadCloudSnapshot(userId) {
  if (!userId) return { ok: false, message: "Usuario nao identificado." };

  cloudUserId = userId;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOfflinePending(getOfflinePending());
    return { ok: true, offline: true, message: "Modo offline. Usando dados salvos neste aparelho." };
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("ERPmini cloud load error:", error);
    return { ok: false, message: error.message };
  }

  if (!data?.data) {
    await uploadCloudSnapshotNow();
    return { ok: true, message: "Primeiro backup enviado para nuvem." };
  }

  cloudApplyingRemote = true;
  try {
    CLOUD_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data.data, key) && data.data[key] !== null) {
        localStorage.setItem(key, JSON.stringify(data.data[key]));
      }
    });
  } finally {
    cloudApplyingRemote = false;
  }

  return { ok: true, message: "Dados carregados da nuvem." };
}


async function checkLicenseByEmail(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return { ok: false, title: "Licenca nao encontrada", message: "Nao foi possivel identificar o e-mail do usuario." };
  }

  const cachedLicenseKey = `erpmini_cached_license_${normalizedEmail}`;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const cached = readLocalJsonSafe(cachedLicenseKey);
    if (cached?.ok) {
      return { ...cached, offlineCached: true, message: "Licenca validada pelo ultimo acesso online." };
    }
    return {
      ok: false,
      title: "Sem conexao",
      message: "Abra o ERPmini uma vez com internet para validar a licenca neste aparelho."
    };
  }

  try {
    const { data, error } = await supabase
      .from("erpmini_licenses")
      .select("email, status, expires_at, plan")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.warn("ERPmini license error:", error);
      const cached = readLocalJsonSafe(cachedLicenseKey);
      if (cached?.ok) {
        return { ...cached, offlineCached: true, message: "Licenca validada pelo ultimo acesso online." };
      }
      return {
        ok: false,
        title: "Erro ao validar licenca",
        message: "Nao foi possivel validar sua licenca agora. Verifique a conexao ou fale com o suporte.",
      };
    }

    if (!data) {
      return {
        ok: false,
        title: "Licenca nao liberada",
        message: "Este e-mail ainda nao esta liberado para usar o ERPmini.",
      };
    }

    const licenseStatus = (data.status || "").toLowerCase();

    if (licenseStatus === "pendente") {
      return {
        ok: false,
        title: "Cadastro aguardando aprovacao",
        message: "Sua conta foi criada. Aguarde o administrador liberar seu acesso.",
      };
    }

    if (licenseStatus !== "ativo") {
      return {
        ok: false,
        title: "Licenca bloqueada",
        message: "Sua licenca esta bloqueada. Regularize o pagamento para liberar o acesso.",
      };
    }

    const planName = normalizePlan(data.plan || "starter");

    if (planName !== "starter") {
      if (!data.expires_at) {
        return {
          ok: false,
          title: "Licenca sem vencimento",
          message: "Sua licenca ainda nao possui data de vencimento. Fale com o suporte.",
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expires = new Date(data.expires_at + "T00:00:00");

      if (expires < today) {
        return {
          ok: false,
          title: "Licenca vencida",
          message: `Sua licenca venceu em ${data.expires_at}. Regularize o pagamento para liberar o acesso.`,
        };
      }
    }

    return { ok: true, license: data };
  } catch (err) {
    console.warn("ERPmini license exception:", err);
    return {
      ok: false,
      title: "Erro ao validar licenca",
      message: "Ocorreu um erro inesperado ao validar sua licenca.",
    };
  }
}

function SupabaseLicenseBlockedScreen({ info, onLogout }) {
  if (showSplash) {
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f172a,#111827)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", color:"#fff" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:"92px", height:"92px", borderRadius:"28px", background:"linear-gradient(135deg,#0f172a,#e94560)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", boxShadow:"0 18px 45px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize:"40px" }}>ERP</div>
          </div>
          <div style={{ fontSize:"42px", fontWeight:"900", letterSpacing:"-.04em" }}>
            ERP<span style={{ color:"#e94560" }}>mini</span>
          </div>
          <div style={{ marginTop:"8px", color:"#cbd5e1", fontWeight:"800", fontSize:"16px" }}>
            Controle seu negócio na palma da mão
          </div>
          <div style={{ margin:"28px auto 0", width:"130px", height:"6px", borderRadius:"999px", background:"rgba(255,255,255,.15)", overflow:"hidden" }}>
            <div style={{ width:"70%", height:"100%", background:"#e94560", borderRadius:"999px" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0f172a,#1a1a2e)", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"420px", background:"#fff", borderRadius:"22px", padding:"26px", boxShadow:"0 20px 60px rgba(0,0,0,0.35)", textAlign:"center" }}>
        <div style={{ fontSize:"30px", fontWeight:"900", color:"#0f172a", marginBottom:"6px" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
        <div style={{ fontSize:"42px", margin:"14px 0" }}></div>
        <h2 style={{ margin:"0 0 10px", color:"#0f172a" }}>{info?.title || "Acesso bloqueado"}</h2>
        <p style={{ color:"#64748b", fontWeight:"700", lineHeight:1.4 }}>{info?.message || "Sua licenca nao esta liberada."}</p>
        <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"14px", padding:"12px", color:"#9a3412", fontWeight:"800", fontSize:"13px", margin:"18px 0" }}>
          Entre em contato com o suporte para regularizar o acesso.
        </div>
        <button onClick={onLogout} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"14px", background:"#0f172a", color:"#fff", fontWeight:"900", fontSize:"15px" }}>
          Sair
        </button>
      </div>
    </div>
  );
}

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password) => supabase.auth.signUp({ email, password });
  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, authLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "login") {
      const result = await signIn(cleanEmail, password);
      setBusy(false);
      if (result.error) return setMsg(result.error.message);
      return;
    }

    const result = await signUp(cleanEmail, password);

    if (result.error) {
      setBusy(false);
      return setMsg(result.error.message);
    }

    const pending = await createPendingLicenseForCurrentUser(cleanEmail);

    setBusy(false);

    if (!pending.ok) {
      setMsg("Conta criada, mas nao foi possivel criar a solicitacao de acesso. Fale com o suporte.");
      return;
    }

    setMsg("Conta criada. Agora aguarde o administrador liberar seu acesso.");
    setMode("login");
    setPassword("");
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0f172a,#1a1a2e)", padding:"20px" }}>
      <form onSubmit={submit} style={{ width:"100%", maxWidth:"380px", background:"#fff", borderRadius:"22px", padding:"26px", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ textAlign:"center", marginBottom:"18px" }}>
          <div style={{ fontSize:"30px", fontWeight:"900", color:"#0f172a" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
          <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"700" }}>Gestao Inteligente</div>
        </div>
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:"14px", padding:"5px", marginBottom:"16px" }}>
          <button type="button" onClick={()=>{setMode("login");setMsg("");}} style={{ flex:1, padding:"10px", border:"none", borderRadius:"10px", fontWeight:"900", background:mode==="login"?"#e94560":"transparent", color:mode==="login"?"#fff":"#64748b" }}>Entrar</button>
          <button type="button" onClick={()=>{setMode("signup");setMsg("");}} style={{ flex:1, padding:"10px", border:"none", borderRadius:"10px", fontWeight:"900", background:mode==="signup"?"#e94560":"transparent", color:mode==="signup"?"#fff":"#64748b" }}>Criar conta</button>
        </div>
        <label style={{ fontSize:"12px", fontWeight:"800", color:"#64748b" }}>E-mail</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seuemail@exemplo.com" style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" }} />
        <label style={{ fontSize:"12px", fontWeight:"800", color:"#64748b" }}>Senha</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Digite sua senha" style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" }} />
        {msg && <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"12px", padding:"10px", color:"#9a3412", fontWeight:"800", fontSize:"13px", marginBottom:"12px" }}>{msg}</div>}
        <button disabled={busy} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"14px", background:"#e94560", color:"#fff", fontWeight:"900", fontSize:"15px", opacity:busy?0.65:1 }}>
          {busy ? "Aguarde..." : mode==="login" ? "Entrar no ERPmini" : "Criar conta e solicitar acesso"}
        </button>
      </form>
    </div>
  );
}

function AuthGate() {
  const { user, authLoading, signOut } = useAuth();
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");
  const [licenseReady, setLicenseReady] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);

  useEffect(() => {
    let alive = true;

    async function bootAccess() {
      if (!user) {
        cloudUserId = null;
        setCloudReady(false);
        setCloudMsg("");
        setLicenseReady(false);
        setLicenseInfo(null);
        return;
      }

      setLicenseReady(false);
      setLicenseInfo(null);
      setCloudReady(false);
      setCloudMsg("Validando licenca...");

      const license = await checkLicenseByEmail(user.email);
      if (!alive) return;

      setLicenseInfo(license);
      setLicenseReady(true);

      if (!license.ok) {
        setCloudMsg("");
        setCloudReady(false);
        return;
      }

      setCloudMsg("Sincronizando nuvem...");
      const result = await downloadCloudSnapshot(user.id);

      if (!alive) return;

      setCloudMsg(result.ok ? result.message : "Sem conexao com a nuvem. Usando backup local.");
      setCloudReady(true);
    }

    bootAccess();

    return () => {
      alive = false;
    };
  }, [user]);

  const handleSignOut = async () => {
    await uploadCloudSnapshotNow();
    cloudUserId = null;
    await signOut();
  };

  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f172a", color:"#fff", fontWeight:"900" }}>
        Carregando ERPmini...
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (!licenseReady) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"12px", background:"#0f172a", color:"#fff", fontWeight:"900" }}>
        <div>ERPmini</div>
        <div style={{ fontSize:"13px", color:"#cbd5e1" }}>Validando licenca...</div>
      </div>
    );
  }

  if (!licenseInfo?.ok) {
    return <SupabaseLicenseBlockedScreen info={licenseInfo} onLogout={handleSignOut} />;
  }

  if (!cloudReady) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"12px", background:"#0f172a", color:"#fff", fontWeight:"900" }}>
        <div>ERPmini</div>
        <div style={{ fontSize:"13px", color:"#cbd5e1" }}>{cloudMsg || "Carregando dados..."}</div>
      </div>
    );
  }

  return <ERPInner onLogout={handleSignOut} cloudStatus="Nuvem sincronizada" licenseInfo={licenseInfo} user={user} />;
}



const PLAN_LIMITS = {
  starter: { products: 30, clients: 20, salesMonth: 50 },
  pro: { products: Infinity, clients: Infinity, salesMonth: Infinity },
  premium: { products: Infinity, clients: Infinity, salesMonth: Infinity },
  mensal: { products: Infinity, clients: Infinity, salesMonth: Infinity },
};


const allowedTabsForPlan = (plan, isAdmin=false) => {
  if (isAdmin) return ["inicio","pdv","estoque","cliente","caixa","fiscal","config"];
  const p = normalizePlan(plan);
  if (p === "starter") return ["inicio","pdv","estoque","cliente","config"];
  if (p === "pro") return ["inicio","pdv","estoque","cliente","caixa","config"];
  if (p === "premium") return ["inicio","pdv","estoque","cliente","caixa","fiscal","config"];
  return ["inicio","pdv","estoque","cliente","config"];
};

const hasPlanAccess = (tab, plan, isAdmin=false) => allowedTabsForPlan(plan, isAdmin).includes(String(tab || "").toLowerCase());

const normalizePlan = (plan) => {
  const p = String(plan || "starter").toLowerCase();
  if (p === "free" || p === "gratis" || p === "gratuito") return "starter";
  if (p === "mensal") return "pro";
  if (p === "starter" || p === "pro" || p === "premium") return p;
  return "starter";
};

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const countSalesThisMonth = (sales = []) => {
  const key = currentMonthKey();
  return (sales || []).filter((s) => {
    const d = String(s.date || s.createdAt || s.created_at || s.data || "");
    return d.slice(0, 7) === key;
  }).length;
};

const isLimitReached = (type, plan, counts) => {
  const p = normalizePlan(plan);
  const limits = PLAN_LIMITS[p] || PLAN_LIMITS.starter;
  if (type === "products") return counts.products >= limits.products;
  if (type === "clients") return counts.clients >= limits.clients;
  if (type === "salesMonth") return counts.salesMonth >= limits.salesMonth;
  return false;
};

const planLimitMessage = (type, plan) => {
  const p = normalizePlan(plan);
  const limits = PLAN_LIMITS[p] || PLAN_LIMITS.starter;
  if (type === "products") return `Voce atingiu o limite de ${limits.products} produtos do plano Starter.`;
  if (type === "clients") return `Voce atingiu o limite de ${limits.clients} clientes do plano Starter.`;
  if (type === "salesMonth") return `Voce atingiu o limite de ${limits.salesMonth} vendas mensais do plano Starter.`;
  return "Limite do plano atingido.";
};

function PlanUsageCard({ plan, products = [], clients = [], sales = [] }) {
  const p = normalizePlan(plan);
  const limits = PLAN_LIMITS[p] || PLAN_LIMITS.starter;
  const counts = {
    products: (products || []).length,
    clients: (clients || []).length,
    salesMonth: countSalesThisMonth(sales || []),
  };

  if (p !== "starter") {
    return (
      <div style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:"16px", padding:"14px", marginBottom:"12px" }}>
        <div style={{ fontWeight:"900", color:"#166534" }}>Plano {p.toUpperCase()}</div>
        <div style={{ color:"#166534", fontSize:"13px", fontWeight:"700" }}>Produtos, clientes e vendas liberados.</div>
      </div>
    );
  }

  const row = (label, used, max) => {
    const pct = Math.min(100, Math.round((used / max) * 100));
    const danger = pct >= 90;
    return (
      <div style={{ marginTop:"10px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"900", color:danger?"#991b1b":"#334155", fontSize:"13px" }}>
          <span>{label}</span><span>{used}/{max}</span>
        </div>
        <div style={{ height:"9px", background:"#e2e8f0", borderRadius:"999px", overflow:"hidden", marginTop:"5px" }}>
          <div style={{ width:`${pct}%`, height:"100%", background:danger?"#dc2626":"#16a34a" }} />
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


const APP_VERSION = "ERPmini-v-off1-offline-sync";

// --- localStorage helpers ----------------------------------------------------
function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (CLOUD_KEYS.includes(key)) scheduleCloudSave();
  } catch {}
}

// --- Responsive hook ---------------------------------------------------------
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}



// --- Controle de licenca por chave de ativacao ------------------------------
// Planilha de licencas: use as colunas:
// chave,empresa,status,vencimento,mensagem
//
// Exemplo:
// Floricultura 001 | Floricultura Modelo | ativo | 2026-07-13 | Licenca ativa
const LICENSE_CONFIG = {
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/1h97Y_PCsx5CyERekbrknj_Fcx6ddubxfUL1DvfMIFw0/export?format=csv&gid=0",
  WHATSAPP_RENOVACAO: "5551989004629",
};

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inside = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') inside = !inside;
    else if (ch === "," && !inside) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseLicenseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] || "" }), {});
  });
}

async function checkMonthlyLicense(activationKey) {
  const { SHEET_CSV_URL } = LICENSE_CONFIG;
  const chaveAtivacao = String(activationKey || "").trim();

  if (!chaveAtivacao) {
    return {
      active: false,
      loading: false,
      configured: true,
      needsActivation: true,
      message: "Digite sua chave de ativacao.",
    };
  }

  if (!SHEET_CSV_URL) {
    return {
      active: true,
      loading: false,
      configured: false,
      clientId: chaveAtivacao,
      empresa: chaveAtivacao,
      message: "Controle de licenca ainda nao configurado.",
    };
  }

  try {
    const res = await fetch(`${SHEET_CSV_URL}${SHEET_CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao consultar licenca");

    const rows = parseLicenseCsv(await res.text());
    const license = rows.find(r => {
      const chave = String(r.chave || r.cliente || "").toLowerCase().trim();
      return chave === chaveAtivacao.toLowerCase();
    });

    if (!license) {
      return {
        active: false,
        loading: false,
        configured: true,
        clientId: chaveAtivacao,
        empresa: chaveAtivacao,
        message: "Chave de ativacao nao encontrada.",
      };
    }

    const status = String(license.status || "").toLowerCase().trim();
    const vencimento = String(license.vencimento || "").trim();
    const empresa = String(license.empresa || license.cliente || chaveAtivacao).trim();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataVenc = new Date(`${vencimento}T23:59:59`);
    const dataValida = vencimento && !Number.isNaN(dataVenc.getTime());

    const ativo = status === "ativo" && dataValida && dataVenc >= hoje;

    const mensagemBloqueio =
      status !== "ativo"
        ? `Sua licenca esta ${status || "desativada"}. Entre em contato para renovar.`
        : !dataValida
          ? "Data de vencimento invalida. Entre em contato com o suporte."
          : dataVenc < hoje
            ? `Licenca vencida em ${vencimento}. Entre em contato para renovar.`
            : (license.mensagem || "Licenca bloqueada. Entre em contato para renovar.");

    return {
      active: ativo,
      loading: false,
      configured: true,
      needsActivation: false,
      clientId: chaveAtivacao,
      empresa,
      status,
      vencimento,
      message: ativo ? `Licenca ativa ate ${vencimento}` : mensagemBloqueio,
    };
  } catch (err) {
    return {
      active: false,
      loading: false,
      configured: true,
      clientId: chaveAtivacao,
      empresa: chaveAtivacao,
      message: "Nao foi possivel validar a licenca. Verifique a internet ou fale com o suporte.",
    };
  }
}

function LicenseBlockedScreen({ license }) {
  const whats = LICENSE_CONFIG.WHATSAPP_RENOVACAO;
  const msg = encodeURIComponent(`Ola, Pablo. Preciso renovar minha licenca do ERP Mini. Chave: ${license.clientId || "nao informada"}`);
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a1a2e,#16213e)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"28px", maxWidth:"420px", width:"100%", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize:"54px", marginBottom:"10px" }}>Bloqueado</div>
        <h2 style={{ margin:"0 0 8px", color:"#1a1a2e" }}>Sistema bloqueado</h2>
        <p style={{ color:"#64748b", fontSize:"15px", lineHeight:1.5, margin:"0 0 18px" }}>{license?.message || "Sua licenca esta vencida."}</p>
        <a href={`https://wa.me/${whats}?text=${msg}`} style={{ display:"block", background:"#16a34a", color:"#fff", textDecoration:"none", borderRadius:"12px", padding:"14px", fontWeight:"800", marginBottom:"10px" }}>
          Renovar pelo WhatsApp
        </a>
        <button onClick={()=>window.location.reload()} style={{ width:"100%", background:"#f1f5f9", border:"none", borderRadius:"12px", padding:"12px", fontWeight:"700", color:"#475569" }}>Tentar novamente</button>
      </div>
    </div>
  );
}

// --- Barcode renderer --------------------------------------------------------

function ActivationScreen({ value, onChange, onActivate, checking, error }) {
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a1a2e,#16213e)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"28px", maxWidth:"420px", width:"100%", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize:"54px", marginBottom:"10px" }}>Chave</div>
        <h2 style={{ margin:"0 0 8px", color:"#1a1a2e", fontSize:"24px" }}>Ativacao do ERP Mini</h2>
        <p style={{ color:"#64748b", margin:"0 0 18px", lineHeight:1.5 }}>
          Digite a chave de ativacao da empresa para liberar o sistema.
        </p>
        <input
          value={value}
          onChange={e=>onChange(e.target.value)}
          placeholder="Ex: Floricultura 001"
          autoFocus
          style={{ width:"100%", boxSizing:"border-box", border:"2px solid #e2e8f0", borderRadius:"12px", padding:"14px", fontSize:"18px", fontWeight:"800", textAlign:"center", marginBottom:"12px" }}
        />
        {error && <div style={{ background:"#fef2f2", color:"#dc2626", borderRadius:"10px", padding:"10px", fontSize:"13px", fontWeight:"700", marginBottom:"12px" }}>{error}</div>}
        <button
          onClick={onActivate}
          disabled={checking}
          style={{ width:"100%", background:checking?"#94a3b8":"#16a34a", color:"#fff", border:"none", borderRadius:"12px", padding:"14px", cursor:"pointer", fontWeight:"800", fontSize:"16px" }}
        >
          {checking ? "Verificando..." : "Ativar licenca"}
        </button>
        <p style={{ color:"#94a3b8", fontSize:"12px", marginTop:"14px" }}>
          A chave sera salva neste aparelho. Para trocar depois, acesse Configuracoes.
        </p>
      </div>
    </div>
  );
}


function BarcodeImage({ value }) {
  const ref = useRef();
  useEffect(() => {
    if (!value || !ref.current) return;
    const render = () => {
      if (window.JsBarcode) {
        try { window.JsBarcode(ref.current, value, { format:"CODE128", width:1.5, height:40, displayValue:true, fontSize:11, margin:4 }); } catch(_){}
      }
    };
    if (!window.JsBarcode) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js";
      s.onload = render; document.head.appendChild(s);
    } else render();
  }, [value]);
  if (!value) return null;
  return <svg ref={ref} style={{ maxWidth:"100%" }} />;
}

const genBarcode = () => String(Math.floor(1000000000000 + Math.random() * 9000000000000));

const PAYMENT_METHODS = [
  { key:"dinheiro", label:"Dinheiro", icon:"Dinheiro", color:"#16a34a", light:"#f0fdf4" },
  { key:"pix",      label:"PIX", icon:"PIX", color:"#0891b2", light:"#ecfeff" },
  { key:"debito",   label:"Cartao Debito", icon:"Cartao", color:"#7c3aed", light:"#f5f3ff" },
  { key:"credito",  label:"Cartao Credito", icon:"Cartao", color:"#2563eb", light:"#eff6ff" },
  { key:"crediario", label:"Crediário", icon:"Crediário", color:"#f59e0b", light:"#fffbeb" },
];

const initialProducts = [
  { id:1, name:"Produto A", price:25.9,  stock:50,  category:"Geral", barcode:"7891234560001" },
  { id:2, name:"Produto B", price:12.5,  stock:30,  category:"Geral", barcode:"7891234560002" },
  { id:3, name:"Produto C", price:8.0,   stock:100, category:"Geral", barcode:"7891234560003" },
];


const parseMoney = (value) => {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "")
    .replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const fmtPercent = (value) => {
  const n = Number(value || 0);
  return `${n.toFixed(1).replace(".", ",")}%`;
};

const fmtCur  = (v) => v.toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });
const fmtDate = (d) => new Date(d).toLocaleString("pt-BR",{ day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });

// --- CHECKOUT ----------------------------------------------------------------
function CheckoutScreen({ cart, total, onCancel, onConfirm, clients=[], mode="sale", receiveInfo=null }) {
  const [step, setStep]                   = useState("choose");
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amountPaid, setAmountPaid]         = useState("");
  const [mixedPayments, setMixedPayments]   = useState([]);
  const [mixedMethod, setMixedMethod]       = useState(null);
  const [mixedAmount, setMixedAmount]       = useState("");
  const [fiadoClientId, setFiadoClientId]   = useState("");
  const [fiadoDueDate, setFiadoDueDate]     = useState("");
  const [installmentClientId, setInstallmentClientId] = useState("");
  const [installmentClientName, setInstallmentClientName] = useState("");
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installmentStartOption, setInstallmentStartOption] = useState("today");
  const [installmentFirstDueDate, setInstallmentFirstDueDate] = useState("");
  const [creditInstallments, setCreditInstallments] = useState("1");

  const paidSoFar = mixedPayments.reduce((s,p) => s+p.amount, 0);
  const remaining = total - paidSoFar;
  const change    = (parseFloat(amountPaid)||0) - total;
  const mInfo     = (k) => PAYMENT_METHODS.find(m=>m.key===k);
  const isReceive = mode==="receiveFiado";
  const todayISO = () => new Date().toISOString().slice(0,10);
  const addDaysISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  };
  const isPastDate = (dateStr) => dateStr && dateStr < todayISO();

  const handleMethod = (key) => {
    setSelectedMethod(key);
    if (isReceive) { setStep("receive_amount"); setAmountPaid(total.toFixed(2)); return; }
    if (key==="dinheiro") { setStep("dinheiro"); setAmountPaid(""); }
    else if (key==="credito") { setStep("credito_cartao"); setCreditInstallments("1"); }
    else if (key==="fiado") { setStep("fiado"); setFiadoClientId(clients[0]?.id ? String(clients[0].id) : ""); setFiadoDueDate(""); }
    else if (key==="crediario") {
      setStep("parcelado");
      setInstallmentClientId(clients[0]?.id ? String(clients[0].id) : "");
      setInstallmentClientName("");
      setInstallmentCount("1");
      setInstallmentStartOption("today");
      setInstallmentFirstDueDate(todayISO());
    }
    else if (key==="misto") { setStep("mixed"); setMixedPayments([]); setMixedMethod(null); setMixedAmount(""); }
    else onConfirm({ payments:[{ method:key, amount:total }], total, change:0 });
  };

  const confirmDinheiro = () => {
    const paid = parseFloat(amountPaid)||0;
    if (paid < total) return;
    onConfirm({ payments:[{ method:"dinheiro", amount:paid }], total, change: paid-total });
  };

  const addMixed = () => {
    const amt = parseFloat(mixedAmount)||0;
    if (!mixedMethod||amt<=0||amt>remaining+0.001) return;
    const list = [...mixedPayments, { method:mixedMethod, amount:amt }];
    setMixedPayments(list);
    setMixedAmount(""); setMixedMethod(null);
    if (total - list.reduce((s,p)=>s+p.amount,0) <= 0.001) setStep("mixed_done");
  };

  const confirmMixed = () => {
    const ch = mixedPayments.find(p=>p.method==="dinheiro") ? Math.max(0,paidSoFar-total) : 0;
    onConfirm({ payments:mixedPayments, total, change:ch });
  };

  const confirmCreditCard = () => {
    const n = Math.max(1, Math.min(12, parseInt(creditInstallments,10)||1));
    onConfirm({ payments:[{ method:"credito", amount:total, installments:n }], total, change:0 });
  };

  const confirmFiado = () => {
    const client = clients.find(c=>String(c.id)===String(fiadoClientId));
    if (!client) return;
    if (isPastDate(fiadoDueDate)) return;
    onConfirm({ payments:[{ method:"fiado", amount:total }], total, change:0, fiado:{ clientId:client.id, clientName:client.name, dueDate:fiadoDueDate || "" } });
  };

  const confirmInstallments = () => {
    const n = Math.max(1, Math.min(12, parseInt(installmentCount,10)||1));
    const selectedClient = clients.find(c=>String(c.id)===String(installmentClientId));
    const clientName = (selectedClient?.name || installmentClientName || "").trim();
    if (!clientName) return;
    if (!installmentFirstDueDate || isPastDate(installmentFirstDueDate)) return;
    onConfirm({
      payments:[{ method:"crediario", amount:total, installments:n }],
      total,
      change:0,
      receivablePlan:{
        type:"crediario",
        clientId:selectedClient?.id || null,
        clientName,
        installments:n,
        firstDueDate:installmentFirstDueDate
      }
    });
  };

  const confirmReceive = () => {
    const val = parseFloat(amountPaid)||0;
    if (!selectedMethod || val<=0 || val>total+0.001) return;
    onConfirm({ payments:[{ method:selectedMethod, amount:val }], total:val, change:0, receiveAmount:val });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px 32px", width:"100%", maxWidth:"520px", maxHeight:"92vh", overflowY:"auto" }}>
        {/* Handle bar */}
        <div style={{ width:"40px", height:"4px", background:"#e2e8f0", borderRadius:"4px", margin:"0 auto 20px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <div style={{ fontWeight:"800", fontSize:"18px" }}>{isReceive ? "Receber Crediário" : "Cartao Pagamento"}</div>
          <button onClick={onCancel} style={{ background:"#f1f5f9", border:"none", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>x</button>
        </div>

        <div style={{ background:"linear-gradient(135deg,#1a1a2e,#16213e)", borderRadius:"14px", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <div>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.6)", marginBottom:"4px" }}>{isReceive ? "SALDO EM ABERTO" : "TOTAL A PAGAR"}</div>
            <div style={{ fontSize:"28px", fontWeight:"800", color:"#fff" }}>{fmtCur(total)}</div>
          </div>
          <div style={{ fontSize:"36px" }}>PDV</div>
        </div>

        {isReceive && receiveInfo && (
          <div style={{ background:"#fffbeb", border:"1.5px solid #f59e0b", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px" }}>
            <div style={{ fontWeight:"800", color:"#92400e" }}>Cliente: {receiveInfo.clientName}</div>
            <div style={{ fontSize:"12px", color:"#b45309" }}>Venda #{receiveInfo.saleId} {receiveInfo.dueDate ? `- Vence: ${receiveInfo.dueDate}` : ""}</div>
          </div>
        )}

        {step==="choose" && (
          <>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#94a3b8", textTransform:"", letterSpacing:"0.5px", marginBottom:"12px" }}>Forma de Pagamento</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
              {PAYMENT_METHODS.filter(m=>!isReceive || m.key!=="crediario").map(m=>(
                <button key={m.key} onClick={()=>handleMethod(m.key)}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"18px 10px", borderRadius:"14px", border:`2px solid ${m.color}33`, background:m.light, cursor:"pointer", gap:"6px" }}>
                  <span style={{ fontSize:"28px" }}>{m.icon}</span>
                  <span style={{ fontSize:"14px", fontWeight:"700", color:m.color }}>{m.label}</span>
                </button>
              ))}
            </div>
            {!isReceive && <button onClick={()=>handleMethod("misto")}
              style={{ width:"100%", padding:"14px", background:"#fef9ec", border:"2px solid #f59e0b33", borderRadius:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
              <span style={{ fontSize:"22px" }}>Trocar</span>
              <span style={{ fontSize:"14px", fontWeight:"700", color:"#92400e" }}>Pagamento Misto</span>
            </button>}
          </>
        )}



        {step==="credito_cartao" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ fontSize:"40px" }}>Cartao</div>
              <div style={{ fontWeight:"700", fontSize:"16px" }}>Cartao Credito</div>
              <div style={{ fontSize:"13px", color:"#64748b" }}>Venda no cartao, com ou sem parcelamento</div>
            </div>

            <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Parcelamento no cartao</label>
            <select value={creditInstallments} onChange={e=>setCreditInstallments(e.target.value)}
              style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"16px", boxSizing:"border-box", marginBottom:"12px" }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>(
                <option key={n} value={n}>{n}x de {fmtCur(total/n)}{n===1 ? " a vista" : ""}</option>
              ))}
            </select>

            <div style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
              <div style={{ fontWeight:"900", color:"#1d4ed8", marginBottom:"6px" }}>Resumo do cartao</div>
              <div style={{ fontSize:"13px", color:"#1e40af" }}>Total: {fmtCur(total)}</div>
              <div style={{ fontSize:"13px", color:"#1e40af" }}>{creditInstallments}x de {fmtCur(total/(parseInt(creditInstallments,10)||1))}</div>
              <div style={{ fontSize:"12px", color:"#64748b" }}>Entra no relatorio como Cartao Credito.</div>
            </div>

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>{setStep("choose");setSelectedMethod(null);}}
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Voltar</button>
              <button onClick={confirmCreditCard}
                style={{ flex:1, padding:"14px", background:"#2563eb", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"800", fontSize:"15px" }}>
                Confirmar cartao
              </button>
            </div>
          </>
        )}


        {step==="receive_amount" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ fontSize:"40px" }}>{mInfo(selectedMethod)?.icon}</div>
              <div style={{ fontWeight:"700", fontSize:"16px" }}>Recebimento via {mInfo(selectedMethod)?.label}</div>
              <div style={{ fontSize:"13px", color:"#64748b" }}>Informe o valor recebido</div>
            </div>
            <input type="number" placeholder="0,00" value={amountPaid} autoFocus
              onChange={e=>setAmountPaid(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&confirmReceive()}
              style={{ width:"100%", padding:"16px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"28px", fontWeight:"700", textAlign:"center", boxSizing:"border-box", outline:"none", marginBottom:"10px" }} />
            <div style={{ display:"flex", gap:"8px", marginBottom:"14px", flexWrap:"wrap" }}>
              {[total, Math.min(total,20), Math.min(total,50), Math.min(total,100)].filter((v,i,a)=>v>0 && a.indexOf(v)===i).map(v=>(
                <button key={v} onClick={()=>setAmountPaid(String(v.toFixed(2)))}
                  style={{ flex:"1 1 auto", padding:"10px", border:"none", borderRadius:"10px", background:"#f1f5f9", fontWeight:"700", color:"#475569" }}>{fmtCur(v)}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>{setStep("choose");setSelectedMethod(null);}}
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Voltar</button>
              <button onClick={confirmReceive} disabled={(parseFloat(amountPaid)||0)<=0 || (parseFloat(amountPaid)||0)>total}
                style={{ flex:1, padding:"14px", background:"#16a34a", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px", opacity:((parseFloat(amountPaid)||0)<=0 || (parseFloat(amountPaid)||0)>total)?0.4:1 }}>
                Confirmar Recebimento
              </button>
            </div>
          </>
        )}



        {step==="parcelado" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ fontSize:"40px" }}>Crediário</div>
              <div style={{ fontWeight:"700", fontSize:"16px" }}>Venda para receber depois</div>
              <div style={{ fontSize:"13px", color:"#64748b" }}>1x hoje, 1x futuro ou parcelado</div>
            </div>

            {clients.length>0 ? (
              <>
                <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Cliente cadastrado</label>
                <select value={installmentClientId} onChange={e=>setInstallmentClientId(e.target.value)}
                  style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"16px", boxSizing:"border-box", marginBottom:"12px" }}>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"12px" }}>Ou deixe um cliente selecionado acima.</div>
              </>
            ) : (
              <>
                <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Nome do cliente</label>
                <input value={installmentClientName} onChange={e=>setInstallmentClientName(e.target.value)} placeholder="Ex: Maria Silva"
                  style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"16px", boxSizing:"border-box", marginBottom:"12px" }} />
              </>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
              <div>
                <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Parcelas</label>
                <select value={installmentCount} onChange={e=>setInstallmentCount(e.target.value)}
                  style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"16px", boxSizing:"border-box" }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x de {fmtCur(total/n)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Quando receber a 1ª parcela?</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"8px" }}>
                  <button type="button" onClick={()=>{setInstallmentStartOption("today");setInstallmentFirstDueDate(todayISO());}}
                    style={{ padding:"10px", border:"none", borderRadius:"10px", background:installmentStartOption==="today"?"#16a34a":"#f1f5f9", color:installmentStartOption==="today"?"#fff":"#64748b", fontWeight:"900" }}>
                    Hoje
                  </button>
                  <button type="button" onClick={()=>{setInstallmentStartOption("30days");setInstallmentFirstDueDate(addDaysISO(30));}}
                    style={{ padding:"10px", border:"none", borderRadius:"10px", background:installmentStartOption==="30days"?"#0ea5e9":"#f1f5f9", color:installmentStartOption==="30days"?"#fff":"#64748b", fontWeight:"900" }}>
                    30 dias
                  </button>
                </div>
                <input type="date" min={todayISO()} value={installmentFirstDueDate} onChange={e=>{setInstallmentStartOption("custom");setInstallmentFirstDueDate(e.target.value);}}
                  style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"16px", boxSizing:"border-box" }} />
              </div>
            </div>

            <div style={{ background:"#f0f9ff", border:"1.5px solid #7dd3fc", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
              <div style={{ fontWeight:"900", color:"#0369a1", marginBottom:"6px" }}>Resumo do crediario</div>
              <div style={{ fontSize:"13px", color:"#075985" }}>{installmentCount} vez(es) de {fmtCur(total/(parseInt(installmentCount,10)||2))}</div>
              <div style={{ fontSize:"12px", color:"#64748b" }}>
                1ª parcela: {installmentFirstDueDate ? new Date(installmentFirstDueDate+"T00:00:00").toLocaleDateString("pt-BR") : "-"}.
                {installmentStartOption==="today" ? " Recebe hoje." : installmentStartOption==="30days" ? " Primeira em 30 dias." : " Data personalizada."}
              </div>
              <div style={{ fontSize:"12px", color:"#64748b" }}>O recebimento entrara em Caixa / Financeiro / A receber.</div>
            </div>

            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>{setStep("choose");setSelectedMethod(null);}}
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Voltar</button>
              <button onClick={confirmInstallments}
                style={{ flex:1, padding:"14px", background:"#0ea5e9", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"800", fontSize:"15px" }}>
                Confirmar crediario
              </button>
            </div>
          </>
        )}


        {step==="fiado" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ fontSize:"40px" }}></div>
              <div style={{ fontWeight:"700", fontSize:"16px" }}>Venda no Fiado</div>
              <div style={{ fontSize:"13px", color:"#64748b" }}>Selecione o cliente para vincular a divida</div>
            </div>
            {clients.length===0 ? (
              <div style={{ background:"#fff7ed", border:"1.5px solid #f59e0b", borderRadius:"12px", padding:"14px", marginBottom:"14px", color:"#92400e", fontWeight:"700" }}>
                Cadastre um cliente na aba Fiado antes de vender fiado.
              </div>
            ) : (
              <>
                <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Cliente</label>
                <select value={fiadoClientId} onChange={e=>setFiadoClientId(e.target.value)}
                  style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"16px", boxSizing:"border-box", marginBottom:"12px" }}>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label style={{ fontSize:"13px", fontWeight:"700", color:"#64748b", marginBottom:"6px", display:"block" }}>Vencimento</label>
                <input type="date" value={fiadoDueDate} min={todayISO()} onChange={e=>setFiadoDueDate(e.target.value)}
                  style={{ width:"100%", padding:"14px", border:`2px solid ${isPastDate(fiadoDueDate)?"#ef4444":"#e2e8f0"}`, borderRadius:"12px", fontSize:"16px", boxSizing:"border-box", marginBottom:isPastDate(fiadoDueDate)?"6px":"14px" }} />
                {isPastDate(fiadoDueDate) && (
                  <div style={{ background:"#fef2f2", border:"1.5px solid #ef4444", borderRadius:"10px", padding:"10px", color:"#991b1b", fontSize:"12px", fontWeight:"800", marginBottom:"14px" }}>
                    A data de vencimento nao pode ser anterior a hoje.
                  </div>
                )}
                {(() => {
                  const c = clients.find(x=>String(x.id)===String(fiadoClientId));
                  if (!c || !(parseFloat(c.limit)>0)) return null;
                  const saldoAtual = c.currentBalance || 0;
                  const limite = parseFloat(c.limit)||0;
                  const saldoFinal = saldoAtual + total;
                  const excede = saldoFinal > limite;
                  const usadoPct = Math.min(100, Math.round((saldoFinal/limite)*100));
                  const excedente = Math.max(0, saldoFinal-limite);
                  return (
                    <div style={{ background:excede?"#fff7ed":"#f0fdf4", border:`1.5px solid ${excede?"#f97316":"#22c55e"}`, borderRadius:"16px", padding:"14px", marginBottom:"14px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                        <div style={{ fontWeight:"900", color:excede?"#9a3412":"#166534", fontSize:"15px" }}>
                          {excede ? "Limite de credito excedido" : "Limite de credito OK"}
                        </div>
                        <div style={{ fontWeight:"900", color:excede?"#ea580c":"#16a34a", fontSize:"13px" }}>{Math.round((saldoFinal/limite)*100)}%</div>
                      </div>

                      <div style={{ height:"10px", background:"#e2e8f0", borderRadius:"16px", overflow:"hidden", marginBottom:"12px" }}>
                        <div style={{ height:"100%", width:`${usadoPct}%`, background:excede?"#f97316":"#22c55e", borderRadius:"16px" }} />
                      </div>

                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:excede?"10px":"0" }}>
                        <div style={{ background:"#fff", borderRadius:"10px", padding:"8px" }}>
                          <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"800" }}>Limite</div>
                          <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{fmtCur(limite)}</div>
                        </div>
                        <div style={{ background:"#fff", borderRadius:"10px", padding:"8px" }}>
                          <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"800" }}>Saldo atual</div>
                          <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{fmtCur(saldoAtual)}</div>
                        </div>
                        <div style={{ background:"#fff", borderRadius:"10px", padding:"8px" }}>
                          <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"800" }}>Nova venda</div>
                          <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{fmtCur(total)}</div>
                        </div>
                        <div style={{ background:"#fff", borderRadius:"10px", padding:"8px" }}>
                          <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"800" }}>Saldo final</div>
                          <div style={{ fontWeight:"900", color:excede?"#dc2626":"#16a34a" }}>{fmtCur(saldoFinal)}</div>
                        </div>
                      </div>

                      {excede && (
                        <div style={{ background:"#ffedd5", borderRadius:"10px", padding:"10px", color:"#9a3412", fontWeight:"800", fontSize:"13px" }}>
                          Excedente: {fmtCur(excedente)}. Para prosseguir, toque em Autorizar venda.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>{setStep("choose");setSelectedMethod(null);}}
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Voltar</button>
              {(() => {
                const c = clients.find(x=>String(x.id)===String(fiadoClientId));
                const limite = c ? (parseFloat(c.limit)||0) : 0;
                const saldoAtual = c ? (c.currentBalance || 0) : 0;
                const excede = limite>0 && (saldoAtual + total) > limite;
                return (
                  <button onClick={confirmFiado} disabled={!clients.length || !fiadoClientId || isPastDate(fiadoDueDate)}
                    style={{ flex:1, padding:"14px", background:excede?"#dc2626":"#f59e0b", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"800", fontSize:"15px", opacity:(!clients.length || !fiadoClientId || isPastDate(fiadoDueDate))?0.4:1 }}>
                    {excede ? "Autorizar venda" : "Confirmar Fiado"}
                  </button>
                );
              })()}
            </div>
          </>
        )}

        {step==="dinheiro" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ fontSize:"40px" }}>Dinheiro</div>
              <div style={{ fontWeight:"700", fontSize:"16px" }}>Pagamento em Dinheiro</div>
              <div style={{ fontSize:"13px", color:"#64748b" }}>Digite o valor recebido</div>
            </div>
            <input type="number" placeholder="0,00" value={amountPaid} autoFocus
              onChange={e=>setAmountPaid(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&confirmDinheiro()}
              style={{ width:"100%", padding:"16px", border:"2px solid #e2e8f0", borderRadius:"12px", fontSize:"28px", fontWeight:"700", textAlign:"center", boxSizing:"border-box", outline:"none", marginBottom:"10px" }} />
            <div style={{ display:"flex", gap:"8px", marginBottom:"14px", flexWrap:"wrap" }}>
              {[total, Math.ceil(total/10)*10, Math.ceil(total/50)*50, Math.ceil(total/100)*100].filter((v,i,a)=>a.indexOf(v)===i).map(v=>(
                <button key={v} onClick={()=>setAmountPaid(String(v.toFixed(2)))}
                  style={{ flex:"1 1 auto", padding:"10px 8px", background:"#f1f5f9", border:"1.5px solid #e2e8f0", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:"700" }}>
                  {fmtCur(v)}
                </button>
              ))}
            </div>
            {(parseFloat(amountPaid)||0)>=total && total>0 && (
              <div style={{ background:"#f0fdf4", border:"1.5px solid #22c55e", borderRadius:"12px", padding:"14px 16px", display:"flex", justifyContent:"space-between", marginBottom:"14px" }}>
                <span style={{ fontWeight:"700", color:"#166534" }}> Troco</span>
                <span style={{ fontWeight:"800", fontSize:"18px", color:"#16a34a" }}>{fmtCur((parseFloat(amountPaid)||0)-total)}</span>
              </div>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>{setStep("choose");setSelectedMethod(null);}}
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}> Voltar</button>
              <button onClick={confirmDinheiro} disabled={(parseFloat(amountPaid)||0)<total}
                style={{ flex:1, padding:"14px", background:"#16a34a", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px", opacity:(parseFloat(amountPaid)||0)<total?0.4:1 }}>
                OK Confirmar
              </button>
            </div>
          </>
        )}

        {(step==="mixed"||step==="mixed_done") && (
          <>
            <div style={{ fontWeight:"700", fontSize:"15px", marginBottom:"12px" }}>Trocar Pagamento Misto</div>
            {mixedPayments.map((p,i)=>{
              const m=mInfo(p.method);
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"#f8fafc", borderRadius:"8px", marginBottom:"6px", fontSize:"14px" }}>
                  <span>{m?.icon} {m?.label}</span><span style={{ fontWeight:"700" }}>{fmtCur(p.amount)}</span>
                </div>
              );
            })}
            {step==="mixed" && (
              <>
                <div style={{ background:"#fef9ec", border:"1.5px solid #f59e0b", borderRadius:"10px", padding:"12px 16px", display:"flex", justifyContent:"space-between", marginBottom:"14px" }}>
                  <span style={{ fontWeight:"700", color:"#92400e" }}>[...] Restante</span>
                  <span style={{ fontWeight:"800", fontSize:"18px", color:"#d97706" }}>{fmtCur(remaining)}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px", marginBottom:"12px" }}>
                  {PAYMENT_METHODS.filter(m=>m.key!=="crediario").map(m=>(
                    <button key={m.key} onClick={()=>setMixedMethod(m.key)}
                      style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 4px", borderRadius:"10px", border:`2px solid ${mixedMethod===m.key?m.color:m.color+"33"}`, background:mixedMethod===m.key?m.light:"#fff", cursor:"pointer", gap:"4px" }}>
                      <span style={{ fontSize:"20px" }}>{m.icon}</span>
                      <span style={{ fontSize:"10px", fontWeight:"700", color:mixedMethod===m.key?m.color:"#475569" }}>{m.label}</span>
                    </button>
                  ))}
                </div>
                <input type="number" placeholder={`Max: ${fmtCur(remaining)}`} value={mixedAmount}
                  onChange={e=>setMixedAmount(e.target.value)}
                  style={{ width:"100%", padding:"12px", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"16px", boxSizing:"border-box", marginBottom:"10px", outline:"none" }} />
                <button onClick={addMixed} disabled={!mixedMethod||(parseFloat(mixedAmount)||0)<=0}
                  style={{ width:"100%", padding:"13px", background:"#6366f1", color:"#fff", border:"none", borderRadius:"10px", cursor:"pointer", fontWeight:"700", fontSize:"15px", opacity:(!mixedMethod||(parseFloat(mixedAmount)||0)<=0)?0.4:1, marginBottom:"10px" }}>
                  + Adicionar Pagamento
                </button>
              </>
            )}
            {step==="mixed_done" && (
              <div style={{ background:"#f0fdf4", border:"1.5px solid #22c55e", borderRadius:"10px", padding:"12px", textAlign:"center", marginBottom:"12px" }}>
                <div style={{ fontWeight:"700", color:"#166534" }}>OK Valor total coberto!</div>
              </div>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={()=>{setStep("choose");setSelectedMethod(null);setMixedPayments([]);}}
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700" }}> Voltar</button>
              {step==="mixed_done" && (
                <button onClick={confirmMixed}
                  style={{ flex:1, padding:"14px", background:"#16a34a", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>
                  OK Confirmar Venda
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- RECEIPT -----------------------------------------------------------------
function ReceiptModal({ sale, storeName, currentPlan, onClose }) {
  const receiptRef = useRef();
  const mLabel = (k) => PAYMENT_METHODS.find(m=>m.key===k)?.label || k;
  const mIcon  = (k) => PAYMENT_METHODS.find(m=>m.key===k)?.icon  || "Cartao";
  const mColor = (k) => PAYMENT_METHODS.find(m=>m.key===k)?.color || "#64748b";

  const printReceipt = () => {
    const win = window.open("","_blank","width=420,height=700");
    win.document.write(`<!DOCTYPE html><html><head><title>Comprovante #${sale.id}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto;background:#fff}
      h2{text-align:center;font-size:18px;margin-bottom:2px}.sub{text-align:center;font-size:11px;color:#555;margin-bottom:10px}
      hr{border:none;border-top:1px dashed #999;margin:8px 0}.row{display:flex;justify-content:space-between;margin-bottom:3px}
      .bold{font-weight:bold}.total-row{display:flex;justify-content:space-between;font-weight:bold;font-size:16px;margin:4px 0}
      .footer{text-align:center;font-size:11px;color:#777;margin-top:10px}
    </style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    win.document.close(); win.print();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px 32px", width:"100%", maxWidth:"520px", maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ width:"40px", height:"4px", background:"#e2e8f0", borderRadius:"4px", margin:"0 auto 20px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <div style={{ fontWeight:"800", fontSize:"18px" }}>Recibo Comprovante #{sale.id}</div>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>x</button>
        </div>

        <div ref={receiptRef} style={{ background:"#fafafa", border:"", borderRadius:"12px", padding:"20px", fontFamily:"'Courier New',monospace", fontSize:"13px", lineHeight:1.7 }}>
          <div style={{ textAlign:"center", marginBottom:"8px" }}>
            <div style={{ fontWeight:"800", fontSize:"18px" }}>{storeName||"ERPmini"}</div>
            <div style={{ fontSize:"11px", color:"#777" }}>Comprovante de Pagamento</div>
          </div>
          <hr style={{ border:"none", borderTop:"", margin:"8px 0" }} />
          <div style={{ display:"flex", justifyContent:"space-between" }}><span>Pedido</span><span style={{ fontWeight:"700" }}>#{sale.id}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between" }}><span>Data</span><span>{fmtDate(sale.date)}</span></div>
          <hr style={{ border:"none", borderTop:"", margin:"8px 0" }} />
          <div style={{ fontWeight:"700", fontSize:"11px", textTransform:"", marginBottom:"4px" }}>Itens</div>
          {sale.items.map(item=>(
            <div key={item.id} style={{ marginBottom:"4px" }}>
              <div style={{ fontSize:"13px", fontWeight:"600" }}>{item.name}</div>
              <div style={{ display:"flex", justifyContent:"space-between", color:"#555", fontSize:"12px" }}>
                <span>{item.qty}x {fmtCur(item.price)}</span>
                <span style={{ fontWeight:"700", color:"#000" }}>{fmtCur(item.price*item.qty)}</span>
              </div>
            </div>
          ))}
          <hr style={{ border:"none", borderTop:"", margin:"8px 0" }} />
          <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"800", fontSize:"16px", margin:"4px 0" }}>
            <span>TOTAL</span><span>{fmtCur(sale.total)}</span>
          </div>
          <hr style={{ border:"none", borderTop:"", margin:"8px 0" }} />
          <div style={{ fontWeight:"700", fontSize:"11px", textTransform:"", marginBottom:"6px" }}>Pagamento</div>
          {sale.payments.map((p,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
              <span>{mIcon(p.method)} {mLabel(p.method)}</span>
              <span style={{ fontWeight:"700" }}>{fmtCur(p.amount)}</span>
            </div>
          ))}
          {sale.change>0 && (
            <>
              <hr style={{ border:"none", borderTop:"1px dashed #22c55e", margin:"8px 0" }} />
              <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"800", fontSize:"15px", color:"#16a34a" }}>
                <span> TROCO</span><span>{fmtCur(sale.change)}</span>
              </div>
            </>
          )}
          <hr style={{ border:"none", borderTop:"1px dashed #999", margin:"8px 0" }} />
          <div style={{ textAlign:"center", fontSize:"11px", color:"#555", fontWeight:"700" }}>Emitido por ERPmini Starter<br/>Recibo não fiscal</div>
          {normalizePlan(currentPlan) === "starter" && (
            <>
              <hr style={{ border:"none", borderTop:"1px dashed #999", margin:"8px 0" }} />
              <div style={{ textAlign:"center", fontSize:"11px", color:"#555", fontWeight:"700" }}>
                Emitido por ERPmini Starter<br/>
                Recibo não fiscal
              </div>
            </>
          )}
        </div>

        <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
          <button onClick={printReceipt} style={{ flex:1, padding:"14px", background:"#1a1a2e", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Imprimir</button>
          <button onClick={onClose} style={{ flex:1, padding:"14px", background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN --------------------------------------------------------------------
function ERPInner({ onLogout, cloudStatus, licenseInfo, user } = {}) {
  const isMobile = useIsMobile();
  const currentUserEmail = (user?.email || "").trim().toLowerCase();
  const isPlatformAdmin = currentUserEmail === "pabloradamez10@gmail.com";
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncPending, setSyncPending] = useState(() => getOfflinePending());
  const [syncingNow, setSyncingNow] = useState(false);
  const [stableSyncStatus, setStableSyncStatus] = useState(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    return "saved";
  });
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const currentPlan = normalizePlan(licenseInfo?.license?.plan || licenseInfo?.plan || "starter");
  const [tab, setTab]             = useState("");
  const [caixaView, setCaixaView] = useState("resumo");
  const [products, setProducts]   = useState(()=>loadLS("erpmini_products", initialProducts));
  const [cart, setCart]           = useState([]);
  const [sales, setSales]         = useState(()=>loadLS("erpmini_sales", []));
  const [clients, setClients]     = useState(()=>loadLS("erpmini_clients", []));
  const [cashClosures, setCashClosures] = useState(()=>loadLS("erpmini_cash_closures", []));
  const [cashOps, setCashOps] = useState(()=>loadLS("erpmini_cash_ops", []));
  const [cashOpeningValue, setCashOpeningValue] = useState("");
  const [cashRealValue, setCashRealValue] = useState("");
  const [cashOpForm, setCashOpForm] = useState({ type:"sangria", amount:"", note:"" });
  const [payables, setPayables] = useState(()=>loadLS("erpmini_payables", []));
  const [receivables, setReceivables] = useState(()=>loadLS("erpmini_receivables", []));
  const [financeiroView, setFinanceiroView] = useState("pagar");
  const [newClient, setNewClient] = useState({ name:"", phone:"", limit:"" });
  const [newPayable, setNewPayable] = useState({ supplier:"", document:"", description:"", amount:"", dueDate:"", category:"Geral" });
  const [purchaseItems, setPurchaseItems] = useState([{ productId:"", name:"", qty:"", cost:"", salePrice:"" }]);
  const [newReceivable, setNewReceivable] = useState({ clientName:"", document:"", description:"", amount:"", dueDate:"", category:"Geral", installments:"1" });
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showFiadoReceive, setShowFiadoReceive] = useState(false);
  const [selectedFiadoSale, setSelectedFiadoSale] = useState(null);
  const [showReceipt, setShowReceipt]   = useState(false);
  const [newProduct, setNewProduct]     = useState({ name:"", cost:"", price:"", stock:"", category:"Geral", barcode:"" });
  const [editingId, setEditingId]       = useState(null);
  const planCounts = { products: products.length, clients: clients.length, salesMonth: countSalesThisMonth(sales) };
  const [searchProd, setSearchProd]     = useState("");
  const [notification, setNotification] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeFlash, setBarcodeFlash] = useState(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(null);
  const [storeName, setStoreName] = useState(()=>loadLS("erpmini_storename","Minha Loja"));
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCart, setShowCart]   = useState(false);   // mobile cart drawer
  const [pdvView, setPdvView] = useState("venda");
  const [showSettings, setShowSettings] = useState(false);
  const backupImportRef = useRef();
  const adminBackupImportRef = useRef();
  const backupAutoRan = useRef(false);
  const barcodeRef  = useRef();
  const saleCounter = useRef(loadLS("erpmini_salecounter", 1000));
  const [activationKey, setActivationKey] = useState(()=>loadLS("erpmini_activation_key", ""));
  const [activationInput, setActivationInput] = useState(()=>loadLS("erpmini_activation_key", ""));
  const [activationError, setActivationError] = useState("");
  const [license, setLicense] = useState({
    loading:true,
    active:false,
    needsActivation:!loadLS("erpmini_activation_key", ""),
    message:"Verificando licenca..."
  });

  const refreshLicense = useCallback(async (key = activationKey) => {
    setLicense(prev => ({ ...prev, loading:true }));
    const result = await checkMonthlyLicense(key);
    setLicense(result);
    return result;
  }, [activationKey]);

  useEffect(()=>{
    let alive = true;
    checkMonthlyLicense(activationKey).then(result => { if (alive) setLicense(result); });
    return () => { alive = false; };
  }, [activationKey]);

  useEffect(()=>{
    let bannerTimer = null;
    let syncLock = false;

    const openBanner = () => {
      setShowSyncBanner(true);
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => setShowSyncBanner(false), 5000);
    };

    const refreshStatus = () => {
      const online = navigator.onLine;
      const pending = getOfflinePending();

      setIsOnline(online);
      setSyncPending(pending);
      setStableSyncStatus(online ? "saved" : "offline");

      if (!online) openBanner();
    };

    const handleOnline = async () => {
      refreshStatus();
      if (syncLock) return;

      if (getOfflinePending()) {
        syncLock = true;
        setSyncingNow(true);
        setStableSyncStatus("syncing");
        openBanner();

        const result = await uploadCloudSnapshotNow();

        setSyncingNow(false);
        setSyncPending(getOfflinePending());
        setStableSyncStatus(navigator.onLine ? "saved" : "offline");
        syncLock = false;

        if (result?.ok) {
          setShowSyncBanner(true);
          clearTimeout(bannerTimer);
          bannerTimer = setTimeout(() => setShowSyncBanner(false), 3500);
          notify("Dados offline sincronizados com a nuvem.");
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncPending(getOfflinePending());
      setStableSyncStatus("offline");
      openBanner();
    };

    const handleSyncState = () => {
      const pending = getOfflinePending();
      setSyncPending(pending);
      if (navigator.onLine) {
        setStableSyncStatus("saved");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("erpmini-sync-state", handleSyncState);

    refreshStatus();

    return () => {
      clearTimeout(bannerTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("erpmini-sync-state", handleSyncState);
    };
  }, []);

  useEffect(()=>{ saveLS("erpmini_products", products); }, [products]);
  useEffect(()=>{ saveLS("erpmini_sales", sales); }, [sales]);
  useEffect(()=>{ saveLS("erpmini_clients", clients); }, [clients]);
  useEffect(()=>{ saveLS("erpmini_cash_closures", cashClosures); }, [cashClosures]);
  useEffect(()=>{ saveLS("erpmini_cash_ops", cashOps); }, [cashOps]);
  useEffect(()=>{ saveLS("erpmini_payables", payables); }, [payables]);
  useEffect(()=>{ saveLS("erpmini_receivables", receivables); }, [receivables]);
  useEffect(()=>{ saveLS("erpmini_storename", storeName); }, [storeName]);
  useEffect(()=>{ saveLS("erpmini_salecounter", saleCounter.current); });

  const notify = (msg, type="success") => {
    setNotification({ msg, type });
    setTimeout(()=>setNotification(null), 2500);
  };

  const BACKUP_ADMIN_PASSWORD = "PABLO";
  const makeBackupPayload = (mode="manual") => ({
    app:"ERPmini",
    backupVersion:1,
    mode,
    appVersion:APP_VERSION,
    createdAt:new Date().toISOString(),
    storeName,
    saleCounter:saleCounter.current,
    data:{
      products,
      sales,
      clients,
      cashClosures,
      cashOps,
      payables,
      receivables,
      storeName,
      saleCounter:saleCounter.current
    }
  });

  const backupFileName = (payload) => {
    const d = new Date(payload.createdAt);
    const pad = n => String(n).padStart(2,"0");
    return `erpmini-backup-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  };

  const downloadJson = (payload) => {
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(payload);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  };

  const saveBackupSnapshot = (payload) => {
    saveLS("erpmini_backup_latest", payload);
    const history = loadLS("erpmini_backup_history", []);
    const updated = [payload, ...history].slice(0, 7);
    saveLS("erpmini_backup_history", updated);
    saveLS("erpmini_backup_last_date", dayKey());
  };

  const createBackup = (mode="manual", shouldDownload=true) => {
    const payload = makeBackupPayload(mode);
    saveBackupSnapshot(payload);
    if (shouldDownload) downloadJson(payload);
    notify(mode==="auto" ? "Backup diario gerado." : "Backup gerado com sucesso!");
    return payload;
  };

  const applyBackupPayload = (payload) => {
    if (!payload || payload.app !== "ERPmini" || !payload.data) {
      notify("Arquivo de backup invalido.", "error");
      return false;
    }
    const d = payload.data;
    setProducts(Array.isArray(d.products) ? d.products : initialProducts);
    setSales(Array.isArray(d.sales) ? d.sales : []);
    setClients(Array.isArray(d.clients) ? d.clients : []);
    setCashClosures(Array.isArray(d.cashClosures) ? d.cashClosures : []);
    setCashOps(Array.isArray(d.cashOps) ? d.cashOps : []);
    setPayables(Array.isArray(d.payables) ? d.payables : []);
    setReceivables(Array.isArray(d.receivables) ? d.receivables : []);
    setStoreName(d.storeName || payload.storeName || "Minha Loja");
    saleCounter.current = d.saleCounter || payload.saleCounter || 1000;

    saveLS("erpmini_products", Array.isArray(d.products) ? d.products : initialProducts);
    saveLS("erpmini_sales", Array.isArray(d.sales) ? d.sales : []);
    saveLS("erpmini_clients", Array.isArray(d.clients) ? d.clients : []);
    saveLS("erpmini_cash_closures", Array.isArray(d.cashClosures) ? d.cashClosures : []);
    saveLS("erpmini_cash_ops", Array.isArray(d.cashOps) ? d.cashOps : []);
    saveLS("erpmini_payables", Array.isArray(d.payables) ? d.payables : []);
    saveLS("erpmini_receivables", Array.isArray(d.receivables) ? d.receivables : []);
    saveLS("erpmini_storename", d.storeName || payload.storeName || "Minha Loja");
    saveLS("erpmini_salecounter", d.saleCounter || payload.saleCounter || 1000);
    setCart([]);
    notify("Backup restaurado com sucesso!");
    return true;
  };

  const restoreLatestBackup = () => {
    const payload = loadLS("erpmini_backup_latest", null);
    if (!payload) { notify("Nenhum backup salvo neste aparelho.", "error"); return; }
    if (!window.confirm("Restaurar o ultimo backup salvo neste aparelho? Os dados atuais serao substituidos.")) return;
    applyBackupPayload(payload);
  };

  const importBackupFile = (file, admin=false) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (admin) {
          const senha = window.prompt("Senha ADM para restaurar versao anterior:");
          if (senha !== BACKUP_ADMIN_PASSWORD) { notify("Senha ADM incorreta.", "error"); return; }
        }
        if (!window.confirm("Restaurar este backup? Os dados atuais serao substituidos.")) return;
        saveBackupSnapshot(payload);
        applyBackupPayload(payload);
      } catch(_) {
        notify("Nao foi possivel ler o arquivo de backup.", "error");
      }
    };
    reader.readAsText(file);
  };

  const restoreOldBackupFromHistory = (payload) => {
    const senha = window.prompt("Senha ADM para restaurar versao anterior:");
    if (senha !== BACKUP_ADMIN_PASSWORD) { notify("Senha ADM incorreta.", "error"); return; }
    if (!window.confirm("Restaurar esta versao anterior? Os dados atuais serao substituidos.")) return;
    applyBackupPayload(payload);
  };

  useEffect(()=>{
    if (backupAutoRan.current) return;
    backupAutoRan.current = true;
    const last = loadLS("erpmini_backup_last_date", "");
    if (last === dayKey()) return;
    const t = setTimeout(()=>createBackup("auto", true), 1800);
    return ()=>clearTimeout(t);
  }, []);

  const clearAllData = () => {
    ["erpmini_products","erpmini_sales","erpmini_clients","erpmini_cash_closures","erpmini_cash_ops","erpmini_payables","erpmini_receivables","erpmini_storename","erpmini_salecounter","erpmini_backup_latest","erpmini_backup_history","erpmini_backup_last_date"].forEach(k=>localStorage.removeItem(k));
    setProducts(initialProducts); setSales([]); setClients([]); setCashClosures([]); setCashOps([]); setPayables([]); setReceivables([]); setStoreName("Minha Loja"); setCart([]);
    saleCounter.current = 1000; setShowClearConfirm(false);
    notify("Dados resetados!");
  };

  const activateLicense = async () => {
    const key = activationInput.trim();
    if (!key) { setActivationError("Digite a chave de ativacao."); return; }

    setActivationError("");
    const result = await checkMonthlyLicense(key);

    if (result.active) {
      saveLS("erpmini_activation_key", key);
      setActivationKey(key);
      setLicense(result);
    } else {
      setActivationError(result.message || "Licenca nao liberada.");
      setLicense(result);
    }
  };

  const changeActivationKey = () => {
    localStorage.removeItem("erpmini_activation_key");
    setActivationKey("");
    setActivationInput("");
    setActivationError("");
    setLicense({
      loading:false,
      active:false,
      needsActivation:true,
      message:"Digite sua chave de ativacao."
    });
  };

  useEffect(()=>{
    const normalizedTab = tab === "" ? "inicio" : tab;
    const accessKey = normalizedTab === "fiado" ? "cliente" : normalizedTab;
    if (!hasPlanAccess(accessKey, currentPlan, isPlatformAdmin)) {
      setTab("");
    }
  }, [tab, currentPlan, isPlatformAdmin]);

  useEffect(()=>{
    const timer = setTimeout(()=>setShowSplash(false), 1200);
    return ()=>clearTimeout(timer);
  }, []);

  useEffect(()=>{
    if (tab==="pdv" && !isMobile && barcodeRef.current) barcodeRef.current.focus();
  },[tab, isMobile]);

  const addToCart = useCallback((product) => {
    if (product.stock<=0) { notify("Produto sem estoque!", "error"); return false; }
    setCart(prev=>{
      const exists = prev.find(i=>i.id===product.id);
      if (exists) {
        if (exists.qty>=product.stock) { notify("Estoque insuficiente!", "error"); return prev; }
        return prev.map(i=>i.id===product.id?{...i,qty:i.qty+1}:i);
      }
      return [...prev, {...product, qty:1}];
    });
    return true;
  },[]);

  const removeFromCart = (id) => setCart(prev=>prev.filter(i=>i.id!==id));
  const updateQty = (id, qty) => {
    const p = products.find(p=>p.id===id);
    if (qty<1) return;
    if (qty>p.stock) return notify("Estoque insuficiente!", "error");
    setCart(prev=>prev.map(i=>i.id===id?{...i,qty}:i));
  };

  const handleBarcodeScan = (code) => {
    const t = code.trim();
    if (!t) return;
    const found = products.find(p=>p.barcode===t);
    if (found) {
      const ok = addToCart(found);
      setBarcodeFlash(ok?"ok":"error");
      if (ok) notify(`OK ${found.name} adicionado!`);
    } else {
      setBarcodeFlash("error");
      notify(`Codigo nao encontrado!`,"error");
    }
    setTimeout(()=>setBarcodeFlash(null), 600);
    setBarcodeInput("");
  };

  const total = cart.reduce((s,i)=>s+i.price*i.qty, 0);
  const cartCount = cart.reduce((s,i)=>s+i.qty, 0);
  const fiadoOpenAmount = (sale) => Math.max(0, sale.total - ((sale.fiado && sale.fiado.paidAmount) || 0));
  const fiadoSales = sales.filter(s => s.fiado && !s.fiado.paid && fiadoOpenAmount(s) > 0.001);
  const fiadoTotal = fiadoSales.reduce((sum,s)=>sum+fiadoOpenAmount(s),0);
  const clientBalance = (clientId) => fiadoSales.filter(s=>String(s.fiado.clientId)===String(clientId)).reduce((sum,s)=>sum+fiadoOpenAmount(s),0);
  const clientSales = (clientId) => sales.filter(s=>s.fiado && String(s.fiado.clientId)===String(clientId));
  const clientTotalBought = (clientId) => clientSales(clientId).reduce((sum,s)=>sum+s.total,0);
  const clientTotalPaid = (clientId) => clientSales(clientId).reduce((sum,s)=>sum+((s.fiado && s.fiado.paidAmount)||0),0);

  const dayKey = (d=new Date()) => new Date(d).toISOString().slice(0,10);
  const isSameDay = (date, key=dayKey()) => String(date || "").slice(0,10) === key;
  const paymentsOfDay = (key=dayKey()) => {
    const list = [];
    receivables.forEach(r => {
      (r.payments || []).forEach(p => {
        if (isSameDay(p.date, key)) list.push({ ...p, origin:"Recebimento a receber", saleId:r.saleId || r.id, date:p.date, clientName:r.clientName || "" });
      });
    });
    sales.forEach(s => {
      if (isSameDay(s.date, key)) {
        (s.payments || []).forEach(p => {
          if (p.method !== "fiado" && p.method !== "credito_parcelado" && p.method !== "crediario") list.push({ ...p, origin:"Venda", saleId:s.id, date:s.date, clientName:s.fiado?.clientName || "" });
        });
      }
      if (s.fiado && s.fiado.payments) {
        s.fiado.payments.forEach(p => {
          if (isSameDay(p.date, key)) list.push({ ...p, origin:"Recebimento crediário", saleId:s.id, date:p.date, clientName:s.fiado.clientName || "" });
        });
      }
    });
    return list;
  };
  const paymentSummary = (key=dayKey()) => {
    const base = { dinheiro:0, pix:0, debito:0, credito:0 };
    paymentsOfDay(key).forEach(p => { base[p.method] = (base[p.method] || 0) + (parseFloat(p.amount)||0); });
    return base;
  };
  const cashOpsOfDay = (key=dayKey()) => cashOps.filter(o=>isSameDay(o.date,key));
  const cashClosuresOfDay = (key=dayKey()) => cashClosures.filter(c=>c.day===key).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const lastCashClosureOfDay = (key=dayKey()) => cashClosuresOfDay(key)[0] || null;
  const cashOpeningOfDay = (key=dayKey()) => {
    const lastClose = lastCashClosureOfDay(key);
    return cashOpsOfDay(key)
      .filter(o=>o.type==="abertura" && (!lastClose || new Date(o.date) > new Date(lastClose.date)))
      .sort((a,b)=>new Date(b.date)-new Date(a.date))[0] || null;
  };
  const isCashOpenNow = () => !!cashOpeningOfDay(dayKey());
  const paymentsOfPeriod = (startIso, endIso=new Date().toISOString()) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return paymentsOfDay(dayKey()).filter(p=>{
      const d = new Date(p.date);
      return d >= start && d <= end;
    });
  };
  const paymentSummaryPeriod = (startIso, endIso=new Date().toISOString()) => {
    const base = { dinheiro:0, pix:0, debito:0, credito:0 };
    paymentsOfPeriod(startIso, endIso).forEach(p => { base[p.method] = (base[p.method] || 0) + (parseFloat(p.amount)||0); });
    return base;
  };
  const cashOpsTotals = (key=dayKey(), startIso=null, endIso=new Date().toISOString()) => {
    let ops = cashOpsOfDay(key);
    if (startIso) {
      const start = new Date(startIso);
      const end = new Date(endIso);
      ops = ops.filter(o=>{
        const d = new Date(o.date);
        return d >= start && d <= end;
      });
    }
    return {
      abertura: ops.filter(o=>o.type==="abertura").reduce((s,o)=>s+(parseFloat(o.amount)||0),0),
      reforco: ops.filter(o=>o.type==="reforco").reduce((s,o)=>s+(parseFloat(o.amount)||0),0),
      sangria: ops.filter(o=>o.type==="sangria").reduce((s,o)=>s+(parseFloat(o.amount)||0),0),
      ops
    };
  };
  const expectedCashBalance = (key=dayKey()) => {
    const opening = cashOpeningOfDay(key);
    if (!opening) return 0;
    const byMethod = paymentSummaryPeriod(opening.date);
    const ops = cashOpsTotals(key, opening.date);
    return ops.abertura + (parseFloat(byMethod.dinheiro)||0) + ops.reforco - ops.sangria;
  };
  const openCash = () => {
    const value = parseMoney(cashOpeningValue);
    if (cashOpeningOfDay()) { notify("Ja existe um caixa aberto. Feche antes de abrir outro turno.", "error"); return; }
    if (value < 0) { notify("Valor de abertura invalido.", "error"); return; }
    const turno = cashClosuresOfDay().length + 1;
    setCashOps(prev=>[{ id:Date.now(), type:"abertura", amount:value, note:`Abertura de caixa - turno ${turno}`, date:new Date().toISOString() }, ...prev]);
    setCashOpeningValue("");
    notify(`Caixa aberto para o turno ${turno}!`);
  };
  const addCashOperation = () => {
    const amount = parseMoney(cashOpForm.amount);
    if (!cashOpeningOfDay()) { notify("Abra o caixa antes de registrar movimentacoes.", "error"); return; }
    if (amount<=0) { notify("Informe um valor valido.", "error"); return; }
    setCashOps(prev=>[{ id:Date.now(), type:cashOpForm.type, amount, note:cashOpForm.note || (cashOpForm.type==="sangria"?"Sangria":"Reforco"), date:new Date().toISOString() }, ...prev]);
    setCashOpForm({ type:"sangria", amount:"", note:"" });
    notify(cashOpForm.type==="sangria" ? "Sangria registrada!" : "Reforco registrado!");
  };
  const closeCash = () => {
    const key = dayKey();
    const opening = cashOpeningOfDay(key);
    if (!opening) { notify("Abra o caixa antes de fechar.", "error"); return; }
    const byMethod = paymentSummaryPeriod(opening.date);
    const entradas = Object.values(byMethod).reduce((a,b)=>a+b,0);
    const vendasPeriodo = sales.filter(s=>{
      const d = new Date(s.date);
      return isSameDay(s.date,key) && d >= new Date(opening.date);
    });
    const vendasHoje = vendasPeriodo.reduce((sum,s)=>sum+s.total,0);
    const fiadoHoje = vendasPeriodo.filter(s=>s.fiado).reduce((sum,s)=>sum+s.total,0);
    const ops = cashOpsTotals(key, opening.date);
    const expected = expectedCashBalance(key);
    const real = cashRealValue === "" ? expected : parseMoney(cashRealValue);
    const difference = real - expected;
    const turno = cashClosuresOfDay(key).length + 1;
    const closure = {
      id:Date.now(),
      date:new Date().toISOString(),
      day:key,
      turno,
      openingId:opening.id,
      openingDate:opening.date,
      byMethod,
      entradas,
      vendasHoje,
      fiadoHoje,
      fiadoAberto:fiadoTotal,
      salesCount:vendasPeriodo.length,
      abertura:ops.abertura,
      reforco:ops.reforco,
      sangria:ops.sangria,
      saldoEsperado:expected,
      saldoInformado:real,
      diferenca:difference,
      status:Math.abs(difference)<0.01 ? "OK" : "DIFERENCA"
    };
    setCashClosures(prev=>[closure,...prev]);
    setCashRealValue("");
    notify(Math.abs(difference)<0.01 ? `Turno ${turno} fechado com sucesso!` : `Turno ${turno} fechado com diferenca.`);
  };

  const monthKey = (d=new Date()) => new Date(d).toISOString().slice(0,7);
  const isSameMonth = (date, key=monthKey()) => String(date || "").slice(0,7) === key;
  const startOfWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  };
  const isThisWeek = (date) => {
    const d = new Date(date);
    const start = startOfWeek();
    const end = new Date(start);
    end.setDate(start.getDate()+7);
    return d >= start && d < end;
  };
  const salesOfToday = sales.filter(s=>isSameDay(s.date));
  const salesOfMonth = sales.filter(s=>isSameMonth(s.date));
  const salesTodayTotal = salesOfToday.reduce((sum,s)=>sum+s.total,0);
  const salesMonthTotal = salesOfMonth.reduce((sum,s)=>sum+s.total,0);
  const saleCostTotal = (sale) => (sale.items || []).reduce((sum,it)=>sum+((parseFloat(it.cost || it.lastCost || 0)||0)*(parseFloat(it.qty)||0)),0);
  const profitTodayTotal = salesOfToday.reduce((sum,s)=>sum+(s.total - saleCostTotal(s)),0);
  const profitMonthTotal = salesOfMonth.reduce((sum,s)=>sum+(s.total - saleCostTotal(s)),0);
  const marginMonthPercent = salesMonthTotal ? (profitMonthTotal / salesMonthTotal) * 100 : 0;
  const ticketToday = salesOfToday.length ? salesTodayTotal/salesOfToday.length : 0;
  const overdueFiado = fiadoSales.filter(s=>s.fiado?.dueDate && s.fiado.dueDate < dayKey());
  const lowStockProducts = products.filter(p=>(parseFloat(p.stock)||0) <= 5);
  const topClients = clients.map(c=>({
    ...c,
    totalBought: clientTotalBought(c.id),
    openBalance: clientBalance(c.id)
  })).filter(c=>c.totalBought>0 || c.openBalance>0).sort((a,b)=>b.totalBought-a.totalBought).slice(0,5);
  const productRanking = products.map(p=>{
    const sold = sales.reduce((sum,s)=>sum+((s.items||[]).find(i=>i.id===p.id)?.qty||0),0);
    const total = sales.reduce((sum,s)=>{
      const it = (s.items||[]).find(i=>i.id===p.id);
      return sum + (it ? (it.price*it.qty) : 0);
    },0);
    return {...p, sold, total};
  }).filter(p=>p.sold>0).sort((a,b)=>b.sold-a.sold).slice(0,5);

  const parseMoney = (v) => parseFloat(String(v||"").replace(",",".")) || 0;
  const openPayables = payables.filter(p=>!p.paid);
  const paidPayables = payables.filter(p=>p.paid);
  const payableAmount = (p) => parseFloat(p.amount)||0;
  const payablesDueToday = openPayables.filter(p=>p.dueDate === dayKey());
  const payablesOverdue = openPayables.filter(p=>p.dueDate && p.dueDate < dayKey());
  const payablesNext7 = openPayables.filter(p=>{
    if (!p.dueDate) return false;
    const d = new Date(p.dueDate + "T00:00:00");
    const start = new Date(dayKey() + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate()+7);
    return d >= start && d <= end;
  });
  const payablesOpenTotal = openPayables.reduce((sum,p)=>sum+payableAmount(p),0);
  const payablesDueTodayTotal = payablesDueToday.reduce((sum,p)=>sum+payableAmount(p),0);
  const payablesOverdueTotal = payablesOverdue.reduce((sum,p)=>sum+payableAmount(p),0);
  const payablesMonthTotal = payables.filter(p=>isSameMonth(p.dueDate)).reduce((sum,p)=>sum+payableAmount(p),0);
  const payablesPaidMonthTotal = paidPayables.filter(p=>isSameMonth(p.paidDate || p.dueDate)).reduce((sum,p)=>sum+payableAmount(p),0);
  const receivableAmount = (r) => parseFloat(r.amount)||0;
  const receivablePaid = (r) => parseFloat(r.paidAmount)||0;
  const receivableOpenAmount = (r) => Math.max(0, receivableAmount(r)-receivablePaid(r));
  const openReceivables = receivables.filter(r=>!r.paid && receivableOpenAmount(r)>0);
  const paidReceivables = receivables.filter(r=>r.paid);
  const receivablesDueToday = openReceivables.filter(r=>r.dueDate === dayKey());
  const receivablesOverdue = openReceivables.filter(r=>r.dueDate && r.dueDate < dayKey());
  const receivablesNext7 = openReceivables.filter(r=>{
    if (!r.dueDate) return false;
    const d = new Date(r.dueDate + "T00:00:00");
    const start = new Date(dayKey() + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate()+7);
    return d >= start && d <= end;
  });
  const receivablesNext30 = openReceivables.filter(r=>{
    if (!r.dueDate) return false;
    const d = new Date(r.dueDate + "T00:00:00");
    const start = new Date(dayKey() + "T00:00:00");
    const end = new Date(start); end.setDate(start.getDate()+30);
    return d >= start && d <= end;
  });
  const receivablesOpenTotal = openReceivables.reduce((sum,r)=>sum+receivableOpenAmount(r),0);
  const receivablesDueTodayTotal = receivablesDueToday.reduce((sum,r)=>sum+receivableOpenAmount(r),0);
  const receivablesOverdueTotal = receivablesOverdue.reduce((sum,r)=>sum+receivableOpenAmount(r),0);
  const receivablesNext30Total = receivablesNext30.reduce((sum,r)=>sum+receivableOpenAmount(r),0);
  const receivablesMonthTotal = receivables.filter(r=>isSameMonth(r.dueDate)).reduce((sum,r)=>sum+receivableOpenAmount(r),0);
  const expectedMonthBalance = salesMonthTotal + receivablesMonthTotal - payablesMonthTotal;
  const cashFlow30 = receivablesNext30Total - payablesNext7.reduce((sum,p)=>sum+payableAmount(p),0);

  const addMonthsISO = (dateStr, months) => {
    const d = new Date((dateStr || dayKey()) + "T00:00:00");
    d.setMonth(d.getMonth()+months);
    return d.toISOString().slice(0,10);
  };

  const createReceivableInstallments = ({ clientName, clientId=null, document="", description="", amount, dueDate, category="Geral", installments=1, saleId=null, source="manual" }) => {
    const totalAmount = parseMoney(amount);
    const n = Math.max(1, Math.min(12, parseInt(installments,10)||1));
    if (!clientName || totalAmount<=0 || !dueDate || dueDate < dayKey()) {
      notify("Informe cliente, valor e vencimento valido.", "error");
      return [];
    }
    const base = Math.floor((totalAmount/n)*100)/100;
    let created = [];
    let remainingCents = Math.round(totalAmount*100);
    for (let i=1;i<=n;i++) {
      const cents = i===n ? remainingCents : Math.round(base*100);
      remainingCents -= cents;
      created.push({
        id: Date.now()+i+Math.floor(Math.random()*1000),
        saleId,
        clientId,
        clientName:String(clientName).trim(),
        document:String(document||"").trim(),
        description:String(description||"").trim(),
        amount:cents/100,
        paidAmount:0,
        paid:false,
        dueDate:addMonthsISO(dueDate, i-1),
        category:category || "Geral",
        installmentNumber:i,
        totalInstallments:n,
        source,
        payments:[],
        createdAt:new Date().toISOString()
      });
    }
    setReceivables(prev=>[...created,...prev]);
    return created;
  };

  const addReceivable = () => {
    const created = createReceivableInstallments({
      clientName:newReceivable.clientName,
      document:newReceivable.document,
      description:newReceivable.description,
      amount:newReceivable.amount,
      dueDate:newReceivable.dueDate,
      category:newReceivable.category,
      installments:newReceivable.installments,
      source:"manual"
    });
    if (created.length) {
      setNewReceivable({ clientName:"", document:"", description:"", amount:"", dueDate:"", category:"Geral", installments:"1" });
      notify("Conta a receber cadastrada!");
    }
  };

  const receiveReceivable = (id) => {
    const rec = receivables.find(r=>r.id===id);
    if (!rec) return;
    setSelectedReceivable(rec);
  };

  const handleReceivableReceiveConfirm = ({ payments, total:t }) => {
    if (!selectedReceivable) return;
    const rec = selectedReceivable;
    const val = Math.min(receivableOpenAmount(rec), parseFloat(t)||0);
    if (val<=0) return notify("Valor invalido.", "error");
    setReceivables(prev=>prev.map(r=>{
      if (r.id!==rec.id) return r;
      const paidAmount = (parseFloat(r.paidAmount)||0) + val;
      const paid = paidAmount >= receivableAmount(r)-0.001;
      return {...r, paidAmount, paid, paidDate:paid?new Date().toISOString():r.paidDate, payments:[...(r.payments||[]), ...payments.map(p=>({ ...p, date:new Date().toISOString() }))]};
    }));
    setSelectedReceivable(null);
    notify("Recebimento registrado!");
  };

  const deleteReceivable = (id) => {
    const rec = receivables.find(r=>r.id===id);
    if (!rec) return;
    const ok = window.confirm(`Excluir conta a receber de ${rec.clientName}?\\nDocumento: ${rec.document || "-"}\\nValor em aberto: ${fmtCur(receivableOpenAmount(rec))}`);
    if (ok) setReceivables(prev=>prev.filter(r=>r.id!==id));
  };


  const cleanPurchaseItems = () => {
    if (!String(newPayable.document||"").trim()) return [];
    return purchaseItems
    .map(it=>({
      productId: it.productId,
      name: String(it.name||"").trim(),
      qty: parseFloat(String(it.qty||"").replace(",",".")) || 0,
      cost: parseMoney(it.cost),
      salePrice: parseMoney(it.salePrice)
    }))
    .filter(it=>it.name && it.qty>0);
  };

  const purchaseItemsTotal = () => cleanPurchaseItems().reduce((sum,it)=>sum+(it.qty*it.cost),0);

  const addPurchaseItemRow = () => setPurchaseItems(prev=>[...prev,{ productId:"", name:"", qty:"", cost:"", salePrice:"" }]);
  const removePurchaseItemRow = (idx) => setPurchaseItems(prev=>prev.length<=1 ? [{ productId:"", name:"", qty:"", cost:"", salePrice:"" }] : prev.filter((_,i)=>i!==idx));
  const updatePurchaseItem = (idx, patch) => setPurchaseItems(prev=>prev.map((it,i)=>i===idx ? {...it,...patch} : it));

  const addPayable = () => {
    const items = cleanPurchaseItems();
    const calculatedTotal = purchaseItemsTotal();
    const informedAmount = parseMoney(newPayable.amount);

    if (!newPayable.supplier.trim() || informedAmount<=0 || !newPayable.dueDate) {
      notify("Informe fornecedor, valor da nota e vencimento.", "error");
      return;
    }

    if (items.length > 0) {
      const invalidItem = items.find(it => !it.name || it.qty <= 0 || it.cost <= 0 || it.salePrice <= 0);
      if (invalidItem) {
        notify("Cada item precisa ter nome, quantidade, custo e preco de venda.", "error");
        return;
      }

      if (Math.abs(informedAmount - calculatedTotal) > 0.01) {
        notify(`Valor da nota (${fmtCur(informedAmount)}) nao fecha com os itens (${fmtCur(calculatedTotal)}).`, "error");
        return;
      }
    }

    const item = {
      id: Date.now(),
      supplier: newPayable.supplier.trim(),
      document: newPayable.document.trim(),
      description: newPayable.description.trim(),
      amount: informedAmount,
      dueDate: newPayable.dueDate,
      category: newPayable.category.trim() || "Geral",
      purchaseItems: items,
      stockMoved: items.length>0,
      paid:false,
      createdAt:new Date().toISOString()
    };

    if (items.length>0) {
      setProducts(prev=>{
        let updated = [...prev];
        items.forEach((it,idx)=>{
          const existingIndex = updated.findIndex(p=>String(p.id)===String(it.productId) || String(p.name||"").toLowerCase()===it.name.toLowerCase());
          if (existingIndex>=0) {
            updated[existingIndex] = {
              ...updated[existingIndex],
              stock:(parseFloat(updated[existingIndex].stock)||0)+it.qty,
              cost: it.cost,
              lastCost: it.cost,
              price: it.salePrice
            };
          } else {
            updated.push({
              id: Date.now()+idx+1,
              name: it.name,
              price: it.salePrice,
              cost: it.cost,
              lastCost: it.cost,
              stock: it.qty,
              category: newPayable.category.trim() || "Geral",
              barcode: genBarcode()
            });
          }
        });
        return updated;
      });
    }

    setPayables(prev=>[item,...prev]);
    setNewPayable({ supplier:"", document:"", description:"", amount:"", dueDate:"", category:"Geral" });
    setPurchaseItems([{ productId:"", name:"", qty:"", cost:"", salePrice:"" }]);
    notify(items.length>0 ? "Compra cadastrada, nota conferida e estoque atualizado!" : "Conta a pagar cadastrada!");
  };
  const markPayablePaid = (id) => {
    setPayables(prev=>prev.map(p=>p.id===id ? {...p, paid:true, paidDate:new Date().toISOString()} : p));
    notify("Conta marcada como paga!");
  };
  const reopenPayable = (id) => setPayables(prev=>prev.map(p=>p.id===id ? {...p, paid:false, paidDate:null} : p));
  const deletePayable = (id) => {
    if (window.confirm("Excluir esta conta a pagar?")) setPayables(prev=>prev.filter(p=>p.id!==id));
  };

  const handleCheckoutConfirm = ({ payments, total:t, change, fiado, receivablePlan }) => {
    if (isLimitReached("salesMonth", currentPlan, planCounts)) return notify(planLimitMessage("salesMonth", currentPlan), "error");

    const saleId = ++saleCounter.current;

    const saleFiado = fiado
      ? { ...fiado, paid:false, type:"fiado", paidAmount:0, payments:[] }
      : receivablePlan
        ? {
            clientId: receivablePlan.clientId,
            clientName: receivablePlan.clientName,
            dueDate: receivablePlan.firstDueDate || "",
            installments: receivablePlan.installments || 1,
            paid:false,
            paidAmount:0,
            payments:[],
            type:"crediario"
          }
        : null;

    const sale = { id:saleId, date:new Date().toISOString(), items:[...cart], total:t, payments, change, fiado: saleFiado, receivablePlan:receivablePlan || null };
    setProducts(prev=>prev.map(p=>{ const item=cart.find(i=>i.id===p.id); return item?{...p,stock:p.stock-item.qty}:p; }));
    if (receivablePlan) {
      createReceivableInstallments({
        clientName:receivablePlan.clientName,
        clientId:receivablePlan.clientId,
        document:`Venda #${sale.id}`,
        description:"Crediário",
        amount:t,
        dueDate:receivablePlan.firstDueDate,
        category:"Crediário",
        installments:receivablePlan.installments,
        saleId:sale.id,
        source:"crediario"
      });
    }
    setSales(prev=>[sale,...prev]);
    setSelectedSale(sale);
    setCart([]); setShowCheckout(false); setShowCart(false); setShowReceipt(true);
    notify("OK Venda finalizada!");
  };

  const saveClient = () => {
    if (!newClient.name) return notify("Informe o nome do cliente!","error");
    if (isLimitReached("clients", currentPlan, planCounts)) return notify(planLimitMessage("clients", currentPlan), "error");
    const client = { id:Date.now(), name:newClient.name.trim(), phone:newClient.phone.trim(), limit:parseFloat(newClient.limit)||0, active:true };
    setClients(prev=>[client,...prev]);
    setNewClient({ name:"", phone:"", limit:"" });
    notify("Cliente cadastrado!");
  };

  const deleteClient = (id) => {
    if (clientBalance(id)>0) return notify("Cliente possui saldo em aberto!","error");
    setClients(prev=>prev.filter(c=>c.id!==id));
  };

  const openReceiveFiado = (saleId) => {
    const sale = sales.find(s=>s.id===saleId);
    if (!sale || !sale.fiado) return;
    setSelectedFiadoSale(sale);
    setShowFiadoReceive(true);
  };

  const handleFiadoReceiveConfirm = ({ payments, receiveAmount }) => {
    const sale = selectedFiadoSale;
    if (!sale || !sale.fiado) return;
    const aberto = fiadoOpenAmount(sale);
    const valor = receiveAmount || (payments && payments[0] && payments[0].amount) || 0;
    if (!valor || valor <= 0 || valor > aberto + 0.001) return notify("Valor invalido!","error");
    const method = payments && payments[0] ? payments[0].method : "recebimento";
    setSales(prev=>prev.map(s=>{
      if (s.id!==sale.id) return s;
      const pagos = [...((s.fiado && s.fiado.payments) || []), { date:new Date().toISOString(), amount:valor, method }];
      const paidAmount = ((s.fiado && s.fiado.paidAmount) || 0) + valor;
      const paid = paidAmount >= s.total - 0.001;
      return {...s, fiado:{...s.fiado, payments:pagos, paidAmount, paid}};
    }));
    setShowFiadoReceive(false);
    setSelectedFiadoSale(null);
    notify(valor >= aberto - 0.001 ? "Fiado quitado!" : "Pagamento registrado!");
  };

  const cobrarWhatsApp = (client) => {
    const saldo = clientBalance(client.id);
    if (saldo <= 0) return notify("Cliente sem saldo em aberto!");
    const phone = (client.phone || "").replace(/\D/g,"");
    if (!phone) return notify("Cliente sem WhatsApp cadastrado!","error");
    const msg = `Ola ${client.name}, tudo bem? Consta em aberto o valor de ${fmtCur(saldo)} na ${storeName}. Quando puder, por gentileza regularizar. Obrigado.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const saveProduct = () => {
    if (!newProduct.name||!newProduct.price||!newProduct.stock) return notify("Preencha todos os campos!","error");
    if (!editingId && isLimitReached("products", currentPlan, planCounts)) return notify(planLimitMessage("products", currentPlan), "error");
    const barcode = newProduct.barcode || genBarcode();
    if (!editingId && products.find(p=>p.barcode===barcode)) return notify("Codigo de barras ja cadastrado!","error");
    if (editingId) {
      setProducts(prev=>prev.map(p=>p.id===editingId?{...p,...newProduct,barcode,price:parseMoney(newProduct.price),cost:parseMoney(newProduct.cost),stock:parseInt(newProduct.stock)||0}:p));
      setEditingId(null); notify("Produto atualizado!");
    } else {
      setProducts(prev=>[...prev,{id:Date.now(),...newProduct,barcode,price:parseMoney(newProduct.price),cost:parseMoney(newProduct.cost),stock:parseInt(newProduct.stock)||0}]);
      notify("Produto cadastrado!");
    }
    setNewProduct({name:"",cost:"",price:"",stock:"",category:"Geral",barcode:""});
  };

  const editProduct = (p) => { setNewProduct({name:p.name,cost:p.cost||p.lastCost||"",price:p.price,stock:p.stock,category:p.category,barcode:p.barcode}); setEditingId(p.id); setTab("estoque"); };
  const deleteProduct = (id) => { setProducts(prev=>prev.filter(p=>p.id!==id)); notify("Produto removido!"); };
  const filteredProducts = products.filter(p=>p.name.toLowerCase().includes(searchProd.toLowerCase())||(p.barcode&&p.barcode.includes(searchProd)));
  const totalSales = sales.reduce((s,v)=>s+v.total,0);
  const mIcon  = (k) => PAYMENT_METHODS.find(m=>m.key===k)?.icon  ||"Cartao";
  const mLabel = (k) => PAYMENT_METHODS.find(m=>m.key===k)?.label ||k;
  const mColor = (k) => PAYMENT_METHODS.find(m=>m.key===k)?.color ||"#64748b";

  const safeText = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  const printProductLabels = (product) => {
    if (!product?.barcode) {
      notify("Produto sem codigo de barras!", "error");
      return;
    }

    const qtyText = window.prompt("Quantas etiquetas deseja imprimir?", "1");
    if (qtyText === null) return;

    const qty = Math.max(1, Math.min(100, parseInt(qtyText, 10) || 1));
    const labels = Array.from({ length: qty }, (_, i) => `
      <div class="label">
        <div class="name">${safeText(product.name)}</div>
        <div class="price">${safeText(fmtCur(product.price))}</div>
        <svg class="barcode" data-code="${safeText(product.barcode)}"></svg>
        <div class="code">${safeText(product.barcode)}</div>
      </div>
    `).join("");

    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) {
      notify("Permita pop-ups para imprimir etiquetas.", "error");
      return;
    }

    win.document.write(`<!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas - ${safeText(product.name)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 8px; background: #fff; font-family: Arial, sans-serif; }
          .sheet { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
          .label {
            width: 58mm;
            min-height: 35mm;
            border: 1px dashed #999;
            padding: 5px 6px;
            text-align: center;
            page-break-inside: avoid;
            overflow: hidden;
          }
          .name { font-size: 12px; font-weight: 700; line-height: 1.15; height: 28px; overflow: hidden; text-transform: uppercase; }
          .price { font-size: 18px; font-weight: 800; margin: 2px 0 1px; }
          .barcode { width: 100%; max-width: 190px; height: 42px; }
          .code { font-family: monospace; font-size: 10px; margin-top: 1px; }
          @media print {
            body { padding: 0; }
            .label { border: none; }
          }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <div class="sheet">${labels}</div>
        <script>
          window.onload = function () {
            document.querySelectorAll('.barcode').forEach(function(el) {
              JsBarcode(el, el.getAttribute('data-code'), {
                format: 'CODE128', width: 1.4, height: 36, displayValue: false, margin: 0
              });
            });
            setTimeout(function(){ window.print(); }, 500);
          };
        </script>
      </body>
      </html>`);
    win.document.close();
  };

  // --- Styles ----------------------------------------------------------------
  const inp = { width:"100%", padding:"10px 12px", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"15px", boxSizing:"border-box", outline:"none" };
  const btn = (c) => ({ background:c||"#e94560", color:"#fff", border:"none", borderRadius:"10px", padding:"12px 18px", cursor:"pointer", fontWeight:"700", fontSize:"15px" });
  const btnSm = (c) => ({ background:c||"#64748b", color:"#fff", border:"none", borderRadius:"8px", padding:"7px 10px", cursor:"pointer", fontSize:"12px", fontWeight:"700", minWidth:"64px" });
  const tag = (c) => ({ background:c, color:"#fff", borderRadius:"20px", padding:"3px 10px", fontSize:"11px", display:"inline-block" });
  const card = { background:"#fff", borderRadius:"14px", padding:"16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", marginBottom:"14px" };

  const NAV_ITEMS_ALL = [
    { key:"", icon:"home", label:"Início"  },
    { key:"pdv",     icon:"cart", label:"PDV"     },
    { key:"estoque", icon:"box", label:"Estoque" },
    { key:"fiado",   icon:"users", label:"Cliente" },
    { key:"caixa",   icon:"cash", label:"Caixa"   },
    { key:"fiscal",  icon:"doc", label:"Fiscal" },
    { key:"config",  icon:"gear", label:"Config"  },
  ];

  const NAV_ITEMS = NAV_ITEMS_ALL.filter(({ key }) => {
    const normalizedKey = key === "" ? "inicio" : key;
    return hasPlanAccess(normalizedKey === "fiado" ? "cliente" : normalizedKey, currentPlan, isPlatformAdmin);
  });

  const NavIcon = ({ name, active }) => {
    const stroke = active ? "#e94560" : "#64748b";
    const common = {
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke,
      strokeWidth: 2.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { display:"block" }
    };

    if (name === "home") return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
    if (name === "cart") return <svg {...common}><path d="M4 5h2l2.1 10.2a2 2 0 0 0 2 1.6h6.8a2 2 0 0 0 2-1.6L20 8H7"/><circle cx="10" cy="20" r="1" fill={stroke}/><circle cx="17" cy="20" r="1" fill={stroke}/></svg>;
    if (name === "box") return <svg {...common}><path d="M21 8.5 12 3 3 8.5l9 5.5 9-5.5Z"/><path d="M3 8.5V16l9 5 9-5V8.5"/><path d="M12 14v7"/></svg>;
    if (name === "chart") return <svg {...common}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>;
    if (name === "cash") return <svg {...common}><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M7 7V5h10v2"/><path d="M7 13h4"/><path d="M16.5 13h.01"/><path d="M7 17h10"/></svg>;
    if (name === "users") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 20a4.5 4.5 0 0 1 6 0"/></svg>;
    if (name === "history") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>;
    if (name === "doc") return <svg {...common}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9.5 12h6"/><path d="M9.5 16h6"/></svg>;
    return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-3v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-3h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v3h-.2a1.7 1.7 0 0 0-1.4 1Z"/></svg>;
  };

  // --- Cart Drawer (mobile) -------------------------------------------------
  const CartDrawer = () => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:150, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowCart(false)}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"20px 16px 32px", width:"100%", maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:"40px", height:"4px", background:"#e2e8f0", borderRadius:"4px", margin:"0 auto 16px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <div style={{ fontWeight:"800", fontSize:"17px" }}> PDV Carrinho ({cartCount})</div>
          <button onClick={()=>setShowCart(false)} style={{ background:"#f1f5f9", border:"none", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer" }}>x</button>
        </div>
        {cart.length===0
          ? <p style={{ textAlign:"center", color:"#94a3b8", padding:"24px 0" }}>Carrinho vazio</p>
          : cart.map(item=>(
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:"700", fontSize:"14px" }}>{item.name}</div>
                <div style={{ color:"#e94560", fontSize:"13px" }}>{fmtCur(item.price)} x {item.qty}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <button style={btnSm("#64748b")} onClick={()=>updateQty(item.id,item.qty-1)}>-</button>
                <span style={{ minWidth:"22px", textAlign:"center", fontWeight:"700" }}>{item.qty}</span>
                <button style={btnSm("#64748b")} onClick={()=>updateQty(item.id,item.qty+1)}>+</button>
                <button style={btnSm("#ef4444")} onClick={()=>removeFromCart(item.id)}>x</button>
              </div>
              <div style={{ fontWeight:"800", fontSize:"14px", minWidth:"72px", textAlign:"right" }}>{fmtCur(item.price*item.qty)}</div>
            </div>
          ))
        }
        {cart.length>0 && (
          <div style={{ marginTop:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"20px", fontWeight:"800", marginBottom:"14px" }}>
              <span>Total</span><span style={{ color:"#e94560" }}>{fmtCur(total)}</span>
            </div>
            <button style={{ ...btn(), width:"100%", padding:"16px", fontSize:"17px" }} onClick={()=>{ setShowCart(false); setShowCheckout(true); }}>
              Pagar {fmtCur(total)}
            </button>
            <button style={{ ...btn("#94a3b8"), width:"100%", padding:"12px", fontSize:"14px", marginTop:"8px" }} onClick={()=>setCart([])}>
              Limpar carrinho
            </button>
          </div>
        )}
      </div>
    </div>
  );


  // --- Dashboard tab ----------------------------------------------------------
  const DashboardTab = () => {
    const p = normalizePlan(currentPlan);
    const isStarter = p === "starter" && !isPlatformAdmin;
    const planName = isPlatformAdmin ? "Administrador" : (p === "starter" ? "Starter grátis" : p === "pro" ? "Pro mensal" : "Premium");

    return (
      <div>
        {(lowStockProducts.length>0 || overdueFiado.length>0) && (
          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)", marginBottom:"14px", border:"1.5px solid #fee2e2" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", marginBottom:"10px" }}>
              <div>
                <div style={{ fontWeight:"900", fontSize:"20px", color:"#0f172a" }}>Alertas importantes</div>
                <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>Veja o que precisa de atenção agora.</div>
              </div>
              <div style={{ background:"#ef4444", color:"#fff", borderRadius:"999px", minWidth:"34px", height:"34px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"900" }}>
                {lowStockProducts.length + overdueFiado.length}
              </div>
            </div>

            {lowStockProducts.length>0 && (
              <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:"14px", padding:"12px", marginBottom:"8px" }}>
                <div style={{ fontWeight:"900", color:"#991b1b" }}>{lowStockProducts.length} produto(s) com estoque baixo</div>
                <div style={{ color:"#991b1b", fontSize:"13px", fontWeight:"700" }}>Produtos com 5 unidades ou menos.</div>
                <button onClick={()=>setTab("estoque")} style={{ ...btn("#dc2626"), padding:"9px 12px", fontSize:"13px", marginTop:"8px" }}>Ver estoque</button>
              </div>
            )}

            {overdueFiado.length>0 && (
              <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:"14px", padding:"12px" }}>
                <div style={{ fontWeight:"900", color:"#9a3412" }}>{overdueFiado.length} fiado(s) vencido(s)</div>
                <div style={{ color:"#9a3412", fontSize:"13px", fontWeight:"700" }}>Clientes com pagamento em atraso.</div>
                <button onClick={()=>setTab("fiado")} style={{ ...btn("#f97316"), padding:"9px 12px", fontSize:"13px", marginTop:"8px" }}>Ver clientes</button>
              </div>
            )}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:"12px", marginBottom:"14px" }}>
          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)" }}>
            <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"900" }}>Vendas registradas hoje</div>
            <div style={{ fontSize:"30px", fontWeight:"900", color:"#16a34a", marginTop:"4px" }}>{salesOfToday.length}</div>
            <div style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"700" }}>Quantidade de vendas feitas no dia.</div>
          </div>

          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)" }}>
            <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"900" }}>Produtos cadastrados</div>
            <div style={{ fontSize:"30px", fontWeight:"900", color:"#2563eb", marginTop:"4px" }}>{products.length}</div>
            <div style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"700" }}>{isStarter ? "Limite do Starter: 30 produtos." : "Produtos do seu estoque."}</div>
          </div>

          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)" }}>
            <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"900" }}>Clientes cadastrados</div>
            <div style={{ fontSize:"30px", fontWeight:"900", color:"#7c3aed", marginTop:"4px" }}>{clients.length}</div>
            <div style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"700" }}>{isStarter ? "Limite do Starter: 20 clientes." : "Clientes cadastrados no sistema."}</div>
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)", marginBottom:"14px" }}>
          <div style={{ fontWeight:"900", fontSize:"19px", color:"#0f172a", marginBottom:"8px" }}>Resumo rápido</div>
          <div style={{ display:"grid", gap:"9px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9", paddingBottom:"8px" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Valor vendido hoje</span>
              <strong style={{ color:"#16a34a" }}>{fmtCur(salesTodayTotal)}</strong>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9", paddingBottom:"8px" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Valor vendido no mês</span>
              <strong style={{ color:"#2563eb" }}>{fmtCur(salesMonthTotal)}</strong>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Fiado em aberto</span>
              <strong style={{ color:"#f97316" }}>{fmtCur(fiadoTotal)}</strong>
            </div>
          </div>
        </div>

        {isStarter && (
          <div style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe", borderRadius:"16px", padding:"14px", color:"#1d4ed8", fontWeight:"800", fontSize:"13px", lineHeight:1.45 }}>
            Recursos como Caixa profissional, Relatórios, Vendas avançadas e Fiscal ficam disponíveis nos planos pagos.
          </div>
        )}
      </div>
    );
  };

  // --- PDV tab ---------------------------------------------------------------

const PDVTab = () => (
    <div>
      <div style={{ display:"flex", gap:"8px", marginBottom:"12px", background:"#fff", padding:"8px", borderRadius:"18px", boxShadow:"0 4px 16px rgba(15,23,42,.08)" }}>
        <button
          onClick={()=>setPdvView("venda")}
          style={{ flex:1, border:"none", borderRadius:"14px", padding:"12px", fontWeight:"900", cursor:"pointer", background:pdvView==="venda"?"#e94560":"#f1f5f9", color:pdvView==="venda"?"#fff":"#64748b" }}
        >
          PDV
        </button>
        <button
          onClick={()=>setPdvView("historico")}
          style={{ flex:1, border:"none", borderRadius:"14px", padding:"12px", fontWeight:"900", cursor:"pointer", background:pdvView==="historico"?"#e94560":"#f1f5f9", color:pdvView==="historico"?"#fff":"#64748b" }}
        >
          Histórico / Reimprimir
        </button>
      </div>

      {pdvView==="historico" ? (
        HistoricoTab()
      ) : (
        <>
          {/* Barcode scanner */}
          <div style={{ ...card, display:"flex", alignItems:"center", gap:"10px",
            border:`2px solid ${barcodeFlash==="ok"?"#22c55e":barcodeFlash==="error"?"#ef4444":"#6366f1"}`,
            background:barcodeFlash==="ok"?"#f0fdf4":barcodeFlash==="error"?"#fef2f2":"#eef2ff", transition:"all 0.2s", marginBottom:"12px" }}>
            <span style={{ fontSize:"22px" }}>Código</span>
            <input ref={barcodeRef}
              style={{ flex:1, border:"none", background:"transparent", fontSize:"15px", outline:"none", fontWeight:"600" }}
              placeholder="Código de barras..." value={barcodeInput}
              onChange={e=>setBarcodeInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleBarcodeScan(barcodeInput)} />
            <button style={btnSm("#6366f1")} onClick={()=>handleBarcodeScan(barcodeInput)}>OK</button>
          </div>

          {/* Search */}
          <input style={{ ...inp, marginBottom:"12px" }} placeholder=" Buscar produto..." value={searchProd} onChange={e=>setSearchProd(e.target.value)} />

          {/* Product grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:"10px" }}>
            {filteredProducts.map(p=>(
              <button key={p.id}
                style={{ background:p.stock>0?"#fff":"#f8f8f8", border:`2px solid ${p.stock>0?"#e2e8f0":"#fecaca"}`, borderRadius:"12px", padding:"14px 10px", cursor:p.stock>0?"pointer":"not-allowed", textAlign:"left", opacity:p.stock>0?1:0.6, transition:"all 0.15s" }}
                onClick={()=>{ addToCart(p); if(isMobile) notify(`OK ${p.name}`); }}>
                <div style={{ fontSize:"14px", fontWeight:"700", color:"#1a1a2e", marginBottom:"4px", lineHeight:1.3 }}>{p.name}</div>
                <div style={{ fontSize:"16px", fontWeight:"800", color:"#e94560" }}>{fmtCur(p.price)}</div>
                <div style={{ fontSize:"10px", color:"#94a3b8", fontFamily:"monospace", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.barcode}</div>
                <div style={{ fontSize:"11px", color:p.stock>5?"#22c55e":p.stock>0?"#f59e0b":"#ef4444", marginTop:"4px", fontWeight:"600" }}>
                  {p.stock>0?`${p.stock} un.`:"Esgotado"}
                </div>
              </button>
            ))}
          </div>

          {/* Desktop cart */}
          {!isMobile && cart.length>0 && (
            <div style={{ ...card, marginTop:"16px" }}>
              <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"12px" }}>PDV Carrinho</div>
              {cart.map(item=>(
                <div key={item.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:"600", fontSize:"13px" }}>{item.name}</div>
                    <div style={{ color:"#e94560", fontSize:"12px" }}>{fmtCur(item.price)} x {item.qty}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <button style={btnSm("#64748b")} onClick={()=>updateQty(item.id,item.qty-1)}>-</button>
                    <span style={{ minWidth:"20px", textAlign:"center" }}>{item.qty}</span>
                    <button style={btnSm("#64748b")} onClick={()=>updateQty(item.id,item.qty+1)}>+</button>
                    <button style={btnSm("#ef4444")} onClick={()=>removeFromCart(item.id)}>x</button>
                  </div>
                  <div style={{ fontWeight:"700", minWidth:"70px", textAlign:"right" }}>{fmtCur(item.price*item.qty)}</div>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"20px", fontWeight:"800", margin:"14px 0 12px" }}>
                <span>Total</span><span style={{ color:"#e94560" }}>{fmtCur(total)}</span>
              </div>
              <button style={{ ...btn(), width:"100%", padding:"14px", fontSize:"16px" }} onClick={()=>setShowCheckout(true)}>
                Ir para Pagamento
              </button>
              <button style={{ ...btn("#94a3b8"), width:"100%", padding:"10px", fontSize:"13px", marginTop:"8px" }} onClick={()=>setCart([])}>
                Limpar Carrinho
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );


  // --- Estoque tab ------------------------------------------------------------
  const EstoqueTab = () => (
    <div>
      <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
          <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:"#ffe4e6", color:"#e94560", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", fontWeight:"900" }}>EST</div>
          <div>
            <div style={{ fontWeight:"900", fontSize:"21px", color:"#0f172a" }}>{editingId ? "Editar Produto" : "Novo Produto"}</div>
            <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>Preencha os dados para cadastrar ou atualizar o produto.</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"12px" }}>
          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Nome do Produto</label>
            <input style={inp} type="text" value={newProduct.name} placeholder="Ex: Rosa vermelha" onChange={e=>setNewProduct({...newProduct,name:e.target.value})} />
          </div>

          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Categoria</label>
            <input style={inp} type="text" value={newProduct.category} placeholder="Geral" onChange={e=>setNewProduct({...newProduct,category:e.target.value})} />
          </div>

          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Custo (R$)</label>
            <input style={inp} inputMode="decimal" value={newProduct.cost} placeholder="0,00" onChange={e=>setNewProduct({...newProduct,cost:e.target.value})} />
          </div>

          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Venda (R$)</label>
            <input style={inp} inputMode="decimal" value={newProduct.price} placeholder="0,00" onChange={e=>setNewProduct({...newProduct,price:e.target.value})} />
          </div>

          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Estoque</label>
            <input style={inp} inputMode="numeric" value={newProduct.stock} placeholder="0" onChange={e=>setNewProduct({...newProduct,stock:e.target.value.replace(/[^0-9]/g,"")})} />
          </div>

          <div>
            <label style={{ fontSize:"13px", fontWeight:"800", color:"#64748b", marginBottom:"5px", display:"block" }}>Código de Barras</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px" }}>
              <input style={{ ...inp, fontFamily:"monospace" }} value={newProduct.barcode} placeholder="Automático se vazio" onChange={e=>setNewProduct({...newProduct,barcode:e.target.value})} />
              <button style={{ ...btnSm("#6366f1"), minWidth:"82px", fontSize:"13px" }} onClick={()=>setNewProduct({...newProduct,barcode:genBarcode()})}>Gerar</button>
            </div>
          </div>
        </div>

        {newProduct.barcode&&(
          <div style={{ marginTop:"12px", background:"#f8fafc", borderRadius:"14px", padding:"12px", textAlign:"center", overflowX:"auto" }}>
            <BarcodeImage value={newProduct.barcode} />
          </div>
        )}

        <div style={{ display:"flex", gap:"8px", marginTop:"14px" }}>
          <button style={{ ...btn("#e94560"), flex:1, borderRadius:"14px", padding:"14px", fontSize:"16px" }} onClick={saveProduct}>
            {editingId ? " Salvar Alterações" : " Cadastrar Produto"}
          </button>
          {editingId&&<button style={{ ...btn("#64748b"), borderRadius:"14px" }} onClick={()=>{setEditingId(null);setNewProduct({name:"",cost:"",price:"",stock:"",category:"Geral",barcode:""});}}>Cancelar</button>}
        </div>
      </div>

      <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", marginBottom:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#ffe4e6", color:"#e94560", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px" }}>EST</div>
            <div style={{ fontWeight:"900", fontSize:"20px", color:"#0f172a" }}>Estoque de Produtos ({products.length})</div>
          </div>
          <input
            style={{ ...inp, maxWidth:isMobile?"170px":"260px", padding:"9px 11px" }}
            placeholder="Pesquisar..."
            value={searchProd}
            onChange={e=>setSearchProd(e.target.value)}
          />
        </div>

        {filteredProducts.length===0 ? (
          <div style={{ color:"#94a3b8", fontWeight:"800", padding:"12px" }}>Nenhum produto encontrado.</div>
        ) : filteredProducts.map(p=>{
          const cost = parseMoney(p.cost || p.lastCost || 0);
          const price = parseMoney(p.price || 0);
          const profit = price - cost;
          const margin = price > 0 ? (profit / price) * 100 : 0;

          return (
          <div key={p.id} style={{ padding:"14px", border:"1px solid #e2e8f0", borderRadius:"18px", marginBottom:"12px", background:"#fff" }}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr", gap:"12px", alignItems:"center" }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:"#ffe4e6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px" }}>EST</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                    {p.barcode&&<div style={{ fontSize:"12px", color:"#64748b", fontFamily:"monospace", marginTop:"2px" }}>Código: {p.barcode}</div>}
                  </div>
                </div>

                <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", marginTop:"10px" }}>
                  <span style={tag("#6366f1")}>{p.category || "Geral"}</span>
                  <span style={tag(p.stock>5?"#22c55e":p.stock>0?"#f59e0b":"#ef4444")}>{p.stock} un. em estoque</span>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", borderLeft:isMobile?"none":"1px solid #e2e8f0", paddingLeft:isMobile?"0":"14px" }}>
                <div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Custo</div>
                  <div style={{ fontWeight:"900", color:"#0f172a" }}>{fmtCur(cost)}</div>
                </div>
                <div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Margem</div>
                  <div style={{ fontWeight:"900", color:margin>=0?"#16a34a":"#dc2626" }}>{fmtPercent(margin)}</div>
                </div>
                <div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Venda</div>
                  <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(price)}</div>
                </div>
                <div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"900" }}>Lucro</div>
                  <div style={{ fontWeight:"900", color:profit>=0?"#16a34a":"#dc2626" }}>{fmtCur(profit)}</div>
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px", marginTop:"14px" }}>
              <button title="Ver código" style={{ ...btnSm("#eff6ff"), color:"#2563eb", border:"1px solid #bfdbfe", padding:"10px", fontSize:"13px" }} onClick={()=>setShowBarcodeModal(p)}>Código  Código</button>
              <button title="Imprimir etiqueta" style={{ ...btnSm("#f0fdf4"), color:"#16a34a", border:"1px solid #bbf7d0", padding:"10px", fontSize:"13px" }} onClick={()=>printProductLabels(p)}>Etiqueta  Etiqueta</button>
              <button title="Editar" style={{ ...btnSm("#eff6ff"), color:"#2563eb", border:"1px solid #bfdbfe", padding:"10px", fontSize:"13px" }} onClick={()=>editProduct(p)}>Editar  Editar</button>
              <button title="Excluir" style={{ ...btnSm("#fff1f2"), color:"#e11d48", border:"1px solid #fecdd3", padding:"10px", fontSize:"13px" }} onClick={()=>deleteProduct(p.id)}>Excluir  Excluir</button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );


  // --- Histórico de vendas tab ----------------------------------------------
  const HistoricoTab = () => {
    const orderedSales = [...sales].sort((a,b)=>new Date(b.date)-new Date(a.date));

    return (
      <div>
        <div style={{ background:"linear-gradient(135deg,#0f172a,#1e293b)", color:"#fff", borderRadius:"20px", padding:"18px", marginBottom:"14px", boxShadow:"0 8px 24px rgba(15,23,42,.16)" }}>
          <div style={{ fontSize:"13px", color:"#cbd5e1", fontWeight:"800" }}>Histórico de vendas</div>
          <div style={{ fontSize:"26px", fontWeight:"900", marginTop:"2px" }}>{orderedSales.length} venda(s)</div>
          <div style={{ color:"#cbd5e1", fontSize:"13px", fontWeight:"700", marginTop:"6px" }}>
            Consulte vendas antigas e reimprima comprovantes.
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:"12px", marginBottom:"14px" }}>
          {[
            ["Total de vendas", fmtCur(totalSales), "linear-gradient(135deg,#e94560,#c0392b)"],
            ["Transações", sales.length, "linear-gradient(135deg,#6366f1,#4338ca)"],
            ["Ticket médio", sales.length?fmtCur(totalSales/sales.length):"R$ 0,00","linear-gradient(135deg,#22c55e,#16a34a)"],
          ].map(([l,v,c],i)=>(
            <div key={i} style={{ background:c, borderRadius:"14px", padding:"16px", color:"#fff", gridColumn:i===2&&isMobile?"1 / -1":undefined, boxShadow:"0 6px 18px rgba(15,23,42,.10)" }}>
              <div style={{ fontSize:"12px", opacity:0.85, marginBottom:"5px", fontWeight:"800" }}>{l}</div>
              <div style={{ fontSize:"22px", fontWeight:"900" }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"14px" }}>
            <div>
              <div style={{ fontWeight:"900", fontSize:"18px" }}>Vendas realizadas</div>
              <div style={{ color:"#94a3b8", fontSize:"13px", fontWeight:"700" }}>Histórico com opção de reimpressão.</div>
            </div>
          </div>

          {orderedSales.length===0 ? (
            <div style={{ color:"#94a3b8", fontWeight:"800", textAlign:"center", padding:"28px 0" }}>Nenhuma venda registrada ainda.</div>
          ) : orderedSales.map(sale=>(
            <div key={sale.id} style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"auto 1fr auto auto", gap:"10px", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ background:"#f1f5f9", borderRadius:"12px", padding:"8px 10px", fontSize:"12px", fontWeight:"900", color:"#64748b", width:isMobile?"fit-content":"auto" }}>
                #{sale.id}
              </div>

              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:"900", color:"#0f172a" }}>Venda #{sale.id}</div>
                <div style={{ fontSize:"12px", color:"#64748b", marginTop:"2px" }}>{fmtDate(sale.date)}</div>
                {sale.fiado?.clientName && (
                  <div style={{ fontSize:"12px", color:"#f97316", fontWeight:"800", marginTop:"2px" }}>Cliente: {sale.fiado.clientName}</div>
                )}
                <div style={{ display:"flex", gap:"4px", marginTop:"6px", flexWrap:"wrap" }}>
                  {(sale.payments || []).map((p,i)=>(
                    <span key={i} style={{ background:mColor(p.method)+"22", color:mColor(p.method), borderRadius:"10px", padding:"2px 7px", fontSize:"11px", fontWeight:"800" }}>
                      {mLabel(p.method)}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ fontWeight:"900", fontSize:"18px", color:"#16a34a", textAlign:isMobile?"left":"right" }}>{fmtCur(sale.total)}</div>

              <div style={{ display:"flex", gap:"8px", justifyContent:isMobile?"flex-start":"flex-end", flexWrap:"wrap" }}>
                <button style={{ ...btnSm("#64748b"), padding:"10px 12px" }} onClick={()=>{setSelectedSale(sale);setShowReceipt(true);}}>Ver</button>
                <button style={{ ...btnSm("#e94560"), padding:"10px 12px" }} onClick={()=>{setSelectedSale(sale);setShowReceipt(true);}}>Reimprimir</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };


  // --- Vendas tab ------------------------------------------------------------
const VendasTab = () => (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["Total de Vendas", fmtCur(totalSales), "linear-gradient(135deg,#e94560,#c0392b)"],
          ["Transacoes", sales.length, "linear-gradient(135deg,#6366f1,#4338ca)"],
          ["Ticket Medio", sales.length?fmtCur(totalSales/sales.length):"R$ 0,00","linear-gradient(135deg,#22c55e,#16a34a)"],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{ background:c, borderRadius:"12px", padding:"16px", color:"#fff", gridColumn:i===2&&isMobile?"1 / -1":undefined }}>
            <div style={{ fontSize:"11px", opacity:0.8, marginBottom:"4px" }}>{l}</div>
            <div style={{ fontSize:"20px", fontWeight:"800" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"12px" }}> Historico</div>
        {sales.length===0
          ? <p style={{ textAlign:"center", color:"#94a3b8", padding:"24px 0" }}>Nenhuma venda ainda</p>
          : sales.map(sale=>(
            <div key={sale.id} style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f1f5f9", gap:"10px" }}>
              <div style={{ background:"#f1f5f9", borderRadius:"8px", padding:"6px 10px", fontSize:"12px", fontWeight:"700", color:"#64748b", whiteSpace:"nowrap" }}>#{sale.id}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"12px", color:"#64748b" }}>{fmtDate(sale.date)}</div>
                <div style={{ display:"flex", gap:"4px", marginTop:"2px", flexWrap:"wrap" }}>
                  {sale.payments.map((p,i)=>(
                    <span key={i} style={{ background:mColor(p.method)+"22", color:mColor(p.method), borderRadius:"10px", padding:"1px 7px", fontSize:"11px", fontWeight:"700" }}>
                      {mIcon(p.method)} {mLabel(p.method)}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ fontWeight:"800", fontSize:"14px", whiteSpace:"nowrap" }}><div style={{fontSize:"14px",fontWeight:"800",opacity:.85,marginBottom:"6px"}}>Saidas do dia</div>{fmtCur(sale.total)}</div>
              <button style={btnSm("#6366f1")} onClick={()=>{setSelectedSale(sale);setShowReceipt(true);}}> Recibo</button>
            </div>
          ))
        }
      </div>
    </div>
  );




  // --- Caixa tab --------------------------------------------------------------
  const CaixaTab = () => {
    const key = dayKey();
    const byMethod = paymentSummary(key);
    const entradas = Object.values(byMethod).reduce((a,b)=>a+b,0);
    const vendasHojeList = sales.filter(s=>isSameDay(s.date,key));
    const vendasHoje = vendasHojeList.reduce((sum,s)=>sum+s.total,0);
    const fiadoHoje = vendasHojeList.filter(s=>s.fiado).reduce((sum,s)=>sum+s.total,0);
    const recebimentosFiadoHoje = paymentsOfDay(key).filter(p=>p.origin==="Recebimento fiado").reduce((sum,p)=>sum+(parseFloat(p.amount)||0),0);
    const ultimosPagamentos = paymentsOfDay(key).sort((a,b)=>new Date(b.date)-new Date(a.date));

    const vendasSemana = sales.filter(s=>isThisWeek(s.date));
    const vendasSemanaTotal = vendasSemana.reduce((sum,s)=>sum+s.total,0);
    const vendasMesTotal = salesOfMonth.reduce((sum,s)=>sum+s.total,0);
    const ticketMes = salesOfMonth.length ? vendasMesTotal/salesOfMonth.length : 0;
    const fiadoAbertoLista = fiadoSales.filter(s=>fiadoOpenAmount(s)>0).sort((a,b)=>fiadoOpenAmount(b)-fiadoOpenAmount(a));
    const topClientesCaixa = topClients;
    const topProdutosCaixa = productRanking;
    const contasAbertasOrdenadas = [...openPayables].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
    const contasPagasRecentes = [...paidPayables].sort((a,b)=>new Date(b.paidDate||b.dueDate)-new Date(a.paidDate||a.dueDate));

    const pill = (key,label) => (
      <button
        onClick={()=>setCaixaView(key)}
        style={{
          flex:1,
          padding:"10px 8px",
          border:"none",
          borderRadius:"12px",
          cursor:"pointer",
          background:caixaView===key?"#e94560":"#f1f5f9",
          color:caixaView===key?"#fff":"#64748b",
          fontWeight:"900",
          fontSize:"13px"
        }}
      >
        {label}
      </button>
    );

    const ResumoCaixa = () => (
      <>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
          {[
            ["Entradas hoje", fmtCur(entradas), "linear-gradient(135deg,#16a34a,#15803d)"],
            ["Vendas hoje", fmtCur(vendasHoje), "linear-gradient(135deg,#e94560,#c0392b)"],
            ["Crediário vendido", fmtCur(fiadoHoje), "linear-gradient(135deg,#f59e0b,#d97706)"],
            ["Recebido crediário", fmtCur(recebimentosFiadoHoje), "linear-gradient(135deg,#6366f1,#4338ca)"],
          ].map(([l,v,c],i)=>(
            <div key={i} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
              <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
              <div style={{ fontSize:"19px", fontWeight:"900" }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Caixa profissional</div>

          {!cashOpeningOfDay() ? (
            <div style={{ background:lastCashClosureOfDay()?"#f1f5f9":"#fff7ed", border:`1.5px solid ${lastCashClosureOfDay()?"#cbd5e1":"#fdba74"}`, borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
              <div style={{ fontWeight:"900", color:lastCashClosureOfDay()?"#334155":"#9a3412", marginBottom:"6px" }}>
                {lastCashClosureOfDay() ? "Ultimo turno fechado. Pode abrir novo turno." : "Caixa ainda nao aberto hoje"}
              </div>
              {lastCashClosureOfDay() && (
                <div style={{ fontSize:"12px", color:"#475569", marginBottom:"8px" }}>
                  Ultimo fechamento: {fmtDate(lastCashClosureOfDay()?.date)} | Diferença:
                  <strong style={{ color:Math.abs(lastCashClosureOfDay()?.diferenca||0)<0.01?"#16a34a":"#dc2626" }}> {fmtCur(lastCashClosureOfDay()?.diferenca||0)}</strong>
                </div>
              )}
              <div style={{ fontSize:"12px", color:lastCashClosureOfDay()?"#475569":"#9a3412", marginBottom:"10px" }}>Informe quanto tem de dinheiro no caixa para troco.</div>
              <div style={{ display:"flex", gap:"8px" }}>
                <input style={{ ...inp, flex:1, margin:0 }} inputMode="decimal" placeholder="Saldo inicial" value={cashOpeningValue} onChange={e=>setCashOpeningValue(e.target.value)} />
                <button style={{ ...btn("#16a34a"), padding:"12px 14px" }} onClick={openCash}>Abrir turno</button>
              </div>
            </div>
          ) : (
            <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
              <div style={{ fontWeight:"900", color:"#166534" }}>Caixa aberto - turno {cashClosuresOfDay().length + 1}</div>
              <div style={{ fontSize:"12px", color:"#166534" }}>Abertura: {fmtCur(cashOpsTotals(dayKey(), cashOpeningOfDay()?.date).abertura)}</div>
            </div>
          )}

          <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
            <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"10px" }}>Resumo das entradas recebidas hoje</div>
            {["dinheiro","pix","debito","credito"].map(k=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #e2e8f0" }}>
                <strong style={{ color:"#334155", textTransform:"capitalize" }}>{mLabel(k)}</strong>
                <strong style={{ color:mColor(k) }}>{fmtCur(byMethod[k]||0)}</strong>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", fontSize:"16px" }}>
              <strong>Total de entradas</strong><strong style={{ color:"#16a34a" }}>{fmtCur(entradas)}</strong>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px", marginBottom:"12px" }}>
            <div style={{ background:"#ecfdf5", border:"1.5px solid #bbf7d0", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#166534", fontWeight:"800" }}>Abertura</div>
              <div style={{ fontSize:"17px", fontWeight:"900", color:"#16a34a" }}>{fmtCur(cashOpsTotals(dayKey(), cashOpeningOfDay()?.date).abertura)}</div>
            </div>
            <div style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#1d4ed8", fontWeight:"800" }}>Reforcos</div>
              <div style={{ fontSize:"17px", fontWeight:"900", color:"#2563eb" }}>{fmtCur(cashOpsTotals(dayKey(), cashOpeningOfDay()?.date).reforco)}</div>
            </div>
            <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#991b1b", fontWeight:"800" }}>Sangrias</div>
              <div style={{ fontSize:"17px", fontWeight:"900", color:"#dc2626" }}>{fmtCur(cashOpsTotals(dayKey(), cashOpeningOfDay()?.date).sangria)}</div>
            </div>
            <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#334155", fontWeight:"800" }}>Esperado</div>
              <div style={{ fontSize:"17px", fontWeight:"900", color:"#1a1a2e" }}>{fmtCur(expectedCashBalance())}</div>
            </div>
          </div>

          <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
            <div style={{ fontWeight:"900", color:"#334155", marginBottom:"8px" }}>Sangria / Reforco</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
              <button onClick={()=>setCashOpForm({...cashOpForm,type:"sangria"})} style={{ ...btn(cashOpForm.type==="sangria"?"#dc2626":"#94a3b8"), padding:"10px", fontSize:"13px" }}>Sangria</button>
              <button onClick={()=>setCashOpForm({...cashOpForm,type:"reforco"})} style={{ ...btn(cashOpForm.type==="reforco"?"#2563eb":"#94a3b8"), padding:"10px", fontSize:"13px" }}>Reforco</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
              <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Valor" value={cashOpForm.amount} onChange={e=>setCashOpForm({...cashOpForm,amount:e.target.value})} />
              <input style={{ ...inp, margin:0 }} placeholder="Observacao" value={cashOpForm.note} onChange={e=>setCashOpForm({...cashOpForm,note:e.target.value})} />
            </div>
            <button style={{ ...btn("#64748b"), width:"100%", padding:"10px", fontSize:"13px" }} onClick={addCashOperation}>Registrar movimentacao</button>
          </div>

          <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
            <div style={{ fontWeight:"900", color:"#334155", marginBottom:"8px" }}>Conferencia do fechamento</div>
            <input style={{ ...inp, marginBottom:"8px" }} inputMode="decimal" placeholder={`Dinheiro contado no caixa (${fmtCur(expectedCashBalance())})`} value={cashRealValue} onChange={e=>setCashRealValue(e.target.value)} />
            <div style={{ fontSize:"12px", color:"#64748b" }}>Deixe em branco para fechar com o saldo esperado.</div>
          </div>

          <button style={{ ...btn(cashOpeningOfDay()?"#16a34a":"#94a3b8"), width:"100%", opacity:cashOpeningOfDay()?1:0.65 }} onClick={closeCash}>
            {cashOpeningOfDay() ? " Fechar turno atual" : " Abra um turno para fechar"}
          </button>
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"16px", marginBottom:"12px" }}> Movimentacoes de hoje</div>
          {[...cashOpsOfDay().filter(o=>o.type!=="abertura").map(o=>({ ...o, isCashOp:true, method:o.type==="sangria"?"sangria":"reforco", origin:o.type==="sangria"?"Sangria":"Reforco", amount:o.amount, saleId:"CAIXA", clientName:o.note||"", date:o.date })), ...ultimosPagamentos].length===0 ? (
            <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma movimentacao hoje.</div>
          ) : [...cashOpsOfDay().filter(o=>o.type!=="abertura").map(o=>({ ...o, isCashOp:true, method:o.type==="sangria"?"sangria":"reforco", origin:o.type==="sangria"?"Sangria":"Reforco", amount:o.amount, saleId:"CAIXA", clientName:o.note||"", date:o.date })), ...ultimosPagamentos].map((p,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontWeight:"800", color:"#1a1a2e" }}>{mLabel(p.method)} - {p.origin}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>#{p.saleId} {p.clientName ? `- ${p.clientName}` : ""} | {fmtDate(p.date)}</div>
              </div>
              <div style={{ fontWeight:"900", color:p.method==="sangria"?"#dc2626":p.method==="reforco"?"#2563eb":mColor(p.method), whiteSpace:"nowrap" }}>{p.method==="sangria"?"- ":""}{fmtCur(parseFloat(p.amount)||0)}</div>
            </div>
          ))}
        </div>
      </>
    );

    const RelatoriosCaixa = () => (
      <>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
          {[
            ["Hoje", fmtCur(vendasHoje), "#16a34a"],
            ["Semana", fmtCur(vendasSemanaTotal), "#2563eb"],
            ["Mes", fmtCur(vendasMesTotal), "#e94560"],
            ["Ticket mes", fmtCur(ticketMes), "#6366f1"],
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:"#fff", borderRadius:"14px", padding:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize:"12px", color:"#64748b", fontWeight:"800" }}>{l}</div>
              <div style={{ fontSize:"20px", fontWeight:"900", color:c }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Resumo financeiro previsto</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px" }}>
            <div style={{ background:"#f0fdf4", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#166534", fontWeight:"900" }}>A receber 30 dias</div><div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(receivablesNext30Total)}</div></div>
            <div style={{ background:"#fef2f2", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#991b1b", fontWeight:"900" }}>A pagar 7 dias</div><div style={{ fontWeight:"900", color:"#dc2626" }}>{fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0))}</div></div>
            <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#1d4ed8", fontWeight:"900" }}>Saldo projetado</div><div style={{ fontWeight:"900", color:cashFlow30>=0?"#2563eb":"#dc2626" }}>{fmtCur(cashFlow30)}</div></div>
            <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#475569", fontWeight:"900" }}>A receber aberto</div><div style={{ fontWeight:"900", color:"#334155" }}>{fmtCur(receivablesOpenTotal)}</div></div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Relatorio por pagamento hoje</div>
          {[
            ["Dinheiro", byMethod.dinheiro, "#16a34a"],
            ["PIX", byMethod.pix, "#0891b2"],
            ["Debito", byMethod.debito, "#7c3aed"],
            ["Credito", byMethod.credito, "#2563eb"],
          ].map(([label,value,color])=>{
            const pct = entradas>0 ? Math.round((value/entradas)*100) : 0;
            return (
              <div key={label} style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                  <span style={{ fontWeight:"900", color:"#334155" }}>{label}</span>
                  <span style={{ fontWeight:"900", color }}>{fmtCur(value)} ({pct}%)</span>
                </div>
                <div style={{ height:"8px", background:"#e2e8f0", borderRadius:"999px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:"999px" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"14px" }}>
          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Top clientes</div>
            {topClientesCaixa.length===0 ? <div style={{ color:"#94a3b8" }}>Sem dados ainda.</div> :
              topClientesCaixa.map((c,i)=>(
                <div key={c.id} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontWeight:"900" }}>{i+1}. {c.name}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>Aberto: {fmtCur(c.openBalance)}</div>
                  </div>
                  <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(c.totalBought)}</div>
                </div>
              ))
            }
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Top produtos</div>
            {topProdutosCaixa.length===0 ? <div style={{ color:"#94a3b8" }}>Sem produtos vendidos ainda.</div> :
              topProdutosCaixa.map((p,i)=>(
                <div key={p.id} style={{ padding:"9px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <div style={{ fontWeight:"900" }}>{i+1}. {p.name}</div>
                    <div style={{ fontWeight:"900", color:"#2563eb" }}>{p.sold} un.</div>
                  </div>
                  <div style={{ fontSize:"12px", color:"#64748b" }}>Total: {fmtCur(p.total)}</div>
                </div>
              ))
            }
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Resumo financeiro do mes</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px" }}>
            {[
              ["", salesMonthTotal, "#16a34a"],
              ["A pagar mes", payablesMonthTotal, "#e94560"],
              ["Pago mes", payablesPaidMonthTotal, "#2563eb"],
              ["Previsto", expectedMonthBalance, expectedMonthBalance>=0?"#16a34a":"#dc2626"],
            ].map(([l,v,c])=>(
              <div key={l} style={{ background:"#f8fafc", borderRadius:"12px", padding:"10px" }}>
                <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"800" }}>{l}</div>
                <div style={{ fontWeight:"900", color:c }}>{fmtCur(v)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Fiados em aberto</div>
          {fiadoAbertoLista.length===0 ? (
            <div style={{ color:"#94a3b8" }}>Nenhum fiado em aberto.</div>
          ) : fiadoAbertoLista.slice(0,10).map(s=>(
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f1f5f9", gap:"10px" }}>
              <div>
                <div style={{ fontWeight:"900" }}>#{s.id} - {s.fiado.clientName}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>Vence: {s.fiado.dueDate || "-"} | Compra: {fmtCur(s.total)}</div>
              </div>
              <div style={{ fontWeight:"900", color:"#e94560" }}>{fmtCur(fiadoOpenAmount(s))}</div>
            </div>
          ))}
        </div>
      </>
    );

    const FinanceiroCaixa = () => {
      const statusColor = (p) => p.paid ? "#16a34a" : (p.dueDate < dayKey() ? "#dc2626" : (p.dueDate === dayKey() ? "#f59e0b" : "#64748b"));
      const statusLabel = (p) => p.paid ? "Pago" : (p.dueDate < dayKey() ? "Vencida" : (p.dueDate === dayKey() ? "Vence hoje" : "Em aberto"));
      const contasAbertasOrdenadas = [...openPayables].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
      const receberAbertasOrdenadas = [...openReceivables].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));

      const subBtn = (key,label) => (
        <button onClick={()=>setFinanceiroView(key)}
          style={{ flex:1, padding:"10px", border:"none", borderRadius:"12px", cursor:"pointer", background:financeiroView===key?"#e94560":"#f1f5f9", color:financeiroView===key?"#fff":"#64748b", fontWeight:"900" }}>
          {label}
        </button>
      );

      const ContasPagar = () => (
        <>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
            {[
              ["A pagar aberto", fmtCur(payablesOpenTotal), "linear-gradient(135deg,#e94560,#c0392b)"],
              ["Vence hoje", fmtCur(payablesDueTodayTotal), "linear-gradient(135deg,#f59e0b,#d97706)"],
              ["", fmtCur(payablesOverdueTotal), "linear-gradient(135deg,#dc2626,#991b1b)"],
              ["Prox. 7 dias", fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0)), "linear-gradient(135deg,#6366f1,#4338ca)"],
            ].map(([l,v,c],i)=>(
              <div key={i} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
                <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
                <div style={{ fontSize:"18px", fontWeight:"900" }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Nova conta a pagar</div>
            <input style={{ ...inp, marginBottom:"8px" }} placeholder="Fornecedor" value={newPayable.supplier} onChange={e=>setNewPayable({...newPayable,supplier:e.target.value})} />
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="NF / boleto / documento" value={newPayable.document} onChange={e=>setNewPayable({...newPayable,document:e.target.value})} />
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="Valor" inputMode="decimal" value={newPayable.amount} onChange={e=>setNewPayable({...newPayable,amount:e.target.value})} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <input style={{ ...inp, marginBottom:"8px" }} type="date" min={dayKey()} value={newPayable.dueDate} onChange={e=>{
                const value = e.target.value;
                if (value && value < dayKey()) { notify("Escolha uma data de hoje em diante.", "error"); return; }
                setNewPayable({...newPayable,dueDate:value});
              }} />
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="Categoria" value={newPayable.category} onChange={e=>setNewPayable({...newPayable,category:e.target.value})} />
            </div>
            <input style={{ ...inp, marginBottom:"10px" }} placeholder="Descricao / observacao" value={newPayable.description} onChange={e=>setNewPayable({...newPayable,description:e.target.value})} />

            <div style={{ background:String(newPayable.document||"").trim()?"#f8fafc":"#fff7ed", border:`1.5px solid ${String(newPayable.document||"").trim()?"#e2e8f0":"#fdba74"}`, borderRadius:"14px", padding:"12px", marginBottom:"10px" }}>
              <div style={{ fontWeight:"900", color:"#334155", marginBottom:"6px" }}> Itens comprados / entrada no estoque</div>
              {!String(newPayable.document||"").trim() ? (
                <div>
                  <div style={{ fontSize:"13px", color:"#9a3412", fontWeight:"800", marginBottom:"4px" }}>Informe a NF / boleto / documento primeiro.</div>
                  <div style={{ fontSize:"12px", color:"#9a3412" }}>A entrada de produtos fica bloqueada sem documento, para evitar cadastro de estoque fora da compra.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"10px" }}>Opcional. Se preencher, o sistema soma as quantidades ao estoque.</div>
                  {purchaseItems.map((it,idx)=>(
                    <div key={idx} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px", marginBottom:"8px" }}>
                      <select value={it.productId} onChange={e=>{
                        const prod = products.find(p=>String(p.id)===String(e.target.value));
                        updatePurchaseItem(idx,{ productId:e.target.value, name:prod?.name || "", cost:it.cost || (prod?.cost ? String(prod.cost) : ""), salePrice:it.salePrice || (prod?.price ? String(prod.price) : "") });
                      }} style={{ ...inp, marginBottom:"8px" }}>
                        <option value="">Novo item ou selecione produto existente</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name} - estoque: {p.stock}</option>)}
                      </select>
                      <input style={{ ...inp, marginBottom:"8px" }} placeholder="Nome do item comprado" value={it.name} onChange={e=>updatePurchaseItem(idx,{ name:e.target.value, productId:"" })} />
                      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:"8px" }}>
                        <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Quantidade" value={it.qty} onChange={e=>updatePurchaseItem(idx,{ qty:e.target.value })} />
                        <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Custo unit." value={it.cost} onChange={e=>updatePurchaseItem(idx,{ cost:e.target.value })} />
                        <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Venda unit." value={it.salePrice||""} onChange={e=>updatePurchaseItem(idx,{ salePrice:e.target.value })} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px", gap:"8px", flexWrap:"wrap" }}>
                        <div style={{ fontSize:"12px", color:"#64748b" }}>Subtotal custo: <strong>{fmtCur((parseFloat(String(it.qty||"").replace(",","."))||0) * parseMoney(it.cost))}</strong></div>
                        <div style={{ fontSize:"12px", color:"#16a34a", fontWeight:"800" }}>Lucro un.: {fmtCur(Math.max(0, parseMoney(it.salePrice)-parseMoney(it.cost)))}</div>
                        <button onClick={()=>removePurchaseItemRow(idx)} style={{ ...btn("#ef4444"), padding:"7px 10px", fontSize:"12px" }}>Remover</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addPurchaseItemRow} style={{ ...btn("#64748b"), width:"100%", padding:"9px", fontSize:"13px" }}>+ Adicionar outro item</button>
                  {purchaseItemsTotal()>0 && (
                    <div style={{ marginTop:"10px", background:"#ecfdf5", border:"1.5px solid #bbf7d0", borderRadius:"12px", padding:"10px", display:"flex", justifyContent:"space-between" }}>
                      <strong>Total dos itens</strong><strong style={{ color:"#16a34a" }}>{fmtCur(purchaseItemsTotal())}</strong>
                    </div>
                  )}
                  {purchaseItemsTotal()>0 && parseMoney(newPayable.amount)>0 && (
                    <div style={{ marginTop:"8px", background:Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01?"#ecfdf5":"#fff7ed", border:`1.5px solid ${Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01?"#bbf7d0":"#fdba74"}`, borderRadius:"12px", padding:"9px", fontSize:"12px", fontWeight:"800", color:Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01?"#166534":"#9a3412" }}>
                      {Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01 ? "Nota conferida: valor fecha com os itens." : `Diferenca: ${fmtCur(parseMoney(newPayable.amount)-purchaseItemsTotal())}. Ajuste antes de salvar.`}
                    </div>
                  )}
                </>
              )}
            </div>

            <button style={{ ...btn("#e94560"), width:"100%" }} onClick={addPayable}>Cadastrar conta</button>
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Contas em aberto</div>
            {contasAbertasOrdenadas.length===0 ? (
              <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma conta em aberto.</div>
            ) : contasAbertasOrdenadas.map(p=>(
              <div key={p.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:p.dueDate<dayKey()?"#fef2f2":"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{p.supplier}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>{p.document ? `Doc: ${p.document} | ` : ""}Vence: {p.dueDate}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>{p.category || "Geral"}{p.description ? ` - ${p.description}` : ""}</div>
                    {Array.isArray(p.purchaseItems) && p.purchaseItems.length>0 && (
                      <div style={{ marginTop:"6px", background:"#f8fafc", borderRadius:"8px", padding:"7px", fontSize:"11px", color:"#475569" }}>
                        <strong>Itens:</strong> {p.purchaseItems.map(it=>`${it.qty}x ${it.name}`).join(" | ")}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:"900", color:statusColor(p), whiteSpace:"nowrap" }}>{fmtCur(p.amount)}</div>
                    <div style={{ fontSize:"11px", color:statusColor(p), fontWeight:"800" }}>{statusLabel(p)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                  <button style={{ ...btn("#16a34a"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>markPayablePaid(p.id)}>Pagar</button>
                  <button style={{ ...btn("#ef4444"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>deletePayable(p.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      );

      const ContasReceber = () => (
        <>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
            {[
              ["A receber aberto", fmtCur(receivablesOpenTotal), "linear-gradient(135deg,#16a34a,#15803d)"],
              ["Receber hoje", fmtCur(receivablesDueTodayTotal), "linear-gradient(135deg,#22c55e,#16a34a)"],
              ["", fmtCur(receivablesOverdueTotal), "linear-gradient(135deg,#dc2626,#991b1b)"],
              ["Prox. 30 dias", fmtCur(receivablesNext30Total), "linear-gradient(135deg,#0ea5e9,#2563eb)"],
            ].map(([l,v,c],i)=>(
              <div key={i} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
                <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
                <div style={{ fontSize:"18px", fontWeight:"900" }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Nova conta a receber</div>
            <input style={{ ...inp, marginBottom:"8px" }} placeholder="Cliente" value={newReceivable.clientName} onChange={e=>setNewReceivable({...newReceivable,clientName:e.target.value})} />
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="Documento / referencia" value={newReceivable.document} onChange={e=>setNewReceivable({...newReceivable,document:e.target.value})} />
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="Valor total" inputMode="decimal" value={newReceivable.amount} onChange={e=>setNewReceivable({...newReceivable,amount:e.target.value})} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <input style={{ ...inp, marginBottom:"8px" }} type="date" min={dayKey()} value={newReceivable.dueDate} onChange={e=>{
                const value = e.target.value;
                if (value && value < dayKey()) { notify("Escolha uma data de hoje em diante.", "error"); return; }
                setNewReceivable({...newReceivable,dueDate:value});
              }} />
              <select style={{ ...inp, marginBottom:"8px" }} value={newReceivable.installments} onChange={e=>setNewReceivable({...newReceivable,installments:e.target.value})}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
            <input style={{ ...inp, marginBottom:"8px" }} placeholder="Categoria" value={newReceivable.category} onChange={e=>setNewReceivable({...newReceivable,category:e.target.value})} />
            <input style={{ ...inp, marginBottom:"10px" }} placeholder="Descricao / observacao" value={newReceivable.description} onChange={e=>setNewReceivable({...newReceivable,description:e.target.value})} />
            <button style={{ ...btn("#16a34a"), width:"100%" }} onClick={addReceivable}>Cadastrar recebimento</button>
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Contas a receber em aberto</div>
            {receberAbertasOrdenadas.length===0 ? (
              <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma conta a receber em aberto.</div>
            ) : receberAbertasOrdenadas.map(r=>(
              <div key={r.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:r.dueDate<dayKey()?"#fef2f2":"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{r.clientName}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>{r.document ? `Doc: ${r.document} | ` : ""}Vence: {r.dueDate}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>Parcela {r.installmentNumber}/{r.totalInstallments} | {r.category || "Geral"}</div>
                    {r.description && <div style={{ fontSize:"12px", color:"#64748b" }}>{r.description}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:"900", color:statusColor(r), whiteSpace:"nowrap" }}>{fmtCur(receivableOpenAmount(r))}</div>
                    <div style={{ fontSize:"11px", color:statusColor(r), fontWeight:"800" }}>{statusLabel(r)}</div>
                    {receivablePaid(r)>0 && <div style={{ fontSize:"11px", color:"#16a34a" }}>Pago: {fmtCur(receivablePaid(r))}</div>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                  <button style={{ ...btn("#16a34a"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>receiveReceivable(r.id)}>Receber</button>
                  <button style={{ ...btn("#ef4444"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>deleteReceivable(r.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Recebidas recentes</div>
            {paidReceivables.slice(0,5).length===0 ? (
              <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhum recebimento quitado.</div>
            ) : paidReceivables.slice(0,5).map(r=>(
              <div key={r.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                <div>
                  <div style={{ fontWeight:"900" }}>{r.clientName}</div>
                  <div style={{ fontSize:"12px", color:"#64748b" }}>{r.document} | {fmtDate(r.paidDate || r.createdAt)}</div>
                </div>
                <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(r.amount)}</div>
              </div>
            ))}
          </div>
        </>
      );

      const FluxoCaixa = () => (
        <>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
            {[
              ["Receber 30 dias", fmtCur(receivablesNext30Total), "#16a34a"],
              ["Pagar 7 dias", fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0)), "#dc2626"],
              ["Saldo projetado", fmtCur(cashFlow30), cashFlow30>=0?"#2563eb":"#dc2626"],
              ["Saldo mes", fmtCur(expectedMonthBalance), expectedMonthBalance>=0?"#16a34a":"#dc2626"],
            ].map(([l,v,c])=>(
              <div key={l} style={{ background:"#fff", borderRadius:"14px", padding:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
                <div style={{ fontSize:"12px", color:"#64748b", fontWeight:"800" }}>{l}</div>
                <div style={{ fontSize:"19px", fontWeight:"900", color:c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Fluxo de caixa previsto</div>
            <div style={{ background:"#f0fdf4", borderRadius:"12px", padding:"12px", marginBottom:"8px", display:"flex", justifyContent:"space-between" }}>
              <strong>Entradas previstas 30 dias</strong><strong style={{ color:"#16a34a" }}>{fmtCur(receivablesNext30Total)}</strong>
            </div>
            <div style={{ background:"#fef2f2", borderRadius:"12px", padding:"12px", marginBottom:"8px", display:"flex", justifyContent:"space-between" }}>
              <strong>Saidas proximos 7 dias</strong><strong style={{ color:"#dc2626" }}>{fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0))}</strong>
            </div>
            <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"12px", display:"flex", justifyContent:"space-between" }}>
              <strong>Saldo projetado</strong><strong style={{ color:cashFlow30>=0?"#2563eb":"#dc2626" }}>{fmtCur(cashFlow30)}</strong>
            </div>
          </div>
        </>
      );

      return (
        <>
          <div style={{ display:"flex", gap:"8px", background:"#fff", borderRadius:"16px", padding:"8px", marginBottom:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            {subBtn("pagar","A pagar")}
            {subBtn("receber","A receber")}
            {subBtn("fluxo","Fluxo")}
          </div>
          {financeiroView==="pagar" && ContasPagar()}
          {financeiroView==="receber" && ContasReceber()}
          {financeiroView==="fluxo" && FluxoCaixa()}
        </>
      );
    };

    const HistoricoCaixa = () => (
      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"6px" }}> Historico de fechamentos</div>
        <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"12px" }}>Registro fechado e nao editavel, para conferencia e confianca.</div>
        {cashClosures.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhum fechamento registrado.</div>
        ) : cashClosures.map(c=>{
          const diff = parseFloat(c.diferenca)||0;
          const hasDiff = Math.abs(diff) >= 0.01;
          return (
            <div key={c.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", marginBottom:"8px" }}>
                <div>
                  <div style={{ fontWeight:"900" }}>{fmtDate(c.date)}</div>
                  <div style={{ fontSize:"12px", color:"#64748b" }}>Turno {c.turno || 1} | {c.salesCount} transacoes | Registro bloqueado</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(c.entradas||0)}</div>
                  <div style={{ fontSize:"11px", color:hasDiff?"#dc2626":"#16a34a", fontWeight:"900" }}>
                    {hasDiff ? `Diferença ${fmtCur(diff)}` : "Sem diferença"}
                  </div>
                </div>
              </div>

              <div style={{ background:hasDiff?"#fef2f2":"#f0fdf4", border:`1.5px solid ${hasDiff?"#fecaca":"#bbf7d0"}`, borderRadius:"12px", padding:"10px", marginBottom:"8px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", fontSize:"12px" }}>
                  <div>Saldo esperado: <strong>{fmtCur(c.saldoEsperado ?? c.entradas)}</strong></div>
                  <div>Saldo contado: <strong>{fmtCur(c.saldoInformado ?? c.entradas)}</strong></div>
                  <div>Abertura: <strong>{fmtCur(c.abertura||0)}</strong></div>
                  <div>Sangria: <strong>{fmtCur(c.sangria||0)}</strong></div>
                  <div>Reforço: <strong>{fmtCur(c.reforco||0)}</strong></div>
                  <div>Diferença: <strong style={{ color:hasDiff?"#dc2626":"#16a34a" }}>{fmtCur(diff)}</strong></div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", fontSize:"12px", color:"#64748b" }}>
                <div>Dinheiro: <strong>{fmtCur(c.byMethod?.dinheiro||0)}</strong></div>
                <div>PIX: <strong>{fmtCur(c.byMethod?.pix||0)}</strong></div>
                <div>Debito: <strong>{fmtCur(c.byMethod?.debito||0)}</strong></div>
                <div>Credito: <strong>{fmtCur(c.byMethod?.credito||0)}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    );

    return (
      <div>
        <div style={{ display:"flex", gap:"8px", background:"#fff", borderRadius:"16px", padding:"8px", marginBottom:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
          {pill("resumo","Resumo")}
          {pill("relatorios","Relatorios")}
          {pill("financeiro","Financeiro")}
          {pill("historico","Historico")}
        </div>

        {caixaView==="resumo" && ResumoCaixa()}
        {caixaView==="relatorios" && RelatoriosCaixa()}
        {caixaView==="financeiro" && FinanceiroCaixa()}
        {caixaView==="historico" && HistoricoCaixa()}
      </div>
    );
  };

  // --- Fiado tab --------------------------------------------------------------
  const FiadoTab = () => (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
        <div style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:"12px", padding:"16px", color:"#fff" }}>
          <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>Total em aberto</div>
          <div style={{ fontSize:"22px", fontWeight:"900" }}>{fmtCur(fiadoTotal)}</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#6366f1,#4338ca)", borderRadius:"12px", padding:"16px", color:"#fff" }}>
          <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>Clientes cadastrados</div>
          <div style={{ fontSize:"22px", fontWeight:"900" }}>{clients.length}</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}> Novo Cliente</div>
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="Nome do cliente" value={newClient.name} onChange={e=>setNewClient({...newClient,name:e.target.value})} />
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="WhatsApp" value={newClient.phone} onChange={e=>setNewClient({...newClient,phone:e.target.value})} />
        <input style={{ ...inp, marginBottom:"12px" }} type="number" placeholder="Limite de credito opcional" value={newClient.limit} onChange={e=>setNewClient({...newClient,limit:e.target.value})} />
        <button style={{ ...btn(), width:"100%" }} onClick={saveClient}> Cadastrar Cliente</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}> Clientes e saldos</div>
        {clients.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhum cliente cadastrado.</div>
        ) : clients.map(c=>{
          const saldo = clientBalance(c.id);
          const disponivel = c.limit>0 ? c.limit - saldo : null;
          return (
            <div key={c.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:"800", fontSize:"15px" }}>{c.name}</div>
                  <div style={{ color:"#94a3b8", fontSize:"12px" }}>{c.phone || "Sem WhatsApp"}</div>
                  {c.limit>0 && <div style={{ color:"#64748b", fontSize:"12px" }}>Limite: {fmtCur(c.limit)} | Disponivel: {fmtCur(disponivel)}</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:saldo>0?"#e94560":"#16a34a", fontSize:"16px" }}>{fmtCur(saldo)}</div>
                  <div style={{ color:"#94a3b8", fontSize:"11px" }}>{saldo>0?"em aberto":"sem debito"}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:"6px", marginTop:"8px", flexWrap:"wrap" }}>
                <button style={btnSm("#6366f1")} onClick={()=>setSelectedClientHistory(c)}>Historico</button>
                <button style={btnSm("#16a34a")} onClick={()=>cobrarWhatsApp(c)}>WhatsApp</button>
                <button style={btnSm("#64748b")} onClick={()=>deleteClient(c.id)}>Excluir</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}> Crediário em aberto</div>
        {fiadoSales.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhuma venda em crediário em aberto.</div>
        ) : fiadoSales.map(s=>{
          const pago = (s.fiado && s.fiado.paidAmount) || 0;
          const aberto = fiadoOpenAmount(s);
          const payments = (s.fiado && s.fiado.payments) || [];
          return (
            <div key={s.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
                <div>
                  <div style={{ fontWeight:"800" }}>#{s.id} - {s.fiado.clientName}</div>
                  <div style={{ color:"#94a3b8", fontSize:"12px" }}>{fmtDate(s.date)} {s.fiado.dueDate ? `- Vence: ${s.fiado.dueDate}` : ""}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", marginTop:"4px" }}>Compra: {fmtCur(s.total)} | Pago: {fmtCur(pago)}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:"#e94560" }}>{fmtCur(aberto)}</div>
                  <div style={{ color:"#94a3b8", fontSize:"11px" }}>saldo</div>
                </div>
              </div>
              {payments.length>0 && (
                <div style={{ marginTop:"8px", background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                  <div style={{ fontSize:"12px", fontWeight:"800", color:"#64748b", marginBottom:"4px" }}>Histórico de pagamentos</div>
                  {payments.map((p,i)=><div key={i} style={{ fontSize:"12px", color:"#64748b" }}>{fmtDate(p.date)} - {fmtCur(p.amount)}</div>)}
                </div>
              )}
              <div style={{ display:"flex", gap:"6px", marginTop:"8px", flexWrap:"wrap" }}>
                <button style={btnSm("#16a34a")} onClick={()=>openReceiveFiado(s.id)}>Receber</button>
                <button style={btnSm("#6366f1")} onClick={()=>{setSelectedSale(s);setShowReceipt(true);}}>Recibo</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );


  // --- Client history modal --------------------------------------------------
  const ClientHistoryModal = ({ client, onClose }) => {
    if (!client) return null;
    const historico = clientSales(client.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const saldo = clientBalance(client.id);
    const totalComprado = clientTotalBought(client.id);
    const totalPago = clientTotalPaid(client.id);
    const ticketMedio = historico.length ? totalComprado / historico.length : 0;
    const primeiraCompra = historico.length ? historico[historico.length-1].date : null;
    const ultimaCompra = historico.length ? historico[0].date : null;

    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:500, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
        <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"20px 16px 28px", width:"100%", maxWidth:"620px", maxHeight:"92vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
          <div style={{ width:"40px", height:"4px", background:"#e2e8f0", borderRadius:"4px", margin:"0 auto 16px" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px", marginBottom:"14px" }}>
            <div>
              <div style={{ fontSize:"22px", fontWeight:"900", color:"#1a1a2e" }}>{client.name}</div>
              <div style={{ color:"#64748b", fontSize:"13px" }}>{client.phone || "Sem WhatsApp"}</div>
              {client.limit>0 && <div style={{ color:"#64748b", fontSize:"13px" }}>Limite: {fmtCur(client.limit)}</div>}
            </div>
            <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", borderRadius:"50%", width:"34px", height:"34px", cursor:"pointer", fontSize:"16px", fontWeight:"800" }}>x</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
            <div style={{ background:"#fef2f2", borderRadius:"12px", padding:"12px" }}>
              <div style={{ fontSize:"11px", color:"#991b1b", fontWeight:"800" }}>Saldo em aberto</div>
              <div style={{ fontSize:"19px", fontWeight:"900", color:"#dc2626" }}>{fmtCur(saldo)}</div>
            </div>
            <div style={{ background:"#f0fdf4", borderRadius:"12px", padding:"12px" }}>
              <div style={{ fontSize:"11px", color:"#166534", fontWeight:"800" }}>Total pago</div>
              <div style={{ fontSize:"19px", fontWeight:"900", color:"#16a34a" }}>{fmtCur(totalPago)}</div>
            </div>
            <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"12px" }}>
              <div style={{ fontSize:"11px", color:"#1d4ed8", fontWeight:"800" }}>Total comprado</div>
              <div style={{ fontSize:"19px", fontWeight:"900", color:"#2563eb" }}>{fmtCur(totalComprado)}</div>
            </div>
            <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px" }}>
              <div style={{ fontSize:"11px", color:"#475569", fontWeight:"800" }}>Ticket medio</div>
              <div style={{ fontSize:"19px", fontWeight:"900", color:"#334155" }}>{fmtCur(ticketMedio)}</div>
            </div>
          </div>

          <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
            <div style={{ fontWeight:"800", fontSize:"14px", marginBottom:"6px" }}>Resumo</div>
            <div style={{ fontSize:"13px", color:"#64748b" }}>Compras fiadas: <strong>{historico.length}</strong></div>
            <div style={{ fontSize:"13px", color:"#64748b" }}>Primeira compra: <strong>{primeiraCompra ? fmtDate(primeiraCompra) : "-"}</strong></div>
            <div style={{ fontSize:"13px", color:"#64748b" }}>Ultima compra: <strong>{ultimaCompra ? fmtDate(ultimaCompra) : "-"}</strong></div>
            {client.limit>0 && <div style={{ fontSize:"13px", color:(client.limit - saldo)<0?"#dc2626":"#64748b" }}>Limite disponivel: <strong>{fmtCur(client.limit - saldo)}</strong></div>}
          </div>

          <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
            <button style={{ ...btn("#16a34a"), flex:1 }} onClick={()=>cobrarWhatsApp(client)}>WhatsApp</button>
            <button style={{ ...btn("#64748b"), flex:1 }} onClick={onClose}>Fechar</button>
          </div>

          <div style={{ fontWeight:"900", fontSize:"16px", marginBottom:"10px" }}>Historico de compras e pagamentos</div>
          {historico.length===0 ? (
            <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma compra fiada para este cliente.</div>
          ) : historico.map(s=>{
            const pago = (s.fiado && s.fiado.paidAmount) || 0;
            const aberto = fiadoOpenAmount(s);
            const payments = (s.fiado && s.fiado.payments) || [];
            const quitado = aberto <= 0.001;
            return (
              <div key={s.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:quitado?"#f8fafc":"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:"900" }}>Venda #{s.id}</div>
                    <div style={{ color:"#64748b", fontSize:"12px" }}>{fmtDate(s.date)} {s.fiado.dueDate ? `- Vence: ${s.fiado.dueDate}` : ""}</div>
                    <div style={{ color:"#64748b", fontSize:"12px", marginTop:"4px" }}>Compra: {fmtCur(s.total)} | Pago: {fmtCur(pago)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:"900", color:quitado?"#16a34a":"#e94560" }}>{quitado ? "Quitado" : fmtCur(aberto)}</div>
                    <div style={{ fontSize:"11px", color:"#94a3b8" }}>{quitado ? "sem saldo" : "em aberto"}</div>
                  </div>
                </div>

                {s.items && s.items.length>0 && (
                  <div style={{ marginTop:"8px", background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                    <div style={{ fontSize:"12px", fontWeight:"800", color:"#64748b", marginBottom:"4px" }}>Itens</div>
                    {s.items.map((it,i)=><div key={i} style={{ fontSize:"12px", color:"#64748b" }}>{it.qty}x {it.name} - {fmtCur(it.price*it.qty)}</div>)}
                  </div>
                )}

                {payments.length>0 && (
                  <div style={{ marginTop:"8px", background:"#f0fdf4", borderRadius:"10px", padding:"8px" }}>
                    <div style={{ fontSize:"12px", fontWeight:"800", color:"#166534", marginBottom:"4px" }}>Pagamentos</div>
                    {payments.map((p,i)=><div key={i} style={{ fontSize:"12px", color:"#166534" }}>{fmtDate(p.date)} - {fmtCur(p.amount)} {p.method ? `via ${p.method}` : ""}</div>)}
                  </div>
                )}

                {!quitado && (
                  <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}>
                    <button style={btnSm("#16a34a")} onClick={()=>openReceiveFiado(s.id)}>Receber</button>
                    <button style={btnSm("#6366f1")} onClick={()=>{setSelectedSale(s);setShowReceipt(true);}}>Recibo</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };



  const MasterPanel = () => {
    const [masterRows, setMasterRows] = useState([]);
    const [masterLicenses, setMasterLicenses] = useState([]);
    const [masterLoading, setMasterLoading] = useState(false);
    const [masterMsg, setMasterMsg] = useState("");
    const [masterSelected, setMasterSelected] = useState(null);
    const masterLoadedOnce = useRef(false);

    const safeArr = (obj, key) => Array.isArray(obj?.[key]) ? obj[key] : [];
    const safeData = (row) => row?.data || {};

    const rowSummary = (row) => {
      const data = safeData(row);
      const productsList = safeArr(data, "erpmini_products");
      const clientsList = safeArr(data, "erpmini_clients");
      const salesList = safeArr(data, "erpmini_sales");
      const receivablesList = safeArr(data, "erpmini_receivables");
      const store = data.erpmini_storename || "Sem nome";
      const totalSold = salesList.reduce((sum,s)=>sum+(Number(s.total)||0),0);
      const todayKey = new Date().toISOString().slice(0,10);
      const salesToday = salesList.filter(s=>String(s.date||"").slice(0,10)===todayKey);
      const totalToday = salesToday.reduce((sum,s)=>sum+(Number(s.total)||0),0);
      const credOpenSales = salesList
        .filter(s=>s.fiado && !s.fiado.paid)
        .reduce((sum,s)=>sum+Math.max(0,(Number(s.total)||0)-(Number(s.fiado?.paidAmount)||0)),0);
      const credOpenReceivables = receivablesList
        .filter(r=>!r.paid)
        .reduce((sum,r)=>sum+Math.max(0,(Number(r.amount)||0)-(Number(r.paidAmount)||0)),0);
      const lowStock = productsList.filter(p=>(Number(p.stock)||0)<=5).length;
      const license = masterLicenses.find(l=>String(l.email||"").toLowerCase()===String(row.user_id||"").toLowerCase());

      return {
        store,
        products: productsList,
        clients: clientsList,
        sales: salesList,
        receivables: receivablesList,
        totalSold,
        totalToday,
        salesToday: salesToday.length,
        credOpen: credOpenSales || credOpenReceivables,
        lowStock,
        license,
        lastSync: row.updated_at || data.__saved_at || ""
      };
    };

    const loadMaster = async () => {
      if (!isPlatformAdmin) {
        setMasterMsg("Acesso negado: painel visível somente para Pablo.");
        return;
      }

      setMasterLoading(true);
      setMasterMsg("Buscando dados no Supabase...");

      try {
        const cloudResp = await supabase
          .from(CLOUD_TABLE)
          .select("user_id,data,updated_at")
          .order("updated_at", { ascending:false });

        if (cloudResp.error) {
          setMasterRows([]);
          setMasterLicenses([]);
          setMasterMsg("Erro ao carregar lojas: " + cloudResp.error.message);
          return;
        }

        const licResp = await supabase
          .from("erpmini_licenses")
          .select("email,status,expires_at,plan,notes,updated_at");

        if (licResp.error) {
          setMasterRows(cloudResp.data || []);
          setMasterLicenses([]);
          setMasterMsg(`Lojas carregadas: ${(cloudResp.data || []).length}. Erro ao carregar licenças: ${licResp.error.message}`);
          return;
        }

        setMasterRows(cloudResp.data || []);
        setMasterLicenses(licResp.data || []);
        setMasterMsg(`Carregado: ${(cloudResp.data || []).length} loja(s) sincronizada(s) e ${(licResp.data || []).length} licença(s).`);
      } catch (err) {
        setMasterRows([]);
        setMasterLicenses([]);
        setMasterMsg("Erro inesperado ao carregar Painel Master: " + (err?.message || String(err)));
      } finally {
        setMasterLoading(false);
      }
    };

    useEffect(() => {
      // Carregamento manual: clique em Atualizar.
      // Evita a tela de Configurações ficar piscando/pulando.
    }, []);

    const totals = masterRows.reduce((acc,row)=>{
      const s = rowSummary(row);
      acc.products += s.products.length;
      acc.clients += s.clients.length;
      acc.sales += s.sales.length;
      acc.total += s.totalSold;
      acc.today += s.totalToday;
      acc.credOpen += s.credOpen;
      return acc;
    }, { products:0, clients:0, sales:0, total:0, today:0, credOpen:0 });

    const selectedSummary = masterSelected ? rowSummary(masterSelected) : null;

    return (
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <div>
            <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a" }}>Painel Master ERPmini</div>
            <div style={{ fontSize:"12px", color:"#64748b", fontWeight:"700" }}>Somente leitura. Visível apenas para Pablo.</div>
          </div>
          <button style={{ ...btn("#0f172a"), padding:"9px 12px", fontSize:"12px" }} onClick={()=>loadMaster()} disabled={masterLoading}>
            {masterLoading ? "Carregando..." : "Atualizar"}
          </button>
        </div>

        {masterMsg && (
          <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", color:"#9a3412", borderRadius:"12px", padding:"10px", fontSize:"12px", fontWeight:"800", marginBottom:"12px" }}>
            {masterMsg}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)", gap:"8px", marginBottom:"12px" }}>
          {[
            ["Lojas", masterRows.length, "#2563eb"],
            ["Produtos", totals.products, "#16a34a"],
            ["Clientes", totals.clients, "#7c3aed"],
            ["Vendas", totals.sales, "#e94560"],
            ["Vendido", fmtCur(totals.total), "#0f172a"],
          ].map(([l,v,c],i)=>(
            <div key={i} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#64748b", fontWeight:"900" }}>{l}</div>
              <div style={{ fontSize:String(v).length>10?"15px":"20px", color:c, fontWeight:"900", marginTop:"3px" }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
          <div style={{ background:"#ecfdf5", border:"1px solid #bbf7d0", borderRadius:"14px", padding:"12px" }}>
            <div style={{ fontSize:"12px", color:"#166534", fontWeight:"900" }}>Vendas hoje</div>
            <div style={{ fontSize:"22px", color:"#16a34a", fontWeight:"900" }}>{fmtCur(totals.today)}</div>
          </div>
          <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"14px", padding:"12px" }}>
            <div style={{ fontSize:"12px", color:"#9a3412", fontWeight:"900" }}>Crediário em aberto</div>
            <div style={{ fontSize:"22px", color:"#f97316", fontWeight:"900" }}>{fmtCur(totals.credOpen)}</div>
          </div>
        </div>

        {masterRows.length === 0 ? (
          <div style={{ color:"#94a3b8", fontWeight:"800", textAlign:"center", padding:"18px 0" }}>
            Clique em Atualizar. Se não aparecerem lojas, o Supabase pode estar bloqueando a leitura pela política RLS.
          </div>
        ) : (
          <div style={{ display:"grid", gap:"10px" }}>
            {masterRows.map(row=>{
              const s = rowSummary(row);
              return (
                <div key={row.user_id} style={{ border:"1px solid #e2e8f0", borderRadius:"14px", padding:"12px", background:"#fff" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:"900", color:"#0f172a" }}>{s.store}</div>
                      <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700", wordBreak:"break-word" }}>{row.user_id}</div>
                      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"7px" }}>
                        <span style={{ background:"#eff6ff", color:"#2563eb", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{s.products.length} produto(s)</span>
                        <span style={{ background:"#f5f3ff", color:"#7c3aed", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{s.clients.length} cliente(s)</span>
                        <span style={{ background:"#fdf2f8", color:"#e94560", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{s.sales.length} venda(s)</span>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(s.totalSold)}</div>
                      <div style={{ color:"#94a3b8", fontSize:"11px", fontWeight:"800" }}>{s.license?.plan || "sem plano"}</div>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"7px", marginTop:"10px" }}>
                    <div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                      <div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Hoje</div>
                      <div style={{ fontWeight:"900" }}>{fmtCur(s.totalToday)}</div>
                    </div>
                    <div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                      <div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Crediário</div>
                      <div style={{ fontWeight:"900" }}>{fmtCur(s.credOpen)}</div>
                    </div>
                    <div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                      <div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Est. baixo</div>
                      <div style={{ fontWeight:"900" }}>{s.lowStock}</div>
                    </div>
                    <div style={{ background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                      <div style={{ fontSize:"10px", color:"#64748b", fontWeight:"900" }}>Última sync</div>
                      <div style={{ fontWeight:"900", fontSize:"11px" }}>{s.lastSync ? fmtDate(s.lastSync) : "-"}</div>
                    </div>
                  </div>

                  <button style={{ ...btnSm("#6366f1"), marginTop:"10px", width:"100%" }} onClick={()=>setMasterSelected(masterSelected?.user_id===row.user_id ? null : row)}>
                    {masterSelected?.user_id===row.user_id ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>

                  {masterSelected?.user_id===row.user_id && selectedSummary && (
                    <div style={{ marginTop:"10px", background:"#f8fafc", borderRadius:"12px", padding:"10px" }}>
                      <div style={{ fontWeight:"900", marginBottom:"8px" }}>Detalhes da loja</div>

                      <div style={{ fontWeight:"900", color:"#334155", margin:"8px 0 5px" }}>Últimas vendas</div>
                      {selectedSummary.sales.slice(0,5).map(sale=>(
                        <div key={sale.id} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"6px 0", fontSize:"12px" }}>
                          <span>#{sale.id} - {fmtDate(sale.date)}</span>
                          <strong>{fmtCur(Number(sale.total)||0)}</strong>
                        </div>
                      ))}
                      {selectedSummary.sales.length===0 && <div style={{ color:"#94a3b8", fontSize:"12px" }}>Sem vendas.</div>}

                      <div style={{ fontWeight:"900", color:"#334155", margin:"10px 0 5px" }}>Produtos</div>
                      {selectedSummary.products.slice(0,6).map(p=>(
                        <div key={p.id || p.barcode || p.name} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"5px 0", fontSize:"12px" }}>
                          <span>{p.name}</span>
                          <strong>{p.stock ?? 0} un.</strong>
                        </div>
                      ))}
                      {selectedSummary.products.length===0 && <div style={{ color:"#94a3b8", fontSize:"12px" }}>Sem produtos.</div>}

                      <div style={{ fontWeight:"900", color:"#334155", margin:"10px 0 5px" }}>Clientes</div>
                      {selectedSummary.clients.slice(0,6).map(c=>(
                        <div key={c.id || c.phone || c.name} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"5px 0", fontSize:"12px" }}>
                          <span>{c.name}</span>
                          <strong>{c.phone || "-"}</strong>
                        </div>
                      ))}
                      {selectedSummary.clients.length===0 && <div style={{ color:"#94a3b8", fontSize:"12px" }}>Sem clientes.</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };


  const AdminLicensesPanel = () => {
    const [licenses, setLicenses] = useState([]);
    const [signupRequests, setSignupRequests] = useState([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminMsg, setAdminMsg] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newExpires, setNewExpires] = useState(() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    });
    const [newPlan, setNewPlan] = useState("mensal");
    const [newNotes, setNewNotes] = useState("");
    const adminLoadedOnce = useRef(false);

    const loadLicenses = async () => {
      if (!isPlatformAdmin) {
        setAdminMsg("Acesso negado: administração visível somente para Pablo.");
        return;
      }

      setAdminLoading(true);
      setAdminMsg("Buscando licenças no Supabase...");

      try {
        const { data, error } = await supabase
          .from("erpmini_licenses")
          .select("email,status,expires_at,plan,notes,created_at,updated_at")
          .order("expires_at", { ascending: true });

        if (error) {
          setLicenses([]);
          setSignupRequests([]);
          setAdminMsg("Erro ao carregar licenças: " + error.message);
          return;
        }

        let requests = [];
        try {
          requests = await fetchSignupRequests();
        } catch (reqError) {
          setLicenses(data || []);
          setSignupRequests([]);
          setAdminMsg(`Licenças carregadas: ${(data || []).length}. Erro nas solicitações: ${reqError.message}`);
          return;
        }

        setLicenses(data || []);
        setSignupRequests(requests || []);
        setAdminMsg(`Carregado: ${(data || []).length} licença(s) e ${(requests || []).length} solicitação(ões).`);
      } catch (err) {
        setLicenses([]);
        setSignupRequests([]);
        setAdminMsg("Erro inesperado ao carregar licenças: " + (err?.message || String(err)));
      } finally {
        setAdminLoading(false);
      }
    };

    useEffect(() => {
      // Carregamento manual: clique em Atualizar.
      // Evita a tela de Configurações ficar piscando/pulando.
    }, []);

    const saveLicense = async (payload) => {
      setAdminLoading(true);
      setAdminMsg("");
      const { error } = await supabase
        .from("erpmini_licenses")
        .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "email" });
      setAdminLoading(false);
      if (error) {
        setAdminMsg("Erro ao salvar licenca: " + error.message);
        return false;
      }
      setAdminMsg("Licenca salva com sucesso.");
      await loadLicenses();
      return true;
    };

    const createLicense = async () => {
      const email = newEmail.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        setAdminMsg("Informe um e-mail valido.");
        return;
      }
      if (normalizePlan(newPlan) !== "starter" && !newExpires) {
        setAdminMsg("Informe a data de vencimento para plano pago.");
        return;
      }
      const ok = await saveLicense({
        email,
        status: "ativo",
        expires_at: normalizePlan(newPlan) === "starter" ? null : newExpires,
        plan: normalizePlan(newPlan || "starter"),
        notes: newNotes || null,
      });
      if (ok) {
        setNewEmail("");
        setNewNotes("");
      }
    };

    const setStatus = async (lic, status) => {
      await saveLicense({
        email: lic.email,
        status,
        expires_at: lic.expires_at,
        plan: lic.plan || "mensal",
        notes: lic.notes || null,
      });
    };

    const extendLicense = async (lic, months = 1) => {
      const base = new Date((lic.expires_at || new Date().toISOString().slice(0,10)) + "T00:00:00");
      const today = new Date();
      today.setHours(0,0,0,0);
      const startDate = base < today ? today : base;
      startDate.setMonth(startDate.getMonth() + months);
      await saveLicense({
        email: lic.email,
        status: "ativo",
        expires_at: startDate.toISOString().slice(0, 10),
        plan: lic.plan || "mensal",
        notes: lic.notes || null,
      });
    };

    const changeExpires = async (lic, value) => {
      if (!value) return;
      await saveLicense({
        email: lic.email,
        status: lic.status || "ativo",
        expires_at: value,
        plan: lic.plan || "mensal",
        notes: lic.notes || null,
      });
    };

    const approveSignupRequest = async (email) => {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!cleanEmail) return;

      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);
      const expiresAt = expires.toISOString().slice(0, 10);

      setAdminLoading(true);
      setAdminMsg("");

      const { error } = await supabase
        .from("erpmini_licenses")
        .upsert({
          email: cleanEmail,
          status: "ativo",
          expires_at: expiresAt,
          plan: "mensal",
          notes: "Aprovado pelo painel Admin.",
          updated_at: new Date().toISOString()
        }, { onConflict: "email" });

      if (error) {
        setAdminLoading(false);
        setAdminMsg("Erro ao aprovar solicitacao: " + error.message);
        return;
      }

      await markSignupRequestApproved(cleanEmail);
      setAdminMsg("Acesso aprovado com sucesso.");
      await loadLicenses();
      setAdminLoading(false);
    };

    const rejectSignupRequest = async (email) => {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!cleanEmail) return;

      setAdminLoading(true);
      setAdminMsg("");
      await markSignupRequestRejected(cleanEmail);
      setAdminMsg("Solicitacao recusada.");
      await loadLicenses();
      setAdminLoading(false);
    };

    const todayStr = new Date().toISOString().slice(0,10);
    const activeLicenses = licenses.filter(l => (l.status || "").toLowerCase() === "ativo" && l.expires_at >= todayStr);
    const expiredLicenses = licenses.filter(l => l.expires_at && l.expires_at < todayStr);
    const activeCount = activeLicenses.length;
    const blockedCount = licenses.filter(l => (l.status || "").toLowerCase() !== "ativo" || l.expires_at < todayStr).length;
    const pendingRequests = signupRequests.filter(r => (r.status || "").toLowerCase() === "pendente");
    const pendingCount = pendingRequests.length;

    const todayDate = new Date(todayStr + "T00:00:00");
    const inSevenDays = new Date(todayDate);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const expiringSoon = activeLicenses.filter((lic) => {
      if (!lic.expires_at) return false;
      const exp = new Date(lic.expires_at + "T00:00:00");
      return exp >= todayDate && exp <= inSevenDays;
    });

    const planPrices = {
      mensal: 29.90,
      trimestral: 79.90,
      anual: 299.00,
      teste: 0
    };

    const planMonthlyValue = (plan) => {
      const p = String(plan || "mensal").toLowerCase();
      if (p === "trimestral") return (planPrices.trimestral || 0) / 3;
      if (p === "anual") return (planPrices.anual || 0) / 12;
      return planPrices[p] ?? planPrices.mensal;
    };

    const mrrEstimate = activeLicenses.reduce((sum, lic) => sum + planMonthlyValue(lic.plan), 0);
    const annualEstimate = mrrEstimate * 12;

    const setLicensePlan = async (email, plan) => {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!cleanEmail) return;

      const p = normalizePlan(plan);
      let expiresAt = null;

      if (p === "pro") {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        expiresAt = d.toISOString().slice(0, 10);
      }

      if (p === "premium") {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        expiresAt = d.toISOString().slice(0, 10);
      }

      setAdminLoading(true);
      setAdminMsg("");

      const { error } = await supabase
        .from("erpmini_licenses")
        .upsert({
          email: cleanEmail,
          status: "ativo",
          plan: p,
          expires_at: expiresAt,
          notes: p === "starter" ? "Plano Starter gratuito sem vencimento." : `Plano ${p} liberado pelo painel Admin.`,
          updated_at: new Date().toISOString()
        }, { onConflict: "email" });

      if (error) {
        setAdminMsg("Erro ao alterar plano: " + error.message);
        setAdminLoading(false);
        return;
      }

      setAdminMsg("Plano atualizado com sucesso.");
      await loadLicenses();
      setAdminLoading(false);
    };

    const planLabel = (plan) => {
      const p = normalizePlan(plan);
      if (p === "starter") return "Starter gratis";
      if (p === "pro") return "Pro mensal";
      if (p === "premium") return "Premium anual";
      return p;
    };

    return (
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <div>
            <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a" }}>Admin Licencas</div>
            <div style={{ fontSize:"12px", color:"#64748b" }}>Visivel somente para Pablo.</div>
          </div>
          <button style={{ ...btn("#2563eb"), padding:"9px 12px", fontSize:"12px" }} onClick={()=>loadLicenses()} disabled={adminLoading}>
            Atualizar
          </button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:"8px", marginBottom:"12px" }}>
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"12px", padding:"10px" }}>
            <div style={{ fontSize:"11px", color:"#166534", fontWeight:"800" }}>Ativas</div>
            <div style={{ fontSize:"22px", fontWeight:"900", color:"#16a34a" }}>{activeCount}</div>
          </div>
          <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"12px", padding:"10px" }}>
            <div style={{ fontSize:"11px", color:"#9a3412", fontWeight:"800" }}>Bloqueadas/vencidas</div>
            <div style={{ fontSize:"22px", fontWeight:"900", color:"#f97316" }}>{blockedCount}</div>
          </div>
          <div style={{ background:pendingCount>0?"#fef2f2":"#eff6ff", border:`1px solid ${pendingCount>0?"#fecaca":"#bfdbfe"}`, borderRadius:"12px", padding:"10px" }}>
            <div style={{ fontSize:"11px", color:pendingCount>0?"#991b1b":"#1d4ed8", fontWeight:"800" }}>Pendentes</div>
            <div style={{ fontSize:"22px", fontWeight:"900", color:pendingCount>0?"#dc2626":"#2563eb" }}>{pendingCount}</div>
          </div>
        </div>

        <div style={{ background:"#0f172a", border:"1.5px solid #1e293b", borderRadius:"16px", padding:"14px", marginBottom:"12px", color:"#fff" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
            <div>
              <div style={{ fontWeight:"900", fontSize:"15px" }}>Dashboard Administrativo</div>
              <div style={{ fontSize:"12px", color:"#cbd5e1" }}>Resumo comercial do ERPmini</div>
            </div>
            {pendingCount > 0 && (
              <span style={{ borderRadius:"999px", background:"#dc2626", color:"#fff", fontWeight:"900", padding:"5px 9px", fontSize:"12px" }}>
                {pendingCount} pendente(s)
              </span>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4, 1fr)", gap:"8px" }}>
            <div style={{ background:"#172554", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#bfdbfe", fontWeight:"800" }}>Receita mensal estimada</div>
              <div style={{ fontSize:"18px", fontWeight:"900" }}>{fmtCur(mrrEstimate)}</div>
            </div>
            <div style={{ background:"#052e16", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#bbf7d0", fontWeight:"800" }}>Receita anual estimada</div>
              <div style={{ fontSize:"18px", fontWeight:"900" }}>{fmtCur(annualEstimate)}</div>
            </div>
            <div style={{ background:"#431407", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#fed7aa", fontWeight:"800" }}>Vencem em 7 dias</div>
              <div style={{ fontSize:"18px", fontWeight:"900" }}>{expiringSoon.length}</div>
            </div>
            <div style={{ background:"#450a0a", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#fecaca", fontWeight:"800" }}>Vencidas</div>
              <div style={{ fontSize:"18px", fontWeight:"900" }}>{expiredLicenses.length}</div>
            </div>
          </div>

          {(expiringSoon.length > 0 || expiredLicenses.length > 0) && (
            <div style={{ marginTop:"10px", display:"grid", gap:"8px" }}>
              {expiringSoon.slice(0,3).map((lic) => (
                <div key={"soon-"+lic.email} style={{ background:"#fff7ed", color:"#9a3412", borderRadius:"10px", padding:"8px 10px", fontSize:"12px", fontWeight:"800" }}>
                  Vence em breve: {lic.email} - {lic.expires_at}
                </div>
              ))}
              {expiredLicenses.slice(0,3).map((lic) => (
                <div key={"expired-"+lic.email} style={{ background:"#fef2f2", color:"#991b1b", borderRadius:"10px", padding:"8px 10px", fontSize:"12px", fontWeight:"800" }}>
                  Licenca vencida: {lic.email} - {lic.expires_at}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:pendingCount>0?"#fff7ed":"#f8fafc", border:`1.5px solid ${pendingCount>0?"#fed7aa":"#e2e8f0"}`, borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
            <div style={{ fontWeight:"900", fontSize:"14px", color:"#334155" }}>Solicitacoes pendentes</div>
            {pendingCount > 0 && <span style={{ borderRadius:"999px", background:"#dc2626", color:"#fff", fontWeight:"900", padding:"4px 9px", fontSize:"12px" }}>{pendingCount}</span>}
          </div>

          {pendingCount === 0 ? (
            <div style={{ color:"#64748b", fontSize:"13px", fontWeight:"700" }}>Clique em Atualizar para carregar solicitações e licenças.</div>
          ) : (
            <div style={{ display:"grid", gap:"10px" }}>
              {pendingRequests.map((r) => (
                <div key={r.email} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}>
                  <div style={{ fontWeight:"900", color:"#0f172a", wordBreak:"break-all" }}>{r.email}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700", marginBottom:"8px" }}>
                    Aguardando aprovacao desde {r.created_at ? fmtDate(r.created_at) : "-"}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                    <button style={{ ...btn("#16a34a"), padding:"9px", fontSize:"12px" }} onClick={()=>approveSignupRequest(r.email)} disabled={adminLoading}>Aprovar</button>
                    <button style={{ ...btn("#ef4444"), padding:"9px", fontSize:"12px" }} onClick={()=>rejectSignupRequest(r.email)} disabled={adminLoading}>Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"900", fontSize:"14px", marginBottom:"8px", color:"#334155" }}>Liberar novo acesso</div>
          <input style={{ ...inp, marginBottom:"8px" }} value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="email@cliente.com" />
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
            <input style={inp} type="date" value={newExpires} onChange={e=>setNewExpires(e.target.value)} />
            <select style={inp} value={newPlan} onChange={e=>setNewPlan(e.target.value)}>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
              <option value="teste">Teste</option>
            </select>
          </div>
          <input style={{ ...inp, marginBottom:"8px" }} value={newNotes} onChange={e=>setNewNotes(e.target.value)} placeholder="Observacao opcional" />
          <button style={{ ...btn("#16a34a"), width:"100%" }} onClick={createLicense} disabled={adminLoading}>
            Liberar acesso
          </button>
        </div>

        {adminMsg && (
          <div style={{ background:adminMsg.startsWith("Erro")?"#fef2f2":"#f0fdf4", border:`1.5px solid ${adminMsg.startsWith("Erro")?"#fecaca":"#bbf7d0"}`, color:adminMsg.startsWith("Erro")?"#991b1b":"#166534", borderRadius:"12px", padding:"10px", fontSize:"13px", fontWeight:"800", marginBottom:"12px" }}>
            {adminMsg}
          </div>
        )}

        <div style={{ display:"grid", gap:"10px" }}>
          {adminLoading && licenses.length === 0 ? (
            <div style={{ color:"#64748b", fontSize:"13px" }}>Carregando licencas...</div>
          ) : licenses.length === 0 ? (
            <div style={{ color:"#64748b", fontSize:"13px" }}>Nenhuma licenca cadastrada.</div>
          ) : licenses.map((lic) => {
            const isExpired = lic.expires_at < todayStr;
            const isActive = (lic.status || "").toLowerCase() === "ativo" && !isExpired;
            return (
              <div key={lic.email} style={{ border:"1.5px solid #e2e8f0", borderRadius:"14px", padding:"12px", background:"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:"8px", alignItems:"flex-start", marginBottom:"8px" }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:"900", color:"#0f172a", wordBreak:"break-all" }}>{lic.email}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>Plano: {planLabel(lic.plan)}</div>
                  </div>
                  <span style={{ borderRadius:"999px", padding:"5px 9px", fontSize:"11px", fontWeight:"900", color:isActive?"#166534":"#991b1b", background:isActive?"#dcfce7":"#fee2e2", whiteSpace:"nowrap" }}>
                    {isActive ? "Ativo" : isExpired ? "Vencido" : "Bloqueado"}
                  </span>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", alignItems:"center", marginBottom:"8px" }}>
                  {normalizePlan(lic.plan) === "starter" ? (
                    <div style={{ fontSize:"12px", color:"#16a34a", fontWeight:"900", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"12px", padding:"10px" }}>
                      Vencimento: sem vencimento no Starter gratis
                    </div>
                  ) : (
                    <label style={{ fontSize:"12px", color:"#64748b", fontWeight:"800" }}>
                      Vencimento
                      <input style={{ ...inp, marginTop:"4px" }} type="date" value={lic.expires_at || ""} onChange={e=>changeExpires(lic, e.target.value)} />
                    </label>
                  )}
                  <div style={{ fontSize:"12px", color:"#64748b" }}>
                    Observacao: {lic.notes || "-"}
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)", gap:"6px" }}>
                  <button style={{ ...btn("#16a34a"), padding:"9px", fontSize:"12px" }} onClick={()=>setStatus(lic,"ativo")}>Liberar</button>
                  <button style={{ ...btn("#ef4444"), padding:"9px", fontSize:"12px" }} onClick={()=>setStatus(lic,"bloqueado")}>Bloquear</button>
                  <button style={{ ...btn("#64748b"), padding:"9px", fontSize:"12px" }} onClick={()=>setLicensePlan(lic.email,"starter")}>Starter gratis</button>
                  <button style={{ ...btn("#2563eb"), padding:"9px", fontSize:"12px" }} onClick={()=>setLicensePlan(lic.email,"pro")}>Pro mensal</button>
                  <button style={{ ...btn("#7c3aed"), padding:"9px", fontSize:"12px" }} onClick={()=>setLicensePlan(lic.email,"premium")}>Premium anual</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Fiscal tab -------------------------------------------------------------
  const FiscalTab = () => {
    const fiscalDocs = sales.map(s=>({
      id:s.id,
      numero:`NFC-e ${String(s.id).padStart(6,"0")}`,
      destinatario:s.fiado?.clientName || "Consumidor Final",
      tipo:s.fiado?.clientName ? "NF-e" : "NFC-e",
      valor:s.total,
      status:s.statusFiscal || "Preparar"
    })).slice(0,20);
    const nfceCount = fiscalDocs.filter(d=>d.tipo==="NFC-e").length;
    const nfeCount = fiscalDocs.filter(d=>d.tipo==="NF-e").length;
    const canceladas = fiscalDocs.filter(d=>String(d.status).toLowerCase()==="cancelada").length;
    return (
      <div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:"12px", marginBottom:"14px" }}>
          {[
            ["NFC-e preparadas", nfceCount, "#16a34a"],
            ["NF-e preparadas", nfeCount, "#2563eb"],
            ["Canceladas", canceladas, "#ef4444"],
          ].map(([l,v,c],i)=>(
            <div key={i} style={{ background:"#fff", borderRadius:"14px", padding:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", gridColumn:i===2&&isMobile?"1 / -1":undefined }}>
              <div style={{ fontSize:"12px", color:"#64748b", fontWeight:"800" }}>{l}</div>
              <div style={{ fontSize:"24px", fontWeight:"900", color:c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"18px", marginBottom:"6px" }}>Fiscal NFC-e / NF-e</div>
          <div style={{ color:"#64748b", fontSize:"13px", fontWeight:"700", marginBottom:"12px" }}>
            Tela inicial para controle fiscal. Ainda nao transmite para SEFAZ.
          </div>
          <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", color:"#92400e", borderRadius:"12px", padding:"10px", fontSize:"12px", fontWeight:"800", marginBottom:"12px" }}>
            Para emitir de verdade vamos precisar integrar API fiscal e certificado A1 do cliente.
          </div>
          {fiscalDocs.length===0 ? (
            <p style={{ textAlign:"center", color:"#94a3b8", padding:"20px 0" }}>Nenhuma venda para preparar documento fiscal.</p>
          ) : fiscalDocs.map(d=>(
            <div key={d.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"10px", borderBottom:"1px solid #f1f5f9", padding:"10px 0" }}>
              <div>
                <div style={{ fontWeight:"900" }}>{d.numero} - {d.tipo}</div>
                <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>{d.destinatario}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:"900" }}>{fmtCur(d.valor)}</div>
                <span style={{ background:"#fef3c7", color:"#92400e", borderRadius:"999px", padding:"2px 8px", fontSize:"11px", fontWeight:"900" }}>{d.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Config tab -------------------------------------------------------------
  const ConfigTab = () => (
    <div>
      {isPlatformAdmin && <AdminLicensesPanel />}
      {isPlatformAdmin && <MasterPanel />}
      <div style={card}>
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"14px" }}>Config Configuracoes</div>
        <label style={{ fontSize:"13px", fontWeight:"600", color:"#64748b", marginBottom:"6px", display:"block" }}>Nome da Loja (aparece no comprovante)</label>
        <input style={{ ...inp, marginBottom:"14px" }} value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Minha Loja" />
        <PlanUsageCard plan={currentPlan} products={products} clients={clients} sales={sales} />
        <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"12px 14px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"900", fontSize:"14px", color:"#334155", marginBottom:"8px" }}>Status do sistema</div>
          <div style={{ display:"grid", gap:"6px", fontSize:"13px", color:"#64748b" }}>
            <div><strong>Nuvem:</strong> {cloudStatus || "Sincronizada"}</div>
            <div><strong>Licenca:</strong> ativa {licenseInfo?.license?.expires_at ? `ate ${licenseInfo.license.expires_at}` : ""}</div>
          </div>
          {onLogout && <button style={{ ...btn("#0f172a"), width:"100%", marginTop:"12px" }} onClick={onLogout}>Sair da conta</button>}
        </div>
        <div style={{ background:"#f0fdf4", border:"1.5px solid #22c55e", borderRadius:"10px", padding:"12px 14px", display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
          <span style={{ fontSize:"20px" }}>Salvo</span>
          <div>
            <div style={{ fontWeight:"700", fontSize:"13px", color:"#166534" }}>Salvamento automatico ativo</div>
            <div style={{ fontSize:"12px", color:"#4ade80" }}>Dados salvos no navegador deste dispositivo</div>
          </div>
        </div>
        <div style={{ background:license.configured?"#eff6ff":"#fff7ed", border:`1.5px solid ${license.configured?"#3b82f6":"#f59e0b"}`, borderRadius:"10px", padding:"12px 14px", display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
          <span style={{ fontSize:"20px" }}>{license.configured?"Licenca":"!"}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:"700", fontSize:"13px", color:license.configured?"#1d4ed8":"#92400e" }}>Licenca mensal</div>
            <div style={{ fontSize:"12px", color:license.configured?"#3b82f6":"#b45309" }}>{license.message}</div>
            <div style={{ fontSize:"11px", color:"#64748b", marginTop:"3px" }}>Chave: {activationKey || "nao ativada"}</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
          <button style={{ ...btn("#2563eb"), padding:"11px", fontSize:"13px" }} onClick={()=>refreshLicense()}>Atualizar Verificar licenca</button>
          <button style={{ ...btn("#64748b"), padding:"11px", fontSize:"13px" }} onClick={changeActivationKey}>Chave Trocar chave</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"8px" }}> Backup e restauracao</div>
        <div style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"800", color:"#1d4ed8", marginBottom:"4px" }}>Backup automatico diario ativo</div>
          <div style={{ fontSize:"12px", color:"#2563eb" }}>
            O ERP gera 1 backup por dia no primeiro acesso. O usuario tambem pode baixar um backup manual a qualquer momento.
          </div>
        </div>

        <input
          ref={backupImportRef}
          type="file"
          accept="application/json,.json"
          style={{ display:"none" }}
          onChange={e=>{ importBackupFile(e.target.files?.[0], false); e.target.value=""; }}
        />
        <input
          ref={adminBackupImportRef}
          type="file"
          accept="application/json,.json"
          style={{ display:"none" }}
          onChange={e=>{ importBackupFile(e.target.files?.[0], true); e.target.value=""; }}
        />

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
          <button style={{ ...btn("#16a34a"), padding:"11px", fontSize:"13px" }} onClick={()=>createBackup("manual", true)}> Fazer backup agora</button>
          <button style={{ ...btn("#2563eb"), padding:"11px", fontSize:"13px" }} onClick={restoreLatestBackup}> Restaurar ultimo backup</button>
        </div>

        <button style={{ ...btn("#64748b"), width:"100%", padding:"11px", fontSize:"13px", marginBottom:"8px" }} onClick={()=>backupImportRef.current?.click()}>
           Importar backup mais recente
        </button>

        <details style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px" }}>
          <summary style={{ fontWeight:"900", color:"#334155", cursor:"pointer" }}> Area ADM - versoes anteriores</summary>
          <div style={{ fontSize:"12px", color:"#64748b", margin:"8px 0" }}>
            Somente o ADM consegue restaurar backups antigos. Senha solicitada na hora da restauracao.
          </div>
          <button style={{ ...btn("#7c3aed"), width:"100%", padding:"10px", fontSize:"13px", marginBottom:"8px" }} onClick={()=>adminBackupImportRef.current?.click()}>
            Importar backup antigo
          </button>
          {(loadLS("erpmini_backup_history", []) || []).slice(1).length===0 ? (
            <div style={{ color:"#94a3b8", fontSize:"12px" }}>Nenhuma versao anterior salva neste aparelho.</div>
          ) : (loadLS("erpmini_backup_history", []) || []).slice(1).map((b,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", padding:"8px 0", borderTop:"1px solid #e2e8f0" }}>
              <div>
                <div style={{ fontWeight:"800", color:"#1a1a2e" }}>{fmtDate(b.createdAt)}</div>
                <div style={{ fontSize:"11px", color:"#64748b" }}>{b.mode==="auto" ? "Automatico" : "Manual"} - {b.appVersion}</div>
              </div>
              <button style={{ ...btn("#7c3aed"), padding:"7px 9px", fontSize:"12px" }} onClick={()=>restoreOldBackupFromHistory(b)}>Restaurar</button>
            </div>
          ))}
        </details>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"6px", color:"#ef4444" }}>! Zona de Perigo</div>
        <p style={{ fontSize:"13px", color:"#64748b", marginBottom:"14px" }}>Apaga todos os produtos, vendas e configuracoes salvos.</p>
        <button style={{ ...btn("#ef4444"), width:"100%" }} onClick={()=>setShowClearConfirm(true)}>Excluir Resetar todos os dados</button>
      </div>
    </div>
  );

  if (license.needsActivation) {
    return (
      <ActivationScreen
        value={activationInput}
        onChange={setActivationInput}
        onActivate={activateLicense}
        checking={license.loading}
        error={activationError}
      />
    );
  }

  if (license.loading) {
    return (
      <div style={{ minHeight:"100vh", background:"#f0f4f8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif" }}>
        <div style={{ background:"#fff", borderRadius:"16px", padding:"22px 26px", fontWeight:"800", color:"#1a1a2e", boxShadow:"0 8px 30px rgba(0,0,0,0.08)" }}>Licenca Verificando licenca...</div>
      </div>
    );
  }

  if (!license.active) return <LicenseBlockedScreen license={license} />;

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", background:"#f0f4f8", minHeight:"100vh", paddingBottom: isMobile?"80px":"0" }}>

      {/* Notification */}
      {notification && (
        <div style={{ position:"fixed", top:"16px", left:"50%", transform:"translateX(-50%)", zIndex:600,
          background:notification.type==="error"?"#ef4444":"#22c55e", color:"#fff", padding:"10px 20px",
          borderRadius:"40px", fontWeight:"700", fontSize:"14px", boxShadow:"0 4px 16px rgba(0,0,0,0.2)", whiteSpace:"nowrap" }}>
          {notification.msg}
        </div>
      )}

      {/* Offline / Sync status */}
      {showSyncBanner && !isOnline && (
        <div style={{
          position:"sticky",
          top:0,
          zIndex:70,
          background:!isOnline ? "#fff7ed" : syncingNow ? "#eff6ff" : "#fefce8",
          color:!isOnline ? "#9a3412" : syncingNow ? "#1d4ed8" : "#854d0e",
          borderBottom:"1px solid #fed7aa",
          padding:"8px 12px",
          textAlign:"center",
          fontSize:"12px",
          fontWeight:"900"
        }}>
          {!isOnline
            ? "Modo offline: seus dados ficam salvos neste aparelho."
            : "Sincronizando dados com a nuvem..."}
        </div>
      )}

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1a1a2e,#16213e)", color:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", gap:"10px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ fontSize:"20px", fontWeight:"800", letterSpacing:"1px" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
        <span style={{
          fontSize:"11px",
          background: stableSyncStatus==="offline"
            ? "rgba(249,115,22,0.22)"
            : stableSyncStatus==="syncing"
              ? "rgba(59,130,246,0.22)"
              : "rgba(34,197,94,0.2)",
          color: stableSyncStatus==="offline"
            ? "#fdba74"
            : stableSyncStatus==="syncing"
              ? "#bfdbfe"
              : "#86efac",
          borderRadius:"20px",
          padding:"2px 8px"
        }}>
          {stableSyncStatus==="offline" ? "Offline" : stableSyncStatus==="syncing" ? "Sincronizando" : "Salvo"}
        </span>
        <span style={{ fontSize:"10px", background:"rgba(255,255,255,0.12)", color:"#cbd5e1", borderRadius:"20px", padding:"2px 6px" }}>v-master4</span>
        <div style={{ marginLeft:"auto", fontWeight:"600", fontSize:"14px", color:"rgba(255,255,255,0.8)" }}>{storeName}</div>
        {/* Mobile cart button */}
        {isMobile && tab==="pdv" && (
          <button onClick={()=>setShowCart(true)}
            style={{ background:"#e94560", border:"none", borderRadius:"10px", padding:"8px 12px", cursor:"pointer", color:"#fff", fontWeight:"700", fontSize:"14px", position:"relative" }}>
            PDV
            {cartCount>0&&<span style={{ position:"absolute", top:"-6px", right:"-6px", background:"#fbbf24", color:"#000", borderRadius:"50%", width:"18px", height:"18px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"800" }}>{cartCount}</span>}
          </button>
        )}
      </div>

      {/* Desktop nav */}
      {!isMobile && (
        <div style={{ background:"#fff", borderBottom:"2px solid #e2e8f0", display:"flex", padding:"0 24px" }}>
          {NAV_ITEMS.map(({key,icon,label})=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{ padding:"12px 18px", border:"none", background:"transparent", cursor:"pointer", fontWeight:tab===key?"800":"600", color:tab===key?"#e94560":"#64748b", borderBottom:tab===key?"3px solid #e94560":"3px solid transparent", fontSize:"14px", transition:"all 0.2s", display:"flex", alignItems:"center", gap:"8px" }}>
              <NavIcon name={icon} active={tab===key} /> <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{ padding:isMobile?"12px":"24px", maxWidth:"1200px", margin:"0 auto" }}>
        {tab==="" && DashboardTab()}
        {tab==="pdv"     && hasPlanAccess("pdv", currentPlan, isPlatformAdmin) && PDVTab()}
        {tab==="estoque" && hasPlanAccess("estoque", currentPlan, isPlatformAdmin) && EstoqueTab()}
        {tab==="vendas" && HistoricoTab()}
        {tab==="caixa"   && hasPlanAccess("caixa", currentPlan, isPlatformAdmin) && CaixaTab()}
        {tab==="fiado"   && hasPlanAccess("cliente", currentPlan, isPlatformAdmin) && FiadoTab()}
        {tab==="fiscal"  && hasPlanAccess("fiscal", currentPlan, isPlatformAdmin) && FiscalTab()}
        {tab==="config"  && ConfigTab()}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #e5e7eb", display:"flex", zIndex:50, boxShadow:"0 -6px 24px rgba(15,23,42,0.10)", padding:"6px 4px 7px", paddingBottom:"calc(7px + env(safe-area-inset-bottom))" }}>
          {NAV_ITEMS.map(({key,icon,label})=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{ flex:1, padding:"4px 2px 2px", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"3px", minWidth:0 }}>
              <span style={{ width:"34px", height:"30px", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", background:tab===key?"#ffe4ea":"#f8fafc", transition:"all .2s" }}>
                <NavIcon name={icon} active={tab===key} />
              </span>
              <span style={{ fontSize:"10px", lineHeight:"12px", fontWeight:tab===key?"800":"600", color:tab===key?"#e94560":"#64748b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{label}</span>
              {tab===key&&<div style={{ width:"24px", height:"3px", background:"#e94560", borderRadius:"999px", marginTop:"1px" }} />}
            </button>
          ))}
        </div>
      )}

      {/* Mobile cart drawer */}
      {isMobile && showCart && CartDrawer()}

      {/* Client history */}
      {selectedClientHistory && <ClientHistoryModal client={selectedClientHistory} onClose={()=>setSelectedClientHistory(null)} />}

      {/* Checkout */}
      {showCheckout && <CheckoutScreen
        cart={cart}
        total={total}
        clients={clients.map(c=>({...c,currentBalance:clientBalance(c.id)}))}
        onCancel={()=>setShowCheckout(false)}
        onConfirm={handleCheckoutConfirm}
      />}

      {showFiadoReceive && selectedFiadoSale && (
        <CheckoutScreen
          cart={[]}
          total={fiadoOpenAmount(selectedFiadoSale)}
          mode="receiveFiado"
          receiveInfo={{ saleId:selectedFiadoSale.id, clientName:selectedFiadoSale.fiado.clientName, dueDate:selectedFiadoSale.fiado.dueDate }}
          onCancel={()=>{setShowFiadoReceive(false);setSelectedFiadoSale(null);}}
          onConfirm={handleFiadoReceiveConfirm}
        />
      )}

      {selectedReceivable && (
        <CheckoutScreen
          cart={[]}
          total={receivableOpenAmount(selectedReceivable)}
          mode="receiveFiado"
          receiveInfo={{ saleId:selectedReceivable.document || selectedReceivable.id, clientName:selectedReceivable.clientName, dueDate:selectedReceivable.dueDate }}
          onCancel={()=>setSelectedReceivable(null)}
          onConfirm={handleReceivableReceiveConfirm}
        />
      )}

      {/* Receipt */}
      {showReceipt && selectedSale && <ReceiptModal sale={selectedSale} storeName={storeName} currentPlan={currentPlan} onClose={()=>setShowReceipt(false)} />}

      {/* Barcode modal */}
      {showBarcodeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setShowBarcodeModal(null)}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"24px", maxWidth:"340px", width:"90%", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 4px" }}>{showBarcodeModal.name}</h3>
            <p style={{ color:"#64748b", fontSize:"13px", margin:"0 0 16px" }}>Codigo de Barras</p>
            <div style={{ background:"#f8fafc", borderRadius:"10px", padding:"12px", overflowX:"auto" }}>
              <BarcodeImage value={showBarcodeModal.barcode} />
            </div>
            <p style={{ fontFamily:"monospace", fontSize:"13px", margin:"10px 0" }}>{showBarcodeModal.barcode}</p>
            <div style={{ display:"flex", gap:"8px" }}>
              <button style={{ ...btn("#16a34a"), flex:1 }} onClick={()=>printProductLabels(showBarcodeModal)}>Etiqueta Imprimir</button>
              <button style={{ ...btn("#64748b"), flex:1 }} onClick={()=>setShowBarcodeModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirm */}
      {showClearConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setShowClearConfirm(false)}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"28px", maxWidth:"320px", width:"90%", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:"48px", marginBottom:"12px" }}>!</div>
            <h3 style={{ margin:"0 0 8px", fontSize:"18px" }}>Resetar todos os dados?</h3>
            <p style={{ color:"#64748b", fontSize:"13px", margin:"0 0 20px", lineHeight:1.5 }}>Apaga <strong>produtos, vendas e configuracoes</strong>. Esta acao nao pode ser desfeita.</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <button style={{ ...btn("#ef4444"), flex:1 }} onClick={clearAllData}>Excluir Apagar tudo</button>
              <button style={{ flex:1, background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"700" }} onClick={()=>setShowClearConfirm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
