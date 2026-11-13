import crypto from 'node:crypto';
import { env } from './env';

function key() { return Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'hex'); }
export function encrypt(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(x => x.toString('base64url')).join('.');
}
export function decrypt(value: string) {
  const [iv, tag, ct] = value.split('.').map(v => Buffer.from(v, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const rand = (n = 32) => crypto.randomBytes(n).toString('base64url');
