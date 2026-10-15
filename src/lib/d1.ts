/**
 * Cloudflare D1 Database REST Client
 * Connects directly to Cloudflare D1 via the Cloudflare v4 REST API
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
    // fallback
  }
  return envMap;
}

export function getD1Config() {
  const fileEnv = getLiveEnv();
  const metaEnv: Record<string, string> = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

  const accountId = (
    fileEnv.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    metaEnv.CLOUDFLARE_ACCOUNT_ID ||
    ''
  ).trim();

  const databaseId = (
    fileEnv.CLOUDFLARE_DATABASE_ID ||
    process.env.CLOUDFLARE_DATABASE_ID ||
    metaEnv.CLOUDFLARE_DATABASE_ID ||
    ''
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
    ''
  ).trim();

  return {
    accountId,
    databaseId,
    apiToken,
    globalApiKey,
    email
  };
}

export const isD1Configured = (): boolean => {
  const { accountId, databaseId, apiToken, globalApiKey, email } = getD1Config();
  if (!accountId || !databaseId) return false;
  if (accountId.includes('your_') || databaseId.includes('your_')) return false;

  if (apiToken && !apiToken.includes('your_')) return true;
  if (globalApiKey && email && !globalApiKey.includes('your_')) return true;

  return false;
};

export async function executeD1Query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { accountId, databaseId, apiToken, globalApiKey, email } = getD1Config();

  if (!isD1Configured()) {
    throw new Error(
      'Cloudflare D1 credentials missing in .env. Please configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_API_TOKEN.'
    );
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (globalApiKey && email) {
    headers['X-Auth-Key'] = globalApiKey;
    headers['X-Auth-Email'] = email;
  } else if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
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
  if (!isD1Configured()) {
    return { ok: false, message: 'D1 not configured in .env', tables: [] };
  }

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

  return {
    ok: true,
    message: 'All Cloudflare D1 tables initialized successfully!',
    tables: createdTables
  };
}
