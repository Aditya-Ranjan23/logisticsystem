const fs = require("node:fs/promises");
const path = require("node:path");
const { estimateRoute, optimizeStops } = require("./geo");

const DEFAULT_MODEL = {
  version: "untrained",
  trainedAt: null,
  recordCount: 0,
  features: ["distanceKm", "weightTons", "volumeCbm", "priorityScore", "trafficIndex", "warehouseDwellHours", "departureHour"],
  means: [1, 1, 1, 1, 1, 1, 1],
  stds: [1, 1, 1, 1, 1, 1, 1],
  coefficients: [8, 0.08, 1.1, 0.1, -0.4, 7, 0.8, 0.03],
  metrics: { maeHours: null, rmseHours: null },
  demand: { lanes: [], cities: [], byDayOfWeek: [] },
  anomaly: {
    revenuePerKm: { mean: 120, std: 35 },
    delayRatio: { mean: 1, std: 0.25 },
    weightDistanceRatio: { mean: 18, std: 8 }
  },
  warehouse: { categoryVelocity: [] }
};

function buildFeatures(record) {
  return [
    Number(record.distanceKm || 0),
    Number(record.weightKg || 0) / 1000,
    Number(record.volumeCbm || 0),
    priorityScore(record.priority),
    Number(record.trafficIndex || 1),
    Number(record.warehouseDwellHours || 2),
    Number(record.departureHour ?? new Date(record.createdAt || Date.now()).getHours())
  ];
}

function predictDeliveryHours(model, shipment, route) {
  const safeModel = model || DEFAULT_MODEL;
  const featureRecord = {
    distanceKm: route?.distanceKm || shipment.distanceKm || 0,
    weightKg: shipment.weightKg,
    volumeCbm: shipment.volumeCbm || Math.max(1, Number(shipment.weightKg || 1000) / 350),
    priority: shipment.priority,
    trafficIndex: route?.trafficIndex || 1,
    warehouseDwellHours: shipment.warehouseDwellHours || Math.min(7, Math.max(1.5, Number(shipment.weightKg || 5000) / 2800)),
    departureHour: new Date(shipment.createdAt || Date.now()).getHours()
  };
  const features = buildFeatures(featureRecord);
  const normalized = features.map((value, index) => (value - safeModel.means[index]) / safeModel.stds[index]);
  const prediction = safeModel.coefficients[0] + normalized.reduce((sum, value, index) => {
    return sum + value * safeModel.coefficients[index + 1];
  }, 0);
  return Math.max(1, Math.round(prediction * 10) / 10);
}

async function loadModel(modelPath) {
  try {
    return JSON.parse(await fs.readFile(modelPath, "utf8"));
  } catch {
    return DEFAULT_MODEL;
  }
}

async function getMlInsights(db, modelPath) {
  const model = await loadModel(modelPath);
  const activeShipments = db.shipments.filter((shipment) => shipment.status !== "Delivered");
  const predictions = activeShipments.slice(0, 6).map((shipment) => predictShipment(model, shipment, db));
  const anomalies = detectAnomalies(db.shipments, model).slice(0, 6);
  const demandForecast = buildDemandForecast(model);
  const warehouseSuggestions = buildWarehouseSuggestions(db, model);
  const routePlans = buildRoutePlans(activeShipments, db.vehicles);

  return {
    model: {
      version: model.version,
      trainedAt: model.trainedAt,
      recordCount: model.recordCount,
      metrics: model.metrics
    },
    predictions,
    demandForecast,
    anomalies,
    warehouseSuggestions,
    routePlans
  };
}

async function predictShipmentFromDb(db, modelPath, shipmentId) {
  const model = await loadModel(modelPath);
  const shipment = db.shipments.find((item) => item.id === shipmentId) || db.shipments[0];
  if (!shipment) {
    return null;
  }

  return predictShipment(model, shipment, db);
}

function predictShipment(model, shipment, db) {
  const vehicle = db.vehicles.find((item) => item.id === shipment.vehicleId);
  const route = estimateRoute({
    origin: shipment.origin,
    destination: shipment.destination,
    priority: shipment.priority,
    weightKg: shipment.weightKg,
    vehicleType: vehicle?.type,
    departureAt: shipment.createdAt || new Date().toISOString()
  });
  const predictedHours = predictDeliveryHours(model, shipment, route);
  const mlEta = addHours(shipment.createdAt || new Date().toISOString(), predictedHours);
  const routeSequence = optimizeStops(shipment.origin, [shipment.destination]);

  return {
    shipmentId: shipment.id,
    lane: `${shipment.origin} to ${shipment.destination}`,
    predictedDeliveryHours: predictedHours,
    routeEta: route.eta,
    mlEta,
    distanceKm: route.distanceKm,
    trafficIndex: route.trafficIndex,
    recommendedRoute: route.routeSequence,
    optimizedStops: routeSequence.orderedStops,
    confidence: confidenceFromModel(model, route.distanceKm)
  };
}

