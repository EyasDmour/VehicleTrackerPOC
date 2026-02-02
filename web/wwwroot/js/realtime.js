/**
 * SignalR Real-Time Module
 * Handles WebSocket connections for live updates
 */
const RealTimeModule = (function () {
    let connection = null;
    let isConnected = false;

    /**
     * Initialize SignalR connection
     */
    function init() {
        // Build the hub URL
        const hubUrl = '/eventsHub';

        connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Event handlers
        connection.on("ReceiveLocationUpdate", handleLocationUpdate);
        connection.on("ReceiveNewIncident", handleNewIncident);
        connection.on("ReceiveIncidentUpdate", handleIncidentUpdate);

        // Connection lifecycle
        connection.onreconnecting((error) => {
            console.warn('SignalR reconnecting...', error);
            isConnected = false;
        });

        connection.onreconnected((connectionId) => {
            console.log('SignalR reconnected:', connectionId);
            isConnected = true;
        });

        connection.onclose((error) => {
            console.error('SignalR connection closed:', error);
            isConnected = false;
        });

        // Start connection
        startConnection();
    }

    async function startConnection() {
        try {
            await connection.start();
            console.log('SignalR connected!');
            isConnected = true;
        } catch (err) {
            console.error('SignalR connection failed:', err);
            // Retry after 5 seconds
            setTimeout(startConnection, 5000);
        }
    }

    /**
     * Handle real-time vehicle location update
     */
    function handleLocationUpdate(data) {
        console.log('Received location update:', data);

        // Normalize data keys (handle PascalCase from C#)
        const vehicleId = data.vehicleId || data.VehicleId;
        const latitude = data.latitude || data.Latitude;
        const longitude = data.longitude || data.Longitude;
        const speed = data.currentSpeed || data.CurrentSpeed || data.speed;

        if (MapModule && typeof MapModule.updateVehiclePosition === 'function') {
            MapModule.updateVehiclePosition(vehicleId, latitude, longitude, speed);
        }

        // Update vehicle list if visible
        if (typeof refreshVehicles === 'function') {
            // Optional: Debounce this to avoid too many refreshes
        }
    }

    /**
     * Handle new incident notification
     */
    function handleNewIncident(data) {
        console.log('Received new incident:', data);
        processIncidentData(data, true);
    }

    /**
     * Handle updated incident notification
     */
    function handleIncidentUpdate(data) {
        console.log('Received incident update:', data);
        processIncidentData(data, false);
    }

    /**
     * Process incident data for map/list updates
     */
    function processIncidentData(data, isNew) {
        // Normalize incident data
        const incident = {
            incidentId: data.incidentId || data.IncidentId,
            incidentStatusId: data.incidentStatusId || data.IncidentStatusId,
            latitude: data.latitude || data.Latitude,
            longitude: data.longitude || data.Longitude,
            incidentPriorityId: data.incidentPriorityId || data.IncidentPriorityId,
            title: data.title || data.Title,
            description: data.description || data.Description
        };

        // 1. Update/Add/Remove marker on map
        // If map module has specific update function, use it, otherwise use addIncidentMarker
        // which now handles removal if closed
        if (MapModule && typeof MapModule.addIncidentMarker === 'function') {
            MapModule.addIncidentMarker(incident);
        }

        // 2 & 3. Flash tab and show toast ONLY if it's a NEW incident
        if (isNew) {
            flashIncidentTab();
            showIncidentToast(incident);
        }

        // 4. Refresh incident list
        // Always refresh so the count and list are up to date when the user switches tabs
        if (typeof VehicleData !== 'undefined' && typeof VehicleData.loadIncidents === 'function') {
            VehicleData.loadIncidents();
        } else if (typeof refreshIncidents === 'function') {
            // Fallback for legacy global function if it exists
            refreshIncidents();
        }
    }

    /**
     * Flash the incidents tab to draw attention
     */
    function flashIncidentTab() {
        const incidentTab = document.querySelector('[data-tab="incidents"]');
        if (incidentTab) {
            incidentTab.classList.add('flash-alert');
            setTimeout(() => {
                incidentTab.classList.remove('flash-alert');
            }, 5000);
        }
    }

    /**
     * Show a toast notification for new incident
     */
    function showIncidentToast(data) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'incident-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="material-symbols-outlined">warning</span>
                <div class="toast-text">
                    <strong>New Incident</strong>
                    <span>${data.title || 'New incident reported'}</span>
                </div>
            </div>
        `;

        document.body.appendChild(toast);

        // Click to locate
        toast.addEventListener('click', () => {
            if (MapModule && typeof MapModule.getMap === 'function') {
                const map = MapModule.getMap();
                if (map && data.latitude && data.longitude) {
                    map.setView([data.latitude, data.longitude], 16);
                    if (typeof MapModule.selectIncident === 'function') {
                        MapModule.selectIncident(data.incidentId);
                    }
                }
            }
        });

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    return {
        init,
        isConnected: () => isConnected
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Small delay to ensure other modules are loaded
    setTimeout(() => {
        RealTimeModule.init();
    }, 500);
});
