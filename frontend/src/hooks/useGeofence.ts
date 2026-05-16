import { useEffect, useRef } from 'react';
import { type GPSPosition } from './useGPS';
import { type Checkpoint } from '../api';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_MS = 120_000; // 2 minutes between passages at the same checkpoint
const RETRIGGER_GAP_MS = 30_000; // prevent double-trigger while standing inside the radius

export function useGeofence(
  position: GPSPosition | null,
  checkpoints: Checkpoint[],
  cooldowns: Record<string, number>,
  onTrigger: (checkpoint: Checkpoint) => void
) {
  const lastTriggeredRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!position) return;
    const now = Date.now();

    for (const cp of checkpoints) {
      // Skip if within user-facing cooldown (set after each passage action)
      if (cooldowns[cp.id] && now - cooldowns[cp.id] < COOLDOWN_MS) continue;

      // Skip if we already triggered this CP recently (prevent double-trigger inside radius)
      const lastTrigger = lastTriggeredRef.current.get(cp.id) || 0;
      if (now - lastTrigger < RETRIGGER_GAP_MS) continue;

      const dist = haversineDistance(position.lat, position.lng, cp.lat, cp.lng);
      if (dist <= cp.radius) {
        lastTriggeredRef.current.set(cp.id, now);
        onTrigger(cp);
      }
    }
  }, [position, checkpoints, cooldowns, onTrigger]);
}
