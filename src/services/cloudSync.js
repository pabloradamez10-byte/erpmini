import { APP_VERSION } from "../constants/app.js";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";
import { CLOUD_KEYS, CLOUD_TABLE } from "./cloudKeys.js";
import {
  appendSnapshotHistory,
  isDestructiveReplacement,
  snapshotStats,
} from "./cloudSafety.js";
import { supabase } from "./supabaseClient.js";

const OFFLINE_PENDING_KEY = "erpmini_offline_pending";
const OFFLINE_LAST_SYNC_KEY = "erpmini_offline_last_sync";

let cloudUserId = null;
let cloudSaveTimer = null;
let cloudApplyingRemote = false;
let cloudInitialized = false;
let destructiveSaveAuthorized = false;

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

function cloudPayloadToBackup(payload, createdAt, mode = "cloud-recovery") {
  return {
    app: "ERPmini",
    backupVersion: 1,
    mode,
    appVersion: payload?.__app_version || APP_VERSION,
    createdAt: createdAt || payload?.__saved_at || new Date().toISOString(),
    storeName: payload?.erpmini_storename || "Minha Loja",
    saleCounter: payload?.erpmini_salecounter || 1000,
    data: {
      products: payload?.erpmini_products || [],
      sales: payload?.erpmini_sales || [],
      services: payload?.erpmini_services || [],
      serviceCatalog: payload?.erpmini_service_catalog || [],
      clients: payload?.erpmini_clients || [],
      cashClosures: payload?.erpmini_cash_closures || [],
      cashOps: payload?.erpmini_cash_ops || [],
      payables: payload?.erpmini_payables || [],
      receivables: payload?.erpmini_receivables || [],
      storeName: payload?.erpmini_storename || "Minha Loja",
      saleCounter: payload?.erpmini_salecounter || 1000,
    },
  };
}

function mergeCloudRecoveryIntoLocal(remotePayload, localBeforeApply) {
  try {
    const restoredHistory = readLocalJsonSafe("erpmini_backup_history");
    const candidates = Array.isArray(restoredHistory) ? [...restoredHistory] : [];

    if (snapshotStats(localBeforeApply).meaningful) {
      candidates.unshift(
        cloudPayloadToBackup(localBeforeApply, new Date().toISOString(), "seguranca-local")
      );
    }

    const cloudHistory = Array.isArray(remotePayload?.__snapshot_history)
      ? remotePayload.__snapshot_history
      : [];
    cloudHistory.forEach((entry) => {
      if (snapshotStats(entry?.data).meaningful) {
        candidates.push(
          cloudPayloadToBackup(entry.data, entry.saved_at, "versao-nuvem")
        );
      }
    });

    const unique = [];
    const seen = new Set();
    candidates.forEach((backup) => {
      const key = String(backup?.createdAt || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(backup);
    });
    localStorage.setItem("erpmini_backup_history", JSON.stringify(unique.slice(0, 7)));
  } catch (error) {
    console.warn("ERPmini recovery history error:", error);
  }
}

export function authorizeDestructiveCloudReset() {
  destructiveSaveAuthorized = true;
  addDiagnosticLog("CLOUD", "Reset destrutivo autorizado pelo usuário", "warning");
}

export async function uploadCloudSnapshotNow(options = {}) {
  const force = options.force === true || destructiveSaveAuthorized;
  if (!cloudUserId || cloudApplyingRemote || (!cloudInitialized && !force)) {
    addDiagnosticLog("CLOUD", "Envio bloqueado antes da inicialização", "warning");
    return { ok: false, skipped: true, reason: "not-initialized" };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOfflinePending(true);
    return { ok: false, offline: true };
  }

  try {
    const payload = collectCloudPayload();
    const { data: current, error: readError } = await supabase
      .from(CLOUD_TABLE)
      .select("data, updated_at")
      .eq("user_id", cloudUserId)
      .maybeSingle();

    if (readError) throw readError;

    if (!force && current?.data && isDestructiveReplacement(current.data, payload)) {
      addDiagnosticLog(
        "CLOUD",
        "Sobrescrita destrutiva bloqueada",
        "error",
        "A nuvem possui dados e o estado local parece vazio."
      );
      setOfflinePending(true);
      return { ok: false, blocked: true, reason: "destructive-replacement" };
    }

    if (current?.data) {
      payload.__snapshot_history = appendSnapshotHistory(
        current.data,
        current.updated_at,
        current.data.__app_version
      );
    }

    if (destructiveSaveAuthorized) {
      payload.__destructive_reset_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from(CLOUD_TABLE)
      .upsert(
        { user_id: cloudUserId, data: payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) throw error;

    addDiagnosticLog("CLOUD", "Snapshot enviado", "success");
    destructiveSaveAuthorized = false;
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
  if (!cloudUserId || cloudApplyingRemote || !cloudInitialized) return;
  setOfflinePending(true);
  clearTimeout(cloudSaveTimer);

  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  cloudSaveTimer = setTimeout(uploadCloudSnapshotNow, 2500);
}

export async function downloadCloudSnapshot(userId) {
  if (!userId) return { ok: false, message: "Usuario nao identificado." };

  cloudUserId = userId;
  cloudInitialized = false;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    cloudInitialized = true;
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
    cloudInitialized = true;
    await uploadCloudSnapshotNow({ force: true });
    return { ok: true, message: "Primeiro backup enviado para nuvem." };
  }

  const localBeforeApply = collectCloudPayload();
  const remoteWasExplicitlyReset = Boolean(data.data.__destructive_reset_at);

  if (
    !remoteWasExplicitlyReset
    && snapshotStats(localBeforeApply).meaningful
    && isDestructiveReplacement(localBeforeApply, data.data)
  ) {
    addDiagnosticLog(
      "CLOUD",
      "Nuvem vazia rejeitada",
      "error",
      "Os dados locais foram preservados e reenviados."
    );
    cloudInitialized = true;
    await uploadCloudSnapshotNow({ force: true });
    return {
      ok: true,
      recovered: true,
      message: "Dados locais preservados; uma nuvem vazia foi rejeitada.",
    };
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

  mergeCloudRecoveryIntoLocal(data.data, localBeforeApply);
  cloudInitialized = true;
  addDiagnosticLog("CLOUD", "Snapshot carregado", "success");
  return { ok: true, message: "Dados carregados da nuvem." };
}

export function clearCloudUser() {
  cloudUserId = null;
  cloudInitialized = false;
  destructiveSaveAuthorized = false;
  clearTimeout(cloudSaveTimer);
}
