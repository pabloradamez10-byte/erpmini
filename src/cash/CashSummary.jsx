import { fmtCur, fmtDate } from "../utils/format.js";

const inputStyle = { width:"100%", padding:"10px 12px", border:"1.5px solid #e2e8f0", borderRadius:"10px", fontSize:"15px", boxSizing:"border-box", outline:"none" };
const button = (color) => ({ background:color||"#e94560", color:"#fff", border:"none", borderRadius:"10px", padding:"12px 18px", cursor:"pointer", fontWeight:"700", fontSize:"15px" });
const card = { background:"#fff", borderRadius:"14px", padding:"16px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", marginBottom:"14px" };

export default function CashSummary({
  isMobile,
  entries,
  salesToday,
  creditSalesToday,
  creditReceivedToday,
  paymentSummary,
  getPaymentLabel,
  getPaymentColor,
  getCashOpening,
  getLastCashClosure,
  getCashClosures,
  getCashOperationTotals,
  getCashOperations,
  getExpectedCashBalance,
  dayKey,
  latestPayments,
  openingValue,
  setOpeningValue,
  onOpenCash,
  operationForm,
  setOperationForm,
  onAddOperation,
  realValue,
  setRealValue,
  onCloseCash
}) {
  const opening = getCashOpening();
  const lastClosure = getLastCashClosure();
  const operationTotals = getCashOperationTotals(dayKey(), opening?.date);
  const expectedBalance = getExpectedCashBalance();
  const movements = [
    ...getCashOperations().filter((operation)=>operation.type !== "abertura").map((operation)=>({
      ...operation,
      isCashOp:true,
      method:operation.type === "sangria" ? "sangria" : "reforco",
      origin:operation.type === "sangria" ? "Sangria" : "Reforco",
      amount:operation.amount,
      saleId:"CAIXA",
      clientName:operation.note || "",
      date:operation.date
    })),
    ...latestPayments
  ];

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["Entradas hoje", fmtCur(entries), "linear-gradient(135deg,#16a34a,#15803d)"],
          ["Vendas hoje", fmtCur(salesToday), "linear-gradient(135deg,#e94560,#c0392b)"],
          ["Crediário vendido", fmtCur(creditSalesToday), "linear-gradient(135deg,#f59e0b,#d97706)"],
          ["Recebido crediário", fmtCur(creditReceivedToday), "linear-gradient(135deg,#6366f1,#4338ca)"],
        ].map(([label,value,color],index)=>(
          <div key={index} style={{ background:color, borderRadius:"12px", padding:"14px", color:"#fff" }}>
            <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{label}</div>
            <div style={{ fontSize:"19px", fontWeight:"900" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Caixa profissional</div>

        {!opening ? (
          <div style={{ background:lastClosure?"#f1f5f9":"#fff7ed", border:`1.5px solid ${lastClosure?"#cbd5e1":"#fdba74"}`, borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
            <div style={{ fontWeight:"900", color:lastClosure?"#334155":"#9a3412", marginBottom:"6px" }}>
              {lastClosure ? "Ultimo turno fechado. Pode abrir novo turno." : "Caixa ainda nao aberto hoje"}
            </div>
            {lastClosure && (
              <div style={{ fontSize:"12px", color:"#475569", marginBottom:"8px" }}>
                Ultimo fechamento: {fmtDate(lastClosure.date)} | Diferença:
                <strong style={{ color:Math.abs(lastClosure.diferenca||0)<0.01?"#16a34a":"#dc2626" }}> {fmtCur(lastClosure.diferenca||0)}</strong>
              </div>
            )}
            <div style={{ fontSize:"12px", color:lastClosure?"#475569":"#9a3412", marginBottom:"10px" }}>Informe quanto tem de dinheiro no caixa para troco.</div>
            <div style={{ display:"flex", gap:"8px" }}>
              <input style={{ ...inputStyle, flex:1, margin:0 }} inputMode="decimal" placeholder="Saldo inicial" value={openingValue} onChange={event=>setOpeningValue(event.target.value)} />
              <button style={{ ...button("#16a34a"), padding:"12px 14px" }} onClick={onOpenCash}>Abrir turno</button>
            </div>
          </div>
        ) : (
          <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:"14px", padding:"12px", marginBottom:"12px" }}>
            <div style={{ fontWeight:"900", color:"#166534" }}>Caixa aberto - turno {getCashClosures().length + 1}</div>
            <div style={{ fontSize:"12px", color:"#166534" }}>Abertura: {fmtCur(operationTotals.abertura)}</div>
          </div>
        )}

        <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"10px" }}>Resumo das entradas recebidas hoje</div>
          {["dinheiro","pix","debito","credito"].map((method)=>(
            <div key={method} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #e2e8f0" }}>
              <strong style={{ color:"#334155", textTransform:"capitalize" }}>{getPaymentLabel(method)}</strong>
              <strong style={{ color:getPaymentColor(method) }}>{fmtCur(paymentSummary[method]||0)}</strong>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", fontSize:"16px" }}><strong>Total de entradas</strong><strong style={{ color:"#16a34a" }}>{fmtCur(entries)}</strong></div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px", marginBottom:"12px" }}>
          <CashMetric label="Abertura" value={operationTotals.abertura} background="#ecfdf5" border="#bbf7d0" labelColor="#166534" valueColor="#16a34a" />
          <CashMetric label="Reforcos" value={operationTotals.reforco} background="#eff6ff" border="#bfdbfe" labelColor="#1d4ed8" valueColor="#2563eb" />
          <CashMetric label="Sangrias" value={operationTotals.sangria} background="#fef2f2" border="#fecaca" labelColor="#991b1b" valueColor="#dc2626" />
          <CashMetric label="Esperado" value={expectedBalance} background="#f8fafc" border="#e2e8f0" labelColor="#334155" valueColor="#1a1a2e" />
        </div>

        <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"900", color:"#334155", marginBottom:"8px" }}>Sangria / Reforco</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
            <button onClick={()=>setOperationForm({...operationForm,type:"sangria"})} style={{ ...button(operationForm.type==="sangria"?"#dc2626":"#94a3b8"), padding:"10px", fontSize:"13px" }}>Sangria</button>
            <button onClick={()=>setOperationForm({...operationForm,type:"reforco"})} style={{ ...button(operationForm.type==="reforco"?"#2563eb":"#94a3b8"), padding:"10px", fontSize:"13px" }}>Reforco</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", marginBottom:"8px" }}>
            <input style={{ ...inputStyle, margin:0 }} inputMode="decimal" placeholder="Valor" value={operationForm.amount} onChange={event=>setOperationForm({...operationForm,amount:event.target.value})} />
            <input style={{ ...inputStyle, margin:0 }} placeholder="Observacao" value={operationForm.note} onChange={event=>setOperationForm({...operationForm,note:event.target.value})} />
          </div>
          <button style={{ ...button("#64748b"), width:"100%", padding:"10px", fontSize:"13px" }} onClick={onAddOperation}>Registrar movimentacao</button>
        </div>

        <div style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"900", color:"#334155", marginBottom:"8px" }}>Conferencia do fechamento</div>
          <input style={{ ...inputStyle, marginBottom:"8px" }} inputMode="decimal" placeholder={`Dinheiro contado no caixa (${fmtCur(expectedBalance)})`} value={realValue} onChange={event=>setRealValue(event.target.value)} />
          <div style={{ fontSize:"12px", color:"#64748b" }}>Deixe em branco para fechar com o saldo esperado.</div>
        </div>

        <button style={{ ...button(opening?"#16a34a":"#94a3b8"), width:"100%", opacity:opening?1:0.65 }} onClick={onCloseCash}>
          {opening ? " Fechar turno atual" : " Abra um turno para fechar"}
        </button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"16px", marginBottom:"12px" }}> Movimentacoes de hoje</div>
        {movements.length === 0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma movimentacao hoje.</div>
        ) : movements.map((movement,index)=>(
          <div key={index} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
            <div><div style={{ fontWeight:"800", color:"#1a1a2e" }}>{getPaymentLabel(movement.method)} - {movement.origin}</div><div style={{ fontSize:"12px", color:"#64748b" }}>#{movement.saleId} {movement.clientName?`- ${movement.clientName}`:""} | {fmtDate(movement.date)}</div></div>
            <div style={{ fontWeight:"900", color:movement.method==="sangria"?"#dc2626":movement.method==="reforco"?"#2563eb":getPaymentColor(movement.method), whiteSpace:"nowrap" }}>{movement.method==="sangria"?"- ":""}{fmtCur(parseFloat(movement.amount)||0)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function CashMetric({ label, value, background, border, labelColor, valueColor }) {
  return <div style={{ background, border:`1.5px solid ${border}`, borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:labelColor, fontWeight:"800" }}>{label}</div><div style={{ fontSize:"17px", fontWeight:"900", color:valueColor }}>{fmtCur(value)}</div></div>;
}
