import { fmtCur, fmtDate } from "../utils/format.js";

const inputStyle = { width:"100%", padding:"10px 12px", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"15px", boxSizing:"border-box", outline:"none" };
const button = (color) => ({ background:color||"#e94560", color:"#fff", border:"none", borderRadius:"10px", padding:"12px 18px", cursor:"pointer", fontWeight:"700", fontSize:"15px" });
const smallButton = (color) => ({ background:color||"#64748b", color:"#fff", border:"none", borderRadius:"8px", padding:"7px 10px", cursor:"pointer", fontSize:"12px", fontWeight:"700", minWidth:"64px" });
const card = { background:"#fff", borderRadius:"14px", padding:"16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", marginBottom:"14px" };

export default function ClientsTab({
  isMobile,
  clients,
  newClient,
  setNewClient,
  openCreditSales,
  openCreditTotal,
  getOpenAmount,
  getClientBalance,
  onSaveClient,
  onDeleteClient,
  onOpenHistory,
  onWhatsApp,
  onReceive,
  onReceipt
}) {
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
        <div style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:"12px", padding:"16px", color:"#fff" }}>
          <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>Total em aberto</div>
          <div style={{ fontSize:"22px", fontWeight:"900" }}>{fmtCur(openCreditTotal)}</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#6366f1,#4338ca)", borderRadius:"12px", padding:"16px", color:"#fff" }}>
          <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>Clientes cadastrados</div>
          <div style={{ fontSize:"22px", fontWeight:"900" }}>{clients.length}</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}> Novo Cliente</div>
        <input style={{ ...inputStyle, marginBottom:"8px" }} placeholder="Nome do cliente" value={newClient.name} onChange={event=>setNewClient({...newClient,name:event.target.value})} />
        <input style={{ ...inputStyle, marginBottom:"8px" }} placeholder="WhatsApp" value={newClient.phone} onChange={event=>setNewClient({...newClient,phone:event.target.value})} />
        <input style={{ ...inputStyle, marginBottom:"12px" }} type="number" placeholder="Limite de credito opcional" value={newClient.limit} onChange={event=>setNewClient({...newClient,limit:event.target.value})} />
        <button style={{ ...button(), width:"100%" }} onClick={onSaveClient}> Cadastrar Cliente</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}> Clientes e saldos</div>
        {clients.length === 0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhum cliente cadastrado.</div>
        ) : clients.map((client) => {
          const balance = getClientBalance(client.id);
          const available = client.limit > 0 ? client.limit - balance : null;
          return (
            <div key={client.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:"800", fontSize:"15px" }}>{client.name}</div>
                  <div style={{ color:"#94a3b8", fontSize:"12px" }}>{client.phone || "Sem WhatsApp"}</div>
                  {client.limit>0 && <div style={{ color:"#64748b", fontSize:"12px" }}>Limite: {fmtCur(client.limit)} | Disponivel: {fmtCur(available)}</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:balance>0?"#e94560":"#16a34a", fontSize:"16px" }}>{fmtCur(balance)}</div>
                  <div style={{ color:"#94a3b8", fontSize:"11px" }}>{balance>0?"em aberto":"sem debito"}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:"6px", marginTop:"8px", flexWrap:"wrap" }}>
                <button style={smallButton("#6366f1")} onClick={()=>onOpenHistory(client)}>Historico</button>
                <button style={smallButton("#16a34a")} onClick={()=>onWhatsApp(client)}>WhatsApp</button>
                <button style={smallButton("#64748b")} onClick={()=>onDeleteClient(client.id)}>Excluir</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <div style={{ fontWeight:"800", fontSize:"16px", marginBottom:"12px" }}> Crediário em aberto</div>
        {openCreditSales.length === 0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px" }}>Nenhuma venda em crediário em aberto.</div>
        ) : openCreditSales.map((sale) => {
          const paid = sale.fiado?.paidAmount || 0;
          const open = getOpenAmount(sale);
          const payments = sale.fiado?.payments || [];
          return (
            <div key={sale.id} style={{ padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
                <div>
                  <div style={{ fontWeight:"800" }}>#{sale.id} - {sale.fiado.clientName}</div>
                  <div style={{ color:"#94a3b8", fontSize:"12px" }}>{fmtDate(sale.date)} {sale.fiado.dueDate ? `- Vence: ${sale.fiado.dueDate}` : ""}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", marginTop:"4px" }}>Compra: {fmtCur(sale.total)} | Pago: {fmtCur(paid)}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:"#e94560" }}>{fmtCur(open)}</div>
                  <div style={{ color:"#94a3b8", fontSize:"11px" }}>saldo</div>
                </div>
              </div>
              {payments.length>0 && (
                <div style={{ marginTop:"8px", background:"#f8fafc", borderRadius:"10px", padding:"8px" }}>
                  <div style={{ fontSize:"12px", fontWeight:"800", color:"#64748b", marginBottom:"4px" }}>Histórico de pagamentos</div>
                  {payments.map((payment,index)=><div key={index} style={{ fontSize:"12px", color:"#64748b" }}>{fmtDate(payment.date)} - {fmtCur(payment.amount)}</div>)}
                </div>
              )}
              <div style={{ display:"flex", gap:"6px", marginTop:"8px", flexWrap:"wrap" }}>
                <button style={smallButton("#16a34a")} onClick={()=>onReceive(sale.id)}>Receber</button>
                <button style={smallButton("#6366f1")} onClick={()=>onReceipt(sale)}>Recibo</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClientHistoryModal({
  client,
  onClose,
  sales,
  getOpenAmount,
  getClientBalance,
  getClientTotalBought,
  getClientTotalPaid,
  onWhatsApp,
  onReceive,
  onReceipt
}) {
  if (!client) return null;
  const history = [...sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const balance = getClientBalance(client.id);
  const totalBought = getClientTotalBought(client.id);
  const totalPaid = getClientTotalPaid(client.id);
  const averageTicket = history.length ? totalBought / history.length : 0;
  const firstPurchase = history.length ? history[history.length-1].date : null;
  const lastPurchase = history.length ? history[0].date : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:500, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"20px 16px 28px", width:"100%", maxWidth:"620px", maxHeight:"92vh", overflowY:"auto" }} onClick={event=>event.stopPropagation()}>
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
          <Metric label="Saldo em aberto" value={fmtCur(balance)} background="#fef2f2" labelColor="#991b1b" valueColor="#dc2626" />
          <Metric label="Total pago" value={fmtCur(totalPaid)} background="#f0fdf4" labelColor="#166534" valueColor="#16a34a" />
          <Metric label="Total comprado" value={fmtCur(totalBought)} background="#eff6ff" labelColor="#1d4ed8" valueColor="#2563eb" />
          <Metric label="Ticket medio" value={fmtCur(averageTicket)} background="#f8fafc" labelColor="#475569" valueColor="#334155" />
        </div>

        <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
          <div style={{ fontWeight:"800", fontSize:"14px", marginBottom:"6px" }}>Resumo</div>
          <div style={{ fontSize:"13px", color:"#64748b" }}>Compras fiadas: <strong>{history.length}</strong></div>
          <div style={{ fontSize:"13px", color:"#64748b" }}>Primeira compra: <strong>{firstPurchase ? fmtDate(firstPurchase) : "-"}</strong></div>
          <div style={{ fontSize:"13px", color:"#64748b" }}>Ultima compra: <strong>{lastPurchase ? fmtDate(lastPurchase) : "-"}</strong></div>
          {client.limit>0 && <div style={{ fontSize:"13px", color:(client.limit-balance)<0?"#dc2626":"#64748b" }}>Limite disponivel: <strong>{fmtCur(client.limit-balance)}</strong></div>}
        </div>

        <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
          <button style={{ ...button("#16a34a"), flex:1 }} onClick={()=>onWhatsApp(client)}>WhatsApp</button>
          <button style={{ ...button("#64748b"), flex:1 }} onClick={onClose}>Fechar</button>
        </div>

        <div style={{ fontWeight:"900", fontSize:"16px", marginBottom:"10px" }}>Historico de compras e pagamentos</div>
        {history.length === 0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma compra fiada para este cliente.</div>
        ) : history.map((sale) => {
          const paid = sale.fiado?.paidAmount || 0;
          const open = getOpenAmount(sale);
          const payments = sale.fiado?.payments || [];
          const settled = open <= 0.001;
          return (
            <div key={sale.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:settled?"#f8fafc":"#fff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:"900" }}>Venda #{sale.id}</div>
                  <div style={{ color:"#64748b", fontSize:"12px" }}>{fmtDate(sale.date)} {sale.fiado.dueDate ? `- Vence: ${sale.fiado.dueDate}` : ""}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", marginTop:"4px" }}>Compra: {fmtCur(sale.total)} | Pago: {fmtCur(paid)}</div>
                </div>
                <div style={{ textAlign:"right" }}><div style={{ fontWeight:"900", color:settled?"#16a34a":"#e94560" }}>{settled?"Quitado":fmtCur(open)}</div><div style={{ fontSize:"11px", color:"#94a3b8" }}>{settled?"sem saldo":"em aberto"}</div></div>
              </div>
              {sale.items?.length>0 && <div style={{ marginTop:"8px", background:"#f8fafc", borderRadius:"10px", padding:"8px" }}><div style={{ fontSize:"12px", fontWeight:"800", color:"#64748b", marginBottom:"4px" }}>Itens</div>{sale.items.map((item,index)=><div key={index} style={{ fontSize:"12px", color:"#64748b" }}>{item.qty}x {item.name} - {fmtCur(item.price*item.qty)}</div>)}</div>}
              {payments.length>0 && <div style={{ marginTop:"8px", background:"#f0fdf4", borderRadius:"10px", padding:"8px" }}><div style={{ fontSize:"12px", fontWeight:"800", color:"#166534", marginBottom:"4px" }}>Pagamentos</div>{payments.map((payment,index)=><div key={index} style={{ fontSize:"12px", color:"#166534" }}>{fmtDate(payment.date)} - {fmtCur(payment.amount)} {payment.method?`via ${payment.method}`:""}</div>)}</div>}
              {!settled && <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}><button style={smallButton("#16a34a")} onClick={()=>onReceive(sale.id)}>Receber</button><button style={smallButton("#6366f1")} onClick={()=>onReceipt(sale)}>Recibo</button></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, background, labelColor, valueColor }) {
  return <div style={{ background, borderRadius:"12px", padding:"12px" }}><div style={{ fontSize:"11px", color:labelColor, fontWeight:"800" }}>{label}</div><div style={{ fontSize:"19px", fontWeight:"900", color:valueColor }}>{value}</div></div>;
}
