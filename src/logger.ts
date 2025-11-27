import log from 'electron-log';
import {app} from 'electron';
import {join} from 'path';

// Inisialisasi logger
log.initialize();

// Set level untuk file dan console
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Konfigurasi path log file dengan path eksplisit
// Ini memastikan file log selalu dibuat di lokasi yang konsisten
log.transports.file.resolvePathFn = () => {
    // Windows: %AppData%/simak-exam-browser/logs/main.log
    // macOS: ~/Library/Logs/simak-exam-browser/main.log
    // Linux: ~/.config/simak-exam-browser/logs/main.log
    return join(app.getPath('userData'), 'logs', 'main.log');
};

// Konfigurasi max size dan rotation
log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB

export const logger = log;

// Fungsi untuk log info saat logger diinisialisasi (dipanggil setelah app ready)
export function logInitialization() {
    try {
        const logPath = log.transports.file.getFile().path;
        logger.info('Logger initialized successfully');
        logger.info('Log file location:', logPath);
    } catch (error) {
        console.error('Failed to get log file path:', error);
    }
}

export function captureAppEvents() {
    app.on('window-all-closed', () => logger.info('All windows closed'));
    app.on('browser-window-blur', (_event, window) => {
        logger.warn(`Window ${window.id} lost focus`);
    });
    app.on('browser-window-focus', (_event, window) => {
        logger.info(`Window ${window.id} focused`);
    });
}

