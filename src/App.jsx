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
  "erpmini_owner_email",
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

  if (p === "free" || p === "gratis" || p === "gratuito" || p === "teste") return "starter";
  if (p === "mensal" || p === "pro_mensal") return "pro";
  if (p === "anual" || p === "premium_anual") return "premium";

  if (p === "starter" || p === "pro" || p === "premium") return p;

  return "starter";
};
