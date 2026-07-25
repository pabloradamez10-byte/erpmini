import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient.js";

const WHATSAPP_NUMBER = "5551989004629";
const WHATSAPP_TRIAL = encodeURIComponent("Olá! Quero testar o ERPmini gratuitamente por 7 dias no meu negócio. Meu tipo de negócio é: ");
const WHATSAPP_QUESTION = encodeURIComponent("Olá! Vi o ERPmini e gostaria de tirar uma dúvida antes de testar.");
const CHECKOUT_URL = "https://pay.hotmart.com/S106864758O";
const VIDEO_URL = "https://www.youtube.com/embed/ADLykrKzN9k?rel=0";

const features = [
  ["Vendas e caixa", "Registre cada venda e acompanhe quanto entrou, sem fazer contas em vários lugares."],
  ["Estoque organizado", "Veja o que ainda tem, o que está acabando e o que precisa ser reposto."],
  ["Clientes e fiado", "Centralize clientes, valores pendentes e informações importantes."],
  ["Financeiro simples", "Acompanhe entradas, saídas, contas a pagar e contas a receber."],
  ["Relatórios claros", "Entenda o movimento do negócio sem depender de planilhas complicadas."],
  ["Celular e computador", "Acesse online no dia a dia, sem instalar programas pesados."],
];

const faq = [
  ["Como funciona o teste grátis?", "Você chama no WhatsApp, recebe o acesso por 7 dias e testa o ERPmini no seu próprio negócio antes de decidir."],
  ["Preciso cadastrar cartão para testar?", "Não. O teste inicial é liberado por nós, sem cartão e sem cobrança automática."],
  ["Vou receber ajuda para começar?", "Sim. Nesta fase de lançamento, ajudamos na configuração inicial e tiramos dúvidas pelo WhatsApp."],
  ["Funciona no celular?", "Sim. O ERPmini funciona pelo navegador no celular, notebook ou computador."],
  ["Quanto custa depois do teste?", "O plano completo custa R$ 39,90 por mês, com pagamento seguro pela Hotmart."],
  ["Para quais negócios ele serve?", "Para pequenos comércios e prestadores de serviços que precisam organizar vendas, estoque, clientes e financeiro."],
];

