import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStorageIsolation } from "./utils/installStorageIsolation.js";

installStorageIsolation();

const NETWORK_TIMEOUT_MS = 12000;
const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  const externalSignal = init?.signal;

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  try {
    return await nativeFetch(input, { ...init, signal: controller.signal });
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
