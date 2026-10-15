import type { APIRoute } from 'astro';
import { createInquiry, getAllInquiries, deleteAllInquiries } from '../../../lib/store';
import { isAdminAuthenticated } from '../../../lib/auth';

export const prerender = false;

export const DELETE: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await deleteAllInquiries();
    return new Response(JSON.stringify({ success: true, message: 'All inquiries deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to delete inquiries' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const inquiries = await getAllInquiries();
    return new Response(JSON.stringify({ success: true, inquiries }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    // Validation
    const { name, company_name, email, phone, product_name, quantity } = body;
    if (!name || !company_name || !email || !phone || !product_name || !quantity) {
      return new Response(JSON.stringify({ error: 'Please fill all required inquiry fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const inquiry = await createInquiry({
      name: String(name).trim(),
      company_name: String(company_name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      product_slug: body.product_slug ? String(body.product_slug).trim() : undefined,
      product_name: String(product_name).trim(),
      quantity: Number(quantity) || 100,
      target_timeline: body.target_timeline ? String(body.target_timeline).trim() : 'Standard (2-3 Weeks)',
      fabric_choice: body.fabric_choice ? String(body.fabric_choice).trim() : undefined,
      customization_type: body.customization_type ? String(body.customization_type).trim() : undefined,
      message: body.message ? String(body.message).trim() : ''
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Inquiry received successfully! Our sales team will get back to you shortly.',
      inquiry 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error processing inquiry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
