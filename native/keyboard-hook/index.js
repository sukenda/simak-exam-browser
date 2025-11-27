// Optional native module - will fallback gracefully if not available
let nativeModule = null;

try {
  nativeModule = require('./build/Release/keyboard-hook.node');
} catch (error) {
  // Native module not available - this is OK, we'll use fallback
  console.warn('Native keyboard hook not available, using fallback:', error.message);
}

module.exports = {
  installHook: () => {
    if (nativeModule) {
      try {
        return nativeModule.installHook();
      } catch (error) {
        console.error('Failed to install native hook:', error);
        return false;
      }
    }
    return false;
  },
  uninstallHook: () => {
    if (nativeModule) {
      try {
        return nativeModule.uninstallHook();
      } catch (error) {
        console.error('Failed to uninstall native hook:', error);
        return false;
      }
    }
    return false;
  },
  isInstalled: () => {
    if (nativeModule) {
      try {
        return nativeModule.isInstalled();
      } catch (error) {
        return false;
      }
    }
    return false;
  },
  isAvailable: () => nativeModule !== null
};

