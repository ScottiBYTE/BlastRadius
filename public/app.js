const state = {
  model: null,
  summary: null,
  selectedComponentId: "npm",
  selectedBlastComponentId: "npm",
  brokenPaths: [],
  currentView: "dashboard",
  selectedServer: "all",
  selectedServiceId: null,
  selectedInstanceKey: null,
  serverSort: {
    field: "name",
    direction: "asc"
  },
  serversInitialized: false,
  lastBlastImpact: null
};

const nodePositions = {
  internet: [24, 58],
  cloudflare: [24, 190],
  "udm-beast": [24, 322],
  npm: [320, 208]
};

const remoteDisplayOrder = [
  "vmsmist",
  "vmsrain",
  "vmsstorm",
  "vmscloud-incus",
  "vmsfog-incus",
  "incus-member",
  "mondo-2",
  "vmsdroplet",
  "demo-1"
];

const icons = {
  "incus-host": "▰",
  "incus-instance": "⬡",
  "docker-container": "⬢",
  "proxy-host": "◆",
  "unifi-device": "⌁",
  external: "◎",
  dns: "☁",
  network: "⛓"
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data.detail || data.error || "";
    } catch (_) {
      detail = await res.text();
    }
    throw new Error(`API request failed: ${path}${detail ? ` - ${detail}` : ""}`);
  }

  return res.json();
}

function injectDynamicStyles() {
  if (document.getElementById("blast-radius-dynamic-styles")) return;

  const style = document.createElement("style");
  style.id = "blast-radius-dynamic-styles";
  style.textContent = `
    #servicesPageTable tr,
    #instancesTable tr {
      cursor: pointer;
      transition: background 120ms ease, box-shadow 120ms ease;
    }

    #servicesPageTable tr:hover,
    #instancesTable tr:hover {
      background: rgba(58, 123, 255, 0.10);
    }

    #servicesPageTable tr.selected-service-row,
    #instancesTable tr.selected-instance-row {
      background: rgba(58, 123, 255, 0.20) !important;
      box-shadow: inset 4px 0 0 #4f7cff;
    }

    #servicesPageTable tr.selected-service-row td,
    #instancesTable tr.selected-instance-row td {
      background: rgba(58, 123, 255, 0.20) !important;
    }

    #servicesPageTable tr.selected-service-row td:first-child .service-name,
    #instancesTable tr.selected-instance-row td:first-child .service-name {
      color: #ffffff;
    }

    .drilldown-banner {
      margin-bottom: 12px;
      padding: 10px 12px;
      border: 1px solid rgba(56, 189, 248, 0.26);
      border-left: 4px solid rgba(56, 189, 248, 0.85);
      border-radius: 12px;
      background: rgba(56, 189, 248, 0.08);
      color: #dbeafe;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .drilldown-banner-title {
      font-weight: 900;
      letter-spacing: 0.02em;
    }

    .drilldown-banner-subtitle {
      color: var(--muted);
      font-size: 0.86rem;
      margin-top: 2px;
    }

    .drilldown-clear-btn {
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.88);
      color: #e5e7eb;
      border-radius: 9px;
      padding: 6px 9px;
      cursor: pointer;
      white-space: nowrap;
    }

    .drilldown-clear-btn:hover {
      border-color: rgba(56, 189, 248, 0.45);
      background: rgba(56, 189, 248, 0.12);
    }

    .drilldown-panel-highlight {
      box-shadow:
        0 0 0 2px rgba(56, 189, 248, 0.50),
        0 0 30px rgba(56, 189, 248, 0.18);
      border-color: rgba(56, 189, 248, 0.55) !important;
      transition: box-shadow 180ms ease, border-color 180ms ease;
    }

    .summary-card[data-summary-target] {
      cursor: pointer;
      position: relative;
      transition:
        transform 140ms ease,
        border-color 140ms ease,
        background 140ms ease,
        box-shadow 140ms ease;
    }

    .summary-card[data-summary-target]:hover {
      transform: translateY(-2px);
      border-color: rgba(56, 189, 248, 0.42);
      background:
        radial-gradient(circle at top right, rgba(56, 189, 248, 0.10), transparent 34%),
        rgba(15, 23, 42, 0.94);
      box-shadow:
        0 12px 30px rgba(0, 0, 0, 0.24),
        inset 0 0 0 1px rgba(56, 189, 248, 0.12);
    }

    .summary-card[data-summary-target]:focus {
      outline: 2px solid rgba(56, 189, 248, 0.65);
      outline-offset: 2px;
    }

    .summary-card[data-summary-target]::after {
      content: "Open";
      position: absolute;
      right: 12px;
      bottom: 10px;
      color: rgba(226, 232, 240, 0.54);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0;
      transform: translateX(-4px);
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .summary-card[data-summary-target]:hover::after,
    .summary-card[data-summary-target]:focus::after {
      opacity: 1;
      transform: translateX(0);
    }

    .dependency-chain-box {
      margin-top: 12px;
      border-top: 1px solid rgba(148, 163, 184, 0.16);
      padding-top: 12px;
    }

    .dependency-chain-title {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 10px;
      letter-spacing: 0.02em;
    }

    .dependency-chain-steps {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dependency-step {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 10px;
      align-items: start;
      padding: 8px 10px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.42);
    }

    .dependency-step-number {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(79, 124, 255, 0.18);
      color: #93c5fd;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .dependency-step-name {
      color: var(--text);
      font-weight: 700;
      word-break: break-word;
    }

    .dependency-step-type {
      color: var(--muted);
      font-size: 0.78rem;
      margin-top: 2px;
      word-break: break-word;
    }

    #serversView .servers-main-panel {
      height: calc(100vh - 245px);
      min-height: 520px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #serversView .servers-main-panel .panel-head {
      flex: 0 0 auto;
      position: relative;
      z-index: 30;
      background: #0b1220;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      padding-bottom: 12px;
    }

    #serversView .servers-table-scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
      background: #0b1220;
      position: relative;
      isolation: isolate;
    }

    #serversView .servers-scroll-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: #0b1220;
    }

    #serversView .servers-scroll-table thead {
      position: sticky;
      top: 0;
      z-index: 25;
      background: #0b1220;
    }

    #serversView .servers-scroll-table thead tr {
      background: #0b1220;
    }

    #serversView .servers-scroll-table thead th {
      position: sticky;
      top: 0;
      z-index: 26;
      background: #0b1220 !important;
      box-shadow:
        0 1px 0 rgba(148, 163, 184, 0.18),
        0 8px 12px rgba(11, 18, 32, 0.95);
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }

    #serversView .servers-scroll-table tbody td {
      background: #0b1220;
    }

    #serversView .servers-scroll-table tbody tr {
      background: #0b1220;
    }

    #serversView .servers-scroll-table tbody tr:hover td {
      background: rgba(58, 123, 255, 0.10);
    }

    #serversView .servers-scroll-table tbody tr.selected-instance-row td {
      background: rgba(58, 123, 255, 0.20) !important;
    }

    #serversView .servers-detail-panel {
      height: calc(100vh - 245px);
      min-height: 520px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #serversView .servers-detail-panel h2,
    #serversView .servers-detail-panel p {
      flex: 0 0 auto;
    }

    #serversView #instanceDetailPanel {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-right: 6px;
      background: #0b1220;
    }

    #serversView #instanceDetailPanel::-webkit-scrollbar,
    #serversView .servers-table-scroll::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    #serversView #instanceDetailPanel::-webkit-scrollbar-thumb,
    #serversView .servers-table-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.35);
      border-radius: 999px;
    }

    #serversView #instanceDetailPanel::-webkit-scrollbar-track,
    #serversView .servers-table-scroll::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.95);
    }

    #serversView .server-card {
      cursor: pointer;
    }

    #serversView .server-card.selected {
      box-shadow: inset 4px 0 0 #4f7cff;
      background: rgba(58, 123, 255, 0.12);
    }

    #serversView .servers-scroll-table thead th.sortable-header {
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }

    #serversView .servers-scroll-table thead th.sortable-header:hover {
      color: #ffffff;
      background: rgba(58, 123, 255, 0.10) !important;
    }

    #serversView .servers-scroll-table thead th.sortable-header[data-sort-active="true"] {
      color: #93c5fd;
    }

    #serversView .servers-scroll-table thead th.sortable-header[data-sort-active="true"][data-sort-direction="asc"]::after {
      content: " ▲";
      font-size: 0.7rem;
      color: #93c5fd;
    }

    #serversView .servers-scroll-table thead th.sortable-header[data-sort-active="true"][data-sort-direction="desc"]::after {
      content: " ▼";
      font-size: 0.7rem;
      color: #93c5fd;
    }

    #serversView #instanceSearch {
      min-width: 280px;
    }

    #dashboardView .dashboard-services-scroll {
      max-height: 520px;
      overflow: auto;
      scrollbar-gutter: stable;
      padding-right: 10px;
      background: #0b1220;
      border-top: 1px solid rgba(148, 163, 184, 0.12);
    }

    #dashboardView .dashboard-services-scroll table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: #0b1220;
    }

    #dashboardView .dashboard-services-scroll thead {
      position: sticky;
      top: 0;
      z-index: 20;
      background: #0b1220;
    }

    #dashboardView .dashboard-services-scroll thead th {
      position: sticky;
      top: 0;
      z-index: 21;
      background: #0b1220 !important;
      box-shadow:
        0 1px 0 rgba(148, 163, 184, 0.18),
        0 8px 12px rgba(11, 18, 32, 0.95);
    }

    #dashboardView .dashboard-services-scroll tbody td {
      background: #0b1220;
    }

    #dashboardView .dashboard-services-scroll::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    #dashboardView .dashboard-services-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.28);
      border-radius: 999px;
    }

    #dashboardView .dashboard-services-scroll::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.95);
    }

    .service-action-cell {
      position: relative;
      text-align: right;
    }

    .service-action-btn {
      min-width: 34px;
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.20);
      background: rgba(15, 23, 42, 0.85);
      color: #e5e7eb;
      cursor: pointer;
      font-weight: 800;
    }

    .service-action-btn:hover {
      background: rgba(58, 123, 255, 0.16);
      border-color: rgba(96, 165, 250, 0.45);
    }

    .service-action-menu {
      position: fixed;
      z-index: 9999;
      min-width: 180px;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.98);
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
    }

    .service-action-menu button {
      width: 100%;
      display: block;
      text-align: left;
      margin: 0;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #e5e7eb;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .service-action-menu button:hover {
      background: rgba(58, 123, 255, 0.18);
    }

    .full-rescan-btn {
      border-color: rgba(245, 158, 11, 0.45) !important;
      color: #fbbf24 !important;
    }

    .full-rescan-btn:hover {
      background: rgba(245, 158, 11, 0.12) !important;
    }

    .full-rescan-btn.running {
      opacity: 0.75;
      cursor: wait;
    }

    .compact-issue-group {
      margin-bottom: 14px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.42);
      overflow: hidden;
    }

    .compact-issue-group summary {
      cursor: pointer;
      list-style: none;
      padding: 12px 14px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      border-left: 4px solid rgba(56, 189, 248, 0.85);
      background: rgba(15, 23, 42, 0.78);
    }

    .compact-issue-group summary::-webkit-details-marker {
      display: none;
    }

    .compact-issue-group[open] summary {
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }

    .compact-issue-title {
      font-weight: 800;
      color: #e5e7eb;
    }

    .compact-issue-subtitle {
      margin-top: 3px;
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.35;
    }

    .compact-issue-body {
      padding: 12px 14px 14px;
    }

    .compact-issue-table {
      width: 100%;
      border-collapse: collapse;
    }

    .compact-issue-table th {
      color: var(--muted);
      font-size: 0.76rem;
      text-align: left;
      padding: 7px 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }

    .compact-issue-table td {
      padding: 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.08);
      vertical-align: top;
      font-size: 0.86rem;
    }

    .compact-issue-table tr:last-child td {
      border-bottom: 0;
    }

    .compact-muted {
      color: var(--muted);
      font-size: 0.78rem;
      margin-top: 2px;
    }

    .compact-issue-empty {
      color: var(--muted);
      padding: 10px 0;
    }

    .domain-chip {
      display: inline-block;
      margin: 3px 4px 3px 0;
      padding: 4px 8px;
      border-radius: 8px;
      background: rgba(148, 163, 184, 0.12);
      border: 1px solid rgba(148, 163, 184, 0.14);
      color: var(--text);
      font-size: 0.78rem;
      word-break: break-word;
    }
  `;
  style.textContent += `
  .node.selected {
    box-shadow: inset 4px 0 0 #4f7cff, 0 0 0 2px rgba(79, 124, 255, 0.22);
    border-color: rgba(79, 124, 255, 0.95);
  }

  #topologyLinksTable tr.selected {
    background: rgba(79, 124, 255, 0.18);
    box-shadow: inset 4px 0 0 #4f7cff;
  }

  #topologyLinksTable tr:hover {
    background: rgba(56, 189, 248, 0.08);
  }
`;
style.textContent += `
      .docker-owner-row td {
        background: rgba(56, 189, 248, 0.08);
        border-top: 1px solid rgba(56, 189, 248, 0.22);
        border-bottom: 1px solid rgba(56, 189, 248, 0.12);
        cursor: pointer;
      }

      .docker-child-row td {
        background: rgba(15, 23, 42, 0.38);
      }

      .docker-child-row:hover td,
      .docker-owner-row:hover td {
        background: rgba(79, 124, 255, 0.16);
      }
    `;
    style.textContent += `
      /* docker-hierarchy-v2-styles */
      .docker-sort-header {
        all: unset;
        cursor: pointer;
        color: inherit;
        font: inherit;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .docker-sort-header:hover {
        color: #38bdf8;
      }

      .docker-drilldown-table thead th {
        position: sticky;
        top: 0;
        z-index: 4;
        background: rgba(15, 23, 42, 0.98);
      }

      .docker-owner-row td {
        background: rgba(56, 189, 248, 0.08);
        border-top: 1px solid rgba(56, 189, 248, 0.22);
        border-bottom: 1px solid rgba(56, 189, 248, 0.12);
        cursor: pointer;
      }

      .docker-child-row td {
        background: rgba(15, 23, 42, 0.42);
      }

      .docker-owner-row:hover td,
      .docker-child-row:hover td {
        background: rgba(79, 124, 255, 0.16);
      }
    `;
    style.textContent += `
      .mini-action-btn {
        border: 1px solid rgba(56, 189, 248, 0.35);
        background: rgba(15, 23, 42, 0.84);
        color: #dbeafe;
        border-radius: 8px;
        padding: 5px 8px;
        cursor: pointer;
        font-size: 0.76rem;
      }

      .mini-action-btn:hover {
        background: rgba(56, 189, 248, 0.14);
        border-color: rgba(56, 189, 248, 0.62);
      }
    `;
    document.head.appendChild(style);
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (["ok", "healthy", "running", "clear"].includes(s)) return "healthy";
  if (["degraded", "medium", "high", "critical"].includes(s)) return "degraded";
  return "offline";
}

function labelStatus(status) {
  if (status === "ok") return "OK";
  return String(status || "unknown").toUpperCase();
}

function isIpAddress(value) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(String(value || "").trim());
}

function sanitizeForClient(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function chainLabel(part) {
  const raw = safeText(part);
  const clean = raw
    .replace(/^npm-proxy-/, "")
    .replace(/^incus-remote-/, "")
    .replace(/^incus-instance-/, "")
    .replace(/-/g, " ");

  if (raw === "internet") return { name: "Internet", type: "External entry point" };
  if (raw === "cloudflare") return { name: "Cloudflare", type: "DNS / public edge" };
  if (raw === "udm-beast") return { name: "UDM Beast", type: "Network gateway" };
  if (raw === "npm") return { name: "Nginx Proxy Manager", type: "Reverse proxy" };
  if (raw.startsWith("npm-proxy-")) return { name: clean, type: "NPM proxy host" };
  if (raw.startsWith("incus-remote-")) return { name: clean, type: "Incus remote" };
  if (raw.startsWith("incus-instance-")) return { name: clean, type: "Incus instance" };
  return { name: clean || raw, type: "Dependency" };
}

function dependencyChainHtml(dependsOn) {
  const chain = Array.isArray(dependsOn) ? dependsOn : [];

  if (!chain.length) {
    return `
      <div class="dependency-chain-box">
        <div class="dependency-chain-title">Dependency Chain</div>
        <div class="dependency-step">
          <div class="dependency-step-number">—</div>
          <div>
            <div class="dependency-step-name">Not available</div>
            <div class="dependency-step-type">No dependency path was returned.</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="dependency-chain-box">
      <div class="dependency-chain-title">Dependency Chain</div>
      <div class="dependency-chain-steps">
        ${chain.map((part, index) => {
          const label = chainLabel(part);
          return `
            <div class="dependency-step">
              <div class="dependency-step-number">${index + 1}</div>
              <div>
                <div class="dependency-step-name">${label.name}</div>
                <div class="dependency-step-type">${label.type}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function remoteSort(a, b) {
  const ai = remoteDisplayOrder.indexOf(a.name);
  const bi = remoteDisplayOrder.indexOf(b.name);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return safeText(a.name).localeCompare(safeText(b.name));
}

function setView(viewName) {
  state.currentView = viewName;

  const views = {
    dashboard: document.getElementById("dashboardView"),
    services: document.getElementById("servicesView"),
    servers: document.getElementById("serversView"),
    brokenPaths: document.getElementById("brokenPathsView"),
    blastRadius: document.getElementById("blastRadiusView"),
    topology: document.getElementById("topologyView")
  };

  const navs = {
    dashboard: document.getElementById("navDashboard"),
    services: document.getElementById("navServices"),
    servers: document.getElementById("navServers"),
    brokenPaths: document.getElementById("navBrokenPaths"),
    blastRadius: document.getElementById("navBlastRadius"),
    topology: document.getElementById("navTopology")
  };

  Object.values(views).forEach(view => view.style.display = "none");

  // Clear both built-in nav items and later extension nav items such as NPM / Proxy Hosts.
  document.querySelectorAll(".nav-item, nav a, aside a, aside button").forEach(item => {
    item.classList.remove("active");
  });

  Object.values(navs).forEach(nav => nav.classList.remove("active"));

  views[viewName].style.display = "block";
  navs[viewName].classList.add("active");

  const titles = {
    dashboard: ["Overview", "Homelab dependency and impact dashboard"],
    services: ["Services", "Public services, NPM targets, and Incus ownership"],
    servers: ["Servers", "Incus remotes, instances, IPs, and public service ownership"],
    brokenPaths: ["Broken Paths", "Public service failures traced through NPM and Incus"],
    blastRadius: ["BlastRadius", "Simulated failure impact across public services"],
    topology: ["Topology", "Diagnostic topology explorer. Click a component to inspect ownership, services, and dependencies."]
  };

  document.getElementById("pageTitle").textContent = titles[viewName][0];
  document.getElementById("pageSubtitle").textContent = titles[viewName][1];

  if (viewName === "services") renderServicesPage();
  if (viewName === "servers") renderServersPage();
  if (viewName === "brokenPaths") loadBrokenPaths();
  if (viewName === "blastRadius") renderBlastPage();
  if (viewName === "topology") renderTopologyPage();
}

function clearInputValue(id) {
  const element = document.getElementById(id);
  if (element) element.value = "";
}

function setSelectValueIfPresent(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function drilldownTitle(target) {
  const titles = {
    "incus-hosts": "Drill-down: Incus Hosts",
    "incus-instances": "Drill-down: Incus Instances",
    "docker-containers": "Drill-down: Nested Docker Containers",
    "proxy-hosts": "Drill-down: NPM Proxy Hosts",
    "public-services": "Drill-down: Public Services",
    "unifi-devices": "Drill-down: UniFi / Topology"
  };

  return titles[target] || "Drill-down";
}

function drilldownSubtitle(target) {
  const subtitles = {
    "incus-hosts": "Showing Incus server cards and host ownership.",
    "incus-instances": "Showing the Incus instance inventory table.",
    "docker-containers": "Showing Incus instances with nested Docker discovery details.",
    "proxy-hosts": "Showing public services and NPM target ownership.",
    "public-services": "Showing public services and dependency details.",
    "unifi-devices": "Opening topology view for network context."
  };

  return subtitles[target] || "Showing the selected detail view.";
}

function ensureDrilldownBanner(viewId) {
  const view = document.getElementById(viewId);
  if (!view) return null;

  let banner = view.querySelector(".drilldown-banner");

  if (!banner) {
    banner = document.createElement("div");
    banner.className = "drilldown-banner";
    banner.innerHTML = `
      <div>
        <div class="drilldown-banner-title"></div>
        <div class="drilldown-banner-subtitle"></div>
      </div>
      <button class="drilldown-clear-btn" type="button">Clear Drill-down</button>
    `;

    const firstPanel = view.querySelector(".panel");
    if (firstPanel && firstPanel.parentElement) {
      firstPanel.parentElement.insertBefore(banner, firstPanel);
    } else {
      view.insertBefore(banner, view.firstChild);
    }

    const clearButton = banner.querySelector(".drilldown-clear-btn");
    clearButton.addEventListener("click", () => {
      state.summaryDrilldown = null;
      renderDrilldownBanner();
    });
  }

  return banner;
}

function renderDrilldownBanner() {
  document.querySelectorAll(".drilldown-banner").forEach(banner => {
    banner.style.display = "none";
  });

  if (!state.summaryDrilldown) return;

  const viewId = state.currentView === "servers"
    ? "serversView"
    : state.currentView === "services"
      ? "servicesView"
      : state.currentView === "topology"
        ? "topologyView"
        : null;

  if (!viewId) return;

  const banner = ensureDrilldownBanner(viewId);
  if (!banner) return;

  banner.querySelector(".drilldown-banner-title").textContent = drilldownTitle(state.summaryDrilldown);
  banner.querySelector(".drilldown-banner-subtitle").textContent = drilldownSubtitle(state.summaryDrilldown);
  banner.style.display = "flex";
}

function highlightPanel(panel) {
  if (!panel) return;

  document.querySelectorAll(".drilldown-panel-highlight").forEach(item => {
    item.classList.remove("drilldown-panel-highlight");
  });

  panel.classList.add("drilldown-panel-highlight");

  setTimeout(() => {
    panel.classList.remove("drilldown-panel-highlight");
  }, 1800);
}

function scrollToDrilldownTarget(target) {
  setTimeout(() => {
    let panel = null;

    if (target === "incus-hosts") {
      panel = document.querySelector("#serversView .panel");
    }

    if (target === "incus-instances" || target === "docker-containers") {
      const instancesTitle = [...document.querySelectorAll("#serversView h2")]
        .find(h => h.textContent.toLowerCase().includes("incus instances"));

      panel = instancesTitle ? instancesTitle.closest(".panel") : null;
    }

    if (target === "proxy-hosts" || target === "public-services") {
      panel = document.querySelector("#servicesView .panel");
    }

    if (target === "unifi-devices") {
      panel = document.querySelector("#topologyView .panel");
    }

    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightPanel(panel);
    }
  }, 150);
}


function firstIncusHostNameForDrilldown() {
  const hosts = (state.model?.components || [])
    .filter(component => component.type === "incus-host")
    .sort(remoteSort);

  return hosts[0]?.name || "all";
}


function drillDownFromSummary(target) {
  state.summaryDrilldown = target;

  switch (target) {
    case "incus-hosts":
      state.selectedServer = firstIncusHostNameForDrilldown();
      state.selectedInstanceKey = null;
      clearInputValue("instanceSearch");
      setSelectValueIfPresent("instanceStatusFilter", "all");
      setSelectValueIfPresent("instanceTypeFilter", "all");
      setView("servers");
      break;

    case "incus-instances":
      state.selectedServer = "all";
      clearInputValue("instanceSearch");
      setSelectValueIfPresent("instanceStatusFilter", "all");
      setSelectValueIfPresent("instanceTypeFilter", "all");
      setView("servers");
      break;

    case "docker-containers":
      state.selectedServer = "all";
      state.selectedInstanceKey = null;
      clearInputValue("instanceSearch");
      clearInputValue("dockerContainerSearch");
      setSelectValueIfPresent("instanceStatusFilter", "all");
      setSelectValueIfPresent("instanceTypeFilter", "container");
      setView("servers");
      break;

    case "proxy-hosts":
      clearInputValue("servicesPageSearch");
      setSelectValueIfPresent("servicesStatusFilter", "all");
      setSelectValueIfPresent("servicesOwnerFilter", "all");
      setView("services");
      break;

    case "unifi-devices":
      setView("topology");
      break;

    case "public-services":
      clearInputValue("servicesPageSearch");
      setSelectValueIfPresent("servicesStatusFilter", "all");
      setSelectValueIfPresent("servicesOwnerFilter", "all");
      setView("services");
      break;

    default:
      state.summaryDrilldown = null;
      setView("dashboard");
      break;
  }

  renderDrilldownBanner();
  scrollToDrilldownTarget(target);
}

function wireSummaryCards() {
  document.querySelectorAll(".summary-card[data-summary-target]").forEach(card => {
    card.addEventListener("click", () => {
      drillDownFromSummary(card.dataset.summaryTarget);
    });

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        drillDownFromSummary(card.dataset.summaryTarget);
      }
    });
  });
}