function detectAnomalies(shipments, model) {
  return shipments
    .map((shipment) => {
      const distanceKm = shipment.route?.distanceKm || shipment.distanceKm || 1;
      const revenuePerKm = Number(shipment.revenue || 0) / distanceKm;
      const delayRatio = shipment.status === "Delayed" ? 1.45 : shipment.status === "Delivered" ? 0.92 : 1.05;
      const weightDistanceRatio = Number(shipment.weightKg || 0) / distanceKm;
      const score =
        zScore(revenuePerKm, model.anomaly.revenuePerKm) * 0.42 +
        zScore(delayRatio, model.anomaly.delayRatio) * 0.35 +
        zScore(weightDistanceRatio, model.anomaly.weightDistanceRatio) * 0.23;
      return {
        shipmentId: shipment.id,
        customer: shipment.customer,
        lane: `${shipment.origin} to ${shipment.destination}`,
        score: Math.round(score * 100) / 100,
        reason: anomalyReason(revenuePerKm, delayRatio, weightDistanceRatio, model)
      };
    })
    .filter((item) => item.score > 1.15)
    .sort((a, b) => b.score - a.score);
}

function buildDemandForecast(model) {
  const topLanes = model.demand.lanes.slice(0, 5);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return weekdays.map((day, index) => {
    const seasonality = model.demand.byDayOfWeek[index]?.avgOrders || 80;
    const topLane = topLanes[index % Math.max(1, topLanes.length)];
    return {
      day,
      expectedOrders: Math.round(seasonality),
      hotLane: topLane?.lane || "Mumbai to Pune",
      recommendedVehicles: Math.max(2, Math.ceil(seasonality / 18))
    };
  });
}

function buildWarehouseSuggestions(db, model) {
  return db.inventory.slice(0, 8).map((item) => {
    const velocity = model.warehouse.categoryVelocity.find((category) => category.category === item.category)?.dailyOrders || 12;
    const availableDays = item.quantityAvailable / Math.max(1, velocity);
    const reorderQty = availableDays < 5 ? Math.ceil(velocity * 10 - item.quantityAvailable) : 0;
    return {
      sku: item.sku,
      warehouseId: item.warehouseId,
      category: item.category,
      availableDays: Math.round(availableDays * 10) / 10,
      reorderQty,
      slotting: velocity > 22 ? "Move to fast-pick zone" : "Keep standard bin"
    };
  });
}

function buildRoutePlans(activeShipments, vehicles) {
  return vehicles.slice(0, 4).map((vehicle) => {
    const assigned = activeShipments.filter((shipment) => shipment.vehicleId === vehicle.id);
    const origin = vehicle.location?.replace(" Hub", "").replace(" DC", "").replace(" Yard", "") || assigned[0]?.origin || "Mumbai";
    const stops = assigned.map((shipment) => shipment.destination);
    const optimized = optimizeStops(origin, stops);
    return {
      vehicleId: vehicle.id,
      driver: vehicle.driver,
      stops: optimized.orderedStops,
      estimatedKm: optimized.distanceKm,
      loadCount: assigned.length
    };
  });
}

function priorityScore(priority) {
  return { Critical: 3, High: 2, Normal: 1 }[priority] || 1;
}

function confidenceFromModel(model, distanceKm) {
  const hasTraining = model.recordCount > 1000;
  const distancePenalty = distanceKm > 1800 ? 0.08 : distanceKm < 80 ? 0.04 : 0;
  return Math.round((hasTraining ? 0.86 - distancePenalty : 0.58) * 100) / 100;
}

function zScore(value, stats) {
  return Math.abs((value - stats.mean) / Math.max(0.01, stats.std));
}

function anomalyReason(revenuePerKm, delayRatio, weightDistanceRatio, model) {
  const checks = [
    { label: "unusual revenue per km", score: zScore(revenuePerKm, model.anomaly.revenuePerKm) },
    { label: "delay risk spike", score: zScore(delayRatio, model.anomaly.delayRatio) },
    { label: "weight-distance mismatch", score: zScore(weightDistanceRatio, model.anomaly.weightDistanceRatio) }
  ].sort((a, b) => b.score - a.score);
  return checks[0].label;
}

function addHours(isoDate, hours) {
  const date = new Date(isoDate);
  date.setMinutes(date.getMinutes() + Math.round(hours * 60));
  return date.toISOString().slice(0, 16);
}

module.exports = {
  DEFAULT_MODEL,
  buildFeatures,
  predictDeliveryHours,
  loadModel,
  getMlInsights,
  predictShipmentFromDb
};
