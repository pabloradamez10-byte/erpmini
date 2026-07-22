import { useState, useRef, useEffect, useCallback } from "react";
import MasterSaasPanel from "./admin/MasterSaasPanel.jsx";
import ServicesModule from "./servicesModule/ServicesModule.jsx";
import PlanUsageCard from "./components/PlanUsageCard.jsx";
import AuthScreen from "./auth/AuthScreen.jsx";
import LicenseBlockedScreen from "./auth/LicenseBlockedScreen.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { checkLicenseByEmail, createPendingLicenseForCurrentUser } from "./auth/accessService.js";
import { addDiagnosticLog } from "./utils/diagnosticLog.js";
import { APP_VERSION, PAYMENT_METHODS, initialProducts } from "./constants/app.js";
import { countSalesThisMonth, getBusinessTypeFromLicense, hasPlanAccess, isLimitReached, normalizePlan, planLimitMessage } from "./domain/plans.js";
import { fmtCur, fmtDate, fmtPercent, parseMoney } from "./utils/format.js";
import { supabase } from "./services/supabaseClient.js";
import { CLOUD_KEYS, CLOUD_TABLE } from "./services/cloudKeys.js";
import { clearCloudUser, downloadCloudSnapshot, getOfflinePending, scheduleCloudSave, uploadCloudSnapshotNow } from "./services/cloudSync.js";
import InventoryTab from "./inventory/InventoryTab.jsx";
import { BarcodeImage, generateBarcode } from "./inventory/barcode.jsx";
import ClientsTab, { ClientHistoryModal } from "./clients/ClientsTab.jsx";
import CashSummary from "./cash/CashSummary.jsx";
import CashFinanceReports from "./cash/CashFinanceReports.jsx";


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
        clearCloudUser();
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

      let accessInfo = license;

      if (!license.ok && license.title === "Licenca nao liberada") {
        const pending = await createPendingLicenseForCurrentUser(user.email, user.user_metadata?.business_type);
        if (!pending.ok) {
          console.warn("ERPmini signup request retry error:", pending.message);
        } else {
          accessInfo = {
            ...license,
            title: "Solicitação de acesso enviada",
            message: pending.existing
              ? "Sua solicitação já está aguardando análise do administrador."
              : "Sua solicitação foi enviada ao administrador. Aguarde a liberação do acesso."
          };
        }
      }

      setLicenseInfo(accessInfo);
      setLicenseReady(true);

      if (!accessInfo.ok) {
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
    clearCloudUser();
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
    return <LicenseBlockedScreen info={licenseInfo} onLogout={handleSignOut} />;
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
  const [adminWorkspace, setAdminWorkspace] = useState(()=>loadLS("erpmini_admin_workspace", "master"));
  const businessType = isPlatformAdmin
    ? (adminWorkspace === "servicos" ? "servicos" : adminWorkspace === "comercio" ? "comercio" : "master")
    : getBusinessTypeFromLicense(licenseInfo?.license);
  const [tab, setTab]             = useState("");
  const [caixaView, setCaixaView] = useState("resumo");
  const [products, setProducts]   = useState(()=>loadLS("erpmini_products", initialProducts));
  const [cart, setCart]           = useState([]);
  const [sales, setSales]         = useState(()=>loadLS("erpmini_sales", []));
  const [services, setServices] = useState(()=>loadLS("erpmini_services", []));
  const [serviceCatalog, setServiceCatalog] = useState(()=>loadLS("erpmini_service_catalog", []));
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
  const [confirmDeleteReceivable, setConfirmDeleteReceivable] = useState(null);
  const [selectedIntelClient, setSelectedIntelClient] = useState(null);
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

  useEffect(()=>{ if (currentUserEmail) saveLS("erpmini_owner_email", currentUserEmail); }, [currentUserEmail]);

  useEffect(()=>{ saveLS("erpmini_admin_workspace", adminWorkspace); }, [adminWorkspace]);
  useEffect(()=>{ saveLS("erpmini_products", products); }, [products]);
  useEffect(()=>{ saveLS("erpmini_sales", sales); }, [sales]);
  useEffect(()=>{ saveLS("erpmini_services", services); }, [services]);
  useEffect(()=>{ saveLS("erpmini_service_catalog", serviceCatalog); }, [serviceCatalog]);
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
      services,
      serviceCatalog,
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
    setServices(Array.isArray(d.services) ? d.services : []);
    setServiceCatalog(Array.isArray(d.serviceCatalog) ? d.serviceCatalog : []);
    setClients(Array.isArray(d.clients) ? d.clients : []);
    setCashClosures(Array.isArray(d.cashClosures) ? d.cashClosures : []);
    setCashOps(Array.isArray(d.cashOps) ? d.cashOps : []);
    setPayables(Array.isArray(d.payables) ? d.payables : []);
    setReceivables(Array.isArray(d.receivables) ? d.receivables : []);
    setStoreName(d.storeName || payload.storeName || "Minha Loja");
    saleCounter.current = d.saleCounter || payload.saleCounter || 1000;

    saveLS("erpmini_products", Array.isArray(d.products) ? d.products : initialProducts);
    saveLS("erpmini_sales", Array.isArray(d.sales) ? d.sales : []);
    saveLS("erpmini_services", Array.isArray(d.services) ? d.services : []);
    saveLS("erpmini_service_catalog", Array.isArray(d.serviceCatalog) ? d.serviceCatalog : []);
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
    ["erpmini_products","erpmini_sales","erpmini_services","erpmini_service_catalog","erpmini_clients","erpmini_cash_closures","erpmini_cash_ops","erpmini_payables","erpmini_receivables","erpmini_storename","erpmini_salecounter","erpmini_backup_latest","erpmini_backup_history","erpmini_backup_last_date"].forEach(k=>localStorage.removeItem(k));
    setProducts(initialProducts); setSales([]); setServices([]); setServiceCatalog([]); setClients([]); setCashClosures([]); setCashOps([]); setPayables([]); setReceivables([]); setStoreName("Minha Loja"); setCart([]);
    saleCounter.current = 1000; setShowClearConfirm(false);
    notify("Dados resetados!");
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
  const profitMonthTotal = salesOfMonth.reduce((sum,s)=>sum+(s.total - saleCostTotal(s)),0);
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
    setConfirmDeleteReceivable(rec);
  };

  const confirmDeleteReceivableNow = () => {
    if (!confirmDeleteReceivable) return;
    const id = confirmDeleteReceivable.id;
    setReceivables(prev=>prev.filter(r=>r.id!==id));
    setConfirmDeleteReceivable(null);
    notify("Conta a receber excluída.");
  };

  const goSellToIntelClient = (clientInfo) => {
    setSelectedIntelClient(null);
    setPdvView("venda");
    setTab("pdv");
    notify(`Venda para ${clientInfo?.name || "cliente"}: selecione os produtos no PDV.`);
  };

  const goReceiveFromIntelClient = (clientInfo) => {
    setSelectedIntelClient(null);
    setTab("caixa");
    notify(`Procure ${clientInfo?.name || "cliente"} em Contas a Receber.`);
  };

  const openIntelClientWhatsApp = (clientInfo) => {
    const phoneRaw = String(clientInfo?.phone || "").replace(/\D/g, "");
    if (!phoneRaw) {
      notify("Cliente sem WhatsApp cadastrado.", "error");
      return;
    }
    const phone = phoneRaw.startsWith("55") ? phoneRaw : "55" + phoneRaw;
    const msg = encodeURIComponent(`Olá ${clientInfo?.name || ""}. Você possui um crediário em aberto de ${fmtCur(clientInfo?.openCredit || 0)}.\n\nERPmini`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
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
              barcode: generateBarcode()
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
    const barcode = newProduct.barcode || generateBarcode();
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
    { key:"servicos", icon:"tools", label:"Serviços" },
    { key:"estoque", icon:"box", label:"Estoque" },
    { key:"fiado",   icon:"users", label:"Cliente" },
    { key:"caixa",   icon:"cash", label:"Caixa"   },
    { key:"config",  icon:"gear", label:"Config"  },
  ];

  const NAV_ITEMS = NAV_ITEMS_ALL.filter(({ key }) => {
    const normalizedKey = key === "" ? "inicio" : key;
    const accessKey = normalizedKey === "fiado" ? "cliente" : normalizedKey;

    if (businessType === "master") return ["inicio", "config"].includes(accessKey);
    if (businessType === "comercio" && accessKey === "servicos") return false;

    return hasPlanAccess(accessKey, currentPlan, isPlatformAdmin);
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
    if (name === "tools") return <svg {...common}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4"/><path d="m15 5 4 4"/><path d="m4 20 4-4"/></svg>;
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

    const soldByProduct = {};
    (sales || []).forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const id = item.id || item.barcode || item.name;
        const qty = Number(item.qty) || 0;
        const unitPrice = Number(item.price) || 0;
        const prod = products.find(pr => pr.id === item.id || pr.barcode === item.barcode || pr.name === item.name) || {};
        const unitCost = Number(item.cost ?? prod.cost ?? prod.custo ?? 0);
        if (!soldByProduct[id]) {
          soldByProduct[id] = {
            id,
            name: item.name || prod.name || "Produto",
            qty: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            lastSale: null
          };
        }
        soldByProduct[id].qty += qty;
        soldByProduct[id].revenue += qty * unitPrice;
        soldByProduct[id].cost += qty * unitCost;
        soldByProduct[id].profit += qty * (unitPrice - unitCost);
        const d = sale.date ? new Date(sale.date) : null;
        if (d && (!soldByProduct[id].lastSale || d > soldByProduct[id].lastSale)) soldByProduct[id].lastSale = d;
      });
    });

    const productAnalysis = Object.values(soldByProduct)
      .sort((a,b)=>b.profit-a.profit);

    const totalProfitProducts = productAnalysis.reduce((sum,p)=>sum+Math.max(0,p.profit),0);
    let accumulated = 0;
    const abcProducts = productAnalysis.map((prod) => {
      accumulated += Math.max(0, prod.profit);
      const pct = totalProfitProducts > 0 ? (accumulated / totalProfitProducts) * 100 : 100;
      const curve = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return { ...prod, curve };
    });

    const productsA = abcProducts.filter(p=>p.curve==="A");
    const championProducts = productsA.slice(0,3);

    const now = new Date();
    const staleProducts = (products || []).map((prod) => {
      const metric = soldByProduct[prod.id] || soldByProduct[prod.barcode] || soldByProduct[prod.name];
      const lastSale = metric?.lastSale || null;
      const daysWithoutSale = lastSale ? Math.floor((now - lastSale) / (1000*60*60*24)) : 999;
      const stock = Number(prod.stock) || 0;
      const cost = Number(prod.cost ?? prod.custo ?? 0);
      const price = Number(prod.price ?? prod.venda ?? 0);
      const value = stock * (cost || price);
      return { ...prod, lastSale, daysWithoutSale, stockValue:value };
    }).filter(p => (Number(p.stock)||0) > 0 && p.daysWithoutSale >= 60);

    const staleStockValue = staleProducts.reduce((sum,p)=>sum+(Number(p.stockValue)||0),0);

    const totalRevenue = (sales || []).reduce((sum,s)=>sum+(Number(s.total)||0),0);
    const estimatedCost = (sales || []).reduce((sum,sale)=>{
      return sum + (sale.items || []).reduce((acc,item)=>{
        const prod = products.find(pr => pr.id === item.id || pr.barcode === item.barcode || pr.name === item.name) || {};
        const qty = Number(item.qty)||0;
        const unitCost = Number(item.cost ?? prod.cost ?? prod.custo ?? 0);
        return acc + qty * unitCost;
      },0);
    },0);
    const grossProfit = totalRevenue - estimatedCost;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const cashReceived = (sales || []).reduce((sum,sale)=>{
      return sum + (sale.payments || [])
        .filter(p=>p.method!=="crediario" && p.method!=="fiado")
        .reduce((acc,p)=>acc+(Number(p.amount)||0),0);
    },0);

    return (
      <div>
        {(lowStockProducts.length>0 || overdueFiado.length>0 || staleProducts.length>0) && (
          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)", marginBottom:"14px", border:"1.5px solid #fee2e2" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", marginBottom:"10px" }}>
              <div>
                <div style={{ fontWeight:"900", fontSize:"20px", color:"#0f172a" }}>Alertas importantes</div>
                <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>Veja o que precisa de atenção agora.</div>
              </div>
              <div style={{ background:"#ef4444", color:"#fff", borderRadius:"999px", minWidth:"34px", height:"34px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"900" }}>
                {lowStockProducts.length + overdueFiado.length + staleProducts.length}
              </div>
            </div>

            {lowStockProducts.length>0 && (
              <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:"14px", padding:"12px", marginBottom:"8px" }}>
                <div style={{ fontWeight:"900", color:"#991b1b" }}>{lowStockProducts.length} produto(s) com estoque baixo</div>
                <div style={{ color:"#991b1b", fontSize:"13px", fontWeight:"700" }}>Produtos com 5 unidades ou menos.</div>
                <button onClick={()=>setTab("estoque")} style={{ ...btn("#dc2626"), padding:"9px 12px", fontSize:"13px", marginTop:"8px" }}>Ver estoque</button>
              </div>
            )}

            {staleProducts.length>0 && (
              <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:"14px", padding:"12px", marginBottom:"8px" }}>
                <div style={{ fontWeight:"900", color:"#9a3412" }}>Dinheiro parado no estoque: {fmtCur(staleStockValue)}</div>
                <div style={{ color:"#9a3412", fontSize:"13px", fontWeight:"700" }}>{staleProducts.length} produto(s) sem venda há mais de 60 dias.</div>
                <button onClick={()=>setTab("estoque")} style={{ ...btn("#f97316"), padding:"9px 12px", fontSize:"13px", marginTop:"8px" }}>Ver estoque</button>
              </div>
            )}

            {overdueFiado.length>0 && (
              <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:"14px", padding:"12px" }}>
                <div style={{ fontWeight:"900", color:"#9a3412" }}>{overdueFiado.length} crediário(s) vencido(s)</div>
                <div style={{ color:"#9a3412", fontSize:"13px", fontWeight:"700" }}>Clientes com pagamento em atraso.</div>
                <button onClick={()=>setTab("fiado")} style={{ ...btn("#f97316"), padding:"9px 12px", fontSize:"13px", marginTop:"8px" }}>Ver clientes</button>
              </div>
            )}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:"12px", marginBottom:"14px" }}>
          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)" }}>
            <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"900" }}>Vendas hoje</div>
            <div style={{ fontSize:"30px", fontWeight:"900", color:"#16a34a", marginTop:"4px" }}>{fmtCur(salesTodayTotal)}</div>
            <div style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"700" }}>{salesOfToday.length} venda(s) registradas hoje.</div>
          </div>

          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)" }}>
            <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"900" }}>Crediário aberto</div>
            <div style={{ fontSize:"30px", fontWeight:"900", color:"#f97316", marginTop:"4px" }}>{fmtCur(fiadoTotal)}</div>
            <div style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"700" }}>Valor ainda não recebido.</div>
          </div>

          <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)" }}>
            <div style={{ fontSize:"13px", color:"#64748b", fontWeight:"900" }}>Estoque baixo</div>
            <div style={{ fontSize:"30px", fontWeight:"900", color:"#dc2626", marginTop:"4px" }}>{lowStockProducts.length}</div>
            <div style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"700" }}>Produtos que precisam de atenção.</div>
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)", marginBottom:"14px" }}>
          <div style={{ fontWeight:"900", fontSize:"19px", color:"#0f172a", marginBottom:"4px" }}>Inteligência ERPmini</div>
          <div style={{ color:"#64748b", fontSize:"13px", fontWeight:"700", marginBottom:"12px" }}>Curva ABC automática e dinheiro parado em estoque.</div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
            <div style={{ background:"#ecfdf5", border:"1px solid #bbf7d0", borderRadius:"14px", padding:"12px" }}>
              <div style={{ color:"#166534", fontWeight:"900", fontSize:"13px" }}>Produtos A - campeões</div>
              <div style={{ color:"#166534", fontSize:"12px", fontWeight:"700", marginTop:"3px" }}>Não deixe faltar no estoque.</div>
              {championProducts.length===0 ? (
                <div style={{ color:"#94a3b8", fontSize:"12px", marginTop:"8px" }}>Ainda não há vendas suficientes.</div>
              ) : championProducts.map(p=>(
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", borderTop:"1px solid #bbf7d0", marginTop:"8px", paddingTop:"8px", gap:"8px" }}>
                  <span style={{ fontWeight:"900", color:"#0f172a" }}>{p.name}</span>
                  <strong style={{ color:"#16a34a" }}>{fmtCur(p.profit)}</strong>
                </div>
              ))}
            </div>

            <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"14px", padding:"12px" }}>
              <div style={{ color:"#9a3412", fontWeight:"900", fontSize:"13px" }}>Produtos C / parados</div>
              <div style={{ color:"#9a3412", fontSize:"12px", fontWeight:"700", marginTop:"3px" }}>Itens com baixo giro ou sem venda.</div>
              <div style={{ fontSize:"24px", fontWeight:"900", color:"#f97316", marginTop:"8px" }}>{fmtCur(staleStockValue)}</div>
              <div style={{ color:"#9a3412", fontSize:"12px", fontWeight:"800" }}>parados há 60+ dias</div>
            </div>
          </div>

          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"14px", padding:"12px" }}>
            <div style={{ fontWeight:"900", color:"#334155", marginBottom:"8px" }}>Leitura rápida</div>
            <div style={{ color:"#64748b", fontSize:"13px", lineHeight:1.45, fontWeight:"700" }}>
              {staleStockValue > 0
                ? `Antes de comprar novos produtos, avalie vender ou promover os itens parados. Você tem ${fmtCur(staleStockValue)} imobilizados em estoque sem giro.`
                : "Seu estoque não tem produtos parados há mais de 60 dias. Continue acompanhando os produtos campeões."}
            </div>
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)", marginBottom:"14px" }}>
          <div style={{ fontWeight:"900", fontSize:"19px", color:"#0f172a", marginBottom:"4px" }}>Inteligência de clientes</div>
          <div style={{ color:"#64748b", fontSize:"13px", fontWeight:"700", marginBottom:"12px" }}>
            Ranking, ticket médio, crediário e clientes inativos.
          </div>

          {(() => {
            const clientMap = {};
            (clients || []).forEach(c => {
              const key = c.id || c.name;
              clientMap[key] = {
                id: key,
                name: c.name || "Cliente",
                phone: c.phone || "",
                purchases: 0,
                total: 0,
                openCredit: 0,
                lastPurchase: null,
                ticket: 0
              };
            });

            (sales || []).forEach(sale => {
              const cId = sale.fiado?.clientId || sale.clientId || sale.customerId || sale.client?.id || sale.fiado?.clientName || sale.clientName;
              const cName = sale.fiado?.clientName || sale.clientName || sale.client?.name || "Cliente não informado";
              if (!cId && !sale.fiado?.clientName && !sale.clientName) return;
              const key = cId || cName;

              if (!clientMap[key]) {
                clientMap[key] = { id:key, name:cName, phone:"", purchases:0, total:0, openCredit:0, lastPurchase:null, ticket:0 };
              }

              clientMap[key].purchases += 1;
              clientMap[key].total += Number(sale.total) || 0;

              const saleDate = sale.date ? new Date(sale.date) : null;
              if (saleDate && (!clientMap[key].lastPurchase || saleDate > clientMap[key].lastPurchase)) {
                clientMap[key].lastPurchase = saleDate;
              }

              if (sale.fiado && !sale.fiado.paid) {
                clientMap[key].openCredit += Math.max(0, (Number(sale.total)||0) - (Number(sale.fiado?.paidAmount)||0));
              }
            });

            (receivables || []).forEach(r => {
              if (r.paid) return;
              const key = r.clientId || r.clientName || r.id;
              if (!clientMap[key]) {
                clientMap[key] = { id:key, name:r.clientName || "Cliente", phone:"", purchases:0, total:0, openCredit:0, lastPurchase:null, ticket:0 };
              }
              clientMap[key].openCredit += Math.max(0, (Number(r.amount)||0) - (Number(r.paidAmount)||0));
            });

            const now = new Date();
            const ranked = Object.values(clientMap)
              .map(c => ({
                ...c,
                ticket: c.purchases > 0 ? c.total / c.purchases : 0,
                inactiveDays: c.lastPurchase ? Math.floor((now - c.lastPurchase) / (1000*60*60*24)) : 999
              }))
              .filter(c => c.total > 0 || c.openCredit > 0)
              .sort((a,b)=>b.total-a.total);

            const topClient = ranked[0];
            const mostPurchases = [...ranked].sort((a,b)=>b.purchases-a.purchases)[0];
            const topCredit = [...ranked].sort((a,b)=>b.openCredit-a.openCredit)[0];
            const bestTicket = [...ranked].sort((a,b)=>b.ticket-a.ticket)[0];
            const inactive = ranked.filter(c => c.inactiveDays >= 30 && c.purchases > 0).sort((a,b)=>b.total-a.total);

            const medalStyle = (idx) => {
              if (idx === 0) return { bg:"#fffbeb", border:"#fbbf24", medalBg:"#fef3c7", medalColor:"#92400e", label:"🥇" };
              if (idx === 1) return { bg:"#f8fafc", border:"#cbd5e1", medalBg:"#e2e8f0", medalColor:"#334155", label:"🥈" };
              if (idx === 2) return { bg:"#fff7ed", border:"#fdba74", medalBg:"#fed7aa", medalColor:"#9a3412", label:"🥉" };
              return { bg:"#f8fafc", border:"#e2e8f0", medalBg:"#e2e8f0", medalColor:"#475569", label:String(idx+1) };
            };

            if (ranked.length === 0) {
              return <div style={{ color:"#94a3b8", fontWeight:"800", textAlign:"center", padding:"16px 0" }}>Ainda não há compras por cliente suficientes para gerar inteligência comercial.</div>;
            }

            const miniCards = [
              ["Melhor cliente", topClient?.name || "-", fmtCur(topClient?.total || 0), "#16a34a", "Quem mais gerou faturamento."],
              ["Mais compras", mostPurchases?.name || "-", `${mostPurchases?.purchases || 0} compra(s)`, "#2563eb", "Cliente mais recorrente."],
              ["Maior crediário", topCredit?.name || "-", fmtCur(topCredit?.openCredit || 0), "#f97316", "Prioridade de cobrança."],
              ["Maior ticket", bestTicket?.name || "-", fmtCur(bestTicket?.ticket || 0), "#7c3aed", "Maior média por compra."]
            ];

            return (
              <>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"10px", marginBottom:"12px" }}>
                  {miniCards.map(([title,name,value,color,sub],idx)=>(
                    <div key={idx} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"14px", padding:"12px" }}>
                      <div style={{ color:"#64748b", fontSize:"11px", fontWeight:"900" }}>{title}</div>
                      <div style={{ color:"#0f172a", fontSize:"15px", fontWeight:"900", marginTop:"4px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</div>
                      <div style={{ color, fontSize:"18px", fontWeight:"900", marginTop:"2px" }}>{value}</div>
                      <div style={{ color:"#94a3b8", fontSize:"10px", fontWeight:"800", marginTop:"3px" }}>{sub}</div>
                    </div>
                  ))}
                </div>

                {inactive.length > 0 && (
                  <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
                    <div style={{ color:"#9a3412", fontWeight:"900" }}>{inactive.length} cliente(s) inativo(s) há mais de 30 dias</div>
                    <div style={{ color:"#9a3412", fontSize:"13px", fontWeight:"700", marginTop:"3px" }}>
                      Sugestão: chamar esses clientes no WhatsApp com promoção ou lembrete.
                    </div>
                    <div style={{ display:"grid", gap:"6px", marginTop:"10px" }}>
                      {inactive.slice(0,3).map(c=>(
                        <button key={c.id} onClick={()=>setSelectedIntelClient(c)} style={{ display:"flex", justifyContent:"space-between", gap:"8px", background:"#fff", border:"none", borderRadius:"10px", padding:"8px", fontSize:"12px", cursor:"pointer", textAlign:"left" }}>
                          <strong style={{ color:"#0f172a" }}>{c.name}</strong>
                          <span style={{ color:"#9a3412", fontWeight:"900" }}>{c.inactiveDays} dias</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display:"grid", gap:"8px" }}>
                  {ranked.slice(0,5).map((c,idx)=>{
                    const s = medalStyle(idx);
                    return (
                      <button key={c.id || c.name || idx} onClick={()=>setSelectedIntelClient(c)} style={{ display:"grid", gridTemplateColumns:"auto 1fr auto", gap:"10px", alignItems:"center", border:`1.5px solid ${s.border}`, borderRadius:"14px", padding:"10px", background:s.bg, cursor:"pointer", textAlign:"left", boxShadow:idx<3?"0 6px 18px rgba(15,23,42,.08)":"none" }}>
                        <div style={{ width:"38px", height:"38px", borderRadius:"13px", background:s.medalBg, color:s.medalColor, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"900", fontSize:idx<3?"19px":"15px" }}>{s.label}</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:"900", color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</div>
                          <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>
                            {c.purchases} compra(s) • Ticket: {fmtCur(c.ticket)} • Crediário: {fmtCur(c.openCredit)}
                          </div>
                        </div>
                        <div style={{ textAlign:"right", fontWeight:"900", color:"#16a34a" }}>{fmtCur(c.total)}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

        <div style={{ background:"#fff", borderRadius:"18px", padding:"16px", boxShadow:"0 8px 24px rgba(15,23,42,.08)", marginBottom:"14px" }}>
          <div style={{ fontWeight:"900", fontSize:"19px", color:"#0f172a", marginBottom:"4px" }}>DRE simples</div>
          <div style={{ color:"#64748b", fontSize:"13px", fontWeight:"700", marginBottom:"12px" }}>Visão rápida de resultado com base no custo cadastrado dos produtos.</div>

          <div style={{ display:"grid", gap:"9px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9", paddingBottom:"8px" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Receita em vendas</span>
              <strong style={{ color:"#2563eb" }}>{fmtCur(totalRevenue)}</strong>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9", paddingBottom:"8px" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Custo estimado</span>
              <strong style={{ color:"#ef4444" }}>{fmtCur(estimatedCost)}</strong>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9", paddingBottom:"8px" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Lucro bruto estimado</span>
              <strong style={{ color:grossProfit>=0?"#16a34a":"#ef4444" }}>{fmtCur(grossProfit)}</strong>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9", paddingBottom:"8px" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Margem bruta</span>
              <strong style={{ color:"#7c3aed" }}>{grossMargin.toFixed(1)}%</strong>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"#64748b", fontWeight:"800" }}>Recebido à vista/cartão/PIX</span>
              <strong style={{ color:"#0f172a" }}>{fmtCur(cashReceived)}</strong>
            </div>
          </div>
        </div>

        {isStarter && (
          <div style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe", borderRadius:"16px", padding:"14px", color:"#1d4ed8", fontWeight:"800", fontSize:"13px", lineHeight:1.45 }}>
            Recursos como Caixa profissional, relatórios avançados, Fiscal e backup completo ficam disponíveis nos planos pagos.
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

    const { RelatoriosCaixa, FinanceiroCaixa } = CashFinanceReports({
      isMobile, fmtCur, vendasHoje, vendasSemanaTotal, vendasMesTotal, ticketMes,
      receivablesNext30Total, payablesNext7, payableAmount, cashFlow30, receivablesOpenTotal,
      byMethod, entradas, topClientesCaixa, topProdutosCaixa, salesMonthTotal,
      payablesMonthTotal, payablesPaidMonthTotal, expectedMonthBalance, fiadoAbertoLista,
      fiadoOpenAmount, card, financeiroView, setFinanceiroView, dayKey, openPayables,
      openReceivables, payablesOpenTotal, payablesDueTodayTotal, payablesOverdueTotal,
      newPayable, setNewPayable, notify, inp, purchaseItems, products, updatePurchaseItem,
      btn, parseMoney, removePurchaseItemRow, addPurchaseItemRow, purchaseItemsTotal,
      addPayable, markPayablePaid, deletePayable, receivablesDueTodayTotal,
      receivablesOverdueTotal, newReceivable, setNewReceivable, addReceivable,
      receivableOpenAmount, receivablePaid, receiveReceivable, deleteReceivable,
      paidReceivables, fmtDate
    });

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

        {caixaView==="resumo" && (
          <CashSummary
            isMobile={isMobile}
            entries={entradas}
            salesToday={vendasHoje}
            creditSalesToday={fiadoHoje}
            creditReceivedToday={recebimentosFiadoHoje}
            paymentSummary={byMethod}
            getPaymentLabel={mLabel}
            getPaymentColor={mColor}
            getCashOpening={cashOpeningOfDay}
            getLastCashClosure={lastCashClosureOfDay}
            getCashClosures={cashClosuresOfDay}
            getCashOperationTotals={cashOpsTotals}
            getCashOperations={cashOpsOfDay}
            getExpectedCashBalance={expectedCashBalance}
            dayKey={dayKey}
            latestPayments={ultimosPagamentos}
            openingValue={cashOpeningValue}
            setOpeningValue={setCashOpeningValue}
            onOpenCash={openCash}
            operationForm={cashOpForm}
            setOperationForm={setCashOpForm}
            onAddOperation={addCashOperation}
            realValue={cashRealValue}
            setRealValue={setCashRealValue}
            onCloseCash={closeCash}
          />
        )}
        {caixaView==="relatorios" && RelatoriosCaixa()}
        {caixaView==="financeiro" && FinanceiroCaixa()}
        {caixaView==="historico" && HistoricoCaixa()}
      </div>
    );
  };


  // --- Config tab -------------------------------------------------------------
  const ConfigTab = () => (
    <div>
      {isPlatformAdmin && adminWorkspace === "master" && (
        <MasterSaasPanel
          supabase={supabase}
          cloudTable={CLOUD_TABLE}
          isMobile={isMobile}
          fmtCur={fmtCur}
          fmtDate={fmtDate}
          normalizePlan={normalizePlan}
          btn={btn}
          btnSm={btnSm}
          inp={inp}
          card={card}
        />
      )}
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
        <span style={{ fontSize:"10px", background:"rgba(255,255,255,0.12)", color:"#cbd5e1", borderRadius:"20px", padding:"2px 6px" }}>v6-piloto-comercial</span>
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

      {isPlatformAdmin && (
        <div style={{ padding:isMobile?"10px 12px 0":"12px 24px 0", maxWidth:"1200px", margin:"0 auto" }}>
          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"18px", padding:"10px", boxShadow:"0 4px 16px rgba(15,23,42,.06)", display:"grid", gridTemplateColumns:isMobile?"1fr 1fr 1fr":"repeat(3, 1fr)", gap:"8px" }}>
            {[
              ["comercio", "Comércio"],
              ["servicos", "Serviços"],
              ["master", "Painel Master"],
            ].map(([key,label])=>(
              <button
                key={key}
                onClick={()=>{
                  setAdminWorkspace(key);
                  if (key === "master") setTab("config");
                  else setTab("");
                }}
                style={{
                  border:"none",
                  borderRadius:"14px",
                  padding:isMobile?"10px 6px":"12px",
                  fontWeight:"900",
                  cursor:"pointer",
                  background:adminWorkspace===key?"#e94560":"#f1f5f9",
                  color:adminWorkspace===key?"#fff":"#64748b",
                  fontSize:isMobile?"12px":"14px"
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding:isMobile?"12px":"24px", maxWidth:"1200px", margin:"0 auto" }}>
        {tab==="" && DashboardTab()}
        {tab==="pdv"     && hasPlanAccess("pdv", currentPlan, isPlatformAdmin) && PDVTab()}
        {tab==="servicos" && businessType !== "comercio" && hasPlanAccess("servicos", currentPlan, isPlatformAdmin) && (
          <ServicesModule
            products={products}
            setProducts={setProducts}
            clients={clients}
            setClients={setClients}
            services={services}
            setServices={setServices}
            serviceCatalog={serviceCatalog}
            setServiceCatalog={setServiceCatalog}
            sales={sales}
            setSales={setSales}
            receivables={receivables}
            setReceivables={setReceivables}
            storeName={storeName}
            fmtCur={fmtCur}
            fmtDate={fmtDate}
            isMobile={isMobile}
            btn={btn}
            btnSm={btnSm}
            inp={inp}
            card={card}
            notify={notify}
          />
        )}
        {tab==="estoque" && hasPlanAccess("estoque", currentPlan, isPlatformAdmin) && (
          <InventoryTab
            isMobile={isMobile}
            editingId={editingId}
            setEditingId={setEditingId}
            newProduct={newProduct}
            setNewProduct={setNewProduct}
            products={products}
            searchProduct={searchProd}
            setSearchProduct={setSearchProd}
            onSave={saveProduct}
            onEdit={editProduct}
            onDelete={deleteProduct}
            onPrintLabels={printProductLabels}
            onShowBarcode={setShowBarcodeModal}
          />
        )}
        {tab==="vendas" && HistoricoTab()}
        {tab==="caixa"   && hasPlanAccess("caixa", currentPlan, isPlatformAdmin) && CaixaTab()}
        {tab==="fiado" && hasPlanAccess("cliente", currentPlan, isPlatformAdmin) && (
          <ClientsTab
            isMobile={isMobile}
            clients={clients}
            newClient={newClient}
            setNewClient={setNewClient}
            openCreditSales={fiadoSales}
            openCreditTotal={fiadoTotal}
            getOpenAmount={fiadoOpenAmount}
            getClientBalance={clientBalance}
            onSaveClient={saveClient}
            onDeleteClient={deleteClient}
            onOpenHistory={setSelectedClientHistory}
            onWhatsApp={cobrarWhatsApp}
            onReceive={openReceiveFiado}
            onReceipt={(sale)=>{setSelectedSale(sale);setShowReceipt(true);}}
          />
        )}
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
      {selectedClientHistory && (
        <ClientHistoryModal
          client={selectedClientHistory}
          onClose={()=>setSelectedClientHistory(null)}
          sales={clientSales(selectedClientHistory.id)}
          getOpenAmount={fiadoOpenAmount}
          getClientBalance={clientBalance}
          getClientTotalBought={clientTotalBought}
          getClientTotalPaid={clientTotalPaid}
          onWhatsApp={cobrarWhatsApp}
          onReceive={openReceiveFiado}
          onReceipt={(sale)=>{setSelectedSale(sale);setShowReceipt(true);}}
        />
      )}

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

      {confirmDeleteReceivable && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.55)", zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:"18px" }}>
          <div style={{ background:"#fff", width:"100%", maxWidth:"420px", borderRadius:"22px", padding:"18px", boxShadow:"0 24px 70px rgba(0,0,0,.28)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
              <div style={{ width:"44px", height:"44px", borderRadius:"14px", background:"#fee2e2", color:"#dc2626", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", fontWeight:"900" }}>!</div>
              <div>
                <div style={{ fontWeight:"900", fontSize:"20px", color:"#0f172a" }}>Excluir conta a receber?</div>
                <div style={{ color:"#64748b", fontSize:"13px", fontWeight:"700" }}>Esta ação remove o lançamento do ERPmini.</div>
              </div>
            </div>

            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"16px", padding:"14px", margin:"14px 0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", borderBottom:"1px solid #e2e8f0", paddingBottom:"8px", marginBottom:"8px" }}>
                <span style={{ color:"#64748b", fontWeight:"800" }}>Cliente</span>
                <strong style={{ color:"#0f172a", textAlign:"right" }}>{confirmDeleteReceivable.clientName || "-"}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", borderBottom:"1px solid #e2e8f0", paddingBottom:"8px", marginBottom:"8px" }}>
                <span style={{ color:"#64748b", fontWeight:"800" }}>Documento</span>
                <strong style={{ color:"#0f172a", textAlign:"right" }}>{confirmDeleteReceivable.document || "-"}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px" }}>
                <span style={{ color:"#64748b", fontWeight:"800" }}>Valor em aberto</span>
                <strong style={{ color:"#dc2626", textAlign:"right", fontSize:"18px" }}>{fmtCur(receivableOpenAmount(confirmDeleteReceivable))}</strong>
              </div>
            </div>

            <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", color:"#9a3412", borderRadius:"14px", padding:"10px 12px", fontSize:"13px", fontWeight:"800", marginBottom:"14px" }}>
              Confirme somente se esta conta foi lançada por engano.
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <button style={{ ...btn("#e2e8f0"), color:"#334155", padding:"13px" }} onClick={()=>setConfirmDeleteReceivable(null)}>Cancelar</button>
              <button style={{ ...btn("#dc2626"), padding:"13px" }} onClick={confirmDeleteReceivableNow}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {selectedIntelClient && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.58)", zIndex:120, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:isMobile?"0":"18px" }}>
          <div style={{ background:"#fff", width:"100%", maxWidth:"460px", borderRadius:isMobile?"24px 24px 0 0":"24px", padding:"18px", boxShadow:"0 24px 70px rgba(0,0,0,.30)", maxHeight:"88vh", overflowY:"auto" }}>
            <div style={{ width:"48px", height:"5px", background:"#cbd5e1", borderRadius:"999px", margin:"0 auto 16px" }} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px", marginBottom:"12px" }}>
              <div>
                <div style={{ fontWeight:"900", fontSize:"24px", color:"#0f172a" }}>{selectedIntelClient.name}</div>
                <div style={{ color:"#64748b", fontWeight:"700", marginTop:"2px" }}>Resumo comercial do cliente</div>
              </div>
              <button onClick={()=>setSelectedIntelClient(null)} style={{ border:"none", background:"#f1f5f9", borderRadius:"14px", width:"42px", height:"42px", fontSize:"20px", cursor:"pointer" }}>×</button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
              <div style={{ background:"#ecfdf5", border:"1px solid #bbf7d0", borderRadius:"14px", padding:"12px" }}>
                <div style={{ color:"#166534", fontWeight:"900", fontSize:"12px" }}>Faturamento</div>
                <div style={{ color:"#16a34a", fontWeight:"900", fontSize:"22px" }}>{fmtCur(selectedIntelClient.total || 0)}</div>
              </div>
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"14px", padding:"12px" }}>
                <div style={{ color:"#1d4ed8", fontWeight:"900", fontSize:"12px" }}>Compras</div>
                <div style={{ color:"#2563eb", fontWeight:"900", fontSize:"22px" }}>{selectedIntelClient.purchases || 0}</div>
              </div>
              <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"14px", padding:"12px" }}>
                <div style={{ color:"#9a3412", fontWeight:"900", fontSize:"12px" }}>Crediário</div>
                <div style={{ color:"#f97316", fontWeight:"900", fontSize:"22px" }}>{fmtCur(selectedIntelClient.openCredit || 0)}</div>
              </div>
              <div style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:"14px", padding:"12px" }}>
                <div style={{ color:"#6d28d9", fontWeight:"900", fontSize:"12px" }}>Ticket médio</div>
                <div style={{ color:"#7c3aed", fontWeight:"900", fontSize:"22px" }}>{fmtCur(selectedIntelClient.ticket || 0)}</div>
              </div>
            </div>

            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", marginBottom:"6px" }}>
                <span style={{ color:"#64748b", fontWeight:"800" }}>Última compra</span>
                <strong style={{ color:"#0f172a" }}>{selectedIntelClient.lastPurchase ? fmtDate(selectedIntelClient.lastPurchase) : "-"}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px" }}>
                <span style={{ color:"#64748b", fontWeight:"800" }}>Telefone/WhatsApp</span>
                <strong style={{ color:"#0f172a" }}>{selectedIntelClient.phone || "-"}</strong>
              </div>
            </div>

            <div style={{ display:"grid", gap:"10px" }}>
              <button style={{ ...btn("#e94560"), padding:"14px" }} onClick={()=>goSellToIntelClient(selectedIntelClient)}>Vender para este cliente</button>
              <button style={{ ...btn("#16a34a"), padding:"14px" }} onClick={()=>goReceiveFromIntelClient(selectedIntelClient)} disabled={(selectedIntelClient.openCredit || 0) <= 0}>Receber crediário</button>
              <button style={{ ...btn("#22c55e"), padding:"14px" }} onClick={()=>openIntelClientWhatsApp(selectedIntelClient)}>Chamar no WhatsApp</button>
              <button style={{ ...btn("#e2e8f0"), color:"#334155", padding:"12px" }} onClick={()=>setSelectedIntelClient(null)}>Fechar</button>
            </div>
          </div>
        </div>
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
