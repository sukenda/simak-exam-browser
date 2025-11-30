import fetch from 'node-fetch';
import { logger } from '../logger';
import { appConfig } from '../config';
import { cheatingTracker, CheatingEvent } from './cheatingTracker';
import { StudentInfo, getStudentInfoFromStorage, getCachedStudentInfo, clearCachedStudentInfo } from '../utils/studentInfo';
import { BrowserWindow } from 'electron';
import { app } from 'electron';
import { networkInterfaces } from 'os';
import { getSessionId } from '../state';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

interface CheatingReportPayload {
  // Report identification
  reportId: string;
  reportType: 'cheating_report';
  reportVersion: string;
  
  // Student info (camelCase)
  siswaId?: number;
  namaLengkap?: string;
  
  // Session info (camelCase)
  sessionId: string; // UUID
  sessionStartTime: string;
  sessionEndTime: string;
  durationSeconds: number;
  
  // Pengerjaan IDs (array of numbers)
  pengerjaanIds: number[]; // Format: [797163, 797164, 797165]
  
  // Summary statistics (camelCase)
  totalEvents: number;
  eventsByType: Record<string, number>; // JSON in database
  eventsBySeverity: Record<string, number>; // JSON in database
  riskScore: number; // DECIMAL(3,2) in database
  suspiciousActivities: string[]; // JSON in database
  
  // Technical info (camelCase)
  platform: string;
  appVersion: string;
  electronVersion: string;
  nodeVersion?: string;
  osVersion?: string;
  arch?: string;
  
  // Events data (camelCase)
  eventsData: CheatingEvent[]; // JSON in database
  
  // Metadata (camelCase)
  ipAddress?: string;
  machineId?: string;
  timezone: string;
  
  // Additional metadata (camelCase)
  reportGeneratedAt: string; // ISO 8601
  reportSentAt: string; // ISO 8601
}

/**
 * Calculate risk score from events
 */
function calculateRiskScore(events: CheatingEvent[]): number {
  let score = 0;
  
  // Critical events = 2 points each
  score += events.filter(e => e.severity === 'critical').length * 2;
  
  // High severity = 1 point each
  score += events.filter(e => e.severity === 'high').length * 1;
  
  // Medium severity = 0.5 points each
  score += events.filter(e => e.severity === 'medium').length * 0.5;
  
  // Low severity = 0.1 points each
  score += events.filter(e => e.severity === 'low').length * 0.1;
  
  // Bonus penalties for specific patterns
  const minimizeCount = events.filter(e => e.eventType === 'window_minimize').length;
  if (minimizeCount > 5) score += 2;
  
  const blurCount = events.filter(e => e.eventType === 'window_blur').length;
  if (blurCount > 20) score += 1.5;
  
  const copyPasteCount = events.filter(e => 
    e.eventType === 'copy_attempt' || e.eventType === 'paste_attempt'
  ).length;
  if (copyPasteCount > 10) score += 1.5;
  
  // Normalize to 0-10 scale (divide by 10, cap at 10)
  return Math.min(10, score / 10);
}

/**
 * Get suspicious activities description
 */
function getSuspiciousActivities(events: CheatingEvent[]): string[] {
  const activities: string[] = [];
  
  const minimizeCount = events.filter(e => e.eventType === 'window_minimize').length;
  if (minimizeCount > 5) {
    activities.push(`Multiple window minimize attempts (${minimizeCount} times)`);
  }
  
  const blurCount = events.filter(e => e.eventType === 'window_blur').length;
  if (blurCount > 20) {
    activities.push(`Frequent window focus loss (${blurCount} times)`);
  }
  
  const copyPasteCount = events.filter(e => 
    e.eventType === 'copy_attempt' || e.eventType === 'paste_attempt'
  ).length;
  if (copyPasteCount > 10) {
    activities.push(`Frequent copy/paste attempts (${copyPasteCount} times)`);
  }
  
  const shortcutCount = events.filter(e => e.eventType === 'shortcut_blocked').length;
  if (shortcutCount > 50) {
    activities.push(`Excessive shortcut blocking attempts (${shortcutCount} times)`);
  }
  
  const fullscreenExitCount = events.filter(e => e.eventType === 'fullscreen_exit').length;
  if (fullscreenExitCount > 0) {
    activities.push(`Fullscreen exit attempts (${fullscreenExitCount} times)`);
  }
  
  return activities;
}

