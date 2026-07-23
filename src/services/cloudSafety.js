const ARRAY_KEYS = [
  "erpmini_products",
  "erpmini_sales",
  "erpmini_services",
  "erpmini_service_catalog",
  "erpmini_clients",
  "erpmini_cash_closures",
  "erpmini_cash_ops",
  "erpmini_payables",
  "erpmini_receivables",
];

const OPERATIONAL_KEYS = ARRAY_KEYS.filter((key) => key !== "erpmini_products");
const HISTORY_EXCLUDED_KEYS = new Set([
  "erpmini_backup_history",
  "erpmini_backup_latest",
]);

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasCustomProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return false;
  if (products.length !== 3) return true;

  const defaults = [
    ["Produto A", 25.9, 50, "7891234560001"],
    ["Produto B", 12.5, 30, "7891234560002"],
    ["Produto C", 8, 100, "7891234560003"],
  ];

  return defaults.some(([name, price, stock, barcode], index) => {
    const product = products[index] || {};
    return (
      product.name !== name
      || Number(product.price) !== price
      || Number(product.stock) !== stock
      || String(product.barcode || "") !== barcode
    );
  });
}

export function snapshotStats(payload = {}) {
  const byKey = {};
  ARRAY_KEYS.forEach((key) => {
    byKey[key] = arrayLength(payload?.[key]);
  });

  const operationalRecords = OPERATIONAL_KEYS.reduce((sum, key) => sum + byKey[key], 0);
  const products = byKey.erpmini_products;
  const customProducts = hasCustomProducts(payload?.erpmini_products);
  const saleCounter = Number(payload?.erpmini_salecounter) || 0;
  const customStore = Boolean(
    payload?.erpmini_storename
    && payload.erpmini_storename !== "Minha Loja"
  );

  return {
    byKey,
    operationalRecords,
    products,
    customProducts,
    saleCounter,
    customStore,
    meaningful:
      operationalRecords > 0
      || customProducts
      || saleCounter > 1000
      || customStore,
  };
}

export function isDestructiveReplacement(remotePayload, localPayload) {
  const remote = snapshotStats(remotePayload);
  const local = snapshotStats(localPayload);

  if (!remote.meaningful) return false;

  const localLooksFresh =
    local.operationalRecords === 0
    && !local.customProducts
    && local.saleCounter <= 1000
    && !local.customStore;

  return localLooksFresh;
}

export function stripSnapshotForHistory(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => key !== "__snapshot_history" && !HISTORY_EXCLUDED_KEYS.has(key)
    )
  );
}

export function appendSnapshotHistory(remotePayload, savedAt, appVersion, limit = 5) {
  if (!remotePayload || typeof remotePayload !== "object") return [];

  const previous = Array.isArray(remotePayload.__snapshot_history)
    ? remotePayload.__snapshot_history
    : [];

  const current = {
    saved_at: savedAt || remotePayload.__saved_at || new Date().toISOString(),
    app_version: appVersion || remotePayload.__app_version || "",
    data: stripSnapshotForHistory(remotePayload),
  };

  return [current, ...previous]
    .filter((entry) => entry?.data && typeof entry.data === "object")
    .slice(0, limit);
}
