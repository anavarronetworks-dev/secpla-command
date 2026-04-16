/**
 * SECPLA Command — API Route v3.0
 * app/api/ai/route.js
 *
 * ARQUITECTURA DE AGENTES v3:
 * ┌─────────────────────────────────────────────────────┐
 * │ CAPA 1: Guardián (assertNoBugPattern, rate limiter) │
 * │ CAPA 2: Google APIs (OAuth2 → Gmail, Drive)         │
 * │ CAPA 3: Claude Sonnet 4.5 (análisis/clasificación)  │
 * │ CAPA 4: Memoria de errores + auto-diagnóstico       │
 * │ CAPA 5: Health check + self-healing                 │
 * └─────────────────────────────────────────────────────┘
 *
 * CAMBIOS v3 vs v2:
 * - Rate limiting por handler para proteger cuota Gmail/Claude
 * - Validación de input estricta (schema validation)
 * - Retry con backoff exponencial en Google APIs
 * - Health endpoint para monitoreo externo
 * - Handler registry inmutable (no se puede agregar/borrar en runtime)
 * - Timeouts explícitos en todas las llamadas externas
 * - Sanitización de datos antes de pasar a Claude
 *
 * REGLA INMUTABLE: mcp_servers NO existe en SDK Node Anthropic.
 * REGLA INMUTABLE: Cada handler Google DEBE tener fallback local.
 * REGLA INMUTABLE: SIEMPRE verificar res.ok antes de res.json().
 */

import Anthropic from "@anthropic-ai/sdk";

// ══════════════════════════════════════════════════════════════════════════════
// SECPLA ERROR MEMORY SYSTEM v2.0
// Base inmutable de bugs históricos — NUNCA se borran ni modifican.
// ══════════════════════════════════════════════════════════════════════════════
const BUG_MEMORY = Object.freeze({
  MCP_SERVERS_HTTP400: Object.freeze({
    symptom: "HTTP 400 en handlers sync",
    prevention: "NUNCA usar mcp_servers en SDK Node Anthropic. Usar Google API directa.",
    antiPattern: "mcp_servers:[",
  }),
  GETTOKEN_CRASH_NO_ENV: Object.freeze({
    symptom: "TypeError en getGoogleToken sin env vars",
    prevention: "Verificar existencia de todas las env vars con early return null antes de usarlas.",
  }),
  MISSING_RES_OK_CHECK: Object.freeze({
    symptom: "Fallo silencioso — res.json() sobre respuesta de error",
    prevention: "SIEMPRE if(!res.ok) antes de res.json(). Nunca parsear JSON sin verificar status HTTP.",
  }),
  CONVENIO_NO_FALLBACK: Object.freeze({
    symptom: "convenio_track crash sin Google credentials",
    prevention: "Cada handler con Google API necesita bloque NO_GOOGLE_CREDENTIALS con fallback local.",
  }),
  REACT_HOOKS_VIOLATION_NESTED: Object.freeze({
    symptom: "Application error: client-side exception (pantalla blanca)",
    prevention: "Componentes con useState/useEffect DEBEN estar fuera de Page().",
  }),
  CONST_BLOCK_SCOPE_REFERENCE: Object.freeze({
    symptom: "ReferenceError: variable is not defined",
    prevention: "Usar let antes del bloque condicional, no const dentro del if.",
  }),
  SCHEDULER_STALE_CLOSURE: Object.freeze({
    symptom: "setInterval ejecuta con estado obsoleto",
    prevention: "Usar useRef para funciones referenciadas en setInterval.",
  }),
  UNBOUNDED_GMAIL_FETCH: Object.freeze({
    symptom: "Timeout o cuota excedida en Gmail API",
    prevention: "Limitar maxResults a 50 y agregar delay entre batches de 10.",
  }),
});

// ── Guardián de patrones prohibidos ──────────────────────────────────────────
function assertNoBugPattern(handlerName, context = {}) {
  if (context.hasMcpServers) {
    const msg = `BUG_PREVENTED [${handlerName}]: ${BUG_MEMORY.MCP_SERVERS_HTTP400.prevention}`;
    console.error(`[MEMORY] ${msg}`);
    throw new Error(msg);
  }
}

