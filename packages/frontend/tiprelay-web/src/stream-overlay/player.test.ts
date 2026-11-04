import { it, expect } from 'vitest';
import { AlertGate } from './player';
it('plays duplicate delivery once, including a reload, and drops expired events', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  const alert = {
    alertId: 'a',
    kind: 'credit' as const,
    createdAt: 100,
    expiresAt: 120,
    amountPaise: 10000,
  };
  const gate = new AlertGate(storage, 'creator', () => 110);
  expect(gate.accept(alert)).toBe(true);
  expect(gate.accept(alert)).toBe(false);
  expect(new AlertGate(storage, 'creator', () => 111).accept(alert)).toBe(false);
  expect(gate.accept({ ...alert, alertId: 'b' })).toBe(true);
  expect(gate.accept({ ...alert, alertId: 'old', expiresAt: 100 })).toBe(false);
});
