# Vehicle Tracker API Documentation

## Base URL
```
http://localhost:5000/api
```

---

## Live Tracking

### Update Telemetry
Updates real-time telemetry data for a vehicle and logs to history.

**Endpoint:** `POST /api/LiveTracking/telemetry`

**Request Body:**
```json
{
  "vehicleId": 1,
  "latitude": 24.7136,
  "longitude": 46.6753,
  "speed": 60.5,
  "fuel": 75.0,
  "vehicleStatusId": "uuid-here"
}
```

**Response:** `200 OK`
```json
{
  "message": "Telemetry updated",
  "vehicleId": 1
}
```

---

### Get All Vehicle Locations
Returns all vehicles with their current locations and status.

**Endpoint:** `GET /api/LiveTracking/vehicles`

**Response:** `200 OK`
```json
[
  {
    "vehicleId": 1,
    "plateNumber": "ABC-123",
    "make": "Toyota",
    "model": "Hilux",
    "latitude": 24.7136,
    "longitude": 46.6753,
    "currentSpeed": 60.5,
    "currentFuel": 75.0,
    "status": "Active"
  }
]
```

---

### Get Vehicle Live Data
Returns live data for a specific vehicle.

**Endpoint:** `GET /api/LiveTracking/vehicles/{vehicleId}`

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| vehicleId | int | path | Vehicle ID |

**Response:** `200 OK`
```json
{
  "vehicleId": 1,
  "plateNumber": "ABC-123",
  "make": "Toyota",
  "model": "Hilux",
  "color": "White",
  "latitude": 24.7136,
  "longitude": 46.6753,
  "currentSpeed": 60.5,
  "currentFuel": 75.0,
  "status": "Active"
}
```

**Response:** `404 Not Found`
```json
{
  "message": "Vehicle not found or no live data available"
}
```

---

## Incident Management

### Report Incident
Creates a new incident report.

**Endpoint:** `POST /api/Incidents`

**Request Body:**
```json
{
  "incidentTypeId": 1,
  "incidentStatusId": 1,
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Response:** `201 Created`
```json
{
  "incidentId": 1,
  "message": "Incident reported successfully"
}
```

---

### Get Incident
Returns details of a specific incident.

**Endpoint:** `GET /api/Incidents/{id}`

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| id | int | path | Incident ID |

**Response:** `200 OK`
```json
{
  "incidentId": 1,
  "type": "Accident",
  "status": "Open",
  "latitude": 24.7136,
  "longitude": 46.6753,
  "assignedVehicleId": null,
  "assignedVehiclePlate": null
}
```

---

### Get All Incidents
Returns all incidents, optionally filtered by status.

**Endpoint:** `GET /api/Incidents`

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| statusId | int | No | Filter by status ID |

**Response:** `200 OK`
```json
[
  {
    "incidentId": 1,
    "type": "Accident",
    "status": "Open",
    "latitude": 24.7136,
    "longitude": 46.6753,
    "assignedVehicleId": null,
    "assignedVehiclePlate": null
  }
]
```

---

### Get Nearest Vehicles
Finds the nearest vehicles to an incident location.

**Endpoint:** `GET /api/Incidents/{id}/nearest-vehicles`

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| id | int | path | Incident ID |
| limit | int | query | Max vehicles to return (default: 5) |

**Response:** `200 OK`
```json
[
  {
    "vehicleId": 1,
    "plateNumber": "ABC-123",
    "make": "Toyota",
    "model": "Hilux",
    "latitude": 24.7200,
    "longitude": 46.6800,
    "distanceMeters": 850.5
  }
]
```

---

### Assign Incident to Vehicle
Assigns an incident to a vehicle and triggers notification.

**Endpoint:** `POST /api/Incidents/{id}/assign`

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| id | int | path | Incident ID |

**Request Body:**
```json
{
  "vehicleId": 1,
  "statusId": 2
}
```

**Response:** `200 OK`
```json
{
  "message": "Incident assigned successfully",
  "incidentId": 1,
  "assignedVehicleId": 1,
  "assignedVehiclePlate": "ABC-123",
  "notificationSent": true
}
```

---

## History / Playback

### Get Today's Trail
Returns the location trail for a vehicle for the current day. Used when opening the history UI.

**Endpoint:** `GET /api/History/vehicles/{vehicleId}/today`

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| vehicleId | int | path | Vehicle ID |

**Response:** `200 OK`
```json
{
  "vehicleId": 1,
  "date": "2025-12-08T00:00:00Z",
  "pointCount": 150,
  "trail": [
    {
      "timestamp": "2025-12-08T08:00:00Z",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "speed": 0,
      "fuel": 80.0
    },
    {
      "timestamp": "2025-12-08T08:05:00Z",
      "latitude": 24.7150,
      "longitude": 46.6770,
      "speed": 45.5,
      "fuel": 79.5
    }
  ]
}
```

---

### Get Range Trail
Returns the location trail for a vehicle within a specified date/time range.

**Endpoint:** `GET /api/History/vehicles/{vehicleId}/range`

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| vehicleId | int | path | Vehicle ID |
| from | datetime | query | Start of range (ISO 8601) |
| to | datetime | query | End of range (ISO 8601) |

**Example:**
```
GET /api/History/vehicles/1/range?from=2025-12-01T00:00:00Z&to=2025-12-07T23:59:59Z
```

**Response:** `200 OK`
```json
{
  "vehicleId": 1,
  "from": "2025-12-01T00:00:00Z",
  "to": "2025-12-07T23:59:59Z",
  "pointCount": 1250,
  "trail": [
    {
      "timestamp": "2025-12-01T08:00:00Z",
      "latitude": 24.7136,
      "longitude": 46.6753,
      "speed": 0,
      "fuel": 90.0
    }
  ]
}
```

**Response:** `400 Bad Request`
```json
{
  "message": "'from' must be before 'to'"
}
```

---

## Error Responses

All endpoints may return:

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |
