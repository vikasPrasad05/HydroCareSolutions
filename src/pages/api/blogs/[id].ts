import type { APIRoute } from 'astro';
import { updateBlog, deleteBlog, getBlogById } from '../../../lib/store';
import { isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Blog ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const existing = await getBlogById(id);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.slug !== undefined) updates.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (body.category !== undefined) updates.category = body.category.trim();
    if (body.date !== undefined) updates.date = body.date;
    if (body.readTime !== undefined) updates.readTime = body.readTime.trim();
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt.trim();
    if (body.content !== undefined) updates.content = body.content.trim();
    if (body.image !== undefined) updates.image = body.image.trim();
    if (body.is_published !== undefined) updates.is_published = Boolean(body.is_published);
    if (body.author !== undefined) updates.author = body.author.trim();

    const updated = await updateBlog(id, updates);
    return new Response(JSON.stringify({ success: true, blog: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed updating blog' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Blog ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const success = await deleteBlog(id);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Blog deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed deleting blog' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
