import type { APIRoute } from 'astro';
import { getSiteSettings, saveSiteSettings } from '../../lib/store';
import { isAdminAuthenticated } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const settings = await getSiteSettings();
    return new Response(JSON.stringify({ ok: true, settings }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const updated = await saveSiteSettings(body);
    return new Response(JSON.stringify({ ok: true, settings: updated, message: 'Settings saved successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
