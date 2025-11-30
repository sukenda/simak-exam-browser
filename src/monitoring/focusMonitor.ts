import { BrowserWindow } from 'electron';
import { logger } from '../logger';
import { reportFocusChange } from '../services/attentionReporter';
import { cheatingTracker } from '../services/cheatingTracker';

export function attachFocusMonitor(window: BrowserWindow) {
  let lastBlurTime: number | null = null;
  
  window.on('focus', () => {
    logger.info('Exam window focus restored');
    void reportFocusChange({
      focused: true,
      reason: 'focus',
      timestamp: new Date().toISOString()
    });
    
    // Track focus restore if there was a previous blur
    if (lastBlurTime !== null) {
      const blurDuration = Date.now() - lastBlurTime;
      cheatingTracker.trackEvent(
        'window_restore',
        'Window focus restored',
        blurDuration > 5000 ? 'high' : 'medium',
        {
          reason: 'focus',
          blurDuration: blurDuration,
          previousBlurTime: new Date(lastBlurTime).toISOString()
        }
      );
      lastBlurTime = null;
    }
    
    window.webContents.send('exam:focus', { focused: true });
  });

  window.on('blur', () => {
    logger.warn('Exam window lost focus');
    lastBlurTime = Date.now();
    
    void reportFocusChange({
      focused: false,
      reason: 'blur',
      timestamp: new Date().toISOString()
    });
    
    // Track window blur event
    cheatingTracker.trackEvent(
      'window_blur',
      'Window lost focus',
      'high',
      {
        reason: 'blur',
        windowFocused: false
      }
    );
    
    window.webContents.send('exam:focus', { focused: false });
  });
}

