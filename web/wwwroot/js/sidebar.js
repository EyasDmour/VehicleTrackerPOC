/**
 * Vehicle Tracker - Sidebar Module
 * Handles sidebar visibility, rendering, and interactions
 */

const SidebarModule = (function () {

    // Track expanded vehicle card and its date range state
    let expandedVehicleId = null;
    let expandedVehicleRange = {
        start: null,
        end: null,
        preset: '24' // Default to last 24 hours
    };

    // Bootstrap Offcanvas instances
    let vehiclesOffcanvas = null;
    let incidentsOffcanvas = null;

    /**
     * Initialize sidebar module
     */
    function init() {
        // Init Bootstrap Offcanvas instances
        const vehiclesEl = document.getElementById('vehicles-sidebar');
        if (vehiclesEl) {
            vehiclesOffcanvas = new bootstrap.Offcanvas(vehiclesEl);
            vehiclesEl.addEventListener('hidden.bs.offcanvas', () => {
                if (State.getState().activeSidebar === 'vehicles') {
                    // Check if history player is open - if so, don't clear selection
                    const state = State.getState();
                    if (!state.bottomBar || state.bottomBar !== 'history') {
                        State.setState({ activeSidebar: null, selectedVehicle: null });
                        MapModule.hideVehiclePopup();
                        MapModule.clearPath();
                    } else {
                        State.setState({ activeSidebar: null });
                    }
                }
            });
        }

        const incidentsEl = document.getElementById('incidents-sidebar');
        if (incidentsEl) {
            incidentsOffcanvas = new bootstrap.Offcanvas(incidentsEl);
            incidentsEl.addEventListener('hidden.bs.offcanvas', () => {
                if (State.getState().activeSidebar === 'incidents') {
                    if (State.getState().activeSidebar === 'incidents') { // Check again to be safe
                        // Special case: Incidents sidebar closing might need cleanup?
                        // The toggle handler already does cleanup when switching away.
                        // But if closed via X button, we need to replicate that cleanup.
                        // The existing toggle handler does: MapModule.clearPath(), hideVehiclePopup(), HistoryPlayback.stop().
                        // We should probably centralize that cleanup in State listener or here.
                        // For now, let's just null the state, and let handleStateChange do what it can.
                        // But cleanup usually happens BEFORE state change or AS state change.

                        // Fix: Trigger State Update to null
                        State.setState({ activeSidebar: null });
                    }
                }
            });
        }

        // Setup sidebar toggle buttons
        setupSidebarToggles();

        // Subscribe to state changes
        State.subscribe(handleStateChange);

        // Subscribe to data changes to re-render sidebars
        VehicleData.subscribe(handleDataChange);

        console.log('Sidebar module initialized');
    }

    /**
     * Setup sidebar toggle buttons
     */
    function setupSidebarToggles() {
        const btnVehicles = document.getElementById('btn-vehicles');
        const btnIncidents = document.getElementById('btn-incidents');

        if (btnVehicles) {
            btnVehicles.addEventListener('click', () => {
                const currentState = State.getState();
                const newSidebar = currentState.activeSidebar === 'vehicles' ? null : 'vehicles';

                // When opening sidebar and both would overlap, close bottom bar
                if (newSidebar && window.wouldOverlap && window.wouldOverlap() && currentState.bottomBar) {
                    State.setState({ activeSidebar: newSidebar, bottomBar: null });
                    // Explicitly resize map after bar closes
                    setTimeout(() => {
                        const map = MapModule.getMap();
                        if (map) map.invalidateSize({ pan: false });
                    }, 350);
                } else {
                    State.setState({ activeSidebar: newSidebar });
                }
            });
        }

        if (btnIncidents) {
            btnIncidents.addEventListener('click', () => {
                const currentState = State.getState();
                const newSidebar = currentState.activeSidebar === 'incidents' ? null : 'incidents';

                // Clear vehicle selection and path when switching to incidents
                if (newSidebar === 'incidents') {
                    MapModule.clearPath();
                    MapModule.hideVehiclePopup();

                    // Also clear history playback visualization ONLY if we're not in history mode
                    const map = MapModule.getMap();
                    if (map && typeof HistoryPlayback !== 'undefined' && currentState.bottomBar !== 'history') {
                        HistoryPlayback.stop();
                        HistoryPlayback.clearVisualization(map);
                    }

                    // When opening sidebar and both would overlap, close bottom bar
                    if (window.wouldOverlap && window.wouldOverlap() && currentState.bottomBar) {
                        State.setState({ activeSidebar: newSidebar, selectedVehicle: null, bottomBar: null });
                        // Explicitly resize map after bar closes
                        setTimeout(() => {
                            const mapInstance = MapModule.getMap();
                            if (mapInstance) mapInstance.invalidateSize({ pan: false });
                        }, 350);
                    } else {
                        State.setState({ activeSidebar: newSidebar, selectedVehicle: null });
                    }
                } else {
                    State.setState({ activeSidebar: newSidebar });
                }
            });
        }
    }

    /**
     * Render vehicle cards in the sidebar
     */
    function renderVehicleList(vehicles) {
        const vehicleList = document.querySelector('#vehicles-sidebar .vehicle-list');
        if (!vehicleList) return;

        const currentState = State.getState();

        // Update subtitle count
        const subtitle = document.querySelector('#vehicles-sidebar .sidebar__subtitle');
        if (subtitle) {
            const onlineCount = vehicles.filter(v => v.status === 'online' || v.status === 'available').length;
            subtitle.textContent = `${onlineCount} available`;
        }

        // Generate HTML for all vehicles
        vehicleList.innerHTML = vehicles.map(vehicle => {
            const isSelected = currentState.selectedVehicle === vehicle.id || currentState.selectedVehicle === `VH-${vehicle.id}`;
            const isExpanded = expandedVehicleId === vehicle.id || expandedVehicleId === `VH-${vehicle.id}`;
            const statusClass = (vehicle.status === 'online' || vehicle.status === 'available') ? 'online' : 'offline';

            return `
                <div class="vehicle-card ${isSelected ? 'vehicle-card--selected' : ''} ${isExpanded ? 'vehicle-card--expanded' : ''}" data-vehicle-id="${vehicle.id}">
                    <div class="vehicle-card__header" data-expand-toggle>
                        <div class="vehicle-card__main">
                            <div class="vehicle-card__icon">
                                <span class="material-symbols-outlined icon-md">directions_car</span>
                            </div>
                            <div class="vehicle-card__info">
                                <span class="vehicle-card__name">
                                    ${escapeHtml(vehicle.name)}
                                    <span class="vehicle-card__status vehicle-card__status--${statusClass}"></span>
                                </span>
                                <span class="vehicle-card__id">${vehicle.licensePlate || `VH-${String(vehicle.id).padStart(3, '0')}`}</span>
                                <span class="vehicle-card__location">${escapeHtml(vehicle.location)}</span>
                            </div>
                        </div>
                        <span class="material-symbols-outlined vehicle-card__chevron">chevron_right</span>
                    </div>
                    
                    <!-- Expanded Stats Section -->
                    <div class="vehicle-card__expanded">
                        <div class="vehicle-stats__range-controls">
                            <button class="vehicle-stats__nav-btn" data-action="prev-day" title="Previous Day">
                                <span class="material-symbols-outlined icon-sm">chevron_left</span>
                            </button>
                            <button class="vehicle-stats__nav-btn" data-action="extend-start" title="Extend Start">
                                <span class="material-symbols-outlined icon-sm">first_page</span>
                            </button>
                            <button class="vehicle-stats__range-btn" data-action="pick-range">
                                <span class="material-symbols-outlined icon-xs">calendar_today</span>
                                <span class="vehicle-stats__range-label">Last 24h</span>
                            </button>
                            <button class="vehicle-stats__nav-btn" data-action="extend-end" title="Extend End">
                                <span class="material-symbols-outlined icon-sm">last_page</span>
                            </button>
                            <button class="vehicle-stats__nav-btn" data-action="next-day" title="Next Day">
                                <span class="material-symbols-outlined icon-sm">chevron_right</span>
                            </button>
                        </div>
                        
                        <div class="vehicle-stats__graph-container">
                            <div class="vehicle-stats__graph-scroll">
                                <div class="vehicle-stats__graph" data-vehicle-graph="${vehicle.id}">
                                    <canvas class="vehicle-stats__graph-canvas"></canvas>
                                </div>
                            </div>
                            <div class="vehicle-stats__loading">
                                <span class="material-symbols-outlined">progress_activity</span>
                            </div>
                            <div class="vehicle-stats__empty">
                                <span class="material-symbols-outlined icon-md">show_chart</span>
                                <span class="vehicle-stats__empty-text">No data for this period</span>
                            </div>
                        </div>
                        
                        <div class="vehicle-stats__graph-labels">
                            <span>--:--</span>
                            <span>--:--</span>
                        </div>
                        
                        <div class="vehicle-stats__summary">
                            <div class="vehicle-stats__item">
                                <span class="vehicle-stats__value" data-stat="max-speed">--</span>
                                <span class="vehicle-stats__label">Max km/h</span>
                            </div>
                            <div class="vehicle-stats__item">
                                <span class="vehicle-stats__value" data-stat="avg-speed">--</span>
                                <span class="vehicle-stats__label">Avg km/h</span>
                            </div>
                            <div class="vehicle-stats__item">
                                <span class="vehicle-stats__value" data-stat="distance">--</span>
                                <span class="vehicle-stats__label">km</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Re-attach click handlers
        setupVehicleCards();
    }

    /**
     * Render incident cards in the sidebar
     */
    function renderIncidentList(incidents) {
        const incidentList = document.querySelector('#incidents-sidebar .incident-list');
        if (!incidentList) return;

        const currentState = State.getState();

        // Split incidents into active and closed
        const activeIncidents = incidents.filter(i => {
            const status = (i.incidentStatusName || i.statusName || i.status || 'Unknown').toLowerCase();
            return status !== 'closed' && status !== 'resolved' && status !== 'cancelled';
        });
        const closedIncidents = incidents.filter(i => {
            const status = (i.incidentStatusName || i.statusName || i.status || 'Unknown').toLowerCase();
            return status === 'closed' || status === 'resolved' || status === 'cancelled';
        });

        // Update subtitle count
        const subtitle = document.querySelector('#incidents-sidebar .sidebar__subtitle');
        if (subtitle) {
            subtitle.textContent = `${activeIncidents.length} active`;
        }

        // Helper to render a single incident card
        const renderCard = (incident) => {
            const incidentId = incident.incidentId || incident.id;
            const isSelected = currentState.selectedIncident === incidentId || currentState.selectedIncident === `INC-${incidentId}`;
            const statusName = incident.incidentStatusName || incident.status || 'Unknown';
            const priorityName = incident.incidentPriorityName || incident.priority || 'medium';
            const priorityClass = priorityName.toLowerCase();
            const reportedTime = incident.createdAt ? new Date(incident.createdAt).toLocaleString() : (incident.reportedAt || '--');

            return `
                <div class="incident-card ${isSelected ? 'incident-card--selected' : ''}" data-incident-id="${incidentId}">
                    <div class="incident-card__header">
                        <div class="incident-card__tags">
                            <span class="incident-card__tag incident-card__tag--${statusName.toLowerCase()}">${escapeHtml(statusName)}</span>
                        </div>
                        <span class="incident-card__time">${escapeHtml(reportedTime)}</span>
                    </div>
                    <h3 class="incident-card__title">${escapeHtml(incident.title)}</h3>
                    <p class="incident-card__desc">${escapeHtml(incident.description || '')}</p>
                    <div class="incident-card__footer">
                        <span class="incident-card__priority">
                            <span class="incident-card__priority-dot incident-card__priority-dot--${priorityClass}"></span>
                            ${capitalizeFirst(priorityName)} Priority
                        </span>
                        <span class="incident-card__id">INC-${String(incidentId).padStart(3, '0')}</span>
                    </div>
                </div>
            `;
        };

        // Build HTML: Active incidents first, then collapsible closed section
        let html = activeIncidents.map(renderCard).join('');

        if (closedIncidents.length > 0) {
            html += `
                <div class="closed-incidents-separator" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('collapsed');">
                    <span class="material-symbols-outlined closed-incidents-separator__icon">expand_more</span>
                    <span>Closed Incidents (${closedIncidents.length})</span>
                </div>
                <div class="closed-incidents-list collapsed">
                    ${closedIncidents.map(renderCard).join('')}
                </div>
            `;
        }

        incidentList.innerHTML = html;

        // Re-attach click handlers
        setupIncidentCards();
    }

    /**
     * Get CSS class for incident type
     */
    function getIncidentTypeClass(type) {
        const typeMap = {
            'accident': 'hazard',
            'breakdown': 'closure',
            'emergency': 'outage',
            'traffic violation': 'hazard',
            'road hazard': 'hazard',
            'power outage': 'outage',
            'construction': 'closure',
            'outage': 'outage',
            'closure': 'closure',
            'hazard': 'hazard'
        };
        return typeMap[type?.toLowerCase()] || 'hazard';
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Capitalize first letter
     */
    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Setup vehicle card click handlers
     */
    function setupVehicleCards() {
        const vehicleCards = document.querySelectorAll('.vehicle-card');

        vehicleCards.forEach(card => {
            const vehicleId = card.dataset.vehicleId;
            const header = card.querySelector('.vehicle-card__header');

            // Click on header toggles expansion
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleVehicleExpansion(vehicleId);
                // Also select the vehicle on the map
                MapModule.selectVehicle(vehicleId);
            });

            // Setup range control buttons
            setupRangeControls(card, vehicleId);
        });
    }

    /**
     * Toggle vehicle card expansion
     */
    function toggleVehicleExpansion(vehicleId) {
        const card = document.querySelector(`.vehicle-card[data-vehicle-id="${vehicleId}"]`);
        if (!card) return;

        // If clicking the same card, toggle it off
        if (expandedVehicleId === vehicleId) {
            expandedVehicleId = null;
            card.classList.remove('vehicle-card--expanded');
        } else {
            // Collapse previously expanded card
            if (expandedVehicleId) {
                const prevCard = document.querySelector(`.vehicle-card[data-vehicle-id="${expandedVehicleId}"]`);
                if (prevCard) {
                    prevCard.classList.remove('vehicle-card--expanded');
                }
            }

            // Expand new card
            expandedVehicleId = vehicleId;
            card.classList.add('vehicle-card--expanded');

            // Initialize date range if not set
            if (!expandedVehicleRange.start) {
                initializeDateRange();
            }

            // Load stats for this vehicle
            loadVehicleStats(vehicleId);
        }
    }

    /**
     * Initialize default date range (last 24 hours)
     */
    function initializeDateRange() {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        expandedVehicleRange.start = start;
        expandedVehicleRange.end = end;
        expandedVehicleRange.preset = '24';
    }

    /**
     * Setup range control button handlers
     */
    function setupRangeControls(card, vehicleId) {
        const rangeControls = card.querySelectorAll('[data-action]');

        rangeControls.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                handleRangeAction(action, vehicleId);
            });
        });
    }

    /**
     * Handle date range control actions
     */
    function handleRangeAction(action, vehicleId) {
        const DAY_MS = 24 * 60 * 60 * 1000;

        switch (action) {
            case 'prev-day':
                expandedVehicleRange.start = new Date(expandedVehicleRange.start.getTime() - DAY_MS);
                expandedVehicleRange.end = new Date(expandedVehicleRange.end.getTime() - DAY_MS);
                expandedVehicleRange.preset = 'custom';
                break;
            case 'next-day':
                expandedVehicleRange.start = new Date(expandedVehicleRange.start.getTime() + DAY_MS);
                expandedVehicleRange.end = new Date(expandedVehicleRange.end.getTime() + DAY_MS);
                expandedVehicleRange.preset = 'custom';
                break;
            case 'extend-start':
                expandedVehicleRange.start = new Date(expandedVehicleRange.start.getTime() - DAY_MS);
                expandedVehicleRange.preset = 'custom';
                break;
            case 'extend-end':
                expandedVehicleRange.end = new Date(expandedVehicleRange.end.getTime() + DAY_MS);
                expandedVehicleRange.preset = 'custom';
                break;
            case 'pick-range':
                // Show a simple prompt for now - could be enhanced with a proper date picker
                showQuickRangePicker(vehicleId);
                return;
        }

        // Update label and reload data
        updateRangeLabel(vehicleId);
        loadVehicleStats(vehicleId);
    }

    /**
     * Show quick range picker dropdown
     */
    function showQuickRangePicker(vehicleId) {
        const card = document.querySelector(`.vehicle-card[data-vehicle-id="${vehicleId}"]`);
        if (!card) return;

        const rangeBtn = card.querySelector('[data-action="pick-range"]');

        // Remove existing picker if any
        const existingPicker = document.querySelector('.vehicle-stats__range-dropdown');
        if (existingPicker) {
            existingPicker.remove();
            return; // Toggle off
        }

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'vehicle-stats__range-dropdown';
        dropdown.innerHTML = `
            <button class="vehicle-stats__range-option" data-preset="24">Last 24 Hours</button>
            <button class="vehicle-stats__range-option" data-preset="48">Last 48 Hours</button>
            <button class="vehicle-stats__range-option" data-preset="168">Last 7 Days</button>
            <button class="vehicle-stats__range-option" data-preset="720">Last 30 Days</button>
            <button class="vehicle-stats__range-option" data-preset="all">All Time</button>
        `;

        // Position dropdown below the button
        const btnRect = rangeBtn.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        dropdown.style.top = (btnRect.bottom - cardRect.top + 4) + 'px';
        dropdown.style.left = (btnRect.left - cardRect.left) + 'px';

        card.style.position = 'relative';
        card.appendChild(dropdown);

        // Handle option selection
        dropdown.querySelectorAll('.vehicle-stats__range-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const preset = option.dataset.preset;
                applyRangePreset(vehicleId, preset);
                dropdown.remove();
            });
        });

        // Close dropdown when clicking outside
        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && e.target !== rangeBtn) {
                dropdown.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    /**
     * Apply a preset date range
     */
    function applyRangePreset(vehicleId, preset) {
        const now = new Date();

        if (preset === 'all') {
            // All time - use a very old start date
            expandedVehicleRange.start = new Date('2020-01-01T00:00:00Z');
            expandedVehicleRange.end = now;
        } else {
            const hours = parseInt(preset, 10);
            expandedVehicleRange.start = new Date(now.getTime() - hours * 60 * 60 * 1000);
            expandedVehicleRange.end = now;
        }

        expandedVehicleRange.preset = preset;
        updateRangeLabel(vehicleId);
        loadVehicleStats(vehicleId);
    }

    /**
     * Update the range label based on current range
     */
    function updateRangeLabel(vehicleId) {
        const card = document.querySelector(`.vehicle-card[data-vehicle-id="${vehicleId}"]`);
        if (!card) return;

        const label = card.querySelector('.vehicle-stats__range-label');
        if (!label) return;

        // Check for preset
        if (expandedVehicleRange.preset === 'all') {
            label.textContent = 'All Time';
            return;
        }

        const diffMs = expandedVehicleRange.end - expandedVehicleRange.start;
        const diffHours = Math.round(diffMs / (60 * 60 * 1000));
        const diffDays = Math.round(diffHours / 24);

        if (diffHours <= 24) {
            label.textContent = 'Last 24h';
        } else if (diffHours <= 48) {
            label.textContent = 'Last 48h';
        } else if (diffDays <= 7) {
            label.textContent = 'Last 7 days';
        } else if (diffDays <= 30) {
            label.textContent = 'Last 30 days';
        } else {
            // Show date range
            const startStr = expandedVehicleRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = expandedVehicleRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            label.textContent = `${startStr} - ${endStr}`;
        }
    }

    /**
     * Load vehicle statistics and render graph
     */
    async function loadVehicleStats(vehicleId) {
        const card = document.querySelector(`.vehicle-card[data-vehicle-id="${vehicleId}"]`);
        if (!card) return;

        const loading = card.querySelector('.vehicle-stats__loading');
        const empty = card.querySelector('.vehicle-stats__empty');
        const canvas = card.querySelector('.vehicle-stats__graph-canvas');
        const graphDiv = card.querySelector('.vehicle-stats__graph');

        // Show loading state, hide others
        loading.classList.add('vehicle-stats__loading--visible');
        empty.classList.remove('vehicle-stats__empty--visible');
        canvas.style.opacity = '0';

        try {
            // Fetch history data
            const from = expandedVehicleRange.start.toISOString();
            const to = expandedVehicleRange.end.toISOString();
            console.log(`Loading stats for vehicle ${vehicleId} from ${from} to ${to}`);
            const data = await HistoryAPI.getRange(vehicleId, from, to);
            console.log('History data received:', data);

            // Hide loading
            loading.classList.remove('vehicle-stats__loading--visible');

            if (data && data.trail && data.trail.length > 0) {
                // Show canvas, hide empty
                canvas.style.opacity = '1';
                empty.classList.remove('vehicle-stats__empty--visible');

                // Render the graph
                renderSpeedGraph(card, data.trail);

                // Update stats summary
                updateStatsSummary(card, data.trail);

                // Update time labels
                updateGraphLabels(card, data.trail);
            } else {
                // Show empty state
                showEmptyState(card);
            }
        } catch (error) {
            console.error('Failed to load vehicle stats:', error);
            loading.classList.remove('vehicle-stats__loading--visible');
            showEmptyState(card, 'Failed to load data');
        }
    }

    /**
     * Render speed/time graph on canvas
     */
    function renderSpeedGraph(card, trail) {
        const canvas = card.querySelector('.vehicle-stats__graph-canvas');
        const scrollContainer = card.querySelector('.vehicle-stats__graph-scroll');
        const graphDiv = card.querySelector('.vehicle-stats__graph');

        if (!canvas || trail.length === 0) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Calculate width based on data points (min 100% of container, scales with data)
        const containerWidth = scrollContainer.offsetWidth;
        const minWidth = containerWidth;
        const pointsPerPixel = 0.5; // 2 pixels per data point
        const calculatedWidth = Math.max(minWidth, trail.length / pointsPerPixel);

        // Set canvas dimensions
        const width = calculatedWidth;
        const height = 120;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        graphDiv.style.width = width + 'px';

        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Extract speed data
        const speeds = trail.map(p => p.speed || 0);
        const maxSpeed = Math.max(...speeds, 1);

        // Graph padding
        const padding = { top: 10, bottom: 20, left: 5, right: 5 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

        // Draw the area under the line
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);

        for (let i = 0; i < speeds.length; i++) {
            const x = padding.left + (i / (speeds.length - 1 || 1)) * graphWidth;
            const y = padding.top + (1 - speeds[i] / maxSpeed) * graphHeight;
            ctx.lineTo(x, y);
        }

        ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw the line
        ctx.beginPath();
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let i = 0; i < speeds.length; i++) {
            const x = padding.left + (i / (speeds.length - 1 || 1)) * graphWidth;
            const y = padding.top + (1 - speeds[i] / maxSpeed) * graphHeight;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Draw max speed reference line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(width - padding.right, padding.top);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw max speed label
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(maxSpeed)} km/h`, padding.left + 2, padding.top + 10);
    }

    /**
     * Update stats summary values
     */
    function updateStatsSummary(card, trail) {
        const speeds = trail.map(p => p.speed || 0).filter(s => s > 0);

        const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
        const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

        // Calculate approximate distance (sum of distances between points)
        let distance = 0;
        for (let i = 1; i < trail.length; i++) {
            const prev = trail[i - 1];
            const curr = trail[i];
            distance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        }

        // Update UI
        const maxSpeedEl = card.querySelector('[data-stat="max-speed"]');
        const avgSpeedEl = card.querySelector('[data-stat="avg-speed"]');
        const distanceEl = card.querySelector('[data-stat="distance"]');

        if (maxSpeedEl) maxSpeedEl.textContent = Math.round(maxSpeed);
        if (avgSpeedEl) avgSpeedEl.textContent = Math.round(avgSpeed);
        if (distanceEl) distanceEl.textContent = distance.toFixed(1);
    }

    /**
     * Calculate distance between two coordinates in km (Haversine formula)
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Update graph time labels
     */
    function updateGraphLabels(card, trail) {
        const labelsContainer = card.querySelector('.vehicle-stats__graph-labels');
        if (!labelsContainer || trail.length === 0) return;

        const firstTime = new Date(trail[0].timestamp);
        const lastTime = new Date(trail[trail.length - 1].timestamp);

        const formatTime = (date) => date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        labelsContainer.innerHTML = `
            <span>${formatTime(firstTime)}</span>
            <span>${formatTime(lastTime)}</span>
        `;
    }

    /**
     * Show empty state in graph container
     */
    function showEmptyState(card, message = 'No data for this period') {
        const canvas = card.querySelector('.vehicle-stats__graph-canvas');
        const empty = card.querySelector('.vehicle-stats__empty');
        const emptyText = card.querySelector('.vehicle-stats__empty-text');

        canvas.style.opacity = '0';
        empty.classList.add('vehicle-stats__empty--visible');
        if (emptyText) emptyText.textContent = message;

        // Reset stats to default
        const maxSpeedEl = card.querySelector('[data-stat="max-speed"]');
        const avgSpeedEl = card.querySelector('[data-stat="avg-speed"]');
        const distanceEl = card.querySelector('[data-stat="distance"]');
        if (maxSpeedEl) maxSpeedEl.textContent = '--';
        if (avgSpeedEl) avgSpeedEl.textContent = '--';
        if (distanceEl) distanceEl.textContent = '--';
    }

    /**
     * Setup incident card click handlers
     */
    function setupIncidentCards() {
        const incidentCards = document.querySelectorAll('.incident-card');

        incidentCards.forEach(card => {
            // Check if this card is inside the closed section
            const isInClosedSection = card.closest('.closed-incidents-list') !== null;

            card.addEventListener('click', () => {
                // If in closed section, don't open dispatch panel
                if (isInClosedSection) {
                    console.log('Clicked closed incident, ignoring');
                    return;
                }
                const incidentId = card.dataset.incidentId;
                MapModule.selectIncident(incidentId);
            });
        });
    }

    /**
     * Show a specific sidebar
     */
    function showSidebar(sidebarName) {
        const btnVehicles = document.getElementById('btn-vehicles');
        const btnIncidents = document.getElementById('btn-incidents');
        const app = document.getElementById('app');

        // Remove active state from buttons
        if (btnVehicles) btnVehicles.classList.remove('active');
        if (btnIncidents) btnIncidents.classList.remove('active');
        if (app) app.classList.remove('app--sidebar-visible');

        // Manage Offcanvas visibility
        if (sidebarName === 'vehicles') {
            if (vehiclesOffcanvas) vehiclesOffcanvas.show();
            if (incidentsOffcanvas) incidentsOffcanvas.hide();

            if (btnVehicles) btnVehicles.classList.add('active');
            if (app) app.classList.add('app--sidebar-visible');
        } else if (sidebarName === 'incidents') {
            if (incidentsOffcanvas) incidentsOffcanvas.show();
            if (vehiclesOffcanvas) vehiclesOffcanvas.hide();

            if (btnIncidents) btnIncidents.classList.add('active');
            if (app) app.classList.add('app--sidebar-visible');
        } else {
            if (vehiclesOffcanvas) vehiclesOffcanvas.hide();
            if (incidentsOffcanvas) incidentsOffcanvas.hide();
        }
    }

    /**
     * Highlight selected vehicle card
     */
    function highlightVehicleCard(vehicleId) {
        // Remove highlight from all cards
        document.querySelectorAll('.vehicle-card').forEach(card => {
            card.classList.remove('vehicle-card--selected');
        });

        // Add highlight to selected card
        if (vehicleId) {
            const card = document.querySelector(`.vehicle-card[data-vehicle-id="${vehicleId}"]`);
            if (card) {
                card.classList.add('vehicle-card--selected');
            }
        }
    }

    /**
     * Highlight selected incident card
     */
    function highlightIncidentCard(incidentId) {
        // Remove highlight from all cards
        document.querySelectorAll('.incident-card').forEach(card => {
            card.classList.remove('incident-card--selected');
        });

        // Add highlight to selected card
        if (incidentId) {
            const card = document.querySelector(`.incident-card[data-incident-id="${incidentId}"]`);
            if (card) {
                card.classList.add('incident-card--selected');
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    /**
     * Handle state changes
     */
    function handleStateChange(state) {
        // Update sidebar visibility
        showSidebar(state.activeSidebar);

        // Update highlighted cards
        highlightVehicleCard(state.selectedVehicle);
        highlightIncidentCard(state.selectedIncident);
    }

    /**
     * Handle data changes from API
     */
    function handleDataChange(data) {
        renderVehicleList(data.vehicles);
        renderIncidentList(data.incidents);
    }

    // Public API
    return {
        init,
        showSidebar,
        renderVehicleList,
        renderIncidentList
    };
})();
