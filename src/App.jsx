import { useState, useRef, useEffect, useCallback } from "react";

const APP_VERSION = "FINANCEIRO-ETAPA12-20260614-1730";

// --- localStorage helpers ----------------------------------------------------
function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
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
  { key:"credito",  label:"Credito",  icon:"Cartao", color:"#2563eb", light:"#eff6ff" },
  { key:"debito",   label:"Debito",   icon:"Cartao", color:"#7c3aed", light:"#f5f3ff" },
  { key:"pix",      label:"PIX",      icon:"PIX", color:"#0891b2", light:"#ecfeff" },
  { key:"fiado",    label:"Fiado",    icon:"🤝", color:"#f59e0b", light:"#fffbeb" },
];

const initialProducts = [
  { id:1, name:"Produto A", price:25.9,  stock:50,  category:"Geral", barcode:"7891234560001" },
  { id:2, name:"Produto B", price:12.5,  stock:30,  category:"Geral", barcode:"7891234560002" },
  { id:3, name:"Produto C", price:8.0,   stock:100, category:"Geral", barcode:"7891234560003" },
];

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

  const paidSoFar = mixedPayments.reduce((s,p) => s+p.amount, 0);
  const remaining = total - paidSoFar;
  const change    = (parseFloat(amountPaid)||0) - total;
  const mInfo     = (k) => PAYMENT_METHODS.find(m=>m.key===k);
  const isReceive = mode==="receiveFiado";
  const todayISO = () => new Date().toISOString().slice(0,10);
  const isPastDate = (dateStr) => dateStr && dateStr < todayISO();

  const handleMethod = (key) => {
    setSelectedMethod(key);
    if (isReceive) { setStep("receive_amount"); setAmountPaid(total.toFixed(2)); return; }
    if (key==="dinheiro") { setStep("dinheiro"); setAmountPaid(""); }
    else if (key==="fiado") { setStep("fiado"); setFiadoClientId(clients[0]?.id ? String(clients[0].id) : ""); setFiadoDueDate(""); }
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

  const confirmFiado = () => {
    const client = clients.find(c=>String(c.id)===String(fiadoClientId));
    if (!client) return;
    if (isPastDate(fiadoDueDate)) return;
    onConfirm({ payments:[{ method:"fiado", amount:total }], total, change:0, fiado:{ clientId:client.id, clientName:client.name, dueDate:fiadoDueDate || "" } });
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
          <div style={{ fontWeight:"800", fontSize:"18px" }}>{isReceive ? "Receber Fiado" : "Cartao Pagamento"}</div>
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
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"12px" }}>Forma de Pagamento</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
              {PAYMENT_METHODS.filter(m=>!isReceive || m.key!=="fiado").map(m=>(
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


        {step==="fiado" && (
          <>
            <div style={{ textAlign:"center", marginBottom:"16px" }}>
              <div style={{ fontSize:"40px" }}>🤝</div>
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

                      <div style={{ height:"10px", background:"#e2e8f0", borderRadius:"999px", overflow:"hidden", marginBottom:"12px" }}>
                        <div style={{ height:"100%", width:`${usadoPct}%`, background:excede?"#f97316":"#22c55e", borderRadius:"999px" }} />
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
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>⬅️ Voltar</button>
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
                  {PAYMENT_METHODS.filter(m=>!isReceive || m.key!=="fiado").map(m=>(
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
                style={{ padding:"14px 18px", background:"#f1f5f9", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700" }}>⬅️ Voltar</button>
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
function ReceiptModal({ sale, storeName, onClose }) {
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

        <div ref={receiptRef} style={{ background:"#fafafa", border:"1px dashed #ccc", borderRadius:"12px", padding:"20px", fontFamily:"'Courier New',monospace", fontSize:"13px", lineHeight:1.7 }}>
          <div style={{ textAlign:"center", marginBottom:"8px" }}>
            <div style={{ fontWeight:"800", fontSize:"18px" }}>{storeName||"ERPmini"}</div>
            <div style={{ fontSize:"11px", color:"#777" }}>Comprovante de Pagamento</div>
          </div>
          <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }} />
          <div style={{ display:"flex", justifyContent:"space-between" }}><span>Pedido</span><span style={{ fontWeight:"700" }}>#{sale.id}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between" }}><span>Data</span><span>{fmtDate(sale.date)}</span></div>
          <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }} />
          <div style={{ fontWeight:"700", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Itens</div>
          {sale.items.map(item=>(
            <div key={item.id} style={{ marginBottom:"4px" }}>
              <div style={{ fontSize:"13px", fontWeight:"600" }}>{item.name}</div>
              <div style={{ display:"flex", justifyContent:"space-between", color:"#555", fontSize:"12px" }}>
                <span>{item.qty}x {fmtCur(item.price)}</span>
                <span style={{ fontWeight:"700", color:"#000" }}>{fmtCur(item.price*item.qty)}</span>
              </div>
            </div>
          ))}
          <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }} />
          <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"800", fontSize:"16px", margin:"4px 0" }}>
            <span>TOTAL</span><span>{fmtCur(sale.total)}</span>
          </div>
          <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }} />
          <div style={{ fontWeight:"700", fontSize:"11px", textTransform:"uppercase", marginBottom:"6px" }}>Pagamento</div>
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
          <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }} />
          <div style={{ textAlign:"center", fontSize:"11px", color:"#777" }}>Obrigado pela preferencia! <br/>Volte sempre.</div>
        </div>

        <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
          <button onClick={printReceipt} style={{ flex:1, padding:"14px", background:"#1a1a2e", color:"#fff", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Imprimir Imprimir</button>
          <button onClick={onClose} style={{ flex:1, padding:"14px", background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:"12px", cursor:"pointer", fontWeight:"700", fontSize:"15px" }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN --------------------------------------------------------------------
export default function ERP() {
  const isMobile = useIsMobile();
  const [tab, setTab]             = useState("dashboard");
  const [caixaView, setCaixaView] = useState("resumo");
  const [products, setProducts]   = useState(()=>loadLS("erpmini_products", initialProducts));
  const [cart, setCart]           = useState([]);
  const [sales, setSales]         = useState(()=>loadLS("erpmini_sales", []));
  const [clients, setClients]     = useState(()=>loadLS("erpmini_clients", []));
  const [cashClosures, setCashClosures] = useState(()=>loadLS("erpmini_cash_closures", []));
  const [payables, setPayables] = useState(()=>loadLS("erpmini_payables", []));
  const [newClient, setNewClient] = useState({ name:"", phone:"", limit:"" });
  const [newPayable, setNewPayable] = useState({ supplier:"", document:"", description:"", amount:"", dueDate:"", category:"Geral" });
  const [selectedClientHistory, setSelectedClientHistory] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showFiadoReceive, setShowFiadoReceive] = useState(false);
  const [selectedFiadoSale, setSelectedFiadoSale] = useState(null);
  const [showReceipt, setShowReceipt]   = useState(false);
  const [newProduct, setNewProduct]     = useState({ name:"", price:"", stock:"", category:"Geral", barcode:"" });
  const [editingId, setEditingId]       = useState(null);
  const [searchProd, setSearchProd]     = useState("");
  const [notification, setNotification] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeFlash, setBarcodeFlash] = useState(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(null);
  const [storeName, setStoreName] = useState(()=>loadLS("erpmini_storename","Minha Loja"));
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCart, setShowCart]   = useState(false);   // mobile cart drawer
  const [showSettings, setShowSettings] = useState(false);
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

  useEffect(()=>{ saveLS("erpmini_products", products); }, [products]);
  useEffect(()=>{ saveLS("erpmini_sales", sales); }, [sales]);
  useEffect(()=>{ saveLS("erpmini_clients", clients); }, [clients]);
  useEffect(()=>{ saveLS("erpmini_storename", storeName); }, [storeName]);
  useEffect(()=>{ saveLS("erpmini_salecounter", saleCounter.current); });

  const notify = (msg, type="success") => {
    setNotification({ msg, type });
    setTimeout(()=>setNotification(null), 2500);
  };

  const clearAllData = () => {
    ["erpmini_products","erpmini_sales","erpmini_storename","erpmini_salecounter"].forEach(k=>localStorage.removeItem(k));
    setProducts(initialProducts); setSales([]); setStoreName("Minha Loja"); setCart([]);
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
    sales.forEach(s => {
      if (isSameDay(s.date, key)) {
        (s.payments || []).forEach(p => {
          if (p.method !== "fiado") list.push({ ...p, origin:"Venda", saleId:s.id, date:s.date, clientName:s.fiado?.clientName || "" });
        });
      }
      if (s.fiado && s.fiado.payments) {
        s.fiado.payments.forEach(p => {
          if (isSameDay(p.date, key)) list.push({ ...p, origin:"Recebimento fiado", saleId:s.id, date:p.date, clientName:s.fiado.clientName || "" });
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
  const closeCash = () => {
    const key = dayKey();
    const byMethod = paymentSummary(key);
    const entradas = Object.values(byMethod).reduce((a,b)=>a+b,0);
    const vendasHoje = sales.filter(s=>isSameDay(s.date,key)).reduce((sum,s)=>sum+s.total,0);
    const fiadoHoje = sales.filter(s=>isSameDay(s.date,key) && s.fiado).reduce((sum,s)=>sum+s.total,0);
    const closure = { id:Date.now(), date:new Date().toISOString(), day:key, byMethod, entradas, vendasHoje, fiadoHoje, fiadoAberto:fiadoTotal, salesCount:sales.filter(s=>isSameDay(s.date,key)).length };
    setCashClosures(prev=>[closure,...prev]);
    notify("Caixa fechado com sucesso!");
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
  const expectedMonthBalance = salesMonthTotal - payablesMonthTotal;

  const addPayable = () => {
    const amount = parseMoney(newPayable.amount);
    if (!newPayable.supplier.trim() || amount<=0 || !newPayable.dueDate) {
      notify("Informe fornecedor, valor e vencimento.", "error");
      return;
    }
    const item = {
      id: Date.now(),
      supplier: newPayable.supplier.trim(),
      document: newPayable.document.trim(),
      description: newPayable.description.trim(),
      amount,
      dueDate: newPayable.dueDate,
      category: newPayable.category.trim() || "Geral",
      paid:false,
      createdAt:new Date().toISOString()
    };
    setPayables(prev=>[item,...prev]);
    setNewPayable({ supplier:"", document:"", description:"", amount:"", dueDate:"", category:"Geral" });
    notify("Conta a pagar cadastrada!");
  };
  const markPayablePaid = (id) => {
    setPayables(prev=>prev.map(p=>p.id===id ? {...p, paid:true, paidDate:new Date().toISOString()} : p));
    notify("Conta marcada como paga!");
  };
  const reopenPayable = (id) => setPayables(prev=>prev.map(p=>p.id===id ? {...p, paid:false, paidDate:null} : p));
  const deletePayable = (id) => {
    if (window.confirm("Excluir esta conta a pagar?")) setPayables(prev=>prev.filter(p=>p.id!==id));
  };

  const handleCheckoutConfirm = ({ payments, total:t, change, fiado }) => {
    const sale = { id:++saleCounter.current, date:new Date().toISOString(), items:[...cart], total:t, payments, change, fiado: fiado ? {...fiado, paid:false} : null };
    setProducts(prev=>prev.map(p=>{ const item=cart.find(i=>i.id===p.id); return item?{...p,stock:p.stock-item.qty}:p; }));
    setSales(prev=>[sale,...prev]);
    setSelectedSale(sale);
    setCart([]); setShowCheckout(false); setShowCart(false); setShowReceipt(true);
    notify("OK Venda finalizada!");
  };

  const saveClient = () => {
    if (!newClient.name) return notify("Informe o nome do cliente!","error");
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
    const barcode = newProduct.barcode || genBarcode();
    if (!editingId && products.find(p=>p.barcode===barcode)) return notify("Codigo de barras ja cadastrado!","error");
    if (editingId) {
      setProducts(prev=>prev.map(p=>p.id===editingId?{...p,...newProduct,barcode,price:parseFloat(newProduct.price),stock:parseInt(newProduct.stock)}:p));
      setEditingId(null); notify("Produto atualizado!");
    } else {
      setProducts(prev=>[...prev,{id:Date.now(),...newProduct,barcode,price:parseFloat(newProduct.price),stock:parseInt(newProduct.stock)}]);
      notify("Produto cadastrado!");
    }
    setNewProduct({name:"",price:"",stock:"",category:"Geral",barcode:""});
  };

  const editProduct = (p) => { setNewProduct({name:p.name,price:p.price,stock:p.stock,category:p.category,barcode:p.barcode}); setEditingId(p.id); setTab("estoque"); };
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

  const NAV_ITEMS = [
    { key:"dashboard", icon:"🏠", label:"Inicio"  },
    { key:"pdv",     icon:"🛒", label:"PDV"     },
    { key:"estoque", icon:"📦", label:"Estoque" },
    { key:"vendas",  icon:"📊", label:"Vendas"  },
    { key:"caixa",   icon:"💰", label:"Caixa"   },
    { key:"fiado",   icon:"🤝", label:"Fiado"   },
    { key:"config",  icon:"⚙️", label:"Config"  },
  ];

  // --- Cart Drawer (mobile) -------------------------------------------------
  const CartDrawer = () => (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:150, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowCart(false)}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"20px 16px 32px", width:"100%", maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:"40px", height:"4px", background:"#e2e8f0", borderRadius:"4px", margin:"0 auto 16px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <div style={{ fontWeight:"800", fontSize:"17px" }}>🛒 PDV Carrinho ({cartCount})</div>
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
  const DashboardTab = () => (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["Vendas hoje", fmtCur(salesTodayTotal), "linear-gradient(135deg,#16a34a,#15803d)"],
          ["Vendas do mes", fmtCur(salesMonthTotal), "linear-gradient(135deg,#2563eb,#1d4ed8)"],
          ["Ticket medio hoje", fmtCur(ticketToday), "linear-gradient(135deg,#6366f1,#4338ca)"],
          ["Fiado aberto", fmtCur(fiadoTotal), "linear-gradient(135deg,#f59e0b,#d97706)"],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{ background:c, borderRadius:"14px", padding:"15px", color:"#fff" }}>
            <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
            <div style={{ fontSize:isMobile?"18px":"22px", fontWeight:"900" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["Vendas hoje", salesOfToday.length, "#e94560"],
          ["Clientes", clients.length, "#6366f1"],
          ["Estoque baixo", lowStockProducts.length, "#ef4444"],
          ["Fiados vencidos", overdueFiado.length, "#f97316"],
          ["Contas hoje", payablesDueToday.length, "#f59e0b"],
          ["Contas vencidas", payablesOverdue.length, "#dc2626"],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{ background:"#fff", borderRadius:"14px", padding:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize:"12px", color:"#64748b", fontWeight:"800" }}>{l}</div>
            <div style={{ fontSize:"24px", fontWeight:"900", color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {(overdueFiado.length>0 || lowStockProducts.length>0 || payablesDueToday.length>0 || payablesOverdue.length>0) && (
        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"10px" }}>🚨 Alertas</div>
          {overdueFiado.length>0 && (
            <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"12px", padding:"10px", marginBottom:"8px" }}>
              <div style={{ fontWeight:"900", color:"#9a3412" }}>{overdueFiado.length} fiado(s) vencido(s)</div>
              <div style={{ fontSize:"12px", color:"#9a3412" }}>Acesse a aba Fiado para cobrar os clientes.</div>
            </div>
          )}
          {payablesOverdue.length>0 && (
            <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"12px", padding:"10px", marginBottom:"8px" }}>
              <div style={{ fontWeight:"900", color:"#991b1b" }}>{payablesOverdue.length} conta(s) vencida(s)</div>
              <div style={{ fontSize:"12px", color:"#991b1b" }}>Total vencido: {fmtCur(payablesOverdueTotal)}. Acesse Caixa > Financeiro.</div>
            </div>
          )}
          {payablesDueToday.length>0 && (
            <div style={{ background:"#fff7ed", border:"1.5px solid #fdba74", borderRadius:"12px", padding:"10px", marginBottom:"8px" }}>
              <div style={{ fontWeight:"900", color:"#9a3412" }}>{payablesDueToday.length} conta(s) vencem hoje</div>
              <div style={{ fontSize:"12px", color:"#9a3412" }}>Total para pagar hoje: {fmtCur(payablesDueTodayTotal)}.</div>
            </div>
          )}
          {lowStockProducts.length>0 && (
            <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontWeight:"900", color:"#991b1b" }}>{lowStockProducts.length} produto(s) com estoque baixo</div>
              <div style={{ fontSize:"12px", color:"#991b1b" }}>Produtos com 5 unidades ou menos.</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"14px" }}>
        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>🏆 Top clientes</div>
          {topClients.length===0 ? (
            <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhum cliente com compras ainda.</div>
          ) : topClients.map((c,i)=>(
            <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontWeight:"900" }}>{i+1}. {c.name}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>Aberto: {fmtCur(c.openBalance)}</div>
              </div>
              <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(c.totalBought)}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>🔥 Produtos mais vendidos</div>
          {productRanking.length===0 ? (
            <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhum produto vendido ainda.</div>
          ) : productRanking.map((p,i)=>(
            <div key={p.id} style={{ padding:"9px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px" }}>
                <div style={{ fontWeight:"900" }}>{i+1}. {p.name}</div>
                <div style={{ fontWeight:"900", color:"#2563eb" }}>{p.sold} un.</div>
              </div>
              <div style={{ height:"8px", background:"#e2e8f0", borderRadius:"999px", overflow:"hidden", marginTop:"6px" }}>
                <div style={{ height:"100%", width:`${Math.min(100, Math.max(8, (p.sold/(productRanking[0]?.sold||1))*100))}%`, background:"#2563eb", borderRadius:"999px" }} />
              </div>
              <div style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>Total: {fmtCur(p.total)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>📋 Ultimas vendas</div>
        {sales.slice(0,5).length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhuma venda registrada.</div>
        ) : sales.slice(0,5).map(s=>(
          <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #f1f5f9", gap:"10px" }}>
            <div>
              <div style={{ fontWeight:"900" }}>Venda #{s.id}</div>
              <div style={{ fontSize:"12px", color:"#64748b" }}>{fmtDate(s.date)} {s.fiado ? `- Fiado: ${s.fiado.clientName}` : ""}</div>
            </div>
            <div style={{ fontWeight:"900", color:"#e94560" }}>{fmtCur(s.total)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // --- PDV tab ---------------------------------------------------------------
  const PDVTab = () => (
    <div>
      {/* Barcode scanner */}
      <div style={{ ...card, display:"flex", alignItems:"center", gap:"10px",
        border:`2px solid ${barcodeFlash==="ok"?"#22c55e":barcodeFlash==="error"?"#ef4444":"#6366f1"}`,
        background:barcodeFlash==="ok"?"#f0fdf4":barcodeFlash==="error"?"#fef2f2":"#eef2ff", transition:"all 0.2s", marginBottom:"12px" }}>
        <span style={{ fontSize:"22px" }}>Codigo</span>
        <input ref={barcodeRef}
          style={{ flex:1, border:"none", background:"transparent", fontSize:"15px", outline:"none", fontWeight:"600" }}
          placeholder="Codigo de barras..." value={barcodeInput}
          onChange={e=>setBarcodeInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleBarcodeScan(barcodeInput)} />
        <button style={btnSm("#6366f1")} onClick={()=>handleBarcodeScan(barcodeInput)}>OK</button>
      </div>

      {/* Search */}
      <input style={{ ...inp, marginBottom:"12px" }} placeholder="🔍 Buscar produto..." value={searchProd} onChange={e=>setSearchProd(e.target.value)} />

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
            Cartao Ir para Pagamento
          </button>
          <button style={{ ...btn("#94a3b8"), width:"100%", padding:"10px", fontSize:"13px", marginTop:"8px" }} onClick={()=>setCart([])}>
            Excluir Limpar Carrinho
          </button>
        </div>
      )}
    </div>
  );

  // --- Estoque tab ------------------------------------------------------------
  const EstoqueTab = () => (
    <div>
      <div style={card}>
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"14px" }}>{editingId?"Editar Editar Produto":"+ Novo Produto"}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[["Nome do Produto","text","name","Ex: Camiseta Azul M"],["Preco (R$)","number","price","0.00"],["Estoque","number","stock","0"],["Categoria","text","category","Geral"]].map(([lbl,type,key,ph])=>(
            <div key={key}>
              <label style={{ fontSize:"12px", fontWeight:"600", color:"#64748b", marginBottom:"4px", display:"block" }}>{lbl}</label>
              <input style={inp} type={type} value={newProduct[key]} placeholder={ph} onChange={e=>setNewProduct({...newProduct,[key]:e.target.value})} />
            </div>
          ))}
          <div>
            <label style={{ fontSize:"12px", fontWeight:"600", color:"#64748b", marginBottom:"4px", display:"block" }}>Codigo de Barras</label>
            <div style={{ display:"flex", gap:"8px" }}>
              <input style={{ ...inp, fontFamily:"monospace" }} value={newProduct.barcode} placeholder="Automatico se vazio"
                onChange={e=>setNewProduct({...newProduct,barcode:e.target.value})} />
              <button style={btnSm("#6366f1")} onClick={()=>setNewProduct({...newProduct,barcode:genBarcode()})}>🎲 Gerar</button>
            </div>
            {newProduct.barcode&&(
              <div style={{ marginTop:"8px", background:"#f8fafc", borderRadius:"8px", padding:"8px", textAlign:"center", overflowX:"auto" }}>
                <BarcodeImage value={newProduct.barcode} />
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button style={{ ...btn(), flex:1 }} onClick={saveProduct}>{editingId?"Salvar alteracoes":"+ Cadastrar"}</button>
            {editingId&&<button style={btn("#64748b")} onClick={()=>{setEditingId(null);setNewProduct({name:"",price:"",stock:"",category:"Geral",barcode:""});}}>x</button>}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"12px" }}>📦 Estoque Produtos ({products.length})</div>
        {products.map(p=>(
          <div key={p.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px", marginBottom:"8px" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:"800", fontSize:"15px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                {p.barcode&&<div style={{ fontSize:"11px", color:"#94a3b8", fontFamily:"monospace", marginTop:"3px" }}>{p.barcode}</div>}
              </div>
              <div style={{ fontWeight:"900", color:"#e94560", whiteSpace:"nowrap", fontSize:"16px", textAlign:"right" }}>{fmtCur(p.price)}</div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
              <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap" }}>
                <span style={tag("#6366f1")}>{p.category}</span>
                <span style={tag(p.stock>5?"#22c55e":p.stock>0?"#f59e0b":"#ef4444")}>{p.stock} un.</span>
              </div>

              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", justifyContent:"flex-end" }}>
                <button title="Ver codigo" style={btnSm("#0ea5e9")} onClick={()=>setShowBarcodeModal(p)}>🔳 Codigo</button>
                <button title="Imprimir etiqueta" style={btnSm("#16a34a")} onClick={()=>printProductLabels(p)}>🏷️ Etiqueta</button>
                <button title="Editar" style={btnSm("#3b82f6")} onClick={()=>editProduct(p)}>✏️ Editar</button>
                <button title="Excluir" style={btnSm("#ef4444")} onClick={()=>deleteProduct(p.id)}>🗑️ Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // --- Vendas tab -------------------------------------------------------------
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
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"12px" }}>📋 Historico</div>
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
              <div style={{ fontWeight:"800", fontSize:"14px", whiteSpace:"nowrap" }}>{fmtCur(sale.total)}</div>
              <button style={btnSm("#6366f1")} onClick={()=>{setSelectedSale(sale);setShowReceipt(true);}}>🧾 Recibo</button>
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
            ["Fiado vendido", fmtCur(fiadoHoje), "linear-gradient(135deg,#f59e0b,#d97706)"],
            ["Recebido fiado", fmtCur(recebimentosFiadoHoje), "linear-gradient(135deg,#6366f1,#4338ca)"],
          ].map(([l,v,c],i)=>(
            <div key={i} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
              <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
              <div style={{ fontSize:"19px", fontWeight:"900" }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>💰 Fechamento de caixa</div>
          <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
            <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"8px" }}>Resumo das entradas recebidas hoje</div>
            {[
              ["Dinheiro", byMethod.dinheiro, "#16a34a"],
              ["PIX", byMethod.pix, "#0891b2"],
              ["Debito", byMethod.debito, "#7c3aed"],
              ["Credito", byMethod.credito, "#2563eb"],
            ].map(([label,value,color])=>(
              <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #e2e8f0" }}>
                <span style={{ fontWeight:"800", color:"#334155" }}>{label}</span>
                <span style={{ fontWeight:"900", color }}>{fmtCur(value)}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0" }}>
              <span style={{ fontWeight:"900", color:"#1a1a2e" }}>Total de entradas</span>
              <span style={{ fontWeight:"900", color:"#16a34a", fontSize:"18px" }}>{fmtCur(entradas)}</span>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", marginBottom:"12px" }}>
            <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#9a3412", fontWeight:"800" }}>Fiado em aberto total</div>
              <div style={{ fontSize:"18px", fontWeight:"900", color:"#ea580c" }}>{fmtCur(fiadoTotal)}</div>
            </div>
            <div style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe", borderRadius:"12px", padding:"10px" }}>
              <div style={{ fontSize:"11px", color:"#1d4ed8", fontWeight:"800" }}>Transacoes hoje</div>
              <div style={{ fontSize:"18px", fontWeight:"900", color:"#2563eb" }}>{vendasHojeList.length}</div>
            </div>
          </div>

          <button style={{ ...btn("#16a34a"), width:"100%" }} onClick={closeCash}>✅ Fechar caixa de hoje</button>
        </div>

        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"16px", marginBottom:"12px" }}>📋 Movimentacoes de hoje</div>
          {ultimosPagamentos.length===0 ? (
            <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma entrada recebida hoje.</div>
          ) : ultimosPagamentos.map((p,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontWeight:"800", color:"#1a1a2e" }}>{mLabel(p.method)} - {p.origin}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>#{p.saleId} {p.clientName ? `- ${p.clientName}` : ""} | {fmtDate(p.date)}</div>
              </div>
              <div style={{ fontWeight:"900", color:mColor(p.method), whiteSpace:"nowrap" }}>{fmtCur(parseFloat(p.amount)||0)}</div>
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
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>📊 Relatorio por pagamento hoje</div>
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
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>🏆 Top clientes</div>
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
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>🔥 Top produtos</div>
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
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>💼 Resumo financeiro do mes</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px" }}>
            {[
              ["Entradas mes", salesMonthTotal, "#16a34a"],
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
          <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>🤝 Fiados em aberto</div>
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

      return (
        <>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
            {[
              ["A pagar aberto", fmtCur(payablesOpenTotal), "linear-gradient(135deg,#e94560,#c0392b)"],
              ["Vence hoje", fmtCur(payablesDueTodayTotal), "linear-gradient(135deg,#f59e0b,#d97706)"],
              ["Vencidas", fmtCur(payablesOverdueTotal), "linear-gradient(135deg,#dc2626,#991b1b)"],
              ["Prox. 7 dias", fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0)), "linear-gradient(135deg,#6366f1,#4338ca)"],
            ].map(([l,v,c])=>(
              <div key={l} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
                <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
                <div style={{ fontSize:"18px", fontWeight:"900" }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>➕ Nova conta a pagar</div>
            <input style={{ ...inp, marginBottom:"8px" }} placeholder="Fornecedor" value={newPayable.supplier} onChange={e=>setNewPayable({...newPayable,supplier:e.target.value})} />
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="NF / boleto / documento" value={newPayable.document} onChange={e=>setNewPayable({...newPayable,document:e.target.value})} />
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="Valor" inputMode="decimal" value={newPayable.amount} onChange={e=>setNewPayable({...newPayable,amount:e.target.value})} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <input style={{ ...inp, marginBottom:"8px" }} type="date" value={newPayable.dueDate} onChange={e=>setNewPayable({...newPayable,dueDate:e.target.value})} />
              <input style={{ ...inp, marginBottom:"8px" }} placeholder="Categoria" value={newPayable.category} onChange={e=>setNewPayable({...newPayable,category:e.target.value})} />
            </div>
            <input style={{ ...inp, marginBottom:"10px" }} placeholder="Descricao / observacao" value={newPayable.description} onChange={e=>setNewPayable({...newPayable,description:e.target.value})} />
            <button style={{ ...btn("#e94560"), width:"100%" }} onClick={addPayable}>Cadastrar conta</button>
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>📌 Contas em aberto</div>
            {contasAbertasOrdenadas.length===0 ? (
              <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma conta em aberto.</div>
            ) : contasAbertasOrdenadas.map(p=>(
              <div key={p.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:p.dueDate<dayKey()?"#fef2f2":"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{p.supplier}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>{p.document ? `Doc: ${p.document} | ` : ""}Vence: {p.dueDate}</div>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>{p.category || "Geral"}{p.description ? ` - ${p.description}` : ""}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:"900", color:statusColor(p), whiteSpace:"nowrap" }}>{fmtCur(p.amount)}</div>
                    <div style={{ fontSize:"11px", color:statusColor(p), fontWeight:"800" }}>{statusLabel(p)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                  <button style={btnSm("#16a34a")} onClick={()=>markPayablePaid(p.id)}>Pagar</button>
                  <button style={btnSm("#ef4444")} onClick={()=>deletePayable(p.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>✅ Contas pagas recentes</div>
            {contasPagasRecentes.length===0 ? (
              <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma conta paga registrada.</div>
            ) : contasPagasRecentes.slice(0,10).map(p=>(
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9", gap:"10px" }}>
                <div>
                  <div style={{ fontWeight:"900" }}>{p.supplier}</div>
                  <div style={{ fontSize:"12px", color:"#64748b" }}>Pago em: {fmtDate(p.paidDate)} | Venc.: {p.dueDate}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(p.amount)}</div>
                  <button style={{ ...btnSm("#64748b"), marginTop:"4px" }} onClick={()=>reopenPayable(p.id)}>Reabrir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      );
    };

    const HistoricoCaixa = () => (
      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}>🧾 Historico de fechamentos</div>
        {cashClosures.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhum fechamento registrado.</div>
        ) : cashClosures.map(c=>(
          <div key={c.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", marginBottom:"6px" }}>
              <div>
                <div style={{ fontWeight:"900" }}>{fmtDate(c.date)}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>{c.salesCount} transacoes | Fiado aberto: {fmtCur(c.fiadoAberto||0)}</div>
              </div>
              <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(c.entradas||0)}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", fontSize:"12px", color:"#64748b" }}>
              <div>Dinheiro: <strong>{fmtCur(c.byMethod?.dinheiro||0)}</strong></div>
              <div>PIX: <strong>{fmtCur(c.byMethod?.pix||0)}</strong></div>
              <div>Debito: <strong>{fmtCur(c.byMethod?.debito||0)}</strong></div>
              <div>Credito: <strong>{fmtCur(c.byMethod?.credito||0)}</strong></div>
            </div>
          </div>
        ))}
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

        {caixaView==="resumo" && <ResumoCaixa />}
        {caixaView==="relatorios" && <RelatoriosCaixa />}
        {caixaView==="financeiro" && <FinanceiroCaixa />}
        {caixaView==="historico" && <HistoricoCaixa />}
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
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}>🤝 Novo Cliente</div>
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="Nome do cliente" value={newClient.name} onChange={e=>setNewClient({...newClient,name:e.target.value})} />
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="WhatsApp" value={newClient.phone} onChange={e=>setNewClient({...newClient,phone:e.target.value})} />
        <input style={{ ...inp, marginBottom:"12px" }} type="number" placeholder="Limite de credito opcional" value={newClient.limit} onChange={e=>setNewClient({...newClient,limit:e.target.value})} />
        <button style={{ ...btn(), width:"100%" }} onClick={saveClient}>➕ Cadastrar Cliente</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}>📋 Clientes e saldos</div>
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
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}>💳 Vendas fiado em aberto</div>
        {fiadoSales.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhuma venda fiada em aberto.</div>
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
                  <div style={{ fontSize:"12px", fontWeight:"800", color:"#64748b", marginBottom:"4px" }}>Historico de pagamentos</div>
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

  // --- Config tab -------------------------------------------------------------
  const ConfigTab = () => (
    <div>
      <div style={card}>
        <div style={{ fontWeight:"700", fontSize:"16px", marginBottom:"14px" }}>Config Configuracoes</div>
        <label style={{ fontSize:"13px", fontWeight:"600", color:"#64748b", marginBottom:"6px", display:"block" }}>Nome da Loja (aparece no comprovante)</label>
        <input style={{ ...inp, marginBottom:"14px" }} value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Minha Loja" />
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

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1a1a2e,#16213e)", color:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", gap:"10px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ fontSize:"20px", fontWeight:"800", letterSpacing:"1px" }}>ERP<span style={{ color:"#e94560" }}>mini</span></div>
        <span style={{ fontSize:"11px", background:"rgba(34,197,94,0.2)", color:"#86efac", borderRadius:"20px", padding:"2px 8px" }}>Salvo</span>
        <span style={{ fontSize:"10px", background:"rgba(255,255,255,0.12)", color:"#cbd5e1", borderRadius:"20px", padding:"2px 6px" }}>v-fin1</span>
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
              style={{ padding:"14px 20px", border:"none", background:"transparent", cursor:"pointer", fontWeight:tab===key?"700":"500", color:tab===key?"#e94560":"#64748b", borderBottom:tab===key?"3px solid #e94560":"3px solid transparent", fontSize:"14px", transition:"all 0.2s" }}>
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{ padding:isMobile?"12px":"24px", maxWidth:"1200px", margin:"0 auto" }}>
        {tab==="dashboard" && DashboardTab()}
        {tab==="pdv"     && PDVTab()}
        {tab==="estoque" && EstoqueTab()}
        {tab==="vendas"  && VendasTab()}
        {tab==="caixa"   && CaixaTab()}
        {tab==="fiado"   && FiadoTab()}
        {tab==="config"  && ConfigTab()}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"2px solid #f1f5f9", display:"flex", zIndex:50, boxShadow:"0 -4px 20px rgba(0,0,0,0.1)" }}>
          {NAV_ITEMS.map(({key,icon,label})=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{ flex:1, padding:"10px 4px", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }}>
              <span style={{ fontSize:"20px" }}>{icon}</span>
              <span style={{ fontSize:"10px", fontWeight:tab===key?"700":"500", color:tab===key?"#e94560":"#94a3b8" }}>{label}</span>
              {tab===key&&<div style={{ width:"20px", height:"3px", background:"#e94560", borderRadius:"2px" }} />}
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

      {/* Receipt */}
      {showReceipt && selectedSale && <ReceiptModal sale={selectedSale} storeName={storeName} onClose={()=>setShowReceipt(false)} />}

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
