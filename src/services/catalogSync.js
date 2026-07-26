import { supabase } from "./supabaseClient.js";

const SYNC_DELAY_MS = 900;

let syncTimer = null;
let latestRequest = null;
let syncQueue = Promise.resolve();

export function normalizeCatalogPayload({ userId, storeName, products, clients }) {
  return {
    userId: String(userId || ""),
    storeName: String(storeName || "").trim() || "Minha Loja",
    products: Array.isArray(products) ? products : [],
    clients: Array.isArray(clients) ? clients : []
  };
}

async function sendCatalog(request) {
  if (!request.userId || typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok:false, skipped:true };
  }

  const { data:authData, error:authError } = await supabase.auth.getUser();
  if (authError || authData?.user?.id !== request.userId) {
    return { ok:false, skipped:true };
  }

  const { data, error } = await supabase.rpc("erpmini_sync_catalog", {
    p_store_name: request.storeName,
    p_products: request.products,
    p_clients: request.clients
  });

  if (error) {
    console.warn("ERPmini normalized catalog sync error:", error.message);
    return { ok:false, error };
  }

  return { ok:true, data };
}

export function scheduleCatalogSync(payload) {
  latestRequest = normalizeCatalogPayload(payload);
  clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    const request = latestRequest;
    syncQueue = syncQueue.then(() => sendCatalog(request), () => sendCatalog(request));
  }, SYNC_DELAY_MS);
}

export async function syncCatalogNow(payload) {
  clearTimeout(syncTimer);
  const request = normalizeCatalogPayload(payload);
  latestRequest = request;
  syncQueue = syncQueue.then(() => sendCatalog(request), () => sendCatalog(request));
  return syncQueue;
}
