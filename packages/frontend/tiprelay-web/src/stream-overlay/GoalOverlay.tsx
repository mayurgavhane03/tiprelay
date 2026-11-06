import { useEffect, useState } from 'react';
import type { SupportGoalProgress } from '@tiprelay/event-contracts';
import { api, inr } from '../lib/api';

export function GoalBar({ goal, observedPaise }: SupportGoalProgress) {
  const { style } = goal;
  const progress = (observedPaise / goal.targetPaise) * 100;
  const percentage = Math.floor(progress);
  const hasLabels = style.showAmounts || style.showTitle || style.showPercent;
  return (
    <div
      style={{
        width: style.width,
        maxWidth: '100%',
        padding: style.padding,
        borderRadius: style.radius,
        color: style.text,
        fontFamily: style.font,
        fontSize: style.fontSize,
        textAlign: style.alignment,
        backgroundColor:
          style.background +
          Math.round(style.backgroundOpacity * 2.55)
            .toString(16)
            .padStart(2, '0'),
        overflowWrap: 'anywhere',
      }}
    >
      {hasLabels && (
        <div className="goal-bar-labels">
          {style.showAmounts && (
            <strong className="goal-bar-amount">
              {inr(observedPaise)} /{' '}
              <span style={{ color: style.fill }}>{inr(goal.targetPaise)}</span>
            </strong>
          )}
          {style.showTitle && <strong className="goal-bar-title">{goal.title}</strong>}
          {style.showPercent && <strong className="goal-bar-percent">{percentage}%</strong>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={goal.title}
        aria-valuenow={Math.min(percentage, 100)}
        style={{
          marginTop: hasLabels ? 6 : 0,
          height: style.height,
          background: style.track,
          borderRadius: style.radius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, progress)}%`,
            background: style.fill,
            borderRadius: style.radius,
            transition: 'width 400ms ease',
          }}
        />
      </div>
    </div>
  );
}

export default function GoalOverlay() {
  const [progress, setProgress] = useState<SupportGoalProgress | null>(null);
  useEffect(() => {
    document.documentElement.classList.add('overlay-document');
    const token = location.hash.slice(1);
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await api<SupportGoalProgress | null>(
          '/v1/overlay/support-goal',
          'GET',
          undefined,
          token,
        );
        if (active) setProgress(result);
      } catch {
        if (active) setProgress(null);
      } finally {
        if (active) timer = setTimeout(refresh, 5000);
      }
    }
    if (token) void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      document.documentElement.classList.remove('overlay-document');
    };
  }, []);
  return progress && <GoalBar {...progress} />;
}
