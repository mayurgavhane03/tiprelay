import { useEffect, useState } from 'react';
import {
  alertSchema,
  defaultAlertControls,
  type AlertControls,
  type Alert,
} from '@tiprelay/event-contracts';
import { api, wsBase, inr } from '../lib/api';
import { AlertGate, playAudio } from './player';
export default function Overlay() {
  const [current, setCurrent] = useState<Alert | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    document.body.classList.add('overlay-body');
    const secret = location.hash.slice(1);
    if (!secret) {
      setError('Add your private Browser Source URL from the dashboard.');
      return;
    }
    let disposed = false,
      ws: WebSocket | undefined,
      retryTimer: ReturnType<typeof setTimeout>,
      heartbeat: ReturnType<typeof setInterval>,
      attempt = 0;
    let creditTail = Promise.resolve(),
      speechTail = Promise.resolve();
    let controls = defaultAlertControls;
    let speech = new AbortController();
    let credit = new AbortController();
    const refreshControls = async () => {
      const updated = await api<AlertControls>(
        '/v1/overlay/alert-controls',
        'GET',
        undefined,
        secret,
      );
      if (disposed) return;
      controls = updated;
      if (controls.paused) {
        credit.abort();
        setCurrent(null);
      }
      if (controls.paused || controls.muteSpeech) speech.abort();
    };
    const allowed = (alert: Alert) =>
      !disposed &&
      !controls.paused &&
      (alert.kind !== 'speech' || !controls.muteSpeech) &&
      (alert.amountPaise ?? 0) >= controls.minimumPaise;
    const gate = new AlertGate(localStorage, 'tiprelay-seen:' + secret.slice(0, 12));
    const receive = (alert: Alert) => {
      if (!gate.accept(alert) || !allowed(alert)) return;
      if (alert.kind === 'speech') {
        speechTail = speechTail
          .then(async () => {
            if (!allowed(alert) || !alert.audioUrl) return;
            speech = new AbortController();
            await playAudio(alert.audioUrl, alert.expiresAt, controls.volume, speech.signal);
          })
          .catch(() => {
            /* Chime has its own queue. */
          });
      } else {
        creditTail = creditTail
          .then(async () => {
            if (!allowed(alert) || alert.expiresAt <= Date.now() / 1000) return;
            credit = new AbortController();
            setCurrent(alert);
            const display = new Promise((resolve) =>
              setTimeout(resolve, controls.displaySeconds * 1000),
            );
            try {
              await playAudio('/chime.wav', alert.expiresAt, controls.volume, credit.signal);
            } catch {
              setError('Audio blocked. Enable Browser Source audio in OBS.');
            }
            await display;
            setCurrent(null);
          })
          .catch(() => {});
      }
    };
    const connect = async () => {
      try {
        await refreshControls();
        if (disposed) return;
        const { ticket } = await api<{ ticket: string }>('/v1/overlay/session', 'POST', {}, secret);
        if (disposed) return;
        ws = new WebSocket(`${wsBase}?ticket=${encodeURIComponent(ticket)}`);
        ws.onopen = () => {
          attempt = 0;
          setError('');
          ws?.send(JSON.stringify({ action: 'ready' }));
          heartbeat = setInterval(
            () => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ action: 'ready' })),
            25000,
          );
        };
        ws.onmessage = (e) => {
          try {
            receive(alertSchema.parse(JSON.parse(e.data)));
          } catch {
            /* Reject malformed events. */
          }
        };
        ws.onclose = () => {
          clearInterval(heartbeat);
          schedule();
        };
        ws.onerror = () => ws?.close();
      } catch {
        schedule();
      }
    };
    const schedule = () => {
      if (!disposed)
        retryTimer = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) + Math.random() * 700,
        );
    };
    const settingsPoll = setInterval(() => refreshControls().catch(() => {}), 5000);
    void connect();
    return () => {
      disposed = true;
      clearInterval(settingsPoll);
      credit.abort();
      speech.abort();
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      ws?.close();
      document.body.classList.remove('overlay-body');
    };
  }, []);
  return (
    <div className="overlay-stage">
      {current && (
        <div className="live-alert">
          <div className="alert-symbol">↗</div>
          <div>
            <span>{current.kind === 'test' ? 'TEST ALERT' : 'A LITTLE LOVE FOR THE STREAM'}</span>
            <h1>{inr(current.amountPaise || 0)}</h1>
            <p>Thanks for the support!</p>
          </div>
        </div>
      )}
      {error && new URLSearchParams(location.search).get('debug') === '1' && (
        <small className="overlay-error">{error}</small>
      )}
    </div>
  );
}
