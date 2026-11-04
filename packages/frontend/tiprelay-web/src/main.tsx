import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { callback, login, localMode, accessToken } from './lib/auth';
import './styles.css';
const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const Overlay = lazy(() => import('./stream-overlay/Overlay'));
const TipPage = lazy(() => import('./tip-page/TipPage'));
function App() {
  const [error, setError] = useState('');
  useEffect(() => {
    if (location.pathname === '/auth/callback') void callback().catch((e) => setError(e.message));
  }, []);
  if (location.pathname === '/overlay') return <Overlay />;
  if (location.pathname.startsWith('/tip/'))
    return <TipPage slug={location.pathname.split('/')[2]} />;
  if (location.pathname === '/auth/callback')
    return <div className="login-card">{error || 'Completing sign-in…'}</div>;
  if (!localMode && !accessToken())
    return (
      <div className="login-card">
        <div className="eyebrow">TIPRELAY FOR CREATORS</div>
        <h1>
          Your stream,
          <br />
          supported.
        </h1>
        <p>Direct UPI tips. Real-time moments.</p>
        <button
          className="button primary"
          onClick={() => login().catch((e) => setError(e.message))}
        >
          Sign in securely ↗
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return <Dashboard />;
}
createRoot(document.getElementById('root')!).render(
  <Suspense fallback={<div className="loading">TipRelay</div>}>
    <App />
  </Suspense>,
);
