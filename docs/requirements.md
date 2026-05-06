# Logistics System Requirements

## Goal

Build a logistics operating system that helps a dispatcher receive orders, plan loads, assign vehicles and drivers, track shipment progress, manage exceptions, and keep customers updated.

## Core users

- Admin: manages users, branches, permissions, pricing rules, and master data.
- Dispatcher: creates shipments, assigns vehicles, monitors ETA, and handles exceptions.
- Warehouse operator: manages inbound and outbound docks, loading, unloading, and inventory handoff.
- Driver: accepts trips, updates checkpoints, uploads proof of delivery, and reports incidents.
- Customer service: checks shipment status, updates customers, and handles disputes.
- Finance: reviews charges, invoices, payments, and carrier costs.

## MVP modules

- Dashboard: active shipments, delayed loads, fleet utilization, and on-time rate.
- Shipment management: create shipment, assign vehicle, change status, track ETA, and export shipment list.
- Fleet management: vehicle availability, driver assignment, capacity, utilization, and maintenance status.
- Tracking timeline: checkpoint history for booked, loaded, dispatched, in-transit, delayed, and delivered states.
- Exception queue: delayed loads, critical shipments, vehicle downtime, and missing updates.
- Basic reporting: CSV export for operations review.
- AI dispatch copilot: summarize exceptions, suggest priority actions, draft customer updates, and identify fleet moves using Mistral.
- ML operations: delivery-time prediction, demand prediction, anomaly/fraud detection, route optimization, and warehouse stock/slotting recommendations.

## Full system modules

- Order intake: customer orders, service type, pickup/drop addresses, package details, and promised delivery window.
- Load planning: route selection, consolidation, vehicle capacity checks, and stop sequencing.
- Warehouse and inventory: dock scheduling, bin locations, stock handoff, scan events, and discrepancy records.
- Driver mobile app: trip sheet, navigation handoff, status updates, incident capture, signatures, photos, and POD upload.
- Customer portal: shipment lookup, live status, documents, support tickets, and delivery notifications.
- Billing: rate cards, accessorial charges, tax, invoices, payments, and credit notes.
- Integrations: maps, GPS devices, SMS, email, WhatsApp, ERP, accounting, payment gateway, and barcode/QR scanning.
- AI services: Mistral API proxy, prompt logging policy, redaction rules, and model configuration.
- ML services: training data pipeline, model metrics, prediction APIs, retraining schedule, and monitoring for model drift.
- Admin and security: roles, permissions, audit logs, branch access, API keys, and data retention.

## Shipment lifecycle

1. Order received
2. Shipment booked
3. Vehicle and driver assigned
4. Pickup scheduled
5. Loaded and dispatched
6. In transit
7. Delayed or exception raised, when needed
8. Arrived at destination
9. Delivered with proof
10. Billed and closed

## Non-functional requirements

- Security: role-based access, encrypted credentials, audit logs, and tenant isolation if serving multiple companies.
- AI privacy: keep provider API keys server-side, minimize data sent to LLMs, redact sensitive customer data when possible, and log prompts only when explicitly needed for support.
- ML governance: track model version, training data range, prediction confidence, and human overrides.
- Reliability: durable shipment events, retryable notifications, and backup strategy.
- Performance: fast search/filtering for daily operations and indexed queries for shipment IDs, customers, dates, and lanes.
- Usability: dense operational screens, keyboard-friendly workflows, clear exception states, and mobile-friendly driver tasks.
- Compliance: invoice/tax rules, document retention, driver identity, and customer data privacy.

## Decisions still needed

- Business type: local courier, trucking, warehouse distribution, freight forwarding, or multi-carrier marketplace.
- Geography: city, state, national, or international operations.
- Tracking method: manual driver updates, GPS devices, carrier API, or mobile app location.
- Pricing model: flat rate, per km, per kg, per zone, per vehicle, or contract rate cards.
- Deployment target: internal LAN, cloud SaaS, or customer-facing portal.
