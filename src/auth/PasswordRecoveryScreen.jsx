import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";

export default function PasswordRecoveryScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (password.length < 6) return setMessage("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirmation) return setMessage("As senhas não coincidem.");
    setBusy(true);
    const { error } = await updatePassword(password);
    if (error) {
      setBusy(false);
      return setMessage(error.message || "Não foi possível alterar a senha.");
    }
    await signOut();
    window.location.replace("/");
  };

  const input = { width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0f172a,#1a1a2e)", padding:"20px" }}>
      <form onSubmit={submit} style={{ width:"100%", maxWidth:"380px", background:"#fff", borderRadius:"22px", padding:"26px", boxShadow:"0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize:"28px", fontWeight:900, textAlign:"center", color:"#0f172a" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
        <h2 style={{ margin:"18px 0 4px", color:"#0f172a" }}>Criar nova senha</h2>
        <p style={{ margin:"0 0 16px", color:"#64748b", fontSize:"13px" }}>Informe uma nova senha para sua conta.</p>
        <label style={{ fontSize:"12px", fontWeight:800, color:"#64748b" }}>Nova senha</label>
        <input autoFocus type="password" value={password} onChange={(event)=>setPassword(event.target.value)} required style={input} />
        <label style={{ fontSize:"12px", fontWeight:800, color:"#64748b" }}>Confirmar nova senha</label>
        <input type="password" value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} required style={input} />
        {message && <div style={{ background:"#fff7ed", border:"1px solid #fdba74", borderRadius:"12px", padding:"10px", color:"#9a3412", fontWeight:800, fontSize:"13px", marginBottom:"12px" }}>{message}</div>}
        <button disabled={busy} style={{ width:"100%", padding:"14px", border:0, borderRadius:"14px", background:"#e94560", color:"#fff", fontWeight:900, fontSize:"15px", opacity:busy?.65:1 }}>{busy ? "Salvando..." : "Salvar nova senha"}</button>
      </form>
    </div>
  );
}
