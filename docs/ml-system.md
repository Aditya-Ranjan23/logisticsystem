# ML System

## What is implemented

- Synthetic training data generator with 12,000 historical logistics orders.
- Delivery-time prediction model trained with linear regression.
- Demand prediction from lane, city, and day-of-week order patterns.
- Fraud/anomaly scoring using revenue-per-km, delay ratio, and weight-distance ratios.
- Route optimization using nearest-stop sequencing.
- Warehouse optimization using SKU category velocity and stock coverage.

## Commands

```powershell
npm run seed
npm run train
npm run prepare:data
```

## Files

- `data/ml-sample-orders.jsonl`: generated training orders.
- `data/ml-model.json`: trained model, metrics, demand stats, anomaly thresholds, and warehouse velocity.
- `services/ml.js`: runtime prediction and insights service.
- `services/geo.js`: city geocoding, route distance, ETA, and stop sequencing.

## Current model

The first model is intentionally dependency-free so it can run anywhere Node runs. It predicts delivery hours from:

- distance
- weight
- volume
- priority
- traffic index
- warehouse dwell time
- departure hour

The generated model currently trains on 12,000 synthetic orders and reports MAE/RMSE during `npm run train`.

## Production upgrade path

- Replace synthetic rows with real orders, GPS pings, checkpoint scans, proof-of-delivery timestamps, warehouse events, and billing adjustments.
- Add model validation by lane, customer, vehicle type, warehouse, and service level.
- Store predictions with feature snapshots so future delivery outcomes can retrain the model.
- Add map-provider traffic, weather, toll, and route restrictions as features.
- Use a proper ML stack once real data exists, such as Python training jobs and a model registry.
