-- Seed test path data for playback testing
-- Creates a straight line path from Khalda Circle heading east
-- First 10 points: close together (slow ~20 km/h) - 10m apart, 2 seconds between
-- Next 10 points: further apart (fast ~60 km/h) - 30m apart, 2 seconds between

-- Use vehicle ID 3 (Honda Civic - TEST-001)

DO $$
DECLARE
    v_vehicle_id INT := 3;  -- Honda Civic TEST-001
    v_base_lat DOUBLE PRECISION := 31.9539;  -- Khalda Circle latitude
    v_base_lng DOUBLE PRECISION := 35.8636;  -- Khalda Circle longitude
    v_timestamp TIMESTAMP := NOW() - INTERVAL '1 hour';  -- Start 1 hour ago
    v_lat DOUBLE PRECISION;
    v_lng DOUBLE PRECISION;
    v_speed DECIMAL;
    i INT;
BEGIN
    -- Delete existing test data for this vehicle (optional - comment out to keep old data)
    DELETE FROM location_history WHERE vehicle_id = v_vehicle_id;
    
    -- ========== SLOW SECTION (10 points) ==========
    -- ~10 meters apart, 2 seconds between each = ~18 km/h
    -- 10 meters in longitude ≈ 0.0001 degrees at this latitude
    
    FOR i IN 0..9 LOOP
        v_lat := v_base_lat;
        v_lng := v_base_lng + (i * 0.0001);  -- Move east, ~10m per point
        v_speed := 18 + (random() * 4);  -- 18-22 km/h with some variation
        v_timestamp := v_timestamp + INTERVAL '2 seconds';
        
        INSERT INTO location_history (vehicle_id, timestamp, location, speed, fuel)
        VALUES (
            v_vehicle_id,
            v_timestamp,
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326),
            v_speed,
            85 - (i * 0.1)  -- Slowly decreasing fuel
        );
    END LOOP;
    
    -- Update base position for next section
    v_base_lng := v_base_lng + (10 * 0.0001);  -- Continue from where we left off
    
    -- ========== FAST SECTION (10 points) ==========
    -- ~30 meters apart, 2 seconds between each = ~54 km/h
    -- 30 meters in longitude ≈ 0.0003 degrees at this latitude
    
    FOR i IN 0..9 LOOP
        v_lat := v_base_lat;
        v_lng := v_base_lng + (i * 0.0003);  -- Move east, ~30m per point
        v_speed := 50 + (random() * 10);  -- 50-60 km/h with some variation
        v_timestamp := v_timestamp + INTERVAL '2 seconds';
        
        INSERT INTO location_history (vehicle_id, timestamp, location, speed, fuel)
        VALUES (
            v_vehicle_id,
            v_timestamp,
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326),
            v_speed,
            84 - (i * 0.1)  -- Slowly decreasing fuel
        );
    END LOOP;
    
    -- Update base position for next section
    v_base_lng := v_base_lng + (10 * 0.0003);
    
    -- ========== SLOW DOWN SECTION (5 points) ==========
    -- Transition back to slow speed
    
    FOR i IN 0..4 LOOP
        v_lat := v_base_lat;
        v_lng := v_base_lng + (i * 0.00015);  -- ~15m per point
        v_speed := 35 - (i * 5);  -- Slowing from 35 to 15 km/h
        v_timestamp := v_timestamp + INTERVAL '2 seconds';
        
        INSERT INTO location_history (vehicle_id, timestamp, location, speed, fuel)
        VALUES (
            v_vehicle_id,
            v_timestamp,
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326),
            v_speed,
            83 - (i * 0.1)
        );
    END LOOP;
    
    RAISE NOTICE 'Inserted 25 test points for vehicle %', v_vehicle_id;
END $$;

-- Verify the data
SELECT 
    id,
    vehicle_id,
    timestamp,
    ST_Y(location) as latitude,
    ST_X(location) as longitude,
    speed,
    fuel
FROM location_history 
WHERE vehicle_id = 3  -- Honda Civic TEST-001
ORDER BY timestamp;
