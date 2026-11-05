import { useState } from 'react';
import { ArrowUpRight, BellRing, Smartphone, ShieldCheck, Radio, Download } from 'lucide-react';
import { hasSession, localMode, login } from '../lib/auth';
import './landing.css';

export default function Landing() {
  const [error, setError] = useState('');
  const configuredDownload = import.meta.env.VITE_ANDROID_DOWNLOAD_URL || '';
  const download = /^https:\/\//.test(configuredDownload) ? configuredDownload : '';
  const signIn = () => login().catch((e: Error) => setError(e.message));
  return (
    <div className="marketing">
      <nav className="marketing-nav" aria-label="Main navigation">
        <a href="/" className="wordmark">
          TipRelay <ArrowUpRight size={24} />
        </a>
        <div>
          <a href="#how-it-works">How it works</a>
          <a href="#android">Android app</a>
          {hasSession() ? (
            <a className="button primary" href="/dashboard">
              Your dashboard ↗
            </a>
          ) : (
            <button className="button primary" onClick={signIn}>
              Continue with Google
            </button>
          )}
        </div>
      </nav>
      <main>
        <section className="marketing-hero">
          <div>
            <span className="eyebrow">MADE FOR INDIAN LIVESTREAMERS</span>
            <h1>
              A little support.
              <br />A big <em>stream moment.</em>
            </h1>
            <p>
              Let your community tip you directly with UPI. Turn incoming payment notifications into
              live OBS alerts, a familiar chime, and messages you choose to read aloud.
            </p>
            <div className="hero-actions">
              <button className="button primary" onClick={signIn}>
                Continue with Google <ArrowUpRight size={18} />
              </button>
              <a className="button" href="#how-it-works">
                See how it works
              </a>
            </div>
            <span className="hero-note">Your UPI account. Your community. Your control.</span>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="stream-demo" aria-label="Illustration of a sample stream alert">
            <div className="demo-top">
              <span>
                <i /> STREAM PREVIEW
              </span>
              <Radio size={20} />
            </div>
            <div className="demo-scene">
              <div className="demo-orbit" />
              <span>
                Make every
                <br />
                <strong>thank you count.</strong>
              </span>
            </div>
            <div className="demo-alert">
              <div className="demo-bell">
                <BellRing />
              </div>
              <div>
                <small>SAMPLE TIP ALERT</small>
                <strong>₹100 of community love</strong>
                <span>“Keep doing your thing!”</span>
              </div>
              <span className="demo-spark">✦</span>
            </div>
            <p>Illustration · messages play only after approval</p>
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <span className="eyebrow">FROM THEIR PHONE TO YOUR STREAM</span>
          <h2>Set it up. Make it yours. Go live.</h2>
          <div className="feature-grid">
            {[
              {
                icon: ShieldCheck,
                title: '01 · Connect your UPI',
                text: 'Sign in with Google and set your own UPI details. Fans pay you directly in their usual payment app.',
              },
              {
                icon: Smartphone,
                title: '02 · Pair your Android',
                text: 'Link the companion with a one-use code. It observes supported incoming-credit notifications without uploading raw notifications or payer details.',
              },
              {
                icon: Radio,
                title: '03 · Add it to OBS',
                text: 'Paste your private Browser Source link into OBS. Test the chime, review supporter messages, and make the next tip a moment.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="android" className="android-section">
          <div>
            <span className="eyebrow">YOUR STREAM’S POCKET COMPANION</span>
            <h2>
              One small app.
              <br />A closer connection.
            </h2>
            <p>
              Pair your Android phone, enable notification access, and check your sync status. The
              native listener runs independently of the app screen.
            </p>
            {download ? (
              <a className="button primary" href={download} rel="noopener noreferrer">
                <Download size={18} /> Download for Android
              </a>
            ) : (
              <button className="button primary" disabled>
                <Download size={18} /> Android download coming soon
              </button>
            )}
            <p className="download-note">
              Android 8.0 or newer. A signed release download will appear here when device
              validation is complete.
            </p>
          </div>
          <div className="privacy-card">
            <ShieldCheck size={34} />
            <h3>Built around your control.</h3>
            <p>
              Payments go straight to your account. TipRelay never holds funds or handles payouts.
            </p>
            <p>
              Phone alerts are best-effort observations, not bank confirmation. Always check
              settlement in your UPI or bank app.
            </p>
            <p>
              Viewer messages stay pending until you approve them. Speech delays never hold up the
              chime.
            </p>
          </div>
        </section>
      </main>
      <footer>
        <a className="wordmark" href="/">
          TipRelay ↗
        </a>
        <span>Direct support. Shared moments.</span>
        {localMode && (
          <button
            className="dev-entry"
            onClick={() => {
              sessionStorage.setItem('local_session', 'demo');
              location.assign('/dashboard');
            }}
          >
            Open local development demo
          </button>
        )}
      </footer>
    </div>
  );
}
