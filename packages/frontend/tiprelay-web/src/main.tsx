import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { callback, hasSession, logout } from './lib/auth';
import { api } from './lib/api';
import Landing from './landing/Landing';
import './styles.css';
const Dashboard = lazy(() => import('./dashboard/Dashboard'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));
const Overlay = lazy(() => import('./stream-overlay/Overlay'));
const TipPage = lazy(() => import('./tip-page/TipPage'));
function AccountGate() {
  const [account, setAccount] = useState<{ role: string }>(),
    [error, setError] = useState('');
  useEffect(() => {
    void api('/v1/account')
      .then(setAccount)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="login-card">
        <h1>Account unavailable</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={logout}>
          Return to sign in
        </button>
      </div>
    );
  if (!account) return <div className="loading">Checking your account…</div>;
  if (location.pathname === '/admin')
    return account.role === 'admin' ? (
      <AdminDashboard />
    ) : (
      <div className="login-card">
        <h1>Administrator access required</h1>
        <a href="/dashboard">Go to your dashboard</a>
      </div>
    );
  return (
    <>
      {account.role === 'admin' && (
        <nav className="account-nav">
          <a href="/admin">Open admin dashboard ↗</a>
        </nav>
      )}
      <Dashboard />
    </>
  );
}
function App() {
  const [error, setError] = useState('');
  useEffect(() => {
    if (location.pathname === '/auth/callback') void callback().catch((e) => setError(e.message));
  }, []);
  if (location.pathname === '/overlay') return <Overlay />;
  if (location.pathname.startsWith('/tip/'))
    return <TipPage slug={location.pathname.split('/')[2]} />;
  if (location.pathname === '/auth/callback')
    return (
      <div className="login-card">
        {error || 'Completing sign-in…'}
        {error && (
          <p>
            <a href="/">Return home</a>
          </p>
        )}
      </div>
    );
  if (!['/dashboard', '/admin'].includes(location.pathname) || !hasSession()) return <Landing />;
  return <AccountGate />;
}
if (import.meta.env.DEV && location.hostname === '127.0.0.1') {
  location.replace(
    `http://localhost:${location.port}${location.pathname}${location.search}${location.hash}`,
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <Suspense
      fallback={location.pathname === '/overlay' ? null : <div className="loading">TipRelay</div>}
    >
      <App />
    </Suspense>,
  );
}
