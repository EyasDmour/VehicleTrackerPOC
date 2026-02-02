/**
 * Vehicle Tracker - Map Module
 * Handles Leaflet map initialization and marker management
 */

const MapModule = (function () {
    let map = null;
    let vehicleMarkers = {};
    let incidentMarkers = {};
    let currentPopup = null;
    let currentPathLayer = null; // Polyline for vehicle path
    let pathStartMarker = null;
    let pathEndMarker = null;

    // Path display settings
    let pathPointLimit = 100; // Default: show last 100 points

    // Khalda, Amman coordinates
    const KHALDA_CENTER = [31.9539, 35.8636];
    const DEFAULT_ZOOM = 14;

    // Cache for reverse geocoded locations
    const geocodeCache = {};

    /**
     * Reverse geocode coordinates to a location name using OpenStreetMap Nominatim
     */
    async function reverseGeocode(lat, lng) {
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

        // Return cached result if available
        if (geocodeCache[cacheKey]) {
            return geocodeCache[cacheKey];
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
                {
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'VehicleTracker/1.0'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }

            const data = await response.json();

            // Extract a readable location name
            let locationName = 'Unknown location';
            if (data.address) {
                const addr = data.address;
                // Try to build a concise location name
                const parts = [];
                if (addr.road) parts.push(addr.road);
                if (addr.neighbourhood) parts.push(addr.neighbourhood);
                else if (addr.suburb) parts.push(addr.suburb);
                else if (addr.city_district) parts.push(addr.city_district);

                if (parts.length > 0) {
                    locationName = parts.join(', ');
                } else if (data.display_name) {
                    // Fallback: use first two parts of display name
                    const displayParts = data.display_name.split(',').slice(0, 2);
                    locationName = displayParts.join(',').trim();
                }
            }

            // Cache the result
            geocodeCache[cacheKey] = locationName;
            return locationName;
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
            return 'Unknown location';
        }
    }

    /**
     * Create a custom vehicle marker icon
     */
    function createVehicleIcon(isOnline, isSelected) {
        const color = isOnline ? '#155dfc' : '#9ca3af';
        const size = isSelected ? 48 : 40;

        return L.divIcon({
            className: 'vehicle-marker-container',
            html: `
                <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${color};
                    border: 3px solid white;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <span class="material-symbols-outlined" style="
                        transform: rotate(45deg);
                        font-size: ${size * 0.5}px;
                        color: white;
                        font-variation-settings: 'FILL' 1;
                    ">directions_car</span>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -size]
        });
    }

    /**
     * Create a custom incident marker icon
     */
    function createIncidentIcon(priority) {
        const colors = {
            high: '#fb2c36',
            medium: '#ff6900',
            low: '#00bcd4'
        };
        const color = colors[priority] || colors.medium;

        return L.divIcon({
            className: 'incident-marker-container',
            html: `
                <div style="
                    width: 32px;
                    height: 32px;
                    background-color: ${color};
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <span class="material-symbols-outlined" style="font-size: 16px; color: white;">warning</span>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -20]
        });
    }

    /**
     * Initialize the Leaflet map
     */
    function init() {
        // Create map centered on Khalda, Amman
        map = L.map('map', {
            center: KHALDA_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false // We have custom zoom controls
        });

        // Add CartoDB Positron tiles (minimal style - streets and text only)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add labels layer on top
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add vehicle markers
        addVehicleMarkers();

        // Add incident markers
        addIncidentMarkers();

        // Setup custom zoom controls
        setupZoomControls();

        // Update popover position on map move/zoom
        map.on('move', updatePopoverPosition);
        map.on('zoom', updatePopoverPosition);

        // Subscribe to state changes
        State.subscribe(handleStateChange);

        console.log('Map initialized centered on Khalda, Amman');
    }

    /**
     * Add vehicle markers to the map
     */
    function addVehicleMarkers() {
        const vehicles = VehicleData.getVehicles();
        vehicles.forEach(vehicle => {
            const isOnline = vehicle.status === 'online' || vehicle.status === 'available';
            const marker = L.marker(vehicle.coords, {
                icon: createVehicleIcon(isOnline, false)
            }).addTo(map);

            // Store reference
            vehicleMarkers[vehicle.id] = marker;

            // Add click handler
            marker.on('click', () => {
                selectVehicle(vehicle.id);
            });

            // Add tooltip
            marker.bindTooltip(vehicle.name, {
                permanent: false,
                direction: 'top',
                offset: [0, -40]
            });
        });
    }

    /**
     * Add incident markers to the map
     */
    function addIncidentMarkers() {
        const incidents = VehicleData.getIncidents();
        incidents.forEach(incident => {
            const marker = L.marker(incident.coords, {
                icon: createIncidentIcon(incident.priority)
            }).addTo(map);

            // Store reference
            incidentMarkers[incident.id] = marker;

            // Add click handler
            marker.on('click', () => {
                selectIncident(incident.id);
            });

            // Add tooltip
            marker.bindTooltip(incident.title, {
                permanent: false,
                direction: 'top',
                offset: [0, -20]
            });

            // Hide incident markers initially (vehicles sidebar is shown first)
            marker.setOpacity(0.3);
        });
    }

    /**
     * Select a vehicle and show popup
     */
    function selectVehicle(vehicleId) {
        const vehicle = VehicleData.getVehicle(vehicleId);
        if (!vehicle) return;

        // Clear path if selecting a different vehicle
        const currentState = State.getState();
        if (currentState.selectedVehicle && String(currentState.selectedVehicle) !== String(vehicleId)) {
            clearPath();
        }

        // Update state
        State.setState({
            selectedVehicle: vehicleId,
            selectedIncident: null,
            bottomBar: null
        });

        // Update marker icons
        Object.keys(vehicleMarkers).forEach(id => {
            const v = VehicleData.getVehicle(id);
            if (!v) return;
            const isSelected = String(id) === String(vehicleId);
            const isOnline = v.status === 'online' || v.status === 'available';
            vehicleMarkers[id].setIcon(createVehicleIcon(isOnline, isSelected));
        });

        // Pan to vehicle
        map.panTo(vehicle.coords);

        // Update and show popup
        updateVehiclePopup(vehicle);
    }

    /**
     * Select an incident and show dispatch panel
     */
    function selectIncident(incidentId) {
        const incident = VehicleData.getIncident(incidentId);
        if (!incident) return;

        // Don't open dispatch panel for closed incidents
        if (incident.incidentStatusId === 3 || incident.status === 'Closed' || incident.incidentStatusName === 'Closed') {
            console.log('Incident is closed, not opening dispatch panel');
            return;
        }

        // When opening bottom bar and both would overlap, close sidebar
        const currentState = State.getState();
        const stateUpdate = {
            selectedIncident: incidentId,
            selectedVehicle: null,
            bottomBar: 'dispatch'
        };

        const closingSidebar = window.wouldOverlap && window.wouldOverlap() && currentState.activeSidebar;
        if (closingSidebar) {
            stateUpdate.activeSidebar = null;
        }

        State.setState(stateUpdate);

        // If we closed sidebar, explicitly resize map after animation
        if (closingSidebar) {
            setTimeout(() => {
                if (map) map.invalidateSize({ pan: false });
            }, 350);
        }

        // Pan to incident
        map.panTo(incident.coords);

        // Update dispatch panel
        updateDispatchPanel(incident);
    }

    /**
     * Update the vehicle popup with vehicle data
     */
    function updateVehiclePopup(vehicle) {
        const popup = document.getElementById('vehicle-popup');

        // Remove docked class to reset position
        popup.classList.remove('vehicle-popup--docked');

        document.getElementById('popup-vehicle-name').textContent = vehicle.name;
        document.getElementById('popup-vehicle-id').textContent = vehicle.licensePlate || `VH-${String(vehicle.id).padStart(3, '0')}`;
        document.getElementById('popup-speed').textContent = vehicle.speed + ' km/h';
        document.getElementById('popup-driver').textContent = vehicle.driver || 'Unassigned';
        document.getElementById('popup-update').textContent = vehicle.lastUpdate || '--';

        // Update status indicator
        const statusDot = document.getElementById('popup-status-dot');
        if (statusDot) {
            statusDot.className = 'vehicle-popup__status vehicle-popup__status--' + vehicle.status;
        }

        // Store the current vehicle for repositioning on map move
        currentPopup = vehicle;

        // Position and show popup
        positionPopover(vehicle.coords);
        popup.classList.add('vehicle-popup--visible');
    }

    /**
     * Position the popover relative to vehicle marker
     */
    function positionPopover(coords) {
        const popup = document.getElementById('vehicle-popup');
        const mapContainer = document.getElementById('map');
        const mapRect = mapContainer.getBoundingClientRect();

        // Convert lat/lng to pixel position
        const point = map.latLngToContainerPoint(coords);

        // Get popup dimensions
        const popupWidth = popup.offsetWidth || 224;
        const popupHeight = popup.offsetHeight || 200;

        // Marker dimensions
        const markerHeight = 48;
        const markerWidth = 40;
        const gap = 12;
        const padding = 20;

        // Calculate position - prefer right side of marker
        let left = point.x + markerWidth / 2 + gap;
        let top = point.y - popupHeight / 2;

        // Check if popup would go off right edge - switch to left side
        if (left + popupWidth > mapRect.width - padding) {
            left = point.x - markerWidth / 2 - popupWidth - gap;
        }

        // Clamp horizontal position to stay within bounds
        if (left < padding) {
            left = padding;
        }
        if (left + popupWidth > mapRect.width - padding) {
            left = mapRect.width - popupWidth - padding;
        }

        // Clamp vertical position
        if (top < padding) {
            top = padding;
        }
        if (top + popupHeight > mapRect.height - padding) {
            top = mapRect.height - popupHeight - padding;
        }

        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    /**
     * Update popover position when map moves
     */
    function updatePopoverPosition() {
        if (currentPopup) {
            positionPopover(currentPopup.coords);
        }
    }

    /**
     * Update dispatch panel with incident data
     */
    function updateDispatchPanel(incident) {
        // Update header
        document.getElementById('dispatch-incident-id').textContent = `ID: ${incident.id}`;
        const incidentType = incident.type || 'Unknown';
        document.getElementById('dispatch-incident-type').textContent = incidentType.charAt(0).toUpperCase() + incidentType.slice(1);

        // Update details - use reverse geocoding if location is unknown but coords exist
        const locationEl = document.getElementById('dispatch-location');
        const hasValidLocation = incident.location && incident.location.trim() !== '' && incident.location !== 'Unknown location';

        if (hasValidLocation) {
            locationEl.textContent = incident.location;
        } else if (incident.coords && incident.coords.length >= 2) {
            // Show loading spinner
            locationEl.innerHTML = '<span class="location-loading"><span class="material-symbols-outlined icon-spin">progress_activity</span> Loading...</span>';
            reverseGeocode(incident.coords[0], incident.coords[1]).then(locationName => {
                locationEl.textContent = locationName;
            });
        } else {
            locationEl.textContent = 'Unknown location';
        }
        document.getElementById('dispatch-reported').textContent = incident.reportedAt || '2 hours ago';

        // Format priority text
        const priorityMap = { 'high': 'High Priority', 'medium': 'Medium Priority', 'low': 'Low Priority' };
        document.getElementById('dispatch-priority').textContent = priorityMap[incident.priority] || 'Unknown';
        const description = incident.description || incident.title || 'No description';
        document.getElementById('dispatch-comment').textContent = `"${description}"`;

        // Update header gradient based on priority
        const header = document.querySelector('.dispatch-panel__header');
        if (header) {
            header.classList.remove('dispatch-panel__header--high', 'dispatch-panel__header--medium', 'dispatch-panel__header--low');
            if (incident.priority) {
                header.classList.add(`dispatch-panel__header--${incident.priority}`);
            }
        }

        // Update header icon based on priority
        const headerIcon = document.querySelector('.dispatch-panel__icon');
        if (headerIcon) {
            headerIcon.classList.remove('dispatch-panel__icon--high', 'dispatch-panel__icon--medium', 'dispatch-panel__icon--low');
            if (incident.priority) {
                headerIcon.classList.add(`dispatch-panel__icon--${incident.priority}`);
            }
        }

        // Update priority indicator dot
        const priorityDot = document.getElementById('dispatch-priority-dot');
        if (priorityDot) {
            priorityDot.className = 'dispatch-details__priority';
            if (incident.priority === 'high') {
                priorityDot.classList.add('dispatch-details__priority--high');
            } else if (incident.priority === 'medium') {
                priorityDot.classList.add('dispatch-details__priority--medium');
            } else {
                priorityDot.classList.add('dispatch-details__priority--low');
            }
        }
    }

    /**
     * Hide vehicle popup
     */
    function hideVehiclePopup() {
        const popup = document.getElementById('vehicle-popup');
        popup.classList.remove('vehicle-popup--visible');
        currentPopup = null;
    }

    /**
     * Clear path
     */
    function clearPath() {
        if (currentPathLayer) {
            map.removeLayer(currentPathLayer);
            currentPathLayer = null;
        }

        if (pathStartMarker) {
            map.removeLayer(pathStartMarker);
            pathStartMarker = null;
        }

        if (pathEndMarker) {
            map.removeLayer(pathEndMarker);
            pathEndMarker = null;
        }
    }

    /**
     * Show the path/trail for a vehicle
     */
    async function showVehiclePath(vehicleId, limit = null) {
        // Clear any existing path
        clearPath();

        // Use provided limit or default
        const pointLimit = limit || pathPointLimit;

        try {
            // Get recent history for this vehicle
            const data = await HistoryAPI.getRecent(vehicleId, pointLimit);

            if (!data.trail || data.trail.length === 0) {
                console.log('No path data available for vehicle', vehicleId);
                return false;
            }

            // Convert trail to coordinates array
            const coords = data.trail
                .filter(p => p.latitude && p.longitude)
                .map(p => [p.latitude, p.longitude]);

            if (coords.length < 2) {
                return false;
            }

            // Create polyline
            currentPathLayer = L.polyline(coords, {
                color: '#155dfc',
                weight: 4,
                opacity: 0.8,
                smoothFactor: 1,
                lineJoin: 'round'
            }).addTo(map);

            // Add start marker (green)
            pathStartMarker = L.circleMarker(coords[0], {
                radius: 8,
                fillColor: '#16a34a',
                color: 'white',
                weight: 2,
                fillOpacity: 1
            }).addTo(map).bindTooltip('Start: ' + formatTimestamp(data.trail[0].timestamp), { permanent: false });

            // Add end marker (red)
            pathEndMarker = L.circleMarker(coords[coords.length - 1], {
                radius: 8,
                fillColor: '#dc2626',
                color: 'white',
                weight: 2,
                fillOpacity: 1
            }).addTo(map).bindTooltip('End: ' + formatTimestamp(data.trail[data.trail.length - 1].timestamp), { permanent: false });

            // Fit map to show the entire path
            map.fitBounds(currentPathLayer.getBounds(), { padding: [50, 50] });

            console.log(`Displayed path with ${coords.length} points for vehicle ${vehicleId}`);
            return true;
        } catch (error) {
            console.error('Failed to load vehicle path:', error);
            return false;
        }
    }

    /**
     * Set the path point limit
     */
    function setPathPointLimit(limit) {
        pathPointLimit = limit;
    }

    /**
     * Get the current path point limit
     */
    function getPathPointLimit() {
        return pathPointLimit;
    }

    /**
     * Clear the current path from the map
     */
    function clearPath() {
        if (currentPathLayer) {
            map.removeLayer(currentPathLayer);
            currentPathLayer = null;
        }
        if (pathStartMarker) {
            map.removeLayer(pathStartMarker);
            pathStartMarker = null;
        }
        if (pathEndMarker) {
            map.removeLayer(pathEndMarker);
            pathEndMarker = null;
        }
    }

    /**
     * Format timestamp for display
     */
    function formatTimestamp(ts) {
        if (!ts) return '';
        const date = new Date(ts);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Setup custom zoom controls
     */
    function setupZoomControls() {
        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            map.zoomIn();
        });

        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            map.zoomOut();
        });

        document.getElementById('btn-locate').addEventListener('click', () => {
            map.setView(KHALDA_CENTER, DEFAULT_ZOOM);
        });
    }

    /**
     * Handle state changes
     */
    function handleStateChange(state) {
        // Show/hide vehicle markers based on active sidebar
        const showVehicles = state.activeSidebar === 'vehicles' || state.activeSidebar === null;
        const showIncidents = state.activeSidebar === 'incidents' || state.activeSidebar === null;

        Object.values(vehicleMarkers).forEach(marker => {
            marker.setOpacity(showVehicles ? 1 : 0.3);
        });

        Object.values(incidentMarkers).forEach(marker => {
            marker.setOpacity(showIncidents ? 1 : 0.3);
        });

        // Hide popup if no vehicle selected
        if (!state.selectedVehicle) {
            hideVehiclePopup();
        }
    }

    /**
     * Update all markers from current VehicleData
     * Called after API data is loaded
     */
    function updateMarkers() {
        // Clear existing markers
        Object.values(vehicleMarkers).forEach(marker => map.removeLayer(marker));
        Object.values(incidentMarkers).forEach(marker => map.removeLayer(marker));
        vehicleMarkers = {};
        incidentMarkers = {};

        // Re-add markers from current data
        const vehicles = VehicleData.getVehicles();
        const incidents = VehicleData.getIncidents();

        vehicles.forEach(vehicle => {
            const isOnline = vehicle.status === 'online' || vehicle.status === 'available';
            const marker = L.marker(vehicle.coords, {
                icon: createVehicleIcon(isOnline, false)
            }).addTo(map);

            vehicleMarkers[vehicle.id] = marker;

            marker.on('click', () => {
                selectVehicle(vehicle.id);
            });

            marker.bindTooltip(vehicle.name, {
                permanent: false,
                direction: 'top',
                offset: [0, -40]
            });
        });

        incidents.forEach(incident => {
            // Don't show closed incidents
            if (incident.incidentStatusId === 3 || incident.status === 'Closed' || incident.incidentStatusName === 'Closed') {
                return;
            }

            const marker = L.marker(incident.coords, {
                icon: createIncidentIcon(incident.priority)
            }).addTo(map);

            incidentMarkers[incident.id] = marker;

            marker.on('click', () => {
                selectIncident(incident.id);
            });

            marker.bindTooltip(incident.title, {
                permanent: false,
                direction: 'top',
                offset: [0, -20]
            });

            marker.setOpacity(0.3);
        });

        console.log(`Updated ${vehicles.length} vehicle markers and ${incidents.length} incident markers`);
    }

    /**
     * Get the map instance
     */
    function getMap() {
        return map;
    }

    /**
     * Hide all vehicle markers (used during history playback)
     */
    function hideAllVehicleMarkers() {
        Object.values(vehicleMarkers).forEach(marker => {
            marker.setOpacity(0);
            marker.options.interactive = false;
        });
        Object.values(incidentMarkers).forEach(marker => {
            marker.setOpacity(0);
            marker.options.interactive = false;
        });
        console.log('All vehicle and incident markers hidden');
    }

    /**
     * Show all vehicle markers (restore after history playback)
     */
    function showAllVehicleMarkers() {
        const state = State.getState();
        const showVehicles = state.activeSidebar === 'vehicles' || state.activeSidebar === null;
        const showIncidents = state.activeSidebar === 'incidents' || state.activeSidebar === null;

        Object.values(vehicleMarkers).forEach(marker => {
            marker.setOpacity(showVehicles ? 1 : 0.3);
            marker.options.interactive = true;
        });
        Object.values(incidentMarkers).forEach(marker => {
            marker.setOpacity(showIncidents ? 1 : 0.3);
            marker.options.interactive = true;
        });
        console.log('All vehicle and incident markers restored');
    }

    /**
     * Update a single vehicle's position in real-time (SignalR)
     */
    // Animation state
    const activeAnimations = {};

    /**
     * Animate marker to new position over duration
     */
    function animateMarker(vehicleId, marker, startLatLng, endLatLng, duration) {
        // Cancel existing animation
        if (activeAnimations[vehicleId]) {
            cancelAnimationFrame(activeAnimations[vehicleId].frameId);
        }

        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out-quad)
            const ease = t => t * (2 - t);
            const t = ease(progress);

            const lat = startLatLng.lat + (endLatLng[0] - startLatLng.lat) * t;
            const lng = startLatLng.lng + (endLatLng[1] - startLatLng.lng) * t;

            marker.setLatLng([lat, lng]);

            if (progress < 1) {
                activeAnimations[vehicleId] = {
                    frameId: requestAnimationFrame(animate),
                    marker: marker
                };
            } else {
                delete activeAnimations[vehicleId];
            }
        }

        activeAnimations[vehicleId] = {
            frameId: requestAnimationFrame(animate),
            marker: marker
        };
    }

    /**
     * Update a single vehicle's position in real-time (SignalR)
     */
    function updateVehiclePosition(vehicleId, lat, lng, speed) {
        let marker = vehicleMarkers[vehicleId];

        // Fallback: try finding marker by string/int mismatch
        if (!marker) {
            const idStr = String(vehicleId);
            const foundId = Object.keys(vehicleMarkers).find(k => String(k) === idStr);
            if (foundId) marker = vehicleMarkers[foundId];
        }

        if (marker) {
            const currentLatLng = marker.getLatLng();
            const newLatLng = [lat, lng];

            // Only animate if distance is significant but not huge (avoid animation across world)
            const dist = map.distance(currentLatLng, newLatLng);
            if (dist > 5 && dist < 50000) {
                // Animate over 1 second
                animateMarker(vehicleId, marker, currentLatLng, newLatLng, 1000);
            } else {
                marker.setLatLng(newLatLng);
            }

            // Optionally update popup if this vehicle is selected
            const state = State.getState();
            if (state.selectedVehicle && String(state.selectedVehicle.id || state.selectedVehicle.vehicleId || state.selectedVehicle) === String(vehicleId)) {
                updatePopoverPosition();
            }
        } else {
            // Vehicle not on map yet, create marker
            // First, try to get vehicle data from state
            const vehicles = State.getState().vehicles || [];
            const vehicleData = vehicles.find(v => v.vehicleId === vehicleId);
            if (vehicleData) {
                vehicleData.latitude = lat;
                vehicleData.longitude = lng;
                vehicleData.currentSpeed = speed;

                const icon = createVehicleIcon(true, false);
                const newMarker = L.marker([lat, lng], { icon })
                    .addTo(map)
                    .on('click', () => selectVehicle(vehicleId));
                vehicleMarkers[vehicleId] = newMarker;
            }
        }
    }

    /**
     * Add a new incident marker in real-time (SignalR)
     */
    function addIncidentMarker(incident) {
        if (!incident.latitude || !incident.longitude) return;

        // Don't show closed incidents
        if (incident.incidentStatusId === 3) {
            // If marker exists, remove it
            if (incidentMarkers[incident.incidentId]) {
                map.removeLayer(incidentMarkers[incident.incidentId]);
                delete incidentMarkers[incident.incidentId];

                // If this is the currently selected incident, close the panel
                const state = State.getState();
                if (state.selectedIncident == incident.incidentId) {
                    State.setState({
                        selectedIncident: null,
                        bottomBar: null
                    });
                }
            }
            return;
        }

        // If marker exists, remove it first (to update icon/position or prevent duplicates)
        if (incidentMarkers[incident.incidentId]) {
            map.removeLayer(incidentMarkers[incident.incidentId]);
            delete incidentMarkers[incident.incidentId];
        }

        const icon = createIncidentIcon(incident.incidentPriorityId || 1);
        const marker = L.marker([incident.latitude, incident.longitude], { icon })
            .addTo(map)
            .on('click', () => selectIncident(incident.incidentId));

        incidentMarkers[incident.incidentId] = marker;
        // Don't auto-pan to new incident (user request)
        // map.setView([incident.latitude, incident.longitude], 15);
    }

    // Public API
    return {
        init,
        selectVehicle,
        selectIncident,
        hideVehiclePopup,
        updateMarkers,
        showVehiclePath,
        clearPath,
        setPathPointLimit,
        getPathPointLimit,
        getMap,
        hideAllVehicleMarkers,
        showAllVehicleMarkers,
        updateVehiclePosition,
        addIncidentMarker
    };
})();
