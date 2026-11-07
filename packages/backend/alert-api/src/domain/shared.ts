import { createHash, randomBytes } from 'node:crypto';
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export const tenant = (id: string) => `CREATOR#${id}`;
export const retention = 7 * 86400;
