import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── IDs reales de carpetas Drive por proyecto ──────────────────────
// Mapeados desde la estructura real de tu Drive
const DRIVE_FOLDER_ROOT = "1KtyHfsGgq4YpUA5kCG4Bh2I6BGcK2RCD";
const DRIVE_PROJ_FOLDERS = {
  p5: "1JBqtYIGB17l2iez36L9Btam5H2WZbfTK", // Sala Monitoreo Consistorial
  p4: "16SoYuQH_V_24Di9qMVWJo7Iv9Lp29csz", // Cámaras UV32
  p3: "14PYYCvtjxc21qTwFJvRRC3iXUOt7qdkL", // CCTV Centros Culturales
  p1: "19CKsTh1KxsAp0QG3uOX3wTl-IsaqaidX", // 6ta Comisaría
  // p2 (SNSM2025 Integración) está dentro de la raíz, sin subcarpeta propia aún
};

// ── MCP Servers disponibles ────────────────────────────────────────
const MCP_GMAIL  = { type: "url", url: "https://gmail.mcp.claude.com/mcp",         name: "gmail"  };
const MCP_DRIVE  = { type: "url", url: "https://drivemcp.googleapis.com/mcp/v1",    name: "gdrive" };

// ── helper: extrae texto de bloques de contenido Anthropic ─────────
function extractText(content = []) {
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("");
}

// ── helper: parsea JSON de forma segura desde respuesta IA ─────────
function safeJSON(raw, fallback) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return fallback;
  }
}

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
        system: `Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro, Líder de Proyectos SECPLA. Español, directo, ejecutivo. Usa negritas para datos clave. Montos siempre en CLP completos sin abreviar.\n\nCARTERA:\n${context}\n\nSEGUIMIENTOS GMAIL PENDIENTES:\n${follows || "Ninguno"}\n\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // SUMMARY — Resumen ejecutivo IA desde notas
    // ════════════════════════════════════════════════════════════════
    if (type === "summary") {
      const { project, notes } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: `Genera un resumen ejecutivo de 3-5 oraciones basado en las notas de gestión. Directo, sin títulos ni markdown. Destaca: estado actual, gestiones recientes, pendientes y próximos pasos.`,
        messages: [{
          role: "user",
          content: `PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget} CLP\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes}`,
        }],
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
        system: `Busca la licitación en mercadopublico.cl y responde SOLO en JSON sin markdown:\n{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"nombre oficial","organismo":"organismo","descripcion":"descripción breve","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","tipo":"","url":"URL directa"}`,
        messages: [{ role: "user", content: `Busca en mercadopublico.cl la licitación: ${licitId}` }],
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // DOC — Extracción de documentos PDF/imagen
    // ════════════════════════════════════════════════════════════════
    if (type === "doc") {
      const { b64, mediaType, isImg } = body;
      const contentBlock = isImg
        ? { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } }
        : { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            contentBlock,
            { type: "text", text: `Analiza. Solo JSON sin markdown:\n{"title":"","docType":"","summary":"2-3 oraciones","dates":[{"date":"YYYY-MM-DD","description":""}],"amounts":[{"amount":"","description":""}],"obligations":[""],"tasks":[""],"parties":[""]}` },
          ],
        }],
      });
      text = extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // DRIVE SYNC — Lee carpetas reales de Drive por proyecto
    // Usa MCP de Google Drive para listar archivos y leer contenido
    // ════════════════════════════════════════════════════════════════
    if (type === "drive_sync") {
      const { projects = [] } = body;

      // Construimos el contexto de carpetas reales para el modelo
      const folderContext = projects.map((p) => {
        const folderId = DRIVE_PROJ_FOLDERS[p.id];
        return folderId
          ? `- Proyecto ${p.id} "${p.name}": carpeta Drive ID = ${folderId}`
          : `- Proyecto ${p.id} "${p.name}": sin carpeta asignada aún`;
      }).join("\n");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        mcp_servers: [MCP_DRIVE],
        system: `Eres un asistente que sincroniza antecedentes de Google Drive con el sistema SECPLA de la Municipalidad de Recoleta, Chile.

CARPETAS DE PROYECTOS EN DRIVE:
${folderContext}

