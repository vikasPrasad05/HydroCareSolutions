import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || '.jpg';
      const cleanExt = ext.toLowerCase().match(/^\.[a-z0-9]+$/) ? ext.toLowerCase() : '.jpg';
      const safeName = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${cleanExt}`;

      try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, safeName);
        fs.writeFileSync(filePath, buffer);

        return new Response(JSON.stringify({ url: `/uploads/${safeName}`, success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (fsErr) {
        const mime = cleanExt === '.png' ? 'image/png' : cleanExt === '.webp' ? 'image/webp' : cleanExt === '.svg' ? 'image/svg+xml' : 'image/jpeg';
        const base64Data = buffer.toString('base64');
        return new Response(JSON.stringify({ url: `data:${mime};base64,${base64Data}`, success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle Base64 JSON
    const body = await request.json().catch(() => null);
    if (body?.image && typeof body.image === 'string' && body.image.startsWith('data:image/')) {
      const matches = body.image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        const rawExt = matches[1].toLowerCase();
        const ext = rawExt === 'jpeg' ? '.jpg' : `.${rawExt}`;
        const buffer = Buffer.from(matches[2], 'base64');
        const safeName = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;

        try {
          const uploadDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filePath = path.join(uploadDir, safeName);
          fs.writeFileSync(filePath, buffer);

          return new Response(JSON.stringify({ url: `/uploads/${safeName}`, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (fsErr) {
          return new Response(JSON.stringify({ url: body.image, success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'No valid image provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[Upload API Error]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
