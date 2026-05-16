import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  type Event, type Checkpoint, type Competitor,
  listCheckpoints, createCheckpoint,
  listCompetitors, createCompetitor,
  getResults,
} from '../../api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Tab = 'checkpoints' | 'competitors' | 'results';

interface Props {
  event: Event;
  onBack: () => void;
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

  // Checkpoint form
  const [cpForm, setCpForm] = useState<{ lat: number; lng: number; name: string; radius: number } | null>(null);
  const [cpSaving, setCpSaving] = useState(false);

  // Competitor form
  const [compName, setCompName] = useState('');
  const [compNumber, setCompNumber] = useState('');
  const [compVehicle, setCompVehicle] = useState('');
  const [compSaving, setCompSaving] = useState(false);

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

  const handleMapClick = (lat: number, lng: number) => {
    setCpForm({ lat, lng, name: '', radius: 50 });
  };

  const handleSaveCheckpoint = async () => {
    if (!cpForm || !cpForm.name) return;
    setCpSaving(true);
    try {
      await createCheckpoint(event.id, {
        name: cpForm.name,
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

  const handleAddCompetitor = async () => {
    if (!compName || !compNumber) return;
    setCompSaving(true);
    try {
      await createCompetitor(event.id, { name: compName, number: compNumber, vehicle: compVehicle });
      setCompName(''); setCompNumber(''); setCompVehicle('');
      await loadData();
    } finally {
      setCompSaving(false);
    }
  };

  const exportCSV = () => {
    if (!results) return;
    const rows = [['Závodník', 'Číslo', 'Vozidlo', 'Zaznamenáno', 'Celkem CP', 'Časy'].join(',')];
    for (const r of results.results) {
      const recorded = r.passages.filter((p: any) => p.action === 'recorded');
      const times = recorded.map((p: any) => new Date(p.timestamp).toLocaleTimeString('cs-CZ')).join(' | ');
      rows.push([r.competitor.name, r.competitor.number, r.competitor.vehicle || '', r.recordedCount, r.totalCheckpoints, `"${times}"`].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aospoint-${event.name}-results.csv`; a.click();
  };

  const inputStyle = { background: '#16213e', border: '2px solid #0f3460', color: '#fff' };

  return (
    <div className="min-h-screen" style={{ background: '#1a1a2e' }}>
      {/* Header */}
      <div className="p-4" style={{ background: '#16213e', borderBottom: '1px solid #0f3460' }}>
        <button onClick={onBack} className="text-gray-400 mb-2 text-sm">← Zpět</button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{event.name}</h2>
            <p className="text-gray-400 text-sm">{event.date}</p>
          </div>
          {event.accessCode && (
            <div className="text-right">
              <div className="text-xs text-gray-500">Kód pro závodníky</div>
              <div className="text-xl font-mono font-bold" style={{ color: '#4ecca3' }}>{event.accessCode}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: '#0f3460' }}>
        {(['checkpoints', 'competitors', 'results'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3 text-sm font-medium"
            style={{
              color: tab === t ? '#4ecca3' : '#6b7280',
              borderBottom: tab === t ? '2px solid #4ecca3' : '2px solid transparent',
            }}
          >
            {t === 'checkpoints' ? '📍 Checkpointy' : t === 'competitors' ? '🚗 Závodníci' : '🏆 Výsledky'}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* CHECKPOINTS TAB */}
        {tab === 'checkpoints' && (
          <div>
            <p className="text-gray-400 text-sm mb-3">Klikněte na mapu pro přidání kontrolního bodu</p>
            <div style={{ height: '300px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
              <MapContainer center={[49.2, 17.7]} zoom={12} style={{ height: '100%' }}>
                <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapClickHandler onMapClick={handleMapClick} />
                {checkpoints.map((cp) => (
                  <div key={cp.id}>
                    <Marker position={[cp.lat, cp.lng]}>
                    </Marker>
                    <Circle center={[cp.lat, cp.lng]} radius={cp.radius}
                      pathOptions={{ color: '#4ecca3', fillOpacity: 0.2 }} />
                  </div>
                ))}
                {cpForm && (
                  <Marker position={[cpForm.lat, cpForm.lng]} opacity={0.6} />
                )}
              </MapContainer>
            </div>

            {cpForm && (
              <div className="p-4 rounded-xl mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
                <h3 className="font-bold text-white mb-3">Nový checkpoint ({cpForm.lat.toFixed(5)}, {cpForm.lng.toFixed(5)})</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={cpForm.name}
                    onChange={e => setCpForm({ ...cpForm, name: e.target.value })}
                    placeholder="Název (např. Rozcestí pod kopcem)"
                    className="w-full px-3 py-3 rounded-lg"
                    style={inputStyle}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-400 whitespace-nowrap">Radius (m):</label>
                    <input
                      type="number"
                      value={cpForm.radius}
                      onChange={e => setCpForm({ ...cpForm, radius: parseInt(e.target.value) || 50 })}
                      className="flex-1 px-3 py-3 rounded-lg"
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCheckpoint}
                      disabled={cpSaving || !cpForm.name}
                      className="flex-1 py-3 rounded-lg font-bold"
                      style={{ background: '#4ecca3', color: '#1a1a2e' }}
                    >
                      {cpSaving ? 'Ukládám...' : '✓ Uložit'}
                    </button>
                    <button
                      onClick={() => setCpForm(null)}
                      className="px-4 py-3 rounded-lg"
                      style={{ background: '#374151', color: '#fff' }}
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {checkpoints.map((cp, i) => (
                <div key={cp.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: '#16213e' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: '#0f3460', color: '#4ecca3' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{cp.name}</div>
                    <div className="text-xs text-gray-500">{cp.lat.toFixed(5)}, {cp.lng.toFixed(5)} • r={cp.radius}m</div>
                  </div>
                </div>
              ))}
              {checkpoints.length === 0 && <p className="text-gray-500 text-center py-4">Žádné checkpointy</p>}
            </div>
          </div>
        )}

        {/* COMPETITORS TAB */}
        {tab === 'competitors' && (
          <div>
            <div className="p-4 rounded-xl mb-4" style={{ background: '#16213e', border: '1px solid #0f3460' }}>
              <h3 className="font-bold text-white mb-3">Přidat závodníka</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={compNumber} onChange={e => setCompNumber(e.target.value)}
                    placeholder="Číslo" className="w-20 px-3 py-3 rounded-lg" style={inputStyle} />
                  <input type="text" value={compName} onChange={e => setCompName(e.target.value)}
                    placeholder="Jméno závodníka" className="flex-1 px-3 py-3 rounded-lg" style={inputStyle} />
                </div>
                <input type="text" value={compVehicle} onChange={e => setCompVehicle(e.target.value)}
                  placeholder="Vozidlo (volitelné)" className="w-full px-3 py-3 rounded-lg" style={inputStyle} />
                <button
                  onClick={handleAddCompetitor}
                  disabled={compSaving || !compName || !compNumber}
                  className="w-full py-3 rounded-lg font-bold"
                  style={{ background: '#4ecca3', color: '#1a1a2e', minHeight: '52px' }}
                >
                  {compSaving ? 'Přidávám...' : '+ Přidat závodníka'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {(competitors as Competitor[]).map(comp => (
                <div key={comp.id} className="p-3 rounded-xl" style={{ background: '#16213e' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold" style={{ color: '#4ecca3' }}>#{comp.number}</span>
                      <span className="text-white ml-2">{comp.name}</span>
                      {comp.vehicle && <span className="text-gray-400 ml-2 text-sm">• {comp.vehicle}</span>}
                    </div>
                    {comp.accessCode && (
                      <div className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#0f3460', color: '#4ecca3' }}>
                        {comp.accessCode}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {competitors.length === 0 && <p className="text-gray-500 text-center py-4">Žádní závodníci</p>}
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === 'results' && (
          <div>
            {!results ? (
              <div className="text-center text-gray-400 py-8">Načítám výsledky...</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-400">{results.results?.length || 0} závodníků</div>
                  <button
                    onClick={exportCSV}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: '#0f3460', color: '#4ecca3' }}
                  >
                    📥 Export CSV
                  </button>
                </div>
                <div className="space-y-3">
                  {(results.results || []).map((r: any, idx: number) => (
                    <div key={r.competitor.id} className="p-4 rounded-xl" style={{ background: '#16213e' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                          style={{ background: idx < 3 ? ['#f59e0b', '#6b7280', '#b45309'][idx] : '#374151', color: '#fff', fontSize: '12px' }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-white">#{r.competitor.number} {r.competitor.name}</div>
                          {r.competitor.vehicle && <div className="text-xs text-gray-500">{r.competitor.vehicle}</div>}
                        </div>
                        <div className="text-right">
                          <span style={{ color: '#4ecca3' }} className="font-bold">{r.recordedCount}</span>
                          <span className="text-gray-500">/{r.totalCheckpoints}</span>
                        </div>
                      </div>
                      {r.checkpointDetails.map((cd: any) => (
                        <div key={cd.checkpoint.id} className="flex items-center gap-2 py-1 border-t text-sm"
                          style={{ borderColor: '#0f3460' }}>
                          <span>{cd.passage?.action === 'recorded' ? '✅' : cd.passage ? '❌' : '⬜'}</span>
                          <span className="text-gray-400">{cd.checkpoint.name}</span>
                          {cd.passage?.action === 'recorded' && (
                            <span className="ml-auto text-xs text-gray-500">
                              {new Date(cd.passage.timestamp).toLocaleTimeString('cs-CZ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
