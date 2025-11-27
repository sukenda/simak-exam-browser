import { build, context } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  external: ['electron', 'electron-updater']
};

const outDir = join(__dirname, 'dist');

async function bundleWithOptionalWatch({ entry, outfile, label }) {
  const options = {
    ...common,
    entryPoints: [join(__dirname, entry)],
    outfile: join(outDir, outfile),
    format: 'cjs'
  };

  if (!isWatch) {
    return build(options);
  }

  const ctx = await context(options);
  await ctx.watch();
  console.log(`👀 Watching ${label}...`);
  return ctx;
}

async function buildMain() {
  return bundleWithOptionalWatch({
    entry: 'src/main.ts',
    outfile: 'main.js',
    label: 'Main'
  });
}

async function buildPreload() {
  return bundleWithOptionalWatch({
    entry: 'src/preload.ts',
    outfile: 'preload.js',
    label: 'Preload'
  });
}

async function buildAdminPreload() {
  return bundleWithOptionalWatch({
    entry: 'src/adminPreload.ts',
    outfile: 'adminPreload.js',
    label: 'Admin preload'
  });
}

async function buildInfoPreload() {
  return bundleWithOptionalWatch({
    entry: 'src/infoPreload.ts',
    outfile: 'infoPreload.js',
    label: 'Info preload'
  });
}

async function copyStatic() {
  const srcStatic = join(__dirname, 'static');
  if (!fs.existsSync(srcStatic)) return;
  await fs.copy(srcStatic, join(outDir, 'static'));
}

async function run() {
  await fs.ensureDir(outDir);
  if (!isWatch) {
    await fs.emptyDir(outDir);
  }
  await Promise.all([buildMain(), buildPreload(), buildAdminPreload(), buildInfoPreload()]);
  await copyStatic();
  if (isWatch) {
    console.log('🕒 Watching for changes...');
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

