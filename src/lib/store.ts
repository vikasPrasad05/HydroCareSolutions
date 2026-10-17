import fs from 'node:fs';
import path from 'node:path';
import type { Product, Inquiry, InquiryStatus, Category, Review, SiteSettings, BlogPost } from './types';
import { initialProducts } from './initialData';
import { isD1Configured, executeD1Query } from './d1';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const OFFER_FILE = path.join(DATA_DIR, 'offer.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const BLOGS_FILE = path.join(DATA_DIR, 'blogs.json');

// Ensure data folder exists
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

// ==========================================
// 1. PRODUCTS API (D1 + LOCAL FALLBACK)
// ==========================================
function ensureProductsData() {
  ensureDataDir();
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(initialProducts, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error initializing products file:', err);
  }
}

function readLocalProducts(): Product[] {
  ensureProductsData();
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return initialProducts;
  }
}

function writeLocalProducts(products: Product[]): void {
  ensureProductsData();
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing products.json:', err);
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const localProducts = readLocalProducts();
  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<any>('SELECT * FROM products ORDER BY display_order ASC');
      if (Array.isArray(rows) && rows.length > 0) {
        const d1Map = new Map<string, any>();
        rows.forEach(r => {
          if (r.slug) d1Map.set(r.slug, r);
          if (r.id) d1Map.set(r.id, r);
        });

        // Local products are the ground-truth catalog, merge active status
        const merged = localProducts.map(local => {
          const r = d1Map.get(local.slug) || d1Map.get(local.id);
          if (!r) return local;
          return {
            ...local,
            is_active: r.is_active !== undefined ? Boolean(r.is_active) : local.is_active,
            display_order: Number(r.display_order ?? local.display_order)
          };
        });

        // Any new custom admin-created products in D1
        const localSlugs = new Set(localProducts.map(p => p.slug));
        const extraD1 = rows.filter(r => r.slug && !localSlugs.has(r.slug)).map(r => ({
          id: r.id || `custom-${Date.now()}`,
          code: r.code || r.sku || 'PAD-CUSTOM',
          name: r.name || r.title || 'Custom Product',
          slug: r.slug,
          category: r.category || 'Meat & Poultry Packaging',
          short_description: r.short_description || r.description || '',
          full_description: r.full_description || r.description || '',
          image_url: r.image_url || r.image || '/images/products/meat-pads.jpg',
          moq: Number(r.moq || 5000),
          lead_time: r.lead_time || '3-5 Days Dispatch',
          gsm_range: r.gsm_range || '80ml / pad absorbency',
          is_active: Boolean(r.is_active !== undefined ? r.is_active : true),
          display_order: Number(r.display_order || 99),
          fabric_options: typeof r.fabric_options === 'string' ? JSON.parse(r.fabric_options) : (r.fabric_options || []),
          sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
          colors: typeof r.colors === 'string' ? JSON.parse(r.colors) : (r.colors || []),
          price_tiers: typeof r.price_tiers === 'string' ? JSON.parse(r.price_tiers) : (r.price_tiers || []),
          specifications: typeof r.specifications === 'string' ? JSON.parse(r.specifications) : (r.specifications || {})
        } as Product));

        return [...merged, ...extraD1].sort((a, b) => a.display_order - b.display_order);
      }
    } catch (err: any) {
      console.warn('[D1 Store] Products D1 query failed, using local store:', err.message);
    }
  }
  return localProducts.sort((a, b) => a.display_order - b.display_order);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await getAllProducts();
  const directMatch = products.find(p => p.slug === slug);
  if (directMatch) return directMatch;

  // Backward compatibility alias map
  const aliasMap: Record<string, string> = {
    'meat-and-poultry-absorbent-pads': 'fresh-meat-drip-pads',
    'ags-green-sorb-absorbent-soaker-pads': 'ultrasonic-sealed-pads'
  };
  const mappedSlug = aliasMap[slug];
  if (mappedSlug) {
    return products.find(p => p.slug === mappedSlug) || null;
  }
  return null;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const updatedAt = new Date().toISOString();

  if (isD1Configured()) {
    try {
      await executeD1Query(
        'UPDATE products SET title = COALESCE(?, title), price = COALESCE(?, price), image = COALESCE(?, image), description = COALESCE(?, description), updated_at = ? WHERE id = ?',
        [updates.name || updates.short_description, 0, updates.image_url, updates.full_description, updatedAt, id]
      );
    } catch (err: any) {
      console.warn('[D1 Store] Product D1 update failed, updating local store:', err.message);
    }
  }

  const products = readLocalProducts();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return null;

  products[index] = {
    ...products[index],
    ...updates,
    updated_at: updatedAt
  };
  writeLocalProducts(products);
  return products[index];
}

