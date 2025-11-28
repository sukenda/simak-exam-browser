import { BrowserWindow, app, screen } from 'electron';
import { join } from 'node:path';

type AdminWindowOptions = {
  parent: BrowserWindow;
  onClosed: () => void;
};

export function createAdminWindow(options: AdminWindowOptions) {
  const parentWindow = options.parent;
  
  // Get primary display untuk centering
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  const windowWidth = 500;
  const windowHeight = 550;
  
  // Center the window on screen
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round((screenHeight - windowHeight) / 2);
  
  const window = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    resizable: false,
    frame: false, // Frameless untuk tidak trigger taskbar
    transparent: false,
    modal: true,
    parent: parentWindow,
    autoHideMenuBar: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    show: false, // Jangan tampilkan langsung, tunggu ready-to-show
    title: 'Admin',
    webPreferences: {
      preload: join(app.getAppPath(), 'dist/adminPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const adminPath = join(app.getAppPath(), 'dist', 'static', 'admin', 'index.html');
  void window.loadFile(adminPath);
  
  // Set skipTaskbar segera setelah window dibuat (sebelum ready-to-show)
  // Ini membantu mencegah taskbar muncul sejak awal
  window.setSkipTaskbar(true);
  window.setMenuBarVisibility(false);
  
  // Tampilkan window setelah siap
  window.once('ready-to-show', () => {
    // Set ulang skipTaskbar setelah window ready untuk memastikan taskbar tersembunyi
    // Ini penting karena Windows mungkin menampilkan taskbar saat ada input fields
    window.setSkipTaskbar(true);
    window.setMenuBarVisibility(false);
    
    // Gunakan setTimeout kecil untuk memastikan semua setting sudah diterapkan
    // sebelum window ditampilkan
    setTimeout(() => {
      window.setSkipTaskbar(true);
      window.setMenuBarVisibility(false);
      window.show();
      window.focus();
      
      // Set sekali lagi setelah show untuk memastikan
      window.setSkipTaskbar(true);
      window.setMenuBarVisibility(false);
      
      // Pastikan parent tetap fullscreen/kiosk
      if (parentWindow && !parentWindow.isDestroyed()) {
        parentWindow.setFullScreen(true);
      }
    }, 10);
  });

  // Handler untuk memastikan taskbar tetap tersembunyi saat window mendapat fokus
  // Windows mungkin menampilkan taskbar saat input field mendapat fokus
  window.on('focus', () => {
    window.setSkipTaskbar(true);
    window.setMenuBarVisibility(false);
  });

  // Handler untuk memastikan taskbar tersembunyi saat window kehilangan fokus
  window.on('blur', () => {
    window.setSkipTaskbar(true);
    window.setMenuBarVisibility(false);
  });

  // Handler untuk memastikan taskbar tersembunyi saat window ditampilkan
  window.on('show', () => {
    window.setSkipTaskbar(true);
    window.setMenuBarVisibility(false);
  });

  window.on('closed', () => {
    // Pastikan parent kembali ke fullscreen setelah admin ditutup
    if (parentWindow && !parentWindow.isDestroyed()) {
      parentWindow.setFullScreen(true);
      parentWindow.focus();
    }
    options.onClosed();
  });
  
  return window;
}

