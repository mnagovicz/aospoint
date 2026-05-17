import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Pencil, Trash2 } from 'lucide-react';
import {
  type Event, type Stage, type Checkpoint,
  listCheckpoints, createCheckpoint, updateCheckpoint, deleteCheckpoint, updateStage,
} from '../../api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const cpIcon = new L.DivIcon({
  html: `<div style="width:24px;height:24px;background:#7c3aed;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:700;box-shadow:0 0 10px rgba(124,58,237,0.5);">•</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12], className: '',
});

const cpNewIcon = new L.DivIcon({
  html: `<div style="width:24px;height:24px;background:#f59e0b;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 10px rgba(245,158,11,0.5);">+</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12], className: '',
});

const STATUS_CONFIG = {
  draft:    { label: 'Příprava',  bg: 'var(--bg-tertiary)',           color: 'var(--text-muted)' },
  active:   { label: '● Aktivní', bg: 'var(--success-glow)',          color: 'var(--success)' },
  finished: { label: 'Dokončena', bg: 'rgba(124,58,237,0.15)',        color: 'var(--accent-bright)' },
};

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap(); mapRef.current = map; return null;
}
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) }); return null;
}

interface Props {
  event: Event;
  stage: Stage;
  onBack: () => void;
  onStageUpdated: (stage: Stage) => void;
}

