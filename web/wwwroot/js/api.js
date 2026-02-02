/**
 * API Client for VehicleTracker
 * Handles all communication with the backend API
 */

const API_BASE_URL = '/api';

// Token management
const TokenManager = {
    TOKEN_KEY: 'vehicletracker_token',
    USER_KEY: 'vehicletracker_user',

    getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    },

    getUser() {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    setUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    clear() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
    },

    isAuthenticated() {
        return !!this.getToken();
    }
};

// Base fetch wrapper with auth headers
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = TokenManager.getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle 401 - unauthorized
    if (response.status === 401) {
        TokenManager.clear();
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    return data;
}

// ============================================================================
// Auth API
// ============================================================================
const AuthAPI = {
    async login(username, password) {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (data.token) {
            TokenManager.setToken(data.token);
            TokenManager.setUser({
                userId: data.userId,
                username: data.username,
                email: data.email,
                fullName: data.fullName,
                role: data.role
            });
        }
        
        return data;
    },

    async logout() {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } finally {
            TokenManager.clear();
        }
    },

    async me() {
        return apiFetch('/auth/me');
    },

    async register(userData) {
        return apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async changePassword(currentPassword, newPassword) {
        return apiFetch('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    },

    isAuthenticated() {
        return TokenManager.isAuthenticated();
    },

    getUser() {
        return TokenManager.getUser();
    }
};

// ============================================================================
// Vehicles API
// ============================================================================
const VehiclesAPI = {
    async getAll() {
        return apiFetch('/vehicles');
    },

    async getById(id) {
        return apiFetch(`/vehicles/${id}`);
    },

    async create(vehicle) {
        return apiFetch('/vehicles', {
            method: 'POST',
            body: JSON.stringify(vehicle)
        });
    },

    async update(id, vehicle) {
        return apiFetch(`/vehicles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(vehicle)
        });
    },

    async delete(id) {
        return apiFetch(`/vehicles/${id}`, {
            method: 'DELETE'
        });
    },

    async updateStatus(id, statusId) {
        return apiFetch(`/vehicles/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ statusId })
        });
    }
};

// ============================================================================
// Drivers API
// ============================================================================
const DriversAPI = {
    async getAll() {
        return apiFetch('/drivers');
    },

    async getById(id) {
        return apiFetch(`/drivers/${id}`);
    },

    async create(driver) {
        return apiFetch('/drivers', {
            method: 'POST',
            body: JSON.stringify(driver)
        });
    },

    async update(id, driver) {
        return apiFetch(`/drivers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(driver)
        });
    },

    async delete(id) {
        return apiFetch(`/drivers/${id}`, {
            method: 'DELETE'
        });
    }
};

// ============================================================================
// Incidents API
// ============================================================================
const IncidentsAPI = {
    async getAll() {
        return apiFetch('/incidents');
    },

    async getById(id) {
        return apiFetch(`/incidents/${id}`);
    },

    async report(incident) {
        return apiFetch('/incidents', {
            method: 'POST',
            body: JSON.stringify(incident)
        });
    },

    async update(id, data) {
        return apiFetch(`/incidents/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async close(id) {
        // Status ID 3 = "Closed"
        return apiFetch(`/incidents/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ incidentStatusId: 3 })
        });
    },

    async assignVehicle(incidentId, vehicleId, statusId = null) {
        const body = { vehicleId };
        if (statusId) body.statusId = statusId;
        return apiFetch(`/incidents/${incidentId}/assign`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
};

// ============================================================================
// Incident Types API
// ============================================================================
const IncidentTypesAPI = {
    async getAll() {
        return apiFetch('/incidenttypes');
    },

    async getById(id) {
        return apiFetch(`/incidenttypes/${id}`);
    }
};

// ============================================================================
// Incident Statuses API
// ============================================================================
const IncidentStatusesAPI = {
    async getAll() {
        return apiFetch('/incidentstatuses');
    },

    async getById(id) {
        return apiFetch(`/incidentstatuses/${id}`);
    }
};

// ============================================================================
// Incident Priorities API
// ============================================================================
const IncidentPrioritiesAPI = {
    async getAll() {
        return apiFetch('/incidentpriorities');
    },

    async getById(id) {
        return apiFetch(`/incidentpriorities/${id}`);
    }
};

// ============================================================================
// Vehicle Statuses API
// ============================================================================
const VehicleStatusesAPI = {
    async getAll() {
        return apiFetch('/vehiclestatuses');
    },

    async getById(id) {
        return apiFetch(`/vehiclestatuses/${id}`);
    }
};

// ============================================================================
// Live Tracking API
// ============================================================================
const LiveTrackingAPI = {
    async getAll() {
        return apiFetch('/livetracking');
    },

    async getByVehicleId(vehicleId) {
        return apiFetch(`/livetracking/${vehicleId}`);
    },

    async update(vehicleId, data) {
        return apiFetch(`/livetracking/${vehicleId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
};

// ============================================================================
// History API
// ============================================================================
const HistoryAPI = {
    async getToday(vehicleId) {
        return apiFetch(`/history/vehicles/${vehicleId}/today`);
    },

    async getRange(vehicleId, from, to) {
        const params = new URLSearchParams();
        params.append('from', from);
        params.append('to', to);
        return apiFetch(`/history/vehicles/${vehicleId}/range?${params.toString()}`);
    },

    async getAll(vehicleId) {
        // Get all history by using a wide date range
        const from = '2020-01-01T00:00:00Z';
        const to = new Date().toISOString();
        return this.getRange(vehicleId, from, to);
    },

    async getRecent(vehicleId, limit = 100) {
        // Get all history then return the most recent N points
        const data = await this.getAll(vehicleId);
        if (data.trail && data.trail.length > limit) {
            // Take the most recent points (last N in the array since ordered by timestamp)
            data.trail = data.trail.slice(-limit);
            data.pointCount = data.trail.length;
        }
        return data;
    }
};

// ============================================================================
// Export all APIs (as window globals for non-module scripts)
// ============================================================================
window.TokenManager = TokenManager;
window.AuthAPI = AuthAPI;
window.VehiclesAPI = VehiclesAPI;
window.DriversAPI = DriversAPI;
window.IncidentsAPI = IncidentsAPI;
window.IncidentTypesAPI = IncidentTypesAPI;
window.IncidentStatusesAPI = IncidentStatusesAPI;
window.IncidentPrioritiesAPI = IncidentPrioritiesAPI;
window.VehicleStatusesAPI = VehicleStatusesAPI;
window.LiveTrackingAPI = LiveTrackingAPI;
window.HistoryAPI = HistoryAPI;
