import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStorageIsolation } from "./utils/installStorageIsolation.js";

installStorageIsolation();

const NETWORK_TIMEOUT_MS = 10000;
const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  const externalSignal = init?.signal;
  const requestUrl = typeof input === "string" ? input : String(input?.url || "");
  const isCloudSnapshotRequest = requestUrl.includes("/rest/v1/erpmini_cloud_data");

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  try {
    return await nativeFetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && isCloudSnapshotRequest) {
      console.warn("ERPmini: nuvem demorou para responder; continuando com os dados locais.");
      return new Response("[]", {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
          "Content-Range": "*/0"
        }
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", abortFromExternalSignal);
  }
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