export async function createProduct(productData: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const newProduct: Product = {
    ...productData,
    id: 'prod-' + Date.now(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isD1Configured()) {
    try {
      await executeD1Query(
        `INSERT INTO products (id, title, slug, sku, price, image, description, is_active, display_order, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProduct.id,
          newProduct.name,
          newProduct.slug,
          newProduct.code,
          0,
          newProduct.image_url,
          newProduct.short_description,
          newProduct.is_active ? 1 : 0,
          newProduct.display_order || 0,
          newProduct.created_at,
          newProduct.updated_at
        ]
      );
    } catch (err: any) {
      console.warn('[D1 Store] Product D1 insert failed, saving to local store:', err.message);
    }
  }

  const products = readLocalProducts();
  products.push(newProduct);
  writeLocalProducts(products);
  return newProduct;
}

// ==========================================
// 2. INQUIRIES API (D1 + LOCAL FALLBACK)
// ==========================================
function ensureInquiriesData() {
  ensureDataDir();
  try {
    if (!fs.existsSync(INQUIRIES_FILE)) {
      fs.writeFileSync(INQUIRIES_FILE, JSON.stringify([
        {
          id: 'inq-demo-001',
          inquiry_no: 'INQ-2026-0001',
          name: 'Rajvardhan Singh',
          company_name: 'Anshuukam Packaging',
          email: 'rajvardhan@anshuukam.com',
          phone: '+91 6232475799',
          product_name: 'MEN',
          product_slug: 'meat-and-poultry-absorbent-pads',
          quantity: 100,
          target_timeline: 'Immediate Supply',
          fabric_choice: 'Bit Coin Jacquard',
          customization_type: '100 Units Batch',
          message: 'Sample and production order inquiry for MEN units.',
          status: 'PENDING',
          priority: 'Medium',
          admin_notes: 'Awaiting response from team.',
          created_at: '2026-05-26T10:30:00.000Z'
        }
      ], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error initializing inquiries file:', err);
  }
}

function readLocalInquiries(): Inquiry[] {
  ensureInquiriesData();
  try {
    const raw = fs.readFileSync(INQUIRIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalInquiries(items: Inquiry[]): void {
  ensureInquiriesData();
  try {
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing inquiries.json:', err);
  }
}

export async function getAllInquiries(): Promise<Inquiry[]> {
  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<Inquiry>('SELECT * FROM inquiries ORDER BY created_at DESC');
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(r => ({
          ...r,
          quantity: Number(r.quantity || 0)
        }));
      }
    } catch (err: any) {
      console.warn('[D1 Store] Cloudflare D1 query failed, using local store:', err.message);
    }
  }
  return readLocalInquiries();
}

export async function createInquiry(
  inquiryData: Omit<Inquiry, 'id' | 'inquiry_no' | 'status' | 'created_at'>
): Promise<Inquiry> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const inquiry_no = `INQ-${new Date().getFullYear()}-${randomSuffix}`;
  
  const newInquiry: Inquiry = {
    ...inquiryData,
    id: 'inq-' + Date.now(),
    inquiry_no,
    status: 'NEW',
    priority: inquiryData.priority || 'Medium',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isD1Configured()) {
    try {
      await executeD1Query(
        `INSERT INTO inquiries (
          id, inquiry_no, name, company_name, email, phone, 
          product_name, product_slug, quantity, target_timeline, 
          fabric_choice, customization_type, message, status, priority,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newInquiry.id,
          newInquiry.inquiry_no,
          newInquiry.name,
          newInquiry.company_name,
          newInquiry.email,
          newInquiry.phone,
          newInquiry.product_name,
          newInquiry.product_slug || null,
          newInquiry.quantity,
          newInquiry.target_timeline || null,
          newInquiry.fabric_choice || null,
          newInquiry.customization_type || null,
          newInquiry.message || '',
          newInquiry.status,
          newInquiry.priority,
          newInquiry.created_at,
          newInquiry.updated_at
        ]
      );
    } catch (err: any) {
      console.warn('[D1 Store] D1 insert failed, saving to local store:', err.message);
    }
  }

  const locals = readLocalInquiries();
  locals.unshift(newInquiry);
  writeLocalInquiries(locals);
  return newInquiry;
}

export async function getInquiryByNo(query: string): Promise<Inquiry | null> {
  const clean = String(query || '').trim().toUpperCase();
  if (!clean) return null;

  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<Inquiry>(
        'SELECT * FROM inquiries WHERE UPPER(inquiry_no) = ? OR UPPER(id) = ? LIMIT 1',
        [clean, clean.toLowerCase()]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return {
          ...rows[0],
          quantity: Number(rows[0].quantity || 0)
        };
      }
    } catch (err: any) {
      console.warn('[D1 Store] D1 inquiry lookup error, checking local store:', err.message);
    }
  }

  const locals = readLocalInquiries();
  // 1. Exact match by inquiry_no or id
  let match = locals.find(i => 
    (i.inquiry_no && i.inquiry_no.toUpperCase() === clean) ||
    (i.id && i.id.toUpperCase() === clean)
  );

  // 2. Partial match if user only typed the digits or part of code (e.g. "2236" or "2026-2236")
  if (!match) {
    match = locals.find(i => 
      (i.inquiry_no && i.inquiry_no.toUpperCase().includes(clean)) ||
      (clean.length >= 4 && i.inquiry_no && i.inquiry_no.toUpperCase().endsWith(clean))
    );
  }

  return match || null;
}

