(() => {
  const MARKER = "erpminiRequestsCollapsible";

  function setupRequestsPanel() {
    const title = Array.from(document.querySelectorAll("div")).find(
      (el) => el.textContent?.trim() === "Solicitações de acesso"
    );

    if (!title) return;

    const header = title.parentElement?.parentElement;
    const panel = header?.parentElement;

    if (!header || !panel || panel.dataset[MARKER] === "1") return;

    panel.dataset[MARKER] = "1";

    const bodyElements = Array.from(panel.children).filter((child) => child !== header);
    let open = false;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Abrir solicitações";
    button.setAttribute("aria-expanded", "false");
    button.style.cssText = [
      "border:0",
      "border-radius:10px",
      "padding:8px 11px",
      "background:#9a3412",
      "color:#fff",
      "font-size:11px",
      "font-weight:900",
      "cursor:pointer",
      "white-space:nowrap",
      "margin-left:auto"
    ].join(";");

    const applyState = () => {
      bodyElements.forEach((element) => {
        element.style.display = open ? "" : "none";
      });
      header.style.marginBottom = open && bodyElements.length ? "10px" : "0";
      button.textContent = open ? "Fechar solicitações" : "Abrir solicitações";
      button.setAttribute("aria-expanded", open ? "true" : "false");
    };

    button.addEventListener("click", () => {
      open = !open;
      applyState();
    });

    header.appendChild(button);
    applyState();
  }

  const observer = new MutationObserver(setupRequestsPanel);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupRequestsPanel, { once: true });
  } else {
    setupRequestsPanel();
  }
})();