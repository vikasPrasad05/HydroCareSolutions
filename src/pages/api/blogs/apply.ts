import type { APIRoute } from 'astro';
import { saveAllBlogs, getAllBlogs } from '../../../lib/store';
import { isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let blogs = body.blogs;
    if (Array.isArray(blogs)) {
      await saveAllBlogs(blogs);
    } else {
      blogs = await getAllBlogs();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'All changes successfully applied to the website!',
      count: blogs.length,
      updated_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to apply changes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