export async function updateInquiryStatus(
  id: string, 
  status: InquiryStatus | string, 
  admin_notes?: string,
  priority?: string,
  deadline?: string
): Promise<Inquiry | null> {
  const updatedAt = new Date().toISOString();

  if (isD1Configured()) {
    try {
      await executeD1Query(
        'UPDATE inquiries SET status = ?, admin_notes = COALESCE(?, admin_notes), priority = COALESCE(?, priority), updated_at = ? WHERE id = ?',
        [status, admin_notes !== undefined ? admin_notes : null, priority !== undefined && priority ? priority : null, updatedAt, id]
      );
      const rows = await executeD1Query<Inquiry>('SELECT * FROM inquiries WHERE id = ? LIMIT 1', [id]);
      if (Array.isArray(rows) && rows.length > 0) {
        try {
          const locals = readLocalInquiries();
          const idx = locals.findIndex(i => i.id === id);
          if (idx !== -1) {
            locals[idx] = { ...locals[idx], ...rows[0] };
            if (deadline !== undefined) locals[idx].deadline = deadline;
            writeLocalInquiries(locals);
          }
        } catch { }
        return {
          ...rows[0],
          quantity: Number(rows[0].quantity || 0)
        };
      }
    } catch (err: any) {
      console.warn('[D1 Store] D1 update failed, updating local store:', err.message);
    }
  }

  try {
    const locals = readLocalInquiries();
    const idx = locals.findIndex(i => i.id === id);
    if (idx !== -1) {
      locals[idx].status = status;
      locals[idx].updated_at = updatedAt;
      if (admin_notes !== undefined) {
        locals[idx].admin_notes = admin_notes;
      }
      if (priority !== undefined && priority) {
        locals[idx].priority = priority;
      }
      if (deadline !== undefined) {
        locals[idx].deadline = deadline;
      }
      writeLocalInquiries(locals);
      return locals[idx];
    }
  } catch (localErr) {
    console.error('Error updating local inquiry:', localErr);
  }
  return null;
}

export async function deleteInquiry(id: string): Promise<boolean> {
  let d1Deleted = false;
  if (isD1Configured()) {
    try {
      await executeD1Query('DELETE FROM inquiries WHERE id = ?', [id]);
      d1Deleted = true;
    } catch (err: any) {
      console.warn('[D1 Store] D1 delete failed, deleting from local store:', err.message);
    }
  }

  try {
    const locals = readLocalInquiries();
    const filtered = locals.filter(i => i.id !== id);
    if (filtered.length !== locals.length) {
      writeLocalInquiries(filtered);
      return true;
    }
  } catch { }

  return d1Deleted;
}

