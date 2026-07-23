import { useState } from "react";
import { createPendingLicenseForCurrentUser } from "./accessService.js";
import { useAuth } from "./AuthContext.jsx";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";

export default function AuthScreen() {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessType, setBusinessType] = useState("comercio");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMsg("");
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "login") {
      addDiagnosticLog("LOGIN", "Login iniciado", "info", cleanEmail);
      const result = await signIn(cleanEmail, password);
      setBusy(false);
      if (result.error) {
        addDiagnosticLog("LOGIN", "Login falhou", "error", result.error.message);
        return setMsg(result.error.message);
      }
      addDiagnosticLog("LOGIN", "Login realizado", "success", cleanEmail);
      return;
    }

    addDiagnosticLog("SIGNUP", "Cadastro iniciado", "info", cleanEmail);
    const result = await signUp(cleanEmail, password, businessType);
    if (result.error) {
      addDiagnosticLog("SIGNUP", "Cadastro falhou", "error", result.error.message);
      setBusy(false);
      return setMsg(result.error.message);
    }

    addDiagnosticLog("SIGNUP", "Conta criada", "success", cleanEmail);
    const pending = result.data?.session
      ? await createPendingLicenseForCurrentUser(cleanEmail, businessType)
      : { ok: true, deferred: true };
    setBusy(false);

    if (!pending.ok) {
      setMsg("Conta criada, mas nao foi possivel criar a solicitacao de acesso. Fale com o suporte.");
      return;
    }

    setMsg(pending.deferred
      ? "Conta criada. Confirme seu e-mail e faça login para enviar a solicitação de acesso."
      : "Conta criada. Agora aguarde o administrador liberar seu acesso.");
    setMode("login");
    setPassword("");
  };

  const forgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setMsg("Informe seu e-mail para recuperar a senha.");
    setBusy(true);
    const { error } = await requestPasswordReset(cleanEmail);
    setBusy(false);
    setMsg(error
      ? (error.message || "Não foi possível enviar o e-mail de recuperação.")
      : "Enviamos um link para seu e-mail. Abra-o para criar uma nova senha.");
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
        <input type="email" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="seuemail@exemplo.com" style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" }} />
        <label style={{ fontSize:"12px", fontWeight:"800", color:"#64748b" }}>Senha</label>
        <input type="password" value={password} onChange={event=>setPassword(event.target.value)} required placeholder="Digite sua senha" style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" }} />
        {mode === "login" && <button type="button" onClick={forgotPassword} disabled={busy} style={{ display:"block", margin:"-4px 0 14px auto", border:"none", background:"transparent", color:"#2563eb", fontWeight:"800", cursor:"pointer" }}>Esqueci minha senha</button>}
        {mode === "signup" && (
          <>
            <label style={{ fontSize:"12px", fontWeight:"800", color:"#64748b" }}>Tipo de negócio</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", margin:"6px 0 12px" }}>
              <button type="button" onClick={()=>setBusinessType("comercio")} style={{ padding:"12px 8px", border:`2px solid ${businessType === "comercio" ? "#e94560" : "#e2e8f0"}`, borderRadius:"12px", background:businessType === "comercio" ? "#fff1f2" : "#fff", color:businessType === "comercio" ? "#be123c" : "#64748b", fontWeight:"900" }}>Comércio</button>
              <button type="button" onClick={()=>setBusinessType("servicos")} style={{ padding:"12px 8px", border:`2px solid ${businessType === "servicos" ? "#e94560" : "#e2e8f0"}`, borderRadius:"12px", background:businessType === "servicos" ? "#fff1f2" : "#fff", color:businessType === "servicos" ? "#be123c" : "#64748b", fontWeight:"900" }}>Serviços</button>
            </div>
          </>
        )}
        {msg && <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"12px", padding:"10px", color:"#9a3412", fontWeight:"800", fontSize:"13px", marginBottom:"12px" }}>{msg}</div>}
        <button disabled={busy} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"14px", background:"#e94560", color:"#fff", fontWeight:"900", fontSize:"15px", opacity:busy?0.65:1 }}>
          {busy ? "Aguarde..." : mode==="login" ? "Entrar no ERPmini" : "Criar conta e solicitar acesso"}
        </button>
      </form>
    </div>
  );
}
