/**
 * SECPLA Command — API Route v5.0
 * app/api/ai/route.js
 *
 * OPTIMIZACIONES v5:
 *   • gmail_scan:         sin Claude → clasificación JS pura (0 tokens)
 *   • clock_sync:         incluye ayer + días recientes, sin Claude
 *   • cotizaciones_track: desde 2024/12/01 (cubre todo el historial)
 *   • Todo Gmail: metadata-only (snippets), sin leer body completo
 *   • Claude solo para: chat, summary, licit, doc
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constantes ───────────────────────────────────────────────────────────────
const CLOCK_SENDER  = "enviomarcaciones@mg.bionicvision.cl";
const GMAIL_USER    = "anavarro@recoleta.cl";
const COTIZ_SINCE   = "2024/12/01";  // historial completo desde dic 2024

// Remitentes ignorados (no generan seguimiento)
const IGNORE = [
  "comunicaciones@recoleta.cl", "noreply@", "no-reply@",
  "newsletter@", "boletin@", "notificaciones@mercadopublico.cl",
  "donotreply@", "mailer@", "marketing@",
];

// Empresas cotización SNSM 2025 — búsqueda amplia desde dic 2024
const EMPRESAS = [
  { name: "Scharfstein",   domains: ["scharfstein.cl"],   kw: ["scharfstein","merino","cristobal cruz"] },
  { name: "Bionic Vision", domains: ["bionicvision.cl"],  kw: ["bionic","bionicvision","valero","ponce"] },
  { name: "Grupo VSM",     domains: ["grupovsm.cl"],      kw: ["grupovsm","vsm"] },
  { name: "RockTech",      domains: ["rocktechla.com"],   kw: ["rocktech","rifo"] },
  { name: "Securitas",     domains: ["securitas.cl"],     kw: ["securitas"] },
  { name: "Prosegur",      domains: ["prosegur.com","prosegurchile.cl"], kw: ["prosegur"] },
  { name: "Verkauf",       domains: ["verkauf.cl"],       kw: ["verkauf"] },
  { name: "Dahua",         domains: ["dahua.com","dahuachile.cl"],       kw: ["dahua"] },
  { name: "Hikvision",     domains: ["hikvision.com","hikvisionsur.com"], kw: ["hikvision"] },
];

// Palabras clave de proyectos (para clasificar correos sin Claude)
const PROJ_PATTERNS = {
  p1: [/6ta comisa/i, /habilitaci.n tecnol/i, /empalme el.ctrico/i, /enel/i],
  p2: [/snsm25/i, /snsm2025/i, /snsm25-stp/i, /integraci.n c.maras/i, /sievap/i],
  p3: [/centros culturales/i, /cdp n.79/i, /cctv.*cultural/i],
  p4: [/uv.?32/i, /uv n.?32/i, /bnup/i, /40066179/i],
  p5: [/sala.*monitoreo/i, /consistorial/i, /torre telecom/i, /trato directo/i],
};

function detectProj(text) {
  for (const [pid, pats] of Object.entries(PROJ_PATTERNS)) {
    if (pats.some(p => p.test(text))) return pid;
  }
  return null;
}

// ── Utils ────────────────────────────────────────────────────────────────────
function extractText(c = []) { return c.filter(x => x.type === "text").map(x => x.text || "").join(""); }
function safeJSON(s, d) { try { return JSON.parse((s || "").replace(/```json|```/g, "").trim()); } catch { return d; } }
function san(s, n = 300) { return typeof s === "string" ? s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, n) : ""; }
function parseTs(d) { try { return new Date(d).getTime() || 0; } catch { return 0; } }
function isIgnored(from) { const f = from.toLowerCase(); return IGNORE.some(i => f.includes(i)); }
function daysAgo(d) { return Math.round((Date.now() - parseTs(d)) / 86400000); }
function isoYMD(d) { return d.toISOString().slice(0, 10); }
function prevWorkday() {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return isoYMD(d);
}

// ── Fetch con timeout ────────────────────────────────────────────────────────
async function fetchT(url, opts = {}, ms = 14000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// ── OAuth2 ──────────────────────────────────────────────────────────────────
let _tok = null, _tokExp = 0;
async function getToken() {
  const [r, c, s] = [process.env.GOOGLE_REFRESH_TOKEN, process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET];
  if (!r || !c || !s) return null;
  if (_tok && Date.now() < _tokExp - 120000) return _tok;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchT("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: r, client_id: c, client_secret: s }),
      }, 10000);
      if (!res.ok) { if (i < 2) { await new Promise(x => setTimeout(x, 900 * (i + 1))); continue; } return null; }
      const d = await res.json();
      if (!d.access_token) return null;
      _tok = d.access_token; _tokExp = Date.now() + (d.expires_in || 3600) * 1000;
      return _tok;
    } catch { if (i < 2) await new Promise(x => setTimeout(x, 900 * (i + 1))); }
  }
  return null;
}

// ── Gmail search — solo metadata, sin body ────────────────────────────────────
async function gmailSearch(query, max = 40) {
  const tok = await getToken();
  if (!tok) return { messages: [], error: "NO_GOOGLE_CREDENTIALS" };
  try {
    const lr = await fetchT(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(max, 100)}`,
      { headers: { Authorization: `Bearer ${tok}` } }
    );
    if (!lr.ok) return { messages: [], error: `GMAIL_${lr.status}` };
    const ld = await lr.json();
    if (!ld.messages?.length) return { messages: [], error: null };

    const msgs = [];
    // Batches de 8 con 80ms entre ellos — dentro del límite de cuota Gmail
    for (let i = 0; i < ld.messages.length; i += 8) {
      const batch = ld.messages.slice(i, i + 8);
      const rows = await Promise.all(batch.map(async m => {
        try {
          const mr = await fetchT(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata` +
            `&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${tok}` } }, 8000
          );
          if (!mr.ok) return null;
          const msg = await mr.json();
          const h = {}; (msg.payload?.headers || []).forEach(x => { h[x.name] = x.value; });
          return {
            messageId: msg.id, threadId: msg.threadId,
            subject: san(h.Subject || "", 250),
            from:    san(h.From    || "", 180),
            to:      san(h.To      || "", 180),
            date:    h.Date || "",
            snippet: san(msg.snippet || "", 350),
          };
        } catch { return null; }
      }));
      msgs.push(...rows.filter(Boolean));
      if (i + 8 < ld.messages.length) await new Promise(x => setTimeout(x, 80));
    }
    return { messages: msgs, error: null };
  } catch (e) { return { messages: [], error: "GMAIL_EXCEPTION", detail: e.message }; }
}

// ── Claude (solo cuando realmente necesario) ──────────────────────────────────
async function callClaude(system, user, maxTok = 800) {
  const input = user.length > 6000 ? user.slice(0, 5900) + "\n[TRUNCADO]" : user;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await client.messages.create({
        model: "claude-sonnet-4-5", max_tokens: maxTok,
        system, messages: [{ role: "user", content: input }],
      });
      return extractText(r.content);
    } catch (e) {
      if (i === 0 && (e.status === 429 || e.status === 529)) { await new Promise(x => setTimeout(x, 2000)); continue; }
      throw e;
    }
  }
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────

// chat — Claude con contexto mínimo
async function handleChat({ messages, context, follows }) {
  if (!Array.isArray(messages)) return { text: "messages inválido" };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 900,
    system: `Asistente SECPLA, Municipalidad Recoleta. Apoyas a Alexis Navarro.
Directo, en español. Negritas para cifras clave.
CARTERA:\n${(context || "").slice(0, 2000)}\nSEGUIMIENTOS:\n${(follows || "Ninguno").slice(0, 600)}\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
    messages: messages.slice(-14).map(m => ({ role: m.role, content: m.content })),
  });
  return { text: extractText(res.content) };
}

// summary — Claude con notas del proyecto
async function handleSummary({ project, notes }) {
  if (!project?.name) return { text: "proyecto requerido" };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 400,
    system: "Resumen ejecutivo 3-4 oraciones. Sin markdown. Estado, gestiones, pendientes, próximos pasos.",
    messages: [{ role: "user", content: `${project.name}\n${project.financier} · ${project.program} · ${project.budget}\n${project.stage} / ${project.status}\n\n${(notes || "").slice(0, 1500)}` }],
  });
  return { text: extractText(res.content) };
}

// licit — Claude con web_search (único caso justificado)
async function handleLicit({ licitId }) {
  if (!licitId?.trim()) return { text: '{"estado":"Desconocido"}' };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 600,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `Busca en mercadopublico.cl. SOLO JSON sin markdown:
{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"","descripcion":"","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","url":""}`,
    messages: [{ role: "user", content: `Licitación: ${san(licitId, 50)}` }],
  });
  return { text: extractText(res.content) };
}

// doc — Claude Vision (PDF/imagen)
async function handleDoc({ b64, mediaType, isImg }) {
  if (!b64 || typeof b64 !== "string") return { text: '{"error":"Sin datos"}' };
  const cb = isImg
    ? { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: b64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 900,
    messages: [{ role: "user", content: [cb, { type: "text", text: `SOLO JSON:
{"title":"","docType":"Convenio|Decreto|Oficio|Resolución|EETT|CDP|Acta|Otro","summary":"2-3 oraciones","codigoProyecto":"","montoTotal":0,"dates":[{"date":"YYYY-MM-DD","description":""}],"plazoEjecucionFin":"YYYY-MM-DD","plazoConvenioFin":"YYYY-MM-DD","tasks":[""],"parties":[""]}` }] }],
  });
  return { text: extractText(res.content) };
}

// ── GMAIL SCAN — 0 tokens Claude, JS puro ────────────────────────────────────
// Se ejecuta cada hora. Devuelve hilos agrupados sin llamar a Claude.
async function handleGmailScan({ since = "2026/04/01", keywords = [] }) {
  const sinceClean = since.replace(/[^0-9/]/g, "");
  const kwQ = keywords.slice(0, 8).map(k => `"${san(k, 40)}"`).join(" OR ");
  const query = `to:${GMAIL_USER} after:${sinceClean}${kwQ ? ` (${kwQ})` : ""} -from:${CLOCK_SENDER}`;
  const { messages, error } = await gmailSearch(query, 60);

  if (error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
  if (error) return { text: "[]", error: true, errorCode: error };

  // Filtrar ignorados
  const clean = messages.filter(m => !isIgnored(m.from));
  if (!clean.length) return { text: "[]" };

  // Agrupar por thread → el mensaje más reciente representa el hilo
  const threadMap = {};
  for (const m of clean) {
    const ts = parseTs(m.date);
    if (!threadMap[m.threadId] || ts > parseTs(threadMap[m.threadId].date)) threadMap[m.threadId] = m;
  }

  const result = Object.values(threadMap)
    .sort((a, b) => parseTs(b.date) - parseTs(a.date))
    .slice(0, 50)
    .map(m => {
      const fromName = m.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || m.from;
      const subjectLower = m.subject + " " + m.snippet;
      return {
        threadId: m.threadId,
        messageId: m.messageId,
        subject: m.subject,
        fromName,
        from: m.from,
        date: m.date,
        snippet: m.snippet,
        daysSinceLastMsg: daysAgo(m.date),
        projectId: detectProj(subjectLower),
        threadUrl: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
      };
    });

  return { text: JSON.stringify(result) };
}

// ── CLOCK SYNC — verifica ayer y días recientes ───────────────────────────────
// Lógica: busca marcajes del día de hoy Y del día hábil anterior.
// Sin Claude — parseo JS del snippet.
async function handleClockSync() {
  // Calcular rango: 30 días hacia atrás para capturar todo
  const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - 30);
  const sinceStr = isoYMD(sinceDate).replace(/-/g, "/");

  const { messages, error } = await gmailSearch(
    `from:${CLOCK_SENDER} subject:"Aviso de registro de marca en reloj control" after:${sinceStr}`, 80
  );

  if (error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
  if (error) return { text: "[]", error: true, errorCode: error };

  const dayMap = {};
  const re = /el día (\d{2}\/\d{2}\/\d{4}).*?(Entrada|Salida)\s+a las\s+(\d{2}:\d{2})/i;

  for (const msg of messages) {
    const m = re.exec(msg.snippet || "");
    if (!m) continue;
    const [, dmy, tipo, hora] = m;
    const [d, mo, y] = dmy.split("/");
    const iso = `${y}-${mo}-${d}`;
    if (!dayMap[iso]) dayMap[iso] = { date: iso, entrada: null, salida: null };
    if (tipo === "Entrada" && !dayMap[iso].entrada) dayMap[iso].entrada = hora;
    if (tipo === "Salida") dayMap[iso].salida = hora;
  }

  const todayStr    = isoYMD(new Date());
  const yesterdayStr = prevWorkday();

  // Indicar explícitamente si hay registro para hoy y ayer
  const sorted = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    text: JSON.stringify(sorted),
    meta: {
      today:     todayStr,
      yesterday: yesterdayStr,
      hasToday:     !!dayMap[todayStr],
      hasYesterday: !!dayMap[yesterdayStr],
    },
  };
}

// ── COTIZACIONES TRACK — desde dic 2024, sin Claude ──────────────────────────
// Busca enviados y recibidos por empresa usando búsquedas paralelas.
// Lógica de estado: JS puro → 0 tokens.
async function handleCotizacionesTrack() {
  const tok = await getToken();
  if (!tok) return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };

  const results = [];

  // Procesar todas las empresas en paralelo (mucho más rápido)
  const empresaResults = await Promise.all(
    EMPRESAS.map(async emp => {
      const domainQ = emp.domains.map(d => `@${d}`).join(" OR ");
      const kwQ     = emp.kw.map(k => `"${k}"`).join(" OR ");

      // Enviados: desde COTIZ_SINCE
      const sentQ = `from:${GMAIL_USER} in:sent (${domainQ} OR ${kwQ}) after:${COTIZ_SINCE}`;
      // Recibidos: respuestas de la empresa
      const recvQ = `to:${GMAIL_USER} (from:(${domainQ}) OR ${kwQ}) after:${COTIZ_SINCE}`;

      const [sentR, recvR] = await Promise.all([gmailSearch(sentQ, 20), gmailSearch(recvQ, 20)]);

      if (sentR.error === "NO_GOOGLE_CREDENTIALS") return null; // señal para abortar

      const sent = (sentR.messages || []).sort((a, b) => parseTs(b.date) - parseTs(a.date));
      const recv = (recvR.messages || []).sort((a, b) => parseTs(b.date) - parseTs(a.date));

      const firstSent = sent.length ? sent[sent.length - 1] : null;
      const lastSent  = sent.length ? sent[0] : null;
      const lastRecv  = recv.length ? recv[0] : null;

      // Estado: lógica JS — sin Claude
      let estado = "sin_enviar";
      let diasSinResp = null;
      if (sent.length > 0) {
        const lastSentTs = parseTs(lastSent.date);
        diasSinResp = daysAgo(lastSent.date);
        if (lastRecv && parseTs(lastRecv.date) > lastSentTs) {
          const snip = (lastRecv.snippet || "").toLowerCase();
          estado = /cotiz|propuesta|oferta|precio|valor|presupuest/.test(snip)
            ? "cotizacion_recibida" : "respondido";
        } else {
          estado = diasSinResp > 14 ? "sin_respuesta_urgente"
            : diasSinResp > 5  ? "sin_respuesta"
            : "enviado";
        }
      }

      // Timeline completo (enviados + recibidos mezclados)
      const timeline = [
        ...sent.map(m => ({ type: "sent", date: m.date, subject: m.subject, url: `https://mail.google.com/mail/u/0/#sent/${m.threadId}` })),
        ...recv.map(m => ({ type: "recv", date: m.date, subject: m.subject, snippet: m.snippet, url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}` })),
      ].sort((a, b) => parseTs(b.date) - parseTs(a.date));

      return {
        empresa: emp.name,
        contacto: emp.kw.slice(0, 2).join(" / "),
        email: emp.domains[0],
        estado,
        diasSinResp,
        totalEnviados: sent.length,
        totalRecibidos: recv.length,
        firstSent: firstSent ? { date: firstSent.date, subject: firstSent.subject, url: `https://mail.google.com/mail/u/0/#sent/${firstSent.threadId}` } : null,
        lastSent:  lastSent  ? { date: lastSent.date,  subject: lastSent.subject,  url: `https://mail.google.com/mail/u/0/#sent/${lastSent.threadId}`  } : null,
        lastRecv:  lastRecv  ? { date: lastRecv.date,  subject: lastRecv.subject, snippet: lastRecv.snippet, url: `https://mail.google.com/mail/u/0/#inbox/${lastRecv.threadId}` } : null,
        timeline: timeline.slice(0, 12),
      };
    })
  );

  // Si alguna retornó null → no hay credenciales
  if (empresaResults.some(r => r === null)) return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };

  return { text: JSON.stringify(empresaResults) };
}

// health
async function handleHealth() {
  const hasA = !!process.env.ANTHROPIC_API_KEY;
  const hasG = !!(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  let gOk = false; if (hasG) { try { gOk = !!(await getToken()); } catch {} }
  return { text: JSON.stringify({ status: hasA && gOk ? "healthy" : "degraded", ts: new Date().toISOString(), anthropic: hasA ? "ok" : "missing", google: gOk ? "ok" : (hasG ? "auth_failed" : "missing") }) };
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
const _rl = {};
function rateOk(type, max) {
  const now = Date.now();
  if (!_rl[type]) _rl[type] = [];
  _rl[type] = _rl[type].filter(t => now - t < 60000);
  if (_rl[type].length >= max) return false;
  _rl[type].push(now); return true;
}

// ── Registry ─────────────────────────────────────────────────────────────────
const HANDLERS = {
  chat:               { fn: handleChat,               max: 20 },
  summary:            { fn: handleSummary,            max: 10 },
  licit:              { fn: handleLicit,              max: 5  },
  doc:                { fn: handleDoc,                max: 5  },
  gmail_scan:         { fn: handleGmailScan,          max: 10 },
  clock_sync:         { fn: handleClockSync,          max: 10 },
  cotizaciones_track: { fn: handleCotizacionesTrack,  max: 4  },
  health:             { fn: handleHealth,             max: 60 },
};

export async function POST(req) {
  let type = "unknown";
  try {
    const body = await req.json();
    type = body?.type || "unknown";
    if (!type || typeof type !== "string" || type.length > 50 || body.mcp_servers)
      return Response.json({ error: true, errorCode: "INVALID" }, { status: 400 });
    const h = HANDLERS[type];
    if (!h) return Response.json({ error: true, errorCode: "NOT_FOUND" }, { status: 400 });
    if (!rateOk(type, h.max)) return Response.json({ error: true, errorCode: "RATE_LIMITED" }, { status: 429 });
    return Response.json(await h.fn(body));
  } catch (err) {
    console.error(`[SECPLA][${type}]`, err?.message);
    return Response.json({ text: "", error: true, errorCode: "SERVER_ERROR", errorMessage: err?.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json(safeJSON((await handleHealth()).text, {}));
}
