import type { APIRoute } from 'astro';
import { getAllBlogs, createBlog } from '../../../lib/store';
import { isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const blogs = await getAllBlogs();
    return new Response(JSON.stringify({ success: true, blogs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed fetching blogs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    if (!body.title || !body.title.trim()) {
      return new Response(JSON.stringify({ error: 'Blog title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const title = body.title.trim();
    const slug = body.slug ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const category = body.category ? body.category.trim() : 'General';
    const date = body.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const readTime = body.readTime ? body.readTime.trim() : '4 min read';
    const excerpt = body.excerpt ? body.excerpt.trim() : '';
    const content = body.content ? body.content.trim() : '';
    const image = body.image ? body.image.trim() : '/images/products/meat-pads.jpg';
    const is_published = body.is_published !== undefined ? Boolean(body.is_published) : true;
    const author = body.author ? body.author.trim() : 'Admin';

    const newBlog = await createBlog({
      title,
      slug,
      category,
      date,
      readTime,
      excerpt,
      content,
      image,
      is_published,
      author
    });

    return new Response(JSON.stringify({ success: true, blog: newBlog }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed creating blog' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