function renderSummary(summary) {
  const cards = [
    {
      icon: "▰",
      color: "var(--blue)",
      title: "Incus Hosts",
      primary: `${summary.incusHosts.online} / ${summary.incusHosts.total} online`,
      secondary: `${summary.incusHosts.total - summary.incusHosts.online} offline`,
      target: "incus-hosts",
      hint: "Open Servers"
    },
    {
      icon: "▣",
      color: "var(--cyan)",
      title: "Incus Instances",
      primary: `${summary.incusInstances.running} running`,
      secondary: `${summary.incusInstances.stopped} stopped`,
      target: "incus-instances",
      hint: "Open Servers"
    },
    {
      icon: "◈",
      color: "var(--purple)",
      title: "Docker Containers",
      primary: `${summary.dockerContainers.running} running`,
      secondary: `${summary.dockerContainers.unhealthy} unhealthy`,
      target: "docker-containers",
      hint: "Open Servers"
    },
    {
      icon: "⬡",
      color: "var(--purple)",
      title: "Proxy Hosts (NPM)",
      primary: `${summary.proxyHosts.active} active`,
      secondary: `${summary.proxyHosts.broken} broken`,
      target: "proxy-hosts",
      hint: "Open Services"
    },
    {
      icon: "⌁",
      color: "var(--blue)",
      title: "UniFi Devices",
      primary: `${summary.unifiDevices.online} online`,
      secondary: `${summary.unifiDevices.offline} offline`,
      target: "unifi-devices",
      hint: "Open Topology"
    },
    {
      icon: "◎",
      color: "var(--green)",
      title: "Public Services",
      primary: `${summary.publicServices.healthy} healthy`,
      secondary: `${summary.publicServices.degraded} degraded`,
      target: "public-services",
      hint: "Open Services"
    }
  ];

  document.getElementById("summaryCards").innerHTML = cards.map(card => `
    <article
      class="summary-card"
      style="color:${card.color}"
      data-summary-target="${card.target}"
      tabindex="0"
      role="button"
      aria-label="${card.title}: ${card.hint}"
      title="${card.hint}"
    >
      <div class="icon">${card.icon}</div>
      <h3>${card.title}</h3>
      <p>${card.primary}</p>
      <small>${card.secondary}</small>
    </article>
  `).join("");

  wireSummaryCards();

  const total = summary.publicServices.healthy + summary.publicServices.degraded;
  const health = total ? Math.round((summary.publicServices.healthy / total) * 100) : 100;

  document.getElementById("healthPercent").textContent = `${health}%`;
  document.getElementById("healthLabel").textContent = health >= 95 ? "Excellent" : health >= 85 ? "Good" : "Needs Attention";
  document.getElementById("healthNote").textContent = `${summary.publicServices.healthy} of ${total} public services healthy`;
  document.getElementById("alertCount").textContent = String(summary.publicServices.degraded + summary.proxyHosts.broken);

  const degraded = document.getElementById("dashboardDegradedCount");
  if (degraded) degraded.textContent = String(summary.publicServices.degraded);
}

function clearDynamicNodePositions() {
  for (const key of Object.keys(nodePositions)) {
    if (!["internet", "cloudflare", "udm-beast", "npm"].includes(key)) delete nodePositions[key];
  }
}

function addCleanMapNodePositions(model) {
  clearDynamicNodePositions();

  const incusHosts = (model.components || [])
    .filter(c => c.type === "incus-host")
    .sort(remoteSort)
    .slice(0, 10);

  const leftColumn = [[590, 40], [590, 140], [590, 240], [590, 340], [590, 440]];
  const rightColumn = [[780, 40], [780, 140], [780, 240], [780, 340], [780, 440]];

  incusHosts.forEach((component, index) => {
    const positions = index < 5 ? leftColumn : rightColumn;
    nodePositions[component.id] = positions[index % 5];
  });

  (model.components || [])
    .filter(c => c.type === "proxy-host" && c.id.startsWith("npm-proxy-") && c.status !== "ok")
    .slice(0, 4)
    .forEach((component, index) => {
      nodePositions[component.id] = [970, 70 + (index * 105)];
    });
}

function drawLine(container, from, to, status) {
  const fromPos = nodePositions[from];
  const toPos = nodePositions[to];
  if (!fromPos || !toPos) return;

  const [x1, y1] = fromPos;
  const [x2, y2] = toPos;
  const startX = x1 + 86;
  const startY = y1 + 37;
  const endX = x2 + 86;
  const endY = y2 + 37;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  const line = document.createElement("div");
  line.className = `link-line ${status === "degraded" ? "degraded" : ""}`;
  line.style.left = `${startX}px`;
  line.style.top = `${startY}px`;
  line.style.width = `${length}px`;
  line.style.transform = `rotate(${angle}deg)`;
  container.appendChild(line);
}


