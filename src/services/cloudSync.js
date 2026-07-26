import { APP_VERSION } from "../constants/app.js";
import { addDiagnosticLog } from "../utils/diagnosticLog.js";
import { CLOUD_KEYS, CLOUD_TABLE } from "./cloudKeys.js";
import { supabase } from "./supabaseClient.js";
import { applyCloudPayload, hasCloudPayloadData } from "./cloudPayload.js";

const OFFLINE_PENDING_KEY = "erpmini_offline_pending";
const OFFLINE_LAST_SYNC_KEY = "erpmini_offline_last_sync";
const CLOUD_OWNER_KEY = "erpmini_cloud_owner";
const DEVICE_ID_KEY = "erpmini_sync_device_id";
const CLOUD_VERSION_KEY = "erpmini_cloud_version";
const CLOUD_CONFLICT_KEY = "erpmini_cloud_conflict";

let cloudUserId = null;
let cloudVersion = 0;
let cloudSaveTimer = null;
let cloudApplyingRemote = false;
let cloudConflict = null;

function dispatchSyncState(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent("erpmini-sync-state", { detail }));
  } catch {}
}

function setOfflinePending(value, detail = {}) {
  try {
    localStorage.setItem(OFFLINE_PENDING_KEY, JSON.stringify(!!value));
  } catch {}
  dispatchSyncState({ pending: !!value, ...detail });
}

export function getOfflinePending() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_PENDING_KEY) || "false");
  } catch {
    return false;
  }
}

export function getCloudConflict() {
  return cloudConflict || getStoredConflict();
}

function setOfflineLastSync() {
  try {
    localStorage.setItem(OFFLINE_LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
  dispatchSyncState({ pending: false, saved: true, version: cloudVersion });
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

function getStoredCloudVersion() {
  try {
    return Math.max(Number(localStorage.getItem(CLOUD_VERSION_KEY)) || 0, 0);
  } catch {
    return 0;
  }
}

function setCloudVersion(value) {
  cloudVersion = Math.max(Number(value) || 0, 0);
  try {
    localStorage.setItem(CLOUD_VERSION_KEY, String(cloudVersion));
  } catch {}
}

function getStoredConflict() {
  try {
    const value = JSON.parse(localStorage.getItem(CLOUD_CONFLICT_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function setCloudConflict(value) {
  cloudConflict = value && typeof value === "object" ? value : null;
  try {
    if (cloudConflict) {
      localStorage.setItem(CLOUD_CONFLICT_KEY, JSON.stringify(cloudConflict));
    } else {
      localStorage.removeItem(CLOUD_CONFLICT_KEY);
    }
  } catch {}
}

function getDeviceId() {
  try {
    let value = localStorage.getItem(DEVICE_ID_KEY);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.()
        || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, value);
    }
    return value;
  } catch {
    return "device-unavailable";
  }
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
  if (cloudConflict) {
    setOfflinePending(true, { conflict: cloudConflict });
    return { ok: false, conflict: true, details: cloudConflict };
  }

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
    const { data, error } = await supabase.rpc("erpmini_save_cloud_snapshot", {
      p_data: payload,
      p_expected_version: cloudVersion,
      p_device_id: getDeviceId()
    });

    if (error) throw error;

    if (data?.status === "conflict") {
      setCloudConflict({
        expectedVersion: Number(data.expected_version || cloudVersion),
        currentVersion: Number(data.current_version || 0),
        updatedAt: data.updated_at || null,
        updatedByDevice: data.updated_by_device || null
      });
      addDiagnosticLog(
        "CLOUD",
        "Conflito de sincronização bloqueado",
        "error",
        `local=${cloudConflict.expectedVersion}; nuvem=${cloudConflict.currentVersion}`
      );
      setOfflinePending(true, { conflict: cloudConflict });
      return { ok: false, conflict: true, details: cloudConflict };
    }

    if (data?.status !== "saved" || !Number.isFinite(Number(data.version))) {
      throw new Error("Resposta inválida ao salvar snapshot.");
    }

    setCloudVersion(data.version);
    setCloudConflict(null);
    addDiagnosticLog("CLOUD", `Snapshot v${cloudVersion} enviado`, "success");
    setOfflinePending(false);
    setOfflineLastSync();
    return { ok: true, version: cloudVersion };
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
  setCloudVersion(getStoredCloudVersion());
  setCloudConflict(getStoredConflict());
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

  if (cloudConflict && hasLocalCloudData()) {
    setOfflinePending(true, { conflict: cloudConflict });
    return {
      ok: true,
      safeLocal: true,
      conflict: true,
      message: "Conflito pendente. Os dados locais foram preservados neste aparelho."
    };
  }

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
    .select("data, updated_at, version, data_hash, updated_by_device")
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
    setCloudVersion(0);
    setCloudConflict(null);
    addDiagnosticLog("CLOUD", "Primeiro snapshot necessário", "warning");
    const firstUpload = await uploadCloudSnapshotNow();
    return firstUpload.ok
      ? { ok: true, message: "Primeiro backup enviado para nuvem." }
      : {
          ...firstUpload,
          message: firstUpload.conflict
            ? "Outra sessão criou dados na nuvem antes deste aparelho."
            : "Não foi possível criar o primeiro backup na nuvem."
        };
  }

  setCloudVersion(Math.max(Number(data.version) || 1, 1));
  setCloudConflict(null);
  cloudApplyingRemote = true;
  try {
    applyCloudPayload(localStorage, data.data);
    setLocalOwner(userId);
  } finally {
    cloudApplyingRemote = false;
  }

  addDiagnosticLog("CLOUD", `Snapshot v${cloudVersion} carregado`, "success");
  dispatchSyncState({ pending: getOfflinePending(), version: cloudVersion });
  return { ok: true, message: "Dados carregados da nuvem.", version: cloudVersion };
}

export function clearCloudUser() {
  cloudUserId = null;
  cloudVersion = 0;
  cloudConflict = null;
  clearTimeout(cloudSaveTimer);
}
