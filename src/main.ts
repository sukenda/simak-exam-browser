import {app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, crashReporter, dialog} from 'electron';
import {autoUpdater} from 'electron-updater';
import {createExamWindow} from './windows/createExamWindow';
import {createSplashWindow} from './windows/createSplashWindow';
import {createAdminWindow} from './windows/createAdminWindow';
import {unregisterShortcutLocks} from './locks/keyboard';
import {captureAppEvents, logger, logInitialization} from './logger';
import {appConfig, isDev, reloadConfig} from './config';
import {setQuitting, isQuitting} from './state';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {initSentry} from './utils/sentry';
import {sendCheatingReport, retryPendingReports} from './services/cheatingReporter';

let examWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let adminWindow: BrowserWindow | null = null;
let isInfoOverlayVisible = false;
let infoIconDataUrl: string | null = null;
const UPDATE_CHECK_MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastUpdateCheck = 0;
let periodicUpdateTimer: NodeJS.Timeout | null = null;
const RENDERER_MEMORY_CHECK_INTERVAL = 60 * 1000;
const RENDERER_MEMORY_SOFT_LIMIT_MB = 900;
const RENDERER_MEMORY_HARD_LIMIT_MB = 1300;
const RENDERER_MEMORY_WARNING_COOLDOWN = 5 * 60 * 1000;
let rendererMemoryTimer: NodeJS.Timeout | null = null;
let lastRendererMemoryWarning = 0;
let rendererReloadScheduled = false;

nativeTheme.themeSource = 'dark';

// Initialize Sentry for crash reporting (must be called as early as possible)
// Sentry akan menggunakan SENTRY_DSN dari environment variable
// Note: initSentry akan dipanggil lagi setelah app ready untuk memastikan config terbaru
initSentry();

// Setup Electron crashReporter sebagai fallback jika Sentry tidak tersedia
// crashReporter harus dipanggil sebelum app.whenReady() dan sebelum window dibuat
if (!process.env.SENTRY_DSN) {
  crashReporter.start({
    productName: 'simak-exam-browser',
    companyName: 'SIMAK KHAS Kempek',
    submitURL: '', // Kosong karena kita pakai Sentry, tapi tetap aktif untuk logging lokal
    uploadToServer: false, // Tidak upload ke server karena pakai Sentry
    compress: true,
    extra: {
      platform: process.platform,
      arch: process.arch,
      electron_version: process.versions.electron,
      node_version: process.versions.node,
      app_version: app.getVersion()
    }
  });
  // logger belum ready di sini, gunakan console
  console.log('Electron crashReporter initialized (Sentry not configured)');
} else {
  console.log('Sentry configured, crashReporter will use Sentry');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
}

captureAppEvents();

app.on('second-instance', () => {
    if (examWindow) {
        if (examWindow.isMinimized()) examWindow.restore();
        examWindow.focus();
    }
});

