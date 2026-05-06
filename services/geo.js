const CITY_COORDS = {
  Ahmedabad: { lat: 23.0225, lng: 72.5714, region: "West" },
  Bengaluru: { lat: 12.9716, lng: 77.5946, region: "South" },
  Bhopal: { lat: 23.2599, lng: 77.4126, region: "Central" },
  Chennai: { lat: 13.0827, lng: 80.2707, region: "South" },
  Coimbatore: { lat: 11.0168, lng: 76.9558, region: "South" },
  Delhi: { lat: 28.6139, lng: 77.209, region: "North" },
  Goa: { lat: 15.2993, lng: 74.124, region: "West" },
  Gurugram: { lat: 28.4595, lng: 77.0266, region: "North" },
  Hyderabad: { lat: 17.385, lng: 78.4867, region: "South" },
  Indore: { lat: 22.7196, lng: 75.8577, region: "Central" },
  Jaipur: { lat: 26.9124, lng: 75.7873, region: "North" },
  Kochi: { lat: 9.9312, lng: 76.2673, region: "South" },
  Kolkata: { lat: 22.5726, lng: 88.3639, region: "East" },
  Lucknow: { lat: 26.8467, lng: 80.9462, region: "North" },
  Mumbai: { lat: 19.076, lng: 72.8777, region: "West" },
  Nagpur: { lat: 21.1458, lng: 79.0882, region: "Central" },
  Nashik: { lat: 19.9975, lng: 73.7898, region: "West" },
  Noida: { lat: 28.5355, lng: 77.391, region: "North" },
  Pune: { lat: 18.5204, lng: 73.8567, region: "West" },
  Surat: { lat: 21.1702, lng: 72.8311, region: "West" },
  Vadodara: { lat: 22.3072, lng: 73.1812, region: "West" }
};

const VEHICLE_SPEED_KPH = {
  "Reefer truck": 44,
  "32 ft container": 48,
  "20 ft container": 52,
  "Open body": 46,
  "Mini truck": 38
};

function geocodeCity(city) {
  const normalized = normalizeCity(city);
  return CITY_COORDS[normalized] ? { city: normalized, ...CITY_COORDS[normalized] } : null;
}

function listCities() {
  return Object.keys(CITY_COORDS);
}

function estimateRoute(input) {
  const origin = geocodeCity(input.origin);
  const destination = geocodeCity(input.destination);
  const stops = Array.isArray(input.stops) ? input.stops.map(geocodeCity).filter(Boolean) : [];

  if (!origin || !destination) {
    return {
      available: false,
      message: "Route estimate needs known origin and destination cities.",
      distanceKm: 0,
      durationHours: 0
    };
  }

  const sequence = [origin, ...stops, destination];
  const distanceKm = Math.round(totalRouteDistance(sequence) * 1.18);
  const vehicleType = input.vehicleType || "32 ft container";
  const trafficIndex = getTrafficIndex(input.departureAt || new Date().toISOString(), origin, destination);
  const speedKph = VEHICLE_SPEED_KPH[vehicleType] || 46;
  const priorityFactor = input.priority === "Critical" ? 0.92 : input.priority === "High" ? 0.96 : 1;
  const loadingHours = Math.min(7, Math.max(1.4, Number(input.weightKg || 5000) / 2600));
  const durationHours = round1((distanceKm / speedKph) * trafficIndex * priorityFactor + loadingHours);
  const eta = addHours(input.departureAt || new Date().toISOString(), durationHours);

  return {
    available: true,
    origin,
    destination,
    stops,
    distanceKm,
    durationHours,
    eta,
    trafficIndex: round2(trafficIndex),
    vehicleType,
    routeSequence: sequence.map((point) => point.city)
  };
}

function optimizeStops(originCity, stops) {
  const origin = geocodeCity(originCity);
  const remaining = stops.map(geocodeCity).filter(Boolean);
  const ordered = [];
  let current = origin;

  if (!origin) {
    return { orderedStops: stops, distanceKm: 0 };
  }

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    remaining.forEach((candidate, index) => {
      const candidateDistance = haversineKm(current, candidate);
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestIndex = index;
      }
    });

    current = remaining.splice(bestIndex, 1)[0];
    ordered.push(current);
  }

  return {
    orderedStops: ordered.map((stop) => stop.city),
    distanceKm: Math.round(totalRouteDistance([origin, ...ordered]) * 1.18)
  };
}

function routeDistanceKm(origin, destination) {
  const start = geocodeCity(origin);
  const end = geocodeCity(destination);
  if (!start || !end) return 0;
  return Math.round(haversineKm(start, end) * 1.18);
}

function getTrafficIndex(isoDate, origin, destination) {
  const date = new Date(isoDate);
  const hour = date.getHours();
  const month = date.getMonth() + 1;
  const peakHour = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21) ? 0.18 : 0;
  const nightRelief = hour >= 23 || hour <= 5 ? -0.12 : 0;
  const monsoon = month >= 6 && month <= 9 ? 0.12 : 0;
  const crossRegion = origin.region !== destination.region ? 0.06 : 0;
  return Math.max(0.78, 1 + peakHour + nightRelief + monsoon + crossRegion);
}

function normalizeCity(city) {
  const value = String(city || "").trim().toLowerCase();
  return Object.keys(CITY_COORDS).find((name) => name.toLowerCase() === value) || String(city || "").trim();
}

function totalRouteDistance(points) {
  return points.reduce((sum, point, index) => {
    if (index === 0) return 0;
    return sum + haversineKm(points[index - 1], point);
  }, 0);
}

function haversineKm(a, b) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(hav));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function addHours(isoDate, hours) {
  const date = new Date(isoDate);
  date.setMinutes(date.getMinutes() + Math.round(hours * 60));
  return date.toISOString().slice(0, 16);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  CITY_COORDS,
  geocodeCity,
  listCities,
  estimateRoute,
  optimizeStops,
  routeDistanceKm
};