TAREA:
1. Para cada proyecto que tenga carpeta asignada, lista los archivos que contiene
2. Lee el contenido de los archivos más relevantes (convenios, oficios, EETT, resoluciones)
3. Extrae: estado actual, etapa, montos, fechas clave, observaciones pendientes
4. Retorna SOLO un array JSON sin markdown:

[{
  "projectId": "p5",
  "stage": "Licitación",
  "status": "Con alerta",
  "desc": "descripción técnica actualizada según documentos",
  "notes": "observaciones y puntos clave encontrados en documentos",
  "summary": "resumen ejecutivo 2 líneas máximo",
  "docsFound": ["nombre_archivo1.pdf", "nombre_archivo2.pdf"],
  "lastDocDate": "YYYY-MM-DD"
}]

Si no puedes leer una carpeta o no tiene archivos, omite ese proyecto del array.
Responde SOLO el JSON.`,
        messages: [{
          role: "user",
          content: `Accede a las carpetas de Drive de cada proyecto SECPLA y extrae información actualizada.
Empieza por los proyectos con carpeta asignada: ${Object.keys(DRIVE_PROJ_FOLDERS).join(", ")}.
Carpeta raíz: ${DRIVE_FOLDER_ROOT}`,
        }],
      });

      text = extractText(res.content);

      // Validación: si el modelo retornó texto no-JSON (explicación),
      // intentamos extraer el array de todas formas
      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    // ════════════════════════════════════════════════════════════════
    // CALENDAR SYNC — Extrae reuniones desde Gmail (invitaciones)
    // Google Calendar no tiene MCP aún; las invitaciones llegan
    // por correo, así que Gmail es la fuente más confiable.
    // ════════════════════════════════════════════════════════════════
    if (type === "calendar_sync") {
      const { projects = [] } = body;

      const today     = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
      const in30days  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");

      // Keywords de todos los proyectos para la query de Gmail
      const allKeywords = projects
        .flatMap((p) => p.keywords || [])
        .filter(Boolean)
        .slice(0, 12)
        .join(" OR ");

      const keywordsCtx = projects
        .map((p) => `- ${p.id}: ${(p.keywords || []).join(", ")}`)
        .join("\n");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que extrae reuniones de proyectos SECPLA desde Gmail.

KEYWORDS POR PROYECTO:
${keywordsCtx}

TAREA:
1. Busca en Gmail invitaciones de calendario (subject:"Invitación" OR subject:"Invitation" OR subject:"reunión" OR subject:"meeting") de los últimos 30 días y próximos 30 días
2. Busca también correos con fechas de reunión usando las keywords de proyectos
3. Para cada evento/reunión encontrado, clasifícalo al proyecto correspondiente según keywords
4. Extrae fecha, hora, título, descripción y participantes

Retorna SOLO un array JSON sin markdown:
[{
  "id": "gmail_message_id",
  "title": "título del evento",
  "start": "YYYY-MM-DD",
  "time": "HH:MM",
  "description": "descripción o agenda si la hay",
  "projectId": "p1|p2|p3|p4|p5|null",
  "participants": ["email1", "email2"],
  "url": "https://mail.google.com/mail/u/0/#inbox/THREADID"
}]

Si no hay eventos, retorna [].
Responde SOLO el JSON.`,
        messages: [{
          role: "user",
          content: `Busca en Gmail invitaciones de calendario y reuniones relacionadas con proyectos SECPLA para el período ${today} al ${in30days}.
Busca también: ${allKeywords}
Cuenta de Gmail: anavarro@recoleta.cl`,
        }],
      });

      text = extractText(res.content);

      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    // ════════════════════════════════════════════════════════════════
    // VERIFY SENT — Verifica correo enviado al completar una tarea
    // Busca en Gmail SENT los correos relacionados con la tarea
    // y retorna evidencia: fecha, hora, enlace directo, snippet
    // ════════════════════════════════════════════════════════════════
    if (type === "verify_sent") {
      const { taskText = "", projectName = "", keywords = [], taskId = "" } = body;

      // Construimos términos de búsqueda específicos desde keywords del proyecto
      // + palabras clave extraídas del texto de la tarea misma
      const taskWords = taskText
        .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 5)
        .join(" OR ");

      const searchTerms = [...(keywords.slice(0, 4)), taskWords]
        .filter(Boolean)
        .join(" OR ");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que verifica si Alexis Navarro (anavarro@recoleta.cl) envió un correo respondiendo una solicitud de jefatura.

