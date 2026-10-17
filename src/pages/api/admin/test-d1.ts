import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { isD1Configured, executeD1Query, getD1Config, getNativeD1Binding } from '../../../lib/d1';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized. Please login to admin.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const nativeDB = await getNativeD1Binding();
  const config = getD1Config();
  const configured = Boolean(nativeDB) || isD1Configured();

  if (!configured) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Cloudflare D1 is not configured. Please check database binding in wrangler.toml or environment variables.',
      config: {
        accountId: config.accountId ? 'Present' : 'Missing',
        databaseId: config.databaseId ? 'Present' : 'Missing',
        apiToken: config.apiToken ? 'Present' : 'Missing'
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Ping test
    await executeD1Query('SELECT 1 as ping');

    // 2. Inquiries table check
    let tableExists = false;
    let rowCount = 0;
    try {
      const countRes = await executeD1Query<{ count: number }>('SELECT count(*) as count FROM inquiries');
      tableExists = true;
      rowCount = countRes[0]?.count ?? 0;
    } catch (tblErr: any) {
      tableExists = false;
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Cloudflare D1 connected successfully!',
      mode: nativeDB ? 'Native Cloudflare Binding' : 'Cloudflare REST API',
      tableExists,
      rowCount,
      note: tableExists 
        ? `Table 'inquiries' is ready with ${rowCount} existing records.` 
        : `Table 'inquiries' does not exist yet. Click 'Test & Sync D1 Tables' to initialize.`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message || 'Error connecting to Cloudflare D1'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
