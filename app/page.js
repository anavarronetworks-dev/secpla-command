"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * SECPLA Command v5.0
 * Diseño: editorial minimalista — fondo crema cálido, tipografía IBM Plex
 * Adaptable móvil / tablet / desktop
 */

// ══════════════════════════════════════════════════════
// PERSISTENCIA ROBUSTA
// ══════════════════════════════════════════════════════
const V = "v5";
function dbGet(k, def) {
  if (typeof window === "undefined") return def;
  for (const pfx of [`sc_${V}_${k}`, `sc_bk_${V}_${k}`]) {
    try { const r = localStorage.getItem(pfx); if (r) { const p = JSON.parse(r); if (p != null) return p; } } catch {}
  }
  return def;
}
function dbSet(k, v) {
  if (typeof window === "undefined") return;
  const key = `sc_${V}_${k}`, bk = `sc_bk_${V}_${k}`;
  try { const prev = localStorage.getItem(key); if (prev) localStorage.setItem(bk, prev); localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

function useDB(k, init) {
  const [v, sv] = useState(() => dbGet(k, typeof init === "function" ? init() : init));
  const set = useCallback(x => sv(prev => { const next = typeof x === "function" ? x(prev) : x; dbSet(k, next); return next; }), [k]);
  useEffect(() => {
    const h = e => { if (e.key === `sc_${V}_${k}` && e.newValue) try { sv(JSON.parse(e.newValue)); } catch {} };
    window.addEventListener("storage", h); return () => window.removeEventListener("storage", h);
  }, [k]);
  return [v, set];
}

// ══════════════════════════════════════════════════════
// API HELPER
// ══════════════════════════════════════════════════════
async function api(body) {
  try {
    const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, data: d };
  } catch (e) { return { ok: false, data: { error: true, errorMessage: e.message } }; }
}
function pj(s, d) { try { return JSON.parse((s || "").replace(/```json|```/g, "").trim()); } catch { return d; } }

// ══════════════════════════════════════════════════════
// DESIGN TOKENS & HELPERS
// ══════════════════════════════════════════════════════
const C = {
  bg:     "#F7F5F0",
  card:   "#FFFFFF",
  border: "#E8E4DC",
  text:   "#1A1714",
  sub:    "#6B6560",
  dim:    "#A09890",
  blue:   "#1B4FD8",
  green:  "#0D7A55",
  amber:  "#B45309",
  red:    "#C0392B",
  ink:    "#0F172A",
};

const uid = () => Math.random().toString(36).slice(2, 8);
const fCLP = n => !n ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`;
const fDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const toMin = t => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fMin = m => { const a = Math.abs(m), h = Math.floor(a / 60), mn = a % 60; return h > 0 ? `${h}h ${mn}m` : `${mn}m`; };
const daysAgo = d => { try { return Math.round((Date.now() - new Date(d).getTime()) / 86400000); } catch { return 0; } };
const isFri = d => new Date(d + "T12:00:00").getDay() === 5;
const jorn = d => isFri(d) ? 480 : 540;
const isoToday = () => new Date().toISOString().slice(0, 10);

// ══════════════════════════════════════════════════════
// DATOS SEMILLA
// ══════════════════════════════════════════════════════
const INIT_P = [
  { id:"p1", name:"Habilitación Tecnológica 6ta Comisaría", budget:40000000, stage:"Formulación", status:"En curso", deadline:"", financier:"SPD", program:"FNSP", desc:"Habilitación sala de televigilancia Sexta Comisaría. Código 1431841-10-LE25. Pendiente ITS y empalme ENEL.", notes:"", aiSummary:"", licitId:"", licitData:null, licitChecked:"", docs:[], emails:[], tasks:[], codigoProyecto:"1431841-10-LE25" },
  { id:"p2", name:"Integración Cámaras de Televigilancia Recoleta", budget:100000000, stage:"Licitación", status:"En curso", deadline:"", financier:"SPD", program:"SNSM 2025", desc:"7 postaciones galvanizadas 15m, cámaras PTZ, reconocimiento facial, ANPR. Ficha modificación plazo en trámite SPD.", notes:"", aiSummary:"", licitId:"", licitData:null, licitChecked:"", docs:[], emails:[], tasks:[], codigoProyecto:"SNSM25-STP-0113", codigoSIGE:"22004928" },
  { id:"p3", name:"Sistemas CCTV Centros Culturales", budget:26000000, stage:"Licitación", status:"En curso", deadline:"", financier:"SPD", program:"FNSP", desc:"CCTV centros culturales. CDP N°79 emitido. Pendiente publicación MP.", notes:"", aiSummary:"", licitId:"", licitData:null, licitChecked:"", docs:[], emails:[], tasks:[], codigoProyecto:"CDP N°79" },
  { id:"p4", name:"Cámaras de Televigilancia UV N°32", budget:914371153, stage:"Adjudicación", status:"En curso", deadline:"2026-04-30", financier:"GORE RM", program:"FNDR", desc:"Adjudicación 30 abril. Pendiente BNUP.", notes:"", aiSummary:"", licitId:"", licitData:null, licitChecked:"", docs:[], emails:[], tasks:[], codigoProyecto:"BIP 40066179-0" },
  { id:"p5", name:"Sala de Monitoreo Edificio Consistorial", budget:100000000, stage:"Licitación", status:"Con alerta", deadline:"2026-06-30", financier:"SPD", program:"SNSM 2023", desc:"LP25 desierta, LP26 revocada. Trato directo activo.", notes:"", aiSummary:"", licitId:"1431841-68-LP25", licitData:null, licitChecked:"", docs:[], emails:[], tasks:[], codigoProyecto:"SNSM23-STP-0039", codigoSIGE:"21460117", convenio:{ plazoEjecucionFin:"2026-06-30", plazoConvenioFin:"2026-09-30" } },
];

const INIT_FOLLOWS = [
  { id:"f1", projectId:"p5", urgency:"crítica", subject:"2do Trato Directo — Sala Monitoreo", to:"Securitas / Prosegur", context:"Correos rebotaron. Buscar emails correctos.", sentDate:"2026-04-10", daysPending:3, status:"activo", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d73316aebeb956" },
  { id:"f2", projectId:"p5", urgency:"alta", subject:"Factibilidad Torre Telecom — Sala Monitoreo", to:"Francisco Moscoso", context:"Pronunciamiento autorización repetidor 5GHz.", sentDate:"2026-04-01", daysPending:12, status:"activo", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d4aa05342a51ac" },
  { id:"f3", projectId:"p2", urgency:"alta", subject:"Modificación Plazo SNSM23-STP-0039 — SPD", to:"Osvaldo Muñoz (SPD)", context:"Ficha subsanada enviada 7 abril. Sin confirmación.", sentDate:"2026-04-07", daysPending:6, status:"activo", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d1ab5d03fb53ce" },
  { id:"f4", projectId:"p3", urgency:"alta", subject:"CCTV Centros Culturales — iniciar licitación MP", to:"María Paz Juica / Alvaro Porzio", context:"CDP N°79 emitido. Pendiente ingreso MP.", sentDate:"2026-04-01", daysPending:12, status:"activo", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d2665ac1e575ac" },
  { id:"f5", projectId:"p4", urgency:"media", subject:"Cámaras UV N°32 — Certificados BNUP", to:"María Paz Juica", context:"Solo Certificados de Número. Adjudicación 30 abril.", sentDate:"2026-04-13", daysPending:0, status:"activo", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4" },
];

const INIT_BOSS = [
  { id:"b1", from:"María Paz Juica", projectId:"p5", urgency:"crítica", task:"Presentación diagnóstico 3 salas de cámaras para reunión Alcaldía.", requestDate:"2026-04-10", status:"pendiente", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d790219c18994c" },
  { id:"b2", from:"María Paz Juica", projectId:"p2", urgency:"alta", task:"Subsanar observaciones SNSM25-STP-0113. Plazo 15 días desde 9 abril.", requestDate:"2026-04-09", status:"pendiente", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" },
  { id:"b3", from:"María Paz Juica", projectId:"p2", urgency:"alta", task:"Confirmar recepción Certificados BNUP proyecto SNSM2025.", requestDate:"2026-04-13", status:"pendiente", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4" },
  { id:"b4", from:"María Paz Juica", projectId:"p5", urgency:"media", task:"Gestionar Decreto modifica Comisión Evaluadora — licitación desierta.", requestDate:"2026-04-10", status:"pendiente", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d3f351893aaf74" },
  { id:"b5", from:"Grace Arcos", projectId:"p5", urgency:"alta", task:"Reunión Opciones Sala Televigilancia — 15 abril 13:00 hrs.", requestDate:"2026-04-08", status:"pendiente", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d6dc78c627480e" },
  { id:"b6", from:"Grace Arcos", projectId:"p1", urgency:"alta", task:"Seguimiento empalme eléctrico 6ta Comisaría — reunión 15 abril.", requestDate:"2026-04-13", status:"pendiente", threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d892c228474fcc" },
];

const CLOCK_SEED = [
  {date:"2026-01-29",entrada:null,salida:"16:53"},{date:"2026-01-30",entrada:"07:43",salida:"15:46"},
  {date:"2026-02-04",entrada:"07:48",salida:"17:00"},{date:"2026-02-05",entrada:"07:42",salida:"16:44"},
  {date:"2026-02-06",entrada:"08:05",salida:"16:13"},{date:"2026-02-09",entrada:"08:15",salida:"17:21"},
  {date:"2026-02-10",entrada:"08:37",salida:"17:40"},{date:"2026-02-11",entrada:"07:44",salida:"16:56"},
  {date:"2026-02-12",entrada:"07:44",salida:"16:56"},{date:"2026-02-13",entrada:"08:15",salida:null},
  {date:"2026-02-16",entrada:"07:40",salida:"17:05"},{date:"2026-02-17",entrada:"07:42",salida:"16:52"},
  {date:"2026-02-18",entrada:"07:57",salida:"17:04"},{date:"2026-02-19",entrada:"07:26",salida:"16:34"},
  {date:"2026-02-20",entrada:"07:50",salida:"15:59"},{date:"2026-02-23",entrada:"07:45",salida:"16:50"},
  {date:"2026-02-24",entrada:"07:49",salida:"16:53"},{date:"2026-02-25",entrada:null,salida:"17:07"},
  {date:"2026-02-26",entrada:"07:41",salida:"16:54"},{date:"2026-02-27",entrada:"07:54",salida:"16:08"},
  {date:"2026-03-02",entrada:"08:35",salida:"17:38"},{date:"2026-03-03",entrada:"08:25",salida:"17:41"},
  {date:"2026-03-04",entrada:"08:29",salida:"17:36"},{date:"2026-03-05",entrada:"08:26",salida:"17:31"},
  {date:"2026-03-06",entrada:"08:21",salida:"16:28"},{date:"2026-03-09",entrada:"08:24",salida:"17:40"},
  {date:"2026-03-10",entrada:"08:36",salida:"17:40"},{date:"2026-03-11",entrada:"08:14",salida:"17:27"},
  {date:"2026-03-12",entrada:"08:34",salida:"17:44"},{date:"2026-03-13",entrada:"08:32",salida:"16:46"},
  {date:"2026-03-16",entrada:"08:26",salida:"17:29"},{date:"2026-03-17",entrada:"08:21",salida:"17:33"},
  {date:"2026-03-18",entrada:"08:18",salida:"17:28"},{date:"2026-03-19",entrada:"08:21",salida:"17:25"},
  {date:"2026-03-20",entrada:"08:16",salida:"16:12"},{date:"2026-03-23",entrada:"08:39",salida:"17:48"},
  {date:"2026-03-24",entrada:"08:19",salida:"17:24"},{date:"2026-03-25",entrada:"08:27",salida:"17:40"},
  {date:"2026-03-30",entrada:"08:33",salida:"17:36"},{date:"2026-03-31",entrada:"08:28",salida:"17:33"},
  {date:"2026-04-01",entrada:"08:31",salida:"17:36"},{date:"2026-04-02",entrada:"08:34",salida:"17:32"},
  {date:"2026-04-06",entrada:"08:18",salida:"17:25"},{date:"2026-04-07",entrada:"08:42",salida:"18:26"},
  {date:"2026-04-08",entrada:"08:26",salida:"17:28"},{date:"2026-04-09",entrada:"08:40",salida:"17:41"},
  {date:"2026-04-10",entrada:"08:21",salida:"16:34"},{date:"2026-04-13",entrada:"08:26",salida:"17:37"},
  {date:"2026-04-14",entrada:"08:30",salida:"17:36"},{date:"2026-04-15",entrada:"08:24",salida:null},
];

const STAGES = ["Formulación","Diseño","Licitación","Adjudicación","Ejecución","Recepción","Completado","Archivado"];
const STATUSES = ["En curso","Pendiente","Detenido","Completado","Con alerta"];
const FINANCIERS = ["GORE","SPD","Municipal","MININT","FNDR","Otro"];
const MONTHS_FULL = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Status colors
const ST_COLOR = { "En curso":"#1B4FD8","Pendiente":"#B45309","Detenido":"#C0392B","Completado":"#0D7A55","Con alerta":"#C05621" };
const MPC_COLOR = { "Publicada":"#0D7A55","En proceso":"#1B4FD8","Cerrada":"#B45309","Adjudicada":"#6D28D9","Desierta":"#C0392B","Revocada":"#C0392B" };
const URGENCY_COLOR = { "crítica":"#C0392B","alta":"#C05621","media":"#B45309" };
const URGENCY_ICON  = { "crítica":"●","alta":"◆","media":"▲" };

const COTIZ_STATUS = {
  sin_enviar:            { lbl:"Sin enviar",         dot:"○", color:C.dim },
  enviado:               { lbl:"Enviado",            dot:"●", color:C.blue },
  sin_respuesta:         { lbl:"Sin respuesta",      dot:"◆", color:C.amber },
  sin_respuesta_urgente: { lbl:"Urgente",            dot:"⚠", color:C.red },
  respondido:            { lbl:"Respondió",          dot:"●", color:"#0D7A55" },
  cotizacion_recibida:   { lbl:"Cotización recibida",dot:"✓", color:"#0D7A55" },
  email_rebotado:        { lbl:"Email rebotado",     dot:"✕", color:C.red },
};

const COTIZ_SEED = [
  { empresa:"Scharfstein",   email:"smerino@scharfstein.cl",       estado:"sin_respuesta_urgente", totalEnviados:3, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Bionic Vision", email:"lvalero@bionicvision.cl",      estado:"respondido",            totalEnviados:2, totalRecibidos:1, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Grupo VSM",     email:"comunicaciones@grupovsm.cl",   estado:"sin_respuesta",         totalEnviados:1, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"RockTech",      email:"fabiana.rifo@rocktechla.com",  estado:"sin_respuesta",         totalEnviados:1, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Securitas",     email:"comercial@securitas.cl",       estado:"email_rebotado",        totalEnviados:1, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Prosegur",      email:"ventas.empresas@prosegur.com", estado:"email_rebotado",        totalEnviados:1, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Verkauf",       email:"@verkauf.cl",                  estado:"sin_enviar",            totalEnviados:0, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Dahua",         email:"@dahua.com",                   estado:"sin_enviar",            totalEnviados:0, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
  { empresa:"Hikvision",     email:"@hikvision.com",               estado:"sin_enviar",            totalEnviados:0, totalRecibidos:0, firstSent:null, lastSent:null, lastRecv:null, timeline:[] },
];

// ══════════════════════════════════════════════════════
// HOOK RESPONSIVE
// ══════════════════════════════════════════════════════
function useWidth() {
  const [w, s] = useState(900);
  useEffect(() => { s(window.innerWidth); const h = () => s(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

// ══════════════════════════════════════════════════════
// COMPONENTES
// ══════════════════════════════════════════════════════

// ── Tag ──────────────────────────────────────────────
function Tag({ children, color = C.blue, bg }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:600, letterSpacing:0.2, color, background: bg || color + "14", border:`1px solid ${color}28` }}>
      {children}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────
function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px", ...style, cursor: onClick ? "pointer" : "default" }}>
      {children}
    </div>
  );
}

// ── Section title ─────────────────────────────────────
function SectionTitle({ children, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:C.sub }}>{children}</div>
      {action}
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────
function Btn({ children, onClick, disabled, color = C.ink, outline, small, style: sx = {} }) {
  const base = {
    display:"inline-flex", alignItems:"center", gap:5, cursor: disabled ? "not-allowed" : "pointer",
    borderRadius:6, fontWeight:600, fontSize: small ? 11 : 12, padding: small ? "4px 10px" : "8px 14px",
    border: outline ? `1.5px solid ${color}` : "none",
    background: outline ? "transparent" : color,
    color: outline ? color : "#fff",
    opacity: disabled ? 0.5 : 1, transition:"opacity .15s",
    ...sx,
  };
  return <button onClick={onClick} disabled={disabled} style={base}>{children}</button>;
}

// ── Input ─────────────────────────────────────────────
const INP = { padding:"9px 11px", borderRadius:7, border:`1.5px solid ${C.border}`, fontSize:13, width:"100%", boxSizing:"border-box", outline:"none", background:"#fff", color:C.text, transition:"border-color .15s", fontFamily:"inherit" };
const LBL = { fontSize:11, fontWeight:700, letterSpacing:0.5, color:C.sub, display:"block", marginBottom:5, textTransform:"uppercase" };

// ── StatusDot ─────────────────────────────────────────
function StatusDot({ status }) {
  const c = ST_COLOR[status] || C.sub;
  return <span style={{ width:7, height:7, borderRadius:"50%", background:c, display:"inline-block", marginRight:5 }} />;
}

// ══════════════════════════════════════════════════════
// BANDEJA
// ══════════════════════════════════════════════════════
function BandejaPanel({ bandeja, follows, onFollow, onDiscard, onRefresh, loading, msg }) {
  const discarded = dbGet("discarded_v5", []);
  const followedThreads = new Set((follows || []).map(f => f.threadId).filter(Boolean));
  const visible = (bandeja || []).filter(m => !discarded.includes(m.threadId) && !followedThreads.has(m.threadId));
  const [exp, setExp] = useState(null);

  const urgColor = d => d > 7 ? C.red : d > 3 ? C.amber : C.green;

  return (
    <div>
      <SectionTitle action={<Btn onClick={onRefresh} disabled={loading} small outline color={C.blue}>{loading ? "···" : "↻ Actualizar"}</Btn>}>
        Bandeja de entrada {visible.length > 0 && <span style={{ marginLeft:6, background:C.red+"14", color:C.red, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{visible.length}</span>}
      </SectionTitle>

      {msg && <div style={{ fontSize:11, color: msg.includes("Sin") || msg.includes("warn") ? C.amber : msg.includes("rror") ? C.red : C.green, marginBottom:8, padding:"5px 8px", background:C.border+"40", borderRadius:5 }}>{msg}</div>}

      {visible.length === 0 && !loading && (
        <Card style={{ textAlign:"center", padding:"20px 14px" }}>
          <div style={{ fontSize:18, marginBottom:4 }}>✓</div>
          <div style={{ fontSize:12, color:C.sub }}>Bandeja limpia</div>
        </Card>
      )}

      {visible.map(m => {
        const dc = urgColor(m.daysSinceLastMsg);
        const isExp = exp === m.threadId;
        return (
          <Card key={m.threadId} style={{ marginBottom:8 }}>
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text, lineHeight:1.3, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace: isExp ? "normal" : "nowrap" }}>
                  {m.subject}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, color:C.sub }}>{(m.fromName || "").slice(0, 30)}</span>
                  <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:dc+"14", color:dc, fontWeight:700 }}>
                    {m.daysSinceLastMsg === 0 ? "hoy" : `${m.daysSinceLastMsg}d`}
                  </span>
                  {m.projectId && <Tag color={C.blue} small>{m.projectId}</Tag>}
                </div>
                {isExp && m.snippet && <div style={{ marginTop:6, fontSize:11, color:C.sub, lineHeight:1.5 }}>{m.snippet}</div>}
              </div>
              <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                <button onClick={() => setExp(isExp ? null : m.threadId)} style={{ fontSize:10, padding:"3px 7px", borderRadius:4, border:`1px solid ${C.border}`, background:"transparent", cursor:"pointer", color:C.sub }}>{isExp ? "▲" : "▼"}</button>
                {m.threadUrl && <a href={m.threadUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, padding:"3px 7px", borderRadius:4, background:C.blue+"10", color:C.blue, textDecoration:"none", fontWeight:700, border:`1px solid ${C.blue}20` }}>Gmail</a>}
              </div>
            </div>
            <div style={{ display:"flex", gap:6, marginTop:10 }}>
              <Btn onClick={() => onFollow(m)} small color={C.blue}>📌 Seguir</Btn>
              <Btn onClick={() => onDiscard(m.threadId)} small outline color={C.sub}>Descartar</Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SEGUIMIENTOS
// ══════════════════════════════════════════════════════
function FollowsPanel({ follows, projects, onResolve, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [nf, setNf] = useState({ projectId:"", urgency:"media", subject:"", to:"", context:"", threadUrl:"" });
  const [showResolved, setShowResolved] = useState(false);

  const active   = [...follows.filter(f => f.status === "activo")].sort((a,b) => ({crítica:0,alta:1,media:2}[a.urgency]??3) - ({crítica:0,alta:1,media:2}[b.urgency]??3));
  const resolved = follows.filter(f => f.status === "resuelto");

  const save = () => {
    if (!nf.subject || !nf.to) return;
    onAdd({ id:"m_"+uid(), ...nf, sentDate:isoToday(), daysPending:0, status:"activo", manual:true });
    setNf({ projectId:"", urgency:"media", subject:"", to:"", context:"", threadUrl:"" });
    setShowForm(false);
  };

  return (
    <div>
      <SectionTitle action={
        <Btn onClick={() => setShowForm(x => !x)} small outline color={showForm ? C.sub : C.blue}>
          {showForm ? "✕" : "+ Agregar"}
        </Btn>
      }>
        Seguimientos activos {active.length > 0 && <span style={{ marginLeft:6, background:C.red+"14", color:C.red, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{active.length}</span>}
      </SectionTitle>

      {showForm && (
        <Card style={{ marginBottom:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div><label style={LBL}>Proyecto</label>
              <select value={nf.projectId} onChange={e => setNf(x=>({...x,projectId:e.target.value}))} style={INP}>
                <option value="">—</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name.slice(0,30)}</option>)}
              </select>
            </div>
            <div><label style={LBL}>Urgencia</label>
              <select value={nf.urgency} onChange={e => setNf(x=>({...x,urgency:e.target.value}))} style={INP}>
                <option value="crítica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom:8 }}><label style={LBL}>Asunto *</label><input value={nf.subject} onChange={e=>setNf(x=>({...x,subject:e.target.value}))} style={INP} /></div>
          <div style={{ marginBottom:8 }}><label style={LBL}>Destinatario *</label><input value={nf.to} onChange={e=>setNf(x=>({...x,to:e.target.value}))} style={INP} /></div>
          <div style={{ marginBottom:8 }}><label style={LBL}>Contexto</label><textarea value={nf.context} onChange={e=>setNf(x=>({...x,context:e.target.value}))} rows={2} style={{...INP,resize:"vertical"}} /></div>
          <div style={{ marginBottom:10 }}><label style={LBL}>URL Gmail</label><input value={nf.threadUrl} onChange={e=>setNf(x=>({...x,threadUrl:e.target.value}))} style={INP} placeholder="https://mail.google.com/..." /></div>
          <Btn onClick={save} color={C.blue}>Guardar</Btn>
        </Card>
      )}

      {active.length === 0 && (
        <Card style={{ textAlign:"center", padding:"18px 14px" }}>
          <div style={{ fontSize:11, color:C.sub }}>Sin seguimientos activos</div>
        </Card>
      )}

      {active.map(f => {
        const fp = projects.find(p => p.id === f.projectId);
        const uc = URGENCY_COLOR[f.urgency] || C.amber;
        return (
          <Card key={f.id} style={{ marginBottom:8, borderLeft:`3px solid ${uc}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:3, lineHeight:1.3 }}>
                  <span style={{ color:uc, marginRight:5 }}>{URGENCY_ICON[f.urgency]}</span>{f.subject}
                  {f.manual && <span style={{ marginLeft:6, fontSize:10, color:C.blue }}>manual</span>}
                </div>
                <div style={{ fontSize:11, color:C.sub }}>→ {f.to}</div>
                {fp && <div style={{ marginTop:3 }}><Tag color={C.sub}>{fp.name.slice(0,30)}</Tag></div>}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:uc }}>{f.daysPending}d</div>
                <div style={{ fontSize:10, color:C.dim }}>{fDate(f.sentDate)}</div>
              </div>
            </div>
            {f.context && <div style={{ fontSize:11, color:C.sub, lineHeight:1.5, padding:"6px 8px", background:C.bg, borderRadius:5, marginBottom:8 }}>{f.context}</div>}
            <div style={{ display:"flex", gap:6 }}>
              {f.threadUrl && <a href={f.threadUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"4px 10px", borderRadius:5, background:C.blue+"10", color:C.blue, textDecoration:"none", fontWeight:700, border:`1px solid ${C.blue}20` }}>✉ Gmail</a>}
              <Btn onClick={() => onResolve(f.id)} small color={C.green}>✓ Resuelto</Btn>
            </div>
          </Card>
        );
      })}

      {resolved.length > 0 && (
        <div>
          <button onClick={() => setShowResolved(x => !x)} style={{ fontSize:11, color:C.dim, background:"none", border:"none", cursor:"pointer", padding:"6px 0" }}>
            {showResolved ? "▲" : "▼"} {resolved.length} resuelto(s)
          </button>
          {showResolved && resolved.slice(0,10).map(f => (
            <Card key={f.id} style={{ marginBottom:6, opacity:0.7 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, color:C.sub, textDecoration:"line-through" }}>{f.subject}</div>
                  <div style={{ fontSize:10, color:C.dim }}>→ {f.to} · {fDate(f.sentDate)}</div>
                  {f.resolvedAt && <div style={{ fontSize:10, color:C.green }}>✓ {fDate(f.resolvedAt)}</div>}
                </div>
                <Btn onClick={() => onResolve(f.id,"reopen")} small outline color={C.sub}>↩</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// COTIZACIONES SNSM 2025
// ══════════════════════════════════════════════════════
function CotizPanel({ cotiz, loading, msg, onRefresh, fDate }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const data = cotiz?.length > 0 ? cotiz : COTIZ_SEED;
  const filtered = filter === "all" ? data : data.filter(c => c.estado === filter);
  const conCotiz = data.filter(c => c.estado === "cotizacion_recibida").length;
  const enviados = data.filter(c => c.totalEnviados > 0).length;
  const urgentes = data.filter(c => ["sin_respuesta_urgente","email_rebotado"].includes(c.estado)).length;
  const noEnviado = data.filter(c => c.estado === "sin_enviar").length;

  const FILTERS = [
    ["all","Todas",data.length],
    ["cotizacion_recibida","✓ Recibidas",conCotiz],
    ["sin_respuesta_urgente","⚠ Urgentes",urgentes],
    ["sin_enviar","○ Sin enviar",noEnviado],
  ];

  return (
    <div>
      <SectionTitle action={<Btn onClick={onRefresh} disabled={loading} small outline color={C.blue}>{loading?"···":"↻ Actualizar"}</Btn>}>
        Cotizaciones SNSM 2025
      </SectionTitle>

      {/* resumen rápido */}
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        {[
          [`${conCotiz}/${data.length}`, "Cotizaciones", C.green],
          [`${enviados}`, "Con contacto", C.blue],
          [`${urgentes}`, "Urgentes", urgentes > 0 ? C.red : C.dim],
          [`${noEnviado}`, "Sin enviar", C.dim],
        ].map(([v,l,c]) => (
          <div key={l} style={{ flex:"1 1 70px", background:C.bg, borderRadius:7, padding:"8px 10px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:16, fontWeight:800, color:c, lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {msg && <div style={{ fontSize:11, color:C.sub, marginBottom:8, padding:"4px 8px", background:C.border+"40", borderRadius:4 }}>{msg}</div>}

      {/* filtros */}
      <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
        {FILTERS.map(([fv,fl,cnt]) => (
          <button key={fv} onClick={() => setFilter(fv)} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:`1px solid ${filter===fv?C.blue:C.border}`, background:filter===fv?C.blue:"transparent", color:filter===fv?"#fff":C.sub, cursor:"pointer", fontWeight:600 }}>
            {fl}{cnt > 0 ? ` (${cnt})` : ""}
          </button>
        ))}
      </div>

      {filtered.map(c => {
        const cfg = COTIZ_STATUS[c.estado] || COTIZ_STATUS.sin_enviar;
        const isOpen = open === c.empresa;
        return (
          <Card key={c.empresa} style={{ marginBottom:7, borderLeft:`3px solid ${cfg.color}` }}>
            <div onClick={() => setOpen(isOpen ? null : c.empresa)} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{c.empresa}</span>
                  <span style={{ fontSize:10, color:cfg.color, fontWeight:700 }}>{cfg.dot} {cfg.lbl}</span>
                  {c.diasSinResp != null && c.diasSinResp > 0 && <span style={{ fontSize:10, color:c.diasSinResp>7?C.red:C.amber, fontWeight:600 }}>{c.diasSinResp}d sin resp.</span>}
                </div>
                <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{c.email} · ↑{c.totalEnviados} ↓{c.totalRecibidos}</div>
              </div>
              <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                {c.lastRecv?.url && <a href={c.lastRecv.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:C.green+"14", color:C.green, textDecoration:"none", fontWeight:700, border:`1px solid ${C.green}20` }}>↓ Ver</a>}
                {!c.lastRecv && c.lastSent?.url && <a href={c.lastSent.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:10, padding:"3px 8px", borderRadius:4, background:C.blue+"10", color:C.blue, textDecoration:"none", fontWeight:700, border:`1px solid ${C.blue}20` }}>↑ Ver</a>}
                <span style={{ fontSize:11, color:C.dim }}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                {/* Bloques clave */}
                {[
                  c.firstSent && { ic:"↑", lbl:"Primer envío", ...c.firstSent, color:C.blue },
                  c.lastSent && c.lastSent.url !== c.firstSent?.url && { ic:"↑", lbl:"Último envío", ...c.lastSent, color:C.amber },
                  c.lastRecv && { ic:"↓", lbl:"Última respuesta", ...c.lastRecv, color:C.green },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ marginBottom:8, padding:"7px 9px", background:C.bg, borderRadius:6, borderLeft:`2px solid ${item.color}` }}>
                    <div style={{ fontSize:10, color:item.color, fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>{item.ic} {item.lbl}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{item.subject}</div>
                    <div style={{ fontSize:10, color:C.dim }}>{fDate(item.date?.slice(0,10)||"")}</div>
                    {item.snippet && <div style={{ fontSize:11, color:C.sub, fontStyle:"italic", marginTop:3 }}>"{item.snippet.slice(0,100)}…"</div>}
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:item.color, fontWeight:600 }}>Abrir →</a>}
                  </div>
                ))}

                {/* Timeline */}
                {c.timeline?.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700, marginBottom:5 }}>Historial ({c.timeline.length})</div>
                    {c.timeline.map((m,i) => (
                      <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:10, color: m.type==="sent"?C.blue:C.green, fontWeight:700, flexShrink:0 }}>{m.type==="sent"?"↑":"↓"}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.subject}</div>
                          <div style={{ fontSize:10, color:C.dim }}>{fDate(m.date?.slice(0,10)||"")}</div>
                        </div>
                        {m.url && <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:C.blue, flexShrink:0 }}>↗</a>}
                      </div>
                    ))}
                  </div>
                )}

                {!c.firstSent && !c.lastSent && c.totalEnviados === 0 && (
                  <div style={{ fontSize:11, color:C.dim, textAlign:"center", padding:"6px 0" }}>Sin historial — presiona ↻ para sincronizar</div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// RELOJ CONTROL
// ══════════════════════════════════════════════════════
function ClockPanel({ clockData, loading, onSync, clockMeta }) {
  const [month, setMonth] = useState(() => isoToday().slice(0,7));
  const [open, setOpen] = useState(false);

  const today = isoToday();
  // Día hábil anterior
  const prevWD = () => { const d = new Date(); d.setHours(12); do { d.setDate(d.getDate()-1); } while([0,6].includes(d.getDay())); return d.toISOString().slice(0,10); };
  const yesterday = prevWD();

  const months = [...new Set(clockData.map(r => r.date.slice(0,7)))].sort().slice(-4);
  const monthData = clockData.filter(r => r.date.startsWith(month));

  const nowMin = new Date().getHours()*60 + new Date().getMinutes();
  const days = monthData.map(r => {
    const j = jorn(r.date), eM = toMin(r.entrada), sM = toMin(r.salida), isT = r.date === today;
    if (!eM && !sM) return { ...r, j, extra:null, alert: r.date === yesterday ? "sin_ayer" : null };
    if (!sM && isT) return { ...r, j, extra:null, live: Math.max(0, nowMin-(eM+j)), expSal: eM+j };
    if (!sM) return { ...r, j, extra:null };
    if (!eM) return { ...r, j, extra:null };
    return { ...r, j, extra:(sM-eM)-j };
  });

  const done = days.filter(d => d.extra !== null);
  const totalExtra = done.reduce((a,d) => a+(d.extra||0), 0);
  const yearExtra = clockData.map(r => { const j=jorn(r.date), eM=toMin(r.entrada), sM=toMin(r.salida); return eM&&sM?(sM-eM)-j:null; }).filter(x=>x!==null).reduce((a,v)=>a+v,0);
  const nc = totalExtra >= 0 ? C.green : C.red;
  const yc = yearExtra >= 0 ? C.green : C.red;
  const [,mo] = month.split("-").map(Number);
  const todayRec = days.find(d => d.date === today);
  const yesterdayRec = clockData.find(d => d.date === yesterday);
  const missingYesterday = !yesterdayRec && clockMeta?.hasYesterday === false;

  return (
    <div>
      <SectionTitle action={<Btn onClick={onSync} disabled={loading} small outline color={C.blue}>{loading?"···":"↻ Sync"}</Btn>}>
        Reloj Control 2026
      </SectionTitle>

      {/* Alerta si falta marcaje de ayer */}
      {missingYesterday && (
        <div style={{ background:C.amber+"14", border:`1px solid ${C.amber}33`, borderRadius:7, padding:"8px 12px", marginBottom:10, fontSize:12, color:C.amber, fontWeight:600 }}>
          ⚠ Sin registro para {fDate(yesterday)} — revisa si hubo marcaje
        </div>
      )}

      {/* Hoy en curso */}
      {todayRec?.live != null && todayRec.live > 0 && (
        <Card style={{ marginBottom:10, borderLeft:`3px solid ${C.blue}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.blue, marginBottom:2 }}>En jornada — {todayRec.entrada}</div>
          <div style={{ fontSize:11, color:C.sub }}>
            Salida normal: {String(Math.floor(todayRec.expSal/60)).padStart(2,"0")}:{String(todayRec.expSal%60).padStart(2,"0")}
            {todayRec.live > 0 && <span style={{ color:"#7C3AED", fontWeight:700, marginLeft:8 }}>+{fMin(todayRec.live)} extra ahora</span>}
          </div>
        </Card>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:7, marginBottom:10 }}>
        {[
          { l:`Extra ${MONTHS_FULL[mo].slice(0,3)}`, v:(totalExtra>=0?"+":"")+fMin(totalExtra), c:nc },
          { l:"Días", v:`${done.length}d`, c:C.blue },
          { l:"Acum. 2026", v:(yearExtra>=0?"+":"")+fMin(yearExtra), c:yc },
          { l:"Hoy", v:todayRec ? `${todayRec.entrada||"?"} / ${todayRec.salida||"⏳"}` : "—", c:C.sub },
        ].map(({l,v,c}) => (
          <div key={l} style={{ background:C.bg, borderRadius:7, padding:"7px 9px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700, marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Selector mes + toggle */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
        {months.map(m => { const [,mm]=m.split("-").map(Number); return (
          <button key={m} onClick={() => setMonth(m)} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:`1px solid ${month===m?C.blue:C.border}`, background:month===m?C.blue:"transparent", color:month===m?"#fff":C.sub, cursor:"pointer", fontWeight:600 }}>
            {MONTHS_FULL[mm].slice(0,3)}
          </button>
        ); })}
        <button onClick={() => setOpen(o=>!o)} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.sub, cursor:"pointer" }}>
          {open ? "▲ Ocultar" : "▼ Ver tabla"}
        </button>
      </div>

      {open && (
        <div style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:0, padding:"7px 12px", background:C.bg, borderBottom:`1px solid ${C.border}` }}>
            {["Fecha","J","Entrada","Salida","Extra"].map(h => <div key={h} style={{ fontSize:9, fontWeight:700, color:C.dim, textTransform:"uppercase" }}>{h}</div>)}
          </div>
          {[...days].reverse().map(d => {
            const isT = d.date === today, isY = d.date === yesterday;
            const ec = d.extra > 0 ? C.green : d.extra < 0 ? C.red : C.sub;
            return (
              <div key={d.date} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:0, padding:"8px 12px", borderBottom:`1px solid ${C.border}`, background: isT ? C.blue+"08" : isY ? C.amber+"08" : "transparent" }}>
                <div style={{ fontSize:11, fontWeight:isT||isY?700:400, color: isT?C.blue : isY?C.amber : C.text }}>
                  {fDate(d.date)}{isT&&<span style={{ marginLeft:4, fontSize:9, color:C.blue }}>hoy</span>}{isFri(d.date)&&<span style={{ marginLeft:3, fontSize:9, color:C.amber }}>vie</span>}
                </div>
                <div style={{ fontSize:10, color:C.dim }}>{d.j===480?"8h":"9h"}</div>
                <div style={{ fontSize:11 }}>{d.entrada||"—"}</div>
                <div style={{ fontSize:11, color: d.salida ? C.text : C.amber }}>{d.salida||(d.date===today?"⏳":"—")}</div>
                <div style={{ fontSize:12, fontWeight:700, color: d.extra!=null?ec:C.dim }}>
                  {d.extra!=null ? (d.extra>0?`+${fMin(d.extra)}`:d.extra<0?`-${fMin(Math.abs(d.extra))}`:"=") : "—"}
                </div>
              </div>
            );
          })}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", padding:"8px 12px", background:C.bg, borderTop:`1.5px solid ${C.border}` }}>
            <div style={{ fontSize:11, fontWeight:700, gridColumn:"1/5" }}>Total {MONTHS_FULL[mo]}</div>
            <div style={{ fontSize:13, fontWeight:900, color:nc }}>{totalExtra>=0?"+":""}{fMin(totalExtra)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════
export default function Page() {
  const w = useWidth();
  const mob = w < 768;
  const tablet = w >= 768 && w < 1100;

  // ── Persistencia ─────────────────────────────────────
  const [projects,  setProjects]  = useDB("projects",  INIT_P);
  const [follows,   setFollows]   = useDB("follows",   INIT_FOLLOWS);
  const [boss,      setBoss]      = useDB("boss",      INIT_BOSS);
  const [clockData, setClockData] = useDB("clock",     CLOCK_SEED);
  const [cotiz,     setCotiz]     = useDB("cotiz",     []);
  const [bandeja,   setBandeja]   = useDB("bandeja",   []);

  // sync status persisted para que sobreviva recarga
  const [ss, setSs] = useDB("ss", { reloj:"idle", gmail:"idle", cotiz:"idle" });
  const [sm, setSm] = useDB("sm", { reloj:"", gmail:"", cotiz:"" });
  const [clockMeta, setClockMeta] = useDB("clock_meta", {});

  // ── UI (no persistido) ────────────────────────────────
  const [view,       setView]      = useState("dash");
  const [sel,        setSel]       = useState(null);
  const [projTab,    setProjTab]   = useState("overview");
  const [showForm,   setShowForm]  = useState(false);
  const [form,       setForm]      = useState({ name:"", budget:"", stage:"Formulación", status:"Pendiente", deadline:"", financier:"GORE", program:"", desc:"", notes:"", licitId:"" });
  const [editId,     setEditId]    = useState(null);
  const [notesDraft, setNotesDraft]= useState("");
  const [genSum,     setGenSum]    = useState(false);
  const [newTask,    setNewTask]   = useState("");
  const [emailForm,  setEmailForm] = useState({ from:"", subject:"", date:"", body:"" });
  const [addEmail,   setAddEmail]  = useState(false);
  const [renaming,   setRenaming]  = useState(null);
  const [renameVal,  setRenameVal] = useState("");
  const [extracting, setExtracting]= useState(false);
  const [licitLoad,  setLicitLoad] = useState(null);
  const [msgs,       setMsgs]      = useState([{ role:"assistant", content:"Hola Alexis 👋  Soy tu asistente SECPLA.\n\nEjemplos:\n• ¿Qué urgencias tengo hoy?\n• ¿Qué empresas no han cotizado SNSM?\n• Resumen proyecto p5" }]);
  const [chatIn,     setChatIn]    = useState("");
  const [chatLoad,   setChatLoad]  = useState(false);
  const [loadR,  setLoadR]  = useState(false);
  const [loadG,  setLoadG]  = useState(false);
  const [loadC,  setLoadC]  = useState(false);
  const chatRef = useRef(null);
  const fileRef = useRef(null);

  const proj = projects.find(p => p.id === sel);
  const active = follows.filter(f => f.status === "activo");
  const critical = active.filter(f => f.urgency === "crítica");

  useEffect(() => { if (sel) { const p = projects.find(x => x.id === sel); if (p) setNotesDraft(p.notes || ""); } }, [sel]);

  // ── Helpers ───────────────────────────────────────────
  const upSS = (k, st, msg) => { setSs(p=>({...p,[k]:st})); setSm(p=>({...p,[k]:msg})); };
  const upProj = fn => setProjects(p => p.map(x => x.id === sel ? fn(x) : x));
  const saveNotes = () => upProj(p => ({...p, notes:notesDraft}));
  const resolveFollow = (id, action="resolve") => setFollows(p => p.map(f => f.id!==id?f : action==="reopen" ? {...f,status:"activo",resolvedAt:null} : {...f,status:"resuelto",resolvedAt:isoToday()}));
  const addFollow = nf => setFollows(p => [...p, nf]);

  const bandejaFollow = m => {
    const id = "bj_"+m.messageId;
    if (follows.find(f => f.id === id)) return;
    setFollows(p => [...p, { id, projectId:m.projectId||"", urgency:"media", subject:m.subject, to:m.fromName||m.from, context:m.snippet||"", sentDate:isoToday(), daysPending:m.daysSinceLastMsg||0, status:"activo", threadId:m.threadId, threadUrl:m.threadUrl }]);
    bandejaDiscard(m.threadId);
  };

  const bandejaDiscard = threadId => {
    const prev = dbGet("discarded_v5", []);
    if (!prev.includes(threadId)) dbSet("discarded_v5", [...prev, threadId]);
    setBandeja(p => [...p]); // force re-render
  };

  // ── SINCRONIZACIÓN ────────────────────────────────────
  const syncReloj = async (silent=false) => {
    if (!silent) upSS("reloj","loading","Leyendo Gmail...");
    setLoadR(true);
    const { ok, data } = await api({ type:"clock_sync" });
    if (!ok) { upSS("reloj","error", data.errorMessage||"Error"); setLoadR(false); return; }
    if (data.warning==="NO_GOOGLE_CREDENTIALS") { upSS("reloj","warn","Sin credenciales Google"); setLoadR(false); return; }
    const parsed = pj(data.text, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const gmailDates = new Set(parsed.map(r => r.date));
      const hist = CLOCK_SEED.filter(r => !gmailDates.has(r.date));
      setClockData([...hist, ...parsed].sort((a,b) => a.date.localeCompare(b.date)));
      if (data.meta) setClockMeta(data.meta);
      const today = parsed.find(r => r.date === isoToday());
      upSS("reloj","ok", today ? `✓ Hoy ${today.entrada||"?"} / ${today.salida||"⏳"}` : `✓ ${parsed.length}d sincronizados`);
    } else { upSS("reloj","warn","Sin registros recientes"); }
    setLoadR(false);
  };

  const syncGmail = async (silent=false) => {
    if (!silent) upSS("gmail","loading","Escaneando...");
    setLoadG(true);
    const KW = ["SNSM","SPD","GORE","licitación","cotización","convenio","sala monitoreo","UV32","comisaría"];
    const since = new Date(Date.now()-8*86400000).toISOString().slice(0,10).replace(/-/g,"/");
    const { ok, data } = await api({ type:"gmail_scan", since, keywords:KW });
    if (!ok) { upSS("gmail","error",data.errorMessage||"Error"); setLoadG(false); return; }
    if (data.warning==="NO_GOOGLE_CREDENTIALS") { upSS("gmail","warn","Sin credenciales Google"); setLoadG(false); return; }
    const parsed = pj(data.text, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      setBandeja(parsed);
      upSS("gmail","ok",`✓ ${parsed.length} correos en bandeja`);
    } else { upSS("gmail","warn","Sin correos relevantes"); }
    setLoadG(false);
  };

  const syncCotiz = async (silent=false) => {
    if (!silent) upSS("cotiz","loading","Analizando...");
    setLoadC(true);
    const { ok, data } = await api({ type:"cotizaciones_track" });
    if (!ok) { upSS("cotiz","error",data.errorMessage||"Error"); setLoadC(false); return; }
    if (data.warning==="NO_GOOGLE_CREDENTIALS") { upSS("cotiz","warn","Sin credenciales Google"); setLoadC(false); return; }
    const parsed = pj(data.text, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      setCotiz(parsed);
      const c = parsed.filter(x => x.estado==="cotizacion_recibida").length;
      upSS("cotiz","ok",`✓ ${c}/${parsed.length} cotizaciones`);
    } else { upSS("cotiz","warn","Sin datos de Gmail"); }
    setLoadC(false);
  };

  // ── SCHEDULER — cada hora en horario laboral ──────────
  const syncRRef = useRef(null); syncRRef.current = syncReloj;
  const syncGRef = useRef(null); syncGRef.current = syncGmail;
  const syncCRef = useRef(null); syncCRef.current = syncCotiz;

  useEffect(() => {
    const nowCLT = () => { const d = new Date(new Date().toLocaleString("en-US",{timeZone:"America/Santiago"})); return { hhmm:`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, dow:d.getDay(), hour:d.getHours() }; };
    const did = (k,slot) => { const v = localStorage.getItem(`sc_ran_${k}_${slot.replace(":","_")}`); return v && (Date.now()-new Date(v).getTime())/60000 < 55; };
    const mark = (k,slot) => localStorage.setItem(`sc_ran_${k}_${slot.replace(":","_")}`, new Date().toISOString());

    const tick = () => {
      const { hhmm, dow, hour } = nowCLT();
      if (dow < 1 || dow > 5) return;
      // Gmail: cada hora entre 08:00 y 18:00 (horario laboral)
      if (hour >= 8 && hour <= 18) {
        const hourSlot = `${String(hour).padStart(2,"0")}:00`;
        if (hhmm === hourSlot && !did("gml", hourSlot)) { mark("gml", hourSlot); syncGRef.current(true); }
      }
      // Reloj: 3 veces al día
      for (const s of ["08:00","13:30","17:30"]) { if (hhmm===s && !did("rel",s)) { mark("rel",s); syncRRef.current(true); } }
      // Cotiz: 2 veces al día
      for (const s of ["09:30","15:30"]) { if (hhmm===s && !did("ctz",s)) { mark("ctz",s); syncCRef.current(true); } }
    };

    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  // ── Chat ──────────────────────────────────────────────
  const buildCtx = () => projects.map(p => `${p.name}|${p.stage}|${p.status}|${fCLP(p.budget)}|${p.financier}\n${(p.aiSummary||p.desc||"").slice(0,100)}`).join("\n\n");
  const sendChat = async () => {
    if (!chatIn.trim() || chatLoad) return;
    const nm = [...msgs, { role:"user", content:chatIn.trim() }];
    setMsgs(nm); setChatIn(""); setChatLoad(true);
    setTimeout(() => chatRef.current?.scrollTo(0,chatRef.current.scrollHeight), 50);
    const cotizCtx = cotiz.length > 0 ? "\nCotiz: "+cotiz.map(c=>`${c.empresa}:${c.estado}`).join(", ") : "";
    const { ok, data } = await api({ type:"chat", messages:nm, context:buildCtx()+cotizCtx, follows:active.map(f=>`[${f.urgency}] ${f.subject}→${f.to}`).join("\n") });
    setMsgs(m => [...m, { role:"assistant", content: ok ? (data.text||"Sin respuesta.") : "Error de conexión." }]);
    setChatLoad(false);
    setTimeout(() => chatRef.current?.scrollTo(0,chatRef.current.scrollHeight), 100);
  };

  // ── Licitación ─────────────────────────────────────────
  const doLicit = async p => {
    if (!p?.licitId?.trim()) return;
    setLicitLoad(p.id);
    const { ok, data } = await api({ type:"licit", licitId:p.licitId });
    if (ok) setProjects(prev => prev.map(x => x.id===p.id ? {...x, licitData:pj(data.text,{estado:"Desconocido"}), licitChecked:isoToday()} : x));
    setLicitLoad(null);
  };

  // ── Summary ────────────────────────────────────────────
  const doSummary = async () => {
    if (!proj || !notesDraft.trim()) return;
    setGenSum(true);
    upProj(p => ({...p, notes:notesDraft}));
    const { ok, data } = await api({ type:"summary", project:{name:proj.name,financier:proj.financier,program:proj.program,budget:fCLP(proj.budget),stage:proj.stage,status:proj.status}, notes:notesDraft });
    if (ok) upProj(p => ({...p, notes:notesDraft, aiSummary:data.text||""}));
    setGenSum(false);
  };

  // ── Doc upload ─────────────────────────────────────────
  const uploadDoc = async e => {
    const file = e.target.files[0]; if (!file || !proj) return;
    setExtracting(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const b64 = ev.target.result.split(",")[1];
      const { ok, data } = await api({ type:"doc", b64, mediaType:file.type.startsWith("image/")?file.type:"application/pdf", isImg:file.type.startsWith("image/") });
      const ex = ok ? pj(data.text,{summary:"—"}) : {summary:"Error."};
      upProj(p => ({...p, docs:[...p.docs,{id:uid(),name:file.name,docType:ex.docType||"Documento",uploadedAt:isoToday(),summary:ex.summary||"—",extracted:JSON.stringify(ex)}]}));
      setExtracting(false);
    };
    reader.readAsDataURL(file); e.target.value="";
  };

  // ── CRUD ──────────────────────────────────────────────
  const addTask = () => { if (!newTask.trim() || !proj) return; upProj(p => ({...p, tasks:[...p.tasks,{id:uid(),text:newTask.trim(),status:"pending",createdAt:isoToday()}]})); setNewTask(""); };
  const toggleTask = id => upProj(p => ({...p, tasks:p.tasks.map(t => t.id===id?{...t,status:t.status==="pending"?"done":"pending"}:t)}));
  const delTask = id => upProj(p => ({...p, tasks:p.tasks.filter(t=>t.id!==id)}));
  const saveEmail = () => { if (!emailForm.subject||!proj) return; upProj(p => ({...p,emails:[...p.emails,{...emailForm,id:uid()}]})); setEmailForm({from:"",subject:"",date:"",body:""}); setAddEmail(false); };
  const delEmail = id => upProj(p => ({...p,emails:p.emails.filter(e=>e.id!==id)}));
  const delDoc = id => upProj(p => ({...p,docs:p.docs.filter(d=>d.id!==id)}));
  const commitRename = () => { if (renameVal.trim()) setProjects(p => p.map(x => x.id===renaming?{...x,name:renameVal.trim()}:x)); setRenaming(null); };
  const toggleBoss = id => setBoss(p => p.map(b => b.id===id ? {...b, status:b.status==="pendiente"?"completado":"pendiente", completedAt:isoToday()} : b));

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  const stColor = { idle:"#334155", loading:"#94a3b8", ok:C.green, warn:C.amber, error:C.red };

  // Sync bar compacta
  const SyncBar = () => (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
      {[
        { k:"gmail", lbl:"Bandeja", fn:()=>syncGmail(false), loading:loadG, count:bandeja.filter(m=>{ const disc=dbGet("discarded_v5",[]); const ft=new Set(follows.map(f=>f.threadId).filter(Boolean)); return !disc.includes(m.threadId)&&!ft.has(m.threadId); }).length },
        { k:"cotiz", lbl:"Cotizaciones", fn:()=>syncCotiz(false), loading:loadC, count:null },
        { k:"reloj", lbl:"Reloj", fn:()=>syncReloj(false), loading:loadR, count:null },
      ].map(({ k, lbl, fn, loading, count }) => {
        const st = ss[k] || "idle";
        const ic = { ok:"✓", warn:"⚠", error:"✕" }[st] || "";
        return (
          <div key={k} style={{ position:"relative" }}>
            <button onClick={fn} disabled={loading} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 11px", borderRadius:6, border:`1.5px solid ${C.border}`, background: st==="idle"?C.ink : stColor[st], color:"#fff", fontSize:11, fontWeight:600, cursor:loading?"wait":"pointer", opacity:loading?0.6:1 }}>
              {loading ? "···" : lbl}
              {count != null && count > 0 && <span style={{ background:"rgba(255,255,255,0.25)", borderRadius:8, padding:"0 5px", fontSize:10 }}>{count}</span>}
              {!loading && ic && <span>{ic}</span>}
            </button>
            {st!=="idle" && sm[k] && (
              <div style={{ position:"absolute", top:"100%", left:0, background:C.ink, color:"#fff", fontSize:10, padding:"4px 8px", borderRadius:5, whiteSpace:"nowrap", zIndex:50, marginTop:3 }}>{sm[k]}</div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── DASHBOARD ─────────────────────────────────────────
  const totalBudget = projects.reduce((a,p)=>a+(p.budget||0),0);

  const dashView = (
    <div style={{ overflowY:"auto", WebkitOverflowScrolling:"touch", flex:1, padding: mob?"16px 14px 80px":tablet?"20px 20px":"24px 28px" }}>
      {/* Header área */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:C.dim, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>SECPLA / Recoleta</div>
          <div style={{ fontSize:mob?20:26, fontWeight:800, color:C.text, lineHeight:1.1 }}>Dashboard</div>
          {critical.length > 0 && <div style={{ marginTop:4, fontSize:11, color:C.red, fontWeight:700 }}>● {critical.length} alerta(s) crítica(s)</div>}
        </div>
        <SyncBar />
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)", gap:8, marginBottom:22 }}>
        {[
          { l:"Inversión", v:fCLP(totalBudget), sub:"CLP total", c:C.blue },
          { l:"Proyectos activos", v:projects.filter(p=>["En curso","Con alerta"].includes(p.status)).length+"/"+projects.length, sub:"en ejecución", c:C.green },
          { l:"Seguimientos", v:active.length, sub:`${critical.length} críticos`, c:critical.length>0?C.red:C.text },
          { l:"Cotizaciones", v:`${(cotiz.length>0?cotiz:COTIZ_SEED).filter(c=>c.estado==="cotizacion_recibida").length}/${COTIZ_SEED.length}`, sub:"SNSM 2025", c:C.text },
        ].map(({l,v,sub,c}) => (
          <div key={l} style={{ background:C.card, borderRadius:10, padding:"12px 14px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700, letterSpacing:0.5, marginBottom:5 }}>{l}</div>
            <div style={{ fontSize:mob?18:22, fontWeight:800, color:c, lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Layout: columna única en móvil, dos columnas en desktop */}
      <div style={{ display:mob||tablet?"block":"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <div>
          {/* Bandeja */}
          <section style={{ marginBottom:24 }}>
            <BandejaPanel bandeja={bandeja} follows={follows} onFollow={bandejaFollow} onDiscard={bandejaDiscard} onRefresh={()=>syncGmail(false)} loading={loadG} msg={sm.gmail&&sm.gmail!=="idle"?sm.gmail:""} />
          </section>
          {/* Seguimientos */}
          <section style={{ marginBottom:24 }}>
            <FollowsPanel follows={follows} projects={projects} onResolve={resolveFollow} onAdd={addFollow} />
          </section>
          {/* Solicitudes jefatura */}
          <section style={{ marginBottom:24 }}>
            <SectionTitle>Solicitudes de Jefatura</SectionTitle>
            {boss.filter(b=>b.status==="pendiente").map(b => {
              const fp = projects.find(p=>p.id===b.projectId);
              const uc = URGENCY_COLOR[b.urgency]||C.amber;
              return (
                <Card key={b.id} style={{ marginBottom:8, borderLeft:`3px solid ${uc}` }}>
                  <div style={{ display:"flex", gap:8, marginBottom:6 }}>
                    <Tag color={b.from.includes("Grace")?C.blue:C.text}>{b.from}</Tag>
                    <Tag color={uc}>{URGENCY_ICON[b.urgency]} {b.urgency}</Tag>
                    {fp && <Tag color={C.sub}>{fp.name.slice(0,20)}…</Tag>}
                  </div>
                  <div style={{ fontSize:13, color:C.text, lineHeight:1.4, marginBottom:8 }}>{b.task}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <a href={b.threadUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:"4px 10px", borderRadius:5, background:C.blue+"10", color:C.blue, textDecoration:"none", fontWeight:700, border:`1px solid ${C.blue}20` }}>✉ Gmail</a>
                    <Btn onClick={()=>toggleBoss(b.id)} small color={C.green}>✓ Completado</Btn>
                  </div>
                </Card>
              );
            })}
            {boss.filter(b=>b.status==="completado").length > 0 && (
              <details><summary style={{ fontSize:10, color:C.dim, cursor:"pointer", padding:"4px 0" }}>Ver completadas ({boss.filter(b=>b.status==="completado").length})</summary>
                {boss.filter(b=>b.status==="completado").map(b => (
                  <Card key={b.id} style={{ marginBottom:6, opacity:0.65 }}>
                    <div style={{ fontSize:11, color:C.green, fontWeight:700 }}>✓ {b.from}</div>
                    <div style={{ fontSize:11, color:C.sub, textDecoration:"line-through" }}>{b.task}</div>
                    <Btn onClick={()=>toggleBoss(b.id)} small outline color={C.sub} style={{ marginTop:6 }}>↩ Reabrir</Btn>
                  </Card>
                ))}
              </details>
            )}
          </section>
        </div>

        <div>
          {/* Cotizaciones SNSM */}
          <section style={{ marginBottom:24 }}>
            <CotizPanel cotiz={cotiz} loading={loadC} msg={sm.cotiz&&sm.cotiz!=="idle"?sm.cotiz:""} onRefresh={()=>syncCotiz(false)} fDate={fDate} />
          </section>
          {/* SIEVAP */}
          {(() => {
            const now = new Date();
            const start = new Date("2026-04-09T00:00:00"), deadline = new Date("2026-04-24T23:59:59"), total=15;
            const elapsed = Math.min(total, Math.max(0, Math.round((now-start)/86400000)));
            const remaining = Math.max(0, Math.round((deadline-now)/86400000));
            const overdue = now > deadline;
            const bc = overdue ? C.red : remaining<=3 ? "#C05621" : C.amber;
            return (
              <section style={{ marginBottom:24 }}>
                <Card style={{ borderLeft:`3px solid ${bc}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:bc, textTransform:"uppercase", letterSpacing:0.5, marginBottom:3 }}>
                        {overdue ? "⚠ Vencido" : remaining<=3 ? "⚠ Crítico" : "Plazo SIEVAP"}
                      </div>
                      <div style={{ fontSize:12, color:C.text, fontWeight:600 }}>SNSM25-STP-0113</div>
                      <div style={{ fontSize:11, color:C.sub }}>3ra instancia de observaciones</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:overdue?14:22, fontWeight:900, color:bc }}>{overdue?`+${Math.abs(remaining)}d`:remaining}</div>
                      <div style={{ fontSize:10, color:C.dim }}>días corridos</div>
                    </div>
                  </div>
                  <div style={{ background:C.border, borderRadius:8, height:6, overflow:"hidden", marginBottom:6 }}>
                    <div style={{ height:"100%", width:`${Math.min(100,Math.round(elapsed/total*100))}%`, background:bc, borderRadius:8 }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.dim, marginBottom:6 }}>
                    <span>{fDate("2026-04-09")}</span><span style={{ fontWeight:700, color:bc }}>{elapsed}/{total}d</span><span>{fDate("2026-04-24")}</span>
                  </div>
                  <a href="https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" target="_blank" rel="noreferrer" style={{ fontSize:11, color:C.blue, fontWeight:700 }}>✉ Ver correo →</a>
                </Card>
              </section>
            );
          })()}
          {/* Cartera */}
          <section style={{ marginBottom:24 }}>
            <SectionTitle action={<Btn onClick={()=>{setForm({name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""});setEditId(null);setShowForm(true);}} small outline color={C.blue}>+ Proyecto</Btn>}>
              Cartera de Proyectos
            </SectionTitle>
            {projects.map(p => (
              <Card key={p.id} onClick={()=>{setSel(p.id);setProjTab("overview");setView("project");}} style={{ marginBottom:8, borderLeft:`3px solid ${ST_COLOR[p.status]||C.sub}`, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginBottom:6 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text, lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
                      <StatusDot status={p.status} /><Tag color={ST_COLOR[p.status]||C.sub}>{p.status}</Tag>
                      <Tag color={C.sub}>{p.stage}</Tag>
                      <Tag color={C.blue}>{p.financier}</Tag>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:C.blue }}>{fCLP(p.budget)}</div>
                    {follows.filter(f=>f.projectId===p.id&&f.status==="activo").length > 0 && <div style={{ fontSize:10, color:C.red, marginTop:2 }}>● {follows.filter(f=>f.projectId===p.id&&f.status==="activo").length} seguim.</div>}
                  </div>
                </div>
                {p.aiSummary && <div style={{ fontSize:11, color:C.sub, lineHeight:1.4, borderLeft:`2px solid ${C.border}`, paddingLeft:8 }}>{p.aiSummary.slice(0,90)}…</div>}
                <div style={{ display:"flex", gap:10, marginTop:6, fontSize:10, color:C.dim }}>
                  <span>📄 {p.docs.length}</span><span>✉ {p.emails.length}</span><span>✅ {p.tasks.filter(t=>t.status==="pending").length}p</span>
                </div>
              </Card>
            ))}
          </section>
          {/* Reloj */}
          <section>
            <ClockPanel clockData={clockData} loading={loadR} onSync={()=>syncReloj(false)} clockMeta={clockMeta} />
          </section>
        </div>
      </div>
    </div>
  );

  // ── VISTA PROYECTO ─────────────────────────────────────
  const projTabs = [["overview","Resumen"],["licit","Licitación"],["notes","Notas"],["docs","Docs"],["tasks","Tareas"],["emails","Correos"]];

  const projView = proj && (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
      {/* Tab bar */}
      <div style={{ display:"flex", gap:2, padding:"10px 16px", background:C.card, borderBottom:`1px solid ${C.border}`, overflowX:"auto", flexShrink:0 }}>
        {projTabs.map(([k,l]) => {
          const badge = k==="docs"?proj.docs.length:k==="tasks"?proj.tasks.filter(t=>t.status==="pending").length:k==="emails"?proj.emails.length:null;
          return (
            <button key={k} onClick={()=>setProjTab(k)} style={{ padding:"6px 12px", borderRadius:6, border:"none", background:projTab===k?C.blue:"transparent", color:projTab===k?"#fff":C.sub, cursor:"pointer", fontSize:12, fontWeight:projTab===k?700:500, whiteSpace:"nowrap" }}>
              {l}{badge!=null&&badge>0&&<span style={{ marginLeft:4, fontSize:9, background:projTab===k?"#3b82f6":"#e2e8f0", color:projTab===k?"#fff":C.sub, borderRadius:8, padding:"1px 5px" }}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:mob?"14px 14px 80px":"20px 24px" }}>
        {projTab==="overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Card>
              <SectionTitle>Ficha del Proyecto</SectionTitle>
              {[["Estado",<span key="s"><StatusDot status={proj.status}/><Tag color={ST_COLOR[proj.status]||C.sub}>{proj.status}</Tag></span>],["Etapa",proj.stage],[`Presupuesto`,`${fCLP(proj.budget)} CLP`],["Financiamiento",`${proj.financier} / ${proj.program||"—"}`],["Vencimiento",fDate(proj.deadline)]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, gap:8 }}>
                  <span style={{ fontSize:12, color:C.sub }}>{k}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text, textAlign:"right" }}>{v}</span>
                </div>
              ))}
              {proj.codigoProyecto && <div style={{ marginTop:8, fontSize:11, color:C.sub, padding:"5px 8px", background:C.bg, borderRadius:5, fontFamily:"monospace" }}>{proj.codigoProyecto}{proj.codigoSIGE&&` · SIGE: ${proj.codigoSIGE}`}</div>}
              <Btn onClick={()=>{setForm({...proj,budget:proj.budget||""});setEditId(proj.id);setShowForm(true);}} outline color={C.sub} style={{ marginTop:12, width:"100%", justifyContent:"center" }}>✏ Editar</Btn>
            </Card>
            {proj.aiSummary && <Card><div style={{ fontSize:10, fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Resumen IA</div><p style={{ fontSize:12, color:C.text, lineHeight:1.7, margin:0 }}>{proj.aiSummary}</p></Card>}
            {proj.convenio && <Card>
              <SectionTitle>Convenio & Plazos</SectionTitle>
              {[["Vence ejecución",fDate(proj.convenio.plazoEjecucionFin)],["Vence convenio",fDate(proj.convenio.plazoConvenioFin)]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}><span style={{ fontSize:12, color:C.sub }}>{k}</span><span style={{ fontSize:12, fontWeight:700 }}>{v}</span></div>
              ))}
            </Card>}
            <Card><div style={{ fontSize:11, color:C.sub, lineHeight:1.6 }}>{proj.desc}</div></Card>
          </div>
        )}

        {projTab==="licit" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Card>
              <label style={LBL}>ID Licitación Mercado Público</label>
              <div style={{ display:"flex", gap:8 }}>
                <input value={proj.licitId||""} onChange={e=>setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,licitId:e.target.value}:p))} placeholder="Ej: 1431841-10-B226" style={{...INP,flex:1,fontFamily:"monospace"}} />
                <Btn onClick={()=>doLicit(proj)} disabled={!proj.licitId||licitLoad===proj.id} color={C.ink}>{licitLoad===proj.id?"···":"🔍"}</Btn>
              </div>
            </Card>
            {proj.licitData && (() => { const ld = proj.licitData; return (
              <Card>
                <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <Tag color={MPC_COLOR[ld.estado]||C.sub}>{ld.estado}</Tag>
                  {ld.nombre && <span style={{ fontSize:12, color:C.sub }}>{ld.nombre}</span>}
                </div>
                {ld.descripcion && <p style={{ fontSize:12, color:C.sub, margin:"0 0 10px", lineHeight:1.5, padding:"8px", background:C.bg, borderRadius:5 }}>{ld.descripcion}</p>}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7 }}>
                  {[["Cierre",fDate(ld.fechaCierre)],["Adjudicación",fDate(ld.fechaAdjudicacion)],["Monto",ld.monto||"—"]].map(([l,v])=>(
                    <div key={l} style={{ background:C.bg, borderRadius:6, padding:"8px 10px" }}><div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", marginBottom:2 }}>{l}</div><div style={{ fontSize:12, fontWeight:700 }}>{v}</div></div>
                  ))}
                </div>
                {ld.url && <a href={ld.url} target="_blank" rel="noreferrer" style={{ display:"block", marginTop:8, fontSize:11, color:C.blue }}>Ver en Mercado Público →</a>}
              </Card>
            ); })()}
          </div>
        )}

        {projTab==="notes" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Card>
              <label style={LBL}>Notas de gestión</label>
              <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} onBlur={saveNotes} rows={10} placeholder="Notas sobre gestiones, reuniones, pendientes…" style={{...INP,resize:"vertical",fontSize:12,lineHeight:1.6}} />
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <Btn onClick={saveNotes} color={C.green} small>💾 Guardar</Btn>
                <Btn onClick={doSummary} disabled={genSum||!notesDraft.trim()} color={C.blue} small>{genSum?"···":"✨ Resumen IA"}</Btn>
              </div>
            </Card>
            {proj.aiSummary && <Card style={{ borderLeft:`3px solid ${C.blue}` }}><p style={{ fontSize:12, color:C.text, lineHeight:1.7, margin:0 }}>{proj.aiSummary}</p></Card>}
          </div>
        )}

        {projTab==="docs" && (
          <div>
            <Btn onClick={()=>fileRef.current?.click()} disabled={extracting} color={C.blue} style={{ width:"100%", justifyContent:"center", marginBottom:14, padding:"11px 0" }}>{extracting?"⏳ Procesando…":"📎 Subir Documento (PDF / Imagen)"}</Btn>
            {proj.docs.length===0 && <div style={{ textAlign:"center", padding:40, color:C.dim, border:`1.5px dashed ${C.border}`, borderRadius:10, fontSize:12 }}>Sin documentos</div>}
            {proj.docs.map(d => { let ex={}; try{ex=JSON.parse(d.extracted||"{}");}catch{} return (
              <Card key={d.id} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div><div style={{ fontWeight:700, fontSize:13 }}>📄 {d.name}</div><div style={{ fontSize:10, color:C.dim }}>{d.docType} · {fDate(d.uploadedAt)}</div></div>
                  <button onClick={()=>delDoc(d.id)} style={{ background:"none", border:"none", color:C.border, cursor:"pointer", fontSize:18 }}>✕</button>
                </div>
                {d.summary && <p style={{ fontSize:12, color:C.sub, lineHeight:1.5, background:C.bg, padding:"8px 10px", borderRadius:5, margin:0 }}>{d.summary}</p>}
              </Card>
            ); })}
          </div>
        )}

        {projTab==="tasks" && (
          <div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Nueva tarea…" style={{...INP,flex:1}} />
              <Btn onClick={addTask} color={C.blue} style={{ padding:"0 16px", fontSize:18 }}>+</Btn>
            </div>
            {proj.tasks.length===0 && <div style={{ textAlign:"center", padding:40, color:C.dim, border:`1.5px dashed ${C.border}`, borderRadius:10, fontSize:12 }}>Sin tareas</div>}
            {["pending","done"].map(st => { const ts=proj.tasks.filter(t=>t.status===st); if(!ts.length)return null; return (
              <div key={st} style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:1, marginBottom:7 }}>{st==="pending"?"Pendientes":"Completadas"}</div>
                {ts.map(t => (
                  <div key={t.id} style={{ background:C.card, borderRadius:7, padding:"10px 12px", border:`1px solid ${C.border}`, marginBottom:6, display:"flex", alignItems:"center", gap:10, opacity:st==="done"?0.5:1 }}>
                    <input type="checkbox" checked={st==="done"} onChange={()=>toggleTask(t.id)} style={{ cursor:"pointer", width:16, height:16, accentColor:C.blue, flexShrink:0 }} />
                    <span style={{ fontSize:13, flex:1, textDecoration:st==="done"?"line-through":"none", color:st==="done"?C.dim:C.text }}>{t.text}</span>
                    <button onClick={()=>delTask(t.id)} style={{ background:"none", border:"none", color:C.border, cursor:"pointer", fontSize:16 }}>✕</button>
                  </div>
                ))}
              </div>
            ); })}
          </div>
        )}

        {projTab==="emails" && (
          <div>
            <Btn onClick={()=>setAddEmail(true)} color={C.blue} style={{ width:"100%", justifyContent:"center", marginBottom:14, padding:"11px 0" }}>+ Registrar Correo</Btn>
            {addEmail && (
              <Card style={{ marginBottom:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                  <div><label style={LBL}>Remitente</label><input value={emailForm.from} onChange={e=>setEmailForm(f=>({...f,from:e.target.value}))} style={INP}/></div>
                  <div><label style={LBL}>Fecha</label><input type="date" value={emailForm.date} onChange={e=>setEmailForm(f=>({...f,date:e.target.value}))} style={INP}/></div>
                </div>
                <div style={{ marginBottom:8 }}><label style={LBL}>Asunto</label><input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))} style={INP}/></div>
                <div style={{ marginBottom:10 }}><label style={LBL}>Contenido</label><textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))} rows={3} style={{...INP,resize:"vertical"}}/></div>
                <div style={{ display:"flex", gap:8 }}><Btn onClick={saveEmail} color={C.blue}>Guardar</Btn><Btn onClick={()=>setAddEmail(false)} outline color={C.sub}>Cancelar</Btn></div>
              </Card>
            )}
            {proj.emails.length===0 && !addEmail && <div style={{ textAlign:"center", padding:40, color:C.dim, border:`1.5px dashed ${C.border}`, borderRadius:10, fontSize:12 }}>Sin correos</div>}
            {proj.emails.map(e => (
              <Card key={e.id} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div><div style={{ fontWeight:700, fontSize:13 }}>✉ {e.subject}</div><div style={{ fontSize:10, color:C.dim, marginTop:2 }}>De: {e.from} · {fDate(e.date)}</div></div>
                  <button onClick={()=>delEmail(e.id)} style={{ background:"none", border:"none", color:C.border, cursor:"pointer", fontSize:18 }}>✕</button>
                </div>
                {e.body && <p style={{ fontSize:12, color:C.sub, marginTop:8, lineHeight:1.5, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>{e.body}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── CHAT ──────────────────────────────────────────────
  const chatView = (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
      <div style={{ padding:"8px 14px", background:C.card, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {["¿Qué urgencias tengo hoy?","¿Qué empresas no cotizaron SNSM?","Resumen p5","Días extras acumulados"].map(q => (
            <button key={q} onClick={()=>setChatIn(q)} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}`, cursor:"pointer", color:C.sub }}>{q}</button>
          ))}
        </div>
      </div>
      <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"88%", padding:"10px 13px", borderRadius:10, background:m.role==="user"?C.ink:C.card, color:m.role==="user"?"#fff":C.text, fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap", border:m.role==="user"?"none":`1px solid ${C.border}` }}>{m.content}</div>
          </div>
        ))}
        {chatLoad && <div style={{ display:"flex" }}><div style={{ padding:"10px 13px", borderRadius:10, background:C.card, fontSize:12, color:C.dim, border:`1px solid ${C.border}` }}>···</div></div>}
      </div>
      <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, flexShrink:0, paddingBottom:mob?"calc(10px + env(safe-area-inset-bottom))":"10px" }}>
        <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()} placeholder="Pregunta sobre tu cartera…" style={{...INP,flex:1}} />
        <Btn onClick={sendChat} disabled={chatLoad} color={C.ink} style={{ padding:"0 14px", fontSize:16 }}>→</Btn>
      </div>
    </div>
  );

  // ── MODAL PROYECTO ─────────────────────────────────────
  const modal = showForm && (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:mob?"flex-end":"center", justifyContent:"center", zIndex:300 }}>
      <div style={{ background:C.card, borderRadius:mob?"16px 16px 0 0":"12px", padding:20, width:mob?"100%":"480px", maxHeight:"90vh", overflowY:"auto", boxSizing:"border-box" }}>
        <div style={{ fontWeight:800, fontSize:16, color:C.text, marginBottom:16 }}>{editId?"Editar Proyecto":"Nuevo Proyecto"}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
          <div><label style={LBL}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={INP} /></div>
          <div><label style={LBL}>Presupuesto (CLP)</label><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={INP} /></div>
          {form.budget && Number(form.budget)>0 && <div style={{ fontSize:12, color:C.blue, fontWeight:700, padding:"4px 8px", background:C.blue+"10", borderRadius:5 }}>→ {fCLP(Number(form.budget))}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={LBL}>Financiamiento</label><select value={form.financier} onChange={e=>setForm(f=>({...f,financier:e.target.value}))} style={INP}>{FINANCIERS.map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={LBL}>Vencimiento</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={INP}/></div>
          </div>
          <div><label style={LBL}>Programa / Fondo</label><input value={form.program||""} onChange={e=>setForm(f=>({...f,program:e.target.value}))} style={INP} /></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={LBL}>Etapa</label><select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={INP}>{STAGES.map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={LBL}>Estado</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={INP}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></div>
          </div>
          <div><label style={LBL}>ID Licitación MP</label><input value={form.licitId||""} onChange={e=>setForm(f=>({...f,licitId:e.target.value}))} style={{...INP,fontFamily:"monospace"}} placeholder="1431841-10-B226"/></div>
          <div><label style={LBL}>Descripción</label><textarea value={form.desc||""} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} rows={3} style={{...INP,resize:"vertical"}}/></div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={()=>{setShowForm(false);setEditId(null);}} outline color={C.sub} style={{ flex:1, justifyContent:"center" }}>Cancelar</Btn>
          {editId && <Btn onClick={()=>{if(window.confirm("¿Eliminar?")){ setProjects(p=>p.filter(x=>x.id!==editId)); setShowForm(false); setEditId(null); setSel(null); setView("dash"); }}} color={C.red} style={{ flex:0 }}>🗑</Btn>}
          <Btn onClick={()=>{
            if (!form.name?.trim()) return;
            const p = {...form, id:editId||uid(), budget:parseFloat(form.budget)||0, docs:form.docs||[], emails:form.emails||[], tasks:form.tasks||[], notes:form.notes||"", aiSummary:form.aiSummary||"", licitData:form.licitData||null, licitChecked:form.licitChecked||""};
            setProjects(prev => editId ? prev.map(x=>x.id===editId?p:x) : [...prev,p]);
            setSel(p.id); setProjTab("overview"); setView("project"); setShowForm(false); setEditId(null);
          }} color={C.blue} style={{ flex:1, justifyContent:"center" }}>Guardar</Btn>
        </div>
      </div>
    </div>
  );

  // ── LAYOUT ────────────────────────────────────────────
  const desktopSidebar = !mob && !tablet && (
    <div style={{ width:220, background:C.ink, display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
      <div style={{ padding:"16px 10px 8px" }}>
        <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:2, padding:"0 8px" }}>SECPLA</div>
        <div style={{ fontSize:14, color:"#e2e8f0", fontWeight:800, padding:"0 8px", marginBottom:12 }}>Recoleta</div>
        <button onClick={()=>{setView("dash");setSel(null);}} style={{ width:"100%", padding:"8px 10px", borderRadius:7, background:view==="dash"&&!sel?"#1e3a5f":"transparent", color:view==="dash"&&!sel?"#93c5fd":"#64748b", border:"none", cursor:"pointer", textAlign:"left", fontSize:12, fontWeight:600, marginBottom:2 }}>◈ Dashboard</button>
        <button onClick={()=>setView("chat")} style={{ width:"100%", padding:"8px 10px", borderRadius:7, background:view==="chat"?"#1e3a5f":"transparent", color:view==="chat"?"#93c5fd":"#64748b", border:"none", cursor:"pointer", textAlign:"left", fontSize:12, fontWeight:600 }}>◉ Asistente IA</button>
      </div>
      {active.length > 0 && (
        <div style={{ margin:"0 10px 8px", padding:"8px 10px", background:"#7f1d1d20", borderRadius:7, border:"1px solid #ef444420" }}>
          <div style={{ fontSize:9, color:"#fca5a5", fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>Seguimientos</div>
          <div style={{ fontSize:11, color:"#ef4444" }}>{critical.length > 0 ? `● ${critical.length} crítico(s)` : ""}</div>
          <div style={{ fontSize:10, color:"#94a3b8" }}>{active.length} activos</div>
        </div>
      )}
      <div style={{ padding:"0 10px", flex:1 }}>
        <div style={{ fontSize:9, color:"#334155", fontWeight:700, textTransform:"uppercase", letterSpacing:1, padding:"8px 2px 5px" }}>Proyectos</div>
        {projects.map(p => (
          <button key={p.id} onClick={()=>{setSel(p.id);setProjTab("overview");setView("project");}} style={{ width:"100%", padding:"8px 10px", borderRadius:6, background:sel===p.id?"#1e3a5f":"transparent", border:sel===p.id?"1px solid #1d4ed840":"1px solid transparent", cursor:"pointer", textAlign:"left", marginBottom:3 }}>
            <div style={{ fontSize:11, fontWeight:sel===p.id?700:400, color:sel===p.id?"#e2e8f0":"#94a3b8", lineHeight:1.3, marginBottom:3 }}>{p.name}</div>
            <div style={{ display:"flex", gap:4 }}>
              <span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:(ST_COLOR[p.status]||C.sub)+"25", color:ST_COLOR[p.status]||C.sub, fontWeight:700 }}>{p.status}</span>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding:"10px" }}><Btn onClick={()=>{setForm({name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""});setEditId(null);setShowForm(true);}} color={"#1d4ed8"} style={{ width:"100%", justifyContent:"center", fontSize:11 }}>+ Proyecto</Btn></div>
    </div>
  );

  const mobileHeader = (
    <div style={{ background:C.ink, color:"#fff", padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {(view==="project"||view==="chat") && <button onClick={()=>{setView("dash");setSel(null);}} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", padding:0 }}>←</button>}
        <div>
          {view==="project"&&proj ? (
            renaming===proj.id ? (
              <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onBlur={()=>{if(renameVal.trim())setProjects(p=>p.map(x=>x.id===renaming?{...x,name:renameVal.trim()}:x));setRenaming(null);}} onKeyDown={e=>{if(e.key==="Enter"&&renameVal.trim()){setProjects(p=>p.map(x=>x.id===renaming?{...x,name:renameVal.trim()}:x));setRenaming(null);}}} style={{ fontSize:14, fontWeight:800, background:"transparent", border:"none", borderBottom:"2px solid #3b82f6", color:"#fff", outline:"none" }} />
            ) : <div onClick={()=>{setRenaming(proj.id);setRenameVal(proj.name);}} style={{ fontSize:14, fontWeight:800, cursor:"pointer" }}>{proj.name.slice(0,28)}{proj.name.length>28?"…":""}</div>
          ) : (
            <div style={{ fontSize:15, fontWeight:800 }}>SECPLA</div>
          )}
          {critical.length>0&&view!=="project"&&<div style={{ fontSize:10, color:"#fca5a5" }}>● {critical.length} crítica(s)</div>}
        </div>
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {view==="project"&&proj&&(<><input ref={fileRef} type="file" accept=".pdf,image/*" onChange={uploadDoc} style={{ display:"none" }}/><Btn onClick={()=>fileRef.current?.click()} disabled={extracting} color={"#1e3a5f"} style={{ padding:"6px 10px", fontSize:11 }}>{extracting?"⏳":"📎"}</Btn></>)}
        <Btn onClick={()=>setView(v=>v==="chat"?"dash":"chat")} color={view==="chat"?C.blue:"#1e293b"} style={{ padding:"6px 10px", fontSize:12 }}>🤖</Btn>
      </div>
    </div>
  );

  const desktopHeader = !mob && (
    <div style={{ background:C.ink, color:"#fff", padding:"11px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {view==="project"&&proj&&<button onClick={()=>{setView("dash");setSel(null);}} style={{ background:"none", border:"none", color:"#64748b", fontSize:18, cursor:"pointer" }}>←</button>}
        {view==="project"&&proj ? (
          renaming===proj.id ? (
            <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={e=>{if(e.key==="Enter")commitRename();if(e.key==="Escape")setRenaming(null);}} style={{ fontSize:15, fontWeight:800, background:"transparent", border:"none", borderBottom:"2px solid #3b82f6", color:"#fff", outline:"none" }} />
          ) : <div onClick={()=>{setRenaming(proj.id);setRenameVal(proj.name);}} style={{ fontSize:15, fontWeight:800, cursor:"pointer" }}>{proj.name} <span style={{ fontSize:11, color:"#475569" }}>✏</span></div>
        ) : (
          <div style={{ fontSize:15, fontWeight:800 }}>{tablet?"SECPLA":""}</div>
        )}
        {critical.length>0&&view!=="project"&&<div style={{ fontSize:11, color:"#fca5a5" }}>● {critical.length} crítica(s)</div>}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {view==="project"&&proj&&(<><input ref={fileRef} type="file" accept=".pdf,image/*" onChange={uploadDoc} style={{ display:"none" }}/><Btn onClick={()=>fileRef.current?.click()} disabled={extracting} color={"#1e3a5f"} style={{ padding:"7px 12px", fontSize:12 }}>{extracting?"⏳ Procesando":"📎 Doc"}</Btn></>)}
        <Btn onClick={()=>setView(v=>v==="chat"?"dash":"chat")} color={view==="chat"?C.blue:"#1e293b"} style={{ padding:"7px 14px", fontSize:12 }}>🤖 {view==="chat"?"Cerrar":"Asistente"}</Btn>
      </div>
    </div>
  );

  const mobileNav = mob && (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.card, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)" }}>
      {[["dash","◈","Inicio"],["project","◫","Proyectos"],["chat","◉","Asistente"]].map(([v,ic,lbl]) => (
        <button key={v} onClick={()=>{if(v==="project"){setSel(null);setView("dash");}else setView(v);}} style={{ flex:1, padding:"10px 4px 8px", background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <span style={{ fontSize:18 }}>{ic}</span>
          <span style={{ fontSize:10, fontWeight:view===v?700:400, color:view===v?C.blue:C.dim }}>{lbl}</span>
          {view===v && <div style={{ width:18, height:2, background:C.blue, borderRadius:2 }}/>}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.bg, overflow:"hidden", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      {mob ? mobileHeader : desktopHeader}
      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
        {desktopSidebar}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {mob ? (
            <div style={{ flex:1, overflow:"hidden" }}>
              {view==="dash"&&dashView}
              {view==="project"&&proj&&projView}
              {view==="chat"&&chatView}
            </div>
          ) : (
            <>
              {(view==="dash"||(!view))&&<div style={{ flex:1, overflow:"hidden" }}>{dashView}</div>}
              {view==="project"&&proj&&projView}
              {view==="chat"&&(
                <div style={{ width:360, borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
                  <div style={{ padding:"10px 14px", background:C.ink, color:"#fff", flexShrink:0 }}>
                    <div style={{ fontWeight:700, fontSize:12 }}>◉ Asistente SECPLA</div>
                    <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>Cartera · Seguimientos · Cotizaciones</div>
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