/**
 * Get IP address
 */
function getLocalIPAddress(): string | undefined {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return undefined;
}

/**
 * Generate unique report ID
 */
function generateReportId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pending reports directory
 */
function getPendingReportsDir(): string {
  return join(app.getPath('userData'), 'pending-reports');
}

/**
 * Build report payload from current state
 */
async function buildReportPayload(window: BrowserWindow | null): Promise<CheatingReportPayload | null> {
  try {
    // Always use cached student info (which was saved immediately after login)
    // Don't try to read from localStorage again - use the data that was cached during login
    let studentInfo = getCachedStudentInfo();
    
    if (!studentInfo || !studentInfo.id) {
      logger.warn('[CHEATING REPORTER] No cached student info available! Student info should have been cached during login.', {
        hasWindow: window !== null && !window?.isDestroyed()
      });
      
      // Only try to get from localStorage if window is available and we don't have cache
      // This is a fallback in case cache was never set (shouldn't happen in normal flow)
      if (window && !window.isDestroyed()) {
        logger.debug('[CHEATING REPORTER] Attempting to get student info from localStorage as last resort...');
        studentInfo = await getStudentInfoFromStorage(window, true);
        if (studentInfo && studentInfo.id) {
          logger.info('[CHEATING REPORTER] Retrieved student info from localStorage (should have been cached earlier)', {
            studentId: studentInfo.id,
            studentName: studentInfo.name
          });
        }
      }
    } else {
      logger.debug('[CHEATING REPORTER] Using cached student info (saved during login)', {
        studentId: studentInfo.id,
        studentName: studentInfo.name
      });
    }
    
    // Validate student info - must have both siswaId and namaLengkap
    if (!studentInfo || !studentInfo.id || (!studentInfo.name && !studentInfo.namaLengkap)) {
      logger.warn('[CHEATING REPORTER] Student info is missing or incomplete! Report will NOT be sent to avoid dirty data in backend', {
        hasStudentInfo: !!studentInfo,
        hasId: !!studentInfo?.id,
        hasName: !!(studentInfo?.name || studentInfo?.namaLengkap),
        hasWindow: window !== null && !window?.isDestroyed(),
        hasCachedInfo: getCachedStudentInfo() !== null
      });
      return null; // Don't send report without student info
    }
    
    // Get all tracked events
    const events = cheatingTracker.getAllEvents();
    const summary = cheatingTracker.getSummary();
    
    if (events.length === 0) {
      logger.info('[CHEATING REPORTER] No events to report');
      return null; // No events
    }
    
    // Get all pengerjaan IDs (array of numbers)
    const allPengerjaanIds = cheatingTracker.getAllPengerjaanIds();
    
    // Get session ID
    const sessionId = getSessionId();
    
    // Calculate session duration
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const startTime = firstEvent.timestamp;
    const endTime = new Date().toISOString();
    const duration = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
    
    // Calculate risk score
    const riskScore = calculateRiskScore(events);
    
    // Get suspicious activities
    const suspiciousActivities = getSuspiciousActivities(events);
    
    // Get OS version
    const os = require('os');
    const osVersion = process.platform === 'win32' 
      ? os.release() 
      : `${os.type()} ${os.release()}`;
    
    // Prepare payload with camelCase structure
    const reportGeneratedAt = new Date().toISOString();
    const reportSentAt = new Date().toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ipAddress = getLocalIPAddress();
    const machineId = app.getPath('userData');
    
    // Convert eventsByType keys to camelCase
    const eventsByTypeCamelCase: Record<string, number> = {};
    Object.keys(summary.byType).forEach(key => {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      eventsByTypeCamelCase[camelKey] = summary.byType[key];
    });
    
    const payload: CheatingReportPayload = {
      // Report identification
      reportId: generateReportId(),
      reportType: 'cheating_report',
      reportVersion: '1.0',
      
      // Student info (camelCase) - hanya id dan nama lengkap
      siswaId: studentInfo?.id ? (() => {
        const id = typeof studentInfo.id === 'number' ? studentInfo.id : Number(studentInfo.id);
        return isNaN(id) ? undefined : id;
      })() : undefined,
      namaLengkap: studentInfo?.name || studentInfo?.namaLengkap,
      
      // Session info (camelCase)
      sessionId: sessionId,
      sessionStartTime: startTime,
      sessionEndTime: endTime,
      durationSeconds: duration,
      
      // Pengerjaan IDs (array of numbers)
      pengerjaanIds: allPengerjaanIds, // Format: [797163, 797164, 797165]
      
      // Summary statistics (camelCase)
      totalEvents: events.length,
      eventsByType: eventsByTypeCamelCase,
      eventsBySeverity: summary.bySeverity,
      riskScore: riskScore,
      suspiciousActivities: suspiciousActivities,
      
      // Technical info (camelCase)
      platform: process.platform,
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      osVersion: osVersion,
      arch: process.arch,
      
      // Events data (camelCase)
      eventsData: events,
      
      // Metadata (camelCase)
      ipAddress: ipAddress,
      machineId: machineId,
      timezone: timezone,
      
      // Additional metadata (camelCase)
      reportGeneratedAt: reportGeneratedAt,
      reportSentAt: reportSentAt
    };
    
    return payload;
  } catch (error) {
    logger.error('[CHEATING REPORTER] Failed to build report payload', error);
    return null;
  }
}

