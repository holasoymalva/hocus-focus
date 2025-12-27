// State
let blockingActive = false;
let timerActive = false;
let timerInterval = null;
let timerEndTime = null;
let currentStats = { totalTimeSaved: 0, sessionsBlocked: 0, sitesBlocked: 0 };

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupEventListeners();
    setupDashboard(); // Initialize dashboard graph
    await loadInitialData();
    setupIPCListeners();
});

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.dataset.view;

            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => view.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`${viewId}-view`).classList.add('active');
        });
    });
}

// Event Listeners
function setupEventListeners() {
    // Blocking toggle
    document.getElementById('blocking-toggle').addEventListener('click', async () => {
        const result = await window.electronAPI.toggleBlocking();
        if (result.success && result.duration) {
            showTimerModal(result.duration);
        }
    });

    // Schedule modal
    document.getElementById('add-schedule').addEventListener('click', () => {
        document.getElementById('schedule-modal').classList.add('active');
    });

    document.getElementById('close-schedule-modal').addEventListener('click', () => {
        document.getElementById('schedule-modal').classList.remove('active');
    });

    document.getElementById('cancel-schedule').addEventListener('click', () => {
        document.getElementById('schedule-modal').classList.remove('active');
    });

    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSchedule();
    });

    // Add site
    document.getElementById('add-site-btn').addEventListener('click', async () => {
        await addSite();
    });

    document.getElementById('site-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await addSite();
        }
    });

    // Search sites
    document.getElementById('search-sites').addEventListener('input', (e) => {
        filterSites(e.target.value);
    });

    // Cancel timer
    document.getElementById('cancel-timer').addEventListener('click', async () => {
        await window.electronAPI.cancelTimer();
        document.getElementById('timer-modal').classList.remove('active');
        stopTimerCountdown();
    });

    // Close detail modal
    document.getElementById('close-detail-modal').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.remove('active');
    });

    document.getElementById('ok-detail').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.remove('active');
    });

    // Grant admin access
    document.getElementById('grant-admin').addEventListener('click', async () => {
        const result = await window.electronAPI.toggleBlocking();
        if (result.success) {
            alert('¡Acceso de administrador concedido con éxito!');
        }
    });

    // Data management
    document.getElementById('export-data').addEventListener('click', async () => {
        const result = await window.electronAPI.exportData();
        if (result.success) {
            alert('Datos exportados con éxito');
        }
    });

    document.getElementById('import-data').addEventListener('click', async () => {
        const result = await window.electronAPI.importData();
        if (result.success) {
            alert('Datos importados con éxito');
            await loadInitialData();
        } else if (result.message) {
            alert(result.message);
        }
    });

    document.getElementById('clear-app-data').addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres eliminar TODOS los datos? Esta acción no se puede deshacer.')) {
            const result = await window.electronAPI.clearAppData();
            if (result.success) {
                alert('Todos los datos han sido eliminados');
                await loadInitialData();
            }
        }
    });
}

// IPC Listeners
function setupIPCListeners() {
    window.electronAPI.onBlockingStatus((status) => {
        updateBlockingStatus(status);
    });

    window.electronAPI.onStatsUpdate((stats) => {
        updateStats(stats);
    });

    window.electronAPI.onTimerStarted((duration) => {
        showTimerModal(duration);
    });
}

// Load initial data
async function loadInitialData() {
    const status = await window.electronAPI.getBlockingStatus();
    updateBlockingStatus(status);

    const stats = await window.electronAPI.getStats();
    updateStats(stats);

    const schedules = await window.electronAPI.getSchedules();
    renderSchedules(schedules);

    const sites = await window.electronAPI.getBlockedSites();
    renderSites(sites);
    renderQuickAdd();
}

