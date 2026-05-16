import { useState, useEffect } from 'react';
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#1a1a2e' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📍</div>
            <h1 className="text-3xl font-bold" style={{ color: '#4ecca3' }}>AosPoint</h1>
            <p className="text-gray-400 mt-2">Orientační soutěže</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Kód eventu</label>
              <input
                type="text"
                value={eventCode}
                onChange={e => setEventCode(e.target.value.toUpperCase())}
                placeholder="např. ABC123"
                className="w-full px-4 py-4 rounded-xl text-white text-lg font-mono"
                style={{ background: '#16213e', border: '2px solid #0f3460' }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Závodní číslo</label>
              <input
                type="text"
                value={raceNumber}
                onChange={e => setRaceNumber(e.target.value)}
                placeholder="např. 42"
                className="w-full px-4 py-4 rounded-xl text-white text-lg"
                style={{ background: '#16213e', border: '2px solid #0f3460' }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-red-400 text-sm" style={{ background: '#2a1a1a' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-bold text-lg"
              style={{ background: loading ? '#0f3460' : '#4ecca3', color: loading ? '#fff' : '#1a1a2e', minHeight: '64px' }}
            >
              {loading ? 'Načítám...' : 'Přihlásit se'}
            </button>
          </div>

          <div className="text-center mt-6">
            <a
              href="/admin"
              className="text-sm"
              style={{ color: '#0f3460' }}
              onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/admin'); window.dispatchEvent(new PopStateEvent('popstate')); location.reload(); }}
            >
              Pořadatel →
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#1a1a2e' }}>
        <div className="text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-3">Čekáme na start</h2>
          <p className="text-gray-400 mb-2">Event ještě nezačal</p>
          <p className="text-gray-500 text-sm mb-8">Závodník: <span style={{ color: '#4ecca3' }}>{session?.competitorName} #{session?.competitorNumber}</span></p>
          <button
            onClick={() => setScreen('racing')}
            className="px-8 py-4 rounded-xl font-bold"
            style={{ background: '#4ecca3', color: '#1a1a2e', minHeight: '64px' }}
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
      <div className="min-h-screen p-4" style={{ background: '#1a1a2e' }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#4ecca3' }}>Moje výsledky</h2>
        <p className="text-gray-400">Závodník: {session.competitorName} #{session.competitorNumber}</p>
        <button
          onClick={() => setScreen('racing')}
          className="mt-6 px-6 py-4 rounded-xl font-bold"
          style={{ background: '#4ecca3', color: '#1a1a2e', minHeight: '64px' }}
        >
          Zpět na mapu
        </button>
      </div>
    );
  }

  return null;
}
