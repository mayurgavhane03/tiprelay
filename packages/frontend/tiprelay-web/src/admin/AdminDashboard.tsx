import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { logout } from '../lib/auth';
import './admin.css';
interface User {
  creatorId: string;
  displayName: string;
  role: string;
  status: string;
  joinedAt?: number;
}
export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string>();
  const load = async (after?: string) => {
    const data = await api(
      '/v1/admin/users' + (after ? `?cursor=${encodeURIComponent(after)}` : ''),
    );
    setUsers((old) => (after ? [...old, ...data.users] : data.users));
    setCursor(data.next);
  };
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function act(user: User, action: string) {
    if (
      !window.confirm(
        `${action === 'delete' ? 'Delete this account? Access stops immediately and cannot be restored here. Stored records require the operator purge runbook.' : `${action === 'ban' ? 'Ban' : 'Restore'} this account?`}\n${user.displayName} (${user.creatorId})`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/v1/admin/users/${encodeURIComponent(user.creatorId)}/${action}`, 'POST', {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page">
      <header>
        <a href="/" className="brand">
          TipRelay ↗
        </a>
        <div>
          <a href="/dashboard">Creator dashboard</a>
          <button className="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <span className="eyebrow">ADMINISTRATION</span>
      <h1>Your creator community</h1>
      <p>
        Manage account access. Roles are assigned on the server; new accounts always start as users.
      </p>
      <div className="admin-stats">
        {['active', 'banned', 'deleted'].map((status) => (
          <div key={status}>
            <strong>{users.filter((u) => u.status === status).length}</strong>
            <span>{status} accounts</span>
          </div>
        ))}
      </div>
      <label htmlFor="user-search">Find a creator</label>
      <input
        id="user-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search display name or account ID"
      />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading accounts…</p>
      ) : (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>Creator</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) =>
                  `${u.displayName} ${u.creatorId}`.toLowerCase().includes(query.toLowerCase()),
                )
                .map((u) => (
                  <tr key={u.creatorId}>
                    <td>
                      <strong>{u.displayName}</strong>
                      <small>{u.creatorId}</small>
                    </td>
                    <td>{u.role}</td>
                    <td>{u.status}</td>
                    <td>{u.joinedAt ? new Date(u.joinedAt * 1000).toLocaleDateString() : '—'}</td>
                    <td>
                      {u.role === 'admin' ? (
                        'Protected administrator'
                      ) : u.status === 'deleted' ? (
                        'Deletion requested'
                      ) : (
                        <div className="admin-actions">
                          <button
                            disabled={busy}
                            onClick={() => void act(u, u.status === 'banned' ? 'unban' : 'ban')}
                          >
                            {u.status === 'banned' ? 'Restore' : 'Ban'}
                          </button>
                          <button disabled={busy} onClick={() => void act(u, 'delete')}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {users.length === 0 && <p>No registered accounts yet.</p>}
        </div>
      )}
      {cursor && (
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load(cursor)
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Load more accounts
        </button>
      )}
      <p className="admin-note">
        Counts and search cover loaded accounts. Bans block dashboard, device uploads, public tip
        pages, and new overlay delivery. Deletion also clears the public profile. Use the
        data-deletion runbook to erase retained records and Cognito identity.
      </p>
    </main>
  );
}
