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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemTotal(item, legacyValue = false) {
  if (legacyValue && item.unitPrice === undefined && item.qty === undefined) return Math.max(0, Number(item.value) || 0);
  const qty = Math.max(0, Number(item.qty) || 0);
  const unitPrice = Math.max(0, Number(item.unitPrice ?? item.price ?? item.value) || 0);
  const discount = Math.max(0, Number(item.discount) || 0);
  return Math.max(0, qty * unitPrice - discount);
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
    quoteNumber: null,
    quoteDate: todayISO(),
    validityDays: "10",
    validUntil: addDaysISO(10),
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
    laborUnit: "serviço",
    laborQty: "1",
    laborDiscount: "",
    catalogItemId: "",
    laborItems: [],
    productId: "",
    productQty: 1,
    materialItems: [],
    discount: "",
    travelCost: "",
    otherCosts: "",
    depositValue: "",
    paymentTerms: "50% na aprovação e 50% na conclusão do serviço.",
    executionTerms: "",
    quoteNotes: "Materiais adicionais e alterações solicitadas após a aprovação poderão ser orçados separadamente.",
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
  serviceCatalog = [],
  setServiceCatalog,
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
  const [filter, setFilter] = useState("orcamentos");
  const [draft, setDraft] = useState(emptyDraft());
  const [selectedService, setSelectedService] = useState(null);
  const [formSection, setFormSection] = useState("abertura");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [technicians, setTechnicians] = useState(loadTechnicians);
  const [newTech, setNewTech] = useState("");
  const [catalogDraft, setCatalogDraft] = useState({ name: "", unit: "serviço", price: "" });
  const photoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(draft.clientId)),
    [clients, draft.clientId]
  );

  const laborTotal = useMemo(
    () => draft.laborItems.reduce((sum, item) => sum + itemTotal(item, true), 0),
    [draft.laborItems]
  );
  const materialsTotal = useMemo(
    () => draft.materialItems.reduce((sum, item) => sum + itemTotal(item), 0),
    [draft.materialItems]
  );
  const materialCost = useMemo(
    () => draft.materialItems.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.qty) || 0), 0),
    [draft.materialItems]
  );
  const discountValue = normalizeMoney(draft.discount);
  const travelCost = normalizeMoney(draft.travelCost);
  const otherCosts = normalizeMoney(draft.otherCosts);
  const depositValue = normalizeMoney(draft.depositValue);
  const subtotal = laborTotal + materialsTotal;
  const total = Math.max(0, subtotal + travelCost + otherCosts - discountValue);
  const profit = total - materialCost;
  const commission = Math.max(0, profit * (normalizeMoney(draft.commissionPercent) / 100));

  const quoteServices = services.filter((s) => ["aberto", "orcamento", "aguardando_aprovacao", "aprovado"].includes(String(s.status || "")));
  const activeServices = services.filter((s) => ["andamento", "pagamento"].includes(String(s.status || "")));
  const finishedServices = services.filter((s) => ["concluido", "cancelado"].includes(String(s.status || "")));
  const filteredServices = filter === "orcamentos" ? quoteServices : filter === "ativos" ? activeServices : finishedServices;

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

  const nextQuoteNumber = () => {
    const highest = services.reduce((max, service) => {
      const value = Number(service.quoteNumber);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 1000);
    return highest + 1;
  };

  const addCatalogItem = () => {
    const name = catalogDraft.name.trim();
    const price = normalizeMoney(catalogDraft.price);
    if (!name) return notify?.("Informe o nome do serviço.", "error");
    if (price <= 0) return notify?.("Informe um preço de venda válido.", "error");
    if (serviceCatalog.some((item) => String(item.name || "").toLowerCase() === name.toLowerCase())) {
      return notify?.("Este serviço já está no catálogo.", "error");
    }
    setServiceCatalog?.((previous) => [
      ...previous,
      { id: newId(), name, unit: catalogDraft.unit || "serviço", price, createdAt: new Date().toISOString() },
    ]);
    setCatalogDraft({ name: "", unit: "serviço", price: "" });
    notify?.("Serviço adicionado ao catálogo.");
  };

  const removeCatalogItem = (id) => {
    if (!window.confirm("Excluir este item do catálogo?")) return;
    setServiceCatalog?.((previous) => previous.filter((item) => String(item.id) !== String(id)));
  };

  const addFromCatalog = () => {
    const item = serviceCatalog.find((entry) => String(entry.id) === String(draft.catalogItemId));
    if (!item) return notify?.("Selecione um serviço do catálogo.", "error");
    updateDraft({
      laborItems: [
        ...draft.laborItems,
        { id: newId(), name: item.name, unit: item.unit || "serviço", qty: 1, unitPrice: Number(item.price) || 0, discount: 0 },
      ],
      catalogItemId: "",
    });
  };

  const startNew = () => {
    setDraft({
      ...emptyDraft(),
      quoteNumber: nextQuoteNumber(),
      history: pushHistory([], "Criação", "Novo orçamento de serviço iniciado."),
    });
    setFormSection("abertura");
    setShowAdvanced(false);
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
      quoteNumber: service.quoteNumber || null,
      quoteDate: service.quoteDate || String(service.date || "").slice(0, 10) || todayISO(),
      validityDays: String(service.validityDays ?? "10"),
      validUntil: service.validUntil || "",
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
      travelCost: String(service.travelCost || ""),
      otherCosts: String(service.otherCosts || ""),
      depositValue: String(service.depositValue || ""),
      paymentTerms: service.paymentTerms || "50% na aprovação e 50% na conclusão do serviço.",
      executionTerms: service.executionTerms || "",
      quoteNotes: service.quoteNotes || "",
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
    const nextSection = service.status === "pagamento"
      ? "entrega"
      : service.status === "andamento"
        ? "execucao"
        : ["orcamento", "aguardando_aprovacao", "aprovado"].includes(service.status)
          ? "orcamento"
          : "abertura";
    setFormSection(nextSection);
    setShowAdvanced(false);
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
      quoteNumber: previous?.quoteNumber || draft.quoteNumber || nextQuoteNumber(),
      quoteDate: draft.quoteDate || String(previous?.date || now).slice(0, 10),
      validityDays: Math.max(1, Number(draft.validityDays) || 10),
      validUntil: draft.validUntil || addDaysISO(Math.max(1, Number(draft.validityDays) || 10)),
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
      travelCost,
      otherCosts,
      depositValue: Math.min(total, Math.max(0, depositValue)),
      paymentTerms: draft.paymentTerms,
      executionTerms: draft.executionTerms,
      quoteNotes: draft.quoteNotes,
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
    return payload;
  };

  const sendToPayment = () => {
    if (draft.laborItems.length === 0 && draft.materialItems.length === 0) {
      notify?.("Adicione mão de obra ou peças/materiais antes do recebimento.", "error");
      return null;
    }
    const payload = saveStep("pagamento", "Serviço pronto", "Aguardando recebimento.");
    if (payload) notify?.("Serviço pronto para receber.");
    return payload;
  };

  const addLabor = () => {
    const name = draft.laborName.trim();
    const unitPrice = normalizeMoney(draft.laborValue);
    const qty = Math.max(0, Number(draft.laborQty) || 0);
    const discount = normalizeMoney(draft.laborDiscount);
    if (!name) return notify?.("Informe a descrição da mão de obra.", "error");
    if (qty <= 0) return notify?.("Informe a quantidade.", "error");
    if (unitPrice <= 0) return notify?.("Informe o valor unitário.", "error");
    updateDraft({
      laborItems: [...draft.laborItems, { id: newId(), name, unit: draft.laborUnit || "serviço", qty, unitPrice, discount }],
      laborName: "",
      laborValue: "",
      laborUnit: "serviço",
      laborQty: "1",
      laborDiscount: "",
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
        ...payload.laborItems.map((item) => ({ id: `mao-${item.id}`, name: item.name, qty: Number(item.qty) || 1, price: itemTotal(item, true) / (Number(item.qty) || 1), type: "mao_de_obra" })),
        ...payload.materialItems.map((item) => ({ ...item, price: itemTotal(item) / (Number(item.qty) || 1), type: "material" })),
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
    const isQuote = ["orcamento", "aguardando_aprovacao", "aprovado", "aberto"].includes(String(service.status || ""));
    const documentTitle = isQuote ? "ORÇAMENTO DE SERVIÇOS" : "ORDEM DE SERVIÇO";
    const documentNumber = service.quoteNumber || service.id;
    const allItems = [
      ...(service.laborItems || []).map((item) => ({
        name: item.name,
        unit: item.unit || "serviço",
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice ?? item.value) || 0,
        discount: Number(item.discount) || 0,
        total: itemTotal(item, true),
      })),
      ...(service.materialItems || []).map((item) => ({
        name: item.name,
        unit: item.unit || "un",
        qty: Number(item.qty) || 0,
        unitPrice: Number(item.unitPrice ?? item.price) || 0,
        discount: Number(item.discount) || 0,
        total: itemTotal(item),
      })),
    ];
    const itemRows = allItems.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.unit)}</td><td>${item.qty}</td><td>${fmtCur(item.unitPrice)}</td><td>${fmtCur(item.discount)}</td><td><b>${fmtCur(item.total)}</b></td></tr>`).join("");
    const photoHtml = !isQuote ? (service.photos || []).map((src) => `<img src="${src}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;margin:4px"/>`).join("") : "";
    const subtotalValue = (Number(service.laborTotal) || 0) + (Number(service.materialsTotal) || 0);
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${documentTitle} ${documentNumber}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;margin:28px;font-size:12px}h1,h2,h3,p{margin:0}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #e94560;padding-bottom:15px}.brand{font-size:24px}.doc-title{font-size:18px;text-align:right}.muted{color:#64748b}.meta{margin-top:5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.box{border:1px solid #cbd5e1;border-radius:10px;padding:11px;line-height:1.55}.section{font-size:12px;letter-spacing:.5px;color:#e94560;margin-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#0f172a;color:#fff;font-size:10px;text-transform:uppercase}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th:nth-child(n+3),td:nth-child(n+3){text-align:right}.totals{margin-left:auto;width:340px;margin-top:16px;border:1px solid #cbd5e1;border-radius:10px;padding:8px}.row{display:flex;justify-content:space-between;padding:5px}.total{font-size:19px;font-weight:bold;border-top:2px solid #0f172a;margin-top:4px;padding-top:8px}.deposit{background:#ecfdf5;color:#166534;border-radius:8px}.conditions{margin-top:16px}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:44px}.signature-line{border-top:1px solid #111;text-align:center;padding-top:6px}.signature{max-width:260px;height:80px;object-fit:contain}.photos{margin-top:15px}.footer{margin-top:24px;font-size:10px;color:#64748b;text-align:center}@media print{body{margin:12mm}.no-print{display:none}}</style></head><body>
      <div class="header"><div><h1 class="brand">${escapeHtml(storeName || "ERPmini")}</h1><p class="muted">Gestão inteligente de serviços</p></div><div><h2 class="doc-title">${documentTitle}</h2><p class="meta"><b>Nº ${escapeHtml(documentNumber)}</b> • ${statusLabel(service.status)}</p></div></div>
      <div class="grid"><div class="box"><h3 class="section">DADOS DO CLIENTE</h3><b>${escapeHtml(service.clientName)}</b><br>Telefone: ${escapeHtml(service.clientPhone || "-")}<br>E-mail: ${escapeHtml(service.clientEmail || "-")}</div><div class="box"><h3 class="section">DADOS DO DOCUMENTO</h3>Data: ${escapeHtml(service.quoteDate || String(service.date || "").slice(0,10) || "-")}<br>Válido até: ${escapeHtml(service.validUntil || "-")}<br>Previsão: ${escapeHtml(service.promisedDate || "-")}</div></div>
      <div class="box"><h3 class="section">ESCOPO DO SERVIÇO</h3><p>${escapeHtml(service.description || "-")}</p>${service.equipment ? `<br><b>Equipamento/objeto:</b> ${escapeHtml(service.equipment)}` : ""}${service.identifier ? `<br><b>Identificação:</b> ${escapeHtml(service.identifier)}` : ""}${!isQuote && service.diagnosis ? `<br><br><b>Trabalho realizado:</b><br>${escapeHtml(service.diagnosis)}` : ""}</div>
      <table><thead><tr><th>#</th><th>Serviço / Material</th><th>Un.</th><th>Qtd.</th><th>Valor unit.</th><th>Desconto</th><th>Total</th></tr></thead><tbody>${itemRows || `<tr><td colspan="7" style="text-align:center;color:#64748b">Nenhum item informado.</td></tr>`}</tbody></table>
      <div class="totals"><div class="row"><span>Subtotal</span><b>${fmtCur(subtotalValue)}</b></div><div class="row"><span>Deslocamento</span><b>${fmtCur(service.travelCost || 0)}</b></div><div class="row"><span>Outros custos</span><b>${fmtCur(service.otherCosts || 0)}</b></div><div class="row"><span>Desconto geral</span><b>- ${fmtCur(service.discount || 0)}</b></div><div class="row total"><span>TOTAL</span><span>${fmtCur(service.total)}</span></div>${Number(service.depositValue)>0 ? `<div class="row deposit"><span>Entrada prevista</span><b>${fmtCur(service.depositValue)}</b></div>` : ""}</div>
      <div class="grid conditions"><div class="box"><h3 class="section">CONDIÇÕES</h3><b>Pagamento:</b> ${escapeHtml(service.paymentTerms || "A combinar.")}<br><b>Prazo:</b> ${escapeHtml(service.executionTerms || service.promisedDate || "A combinar.")}<br><b>Garantia:</b> ${escapeHtml(service.warrantyDays || 0)} dias ${service.warrantyNotes ? `— ${escapeHtml(service.warrantyNotes)}` : ""}</div><div class="box"><h3 class="section">OBSERVAÇÕES</h3>${escapeHtml(service.quoteNotes || service.notes || "Sem observações adicionais.")}</div></div>
      ${photoHtml ? `<div class="photos"><b>Fotos</b><div>${photoHtml}</div></div>` : ""}
      <div class="signature-grid"><div class="signature-line">${escapeHtml(storeName || "Prestador")}</div><div class="signature-line">${service.signature ? `<img class="signature" src="${service.signature}"/><br>` : ""}${escapeHtml(service.clientName || "Cliente")}</div></div>
      <div class="footer">Documento comercial não fiscal • Gerado pelo ERPmini</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const shareWhatsApp = (service) => {
    const phone = onlyDigits(service.clientPhone);
    const isQuote = ["aberto", "orcamento", "aguardando_aprovacao", "aprovado"].includes(String(service.status || ""));
    const text = [
      `Olá, ${service.clientName}!`,
      `${isQuote ? "Orçamento" : "Serviço"} #${service.quoteNumber || service.id}: ${statusLabel(service.status)}.`,
      `Serviço: ${service.description}`,
      `Total: ${fmtCur(service.total || 0)}`,
      isQuote && service.validUntil ? `Proposta válida até: ${service.validUntil}` : "",
      service.paymentTerms ? `Condições: ${service.paymentTerms}` : "",
      !isQuote && service.promisedDate ? `Previsão: ${service.promisedDate}` : "",
      `Atenciosamente, ${storeName || "ERPmini"}.`,
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const saveOpeningAndContinue = () => {
    const payload = saveStep("aberto", "Abertura salva", "Dados do cliente e do serviço registrados.");
    if (payload) {
      setFormSection("orcamento");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const saveBudgetOnly = () => {
    const payload = saveStep(draft.status === "aberto" ? "orcamento" : draft.status, "Orçamento salvo", "Itens e valores atualizados.");
    if (payload) notify?.("Orçamento salvo.");
  };

  const startExecution = () => {
    const payload = sendToWork();
    if (payload) {
      setFormSection("execucao");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const markReady = () => {
    const payload = sendToPayment();
    if (payload) {
      setFormSection("entrega");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const currentSavedService = () => services.find((s) => String(s.id) === String(draft.id));

  const saveAndPrint = () => {
    const payload = saveStep(draft.status || "orcamento", "Documento atualizado", "Orçamento preparado para PDF.");
    if (payload) printService(payload);
  };

  const saveAndWhatsApp = () => {
    const payload = saveStep(draft.status || "orcamento", "Compartilhamento", "Orçamento preparado para envio ao cliente.");
    if (payload) shareWhatsApp(payload);
  };

  const steps = [
    { key: "abertura", number: 1, label: "Abertura" },
    { key: "orcamento", number: 2, label: "Orçamento" },
    { key: "execucao", number: 3, label: "Execução" },
    { key: "entrega", number: 4, label: "Entrega" },
  ];

  const sectionButton = (key, label, number) => {
    const active = formSection === key;
    return (
      <button
        type="button"
        onClick={() => setFormSection(key)}
        style={{
          border: active ? "2px solid #e94560" : "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "10px 6px",
          fontWeight: 900,
          background: active ? "#fff1f4" : "#fff",
          color: active ? "#e94560" : "#64748b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
        }}
      >
        <span style={{ width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", background: active ? "#e94560" : "#e2e8f0", color: active ? "#fff" : "#64748b", fontSize: "12px" }}>{number}</span>
        <span style={{ fontSize: "11px" }}>{label}</span>
      </button>
    );
  };

  const ServiceCard = ({ service }) => {
    const st = statusStyle(service.status);
    const final = ["concluido", "cancelado"].includes(service.status);
    const isQuote = ["aberto", "orcamento", "aguardando_aprovacao", "aprovado"].includes(service.status);
    const late = service.promisedDate && !final && service.promisedDate < new Date().toISOString().slice(0, 10);
    return (
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "18px", padding: "14px", marginBottom: "12px", background: "#fff", boxShadow: "0 8px 22px rgba(15,23,42,.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
          <div><div style={{ fontWeight: 900, color: "#0f172a", fontSize: "18px" }}>{service.clientName}</div><div style={{ color: "#64748b", fontSize: "12px", fontWeight: 700 }}>{isQuote ? "Orçamento" : "Serviço"} #{service.quoteNumber || service.id} • {fmtDate(service.date)}</div></div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginBottom: "12px", background: "#fff", padding: "8px", borderRadius: "18px", boxShadow: "0 4px 16px rgba(15,23,42,.08)" }}>
        <button onClick={startNew} style={{ border: "none", borderRadius: "14px", padding: "12px 6px", fontWeight: 900, background: view === "form" ? "#e94560" : "#f1f5f9", color: view === "form" ? "#fff" : "#64748b" }}>+ Orçamento</button>
        <button onClick={() => setView("lista")} style={{ border: "none", borderRadius: "14px", padding: "12px", fontWeight: 900, background: view === "lista" ? "#e94560" : "#f1f5f9", color: view === "lista" ? "#fff" : "#64748b" }}>Acompanhar</button>
        <button onClick={() => setView("catalogo")} style={{ border: "none", borderRadius: "14px", padding: "12px", fontWeight: 900, background: view === "catalogo" ? "#e94560" : "#f1f5f9", color: view === "catalogo" ? "#fff" : "#64748b" }}>Catálogo</button>
      </div>

      {view === "catalogo" ? (
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: "22px", color: "#0f172a" }}>Catálogo de serviços</div>
          <div style={{ color: "#64748b", fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>Cadastre os serviços mais usados para preencher preço e unidade automaticamente no orçamento.</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 160px 160px auto", gap: "8px" }}>
            <input style={inp} value={catalogDraft.name} onChange={(event) => setCatalogDraft({ ...catalogDraft, name: event.target.value })} placeholder="Nome do serviço" />
            <select style={inp} value={catalogDraft.unit} onChange={(event) => setCatalogDraft({ ...catalogDraft, unit: event.target.value })}>
              {["serviço", "hora", "diária", "un", "m²", "m", "km"].map((unit) => <option key={unit}>{unit}</option>)}
            </select>
            <input style={inp} inputMode="decimal" value={catalogDraft.price} onChange={(event) => setCatalogDraft({ ...catalogDraft, price: event.target.value })} placeholder="Preço de venda" />
            <button style={btnSm("#16a34a")} onClick={addCatalogItem}>Adicionar</button>
          </div>
          <div style={{ marginTop: "16px" }}>
            {serviceCatalog.length === 0 ? <div style={{ color: "#94a3b8", textAlign: "center", padding: "22px" }}>Nenhum serviço cadastrado.</div> : serviceCatalog.map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #e2e8f0" }}>
                <div><b>{item.name}</b><div style={{ color: "#64748b", fontSize: "12px" }}>{item.unit || "serviço"}</div></div>
                <b style={{ color: "#16a34a" }}>{fmtCur(item.price || 0)}</b>
                <button style={btnSm("#ef4444")} onClick={() => removeCatalogItem(item.id)}>Excluir</button>
              </div>
            ))}
          </div>
        </div>
      ) : view === "lista" ? (
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: "22px", color: "#0f172a" }}>Orçamentos e Serviços</div>
          <div style={{ color: "#64748b", fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>Proposta comercial, aprovação, execução, pagamento e pós-venda.</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "8px", marginBottom: "12px" }}>
            {[["Orçamentos", quoteServices.length, "#2563eb"],["Aprovação", awaitingApproval, "#f97316"],["Receita mês", fmtCur(monthRevenue), "#16a34a"],["Lucro mês", fmtCur(monthProfit), "#7c3aed"]].map(([label,value,color]) => <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "10px" }}><div style={{ fontSize: "11px", color: "#64748b", fontWeight: 900 }}>{label}</div><div style={{ fontSize: String(value).length > 10 ? "16px" : "22px", color, fontWeight: 900 }}>{value}</div></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginBottom: "12px" }}>
            <button style={{ ...btn(filter === "orcamentos" ? "#e94560" : "#f1f5f9"), color: filter === "orcamentos" ? "#fff" : "#64748b", padding: "10px 5px" }} onClick={() => setFilter("orcamentos")}>Orçamentos ({quoteServices.length})</button>
            <button style={{ ...btn(filter === "ativos" ? "#e94560" : "#f1f5f9"), color: filter === "ativos" ? "#fff" : "#64748b" }} onClick={() => setFilter("ativos")}>Em aberto ({activeServices.length})</button>
            <button style={{ ...btn(filter === "finalizados" ? "#e94560" : "#f1f5f9"), color: filter === "finalizados" ? "#fff" : "#64748b" }} onClick={() => setFilter("finalizados")}>Finalizados ({finishedServices.length})</button>
          </div>
          {filteredServices.length ? filteredServices.map((s) => <ServiceCard key={s.id} service={s} />) : <div style={{ textAlign: "center", color: "#94a3b8", padding: "24px", fontWeight: 800 }}>Nenhum serviço nesta lista.</div>}
        </div>
      ) : (
        <div>
          <div style={{ ...card, borderRadius: "22px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: "22px", color: "#0f172a" }}>{draft.id ? `Orçamento #${draft.quoteNumber || draft.id}` : `Novo orçamento #${draft.quoteNumber || ""}`}</div>
                <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>Siga uma etapa por vez. Os dados permanecem salvos.</div>
              </div>
              <span style={{ background: statusStyle(draft.status).bg, color: statusStyle(draft.status).color, borderRadius: "999px", padding: "6px 10px", fontWeight: 900, fontSize: "12px" }}>{statusLabel(draft.status)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginTop: "14px" }}>
              {steps.map((step) => sectionButton(step.key, step.label, step.number))}
            </div>
          </div>

          {formSection === "abertura" && <div style={{ ...card, borderRadius: "22px", padding: "18px" }}>
            <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a" }}>1. Cliente e escopo</div>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Descreva a necessidade do cliente. Dados técnicos são opcionais e servem para qualquer tipo de serviço.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button style={{ ...btn(draft.clientMode === "existente" ? "#e94560" : "#e2e8f0"), color: draft.clientMode === "existente" ? "#fff" : "#334155" }} onClick={() => updateDraft({ clientMode: "existente" })}>Cliente existente</button>
              <button style={{ ...btn(draft.clientMode === "novo" ? "#e94560" : "#e2e8f0"), color: draft.clientMode === "novo" ? "#fff" : "#334155" }} onClick={() => updateDraft({ clientMode: "novo" })}>Novo cliente</button>
            </div>
            {draft.clientMode === "existente" ? <select style={{ ...inp, marginTop: "8px" }} value={draft.clientId} onChange={(e) => updateDraft({ clientId: e.target.value })}><option value="">Selecione o cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "8px" }}><input style={inp} value={draft.newClient.name} onChange={(e) => updateDraft({ newClient: { ...draft.newClient, name: e.target.value } })} placeholder="Nome do cliente"/><input style={inp} value={draft.newClient.phone} onChange={(e) => updateDraft({ newClient: { ...draft.newClient, phone: e.target.value } })} placeholder="Telefone / WhatsApp"/><input style={inp} value={draft.newClient.email} onChange={(e) => updateDraft({ newClient: { ...draft.newClient, email: e.target.value } })} placeholder="E-mail (opcional)"/></div>}
            <textarea style={{ ...inp, minHeight: "90px", marginTop: "8px" }} value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="O que o cliente solicitou?" />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "8px" }}>
              <input style={inp} value={draft.equipment} onChange={(e) => updateDraft({ equipment: e.target.value })} placeholder="Local, equipamento ou objeto (opcional)"/>
              <input style={inp} value={draft.identifier} onChange={(e) => updateDraft({ identifier: e.target.value })} placeholder="Referência, série ou identificação (opcional)"/>
              <select style={inp} value={draft.technician} onChange={(e) => updateDraft({ technician: e.target.value })}><option value="">Responsável pelo serviço</option>{technicians.map((t) => <option key={t}>{t}</option>)}</select>
              <input style={inp} type="date" value={draft.promisedDate} onChange={(e) => updateDraft({ promisedDate: e.target.value })}/>
            </div>
            <details style={{ marginTop: "10px" }}><summary style={{ cursor: "pointer", color: "#475569", fontWeight: 900 }}>Cadastrar novo responsável</summary><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "8px" }}><input style={inp} value={newTech} onChange={(e) => setNewTech(e.target.value)} placeholder="Nome do responsável"/><button style={btnSm("#0f172a")} onClick={addTechnician}>Adicionar</button></div></details>
            <button style={{ ...btn("#e94560"), width: "100%", marginTop: "14px" }} onClick={saveOpeningAndContinue}>Salvar e continuar para orçamento</button>
            <button style={{ ...btn("#e2e8f0"), color: "#334155", width: "100%", marginTop: "8px" }} onClick={() => saveStep("aberto", "Abertura salva", "Informações iniciais registradas.")}>Salvar e permanecer aqui</button>
          </div>}

          {formSection === "orcamento" && <div>
            <div style={{ ...card, borderRadius: "22px", padding: "18px" }}>
              <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a" }}>2. Montar orçamento</div>
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Adicione serviços e materiais. O documento e os totais são calculados automaticamente.</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "8px", marginBottom: "14px" }}>
                <div><label style={{ fontSize: "11px", color: "#64748b", fontWeight: 900 }}>Nº DO ORÇAMENTO</label><input style={inp} value={draft.quoteNumber || ""} readOnly /></div>
                <div><label style={{ fontSize: "11px", color: "#64748b", fontWeight: 900 }}>DATA</label><input style={inp} type="date" value={draft.quoteDate} onChange={(event) => updateDraft({ quoteDate: event.target.value })} /></div>
                <div><label style={{ fontSize: "11px", color: "#64748b", fontWeight: 900 }}>VALIDADE (DIAS)</label><input style={inp} type="number" min="1" value={draft.validityDays} onChange={(event) => { const validityDays = event.target.value; updateDraft({ validityDays, validUntil: addDaysISO(validityDays) }); }} /></div>
                <div><label style={{ fontSize: "11px", color: "#64748b", fontWeight: 900 }}>VÁLIDO ATÉ</label><input style={inp} type="date" value={draft.validUntil} onChange={(event) => updateDraft({ validUntil: event.target.value })} /></div>
              </div>
              <div style={{ fontWeight: 900, fontSize: "17px" }}>Mão de obra</div>
              {serviceCatalog.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginTop: "8px", background: "#f8fafc", padding: "10px", borderRadius: "14px" }}><select style={inp} value={draft.catalogItemId} onChange={(event) => updateDraft({ catalogItemId: event.target.value })}><option value="">Selecionar do catálogo</option>{serviceCatalog.map((item) => <option key={item.id} value={item.id}>{item.name} — {fmtCur(item.price)} / {item.unit}</option>)}</select><button style={btnSm("#2563eb")} onClick={addFromCatalog}>Adicionar</button></div>}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 110px 90px 130px 120px auto", gap: "8px", marginTop: "8px" }}><input style={inp} value={draft.laborName} onChange={(e) => updateDraft({ laborName: e.target.value })} placeholder="Descrição do serviço"/><select style={inp} value={draft.laborUnit} onChange={(e) => updateDraft({ laborUnit: e.target.value })}>{["serviço","hora","diária","un","m²","m","km"].map((unit)=><option key={unit}>{unit}</option>)}</select><input style={inp} type="number" min="0.01" step="0.01" value={draft.laborQty} onChange={(e) => updateDraft({ laborQty: e.target.value })} placeholder="Qtd."/><input style={inp} value={draft.laborValue} onChange={(e) => updateDraft({ laborValue: e.target.value })} placeholder="Valor unit."/><input style={inp} value={draft.laborDiscount} onChange={(e) => updateDraft({ laborDiscount: e.target.value })} placeholder="Desconto"/><button style={btnSm("#16a34a")} onClick={addLabor}>Adicionar</button></div>
              {draft.laborItems.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "9px 0", borderBottom: "1px solid #e2e8f0" }}><span><b>{i.name}</b><small style={{ display: "block", color: "#64748b" }}>{Number(i.qty)||1} {i.unit||"serviço"} × {fmtCur(i.unitPrice ?? i.value)}{Number(i.discount)>0 ? ` • Desc. ${fmtCur(i.discount)}` : ""}</small></span><span style={{ whiteSpace: "nowrap" }}><b>{fmtCur(itemTotal(i, true))}</b> <button style={btnSm("#ef4444")} onClick={() => updateDraft({ laborItems: draft.laborItems.filter((x) => x.id !== i.id) })}>×</button></span></div>)}
              <div style={{ fontWeight: 900, fontSize: "17px", marginTop: "18px" }}>Peças e materiais</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 100px auto", gap: "8px", marginTop: "8px" }}><select style={inp} value={draft.productId} onChange={(e) => updateDraft({ productId: e.target.value })}><option value="">Selecionar do estoque</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.stock || 0} un.</option>)}</select><input style={inp} type="number" min="1" value={draft.productQty} onChange={(e) => updateDraft({ productQty: e.target.value })}/><button style={btnSm("#16a34a")} onClick={addMaterial}>Reservar</button></div>
              {draft.materialItems.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #e2e8f0" }}><span>{i.qty}x {i.name} <small style={{ color: "#f97316" }}>reservado</small></span><span><b>{fmtCur(itemTotal(i))}</b> <button style={btnSm("#ef4444")} onClick={() => updateDraft({ materialItems: draft.materialItems.filter((x) => String(x.id) !== String(i.id)) })}>×</button></span></div>)}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: "8px", marginTop: "12px" }}><input style={inp} value={draft.travelCost} onChange={(e) => updateDraft({ travelCost: e.target.value })} placeholder="Deslocamento"/><input style={inp} value={draft.otherCosts} onChange={(e) => updateDraft({ otherCosts: e.target.value })} placeholder="Outros custos"/><input style={inp} value={draft.discount} onChange={(e) => updateDraft({ discount: e.target.value })} placeholder="Desconto geral"/><input style={inp} value={draft.depositValue} onChange={(e) => updateDraft({ depositValue: e.target.value })} placeholder="Entrada prevista"/></div>
              <div style={{ background: "#0f172a", color: "#fff", borderRadius: "18px", padding: "16px", marginTop: "12px" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>Serviços</span><b>{fmtCur(laborTotal)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Materiais</span><b>{fmtCur(materialsTotal)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Deslocamento e outros</span><b>{fmtCur(travelCost + otherCosts)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Desconto geral</span><b>- {fmtCur(discountValue)}</b></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "22px", fontWeight: 900, borderTop: "1px solid #334155", marginTop: "8px", paddingTop: "8px" }}><span>Total</span><span>{fmtCur(total)}</span></div>{depositValue>0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#86efac", marginTop: "6px" }}><span>Entrada prevista</span><b>{fmtCur(Math.min(total, depositValue))}</b></div>}</div>
              <div style={{ fontWeight: 900, fontSize: "17px", marginTop: "18px" }}>Condições comerciais</div>
              <textarea style={{ ...inp, minHeight: "68px", marginTop: "8px" }} value={draft.paymentTerms} onChange={(event) => updateDraft({ paymentTerms: event.target.value })} placeholder="Forma e condições de pagamento" />
              <input style={{ ...inp, marginTop: "8px" }} value={draft.executionTerms} onChange={(event) => updateDraft({ executionTerms: event.target.value })} placeholder="Prazo e condições de execução" />
              <textarea style={{ ...inp, minHeight: "74px", marginTop: "8px" }} value={draft.quoteNotes} onChange={(event) => updateDraft({ quoteNotes: event.target.value })} placeholder="Observações do orçamento" />
            </div>
            <div style={{ ...card, borderRadius: "22px", padding: "18px" }}>
              <div style={{ fontWeight: 900, fontSize: "17px" }}>Ações do orçamento</div>
              <button style={{ ...btn("#2563eb"), width: "100%", marginTop: "10px" }} onClick={saveBudgetOnly}>Salvar orçamento</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}><button style={btnSm("#0f172a")} onClick={saveAndPrint}>PDF / Imprimir</button><button style={btnSm("#16a34a")} onClick={saveAndWhatsApp}>WhatsApp</button></div>
              {draft.status !== "aguardando_aprovacao" && draft.approvalStatus !== "aprovado" && <button style={{ ...btn("#7c3aed"), width: "100%", marginTop: "8px" }} onClick={sendBudget}>Marcar como enviado ao cliente</button>}
              {draft.status === "aguardando_aprovacao" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}><button style={btnSm("#16a34a")} onClick={approveBudget}>Cliente aprovou</button><button style={btnSm("#991b1b")} onClick={rejectBudget}>Cliente recusou</button></div>}
              {(draft.approvalStatus === "aprovado" || draft.status === "aprovado" || draft.status === "aberto" || draft.status === "orcamento") && <button style={{ ...btn("#f97316"), width: "100%", marginTop: "8px" }} onClick={startExecution}>Iniciar execução</button>}
            </div>
          </div>}

          {formSection === "execucao" && <div style={{ ...card, borderRadius: "22px", padding: "18px" }}>
            <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a" }}>3. Execução do serviço</div>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Registre o trabalho realizado, fotos e observações técnicas.</div>
            <textarea style={{ ...inp, minHeight: "90px" }} value={draft.diagnosis} onChange={(e) => updateDraft({ diagnosis: e.target.value })} placeholder="Diagnóstico e trabalho realizado" />
            <input style={{ ...inp, marginTop: "8px" }} type="number" min="0" value={draft.timeMinutes} onChange={(e) => updateDraft({ timeMinutes: e.target.value })} placeholder="Tempo gasto em minutos"/>
            <textarea style={{ ...inp, minHeight: "75px", marginTop: "8px" }} value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} placeholder="Observações internas"/>
            <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handlePhotos(e.target.files)}/>
            <button style={{ ...btn("#2563eb"), width: "100%", marginTop: "12px" }} onClick={() => photoInputRef.current?.click()}>Adicionar fotos ({draft.photos.length}/{MAX_PHOTOS})</button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px", marginTop: "8px" }}>{draft.photos.map((src,idx) => <div key={idx} style={{ position: "relative" }}><img src={src} alt="Serviço" style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: "10px" }}/><button onClick={() => updateDraft({ photos: draft.photos.filter((_,i) => i !== idx) })} style={{ position: "absolute", top: 3, right: 3, border: "none", background: "#991b1b", color: "#fff", borderRadius: "50%", width: 25, height: 25 }}>×</button></div>)}</div>
            <input ref={attachmentInputRef} type="file" multiple hidden onChange={(e) => handleAttachments(e.target.files)}/>
            <button style={{ ...btn("#64748b"), width: "100%", marginTop: "10px" }} onClick={() => attachmentInputRef.current?.click()}>Adicionar anexos</button>
            {draft.attachments.map((a) => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: "#f8fafc", marginTop: "5px", borderRadius: "8px" }}><span>{a.name}</span><button onClick={() => updateDraft({ attachments: draft.attachments.filter((x) => x.id !== a.id) })}>Excluir</button></div>)}
            <button style={{ ...btn("#2563eb"), width: "100%", marginTop: "12px" }} onClick={() => saveStep("andamento", "Execução atualizada", "Dados da execução e evidências salvos.")}>Salvar andamento</button>
            <button style={{ ...btn("#7c3aed"), width: "100%", marginTop: "8px" }} onClick={markReady}>Marcar como pronto</button>
          </div>}

          {formSection === "entrega" && <div style={{ ...card, borderRadius: "22px", padding: "18px" }}>
            <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a" }}>4. Entrega e pagamento</div>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, marginBottom: "12px" }}>Confirme pagamento, garantia e assinatura antes de concluir.</div>
            <select style={inp} value={draft.paymentMethod} onChange={(e) => updateDraft({ paymentMethod: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
            {draft.paymentMethod === "crediario" && <input style={{ ...inp, marginTop: "8px" }} type="date" value={draft.dueDate} onChange={(e) => updateDraft({ dueDate: e.target.value })}/>} 
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px", marginTop: "8px" }}><input style={inp} type="number" value={draft.warrantyDays} onChange={(e) => updateDraft({ warrantyDays: e.target.value })} placeholder="Garantia em dias"/><input style={inp} value={draft.warrantyNotes} onChange={(e) => updateDraft({ warrantyNotes: e.target.value })} placeholder="Condições da garantia"/></div>
            <div style={{ fontWeight: 900, fontSize: "17px", marginTop: "16px" }}>Assinatura do cliente</div>
            <SignaturePad value={draft.signature} onChange={(signature) => updateDraft({ signature })}/>
            <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{ width: "100%", marginTop: "12px", border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: "12px", padding: "10px", fontWeight: 900, color: "#475569" }}>{showAdvanced ? "Ocultar opções administrativas" : "Mostrar opções administrativas"}</button>
            {showAdvanced && <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "12px", marginTop: "8px" }}><input style={inp} value={draft.commissionPercent} onChange={(e) => updateDraft({ commissionPercent: e.target.value })} placeholder="Comissão sobre lucro (%)"/><div style={{ display: "flex", justifyContent: "space-between", color: "#166534", marginTop: "8px" }}><span>Lucro estimado</span><b>{fmtCur(profit)}</b></div><div style={{ display: "flex", justifyContent: "space-between", color: "#6d28d9" }}><span>Comissão</span><b>{fmtCur(commission)}</b></div></div>}
            <div style={{ background: "#0f172a", color: "#fff", borderRadius: "18px", padding: "16px", marginTop: "12px" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>Mão de obra</span><b>{fmtCur(laborTotal)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Materiais</span><b>{fmtCur(materialsTotal)}</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Desconto</span><b>{fmtCur(discountValue)}</b></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "22px", fontWeight: 900, borderTop: "1px solid #334155", marginTop: "8px", paddingTop: "8px" }}><span>Total</span><span>{fmtCur(total)}</span></div></div>
            <button style={{ ...btn("#16a34a"), width: "100%", marginTop: "12px" }} onClick={finishPayment}>Receber e concluir serviço</button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}><button style={btnSm("#0f172a")} onClick={saveAndPrint}>PDF / Imprimir</button><button style={btnSm("#16a34a")} onClick={saveAndWhatsApp}>WhatsApp</button></div>
            <button style={{ ...btn("#991b1b"), width: "100%", marginTop: "8px" }} onClick={cancelService}>Cancelar serviço</button>
          </div>}

          {finalReadOnly && <div style={{ ...card, background: "#fff7ed", color: "#9a3412", fontWeight: 900 }}>Serviço finalizado: somente consulta.</div>}
        </div>
      )}
    </div>
  );
}
