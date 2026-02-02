#!/usr/bin/env python3
"""
Path Simulation Script for Vehicle Tracker
Generates simulated telemetry data with straight-line paths between popular Amman locations.

Features:
- Creates 4 new vehicles/drivers.
- Simulates straight paths between two random points (6-15km apart).
- Updates telemetry every 5 seconds (simulating real-time polling).
- Varies speed 4-8 times along the path.
"""

import requests
import random
import math
from datetime import datetime, timedelta, timezone
import time
import sys

# API Configuration
if len(sys.argv) > 1:
    API_BASE = sys.argv[1].rstrip('/')
else:
    API_BASE = "http://localhost:5000/api"

print(f"Targeting API: {API_BASE}")

# Popular locations in Amman with coordinates
# Format: (name, latitude, longitude)
AMMAN_LOCATIONS = [
    ("Downtown Amman (Al-Balad)", 31.9539, 35.9106),
    ("Abdali Mall", 31.9654, 35.9107),
    ("City Mall", 31.9891, 35.8566),
    ("Mecca Mall", 31.9785, 35.8578),
    ("7th Circle", 31.9551, 35.8668),
    ("University of Jordan", 32.0157, 35.8731),
    ("Sports City", 31.9908, 35.8917),
    ("Queen Alia Airport", 31.7225, 35.9932),
    ("Abdoun Bridge", 31.9540, 35.9006),
    ("Sweifieh", 31.9647, 35.8466),
    ("Jabal Amman (1st Circle)", 31.9524, 35.9215),
    ("Al-Hussein Sports City", 31.9765, 35.9353),
    ("Marj Al-Hamam", 31.9189, 35.8350),
    ("Tabarbour", 32.0143, 35.9397),
    ("Abu Nsair", 32.0307, 35.8675),
    ("Shafa Badran", 32.0614, 35.8913),
    ("Khalda", 31.9672, 35.8512),
    ("Tla' Al-Ali", 31.9843, 35.8468),
    ("Al-Rabiyeh", 31.9912, 35.8657),
    ("Jabal Al-Hussein", 31.9612, 35.9073),
]

# Car makes and models for variety
CAR_DATA = [
    {"make": "Hyundai", "model": "Sonata", "color": "Silver"},
    {"make": "Kia", "model": "Sportage", "color": "White"},
    {"make": "Nissan", "model": "Patrol", "color": "Black"},
    {"make": "Mitsubishi", "model": "Pajero", "color": "Gray"},
]

