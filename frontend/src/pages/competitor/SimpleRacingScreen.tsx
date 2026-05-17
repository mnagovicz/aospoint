import { useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle, XCircle, Radio, WifiOff } from 'lucide-react';
import { type Checkpoint, recordPassage } from '../../api';
import { playBeep, vibrate } from '../../utils/audio';
import { useGPS } from '../../hooks/useGPS';
import { useGeofence } from '../../hooks/useGeofence';
import { savePendingPassage, loadPendingPassages, clearPendingPassages } from '../../utils/storage';

interface Props {
  session: {
    eventId: string;
    competitorId: string;
    competitorCode: string;
    competitorName: string;
    competitorNumber: string;
  };
  checkpoints: Checkpoint[];
}

interface CheckpointDialogState {
  checkpoint: Checkpoint;
  countdown: number;
}

export default function SimpleRacingScreen({ session, checkpoints }: Props) {
  const { position, error: gpsError } = useGPS();
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [dialog, setDialog] = useState<CheckpointDialogState | null>(null);
  const [passages, setPassages] = useState<{ checkpointId: string; action: string; timestamp: string }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pending = loadPendingPassages();
    if (pending.length > 0) {
      setSyncing(true);
      Promise.all(
        pending.map(p => recordPassage(p.competitorId, p.checkpointId, p.action, p.competitorCode, p.timestamp))
      ).then(() => { clearPendingPassages(); setSyncing(false); }).catch(() => setSyncing(false));
    }
  }, []);

  const openDialog = useCallback((cp: Checkpoint) => {
    playBeep(880, 300);
    vibrate([200, 100, 200]);
    setDialog({ checkpoint: cp, countdown: 15 });
  }, []);

  useGeofence(position, checkpoints, cooldowns, openDialog);

  useEffect(() => {
    if (!dialog) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setDialog(prev => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          clearInterval(countdownRef.current!);
          handleAction(prev.checkpoint, 'ignored');
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [dialog?.checkpoint.id]);

  const handleAction = useCallback(async (cp: Checkpoint, action: 'recorded' | 'ignored') => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setDialog(null);
    setCooldowns(prev => ({ ...prev, [cp.id]: Date.now() }));
    const timestamp = new Date().toISOString();
    setPassages(prev => [...prev, { checkpointId: cp.id, action, timestamp }]);
    try {
      await recordPassage(session.competitorId, cp.id, action, session.competitorCode, timestamp);
    } catch {
      savePendingPassage({ competitorId: session.competitorId, checkpointId: cp.id, action, competitorCode: session.competitorCode, timestamp });
    }
  }, [session]);

  const recorded = passages.filter(p => p.action === 'recorded');
  const totalPassages = recorded.length;
  const progressPct = checkpoints.length > 0 ? Math.min((totalPassages / checkpoints.length) * 100, 100) : 0;

  // Poslední zaznamenaný checkpoint pro velké písmeno
  const lastPassage = recorded[recorded.length - 1];
  const lastCp = lastPassage ? checkpoints.find(c => c.id === lastPassage.checkpointId) : null;
  const lastCode = lastCp?.code || lastCp?.name || '';

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgba(10,10,15,0.96)', borderBottom: '1px solid #1a1a2e', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'white' }}>{session.competitorName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{ color: '#4ecca3', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>#{session.competitorNumber}</span>
              <div style={{ fontSize: 11, color: gpsError ? '#ef4444' : position ? '#10b981' : '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                {gpsError ? <><WifiOff size={10} /> GPS chyba</> : position ? <><Navigation size={10} /> ±{Math.round(position.accuracy)}m</> : <><Radio size={10} /> GPS...</>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4ecca3' }}>{totalPassages}</div>
            <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>průjezdů</div>
          </div>
        </div>
        <div style={{ marginTop: 8, height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#4ecca3', borderRadius: 2, width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Jízdní výkaz */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1a1a2e', padding: '8px 16px', background: 'rgba(10,10,15,0.96)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Jízdní výkaz</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0, 1, 2].map(rowIdx => {
            const p = recorded[rowIdx];
            const cp = p ? checkpoints.find(c => c.id === p.checkpointId) : null;
            const name = cp?.code || cp?.name || '';
            return (
              <div key={rowIdx} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {name.length > 0
                  ? name.split('').map((char, ci) => (
                      <div key={ci} style={{ width: 26, height: 26, flexShrink: 0, border: '1.5px solid #4ecca3', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'white' }}>{char}</div>
                    ))
                  : Array.from({ length: 6 }).map((_, ci) => (
                      <div key={ci} style={{ width: 26, height: 26, flexShrink: 0, border: '1.5px solid #1a1a2e', borderRadius: 4, opacity: 0.4 }} />
                    ))
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Hlavní plocha — velké písmeno */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {lastCode ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Poslední zaznamenaný bod
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {lastCode.split('').map((char, i) => (
                <div key={i} style={{
                  width: 100, height: 120,
                  border: '3px solid #4ecca3',
                  borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace', fontWeight: 900, fontSize: 80, color: 'white',
                  background: 'rgba(78,204,163,0.06)',
                  boxShadow: '0 0 32px rgba(78,204,163,0.15)',
                }}>{char}</div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{lastCp?.name}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📍</div>
            <div style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>Čekám na první průjezd...</div>
            <div style={{ fontSize: 13, color: '#374151', textAlign: 'center', maxWidth: 240 }}>GPS geofencing aktivní, kontrolní body se zaznamenají automaticky</div>
          </>
        )}

        {syncing && (
          <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, background: '#16213e', border: '1px solid #1a1a2e', borderRadius: 12, padding: '10px 16px', fontSize: 13, textAlign: 'center', color: '#9ca3af' }}>
            🔄 Synchronizuji offline záznamy...
          </div>
        )}
      </div>

      {/* Checkpoint Dialog */}
      {dialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}>
          <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>
              <MapPin size={36} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>KONTROLNÍ BOD</div>

            {/* Velké písmeno kódu */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              {(dialog.checkpoint.code || dialog.checkpoint.name).split('').map((char, i) => (
                <div key={i} style={{ width: 80, height: 96, border: '3px solid #4ecca3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 900, fontSize: 64, color: 'white', background: 'rgba(78,204,163,0.08)' }}>{char}</div>
              ))}
            </div>
            <div style={{ fontSize: 15, color: '#9ca3af', marginBottom: 20 }}>{dialog.checkpoint.name}</div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#16213e', border: '1px solid #1a1a2e', borderRadius: 999, padding: '8px 20px', marginBottom: 28 }}>
              <span style={{ color: '#9ca3af', fontSize: 14 }}>Auto-ignorovat za</span>
              <span style={{ color: dialog.countdown <= 5 ? '#ef4444' : '#f59e0b', fontSize: 22, fontWeight: 800 }}>{dialog.countdown}s</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => handleAction(dialog.checkpoint, 'recorded')} className="btn-success" style={{ minHeight: 64, fontSize: 17 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <CheckCircle size={22} /> ZAZNAMENAT
                </span>
              </button>
              <button onClick={() => handleAction(dialog.checkpoint, 'ignored')} className="btn-secondary" style={{ minHeight: 52 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <XCircle size={18} /> IGNOROVAT
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
