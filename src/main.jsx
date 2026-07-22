import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStorageIsolation } from "./utils/installStorageIsolation.js";

installStorageIsolation();

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

window.fetch = async (input, init = {}) => {
  const requestUrl = typeof input === "string" ? input : String(input?.url || "");
  const requestMethod = String(init?.method || input?.method || "GET").toUpperCase();
  const isCloudSnapshotRead =
    requestMethod === "GET" && requestUrl.includes("/rest/v1/erpmini_cloud_data");

  if (isCloudSnapshotRead) {
    const cachedRow = readCloudBootCache();

    // Abre o ERP imediatamente e deixa a nuvem trabalhar em segundo plano.
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

  // Todas as outras requisições seguem sem timeout global.
  // Isso evita cancelar licenças, listagem do ADM e solicitações de cadastro
  // em conexões móveis mais lentas.
  return nativeFetch(input, init);
};

async function removeLegacyPwaCache() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch (error) {
    console.warn("ERPmini: não foi possível limpar o cache antigo do PWA.", error);
  }
}

removeLegacyPwaCache();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
