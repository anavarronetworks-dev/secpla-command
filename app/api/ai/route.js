/**
 * SECPLA Command — API Route
 * app/api/ai/route.js
 *
 * ARQUITECTURA DE AGENTES:
 * Cada handler es un agente especializado que:
 * 1. Obtiene datos reales (Google APIs via OAuth2 service account)
 * 2. Los procesa con Claude claude-sonnet-4-5 para análisis/clasificación
 * 3. Retorna JSON estructurado al frontend
 *
 * NOTA CRÍTICA: mcp_servers NO existe en el SDK de Node de Anthropic.
 * Solo funciona en Claude.ai UI. Usar fetch directo a Google APIs.
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constantes ──────────────────────────────────────────────────────
const CLOCK_SENDER  = "enviomarcaciones@mg.bionicvision.cl";
const CLOCK_LABEL   = "Label_622782252477718803";
const DRIVE_ROOT    = "1KtyHfsGgq4YpUA5kCG4Bh2I6BGcK2RCD";
const DRIVE_FOLDERS = {
  p5:"1JBqtYIGB17l2iez36L9Btam5H2WZbfTK",
  p4:"16SoYuQH_V_24Di9qMVWJo7Iv9Lp29csz",
  p3:"14PYYCvtjxc21qTwFJvRRC3iXUOt7qdkL",
  p1:"19CKsTh1KxsAp0QG3uOX3wTl-IsaqaidX",
};

// ── helpers ─────────────────────────────────────────────────────────
function extractText(content=[]) {
  return content.filter(c=>c.type==="text").map(c=>c.text||"").join("");
}
function safeJSON(raw, fallback) {
  try { return JSON.parse(raw.replace(/```json|```/g,"").trim()); }
  catch { return fallback; }
}
function nowChile() {
  return new Date(new Date().toLocaleString("en-US",{timeZone:"America/Santiago"}));
}

// ── Google OAuth2 token (Service Account o Refresh Token) ───────────
// Las credenciales vienen de variables de entorno en Vercel
let _googleToken = null;
let _tokenExpiry  = 0;

async function getGoogleToken() {
  // Si hay token vigente (con 60s de margen), reutilizarlo
  if (_googleToken && Date.now() < _tokenExpiry - 60000) return _googleToken;

  // Opción A: Refresh Token (OAuth2 user credentials — más fácil de configurar)
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      _googleToken  = data.access_token;
      _tokenExpiry  = Date.now() + (data.expires_in||3600) * 1000;
      return _googleToken;
    }
  }

  // Sin credenciales → retornar null (los agentes usarán fallback inteligente)
  return null;
}

// ── Agente Gmail ─────────────────────────────────────────────────────
// Llama a la Gmail API directamente y retorna mensajes crudos
async function gmailSearch(query, maxResults=50) {
  const token = await getGoogleToken();
  if (!token) return { messages: [], error: "NO_GOOGLE_CREDENTIALS" };

  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
      `q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!listRes.ok) {
      const err = await listRes.json().catch(()=>({}));
      return { messages: [], error: `GMAIL_${listRes.status}`, detail: err.error?.message };
    }
    const listData = await listRes.json();
    if (!listData.messages?.length) return { messages: [], error: null };

    // Leer metadata de cada mensaje (solo headers, no body completo → ahorra tokens)
    const msgs = await Promise.all(
      listData.messages.slice(0, maxResults).map(async m => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) return null;
        const msg = await msgRes.json();
        const hdrs = {};
        (msg.payload?.headers||[]).forEach(h=>{ hdrs[h.name]=h.value; });
        return {
          messageId: msg.id,
          threadId:  msg.threadId,
          subject:   hdrs.Subject||"",
          from:      hdrs.From||"",
          to:        hdrs.To||"",
          date:      hdrs.Date||"",
          snippet:   msg.snippet||"",
          labelIds:  msg.labelIds||[],
        };
      })
    );
    return { messages: msgs.filter(Boolean), error: null };
  } catch(e) {
    return { messages: [], error: "GMAIL_FETCH_EXCEPTION", detail: e.message };
  }
}

// ── Agente Drive ──────────────────────────────────────────────────────
async function driveListFolder(folderId) {
  const token = await getGoogleToken();
  if (!token) return { files: [], error: "NO_GOOGLE_CREDENTIALS" };

  try {
    const url = `https://www.googleapis.com/drive/v3/files?` +
      `q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&` +
      `fields=files(id,name,mimeType,modifiedTime,size)&pageSize=30`;
    const res = await fetch(url, { headers:{ Authorization:`Bearer ${token}` } });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      return { files:[], error:`DRIVE_${res.status}`, detail:err.error?.message };
    }
    const data = await res.json();
    return { files: data.files||[], error: null };
  } catch(e) {
    return { files:[], error:"DRIVE_EXCEPTION", detail:e.message };
  }
}

// ── Claude analiza datos ───────────────────────────────────────────────
// Función genérica: pasar datos crudos + instrucción → Claude retorna JSON
async function analyzeWithClaude(systemPrompt, userContent, maxTokens=1500) {
  const res = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role:"user", content: userContent }],
  });
  return extractText(res.content);
}

// ════════════════════════════════════════════════════════════════════
export async function POST(req) {
  try {
    const body = await req.json();
    const { type } = body;
    let text = "";

    // ── CHAT ────────────────────────────────────────────────────────
    if (type==="chat") {
      const {messages,context,follows}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5", max_tokens:1000,
        system:`Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro.
Español, directo, ejecutivo. Negritas para datos clave. Montos en CLP completos.
REGLA: Usa siempre el nombre de proyecto asignado por Alexis.
CARTERA:\n${context}\nSEGUIMIENTOS:\n${follows||"Ninguno"}\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
        messages:messages.map(m=>({role:m.role,content:m.content})),
      });
      text=extractText(res.content);
    }

    // ── SUMMARY ─────────────────────────────────────────────────────
    if (type==="summary") {
      const {project,notes}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5", max_tokens:600,
        system:"Genera resumen ejecutivo 3-5 oraciones. Sin títulos ni markdown. Destaca: estado, gestiones recientes, pendientes, próximos pasos.",
        messages:[{role:"user",content:`PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget}\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes}`}],
      });
      text=extractText(res.content);
    }

    // ── LICIT ────────────────────────────────────────────────────────
    if (type==="licit") {
      const {licitId}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5", max_tokens:800,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        system:`Busca en mercadopublico.cl la licitación indicada. Retorna SOLO JSON sin markdown:
{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"","organismo":"","descripcion":"","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","tipo":"","url":""}`,
        messages:[{role:"user",content:`Busca licitación: ${licitId}`}],
      });
      text=extractText(res.content);
    }

    // ── DOC ──────────────────────────────────────────────────────────
    if (type==="doc") {
      const {b64,mediaType,isImg}=body;
      const cb=isImg
        ?{type:"image",source:{type:"base64",media_type:mediaType,data:b64}}
        :{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}};
      const res=await client.messages.create({
        model:"claude-sonnet-4-5", max_tokens:1200,
        messages:[{role:"user",content:[cb,{type:"text",text:`Analiza. SOLO JSON sin markdown:
{"title":"","docType":"Convenio|Decreto|Oficio|Resolución|EETT|CDP|Acta|Otro","summary":"2-3 oraciones","codigoProyecto":"","entidadFinancista":"","montoTotal":0,"dates":[{"date":"YYYY-MM-DD","description":""}],"plazoEjecucionFin":"YYYY-MM-DD","plazoConvenioFin":"YYYY-MM-DD","obligations":[""],"tasks":[""],"parties":[""]}`}]}],
      });
      text=extractText(res.content);
    }

    // ── AGENTE: CLOCK SYNC ───────────────────────────────────────────
    // Lee correos de reloj control desde Gmail API
    // Si no hay credenciales Google → retorna array vacío con error descriptivo
    if (type==="clock_sync") {
      const query = `from:${CLOCK_SENDER} subject:"Aviso de registro de marca en reloj control"`;
      const { messages, error, detail } = await gmailSearch(query, 100);

      if (error === "NO_GOOGLE_CREDENTIALS") {
        // Sin credenciales: retornar los datos hardcodeados actuales como fallback
        // El frontend los tiene en ALL_CLOCK, no se pierde nada
        return Response.json({
          text: "[]",
          warning: "NO_GOOGLE_CREDENTIALS",
          hint: "Configura GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET en Vercel para sincronización real"
        });
      }
      if (error) {
        return Response.json({ text:"[]", error:true, errorCode:error, errorMessage:detail||error }, {status:200});
      }

      // Parsear snippets: "damos aviso que el día DD/MM/YYYY ... [Entrada|Salida] a las HH:MM"
      const dayMap = {};
      const rePattern = /el día (\d{2}\/\d{2}\/\d{4}).*?(Entrada|Salida)\s+a las\s+(\d{2}:\d{2})/i;
      for (const msg of messages) {
        const m = rePattern.exec(msg.snippet||"");
        if (!m) continue;
        const [,ddmmyyyy,tipo,hora] = m;
        const [d,mo,y] = ddmmyyyy.split("/");
        const iso = `${y}-${mo}-${d}`;
        if (!dayMap[iso]) dayMap[iso] = { date:iso, entrada:null, salida:null };
        if (tipo==="Entrada" && !dayMap[iso].entrada) dayMap[iso].entrada = hora;
        if (tipo==="Salida")  dayMap[iso].salida  = hora;
      }
      const sorted = Object.values(dayMap).sort((a,b)=>a.date.localeCompare(b.date));
      text = JSON.stringify(sorted);
    }

    // ── AGENTE: GMAIL SCAN ───────────────────────────────────────────
    // Busca correos relacionados con proyectos SECPLA y clasifica
    if (type==="gmail_scan") {
      const {projects=[],since="2026/04/01"}=body;
      const sinceDate = since.replace(/\//g,"-");

      // Construir query Gmail eficiente
      const keywords = [...new Set(
        projects.flatMap(p=>p.keywords||[]).slice(0,8)
      )].join(" OR ");
      const query = `to:anavarro@recoleta.cl after:${sinceDate.replace(/-/g,"/")} (${keywords}) -from:${CLOCK_SENDER}`;

      const { messages, error, detail } = await gmailSearch(query, 30);

      if (error === "NO_GOOGLE_CREDENTIALS") {
        return Response.json({ text:"[]", warning:"NO_GOOGLE_CREDENTIALS" });
      }
      if (error) {
        return Response.json({ text:"[]", error:true, errorCode:error, errorMessage:detail||error }, {status:200});
      }
      if (!messages.length) {
        text = "[]";
      } else {
        // Claude clasifica los mensajes por proyecto y urgencia
        // Solo se envían los metadatos (no el body) → eficiente en tokens
        const msgSummary = messages.map(m=>
          `ID:${m.messageId} THREAD:${m.threadId} FROM:${m.from} SUBJECT:${m.subject} DATE:${m.date} SNIPPET:${m.snippet?.slice(0,120)}`
        ).join("\n");

        const kwCtx = projects.map(p=>`${p.id}: ${(p.keywords||[]).join(", ")}`).join("\n");
        text = await analyzeWithClaude(
          `Clasifica correos de proyectos SECPLA. Keywords:\n${kwCtx}\nRetorna SOLO JSON array:
[{"messageId":"","threadId":"","projectId":"p1|p2|p3|p4|p5|null","subject":"","from":"","date":"YYYY-MM-DD","type":"requiere_accion|confirmacion|informativo","urgency":"crítica|alta|media|baja","summary":"1 línea","requiresResponse":true,"daysWithoutResponse":0,"emailUrl":"https://mail.google.com/mail/u/0/#inbox/MESSAGEID"}]`,
          `Clasifica estos correos:\n${msgSummary}`,
          1500
        );
        if (!text.trim().startsWith("[")) {
          const m = text.match(/\[[\s\S]*\]/);
          text = m ? m[0] : "[]";
        }
      }
    }

    // ── AGENTE: READ RECEIPTS SYNC ───────────────────────────────────
    // Busca acuses de lectura (subject: "Read:" o "Leído:")
    if (type==="read_receipts_sync") {
      const query = `to:anavarro@recoleta.cl (subject:"Read:" OR subject:"Leído:") after:2026/01/01`;
      const { messages, error, detail } = await gmailSearch(query, 80);

      if (error === "NO_GOOGLE_CREDENTIALS") {
        return Response.json({ text:"[]", warning:"NO_GOOGLE_CREDENTIALS" });
      }
      if (error) {
        return Response.json({ text:"[]", error:true, errorCode:error, errorMessage:detail||error }, {status:200});
      }
      if (!messages.length) { text = "[]"; }
      else {
        // Agrupar por asunto original (sin el prefijo Read:/Leído:)
        const grouped = {};
        for (const msg of messages) {
          const subj = (msg.subject||"")
            .replace(/^Read:\s*/i,"")
            .replace(/^Le[ií]do:\s*/i,"")
            .trim();
          if (!subj) continue;
          if (!grouped[subj]) grouped[subj] = { subject:subj, readers:[] };
          // Extraer quién leyó y cuándo del snippet
          const snip = msg.snippet||"";
          const timeMatch = snip.match(/se ha le[ií]do el\s+(\d+\/\d+\/\d+[,]?\s+\d+:\d+)/i);
          grouped[subj].readers.push({
            name: msg.from?.replace(/<[^>]+>/,"").trim()||"Desconocido",
            email: (msg.from?.match(/<([^>]+)>/)||[])[1]||msg.from||"",
            msgId: msg.messageId,
            threadId: msg.threadId,
            readAt: timeMatch?timeMatch[1]:msg.date||"",
          });
        }

        // Claude estructura los datos finales
        const raw = JSON.stringify(Object.values(grouped).slice(0,20));
        text = await analyzeWithClaude(
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
      }
    }

    // ── AGENTE: DRIVE SYNC ───────────────────────────────────────────
    // Lee carpetas Drive y actualiza estado de proyectos
    if (type==="drive_sync") {
      const {projects=[]}=body;
      const results = [];

      for (const [projId, folderId] of Object.entries(DRIVE_FOLDERS)) {
        const proj = projects.find(p=>p.id===projId);
        if (!proj) continue;

        const { files, error, detail } = await driveListFolder(folderId);
        if (error === "NO_GOOGLE_CREDENTIALS") {
          return Response.json({ text:"[]", warning:"NO_GOOGLE_CREDENTIALS" });
        }
        if (error) continue; // saltar este proyecto si falla la lectura

        if (!files.length) continue;

        // Solo los nombres y fechas de archivos — eficiente en tokens
        const fileList = files.map(f=>`${f.name} (${f.modifiedTime?.slice(0,10)||""})`).join("\n");
        const analysis = await analyzeWithClaude(
          `Analiza archivos de proyecto SECPLA "${proj.name}" y extrae datos clave.
Retorna SOLO JSON (un objeto, no array):
{"stage":"Formulación|Diseño|Licitación|Adjudicación|Ejecución|Recepción|Completado","status":"En curso|Con alerta|Detenido|Completado","budget":0,"codigoProyecto":"","notes":"observación clave en 1 línea","summary":"resumen ejecutivo 2 líneas","docsFound":["nombre1.pdf"],"lastDocDate":"YYYY-MM-DD"}`,
          `Archivos en carpeta Drive de ${proj.name}:\n${fileList}`,
          600
        );
        const parsed = safeJSON(analysis, null);
        if (parsed) results.push({ projectId:projId, ...parsed });
      }
      text = JSON.stringify(results);
    }

    // ── AGENTE: CALENDAR SYNC ────────────────────────────────────────
    // Busca invitaciones de calendario en Gmail
    if (type==="calendar_sync") {
      const {projects=[]}=body;
      const query = `to:anavarro@recoleta.cl (subject:"Invitación" OR subject:"Invitation" OR subject:"reunión" OR subject:"meeting") after:2026/03/01`;
      const { messages, error, detail } = await gmailSearch(query, 30);

      if (error === "NO_GOOGLE_CREDENTIALS") {
        return Response.json({ text:"[]", warning:"NO_GOOGLE_CREDENTIALS" });
      }
      if (error) {
        return Response.json({ text:"[]", error:true, errorCode:error, errorMessage:detail||error }, {status:200});
      }
      if (!messages.length) { text = "[]"; }
      else {
        const kwCtx = projects.map(p=>`${p.id}: ${(p.keywords||[]).slice(0,4).join(", ")}`).join("\n");
        const msgSummary = messages.map(m=>
          `ID:${m.messageId} THREAD:${m.threadId} SUBJ:${m.subject} SNIPPET:${m.snippet?.slice(0,100)}`
        ).join("\n");
        text = await analyzeWithClaude(
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
      }
    }

    // ── AGENTE: CONVENIO TRACK ───────────────────────────────────────
    // Busca correos de ampliación de plazo y estado de convenios
    if (type==="convenio_track") {
      const {projects=[]}=body;
      const query = `to:anavarro@recoleta.cl (subject:"modificación plazo" OR subject:"ampliación" OR "SNSM23-STP-0039" OR "convenio" OR "SPD" OR "GORE") after:2026/02/01`;
      const { messages, error } = await gmailSearch(query, 20);

      const today = new Date();
      const baseResults = projects.map(p => {
        const fin = p.convenio?.plazoEjecucionFin || p.deadline || null;
        const daysLeft = fin
          ? Math.round((new Date(fin)-today)/(1000*60*60*24))
          : null;
        return {
          projectId: p.id,
          codigoProyecto: p.codigoProyecto||"",
          plazoEjecucionFin: fin||"",
          plazoConvenioFin: p.convenio?.plazoConvenioFin||"",
          diasRestantesEjecucion: daysLeft,
          estado: daysLeft===null?"sin_plazo":daysLeft<0?"vencido":daysLeft<30?"proximo_vencer":"vigente",
          alertaColor: daysLeft===null?"gris":daysLeft<0?"rojo":daysLeft<30?"rojo":daysLeft<90?"amarillo":"verde",
          modificacionesPendientes: [],
          ultimaActividadEmail: null,
        };
      });

      if (error || !messages.length) {
        text = JSON.stringify(baseResults);
      } else {
        const msgSummary = messages.slice(0,10).map(m=>
          `THREAD:${m.threadId} FROM:${m.from} SUBJ:${m.subject} SNIPPET:${m.snippet?.slice(0,100)}`
        ).join("\n");
        const analysis = await analyzeWithClaude(
          `Actualiza estado de convenios SECPLA con correos recientes.
Proyectos: ${projects.map(p=>`${p.id}(${p.codigoProyecto||"—"} vence ${p.convenio?.plazoEjecucionFin||"—"})`).join(", ")}
Retorna SOLO JSON array con modificaciones y última actividad email por proyecto.
Schema: [{"projectId":"","modificacionesPendientes":[{"tipo":"","estado":"en_tramite","emailUrl":"","proximoPaso":""}],"ultimaActividadEmail":{"fecha":"YYYY-MM-DD","asunto":"","url":""}}]`,
          `Correos recientes sobre convenios:\n${msgSummary}`,
          1000
        );
        const updates = safeJSON(analysis, []);
        if (Array.isArray(updates)) {
          for (const upd of updates) {
            const base = baseResults.find(r=>r.projectId===upd.projectId);
            if (base) {
              base.modificacionesPendientes = upd.modificacionesPendientes||[];
              base.ultimaActividadEmail     = upd.ultimaActividadEmail||null;
              if (upd.modificacionesPendientes?.length) base.estado="en_tramite_ampliacion";
            }
          }
        }
        text = JSON.stringify(baseResults);
      }
    }

    // ── VERIFY SENT ──────────────────────────────────────────────────
    if (type==="verify_sent") {
      const {taskText="",projectName="",keywords=[]}=body;
      const terms = keywords.slice(0,4).join(" OR ");
      const query = `from:anavarro@recoleta.cl in:sent after:2026/03/01 (${terms||taskText.split(" ").filter(w=>w.length>4).slice(0,3).join(" OR ")})`;
      const { messages, error } = await gmailSearch(query, 10);

      if (error === "NO_GOOGLE_CREDENTIALS" || error || !messages.length) {
        text = JSON.stringify({ found: false });
      } else {
        const msgSummary = messages.map(m=>
          `ID:${m.messageId} THREAD:${m.threadId} TO:${m.to} SUBJ:${m.subject} DATE:${m.date} SNIPPET:${m.snippet?.slice(0,120)}`
        ).join("\n");
        const analysis = await analyzeWithClaude(
          `Verifica si alguno de estos correos enviados responde la tarea: "${taskText}" del proyecto ${projectName}.
Retorna SOLO JSON:
Si encontraste: {"found":true,"messageId":"","threadId":"","subject":"","sentDate":"YYYY-MM-DD","sentTime":"HH:MM","to":"","emailUrl":"https://mail.google.com/mail/u/0/#sent/MSGID","snippet":"","howAnswered":"","pendingReply":false,"pendingReplyNote":""}
Si no: {"found":false}`,
          `Correos enviados:\n${msgSummary}`,
          500
        );
        text = analysis;
        if (!text.trim().startsWith("{")) {
          const m = text.match(/\{[\s\S]*\}/);
          text = m ? m[0] : '{"found":false}';
        }
      }
    }

    return Response.json({ text });

  } catch (err) {
    console.error("[SECPLA API]", err?.message||err);
    const code = err?.status||err?.code||"SERVER_ERROR";
    return Response.json({
      text: "",
      error: true,
      errorCode: String(code),
      errorMessage: err?.message||"Error desconocido en el servidor"
    }, { status: 500 });
  }
}
