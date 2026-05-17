import { useState, useEffect, useCallback } from 'react';
import { Users, Trophy, Plus, Download, Pencil, Trash2, Layers } from 'lucide-react';
import {
  type Event, type Stage, type Competitor,
  listStages, createStage, updateStage, deleteStage,
  listCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
  getResults,
} from '../../api';
import StageDetail from './StageDetail';

type Tab = 'stages' | 'competitors' | 'results';

const STAGE_STATUS_CONFIG = {
  draft:    { label: 'Příprava',  bg: 'var(--bg-tertiary)',           color: 'var(--text-muted)' },
  active:   { label: '● Aktivní', bg: 'var(--success-glow)',          color: 'var(--success)' },
  finished: { label: 'Dokončena', bg: 'rgba(124,58,237,0.15)',        color: 'var(--accent-bright)' },
};

interface Props {
  event: Event;
  onBack: () => void;
}

export default function EventDetail({ event, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('stages');
  const [stages, setStages] = useState<Stage[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);

  // Results tab
  const [resultsStageId, setResultsStageId] = useState<string>('');
  const [results, setResults] = useState<any>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Stage form
  const [stageName, setStageName] = useState('');
  const [stageOrder, setStageOrder] = useState(1);
  const [stageSaving, setStageSaving] = useState(false);
  const [editStage, setEditStage] = useState<{ id: string; name: string; order: number } | null>(null);
  const [editStageSaving, setEditStageSaving] = useState(false);
  const [deleteStageConfirm, setDeleteStageConfirm] = useState<Stage | null>(null);
  const [deleteStageSaving, setDeleteStageSaving] = useState(false);
  const [stageStatusChanging, setStageStatusChanging] = useState<string | null>(null);
  const [stageStatusError, setStageStatusError] = useState('');

  // Competitor form
  const [compDriver, setCompDriver] = useState('');
  const [compCoDriver, setCompCoDriver] = useState('');
  const [compNumber, setCompNumber] = useState('');
  const [compVehicle, setCompVehicle] = useState('');
  const [compSaving, setCompSaving] = useState(false);
  const [editComp, setEditComp] = useState<{ id: string; driver: string; coDriver: string; number: string } | null>(null);
  const [editCompSaving, setEditCompSaving] = useState(false);
  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);
  const [deleteCompName, setDeleteCompName] = useState('');
  const [deleteCompSaving, setDeleteCompSaving] = useState(false);

  const loadStages = useCallback(async () => {
    const s = await listStages(event.id);
    setStages(s);
  }, [event.id]);

  const loadCompetitors = useCallback(async () => {
    const c = await listCompetitors(event.id, true);
    setCompetitors(c);
  }, [event.id]);

  useEffect(() => { loadStages(); loadCompetitors(); }, [loadStages, loadCompetitors]);

  useEffect(() => {
    if (tab === 'results' && resultsStageId) {
      setResultsLoading(true);
      getResults(event.id, resultsStageId).then(r => { setResults(r); setResultsLoading(false); });
    }
  }, [tab, resultsStageId, event.id]);

  // Pokud je vybraná etapa → renderovat StageDetail
  if (selectedStage) {
    return (
      <StageDetail
        event={event}
        stage={selectedStage}
        onBack={() => { setSelectedStage(null); loadStages(); }}
        onStageUpdated={(updated) => {
          setStages(prev => prev.map(s => s.id === updated.id ? updated : s));
        }}
      />
    );
  }

  const handleAddStage = async () => {
    if (!stageName) return;
    setStageSaving(true);
    try {
      await createStage(event.id, stageName, stageOrder);
      setStageName(''); setStageOrder(stages.length + 2);
      await loadStages();
    } finally { setStageSaving(false); }
  };

  const handleEditStage = async () => {
    if (!editStage) return;
    setEditStageSaving(true);
    try {
      await updateStage(event.id, editStage.id, { name: editStage.name, order: editStage.order });
      setEditStage(null);
      await loadStages();
    } finally { setEditStageSaving(false); }
  };

  const handleDeleteStage = async () => {
    if (!deleteStageConfirm) return;
    setDeleteStageSaving(true);
    try {
      await deleteStage(event.id, deleteStageConfirm.id);
      setDeleteStageConfirm(null);
      await loadStages();
    } finally { setDeleteStageSaving(false); }
  };

  const handleStageStatus = async (stage: Stage, newStatus: Stage['status']) => {
    setStageStatusChanging(stage.id);
    setStageStatusError('');
    try {
      const result = await updateStage(event.id, stage.id, { status: newStatus });
      if (result?.error) { setStageStatusError(result.error); return; }
      await loadStages();
    } catch { setStageStatusError('Nepodařilo se změnit stav.'); }
    finally { setStageStatusChanging(null); }
  };

  const handleAddCompetitor = async () => {
    if (!compDriver || !compCoDriver || !compNumber) return;
    setCompSaving(true);
    try {
      await createCompetitor(event.id, { driver: compDriver, coDriver: compCoDriver, number: compNumber, vehicle: compVehicle });
      setCompDriver(''); setCompCoDriver(''); setCompNumber(''); setCompVehicle('');
      await loadCompetitors();
    } finally { setCompSaving(false); }
  };

  const handleEditCompetitor = async () => {
    if (!editComp) return;
    setEditCompSaving(true);
    try {
      await updateCompetitor(event.id, editComp.id, { driver: editComp.driver, coDriver: editComp.coDriver, number: editComp.number });
      setEditComp(null);
      await loadCompetitors();
    } finally { setEditCompSaving(false); }
  };

  const handleDeleteCompetitor = async () => {
    if (!deleteCompId) return;
    setDeleteCompSaving(true);
    try {
      await deleteCompetitor(event.id, deleteCompId);
      setDeleteCompId(null); setDeleteCompName('');
      await loadCompetitors();
    } finally { setDeleteCompSaving(false); }
  };

  const exportCSV = () => {
    if (!results) return;
    const rows = [['Řidič', 'Spolujezdec', 'Číslo', 'Vozidlo', 'Zaznamenáno', 'Celkem CP', 'Časy'].join(',')];
    for (const r of results.results) {
      const recorded = r.passages.filter((p: any) => p.action === 'recorded');
      const times = recorded
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((p: any) => new Date(p.timestamp).toLocaleTimeString('cs-CZ'))
        .join(' | ');
      rows.push([r.competitor.driver || r.competitor.name, r.competitor.coDriver || '', r.competitor.number, r.competitor.vehicle || '', r.recordedCount, r.totalCheckpoints, `"${times}"`].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `aospoint-${event.name}-etapa-results.csv`; a.click();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, padding: 0 }}>
          ← Zpět
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{event.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{event.date}</p>
          </div>
          {event.accessCode && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kód soutěže</div>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent-bright)', background: 'var(--accent-glow)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '4px 12px' }}>
                {event.accessCode}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ maxWidth: 'none' }}>
        {([
          { key: 'stages', icon: <Layers size={14} />, label: 'Etapy' },
          { key: 'competitors', icon: <Users size={14} />, label: 'Závodníci' },
          { key: 'results', icon: <Trophy size={14} />, label: 'Výsledky' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-item ${tab === t.key ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px' }}>

        {/* ── ETAPY TAB ── */}
        {tab === 'stages' && (
          <div>
            {/* Přidat etapu */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Přidat etapu
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="number" value={stageOrder} min={1} max={6} onChange={e => setStageOrder(parseInt(e.target.value) || 1)} placeholder="Pořadí" className="input-field" style={{ width: 72, flex: '0 0 auto' }} />
                  <input type="text" value={stageName} onChange={e => setStageName(e.target.value)} placeholder="Název etapy" className="input-field" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAddStage()} />
                </div>
                <button onClick={handleAddStage} disabled={stageSaving || !stageName} className="btn-primary" style={{ minHeight: 44, fontSize: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Plus size={16} />
                    {stageSaving ? 'Přidávám...' : 'Přidat etapu'}
                  </span>
                </button>
              </div>
            </div>

            {stageStatusError && (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#f87171', fontSize: 13 }}>
                {stageStatusError}
              </div>
            )}

            {/* Seznam etap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stages.map(stage => {
                const sc = STAGE_STATUS_CONFIG[stage.status] || STAGE_STATUS_CONFIG.draft;
                return (
                  <div key={stage.id}>
                    <div
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: editStage?.id === stage.id ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      {/* Pořadí */}
                      <div style={{ width: 34, height: 34, background: 'var(--accent-glow)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--accent-bright)', flexShrink: 0 }}>
                        {stage.order}
                      </div>

                      {/* Název + status */}
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedStage(stage)}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{stage.name}</div>
                        <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', marginTop: 4, display: 'inline-block' }}>
                          {sc.label}
                        </span>
                      </div>

                      {/* Akce stav */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        {stage.status === 'draft' && (
                          <button onClick={() => handleStageStatus(stage, 'active')} disabled={stageStatusChanging === stage.id} style={{ fontSize: 11, padding: '5px 10px', background: 'var(--success-glow)', color: 'var(--success)', border: '1px solid rgba(78,204,163,0.3)', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>
                            ▶ Start
                          </button>
                        )}
                        {stage.status === 'active' && (
                          <button onClick={() => handleStageStatus(stage, 'finished')} disabled={stageStatusChanging === stage.id} style={{ fontSize: 11, padding: '5px 10px', background: 'rgba(124,58,237,0.15)', color: 'var(--accent-bright)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>
                            ■ Konec
                          </button>
                        )}
                        {stage.status === 'finished' && (
                          <button onClick={() => handleStageStatus(stage, 'draft')} disabled={stageStatusChanging === stage.id} style={{ fontSize: 11, padding: '5px 10px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer' }}>
                            ↺
                          </button>
                        )}
                        <button onClick={() => setEditStage(editStage?.id === stage.id ? null : { id: stage.id, name: stage.name, order: stage.order })} style={{ background: editStage?.id === stage.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteStageConfirm(stage)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Inline edit etapy */}
                    {editStage?.id === stage.id && (
                      <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input type="number" value={editStage.order} min={1} max={6} onChange={e => setEditStage({ ...editStage, order: parseInt(e.target.value) || 1 })} className="input-field" style={{ width: 72, flex: '0 0 auto' }} />
                          <input type="text" value={editStage.name} onChange={e => setEditStage({ ...editStage, name: e.target.value })} className="input-field" style={{ flex: 1 }} autoFocus />
                          <button onClick={handleEditStage} disabled={editStageSaving || !editStage.name} className="btn-primary" style={{ padding: '0 16px', minHeight: 40 }}>
                            {editStageSaving ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditStage(null)} className="btn-secondary" style={{ padding: '0 12px', minHeight: 40 }}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {stages.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>
                  Žádné etapy — přidejte první etapu
                </p>
              )}
            </div>

            {/* Delete stage modal */}
            {deleteStageConfirm && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Smazat etapu?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                    Opravdu smazat etapu <strong style={{ color: 'var(--text-primary)' }}>{deleteStageConfirm.name}</strong>? Smaže se i všechny checkpointy a průjezdy etapy.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setDeleteStageConfirm(null)} className="btn-secondary" style={{ flex: 1, minHeight: 40 }} disabled={deleteStageSaving}>Zrušit</button>
                    <button onClick={handleDeleteStage} disabled={deleteStageSaving} style={{ flex: 1, minHeight: 40, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      {deleteStageSaving ? 'Mažu...' : 'Smazat'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ZÁVODNÍCI TAB ── */}
        {tab === 'competitors' && (
          <div>
            {/* Přidat závodníka */}
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Přidat závodníka</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" value={compNumber} onChange={e => setCompNumber(e.target.value)} placeholder="Č." className="input-field" style={{ width: 64, flex: '0 0 auto' }} />
                  <input type="text" value={compDriver} onChange={e => setCompDriver(e.target.value)} placeholder="Řidič" className="input-field" style={{ flex: 1 }} />
                  <input type="text" value={compCoDriver} onChange={e => setCompCoDriver(e.target.value)} placeholder="Spolujezdec" className="input-field" style={{ flex: 1 }} />
                </div>
                <input type="text" value={compVehicle} onChange={e => setCompVehicle(e.target.value)} placeholder="Vozidlo (volitelné)" className="input-field" />
                <button onClick={handleAddCompetitor} disabled={compSaving || !compDriver || !compCoDriver || !compNumber} className="btn-primary" style={{ minHeight: 48, fontSize: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Plus size={16} />
                    {compSaving ? 'Přidávám...' : 'Přidat posádku'}
                  </span>
                </button>
              </div>
            </div>

            {/* Delete competitor modal */}
            {deleteCompId && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Smazat posádku?</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                    Opravdu smazat posádku <strong style={{ color: 'var(--text-primary)' }}>{deleteCompName}</strong>?
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setDeleteCompId(null); setDeleteCompName(''); }} className="btn-secondary" style={{ flex: 1, minHeight: 40 }} disabled={deleteCompSaving}>Zrušit</button>
                    <button onClick={handleDeleteCompetitor} disabled={deleteCompSaving} style={{ flex: 1, minHeight: 40, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      {deleteCompSaving ? 'Mažu...' : 'Smazat'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Seznam závodníků */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {competitors.map(comp => (
                <div key={comp.id}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: editComp?.id === comp.id ? '12px 12px 0 0' : 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-bright)', fontSize: 14, flexShrink: 0, paddingTop: 2 }}>#{comp.number}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {comp.driver || comp.name}
                        {comp.coDriver && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> & {comp.coDriver}</span>}
                      </div>
                      {comp.vehicle && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>{comp.vehicle}</div>}
                      {/* Kódy per etapa */}
                      {comp.stageCodes && Object.keys(comp.stageCodes).length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {stages.map(stage => comp.stageCodes?.[stage.id] && (
                            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 8px' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>E{stage.order}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)', letterSpacing: '0.05em' }}>{comp.stageCodes[stage.id]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setEditComp(editComp?.id === comp.id ? null : { id: comp.id, driver: comp.driver || '', coDriver: comp.coDriver || '', number: String(comp.number) })} style={{ background: editComp?.id === comp.id ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { setDeleteCompId(comp.id); setDeleteCompName(`#${comp.number} – ${comp.driver || comp.name} / ${comp.coDriver || ''}`); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {editComp?.id === comp.id && (
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input type="text" value={editComp.number} onChange={e => setEditComp({ ...editComp, number: e.target.value })} placeholder="Č." className="input-field" style={{ width: 64, flex: '0 0 auto' }} />
                          <input type="text" value={editComp.driver} onChange={e => setEditComp({ ...editComp, driver: e.target.value })} placeholder="Řidič" className="input-field" style={{ flex: 1 }} autoFocus />
                          <input type="text" value={editComp.coDriver} onChange={e => setEditComp({ ...editComp, coDriver: e.target.value })} placeholder="Spolujezdec" className="input-field" style={{ flex: 1 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={handleEditCompetitor} disabled={editCompSaving || !editComp.driver || !editComp.coDriver || !editComp.number} className="btn-primary" style={{ flex: 1, minHeight: 40, fontSize: 14, padding: '10px' }}>
                            {editCompSaving ? 'Ukládám...' : '✓ Uložit změny'}
                          </button>
                          <button onClick={() => setEditComp(null)} className="btn-secondary" style={{ minHeight: 40, padding: '10px 16px', flex: '0 0 auto' }}>Zrušit</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {competitors.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>Žádní závodníci</p>
              )}
            </div>
          </div>
        )}

        {/* ── VÝSLEDKY TAB ── */}
        {tab === 'results' && (
          <div>
            {/* Výběr etapy */}
            <div style={{ marginBottom: 16 }}>
              <select
                value={resultsStageId}
                onChange={e => { setResultsStageId(e.target.value); setResults(null); }}
                className="input-field"
                style={{ width: '100%' }}
              >
                <option value="">— Vyberte etapu —</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>Etapa {s.order}: {s.name}</option>
                ))}
              </select>
            </div>

            {!resultsStageId && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0', fontSize: 14 }}>
                Vyberte etapu pro zobrazení výsledků
              </p>
            )}

            {resultsStageId && resultsLoading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 14 }}>Načítám výsledky...</div>
            )}

            {resultsStageId && !resultsLoading && results && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{results.results?.length || 0} závodníků</div>
                  <button onClick={exportCSV} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} />Export CSV
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(results.results || []).map((r: any, idx: number) => {
                    const medalColors = ['#f59e0b', '#9ca3af', '#b45309'];
                    return (
                      <div key={r.competitor.id} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 999, background: idx < 3 ? medalColors[idx] : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: idx < 3 ? '#fff' : 'var(--text-muted)', flexShrink: 0 }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>
                              <span style={{ color: 'var(--accent-bright)' }}>#{r.competitor.number}</span>{' '}
                              {r.competitor.driver
                                ? <>{r.competitor.driver} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>& {r.competitor.coDriver}</span></>
                                : r.competitor.name}
                            </div>
                            {r.competitor.vehicle && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>{r.competitor.vehicle}</div>}
                          </div>
                          <div className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontSize: 20, color: 'var(--success)' }}>{r.recordedCount}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {r.passages
                            .filter((p: any) => p.action === 'recorded')
                            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                            .map((p: any, i: number) => {
                              const cp = (results.checkpoints || []).find((c: any) => c.id === p.checkpointId);
                              const code = cp?.code || cp?.name || '?';
                              return (
                                <div key={`${p.id || i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', gap: 3 }}>
                                    {code.split('').map((ch: string, ci: number) => (
                                      <div key={ci} style={{ width: 28, height: 28, border: `1.5px solid ${cp?.type === 'PK' ? '#a78bfa' : 'var(--accent-bright)'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: 'white' }}>{ch}</div>
                                    ))}
                                  </div>
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{cp?.name}</span>
                                  {cp?.type === 'PK' && <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700 }}>PK</span>}
                                  <span className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{new Date(p.timestamp).toLocaleTimeString('cs-CZ')}</span>
                                </div>
                              );
                            })}
                          {r.recordedCount === 0 && <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: 13, borderTop: '1px solid var(--border)' }}>Žádné průjezdy</div>}
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