function ensureMapPurposeLabels() {
  if (!document.getElementById("mapPurposeLabelStyles")) {
    const style = document.createElement("style");
    style.id = "mapPurposeLabelStyles";
    style.textContent = `
      .map-purpose-hint {
        color: var(--muted);
        font-size: 0.86rem;
        line-height: 1.35;
        margin-top: 4px;
      }

      .map-purpose-hint strong {
        color: #93c5fd;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  const ensureHintAfterHeading = (headingText, html) => {
    const heading = [...document.querySelectorAll("h2, h3")]
      .find(item => item.textContent.trim() === headingText);

    if (!heading) return;

    let hint = heading.parentElement.querySelector(`.map-purpose-hint[data-purpose="${headingText}"]`);

    if (!hint) {
      hint = document.createElement("div");
      hint.className = "map-purpose-hint";
      hint.dataset.purpose = headingText;
      heading.insertAdjacentElement("afterend", hint);
    }

    hint.innerHTML = html;
  };

  ensureHintAfterHeading(
    "Dependency Map",
    `<strong>Impact shortcut map.</strong> Click a component to open BlastRadius analysis for affected services.`
  );

  ensureHintAfterHeading(
    "Topology Summary",
    `<strong>Inspection view.</strong> Click topology nodes for ownership and service details; use BlastRadius for failure impact.`
  );
}

function renderMap(model) {
  const map = document.getElementById("dependencyMap");
  ensureMapPurposeLabels();
  if (!map) return;

  map.innerHTML = "";
  addCleanMapNodePositions(model);

  const links = [
    ["internet", "cloudflare"],
    ["cloudflare", "udm-beast"],
    ["udm-beast", "npm"]
  ];

  (model.components || [])
    .filter(component => component.type === "incus-host")
    .sort(remoteSort)
    .slice(0, 10)
    .forEach(component => links.push(["npm", component.id]));

  links.forEach(link => drawLine(map, link[0], link[1], "ok"));

  (model.components || [])
    .filter(component => nodePositions[component.id])
    .forEach(component => {
      const [x, y] = nodePositions[component.id];
      const node = document.createElement("div");
      node.className = `node ${component.status === "degraded" ? "degraded" : component.status === "offline" ? "offline" : ""}`;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.dataset.componentId = component.id;
      node.innerHTML = `
        <div class="node-name">${icons[component.type] || "●"} ${component.name}</div>
        <div class="node-sub">${component.subtitle || component.type}</div>
        <div class="node-status">${labelStatus(component.status)}</div>
      `;
      node.addEventListener("click", () => {
        state.selectedBlastComponentId = component.id;
        setView("blastRadius");
      });
      map.appendChild(node);
    });
}



function certificateWarningDays() {
  const thresholds =
    state.model &&
    state.model.discovery &&
    state.model.discovery.certificates &&
    state.model.discovery.certificates.thresholds
      ? state.model.discovery.certificates.thresholds
      : {};

  return thresholds.lowDays || 60;
}

function issueSummaryText(issue) {
  if (!issue) return "Issue detected";

  if (
    issue.type === "certificate-expiration-summary" ||
    issue.type === "orphaned-certificates-summary" ||
    issue.type === "stopped-incus-summary"
  ) {
    return issue.text || "Issue detected";
  }

  if (issue.type === "certificate-expiration") {
    const cert = issue.certificate || {};
    return `${cert.name || "Certificate"} expires in ${cert.daysRemaining} day(s)`;
  }

  if (issue.type === "orphaned-certificates") {
    const certs = Array.isArray(issue.certificates) ? issue.certificates : [];
    const names = certs.slice(0, 5).map(cert => cert.name).filter(Boolean).join(", ");
    const more = certs.length > 5 ? `, plus ${certs.length - 5} more` : "";
    return `${issue.count || certs.length || 0} orphaned NPM certificate(s) found${names ? `: ${names}${more}` : ""}`;
  }

  if (issue.type === "stopped-incus-instances") {
    return `${issue.count || 0} stopped Incus instance(s) with no matched public services`;
  }

  if (issue.type === "stopped-public-service-owner") {
    return `${issue.title || "Stopped public service owner"} affects ${issue.count || 0} public service(s)`;
  }

  return issue.text || issue.title || "Issue detected";
}

function dashboardIssueSummaryItems(items) {
  const list = Array.isArray(items) ? items : [];

  const certExpiring = list.filter(issue => issue.type === "certificate-expiration");
  const orphanedCerts = list.filter(issue => issue.type === "orphaned-certificates");
  const stoppedIncus = list.filter(issue => issue.type === "stopped-incus-instances");

  const hiddenTypes = new Set([
    "certificate-expiration",
    "orphaned-certificates",
    "stopped-incus-instances"
  ]);

  const otherIssues = list.filter(issue => !hiddenTypes.has(issue.type));
  const summaries = [];

  if (certExpiring.length) {
    const sorted = [...certExpiring].sort((a, b) => {
      const ad = a.certificate ? Number(a.certificate.daysRemaining) : 9999;
      const bd = b.certificate ? Number(b.certificate.daysRemaining) : 9999;
      return ad - bd;
    });

    const cert = sorted[0]?.certificate || {};

    summaries.push({
      severity: "low",
      type: "certificate-expiration-summary",
      text: `${certExpiring.length} certificate(s) expire within ${certificateWarningDays()} days; soonest is ${cert.name || "unknown"} in ${cert.daysRemaining} day(s)`
    });
  }

  if (orphanedCerts.length) {
    const certs = orphanedCerts.flatMap(issue => Array.isArray(issue.certificates) ? issue.certificates : []);
    const total = orphanedCerts.reduce((sum, issue) => sum + Number(issue.count || 0), 0);
    const names = certs.slice(0, 5).map(cert => cert.name).filter(Boolean).join(", ");
    const more = certs.length > 5 ? `, plus ${certs.length - 5} more` : "";

    summaries.push({
      severity: "low",
      type: "orphaned-certificates-summary",
      text: `${total} orphaned NPM certificate(s) found${names ? `: ${names}${more}` : ""}`
    });
  }

  if (stoppedIncus.length) {
    const total = stoppedIncus.reduce((sum, issue) => sum + Number(issue.count || 0), 0);

    summaries.push({
      severity: "low",
      type: "stopped-incus-summary",
      text: `${total} stopped Incus instance(s) with no matched public services`
    });
  }

  summaries.push(...otherIssues);
  return summaries;
}

function severityClass(severity) {
  return ["high", "medium", "low", "clear"].includes(String(severity || "").toLowerCase())
    ? String(severity).toLowerCase()
    : "low";
}

function renderIssueDetailCard(issue) {
  const severity = severityClass(issue.severity);

  if (issue.type === "certificate-expiration") {
    const cert = issue.certificate || {};
    const proxyHosts = Array.isArray(issue.proxyHosts) ? issue.proxyHosts : [];

    return `
      <div class="issue-group issue-${severity}">
        <div class="impact-severity ${severity}">${issue.title || "Certificate expiration"}</div>
        <div class="affected-row"><span>Severity</span><span class="severity-pill ${severity}">${severity}</span></div>
        <div class="affected-row"><span>Certificate</span><span>${cert.name || "unknown"}</span></div>
        <div class="affected-row"><span>Provider</span><span>${cert.provider || "unknown"}</span></div>
        <div class="affected-row"><span>Expires</span><span>${cert.expiresAt ? new Date(cert.expiresAt).toLocaleString() : "unknown"}</span></div>
        <div class="affected-row"><span>Days Remaining</span><span>${cert.daysRemaining}</span></div>
        <div class="affected-row"><span>Impact</span><span>${issue.impact || "Unknown"}</span></div>
        <div class="dependency-chain-box">
          <div class="dependency-chain-title">Certificate Domains</div>
          <div class="url-chips">
            ${(cert.domains || []).map(domain => `<span class="domain-chip">${domain}</span>`).join("") || `<span class="domain-chip">No domains returned</span>`}
          </div>
        </div>
        <div class="dependency-chain-box">
          <div class="dependency-chain-title">Matched NPM Proxy Hosts</div>
          <div class="dependency-chain-steps">
            ${proxyHosts.length ? proxyHosts.map((host, index) => `
              <div class="dependency-step">
                <div class="dependency-step-number">${index + 1}</div>
                <div>
                  <div class="dependency-step-name">${(host.domains || [])[0] || `proxy-host-${host.id}`}</div>
                  <div class="dependency-step-type">${(host.domains || []).join(", ")}</div>
                  <div class="dependency-step-type">Target: ${host.forwardHost}:${host.forwardPort}</div>
                </div>
              </div>
            `).join("") : `
              <div class="dependency-step">
                <div class="dependency-step-number">—</div>
                <div>
                  <div class="dependency-step-name">No matched active proxy hosts</div>
                  <div class="dependency-step-type">This may be unused, external-use, or not mapped by NPM.</div>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  if (issue.type === "orphaned-certificates") {
    const certificates = Array.isArray(issue.certificates) ? issue.certificates : [];

    return `
      <div class="issue-group issue-low">
        <div class="impact-severity low">${issue.title || "Orphaned NPM certificates"}</div>
        <div class="affected-row"><span>Severity</span><span class="severity-pill low">low</span></div>
        <div class="affected-row"><span>Impact</span><span>${issue.impact || "Cleanup/config hygiene issue"}</span></div>
        <div class="affected-row"><span>Orphaned Certificates</span><span>${certificates.length}</span></div>
        <div class="dependency-chain-box">
          <div class="dependency-chain-title">Certificates not used by active NPM proxy hosts</div>
          <div class="dependency-chain-steps">
            ${certificates.map((cert, index) => `
              <div class="dependency-step">
                <div class="dependency-step-number">${index + 1}</div>
                <div>
                  <div class="dependency-step-name">${cert.name || "certificate"}</div>
                  <div class="dependency-step-type">Provider: ${cert.provider || "unknown"}</div>
                  <div class="dependency-step-type">Expires: ${cert.expiresAt ? new Date(cert.expiresAt).toLocaleString() : "unknown"}</div>
                  <div class="dependency-step-type">Days remaining: ${cert.daysRemaining}</div>
                  <div class="url-chips">
                    ${(cert.domains || []).map(domain => `<span class="domain-chip">${domain}</span>`).join("")}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  if (issue.type === "stopped-incus-instances") {
    const instances = Array.isArray(issue.instances) ? issue.instances : [];

    return `
      <div class="issue-group issue-low">
        <div class="impact-severity low">${issue.title || "Stopped Incus instances"}</div>
        <div class="affected-row"><span>Severity</span><span class="severity-pill low">low</span></div>
        <div class="affected-row"><span>Impact</span><span>${issue.impact || "No matched public services"}</span></div>
        <div class="affected-row"><span>Stopped Instances</span><span>${instances.length}</span></div>
        <div class="dependency-chain-box">
          <div class="dependency-chain-title">Stopped Incus Instances</div>
          <div class="dependency-chain-steps">
            ${instances.map((instance, index) => `
              <div class="dependency-step">
                <div class="dependency-step-number">${index + 1}</div>
                <div>
                  <div class="dependency-step-name">${instance.remote} / ${instance.name}</div>
                  <div class="dependency-step-type">${instance.type || "instance"} · ${instance.status || "stopped"}</div>
                  <div class="dependency-step-type">Preferred IP: ${instance.preferredIp || "none"}</div>
                  <div class="dependency-step-type">Snapshots: ${instance.snapshots || 0}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="issue-group issue-${severity}">
      <div class="impact-severity ${severity}">${issue.title || issue.severity || "Issue"}</div>
      <div class="affected-row"><span>Severity</span><span class="severity-pill ${severity}">${severity}</span></div>
      <div class="affected-row"><span>Detail</span><span>${issue.text || "No detail available"}</span></div>
    </div>
  `;
}

function compactIssueStatus(severity) {
  const safe = severityClass ? severityClass(severity) : String(severity || "low").toLowerCase();
  return `<span class="severity-pill ${safe}">${safe}</span>`;
}

function compactDate(value) {
  if (!value) return "unknown";
  try {
    return new Date(value).toLocaleDateString();
  } catch (_) {
    return String(value);
  }
}

function compactIssueGroup(title, subtitle, severity, count, bodyHtml, open = false) {
  return `
    <details class="compact-issue-group issue-${severityClass(severity)}" ${open ? "open" : ""}>
      <summary>
        <div>
          <div class="compact-issue-title">${title}</div>
          <div class="compact-issue-subtitle">${subtitle}</div>
        </div>
        <div>${compactIssueStatus(severity)} <span class="domain-chip">${count}</span></div>
      </summary>
      <div class="compact-issue-body">
        ${bodyHtml}
      </div>
    </details>
  `;
}

function renderCertificateExpirationGroup(issues) {
  const sorted = [...issues].sort((a, b) => {
    const ad = a.certificate ? Number(a.certificate.daysRemaining) : 9999;
    const bd = b.certificate ? Number(b.certificate.daysRemaining) : 9999;
    return ad - bd;
  });

  const soonest = sorted[0]?.certificate || {};
  const rows = sorted.map(issue => {
    const cert = issue.certificate || {};
    const hosts = Array.isArray(issue.proxyHosts) ? issue.proxyHosts : [];

    return `
      <tr>
        <td>
          <div class="service-name">${cert.name || "unknown"}</div>
          <div class="compact-muted">${(cert.domains || []).join(", ") || "No domains returned"}</div>
        </td>
        <td>${cert.daysRemaining}</td>
        <td>${compactDate(cert.expiresAt)}</td>
        <td>${hosts.length ? hosts.map(host => `${(host.domains || [])[0] || host.id} → ${host.forwardHost}:${host.forwardPort}`).join("<br>") : "No matched active proxy host"}</td>
      </tr>
    `;
  }).join("");

  return compactIssueGroup(
    "Certificate Expiration",
    `${issues.length} certificate(s) expire within ${certificateWarningDays()} days; soonest is ${soonest.name || "unknown"} in ${soonest.daysRemaining} day(s).`,
    "low",
    `${issues.length} certs`,
    `
      <table class="compact-issue-table">
        <thead>
          <tr>
            <th>Certificate</th>
            <th>Days</th>
            <th>Expires</th>
            <th>NPM Proxy Host</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  );
}

function renderOrphanedCertificateGroup(issues) {
  const certs = issues.flatMap(issue => Array.isArray(issue.certificates) ? issue.certificates : []);

  const rows = certs.map(cert => `
    <tr>
      <td>
        <div class="service-name">${cert.name || "unknown"}</div>
        <div class="compact-muted">${(cert.domains || []).join(", ") || "No domains returned"}</div>
      </td>
      <td>${cert.provider || "unknown"}</td>
      <td>${cert.daysRemaining}</td>
      <td>${compactDate(cert.expiresAt)}</td>
    </tr>
  `).join("");

  return compactIssueGroup(
    "Orphaned NPM Certificates",
    `${certs.length} certificate(s) exist in NPM but are not used by any active NPM proxy host.`,
    "low",
    `${certs.length} orphaned`,
    rows
      ? `
        <table class="compact-issue-table">
          <thead>
            <tr>
              <th>Certificate</th>
              <th>Provider</th>
              <th>Days</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
      : `<div class="compact-issue-empty">No orphaned certificates returned.</div>`
  );
}

function renderStoppedIncusGroup(issues) {
  const instances = issues.flatMap(issue => Array.isArray(issue.instances) ? issue.instances : []);

  const rows = instances.map(instance => `
    <tr>
      <td>
        <div class="service-name">${instance.remote} / ${instance.name}</div>
        <div class="compact-muted">${instance.type || "instance"} · ${instance.status || "stopped"}</div>
      </td>
      <td>${instance.preferredIp || "none"}</td>
      <td>${instance.preferredInterface || "none"}</td>
      <td>${instance.snapshots || 0}</td>
    </tr>
  `).join("");

  return compactIssueGroup(
    "Stopped Incus Instances",
    `${instances.length} stopped Incus instance(s) have no matched public services.`,
    "low",
    `${instances.length} stopped`,
    rows
      ? `
        <table class="compact-issue-table">
          <thead>
            <tr>
              <th>Instance</th>
              <th>Preferred IP</th>
              <th>Interface</th>
              <th>Snapshots</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
      : `<div class="compact-issue-empty">No stopped instances returned.</div>`
  );
}

function renderOtherIssueGroup(issues, severity) {
  const rows = issues.map(issue => `
    <tr>
      <td>
        <div class="service-name">${issue.title || issue.type || "Issue"}</div>
        <div class="compact-muted">${issue.text || "No detail available"}</div>
      </td>
      <td>${issue.impact || ""}</td>
    </tr>
  `).join("");

  return compactIssueGroup(
    `${severity.toUpperCase()} Issues`,
    `${issues.length} additional issue(s).`,
    severity,
    `${issues.length}`,
    `
      <table class="compact-issue-table">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `,
    severity === "high"
  );
}

function renderAllIssuesPanel(issues) {
  const container = document.getElementById("allIssuesList");
  if (!container) return;

  const list = Array.isArray(issues) ? issues : [];

  if (!list.length) {
    container.innerHTML = `
      <div class="issue-group issue-clear">
        <div class="impact-severity clear">No active issues detected</div>
        <div class="affected-row"><span>Infrastructure and public service checks are currently clear.</span><span class="severity-pill clear">clear</span></div>
      </div>
    `;
    return;
  }

  const certExpiring = list.filter(issue => issue.type === "certificate-expiration");
  const orphanedCerts = list.filter(issue => issue.type === "orphaned-certificates");
  const stoppedIncus = list.filter(issue => issue.type === "stopped-incus-instances");

  const groupedTypes = new Set([
    "certificate-expiration",
    "orphaned-certificates",
    "stopped-incus-instances"
  ]);

  const otherHigh = list.filter(issue => issue.severity === "high" && !groupedTypes.has(issue.type));
  const otherMedium = list.filter(issue => issue.severity === "medium" && !groupedTypes.has(issue.type));
  const otherLow = list.filter(issue => (!issue.severity || issue.severity === "low") && !groupedTypes.has(issue.type));

  const cards = [];

  if (otherHigh.length) cards.push(renderOtherIssueGroup(otherHigh, "high"));
  if (otherMedium.length) cards.push(renderOtherIssueGroup(otherMedium, "medium"));
  if (certExpiring.length) cards.push(renderCertificateExpirationGroup(certExpiring));
  if (orphanedCerts.length) cards.push(renderOrphanedCertificateGroup(orphanedCerts));
  if (stoppedIncus.length) cards.push(renderStoppedIncusGroup(stoppedIncus));
  if (otherLow.length) cards.push(renderOtherIssueGroup(otherLow, "low"));

  container.innerHTML = cards.join("");
}

function ensureAllIssuesPanel() {
  const brokenPathsView = document.getElementById("brokenPathsView");
  if (!brokenPathsView || document.getElementById("allIssuesList")) return;

  const panel = document.createElement("div");
  panel.id = "allIssuesPanel";
  panel.className = "panel services-panel";
  panel.innerHTML = `
    <div class="panel-head table-head">
      <h2>All Current Issues</h2>
      <button id="refreshAllIssuesBtn">↻ Refresh Issues</button>
    </div>
    <div id="allIssuesList" class="impact-result"></div>
  `;

  const target =
    brokenPathsView.querySelector(".content-grid") ||
    brokenPathsView.querySelector(".page-grid") ||
    brokenPathsView.querySelector(".dashboard-grid") ||
    brokenPathsView.querySelector(".main-grid") ||
    brokenPathsView.querySelector(".panel")?.parentElement ||
    brokenPathsView;

  target.insertBefore(panel, target.firstChild);

  const btn = document.getElementById("refreshAllIssuesBtn");
  if (btn) {
    btn.addEventListener("click", () => loadBrokenPaths(true));
  }
}


function groupIssues(issues) {
  return (issues || []).reduce((acc, issue) => {
    acc[issue.severity] ||= [];
    acc[issue.severity].push(issue);
    return acc;
  }, {});
}

function renderIssues(issues) {
  const issuesList = document.getElementById("issuesList");
  if (!issuesList) return;

  const list = Array.isArray(issues) ? issues : [];

  if (!list.length) {
    issuesList.innerHTML = `
      <div class="issue-group issue-clear">
        <div class="issue-title clear">
          <span class="severity-pill clear">clear</span>
        </div>
        <div class="issue">⊙ No active issues detected</div>
      </div>
    `;
    return;
  }

  const grouped = {
    high: [],
    medium: [],
    low: []
  };

  for (const issue of list) {
    const severity = grouped[issue.severity] ? issue.severity : "low";
    grouped[severity].push(issue);
  }

  issuesList.innerHTML = ["high", "medium", "low"]
    .filter(severity => grouped[severity].length)
    .map(severity => {
      const summaryItems = dashboardIssueSummaryItems(grouped[severity]);

      return `
        <div class="issue-group issue-${severity}">
          <div class="issue-title ${severity}">
            <span class="severity-pill ${severity}">${severity}</span>
          </div>
          ${summaryItems.map(issue => `<div class="issue">⊙ ${issueSummaryText(issue)}</div>`).join("")}
        </div>
      `;
    })
    .join("");
}

function serviceRow(service) {
  const urls = service.urls || [];
  const owner = service.incusOwner ? `${service.incusOwner.remote} / ${service.incusOwner.name}` : service.location;
  const target = service.npm ? `${service.npm.forwardHost}:${service.npm.forwardPort}` : "";

  return `
    <tr data-domain="${safeText(urls[0])}" data-service-id="${safeText(service.id)}">
      <td><div class="service-name">${safeText(service.name)}</div><div class="service-url">${safeText(urls[0])}</div></td>
      <td>${safeText(service.type)}</td>
      <td><div class="service-name">${safeText(owner)}</div><div class="service-url">${safeText(target)}</div></td>
      <td><span class="badge ${statusClass(service.status)}">${safeText(service.status)}</span></td>
      <td>${safeText(service.dependencies, "0")}</td>
      <td>${safeText(service.lastCheck)}</td>
      <td class="service-action-cell">
        <button class="service-action-btn" data-service-id="${safeText(service.id)}" title="Service actions">•••</button>
      </td>
    </tr>
  `;
}

function closeServiceActionMenu() {
  const existing = document.getElementById("serviceActionMenu");
  if (existing) existing.remove();
}

function openServiceUrl(service) {
  const domain = (service.urls || [])[0] || service.name;
  if (!domain) return;
  window.open(`https://${domain}`, "_blank", "noopener,noreferrer");
}

async function copyServiceUrl(service) {
  const domain = (service.urls || [])[0] || service.name;
  if (!domain) return;

  const url = `https://${domain}`;

  try {
    await navigator.clipboard.writeText(url);
  } catch (_) {
    const tmp = document.createElement("input");
    tmp.value = url;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    tmp.remove();
  }
}

function showServiceActionMenu(service, button) {
  closeServiceActionMenu();

  const domain = (service.urls || [])[0] || service.name;
  const rect = button.getBoundingClientRect();

  const menu = document.createElement("div");
  menu.id = "serviceActionMenu";
  menu.className = "service-action-menu";
  menu.style.left = `${Math.max(12, rect.right - 180)}px`;
  menu.style.top = `${rect.bottom + 6}px`;

  menu.innerHTML = `
    <button data-action="open">↗ Open Service</button>
    <button data-action="details">▦ View Details</button>
    <button data-action="simulate">◌ Simulate Failure</button>
    <button data-action="copy">⧉ Copy URL</button>
  `;

  menu.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;
    if (!action) return;

    if (action === "open") {
      openServiceUrl(service);
    }

    if (action === "details") {
      state.selectedServiceId = service.id;
      setView("services");
    }

    if (action === "simulate") {
      state.selectedBlastComponentId = service.componentId || "npm";
      setView("blastRadius");
    }

    if (action === "copy") {
      await copyServiceUrl(service);
      button.textContent = "✓";
      setTimeout(() => {
        button.textContent = "•••";
      }, 900);
    }

    closeServiceActionMenu();
  });

  document.body.appendChild(menu);
}

function wireDashboardServiceActions() {
  document.querySelectorAll("#servicesTable .service-action-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const serviceId = button.dataset.serviceId;
      const service = (state.model?.services || []).find(item => item.id === serviceId);
      if (!service) return;

      showServiceActionMenu(service, button);
    });
  });
}

function renderServices(services) {
  const search = document.getElementById("serviceSearch");
  const table = document.getElementById("servicesTable");
  if (!search || !table) return;

  const query = search.value.toLowerCase();
  const filtered = (services || []).filter(service =>
    safeText(service.name).toLowerCase().includes(query) ||
    (service.urls || []).join(" ").toLowerCase().includes(query) ||
    safeText(service.location).toLowerCase().includes(query) ||
    safeText(service.npm?.forwardHost).toLowerCase().includes(query) ||
    safeText(service.incusOwner?.name).toLowerCase().includes(query) ||
    safeText(service.incusOwner?.remote).toLowerCase().includes(query)
  );

  table.innerHTML = filtered.map(serviceRow).join("");

  document.querySelectorAll("#servicesTable tr[data-domain]").forEach(row => {
    row.addEventListener("click", () => {
      const domain = row.dataset.domain;
      if (domain) {
        document.getElementById("lookupInput").value = domain;
        lookup();
      }
    });
  });

  wireDashboardServiceActions();
}

function getPublicServices() {
  return (state.model?.services || []).filter(service => service.id && service.id.startsWith("svc-npm-"));
}

function servicesPageRow(service) {
  const domain = (service.urls || [])[0] || service.name;
  const target = service.npm ? `${service.npm.forwardHost}:${service.npm.forwardPort}` : service.location;
  const owner = service.incusOwner ? `${service.incusOwner.remote} / ${service.incusOwner.name}` : "Not matched";
  const checkMode = service.check ? service.check.checkMode : service.checkMode || "tcp";
  const selectedClass = service.id === state.selectedServiceId ? "selected-service-row" : "";

  return `
    <tr class="${selectedClass}" data-service-id="${service.id}">
      <td>
        <div class="service-name">${domain}</div>
        <div class="service-url">${service.name}</div>
      </td>
      <td>${target}</td>
      <td>${owner}</td>
      <td><span class="badge ${statusClass(service.status)}">${service.status}</span></td>
      <td>${checkMode}</td>
      <td>${service.dependencies || 0}</td>
    </tr>
  `;
}

function renderServiceDetail(service) {
  const panel = document.getElementById("serviceDetailPanel");
  if (!panel) return;

  if (!service) {
    panel.innerHTML = `
      <div class="impact-severity">No service selected</div>
      <div class="affected-row">
        <span>Click a service row to see NPM and Incus ownership details.</span>
        <span class="badge healthy">Ready</span>
      </div>
    `;
    return;
  }

  const domain = (service.urls || [])[0] || service.name;
  const target = service.npm ? `${service.npm.forwardHost}:${service.npm.forwardPort}` : service.location;
  const owner = service.incusOwner ? `${service.incusOwner.remote} / ${service.incusOwner.name}` : "Not matched";
  const checkMode = service.check ? service.check.checkMode : service.checkMode || "tcp";

  panel.innerHTML = `
    <div class="impact-severity">${domain}</div>
    <div class="affected-row"><span>Status</span><span class="badge ${statusClass(service.status)}">${service.status}</span></div>
    <div class="affected-row"><span>NPM Target</span><span>${target}</span></div>
    <div class="affected-row"><span>Incus Owner</span><span>${owner}</span></div>
    <div class="affected-row"><span>Check Mode</span><span>${checkMode}</span></div>
    <div class="affected-row"><span>Dependencies</span><span>${service.dependencies || 0}</span></div>
    ${dependencyChainHtml(service.dependsOn)}
    <div class="url-chips">
      ${(service.urls || []).map(url => `<span class="url-chip">${url}</span>`).join("")}
    </div>
  `;
}

function renderServicesPage() {
  const search = document.getElementById("servicesPageSearch");
  const statusFilter = document.getElementById("servicesPageStatusFilter");
  const ownerFilter = document.getElementById("servicesPageOwnerFilter");
  const table = document.getElementById("servicesPageTable");

  if (!search || !statusFilter || !ownerFilter || !table) return;

  const query = search.value.toLowerCase();
  const status = statusFilter.value;
  const owner = ownerFilter.value;

  let services = getPublicServices();

  if (status !== "all") services = services.filter(service => service.status === status);
  if (owner === "matched") services = services.filter(service => Boolean(service.incusOwner));
  if (owner === "unmatched") services = services.filter(service => !service.incusOwner);
  if (query) services = services.filter(service => JSON.stringify(service).toLowerCase().includes(query));

  services.sort((a, b) => safeText(a.name).localeCompare(safeText(b.name)));

  if (services.length && !services.some(service => service.id === state.selectedServiceId)) {
    state.selectedServiceId = services[0].id;
  }

  if (!services.length) state.selectedServiceId = null;

  table.innerHTML = services.length
    ? services.map(servicesPageRow).join("")
    : `<tr><td colspan="6">No services match the current filters.</td></tr>`;

  document.querySelectorAll("#servicesPageTable tr[data-service-id]").forEach(row => {
    row.addEventListener("click", () => {
      state.selectedServiceId = row.dataset.serviceId;
      renderServicesPage();
    });
  });

  const selected = getPublicServices().find(service => service.id === state.selectedServiceId);
  renderServiceDetail(selected || null);
}

function getIncusInstances() {
  return (state.model?.components || [])
    .filter(component => component.type === "incus-instance")
    .map(component => component.incus || null)
    .filter(Boolean);
}

function instanceKey(instance) {
  return `${instance.remote}::${instance.name}`;
}

function getPublicServicesForInstance(instance) {
  return getPublicServices().filter(service =>
    service.incusOwner &&
    service.incusOwner.remote === instance.remote &&
    service.incusOwner.name === instance.name
  );
}

function getPublicServicesForRemote(remoteName) {
  return getPublicServices().filter(service =>
    service.incusOwner &&
    service.incusOwner.remote === remoteName
  );
}

function getServerStats(remoteName) {
  const instances = getIncusInstances().filter(instance => instance.remote === remoteName);
  const running = instances.filter(instance => String(instance.status).toLowerCase() === "running").length;
  const stopped = instances.length - running;
  const containers = instances.filter(instance => instance.type === "container").length;
  const vms = instances.filter(instance => instance.type === "virtual-machine").length;
  const publicServices = getPublicServicesForRemote(remoteName).length;
  return { total: instances.length, running, stopped, containers, vms, publicServices };
}

function ensureServersLayout() {
  const serversView = document.getElementById("serversView");
  if (!serversView) return;

  const instanceTable = document.getElementById("instancesTable");
  if (!instanceTable) return;

  const instancePanel = instanceTable.closest(".panel");
  if (!instancePanel) return;

  instancePanel.classList.add("servers-main-panel");

  const instancePanelHead = instancePanel.querySelector(".panel-head");
  if (instancePanelHead && !document.getElementById("instanceSearch")) {
    const input = document.createElement("input");
    input.id = "instanceSearch";
    input.placeholder = "Search instance, server, IP, service, or Docker container...";
    input.addEventListener("input", renderServersPage);

    const firstSelect = instancePanelHead.querySelector("select");
    if (firstSelect) {
      instancePanelHead.insertBefore(input, firstSelect);
    } else {
      instancePanelHead.appendChild(input);
    }
  }

  const table = instanceTable.closest("table");
  if (table && !table.classList.contains("servers-scroll-table")) {
    table.classList.add("servers-scroll-table");

    if (!table.parentElement.classList.contains("servers-table-scroll")) {
      const wrapper = document.createElement("div");
      wrapper.className = "servers-table-scroll";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }

  if (table && !table.dataset.dockerColumnInitialized) {
    const headerRow = table.querySelector("thead tr");
    if (headerRow && !Array.from(headerRow.children).some(th => th.textContent.trim() === "Docker")) {
      const snapshotHeader = Array.from(headerRow.children).find(th => th.textContent.trim() === "Snapshots");
      const dockerHeader = document.createElement("th");
      dockerHeader.textContent = "Docker";
      if (snapshotHeader) {
        headerRow.insertBefore(dockerHeader, snapshotHeader);
      } else {
        headerRow.appendChild(dockerHeader);
      }
    }
    table.dataset.dockerColumnInitialized = "true";
  }

  if (table && !table.dataset.sortableInitialized) {
    const sortFields = [
      "name",
      "remote",
      "type",
      "status",
      "preferredIp",
      "publicServices",
      "dockerContainers",
      "snapshots"
    ];

    table.querySelectorAll("thead th").forEach((th, index) => {
      const field = sortFields[index];
      if (!field) return;

      th.classList.add("sortable-header");
      th.dataset.sortField = field;

      th.addEventListener("click", () => {
        if (state.serverSort.field === field) {
          state.serverSort.direction = state.serverSort.direction === "asc" ? "desc" : "asc";
        } else {
          state.serverSort.field = field;
          state.serverSort.direction = "asc";
        }
        renderServersPage();
      });
    });

    table.dataset.sortableInitialized = "true";
  }

  const grid = serversView.querySelector(".content-grid");
  if (grid && !document.getElementById("instanceDetailPanel")) {
    const detailPanel = document.createElement("div");
    detailPanel.className = "panel simulator-panel servers-detail-panel";
    detailPanel.innerHTML = `
      <h2>Instance Details</h2>
      <p>Click any Incus instance row to inspect IPs, public services, and ownership details.</p>
      <div id="instanceDetailPanel" class="impact-result"></div>
    `;
    grid.appendChild(detailPanel);
  }
}

function renderServersGrid() {
  const grid = document.getElementById("serversGrid");
  if (!grid) return;

  const remotes = (state.model?.components || []).filter(c => c.type === "incus-host").sort(remoteSort);

  grid.innerHTML = remotes.map(remote => {
    const stats = getServerStats(remote.name);
    const active = state.selectedServer === remote.name ? "selected" : "";
    return `
      <article class="summary-card server-card ${active}" data-server="${remote.name}">
        <div class="icon">▰</div>
        <h3>${remote.name}</h3>
        <p>${stats.running} running / ${stats.stopped} stopped</p>
        <small>${stats.containers} containers · ${stats.vms} VMs · ${stats.publicServices} public services</small>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".server-card[data-server]").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedServer = card.dataset.server;
      state.selectedInstanceKey = null;
      renderServersPage();
    });
  });
}

function instanceRow(instance) {
  const services = getPublicServicesForInstance(instance);
  const serviceNames = services.map(service => service.name).slice(0, 3);
  const more = services.length > 3 ? ` +${services.length - 3} more` : "";
  const key = instanceKey(instance);
  const selectedClass = key === state.selectedInstanceKey ? "selected-instance-row" : "";

  return `
    <tr class="${selectedClass}" data-instance-key="${key}">
      <td><div class="service-name">${instance.name}</div><div class="service-url">${instance.id}</div></td>
      <td>${instance.remote}</td>
      <td>${instance.type}</td>
      <td><span class="badge ${statusClass(instance.status)}">${instance.status}</span></td>
      <td><div class="service-name">${instance.preferredIp || "no IPv4"}</div><div class="service-url">${instance.preferredInterface || ""}</div></td>
      <td><div class="service-name">${services.length}</div><div class="service-url">${serviceNames.join(", ")}${more}</div></td>
      <td>${nestedDockerBadge(instance)}</td>
      <td>${instance.snapshots || 0}</td>
    </tr>
  `;
}

function renderInstanceDetail(instance) {
  const panel = document.getElementById("instanceDetailPanel");
  if (!panel) return;

  if (!instance) {
    panel.innerHTML = `
      <div class="impact-severity">No instance selected</div>
      <div class="affected-row">
        <span>Click an Incus instance row to see details.</span>
        <span class="badge healthy">Ready</span>
      </div>
    `;
    return;
  }

  const services = getPublicServicesForInstance(instance);
  const ips = instance.ips || instance.ipv4 || [];
  const nestedDocker = instance.nestedDocker || null;
  const dockerSummary = nestedDocker && nestedDocker.summary ? nestedDocker.summary : null;
  const dockerContainers = nestedDocker && Array.isArray(nestedDocker.containers)
    ? nestedDocker.containers
    : [];

  const ipChips = ips.length
    ? ips.map(ip => `<span class="domain-chip">${ip.address || ip}</span>`).join("")
    : `<span class="domain-chip">No IP list returned</span>`;

  const serviceChips = services.length
    ? services.map(service => `<span class="domain-chip">${(service.urls || [])[0] || service.name}</span>`).join("")
    : `<span class="domain-chip">No public services matched</span>`;

  const dockerAvailable = nestedDocker && nestedDocker.available;
  const dockerStatusBadge = dockerAvailable
    ? `<span class="badge healthy">Discovered</span>`
    : `<span class="badge offline">Unavailable</span>`;

  const dockerCountRows = dockerAvailable && dockerSummary
    ? `
      <div class="affected-row"><span>Docker Containers</span><span>${dockerSummary.total || 0}</span></div>
      <div class="affected-row"><span>Docker Running</span><span>${dockerSummary.running || 0}</span></div>
      <div class="affected-row"><span>Docker Stopped</span><span>${dockerSummary.stopped || 0}</span></div>
      <div class="affected-row"><span>Docker Unhealthy</span><span>${dockerSummary.unhealthy || 0}</span></div>
    `
    : `
      <div class="affected-row"><span>Docker Visibility</span><span>${nestedDocker ? nestedDocker.reason || "Unavailable" : "Not scanned or no Docker found"}</span></div>
    `;

  const dockerContainerList = dockerAvailable && dockerContainers.length
    ? dockerContainers.map((container, index) => {
        const unhealthy = container.unhealthy;
        const running = container.state === "running";
        const badgeClass = unhealthy ? "degraded" : running ? "healthy" : "offline";
        const badgeText = unhealthy ? "unhealthy" : running ? "running" : "stopped";
        return `
          <div class="dependency-step">
            <div class="dependency-step-number">${index + 1}</div>
            <div>
              <div class="dependency-step-name">
                ${container.names || container.id || "docker-container"}
                <span class="badge ${badgeClass}" style="margin-left: 8px;">${badgeText}</span>
              </div>
              <div class="dependency-step-type">${container.image || "unknown image"}</div>
              <div class="dependency-step-type">${container.status || ""}</div>
              ${container.ports ? `<div class="dependency-step-type">Ports: ${container.ports}</div>` : ""}
              ${container.networks ? `<div class="dependency-step-type">Networks: ${container.networks}</div>` : ""}
            </div>
          </div>
        `;
      }).join("")
    : `
      <div class="dependency-step">
        <div class="dependency-step-number">—</div>
        <div>
          <div class="dependency-step-name">No nested Docker containers listed</div>
          <div class="dependency-step-type">${nestedDocker ? nestedDocker.reason || "Docker unavailable" : "No Docker discovery result for this instance"}</div>
        </div>
      </div>
    `;

  panel.innerHTML = `
    <div class="impact-severity">${instance.name}</div>
    <div class="affected-row"><span>Status</span><span class="badge ${statusClass(instance.status)}">${instance.status}</span></div>
    <div class="affected-row"><span>Incus Server</span><span>${instance.remote}</span></div>
    <div class="affected-row"><span>Type</span><span>${instance.type}</span></div>
    <div class="affected-row"><span>Preferred IP</span><span>${instance.preferredIp || "No IPv4"}</span></div>
    <div class="affected-row"><span>Preferred Interface</span><span>${instance.preferredInterface || "Unknown"}</span></div>
    <div class="affected-row"><span>Snapshots</span><span>${instance.snapshots || 0}</span></div>
    <div class="affected-row"><span>Public Services</span><span>${services.length}</span></div>
    <div class="affected-row"><span>Nested Docker</span><span>${dockerStatusBadge}</span></div>
    ${dockerCountRows}

    <div class="dependency-chain-box">
      <div class="dependency-chain-title">IP Addresses</div>
      <div class="url-chips">${ipChips}</div>
    </div>

    <div class="dependency-chain-box">
      <div class="dependency-chain-title">Public Services</div>
      <div class="url-chips">${serviceChips}</div>
    </div>

    <div class="dependency-chain-box">
      <div class="dependency-chain-title">Nested Docker Containers</div>
      <div class="dependency-chain-steps">
        ${dockerContainerList}
      </div>
    </div>

    <div class="dependency-chain-box">
      <div class="dependency-chain-title">Suggested Checks</div>
      <div class="dependency-chain-steps">
        <div class="dependency-step">
          <div class="dependency-step-number">1</div>
          <div>
            <div class="dependency-step-name">incus info ${instance.name}</div>
            <div class="dependency-step-type">Check instance state and metadata on ${instance.remote}</div>
          </div>
        </div>
        <div class="dependency-step">
          <div class="dependency-step-number">2</div>
          <div>
            <div class="dependency-step-name">incus exec ${instance.name} -- docker ps</div>
            <div class="dependency-step-type">Verify nested Docker containers inside the Incus container</div>
          </div>
        </div>
        <div class="dependency-step">
          <div class="dependency-step-number">3</div>
          <div>
            <div class="dependency-step-name">incus exec ${instance.name} -- ss -ltnp</div>
            <div class="dependency-step-type">Check listening TCP services</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function dockerTextForInstance(instance) {
  const nestedDocker = instance.nestedDocker || {};
  const containers = Array.isArray(nestedDocker.containers) ? nestedDocker.containers : [];
  return containers.map(container => [
    container.names,
    container.image,
    container.status,
    container.ports,
    container.networks
  ].filter(Boolean).join(" ")).join(" ");
}

function nestedDockerCount(instance) {
  const nestedDocker = instance.nestedDocker || {};
  const summary = nestedDocker.summary || {};
  if (!nestedDocker.available) return 0;
  return Number(summary.total || 0);
}

function nestedDockerBadge(instance) {
  const nestedDocker = instance.nestedDocker || {};
  const summary = nestedDocker.summary || {};

  if (!nestedDocker.available) {
    return `<div class="service-name">—</div><div class="service-url">not available</div>`;
  }

  const total = Number(summary.total || 0);
  const unhealthy = Number(summary.unhealthy || 0);
  const running = Number(summary.running || 0);

  const badgeClass = unhealthy > 0 ? "degraded" : "healthy";
  const label = unhealthy > 0 ? `${unhealthy} unhealthy` : `${running} running`;

  return `<div class="service-name">${total}</div><div class="service-url"><span class="badge ${badgeClass}">${label}</span></div>`;
}

function instanceSortValue(instance, field) {
  const services = getPublicServicesForInstance(instance);

  if (field === "publicServices") return services.length;
  if (field === "dockerContainers") return nestedDockerCount(instance);
  if (field === "snapshots") return Number(instance.snapshots || 0);
  if (field === "preferredIp") return instance.preferredIp || "";
  if (field === "remote") return instance.remote || "";
  if (field === "type") return instance.type || "";
  if (field === "status") return instance.status || "";
  return instance.name || "";
}

function compareInstanceRows(a, b) {
  const field = state.serverSort.field || "name";
  const direction = state.serverSort.direction === "desc" ? -1 : 1;

  const av = instanceSortValue(a, field);
  const bv = instanceSortValue(b, field);

  if (typeof av === "number" && typeof bv === "number") {
    return (av - bv) * direction;
  }

  return String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: "base"
  }) * direction;
}

function updateServerSortHeaders() {
  const table = document.querySelector("#serversView .servers-scroll-table");
  if (!table) return;

  table.querySelectorAll("thead th.sortable-header").forEach(th => {
    const active = th.dataset.sortField === state.serverSort.field;
    th.dataset.sortActive = active ? "true" : "false";
    th.dataset.sortDirection = active ? state.serverSort.direction : "";
  });
}

function renderInstancesTable() {
  const serverSearch = document.getElementById("serverSearch");
  const statusSelect = document.getElementById("instanceStatusFilter");
  const typeSelect = document.getElementById("instanceTypeFilter");
  const title = document.getElementById("instancesTitle");
  const table = document.getElementById("instancesTable");

  if (!serverSearch || !statusSelect || !typeSelect || !title || !table) return;

  if (!state.serversInitialized) {
    statusSelect.value = "running";
    state.serversInitialized = true;
  }

  const instanceSearch = document.getElementById("instanceSearch");
  const serverQuery = serverSearch.value.toLowerCase();
  const instanceQuery = instanceSearch ? instanceSearch.value.toLowerCase() : "";
  const query = `${serverQuery} ${instanceQuery}`.trim();
  const statusFilter = statusSelect.value;
  const typeFilter = typeSelect.value;

  let instances = getIncusInstances();

  if (state.selectedServer !== "all") instances = instances.filter(instance => instance.remote === state.selectedServer);
  if (statusFilter !== "all") instances = instances.filter(instance => String(instance.status).toLowerCase() === statusFilter);
  if (typeFilter !== "all") instances = instances.filter(instance => instance.type === typeFilter);

  if (query) {
    instances = instances.filter(instance => {
      const services = getPublicServicesForInstance(instance);
      const text = JSON.stringify({
        instance,
        services: services.map(service => service.name),
        docker: dockerTextForInstance(instance)
      }).toLowerCase();
      return text.includes(query);
    });
  }

  instances.sort(compareInstanceRows);
  updateServerSortHeaders();

  if (state.summaryDrilldown === "docker-containers") {
    // In Docker drill-down mode, do not auto-select the first Incus instance,
    // but preserve a user-selected instance so the right panel can show its nested Docker containers.
    if (state.selectedInstanceKey && !instances.some(instance => instanceKey(instance) === state.selectedInstanceKey)) {
      state.selectedInstanceKey = null;
    }
  } else if (state.summaryDrilldown === "incus-hosts") {
    // In Incus Hosts drill-down mode, the selected object is the host card, not the first instance.
    if (state.selectedInstanceKey && !instances.some(instance => instanceKey(instance) === state.selectedInstanceKey)) {
      state.selectedInstanceKey = null;
    }
  } else if (instances.length && !instances.some(instance => instanceKey(instance) === state.selectedInstanceKey)) {
    state.selectedInstanceKey = instanceKey(instances[0]);
  }

  if (!instances.length) {
    state.selectedInstanceKey = null;
  }

  title.textContent = state.selectedServer === "all"
    ? `Incus Instances (${instances.length})`
    : `${state.selectedServer} Instances (${instances.length})`;

  table.innerHTML = instances.length
    ? instances.map(instanceRow).join("")
    : `<tr><td colspan="8">No instances match the current filters.</td></tr>`;

  document.querySelectorAll("#instancesTable tr[data-instance-key]").forEach(row => {
    row.addEventListener("click", () => {
      state.selectedInstanceKey = row.dataset.instanceKey;
      renderServersPage();
    });
  });

  const selected = getIncusInstances().find(instance => instanceKey(instance) === state.selectedInstanceKey);
  renderInstanceDetail(selected || null);
}

function renderServersPage() {
  if (!state.model) return;
  ensureServersLayout();
  renderServersGrid();
  renderInstancesTable();
}

function allSimulationComponents() {
  const preferredTypes = ["proxy-host", "incus-host", "incus-instance", "unifi-device", "dns", "external"];
  return (state.model?.components || [])
    .filter(component => preferredTypes.includes(component.type))
    .sort((a, b) => {
      const order = { "proxy-host": 1, "incus-host": 2, "incus-instance": 3, "unifi-device": 4, dns: 5, external: 6 };
      const ao = order[a.type] || 99;
      const bo = order[b.type] || 99;
      if (ao !== bo) return ao - bo;
      return safeText(a.name).localeCompare(safeText(b.name));
    });
}

function renderBlastSelect() {
  const select = document.getElementById("blastComponentSelect");
  if (!select) return;

  const components = allSimulationComponents();

  select.innerHTML = components.map(component => `
    <option value="${component.id}">${component.name} (${component.subtitle || component.type})</option>
  `).join("");

  const validIds = new Set(components.map(c => c.id));
  if (!validIds.has(state.selectedBlastComponentId)) {
    state.selectedBlastComponentId = validIds.has("npm") ? "npm" : components[0]?.id || "";
  }

  select.value = state.selectedBlastComponentId;
}

function renderComponentSelect(model) {
  const select = document.getElementById("componentSelect");
  if (!select) return;

  const components = allSimulationComponents();

  select.innerHTML = components.map(component => `
    <option value="${component.id}">${component.name} (${component.subtitle || component.type})</option>
  `).join("");

  const validIds = new Set(components.map(c => c.id));
  if (!validIds.has(state.selectedComponentId)) {
    state.selectedComponentId = validIds.has("npm") ? "npm" : components[0]?.id || "";
  }

  select.value = state.selectedComponentId;
}

function affectedServiceRow(service) {
  const owner = service.incusOwner ? `${service.incusOwner.remote} / ${service.incusOwner.name}` : service.location;
  const chain = (service.dependsOn || []).join(" → ");
  return `
    <tr>
      <td><div class="service-name">${service.name}</div><div class="service-url">${(service.urls || [])[0] || ""}</div></td>
      <td><span class="badge offline">affected</span></td>
      <td>${owner}</td>
      <td><div class="service-url">${chain}</div></td>
    </tr>
  `;
}

function renderBlastImpact(impact) {
  state.lastBlastImpact = impact;

  const result = document.getElementById("blastResult");
  if (!result) return;

  const affected = impact.affectedServices || [];
  const urls = [...new Set(impact.affectedUrls || [])];

  result.innerHTML = `
    <div class="impact-severity">${impact.severity} impact <span class="badge degraded">${affected.length} services affected</span></div>
    <div class="affected-row"><span>Simulated Failure</span><span>${impact.simulatedFailure.name} (${impact.simulatedFailure.type})</span></div>
    <div class="affected-row"><span>Affected URLs</span><span>${urls.length}</span></div>
    <div class="url-chips">${urls.map(url => `<span class="url-chip">${url}</span>`).join("")}</div>
  `;

  renderBlastAffectedTable();
}

function renderBlastAffectedTable() {
  const table = document.getElementById("blastAffectedTable");
  const search = document.getElementById("blastSearch");
  if (!table || !search) return;

  if (!state.lastBlastImpact) {
    table.innerHTML = "";
    return;
  }

  const query = search.value.toLowerCase();
  let affected = state.lastBlastImpact.affectedServices || [];

  if (query) {
    affected = affected.filter(service => JSON.stringify(service).toLowerCase().includes(query));
  }

  table.innerHTML = affected.length
    ? affected.map(affectedServiceRow).join("")
    : `<tr><td colspan="4">No public services are affected by this simulated failure.</td></tr>`;
}

async function runBlastSimulation() {
  const select = document.getElementById("blastComponentSelect");
  const result = document.getElementById("blastResult");
  if (!select || !result) return;

  const componentId = select.value;
  state.selectedBlastComponentId = componentId;

  result.innerHTML = `
    <div class="impact-severity">Calculating impact...</div>
    <div class="affected-row"><span>Querying dependency model</span><span class="badge healthy">Working</span></div>
  `;

  try {
    const impact = await api("/api/simulate", {
      method: "POST",
      body: JSON.stringify({ componentId })
    });
    renderBlastImpact(impact);
  } catch (err) {
    result.innerHTML = `
      <div class="impact-severity">Simulation unavailable</div>
      <div class="affected-row"><span>${err.message}</span><span class="badge offline">Error</span></div>
    `;
  }
}

function renderBlastPage() {
  if (!state.model) return;
  renderBlastSelect();
  runBlastSimulation();
}

function renderLookupResult(data) {
  const result = document.getElementById("lookupResult");
  if (!result) return;

  if (data.ip) {
    const owner = data.incusOwner;
    const proxyHosts = data.proxyHosts || [];
    result.innerHTML = `
      <div class="impact-severity">IP Lookup: ${data.ip}</div>
      <div class="affected-row"><span>Incus Owner</span><span class="badge ${owner ? "healthy" : "degraded"}">${owner ? `${owner.remote} / ${owner.name}` : "Not found"}</span></div>
      ${owner ? `<div class="affected-row"><span>Preferred Interface</span><span>${safeText(owner.preferredInterface || owner.matchedInterface)} / ${safeText(owner.preferredIp || owner.matchedIp)}</span></div>` : ""}
      <div class="affected-row"><span>Proxy Hosts</span><span class="badge healthy">${proxyHosts.length}</span></div>
      <div class="url-chips">${proxyHosts.map(svc => `<span class="url-chip">${svc.name} → ${svc.location}</span>`).join("")}</div>
    `;
    return;
  }

  if (data.domain) {
    const matches = data.matches || [];
    result.innerHTML = `
      <div class="impact-severity">Domain Lookup: ${data.domain}</div>
      ${matches.length ? matches.map(match => `
        <div class="affected-row"><span>${match.service.name}</span><span class="badge ${statusClass(match.service.status)}">${match.service.status}</span></div>
        <div class="affected-row"><span>Target</span><span>${match.forwardHost}:${match.forwardPort}</span></div>
        <div class="affected-row"><span>Incus Owner</span><span>${match.incusOwner ? `${match.incusOwner.remote} / ${match.incusOwner.name}` : "Not found"}</span></div>
      `).join("") : `<div class="affected-row"><span>No matching proxy host found.</span><span class="badge degraded">Not Found</span></div>`}
    `;
  }
}

async function lookup() {
  const input = document.getElementById("lookupInput");
  const result = document.getElementById("lookupResult");
  if (!input || !result) return;

  const value = input.value.trim();

  if (!value) {
    result.innerHTML = `
      <div class="impact-severity">Lookup Ready</div>
      <div class="affected-row"><span>Enter a domain or IP address.</span><span class="badge healthy">Ready</span></div>
    `;
    return;
  }

  try {
    const endpoint = isIpAddress(value)
      ? `/api/lookup/ip/${encodeURIComponent(value)}`
      : `/api/lookup/domain/${encodeURIComponent(value)}`;
    renderLookupResult(await api(endpoint));
  } catch (err) {
    result.innerHTML = `
      <div class="impact-severity">Lookup failed</div>
      <div class="affected-row"><span>${err.message}</span><span class="badge offline">Error</span></div>
    `;
  }
}

function suggestedCommands(path) {
  const owner = path.incusOwner;
  const target = path.target || "";
  const domain = (path.domains || [])[0] || "domain";

  if (!owner) {
    return [
      `curl -v http://${target}`,
      `Check Nginx Proxy Manager target for ${domain}`,
      "Confirm the target IP belongs to an active Incus instance"
    ];
  }

  return [
    `incus exec ${owner.name} -- ss -ltnp`,
    `incus exec ${owner.name} -- docker ps`,
    `curl -v http://${target}`
  ];
}

function renderBrokenPathCard(path) {
  const domain = (path.domains || [])[0] || "unknown domain";
  const owner = path.incusOwner;
  const tcpMessage = path.tcp ? path.tcp.message : "";
  const httpMessage = path.http ? path.http.message : "";
  const publicMessage = path.publicHttp ? path.publicHttp.message : "";
  const commands = suggestedCommands(path);

  return `
    <div class="issue-group">
      <div class="impact-severity">${domain}</div>
      <div class="affected-row"><span>NPM Target</span><span>${safeText(path.target)}</span></div>
      <div class="affected-row"><span>Check Mode</span><span class="badge degraded">${safeText(path.checkMode)}</span></div>
      <div class="affected-row"><span>Incus Owner</span><span>${owner ? `${owner.remote} / ${owner.name}` : "Not matched"}</span></div>
      <div class="affected-row"><span>Likely Issue</span><span>${safeText(path.likelyIssue)}</span></div>
      <div class="affected-row"><span>Failure Detail</span><span>${safeText(tcpMessage || httpMessage || publicMessage || "No detail available")}</span></div>
      <div class="url-chips">${commands.map(cmd => `<span class="url-chip">${cmd}</span>`).join("")}</div>
    </div>
  `;
}

function renderBrokenPaths(paths) {
  const container = document.getElementById("brokenPathsList");
  const search = document.getElementById("brokenPathSearch");
  if (!container || !search) return;

  const query = search.value.toLowerCase();
  const filtered = (paths || []).filter(path => JSON.stringify(path).toLowerCase().includes(query));

  if (!filtered.length) {
    container.innerHTML = `
      <div class="issue-group">
        <div class="impact-severity">No broken paths detected</div>
        <div class="affected-row"><span>All discovered NPM proxy targets are currently healthy.</span><span class="badge healthy">Clear</span></div>
        <div class="affected-row"><span>Public services</span><span>${state.summary ? state.summary.publicServices.healthy : "0"} healthy</span></div>
        <div class="affected-row"><span>Proxy hosts</span><span>${state.summary ? state.summary.proxyHosts.active : "0"} active</span></div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(renderBrokenPathCard).join("");
}

async function loadBrokenPaths(force = false) {
  ensureAllIssuesPanel();

  const brokenContainer = document.getElementById("brokenPathsList");
  const issuesContainer = document.getElementById("allIssuesList");

  if (issuesContainer) {
    issuesContainer.innerHTML = `
      <div class="issue-group issue-low">
        <div class="impact-severity low">Loading current issues...</div>
        <div class="affected-row"><span>Collecting infrastructure, certificate, and service issues</span><span class="badge healthy">Working</span></div>
      </div>
    `;
  }

  if (brokenContainer) {
    brokenContainer.innerHTML = `
      <div class="issue-group">
        <div class="impact-severity">Checking broken paths...</div>
        <div class="affected-row"><span>Querying public service paths</span><span class="badge healthy">Working</span></div>
      </div>
    `;
  }

  try {
    const issueEndpoint = force ? "/api/issues?force=1" : "/api/issues";
    const brokenEndpoint = force ? "/api/broken-paths?force=1" : "/api/broken-paths";

    const [issuesData, brokenData] = await Promise.all([
      api(issueEndpoint),
      api(brokenEndpoint)
    ]);

    state.allIssues = issuesData.issues || [];
    state.brokenPaths = brokenData.brokenPaths || [];

    renderAllIssuesPanel(state.allIssues);
    renderBrokenPaths(state.brokenPaths);
  } catch (err) {
    if (issuesContainer) {
      issuesContainer.innerHTML = `
        <div class="issue-group issue-high">
          <div class="impact-severity high">Issues unavailable</div>
          <div class="affected-row"><span>${err.message}</span><span class="badge offline">Error</span></div>
        </div>
      `;
    }

    if (brokenContainer) {
      brokenContainer.innerHTML = `
        <div class="issue-group issue-high">
          <div class="impact-severity high">Broken Paths unavailable</div>
          <div class="affected-row"><span>${err.message}</span><span class="badge offline">Error</span></div>
        </div>
      `;
    }
  }
}

function topologyNodeHtml(node) {
  const selected = state.selectedTopologyNodeId === node.id ? " selected" : "";

  return `
    <div class="node ${selected} ${node.status === "degraded" ? "degraded" : node.status === "offline" ? "offline" : ""}"
         data-topology-node-id="${node.id}"
         role="button"
         tabindex="0"
         title="Inspect ${node.name}"
         style="left:${node.x}px; top:${node.y}px;">
      <div class="node-name">${node.icon || "●"} ${node.name}</div>
      <div class="node-sub">${node.subtitle || ""}</div>
      <div class="node-status">${labelStatus(node.status || "ok")}</div>
    </div>
  `;
}



function topologyLineHtml(from, to, status = "ok") {
  const startX = from.x + 86;
  const startY = from.y + 37;
  const endX = to.x + 86;
  const endY = to.y + 37;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  return `
    <div class="link-line ${status === "degraded" ? "degraded" : ""}"
         style="left:${startX}px; top:${startY}px; width:${length}px; transform:rotate(${angle}deg);"></div>
  `;
}

function getTopologyServices() {
  return getPublicServices();
}




function ensureTopologyExpansionState() {
  if (!state.topologyExpandedNodes) {
    state.topologyExpandedNodes = new Set();
  } else if (Array.isArray(state.topologyExpandedNodes)) {
    state.topologyExpandedNodes = new Set(state.topologyExpandedNodes);
  }
}

function isTopologyNodeExpanded(nodeId) {
  ensureTopologyExpansionState();
  return state.topologyExpandedNodes.has(nodeId);
}

function toggleTopologyNodeExpansion(nodeId) {
  ensureTopologyExpansionState();

  if (state.topologyExpandedNodes.has(nodeId)) {
    state.topologyExpandedNodes.delete(nodeId);
  } else {
    state.topologyExpandedNodes.add(nodeId);
  }

  renderTopologyPage();
}

function topologyInstanceNodeId(instance) {
  return `topology-instance-${sanitizeForClient(instance.remote)}-${sanitizeForClient(instance.name)}`;
}

function topologyInstanceStatus(instance) {
  const status = String(instance.status || "").toLowerCase();
  if (status === "running") return "ok";
  if (status === "stopped") return "offline";
  return instance.status || "ok";
}

function topologyDnsProviderText() {
  return state.model?.dnsDiscovery?.providerLabel ||
    state.summary?.dnsDiscovery?.providerLabel ||
    state.model?.dnsProvider ||
    state.summary?.dnsProvider ||
    "Public DNS Provider";
}

function topologyDnsSubtitleText() {
  const discovery = state.model?.dnsDiscovery || state.summary?.dnsDiscovery || {};
  const domain = discovery.domain || state.model?.primaryDomain || state.summary?.primaryDomain;

  if (domain && Array.isArray(discovery.nameservers) && discovery.nameservers.length) {
    return `${domain} · ${discovery.nameservers.length} NS`;
  }

  if (domain) return domain;

  return "Public DNS";
}


function topologyWanAddressText() {
  const candidates = [
    state.model?.wanIp,
    state.model?.publicIp,
    state.model?.externalIp,
    state.summary?.wanIp,
    state.summary?.publicIp,
    state.summary?.externalIp
  ].filter(Boolean);

  return candidates[0] || "WAN IP not discovered";
}

function topologyHostStats(hostName) {
  const instances = getIncusInstances().filter(instance => instance.remote === hostName);
  const services = getTopologyServices().filter(service => service.incusOwner?.remote === hostName);

  const running = instances.filter(instance => String(instance.status || "").toLowerCase() === "running").length;
  const stopped = instances.length - running;

  const nestedDockerHosts = instances.filter(instance => instance.nestedDocker?.available).length;
  const dockerContainers = instances.reduce((total, instance) => {
    const containers = Array.isArray(instance.nestedDocker?.containers)
      ? instance.nestedDocker.containers
      : [];
    return total + containers.length;
  }, 0);

  const healthyServices = services.filter(service => service.status === "healthy").length;
  const degradedServices = services.length - healthyServices;

  return {
    instances,
    services,
    running,
    stopped,
    nestedDockerHosts,
    dockerContainers,
    healthyServices,
    degradedServices
  };
}

function buildTopologyNodes() {
  ensureTopologyExpansionState();

  const level = document.getElementById("topologyLevel").value;
  const showCore = document.getElementById("toggleCore").checked;
  const showRemotes = document.getElementById("toggleRemotes").checked;
  const showServices = document.getElementById("toggleServices").checked || level === "services" || level === "full";

  const nodes = [];
  const links = [];
  const services = getTopologyServices();

  const core = [
    { id: "internet", name: "Internet", subtitle: topologyWanAddressText(), icon: "◎", x: 40, y: 70, status: "ok" },
    { id: "cloudflare", name: topologyDnsProviderText(), subtitle: topologyDnsSubtitleText(), icon: "☁", x: 40, y: 225, status: "ok" },
    { id: "udm-beast", name: "UDM Beast", subtitle: "172.16.0.1", icon: "⌁", x: 40, y: 380, status: "ok" },
    { id: "npm", name: "Nginx Proxy Manager", subtitle: `${services.length} hosted services`, icon: "◆", x: 355, y: 225, status: "ok" }
  ];

  if (showCore) {
    nodes.push(...core);
    links.push(["internet", "cloudflare"], ["cloudflare", "udm-beast"], ["udm-beast", "npm"]);
  }

  const remotes = (state.model?.components || [])
    .filter(component => component.type === "incus-host")
    .sort(remoteSort);

  const anyHostExpanded = remotes.some(remote => isTopologyNodeExpanded(remote.id));

  if (showRemotes) {
    let flowY = 40;

    remotes.forEach((remote, index) => {
      const expanded = isTopologyNodeExpanded(remote.id);
      const stats = topologyHostStats(remote.name);

      let hostX;
      let hostY;

      if (anyHostExpanded) {
        // Expanded mode uses a vertical flowdown layout so child nodes do not overlap sibling hosts.
        hostX = 610;
        hostY = flowY;
      } else {
        // Default mode preserves the compact high-level two-column view.
        const col = index < 4 ? 0 : 1;
        const row = index % 4;
        hostX = 610 + (col * 190);
        hostY = 40 + (row * 135);
      }

      nodes.push({
        id: remote.id,
        name: remote.name,
        subtitle: `${expanded ? "expanded · " : ""}${stats.running} running · ${stats.services.length} services`,
        icon: expanded ? "▾" : "▰",
        x: hostX,
        y: hostY,
        status: remote.status || "ok"
      });

      if (showCore) links.push(["npm", remote.id]);

      let reservedHeight = 135;

      if (expanded) {
        const hostInstances = getIncusInstances()
          .filter(instance => instance.remote === remote.name)
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" }));

        const childColumnSize = 9;
        const childRowHeight = 108;
        const childColumnWidth = 310;
        const childStartX = hostX + 300;
        const childStartY = hostY;

        hostInstances.forEach((instance, instanceIndex) => {
          const childCol = Math.floor(instanceIndex / childColumnSize);
          const childRow = instanceIndex % childColumnSize;
          const nodeId = topologyInstanceNodeId(instance);
          const serviceCount = getPublicServicesForInstance(instance).length;
          const dockerCount = Array.isArray(instance.nestedDocker?.containers)
            ? instance.nestedDocker.containers.length
            : 0;

          nodes.push({
            id: nodeId,
            name: instance.name,
            subtitle: `${instance.status || "unknown"} · ${serviceCount} svc · ${dockerCount} docker`,
            icon: "▣",
            x: childStartX + (childCol * childColumnWidth),
            y: childStartY + (childRow * childRowHeight),
            status: topologyInstanceStatus(instance)
          });

          links.push([remote.id, nodeId]);
        });

        const visibleRows = Math.min(hostInstances.length, childColumnSize);
        reservedHeight = Math.max(135, (visibleRows * childRowHeight) + 35);
      }

      if (anyHostExpanded) {
        flowY += reservedHeight;
      }
    });
  }

  const maxServices = level === "full" ? services.length : 24;

  if (showServices) {
    services.slice(0, maxServices).forEach((service, index) => {
      const col = Math.floor(index / 12);
      const row = index % 12;
      const nodeId = `service-${service.id}`;

      const ownerRemoteId = service.incusOwner
        ? `incus-remote-${sanitizeForClient(service.incusOwner.remote)}`
        : "npm";

      nodes.push({
        id: nodeId,
        name: service.name,
        subtitle: service.incusOwner
          ? `${service.incusOwner.remote} / ${service.incusOwner.name}`
          : service.location,
        icon: "⬡",
        x: 1180 + (col * 320),
        y: 30 + (row * 96),
        status: service.status === "healthy" ? "ok" : "degraded"
      });

      links.push([showRemotes && service.incusOwner ? ownerRemoteId : "npm", nodeId]);
    });
  }

  return { nodes, links };
}








function renderTopologyNodeInspector(nodeId) {
  const summaryBox = document.getElementById("topologySummary");
  if (!summaryBox) return;

  const services = getTopologyServices();
  const components = state.model?.components || [];

  if (nodeId === "internet") {
    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Node</span><span>Internet</span></div>
      <div class="affected-row"><span>Type</span><span>External WAN</span></div>
      <div class="affected-row"><span>WAN Address</span><span>${safeText(topologyWanAddressText())}</span></div>
      <div class="affected-row"><span>Topology Role</span><span>External entry point</span></div>
    `;
    return;
  }

  const service = services.find(item => `service-${item.id}` === nodeId);
  if (service) {
    const target = service.npm
      ? `${service.npm.forwardHost}:${service.npm.forwardPort}`
      : service.location || "unknown";

    const owner = service.incusOwner
      ? `${service.incusOwner.remote} / ${service.incusOwner.name}`
      : "Not matched";

    const urls = Array.isArray(service.urls) ? service.urls : [];
    const deps = Array.isArray(service.dependsOn) ? service.dependsOn : [];

    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Service</span><span>${safeText(service.name)}</span></div>
      <div class="affected-row"><span>Status</span><span>${safeText(service.status || "unknown")}</span></div>
      <div class="affected-row"><span>NPM Target</span><span>${safeText(target)}</span></div>
      <div class="affected-row"><span>Incus Owner</span><span>${safeText(owner)}</span></div>
      <div class="affected-row"><span>Check Mode</span><span>${safeText(service.checkMode || "tcp")}</span></div>
      <div class="affected-row"><span>Dependencies</span><span>${deps.length}</span></div>
      <div class="affected-row"><span>Public URL</span><span>${safeText(urls[0] || service.name)}</span></div>
    `;
    return;
  }

  const component = components.find(item => item.id === nodeId);

  if (nodeId === "npm") {
    const summary = state.summary || {};
    const issues = Array.isArray(state.model?.issues) ? state.model.issues : [];

    const hostedServices = services.length;
    const healthyServices = services.filter(service => service.status === "healthy").length;
    const degradedServices = hostedServices - healthyServices;
    const matchedServices = services.filter(service => service.incusOwner).length;
    const unmatchedServices = hostedServices - matchedServices;

    const activeProxyHosts = summary.proxyHosts?.active ?? hostedServices;
    const brokenProxyHosts = summary.proxyHosts?.broken ?? 0;

    const certificateIssues = issues.filter(issue =>
      String(issue.type || "").includes("certificate")
    );

    const expiringCertificateGroups = issues.filter(issue =>
      issue.type === "certificate-expiration-summary" ||
      issue.type === "certificate-expiration"
    );

    const orphanedCertificateGroups = issues.filter(issue =>
      issue.type === "orphaned-certificates-summary" ||
      issue.type === "orphaned-certificates"
    );

    const expiringCertificateCount = expiringCertificateGroups.reduce((total, issue) => {
      if (Array.isArray(issue.certificates)) return total + issue.certificates.length;
      if (issue.certificate) return total + 1;
      return total + Number(issue.count || 0);
    }, 0);

    const orphanedCertificateCount = orphanedCertificateGroups.reduce((total, issue) => {
      if (Array.isArray(issue.certificates)) return total + issue.certificates.length;
      if (issue.certificate) return total + 1;
      return total + Number(issue.count || 0);
    }, 0);

    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Node</span><span>Nginx Proxy Manager</span></div>
      <div class="affected-row"><span>Role</span><span>Public reverse proxy</span></div>
      <div class="affected-row"><span>Status</span><span>ok</span></div>
      <div class="affected-row"><span>Hosted Services</span><span>${hostedServices}</span></div>
      <div class="affected-row"><span>Healthy Services</span><span>${healthyServices}</span></div>
      <div class="affected-row"><span>Degraded Services</span><span>${degradedServices}</span></div>
      <div class="affected-row"><span>Matched to Incus</span><span>${matchedServices}</span></div>
      <div class="affected-row"><span>Unmatched Proxy Targets</span><span>${unmatchedServices}</span></div>\n      <div class="affected-row"><span>Unmatched Meaning</span><span>Proxy targets not matched to discovered Incus instances.</span></div>
      <div class="affected-row"><span>Active Proxy Hosts</span><span>${activeProxyHosts}</span></div>
      <div class="affected-row"><span>Broken Proxy Hosts</span><span>${brokenProxyHosts}</span></div>
      <div class="affected-row"><span>Certificate Warning Groups</span><span>${certificateIssues.length}</span></div>\n      <div class="affected-row"><span>Certificate Meaning</span><span>Expiration/orphan warnings; not necessarily broken proxy hosts.</span></div>
      <div class="affected-row"><span>Expiring Certs</span><span>${expiringCertificateCount}</span></div>
      <div class="affected-row"><span>Orphaned Certs</span><span>${orphanedCertificateCount}</span></div>
      <div class="affected-row"><span>Impact if down</span><span>${hostedServices} public service(s)</span></div>
    `;
    return;
  }

  if (nodeId === "cloudflare") {
    const discovery = state.model?.dnsDiscovery || state.summary?.dnsDiscovery || {};
    const nameservers = Array.isArray(discovery.nameservers) ? discovery.nameservers : [];
    const domain = discovery.domain || state.model?.primaryDomain || state.summary?.primaryDomain || null;
    const provider = topologyDnsProviderText();

    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Node</span><span>${safeText(provider)}</span></div>
      <div class="affected-row"><span>Type</span><span>Public DNS</span></div>
      <div class="affected-row"><span>Domain</span><span>${safeText(domain || "No public domain discovered")}</span></div>
      <div class="affected-row"><span>Provider Detection</span><span>${discovery.discovered ? "discovered from NS records" : safeText(discovery.message || "DNS discovery unavailable")}</span></div>
      <div class="affected-row"><span>Nameserver Count</span><span>${nameservers.length}</span></div>
      ${
        nameservers.length
          ? `<div class="affected-row"><span>NS Records</span><span>${nameservers.map(ns => safeText(ns)).join("<br>")}</span></div>`
          : `<div class="affected-row"><span>NS Records</span><span>None discovered</span></div>`
      }
      ${
        domain
          ? ""
          : `<div class="affected-row"><span>Note</span><span>Public DNS discovery requires public service domains.</span></div>`
      }
    `;
    return;
  }

  if (component && component.type === "incus-host") {
    const instances = getIncusInstances().filter(instance => instance.remote === component.name);
    const runningInstances = instances.filter(instance => String(instance.status || "").toLowerCase() === "running").length;
    const stoppedInstances = instances.length - runningInstances;
    const containers = instances.filter(instance => String(instance.type || "").toLowerCase() === "container").length;
    const vms = instances.filter(instance => String(instance.type || "").toLowerCase() === "virtual-machine" || String(instance.type || "").toLowerCase() === "vm").length;

    const nestedDockerInstances = instances.filter(instance => instance.nestedDocker?.available).length;
    const dockerContainers = instances.reduce((total, instance) => {
      const nested = instance.nestedDocker || {};
      const rows = Array.isArray(nested.containers) ? nested.containers : [];
      return total + rows.length;
    }, 0);

    const dockerRunning = instances.reduce((total, instance) => {
      const nested = instance.nestedDocker || {};
      const rows = Array.isArray(nested.containers) ? nested.containers : [];

      return total + rows.filter(container => {
        const state = String(container.state || container.status || "").toLowerCase();
        return state.includes("running") || state.includes("up");
      }).length;
    }, 0);

    const hostServices = services.filter(item => item.incusOwner?.remote === component.name);
    const healthyServices = hostServices.filter(item => item.status === "healthy").length;
    const degradedServices = hostServices.length - healthyServices;

    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Host</span><span>${safeText(component.name)}</span></div>
      <div class="affected-row"><span>Type</span><span>Incus host</span></div>
      <div class="affected-row"><span>Status</span><span>${safeText(component.status || "ok")}</span></div>
      <div class="affected-row"><span>Running Instances</span><span>${runningInstances}</span></div>
      <div class="affected-row"><span>Stopped Instances</span><span>${stoppedInstances}</span></div>
      <div class="affected-row"><span>Containers</span><span>${containers}</span></div>
      <div class="affected-row"><span>VMs</span><span>${vms}</span></div>
      <div class="affected-row"><span>Nested Docker Hosts</span><span>${nestedDockerInstances}</span></div>
      <div class="affected-row"><span>Docker Containers</span><span>${dockerContainers}</span></div>
      <div class="affected-row"><span>Docker Running</span><span>${dockerRunning}</span></div>
      <div class="affected-row"><span>Public Services</span><span>${hostServices.length}</span></div>
      <div class="affected-row"><span>Healthy Services</span><span>${healthyServices}</span></div>
      <div class="affected-row"><span>Degraded Services</span><span>${degradedServices}</span></div>
      <div class="affected-row">
        <span>Topology Branch</span>
        <span>${isTopologyNodeExpanded(component.id) ? "Expanded. Click this host node again to collapse." : "Click this host node again to expand."}</span>
      </div>
    `;

    return;
  }

  if (component) {
    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Node</span><span>${safeText(component.name || nodeId)}</span></div>
      <div class="affected-row"><span>Type</span><span>${safeText(component.type || "component")}</span></div>
      <div class="affected-row"><span>Status</span><span>${safeText(component.status || "ok")}</span></div>
    `;
    return;
  }

  if (nodeId === "internet") {
    summaryBox.innerHTML = `
      <div class="affected-row"><span>Selected Node</span><span>Internet</span></div>
      <div class="affected-row"><span>Type</span><span>External WAN</span></div>
      <div class="affected-row"><span>WAN Address</span><span>${safeText(topologyWanAddressText())}</span></div>
      <div class="affected-row"><span>Topology Role</span><span>External entry point</span></div>
    `;
    return;
  }

  const coreLabels = {
    "udm-beast": "UDM Beast"
  };

  summaryBox.innerHTML = `
    <div class="affected-row"><span>Selected Node</span><span>${safeText(coreLabels[nodeId] || nodeId)}</span></div>
    <div class="affected-row"><span>Topology Role</span><span>Core dependency path</span></div>
  `;
}



function wireTopologyNodeClicks() {
  document.querySelectorAll("#topologyCanvas .node[data-topology-node-id]").forEach(node => {
    node.addEventListener("click", () => {
      const nodeId = node.dataset.topologyNodeId;
      const wasSelected = state.selectedTopologyNodeId === nodeId;
      const component = (state.model?.components || []).find(item => item.id === nodeId);
      const isIncusHost = component && component.type === "incus-host";

      state.selectedTopologyNodeId = nodeId;

      if (wasSelected && isIncusHost) {
        ensureTopologyExpansionState();

        if (state.topologyExpandedNodes.has(nodeId)) {
          state.topologyExpandedNodes.delete(nodeId);
        } else {
          state.topologyExpandedNodes.add(nodeId);
        }

        renderTopologyPage();
        renderTopologyNodeInspector(nodeId);
        return;
      }

      document.querySelectorAll("#topologyCanvas .node").forEach(item => {
        item.classList.remove("selected");
      });

      node.classList.add("selected");
      renderTopologyNodeInspector(nodeId);
    });

    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        node.click();
      }
    });
  });
}





function ensureTopologyExpandedReadabilityStyles() {
  if (document.getElementById("topologyExpandedReadabilityStyles")) return;

  const style = document.createElement("style");
  style.id = "topologyExpandedReadabilityStyles";
  style.textContent = `
    #topologyCanvasInner.topology-expanded-flow .link-line {
      opacity: 0.42;
    }

    #topologyCanvasInner.topology-expanded-flow .node {
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.55), 0 8px 18px rgba(0, 0, 0, 0.22);
    }

    #topologyCanvasInner.topology-expanded-flow .node.selected {
      box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.95), 0 10px 22px rgba(0, 0, 0, 0.32);
    }
  `;

  document.head.appendChild(style);
}

function ensureTopologyViewControls() {
  const fitButton = document.getElementById("topologyFitBtn");
  const canvas = document.getElementById("topologyCanvas");

  if (!fitButton || !canvas) return;

  if (!state.topologyZoom) state.topologyZoom = 1;

  if (!document.getElementById("topologyViewControlsStyle")) {
    const style = document.createElement("style");
    style.id = "topologyViewControlsStyle";
    style.textContent = `
      .topology-view-control-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 8px;
      }

      .topology-view-control-group button {
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(15, 23, 42, 0.88);
        color: #e5e7eb;
        border-radius: 8px;
        padding: 5px 8px;
        cursor: pointer;
        font-size: 0.78rem;
      }

      .topology-view-control-group button:hover {
        border-color: rgba(56, 189, 248, 0.65);
        background: rgba(56, 189, 248, 0.12);
      }

      .topology-zoom-label {
        color: var(--muted);
        min-width: 42px;
        text-align: center;
        font-size: 0.78rem;
      }

      #topologyCanvasInner {
        transform-origin: top left;
      }

      .topology-fullscreen-panel {
        position: fixed !important;
        inset: 12px !important;
        z-index: 9999 !important;
        width: auto !important;
        height: auto !important;
        max-height: none !important;
        display: flex !important;
        flex-direction: column !important;
        background: rgba(2, 6, 23, 0.98) !important;
      }

      .topology-fullscreen-panel #topologyCanvas {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        height: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  let group = document.getElementById("topologyViewControlGroup");

  if (!group) {
    group = document.createElement("span");
    group.id = "topologyViewControlGroup";
    group.className = "topology-view-control-group";
    group.innerHTML = `
      <button id="topologyZoomOutBtn" type="button" title="Zoom out">−</button>
      <span id="topologyZoomLabel" class="topology-zoom-label">100%</span>
      <button id="topologyZoomInBtn" type="button" title="Zoom in">+</button>
      <button id="topologyZoomResetBtn" type="button" title="Reset zoom">100%</button>
      <button id="topologyFullscreenBtn" type="button" title="Toggle fullscreen topology view">Fullscreen</button>
      <button id="topologyExportHtmlBtn" type="button" title="Export current expanded topology to a standalone HTML report">Export HTML</button>
    `;

    fitButton.insertAdjacentElement("afterend", group);

    document.getElementById("topologyZoomOutBtn").addEventListener("click", () => {
      state.topologyZoom = Math.max(0.35, Number(state.topologyZoom || 1) - 0.15);
      applyTopologyZoom();
    });

    document.getElementById("topologyZoomInBtn").addEventListener("click", () => {
      state.topologyZoom = Math.min(1.75, Number(state.topologyZoom || 1) + 0.15);
      applyTopologyZoom();
    });

    document.getElementById("topologyZoomResetBtn").addEventListener("click", () => {
      state.topologyZoom = 1;
      applyTopologyZoom();
    });

    document.getElementById("topologyFullscreenBtn").addEventListener("click", () => {
      const panel = canvas.closest(".panel");
      if (!panel) return;

      panel.classList.toggle("topology-fullscreen-panel");

      const btn = document.getElementById("topologyFullscreenBtn");
      if (btn) {
        btn.textContent = panel.classList.contains("topology-fullscreen-panel")
          ? "Exit Fullscreen"
          : "Fullscreen";
      }
    });

    document.getElementById("topologyExportHtmlBtn").addEventListener("click", () => {
      exportCurrentTopologyToHtmlReport();
    });
  }

  applyTopologyZoom();
}

