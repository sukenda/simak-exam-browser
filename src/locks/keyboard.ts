import { BrowserWindow, globalShortcut } from 'electron';
import type { Input } from 'electron';
import { logger } from '../logger';
import { isDev, appConfig } from '../config';
import {
  loadNativeKeyboardHook,
  installNativeKeyboardHook,
  uninstallNativeKeyboardHook,
  isNativeKeyboardHookAvailable,
  isNativeKeyboardHookInstalled
} from './nativeKeyboard';

const blockedCombinations = new Set([
  // Ctrl + A sampai Z
  'Ctrl+A', 'Ctrl+B', 'Ctrl+C', 'Ctrl+D', 'Ctrl+E', 'Ctrl+F', 'Ctrl+G',
  'Ctrl+H', 'Ctrl+I', 'Ctrl+J', 'Ctrl+K', 'Ctrl+L', 'Ctrl+M', 'Ctrl+N',
  'Ctrl+O', 'Ctrl+P', 'Ctrl+Q', 'Ctrl+R', 'Ctrl+S', 'Ctrl+T', 'Ctrl+U',
  'Ctrl+V', 'Ctrl+W', 'Ctrl+X', 'Ctrl+Y', 'Ctrl+Z',
  // Ctrl + Numbers
  'Ctrl+1', 'Ctrl+2', 'Ctrl+5',
  // Ctrl + Special
  'Ctrl+Esc', 'Ctrl+F4', 'Ctrl+Tab', 'Ctrl+Shift+Tab',
  // Alt combinations
  'Alt+Tab', 'Alt+F4', 'Alt+Enter', 'Alt+Spacebar', 'Alt+Esc',
  // Shift combinations
  'Shift+F10', 'Shift+Tab', 'Shift+Delete',
  // Ctrl + Arrow keys
  'Ctrl+Up', 'Ctrl+Down', 'Ctrl+Left', 'Ctrl+Right',
  // Function keys
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  // Special keys
  'Escape', 'Enter', 'Tab', 'Delete', 'Insert',
  'Home', 'End', 'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right',
  'NumLock',
  // Windows key (Meta)
  'Meta', 'Windows', 'Windows+D', 'Windows+R', 'Windows+L', 'Windows+E', 'Windows+X',
  // Other
  'PrintScreen', 'Ctrl+Alt+Delete', 'Ctrl+Alt+Esc', 'Ctrl+Shift+R',
  'Ctrl+Shift+I', 'Ctrl+Alt+I',
  // Alt key (bare)
  'Alt'
]);

const SHORTCUT_NOTIFICATION_INTERVAL = 1500;
let lastShortcutNotification = 0;
let lastNotifiedCombo = '';

