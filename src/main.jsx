import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SalesLandingPage from "./landing/SalesLandingPage.jsx";
import FirstAccessTutorial from "./onboarding/FirstAccessTutorial.jsx";
import { installStorageIsolation } from "./utils/installStorageIsolation.js";
import { shouldUseCloudBootCache } from "./services/cloudBoot.js";
import { installPushNotificationButton } from "./pushNotifications.js";

const isSalesPage = window.location.pathname === "/";

if (!isSalesPage) {
  installStorageIsolation();
}

const CLOUD_BOOT_CACHE_KEY = "erpmini_cloud_boot_cache";
const CLOUD_BOOT_RELOAD_KEY = "erpmini_cloud_boot_reloaded";
const nativeFetch = window.fetch.bind(window);

function readCloudBootCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CLOUD_BOOT_CACHE_KEY) || "null");
    if (cached && typeof cached === "object") return cached;
  } catch {}

  return { data: {}, updated_at: null };
}

function applyCloudDataInBackground(row) {
  if (!row?.data || typeof row.data !== "object") return;

  try {
    Object.entries(row.data).forEach(([key, value]) => {
      if (key.startsWith("erpmini_") && value !== null && value !== undefined) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
  } catch (error) {
    console.warn("ERPmini: não foi possível aplicar os dados recebidos em segundo plano.", error);
  }
}

function syncCloudSnapshotInBackground(input, init, previousCache) {
  nativeFetch(input, init)
    .then(async (response) => {
      if (!response.ok) return;

      const payload = await response.clone().json().catch(() => null);
      const row = Array.isArray(payload) ? payload[0] : payload;
      if (!row || typeof row !== "object") return;

      const previousUpdatedAt = previousCache?.updated_at || null;
      const nextUpdatedAt = row.updated_at || null;

      localStorage.setItem(CLOUD_BOOT_CACHE_KEY, JSON.stringify(row));
      applyCloudDataInBackground(row);

      const cloudChanged = nextUpdatedAt && nextUpdatedAt !== previousUpdatedAt;
      const alreadyReloaded = sessionStorage.getItem(CLOUD_BOOT_RELOAD_KEY) === "1";

      if (cloudChanged && !alreadyReloaded) {
        sessionStorage.setItem(CLOUD_BOOT_RELOAD_KEY, "1");
        window.setTimeout(() => window.location.reload(), 700);
      }
    })
    .catch((error) => {
      console.warn("ERPmini: sincronização em segundo plano indisponível.", error);
    });
}

if (!isSalesPage) {
  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : String(input?.url || "");
    const requestMethod = String(init?.method || input?.method || "GET").toUpperCase();
    const isCloudSnapshotRead = shouldUseCloudBootCache(requestUrl, requestMethod);

    if (isCloudSnapshotRead) {
      const cachedRow = readCloudBootCache();
      syncCloudSnapshotInBackground(input, init, cachedRow);

      return new Response(JSON.stringify([cachedRow]), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
          "Content-Range": "0-0/1"
        }
      });
    }

    return nativeFetch(input, init);
  };
}

async function registerPwaWorker() {
  try {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
  } catch (error) {
    console.warn("ERPmini: não foi possível registrar o service worker.", error);
  }
}

if (!isSalesPage) {
  registerPwaWorker();
  window.addEventListener("DOMContentLoaded", () => installPushNotificationButton(), { once: true });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isSalesPage ? (
      <SalesLandingPage />
    ) : (
      <>
        <App />
        <FirstAccessTutorial />
      </>
    )}
  </React.StrictMode>
);