function applyTopologyZoom() {
  const inner = document.getElementById("topologyCanvasInner");
  const label = document.getElementById("topologyZoomLabel");

  const zoom = Number(state.topologyZoom || 1);

  if (inner) {
    inner.style.transform = `scale(${zoom})`;
  }

  if (label) {
    label.textContent = `${Math.round(zoom * 100)}%`;
  }
}

function resetTopologyToDefaultView() {
  ensureTopologyExpansionState();

  state.topologyExpandedNodes.clear();
  state.topologyZoom = 1;

  renderTopologyPage();

  const canvas = document.getElementById("topologyCanvas");
  if (canvas) {
    canvas.scrollLeft = 0;
    canvas.scrollTop = 0;
  }

  applyTopologyZoom();
}

function ensureTopologyDragPan() {
  const canvas = document.getElementById("topologyCanvas");
  if (!canvas || canvas.dataset.dragPanInstalled === "1") return;

  canvas.dataset.dragPanInstalled = "1";

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let pointerId = null;

  canvas.style.cursor = "grab";

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;

    const interactive = event.target.closest("button, input, select, textarea, a, .node");
    if (interactive) return;

    isDragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = canvas.scrollLeft;
    startScrollTop = canvas.scrollTop;

    canvas.setPointerCapture(pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", event => {
    if (!isDragging) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    canvas.scrollLeft = startScrollLeft - dx;
    canvas.scrollTop = startScrollTop - dy;
  });

  const stopDragging = event => {
    if (!isDragging) return;

    isDragging = false;
    canvas.style.cursor = "grab";

    try {
      if (pointerId !== null) canvas.releasePointerCapture(pointerId);
    } catch (err) {
      // Ignore pointer capture cleanup errors.
    }

    pointerId = null;
  };

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("pointerleave", stopDragging);
}

