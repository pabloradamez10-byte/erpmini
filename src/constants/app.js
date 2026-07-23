export const APP_VERSION = "ERPmini-v7-candidato-comercial";

export const PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro", icon: "Dinheiro", color: "#16a34a", light: "#f0fdf4" },
  { key: "pix", label: "PIX", icon: "PIX", color: "#0891b2", light: "#ecfeff" },
  { key: "debito", label: "Cartao Debito", icon: "Cartao", color: "#7c3aed", light: "#f5f3ff" },
  { key: "credito", label: "Cartao Credito", icon: "Cartao", color: "#2563eb", light: "#eff6ff" },
  { key: "crediario", label: "Crediário", icon: "Crediário", color: "#f59e0b", light: "#fffbeb" }
];

export const initialProducts = [
  { id: 1, name: "Produto A", price: 25.9, stock: 50, category: "Geral", barcode: "7891234560001" },
  { id: 2, name: "Produto B", price: 12.5, stock: 30, category: "Geral", barcode: "7891234560002" },
  { id: 3, name: "Produto C", price: 8.0, stock: 100, category: "Geral", barcode: "7891234560003" }
];
