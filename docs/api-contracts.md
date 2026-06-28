# API Contracts

Base URL: `http://localhost:3000/api/v1`

All requests and responses use `Content-Type: application/json`. Datetimes are ISO 8601 UTC strings.

---

## POST /availability

Check whether a vehicle of the given type is available at the given location and time slot. Returns the recommended vehicle to book (pre-selected via the even distribution algorithm).

### Request

```json
{
  "location": "dublin",
  "vehicleType": "tesla_model3",
  "startDateTime": "2023-10-18T10:00:00Z",
  "durationMins": 45
}
```

| Field           | Type     | Required | Description                                      |
|----------------|----------|----------|--------------------------------------------------|
| `location`      | `string` | Yes      | Location slug (e.g. `dublin`, `cork`)            |
| `vehicleType`   | `string` | Yes      | Vehicle type slug (e.g. `tesla_model3`)          |
| `startDateTime` | `string` | Yes      | ISO 8601 UTC datetime for the start of the slot  |
| `durationMins`  | `number` | Yes      | Duration of the test drive in minutes            |

### Response - 200 OK (available)

```json
{
  "available": true,
  "vehicleId": "tesla_1001"
}
```

### Response - 200 OK (unavailable)

```json
{
  "available": false,
  "vehicleId": null
}
```

| Field       | Type              | Description                                                            |
|------------|-------------------|------------------------------------------------------------------------|
| `available` | `boolean`         | Whether a vehicle is available for the requested slot                  |
| `vehicleId` | `string \| null`  | ID of the recommended vehicle selected by the distribution algorithm, or `null` if unavailable |

### Error Responses

| Status | Code                  | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| `400`  | `VALIDATION_ERROR`    | Missing or invalid request fields                |
| `500`  | `INTERNAL_ERROR`      | Unexpected server error                          |

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "startDateTime must be a valid ISO 8601 UTC datetime"
  }
}
```

### Availability Rules

A vehicle is returned only when **all** of the following conditions are met:

1. `vehicleType` matches the vehicle's configured type
2. `location` matches the vehicle's configured location
3. The day of `startDateTime` is in the vehicle's `availableDays`
4. The full booking window (`startDateTime` → `startDateTime + durationMins`) falls within `availableFromTime` and `availableToTime`
5. The booking window does not overlap any existing reservation
6. The booking window respects the vehicle's `minimumMinutesBetweenBookings` buffer from adjacent reservations

---

## POST /bookings

Reserve a vehicle slot for a customer. Availability is re-validated inside a database transaction to prevent race conditions.

### Request

```json
{
  "vehicleId": "tesla_1001",
  "startDateTime": "2023-10-18T10:00:00Z",
  "durationMins": 45,
  "customerName": "John Smith",
  "customerEmail": "john@smith.com",
  "customerPhone": "+353851234567"
}
```

| Field           | Type     | Required | Description                                     |
|----------------|----------|----------|-------------------------------------------------|
| `vehicleId`     | `string` | Yes      | ID of the vehicle to book                       |
| `startDateTime` | `string` | Yes      | ISO 8601 UTC datetime for the start of the slot |
| `durationMins`  | `number` | Yes      | Duration of the test drive in minutes           |
| `customerName`  | `string` | Yes      | Full name of the customer                       |
| `customerEmail` | `string` | Yes      | Customer email address                          |
| `customerPhone` | `string` | Yes      | Customer phone number (E.164 format)            |

### Response - 201 Created

```json
{
  "bookingId": "b3f1c2a4-9d0e-4f8b-bc23-1e5d7f3a2c91"
}
```

| Field       | Type     | Description                    |
|------------|----------|--------------------------------|
| `bookingId` | `string` | UUID of the created booking    |

### Error Responses

| Status | Code                  | Description                                                   |
|--------|-----------------------|---------------------------------------------------------------|
| `400`  | `VALIDATION_ERROR`    | Missing or invalid request fields                             |
| `409`  | `SLOT_UNAVAILABLE`    | Slot is no longer available (taken by a concurrent booking)   |
| `404`  | `VEHICLE_NOT_FOUND`   | No vehicle exists with the given `vehicleId`                  |
| `500`  | `INTERNAL_ERROR`      | Unexpected server error                                       |

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "The requested slot is no longer available"
  }
}
```

---

## Data Models

### Vehicle

```json
{
  "id": "tesla_1001",
  "type": "tesla_model3",
  "location": "dublin",
  "availableFromTime": "08:00:00",
  "availableToTime": "18:00:00",
  "availableDays": ["mon", "tue", "wed", "thur", "fri"],
  "minimumMinutesBetweenBookings": 15
}
```

### Booking

```json
{
  "id": "b3f1c2a4-9d0e-4f8b-bc23-1e5d7f3a2c91",
  "vehicleId": "tesla_1001",
  "startDateTime": "2023-10-18T10:00:00Z",
  "endDateTime": "2023-10-18T10:45:00Z",
  "customerName": "John Smith",
  "customerEmail": "john@smith.com",
  "customerPhone": "+353851234567"
}
```

---

## Booking Constraints

- `durationMins` must be a positive integer
- `startDateTime` must be in the future and no more than 14 days ahead
- `customerEmail` must be a valid email address
- `customerPhone` must be a non-empty string
- `endDateTime` is computed as `startDateTime + durationMins` and is never accepted as input