function topologyExportFilename() {
  const now = new Date();
  const stamp = now.toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  return `BlastRadius-topology-${stamp}.html`;
}



function topologyExpandedNodeSummary() {
  ensureTopologyExpansionState();

  if (!state.topologyExpandedNodes || !state.topologyExpandedNodes.size) {
    return "No expanded host branches";
  }

  const components = state.model?.components || [];
  const names = [...state.topologyExpandedNodes].map(nodeId => {
    const component = components.find(item => item.id === nodeId);
    return component?.name || nodeId;
  });

  return names.join(", ");
}

function exportCurrentTopologyToHtmlReport() {
  const inner = document.getElementById("topologyCanvasInner");

  if (!inner) {
    alert("Topology diagram is not available to export.");
    return;
  }

  const clone = inner.cloneNode(true);
  clone.id = "topologyCanvasReportInner";

  const sourceWidth = Math.max(inner.scrollWidth, inner.offsetWidth, 1200);
  const sourceHeight = Math.max(inner.scrollHeight, inner.offsetHeight, 800);

  clone.style.width = `${sourceWidth}px`;
  clone.style.height = `${sourceHeight}px`;
  clone.style.minWidth = `${sourceWidth}px`;
  clone.style.minHeight = `${sourceHeight}px`;
  clone.style.transform = "none";
  clone.style.transformOrigin = "top left";

  const generatedAt = new Date().toLocaleString();
  const expanded = topologyExpandedNodeSummary();
  const wanIp = topologyWanAddressText();
  const dnsProvider = topologyDnsProviderText();
  const dnsDomain = state.model?.primaryDomain || state.summary?.primaryDomain || "";
  const filename = topologyExportFilename();

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeText(filename)}</title>
  <style>
    :root {
      color-scheme: dark;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #020617;
      color: #e5e7eb;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      padding: 22px;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 18px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.28);
      padding-bottom: 14px;
    }

    .report-title {
      font-size: 24px;
      font-weight: 850;
      letter-spacing: 0.02em;
      color: #f8fafc;
    }

    .report-subtitle {
      margin-top: 4px;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.45;
    }

    .report-meta {
      min-width: 360px;
      text-align: right;
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.5;
    }

    .report-help {
      color: #94a3b8;
      font-size: 12px;
      margin: 0 0 14px 0;
    }

    .report-canvas {
      position: relative;
      overflow: auto;
      background:
        linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
        #020617;
      background-size: 32px 32px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      padding: 18px;
      box-sizing: border-box;
    }

    #topologyCanvasReportInner {
      position: relative;
      transform: none !important;
      transform-origin: top left !important;
    }

    #topologyCanvasReportInner .node {
      position: absolute !important;
      width: 175px !important;
      min-height: 72px !important;
      box-sizing: border-box !important;
      padding: 10px 12px !important;
      border: 1px solid rgba(16, 185, 129, 0.72) !important;
      border-radius: 10px !important;
      background: rgba(15, 23, 42, 0.96) !important;
      color: #e5e7eb !important;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.65), 0 8px 18px rgba(0, 0, 0, 0.26) !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    #topologyCanvasReportInner .node.selected {
      border-color: rgba(96, 165, 250, 0.95) !important;
      box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.95), 0 10px 22px rgba(0, 0, 0, 0.32) !important;
    }

    #topologyCanvasReportInner .node-name {
      display: block !important;
      font-size: 14px !important;
      line-height: 18px !important;
      font-weight: 800 !important;
      color: #e5e7eb !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    #topologyCanvasReportInner .node-sub {
      display: block !important;
      margin-top: 4px !important;
      font-size: 11px !important;
      line-height: 15px !important;
      color: #94a3b8 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    #topologyCanvasReportInner .node-status {
      display: block !important;
      margin-top: 5px !important;
      font-size: 11px !important;
      line-height: 14px !important;
      font-weight: 800 !important;
      color: #22c55e !important;
      text-transform: uppercase !important;
      white-space: nowrap !important;
    }

    #topologyCanvasReportInner .link-line {
      position: absolute !important;
      height: 2px !important;
      background: rgba(16, 185, 129, 0.58) !important;
      transform-origin: left center !important;
      opacity: 0.56 !important;
    }

    #topologyCanvasReportInner .link-line.degraded {
      background: rgba(245, 158, 11, 0.72) !important;
    }

    @media print {
      @page {
        size: landscape;
        margin: 0.35in;
      }

      body {
        padding: 0;
      }

      .report-canvas {
        overflow: visible;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="report-title">ScottiBYTE BlastRadius Topology</div>
      <div class="report-subtitle">Standalone topology report generated from the current expanded view.</div>
    </div>
    <div class="report-meta">
      <div><strong>Generated:</strong> ${safeText(generatedAt)}</div>
      <div><strong>Expanded branches:</strong> ${safeText(expanded)}</div>
      <div><strong>WAN IP:</strong> ${safeText(wanIp)}</div>
      <div><strong>DNS:</strong> ${safeText(dnsProvider)}${dnsDomain ? " / " + safeText(dnsDomain) : ""}</div>
    </div>
  </div>

  <p class="report-help">
    Open this HTML file in a browser to inspect the full topology. Use browser print or Save to PDF if a PDF copy is needed.
  </p>

  <div class="report-canvas">
    ${clone.outerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}







function renderTopologyCanvas() {
  const canvas = document.getElementById("topologyCanvas");
  if (!canvas || !state.model) return;

  if (!state.topologyZoom) state.topologyZoom = 1;

  const { nodes, links } = buildTopologyNodes();
  const nodeById = new Map(nodes.map(node => [node.id, node]));

  const linesHtml = links.map(([fromId, toId]) => {
    const from = nodeById.get(fromId);
    const to = nodeById.get(toId);
    if (!from || !to) return "";
    return topologyLineHtml(from, to);
  }).join("");

  const nodesHtml = nodes.map(topologyNodeHtml).join("");

  const maxNodeX = nodes.reduce((max, node) => Math.max(max, Number(node.x || 0)), 0);
  const maxNodeY = nodes.reduce((max, node) => Math.max(max, Number(node.y || 0)), 0);

  const innerWidth = Math.max(1050, maxNodeX + 360);
  const innerHeight = Math.max(720, maxNodeY + 160);

  const expandedClass = state.topologyExpandedNodes && state.topologyExpandedNodes.size
    ? "topology-expanded-flow"
    : "";

  canvas.innerHTML = `
    <div id="topologyCanvasInner" class="${expandedClass}" style="position:relative; min-width:${innerWidth}px; min-height:${innerHeight}px;">
      ${linesHtml}
      ${nodesHtml}
    </div>
  `;

  wireTopologyNodeClicks();

  if (state.selectedTopologyNodeId) {
    const selected = canvas.querySelector(`.node[data-topology-node-id="${state.selectedTopologyNodeId}"]`);
    if (selected) selected.classList.add("selected");
  }

  applyTopologyZoom();
  ensureTopologyDragPan();
}







function renderTopologySummary() {
  const summaryBox = document.getElementById("topologySummary");
  if (!summaryBox) return;

  const summary = state.summary;
  const services = getTopologyServices();
  const matched = services.filter(service => service.incusOwner).length;
  const unmatched = services.length - matched;

  summaryBox.innerHTML = `
    <div class="affected-row"><span>Discovery Sources</span><span>NPM + Incus</span></div>
    <div class="affected-row"><span>Incus Remotes</span><span>${summary ? summary.incusHosts.total : 0}</span></div>
    <div class="affected-row"><span>Incus Instances</span><span>${summary ? summary.incusInstances.running + summary.incusInstances.stopped : 0}</span></div>
    <div class="affected-row"><span>NPM Proxy Hosts</span><span>${summary ? summary.proxyHosts.active : 0}</span></div>
    <div class="affected-row"><span>Public Services</span><span>${summary ? summary.publicServices.healthy : 0} healthy</span></div>
    <div class="affected-row"><span>Matched to Incus</span><span>${matched}</span></div>
    <div class="affected-row"><span>Unmatched Targets</span><span>${unmatched}</span></div>
  `;
}

function renderTopologyLinksTable() {
  const search = document.getElementById("topologySearch");
  const table = document.getElementById("topologyLinksTable");
  if (!search || !table) return;

  const query = search.value.toLowerCase();
  const services = getTopologyServices().filter(service => JSON.stringify(service).toLowerCase().includes(query));

  table.innerHTML = services.map(service => {
    const target = service.npm ? `${service.npm.forwardHost}:${service.npm.forwardPort}` : service.location;
    const owner = service.incusOwner ? `${service.incusOwner.remote} / ${service.incusOwner.name}` : "Not matched";
    const nodeId = `service-${service.id}`;
    const selected = state.selectedTopologyNodeId === nodeId ? "selected" : "";

    return `
      <tr class="${selected}" data-topology-node-id="${nodeId}" style="cursor:pointer;">
        <td><div class="service-name">${service.name}</div><div class="service-url">${(service.urls || [])[0] || ""}</div></td>
        <td>${target}</td>
        <td>${owner}</td>
        <td><span class="badge ${statusClass(service.status)}">${service.status}</span></td>
      </tr>
    `;
  }).join("");

  table.querySelectorAll("tr[data-topology-node-id]").forEach(row => {
    row.addEventListener("click", () => {
      state.selectedTopologyNodeId = row.dataset.topologyNodeId;

      document.querySelectorAll("#topologyLinksTable tr").forEach(item => {
        item.classList.toggle("selected", item.dataset.topologyNodeId === state.selectedTopologyNodeId);
      });

      document.querySelectorAll("#topologyCanvas .node").forEach(item => {
        item.classList.toggle("selected", item.dataset.topologyNodeId === state.selectedTopologyNodeId);
      });

      renderTopologyNodeInspector(state.selectedTopologyNodeId);
    });
  });
}




function ensureTopologyLinksPolish() {
  if (!document.getElementById("topologyLinksPolishStyles")) {
    const style = document.createElement("style");
    style.id = "topologyLinksPolishStyles";
    style.textContent = `
      .topology-links-scroll {
        max-height: 520px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-gutter: stable;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
      }

      .topology-links-scroll table {
        width: 100%;
      }

      .topology-links-scroll thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: rgba(15, 23, 42, 0.98);
      }
    `;
    document.head.appendChild(style);
  }

  const tableBody = document.getElementById("topologyLinksTable");
  if (!tableBody) return;

  const panel = tableBody.closest(".panel");
  if (panel) {
    [...panel.querySelectorAll("h2, h3")].forEach(heading => {
      if (heading.textContent.trim().toLowerCase() === "model links") {
        heading.textContent = "Public Service Links";
      }
    });
  }

  const table = tableBody.closest("table");
  if (!table) return;

  if (table.parentElement && table.parentElement.classList.contains("topology-links-scroll")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "topology-links-scroll";

  table.parentNode.insertBefore(wrapper, table);
  wrapper.appendChild(table);
}


function polishTopologyResetViewButton() {
  const button = document.getElementById("topologyFitBtn");
  if (!button) return;

  button.textContent = "Reset View";
  button.title = "Reset topology scroll position to the upper-left";
}

function renderTopologyPage() {
  if (!state.model || !state.summary) return;

  polishTopologyResetViewButton();
  ensureTopologyExpandedReadabilityStyles();
  renderTopologyCanvas();
  renderTopologySummary();
  renderTopologyLinksTable();
  ensureTopologyLinksPolish();
  ensureMapPurposeLabels();
  ensureTopologyViewControls();
}



function ensureDashboardServicesScroll() {
  const tableBody = document.getElementById("servicesTable");
  if (!tableBody) return;

  const table = tableBody.closest("table");
  if (!table) return;

  if (table.parentElement && table.parentElement.classList.contains("dashboard-services-scroll")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "dashboard-services-scroll";

  table.parentNode.insertBefore(wrapper, table);
  wrapper.appendChild(table);
}

function showLoadingNotice() {
  if (document.getElementById("blastRadiusLoadingNotice")) return;

  const overlay = document.createElement("div");
  overlay.id = "blastRadiusLoadingNotice";
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <div class="loading-title">Discovering Homelab Estate</div>
      <div class="loading-message">
        BlastRadius is scanning NPM, Incus remotes, Incus instances, and nested Docker containers.
      </div>
      <div class="loading-submessage">
        Large environments can take several seconds. The dashboard will populate automatically.
      </div>
    </div>
  `;

  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "99999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(2, 6, 23, 0.58)";
  overlay.style.backdropFilter = "blur(3px)";
  overlay.style.animation = "blastRadiusOverlayFadeIn 180ms ease-out";

  if (!document.getElementById("blastRadiusLoadingNoticeStyle")) {
    const style = document.createElement("style");
    style.id = "blastRadiusLoadingNoticeStyle";
    style.textContent = `
      @keyframes blastRadiusOverlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes blastRadiusSpinner {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      #blastRadiusLoadingNotice .loading-card {
        width: 520px;
        max-width: calc(100vw - 48px);
        padding: 28px 30px;
        border-radius: 22px;
        border: 1px solid rgba(56, 189, 248, 0.45);
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 36%),
          radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.16), transparent 42%),
          rgba(15, 23, 42, 0.98);
        box-shadow:
          0 28px 80px rgba(0, 0, 0, 0.55),
          0 0 0 1px rgba(148, 163, 184, 0.08) inset;
        text-align: center;
      }

      #blastRadiusLoadingNotice .loading-spinner {
        width: 54px;
        height: 54px;
        margin: 0 auto 18px auto;
        border-radius: 999px;
        border: 5px solid rgba(148, 163, 184, 0.22);
        border-top-color: #38bdf8;
        border-right-color: #8b5cf6;
        animation: blastRadiusSpinner 850ms linear infinite;
      }

      #blastRadiusLoadingNotice .loading-title {
        color: #f8fafc;
        font-size: 1.35rem;
        font-weight: 900;
        letter-spacing: 0.02em;
        margin-bottom: 10px;
      }

      #blastRadiusLoadingNotice .loading-message {
        color: #cbd5e1;
        font-size: 1rem;
        line-height: 1.45;
        margin-bottom: 10px;
      }

      #blastRadiusLoadingNotice .loading-submessage {
        color: #93c5fd;
        font-size: 0.92rem;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
}

