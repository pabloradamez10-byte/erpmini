import { useEffect, useMemo, useState } from "react";

const steps = [
  {
    icon: "👋",
    title: "Bem-vindo ao ERPmini!",
    text: "Este guia rápido vai mostrar o básico para deixar seu negócio pronto: nome da loja, produtos, clientes e primeira venda.",
    tip: "Leva menos de 2 minutos."
  },
  {
    icon: "🏪",
    title: "1. Coloque o nome da sua loja",
    text: "Abra Configurações, procure o campo Nome da loja, digite o nome do seu negócio e salve. Esse nome aparecerá no sistema e nos comprovantes.",
    path: "Configurações → Nome da loja → Salvar",
    tip: "Exemplo: Floricultura da Ana."
  },
  {
    icon: "📦",
    title: "2. Cadastre seus produtos",
    text: "Entre em Estoque e escolha Novo produto. Informe nome, custo, preço de venda, quantidade em estoque e categoria.",
    path: "Estoque → Novo produto",
    tip: "Comece cadastrando os 5 produtos que você mais vende."
  },
  {
    icon: "▥",
    title: "3. Use o código de barras",
    text: "No cadastro do produto, digite o número impresso na embalagem ou leia com um leitor de código de barras. Depois, no PDV, basta ler o código para adicionar o item à venda.",
    path: "Estoque → Produto → Código de barras",
    tip: "Quando o produto não tiver código, use a opção de gerar código disponível no cadastro."
  },
  {
    icon: "👤",
    title: "4. Cadastre seus clientes",
    text: "Abra Clientes e informe pelo menos o nome e o telefone. O limite pode ser usado para organizar vendas no crediário.",
    path: "Clientes → Novo cliente → Salvar",
    tip: "O telefone facilita o contato e a cobrança pelo WhatsApp."
  },
  {
    icon: "🛒",
    title: "5. Faça sua primeira venda",
    text: "Abra o PDV, leia o código de barras ou pesquise o produto, confira a quantidade e toque em Pagar. Escolha a forma de pagamento e finalize.",
    path: "PDV → Adicionar produto → Pagar",
    tip: "Faça primeiro uma venda de teste para conhecer o processo."
  },
  {
    icon: "✅",
    title: "Tudo pronto para começar",
    text: "Depois das primeiras vendas, acompanhe o início para ver vendas do dia, estoque baixo, crediário e outros indicadores do negócio.",
    path: "Início → Resumo do negócio",
    tip: "Mantenha os lançamentos atualizados para ter informações confiáveis."
  }
];

function getCurrentEmail() {
  try {
    const value = JSON.parse(localStorage.getItem("erpmini_owner_email") || '""');
    return String(value || "").trim().toLowerCase();
  } catch {
    return String(localStorage.getItem("erpmini_owner_email") || "").replaceAll('"', "").trim().toLowerCase();
  }
}

export default function FirstAccessTutorial() {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = useMemo(
    () => email ? `erpmini_tutorial_v1_${email}` : "",
    [email]
  );

  useEffect(() => {
    const detectUser = () => {
      const currentEmail = getCurrentEmail();
      if (currentEmail) setEmail(currentEmail);
    };

    detectUser();
    const timer = window.setInterval(detectUser, 700);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    const completed = localStorage.getItem(storageKey) === "completed";
    if (!completed) {
      const timer = window.setTimeout(() => setOpen(true), 700);
      return () => window.clearTimeout(timer);
    }
  }, [storageKey]);

  const finish = () => {
    if (storageKey) localStorage.setItem(storageKey, "completed");
    setOpen(false);
    setStep(0);
  };

  const restart = () => {
    setStep(0);
    setOpen(true);
  };

  if (!email) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={restart}
        aria-label="Abrir tutorial do ERPmini"
        style={{
          position: "fixed",
          right: 16,
          bottom: 82,
          zIndex: 75,
          border: "none",
          borderRadius: 999,
          padding: "11px 15px",
          background: "#0f172a",
          color: "#fff",
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 12px 28px rgba(15,23,42,.25)"
        }}
      >
        ? Ajuda
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tutorial de primeiros passos"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18
          }}
        >
          <div style={{
            width: "100%",
            maxWidth: 480,
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 28px 80px rgba(0,0,0,.38)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#e94560" }}>
                  PRIMEIROS PASSOS
                </div>
                <button
                  type="button"
                  onClick={finish}
                  style={{ border: "none", background: "transparent", color: "#64748b", fontWeight: 800, cursor: "pointer" }}
                >
                  Pular
                </button>
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
                {steps.map((_, index) => (
                  <div key={index} style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 999,
                    background: index <= step ? "#e94560" : "#e2e8f0"
                  }} />
                ))}
              </div>
            </div>

            <div style={{ padding: "24px 22px" }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                display: "grid",
                placeItems: "center",
                background: "#fff1f2",
                fontSize: 32,
                marginBottom: 18
              }}>
                {current.icon}
              </div>

              <h2 style={{ margin: "0 0 10px", color: "#0f172a", fontSize: 25, lineHeight: 1.15 }}>
                {current.title}
              </h2>
              <p style={{ margin: 0, color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
                {current.text}
              </p>

              {current.path && (
                <div style={{
                  marginTop: 18,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#0f172a",
                  fontWeight: 900,
                  fontSize: 14
                }}>
                  {current.path}
                </div>
              )}

              <div style={{
                marginTop: 12,
                padding: "11px 13px",
                borderRadius: 13,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
                fontSize: 13,
                fontWeight: 800,
                lineHeight: 1.45
              }}>
                Dica: {current.tip}
              </div>
            </div>

            <div style={{
              padding: "14px 20px 20px",
              display: "grid",
              gridTemplateColumns: step === 0 ? "1fr" : "1fr 1.5fr",
              gap: 10
            }}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 13,
                    padding: 13,
                    background: "#fff",
                    color: "#334155",
                    fontWeight: 900,
                    cursor: "pointer"
                  }}
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={() => isLast ? finish() : setStep((value) => value + 1)}
                style={{
                  border: "none",
                  borderRadius: 13,
                  padding: 13,
                  background: "#e94560",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(233,69,96,.24)"
                }}
              >
                {isLast ? "Começar a usar" : "Próximo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
