import { useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle, XCircle, Radio, WifiOff } from 'lucide-react';
import { type Checkpoint, recordPassage } from '../../api';
import { playBeep, vibrate } from '../../utils/audio';
import { useGPS } from '../../hooks/useGPS';
import { useGeofence } from '../../hooks/useGeofence';
import { savePendingPassage, loadPendingPassages, clearPendingPassages, clearSession } from '../../utils/storage';

interface Props {
  session: {
    eventId: string;
    stageId: string;
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
  const [passages, setPassages] = useState<{ checkpointId: string; action: 'recorded' | 'ignored'; timestamp: string }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [finished, setFinished] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // iOS wiggle mode pro výkaz
  const [wiggleMode, setWiggleMode] = useState(false);
  const [localNames, setLocalNames] = useState<Record<string, string>>({});
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  const startLongPress = (idx: number) => {
    longPressTimer.current = setTimeout(() => {
      setWiggleMode(true);
      setRenameIdx(null);
    }, 500);
    void idx; // used indirectly
  };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handleWiggleTap = (idx: number, cp: typeof checkpoints[0] | undefined) => {
    const currentName = localNames[idx] ?? (cp?.code || cp?.name || '?');
    setRenameIdx(idx);
    setRenameVal(currentName);
  };

  const handleRenameConfirm = () => {
    if (renameIdx !== null) setLocalNames(prev => ({ ...prev, [renameIdx]: renameVal }));
    setRenameIdx(null);
  };

  const handleRemovePassage = (idx: number) => {
    const recIndices = passages.reduce<number[]>((acc, p, i) => { if (p.action === 'recorded') acc.push(i); return acc; }, []);
    const realIdx = recIndices[idx];
    if (realIdx !== undefined) setPassages(prev => prev.filter((_, i) => i !== realIdx));
    setLocalNames(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const handleDragStart = (idx: number) => { dragSrcIdx.current = idx; };
  const handleDrop = (targetIdx: number) => {
    const src = dragSrcIdx.current;
    if (src === null || src === targetIdx) return;
    setPassages(prev => {
      const recorded = prev.filter(p => p.action === 'recorded');
      const others = prev.filter(p => p.action !== 'recorded');
      const [moved] = recorded.splice(src, 1);
      recorded.splice(targetIdx, 0, moved);
      return [...recorded, ...others];
    });
    dragSrcIdx.current = null;
  };

  useEffect(() => {
    const pending = loadPendingPassages();
    if (pending.length > 0) {
      setSyncing(true);
      Promise.all(
        pending.map(p => recordPassage(p.competitorId, p.checkpointId, p.stageId || '', p.action, p.competitorCode, p.timestamp))
      ).then(() => { clearPendingPassages(); setSyncing(false); }).catch(() => setSyncing(false));
    }
  }, []);

  const openDialog = useCallback((cp: Checkpoint) => {
    playBeep(880, 300);
    vibrate([200, 100, 200]);
    setDialog({ checkpoint: cp, countdown: 15 });
  }, []);

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
      await recordPassage(session.competitorId, cp.id, session.stageId, action, session.competitorCode, timestamp);
    } catch {
      savePendingPassage({ competitorId: session.competitorId, checkpointId: cp.id, stageId: session.stageId, action, competitorCode: session.competitorCode, timestamp });
    }
  }, [session]);

  // Bug 3 fix: reset cooldown when competitor exits geofence → enables second pass
  const handleExitGeofence = useCallback((checkpointId: string) => {
    setCooldowns(prev => { const n = { ...prev }; delete n[checkpointId]; return n; });
  }, []);



  useGeofence(position, checkpoints, cooldowns, openDialog, handleExitGeofence);

  const recorded = passages.filter(p => p.action === 'recorded');
  const totalPassages = recorded.length;

