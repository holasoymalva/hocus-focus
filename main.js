const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sudo = require('sudo-prompt');

let mainWindow;
let tray;
let blockingActive = false;
let deactivationTimer = null;
let schedules = [];
let stats = {
    totalTimeSaved: 0,
    sessionsBlocked: 0,
    sitesBlocked: 0,
    lastSession: null,
    activityData: {}
};

// Rutas importantes
const hostsPath = '/etc/hosts';
const hostsBackupPath = path.join(app.getPath('userData'), 'hosts.backup');
const configPath = path.join(app.getPath('userData'), 'config.json');
const statsPath = path.join(app.getPath('userData'), 'stats.json');

// Lista de sitios a bloquear
let blockedSites = [
    'facebook.com',
    'www.facebook.com',
    'twitter.com',
    'www.twitter.com',
    'x.com',
    'www.x.com',
    'instagram.com',
    'www.instagram.com',
    'tiktok.com',
    'www.tiktok.com',
    'youtube.com',
    'www.youtube.com',
    'reddit.com',
    'www.reddit.com',
    'netflix.com',
    'www.netflix.com',
    'twitch.tv',
    'www.twitch.tv',
    'pinterest.com',
    'www.pinterest.com',
    'linkedin.com',
    'www.linkedin.com',
    'snapchat.com',
    'www.snapchat.com'
];

