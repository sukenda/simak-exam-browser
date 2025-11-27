import {app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, crashReporter} from 'electron';
import {autoUpdater} from 'electron-updater';
import {createExamWindow} from './windows/createExamWindow';
import {createSplashWindow} from './windows/createSplashWindow';
import {createAdminWindow} from './windows/createAdminWindow';
import {unregisterShortcutLocks} from './locks/keyboard';
import {captureAppEvents, logger, logInitialization} from './logger';
import {appConfig, isDev, reloadConfig} from './config';
import {setQuitting} from './state';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {initSentry} from './utils/sentry';

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
    examWindow = await createExamWindow({splash: splashWindow});
    if (examWindow) {
        startRendererMemoryMonitor(examWindow);
    }

    // F12 sekarang diblokir, info overlay menggunakan CTRL+SHIFT+ALT+S
    // Handler F12 dihapus karena F12 sekarang diblokir

    setupIpcHandlers();
    registerAdminShortcut();
    registerInfoShortcut();
    if (!isDev) {
        const feedUrl = process.env.AUTO_UPDATE_URL;
        if (feedUrl) {
            logger.info(`Setting auto-update feed URL: ${feedUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide token in logs

            // Untuk provider 'generic', electron-updater akan:
            // 1. Jika URL adalah folder (diakhiri /), append 'latest.yml' ke URL
            // 2. Jika URL adalah file (.yml), langsung download file tersebut
            //
            // Kita menggunakan GitLab Pages dengan URL folder:
            // https://simak-khas-kempek.gitlab.io/simak-exam-browser/
            // electron-updater akan otomatis menambahkan 'latest.yml'
            autoUpdater.setFeedURL({
                provider: 'generic',
                url: feedUrl
            });

            // Setup event listeners dengan logging lebih detail
            autoUpdater.on('checking-for-update', () => {
                logger.info('Checking for updates...');
            });

            autoUpdater.on('update-available', (info) => {
                logger.info('Update available:', info);
            });

            autoUpdater.on('update-not-available', (info) => {
                logger.info('Update not available. Current version is latest:', info);
            });

            autoUpdater.on('update-downloaded', (info) => {
                logger.info('Update downloaded successfully:', info);
                logger.info('Update downloaded, restarting to install');
                // Auto install setelah 3 detik untuk memberi waktu user
                setTimeout(() => {
                    autoUpdater.quitAndInstall();
                }, 3000);
            });

            autoUpdater.on('download-progress', (progressObj) => {
                const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
                logger.debug(message);
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
                autoUpdater.checkForUpdatesAndNotify().catch((error) => {
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

app.on('before-quit', () => {
    setQuitting(true);
    unregisterShortcutLocks();
    if (periodicUpdateTimer) {
        clearInterval(periodicUpdateTimer);
        periodicUpdateTimer = null;
    }
    stopRendererMemoryMonitor();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function setupIpcHandlers() {
    ipcMain.handle('admin:request-exit', async (_event, pin: string) => {
        if (pin === appConfig.adminPin) {
            logger.info('Admin PIN valid, menutup aplikasi');
            closeAdminWindow();
            setQuitting(true);
            unregisterShortcutLocks();
            app.quit();
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
    const success = globalShortcut.register(accelerator, () => {
        openAdminWindow();
    });
    if (!success) {
        logger.error(`Gagal mendaftarkan shortcut admin ${accelerator}`);
    }
}

function registerInfoShortcut() {
    // Shortcut info overlay: CTRL+SHIFT+ALT+S
    const success = globalShortcut.register('CommandOrControl+Shift+Alt+S', () => {
        toggleInfoOverlay();
    });
    if (!success) {
        logger.warn('Gagal mendaftarkan shortcut CTRL+SHIFT+ALT+S untuk info');
    } else {
        logger.info('Shortcut info overlay terdaftar: CTRL+SHIFT+ALT+S');
    }
}

function openAdminWindow() {
    if (adminWindow) {
        adminWindow.focus();
        return;
    }
    adminWindow = createAdminWindow({
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

