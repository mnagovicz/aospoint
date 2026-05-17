import { useState, useEffect } from 'react';
import { Flag, LogOut } from 'lucide-react';
import { listEvents, listCheckpoints, listCompetitors, type Checkpoint } from '../../api';
import { saveSession, loadSession, saveCheckpoints, loadCheckpoints } from '../../utils/storage';
import SimpleRacingScreen from './SimpleRacingScreen';

type Screen = 'login' | 'racing';

interface Session {
  eventId: string;
  competitorId: string;
  competitorCode: string;
  competitorName: string;
  competitorNumber: string;
}

export default function SimpleCompetitorApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [session, setSession] = useState<Session | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [raceNumber, setRaceNumber] = useState('');

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved as unknown as Session);
      const cps = loadCheckpoints(saved.eventId);
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
        competitorCode: comp.accessCode || (comp.stageCodes ? Object.values(comp.stageCodes)[0] : '') || '',
        competitorName: comp.name,
        competitorNumber: String(comp.number),
      };
      // @ts-expect-error SimpleCompetitorApp nepracuje s etapami, stageId nepotřebuje
      saveSession(sess);
      setSession(sess);
      setScreen('racing');
    } catch {
      setError('Chyba připojení. Zkontrolujte internet.');
    } finally {
      setLoading(false);
    }
  };

  if (screen === 'racing' && session) {
    return <SimpleRacingScreen session={session} checkpoints={checkpoints} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 40 }}>
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
            }}
          >
            <Flag size={32} color="#8b5cf6" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
            AosPoint
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 14 }}>
            Závodnická aplikace
          </p>
        </div>

        {/* Form */}
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
                placeholder="např. 2"
                className="input-field"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--danger-glow)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'var(--danger)',
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary"
              style={{ minHeight: 52 }}
            >
              {loading ? 'NAČÍTÁM...' : 'PŘIHLÁSIT SE'}
            </button>
          </div>
        </div>

        {/* Switch to admin */}
        <div className="text-center" style={{ marginTop: 20 }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
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
