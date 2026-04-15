import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
const DRIVE_FOLDERS = {
  p5: "1JBqtYIGB17l2iez36L9Btam5H2WZbfTK",
  p4: "16SoYuQH_V_24Di9qMVWJo7Iv9Lp29csz",
  p3: "14PYYCvtjxc21qTwFJvRRC3iXUOt7qdkL",
  p1: "19CKsTh1KxsAp0QG3uOX3wTl-IsaqaidX",
};
const CLOCK_SENDER  = "enviomarcaciones@mg.bionicvision.cl";
const CLOCK_LABEL   = "Label_622782252477718803";
const MCP_GMAIL     = { type:"url", url:"https://gmail.mcp.claude.com/mcp",      name:"gmail"  };
const MCP_DRIVE     = { type:"url", url:"https://drivemcp.googleapis.com/mcp/v1", name:"gdrive" };

function extractText(content=[]) {
  return content.filter(c=>c.type==="text").map(c=>c.text||"").join("");
}
function safeJSON(raw, fallback) {
  try { return JSON.parse(raw.replace(/```json|```/g,"").trim()); }
  catch { return fallback; }
}

// ── Hora Chile ─────────────────────────────────────────────────────
function nowChile() {
  return new Date(new Date().toLocaleString("en-US",{timeZone:"America/Santiago"}));
}
function isWeekday() { const d=nowChile().getDay(); return d>=1&&d<=5; }
function inClockWindow() {
  if(!isWeekday()) return false;
  const hm=nowChile().getHours()*100+nowChile().getMinutes();
  return (hm>=925&&hm<=945)||(hm>=1815&&hm<=1830);
}

