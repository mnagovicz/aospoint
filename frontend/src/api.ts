import { API_URL, ADMIN_KEY } from './config';

export interface Event {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'active' | 'finished';
  accessCode?: string;
  createdAt: string;
}

export interface Checkpoint {
  id: string;
  eventId: string;
  name: string;
  code: string;
  type: 'SPK' | 'PK';
  lat: number;
  lng: number;
  radius: number;
  order: number;
  createdAt: string;
}

export interface Competitor {
  id: string;
  eventId: string;
  driver: string;
  coDriver: string;
  name: string; // "driver / coDriver" — for backwards compat
  number: string | number;
  vehicle?: string;
  accessCode?: string;
  createdAt: string;
}

export interface Passage {
  id: string;
  competitorId: string;
  checkpointId: string;
  eventId: string;
  action: 'recorded' | 'ignored';
  timestamp: string;
  createdAt: string;
}

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'x-admin-key': ADMIN_KEY,
});

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
});

// Events
export const createEvent = (name: string, date: string) =>
  fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name, date }),
  }).then((r) => r.json());

export const listEvents = (accessCode?: string): Promise<Event[]> => {
  const url = accessCode ? `${API_URL}/events?accessCode=${accessCode}` : `${API_URL}/events`;
  return fetch(url, { headers: accessCode ? jsonHeaders() : adminHeaders() }).then((r) => r.json());
};

export const getEvent = (id: string): Promise<Event> =>
  fetch(`${API_URL}/events/${id}`, { headers: adminHeaders() }).then((r) => r.json());

// Checkpoints
export const createCheckpoint = (
  eventId: string,
  data: { name: string; code: string; type: string; lat: number; lng: number; radius: number; order: number }
) =>
  fetch(`${API_URL}/events/${eventId}/checkpoints`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const updateCheckpoint = (
  eventId: string,
  checkpointId: string,
  data: { name?: string; code?: string; lat?: number; lng?: number; radius?: number }
) =>
  fetch(`${API_URL}/events/${eventId}/checkpoints/${checkpointId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const deleteCheckpoint = (eventId: string, checkpointId: string) =>
  fetch(`${API_URL}/events/${eventId}/checkpoints/${checkpointId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  }).then((r) => r.json());

export const listCheckpoints = (eventId: string): Promise<Checkpoint[]> =>
  fetch(`${API_URL}/events/${eventId}/checkpoints`, { headers: jsonHeaders() }).then((r) => r.json());

// Competitors
export const createCompetitor = (
  eventId: string,
  data: { driver: string; coDriver: string; number: string; vehicle?: string }
) =>
  fetch(`${API_URL}/events/${eventId}/competitors`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const updateCompetitor = (
  eventId: string,
  competitorId: string,
  data: { driver?: string; coDriver?: string; number?: string }
) =>
  fetch(`${API_URL}/events/${eventId}/competitors/${competitorId}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const deleteCompetitor = (eventId: string, competitorId: string) =>
  fetch(`${API_URL}/events/${eventId}/competitors/${competitorId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  }).then((r) => r.json());

export const listCompetitors = (eventId: string, isAdmin = false): Promise<Competitor[]> =>
  fetch(`${API_URL}/events/${eventId}/competitors`, {
    headers: isAdmin ? adminHeaders() : jsonHeaders(),
  }).then((r) => r.json());

// Passages
export const recordPassage = (
  competitorId: string,
  checkpointId: string,
  action: 'recorded' | 'ignored',
  competitorCode: string,
  timestamp?: string
) =>
  fetch(`${API_URL}/passages`, {
    method: 'POST',
    headers: { ...jsonHeaders(), 'x-competitor-code': competitorCode },
    body: JSON.stringify({ competitorId, checkpointId, action, timestamp: timestamp || new Date().toISOString() }),
  }).then((r) => r.json());

export const deletePassage = (passageId: string, competitorCode: string) =>
  fetch(`${API_URL}/passages/${passageId}`, {
    method: 'DELETE',
    headers: { ...jsonHeaders(), 'x-competitor-code': competitorCode },
  }).then(r => r.json());

export const getResults = (eventId: string) =>
  fetch(`${API_URL}/events/${eventId}/results`, { headers: adminHeaders() }).then((r) => r.json());
