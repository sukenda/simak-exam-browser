import fetch from 'node-fetch';
import { logger } from '../logger';

export async function waitForExamServer(url: string, timeoutMs = 15_000, intervalMs = 2_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        logger.info('Exam server reachable');
        return true;
      }
    } catch (error) {
      logger.warn('Exam server check failed', error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

