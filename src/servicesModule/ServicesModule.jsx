import { useEffect, useMemo, useRef, useState } from "react";

const TECHNICIANS_KEY = "erpmini_technicians";
const MAX_PHOTOS = 8;
const MAX_FILE_BYTES = 700_000;

const PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "PIX" },
  { key: "debito", label: "Débito" },
  { key: "credito", label: "Crédito" },
  { key: "crediario", label: "Crediário" },
];

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeMoney(value) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "")
    .replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function statusLabel(status) {
  const map = {
    orcamento: "Orçamento",
    aguardando_aprovacao: "Aguardando aprovação",
    aprovado: "Aprovado",
    aberto: "Aberto",
    andamento: "Em andamento",
    pagamento: "Pronto para receber",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };
  return map[status] || "Aberto";
}

function statusStyle(status) {
  const map = {
    orcamento: { bg: "#eef2ff", color: "#4338ca" },
    aguardando_aprovacao: { bg: "#fff7ed", color: "#c2410c" },
    aprovado: { bg: "#ecfdf5", color: "#047857" },
    aberto: { bg: "#eff6ff", color: "#2563eb" },
    andamento: { bg: "#fff7ed", color: "#f97316" },
    pagamento: { bg: "#f5f3ff", color: "#7c3aed" },
    concluido: { bg: "#dcfce7", color: "#166534" },
    cancelado: { bg: "#fee2e2", color: "#991b1b" },
  };
  return map[status] || { bg: "#f1f5f9", color: "#64748b" };
}

