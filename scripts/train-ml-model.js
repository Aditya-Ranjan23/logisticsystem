const fs = require("node:fs");
const path = require("node:path");
const { buildFeatures } = require("../services/ml");

const DATA_DIR = path.join(__dirname, "..", "data");
const SAMPLE_PATH = path.join(DATA_DIR, "ml-sample-orders.jsonl");
const MODEL_PATH = path.join(DATA_DIR, "ml-model.json");

if (!fs.existsSync(SAMPLE_PATH)) {
  throw new Error("Missing sample data. Run `npm run seed` first.");
}

const records = fs.readFileSync(SAMPLE_PATH, "utf8")
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const featureRows = records.map(buildFeatures);
const labels = records.map((record) => Number(record.actualDeliveryHours || 0));
const means = columns(featureRows).map(mean);
const stds = columns(featureRows).map((column) => Math.max(0.0001, std(column)));
const normalizedRows = featureRows.map((row) => [1, ...row.map((value, index) => (value - means[index]) / stds[index])]);
const coefficients = trainLinearRegression(normalizedRows, labels);
const predictions = normalizedRows.map((row) => dot(row, coefficients));
const metrics = {
  maeHours: round2(mean(predictions.map((prediction, index) => Math.abs(prediction - labels[index])))),
  rmseHours: round2(Math.sqrt(mean(predictions.map((prediction, index) => (prediction - labels[index]) ** 2))))
};

const model = {
  version: "synthetic-logistics-v1",
  trainedAt: new Date().toISOString(),
  recordCount: records.length,
  features: ["distanceKm", "weightTons", "volumeCbm", "priorityScore", "trafficIndex", "warehouseDwellHours", "departureHour"],
  means: means.map(round4),
  stds: stds.map(round4),
  coefficients: coefficients.map(round4),
  metrics,
  demand: buildDemandStats(records),
  anomaly: buildAnomalyStats(records),
  warehouse: buildWarehouseStats(records)
};

fs.writeFileSync(MODEL_PATH, JSON.stringify(model, null, 2), "utf8");
console.log(`Trained ML model with ${records.length} records at ${MODEL_PATH}`);
console.log(`MAE ${metrics.maeHours}h | RMSE ${metrics.rmseHours}h`);

function trainLinearRegression(rows, labels) {
  const coefficients = new Array(rows[0].length).fill(0);
  const learningRate = 0.035;
  const iterations = 950;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradients = new Array(coefficients.length).fill(0);

    rows.forEach((row, rowIndex) => {
      const error = dot(row, coefficients) - labels[rowIndex];
      row.forEach((value, featureIndex) => {
        gradients[featureIndex] += error * value;
      });
    });

    coefficients.forEach((_, index) => {
      coefficients[index] -= (learningRate * gradients[index]) / rows.length;
    });
  }

  return coefficients;
}

function buildDemandStats(records) {
  const laneCounts = new Map();
  const cityCounts = new Map();
  const dayCounts = Array.from({ length: 7 }, () => []);

  records.forEach((record) => {
    const lane = `${record.origin} to ${record.destination}`;
    laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
    cityCounts.set(record.destination, (cityCounts.get(record.destination) || 0) + 1);
    dayCounts[record.dayOfWeek].push(record);
  });

  return {
    lanes: [...laneCounts.entries()]
      .map(([lane, orders]) => ({ lane, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 20),
    cities: [...cityCounts.entries()]
      .map(([city, orders]) => ({ city, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 20),
    byDayOfWeek: dayCounts.map((items, dayOfWeek) => ({
      dayOfWeek,
      avgOrders: round2(items.length / Math.max(1, records.length / 485))
    }))
  };
}

function buildAnomalyStats(records) {
  const revenuePerKm = records.map((record) => record.revenue / Math.max(1, record.distanceKm));
  const delayRatio = records.map((record) => record.actualDeliveryHours / Math.max(1, record.promisedHours));
  const weightDistanceRatio = records.map((record) => record.weightKg / Math.max(1, record.distanceKm));

  return {
    revenuePerKm: statBlock(revenuePerKm),
    delayRatio: statBlock(delayRatio),
    weightDistanceRatio: statBlock(weightDistanceRatio)
  };
}

function buildWarehouseStats(records) {
  const categoryCounts = new Map();
  records.forEach((record) => {
    categoryCounts.set(record.category, (categoryCounts.get(record.category) || 0) + 1);
  });

  return {
    categoryVelocity: [...categoryCounts.entries()].map(([category, orders]) => ({
      category,
      dailyOrders: round2(orders / 485)
    })).sort((a, b) => b.dailyOrders - a.dailyOrders)
  };
}

function statBlock(values) {
  return {
    mean: round4(mean(values)),
    std: round4(std(values))
  };
}

function columns(rows) {
  return rows[0].map((_, columnIndex) => rows.map((row) => row[columnIndex]));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function dot(row, coefficients) {
  return row.reduce((sum, value, index) => sum + value * coefficients[index], 0);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}