export function registerShortcutLocks(window: BrowserWindow) {
  // Try to load and install native keyboard hook (OS-level blocking)
  logger.info('=== Initializing Keyboard Blocking System ===');
  const nativeAvailable = loadNativeKeyboardHook();
  if (nativeAvailable) {
    logger.info('Native keyboard hook module loaded successfully');
    const installed = installNativeKeyboardHook();
    if (installed) {
      const isInstalled = isNativeKeyboardHookInstalled();
      if (isInstalled) {
        logger.info('✅ Native keyboard hook ACTIVE - OS-level blocking enabled');
        logger.info('✅ Native hook handles: Windows key (bare), Alt+Tab, Ctrl+Shift+Esc, Alt+F4, Win+X, Win+L, Win+D, Win+R, F1-F12, Ctrl+A-Z, special keys, and more');
        logger.info('✅ Windows key blocking: ACTIVE at OS level');
      } else {
        logger.warn('⚠️ Native keyboard hook installation reported success but hook not detected as installed');
        logger.warn('⚠️ Windows key blocking: FALLBACK to Electron API');
      }
      // Continue with Electron API for other shortcuts
    } else {
      logger.warn('⚠️ Native keyboard hook available but failed to install, using Electron API fallback');
      logger.warn('⚠️ Windows key blocking: FALLBACK to Electron API');
    }
  } else {
    logger.info('ℹ️ Using Electron API for keyboard blocking (native hook not available)');
    logger.info('ℹ️ Windows key blocking: Electron API + before-input-event handler');
  }
  const shortcuts: Array<{ accelerator: string; requiresOsPolicy?: boolean }> = [
    // Ctrl + A sampai Z (kecuali Ctrl+C di dev mode)
    { accelerator: 'CommandOrControl+A' },
    { accelerator: 'CommandOrControl+B' },
    ...(isDev ? [] : [{ accelerator: 'CommandOrControl+C' }]), // Ctrl+C tidak diblokir di dev mode
    { accelerator: 'CommandOrControl+D' },
    { accelerator: 'CommandOrControl+E' },
    { accelerator: 'CommandOrControl+F' },
    { accelerator: 'CommandOrControl+G' },
    { accelerator: 'CommandOrControl+H' },
    { accelerator: 'CommandOrControl+I' },
    { accelerator: 'CommandOrControl+J' },
    { accelerator: 'CommandOrControl+K' },
    { accelerator: 'CommandOrControl+L' },
    { accelerator: 'CommandOrControl+M' },
    { accelerator: 'CommandOrControl+N' },
    { accelerator: 'CommandOrControl+O' },
    { accelerator: 'CommandOrControl+P' },
    { accelerator: 'CommandOrControl+Q' },
    { accelerator: 'CommandOrControl+R' },
    { accelerator: 'CommandOrControl+S' },
    { accelerator: 'CommandOrControl+T' },
    { accelerator: 'CommandOrControl+U' },
    { accelerator: 'CommandOrControl+V' },
    { accelerator: 'CommandOrControl+W' },
    { accelerator: 'CommandOrControl+X' },
    { accelerator: 'CommandOrControl+Y' },
    { accelerator: 'CommandOrControl+Z' },
    // Ctrl + Numbers
    { accelerator: 'CommandOrControl+1' },
    { accelerator: 'CommandOrControl+2' },
    { accelerator: 'CommandOrControl+5' },
    // Ctrl + Special
    { accelerator: 'CommandOrControl+Escape' },
    { accelerator: 'CommandOrControl+F4' },
    { accelerator: 'CommandOrControl+Tab' },
    { accelerator: 'CommandOrControl+Shift+Tab' },
    // Alt combinations
    { accelerator: 'Alt+F4' },
    { accelerator: 'Alt+Tab', requiresOsPolicy: true },
    { accelerator: 'Alt+Enter' },
    { accelerator: 'Alt+Space' },
    { accelerator: 'Alt+Escape' },
    // Shift combinations
    { accelerator: 'Shift+F10' },
    { accelerator: 'Shift+Tab' },
    { accelerator: 'Shift+Delete' },
    // Ctrl + Arrow keys
    { accelerator: 'CommandOrControl+Up' },
    { accelerator: 'CommandOrControl+Down' },
    { accelerator: 'CommandOrControl+Left' },
    { accelerator: 'CommandOrControl+Right' },
    // Function keys
    { accelerator: 'F1' },
    { accelerator: 'F2' },
    { accelerator: 'F3' },
    { accelerator: 'F4' },
    { accelerator: 'F5' },
    { accelerator: 'F6' },
    { accelerator: 'F7' },
    { accelerator: 'F8' },
    { accelerator: 'F9' },
    { accelerator: 'F10' },
    { accelerator: 'F11' },
    { accelerator: 'F12' },
    // Special keys
    { accelerator: 'Escape' },
    { accelerator: 'Enter' },
    { accelerator: 'Tab' },
    { accelerator: 'Delete' },
    { accelerator: 'Insert' },
    { accelerator: 'Home' },
    { accelerator: 'End' },
    { accelerator: 'PageUp' },
    { accelerator: 'PageDown' },
    { accelerator: 'Up' },
    { accelerator: 'Down' },
    { accelerator: 'Left' },
    { accelerator: 'Right' },
    // Windows key
    { accelerator: 'Super+R', requiresOsPolicy: true },
    { accelerator: 'Super+D', requiresOsPolicy: true },
    { accelerator: 'Super+L', requiresOsPolicy: true },
    // Other
    { accelerator: 'PrintScreen', requiresOsPolicy: true },
    { accelerator: 'CommandOrControl+Alt+Escape', requiresOsPolicy: true },
    { accelerator: 'CommandOrControl+Shift+R' }
  ];

  shortcuts.forEach(({ accelerator, requiresOsPolicy }) => {
    if (accelerator === 'Super') {
      logger.warn(
        'Skipping bare Super key registration (not supported via globalShortcut on this platform)'
      );
      warnUnregistered(accelerator, true);
      return;
    }
    try {
      const success = globalShortcut.register(accelerator, () => {
        logger.debug(`Blocked accelerator ${accelerator}`);
        notifyShortcutViolation(window, {
          combo: normalizeCombo(accelerator),
          source: 'global-shortcut'
        });
      });
      if (!success) {
        warnUnregistered(accelerator, requiresOsPolicy);
      }
    } catch (error) {
      logger.warn(`Failed to register ${accelerator}`, error);
      warnUnregistered(accelerator, requiresOsPolicy);
    }
  });

  window.webContents.on('before-input-event', (event, input) => {
    const combo = formatCombo(input);
    const key = input.key || input.code || '';
    
    // ============================================
    // ALLOW BACKSPACE (NEEDED FOR TEXT EDITING)
    // ============================================
    // Backspace must be allowed for text editing in forms
    if (key === 'Backspace' || input.code === 'Backspace') {
      return; // Allow Backspace to pass through
    }
    
    // ============================================
    // ALLOW ADMIN AND INFO SHORTCUTS (HIGHEST PRIORITY)
    // ============================================
    // Allow admin shortcut (default: Ctrl+Alt+Shift+A)
    // Check if all three modifiers (Ctrl, Alt, Shift) are pressed
    const hasAllModifiers = input.control && input.alt && input.shift;
    if (hasAllModifiers) {
      const adminShortcut = appConfig.adminShortcut || 'Ctrl+Alt+Shift+A';
      const adminKey = adminShortcut.split('+').pop()?.toUpperCase(); // Extract 'A' from 'Ctrl+Alt+Shift+A'
      
      // Normalize key for comparison
      const normalizedKey = normalizeKey(key);
      const normalizedAdminKey = normalizeKey(adminKey || 'A');
      
      if (normalizedKey === normalizedAdminKey) {
        logger.info(`[ALLOW] Admin shortcut detected: ${combo}`);
        return; // Allow the shortcut to pass through
      }
      
      // Allow info shortcut (Ctrl+Shift+Alt+S)
      if (normalizedKey === 'S') {
        logger.info(`[ALLOW] Info shortcut detected: ${combo}`);
        return; // Allow the shortcut to pass through
      }
    }
    
    // ============================================
    // PRIORITY: BLOCK WINDOWS KEY (HIGHEST PRIORITY)
    // ============================================
    // Block ALL Windows key combinations (Win + any key)
    // This must be checked FIRST before other checks
    if (input.meta) {
      const winCombo = combo || `Windows+${key || 'Unknown'}`;
      logger.debug(`[WINDOWS KEY] Blocked Windows key combination: ${winCombo}`);
      logger.debug(`[WINDOWS KEY] Input details - key: ${key}, code: ${input.code}, meta: ${input.meta}, control: ${input.control}, alt: ${input.alt}, shift: ${input.shift}`);
      event.preventDefault();
      notifyShortcutViolation(window, { 
        combo: winCombo, 
        source: 'before-input' 
      });
      return; // Early return - don't process further
    }
    
    // Block bare Windows key (if detected as Meta key without other modifiers)
    // This is a fallback for cases where meta flag might not be set correctly
    if (key === 'Meta' || input.code === 'MetaLeft' || input.code === 'MetaRight') {
      if (!input.control && !input.alt && !input.shift) {
        logger.debug('[WINDOWS KEY] Blocked bare Windows key (Meta)');
        event.preventDefault();
        notifyShortcutViolation(window, { combo: 'Windows', source: 'before-input' });
        return;
      }
    }
    
    // Block F1-F12 dengan cara apapun (termasuk dengan Fn key)
    const isFunctionKey = /^F(1[0-2]|[1-9])$/.test(key) || /^F(1[0-2]|[1-9])$/.test(input.code || '');
    
    if (isFunctionKey) {
      logger.debug(`Blocked function key ${key} (combo: ${combo})`);
      event.preventDefault();
      notifyShortcutViolation(window, { 
        combo: combo || key, 
        source: 'before-input' 
      });
      return;
    }
    
    // Block special keys (Enter, Tab, Delete, Insert, Home, End, PageUp, PageDown, Arrow keys, NumLock)
    // Note: Backspace is ALLOWED - needed for text editing in forms
    const specialKeys = ['Enter', 'Tab', 'Delete', 'Insert', 'Home', 'End', 
                         'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                         'Escape', 'Esc', 'NumLock'];
    const isSpecialKey = specialKeys.some(sk => 
      key === sk || input.code === sk || 
      input.code === `Key${sk}` || input.code === sk.replace('Arrow', '')
    );
    
    // Block special keys jika tidak ada modifier atau dengan modifier yang diblokir
    // Note: Windows key (input.meta) sudah di-handle di atas, jadi tidak perlu check lagi
    if (isSpecialKey) {
      // Allow jika ada modifier yang tidak diblokir (untuk kombinasi tertentu)
      const hasBlockedModifier = input.control || input.alt;
      if (!hasBlockedModifier || blockedCombinations.has(combo)) {
        logger.debug(`Blocked special key ${key} (combo: ${combo})`);
        event.preventDefault();
        notifyShortcutViolation(window, { 
          combo: combo || key, 
          source: 'before-input' 
        });
        return;
      }
    }
    
    // Block Alt key (bare)
    if (key === 'Alt' && !input.control && !input.shift && !input.meta) {
      logger.debug('Blocked bare Alt key');
      event.preventDefault();
      notifyShortcutViolation(window, { combo: 'Alt', source: 'before-input' });
      return;
    }
    
    // Block berdasarkan blockedCombinations
    if (combo && blockedCombinations.has(combo)) {
      // Ctrl+C tidak diblokir di development mode untuk memungkinkan stop server
      if (isDev && combo === 'Ctrl+C') {
        return;
      }
      logger.debug(`Blocked combination ${combo}`);
      event.preventDefault();
      notifyShortcutViolation(window, { combo, source: 'before-input' });
    }
  });
}

export function unregisterShortcutLocks() {
  // Uninstall native hook if installed
  if (isNativeKeyboardHookAvailable() && isNativeKeyboardHookInstalled()) {
    logger.info('Uninstalling native keyboard hook');
    uninstallNativeKeyboardHook();
  }
  // Unregister Electron shortcuts
  globalShortcut.unregisterAll();
}

function formatCombo(input: Input) {
  const parts: string[] = [];
  // Handle Windows key (Meta) separately from Ctrl for accurate logging
  if (input.meta) parts.push('Windows');
  if (input.control) parts.push('Ctrl');
  if (input.alt) parts.push('Alt');
  if (input.shift) parts.push('Shift');
  const key = normalizeKey(input.key || input.code);
  // Don't add 'Meta' as key if it's already handled as modifier
  if (key && key !== 'Meta') parts.push(key);
  return parts.join('+');
}

function normalizeKey(key?: string | null) {
  if (!key) return '';
  if (key.startsWith('Key')) {
    return key.replace('Key', '');
  }
  // Handle Windows/Meta key
  if (key === 'Meta' || key === 'MetaLeft' || key === 'MetaRight') {
    return 'Meta';
  }
  if (key === 'Escape' || key === 'Esc') {
    return 'Escape';
  }
  // Handle Arrow keys
  if (key === 'ArrowUp' || key === 'Up') return 'Up';
  if (key === 'ArrowDown' || key === 'Down') return 'Down';
  if (key === 'ArrowLeft' || key === 'Left') return 'Left';
  if (key === 'ArrowRight' || key === 'Right') return 'Right';
  // Handle Page Up/Down
  if (key === 'PageUp') return 'PageUp';
  if (key === 'PageDown') return 'PageDown';
  // Handle other special keys
  if (key === 'Enter' || key === 'Return') return 'Enter';
  if (key === 'Tab') return 'Tab';
  if (key === 'Delete' || key === 'Del') return 'Delete';
  if (key === 'Backspace') return 'Backspace';
  if (key === 'Insert' || key === 'Ins') return 'Insert';
  if (key === 'Home') return 'Home';
  if (key === 'End') return 'End';
  if (key === 'NumLock') return 'NumLock';
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

function normalizeCombo(accelerator: string) {
  return accelerator
    .replace('CommandOrControl', 'Ctrl')
    .replace('Super', 'Windows')
    .trim();
}

function warnUnregistered(accelerator: string, requiresOsPolicy?: boolean) {
  if (requiresOsPolicy) {
    logger.warn(
      `${accelerator} tidak bisa dikunci lewat Electron. Aktifkan Mode Kiosk / GPO OS untuk memblokir pintasan ini.`
    );
  } else {
    logger.warn(`Unable to register ${accelerator}`);
  }
}

function notifyShortcutViolation(
  window: BrowserWindow,
  payload: { combo: string; source: 'before-input' | 'global-shortcut' }
) {
  if (window.isDestroyed()) return;
  const now = Date.now();
  if (
    payload.combo === lastNotifiedCombo &&
    now - lastShortcutNotification < SHORTCUT_NOTIFICATION_INTERVAL
  ) {
    logger.debug(
      `Skipping shortcut notification for ${payload.combo} (throttled ${now - lastShortcutNotification}ms)`
    );
    return;
  }
  lastShortcutNotification = now;
  lastNotifiedCombo = payload.combo;
  window.webContents.send('exam:warning', {
    combo: payload.combo,
    source: payload.source,
    timestamp: new Date().toISOString(),
    message: `Pintasan ${payload.combo} diblokir. Tetap fokus pada ujian.`
  });
}

