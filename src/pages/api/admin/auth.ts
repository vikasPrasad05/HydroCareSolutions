import type { APIRoute } from 'astro';
import { verifyAdminKey, setAdminSession, clearAdminSession, isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { key } = await request.json();

    if (!key || !verifyAdminKey(String(key).trim())) {
      return new Response(JSON.stringify({ error: 'Invalid admin secret key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    setAdminSession(cookies);

    return new Response(JSON.stringify({ success: true, message: 'Authenticated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Authentication error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  clearAdminSession(cookies);
  return new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const GET: APIRoute = async ({ cookies }) => {
  const isAuth = isAdminAuthenticated(cookies);
  return new Response(JSON.stringify({ authenticated: isAuth }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
