import React from 'react'
import { createRoot } from 'react-dom/client'
import ERP from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ERP />
  </React.StrictMode>,
)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
