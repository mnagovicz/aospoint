import { useState } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { ADMIN_KEY } from '../../config';
import Dashboard from './Dashboard';

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (password === ADMIN_KEY) {
      setAuthenticated(true);
    } else {
      setError('Nesprávné heslo');
    }
  };

  if (!authenticated) {
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
              <Lock size={32} color="#8b5cf6" />
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              AosPoint Admin
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 14 }}>
              Administrace pořadatele
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
                  Heslo
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
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

              <button onClick={handleLogin} className="btn-primary" style={{ minHeight: 52 }}>
                PŘIHLÁSIT SE
              </button>
            </div>
          </div>

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
              onClick={() => location.href = '/'}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <LogOut size={14} />
              Závodník
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