# Driver names (Arabic names common in Jordan)
DRIVER_NAMES = [
    {"firstName": "Mohammad", "lastName": "Al-Zoubi"},
    {"firstName": "Ahmad", "lastName": "Haddad"},
    {"firstName": "Omar", "lastName": "Qasem"},
    {"firstName": "Khaled", "lastName": "Nasser"},
]


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the distance between two points in kilometers."""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def find_valid_location_pair():
    """Find two random locations that are 6-15km apart."""
    max_attempts = 100
    
    for _ in range(max_attempts):
        loc_a = random.choice(AMMAN_LOCATIONS)
        loc_b = random.choice(AMMAN_LOCATIONS)
        
        if loc_a == loc_b:
            continue
            
        distance = haversine_distance(loc_a[1], loc_a[2], loc_b[1], loc_b[2])
        
        if 6 <= distance <= 15:
            return loc_a, loc_b, distance
    
    # Fallback: just pick two different locations
    loc_a = AMMAN_LOCATIONS[0]
    loc_b = AMMAN_LOCATIONS[7]  # Airport is usually far
    distance = haversine_distance(loc_a[1], loc_a[2], loc_b[1], loc_b[2])
    return loc_a, loc_b, distance


def simulate_journey(vehicle_id, vehicle_name):
    """Generate and post telemetry data with 5s intervals."""
    print(f"\n  Generating path for {vehicle_name}...")
    
    loc_a, loc_b, total_distance_km = find_valid_location_pair()
    print(f"    Route: {loc_a[0]} → {loc_b[0]}")
    print(f"    Total Distance: {total_distance_km:.2f} km")
    
    # Define speed segments (4-8 segments)
    num_segments = random.randint(4, 8)
    speeds = []
    
    # Generate random speeds for each segment
    for _ in range(num_segments):
        # Weighted random choice for speed type
        r = random.random()
        if r < 0.2: speed = random.uniform(10, 30)   # Traffic
        elif r < 0.7: speed = random.uniform(40, 60) # City
        else: speed = random.uniform(70, 90)         # Highway
        speeds.append(round(speed, 1))
        
    print(f"    Speed segments (km/h): {speeds}")
    
    # Divide proper distance into segments
    segment_length_km = total_distance_km / num_segments
    
    # Simulation Start Time (e.g., 2 hours ago to ensure it's in the past)
    # Base time for simulation (start 2 hours ago)
    start_time = datetime.now(timezone.utc) - timedelta(hours=2)
    current_time = start_time
    
    current_dist_km = 0.0
    step_seconds = 5 # 5 seconds polling interval
    
    telemetry_points = []
    
    # Start point
    telemetry_points.append({
        "lat": loc_a[1],
        "lon": loc_a[2],
        "speed": 0,
        "time": current_time
    })
    
    while current_dist_km < total_distance_km:
        # Determine current segment index
        segment_idx = min(int(current_dist_km / segment_length_km), num_segments - 1)
        current_speed_kmh = speeds[segment_idx]
        
        # Distance covered in this step (km) = Speed (km/h) * Time (h)
        dist_step_km = current_speed_kmh * (step_seconds / 3600.0)
        
        if dist_step_km <= 0: dist_step_km = 0.001 # Ensure minimal movement if speed is 0
        
        current_dist_km += dist_step_km
        if current_dist_km > total_distance_km:
            current_dist_km = total_distance_km
            
        # Interpolate Position
        # Simple linear interpolation on lat/lon (sufficient for short distances on flat approximations)
        ratio = current_dist_km / total_distance_km
        
        lat = loc_a[1] + (loc_b[1] - loc_a[1]) * ratio
        lon = loc_a[2] + (loc_b[2] - loc_a[2]) * ratio
        
        current_time += timedelta(seconds=step_seconds)
        
        telemetry_points.append({
            "lat": lat,
            "lon": lon,
            "speed": current_speed_kmh,
            "time": current_time
        })
        
    print(f"    Generated {len(telemetry_points)} telemetry points (5s intervals).")
    print(f"    Duration: {(current_time - start_time).total_seconds() / 60:.1f} minutes")
    
    # Post to API
    success_count = 0
    print("    Posting telemetry...")
    
    # Batch logging to avoid console spam
    for i, point in enumerate(telemetry_points):
        # Add random fuel fluctuation
        fuel = max(0, 100 - (i * 0.05)) # usage example
        
        payload = {
            "vehicleId": vehicle_id,
            "latitude": point['lat'],
            "longitude": point['lon'],
            "speed": point['speed'],
            "fuel": round(fuel, 1),
            "timestamp": point['time'].strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        
        try:
            resp = requests.post(f"{API_BASE}/livetracking", json=payload)
            if resp.status_code == 200:
                success_count += 1
            else:
                if i == 0: # Print error only for first failure to debug
                    print(f"    [!] Error posting: {resp.status_code} - {resp.text}")
        except Exception as e:
            if i == 0:
                print(f"    [!] Exception posting: {e}")
                
        # Show progress
        if i % 50 == 0:
            sys.stdout.write(f"\r    Progress: {i}/{len(telemetry_points)}")
            sys.stdout.flush()
            
    sys.stdout.write(f"\r    Progress: {len(telemetry_points)}/{len(telemetry_points)}\n")
    print(f"    ✓ Successfully posted {success_count}/{len(telemetry_points)} points.")


def create_entity(endpoint, payload, name_field):
    """Helper to create driver or vehicle."""
    try:
        resp = requests.post(f"{API_BASE}/{endpoint}", json=payload)
        if resp.status_code == 201:
            data = resp.json()
            # Handle different ID fields
            id_field = "driverId" if endpoint == "drivers" else "vehicleId"
            print(f"  ✓ Created {endpoint[:-1]}: {payload.get(name_field, 'Unknown')} (ID: {data[id_field]})")
            return data[id_field]
        else:
            print(f"  ✗ Failed to create {endpoint[:-1]}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"  ✗ Connection error creating {endpoint[:-1]}: {e}")
        return None

def main():
    print("=" * 60)
    print("Vehicle Tracker - 5s Interval Path Simulation")
    print("=" * 60)
    
    # 1. Create Drivers
    print("\n1. Creating 4 new drivers...")
    driver_ids = []
    for i, d in enumerate(DRIVER_NAMES):
        did = create_entity("drivers", {
            "firstName": d["firstName"],
            "lastName": d["lastName"],
            "licenseNumber": f"SIM-{random.randint(10000,99999)}",
            "phoneNumber": f"+9627{random.randint(70000000, 99999999)}"
        }, "firstName")
        if did: driver_ids.append(did)
        
    if not driver_ids:
        print("Failed to create drivers. Exiting.")
        return

    # 2. Create Vehicles
    print("\n2. Creating 4 new vehicles...")
    vehicles = [] # List of dicts {id, name}
    
    for i, (car, driver_id) in enumerate(zip(CAR_DATA, driver_ids)):
        vid = create_entity("vehicles", {
            "driverId": driver_id,
            "plateNumber": f"SIM-{random.randint(1000,9999)}",
            "make": car["make"],
            "model": car["model"],
            "color": car["color"]
        }, "make")
        
        if vid:
            vehicles.append({"id": vid, "name": f"{car['make']} {car['model']}"})
            
    if not vehicles:
        print("Failed to create vehicles. Exiting.")
        return
        
    # 3. Simulate Paths
    print("\n3. Simulating Paths (5s intervals)...")
    for v in vehicles:
        simulate_journey(v["id"], v["name"])
        
    print("\n" + "=" * 60)
    print("Simulation Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
