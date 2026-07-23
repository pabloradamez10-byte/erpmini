import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installStorageIsolation } from "./utils/installStorageIsolation.js";

installStorageIsolation();

// A leitura inicial da nuvem precisa terminar antes de o ERP ser aberto.
// Não usamos um snapshot vazio como resposta provisória: isso poderia montar
// a interface sem os dados do cliente e agendar o salvamento desse estado.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("ERPmini: não foi possível ativar o modo instalável/offline.", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
