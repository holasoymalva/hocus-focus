const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Blocking
    getBlockingStatus: () => ipcRenderer.invoke('get-blocking-status'),
    toggleBlocking: () => ipcRenderer.invoke('toggle-blocking'),
    cancelTimer: () => ipcRenderer.invoke('cancel-timer'),
    onBlockingStatus: (callback) => ipcRenderer.on('blocking-status', (event, status) => callback(status)),
    onBlockingError: (callback) => ipcRenderer.on('blocking-error', (event, error) => callback(error)),
    onTimerStarted: (callback) => ipcRenderer.on('timer-started', (event, duration) => callback(duration)),

    // Stats
    getStats: () => ipcRenderer.invoke('get-stats'),
    onStatsUpdate: (callback) => ipcRenderer.on('stats-update', (event, stats) => callback(stats)),
    saveActivityData: (data) => ipcRenderer.invoke('save-activity-data', data),

    // Schedules
    getSchedules: () => ipcRenderer.invoke('get-schedules'),
    saveSchedule: (schedule) => ipcRenderer.invoke('save-schedule', schedule),
    deleteSchedule: (scheduleId) => ipcRenderer.invoke('delete-schedule', scheduleId),

    // Blocked Sites
    getBlockedSites: () => ipcRenderer.invoke('get-blocked-sites'),
    addBlockedSite: (site) => ipcRenderer.invoke('add-blocked-site', site),
    removeBlockedSite: (site) => ipcRenderer.invoke('remove-blocked-site', site),

    // Data management
    exportData: () => ipcRenderer.invoke('export-data'),
    importData: () => ipcRenderer.invoke('import-data'),
    clearAppData: () => ipcRenderer.invoke('clear-app-data')
});