// ═══════════════════════════════════════════════════════════════════
export async function POST(req) {
  try {
    const body = await req.json();
    const { type } = body;
    let text = "";

    // ── CHAT ──────────────────────────────────────────────────────
    if (type==="chat") {
      const {messages,context,follows}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:1000,
        system:`Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro, Líder de Proyectos SECPLA. Español, directo, ejecutivo. Usa negritas para datos clave. Montos siempre en CLP completos sin abreviar. REGLA: Usa siempre el nombre de proyecto que asignó Alexis.\n\nCARTERA:\n${context}\n\nSEGUIMIENTOS GMAIL PENDIENTES:\n${follows||"Ninguno"}\n\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
        messages:messages.map(m=>({role:m.role,content:m.content})),
      });
      text=extractText(res.content);
    }

    // ── SUMMARY ───────────────────────────────────────────────────
    if (type==="summary") {
      const {project,notes}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:600,
        system:`Genera un resumen ejecutivo de 3-5 oraciones. Directo, sin títulos ni markdown. Destaca: estado actual, gestiones recientes, pendientes y próximos pasos. Usa el nombre del proyecto tal como aparece en "PROYECTO:".`,
        messages:[{role:"user",content:`PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget} CLP\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes}`}],
      });
      text=extractText(res.content);
    }

    // ── LICIT ─────────────────────────────────────────────────────
    if (type==="licit") {
      const {licitId}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:800,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        system:`Busca la licitación en mercadopublico.cl y responde SOLO en JSON sin markdown:\n{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"nombre oficial","organismo":"","descripcion":"","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","tipo":"","url":""}`,
        messages:[{role:"user",content:`Busca en mercadopublico.cl la licitación: ${licitId}`}],
      });
      text=extractText(res.content);
    }

    // ── DOC ───────────────────────────────────────────────────────
    if (type==="doc") {
      const {b64,mediaType,isImg}=body;
      const cb=isImg
        ?{type:"image",source:{type:"base64",media_type:mediaType,data:b64}}
        :{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}};
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:1000,
        messages:[{role:"user",content:[cb,{type:"text",text:`Analiza. Solo JSON sin markdown:\n{"title":"","docType":"Convenio|Decreto|Oficio|Resolución|EETT|CDP|Acta|Otro","summary":"2-3 oraciones","codigoProyecto":"","entidadFinancista":"","montoTotal":0,"dates":[{"date":"YYYY-MM-DD","description":""}],"plazoEjecucionFin":"YYYY-MM-DD","plazoConvenioFin":"YYYY-MM-DD","obligations":[""],"tasks":[""],"parties":[""]}`}]}],
      });
      text=extractText(res.content);
    }

    // ════════════════════════════════════════════════════════════════
    // CLOCK SYNC — Lee TODOS los registros de marcaje desde Gmail
    // y retorna el array completo de días con entrada/salida.
    // Se llama desde el botón "Reloj" SIN restricción de ventana horaria
    // (la ventana es solo para el auto-check silencioso).
    // ════════════════════════════════════════════════════════════════
    if (type==="clock_sync") {
      const {since="2026/01/01"}=body;

      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:4000,
        mcp_servers:[MCP_GMAIL],
        system:`Eres un asistente que lee los correos de marcaje de reloj control de Alexis Navarro (anavarro@recoleta.cl).

El sistema de reloj envía correos automáticos desde: ${CLOCK_SENDER}
Asunto: "Aviso de registro de marca en reloj control"
Etiqueta Gmail: ${CLOCK_LABEL}
Formato del cuerpo: "damos aviso que el día DD/MM/YYYY usted ha registrado en el reloj control una [Entrada|Salida] a las HH:MM"

TAREA:
1. Busca TODOS los correos de este remitente desde ${since}
2. Extrae fecha (DD/MM/YYYY → convierte a YYYY-MM-DD), tipo (Entrada/Salida) y hora (HH:MM)
3. Agrupa por fecha: cada día puede tener una Entrada y una Salida
4. Si hay múltiples entradas en un día, toma la primera; si hay múltiples salidas, toma la última
5. Incluye días con solo entrada (sin salida registrada aún), con salida=null
6. Si hoy tiene entrada pero no salida todavía, inclúyelo con salida=null

Retorna SOLO un array JSON ordenado por fecha ASC, sin markdown:
[
  {"date":"YYYY-MM-DD","entrada":"HH:MM","salida":"HH:MM"},
  {"date":"YYYY-MM-DD","entrada":"HH:MM","salida":null}
]

Responde SOLO el JSON, sin texto adicional.`,
        messages:[{role:"user",content:`Lee todos los correos de reloj control de ${CLOCK_SENDER} desde ${since} y construye el array completo de registros de entrada/salida. Hoy es ${nowChile().toISOString().slice(0,10)}.`}],
      });

      text=extractText(res.content);
      // Garantizar JSON array
      if(!text.trim().startsWith("[")){
        const match=text.match(/\[[\s\S]*\]/);
        text=match?match[0]:"[]";
      }
    }

    // ── CLOCK CHECK (ventana diaria, silencioso) ──────────────────
    if (type==="clock_check") {
      if(!isWeekday()) return Response.json({text:JSON.stringify({blocked:true,reason:"fin_de_semana"})});
      if(!inClockWindow()) {
        const now=nowChile();
        const hm=now.getHours()*100+now.getMinutes();
        const next=hm<930?"09:30":hm<1820?"18:20":"mañana 09:30";
        return Response.json({text:JSON.stringify({blocked:true,reason:"fuera_de_ventana",nextWindow:next})});
      }
      // En ventana: hacer clock_sync del día actual
      const today=nowChile().toISOString().slice(0,10).replace(/-/g,"/");
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:600,
        mcp_servers:[MCP_GMAIL],
        system:`Lee el correo de reloj control de HOY solamente. Retorna SOLO JSON:
{"date":"YYYY-MM-DD","entrada":"HH:MM o null","salida":"HH:MM o null","mensajesHoy":0}`,
        messages:[{role:"user",content:`Busca correos de reloj control de HOY (${today}) de ${CLOCK_SENDER}. Solo hoy.`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("{")) {
        const match=text.match(/\{[\s\S]*\}/);
        text=match?match[0]:'{"date":"","entrada":null,"salida":null,"mensajesHoy":0}';
      }
    }

    // ── DRIVE SYNC ────────────────────────────────────────────────
    if (type==="drive_sync") {
      const {projects=[]}=body;
      const folderCtx=projects.map(p=>{
        const fid=DRIVE_FOLDERS[p.id];
        return fid
          ?`- ID "${p.id}" | Nombre Alexis: "${p.name}" | Carpeta: ${fid}`
          :`- ID "${p.id}" | Nombre Alexis: "${p.name}" | Sin carpeta`;
      }).join("\n");

      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:4000,
        mcp_servers:[MCP_DRIVE],
        system:`Eres un asistente que sincroniza datos EXACTOS desde Google Drive al sistema SECPLA de la Municipalidad de Recoleta.

CARPETAS:
${folderCtx}

REGLAS:
1. "name" NUNCA se retorna (el nombre lo define Alexis).
2. "budget" = monto exacto CLP del convenio/decreto. Suma todos los aportes.
3. "codigoProyecto" = código de la entidad financista (SNSM23-STP-0039, BIP 40066179-0, etc).
4. "financier" = institución que transfiere fondos.
5. Para plazos: retorna el plazo VIGENTE (última modificación aprobada).
6. "plazoEnTramite" si hay modificación aún no aprobada.

Retorna SOLO array JSON:
[{"projectId":"p5","budget":100000000,"budgetDetail":[{"concepto":"","monto":0,"fecha":""}],"codigoProyecto":"","codigoSIGE":"","financier":"","program":"","licitId":"","stage":"","status":"","desc":"","notes":"","summary":"","convenio":{"suscripcion":"","plazoEjecucionFin":"","plazoConvenioFin":"","modificaciones":[{"tipo":"","oficio":"","aprobacion":"","estado":"aprobada|en_tramite"}]},"plazoEnTramite":null,"docsFound":[],"lastDocDate":""}]
Responde SOLO el JSON.`,
        messages:[{role:"user",content:`Lee las carpetas Drive de proyectos SECPLA. Extrae datos exactos de presupuesto, códigos, financiamiento y plazos.`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("[")) { const m=text.match(/\[[\s\S]*\]/); text=m?m[0]:"[]"; }
    }

    // ── CONVENIO TRACK ────────────────────────────────────────────
    if (type==="convenio_track") {
      const {projects=[]}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:3000,
        mcp_servers:[MCP_GMAIL,MCP_DRIVE],
        system:`Asistente de seguimiento de convenios SECPLA. Revisa plazos, modificaciones aprobadas y trámites en curso. Retorna SOLO array JSON:
[{"projectId":"","codigoProyecto":"","plazoEjecucionFin":"","plazoConvenioFin":"","diasRestantesEjecucion":0,"estado":"vigente|vencido|proximo_vencer|en_tramite_ampliacion","alertaColor":"verde|amarillo|rojo","modificacionesPendientes":[{"tipo":"","fechaSolicitud":"","estado":"en_tramite","threadId":"","emailUrl":"","ultimaActualizacion":"","proximoPaso":""}],"ultimaActividadEmail":{"fecha":"","asunto":"","url":""}}]`,
        messages:[{role:"user",content:`Revisa estado de convenios SECPLA, especialmente SNSM23-STP-0039 con ampliación de plazo en trámite. Proyectos: ${projects.map(p=>`${p.id}(${p.codigoProyecto||"—"}, vence ${p.plazoEjecucionFin||"—"})`).join(", ")}`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("[")) { const m=text.match(/\[[\s\S]*\]/); text=m?m[0]:"[]"; }
    }

    // ── CALENDAR SYNC ─────────────────────────────────────────────
    if (type==="calendar_sync") {
      const {projects=[]}=body;
      const today=new Date().toISOString().slice(0,10).replace(/-/g,"/");
      const in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10).replace(/-/g,"/");
      const kwCtx=projects.map(p=>`- ${p.id}: ${(p.keywords||[]).join(", ")}`).join("\n");

      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:2000,
        mcp_servers:[MCP_GMAIL],
        system:`Extrae reuniones de proyectos SECPLA desde Gmail. Keywords:\n${kwCtx}\nRetorna SOLO array JSON:\n[{"id":"","title":"","start":"YYYY-MM-DD","time":"HH:MM","description":"","projectId":"","participants":[],"url":""}]\nSi no hay, retorna [].`,
        messages:[{role:"user",content:`Busca invitaciones de calendario y reuniones SECPLA en Gmail para ${today} al ${in30}.`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("[")) { const m=text.match(/\[[\s\S]*\]/); text=m?m[0]:"[]"; }
    }

    // ── VERIFY SENT ───────────────────────────────────────────────
    if (type==="verify_sent") {
      const {taskText="",projectName="",keywords=[]}=body;
      const taskWords=taskText.replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]/g," ").split(/\s+/).filter(w=>w.length>4).slice(0,5).join(" OR ");
      const terms=[...(keywords.slice(0,4)),taskWords].filter(Boolean).join(" OR ");

      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:800,
        mcp_servers:[MCP_GMAIL],
        system:`Verifica si anavarro@recoleta.cl envió correo respondiendo una solicitud. Retorna SOLO JSON:\nSi encontraste: {"found":true,"messageId":"","threadId":"","subject":"","sentDate":"YYYY-MM-DD","sentTime":"HH:MM","to":"","emailUrl":"","snippet":"","howAnswered":"","pendingReply":false,"pendingReplyNote":""}\nSi no: {"found":false}`,
        messages:[{role:"user",content:`Verifica correo enviado para: "${taskText}" | Proyecto: ${projectName} | Búsqueda: ${terms}`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("{")) { const m=text.match(/\{[\s\S]*\}/); text=m?m[0]:'{"found":false}'; }
    }

    // ── GMAIL SCAN ────────────────────────────────────────────────
    if (type==="gmail_scan") {
      const {projects=[],since="2026/04/01"}=body;
      const kwCtx=projects.map(p=>`- ${p.id} "${p.name}": ${(p.keywords||[]).join(", ")}`).join("\n");
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:3000,
        mcp_servers:[MCP_GMAIL],
        system:`Monitorea correos SECPLA para anavarro@recoleta.cl. EXCLUYE correos de ${CLOCK_SENDER}.\nKeywords:\n${kwCtx}\nRetorna SOLO array JSON:\n[{"messageId":"","threadId":"","projectId":"","subject":"","from":"","date":"YYYY-MM-DD","type":"requiere_accion|confirmacion|informativo|invitacion_reunion","urgency":"crítica|alta|media|baja","summary":"","requiresResponse":true,"daysWithoutResponse":0,"emailUrl":""}]`,
        messages:[{role:"user",content:`Escanea Gmail de anavarro@recoleta.cl desde ${since} por correos SECPLA. Excluye reloj control.`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("[")) { const m=text.match(/\[[\s\S]*\]/); text=m?m[0]:"[]"; }
    }

    // ── READ RECEIPTS SYNC ─────────────────────────────────────────
    // Lee todos los acuses de lectura (subject contiene "Read:" o "Leído:")
    // Agrupa por correo original enviado, lista quién confirmó y cuándo.
    if (type==="read_receipts_sync") {
      const {since="2026/01/01"}=body;
      const res=await client.messages.create({
        model:"claude-sonnet-4-5",max_tokens:4000,
        mcp_servers:[MCP_GMAIL],
        system:`Eres un asistente que extrae acuses de lectura de Gmail para Alexis Navarro (anavarro@recoleta.cl).

Los acuses de lectura tienen asuntos como:
- "Read: [asunto original]"
- "Leído: [asunto original]"
Los envía el cliente de correo del destinatario automáticamente cuando abre el mensaje.
El cuerpo contiene: "Tu mensaje Para: [nombre] Asunto: [asunto] Fecha: [fecha] se ha leído el [fecha y hora]"

TAREA:
1. Busca en Gmail todos los mensajes con asunto que empiece con "Read:" o "Leído:" desde ${since}
2. Agrupa los acuses por el asunto original del correo (sin el prefijo "Read:" o "Leído:")
3. Para cada correo original, extrae la lista de quién confirmó lectura y a qué hora
4. Deduce el proyecto al que pertenece el correo según el asunto

Retorna SOLO un array JSON sin markdown:
[{
  "id": "id_unico_basado_en_asunto",
  "subject": "asunto del correo original (sin Read:/Leído: prefix)",
  "context": "descripción breve de qué trata el correo en 1 línea",
  "sentDate": "YYYY-MM-DD",
  "sentTime": "HH:MM",
  "threadUrl": "https://mail.google.com/mail/u/0/#all/THREADID",
  "project": "p1|p2|p3|p4|p5|null",
  "recipients": [
    {
      "name": "Nombre del destinatario",
      "email": "correo@dominio.cl",
      "readAt": "YYYY-MM-DD HH:MM",
      "msgId": "id_del_mensaje_acuse"
    }
  ]
}]

Proyectos de referencia para clasificar:
- p5: sala monitoreo, consistorial, torre telecom, trato directo, MTT cámaras
- p2: SNSM23-STP-0039, SNSM2025, modificación plazo SPD
- p3: centros culturales, CCTV
- p4: UV32, BNUP
- p1: 6ta comisaría, comisaria, empalme eléctrico

Responde SOLO el JSON.`,
        messages:[{role:"user",content:`Busca todos los acuses de lectura en Gmail de anavarro@recoleta.cl desde ${since}. Busca subject:"Read:" OR subject:"Leído:"`}],
      });
      text=extractText(res.content);
      if(!text.trim().startsWith("[")) { const m=text.match(/\[[\s\S]*\]/); text=m?m[0]:"[]"; }
    }

    return Response.json({ text });

  } catch (err) {
    console.error("[SECPLA API]", err?.message||err);
    // Retorna código de error estructurado para el frontend
    return Response.json({
      text: "",
      error: true,
      errorCode: err?.code || err?.status || "UNKNOWN",
      errorMessage: err?.message || "Error desconocido en el servidor"
    }, { status: 500 });
  }
}
