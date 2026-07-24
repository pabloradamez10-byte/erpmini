import { supabase } from "./services/supabaseClient.js";

const VAPID_PUBLIC_KEY = "BKC6DybG4AQcK7wcJ851SMKO6QQPxgUgWO66Txn87MutoPwqcnH0tm3DAx0LvK3aKaluNrOafhzFYd_eQJN2ybM";
const BUTTON_ID = "erpmini-enable-push";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function saveSubscription(subscription) {
  const json = subscription.toJSON();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error("Faça login novamente para ativar as notificações.");

  const { error } = await supabase.from("erpmini_push_subscriptions").upsert({
    user_id: userId,
    endpoint: json.endpoint,
    subscription: json,
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });

  if (error) throw error;
}

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Este navegador não suporta notificações push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificações não concedida.");

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  await saveSubscription(subscription);
  localStorage.setItem("erpmini_push_enabled", "1");
  return true;
}

function isMasterPanelVisible() {
  return [...document.querySelectorAll("div")].some((node) => node.textContent?.trim() === "Painel Master SaaS");
}

function mountButton() {
  const existing = document.getElementById(BUTTON_ID);
  if (!isMasterPanelVisible()) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = localStorage.getItem("erpmini_push_enabled") === "1"
    ? "🔔 Notificações ativas"
    : "🔔 Ativar notificações";
  Object.assign(button.style, {
    position: "fixed",
    right: "18px",
    bottom: "88px",
    zIndex: "9998",
    border: "0",
    borderRadius: "999px",
    padding: "12px 16px",
    background: "#0f172a",
    color: "#fff",
    fontWeight: "900",
    boxShadow: "0 10px 28px rgba(15,23,42,.28)",
    cursor: "pointer"
  });

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Ativando...";
    try {
      await enablePushNotifications();
      button.textContent = "🔔 Notificações ativas";
      alert("Notificações ativadas neste celular.");
    } catch (error) {
      button.textContent = "🔔 Ativar notificações";
      alert(error?.message || "Não foi possível ativar as notificações.");
    } finally {
      button.disabled = false;
    }
  });

  document.body.appendChild(button);
}

export function installPushNotificationButton() {
  mountButton();
  const observer = new MutationObserver(() => mountButton());
  observer.observe(document.body, { childList: true, subtree: true });
}
