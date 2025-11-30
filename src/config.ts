import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { existsSync } from 'fs';

function findEnvPath(): string {
  try {
    // Coba import app secara dinamis (hanya jika sudah ready)
    const { app } = require('electron');
    
    if (app && app.isPackaged) {
      // Production mode - .env ada di resources folder (di luar asar)
      // extraFiles menempatkan file di resources folder
      if (process.resourcesPath) {
        const resourcesEnvPath = join(process.resourcesPath, '.env');
        if (existsSync(resourcesEnvPath)) {
          return resourcesEnvPath;
        }
      }
      
      // Fallback: cek di folder yang sama dengan app.asar
      const appPath = app.getAppPath();
      const envPath = join(appPath, '..', '.env');
      if (existsSync(envPath)) {
        return envPath;
      }
      
      // Fallback: cek di folder app (untuk NSIS installer)
      const appDir = app.getPath('exe');
      const appDirEnvPath = join(appDir, '..', '.env');
      if (existsSync(appDirEnvPath)) {
        return appDirEnvPath;
      }
    }
  } catch (e) {
    // app belum ready, lanjut ke fallback
  }
  
  // 2. Cek di resources folder (fallback jika app belum ready)
  if (process.resourcesPath) {
    const resourcesEnvPath = join(process.resourcesPath, '.env');
    if (existsSync(resourcesEnvPath)) {
      return resourcesEnvPath;
    }
  }
  
  // 3. Default ke current directory (development)
  return '.env';
}

// Load initial .env (mungkin belum akurat jika app belum ready)
let envPath = findEnvPath();
loadEnv({ path: envPath });

// Export function untuk reload config setelah app ready
export function reloadConfig() {
  envPath = findEnvPath();
  const result = loadEnv({ path: envPath, override: true });
  
  // Log untuk debugging
  const { logger } = require('./logger');
  logger.info(`Loading .env from: ${envPath}`);
  logger.info(`EXAM_APP_URL: ${process.env.EXAM_APP_URL ?? 'not set, using default'}`);
  logger.info(`ATTENTION_WEBHOOK_URL: ${process.env.ATTENTION_WEBHOOK_URL ?? 'not set, using default'}`);
  logger.info(`EXAM_REPORT_SECRET_KEY: ${process.env.EXAM_REPORT_SECRET_KEY ? 'configured' : 'not set'}`);
  
  // Update appConfig dengan nilai baru, gunakan default jika tidak ditemukan
  appConfig.examUrl = process.env.EXAM_APP_URL ?? DEFAULT_URL;
  appConfig.attentionWebhookUrl = process.env.ATTENTION_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL;
  appConfig.adminPin = process.env.ADMIN_PIN ?? '123456';
  appConfig.adminShortcut = process.env.ADMIN_SHORTCUT ?? DEFAULT_SHORTCUT;
  appConfig.sentryDsn = process.env.SENTRY_DSN;
  appConfig.examReportSecretKey = process.env.EXAM_REPORT_SECRET_KEY;
  
  logger.info(`Final config - examUrl: ${appConfig.examUrl}`);
  logger.info(`Final config - attentionWebhookUrl: ${appConfig.attentionWebhookUrl}`);
  logger.info(`Final config - SENTRY_DSN: ${appConfig.sentryDsn ? 'configured' : 'not set'}`);
  logger.info(`Final config - EXAM_REPORT_SECRET_KEY: ${appConfig.examReportSecretKey ? 'configured' : 'not set'}`);
}

const DEFAULT_URL = 'https://simakkhaskempek.com';
const DEFAULT_WEBHOOK_URL = 'https://api.simakkhaskempek.com';
const DEFAULT_SHORTCUT = 'Ctrl+Alt+Shift+A';

export const appConfig = {
  examUrl: process.env.EXAM_APP_URL ?? DEFAULT_URL,
  attentionWebhookUrl: process.env.ATTENTION_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL,
  adminPin: process.env.ADMIN_PIN ?? '123456',
  adminShortcut: process.env.ADMIN_SHORTCUT ?? DEFAULT_SHORTCUT,
  sentryDsn: process.env.SENTRY_DSN,
  examReportSecretKey: process.env.EXAM_REPORT_SECRET_KEY
};

export const isDev = process.env.NODE_ENV === 'development';

