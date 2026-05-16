import { useState } from 'react';
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#1a1a2e' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏁</div>
            <h1 className="text-3xl font-bold" style={{ color: '#4ecca3' }}>AosPoint</h1>
            <p className="text-gray-400 mt-2">Administrace pořadatele</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Heslo pořadatele</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-4 rounded-xl text-white text-lg"
                style={{ background: '#16213e', border: '2px solid #0f3460' }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <button
              onClick={handleLogin}
              className="w-full py-4 rounded-xl font-bold text-lg"
              style={{ background: '#4ecca3', color: '#1a1a2e', minHeight: '64px' }}
            >
              Přihlásit se
            </button>
          </div>

          <div className="text-center mt-6">
            <a
              href="/"
              className="text-sm"
              style={{ color: '#0f3460' }}
              onClick={e => { e.preventDefault(); location.href = '/'; }}
            >
              ← Závodník
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
