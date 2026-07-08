export function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function loadPersistentSafe(key, fallback) {
  try {
    const sessionRaw = sessionStorage.getItem(key);
    if (sessionRaw) return JSON.parse(sessionRaw);
  } catch {}

  try {
    const localRaw = localStorage.getItem(key);
    if (localRaw) return JSON.parse(localRaw);
  } catch {}

  return fallback;
}

export function savePersistentSafe(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
