import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Users, Trophy, Plus, Download, CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-react';
import {
  type Event, type Checkpoint, type Competitor,
  listCheckpoints, createCheckpoint, updateCheckpoint, deleteCheckpoint,
  listCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
  getResults,
} from '../../api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const cpIcon = new L.DivIcon({
  html: `<div style="
    width:24px;height:24px;
    background:#7c3aed;
    border:2px solid #fff;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;color:white;font-weight:700;
    box-shadow:0 0 10px rgba(124,58,237,0.5);
  ">•</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});

const cpNewIcon = new L.DivIcon({
  html: `<div style="
    width:24px;height:24px;
    background:#f59e0b;
    border:2px solid #fff;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:14px;
    box-shadow:0 0 10px rgba(245,158,11,0.5);
  ">+</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});

type Tab = 'checkpoints' | 'competitors' | 'results';

interface Props {
  event: Event;
  onBack: () => void;
}

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  mapRef.current = map;
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function EventDetail({ event, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('checkpoints');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [results, setResults] = useState<any>(null);
  const [_loading, setLoading] = useState(false);

  // Map & marker refs
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  // Selected checkpoint (for list highlight)
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);

  // Checkpoint form (new)
  const [cpForm, setCpForm] = useState<{ lat: number; lng: number; name: string; code: string; type: 'SPK' | 'PK'; radius: number } | null>(null);
  const [cpSaving, setCpSaving] = useState(false);

  // Checkpoint edit
  const [editCp, setEditCp] = useState<{ id: string; name: string; code: string; radius: number } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Checkpoint delete confirm
  const [deleteCpId, setDeleteCpId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Competitor form
  const [compDriver, setCompDriver] = useState('');
  const [compCoDriver, setCompCoDriver] = useState('');
  const [compNumber, setCompNumber] = useState('');
  const [compVehicle, setCompVehicle] = useState('');
  const [compSaving, setCompSaving] = useState(false);

  // Competitor edit
  const [editComp, setEditComp] = useState<{ id: string; driver: string; coDriver: string; number: string } | null>(null);
  const [editCompSaving, setEditCompSaving] = useState(false);

  // Competitor delete confirm
  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);
  const [deleteCompName, setDeleteCompName] = useState('');
  const [deleteCompSaving, setDeleteCompSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cps, comps] = await Promise.all([
        listCheckpoints(event.id),
        listCompetitors(event.id, true),
      ]);
      setCheckpoints(cps);
      setCompetitors(comps);
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (tab === 'results') {
      getResults(event.id).then(setResults);
    }
  }, [tab, event.id]);

  const handleCheckpointClick = (cp: Checkpoint) => {
    setSelectedCheckpointId(cp.id);
    if (mapRef.current) {
      mapRef.current.flyTo([cp.lat, cp.lng], 15, { duration: 0.8 });
      setTimeout(() => {
        markerRefs.current[cp.id]?.openPopup();
      }, 850);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setCpForm({ lat, lng, name: '', code: '', type: 'SPK', radius: 50 });
  };

  const handleEditCheckpoint = async () => {
    if (!editCp) return;
    setEditSaving(true);
    try {
      await updateCheckpoint(event.id, editCp.id, { name: editCp.name, code: editCp.code, radius: editCp.radius });
      setEditCp(null);
      await loadData();
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteCheckpoint = async () => {
    if (!deleteCpId) return;
    setDeleteSaving(true);
    try {
      await deleteCheckpoint(event.id, deleteCpId);
      setDeleteCpId(null);
      setDeleteConfirmName('');
      await loadData();
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleSaveCheckpoint = async () => {
    if (!cpForm || !cpForm.name) return;
    setCpSaving(true);
    try {
      await createCheckpoint(event.id, {
        name: cpForm.name,
        code: cpForm.code,
        type: cpForm.type,
        lat: cpForm.lat,
        lng: cpForm.lng,
        radius: cpForm.radius,
        order: checkpoints.length,
      });
      setCpForm(null);
      await loadData();
    } finally {
      setCpSaving(false);
    }
  };

  const handleEditCompetitor = async () => {
    if (!editComp) return;
    setEditCompSaving(true);
    try {
      await updateCompetitor(event.id, editComp.id, { driver: editComp.driver, coDriver: editComp.coDriver, number: editComp.number });
      setEditComp(null);
      await loadData();
    } finally {
      setEditCompSaving(false);
    }
  };

  const handleDeleteCompetitor = async () => {
    if (!deleteCompId) return;
    setDeleteCompSaving(true);
    try {
      await deleteCompetitor(event.id, deleteCompId);
      setDeleteCompId(null);
      setDeleteCompName('');
      await loadData();
    } finally {
      setDeleteCompSaving(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!compDriver || !compCoDriver || !compNumber) return;
    setCompSaving(true);
    try {
      await createCompetitor(event.id, { driver: compDriver, coDriver: compCoDriver, number: compNumber, vehicle: compVehicle });
      setCompDriver(''); setCompCoDriver(''); setCompNumber(''); setCompVehicle('');
      await loadData();
    } finally {
      setCompSaving(false);
    }
  };

  const exportCSV = () => {
    if (!results) return;
    const rows = [['Řidič', 'Spolujezdec', 'Číslo', 'Vozidlo', 'Zaznamenáno', 'Celkem CP', 'Časy'].join(',')];
    for (const r of results.results) {
      const recorded = r.passages.filter((p: any) => p.action === 'recorded');
      const times = recorded
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((p: any) => `${new Date(p.timestamp).toLocaleTimeString('cs-CZ')} (#${p.passageNumber ?? 1})`)
        .join(' | ');
      const driver = r.competitor.driver || r.competitor.name;
      const coDriver = r.competitor.coDriver || '';
      rows.push([driver, coDriver, r.competitor.number, r.competitor.vehicle || '', r.recordedCount, r.totalCheckpoints, `"${times}"`].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aospoint-${event.name}-results.csv`; a.click();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 10,
            padding: 0,
          }}
        >
          ← Zpět
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{event.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{event.date}</p>
          </div>
          {event.accessCode && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Kód závodníků
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--accent-bright)',
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: 10,
                  padding: '4px 12px',
                }}
              >
                {event.accessCode}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ maxWidth: 'none' }}>
        {([
          { key: 'checkpoints', icon: <MapPin size={14} />, label: 'Checkpointy' },
          { key: 'competitors', icon: <Users size={14} />, label: 'Závodníci' },
          { key: 'results', icon: <Trophy size={14} />, label: 'Výsledky' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-item ${tab === t.key ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>

        {/* CHECKPOINTS TAB */}
        {tab === 'checkpoints' && (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              Klikněte na mapu pro přidání kontrolního bodu
            </p>
            <div
              style={{
                height: 500,
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                marginBottom: 16,
                width: '100%',
              }}
            >
              <MapContainer center={[49.8, 15.5]} zoom={8} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                  url={`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`}
                  minZoom={0}
                  maxZoom={20}
                  attribution='© <a href="https://www.seznam.cz" target="_blank">Seznam.cz a.s.</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
                />
                <MapRefCapture mapRef={mapRef} />
                <MapClickHandler onMapClick={handleMapClick} />
                {checkpoints.map((cp) => (
                  <div key={cp.id}>
                    <Marker
                      position={[cp.lat, cp.lng]}
                      icon={cpIcon}
                      ref={(ref) => { markerRefs.current[cp.id] = ref; }}
                    >
                      <Popup>
                        <strong>{cp.name}</strong><br />r = {cp.radius} m
                      </Popup>
                    </Marker>
                    <Circle
                      center={[cp.lat, cp.lng]}
                      radius={cp.radius}
                      pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.15, weight: 2 }}
                    />
                  </div>
                ))}
                {cpForm && (
                  <Marker position={[cpForm.lat, cpForm.lng]} icon={cpNewIcon} />
                )}
              </MapContainer>
            </div>

            {cpForm && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: 14, color: 'var(--text-secondary)' }}>
                  Nový checkpoint — {cpForm.lat.toFixed(5)}, {cpForm.lng.toFixed(5)}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      value={cpForm.code}
                      onChange={e => setCpForm({ ...cpForm, code: e.target.value.toUpperCase() })}
                      placeholder="Kód (A, B3...)"
                      className="input-field"
                      style={{ flex: '0 0 90px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}
                      maxLength={4}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={cpForm.name}
                      onChange={e => setCpForm({ ...cpForm, name: e.target.value })}
                      placeholder="Název místa (např. Most)"
                      className="input-field"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['SPK', 'PK'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCpForm({ ...cpForm, type: t })}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          background: cpForm.type === t ? (t === 'PK' ? '#7c3aed' : '#0f3460') : 'transparent',
                          border: `2px solid ${cpForm.type === t ? (t === 'PK' ? '#7c3aed' : 'var(--accent-bright)') : 'var(--border)'}`,
                          color: cpForm.type === t ? 'white' : 'var(--text-muted)',
                        }}
                      >
                        {t === 'SPK' ? '🟢 SPK' : '🟣 PK'}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      Radius (m)
                    </label>
                    <input
                      type="number"
                      value={cpForm.radius}
                      onChange={e => setCpForm({ ...cpForm, radius: parseInt(e.target.value) || 50 })}
                      className="input-field"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleSaveCheckpoint}
                      disabled={cpSaving || !cpForm.name}
                      className="btn-primary"
                      style={{ minHeight: 44, flex: 1, fontSize: 14, padding: '12px' }}
                    >
                      {cpSaving ? 'Ukládám...' : '✓ Uložit'}
                    </button>
                    <button
                      onClick={() => setCpForm(null)}
                      className="btn-secondary"
                      style={{ minHeight: 44, padding: '12px 20px', width: 'auto', flex: '0 0 auto' }}
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete confirmation modal */}
            {deleteCpId && (
              <div
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 24,
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 24,
                    maxWidth: 360,
                    width: '100%',
                  }}
                >
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Smazat checkpoint?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                    Opravdu smazat checkpoint <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirmName}</strong>? Tuto akci nelze vrátit.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { setDeleteCpId(null); setDeleteConfirmName(''); }}
                      className="btn-secondary"
                      style={{ flex: 1, minHeight: 40 }}
                      disabled={deleteSaving}
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleDeleteCheckpoint}
                      disabled={deleteSaving}
                      style={{
                        flex: 1, minHeight: 40,
                        background: '#dc2626', color: '#fff',
                        border: 'none', borderRadius: 10,
                        fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      }}
                    >
                      {deleteSaving ? 'Mažu...' : 'Smazat'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checkpoints.map((cp, i) => (
                <div key={cp.id}>
                  <div
                    onClick={() => handleCheckpointClick(cp)}
                    style={{
                      background: selectedCheckpointId === cp.id ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderLeft: selectedCheckpointId === cp.id ? '3px solid #7c3aed' : '1px solid var(--border)',
                      borderRadius: editCp?.id === cp.id ? '12px 12px 0 0' : 12,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'background 0.2s, border-color 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: 34, height: 34,
                        background: 'var(--accent-glow)',
                        border: '1px solid rgba(124,58,237,0.3)',
                        borderRadius: 999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: 'var(--accent-bright)',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{cp.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: cp.type === 'PK' ? 'rgba(124,58,237,0.2)' : 'rgba(78,204,163,0.15)',
                          color: cp.type === 'PK' ? '#a78bfa' : 'var(--accent-bright)',
                          border: `1px solid ${cp.type === 'PK' ? 'rgba(124,58,237,0.4)' : 'rgba(78,204,163,0.3)'}`,
                        }}>{cp.type || 'SPK'}</span>
                        {cp.code && <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>[{cp.code}]</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {cp.lat.toFixed(5)}, {cp.lng.toFixed(5)} · r={cp.radius}m
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setEditCp(editCp?.id === cp.id ? null : { id: cp.id, name: cp.name, code: cp.code || '', radius: cp.radius })}
                        title="Editovat"
                        style={{
                          background: editCp?.id === cp.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: '6px 8px',
                          cursor: 'pointer', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setDeleteCpId(cp.id); setDeleteConfirmName(cp.name); }}
                        title="Smazat"
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: '6px 8px',
                          cursor: 'pointer', color: '#dc2626',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editCp?.id === cp.id && (
                    <div
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        padding: '12px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            value={editCp.code}
                            onChange={e => setEditCp({ ...editCp, code: e.target.value.toUpperCase() })}
                            placeholder="Kód (A, B3...)"
                            className="input-field"
                            style={{ flex: '0 0 90px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', fontSize: 16 }}
                            maxLength={4}
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editCp.name}
                            onChange={e => setEditCp({ ...editCp, name: e.target.value })}
                            placeholder="Název místa"
                            className="input-field"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            Radius (m)
                          </label>
                          <input
                            type="number"
                            value={editCp.radius}
                            onChange={e => setEditCp({ ...editCp, radius: parseInt(e.target.value) || 50 })}
                            className="input-field"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={handleEditCheckpoint}
                            disabled={editSaving || !editCp.name}
                            className="btn-primary"
                            style={{ flex: 1, minHeight: 40, fontSize: 14, padding: '10px' }}
                          >
                            {editSaving ? 'Ukládám...' : '✓ Uložit změny'}
                          </button>
                          <button
                            onClick={() => setEditCp(null)}
                            className="btn-secondary"
                            style={{ minHeight: 40, padding: '10px 16px', flex: '0 0 auto' }}
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {checkpoints.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>
                  Žádné checkpointy — klikněte na mapu
                </p>
              )}
            </div>
          </div>
        )}

        {/* COMPETITORS TAB */}
        {tab === 'competitors' && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontWeight: 700,
                  marginBottom: 14,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Přidat závodníka
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    value={compNumber}
                    onChange={e => setCompNumber(e.target.value)}
                    placeholder="Č."
                    className="input-field"
                    style={{ width: 64, flex: '0 0 auto' }}
                  />
                  <input
                    type="text"
                    value={compDriver}
                    onChange={e => setCompDriver(e.target.value)}
                    placeholder="Řidič"
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    value={compCoDriver}
                    onChange={e => setCompCoDriver(e.target.value)}
                    placeholder="Spolujezdec"
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                </div>
                <input
                  type="text"
                  value={compVehicle}
                  onChange={e => setCompVehicle(e.target.value)}
                  placeholder="Vozidlo (volitelné)"
                  className="input-field"
                />
                <button
                  onClick={handleAddCompetitor}
                  disabled={compSaving || !compDriver || !compCoDriver || !compNumber}
                  className="btn-primary"
                  style={{ minHeight: 48, fontSize: 14 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Plus size={16} />
                    {compSaving ? 'Přidávám...' : 'Přidat posádku'}
                  </span>
                </button>
              </div>
            </div>

            {/* Competitor delete confirmation modal */}
            {deleteCompId && (
              <div
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 24,
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 24,
                    maxWidth: 360,
                    width: '100%',
                  }}
                >
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Smazat posádku?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                    Opravdu smazat posádku <strong style={{ color: 'var(--text-primary)' }}>{deleteCompName}</strong>? Tuto akci nelze vrátit.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { setDeleteCompId(null); setDeleteCompName(''); }}
                      className="btn-secondary"
                      style={{ flex: 1, minHeight: 40 }}
                      disabled={deleteCompSaving}
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleDeleteCompetitor}
                      disabled={deleteCompSaving}
                      style={{
                        flex: 1, minHeight: 40,
                        background: '#dc2626', color: '#fff',
                        border: 'none', borderRadius: 10,
                        fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      }}
                    >
                      {deleteCompSaving ? 'Mažu...' : 'Smazat'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(competitors as Competitor[]).map(comp => (
                <div key={comp.id}>
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: editComp?.id === comp.id ? '12px 12px 0 0' : 12,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: 'var(--accent-bright)',
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      #{comp.number}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {comp.driver || comp.name}
                        {comp.coDriver && (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {' '}&amp;{' '}{comp.coDriver}
                          </span>
                        )}
                      </div>
                      {comp.vehicle && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>
                          {comp.vehicle}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {comp.accessCode && (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: 600,
                            background: 'var(--accent-glow)',
                            color: 'var(--accent-bright)',
                            border: '1px solid rgba(124,58,237,0.2)',
                            borderRadius: 8,
                            padding: '3px 10px',
                          }}
                        >
                          {comp.accessCode}
                        </span>
                      )}
                      <button
                        onClick={() => setEditComp(editComp?.id === comp.id ? null : { id: comp.id, driver: comp.driver || '', coDriver: comp.coDriver || '', number: String(comp.number) })}
                        title="Editovat"
                        style={{
                          background: editComp?.id === comp.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: '6px 8px',
                          cursor: 'pointer', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setDeleteCompId(comp.id); setDeleteCompName(`#${comp.number} – ${comp.driver || comp.name} / ${comp.coDriver || ''}`); }}
                        title="Smazat"
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8, padding: '6px 8px',
                          cursor: 'pointer', color: '#dc2626',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editComp?.id === comp.id && (
                    <div
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        padding: '12px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            value={editComp.number}
                            onChange={e => setEditComp({ ...editComp, number: e.target.value })}
                            placeholder="Č."
                            className="input-field"
                            style={{ width: 64, flex: '0 0 auto' }}
                          />
                          <input
                            type="text"
                            value={editComp.driver}
                            onChange={e => setEditComp({ ...editComp, driver: e.target.value })}
                            placeholder="Řidič"
                            className="input-field"
                            style={{ flex: 1 }}
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editComp.coDriver}
                            onChange={e => setEditComp({ ...editComp, coDriver: e.target.value })}
                            placeholder="Spolujezdec"
                            className="input-field"
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={handleEditCompetitor}
                            disabled={editCompSaving || !editComp.driver || !editComp.coDriver || !editComp.number}
                            className="btn-primary"
                            style={{ flex: 1, minHeight: 40, fontSize: 14, padding: '10px' }}
                          >
                            {editCompSaving ? 'Ukládám...' : '✓ Uložit změny'}
                          </button>
                          <button
                            onClick={() => setEditComp(null)}
                            className="btn-secondary"
                            style={{ minHeight: 40, padding: '10px 16px', flex: '0 0 auto' }}
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {competitors.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>
                  Žádní závodníci
                </p>
              )}
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === 'results' && (
          <div>
            {!results ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 14 }}>
                Načítám výsledky...
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {results.results?.length || 0} závodníků
                  </div>
                  <button
                    onClick={exportCSV}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '8px 14px',
                      color: 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(results.results || []).map((r: any, idx: number) => {
                    const medalColors = ['#f59e0b', '#9ca3af', '#b45309'];
                    return (
                      <div
                        key={r.competitor.id}
                        className="card"
                        style={{ padding: '16px 18px' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              background: idx < 3 ? medalColors[idx] : 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              color: idx < 3 ? '#fff' : 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>
                              <span style={{ color: 'var(--accent-bright)' }}>#{r.competitor.number}</span>{' '}
                              {r.competitor.driver
                                ? <>{r.competitor.driver} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>&amp; {r.competitor.coDriver}</span></>
                                : r.competitor.name
                              }
                            </div>
                            {r.competitor.vehicle && (
                              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>
                                {r.competitor.vehicle}
                              </div>
                            )}
                          </div>
                          <div
                            className="tabular-nums"
                            style={{ textAlign: 'right', fontWeight: 700, fontSize: 20 }}
                          >
                            <span style={{ color: 'var(--success)' }}>{r.recordedCount}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/{r.totalCheckpoints}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {/* Flatten all passages across checkpoints, sort chronologically */}
                          {r.checkpointDetails
                            .flatMap((cd: any) =>
                              (cd.passages && cd.passages.length > 0
                                ? cd.passages
                                : [null]
                              ).map((p: any) => ({ checkpoint: cd.checkpoint, passage: p }))
                            )
                            .sort((a: any, b: any) => {
                              if (!a.passage) return 1;
                              if (!b.passage) return -1;
                              return new Date(a.passage.timestamp).getTime() - new Date(b.passage.timestamp).getTime();
                            })
                            .map((entry: any, i: number) => {
                              const { checkpoint, passage } = entry;
                              return (
                                <div
                                  key={`${checkpoint.id}-${i}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 0',
                                    borderTop: '1px solid var(--border)',
                                    fontSize: 13,
                                  }}
                                >
                                  {passage?.action === 'recorded' ? (
                                    <CheckCircle size={15} color="var(--success)" />
                                  ) : passage ? (
                                    <XCircle size={15} color="var(--danger)" />
                                  ) : (
                                    <div
                                      style={{
                                        width: 15,
                                        height: 15,
                                        borderRadius: 999,
                                        border: '1.5px solid var(--text-muted)',
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                    {checkpoint.name}
                                    {passage && (
                                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                                        — Průjezd {passage.passageNumber ?? 1}
                                      </span>
                                    )}
                                  </span>
                                  {passage?.action === 'recorded' && (
                                    <span
                                      className="tabular-nums"
                                      style={{ color: 'var(--text-muted)', fontSize: 12 }}
                                    >
                                      {new Date(passage.timestamp).toLocaleTimeString('cs-CZ')}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
