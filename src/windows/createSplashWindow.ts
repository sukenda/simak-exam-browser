import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';

export function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    movable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    transparent: false,
    autoHideMenuBar: true,
    // Background color profesional - hijau gelap yang sesuai dengan gradient CSS
    // Ini menghilangkan flash putih saat window loading dan membuat transisi lebih smooth
    backgroundColor: '#1b5e20', // Warna hijau gelap dari gradient (base color)
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  // Set background color segera setelah window dibuat untuk menghindari flash putih
  splash.setBackgroundColor('#1b5e20');
  
  splash.on('ready-to-show', () => splash.show());
  const splashPath = join(app.getAppPath(), 'dist', 'static', 'splash', 'index.html');
  splash.loadFile(splashPath).catch(() => splash.destroy());
  return splash;
}

