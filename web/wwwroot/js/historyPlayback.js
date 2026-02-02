/**
 * Vehicle Tracker - History Playback Module
 * Simple time-based playback with linear interpolation
 */

const HistoryPlayback = (function() {
    // Playback state
    let isPlaying = false;
    let playbackSpeed = 1;
    let animationFrameId = null;
    let lastFrameTime = 0;
    
    // Time tracking - playbackTime is milliseconds from trail start
    let playbackTime = 0;
    let trailStartTime = 0;
    let trailEndTime = 0;
    
    // Data
    let trailData = [];
    let vehicleId = null;
    let vehicleName = '';
    
    // Date range for loading
    let rangeStart = null;
    let rangeEnd = null;
    
    // Map elements
    let playbackMarker = null;
    let playbackPath = null;
    let travelledPath = null;
    
    // Callbacks
    let onPositionChange = null;
    let onPlayStateChange = null;
    
    function init(callbacks = {}) {
        onPositionChange = callbacks.onPositionChange || null;
        onPlayStateChange = callbacks.onPlayStateChange || null;
        
        const now = new Date();
        rangeEnd = now;
        rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        console.log('HistoryPlayback initialized');
    }
    
    function setDateRange(start, end) {
        rangeStart = start instanceof Date ? start : new Date(start);
        rangeEnd = end instanceof Date ? end : new Date(end);
    }
    
    function getDateRange() {
        return { start: rangeStart, end: rangeEnd };
    }
    
    async function loadTrail(vId, vName) {
        vehicleId = vId;
        vehicleName = vName || `Vehicle ${vId}`;
        
        try {
            const data = await HistoryAPI.getRange(
                vehicleId,
                rangeStart.toISOString(),
                rangeEnd.toISOString()
            );
            
            if (!data.trail || data.trail.length === 0) {
                trailData = [];
                return { success: false, message: 'No history data in selected range' };
            }
            
            trailData = data.trail.filter(p => p.latitude && p.longitude);
            
            if (trailData.length < 2) {
                return { success: false, message: 'Not enough data points' };
            }
            
            // Store trail time bounds
            trailStartTime = new Date(trailData[0].timestamp).getTime();
            trailEndTime = new Date(trailData[trailData.length - 1].timestamp).getTime();
            playbackTime = 0;
            
            console.log(`Loaded ${trailData.length} points, duration: ${(trailEndTime - trailStartTime) / 1000}s`);
            return { success: true, pointCount: trailData.length };
        } catch (error) {
            console.error('Failed to load trail:', error);
            trailData = [];
            return { success: false, message: error.message };
        }
    }
    
    function getTrailData() {
        return trailData;
    }
    
    function startVisualization(map) {
        if (trailData.length < 2) {
            console.warn('Not enough trail data');
            return false;
        }
        
        clearVisualization(map);
        
        // Draw full path (gray)
        const coords = trailData.map(p => [p.latitude, p.longitude]);
        playbackPath = L.polyline(coords, {
            color: '#9ca3af',
            weight: 4,
            opacity: 0.6
        }).addTo(map);
        
        // Travelled path (blue)
        travelledPath = L.polyline([], {
            color: '#155dfc',
            weight: 5,
            opacity: 0.9
        }).addTo(map);
        
        // Marker at start
        const start = trailData[0];
        playbackMarker = L.marker([start.latitude, start.longitude], {
            icon: createPlaybackIcon(),
            zIndexOffset: 1000
        }).addTo(map);
        
        playbackTime = 0;
        map.fitBounds(playbackPath.getBounds(), { padding: [50, 50] });
        
        updateMarkerPosition();
        return true;
    }
    
    function createPlaybackIcon() {
        return L.divIcon({
            className: 'playback-marker-container',
            html: `
                <div style="
                    width: 44px;
                    height: 44px;
                    background-color: #155dfc;
                    border: 4px solid white;
                    border-radius: 50%;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <span class="material-symbols-outlined" style="
                        font-size: 22px;
                        color: white;
                        font-variation-settings: 'FILL' 1;
                    ">directions_car</span>
                </div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });
    }
    
    function clearVisualization(map) {
        if (playbackMarker) {
            map.removeLayer(playbackMarker);
            playbackMarker = null;
        }
        if (playbackPath) {
            map.removeLayer(playbackPath);
            playbackPath = null;
        }
        if (travelledPath) {
            map.removeLayer(travelledPath);
            travelledPath = null;
        }
        playbackTime = 0;
    }
    
    /**
     * Find position at current playbackTime and update marker
     */
    function updateMarkerPosition() {
        if (trailData.length < 2 || !playbackMarker) return;
        
        const currentTime = trailStartTime + playbackTime;
        const totalDuration = trailEndTime - trailStartTime;
        
        // Find the two points we're between
        let p1 = trailData[0];
        let p2 = trailData[1];
        let p1Index = 0;
        
        for (let i = 0; i < trailData.length - 1; i++) {
            const t1 = new Date(trailData[i].timestamp).getTime();
            const t2 = new Date(trailData[i + 1].timestamp).getTime();
            
            if (currentTime >= t1 && currentTime <= t2) {
                p1 = trailData[i];
                p2 = trailData[i + 1];
                p1Index = i;
                break;
            }
            
            // If past this segment, use next
            if (currentTime > t2) {
                p1 = trailData[i + 1];
                p2 = trailData[Math.min(i + 2, trailData.length - 1)];
                p1Index = i + 1;
            }
        }
        
        // Interpolation factor between p1 and p2
        const t1 = new Date(p1.timestamp).getTime();
        const t2 = new Date(p2.timestamp).getTime();
        const segmentDuration = t2 - t1;
        
        let fraction = 0;
        if (segmentDuration > 0) {
            fraction = (currentTime - t1) / segmentDuration;
            fraction = Math.max(0, Math.min(1, fraction));
        }
        
        // Linear interpolation
        const lat = p1.latitude + (p2.latitude - p1.latitude) * fraction;
        const lng = p1.longitude + (p2.longitude - p1.longitude) * fraction;
        
        // Update marker
        playbackMarker.setLatLng([lat, lng]);
        
        // Update travelled path
        if (travelledPath) {
            const travelledCoords = trailData.slice(0, p1Index + 1).map(p => [p.latitude, p.longitude]);
            travelledCoords.push([lat, lng]);
            travelledPath.setLatLngs(travelledCoords);
        }
        
        // Notify callback
        if (onPositionChange) {
            const normalizedPos = totalDuration > 0 ? playbackTime / totalDuration : 0;
            onPositionChange({
                normalizedPos,
                index: p1Index,
                totalPoints: trailData.length,
                timestamp: new Date(currentTime),
                latitude: lat,
                longitude: lng,
                speed: p1.speed || 0
            });
        }
    }
    
    function seekTo(normalizedPos) {
        normalizedPos = Math.max(0, Math.min(1, normalizedPos));
        const totalDuration = trailEndTime - trailStartTime;
        playbackTime = normalizedPos * totalDuration;
        updateMarkerPosition();
    }
    
    function updatePosition(normalizedPos) {
        seekTo(normalizedPos);
    }
    
    function play(map) {
        if (trailData.length < 2) return;
        if (isPlaying) return;
        
        isPlaying = true;
        lastFrameTime = performance.now();
        
        if (onPlayStateChange) {
            onPlayStateChange({ playing: true });
        }
        
        animationLoop(map);
    }
    
    function pause() {
        isPlaying = false;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        if (onPlayStateChange) {
            onPlayStateChange({ playing: false });
        }
    }
    
    function togglePlay(map) {
        if (isPlaying) {
            pause();
        } else {
            play(map);
        }
    }
    
    function stop(map) {
        pause();
        playbackTime = 0;
        updateMarkerPosition();
    }
    
    function animationLoop(map) {
        if (!isPlaying) return;
        
        const now = performance.now();
        const deltaMs = now - lastFrameTime;
        lastFrameTime = now;
        
        // Advance playback time
        playbackTime += deltaMs * playbackSpeed;
        
        const totalDuration = trailEndTime - trailStartTime;
        
        if (playbackTime >= totalDuration) {
            playbackTime = totalDuration;
            updateMarkerPosition();
            pause();
            return;
        }
        
        updateMarkerPosition();
        
        animationFrameId = requestAnimationFrame(() => animationLoop(map));
    }
    
    function getTotalDuration() {
        return Math.max(trailEndTime - trailStartTime, 1000);
    }
    
    function setSpeed(speed) {
        playbackSpeed = speed;
    }
    
    function getSpeed() {
        return playbackSpeed;
    }
    
    function getIsPlaying() {
        return isPlaying;
    }
    
    function getVehicleInfo() {
        return { id: vehicleId, name: vehicleName };
    }
    
    function skipForward(amount = 0.05) {
        const totalDuration = trailEndTime - trailStartTime;
        playbackTime = Math.min(totalDuration, playbackTime + amount * totalDuration);
        updateMarkerPosition();
    }
    
    function skipBackward(amount = 0.05) {
        const totalDuration = trailEndTime - trailStartTime;
        playbackTime = Math.max(0, playbackTime - amount * totalDuration);
        updateMarkerPosition();
    }
    
    function formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
    
    function getTrailSummary() {
        if (trailData.length === 0) {
            return { pointCount: 0, duration: 'N/A', startTime: null, endTime: null };
        }
        
        const startTime = new Date(trailData[0].timestamp);
        const endTime = new Date(trailData[trailData.length - 1].timestamp);
        const duration = endTime - startTime;
        
        return {
            pointCount: trailData.length,
            duration: formatDuration(duration),
            startTime,
            endTime
        };
    }
    
    return {
        init,
        setDateRange,
        getDateRange,
        loadTrail,
        getTrailData,
        startVisualization,
        clearVisualization,
        updatePosition,
        seekTo,
        play,
        pause,
        togglePlay,
        stop,
        setSpeed,
        getSpeed,
        getIsPlaying,
        getVehicleInfo,
        skipForward,
        skipBackward,
        getTrailSummary,
        getTotalDuration
    };
})();

window.HistoryPlayback = HistoryPlayback;