function hideLoadingNotice() {
  const notice = document.getElementById("blastRadiusLoadingNotice");
  if (notice) notice.remove();
}

function showInitialPanelLoadingMessage() {
  const issuesList = document.getElementById("issuesList");

  if (issuesList && !state.model) {
    issuesList.innerHTML = `
      <div class="issue-group">
        <div class="issue-title low">loading</div>
        <div class="issue">⊙ Discovery is starting. If this takes a few seconds, BlastRadius is scanning Incus and nested Docker.</div>
      </div>
    `;
  }
}

async function load(force = false) {
  injectDynamicStyles();
  ensureFullRescanButton();
  ensureDashboardServicesScroll();

  const startedAt = Date.now();
  const loadingTimer = setTimeout(showLoadingNotice, force ? 200 : 1200);

  const lastUpdate = document.getElementById("lastUpdate");
  if (lastUpdate) lastUpdate.textContent = "Last update: loading...";

  showInitialPanelLoadingMessage();

  try {
    const modelEndpoint = force ? "/api/model?force=1" : "/api/model";
    const summaryEndpoint = force ? "/api/summary?force=1" : "/api/summary";
    const [model, summary] = await Promise.all([api(modelEndpoint), api(summaryEndpoint)]);

    state.model = model;
    state.summary = summary;

    renderSummary(summary);
    renderMap(model);
    renderIssues(model.issues);
    renderServices(model.services);
    renderComponentSelect(model);
    await lookup();

    if (state.currentView === "services") renderServicesPage();
    if (state.currentView === "servers") renderServersPage();
    if (state.currentView === "brokenPaths") await loadBrokenPaths();
    if (state.currentView === "blastRadius") renderBlastPage();
    if (state.currentView === "topology") renderTopologyPage();

    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (lastUpdate) {
      lastUpdate.textContent = force
        ? `Last update: just now (${elapsedSeconds}s full rescan)`
        : `Last update: just now (${elapsedSeconds}s refresh)`;
    }
  } catch (err) {
    const issuesList = document.getElementById("issuesList");
    if (issuesList) {
      issuesList.innerHTML = `
        <div class="issue-group">
          <div class="issue-title high">load error</div>
          <div class="issue">⊙ ${err.message}</div>
        </div>
      `;
    }
    if (lastUpdate) lastUpdate.textContent = "Last update: failed";
  } finally {
    clearTimeout(loadingTimer);
    hideLoadingNotice();
  }
}

injectDynamicStyles();

function ensureFullRescanButton() {
  if (document.getElementById("fullRescanBtn")) return;

  const refreshBtn = document.getElementById("refreshBtn");
  if (!refreshBtn || !refreshBtn.parentElement) return;

  refreshBtn.title = "Refresh View";
  refreshBtn.textContent = "↻";

  const btn = document.createElement("button");
  btn.id = "fullRescanBtn";
  btn.className = "full-rescan-btn";
  btn.title = "Force full discovery scan";
  btn.textContent = "⟳ Full Rescan";

  refreshBtn.parentElement.insertBefore(btn, refreshBtn.nextSibling);

  btn.addEventListener("click", async () => {
    const confirmed = confirm(
      "Run a full live discovery scan now?\n\n" +
      "This scans NPM, Incus remotes, Incus instances, and nested Docker containers.\n\n" +
      "In your environment it may take around 30 seconds."
    );

    if (!confirmed) return;

    btn.classList.add("running");
    btn.disabled = true;
    btn.textContent = "⟳ Scanning...";

    try {
      await load(true);
    } finally {
      btn.classList.remove("running");
      btn.disabled = false;
      btn.textContent = "⟳ Full Rescan";
    }
  });
}

document.addEventListener("click", event => {
  const menu = document.getElementById("serviceActionMenu");
  if (!menu) return;

  if (
    event.target.closest("#serviceActionMenu") ||
    event.target.closest(".service-action-btn")
  ) {
    return;
  }

  closeServiceActionMenu();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeServiceActionMenu();
});

document.getElementById("refreshBtn").addEventListener("click", () => load(false));

document.getElementById("serviceSearch").addEventListener("input", () => {
  if (state.model) renderServices(state.model.services);
});

document.getElementById("layoutBtn").addEventListener("click", () => {
  if (state.model) renderMap(state.model);
});

document.getElementById("lookupBtn").addEventListener("click", lookup);
document.getElementById("lookupInput").addEventListener("keydown", event => {
  if (event.key === "Enter") lookup();
});

document.getElementById("openBlastRadiusBtn").addEventListener("click", () => setView("blastRadius"));

document.getElementById("navDashboard").addEventListener("click", event => {
  event.preventDefault();
  setView("dashboard");
});

document.getElementById("navServices").addEventListener("click", event => {
  event.preventDefault();
  setView("services");
});

document.getElementById("navServers").addEventListener("click", event => {
  event.preventDefault();
  setView("servers");
});

document.getElementById("navBrokenPaths").addEventListener("click", event => {
  event.preventDefault();
  setView("brokenPaths");
});

document.getElementById("navBlastRadius").addEventListener("click", event => {
  event.preventDefault();
  setView("blastRadius");
});

document.getElementById("navTopology").addEventListener("click", event => {
  event.preventDefault();
  setView("topology");
});

document.getElementById("viewBrokenPathsLink").addEventListener("click", event => {
  event.preventDefault();
  setView("brokenPaths");
});

document.getElementById("servicesPageSearch").addEventListener("input", renderServicesPage);
document.getElementById("servicesPageStatusFilter").addEventListener("change", renderServicesPage);
document.getElementById("servicesPageOwnerFilter").addEventListener("change", renderServicesPage);

document.getElementById("refreshBrokenPathsBtn").addEventListener("click", loadBrokenPaths);
document.getElementById("brokenPathSearch").addEventListener("input", () => renderBrokenPaths(state.brokenPaths));

document.getElementById("serverSearch").addEventListener("input", renderServersPage);
document.getElementById("instanceStatusFilter").addEventListener("change", renderServersPage);
document.getElementById("instanceTypeFilter").addEventListener("change", renderServersPage);
document.getElementById("clearServerFilterBtn").addEventListener("click", () => {
  state.selectedServer = "all";
  state.selectedInstanceKey = null;
  document.getElementById("serverSearch").value = "";
  const instanceSearch = document.getElementById("instanceSearch");
  if (instanceSearch) instanceSearch.value = "";
  document.getElementById("instanceStatusFilter").value = "running";
  document.getElementById("instanceTypeFilter").value = "all";
  state.serverSort = { field: "name", direction: "asc" };
  renderServersPage();
});

document.getElementById("blastSimulateBtn").addEventListener("click", runBlastSimulation);
document.getElementById("blastComponentSelect").addEventListener("change", runBlastSimulation);
document.getElementById("blastSearch").addEventListener("input", renderBlastAffectedTable);

document.getElementById("topologyLevel").addEventListener("change", renderTopologyPage);
document.getElementById("toggleCore").addEventListener("change", renderTopologyPage);
document.getElementById("toggleRemotes").addEventListener("change", renderTopologyPage);
document.getElementById("toggleServices").addEventListener("change", renderTopologyPage);
document.getElementById("topologySearch").addEventListener("input", renderTopologyLinksTable);
document.getElementById("topologyFitBtn").addEventListener("click", () => {
  resetTopologyToDefaultView();
});

ensureFullRescanButton();
load(false);

/*
  ScottiBYTE BlastRadius - Docker Containers drill-down table.
  This makes the Dashboard "Docker Containers" card show actual nested Docker
  containers instead of only filtering the Incus instance table.
*/

(function installDockerContainerDrilldown() {
  if (window.__blastRadiusDockerDrilldownInstalled) return;
  window.__blastRadiusDockerDrilldownInstalled = true;

  function ensureDockerDrilldownStyles() {
    if (document.getElementById("docker-drilldown-styles")) return;

    const style = document.createElement("style");
    style.id = "docker-drilldown-styles";
    style.textContent = `
      #dockerContainersPanel {
        display: none;
      }

      #dockerContainersPanel.active {
        display: block;
      }

      .docker-drilldown-table-scroll {
        max-height: 430px;
        overflow: auto;
        scrollbar-gutter: stable;
        background: #0b1220;
        border-top: 1px solid rgba(148, 163, 184, 0.14);
      }

      .docker-drilldown-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: #0b1220;
      }

      .docker-drilldown-table thead th {
        position: sticky;
        top: 0;
        z-index: 20;
        background: #0b1220 !important;
        color: var(--muted);
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        box-shadow:
          0 1px 0 rgba(148, 163, 184, 0.18),
          0 8px 12px rgba(11, 18, 32, 0.95);
      }

      .docker-drilldown-table td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.08);
        vertical-align: top;
        background: #0b1220;
      }

      .docker-drilldown-table tbody tr {
        cursor: pointer;
      }

      .docker-drilldown-table tbody tr:hover td {
        background: rgba(58, 123, 255, 0.10);
      }

      .docker-drilldown-owner {
        color: var(--muted);
        font-size: 0.78rem;
        margin-top: 2px;
      }

      .docker-drilldown-muted {
        color: var(--muted);
        font-size: 0.78rem;
        word-break: break-word;
      }

      .docker-drilldown-empty {
        color: var(--muted);
        padding: 16px 4px;
      }

      .docker-drilldown-table-scroll::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      .docker-drilldown-table-scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.35);
        border-radius: 999px;
      }

      .docker-drilldown-table-scroll::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.95);
      }
    `;

    document.head.appendChild(style);
  }

  function getNestedDockerRows() {
    const rows = [];

    for (const instance of getIncusInstances()) {
      const nestedDocker = instance.nestedDocker || {};
      const containers = Array.isArray(nestedDocker.containers)
        ? nestedDocker.containers
        : [];

      for (const container of containers) {
        rows.push({
          instance,
          container,
          ownerKey: `${instance.remote}/${instance.name}`,
          name: container.names || container.name || container.id || "unknown",
          image: container.image || "",
          status: container.status || container.state || "",
          state: container.state || "",
          ports: container.ports || "",
          networks: container.networks || "",
          unhealthy: Boolean(container.unhealthy)
        });
      }
    }

    return rows.sort((a, b) => {
      const owner = a.ownerKey.localeCompare(b.ownerKey);
      if (owner !== 0) return owner;
      return a.name.localeCompare(b.name);
    });
  }

  function dockerContainerStatusBadge(row) {
    if (row.unhealthy) {
      return `<span class="badge degraded">unhealthy</span>`;
    }

    const state = String(row.state || row.status || "").toLowerCase();

    if (state.includes("running") || state.includes("up")) {
      return `<span class="badge healthy">running</span>`;
    }

    return `<span class="badge offline">${safeText(row.state || row.status || "unknown")}</span>`;
  }

  function ensureDockerContainersPanel() {
  const serversView = document.getElementById("serversView");
  if (!serversView) return null;

  let panel = document.getElementById("dockerContainersPanel");

  // Rebuild old/flat Docker panel markup once so stale table/header wiring cannot survive.
  if (panel && panel.dataset.hierarchyVersion !== "v2") {
    panel.remove();
    panel = null;
  }

  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "dockerContainersPanel";
  panel.dataset.hierarchyVersion = "v2";
  panel.className = "panel services-panel";
  panel.innerHTML = `
    <div class="panel-head table-head">
      <div>
        <h2>Nested Docker Containers</h2>
        <div class="docker-drilldown-muted">
          Collapsed by Incus owner. Click an owner row to expand its Docker containers.
        </div>
      </div>
      <input id="dockerContainerSearch" placeholder="Search Docker container, image, owner, port, or network..." />
    </div>

    <div class="docker-drilldown-table-scroll">
      <table class="docker-drilldown-table">
        <thead>
          <tr>
            <th><button class="docker-sort-header" data-docker-sort="ownerName" type="button">Incus Owner</button></th>
            <th><button class="docker-sort-header" data-docker-sort="containerCount" type="button">Containers</button></th>
            <th><button class="docker-sort-header" data-docker-sort="runningCount" type="button">Running</button></th>
            <th><button class="docker-sort-header" data-docker-sort="serviceCount" type="button">Public Services</button></th>
            <th><button class="docker-sort-header" data-docker-sort="ip" type="button">IP</button></th>
            <th><button class="docker-sort-header" data-docker-sort="type" type="button">Type</button></th>
          </tr>
        </thead>
        <tbody id="dockerContainersTable"></tbody>
      </table>
    </div>
  `;

  const instancesPanel = [...serversView.querySelectorAll(".panel")]
    .find(item => item.textContent.includes("Incus Instances"));

  if (instancesPanel && instancesPanel.parentElement) {
    instancesPanel.parentElement.insertBefore(panel, instancesPanel);
  } else {
    const firstPanel = serversView.querySelector(".panel");
    if (firstPanel && firstPanel.parentElement) {
      firstPanel.parentElement.insertBefore(panel, firstPanel.nextSibling);
    } else {
      serversView.appendChild(panel);
    }
  }

  if (!state.dockerDrilldownSort) {
    state.dockerDrilldownSort = { key: "ownerName", dir: "asc" };
  }

  // Always start collapsed when this panel is recreated.
  state.dockerExpandedOwners = new Set();

  const search = panel.querySelector("#dockerContainerSearch");
  if (search) {
    search.addEventListener("input", renderDockerContainersTable);
  }

  panel.querySelectorAll(".docker-sort-header").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.dockerSort;
      const current = state.dockerDrilldownSort || { key: "ownerName", dir: "asc" };

      if (current.key === key) {
        current.dir = current.dir === "asc" ? "desc" : "asc";
      } else {
        current.key = key;
        current.dir = "asc";
      }

      state.dockerDrilldownSort = current;
      renderDockerContainersTable();
    });
  });

  return panel;
}



  
function dockerGroupSortValue(group, key) {
  if (key === "ownerName") return String(group.instance.name || "").toLowerCase();
  if (key === "containerCount") return group.rows.length;
  if (key === "runningCount") return group.runningCount;
  if (key === "serviceCount") return group.serviceCount;
  if (key === "ip") return String(group.instance.preferredIp || "").toLowerCase();
  if (key === "type") return String(group.instance.type || "").toLowerCase();
  return String(group.instance.name || "").toLowerCase();
}

