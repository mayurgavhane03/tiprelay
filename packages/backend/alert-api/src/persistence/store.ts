export interface Row {
  pk: string;
  sk: string;
  version: number;
  ttl?: number;
  [key: string]: any;
}
export interface Change {
  row: Row;
  expected: number | null;
}
export interface Store {
  get(pk: string, sk: string): Promise<Row | undefined>;
  query(pk: string, prefix?: string): Promise<Row[]>;
  page(pk: string, after?: string): Promise<{ rows: Row[]; next?: string }>;
  transact(changes: Change[]): Promise<void>;
}
export class Conflict extends Error {}
export const next = (row: Row): Change => ({
  row: { ...row, version: row.version + 1 },
  expected: row.version,
});
export const insert = (row: Omit<Row, 'version'> & { pk: string; sk: string }): Change => ({
  row: { ...row, version: 1 },
  expected: null,
});
