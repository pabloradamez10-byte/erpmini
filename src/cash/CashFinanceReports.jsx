import React from "react";

export default function CashFinanceReports({
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
}) {
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
      <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Resumo financeiro previsto</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px" }}>
        <div style={{ background:"#f0fdf4", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#166534", fontWeight:"900" }}>A receber 30 dias</div><div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(receivablesNext30Total)}</div></div>
        <div style={{ background:"#fef2f2", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#991b1b", fontWeight:"900" }}>A pagar 7 dias</div><div style={{ fontWeight:"900", color:"#dc2626" }}>{fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0))}</div></div>
        <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#1d4ed8", fontWeight:"900" }}>Saldo projetado</div><div style={{ fontWeight:"900", color:cashFlow30>=0?"#2563eb":"#dc2626" }}>{fmtCur(cashFlow30)}</div></div>
        <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"10px" }}><div style={{ fontSize:"11px", color:"#475569", fontWeight:"900" }}>A receber aberto</div><div style={{ fontWeight:"900", color:"#334155" }}>{fmtCur(receivablesOpenTotal)}</div></div>
      </div>
    </div>

    <div style={card}>
      <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Relatorio por pagamento hoje</div>
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
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Top clientes</div>
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
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Top produtos</div>
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
      <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Resumo financeiro do mes</div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px" }}>
        {[
          ["", salesMonthTotal, "#16a34a"],
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
      <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Fiados em aberto</div>
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
  const contasAbertasOrdenadas = [...openPayables].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const receberAbertasOrdenadas = [...openReceivables].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));

  const subBtn = (key,label) => (
    <button onClick={()=>setFinanceiroView(key)}
      style={{ flex:1, padding:"10px", border:"none", borderRadius:"12px", cursor:"pointer", background:financeiroView===key?"#e94560":"#f1f5f9", color:financeiroView===key?"#fff":"#64748b", fontWeight:"900" }}>
      {label}
    </button>
  );

  const ContasPagar = () => (
    <>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["A pagar aberto", fmtCur(payablesOpenTotal), "linear-gradient(135deg,#e94560,#c0392b)"],
          ["Vence hoje", fmtCur(payablesDueTodayTotal), "linear-gradient(135deg,#f59e0b,#d97706)"],
          ["", fmtCur(payablesOverdueTotal), "linear-gradient(135deg,#dc2626,#991b1b)"],
          ["Prox. 7 dias", fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0)), "linear-gradient(135deg,#6366f1,#4338ca)"],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
            <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
            <div style={{ fontSize:"18px", fontWeight:"900" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Nova conta a pagar</div>
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="Fornecedor" value={newPayable.supplier} onChange={e=>setNewPayable({...newPayable,supplier:e.target.value})} />
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
          <input style={{ ...inp, marginBottom:"8px" }} placeholder="NF / boleto / documento" value={newPayable.document} onChange={e=>setNewPayable({...newPayable,document:e.target.value})} />
          <input style={{ ...inp, marginBottom:"8px" }} placeholder="Valor" inputMode="decimal" value={newPayable.amount} onChange={e=>setNewPayable({...newPayable,amount:e.target.value})} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
          <input style={{ ...inp, marginBottom:"8px" }} type="date" min={dayKey()} value={newPayable.dueDate} onChange={e=>{
            const value = e.target.value;
            if (value && value < dayKey()) { notify("Escolha uma data de hoje em diante.", "error"); return; }
            setNewPayable({...newPayable,dueDate:value});
          }} />
          <input style={{ ...inp, marginBottom:"8px" }} placeholder="Categoria" value={newPayable.category} onChange={e=>setNewPayable({...newPayable,category:e.target.value})} />
        </div>
        <input style={{ ...inp, marginBottom:"10px" }} placeholder="Descricao / observacao" value={newPayable.description} onChange={e=>setNewPayable({...newPayable,description:e.target.value})} />

        <div style={{ background:String(newPayable.document||"").trim()?"#f8fafc":"#fff7ed", border:`1.5px solid ${String(newPayable.document||"").trim()?"#e2e8f0":"#fdba74"}`, borderRadius:"14px", padding:"12px", marginBottom:"10px" }}>
          <div style={{ fontWeight:"900", color:"#334155", marginBottom:"6px" }}> Itens comprados / entrada no estoque</div>
          {!String(newPayable.document||"").trim() ? (
            <div>
              <div style={{ fontSize:"13px", color:"#9a3412", fontWeight:"800", marginBottom:"4px" }}>Informe a NF / boleto / documento primeiro.</div>
              <div style={{ fontSize:"12px", color:"#9a3412" }}>A entrada de produtos fica bloqueada sem documento, para evitar cadastro de estoque fora da compra.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:"12px", color:"#64748b", marginBottom:"10px" }}>Opcional. Se preencher, o sistema soma as quantidades ao estoque.</div>
              {purchaseItems.map((it,idx)=>(
                <div key={idx} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"10px", marginBottom:"8px" }}>
                  <select value={it.productId} onChange={e=>{
                    const prod = products.find(p=>String(p.id)===String(e.target.value));
                    updatePurchaseItem(idx,{ productId:e.target.value, name:prod?.name || "", cost:it.cost || (prod?.cost ? String(prod.cost) : ""), salePrice:it.salePrice || (prod?.price ? String(prod.price) : "") });
                  }} style={{ ...inp, marginBottom:"8px" }}>
                    <option value="">Novo item ou selecione produto existente</option>
                    {products.map(p=><option key={p.id} value={p.id}>{p.name} - estoque: {p.stock}</option>)}
                  </select>
                  <input style={{ ...inp, marginBottom:"8px" }} placeholder="Nome do item comprado" value={it.name} onChange={e=>updatePurchaseItem(idx,{ name:e.target.value, productId:"" })} />
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:"8px" }}>
                    <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Quantidade" value={it.qty} onChange={e=>updatePurchaseItem(idx,{ qty:e.target.value })} />
                    <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Custo unit." value={it.cost} onChange={e=>updatePurchaseItem(idx,{ cost:e.target.value })} />
                    <input style={{ ...inp, margin:0 }} inputMode="decimal" placeholder="Venda unit." value={it.salePrice||""} onChange={e=>updatePurchaseItem(idx,{ salePrice:e.target.value })} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px", gap:"8px", flexWrap:"wrap" }}>
                    <div style={{ fontSize:"12px", color:"#64748b" }}>Subtotal custo: <strong>{fmtCur((parseFloat(String(it.qty||"").replace(",","."))||0) * parseMoney(it.cost))}</strong></div>
                    <div style={{ fontSize:"12px", color:"#16a34a", fontWeight:"800" }}>Lucro un.: {fmtCur(Math.max(0, parseMoney(it.salePrice)-parseMoney(it.cost)))}</div>
                    <button onClick={()=>removePurchaseItemRow(idx)} style={{ ...btn("#ef4444"), padding:"7px 10px", fontSize:"12px" }}>Remover</button>
                  </div>
                </div>
              ))}
              <button onClick={addPurchaseItemRow} style={{ ...btn("#64748b"), width:"100%", padding:"9px", fontSize:"13px" }}>+ Adicionar outro item</button>
              {purchaseItemsTotal()>0 && (
                <div style={{ marginTop:"10px", background:"#ecfdf5", border:"1.5px solid #bbf7d0", borderRadius:"12px", padding:"10px", display:"flex", justifyContent:"space-between" }}>
                  <strong>Total dos itens</strong><strong style={{ color:"#16a34a" }}>{fmtCur(purchaseItemsTotal())}</strong>
                </div>
              )}
              {purchaseItemsTotal()>0 && parseMoney(newPayable.amount)>0 && (
                <div style={{ marginTop:"8px", background:Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01?"#ecfdf5":"#fff7ed", border:`1.5px solid ${Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01?"#bbf7d0":"#fdba74"}`, borderRadius:"12px", padding:"9px", fontSize:"12px", fontWeight:"800", color:Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01?"#166534":"#9a3412" }}>
                  {Math.abs(parseMoney(newPayable.amount)-purchaseItemsTotal())<=0.01 ? "Nota conferida: valor fecha com os itens." : `Diferenca: ${fmtCur(parseMoney(newPayable.amount)-purchaseItemsTotal())}. Ajuste antes de salvar.`}
                </div>
              )}
            </>
          )}
        </div>

        <button style={{ ...btn("#e94560"), width:"100%" }} onClick={addPayable}>Cadastrar conta</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Contas em aberto</div>
        {contasAbertasOrdenadas.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma conta em aberto.</div>
        ) : contasAbertasOrdenadas.map(p=>(
          <div key={p.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:p.dueDate<dayKey()?"#fef2f2":"#fff" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{p.supplier}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>{p.document ? `Doc: ${p.document} | ` : ""}Vence: {p.dueDate}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>{p.category || "Geral"}{p.description ? ` - ${p.description}` : ""}</div>
                {Array.isArray(p.purchaseItems) && p.purchaseItems.length>0 && (
                  <div style={{ marginTop:"6px", background:"#f8fafc", borderRadius:"8px", padding:"7px", fontSize:"11px", color:"#475569" }}>
                    <strong>Itens:</strong> {p.purchaseItems.map(it=>`${it.qty}x ${it.name}`).join(" | ")}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:"900", color:statusColor(p), whiteSpace:"nowrap" }}>{fmtCur(p.amount)}</div>
                <div style={{ fontSize:"11px", color:statusColor(p), fontWeight:"800" }}>{statusLabel(p)}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
              <button style={{ ...btn("#16a34a"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>markPayablePaid(p.id)}>Pagar</button>
              <button style={{ ...btn("#ef4444"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>deletePayable(p.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const ContasReceber = () => (
    <>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["A receber aberto", fmtCur(receivablesOpenTotal), "linear-gradient(135deg,#16a34a,#15803d)"],
          ["Receber hoje", fmtCur(receivablesDueTodayTotal), "linear-gradient(135deg,#22c55e,#16a34a)"],
          ["", fmtCur(receivablesOverdueTotal), "linear-gradient(135deg,#dc2626,#991b1b)"],
          ["Prox. 30 dias", fmtCur(receivablesNext30Total), "linear-gradient(135deg,#0ea5e9,#2563eb)"],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{ background:c, borderRadius:"12px", padding:"14px", color:"#fff" }}>
            <div style={{ fontSize:"11px", opacity:0.85, marginBottom:"4px" }}>{l}</div>
            <div style={{ fontSize:"18px", fontWeight:"900" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Nova conta a receber</div>
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="Cliente" value={newReceivable.clientName} onChange={e=>setNewReceivable({...newReceivable,clientName:e.target.value})} />
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
          <input style={{ ...inp, marginBottom:"8px" }} placeholder="Documento / referencia" value={newReceivable.document} onChange={e=>setNewReceivable({...newReceivable,document:e.target.value})} />
          <input style={{ ...inp, marginBottom:"8px" }} placeholder="Valor total" inputMode="decimal" value={newReceivable.amount} onChange={e=>setNewReceivable({...newReceivable,amount:e.target.value})} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
          <input style={{ ...inp, marginBottom:"8px" }} type="date" min={dayKey()} value={newReceivable.dueDate} onChange={e=>{
            const value = e.target.value;
            if (value && value < dayKey()) { notify("Escolha uma data de hoje em diante.", "error"); return; }
            setNewReceivable({...newReceivable,dueDate:value});
          }} />
          <select style={{ ...inp, marginBottom:"8px" }} value={newReceivable.installments} onChange={e=>setNewReceivable({...newReceivable,installments:e.target.value})}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n}x</option>)}
          </select>
        </div>
        <input style={{ ...inp, marginBottom:"8px" }} placeholder="Categoria" value={newReceivable.category} onChange={e=>setNewReceivable({...newReceivable,category:e.target.value})} />
        <input style={{ ...inp, marginBottom:"10px" }} placeholder="Descricao / observacao" value={newReceivable.description} onChange={e=>setNewReceivable({...newReceivable,description:e.target.value})} />
        <button style={{ ...btn("#16a34a"), width:"100%" }} onClick={addReceivable}>Cadastrar recebimento</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Contas a receber em aberto</div>
        {receberAbertasOrdenadas.length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhuma conta a receber em aberto.</div>
        ) : receberAbertasOrdenadas.map(r=>(
          <div key={r.id} style={{ border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px", marginBottom:"10px", background:r.dueDate<dayKey()?"#fef2f2":"#fff" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:"900", color:"#1a1a2e" }}>{r.clientName}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>{r.document ? `Doc: ${r.document} | ` : ""}Vence: {r.dueDate}</div>
                <div style={{ fontSize:"12px", color:"#64748b" }}>Parcela {r.installmentNumber}/{r.totalInstallments} | {r.category || "Geral"}</div>
                {r.description && <div style={{ fontSize:"12px", color:"#64748b" }}>{r.description}</div>}
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:"900", color:statusColor(r), whiteSpace:"nowrap" }}>{fmtCur(receivableOpenAmount(r))}</div>
                <div style={{ fontSize:"11px", color:statusColor(r), fontWeight:"800" }}>{statusLabel(r)}</div>
                {receivablePaid(r)>0 && <div style={{ fontSize:"11px", color:"#16a34a" }}>Pago: {fmtCur(receivablePaid(r))}</div>}
              </div>
            </div>
            <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
              <button style={{ ...btn("#16a34a"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>receiveReceivable(r.id)}>Receber</button>
              <button style={{ ...btn("#ef4444"), padding:"9px 12px", fontSize:"13px" }} onClick={()=>deleteReceivable(r.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Recebidas recentes</div>
        {paidReceivables.slice(0,5).length===0 ? (
          <div style={{ color:"#94a3b8", fontSize:"14px", padding:"14px 0" }}>Nenhum recebimento quitado.</div>
        ) : paidReceivables.slice(0,5).map(r=>(
          <div key={r.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
            <div>
              <div style={{ fontWeight:"900" }}>{r.clientName}</div>
              <div style={{ fontSize:"12px", color:"#64748b" }}>{r.document} | {fmtDate(r.paidDate || r.createdAt)}</div>
            </div>
            <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(r.amount)}</div>
          </div>
        ))}
      </div>
    </>
  );

  const FluxoCaixa = () => (
    <>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"12px", marginBottom:"14px" }}>
        {[
          ["Receber 30 dias", fmtCur(receivablesNext30Total), "#16a34a"],
          ["Pagar 7 dias", fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0)), "#dc2626"],
          ["Saldo projetado", fmtCur(cashFlow30), cashFlow30>=0?"#2563eb":"#dc2626"],
          ["Saldo mes", fmtCur(expectedMonthBalance), expectedMonthBalance>=0?"#16a34a":"#dc2626"],
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff", borderRadius:"14px", padding:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize:"12px", color:"#64748b", fontWeight:"800" }}>{l}</div>
            <div style={{ fontSize:"19px", fontWeight:"900", color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontWeight:"900", fontSize:"17px", marginBottom:"12px" }}> Fluxo de caixa previsto</div>
        <div style={{ background:"#f0fdf4", borderRadius:"12px", padding:"12px", marginBottom:"8px", display:"flex", justifyContent:"space-between" }}>
          <strong>Entradas previstas 30 dias</strong><strong style={{ color:"#16a34a" }}>{fmtCur(receivablesNext30Total)}</strong>
        </div>
        <div style={{ background:"#fef2f2", borderRadius:"12px", padding:"12px", marginBottom:"8px", display:"flex", justifyContent:"space-between" }}>
          <strong>Saidas proximos 7 dias</strong><strong style={{ color:"#dc2626" }}>{fmtCur(payablesNext7.reduce((s,p)=>s+payableAmount(p),0))}</strong>
        </div>
        <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"12px", display:"flex", justifyContent:"space-between" }}>
          <strong>Saldo projetado</strong><strong style={{ color:cashFlow30>=0?"#2563eb":"#dc2626" }}>{fmtCur(cashFlow30)}</strong>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div style={{ display:"flex", gap:"8px", background:"#fff", borderRadius:"16px", padding:"8px", marginBottom:"14px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
        {subBtn("pagar","A pagar")}
        {subBtn("receber","A receber")}
        {subBtn("fluxo","Fluxo")}
      </div>
      {financeiroView==="pagar" && ContasPagar()}
      {financeiroView==="receber" && ContasReceber()}
      {financeiroView==="fluxo" && FluxoCaixa()}
    </>
  );
};

  return { RelatoriosCaixa, FinanceiroCaixa };
}
