import { type Checkpoint } from '../api';

const CHECKPOINTS_KEY = 'aospoint_checkpoints';
const PENDING_PASSAGES_KEY = 'aospoint_pending_passages';
const SESSION_KEY = 'aospoint_session';

export interface CompetitorSession {
  eventId: string;
  stageId: string;
  competitorId: string;
  competitorCode: string;
  competitorName: string;
  competitorNumber: string;
}

export function saveSession(session: CompetitorSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): CompetitorSession | null {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function saveCheckpoints(eventId: string, stageIdOrCheckpoints: string | Checkpoint[], checkpoints?: Checkpoint[]) {
  if (typeof stageIdOrCheckpoints === 'string') {
    localStorage.setItem(`${CHECKPOINTS_KEY}_${eventId}_${stageIdOrCheckpoints}`, JSON.stringify(checkpoints));
  } else {
    localStorage.setItem(`${CHECKPOINTS_KEY}_${eventId}`, JSON.stringify(stageIdOrCheckpoints));
  }
}

export function loadCheckpoints(eventId: string, stageId?: string): Checkpoint[] {
  try {
    const key = stageId ? `${CHECKPOINTS_KEY}_${eventId}_${stageId}` : `${CHECKPOINTS_KEY}_${eventId}`;
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

interface PendingPassage {
  competitorId: string;
  checkpointId: string;
  stageId?: string;
  action: 'recorded' | 'ignored';
  competitorCode: string;
  timestamp: string;
}

export function savePendingPassage(passage: PendingPassage) {
  const existing = loadPendingPassages();
  existing.push(passage);
  localStorage.setItem(PENDING_PASSAGES_KEY, JSON.stringify(existing));
}

export function loadPendingPassages(): PendingPassage[] {
  try {
    const s = localStorage.getItem(PENDING_PASSAGES_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

export function clearPendingPassages() {
  localStorage.removeItem(PENDING_PASSAGES_KEY);
}
