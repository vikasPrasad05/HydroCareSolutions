import type { APIRoute } from 'astro';
import { getInquiryByNo, getAllProducts } from '../../../lib/store';

export const prerender = false;

function resolveProductImage(inquiry: any, allProducts: any[]): string {
  const name = (inquiry.product_name || '').toLowerCase();
  const fabric = (inquiry.fabric_choice || '').toLowerCase();
  const message = (inquiry.message || '').toLowerCase();
  const slug = (inquiry.product_slug || '').toLowerCase();

  // If black variant requested
  if (fabric.includes('black') || name.includes('black') || message.includes('black') || slug.includes('black')) {
    return '/images/products/black-beef-steak-pad.jpg';
  }

  // If multi-color or yellow requested
  if (fabric.includes('yellow') || fabric.includes('color') || message.includes('yellow') || slug.includes('color')) {
    return '/images/products/soaker-pads-color-variants.jpg';
  }

  // Match by slug directly
  if (slug) {
    const p = allProducts.find(prod => prod.slug === slug);
    if (p && p.image_url) return p.image_url;
  }

  // Keyword heuristics for product lines
  if (name.includes('ultrasonic') || message.includes('ultrasonic')) {
    return '/images/products/ultrasonic-sealed-pad-macro.jpg';
  }
  if (name.includes('antimicrobial') || name.includes('odor')) {
    return '/images/products/antimicrobial-odor-liner.jpg';
  }
  if (name.includes('poultry') || name.includes('chicken')) {
    return '/images/products/poultry-purge-absorbers.jpg';
  }
  if (name.includes('salmon')) {
    return '/images/products/salmon-export-sheets.jpg';
  }
  if (name.includes('prawn') || name.includes('shrimp')) {
    return '/images/products/prawn-shrimp-soakers.jpg';
  }
  if (name.includes('seafood') || name.includes('marine') || name.includes('fish')) {
    return '/images/products/marine-seafood-pad-macro.jpg';
  }
  if (name.includes('berry') || name.includes('strawberr') || name.includes('punnet') || name.includes('fruit')) {
    return '/images/products/fruit-punnet-cushion-pad.jpg';
  }
  if (name.includes('tomato') || name.includes('grape')) {
    return '/images/products/grape-tomato-soakers.jpg';
  }
  if (name.includes('ice') || name.includes('cold') || name.includes('gel')) {
    return '/images/hero/cold-chain-pads.jpg';
  }
  if (name.includes('roll') || name.includes('perforat')) {
    return '/images/products/continuous-perforated-rolls.jpg';
  }
  if (name.includes('carcass') || name.includes('slaughter')) {
    return '/images/products/carcass-soaker-liners.jpg';
  }

  // Partial match in products catalog
  const matched = allProducts.find(p => p.name && (name.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(name)));
  if (matched && matched.image_url) return matched.image_url;

  return '/images/products/quilted-meat-tray-pad.jpg';
}

