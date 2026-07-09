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

function normalizeMoney(value) {
  return Number(String(value || "0").replace(",", ".")) || 0;
}

function statusLabel(status) {
  if (status === "aberto") return "Aberto";
  if (status === "andamento") return "Em andamento";
  if (status === "pagamento") return "Aguardando pagamento";
  if (status === "concluido") return "Concluído";
  if (status === "cancelado") return "Cancelado";
  return "Aberto";
}

function statusStyle(status) {
  if (status === "aberto") return { bg:"#eff6ff", color:"#2563eb" };
  if (status === "andamento") return { bg:"#fff7ed", color:"#f97316" };
  if (status === "pagamento") return { bg:"#f5f3ff", color:"#7c3aed" };
  if (status === "concluido") return { bg:"#dcfce7", color:"#166534" };
  if (status === "cancelado") return { bg:"#fee2e2", color:"#991b1b" };
  return { bg:"#f1f5f9", color:"#64748b" };
}

function emptyDraft() {
  return {
    id: null,
    clientMode: "existente",
    clientId: "",
    newClient: { name:"", phone:"", email:"" },
    description: "",
    status: "aberto",
    laborName: "",
    laborValue: "",
    laborItems: [],
    productId: "",
    productQty: 1,
    materialItems: [],
    discount: "",
    paymentMethod: "pix",
    dueDate: "",
  };
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
  const [view, setView] = useState("lista");
  const [filter, setFilter] = useState("ativos");
  const [draft, setDraft] = useState(emptyDraft());
  const [selectedService, setSelectedService] = useState(null);

  const selectedClient = useMemo(() => clients.find(c => String(c.id) === String(draft.clientId)), [clients, draft.clientId]);

  const laborTotal = draft.laborItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const materialsTotal = draft.materialItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
  const discountValue = normalizeMoney(draft.discount);
  const total = Math.max(0, laborTotal + materialsTotal - discountValue);

  const activeServices = services.filter(s => !["concluido", "cancelado"].includes(String(s.status || "")));
  const finishedServices = services.filter(s => ["concluido", "cancelado"].includes(String(s.status || "")));

  const filteredServices = filter === "ativos" ? activeServices : finishedServices;

  const updateDraft = (patch) => setDraft(prev => ({ ...prev, ...patch }));

  const startNew = () => {
    setDraft(emptyDraft());
    setView("form");
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  const openService = (service) => {
    setDraft({
      id: service.id,
      clientMode: "existente",
      clientId: service.clientId || "",
      newClient: { name:service.clientName || "", phone:service.clientPhone || "", email:"" },
      description: service.description || "",
      status: service.status || "aberto",
      laborName: "",
      laborValue: "",
      laborItems: service.laborItems || [],
      productId: "",
      productQty: 1,
      materialItems: service.materialItems || [],
      discount: String(service.discount || ""),
      paymentMethod: service.paymentMethod || "pix",
      dueDate: service.dueDate || "",
    });
    setView("form");
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  const getClientForSave = () => {
    if (draft.clientMode === "existente") {
      return selectedClient || null;
    }

    const name = draft.newClient.name.trim();
    if (!name) return null;

    const existing = clients.find(c => String(c.name || "").toLowerCase() === name.toLowerCase() && String(c.phone || "") === String(draft.newClient.phone || ""));
    if (existing) return existing;

    const client = {
      id: newId(),
      name,
      phone: draft.newClient.phone || "",
      email: draft.newClient.email || "",
      createdAt: new Date().toISOString()
    };

    setClients(prev => [...prev, client]);
    return client;
  };

  const buildServicePayload = (nextStatus) => {
    const client = getClientForSave();

    if (!client) {
      notify?.("Informe ou selecione o cliente.", "error");
      return null;
    }

    if (!draft.description.trim()) {
      notify?.("Descreva o serviço.", "error");
      return null;
    }

    const now = new Date().toISOString();
    return {
      id: draft.id || newId(),
      date: draft.id ? (services.find(s => s.id === draft.id)?.date || now) : now,
      updatedAt: now,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || "",
      description: draft.description.trim(),
      status: nextStatus || draft.status || "aberto",
      laborItems: draft.laborItems,
      materialItems: draft.materialItems,
      laborTotal,
      materialsTotal,
      discount: discountValue,
      total,
      paymentMethod: draft.paymentMethod,
      dueDate: draft.paymentMethod === "crediario" ? draft.dueDate : "",
      paidAt: nextStatus === "concluido" ? now : null,
    };
  };

  const upsertService = (payload) => {
    setServices(prev => {
      const exists = prev.some(s => String(s.id) === String(payload.id));
      if (exists) {
        return prev.map(s => String(s.id) === String(payload.id) ? { ...s, ...payload } : s);
      }
      return [payload, ...prev];
    });
    updateDraft({ id: payload.id, status: payload.status });
  };

  const saveStep = (nextStatus) => {
    const payload = buildServicePayload(nextStatus);
    if (!payload) return null;
    upsertService(payload);
    notify?.("Serviço salvo.");
    return payload;
  };

  const sendToWork = () => {
    const payload = saveStep("andamento");
    if (payload) notify?.("Serviço enviado para andamento.");
  };

  const sendToPayment = () => {
    if (draft.laborItems.length === 0 && draft.materialItems.length === 0) {
      notify?.("Adicione mão de obra ou peças/materiais antes do pagamento.", "error");
      return;
    }
    const payload = saveStep("pagamento");
    if (payload) notify?.("Serviço pronto para pagamento.");
  };

  const addLabor = () => {
    const name = draft.laborName.trim();
    const value = normalizeMoney(draft.laborValue);

    if (!name) {
      notify?.("Informe a descrição da mão de obra.", "error");
      return;
    }

    if (!value || value <= 0) {
      notify?.("Informe o valor da mão de obra.", "error");
      return;
    }

    updateDraft({
      laborItems: [...draft.laborItems, { id:newId(), name, value }],
      laborName: "",
      laborValue: ""
    });
  };

  const removeLabor = (id) => {
    updateDraft({ laborItems: draft.laborItems.filter(item => item.id !== id) });
  };

  const addMaterial = () => {
    const prod = products.find(p => String(p.id) === String(draft.productId));

    if (!prod) {
      notify?.("Selecione um produto/peça.", "error");
      return;
    }

    const qty = Number(draft.productQty) || 0;

    if (qty <= 0) {
      notify?.("Informe a quantidade.", "error");
      return;
    }

    const alreadyInDraft = draft.materialItems
      .filter(item => String(item.id) === String(prod.id))
      .reduce((sum,item)=>sum+(Number(item.qty)||0),0);

    if ((Number(prod.stock) || 0) < qty + alreadyInDraft) {
      notify?.("Estoque insuficiente para esta peça/material.", "error");
      return;
    }

    const nextMaterials = (() => {
      const exists = draft.materialItems.find(item => String(item.id) === String(prod.id));
      if (exists) {
        return draft.materialItems.map(item => String(item.id) === String(prod.id)
          ? { ...item, qty: Number(item.qty || 0) + qty }
          : item
        );
      }

      return [...draft.materialItems, {
        id: prod.id,
        name: prod.name,
        qty,
        price: Number(prod.price) || 0,
        cost: Number(prod.cost || prod.custo || 0),
        barcode: prod.barcode || ""
      }];
    })();

    updateDraft({
      materialItems: nextMaterials,
      productId: "",
      productQty: 1
    });
  };

  const removeMaterial = (id) => {
    updateDraft({ materialItems: draft.materialItems.filter(item => String(item.id) !== String(id)) });
  };

  const finishPayment = () => {
    if (draft.laborItems.length === 0 && draft.materialItems.length === 0) {
      notify?.("Adicione mão de obra ou peças/materiais.", "error");
      return;
    }

    const payload = buildServicePayload("concluido");
    if (!payload) return;

    const alreadyFinished = services.find(s => String(s.id) === String(payload.id) && s.status === "concluido");
    if (alreadyFinished) {
      notify?.("Este serviço já foi concluído.", "error");
      return;
    }

    setProducts(prev => prev.map(prod => {
      const used = draft.materialItems.find(item => String(item.id) === String(prod.id));
      if (!used) return prod;
      return { ...prod, stock: Math.max(0, (Number(prod.stock) || 0) - (Number(used.qty) || 0)) };
    }));

    upsertService(payload);

    const saleLike = {
      id: payload.id,
      date: payload.paidAt || payload.updatedAt,
      total: payload.total,
      items: [
        ...payload.laborItems.map(item => ({ id:`mao-${item.id}`, name:item.name, qty:1, price:item.value, type:"mao_de_obra" })),
        ...payload.materialItems.map(item => ({ ...item, type:"material" }))
      ],
      type: "servico",
      serviceId: payload.id,
      payments: payload.paymentMethod === "crediario" ? [] : [{ method:payload.paymentMethod, amount:payload.total }],
      fiado: payload.paymentMethod === "crediario" ? {
        clientId: payload.clientId,
        clientName: payload.clientName,
        dueDate: payload.dueDate || "",
        paid: false,
        paidAmount: 0
      } : null
    };

    setSales(prev => {
      const exists = prev.some(s => String(s.serviceId) === String(payload.id));
      return exists ? prev : [saleLike, ...prev];
    });

    if (payload.paymentMethod === "crediario") {
      setReceivables(prev => {
        const exists = prev.some(r => String(r.id) === String(payload.id));
        if (exists) return prev;
        return [{
          id: payload.id,
          document: `SERV-${payload.id}`,
          clientId: payload.clientId,
          clientName: payload.clientName,
          amount: payload.total,
          paidAmount: 0,
          paid: false,
          dueDate: payload.dueDate || "",
          createdAt: payload.paidAt || payload.updatedAt,
          source: "servico"
        }, ...prev];
      });
    }

    notify?.("Pagamento lançado e serviço concluído.");
    setDraft(emptyDraft());
    setView("lista");
  };

  const cancelService = () => {
    const payload = saveStep("cancelado");
    if (payload) {
      notify?.("Serviço cancelado.");
      setView("lista");
    }
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
<div class="small"><strong>Status:</strong> ${statusLabel(service.status)}</div>
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

  const stepBox = (key, label, subtitle) => {
    const active = draft.status === key;
    const st = statusStyle(key);
    return (
      <div style={{
        background:active ? st.bg : "#f8fafc",
        border:`1px solid ${active ? st.color : "#e2e8f0"}`,
        color:active ? st.color : "#64748b",
        borderRadius:"14px",
        padding:"10px",
        fontWeight:"900"
      }}>
        <div>{label}</div>
        <div style={{ fontSize:"11px", fontWeight:"700", opacity:.85 }}>{subtitle}</div>
      </div>
    );
  };

  const ServiceCard = ({ service }) => {
    const st = statusStyle(service.status);
    const locked = ["concluido", "cancelado"].includes(service.status);

    return (
      <div style={{ border:"1px solid #e2e8f0", borderRadius:"18px", padding:"14px", marginBottom:"12px", background:"#fff", boxShadow:"0 8px 22px rgba(15,23,42,.05)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontWeight:"900", color:"#0f172a", fontSize:"18px" }}>{service.clientName}</div>
            <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>#{service.id} • {fmtDate(service.date)}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:"900", color:"#16a34a", fontSize:"18px" }}>{fmtCur(service.total)}</div>
            <span style={{ background:st.bg, color:st.color, borderRadius:"999px", padding:"4px 9px", fontSize:"11px", fontWeight:"900" }}>
              {statusLabel(service.status)}
            </span>
          </div>
        </div>

        <div style={{ color:"#334155", fontSize:"13px", fontWeight:"700", marginTop:"8px" }}>{service.description}</div>

        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"9px" }}>
          <span style={{ background:"#f0fdf4", color:"#166534", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>Mão de obra: {fmtCur(service.laborTotal)}</span>
          <span style={{ background:"#fff7ed", color:"#9a3412", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>Materiais: {fmtCur(service.materialsTotal)}</span>
          <span style={{ background:"#f8fafc", color:"#64748b", borderRadius:"999px", padding:"3px 8px", fontSize:"11px", fontWeight:"900" }}>{service.paymentMethod}</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:"8px", marginTop:"10px" }}>
          {!locked && <button style={btnSm("#e94560")} onClick={()=>openService(service)}>Continuar / Editar</button>}
          <button style={btnSm("#6366f1")} onClick={()=>setSelectedService(selectedService?.id === service.id ? null : service)}>
            {selectedService?.id === service.id ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
          <button style={btnSm("#0f172a")} onClick={()=>printService(service)}>Imprimir</button>
        </div>

        {selectedService?.id === service.id && (
          <div style={{ marginTop:"10px", background:"#f8fafc", borderRadius:"12px", padding:"10px" }}>
            <div style={{ fontWeight:"900", color:"#334155", marginBottom:"6px" }}>Mão de obra</div>
            {(service.laborItems || []).length === 0 && <div style={{ color:"#94a3b8", fontSize:"12px" }}>Sem mão de obra.</div>}
            {(service.laborItems || []).map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"5px 0", fontSize:"12px" }}>
                <span>{item.name}</span><strong>{fmtCur(item.value)}</strong>
              </div>
            ))}
            <div style={{ fontWeight:"900", color:"#334155", margin:"10px 0 6px" }}>Peças / materiais</div>
            {(service.materialItems || []).length === 0 && <div style={{ color:"#94a3b8", fontSize:"12px" }}>Sem materiais.</div>}
            {(service.materialItems || []).map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #e2e8f0", padding:"5px 0", fontSize:"12px" }}>
                <span>{item.qty}x {item.name}</span><strong>{fmtCur((Number(item.qty)||0)*(Number(item.price)||0))}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"12px", background:"#fff", padding:"8px", borderRadius:"18px", boxShadow:"0 4px 16px rgba(15,23,42,.08)" }}>
        <button
          onClick={startNew}
          style={{ border:"none", borderRadius:"14px", padding:"12px", fontWeight:"900", cursor:"pointer", background:view==="form"?"#e94560":"#f1f5f9", color:view==="form"?"#fff":"#64748b" }}
        >
          + Novo Serviço
        </button>
        <button
          onClick={()=>setView("lista")}
          style={{ border:"none", borderRadius:"14px", padding:"12px", fontWeight:"900", cursor:"pointer", background:view==="lista"?"#e94560":"#f1f5f9", color:view==="lista"?"#fff":"#64748b" }}
        >
          Acompanhar
        </button>
      </div>

      {view === "form" ? (
        <div>
          <div style={{ ...card, borderRadius:"22px", padding:"18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px", marginBottom:"14px" }}>
              <div>
                <div style={{ fontWeight:"900", fontSize:"22px", color:"#0f172a" }}>{draft.id ? `Serviço #${draft.id}` : "Abrir Serviço"}</div>
                <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>
                  Salve por etapa e continue depois.
                </div>
              </div>
              <span style={{ background:statusStyle(draft.status).bg, color:statusStyle(draft.status).color, borderRadius:"999px", padding:"6px 10px", fontWeight:"900", fontSize:"12px" }}>
                {statusLabel(draft.status)}
              </span>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:"8px", marginBottom:"14px" }}>
              {stepBox("aberto", "Aberto", "Recebido")}
              {stepBox("andamento", "Andamento", "Executando")}
              {stepBox("pagamento", "Pagamento", "Pronto")}
              {stepBox("concluido", "Concluído", "Finalizado")}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
              <button style={{ ...btn(draft.clientMode==="existente"?"#e94560":"#e2e8f0"), color:draft.clientMode==="existente"?"#fff":"#334155" }} onClick={()=>updateDraft({ clientMode:"existente" })}>Cliente existente</button>
              <button style={{ ...btn(draft.clientMode==="novo"?"#e94560":"#e2e8f0"), color:draft.clientMode==="novo"?"#fff":"#334155" }} onClick={()=>updateDraft({ clientMode:"novo" })}>Novo cliente</button>
            </div>

            {draft.clientMode === "existente" ? (
              <select style={{ ...inp, marginBottom:"10px" }} value={draft.clientId} onChange={e=>updateDraft({ clientId:e.target.value })}>
                <option value="">Selecione o cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
                <input style={inp} value={draft.newClient.name} onChange={e=>updateDraft({ newClient:{...draft.newClient, name:e.target.value} })} placeholder="Nome do cliente" />
                <input style={inp} value={draft.newClient.phone} onChange={e=>updateDraft({ newClient:{...draft.newClient, phone:e.target.value} })} placeholder="Telefone/WhatsApp" />
                <input style={{ ...inp, gridColumn:isMobile?undefined:"1 / -1" }} value={draft.newClient.email} onChange={e=>updateDraft({ newClient:{...draft.newClient, email:e.target.value} })} placeholder="E-mail opcional" />
              </div>
            )}

            <textarea style={{ ...inp, minHeight:"92px", marginBottom:"10px" }} value={draft.description} onChange={e=>updateDraft({ description:e.target.value })} placeholder="O que será feito? Ex.: troca de óleo, instalação, manutenção..." />

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"8px" }}>
              <button style={btnSm("#2563eb")} onClick={()=>saveStep("aberto")}>Salvar aberto</button>
              <button style={btnSm("#f97316")} onClick={sendToWork}>Enviar para andamento</button>
            </div>
          </div>

          <div style={{ ...card, borderRadius:"22px", padding:"18px" }}>
            <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a", marginBottom:"10px" }}>Mão de obra</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 140px auto", gap:"8px", marginBottom:"10px" }}>
              <input style={inp} value={draft.laborName} onChange={e=>updateDraft({ laborName:e.target.value })} placeholder="Ex.: Instalação, diagnóstico, visita..." />
              <input style={inp} value={draft.laborValue} onChange={e=>updateDraft({ laborValue:e.target.value })} placeholder="Valor" />
              <button style={btnSm("#16a34a")} onClick={addLabor}>Adicionar</button>
            </div>

            {draft.laborItems.length === 0 ? (
              <div style={{ color:"#94a3b8", fontWeight:"800", fontSize:"13px" }}>Nenhuma mão de obra adicionada.</div>
            ) : draft.laborItems.map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", borderBottom:"1px solid #f1f5f9", padding:"8px 0" }}>
                <div>
                  <div style={{ fontWeight:"900", color:"#0f172a" }}>{item.name}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>{fmtCur(item.value)}</div>
                </div>
                <button style={btnSm("#ef4444")} onClick={()=>removeLabor(item.id)}>Remover</button>
              </div>
            ))}
          </div>

          <div style={{ ...card, borderRadius:"22px", padding:"18px" }}>
            <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a", marginBottom:"10px" }}>Peças / materiais</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 100px auto", gap:"8px", marginBottom:"10px" }}>
              <select style={inp} value={draft.productId} onChange={e=>updateDraft({ productId:e.target.value })}>
                <option value="">Selecionar do estoque</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.stock ?? 0} un. — {fmtCur(p.price)}</option>)}
              </select>
              <input style={inp} type="number" min="1" value={draft.productQty} onChange={e=>updateDraft({ productQty:e.target.value })} />
              <button style={btnSm("#16a34a")} onClick={addMaterial}>Adicionar</button>
            </div>

            {draft.materialItems.length === 0 ? (
              <div style={{ color:"#94a3b8", fontWeight:"800", fontSize:"13px" }}>Nenhuma peça/material adicionada.</div>
            ) : draft.materialItems.map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px", borderBottom:"1px solid #f1f5f9", padding:"8px 0" }}>
                <div>
                  <div style={{ fontWeight:"900", color:"#0f172a" }}>{item.qty}x {item.name}</div>
                  <div style={{ color:"#64748b", fontSize:"12px", fontWeight:"700" }}>{fmtCur(item.price)} un. • {fmtCur((Number(item.qty)||0)*(Number(item.price)||0))}</div>
                </div>
                <button style={btnSm("#ef4444")} onClick={()=>removeMaterial(item.id)}>Remover</button>
              </div>
            ))}
          </div>

          <div style={{ ...card, borderRadius:"22px", padding:"18px" }}>
            <div style={{ fontWeight:"900", fontSize:"18px", color:"#0f172a", marginBottom:"10px" }}>Resumo e pagamento</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
              <select style={inp} value={draft.paymentMethod} onChange={e=>updateDraft({ paymentMethod:e.target.value })}>
                {PAYMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <input style={inp} value={draft.discount} onChange={e=>updateDraft({ discount:e.target.value })} placeholder="Desconto" />
              {draft.paymentMethod === "crediario" && (
                <input style={{ ...inp, gridColumn:isMobile?undefined:"1 / -1" }} type="date" value={draft.dueDate} onChange={e=>updateDraft({ dueDate:e.target.value })} />
              )}
            </div>

            <div style={{ background:"#0f172a", color:"#fff", borderRadius:"18px", padding:"16px", marginTop:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}><span>Mão de obra</span><strong>{fmtCur(laborTotal)}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}><span>Peças/materiais</span><strong>{fmtCur(materialsTotal)}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}><span>Desconto</span><strong>{fmtCur(discountValue)}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"22px", fontWeight:"900", borderTop:"1px solid rgba(255,255,255,.18)", paddingTop:"10px" }}>
                <span>Total</span><span>{fmtCur(total)}</span>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:"8px", marginTop:"12px" }}>
              <button style={btnSm("#7c3aed")} onClick={sendToPayment}>Pronto para pagamento</button>
              <button style={btnSm("#16a34a")} onClick={finishPayment}>Receber e concluir</button>
              <button style={btnSm("#991b1b")} onClick={cancelService}>Cancelar serviço</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
            <div>
              <div style={{ fontWeight:"900", fontSize:"22px", color:"#0f172a" }}>Acompanhamento de Serviços</div>
              <div style={{ color:"#64748b", fontWeight:"700", fontSize:"13px" }}>Abra, continue, cobre e conclua cada serviço.</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"12px" }}>
            <button style={{ ...btn(filter==="ativos"?"#e94560":"#f1f5f9"), color:filter==="ativos"?"#fff":"#64748b" }} onClick={()=>setFilter("ativos")}>
              Em aberto ({activeServices.length})
            </button>
            <button style={{ ...btn(filter==="finalizados"?"#e94560":"#f1f5f9"), color:filter==="finalizados"?"#fff":"#64748b" }} onClick={()=>setFilter("finalizados")}>
              Concluídos ({finishedServices.length})
            </button>
          </div>

          {filteredServices.length === 0 ? (
            <div style={{ color:"#94a3b8", textAlign:"center", padding:"20px 0", fontWeight:"800" }}>Nenhum serviço nesta lista.</div>
          ) : filteredServices.map(service => <ServiceCard key={service.id} service={service} />)}
        </div>
      )}
    </div>
  );
}
