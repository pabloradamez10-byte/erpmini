export default function LicenseBlockedScreen({ info, onLogout }) {
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
        <button onClick={onLogout} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"14px", background:"#0f172a", color:"#fff", fontWeight:"900", fontSize:"15px" }}>Sair</button>
      </div>
    </div>
  );
}
