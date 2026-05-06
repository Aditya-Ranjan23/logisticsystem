const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { estimateRoute, listCities, optimizeStops } = require("./services/geo");
const { getMlInsights, predictShipmentFromDb } = require("./services/ml");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "logixops.db.json");
const SEED_DB_PATH = path.join(DATA_DIR, "logixops.seed.json");
const ML_MODEL_PATH = path.join(DATA_DIR, "ml-model.json");
const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MISTRAL_MODEL = "mistral-small-latest";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected server error." });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`LogixOps running at http://localhost:${PORT}`);
  });
}

module.exports = { server };

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/state") {
    const db = await readDb();
    sendJson(response, 200, buildStatePayload(db));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reset") {
    await resetDb();
    const db = await readDb();
    sendJson(response, 200, buildStatePayload(db));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/shipments") {
    const db = await readDb();
    const body = await readJsonBody(request);
    const shipment = await createShipment(db, body);
    await writeDb(db);
    sendJson(response, 201, { shipment, state: buildStatePayload(db) });
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/shipments\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
    const db = await readDb();
    const body = await readJsonBody(request);
    const shipment = updateShipmentStatus(db, statusMatch[1], body.status);
    await writeDb(db);
    sendJson(response, 200, { shipment, state: buildStatePayload(db) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/route/estimate") {
    const route = estimateRoute({
      origin: url.searchParams.get("origin"),
      destination: url.searchParams.get("destination"),
      vehicleType: url.searchParams.get("vehicleType"),
      priority: url.searchParams.get("priority"),
      weightKg: Number(url.searchParams.get("weightKg") || 0),
      departureAt: url.searchParams.get("departureAt") || new Date().toISOString()
    });
    sendJson(response, 200, route);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/route/optimize") {
    const body = await readJsonBody(request);
    sendJson(response, 200, optimizeStops(body.origin, body.stops || []));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/invoices") {
    const db = await readDb();
    sendJson(response, 200, db.invoices);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/customer-portal") {
    const db = await readDb();
    sendJson(response, 200, buildCustomerPortal(db, url.searchParams.get("customerId")));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/notifications/send") {
    const db = await readDb();
    const body = await readJsonBody(request);
    const notification = createNotification(db, body);
    await writeDb(db);
    sendJson(response, 201, { notification, state: buildStatePayload(db) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/driver/pickup") {
    const db = await readDb();
    const body = await readJsonBody(request);
    const shipment = updateShipmentStatus(db, body.shipmentId, "In Transit", "Driver confirmed pickup");
    await writeDb(db);
    sendJson(response, 200, { shipment, state: buildStatePayload(db) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/driver/pod") {
    const db = await readDb();
    const body = await readJsonBody(request);
    const pod = capturePod(db, body);
    await writeDb(db);
    sendJson(response, 201, { pod, state: buildStatePayload(db) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/driver/incident") {
    const db = await readDb();
    const body = await readJsonBody(request);
    const incident = captureIncident(db, body);
    await writeDb(db);
    sendJson(response, 201, { incident, state: buildStatePayload(db) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ml/insights") {
    const db = await readDb();
    sendJson(response, 200, await getMlInsights(db, ML_MODEL_PATH));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ml/predict") {
    const db = await readDb();
    const body = await readJsonBody(request);
    sendJson(response, 200, await predictShipmentFromDb(db, ML_MODEL_PATH, body.shipmentId));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/dispatch-plan") {
    await handleDispatchPlan(request, response);
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

async function readDb() {
  await ensureDataFiles();
  const db = JSON.parse(await fs.readFile(DB_PATH, "utf8"));
  db.shipments = db.shipments.map((shipment) => enrichShipmentRoute(shipment, db));
  return db;
}

async function writeDb(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function resetDb() {
  await ensureDataFiles();
  await fs.copyFile(SEED_DB_PATH, DB_PATH);
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  if (!fsSync.existsSync(DB_PATH) || !fsSync.existsSync(SEED_DB_PATH)) {
    throw new Error("Missing data files. Run `npm run prepare:data` first.");
  }
}

function buildStatePayload(db) {
  ensureServiceOpsData(db);
  return {
    ...db,
    cities: listCities(),
    alerts: buildAlerts(db),
    kpis: buildKpis(db)
  };
}

function ensureServiceOpsData(db) {
  if (!Array.isArray(db.projects) || !db.projects.length) {
    db.projects = [
      {
        id: "PRJ-101",
        name: "Complay Build ERP",
        client: "Complay Build Services",
        serviceType: "Web App",
        completion: 72,
        status: "In Progress",
        deadline: "2026-06-20"
      },
      {
        id: "PRJ-102",
        name: "Field Worker Mobile App",
        client: "Complay Build Services",
        serviceType: "Mobile App",
        completion: 46,
        status: "In Progress",
        deadline: "2026-07-05"
      },
      {
        id: "PRJ-103",
        name: "Client Marketing Website",
        client: "Arden Infra",
        serviceType: "Website",
        completion: 90,
        status: "UAT",
        deadline: "2026-05-30"
      }
    ];
  }

  if (!Array.isArray(db.teamSchedules) || !db.teamSchedules.length) {
    db.teamSchedules = [
      {
        id: "SCH-201",
        memberId: "EMP-11",
        memberName: "Rohan Mehta",
        role: "Frontend Engineer",
        projectId: "PRJ-101",
        assignmentType: "On-site",
        location: "Complay Build HQ, Pune",
        date: "2026-05-08",
        status: "Scheduled"
      },
      {
        id: "SCH-202",
        memberId: "EMP-18",
        memberName: "Aisha Khan",
        role: "Backend Engineer",
        projectId: "PRJ-101",
        assignmentType: "Remote",
        location: "Bengaluru",
        date: "2026-05-09",
        status: "Scheduled"
      },
      {
        id: "SCH-203",
        memberId: "EMP-24",
        memberName: "Neel Joshi",
        role: "Project Manager",
        projectId: "PRJ-102",
        assignmentType: "Client Visit",
        location: "Complay Build Site Office, Mumbai",
        date: "2026-05-10",
        status: "Confirmed"
      }
    ];
  }

  if (!Array.isArray(db.travelTickets) || !db.travelTickets.length) {
    db.travelTickets = [
      {
        id: "TRV-301",
        projectId: "PRJ-101",
        memberName: "Rohan Mehta",
        mode: "Flight",
        ticketNo: "6E-78421",
        from: "Bengaluru",
        to: "Pune",
        departureAt: "2026-05-08 07:15",
        status: "Booked",
        cancellationReason: ""
      },
      {
        id: "TRV-302",
        projectId: "PRJ-102",
        memberName: "Neel Joshi",
        mode: "Train",
        ticketNo: "PNR-8827741105",
        from: "Delhi",
        to: "Mumbai",
        departureAt: "2026-05-09 21:10",
        status: "Cancelled",
        cancellationReason: "Client asked to move site visit to next week"
      },
      {
        id: "TRV-303",
        projectId: "PRJ-103",
        memberName: "Ananya Das",
        mode: "Flight",
        ticketNo: "AI-90317",
        from: "Kolkata",
        to: "Ahmedabad",
        departureAt: "2026-05-11 06:45",
        status: "Rescheduled",
        cancellationReason: ""
      }
    ];
  }
}

async function createShipment(db, body) {
  const customer = findOrCreateCustomer(db, body.customer);
  const vehicle = db.vehicles.find((item) => item.id === body.vehicleId);
  const createdAt = new Date().toISOString();
  const route = estimateRoute({
    origin: body.origin,
    destination: body.destination,
    priority: body.priority,
    weightKg: Number(body.weightKg),
    vehicleType: vehicle?.type,
    departureAt: createdAt
  });
  const shipment = {
    id: nextId(db.shipments, "SHP-2605"),
    customerId: customer.id,
    customer: customer.companyName,
    origin: String(body.origin || "").trim(),
    destination: String(body.destination || "").trim(),
    status: "Booked",
    priority: body.priority || "Normal",
    eta: route.eta || body.eta,
    vehicleId: body.vehicleId,
    weightKg: Number(body.weightKg || 0),
    volumeCbm: Number(body.volumeCbm || Math.max(1, Number(body.weightKg || 0) / 340).toFixed(1)),
    revenue: Number(body.revenue || 0),
    progress: 5,
    distanceKm: route.distanceKm,
    route,
    createdAt,
    checkpoints: [
      { label: `Booked ${body.origin} to ${body.destination}`, time: timestamp() }
    ]
  };

  db.shipments.unshift(shipment);
  db.invoices.unshift({
    id: nextId(db.invoices, "INV-2605"),
    shipmentId: shipment.id,
    customerId: customer.id,
    subtotal: Math.round(shipment.revenue * 0.92),
    tax: Math.round(shipment.revenue * 0.08),
    total: shipment.revenue,
    status: "Draft",
    dueAt: addDays(new Date(), 14).toISOString().slice(0, 10)
  });
  createNotification(db, {
    shipmentId: shipment.id,
    customerId: customer.id,
    channel: "Email",
    message: `${shipment.id} has been booked for ${shipment.origin} to ${shipment.destination}.`
  });

  if (vehicle && vehicle.status === "Available") {
    vehicle.status = "Booked";
  }

  return shipment;
}

function findOrCreateCustomer(db, customerName) {
  const companyName = String(customerName || "Walk-in Customer").trim();
  const existing = db.customers.find((customer) => customer.companyName.toLowerCase() === companyName.toLowerCase());
  if (existing) return existing;

  const customer = {
    id: nextId(db.customers, "CUST"),
    companyName,
    contactName: "Ops Contact",
    email: "ops@example.com",
    phone: "+91-90000-00000",
    tier: "Standard"
  };
  db.customers.push(customer);
  return customer;
}

function updateShipmentStatus(db, shipmentId, status, message) {
  const shipment = findShipment(db, shipmentId);
  shipment.status = status;
  shipment.progress = progressForStatus(status, shipment.progress);
  shipment.checkpoints.push({
    label: message || `Status changed to ${status}`,
    time: timestamp()
  });

  if (status === "Delivered") {
    const invoice = db.invoices.find((item) => item.shipmentId === shipment.id);
    if (invoice) invoice.status = "Ready";
  }

  return shipment;
}

function capturePod(db, body) {
  const shipment = updateShipmentStatus(db, body.shipmentId, "Delivered", "Proof of delivery captured");
  const pod = {
    id: nextId(db.pods, "POD-2605"),
    shipmentId: shipment.id,
    receiverName: body.receiverName || "Receiver",
    notes: body.notes || "Delivered in good condition",
    capturedAt: new Date().toISOString()
  };
  db.pods.unshift(pod);
  createNotification(db, {
    shipmentId: shipment.id,
    customerId: shipment.customerId,
    channel: "Email",
    message: `${shipment.id} delivered. POD captured by ${pod.receiverName}.`
  });
  return pod;
}

function captureIncident(db, body) {
  const shipment = findShipment(db, body.shipmentId);
  shipment.status = "Delayed";
  shipment.progress = Math.max(shipment.progress, 65);
  shipment.checkpoints.push({
    label: `Incident reported: ${body.issue || "Operational issue"}`,
    time: timestamp()
  });

  const incident = {
    id: nextId(db.incidents, "INC-2605"),
    shipmentId: shipment.id,
    issue: body.issue || "Operational issue",
    severity: body.severity || "Medium",
    status: "Open",
    createdAt: new Date().toISOString()
  };
  db.incidents.unshift(incident);
  createNotification(db, {
    shipmentId: shipment.id,
    customerId: shipment.customerId,
    channel: "WhatsApp",
    message: `${shipment.id} has an exception. Dispatch team is reviewing the ETA.`
  });
  return incident;
}

function createNotification(db, body) {
  const shipment = db.shipments.find((item) => item.id === body.shipmentId);
  const notification = {
    id: nextId(db.notifications, "NTF-2605"),
    shipmentId: body.shipmentId,
    customerId: body.customerId || shipment?.customerId,
    channel: body.channel || "Email",
    message: body.message || `${body.shipmentId} status update sent.`,
    status: "Queued",
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notification);
  return notification;
}

function buildCustomerPortal(db, customerId) {
  const customer = db.customers.find((item) => item.id === customerId) || db.customers[0];
  if (!customer) return null;
  const shipments = db.shipments.filter((shipment) => shipment.customerId === customer.id);
  const invoices = db.invoices.filter((invoice) => invoice.customerId === customer.id);
  const notifications = db.notifications.filter((notification) => notification.customerId === customer.id);
  return {
    customer,
    shipments,
    invoices,
    notifications,
    summary: {
      activeShipments: shipments.filter((shipment) => shipment.status !== "Delivered").length,
      deliveredShipments: shipments.filter((shipment) => shipment.status === "Delivered").length,
      invoiceTotal: invoices.reduce((sum, invoice) => sum + invoice.total, 0)
    }
  };
}

function enrichShipmentRoute(shipment, db) {
  const vehicle = db.vehicles.find((item) => item.id === shipment.vehicleId);
  const route = shipment.route?.available ? shipment.route : estimateRoute({
    origin: shipment.origin,
    destination: shipment.destination,
    priority: shipment.priority,
    weightKg: shipment.weightKg,
    vehicleType: vehicle?.type,
    departureAt: shipment.createdAt || new Date().toISOString()
  });

  return {
    ...shipment,
    distanceKm: shipment.distanceKm || route.distanceKm,
    route
  };
}

function buildAlerts(db) {
  const delayedAlerts = db.shipments
    .filter((shipment) => isDelayed(shipment))
    .map((shipment) => ({
      title: shipment.id,
      label: "Delayed",
      level: "delayed",
      copy: `${shipment.origin} to ${shipment.destination} for ${shipment.customer} needs revised ETA.`
    }));

  const criticalAlerts = db.shipments
    .filter((shipment) => shipment.priority === "Critical" && shipment.status !== "Delivered")
    .map((shipment) => ({
      title: shipment.customer,
      label: "Critical",
      level: "delayed",
      copy: `${shipment.id} is marked critical with ETA ${formatEta(shipment.eta)}.`
    }));

  const maintenanceAlerts = db.vehicles
    .filter((vehicle) => vehicle.status === "Maintenance")
    .map((vehicle) => ({
      title: vehicle.id,
      label: "Fleet",
      level: "booked",
      copy: `${vehicle.type} is unavailable at ${vehicle.location}.`
    }));

  return [...delayedAlerts, ...criticalAlerts, ...maintenanceAlerts].slice(0, 8);
}

function buildKpis(db) {
  const active = db.shipments.filter((shipment) => shipment.status !== "Delivered");
  const delayed = db.shipments.filter(isDelayed);
  const highPriority = active.filter((shipment) => shipment.priority !== "Normal");
  const onlineVehicles = db.vehicles.filter((vehicle) => vehicle.status !== "Maintenance");
  const utilization = average(db.vehicles.map((vehicle) => vehicle.utilization));
  const completed = db.shipments.filter((shipment) => shipment.status === "Delivered");
  const onTimeRate = db.shipments.length ? Math.round(((db.shipments.length - delayed.length) / db.shipments.length) * 100) : 0;

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

async function handleDispatchPlan(request, response) {
  loadEnvFile(path.join(__dirname, ".env"));

  if (!process.env.MISTRAL_API_KEY) {
    sendJson(response, 500, {
      error: "MISTRAL_API_KEY is not set. Add it to .env or set it in your terminal before starting the server."
    });
    return;
  }

  const payload = await readJsonBody(request);
  const prompt = buildPrompt(payload);

  const mistralResponse = await fetch(MISTRAL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getMistralModel(),
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: [
            "You are a logistics operations assistant.",
            "Use only the supplied operational data.",
            "Give concise dispatcher actions, risks, customer updates, and next checks.",
            "Do not invent live GPS, traffic, weather, prices, or facts that are not in the payload."
          ].join(" ")
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await mistralResponse.json().catch(() => ({}));

  if (!mistralResponse.ok) {
    sendJson(response, mistralResponse.status, {
      error: data.message || data.error?.message || "Mistral API request failed."
    });
    return;
  }

  sendJson(response, 200, {
    model: data.model || getMistralModel(),
    answer: normalizeMistralContent(data.choices?.[0]?.message?.content)
  });
}

function buildPrompt(payload) {
  const safePayload = {
    dispatcherPrompt: String(payload.prompt || "").slice(0, 1200),
    selectedShipmentId: payload.selectedShipmentId,
    shipments: limitArray(payload.shipments, 25).map((shipment) => ({
      id: shipment.id,
      customer: shipment.customer,
      lane: `${shipment.origin} to ${shipment.destination}`,
      status: shipment.status,
      priority: shipment.priority,
      eta: shipment.eta,
      vehicleId: shipment.vehicleId,
      weightKg: shipment.weightKg,
      revenue: shipment.revenue,
      progress: shipment.progress,
      distanceKm: shipment.distanceKm,
      recentCheckpoint: shipment.checkpoints?.at?.(-1)?.label || ""
    })),
    vehicles: limitArray(payload.vehicles, 25),
    alerts: limitArray(payload.alerts, 10),
    ml: payload.ml || null
  };

  return [
    "Create a dispatch plan from this logistics data.",
    "Format with short sections: Priority Actions, Customer Updates, Fleet Moves, ML Signals, Risks.",
    JSON.stringify(safePayload, null, 2)
  ].join("\n\n");
}

function getMistralModel() {
  return process.env.MISTRAL_MODEL || DEFAULT_MISTRAL_MODEL;
}

function normalizeMistralContent(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || "").filter(Boolean).join("\n").trim();
  }
  return "";
}

function findShipment(db, shipmentId) {
  const shipment = db.shipments.find((item) => item.id === shipmentId);
  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} was not found.`);
  }
  return shipment;
}

function nextId(items, prefix) {
  const max = items.reduce((highest, item) => {
    const number = Number(String(item.id || "").split("-").at(-1));
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function progressForStatus(status, currentProgress) {
  const progressMap = {
    Booked: 8,
    Dispatched: 25,
    "In Transit": Math.max(55, currentProgress),
    Delayed: Math.max(65, currentProgress),
    Delivered: 100
  };
  return progressMap[status] ?? currentProgress;
}

function isDelayed(shipment) {
  return shipment.status === "Delayed" || (shipment.status !== "Delivered" && new Date(shipment.eta).getTime() < Date.now());
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatEta(value) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function timestamp() {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function limitArray(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 500_000) {
      throw new Error("Request body is too large.");
    }
  }

  return body ? JSON.parse(body) : {};
}

async function serveStatic(request, response, url) {
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  const firstSegment = relativePath.split(path.sep)[0];

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  if (
    path.basename(filePath).startsWith(".") ||
    ["server.js", "package.json"].includes(path.basename(filePath)) ||
    ["data", "scripts", "services"].includes(firstSegment)
  ) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    throw error;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;
  const lines = fsSync.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
