/**
 * SECPLA — State API  (app/api/state/route.js)
 *
 * Persistencia cross-device usando Vercel KV (Redis).
 * Sin KV configurado → usa un Map en memoria (funciona por sesión de servidor).
 *
 * GET  /api/state?key=xxx          → leer valor
 * POST /api/state  { key, value }  → escribir valor
 */

// Fallback en memoria si no hay KV (solo persiste mientras el servidor vive)
const memStore = new Map();

async function kvGet(key) {
  // Vercel KV  (@vercel/kv)
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const res = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      });
      if (res.ok) {
        const d = await res.json();
        return d?.result ?? null;
      }
    } catch {}
  }
  return memStore.get(key) ?? null;
}

async function kvSet(key, value) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });
    } catch {}
  }
  memStore.set(key, value);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return Response.json({ error: "key requerido" }, { status: 400 });
  const value = await kvGet(`secpla:${key}`);
  return Response.json({ key, value });
}

export async function POST(req) {
  try {
    const { key, value } = await req.json();
    if (!key) return Response.json({ error: "key requerido" }, { status: 400 });
    if (JSON.stringify(value).length > 500_000)
      return Response.json({ error: "valor demasiado grande (max 500KB)" }, { status: 413 });
    await kvSet(`secpla:${key}`, value);
    return Response.json({ ok: true, key });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
