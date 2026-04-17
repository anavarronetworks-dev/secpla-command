/**
 * SECPLA — Cron Sync v5
 * app/api/cron/sync/route.js
 *
 * Schedule:
 *   gmail_scan   → cada hora en horario laboral (08-18 CLT)
 *   clock_sync   → 3 veces/día (inicio, mediodía, cierre)
 *   cotizaciones → 2 veces/día
 *   health       → cada 6h
 *
 * Horarios UTC (Chile = UTC-4):
 *   08:00 CLT → 12:00 UTC
 *   09:00 CLT → 13:00 UTC  … etc
 */

async function call(base, type, body = {}) {
  try {
    const res = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, type, warning: data.warning || null, error: !res.ok ? data.errorCode : null };
  } catch (e) { return { ok: false, type, error: e.message }; }
}

function getBase(req) {
  return `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("host") || process.env.VERCEL_URL || "localhost:3000"}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "health";

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const base = getBase(req);
  const results = [];
  const KEYWORDS = ["SNSM","SPD","GORE","licitación","cotización","convenio","sala monitoreo","UV32","comisaría","modificación"];
  const since = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");

  if (type === "gmail")   results.push(await call(base, "gmail_scan", { since, keywords: KEYWORDS }));
  if (type === "clock")   results.push(await call(base, "clock_sync"));
  if (type === "cotiz")   results.push(await call(base, "cotizaciones_track"));
  if (type === "health")  results.push(await call(base, "health"));
  if (type === "full") {
    results.push(await call(base, "clock_sync"));
    results.push(await call(base, "gmail_scan", { since, keywords: KEYWORDS }));
    results.push(await call(base, "cotizaciones_track"));
    results.push(await call(base, "health"));
  }

  return Response.json({ type, ts: new Date().toISOString(), results }, { status: results.every(r => r.ok) ? 200 : 207 });
}
