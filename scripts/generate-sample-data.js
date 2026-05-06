const fs = require("node:fs");
const path = require("node:path");
const { listCities, estimateRoute, routeDistanceKm } = require("../services/geo");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "logixops.db.json");
const SEED_DB_PATH = path.join(DATA_DIR, "logixops.seed.json");
const SAMPLE_PATH = path.join(DATA_DIR, "ml-sample-orders.jsonl");

const rng = mulberry32(260505);
const cities = listCities();
const customers = [
  "FreshCart Foods",
  "Northstar Pharma",
  "UrbanBuild Supply",
  "MetroStyle Retail",
  "Coastal Electronics",
  "BluePeak Auto",
  "QuickBasket",
  "Zenith Healthcare",
  "Prism Textiles",
  "Harbor Appliances"
];
const categories = ["Grocery", "Pharma", "Construction", "Apparel", "Electronics", "Auto Parts", "Home Goods"];
const vehicleTypes = ["32 ft container", "Reefer truck", "20 ft container", "Open body", "Mini truck"];
const priorities = ["Normal", "Normal", "Normal", "High", "High", "Critical"];

fs.mkdirSync(DATA_DIR, { recursive: true });

const records = generateTrainingRecords(12000);
const database = createDatabase();
fs.writeFileSync(SAMPLE_PATH, records.map((record) => JSON.stringify(record)).join("\n"), "utf8");
fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf8");
fs.writeFileSync(SEED_DB_PATH, JSON.stringify(database, null, 2), "utf8");

console.log(`Generated ${records.length} ML training orders at ${SAMPLE_PATH}`);
console.log(`Seeded database at ${DB_PATH}`);

