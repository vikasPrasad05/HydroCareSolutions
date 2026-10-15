import type { AstroCookies } from 'astro';

const ADMIN_SECRET_KEY = import.meta.env.ADMIN_SECRET_KEY || process.env.ADMIN_SECRET_KEY || 'admin12345';
const COOKIE_NAME = 'absorbent_pads_admin_session';

export function verifyAdminKey(key: string): boolean {
  return key === ADMIN_SECRET_KEY;
}

export function isAdminAuthenticated(cookies: AstroCookies): boolean {
  const session = cookies.get(COOKIE_NAME)?.value;
  return session === 'authorized_admin_session_valid';
}

export function setAdminSession(cookies: AstroCookies): void {
  cookies.set(COOKIE_NAME, 'authorized_admin_session_valid', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
}

export function clearAdminSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, {
    path: '/'
  });
}
