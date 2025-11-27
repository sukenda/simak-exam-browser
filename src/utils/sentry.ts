import * as Sentry from '@sentry/electron';
import { app } from 'electron';
import { logger } from '../logger';
import { isDev } from '../config';

/**
 * Initialize Sentry for crash reporting
 * @param dsn Sentry DSN URL (optional, will use SENTRY_DSN env var if not provided)
 */
export function initSentry(dsn?: string): void {
  const sentryDsn = dsn || process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    // Logger mungkin belum ready, gunakan console sebagai fallback
    try {
      logger.warn('SENTRY_DSN not set, crash reporting disabled');
    } catch {
      console.warn('SENTRY_DSN not set, crash reporting disabled');
    }
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: isDev ? 'development' : 'production',
      release: app.getVersion(),
      beforeSend(event) {
        // Log to local file as well
        logger.error('Sentry event:', {
          message: event.message,
          exception: event.exception,
          level: event.level,
          tags: event.tags,
          extra: event.extra
        });
        return event;
      },
      // Set sample rate for performance monitoring (0.0 to 1.0)
      tracesSampleRate: isDev ? 1.0 : 0.1,
      // Additional context
      initialScope: {
        tags: {
          platform: process.platform,
          arch: process.arch,
          electron_version: process.versions.electron,
          node_version: process.versions.node
        }
      }
    });

    // Logger mungkin belum ready, gunakan console sebagai fallback
    try {
      logger.info('Sentry initialized successfully');
      logger.info(`Sentry environment: ${isDev ? 'development' : 'production'}`);
      logger.info(`Sentry release: ${app.getVersion()}`);
    } catch {
      console.log('Sentry initialized successfully');
      console.log(`Sentry environment: ${isDev ? 'development' : 'production'}`);
      console.log(`Sentry release: ${app.getVersion()}`);
    }
  } catch (error) {
    try {
      logger.error('Failed to initialize Sentry:', error);
    } catch {
      console.error('Failed to initialize Sentry:', error);
    }
  }
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(userId?: string, username?: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    username,
    email
  });
}

/**
 * Clear user context
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Capture message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

