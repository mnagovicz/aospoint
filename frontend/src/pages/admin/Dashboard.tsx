import { useState, useEffect } from 'react';
import { Plus, ChevronRight, Trophy, Map } from 'lucide-react';
import { listEvents, type Event } from '../../api';
import EventDetail from './EventDetail';
import NewEventForm from './NewEventForm';

type View = 'list' | 'new' | 'detail';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot?: string }> = {
  active: { label: '● Aktivní', bg: 'var(--success-glow)', color: 'var(--success)', dot: 'var(--success)' },
  finished: { label: 'Dokončen', bg: 'rgba(124,58,237,0.15)', color: 'var(--accent-bright)' },
  draft: { label: 'Draft', bg: 'var(--bg-tertiary)', color: 'var(--text-muted)' },
};

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
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '20px 20px 16px',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Map size={20} color="var(--accent-bright)" />
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Moje eventy
            </h1>
          </div>
          <button
            onClick={() => setView('new')}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none',
              borderRadius: 12,
              padding: '10px 16px',
              color: 'white',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Nový
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px' }}>
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              padding: '48px 0',
              fontSize: 14,
            }}
          >
            Načítám...
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Trophy size={28} color="var(--text-muted)" />
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Žádné eventy</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Vytvořte svůj první event</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(ev => {
              const status = STATUS_CONFIG[ev.status] || STATUS_CONFIG.draft;
              return (
                <div
                  key={ev.id}
                  onClick={() => { setSelectedEvent(ev); setView('detail'); }}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '18px 20px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      🏁
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{ev.name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{ev.date}</div>
                      {ev.accessCode && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: 'var(--accent-bright)',
                            background: 'var(--accent-glow)',
                            border: '1px solid rgba(124,58,237,0.2)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            display: 'inline-block',
                          }}
                        >
                          {ev.accessCode}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span
                      style={{
                        background: status.bg,
                        color: status.color,
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        padding: '4px 10px',
                      }}
                    >
                      {status.label}
                    </span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
