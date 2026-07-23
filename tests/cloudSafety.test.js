import test from "node:test";
import assert from "node:assert/strict";
import {
  appendSnapshotHistory,
  isDestructiveReplacement,
  snapshotStats,
  stripSnapshotForHistory,
} from "../src/services/cloudSafety.js";

const emptyApp = {
  erpmini_products: [
    { name: "Produto A", price: 25.9, stock: 50, barcode: "7891234560001" },
    { name: "Produto B", price: 12.5, stock: 30, barcode: "7891234560002" },
    { name: "Produto C", price: 8, stock: 100, barcode: "7891234560003" },
  ],
  erpmini_sales: [],
  erpmini_services: [],
  erpmini_clients: [],
  erpmini_receivables: [],
  erpmini_salecounter: 1000,
  erpmini_storename: "Minha Loja",
};

const activeBusiness = {
  ...emptyApp,
  erpmini_sales: [{ id: 1 }],
  erpmini_clients: [{ id: 2 }],
  erpmini_services: [{ id: 3 }],
  erpmini_salecounter: 1004,
  erpmini_storename: "Floricultura",
};

test("detecta estado inicial sem movimento", () => {
  assert.equal(snapshotStats(emptyApp).meaningful, false);
});

test("bloqueia estado vazio substituindo empresa com dados", () => {
  assert.equal(isDestructiveReplacement(activeBusiness, emptyApp), true);
});

test("permite atualização normal que mantém dados", () => {
  const edited = { ...activeBusiness, erpmini_sales: [{ id: 1 }, { id: 4 }] };
  assert.equal(isDestructiveReplacement(activeBusiness, edited), false);
});

test("permite primeiro envio quando a nuvem ainda não tem dados", () => {
  assert.equal(isDestructiveReplacement(null, emptyApp), false);
});

test("protege alterações mesmo quando continuam existindo três produtos", () => {
  const customized = {
    ...emptyApp,
    erpmini_products: emptyApp.erpmini_products.map((product, index) =>
      index === 0 ? { ...product, name: "Rosa vermelha", stock: 12 } : product
    ),
  };
  assert.equal(snapshotStats(customized).meaningful, true);
  assert.equal(isDestructiveReplacement(customized, emptyApp), true);
});

test("histórico não inclui backups recursivos", () => {
  const stripped = stripSnapshotForHistory({
    ...activeBusiness,
    erpmini_backup_history: [{ huge: true }],
    erpmini_backup_latest: { huge: true },
    __snapshot_history: [{ huge: true }],
  });
  assert.equal("erpmini_backup_history" in stripped, false);
  assert.equal("erpmini_backup_latest" in stripped, false);
  assert.equal("__snapshot_history" in stripped, false);
});

test("mantém no máximo cinco versões", () => {
  const remote = {
    ...activeBusiness,
    __snapshot_history: Array.from({ length: 7 }, (_, index) => ({
      saved_at: `old-${index}`,
      data: activeBusiness,
    })),
  };
  const history = appendSnapshotHistory(remote, "now", "v7");
  assert.equal(history.length, 5);
  assert.equal(history[0].saved_at, "now");
});
