/**
 * Vehicle Tracker - State Management
 * Pure JavaScript state management for the application
 */

// Import API client (assuming loaded before this script)
// The API modules are loaded via script tag and available globally

const State = (function () {
    // Application state
    const state = {
        // Current view: 'live' or 'history'
        currentView: 'live',

        // Active sidebar: 'vehicles', 'incidents', or null
        activeSidebar: null,

        // Selected vehicle ID
        selectedVehicle: null,

        // Selected incident ID
        selectedIncident: null,

        // Bottom bar state: 'dispatch', 'history', or null
        bottomBar: null,

        // Map state
        map: {
            center: [31.9539, 35.8636], // Khalda, Amman
            zoom: 14
        },

        // History playback state
        historyPlayback: {
            playing: false,
            speed: 1,
            position: 0.35 // 0-1 representing timeline position
        },

        // Loading states
        loading: {
            vehicles: false,
            incidents: false,
            incidentPriorities: false
        },

        // Error states
        errors: {
            vehicles: null,
            incidents: null
        }
    };

    // Subscribers for state changes
    const subscribers = [];

    /**
     * Get current state (immutable copy)
     */
    function getState() {
        return JSON.parse(JSON.stringify(state));
    }

    /**
     * Update state and notify subscribers
     */
    function setState(updates) {
        // Deep merge updates into state
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && !Array.isArray(updates[key]) && updates[key] !== null) {
                state[key] = { ...state[key], ...updates[key] };
            } else {
                state[key] = updates[key];
            }
        });

        // Notify all subscribers
        subscribers.forEach(callback => callback(getState()));
    }

    /**
     * Subscribe to state changes
     */
    function subscribe(callback) {
        subscribers.push(callback);
        // Return unsubscribe function
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) subscribers.splice(index, 1);
        };
    }

    // Public API
    return {
        getState,
        setState,
        subscribe
    };
})();

/**
 * Vehicle Data Store
 * Manages all vehicle and incident data from API
 */
