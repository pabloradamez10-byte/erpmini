import { useState } from "react";

const WHATSAPP_NUMBER = "5551989004629";
const WHATSAPP_TRIAL = encodeURIComponent("Olá! Quero testar o ERPmini gratuitamente por 7 dias no meu negócio. Como funciona?");
const WHATSAPP_QUESTION = encodeURIComponent("Olá, vi o ERPmini e gostaria de entender como funciona.");
const CHECKOUT_URL = "https://pay.hotmart.com/S106864758O";
const VIDEO_URL = "https://www.youtube.com/embed/ADLykrKzN9k?rel=0";

const features = [
  ["Vendas e PDV", "Registre vendas, formas de pagamento e acompanhe o movimento do negócio."],
  ["Estoque organizado", "Cadastre produtos, acompanhe quantidades e reduza perdas por falta de controle."],
  ["Financeiro", "Visualize entradas, saídas, contas a pagar, contas a receber e fluxo de caixa."],
  ["Clientes e fornecedores", "Mantenha contatos e históricos importantes centralizados em um só lugar."],
  ["Relatórios", "Acompanhe resultados e tome decisões usando dados reais do seu negócio."],
  ["Acesso online", "Use pelo celular, notebook ou computador, sem instalar programas pesados."],
];

const faq = [
  ["Como funciona o teste grátis?", "Você fala conosco pelo WhatsApp, recebe o acesso por 7 dias e pode testar o ERPmini no seu próprio negócio antes de decidir."],
  ["Preciso instalar algum programa?", "Não. O ERPmini funciona online pelo navegador."],
  ["Funciona no celular?", "Sim. O sistema foi desenvolvido para funcionar no celular, notebook e computador."],
  ["O pagamento será seguro?", "Sim. A assinatura é processada com segurança pela Hotmart."],
  ["Posso cancelar?", "Sim. A assinatura pode ser cancelada seguindo as condições da Hotmart."],
  ["O suporte está incluso?", "Sim. Você poderá tirar dúvidas diretamente pelo WhatsApp."],
  ["Para quais negócios ele serve?", "O ERPmini atende pequenos comércios e prestadores de serviços que precisam organizar vendas, estoque e financeiro."],
];

function goWhatsApp(message) {
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
}

function goCheckout() {
  window.open(CHECKOUT_URL, "_blank", "noopener,noreferrer");
}

