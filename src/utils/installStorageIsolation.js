const ERP_PREFIX = "erpmini_";
const INTERNAL_PREFIX = "erpmini:user:";

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractUserId(rawGetItem, rawKey, rawLength) {
  try {
    for (let i = 0; i < rawLength(); i += 1) {
      const key = rawKey(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

      const raw = rawGetItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const directId = parsed?.user?.id || parsed?.currentSession?.user?.id;
      if (directId) return String(directId);

      const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
      const payload = decodeJwtPayload(accessToken);
      if (payload?.sub) return String(payload.sub);
    }
  } catch {}

  return null;
}

export function installStorageIsolation() {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (window.__ERPMINI_STORAGE_ISOLATION__) return;

  const storage = window.localStorage;
  const prototype = Object.getPrototypeOf(storage);

  const rawGetItem = prototype.getItem.bind(storage);
  const rawSetItem = prototype.setItem.bind(storage);
  const rawRemoveItem = prototype.removeItem.bind(storage);
  const rawKey = prototype.key.bind(storage);
  const rawLength = () => storage.length;

  const scopedKey = (key) => {
    const normalized = String(key || "");
    if (!normalized.startsWith(ERP_PREFIX)) return normalized;
    if (normalized.startsWith(INTERNAL_PREFIX)) return normalized;

    const userId = extractUserId(rawGetItem, rawKey, rawLength);
    if (!userId) return normalized;

    return `${INTERNAL_PREFIX}${userId}:${normalized}`;
  };

  prototype.getItem = function getItem(key) {
    return rawGetItem(scopedKey(key));
  };

  prototype.setItem = function setItem(key, value) {
    return rawSetItem(scopedKey(key), value);
  };

  prototype.removeItem = function removeItem(key) {
    return rawRemoveItem(scopedKey(key));
  };

  window.__ERPMINI_STORAGE_ISOLATION__ = true;
}
