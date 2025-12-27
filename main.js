const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
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
    lastSession: null
};

// Rutas importantes
const hostsPath = '/etc/hosts';
const hostsBackupPath = path.join(app.getPath('userData'), 'hosts.backup');
const configPath = path.join(app.getPath('userData'), 'config.json');
const statsPath = path.join(app.getPath('userData'), 'stats.json');

// Lista de sitios a bloquear
const blockedSites = [
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
        return { success: false, message: 'Timer already running' };
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
    return { success: false, message: 'No timer running' };
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
            label: blockingActive ? '🔒 Blocking Active' : '🔓 Blocking Inactive',
            enabled: false
        },
        { type: 'separator' },
        {
            label: blockingActive ? 'Deactivate (15 min timer)' : 'Activate Blocking',
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
            label: 'Show Window',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                }
            }
        },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip(blockingActive ? 'Hocus Focus - Active' : 'Hocus Focus - Inactive');
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
    return { success: false, message: 'Site already in list' };
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
    return { success: false, message: 'Site not found' };
});