/**
 * Send report payload to server
 */
async function sendReportPayload(payload: CheatingReportPayload): Promise<boolean> {
  try {
    logger.info('[CHEATING REPORTER] Sending cheating report to server', {
      reportId: payload.reportId,
      siswaId: payload.siswaId,
      totalEvents: payload.totalEvents,
      riskScore: payload.riskScore
    });
    
    // Send to server
    const webhookUrl = appConfig.attentionWebhookUrl || appConfig.examUrl;
    const reportUrl = `${webhookUrl}/kurikulum/exam-reports`;
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `simak-exam-browser/${app.getVersion()}`
    };
    
    // Add secret key if configured
    if (appConfig.examReportSecretKey) {
      headers['X-Secret-Key'] = appConfig.examReportSecretKey;
    } else {
      logger.warn('[CHEATING REPORTER] EXAM_REPORT_SECRET_KEY not configured, request may be rejected by server');
    }
    
    const response = await fetch(reportUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 seconds timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server responded with status ${response.status}: ${errorText}`);
    }
    
    const responseData = await response.json().catch(() => ({}));
    
    logger.info('[CHEATING REPORTER] Cheating report sent successfully', {
      reportId: payload.reportId,
      siswaId: payload.siswaId,
      totalEvents: payload.totalEvents,
      responseStatus: response.status,
      responseData: responseData
    });
    
    return true;
  } catch (error) {
    logger.error('[CHEATING REPORTER] Failed to send report payload', error);
    return false;
  }
}

/**
 * Save report to local file for retry later
 */
export async function saveReportToLocalFile(window: BrowserWindow | null): Promise<boolean> {
  try {
    const payload = await buildReportPayload(window);
    if (!payload) {
      logger.info('[CHEATING REPORTER] No payload to save (no events or missing student info)');
      return true; // Not an error if no events or missing student info
    }
    
    // Create directory if not exists
    const pendingDir = getPendingReportsDir();
    if (!existsSync(pendingDir)) {
      mkdirSync(pendingDir, { recursive: true });
    }
    
    // Save to file with timestamp
    const filename = `report-${Date.now()}-${payload.reportId}.json`;
    const filepath = join(pendingDir, filename);
    writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf-8');
    
    logger.info(`[CHEATING REPORTER] Report saved to local file: ${filepath}`, {
      reportId: payload.reportId,
      siswaId: payload.siswaId,
      totalEvents: payload.totalEvents
    });
    return true;
  } catch (error) {
    logger.error('[CHEATING REPORTER] Failed to save report to local file', error);
    return false;
  }
}

/**
 * Retry sending pending reports from local files
 */
export async function retryPendingReports(): Promise<void> {
  try {
    const pendingDir = getPendingReportsDir();
    if (!existsSync(pendingDir)) {
      logger.debug('[CHEATING REPORTER] No pending reports directory, skipping retry');
      return;
    }
    
    const files = readdirSync(pendingDir)
      .filter(f => f.startsWith('report-') && f.endsWith('.json'))
      .sort(); // Oldest first
    
    if (files.length === 0) {
      logger.debug('[CHEATING REPORTER] No pending reports to retry');
      return;
    }
    
    logger.info(`[CHEATING REPORTER] Found ${files.length} pending report(s) to retry`);
    
    for (const file of files) {
      const filepath = join(pendingDir, file);
      try {
        const fileContent = readFileSync(filepath, 'utf-8');
        const payload: CheatingReportPayload = JSON.parse(fileContent);
        
        // Skip reports without student info to avoid dirty data
        if (!payload.siswaId || !payload.namaLengkap) {
          logger.warn(`[CHEATING REPORTER] Skipping pending report without student info: ${file}`, {
            reportId: payload.reportId,
            hasSiswaId: !!payload.siswaId,
            hasNamaLengkap: !!payload.namaLengkap
          });
          // Delete the file to clean up
          unlinkSync(filepath);
          logger.info(`[CHEATING REPORTER] Deleted pending report without student info: ${file}`);
          continue;
        }
        
        logger.info(`[CHEATING REPORTER] Retrying pending report: ${file}`, {
          reportId: payload.reportId,
          siswaId: payload.siswaId
        });
        
        // Try to send
        const success = await sendReportPayload(payload);
        
        if (success) {
          // Delete file if sent successfully
          unlinkSync(filepath);
          logger.info(`[CHEATING REPORTER] Pending report sent and deleted: ${file}`);
        } else {
          logger.warn(`[CHEATING REPORTER] Failed to send pending report: ${file}`);
          // Keep file for next retry
        }
      } catch (error) {
        logger.error(`[CHEATING REPORTER] Error processing pending report ${file}`, error);
        // Keep file for next retry
      }
    }
  } catch (error) {
    logger.error('[CHEATING REPORTER] Error retrying pending reports', error);
  }
}

/**
 * Send all tracked events to server
 * Called when admin closes the application or before quit
 */
export async function sendCheatingReport(window: BrowserWindow | null): Promise<boolean> {
  try {
    // Build payload
    const payload = await buildReportPayload(window);
    if (!payload) {
      logger.info('[CHEATING REPORTER] No report to send (no events or missing student info)');
      return true; // Not an error - either no events or missing student info
    }
    
    // Logging
    if (payload.pengerjaanIds.length > 0) {
      logger.info('[CHEATING REPORTER] All pengerjaan IDs tracked', {
        count: payload.pengerjaanIds.length,
        ids: payload.pengerjaanIds
      });
    } else {
      logger.info('[CHEATING REPORTER] No pengerjaan IDs tracked');
    }
    
    // Try to send
    const success = await sendReportPayload(payload);
    
    if (success) {
      // Clear events, pengerjaan IDs, and student info cache after successful send
      cheatingTracker.clearEvents();
      cheatingTracker.clearPengerjaanIds();
      clearCachedStudentInfo();
      logger.info('[CHEATING REPORTER] Report sent successfully, cleared all cached data (events, pengerjaan IDs, and student info)');
      return true;
    } else {
      // Save to local file for retry later
      logger.warn('[CHEATING REPORTER] Failed to send report, saving to local file for retry...');
      await saveReportToLocalFile(window);
      return false;
    }
  } catch (error) {
    logger.error('[CHEATING REPORTER] Failed to send cheating report', error);
    
    // Save to local file as backup
    logger.warn('[CHEATING REPORTER] Saving report to local file as backup...');
    await saveReportToLocalFile(window);
    
    return false;
  }
}