INSTRUCCIONES:
1. Busca en Gmail usando: from:anavarro@recoleta.cl in:sent después del 2026/03/01
2. Filtra por términos relacionados con la tarea
3. Si encuentras un correo relacionado, lee su contenido para confirmar que responde la solicitud
4. Extrae: asunto, fecha, hora, destinatario, primeras líneas del cuerpo

Retorna SOLO un objeto JSON sin markdown:
Si ENCONTRASTE el correo:
{
  "found": true,
  "messageId": "id_gmail",
  "threadId": "thread_id",
  "subject": "asunto del correo enviado",
  "sentDate": "YYYY-MM-DD",
  "sentTime": "HH:MM",
  "to": "destinatario(s)",
  "emailUrl": "https://mail.google.com/mail/u/0/#sent/MESSAGEID",
  "snippet": "primeras 150 caracteres del cuerpo",
  "howAnswered": "descripción breve de cómo respondió la solicitud",
  "pendingReply": false,
  "pendingReplyNote": ""
}
Si NO encontraste:
{ "found": false }

Responde SOLO el JSON.`,
        messages: [{
          role: "user",
          content: `Verifica si se envió un correo respondiendo esta solicitud:

SOLICITUD: "${taskText}"
PROYECTO: ${projectName}
BÚSQUEDA: ${searchTerms}

Busca en correos ENVIADOS de anavarro@recoleta.cl relacionados con: ${searchTerms}`,
        }],
      });

      text = extractText(res.content);

      // Garantizamos que sea JSON válido
      if (!text.trim().startsWith("{")) {
        const match = text.match(/\{[\s\S]*\}/);
        text = match ? match[0] : '{"found":false}';
      }
    }

    // ════════════════════════════════════════════════════════════════
    // GMAIL SCAN — Escaneo periódico de correos nuevos relacionados
    // con proyectos SECPLA para actualizar seguimientos automáticamente
    // ════════════════════════════════════════════════════════════════
    if (type === "gmail_scan") {
      const { projects = [], since = "2026/04/01" } = body;

      const keywordsCtx = projects
        .map((p) => `- ${p.id} "${p.name}": ${(p.keywords || []).join(", ")}`)
        .join("\n");

      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        mcp_servers: [MCP_GMAIL],
        system: `Eres un asistente que monitorea correos de proyectos SECPLA en Gmail para Alexis Navarro (anavarro@recoleta.cl), Municipalidad de Recoleta.

PROYECTOS Y KEYWORDS:
${keywordsCtx}

TAREA:
1. Busca correos recibidos en anavarro@recoleta.cl desde ${since} relacionados con los proyectos
2. Identifica correos que requieren acción (respuesta pendiente, plazos, solicitudes)
3. Identifica correos que responden seguimientos existentes (confirmaciones, aprobaciones)
4. Clasifica cada correo al proyecto correspondiente

Retorna SOLO un array JSON sin markdown:
[{
  "messageId": "id",
  "threadId": "thread_id",
  "projectId": "p1|p2|p3|p4|p5|null",
  "subject": "asunto",
  "from": "remitente",
  "date": "YYYY-MM-DD",
  "type": "requiere_accion|confirmacion|informativo|invitacion_reunion",
  "urgency": "crítica|alta|media|baja",
  "summary": "resumen 1 línea de qué dice y qué necesita",
  "requiresResponse": true,
  "daysWithoutResponse": 0,
  "emailUrl": "https://mail.google.com/mail/u/0/#inbox/MESSAGEID"
}]

Responde SOLO el JSON.`,
        messages: [{
          role: "user",
          content: `Escanea Gmail de anavarro@recoleta.cl buscando correos relacionados con proyectos SECPLA desde ${since}.
Enfócate en: sala monitoreo, SNSM, UV32, comisaría, centros culturales, SPD, GORE, licitaciones Recoleta.`,
        }],
      });

      text = extractText(res.content);

      if (!text.trim().startsWith("[")) {
        const match = text.match(/\[[\s\S]*\]/);
        text = match ? match[0] : "[]";
      }
    }

    return Response.json({ text });

  } catch (err) {
    console.error("[SECPLA API Error]", err);
    return Response.json(
      { text: `Error en el servidor: ${err.message || "desconocido"}` },
      { status: 500 }
    );
  }
}
