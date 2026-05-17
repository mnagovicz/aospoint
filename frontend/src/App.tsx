import { useState, useEffect } from 'react';
import CompetitorApp from './pages/competitor/CompetitorApp';
import SimpleCompetitorApp from './pages/competitor/SimpleCompetitorApp';
import AdminApp from './pages/admin/AdminApp';

export default function App() {
  const [route, setRoute] = useState<'competitor' | 'simple' | 'admin'>('competitor');

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) setRoute('admin');
    else if (path.startsWith('/simple')) setRoute('simple');
  }, []);

  if (route === 'admin') return <AdminApp />;
  if (route === 'simple') return <SimpleCompetitorApp />;
  return <CompetitorApp />;
}