export async function deleteAllInquiries(): Promise<boolean> {
  if (isD1Configured()) {
    try {
      await executeD1Query('DELETE FROM inquiries');
    } catch (err: any) {
      console.warn('[D1 Store] D1 delete all failed:', err.message);
    }
  }

  writeLocalInquiries([]);
  return true;
}

// ==========================================
// 3. CATEGORIES API (D1 + LOCAL FALLBACK)
// ==========================================
const initialCategories: Category[] = [
  {
    id: 'cat-001',
    name: 'MEAT & POULTRY PADS',
    slug: 'meat',
    image: '/images/products/meat-pads.jpg',
    status: 'Active',
    item_count: 4,
    description: 'Food-grade certified absorbent soaker pads for raw beef, mutton, and fresh chicken trays.'
  },
  {
    id: 'cat-002',
    name: 'SEAFOOD & FISH PADS',
    slug: 'seafood',
    image: '/images/products/seafood-pads.jpg',
    status: 'Active',
    item_count: 3,
    description: 'Marine grade absorbent pads engineered for fresh fish fillets, chilled salmon, and export shrimp.'
  },
  {
    id: 'cat-003',
    name: 'FRUITS & BERRIES PADS',
    slug: 'produce',
    image: '/images/products/fruit-pads.jpg',
    status: 'Active',
    item_count: 3,
    description: 'Micro-perforated cushioning pads for delicate strawberries, blueberries, and clamshell punnets.'
  },
  {
    id: 'cat-004',
    name: 'COLD CHAIN & ICE PADS',
    slug: 'industrial',
    image: '/images/products/industrial-soaker-pads.jpg',
    status: 'Active',
    item_count: 4,
    description: 'Thermal gel ice pads and high-capacity absorbent liners for cold storage and export shipping.'
  }
];

function ensureCategoriesData() {
  ensureDataDir();
  try {
    if (!fs.existsSync(CATEGORIES_FILE)) {
      fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(initialCategories, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error initializing categories file:', err);
  }
}

function readLocalCategories(): Category[] {
  ensureCategoriesData();
  try {
    const raw = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return initialCategories;
  }
}

function writeLocalCategories(categories: Category[]): void {
  ensureCategoriesData();
  try {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing categories.json:', err);
  }
}

export async function getAllCategories(): Promise<Category[]> {
  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<Category>('SELECT * FROM categories ORDER BY name ASC');
      if (Array.isArray(rows) && rows.length > 0) {
        return rows;
      }
    } catch (err: any) {
      console.warn('[D1 Store] Categories D1 query failed, using local store:', err.message);
    }
  }
  return readLocalCategories();
}

export async function createCategory(catData: Omit<Category, 'id'>): Promise<Category> {
  const newCat: Category = {
    ...catData,
    id: 'cat-' + Date.now(),
    status: catData.status || 'Active'
  };

  if (isD1Configured()) {
    try {
      await executeD1Query(
        'INSERT INTO categories (id, name, slug, image, status, item_count, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newCat.id, newCat.name, newCat.slug, newCat.image, newCat.status, newCat.item_count || 0, newCat.description || '']
      );
    } catch (err: any) {
      console.warn('[D1 Store] Category D1 insert failed, saving to local store:', err.message);
    }
  }

  const list = readLocalCategories();
  list.push(newCat);
  writeLocalCategories(list);
  return newCat;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
  if (isD1Configured()) {
    try {
      await executeD1Query(
        'UPDATE categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), image = COALESCE(?, image), status = COALESCE(?, status), description = COALESCE(?, description) WHERE id = ?',
        [updates.name, updates.slug, updates.image, updates.status, updates.description, id]
      );
    } catch (err: any) {
      console.warn('[D1 Store] Category D1 update failed, updating local store:', err.message);
    }
  }

  const list = readLocalCategories();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates };
  writeLocalCategories(list);
  return list[idx];
}

export async function deleteCategory(id: string): Promise<boolean> {
  if (isD1Configured()) {
    try {
      await executeD1Query('DELETE FROM categories WHERE id = ?', [id]);
    } catch (err: any) {
      console.warn('[D1 Store] Category D1 delete failed, deleting from local store:', err.message);
    }
  }

  const list = readLocalCategories();
  const filtered = list.filter(c => c.id !== id);
  if (filtered.length === list.length) return false;
  writeLocalCategories(filtered);
  return true;
}