// Cargar configuración y estadísticas
function loadData() {
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            schedules = config.schedules || [];
            blockingActive = config.blockingActive || false;
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }

    try {
        if (fs.existsSync(statsPath)) {
            stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Guardar configuración y estadísticas
function saveData() {
    try {
        fs.writeFileSync(configPath, JSON.stringify({ schedules, blockingActive }, null, 2));
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Modificar archivo hosts
function modifyHosts(block, callback) {
    const marker = '# Hocus Focus Block';

    fs.readFile(hostsPath, 'utf8', (err, data) => {
        if (err) {
            callback(err);
            return;
        }

        // Crear backup si no existe
        if (!fs.existsSync(hostsBackupPath)) {
            fs.writeFileSync(hostsBackupPath, data);
        }

        let newContent;
        if (block) {
            // Remover bloqueos anteriores
            const lines = data.split('\n').filter(line => !line.includes(marker));

            // Agregar nuevos bloqueos
            const blockLines = blockedSites.map(site => `127.0.0.1 ${site} ${marker}`);
            newContent = lines.join('\n') + '\n' + blockLines.join('\n') + '\n';
        } else {
            // Remover todos los bloqueos de Hocus Focus
            const lines = data.split('\n').filter(line => !line.includes(marker));
            newContent = lines.join('\n');
        }

        // Escribir con permisos de administrador
        const tempFile = path.join(app.getPath('temp'), 'hosts.tmp');
        fs.writeFileSync(tempFile, newContent);

        const options = {
            name: 'Hocus Focus'
        };

        sudo.exec(`cp "${tempFile}" "${hostsPath}"`, options, (error) => {
            fs.unlinkSync(tempFile);
            if (error) {
                callback(error);
            } else {
                // Limpiar caché DNS
                sudo.exec('dscacheutil -flushcache; sudo killall -HUP mDNSResponder', options, () => {
                    callback(null);
                });
            }
        });
    });
}

// Activar bloqueo
function activateBlocking() {
    modifyHosts(true, (err) => {
        if (err) {
            console.error('Error activating blocking:', err);
            if (mainWindow) {
                mainWindow.webContents.send('blocking-error', err.message);
            }
        } else {
            blockingActive = true;
            stats.lastSession = Date.now();
            saveData();
            updateTray();
            if (mainWindow) {
                mainWindow.webContents.send('blocking-status', true);
            }
        }
    });
}

// Desactivar bloqueo
function deactivateBlocking() {
    if (deactivationTimer) {
        clearTimeout(deactivationTimer);
        deactivationTimer = null;
    }

    modifyHosts(false, (err) => {
        if (err) {
            console.error('Error deactivating blocking:', err);
            if (mainWindow) {
                mainWindow.webContents.send('blocking-error', err.message);
            }
        } else {
            // Calcular tiempo ahorrado
            if (stats.lastSession) {
                const timeSaved = Math.floor((Date.now() - stats.lastSession) / 1000 / 60); // minutos
                stats.totalTimeSaved += timeSaved;
                stats.sessionsBlocked += 1;
            }

            blockingActive = false;
            saveData();
            updateTray();
            if (mainWindow) {
                mainWindow.webContents.send('blocking-status', false);
                mainWindow.webContents.send('stats-update', stats);
            }
        }
    });
}

// Iniciar timer de desactivación
function startDeactivationTimer() {
    if (deactivationTimer) {
        return { success: false, message: 'El temporizador ya está activo' };
    }

    const duration = 15 * 60 * 1000; // 15 minutos
    deactivationTimer = setTimeout(() => {
        deactivateBlocking();
    }, duration);

    return { success: true, duration: 15 };
}

// Cancelar timer de desactivación
function cancelDeactivationTimer() {
    if (deactivationTimer) {
        clearTimeout(deactivationTimer);
        deactivationTimer = null;
        return { success: true };
    }
    return { success: false, message: 'No hay ningún temporizador activo' };
}

// Verificar horarios
function checkSchedules() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();

    let shouldBlock = false;

    for (const schedule of schedules) {
        if (!schedule.enabled) continue;
        if (!schedule.days.includes(currentDay)) continue;

        const startTime = schedule.startHour * 60 + schedule.startMinute;
        const endTime = schedule.endHour * 60 + schedule.endMinute;

        if (currentTime >= startTime && currentTime < endTime) {
            shouldBlock = true;
            break;
        }
    }

    if (shouldBlock && !blockingActive) {
        activateBlocking();
    } else if (!shouldBlock && blockingActive && schedules.length > 0) {
        // Solo desactivar automáticamente si hay horarios configurados
        deactivateBlocking();
    }
}

// Actualizar tray icon
function updateTray() {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
        {
            label: blockingActive ? '🔒 Bloqueo Activo' : '🔓 Bloqueo Inactivo',
            enabled: false
        },
        { type: 'separator' },
        {
            label: blockingActive ? 'Desactivar (Timer 15 min)' : 'Activar Bloqueo',
            click: () => {
                if (blockingActive) {
                    startDeactivationTimer();
                    if (mainWindow) {
                        mainWindow.webContents.send('timer-started', 15);
                    }
                } else {
                    activateBlocking();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Mostrar Ventana',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                }
            }
        },
        {
            label: 'Salir',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip(blockingActive ? 'Hocus Focus - Activo' : 'Hocus Focus - Inactivo');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f0f1e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Crear tray icon
    const iconPath = path.join(__dirname, 'Icon-App.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    updateTray();
}

app.whenReady().then(() => {
    loadData();
    createWindow();

    // Verificar horarios cada minuto
    setInterval(checkSchedules, 60000);
    checkSchedules();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // No cerrar la app en macOS cuando se cierran todas las ventanas
});

app.on('before-quit', () => {
    app.isQuitting = true;
});

// IPC Handlers
ipcMain.handle('get-blocking-status', () => {
    return blockingActive;
});

ipcMain.handle('toggle-blocking', () => {
    if (blockingActive) {
        const result = startDeactivationTimer();
        return result;
    } else {
        activateBlocking();
        return { success: true };
    }
});

ipcMain.handle('cancel-timer', () => {
    return cancelDeactivationTimer();
});

ipcMain.handle('get-stats', () => {
    return stats;
});

ipcMain.handle('save-activity-data', (event, activityData) => {
    stats.activityData = activityData;
    saveData();
    return { success: true };
});

ipcMain.handle('get-schedules', () => {
    return schedules;
});

ipcMain.handle('save-schedule', (event, schedule) => {
    if (schedule.id) {
        const index = schedules.findIndex(s => s.id === schedule.id);
        if (index !== -1) {
            schedules[index] = schedule;
        }
    } else {
        schedule.id = Date.now().toString();
        schedules.push(schedule);
    }
    saveData();
    checkSchedules();
    return { success: true };
});

ipcMain.handle('delete-schedule', (event, scheduleId) => {
    schedules = schedules.filter(s => s.id !== scheduleId);
    saveData();
    checkSchedules();
    return { success: true };
});

ipcMain.handle('get-blocked-sites', () => {
    return blockedSites;
});

ipcMain.handle('add-blocked-site', (event, site) => {
    if (!blockedSites.includes(site)) {
        blockedSites.push(site);
        if (blockingActive) {
            activateBlocking(); // Reactivar para incluir el nuevo sitio
        }
        return { success: true };
    }
    return { success: false, message: 'El sitio ya está en la lista' };
});

ipcMain.handle('remove-blocked-site', (event, site) => {
    const index = blockedSites.indexOf(site);
    if (index !== -1) {
        blockedSites.splice(index, 1);
        if (blockingActive) {
            activateBlocking(); // Reactivar para actualizar
        }
        return { success: true };
    }
    return { success: false, message: 'Sitio no encontrado' };
});

ipcMain.handle('export-data', async () => {
    const data = {
        schedules,
        blockedSites,
        stats,
        exportDate: new Date().toISOString()
    };

    const { filePath } = await dialog.showSaveDialog({
        title: 'Exportar Datos de Hocus Focus',
        defaultPath: path.join(app.getPath('downloads'), 'hocus-focus-data.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePath) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('import-data', async () => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Importar Datos de Hocus Focus',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
            if (data.schedules) schedules = data.schedules;
            if (data.blockedSites) {
                blockedSites = data.blockedSites;
            }
            if (data.stats) stats = data.stats;

            saveData();
            if (mainWindow) {
                mainWindow.webContents.send('stats-update', stats);
            }
            return { success: true };
        } catch (error) {
            return { success: false, message: 'Error al importar archivo' };
        }
    }
    return { success: false };
});

ipcMain.handle('clear-app-data', async () => {
    schedules = [];
    blockedSites = [
        'facebook.com', 'www.facebook.com',
        'twitter.com', 'www.twitter.com',
        'x.com', 'www.x.com',
        'instagram.com', 'www.instagram.com',
        'tiktok.com', 'www.tiktok.com',
        'youtube.com', 'www.youtube.com',
        'reddit.com', 'www.reddit.com'
    ];
    stats = {
        totalTimeSaved: 0,
        sessionsBlocked: 0,
        sitesBlocked: 0,
        lastSession: null,
        activityData: {}
    };
    saveData();
    if (mainWindow) {
        mainWindow.webContents.send('stats-update', stats);
    }
    return { success: true };
});

