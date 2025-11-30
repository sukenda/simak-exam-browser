import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerShortcutLocks } from '../locks/keyboard';
import { attachFocusMonitor } from '../monitoring/focusMonitor';
import { anchorToPrimaryDisplay, watchDisplayChanges } from '../monitoring/displayManager';
import { logger } from '../logger';
import { appConfig, isDev } from '../config';
import { waitForExamServer } from '../utils/serverHealth';
import { isQuitting } from '../state';
import { cheatingTracker } from '../services/cheatingTracker';
import { getStudentInfoFromStorage } from '../utils/studentInfo';

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
    alwaysOnTop: true, // Prevent window from being minimized by trackpad gestures
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
  
  // ============================================
  // HANDLE DOWNLOAD EVENT - Prevent taskbar from showing
  // ============================================
  // Handler untuk intercept download dan memastikan taskbar tetap tersembunyi
  window.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const totalBytes = item.getTotalBytes();
    
    logger.info('[DOWNLOAD] Download started', {
      fileName,
      totalBytes,
      savePath: item.getSavePath(),
      timestamp: new Date().toISOString()
    });
    
    // Pastikan taskbar tetap tersembunyi saat download dimulai
    if (window && !window.isDestroyed()) {
      window.setSkipTaskbar(true);
      window.setFullScreen(true);
      logger.debug('[DOWNLOAD] Taskbar hidden and fullscreen maintained at download start');
    }
    
    // Monitor download progress
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        const received = item.getReceivedBytes();
        if (totalBytes > 0) {
          const percent = Math.round((received / totalBytes) * 100);
          logger.debug(`[DOWNLOAD] Progress: ${percent}% (${received}/${totalBytes} bytes)`, {
            fileName,
            percent,
            received,
            totalBytes,
            timestamp: new Date().toISOString()
          });
        }
        
        // Pastikan taskbar tetap tersembunyi selama download
        if (window && !window.isDestroyed()) {
          window.setSkipTaskbar(true);
          window.setFullScreen(true);
        }
      }
    });
    
    // Handle download completion
    item.on('done', (event, state) => {
      const logData = {
        fileName,
        state,
        savePath: item.getSavePath(),
        timestamp: new Date().toISOString()
      };
      
      if (state === 'completed') {
        logger.info('[DOWNLOAD] Download completed', logData);
        // Track download event
        cheatingTracker.trackEvent(
          'download',
          'File downloaded',
          'medium',
          {
            fileName: fileName,
            fileSize: totalBytes,
            downloadTime: new Date().toISOString(),
            state: 'completed'
          }
        );
      } else if (state === 'cancelled') {
        logger.info('[DOWNLOAD] Download cancelled', logData);
      } else if (state === 'interrupted') {
        logger.warn('[DOWNLOAD] Download interrupted', logData);
      }
      
      // Pastikan taskbar tetap tersembunyi setelah download selesai
      if (window && !window.isDestroyed()) {
        window.setSkipTaskbar(true);
        window.setFullScreen(true);
        window.focus();
        logger.debug('[DOWNLOAD] Taskbar hidden and fullscreen maintained after download', {
          state,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
  
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

  // ============================================
  // TRACK PENGERJAAN IDs FROM URL
  // ============================================
  // Function untuk extract pengerjaanId dari URL
  function extractPengerjaanIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      // Look for pattern: .../pengerjaan-soal/{id}
      const pengerjaanIndex = pathSegments.findIndex(seg => 
        seg.toLowerCase().includes('pengerjaan') || 
        seg.toLowerCase().includes('soal')
      );
      
      if (pengerjaanIndex >= 0 && pathSegments[pengerjaanIndex + 1]) {
        return pathSegments[pengerjaanIndex + 1];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  // Track URL changes untuk pengerjaan IDs
  // did-navigate: untuk full page navigation
  window.webContents.on('did-navigate', (event, url) => {
    const pengerjaanId = extractPengerjaanIdFromUrl(url);
    if (pengerjaanId) {
      cheatingTracker.trackPengerjaanId(pengerjaanId);
      logger.debug(`[EXAM WINDOW] Full page navigated to pengerjaan: ${pengerjaanId}`);
    }
  });

  // did-frame-navigate: untuk SPA navigation (Vue.js router changes)
  window.webContents.on('did-frame-navigate', (event, url) => {
    const pengerjaanId = extractPengerjaanIdFromUrl(url);
    if (pengerjaanId) {
      cheatingTracker.trackPengerjaanId(pengerjaanId);
      logger.debug(`[EXAM WINDOW] SPA navigated to pengerjaan: ${pengerjaanId}`);
    }
  });

  // Also track when page finishes loading (for SPA navigation)
  window.webContents.on('did-finish-load', () => {
    const currentUrl = window.webContents.getURL();
    const pengerjaanId = extractPengerjaanIdFromUrl(currentUrl);
    if (pengerjaanId) {
      cheatingTracker.trackPengerjaanId(pengerjaanId);
      logger.debug(`[EXAM WINDOW] Page loaded with pengerjaan: ${pengerjaanId}`);
    }
    
    // Try to cache student info when page loads (non-blocking, with delay for Vue app to initialize)
    // This will cache data immediately after login, not wait until report is sent
    setTimeout(() => {
      getStudentInfoFromStorage(window, true).then(info => {
        if (info && info.id) {
          logger.info('[EXAM WINDOW] Student info cached successfully on page load', {
            studentId: info.id,
            studentName: info.name
          });
        } else {
          logger.debug('[EXAM WINDOW] Student info not available yet on page load (may need to wait for login)');
        }
      }).catch(err => {
        logger.debug('[EXAM WINDOW] Failed to cache student info on page load', err);
      });
    }, 1000); // Wait 1 second for Vue app to initialize
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
    // Track initial URL after load
    const initialUrl = window.webContents.getURL();
    const initialPengerjaanId = extractPengerjaanIdFromUrl(initialUrl);
    if (initialPengerjaanId) {
      cheatingTracker.trackPengerjaanId(initialPengerjaanId);
      logger.debug(`[EXAM WINDOW] Initial page loaded with pengerjaan: ${initialPengerjaanId}`);
    }
    
    // Try to cache student info after initial load (non-blocking)
    // Wait a bit for Vue app to initialize localStorage
    setTimeout(() => {
      getStudentInfoFromStorage(window, true).catch(err => {
        logger.debug('[EXAM WINDOW] Failed to cache student info on initial load', err);
      });
    }, 2000); // Wait 2 seconds for Vue app to initialize
    
    // Periodic check to validate cache and detect logout (every 30 seconds)
    // This will automatically clear cache if student logs out (localStorage becomes empty)
    const cacheValidationInterval = setInterval(() => {
      if (window.isDestroyed()) {
        clearInterval(cacheValidationInterval);
        return;
      }
      
      // Force check to validate cache (will clear cache if localStorage is empty)
      getStudentInfoFromStorage(window, true).catch(err => {
        logger.debug('[EXAM WINDOW] Failed to validate student info cache', err);
      });
    }, 30000); // Check every 30 seconds
    
    // Also check on page navigation (SPA navigation might trigger logout)
    window.webContents.on('did-navigate', () => {
      // Small delay to let Vue app update localStorage
      setTimeout(() => {
        getStudentInfoFromStorage(window, true).catch(err => {
          logger.debug('[EXAM WINDOW] Failed to validate student info on navigation', err);
        });
      }, 1000);
    });
    
    // Periodic check untuk URL changes (setiap 5 detik)
    // Ini akan catch SPA navigation yang mungkin terlewat oleh event listeners
    let lastTrackedUrl = window.webContents.getURL();
    const urlCheckInterval = setInterval(() => {
      if (window.isDestroyed()) {
        clearInterval(urlCheckInterval);
        return;
      }
      
      try {
        const currentUrl = window.webContents.getURL();
        if (currentUrl && currentUrl !== lastTrackedUrl) {
          const previousUrl = lastTrackedUrl;
          lastTrackedUrl = currentUrl;
          const pengerjaanId = extractPengerjaanIdFromUrl(currentUrl);
          if (pengerjaanId) {
            cheatingTracker.trackPengerjaanId(pengerjaanId);
            logger.debug(`[EXAM WINDOW] URL changed (periodic check) to pengerjaan: ${pengerjaanId}`, {
              previousUrl: previousUrl,
              currentUrl: currentUrl,
              pengerjaanId: pengerjaanId
            });
          }
        }
      } catch (error) {
        logger.debug('[EXAM WINDOW] Error in periodic URL check', error);
      }
    }, 5000); // Check every 5 seconds
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

  // ============================================
  // PREVENT TRACKPAD GESTURES - Restore window if minimized
  // ============================================
  // Handler untuk mencegah window minimize (termasuk dari gesture trackpad 3 jari)
  // NOTE: Focus diperlukan di sini karena window baru di-restore dari minimize
  window.on('minimize', (event: Electron.Event) => {
    const windowState = {
      isMinimized: window.isMinimized(),
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
      isFocused: window.isFocused(),
      isVisible: window.isVisible(),
      isDestroyed: window.isDestroyed(),
      childWindowsCount: window.getChildWindows().length
    };
    logger.warn('[GESTURE DETECTION] Window minimize detected (possibly from trackpad gesture)', {
      event: 'minimize',
      windowState,
      timestamp: new Date().toISOString()
    });
    
    // Track window minimize event
    cheatingTracker.trackEvent(
      'window_minimize',
      'Window minimized (possibly from gesture)',
      'critical',
      {
        windowState: 'minimized',
        possibleCause: 'trackpad_gesture',
        childWindowsCount: windowState.childWindowsCount
      }
    );
    
    event.preventDefault(); // Coba prevent, tapi mungkin tidak selalu efektif
    if (!window.isDestroyed()) {
      // Restore window segera
      window.restore();
      window.setFullScreen(true);
      logger.info('[GESTURE DETECTION] Window restored from minimize', {
        action: 'restore',
        timestamp: new Date().toISOString()
      });
      
      // Track window restore
      cheatingTracker.trackEvent(
        'window_restore',
        'Window restored from minimize',
        'high',
        {
          windowState: 'restored',
          restoredImmediately: true,
          restoreDelay: 100
        }
      );
      
      // Focus diperlukan karena window baru di-restore, tapi gunakan delay untuk tidak mengganggu
      setTimeout(() => {
        if (!window.isDestroyed()) {
          window.focus();
          window.setFullScreen(true);
          window.setSkipTaskbar(true);
          window.setAlwaysOnTop(true);
          logger.info('[GESTURE DETECTION] Window state restored after minimize', {
            action: 'restore-state',
            isFullScreen: window.isFullScreen(),
            isFocused: window.isFocused(),
            isAlwaysOnTop: window.isAlwaysOnTop(),
            timestamp: new Date().toISOString()
          });
        }
      }, 100);
    }
  });

  // Handler untuk memastikan window tetap fullscreen saat kehilangan focus
  // (bisa terjadi karena gesture trackpad yang trigger show desktop)
  // NOTE: Jangan restore focus jika ada modal window (admin window) yang sedang terbuka
  window.on('blur', () => {
    if (!window.isDestroyed()) {
      const windowState = {
        isMinimized: window.isMinimized(),
        isMaximized: window.isMaximized(),
        isFullScreen: window.isFullScreen(),
        isFocused: window.isFocused(),
        isVisible: window.isVisible(),
        childWindowsCount: window.getChildWindows().length,
        childWindows: window.getChildWindows().map(child => ({
          isDestroyed: child.isDestroyed(),
          isVisible: child.isVisible(),
          title: child.getTitle()
        }))
      };
      
      // Restore fullscreen jika window tidak dalam fullscreen
      // Tapi jangan restore focus karena mungkin ada modal window yang sedang terbuka
      if (!window.isFullScreen()) {
        logger.warn('[GESTURE DETECTION] Window lost fullscreen (possibly from gesture show desktop)', {
          event: 'blur',
          windowState,
          action: 'restore-fullscreen',
          timestamp: new Date().toISOString()
        });
        window.setFullScreen(true);
        // Hanya restore focus jika window benar-benar tidak focused DAN tidak ada child window
        // Cek apakah ada child window dengan memeriksa child windows
        setTimeout(() => {
          if (!window.isDestroyed() && !window.isFocused()) {
            // Cek apakah ada child window yang sedang visible
            const childWindows = window.getChildWindows();
            const hasVisibleChild = childWindows.some(child => !child.isDestroyed() && child.isVisible());
            
            logger.info('[GESTURE DETECTION] Checking if focus should be restored after blur', {
              event: 'blur-check',
              hasVisibleChild,
              childWindowsCount: childWindows.length,
              isFocused: window.isFocused(),
              timestamp: new Date().toISOString()
            });
            
            // Hanya restore focus jika tidak ada child window yang visible
            // Ini mencegah mengambil focus dari admin window
            if (!hasVisibleChild) {
              window.focus();
              window.setFullScreen(true);
              window.setSkipTaskbar(true);
              window.setAlwaysOnTop(true);
              logger.info('[GESTURE DETECTION] Focus restored after blur (no child windows)', {
                action: 'restore-focus',
                timestamp: new Date().toISOString()
              });
            } else {
              logger.info('[GESTURE DETECTION] Focus NOT restored (child window is visible)', {
                action: 'skip-restore-focus',
                timestamp: new Date().toISOString()
              });
            }
          }
        }, 100);
      } else {
        // Log blur event even if fullscreen is still active (for debugging)
        logger.debug('[GESTURE DETECTION] Window blur event (fullscreen still active)', {
          event: 'blur',
          windowState,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  // Handler untuk memastikan taskbar tetap tersembunyi saat window mendapat fokus
  // (termasuk setelah download selesai atau event lainnya)
  window.on('focus', () => {
    if (!window.isDestroyed()) {
      window.setSkipTaskbar(true);
      window.setFullScreen(true);
      logger.debug('[WINDOW FOCUS] Taskbar hidden and fullscreen maintained on focus', {
        event: 'focus',
        isFullScreen: window.isFullScreen(),
        isFocused: window.isFocused(),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handler untuk memastikan window selalu fullscreen saat ditampilkan
  // NOTE: Jangan focus jika ada input field yang sedang aktif (untuk tidak mengganggu input di aplikasi Vue)
  window.on('show', () => {
    if (!window.isDestroyed()) {
      const windowStateBefore = {
        isMinimized: window.isMinimized(),
        isMaximized: window.isMaximized(),
        isFullScreen: window.isFullScreen(),
        isFocused: window.isFocused(),
        isVisible: window.isVisible()
      };
      
      if (!window.isFullScreen()) {
        logger.warn('[GESTURE DETECTION] Window show event - not in fullscreen, restoring...', {
          event: 'show',
          windowStateBefore,
          action: 'restore-fullscreen',
          timestamp: new Date().toISOString()
        });
        window.setFullScreen(true);
      }
      // Hanya focus jika window belum focused (untuk tidak mengganggu input yang sedang aktif)
      const wasFocused = window.isFocused();
      if (!wasFocused) {
        window.focus();
        logger.info('[GESTURE DETECTION] Window focused on show event', {
          event: 'show',
          action: 'focus',
          wasFocused,
          timestamp: new Date().toISOString()
        });
      }
      window.setSkipTaskbar(true);
      window.setAlwaysOnTop(true);
    }
  });

  // Handler untuk mencegah window keluar dari fullscreen
  // NOTE: Jangan focus jika ada input field yang sedang aktif (untuk tidak mengganggu input di aplikasi Vue)
  window.on('leave-full-screen', () => {
    const windowState = {
      isMinimized: window.isMinimized(),
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
      isFocused: window.isFocused(),
      isVisible: window.isVisible(),
      childWindowsCount: window.getChildWindows().length
    };
    logger.warn('[GESTURE DETECTION] Window left fullscreen (possibly from gesture)', {
      event: 'leave-full-screen',
      windowState,
      action: 'restore-fullscreen',
      timestamp: new Date().toISOString()
    });
    
    // Track fullscreen exit event
    cheatingTracker.trackEvent(
      'fullscreen_exit',
      'Window exited fullscreen',
      'critical',
      {
        windowState: 'exited-fullscreen',
        restoredImmediately: true,
        restoreDelay: 200
      }
    );
    
    if (!window.isDestroyed()) {
      window.setFullScreen(true);
      // Hanya focus jika window belum focused (untuk tidak mengganggu input yang sedang aktif)
      // Gunakan setTimeout untuk memastikan tidak mengganggu input yang sedang diketik
      setTimeout(() => {
        if (!window.isDestroyed() && !window.isFocused()) {
          window.focus();
          logger.info('[GESTURE DETECTION] Focus restored after leave-full-screen', {
            action: 'restore-focus',
            isFocused: window.isFocused(),
            timestamp: new Date().toISOString()
          });
        }
      }, 200);
      window.setAlwaysOnTop(true);
    }
  });

  return window;
}

