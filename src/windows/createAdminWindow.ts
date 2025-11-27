import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';

type AdminWindowOptions = {
  onClosed: () => void;
};

export function createAdminWindow(options: AdminWindowOptions) {
  const window = new BrowserWindow({
    width: 500,
    height: 550,
    resizable: false,
    modal: true,
    parent: BrowserWindow.getFocusedWindow() ?? undefined,
    autoHideMenuBar: true,
    minimizable: false,
    maximizable: false,
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

  window.on('closed', options.onClosed);
  return window;
}

