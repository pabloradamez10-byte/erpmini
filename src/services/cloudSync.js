import { APP_VERSION } from "../constants/app.js";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";
import { CLOUD_KEYS, CLOUD_TABLE } from "./cloudKeys.js";
import { supabase } from "./supabaseClient.js";
import { applyCloudPayload, hasCloudPayloadData } from "./cloudPayload.js";

const OFFLINE_PENDING_KEY = "erpmini_offline_pending";
const OFFLINE_LAST_SYNC_KEY = "erpmini_offline_last_sync";
const CLOUD_OWNER_KEY = "erpmini_cloud_owner";

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

function getLocalOwner() {
  try {
    return localStorage.getItem(CLOUD_OWNER_KEY) || "";
  } catch {
    return "";
  }
}

function setLocalOwner(userId) {
  try {
    localStorage.setItem(CLOUD_OWNER_KEY, String(userId || ""));
  } catch {}
}

function hasLocalCloudData() {
  try {
    return hasCloudPayloadData(localStorage);
  } catch {
    return false;
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

  const localOwner = getLocalOwner();
  if (localOwner && localOwner !== cloudUserId) {
    addDiagnosticLog("CLOUD", "Upload bloqueado por divergência de usuário", "error");
    return { ok: false, unsafeLocal: true };
  }
  if (!localOwner) setLocalOwner(cloudUserId);

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
  const localOwner = getLocalOwner();

  if (localOwner && localOwner !== userId) {
    addDiagnosticLog("CLOUD", "Dados locais pertencem a outro usuário", "error");
    return {
      ok: false,
      unsafeLocal: true,
      message: "Os dados locais não pertencem a esta conta."
    };
  }

  if (!localOwner) setLocalOwner(userId);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setOfflinePending(getOfflinePending());
    if (!hasLocalCloudData()) {
      return {
        ok: false,
        offline: true,
        safeLocal: false,
        message: "Sem internet e sem dados locais confirmados para esta conta."
      };
    }
    return {
      ok: true,
      offline: true,
      safeLocal: true,
      message: "Modo offline. Usando dados desta conta salvos neste aparelho."
    };
  }

  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    addDiagnosticLog("CLOUD", "Falha ao baixar snapshot", "error", error.message);
    console.warn("ERPmini cloud load error:", error);
    const safeLocal = hasLocalCloudData() && getLocalOwner() === userId;
    return {
      ok: false,
      safeLocal,
      message: safeLocal
        ? "Nuvem indisponível. Usando os dados locais confirmados desta conta."
        : "Não foi possível confirmar os dados desta conta na nuvem."
    };
  }

  if (!data?.data) {
    addDiagnosticLog("CLOUD", "Primeiro snapshot necessário", "warning");
    await uploadCloudSnapshotNow();
    return { ok: true, message: "Primeiro backup enviado para nuvem." };
  }

  cloudApplyingRemote = true;
  try {
    applyCloudPayload(localStorage, data.data);
    setLocalOwner(userId);
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
