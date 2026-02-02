/**
 * Vehicle Tracker - Main Application
 * Pure JavaScript SPA entry point
 */

const App = (function () {

    // Dispatch state machine states
    const DISPATCH_STATES = {
        CHOICE: 'choice',
        SEARCHING: 'searching',
        SELECTION: 'selection',
        ASSIGNED: 'assigned'
    };

    // Current dispatch state
    let dispatchState = DISPATCH_STATES.CHOICE;
    let selectedDispatchVehicle = null;
    let closestVehicleId = null;

    // Mock vehicle data for dispatch
    // Dispatch vehicles data
    let dispatchVehicles = [];

    /**
     * Initialize the application
     */
    async function init() {
        console.log('Vehicle Tracker initializing...');

        // Initialize modules
        MapModule.init();
        SidebarModule.init();

        // Setup bottom bar controls
        setupBottomBar();

        // Setup history player
        setupHistoryPlayer();

        // Setup dispatch panel
        setupDispatchPanel();

        // Setup vehicle popup history button
        setupPopupHistoryButton();

        // Setup user menu
        setupUserMenu();

        // Setup window resize handler for dynamic layouts
        setupResizeHandler();

        // Setup DOM resize observers for smooth map resizing
        setupResizeObservers();


        // Subscribe to state changes
        State.subscribe(handleStateChange);

        // Load data from API
        console.log('Loading data from API...');
        try {
            await VehicleData.loadAll();
            console.log('Data loaded successfully');

            // After data loads, update map markers
            MapModule.updateMarkers();
        } catch (error) {
            console.error('Failed to load data:', error);
        }

        console.log('Vehicle Tracker ready!');
    }

    /**
     * Setup window resize handler
     */
    function setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const state = State.getState();

                // Proactively close overlapping bars when window shrinks
                if (wouldOverlap() && state.activeSidebar && state.bottomBar) {
                    // Prefer keeping the bottom bar, close sidebar
                    State.setState({ activeSidebar: null });
                }

                updateHistoryPlayerLayout(state);
                updateDispatchPanelLayout(state);

                // Recalculate map bottom based on actual bar height
                const mapEl = document.getElementById('map');
                const historyPlayer = document.getElementById('history-player');
                const dispatchBar = document.getElementById('dispatch-bar');

                if (state.bottomBar === 'history' && historyPlayer) {
                    mapEl.style.bottom = historyPlayer.offsetHeight + 'px';
                } else if (state.bottomBar === 'dispatch' && dispatchBar) {
                    mapEl.style.bottom = dispatchBar.offsetHeight + 'px';
                } else {
                    mapEl.style.bottom = '0';
                }

                // Also invalidate map size
                const map = MapModule.getMap();
                if (map) {
                    map.invalidateSize({ pan: false });
                }
            }, 100);
        });
    }

    /**
     * Setup ResizeObservers to watch for element size changes (animation, dynamic content)
     */
    function setupResizeObservers() {
        if (!window.ResizeObserver) return;

        const dispatchBar = document.getElementById('dispatch-bar');
        const historyPlayer = document.getElementById('history-player');
        // We observe these to trigger map invalidateSize whenever their dimensions change
        // This handles CSS transitions, content changes (list vs assigned view), etc.

        const resizeCallback = (entries) => {
            const map = MapModule.getMap();
            if (!map) return;

            // Simple debounce or just call invalidateSize
            // Since this might fire frequently during animation, we might want to throttle
            // However, Leaflet's invalidateSize has some internal debouncing/animation logic if options are set.
            // But usually we just want to ensure it snaps to correct size.

            // Just requesting an update frame is good enough for smoothness
            requestAnimationFrame(() => {
                map.invalidateSize({ pan: false });

                // Also update the bottom padding of the map based on the active bar's height
                const state = State.getState();
                const mapElement = document.getElementById('map');
                if (mapElement) {
                    let bottomPadding = 0;
                    if (state.bottomBar === 'dispatch' && dispatchBar) {
                        bottomPadding = dispatchBar.offsetHeight;
                    } else if (state.bottomBar === 'history' && historyPlayer) {
                        bottomPadding = historyPlayer.offsetHeight;
                    }
                    mapElement.style.bottom = bottomPadding + 'px';
                }
            });
        };

        const observer = new ResizeObserver(resizeCallback);
        if (dispatchBar) observer.observe(dispatchBar);
        if (historyPlayer) observer.observe(historyPlayer);
    }

    /**
     * Setup vehicle popup buttons (history and path)
     */
    function setupPopupHistoryButton() {
        const historyBtn = document.getElementById('popup-history-btn');
        if (historyBtn) {
            historyBtn.addEventListener('click', async () => {
                const state = State.getState();
                if (state.selectedVehicle) {
                    // When opening bottom bar and both would overlap, close sidebar
                    const stateUpdate = { bottomBar: 'history' };
                    const closingSidebar = wouldOverlap() && state.activeSidebar;
                    if (closingSidebar) {
                        stateUpdate.activeSidebar = null;
                    }

                    // Show history player
                    State.setState(stateUpdate);

                    // If we closed sidebar, explicitly resize map after animation
                    if (closingSidebar) {
                        setTimeout(() => {
                            const map = MapModule.getMap();
                            if (map) map.invalidateSize({ pan: false });
                        }, 350);
                    }

                    // Start history playback
                    await startHistoryPlayback(state.selectedVehicle);
                }
            });
        }

        // Setup View Path button
        const pathBtn = document.getElementById('popup-path-btn');
        if (pathBtn) {
            pathBtn.addEventListener('click', async () => {
                const state = State.getState();
                if (state.selectedVehicle) {
                    // Show loading spinner (small inline)
                    pathBtn.disabled = true;
                    pathBtn.classList.add('loading');
                    pathBtn.innerHTML = '<span class="btn-spinner"></span>';

                    try {
                        const success = await MapModule.showVehiclePath(state.selectedVehicle);

                        // Only dock popup if path was successfully displayed
                        if (success) {
                            const popup = document.getElementById('vehicle-popup');
                            if (popup) {
                                popup.classList.add('vehicle-popup--docked');
                            }
                        }
                    } catch (error) {
                        console.error('Failed to show path:', error);
                    } finally {
                        pathBtn.disabled = false;
                        pathBtn.classList.remove('loading');
                        pathBtn.innerHTML = '<span class="material-symbols-outlined">route</span>';
                    }
                }
            });
        }

        // Setup popover close button
        const popupCloseBtn = document.getElementById('popup-close-btn');
        if (popupCloseBtn) {
            popupCloseBtn.addEventListener('click', () => {
                MapModule.hideVehiclePopup();
                MapModule.clearPath(); // Also clear path when closing popup
                State.setState({ selectedVehicle: null });
            });
        }
    }

    /**
     * Setup user menu dropdown
     */
    function setupUserMenu() {
        // Sign out button
        const signOutBtn = document.getElementById('btn-sign-out');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                window.location.href = '/Home/Login';
            });
        }

        // Custom dropdown logic (legacy)
        const trigger = document.getElementById('user-menu-trigger');
        const menu = document.getElementById('user-menu');

        if (!trigger || !menu) return;

        // Toggle menu on avatar click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('user-menu--visible');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !trigger.contains(e.target)) {
                menu.classList.remove('user-menu--visible');
            }
        });
    }

    /**
     * Setup bottom bar controls (dispatch panel, history player)
     */
    function setupBottomBar() {
        // Dispatch close button
        const dispatchClose = document.getElementById('dispatch-close');
        if (dispatchClose) {
            dispatchClose.addEventListener('click', () => {
                State.setState({ bottomBar: null, selectedIncident: null });
                // Reset dispatch state when closed
                resetDispatchState();
            });
        }
    }

    /**
     * Setup dispatch panel state machine and interactions
     */
    function setupDispatchPanel() {
        // Auto-assign button
        const autoAssignBtn = document.getElementById('btn-auto-assign');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', handleAutoAssign);
        }

        // Manual select button
        const manualSelectBtn = document.getElementById('btn-manual-select');
        if (manualSelectBtn) {
            manualSelectBtn.addEventListener('click', handleManualSelect);
        }

        // Cancel selection button
        const cancelBtn = document.getElementById('btn-cancel-selection');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancelSelection);
        }

        // Dispatch button
        const dispatchBtn = document.getElementById('btn-dispatch');
        if (dispatchBtn) {
            dispatchBtn.addEventListener('click', handleDispatch);
        }
    }

    /**
     * Handle auto-assign button click
     */
    /**
     * Handle auto-assign button click
     */
    async function handleAutoAssign() {
        // Show searching state
        setDispatchUIState(DISPATCH_STATES.SEARCHING);

        try {
            // Get current incident ID
            const state = State.getState();
            const incidentId = state.selectedIncident;

            if (!incidentId) {
                console.error('No incident selected');
                setDispatchUIState(DISPATCH_STATES.CHOICE);
                return;
            }

            // Fetch nearest vehicles from API (now uses OSRM routing)
            const vehicles = await VehicleData.getNearestVehicles(incidentId);

            // Map API response to dispatch vehicle format
            dispatchVehicles = vehicles.map(v => ({
                id: v.vehicleId,
                name: `${v.make} ${v.model}`,
                driver: v.plateNumber, // Or driver name if available
                time: v.durationSeconds != null ? `${Math.ceil(v.durationSeconds / 60)} min` :
                    v.distanceMeters != null ? `${Math.round(v.distanceMeters / 1000 / 40 * 60)} min` : 'Unknown', // Fallback
                km: v.distanceMeters != null ? `${(v.distanceMeters / 1000).toFixed(1)} km` : '-- km',
                isRecommended: v.durationSeconds != null && v.durationSeconds < 600 // Highlighting fast response (< 10 min)
            }));

            // Identify best candidate (closest by time)
            if (dispatchVehicles.length > 0) {
                // Since getNearestVehicles sorts by duration, the first one is likely best
                const best = dispatchVehicles[0];
                closestVehicleId = best.id;
                selectedDispatchVehicle = closestVehicleId;
            }

            // Small delay to ensure UI transition feels natural (OSRM might be too fast)
            setTimeout(() => {
                if (dispatchVehicles.length > 0) {
                    populateVehicleList(true);
                    setDispatchUIState(DISPATCH_STATES.SELECTION);
                    updateDispatchButton();
                } else {
                    // Handle no vehicles found
                    console.warn('No nearest vehicles found');
                    setDispatchUIState(DISPATCH_STATES.CHOICE);
                }
            }, 500);
        } catch (error) {
            console.error('Failed to auto-assign:', error);
            setDispatchUIState(DISPATCH_STATES.CHOICE);
        }
    }

    /**
     * Handle manual select button click
     */
    async function handleManualSelect() {
        closestVehicleId = null;
        selectedDispatchVehicle = null;

        // If vehicles not loaded yet, load them
        if (dispatchVehicles.length === 0) {
            setDispatchUIState(DISPATCH_STATES.SEARCHING); // Show throbber
            const state = State.getState();
            if (state.selectedIncident) {
                try {
                    const vehicles = await VehicleData.getNearestVehicles(state.selectedIncident);
                    dispatchVehicles = vehicles.map(v => ({
                        id: v.vehicleId,
                        name: `${v.make} ${v.model}`,
                        driver: v.plateNumber,
                        time: v.durationSeconds != null ? `${Math.ceil(v.durationSeconds / 60)} min` :
                            v.distanceMeters != null ? `${Math.round(v.distanceMeters / 1000 / 40 * 60)} min` : 'Unknown', // Fallback
                        km: v.distanceMeters != null ? `${(v.distanceMeters / 1000).toFixed(1)} km` : '-- km',
                        isRecommended: false
                    }));
                } catch (e) {
                    console.error(e);
                }
            }
        }

        populateVehicleList(false);
        setDispatchUIState(DISPATCH_STATES.SELECTION);
        updateDispatchButton();
    }

    /**
     * Handle cancel selection button click
     */
    function handleCancelSelection() {
        resetDispatchState();
        setDispatchUIState(DISPATCH_STATES.CHOICE);
    }

    /**
     * Handle dispatch button click
     */
    async function handleDispatch() {
        if (selectedDispatchVehicle) {
            console.log('Dispatching vehicle:', selectedDispatchVehicle);

            const btn = document.getElementById('btn-dispatch');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Dispatching...';

            try {
                // Get current incident ID
                const state = State.getState();
                const incidentId = state.selectedIncident;

                if (!incidentId) {
                    console.error('No incident selected');
                    return;
                }

                // Call API to assign vehicle and update status to Assigned (ID: 2)
                await VehicleData.assignIncident(incidentId, selectedDispatchVehicle, 2);

                console.log('Dispatch successful');

                // Keep panel open to show result, but maybe reset selection state?
                // State.setState({ bottomBar: null, selectedIncident: null });
                // resetDispatchState();

                // For now, let's just show success on the button and keep it open
                btn.innerHTML = '<span class="material-symbols-outlined icon-sm">check</span> Dispatched';
                btn.classList.remove('btn--success');
                btn.classList.add('btn--outline');

                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    btn.classList.add('btn--success');
                    btn.classList.remove('btn--outline');
                    // Optional: Reset to choice state if they want to dispatch again?
                    // resetDispatchState();
                    // setDispatchUIState(DISPATCH_STATES.CHOICE);
                }, 2000);
            } catch (error) {
                console.error('Dispatch failed:', error);
                btn.innerHTML = 'Error';
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }, 2000);
            }
        }
    }

    /**
     * Reset dispatch state to initial
     */
    function resetDispatchState() {
        dispatchState = DISPATCH_STATES.CHOICE;
        selectedDispatchVehicle = null;
        closestVehicleId = null;
    }

    /**
     * Set dispatch UI state (show/hide state containers)
     */
    function setDispatchUIState(state) {
        dispatchState = state;

        const choiceEl = document.getElementById('dispatch-state-choice');
        const searchingEl = document.getElementById('dispatch-state-searching');
        const selectionEl = document.getElementById('dispatch-state-selection');
        const assignedEl = document.getElementById('dispatch-state-assigned');

        // Remove active class from all
        [choiceEl, searchingEl, selectionEl, assignedEl].forEach(el => {
            if (el) el.classList.remove('dispatch-state--active');
        });

        // Add active class to current state
        switch (state) {
            case DISPATCH_STATES.CHOICE:
                if (choiceEl) choiceEl.classList.add('dispatch-state--active');
                break;
            case DISPATCH_STATES.SEARCHING:
                if (searchingEl) searchingEl.classList.add('dispatch-state--active');
                break;
            case DISPATCH_STATES.SELECTION:
                if (selectionEl) selectionEl.classList.add('dispatch-state--active');
                break;
            case DISPATCH_STATES.ASSIGNED:
                if (assignedEl) assignedEl.classList.add('dispatch-state--active');
                break;
        }
    }

    /**
     * Populate vehicle list for dispatch
     */
    function populateVehicleList(showClosestBadge) {
        const listContainer = document.getElementById('dispatch-vehicle-list');
        if (!listContainer) return;

        listContainer.innerHTML = dispatchVehicles.map((vehicle, index) => {
            const isClosest = showClosestBadge && index === 0;
            const isSelected = selectedDispatchVehicle === vehicle.id;

            let actionButtons = '';
            if (isSelected) {
                actionButtons = `
                    <div class="dispatch-vehicle-actions">
                        <button class="btn btn--success btn--sm btn-dispatch-inline" data-vehicle-id="${vehicle.id}">
                            <span class="material-symbols-outlined icon-sm">send</span> Dispatch
                        </button>
                        <button class="btn btn--ghost btn--sm btn-cancel-inline">
                            Cancel
                        </button>
                    </div>
                `;
            }

            return `
                <div class="dispatch-vehicle-card ${isSelected ? 'dispatch-vehicle-card--selected' : ''}" 
                     data-vehicle-id="${vehicle.id}">
                    <div class="dispatch-vehicle-content">
                        <div class="dispatch-vehicle-card__info">
                            <div class="dispatch-vehicle-card__icon">
                                <span class="material-symbols-outlined icon-sm">directions_car</span>
                            </div>
                            <div class="dispatch-vehicle-card__details">
                                <div class="dispatch-vehicle-card__name">${vehicle.name}</div>
                                <div class="dispatch-vehicle-card__id">${vehicle.id} • ${vehicle.driver}</div>
                            </div>
                        </div>
                        <div class="dispatch-vehicle-card__right">
                            <div class="dispatch-vehicle-card__distance">
                                <div class="dispatch-vehicle-card__time">${vehicle.time}</div>
                                <div class="dispatch-vehicle-card__km">${vehicle.km}</div>
                            </div>
                            ${isClosest ? `
                                <div class="dispatch-vehicle-card__badge">
                                    <span class="material-symbols-outlined" style="font-size: 12px;">check</span>
                                    Closest
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ${actionButtons}
                </div>
            `;
        }).join('');

        // Add click listeners to vehicle cards (for selection)
        listContainer.querySelectorAll('.dispatch-vehicle-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Ignore clicks on buttons
                if (e.target.closest('button')) return;

                // Dataset values are always strings, parse to int for comparison
                const vehicleId = parseInt(card.dataset.vehicleId, 10);

                // Toggle selection
                if (selectedDispatchVehicle === vehicleId) {
                    // Do nothing if already selected, or maybe deselect?
                    // selectedDispatchVehicle = null;
                } else {
                    selectedDispatchVehicle = vehicleId;
                }

                // Re-render
                populateVehicleList(showClosestBadge);
            });
        });

        // Add listeners to inline buttons
        listContainer.querySelectorAll('.btn-dispatch-inline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDispatchInline(btn);
            });
        });

        listContainer.querySelectorAll('.btn-cancel-inline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedDispatchVehicle = null;
                populateVehicleList(showClosestBadge);
            });
        });
    }

    /**
     * Handle inline dispatch button click
     */
    async function handleDispatchInline(btn) {
        // Find the vehicle ID (should be selectedDispatchVehicle)
        const vehicleId = selectedDispatchVehicle;
        if (!vehicleId) return;

        console.log('Dispatching vehicle (inline):', vehicleId);

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner-sm"></span>'; // Small spinner

        try {
            // Get current incident ID
            const state = State.getState();
            const incidentId = state.selectedIncident;

            if (!incidentId) {
                console.error('No incident selected');
                return;
            }

            // Call API to assign vehicle and update status to Assigned (ID: 2)
            await VehicleData.assignIncident(incidentId, vehicleId, 2);

            console.log('Dispatch successful');

            // Show success
            btn.innerHTML = '<span class="material-symbols-outlined icon-sm">check</span>';
            btn.classList.remove('btn--success');
            btn.classList.add('btn--outline'); // Or keep success color

            // Reset after delay and show assigned view
            setTimeout(() => {
                // Determine incident ID
                const state = State.getState();
                const incidentId = state.selectedIncident;

                if (incidentId) {
                    renderAssignedView(incidentId);
                } else {
                    // Fallback
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    btn.classList.add('btn--success');
                    btn.classList.remove('btn--outline');
                }
            }, 1000);
        } catch (error) {
            console.error('Dispatch failed:', error);
            btn.innerHTML = '<span class="material-symbols-outlined icon-sm">error</span>';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }, 2000);
        }
    }

    /**
     * Update dispatch button state
     */
    function updateDispatchButton() {
        const btn = document.getElementById('btn-dispatch');
        if (btn) {
            btn.disabled = !selectedDispatchVehicle;
        }
    }



    /**
     * Check incident status and update UI accordingly
     */
    async function checkIncidentStatus(incidentId) {
        if (!incidentId) return;

        // Show loading or default to choice while checking?
        setDispatchUIState(DISPATCH_STATES.CHOICE);

        try {
            // Check if we have the status in state (if loaded via sidebar)
            // But state doesn't have the incident object.
            // Fetch from API
            const incident = await apiFetch(`/incidents/${incidentId}`);

            // Fix prop name check (incidentStatusId)
            if (incident && (incident.incidentStatusId === 2 || incident.IncidentStatusId === 2)) {
                // Assigned
                renderAssignedView(incidentId);
            } else {
                // Open or Closed (Handle closed?)
                setDispatchUIState(DISPATCH_STATES.CHOICE);
            }
        } catch (e) {
            console.error('Error checking incident status', e);
            setDispatchUIState(DISPATCH_STATES.CHOICE);
        }
    }

    /**
     * Render the assigned vehicle view
     */
    async function renderAssignedView(incidentId) {
        setDispatchUIState(DISPATCH_STATES.ASSIGNED);
        const container = document.getElementById('dispatch-state-assigned');
        if (!container) return;

        container.innerHTML = '<div class="dispatch-searching"><div class="dispatch-searching__spinner"></div><h5 class="dispatch-searching__title">Loading vehicle...</h5></div>';

        try {
            // We need the vehicle details.
            // If the vehicle is assigned, the incident object should support it, or we fetch it.
            // Assuming incident has vehicleId.
            // Let's get the incident from state? No, get from API or cache.
            // State does not store full incident details globally, just ID.
            // We need to fetch incident or get from sidebar data?
            // SidebarModule has current data. VehicleData has vehicles.

            // Fetch incident details to be sure
            const incident = await apiFetch(`/incidents/${incidentId}`);

            // API returns 'assignedTo' for vehicle ID
            const vehicleId = incident ? (incident.assignedTo || incident.AssignedTo) : null;

            if (!vehicleId) {
                container.innerHTML = '<div class="text-center p-4">Vehicle information not available</div>';
                return;
            }

            const vehicle = VehicleData.getVehicle(vehicleId);
            if (!vehicle) {
                // Try reloading vehicles if not found
                await VehicleData.loadAll();
            }

            const v = VehicleData.getVehicle(vehicleId);
            if (!v) {
                container.innerHTML = '<div class="text-center p-4">Vehicle details not found</div>';
                return;
            }

            // Render the card (Simplified version of sidebar expanded card)
            const statusClass = (v.status === 'online' || v.status === 'available') ? 'online' : 'offline';

            container.innerHTML = `
                <div class="vehicle-card vehicle-card--expanded" style="border: 1px solid var(--color-gray-200); box-shadow: none;">
                    <div class="vehicle-card__header">
                        <div class="vehicle-card__main">
                            <div class="vehicle-card__icon">
                                <span class="material-symbols-outlined icon-md">directions_car</span>
                            </div>
                            <div class="vehicle-card__info">
                                <span class="vehicle-card__name">
                                    ${v.name}
                                    <span class="vehicle-card__status vehicle-card__status--${statusClass}"></span>
                                </span>
                                <span class="vehicle-card__id">VH-${v.id}</span>
                                <span class="vehicle-card__location">Assigned to this incident</span>
                            </div>
                        </div>
                        <div class="vehicle-card__actions">
                            <button class="btn btn--sm btn--ghost" id="btn-show-path" data-vehicle-id="${v.id}" title="Show Path">
                                <span class="material-symbols-outlined icon-sm">route</span>
                                <span>Show Path</span>
                            </button>
                            <button class="btn btn--sm btn--ghost" id="btn-show-history" data-vehicle-id="${v.id}" title="History">
                                <span class="material-symbols-outlined icon-sm">history</span>
                                <span>History</span>
                            </button>
                        </div>
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
                        
                        <div class="vehicle-stats__graph-container" style="height: 100px;">
                            <div class="vehicle-stats__graph-scroll">
                                <div class="vehicle-stats__graph">
                                    <canvas class="vehicle-stats__graph-canvas"></canvas>
                                </div>
                            </div>
                            <div class="vehicle-stats__loading">
                                <span class="material-symbols-outlined">progress_activity</span>
                            </div>
                            <div class="vehicle-stats__empty">
                                <span class="material-symbols-outlined icon-md">show_chart</span>
                                <span class="vehicle-stats__empty-text">No data</span>
                            </div>
                        </div>
                        
                        <div class="vehicle-stats__summary" style="border-top: none; padding-top: 10px;">
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

            // Load stats
            loadAssignedVehicleStats(v.id, container);

            // Setup button handlers
            const showPathBtn = container.querySelector('#btn-show-path');
            const showHistoryBtn = container.querySelector('#btn-show-history');

            if (showPathBtn) {
                showPathBtn.addEventListener('click', () => {
                    const vehicleId = parseInt(showPathBtn.dataset.vehicleId);
                    // Show path
                    if (MapModule && MapModule.showVehiclePath) {
                        MapModule.showVehiclePath(vehicleId);
                    }
                });
            }

            if (showHistoryBtn) {
                showHistoryBtn.addEventListener('click', () => {
                    const vehicleId = parseInt(showHistoryBtn.dataset.vehicleId);
                    // Open history panel
                    State.setState({
                        bottomBar: 'history',
                        historyVehicleId: vehicleId
                    });
                });
            }

        } catch (e) {
            console.error('Failed to render assigned view', e);
            container.innerHTML = '<div class="text-error p-4">Error loading vehicle info</div>';
        }
    }

    /**
     * Load vehicle stats for assigned view
     */
    async function loadAssignedVehicleStats(vehicleId, container) {
        const loading = container.querySelector('.vehicle-stats__loading');
        const empty = container.querySelector('.vehicle-stats__empty');
        const canvas = container.querySelector('.vehicle-stats__graph-canvas');

        loading.classList.add('vehicle-stats__loading--visible');
        empty.classList.remove('vehicle-stats__empty--visible');
        canvas.style.opacity = '0';

        try {
            // Last 24h
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

            const data = await HistoryAPI.getRange(vehicleId, start.toISOString(), end.toISOString());

            loading.classList.remove('vehicle-stats__loading--visible');

            if (data && data.trail && data.trail.length > 0) {
                canvas.style.opacity = '1';
                renderAssignedGraph(canvas, data.trail);

                // Update stats
                const trail = data.trail;
                const speeds = trail.map(p => p.speed || 0);
                const maxSpeed = Math.max(...speeds).toFixed(0);
                const avgSpeed = (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(0);
                const distance = (data.totalDistance / 1000).toFixed(1);

                container.querySelector('[data-stat="max-speed"]').textContent = maxSpeed;
                container.querySelector('[data-stat="avg-speed"]').textContent = avgSpeed;
                container.querySelector('[data-stat="distance"]').textContent = distance;

            } else {
                empty.classList.add('vehicle-stats__empty--visible');
            }
        } catch (e) {
            console.error(e);
            loading.classList.remove('vehicle-stats__loading--visible');
            empty.classList.add('vehicle-stats__empty--visible');
        }
    }

    /**
     * Render graph on canvas (Simple version)
     */
    function renderAssignedGraph(canvas, trail) {
        if (!canvas || !trail.length) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const speeds = trail.map(p => p.speed || 0);
        const max = Math.max(...speeds, 10);
        const width = rect.width;
        const height = rect.height;
        const step = width / (speeds.length - 1 || 1);

        // Fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        ctx.beginPath();
        ctx.moveTo(0, height);
        speeds.forEach((s, i) => {
            const x = i * step;
            const y = height - (s / max) * height;
            ctx.lineTo(x, y);
        });
        ctx.lineTo(width, height);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Stroke
        ctx.beginPath();
        speeds.forEach((s, i) => {
            const x = i * step;
            const y = height - (s / max) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Track playback state
    let isPlaybackActive = false;
    let playbackVehicleId = null;

    /**
     * Generate tick marks for the timeline scrubber
     * Ticks are generated based on data time range
     */
    function generateTickMarks() {
        const ticksContainer = document.querySelector('.history-player__ticks');
        if (!ticksContainer) return;

        ticksContainer.innerHTML = '';

        // 24 ticks for 24 hours
        for (let i = 0; i <= 24; i++) {
            const tick = document.createElement('div');
            tick.className = 'history-player__tick';
            // Major tick at 0, 6, 12, 18, 24
            if (i % 6 === 0) {
                tick.classList.add('history-player__tick--major');
            }
            ticksContainer.appendChild(tick);
        }
    }

    /**
     * Update timeline labels based on actual data range
     */
    function updateTimelineLabels(startTime, endTime) {
        const labels = document.querySelector('.history-player__labels');
        if (!labels) return;

        const duration = endTime - startTime;
        const labelCount = 5; // 0%, 25%, 50%, 75%, 100%

        labels.innerHTML = '';
        for (let i = 0; i < labelCount; i++) {
            const position = i / (labelCount - 1);
            const time = new Date(startTime.getTime() + duration * position);
            const label = document.createElement('span');
            label.textContent = time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            labels.appendChild(label);
        }
    }

    /**
     * Show toast message
     */
    function showToast(message, duration = 3000) {
        const toast = document.getElementById('playback-toast');
        if (!toast) return;

        const msgEl = toast.querySelector('.playback-toast__message');
        if (msgEl) msgEl.textContent = message;

        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, duration);
    }

    /**
     * Logarithmic speed scale utilities
     * Maps slider position (0-100) to speed (0.5-8x) on a log scale
     * 1x is positioned at ~25% of the slider (closer to start)
     */
    const SpeedScale = {
        // Snap points: slider position -> speed value
        snapPoints: [
            { pos: 0, speed: 0.5 },
            { pos: 25, speed: 1 },
            { pos: 50, speed: 2 },
            { pos: 75, speed: 4 },
            { pos: 100, speed: 8 }
        ],

        // Convert slider position (0-100) to speed using logarithmic interpolation
        positionToSpeed(pos) {
            pos = Math.max(0, Math.min(100, pos));

            // Find the two snap points we're between
            let lower = this.snapPoints[0];
            let upper = this.snapPoints[this.snapPoints.length - 1];

            for (let i = 0; i < this.snapPoints.length - 1; i++) {
                if (pos >= this.snapPoints[i].pos && pos <= this.snapPoints[i + 1].pos) {
                    lower = this.snapPoints[i];
                    upper = this.snapPoints[i + 1];
                    break;
                }
            }

            // Linear interpolation in log space
            const t = (pos - lower.pos) / (upper.pos - lower.pos);
            const logSpeed = Math.log(lower.speed) + t * (Math.log(upper.speed) - Math.log(lower.speed));
            return Math.exp(logSpeed);
        },

        // Convert speed to slider position
        speedToPosition(speed) {
            speed = Math.max(0.5, Math.min(8, speed));

            // Find the two snap points we're between
            let lower = this.snapPoints[0];
            let upper = this.snapPoints[this.snapPoints.length - 1];

            for (let i = 0; i < this.snapPoints.length - 1; i++) {
                if (speed >= this.snapPoints[i].speed && speed <= this.snapPoints[i + 1].speed) {
                    lower = this.snapPoints[i];
                    upper = this.snapPoints[i + 1];
                    break;
                }
            }

            // Linear interpolation in log space
            const t = (Math.log(speed) - Math.log(lower.speed)) / (Math.log(upper.speed) - Math.log(lower.speed));
            return lower.pos + t * (upper.pos - lower.pos);
        },

        // Check if position is near a snap point (within threshold)
        getNearbySnapPoint(pos, threshold = 4) {
            for (const snap of this.snapPoints) {
                if (Math.abs(pos - snap.pos) <= threshold) {
                    return snap;
                }
            }
            return null;
        },

        // Format speed for display
        formatSpeed(speed) {
            if (speed < 1) {
                return speed.toFixed(1) + 'x';
            } else if (speed >= 1 && speed < 10) {
                // Show one decimal if not a whole number
                return (speed % 1 === 0 ? speed.toFixed(0) : speed.toFixed(1)) + 'x';
            }
            return speed.toFixed(0) + 'x';
        }
    };

    /**
     * Setup speed slider with logarithmic scale and snapping
     */
    function setupSpeedSlider() {
        const slider = document.getElementById('speed-slider');
        const valueDisplay = document.getElementById('speed-value');
        const ticks = document.querySelectorAll('.history-player__speed-ticks span');

        if (!slider) return;

        // Set initial position (1x = 25%)
        slider.value = 25;

        // Handle slider input
        slider.addEventListener('input', (e) => {
            let pos = parseFloat(e.target.value);

            // Check for snapping
            const snap = SpeedScale.getNearbySnapPoint(pos);
            if (snap) {
                pos = snap.pos;
                slider.value = pos;
            }

            const speed = SpeedScale.positionToSpeed(pos);
            updateSpeedDisplay(speed);
            HistoryPlayback.setSpeed(speed);
        });

        // Handle tick clicks for quick selection
        ticks.forEach(tick => {
            tick.addEventListener('click', () => {
                const speed = parseFloat(tick.dataset.value);
                const pos = SpeedScale.speedToPosition(speed);
                slider.value = pos;
                updateSpeedDisplay(speed);
                HistoryPlayback.setSpeed(speed);
            });
        });

        function updateSpeedDisplay(speed) {
            if (valueDisplay) {
                valueDisplay.textContent = SpeedScale.formatSpeed(speed);
            }
        }
    }

    /**
     * Setup history player controls
     */
    function setupHistoryPlayer() {
        // Generate tick marks
        generateTickMarks();

        // Initialize HistoryPlayback module
        HistoryPlayback.init({
            onPositionChange: handlePlaybackPositionChange,
            onPlayStateChange: handlePlaybackStateChange
        });

        // History close button
        const historyClose = document.getElementById('history-close');
        if (historyClose) {
            historyClose.addEventListener('click', closeHistoryPlayer);
        }

        // Play/pause button
        const playBtn = document.getElementById('btn-play-pause');
        if (playBtn) {
            playBtn.addEventListener('click', togglePlayback);
        }

        // Skip buttons
        document.getElementById('btn-skip-backward')?.addEventListener('click', () => {
            HistoryPlayback.skipBackward(0.05);
        });

        document.getElementById('btn-skip-forward')?.addEventListener('click', () => {
            HistoryPlayback.skipForward(0.05);
        });

        document.getElementById('btn-fast-backward')?.addEventListener('click', () => {
            HistoryPlayback.skipBackward(0.15);
        });

        document.getElementById('btn-fast-forward')?.addEventListener('click', () => {
            HistoryPlayback.skipForward(0.15);
        });

        // Speed slider with logarithmic scale
        setupSpeedSlider();

        // Timeline scrubber - click to seek
        const track = document.querySelector('.history-player__track');
        if (track) {
            track.addEventListener('click', (e) => {
                const rect = track.getBoundingClientRect();
                const position = (e.clientX - rect.left) / rect.width;
                HistoryPlayback.seekTo(position);
            });
        }

        // Thumb drag functionality
        const thumb = document.querySelector('.history-player__thumb');
        if (thumb && track) {
            let isDragging = false;

            thumb.addEventListener('mousedown', (e) => {
                isDragging = true;
                // Pause during drag
                if (HistoryPlayback.getIsPlaying()) {
                    HistoryPlayback.pause();
                }
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const rect = track.getBoundingClientRect();
                const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                HistoryPlayback.seekTo(position);
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
        }

        // Date range button
        const rangeBtn = document.getElementById('btn-date-range');
        if (rangeBtn) {
            rangeBtn.addEventListener('click', openDatePicker);
        }

        // Navigation buttons for shifting/extending date range
        document.getElementById('btn-prev-day')?.addEventListener('click', () => shiftDateRange(-1));
        document.getElementById('btn-next-day')?.addEventListener('click', () => shiftDateRange(1));
        document.getElementById('btn-extend-start')?.addEventListener('click', () => extendDateRange('start', -1));
        document.getElementById('btn-extend-end')?.addEventListener('click', () => extendDateRange('end', 1));

        // Setup date picker
        setupDatePicker();
    }

    /**
     * Setup date picker modal
     */
    function setupDatePicker() {
        const picker = document.getElementById('date-range-picker');
        if (!picker) return;

        // Preset buttons
        const presetBtns = picker.querySelectorAll('.date-range-picker__preset');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('date-range-picker__preset--active'));
                btn.classList.add('date-range-picker__preset--active');

                const hours = btn.dataset.hours;
                const customFields = document.getElementById('custom-range-fields');

                if (hours === 'custom') {
                    customFields.style.display = 'flex';
                    // Set defaults
                    const now = new Date();
                    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    document.getElementById('range-start').value = formatDateTimeLocal(yesterday);
                    document.getElementById('range-end').value = formatDateTimeLocal(now);
                } else {
                    customFields.style.display = 'none';
                }
            });
        });

        // Close button
        document.getElementById('date-picker-close')?.addEventListener('click', closeDatePicker);
        document.getElementById('date-picker-cancel')?.addEventListener('click', closeDatePicker);

        // Apply button
        document.getElementById('date-picker-apply')?.addEventListener('click', applyDateRange);
    }

    /**
     * Format date for datetime-local input
     */
    function formatDateTimeLocal(date) {
        const pad = n => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /**
     * Open date picker
     */
    function openDatePicker() {
        const picker = document.getElementById('date-range-picker');
        if (picker) {
            picker.style.display = 'block';
            // Add overlay
            let overlay = document.querySelector('.date-picker-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'date-picker-overlay';
                overlay.addEventListener('click', closeDatePicker);
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'block';
        }
    }

    /**
     * Close date picker
     */
    function closeDatePicker() {
        const picker = document.getElementById('date-range-picker');
        if (picker) picker.style.display = 'none';

        const overlay = document.querySelector('.date-picker-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * Apply selected date range
     */
    async function applyDateRange() {
        const picker = document.getElementById('date-range-picker');
        const activePreset = picker?.querySelector('.date-range-picker__preset--active');

        let startDate, endDate;
        const now = new Date();

        const hours = activePreset?.dataset.hours;

        if (hours === 'custom') {
            const startInput = document.getElementById('range-start');
            const endInput = document.getElementById('range-end');
            startDate = new Date(startInput.value);
            endDate = new Date(endInput.value);
        } else {
            const hoursNum = parseInt(hours) || 24;
            endDate = now;
            startDate = new Date(now.getTime() - hoursNum * 60 * 60 * 1000);
        }

        // Update range label
        const rangeLabel = document.querySelector('.history-player__range-label');
        if (rangeLabel) {
            if (hours === 'custom') {
                rangeLabel.textContent = 'Custom';
            } else if (hours === '24') {
                rangeLabel.textContent = 'Last 24h';
            } else if (hours === '48') {
                rangeLabel.textContent = 'Last 48h';
            } else if (hours === '168') {
                rangeLabel.textContent = 'Last 7 days';
            }
        }

        closeDatePicker();

        // Set date range in playback module
        HistoryPlayback.setDateRange(startDate, endDate);

        // Reload trail data
        await loadPlaybackData();
    }

    /**
     * Shift the date range forward or backward by a number of days
     */
    async function shiftDateRange(days) {
        const { start, end } = HistoryPlayback.getDateRange();
        const msPerDay = 24 * 60 * 60 * 1000;

        const newStart = new Date(start.getTime() + days * msPerDay);
        const newEnd = new Date(end.getTime() + days * msPerDay);

        // Don't allow future dates
        const now = new Date();
        if (newEnd > now) {
            showToast('Cannot select future dates');
            return;
        }

        HistoryPlayback.setDateRange(newStart, newEnd);
        updateRangeLabelCustom(newStart, newEnd);
        await loadPlaybackData();
    }

    /**
     * Extend the date range by adding/subtracting days from start or end
     */
    async function extendDateRange(bound, days) {
        const { start, end } = HistoryPlayback.getDateRange();
        const msPerDay = 24 * 60 * 60 * 1000;

        let newStart = start;
        let newEnd = end;

        if (bound === 'start') {
            newStart = new Date(start.getTime() + days * msPerDay);
        } else {
            newEnd = new Date(end.getTime() + days * msPerDay);
        }

        // Don't allow future dates
        const now = new Date();
        if (newEnd > now) {
            showToast('Cannot select future dates');
            return;
        }

        // Ensure start is before end
        if (newStart >= newEnd) {
            showToast('Start must be before end');
            return;
        }

        HistoryPlayback.setDateRange(newStart, newEnd);
        updateRangeLabelCustom(newStart, newEnd);
        await loadPlaybackData();
    }

    /**
     * Update the range label to show custom date range
     */
    function updateRangeLabelCustom(start, end) {
        const rangeLabel = document.querySelector('.history-player__range-label');
        if (!rangeLabel) return;

        const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        rangeLabel.textContent = `${formatDate(start)} - ${formatDate(end)}`;
    }

    /**
     * Start history playback mode for a vehicle
     */
    async function startHistoryPlayback(vehicleId) {
        playbackVehicleId = vehicleId;
        const vehicle = VehicleData.getVehicle(vehicleId);

        if (!vehicle) {
            showToast('Vehicle not found');
            return;
        }

        // Update header
        document.querySelector('.history-player__title').textContent = 'History Playback';
        const subtitleEl = document.getElementById('history-vehicle-name');
        if (subtitleEl) {
            subtitleEl.textContent = `${vehicle.name} (${vehicle.licensePlate || vehicle.id})`;
        }

        // Reset speed display
        const speedDisplay = document.getElementById('playback-speed');
        if (speedDisplay) {
            speedDisplay.textContent = '0';
        }

        // Show loading state
        showToast('Loading history data...');

        // Load playback data
        await loadPlaybackData();
    }

    /**
     * Load playback data for current vehicle and date range
     */
    async function loadPlaybackData() {
        if (!playbackVehicleId) return;

        // Capture current ID to handle race conditions
        const currentReqId = playbackVehicleId;

        const vehicle = VehicleData.getVehicle(playbackVehicleId);
        const result = await HistoryPlayback.loadTrail(playbackVehicleId, vehicle?.name);

        // If global ID changed (e.g. user closed history or switched vehicle), abort
        if (playbackVehicleId !== currentReqId) {
            console.log('Playback request cancelled due to state change');
            return;
        }

        if (!result.success) {
            showToast(result.message || 'No history data available');
            return;
        }

        showToast(`Loaded ${result.pointCount} location points`);

        // Hide all other markers
        MapModule.hideAllVehicleMarkers();
        MapModule.hideVehiclePopup();
        MapModule.clearPath();

        // Start visualization on map
        const map = MapModule.getMap();
        HistoryPlayback.startVisualization(map);

        // Update timeline labels with actual data range
        const summary = HistoryPlayback.getTrailSummary();
        if (summary.startTime && summary.endTime) {
            updateTimelineLabels(summary.startTime, summary.endTime);
        }

        // Update date display
        const dateDisplay = document.getElementById('playback-date');
        if (dateDisplay && summary.startTime) {
            dateDisplay.textContent = summary.startTime.toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
            });
        }

        isPlaybackActive = true;
        document.getElementById('history-player')?.classList.add('history-player--playback-active');
    }

    /**
     * Toggle playback
     */
    function togglePlayback() {
        if (!isPlaybackActive) {
            showToast('No playback data loaded');
            return;
        }

        const map = MapModule.getMap();
        HistoryPlayback.togglePlay(map);
    }

    /**
     * Close history player and cleanup
     */
    let isCleaningUpHistory = false;

    /**
     * Close history player and cleanup
     */
    function cleanupHistoryPlayback() {
        if (isCleaningUpHistory) return;
        isCleaningUpHistory = true;

        try {
            // Stop playback
            HistoryPlayback.pause();

            // Clear visualization
            const map = MapModule.getMap();
            if (map) {
                HistoryPlayback.clearVisualization(map);
                MapModule.showAllVehicleMarkers();
                MapModule.clearPath();
            }

            // Reset state
            isPlaybackActive = false;
            playbackVehicleId = null;
            document.getElementById('history-player')?.classList.remove('history-player--playback-active');

            // Reset UI
            updatePlayPauseIcon(false);
            const progress = document.querySelector('.history-player__track-progress');
            const thumb = document.querySelector('.history-player__thumb');
            if (progress) progress.style.width = '0%';
            if (thumb) thumb.style.left = '0%';
        } catch (error) {
            console.error('Error during history cleanup:', error);
            // Ensure state is reset even on error
            isPlaybackActive = false;
            playbackVehicleId = null;
        } finally {
            isCleaningUpHistory = false;
        }
    }

    /**
     * Close history player and cleanup
     */
    function closeHistoryPlayer() {
        cleanupHistoryPlayback();

        // Update state
        State.setState({ bottomBar: null, currentView: 'live' });
    }

    /**
     * Handle position change from playback module
     */
    function handlePlaybackPositionChange(data) {
        // Update scrubber
        const progress = document.querySelector('.history-player__track-progress');
        const thumb = document.querySelector('.history-player__thumb');

        if (progress) progress.style.width = (data.normalizedPos * 100) + '%';
        if (thumb) thumb.style.left = (data.normalizedPos * 100) + '%';

        // Update time display
        const timeDisplay = document.getElementById('playback-time');
        if (timeDisplay && data.timestamp) {
            timeDisplay.textContent = data.timestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        }

        // Update date display
        const dateDisplay = document.getElementById('playback-date');
        if (dateDisplay && data.timestamp) {
            dateDisplay.textContent = data.timestamp.toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
            });
        }

        // Update speed display
        const speedDisplay = document.getElementById('playback-speed');
        if (speedDisplay) {
            const speed = Math.round(data.speed || 0);
            speedDisplay.textContent = speed;
        }
    }

    /**
     * Handle play state change from playback module
     */
    function handlePlaybackStateChange(data) {
        updatePlayPauseIcon(data.playing);

        State.setState({
            historyPlayback: {
                ...State.getState().historyPlayback,
                playing: data.playing
            }
        });
    }

    /**
     * Update timeline position (called from scrubber click)
     * Deprecated - now using HistoryPlayback.seekTo
     */
    function updateTimelinePosition(position) {
        position = Math.max(0, Math.min(1, position));
        HistoryPlayback.seekTo(position);
    }

    /**
     * Minimum width needed for bottom bar content to display properly
     * Based on Figma: controls need ~800px minimum to not overlap
     */
    const BOTTOM_BAR_MIN_WIDTH = 800;

    /**
     * Overlap breakpoint - below this width, sidebar and bottom bar would overlap
     * This is sidebar width (326px) + bottom bar min width (800px) = 1126px
     */
    const OVERLAP_BREAKPOINT = 1126;

    /**
     * Check if sidebar and bottom bar would overlap at current width
     */
    function wouldOverlap() {
        return window.innerWidth < OVERLAP_BREAKPOINT;
    }

    // Expose for other modules
    window.wouldOverlap = wouldOverlap;

    /**
     * Check if there's enough space for bottom bar beside sidebar
     */
    function hasEnoughSpaceForBottomBarBeside() {
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 326;
        const availableWidth = window.innerWidth - sidebarWidth;
        return availableWidth >= BOTTOM_BAR_MIN_WIDTH;
    }

    /**
     * Update history player layout based on available space
     */
    function updateHistoryPlayerLayout(state) {
        const historyPlayer = document.getElementById('history-player');
        const vehiclesSidebar = document.getElementById('vehicles-sidebar');
        const incidentsSidebar = document.getElementById('incidents-sidebar');

        if (!historyPlayer) return;

        // Remove all layout classes
        historyPlayer.classList.remove('history-player--beside', 'history-player--full');

        // Only remove sidebar shortening if dispatch is not also active
        if (state.bottomBar !== 'dispatch') {
            vehiclesSidebar.classList.remove('sidebar--shortened');
            incidentsSidebar.classList.remove('sidebar--shortened');
        }

        // If history player is not visible, nothing more to do
        if (state.bottomBar !== 'history') return;

        // Check if a sidebar is open
        const sidebarOpen = state.activeSidebar !== null;

        if (sidebarOpen) {
            if (hasEnoughSpaceForBottomBarBeside()) {
                // Enough space: history player beside sidebar
                historyPlayer.classList.add('history-player--beside');
            } else {
                // Not enough space: full width, sidebar shortened
                historyPlayer.classList.add('history-player--full');
                if (state.activeSidebar === 'vehicles') {
                    vehiclesSidebar.classList.add('sidebar--shortened');
                } else if (state.activeSidebar === 'incidents') {
                    incidentsSidebar.classList.add('sidebar--shortened');
                }
            }
        } else {
            // No sidebar open: full width
            historyPlayer.classList.add('history-player--full');
        }
    }

    /**
     * Update dispatch panel layout based on available space
     */
    function updateDispatchPanelLayout(state) {
        const dispatchPanel = document.getElementById('dispatch-bar');
        const vehiclesSidebar = document.getElementById('vehicles-sidebar');
        const incidentsSidebar = document.getElementById('incidents-sidebar');
        const mapElement = document.getElementById('map');

        if (!dispatchPanel) return;

        // Remove all layout classes
        dispatchPanel.classList.remove('dispatch-panel--beside', 'dispatch-panel--full', 'dispatch-panel--with-sidebar');

        // Only remove sidebar shortening if history is not also active
        if (state.bottomBar !== 'history') {
            vehiclesSidebar.classList.remove('sidebar--shortened-lg');
            incidentsSidebar.classList.remove('sidebar--shortened-lg');
        }

        // If dispatch panel is not visible, reset map bottom and return
        if (state.bottomBar !== 'dispatch') {
            if (mapElement) {
                mapElement.style.bottom = '';
            }
            return;
        }

        // Check if a sidebar is open
        const sidebarOpen = state.activeSidebar !== null;

        if (sidebarOpen) {
            if (hasEnoughSpaceForBottomBarBeside()) {
                // Enough space: dispatch panel beside sidebar
                dispatchPanel.classList.add('dispatch-panel--beside');
            } else {
                // Not enough space: full width, sidebar shortened (pushed up)
                dispatchPanel.classList.add('dispatch-panel--full', 'dispatch-panel--with-sidebar');
                if (state.activeSidebar === 'vehicles') {
                    vehiclesSidebar.classList.add('sidebar--shortened-lg');
                } else if (state.activeSidebar === 'incidents') {
                    incidentsSidebar.classList.add('sidebar--shortened-lg');
                }
            }
        } else {
            // No sidebar open: full width from edge
            dispatchPanel.classList.add('dispatch-panel--full');
        }

        // Dynamically set map bottom based on actual panel height
        if (mapElement) {
            // Use requestAnimationFrame to ensure DOM has updated
            requestAnimationFrame(() => {
                const panelHeight = dispatchPanel.offsetHeight;
                mapElement.style.bottom = panelHeight + 'px';
            });
        }
    }

    let previousBottomBar = null;
    let previousIncidentId = null;
    let previousHistoryVehicleId = null;

    /**
     * Handle state changes
     */
    function handleStateChange(state) {
        // Check if history bar is being hidden (transitioning away from 'history')
        if (previousBottomBar === 'history' && state.bottomBar !== 'history') {
            cleanupHistoryPlayback();
        }

        // Check if starting history playback (transitioning TO 'history' or changing vehicle)
        if (state.bottomBar === 'history' && (previousBottomBar !== 'history' || state.historyVehicleId !== previousHistoryVehicleId)) {
            if (state.historyVehicleId) {
                startHistoryPlayback(state.historyVehicleId);
            }
        }

        // Update bottom bar visibility
        const dispatchBar = document.getElementById('dispatch-bar');
        const historyPlayer = document.getElementById('history-player');
        const app = document.getElementById('app');

        // Hide all bottom bars
        dispatchBar.classList.remove('bottombar--visible');
        historyPlayer.classList.remove('bottombar--visible');
        app.classList.remove('app--bottombar-visible', 'app--bottombar-sm');

        // Show appropriate bottom bar
        if (state.bottomBar === 'dispatch') {
            dispatchBar.classList.add('bottombar--visible');
            app.classList.add('app--bottombar-visible');

            // Reset dispatch state when dispatch panel is newly opened OR incident changed
            if (previousBottomBar !== 'dispatch' || previousIncidentId !== state.selectedIncident) {
                resetDispatchState();
                checkIncidentStatus(state.selectedIncident);
            }
        } else if (state.bottomBar === 'history') {
            historyPlayer.classList.add('bottombar--visible');
            app.classList.add('app--bottombar-sm');
        }

        // Update previous state
        previousBottomBar = state.bottomBar;
        previousIncidentId = state.selectedIncident;
        previousHistoryVehicleId = state.historyVehicleId;

        // Update layouts (dynamic positioning)
        updateHistoryPlayerLayout(state);
        updateDispatchPanelLayout(state);

        // Dynamically set map bottom based on actual bottom bar height
        const mapEl = document.getElementById('map');
        if (state.bottomBar === 'history' && historyPlayer) {
            // Use requestAnimationFrame to ensure layout is calculated
            requestAnimationFrame(() => {
                const actualHeight = historyPlayer.offsetHeight;
                mapEl.style.bottom = actualHeight + 'px';
                // Recalculate after transition
                setTimeout(() => {
                    const map = MapModule.getMap();
                    if (map) map.invalidateSize({ pan: false });
                }, 350);
            });
        } else if (state.bottomBar === 'dispatch' && dispatchBar) {
            requestAnimationFrame(() => {
                const actualHeight = dispatchBar.offsetHeight;
                mapEl.style.bottom = actualHeight + 'px';
                setTimeout(() => {
                    const map = MapModule.getMap();
                    if (map) map.invalidateSize({ pan: false });
                }, 350);
            });
        } else {
            // No bottom bar - reset map and recalculate
            mapEl.style.bottom = '0';
            // Force immediate recalculation
            const map = MapModule.getMap();
            if (map) {
                // Trigger window resize which Leaflet reliably listens to
                window.dispatchEvent(new Event('resize'));
                // Also call invalidateSize after transition
                setTimeout(() => {
                    map.invalidateSize({ pan: false });
                    window.dispatchEvent(new Event('resize'));
                }, 350);
            }
        }

        // Update play/pause icon
        updatePlayPauseIcon(state.historyPlayback.playing);
    }

    /**
     * Update play/pause button icon
     */
    function updatePlayPauseIcon(isPlaying) {
        const playBtn = document.querySelector('.history-player__play-btn');
        if (!playBtn) return;

        if (isPlaying) {
            playBtn.innerHTML = `<span class="material-symbols-outlined icon-filled">pause</span>`;
        } else {
            playBtn.innerHTML = `<span class="material-symbols-outlined icon-filled">play_arrow</span>`;
        }
    }

    // Public API
    return {
        init
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
