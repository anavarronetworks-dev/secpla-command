"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * SECPLA Command v4.0
 * Municipalidad de Recoleta — Alexis Navarro
 *
 * FEATURES:
 *   ✓ Dashboard: cartera de proyectos con CRUD completo
 *   ✓ Bandeja de correos importantes (auto-scan + manual)
 *     - Omite automáticamente comunicaciones@recoleta.cl y boletines
 *     - Muestra: quién mandó, título, hace cuántos días, botón Seguir o Descartar
 *   ✓ Seguimientos activos: correos que necesitas responder
 *   ✓ Cotizaciones SNSM 2025: tracking por empresa con historial Gmail
 *   ✓ Reloj Control: entrada/salida + extras acumulados
 *   ✓ Solicitudes de jefatura
 *   ✓ SIEVAP countdown
 *   ✓ Asistente IA contextual
 *   ✓ Persistencia robusta (auto-save sin botón guardar)
 *
 * ELIMINADO (simplificación):
 *   ✗ Acuses de lectura
 *   ✗ Integración Google Drive
 *   ✗ Calendario de reuniones
 */

// ══════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════
const F = n => `${Math.round(n * 1.5)}px`;
const fCLP = n => !n ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`;
const fDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const uid = () => Math.random().toString(36).slice(2, 9);

// ── Persistencia robusta ──────────────────────────────
// Guarda en localStorage con backup automático.
// Si el valor principal se corrompe, usa el backup.
// Los datos NUNCA se pierden salvo que el usuario limpie el navegador.
const DB_VER = "v4";
function dbGet(key, def) {
  if (typeof window === "undefined") return def;
  const k = `secpla_${DB_VER}_${key}`;
  const bk = `secpla_bk_${DB_VER}_${key}`;
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed != null) return parsed;
    }
  } catch {}
  try {
    const raw = localStorage.getItem(bk);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed != null) {
        console.warn(`[SECPLA] Recuperando backup: ${key}`);
        try { localStorage.setItem(k, raw); } catch {}
        return parsed;
      }
    }
  } catch {}
  return def;
}
function dbSet(key, value) {
  if (typeof window === "undefined") return;
  const k = `secpla_${DB_VER}_${key}`;
  const bk = `secpla_bk_${DB_VER}_${key}`;
  try {
    const prev = localStorage.getItem(k);
    if (prev) { try { localStorage.setItem(bk, prev); } catch {} }
    localStorage.setItem(k, JSON.stringify(value));
  } catch (e) {
    console.error(`[SECPLA] Error guardando ${key}:`, e);
  }
}

// Hook: estado persistente con auto-save y sync entre tabs
function useDB(key, init) {
  const [val, setVal] = useState(() => dbGet(key, typeof init === "function" ? init() : init));
  const set = useCallback(v => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      dbSet(key, next);
      return next;
    });
  }, [key]);
  // Sync entre pestañas
  useEffect(() => {
    const h = e => {
      if (e.key === `secpla_${DB_VER}_${key}` && e.newValue) {
        try { setVal(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [key]);
  return [val, set];
}

// ── Fetch con auto-log de errores ─────────────────────
async function apiFetch(body, source) {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.clone().json().catch(() => ({}));
      const code = err.errorCode || `HTTP_${res.status}`;
      const msg = err.errorMessage || res.statusText;
      console.error(`[SECPLA][${source}] ${code}: ${msg}`);
      return { ok: false, code, msg, data: err };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    console.error(`[SECPLA][${source}] FETCH_ERROR:`, e.message);
    return { ok: false, code: "NETWORK", msg: e.message, data: {} };
  }
}

// ── Parse JSON seguro ─────────────────────────────────
function parseJSON(raw, def) {
  try { return JSON.parse((raw || "").replace(/```json|```/g, "").trim()); }
  catch { return def; }
}

// ══════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════
const SC = { "En curso": "#3b82f6", "Pendiente": "#f59e0b", "Detenido": "#ef4444", "Completado": "#22c55e", "Con alerta": "#f97316" };
const MPC = { "Publicada": "#059669", "En proceso": "#3b82f6", "Cerrada": "#f59e0b", "Adjudicada": "#7c3aed", "Desierta": "#ef4444", "Revocada": "#ef4444" };
const UC = { "crítica": "#ef4444", "alta": "#f97316", "media": "#f59e0b" };
const UL = { "crítica": "🔴", "alta": "🟠", "media": "🟡" };
const STAGES = ["Formulación", "Diseño", "Licitación", "Adjudicación", "Ejecución", "Recepción", "Completado", "Archivado"];
const STATUSES = ["En curso", "Pendiente", "Detenido", "Completado", "Con alerta"];
const FINANCIERS = ["GORE", "SPD", "Municipal", "MININT", "FNDR", "Otro"];
const MONTHS_ES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_FULL = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const PROJ_KW = {
  p1: ["6ta comisaría", "habilitación tecnológica", "1431841-10-LE25", "empalme eléctrico", "ENEL"],
  p2: ["SNSM23-STP-0039", "SNSM2025", "SNSM25", "SNSM25-STP-0113", "integración cámaras", "sievap"],
  p3: ["CCTV centros culturales", "centros culturales", "CDP N°79"],
  p4: ["UV32", "UV N°32", "cámaras UV", "BNUP", "40066179"],
  p5: ["sala de monitoreo", "consistorial", "torre telecom", "trato directo"],
};

const isFri = d => new Date(d + "T12:00:00").getDay() === 5;
const jornMin = d => isFri(d) ? 480 : 540;
const toMin = t => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fMin = m => { const a = Math.abs(m); const h = Math.floor(a / 60); const mn = a % 60; return h > 0 ? `${h}h ${mn}m` : `${mn}m`; };

// ══════════════════════════════════════════════════════
// DATOS SEMILLA
// ══════════════════════════════════════════════════════
const INIT_PROJECTS = [
  { id: "p1", name: "Servicio de Habilitación Tecnológica 6ta Comisaría", budget: 40000000, stage: "Formulación", status: "En curso", deadline: "", financier: "SPD", program: "FNSP", desc: "Habilitación tecnológica sala de televigilancia Sexta Comisaría de Carabineros. ID: 1431841-10-LE25. Pendiente ITS y empalme eléctrico ENEL.", notes: "", aiSummary: "", licitId: "", licitData: null, licitChecked: "", docs: [], emails: [], tasks: [] },
  { id: "p2", name: "Integración de Cámaras de Televigilancia en la Comuna de Recoleta", budget: 100000000, stage: "Licitación", status: "En curso", deadline: "", financier: "SPD", program: "SNSM 2025", codigoProyecto: "SNSM25-STP-0113", codigoSIGE: "22004928", desc: "7 postaciones galvanizadas 15m, PTZ, reconocimiento facial, ANPR. Ficha modificación plazo enviada a SPD.", notes: "", aiSummary: "", licitId: "", licitData: null, licitChecked: "", docs: [], emails: [], tasks: [] },
  { id: "p3", name: "Sistemas de CCTV, Centros Culturales", budget: 26000000, stage: "Licitación", status: "En curso", deadline: "", financier: "SPD", program: "FNSP", codigoProyecto: "CDP N°79", desc: "Sistema CCTV centros culturales. CDP N°79 emitido. Pendiente publicación Mercado Público.", notes: "", aiSummary: "", licitId: "", licitData: null, licitChecked: "", docs: [], emails: [], tasks: [] },
  { id: "p4", name: "Cámaras de Televigilancia UV N°32", budget: 914371153, stage: "Adjudicación", status: "En curso", deadline: "2026-04-30", financier: "GORE RM", program: "FNDR", codigoProyecto: "BIP 40066179-0", desc: "Cámaras vigilancia urbana. Adjudicación 30 abril. Pendiente BNUP.", notes: "", aiSummary: "", licitId: "", licitData: null, licitChecked: "", docs: [], emails: [], tasks: [] },
  { id: "p5", name: "Habilitación Sala de Monitoreo Edificio Consistorial", budget: 100000000, stage: "Licitación", status: "Con alerta", deadline: "2026-06-30", financier: "SPD", program: "SNSM 2023", codigoProyecto: "SNSM23-STP-0039 / SNSM23-CMP-0010", codigoSIGE: "21460117", desc: "LP25 desierta, LP26 revocada. En trato directo.", notes: "", aiSummary: "", licitId: "1431841-68-LP25", licitData: null, licitChecked: "", docs: [], emails: [], tasks: [], convenio: { plazoEjecucionFin: "2026-06-30", plazoConvenioFin: "2026-09-30", modificaciones: [{ tipo: "Mod. técnica intraítem", oficio: "N°1258 SPD", aprobacion: "2025-05-20", estado: "aprobada" }, { tipo: "Ampliación plazo 13 meses", oficio: "N°2321 SPD", aprobacion: "2025-09-04", estado: "aprobada" }] } },
];

const INIT_BOSS = [
  { id: "b1", from: "María Paz Juica", projectId: "p5", urgency: "crítica", task: "Presentación diagnóstico 3 salas de cámaras para reunión Alcaldía.", requestDate: "2026-04-10", status: "pendiente", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d790219c18994c" },
  { id: "b2", from: "María Paz Juica", projectId: "p2", urgency: "alta", task: "Subsanar observaciones SNSM25-STP-0113. Plazo 15 días desde 9 abril.", requestDate: "2026-04-09", status: "pendiente", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" },
  { id: "b3", from: "María Paz Juica", projectId: "p2", urgency: "alta", task: "Confirmar recepción Certificados BNUP proyecto SNSM2025.", requestDate: "2026-04-13", status: "pendiente", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4" },
  { id: "b4", from: "María Paz Juica", projectId: "p5", urgency: "media", task: "Gestionar Decreto modifica Comisión Evaluadora — licitación desierta Sala Monitoreo.", requestDate: "2026-04-10", status: "pendiente", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d3f351893aaf74" },
  { id: "b5", from: "María Paz Juica", projectId: "p1", urgency: "media", task: "Antecedentes corregidos 6ta Comisaría con SECPLA como ITS.", requestDate: "2026-04-06", status: "completado", completedNote: "Entregado el 8 abril.", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d1c4a8a983aa5c" },
  { id: "b7", from: "Grace Arcos", projectId: "p5", urgency: "alta", task: "Reunión Opciones Sala Televigilancia — 15 abril 13:00 hrs.", requestDate: "2026-04-08", status: "pendiente", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d6dc78c627480e" },
  { id: "b8", from: "Grace Arcos", projectId: "p1", urgency: "alta", task: "Seguimiento empalme eléctrico 6ta Comisaría — reunión 15 abril con ENEL.", requestDate: "2026-04-13", status: "pendiente", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d892c228474fcc" },
];

const INIT_FOLLOWS = [
  { id: "gf1", projectId: "p5", urgency: "crítica", subject: "2do Llamado Trato Directo — Sala Monitoreo Consistorial", to: "Securitas / Prosegur", context: "2 correos rebotaron. Buscar emails correctos.", sentDate: "2026-04-10", daysPending: 3, status: "activo", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d73316aebeb956" },
  { id: "gf2", projectId: "p5", urgency: "alta", subject: "Factibilidad uso Torre Telecom — Sala Monitoreo", to: "Francisco Moscoso", context: "Pronunciamiento sobre repetidor 5GHz.", sentDate: "2026-04-01", daysPending: 12, status: "activo", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d4aa05342a51ac" },
  { id: "gf3", projectId: "p2", urgency: "alta", subject: "Modificación Plazo SNSM23-STP-0039 — Ficha enviada a SPD", to: "Osvaldo Muñoz (SPD)", context: "Ficha subsanada enviada 7 abril. SPD no ha confirmado.", sentDate: "2026-04-07", daysPending: 6, status: "activo", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d1ab5d03fb53ce" },
  { id: "gf4", projectId: "p3", urgency: "alta", subject: "CCTV Centros Culturales — CDP emitido, iniciar licitación MP", to: "María Paz Juica / Alvaro Porzio", context: "CDP N°79 emitido 1 abril. Pendiente ingreso MP.", sentDate: "2026-04-01", daysPending: 12, status: "activo", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d2665ac1e575ac" },
  { id: "gf5", projectId: "p4", urgency: "media", subject: "Cámaras UV N°32 — Certificados BNUP pendientes", to: "María Paz Juica", context: "Al 13 abril solo Certificados de Número. Adjudicación 30 abril.", sentDate: "2026-04-13", daysPending: 0, status: "activo", threadUrl: "https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4" },
];

const SIEVAP_START    = new Date("2026-04-09T00:00:00");
const SIEVAP_DEADLINE = new Date("2026-04-24T23:59:59");
const SIEVAP_TOTAL    = 15;

const ALL_CLOCK = [
  {date:"2026-01-29",e:null,s:"16:53"},{date:"2026-01-30",e:"07:43",s:"15:46"},
  {date:"2026-02-04",e:"07:48",s:"17:00"},{date:"2026-02-05",e:"07:42",s:"16:44"},
  {date:"2026-02-06",e:"08:05",s:"16:13"},{date:"2026-02-09",e:"08:15",s:"17:21"},
  {date:"2026-02-10",e:"08:37",s:"17:40"},{date:"2026-02-11",e:"07:44",s:"16:56"},
  {date:"2026-02-12",e:"07:44",s:"16:56"},{date:"2026-02-13",e:"08:15",s:null},
  {date:"2026-02-16",e:"07:40",s:"17:05"},{date:"2026-02-17",e:"07:42",s:"16:52"},
  {date:"2026-02-18",e:"07:57",s:"17:04"},{date:"2026-02-19",e:"07:26",s:"16:34"},
  {date:"2026-02-20",e:"07:50",s:"15:59"},{date:"2026-02-23",e:"07:45",s:"16:50"},
  {date:"2026-02-24",e:"07:49",s:"16:53"},{date:"2026-02-25",e:null,s:"17:07"},
  {date:"2026-02-26",e:"07:41",s:"16:54"},{date:"2026-02-27",e:"07:54",s:"16:08"},
  {date:"2026-03-02",e:"08:35",s:"17:38"},{date:"2026-03-03",e:"08:25",s:"17:41"},
  {date:"2026-03-04",e:"08:29",s:"17:36"},{date:"2026-03-05",e:"08:26",s:"17:31"},
  {date:"2026-03-06",e:"08:21",s:"16:28"},{date:"2026-03-09",e:"08:24",s:"17:40"},
  {date:"2026-03-10",e:"08:36",s:"17:40"},{date:"2026-03-11",e:"08:14",s:"17:27"},
  {date:"2026-03-12",e:"08:34",s:"17:44"},{date:"2026-03-13",e:"08:32",s:"16:46"},
  {date:"2026-03-16",e:"08:26",s:"17:29"},{date:"2026-03-17",e:"08:21",s:"17:33"},
  {date:"2026-03-18",e:"08:18",s:"17:28"},{date:"2026-03-19",e:"08:21",s:"17:25"},
  {date:"2026-03-20",e:"08:16",s:"16:12"},{date:"2026-03-23",e:"08:39",s:"17:48"},
  {date:"2026-03-24",e:"08:19",s:"17:24"},{date:"2026-03-25",e:"08:27",s:"17:40"},
  {date:"2026-03-30",e:"08:33",s:"17:36"},{date:"2026-03-31",e:"08:28",s:"17:33"},
  {date:"2026-04-01",e:"08:31",s:"17:36"},{date:"2026-04-02",e:"08:34",s:"17:32"},
  {date:"2026-04-06",e:"08:18",s:"17:25"},{date:"2026-04-07",e:"08:42",s:"18:26"},
  {date:"2026-04-08",e:"08:26",s:"17:28"},{date:"2026-04-09",e:"08:40",s:"17:41"},
  {date:"2026-04-10",e:"08:21",s:"16:34"},{date:"2026-04-13",e:"08:26",s:"17:37"},
  {date:"2026-04-14",e:"08:30",s:"17:36"},{date:"2026-04-15",e:"08:24",s:null},
];
// normalize: entrada → e, salida → s
const normClock = ALL_CLOCK.map(r => ({ date: r.date, entrada: r.e ?? r.entrada ?? null, salida: r.s ?? r.salida ?? null }));

// ══════════════════════════════════════════════════════
// COMPONENTES EXTERNOS (fuera de Page → regla hooks React)
// ══════════════════════════════════════════════════════

// ── Bandeja de correos (inbox scan) ──────────────────
// Muestra correos de la última semana agrupados por hilo.
// Permite: "Seguir" → crea seguimiento activo / "Descartar" → oculta.
function BandejaPanel({ bandeja, follows, onFollow, onDiscard, onRefresh, syncing, syncMsg, F, btn }) {
  const [expanded, setExpanded] = useState(null);
  const discarded = dbGet("bandeja_discarded", []);
  const followed = new Set((follows || []).map(f => f.threadId).filter(Boolean));

  // Filtrar descartados y ya en seguimiento
  const visible = (bandeja || []).filter(m =>
    !discarded.includes(m.threadId) && !followed.has(m.threadId)
  );

  const daysColor = d => d > 7 ? "#ef4444" : d > 3 ? "#f97316" : d > 1 ? "#f59e0b" : "#059669";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: F(13), fontWeight: 700, color: "#0284c7" }}>
          📥 Bandeja — Correos importantes {visible.length > 0 && <span style={{ marginLeft: 6, background: "#eff6ff", color: "#1d4ed8", borderRadius: 10, padding: "1px 8px", fontSize: F(10), fontWeight: 700 }}>{visible.length}</span>}
        </div>
        <button onClick={onRefresh} disabled={syncing} style={{ ...btn(syncing ? "#94a3b8" : "#0284c7"), fontSize: F(11), padding: "6px 12px" }}>
          {syncing ? "⏳" : "🔄"} Actualizar
        </button>
      </div>

      {syncMsg && (
        <div style={{ fontSize: F(11), color: syncMsg.includes("error") || syncMsg.includes("Error") ? "#dc2626" : syncMsg.includes("Sin credenciales") ? "#d97706" : "#059669", marginBottom: 8, padding: "6px 10px", background: "#f8fafc", borderRadius: 6, border: "0.5px solid #e2e8f0" }}>
          {syncMsg}
        </div>
      )}

      {visible.length === 0 && !syncing && (
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "20px 14px", textAlign: "center", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: F(22), marginBottom: 6 }}>✅</div>
          <div style={{ fontSize: F(12), color: "#15803d", fontWeight: 600 }}>Bandeja limpia</div>
          <div style={{ fontSize: F(11), color: "#64748b", marginTop: 3 }}>Sin correos pendientes de revisión</div>
        </div>
      )}

      {visible.map(m => {
        const isExp = expanded === m.threadId;
        const dc = daysColor(m.daysSinceLastMsg);
        return (
          <div key={m.threadId} style={{ background: "white", borderRadius: 10, marginBottom: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: F(13), fontWeight: 600, color: "#0f172a", marginBottom: 3, lineHeight: 1.3 }}>
                  {m.subject?.length > 70 ? m.subject.slice(0, 70) + "…" : m.subject}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: F(11), color: "#475569", fontWeight: 500 }}>{m.fromName?.slice(0, 35)}</span>
                  <span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 10, background: dc + "18", color: dc, fontWeight: 700 }}>
                    hace {m.daysSinceLastMsg}d
                  </span>
                </div>
                {isExp && m.snippet && (
                  <div style={{ marginTop: 6, fontSize: F(11), color: "#64748b", lineHeight: 1.5, padding: "6px 8px", background: "#f8fafc", borderRadius: 5 }}>
                    {m.snippet}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setExpanded(isExp ? null : m.threadId)} style={{ fontSize: F(10), padding: "4px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b" }}>
                  {isExp ? "▲" : "▼"}
                </button>
                {m.threadUrl && (
                  <a href={m.threadUrl} target="_blank" rel="noreferrer" style={{ fontSize: F(10), padding: "4px 8px", borderRadius: 5, background: "#eff6ff", color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}>
                    Gmail
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: "0 14px 11px", flexWrap: "wrap" }}>
              <button onClick={() => onFollow(m)} style={{ ...btn("#1d4ed8"), fontSize: F(11), padding: "5px 12px" }}>
                📌 Seguir
              </button>
              <button onClick={() => onDiscard(m.threadId)} style={{ fontSize: F(11), padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#94a3b8", cursor: "pointer" }}>
                Descartar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Panel de seguimientos activos ─────────────────────
function FollowsPanel({ follows, projects, onResolve, onAdd, F, btn, UC, UL, fDate }) {
  const [showForm, setShowForm] = useState(false);
  const [nf, setNf] = useState({ projectId: "", urgency: "media", subject: "", to: "", context: "", threadUrl: "" });

  const active = [...follows.filter(f => f.status === "activo")]
    .sort((a, b) => ({ "crítica": 0, "alta": 1, "media": 2 }[a.urgency] ?? 3) - ({ "crítica": 0, "alta": 1, "media": 2 }[b.urgency] ?? 3));
  const resolved = follows.filter(f => f.status === "resuelto");

  const saveNew = () => {
    if (!nf.subject || !nf.to) return;
    onAdd({ id: uid(), ...nf, sentDate: new Date().toISOString().slice(0, 10), daysPending: 0, status: "activo", manual: true });
    setNf({ projectId: "", urgency: "media", subject: "", to: "", context: "", threadUrl: "" });
    setShowForm(false);
  };

  const inp = { padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: F(12), width: "100%", boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: F(13), fontWeight: 700, color: "#dc2626" }}>
          📬 Seguimientos activos {active.length > 0 && <span style={{ marginLeft: 6, background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "1px 8px", fontSize: F(10), fontWeight: 700 }}>{active.length}</span>}
        </div>
        <button onClick={() => setShowForm(x => !x)} style={{ ...btn(showForm ? "#64748b" : "#0284c7"), fontSize: F(11), padding: "6px 12px" }}>
          {showForm ? "✕ Cancelar" : "+ Agregar"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, border: "1px solid #bfdbfe", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div><label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 3 }}>Proyecto</label>
              <select value={nf.projectId} onChange={e => setNf(x => ({ ...x, projectId: e.target.value }))} style={inp}>
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name.slice(0, 35)}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 3 }}>Urgencia</label>
              <select value={nf.urgency} onChange={e => setNf(x => ({ ...x, urgency: e.target.value }))} style={inp}>
                <option value="crítica">🔴 Crítica</option><option value="alta">🟠 Alta</option><option value="media">🟡 Media</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 3 }}>Asunto *</label><input value={nf.subject} onChange={e => setNf(x => ({ ...x, subject: e.target.value }))} placeholder="Ej: Respuesta pendiente SPD" style={inp} /></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 3 }}>Destinatario / Remitente *</label><input value={nf.to} onChange={e => setNf(x => ({ ...x, to: e.target.value }))} placeholder="Nombre o email" style={inp} /></div>
          <div style={{ marginBottom: 8 }}><label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 3 }}>Contexto</label><textarea value={nf.context} onChange={e => setNf(x => ({ ...x, context: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} /></div>
          <div style={{ marginBottom: 10 }}><label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 3 }}>URL Gmail (opcional)</label><input value={nf.threadUrl} onChange={e => setNf(x => ({ ...x, threadUrl: e.target.value }))} placeholder="https://mail.google.com/..." style={inp} /></div>
          <button onClick={saveNew} style={{ ...btn("#1d4ed8"), fontSize: F(12) }}>Guardar seguimiento</button>
        </div>
      )}

      {active.length === 0 && (
        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "16px 14px", textAlign: "center", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: F(12), color: "#15803d", fontWeight: 600 }}>🎉 Sin seguimientos activos</div>
        </div>
      )}

      {active.map(f => {
        const fp = projects.find(p => p.id === f.projectId);
        return (
          <div key={f.id} style={{ background: "white", borderRadius: 10, padding: 14, border: `1px solid ${UC[f.urgency]}33`, marginBottom: 10, borderLeft: `4px solid ${UC[f.urgency]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: F(13), fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>
                  {UL[f.urgency]} {f.subject}
                  {f.manual && <span style={{ marginLeft: 6, fontSize: F(9), color: "#0284c7" }}>✋manual</span>}
                </div>
                <div style={{ fontSize: F(11), color: "#64748b" }}>→ {f.to}</div>
                {fp && <div style={{ marginTop: 3 }}><span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 6, background: "#f1f5f9", color: "#475569" }}>{fp.name.slice(0, 40)}</span></div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: F(13), fontWeight: 700, color: UC[f.urgency] }}>{f.daysPending}d</div>
                <div style={{ fontSize: F(10), color: "#94a3b8" }}>{fDate(f.sentDate)}</div>
              </div>
            </div>
            {f.context && <div style={{ fontSize: F(11), color: "#475569", lineHeight: 1.5, padding: "6px 8px", background: "#f8fafc", borderRadius: 5, marginBottom: 8 }}>{f.context}</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {f.threadUrl && <a href={f.threadUrl} target="_blank" rel="noreferrer" style={{ fontSize: F(11), padding: "5px 12px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}>✉️ Gmail</a>}
              <button onClick={() => onResolve(f.id)} style={{ ...btn("#dcfce7", "#166534"), fontSize: F(11), padding: "5px 12px" }}>✅ Resuelto</button>
            </div>
          </div>
        );
      })}

      {resolved.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: F(11), color: "#94a3b8", cursor: "pointer", padding: "5px 0" }}>
            Ver {resolved.length} resueltos
          </summary>
          <div style={{ marginTop: 6 }}>
            {resolved.slice(0, 15).map(f => (
              <div key={f.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 6, opacity: 0.75, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: F(12), color: "#64748b", textDecoration: "line-through" }}>{f.subject}</div>
                  <div style={{ fontSize: F(10), color: "#94a3b8" }}>→ {f.to} · {fDate(f.sentDate)}</div>
                  {f.resolvedAt && <div style={{ fontSize: F(10), color: "#059669" }}>✅ {fDate(f.resolvedAt)}</div>}
                </div>
                <button onClick={() => onResolve(f.id, "reopen")} style={{ fontSize: F(10), padding: "3px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b" }}>↩</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Panel cotizaciones SNSM 2025 ─────────────────────
function CotizPanel({ cotiz, syncing, syncMsg, onRefresh, F, btn, fDate }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");

  const ST = {
    sin_enviar:             { c: "#64748b", bg: "#f1f5f9", lbl: "Sin enviar",          ic: "○" },
    enviado:                { c: "#3b82f6", bg: "#eff6ff", lbl: "Enviado, esperando",  ic: "📤" },
    sin_respuesta:          { c: "#f59e0b", bg: "#fffbeb", lbl: "Sin respuesta",        ic: "⏳" },
    sin_respuesta_urgente:  { c: "#ef4444", bg: "#fef2f2", lbl: "Urgente — sin resp.",  ic: "🚨" },
    respondido:             { c: "#0284c7", bg: "#e0f2fe", lbl: "Respondió",            ic: "💬" },
    cotizacion_recibida:    { c: "#059669", bg: "#f0fdf4", lbl: "Cotización recibida",  ic: "✅" },
    email_rebotado:         { c: "#dc2626", bg: "#fee2e2", lbl: "Email rebotado",       ic: "❌" },
  };

  const SEED = [
    { empresa: "Scharfstein",   contacto: "Sebastián Merino", email: "smerino@scharfstein.cl",       estado: "sin_respuesta_urgente", totalEnviados: 3, totalRecibidos: 0, diasSinResp: 14, firstSent: null, lastSent: null, lastRecv: null, timeline: [] },
    { empresa: "Bionic Vision", contacto: "Letxy Valero",     email: "lvalero@bionicvision.cl",      estado: "respondido",            totalEnviados: 2, totalRecibidos: 1, diasSinResp: 2,  firstSent: null, lastSent: null, lastRecv: null, timeline: [] },
    { empresa: "Grupo VSM",     contacto: "Comunicaciones",   email: "comunicaciones@grupovsm.cl",   estado: "sin_respuesta",         totalEnviados: 1, totalRecibidos: 0, diasSinResp: 5,  firstSent: null, lastSent: null, lastRecv: null, timeline: [] },
    { empresa: "RockTech",      contacto: "Fabiana Rifo",     email: "fabiana.rifo@rocktechla.com",  estado: "sin_respuesta",         totalEnviados: 1, totalRecibidos: 0, diasSinResp: 5,  firstSent: null, lastSent: null, lastRecv: null, timeline: [] },
    { empresa: "Securitas",     contacto: "Contacto",         email: "comercial@securitas.cl",       estado: "email_rebotado",        totalEnviados: 1, totalRecibidos: 0, diasSinResp: null, firstSent: null, lastSent: null, lastRecv: null, timeline: [] },
    { empresa: "Prosegur",      contacto: "Ventas",           email: "ventas.empresas@prosegur.com", estado: "email_rebotado",        totalEnviados: 1, totalRecibidos: 0, diasSinResp: null, firstSent: null, lastSent: null, lastRecv: null, timeline: [] },
  ];

  const data = cotiz?.length > 0 ? cotiz : SEED;
  const filtered = filter === "all" ? data : data.filter(c => c.estado === filter);
  const conCotiz = data.filter(c => c.estado === "cotizacion_recibida").length;
  const urgentes = data.filter(c => ["sin_respuesta_urgente", "email_rebotado"].includes(c.estado)).length;

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16, border: "2px solid #e0f2fe", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: F(14), fontWeight: 800, color: "#0c4a6e" }}>📋 Cotizaciones SNSM 2025</div>
          <div style={{ fontSize: F(11), color: "#64748b", marginTop: 2 }}>
            <strong style={{ color: "#059669" }}>{conCotiz}/{data.length}</strong> recibidas
            {urgentes > 0 && <> · <strong style={{ color: "#dc2626" }}>{urgentes} urgentes</strong></>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {syncMsg && <span style={{ fontSize: F(10), color: "#64748b" }}>{syncMsg}</span>}
          <button onClick={onRefresh} disabled={syncing} style={{ ...btn(syncing ? "#94a3b8" : "#0284c7"), fontSize: F(11), padding: "6px 12px" }}>
            {syncing ? "⏳" : "🔄"} Actualizar
          </button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {[["all", "Todas", data.length, "#64748b"], ["cotizacion_recibida", "✅ Recibidas", conCotiz, "#059669"], ["sin_respuesta_urgente", "🚨 Urgentes", urgentes, "#ef4444"], ["email_rebotado", "❌ Rebotados", data.filter(c => c.estado === "email_rebotado").length, "#dc2626"]].map(([fv, fl, cnt, fc]) => (
          <button key={fv} onClick={() => setFilter(fv)} style={{ fontSize: F(11), padding: "4px 10px", borderRadius: 20, border: `1px solid ${filter === fv ? fc : "#e2e8f0"}`, background: filter === fv ? fc : "white", color: filter === fv ? "white" : "#64748b", cursor: "pointer", fontWeight: 600 }}>
            {fl} {cnt > 0 && `(${cnt})`}
          </button>
        ))}
      </div>

      {filtered.map(c => {
        const cfg = ST[c.estado] || ST.sin_enviar;
        const isOpen = open === c.empresa;
        return (
          <div key={c.empresa} style={{ borderRadius: 10, marginBottom: 8, border: `1px solid ${cfg.c}33`, overflow: "hidden", borderLeft: `4px solid ${cfg.c}` }}>
            <div onClick={() => setOpen(isOpen ? null : c.empresa)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", background: cfg.bg + "60" }}>
              <span style={{ fontSize: F(11), color: "#94a3b8", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>▶</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: F(13), fontWeight: 800, color: "#0f172a" }}>{c.empresa}</span>
                  <span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 10, background: cfg.bg, color: cfg.c, fontWeight: 700 }}>{cfg.ic} {cfg.lbl}</span>
                  {c.diasSinResp != null && c.diasSinResp > 0 && <span style={{ fontSize: F(10), color: c.diasSinResp > 7 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>{c.diasSinResp}d sin resp.</span>}
                </div>
                <div style={{ fontSize: F(10), color: "#64748b", marginTop: 2 }}>{c.contacto} · 📤 {c.totalEnviados} · 📥 {c.totalRecibidos}</div>
              </div>
              {c.lastRecv?.url
                ? <a href={c.lastRecv.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: F(11), color: "#059669", fontWeight: 700, padding: "4px 9px", background: "#f0fdf4", borderRadius: 6, textDecoration: "none", flexShrink: 0 }}>📥 Respuesta</a>
                : c.lastSent?.url
                ? <a href={c.lastSent.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: F(11), color: "#1d4ed8", fontWeight: 700, padding: "4px 9px", background: "#eff6ff", borderRadius: 6, textDecoration: "none", flexShrink: 0 }}>📤 Envío</a>
                : null
              }
            </div>

            {isOpen && (
              <div style={{ padding: "10px 12px", borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
                {[
                  c.firstSent && { lbl: "🚀 Primer envío", color: "#1d4ed8", bg: "#eff6ff", ...c.firstSent },
                  c.lastSent && c.lastSent.url !== c.firstSent?.url && { lbl: "🔁 Último follow-up", color: "#d97706", bg: "#fffbeb", ...c.lastSent },
                  c.lastRecv && { lbl: "💬 Última respuesta", color: "#059669", bg: "#f0fdf4", ...c.lastRecv, isRecv: true },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: item.bg, borderRadius: 6, border: `0.5px solid ${item.color}33` }}>
                    <div style={{ fontSize: F(10), color: item.color, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{item.lbl}</div>
                    <div style={{ fontSize: F(12), fontWeight: 600, color: "#0f172a" }}>{item.subject}</div>
                    <div style={{ fontSize: F(11), color: "#64748b" }}>{fDate(item.date?.slice(0, 10) || "")}</div>
                    {item.snippet && <div style={{ fontSize: F(11), color: "#475569", fontStyle: "italic", marginTop: 3, padding: "4px 6px", background: "white", borderRadius: 4 }}>"{item.snippet.slice(0, 120)}…"</div>}
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: F(11), color: item.color, fontWeight: 600, display: "block", marginTop: 4 }}>Abrir en Gmail →</a>}
                  </div>
                ))}
                {c.timeline?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: F(10), color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>Historial ({c.timeline.length})</div>
                    {c.timeline.map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, padding: "5px 8px", background: "white", borderRadius: 5, marginBottom: 3, borderLeft: `3px solid ${m.type === "sent" ? "#3b82f6" : "#22c55e"}` }}>
                        <span style={{ flexShrink: 0 }}>{m.type === "sent" ? "📤" : "📥"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: F(11), fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</div>
                          <div style={{ fontSize: F(10), color: "#94a3b8" }}>{fDate(m.date?.slice(0, 10) || "")}</div>
                        </div>
                        {m.url && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: F(10), color: "#1d4ed8", alignSelf: "center", flexShrink: 0 }}>abrir</a>}
                      </div>
                    ))}
                  </div>
                )}
                {!c.firstSent && !c.lastSent && <div style={{ fontSize: F(11), color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>Sin historial. Presiona 🔄 Actualizar.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PAGE — componente principal
// ══════════════════════════════════════════════════════
function useW() {
  const [w, setW] = useState(900);
  useEffect(() => {
    setW(window.innerWidth);
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

export default function Page() {
  const w = useW();
  const mob = w < 768;

  // ── Estado persistido (auto-save) ───────────────────
  const [projects, setProjects] = useDB("projects", INIT_PROJECTS);
  const [follows,  setFollows]  = useDB("follows",  INIT_FOLLOWS);
  const [boss,     setBoss]     = useDB("boss",     INIT_BOSS);
  const [clockData,setClockData]= useDB("clock",    normClock);
  const [cotiz,    setCotiz]    = useDB("cotiz",    []);
  const [convenio, setConvenio] = useDB("convenio", []);
  const [bandeja,  setBandeja]  = useDB("bandeja",  []);
  const [syncSt,   setSyncSt]   = useDB("sync_st",  { reloj: "idle", gmail: "idle", cotiz: "idle" });
  const [syncMsg,  setSyncMsg]  = useDB("sync_msg", { reloj: "", gmail: "", cotiz: "" });

  // ── Estado UI (no persistido) ───────────────────────
  const [view,        setView]       = useState("dash");  // "dash" | "project" | "chat"
  const [sel,         setSel]        = useState(null);
  const [projTab,     setProjTab]    = useState("overview");
  const [clockMonth,  setClockMonth] = useState("2026-04");
  const [clockOpen,   setClockOpen]  = useState(false);
  const [notesDraft,  setNotesDraft] = useState("");
  const [newTask,     setNewTask]    = useState("");
  const [editId,      setEditId]     = useState(null);
  const [showForm,    setShowForm]   = useState(false);
  const [form,        setForm]       = useState({ name: "", budget: "", stage: "Formulación", status: "Pendiente", deadline: "", financier: "GORE", program: "", desc: "", notes: "", licitId: "" });
  const [emailForm,   setEmailForm]  = useState({ from: "", subject: "", date: "", body: "" });
  const [addingEmail, setAddingEmail]= useState(false);
  const [renamingId,  setRenamingId] = useState(null);
  const [renameVal,   setRenameVal]  = useState("");
  const [extracting,  setExtracting] = useState(false);
  const [fetchLicit,  setFetchLicit] = useState(null);
  const [genSum,      setGenSum]     = useState(false);
  const [msgs,        setMsgs]       = useState([{ role: "assistant", content: "Hola Alexis 👋\n\nAsistente SECPLA activo. Conozco toda tu cartera, seguimientos y cotizaciones SNSM 2025.\n\nEjemplos:\n• ¿Qué urgencias tengo hoy?\n• ¿Qué empresas no han cotizado SNSM?\n• Resumen p5 para reunión" }]);
  const [chatInput,   setChatInput]  = useState("");
  const [chatLoading, setChatLoading]= useState(false);
  const chatRef  = useRef(null);
  const fileRef  = useRef(null);

  // Sync: flags de carga
  const [loadingReloj, setLoadingReloj] = useState(false);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [loadingCotiz, setLoadingCotiz] = useState(false);

  const proj = projects.find(p => p.id === sel);

  // Sync notas al seleccionar proyecto
  useEffect(() => {
    if (sel) { const p = projects.find(x => x.id === sel); if (p) setNotesDraft(p.notes || ""); }
  }, [sel]);

  // ── Helpers ─────────────────────────────────────────
  const setStatus = (key, st, msg) => {
    setSyncSt(p => ({ ...p, [key]: st }));
    setSyncMsg(p => ({ ...p, [key]: msg }));
  };

  const upProject = updater => setProjects(prev => prev.map(p => p.id === sel ? updater(p) : p));

  const resolveFollow = (id, action = "resolve") => setFollows(prev => prev.map(f => {
    if (f.id !== id) return f;
    return action === "reopen" ? { ...f, status: "activo", resolvedAt: null } : { ...f, status: "resuelto", resolvedAt: new Date().toISOString().slice(0, 10) };
  }));

  const addFollow = newF => setFollows(prev => [...prev, newF]);

  // Bandeja → crear seguimiento
  const bandejaFollow = m => {
    const id = "inbox_" + m.messageId;
    if (follows.find(f => f.id === id)) return;
    setFollows(prev => [...prev, {
      id,
      projectId: "",
      urgency: "media",
      subject: m.subject,
      to: m.fromName || m.from,
      context: m.snippet || "",
      sentDate: new Date().toISOString().slice(0, 10),
      daysPending: m.daysSinceLastMsg || 0,
      status: "activo",
      threadId: m.threadId,
      threadUrl: m.threadUrl,
    }]);
    // Ocultar de bandeja
    bandejaDiscard(m.threadId);
  };

  const bandejaDiscard = threadId => {
    const prev = dbGet("bandeja_discarded", []);
    if (!prev.includes(threadId)) {
      dbSet("bandeja_discarded", [...prev, threadId]);
    }
    // Forzar re-render de bandeja
    setBandeja(p => [...p]);
  };

  // ══════════════════════════════════════════════════
  // SINCRONIZACIÓN
  // ══════════════════════════════════════════════════

  const syncReloj = async (silent = false) => {
    if (!silent) setStatus("reloj", "loading", "Leyendo Gmail...");
    setLoadingReloj(true);
    const { ok, data, code, msg } = await apiFetch({ type: "clock_sync" }, "clock_sync");
    if (!ok) { setStatus("reloj", "error", msg || code); setLoadingReloj(false); return; }
    if (data.warning === "NO_GOOGLE_CREDENTIALS") { setStatus("reloj", "warn", "Sin credenciales Google"); setLoadingReloj(false); return; }
    const parsed = parseJSON(data.text, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const gmailDates = new Set(parsed.map(r => r.date));
      const hist = normClock.filter(r => !gmailDates.has(r.date));
      const merged = [...hist, ...parsed].sort((a, b) => a.date.localeCompare(b.date));
      setClockData(merged);
      const today = parsed.find(r => r.date === new Date().toISOString().slice(0, 10));
      setStatus("reloj", "ok", today ? `✓ Hoy: ${today.entrada || "—"} → ${today.salida || "en curso"}` : `✓ ${parsed.length} días`);
    } else { setStatus("reloj", "warn", "Sin registros en Gmail"); }
    setLoadingReloj(false);
  };

  const syncGmail = async (silent = false) => {
    if (!silent) setStatus("gmail", "loading", "Escaneando bandeja...");
    setLoadingGmail(true);
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
    const allKw = [...new Set(Object.values(PROJ_KW).flat())];
    const { ok, data, code, msg } = await apiFetch({ type: "gmail_scan", since, keywords: allKw }, "gmail_scan");
    if (!ok) { setStatus("gmail", "error", msg || code); setLoadingGmail(false); return; }
    if (data.warning === "NO_GOOGLE_CREDENTIALS") { setStatus("gmail", "warn", "Sin credenciales Google"); setLoadingGmail(false); return; }
    const parsed = parseJSON(data.text, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      setBandeja(parsed);
      setStatus("gmail", "ok", `✓ ${parsed.length} correos en bandeja`);
    } else { setStatus("gmail", "warn", "Sin correos relevantes"); }
    setLoadingGmail(false);
  };

  const syncCotiz = async (silent = false) => {
    if (!silent) setStatus("cotiz", "loading", "Analizando cotizaciones...");
    setLoadingCotiz(true);
    const { ok, data, code, msg } = await apiFetch({ type: "cotizaciones_track" }, "cotizaciones_track");
    if (!ok) { setStatus("cotiz", "error", msg || code); setLoadingCotiz(false); return; }
    if (data.warning === "NO_GOOGLE_CREDENTIALS") { setStatus("cotiz", "warn", "Sin credenciales Google"); setLoadingCotiz(false); return; }
    const parsed = parseJSON(data.text, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      setCotiz(parsed);
      const conCotiz = parsed.filter(c => c.estado === "cotizacion_recibida").length;
      setStatus("cotiz", "ok", `✓ ${conCotiz}/${parsed.length} cotizaciones recibidas`);
    } else { setStatus("cotiz", "warn", "Sin datos de Gmail"); }
    setLoadingCotiz(false);
  };

  // ── Scheduler automático ─────────────────────────────
  const syncRelojRef = useRef(null); syncRelojRef.current = syncReloj;
  const syncGmailRef = useRef(null); syncGmailRef.current = syncGmail;
  const syncCotizRef = useRef(null); syncCotizRef.current = syncCotiz;

  useEffect(() => {
    const nowCLT = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })); return { hhmm: `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, dow: d.getDay() }; };
    const did = (k, slot) => { const key = `secpla_ran_${k}_${slot.replace(":","_")}`; const v = typeof window!=="undefined" ? localStorage.getItem(key) : null; return v && (Date.now()-new Date(v).getTime())/60000 < 50; };
    const mark = (k, slot) => { if(typeof window!=="undefined") localStorage.setItem(`secpla_ran_${k}_${slot.replace(":","_")}`, new Date().toISOString()); };
    const tick = () => {
      const { hhmm, dow } = nowCLT();
      if (dow < 1 || dow > 5) return;
      [["08:00","13:30","17:30"]].flat().forEach(s => { if (hhmm===s && !did("rel",s)) { mark("rel",s); syncRelojRef.current(true); } });
      [["09:00","15:00"]].flat().forEach(s => { if (hhmm===s && !did("gml",s)) { mark("gml",s); syncGmailRef.current(true); } });
      [["09:30","15:30"]].flat().forEach(s => { if (hhmm===s && !did("ctz",s)) { mark("ctz",s); syncCotizRef.current(true); } });
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  // ── Acciones sobre proyectos ─────────────────────────
  const saveNotes = () => { upProject(p => ({ ...p, notes: notesDraft })); };

  const doGenSummary = async () => {
    if (!proj || !notesDraft.trim()) return;
    setGenSum(true);
    upProject(p => ({ ...p, notes: notesDraft }));
    const { ok, data } = await apiFetch({ type: "summary", project: { name: proj.name, financier: proj.financier, program: proj.program, budget: fCLP(proj.budget), stage: proj.stage, status: proj.status }, notes: notesDraft }, "summary");
    if (ok) upProject(p => ({ ...p, notes: notesDraft, aiSummary: data.text || "" }));
    setGenSum(false);
  };

  const doFetchLicit = async p => {
    if (!p?.licitId?.trim()) return;
    setFetchLicit(p.id);
    const { ok, data } = await apiFetch({ type: "licit", licitId: p.licitId }, "licit");
    if (ok) setProjects(prev => prev.map(x => x.id === p.id ? { ...x, licitData: parseJSON(data.text, { estado: "Desconocido" }), licitChecked: new Date().toISOString().slice(0, 10) } : x));
    setFetchLicit(null);
  };

  const uploadDoc = async e => {
    const file = e.target.files[0];
    if (!file || !proj) return;
    setExtracting(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const b64 = ev.target.result.split(",")[1];
      const isImg = file.type.startsWith("image/");
      const { ok, data } = await apiFetch({ type: "doc", b64, mediaType: isImg ? file.type : "application/pdf", isImg }, "doc");
      const ex = ok ? parseJSON(data.text, { summary: "—" }) : { summary: "Error al procesar." };
      upProject(p => ({ ...p, docs: [...p.docs, { id: uid(), name: file.name, docType: ex.docType || "Documento", uploadedAt: new Date().toISOString().slice(0, 10), summary: ex.summary || "—", extracted: JSON.stringify(ex) }] }));
      setExtracting(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const addTask = () => { if (!newTask.trim() || !proj) return; upProject(p => ({ ...p, tasks: [...p.tasks, { id: uid(), text: newTask.trim(), status: "pending", createdAt: new Date().toISOString().slice(0, 10) }] })); setNewTask(""); };
  const toggleTask = id => upProject(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, status: t.status === "pending" ? "done" : "pending" } : t) }));
  const delTask = id => upProject(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) }));
  const addEmail = () => { if (!emailForm.subject || !proj) return; upProject(p => ({ ...p, emails: [...p.emails, { ...emailForm, id: uid() }] })); setEmailForm({ from: "", subject: "", date: "", body: "" }); setAddingEmail(false); };
  const delEmail = id => upProject(p => ({ ...p, emails: p.emails.filter(e => e.id !== id) }));
  const delDoc = id => upProject(p => ({ ...p, docs: p.docs.filter(d => d.id !== id) }));
  const commitRename = () => { if (renameVal.trim()) setProjects(prev => prev.map(p => p.id === renamingId ? { ...p, name: renameVal.trim() } : p)); setRenamingId(null); };
  const toggleBoss = id => setBoss(prev => prev.map(b => b.id === id ? { ...b, status: b.status === "pendiente" ? "completado" : "pendiente", completedAt: new Date().toISOString().slice(0, 10) } : b));

  // ── Chat ─────────────────────────────────────────────
  const buildCtx = () => projects.map(p => {
    const pf = follows.filter(f => f.projectId === p.id && f.status === "activo");
    return `${p.name} | ${p.stage} | ${p.status} | ${fCLP(p.budget)} | ${p.financier}\nResumen: ${p.aiSummary || p.desc?.slice(0, 100) || "—"}${pf.length ? `\nSeguimientos: ${pf.map(f => f.subject).join("; ")}` : ""}`;
  }).join("\n\n");

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const um = { role: "user", content: chatInput.trim() };
    const nm = [...msgs, um];
    setMsgs(nm); setChatInput(""); setChatLoading(true);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
    const cotizCtx = cotiz.length > 0 ? `\nCotizaciones SNSM: ${cotiz.map(c => `${c.empresa}:${c.estado}`).join(", ")}` : "";
    const { ok, data } = await apiFetch({ type: "chat", messages: nm, context: buildCtx() + cotizCtx, follows: follows.filter(f => f.status === "activo").map(f => `[${f.urgency}] ${f.subject} → ${f.to}`).join("\n") }, "chat");
    setMsgs(m => [...m, { role: "assistant", content: ok ? (data.text || "Sin respuesta.") : "Error de conexión." }]);
    setChatLoading(false);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  };

  // ── Estilos base ─────────────────────────────────────
  const btn = (bg, c = "#fff") => ({ padding: "10px 16px", borderRadius: 8, background: bg, color: c, border: "none", cursor: "pointer", fontSize: F(13), fontWeight: 700 });
  const inp = { padding: "11px 13px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: F(13), width: "100%", boxSizing: "border-box", outline: "none", background: "white" };
  const lbl = { fontSize: F(12), fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 };
  const scroll = { overflowY: "auto", WebkitOverflowScrolling: "touch" };
  const pendingFollows = follows.filter(f => f.status === "activo");
  const critFollows = pendingFollows.filter(f => f.urgency === "crítica");

  // ══════════════════════════════════════════════════
  // SIDEBAR (desktop)
  // ══════════════════════════════════════════════════
  const sidebar = !mob && (
    <div style={{ width: 260, background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ padding: "12px 8px" }}>
        <button onClick={() => { setView("dash"); setSel(null); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 7, background: view === "dash" && !sel ? "#1e3a5f" : "transparent", color: view === "dash" && !sel ? "#93c5fd" : "#64748b", border: "none", cursor: "pointer", textAlign: "left", fontSize: F(12), fontWeight: 600 }}>📊 Dashboard</button>
        <button onClick={() => setView("chat")} style={{ width: "100%", padding: "10px 14px", borderRadius: 7, background: view === "chat" ? "#1e3a5f" : "transparent", color: view === "chat" ? "#93c5fd" : "#64748b", border: "none", cursor: "pointer", textAlign: "left", fontSize: F(12), fontWeight: 600 }}>🤖 Asistente IA</button>
      </div>
      {pendingFollows.length > 0 && (
        <div style={{ margin: "0 10px 8px", padding: "9px 12px", background: "#7f1d1d22", borderRadius: 7, border: "1px solid #ef444433" }}>
          <div style={{ fontSize: F(10), color: "#fca5a5", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>📬 Seguimientos</div>
          {critFollows.length > 0 && <div style={{ fontSize: F(11), color: "#ef4444", fontWeight: 700 }}>🔴 {critFollows.length} crítico(s)</div>}
          <div style={{ fontSize: F(10), color: "#94a3b8" }}>{pendingFollows.length} activos</div>
        </div>
      )}
      <div style={{ padding: "0 8px", flex: 1 }}>
        <div style={{ fontSize: F(10), color: "#334155", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "8px 12px 5px" }}>Proyectos</div>
        {projects.map(p => (
          <button key={p.id} onClick={() => { setSel(p.id); setProjTab("overview"); setView("project"); }} style={{ width: "100%", padding: "10px 12px", borderRadius: 7, background: sel === p.id ? "#1e3a5f" : "transparent", border: sel === p.id ? "1px solid #1d4ed8" : "1px solid transparent", cursor: "pointer", textAlign: "left", marginBottom: 3 }}>
            <div style={{ fontSize: F(11), fontWeight: sel === p.id ? 700 : 500, color: sel === p.id ? "#e2e8f0" : "#94a3b8", lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
            <div style={{ display: "flex", gap: 5 }}>
              <span style={{ fontSize: F(9), padding: "2px 7px", borderRadius: 8, background: SC[p.status] + "25", color: SC[p.status], fontWeight: 700 }}>{p.status}</span>
              <span style={{ fontSize: F(9), padding: "2px 6px", borderRadius: 8, background: "#1e293b", color: "#64748b" }}>{p.financier}</span>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: "10px 8px" }}>
        <button onClick={() => { setForm({ name: "", budget: "", stage: "Formulación", status: "Pendiente", deadline: "", financier: "GORE", program: "", desc: "", notes: "", licitId: "" }); setEditId(null); setShowForm(true); }} style={{ ...btn("#1d4ed8"), width: "100%", fontSize: F(12) }}>+ Nuevo Proyecto</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════
  const header = (
    <div style={{ background: "#0f172a", color: "white", padding: mob ? "13px 16px" : "13px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {mob && (view === "project" || view === "chat") && (
          <button onClick={() => { setView("dash"); setSel(null); }} style={{ background: "none", border: "none", color: "white", fontSize: F(20), cursor: "pointer" }}>←</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === "project" && proj ? (
            renamingId === proj.id ? (
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }} style={{ fontSize: F(14), fontWeight: 800, background: "transparent", border: "none", borderBottom: "2px solid #3b82f6", color: "white", outline: "none", width: "100%" }} />
            ) : (
              <div onClick={() => { setRenamingId(proj.id); setRenameVal(proj.name); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: F(14), fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</div>
                <span style={{ fontSize: F(11), color: "#475569" }}>✏️</span>
              </div>
            )
          ) : (
            <div>
              <div style={{ fontSize: F(15), fontWeight: 800 }}>SECPLA Command</div>
              {critFollows.length > 0 && <div style={{ fontSize: F(10), color: "#fca5a5", marginTop: 1 }}>🔴 {critFollows.length} alerta(s) crítica(s)</div>}
            </div>
          )}
          {view === "project" && proj && <div style={{ fontSize: F(10), color: "#64748b", marginTop: 1 }}>{proj.financier} · {proj.stage} · {fCLP(proj.budget)}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {view === "project" && proj && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={uploadDoc} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={extracting} style={{ ...btn(extracting ? "#334155" : "#1e3a5f", "#93c5fd"), fontSize: F(12), padding: "7px 12px" }}>
              {extracting ? "⏳" : "📎"}{mob ? "" : " Doc"}
            </button>
          </>
        )}
        {mob && (
          <button onClick={() => setView(v => v === "chat" ? "dash" : "chat")} style={{ ...btn(view === "chat" ? "#1d4ed8" : "#1e293b"), fontSize: F(12), padding: "7px 12px" }}>
            🤖
          </button>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════
  const totalBudget = projects.reduce((a, p) => a + (p.budget || 0), 0);

  const dashView = (
    <div style={{ flex: 1, ...scroll, padding: mob ? "16px 16px 90px" : "22px" }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { l: "Inversión Total", v: fCLP(totalBudget), sub: "CLP", i: "💰", c: "#1d4ed8", bg: "#eff6ff" },
          { l: "En Ejecución", v: projects.filter(p => p.status === "En curso" || p.status === "Con alerta").length, sub: `de ${projects.length}`, i: "🟢", c: "#059669", bg: "#f0fdf4" },
          { l: "Seguimientos", v: pendingFollows.length, sub: `${critFollows.length} críticos`, i: "📬", c: "#dc2626", bg: "#fef2f2" },
          { l: "Cotizaciones", v: `${(cotiz.length > 0 ? cotiz : []).filter(c => c.estado === "cotizacion_recibida").length}/${6}`, sub: "SNSM 2025", i: "📋", c: "#7c3aed", bg: "#f5f3ff" },
        ].map(({ l, v, sub, i, c, bg }) => (
          <div key={l} style={{ background: bg, borderRadius: 10, padding: 14, border: `1px solid ${c}22` }}>
            <div style={{ fontSize: F(9), color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>{l}</div>
            <div style={{ fontSize: mob ? F(17) : F(21), fontWeight: 800, color: c }}>{i} {v}</div>
            <div style={{ fontSize: F(10), color: "#94a3b8", marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de sync */}
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid #e2e8f0", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: F(11), fontWeight: 700, color: "#334155" }}>Sincronización</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "gmail", label: "Bandeja", emoji: "📥", fn: () => syncGmail(false), loading: loadingGmail, count: bandeja.length },
            { id: "cotiz", label: "Cotizaciones", emoji: "📋", fn: () => syncCotiz(false), loading: loadingCotiz, count: cotiz.filter(c => c.estado === "cotizacion_recibida").length || null },
            { id: "reloj", label: "Reloj", emoji: "🕐", fn: () => syncReloj(false), loading: loadingReloj },
          ].map(({ id, label, emoji, fn, loading, count }) => {
            const st = syncSt[id] || "idle";
            const stColor = { idle: "#1e293b", loading: "#94a3b8", ok: "#059669", warn: "#d97706", error: "#dc2626" }[st];
            const stIcon = { ok: "✓", warn: "⚠", error: "✕" }[st] || "";
            return (
              <div key={id} style={{ position: "relative" }}>
                <button onClick={fn} disabled={loading} style={{ ...btn(loading ? "#94a3b8" : stColor), fontSize: F(11), padding: "7px 11px", display: "flex", alignItems: "center", gap: 4, opacity: loading ? 0.7 : 1 }}>
                  <span>{loading ? "⏳" : emoji}</span>
                  <span>{label}</span>
                  {count != null && count > 0 && <span style={{ background: "rgba(255,255,255,0.3)", borderRadius: 9, padding: "1px 5px", fontSize: F(9) }}>{count}</span>}
                  {!loading && stIcon && <span style={{ fontSize: F(10) }}>{stIcon}</span>}
                </button>
                {st !== "idle" && syncMsg[id] && (
                  <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", background: st === "error" ? "#991b1b" : st === "warn" ? "#78350f" : "#0f172a", color: "white", fontSize: F(9), padding: "4px 8px", borderRadius: 5, whiteSpace: "nowrap", zIndex: 50, marginTop: 3, maxWidth: 240 }}>
                    {syncMsg[id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bandeja de correos */}
      <BandejaPanel bandeja={bandeja} follows={follows} onFollow={bandejaFollow} onDiscard={bandejaDiscard} onRefresh={() => syncGmail(false)} syncing={loadingGmail} syncMsg={syncMsg.gmail} F={F} btn={btn} />

      {/* Seguimientos activos */}
      <FollowsPanel follows={follows} projects={projects} onResolve={resolveFollow} onAdd={addFollow} F={F} btn={btn} UC={UC} UL={UL} fDate={fDate} />

      {/* Cotizaciones SNSM 2025 */}
      <CotizPanel cotiz={cotiz} syncing={loadingCotiz} syncMsg={syncMsg.cotiz !== "idle" ? syncMsg.cotiz : ""} onRefresh={() => syncCotiz(false)} F={F} btn={btn} fDate={fDate} />

      {/* SIEVAP countdown */}
      {(() => {
        const now = new Date();
        const elapsed = Math.min(SIEVAP_TOTAL, Math.max(0, Math.round((now - SIEVAP_START) / 86400000)));
        const remaining = Math.max(0, Math.round((SIEVAP_DEADLINE - now) / 86400000));
        const overdue = now > SIEVAP_DEADLINE;
        const pct = Math.min(100, Math.round((elapsed / SIEVAP_TOTAL) * 100));
        const bc = overdue ? "#ef4444" : remaining <= 3 ? "#f97316" : remaining <= 7 ? "#f59e0b" : "#3b82f6";
        return (
          <div style={{ background: overdue ? "#fef2f2" : remaining <= 3 ? "#fff7ed" : "#eff6ff", borderRadius: 12, padding: 16, border: `2px solid ${bc}`, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: F(12), fontWeight: 800, color: bc, textTransform: "uppercase", marginBottom: 3 }}>⏳ {overdue ? "VENCIDO" : remaining <= 3 ? "CRÍTICO" : "Plazo SIEVAP"}</div>
                <div style={{ fontSize: F(11), color: "#475569" }}>Subsanación <strong>SNSM25-STP-0113</strong> · 3ra instancia</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: F(overdue ? 14 : 22), fontWeight: 900, color: bc }}>{overdue ? `${Math.abs(remaining)}d vencido` : remaining}</div>
                {!overdue && <div style={{ fontSize: F(10), color: "#64748b" }}>días corridos</div>}
              </div>
            </div>
            <div style={{ background: "#e2e8f0", borderRadius: 20, height: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: bc, transition: "width 0.5s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: F(10), color: "#64748b" }}>
              <span>Inicio: {fDate("2026-04-09")}</span>
              <span style={{ fontWeight: 700, color: bc }}>{elapsed}/{SIEVAP_TOTAL}d</span>
              <span>Límite: {fDate("2026-04-24")}</span>
            </div>
            <a href="https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: F(11), color: "#1d4ed8", fontWeight: 700 }}>✉️ Ver correo →</a>
          </div>
        );
      })()}

      {/* Solicitudes Jefatura */}
      {(() => {
        const pending = boss.filter(b => b.status === "pendiente");
        const done = boss.filter(b => b.status === "completado");
        const fromC = { "María Paz Juica": "#7c3aed", "Grace Arcos": "#0284c7" };
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: F(12), fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>👩‍💼 Solicitudes de Jefatura · {pending.length} pendientes</div>
            {pending.map(b => {
              const fp = projects.find(p => p.id === b.projectId);
              return (
                <div key={b.id} style={{ background: "white", borderRadius: 10, padding: 14, border: `1.5px solid ${fromC[b.from] || "#7c3aed"}33`, marginBottom: 10, borderLeft: `5px solid ${fromC[b.from] || "#7c3aed"}` }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: F(11), fontWeight: 800, padding: "2px 9px", borderRadius: 20, background: (fromC[b.from] || "#7c3aed") + "18", color: fromC[b.from] || "#7c3aed" }}>👩‍💼 {b.from}</span>
                    <span style={{ fontSize: F(10), padding: "2px 7px", borderRadius: 8, background: UC[b.urgency] + "15", color: UC[b.urgency], fontWeight: 700 }}>{UL[b.urgency]} {b.urgency}</span>
                    {fp && <span style={{ fontSize: F(10), padding: "2px 7px", borderRadius: 6, background: "#f1f5f9", color: "#475569" }}>{fp.name.slice(0, 30)}…</span>}
                    <span style={{ fontSize: F(10), color: "#94a3b8", marginLeft: "auto" }}>{fDate(b.requestDate)}</span>
                  </div>
                  <div style={{ fontSize: F(13), color: "#0f172a", lineHeight: 1.5, marginBottom: 8 }}>{b.task}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <a href={b.threadUrl} target="_blank" rel="noreferrer" style={{ fontSize: F(11), padding: "5px 12px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}>✉️ Correo</a>
                    <button onClick={() => toggleBoss(b.id)} style={{ ...btn("#dcfce7", "#166534"), fontSize: F(11), padding: "5px 12px" }}>✅ Completado</button>
                  </div>
                </div>
              );
            })}
            {done.length > 0 && (
              <details><summary style={{ fontSize: F(11), color: "#94a3b8", cursor: "pointer", padding: "4px 0" }}>Ver {done.length} completadas</summary>
                {done.map(b => (
                  <div key={b.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 6, opacity: 0.75, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: F(11), color: "#059669", fontWeight: 700 }}>✅ {b.from}</div>
                      <div style={{ fontSize: F(11), color: "#64748b", textDecoration: "line-through" }}>{b.task}</div>
                    </div>
                    <button onClick={() => toggleBoss(b.id)} style={{ fontSize: F(10), padding: "3px 8px", borderRadius: 5, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b" }}>↩</button>
                  </div>
                ))}
              </details>
            )}
          </div>
        );
      })()}

      {/* Cartera */}
      <div style={{ fontSize: F(11), fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Cartera de Proyectos</div>
      {projects.map(p => (
        <div key={p.id} onClick={() => { setSel(p.id); setProjTab("overview"); setView("project"); }} style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", marginBottom: 10, borderLeft: `4px solid ${SC[p.status]}`, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: F(14), color: "#0f172a", marginBottom: 5 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: F(10), padding: "2px 9px", borderRadius: 8, background: SC[p.status] + "18", color: SC[p.status], fontWeight: 700 }}>{p.status}</span>
                <span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 8, background: "#f1f5f9", color: "#475569" }}>{p.stage}</span>
                <span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 8, background: "#e0f2fe", color: "#0369a1" }}>{p.financier}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: F(15), fontWeight: 800, color: "#1d4ed8" }}>{fCLP(p.budget)}</div>
            </div>
          </div>
          {p.aiSummary && <div style={{ fontSize: F(11), color: "#475569", lineHeight: 1.4, fontStyle: "italic", borderLeft: "2px solid #bfdbfe", paddingLeft: 8, marginBottom: 6 }}>{p.aiSummary.slice(0, 100)}…</div>}
          <div style={{ display: "flex", gap: 12, fontSize: F(10), color: "#94a3b8", borderTop: "1px solid #f8fafc", paddingTop: 6 }}>
            <span>📄 {p.docs.length}</span>
            <span>✉️ {p.emails.length}</span>
            <span>✅ {p.tasks.filter(t => t.status === "pending").length} pend.</span>
            {follows.filter(f => f.projectId === p.id && f.status === "activo").length > 0 && <span style={{ color: "#dc2626" }}>📬 {follows.filter(f => f.projectId === p.id && f.status === "activo").length}</span>}
          </div>
        </div>
      ))}

      {/* Reloj Control */}
      {(() => {
        const today = new Date(); const todayStr = today.toISOString().slice(0, 10); const nowMin = today.getHours() * 60 + today.getMinutes();
        const months = [...new Set(clockData.map(r => r.date.slice(0, 7)))].sort();
        const monthData = clockData.filter(r => r.date.startsWith(clockMonth));
        const days = monthData.map(r => {
          const j = jornMin(r.date); const eM = toMin(r.entrada); const sM = toMin(r.salida); const isT = r.date === todayStr;
          if (eM === null && sM === null) return { ...r, j, extra: null };
          if (sM === null && !isT) return { ...r, j, extra: null };
          if (sM === null && isT) return { ...r, j, extra: null, live: Math.max(0, nowMin - (eM + j)), expSalida: eM + j };
          if (eM === null) return { ...r, j, extra: null };
          return { ...r, j, extra: (sM - eM) - j };
        });
        const completed = days.filter(d => d.extra !== null);
        const totalExtra = completed.reduce((a, d) => a + (d.extra || 0), 0);
        const yearExtra = clockData.map(r => { const j = jornMin(r.date); const eM = toMin(r.entrada); const sM = toMin(r.salida); if (!eM || !sM) return null; return (sM - eM) - j; }).filter(x => x !== null).reduce((a, v) => a + v, 0);
        const nc = totalExtra >= 0 ? "#059669" : "#ef4444";
        const yc = yearExtra >= 0 ? "#059669" : "#ef4444";
        const [, mo] = clockMonth.split("-").map(Number);
        const todayRec = days.find(d => d.date === todayStr);
        return (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontSize: F(12), fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: 1 }}>🕐 Reloj Control 2026</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {months.map(m => { const [, mm] = m.split("-").map(Number); return <button key={m} onClick={() => setClockMonth(m)} style={{ ...btn(m === clockMonth ? "#0284c7" : "#f1f5f9", m === clockMonth ? "white" : "#374151"), fontSize: F(10), padding: "4px 9px" }}>{MONTHS_FULL[mm]}</button>; })}
                <button onClick={() => setClockOpen(o => !o)} style={{ ...btn("#e0f2fe", "#0369a1"), fontSize: F(10), padding: "4px 9px" }}>{clockOpen ? "▲ Ocultar" : "▼ Ver"}</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
              {[
                { l: `Extra ${MONTHS_FULL[mo]}`, v: (totalExtra >= 0 ? "+" : "") + fMin(totalExtra), c: nc, bg: totalExtra >= 0 ? "#f0fdf4" : "#fef2f2" },
                { l: "Días registrados", v: `${completed.length}d`, c: "#0284c7", bg: "#eff6ff" },
                { l: "Acum. 2026", v: (yearExtra >= 0 ? "+" : "") + fMin(yearExtra), c: yc, bg: yearExtra >= 0 ? "#f0fdf4" : "#fef2f2" },
                { l: "Hoy", v: todayRec ? `${todayRec.entrada || "—"} → ${todayRec.salida || "en curso"}` : "Sin registro", c: "#7c3aed", bg: "#f5f3ff" },
              ].map(({ l, v, c, bg }) => (
                <div key={l} style={{ background: bg, borderRadius: 8, padding: 12, border: `1px solid ${c}22` }}>
                  <div style={{ fontSize: F(9), color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: F(15), fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            {todayRec?.live != null && todayRec.live > 0 && (
              <div style={{ padding: "10px 14px", background: "#eff6ff", border: "2px solid #0284c7", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: F(12), fontWeight: 700, color: "#0284c7" }}>🟢 En jornada · Entrada {todayRec.entrada}</div>
                <div style={{ fontSize: F(11), color: "#475569" }}>Salida normal: <strong>{String(Math.floor(todayRec.expSalida / 60)).padStart(2, "0")}:{String(todayRec.expSalida % 60).padStart(2, "0")}</strong> · <span style={{ color: "#7c3aed", fontWeight: 700 }}>+{fMin(todayRec.live)} ahora</span></div>
              </div>
            )}
            {clockOpen && (
              <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 4 }}>
                  {["Fecha", "Jorn.", "Entrada", "Salida", "Extra"].map(h => <div key={h} style={{ fontSize: F(9), fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</div>)}
                </div>
                {[...days].reverse().map(d => {
                  const isT = d.date === todayStr;
                  const ec = d.extra > 0 ? "#059669" : d.extra < 0 ? "#ef4444" : "#64748b";
                  return (
                    <div key={d.date} style={{ padding: "8px 14px", borderBottom: "1px solid #f8fafc", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 4, background: isT ? "#eff6ff" : "white" }}>
                      <div style={{ fontSize: F(11), fontWeight: isT ? 700 : 400, color: isT ? "#0284c7" : "#0f172a" }}>{fDate(d.date)}{isT && <span style={{ marginLeft: 4, fontSize: F(8), color: "#0284c7" }}>HOY</span>}{isFri(d.date) && <span style={{ marginLeft: 3, fontSize: F(8), color: "#d97706" }}>VIE</span>}</div>
                      <div style={{ fontSize: F(10), color: "#94a3b8" }}>{d.j === 480 ? "8h" : "9h"}</div>
                      <div style={{ fontSize: F(11) }}>{d.entrada || "—"}</div>
                      <div style={{ fontSize: F(11), color: d.salida ? "#0f172a" : "#f59e0b" }}>{d.salida || (isT ? "⏳" : "—")}</div>
                      <div style={{ fontSize: F(12), fontWeight: 700, color: d.extra != null ? ec : "#94a3b8" }}>{d.extra != null ? (d.extra > 0 ? `+${fMin(d.extra)}` : d.extra < 0 ? `-${fMin(Math.abs(d.extra))}` : "=") : "—"}</div>
                    </div>
                  );
                })}
                <div style={{ padding: "8px 14px", background: "#f1f5f9", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 4 }}>
                  <div style={{ fontSize: F(11), fontWeight: 700, gridColumn: "1/5" }}>TOTAL {MONTHS_FULL[mo].toUpperCase()}</div>
                  <div style={{ fontSize: F(13), fontWeight: 900, color: nc }}>{totalExtra >= 0 ? "+" : ""}{fMin(totalExtra)}</div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Botón nuevo proyecto */}
      <button onClick={() => { setForm({ name: "", budget: "", stage: "Formulación", status: "Pendiente", deadline: "", financier: "GORE", program: "", desc: "", notes: "", licitId: "" }); setEditId(null); setShowForm(true); }} style={{ ...btn("#0f172a"), width: "100%", marginTop: 16, padding: 13, fontSize: F(12) }}>+ Nuevo Proyecto</button>
    </div>
  );

  // ══════════════════════════════════════════════════
  // VISTA PROYECTO
  // ══════════════════════════════════════════════════
  const projTabs = [["overview", "📋 Resumen"], ["licit", "🏛️ Licitación"], ["notes", "📝 Notas"], ["docs", "📄 Docs"], ["tasks", "✅ Tareas"], ["emails", "✉️ Correos"]];

  const projView = proj && (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "white", borderBottom: "1px solid #e2e8f0", overflowX: "auto", flexShrink: 0 }}>
        {projTabs.map(([k, l]) => {
          const badge = k === "docs" ? proj.docs.length : k === "tasks" ? proj.tasks.filter(t => t.status === "pending").length : k === "emails" ? proj.emails.length : null;
          return (
            <button key={k} onClick={() => setProjTab(k)} style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: projTab === k ? "#1d4ed8" : "#f1f5f9", color: projTab === k ? "white" : "#64748b", cursor: "pointer", fontSize: F(11), fontWeight: projTab === k ? 700 : 500, whiteSpace: "nowrap" }}>
              {l}{badge !== null && badge > 0 && <span style={{ marginLeft: 4, fontSize: F(9), background: projTab === k ? "#3b82f6" : "#e2e8f0", color: projTab === k ? "white" : "#64748b", borderRadius: 8, padding: "1px 5px" }}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, ...scroll, padding: mob ? "14px 14px 90px" : "20px" }}>
        {/* OVERVIEW */}
        {projTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "white", borderRadius: 10, padding: 16, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: F(10), fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Ficha del Proyecto</div>
              {[["Estado", <span key="s" style={{ padding: "3px 10px", borderRadius: 8, background: SC[proj.status] + "18", color: SC[proj.status], fontWeight: 700, fontSize: F(11) }}>{proj.status}</span>], ["Etapa", proj.stage], ["Presupuesto", `${fCLP(proj.budget)} CLP`], ["Financiamiento", `${proj.financier} / ${proj.program || "—"}`], ["Vencimiento", fDate(proj.deadline)]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f8fafc", gap: 8 }}>
                  <span style={{ fontSize: F(12), color: "#64748b" }}>{k}</span>
                  <span style={{ fontSize: F(12), fontWeight: 700, color: "#0f172a", textAlign: "right" }}>{v}</span>
                </div>
              ))}
              {proj.codigoProyecto && (
                <div style={{ marginTop: 10, padding: "6px 10px", background: "#f8fafc", borderRadius: 6, fontSize: F(11), color: "#334155" }}>
                  🔑 <strong style={{ fontFamily: "monospace" }}>{proj.codigoProyecto}</strong>
                  {proj.codigoSIGE && <span style={{ color: "#94a3b8", marginLeft: 8 }}>SIGE: {proj.codigoSIGE}</span>}
                </div>
              )}
              <button onClick={() => { setForm({ ...proj, budget: proj.budget || "" }); setEditId(proj.id); setShowForm(true); }} style={{ ...btn("#f1f5f9", "#374151"), width: "100%", marginTop: 12, fontSize: F(12) }}>✏️ Editar Proyecto</button>
            </div>
            {proj.aiSummary && <div style={{ background: "#eff6ff", borderRadius: 10, padding: 14, border: "1px solid #bfdbfe" }}><div style={{ fontSize: F(10), fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", marginBottom: 8 }}>✨ Resumen IA</div><p style={{ fontSize: F(12), color: "#1e3a5f", lineHeight: 1.7, margin: 0 }}>{proj.aiSummary}</p></div>}
            {proj.licitId && (() => {
              const ld = proj.licitData;
              return (
                <div style={{ background: "white", borderRadius: 10, padding: 14, border: `1px solid ${ld ? (MPC[ld.estado] || "#e2e8f0") + "55" : "#e2e8f0"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ld ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>🏛️</span><div><div style={{ fontSize: F(12), fontWeight: 700 }}>MP · {proj.licitId}</div>{ld && <div style={{ fontSize: F(10), color: "#64748b" }}>{ld.nombre}</div>}</div></div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {ld && <span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 8, background: (MPC[ld.estado] || "#94a3b8") + "18", color: MPC[ld.estado] || "#64748b", fontWeight: 700 }}>{ld.estado}</span>}
                      <button onClick={() => doFetchLicit(proj)} disabled={fetchLicit === proj.id} style={{ ...btn(fetchLicit === proj.id ? "#94a3b8" : "#0f172a"), fontSize: F(10), padding: "5px 10px" }}>{fetchLicit === proj.id ? "⏳" : "🔄"}</button>
                    </div>
                  </div>
                  {ld && ld.estado !== "Desconocido" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 6 }}>
                        {[["Cierre", fDate(ld.fechaCierre)], ["Adjudicación", fDate(ld.fechaAdjudicacion)], ["Monto", ld.monto || "—"]].map(([l, v]) => (
                          <div key={l} style={{ background: "#f8fafc", borderRadius: 6, padding: "7px 9px" }}><div style={{ fontSize: F(9), color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>{l}</div><div style={{ fontSize: F(11), fontWeight: 700 }}>{v}</div></div>
                        ))}
                      </div>
                      {ld.url && <a href={ld.url} target="_blank" rel="noreferrer" style={{ fontSize: F(11), color: "#1d4ed8" }}>Ver en MP →</a>}
                    </div>
                  )}
                </div>
              );
            })()}
            {proj.convenio && (
              <div style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: F(10), fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>📋 Convenio & Plazos</div>
                {[["Vence ejecución", fDate(proj.convenio.plazoEjecucionFin)], ["Vence convenio", fDate(proj.convenio.plazoConvenioFin)]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f8fafc" }}>
                    <span style={{ fontSize: F(12), color: "#64748b" }}>{l}</span>
                    <span style={{ fontSize: F(12), fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
                {proj.convenio.modificaciones?.map((m, i) => (
                  <div key={i} style={{ marginTop: 8, fontSize: F(11), color: "#334155", display: "flex", gap: 8 }}>
                    <span>{m.estado === "aprobada" ? "✅" : "⏳"}</span>
                    <div>{m.tipo} · {m.oficio} · {fDate(m.aprobacion)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: F(10), fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Descripción</div>
              <p style={{ fontSize: F(12), color: "#334155", lineHeight: 1.6, margin: 0 }}>{proj.desc}</p>
            </div>
          </div>
        )}

        {/* LICITACIÓN */}
        {projTab === "licit" && (
          <div>
            <div style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", marginBottom: 12 }}>
              <label style={{ fontSize: F(11), fontWeight: 700, display: "block", marginBottom: 6 }}>ID Licitación Mercado Público</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={proj.licitId || ""} onChange={e => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, licitId: e.target.value } : p))} placeholder="Ej: 1431841-10-B226" style={{ ...inp, flex: 1, fontFamily: "monospace", fontWeight: 700 }} />
                <button onClick={() => doFetchLicit(proj)} disabled={!proj.licitId || fetchLicit === proj.id} style={{ ...btn(!proj.licitId || fetchLicit === proj.id ? "#94a3b8" : "#7c3aed"), padding: "11px 14px" }}>
                  {fetchLicit === proj.id ? "⏳" : "🔍"}
                </button>
              </div>
            </div>
            {proj.licitData && (() => {
              const ld = proj.licitData;
              return (
                <div style={{ background: "white", borderRadius: 10, padding: 14, border: `1px solid ${(MPC[ld.estado] || "#e2e8f0") + "55"}` }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: F(11), padding: "3px 10px", borderRadius: 8, background: (MPC[ld.estado] || "#94a3b8") + "18", color: MPC[ld.estado] || "#64748b", fontWeight: 700 }}>{ld.estado}</span>
                  </div>
                  {ld.descripcion && <p style={{ fontSize: F(12), color: "#334155", lineHeight: 1.5, margin: "0 0 10px", padding: "8px 10px", background: "#f8fafc", borderRadius: 6 }}>{ld.descripcion}</p>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {[["Publicación", fDate(ld.fechaPublicacion)], ["Cierre", fDate(ld.fechaCierre)], ["Adjudicación", fDate(ld.fechaAdjudicacion)]].map(([l, v]) => (
                      <div key={l} style={{ background: "#f1f5f9", borderRadius: 7, padding: "8px 10px" }}><div style={{ fontSize: F(9), color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>{l}</div><div style={{ fontSize: F(12), fontWeight: 700 }}>{v}</div></div>
                    ))}
                  </div>
                  {ld.url && <a href={ld.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, fontSize: F(11), color: "#1d4ed8" }}>Ver en Mercado Público →</a>}
                </div>
              );
            })()}
          </div>
        )}

        {/* NOTAS */}
        {projTab === "notes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: F(11), fontWeight: 700, color: "#64748b", display: "block", marginBottom: 8 }}>Notas de gestión</label>
              <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} onBlur={saveNotes} rows={10} placeholder="Notas sobre gestiones, reuniones, pendientes…" style={{ ...inp, resize: "vertical", fontSize: F(12), lineHeight: 1.6 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={saveNotes} style={{ ...btn("#059669"), fontSize: F(12) }}>💾 Guardar notas</button>
                <button onClick={doGenSummary} disabled={genSum || !notesDraft.trim()} style={{ ...btn(genSum ? "#94a3b8" : "#1d4ed8"), fontSize: F(12), opacity: genSum ? 0.6 : 1 }}>
                  {genSum ? "⏳ Generando…" : "✨ Generar resumen con IA"}
                </button>
              </div>
            </div>
            {proj.aiSummary && <div style={{ background: "#eff6ff", borderRadius: 10, padding: 14, border: "1px solid #bfdbfe" }}><div style={{ fontSize: F(10), fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", marginBottom: 8 }}>✨ Resumen IA</div><p style={{ fontSize: F(12), color: "#1e3a5f", lineHeight: 1.7, margin: 0 }}>{proj.aiSummary}</p></div>}
          </div>
        )}

        {/* DOCS */}
        {projTab === "docs" && (
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={extracting} style={{ ...btn(extracting ? "#94a3b8" : "#0284c7"), width: "100%", marginBottom: 14, padding: 13 }}>
              {extracting ? "⏳ Procesando con IA…" : "📎 Subir Documento (PDF / Imagen)"}
            </button>
            {proj.docs.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: 10 }}><div style={{ fontSize: F(30), marginBottom: 8 }}>📄</div><div style={{ fontSize: F(12) }}>Sin documentos</div></div>}
            {proj.docs.map(d => {
              let ex = {}; try { ex = JSON.parse(d.extracted || "{}"); } catch {}
              return (
                <div key={d.id} style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div><div style={{ fontWeight: 700, fontSize: F(13) }}>📄 {d.name}</div><div style={{ fontSize: F(10), color: "#94a3b8" }}>{d.docType} · {fDate(d.uploadedAt)}</div></div>
                    <button onClick={() => delDoc(d.id)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: F(16) }}>✕</button>
                  </div>
                  {d.summary && <p style={{ fontSize: F(12), color: "#334155", lineHeight: 1.5, background: "#f8fafc", padding: "8px 10px", borderRadius: 6, margin: 0 }}>{d.summary}</p>}
                  {ex.dates?.length > 0 && ex.dates.map((dt, i) => <div key={i} style={{ fontSize: F(11), color: "#334155", padding: "2px 0", marginTop: 4 }}>📅 {typeof dt === "object" ? `${dt.date} — ${dt.description}` : dt}</div>)}
                </div>
              );
            })}
          </div>
        )}

        {/* TASKS */}
        {projTab === "tasks" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Nueva tarea…" style={{ ...inp, flex: 1 }} />
              <button onClick={addTask} style={{ ...btn("#1d4ed8"), padding: "10px 16px", fontSize: F(16) }}>+</button>
            </div>
            {proj.tasks.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: 10, fontSize: F(12) }}>Sin tareas</div>}
            {["pending", "done"].map(st => {
              const ts = proj.tasks.filter(t => t.status === st);
              if (!ts.length) return null;
              return (
                <div key={st} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: F(10), fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>{st === "pending" ? "Pendientes" : "Completadas"}</div>
                  {ts.map(t => (
                    <div key={t.id} style={{ background: "white", borderRadius: 8, padding: "11px 14px", border: "1px solid #e2e8f0", marginBottom: 6, display: "flex", alignItems: "center", gap: 10, opacity: st === "done" ? 0.55 : 1 }}>
                      <input type="checkbox" checked={st === "done"} onChange={() => toggleTask(t.id)} style={{ cursor: "pointer", width: 18, height: 18, accentColor: "#1d4ed8", flexShrink: 0 }} />
                      <span style={{ fontSize: F(13), flex: 1, textDecoration: st === "done" ? "line-through" : "none", color: st === "done" ? "#94a3b8" : "#1e293b" }}>{t.text}</span>
                      <button onClick={() => delTask(t.id)} style={{ background: "none", border: "none", color: "#e2e8f0", cursor: "pointer", fontSize: F(15) }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* EMAILS */}
        {projTab === "emails" && (
          <div>
            <button onClick={() => setAddingEmail(true)} style={{ ...btn("#1d4ed8"), width: "100%", marginBottom: 14, padding: 13 }}>+ Registrar Correo</button>
            {addingEmail && (
              <div style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #bfdbfe", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><label style={lbl}>Remitente</label><input value={emailForm.from} onChange={e => setEmailForm(f => ({ ...f, from: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>Fecha</label><input type="date" value={emailForm.date} onChange={e => setEmailForm(f => ({ ...f, date: e.target.value }))} style={inp} /></div>
                </div>
                <div style={{ marginBottom: 10 }}><label style={lbl}>Asunto</label><input value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} style={inp} /></div>
                <div style={{ marginBottom: 12 }}><label style={lbl}>Contenido</label><textarea value={emailForm.body} onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addEmail} style={btn("#1d4ed8")}>Guardar</button>
                  <button onClick={() => setAddingEmail(false)} style={btn("#f1f5f9", "#374151")}>Cancelar</button>
                </div>
              </div>
            )}
            {proj.emails.length === 0 && !addingEmail && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", border: "2px dashed #e2e8f0", borderRadius: 10, fontSize: F(12) }}>Sin correos registrados</div>}
            {proj.emails.map(e => (
              <div key={e.id} style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div><div style={{ fontWeight: 700, fontSize: F(13) }}>✉️ {e.subject}</div><div style={{ fontSize: F(10), color: "#94a3b8", marginTop: 2 }}>De: {e.from} · {fDate(e.date)}</div></div>
                  <button onClick={() => delEmail(e.id)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: F(16) }}>✕</button>
                </div>
                {e.body && <p style={{ fontSize: F(12), color: "#334155", marginTop: 10, lineHeight: 1.5, borderTop: "1px solid #f8fafc", paddingTop: 10 }}>{e.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════════
  const chatView = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {["¿Qué urgencias tengo hoy?", "¿Qué empresas no han cotizado SNSM?", "Resumen cartera p5", "Días extras acumulados"].map(q => (
            <button key={q} onClick={() => setChatInput(q)} style={{ fontSize: F(10), padding: "4px 9px", borderRadius: 10, background: "white", border: "1px solid #e2e8f0", cursor: "pointer", color: "#475569" }}>{q}</button>
          ))}
        </div>
      </div>
      <div ref={chatRef} style={{ flex: 1, ...scroll, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "86%", padding: "10px 13px", borderRadius: 10, background: m.role === "user" ? "#1d4ed8" : "#f1f5f9", color: m.role === "user" ? "white" : "#1e293b", fontSize: F(12), lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {chatLoading && <div style={{ display: "flex" }}><div style={{ padding: "10px 13px", borderRadius: 10, background: "#f1f5f9", fontSize: F(11), color: "#94a3b8" }}>Pensando…</div></div>}
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, flexShrink: 0, paddingBottom: mob ? "calc(10px + env(safe-area-inset-bottom))" : "10px" }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()} placeholder="Pregunta sobre tus proyectos…" style={{ ...inp, flex: 1 }} />
        <button onClick={sendChat} disabled={chatLoading} style={{ ...btn("#1d4ed8"), padding: "10px 14px", fontSize: F(15), opacity: chatLoading ? 0.5 : 1 }}>→</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════
  // MODAL — CRUD PROYECTO
  // ══════════════════════════════════════════════════
  const modal = showForm && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "white", borderRadius: mob ? "16px 16px 0 0" : "12px", padding: 20, width: mob ? "100%" : "500px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 700, fontSize: F(15), color: "#0f172a", marginBottom: 16 }}>{editId ? "Editar Proyecto" : "Nuevo Proyecto"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Presupuesto (CLP)</label><input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} style={inp} placeholder="Ej: 100000000" /></div>
          {form.budget && Number(form.budget) > 0 && <div style={{ fontSize: F(12), color: "#1d4ed8", fontWeight: 700, padding: "4px 10px", background: "#eff6ff", borderRadius: 6 }}>→ {fCLP(Number(form.budget))} CLP</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={lbl}>Financiamiento</label><select value={form.financier} onChange={e => setForm(f => ({ ...f, financier: e.target.value }))} style={inp}>{FINANCIERS.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label style={lbl}>Vencimiento</label><input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inp} /></div>
          </div>
          <div><label style={lbl}>Programa / Fondo</label><input value={form.program || ""} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} style={inp} placeholder="Ej: SNSM 2025" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={lbl}>Etapa</label><select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={inp}>{STAGES.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label style={lbl}>Estado</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>
          </div>
          <div><label style={lbl}>ID Licitación MP (opcional)</label><input value={form.licitId || ""} onChange={e => setForm(f => ({ ...f, licitId: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} placeholder="Ej: 1431841-10-B226" /></div>
          <div><label style={lbl}>Descripción técnica</label><textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ ...btn("#f1f5f9", "#374151"), flex: 1 }}>Cancelar</button>
          {editId && <button onClick={() => { if (window.confirm("¿Eliminar este proyecto?")) { setProjects(prev => prev.filter(p => p.id !== editId)); setShowForm(false); setEditId(null); setSel(null); setView("dash"); } }} style={{ ...btn("#fef2f2", "#dc2626"), flex: 0, fontSize: F(11) }}>🗑️</button>}
          <button onClick={() => {
            if (!form.name?.trim()) return;
            const p = { ...form, id: editId || uid(), budget: parseFloat(form.budget) || 0, docs: form.docs || [], emails: form.emails || [], tasks: form.tasks || [], notes: form.notes || "", aiSummary: form.aiSummary || "", licitData: form.licitData || null, licitChecked: form.licitChecked || "" };
            setProjects(prev => editId ? prev.map(x => x.id === editId ? p : x) : [...prev, p]);
            setSel(p.id); setProjTab("overview"); setView("project"); setShowForm(false); setEditId(null);
          }} style={{ ...btn("#1d4ed8"), flex: 1 }}>Guardar</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════
  // MOBILE NAV
  // ══════════════════════════════════════════════════
  const mobileNav = mob && (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #e2e8f0", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {[["dash", "📊", "Inicio"], ["projects", "📁", "Proyectos"], ["chat", "🤖", "Asistente"]].map(([v, icon, label]) => (
        <button key={v} onClick={() => { if (v === "projects") { setSel(null); setView("dash"); } else setView(v === "projects" ? "dash" : v); }} style={{ flex: 1, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: F(18) }}>{icon}</span>
          <span style={{ fontSize: F(10), fontWeight: view === v ? 700 : 400, color: view === v ? "#1d4ed8" : "#94a3b8" }}>{label}</span>
          {view === v && <div style={{ width: 20, height: 2, background: "#1d4ed8", borderRadius: 2 }} />}
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", overflow: "hidden" }}>
      {header}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {sidebar}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {mob ? (
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {view === "dash" && dashView}
              {view === "project" && proj && projView}
              {view === "chat" && chatView}
              {view === "dash" && !proj && mob && (
                <div style={{ padding: "0 16px 16px" }}>
                  {/* Lista proyectos en mobile */}
                  {projects.map(p => (
                    <div key={p.id + "_mob"} onClick={() => { setSel(p.id); setProjTab("overview"); setView("project"); }} style={{ background: "white", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", marginBottom: 10, borderLeft: `4px solid ${SC[p.status]}`, cursor: "pointer" }}>
                      <div style={{ fontWeight: 700, fontSize: F(13), marginBottom: 4 }}>{p.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: F(10), padding: "2px 8px", borderRadius: 8, background: SC[p.status] + "18", color: SC[p.status], fontWeight: 700 }}>{p.status}</span>
                        <span style={{ fontSize: F(13), fontWeight: 800, color: "#1d4ed8" }}>{fCLP(p.budget)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {(view === "dash" || !view) && <div style={{ flex: 1, overflowY: "auto" }}>{dashView}</div>}
              {view === "project" && proj && projView}
              {view === "chat" && (
                <div style={{ width: 380, borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                  <div style={{ padding: "11px 16px", background: "#0f172a", color: "white", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: F(12) }}>🤖 Asistente SECPLA</div>
                    <div style={{ fontSize: F(10), color: "#64748b", marginTop: 2 }}>Cartera · Seguimientos · Cotizaciones</div>
                  </div>
                  {chatView}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {mobileNav}
      {modal}
    </div>
  );
}