// ==========================================
// 4. REVIEWS API (D1 + LOCAL FALLBACK)
// ==========================================
const initialReviews: Review[] = [
  {
    id: 'rev-1',
    date: 'Jan 19, 2026',
    reviewer: 'Purva',
    company: 'Anshuukam',
    rating: 5,
    message: 'Super experience with rapid delivery and high absorption capacity.',
    status: 'Approved',
    visibility: 'Hidden'
  },
  {
    id: 'rev-2',
    date: 'Jan 13, 2026',
    reviewer: 'Arjun Singhania',
    company: 'FreshCatch Seafood Exporters Ltd',
    rating: 5,
    message: 'Prawns shipment reached Frankfurt in pristine condition. Zero drip pooling in export master cartons.',
    status: 'Approved',
    visibility: 'Visible'
  }
];

function readLocalReviews(): Review[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(REVIEWS_FILE)) {
      fs.writeFileSync(REVIEWS_FILE, JSON.stringify(initialReviews, null, 2), 'utf-8');
      return initialReviews;
    }
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return initialReviews;
  }
}

function writeLocalReviews(items: Review[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing reviews.json:', err);
  }
}

export async function getAllReviews(): Promise<Review[]> {
  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<Review>('SELECT * FROM reviews ORDER BY id DESC');
      if (Array.isArray(rows) && rows.length > 0) {
        return rows;
      }
    } catch (err: any) {
      console.warn('[D1 Store] Reviews D1 query failed, using local store:', err.message);
    }
  }
  return readLocalReviews();
}

export async function createReview(data: Omit<Review, 'id'>): Promise<Review> {
  const newReview: Review = {
    ...data,
    id: 'rev-' + Date.now()
  };

  if (isD1Configured()) {
    try {
      await executeD1Query(
        'INSERT INTO reviews (id, date, reviewer, company, rating, message, status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newReview.id, newReview.date, newReview.reviewer, newReview.company || '', newReview.rating, newReview.message, newReview.status, newReview.visibility]
      );
    } catch (err: any) {
      console.warn('[D1 Store] Review D1 insert failed, saving to local store:', err.message);
    }
  }

  const list = readLocalReviews();
  list.unshift(newReview);
  writeLocalReviews(list);
  return newReview;
}

export async function updateReview(id: string, updates: Partial<Review>): Promise<Review | null> {
  if (isD1Configured()) {
    try {
      await executeD1Query(
        'UPDATE reviews SET status = COALESCE(?, status), visibility = COALESCE(?, visibility), message = COALESCE(?, message), rating = COALESCE(?, rating) WHERE id = ?',
        [updates.status, updates.visibility, updates.message, updates.rating, id]
      );
    } catch (err: any) {
      console.warn('[D1 Store] Review D1 update failed, updating local store:', err.message);
    }
  }

  const list = readLocalReviews();
  const idx = list.findIndex(r => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates };
  writeLocalReviews(list);
  return list[idx];
}

export async function deleteReview(id: string): Promise<boolean> {
  if (isD1Configured()) {
    try {
      await executeD1Query('DELETE FROM reviews WHERE id = ?', [id]);
    } catch (err: any) {
      console.warn('[D1 Store] Review D1 delete failed, deleting from local store:', err.message);
    }
  }

  const list = readLocalReviews();
  const filtered = list.filter(r => r.id !== id);
  if (filtered.length === list.length) return false;
  writeLocalReviews(filtered);
  return true;
}

// ==========================================
// 5. OFFERS & PROMOTIONS API (D1 + LOCAL FALLBACK)
// ==========================================
export interface PopupOffer {
  active: boolean;
  title: string;
  description: string;
  linkUrl: string;
  buttonText: string;
}

const defaultOfferData: PopupOffer = {
  active: false,
  title: '10% off on tshirt bulk order',
  description: '10% off on tshirt bulk order above 5000 quant',
  linkUrl: '',
  buttonText: 'Claim offer'
};

