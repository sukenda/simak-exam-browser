import fetch from 'node-fetch';
import { logger } from '../logger';
import { appConfig } from '../config';

type FocusEventPayload = {
  focused: boolean;
  reason: string;
  timestamp: string;
};

export async function reportFocusChange(payload: FocusEventPayload) {
  if (!appConfig.attentionWebhookUrl) {
    return;
  }
  // API reporting temporarily disabled
  void payload;
}

