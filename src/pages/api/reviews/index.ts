import type { APIRoute } from 'astro';
import { getAllReviews } from '../../../lib/store';
import { isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const reviews = await getAllReviews();
    return new Response(JSON.stringify({ success: true, reviews }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error fetching reviews' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