function createDatabase() {
  const now = new Date("2026-05-05T16:00:00.000Z");
  const vehicles = [
    vehicle("MH12-LX-9041", "32 ft container", "Aarav Patel", 16000, 82, "Mumbai Hub", "In Transit"),
    vehicle("KA03-LX-1882", "Reefer truck", "Meera Rao", 9000, 64, "Bengaluru DC", "Available"),
    vehicle("DL01-LX-7710", "20 ft container", "Kabir Khan", 11000, 91, "Delhi Hub", "In Transit"),
    vehicle("TN09-LX-5528", "Open body", "Nila Suresh", 7500, 38, "Chennai Yard", "Maintenance"),
    vehicle("GJ05-LX-4409", "Mini truck", "Rohan Shah", 4200, 52, "Ahmedabad Hub", "Available")
  ];

  const seededShipments = [
    shipment("SHP-2605-001", "CUST-001", "FreshCart Foods", "Mumbai", "Pune", "In Transit", "High", "MH12-LX-9041", 12400, 48500, 58, now, -7),
    shipment("SHP-2605-002", "CUST-002", "Northstar Pharma", "Bengaluru", "Hyderabad", "Dispatched", "Critical", "KA03-LX-1882", 4200, 72000, 24, now, -5),
    shipment("SHP-2605-003", "CUST-003", "UrbanBuild Supply", "Delhi", "Jaipur", "Delayed", "High", "DL01-LX-7710", 9800, 39100, 71, now, -11),
    shipment("SHP-2605-004", "CUST-004", "MetroStyle Retail", "Chennai", "Coimbatore", "Booked", "Normal", "TN09-LX-5528", 6100, 27600, 8, now, -2),
    shipment("SHP-2605-005", "CUST-005", "Coastal Electronics", "Ahmedabad", "Surat", "Delivered", "Normal", "GJ05-LX-4409", 3000, 18800, 100, now, -30),
    shipment("SHP-2605-006", "CUST-006", "BluePeak Auto", "Nagpur", "Indore", "Booked", "High", "KA03-LX-1882", 7600, 33800, 12, now, -1),
    shipment("SHP-2605-007", "CUST-007", "QuickBasket", "Kolkata", "Lucknow", "In Transit", "Normal", "DL01-LX-7710", 5400, 41200, 46, now, -8)
  ];

  return {
    meta: {
      version: 2,
      seededAt: new Date().toISOString(),
      storage: "json-file-database"
    },
    customers: customers.slice(0, 7).map((name, index) => ({
      id: `CUST-${String(index + 1).padStart(3, "0")}`,
      companyName: name,
      contactName: ["Isha", "Dev", "Riya", "Samar", "Anika", "Yash", "Tara"][index],
      email: `ops${index + 1}@example.com`,
      phone: `+91-90000-10${String(index + 1).padStart(2, "0")}`,
      tier: index < 2 ? "Enterprise" : "Standard"
    })),
    vehicles,
    shipments: seededShipments,
    warehouses: [
      warehouse("WH-MUM", "Mumbai Fulfillment Hub", "Mumbai", 82),
      warehouse("WH-BLR", "Bengaluru Cold Chain DC", "Bengaluru", 76),
      warehouse("WH-DEL", "Delhi North Hub", "Delhi", 88),
      warehouse("WH-CHE", "Chennai South Yard", "Chennai", 61)
    ],
    inventory: createInventory(),
    invoices: seededShipments.map((item, index) => ({
      id: `INV-2605-${String(index + 1).padStart(3, "0")}`,
      shipmentId: item.id,
      customerId: item.customerId,
      subtotal: Math.round(item.revenue * 0.92),
      tax: Math.round(item.revenue * 0.08),
      total: item.revenue,
      status: item.status === "Delivered" ? "Ready" : "Draft",
      dueAt: addDays(now, 14 + index).toISOString().slice(0, 10)
    })),
    notifications: seededShipments.slice(0, 5).map((item, index) => ({
      id: `NTF-2605-${String(index + 1).padStart(3, "0")}`,
      shipmentId: item.id,
      customerId: item.customerId,
      channel: index % 2 === 0 ? "WhatsApp" : "Email",
      message: `${item.id} is ${item.status} on ${item.origin} to ${item.destination}.`,
      status: "Queued",
      createdAt: addHours(now, -index).toISOString()
    })),
    projects: [
      project("PRJ-101", "Complay Build ERP", "Complay Build Services", "Web App", 72, "In Progress", "2026-06-20"),
      project("PRJ-102", "Field Worker Mobile App", "Complay Build Services", "Mobile App", 46, "In Progress", "2026-07-05"),
      project("PRJ-103", "Client Marketing Website", "Arden Infra", "Website", 90, "UAT", "2026-05-30")
    ],
    teamSchedules: [
      schedule("SCH-201", "EMP-11", "Rohan Mehta", "Frontend Engineer", "PRJ-101", "On-site", "Complay Build HQ, Pune", "2026-05-08", "Scheduled"),
      schedule("SCH-202", "EMP-18", "Aisha Khan", "Backend Engineer", "PRJ-101", "Remote", "Bengaluru", "2026-05-09", "Scheduled"),
      schedule("SCH-203", "EMP-24", "Neel Joshi", "Project Manager", "PRJ-102", "Client Visit", "Complay Build Site Office, Mumbai", "2026-05-10", "Confirmed")
    ],
    travelTickets: [
      ticket("TRV-301", "PRJ-101", "Rohan Mehta", "Flight", "6E-78421", "Bengaluru", "Pune", "2026-05-08 07:15", "Booked"),
      ticket("TRV-302", "PRJ-102", "Neel Joshi", "Train", "PNR-8827741105", "Delhi", "Mumbai", "2026-05-09 21:10", "Cancelled", "Client asked to move site visit to next week"),
      ticket("TRV-303", "PRJ-103", "Ananya Das", "Flight", "AI-90317", "Kolkata", "Ahmedabad", "2026-05-11 06:45", "Rescheduled")
    ],
    incidents: [],
    pods: []
  };
}

