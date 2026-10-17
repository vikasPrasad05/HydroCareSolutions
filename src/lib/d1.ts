/**
 * Cloudflare D1 Database Client
 * Supports BOTH:
 * 1. Native Cloudflare Workers binding (env.DB) when running in Cloudflare production
 * 2. Cloudflare v4 REST API / Local fallback when running in local development
 */
import fs from 'node:fs';
import path from 'node:path';

function getLiveEnv(): Record<string, string> {
  const envMap: Record<string, string> = {};
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          envMap[key] = val;
        }
      }
    }
  } catch {
    // filesystem read fallback for edge
  }
  return envMap;
}

/**
 * Returns configuration details for Cloudflare D1.
 * Defaults match wrangler.toml database binding.
 */
export function getD1Config() {
  const fileEnv = getLiveEnv();
  const metaEnv: Record<string, string> = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

  const accountId = (
    fileEnv.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    metaEnv.CLOUDFLARE_ACCOUNT_ID ||
    'dba3ba8efe781ec47da2b011abfb0b14'
  ).trim();

  const databaseId = (
    fileEnv.CLOUDFLARE_DATABASE_ID ||
    process.env.CLOUDFLARE_DATABASE_ID ||
    metaEnv.CLOUDFLARE_DATABASE_ID ||
    '5c0fb0e6-7ae7-4fc0-af41-14992f9b78f4'
  ).trim();

  const apiToken = (
    fileEnv.CLOUDFLARE_API_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    metaEnv.CLOUDFLARE_API_TOKEN ||
    ''
  ).trim();

  const globalApiKey = (
    fileEnv.CLOUDFLARE_GLOBAL_API_KEY ||
    fileEnv.CLOUDFLARE_API_KEY ||
    process.env.CLOUDFLARE_GLOBAL_API_KEY ||
    metaEnv.CLOUDFLARE_GLOBAL_API_KEY ||
    ''
  ).trim();

  const email = (
    fileEnv.CLOUDFLARE_EMAIL ||
    process.env.CLOUDFLARE_EMAIL ||
    metaEnv.CLOUDFLARE_EMAIL ||
    'vikasprasad888999@gmail.com'
  ).trim();

  return {
    accountId,
    databaseId,
    apiToken,
    globalApiKey,
    email
  };
}

/**
 * Check if running inside Cloudflare Workers runtime
 */
export function isCloudflareWorker(): boolean {
  if (typeof (globalThis as any).DB !== 'undefined') return true;
  if (typeof (globalThis as any).WebSocketPair !== 'undefined') return true;
  if (typeof navigator !== 'undefined' && (navigator as any).userAgent?.includes('Cloudflare')) return true;
  return false;
}

/**
 * Safely retrieve the native Cloudflare D1 DB binding in workerd
 */
export async function getNativeD1Binding(): Promise<any | null> {
  // 1. Direct workerd module import
  try {
    const cf = await import('cloudflare:workers');
    if (cf?.env?.DB) {
      return cf.env.DB;
    }
  } catch {
    // not in workerd
  }

  // 2. Global scope binding
  if (typeof (globalThis as any).DB !== 'undefined') {
    return (globalThis as any).DB;
  }
  if (typeof (process as any)?.env?.DB !== 'undefined') {
    return (process as any).env.DB;
  }

  return null;
}

/**
 * Check if D1 is configured (either native Cloudflare Workers binding or REST API credentials)
 */
export const isD1Configured = (): boolean => {
  // In Cloudflare Workers, native DB binding is always present
  if (isCloudflareWorker()) return true;

  const { accountId, databaseId, apiToken, globalApiKey, email } = getD1Config();
  if (!accountId || !databaseId) return false;
  if (accountId.includes('your_') || databaseId.includes('your_')) return false;

  if (apiToken && !apiToken.includes('your_')) return true;
  if (globalApiKey && !globalApiKey.includes('your_')) return true;
  if (globalApiKey && email && !globalApiKey.includes('your_')) return true;

  return false;
};

/**
 * Execute a SQL query on Cloudflare D1.
 * Automatically prefers native DB binding if in Cloudflare Workers,
 * falling back to REST API for remote/local dev.
 */
