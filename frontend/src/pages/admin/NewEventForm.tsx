import { useState } from 'react';
import { Plus } from 'lucide-react';
import { createEvent, type Event } from '../../api';

interface Props {
  onCreated: (ev: Event) => void;
  onCancel: () => void;
}

export default function NewEventForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name) { setError('Zadejte název soutěže'); return; }
    setLoading(true);
    try {
      const ev = await createEvent(name, date);
      if (ev.error) { setError(ev.error); return; }
      onCreated(ev);
    } catch {
      setError('Chyba při vytváření soutěže');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Nová soutěž</h2>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              Název soutěže
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Spring Rally 2026"
              className="input-field"
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
              Datum
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input-field"
              style={{ colorScheme: 'dark' }}
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
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary"
            style={{ minHeight: 52 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? '⟳ Vytvářím...' : <><Plus size={18} /> Vytvořit soutěž</>}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
