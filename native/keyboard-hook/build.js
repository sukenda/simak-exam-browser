const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get Electron version from environment variable or from process
let electronVersion = process.env.npm_config_target || process.env.ELECTRON_VERSION;

if (!electronVersion) {
  try {
    // Try to get from electron package (in parent node_modules)
    // Check multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'node_modules', 'electron', 'package.json'),
      path.join(__dirname, '..', 'node_modules', 'electron', 'package.json'),
      path.join(process.cwd(), 'node_modules', 'electron', 'package.json')
    ];
    
    let electronPkgPath = null;
    for (const pkgPath of possiblePaths) {
      if (fs.existsSync(pkgPath)) {
        electronPkgPath = pkgPath;
        break;
      }
    }
    
    if (!electronPkgPath) {
      // Try to resolve using require.resolve
      try {
        electronPkgPath = require.resolve('electron/package.json');
      } catch (e) {
        // If that fails, try parent directory
        electronPkgPath = path.join(__dirname, '..', '..', 'node_modules', 'electron', 'package.json');
      }
    }
    
    if (fs.existsSync(electronPkgPath)) {
      const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf-8'));
      electronVersion = electronPkg.version;
      console.log(`Found Electron version from package.json: ${electronVersion}`);
    } else {
      throw new Error('Electron package.json not found');
    }
  } catch (e) {
    // Fallback: try to get from process.versions.electron
    try {
      electronVersion = execSync('node -p "process.versions.electron"', { 
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..', '..')
      }).trim();
      console.log(`Found Electron version from process.versions: ${electronVersion}`);
    } catch (e2) {
      console.error('❌ Could not determine Electron version.');
      console.error('Please set ELECTRON_VERSION or npm_config_target environment variable');
      console.error('Error details:', e.message || e);
      process.exit(1);
    }
  }
}

if (!electronVersion) {
  console.error('❌ Electron version is still undefined');
  process.exit(1);
}

const arch = process.env.npm_config_arch || 'x64';
const distUrl = process.env.npm_config_disturl || 'https://electronjs.org/headers';

console.log(`Building native module for Electron ${electronVersion} (${arch})`);

const command = `node-gyp rebuild --target=${electronVersion} --arch=${arch} --dist-url=${distUrl}`;

try {
  execSync(command, { 
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ Native module built successfully!');
} catch (error) {
  console.error('❌ Failed to build native module:', error.message);
  process.exit(1);
}

