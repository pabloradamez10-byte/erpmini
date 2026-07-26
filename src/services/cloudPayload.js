import { CLOUD_KEYS } from "./cloudKeys.js";

export function hasCloudPayloadData(storage) {
  return CLOUD_KEYS.some((key) => storage.getItem(key) !== null);
}

export function applyCloudPayload(storage, payload) {
  if (!payload || typeof payload !== "object") return;

  CLOUD_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
    const value = payload[key];
    if (value === null || value === undefined) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(value));
  });
}
