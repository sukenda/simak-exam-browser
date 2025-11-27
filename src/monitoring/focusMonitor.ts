import { BrowserWindow } from 'electron';
import { logger } from '../logger';
import { reportFocusChange } from '../services/attentionReporter';

export function attachFocusMonitor(window: BrowserWindow) {
  window.on('focus', () => {
    logger.info('Exam window focus restored');
    void reportFocusChange({
      focused: true,
      reason: 'focus',
      timestamp: new Date().toISOString()
    });
    window.webContents.send('exam:focus', { focused: true });
  });

  window.on('blur', () => {
    logger.warn('Exam window lost focus');
    void reportFocusChange({
      focused: false,
      reason: 'blur',
      timestamp: new Date().toISOString()
    });
    window.webContents.send('exam:focus', { focused: false });
  });
}