function compareDockerGroups(a, b) {
  const sort = state.dockerDrilldownSort || { key: "ownerName", dir: "asc" };
  const av = dockerGroupSortValue(a, sort.key);
  const bv = dockerGroupSortValue(b, sort.key);

  let result = 0;

  if (typeof av === "number" && typeof bv === "number") {
    result = av - bv;
  } else {
    result = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  }

  if (result === 0) {
    result = String(a.ownerKey || "").localeCompare(String(b.ownerKey || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  return sort.dir === "desc" ? -result : result;
}

function dockerChildSort(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" });
}

function dockerSortIndicator(key) {
  const sort = state.dockerDrilldownSort || { key: "ownerName", dir: "asc" };
  if (sort.key !== key) return "";
  return sort.dir === "asc" ? " ▲" : " ▼";
}

function renderDockerContainersTable() {
  const panel = ensureDockerContainersPanel();
  const table = document.getElementById("dockerContainersTable");
  const search = document.getElementById("dockerContainerSearch");

  if (!panel || !table) return;

  if (!state.dockerDrilldownSort) {
    state.dockerDrilldownSort = { key: "ownerName", dir: "asc" };
  }

  if (!state.dockerExpandedOwners) {
    state.dockerExpandedOwners = new Set();
  }

  const labels = {
    ownerName: "Incus Owner",
    containerCount: "Containers",
    runningCount: "Running",
    serviceCount: "Public Services",
    ip: "IP",
    type: "Type"
  };

  panel.querySelectorAll(".docker-sort-header").forEach(button => {
    const key = button.dataset.dockerSort;
    button.textContent = `${labels[key] || key}${dockerSortIndicator(key)}`;
  });

  const query = String(search?.value || "").toLowerCase();
  let rows = getNestedDockerRows();

  if (query) {
    rows = rows.filter(row => {
      const text = [
        row.name,
        row.image,
        row.status,
        row.state,
        row.ports,
        row.networks,
        row.ownerKey,
        row.instance.name,
        row.instance.remote,
        row.instance.preferredIp
      ].filter(Boolean).join(" ").toLowerCase();

      return text.includes(query);
    });
  }

  if (!rows.length) {
    table.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="docker-drilldown-empty">No nested Docker containers matched this view.</div>
        </td>
      </tr>
    `;
    return;
  }

  const groupMap = new Map();

  for (const row of rows) {
    if (!groupMap.has(row.ownerKey)) {
      groupMap.set(row.ownerKey, {
        ownerKey: row.ownerKey,
        instance: row.instance,
        rows: [],
        runningCount: 0,
        serviceCount: 0
      });
    }

    groupMap.get(row.ownerKey).rows.push(row);
  }

  const groups = [...groupMap.values()].map(group => {
    group.rows.sort(dockerChildSort);
    group.runningCount = group.rows.filter(row => {
      const state = String(row.state || row.status || "").toLowerCase();
      return state.includes("running") || state.includes("up");
    }).length;
    group.serviceCount = getPublicServicesForInstance(group.instance).length;
    return group;
  }).sort(compareDockerGroups);

  table.innerHTML = groups.map(group => {
    const expanded = state.dockerExpandedOwners.has(group.ownerKey);
    const arrow = expanded ? "▾" : "▸";

    return `
      <tr class="docker-owner-row" data-docker-owner="${safeText(group.ownerKey)}" data-instance-key="${safeText(group.instance.id)}">
        <td>
          <div class="service-name">${arrow} ${safeText(group.instance.remote)} / ${safeText(group.instance.name)}</div>
          <div class="docker-drilldown-owner">${safeText(group.instance.preferredIp || "no IPv4")}</div>
        </td>
        <td>${group.rows.length}</td>
        <td>${group.runningCount}</td>
        <td>${group.serviceCount}</td>
        <td><div class="docker-drilldown-muted">${safeText(group.instance.preferredIp || "—")}</div></td>
        <td><div class="docker-drilldown-muted">${safeText(group.instance.type || "instance")}</div></td>
      </tr>

      ${
        expanded
          ? group.rows.map(row => `
              <tr class="docker-child-row" data-instance-key="${safeText(row.instance.id)}">
                <td>
                  <div class="service-name">↳ ${safeText(row.name)}</div>
                  <div class="docker-drilldown-muted">${safeText(row.container.id || "")}</div>
                </td>
                <td colspan="2">
                  <div class="docker-drilldown-muted">${safeText(row.image || "—")}</div>
                </td>
                <td>${dockerContainerStatusBadge(row)}</td>
                <td>
                  <div class="docker-drilldown-muted">${safeText(row.ports || "—")}</div>
                </td>
                <td>
                  <div class="docker-drilldown-muted">${safeText(row.networks || "—")}</div>
                </td>
              </tr>
            `).join("")
          : ""
      }
    `;
  }).join("");

  table.querySelectorAll("tr.docker-owner-row[data-docker-owner]").forEach(row => {
    row.addEventListener("click", () => {
      const owner = row.dataset.dockerOwner;

      if (state.dockerExpandedOwners.has(owner)) {
        state.dockerExpandedOwners.delete(owner);
      } else {
        state.dockerExpandedOwners.add(owner);
      }

      state.selectedInstanceKey = row.dataset.instanceKey;
      renderDockerContainersTable();

      const selected = getIncusInstances().find(instance => instance.id === state.selectedInstanceKey);
      if (selected && typeof renderInstanceDetail === "function") {
        renderInstanceDetail(selected);
      }
    });
  });

  table.querySelectorAll("tr.docker-child-row[data-instance-key]").forEach(row => {
    row.addEventListener("click", () => {
      state.selectedInstanceKey = row.dataset.instanceKey;

      const selected = getIncusInstances().find(instance => instance.id === state.selectedInstanceKey);
      if (selected && typeof renderInstanceDetail === "function") {
        renderInstanceDetail(selected);
      }
    });
  });
}





  function updateDockerContainersPanelVisibility() {
    const panel = ensureDockerContainersPanel();
    if (!panel) return;

    const isDockerDrilldown =
      state.currentView === "servers" &&
      state.summaryDrilldown === "docker-containers";

    panel.classList.toggle("active", Boolean(isDockerDrilldown));

    if (isDockerDrilldown) {
      renderDockerContainersTable();
    }
  }

  const originalRenderServersPage = renderServersPage;

  renderServersPage = function patchedRenderServersPage() {
    originalRenderServersPage();
    ensureDockerDrilldownStyles();
    updateDockerContainersPanelVisibility();
  };

  const originalDrillDownFromSummary = typeof drillDownFromSummary === "function"
    ? drillDownFromSummary
    : null;

  if (originalDrillDownFromSummary) {
    drillDownFromSummary = function patchedDrillDownFromSummary(target) {
      originalDrillDownFromSummary(target);

      if (target === "docker-containers") {
        setTimeout(() => {
          const panel = ensureDockerContainersPanel();
          if (panel) {
            panel.classList.add("active");
            renderDockerContainersTable();
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
            highlightPanel(panel);
          }
        }, 250);
      }
    };
  }
})();

/*
  ScottiBYTE BlastRadius - show nested Docker containers inside Instance Details.
  This makes clicking an Incus instance such as Apprise show the Docker containers
  running inside that Incus container.
*/

(function installInstanceNestedDockerDetails() {
  if (window.__blastRadiusInstanceDockerDetailsInstalled) return;
  window.__blastRadiusInstanceDockerDetailsInstalled = true;

  function ensureInstanceDockerDetailsStyles() {
    if (document.getElementById("instance-docker-details-styles")) return;

    const style = document.createElement("style");
    style.id = "instance-docker-details-styles";
    style.textContent = `
      .instance-docker-detail-section {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }

      .instance-docker-detail-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .instance-docker-detail-title h3 {
        margin: 0;
        font-size: 0.95rem;
        color: #e5e7eb;
      }

      .instance-docker-detail-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .instance-docker-container-card {
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 10px;
        padding: 9px 10px;
        background: rgba(15, 23, 42, 0.55);
      }

      .instance-docker-container-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 5px;
      }

      .instance-docker-container-name {
        font-weight: 900;
        color: #e5e7eb;
        word-break: break-word;
      }

      .instance-docker-container-meta {
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.35;
        word-break: break-word;
      }

      .instance-docker-empty {
        color: var(--muted);
        font-size: 0.86rem;
        padding: 8px 0;
      }
    `;

    document.head.appendChild(style);
  }

  function localSafeText(value, fallback = "") {
    const text = value === null || value === undefined || value === ""
      ? fallback
      : String(value);

    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localBadgeForDocker(container) {
    const raw = String(container.status || container.state || "").toLowerCase();

    if (container.unhealthy || raw.includes("unhealthy")) {
      return `<span class="badge degraded">unhealthy</span>`;
    }

    if (raw.includes("up") || raw.includes("running")) {
      return `<span class="badge healthy">running</span>`;
    }

    if (raw.includes("exited") || raw.includes("stopped")) {
      return `<span class="badge offline">stopped</span>`;
    }

    return `<span class="badge">${localSafeText(container.status || container.state || "unknown")}</span>`;
  }

  function findInstanceDetailsPanel() {
    const byId = document.getElementById("instanceDetailPanel");
    if (byId) return byId;

    const headings = [...document.querySelectorAll("#serversView h2, #serversView h3")];
    const heading = headings.find(item =>
      item.textContent.toLowerCase().includes("instance details")
    );

    return heading ? heading.closest(".panel") : null;
  }

  function selectedIncusInstance() {
    if (!state || !state.selectedInstanceKey || typeof getIncusInstances !== "function") {
      return null;
    }

    return getIncusInstances().find(instance => instance.id === state.selectedInstanceKey) || null;
  }

  function renderInstanceNestedDockerDetails() {
    ensureInstanceDockerDetailsStyles();

    const panel = findInstanceDetailsPanel();
    if (!panel) return;

    const oldSection = panel.querySelector(".instance-docker-detail-section");
    if (oldSection) oldSection.remove();

    const instance = selectedIncusInstance();
    if (!instance) return;

    const nestedDocker = instance.nestedDocker || {};
    const containers = Array.isArray(nestedDocker.containers)
      ? nestedDocker.containers
      : [];

    const section = document.createElement("div");
    section.className = "instance-docker-detail-section";

    if (!nestedDocker.available) {
      section.innerHTML = `
        <div class="instance-docker-detail-title">
          <h3>Nested Docker Containers</h3>
          <span class="badge offline">not available</span>
        </div>
        <div class="instance-docker-empty">
          Docker discovery was not available for this Incus instance.
        </div>
      `;
      panel.appendChild(section);
      return;
    }

    section.innerHTML = `
      <div class="instance-docker-detail-title">
        <h3>Nested Docker Containers</h3>
        <span class="badge healthy">${containers.length} discovered</span>
      </div>

      ${
        containers.length
          ? `<div class="instance-docker-detail-list">
              ${containers.map(container => `
                <div class="instance-docker-container-card">
                  <div class="instance-docker-container-head">
                    <div class="instance-docker-container-name">
                      ${localSafeText(container.names || container.name || container.id || "unknown")}
                    </div>
                    ${localBadgeForDocker(container)}
                  </div>
                  <div class="instance-docker-container-meta">
                    Image: ${localSafeText(container.image || "unknown")}
                  </div>
                  <div class="instance-docker-container-meta">
                    Status: ${localSafeText(container.status || container.state || "unknown")}
                  </div>
                  <div class="instance-docker-container-meta">
                    Ports: ${localSafeText(container.ports || "—")}
                  </div>
                  <div class="instance-docker-container-meta">
                    Networks: ${localSafeText(container.networks || "—")}
                  </div>
                </div>
              `).join("")}
            </div>`
          : `<div class="instance-docker-empty">
              Docker was discovered, but no nested Docker containers were returned.
            </div>`
      }
    `;

    panel.appendChild(section);
  }

  const previousRenderServersPage = renderServersPage;

  renderServersPage = function renderServersPageWithNestedDockerDetails() {
    previousRenderServersPage();
    renderInstanceNestedDockerDetails();
  };

  const previousScrollToDrilldownTarget =
    typeof scrollToDrilldownTarget === "function"
      ? scrollToDrilldownTarget
      : null;

  if (previousScrollToDrilldownTarget) {
    scrollToDrilldownTarget = function patchedScrollToDrilldownTarget(target) {
      if (target === "docker-containers") {
        setTimeout(() => {
          const panel = document.getElementById("dockerContainersPanel");
          if (panel) {
            panel.scrollIntoView({ behavior: "smooth", block: "start" });
            if (typeof highlightPanel === "function") highlightPanel(panel);
          }
        }, 300);
        return;
      }

      previousScrollToDrilldownTarget(target);
    };
  }
})();

/*
  ScottiBYTE BlastRadius - NPM / Proxy Hosts page.
  Separates NPM proxy-host configuration from user-facing Public Services.
*/

(function installNpmProxyHostsPage() {
  if (window.__blastRadiusNpmProxyHostsInstalled) return;
  window.__blastRadiusNpmProxyHostsInstalled = true;

  function ensureNpmProxyStyles() {
    if (document.getElementById("npm-proxy-hosts-styles")) return;

    const style = document.createElement("style");
    style.id = "npm-proxy-hosts-styles";
    style.textContent = `
      #npmProxyHostsView {
        display: none;
      }

      .npm-proxy-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(360px, 0.8fr);
        gap: 16px;
      }

      .npm-proxy-main-panel,
      .npm-proxy-detail-panel {
        height: calc(100vh - 245px);
        min-height: 520px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .npm-proxy-scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
        background: #0b1220;
        border-top: 1px solid rgba(148, 163, 184, 0.14);
        scrollbar-gutter: stable;
      }

      .npm-proxy-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: #0b1220;
      }

      .npm-proxy-table thead th {
        position: sticky;
        top: 0;
        z-index: 20;
        text-align: left;
        padding: 10px 12px;
        color: var(--muted);
        background: #0b1220 !important;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        box-shadow:
          0 1px 0 rgba(148, 163, 184, 0.18),
          0 8px 12px rgba(11, 18, 32, 0.95);
      }

      .npm-proxy-table td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.08);
        vertical-align: top;
        background: #0b1220;
      }

      .npm-proxy-table tbody tr {
        cursor: pointer;
      }

      .npm-proxy-table tbody tr:hover td {
        background: rgba(58, 123, 255, 0.10);
      }

      .npm-proxy-table tbody tr.selected-npm-proxy-row td {
        background: rgba(58, 123, 255, 0.20) !important;
        box-shadow: inset 4px 0 0 #4f7cff;
      }

      .npm-proxy-detail-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-right: 8px;
      }

      .npm-proxy-muted {
        color: var(--muted);
        font-size: 0.78rem;
        margin-top: 2px;
        word-break: break-word;
      }

      .npm-proxy-target {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.82rem;
      }

      .npm-proxy-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .npm-proxy-actions button {
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.88);
        color: #e5e7eb;
        border-radius: 9px;
        padding: 7px 10px;
        cursor: pointer;
      }

      .npm-proxy-actions button:hover {
        border-color: rgba(56, 189, 248, 0.45);
        background: rgba(56, 189, 248, 0.12);
      }

      .npm-proxy-scroll::-webkit-scrollbar,
      .npm-proxy-detail-scroll::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      .npm-proxy-scroll::-webkit-scrollbar-thumb,
      .npm-proxy-detail-scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.35);
        border-radius: 999px;
      }

      .npm-proxy-scroll::-webkit-scrollbar-track,
      .npm-proxy-detail-scroll::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.95);
      }
    `;

    document.head.appendChild(style);
  }

  function localSafeText(value, fallback = "") {
    if (typeof safeText === "function") return safeText(value, fallback);

    const text = value === null || value === undefined || value === ""
      ? fallback
      : String(value);

    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localStatusClass(status) {
    if (typeof statusClass === "function") return statusClass(status);

    const s = String(status || "").toLowerCase();
    if (["ok", "healthy", "running", "clear"].includes(s)) return "healthy";
    if (["degraded", "medium", "high", "critical"].includes(s)) return "degraded";
    return "offline";
  }

  function ensureNpmProxyHostsView() {
    let view = document.getElementById("npmProxyHostsView");
    if (view) return view;

    const main =
      document.querySelector("main") ||
      document.getElementById("main") ||
      document.querySelector(".main-content") ||
      document.querySelector(".content") ||
      document.body;

    view = document.createElement("section");
    view.id = "npmProxyHostsView";
    view.innerHTML = `
      <div class="npm-proxy-layout">
        <div class="panel npm-proxy-main-panel">
          <div class="panel-head table-head">
            <h2>NPM Proxy Hosts</h2>
            <input id="npmProxySearch" placeholder="Search domain, target, owner, status, or check mode..." />
            <select id="npmProxyStatusFilter">
              <option value="all">All Statuses</option>
              <option value="ok">OK</option>
              <option value="degraded">Degraded</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div class="npm-proxy-scroll">
            <table class="npm-proxy-table">
              <thead>
                <tr>
                  <th>Proxy Host</th>
                  <th>Forward Target</th>
                  <th>Status</th>
                  <th>Check</th>
                  <th>Incus Owner</th>
                  <th>Public Service</th>
                </tr>
              </thead>
              <tbody id="npmProxyHostsTable"></tbody>
            </table>
          </div>
        </div>

        <div class="panel npm-proxy-detail-panel">
          <h2>Proxy Host Details</h2>
          <p>Click an NPM proxy host to inspect routing, target checks, matched service, and ownership.</p>
          <div id="npmProxyDetailPanel" class="npm-proxy-detail-scroll"></div>
        </div>
      </div>
    `;

    main.appendChild(view);

    const search = view.querySelector("#npmProxySearch");
    const status = view.querySelector("#npmProxyStatusFilter");

    if (search) search.addEventListener("input", renderNpmProxyHostsPage);
    if (status) status.addEventListener("change", renderNpmProxyHostsPage);

    return view;
  }

  function getNpmProxyRows() {
    const components = (state.model?.components || [])
      .filter(component => component.type === "proxy-host" && String(component.id || "").startsWith("npm-proxy-"));

    const services = state.model?.services || [];

    return components.map(component => {
      const service = services.find(item => item.componentId === component.id);
      const npm = component.npm || service?.npm || {};
      const check = service?.check || {};
      const domains = npm.domains || service?.urls || [];
      const primaryDomain = domains[0] || component.name;
      const target = `${npm.forwardScheme || "http"}://${npm.forwardHost || ""}:${npm.forwardPort || ""}`;
      const incusOwner = component.incusOwner || service?.incusOwner || null;

      return {
        id: component.id,
        component,
        service,
        npm,
        check,
        domains,
        primaryDomain,
        target,
        incusOwner,
        status: component.status || service?.status || "unknown",
        checkMode: component.checkMode || check.checkMode || "tcp"
      };
    }).sort((a, b) => String(a.primaryDomain).localeCompare(String(b.primaryDomain)));
  }

  function selectedNpmProxyRow(rows) {
    if (!state.selectedNpmProxyHostId && rows.length) {
      state.selectedNpmProxyHostId = rows[0].id;
    }

    return rows.find(row => row.id === state.selectedNpmProxyHostId) || rows[0] || null;
  }

  function npmProxyHostRow(row) {
    const selected = row.id === state.selectedNpmProxyHostId ? "selected-npm-proxy-row" : "";
    const owner = row.incusOwner
      ? `${row.incusOwner.remote} / ${row.incusOwner.name}`
      : "Not matched";

    const serviceName = row.service
      ? row.service.name
      : "No generated service";

    return `
      <tr class="${selected}" data-npm-proxy-id="${localSafeText(row.id)}">
        <td>
          <div class="service-name">${localSafeText(row.primaryDomain)}</div>
          <div class="npm-proxy-muted">${row.domains.map(domain => localSafeText(domain)).join(", ")}</div>
        </td>
        <td>
          <div class="npm-proxy-target">${localSafeText(row.target)}</div>
          <div class="npm-proxy-muted">${localSafeText(row.npm.forwardHost)}:${localSafeText(row.npm.forwardPort)}</div>
        </td>
        <td><span class="badge ${localStatusClass(row.status)}">${localSafeText(row.status)}</span></td>
        <td>${localSafeText(row.checkMode)}</td>
        <td>${localSafeText(owner)}</td>
        <td>${localSafeText(serviceName)}</td>
      </tr>
    `;
  }

  function renderNpmProxyDetail(row) {
    const panel = document.getElementById("npmProxyDetailPanel");
    if (!panel) return;

    if (!row) {
      panel.innerHTML = `
        <div class="impact-severity">No proxy host selected</div>
        <div class="affected-row"><span>No NPM proxy hosts were returned.</span><span class="badge offline">Empty</span></div>
      `;
      return;
    }

    const owner = row.incusOwner
      ? `${row.incusOwner.remote} / ${row.incusOwner.name}`
      : "Not matched";

    const service = row.service;
    const check = row.check || {};
    const tcp = check.tcp || {};
    const http = check.http || {};
    const publicHttp = check.publicHttp || {};

    panel.innerHTML = `
      <div class="impact-severity">${localSafeText(row.primaryDomain)}</div>

      <div class="affected-row"><span>Status</span><span class="badge ${localStatusClass(row.status)}">${localSafeText(row.status)}</span></div>
      <div class="affected-row"><span>NPM ID</span><span>${localSafeText(row.npm.id || row.component.id)}</span></div>
      <div class="affected-row"><span>Enabled</span><span>${row.npm.enabled === false ? "No" : "Yes"}</span></div>
      <div class="affected-row"><span>Forward Scheme</span><span>${localSafeText(row.npm.forwardScheme || "http")}</span></div>
      <div class="affected-row"><span>Forward Host</span><span>${localSafeText(row.npm.forwardHost)}</span></div>
      <div class="affected-row"><span>Forward Port</span><span>${localSafeText(row.npm.forwardPort)}</span></div>
      <div class="affected-row"><span>Check Mode</span><span>${localSafeText(row.checkMode)}</span></div>
      <div class="affected-row"><span>Incus Owner</span><span>${localSafeText(owner)}</span></div>
      <div class="affected-row"><span>Generated Service</span><span>${service ? localSafeText(service.name) : "None"}</span></div>

      <div class="dependency-chain-box">
        <div class="dependency-chain-title">Domains</div>
        <div class="url-chips">
          ${row.domains.map(domain => `<span class="domain-chip">${localSafeText(domain)}</span>`).join("")}
        </div>
      </div>

      <div class="dependency-chain-box">
        <div class="dependency-chain-title">Health Check Results</div>
        <div class="affected-row"><span>TCP</span><span>${localSafeText(tcp.message || "Not run")}</span></div>
        <div class="affected-row"><span>HTTP</span><span>${localSafeText(http.message || "Not run")}</span></div>
        <div class="affected-row"><span>Public URL</span><span>${localSafeText(publicHttp.message || "Not run")}</span></div>
      </div>

      ${
        service && typeof dependencyChainHtml === "function"
          ? dependencyChainHtml(service.dependsOn)
          : ""
      }

      <div class="npm-proxy-actions">
        <button id="openNpmProxyPublicUrl">↗ Open Public URL</button>
        <button id="copyNpmProxyPublicUrl">⧉ Copy Public URL</button>
        <button id="viewNpmProxyService">▦ View Public Service</button>
        <button id="simulateNpmProxyFailure">◌ Simulate Failure</button>
      </div>
    `;

    const publicUrl = `https://${row.primaryDomain}`;

    document.getElementById("openNpmProxyPublicUrl")?.addEventListener("click", () => {
      window.open(publicUrl, "_blank", "noopener,noreferrer");
    });

    document.getElementById("copyNpmProxyPublicUrl")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch (_) {
        const tmp = document.createElement("input");
        tmp.value = publicUrl;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        tmp.remove();
      }
    });

    document.getElementById("viewNpmProxyService")?.addEventListener("click", () => {
      if (!service) return;
      state.selectedServiceId = service.id;
      setView("services");
    });

    document.getElementById("simulateNpmProxyFailure")?.addEventListener("click", () => {
      state.selectedBlastComponentId = row.component.id;
      setView("blastRadius");
    });
  }

  function renderNpmProxyHostsPage() {
    ensureNpmProxyStyles();
    ensureNpmProxyHostsView();

    const table = document.getElementById("npmProxyHostsTable");
    const search = document.getElementById("npmProxySearch");
    const statusFilter = document.getElementById("npmProxyStatusFilter");

    if (!table) return;

    const query = String(search?.value || "").toLowerCase();
    const status = statusFilter?.value || "all";

    let rows = getNpmProxyRows();

    if (status !== "all") {
      rows = rows.filter(row => String(row.status || "").toLowerCase() === status);
    }

    if (query) {
      rows = rows.filter(row => {
        const text = JSON.stringify({
          domain: row.primaryDomain,
          domains: row.domains,
          target: row.target,
          npm: row.npm,
          checkMode: row.checkMode,
          status: row.status,
          owner: row.incusOwner,
          service: row.service?.name
        }).toLowerCase();

        return text.includes(query);
      });
    }

    if (rows.length && !rows.some(row => row.id === state.selectedNpmProxyHostId)) {
      state.selectedNpmProxyHostId = rows[0].id;
    }

    table.innerHTML = rows.length
      ? rows.map(npmProxyHostRow).join("")
      : `<tr><td colspan="6">No NPM proxy hosts match the current filters.</td></tr>`;

    table.querySelectorAll("tr[data-npm-proxy-id]").forEach(row => {
      row.addEventListener("click", () => {
        state.selectedNpmProxyHostId = row.dataset.npmProxyId;
        renderNpmProxyHostsPage();
      });
    });

    renderNpmProxyDetail(selectedNpmProxyRow(rows));
  }

  function showNpmProxyHostsPage() {
    ensureNpmProxyStyles();
    const view = ensureNpmProxyHostsView();

    const viewIds = [
      "dashboardView",
      "servicesView",
      "serversView",
      "brokenPathsView",
      "blastRadiusView",
      "topologyView",
      "npmProxyHostsView"
    ];

    viewIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = id === "npmProxyHostsView" ? "block" : "none";
    });

    document.querySelectorAll(".nav-item, nav a, aside a, aside button").forEach(item => {
      item.classList.remove("active");
      if (item.textContent && item.textContent.toLowerCase().includes("npm / proxy hosts")) {
        item.classList.add("active");
      }
    });

    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");

    if (title) title.textContent = "NPM / Proxy Hosts";
    if (subtitle) subtitle.textContent = "Nginx Proxy Manager routing objects, targets, checks, and ownership";

    state.currentView = "npmProxyHosts";
    renderNpmProxyHostsPage();
  }

  window.showNpmProxyHostsPage = showNpmProxyHostsPage;

  const oldDrillDownFromSummary =
    typeof drillDownFromSummary === "function"
      ? drillDownFromSummary
      : null;

  if (oldDrillDownFromSummary) {
    drillDownFromSummary = function patchedNpmProxyDrilldown(target) {
      if (target === "proxy-hosts") {
        state.summaryDrilldown = "proxy-hosts";
        showNpmProxyHostsPage();
        return;
      }

      oldDrillDownFromSummary(target);
    };
  }

  function wireNpmProxySidebarLink() {
    const items = [...document.querySelectorAll("a, button, .nav-item")];
    const item = items.find(element =>
      element.textContent &&
      element.textContent.trim().toLowerCase() === "npm / proxy hosts"
    );

    if (!item || item.dataset.npmProxyHostsWired === "true") return;

    item.dataset.npmProxyHostsWired = "true";
    item.addEventListener("click", event => {
      event.preventDefault();
      showNpmProxyHostsPage();
    });
  }

  wireNpmProxySidebarLink();
  setTimeout(wireNpmProxySidebarLink, 500);
})();

