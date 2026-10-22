import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const sign = (value: string) => createHmac('sha256', process.env.SESSION_SECRET || 'not-configured').update(value).digest('hex');
export async function isAdmin() {
  if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) return false;
  const cookie = (await cookies()).get('os_admin')?.value;
  if (!cookie) return false;
  const [expires, signature] = cookie.split('.');
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
export function createAdminToken() {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET missing');
  const expires = String(Date.now() + 8*60*60*1000);
  return `${expires}.${sign(expires)}`;
}
export function matchesPassword(value: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 20 || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