export default function SalesLandingPage() {
  const [openFaq, setOpenFaq] = useState(0);

  const styles = {
    page: { minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
    container: { width: "min(1120px, calc(100% - 32px))", margin: "0 auto" },
    section: { padding: "80px 0" },
    button: { border: 0, borderRadius: 12, padding: "15px 22px", fontWeight: 900, fontSize: 16, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 12px 32px rgba(15,23,42,.06)" },
  };

  return (
    <div style={styles.page}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ ...styles.container, minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <a href="/" style={{ color: "#0f172a", textDecoration: "none", fontSize: 22, fontWeight: 950, letterSpacing: "-0.04em" }}>ERP<span style={{ color: "#e94560" }}>mini</span></a>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/app" style={{ ...styles.button, padding: "11px 15px", color: "#334155", background: "#f1f5f9", fontSize: 14 }}>Entrar</a>
            <button onClick={() => goWhatsApp(WHATSAPP_TRIAL)} style={{ ...styles.button, padding: "11px 15px", color: "#fff", background: "#e94560", fontSize: 14 }}>Testar grátis</button>
          </div>
        </div>
      </header>

      <main>
        <section style={{ padding: "88px 0 76px", background: "radial-gradient(circle at 85% 10%, #ffe4e9 0, transparent 35%), linear-gradient(180deg,#fff 0%,#f8fafc 100%)" }}>
          <div style={{ ...styles.container, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", padding: "7px 12px", borderRadius: 999, background: "#fff1f2", color: "#be123c", fontSize: 13, fontWeight: 900, marginBottom: 20 }}>PARA QUEM AINDA CONTROLA TUDO NO CADERNO OU NA PLANILHA</div>
              <h1 style={{ margin: 0, fontSize: "clamp(38px,6vw,66px)", lineHeight: .98, letterSpacing: "-0.055em", maxWidth: 700 }}>Saiba o que vendeu, o que tem no estoque e quanto entrou no caixa.</h1>
              <p style={{ color: "#475569", fontSize: "clamp(17px,2vw,21px)", lineHeight: 1.6, maxWidth: 650, margin: "26px 0 18px" }}>O ERPmini reúne vendas, estoque, clientes e financeiro em um sistema simples para pequenos negócios — direto no celular ou computador.</p>
              <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 14, padding: "13px 15px", fontWeight: 850, marginBottom: 20, maxWidth: 650 }}>Teste gratuitamente por 7 dias e receba ajuda para começar. Sem compromisso.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button onClick={() => goWhatsApp(WHATSAPP_TRIAL)} style={{ ...styles.button, background: "#e94560", color: "#fff", boxShadow: "0 12px 28px rgba(233,69,96,.28)" }}>Quero testar grátis por 7 dias</button>
                <button onClick={() => document.getElementById("demonstracao")?.scrollIntoView({ behavior: "smooth" })} style={{ ...styles.button, background: "#fff", color: "#334155", border: "1px solid #cbd5e1" }}>Ver como funciona</button>
              </div>
              <p style={{ marginTop: 18, color: "#64748b", fontSize: 13, fontWeight: 700 }}>Acesso online • Ajuda inicial pelo WhatsApp • Depois, R$ 39,90 por mês</p>
            </div>
            <div style={{ ...styles.card, padding: 18, background: "#0f172a", color: "#fff", transform: "rotate(1deg)" }}>
              <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", border: "1px solid #334155", borderRadius: 16, padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}><div><div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800 }}>VISÃO GERAL</div><div style={{ fontSize: 22, fontWeight: 950 }}>Meu Negócio</div></div><div style={{ width: 42, height: 42, borderRadius: 12, background: "#e94560", display: "grid", placeItems: "center", fontWeight: 950 }}>E</div></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{[["Vendas do mês","R$ 8.420"],["Produtos","148"],["A receber","R$ 1.280"],["Saldo","R$ 3.760"]].map(([label,value]) => <div key={label} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 21, fontWeight: 950, marginTop: 6 }}>{value}</div></div>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="demonstracao" style={{ ...styles.section, background: "#fff" }}>
          <div style={{ ...styles.container, maxWidth: 900 }}>
            <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 34px" }}>
              <div style={{ color: "#e94560", fontWeight: 950, fontSize: 13 }}>VEJA ANTES DE DECIDIR</div>
              <h2 style={{ fontSize: "clamp(30px,4vw,46px)", letterSpacing: "-0.045em", margin: "10px 0 14px" }}>Simples para usar no dia a dia</h2>
              <p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.7 }}>Assista à demonstração e veja como cadastrar produtos, registrar vendas e acompanhar estoque e financeiro.</p>
            </div>
            <div style={{ ...styles.card, padding: 12, background: "#0f172a" }}>
              <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", overflow: "hidden", borderRadius: 14 }}>
                <iframe src={VIDEO_URL} title="Demonstração do ERPmini" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}><button onClick={() => goWhatsApp(WHATSAPP_TRIAL)} style={{ ...styles.button, background: "#16a34a", color: "#fff" }}>Quero testar no meu negócio</button></div>
          </div>
        </section>

        <section style={{ ...styles.section, background: "#f8fafc" }}>
          <div style={styles.container}>
            <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 46px" }}><div style={{ color: "#e94560", fontWeight: 950, fontSize: 13 }}>MENOS CONFUSÃO, MAIS CONTROLE</div><h2 style={{ fontSize: "clamp(30px,4vw,46px)", letterSpacing: "-0.045em", margin: "10px 0 14px" }}>Tudo o que importa em um só lugar</h2><p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.7 }}>Pare de espalhar informações entre cadernos, WhatsApp e várias planilhas.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>{features.map(([title,text], index) => <div key={title} style={{ ...styles.card, padding: 24 }}><div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, background: index % 2 ? "#eff6ff" : "#fff1f2", color: index % 2 ? "#1d4ed8" : "#be123c", fontWeight: 950 }}>{String(index + 1).padStart(2,"0")}</div><h3 style={{ fontSize: 19, margin: "18px 0 8px" }}>{title}</h3><p style={{ color: "#64748b", lineHeight: 1.65, margin: 0 }}>{text}</p></div>)}</div>
          </div>
        </section>

        <section id="plano" style={{ ...styles.section, background: "#fff" }}>
          <div style={{ ...styles.container, maxWidth: 720 }}>
            <div style={{ textAlign: "center", marginBottom: 34 }}><div style={{ color: "#e94560", fontWeight: 950, fontSize: 13 }}>GOSTOU DO TESTE?</div><h2 style={{ fontSize: "clamp(32px,4vw,48px)", letterSpacing: "-0.045em", margin: "10px 0" }}>Continue com tudo liberado</h2></div>
            <div style={{ ...styles.card, padding: "clamp(26px,6vw,48px)", border: "2px solid #e94560", position: "relative" }}>
              <div style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", background: "#e94560", color: "#fff", borderRadius: 999, padding: "7px 16px", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" }}>ERPmini COMPLETO</div>
              <div style={{ textAlign: "center" }}><div style={{ color: "#64748b", fontWeight: 800 }}>Um único plano, sem módulos escondidos</div><div style={{ margin: "15px 0 4px", display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 22, fontWeight: 900 }}>R$</span><strong style={{ fontSize: "clamp(52px,9vw,76px)", letterSpacing: "-0.06em" }}>39,90</strong></div><div style={{ color: "#64748b", marginBottom: 28 }}>por mês</div></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 30 }}>{["Vendas e PDV", "Controle de estoque", "Clientes e fornecedores", "Financeiro e fluxo de caixa", "Relatórios", "Acesso online", "Uso no celular e computador", "Suporte pelo WhatsApp"].map(item => <div key={item} style={{ color: "#334155", fontWeight: 750 }}>✓ {item}</div>)}</div>
              <button onClick={goCheckout} style={{ ...styles.button, width: "100%", background: "#e94560", color: "#fff", fontSize: 18, boxShadow: "0 12px 28px rgba(233,69,96,.25)" }}>Assinar o ERPmini por R$ 39,90/mês</button>
              <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: "16px 0 0" }}>Pagamento seguro pela Hotmart. Assinatura mensal, com cancelamento conforme as condições da plataforma.</p>
            </div>
          </div>
        </section>

        <section style={{ ...styles.section, background: "#f8fafc" }}>
          <div style={{ ...styles.container, maxWidth: 820 }}><div style={{ textAlign: "center", marginBottom: 32 }}><h2 style={{ fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.04em", margin: 0 }}>Perguntas frequentes</h2></div><div style={{ display: "grid", gap: 10 }}>{faq.map(([question,answer], index) => <button key={question} onClick={() => setOpenFaq(openFaq === index ? -1 : index)} style={{ textAlign: "left", width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, cursor: "pointer", color: "#0f172a" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontWeight: 900, fontSize: 16 }}><span>{question}</span><span>{openFaq === index ? "−" : "+"}</span></div>{openFaq === index && <div style={{ color: "#64748b", lineHeight: 1.65, marginTop: 11 }}>{answer}</div>}</button>)}</div></div>
        </section>

        <section style={{ padding: "70px 0", background: "linear-gradient(135deg,#e94560,#be123c)", color: "#fff", textAlign: "center" }}><div style={{ ...styles.container, maxWidth: 800 }}><h2 style={{ fontSize: "clamp(32px,5vw,52px)", lineHeight: 1.05, letterSpacing: "-0.05em", margin: "0 0 16px" }}>Teste antes de decidir.</h2><p style={{ color: "#ffe4e6", fontSize: 18, lineHeight: 1.6, margin: "0 0 26px" }}>Use o ERPmini por 7 dias no seu negócio e veja se ele simplifica sua rotina.</p><button onClick={() => goWhatsApp(WHATSAPP_TRIAL)} style={{ ...styles.button, background: "#fff", color: "#be123c" }}>Começar meu teste grátis</button></div></section>
      </main>

      <footer style={{ background: "#020617", color: "#94a3b8", padding: "34px 0" }}><div style={{ ...styles.container, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}><div><strong style={{ color: "#fff" }}>ERPmini</strong><div style={{ fontSize: 13, marginTop: 5 }}>Organização simples para pequenos negócios.</div></div><button onClick={() => goWhatsApp(WHATSAPP_QUESTION)} style={{ background: "transparent", border: 0, color: "#cbd5e1", fontWeight: 800, cursor: "pointer" }}>WhatsApp: (51) 98900-4629</button></div></footer>
    </div>
  );
}
