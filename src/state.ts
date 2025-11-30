import { randomUUID } from 'crypto';

let quitting = false;
let sessionId: string | null = null;

export function setQuitting(value: boolean) {
  quitting = value;
}

export function isQuitting() {
  return quitting;
}

export function getSessionId(): string {
  if (!sessionId) {
    sessionId = randomUUID();
  }
  return sessionId;
}

