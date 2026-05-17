import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, CheckCircle, XCircle, Radio, WifiOff, Satellite, Map } from 'lucide-react';
import { type Checkpoint, recordPassage, deletePassage } from '../../api';
import { playBeep, vibrate } from '../../utils/audio';
import { useGPS } from '../../hooks/useGPS';
import { useGeofence } from '../../hooks/useGeofence';
import { savePendingPassage, loadPendingPassages, clearPendingPassages, clearSession } from '../../utils/storage';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const playerIcon = new L.DivIcon({
  html: `<div style="
    width: 20px; height: 20px;
    background: #8b5cf6;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(124,58,237,0.3), 0 0 16px rgba(124,58,237,0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: '',
});


function MapFollow({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface Props {
  session: {
    eventId: string;
    competitorId: string;
    competitorCode: string;
    competitorName: string;
    competitorNumber: string;
  };
  checkpoints: Checkpoint[];
  onFinish?: () => void;
}

interface CheckpointDialogState {
  checkpoint: Checkpoint;
  countdown: number;
}

export default function RacingScreen({ session, checkpoints }: Props) {
  const { position, error: gpsError } = useGPS();
  // cooldowns[checkpointId] = timestamp when cooldown started (120s window)
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [dialog, setDialog] = useState<CheckpointDialogState | null>(null);
  const [passages, setPassages] = useState<{ id?: string; checkpointId: string; action: string; timestamp: string }[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [mapType, setMapType] = useState<'basic' | 'aerial'>('basic');
  const [followPosition, setFollowPosition] = useState(false);
  const [finished, setFinished] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync pending passages on mount
  useEffect(() => {
    const pending = loadPendingPassages();
    if (pending.length > 0) {
      setSyncing(true);
      Promise.all(
        pending.map(p => recordPassage(p.competitorId, p.checkpointId, p.action, p.competitorCode, p.timestamp))
      ).then(() => {
        clearPendingPassages();
        setSyncing(false);
      }).catch(() => setSyncing(false));
    }
  }, []);

  const openDialog = useCallback((cp: Checkpoint) => {
    playBeep(880, 300);
    vibrate([200, 100, 200]);
    setDialog({ checkpoint: cp, countdown: 15 });
  }, []);

  useGeofence(position, checkpoints, cooldowns, openDialog);

  // Countdown
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
    // Set cooldown — checkpoint re-enables after 120 s
    setCooldowns(prev => ({ ...prev, [cp.id]: Date.now() }));
    const timestamp = new Date().toISOString();
    try {
      const result = await recordPassage(session.competitorId, cp.id, action, session.competitorCode, timestamp);
      setPassages(prev => [...prev, { id: result.id, checkpointId: cp.id, action, timestamp }]);
    } catch {
      setPassages(prev => [...prev, { checkpointId: cp.id, action, timestamp }]);
      savePendingPassage({
        competitorId: session.competitorId,
        checkpointId: cp.id,
        action,
        competitorCode: session.competitorCode,
        timestamp,
      });
    }
  }, [session]);

  const handleDeletePassage = useCallback(async (passageIdx: number) => {
    const recorded = passages.filter(p => p.action === 'recorded');
    const p = recorded[passageIdx];
    if (!p?.id) return;
    // Zkontroluj zda je za timto prujedem nejaka PK
    const cp = checkpoints.find(c => c.id === p.checkpointId);
    if (cp?.type === 'PK') return; // PK nelze smazat
    // Zkontroluj jestli za nim existuje PK v passagich
    const afterPassages = recorded.slice(passageIdx + 1);
    const hasLaterPK = afterPassages.some(ap => {
      const acp = checkpoints.find(c => c.id === ap.checkpointId);
      return acp?.type === 'PK';
    });
    if (hasLaterPK) { alert('SPK před zapsanou PK nelze smazat.'); return; }
    try {
      await deletePassage(p.id, session.competitorCode);
      setPassages(prev => prev.filter(pp => pp.id !== p.id));
    } catch {
      alert('Nepodařilo se smazat průjezd.');
    }
  }, [passages, checkpoints, session]);

  const defaultCenter: [number, number] = position
    ? [position.lat, position.lng]
    : [49.2, 17.7];

  const totalPassages = passages.filter(p => p.action === 'recorded').length;

  const handleFinish = () => {
    if (window.confirm('Chcete předat výkaz?')) {
      clearSession();
      setFinished(true);
    }
  };

  if (finished) {
    const recorded = passages.filter(p => p.action === 'recorded');
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏁</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 4 }}>Výkaz předán</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>{session.competitorName} #{session.competitorNumber}</p>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {recorded.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Bez zaznamenaných průjezdů</p>
          ) : recorded.map((p, i) => {
            const cp = checkpoints.find(c => c.id === p.checkpointId);
            const code = cp?.code || cp?.name || '?';
            const timeStr = new Date(p.timestamp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', border: `1px solid ${cp?.type === 'PK' ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {code.split('').map((ch, ci) => (
                    <div key={ci} style={{ width: 32, height: 32, border: `1.5px solid ${cp?.type === 'PK' ? '#a78bfa' : 'var(--accent-bright)'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: 'white' }}>{ch}</div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cp?.name}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeStr}</div>
                {cp?.type === 'PK' && <div style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700 }}>PK</div>}
              </div>
            );
          })}
        </div>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{ background: 'var(--accent-bright)', color: '#0a0a0f', fontWeight: 700, fontSize: 15, padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer' }}
        >
          Nová jízda
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

      {/* Top panel: stavové info + jízdní výkaz — oba přes celou šířku */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)', background: 'rgba(10,10,15,0.96)', zIndex: 50 }}>

        {/* Stavové info — celá šířka */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'white' }}>{session.competitorName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{ color: 'var(--accent-bright)', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>#{session.competitorNumber}</span>
              <div style={{ fontSize: 11, color: gpsError ? 'var(--danger)' : position ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                {gpsError ? <><WifiOff size={10} /> GPS chyba</> : position ? <><Navigation size={10} /> ±{Math.round(position.accuracy)}m</> : <><Radio size={10} /> GPS...</>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="badge-success" style={{ fontSize: 10, padding: '2px 8px' }}>
              <span className="live-dot" /> LIVE
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: 'var(--accent-bright)' }}>{totalPassages}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>průjezdů</div>
            </div>
          </div>
        </div>

        {/* Jízdní výkaz — celá šířka */}
        <div style={{ padding: '8px 16px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Jízdní výkaz</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' }}>
            {(() => {
              const recorded = passages.filter(p => p.action === 'recorded');
              return (
                <>
                  {/* Projeté checkpointy */}
                  {recorded.map((p, rowIdx) => {
                    const cp = checkpoints.find(c => c.id === p.checkpointId);
                    const name = cp?.code || cp?.name || '';
                    const chars = name.split('');
                    const isPK = cp?.type === 'PK';
                    const hasLaterPK = recorded.slice(rowIdx + 1).some(ap => checkpoints.find(c => c.id === ap.checkpointId)?.type === 'PK');
                    const canDelete = !isPK && !hasLaterPK;
                    return (
                      <div key={rowIdx} style={{ display: 'flex', gap: 3, position: 'relative', cursor: canDelete ? 'pointer' : 'default' }}
                        onClick={() => canDelete && window.confirm(`Smazat průjezd ${name}?`) && handleDeletePassage(rowIdx)}
                      >
                        {chars.map((char, ci) => (
                          <div key={ci} style={{
                            width: 34, height: 34, flexShrink: 0,
                            border: `1.5px solid ${isPK ? '#a78bfa' : hasLaterPK ? '#6b7280' : 'var(--accent-bright)'}`,
                            borderRadius: 5,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'monospace', fontWeight: 800, fontSize: 17, color: 'white',
                          }}>{char}</div>
                        ))}
                        {isPK && <div style={{ position: 'absolute', right: 0, top: -11, fontSize: 8, color: '#a78bfa', fontWeight: 700 }}>PK</div>}
                      </div>
                    );
                  })}
                  {/* Prázdné sloty pro zbývající checkpointy */}
                  {Array.from({ length: Math.max(0, checkpoints.length - recorded.length) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: 4 }).map((_, ci) => (
                        <div key={ci} style={{
                          width: 34, height: 34,
                          border: '1.5px solid var(--border)',
                          borderRadius: 5,
                          opacity: 0.25,
                        }} />
                      ))}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          key={mapType}
          url={`https://api.mapy.com/v1/maptiles/${mapType}/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`}
          minZoom={0}
          maxZoom={20}
          attribution='© <a href="https://www.seznam.cz" target="_blank">Seznam.cz a.s.</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        />

        {/* Checkpoints are intentionally hidden from competitor — geofencing runs in background */}

        {/* Player position */}
        {position && (
          <>
            <Marker position={[position.lat, position.lng]} icon={playerIcon} />
            <Circle
              center={[position.lat, position.lng]}
              radius={position.accuracy}
              pathOptions={{
                color: '#8b5cf6',
                fillColor: '#8b5cf6',
                fillOpacity: 0.08,
                weight: 1,
              }}
            />
            {followPosition && <MapFollow lat={position.lat} lng={position.lng} />}
          </>
        )}
      </MapContainer>

      {/* Map controls — inside relative wrapper, above map */}
      <div style={{ position: 'absolute', bottom: 24, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Follow position toggle */}
        <button
          onClick={() => setFollowPosition(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: followPosition ? 'rgba(124,58,237,0.85)' : 'rgba(10,10,15,0.92)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${followPosition ? '#7c3aed' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '10px 16px',
            color: followPosition ? 'white' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Navigation size={16} />
          {followPosition ? 'Sleduju' : 'Sledovat'}
        </button>
        <button
          onClick={() => setMapType(prev => prev === 'basic' ? 'aerial' : 'basic')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(10,10,15,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 16px',
            color: 'var(--accent-bright)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {mapType === 'basic' ? <><Satellite size={16} /> Letecká</> : <><Map size={16} /> Mapa</>}
        </button>
      </div>
      </div> {/* end map wrapper */}

      {/* Cíl button */}
      <div style={{ flexShrink: 0, padding: '10px 16px', background: 'rgba(10,10,15,0.96)', borderTop: '1px solid var(--border)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <button
          onClick={handleFinish}
          style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 800, fontSize: 16, cursor: 'pointer', letterSpacing: '0.05em' }}
        >
          🏁 CÍL
        </button>
      </div>

      {/* Syncing indicator */}
      {syncing && (
        <div
          className="absolute bottom-4 left-4 right-4 z-50"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 13,
            textAlign: 'center',
            color: 'var(--text-secondary)',
            backdropFilter: 'blur(8px)',
          }}
        >
          🔄 Synchronizuji offline záznamy...
        </div>
      )}

      {/* Checkpoint Dialog */}
      {dialog && (
        <div
          className="absolute inset-0 z-[9999] flex flex-col items-center justify-center p-6"
          style={{
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
            {/* Icon */}
            <div
              style={{
                width: 80,
                height: 80,
                background: 'var(--accent-glow)',
                border: '1px solid rgba(124,58,237,0.4)',
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 36,
              }}
            >
              <MapPin size={36} color="#8b5cf6" />
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              KONTROLNÍ BOD
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'white',
                marginBottom: 20,
              }}
            >
              {dialog.checkpoint.name}
            </div>

            {/* Countdown */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '8px 20px',
                marginBottom: 28,
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Auto-ignorovat za</span>
              <span
                className="tabular-nums"
                style={{
                  color: dialog.countdown <= 5 ? 'var(--danger)' : 'var(--warning)',
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {dialog.countdown}s
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => handleAction(dialog.checkpoint, 'recorded')}
                className="btn-success"
                style={{ minHeight: 64, fontSize: 17, letterSpacing: '0.02em' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <CheckCircle size={22} />
                  ZAZNAMENAT
                </span>
              </button>
              <button
                onClick={() => handleAction(dialog.checkpoint, 'ignored')}
                className="btn-secondary"
                style={{ minHeight: 52 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <XCircle size={18} />
                  IGNOROVAT
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
