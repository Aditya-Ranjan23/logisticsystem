# Logistics Data Model

## Main entities

### User

- id
- name
- email
- phone
- role
- branch_id
- status
- created_at

### Customer

- id
- company_name
- contact_name
- email
- phone
- billing_address_id
- default_service_level
- payment_terms

### Address

- id
- label
- line_1
- line_2
- city
- state
- postal_code
- country
- latitude
- longitude

### Order

- id
- customer_id
- order_number
- service_level
- pickup_address_id
- delivery_address_id
- requested_pickup_at
- promised_delivery_at
- status
- created_by

### Shipment

- id
- order_id
- customer_id
- origin_address_id
- destination_address_id
- vehicle_id
- driver_id
- status
- priority
- eta
- weight_kg
- volume_cbm
- revenue_amount
- cost_amount
- created_at
- updated_at

### ShipmentStop

- id
- shipment_id
- sequence
- stop_type
- address_id
- planned_arrival_at
- actual_arrival_at
- planned_departure_at
- actual_departure_at
- status

### TrackingEvent

- id
- shipment_id
- stop_id
- event_type
- message
- latitude
- longitude
- created_by
- occurred_at

### Vehicle

- id
- registration_number
- vehicle_type
- capacity_kg
- capacity_cbm
- status
- current_location_address_id
- odometer_km
- maintenance_due_at

### Driver

- id
- user_id
- license_number
- phone
- status
- assigned_vehicle_id

### Warehouse

- id
- name
- code
- address_id
- manager_user_id
- status

### InventoryItem

- id
- warehouse_id
- sku
- name
- quantity_available
- quantity_reserved
- unit_weight_kg
- bin_location

### Invoice

- id
- customer_id
- shipment_id
- invoice_number
- subtotal
- tax
- total
- status
- due_at
- paid_at

### AiDispatchRun

- id
- requested_by
- model
- prompt
- response_summary
- related_shipment_ids
- created_at
- status

### MlPrediction

- id
- model_version
- shipment_id
- prediction_type
- input_features
- predicted_value
- confidence
- created_at
- outcome_value
- reviewed_by

## Key relationships

- A customer can have many orders and shipments.
- An order can create one or many shipments.
- A shipment belongs to one customer and can have many stops and tracking events.
- A shipment can be assigned one vehicle and one driver.
- A warehouse can hold many inventory items and can appear as a pickup or delivery address.
- An invoice can be linked to a shipment, order, or billing period.
- An AI dispatch run can reference one or many shipments and should store only the minimum operational context needed.
- An ML prediction belongs to a model version and can later be joined to the real outcome for retraining.

## Useful API endpoints

```text
GET    /api/shipments
POST   /api/shipments
GET    /api/shipments/:id
PATCH  /api/shipments/:id/status
POST   /api/shipments/:id/events

GET    /api/vehicles
PATCH  /api/vehicles/:id/status

GET    /api/drivers
POST   /api/assignments

GET    /api/customers
POST   /api/orders

GET    /api/reports/shipments.csv

POST   /api/ai/dispatch-plan
GET    /api/ml/insights
POST   /api/ml/predict
GET    /api/route/estimate
POST   /api/route/optimize
POST   /api/driver/pickup
POST   /api/driver/pod
POST   /api/driver/incident
POST   /api/notifications/send
```

## Indexes to plan

- shipments(id)
- shipments(customer_id, status)
- shipments(status, eta)
- shipments(vehicle_id, status)
- tracking_events(shipment_id, occurred_at)
- orders(customer_id, created_at)
- invoices(customer_id, status, due_at)
