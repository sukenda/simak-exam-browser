import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerShortcutLocks } from '../locks/keyboard';
import { attachFocusMonitor } from '../monitoring/focusMonitor';
import { anchorToPrimaryDisplay, watchDisplayChanges } from '../monitoring/displayManager';
import { logger } from '../logger';
import { appConfig, isDev } from '../config';
import { waitForExamServer } from '../utils/serverHealth';
import { isQuitting } from '../state';

type ExamWindowOptions = {
  splash?: BrowserWindow | null;
};

export async function createExamWindow(options?: ExamWindowOptions) {
  const window = new BrowserWindow({
    show: false,
    fullscreen: true,
    kiosk: !isDev,
    autoHideMenuBar: true,
    resizable: false,
    frame: false,
    title: 'simak-exam-browser',
    icon: join(app.getAppPath(), 'dist', 'static', 'icons', 'win', 'simak-icon-circle.ico'),
    webPreferences: {
      preload: join(app.getAppPath(), 'dist', 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  window.setFullScreen(true);
  anchorToPrimaryDisplay(window);
  watchDisplayChanges(window);

  registerShortcutLocks(window);
  attachFocusMonitor(window);
  
  // Handler untuk F12 - akan ditambahkan di main process setelah window dibuat
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appConfig.examUrl)) {
      event.preventDefault();
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    options?.splash?.destroy();
  });

  logger.info(`Attempting to connect to: ${appConfig.examUrl}`);
  const reachable = await waitForExamServer(appConfig.examUrl);
  if (!reachable) {
    logger.error(`Exam server unreachable at ${appConfig.examUrl}, showing error page`);
    const html = `<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Segoe UI;background:#0f172a;color:#fff;text-align:center;"><div><h1>Gagal memuat</h1><p>Periksa koneksi jaringan kemudian restart aplikasi.</p></div></body></html>`;
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return window;
  }

  logger.info(`Successfully connected to ${appConfig.examUrl}, loading page...`);
  try {
    await window.loadURL(appConfig.examUrl);
  } catch (error) {
    logger.error(`Failed to load exam URL ${appConfig.examUrl}`, error);
    const html = `<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Segoe UI;background:#0f172a;color:#fff;text-align:center;"><div><h1>Gagal memuat konten ujian</h1><p>Periksa koneksi atau coba lagi dalam beberapa saat.</p></div></body></html>`;
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return window;
  }
  if (!isDev) {
    window.webContents.on('devtools-opened', () => window.webContents.closeDevTools());
  }

  window.on('close', (event) => {
    if (!isQuitting()) {
      event.preventDefault();
      window.hide();
    }
  });

  return window;
}