  // Poslední zaznamenaný checkpoint pro velké písmeno
  const handleFinish = () => {
    if (window.confirm('Chcete předat výkaz?')) {
      clearSession();
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏁</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 4 }}>Výkaz předán</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>{session.competitorName} #{session.competitorNumber}</p>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {recorded.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center' }}>Bez zaznamenaných průjezdů</p>
          ) : recorded.map((p, i) => {
            const cp = checkpoints.find(c => c.id === p.checkpointId);
            const code = cp?.code || cp?.name || '?';
            const timeStr = new Date(p.timestamp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#16213e', border: `1px solid ${cp?.type === 'PK' ? 'rgba(124,58,237,0.4)' : '#1a1a2e'}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {code.split('').map((ch, ci) => (
                    <div key={ci} style={{ width: 32, height: 32, border: `1.5px solid ${cp?.type === 'PK' ? '#a78bfa' : '#4ecca3'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: 'white' }}>{ch}</div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{cp?.name}</div>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>{timeStr}</div>
                {cp?.type === 'PK' && <div style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700 }}>PK</div>}
              </div>
            );
          })}
        </div>
        <button onClick={() => { window.location.href = '/simple'; }} style={{ background: '#4ecca3', color: '#0a0a0f', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
          Nová jízda
        </button>
      </div>
    );
  }

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
      </div>

      {/* Jízdní výkaz — iOS wiggle mode */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1a1a2e', padding: '8px 16px', background: 'rgba(10,10,15,0.96)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Jízdní výkaz</div>
          {wiggleMode
            ? <button onClick={() => { setWiggleMode(false); setRenameIdx(null); }} style={{ background: 'none', border: 'none', color: '#4ecca3', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Hotovo</button>
            : recorded.length > 0 && <div style={{ fontSize: 10, color: '#374151' }}>Podrž pro úpravu</div>
          }
        </div>

        {/* Rename dialog */}
        {renameIdx !== null && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              autoFocus
              value={renameVal}
              onChange={e => setRenameVal(e.target.value.toUpperCase())}
              style={{ flex: 1, background: '#16213e', border: '1px solid #4ecca3', borderRadius: 6, padding: '6px 10px', color: 'white', fontFamily: 'monospace', fontWeight: 700, fontSize: 16, letterSpacing: '0.1em' }}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenameIdx(null); }}
            />
            <button onClick={handleRenameConfirm} style={{ background: '#4ecca3', color: '#0a0a0f', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, cursor: 'pointer' }}>OK</button>
            <button onClick={() => setRenameIdx(null)} style={{ background: 'transparent', color: '#6b7280', border: '1px solid #1a1a2e', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {recorded.map((p, idx) => {
            const cp = checkpoints.find(c => c.id === p.checkpointId);
            const code = localNames[idx] ?? (cp?.code || cp?.name || '?');
            return (
              <div
                key={idx}
                className={wiggleMode ? 'wiggle' : ''}
                draggable={wiggleMode}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                onMouseDown={() => startLongPress(idx)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(idx)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onClick={() => wiggleMode && handleWiggleTap(idx, cp)}
                style={{ position: 'relative', display: 'flex', gap: 3, cursor: wiggleMode ? 'grab' : 'default', animationDelay: `${idx * 0.04}s` }}
              >
                {/* X badge */}
                {wiggleMode && (
                  <button
                    onClick={e => { e.stopPropagation(); handleRemovePassage(idx); }}
                    style={{ position: 'absolute', top: -7, left: -7, zIndex: 10, width: 18, height: 18, borderRadius: '50%', background: '#dc2626', border: '1.5px solid #fff', color: 'white', fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  >✕</button>
                )}
                {code.split('').map((char, ci) => (
                  <div key={ci} style={{
                    width: 52, height: 58, flexShrink: 0,
                    border: `2px solid ${cp?.type === 'PK' ? '#a78bfa' : '#4ecca3'}`,
                    borderRadius: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'monospace', fontWeight: 800, fontSize: 24, color: 'white',
                  }}>{char}</div>
                ))}
              </div>
            );
          })}
          {recorded.length === 0 && (
            <div style={{ fontSize: 12, color: '#374151', padding: '4px 0' }}>Zatím žádné průjezdy</div>
          )}
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
      {/* Cíl button */}
      <div style={{ flexShrink: 0, padding: '10px 16px', background: 'rgba(10,10,15,0.96)', borderTop: '1px solid #1a1a2e', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <button
          onClick={handleFinish}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 800, fontSize: 16, cursor: 'pointer', letterSpacing: '0.05em' }}
        >
          🏁 CÍL
        </button>
      </div>
    </div>
  );
}