// Update blocking status
function updateBlockingStatus(active) {
    blockingActive = active;

    const sidebarStatus = document.getElementById('sidebar-status');
    const blockingToggle = document.getElementById('blocking-toggle');
    const toggleTitle = blockingToggle.querySelector('.toggle-title');
    const toggleSubtitle = blockingToggle.querySelector('.toggle-subtitle');

    if (active) {
        sidebarStatus.classList.add('active');
        sidebarStatus.querySelector('span:last-child').textContent = 'Activo';
        blockingToggle.classList.add('active');
        toggleTitle.textContent = 'Bloqueo Activo';
        toggleSubtitle.textContent = 'Toca para desactivar';
    } else {
        sidebarStatus.classList.remove('active');
        sidebarStatus.querySelector('span:last-child').textContent = 'Inactivo';
        blockingToggle.classList.remove('active');
        toggleTitle.textContent = 'Bloqueo Inactivo';
        toggleSubtitle.textContent = 'Toca para activar';
    }
}

// Timer modal
function showTimerModal(durationMinutes) {
    document.getElementById('timer-modal').classList.add('active');
    startTimerCountdown(durationMinutes);
}

function startTimerCountdown(durationMinutes) {
    timerActive = true;
    timerEndTime = Date.now() + (durationMinutes * 60 * 1000);

    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimerCountdown() {
    timerActive = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    if (!timerActive) return;

    const remaining = Math.max(0, timerEndTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    document.getElementById('timer-countdown').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (remaining === 0) {
        stopTimerCountdown();
        document.getElementById('timer-modal').classList.remove('active');
    }
}

// Activity Detail Modal
function showDetailModal(label, value, periodType) {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('detail-title');
    const timeVal = document.getElementById('detail-time-saved');
    const status = document.getElementById('detail-status');
    const desc = document.getElementById('detail-description');

    title.textContent = `Actividad: ${label}`;
    timeVal.textContent = value;

    // Status based on value
    const numericValue = parseFloat(value);
    if (numericValue > 4 || (periodType === 'Hoy' && numericValue > 45)) {
        status.textContent = 'Altamente Enfocado';
        status.style.color = 'var(--accent-success)';
    } else if (numericValue > 0) {
        status.textContent = 'Productivo';
        status.style.color = 'var(--accent-primary)';
    } else {
        status.textContent = 'Sin Actividad';
        status.style.color = 'var(--text-tertiary)';
    }

    desc.textContent = `Durante este período de ${periodType}, recuperaste con éxito ${value} de tiempo de enfoque bloqueando distracciones. ¡Sigue así!`;

    modal.classList.add('active');
}

// Update stats
function updateStats(stats) {
    currentStats = stats;

    const hours = (stats.totalTimeSaved / 60).toFixed(1);
    document.getElementById('time-recovered').textContent = hours;

    const sitesCount = document.querySelectorAll('.site-item').length;
    document.getElementById('sites-blocked').textContent = sitesCount;

    document.getElementById('focus-sessions').textContent = stats.sessionsBlocked;
}

// Schedules
async function saveSchedule() {
    const name = document.getElementById('schedule-name').value;
    const startHour = parseInt(document.getElementById('start-hour').value);
    const startMinute = parseInt(document.getElementById('start-minute').value);
    const endHour = parseInt(document.getElementById('end-hour').value);
    const endMinute = parseInt(document.getElementById('end-minute').value);

    const dayCheckboxes = document.querySelectorAll('.day-checkbox input:checked');
    const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    if (days.length === 0) {
        alert('Por favor, selecciona al menos un día');
        return;
    }

    const schedule = {
        name,
        startHour,
        startMinute,
        endHour,
        endMinute,
        days,
        enabled: true
    };

    await window.electronAPI.saveSchedule(schedule);

    document.getElementById('schedule-modal').classList.remove('active');
    document.getElementById('schedule-form').reset();

    const schedules = await window.electronAPI.getSchedules();
    renderSchedules(schedules);
}

function renderSchedules(schedules) {
    const container = document.getElementById('schedules-list');

    if (schedules.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay horarios configurados aún</p>';
        return;
    }

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    container.innerHTML = schedules.map(schedule => `
    <div class="schedule-item">
      <label class="schedule-toggle">
        <input type="checkbox" ${schedule.enabled ? 'checked' : ''} onchange="toggleSchedule('${schedule.id}', this.checked)">
        <span class="schedule-toggle-slider"></span>
      </label>
      <div class="schedule-info">
        <div class="schedule-name">${schedule.name}</div>
        <div class="schedule-details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMinute).padStart(2, '0')} - ${String(schedule.endHour).padStart(2, '0')}:${String(schedule.endMinute).padStart(2, '0')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${schedule.days.map(d => dayNames[d]).join(', ')}</span>
        </div>
      </div>
      <div class="schedule-actions">
        <button class="btn-icon" onclick="editSchedule('${schedule.id}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn-icon danger" onclick="deleteSchedule('${schedule.id}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

    // Update next session
    if (schedules.length > 0) {
        document.getElementById('next-session-name').textContent = schedules[0].name;
    }
}

async function toggleSchedule(scheduleId, enabled) {
    const schedules = await window.electronAPI.getSchedules();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) {
        schedule.enabled = enabled;
        await window.electronAPI.saveSchedule(schedule);
    }
}

async function deleteSchedule(scheduleId) {
    if (confirm('¿Estás seguro de que quieres eliminar este horario?')) {
        await window.electronAPI.deleteSchedule(scheduleId);
        const schedules = await window.electronAPI.getSchedules();
        renderSchedules(schedules);
    }
}

function editSchedule(scheduleId) {
    // TODO: Implement edit functionality
    alert('¡Funcionalidad de edición próximamente!');
}

// Sites
async function addSite() {
    const input = document.getElementById('site-input');
    const url = input.value.trim();

    if (!url) {
        alert('Por favor, introduce una URL válida');
        return;
    }

    const result = await window.electronAPI.addBlockedSite(url);

    if (result.success) {
        input.value = '';
        const sites = await window.electronAPI.getBlockedSites();
        renderSites(sites);
        updateStats(currentStats);
    } else {
        alert(result.message);
    }
}

function renderSites(sites) {
    const container = document.getElementById('sites-list');

    if (sites.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay sitios bloqueados aún</p>';
        return;
    }

    container.innerHTML = sites.map(site => `
    <div class="site-item" data-site="${site}">
      <div class="site-info">
        <div class="site-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
        <span class="site-name">${site}</span>
      </div>
      <button class="btn-icon danger" onclick="removeSite('${site}')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');
}

function filterSites(query) {
    const items = document.querySelectorAll('.site-item');
    const lowerQuery = query.toLowerCase();

    items.forEach(item => {
        const site = item.dataset.site.toLowerCase();
        if (site.includes(lowerQuery)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

async function removeSite(site) {
    if (confirm(`¿Eliminar ${site} de la lista de bloqueo?`)) {
        await window.electronAPI.removeBlockedSite(site);
        const sites = await window.electronAPI.getBlockedSites();
        renderSites(sites);
        updateStats(currentStats);
    }
}

function renderQuickAdd() {
    const container = document.getElementById('quick-add-buttons');
    const commonSites = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com'];

    container.innerHTML = commonSites.map(site => `
    <button class="quick-add-btn" onclick="quickAddSite('${site}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      ${site}
    </button>
  `).join('');
}

async function quickAddSite(site) {
    const result = await window.electronAPI.addBlockedSite(site);
    if (result.success) {
        const sites = await window.electronAPI.getBlockedSites();
        renderSites(sites);
        updateStats(currentStats);
    }
}

// Make functions global for onclick handlers
window.toggleSchedule = toggleSchedule;
window.deleteSchedule = deleteSchedule;
window.editSchedule = editSchedule;
window.removeSite = removeSite;
window.quickAddSite = quickAddSite;

// Dashboard Graph Logic - Annual Contribution Graph
let activityData = {};

function setupDashboard() {
    // Load activity data and render
    loadActivityData();
}

async function loadActivityData() {
    const stats = await window.electronAPI.getStats();
    activityData = stats.activityData || {};
    renderAnnualGraph();
}

function renderAnnualGraph() {
    const container = document.getElementById('contribution-graph');
    container.className = 'contribution-graph annual-view';
    container.innerHTML = '';

    // Generate 52 weeks of data (last 365 days)
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(today.getDate() - 364); // 365 days including today

    // Adjust to start from Sunday
    const startDay = new Date(oneYearAgo);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    // Generate month labels
    const monthLabels = document.createElement('div');
    monthLabels.className = 'month-labels';

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let currentMonth = startDay.getMonth();
    let weekCount = 0;

    for (let week = 0; week < 53; week++) {
        const weekDate = new Date(startDay);
        weekDate.setDate(weekDate.getDate() + (week * 7));
        const month = weekDate.getMonth();

        if (month !== currentMonth || week === 0) {
            const label = document.createElement('span');
            label.className = 'month-label';
            label.textContent = months[month];
            label.style.gridColumn = week + 1;
            monthLabels.appendChild(label);
            currentMonth = month;
        }
    }
    container.appendChild(monthLabels);

    // Generate grid container
    const grid = document.createElement('div');
    grid.className = 'contribution-grid';

    // Generate day labels
    const dayLabels = document.createElement('div');
    dayLabels.className = 'day-labels';
    const dayNames = ['Lun', 'Mié', 'Vie'];
    [1, 3, 5].forEach((day, index) => {
        const label = document.createElement('span');
        label.className = 'day-label';
        label.textContent = dayNames[index];
        label.style.gridRow = day + 1;
        dayLabels.appendChild(label);
    });
    grid.appendChild(dayLabels);

    // Generate cells (7 rows x 53 columns)
    for (let week = 0; week < 53; week++) {
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startDay);
            currentDate.setDate(currentDate.getDate() + (week * 7) + day);

            // Only show cells within the year range
            if (currentDate <= today) {
                const dateKey = formatDateKey(currentDate);
                const minutesSaved = activityData[dateKey] || 0;
                const level = getActivityLevel(minutesSaved);

                const cell = createAnnualCell(currentDate, minutesSaved, level);
                cell.style.gridColumn = week + 1;
                cell.style.gridRow = day + 1;
                grid.appendChild(cell);
            }
        }
    }

    container.appendChild(grid);
}

function createAnnualCell(date, minutes, level) {
    const cell = document.createElement('div');
    cell.className = `contribution-cell level-${level}`;

    const tooltip = document.createElement('div');
    tooltip.className = 'cell-tooltip';

    const dateStr = formatDateDisplay(date);
    const hours = (minutes / 60).toFixed(1);
    tooltip.textContent = minutes > 0
        ? `${dateStr}: ${hours} horas recuperadas`
        : `${dateStr}: Sin actividad`;

    cell.appendChild(tooltip);

    cell.addEventListener('click', () => {
        showAnnualDetailModal(date, minutes);
    });

    return cell;
}

function getActivityLevel(minutes) {
    // Convert minutes to levels (0-4)
    // 0: no activity
    // 1: 1-30 min
    // 2: 31-60 min
    // 3: 61-120 min
    // 4: 120+ min
    if (minutes === 0) return 0;
    if (minutes <= 30) return 1;
    if (minutes <= 60) return 2;
    if (minutes <= 120) return 3;
    return 4;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function showAnnualDetailModal(date, minutes) {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('detail-title');
    const timeVal = document.getElementById('detail-time-saved');
    const status = document.getElementById('detail-status');
    const desc = document.getElementById('detail-description');

    const dateStr = formatDateDisplay(date);
    const hours = (minutes / 60).toFixed(1);

    title.textContent = `Actividad: ${dateStr}`;
    timeVal.textContent = `${hours} horas`;

    if (minutes > 120) {
        status.textContent = 'Altamente Enfocado';
        status.style.color = 'var(--accent-primary)';
    } else if (minutes > 60) {
        status.textContent = 'Muy Productivo';
        status.style.color = 'var(--accent-purple)';
    } else if (minutes > 0) {
        status.textContent = 'Productivo';
        status.style.color = 'var(--accent-secondary)';
    } else {
        status.textContent = 'Sin Actividad';
        status.style.color = 'var(--text-tertiary)';
    }

    desc.textContent = minutes > 0
        ? `En esta fecha, recuperaste ${hours} horas de tiempo de enfoque bloqueando distracciones. ¡Sigue así!`
        : 'No hubo actividad registrada en esta fecha.';

    modal.classList.add('active');
}

// Function to add activity (called when blocking ends)
async function recordActivity(minutes) {
    const today = new Date();
    const dateKey = formatDateKey(today);

    activityData[dateKey] = (activityData[dateKey] || 0) + minutes;

    // Save to backend
    await window.electronAPI.saveActivityData(activityData);

    // Re-render graph
    renderAnnualGraph();
}
