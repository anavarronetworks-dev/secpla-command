/**
 * SECPLA — Cron Sync Agent
 * app/api/cron/sync/route.js
 *
 * Vercel Cron Jobs (funciona sin tab abierto).
 * Plan Pro requerido para crons en Vercel.
 *
 * Horarios UTC (Chile = UTC-4):
 *   08:00 CLT → 12:00 UTC
 *   13:30 CLT → 17:30 UTC
 *   17:30 CLT → 21:30 UTC
 */

async function call(baseUrl, type, body = {}) {
  try {
    const res = await fetch(`${baseUrl}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...body }),
    });
    const data = await res.json();
    return { ok: res.ok, type, warning: data.warning, error: data.error };
  } catch (e) {
    return { ok: false, type, error: e.message };
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "health";

  // Seguridad opcional
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || process.env.VERCEL_URL || "localhost:3000";
  const base = `${proto}://${host}`;

  const results = [];

  if (type === "clock")   results.push(await call(base, "clock_sync"));
  if (type === "gmail")   results.push(await call(base, "gmail_scan", { since: new Date(Date.now() - 7*86400000).toISOString().slice(0,10).replace(/-/g,"/"), keywords: ["SNSM","SPD","GORE","licitación","cotización","convenio","sala monitoreo","UV32","comisaría"] }));
  if (type === "cotiz")   results.push(await call(base, "cotizaciones_track"));
  if (type === "health")  results.push(await call(base, "health"));
  if (type === "full") {
    results.push(await call(base, "clock_sync"));
    results.push(await call(base, "cotizaciones_track"));
    results.push(await call(base, "health"));
  }

  return Response.json({ type, ts: new Date().toISOString(), results });
}
