import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';

type InfoWindowOptions = {
  parent: BrowserWindow;
  onClosed: () => void;
};

export function createInfoWindow(options: InfoWindowOptions) {
  const window = new BrowserWindow({
    width: 650,
    height: 600,
    resizable: false,
    modal: true,
    parent: options.parent,
    autoHideMenuBar: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Informasi Aplikasi',
    webPreferences: {
      preload: join(app.getAppPath(), 'dist/infoPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const infoPath = join(app.getAppPath(), 'dist', 'static', 'info', 'index.html');
  void window.loadFile(infoPath);

  window.on('closed', options.onClosed);
  return window;
}

