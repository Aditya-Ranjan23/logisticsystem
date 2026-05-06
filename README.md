# LogixOps

A browser-based logistics control tower MVP for planning, tracking, and managing shipments, vehicles, exceptions, operational KPIs, and optional AI-assisted dispatch planning with Mistral.

## What is included

- Shipment load board with search, status filters, ETA visibility, and status updates
- Route detail panel with shipment progress, driver, weight, revenue, and tracking timeline
- Fleet availability view with utilization and maintenance state
- Exception queue for delays, critical loads, and unavailable assets
- New shipment workflow with local browser persistence
- CSV export and reset sample data controls
- Mistral AI dispatch copilot through a local Node proxy
- JSON file-backed database for shipments, vehicles, customers, invoices, notifications, PODs, and incidents
- Offline geocoding, distance, ETA, and route optimization engine for Indian city lanes
- Driver workflow for pickup, proof of delivery, and incident reporting
- Billing, customer portal, and notification queues
- ML model trained on generated sample orders for delivery-time prediction, demand prediction, anomaly detection, route planning, and warehouse recommendations
- Requirements and data model docs for the backend build-out

## Run it

Prepare the database, generated ML sample data, and trained model:

```powershell
npm run prepare:data
```

Start the app:

```powershell
npm start
```

Then open `http://localhost:3000`.

For Mistral AI integration, run the local server so the API key stays outside the browser:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and add your Mistral key.

You can also set the key from PowerShell instead of `.env`:

```powershell
$env:MISTRAL_API_KEY="your_api_key_here"
$env:MISTRAL_MODEL="mistral-small-latest"
npm start
```

## Project structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- server.js
|-- package.json
|-- data
|   |-- logixops.db.json
|   |-- logixops.seed.json
|   |-- ml-model.json
|   `-- ml-sample-orders.jsonl
|-- scripts
|   |-- generate-sample-data.js
|   `-- train-ml-model.js
|-- services
|   |-- geo.js
|   `-- ml.js
|-- docs
|   |-- requirements.md
|   |-- data-model.md
|   `-- ml-system.md
```

## Recommended next build steps

1. Replace the JSON file database with PostgreSQL or SQLite for concurrent users.
2. Connect a production map provider for live road geometry, traffic, tolls, and geocoding.
3. Add authentication, roles, branch-level permissions, and audit logs.
4. Replace synthetic ML data with real order/trip/scan/GPS history.
5. Add SMS, WhatsApp, email, accounting, and ERP integrations.