function getSessionId() {
  const key = "erpmini_marketing_session";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function trackEvent(eventName, metadata = {}) {
  try {
    const params = new URLSearchParams(window.location.search);
    await supabase.from("erpmini_marketing_events").insert({
      event_name: eventName,
      source: params.get("utm_source") || document.referrer || "direto",
      campaign: params.get("utm_campaign") || "sem_campanha",
      page_path: window.location.pathname,
      session_id: getSessionId(),
      metadata: {
        ...metadata,
        utm_medium: params.get("utm_medium"),
        utm_content: params.get("utm_content"),
      },
    });
  } catch (error) {
    console.warn("ERPmini: não foi possível registrar evento de marketing.", error);
  }
}

function openWhatsApp(message, origin) {
  trackEvent("whatsapp_click", { origin });
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
}

function openCheckout(origin) {
  trackEvent("checkout_click", { origin });
  window.open(CHECKOUT_URL, "_blank", "noopener,noreferrer");
}

export default function SalesLandingPage() {
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    trackEvent("page_view");

    const target = document.getElementById("demonstracao");
    if (!target || !("IntersectionObserver" in window)) return undefined;

    let tracked = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !tracked) {
        tracked = true;
        trackEvent("video_view", { origin: "demonstracao_visivel" });
        observer.disconnect();
      }
    }, { threshold: 0.4 });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const startTrial = (origin) => {
    trackEvent("trial_click", { origin });
    openWhatsApp(WHATSAPP_TRIAL, origin);
  };

  const styles = {
    page: { minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
    container: { width: "min(1120px, calc(100% - 32px))", margin: "0 auto" },
    section: { padding: "76px 0" },
    button: { border: 0, borderRadius: 13, padding: "15px 22px", fontWeight: 900, fontSize: 16, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, boxShadow: "0 12px 32px rgba(15,23,42,.06)" },
  };

  return (
    <div style={styles.page}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ ...styles.container, minHeight: 70, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <a href="/" style={{ color: "#0f172a", textDecoration: "none", fontSize: 23, fontWeight: 950, letterSpacing: "-0.04em" }}>ERP<span style={{ color: "#e94560" }}>mini</span></a>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <a href="/app" style={{ ...styles.button, padding: "10px 14px", color: "#334155", background: "#f1f5f9", fontSize: 14 }}>Entrar</a>
            <button onClick={() => startTrial("header")} style={{ ...styles.button, padding: "10px 14px", color: "#fff", background: "#e94560", fontSize: 14 }}>Testar grátis</button>
          </div>
        </div>
      </header>

      <main>
        <section style={{ padding: "72px 0 68px", background: "radial-gradient(circle at 85% 10%, #ffe4e9 0, transparent 38%), linear-gradient(180deg,#fff 0%,#f8fafc 100%)" }}>
          <div style={{ ...styles.container, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 44, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", padding: "7px 12px", borderRadius: 999, background: "#fff1f2", color: "#be123c", fontSize: 12, fontWeight: 950, marginBottom: 18 }}>SAIA DO CADERNO E DA PLANILHA</div>
              <h1 style={{ margin: 0, fontSize: "clamp(40px,6vw,68px)", lineHeight: .98, letterSpacing: "-0.058em", maxWidth: 760 }}>Pare de perder vendas, estoque e dinheiro no meio da bagunça.</h1>
              <p style={{ color: "#475569", fontSize: "clamp(17px,2vw,21px)", lineHeight: 1.6, maxWidth: 680, margin: "24px 0 16px" }}>Controle vendas, caixa, produtos, clientes e financeiro em um único sistema simples, feito para pequenos negócios.</p>

              <div style={{ display: "grid", gap: 8, margin: "0 0 22px", color: "#334155", fontWeight: 800 }}>
                <div>✓ Veja quanto vendeu e quanto entrou no caixa</div>
                <div>✓ Saiba o que ainda tem no estoque</div>
                <div>✓ Use pelo celular ou computador</div>
              </div>

              <div style={{ background: "#ecfdf5", border: "1px solid #86efac", color: "#166534", borderRadius: 15, padding: "14px 16px", fontWeight: 900, marginBottom: 20, maxWidth: 680 }}>Teste por 7 dias, sem cartão. Nesta fase de lançamento, ajudamos você a começar.</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button onClick={() => startTrial("hero")} style={{ ...styles.button, background: "#e94560", color: "#fff", boxShadow: "0 12px 28px rgba(233,69,96,.28)" }}>Quero testar grátis no meu negócio</button>
                <button onClick={() => document.getElementById("demonstracao")?.scrollIntoView({ behavior: "smooth" })} style={{ ...styles.button, background: "#fff", color: "#334155", border: "1px solid #cbd5e1" }}>Ver demonstração</button>
              </div>
              <p style={{ marginTop: 15, color: "#64748b", fontSize: 13, fontWeight: 750 }}>Sem cartão • Sem instalação • Suporte direto pelo WhatsApp</p>
            </div>

            <div style={{ ...styles.card, padding: 18, background: "#0f172a", color: "#fff", transform: "rotate(1deg)" }}>
              <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", border: "1px solid #334155", borderRadius: 16, padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}><div><div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800 }}>VISÃO GERAL</div><div style={{ fontSize: 22, fontWeight: 950 }}>Meu Negócio</div></div><div style={{ width: 42, height: 42, borderRadius: 12, background: "#e94560", display: "grid", placeItems: "center", fontWeight: 950 }}>E</div></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{[["Vendas do mês","R$ 8.420"],["Produtos","148"],["A receber","R$ 1.280"],["Saldo","R$ 3.760"]].map(([label,value]) => <div key={label} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 21, fontWeight: 950, marginTop: 6 }}>{value}</div></div>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "28px 0", background: "#0f172a", color: "#fff" }}>
          <div style={{ ...styles.container, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
            {[["1", "Peça seu teste", "Chame no WhatsApp e conte qual é o seu negócio."], ["2", "Receba seu acesso", "Liberamos 7 dias para você testar na rotina real."], ["3", "Decida depois", "Só assine se o ERPmini realmente ajudar."]].map(([n,title,text]) => <div key={n} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}><div style={{ width: 38, height: 38, borderRadius: 12, background: "#e94560", display: "grid", placeItems: "center", fontWeight: 950, flex: "0 0 auto" }}>{n}</div><div><strong>{title}</strong><div style={{ color: "#cbd5e1", lineHeight: 1.5, marginTop: 4, fontSize: 14 }}>{text}</div></div></div>)}
          </div>
        </section>

        <section id="demonstracao" style={{ ...styles.section, background: "#fff" }}>
          <div style={{ ...styles.container, maxWidth: 900 }}>
            <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 30px" }}>
              <div style={{ color: "#e94560", fontWeight: 950, fontSize: 13 }}>VEJA ANTES DE DECIDIR</div>
              <h2 style={{ fontSize: "clamp(30px,4vw,46px)", letterSpacing: "-0.045em", margin: "10px 0 12px" }}>Você não precisa imaginar como funciona</h2>
              <p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.7 }}>Veja o sistema em uso e depois teste com os dados do seu próprio negócio.</p>
            </div>
            <div style={{ ...styles.card, padding: 12, background: "#0f172a" }}>
              <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", overflow: "hidden", borderRadius: 14 }}>
                <iframe src={VIDEO_URL} title="Demonstração do ERPmini" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 22 }}><button onClick={() => startTrial("after_video")} style={{ ...styles.button, background: "#16a34a", color: "#fff" }}>Quero testar com meu negócio</button></div>
          </div>
        </section>

        <section style={{ ...styles.section, background: "#f8fafc" }}>
          <div style={styles.container}>
            <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 42px" }}><div style={{ color: "#e94560", fontWeight: 950, fontSize: 13 }}>O ESSENCIAL, SEM COMPLICAÇÃO</div><h2 style={{ fontSize: "clamp(30px,4vw,46px)", letterSpacing: "-0.045em", margin: "10px 0 14px" }}>Tudo o que importa em um só lugar</h2><p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.7 }}>Mais controle que um caderno. Menos complicação que um ERP tradicional.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>{features.map(([title,text], index) => <div key={title} style={{ ...styles.card, padding: 24 }}><div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, background: index % 2 ? "#eff6ff" : "#fff1f2", color: index % 2 ? "#1d4ed8" : "#be123c", fontWeight: 950 }}>{String(index + 1).padStart(2,"0")}</div><h3 style={{ fontSize: 19, margin: "18px 0 8px" }}>{title}</h3><p style={{ color: "#64748b", lineHeight: 1.65, margin: 0 }}>{text}</p></div>)}</div>
          </div>
        </section>

        <section id="plano" style={{ ...styles.section, background: "#fff" }}>
          <div style={{ ...styles.container, maxWidth: 720 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}><div style={{ color: "#e94560", fontWeight: 950, fontSize: 13 }}>SEM SURPRESA DEPOIS DO TESTE</div><h2 style={{ fontSize: "clamp(32px,4vw,48px)", letterSpacing: "-0.045em", margin: "10px 0" }}>Um plano simples e completo</h2></div>
            <div style={{ ...styles.card, padding: "clamp(26px,6vw,48px)", border: "2px solid #e94560", position: "relative" }}>
              <div style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", background: "#e94560", color: "#fff", borderRadius: 999, padding: "7px 16px", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" }}>ERPmini COMPLETO</div>
              <div style={{ textAlign: "center" }}><div style={{ color: "#64748b", fontWeight: 800 }}>Tudo liberado em um único plano</div><div style={{ margin: "15px 0 4px", display: "flex", justifyContent: "center", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 22, fontWeight: 900 }}>R$</span><strong style={{ fontSize: "clamp(52px,9vw,76px)", letterSpacing: "-0.06em" }}>39,90</strong></div><div style={{ color: "#64748b", marginBottom: 26 }}>por mês, depois do teste</div></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 28 }}>{["Vendas e PDV", "Controle de estoque", "Clientes e fornecedores", "Financeiro e fluxo de caixa", "Relatórios", "Uso no celular e computador", "Acesso online", "Suporte pelo WhatsApp"].map(item => <div key={item} style={{ color: "#334155", fontWeight: 750 }}>✓ {item}</div>)}</div>
              <button onClick={() => startTrial("pricing")} style={{ ...styles.button, width: "100%", background: "#e94560", color: "#fff", fontSize: 18, boxShadow: "0 12px 28px rgba(233,69,96,.25)" }}>Testar grátis antes de assinar</button>
              <button onClick={() => openCheckout("pricing_direct")} style={{ ...styles.button, width: "100%", background: "transparent", color: "#be123c", marginTop: 8, fontSize: 14 }}>Já testei e quero assinar</button>
              <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: "14px 0 0" }}>Teste sem cartão. Para assinar, o pagamento é processado com segurança pela Hotmart.</p>
            </div>
          </div>
        </section>

        <section style={{ ...styles.section, background: "#f8fafc" }}>
          <div style={{ ...styles.container, maxWidth: 820 }}><div style={{ textAlign: "center", marginBottom: 30 }}><h2 style={{ fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.04em", margin: 0 }}>Dúvidas antes de testar?</h2></div><div style={{ display: "grid", gap: 10 }}>{faq.map(([question,answer], index) => <button key={question} onClick={() => setOpenFaq(openFaq === index ? -1 : index)} style={{ textAlign: "left", width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, cursor: "pointer", color: "#0f172a" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontWeight: 900, fontSize: 16 }}><span>{question}</span><span>{openFaq === index ? "−" : "+"}</span></div>{openFaq === index && <div style={{ color: "#64748b", lineHeight: 1.65, marginTop: 11 }}>{answer}</div>}</button>)}</div></div>
        </section>

        <section style={{ padding: "68px 0", background: "linear-gradient(135deg,#e94560,#be123c)", color: "#fff", textAlign: "center" }}><div style={{ ...styles.container, maxWidth: 820 }}><h2 style={{ fontSize: "clamp(32px,5vw,54px)", lineHeight: 1.05, letterSpacing: "-0.05em", margin: "0 0 16px" }}>Veja se o ERPmini serve para você — antes de pagar.</h2><p style={{ color: "#ffe4e6", fontSize: 18, lineHeight: 1.6, margin: "0 0 24px" }}>Sete dias para testar com seu próprio negócio e ajuda para começar.</p><button onClick={() => startTrial("final_cta")} style={{ ...styles.button, background: "#fff", color: "#be123c", fontSize: 18 }}>Quero meu teste grátis</button></div></section>
      </main>

      <footer style={{ background: "#020617", color: "#94a3b8", padding: "34px 0" }}><div style={{ ...styles.container, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}><div><strong style={{ color: "#fff" }}>ERPmini</strong><div style={{ fontSize: 13, marginTop: 5 }}>Organização simples para pequenos negócios.</div></div><button onClick={() => openWhatsApp(WHATSAPP_QUESTION, "footer")} style={{ background: "transparent", border: 0, color: "#cbd5e1", fontWeight: 800, cursor: "pointer" }}>WhatsApp: (51) 98900-4629</button></div></footer>
    </div>
  );
}
