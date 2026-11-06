import { useState } from 'react';
import { type AlertControls } from '@tiprelay/event-contracts';
import { api } from '../lib/api';

export default function AlertControlsEditor({
  saved,
  busy,
  act,
}: {
  saved: AlertControls;
  busy: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(saved);
  return (
    <section className="panel setup-card alert-controls">
      <h3>Alert controls</h3>
      <p>Saved changes reach OBS within a few seconds.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void act(async () => {
            await api('/v1/dashboard/alert-controls', 'PUT', draft);
          });
        }}
      >
        <label className="alert-toggle">
          <input
            type="checkbox"
            checked={draft.paused}
            onChange={(e) => setDraft({ ...draft, paused: e.target.checked })}
          />
          Pause alerts
        </label>
        <label className="alert-toggle">
          <input
            type="checkbox"
            checked={draft.muteSpeech}
            onChange={(e) => setDraft({ ...draft, muteSpeech: e.target.checked })}
          />
          Mute speech
        </label>
        <label>
          Minimum amount (₹)
          <input
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            value={draft.minimumPaise / 100}
            onChange={(e) =>
              setDraft({ ...draft, minimumPaise: Math.round(Number(e.target.value) * 100) })
            }
          />
        </label>
        <label>
          Volume ({draft.volume}%)
          <input
            type="range"
            min="0"
            max="100"
            value={draft.volume}
            onChange={(e) => setDraft({ ...draft, volume: Number(e.target.value) })}
          />
        </label>
        <label>
          Display time (seconds)
          <input
            type="number"
            min="1"
            max="30"
            required
            value={draft.displaySeconds}
            onChange={(e) => setDraft({ ...draft, displaySeconds: Number(e.target.value) })}
          />
        </label>
        <button className="button primary" disabled={busy}>
          Save alert controls
        </button>
      </form>
    </section>
  );
}
