const STATUSES = ["All", "Booked", "Dispatched", "In Transit", "Delayed", "Delivered"];

const state = {
  selectedShipmentId: "",
  activeTab: "dashboard",
  filterStatus: "All",
  search: "",
  portalCustomerId: "",
  shipments: [],
  vehicles: [],
  customers: [],
  warehouses: [],
  inventory: [],
  invoices: [],
  notifications: [],
  projects: [],
  teamSchedules: [],
  travelTickets: [],
  alerts: [],
  kpis: null,
  cities: [],
  mlInsights: null,
  mlPrediction: null,
  portal: null,
  loaded: false
};

const elements = {
  nav: document.querySelector(".nav-list"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  kpiGrid: document.querySelector(".kpi-grid"),
  workspace: document.querySelector(".workspace-grid"),
  search: document.querySelector("#shipment-search"),
  filters: document.querySelector("#status-filters"),
  table: document.querySelector("#shipment-table"),
  fleet: document.querySelector("#fleet-list"),
  alerts: document.querySelector("#alerts-list"),
  routeTitle: document.querySelector("#route-title"),
  routeStatus: document.querySelector("#route-status"),
  routeMap: document.querySelector("#route-map"),
  detailCustomer: document.querySelector("#detail-customer"),
  detailDriver: document.querySelector("#detail-driver"),
  detailWeight: document.querySelector("#detail-weight"),
  detailRevenue: document.querySelector("#detail-revenue"),
  detailDistance: document.querySelector("#detail-distance"),
  detailMlEta: document.querySelector("#detail-ml-eta"),
  trackingList: document.querySelector("#tracking-list"),
  dialog: document.querySelector("#shipment-dialog"),
  form: document.querySelector("#shipment-form"),
  vehicleSelect: document.querySelector("#vehicle-select"),
  aiPrompt: document.querySelector("#ai-prompt"),
  aiOutput: document.querySelector("#ai-output"),
  aiStatus: document.querySelector("#ai-status"),
  aiGenerate: document.querySelector("#generate-ai-plan"),
  driverStatus: document.querySelector("#driver-status"),
  driverShipment: document.querySelector("#driver-shipment"),
  driverCopy: document.querySelector("#driver-copy"),
  driverPickup: document.querySelector("#driver-pickup"),
  driverPod: document.querySelector("#driver-pod"),
  driverIncident: document.querySelector("#driver-incident"),
  podReceiver: document.querySelector("#pod-receiver"),
  incidentIssue: document.querySelector("#incident-issue"),
  invoiceList: document.querySelector("#invoice-list"),
  notificationList: document.querySelector("#notification-list"),
  projectProgressList: document.querySelector("#project-progress-list"),
  teamScheduleList: document.querySelector("#team-schedule-list"),
  travelTicketList: document.querySelector("#travel-ticket-list"),
  sendNotification: document.querySelector("#send-notification"),
  portalCustomerSelect: document.querySelector("#portal-customer-select"),
  portalSummary: document.querySelector("#portal-summary"),
  mlPrediction: document.querySelector("#ml-prediction"),
  demandForecast: document.querySelector("#demand-forecast"),
  anomalyList: document.querySelector("#anomaly-list"),
  warehouseSuggestions: document.querySelector("#warehouse-suggestions"),
  runMlPrediction: document.querySelector("#run-ml-prediction"),
  kpiActive: document.querySelector("#kpi-active"),
  kpiActiveDetail: document.querySelector("#kpi-active-detail"),
  kpiDelayed: document.querySelector("#kpi-delayed"),
  kpiDelayDetail: document.querySelector("#kpi-delay-detail"),
  kpiUtilization: document.querySelector("#kpi-utilization"),
  kpiFleetDetail: document.querySelector("#kpi-fleet-detail"),
  kpiOnTime: document.querySelector("#kpi-ontime"),
  kpiOnTimeDetail: document.querySelector("#kpi-ontime-detail")
};

bindEvents();
init();

function bindEvents() {
  elements.nav.addEventListener("click", handleNavClick);
  document.querySelector("#open-shipment-dialog").addEventListener("click", openDialog);
  document.querySelector("#close-dialog").addEventListener("click", closeDialog);
  document.querySelector("#cancel-dialog").addEventListener("click", closeDialog);
  document.querySelector("#reset-data").addEventListener("click", resetData);
  document.querySelector("#export-csv").addEventListener("click", exportShipments);
  elements.search.addEventListener("input", handleSearch);
  elements.form.addEventListener("submit", createShipment);
  elements.table.addEventListener("change", handleStatusChange);
  elements.table.addEventListener("click", handleTableClick);
  elements.filters.addEventListener("click", handleFilterClick);
  elements.aiGenerate.addEventListener("click", generateAiPlan);
  elements.driverPickup.addEventListener("click", confirmPickup);
  elements.driverPod.addEventListener("click", capturePod);
  elements.driverIncident.addEventListener("click", reportIncident);
  elements.sendNotification.addEventListener("click", sendCustomerNotification);
  elements.portalCustomerSelect.addEventListener("change", () => loadCustomerPortal(elements.portalCustomerSelect.value));
  elements.runMlPrediction.addEventListener("click", () => runMlPrediction(true));
}

async function init() {
  try {
    syncTabFromHash();
    await refreshState();
    await Promise.all([loadMlInsights(), loadCustomerPortal(state.portalCustomerId)]);
    await runMlPrediction(false);
  } catch (error) {
    renderStartupError(error);
  }
}

async function refreshState() {
  const data = await api("/api/state");
  applyServerState(data);
  state.loaded = true;
  ensureSelectedShipment();
  render();
}

function applyServerState(data) {
  state.shipments = data.shipments || [];
  state.vehicles = data.vehicles || [];
  state.customers = data.customers || [];
  state.warehouses = data.warehouses || [];
  state.inventory = data.inventory || [];
  state.invoices = data.invoices || [];
  state.notifications = data.notifications || [];
  state.projects = data.projects || [];
  state.teamSchedules = data.teamSchedules || [];
  state.travelTickets = data.travelTickets || [];
  state.alerts = data.alerts || [];
  state.kpis = data.kpis || null;
  state.cities = data.cities || [];
  if (!state.portalCustomerId) {
    state.portalCustomerId = state.customers[0]?.id || "";
  }
}

function render() {
  elements.search.value = state.search;
  ensureSelectedShipment();
  renderTabs();
  renderFilters();
  renderKpis();
  renderShipments();
  renderRouteDetails();
  renderFleet();
  renderAlerts();
  renderVehicleOptions();
  renderDriverWorkflow();
  renderBilling();
  renderProjectDelivery();
  renderPortalOptions();
  renderPortalSummary();
  renderMl();
}

function renderTabs() {
  const visiblePanels = getVisiblePanelsForTab(state.activeTab);
  elements.navItems.forEach((item) => {
    const isActive = item.getAttribute("href") === `#${state.activeTab}`;
    item.classList.toggle("is-active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  const isDashboard = state.activeTab === "dashboard";
  elements.kpiGrid.hidden = !isDashboard;
  elements.workspace.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = !visiblePanels.has(panel.id);
  });
}

function ensureSelectedShipment() {
  if (!state.shipments.some((shipment) => shipment.id === state.selectedShipmentId)) {
    state.selectedShipmentId = state.shipments[0]?.id || "";
  }
}

function renderFilters() {
  elements.filters.innerHTML = STATUSES.map((status) => {
    const count = status === "All"
      ? state.shipments.length
      : state.shipments.filter((shipment) => shipment.status === status).length;
    const active = state.filterStatus === status ? " is-active" : "";
    return `<button class="chip-button${active}" type="button" data-status="${escapeHtml(status)}">${escapeHtml(status)} ${count}</button>`;
  }).join("");
}

function renderKpis() {
  const kpis = state.kpis || buildLocalKpis();
  elements.kpiActive.textContent = kpis.active;
  elements.kpiActiveDetail.textContent = `${kpis.highPriority} high priority`;
  elements.kpiDelayed.textContent = kpis.delayed;
  elements.kpiDelayDetail.textContent = `${kpis.delayed} need action`;
  elements.kpiUtilization.textContent = `${kpis.utilization}%`;
  elements.kpiFleetDetail.textContent = `${kpis.onlineVehicles} vehicles online`;
  elements.kpiOnTime.textContent = `${kpis.onTimeRate}%`;
  elements.kpiOnTimeDetail.textContent = `${kpis.completed} completed loads`;
}

function renderShipments() {
  const visibleShipments = getVisibleShipments();

  if (!visibleShipments.length) {
    elements.table.innerHTML = `<tr><td colspan="6"><div class="empty-state">No shipments match the current view.</div></td></tr>`;
    return;
  }

  elements.table.innerHTML = visibleShipments.map((shipment) => {
    const vehicle = findVehicle(shipment.vehicleId);
    const selected = shipment.id === state.selectedShipmentId ? " is-selected" : "";
    return `
      <tr class="${selected}" data-id="${escapeHtml(shipment.id)}">
        <td>
          <span class="shipment-title">${escapeHtml(shipment.id)}</span>
          <span class="shipment-sub">${escapeHtml(shipment.customer)}</span>
          <span class="priority ${shipment.priority.toLowerCase()}">${escapeHtml(shipment.priority)}</span>
        </td>
        <td>
          <span class="lane-title">${escapeHtml(shipment.origin)} to ${escapeHtml(shipment.destination)}</span>
          <span class="lane-sub">${formatNumber(shipment.distanceKm || shipment.route?.distanceKm || 0)} km | ${shipment.progress}% complete</span>
        </td>
        <td>
          <span class="shipment-title">${formatEta(shipment.eta)}</span>
          <span class="eta-sub">${etaLabel(shipment)}</span>
        </td>
        <td>
          <select class="status-select" data-status-id="${escapeHtml(shipment.id)}" aria-label="Shipment status">
            ${STATUSES.filter((status) => status !== "All").map((status) => {
              const selectedOption = status === shipment.status ? " selected" : "";
              return `<option${selectedOption}>${escapeHtml(status)}</option>`;
            }).join("")}
          </select>
        </td>
        <td>
          <span class="shipment-title">${escapeHtml(vehicle?.id || "Unassigned")}</span>
          <span class="shipment-sub">${escapeHtml(vehicle?.driver || "-")}</span>
        </td>
        <td>
          <button class="view-button" type="button" data-view-id="${escapeHtml(shipment.id)}" aria-label="View shipment ${escapeHtml(shipment.id)}" title="View shipment">
            <svg viewBox="0 0 24 24"><path d="M12 5c5.2 0 8.3 4.1 9.4 6.2l.4.8-.4.8C20.3 14.9 17.2 19 12 19s-8.3-4.1-9.4-6.2L2.2 12l.4-.8C3.7 9.1 6.8 5 12 5Zm0 2c-3.8 0-6.3 2.8-7.3 5 1 2.2 3.5 5 7.3 5s6.3-2.8 7.3-5c-1-2.2-3.5-5-7.3-5Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderRouteDetails() {
  const shipment = getSelectedShipment();
  if (!shipment) {
    elements.routeTitle.textContent = "No shipment";
    elements.routeStatus.textContent = "Ready";
    elements.routeStatus.className = "status-pill neutral";
    elements.routeMap.innerHTML = "";
    elements.detailCustomer.textContent = "-";
    elements.detailDriver.textContent = "-";
    elements.detailWeight.textContent = "-";
    elements.detailRevenue.textContent = "-";
    elements.detailDistance.textContent = "-";
    elements.detailMlEta.textContent = "-";
    elements.trackingList.innerHTML = "";
    return;
  }

  const vehicle = findVehicle(shipment.vehicleId);
  const prediction = state.mlPrediction?.shipmentId === shipment.id ? state.mlPrediction : null;
  elements.routeTitle.textContent = `${shipment.origin} to ${shipment.destination}`;
  elements.routeStatus.textContent = shipment.status;
  elements.routeStatus.className = `status-pill ${statusClass(shipment.status)}`;
  elements.detailCustomer.textContent = shipment.customer;
  elements.detailDriver.textContent = vehicle?.driver || "Unassigned";
  elements.detailWeight.textContent = `${formatNumber(shipment.weightKg)} kg`;
  elements.detailRevenue.textContent = formatCurrency(shipment.revenue);
  elements.detailDistance.textContent = `${formatNumber(shipment.distanceKm || shipment.route?.distanceKm || 0)} km`;
  elements.detailMlEta.textContent = prediction ? formatEta(prediction.mlEta) : "Run ML";
  elements.routeMap.innerHTML = createRouteVisual(shipment);
  elements.trackingList.innerHTML = shipment.checkpoints.map((checkpoint) => `
    <li>
      <span class="tracking-dot" aria-hidden="true"></span>
      <span class="tracking-copy">
        <strong>${escapeHtml(checkpoint.label)}</strong>
        <span>${escapeHtml(checkpoint.time)}</span>
      </span>
    </li>
  `).join("");
}

function renderFleet() {
  elements.fleet.innerHTML = state.vehicles.map((vehicle) => `
    <div class="fleet-row">
      <div class="fleet-main">
        <strong>${escapeHtml(vehicle.id)}</strong>
        <span class="status-pill ${vehicle.status === "Maintenance" ? "delayed" : statusClass(vehicle.status)}">${escapeHtml(vehicle.status)}</span>
      </div>
      <div class="fleet-meta">${escapeHtml(vehicle.type)} | ${escapeHtml(vehicle.driver)} | ${escapeHtml(vehicle.location)}</div>
      <div class="meter" aria-label="Utilization ${vehicle.utilization}%"><span style="width: ${vehicle.utilization}%"></span></div>
    </div>
  `).join("");
}

function renderAlerts() {
  const alerts = getAlerts();
  elements.alerts.innerHTML = alerts.length
    ? alerts.map((alert) => `
      <div class="alert-row">
        <div class="alert-main">
          <strong>${escapeHtml(alert.title)}</strong>
          <span class="status-pill ${alert.level}">${escapeHtml(alert.label)}</span>
        </div>
        <div class="alert-copy">${escapeHtml(alert.copy)}</div>
      </div>
    `).join("")
    : `<div class="empty-state">No exceptions in the queue.</div>`;
}

function renderVehicleOptions() {
  elements.vehicleSelect.innerHTML = state.vehicles.map((vehicle) => (
    `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.id)} - ${escapeHtml(vehicle.driver)}</option>`
  )).join("");
}

function renderDriverWorkflow() {
  const shipment = getSelectedShipment();
  const vehicle = shipment ? findVehicle(shipment.vehicleId) : null;
  elements.driverShipment.textContent = shipment ? `${shipment.id} | ${shipment.origin} to ${shipment.destination}` : "Select a shipment";
  elements.driverCopy.textContent = shipment
    ? `${vehicle?.driver || "Driver"} can update pickup, proof of delivery, or incidents for ${shipment.customer}.`
    : "Pickup, POD, and incident updates write back to the database.";
  elements.driverStatus.textContent = shipment?.status || "Ready";
  elements.driverStatus.className = `status-pill ${shipment ? statusClass(shipment.status) : "neutral"}`;
}

function renderBilling() {
  elements.invoiceList.innerHTML = state.invoices.slice(0, 7).map((invoice) => {
    const shipment = state.shipments.find((item) => item.id === invoice.shipmentId);
    return `
      <div class="stack-item">
        <strong>${escapeHtml(invoice.id)} | ${formatCurrency(invoice.total)}</strong>
        <span>${escapeHtml(shipment?.customer || invoice.customerId)} | ${escapeHtml(invoice.status)} | due ${escapeHtml(invoice.dueAt)}</span>
      </div>
    `;
  }).join("");

  elements.notificationList.innerHTML = state.notifications.slice(0, 7).map((notification) => `
    <div class="stack-item">
      <strong>${escapeHtml(notification.channel)} | ${escapeHtml(notification.status)}</strong>
      <span>${escapeHtml(notification.message)}</span>
    </div>
  `).join("");
}

function renderProjectDelivery() {
  elements.projectProgressList.innerHTML = state.projects.length
    ? state.projects.map((project) => `
      <div class="stack-item">
        <strong>${escapeHtml(project.name)} | ${escapeHtml(project.client)}</strong>
        <span>${escapeHtml(project.serviceType)} | ${project.completion}% complete | ${escapeHtml(project.status)}</span>
        <div class="progress-track" aria-label="${escapeHtml(project.name)} completion ${project.completion}%">
          <span style="width: ${project.completion}%"></span>
        </div>
      </div>
    `).join("")
    : `<div class="stack-item"><strong>No active projects</strong><span>Add service projects to track completion.</span></div>`;

  elements.teamScheduleList.innerHTML = state.teamSchedules.length
    ? state.teamSchedules.map((schedule) => `
      <div class="stack-item">
        <strong>${escapeHtml(schedule.memberName)} | ${escapeHtml(schedule.role)}</strong>
        <span>${escapeHtml(schedule.projectId)} | ${escapeHtml(schedule.assignmentType)} | ${escapeHtml(schedule.date)}</span>
        <span>${escapeHtml(schedule.location)} | ${escapeHtml(schedule.status)}</span>
      </div>
    `).join("")
    : `<div class="stack-item"><strong>No team schedules</strong><span>Member plans will show up here.</span></div>`;

  elements.travelTicketList.innerHTML = state.travelTickets.length
    ? state.travelTickets.map((ticket) => `
      <div class="stack-item">
        <strong>${escapeHtml(ticket.memberName)} | ${escapeHtml(ticket.mode)} ${escapeHtml(ticket.ticketNo)}</strong>
        <span>${escapeHtml(ticket.from)} to ${escapeHtml(ticket.to)} | ${escapeHtml(ticket.departureAt)}</span>
        <span>${escapeHtml(ticket.projectId)} | ${escapeHtml(ticket.status)}${ticket.cancellationReason ? ` | ${escapeHtml(ticket.cancellationReason)}` : ""}</span>
      </div>
    `).join("")
    : `<div class="stack-item"><strong>No travel tickets</strong><span>Upcoming travel and cancellations will show here.</span></div>`;
}

function renderPortalOptions() {
  elements.portalCustomerSelect.innerHTML = state.customers.map((customer) => {
    const selected = customer.id === state.portalCustomerId ? " selected" : "";
    return `<option value="${escapeHtml(customer.id)}"${selected}>${escapeHtml(customer.companyName)}</option>`;
  }).join("");
}

function renderPortalSummary() {
  if (!state.portal) {
    elements.portalSummary.innerHTML = `<div class="empty-state">Loading customer portal...</div>`;
    return;
  }

  const lastShipment = state.portal.shipments[0];
  elements.portalSummary.innerHTML = `
    <div class="portal-metric">
      <span>Customer</span>
      <strong>${escapeHtml(state.portal.customer.companyName)}</strong>
    </div>
    <div class="portal-metric">
      <span>Active Loads</span>
      <strong>${state.portal.summary.activeShipments}</strong>
    </div>
    <div class="portal-metric">
      <span>Invoice Value</span>
      <strong>${formatCurrency(state.portal.summary.invoiceTotal)}</strong>
    </div>
    <div class="portal-metric">
      <span>Latest Status</span>
      <strong>${escapeHtml(lastShipment?.status || "No loads")}</strong>
    </div>
  `;
}

function renderMl() {
  const model = state.mlInsights?.model;
  const selectedPrediction = state.mlPrediction;
  elements.mlPrediction.textContent = selectedPrediction
    ? [
      `${selectedPrediction.shipmentId}: ${selectedPrediction.predictedDeliveryHours} hours predicted`,
      `ML ETA: ${formatEta(selectedPrediction.mlEta)}`,
      `Route: ${selectedPrediction.recommendedRoute.join(" > ")}`,
      `Confidence: ${Math.round(selectedPrediction.confidence * 100)}%`,
      model ? `Model: ${model.version}, ${formatNumber(model.recordCount)} records, MAE ${model.metrics.maeHours}h` : ""
    ].filter(Boolean).join("\n")
    : "Select a shipment and run prediction.";

  elements.demandForecast.innerHTML = (state.mlInsights?.demandForecast || []).slice(0, 7).map((item) => `
    <div class="stack-item">
      <strong>${escapeHtml(item.day)} | ${item.expectedOrders} orders</strong>
      <span>${escapeHtml(item.hotLane)} | ${item.recommendedVehicles} vehicles recommended</span>
    </div>
  `).join("");

  elements.anomalyList.innerHTML = (state.mlInsights?.anomalies || []).length
    ? state.mlInsights.anomalies.map((item) => `
      <div class="stack-item">
        <strong>${escapeHtml(item.shipmentId)} | score ${item.score}</strong>
        <span>${escapeHtml(item.reason)} | ${escapeHtml(item.lane)}</span>
      </div>
    `).join("")
    : `<div class="stack-item"><strong>No major anomalies</strong><span>Current loads are within trained thresholds.</span></div>`;

  elements.warehouseSuggestions.innerHTML = (state.mlInsights?.warehouseSuggestions || []).slice(0, 6).map((item) => `
    <div class="stack-item">
      <strong>${escapeHtml(item.sku)} | ${escapeHtml(item.warehouseId)}</strong>
      <span>${item.availableDays} days available | reorder ${item.reorderQty} | ${escapeHtml(item.slotting)}</span>
    </div>
  `).join("");
}

function createRouteVisual(shipment) {
  const route = shipment.route || {};
  const origin = route.origin || {};
  const destination = route.destination || {};
  const percent = Math.max(0, Math.min(100, shipment.progress || 0));
  const originPoint = projectPoint(origin.lat, origin.lng);
  const destinationPoint = projectPoint(destination.lat, destination.lng);
  const currentX = originPoint.x + ((destinationPoint.x - originPoint.x) * percent) / 100;
  const currentY = originPoint.y + ((destinationPoint.y - originPoint.y) * percent) / 100;

  return `
    <svg viewBox="0 0 520 220" role="img" aria-label="Route from ${escapeHtml(shipment.origin)} to ${escapeHtml(shipment.destination)}">
      <path d="M80 35 L465 35 L465 185 L80 185 Z" fill="#f7fafc" stroke="#dfe3ea"/>
      <path d="M${originPoint.x} ${originPoint.y} C${originPoint.x + 80} ${originPoint.y - 30}, ${destinationPoint.x - 80} ${destinationPoint.y + 30}, ${destinationPoint.x} ${destinationPoint.y}" stroke="#c9d3df" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M${originPoint.x} ${originPoint.y} C${originPoint.x + 80} ${originPoint.y - 30}, ${destinationPoint.x - 80} ${destinationPoint.y + 30}, ${destinationPoint.x} ${destinationPoint.y}" stroke="#1f7a5c" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="1000" stroke-dashoffset="${1000 - percent * 10}"/>
      <circle cx="${originPoint.x}" cy="${originPoint.y}" r="12" fill="#1f7a5c"/>
      <circle cx="${destinationPoint.x}" cy="${destinationPoint.y}" r="12" fill="#235d9f"/>
      <circle cx="${currentX}" cy="${currentY}" r="8" fill="#f0b04d" stroke="#19212c" stroke-width="3"/>
    </svg>
    <span class="map-label" style="left: ${originPoint.left}%; top: ${originPoint.top}%;">${escapeHtml(shipment.origin)}</span>
    <span class="map-label" style="left: ${destinationPoint.left}%; top: ${destinationPoint.top}%;">${escapeHtml(shipment.destination)}</span>
  `;
}

function projectPoint(lat = 19, lng = 77) {
  const minLat = 8;
  const maxLat = 31;
  const minLng = 68;
  const maxLng = 90;
  const left = clamp(((lng - minLng) / (maxLng - minLng)) * 76 + 12, 12, 88);
  const top = clamp((1 - (lat - minLat) / (maxLat - minLat)) * 70 + 15, 15, 85);
  return {
    left,
    top,
    x: (left / 100) * 520,
    y: (top / 100) * 220
  };
}

function getVisibleShipments() {
  const search = state.search.trim().toLowerCase();
  return state.shipments
    .filter((shipment) => state.filterStatus === "All" || shipment.status === state.filterStatus)
    .filter((shipment) => {
      if (!search) return true;
      return [
        shipment.id,
        shipment.customer,
        shipment.origin,
        shipment.destination,
        shipment.status,
        shipment.priority,
        shipment.vehicleId
      ].join(" ").toLowerCase().includes(search);
    })
    .sort((a, b) => {
      const priorityScore = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (priorityScore !== 0) return priorityScore;
      return new Date(a.eta).getTime() - new Date(b.eta).getTime();
    });
}

async function createShipment(event) {
  event.preventDefault();
  const data = new FormData(elements.form);

  await api("/api/shipments", {
    method: "POST",
    body: {
      customer: String(data.get("customer")).trim(),
      origin: String(data.get("origin")).trim(),
      destination: String(data.get("destination")).trim(),
      eta: String(data.get("eta")),
      vehicleId: String(data.get("vehicle")),
      priority: String(data.get("priority")),
      weightKg: Number(data.get("weight")),
      revenue: Number(data.get("revenue"))
    }
  });

  closeDialog();
  await refreshState();
  await loadCustomerPortal(state.portalCustomerId);
  await loadMlInsights();
}

async function handleStatusChange(event) {
  const select = event.target.closest("[data-status-id]");
  if (!select) return;

  await api(`/api/shipments/${encodeURIComponent(select.dataset.statusId)}/status`, {
    method: "PATCH",
    body: { status: select.value }
  });
  state.selectedShipmentId = select.dataset.statusId;
  await refreshState();
  await loadCustomerPortal(state.portalCustomerId);
}

function handleTableClick(event) {
  const button = event.target.closest("[data-view-id]");
  const row = event.target.closest("tr[data-id]");
  const shipmentId = button?.dataset.viewId || row?.dataset.id;
  if (!shipmentId) return;
  state.selectedShipmentId = shipmentId;
  render();
  runMlPrediction(false);
}

function handleSearch(event) {
  state.search = event.target.value;
  render();
}

function handleFilterClick(event) {
  const button = event.target.closest("[data-status]");
  if (!button) return;
  state.filterStatus = button.dataset.status;
  render();
}

function handleNavClick(event) {
  const link = event.target.closest(".nav-item");
  if (!link) return;
  const tab = link.getAttribute("href")?.replace("#", "");
  if (!tab) return;
  event.preventDefault();
  if (tab === state.activeTab) return;
  state.activeTab = tab;
  history.replaceState(null, "", `#${state.activeTab}`);
  renderTabs();
}

function syncTabFromHash() {
  const hashTab = window.location.hash.replace("#", "");
  const tabs = new Set([
    "dashboard",
    "shipment-board",
    "fleet-assets",
    "exception-queue",
    "driver-mobile",
    "billing-center",
    "customer-portal",
    "ml-studio",
    "ai-dispatch",
    "project-delivery"
  ]);
  if (tabs.has(hashTab)) {
    state.activeTab = hashTab;
  }
}

function getVisiblePanelsForTab(tab) {
  if (tab === "dashboard") {
    return new Set(Array.from(elements.workspace.querySelectorAll(".panel")).map((panel) => panel.id));
  }

  const panelMap = {
    "shipment-board": ["shipment-board", "route-panel"],
    "fleet-assets": ["fleet-assets"],
    "exception-queue": ["exception-queue"],
    "driver-mobile": ["driver-mobile"],
    "billing-center": ["billing-center"],
    "customer-portal": ["customer-portal"],
    "ml-studio": ["ml-studio"],
    "ai-dispatch": ["ai-dispatch"],
    "project-delivery": ["project-delivery"]
  };

  const panelIds = panelMap[tab] || ["shipment-board", "route-panel"];
  return new Set(panelIds);
}

async function resetData() {
  await api("/api/reset", { method: "POST" });
  state.selectedShipmentId = "";
  state.portalCustomerId = "";
  state.mlPrediction = null;
  await refreshState();
  await loadCustomerPortal(state.portalCustomerId);
  await loadMlInsights();
  await runMlPrediction(false);
}

async function confirmPickup() {
  const shipment = getSelectedShipment();
  if (!shipment) return;
  await api("/api/driver/pickup", { method: "POST", body: { shipmentId: shipment.id } });
  await refreshState();
}

async function capturePod() {
  const shipment = getSelectedShipment();
  if (!shipment) return;
  await api("/api/driver/pod", {
    method: "POST",
    body: {
      shipmentId: shipment.id,
      receiverName: elements.podReceiver.value.trim() || "Receiver",
      notes: "Delivered in good condition"
    }
  });
  elements.podReceiver.value = "";
  await refreshState();
  await loadCustomerPortal(state.portalCustomerId);
}

async function reportIncident() {
  const shipment = getSelectedShipment();
  if (!shipment) return;
  await api("/api/driver/incident", {
    method: "POST",
    body: {
      shipmentId: shipment.id,
      issue: elements.incidentIssue.value.trim() || "Driver reported operational delay",
      severity: "Medium"
    }
  });
  elements.incidentIssue.value = "";
  await refreshState();
  await loadCustomerPortal(state.portalCustomerId);
  await loadMlInsights();
}

async function sendCustomerNotification() {
  const shipment = getSelectedShipment();
  if (!shipment) return;
  await api("/api/notifications/send", {
    method: "POST",
    body: {
      shipmentId: shipment.id,
      customerId: shipment.customerId,
      channel: "WhatsApp",
      message: `${shipment.id} update: ${shipment.status}, ETA ${formatEta(shipment.eta)}.`
    }
  });
  await refreshState();
  await loadCustomerPortal(state.portalCustomerId);
}

async function loadCustomerPortal(customerId) {
  if (!customerId) return;
  state.portalCustomerId = customerId;
  state.portal = await api(`/api/customer-portal?customerId=${encodeURIComponent(customerId)}`);
  renderPortalOptions();
  renderPortalSummary();
}

async function loadMlInsights() {
  state.mlInsights = await api("/api/ml/insights");
  renderMl();
}

async function runMlPrediction(updateUi) {
  const shipment = getSelectedShipment();
  if (!shipment) return;
  if (updateUi) {
    elements.mlPrediction.textContent = "Running delivery-time, route, demand, anomaly, and warehouse signals...";
  }
  state.mlPrediction = await api("/api/ml/predict", {
    method: "POST",
    body: { shipmentId: shipment.id }
  });
  renderRouteDetails();
  renderMl();
}

async function generateAiPlan() {
  elements.aiGenerate.disabled = true;
  setAiStatus("Thinking", "in-transit");
  elements.aiOutput.textContent = "Analyzing shipment board, fleet availability, exception queue, and ML signals...";

  try {
    const data = await api("/api/ai/dispatch-plan", {
      method: "POST",
      body: {
        prompt: elements.aiPrompt.value,
        selectedShipmentId: state.selectedShipmentId,
        shipments: state.shipments,
        vehicles: state.vehicles,
        alerts: getAlerts(),
        ml: state.mlInsights
      }
    });

    elements.aiOutput.textContent = data.answer || "Mistral returned an empty response.";
    setAiStatus("Done", "delivered");
  } catch (error) {
    elements.aiOutput.textContent = error.message;
    setAiStatus("Needs setup", "delayed");
  } finally {
    elements.aiGenerate.disabled = false;
  }
}

function openDialog() {
  const now = new Date();
  now.setHours(now.getHours() + 24, 0, 0, 0);
  elements.form.elements.eta.value = toDatetimeLocalValue(now);
  elements.dialog.showModal();
}

function closeDialog() {
  elements.dialog.close();
  elements.form.reset();
}

function exportShipments() {
  const headers = ["id", "customer", "origin", "destination", "status", "priority", "eta", "vehicleId", "weightKg", "revenue", "distanceKm"];
  const rows = state.shipments.map((shipment) => headers.map((header) => csvCell(shipment[header])).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "shipments.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function renderStartupError(error) {
  const message = `${error.message} Start the app with npm start and open http://localhost:3000.`;
  elements.table.innerHTML = `<tr><td colspan="6"><div class="empty-state">${escapeHtml(message)}</div></td></tr>`;
  elements.aiOutput.textContent = message;
  elements.mlPrediction.textContent = message;
}

function buildLocalKpis() {
  const active = state.shipments.filter((shipment) => shipment.status !== "Delivered");
  const delayed = state.shipments.filter(isDelayed);
  const highPriority = active.filter((shipment) => shipment.priority !== "Normal");
  const onlineVehicles = state.vehicles.filter((vehicle) => vehicle.status !== "Maintenance");
  const utilization = average(state.vehicles.map((vehicle) => vehicle.utilization));
  const completed = state.shipments.filter((shipment) => shipment.status === "Delivered");
  const onTimeRate = state.shipments.length ? Math.round(((state.shipments.length - delayed.length) / state.shipments.length) * 100) : 0;
  return {
    active: active.length,
    highPriority: highPriority.length,
    delayed: delayed.length,
    utilization,
    onlineVehicles: onlineVehicles.length,
    onTimeRate,
    completed: completed.length
  };
}

function getAlerts() {
  return state.alerts.length ? state.alerts : buildLocalAlerts();
}

function buildLocalAlerts() {
  return state.shipments
    .filter(isDelayed)
    .map((shipment) => ({
      title: shipment.id,
      label: "Delayed",
      level: "delayed",
      copy: `${shipment.origin} to ${shipment.destination} for ${shipment.customer} needs revised ETA.`
    }));
}

function findVehicle(vehicleId) {
  return state.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

function getSelectedShipment() {
  return state.shipments.find((shipment) => shipment.id === state.selectedShipmentId);
}

function isDelayed(shipment) {
  return shipment.status === "Delayed" || (shipment.status !== "Delivered" && new Date(shipment.eta).getTime() < Date.now());
}

function priorityWeight(priority) {
  return { Critical: 3, High: 2, Normal: 1 }[priority] || 0;
}

function statusClass(status) {
  return String(status || "neutral").toLowerCase().replace(/\s+/g, "-");
}

function etaLabel(shipment) {
  if (shipment.status === "Delivered") return "Completed";
  const eta = new Date(shipment.eta).getTime();
  const diff = eta - Date.now();
  if (diff < 0) return "Past ETA";
  const hours = Math.ceil(diff / 36e5);
  if (hours < 24) return `${hours}h remaining`;
  return `${Math.ceil(hours / 24)}d remaining`;
}

function formatEta(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toDatetimeLocalValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setAiStatus(label, className) {
  elements.aiStatus.textContent = label;
  elements.aiStatus.className = `status-pill ${className}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