function readLocalOffer(): PopupOffer {
  ensureDataDir();
  try {
    if (!fs.existsSync(OFFER_FILE)) {
      fs.writeFileSync(OFFER_FILE, JSON.stringify(defaultOfferData, null, 2), 'utf-8');
      return defaultOfferData;
    }
    const raw = fs.readFileSync(OFFER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultOfferData;
  }
}

function writeLocalOffer(offer: PopupOffer): void {
  ensureDataDir();
  try {
    fs.writeFileSync(OFFER_FILE, JSON.stringify(offer, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving offer.json:', err);
  }
}

export async function getOffer(): Promise<PopupOffer> {
  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<any>('SELECT * FROM offers WHERE id = ? LIMIT 1', ['main_offer']);
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        return {
          active: Boolean(r.active),
          title: r.title || defaultOfferData.title,
          description: r.description || defaultOfferData.description,
          linkUrl: r.link_url || '',
          buttonText: r.button_text || 'Claim offer'
        };
      }
    } catch (err: any) {
      console.warn('[D1 Store] Offer D1 query failed, using local store:', err.message);
    }
  }
  return readLocalOffer();
}

export async function saveOffer(data: Partial<PopupOffer>): Promise<PopupOffer> {
  const current = await getOffer();
  const updated: PopupOffer = { ...current, ...data };

  if (isD1Configured()) {
    try {
      await executeD1Query(
        `INSERT INTO offers (id, active, title, description, link_url, button_text, updated_at) 
         VALUES ('main_offer', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET 
         active = excluded.active,
         title = excluded.title,
         description = excluded.description,
         link_url = excluded.link_url,
         button_text = excluded.button_text,
         updated_at = CURRENT_TIMESTAMP`,
        [updated.active ? 1 : 0, updated.title, updated.description, updated.linkUrl || '', updated.buttonText || 'Claim offer']
      );
    } catch (err: any) {
      console.warn('[D1 Store] Offer D1 save failed, saving to local store:', err.message);
    }
  }

  writeLocalOffer(updated);
  return updated;
}

// ==========================================
// 6. SITE SETTINGS API (D1 + LOCAL FALLBACK)
// ==========================================
const defaultSettingsData: SiteSettings = {
  company_phone: '+91 76239 06747',
  company_whatsapp: '+91 76239 06747',
  notification_email: 'Hydrocaresolutions5@gmail.com',
  company_location: 'Gala No. 20, Poonamji Industrial Park, Vapi-Nashik Road, Near Indian Petrol Pump, Karvad, Vapi, Dist. Valsad, Gujarat - 396195',
  admin_pin: 'admin12345'
};

function readLocalSettings(): SiteSettings {
  ensureDataDir();
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettingsData, null, 2), 'utf-8');
      return defaultSettingsData;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return { ...defaultSettingsData, ...JSON.parse(raw) };
  } catch {
    return defaultSettingsData;
  }
}

function writeLocalSettings(settings: SiteSettings): void {
  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving settings.json:', err);
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (isD1Configured()) {
    try {
      const rows = await executeD1Query<{ key: string; value: string }>('SELECT key, value FROM site_settings');
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped: Partial<SiteSettings> = {};
        for (const r of rows) {
          if (r.key in defaultSettingsData) {
            (mapped as any)[r.key] = r.value;
          }
        }
        return { ...defaultSettingsData, ...mapped };
      }
    } catch (err: any) {
      console.warn('[D1 Store] Settings D1 query failed, using local store:', err.message);
    }
  }
  return readLocalSettings();
}

