import React from "react";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    addDiagnosticLog("APP", "Falha inesperada na interface", "error", `${error?.message || error}\n${info?.componentStack || ""}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#0f172a", padding:"20px", fontFamily:"Segoe UI, sans-serif" }}>
        <div style={{ width:"100%", maxWidth:"440px", background:"#fff", borderRadius:"22px", padding:"28px", textAlign:"center" }}>
          <div style={{ fontSize:"28px", fontWeight:900, color:"#0f172a" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
          <h2 style={{ color:"#0f172a", marginBottom:"8px" }}>Não foi possível abrir esta tela</h2>
          <p style={{ color:"#64748b", lineHeight:1.5 }}>O erro foi registrado no diagnóstico. Recarregue o sistema para tentar novamente; seus dados salvos não serão apagados.</p>
          <button onClick={() => window.location.reload()} style={{ width:"100%", border:0, borderRadius:"14px", padding:"14px", background:"#e94560", color:"#fff", fontWeight:900, cursor:"pointer" }}>Recarregar ERPmini</button>
        </div>
      </div>
    );
  }
}
