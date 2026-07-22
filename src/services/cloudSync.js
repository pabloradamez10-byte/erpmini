import { APP_VERSION } from "../constants/app.js";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";
import { CLOUD_KEYS, CLOUD_TABLE } from "./cloudKeys.js";
import { supabase } from "./supabaseClient.js";

const OFFLINE_PENDING_KEY = "erpmini_offline_pending";
const OFFLINE_LAST_SYNC_KEY = "erpmini_offline_last_sync";

let cloudUserId = null;
let cloudSaveTimer = null;
let cloudApplyingRemote = false;

function setOfflinePending(value) {
  try {
    localStorage.setItem(OFFLINE_PENDING_KEY, JSON.stringify(!!value));
    window.dispatchEvent(new CustomEvent("erpmini-sync-state", { detail: { pending: !!value } }));
  } catch {}
}

export function getOfflinePending() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_PENDING_KEY) || "false");
  } catch {
    return false;
  }
}

function setOfflineLastSync() {
  try {
    localStorage.setItem(OFFLINE_LAST_SYNC_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("erpmini-sync-state", { detail: { pending: false } }));
  } catch {}
}

function readLocalJsonSafe(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function collectCloudPayload() {
  const payload = {};
  CLOUD_KEYS.forEach((key) => {
    payload[key] = readLocalJsonSafe(key);
  });
  payload.__saved_at = new Date().toISOString();
  payload.__app_version = APP_VERSION;
  return payload;
}

export async function uploadCloudSnapshotNow() {
  if (!cloudUserId || cloudApplyingRemote) return { ok: false, skipped: true };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOfflinePending(true);
    return { ok: false, offline: true };
  }

  try {
    const payload = collectCloudPayload();
    const { error } = await supabase
      .from(CLOUD_TABLE)
      .upsert(
        { user_id: cloudUserId, data: payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) throw error;

    addDiagnosticLog("CLOUD", "Snapshot enviado", "success");
    setOfflinePending(false);
    setOfflineLastSync();
    return { ok: true };
  } catch (error) {
    addDiagnosticLog("CLOUD", "Falha ao enviar snapshot", "error", error?.message || String(error));
    setOfflinePending(true);
    console.warn("ERPmini cloud save error:", error);
    return { ok: false, error };
  }
}

export function scheduleCloudSave() {
  if (!cloudUserId || cloudApplyingRemote) return;
  setOfflinePending(true);
  clearTimeout(cloudSaveTimer);

  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  cloudSaveTimer = setTimeout(uploadCloudSnapshotNow, 2500);
}

export async function downloadCloudSnapshot(userId) {
  if (!userId) return { ok: false, message: "Usuario nao identificado." };

  cloudUserId = userId;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOfflinePending(getOfflinePending());
    return { ok: true, offline: true, message: "Modo offline. Usando dados salvos neste aparelho." };
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    addDiagnosticLog("CLOUD", "Falha ao baixar snapshot", "error", error.message);
    console.warn("ERPmini cloud load error:", error);
    return { ok: false, message: error.message };
  }

  if (!data?.data) {
    addDiagnosticLog("CLOUD", "Primeiro snapshot necessário", "warning");
    await uploadCloudSnapshotNow();
    return { ok: true, message: "Primeiro backup enviado para nuvem." };
  }

  cloudApplyingRemote = true;
  try {
    CLOUD_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data.data, key) && data.data[key] !== null) {
        localStorage.setItem(key, JSON.stringify(data.data[key]));
      }
    });
  } finally {
    cloudApplyingRemote = false;
  }

  addDiagnosticLog("CLOUD", "Snapshot carregado", "success");
  return { ok: true, message: "Dados carregados da nuvem." };
}

export function clearCloudUser() {
  cloudUserId = null;
  clearTimeout(cloudSaveTimer);
}
