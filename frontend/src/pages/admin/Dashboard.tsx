import { useState, useEffect } from 'react';
import { listEvents, type Event } from '../../api';
import EventDetail from './EventDetail';
import NewEventForm from './NewEventForm';

type View = 'list' | 'new' | 'detail';

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const evs = await listEvents();
      setEvents(evs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  if (view === 'new') {
    return (
      <NewEventForm
        onCreated={(ev) => {
          setSelectedEvent(ev);
          setView('detail');
          loadEvents();
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'detail' && selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={() => { setView('list'); loadEvents(); }}
      />
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ background: '#1a1a2e' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#4ecca3' }}>📍 AosPoint Admin</h1>
          <button
            onClick={() => setView('new')}
            className="px-4 py-2 rounded-xl font-bold"
            style={{ background: '#4ecca3', color: '#1a1a2e' }}
          >
            + Nový event
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-12">Načítám...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🏁</div>
            <p className="text-gray-400">Žádné eventy. Vytvořte první!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div
                key={ev.id}
                onClick={() => { setSelectedEvent(ev); setView('detail'); }}
                className="p-4 rounded-xl cursor-pointer transition-all"
                style={{ background: '#16213e', border: '1px solid #0f3460' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{ev.name}</div>
                    <div className="text-sm text-gray-400">{ev.date}</div>
                    {ev.accessCode && (
                      <div className="text-xs mt-1 font-mono" style={{ color: '#4ecca3' }}>
                        Kód: {ev.accessCode}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className="px-2 py-1 rounded text-xs font-bold"
                      style={{
                        background: ev.status === 'active' ? '#064e3b' : ev.status === 'finished' ? '#1e1b4b' : '#292524',
                        color: ev.status === 'active' ? '#4ecca3' : ev.status === 'finished' ? '#818cf8' : '#9ca3af',
                      }}
                    >
                      {ev.status === 'active' ? '● Aktivní' : ev.status === 'finished' ? 'Dokončen' : 'Draft'}
                    </span>
                    <div className="text-gray-500 text-xs mt-1">›</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
