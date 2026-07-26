import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalogPayload } from "../src/services/catalogSync.js";

test("preserva IDs e campos legados de produtos e clientes", () => {
  const product = { id:1700, name:"Produto", lastCost:7, price:10, stock:3 };
  const client = { id:1800, name:"Cliente", phone:"11999999999", limit:250 };

  const payload = normalizeCatalogPayload({
    userId:"usuario-a",
    storeName:" Loja A ",
    products:[product],
    clients:[client]
  });

  assert.equal(payload.userId, "usuario-a");
  assert.equal(payload.storeName, "Loja A");
  assert.deepEqual(payload.products, [product]);
  assert.deepEqual(payload.clients, [client]);
});

test("normaliza coleções inválidas sem inventar registros", () => {
  const payload = normalizeCatalogPayload({
    userId:null,
    storeName:"",
    products:null,
    clients:undefined
  });

  assert.equal(payload.userId, "");
  assert.equal(payload.storeName, "Minha Loja");
  assert.deepEqual(payload.products, []);
  assert.deepEqual(payload.clients, []);
});