const VehicleData = (function () {
    // Data storage
    let vehicles = [];
    let drivers = [];
    let incidents = [];
    let incidentPriorities = [];
    let incidentStatuses = [];
    let vehicleStatuses = [];
    let liveTracking = [];

    // Subscribers for data changes
    const subscribers = [];

    /**
     * Notify all subscribers of data changes
     */
    function notifySubscribers() {
        subscribers.forEach(callback => callback({
            vehicles,
            drivers,
            incidents,
            incidentPriorities,
            incidentStatuses,
            vehicleStatuses,
            liveTracking
        }));
    }

    /**
     * Subscribe to data changes
     */
    function subscribe(callback) {
        subscribers.push(callback);
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) subscribers.splice(index, 1);
        };
    }

    /**
     * Load all drivers from API
     */
    async function loadDrivers() {
        try {
            const data = await window.DriversAPI.getAll();
            drivers = data;
            return drivers;
        } catch (error) {
            console.error('Failed to load drivers:', error);
            return [];
        }
    }

    /**
     * Load all vehicles from API
     */
    async function loadVehicles() {
        State.setState({ loading: { vehicles: true } });
        try {
            const data = await window.VehiclesAPI.getAll();
            vehicles = data.map(v => {
                // Find driver for this vehicle
                const driver = drivers.find(d => d.driverId === v.driverId);
                const driverName = driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned';

                return {
                    id: v.vehicleId,
                    name: `${v.make} ${v.model}`,
                    licensePlate: v.plateNumber,
                    make: v.make,
                    model: v.model,
                    color: v.color,
                    status: 'offline', // Will be updated by live tracking
                    driverId: v.driverId,
                    driver: driverName,
                    // Location will come from live tracking
                    location: 'Unknown',
                    coords: [31.9539, 35.8636], // Default coords (Khalda)
                    speed: 0,
                    lastUpdate: 'Unknown'
                };
            });
            State.setState({ loading: { vehicles: false }, errors: { vehicles: null } });
            notifySubscribers();
            return vehicles;
        } catch (error) {
            console.error('Failed to load vehicles:', error);
            State.setState({ loading: { vehicles: false }, errors: { vehicles: error.message } });
            return [];
        }
    }

    /**
     * Load live tracking data and merge with vehicles
     */
    async function loadLiveTracking() {
        try {
            const data = await window.LiveTrackingAPI.getAll();
            liveTracking = data;

            // Merge with vehicles
            data.forEach(track => {
                const vehicle = vehicles.find(v => v.id === track.vehicleId);
                if (vehicle) {
                    if (track.latitude && track.longitude) {
                        vehicle.coords = [track.latitude, track.longitude];
                    }
                    vehicle.speed = Math.round(track.currentSpeed || 0);
                    vehicle.status = 'online'; // If we have tracking data, vehicle is online
                    vehicle.location = 'Live tracking';
                    vehicle.lastUpdate = 'Just now';
                }
            });

            notifySubscribers();
            return liveTracking;
        } catch (error) {
            console.error('Failed to load live tracking:', error);
            return [];
        }
    }

    /**
     * Load all incidents from API
     */
    async function loadIncidents() {
        State.setState({ loading: { incidents: true } });
        try {
            const data = await window.IncidentsAPI.getAll();
            incidents = data.map(i => ({
                id: i.incidentId,
                incidentStatusId: i.incidentStatusId,
                priority: i.incidentPriorityName?.toLowerCase() || 'low',
                priorityName: i.incidentPriorityName || 'Low',
                status: i.incidentStatusName?.toLowerCase() || 'open',
                statusName: i.incidentStatusName || 'Open',
                title: i.title || `Incident ${i.incidentId}`,
                description: i.description || '',
                location: i.locationName || 'Unknown location',
                coords: i.latitude && i.longitude ? [i.latitude, i.longitude] : [31.9539, 35.8636],
                reportedAt: formatTimeAgo(i.createdAt),
                assignedTo: i.assignedTo,
                assignedVehiclePlate: i.assignedVehiclePlate,
                createdAt: i.createdAt
            }));
            State.setState({ loading: { incidents: false }, errors: { incidents: null } });
            notifySubscribers();
            return incidents;
        } catch (error) {
            console.error('Failed to load incidents:', error);
            State.setState({ loading: { incidents: false }, errors: { incidents: error.message } });
            return [];
        }
    }

    /**
     * Load incident priorities from API
     */
    async function loadIncidentPriorities() {
        try {
            const data = await window.IncidentPrioritiesAPI.getAll();
            incidentPriorities = data;
            notifySubscribers();
            return incidentPriorities;
        } catch (error) {
            console.error('Failed to load incident priorities:', error);
            return [];
        }
    }

    /**
     * Load incident statuses from API
     */
    async function loadIncidentStatuses() {
        try {
            const data = await window.IncidentStatusesAPI.getAll();
            incidentStatuses = data;
            notifySubscribers();
            return incidentStatuses;
        } catch (error) {
            console.error('Failed to load incident statuses:', error);
            return [];
        }
    }

    /**
     * Load vehicle statuses from API
     */
    async function loadVehicleStatuses() {
        try {
            const data = await window.VehicleStatusesAPI.getAll();
            vehicleStatuses = data;
            notifySubscribers();
            return vehicleStatuses;
        } catch (error) {
            console.error('Failed to load vehicle statuses:', error);
            return [];
        }
    }

    /**
     * Load all data from API
     */
    async function loadAll() {
        // Load drivers first since vehicles need them
        await loadDrivers();

        await Promise.all([
            loadVehicles(),
            loadIncidents(),
            loadIncidentPriorities(),
            loadIncidentStatuses(),
            loadVehicleStatuses()
        ]);
        // Load live tracking after vehicles are loaded
        await loadLiveTracking();
    }

    /**
     * Report a new incident
     */
    async function reportIncident(incidentData) {
        try {
            const result = await window.IncidentsAPI.report(incidentData);
            await loadIncidents(); // Reload incidents
            return result;
        } catch (error) {
            console.error('Failed to report incident:', error);
            throw error;
        }
    }

    /**
     * Assign a vehicle to an incident
     */
    async function assignIncident(incidentId, vehicleId, statusId) {
        try {
            const result = await window.IncidentsAPI.assignVehicle(incidentId, vehicleId, statusId);
            await loadIncidents(); // Reload incidents to update status
            return result;
        } catch (error) {
            console.error('Failed to assign incident:', error);
            throw error;
        }
    }

    /**
     * Get nearest vehicles to an incident
     */
    /**
     * Get nearest vehicles to an incident using OSRM for real routing
     */
    async function getNearestVehicles(incidentId) {
        try {
            const incident = getIncident(incidentId);
            if (!incident || !incident.coords || incident.coords.length < 2) {
                // Fallback if incident layout invalid
                return await apiFetch(`/incidents/${incidentId}/nearest-vehicles`);
            }
            const incidentLat = incident.coords[0];
            const incidentLon = incident.coords[1];

            const allVehicles = getVehicles();
            // Filter only vehicles with valid location
            const candidateVehicles = allVehicles.filter(v =>
                v.coords && v.coords.length >= 2 &&
                (v.status === 'available' || v.status === 'online')
            );

            // Limit to closer vehicles straight-line first to avoid spamming API?
            // For now, just take top 10 closest by straight line, then route them.
            // Or just route all (assuming small fleet). User said "make 4 new cars", so fleet is small.

            // Parallel fetch from OSRM
            const routingPromises = candidateVehicles.map(async vehicle => {
                try {
                    // OSRM expects: longitude,latitude
                    const vLat = vehicle.coords[0];
                    const vLon = vehicle.coords[1];
                    const url = `https://router.project-osrm.org/route/v1/driving/${vLon},${vLat};${incidentLon},${incidentLat}`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error('OSRM error');
                    const data = await response.json();

                    if (data.routes && data.routes.length > 0) {
                        return {
                            ...vehicle,
                            distanceMeters: data.routes[0].distance,
                            durationSeconds: data.routes[0].duration
                        };
                    }
                } catch (e) {
                    console.warn(`Routing failed for vehicle ${vehicle.id}`, e);
                }
                return { ...vehicle, distanceMeters: null, durationSeconds: null };
            });

            let routedVehicles = await Promise.all(routingPromises);

            // Filter out failures if necessary, or keep them with nulls
            // Sort by duration (fastest first)
            routedVehicles.sort((a, b) => {
                if (a.durationSeconds === null) return 1;
                if (b.durationSeconds === null) return -1;
                return a.durationSeconds - b.durationSeconds;
            });

            // Map to expected format
            return routedVehicles.map(v => ({
                vehicleId: v.id,
                make: v.make,
                model: v.model,
                plateNumber: v.licensePlate || v.plateNumber, // Handle legacy property name if needed
                distanceMeters: v.distanceMeters,
                durationSeconds: v.durationSeconds,
                driverName: v.driver || (v.currentDriver ? `${v.currentDriver.firstName} ${v.currentDriver.lastName}` : 'Unassigned')
            }));

        } catch (error) {
            console.error('Failed to calculate nearest vehicles:', error);
            // Fallback to backend API
            return await apiFetch(`/incidents/${incidentId}/nearest-vehicles`);
        }
    }

    /**
     * Get vehicle by ID
     */
    function getVehicle(id) {
        return vehicles.find(v => v.id === id || v.id === parseInt(id));
    }

    /**
     * Get incident by ID
     */
    function getIncident(id) {
        return incidents.find(i => i.id === id || i.id === parseInt(id));
    }

    /**
     * Get all vehicles
     */
    function getVehicles() {
        return [...vehicles];
    }

    /**
     * Get all incidents
     */
    function getIncidents() {
        return [...incidents];
    }

    /**
     * Get incident types
     */
    function getIncidentPriorities() {
        return [...incidentPriorities];
    }

    /**
     * Format timestamp to "X ago" format
     */
    function formatTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';

        const now = new Date();
        const date = new Date(timestamp);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    // Public API
    return {
        subscribe,
        loadAll,
        loadVehicles,
        loadIncidents,
        loadLiveTracking,
        loadIncidentPriorities,
        loadIncidentStatuses,
        loadVehicleStatuses,
        reportIncident,
        assignIncident,
        getNearestVehicles,
        getVehicle,
        getIncident,
        getVehicles,
        getIncidents,
        getIncidentPriorities
    };
})();
