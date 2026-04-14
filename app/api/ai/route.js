import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();
    const { type } = body;
    let text = "";

    if (type === "chat") {
      const { messages, context, follows } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: `Eres el Asistente SECPLA de la Municipalidad de Recoleta. Apoyas a Alexis Navarro, Líder de Proyectos SECPLA. Español, directo, ejecutivo. Usa negritas para datos clave. Montos siempre en CLP completos sin abreviar.\n\nCARTERA:\n${context}\n\nSEGUIMIENTOS GMAIL PENDIENTES:\n${follows || "Ninguno"}\n\nFECHA: ${new Date().toLocaleDateString("es-CL")}`,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      text = res.content.map((c) => c.text || "").join("");
    }

    if (type === "summary") {
      const { project, notes } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: `Genera un resumen ejecutivo de 3-5 oraciones basado en las notas de gestión. Directo, sin títulos ni markdown. Destaca: estado actual, gestiones recientes, pendientes y próximos pasos.`,
        messages: [{ role: "user", content: `PROYECTO: ${project.name}\nFinanciamiento: ${project.financier} — ${project.program}\nPresupuesto: ${project.budget} CLP\nEtapa: ${project.stage} | Estado: ${project.status}\n\nNOTAS:\n${notes}` }],
      });
      text = res.content.map((c) => c.text || "").join("");
    }

    if (type === "licit") {
      const { licitId } = body;
      const res = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: `Busca la licitación en mercadopublico.cl y responde SOLO en JSON sin markdown:\n{"estado":"Publicada|En proceso|Cerrada|Adjudicada|Desierta|Revocada|Desconocido","nombre":"nombre oficial","organismo":"organismo","descripcion":"descripción breve","fechaPublicacion":"YYYY-MM-DD","fechaCierre":"YYYY-MM-DD","fechaAdjudicacion":"YYYY-MM-DD","monto":"","tipo":"","url":"URL directa"}`,
        messages: [{ role: "user", content: `Busca en mercadopublico.cl la licitación: ${licitId}` }],
      });
      text = res.content.filter((c) => c.type === "text").map((c) => c.text || "").join("");
    }

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
      text = res.content.map((c) => c.text || "").join("");
    }

    return Response.json({ text });
  } catch (err) {
    console.error(err);
    return Response.json({ text: "Error en el servidor." }, { status: 500 });
  }
} 
