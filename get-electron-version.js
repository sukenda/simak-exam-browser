// Simple script to get Electron version
try {
  const electronPkg = require('electron/package.json');
  console.log(electronPkg.version);
} catch (e) {
  console.error('Failed to get Electron version:', e.message);
  process.exit(1);
}

