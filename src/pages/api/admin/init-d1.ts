import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { isD1Configured, initD1Schema, testD1Connection, getD1Config } from '../../../lib/d1';

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
      error: 'Cloudflare D1 credentials missing in .env.',
      config: {
        accountId: config.accountId ? 'Configured' : 'Missing',
        databaseId: config.databaseId ? 'Configured' : 'Missing',
        apiToken: config.apiToken ? 'Configured' : 'Missing'
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Test ping connection
    const testResult = await testD1Connection();
    if (!testResult.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: `D1 Connection Test Failed: ${testResult.message}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Initialize schema (create all tables if not exist)
    const initResult = await initD1Schema();

    return new Response(JSON.stringify({
      ok: initResult.ok,
      message: initResult.message,
      tables: initResult.tables
    }), {
      status: initResult.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message || 'Error initializing Cloudflare D1 database.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
