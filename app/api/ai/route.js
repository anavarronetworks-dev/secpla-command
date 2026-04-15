import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN ESTÁTICA — IDs y reglas operativas
// ═══════════════════════════════════════════════════════════════════

// IDs reales de carpetas Drive por proyecto
const DRIVE_FOLDERS = {
  p5: "1JBqtYIGB17l2iez36L9Btam5H2WZbfTK", // Sala Monitoreo Consistorial
  p4: "16SoYuQH_V_24Di9qMVWJo7Iv9Lp29csz", // Cámaras UV32
  p3: "14PYYCvtjxc21qTwFJvRRC3iXUOt7qdkL", // CCTV Centros Culturales
  p1: "19CKsTh1KxsAp0QG3uOX3wTl-IsaqaidX", // 6ta Comisaría
};

// Remitente real del reloj control (Bionicvision es el sistema de marcaje)
const CLOCK_SENDER   = "enviomarcaciones@mg.bionicvision.cl";
const CLOCK_SUBJECT  = "Aviso de registro de marca en reloj control";
const CLOCK_LABEL_ID = "Label_622782252477718803"; // etiqueta real en Gmail

// MCP Servers
const MCP_GMAIL = { type: "url", url: "https://gmail.mcp.claude.com/mcp",       name: "gmail"  };
const MCP_DRIVE = { type: "url", url: "https://drivemcp.googleapis.com/mcp/v1",  name: "gdrive" };

