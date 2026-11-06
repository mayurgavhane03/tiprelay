import { useState } from 'react';
import {
  supportDate,
  supportGoalSchema,
  type SupportGoal,
  type SupportGoalProgress,
} from '@tiprelay/event-contracts';
import { api, inr } from '../lib/api';
import { GoalBar } from '../stream-overlay/GoalOverlay';

function initialGoal(): SupportGoal {
  const today = supportDate(Date.now());
  const [year, month] = today.split('-').map(Number);
  return {
    title: 'Monthly support goal',
    targetPaise: 300_000,
    startDate: today.slice(0, 7) + '-01',
    endDate: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    visible: true,
    style: {
      fill: '#22c55e',
      track: '#283344',
      text: '#ffffff',
      background: '#101827',
      backgroundOpacity: 0,
      width: 600,
      height: 20,
      radius: 12,
      padding: 12,
      fontSize: 22,
      font: 'sans-serif',
      alignment: 'center',
      showTitle: true,
      showAmounts: true,
      showPercent: true,
    },
  };
}

const colors = [
  ['fill', 'Fill'],
  ['track', 'Track'],
  ['text', 'Text'],
  ['background', 'Background'],
] as const;
const sizes = [
  ['backgroundOpacity', 'Background opacity (%)', 0, 100],
  ['width', 'Width (px)', 160, 1920],
  ['height', 'Bar height (px)', 4, 100],
  ['radius', 'Corner radius (px)', 0, 60],
  ['padding', 'Padding (px)', 0, 48],
  ['fontSize', 'Font size (px)', 10, 64],
] as const;
const labels = [
  ['showTitle', 'Show title'],
  ['showAmounts', 'Show amounts'],
  ['showPercent', 'Show percentage'],
] as const;

export default function SupportGoalEditor({
  saved,
  busy,
  act,
}: {
  saved: SupportGoalProgress | null;
  busy: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [goal, setGoal] = useState(() => saved?.goal ?? initialGoal());
  const [target, setTarget] = useState(() => String(goal.targetPaise / 100));
  const [error, setError] = useState('');
  const [sample, setSample] = useState(false);
  const updateStyle = <K extends keyof SupportGoal['style']>(
    key: K,
    value: SupportGoal['style'][K],
  ) => setGoal((current) => ({ ...current, style: { ...current.style, [key]: value } }));
  const observed = saved?.observedPaise ?? 0;
  const previewAmount =
    saved?.goal.startDate === goal.startDate && saved.goal.endDate === goal.endDate ? observed : 0;
  return (
    <section className="panel setup-card support-goal">
      <h2>Monthly support goal</h2>
      <p>Progress uses observed UPI credits. Dates are inclusive in India Standard Time.</p>
      {saved && (
        <p>
          <strong>
            {inr(observed)} / {inr(saved.goal.targetPaise)}
          </strong>{' '}
          observed for {saved.goal.startDate} through {saved.goal.endDate}.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const result = supportGoalSchema.safeParse({
            ...goal,
            targetPaise: Math.round(Number(target) * 100),
          });
          if (!result.success) {
            setError(result.error.issues[0].message);
            return;
          }
          setError('');
          void act(async () => {
            await api('/v1/dashboard/support-goal', 'PUT', result.data);
          });
        }}
      >
        <div className="goal-fields">
          <label>
            Title
            <input
              required
              maxLength={80}
              value={goal.title}
              onChange={(e) => setGoal({ ...goal, title: e.target.value })}
            />
          </label>
          <label>
            Monthly target (₹)
            <input
              required
              type="number"
              min="1"
              max="100000000"
              step="0.01"
              placeholder="3000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <small>Enter 3000 for a ₹3,000 goal.</small>
          </label>
          <label>
            Start date
            <input
              required
              type="date"
              value={goal.startDate}
              onChange={(e) => setGoal({ ...goal, startDate: e.target.value })}
            />
          </label>
          <label>
            End date
            <input
              required
              type="date"
              min={goal.startDate}
              value={goal.endDate}
              onChange={(e) => setGoal({ ...goal, endDate: e.target.value })}
            />
          </label>
        </div>
        <h3>OBS appearance</h3>
        <div className="goal-fields">
          {colors.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="color"
                value={goal.style[key]}
                onChange={(e) => updateStyle(key, e.target.value)}
              />
            </label>
          ))}
          {sizes.map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                required
                type="number"
                min={min}
                max={max}
                value={goal.style[key]}
                onChange={(e) => updateStyle(key, e.target.valueAsNumber || 0)}
              />
            </label>
          ))}
          <label>
            Font
            <select
              value={goal.style.font}
              onChange={(e) => updateStyle('font', e.target.value as SupportGoal['style']['font'])}
            >
              <option value="sans-serif">Sans serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
            </select>
          </label>
          <label>
            Title alignment
            <select
              value={goal.style.alignment}
              onChange={(e) =>
                updateStyle('alignment', e.target.value as SupportGoal['style']['alignment'])
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
        <div className="goal-toggles">
          {labels.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={goal.style[key]}
                onChange={(e) => updateStyle(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={goal.visible}
              onChange={(e) => setGoal({ ...goal, visible: e.target.checked })}
            />
            Show in OBS
          </label>
        </div>
        <h3>OBS preview</h3>
        <div className="goal-toggles">
          <label>
            <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} />
            Preview with ₹100 in sample support
          </label>
        </div>
        <div className="goal-preview">
          <GoalBar
            goal={{ ...goal, targetPaise: Math.max(100, Math.round(Number(target) * 100) || 0) }}
            observedPaise={sample ? 10_000 : previewAmount}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>
          Save support goal
        </button>
      </form>
      <p>
        Use the goal Browser Source URL in Stream setup. For an existing alert source, change its
        URL path from <code>/overlay</code> to <code>/overlay/goal</code> in a separate source and
        keep the same private fragment.
      </p>
    </section>
  );
}
