import { useState, useEffect } from 'react';
import { Flag, LogOut, Lock } from 'lucide-react';
import { listEvents, listStagesPublic, listCheckpoints, listCompetitors, type Stage, type Checkpoint } from '../../api';
import { saveSession, loadSession, saveCheckpoints, loadCheckpoints } from '../../utils/storage';
import SimpleRacingScreen from './SimpleRacingScreen';

type Screen = 'login' | 'stages' | 'racing';

interface Session {
  eventId: string;
  stageId: string;
  competitorId: string;
  competitorCode: string;
  competitorName: string;
  competitorNumber: string;
}

export default function SimpleCompetitorApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [stageLoading, setStageLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [raceNumber, setRaceNumber] = useState('');

  // Pending session bez stageId — čeká na výběr etapy
  const [pendingSession, setPendingSession] = useState<Omit<Session, 'stageId'> | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.stageId) {
      const cps = loadCheckpoints(saved.eventId, saved.stageId);
      if (cps.length > 0) {
        setSession(saved);
        setCheckpoints(cps);
        setScreen('racing');
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!eventCode || !raceNumber) { setError('Vyplňte kód soutěže a závodní číslo'); return; }
    setLoading(true);
    setError('');
    try {
      const events = await listEvents(eventCode.toUpperCase());
      if (!events || events.length === 0) { setError('Neplatný kód soutěže'); return; }
      const ev = events[0];
      const competitors = await listCompetitors(ev.id);
      const comp = competitors.find(c => String(c.number) === raceNumber);
      if (!comp) { setError('Závodní číslo nenalezeno'); return; }

      const stagesData = await listStagesPublic(ev.id);
      setStages(stagesData);
      setPendingSession({
        eventId: ev.id,
        competitorId: comp.id,
        competitorCode: comp.accessCode || (comp.stageCodes ? Object.values(comp.stageCodes)[0] : '') || '',
        competitorName: comp.name,
        competitorNumber: String(comp.number),
      });
      setScreen('stages');
    } catch {
      setError('Chyba připojení. Zkontrolujte internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStage = async (stage: Stage) => {
    if (!pendingSession) return;
    setStageLoading(stage.id);
    try {
      const cps = await listCheckpoints(pendingSession.eventId, stage.id);
      saveCheckpoints(pendingSession.eventId, stage.id, cps);
      const sess: Session = { ...pendingSession, stageId: stage.id };
      saveSession(sess);
      setSession(sess);
      setCheckpoints(cps);
      setScreen('racing');
    } catch {
      setError('Nepodařilo se načíst checkpointy.');
    } finally {
      setStageLoading(null);
    }
  };

  if (screen === 'racing' && session) {
    return <SimpleRacingScreen session={session} checkpoints={checkpoints} />;
  }

  if (screen === 'stages' && pendingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div className="text-center" style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Výběr etapy</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 14 }}>
              {pendingSession.competitorName} · #{pendingSession.competitorNumber}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stages.length === 0 && (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Zatím nejsou žádné etapy
              </div>
            )}
            {stages.map(stage => {
              const isActive = stage.status === 'active';
              const isFinished = stage.status === 'finished';
              return (
                <button
                  key={stage.id}
                  onClick={() => isActive && handleStartStage(stage)}
                  disabled={!isActive || stageLoading === stage.id}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', cursor: isActive ? 'pointer' : 'default', textAlign: 'left',
                    border: isActive ? '1px solid rgba(124,58,237,0.5)' : '1px solid var(--border)',
                    background: isActive ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                    opacity: isFinished ? 0.5 : 1,
                    width: '100%',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isActive ? 'white' : 'var(--text-secondary)' }}>
                      {stage.name}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3, color: isActive ? 'var(--accent-bright)' : 'var(--text-muted)' }}>
                      {isActive ? '● Aktivní' : isFinished ? 'Dokončena' : 'Připravuje se'}
                    </div>
                  </div>
                  {isActive
                    ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-bright)' }}>
                        {stageLoading === stage.id ? 'Načítám...' : 'SPUSTIT ▶'}
                      </span>
                    : <Lock size={16} color="var(--text-muted)" />
                  }
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{ marginTop: 16, background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: 'var(--danger)', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div className="text-center" style={{ marginTop: 20 }}>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
              onClick={() => { setScreen('login'); setPendingSession(null); setError(''); }}
            >
              ← Zpět
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, background: 'var(--accent-glow)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Flag size={32} color="#8b5cf6" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>AosPoint</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 14 }}>Závodnická aplikace</p>
        </div>

        <div className="card" style={{ padding: '28px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Kód soutěže
              </label>
              <input
                type="text"
                value={eventCode}
                onChange={e => setEventCode(e.target.value.toUpperCase())}
                placeholder="např. ABC123"
                className="input-field"
                style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.15em', fontSize: 18, fontVariantNumeric: 'slashed-zero' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Závodní číslo
              </label>
              <input
                type="text"
                value={raceNumber}
                onChange={e => setRaceNumber(e.target.value)}
                placeholder="např. 2"
                className="input-field"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: 'var(--danger)', fontSize: 14 }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading} className="btn-primary" style={{ minHeight: 52 }}>
              {loading ? 'NAČÍTÁM...' : 'PŘIHLÁSIT SE'}
            </button>
          </div>
        </div>

        <div className="text-center" style={{ marginTop: 20 }}>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => location.href = '/admin'}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <LogOut size={14} />
            Pořadatel
          </button>
        </div>
      </div>
    </div>
  );
}