/*
  ScottiBYTE BlastRadius - Docker hierarchy readability polish.
  CSS-only. Does not change Docker drill-down logic, sorting, expansion, or selection.
*/
(function installDockerHierarchyReadabilityPolish() {
  if (window.__blastRadiusDockerHierarchyReadabilityPolishInstalled) return;
  window.__blastRadiusDockerHierarchyReadabilityPolishInstalled = true;

  function installStyles() {
    if (document.getElementById("docker-hierarchy-readability-polish-styles")) return;

    const style = document.createElement("style");
    style.id = "docker-hierarchy-readability-polish-styles";
    style.textContent = `
      #dockerContainersPanel {
        box-shadow: inset 4px 0 0 rgba(56, 189, 248, 0.32);
      }

      #dockerContainersPanel .panel-head h2::after {
        content: "  grouped by Incus owner";
        color: var(--muted);
        font-size: 0.72rem;
        font-weight: 500;
        margin-left: 8px;
      }

      .docker-owner-row td {
        background: linear-gradient(
          90deg,
          rgba(56, 189, 248, 0.18),
          rgba(15, 23, 42, 0.76)
        ) !important;
        border-top: 1px solid rgba(56, 189, 248, 0.34) !important;
        border-bottom: 1px solid rgba(56, 189, 248, 0.20) !important;
        padding-top: 10px !important;
        padding-bottom: 10px !important;
      }

      .docker-owner-row .service-name {
        font-size: 0.94rem;
        font-weight: 800;
        color: #e5e7eb;
      }

      .docker-owner-row .docker-drilldown-owner {
        margin-top: 4px;
        color: #9ca3af;
      }

      .docker-child-row td {
        background: rgba(15, 23, 42, 0.50) !important;
        border-bottom: 1px solid rgba(148, 163, 184, 0.08) !important;
      }

      .docker-child-row td:first-child {
        position: relative;
        padding-left: 34px !important;
      }

      .docker-child-row td:first-child::before {
        content: "";
        position: absolute;
        left: 16px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(56, 189, 248, 0.26);
      }

      .docker-child-row td:first-child::after {
        content: "";
        position: absolute;
        left: 16px;
        top: 50%;
        width: 12px;
        height: 2px;
        background: rgba(56, 189, 248, 0.36);
      }

      .docker-child-row .service-name {
        color: #dbeafe;
        font-weight: 700;
      }

      .docker-child-row .service-name::before {
        content: "Docker ";
        color: #38bdf8;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-right: 6px;
      }

      .docker-child-row:hover td {
        background: rgba(79, 124, 255, 0.18) !important;
      }

      .docker-owner-row:hover td {
        background: linear-gradient(
          90deg,
          rgba(79, 124, 255, 0.24),
          rgba(15, 23, 42, 0.82)
        ) !important;
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installStyles);
  } else {
    installStyles();
  }
})();



/*
  Exact sidebar routing for secondary Infrastructure/Admin links.
  Uses explicit IDs from index.html. No text matching. No broad delegation.
*/

function ensureSidebarUtilityView() {
  let view = document.getElementById("sidebarUtilityView");
  if (view) return view;

  view = document.createElement("section");
  view.id = "sidebarUtilityView";
  view.className = "view";
  view.style.display = "none";

  const main = document.querySelector("main") || document.body;
  main.appendChild(view);

  return view;
}

function hidePrimaryViewsForSidebarUtility() {
  [
    "dashboardView",
    "servicesView",
    "serversView",
    "brokenPathsView",
    "blastRadiusView",
    "topologyView",
    "npmProxyHostsView",
    "sidebarUtilityView"
  ].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  });

  document.querySelectorAll(".nav a, .nav-item, aside a, aside button").forEach(item => {
    item.classList.remove("active");
  });
}

function setSidebarActiveById(id) {
  const item = document.getElementById(id);
  if (item) item.classList.add("active");
}

function sidebarMetricRows(rows) {
  return rows.map(row => `
    <div class="affected-row">
      <span>${safeText(row[0])}</span>
      <span>${safeText(row[1])}</span>
    </div>
  `).join("");
}

function showSidebarUtilityPage({ navId, title, subtitle, status, description, rows }) {
  const view = ensureSidebarUtilityView();
  hidePrimaryViewsForSidebarUtility();

  view.style.display = "block";
  setSidebarActiveById(navId);

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  if (pageTitle) pageTitle.textContent = title;
  if (pageSubtitle) pageSubtitle.textContent = subtitle;

  view.innerHTML = `
    <div class="detail-grid">
      <div class="panel">
        <h2>${safeText(title)}</h2>
        <p><strong>Status:</strong> ${safeText(status)}</p>
        <p class="muted">${safeText(description)}</p>
      </div>
      <div class="panel">
        <h2>Current Discovery Snapshot</h2>
        ${sidebarMetricRows(rows)}
      </div>
    </div>
  `;

  state.currentView = navId;
}

function scrollToSidebarTarget(text) {
  const needle = String(text || "").toLowerCase();

  setTimeout(() => {
    const candidates = [...document.querySelectorAll(".panel, h2, h3, table")];
    const target = candidates.find(element =>
      String(element.textContent || "").toLowerCase().includes(needle)
    );

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 200);
}

function firstIncusInstanceKeyForExactSidebar() {
  const rows = getIncusInstances().slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );

  return rows[0]?.id || null;
}

function firstNestedDockerInstanceKeyForExactSidebar() {
  const rows = getIncusInstances()
    .filter(instance => Array.isArray(instance.nestedDocker?.containers) && instance.nestedDocker.containers.length)
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );

  return rows[0]?.id || null;
}

function wireExactSidebarLink(id, handler) {
  const item = document.getElementById(id);
  if (!item || item.dataset.exactSidebarWired === "true") return;

  item.dataset.exactSidebarWired = "true";
  item.addEventListener("click", event => {
    event.preventDefault();
    handler();
  });
}

function wireExactSecondarySidebarLinks() {
  wireExactSidebarLink("navIncusHosts", () => {
    state.summaryDrilldown = "incus-hosts";
    state.selectedServer = typeof firstIncusHostNameForDrilldown === "function"
      ? firstIncusHostNameForDrilldown()
      : "all";
    state.selectedInstanceKey = null;
    setView("servers");
    scrollToSidebarTarget("Incus Servers");
  });

  wireExactSidebarLink("navIncusInstances", () => {
    state.summaryDrilldown = "incus-instances";
    state.selectedServer = "all";
    state.selectedInstanceKey = firstIncusInstanceKeyForExactSidebar();
    setView("servers");
    scrollToSidebarTarget("Incus Instances");
  });

  wireExactSidebarLink("navDockerStacks", () => {
    state.summaryDrilldown = "docker-containers";
    state.selectedServer = "all";
    state.selectedInstanceKey = firstNestedDockerInstanceKeyForExactSidebar();
    setView("servers");
    scrollToSidebarTarget("Nested Docker Containers");
  });

  wireExactSidebarLink("navNpmProxyHosts", () => {
    if (typeof window.showNpmProxyHostsPage === "function") {
      window.showNpmProxyHostsPage();
    } else {
      state.summaryDrilldown = "proxy-hosts";
      setView("services");
    }
  });

  wireExactSidebarLink("navUnifiNetwork", () => {
    const summary = state.summary || {};
    showSidebarUtilityPage({
      navId: "navUnifiNetwork",
      title: "UniFi Network",
      subtitle: "Network discovery and topology context",
      status: "Limited discovery",
      description: "Dedicated UniFi inventory is not implemented yet. Current UniFi data is used for topology context.",
      rows: [
        ["Online UniFi Devices", summary.unifiDevices?.online ?? 0],
        ["Offline UniFi Devices", summary.unifiDevices?.offline ?? 0],
        ["Current Use", "Topology context"]
      ]
    });
  });

  wireExactSidebarLink("navDnsDomains", () => {
    const summary = state.summary || {};
    const discovery = summary.dnsDiscovery || state.model?.dnsDiscovery || {};
    showSidebarUtilityPage({
      navId: "navDnsDomains",
      title: "DNS & Domains",
      subtitle: "Public DNS provider, primary domain, and nameservers",
      status: discovery.discovered ? "Discovered" : "Partially implemented",
      description: "DNS discovery is active. A full domain inventory page can be developed later.",
      rows: [
        ["Primary Domain", summary.primaryDomain || state.model?.primaryDomain || "Not discovered"],
        ["DNS Provider", summary.dnsProvider || state.model?.dnsProvider || "Not discovered"],
        ["Nameservers", Array.isArray(discovery.nameservers) ? discovery.nameservers.join(", ") : "None discovered"]
      ]
    });
  });

  wireExactSidebarLink("navCloudExternal", () => {
    const summary = state.summary || {};
    showSidebarUtilityPage({
      navId: "navCloudExternal",
      title: "Cloud & External",
      subtitle: "External entry path, WAN IP, and public dependency edge",
      status: "Working",
      description: "This summarizes the discovered external-facing edge of the homelab dependency model.",
      rows: [
        ["WAN IP", summary.wanIp || summary.publicIp || state.model?.wanIp || "Not discovered"],
        ["Primary Domain", summary.primaryDomain || state.model?.primaryDomain || "Not discovered"],
        ["DNS Provider", summary.dnsProvider || state.model?.dnsProvider || "Not discovered"],
        ["Public Services", summary.publicServices?.healthy ?? 0]
      ]
    });
  });

  wireExactSidebarLink("navAlerts", () => {
    const summary = state.summary || {};
    const issues = Array.isArray(state.model?.issues) ? state.model.issues : [];
    showSidebarUtilityPage({
      navId: "navAlerts",
      title: "Alerts",
      subtitle: "Current warnings and detected issues",
      status: "Partially implemented",
      description: "Issue detection exists. A full alert management page can be developed later.",
      rows: [
        ["Detected Issues", issues.length],
        ["Broken Proxy Hosts", summary.proxyHosts?.broken ?? 0],
        ["Degraded Public Services", summary.publicServices?.degraded ?? 0],
        ["Unhealthy Docker Containers", summary.dockerContainers?.unhealthy ?? 0]
      ]
    });
  });

  wireExactSidebarLink("navBackups", () => {
    showSidebarUtilityPage({
      navId: "navBackups",
      title: "Backups",
      subtitle: "Future backup visibility and restore readiness",
      status: "Discovery not implemented yet",
      description: "Reserved for future integration with ScottiBYTE Incus Backup or configured backup targets.",
      rows: [
        ["Discovery Source", "Not configured"],
        ["Backup Jobs", "Not implemented"],
        ["Restore Checks", "Not implemented"]
      ]
    });
  });

  wireExactSidebarLink("navSettings", () => {
    showSidebarUtilityPage({
      navId: "navSettings",
      title: "Settings",
      subtitle: "Application configuration and discovery settings",
      status: "Not implemented yet",
      description: "This placeholder confirms the Settings route is reserved. Configuration is currently managed through files and environment settings.",
      rows: [
        ["Config Source", "data/config.json"],
        ["Runtime Settings", "Not implemented"],
        ["UI Preferences", "Not implemented"]
      ]
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireExactSecondarySidebarLinks();
  setTimeout(wireExactSecondarySidebarLinks, 400);
});

setTimeout(wireExactSecondarySidebarLinks, 1000);


/*
  Top-right project controls:
  GitHub / version / Donate / Light-Dark toggle.
  Injected into the existing top action area to match other ScottiBYTE apps.
*/
function applyStoredThemePreference() {
  const savedTheme = localStorage.getItem("scottibyteBlastRadiusTheme") || "dark";
  const isLight = savedTheme === "light";

  document.body.classList.toggle("light-theme", isLight);

  const button = document.getElementById("topThemeToggleBtn");
  if (button) {
    button.textContent = isLight ? "☾ Dark" : "☀ Light";
    button.title = isLight ? "Switch to dark mode" : "Switch to light mode";
  }
}

function ensureTopRightProjectControls() {
  if (document.getElementById("topProjectControls")) {
    applyStoredThemePreference();
    return;
  }

  const topActions =
    document.querySelector(".top-actions") ||
    document.querySelector(".header-actions") ||
    document.querySelector(".page-actions") ||
    document.querySelector("header .actions") ||
    document.querySelector("header") ||
    document.querySelector(".topbar") ||
    document.querySelector(".app-header");

  if (!topActions) return;

  const controls = document.createElement("div");
  controls.id = "topProjectControls";
  controls.className = "top-project-controls";
  controls.innerHTML = `
    <a id="topGithubLink"
       href="https://github.com/ScottiBYTE/BlastRadius"
       target="_blank"
       rel="noopener noreferrer"
       title="Open GitHub repository">GitHub</a>
    <span id="topVersionLabel">v1.0.1</span>
    <a id="topDonateLink"
       href="https://www.paypal.com/paypalme/ScottiBYTE"
       target="_blank"
       rel="noopener noreferrer"
       title="Support ScottiBYTE">❤ Donate</a>
    <button id="topThemeToggleBtn" type="button" title="Switch to light mode">☀ Light</button>
  `;

  topActions.appendChild(controls);

  const themeButton = document.getElementById("topThemeToggleBtn");
  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const isLight = !document.body.classList.contains("light-theme");
      localStorage.setItem("scottibyteBlastRadiusTheme", isLight ? "light" : "dark");
      applyStoredThemePreference();
    });
  }

  applyStoredThemePreference();
}

document.addEventListener("DOMContentLoaded", () => {
  ensureTopRightProjectControls();
  setTimeout(ensureTopRightProjectControls, 300);
});

setTimeout(ensureTopRightProjectControls, 1000);

/*
  Runtime light-mode override.
  This is injected by app.js so it loads after dynamic page/view styles.
*/
function ensureRuntimeLightModeOverrideStyles() {
  let style = document.getElementById("runtimeLightModeOverrideStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "runtimeLightModeOverrideStyles";
    document.head.appendChild(style);
  }

  style.textContent = `
    body.light-theme #servicesView .panel,
    body.light-theme #servicesView .panel > div,
    body.light-theme #servicesView .panel table,
    body.light-theme #servicesView .panel thead,
    body.light-theme #servicesView .panel tbody,
    body.light-theme #servicesView .panel tr,
    body.light-theme #servicesView .panel td,
    body.light-theme #serversView .panel,
    body.light-theme #serversView .panel > div,
    body.light-theme #serversView .panel table,
    body.light-theme #serversView .panel thead,
    body.light-theme #serversView .panel tbody,
    body.light-theme #serversView .panel tr,
    body.light-theme #serversView .panel td,
    body.light-theme #brokenPathsView .panel,
    body.light-theme #brokenPathsView .panel > div,
    body.light-theme #brokenPathsView .panel table,
    body.light-theme #brokenPathsView .panel tr,
    body.light-theme #brokenPathsView .panel td {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border-color: rgba(15, 23, 42, 0.10) !important;
    }

    body.light-theme #servicesView .panel thead,
    body.light-theme #servicesView .panel thead tr,
    body.light-theme #servicesView .panel th,
    body.light-theme #serversView .panel thead,
    body.light-theme #serversView .panel thead tr,
    body.light-theme #serversView .panel th {
      background-color: #e2e8f0 !important;
      color: #334155 !important;
      border-color: rgba(15, 23, 42, 0.14) !important;
    }

    body.light-theme #servicesView .panel tbody tr.selected,
    body.light-theme #servicesView .panel tbody tr.selected td,
    body.light-theme #servicesView .panel tbody tr.active,
    body.light-theme #servicesView .panel tbody tr.active td,
    body.light-theme #serversView .panel tbody tr.selected,
    body.light-theme #serversView .panel tbody tr.selected td,
    body.light-theme #serversView .panel tbody tr.active,
    body.light-theme #serversView .panel tbody tr.active td {
      background-color: #bfdbfe !important;
      color: #0f172a !important;
    }

    body.light-theme #servicesView .panel h1,
    body.light-theme #servicesView .panel h2,
    body.light-theme #servicesView .panel h3,
    body.light-theme #serversView .panel h1,
    body.light-theme #serversView .panel h2,
    body.light-theme #serversView .panel h3,
    body.light-theme #brokenPathsView .panel h1,
    body.light-theme #brokenPathsView .panel h2,
    body.light-theme #brokenPathsView .panel h3 {
      color: #0f172a !important;
    }

    body.light-theme #servicesView .panel small,
    body.light-theme #servicesView .panel .muted,
    body.light-theme #serversView .panel small,
    body.light-theme #serversView .panel .muted,
    body.light-theme #brokenPathsView .panel small,
    body.light-theme #brokenPathsView .panel .muted {
      color: #64748b !important;
    }

    body.light-theme #servicesView .affected-row,
    body.light-theme #servicesView .detail-row,
    body.light-theme #servicesView .dependency-step,
    body.light-theme #serversView .affected-row,
    body.light-theme #serversView .detail-row,
    body.light-theme #serversView .dependency-step,
    body.light-theme #brokenPathsView .affected-row,
    body.light-theme #brokenPathsView .detail-row {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border-color: rgba(15, 23, 42, 0.10) !important;
    }

    body.light-theme #servicesView .dependency-chain,
    body.light-theme #servicesView .dependency-chain-box,
    body.light-theme #servicesView .dependency-chain-steps,
    body.light-theme #serversView .dependency-chain,
    body.light-theme #serversView .dependency-chain-box,
    body.light-theme #serversView .dependency-chain-steps {
      background-color: #ffffff !important;
      color: #0f172a !important;
    }

    body.light-theme #servicesView .dependency-step,
    body.light-theme #serversView .dependency-step {
      background-color: #f8fafc !important;
      color: #0f172a !important;
    }

    body.light-theme #servicesView .dependency-step-number,
    body.light-theme #serversView .dependency-step-number {
      background-color: #dbeafe !important;
      color: #1d4ed8 !important;
    }

    body.light-theme #servicesView div[style*="#020617"],
    body.light-theme #servicesView div[style*="#0f172a"],
    body.light-theme #servicesView div[style*="#111827"],
    body.light-theme #servicesView div[style*="#1e293b"],
    body.light-theme #serversView div[style*="#020617"],
    body.light-theme #serversView div[style*="#0f172a"],
    body.light-theme #serversView div[style*="#111827"],
    body.light-theme #serversView div[style*="#1e293b"],
    body.light-theme #brokenPathsView div[style*="#020617"],
    body.light-theme #brokenPathsView div[style*="#0f172a"],
    body.light-theme #brokenPathsView div[style*="#111827"],
    body.light-theme #brokenPathsView div[style*="#1e293b"] {
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #0f172a !important;
    }

    body.light-theme #servicesView .status-pill,
    body.light-theme #servicesView .healthy,
    body.light-theme #serversView .status-pill,
    body.light-theme #serversView .healthy {
      background-color: rgba(5, 150, 105, 0.14) !important;
      color: #047857 !important;
    }

    body.light-theme #servicesView input,
    body.light-theme #servicesView select,
    body.light-theme #serversView input,
    body.light-theme #serversView select,
    body.light-theme #brokenPathsView input,
    body.light-theme #brokenPathsView select {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border-color: rgba(15, 23, 42, 0.18) !important;
    }
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  ensureRuntimeLightModeOverrideStyles();
  setTimeout(ensureRuntimeLightModeOverrideStyles, 300);
  setTimeout(ensureRuntimeLightModeOverrideStyles, 1200);
});

setTimeout(ensureRuntimeLightModeOverrideStyles, 1800);

/*
  Final light-mode dark-shell normalizer.
  Some generated tables/details use dark runtime styles after CSS loads.
  This scans only the known content views while light mode is active and tags
  dark computed backgrounds with light-mode override classes.
*/
function colorStringToRgb(value) {
  const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3])
  };
}

function isComputedDarkBackground(element) {
  if (!element || element.nodeType !== 1) return false;

  const style = window.getComputedStyle(element);
  const rgb = colorStringToRgb(style.backgroundColor);
  if (!rgb) return false;

  return rgb.r < 65 && rgb.g < 75 && rgb.b < 95;
}

function clearLightModeNormalizerClasses() {
  document
    .querySelectorAll(".light-force-panel, .light-force-table-head, .light-force-muted, .light-force-danger, .light-force-selected")
    .forEach(element => {
      element.classList.remove(
        "light-force-panel",
        "light-force-table-head",
        "light-force-muted",
        "light-force-danger",
        "light-force-selected"
      );
    });
}

function normalizeRemainingLightModeDarkShells() {
  if (!document.body.classList.contains("light-theme")) {
    clearLightModeNormalizerClasses();
    return;
  }

  const scope = document.querySelectorAll(`
    #dashboardView,
    #servicesView,
    #serversView,
    #brokenPathsView,
    #blastRadiusView,
    #topologyView,
    #npmProxyHostsView,
    #sidebarUtilityView
  `);

  scope.forEach(view => {
    view.querySelectorAll("*").forEach(element => {
      const tag = element.tagName ? element.tagName.toLowerCase() : "";
      const text = String(element.textContent || "").trim();

      if (tag === "svg" || tag === "path" || tag === "line") return;
      if (element.closest("#topologyCanvas") && !element.classList.contains("node")) return;

      if (element.matches("thead, thead *, th")) {
        element.classList.add("light-force-table-head");
        return;
      }

      if (
        element.matches("tr.selected, tr.active, tr[aria-selected='true'], .selected-row") ||
        element.closest("tr.selected, tr.active, tr[aria-selected='true'], .selected-row")
      ) {
        element.classList.add("light-force-selected");
      }

      if (isComputedDarkBackground(element)) {
        element.classList.add("light-force-panel");
      }

      if (
        element.matches("small, .muted, .subtle, .panel-subtitle, .summary-subtitle, .dependency-step-type") &&
        text
      ) {
        element.classList.add("light-force-muted");
      }

      if (
        text &&
        (
          element.matches(".danger, .danger-text, .issue-title, .selected-service-title, .selected-proxy-title") ||
          text.toUpperCase().includes("NO INSTANCE SELECTED") ||
          text.toUpperCase().includes("NO BROKEN PATHS DETECTED")
        )
      ) {
        element.classList.add("light-force-danger");
      }
    });
  });
}

function scheduleLightModeDarkShellNormalization() {
  setTimeout(normalizeRemainingLightModeDarkShells, 50);
  setTimeout(normalizeRemainingLightModeDarkShells, 250);
  setTimeout(normalizeRemainingLightModeDarkShells, 900);
}

document.addEventListener("DOMContentLoaded", () => {
  scheduleLightModeDarkShellNormalization();

  document.addEventListener("click", () => {
    scheduleLightModeDarkShellNormalization();
  }, true);

  const observer = new MutationObserver(() => {
    if (document.body.classList.contains("light-theme")) {
      scheduleLightModeDarkShellNormalization();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

setTimeout(scheduleLightModeDarkShellNormalization, 1200);

/*
  Final light-mode fix for remaining dark generated table/header strips.
  Uses direct runtime style properties only while light mode is active.
*/
function clearDirectLightModeRuntimeFixes() {
  document.querySelectorAll("[data-light-runtime-fixed='true']").forEach(element => {
    element.style.removeProperty("background");
    element.style.removeProperty("background-color");
    element.style.removeProperty("color");
    element.style.removeProperty("border-color");
    element.dataset.lightRuntimeFixed = "false";
  });
}

function applyDirectLightModeRuntimeFixes() {
  if (!document.body.classList.contains("light-theme")) {
    clearDirectLightModeRuntimeFixes();
    return;
  }

  const views = document.querySelectorAll(`
    #dashboardView,
    #servicesView,
    #serversView,
    #brokenPathsView,
    #npmProxyHostsView
  `);

  views.forEach(view => {
    view.querySelectorAll("*").forEach(element => {
      const tag = element.tagName ? element.tagName.toLowerCase() : "";
      if (tag === "svg" || tag === "path" || tag === "line") return;
      if (element.closest("#topologyCanvas")) return;

      const computed = window.getComputedStyle(element);
      const rgb = colorStringToRgb(computed.backgroundColor);
      if (!rgb) return;

      const isDark = rgb.r < 65 && rgb.g < 75 && rgb.b < 95;
      if (!isDark) return;

      const text = String(element.textContent || "").trim().replace(/\s+/g, " ");
      const looksLikeTableHeader =
        tag === "thead" ||
        tag === "th" ||
        element.matches("thead, thead *, th") ||
        (
          text.includes("Service") &&
          text.includes("Incus Owner") &&
          (text.includes("Status") || text.includes("Dependencies"))
        ) ||
        (
          text.includes("Instance") &&
          text.includes("Server") &&
          text.includes("Status")
        );

      element.dataset.lightRuntimeFixed = "true";

      if (looksLikeTableHeader) {
        element.style.setProperty("background", "#e2e8f0", "important");
        element.style.setProperty("background-color", "#e2e8f0", "important");
        element.style.setProperty("color", "#334155", "important");
        element.style.setProperty("border-color", "rgba(15, 23, 42, 0.14)", "important");
      } else {
        element.style.setProperty("background", "#ffffff", "important");
        element.style.setProperty("background-color", "#ffffff", "important");
        element.style.setProperty("color", "#0f172a", "important");
        element.style.setProperty("border-color", "rgba(15, 23, 42, 0.10)", "important");
      }
    });
  });
}

function scheduleDirectLightModeRuntimeFixes() {
  setTimeout(applyDirectLightModeRuntimeFixes, 100);
  setTimeout(applyDirectLightModeRuntimeFixes, 400);
  setTimeout(applyDirectLightModeRuntimeFixes, 1200);
}

document.addEventListener("DOMContentLoaded", () => {
  scheduleDirectLightModeRuntimeFixes();

  document.addEventListener("click", () => {
    scheduleDirectLightModeRuntimeFixes();
  }, true);
});

setTimeout(scheduleDirectLightModeRuntimeFixes, 1800);
