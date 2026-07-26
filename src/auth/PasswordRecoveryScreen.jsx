import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";

export default function PasswordRecoveryScreen() {
  const { updatePassword, finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas não são iguais.");
      return;
    }

    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);

    if (result.error) {
      addDiagnosticLog("PASSWORD", "Alteração de senha falhou", "error", result.error.message);
      setMessage("Não foi possível alterar a senha. Solicite um novo link.");
      return;
    }

    addDiagnosticLog("PASSWORD", "Senha alterada preservando o usuário", "success");
    finishPasswordRecovery();
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0f172a,#1a1a2e)", padding:"20px" }}>
      <form onSubmit={submit} style={{ width:"100%", maxWidth:"380px", background:"#fff", borderRadius:"22px", padding:"26px", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ textAlign:"center", marginBottom:"18px" }}>
          <div style={{ fontSize:"30px", fontWeight:"900", color:"#0f172a" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
          <div style={{ fontSize:"14px", color:"#64748b", fontWeight:"800", marginTop:"6px" }}>Definir nova senha</div>
        </div>
        <label style={{ fontSize:"12px", fontWeight:"800", color:"#64748b" }}>Nova senha</label>
        <input type="password" value={password} onChange={(event)=>setPassword(event.target.value)} required minLength={8} autoComplete="new-password" style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" }} />
        <label style={{ fontSize:"12px", fontWeight:"800", color:"#64748b" }}>Confirmar nova senha</label>
        <input type="password" value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" style={{ width:"100%", padding:"14px", border:"2px solid #e2e8f0", borderRadius:"12px", margin:"6px 0 12px", boxSizing:"border-box", fontSize:"15px" }} />
        {message && <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"12px", padding:"10px", color:"#9a3412", fontWeight:"800", fontSize:"13px", marginBottom:"12px" }}>{message}</div>}
        <button disabled={busy} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"14px", background:"#e94560", color:"#fff", fontWeight:"900", fontSize:"15px", opacity:busy?0.65:1 }}>
          {busy ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