export async function saveSiteSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings();
  const merged: SiteSettings = { ...current, ...updates };

  if (isD1Configured()) {
    try {
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) {
          await executeD1Query(
            `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
            [k, String(v)]
          );
        }
      }
    } catch (err: any) {
      console.warn('[D1 Store] Settings D1 save failed, saving to local store:', err.message);
    }
  }

  writeLocalSettings(merged);
  return merged;
}

// ==========================================
// 8. BLOGS STORE API
// ==========================================
const defaultBlogs: BlogPost[] = [
  {
    id: "blog-1",
    title: "How Modern Food Packaging Absorbent Pads Maximize Meat Freshness & Shelf Life",
    slug: "how-modern-food-packaging-absorbent-pads-maximize-meat-freshness",
    category: "Meat & Poultry Packaging",
    date: "Oct 04, 2026",
    readTime: "4 min read",
    excerpt: "Explore advanced SAP fluid-lock technology, purge retention, and sealed-edge design that prevent microbial pooling in retail meat cuts.",
    content: "Retail meat presentation relies directly on effective exudate management. When fresh cut beef, pork, or poultry rests in pooled purge inside a packaging tray, bacterial growth rates accelerate exponentially. Super Absorbent Polymer (SAP) and sealed-edge food pads trap moisture irreversibly under package stacking pressures of up to 5 kPa, preserving color, aroma, and supermarket shelf-life.",
    image: "/images/products/meat-pads.jpg",
    is_published: true,
    author: "Technical Engineering Team",
    created_at: "2026-10-04T10:00:00.000Z"
  },
  {
    id: "blog-2",
    title: "Complete Guide to Marine Seafood & Fish Drip Pad Selection",
    slug: "complete-guide-to-marine-seafood-fish-drip-pad-selection",
    category: "Seafood Cold Chain",
    date: "Sep 28, 2026",
    readTime: "6 min read",
    excerpt: "Optimizing saline-stable absorbency and odor control to protect delicate salmon fillets, prawns, and chilled export seafood.",
    content: "Marine export air freight demands specialized salinity-resistant absorption cores. Standard wood pulp can collapse when subjected to saltwater weepage. Our marine-grade seafood pads utilize cross-linked sodium polyacrylate matrices that remain structurally firm and lock away fish liquid without dehydrating delicate skin or fillet muscle tissue.",
    image: "/images/products/seafood-pads.jpg",
    is_published: true,
    author: "Quality Assurance Dept",
    created_at: "2026-09-28T10:00:00.000Z"
  },
  {
    id: "blog-3",
    title: "Moisture & Condensation Control in Fresh Fruit and Berry Packaging",
    slug: "moisture-condensation-control-in-fresh-fruit-berry-packaging",
    category: "Produce Packaging",
    date: "Sep 15, 2026",
    readTime: "5 min read",
    excerpt: "Why micro-perforated food-contact pads prevent bottom rot, mold growth, and weight loss in high-value berry punnets.",
    content: "Berries such as strawberries, blueberries, and raspberries generate continuous respiration condensation during cold-chain transfer. Without proper bottom cushioning and condensation capture, mold and Botrytis cinerea ruin entire punnets. Micro-perforated produce pads absorb humidity without pulling natural moisture from the fruit flesh.",
    image: "/images/products/fruit-pads.jpg",
    is_published: true,
    author: "Agro Solutions Specialist",
    created_at: "2026-09-15T10:00:00.000Z"
  }
];

function readLocalBlogs(): BlogPost[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(BLOGS_FILE)) {
      fs.writeFileSync(BLOGS_FILE, JSON.stringify(defaultBlogs, null, 2), 'utf-8');
      return defaultBlogs;
    }
    const raw = fs.readFileSync(BLOGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return defaultBlogs;
  } catch (err) {
    console.error('Error reading blogs.json:', err);
    return defaultBlogs;
  }
}

function writeLocalBlogs(blogs: BlogPost[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(BLOGS_FILE, JSON.stringify(blogs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing blogs.json:', err);
  }
}

export async function getAllBlogs(): Promise<BlogPost[]> {
  return readLocalBlogs();
}

export async function getBlogById(id: string): Promise<BlogPost | null> {
  const blogs = readLocalBlogs();
  return blogs.find(b => b.id === id) || null;
}

export async function getBlogBySlug(slug: string): Promise<BlogPost | null> {
  const blogs = readLocalBlogs();
  return blogs.find(b => b.slug === slug) || null;
}

export async function createBlog(data: Omit<BlogPost, 'id'>): Promise<BlogPost> {
  const list = readLocalBlogs();
  const newBlog: BlogPost = {
    ...data,
    id: 'blog-' + Date.now(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  list.unshift(newBlog);
  writeLocalBlogs(list);
  return newBlog;
}

export async function updateBlog(id: string, updates: Partial<BlogPost>): Promise<BlogPost | null> {
  const list = readLocalBlogs();
  const idx = list.findIndex(b => b.id === id);
  if (idx === -1) return null;

  list[idx] = {
    ...list[idx],
    ...updates,
    updated_at: new Date().toISOString()
  };

  writeLocalBlogs(list);
  return list[idx];
}

export async function deleteBlog(id: string): Promise<boolean> {
  const list = readLocalBlogs();
  const next = list.filter(b => b.id !== id);
  if (next.length === list.length) return false;
  writeLocalBlogs(next);
  return true;
}

export async function saveAllBlogs(blogs: BlogPost[]): Promise<BlogPost[]> {
  writeLocalBlogs(blogs);
  return blogs;
}