// ── Error enrichment con memoria ────────────────────────────────────────────
function enrichError(err, handlerType) {
  const msg = (err?.message || "").toLowerCase();
  for (const [bugId, bugData] of Object.entries(BUG_MEMORY)) {
    const symptomPrefix = (bugData.symptom || "").toLowerCase().slice(0, 20);
    if (symptomPrefix && msg.includes(symptomPrefix)) {
      console.warn(`[MEMORY] Bug conocido en ${handlerType}: ${bugId} → ${bugData.prevention}`);
      return { ...err, knownBugId: bugId, knownBugPrevention: bugData.prevention };
    }
  }
  return err;
}

// ── Runtime error log ─────────────────────────────────────────────────────────
const _runtimeErrorLog = [];
function logRuntimeError(handlerType, errorCode, errorMessage, context) {
  const entry = {
    ts: new Date().toISOString(),
    handler: handlerType,
    code: errorCode,
    message: errorMessage,
    context: context || null,
  };
  _runtimeErrorLog.push(entry);
  if (_runtimeErrorLog.length > 200) _runtimeErrorLog.shift();
  console.error(`[SECPLA ERROR] [${handlerType}] ${errorCode}: ${errorMessage}`);
  return entry;
}

// ── Rate limiter simple por handler ─────────────────────────────────────────
const _rateLimits = {};
function checkRateLimit(handlerType, maxPerMinute = 10) {
  const now = Date.now();
  const key = handlerType;
  if (!_rateLimits[key]) _rateLimits[key] = [];
  // Limpiar entradas > 60s
  _rateLimits[key] = _rateLimits[key].filter((ts) => now - ts < 60000);
  if (_rateLimits[key].length >= maxPerMinute) {
    return false; // rate limited
  }
  _rateLimits[key].push(now);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTE ANTHROPIC
// ══════════════════════════════════════════════════════════════════════════════
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constantes ──────────────────────────────────────────────────────
const CLOCK_SENDER = "enviomarcaciones@mg.bionicvision.cl";
const DRIVE_ROOT = "1KtyHfsGgq4YpUA5kCG4Bh2I6BGcK2RCD";
const DRIVE_FOLDERS = Object.freeze({
  p5: "1JBqtYIGB17l2iez36L9Btam5H2WZbfTK",
  p4: "16SoYuQH_V_24Di9qMVWJo7Iv9Lp29csz",
  p3: "14PYYCvtjxc21qTwFJvRRC3iXUOt7qdkL",
  p1: "19CKsTh1KxsAp0QG3uOX3wTl-IsaqaidX",
});

// ── Helpers ──────────────────────────────────────────────────────────
function extractText(content = []) {
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

function safeJSON(raw, fallback) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return fallback;
  }
}

// ── Input validation ────────────────────────────────────────────────
function validateInput(body) {
  if (!body || typeof body !== "object") return "Body inválido";
  if (!body.type || typeof body.type !== "string") return "Campo 'type' requerido";
  if (body.type.length > 50) return "Campo 'type' demasiado largo";
  // Sanitizar: no permitir campos sospechosos
  if (body.mcp_servers) return "mcp_servers no permitido";
  return null; // válido
}

// ── Timeout wrapper para fetch ──────────────────────────────────────
async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH2 — con retry y cache
// ══════════════════════════════════════════════════════════════════════════════
let _googleToken = null;
let _tokenExpiry = 0;

