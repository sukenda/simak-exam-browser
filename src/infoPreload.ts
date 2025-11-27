import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('infoBridge', {
  getAppInfo() {
    return ipcRenderer.invoke('info:get-app-info');
  },
  close() {
    ipcRenderer.send('info:close');
  }
});

