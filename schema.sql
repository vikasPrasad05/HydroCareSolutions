-- ========================================================
-- CLOUDFLARE D1 DATABASE SCHEMA FOR ABSORBENT PADS ADMIN
-- Database: hydrocare_db (5c0fb0e6-7ae7-4fc0-af41-14992f9b78f4)
-- ========================================================

-- 1. INQUIRIES TABLE
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  inquiry_no TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  product_name TEXT,
  product_slug TEXT,
  quantity INTEGER DEFAULT 0,
  target_timeline TEXT,
  fabric_choice TEXT,
  customization_type TEXT,
  message TEXT,
  status TEXT DEFAULT 'PENDING',
  priority TEXT DEFAULT 'Medium',
  admin_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  item_count INTEGER DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id TEXT,
  sku TEXT,
  price REAL DEFAULT 0,
  image TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  company TEXT,
  rating INTEGER DEFAULT 5,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'Approved',
  visibility TEXT DEFAULT 'Hidden',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5. OFFERS TABLE
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  active INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link_url TEXT,
  button_text TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 6. SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 7. BLOGS TABLE
CREATE TABLE IF NOT EXISTS blogs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT,
  image TEXT,
  author TEXT DEFAULT 'HydroCare Team',
  date TEXT,
  category TEXT,
  read_time TEXT,
  is_published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- INITIAL SEED DATA
-- ========================================================

-- Default Categories
INSERT OR IGNORE INTO categories (id, name, slug, image, status, item_count, description) VALUES
('cat-001', 'MEAT & POULTRY PADS', 'meat', '/images/products/meat-pads.jpg', 'Active', 4, 'Food-grade certified absorbent soaker pads for raw beef, mutton, and fresh chicken trays.'),
('cat-002', 'SEAFOOD & FISH PADS', 'seafood', '/images/products/seafood-pads.jpg', 'Active', 3, 'Marine grade absorbent pads engineered for fresh fish fillets, chilled salmon, and export shrimp.'),
('cat-003', 'FRUITS & BERRIES PADS', 'produce', '/images/products/fruit-pads.jpg', 'Active', 3, 'Micro-perforated cushioning pads for delicate strawberries, blueberries, and clamshell punnets.'),
('cat-004', 'COLD CHAIN & ICE PADS', 'industrial', '/images/products/industrial-soaker-pads.jpg', 'Active', 4, 'Thermal gel ice pads and high-capacity absorbent liners for cold storage and export shipping.');

-- Default Offer
INSERT OR IGNORE INTO offers (id, active, title, description, link_url, button_text) VALUES
('main_offer', 0, '10% off on tshirt bulk order', '10% off on tshirt bulk order above 5000 quant', '', 'Claim offer');

-- Default Reviews
INSERT OR IGNORE INTO reviews (id, date, reviewer, company, rating, message, status, visibility) VALUES
('rev-1', 'Jan 19, 2026', 'Purva', 'Anshuukam', 5, 'Super experience with rapid delivery and high absorption capacity.', 'Approved', 'Hidden'),
('rev-2', 'Jan 13, 2026', 'Arjun Singhania', 'FreshCatch Seafood Exporters Ltd', 5, 'Prawns shipment reached Frankfurt in pristine condition. Zero drip pooling in export master cartons.', 'Approved', 'Visible');

-- Default Site Settings
INSERT OR IGNORE INTO site_settings (key, value) VALUES
('company_whatsapp', '+91 76239 06747'),
('notification_email', 'Hydrocaresolutions5@gmail.com'),
('admin_pin', 'admin12345'),
('company_phone', '+91 76239 06747'),
('company_location', 'Gala No. 20, Poonamji Industrial Park, Vapi-Nashik Road, Near Indian Petrol Pump, Karvad, Vapi, Dist. Valsad, Gujarat - 396195');
