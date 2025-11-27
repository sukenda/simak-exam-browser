import { logger } from '../logger';

let nativeModule: {
  installHook: () => boolean;
  uninstallHook: () => boolean;
  isInstalled: () => boolean;
  isAvailable: () => boolean;
} | null = null;
let isNativeHookInstalled = false;

/**
 * Try to load native keyboard hook module
 * Returns true if successfully loaded, false otherwise
 */
export function loadNativeKeyboardHook(): boolean {
  if (nativeModule !== null) {
    const available = nativeModule.isAvailable();
    logger.info(`Native keyboard hook already ${available ? 'available' : 'unavailable'} (cached)`);
    return available;
  }

  // Try multiple possible locations (dev vs packaged vs asar-unpacked)
  const path = require('path');
  const { app } = require('electron');

  const candidatePaths: string[] = [];
  const appPath =
    app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();

  if (app && app.isPackaged) {
    if (process.resourcesPath) {
      candidatePaths.push(path.join(process.resourcesPath, 'native', 'keyboard-hook'));
      candidatePaths.push(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'native', 'keyboard-hook')
      );
    }
    if (appPath) {
      candidatePaths.push(path.join(path.dirname(appPath), 'native', 'keyboard-hook'));
    }
  } else {
    if (appPath) {
      candidatePaths.push(path.join(appPath, 'native', 'keyboard-hook'));
      candidatePaths.push(path.join(appPath, 'dist', 'native', 'keyboard-hook'));
    }
    candidatePaths.push(path.join(__dirname, '../native/keyboard-hook'));
    candidatePaths.push(path.join(process.cwd(), 'native', 'keyboard-hook'));
  }

  for (const candidate of candidatePaths) {
    try {
      logger.info(`Attempting to load native keyboard hook from: ${candidate}`);
      nativeModule = require(candidate);
      if (!nativeModule) {
        logger.warn(`Native keyboard hook module resolved to undefined at ${candidate}`);
        continue;
      }
      const available = nativeModule.isAvailable();
      if (available) {
        logger.info(`Native keyboard hook module loaded successfully from ${candidate}`);
        return true;
      }
      logger.warn(`Native keyboard hook module at ${candidate} reported unavailable`);
    } catch (error) {
      logger.warn(`Failed to load native keyboard hook module from ${candidate}`, error);
    }
  }

  logger.warn('All native keyboard hook load attempts failed. Falling back to Electron API.');
  nativeModule = null;
  return false;
}

/**
 * Install native keyboard hook (OS-level blocking)
 * Returns true if successfully installed, false otherwise
 */
export function installNativeKeyboardHook(): boolean {
  if (!nativeModule || !nativeModule.isAvailable()) {
    return false;
  }

  try {
    const result = nativeModule.installHook();
    if (result) {
      isNativeHookInstalled = true;
      logger.info('Native keyboard hook installed successfully');
    } else {
      logger.warn('Failed to install native keyboard hook');
    }
    return result;
  } catch (error) {
    logger.error('Error installing native keyboard hook', error);
    return false;
  }
}

/**
 * Uninstall native keyboard hook
 */
export function uninstallNativeKeyboardHook(): void {
  if (!nativeModule || !nativeModule.isAvailable()) {
    return;
  }

  try {
    if (isNativeHookInstalled) {
      nativeModule.uninstallHook();
      isNativeHookInstalled = false;
      logger.info('Native keyboard hook uninstalled');
    }
  } catch (error) {
    logger.error('Error uninstalling native keyboard hook', error);
  }
}

/**
 * Check if native keyboard hook is available
 */
export function isNativeKeyboardHookAvailable(): boolean {
  return nativeModule !== null && nativeModule.isAvailable();
}

/**
 * Check if native keyboard hook is currently installed
 */
export function isNativeKeyboardHookInstalled(): boolean {
  if (!nativeModule || !nativeModule.isAvailable()) {
    return false;
  }

  try {
    return nativeModule.isInstalled();
  } catch (error) {
    return false;
  }
}

