import test from "node:test";
import assert from "node:assert/strict";
import { applyCloudPayload, hasCloudPayloadData } from "../src/services/cloudPayload.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values)
  };
}

test("aplica somente as chaves do snapshot recebidas", () => {
  const storage = createStorage({
    erpmini_products: JSON.stringify([{ id: 1 }]),
    erpmini_sales: JSON.stringify([{ id: 10 }])
  });

  applyCloudPayload(storage, {
    erpmini_products: [{ id: 2 }]
  });

  assert.deepEqual(JSON.parse(storage.getItem("erpmini_products")), [{ id: 2 }]);
  assert.deepEqual(JSON.parse(storage.getItem("erpmini_sales")), [{ id: 10 }]);
});

test("remove dados locais quando a nuvem registra exclusão", () => {
  const storage = createStorage({
    erpmini_clients: JSON.stringify([{ id: 1 }])
  });

  applyCloudPayload(storage, { erpmini_clients: null });

  assert.equal(storage.getItem("erpmini_clients"), null);
  assert.equal(hasCloudPayloadData(storage), false);
});

test("não altera chaves externas ao ERPmini", () => {
  const storage = createStorage({ unrelated_key: "preservar" });

  applyCloudPayload(storage, {
    unrelated_key: "alterar",
    erpmini_storename: "Loja segura"
  });

  assert.equal(storage.getItem("unrelated_key"), "preservar");
  assert.equal(JSON.parse(storage.getItem("erpmini_storename")), "Loja segura");
});