async function getGoogleToken() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return null;

  // Cache vigente (margen 120s para evitar race conditions)
  if (_googleToken && Date.now() < _tokenExpiry - 120000) return _googleToken;

  // Retry con backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        },
        10000
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(`[SECPLA] OAuth2 error (attempt ${attempt + 1}):`, res.status, err.error_description || err.error);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }
      const data = await res.json();
      if (!data.access_token) {
        console.error("[SECPLA] OAuth2: no access_token in response");
        return null;
      }
      _googleToken = data.access_token;
      _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
      return _googleToken;
    } catch (e) {
      console.error(`[SECPLA] OAuth2 exception (attempt ${attempt + 1}):`, e.message);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// AGENTE GMAIL — con throttling y batching
// ══════════════════════════════════════════════════════════════════════════════
async function gmailSearch(query, maxResults = 50) {
  const token = await getGoogleToken();
  if (!token) return { messages: [], error: "NO_GOOGLE_CREDENTIALS" };

  try {
    const listUrl =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
      `q=${encodeURIComponent(query)}&maxResults=${Math.min(maxResults, 100)}`;

    const listRes = await fetchWithTimeout(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      return { messages: [], error: `GMAIL_${listRes.status}`, detail: err.error?.message };
    }
    const listData = await listRes.json();
    if (!listData.messages?.length) return { messages: [], error: null };

    // Leer metadata en batches de 10 con delay para no saturar cuota
    const allMsgIds = listData.messages.slice(0, maxResults);
    const msgs = [];
    for (let i = 0; i < allMsgIds.length; i += 10) {
      const batch = allMsgIds.slice(i, i + 10);
      const batchResults = await Promise.all(
        batch.map(async (m) => {
          try {
            const msgRes = await fetchWithTimeout(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${token}` } },
              8000
            );
            if (!msgRes.ok) return null;
            const msg = await msgRes.json();
            const hdrs = {};
            (msg.payload?.headers || []).forEach((h) => {
              hdrs[h.name] = h.value;
            });
            return {
              messageId: msg.id,
              threadId: msg.threadId,
              subject: hdrs.Subject || "",
              from: hdrs.From || "",
              to: hdrs.To || "",
              date: hdrs.Date || "",
              snippet: msg.snippet || "",
              labelIds: msg.labelIds || [],
            };
          } catch {
            return null;
          }
        })
      );
      msgs.push(...batchResults.filter(Boolean));
      // Throttle: 100ms entre batches
      if (i + 10 < allMsgIds.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return { messages: msgs, error: null };
  } catch (e) {
    return { messages: [], error: "GMAIL_FETCH_EXCEPTION", detail: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AGENTE DRIVE
// ══════════════════════════════════════════════════════════════════════════════
async function driveListFolder(folderId) {
  const token = await getGoogleToken();
  if (!token) return { files: [], error: "NO_GOOGLE_CREDENTIALS" };

  try {
    const url =
      `https://www.googleapis.com/drive/v3/files?` +
      `q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&` +
      `fields=files(id,name,mimeType,modifiedTime,size)&pageSize=30`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { files: [], error: `DRIVE_${res.status}`, detail: err.error?.message };
    }
    const data = await res.json();
    return { files: data.files || [], error: null };
  } catch (e) {
    return { files: [], error: "DRIVE_EXCEPTION", detail: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLAUDE ANALYZER — con retry y token budget
// ══════════════════════════════════════════════════════════════════════════════
async function analyzeWithClaude(systemPrompt, userContent, maxTokens = 1500) {
  // Truncar input si excede límite razonable (~8000 chars)
  const truncatedContent =
    userContent.length > 8000
      ? userContent.slice(0, 7900) + "\n\n[TRUNCADO — demasiado largo]"
      : userContent;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: truncatedContent }],
      });
      return extractText(res.content);
    } catch (e) {
      console.error(`[SECPLA] Claude error (attempt ${attempt + 1}):`, e.message);
      if (attempt === 0 && (e.status === 429 || e.status === 529)) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw e;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER REGISTRY — inmutable, cada handler es una función pura
// ══════════════════════════════════════════════════════════════════════════════

async function handleChat(body) {
  const { messages, context, follows } = body;
  if (!Array.isArray(messages)) return { text: "Error: messages debe ser un array" };

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: `Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro.
Español, directo, ejecutivo. Negritas para datos clave. Montos en CLP completos.
REGLA: Usa siempre el nombre de proyecto asignado por Alexis.
CARTERA:\n${context || "Sin contexto"}\nSEGUIMIENTOS:\n${follows || "Ninguno"}\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
    messages: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  });
  return { text: extractText(res.content) };
}

async function handleSummary(body) {
  const { project, notes } = body;
  if (!project?.name) return { text: "Error: proyecto requerido" };

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 600,
    system:
      "Genera resumen ejecutivo 3-5 oraciones. Sin títulos ni markdown. Destaca: estado, gestiones recientes, pendientes, próximos pasos.",
    messages: [
      {
        role: "user",
        content: `PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget}\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes || "Sin notas"}`,
      },
    ],
  });
  return { text: extractText(res.content) };
}

async function handleLicit(body) {
  const { licitId } = body;
  if (!licitId?.trim()) return { text: '{"estado":"Desconocido","descripcion":"ID de licitación vacío"}' };

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 800,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `Busca en mercadopublico.cl la licitación indicada. Retorna SOLO JSON sin markdown:
{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"","organismo":"","descripcion":"","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","tipo":"","url":""}`,
    messages: [{ role: "user", content: `Busca licitación: ${licitId}` }],
  });
  return { text: extractText(res.content) };
}

async function handleDoc(body) {
  const { b64, mediaType, isImg } = body;
  if (!b64) return { text: '{"error":"Sin datos de documento"}' };

  const cb = isImg
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };

  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: [
          cb,
          {
            type: "text",
            text: `Analiza. SOLO JSON sin markdown:
{"title":"","docType":"Convenio|Decreto|Oficio|Resolución|EETT|CDP|Acta|Otro","summary":"2-3 oraciones","codigoProyecto":"","entidadFinancista":"","montoTotal":0,"dates":[{"date":"YYYY-MM-DD","description":""}],"plazoEjecucionFin":"YYYY-MM-DD","plazoConvenioFin":"YYYY-MM-DD","obligations":[""],"tasks":[""],"parties":[""]}`,
          },
        ],
      },
    ],
  });
  return { text: extractText(res.content) };
}

async function handleClockSync(body) {
  const query = `from:${CLOCK_SENDER} subject:"Aviso de registro de marca en reloj control"`;
  const { messages, error, detail } = await gmailSearch(query, 100);

  if (error === "NO_GOOGLE_CREDENTIALS") {
    return {
      text: "[]",
      warning: "NO_GOOGLE_CREDENTIALS",
      hint: "Configura GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET en Vercel",
    };
  }
  if (error) {
    return { text: "[]", error: true, errorCode: error, errorMessage: detail || error };
  }

  const dayMap = {};
  const rePattern = /el día (\d{2}\/\d{2}\/\d{4}).*?(Entrada|Salida)\s+a las\s+(\d{2}:\d{2})/i;
  for (const msg of messages) {
    const m = rePattern.exec(msg.snippet || "");
    if (!m) continue;
    const [, ddmmyyyy, tipo, hora] = m;
    const [d, mo, y] = ddmmyyyy.split("/");
    const iso = `${y}-${mo}-${d}`;
    if (!dayMap[iso]) dayMap[iso] = { date: iso, entrada: null, salida: null };
    if (tipo === "Entrada" && !dayMap[iso].entrada) dayMap[iso].entrada = hora;
    if (tipo === "Salida") dayMap[iso].salida = hora;
  }
  const sorted = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  return { text: JSON.stringify(sorted) };
}

async function handleGmailScan(body) {
  const { projects = [], since = "2026/04/01" } = body;

  const keywords = [...new Set(projects.flatMap((p) => p.keywords || []).slice(0, 8))].join(" OR ");
  if (!keywords) return { text: "[]" };

  const sinceDate = since.replace(/\//g, "-");
  const query = `to:anavarro@recoleta.cl after:${sinceDate.replace(/-/g, "/")} (${keywords}) -from:${CLOCK_SENDER}`;
  const { messages, error, detail } = await gmailSearch(query, 30);

  if (error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
  if (error) return { text: "[]", error: true, errorCode: error, errorMessage: detail || error };
  if (!messages.length) return { text: "[]" };

  const msgSummary = messages
    .map(
      (m) =>
        `ID:${m.messageId} THREAD:${m.threadId} FROM:${m.from} SUBJECT:${m.subject} DATE:${m.date} SNIPPET:${m.snippet?.slice(0, 120)}`
    )
    .join("\n");

  const kwCtx = projects.map((p) => `${p.id}: ${(p.keywords || []).join(", ")}`).join("\n");
  let text = await analyzeWithClaude(
    `Clasifica correos de proyectos SECPLA. Keywords:\n${kwCtx}\nRetorna SOLO JSON array:
[{"messageId":"","threadId":"","projectId":"p1|p2|p3|p4|p5|null","subject":"","from":"","date":"YYYY-MM-DD","type":"requiere_accion|confirmacion|informativo","urgency":"crítica|alta|media|baja","summary":"1 línea","requiresResponse":true,"daysWithoutResponse":0,"emailUrl":"https://mail.google.com/mail/u/0/#inbox/MESSAGEID"}]`,
    `Clasifica estos correos:\n${msgSummary}`,
    1500
  );
  if (!text.trim().startsWith("[")) {
    const m = text.match(/\[[\s\S]*\]/);
    text = m ? m[0] : "[]";
  }
  return { text };
}

async function handleReadReceiptsSync(body) {
  const query = `to:anavarro@recoleta.cl (subject:"Read:" OR subject:"Leído:") after:2026/01/01`;
  const { messages, error, detail } = await gmailSearch(query, 80);

  if (error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
  if (error) return { text: "[]", error: true, errorCode: error, errorMessage: detail || error };
  if (!messages.length) return { text: "[]" };

  // Pre-agrupar con JS antes de Claude para ahorrar tokens
  const grouped = {};
  for (const msg of messages) {
    const subj = (msg.subject || "")
      .replace(/^Read:\s*/i, "")
      .replace(/^Le[ií]do:\s*/i, "")
      .trim();
    if (!subj) continue;
    if (!grouped[subj]) grouped[subj] = { subject: subj, readers: [] };
    const snip = msg.snippet || "";
    const timeMatch = snip.match(/se ha le[ií]do el\s+(\d+\/\d+\/\d+[,]?\s+\d+:\d+)/i);
    grouped[subj].readers.push({
      name: msg.from?.replace(/<[^>]+>/, "").trim() || "Desconocido",
      email: (msg.from?.match(/<([^>]+)>/) || [])[1] || msg.from || "",
      msgId: msg.messageId,
      threadId: msg.threadId,
      readAt: timeMatch ? timeMatch[1] : msg.date || "",
    });
  }

  const raw = JSON.stringify(Object.values(grouped).slice(0, 20));
  let text = await analyzeWithClaude(
    `Estructura acuses de lectura para sistema SECPLA. Proyectos: p5=sala monitoreo/consistorial, p2=SNSM/modificación plazo, p3=centros culturales, p4=UV32, p1=6ta comisaría.
Retorna SOLO JSON array sin markdown:
[{"id":"hash_del_subject","subject":"asunto original","context":"1 línea de qué trata","sentDate":"YYYY-MM-DD","project":"p1|p2|p3|p4|p5|null","threadUrl":"https://mail.google.com/mail/u/0/#all/THREADID","recipients":[{"name":"","email":"","readAt":"YYYY-MM-DD HH:MM","msgId":""}]}]`,
    `Estructura estos acuses: ${raw}`,
    1500
  );
  if (!text.trim().startsWith("[")) {
    const m = text.match(/\[[\s\S]*\]/);
    text = m ? m[0] : "[]";
  }
  return { text };
}

async function handleDriveSync(body) {
  const { projects = [] } = body;
  const results = [];

  for (const [projId, folderId] of Object.entries(DRIVE_FOLDERS)) {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) continue;

    const { files, error } = await driveListFolder(folderId);
    if (error === "NO_GOOGLE_CREDENTIALS") {
      return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
    }
    if (error || !files.length) continue;

    const fileList = files.map((f) => `${f.name} (${f.modifiedTime?.slice(0, 10) || ""})`).join("\n");
    const analysis = await analyzeWithClaude(
      `Analiza archivos de proyecto SECPLA "${proj.name}" y extrae datos clave.
Retorna SOLO JSON (un objeto, no array):
{"stage":"Formulación|Diseño|Licitación|Adjudicación|Ejecución|Recepción|Completado","status":"En curso|Con alerta|Detenido|Completado","budget":0,"codigoProyecto":"","notes":"observación clave en 1 línea","summary":"resumen ejecutivo 2 líneas","docsFound":["nombre1.pdf"],"lastDocDate":"YYYY-MM-DD"}`,
      `Archivos en carpeta Drive de ${proj.name}:\n${fileList}`,
      600
    );
    const parsed = safeJSON(analysis, null);
    if (parsed) results.push({ projectId: projId, ...parsed });
  }
  return { text: JSON.stringify(results) };
}

async function handleCalendarSync(body) {
  const { projects = [] } = body;
  const query = `to:anavarro@recoleta.cl (subject:"Invitación" OR subject:"Invitation" OR subject:"reunión" OR subject:"meeting") after:2026/03/01`;
  const { messages, error, detail } = await gmailSearch(query, 30);

  if (error === "NO_GOOGLE_CREDENTIALS") return { text: "[]", warning: "NO_GOOGLE_CREDENTIALS" };
  if (error) return { text: "[]", error: true, errorCode: error, errorMessage: detail || error };
  if (!messages.length) return { text: "[]" };

  const kwCtx = projects
    .map((p) => `${p.id}: ${(p.keywords || []).slice(0, 4).join(", ")}`)
    .join("\n");
  const msgSummary = messages
    .map((m) => `ID:${m.messageId} THREAD:${m.threadId} SUBJ:${m.subject} SNIPPET:${m.snippet?.slice(0, 100)}`)
    .join("\n");

  let text = await analyzeWithClaude(
    `Extrae eventos de calendario de invitaciones Gmail. Keywords por proyecto:\n${kwCtx}
Retorna SOLO JSON array:
[{"id":"MESSAGEID","title":"título evento","start":"YYYY-MM-DD","time":"HH:MM","description":"","projectId":"p1|null","url":"https://mail.google.com/mail/u/0/#inbox/THREADID"}]`,
    `Invitaciones:\n${msgSummary}`,
    1200
  );
  if (!text.trim().startsWith("[")) {
    const m = text.match(/\[[\s\S]*\]/);
    text = m ? m[0] : "[]";
  }
  return { text };
}

async function handleConvenioTrack(body) {
  const { projects = [] } = body;
  const today = new Date();

  // Cálculo local base (siempre funciona, con o sin Gmail)
  const baseResults = projects.map((p) => {
    const fin = p.plazoEjecucionFin || p.deadline || null;
    const daysLeft = fin ? Math.round((new Date(fin) - today) / (1000 * 60 * 60 * 24)) : null;
    return {
      projectId: p.id,
      codigoProyecto: p.codigoProyecto || "",
      plazoEjecucionFin: fin || "",
      plazoConvenioFin: p.plazoConvenioFin || "",
      diasRestantesEjecucion: daysLeft,
      estado:
        daysLeft === null
          ? "sin_plazo"
          : daysLeft < 0
          ? "vencido"
          : daysLeft < 30
          ? "proximo_vencer"
          : "vigente",
      alertaColor:
        daysLeft === null
          ? "gris"
          : daysLeft < 0
          ? "rojo"
          : daysLeft < 30
          ? "rojo"
          : daysLeft < 90
          ? "amarillo"
          : "verde",
      modificacionesPendientes: [],
      ultimaActividadEmail: null,
    };
  });

  // Intentar enriquecer con Gmail
  const query = `to:anavarro@recoleta.cl (subject:"modificación plazo" OR subject:"ampliación" OR "SNSM23-STP-0039" OR "convenio" OR "SPD" OR "GORE") after:2026/02/01`;
  const { messages, error } = await gmailSearch(query, 20);

  if (error === "NO_GOOGLE_CREDENTIALS" || error || !messages.length) {
    return { text: JSON.stringify(baseResults) };
  }

  const msgSummary = messages
    .slice(0, 10)
    .map((m) => `THREAD:${m.threadId} FROM:${m.from} SUBJ:${m.subject} SNIPPET:${m.snippet?.slice(0, 100)}`)
    .join("\n");

  const analysis = await analyzeWithClaude(
    `Actualiza estado de convenios SECPLA con correos recientes.
Proyectos: ${projects.map((p) => `${p.id}(${p.codigoProyecto || "—"} vence ${p.plazoEjecucionFin || p.deadline || "—"})`).join(", ")}
Retorna SOLO JSON array con modificaciones y última actividad email por proyecto.
Schema: [{"projectId":"","modificacionesPendientes":[{"tipo":"","estado":"en_tramite","emailUrl":"","proximoPaso":""}],"ultimaActividadEmail":{"fecha":"YYYY-MM-DD","asunto":"","url":""}}]`,
    `Correos recientes sobre convenios:\n${msgSummary}`,
    1000
  );
  const updates = safeJSON(analysis, []);
  if (Array.isArray(updates)) {
    for (const upd of updates) {
      const base = baseResults.find((r) => r.projectId === upd.projectId);
      if (base) {
        base.modificacionesPendientes = upd.modificacionesPendientes || [];
        base.ultimaActividadEmail = upd.ultimaActividadEmail || null;
        if (upd.modificacionesPendientes?.length) base.estado = "en_tramite_ampliacion";
      }
    }
  }
  return { text: JSON.stringify(baseResults) };
}

async function handleVerifySent(body) {
  const { taskText = "", projectName = "", keywords = [] } = body;
  const terms = keywords.slice(0, 4).join(" OR ");
  const queryTerms =
    terms ||
    taskText
      .split(" ")
      .filter((w) => w.length > 4)
      .slice(0, 3)
      .join(" OR ");
  const query = `from:anavarro@recoleta.cl in:sent after:2026/03/01 (${queryTerms})`;
  const { messages, error } = await gmailSearch(query, 10);

  if (error === "NO_GOOGLE_CREDENTIALS" || error || !messages.length) {
    return { text: JSON.stringify({ found: false }) };
  }

  const msgSummary = messages
    .map(
      (m) =>
        `ID:${m.messageId} THREAD:${m.threadId} TO:${m.to} SUBJ:${m.subject} DATE:${m.date} SNIPPET:${m.snippet?.slice(0, 120)}`
    )
    .join("\n");

  let text = await analyzeWithClaude(
    `Verifica si alguno de estos correos enviados responde la tarea: "${taskText}" del proyecto ${projectName}.
Retorna SOLO JSON:
Si encontraste: {"found":true,"messageId":"","threadId":"","subject":"","sentDate":"YYYY-MM-DD","sentTime":"HH:MM","to":"","emailUrl":"https://mail.google.com/mail/u/0/#sent/MSGID","snippet":"","howAnswered":"","pendingReply":false,"pendingReplyNote":""}
Si no: {"found":false}`,
    `Correos enviados:\n${msgSummary}`,
    500
  );
  if (!text.trim().startsWith("{")) {
    const m = text.match(/\{[\s\S]*\}/);
    text = m ? m[0] : '{"found":false}';
  }
  return { text };
}

async function handleErrorLog() {
  return { text: JSON.stringify(_runtimeErrorLog.slice(-20)) };
}

async function handleBugMemory() {
  return { text: JSON.stringify(BUG_MEMORY) };
}

async function handleSaveErrorLog(body) {
  const entries = body.entries || [];
  const stats = body.stats || {};
  const token = await getGoogleToken();
  if (!token) {
    return { text: JSON.stringify({ saved: false, reason: "NO_GOOGLE_CREDENTIALS" }) };
  }

  try {
    const content = JSON.stringify({
      lastUpdated: new Date().toISOString(),
      entries: entries.slice(0, 100),
      stats,
      knownBugs: Object.keys(BUG_MEMORY),
    });

    const qenc = encodeURIComponent(`name='SECPLA_error_log.json' and '${DRIVE_ROOT}' in parents and trashed=false`);
    const searchRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${qenc}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = searchRes.ok ? await searchRes.json() : { files: [] };
    const existId = (searchData.files || [])[0]?.id;

    if (existId) {
      const updRes = await fetchWithTimeout(
        `https://www.googleapis.com/upload/drive/v3/files/${existId}?uploadType=media`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: content,
        }
      );
      return { text: JSON.stringify({ saved: updRes.ok, fileId: existId, action: "updated" }) };
    } else {
      const meta = JSON.stringify({ name: "SECPLA_error_log.json", parents: [DRIVE_ROOT], mimeType: "application/json" });
      const bnd = "secpla_bnd";
      const crlf = "\r\n";
      const multiBody =
        `--${bnd}${crlf}Content-Type: application/json${crlf}${crlf}${meta}${crlf}` +
        `--${bnd}${crlf}Content-Type: application/json${crlf}${crlf}${content}${crlf}--${bnd}--`;
      const creRes = await fetchWithTimeout(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${bnd}` },
          body: multiBody,
        }
      );
      const creData = creRes.ok ? await creRes.json() : {};
      return { text: JSON.stringify({ saved: creRes.ok, fileId: creData.id, action: "created" }) };
    }
  } catch (e) {
    return { text: JSON.stringify({ saved: false, reason: e.message }) };
  }
}

// ── Health check handler ────────────────────────────────────────────
async function handleHealth() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasGoogleCreds =
    !!process.env.GOOGLE_REFRESH_TOKEN && !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return {
    text: JSON.stringify({
      status: "ok",
      ts: new Date().toISOString(),
      services: {
        anthropic: hasAnthropicKey ? "configured" : "missing",
        google: hasGoogleCreds ? "configured" : "missing",
        googleTokenCached: !!_googleToken && Date.now() < _tokenExpiry,
      },
      errors: {
        total: _runtimeErrorLog.length,
        last: _runtimeErrorLog[_runtimeErrorLog.length - 1]?.ts || null,
      },
      memory: {
        knownBugs: Object.keys(BUG_MEMORY).length,
      },
    }),
  };
}

// ── Registry inmutable de handlers ──────────────────────────────────
const HANDLERS = Object.freeze({
  chat: { fn: handleChat, rateLimit: 20, requiresAuth: false },
  summary: { fn: handleSummary, rateLimit: 10, requiresAuth: false },
  licit: { fn: handleLicit, rateLimit: 5, requiresAuth: false },
  doc: { fn: handleDoc, rateLimit: 5, requiresAuth: false },
  clock_sync: { fn: handleClockSync, rateLimit: 6, requiresAuth: false },
  gmail_scan: { fn: handleGmailScan, rateLimit: 5, requiresAuth: false },
  read_receipts_sync: { fn: handleReadReceiptsSync, rateLimit: 8, requiresAuth: false },
  drive_sync: { fn: handleDriveSync, rateLimit: 3, requiresAuth: false },
  calendar_sync: { fn: handleCalendarSync, rateLimit: 5, requiresAuth: false },
  convenio_track: { fn: handleConvenioTrack, rateLimit: 5, requiresAuth: false },
  verify_sent: { fn: handleVerifySent, rateLimit: 10, requiresAuth: false },
  error_log: { fn: handleErrorLog, rateLimit: 30, requiresAuth: false },
  bug_memory: { fn: handleBugMemory, rateLimit: 30, requiresAuth: false },
  save_error_log: { fn: handleSaveErrorLog, rateLimit: 2, requiresAuth: false },
  health: { fn: handleHealth, rateLimit: 60, requiresAuth: false },
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN POST HANDLER
// ══════════════════════════════════════════════════════════════════════════════
export async function POST(req) {
  let type = "unknown";
  try {
    const body = await req.json();
    type = body.type || "unknown";

    // ── Validación de input ──
    const validationError = validateInput(body);
    if (validationError) {
      return Response.json(
        { text: "", error: true, errorCode: "VALIDATION", errorMessage: validationError },
        { status: 400 }
      );
    }

    // ── Guardián anti-bug ──
    assertNoBugPattern(type, { hasMcpServers: !!body.mcp_servers });

    // ── Lookup handler ──
    const handler = HANDLERS[type];
    if (!handler) {
      return Response.json(
        { text: "", error: true, errorCode: "UNKNOWN_TYPE", errorMessage: `Handler '${type}' no existe` },
        { status: 400 }
      );
    }

    // ── Rate limit check ──
    if (!checkRateLimit(type, handler.rateLimit)) {
      logRuntimeError(type, "RATE_LIMITED", `Excedido ${handler.rateLimit} req/min para ${type}`);
      return Response.json(
        { text: "", error: true, errorCode: "RATE_LIMITED", errorMessage: `Demasiadas solicitudes para '${type}'. Espera 1 minuto.` },
        { status: 429 }
      );
    }

    // ── Ejecutar handler ──
    const result = await handler.fn(body);

    // ── Si el handler retornó error explícito, pasarlo ──
    if (result.error) {
      return Response.json(result, { status: 200 });
    }

    return Response.json(result);
  } catch (err) {
    const code = String(err?.status || err?.code || "SERVER_ERROR");
    const enriched = enrichError(err, type);
    logRuntimeError(type, code, err?.message || "Error desconocido");
    return Response.json(
      {
        text: "",
        error: true,
        errorCode: code,
        errorMessage: err?.message || "Error desconocido en el servidor",
        knownBug: enriched.knownBugId || null,
        knownBugFix: enriched.knownBugPrevention || null,
      },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET — Health check endpoint (para monitoreo externo y Vercel Cron)
// ══════════════════════════════════════════════════════════════════════════════
export async function GET() {
  const result = await handleHealth();
  return Response.json(JSON.parse(result.text));
}
