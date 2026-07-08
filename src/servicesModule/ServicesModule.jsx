import { useMemo, useState } from "react";

const PAYMENT_METHODS = [
  { key:"dinheiro", label:"Dinheiro" },
  { key:"pix", label:"PIX" },
  { key:"debito", label:"Débito" },
  { key:"credito", label:"Crédito" },
  { key:"crediario", label:"Crediário" },
];

function newId() {
  return Date.now();
}

export default function ServicesModule({
  products,
  setProducts,
  clients,
  setClients,
  services,
  setServices,
  sales,
  setSales,
  receivables,
  setReceivables,
  storeName,
  fmtCur,
  fmtDate,
  isMobile,
  btn,
  btnSm,
  inp,
  card,
  notify
}) {
  const [view, setView] = useState("novo");
  const [clientMode, setClientMode] = useState("existente");
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState({ name:"", phone:"", email:"" });
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("aberto");
  const [laborName, setLaborName] = useState("");
  const [laborValue, setLaborValue] = useState("");
  const [laborItems, setLaborItems] = useState([]);
  const [productId, setProductId] = useState("");
  const [productQty, setProductQty] = useState(1);
  const [materialItems, setMaterialItems] = useState([]);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [dueDate, setDueDate] = useState("");
  const [selectedService, setSelectedService] = useState(null);

  const selectedClient = useMemo(() => clients.find(c => String(c.id) === String(clientId)), [clients, clientId]);

  const laborTotal = laborItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const materialsTotal = materialItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
  const discountValue = Number(discount) || 0;
  const total = Math.max(0, laborTotal + materialsTotal - discountValue);

  const resetForm = () => {
    setClientMode("existente");
    setClientId("");
    setNewClient({ name:"", phone:"", email:"" });
    setDescription("");
    setStatus("aberto");
    setLaborName("");
    setLaborValue("");
    setLaborItems([]);
    setProductId("");
    setProductQty(1);
    setMaterialItems([]);
    setDiscount("");
    setPaymentMethod("pix");
    setDueDate("");
  };

  const addLabor = () => {
    const name = laborName.trim();
    const value = Number(String(laborValue).replace(",", "."));

    if (!name) {
      notify?.("Informe a descrição da mão de obra.", "error");
      return;
    }

    if (!value || value <= 0) {
      notify?.("Informe o valor da mão de obra.", "error");
      return;
    }

    setLaborItems(prev => [...prev, { id:newId(), name, value }]);
    setLaborName("");
    setLaborValue("");
  };

  const removeLabor = (id) => {
    setLaborItems(prev => prev.filter(item => item.id !== id));
  };

  const addMaterial = () => {
    const prod = products.find(p => String(p.id) === String(productId));

    if (!prod) {
      notify?.("Selecione um produto/peça.", "error");
      return;
    }

    const qty = Number(productQty) || 0;

    if (qty <= 0) {
      notify?.("Informe a quantidade.", "error");
      return;
    }

    if ((Number(prod.stock) || 0) < qty) {
      notify?.("Estoque insuficiente para esta peça/material.", "error");
      return;
    }

    setMaterialItems(prev => {
      const exists = prev.find(item => String(item.id) === String(prod.id));
      if (exists) {
        return prev.map(item => String(item.id) === String(prod.id)
          ? { ...item, qty: Number(item.qty || 0) + qty }
          : item
        );
      }

      return [...prev, {
        id: prod.id,
        name: prod.name,
        qty,
        price: Number(prod.price) || 0,
        cost: Number(prod.cost || prod.custo || 0),
        barcode: prod.barcode || ""
      }];
    });

    setProductId("");
    setProductQty(1);
  };

  const removeMaterial = (id) => {
    setMaterialItems(prev => prev.filter(item => String(item.id) !== String(id)));
  };

  const ensureClient = () => {
    if (clientMode === "existente") {
      if (!selectedClient) return null;
      return selectedClient;
    }

    const name = newClient.name.trim();
    if (!name) return null;

    const client = {
      id: newId(),
      name,
      phone: newClient.phone || "",
      email: newClient.email || "",
      createdAt: new Date().toISOString()
    };

    setClients(prev => [...prev, client]);
    return client;
  };

  const finishService = () => {
    const client = ensureClient();

    if (!client) {
      notify?.("Informe ou selecione o cliente.", "error");
      return;
    }

    if (!description.trim()) {
      notify?.("Descreva o serviço.", "error");
      return;
    }

    if (laborItems.length === 0 && materialItems.length === 0) {
      notify?.("Adicione mão de obra ou peças/materiais.", "error");
      return;
    }

    const service = {
      id: newId(),
      date: new Date().toISOString(),
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || "",
      description: description.trim(),
      status,
      laborItems,
      materialItems,
      laborTotal,
      materialsTotal,
      discount: discountValue,
      total,
      paymentMethod,
      dueDate: paymentMethod === "crediario" ? dueDate : "",
    };

    setProducts(prev => prev.map(prod => {
      const used = materialItems.find(item => String(item.id) === String(prod.id));
      if (!used) return prod;
      return { ...prod, stock: Math.max(0, (Number(prod.stock) || 0) - (Number(used.qty) || 0)) };
    }));

    setServices(prev => [service, ...prev]);

    const saleLike = {
      id: service.id,
      date: service.date,
      total: service.total,
      items: [
        ...laborItems.map(item => ({ id:`mao-${item.id}`, name:item.name, qty:1, price:item.value, type:"mao_de_obra" })),
        ...materialItems.map(item => ({ ...item, type:"material" }))
      ],
      type: "servico",
      serviceId: service.id,
      payments: paymentMethod === "crediario" ? [] : [{ method:paymentMethod, amount:service.total }],
      fiado: paymentMethod === "crediario" ? {
        clientId: client.id,
        clientName: client.name,
        dueDate: dueDate || "",
        paid: false,
        paidAmount: 0
      } : null
    };

    setSales(prev => [saleLike, ...prev]);

    if (paymentMethod === "crediario") {
      setReceivables(prev => [{
        id: service.id,
        document: `SERV-${service.id}`,
        clientId: client.id,
        clientName: client.name,
        amount: service.total,
        paidAmount: 0,
        paid: false,
        dueDate: dueDate || "",
        createdAt: service.date,
        source: "servico"
      }, ...prev]);
    }

    notify?.("Serviço finalizado com sucesso.");
    resetForm();
    setView("historico");
  };

  const printService = (service) => {
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) return;

    const materialRows = (service.materialItems || []).map(item => `
      <div class="row"><span>${item.qty}x ${item.name}</span><strong>${fmtCur((Number(item.qty)||0)*(Number(item.price)||0))}</strong></div>
    `).join("");

    const laborRows = (service.laborItems || []).map(item => `
      <div class="row"><span>${item.name}</span><strong>${fmtCur(item.value)}</strong></div>
    `).join("");

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Serviço #${service.id}</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;max-width:360px;margin:0 auto;color:#111}
h2{text-align:center;margin:0}
.sub{text-align:center;color:#666;font-size:12px;margin-bottom:12px}
.row{display:flex;justify-content:space-between;border-bottom:1px dashed #ddd;padding:6px 0;font-size:13px;gap:12px}
.total{display:flex;justify-content:space-between;font-weight:900;font-size:18px;margin-top:12px}
.small{font-size:12px;color:#555}
hr{border:none;border-top:1px dashed #999;margin:12px 0}
</style>
</head>
<body>
<h2>${storeName || "ERPmini"}</h2>
<div class="sub">Comprovante de Serviço não fiscal</div>
<div class="small"><strong>Nº:</strong> ${service.id}</div>
<div class="small"><strong>Data:</strong> ${fmtDate(service.date)}</div>
<div class="small"><strong>Cliente:</strong> ${service.clientName}</div>
<hr/>
<div><strong>Descrição</strong></div>
<div class="small">${service.description}</div>
<hr/>
<div><strong>Mão de obra</strong></div>
${laborRows || '<div class="small">Sem mão de obra.</div>'}
<hr/>
<div><strong>Peças / materiais</strong></div>
${materialRows || '<div class="small">Sem materiais.</div>'}
<hr/>
<div class="row"><span>Mão de obra</span><strong>${fmtCur(service.laborTotal)}</strong></div>
<div class="row"><span>Peças/materiais</span><strong>${fmtCur(service.materialsTotal)}</strong></div>
<div class="row"><span>Desconto</span><strong>${fmtCur(service.discount)}</strong></div>
<div class="total"><span>Total</span><span>${fmtCur(service.total)}</span></div>
<hr/>
<div class="sub">Emitido por ERPmini • Recibo não fiscal</div>
</body>
</html>`);
    win.document.close();
    win.print();
  };

  return (
    <div>
      <div style={{ display:"flex", gap:"8px", marginBottom:"12px", background:"#fff", padding:"8px", borderRadius:"18px", boxShadow:"0 4px 16px rgba(15,23,42,.08)" }}>
        <button
          onClick={()=>setView("novo")}
          style={{ flex:1, border:"none", borderRadius:"14px", padding:"12px", fontWeight:"900", cursor:"pointer", background:view==="novo"?"#e94560":"#f1f5f9", color:view==="novo"?"#fff":"#64748b" }}
        >
          Novo Serviço
        </button>
        <button
          onClick={()=>setView("historico")}
          style={{ flex:1, border:"none", borderRadius:"14px", padding:"12px", fontWeight:"900", cursor:"pointer", background:view==="historico"?"#e94560":"#f1f5f9", color:view==="historico"?"#fff":"#64748b" }}
        >
          Histórico
        </button>
      </div>

      {view === "novo" ? (
        <div>
          <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
              <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:"#ffe4e6", color:"#e94560", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", fontWeight:"900" }}>SER</div>
              <div>
                <div style={{ fontWeight:"900", fontSize:"21px", color:"#0f172a" }}>Central de Serviços</div>
                <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>Monte o serviço com mão de obra, peças e pagamento.</div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
              <button style={{ ...btn(clientMode==="existente"?"#e94560":"#e2e8f0"), color:clientMode==="existente"?"#fff":"#334155" }} onClick={()=>setClientMode("existente")}>Cliente existente</button>
              <button style={{ ...btn(clientMode==="novo"?"#e94560":"#e2e8f0"), color:clientMode==="novo"?"#fff":"#334155" }} onClick={()=>setClientMode("novo")}>Novo cliente</button>
            </div>

            {clientMode === "existente" ? (
              <select style={{ ...inp, marginBottom:"10px" }} value={clientId} onChange={e=>setClientId(e.target.value)}>
                <option value="">Selecione o cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
                <input style={inp} value={newClient.name} onChange={e=>setNewClient({...newClient, name:e.target.value})} placeholder="Nome do cliente" />
                <input style={inp} value={newClient.phone} onChange={e=>setNewClient({...newClient, phone:e.target.value})} placeholder="Telefone/WhatsApp" />
                <input style={{ ...inp, gridColumn:isMobile?undefined:"1 / -1" }} value={newClient.email} onChange={e=>setNewClient({...newClient, email:e.target.value})} placeholder="E-mail opcional" />
              </div>
            )}

            <textarea style={{ ...inp, minHeight:"92px", marginBottom:"10px" }} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descrição do serviço: instalação, manutenção, conserto, visita técnica..." />

            <select style={{ ...inp, marginBottom:"10px" }} value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="aberto">Aberto</option>
              <option value="andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
            <div style={{ fontWeight:"900", fontSize:"17px", color:"#0f172a", marginBottom:"10px" }}>Mão de obra</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 140px auto", gap:"8px", marginBottom:"10px" }}>
              <input style={inp} value={laborName} onChange={e=>setLaborName(e.target.value)} placeholder="Ex.: Instalação, diagnóstico, visita..." />
              <input style={inp} value={laborValue} onChange={e=>setLaborValue(e.target.value)} placeholder="Valor" />
              <button style={btnSm("#16a34a")} onClick={addLabor}>Adicionar</button>
            </div>

            {laborItems.length === 0 ? (
              <div style={{ color:"#94a3b8", fontWeight:"800", fontSize:"13px" }}>Nenhuma mão de obra adicionada.</div>
            ) : laborItems.map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", borderBottom:"1px solid #f1f5f9", padding:"8px 0" }}>
                <div>
                  <div style={{ fontWeight:"900", color:"#0f172a" }}>{item.name}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>{fmtCur(item.value)}</div>
                </div>
                <button style={btnSm("#ef4444")} onClick={()=>removeLabor(item.id)}>Remover</button>
              </div>
            ))}
          </div>

          <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
            <div style={{ fontWeight:"900", fontSize:"17px", color:"#0f172a", marginBottom:"10px" }}>Peças / materiais</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 100px auto", gap:"8px", marginBottom:"10px" }}>
              <select style={inp} value={productId} onChange={e=>setProductId(e.target.value)}>
                <option value="">Selecionar do estoque</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.stock ?? 0} un. — {fmtCur(p.price)}</option>)}
              </select>
              <input style={inp} type="number" min="1" value={productQty} onChange={e=>setProductQty(e.target.value)} />
              <button style={btnSm("#16a34a")} onClick={addMaterial}>Adicionar</button>
            </div>

            {materialItems.length === 0 ? (
              <div style={{ color:"#94a3b8", fontWeight:"800", fontSize:"13px" }}>Nenhuma peça/material adicionada.</div>
            ) : materialItems.map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", borderBottom:"1px solid #f1f5f9", padding:"8px 0" }}>
                <div>
                  <div style={{ fontWeight:"900", color:"#0f172a" }}>{item.qty}x {item.name}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>{fmtCur(item.price)} un. • {fmtCur((Number(item.qty)||0)*(Number(item.price)||0))}</div>
                </div>
                <button style={btnSm("#ef4444")} onClick={()=>removeMaterial(item.id)}>Remover</button>
              </div>
            ))}
          </div>

          <div style={{ ...card, borderRadius:"20px", padding:"18px" }}>
            <div style={{ fontWeight:"900", fontSize:"17px", color:"#0f172a", marginBottom:"10px" }}>Pagamento</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
              <select style={inp} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <input style={inp} value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="Desconto" />
              {paymentMethod === "crediario" && (
                <input style={{ ...inp, gridColumn:isMobile?undefined:"1 / -1" }} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
              )}
            </div>

            <div style={{ background:"#0f172a", color:"#fff", borderRadius:"18px", padding:"16px", marginTop:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                <span>Mão de obra</span><strong>{fmtCur(laborTotal)}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                <span>Peças/materiais</span><strong>{fmtCur(materialsTotal)}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                <span>Desconto</span><strong>{fmtCur(discountValue)}</strong>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"22px", fontWeight:"900", borderTop:"1px solid rgba(255,255,255,.18)", paddingTop:"10px" }}>
                <span>Total</span><span>{fmtCur(total)}</span>
              </div>
            </div>

            <button style={{ ...btn("#e94560"), width:"100%", marginTop:"12px", padding:"15px" }} onClick={finishService}>
              Finalizar serviço
            </button>
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ fontWeight:"900", fontSize:"20px", color:"#0f172a", marginBottom:"10px" }}>Histórico de Serviços</div>

          {services.length === 0 ? (
            <div style={{ color:"#94a3b8", textAlign:"center", padding:"20px 0", fontWeight:"800" }}>Nenhum serviço registrado.</div>
          ) : services.map(service => (
            <div key={service.id} style={{ border:"1px solid #e2e8f0", borderRadius:"14px", padding:"12px", marginBottom:"10px", background:"#fff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:"900", color:"#0f172a" }}>{service.clientName}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>#{service.id} • {fmtDate(service.date)}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:"900", color:"#16a34a" }}>{fmtCur(service.total)}</div>
                  <span style={{ background:"#eff6ff", color:"#2563eb", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{service.status}</span>
                </div>
              </div>

              <div style={{ color:"#334155", fontSize:"13px", fontWeight:"700", marginTop:"8px" }}>{service.description}</div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"8px" }}>
                <span style={{ background:"#f0fdf4", color:"#166534", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>Mão de obra: {fmtCur(service.laborTotal)}</span>
                <span style={{ background:"#fff7ed", color:"#9a3412", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>Materiais: {fmtCur(service.materialsTotal)}</span>
                <span style={{ background:"#f8fafc", color:"#64748b", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{service.paymentMethod}</span>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px", marginTop:"10px" }}>
                <button style={btnSm("#6366f1")} onClick={()=>setSelectedService(selectedService?.id === service.id ? null : service)}>
                  {selectedService?.id === service.id ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
                <button style={btnSm("#0f172a")} onClick={()=>printService(service)}>Imprimir</button>
              </div>

              {selectedService?.id === service.id && (
                <div style={{ marginTop:"10px", background:"#f8fafc", borderRadius:"12px", padding:"10px" }}>
                  <div style={{ fontWeight:"900", color:"#334155", marginBottom:"6px" }}>Mão de obra</div>
                  {(service.laborItems || []).map(item => (
                    <div key={item.id} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"5px 0", fontSize:"12px" }}>
                      <span>{item.name}</span><strong>{fmtCur(item.value)}</strong>
                    </div>
                  ))}
                  <div style={{ fontWeight:"900", color:"#334155", margin:"10px 0 6px" }}>Peças / materiais</div>
                  {(service.materialItems || []).map(item => (
                    <div key={item.id} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"5px 0", fontSize:"12px" }}>
                      <span>{item.qty}x {item.name}</span><strong>{fmtCur((Number(item.qty)||0)*(Number(item.price)||0))}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
