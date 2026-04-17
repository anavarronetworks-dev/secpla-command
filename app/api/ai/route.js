/**
 * SECPLA Command — API Route v4.0
 * app/api/ai/route.js
 *
 * HANDLERS:
 *   chat              → Asistente IA contextual
 *   summary           → Resumen ejecutivo de proyecto
 *   licit             → Consulta Mercado Público
 *   doc               → Análisis PDF/imagen
 *   gmail_scan        → Bandeja: detecta correos que requieren atención
 *                       Filtra automáticamente: comunicaciones@recoleta.cl
 *   clock_sync        → Reloj control desde Gmail (BionicVision)
 *   convenio_track    → Estado y plazos de convenios
 *   cotizaciones_track → Tracking cotizaciones SNSM 2025 por empresa
 *   health            → Estado de servicios
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Anthropic client ─────────────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constantes ───────────────────────────────────────────────────────────────
const CLOCK_SENDER = "enviomarcaciones@mg.bionicvision.cl";
const GMAIL_USER   = "anavarro@recoleta.cl";

// Remitentes a IGNORAR siempre (spam, boletines, comunicaciones masivas)
const IGNORED_SENDERS = [
  "comunicaciones@recoleta.cl",
  "noreply@",
  "no-reply@",
  "newsletter@",
  "boletin@",
  "notificaciones@mercadopublico.cl",
];

// Empresas cotización SNSM 2025
const COTIZACION_EMPRESAS = [
  { name: "Scharfstein",   domain: "scharfstein.cl",  contacto: "Sebastián Merino / Cristobal Cruz", email: "smerino@scharfstein.cl" },
  { name: "Bionic Vision", domain: "bionicvision.cl", contacto: "Letxy Valero / Rocío Ponce",        email: "lvalero@bionicvision.cl" },
  { name: "Grupo VSM",     domain: "grupovsm.cl",     contacto: "Comunicaciones",                    email: "comunicaciones@grupovsm.cl" },
  { name: "RockTech",      domain: "rocktechla.com",  contacto: "Fabiana Rifo / Sergio",             email: "fabiana.rifo@rocktechla.com" },
  { name: "Securitas",     domain: "securitas.cl",    contacto: "Contacto comercial",                email: "comercial@securitas.cl" },
  { name: "Prosegur",      domain: "prosegur.com",    contacto: "Ventas empresas",                   email: "ventas.empresas@prosegur.com" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractText(content = []) {
  return content.filter(c => c.type === "text").map(c => c.text || "").join("");
}
function safeJSON(raw, fallback) {
  try { return JSON.parse((raw || "").replace(/```json|```/g, "").trim()); }
  catch { return fallback; }
}
function sanitize(s, max = 400) {
  if (typeof s !== "string") return "";
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, max);
}
function isIgnoredSender(from = "") {
  const f = from.toLowerCase();
  return IGNORED_SENDERS.some(ig => f.includes(ig.toLowerCase()));
}

// ── Timeout fetch ────────────────────────────────────────────────────────────
async function fetchT(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// ── OAuth2 con cache y retry ─────────────────────────────────────────────────
let _tok = null, _tokExp = 0;
async function getToken() {
  const r = process.env.GOOGLE_REFRESH_TOKEN;
  const c = process.env.GOOGLE_CLIENT_ID;
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!r || !c || !s) return null;
  if (_tok && Date.now() < _tokExp - 120000) return _tok;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchT("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: r, client_id: c, client_secret: s }),
      }, 10000);
      if (!res.ok) { if (i < 2) { await new Promise(x => setTimeout(x, 1000 * (i + 1))); continue; } return null; }
      const d = await res.json();
      if (!d.access_token) return null;
      _tok = d.access_token;
      _tokExp = Date.now() + (d.expires_in || 3600) * 1000;
      return _tok;
    } catch { if (i < 2) await new Promise(x => setTimeout(x, 1000 * (i + 1))); }
  }
  return null;
}

// ── Gmail search ─────────────────────────────────────────────────────────────
async function gmailSearch(query, max = 50) {
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
    for (let i = 0; i < ld.messages.length; i += 10) {
      const batch = ld.messages.slice(i, i + 10);
      const results = await Promise.all(batch.map(async m => {
        try {
          const mr = await fetchT(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${tok}` } }, 8000
          );
          if (!mr.ok) return null;
          const msg = await mr.json();
          const h = {};
          (msg.payload?.headers || []).forEach(x => { h[x.name] = x.value; });
          return {
            messageId: msg.id,
            threadId: msg.threadId,
            subject: sanitize(h.Subject || "", 300),
            from: sanitize(h.From || "", 200),
            to: sanitize(h.To || "", 300),
            date: h.Date || "",
            snippet: sanitize(msg.snippet || "", 400),
          };
        } catch { return null; }
      }));
      msgs.push(...results.filter(Boolean));
      if (i + 10 < ld.messages.length) await new Promise(x => setTimeout(x, 80));
    }
    return { messages: msgs, error: null };
  } catch (e) {
    return { messages: [], error: "GMAIL_EXCEPTION", detail: e.message };
  }
}

// ── Claude analyze ───────────────────────────────────────────────────────────
async function analyze(system, user, maxTokens = 1200) {
  const content = user.length > 8000 ? user.slice(0, 7900) + "\n[TRUNCADO]" : user;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content }],
      });
      return extractText(r.content);
    } catch (e) {
      if (i === 0 && (e.status === 429 || e.status === 529)) { await new Promise(x => setTimeout(x, 2000)); continue; }
      throw e;
    }
  }
}

// ── Parse date ────────────────────────────────────────────────────────────────
function parseDate(d) { try { return new Date(d).getTime(); } catch { return 0; } }

// ── HANDLERS ─────────────────────────────────────────────────────────────────

async function handleChat({ messages, context, follows }) {
  if (!Array.isArray(messages)) return { text: "Error: messages inválido" };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: `Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro.
Español, directo, ejecutivo. Negritas para datos clave. Montos en CLP completos.
CARTERA:\n${context || "—"}\nSEGUIMIENTOS PENDIENTES:\n${follows || "Ninguno"}\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
    messages: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
  });
  return { text: extractText(res.content) };
}

async function handleSummary({ project, notes }) {
  if (!project?.name) return { text: "Error: proyecto requerido" };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 600,
    system: "Genera resumen ejecutivo 3-5 oraciones. Sin títulos ni markdown. Destaca: estado, gestiones recientes, pendientes, próximos pasos.",
    messages: [{ role: "user", content: `PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget}\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes || "Sin notas"}` }],
  });
  return { text: extractText(res.content) };
}

async function handleLicit({ licitId }) {
  if (!licitId?.trim()) return { text: '{"estado":"Desconocido"}' };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 800,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `Busca en mercadopublico.cl. SOLO JSON sin markdown:
{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"","organismo":"","descripcion":"","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","url":""}`,
    messages: [{ role: "user", content: `Busca licitación: ${sanitize(licitId, 50)}` }],
  });
  return { text: extractText(res.content) };
}

async function handleDoc({ b64, mediaType, isImg }) {
  if (!b64 || typeof b64 !== "string") return { text: '{"error":"Sin datos"}' };
  const cb = isImg
    ? { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: b64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  const res = await client.messages.create({
    model: "claude-sonnet-4-5", max_tokens: 1200,
    messages: [{ role: "user", content: [cb, { type: "text", text: `SOLO JSON sin markdown:
{"title":"","docType":"Convenio|Decreto|Oficio|Resolución|EETT|CDP|Acta|Otro","summary":"2-3 oraciones","codigoProyecto":"","entidadFinancista":"","montoTotal":0,"dates":[{"date":"YYYY-MM-DD","description":""}],"plazoEjecucionFin":"YYYY-MM-DD","plazoConvenioFin":"YYYY-MM-DD","obligations":[""],"tasks":[""],"parties":[""]}` }] }],
  });
  return { text: extractText(res.content) };
}

// ── GMAIL SCAN — bandeja inteligente ─────────────────────────────────────────
// Retorna correos agrupados por thread (el último mensaje de cada hilo)
// Filtra automáticamente remitentes ignorados
// Incluye: quién mandó el último correo, asunto, días sin respuesta, URL
async function handleGmailScan({ since = "2026/04/01", keywords = [] }) {
  const kwQuery = keywords.slice(0, 10).map(k => `"${sanitize(k, 40)}"`).join(" OR ");
  const sinceClean = since.replace(/[^0-9/]/g, "");

  // Buscar correos recibidos relevantes
  const inboxQuery = `to:${GMAIL_USER} after:${sinceClean}${kwQuery ? ` (${kwQuery})` : ""} -from:${CLOCK_SENDER}`;
  const { messages, error } = await gmailSearch(inboxQuery, 50);

  if (error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
  if (error) return { text: "[]", error: true, errorCode: error };
  if (!messages.length) return { text: "[]" };

  // Filtrar remitentes ignorados
  const filtered = messages.filter(m => !isIgnoredSender(m.from));
  if (!filtered.length) return { text: "[]" };

  // Agrupar por threadId → tomar el más reciente
  const threadMap = {};
  for (const m of filtered) {
    if (!threadMap[m.threadId] || parseDate(m.date) > parseDate(threadMap[m.threadId].date)) {
      threadMap[m.threadId] = m;
    }
  }

  const threads = Object.values(threadMap).sort((a, b) => parseDate(b.date) - parseDate(a.date));

  // Calcular días sin respuesta
  const now = Date.now();
  const result = threads.slice(0, 40).map(m => {
    const msgDate = parseDate(m.date);
    const daysDiff = Math.round((now - msgDate) / (1000 * 60 * 60 * 24));
    // Extraer nombre del remitente (sin el email)
    const fromName = m.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || m.from;
    return {
      threadId: m.threadId,
      messageId: m.messageId,
      subject: m.subject,
      from: m.from,
      fromName: fromName,
      date: m.date,
      snippet: m.snippet,
      daysSinceLastMsg: daysDiff,
      threadUrl: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
    };
  });

  return { text: JSON.stringify(result) };
}

// ── CLOCK SYNC ────────────────────────────────────────────────────────────────
async function handleClockSync() {
  const { messages, error } = await gmailSearch(
    `from:${CLOCK_SENDER} subject:"Aviso de registro de marca en reloj control"`, 120
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
  return { text: JSON.stringify(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))) };
}

// ── CONVENIO TRACK ────────────────────────────────────────────────────────────
async function handleConvenioTrack({ projects = [] }) {
  const today = new Date();
  const base = projects.map(p => {
    const fin = p.plazoEjecucionFin || p.deadline || null;
    const days = fin ? Math.round((new Date(fin) - today) / (1000 * 60 * 60 * 24)) : null;
    return {
      projectId: p.id,
      codigoProyecto: p.codigoProyecto || "",
      plazoEjecucionFin: fin || "",
      plazoConvenioFin: p.plazoConvenioFin || "",
      diasRestantes: days,
      estado: days === null ? "sin_plazo" : days < 0 ? "vencido" : days < 30 ? "proximo" : "vigente",
      color: days === null ? "gris" : days < 0 ? "rojo" : days < 30 ? "rojo" : days < 90 ? "amarillo" : "verde",
    };
  });

  // Buscar correos relevantes de convenios
  const { messages, error } = await gmailSearch(
    `to:${GMAIL_USER} (subject:"modificación plazo" OR subject:"ampliación" OR "SNSM23-STP-0039" OR "SPD" OR "GORE") after:2026/02/01`, 15
  );

  if (error === "NO_GOOGLE_CREDENTIALS" || error || !messages.length) return { text: JSON.stringify(base) };

  const summary = messages.slice(0, 8).map(m =>
    `THREAD:${m.threadId} FROM:${m.from} SUBJ:${m.subject} SNIP:${m.snippet?.slice(0, 80)}`
  ).join("\n");

  const upd = safeJSON(await analyze(
    `Detecta modificaciones de plazo en estos correos. Proyectos: ${projects.map(p => `${p.id}(${p.codigoProyecto || "—"})`).join(", ")}
SOLO JSON array: [{"projectId":"","modificacion":"descripcion breve","estado":"en_tramite|aprobada","emailUrl":"https://mail.google.com/mail/u/0/#inbox/THREADID"}]`,
    summary, 600
  ), []);

  for (const u of (Array.isArray(upd) ? upd : [])) {
    const b = base.find(x => x.projectId === u.projectId);
    if (b) { b.modificacion = u.modificacion; b.emailUrl = u.emailUrl; }
  }
  return { text: JSON.stringify(base) };
}

// ── COTIZACIONES TRACK ─────────────────────────────────────────────────────────
async function handleCotizacionesTrack() {
  const results = [];
  for (const emp of COTIZACION_EMPRESAS) {
    const sentQ = `from:${GMAIL_USER} in:sent (to:@${emp.domain} OR ${emp.contacto.split("/")[0].trim()}) after:2026/03/01`;
    const recvQ = `to:${GMAIL_USER} from:@${emp.domain} after:2026/03/01`;

    const [sentR, recvR] = await Promise.all([gmailSearch(sentQ, 10), gmailSearch(recvQ, 10)]);

    if (sentR.error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };

    const sent = (sentR.messages || []).sort((a, b) => parseDate(b.date) - parseDate(a.date));
    const recv = (recvR.messages || []).sort((a, b) => parseDate(b.date) - parseDate(a.date));

    const lastSent = sent[0];
    const firstSent = sent[sent.length - 1];
    const lastRecv = recv[0];

    let estado = "sin_enviar";
    let diasSinResp = null;
    if (sent.length > 0) {
      const lastSentTs = parseDate(lastSent?.date);
      diasSinResp = Math.round((Date.now() - lastSentTs) / (1000 * 60 * 60 * 24));
      estado = lastRecv && parseDate(lastRecv.date) > lastSentTs
        ? ((lastRecv.snippet || "").toLowerCase().match(/cotiz|propuesta|oferta/) ? "cotizacion_recibida" : "respondido")
        : diasSinResp > 7 ? "sin_respuesta_urgente" : diasSinResp > 3 ? "sin_respuesta" : "enviado";
    }

    results.push({
      empresa: emp.name,
      contacto: emp.contacto,
      email: emp.email,
      estado,
      diasSinResp,
      totalEnviados: sent.length,
      totalRecibidos: recv.length,
      firstSent: firstSent ? { date: firstSent.date, subject: firstSent.subject, url: `https://mail.google.com/mail/u/0/#sent/${firstSent.threadId}` } : null,
      lastSent: lastSent ? { date: lastSent.date, subject: lastSent.subject, url: `https://mail.google.com/mail/u/0/#sent/${lastSent.threadId}` } : null,
      lastRecv: lastRecv ? { date: lastRecv.date, subject: lastRecv.subject, snippet: lastRecv.snippet, url: `https://mail.google.com/mail/u/0/#inbox/${lastRecv.threadId}` } : null,
      timeline: [
        ...sent.slice(0, 5).map(m => ({ type: "sent", date: m.date, subject: m.subject, url: `https://mail.google.com/mail/u/0/#sent/${m.threadId}` })),
        ...recv.slice(0, 5).map(m => ({ type: "recv", date: m.date, subject: m.subject, snippet: m.snippet, url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}` })),
      ].sort((a, b) => parseDate(b.date) - parseDate(a.date)),
    });
  }
  return { text: JSON.stringify(results) };
}

async function handleHealth() {
  const hasAnt = !!process.env.ANTHROPIC_API_KEY;
  const hasG = !!(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  let gOk = false;
  if (hasG) { try { gOk = !!(await getToken()); } catch {} }
  return { text: JSON.stringify({ status: hasAnt && gOk ? "healthy" : "degraded", ts: new Date().toISOString(), anthropic: hasAnt ? "ok" : "missing", google: hasG ? (gOk ? "ok" : "auth_failed") : "missing" }) };
}

// ── Rate limiter simple ───────────────────────────────────────────────────────
const _rl = {};
function rateOk(type, max = 10) {
  const now = Date.now();
  if (!_rl[type]) _rl[type] = [];
  _rl[type] = _rl[type].filter(t => now - t < 60000);
  if (_rl[type].length >= max) return false;
  _rl[type].push(now);
  return true;
}

// ── Handler registry ──────────────────────────────────────────────────────────
const HANDLERS = {
  chat:               { fn: handleChat,               max: 20 },
  summary:            { fn: handleSummary,            max: 10 },
  licit:              { fn: handleLicit,              max: 5  },
  doc:                { fn: handleDoc,                max: 5  },
  gmail_scan:         { fn: handleGmailScan,          max: 6  },
  clock_sync:         { fn: handleClockSync,          max: 8  },
  convenio_track:     { fn: handleConvenioTrack,      max: 5  },
  cotizaciones_track: { fn: handleCotizacionesTrack,  max: 4  },
  health:             { fn: handleHealth,             max: 60 },
};

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req) {
  let type = "unknown";
  try {
    const body = await req.json();
    type = body?.type || "unknown";
    if (!type || typeof type !== "string" || type.length > 50)
      return Response.json({ error: true, errorCode: "INVALID", errorMessage: "type inválido" }, { status: 400 });
    if (body.mcp_servers)
      return Response.json({ error: true, errorCode: "FORBIDDEN", errorMessage: "mcp_servers no permitido" }, { status: 400 });

    const handler = HANDLERS[type];
    if (!handler)
      return Response.json({ error: true, errorCode: "NOT_FOUND", errorMessage: `Handler '${type}' no existe` }, { status: 400 });

    if (!rateOk(type, handler.max))
      return Response.json({ error: true, errorCode: "RATE_LIMITED", errorMessage: "Demasiadas solicitudes. Espera 1 minuto." }, { status: 429 });

    const result = await handler.fn(body);
    return Response.json(result);
  } catch (err) {
    console.error(`[SECPLA] [${type}]`, err?.message);
    return Response.json({ text: "", error: true, errorCode: "SERVER_ERROR", errorMessage: err?.message || "Error desconocido" }, { status: 500 });
  }
}

export async function GET() {
  const r = await handleHealth();
  return Response.json(JSON.parse(r.text));
}
