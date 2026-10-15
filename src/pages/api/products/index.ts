import type { APIRoute } from 'astro';
import { getAllProducts, createProduct } from '../../../lib/store';
import { isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const products = await getAllProducts();
    return new Response(JSON.stringify({ success: true, products }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error fetching products' }), {
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
    const { name, slug, category, short_description, full_description, image_url, moq, lead_time, gsm_range } = body;

    if (!name || !slug || !category) {
      return new Response(JSON.stringify({ error: 'Name, slug and category are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const created = await createProduct({
      code: body.code || `CAT-0${Math.floor(Math.random() * 90 + 10)}`,
      name,
      slug,
      category,
      short_description: short_description || '',
      full_description: full_description || '',
      image_url: image_url || '/images/products/meat-pads.jpg',
      moq: Number(moq) || 5000,
      lead_time: lead_time || '5-7 Days Dispatch',
      gsm_range: gsm_range || '80ml / pad absorbency',
      fabric_options: Array.isArray(body.fabric_options) ? body.fabric_options : ['Perforated PE Film', 'Cellulose Core', 'SAP Polymers'],
      sizes: Array.isArray(body.sizes) ? body.sizes : ['100 x 150 mm', '120 x 180 mm'],
      colors: Array.isArray(body.colors) ? body.colors : ['Virgin White', 'Food-Grade Black'],
      price_tiers: Array.isArray(body.price_tiers) ? body.price_tiers : [],
      specifications: body.specifications || {},
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      display_order: Number(body.display_order) || 10
    });

    return new Response(JSON.stringify({ success: true, product: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error creating product' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