function generateTrainingRecords(count) {
  const start = new Date("2024-01-01T00:00:00.000Z");
  const records = [];

  for (let index = 0; index < count; index += 1) {
    const origin = pick(cities);
    let destination = pick(cities);
    while (destination === origin) {
      destination = pick(cities);
    }

    const createdAt = new Date(start.getTime() + Math.floor(rng() * 485) * 86400000 + Math.floor(rng() * 24) * 3600000);
    const priority = pick(priorities);
    const vehicleType = pick(vehicleTypes);
    const category = pick(categories);
    const weightKg = Math.round(200 + rng() * 15800);
    const volumeCbm = Math.round((weightKg / (260 + rng() * 240)) * 10) / 10;
    const route = estimateRoute({ origin, destination, priority, vehicleType, weightKg, departureAt: createdAt.toISOString() });
    const distanceKm = route.distanceKm || routeDistanceKm(origin, destination);
    const warehouseDwellHours = Math.round((1 + rng() * 5 + (category === "Pharma" ? 1.2 : 0)) * 10) / 10;
    const isFraud = rng() < 0.018;
    const serviceFactor = priority === "Critical" ? 0.82 : priority === "High" ? 0.92 : 1;
    const vehicleFactor = vehicleType === "Mini truck" ? 1.18 : vehicleType === "Reefer truck" ? 1.08 : 1;
    const noise = (rng() - 0.5) * 5.5;
    const actualDeliveryHours = Math.max(
      2,
      Math.round(((distanceKm / 43) * route.trafficIndex * vehicleFactor * serviceFactor + warehouseDwellHours + noise) * 10) / 10
    );
    const promisedHours = Math.round((route.durationHours * 1.08 + (priority === "Normal" ? 4 : 1.5)) * 10) / 10;
    let revenue = Math.round(distanceKm * (62 + rng() * 35) + weightKg * (1.6 + rng() * 1.2) + (priority === "Critical" ? 9000 : 0));
    if (isFraud) {
      revenue = Math.round(revenue * (rng() < 0.5 ? 0.38 : 2.4));
    }

    records.push({
      id: `ORD-SAMPLE-${String(index + 1).padStart(5, "0")}`,
      createdAt: createdAt.toISOString(),
      origin,
      destination,
      distanceKm,
      priority,
      vehicleType,
      category,
      weightKg,
      volumeCbm,
      trafficIndex: route.trafficIndex,
      warehouseDwellHours,
      departureHour: createdAt.getHours(),
      dayOfWeek: createdAt.getDay(),
      month: createdAt.getMonth() + 1,
      promisedHours,
      actualDeliveryHours,
      delayed: actualDeliveryHours > promisedHours,
      revenue,
      isFraud
    });
  }

  return records;
}

function createInventory() {
  return categories.flatMap((category, categoryIndex) => {
    return ["WH-MUM", "WH-BLR", "WH-DEL", "WH-CHE"].map((warehouseId, warehouseIndex) => ({
      id: `INVITEM-${categoryIndex + 1}-${warehouseIndex + 1}`,
      sku: `${category.slice(0, 3).toUpperCase()}-${warehouseIndex + 10}${categoryIndex}`,
      category,
      warehouseId,
      name: `${category} stock`,
      quantityAvailable: Math.round(80 + rng() * 720),
      quantityReserved: Math.round(20 + rng() * 180),
      binLocation: `${String.fromCharCode(65 + warehouseIndex)}-${categoryIndex + 3}-${Math.ceil(rng() * 18)}`
    }));
  });
}

function vehicle(id, type, driver, capacityKg, utilization, location, status) {
  return { id, type, driver, capacityKg, utilization, location, status };
}

function warehouse(id, name, city, utilization) {
  return { id, name, city, utilization, status: utilization > 85 ? "Congested" : "Open" };
}

function project(id, name, client, serviceType, completion, status, deadline) {
  return { id, name, client, serviceType, completion, status, deadline };
}

function schedule(id, memberId, memberName, role, projectId, assignmentType, location, date, status) {
  return { id, memberId, memberName, role, projectId, assignmentType, location, date, status };
}

function ticket(id, projectId, memberName, mode, ticketNo, from, to, departureAt, status, cancellationReason = "") {
  return { id, projectId, memberName, mode, ticketNo, from, to, departureAt, status, cancellationReason };
}

function shipment(id, customerId, customer, origin, destination, status, priority, vehicleId, weightKg, revenue, progress, now, createdOffsetHours) {
  const createdAt = addHours(now, createdOffsetHours).toISOString();
  const route = estimateRoute({ origin, destination, priority, weightKg, departureAt: createdAt });
  return {
    id,
    customerId,
    customer,
    origin,
    destination,
    status,
    priority,
    eta: route.eta,
    vehicleId,
    weightKg,
    volumeCbm: Math.round((weightKg / 340) * 10) / 10,
    revenue,
    progress,
    distanceKm: route.distanceKm,
    route,
    createdAt,
    checkpoints: [
      { label: `Booked ${origin} to ${destination}`, time: createdAt.slice(0, 16).replace("T", " ") },
      { label: status === "Booked" ? "Awaiting dispatch" : `Status: ${status}`, time: addHours(now, createdOffsetHours + 1).toISOString().slice(0, 16).replace("T", " ") }
    ]
  };
}

function pick(values) {
  return values[Math.floor(rng() * values.length)];
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + Math.round(hours * 60));
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mulberry32(seed) {
  return function next() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