function buildTimeline(statusRaw: string, createdAt: string, updatedAt?: string) {
  const status = (statusRaw || 'NEW').toUpperCase();

  // Status mapping to steps (1-based: 1 to 5)
  // Step 1: Received
  // Step 2: Under Technical Review
  // Step 3: Quotation Prepared
  // Step 4: Sample / Production
  // Step 5: Completed
  let currentStep = 1;
  let statusBadge = {
    code: status,
    label: 'Under Technical Review',
    color: '#D97706', // Amber
    bg: '#FEF3C7',
    headline: 'Inquiry Received & Under Engineering Review',
    description: 'We have received your custom order specifications. Our packaging team is evaluating tray fit, SAP absorbency, and wholesale pricing.'
  };

  if (status === 'NEW' || status === 'PENDING') {
    currentStep = 1;
    statusBadge = {
      code: 'PENDING',
      label: 'Pending Review',
      color: '#D97706',
      bg: '#FEF3C7',
      headline: 'Inquiry Queued for Technical Review',
      description: 'Your request is in our priority queue. A packaging engineer will review your dimensions and volume requirement.'
    };
  } else if (status === 'CONTACTED') {
    currentStep = 2;
    statusBadge = {
      code: 'CONTACTED',
      label: 'In Technical Review',
      color: '#2563EB',
      bg: '#DBEAFE',
      headline: 'Technical Review In Progress',
      description: 'Specifications verified. Our sales and production departments are preparing your customized wholesale rate quotation.'
    };
  } else if (status === 'QUOTED') {
    currentStep = 3;
    statusBadge = {
      code: 'QUOTED',
      label: 'Quotation Ready',
      color: '#059669',
      bg: '#D1FAE5',
      headline: 'Quotation Prepared & Sent',
      description: 'Your custom OEM/ODM quotation has been generated! Check your registered WhatsApp or Email for the rate breakdown and turnaround schedule.'
    };
  } else if (status === 'SAMPLING' || status === 'PROCESSING') {
    currentStep = 4;
    statusBadge = {
      code: 'SAMPLING',
      label: 'Sample / Production Active',
      color: '#7C3AED',
      bg: '#EDE9FE',
      headline: 'Sample Box Dispatched / Production Active',
      description: 'Pre-production sample trial box is in transit, or bulk volume production has been queued at our plant.'
    };
  } else if (status === 'CLOSED' || status === 'COMPLETED') {
    currentStep = 5;
    statusBadge = {
      code: 'CLOSED',
      label: 'Completed & Delivered',
      color: '#10B981',
      bg: '#ECFDF5',
      headline: 'Order Completed & Dispatched',
      description: 'Quotation finalized, purchase order fulfilled, and dispatch logistics completed.'
    };
  } else if (status === 'CANCELLED') {
    currentStep = 1;
    statusBadge = {
      code: 'CANCELLED',
      label: 'Cancelled / On Hold',
      color: '#DC2626',
      bg: '#FEE2E2',
      headline: 'Quotation Request On Hold',
      description: 'This quotation request is cancelled or placed on temporary hold. Please reach out to our team to reactivate.'
    };
  }

  const steps = [
    {
      step: 1,
      title: 'Inquiry Received',
      detail: '',
      date: createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Logged',
      isCompleted: currentStep >= 1,
      isActive: currentStep === 1
    },
    {
      step: 2,
      title: 'Technical Review',
      detail: '',
      date: currentStep >= 2 ? (updatedAt ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified') : 'Pending',
      isCompleted: currentStep >= 2,
      isActive: currentStep === 2
    },
    {
      step: 3,
      title: 'Quotation Generated',
      detail: '',
      date: currentStep >= 3 ? (updatedAt ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Generated') : 'In Queue',
      isCompleted: currentStep >= 3,
      isActive: currentStep === 3
    },
    {
      step: 4,
      title: 'Sample Box / Trial Run',
      detail: '',
      date: currentStep >= 4 ? 'Dispatched' : 'Awaiting Quote Approval',
      isCompleted: currentStep >= 4,
      isActive: currentStep === 4
    },
    {
      step: 5,
      title: 'Completed & Shipped',
      detail: '',
      date: currentStep >= 5 ? 'Completed' : 'Final Step',
      isCompleted: currentStep >= 5,
      isActive: currentStep === 5
    }
  ];

  return { currentStep, statusBadge, steps };
}

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('inquiry_no') || url.searchParams.get('id') || url.searchParams.get('no') || '';
  if (!query) {
    return new Response(JSON.stringify({ error: 'Please enter a valid Inquiry or Quotation Tracking ID (e.g. INQ-2026-2236)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const inquiry = await getInquiryByNo(query);
    if (!inquiry) {
      return new Response(JSON.stringify({ 
        found: false, 
        error: `No quotation record found matching reference "${query}". Please check your code or submit a new inquiry.` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const allProducts = await getAllProducts();
    const product_image = resolveProductImage(inquiry, allProducts);
    const { currentStep, statusBadge, steps } = buildTimeline(inquiry.status, inquiry.created_at, inquiry.updated_at);

    return new Response(JSON.stringify({
      success: true,
      found: true,
      inquiry: {
        id: inquiry.id,
        inquiry_no: inquiry.inquiry_no,
        name: inquiry.name,
        company_name: inquiry.company_name,
        phone_masked: inquiry.phone ? inquiry.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '',
        email_masked: inquiry.email ? inquiry.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
        product_name: inquiry.product_name,
        product_image,
        quantity: inquiry.quantity,
        fabric_choice: inquiry.fabric_choice,
        customization_type: inquiry.customization_type,
        message: inquiry.message,
        status: inquiry.status,
        deadline: inquiry.deadline,
        admin_notes: inquiry.admin_notes || '',
        created_at: inquiry.created_at,
        updated_at: inquiry.updated_at
      },
      currentStep,
      statusBadge,
      steps
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error checking quotation status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const query = body.inquiry_no || body.id || body.no || '';
    if (!query) {
      return new Response(JSON.stringify({ error: 'Please provide a valid tracking number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const inquiry = await getInquiryByNo(query);
    if (!inquiry) {
      return new Response(JSON.stringify({ 
        found: false, 
        error: `No quotation record found matching "${query}".` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const allProducts = await getAllProducts();
    const product_image = resolveProductImage(inquiry, allProducts);
    const { currentStep, statusBadge, steps } = buildTimeline(inquiry.status, inquiry.created_at, inquiry.updated_at);

    return new Response(JSON.stringify({
      success: true,
      found: true,
      inquiry: {
        id: inquiry.id,
        inquiry_no: inquiry.inquiry_no,
        name: inquiry.name,
        company_name: inquiry.company_name,
        product_name: inquiry.product_name,
        product_image,
        quantity: inquiry.quantity,
        fabric_choice: inquiry.fabric_choice,
        customization_type: inquiry.customization_type,
        message: inquiry.message,
        status: inquiry.status,
        admin_notes: inquiry.admin_notes || '',
        created_at: inquiry.created_at,
        updated_at: inquiry.updated_at
      },
      currentStep,
      statusBadge,
      steps
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
