import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { listEvents, listStagesPublic, listCheckpoints, listCompetitors, type Stage, type Checkpoint } from '../../api';
import { saveSession, loadSession, saveCheckpoints, loadCheckpoints } from '../../utils/storage';
import RacingScreen from './RacingScreen';

type Screen = 'login' | 'stage-select' | 'racing';

interface Session {
  eventId: string;
  stageId: string;
  competitorId: string;
  competitorCode: string;
  competitorName: string;
  competitorNumber: string;
}

interface LoginState {
  eventId: string;
  competitorId: string;
  competitorName: string;
  competitorNumber: string;
  stageCodes: Record<string, string>;
  stages: Stage[];
}

export default function CompetitorApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [raceNumber, setRaceNumber] = useState('');

  // Mezistav po přihlášení — čeká na výběr etapy
  const [loginState, setLoginState] = useState<LoginState | null>(null);
  const [stageLoading, setStageLoading] = useState(false);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved);
      const cps = loadCheckpoints(saved.eventId, saved.stageId);
      if (cps.length > 0) {
        setCheckpoints(cps);
        setScreen('racing');
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!eventCode || !raceNumber) {
      setError('Vyplňte kód soutěže a závodní číslo');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const events = await listEvents(eventCode.toUpperCase());
      if (!events || events.length === 0) {
        setError('Neplatný kód soutěže');
        return;
      }
      const ev = events[0];

      const [competitors, stages] = await Promise.all([
        listCompetitors(ev.id),
        listStagesPublic(ev.id),
      ]);

      const comp = competitors.find(c => String(c.number) === raceNumber);
      if (!comp) {
        setError('Závodní číslo nenalezeno');
        return;
      }

      // Načíst stageCodes pro závodníka — potřebujeme admin endpoint
      // Závodník nemá stageCodes v public response — použijeme event accessCode jako ověření
      // stageCodes se ověří na backendu při recordPassage
      // Prozatím uložíme prázdné stageCodes — kód se předává z přihlášení
      setLoginState({
        eventId: ev.id,
        competitorId: comp.id,
        competitorName: comp.name,
        competitorNumber: String(comp.number),
        stageCodes: (comp as any).stageCodes || {},
        stages,
      });
      setScreen('stage-select');
    } catch {
      setError('Chyba připojení. Zkontrolujte internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStage = async (stage: Stage) => {
    if (!loginState) return;
    if (stage.status !== 'active') return;
    setStageLoading(true);
    try {
      const cps = await listCheckpoints(loginState.eventId, stage.id);
      saveCheckpoints(loginState.eventId, stage.id, cps);
      setCheckpoints(cps);

      const competitorCode = loginState.stageCodes[stage.id] || '';
      const sess: Session = {
        eventId: loginState.eventId,
        stageId: stage.id,
        competitorId: loginState.competitorId,
        competitorCode,
        competitorName: loginState.competitorName,
        competitorNumber: loginState.competitorNumber,
      };
      saveSession(sess);
      setSession(sess);
      setScreen('racing');
    } catch {
      setError('Nepodařilo se načíst etapu.');
    } finally {
      setStageLoading(false); }
  };

  // ── LOGIN SCREEN ──────────────────────────────────────────
  if (screen === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div className="text-center mb-10">
            <div style={{ width: 72, height: 72, background: 'var(--accent-glow)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>🏎️</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>AosPoint</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15 }}>Automobilová orientace — přihlaste posádku</p>
          </div>

          <div className="card" style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Kód soutěže</label>
                <input type="text" value={eventCode} onChange={e => setEventCode(e.target.value.toUpperCase())} placeholder="např. ABC123" className="input-field" style={{ fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 700, fontSize: 20 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Závodní číslo</label>
                <input type="text" value={raceNumber} onChange={e => setRaceNumber(e.target.value)} placeholder="např. 42" className="input-field" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>

              {error && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: 'var(--danger)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WifiOff size={16} />{error}
                </div>
              )}

              <button onClick={handleLogin} disabled={loading} className="btn-primary" style={{ marginTop: 4, minHeight: 56 }}>
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Připojuji se...</span>
                  : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Wifi size={18} />PŘIPOJIT SE</span>
                }
              </button>
            </div>
          </div>

          <div className="text-center" style={{ marginTop: 24 }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }} onClick={() => { window.history.pushState({}, '', '/admin'); location.reload(); }}>
              Pořadatel →
            </button>
          </div>
          <p style={{ textAlign: 'center', marginTop: 32, color: 'var(--text-muted)', fontSize: 12 }}>v2.0 · AosPoint</p>
        </div>
      </div>
    );
  }

  // ── VÝBĚR ETAPY ──────────────────────────────────────────
  if (screen === 'stage-select' && loginState) {
    const { stages } = loginState;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Vyberte etapu</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 14 }}>
              Posádka <span style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>#{loginState.competitorNumber}</span> — {loginState.competitorName}
            </p>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: 'var(--danger)', fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>
                Žádné etapy v této soutěži
              </div>
            )}
            {stages.map(stage => {
              const isActive = stage.status === 'active';
              const isFinished = stage.status === 'finished';
              return (
                <button
                  key={stage.id}
                  onClick={() => handleSelectStage(stage)}
                  disabled={!isActive || stageLoading}
                  style={{
                    background: isActive ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))' : 'var(--bg-secondary)',
                    border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                    borderRadius: 14,
                    padding: '18px 20px',
                    cursor: isActive ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: isFinished ? 0.5 : 1,
                    transition: 'background 0.2s, border-color 0.2s',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isActive ? 'var(--accent-glow)' : 'var(--bg-tertiary)', border: `1px solid ${isActive ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {isActive ? '▶' : isFinished ? '✓' : '🔒'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: isActive ? 'white' : 'var(--text-secondary)' }}>
                      Etapa {stage.order}: {stage.name}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3, color: isActive ? 'var(--success)' : isFinished ? 'var(--accent-bright)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {isActive ? '● Aktivní — lze spustit' : isFinished ? 'Dokončena' : 'Čeká na start'}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{ color: 'var(--accent-bright)', fontSize: 20 }}>→</div>
                  )}
                </button>
              );
            })}
          </div>

          <button onClick={() => { setScreen('login'); setLoginState(null); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 24, width: '100%', textAlign: 'center' }}>
            ← Zpět na přihlášení
          </button>
        </div>
      </div>
    );
  }

  // ── RACING SCREEN ────────────────────────────────────────
  if (screen === 'racing' && session) {
    return (
      <RacingScreen
        session={session}
        checkpoints={checkpoints}
      />
    );
  }

  return null;
}