// ── helpers ────────────────────────────────────────────────────────
function extractText(content = []) {
  return content.filter(c => c.type === "text").map(c => c.text || "").join("");
}
function safeJSON(raw, fallback) {
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return fallback; }
}
// Hora actual en Chile (UTC-4 / UTC-3)
function nowChile() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
}
// Día de semana Chile: 0=Dom … 6=Sáb
function dowChile() { return nowChile().getDay(); }
// ¿Es día hábil? (lunes-viernes)
function isWeekday() { const d = dowChile(); return d >= 1 && d <= 5; }
// ¿Estamos dentro de la ventana permitida para consultar reloj?
// Ventana 1: 09:25–09:45  |  Ventana 2: 18:15–18:30  (tolerancia ±5 min)
function inClockWindow() {
  if (!isWeekday()) return false;
  const now = nowChile();
  const hm  = now.getHours() * 100 + now.getMinutes();
  return (hm >= 925 && hm <= 945) || (hm >= 1815 && hm <= 1830);
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export async function POST(req) {
  try {
    const body = await req.json();
    const { type } = body;
    let text = "";

    // ════════════════════════════════════════════════════════════════
    // CHAT
    // ════════════════════════════════════════════════════════════════
    if (type === "chat") {
      const { messages, context, follows } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: `Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro, Líder de Proyectos SECPLA.
Español, directo, ejecutivo. Usa negritas para datos clave. Montos siempre en CLP completos sin abreviar.
REGLA CRÍTICA — NOMBRES DE PROYECTOS: Siempre usa el nombre asignado por Alexis, NO el nombre que usa la entidad financista.

CARTERA:
${context}

SEGUIMIENTOS GMAIL PENDIENTES:
${follows || "Ninguno"}

FECHA: ${new Date().toLocaleDateString("es-CL")}`,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // SUMMARY
    // ════════════════════════════════════════════════════════════════
    if (type === "summary") {
      const { project, notes } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: `Genera un resumen ejecutivo de 3-5 oraciones. Directo, sin títulos ni markdown.
Destaca: estado actual, gestiones recientes, pendientes y próximos pasos.
IMPORTANTE: Usa siempre el nombre del proyecto tal como aparece en "PROYECTO:", no cambies el nombre.`,
        messages: [{ role: "user", content: `PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget} CLP\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes}` }],
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // LICIT — Consulta Mercado Público
    // ════════════════════════════════════════════════════════════════
    if (type === "licit") {
      const { licitId } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: `Busca la licitación en mercadopublico.cl y responde SOLO en JSON sin markdown:
{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"nombre oficial MP","organismo":"organismo licitante","descripcion":"descripción breve","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","tipo":"","url":"URL directa"}`,
        messages: [{ role: "user", content: `Busca en mercadopublico.cl la licitación: ${licitId}` }],
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // DOC — Extracción PDF/imagen
    // ════════════════════════════════════════════════════════════════
    if (type === "doc") {
      const { b64, mediaType, isImg } = body;
      const contentBlock = isImg
        ? { type: "image",    source: { type: "base64", media_type: mediaType,            data: b64 } }
        : { type: "document", source: { type: "base64", media_type: "application/pdf",    data: b64 } };
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          contentBlock,
          { type: "text", text: `Analiza. Solo JSON sin markdown:
{"title":"","docType":"Convenio|Decreto|Oficio|Resolución|EETT|CDP|Acta|Otro","summary":"2-3 oraciones",
"codigoProyecto":"código identificador (ej: SNSM23-STP-0039)",
"entidadFinancista":"nombre de quien financia",
"montoTotal":0,"montoDetalle":[{"concepto":"","monto":0}],
"dates":[{"date":"YYYY-MM-DD","description":""}],
"plazoEjecucionMeses":0,"plazoEjecucionFin":"YYYY-MM-DD",
"plazoConvenioMeses":0,"plazoConvenioFin":"YYYY-MM-DD",
"amounts":[{"amount":"","description":""}],
"obligations":[""],"tasks":[""],"parties":[""]}` },
        ]}],
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // CLOCK CONTROL — Reglas:
    //   • Solo lunes-viernes
    //   • Solo 2 ventanas: 09:25-09:45 (entrada) y 18:15-18:30 (salida)
    //   • Lee etiqueta Label_622782252477718803 en Gmail
    //   • Retorna el marcaje del día actual
    // ════════════════════════════════════════════════════════════════
    if (type === "clock_check") {
      // Guardia: horario y día
      if (!isWeekday()) {
        return Response.json({ text: JSON.stringify({ blocked: true, reason: "fin_de_semana" }) });
      }
      if (!inClockWindow()) {
        const now = nowChile();
        const hm  = now.getHours() * 100 + now.getMinutes();
        const next = hm < 930 ? "09:30" : hm < 1820 ? "18:20" : "mañana 09:30";
        return Response.json({ text: JSON.stringify({
          blocked: true,
          reason: "fuera_de_ventana",
          nextWindow: next,
          currentTime: `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`
        })});
      }

      const todayChile = nowChile().toISOString().slice(0,10); // YYYY-MM-DD
      const [y, m, d]  = todayChile.split("-");
      const todayFmt   = `${d}/${m}/${y}`;                    // DD/MM/YYYY

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que lee el correo de marcaje de reloj control de Alexis Navarro.
El sistema de reloj control envía correos automáticos desde: ${CLOCK_SENDER}
Subject: "${CLOCK_SUBJECT}"
Los mensajes tienen la forma: "damos aviso que el día DD/MM/YYYY usted ha registrado en el reloj control una [Entrada|Salida] a las HH:MM"

Busca los correos de HOY (${todayFmt}) en la etiqueta con ID: ${CLOCK_LABEL_ID}
También busca en INBOX si no aparece en la etiqueta.

Retorna SOLO JSON sin markdown:
{
  "date": "YYYY-MM-DD",
  "entrada": "HH:MM o null",
  "salida": "HH:MM o null",
  "mensajesEncontrados": 0,
  "raw": ["texto de cada mensaje encontrado"]
}`,
        messages: [{ role: "user", content: `Lee el correo de reloj control de hoy ${todayFmt} (${todayChile}).
Busca en Gmail usando: from:${CLOCK_SENDER} subject:"${CLOCK_SUBJECT}"
Filtra solo los correos de HOY.` }],
      });

      text = extractText(res.content);
      if (!text.trim().startsWith("{")) {
        const match = text.match(/\{[\s\S]*\}/);
        text = match ? match[0] : JSON.stringify({ date: todayChile, entrada: null, salida: null, mensajesEncontrados: 0 });
      }
    }

    // ════════════════════════════════════════════════════════════════
    // DRIVE SYNC — Lee carpetas reales, extrae:
    //   • Presupuesto exacto del convenio/decreto (NO estimado)
    //   • Código identificador del proyecto (entidad financista)
    //   • Quién financia y con qué programa
    //   • Fechas y plazos de convenio + ejecución
    //   • Estado actual según último documento
    // REGLA: No cambia el nombre asignado por Alexis al proyecto.
    // ════════════════════════════════════════════════════════════════
    if (type === "drive_sync") {
      const { projects = [] } = body;

      const folderCtx = projects.map(p => {
        const fid = DRIVE_FOLDERS[p.id];
        return fid
          ? `- ID interno "${p.id}" | Nombre Alexis: "${p.name}" | Carpeta Drive: ${fid}`
          : `- ID interno "${p.id}" | Nombre Alexis: "${p.name}" | Sin carpeta asignada`;
      }).join("\n");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        mcp_servers: [MCP_DRIVE],
        system: `Eres un asistente que sincroniza datos EXACTOS desde Google Drive al sistema SECPLA de la Municipalidad de Recoleta.

CARPETAS POR PROYECTO:
${folderCtx}

REGLAS OBLIGATORIAS:
1. El campo "name" NUNCA se retorna — el nombre del proyecto lo define Alexis, no los documentos.
2. El presupuesto ("budget") debe ser el monto EXACTO del convenio o decreto que lo aprueba, en CLP enteros. Si hay modificaciones posteriores (complementos, ajustes intraítem), suma todos los aportes y retorna el total vigente.
3. El "codigoProyecto" es el código que usa la entidad financista (ej: SNSM23-STP-0039, SNSM23-CMP-0010, BIP 40066179-0). Si hay más de uno, sepáralos con " / ".
4. "financier" es la institución que transfiere los fondos (SPD, GORE RM, Municipal, etc.).
5. "program" es el programa o línea de financiamiento (SNSM 2023, FNDR, etc.).
6. Para plazos: lee el convenio original Y todas las modificaciones de plazo aprobadas. Retorna el plazo VIGENTE (última modificación aprobada).
7. Si hay modificación de plazo EN TRAMITE (no aprobada aún), incluirla en "plazoEnTramite".
8. "stage" debe reflejar la etapa real según documentos (Formulación/Diseño/Licitación/Adjudicación/Ejecución/Recepción/Completado).
9. "status" puede ser: En curso / Con alerta / Detenido / Completado.

Retorna SOLO un array JSON sin markdown:
[{
  "projectId": "p5",
  "budget": 100000000,
  "budgetDetail": [
    {"concepto": "Aporte inicial SPD REX 1347", "monto": 65000000, "fecha": "2023-06-29"},
    {"concepto": "Complemento SPD RES 14089", "monto": 35000000, "fecha": "2023-11-24"}
  ],
  "codigoProyecto": "SNSM23-STP-0039 / SNSM23-CMP-0010",
  "codigoSIGE": "21460117",
  "financier": "SPD",
  "program": "SNSM 2023",
  "licitId": "1431841-68-LP25",
  "stage": "Licitación",
  "status": "Con alerta",
  "desc": "descripción técnica actualizada",
  "notes": "observaciones clave de documentos",
  "summary": "resumen ejecutivo 2 líneas",
  "convenio": {
    "suscripcion": "YYYY-MM-DD",
    "aprobacionSPD": "YYYY-MM-DD",
    "aprobacionMunicipal": "YYYY-MM-DD",
    "plazoEjecucionMeses": 26,
    "plazoEjecucionFin": "2026-06-30",
    "plazoConvenioMeses": 29,
    "plazoConvenioFin": "2026-09-30",
    "modificaciones": [
      {
        "tipo": "Modificación técnica intraítem",
        "aprobacion": "2025-05-20",
        "oficio": "N°1258 SPD",
        "estado": "aprobada"
      },
      {
        "tipo": "Ampliación de plazo 13 meses",
        "aprobacion": "2025-09-04",
        "oficio": "N°2321 SPD",
        "estado": "aprobada"
      }
    ]
  },
  "plazoEnTramite": null,
  "docsFound": ["CONVENIO SNSM23-STP-0039.pdf", "OFICIO 2321_AMPL PLAZO.pdf"],
  "lastDocDate": "2026-02-18"
}]

Si no puedes leer la carpeta de un proyecto, omítelo.
Responde SOLO el JSON.`,
        messages: [{ role: "user", content: `Lee las carpetas Drive de cada proyecto SECPLA y extrae datos exactos de presupuesto, códigos, financiamiento y plazos de convenio.
Prioriza: convenios, decretos de aprobación, órdenes de ingreso, oficios de modificación de plazo.` }],
      });

      text = extractText(res.content);
      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    // ════════════════════════════════════════════════════════════════
    // CONVENIO TRACK — Seguimiento activo de plazos de convenios
    // Valida por documentos Drive + correos Gmail (ampliaciones)
    // Foco actual: SNSM2025 ampliación de plazo en trámite
    // ════════════════════════════════════════════════════════════════
    if (type === "convenio_track") {
      const { projects = [] } = body;

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        mcp_servers: [MCP_GMAIL, MCP_DRIVE],
        system: `Eres un asistente especializado en seguimiento de convenios de proyectos municipales SECPLA.

PROYECTOS A MONITOREAR:
${projects.map(p => `- ${p.id}: "${p.name}" | Código: ${p.codigoProyecto||"—"} | Ejecución vence: ${p.plazoEjecucionFin||"—"}`).join("\n")}

FOCO ACTUAL: Proyecto SNSM2025 (Integración de Cámaras de Televigilancia, SNSM23-STP-0039) tiene una ampliación de plazo EN TRÁMITE.

TAREA:
1. Busca en Gmail correos relacionados con ampliaciones de plazo, modificaciones de convenio, notificaciones SPD
2. Busca correos con asuntos como: "modificación plazo", "ampliación plazo", "SNSM23-STP-0039", "SNSM25", "convenio"
3. Para cada proyecto, determina: plazo vigente, fecha de vencimiento, si hay trámite pendiente
4. Identifica si hay respuesta SPD aprobando/rechazando trámites pendientes

Retorna SOLO un array JSON sin markdown:
[{
  "projectId": "p5",
  "codigoProyecto": "SNSM23-STP-0039",
  "plazoEjecucionFin": "2026-06-30",
  "plazoConvenioFin": "2026-09-30",
  "diasRestantesEjecucion": 77,
  "diasRestantesConvenio": 169,
  "estado": "vigente|vencido|proximo_vencer|en_tramite_ampliacion",
  "alertaColor": "verde|amarillo|rojo",
  "modificacionesPendientes": [{
    "tipo": "Ampliación de plazo",
    "fechaSolicitud": "YYYY-MM-DD",
    "estado": "en_tramite|aprobada|rechazada",
    "threadId": "id_gmail",
    "emailUrl": "https://mail.google.com/...",
    "ultimaActualizacion": "YYYY-MM-DD",
    "proximoPaso": "descripción acción requerida"
  }],
  "ultimaActividadEmail": {
    "fecha": "YYYY-MM-DD",
    "asunto": "asunto del último correo",
    "url": "https://mail.google.com/..."
  }
}]

Responde SOLO el JSON.`,
        messages: [{ role: "user", content: `Revisa el estado de todos los convenios SECPLA, especialmente la ampliación de plazo del proyecto de Integración de Cámaras SNSM2025 (SNSM23-STP-0039) que está en trámite. Busca en Gmail correos recientes sobre este trámite y otros plazos de convenio.` }],
      });

      text = extractText(res.content);
      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    // ════════════════════════════════════════════════════════════════
    // CALENDAR SYNC — Busca reuniones en Gmail (invitaciones)
    // ════════════════════════════════════════════════════════════════
    if (type === "calendar_sync") {
      const { projects = [] } = body;
      const today    = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
      const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
      const kwCtx    = projects.map(p => `- ${p.id}: ${(p.keywords||[]).join(", ")}`).join("\n");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que extrae reuniones de proyectos SECPLA desde Gmail.

KEYWORDS POR PROYECTO:
${kwCtx}

TAREA:
1. Busca en Gmail invitaciones de calendario (subject contiene "Invitación" o "reunión" o "meeting") de los últimos 30 días y próximos 30 días
2. Busca también correos con fechas de reunión relacionados con proyectos SECPLA
3. Para cada evento, clasifícalo al proyecto por keywords
4. Extrae fecha, hora, título, descripción y participantes

NOTA: Las invitaciones de Google Calendar tienen asuntos como "Invitación: [título] [fecha]"

Retorna SOLO un array JSON sin markdown:
[{
  "id": "messageId_gmail",
  "title": "título del evento",
  "start": "YYYY-MM-DD",
  "time": "HH:MM",
  "description": "descripción o agenda",
  "projectId": "p1|p2|p3|p4|p5|null",
  "participants": ["email1"],
  "url": "https://mail.google.com/mail/u/0/#inbox/THREADID"
}]
Si no hay eventos, retorna []. Responde SOLO el JSON.`,
        messages: [{ role: "user", content: `Busca en Gmail invitaciones de calendario y reuniones SECPLA para el período ${today} al ${in30days}.` }],
      });

      text = extractText(res.content);
      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    // ════════════════════════════════════════════════════════════════
    // VERIFY SENT — Verifica correo enviado al completar tarea
    // ════════════════════════════════════════════════════════════════
    if (type === "verify_sent") {
      const { taskText = "", projectName = "", keywords = [] } = body;
      const taskWords = taskText
        .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]/g, " ")
        .split(/\s+/).filter(w => w.length > 4).slice(0, 5).join(" OR ");
      const searchTerms = [...(keywords.slice(0, 4)), taskWords].filter(Boolean).join(" OR ");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que verifica si Alexis Navarro (anavarro@recoleta.cl) envió un correo respondiendo una solicitud de jefatura.

INSTRUCCIONES:
1. Busca en Gmail: from:anavarro@recoleta.cl in:sent after:2026/03/01
2. Filtra por términos relacionados con la tarea
3. Confirma que el correo responde la solicitud leyendo su contenido

Retorna SOLO un objeto JSON sin markdown:
Si encontraste:
{"found":true,"messageId":"id","threadId":"tid","subject":"asunto","sentDate":"YYYY-MM-DD","sentTime":"HH:MM","to":"destinatario","emailUrl":"https://mail.google.com/mail/u/0/#sent/MSGID","snippet":"primeras 150 chars del cuerpo","howAnswered":"cómo respondió","pendingReply":false,"pendingReplyNote":""}
Si no encontraste:
{"found":false}
Responde SOLO el JSON.`,
        messages: [{ role: "user", content: `Verifica si se envió correo respondiendo:\nSOLICITUD: "${taskText}"\nPROYECTO: ${projectName}\nBÚSQUEDA: ${searchTerms}` }],
      });

      text = extractText(res.content);
      if (!text.trim().startsWith("{")) {
        const match = text.match(/\{[\s\S]*\}/);
        text = match ? match[0] : '{"found":false}';
      }
    }

    // ════════════════════════════════════════════════════════════════
    // GMAIL SCAN — Escaneo periódico, detecta correos que requieren acción
    // ════════════════════════════════════════════════════════════════
    if (type === "gmail_scan") {
      const { projects = [], since = "2026/04/01" } = body;
      const kwCtx = projects.map(p => `- ${p.id} "${p.name}": ${(p.keywords||[]).join(", ")}`).join("\n");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que monitorea correos SECPLA en Gmail para Alexis Navarro (anavarro@recoleta.cl).

PROYECTOS Y KEYWORDS:
${kwCtx}

TAREA:
1. Busca correos recibidos desde ${since} relacionados con proyectos SECPLA
2. EXCLUYE correos del reloj control (from:${CLOCK_SENDER}) — esos se procesan aparte
3. Identifica correos que requieren acción (respuesta pendiente, plazos, solicitudes)
4. Identifica correos que responden seguimientos (confirmaciones SPD, aprobaciones GORE, etc.)

Retorna SOLO un array JSON:
[{
  "messageId": "id",
  "threadId": "tid",
  "projectId": "p1|null",
  "subject": "asunto",
  "from": "remitente",
  "date": "YYYY-MM-DD",
  "type": "requiere_accion|confirmacion|informativo|invitacion_reunion",
  "urgency": "crítica|alta|media|baja",
  "summary": "resumen 1 línea",
  "requiresResponse": true,
  "daysWithoutResponse": 0,
  "emailUrl": "https://mail.google.com/mail/u/0/#inbox/MESSAGEID"
}]
Responde SOLO el JSON.`,
        messages: [{ role: "user", content: `Escanea Gmail de anavarro@recoleta.cl desde ${since} buscando correos de proyectos SECPLA. Excluye correos de reloj control.` }],
      });

      text = extractText(res.content);
      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    return Response.json({ text });

  } catch (err) {
    console.error("[SECPLA API Error]", err?.message || err);
    return Response.json({ text: `Error: ${err?.message || "desconocido"}` }, { status: 500 });
  }
}
