import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { isD1Configured, executeD1Query, getD1Config } from '../../../lib/d1';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized. Please login to admin.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const config = getD1Config();

  if (!isD1Configured()) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Missing credentials in .env. Please check CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_API_TOKEN.',
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
      tableExists,
      rowCount,
      note: tableExists 
        ? `Table 'inquiries' is ready with ${rowCount} existing records.` 
        : `Table 'inquiries' does not exist yet. Please run the CREATE TABLE query in your Cloudflare D1 console.`
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
