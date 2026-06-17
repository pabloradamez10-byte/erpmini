<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Portal Terceiros SST</title>
  <meta name="theme-color" content="#1B4FD8" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Terceiros SST" />
  <link rel="manifest" href="./manifest.json" />
  <link rel="apple-touch-icon" href="./icon-192.png" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        #EEF2F7;
      --bg-soft:   #F8FAFC;
      --surface:   #FFFFFF;
      --border:    #DDE5F0;
      --text:      #111827;
      --muted:     #667085;
      --accent:    #155EEF;
      --accent-2:  #0F3D99;
      --accent-lt: #EAF1FF;
      --ok:        #16A34A;
      --ok-lt:     #DCFCE7;
      --danger:    #DC2626;
      --danger-lt: #FEE2E2;
      --warn:      #D97706;
      --warn-lt:   #FEF3C7;
      --radius:    14px;
      --shadow:    0 8px 30px rgba(15, 23, 42, .08);
      --shadow-sm: 0 2px 10px rgba(15, 23, 42, .06);
    }

    body {
      font-family: 'Inter', sans-serif;
      background:
        radial-gradient(circle at top left, rgba(21,94,239,.12), transparent 32%),
        linear-gradient(180deg, #F8FAFC 0%, var(--bg) 100%);
      color: var(--text);
      min-height: 100vh;
    }

    /* ── NAV ── */
    header {
      background: rgba(255,255,255,.92);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 28px;
      min-height: 64px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -.3px;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }

    .brand svg { flex-shrink: 0; }

    nav { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
    nav::-webkit-scrollbar { display: none; }

    nav button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 9px 16px;
      border-radius: 999px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      color: var(--muted);
      transition: background .15s, color .15s;
    }

    nav button:hover { background: var(--bg); color: var(--text); }
    nav button.active { background: var(--accent-lt); color: var(--accent); }

    /* ── LAYOUT ── */
    main { max-width: 1120px; margin: 0 auto; padding: 32px 16px 56px; }

    .page { display: none; }
    .page.active { display: block; }

    h2 { font-size: 28px; font-weight: 800; margin-bottom: 22px; letter-spacing: -.6px; }

    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
      color: #fff;
      border-radius: 22px;
      padding: 26px;
      margin-bottom: 24px;
      box-shadow: 0 16px 42px rgba(21,94,239,.22);
      overflow: hidden;
      position: relative;
    }

    .hero::after {
      content: '';
      position: absolute;
      width: 190px; height: 190px;
      border-radius: 50%;
      right: -65px; top: -65px;
      background: rgba(255,255,255,.14);
    }

    .hero h1 { font-size: 26px; margin-bottom: 6px; position: relative; z-index: 1; }
    .hero p { color: rgba(255,255,255,.82); font-size: 14px; line-height: 1.45; max-width: 650px; position: relative; z-index: 1; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
      box-shadow: var(--shadow-sm);
    }

    .stat-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
    .stat-value { font-size: 28px; font-weight: 800; margin-top: 8px; letter-spacing: -.6px; }
    .stat-ok .stat-value { color: var(--ok); }
    .stat-block .stat-value { color: var(--danger); }
    .stat-company .stat-value { color: var(--accent); }
    .stat-click { cursor:pointer; transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
    .stat-click:hover { transform: translateY(-2px); box-shadow: var(--shadow); border-color: rgba(21,94,239,.35); }
    .stat-hint { display:block; margin-top:6px; font-size:11px; color: var(--muted); font-weight:600; }

    .pendency-tabs { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
    .pendency-pill { border:1px solid var(--border); background: var(--surface); border-radius:999px; padding:8px 12px; font-size:13px; font-weight:700; color:var(--muted); }
    .pendency-pill.danger { color:var(--danger); background:var(--danger-lt); border-color:rgba(220,38,38,.15); }
    .pendency-pill.warn { color:var(--warn); background:var(--warn-lt); border-color:rgba(217,119,6,.18); }
    .pendency-pill.neutral { color:var(--muted); background:#F8FAFC; border-color:rgba(100,116,139,.18); }
    .pendency-section-title { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:var(--muted); margin:22px 0 12px; }
    .pendency-item {
      cursor: pointer; display:flex; justify-content:space-between; gap:14px; padding:14px; border:1px solid var(--border); border-radius:14px; background:var(--surface); margin-bottom:10px; }
    .pendency-item strong { display:block; font-size:15px; margin-bottom:3px; }
    .pendency-item small { display:block; color:var(--muted); font-size:12px; }
    .pendency-detail { text-align:right; font-size:12px; font-weight:700; max-width:48%; }
    .pendency-detail.danger { color:var(--danger); }
    .pendency-detail.warn { color:var(--warn); }
    .pendency-detail.neutral { color:var(--muted); }
    .match-list { display:grid; gap:10px; margin-top:16px; }
    .match-item { width:100%; text-align:left; border:1px solid var(--border); border-radius:14px; background:#fff; padding:14px; cursor:pointer; display:flex; justify-content:space-between; gap:12px; align-items:center; font-family:'Inter',sans-serif; }
    .match-item:hover { border-color:var(--accent); box-shadow:0 8px 20px rgba(37,99,235,.10); }
    .match-item strong { display:block; font-size:15px; color:var(--text); }
    .match-item small { display:block; color:var(--muted); margin-top:3px; font-size:12px; }
    .match-badge { font-size:11px; font-weight:800; border-radius:999px; padding:5px 8px; white-space:nowrap; }
    .match-badge.ok { color:var(--ok); background:var(--ok-lt); }
    .match-badge.blocked { color:var(--danger); background:var(--danger-lt); }

    /* ── CARD ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 26px;
      margin-bottom: 20px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .6px;
      margin-bottom: 18px;
    }

    /* ── FORM ── */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .form-grid .full { grid-column: 1 / -1; }

    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 5px; color: var(--text); }

    input, textarea, select {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      color: var(--text);
      background: var(--bg-soft);
      transition: border-color .15s, box-shadow .15s;
      outline: none;
    }

    input:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(27,79,216,.12);
      background: #fff;
    }

    textarea { resize: vertical; min-height: 72px; }

    /* ── BUTTONS ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 11px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity .15s, transform .1s;
    }

    .btn:active { transform: scale(.97); }
    .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; box-shadow: 0 8px 18px rgba(21,94,239,.18); }
    .btn-primary:hover { opacity: .88; }
    .btn-danger  { background: var(--danger-lt); color: var(--danger); }
    .btn-danger:hover  { opacity: .8; }
    .btn-ghost   { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
    .btn-ghost:hover   { background: var(--border); }

    /* ── SEARCH BAR ── */
    .search-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      align-items: center;
    }

    .search-wrap {
      position: relative;
      flex: 1;
    }

    .search-wrap svg {
      position: absolute;
      left: 11px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted);
      pointer-events: none;
    }

    .search-wrap input {
      padding-left: 36px;
    }

    /* ── TABLE ── */
    .table-wrap { overflow-x: auto; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    thead th {
      text-align: left;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }

    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background .12s;
    }

    tbody tr:hover { background: var(--bg); }
    tbody tr:last-child { border-bottom: none; }

    tbody td { padding: 11px 14px; vertical-align: middle; }

    .td-name  { font-weight: 600; }
    .td-cpf   { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); }
    .td-company { color: var(--muted); font-size: 13px; }

    .actions { display: flex; gap: 6px; }

    /* ── BADGE ── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .3px;
      white-space: nowrap;
    }

    .badge-ok      { background: var(--ok-lt);     color: var(--ok); }
    .badge-blocked { background: var(--danger-lt);  color: var(--danger); }
    .badge-warn    { background: var(--warn-lt);    color: var(--warn); }

    /* ── PORTARIA ── */
    .portaria-search { display: flex; gap: 10px; margin-bottom: 24px; }
    .portaria-search input { flex: 1; font-size: 16px; padding: 12px 16px; }
    .portaria-search button { padding: 12px 22px; font-size: 15px; }

    .result-card {
      border-radius: 22px;
      padding: 30px;
      border: 2px solid var(--border);
      background: var(--surface);
      display: none;
    }

    .result-card.show { display: block; }

    .result-status {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .status-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .status-icon.ok      { background: var(--ok-lt);     color: var(--ok); }
    .status-icon.blocked { background: var(--danger-lt);  color: var(--danger); }

    .status-label { font-size: 34px; font-weight: 900; line-height: 1; letter-spacing: -.8px; }
    .status-label.ok      { color: var(--ok); }
    .status-label.blocked { color: var(--danger); }

    .status-sub { font-size: 13px; color: var(--muted); margin-top: 3px; }

    .result-info { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .info-item label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
    .info-item span  { font-size: 15px; font-weight: 500; display: block; margin-top: 2px; }

    .motivos {
      margin-top: 16px;
      padding: 14px 16px;
      background: var(--danger-lt);
      border-radius: 8px;
      border-left: 4px solid var(--danger);
    }

    .motivos-title { font-size: 12px; font-weight: 700; color: var(--danger); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }

    .motivos ul { padding-left: 16px; }
    .motivos ul li { font-size: 13.5px; color: var(--danger); margin-bottom: 4px; font-weight: 500; }

    .not-found {
      text-align: center;
      padding: 40px;
      color: var(--muted);
      display: none;
    }
    .not-found.show { display: block; }

    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--muted);
    }

    .empty-state svg { margin-bottom: 12px; opacity: .35; }
    .empty-state p { font-size: 14px; }

    /* ── MODAL ── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      display: none;
      padding: 16px;
    }

    .modal-overlay.open { display: flex; }

    .modal {
      background: var(--surface);
      border-radius: 12px;
      padding: 28px;
      width: 100%;
      max-width: 620px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
    }

    .modal-title { font-size: 17px; font-weight: 700; }

    .modal-close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--muted);
      padding: 4px;
      border-radius: 5px;
      display: flex;
      align-items: center;
    }

    .modal-close:hover { background: var(--bg); color: var(--text); }

    .modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }

    /* ── TOASTS ── */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 300;
    }

    .toast {
      background: var(--text);
      color: #fff;
      padding: 11px 18px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
      animation: slideIn .2s ease;
    }

    @keyframes slideIn {
      from { transform: translateX(80px); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    .page-actions { display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom:18px; }

    @media (max-width: 860px) {
      header { align-items: flex-start; flex-direction: column; height: auto; gap: 10px; padding: 14px 16px; }
      nav { width: 100%; padding-bottom: 2px; }
      main { padding: 22px 14px 44px; }
      .hero { padding: 22px; border-radius: 18px; }
      .hero h1 { font-size: 22px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      h2 { font-size: 24px; }
      .search-row, .portaria-search { flex-direction: column; align-items: stretch; }
      .search-wrap { width: 100%; }
      .btn { justify-content: center; }
    }



    /* ── TREINAMENTOS ── */
    .training-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 10px;
      margin-top: 10px;
      max-height: 280px;
      overflow-y: auto;
      padding: 4px;
    }

    .check-card {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      border: 1px solid var(--border);
      background: var(--bg);
      border-radius: 9px;
      padding: 10px 11px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }

    .check-card:hover { border-color: var(--accent); background: #fff; }
    .check-card input { width: auto; margin-top: 2px; accent-color: var(--accent); }
    .check-card strong { display:block; font-size: 13px; line-height: 1.2; }
    .check-card small { display:block; color: var(--muted); font-size: 11px; margin-top: 2px; }

    .required-training-box {
      margin-top: 14px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #F8FAFC;
      display: none;
    }

    .required-training-box.show { display: block; }
    .required-training-title { font-weight: 700; font-size: 13px; margin-bottom: 8px; color: var(--text); }
    .training-tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .training-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--accent-lt);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
    }

    .switch-wrap { display:inline-flex; align-items:center; gap:7px; }
    .switch-wrap input { width:auto; accent-color: var(--accent); }



    .training-date-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }

    .training-date-card {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 10px;
      padding: 12px;
    }

    .training-date-card strong { display:block; font-size:13px; margin-bottom:6px; }
    .training-date-card small { color: var(--muted); font-size:11px; display:block; margin-top:4px; }

    .status-mini {
      display:inline-flex;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      margin-left: 4px;
      white-space: nowrap;
    }
    .status-mini.ok { background: var(--ok-lt); color: var(--ok); }
    .status-mini.blocked { background: var(--danger-lt); color: var(--danger); }
    .status-mini.warn { background: var(--warn-lt); color: var(--warn); }

    .dashboard-list {
      display: grid;
      gap: 10px;
    }

    .dash-item {
      cursor: pointer;
      display:flex;
      justify-content:space-between;
      gap:14px;
      align-items:flex-start;
      border:1px solid var(--border);
      border-radius:10px;
      padding:12px 14px;
      background: var(--surface);
    }

    .dash-item strong { display:block; font-size:14px; }
    .dash-item small { display:block; color: var(--muted); margin-top:3px; }
    .dash-motivos { color: var(--danger); font-size:12px; max-width:55%; text-align:right; }

    /* ── RESPONSIVE ── */
    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: 1fr; }
      .card { padding: 20px; }
      tbody td, thead th { padding: 10px 12px; }
      .actions { flex-direction: column; }
      .status-label { font-size: 30px; }
      .result-info { grid-template-columns: 1fr; }
      nav button { padding: 6px 10px; font-size: 13px; }
    }

    .tag-venc {
      font-size: 11px;
      font-weight: 600;
      color: var(--danger);
      margin-left: 4px;
    }

    .tag-warn {
      font-size: 11px;
      font-weight: 600;
      color: var(--warn);
      margin-left: 4px;
    }

    .tag-ok {
      font-size: 11px;
      font-weight: 600;
      color: var(--ok);
      margin-left: 4px;
    }
  

    .status-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 16px 0;
    }
    .status-panel {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      background: #fff;
    }
    .status-panel h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); margin-bottom: 10px; }
    .status-panel.ok { border-left: 5px solid var(--ok); }
    .status-panel.blocked { border-left: 5px solid var(--danger); }
    .status-panel.warn { border-left: 5px solid var(--warn); }
    .analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .analysis-card { border: 1px solid var(--border); border-radius: 14px; padding: 14px; background: var(--bg-soft); }
    .analysis-card strong { display:block; margin-bottom:6px; }
    .analysis-list { list-style: none; padding: 0; margin: 8px 0 0; }
    .analysis-list li { padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
    .analysis-list li:last-child { border-bottom: none; }
    .status-mini.warn { background: var(--warn-lt); color: var(--warn); }
    .status-mini.neutral { background: var(--accent-lt); color: var(--accent); }
    @media (max-width: 700px) { .status-strip, .analysis-grid { grid-template-columns: 1fr; } }


    .data-actions { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
    .data-box { border:1px solid var(--border); border-radius:18px; padding:18px; background:#fff; box-shadow: var(--shadow); }
    .data-box h3 { font-size:16px; margin-bottom:8px; color:var(--text); }
    .data-box p { color:var(--muted); font-size:13.5px; line-height:1.45; margin-bottom:14px; }
    .file-input { width:100%; padding:12px; border:1px dashed var(--border); background:var(--bg-soft); border-radius:14px; }
    .import-log { margin-top:14px; padding:14px; border-radius:14px; background:var(--bg-soft); border:1px solid var(--border); color:var(--text); font-size:13px; line-height:1.5; white-space:pre-wrap; max-height:260px; overflow:auto; }
    .muted-note { color:var(--muted); font-size:12.5px; line-height:1.45; margin-top:8px; }
    .template-table { width:100%; font-size:12.5px; }
    .template-table th, .template-table td { padding:8px 10px; }

  

    /* V10 - gestão e produtividade */
    .mini-dashboard { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin:16px 0; }
    .mini-card { background:#fff; border:1px solid var(--border); border-radius:18px; padding:16px; box-shadow:var(--shadow); }
    .mini-card .mini-label { font-size:12px; color:var(--muted); text-transform:uppercase; font-weight:800; letter-spacing:.5px; }
    .mini-card .mini-value { font-size:30px; font-weight:900; margin-top:8px; }
    .mini-card.danger .mini-value { color:var(--danger); }
    .mini-card.warn .mini-value { color:var(--warn); }
    .mini-card.ok .mini-value { color:var(--ok); }
    .dash-item, .pendency-item { cursor:pointer; }
    .dash-item:hover, .pendency-item:hover { border-color:var(--accent); box-shadow:0 0 0 3px rgba(21,94,239,.10); }
    .quick-actions { display:grid; gap:10px; }
    .quick-action { display:flex; justify-content:space-between; gap:12px; align-items:center; border:1px solid var(--border); border-radius:14px; padding:14px; background:#fff; cursor:pointer; }
    .quick-action:hover { border-color:var(--accent); }
    .quick-action strong { display:block; font-size:15px; }
    .quick-action small { color:var(--muted); display:block; margin-top:3px; }
    .analysis-section { margin-top:16px; border:1px solid var(--border); border-radius:16px; padding:16px; background:#fff; }
    .history-list, .attachment-list { display:grid; gap:8px; margin-top:10px; }
    .history-item, .attachment-item { border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:13px; color:var(--text); background:var(--bg-soft); }
    .attachment-form { display:grid; grid-template-columns: 1fr 1fr auto; gap:8px; margin-top:10px; }
    .filter-company { min-width:210px; }
    @media (max-width: 700px) { .mini-dashboard { grid-template-columns: 1fr; } .attachment-form { grid-template-columns:1fr; } .filter-company { min-width:100%; } }


    /* V11 - Inteligência e Auditoria */
    .rank-list { display:flex; flex-direction:column; gap:10px; }
    .rank-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:13px 14px; border:1px solid var(--border); border-radius:14px; background:#fff; }
    .rank-row strong { display:block; font-size:14px; color:var(--text); }
    .rank-row small { display:block; font-size:12px; color:var(--muted); margin-top:3px; }
    .rank-num { min-width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:var(--danger-lt); color:var(--danger); font-weight:800; }
    .suggestion-box { display:none; margin-top:14px; padding:16px; border:1px solid var(--border); border-radius:16px; background:#fff; }
    .suggestion-box.show { display:block; }
    .suggestion-title { font-size:12px; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:.08em; margin-bottom:10px; }
    .suggestion-tags { display:flex; flex-wrap:wrap; gap:8px; }
    .suggestion-tag { padding:7px 10px; border-radius:999px; background:var(--accent-lt); color:var(--accent); font-size:12px; font-weight:700; }
    .report-actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }

  </style>
</head>
<body>

<header>
  <div class="brand">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
    Controle de Terceiros
  </div>
  <nav>
    <button class="active" onclick="showPage('dashboard')">Dashboard</button>
    <button onclick="showPage('cadastro')">Cadastro</button>
    <button onclick="showPage('listagem')">Terceiros</button>
    <button onclick="showPage('empresas')">Empresas</button>
    <button onclick="showPage('treinamentos')">Treinamentos</button>
    <button onclick="showPage('dados')">Dados</button>
    <button onclick="showPage('portaria')">Portaria</button>
  </nav>
</header>

<main>

  <section class="hero">
    <div>
      <h1>Controle de Terceiros</h1>
      <p>Base inicial para cadastro de empresas, terceiros, treinamentos obrigatórios, validade de ASO, integração e consulta rápida para portaria.</p>
    </div>
  </section>

  <!-- ═══════════ DASHBOARD ═══════════ -->
  <div id="page-dashboard" class="page active">
    <div class="page-actions">
      <h2>Dashboard</h2>
      <div class="report-actions"><button class="btn btn-ghost" onclick="gerarRelatorioExecutivo()">Exportar relatório</button><button class="btn btn-primary" onclick="showPage('cadastro')">+ Novo Terceiro</button></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total de terceiros</div><div class="stat-value" id="dash-total">0</div></div>
      <div class="stat-card stat-ok"><div class="stat-label">Liberados</div><div class="stat-value" id="dash-liberados">0</div></div>
      <div class="stat-card stat-block"><div class="stat-label">Bloqueados</div><div class="stat-value" id="dash-bloqueados">0</div></div>
      <div class="stat-card stat-company"><div class="stat-label">Empresas</div><div class="stat-value" id="dash-empresas">0</div></div>
    </div>
    <div class="stats-grid" style="margin-top:14px;">
      <div class="stat-card stat-block stat-click" onclick="showPage('pendencias')"><div class="stat-label">Central de Pendências</div><div class="stat-value" id="dash-pendencias">0</div><span class="stat-hint">Toque para ver vencidos e próximos 7 dias</span></div>
      <div class="stat-card stat-company"><div class="stat-label">Treinamentos cadastrados</div><div class="stat-value" id="dash-treinamentos">0</div></div>
      <div class="stat-card stat-ok"><div class="stat-label">Empresas com exigências</div><div class="stat-value" id="dash-empresas-exigencias">0</div></div>
      <div class="stat-card"><div class="stat-label">Status geral</div><div class="stat-value" id="dash-status-geral">OK</div></div>
    </div>
    <div class="mini-dashboard">
      <div class="mini-card danger"><div class="mini-label">ASOs vencidos</div><div class="mini-value" id="exec-aso-vencidos">0</div></div>
      <div class="mini-card danger"><div class="mini-label">Integrações vencidas</div><div class="mini-value" id="exec-integ-vencidas">0</div></div>
      <div class="mini-card warn"><div class="mini-label">Treinos pendentes</div><div class="mini-value" id="exec-treinos-pendentes">0</div></div>
      <div class="mini-card danger"><div class="mini-label">Contratos vencidos</div><div class="mini-value" id="exec-contratos-vencidos">0</div></div>
    </div>
    <div class="card">
      <div class="card-title">Lista de ações</div>
      <div id="dash-lista-acoes" class="quick-actions"></div>
    </div>
    <div class="card">
      <div class="card-title">Empresas com mais pendências</div>
      <div id="dash-ranking-empresas" class="rank-list"></div>
    </div>
    <div class="card">
      <div class="card-title">Terceiros bloqueados / pendentes</div>
      <div id="dash-lista-bloqueados" class="dashboard-list"></div>
    </div>
  </div>

  <!-- ═══════════ PENDÊNCIAS ═══════════ -->
  <div id="page-pendencias" class="page">
    <div class="page-actions">
      <h2>Central de Pendências</h2>
      <button class="btn btn-ghost" onclick="showPage('dashboard')">← Voltar</button>
    </div>
    <div class="pendency-tabs">
      <div class="pendency-pill danger">Vencidos: <span id="pend-count-vencidos">0</span></div>
      <div class="pendency-pill warn">Vencem em até 7 dias: <span id="pend-count-7dias">0</span></div>
      <div class="pendency-pill neutral">Sem data informada: <span id="pend-count-semdata">0</span></div>
    </div>
    <div class="card" style="padding:20px;">
      <div class="card-title">Documentos e treinamentos vencidos</div>
      <div id="pendencias-vencidas-list"></div>
    </div>
    <div class="card" style="padding:20px;">
      <div class="card-title">Vencimentos nos próximos 7 dias</div>
      <div id="pendencias-7dias-list"></div>
    </div>
    <div class="card" style="padding:20px;">
      <div class="card-title">Sem data informada</div>
      <div id="pendencias-semdata-list"></div>
    </div>
  </div>

  <!-- ═══════════ CADASTRO ═══════════ -->
  <div id="page-cadastro" class="page">
    <h2>Novo Terceiro</h2>
    <div class="card">
      <div class="card-title">Dados pessoais</div>
      <div class="form-grid">
        <div>
          <label for="f-nome">Nome completo *</label>
          <input id="f-nome" type="text" placeholder="Ex.: João da Silva" />
        </div>
        <div>
          <label for="f-cpf">CPF *</label>
          <input id="f-cpf" type="text" placeholder="000.000.000-00" maxlength="14" />
        </div>
        <div>
          <label for="f-empresa">Empresa *</label>
          <select id="f-empresa">
            <option value="">Selecione uma empresa...</option>
          </select>
          <small style="display:block;margin-top:6px;color:var(--muted);font-size:12px;">Cadastre a empresa primeiro no menu Empresas.</small>
        </div>
        <div>
          <label for="f-funcao">Função *</label>
          <input id="f-funcao" type="text" placeholder="Ex.: Eletricista" />
        </div>
      </div>
    </div>

    <div id="treinos-exigidos-box" class="required-training-box">
      <div class="required-training-title">Treinamentos exigidos para esta empresa</div>
      <div id="treinos-exigidos-list" class="training-tags"></div>
    </div>

    <div id="sugestoes-funcao-box" class="suggestion-box">
      <div class="suggestion-title">Sugestões pela função informada</div>
      <div id="sugestoes-funcao-list" class="suggestion-tags"></div>
      <small style="display:block;margin-top:10px;color:var(--muted);font-size:12px;">Sugestão automática para apoiar o cadastro. A exigência oficial continua sendo definida no cadastro da empresa.</small>
    </div>

    <div class="card">
      <div class="card-title">Documentação</div>
      <div class="form-grid">
        <div>
          <label for="f-aso">Validade do ASO *</label>
          <input id="f-aso" type="date" />
        </div>
        <div>
          <label for="f-integ">Validade da Integração *</label>
          <input id="f-integ" type="date" />
        </div>
        <div class="full">
          <label for="f-obs">Observação</label>
          <textarea id="f-obs" placeholder="Informações adicionais..."></textarea>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn btn-primary" onclick="salvarTerceiro()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Salvar terceiro
      </button>
      <button class="btn btn-ghost" onclick="limparForm()">Limpar</button>
    </div>
  </div>

  <!-- ═══════════ LISTAGEM ═══════════ -->
  <div id="page-listagem" class="page">
    <h2>Terceiros Cadastrados</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total de terceiros</div><div class="stat-value" id="stat-total">0</div></div>
      <div class="stat-card stat-ok"><div class="stat-label">Liberados</div><div class="stat-value" id="stat-liberados">0</div></div>
      <div class="stat-card stat-block"><div class="stat-label">Bloqueados</div><div class="stat-value" id="stat-bloqueados">0</div></div>
      <div class="stat-card stat-company"><div class="stat-label">Empresas</div><div class="stat-value" id="stat-empresas">0</div></div>
      <div class="stat-card stat-block"><div class="stat-label">Pendências treino</div><div class="stat-value" id="stat-pendencias-treino">0</div></div>
    </div>
    <div class="card" style="padding:18px 20px;">
      <div class="search-row">
        <div class="search-wrap" style="flex:1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="busca-lista" placeholder="Buscar por nome ou CPF…" oninput="renderLista()" />
        </div>
        <select id="filtro-empresa-lista" class="filter-company" onchange="renderLista()"><option value="">Todas as empresas</option></select>
        <button class="btn btn-primary" onclick="showPage('cadastro')">+ Cadastrar</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Empresa</th>
              <th>ASO</th>
              <th>Integração</th>
              <th>Treinamentos</th>
              <th>DP</th>
              <th>SESMT</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tabela-body"></tbody>
        </table>
        <div id="lista-empty" class="empty-state" style="display:none;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p>Nenhum terceiro encontrado.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════ PORTARIA ═══════════ -->
  <div id="page-portaria" class="page">
    <h2>Consulta — Portaria</h2>
    <div class="card">
      <div class="card-title">Buscar terceiro</div>
      <div class="portaria-search">
        <input type="text" id="busca-portaria" placeholder="Digite o nome ou CPF do terceiro…" onkeydown="if(event.key==='Enter') consultarPortaria()" />
        <button class="btn btn-primary" onclick="consultarPortaria()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Consultar
        </button>
      </div>

      <div id="portaria-not-found" class="not-found">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:10px;opacity:.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Nenhum terceiro encontrado para esta busca.</p>
      </div>

      <div id="portaria-matches" class="card" style="display:none;box-shadow:none;margin-top:14px;">
        <div class="card-title">Selecione o terceiro correto</div>
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Encontramos mais de um cadastro parecido. Toque no registro correto para consultar.</p>
        <div id="portaria-matches-list" class="match-list"></div>
      </div>

      <!-- resultado -->
      <div id="portaria-result" class="result-card">
        <div class="result-status">
          <div id="r-icon" class="status-icon">
            <svg id="r-icon-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></svg>
          </div>
          <div>
            <div id="r-status-label" class="status-label"></div>
            <div class="status-sub" id="r-status-sub"></div>
          </div>
        </div>

        <div class="result-info">
          <div class="info-item">
            <label>Nome</label>
            <span id="r-nome"></span>
          </div>
          <div class="info-item">
            <label>Empresa</label>
            <span id="r-empresa"></span>
          </div>
          <div class="info-item">
            <label>Função</label>
            <span id="r-funcao"></span>
          </div>
          <div class="info-item">
            <label>CPF</label>
            <span id="r-cpf" style="font-family:'JetBrains Mono',monospace;font-size:14px;"></span>
          </div>
          <div class="info-item">
            <label>Validade ASO</label>
            <span id="r-aso"></span>
          </div>
          <div class="info-item">
            <label>Validade Integração</label>
            <span id="r-integ"></span>
          </div>
        </div>

        <div class="status-strip" id="r-status-setores" style="display:none;">
          <div id="r-dp-panel" class="status-panel"><h4>Status DP</h4><div id="r-dp-status"></div><ul id="r-dp-motivos" class="analysis-list"></ul></div>
          <div id="r-sesmt-panel" class="status-panel"><h4>Status SESMT</h4><div id="r-sesmt-status"></div><ul id="r-sesmt-motivos" class="analysis-list"></ul></div>
        </div>

        <div id="r-treinos-wrap" style="margin-top:16px;display:none;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);">Treinamentos obrigatórios</label>
          <div id="r-treinos-list" class="training-tags" style="margin-top:8px;"></div>
        </div>

        <div id="r-motivos" class="motivos" style="display:none;">
          <div class="motivos-title">⚠ Motivo(s) do bloqueio</div>
          <ul id="r-motivos-list"></ul>
        </div>

        <div id="r-obs-wrap" style="margin-top:14px;display:none;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);">Observação</label>
          <p id="r-obs" style="margin-top:4px;font-size:14px;color:var(--text);"></p>
        </div>
      </div>
    </div>
  </div>


  <!-- ═══════════ EMPRESAS ═══════════ -->
  <div id="page-empresas" class="page">
    <div class="page-actions">
      <h2>Empresas Cadastradas</h2>
      <button class="btn btn-primary" onclick="abrirModalNovaEmpresa()">+ Nova Empresa</button>
    </div>

    <div class="card" style="padding:18px 20px;">
      <div class="search-row">
        <div class="search-wrap" style="flex:1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="busca-empresas" placeholder="Buscar por razão social, fantasia ou CNPJ…" oninput="renderEmpresas()" />
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Razão Social</th>
              <th>Nome Fantasia</th>
              <th>CNPJ</th>
              <th>Responsável</th>
              <th>Telefone</th>
              <th>Contrato</th>
              <th>DP</th>
              <th>SESMT</th>
              <th>Treinamentos</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tabela-empresas"></tbody>
        </table>
        <div id="empresas-empty" class="empty-state" style="display:none;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          <p>Nenhuma empresa cadastrada.</p>
        </div>
      </div>
    </div>
  </div>



  <!-- ═══════════ TREINAMENTOS ═══════════ -->
  <div id="page-treinamentos" class="page">
    <div class="page-actions">
      <h2>Catálogo de Treinamentos</h2>
      <button class="btn btn-primary" onclick="abrirModalNovoTreinamento()">+ Novo Treinamento</button>
    </div>

    <div class="card" style="padding:18px 20px;">
      <div class="search-row">
        <div class="search-wrap" style="flex:1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="busca-treinamentos" placeholder="Buscar treinamento…" oninput="renderTreinamentos()" />
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Treinamento</th>
              <th>Validade</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tabela-treinamentos"></tbody>
        </table>
        <div id="treinamentos-empty" class="empty-state" style="display:none;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>
          <p>Nenhum treinamento encontrado.</p>
        </div>
      </div>
    </div>
  </div>


  <!-- ═══════════ DADOS / BACKUP / IMPORTAÇÃO ═══════════ -->
  <div id="page-dados" class="page">
    <div class="page-actions">
      <h2>Dados e Importação</h2>
      <button class="btn btn-ghost" onclick="renderDados()">Atualizar resumo</button>
    </div>

    <div class="stats-grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">Terceiros salvos</div><div class="stat-value" id="dados-total-terceiros">0</div></div>
      <div class="stat-card stat-company"><div class="stat-label">Empresas salvas</div><div class="stat-value" id="dados-total-empresas">0</div></div>
      <div class="stat-card stat-ok"><div class="stat-label">Treinamentos</div><div class="stat-value" id="dados-total-treinamentos">0</div></div>
      <div class="stat-card stat-block"><div class="stat-label">Pendências</div><div class="stat-value" id="dados-total-pendencias">0</div></div>
    </div>

    <div class="data-actions">
      <div class="data-box">
        <h3>Backup do sistema</h3>
        <p>Baixa um arquivo com empresas, terceiros, treinamentos e vínculos. Use isso para não perder os cadastros do navegador.</p>
        <button class="btn btn-primary" onclick="exportarBackupJSON()">Baixar backup JSON</button>
        <div class="muted-note">Importante: hoje os dados ficam no navegador via localStorage. Para usar em outro celular ou computador, exporte e importe o backup.</div>
      </div>

      <div class="data-box">
        <h3>Restaurar backup</h3>
        <p>Importa um backup JSON gerado pelo próprio sistema e substitui os dados atuais.</p>
        <input class="file-input" type="file" id="backup-json-file" accept=".json,application/json" onchange="importarBackupJSON(event)">
        <div class="muted-note">Use com cuidado: essa ação troca os cadastros atuais pelos dados do arquivo.</div>
      </div>

      <div class="data-box">
        <h3>Exportar consulta</h3>
        <p>Gera planilhas CSV para abrir no Excel com os cadastros atuais.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="exportarCSVTerceiros()">Terceiros CSV</button>
          <button class="btn btn-ghost" onclick="exportarCSVEmpresas()">Empresas CSV</button>
        </div>
      </div>

      <div class="data-box">
        <h3>Importar planilha Excel</h3>
        <p>Importa uma planilha de controle de terceiros. O sistema tenta localizar colunas como Empresa, Nome do Profissional, CPF, ASO, Integração e Fim Prestação de Serviço.</p>
        <input class="file-input" type="file" id="excel-file" accept=".xlsx,.xls,.csv" onchange="importarPlanilhaExcel(event)">
        <div class="muted-note">Funciona melhor com colunas: Empresa, CNPJ, Nome do Profissional, CPF, Função, ASO, Integração, Fim Prestação Serviço.</div>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="card-title">Modelo recomendado para importação</div>
      <div class="table-wrap">
        <table class="template-table">
          <thead>
            <tr>
              <th>Empresa</th><th>CNPJ</th><th>Nome do Profissional</th><th>CPF</th><th>Função</th><th>ASO</th><th>Integração</th><th>Fim Prestação Serviço</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Landim</td><td>00.000.000/0001-00</td><td>Jonilson Guimarães</td><td>000.000.000-00</td><td>Soldador</td><td>31/12/2026</td><td>31/12/2026</td><td>31/12/2026</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;">
        <button class="btn btn-ghost" onclick="baixarModeloCSV()">Baixar modelo CSV</button>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="card-title">Resultado da importação</div>
      <div id="import-log" class="import-log">Nenhuma importação realizada nesta sessão.</div>
    </div>
  </div>


</main>

<!-- ═══════════ MODAL DE EDIÇÃO ═══════════ -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">Editar Terceiro</span>
      <button class="modal-close" onclick="fecharModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="form-grid">
      <div><label for="e-nome">Nome completo *</label><input id="e-nome" type="text"/></div>
      <div><label for="e-cpf">CPF *</label><input id="e-cpf" type="text" maxlength="14"/></div>
      <div><label for="e-empresa">Empresa *</label><select id="e-empresa"><option value="">Selecione uma empresa...</option></select></div>
      <div><label for="e-funcao">Função *</label><input id="e-funcao" type="text"/></div>
      <div><label for="e-aso">Validade do ASO *</label><input id="e-aso" type="date"/></div>
      <div><label for="e-integ">Validade da Integração *</label><input id="e-integ" type="date"/></div>
      <div class="full"><label>Treinamentos do terceiro</label><small style="display:block;margin-bottom:8px;color:var(--muted);font-size:12px;">Informe a data de realização/conclusão dos treinamentos exigidos pela empresa selecionada.</small><div id="e-treinos-box" class="training-date-grid"></div></div>
      <div class="full"><label for="e-obs">Observação</label><textarea id="e-obs"></textarea></div>
    </div>
    <input type="hidden" id="e-id"/>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicao()">Salvar alterações</button>
    </div>
  </div>
</div>


<!-- ═══════════ MODAL DE EMPRESAS ═══════════ -->
<div class="modal-overlay" id="modal-empresa">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title" id="modal-empresa-title">Nova Empresa</span>
      <button class="modal-close" onclick="fecharModalEmpresa()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="form-grid">
      <div class="full"><label for="emp-razao">Razão Social *</label><input id="emp-razao" type="text" placeholder="Ex.: Construtora ABC Ltda"/></div>
      <div><label for="emp-fantasia">Nome Fantasia</label><input id="emp-fantasia" type="text" placeholder="Ex.: ABC Construções"/></div>
      <div><label for="emp-cnpj">CNPJ *</label><input id="emp-cnpj" type="text" placeholder="00.000.000/0000-00" maxlength="18"/></div>
      <div><label for="emp-resp">Responsável *</label><input id="emp-resp" type="text" placeholder="Nome do responsável"/></div>
      <div><label for="emp-tel">Telefone</label><input id="emp-tel" type="text" placeholder="(00) 00000-0000" maxlength="15"/></div>
      <div><label for="emp-email">E-mail</label><input id="emp-email" type="email" placeholder="contato@empresa.com.br"/></div>
      <div><label for="emp-contrato-inicio">Início da prestação</label><input id="emp-contrato-inicio" type="date"/></div>
      <div><label for="emp-contrato-fim">Fim da prestação</label><input id="emp-contrato-fim" type="date"/></div>
      <div><label for="emp-doc-dp">Validade documentos DP</label><input id="emp-doc-dp" type="date"/></div>
      <div><label for="emp-doc-sesmt">Validade documentos SESMT</label><input id="emp-doc-sesmt" type="date"/></div>
      <div class="full">
        <label>Treinamentos obrigatórios</label>
        <small style="display:block;margin-bottom:8px;color:var(--muted);font-size:12px;">Marque quais treinamentos serão exigidos para terceiros desta empresa.</small>
        <div id="emp-treinamentos-checklist" class="training-grid"></div>
      </div>
    </div>
    <input type="hidden" id="emp-id"/>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="fecharModalEmpresa()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEmpresa()">Salvar empresa</button>
    </div>
  </div>
</div>



<!-- ═══════════ MODAL DE TREINAMENTOS ═══════════ -->
<div class="modal-overlay" id="modal-treinamento">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title" id="modal-treinamento-title">Novo Treinamento</span>
      <button class="modal-close" onclick="fecharModalTreinamento()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="form-grid">
      <div class="full"><label for="tr-nome">Nome do treinamento *</label><input id="tr-nome" type="text" placeholder="Ex.: NR 35 - Trabalho em Altura"/></div>
      <div><label for="tr-validade">Validade em meses *</label><input id="tr-validade" type="number" min="1" max="120" value="12"/></div>
      <div><label for="tr-ativo">Status</label><select id="tr-ativo"><option value="sim">Ativo</option><option value="nao">Inativo</option></select></div>
    </div>
    <input type="hidden" id="tr-id"/>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="fecharModalTreinamento()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarTreinamento()">Salvar treinamento</button>
    </div>
  </div>
</div>



<!-- ═══════════ MODAL DE ANÁLISE DO TERCEIRO ═══════════ -->
<div class="modal-overlay" id="modal-analise">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">Análise do Terceiro</span>
      <button class="modal-close" onclick="fecharModalAnalise()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div id="analise-conteudo"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="fecharModalAnalise()">Fechar</button>
    </div>
  </div>
</div>

<!-- ═══════════ TOAST ═══════════ -->
<div id="toast-container"></div>

<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

<script>
  // ──────────────────────────────────────────────────
  //  STORAGE
  // ──────────────────────────────────────────────────
  function getAll() {
    return JSON.parse(localStorage.getItem('terceiros') || '[]');
  }

  function saveAll(data) {
    localStorage.setItem('terceiros', JSON.stringify(data));
  }

  // ──────────────────────────────────────────────────
  //  UTILS
  // ──────────────────────────────────────────────────
  function hoje() {
    return new Date().toISOString().split('T')[0];
  }

  function isDataValidaSistema(iso) {
    if (!iso || typeof iso !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return false;
    // Datas muito antigas geralmente vêm de planilhas com campo vazio/erro de conversão.
    if (y < 2000) return false;
    const dt = new Date(iso + 'T00:00:00');
    return dt instanceof Date && !isNaN(dt) && dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d;
  }

  function fmtData(iso) {
    if (!isDataValidaSistema(iso)) return 'Data não informada';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function addMonths(iso, months) {
    if (!isDataValidaSistema(iso)) return '';
    const d = new Date(iso + 'T00:00:00');
    d.setMonth(d.getMonth() + Number(months || 12));
    return d.toISOString().split('T')[0];
  }

  function getEmpresaById(id) {
    return (typeof getAllEmpresas === 'function' ? getAllEmpresas() : []).find(e => e.id === id);
  }

  function getTreinamentoById(id) {
    return (typeof getAllTreinamentos === 'function' ? getAllTreinamentos() : []).find(t => t.id === id);
  }

  function getTreinosObrigatoriosDaEmpresa(empresaId) {
    const empresa = getEmpresaById(empresaId);
    const ids = empresa?.treinamentosObrigatorios || [];
    return (typeof getAllTreinamentos === 'function' ? getAllTreinamentos() : [])
      .filter(tr => ids.includes(tr.id) && tr.ativo !== false);
  }

  function getTreinoRealizado(terceiro, treinamentoId) {
    const lista = terceiro?.treinamentosRealizados || [];
    return lista.find(x => x.treinamentoId === treinamentoId);
  }

  function getStatusTreinamentoTerceiro(terceiro, treinamento) {
    const reg = getTreinoRealizado(terceiro, treinamento.id);
    if (!reg || !isDataValidaSistema(reg.data)) return { ok:false, label:'Sem data', motivo:`${treinamento.nome} sem data cadastrada`, semData:true };
    const venc = addMonths(reg.data, treinamento.validade || 12);
    if (!isDataValidaSistema(venc)) return { ok:false, label:'Sem data', motivo:`${treinamento.nome} com data inválida`, semData:true };
    if (venc < hoje()) return { ok:false, label:'Vencido', motivo:`${treinamento.nome} vencido em ${fmtData(venc)}`, vencimento:venc };
    return { ok:true, label:'OK', motivo:'', vencimento:venc };
  }

  function statusData(iso) {
    if (!isDataValidaSistema(iso)) return { classe:'neutral', label:'Sem data', texto:'Data não informada', dias:null, semData:true };
    const dias = diffDias(iso);
    if (dias < 0) return { classe:'blocked', label:'Vencido', texto:`Vencido em ${fmtData(iso)}`, dias };
    if (dias <= 30) return { classe:'warn', label:'Vencendo', texto:`Vence em ${fmtData(iso)} (${dias} dia(s))`, dias };
    return { classe:'ok', label:'OK', texto:`Válido até ${fmtData(iso)}`, dias };
  }

  function badgeStatus(label, classe) {
    const cls = classe === 'blocked' ? 'badge-blocked' : (classe === 'warn' ? 'badge-warn' : 'badge-ok');
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function tagData(iso) {
    const st = statusData(iso);
    if (st.semData) return `<span class="tag-warn">SEM DATA</span>`;
    const cls = st.classe === 'blocked' ? 'tag-venc' : (st.classe === 'warn' ? 'tag-warn' : 'tag-ok');
    const label = st.classe === 'blocked' ? 'VENCIDO' : (st.classe === 'warn' ? 'VENCE' : 'OK');
    return `<span class="${cls}">${label}</span>`;
  }

  function getStatusDP(t) {
    const motivos = [];
    const avisos = [];
    const empresa = getEmpresaById(t.empresaId);
    if (!empresa) {
      motivos.push('Empresa não vinculada ao cadastro');
      return { ok:false, motivos, avisos };
    }

    const contrato = statusData(empresa.contratoFim);
    if (contrato.semData) motivos.push('Fim da prestação de serviço sem data informada');
    else if (contrato.classe === 'blocked') motivos.push('Fim da prestação de serviço vencido em ' + fmtData(empresa.contratoFim));
    else if (contrato.classe === 'warn') avisos.push('Fim da prestação de serviço ' + contrato.texto.toLowerCase());

    const docDP = statusData(empresa.docDPValidade);
    if (docDP.semData) motivos.push('Documentos DP sem data informada');
    else if (docDP.classe === 'blocked') motivos.push('Documentos DP vencidos em ' + fmtData(empresa.docDPValidade));
    else if (docDP.classe === 'warn') avisos.push('Documentos DP ' + docDP.texto.toLowerCase());

    return { ok: motivos.length === 0, motivos, avisos };
  }

  function getStatusSESMT(t) {
    const h = hoje();
    const motivos = [];
    const avisos = [];
    const empresa = getEmpresaById(t.empresaId);

    const asoStatus = statusData(t.aso);
    if (asoStatus.semData) motivos.push('ASO sem data informada');
    else if (asoStatus.classe === 'blocked') motivos.push('ASO vencido em ' + fmtData(t.aso));
    else if (asoStatus.classe === 'warn') avisos.push('ASO ' + asoStatus.texto.toLowerCase());

    const integStatus = statusData(t.integ);
    if (integStatus.semData) motivos.push('Integração sem data informada');
    else if (integStatus.classe === 'blocked') motivos.push('Integração vencida em ' + fmtData(t.integ));
    else if (integStatus.classe === 'warn') avisos.push('Integração ' + integStatus.texto.toLowerCase());

    if (empresa) {
      const docSESMT = statusData(empresa.docSESMTValidade);
      if (docSESMT.semData) motivos.push('Documentos SESMT sem data informada');
      else if (docSESMT.classe === 'blocked') motivos.push('Documentos SESMT vencidos em ' + fmtData(empresa.docSESMTValidade));
      else if (docSESMT.classe === 'warn') avisos.push('Documentos SESMT ' + docSESMT.texto.toLowerCase());
    }

    const obrigatorios = getTreinosObrigatoriosDaEmpresa(t.empresaId);
    obrigatorios.forEach(tr => {
      const st = getStatusTreinamentoTerceiro(t, tr);
      if (!st.ok) motivos.push(st.motivo);
      else if (st.vencimento && statusData(st.vencimento).classe === 'warn') avisos.push(`${tr.nome} ${statusData(st.vencimento).texto.toLowerCase()}`);
    });

    return { ok: motivos.length === 0, motivos, avisos };
  }

  function getStatus(t) {
    const dp = getStatusDP(t);
    const sesmt = getStatusSESMT(t);
    const motivos = [...dp.motivos, ...sesmt.motivos];
    const avisos = [...dp.avisos, ...sesmt.avisos];
    return { ok: motivos.length === 0, motivos, avisos, dp, sesmt };
  }

  function maskCPF(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
    return v;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ──────────────────────────────────────────────────
  //  NAVEGAÇÃO
  // ──────────────────────────────────────────────────
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('nav button').forEach((b, i) => {
      const pages = ['dashboard','cadastro','listagem','empresas','treinamentos','dados','portaria'];
      b.classList.toggle('active', pages[i] === name);
    });
    document.getElementById('page-' + name).classList.add('active');
    if (name === 'dashboard') renderDashboard();
    if (name === 'pendencias') renderPendencias();
    if (name === 'listagem') renderLista();
    if (name === 'empresas') renderEmpresas();
    if (name === 'treinamentos') renderTreinamentos();
    if (name === 'dados') renderDados();
    if (name === 'cadastro') { popularSelectEmpresas('f-empresa'); renderTreinosExigidosCadastro(); }
  }

  // ──────────────────────────────────────────────────
  //  CPF MASK
  // ──────────────────────────────────────────────────
  document.getElementById('f-cpf').addEventListener('input', function() {
    this.value = maskCPF(this.value);
  });
  document.getElementById('e-cpf').addEventListener('input', function() {
    this.value = maskCPF(this.value);
  });
  document.getElementById('f-empresa').addEventListener('change', renderTreinosExigidosCadastro);
  document.getElementById('e-empresa').addEventListener('change', function(){ renderTreinosEdicao(); });



  function coletarTreinamentosDoFormulario(prefixo) {
    return Array.from(document.querySelectorAll(`.${prefixo}-treino-data`))
      .map(input => ({ treinamentoId: input.dataset.treinamentoId, data: input.value }))
      .filter(x => x.treinamentoId && x.data);
  }

  function renderCamposTreinamentos(containerId, empresaId, realizados, classeInput) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const obrigatorios = getTreinosObrigatoriosDaEmpresa(empresaId);
    realizados = realizados || [];

    if (!empresaId) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Selecione uma empresa para visualizar os treinamentos exigidos.</p>';
      return;
    }

    if (!obrigatorios.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Esta empresa não possui treinamentos obrigatórios vinculados.</p>';
      return;
    }

    wrap.innerHTML = obrigatorios.map(tr => {
      const reg = realizados.find(x => x.treinamentoId === tr.id) || {};
      const venc = reg.data ? addMonths(reg.data, tr.validade || 12) : '';
      const status = !reg.data ? '<span class="status-mini warn">Pendente</span>' : (venc < hoje() ? '<span class="status-mini blocked">Vencido</span>' : '<span class="status-mini ok">OK</span>');
      return `
        <div class="training-date-card">
          <strong>${tr.nome} ${status}</strong>
          <input type="date" class="${classeInput}" data-treinamento-id="${tr.id}" value="${reg.data || ''}">
          <small>Validade: ${tr.validade || 12} meses${venc ? ' | Vence em ' + fmtData(venc) : ''}</small>
        </div>`;
    }).join('');
  }

  // ──────────────────────────────────────────────────
  //  CADASTRO
  // ──────────────────────────────────────────────────
  function salvarTerceiro() {
    const nome   = document.getElementById('f-nome').value.trim();
    const cpf    = document.getElementById('f-cpf').value.trim();
    const empSel = document.getElementById('f-empresa');
    const empresaId = empSel.value;
    const empresa = empSel.options[empSel.selectedIndex]?.text || '';
    const funcao = document.getElementById('f-funcao').value.trim();
    const aso    = document.getElementById('f-aso').value;
    const integ  = document.getElementById('f-integ').value;
    const obs    = document.getElementById('f-obs').value.trim();
    const treinamentosRealizados = coletarTreinamentosDoFormulario('f');

    if (!nome || !cpf || !empresaId || !funcao || !aso || !integ) {
      toast('⚠ Preencha todos os campos obrigatórios.');
      return;
    }

    const lista = getAll();
    const cpfLimpo = cpf.replace(/\D/g, '');
    const duplicado = lista.find(t => t.cpf.replace(/\D/g, '') === cpfLimpo);
    if (duplicado) {
      toast('⚠ Já existe um terceiro com este CPF.');
      return;
    }

    lista.push({ id: uid(), nome, cpf, empresaId, empresa, funcao, aso, integ, obs, treinamentosRealizados });
    saveAll(lista);
    limparForm();
    toast('✓ Terceiro cadastrado com sucesso!');
  }

  function limparForm() {
    ['f-nome','f-cpf','f-empresa','f-funcao','f-aso','f-integ','f-obs'].forEach(id => {
      document.getElementById(id).value = '';
    });
    renderTreinosExigidosCadastro();
  }

  function diffDias(iso) {
    if (!isDataValidaSistema(iso)) return null;
    const base = new Date(hoje() + 'T00:00:00');
    const alvo = new Date(iso + 'T00:00:00');
    return Math.ceil((alvo - base) / 86400000);
  }

  function montarPendencias() {
    const vencidas = [];
    const proximas = [];
    const semData = [];

    getAll().forEach(t => {
      const addPend = (tipo, item, vencimento, detalheExtra, origem) => {
        const pend = { terceiroId:t.id, terceiro:t.nome, empresa:t.empresa || 'Sem empresa', cpf:t.cpf || 'Sem CPF', tipo, item, vencimento, dias:null, detalheExtra:detalheExtra || '', origem:origem || '' };
        if (!isDataValidaSistema(vencimento)) {
          semData.push(pend);
          return;
        }
        const dias = diffDias(vencimento);
        pend.dias = dias;
        if (dias < 0) vencidas.push(pend);
        else if (dias <= 7) proximas.push(pend);
      };

      const empresaObj = getEmpresaById(t.empresaId);
      if (empresaObj) {
        addPend('DP', 'Fim da prestação de serviço', empresaObj.contratoFim, 'Regra da empresa: bloqueia todos os terceiros vinculados');
        addPend('DP', 'Documentos DP', empresaObj.docDPValidade, 'Documentação sob responsabilidade do DP');
        addPend('SESMT', 'Documentos SESMT da empresa', empresaObj.docSESMTValidade, 'Documentação da empresa sob responsabilidade do SESMT');
      } else {
        semData.push({ terceiroId:t.id, terceiro:t.nome, empresa:t.empresa || 'Sem empresa', cpf:t.cpf || 'Sem CPF', tipo:'DP', item:'Empresa vinculada', vencimento:'', dias:null, detalheExtra:'Cadastro sem empresa vinculada' });
      }

      addPend('SESMT', 'ASO', t.aso, 'Documento ocupacional');
      addPend('SESMT', 'Integração', t.integ, 'Integração obrigatória');

      getTreinosObrigatoriosDaEmpresa(t.empresaId).forEach(tr => {
        const reg = getTreinoRealizado(t, tr.id);
        if (!reg || !isDataValidaSistema(reg.data)) {
          semData.push({ terceiroId:t.id, terceiro:t.nome, empresa:t.empresa || 'Sem empresa', cpf:t.cpf || 'Sem CPF', tipo:'Treinamento', item:tr.nome, vencimento:'', dias:null, detalheExtra:'Treinamento obrigatório sem data cadastrada' });
          return;
        }
        const venc = addMonths(reg.data, tr.validade || 12);
        addPend('Treinamento', tr.nome, venc, `Validade: ${tr.validade || 12} meses`);
      });
    });

    vencidas.sort((a,b) => (a.vencimento || '9999-99-99').localeCompare(b.vencimento || '9999-99-99'));
    proximas.sort((a,b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    semData.sort((a,b) => (a.terceiro || '').localeCompare(b.terceiro || ''));
    return { vencidas, proximas, semData, total: vencidas.length + proximas.length + semData.length };
  }

  function renderPendenciaItem(p, classe) {
    const quando = p.dias === null
      ? 'Sem data cadastrada'
      : (p.dias < 0 ? `Venceu em ${fmtData(p.vencimento)} (${Math.abs(p.dias)} dia(s) atrás)` : `Vence em ${fmtData(p.vencimento)} (faltam ${p.dias} dia(s))`);
    return `
      <div class="pendency-item" role="button" tabindex="0" onclick="${p.terceiroId ? `abrirAnalise('${p.terceiroId}')` : ''}" onkeydown="if(event.key==='Enter'||event.key===' '){${p.terceiroId ? `abrirAnalise('${p.terceiroId}')` : ''}}">
        <div>
          <strong>${p.terceiro}</strong>
          <small>${p.empresa} • ${p.cpf}</small>
          <small>${p.tipo}: ${p.item}</small>
        </div>
        <div class="pendency-detail ${classe}">${quando}${p.detalheExtra ? '<br>' + p.detalheExtra : ''}</div>
      </div>`;
  }

  function renderPendencias() {
    const dados = montarPendencias();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('pend-count-vencidos', dados.vencidas.length);
    set('pend-count-7dias', dados.proximas.length);
    set('pend-count-semdata', dados.semData.length);

    const vencWrap = document.getElementById('pendencias-vencidas-list');
    const proxWrap = document.getElementById('pendencias-7dias-list');
    const semDataWrap = document.getElementById('pendencias-semdata-list');
    if (vencWrap) vencWrap.innerHTML = dados.vencidas.length
      ? dados.vencidas.map(p => renderPendenciaItem(p, 'danger')).join('')
      : '<p style="font-size:14px;color:var(--muted);">Nenhuma pendência vencida encontrada.</p>';
    if (proxWrap) proxWrap.innerHTML = dados.proximas.length
      ? dados.proximas.map(p => renderPendenciaItem(p, 'warn')).join('')
      : '<p style="font-size:14px;color:var(--muted);">Nenhum vencimento nos próximos 7 dias.</p>';
    if (semDataWrap) semDataWrap.innerHTML = dados.semData.length
      ? dados.semData.map(p => renderPendenciaItem(p, 'neutral')).join('')
      : '<p style="font-size:14px;color:var(--muted);">Nenhum cadastro com data não informada.</p>';
  }

  // ──────────────────────────────────────────────────
  //  RESUMO / STATS
  // ──────────────────────────────────────────────────
  function atualizarStats() {
    const terceiros = getAll();
    const empresas = (typeof getAllEmpresas === 'function') ? getAllEmpresas() : [];
    const treinamentos = (typeof getAllTreinamentos === 'function') ? getAllTreinamentos() : [];
    const liberados = terceiros.filter(t => getStatus(t).ok).length;
    const bloqueados = terceiros.length - liberados;
    const pendenciasTreino = terceiros.reduce((acc, t) => {
      return acc + getTreinosObrigatoriosDaEmpresa(t.empresaId).filter(tr => !getStatusTreinamentoTerceiro(t, tr).ok).length;
    }, 0);
    const empresasComExigencias = empresas.filter(e => (e.treinamentosObrigatorios || []).length > 0).length;
    const pendenciasGerais = montarPendencias().total;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('stat-total', terceiros.length);
    set('stat-liberados', liberados);
    set('stat-bloqueados', bloqueados);
    set('stat-empresas', empresas.length);
    set('stat-pendencias-treino', pendenciasTreino);

    set('dash-total', terceiros.length);
    set('dash-liberados', liberados);
    set('dash-bloqueados', bloqueados);
    set('dash-empresas', empresas.length);
    set('dash-pendencias', pendenciasGerais);
    set('dash-treinamentos', treinamentos.length);
    set('dash-empresas-exigencias', empresasComExigencias);
    set('dash-status-geral', bloqueados === 0 ? 'OK' : 'ATENÇÃO');
  }

  function renderDashboard() {
    atualizarStats();
    const wrap = document.getElementById('dash-lista-bloqueados');
    if (!wrap) return;
    const bloqueados = getAll().map(t => ({...t, status:getStatus(t)})).filter(t => !t.status.ok);
    if (!bloqueados.length) {
      wrap.innerHTML = '<p style="font-size:14px;color:var(--muted);">Nenhum terceiro bloqueado ou pendente no momento.</p>';
      return;
    }
    wrap.innerHTML = bloqueados.map(t => `
      <div class="dash-item" role="button" tabindex="0" onclick="abrirAnalise('${t.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){abrirAnalise('${t.id}')}">
        <div><strong>${t.nome}</strong><small>${t.empresa || 'Sem empresa'} • ${t.cpf || 'CPF não informado'}</small></div>
        <div class="dash-motivos">${t.status.motivos.slice(0,3).join('<br>')}</div>
      </div>`).join('');
  }

  // ──────────────────────────────────────────────────
  //  LISTAGEM
  // ──────────────────────────────────────────────────
  function renderLista() {
    atualizarStats();
    const q = document.getElementById('busca-lista').value.toLowerCase().trim();
    let lista = getAll();
    if (q) lista = lista.filter(t =>
      t.nome.toLowerCase().includes(q) || t.cpf.replace(/\D/g,'').includes(q.replace(/\D/g,''))
    );

    const tbody = document.getElementById('tabela-body');
    const empty = document.getElementById('lista-empty');
    tbody.innerHTML = '';

    if (!lista.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    lista.forEach(t => {
      const { ok, motivos } = getStatus(t);
      const badge = ok
        ? `<span class="badge badge-ok">✓ Liberado</span>`
        : `<span class="badge badge-blocked">✕ Bloqueado</span>`;
      const h = hoje();
      const asoTag  = t.aso  < h ? `<span class="tag-venc">VENCIDO</span>` : `<span class="tag-ok">OK</span>`;
      const integTag= t.integ< h ? `<span class="tag-venc">VENCIDO</span>` : `<span class="tag-ok">OK</span>`;
      const obrig = getTreinosObrigatoriosDaEmpresa(t.empresaId);
      const pend = obrig.filter(tr => !getStatusTreinamentoTerceiro(t, tr).ok).length;
      const treinoBadge = obrig.length === 0 ? '<span class="badge badge-warn">Sem exigência</span>' : (pend === 0 ? `<span class="badge badge-ok">${obrig.length}/${obrig.length} OK</span>` : `<span class="badge badge-blocked">${pend} pendência(s)</span>`);
      const stDP = getStatusDP(t);
      const stSESMT = getStatusSESMT(t);
      const dpBadge = stDP.ok ? '<span class="badge badge-ok">DP OK</span>' : '<span class="badge badge-blocked">DP Bloq.</span>';
      const sesmtBadge = stSESMT.ok ? '<span class="badge badge-ok">SESMT OK</span>' : '<span class="badge badge-blocked">SESMT Bloq.</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-name">${t.nome}</td>
        <td class="td-cpf">${t.cpf}</td>
        <td class="td-company">${t.empresa}</td>
        <td>${fmtData(t.aso)}${asoTag}</td>
        <td>${fmtData(t.integ)}${integTag}</td>
        <td>${treinoBadge}</td>
        <td>${dpBadge}</td>
        <td>${sesmtBadge}</td>
        <td>${badge}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;" onclick="abrirAnalise('${t.id}')">Analisar</button>
            <button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;" onclick="abrirEdicao('${t.id}')">Editar</button>
            <button class="btn btn-danger" style="padding:5px 12px;font-size:12px;" onclick="excluir('${t.id}')">Excluir</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function excluir(id) {
    if (!confirm('Deseja excluir este terceiro?')) return;
    saveAll(getAll().filter(t => t.id !== id));
    renderLista();
    toast('Terceiro removido.');
  }

  // ──────────────────────────────────────────────────
  //  EDIÇÃO
  // ──────────────────────────────────────────────────
  function abrirEdicao(id) {
    const t = getAll().find(t => t.id === id);
    if (!t) return;
    popularSelectEmpresas('e-empresa', t.empresaId || '');
    document.getElementById('e-id').value     = t.id;
    document.getElementById('e-nome').value   = t.nome;
    document.getElementById('e-cpf').value    = t.cpf;
    if (!t.empresaId && t.empresa) {
      const sel = document.getElementById('e-empresa');
      const opt = Array.from(sel.options).find(o => o.textContent === t.empresa);
      if (opt) sel.value = opt.value;
    }
    document.getElementById('e-funcao').value = t.funcao;
    document.getElementById('e-aso').value    = t.aso;
    document.getElementById('e-integ').value  = t.integ;
    document.getElementById('e-obs').value    = t.obs;
    renderTreinosEdicao(t);
    document.getElementById('modal').classList.add('open');
  }

  function fecharModal() {
    document.getElementById('modal').classList.remove('open');
  }

  function renderTreinosEdicao(terceiro) {
    const sel = document.getElementById('e-empresa');
    const empresaId = sel ? sel.value : '';
    const realizados = terceiro?.treinamentosRealizados || [];
    renderCamposTreinamentos('e-treinos-box', empresaId, realizados, 'e-treino-data');
  }

  function salvarEdicao() {
    const id     = document.getElementById('e-id').value;
    const nome   = document.getElementById('e-nome').value.trim();
    const cpf    = document.getElementById('e-cpf').value.trim();
    const empSel = document.getElementById('e-empresa');
    const empresaId = empSel.value;
    const empresa = empSel.options[empSel.selectedIndex]?.text || '';
    const funcao = document.getElementById('e-funcao').value.trim();
    const aso    = document.getElementById('e-aso').value;
    const integ  = document.getElementById('e-integ').value;
    const obs    = document.getElementById('e-obs').value.trim();
    const treinamentosRealizados = coletarTreinamentosDoFormulario('e');

    if (!nome || !cpf || !empresaId || !funcao || !aso || !integ) {
      toast('⚠ Preencha todos os campos obrigatórios.'); return;
    }

    const lista = getAll().map(t => t.id === id ? { ...t, nome, cpf, empresaId, empresa, funcao, aso, integ, obs, treinamentosRealizados } : t);
    saveAll(lista);
    fecharModal();
    renderLista();
    toast('✓ Alterações salvas!');
  }

  // fechar modal ao clicar fora
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) fecharModal();
  });



  // ──────────────────────────────────────────────────
  //  TREINAMENTOS — CATÁLOGO PADRÃO
  // ──────────────────────────────────────────────────
  const TREINAMENTOS_PADRAO = [
    'Integração', 'Política de SST', 'Uso de EPIs', 'NR 01', 'NR 05 - CIPA', 'NR 06 - EPI',
    'NR 10 Básico', 'NR 10 SEP', 'NR 11 - Empilhadeira', 'NR 11 - Ponte Rolante',
    'NR 12 - Máquinas e Equipamentos', 'NR 13 - Caldeiras e Vasos de Pressão',
    'NR 18 - Construção Civil', 'NR 20 - Inflamáveis e Combustíveis',
    'NR 23 - Combate a Incêndio', 'NR 33 - Trabalhador Autorizado', 'NR 33 - Vigia',
    'NR 33 - Supervisor', 'NR 35 - Trabalho em Altura', 'Brigada de Incêndio',
    'Primeiros Socorros', 'Direção Defensiva', 'Operador de PTA', 'Operador de Munck',
    'Operador de Guindaste', 'Operador de Retroescavadeira', 'Operador de Escavadeira',
    'Soldagem', 'Trabalho a Quente'
  ];

  function getAllTreinamentos() {
    return JSON.parse(localStorage.getItem('treinamentos') || '[]');
  }

  function saveAllTreinamentos(data) {
    localStorage.setItem('treinamentos', JSON.stringify(data));
  }

  function inicializarTreinamentosPadrao() {
    const atuais = getAllTreinamentos();
    if (atuais.length) return;
    const padrao = TREINAMENTOS_PADRAO.map(nome => ({ id: uid(), nome, validade: 12, ativo: true }));
    saveAllTreinamentos(padrao);
  }

  function treinamentosAtivos() {
    return getAllTreinamentos().filter(t => t.ativo !== false);
  }

  function abrirModalNovoTreinamento() {
    document.getElementById('modal-treinamento-title').textContent = 'Novo Treinamento';
    document.getElementById('tr-id').value = '';
    document.getElementById('tr-nome').value = '';
    document.getElementById('tr-validade').value = 12;
    document.getElementById('tr-ativo').value = 'sim';
    document.getElementById('modal-treinamento').classList.add('open');
  }

  function abrirModalEditarTreinamento(id) {
    const t = getAllTreinamentos().find(t => t.id === id);
    if (!t) return;
    document.getElementById('modal-treinamento-title').textContent = 'Editar Treinamento';
    document.getElementById('tr-id').value = t.id;
    document.getElementById('tr-nome').value = t.nome;
    document.getElementById('tr-validade').value = t.validade || 12;
    document.getElementById('tr-ativo').value = t.ativo === false ? 'nao' : 'sim';
    document.getElementById('modal-treinamento').classList.add('open');
  }

  function fecharModalTreinamento() {
    document.getElementById('modal-treinamento').classList.remove('open');
  }

  document.getElementById('modal-treinamento').addEventListener('click', function(e) {
    if (e.target === this) fecharModalTreinamento();
  });

  function salvarTreinamento() {
    const id = document.getElementById('tr-id').value;
    const nome = document.getElementById('tr-nome').value.trim();
    const validade = parseInt(document.getElementById('tr-validade').value, 10);
    const ativo = document.getElementById('tr-ativo').value === 'sim';

    if (!nome || !validade || validade < 1) {
      toast('⚠ Informe nome e validade do treinamento.');
      return;
    }

    let lista = getAllTreinamentos();
    const nomeNorm = nome.toLowerCase();
    const duplicado = lista.find(t => t.nome.toLowerCase() === nomeNorm && t.id !== id);
    if (duplicado) {
      toast('⚠ Já existe um treinamento com este nome.');
      return;
    }

    if (id) {
      lista = lista.map(t => t.id === id ? { ...t, nome, validade, ativo } : t);
      toast('✓ Treinamento atualizado!');
    } else {
      lista.push({ id: uid(), nome, validade, ativo });
      toast('✓ Treinamento cadastrado!');
    }
    saveAllTreinamentos(lista);
    fecharModalTreinamento();
    renderTreinamentos();
    renderChecklistTreinamentosEmpresa();
    renderTreinosExigidosCadastro();
  }

  function alternarTreinamento(id) {
    const lista = getAllTreinamentos().map(t => t.id === id ? { ...t, ativo: !(t.ativo !== false) } : t);
    saveAllTreinamentos(lista);
    renderTreinamentos();
    renderChecklistTreinamentosEmpresa();
    renderTreinosExigidosCadastro();
  }

  function renderTreinamentos() {
    const q = (document.getElementById('busca-treinamentos')?.value || '').toLowerCase().trim();
    let lista = getAllTreinamentos();
    if (q) lista = lista.filter(t => t.nome.toLowerCase().includes(q));

    const tbody = document.getElementById('tabela-treinamentos');
    const empty = document.getElementById('treinamentos-empty');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    lista.forEach(t => {
      const ativo = t.ativo !== false;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-name">${t.nome}</td>
        <td>${t.validade || 12} meses</td>
        <td>${ativo ? '<span class="badge badge-ok">Ativo</span>' : '<span class="badge badge-blocked">Inativo</span>'}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;" onclick="abrirModalEditarTreinamento('${t.id}')">Editar</button>
            <button class="btn ${ativo ? 'btn-danger' : 'btn-ghost'}" style="padding:5px 12px;font-size:12px;" onclick="alternarTreinamento('${t.id}')">${ativo ? 'Desativar' : 'Ativar'}</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function renderChecklistTreinamentosEmpresa(selectedIds) {
    const wrap = document.getElementById('emp-treinamentos-checklist');
    if (!wrap) return;
    selectedIds = selectedIds || [];
    const lista = treinamentosAtivos();
    if (!lista.length) {
      wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);">Nenhum treinamento ativo encontrado.</p>';
      return;
    }
    wrap.innerHTML = lista.map(t => `
      <label class="check-card">
        <input type="checkbox" class="emp-treino-check" value="${t.id}" ${selectedIds.includes(t.id) ? 'checked' : ''}>
        <span><strong>${t.nome}</strong><small>Validade padrão: ${t.validade || 12} meses</small></span>
      </label>`).join('');
  }

  function getTreinamentosSelecionadosEmpresa() {
    return Array.from(document.querySelectorAll('.emp-treino-check:checked')).map(c => c.value);
  }

  function renderTreinosExigidosCadastro() {
    const sel = document.getElementById('f-empresa');
    const box = document.getElementById('treinos-exigidos-box');
    const list = document.getElementById('treinos-exigidos-list');
    if (!sel || !box || !list) return;

    if (!sel.value) {
      box.classList.remove('show');
      list.innerHTML = '';
      return;
    }

    box.classList.add('show');
    renderCamposTreinamentos('treinos-exigidos-list', sel.value, [], 'f-treino-data');
  }

  // ──────────────────────────────────────────────────
  //  EMPRESAS — STORAGE
  // ──────────────────────────────────────────────────
  function getAllEmpresas() {
    return JSON.parse(localStorage.getItem('empresas') || '[]');
  }

  function saveAllEmpresas(data) {
    localStorage.setItem('empresas', JSON.stringify(data));
  }

  function popularSelectEmpresas(selectId, selectedId) {
    const sel = document.getElementById(selectId || 'f-empresa');
    if (!sel) return;
    const empresas = getAllEmpresas();
    sel.innerHTML = '<option value="">Selecione uma empresa...</option>';
    empresas.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.fantasia ? `${e.razao} (${e.fantasia})` : e.razao;
      if (selectedId && e.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function maskCNPJ(v) {
    v = v.replace(/\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    return v;
  }

  function maskTel(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    return v;
  }

  document.getElementById('emp-cnpj').addEventListener('input', function() { this.value = maskCNPJ(this.value); });
  document.getElementById('emp-tel').addEventListener('input',  function() { this.value = maskTel(this.value); });

  function abrirModalNovaEmpresa() {
    document.getElementById('modal-empresa-title').textContent = 'Nova Empresa';
    document.getElementById('emp-id').value = '';
    ['emp-razao','emp-fantasia','emp-cnpj','emp-resp','emp-tel','emp-email','emp-contrato-inicio','emp-contrato-fim','emp-doc-dp','emp-doc-sesmt'].forEach(id => {
      document.getElementById(id).value = '';
    });
    renderChecklistTreinamentosEmpresa([]);
    document.getElementById('modal-empresa').classList.add('open');
  }

  function abrirModalEditarEmpresa(id) {
    const e = getAllEmpresas().find(e => e.id === id);
    if (!e) return;
    document.getElementById('modal-empresa-title').textContent = 'Editar Empresa';
    document.getElementById('emp-id').value       = e.id;
    document.getElementById('emp-razao').value    = e.razao;
    document.getElementById('emp-fantasia').value = e.fantasia || '';
    document.getElementById('emp-cnpj').value     = e.cnpj;
    document.getElementById('emp-resp').value     = e.resp;
    document.getElementById('emp-tel').value      = e.tel || '';
    document.getElementById('emp-email').value    = e.email || '';
    document.getElementById('emp-contrato-inicio').value = e.contratoInicio || '';
    document.getElementById('emp-contrato-fim').value    = e.contratoFim || '';
    document.getElementById('emp-doc-dp').value          = e.docDPValidade || '';
    document.getElementById('emp-doc-sesmt').value       = e.docSESMTValidade || '';
    renderChecklistTreinamentosEmpresa(e.treinamentosObrigatorios || []);
    document.getElementById('modal-empresa').classList.add('open');
  }

  function fecharModalEmpresa() {
    document.getElementById('modal-empresa').classList.remove('open');
  }

  document.getElementById('modal-empresa').addEventListener('click', function(e) {
    if (e.target === this) fecharModalEmpresa();
  });

  function salvarEmpresa() {
    const id       = document.getElementById('emp-id').value;
    const razao    = document.getElementById('emp-razao').value.trim();
    const fantasia = document.getElementById('emp-fantasia').value.trim();
    const cnpj     = document.getElementById('emp-cnpj').value.trim();
    const resp     = document.getElementById('emp-resp').value.trim();
    const tel      = document.getElementById('emp-tel').value.trim();
    const email    = document.getElementById('emp-email').value.trim();
    const contratoInicio = document.getElementById('emp-contrato-inicio').value;
    const contratoFim    = document.getElementById('emp-contrato-fim').value;
    const docDPValidade  = document.getElementById('emp-doc-dp').value;
    const docSESMTValidade = document.getElementById('emp-doc-sesmt').value;
    const treinamentosObrigatorios = getTreinamentosSelecionadosEmpresa();

    if (!razao || !cnpj || !resp) {
      toast('⚠ Preencha Razão Social, CNPJ e Responsável.');
      return;
    }

    let lista = getAllEmpresas();

    if (id) {
      lista = lista.map(e => e.id === id ? { ...e, razao, fantasia, cnpj, resp, tel, email, contratoInicio, contratoFim, docDPValidade, docSESMTValidade, treinamentosObrigatorios } : e);
      const terceiros = getAll().map(t => t.empresaId === id ? { ...t, empresa: fantasia ? `${razao} (${fantasia})` : razao } : t);
      saveAll(terceiros);
      toast('✓ Empresa atualizada!');
    } else {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      if (lista.find(e => e.cnpj.replace(/\D/g, '') === cnpjLimpo)) {
        toast('⚠ Já existe uma empresa com este CNPJ.');
        return;
      }
      lista.push({ id: uid(), razao, fantasia, cnpj, resp, tel, email, contratoInicio, contratoFim, docDPValidade, docSESMTValidade, treinamentosObrigatorios });
      toast('✓ Empresa cadastrada!');
    }

    saveAllEmpresas(lista);
    fecharModalEmpresa();
    renderEmpresas();
    popularSelectEmpresas('f-empresa');
    popularSelectEmpresas('e-empresa');
    atualizarStats();
  }

  function renderListaMotivos(titulo, status) {
    const itens = status.motivos.length ? status.motivos : (status.avisos.length ? status.avisos : ['Sem pendências']);
    const classe = status.ok ? 'ok' : 'blocked';
    return `<div class="analysis-card">
      <strong>${titulo} ${status.ok ? '<span class="badge badge-ok">LIBERADO</span>' : '<span class="badge badge-blocked">NEGADO</span>'}</strong>
      <ul class="analysis-list">${itens.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>`;
  }

  function abrirAnalise(id) {
    const t = getAll().find(x => x.id === id);
    if (!t) return;
    const empresa = getEmpresaById(t.empresaId);
    const st = getStatus(t);
    const obrig = getTreinosObrigatoriosDaEmpresa(t.empresaId);
    const treinosHtml = obrig.length ? obrig.map(tr => {
      const ts = getStatusTreinamentoTerceiro(t, tr);
      const reg = getTreinoRealizado(t, tr.id);
      return `<li>${ts.ok ? '✅' : '❌'} ${tr.nome} — ${reg?.data ? 'Realizado em ' + fmtData(reg.data) + ' | vence em ' + fmtData(ts.vencimento) : 'Sem data cadastrada'}</li>`;
    }).join('') : '<li>Empresa sem treinamentos obrigatórios vinculados.</li>';

    document.getElementById('analise-conteudo').innerHTML = `
      <div class="result-status">
        <div class="status-icon ${st.ok ? 'ok' : 'blocked'}"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${st.ok ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}</svg></div>
        <div><div class="status-label ${st.ok ? 'ok' : 'blocked'}">${st.ok ? 'ACESSO LIBERADO' : 'ACESSO NEGADO'}</div><div class="status-sub">${t.nome} • ${t.empresa || 'Sem empresa'}</div></div>
      </div>
      <div class="result-info">
        <div class="info-item"><label>CPF</label><span>${t.cpf}</span></div>
        <div class="info-item"><label>Função</label><span>${t.funcao || '—'}</span></div>
        <div class="info-item"><label>Contrato Empresa</label><span>${empresa?.contratoFim ? fmtData(empresa.contratoFim) + ' ' + tagData(empresa.contratoFim) : 'Não informado'}</span></div>
        <div class="info-item"><label>ASO</label><span>${fmtData(t.aso)} ${tagData(t.aso)}</span></div>
      </div>
      <div class="analysis-grid" style="margin-top:16px;">
        ${renderListaMotivos('DP', st.dp)}
        ${renderListaMotivos('SESMT', st.sesmt)}
      </div>
      <div class="analysis-card" style="margin-top:14px;">
        <strong>Treinamentos exigidos</strong>
        <ul class="analysis-list">${treinosHtml}</ul>
      </div>
    `;
    document.getElementById('modal-analise').classList.add('open');
  }

  function fecharModalAnalise() {
    document.getElementById('modal-analise').classList.remove('open');
  }

  document.getElementById('modal-analise').addEventListener('click', function(e) {
    if (e.target === this) fecharModalAnalise();
  });


  // ──────────────────────────────────────────────────
  //  V10 — Gestão completa: clique nos cards, filtros, histórico, anexos e e-mail
  // ──────────────────────────────────────────────────
  function registrarHistorico(entidade, id, descricao) {
    const log = JSON.parse(localStorage.getItem('historico') || '[]');
    log.unshift({ id: uid(), entidade, entidadeId: id, data: new Date().toISOString(), descricao });
    localStorage.setItem('historico', JSON.stringify(log.slice(0, 1000)));
  }

  function getHistorico(entidade, id) {
    return JSON.parse(localStorage.getItem('historico') || '[]').filter(h => h.entidade === entidade && h.entidadeId === id);
  }

  function getAnexosTerceiro(id) {
    return JSON.parse(localStorage.getItem('anexosTerceiros') || '{}')[id] || [];
  }

  function saveAnexosTerceiro(id, anexos) {
    const all = JSON.parse(localStorage.getItem('anexosTerceiros') || '{}');
    all[id] = anexos;
    localStorage.setItem('anexosTerceiros', JSON.stringify(all));
  }

  function adicionarAnexoTerceiro(id) {
    const tipo = document.getElementById('anexo-tipo')?.value || 'Documento';
    const nome = document.getElementById('anexo-nome')?.value.trim();
    if (!nome) { toast('Informe o nome do documento/anexo.'); return; }
    const anexos = getAnexosTerceiro(id);
    anexos.unshift({ id: uid(), tipo, nome, data: new Date().toISOString() });
    saveAnexosTerceiro(id, anexos);
    registrarHistorico('terceiro', id, `Anexo registrado: ${tipo} - ${nome}`);
    abrirAnalise(id);
    toast('Anexo registrado.');
  }

  function removerAnexoTerceiro(id, anexoId) {
    saveAnexosTerceiro(id, getAnexosTerceiro(id).filter(a => a.id !== anexoId));
    registrarHistorico('terceiro', id, 'Anexo removido.');
    abrirAnalise(id);
  }

  function preencherFiltroEmpresas() {
    const sel = document.getElementById('filtro-empresa-lista');
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas as empresas</option>';
    getAllEmpresas().forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.fantasia ? `${e.razao} (${e.fantasia})` : e.razao;
      sel.appendChild(opt);
    });
    sel.value = atual;
  }

  const _showPageBase = showPage;
  showPage = function(name) {
    _showPageBase(name);
    if (name === 'listagem') preencherFiltroEmpresas();
  };

  const _salvarTerceiroBase = salvarTerceiro;
  salvarTerceiro = function() {
    const antes = getAll().length;
    _salvarTerceiroBase();
    const depois = getAll();
    if (depois.length > antes) {
      registrarHistorico('terceiro', depois[depois.length - 1].id, 'Cadastro inicial do terceiro criado.');
    }
  };

  const _salvarEdicaoBase = salvarEdicao;
  salvarEdicao = function() {
    const id = document.getElementById('e-id')?.value;
    const antigo = getAll().find(t => t.id === id);
    _salvarEdicaoBase();
    const novo = getAll().find(t => t.id === id);
    if (antigo && novo) {
      const diffs = [];
      ['nome','cpf','empresa','funcao','aso','integ'].forEach(c => { if ((antigo[c] || '') !== (novo[c] || '')) diffs.push(`${c}: ${antigo[c] || '—'} → ${novo[c] || '—'}`); });
      registrarHistorico('terceiro', id, diffs.length ? 'Alteração: ' + diffs.join(' | ') : 'Cadastro revisado sem alteração principal.');
    }
  };

  const _salvarEmpresaBase = salvarEmpresa;
  salvarEmpresa = function() {
    const idAntes = document.getElementById('emp-id')?.value;
    _salvarEmpresaBase();
    if (idAntes) registrarHistorico('empresa', idAntes, 'Empresa alterada.');
  };

  function getResumoExecutivo() {
    const terceiros = getAll();
    const empresas = getAllEmpresas();
    const hojeIso = hoje();
    const asoVencidos = terceiros.filter(t => isDataValidaSistema(t.aso) && t.aso < hojeIso).length;
    const integVencidas = terceiros.filter(t => isDataValidaSistema(t.integ) && t.integ < hojeIso).length;
    const treinosPendentes = terceiros.reduce((acc, t) => acc + getTreinosObrigatoriosDaEmpresa(t.empresaId).filter(tr => !getStatusTreinamentoTerceiro(t, tr).ok).length, 0);
    const contratosVencidos = empresas.filter(e => isDataValidaSistema(e.contratoFim) && e.contratoFim < hojeIso).length;
    return { asoVencidos, integVencidas, treinosPendentes, contratosVencidos };
  }

  function renderListaAcoes() {
    const wrap = document.getElementById('dash-lista-acoes');
    if (!wrap) return;
    const r = getResumoExecutivo();
    const itens = [
      { titulo:'ASOs vencidos', qtd:r.asoVencidos, desc:'Terceiros com ASO fora da validade.', acao:"showPage('pendencias')" },
      { titulo:'Integrações vencidas', qtd:r.integVencidas, desc:'Terceiros com integração fora da validade.', acao:"showPage('pendencias')" },
      { titulo:'Treinamentos pendentes/vencidos', qtd:r.treinosPendentes, desc:'Treinamentos obrigatórios sem data ou vencidos.', acao:"showPage('pendencias')" },
      { titulo:'Contratos de empresa vencidos', qtd:r.contratosVencidos, desc:'Empresas com fim de prestação vencido.', acao:"showPage('empresas')" }
    ].filter(i => i.qtd > 0);
    wrap.innerHTML = itens.length ? itens.map(i => `<div class="quick-action" onclick="${i.acao}"><div><strong>${i.titulo}</strong><small>${i.desc}</small></div><span class="badge badge-blocked">${i.qtd}</span></div>`).join('') : '<p style="font-size:14px;color:var(--muted);">Nenhuma ação urgente no momento.</p>';
  }

  const _atualizarStatsBase = atualizarStats;
  atualizarStats = function() {
    _atualizarStatsBase();
    const r = getResumoExecutivo();
    const set = (id,val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('exec-aso-vencidos', r.asoVencidos);
    set('exec-integ-vencidas', r.integVencidas);
    set('exec-treinos-pendentes', r.treinosPendentes);
    set('exec-contratos-vencidos', r.contratosVencidos);
    renderListaAcoes();
  };

  const _renderListaBase = renderLista;
  renderLista = function() {
    preencherFiltroEmpresas();
    const filtro = document.getElementById('filtro-empresa-lista')?.value || '';
    _renderListaBase();
    if (!filtro) return;
    const tbody = document.getElementById('tabela-body');
    if (!tbody) return;
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      const nome = tr.querySelector('.td-name')?.textContent || '';
      const cpf = tr.querySelector('.td-cpf')?.textContent || '';
      const t = getAll().find(x => x.nome === nome && x.cpf === cpf);
      if (t && t.empresaId !== filtro) tr.remove();
    });
    const empty = document.getElementById('lista-empty');
    if (empty && tbody.children.length === 0) empty.style.display = 'block';
  };

  const _montarPendenciasBase = montarPendencias;
  montarPendencias = function() {
    const dados = _montarPendenciasBase();
    ['vencidas','proximas','semData'].forEach(k => dados[k].forEach(p => {
      if (!p.terceiroId) {
        const t = getAll().find(x => (x.nome || '') === (p.terceiro || '') && (x.cpf || '') === (p.cpf || ''));
        if (t) p.terceiroId = t.id;
      }
    }));
    return dados;
  };

  const _renderPendenciaItemBase = renderPendenciaItem;
  renderPendenciaItem = function(p, classe) {
    const html = _renderPendenciaItemBase(p, classe);
    return html.replace('<div class="pendency-item">', `<div class="pendency-item" onclick="${p.terceiroId ? `abrirAnalise('${p.terceiroId}')` : ''}">`);
  };

  const _renderDashboardBase = renderDashboard;
  renderDashboard = function() {
    _renderDashboardBase();
    const wrap = document.getElementById('dash-lista-bloqueados');
    if (!wrap) return;
    const items = wrap.querySelectorAll('.dash-item');
    const bloqueados = getAll().map(t => ({...t, status:getStatus(t)})).filter(t => !t.status.ok);
    items.forEach((el, idx) => { if (bloqueados[idx]) el.setAttribute('onclick', `abrirAnalise('${bloqueados[idx].id}')`); });
  };

  function copiarTexto(texto) {
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => toast('Texto copiado.'));
    else { prompt('Copie o texto:', texto); }
  }

  function gerarTextoEmailTerceiro(id) {
    const t = getAll().find(x => x.id === id);
    if (!t) return '';
    const st = getStatus(t);
    return `Bom dia,\n\nSegue pendência de acesso de terceiro:\n\nTerceiro: ${t.nome}\nEmpresa: ${t.empresa || 'Não informada'}\nCPF: ${t.cpf || 'Não informado'}\nStatus: ${st.ok ? 'LIBERADO' : 'BLOQUEADO'}\n\nMotivos/Pendências:\n- ${st.motivos.length ? st.motivos.join('\n- ') : 'Sem pendências'}\n\nGentileza regularizar para atualização do controle de acesso.\n\nAtt.`;
  }

  const _abrirAnaliseBase = abrirAnalise;
  abrirAnalise = function(id) {
    _abrirAnaliseBase(id);
    const t = getAll().find(x => x.id === id);
    const box = document.getElementById('analise-conteudo');
    if (!t || !box) return;
    const historico = getHistorico('terceiro', id);
    const anexos = getAnexosTerceiro(id);
    const extra = `
      <div class="analysis-section">
        <strong>Atalhos</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <button class="btn btn-primary" onclick="copiarTexto(gerarTextoEmailTerceiro('${id}'))">Copiar e-mail de pendência</button>
          <button class="btn btn-ghost" onclick="abrirEdicao('${id}')">Editar cadastro</button>
        </div>
      </div>
      <div class="analysis-section">
        <strong>Anexos / documentos registrados</strong>
        <div class="attachment-form">
          <select id="anexo-tipo"><option>ASO</option><option>Integração</option><option>Treinamento</option><option>Ficha EPI</option><option>Contrato/Ficha Registro</option><option>CNH</option><option>Outro</option></select>
          <input id="anexo-nome" placeholder="Ex.: ASO_Pablo_2026.pdf">
          <button class="btn btn-primary" onclick="adicionarAnexoTerceiro('${id}')">Adicionar</button>
        </div>
        <div class="attachment-list">${anexos.length ? anexos.map(a => `<div class="attachment-item"><strong>${a.tipo}</strong> — ${a.nome}<br><small>${new Date(a.data).toLocaleString('pt-BR')}</small> <button class="btn btn-danger" style="padding:4px 8px;font-size:11px;margin-left:6px;" onclick="removerAnexoTerceiro('${id}','${a.id}')">Remover</button></div>`).join('') : '<p style="font-size:13px;color:var(--muted);margin-top:8px;">Nenhum anexo registrado ainda.</p>'}</div>
      </div>
      <div class="analysis-section">
        <strong>Histórico de alterações</strong>
        <div class="history-list">${historico.length ? historico.slice(0,10).map(h => `<div class="history-item"><strong>${new Date(h.data).toLocaleString('pt-BR')}</strong><br>${h.descricao}</div>`).join('') : '<p style="font-size:13px;color:var(--muted);margin-top:8px;">Sem histórico registrado para este terceiro.</p>'}</div>
      </div>`;
    box.insertAdjacentHTML('beforeend', extra);
  };


  // ──────────────────────────────────────────────────
  //  V11 — Inteligência, ranking e relatório executivo
  // ──────────────────────────────────────────────────
  function normalizarTextoBusca(txt) {
    return (txt || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function sugerirTreinamentosPorFuncao(funcao) {
    const f = normalizarTextoBusca(funcao);
    const sugestoes = new Set(['Integração', 'Uso de EPIs']);
    if (!f.trim()) return [];

    if (f.includes('eletric') || f.includes('manutencao eletr') || f.includes('painel')) {
      sugestoes.add('NR 10 Básico');
      sugestoes.add('NR 10 SEP');
    }
    if (f.includes('altura') || f.includes('telhado') || f.includes('andaime') || f.includes('montador') || f.includes('pedreiro')) {
      sugestoes.add('NR 35 - Trabalho em Altura');
    }
    if (f.includes('confinado') || f.includes('tanque') || f.includes('silo')) {
      sugestoes.add('NR 33 - Trabalhador Autorizado');
      sugestoes.add('NR 33 - Vigia');
    }
    if (f.includes('empilhadeira') || f.includes('operador de empilhadeira')) sugestoes.add('NR 11 - Empilhadeira');
    if (f.includes('ponte rolante') || f.includes('talha')) sugestoes.add('NR 11 - Ponte Rolante');
    if (f.includes('maquina') || f.includes('operador') || f.includes('mecanico') || f.includes('mecanic')) sugestoes.add('NR 12 - Máquinas e Equipamentos');
    if (f.includes('caldeira') || f.includes('vaso') || f.includes('compressor')) sugestoes.add('NR 13 - Caldeiras e Vasos de Pressão');
    if (f.includes('obra') || f.includes('construcao') || f.includes('pedreiro') || f.includes('servente')) sugestoes.add('NR 18 - Construção Civil');
    if (f.includes('inflamavel') || f.includes('combustivel') || f.includes('solda') || f.includes('soldador') || f.includes('quente')) {
      sugestoes.add('NR 20 - Inflamáveis e Combustíveis');
      sugestoes.add('Trabalho a Quente');
    }
    if (f.includes('brigad') || f.includes('incendio')) sugestoes.add('Brigada de Incêndio');
    if (f.includes('motorista') || f.includes('condutor')) sugestoes.add('Direção Defensiva');
    if (f.includes('pta') || f.includes('plataforma')) sugestoes.add('Operador de PTA');
    if (f.includes('munck')) sugestoes.add('Operador de Munck');
    if (f.includes('guindaste')) sugestoes.add('Operador de Guindaste');
    if (f.includes('retroescavadeira')) sugestoes.add('Operador de Retroescavadeira');
    if (f.includes('escavadeira')) sugestoes.add('Operador de Escavadeira');
    if (f.includes('solda') || f.includes('soldador')) sugestoes.add('Soldagem');

    return Array.from(sugestoes);
  }

  function renderSugestoesFuncao() {
    const box = document.getElementById('sugestoes-funcao-box');
    const list = document.getElementById('sugestoes-funcao-list');
    const funcao = document.getElementById('f-funcao')?.value || '';
    if (!box || !list) return;
    const sugestoes = sugerirTreinamentosPorFuncao(funcao);
    if (!funcao.trim() || !sugestoes.length) {
      box.classList.remove('show');
      list.innerHTML = '';
      return;
    }
    box.classList.add('show');
    list.innerHTML = sugestoes.map(s => `<span class="suggestion-tag">${s}</span>`).join('');
  }

  function calcularRankingEmpresasPendencias() {
    const empresas = getAllEmpresas();
    const terceiros = getAll();
    return empresas.map(e => {
      const vinculados = terceiros.filter(t => t.empresaId === e.id || t.empresa === (e.fantasia ? `${e.razao} (${e.fantasia})` : e.razao));
      const pendencias = vinculados.reduce((acc, t) => acc + getStatus(t).motivos.length + (getStatus(t).avisos || []).length, 0);
      const bloqueados = vinculados.filter(t => !getStatus(t).ok).length;
      return { empresa:e, total:vinculados.length, pendencias, bloqueados };
    }).filter(x => x.total > 0 || x.pendencias > 0).sort((a,b) => b.pendencias - a.pendencias || b.bloqueados - a.bloqueados).slice(0,5);
  }

  function renderRankingEmpresas() {
    const wrap = document.getElementById('dash-ranking-empresas');
    if (!wrap) return;
    const ranking = calcularRankingEmpresasPendencias();
    if (!ranking.length) {
      wrap.innerHTML = '<p style="font-size:14px;color:var(--muted);">Nenhuma empresa com pendência identificada.</p>';
      return;
    }
    wrap.innerHTML = ranking.map((r, idx) => `
      <div class="rank-row" onclick="showPage('listagem'); setTimeout(()=>{ const f=document.getElementById('filtro-empresa-lista'); if(f){ preencherFiltroEmpresas(); f.value='${r.empresa.id}'; renderLista(); } },50)">
        <div><strong>${idx+1}. ${r.empresa.fantasia || r.empresa.razao}</strong><small>${r.total} terceiro(s) • ${r.bloqueados} bloqueado(s)</small></div>
        <div class="rank-num">${r.pendencias}</div>
      </div>`).join('');
  }

  function gerarRelatorioExecutivo() {
    const terceiros = getAll();
    const empresas = getAllEmpresas();
    const st = terceiros.map(t => getStatus(t));
    const liberados = st.filter(s => s.ok).length;
    const bloqueados = terceiros.length - liberados;
    const resumo = getResumoExecutivo ? getResumoExecutivo() : { asoVencidos:0, integVencidas:0, treinosPendentes:0, contratosVencidos:0 };
    const ranking = calcularRankingEmpresasPendencias();
    const data = new Date().toLocaleString('pt-BR');
    const html = `
      <html><head><title>Relatório Controle de Terceiros</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}h1{color:#155EEF}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{border:1px solid #ddd;border-radius:10px;padding:14px}.num{font-size:28px;font-weight:800}.red{color:#DC2626}.green{color:#16A34A}.blue{color:#155EEF}@media print{button{display:none}}</style>
      </head><body>
      <button onclick="window.print()" style="padding:10px 16px;border:0;background:#155EEF;color:#fff;border-radius:8px;margin-bottom:18px">Salvar/Imprimir PDF</button>
      <h1>Relatório de Controle de Terceiros</h1><p>Gerado em ${data}</p>
      <div class="kpi"><div class="card"><b>Total</b><div class="num blue">${terceiros.length}</div></div><div class="card"><b>Liberados</b><div class="num green">${liberados}</div></div><div class="card"><b>Bloqueados/Pendentes</b><div class="num red">${bloqueados}</div></div><div class="card"><b>Empresas</b><div class="num blue">${empresas.length}</div></div></div>
      <h2>Resumo executivo</h2><table><tr><th>Indicador</th><th>Quantidade</th></tr><tr><td>ASOs vencidos</td><td>${resumo.asoVencidos}</td></tr><tr><td>Integrações vencidas</td><td>${resumo.integVencidas}</td></tr><tr><td>Treinamentos pendentes/vencidos</td><td>${resumo.treinosPendentes}</td></tr><tr><td>Contratos vencidos</td><td>${resumo.contratosVencidos}</td></tr></table>
      <h2>Empresas com mais pendências</h2><table><tr><th>Empresa</th><th>Terceiros</th><th>Bloqueados</th><th>Pendências</th></tr>${ranking.map(r=>`<tr><td>${r.empresa.fantasia || r.empresa.razao}</td><td>${r.total}</td><td>${r.bloqueados}</td><td>${r.pendencias}</td></tr>`).join('')}</table>
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast('Não foi possível abrir o relatório. Verifique bloqueio de pop-up.'); return; }
    win.document.write(html); win.document.close();
  }

  const _renderDashboardV11 = renderDashboard;
  renderDashboard = function() {
    _renderDashboardV11();
    renderRankingEmpresas();
  };

  const _showPageV11 = showPage;
  showPage = function(name) {
    _showPageV11(name);
    if (name === 'dashboard') renderRankingEmpresas();
    if (name === 'cadastro') setTimeout(renderSugestoesFuncao, 20);
  };

  const funcaoInputV11 = document.getElementById('f-funcao');
  if (funcaoInputV11) funcaoInputV11.addEventListener('input', renderSugestoesFuncao);


  inicializarTreinamentosPadrao();
  popularSelectEmpresas('f-empresa');
  renderTreinosExigidosCadastro();

  function renderEmpresas() {
    atualizarStats();
    const q = (document.getElementById('busca-empresas')?.value || '').toLowerCase().trim();
    let lista = getAllEmpresas();
    if (q) lista = lista.filter(e =>
      e.razao.toLowerCase().includes(q) ||
      (e.fantasia || '').toLowerCase().includes(q) ||
      e.cnpj.replace(/\D/g,'').includes(q.replace(/\D/g,''))
    );

    const tbody = document.getElementById('tabela-empresas');
    const empty = document.getElementById('empresas-empty');
    tbody.innerHTML = '';

    if (!lista.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    lista.forEach(e => {
      const contratoSt = statusData(e.contratoFim);
      const dpSt = statusData(e.docDPValidade);
      const sesmtSt = statusData(e.docSESMTValidade);
      const contratoBadge = e.contratoFim ? badgeStatus(contratoSt.label, contratoSt.classe) + '<br><small>' + fmtData(e.contratoFim) + '</small>' : '<span class="badge badge-warn">Sem data</span>';
      const dpBadge = e.docDPValidade ? badgeStatus(dpSt.label, dpSt.classe) : '<span class="badge badge-warn">Sem data</span>';
      const sesmtBadge = e.docSESMTValidade ? badgeStatus(sesmtSt.label, sesmtSt.classe) : '<span class="badge badge-warn">Sem data</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-name">${e.razao}</td>
        <td class="td-company">${e.fantasia || '—'}</td>
        <td class="td-cpf">${e.cnpj}</td>
        <td>${e.resp}</td>
        <td>${e.tel || '—'}</td>
        <td>${contratoBadge}</td>
        <td>${dpBadge}</td>
        <td>${sesmtBadge}</td>
        <td><span class="badge badge-warn">${(e.treinamentosObrigatorios || []).length} exigido(s)</span></td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;" onclick="abrirModalEditarEmpresa('${e.id}')">Editar</button>
            <button class="btn btn-danger" style="padding:5px 12px;font-size:12px;" onclick="excluirEmpresa('${e.id}')">Excluir</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function excluirEmpresa(id) {
    const vinculados = getAll().filter(t => t.empresaId === id).length;
    if (vinculados > 0) {
      toast(`⚠ Esta empresa possui ${vinculados} terceiro(s) vinculado(s). Remova-os primeiro.`);
      return;
    }
    if (!confirm('Deseja excluir esta empresa?')) return;
    saveAllEmpresas(getAllEmpresas().filter(e => e.id !== id));
    renderEmpresas();
    inicializarTreinamentosPadrao();
  popularSelectEmpresas('f-empresa');
  renderTreinosExigidosCadastro();
    popularSelectEmpresas('e-empresa');
    toast('Empresa removida.');
  }


  inicializarTreinamentosPadrao();
  popularSelectEmpresas('f-empresa');
  renderTreinosExigidosCadastro();
  renderDashboard();

  // ──────────────────────────────────────────────────
  //  PORTARIA
  // ──────────────────────────────────────────────────
  function limparResultadoPortaria() {
    const result = document.getElementById('portaria-result');
    const notFound = document.getElementById('portaria-not-found');
    const matches = document.getElementById('portaria-matches');
    if (result) result.classList.remove('show');
    if (notFound) notFound.classList.remove('show');
    if (matches) matches.style.display = 'none';
  }

  function normalizarBusca(txt) {
    return (txt || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function buscarTerceirosPortaria(q) {
    const lista = getAll();
    const termo = normalizarBusca(q);
    const termoNumerico = (q || '').replace(/\D/g, '');
    if (!termo && !termoNumerico) return [];

    // 1) CPF exato: se digitou 11 números, só aceita CPF igual.
    if (termoNumerico.length === 11) {
      return lista.filter(t => (t.cpf || '').replace(/\D/g, '') === termoNumerico);
    }

    // 2) CPF parcial com pelo menos 4 números.
    if (termoNumerico.length >= 4) {
      const porCpf = lista.filter(t => (t.cpf || '').replace(/\D/g, '').includes(termoNumerico));
      if (porCpf.length) return porCpf;
    }

    // 3) Nome exato, ignorando acentos e maiúsculas.
    const exatos = lista.filter(t => normalizarBusca(t.nome) === termo);
    if (exatos.length) return exatos;

    // 4) Nome por palavras: todas as palavras digitadas precisam existir no nome.
    const partes = termo.split(/\s+/).filter(Boolean);
    if (!partes.length) return [];
    return lista.filter(t => {
      const nome = normalizarBusca(t.nome);
      return partes.every(p => nome.includes(p));
    });
  }

  function renderListaEscolhaPortaria(resultados) {
    const matches = document.getElementById('portaria-matches');
    const list = document.getElementById('portaria-matches-list');
    if (!matches || !list) return;

    list.innerHTML = resultados.map(t => {
      const st = getStatus(t);
      const badge = st.ok ? '<span class="match-badge ok">LIBERADO</span>' : '<span class="match-badge blocked">BLOQUEADO</span>';
      return `
        <button class="match-item" onclick="consultarPortariaPorId('${t.id}')">
          <span>
            <strong>${t.nome || 'Sem nome'}</strong>
            <small>${t.empresa || 'Sem empresa'} • ${t.funcao || 'Sem função'} • ${t.cpf || 'Sem CPF'}</small>
          </span>
          ${badge}
        </button>`;
    }).join('');

    matches.style.display = 'block';
  }

  function consultarPortaria() {
    const q = document.getElementById('busca-portaria').value.trim();
    limparResultadoPortaria();
    if (!q) return;

    const resultados = buscarTerceirosPortaria(q);
    const notFound = document.getElementById('portaria-not-found');

    if (!resultados.length) {
      if (notFound) notFound.classList.add('show');
      return;
    }

    if (resultados.length === 1) {
      preencherResultadoPortaria(resultados[0]);
      return;
    }

    renderListaEscolhaPortaria(resultados.slice(0, 30));
    toast(`Encontramos ${resultados.length} cadastros. Selecione o correto.`);
  }

  function consultarPortariaPorId(id) {
    const found = getAll().find(t => t.id === id);
    limparResultadoPortaria();
    if (!found) {
      const notFound = document.getElementById('portaria-not-found');
      if (notFound) notFound.classList.add('show');
      return;
    }
    preencherResultadoPortaria(found);
  }

  function preencherResultadoPortaria(found) {
    const result = document.getElementById('portaria-result');
    const statusCompleto = getStatus(found);
    const { ok, motivos } = statusCompleto;

    const icon = document.getElementById('r-icon');
    const svg  = document.getElementById('r-icon-svg');
    icon.className = 'status-icon ' + (ok ? 'ok' : 'blocked');
    svg.innerHTML = ok
      ? '<polyline points="20 6 9 17 4 12"/>'
      : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';

    const label = document.getElementById('r-status-label');
    label.textContent = ok ? 'LIBERADO' : 'BLOQUEADO';
    label.className = 'status-label ' + (ok ? 'ok' : 'blocked');
    document.getElementById('r-status-sub').textContent = ok ? 'Documentação em dia — acesso permitido' : 'Acesso não autorizado';

    document.getElementById('r-nome').textContent    = found.nome || '—';
    document.getElementById('r-empresa').textContent = found.empresa || '—';
    document.getElementById('r-funcao').textContent  = found.funcao || '—';
    document.getElementById('r-cpf').textContent     = found.cpf || '—';
    document.getElementById('r-aso').innerHTML       = fmtData(found.aso) + tagData(found.aso);
    document.getElementById('r-integ').innerHTML     = fmtData(found.integ) + tagData(found.integ);

    const setorWrap = document.getElementById('r-status-setores');
    const dpPanel = document.getElementById('r-dp-panel');
    const sesmtPanel = document.getElementById('r-sesmt-panel');
    const dp = statusCompleto.dp;
    const sesmt = statusCompleto.sesmt;
    if (setorWrap) setorWrap.style.display = 'grid';
    if (dpPanel) dpPanel.className = 'status-panel ' + (dp.ok ? 'ok' : 'blocked');
    if (sesmtPanel) sesmtPanel.className = 'status-panel ' + (sesmt.ok ? 'ok' : 'blocked');
    document.getElementById('r-dp-status').innerHTML = dp.ok ? '<span class="badge badge-ok">ACESSO LIBERADO</span>' : '<span class="badge badge-blocked">ACESSO NEGADO</span>';
    document.getElementById('r-sesmt-status').innerHTML = sesmt.ok ? '<span class="badge badge-ok">ACESSO LIBERADO</span>' : '<span class="badge badge-blocked">ACESSO NEGADO</span>';
    document.getElementById('r-dp-motivos').innerHTML = (dp.motivos.length ? dp.motivos : (dp.avisos.length ? dp.avisos : ['Sem pendências do DP'])).map(m => `<li>${m}</li>`).join('');
    document.getElementById('r-sesmt-motivos').innerHTML = (sesmt.motivos.length ? sesmt.motivos : (sesmt.avisos.length ? sesmt.avisos : ['Sem pendências SESMT'])).map(m => `<li>${m}</li>`).join('');

    const rTreinosWrap = document.getElementById('r-treinos-wrap');
    const rTreinosList = document.getElementById('r-treinos-list');
    const obrigatorios = getTreinosObrigatoriosDaEmpresa(found.empresaId);
    if (obrigatorios.length) {
      rTreinosList.innerHTML = obrigatorios.map(tr => {
        const st = getStatusTreinamentoTerceiro(found, tr);
        const cls = st.ok ? 'status-mini ok' : (st.semData ? 'status-mini warn' : 'status-mini blocked');
        const reg = getTreinoRealizado(found, tr.id);
        const detalhe = reg?.data && isDataValidaSistema(reg.data) ? `Realizado: ${fmtData(reg.data)}` : 'Sem data cadastrada';
        return `<span class="training-tag">${tr.nome} <span class="${cls}">${st.label}</span><small style="display:block;color:var(--muted);margin-top:3px;">${detalhe}</small></span>`;
      }).join('');
      rTreinosWrap.style.display = 'block';
    } else {
      rTreinosWrap.style.display = 'none';
      rTreinosList.innerHTML = '';
    }

    const motivosWrap = document.getElementById('r-motivos');
    const motivosList = document.getElementById('r-motivos-list');
    if (motivos.length) {
      motivosList.innerHTML = motivos.map(m => `<li>${m}</li>`).join('');
      motivosWrap.style.display = 'block';
    } else {
      motivosWrap.style.display = 'none';
    }

    const obsWrap = document.getElementById('r-obs-wrap');
    if (found.obs) {
      document.getElementById('r-obs').textContent = found.obs;
      obsWrap.style.display = 'block';
    } else {
      obsWrap.style.display = 'none';
    }

    result.classList.add('show');
  }

  // ──────────────────────────────────────────────────
  //  DADOS, BACKUP E IMPORTAÇÃO
  // ──────────────────────────────────────────────────
  function renderDados() {
    const terceiros = getAll();
    const empresas = getAllEmpresas();
    const treinamentos = getAllTreinamentos();
    const pendencias = typeof coletarPendencias === 'function' ? coletarPendencias() : [];
    const elT = document.getElementById('dados-total-terceiros');
    const elE = document.getElementById('dados-total-empresas');
    const elTr = document.getElementById('dados-total-treinamentos');
    const elP = document.getElementById('dados-total-pendencias');
    if (elT) elT.textContent = terceiros.length;
    if (elE) elE.textContent = empresas.length;
    if (elTr) elTr.textContent = treinamentos.length;
    if (elP) elP.textContent = pendencias.length;
  }

  function baixarArquivo(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportarBackupJSON() {
    const backup = {
      app: 'Controle de Terceiros',
      versao: 'V8',
      exportadoEm: new Date().toISOString(),
      terceiros: getAll(),
      empresas: getAllEmpresas(),
      treinamentos: getAllTreinamentos()
    };
    baixarArquivo('backup-controle-terceiros.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
    toast('✓ Backup gerado.');
  }

  function importarBackupJSON(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.terceiros) || !Array.isArray(data.empresas) || !Array.isArray(data.treinamentos)) {
          throw new Error('Arquivo inválido para este sistema.');
        }
        if (!confirm('Esse backup vai substituir os cadastros atuais. Deseja continuar?')) return;
        saveAll(data.terceiros);
        saveAllEmpresas(data.empresas);
        saveAllTreinamentos(data.treinamentos);
        popularSelectEmpresas('f-empresa');
        popularSelectEmpresas('e-empresa');
        renderDashboard();
        renderDados();
        document.getElementById('import-log').textContent = `Backup restaurado com sucesso.\nTerceiros: ${data.terceiros.length}\nEmpresas: ${data.empresas.length}\nTreinamentos: ${data.treinamentos.length}`;
        toast('✓ Backup restaurado.');
      } catch (err) {
        toast('⚠ Erro ao importar backup.');
        document.getElementById('import-log').textContent = 'Erro ao importar backup: ' + err.message;
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function csvEscape(v) {
    const s = (v ?? '').toString().replace(/"/g, '""');
    return `"${s}"`;
  }

  function exportarCSVTerceiros() {
    const header = ['Nome','CPF','Empresa','Função','ASO','Integração','Status','Motivos','Observação'];
    const rows = getAll().map(t => {
      const st = getStatus(t);
      return [t.nome, t.cpf, t.empresa, t.funcao, fmtData(t.aso), fmtData(t.integ), st.ok ? 'LIBERADO' : 'BLOQUEADO', st.motivos.join(' | '), t.obs || ''];
    });
    const csv = [header, ...rows].map(r => r.map(csvEscape).join(';')).join('\n');
    baixarArquivo('terceiros-controle.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
  }

  function exportarCSVEmpresas() {
    const header = ['Razão Social','Fantasia','CNPJ','Responsável','Telefone','E-mail','Contrato Início','Contrato Fim','Treinamentos Obrigatórios'];
    const rows = getAllEmpresas().map(e => {
      const nomes = (e.treinamentosObrigatorios || []).map(id => getTreinamentoById(id)?.nome).filter(Boolean).join(' | ');
      return [e.razao, e.fantasia || '', e.cnpj, e.resp, e.tel || '', e.email || '', fmtData(e.contratoInicio), fmtData(e.contratoFim), nomes];
    });
    const csv = [header, ...rows].map(r => r.map(csvEscape).join(';')).join('\n');
    baixarArquivo('empresas-controle.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
  }

  function baixarModeloCSV() {
    const csv = [
      ['Empresa','CNPJ','Nome do Profissional','CPF','Função','ASO','Integração','Fim Prestação Serviço'],
      ['Landim','00.000.000/0001-00','Jonilson Guimarães','000.000.000-00','Soldador','31/12/2026','31/12/2026','31/12/2026']
    ].map(r => r.map(csvEscape).join(';')).join('\n');
    baixarArquivo('modelo-importacao-controle-terceiros.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
  }

  function normalizarTexto(v) {
    return (v ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function localizarColuna(headers, termos) {
    const norm = headers.map(h => normalizarTexto(h));
    return norm.findIndex(h => termos.some(t => h.includes(normalizarTexto(t))));
  }

  function localizarLinhaCabecalho(rows) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const txt = rows[i].map(normalizarTexto).join(' | ');
      if ((txt.includes('empresa') || txt.includes('cnpj')) && (txt.includes('profissional') || txt.includes('nome'))) return i;
    }
    return 0;
  }

  function valorCelula(row, idx) {
    if (idx < 0) return '';
    return row[idx] ?? '';
  }

  function extrairCNPJ(texto) {
    const s = (texto || '').toString();
    const m = s.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    return m ? maskCNPJ(m[0]) : '';
  }

  function limparNomeEmpresa(texto) {
    return (texto || '').toString().replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '').replace(/[-–—]+$/g,'').trim();
  }

  function dataParaISO(v) {
    if (!v && v !== 0) return '';
    if (typeof v === 'number') {
      // Excel serial date
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + v * 86400000);
      return d.toISOString().split('T')[0];
    }
    const s = v.toString().trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = '20' + y;
      return `${y.padStart(4,'0')}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return '';
  }

  function importarPlanilhaExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      toast('⚠ Biblioteca de Excel não carregou. Verifique a internet.');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
        if (!rows.length) throw new Error('Planilha vazia.');

        const headerIdx = localizarLinhaCabecalho(rows);
        const headers = rows[headerIdx];
        const idxEmpresa = localizarColuna(headers, ['nome da empresa', 'empresa']);
        const idxCnpj = localizarColuna(headers, ['cnpj']);
        const idxProf = localizarColuna(headers, ['nome do profissional', 'profissional', 'nome completo', 'colaborador', 'terceiro']);
        const idxCpf = localizarColuna(headers, ['cpf']);
        const idxFuncao = localizarColuna(headers, ['funcao', 'função', 'cargo']);
        const idxAso = localizarColuna(headers, ['aso', 'documentos sesmt']);
        const idxInteg = localizarColuna(headers, ['integracao', 'integração', 'validade treinamento']);
        const idxFim = localizarColuna(headers, ['fim prestacao', 'fim prestação', 'fim contrato', 'prestacao servico']);

        if (idxEmpresa < 0 || idxProf < 0) {
          throw new Error('Não encontrei as colunas mínimas: Empresa e Nome do Profissional.');
        }

        let empresas = getAllEmpresas();
        let terceiros = getAll();
        let novasEmpresas = 0, novosTerceiros = 0, atualizados = 0, ignorados = 0;

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          const empresaTextoOriginal = valorCelula(row, idxEmpresa).toString().trim();
          const profissional = valorCelula(row, idxProf).toString().trim();
          if (!empresaTextoOriginal || !profissional) { ignorados++; continue; }

          const cnpjPlanilha = idxCnpj >= 0 ? valorCelula(row, idxCnpj).toString().trim() : '';
          const cnpj = maskCNPJ((cnpjPlanilha || extrairCNPJ(empresaTextoOriginal)).replace(/\D/g,''));
          const nomeEmpresa = limparNomeEmpresa(empresaTextoOriginal) || empresaTextoOriginal;
          const fimContrato = dataParaISO(valorCelula(row, idxFim));

          let emp = empresas.find(e =>
            (cnpj && e.cnpj && e.cnpj.replace(/\D/g,'') === cnpj.replace(/\D/g,'')) ||
            normalizarTexto(e.razao) === normalizarTexto(nomeEmpresa)
          );
          if (!emp) {
            emp = { id: uid(), razao: nomeEmpresa, fantasia: '', cnpj: cnpj || '', resp: '', tel: '', email: '', contratoInicio: '', contratoFim: fimContrato || '', treinamentosObrigatorios: [] };
            empresas.push(emp);
            novasEmpresas++;
          } else if (fimContrato && !emp.contratoFim) {
            emp.contratoFim = fimContrato;
          }

          const cpf = maskCPF(valorCelula(row, idxCpf).toString());
          const funcao = valorCelula(row, idxFuncao).toString().trim();
          const aso = dataParaISO(valorCelula(row, idxAso));
          const integ = dataParaISO(valorCelula(row, idxInteg));
          const cpfLimpo = cpf.replace(/\D/g,'');

          let terc = terceiros.find(t =>
            (cpfLimpo && t.cpf && t.cpf.replace(/\D/g,'') === cpfLimpo) ||
            (normalizarTexto(t.nome) === normalizarTexto(profissional) && t.empresaId === emp.id)
          );

          if (!terc) {
            terceiros.push({
              id: uid(), nome: profissional, cpf: cpf || '', empresaId: emp.id, empresa: emp.fantasia ? `${emp.razao} (${emp.fantasia})` : emp.razao,
              funcao: funcao || '', aso: aso || '', integ: integ || '', obs: 'Importado de planilha', treinamentosRealizados: []
            });
            novosTerceiros++;
          } else {
            terc.nome = profissional || terc.nome;
            terc.cpf = cpf || terc.cpf;
            terc.empresaId = emp.id;
            terc.empresa = emp.fantasia ? `${emp.razao} (${emp.fantasia})` : emp.razao;
            terc.funcao = funcao || terc.funcao;
            terc.aso = aso || terc.aso;
            terc.integ = integ || terc.integ;
            atualizados++;
          }
        }

        saveAllEmpresas(empresas);
        saveAll(terceiros);
        popularSelectEmpresas('f-empresa');
        popularSelectEmpresas('e-empresa');
        renderDashboard();
        renderDados();

        const msg = `Importação concluída.\nArquivo: ${file.name}\nLinhas lidas: ${Math.max(rows.length - headerIdx - 1, 0)}\nEmpresas novas: ${novasEmpresas}\nTerceiros novos: ${novosTerceiros}\nTerceiros atualizados: ${atualizados}\nLinhas ignoradas: ${ignorados}\n\nObservação: confira os campos de ASO, Integração e Fim Prestação Serviço após importar, pois planilhas com cabeçalhos mesclados podem exigir ajuste manual.`;
        document.getElementById('import-log').textContent = msg;
        toast('✓ Planilha importada.');
      } catch (err) {
        document.getElementById('import-log').textContent = 'Erro na importação: ' + err.message;
        toast('⚠ Erro ao importar planilha.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }


  // ──────────────────────────────────────────────────
  //  V10.3 — Correção: status pendente x bloqueado + clique robusto nos cards
  // ──────────────────────────────────────────────────
  // Regra: data ausente/informação incompleta vira AVISO/PENDÊNCIA, não bloqueio.
  // Bloqueio vermelho fica apenas para vencido de fato.
  getStatusDP = function(t) {
    const motivos = [];
    const avisos = [];
    const empresa = getEmpresaById(t.empresaId);
    if (!empresa) {
      avisos.push('Empresa não vinculada ao cadastro');
      return { ok:true, motivos, avisos, pendente:true };
    }

    const contrato = statusData(empresa.contratoFim);
    if (contrato.semData) avisos.push('Fim da prestação de serviço sem data informada');
    else if (contrato.classe === 'blocked') motivos.push('Fim da prestação de serviço vencido em ' + fmtData(empresa.contratoFim));
    else if (contrato.classe === 'warn') avisos.push('Fim da prestação de serviço ' + contrato.texto.toLowerCase());

    const docDP = statusData(empresa.docDPValidade);
    if (docDP.semData) avisos.push('Documentos DP sem data informada');
    else if (docDP.classe === 'blocked') motivos.push('Documentos DP vencidos em ' + fmtData(empresa.docDPValidade));
    else if (docDP.classe === 'warn') avisos.push('Documentos DP ' + docDP.texto.toLowerCase());

    return { ok: motivos.length === 0, motivos, avisos, pendente: motivos.length === 0 && avisos.length > 0 };
  };

  getStatusSESMT = function(t) {
    const motivos = [];
    const avisos = [];
    const empresa = getEmpresaById(t.empresaId);

    const asoStatus = statusData(t.aso);
    if (asoStatus.semData) avisos.push('ASO sem data informada');
    else if (asoStatus.classe === 'blocked') motivos.push('ASO vencido em ' + fmtData(t.aso));
    else if (asoStatus.classe === 'warn') avisos.push('ASO ' + asoStatus.texto.toLowerCase());

    const integStatus = statusData(t.integ);
    if (integStatus.semData) avisos.push('Integração sem data informada');
    else if (integStatus.classe === 'blocked') motivos.push('Integração vencida em ' + fmtData(t.integ));
    else if (integStatus.classe === 'warn') avisos.push('Integração ' + integStatus.texto.toLowerCase());

    if (empresa) {
      const docSESMT = statusData(empresa.docSESMTValidade);
      if (docSESMT.semData) avisos.push('Documentos SESMT sem data informada');
      else if (docSESMT.classe === 'blocked') motivos.push('Documentos SESMT vencidos em ' + fmtData(empresa.docSESMTValidade));
      else if (docSESMT.classe === 'warn') avisos.push('Documentos SESMT ' + docSESMT.texto.toLowerCase());
    }

    const obrigatorios = getTreinosObrigatoriosDaEmpresa(t.empresaId);
    obrigatorios.forEach(tr => {
      const reg = getTreinoRealizado(t, tr.id);
      if (!reg || !isDataValidaSistema(reg.data)) {
        avisos.push(`${tr.nome} sem data cadastrada`);
        return;
      }
      const vencimento = addMonths(reg.data, tr.validade || 12);
      const stData = statusData(vencimento);
      if (stData.classe === 'blocked') motivos.push(`${tr.nome} vencido em ${fmtData(vencimento)}`);
      else if (stData.classe === 'warn') avisos.push(`${tr.nome} ${stData.texto.toLowerCase()}`);
    });

    return { ok: motivos.length === 0, motivos, avisos, pendente: motivos.length === 0 && avisos.length > 0 };
  };

  getStatus = function(t) {
    const dp = getStatusDP(t);
    const sesmt = getStatusSESMT(t);
    const motivos = [...dp.motivos, ...sesmt.motivos];
    const avisos = [...dp.avisos, ...sesmt.avisos];
    const bloqueado = motivos.length > 0;
    const pendente = !bloqueado && avisos.length > 0;
    return { ok: !bloqueado, bloqueado, pendente, motivos, avisos, dp, sesmt };
  };

  const _renderDashboardV103 = renderDashboard;
  renderDashboard = function() {
    atualizarStats();
    const wrap = document.getElementById('dash-lista-bloqueados');
    if (!wrap) return;
    const itens = getAll().map(t => ({...t, status:getStatus(t)})).filter(t => t.status.bloqueado || t.status.pendente);
    if (!itens.length) {
      wrap.innerHTML = '<p style="font-size:14px;color:var(--muted);">Nenhum terceiro bloqueado ou pendente no momento.</p>';
      return;
    }
    wrap.innerHTML = itens.map(t => {
      const resumo = (t.status.motivos.length ? t.status.motivos : t.status.avisos).slice(0,3).join('<br>');
      const classe = t.status.bloqueado ? 'dash-motivos' : 'dash-motivos warn';
      return `
        <div class="dash-item" role="button" tabindex="0" data-terceiro-id="${t.id}" style="cursor:pointer;">
          <div><strong>${t.nome}</strong><small>${t.empresa || 'Sem empresa'} • ${t.cpf || 'CPF não informado'}</small></div>
          <div class="${classe}">${resumo}</div>
        </div>`;
    }).join('');
  };

  renderPendenciaItem = function(p, classe) {
    const quando = p.dias === null
      ? 'Sem data cadastrada'
      : (p.dias < 0 ? `Venceu em ${fmtData(p.vencimento)} (${Math.abs(p.dias)} dia(s) atrás)` : `Vence em ${fmtData(p.vencimento)} (faltam ${p.dias} dia(s))`);
    return `
      <div class="pendency-item" role="button" tabindex="0" data-terceiro-id="${p.terceiroId || ''}" style="cursor:pointer;">
        <div>
          <strong>${p.terceiro}</strong>
          <small>${p.empresa} • ${p.cpf}</small>
          <small>${p.tipo}: ${p.item}</small>
        </div>
        <div class="pendency-detail ${classe}">${quando}${p.detalheExtra ? '<br>' + p.detalheExtra : ''}</div>
      </div>`;
  };

  document.addEventListener('click', function(e) {
    const card = e.target.closest('.dash-item[data-terceiro-id], .pendency-item[data-terceiro-id]');
    if (!card) return;
    const id = card.getAttribute('data-terceiro-id');
    if (id) abrirAnalise(id);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.dash-item[data-terceiro-id], .pendency-item[data-terceiro-id]');
    if (!card) return;
    e.preventDefault();
    const id = card.getAttribute('data-terceiro-id');
    if (id) abrirAnalise(id);
  });


  // ──────────────────────────────────────────────────
  //  V13 — Liberação por Exceção
  // ──────────────────────────────────────────────────
  (function configurarLiberacaoExcecao(){
    const css = document.createElement('style');
    css.textContent = `
      .badge-exception { background:#FEF3C7; color:#B45309; }
      .stat-exception .stat-value { color:#D97706; }
      .stat-pending .stat-value { color:#D97706; }
      .status-icon.exception { background:var(--warn-lt); color:var(--warn); }
      .status-label.exception { color:var(--warn); }
      .exception-box { border:1px solid #FBBF24; background:#FFFBEB; border-radius:14px; padding:16px; margin-top:14px; }
      .exception-box strong { color:#92400E; }
      .exception-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
      .exception-grid .full { grid-column:1 / -1; }
      .exception-active { background:#FFFBEB; border:1px solid #FBBF24; border-radius:12px; padding:12px; margin-top:10px; color:#78350F; }
      .exception-list { display:flex; flex-direction:column; gap:10px; }
      .exception-item { border:1px solid var(--border); border-radius:12px; padding:12px; display:grid; grid-template-columns:1fr auto; gap:12px; align-items:start; }
      .exception-item small { display:block; color:var(--muted); margin-top:4px; }
      @media (max-width: 640px) { .exception-grid { grid-template-columns:1fr; } .exception-item { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(css);

    const primeiroGrid = document.querySelector('#page-dashboard .stats-grid');
    if (primeiroGrid && !document.getElementById('dash-excecoes')) {
      const card = document.createElement('div');
      card.className = 'stat-card stat-exception';
      card.innerHTML = '<div class="stat-label">Liberados por Exceção</div><div class="stat-value" id="dash-excecoes">0</div>';
      primeiroGrid.appendChild(card);
      const cardPend = document.createElement('div');
      cardPend.className = 'stat-card stat-pending';
      cardPend.innerHTML = '<div class="stat-label">Pendentes</div><div class="stat-value" id="dash-pendentes">0</div>';
      primeiroGrid.appendChild(cardPend);
    }

    const rankingCard = document.getElementById('dash-ranking-empresas')?.closest('.card');
    if (rankingCard && !document.getElementById('dash-excecoes-list')) {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = '<div class="card-title">Liberações por Exceção</div><div id="dash-excecoes-list" class="exception-list"></div>';
      rankingCard.insertAdjacentElement('afterend', div);
    }
  })();

  function getAllExcecoes() {
    return JSON.parse(localStorage.getItem('liberacoesExcecao') || '{}');
  }

  function saveAllExcecoes(data) {
    localStorage.setItem('liberacoesExcecao', JSON.stringify(data || {}));
  }

  function getExcecaoTerceiro(id) {
    const all = getAllExcecoes();
    const ex = all[id];
    return ex && ex.ativo ? ex : null;
  }

  function getStatusBaseSemExcecao(t) {
    const dp = getStatusDP(t);
    const sesmt = getStatusSESMT(t);
    const motivos = [...dp.motivos, ...sesmt.motivos];
    const avisos = [...dp.avisos, ...sesmt.avisos];
    const bloqueado = motivos.length > 0;
    const pendente = !bloqueado && avisos.length > 0;
    return { ok: !bloqueado, bloqueado, pendente, excecao:false, motivos, avisos, dp, sesmt };
  }

  getStatus = function(t) {
    const base = getStatusBaseSemExcecao(t);
    const ex = getExcecaoTerceiro(t.id);
    if (ex && (base.bloqueado || base.pendente)) {
      return {
        ...base,
        ok: true,
        bloqueado: false,
        pendente: false,
        excecao: true,
        excecaoDados: ex,
        statusTexto: 'LIBERADO POR EXCEÇÃO'
      };
    }
    return { ...base, statusTexto: base.ok && !base.pendente ? 'LIBERADO' : (base.pendente ? 'PENDENTE' : 'BLOQUEADO') };
  };

  function salvarLiberacaoExcecao(id) {
    const t = getAll().find(x => x.id === id);
    if (!t) return;

    const dataLiberacao = document.getElementById('exc-data')?.value || '';
    const aprovador = document.getElementById('exc-aprovador')?.value.trim() || '';
    const cargo = document.getElementById('exc-cargo')?.value || '';
    const motivo = document.getElementById('exc-motivo')?.value || '';
    const obs = document.getElementById('exc-obs')?.value.trim() || '';

    if (!dataLiberacao || !aprovador || !cargo || !motivo) {
      toast('⚠ Preencha data, aprovador, cargo e motivo da exceção.');
      return;
    }

    if (dataLiberacao < hoje()) {
      toast('⚠ A data da liberação por exceção não pode ser retroativa.');
      return;
    }

    const all = getAllExcecoes();
    all[id] = {
      id: uid(),
      terceiroId: id,
      terceiro: t.nome || '',
      empresa: t.empresa || '',
      cpf: t.cpf || '',
      ativo: true,
      dataLiberacao,
      aprovador,
      cargo,
      motivo,
      obs,
      criadoEm: new Date().toISOString()
    };
    saveAllExcecoes(all);
    registrarHistorico('terceiro', id, `Liberação por exceção registrada por ${aprovador} (${cargo}). Motivo: ${motivo}. Data: ${fmtData(dataLiberacao)}.`);
    toast('✓ Liberação por exceção registrada.');
    abrirAnalise(id);
    renderDashboard();
  }

  function cancelarLiberacaoExcecao(id) {
    const ex = getExcecaoTerceiro(id);
    if (!ex) return;
    if (!confirm('Cancelar a liberação por exceção deste terceiro?')) return;
    const all = getAllExcecoes();
    all[id] = { ...all[id], ativo:false, canceladoEm:new Date().toISOString() };
    saveAllExcecoes(all);
    registrarHistorico('terceiro', id, 'Liberação por exceção cancelada.');
    toast('Liberação por exceção cancelada.');
    abrirAnalise(id);
    renderDashboard();
  }

  function renderExcecaoBox(id) {
    const ex = getExcecaoTerceiro(id);
    if (ex) {
      return `
        <div class="exception-box">
          <strong>🟡 Liberado por Exceção</strong>
          <div class="exception-active">
            <b>Data da liberação:</b> ${fmtData(ex.dataLiberacao)}<br>
            <b>Aprovador:</b> ${ex.aprovador}<br>
            <b>Cargo:</b> ${ex.cargo}<br>
            <b>Motivo:</b> ${ex.motivo}<br>
            ${ex.obs ? `<b>Observação:</b> ${ex.obs}<br>` : ''}
            <small>Registrado em ${new Date(ex.criadoEm).toLocaleString('pt-BR')}</small>
          </div>
          <div style="margin-top:10px;"><button class="btn btn-danger" onclick="cancelarLiberacaoExcecao('${id}')">Cancelar exceção</button></div>
        </div>`;
    }
    return `
      <div class="exception-box">
        <strong>Liberação por Exceção</strong>
        <p style="font-size:13px;color:#92400E;margin-top:6px;">Use somente quando houver autorização formal para entrada mesmo com pendências. A data não pode ser retroativa.</p>
        <div class="exception-grid">
          <div><label>Data da liberação *</label><input id="exc-data" type="date" min="${hoje()}" value="${hoje()}"></div>
          <div><label>Cargo do aprovador *</label><select id="exc-cargo"><option value="">Selecione...</option><option>Gerente da Planta</option><option>Supervisor Industrial</option><option>Coordenador Industrial</option><option>Outro</option></select></div>
          <div class="full"><label>Nome do aprovador *</label><input id="exc-aprovador" placeholder="Ex.: João da Silva"></div>
          <div class="full"><label>Motivo *</label><select id="exc-motivo"><option value="">Selecione...</option><option>ASO pendente</option><option>Integração pendente</option><option>Treinamento pendente</option><option>Documento DP pendente</option><option>Emergência operacional</option><option>Outro</option></select></div>
          <div class="full"><label>Observação</label><textarea id="exc-obs" placeholder="Explique a autorização..."></textarea></div>
        </div>
        <div style="margin-top:12px;"><button class="btn btn-primary" onclick="salvarLiberacaoExcecao('${id}')">Liberar por Exceção</button></div>
      </div>`;
  }

  const _abrirAnaliseV13 = abrirAnalise;
  abrirAnalise = function(id) {
    _abrirAnaliseV13(id);
    const box = document.getElementById('analise-conteudo');
    const t = getAll().find(x => x.id === id);
    if (!box || !t) return;

    const st = getStatus(t);
    const label = box.querySelector('.status-label');
    const icon = box.querySelector('.status-icon');
    if (st.excecao && label) {
      label.textContent = 'LIBERADO POR EXCEÇÃO';
      label.className = 'status-label exception';
      if (icon) icon.className = 'status-icon exception';
    }
    box.insertAdjacentHTML('beforeend', renderExcecaoBox(id));
  };

  const _preencherResultadoPortariaV13 = preencherResultadoPortaria;
  preencherResultadoPortaria = function(found) {
    _preencherResultadoPortariaV13(found);
    const st = getStatus(found);
    if (!st.excecao) return;
    const icon = document.getElementById('r-icon');
    const label = document.getElementById('r-status-label');
    const sub = document.getElementById('r-status-sub');
    if (icon) icon.className = 'status-icon exception';
    if (label) { label.textContent = 'LIBERADO POR EXCEÇÃO'; label.className = 'status-label exception'; }
    if (sub) sub.textContent = `Autorizado por ${st.excecaoDados.aprovador} — ${st.excecaoDados.cargo}`;

    const motivosWrap = document.getElementById('r-motivos');
    const motivosList = document.getElementById('r-motivos-list');
    if (motivosWrap && motivosList) {
      motivosWrap.style.display = 'block';
      motivosList.innerHTML = `
        <li><b>Motivo da exceção:</b> ${st.excecaoDados.motivo}</li>
        <li><b>Data da liberação:</b> ${fmtData(st.excecaoDados.dataLiberacao)}</li>
        <li><b>Aprovador:</b> ${st.excecaoDados.aprovador} — ${st.excecaoDados.cargo}</li>
        ${st.excecaoDados.obs ? `<li><b>Obs:</b> ${st.excecaoDados.obs}</li>` : ''}
        ${(st.motivos || []).map(m => `<li>Pendência: ${m}</li>`).join('')}
        ${(st.avisos || []).map(a => `<li>Aviso: ${a}</li>`).join('')}`;
    }
  };

  const _atualizarStatsV13 = atualizarStats;
  atualizarStats = function() {
    const terceiros = getAll();
    const empresas = (typeof getAllEmpresas === 'function') ? getAllEmpresas() : [];
    const treinamentos = (typeof getAllTreinamentos === 'function') ? getAllTreinamentos() : [];
    const statuses = terceiros.map(t => getStatus(t));
    const liberados = statuses.filter(s => s.ok && !s.excecao && !s.pendente).length;
    const excecoes = statuses.filter(s => s.excecao).length;
    const pendentes = statuses.filter(s => s.pendente && !s.excecao).length;
    const bloqueados = statuses.filter(s => s.bloqueado && !s.excecao).length;
    const pendenciasTreino = terceiros.reduce((acc, t) => acc + getTreinosObrigatoriosDaEmpresa(t.empresaId).filter(tr => !getStatusTreinamentoTerceiro(t, tr).ok).length, 0);
    const empresasComExigencias = empresas.filter(e => (e.treinamentosObrigatorios || []).length > 0).length;
    const pendenciasGerais = montarPendencias().total;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total', terceiros.length); set('stat-liberados', liberados); set('stat-bloqueados', bloqueados); set('stat-empresas', empresas.length); set('stat-pendencias-treino', pendenciasTreino);
    set('dash-total', terceiros.length); set('dash-liberados', liberados); set('dash-bloqueados', bloqueados); set('dash-empresas', empresas.length);
    set('dash-excecoes', excecoes); set('dash-pendentes', pendentes);
    set('dash-pendencias', pendenciasGerais); set('dash-treinamentos', treinamentos.length); set('dash-empresas-exigencias', empresasComExigencias);
    set('dash-status-geral', bloqueados === 0 ? (pendentes || excecoes ? 'ATENÇÃO' : 'OK') : 'ATENÇÃO');
  };

  function renderExcecoesDashboard() {
    const wrap = document.getElementById('dash-excecoes-list');
    if (!wrap) return;
    const all = getAllExcecoes();
    const itens = Object.values(all).filter(x => x && x.ativo).sort((a,b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    if (!itens.length) {
      wrap.innerHTML = '<p style="font-size:14px;color:var(--muted);">Nenhuma liberação por exceção ativa.</p>';
      return;
    }
    wrap.innerHTML = itens.slice(0, 20).map(ex => `
      <div class="exception-item" role="button" tabindex="0" data-terceiro-id="${ex.terceiroId}" style="cursor:pointer;">
        <div><strong>${ex.terceiro || 'Terceiro'}</strong><small>${ex.empresa || 'Empresa não informada'} • ${ex.cpf || 'CPF não informado'}</small><small>${ex.motivo} — ${fmtData(ex.dataLiberacao)}</small></div>
        <div><span class="badge badge-exception">EXCEÇÃO</span></div>
      </div>`).join('');
  }

  const _renderDashboardV13 = renderDashboard;
  renderDashboard = function() {
    _renderDashboardV13();
    renderExcecoesDashboard();
  };

  document.addEventListener('click', function(e) {
    const item = e.target.closest('.exception-item[data-terceiro-id]');
    if (!item) return;
    const id = item.getAttribute('data-terceiro-id');
    if (id) abrirAnalise(id);
  });



  // Registro PWA - instala como app no celular sem interferir nas funções do sistema
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function () { console.log('Service Worker registrado.'); })
        .catch(function (error) { console.warn('Falha ao registrar Service Worker:', error); });
    });
  }
</script>
</body>
</html>
