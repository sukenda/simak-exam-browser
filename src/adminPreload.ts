import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('adminBridge', {
  submitPin(pin: string) {
    return ipcRenderer.invoke('admin:request-exit', pin);
  },
  cancel() {
    ipcRenderer.send('admin:close');
  }
});

