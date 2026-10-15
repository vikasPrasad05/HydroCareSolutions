import type { APIRoute } from 'astro';
import { getOffer, saveOffer } from '../../lib/store';
import { isAdminAuthenticated } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  const offer = await getOffer();
  return new Response(JSON.stringify({ success: true, offer }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await request.json();
    const updated = await saveOffer(data);
    return new Response(JSON.stringify({ success: true, offer: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error saving offer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
