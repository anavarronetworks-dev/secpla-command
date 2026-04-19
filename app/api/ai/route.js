/**
 * SECPLA — Cron Sync  (app/api/cron/sync/route.js)
 *
 * L-V: gmail cada hora 08-18 CLT, clock 3 veces/día, cotiz 2 veces/día
 * S-D: 1 sola ejecución a las 10:00 CLT (14:00 UTC)
 */

async function call(base, type, body={}) {
  try {
    const res = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...body }),
    });
    const d = await res.json().catch(()=>({}));
    return { ok:res.ok, type, silent:d.silent||false };
  } catch(e) { return { ok:false, type, error:e.message }; }
}

function base(req) {
  return `${req.headers.get("x-forwarded-proto")||"https"}://${req.headers.get("host")||process.env.VERCEL_URL||"localhost:3000"}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "health";
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error:"Unauthorized" }, { status:401 });

  const b = base(req);
  const KW = ["SNSM","SPD","GORE","licitación","cotización","convenio","sala monitoreo","UV32","comisaría"];
  const since = new Date(Date.now()-8*86400000).toISOString().slice(0,10).replace(/-/g,"/");
  const results = [];

  if (type==="gmail")  results.push(await call(b,"gmail_scan",{since,keywords:KW}));
  if (type==="clock")  results.push(await call(b,"clock_sync"));
  if (type==="cotiz")  results.push(await call(b,"cotizaciones_track"));
  if (type==="health") results.push(await call(b,"health"));
  if (type==="weekend") {
    // Fin de semana: una sola ronda completa
    results.push(await call(b,"clock_sync"));
    results.push(await call(b,"gmail_scan",{since,keywords:KW}));
    results.push(await call(b,"cotizaciones_track"));
  }

  return Response.json({ type, ts:new Date().toISOString(), results });
}