function loadTechnicians() {
  try {
    const value = JSON.parse(localStorage.getItem(TECHNICIANS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveTechnicians(list) {
  try {
    localStorage.setItem(TECHNICIANS_KEY, JSON.stringify(list));
  } catch {}
}

function pushHistory(history, title, detail = "") {
  return [
    ...(Array.isArray(history) ? history : []),
    { id: newId(), at: new Date().toISOString(), title, detail },
  ];
}

function emptyDraft() {
  return {
    id: null,
    clientMode: "existente",
    clientId: "",
    newClient: { name: "", phone: "", email: "" },
    description: "",
    diagnosis: "",
    equipment: "",
    identifier: "",
    status: "aberto",
    approvalStatus: "nao_enviado",
    technician: "",
    promisedDate: addDaysISO(3),
    warrantyDays: "90",
    warrantyNotes: "",
    laborName: "",
    laborValue: "",
    laborItems: [],
    productId: "",
    productQty: 1,
    materialItems: [],
    discount: "",
    paymentMethod: "pix",
    dueDate: "",
    photos: [],
    attachments: [],
    signature: "",
    timeMinutes: "",
    commissionPercent: "",
    notes: "",
    history: [],
  };
}

async function compressImage(file, maxWidth = 1280, quality = 0.72) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function SignaturePad({ value, onChange, readOnly = false }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, [value]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {
      x: ((source.clientX - rect.left) / rect.width) * canvas.width,
      y: ((source.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event) => {
    if (readOnly) return;
    event.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (event) => {
    if (!drawing.current || readOnly) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current || readOnly) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        style={{ width: "100%", height: "150px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: "14px", touchAction: "none" }}
      />
      {!readOnly && (
        <button type="button" onClick={() => onChange("")} style={{ marginTop: "6px", border: "none", borderRadius: "10px", padding: "8px 12px", background: "#e2e8f0", color: "#334155", fontWeight: 800 }}>
          Limpar assinatura
        </button>
      )}
    </div>
  );
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
  notify,
}) {
  const [view, setView] = useState("lista");
  const [filter, setFilter] = useState("ativos");
  const [draft, setDraft] = useState(emptyDraft());
  const [selectedService, setSelectedService] = useState(null);
  const [formSection, setFormSection] = useState("geral");
  const [technicians, setTechnicians] = useState(loadTechnicians);
  const [newTech, setNewTech] = useState("");
  const photoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(draft.clientId)),
    [clients, draft.clientId]
  );

  const laborTotal = useMemo(
    () => draft.laborItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    [draft.laborItems]
  );
  const materialsTotal = useMemo(
    () => draft.materialItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0),
    [draft.materialItems]
  );
  const materialCost = useMemo(
    () => draft.materialItems.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.qty) || 0), 0),
    [draft.materialItems]
  );
  const discountValue = normalizeMoney(draft.discount);
  const total = Math.max(0, laborTotal + materialsTotal - discountValue);
  const profit = total - materialCost;
  const commission = Math.max(0, profit * (normalizeMoney(draft.commissionPercent) / 100));

  const activeServices = services.filter((s) => !["concluido", "cancelado"].includes(String(s.status || "")));
  const finishedServices = services.filter((s) => ["concluido", "cancelado"].includes(String(s.status || "")));
  const filteredServices = filter === "ativos" ? activeServices : finishedServices;

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthDone = services.filter((s) => s.status === "concluido" && String(s.paidAt || s.updatedAt || "").startsWith(monthKey));
  const monthRevenue = monthDone.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const monthProfit = monthDone.reduce((sum, s) => sum + (Number(s.profit) || 0), 0);
  const awaitingApproval = services.filter((s) => s.status === "aguardando_aprovacao").length;

  const updateDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const persistTechnicians = (list) => {
    setTechnicians(list);
    saveTechnicians(list);
  };

  const addTechnician = () => {
    const name = newTech.trim();
    if (!name) return;
    if (technicians.some((t) => t.toLowerCase() === name.toLowerCase())) {
      notify?.("Responsável já cadastrado.", "error");
      return;
    }
    const next = [...technicians, name];
    persistTechnicians(next);
    updateDraft({ technician: name });
    setNewTech("");
    notify?.("Responsável adicionado.");
  };

  const startNew = () => {
    setDraft({
      ...emptyDraft(),
      history: pushHistory([], "Criação", "Nova ordem de serviço iniciada."),
    });
    setFormSection("geral");
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openService = (service, forceView = false) => {
    const final = ["concluido", "cancelado"].includes(String(service.status || ""));
    if (final && !forceView) {
      setSelectedService(selectedService?.id === service.id ? null : service);
      notify?.("Serviço finalizado — somente consulta.");
      return;
    }

    setDraft({
      ...emptyDraft(),
      id: service.id,
      clientMode: "existente",
      clientId: service.clientId || "",
      newClient: {
        name: service.clientName || "",
        phone: service.clientPhone || "",
        email: service.clientEmail || "",
      },
      description: service.description || "",
      diagnosis: service.diagnosis || "",
      equipment: service.equipment || "",
      identifier: service.identifier || "",
      status: service.status || "aberto",
      approvalStatus: service.approvalStatus || "nao_enviado",
      technician: service.technician || "",
      promisedDate: service.promisedDate || "",
      warrantyDays: String(service.warrantyDays ?? "90"),
      warrantyNotes: service.warrantyNotes || "",
      laborItems: service.laborItems || [],
      materialItems: service.materialItems || [],
      discount: String(service.discount || ""),
      paymentMethod: service.paymentMethod || "pix",
      dueDate: service.dueDate || "",
      photos: service.photos || [],
      attachments: service.attachments || [],
      signature: service.signature || "",
      timeMinutes: String(service.timeMinutes || ""),
      commissionPercent: String(service.commissionPercent || ""),
      notes: service.notes || "",
      history: service.history || [],
    });
    setFormSection("geral");
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getClientForSave = () => {
    if (draft.clientMode === "existente") return selectedClient || null;

    const name = draft.newClient.name.trim();
    if (!name) return null;
    const existing = clients.find(
      (c) => String(c.name || "").toLowerCase() === name.toLowerCase() && String(c.phone || "") === String(draft.newClient.phone || "")
    );
    if (existing) return existing;

    const client = {
      id: newId(),
      name,
      phone: draft.newClient.phone || "",
      email: draft.newClient.email || "",
      createdAt: new Date().toISOString(),
    };
    setClients((prev) => [...prev, client]);
    return client;
  };

  const buildServicePayload = (nextStatus, historyTitle, historyDetail = "") => {
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
    const previous = services.find((s) => String(s.id) === String(draft.id));
    const warrantyDays = Math.max(0, Number(draft.warrantyDays) || 0);
    const warrantyEnd = nextStatus === "concluido" && warrantyDays ? addDaysISO(warrantyDays) : previous?.warrantyEnd || "";
    const nextHistory = historyTitle
      ? pushHistory(draft.history, historyTitle, historyDetail)
      : draft.history;

    return {
      id: draft.id || newId(),
      date: previous?.date || now,
      updatedAt: now,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || "",
      clientEmail: client.email || "",
      description: draft.description.trim(),
      diagnosis: draft.diagnosis.trim(),
      equipment: draft.equipment.trim(),
      identifier: draft.identifier.trim(),
      status: nextStatus || draft.status || "aberto",
      approvalStatus: draft.approvalStatus,
      technician: draft.technician,
      promisedDate: draft.promisedDate,
      warrantyDays,
      warrantyEnd,
      warrantyNotes: draft.warrantyNotes,
      laborItems: draft.laborItems,
      materialItems: draft.materialItems,
      laborTotal,
      materialsTotal,
      materialCost,
      discount: discountValue,
      total,
      profit,
      commissionPercent: normalizeMoney(draft.commissionPercent),
      commission,
      paymentMethod: draft.paymentMethod,
      dueDate: draft.paymentMethod === "crediario" ? draft.dueDate : "",
      photos: draft.photos,
      attachments: draft.attachments,
      signature: draft.signature,
      timeMinutes: Math.max(0, Number(draft.timeMinutes) || 0),
      notes: draft.notes,
      history: nextHistory,
      paidAt: nextStatus === "concluido" ? now : previous?.paidAt || null,
    };
  };

  const upsertService = (payload) => {
    setServices((prev) => {
      const exists = prev.some((s) => String(s.id) === String(payload.id));
      return exists
        ? prev.map((s) => (String(s.id) === String(payload.id) ? { ...s, ...payload } : s))
        : [payload, ...prev];
    });
    updateDraft({ id: payload.id, status: payload.status, history: payload.history });
  };

  const saveStep = (nextStatus = draft.status, title = "Atualização", detail = "Dados da OS atualizados.") => {
    const payload = buildServicePayload(nextStatus, title, detail);
    if (!payload) return null;
    upsertService(payload);
    notify?.("Serviço salvo.");
    return payload;
  };

  const sendBudget = () => {
    updateDraft({ approvalStatus: "aguardando" });
    const payload = buildServicePayload("aguardando_aprovacao", "Orçamento enviado", "Aguardando aprovação do cliente.");
    if (!payload) return;
    payload.approvalStatus = "aguardando";
    upsertService(payload);
    notify?.("Orçamento salvo como aguardando aprovação.");
  };

  const approveBudget = () => {
    updateDraft({ approvalStatus: "aprovado" });
    const payload = buildServicePayload("aprovado", "Orçamento aprovado", "Cliente aprovou o orçamento.");
    if (!payload) return;
    payload.approvalStatus = "aprovado";
    upsertService(payload);
    notify?.("Orçamento aprovado.");
  };

  const rejectBudget = () => {
    updateDraft({ approvalStatus: "recusado" });
    const payload = buildServicePayload("cancelado", "Orçamento recusado", "Cliente recusou o orçamento.");
    if (!payload) return;
    payload.approvalStatus = "recusado";
    upsertService(payload);
    setView("lista");
    notify?.("Orçamento recusado e serviço cancelado.");
  };

  const sendToWork = () => {
    const payload = saveStep("andamento", "Serviço iniciado", draft.technician ? `Responsável: ${draft.technician}.` : "Execução iniciada.");
    if (payload) notify?.("Serviço enviado para andamento.");
  };

  const sendToPayment = () => {
    if (draft.laborItems.length === 0 && draft.materialItems.length === 0) {
      notify?.("Adicione mão de obra ou peças/materiais antes do recebimento.", "error");
      return;
    }
    const payload = saveStep("pagamento", "Serviço pronto", "Aguardando recebimento.");
    if (payload) notify?.("Serviço pronto para receber.");
  };

  const addLabor = () => {
    const name = draft.laborName.trim();
    const value = normalizeMoney(draft.laborValue);
    if (!name) return notify?.("Informe a descrição da mão de obra.", "error");
    if (value <= 0) return notify?.("Informe o valor da mão de obra.", "error");
    updateDraft({
      laborItems: [...draft.laborItems, { id: newId(), name, value }],
      laborName: "",
      laborValue: "",
    });
  };

  const addMaterial = () => {
    const prod = products.find((p) => String(p.id) === String(draft.productId));
    if (!prod) return notify?.("Selecione um produto/peça.", "error");
    const qty = Number(draft.productQty) || 0;
    if (qty <= 0) return notify?.("Informe a quantidade.", "error");
    const already = draft.materialItems
      .filter((item) => String(item.id) === String(prod.id))
      .reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    if ((Number(prod.stock) || 0) < qty + already) return notify?.("Estoque insuficiente.", "error");

    const exists = draft.materialItems.find((item) => String(item.id) === String(prod.id));
    const next = exists
      ? draft.materialItems.map((item) =>
          String(item.id) === String(prod.id)
            ? { ...item, qty: Number(item.qty || 0) + qty, reserved: true }
            : item
        )
      : [
          ...draft.materialItems,
          {
            id: prod.id,
            name: prod.name,
            qty,
            price: Number(prod.price) || 0,
            cost: Number(prod.cost || prod.custo || 0),
            barcode: prod.barcode || "",
            reserved: true,
          },
        ];
    updateDraft({ materialItems: next, productId: "", productQty: 1 });
  };

  const handlePhotos = async (files) => {
    const available = Math.max(0, MAX_PHOTOS - draft.photos.length);
    const selected = Array.from(files || []).slice(0, available);
    if (!selected.length) return;
    try {
      const compressed = [];
      for (const file of selected) compressed.push(await compressImage(file));
      updateDraft({ photos: [...draft.photos, ...compressed] });
      notify?.(`${compressed.length} foto(s) adicionada(s).`);
    } catch {
      notify?.("Não foi possível processar as fotos.", "error");
    }
  };

  const handleAttachments = async (files) => {
    const selected = Array.from(files || []);
    const next = [];
    for (const file of selected) {
      if (file.size > MAX_FILE_BYTES) {
        notify?.(`Arquivo muito grande: ${file.name}. Limite aproximado de 700 KB.`, "error");
        continue;
      }
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      next.push({ id: newId(), name: file.name, type: file.type, size: file.size, data });
    }
    if (next.length) updateDraft({ attachments: [...draft.attachments, ...next] });
  };

  const finishPayment = () => {
    if (draft.laborItems.length === 0 && draft.materialItems.length === 0) return notify?.("Adicione mão de obra ou peças/materiais.", "error");
    if (draft.paymentMethod === "crediario" && !draft.dueDate) return notify?.("Informe o vencimento do crediário.", "error");

    const payload = buildServicePayload("concluido", "Pagamento recebido", `Forma: ${draft.paymentMethod}.`);
    if (!payload) return;
    if (services.some((s) => String(s.id) === String(payload.id) && s.status === "concluido")) return notify?.("Este serviço já foi concluído.", "error");

    setProducts((prev) =>
      prev.map((prod) => {
        const used = draft.materialItems.find((item) => String(item.id) === String(prod.id));
        return used ? { ...prod, stock: Math.max(0, (Number(prod.stock) || 0) - (Number(used.qty) || 0)) } : prod;
      })
    );
    upsertService(payload);

    const saleLike = {
      id: payload.id,
      date: payload.paidAt || payload.updatedAt,
      total: payload.total,
      items: [
        ...payload.laborItems.map((item) => ({ id: `mao-${item.id}`, name: item.name, qty: 1, price: item.value, type: "mao_de_obra" })),
        ...payload.materialItems.map((item) => ({ ...item, type: "material" })),
      ],
      type: "servico",
      serviceId: payload.id,
      payments: payload.paymentMethod === "crediario" ? [] : [{ method: payload.paymentMethod, amount: payload.total }],
      fiado:
        payload.paymentMethod === "crediario"
          ? { clientId: payload.clientId, clientName: payload.clientName, dueDate: payload.dueDate, paid: false, paidAmount: 0 }
          : null,
    };

    setSales((prev) => (prev.some((s) => String(s.serviceId) === String(payload.id)) ? prev : [saleLike, ...prev]));
    if (payload.paymentMethod === "crediario") {
      setReceivables((prev) =>
        prev.some((r) => String(r.id) === String(payload.id))
          ? prev
          : [
              {
                id: payload.id,
                document: `SERV-${payload.id}`,
                clientId: payload.clientId,
                clientName: payload.clientName,
                amount: payload.total,
                paidAmount: 0,
                paid: false,
                dueDate: payload.dueDate,
                createdAt: payload.paidAt || payload.updatedAt,
                source: "servico",
              },
              ...prev,
            ]
      );
    }
    notify?.("Pagamento lançado e serviço concluído.");
    setDraft(emptyDraft());
    setView("lista");
    setFilter("finalizados");
  };

  const cancelService = () => {
    const payload = saveStep("cancelado", "Serviço cancelado", "Ordem encerrada sem conclusão.");
    if (payload) setView("lista");
  };

  const printService = (service) => {
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return notify?.("Permita pop-ups para imprimir.", "error");
    const laborRows = (service.laborItems || []).map((i) => `<tr><td>${i.name}</td><td>1</td><td>${fmtCur(i.value)}</td><td>${fmtCur(i.value)}</td></tr>`).join("");
    const materialRows = (service.materialItems || []).map((i) => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${fmtCur(i.price)}</td><td>${fmtCur((Number(i.qty)||0)*(Number(i.price)||0))}</td></tr>`).join("");
    const photoHtml = (service.photos || []).map((src) => `<img src="${src}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;margin:4px"/>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>OS ${service.id}</title><style>
      body{font-family:Arial,sans-serif;color:#0f172a;margin:30px}h1,h2,p{margin:0}.header{display:flex;justify-content:space-between;border-bottom:3px solid #e94560;padding-bottom:15px}.muted{color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.box{border:1px solid #cbd5e1;border-radius:10px;padding:10px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}.totals{margin-left:auto;width:320px;margin-top:18px}.row{display:flex;justify-content:space-between;padding:5px}.total{font-size:20px;font-weight:bold;border-top:2px solid #0f172a}.signature{max-width:300px;height:100px;object-fit:contain;border-bottom:1px solid #111}.photos{margin-top:15px}.footer{margin-top:30px;font-size:11px;color:#64748b;text-align:center}@media print{button{display:none}}</style></head><body>
      <div class="header"><div><h1>${storeName || "ERPmini"}</h1><p class="muted">Ordem de Serviço</p></div><div><h2>#${service.id}</h2><p>${statusLabel(service.status)}</p></div></div>
      <div class="grid"><div class="box"><b>Cliente:</b> ${service.clientName}<br><b>Telefone:</b> ${service.clientPhone || "-"}</div><div class="box"><b>Entrada:</b> ${fmtDate(service.date)}<br><b>Previsão:</b> ${service.promisedDate || "-"}<br><b>Responsável:</b> ${service.technician || "-"}</div></div>
      <div class="box"><b>Serviço solicitado</b><p>${service.description || "-"}</p><br><b>Diagnóstico</b><p>${service.diagnosis || "-"}</p></div>
      <table><thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>${laborRows}${materialRows}</tbody></table>
      <div class="totals"><div class="row"><span>Mão de obra</span><b>${fmtCur(service.laborTotal)}</b></div><div class="row"><span>Materiais</span><b>${fmtCur(service.materialsTotal)}</b></div><div class="row"><span>Desconto</span><b>${fmtCur(service.discount)}</b></div><div class="row total"><span>Total</span><span>${fmtCur(service.total)}</span></div></div>
      ${service.warrantyDays ? `<div class="box" style="margin-top:18px"><b>Garantia:</b> ${service.warrantyDays} dias ${service.warrantyEnd ? `(até ${service.warrantyEnd})` : ""}<br>${service.warrantyNotes || ""}</div>` : ""}
      ${photoHtml ? `<div class="photos"><b>Fotos</b><div>${photoHtml}</div></div>` : ""}
      ${service.signature ? `<div style="margin-top:25px"><img class="signature" src="${service.signature}"/><div>Assinatura do cliente</div></div>` : ""}
      <div class="footer">Documento de controle interno — não fiscal • ERPmini</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const shareWhatsApp = (service) => {
    const phone = onlyDigits(service.clientPhone);
    const text = [
      `Olá, ${service.clientName}!`,
      `Atualização do serviço #${service.id}: ${statusLabel(service.status)}.`,
      `Serviço: ${service.description}`,
      `Total: ${fmtCur(service.total || 0)}`,
      service.promisedDate ? `Previsão: ${service.promisedDate}` : "",
      `Atenciosamente, ${storeName || "ERPmini"}.`,
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const sectionButton = (key, label) => (
    <button type="button" onClick={() => setFormSection(key)} style={{ border: "none", borderRadius: "12px", padding: "10px 8px", fontWeight: 900, background: formSection === key ? "#e94560" : "#f1f5f9", color: formSection === key ? "#fff" : "#64748b" }}>
      {label}
    </button>
  );

  const ServiceCard = ({ service }) => {
    const st = statusStyle(service.status);
    const final = ["concluido", "cancelado"].includes(service.status);
    const late = service.promisedDate && !final && service.promisedDate < new Date().toISOString().slice(0, 10);
    return (
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "18px", padding: "14px", marginBottom: "12px", background: "#fff", boxShadow: "0 8px 22px rgba(15,23,42,.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
          <div><div style={{ fontWeight: 900, color: "#0f172a", fontSize: "18px" }}>{service.clientName}</div><div style={{ color: "#64748b", fontSize: "12px", fontWeight: 700 }}>#{service.id} • {fmtDate(service.date)}</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontWeight: 900, color: "#16a34a", fontSize: "18px" }}>{fmtCur(service.total || 0)}</div><span style={{ background: st.bg, color: st.color, borderRadius: "999px", padding: "4px 9px", fontSize: "11px", fontWeight: 900 }}>{statusLabel(service.status)}</span></div>
        </div>
        <div style={{ color: "#334155", fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>{service.description}</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "9px" }}>
          {service.technician && <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900 }}>{service.technician}</span>}
          {service.promisedDate && <span style={{ background: late ? "#fee2e2" : "#eff6ff", color: late ? "#991b1b" : "#2563eb", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900 }}>{late ? "Atrasado" : "Previsão"}: {service.promisedDate}</span>}
          {(Number(service.discount)||0)>0 && <span style={{ background: "#fef2f2", color: "#991b1b", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900 }}>Desc.: {fmtCur(service.discount)}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: "8px", marginTop: "10px" }}>
          {!final && <button style={btnSm("#e94560")} onClick={() => openService(service)}>Continuar / Editar</button>}
          <button style={btnSm("#6366f1")} onClick={() => setSelectedService(selectedService?.id === service.id ? null : service)}>{selectedService?.id === service.id ? "Ocultar detalhes" : "Ver detalhes"}</button>
          <button style={btnSm("#0f172a")} onClick={() => printService(service)}>PDF / Imprimir</button>
          <button style={btnSm("#16a34a")} onClick={() => shareWhatsApp(service)}>WhatsApp</button>
        </div>
        {selectedService?.id === service.id && (
          <div style={{ marginTop: "10px", background: "#f8fafc", borderRadius: "14px", padding: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", fontSize: "12px" }}>
              <div><b>Responsável:</b> {service.technician || "-"}</div><div><b>Tempo:</b> {service.timeMinutes || 0} min</div>
              <div><b>Lucro estimado:</b> {fmtCur(service.profit || 0)}</div><div><b>Comissão:</b> {fmtCur(service.commission || 0)}</div>
              <div><b>Garantia:</b> {service.warrantyDays || 0} dias</div><div><b>Desconto:</b> {fmtCur(service.discount || 0)}</div>
            </div>
            <div style={{ marginTop: "10px", fontWeight: 900 }}>Histórico</div>
            {(service.history || []).slice().reverse().map((h) => <div key={h.id} style={{ borderLeft: "3px solid #cbd5e1", padding: "5px 8px", marginTop: "6px", fontSize: "12px" }}><b>{h.title}</b><div>{h.detail}</div><small>{fmtDate(h.at)}</small></div>)}
          </div>
        )}
      </div>
    );
  };

  const finalReadOnly = ["concluido", "cancelado"].includes(draft.status);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px", background: "#fff", padding: "8px", borderRadius: "18px", boxShadow: "0 4px 16px rgba(15,23,42,.08)" }}>
        <button onClick={startNew} style={{ border: "none", borderRadius: "14px", padding: "12px", fontWeight: 900, background: view === "form" ? "#e94560" : "#f1f5f9", color: view === "form" ? "#fff" : "#64748b" }}>+ Novo Serviço</button>
        <button onClick={() => setView("lista")} style={{ border: "none", borderRadius: "14px", padding: "12px", fontWeight: 900, background: view === "lista" ? "#e94560" : "#f1f5f9", color: view === "lista" ? "#fff" : "#64748b" }}>Acompanhar</button>
      </div>

      {view === "lista" ? (
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: "22px", color: "#0f172a" }}>Gestão de Serviços</div>
          <div style={{ color: "#64748b", fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>Ordens, orçamento, execução, pagamento e pós-venda.</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "8px", marginBottom: "12px" }}>
            {[["Em aberto", activeServices.length, "#2563eb"],["Aprovação", awaitingApproval, "#f97316"],["Receita mês", fmtCur(monthRevenue), "#16a34a"],["Lucro mês", fmtCur(monthProfit), "#7c3aed"]].map(([label,value,color]) => <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "10px" }}><div style={{ fontSize: "11px", color: "#64748b", fontWeight: 900 }}>{label}</div><div style={{ fontSize: String(value).length > 10 ? "16px" : "22px", color, fontWeight: 900 }}>{value}</div></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            <button style={{ ...btn(filter === "ativos" ? "#e94560" : "#f1f5f9"), color: filter === "ativos" ? "#fff" : "#64748b" }} onClick={() => setFilter("ativos")}>Em aberto ({activeServices.length})</button>
            <button style={{ ...btn(filter === "finalizados" ? "#e94560" : "#f1f5f9"), color: filter === "finalizados" ? "#fff" : "#64748b" }} onClick={() => setFilter("finalizados")}>Finalizados ({finishedServices.length})</button>
          </div>
          {filteredServices.length ? filteredServices.map((s) => <ServiceCard key={s.id} service={s} />) : <div style={{ textAlign: "center", color: "#94a3b8", padding: "24px", fontWeight: 800 }}>Nenhum serviço nesta lista.</div>}
        </div>
      ) : (
        <div>
          <div style={{ ...card, borderRadius: "22px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}><div><div style={{ fontWeight: 900, fontSize: "22px", color: "#0f172a" }}>{draft.id ? `Serviço #${draft.id}` : "Abrir Serviço"}</div><div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>Salve e avance por etapas.</div></div><span style={{ ...statusStyle(draft.status), background: statusStyle(draft.status).bg, borderRadius: "999px", padding: "6px 10px", fontWeight: 900, fontSize: "12px" }}>{statusLabel(draft.status)}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "6px", marginTop: "12px" }}>{sectionButton("geral","Geral")}{sectionButton("itens","Itens")}{sectionButton("evidencias","Fotos/Assinatura")}{sectionButton("financeiro","Financeiro")}</div>
          </div>

          {formSection === "geral" && <div style={{ ...card, borderRadius: "22px", padding: "18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px" }}>
              <button style={{ ...btn(draft.clientMode === "existente" ? "#e94560" : "#e2e8f0"), color: draft.clientMode === "existente" ? "#fff" : "#334155" }} onClick={() => updateDraft({ clientMode: "existente" })}>Cliente existente</button>
              <button style={{ ...btn(draft.clientMode === "novo" ? "#e94560" : "#e2e8f0"), color: draft.clientMode === "novo" ? "#fff" : "#334155" }} onClick={() => updateDraft({ clientMode: "novo" })}>Novo cliente</button>
            </div>
            {draft.clientMode === "existente" ? <select style={{ ...inp, marginTop: "8px" }} value={draft.clientId} onChange={(e) => updateDraft({ clientId: e.target.value })}><option value="">Selecione o cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "8px" }}><input style={inp} value={draft.newClient.name} onChange={(e) => updateDraft({ newClient: { ...draft.newClient, name: e.target.value } })} placeholder="Nome"/><input style={inp} value={draft.newClient.phone} onChange={(e) => updateDraft({ newClient: { ...draft.newClient, phone: e.target.value } })} placeholder="Telefone"/><input style={inp} value={draft.newClient.email} onChange={(e) => updateDraft({ newClient: { ...draft.newClient, email: e.target.value } })} placeholder="E-mail"/></div>}
            <textarea style={{ ...inp, minHeight: "90px", marginTop: "8px" }} value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="Serviço solicitado" />
            <textarea style={{ ...inp, minHeight: "75px", marginTop: "8px" }} value={draft.diagnosis} onChange={(e) => updateDraft({ diagnosis: e.target.value })} placeholder="Diagnóstico / observações técnicas" />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "8px" }}><input style={inp} value={draft.equipment} onChange={(e) => updateDraft({ equipment: e.target.value })} placeholder="Equipamento / objeto (opcional)"/><input style={inp} value={draft.identifier} onChange={(e) => updateDraft({ identifier: e.target.value })} placeholder="Placa / série / identificação"/><select style={inp} value={draft.technician} onChange={(e) => updateDraft({ technician: e.target.value })}><option value="">Responsável</option>{technicians.map((t) => <option key={t}>{t}</option>)}</select><input style={inp} type="date" value={draft.promisedDate} onChange={(e) => updateDraft({ promisedDate: e.target.value })}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "8px" }}><input style={inp} value={newTech} onChange={(e) => setNewTech(e.target.value)} placeholder="Cadastrar responsável"/><button style={btnSm("#0f172a")} onClick={addTechnician}>Adicionar</button></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: "8px", marginTop: "12px" }}><button style={btnSm("#2563eb")} onClick={() => saveStep("aberto","OS salva","Informações iniciais registradas.")}>Salvar aberto</button><button style={btnSm("#7c3aed")} onClick={sendBudget}>Enviar orçamento</button><button style={btnSm("#16a34a")} onClick={approveBudget}>Aprovar orçamento</button><button style={btnSm("#f97316")} onClick={sendToWork}>Enviar para andamento</button><button style={btnSm("#991b1b")} onClick={rejectBudget}>Recusar/cancelar</button></div>
          </div>}

          {formSection === "itens" && <><div style={{ ...card, borderRadius: "22px", padding: "18px" }}><div style={{ fontWeight: 900, fontSize: "18px" }}>Mão de obra</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 140px auto", gap: "8px", marginTop: "8px" }}><input style={inp} value={draft.laborName} onChange={(e) => updateDraft({ laborName: e.target.value })} placeholder="Descrição"/><input style={inp} value={draft.laborValue} onChange={(e) => updateDraft({ laborValue: e.target.value })} placeholder="Valor"/><button style={btnSm("#16a34a")} onClick={addLabor}>Adicionar</button></div>{draft.laborItems.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}><span>{i.name}</span><span><b>{fmtCur(i.value)}</b> <button style={btnSm("#ef4444")} onClick={() => updateDraft({ laborItems: draft.laborItems.filter((x) => x.id !== i.id) })}>X</button></span></div>)}</div><div style={{ ...card, borderRadius: "22px", padding: "18px" }}><div style={{ fontWeight: 900, fontSize: "18px" }}>Peças / materiais</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 100px auto", gap: "8px", marginTop: "8px" }}><select style={inp} value={draft.productId} onChange={(e) => updateDraft({ productId: e.target.value })}><option value="">Selecionar do estoque</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.stock || 0} un.</option>)}</select><input style={inp} type="number" min="1" value={draft.productQty} onChange={(e) => updateDraft({ productQty: e.target.value })}/><button style={btnSm("#16a34a")} onClick={addMaterial}>Reservar</button></div>{draft.materialItems.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}><span>{i.qty}x {i.name} <small style={{ color: "#f97316" }}>reservado</small></span><span><b>{fmtCur(i.qty*i.price)}</b> <button style={btnSm("#ef4444")} onClick={() => updateDraft({ materialItems: draft.materialItems.filter((x) => String(x.id) !== String(i.id)) })}>X</button></span></div>)}</div></>}

          {formSection === "evidencias" && <div style={{ ...card, borderRadius: "22px", padding: "18px" }}><div style={{ fontWeight: 900, fontSize: "18px" }}>Fotos e anexos</div><input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handlePhotos(e.target.files)}/><button style={{ ...btn("#2563eb"), width: "100%", marginTop: "8px" }} onClick={() => photoInputRef.current?.click()}>Adicionar fotos ({draft.photos.length}/{MAX_PHOTOS})</button><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px", marginTop: "8px" }}>{draft.photos.map((src,idx) => <div key={idx} style={{ position: "relative" }}><img src={src} alt="Serviço" style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: "10px" }}/><button onClick={() => updateDraft({ photos: draft.photos.filter((_,i) => i !== idx) })} style={{ position: "absolute", top: 3, right: 3, border: "none", background: "#991b1b", color: "#fff", borderRadius: "50%", width: 25, height: 25 }}>×</button></div>)}</div><input ref={attachmentInputRef} type="file" multiple hidden onChange={(e) => handleAttachments(e.target.files)}/><button style={{ ...btn("#64748b"), width: "100%", marginTop: "10px" }} onClick={() => attachmentInputRef.current?.click()}>Adicionar anexos</button>{draft.attachments.map((a) => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px", background: "#f8fafc", marginTop: "5px", borderRadius: "8px" }}><span>{a.name}</span><button onClick={() => updateDraft({ attachments: draft.attachments.filter((x) => x.id !== a.id) })}>Excluir</button></div>)}<div style={{ fontWeight: 900, fontSize: "18px", marginTop: "18px" }}>Assinatura do cliente</div><SignaturePad value={draft.signature} onChange={(signature) => updateDraft({ signature })}/><button style={{ ...btn("#2563eb"), width: "100%", marginTop: "10px" }} onClick={() => saveStep(draft.status,"Evidências salvas","Fotos, anexos ou assinatura atualizados.")}>Salvar evidências</button></div>}

          {formSection === "financeiro" && <div style={{ ...card, borderRadius: "22px", padding: "18px" }}><div style={{ fontWeight: 900, fontSize: "18px" }}>Financeiro e garantia</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "8px" }}><select style={inp} value={draft.paymentMethod} onChange={(e) => updateDraft({ paymentMethod: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select><input style={inp} value={draft.discount} onChange={(e) => updateDraft({ discount: e.target.value })} placeholder="Desconto"/>{draft.paymentMethod === "crediario" && <input style={inp} type="date" value={draft.dueDate} onChange={(e) => updateDraft({ dueDate: e.target.value })}/>}<input style={inp} type="number" value={draft.timeMinutes} onChange={(e) => updateDraft({ timeMinutes: e.target.value })} placeholder="Tempo gasto (min)"/><input style={inp} value={draft.commissionPercent} onChange={(e) => updateDraft({ commissionPercent: e.target.value })} placeholder="Comissão sobre lucro (%)"/><input style={inp} type="number" value={draft.warrantyDays} onChange={(e) => updateDraft({ warrantyDays: e.target.value })} placeholder="Garantia (dias)"/><input style={inp} value={draft.warrantyNotes} onChange={(e) => updateDraft({ warrantyNotes: e.target.value })} placeholder="Observações da garantia"/></div><textarea style={{ ...inp, minHeight: "75px", marginTop: "8px" }} value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} placeholder="Observações internas"/><div style={{ background: "#0f172a", color: "#fff", borderRadius: "18px", padding: "16px", marginTop: "12px" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>Mão de obra</span><b>{fmtCur(laborTotal)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Materiais</span><b>{fmtCur(materialsTotal)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Desconto</span><b>{fmtCur(discountValue)}</b></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "21px", fontWeight: 900, borderTop: "1px solid #334155", marginTop: "8px", paddingTop: "8px" }}><span>Total</span><span>{fmtCur(total)}</span></div><div style={{ display: "flex", justifyContent: "space-between", color: "#86efac", marginTop: "6px" }}><span>Lucro estimado</span><b>{fmtCur(profit)}</b></div><div style={{ display: "flex", justifyContent: "space-between", color: "#c4b5fd" }}><span>Comissão</span><b>{fmtCur(commission)}</b></div></div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "10px" }}><button style={btnSm("#7c3aed")} onClick={sendToPayment}>Pronto para receber</button><button style={btnSm("#16a34a")} onClick={finishPayment}>Receber e concluir</button><button style={btnSm("#991b1b")} onClick={cancelService}>Cancelar serviço</button></div></div>}

          {finalReadOnly && <div style={{ ...card, background: "#fff7ed", color: "#9a3412", fontWeight: 900 }}>Serviço finalizado: somente consulta.</div>}
        </div>
      )}
    </div>
  );
}
