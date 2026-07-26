import test from "node:test";
import assert from "node:assert/strict";
import { installStorageIsolation } from "../src/utils/installStorageIsolation.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function authSession(userId) {
  return JSON.stringify({ user: { id: userId } });
}

test("isola as mesmas chaves locais entre dois usuários", () => {
  const localStorage = new MemoryStorage();
  global.window = { localStorage };

  localStorage.setItem("sb-erpmini-auth-token", authSession("usuario-a"));
  installStorageIsolation();
  localStorage.setItem("erpmini_products", JSON.stringify([{ id: "produto-a" }]));

  localStorage.setItem("sb-erpmini-auth-token", authSession("usuario-b"));
  assert.equal(localStorage.getItem("erpmini_products"), null);
  localStorage.setItem("erpmini_products", JSON.stringify([{ id: "produto-b" }]));

  localStorage.setItem("sb-erpmini-auth-token", authSession("usuario-a"));
  assert.deepEqual(JSON.parse(localStorage.getItem("erpmini_products")), [{ id: "produto-a" }]);

  localStorage.setItem("sb-erpmini-auth-token", authSession("usuario-b"));
  assert.deepEqual(JSON.parse(localStorage.getItem("erpmini_products")), [{ id: "produto-b" }]);

  delete global.window;
});