export default function StageDetail({ event, stage: initialStage, onBack, onStageUpdated }: Props) {
  const [stage, setStage] = useState(initialStage);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const [cpForm, setCpForm] = useState<{ lat: number; lng: number; name: string; code: string; type: 'SPK' | 'PK'; radius: number } | null>(null);
  const [cpSaving, setCpSaving] = useState(false);

  const [editCp, setEditCp] = useState<{ id: string; name: string; code: string; radius: number } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteCpId, setDeleteCpId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [statusChanging, setStatusChanging] = useState(false);
  const [statusError, setStatusError] = useState('');

  const loadCheckpoints = useCallback(async () => {
    const cps = await listCheckpoints(event.id, stage.id);
    setCheckpoints(cps);
  }, [event.id, stage.id]);

  useEffect(() => { loadCheckpoints(); }, [loadCheckpoints]);

  const handleStatusChange = async (newStatus: Stage['status']) => {
    setStatusChanging(true);
    setStatusError('');
    try {
      const result = await updateStage(event.id, stage.id, { status: newStatus });
      if (result?.error) { setStatusError(result.error); return; }
      const updated = { ...stage, status: newStatus };
      setStage(updated);
      onStageUpdated(updated);
    } catch {
      setStatusError('Nepodařilo se změnit stav.');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setCpForm({ lat, lng, name: '', code: '', type: 'SPK', radius: 50 });
  };

  const handleCheckpointClick = (cp: Checkpoint) => {
    setSelectedCheckpointId(cp.id);
    if (mapRef.current) {
      mapRef.current.flyTo([cp.lat, cp.lng], 15, { duration: 0.8 });
      setTimeout(() => { markerRefs.current[cp.id]?.openPopup(); }, 850);
    }
  };

  const handleSaveCheckpoint = async () => {
    if (!cpForm || !cpForm.name) return;
    setCpSaving(true);
    try {
      await createCheckpoint(event.id, stage.id, {
        name: cpForm.name, code: cpForm.code, type: cpForm.type,
        lat: cpForm.lat, lng: cpForm.lng, radius: cpForm.radius, order: checkpoints.length,
      });
      setCpForm(null);
      await loadCheckpoints();
    } finally { setCpSaving(false); }
  };

  const handleEditCheckpoint = async () => {
    if (!editCp) return;
    setEditSaving(true);
    try {
      await updateCheckpoint(event.id, stage.id, editCp.id, { name: editCp.name, code: editCp.code, radius: editCp.radius });
      setEditCp(null);
      await loadCheckpoints();
    } finally { setEditSaving(false); }
  };

  const handleDeleteCheckpoint = async () => {
    if (!deleteCpId) return;
    setDeleteSaving(true);
    try {
      await deleteCheckpoint(event.id, stage.id, deleteCpId);
      setDeleteCpId(null); setDeleteConfirmName('');
      await loadCheckpoints();
    } finally { setDeleteSaving(false); }
  };

  const statusConfig = STATUS_CONFIG[stage.status] || STATUS_CONFIG.draft;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, padding: 0 }}>
          ← Zpět na soutěž
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {event.name} · Etapa {stage.order}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{stage.name}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ background: statusConfig.bg, color: statusConfig.color, fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '4px 10px' }}>
              {statusConfig.label}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {stage.status === 'draft' && (
                <button onClick={() => handleStatusChange('active')} disabled={statusChanging} className="btn-primary" style={{ fontSize: 12, padding: '6px 12px', minHeight: 30 }}>
                  ▶ Aktivovat
                </button>
              )}
              {stage.status === 'active' && (
                <button onClick={() => handleStatusChange('finished')} disabled={statusChanging} style={{ fontSize: 12, padding: '6px 12px', minHeight: 30, background: '#7c3aed', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                  ■ Ukončit
                </button>
              )}
              {stage.status === 'finished' && (
                <button onClick={() => handleStatusChange('draft')} disabled={statusChanging} className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px', minHeight: 30 }}>
                  ↺ Vrátit do přípravy
                </button>
              )}
            </div>
            {statusError && <div style={{ color: '#f87171', fontSize: 11 }}>{statusError}</div>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
          Klikněte na mapu pro přidání kontrolního bodu
        </p>

        {/* Mapa */}
        <div style={{ height: 500, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }}>
          <MapContainer center={[49.8, 15.5]} zoom={8} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              url={`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`}
              minZoom={0} maxZoom={20}
              attribution='© <a href="https://www.seznam.cz" target="_blank">Seznam.cz a.s.</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
            />
            <MapRefCapture mapRef={mapRef} />
            <MapClickHandler onMapClick={handleMapClick} />
            {checkpoints.map((cp) => (
              <div key={cp.id}>
                <Marker position={[cp.lat, cp.lng]} icon={cpIcon} ref={(ref) => { markerRefs.current[cp.id] = ref; }}>
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: 60, color: '#111' }}>
                      {cp.code && <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 22, letterSpacing: '0.05em', color: '#111' }}>{cp.code}</div>}
                      <div style={{ fontSize: 12, color: '#555', marginTop: cp.code ? 2 : 0 }}>{cp.name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>r = {cp.radius} m</div>
                    </div>
                  </Popup>
                </Marker>
                <Circle center={[cp.lat, cp.lng]} radius={cp.radius} pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.15, weight: 2 }} />
              </div>
            ))}
            {cpForm && <Marker position={[cpForm.lat, cpForm.lng]} icon={cpNewIcon} />}
          </MapContainer>
        </div>

        {/* Nový checkpoint form */}
        {cpForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: 14, color: 'var(--text-secondary)' }}>
              Nový checkpoint — {cpForm.lat.toFixed(5)}, {cpForm.lng.toFixed(5)}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" value={cpForm.code} onChange={e => setCpForm({ ...cpForm, code: e.target.value.toUpperCase() })} placeholder="Kód (A, B3...)" className="input-field" style={{ flex: '0 0 90px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }} maxLength={4} autoFocus />
                <input type="text" value={cpForm.name} onChange={e => setCpForm({ ...cpForm, name: e.target.value })} placeholder="Název místa" className="input-field" style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['SPK', 'PK'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setCpForm({ ...cpForm, type: t })} style={{ flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: cpForm.type === t ? (t === 'PK' ? '#7c3aed' : '#0f3460') : 'transparent', border: `2px solid ${cpForm.type === t ? (t === 'PK' ? '#7c3aed' : 'var(--accent-bright)') : 'var(--border)'}`, color: cpForm.type === t ? 'white' : 'var(--text-muted)' }}>
                    {t === 'SPK' ? '🟢 SPK' : '🟣 PK'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Radius (m)</label>
                <input type="number" value={cpForm.radius} onChange={e => setCpForm({ ...cpForm, radius: parseInt(e.target.value) || 50 })} className="input-field" style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSaveCheckpoint} disabled={cpSaving || !cpForm.name} className="btn-primary" style={{ minHeight: 44, flex: 1, fontSize: 14, padding: '12px' }}>
                  {cpSaving ? 'Ukládám...' : '✓ Uložit'}
                </button>
                <button onClick={() => setCpForm(null)} className="btn-secondary" style={{ minHeight: 44, padding: '12px 20px', flex: '0 0 auto' }}>
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete modal */}
        {deleteCpId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Smazat checkpoint?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                Opravdu smazat <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirmName}</strong>? Tuto akci nelze vrátit.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setDeleteCpId(null); setDeleteConfirmName(''); }} className="btn-secondary" style={{ flex: 1, minHeight: 40 }} disabled={deleteSaving}>Zrušit</button>
                <button onClick={handleDeleteCheckpoint} disabled={deleteSaving} style={{ flex: 1, minHeight: 40, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  {deleteSaving ? 'Mažu...' : 'Smazat'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Seznam checkpointů */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checkpoints.map((cp, i) => (
            <div key={cp.id}>
              <div
                onClick={() => handleCheckpointClick(cp)}
                style={{ background: selectedCheckpointId === cp.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-secondary)', border: '1px solid var(--border)', borderLeft: selectedCheckpointId === cp.id ? '3px solid #7c3aed' : '1px solid var(--border)', borderRadius: editCp?.id === cp.id ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <div style={{ width: 34, height: 34, background: 'var(--accent-glow)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent-bright)', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {cp.code && <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 22, color: 'white', letterSpacing: '0.05em' }}>{cp.code}</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: cp.type === 'PK' ? 'rgba(124,58,237,0.2)' : 'rgba(78,204,163,0.15)', color: cp.type === 'PK' ? '#a78bfa' : 'var(--accent-bright)', border: `1px solid ${cp.type === 'PK' ? 'rgba(124,58,237,0.4)' : 'rgba(78,204,163,0.3)'}` }}>{cp.type || 'SPK'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{cp.name} · r={cp.radius}m</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); setEditCp(editCp?.id === cp.id ? null : { id: cp.id, name: cp.name, code: cp.code || '', radius: cp.radius }); }} style={{ background: editCp?.id === cp.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteCpId(cp.id); setDeleteConfirmName(cp.name); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editCp?.id === cp.id && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="text" value={editCp.code} onChange={e => setEditCp({ ...editCp, code: e.target.value.toUpperCase() })} placeholder="Kód" className="input-field" style={{ flex: '0 0 90px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', fontSize: 16 }} maxLength={4} autoFocus />
                      <input type="text" value={editCp.name} onChange={e => setEditCp({ ...editCp, name: e.target.value })} placeholder="Název místa" className="input-field" style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Radius (m)</label>
                      <input type="number" value={editCp.radius} onChange={e => setEditCp({ ...editCp, radius: parseInt(e.target.value) || 50 })} className="input-field" style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleEditCheckpoint} disabled={editSaving || !editCp.name} className="btn-primary" style={{ flex: 1, minHeight: 40, fontSize: 14, padding: '10px' }}>{editSaving ? 'Ukládám...' : '✓ Uložit změny'}</button>
                      <button onClick={() => setEditCp(null)} className="btn-secondary" style={{ minHeight: 40, padding: '10px 16px', flex: '0 0 auto' }}>Zrušit</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {checkpoints.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>Žádné checkpointy — klikněte na mapu</p>
          )}
        </div>
      </div>
    </div>
  );
}
