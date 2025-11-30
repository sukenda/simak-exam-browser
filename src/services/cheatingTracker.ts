import { logger } from '../logger';
import { StudentInfo } from '../utils/studentInfo';

export type CheatingEventType = 
  | 'shortcut_blocked'
  | 'window_blur'
  | 'window_minimize'
  | 'window_restore'
  | 'download'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'context_menu'
  | 'devtools_attempt'
  | 'fullscreen_exit'
  | 'taskbar_visible'
  | 'multiple_window'
  | 'screen_capture';

export type EventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CheatingEvent {
  // Event identification
  id: string; // UUID atau timestamp-based ID
  eventType: CheatingEventType;
  eventName: string; // Human readable name
  
  // Severity
  severity: EventSeverity;
  
  // Timestamp
  timestamp: string; // ISO 8601
  
  // Student info (will be populated when sending)
  studentInfo?: StudentInfo;
  
  // Technical context
  platform: string;
  appVersion: string;
  
  // Additional metadata
  metadata?: {
    keyCombo?: string;
    windowState?: string;
    fileName?: string;
    reason?: string;
    [key: string]: any;
  };
}

class CheatingTracker {
  private events: CheatingEvent[] = [];
  private maxEvents = 10000; // Limit untuk mencegah memory overflow
  private readonly appVersion: string;
  private readonly platform: string;
  private pengerjaanIds: Set<string> = new Set(); // Track as string, convert to number later

  constructor() {
    const { app } = require('electron');
    this.appVersion = app.getVersion();
    this.platform = process.platform;
  }

  /**
   * Track an event
   */
  trackEvent(
    eventType: CheatingEventType,
    eventName: string,
    severity: EventSeverity = 'medium',
    metadata?: Record<string, any>
  ): void {
    const event: CheatingEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      eventName,
      severity,
      timestamp: new Date().toISOString(),
      platform: this.platform,
      appVersion: this.appVersion,
      metadata
    };

    this.events.push(event);

    // Prevent memory overflow
    if (this.events.length > this.maxEvents) {
      // Keep only the most recent events
      this.events = this.events.slice(-this.maxEvents);
      logger.warn(`[CHEATING TRACKER] Reached max events limit, keeping only recent ${this.maxEvents} events`);
    }

    logger.debug(`[CHEATING TRACKER] Event tracked: ${eventName}`, {
      eventType,
      severity,
      totalEvents: this.events.length
    });
  }

  /**
   * Get all tracked events
   */
  getAllEvents(): CheatingEvent[] {
    return [...this.events]; // Return copy
  }

  /**
   * Get events count
   */
  getEventsCount(): number {
    return this.events.length;
  }

  /**
   * Clear all events (after successful send)
   */
  clearEvents(): void {
    const count = this.events.length;
    this.events = [];
    logger.info(`[CHEATING TRACKER] Cleared ${count} events`);
  }

  /**
   * Get events summary for logging
   */
  getSummary(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.events.forEach(event => {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    });

    return {
      total: this.events.length,
      byType,
      bySeverity
    };
  }

  /**
   * Track pengerjaan ID yang dibuka
   */
  trackPengerjaanId(pengerjaanId: string): void {
    if (pengerjaanId && pengerjaanId.trim()) {
      const trimmedId = pengerjaanId.trim();
      const wasNew = !this.pengerjaanIds.has(trimmedId);
      this.pengerjaanIds.add(trimmedId);
      logger.info(`[CHEATING TRACKER] Tracked pengerjaanId: ${trimmedId} (${wasNew ? 'NEW' : 'duplicate'}, total: ${this.pengerjaanIds.size})`, {
        pengerjaanId: trimmedId,
        isNew: wasNew,
        totalCount: this.pengerjaanIds.size,
        allIds: Array.from(this.pengerjaanIds)
      });
    }
  }

  /**
   * Get all tracked pengerjaan IDs as array of numbers
   */
  getAllPengerjaanIds(): number[] {
    return Array.from(this.pengerjaanIds)
      .map(id => {
        const numId = parseInt(id, 10);
        return isNaN(numId) ? null : numId;
      })
      .filter((id): id is number => id !== null)
      .sort((a, b) => a - b); // Sort ascending
  }

  /**
   * Clear pengerjaan IDs (after successful send)
   */
  clearPengerjaanIds(): void {
    const count = this.pengerjaanIds.size;
    this.pengerjaanIds.clear();
    logger.info(`[CHEATING TRACKER] Cleared ${count} pengerjaan IDs`);
  }
}

// Singleton instance
export const cheatingTracker = new CheatingTracker();

