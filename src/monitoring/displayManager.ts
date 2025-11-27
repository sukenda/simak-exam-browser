import { BrowserWindow, screen } from 'electron';
import { logger } from '../logger';

export function anchorToPrimaryDisplay(window: BrowserWindow) {
  const primary = screen.getPrimaryDisplay();
  const { bounds } = primary;
  window.setBounds(bounds);
  window.setFullScreen(true);
}

export function watchDisplayChanges(window: BrowserWindow) {
  screen.on('display-added', () => {
    logger.info('Display added, re-anchoring window');
    anchorToPrimaryDisplay(window);
  });
  screen.on('display-removed', () => {
    logger.warn('Display removed, re-anchoring window');
    anchorToPrimaryDisplay(window);
  });
  screen.on('display-metrics-changed', () => {
    anchorToPrimaryDisplay(window);
  });
}

