import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  Check,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Link,
  Radio,
  Settings,
  Shield,
  Smartphone,
  Volume2,
  Zap,
} from 'lucide-react';
import { api, inr } from '../lib/api';
import { localMode, logout } from '../lib/auth';
type Page = 'overview' | 'setup' | 'messages';
export default function Dashboard() {
  const [data, setData] = useState<any>(),
    [page, setPage] = useState<Page>('overview'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [overlay, setOverlay] = useState(''),
    [pair, setPair] = useState(''),
    [name, setName] = useState(''),
    [upi, setUpi] = useState('');
  const refresh = async () => {
    const d = await api('/v1/dashboard');
    setData(d);
    return d;
  };
  useEffect(() => {
    refresh()
      .then((d) => {
        setName(d.profile.displayName);
        setUpi(d.profile.upiId);
      })
      .catch((e) => setError(e.message));
    const t = setInterval(() => refresh().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const test = () =>
    act(async () => {
      await api('/v1/dashboard/test-alert', 'POST', {});
      setNotice('Test alert sent to your connected OBS source.');
    });
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied to clipboard.');
    } catch {
      setError('Clipboard unavailable. Select and copy the URL.');
    }
  };
  const pending = data?.messages.filter((m: any) => m.status === 'pending') || [],
    observations = data?.observations || [];
  const total = observations.reduce((sum: number, o: any) => sum + o.amountPaise, 0),
    connected = data?.connections > 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <AudioLines size={22} />
          </span>
          TipRelay<span className="beta">BETA</span>
        </a>
        <div className="workspace-label">CREATOR WORKSPACE</div>
        <nav>
          <button
            className={page === 'overview' ? 'active' : ''}
            onClick={() => setPage('overview')}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <button
            className={page === 'messages' ? 'active' : ''}
            onClick={() => setPage('messages')}
          >
            <AudioLines size={18} />
            Message review <span className="count">{pending.length}</span>
          </button>
          <button className={page === 'setup' ? 'active' : ''} onClick={() => setPage('setup')}>
            <Settings size={18} />
            Stream setup
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="direct-note">
            <Shield size={20} />
            <b>Direct to you.</b>
            <p>Tips go straight to your UPI account. Your support, your money.</p>
          </div>
          <div className="profile-chip">
            <div className="avatar">{(data?.profile.displayName || 'C').slice(0, 1)}</div>
            <div>
              <b>{data?.profile.displayName || 'Your channel'}</b>
              <small>{localMode ? 'Local workspace' : 'Creator account'}</small>
            </div>
            {
              <button onClick={logout} title="Sign out">
                ↗
              </button>
            }
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Workspace{' '}
            <span className="breadcrumb">
              /{' '}
              {page === 'overview'
                ? 'Overview'
                : page === 'setup'
                  ? 'Stream setup'
                  : 'Message review'}
            </span>
          </span>
          <span className="environment">
            <span className="dot" />
            {localMode ? 'Local development' : 'Creator workspace'}
          </span>
          <button className="button" onClick={logout}>
            Sign out
          </button>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR STREAM, SUPPORTED</div>
              <h1>
                {page === 'overview'
                  ? 'Make every tip a moment.'
                  : page === 'setup'
                    ? 'Let’s connect your stream.'
                    : 'Give good words a voice.'}
              </h1>
              <p>
                {page === 'overview'
                  ? 'Your tips, messages, and stream connection. All in one place.'
                  : page === 'setup'
                    ? 'Three connections. One seamless on-stream experience.'
                    : 'Review supporter messages before they are read aloud on stream.'}
              </p>
            </div>
            <button className="button primary" disabled={busy} onClick={test}>
              <Volume2 size={17} />
              Test alert
            </button>
          </div>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {page === 'overview' && (
            <>
              <section className="hero-panel">
                <div>
                  <span className="status-pill">
                    <span className="dot" />
                    {connected ? 'OBS CONNECTED' : 'READY WHEN YOU ARE'}
                  </span>
                  <h2>
                    A little support.
                    <br />A big moment on stream.
                  </h2>
                  <p>
                    Connect your phone and OBS to turn incoming UPI
                    <br className="desktop" /> notifications into real-time celebrations.
                  </p>
                  <button className="button dark" onClick={() => setPage('setup')}>
                    {connected ? 'Manage stream setup' : 'Finish your setup'}
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="floating-label">
                    DIRECT UPI <span>↗</span>
                  </div>
                  <div className="sample-alert">
                    <span className="sample-icon">↗</span>
                    <small>SUPPORT RECEIVED</small>
                    <strong>
                      ₹100<span>.00</span>
                    </strong>
                    <span className="sample-caption">A little love for the stream ✦</span>
                    <div className="wave">▂ ▅ ▃ ▇ ▄ ▂ ▆ ▅ ▃ ▇ ▃ ▂ ▄ ▆ ▂</div>
                  </div>
                  <div className="demo-label">ALERT PREVIEW</div>
                  <i className="spark s1">✦</i>
                  <i className="spark s2">+</i>
                </div>
              </section>
              <section className="stats">
                <article>
                  <div>
                    <span>Observed tips</span>
                    <Activity size={17} />
                  </div>
                  <h2>{inr(total)}</h2>
                  <p>Last 7 days · notification observations</p>
                </article>
                <article>
                  <div>
                    <span>Incoming credits</span>
                    <Zap size={17} />
                  </div>
                  <h2>{observations.length.toString().padStart(2, '0')}</h2>
                  <p>Unique observations from your phone</p>
                </article>
                <article>
                  <div>
                    <span>Messages to review</span>
                    <AudioLines size={17} />
                  </div>
                  <h2>{pending.length.toString().padStart(2, '0')}</h2>
                  <button className="text-button" onClick={() => setPage('messages')}>
                    Open review queue ↗
                  </button>
                </article>
              </section>
              <div className="content-grid">
                <section className="panel">
                  <div className="section-title">
                    <h3>Recent activity</h3>
                    <span className="muted">Last 7 days</span>
                  </div>
                  {observations.length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">
                        <Activity size={25} />
                      </div>
                      <h4>Your next moment starts here</h4>
                      <p>
                        Incoming credit observations will appear here
                        <br />
                        once your phone is connected.
                      </p>
                      <button className="text-button" onClick={test}>
                        Try a test alert ↗
                      </button>
                    </div>
                  ) : (
                    <div className="activity-list">
                      {[...observations].reverse().map((o: any) => (
                        <div className="activity-row" key={o.alertId}>
                          <span className="credit-icon">↙</span>
                          <div>
                            <b>Incoming credit observed</b>
                            <small>{new Date(o.observedAt).toLocaleString()}</small>
                          </div>
                          <strong>{inr(o.amountPaise)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="panel-foot">
                    <Shield size={14} />
                    Observations are best-effort. Confirm payments in your bank app.
                  </div>
                </section>
                <section className="panel">
                  <div className="section-title">
                    <h3>Stream connections</h3>
                    <Radio size={17} />
                  </div>
                  <div className="connection">
                    <div className="connection-icon">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <b>Android companion</b>
                      <small>
                        {data?.devices.some((d: any) => !d.revoked)
                          ? 'Paired · check phone diagnostics'
                          : 'Waiting for your phone'}
                      </small>
                    </div>
                    <span
                      className={
                        data?.devices.some((d: any) => !d.revoked) ? 'tiny-pill good' : 'tiny-pill'
                      }
                    >
                      {data?.devices.some((d: any) => !d.revoked) ? 'Paired' : 'Setup'}
                    </span>
                  </div>
                  <div className="connection">
                    <div className="connection-icon">
                      <Radio size={20} />
                    </div>
                    <div>
                      <b>OBS Browser Source</b>
                      <small>
                        {connected ? 'Ready to receive alerts' : 'Add your private source URL'}
                      </small>
                    </div>
                    <span className={connected ? 'tiny-pill good' : 'tiny-pill'}>
                      {connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <button className="button outline full" onClick={() => setPage('setup')}>
                    Manage connections <ArrowUpRight size={15} />
                  </button>
                  <div className="tip-link">
                    <Link size={17} />
                    <div>
                      <b>Your public tip page</b>
                      <a
                        href={`/tip/${data?.profile.slug || 'demo'}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open tip page <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === 'setup' && (
            <div className="setup-grid">
              <section className="panel setup-card">
                <span className="step">01</span>
                <h2>Your payment details</h2>
                <p>
                  Fans pay this UPI address directly. Use a dedicated creator UPI identity.
                  Notifications may not identify the receiving account.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                      await api('/v1/dashboard/settings', 'PUT', { displayName: name, upiId: upi });
                      setNotice('Payment details saved.');
                    });
                  }}
                >
                  <label>
                    Channel name
                    <input
                      required
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Your UPI ID
                    <input
                      required
                      placeholder="yourchannel@bank"
                      value={upi}
                      onChange={(e) => setUpi(e.target.value)}
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    Save details <Check size={16} />
                  </button>
                </form>
              </section>
              <section className="panel setup-card">
                <span className="step">02</span>
                <h2>Pair your Android</h2>
                <p>
                  Open the companion app and enter a single-use code. It expires in five minutes.
                  Grant notification access after reviewing the privacy explanation.
                </p>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const r = await api('/v1/dashboard/pairing-code', 'POST', {});
                      setPair(r.code);
                    })
                  }
                >
                  Generate pairing code
                </button>
                {pair && <div className="secret-code">{pair}</div>}
                {data?.devices.map((d: any) => (
                  <div className="device-row" key={d.deviceId}>
                    <div>
                      <small>
                        {d.deviceId.slice(0, 8)} · {d.revoked ? 'Revoked' : 'Paired'}
                      </small>
                      <small>
                        Last upload{' '}
                        {d.lastSync ? new Date(d.lastSync * 1000).toLocaleString() : 'never'}
                      </small>
                    </div>
                    {!d.revoked && (
                      <button
                        className="text-button"
                        onClick={() =>
                          act(async () => {
                            await api(`/v1/dashboard/devices/${d.deviceId}/revoke`, 'POST', {});
                          })
                        }
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </section>
              <section className="panel setup-card">
                <span className="step">03</span>
                <h2>Add your OBS source</h2>
                <p>
                  Create a private URL, add a Browser Source in OBS, and enable “Control audio via
                  OBS.” Rotating the URL revokes the previous one.
                </p>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const r = await api('/v1/dashboard/overlay/rotate', 'POST', {});
                      setOverlay(`${location.origin}/overlay#${r.secret}`);
                    })
                  }
                >
                  Create / rotate source URL
                </button>
                {overlay && (
                  <>
                    <label>
                      Private source URL
                      <input readOnly value={overlay} />
                    </label>
                    <div className="button-row">
                      <button className="button dark" onClick={() => copy(overlay)}>
                        <Copy size={15} />
                        Copy URL
                      </button>
                      <a className="button outline" href={overlay} target="_blank" rel="noreferrer">
                        Open preview ↗
                      </a>
                    </div>
                  </>
                )}
                <p className="muted">Keep this URL private. It is shown only when created.</p>
              </section>
              <section className="panel setup-card">
                <span className="step">04</span>
                <h2>Hear it for yourself</h2>
                <p>
                  Keep your Browser Source active. Record a short OBS clip and check the source’s
                  mixer and recording track. Test Alert follows the same delivery path as a credit.
                </p>
                <button className="button primary" disabled={busy} onClick={test}>
                  <Volume2 size={17} />
                  Send test alert
                </button>
                <div className="safety-note">
                  <Shield size={17} />
                  Piper is optional for alerts. Chimes continue when speech is unavailable.
                </div>
              </section>
            </div>
          )}
          {page === 'messages' && (
            <section className="panel message-panel">
              <div className="section-title">
                <h3>Supporter messages</h3>
                <span className="tiny-pill">Approval required</span>
              </div>
              <p className="review-notice">
                A matching reference links a message to an observation. It does not prove the
                sender’s identity. Review every message before approving.
              </p>
              {data?.speechAvailable === false && (
                <p className="review-notice" role="status">
                  Speech is temporarily unavailable. Messages remain pending and tip chimes still
                  play.
                </p>
              )}
              {!data?.messages.length && (
                <div className="empty">
                  <AudioLines size={30} />
                  <h4>A good word goes a long way</h4>
                  <p>Messages from your public tip page will arrive here for review.</p>
                </div>
              )}
              {data?.messages.map((m: any) => (
                <MessageRow
                  key={m.messageId}
                  message={m}
                  observations={observations}
                  busy={busy}
                  speechAvailable={data.speechAvailable !== false}
                  action={(action, observationId) =>
                    act(async () => {
                      await api(
                        `/v1/dashboard/messages/${m.messageId}/${action}`,
                        'POST',
                        observationId ? { observationId } : {},
                      );
                      setNotice(
                        action === 'approve'
                          ? 'Approved. Speech is queued with a two-minute deadline.'
                          : 'Message rejected.',
                      );
                    })
                  }
                />
              ))}
            </section>
          )}
          <footer>
            Built for the moments that make a stream. <span>Direct UPI · Independent alerts</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
function MessageRow({
  message: m,
  observations,
  busy,
  speechAvailable,
  action,
}: {
  message: any;
  observations: any[];
  busy: boolean;
  speechAvailable: boolean;
  action: (a: string, id?: string) => void;
}) {
  const [selected, setSelected] = useState('');
  return (
    <article className="message-row">
      <div>
        <span className="tiny-pill">{m.status === 'pending' ? m.state : m.status}</span>
        <p className="viewer-text">{m.text}</p>
        <small>{m.reason || 'Reference and amount match one observation'}</small>
      </div>
      {m.status === 'pending' && (
        <div className="message-actions">
          {m.state !== 'matched' && (
            <select
              aria-label="Manually reviewed observation"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select an observation after review</option>
              {observations.map((o) => (
                <option key={o.alertId} value={o.alertId}>
                  {inr(o.amountPaise)} · {o.transactionReference || o.alertId.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
          <button
            className="button primary"
            disabled={busy || !speechAvailable || (m.state !== 'matched' && !selected)}
            onClick={() => action('approve', selected || undefined)}
          >
            Approve speech
          </button>
          <button className="text-button" disabled={busy} onClick={() => action('reject')}>
            Reject
          </button>
        </div>
      )}
    </article>
  );
}
