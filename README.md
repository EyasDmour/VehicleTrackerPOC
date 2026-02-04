# VehicleTracker POC

A real-time vehicle tracking proof-of-concept application built with .NET 10 (Preview), ASP.NET Core, SignalR, Leaflet.js, and PostgreSQL/PostGIS.

## Features

- **Real-time Tracking**: Live vehicle positions updated via SignalR.
- **Incident Management**: Report, view, and manage incidents on the map.
- **Dispatch System**: Assign incidents to the nearest available vehicles.
- **History Playback**: Replay vehicle movements over time.
- **Responsive Dashboard**: Web-based UI with interactive map and sidebars.

## Tech Stack

- **Backend**: .NET 10 (ASP.NET Core Web API)
- **Frontend**: ASP.NET Core MVC / Razor Pages + Vanilla JS
- **Database**: PostgreSQL + PostGIS (Spatial Data)
- **Real-time**: SignalR
- **Maps**: Leaflet.js + OpenStreetMap/CartoDB
- **Containerization**: Docker & Docker Compose

## Prerequisites

- **Docker Desktop** (recommended)
- OR
- **.NET 10 SDK** (if running standalone)
- **PostgreSQL 16+ with PostGIS extension** (if running standalone)

## Quick Start (Docker)

The easiest way to run the application is using Docker Compose.

1.  Clone the repository:
    ```bash
    git clone https://github.com/EyasDmour/VehicleTrackerPOC.git
    cd VehicleTrackerPOC
    ```

2.  Run the application:
    ```bash
    docker compose up -d --build
    ```

3.  Access the application:
    - **Web Dashboard**: [http://localhost:5001](http://localhost:5001)
    - **API Swagger**: [http://localhost:5000/swagger](http://localhost:5000/swagger)

   The database will be automatically seeded with dummy data (incidents and vehicles) on the first run.

4.  To stop the application:
    ```bash
    docker compose down
    ```

## Standalone Setup (Development)

If you prefer to run the services manually without Docker configurations:

### 1. Database Setup
Ensure you have a PostgreSQL instance running.
```bash
# Example using Docker for just the DB
docker run --name vehicle-db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=vehicle_tracker -p 5432:5432 -d postgis/postgis:16-3.4
```

### 2. Configure API
Navigate to the `api` directory and update `appsettings.json` or use User Secrets to set your connection string:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Database=vehicle_tracker;Username=user;Password=password"
}
```

### 3. Run API
```bash
cd api
dotnet run
```
The API will start on `http://localhost:5000` (Endpoints are available under `/api`, e.g., `/api/incidents`).

### 4. Configure Web App
The web app needs to know where the API is. Ensure `web/appsettings.json` points to the correct URL (default `http://localhost:5000`).

### 5. Run Web App
```bash
cd web
dotnet run
```
The Web App will start on `http://localhost:5001`.

## Deployment & Container Registry (GHCR)

You can build and push production-ready Docker images to your personal GitHub Container Registry (GHCR) for deployment on other servers.

### 1. Authenticate with GitHub
You need a Personal Access Token (PAT) with `write:packages` and `delete:packages` permissions.

> **Tip:** Use a **Tokens (classic)** PAT for simplest configuration.
> Go to **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)** > **Generate new token**.
> *Select `write:packages` and `delete:packages` scopes.*

```bash
export CR_PAT=YOUR_TOKEN
echo $CR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 2. Build and Push Images
A dedicated production compose file (`docker-compose.prod.yml`) is provided to build optimized images.

**Standard Push (latest):**
```bash
# Build
docker compose -f docker-compose.prod.yml build

# Push to GHCR
docker compose -f docker-compose.prod.yml push
```

**Custom Tag (e.g., for testing):**
You can use the `TAG` environment variable to create specific versions without overwriting `latest`.
```bash
# Build with custom tag
TAG=v1.0-test docker compose -f docker-compose.prod.yml build

# Push custom tag
TAG=v1.0-test docker compose -f docker-compose.prod.yml push
```

### 3. Run from Registry
To run the application on a server using the pushed images:

```bash
# Pull and run (latest)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# OR Run a specific tag
TAG=v1.0-test docker compose -f docker-compose.prod.yml up -d
```

**Note:** Ensure your server has the necessary environment variables set (DB credentials, etc.) either in a `.env` file or exported in the shell.

## Project Structure

- **/api**: Backend ASP.NET Core Web API (Controllers, SignalR Hubs, EF Core Context).
- **/web**: Frontend ASP.NET Core MVC Application (Razor Views, JS modules).
- **/nginx** (optional): Configuration for reverse proxying if needed (not active in default compose).

## Security Note

This is a **Proof of Concept**. Default credentials are provided for local development convenience in `docker-compose.yml`. For production deployment, ensure you:
- Change all passwords.
- Use environment variables for secrets.
- Disable Swagger in production.
- Enable HTTPS/SSL.