app.whenReady().then(async () => {
    // Inisialisasi logger dan tampilkan lokasi file log
    logInitialization();

    // Reload config setelah app ready untuk memastikan .env dibaca dari lokasi yang benar
    logger.info('App ready, reloading configuration...');
    reloadConfig();
    logger.info(`Configuration loaded - Exam URL: ${appConfig.examUrl}`);
    
    // Re-initialize Sentry setelah config reload untuk memastikan SENTRY_DSN terbaru digunakan
    if (appConfig.sentryDsn && !process.env.SENTRY_DSN) {
      process.env.SENTRY_DSN = appConfig.sentryDsn;
      initSentry(appConfig.sentryDsn);
      logger.info('Sentry re-initialized with config from .env');
    }

    splashWindow = createSplashWindow();
    
    // Register admin and info shortcuts BEFORE keyboard locks
    // This ensures they are registered first and won't be blocked
    setupIpcHandlers();
    registerAdminShortcut();
    registerInfoShortcut();
    
    examWindow = await createExamWindow({splash: splashWindow});
    if (examWindow) {
        startRendererMemoryMonitor(examWindow);
        
        // Retry pending reports from previous session (non-blocking)
        retryPendingReports().catch(err => {
            logger.error('[MAIN] Failed to retry pending reports', err);
        });
    }

    // F12 sekarang diblokir, info overlay menggunakan CTRL+SHIFT+ALT+S
    // Handler F12 dihapus karena F12 sekarang diblokir
    if (!isDev) {
        const feedUrl = process.env.AUTO_UPDATE_URL;
        if (feedUrl) {
            logger.info(`Setting auto-update feed URL: ${feedUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide token in logs

            // Untuk provider 'generic', electron-updater secara otomatis:
            // - Menambahkan /{channel}.yml ke base URL
            // - Default channel adalah 'latest' → latest.yml
            //
            // Kita menggunakan GitHub Pages dengan URL folder:
            // https://sukenda.github.io/simak-exam-browser/
            // 
            // Untuk Windows 32-bit (ia32), gunakan channel 'latest-ia32' → latest-ia32.yml
            // Untuk Windows 64-bit (x64), gunakan channel default 'latest' → latest.yml
            
            // Pastikan base URL diakhiri dengan /
            const baseUrl = feedUrl.endsWith('/') ? feedUrl : `${feedUrl}/`;
            
            if (process.arch === 'ia32') {
                logger.info(`Using channel 'latest-ia32' for 32-bit Windows`);
                logger.info(`Base URL: ${baseUrl}`);
                autoUpdater.setFeedURL({
                    provider: 'generic',
                    url: baseUrl,
                    channel: 'latest-ia32' // Will use latest-ia32.yml
                });
            } else {
                logger.info(`Using default channel 'latest' for 64-bit Windows`);
                logger.info(`Base URL: ${baseUrl}`);
                autoUpdater.setFeedURL({
                    provider: 'generic',
                    url: baseUrl
                    // Default channel is 'latest' → latest.yml
                });
            }

            // Konfigurasi autoUpdater
            autoUpdater.autoDownload = true;
            autoUpdater.autoInstallOnAppQuit = true;

            // Setup event listeners dengan logging dan dialog
            autoUpdater.on('checking-for-update', () => {
                logger.info('Checking for updates...');
            });

            autoUpdater.on('update-available', (info) => {
                logger.info('Update available:', info);
                const newVersion = info.version;
                const currentVersion = app.getVersion();
                
                // Tampilkan dialog notifikasi
                if (examWindow && !examWindow.isDestroyed()) {
                    dialog.showMessageBox(examWindow, {
                        type: 'info',
                        title: 'Update Tersedia',
                        message: `Versi baru tersedia: ${newVersion}`,
                        detail: `Versi saat ini: ${currentVersion}\n\nUpdate akan didownload secara otomatis.`,
                        buttons: ['OK'],
                        defaultId: 0
                    }).catch(err => logger.error('Error showing update dialog:', err));
                }
            });

            autoUpdater.on('update-not-available', (info) => {
                logger.info('Update not available. Current version is latest:', info);
            });

            autoUpdater.on('update-downloaded', (info) => {
                logger.info('Update downloaded successfully:', info);
                const newVersion = info.version;
                
                // Tampilkan dialog dengan opsi install sekarang atau nanti
                if (examWindow && !examWindow.isDestroyed()) {
                    dialog.showMessageBox(examWindow, {
                        type: 'info',
                        title: 'Update Siap Diinstall',
                        message: `Update versi ${newVersion} telah didownload.`,
                        detail: 'Klik "Install Sekarang" untuk restart dan install update, atau "Nanti" untuk install saat aplikasi ditutup.',
                        buttons: ['Install Sekarang', 'Nanti'],
                        defaultId: 0,
                        cancelId: 1
                    }).then((result) => {
                        if (result.response === 0) {
                            logger.info('User chose to install update now');
                            setTimeout(() => {
                                autoUpdater.quitAndInstall(false, true);
                            }, 1000);
                        } else {
                            logger.info('User chose to install update later');
                        }
                    }).catch(err => logger.error('Error showing update dialog:', err));
                } else {
                    // Jika window tidak tersedia, install otomatis setelah 5 detik
                    logger.info('Window not available, auto-installing in 5 seconds');
                    setTimeout(() => {
                        autoUpdater.quitAndInstall(false, true);
                    }, 5000);
                }
            });

            autoUpdater.on('download-progress', (progressObj) => {
                const message = `Download: ${Math.round(progressObj.percent)}% (${Math.round(progressObj.transferred / 1024 / 1024)}MB / ${Math.round(progressObj.total / 1024 / 1024)}MB)`;
                logger.info(message);
            });

            autoUpdater.on('error', (error) => {
                logger.error('Auto update error:', error);
                logger.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
            });

            const checkForUpdatesThrottled = (reason: string) => {
                const now = Date.now();
                if (now - lastUpdateCheck < UPDATE_CHECK_MIN_INTERVAL) {
                    logger.debug(
                        `Skipping auto-update check (${reason}), last run ${Math.round(
                            (now - lastUpdateCheck) / 1000
                        )}s ago`
                    );
                    return;
                }
                lastUpdateCheck = now;
                logger.info(`Triggering auto-update check (${reason})`);
                // Gunakan checkForUpdates() bukan checkForUpdatesAndNotify()
                // agar dialog custom kita yang tampil
                autoUpdater.checkForUpdates().catch((error) => {
                    logger.error(`Failed to check for updates (${reason}):`, error);
                });
            };

            // Check for updates saat app ready
            checkForUpdatesThrottled('app-ready');

            // Periodic check setiap 1 jam
            periodicUpdateTimer = setInterval(() => {
                checkForUpdatesThrottled('periodic-hourly');
            }, 60 * 60 * 1000); // 1 jam

            // Check update saat window focus (jika user kembali ke aplikasi)
            if (examWindow) {
                examWindow.on('focus', () => {
                    checkForUpdatesThrottled('window-focus');
                });
            }
        } else {
            logger.warn('AUTO_UPDATE_URL not set, auto-update disabled');
        }
    }
});

app.on('before-quit', async (event) => {
    // Prevent quit sementara untuk mengirim report jika ada exam window
    if (examWindow && !examWindow.isDestroyed() && !isQuitting()) {
        event.preventDefault(); // Prevent immediate quit
        
        logger.info('[MAIN] Application closing, attempting to send cheating report...');
        try {
            const success = await sendCheatingReport(examWindow);
            if (success) {
                logger.info('[MAIN] Cheating report sent successfully before quit');
            } else {
                logger.warn('[MAIN] Failed to send cheating report, but report should be saved to local file');
            }
        } catch (error) {
            logger.error('[MAIN] Error sending cheating report before quit', error);
        }
        
        // Set quitting flag and proceed with cleanup
        setQuitting(true);
        unregisterShortcutLocks();
        if (periodicUpdateTimer) {
            clearInterval(periodicUpdateTimer);
            periodicUpdateTimer = null;
        }
        stopRendererMemoryMonitor();
        
        // Now allow quit
        app.quit();
    } else {
        // Normal cleanup if no exam window or already quitting
        setQuitting(true);
        unregisterShortcutLocks();
        if (periodicUpdateTimer) {
            clearInterval(periodicUpdateTimer);
            periodicUpdateTimer = null;
        }
        stopRendererMemoryMonitor();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function setupIpcHandlers() {
    ipcMain.handle('admin:request-exit', async (_event, pin: string) => {
        if (pin === appConfig.adminPin) {
            logger.info('Admin PIN valid, preparing to close application');
            
            // Send cheating report before closing
            if (examWindow && !examWindow.isDestroyed()) {
                logger.info('Sending cheating report before application exit...');
                try {
                    const success = await sendCheatingReport(examWindow);
                    if (success) {
                        logger.info('Cheating report sent successfully');
                    } else {
                        logger.warn('Failed to send cheating report, but continuing with exit');
                    }
                } catch (error) {
                    logger.error('Error sending cheating report', error);
                    // Continue with exit even if report fails
                }
            } else {
                logger.info('No exam window available, skipping cheating report');
            }
            
            closeAdminWindow();
            setQuitting(true);
            unregisterShortcutLocks();
            
            // Give a small delay to ensure report is sent
            setTimeout(() => {
                app.quit();
            }, 500);
            
            return {success: true};
        }
        logger.warn('PIN admin salah');
        return {success: false};
    });

    ipcMain.on('admin:close', () => closeAdminWindow());

    ipcMain.on('info:close', () => closeInfoOverlay());

    ipcMain.handle('network:get-info', async () => {
        const {getNetworkInfo} = await import('./utils/networkInfo');
        return getNetworkInfo();
    });
}

function registerAdminShortcut() {
    const accelerator = appConfig.adminShortcut;
    logger.info(`Registering admin shortcut: ${accelerator}`);
    const success = globalShortcut.register(accelerator, () => {
        logger.info(`Admin shortcut triggered: ${accelerator}`);
        openAdminWindow();
    });
    if (!success) {
        logger.error(`Gagal mendaftarkan shortcut admin ${accelerator}`);
    } else {
        logger.info(`✅ Admin shortcut registered successfully: ${accelerator}`);
    }
}

function registerInfoShortcut() {
    // Shortcut info overlay: CTRL+SHIFT+ALT+S
    const accelerator = 'CommandOrControl+Shift+Alt+S';
    logger.info(`Registering info shortcut: ${accelerator}`);
    const success = globalShortcut.register(accelerator, () => {
        logger.info(`Info shortcut triggered: ${accelerator}`);
        toggleInfoOverlay();
    });
    if (!success) {
        logger.warn(`Gagal mendaftarkan shortcut ${accelerator} untuk info`);
    } else {
        logger.info(`✅ Info shortcut registered successfully: ${accelerator}`);
    }
}

function openAdminWindow() {
    if (adminWindow) {
        adminWindow.focus();
        return;
    }
    if (!examWindow || examWindow.isDestroyed()) {
        logger.warn('Cannot open admin window: exam window not available');
        return;
    }
    adminWindow = createAdminWindow({
        parent: examWindow,
        onClosed: () => {
            adminWindow = null;
        }
    });
}

function closeAdminWindow() {
    if (adminWindow) {
        adminWindow.close();
        adminWindow = null;
    }
}

function toggleInfoOverlay() {
    if (isInfoOverlayVisible) {
        closeInfoOverlay();
    } else {
        openInfoOverlay();
    }
}

function openInfoOverlay() {
    if (!examWindow) {
        logger.warn('Cannot open info overlay: exam window not available');
        return;
    }
    isInfoOverlayVisible = true;
    examWindow.webContents.send('info:overlay', {
        visible: true,
        data: getInfoOverlayData()
    });
}

function closeInfoOverlay() {
    if (!examWindow) {
        isInfoOverlayVisible = false;
        return;
    }
    isInfoOverlayVisible = false;
    examWindow.webContents.send('info:overlay', {visible: false});
}

type InfoOverlayData = {
    version: string;
    productName: string;
    platform: NodeJS.Platform;
    arch: string;
    iconDataUrl?: string;
};

function getInfoOverlayData(): InfoOverlayData {
    return {
        version: app.getVersion(),
        productName: app.getName(),
        platform: process.platform,
        arch: process.arch,
        iconDataUrl: getInfoIconDataUrl()
    };
}

function getInfoIconDataUrl() {
    if (infoIconDataUrl !== null) {
        return infoIconDataUrl;
    }
    try {
        const iconPath = join(app.getAppPath(), 'dist', 'static', 'info', 'app-icon.ico');
        const iconBuffer = readFileSync(iconPath);
        infoIconDataUrl = `data:image/x-icon;base64,${iconBuffer.toString('base64')}`;
    } catch (error) {
        logger.warn('Failed to load info overlay icon', error);
        infoIconDataUrl = '';
    }
    return infoIconDataUrl;
}

function startRendererMemoryMonitor(window: BrowserWindow) {
    stopRendererMemoryMonitor();
    const getProcessMemoryInfo = (window.webContents as any).getProcessMemoryInfo as
        | (() => Promise<Electron.ProcessMemoryInfo>)
        | undefined;
    if (typeof getProcessMemoryInfo !== 'function') {
        logger.warn('Renderer memory info API not available on this platform. Monitor disabled.');
        return;
    }
    rendererMemoryTimer = setInterval(async () => {
        if (window.isDestroyed()) {
            stopRendererMemoryMonitor();
            return;
        }
        try {
            const memInfo = await getProcessMemoryInfo.call(window.webContents);
            const privateMb = Math.round((memInfo.private ?? 0) / 1024);
            if (privateMb >= RENDERER_MEMORY_SOFT_LIMIT_MB) {
                logger.warn(
                    `Renderer memory high: ${privateMb} MB (soft limit ${RENDERER_MEMORY_SOFT_LIMIT_MB} MB)`
                );
                maybeNotifyRendererMemory(window, privateMb, false);
            }
            if (privateMb >= RENDERER_MEMORY_HARD_LIMIT_MB && !rendererReloadScheduled) {
                rendererReloadScheduled = true;
                logger.error(
                    `Renderer memory exceeded hard limit (${privateMb} MB >= ${RENDERER_MEMORY_HARD_LIMIT_MB} MB). Scheduling reload.`
                );
                maybeNotifyRendererMemory(window, privateMb, true);
                setTimeout(() => {
                    if (!window.isDestroyed()) {
                        window.webContents.reloadIgnoringCache();
                    }
                    rendererReloadScheduled = false;
                }, 10_000);
            }
        } catch (error) {
            logger.warn('Failed to read renderer memory info', error);
        }
    }, RENDERER_MEMORY_CHECK_INTERVAL);
}

function stopRendererMemoryMonitor() {
    if (rendererMemoryTimer) {
        clearInterval(rendererMemoryTimer);
        rendererMemoryTimer = null;
    }
}

function maybeNotifyRendererMemory(window: BrowserWindow, usageMb: number, isHardLimit: boolean) {
    const now = Date.now();
    if (!isHardLimit && now - lastRendererMemoryWarning < RENDERER_MEMORY_WARNING_COOLDOWN) {
        return;
    }
    lastRendererMemoryWarning = now;
    const message = isHardLimit
        ? `Memori aplikasi hampir habis (${usageMb} MB). Halaman akan dimuat ulang otomatis dalam 10 detik untuk mencegah crash.`
        : `Penggunaan memori aplikasi tinggi (${usageMb} MB). Tutup aplikasi lain dan hindari membuka tab selain halaman ujian.`;
    window.webContents.send('exam:warning', {
        combo: undefined,
        source: 'memory-monitor',
        timestamp: new Date().toISOString(),
        message
    });
}

