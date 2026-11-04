import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Conflict, type Store, type Row, type Change } from './store';
// A single API process owns this store. Atomic rename commits the entire transaction.
export class FileStore implements Store {
  private rows: Record<string, Row>;
  constructor(private path?: string) {
    this.rows = path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  }
  private key(pk: string, sk: string) {
    return JSON.stringify([pk, sk]);
  }
  async get(pk: string, sk: string) {
    return structuredClone(this.rows[this.key(pk, sk)]);
  }
  async query(pk: string, prefix = '') {
    return structuredClone(
      Object.values(this.rows).filter((r) => r.pk === pk && r.sk.startsWith(prefix)),
    );
  }
  async transact(changes: Change[]) {
    const updated = { ...this.rows };
    for (const { row, expected } of changes) {
      const key = this.key(row.pk, row.sk);
      if ((updated[key]?.version ?? null) !== expected) throw new Conflict('Concurrent write');
      updated[key] = structuredClone(row);
    }
    if (this.path) {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path + '.tmp', JSON.stringify(updated));
      renameSync(this.path + '.tmp', this.path);
    }
    this.rows = updated;
  }
  cleanup(now: number) {
    for (const [key, row] of Object.entries(this.rows))
      if (row.ttl && row.ttl < now) delete this.rows[key];
  }
}
