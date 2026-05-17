import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { listEvents, listCheckpoints, listCompetitors, type Checkpoint } from '../../api';
import { saveSession, loadSession, saveCheckpoints, loadCheckpoints } from '../../utils/storage';
import RacingScreen from './RacingScreen';

type Screen = 'login' | 'waiting' | 'racing' | 'results';

interface Session {
  eventId: string;
  competitorId: string;
  competitorCode: string;
  competitorName: string;
  competitorNumber: string;
}

export default function CompetitorApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [_event, setEvent] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [raceNumber, setRaceNumber] = useState('');

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved);
      const cps = loadCheckpoints(saved.eventId);
      if (cps.length > 0) {
        setCheckpoints(cps);
        setScreen('racing');
      }
    }
  }, []);

  const handleLogin = async () => {
    if (!eventCode || !raceNumber) {
      setError('Vyplňte kód eventu a závodní číslo');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const events = await listEvents(eventCode.toUpperCase());
      if (!events || events.length === 0) {
        setError('Neplatný kód eventu');
        return;
      }
      const ev = events[0];

      const competitors = await listCompetitors(ev.id);
      const comp = competitors.find(c => String(c.number) === raceNumber);
      if (!comp) {
        setError('Závodní číslo nenalezeno');
        return;
      }

      const cps = await listCheckpoints(ev.id);
      saveCheckpoints(ev.id, cps);
      setCheckpoints(cps);

      const sess: Session = {
        eventId: ev.id,
        competitorId: comp.id,
        competitorCode: comp.accessCode || '',
        competitorName: comp.name,
        competitorNumber: String(comp.number),
      };
      saveSession(sess);
      setSession(sess);
      setEvent(ev);

      if (ev.status === 'active') {
        setScreen('racing');
      } else {
        setScreen('waiting');
      }
    } catch (e) {
      setError('Chyba připojení. Zkontrolujte internet.');
    } finally {
      setLoading(false);
    }
  };

  if (screen === 'login') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-5"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Logo area */}
          <div className="text-center mb-10">
            <div
              style={{
                width: 72,
                height: 72,
                background: 'var(--accent-glow)',
                border: '1px solid rgba(124,58,237,0.3)',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 32,
              }}
            >
              🏎️
            </div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              AosPoint
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 15 }}>
              Automobilová orientace — přihlaste posádku
            </p>
          </div>

          {/* Form card */}
          <div className="card" style={{ padding: '28px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  Kód eventu
                </label>
                <input
                  type="text"
                  value={eventCode}
                  onChange={e => setEventCode(e.target.value.toUpperCase())}
                  placeholder="např. ABC123"
                  className="input-field"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.15em', fontWeight: 700, fontSize: 20, fontVariantNumeric: 'slashed-zero' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}
                >
                  Závodní číslo
                </label>
                <input
                  type="text"
                  value={raceNumber}
                  onChange={e => setRaceNumber(e.target.value)}
                  placeholder="např. 42"
                  className="input-field"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: 'var(--danger-glow)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    color: 'var(--danger)',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <WifiOff size={16} />
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="btn-primary"
                style={{ marginTop: 4, minHeight: 56 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    Připojuji se...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Wifi size={18} />
                    PŘIPOJIT SE
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center" style={{ marginTop: 24 }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onClick={() => {
                window.history.pushState({}, '', '/admin');
                location.reload();
              }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Pořadatel →
            </button>
          </div>

          <p
            style={{
              textAlign: 'center',
              marginTop: 32,
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            v1.0 · AosPoint
          </p>
        </div>
      </div>
    );
  }

  if (screen === 'waiting') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-5"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>⏳</div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}
          >
            Čekáme na start
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Event ještě nezačal</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
            Posádka:{' '}
            <span style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>
              #{session?.competitorNumber} &mdash; {session?.competitorName}
            </span>
          </p>
          <button
            onClick={() => setScreen('racing')}
            className="btn-primary"
            style={{ minHeight: 56 }}
          >
            Jdu závodit (debug)
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'racing' && session) {
    return (
      <RacingScreen
        session={session}
        checkpoints={checkpoints}
        onFinish={() => setScreen('results')}
      />
    );
  }

  if (screen === 'results' && session) {
    return (
      <div className="min-h-screen p-5" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 28 }}>🏆</span>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Moje výsledky
            </h2>
          </div>
          <div className="card">
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              Posádka:{' '}
              <span style={{ color: 'white', fontWeight: 600 }}>
                #{session.competitorNumber} &mdash; {session.competitorName}
              </span>
            </p>
            <button
              onClick={() => setScreen('racing')}
              className="btn-secondary"
            >
              ← Zpět na mapu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