export async function executeD1Query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  // 1. Try native Cloudflare Workers D1 binding
  try {
    const nativeDB = await getNativeD1Binding();
    if (nativeDB) {
      const stmt = params && params.length > 0
        ? nativeDB.prepare(sql).bind(...params)
        : nativeDB.prepare(sql);
      const res = await stmt.all();
      return (res?.results || []) as T[];
    }
  } catch (nativeErr: any) {
    console.error('[Cloudflare Native D1 Error]:', nativeErr.message, 'SQL:', sql);
    throw nativeErr;
  }

  // 2. Fall back to Cloudflare v4 REST API
  const { accountId, databaseId, apiToken, globalApiKey, email } = getD1Config();

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Support both API Token (Bearer) and Global API Key
  const tokenToUse = apiToken || (globalApiKey.startsWith('cfat_') ? globalApiKey : '');

  if (tokenToUse) {
    headers['Authorization'] = `Bearer ${tokenToUse}`;
  } else if (globalApiKey && email) {
    headers['X-Auth-Key'] = globalApiKey;
    headers['X-Auth-Email'] = email;
  } else if (globalApiKey) {
    headers['Authorization'] = `Bearer ${globalApiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sql,
      params
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errorDetails = data.errors?.map((e: any) => `${e.message} (code: ${e.code})`).join(', ') || 'Unknown Cloudflare API error';
    throw new Error(`Cloudflare D1 Error: ${errorDetails}`);
  }

  // Cloudflare D1 format: { result: [ { results: [...] } ] }
  return (data.result?.[0]?.results || []) as T[];
}

export async function testD1Connection(): Promise<{ ok: boolean; message: string; rows?: any[] }> {
  try {
    const rows = await executeD1Query('SELECT 1 as ping');
    return {
      ok: true,
      message: 'Cloudflare D1 connected successfully!',
      rows
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Connection failed'
    };
  }
}

/**
 * Ensures all required D1 tables are created in Cloudflare D1
 */
export async function initD1Schema(): Promise<{ ok: boolean; message: string; tables: string[] }> {
  const tableQueries = [
    {
      name: 'inquiries',
      sql: `CREATE TABLE IF NOT EXISTS inquiries (
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
      );`
    },
    {
      name: 'categories',
      sql: `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        image TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        item_count INTEGER DEFAULT 0,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    },
    {
      name: 'products',
      sql: `CREATE TABLE IF NOT EXISTS products (
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
      );`
    },
    {
      name: 'reviews',
      sql: `CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        company TEXT,
        rating INTEGER DEFAULT 5,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'Approved',
        visibility TEXT DEFAULT 'Hidden',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    },
    {
      name: 'offers',
      sql: `CREATE TABLE IF NOT EXISTS offers (
        id TEXT PRIMARY KEY,
        active INTEGER DEFAULT 0,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        link_url TEXT,
        button_text TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    },
    {
      name: 'site_settings',
      sql: `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    },
    {
      name: 'blogs',
      sql: `CREATE TABLE IF NOT EXISTS blogs (
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
      );`
    }
  ];

  const createdTables: string[] = [];

  for (const t of tableQueries) {
    try {
      await executeD1Query(t.sql);
      createdTables.push(t.name);
    } catch (err: any) {
      console.error(`[D1 Schema] Failed creating table ${t.name}:`, err.message);
      return { ok: false, message: `Failed creating ${t.name}: ${err.message}`, tables: createdTables };
    }
  }

  // Default seed data for categories
  try {
    const existingCats = await executeD1Query('SELECT count(*) as count FROM categories');
    if (existingCats && Number(existingCats[0]?.count || 0) === 0) {
      await executeD1Query(`
        INSERT OR IGNORE INTO categories (id, name, slug, image, status, item_count, description) VALUES
        ('cat-001', 'MEAT & POULTRY PADS', 'meat', '/images/products/meat-pads.jpg', 'Active', 4, 'Food-grade certified absorbent soaker pads for raw beef, mutton, and fresh chicken trays.'),
        ('cat-002', 'SEAFOOD & FISH PADS', 'seafood', '/images/products/seafood-pads.jpg', 'Active', 3, 'Marine grade absorbent pads engineered for fresh fish fillets, chilled salmon, and export shrimp.'),
        ('cat-003', 'FRUITS & BERRIES PADS', 'produce', '/images/products/fruit-pads.jpg', 'Active', 3, 'Micro-perforated cushioning pads for delicate strawberries, blueberries, and clamshell punnets.'),
        ('cat-004', 'COLD CHAIN & ICE PADS', 'industrial', '/images/products/industrial-soaker-pads.jpg', 'Active', 4, 'Thermal gel ice pads and high-capacity absorbent liners for cold storage and export shipping.');
      `);
    }
  } catch (seedErr) {
    console.warn('[D1 Schema] Category seed check skipped:', seedErr);
  }

  return {
    ok: true,
    message: 'All Cloudflare D1 tables initialized successfully!',
    tables: createdTables
  };
}
