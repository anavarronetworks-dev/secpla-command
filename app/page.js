"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * SECPLA Command v6
 *
 * PERSISTENCIA CROSS-DEVICE:
 *   Escrituras → /api/state (backend KV)
 *   Lecturas   → /api/state con fallback a localStorage
 *   Resultado  → cambios visibles desde móvil, tablet y desktop
 *
 * SIN MENSAJES DE CREDENCIALES:
 *   Si Gmail no está configurado → datos de semilla, sin errores visibles
 *
 * SCHEDULER:
 *   L-V: gmail cada hora 08-18 CLT
 *   S-D: 1 ejecución a las 10:00 CLT
 */

// ══════════════════════════════════════════════════════
// PERSISTENCIA CROSS-DEVICE
// ══════════════════════════════════════════════════════
const DB_VER = "v6";

// localStorage como caché local (lectura rápida)
function lsGet(k, def) {
  try { const r = localStorage.getItem(`sc_${DB_VER}_${k}`); return r ? JSON.parse(r) : def; } catch { return def; }
}
function lsSet(k, v) {
  try { localStorage.setItem(`sc_${DB_VER}_${k}`, JSON.stringify(v)); } catch {}
}

// Backend KV para persistencia real cross-device
async function remoteGet(key) {
  try {
    const r = await fetch(`/api/state?key=${encodeURIComponent(key)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.value ?? null;
  } catch { return null; }
}
async function remoteSet(key, value) {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch {}
}

// Hook: lee del KV al montar, escribe a ambos en cada cambio
function useDB(key, initVal) {
  const init = typeof initVal === "function" ? initVal : () => initVal;
  const [val, setVal] = useState(() => lsGet(key, init()));
  const loadedRef = useRef(false);

  // Cargar desde backend al montar (una sola vez)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    remoteGet(key).then(remote => {
      if (remote != null) {
        setVal(remote);
        lsSet(key, remote);
      }
    });
  }, [key]);

  const set = useCallback((updater) => {
    setVal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      lsSet(key, next);
      remoteSet(key, next); // guarda en backend → visible desde otros dispositivos
      return next;
    });
  }, [key]);

  // Sync entre pestañas del mismo dispositivo
  useEffect(() => {
    const h = e => {
      if (e.key === `sc_${DB_VER}_${key}` && e.newValue) {
        try { setVal(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [key]);

  return [val, set];
}

// ══════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════
async function api(body) {
  try {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, data: d };
  } catch(e) { return { ok: false, data: { error: true, errorMessage: e.message } }; }
}

function pj(s, d) {
  try { return JSON.parse((s||"").replace(/```json|```/g,"").trim()); }
  catch { return d; }
}

// ══════════════════════════════════════════════════════
// DESIGN SYSTEM — colores minimalistas
// ══════════════════════════════════════════════════════
const C = {
  bg:     "#F8F7F4",
  card:   "#FFFFFF",
  border: "#E5E1D8",
  text:   "#18160F",
  sub:    "#6B6456",
  dim:    "#A39B8E",
  blue:   "#1A4FD6",
  green:  "#0C7A4E",
  amber:  "#B04D00",
  red:    "#BE2A2A",
  ink:    "#111827",
};

const uid = () => Math.random().toString(36).slice(2,8);
const fCLP = n => !n ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`;
const fDate = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const toMin = t => { if(!t)return null; const[h,m]=t.split(":").map(Number); return h*60+m; };
const fMin = m => { const a=Math.abs(m),h=Math.floor(a/60),mn=a%60; return h>0?`${h}h ${mn}m`:`${mn}m`; };
const isFri = d => new Date(d+"T12:00:00").getDay()===5;
const jorn = d => isFri(d)?480:540;
const today = () => new Date().toISOString().slice(0,10);

const ST = { "En curso":C.blue, "Pendiente":C.amber, "Detenido":C.red, "Completado":C.green, "Con alerta":"#C05C00" };
const UG = { "crítica":C.red, "alta":C.amber, "media":"#6B6456" };

const MONTHS = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STAGES = ["Formulación","Diseño","Licitación","Adjudicación","Ejecución","Recepción","Completado","Archivado"];
const STATUSES = ["En curso","Pendiente","Detenido","Completado","Con alerta"];
const FINANCIERS = ["GORE","SPD","Municipal","MININT","FNDR","Otro"];

// ══════════════════════════════════════════════════════
// DATOS SEMILLA
// ══════════════════════════════════════════════════════
const SEED_P = [
  { id:"p1",name:"Habilitación Tecnológica 6ta Comisaría",budget:40000000,stage:"Formulación",status:"En curso",deadline:"",financier:"SPD",program:"FNSP",desc:"Habilitación sala televigilancia Sexta Comisaría. ID 1431841-10-LE25. Pendiente ITS y empalme ENEL.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[],codigoProyecto:"1431841-10-LE25" },
  { id:"p2",name:"Integración Cámaras de Televigilancia Recoleta",budget:100000000,stage:"Licitación",status:"En curso",deadline:"",financier:"SPD",program:"SNSM 2025",desc:"7 postaciones 15m, PTZ, reconocimiento facial, ANPR. Ficha modificación plazo en trámite SPD.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[],codigoProyecto:"SNSM25-STP-0113",codigoSIGE:"22004928" },
  { id:"p3",name:"Sistemas CCTV Centros Culturales",budget:26000000,stage:"Licitación",status:"En curso",deadline:"",financier:"SPD",program:"FNSP",desc:"CDP N°79 emitido. Pendiente publicación MP.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[],codigoProyecto:"CDP N°79" },
  { id:"p4",name:"Cámaras de Televigilancia UV N°32",budget:914371153,stage:"Adjudicación",status:"En curso",deadline:"2026-04-30",financier:"GORE RM",program:"FNDR",desc:"Adjudicación 30 abril. Pendiente BNUP.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[],codigoProyecto:"BIP 40066179-0" },
  { id:"p5",name:"Sala de Monitoreo Edificio Consistorial",budget:100000000,stage:"Licitación",status:"Con alerta",deadline:"2026-06-30",financier:"SPD",program:"SNSM 2023",desc:"LP25 desierta, LP26 revocada. Trato directo activo.",notes:"",aiSummary:"",licitId:"1431841-68-LP25",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[],codigoProyecto:"SNSM23-STP-0039",codigoSIGE:"21460117",convenio:{plazoEjecucionFin:"2026-06-30",plazoConvenioFin:"2026-09-30"} },
];

const SEED_FOLLOWS = [
  { id:"f1",projectId:"p5",urgency:"crítica",subject:"2do Trato Directo — Sala Monitoreo Consistorial",to:"Securitas / Prosegur",context:"2 correos rebotaron. Buscar emails correctos.",sentDate:"2026-04-10",daysPending:3,status:"activo",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d73316aebeb956" },
  { id:"f2",projectId:"p5",urgency:"alta",subject:"Factibilidad Torre Telecom — Sala Monitoreo",to:"Francisco Moscoso",context:"Pronunciamiento sobre repetidor 5GHz.",sentDate:"2026-04-01",daysPending:12,status:"activo",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d4aa05342a51ac" },
  { id:"f3",projectId:"p2",urgency:"alta",subject:"Modificación Plazo SNSM23-STP-0039 → SPD",to:"Osvaldo Muñoz (SPD)",context:"Ficha subsanada enviada 7 abril. Sin confirmación.",sentDate:"2026-04-07",daysPending:6,status:"activo",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d1ab5d03fb53ce" },
  { id:"f4",projectId:"p3",urgency:"alta",subject:"CCTV Centros Culturales — iniciar licitación MP",to:"María Paz Juica / Alvaro Porzio",context:"CDP N°79 emitido. Pendiente ingreso MP.",sentDate:"2026-04-01",daysPending:12,status:"activo",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d2665ac1e575ac" },
  { id:"f5",projectId:"p4",urgency:"media",subject:"Cámaras UV N°32 — Certificados BNUP",to:"María Paz Juica",context:"Solo Certificados de Número. Adjudicación 30 abril.",sentDate:"2026-04-13",daysPending:0,status:"activo",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4" },
];

const SEED_BOSS = [
  { id:"b1",from:"María Paz Juica",projectId:"p5",urgency:"crítica",task:"Presentación diagnóstico 3 salas de cámaras para reunión Alcaldía.",requestDate:"2026-04-10",status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d790219c18994c" },
  { id:"b2",from:"María Paz Juica",projectId:"p2",urgency:"alta",task:"Subsanar observaciones SNSM25-STP-0113. Plazo 15 días desde 9 abril.",requestDate:"2026-04-09",status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" },
  { id:"b3",from:"María Paz Juica",projectId:"p2",urgency:"alta",task:"Confirmar recepción Certificados BNUP proyecto SNSM2025.",requestDate:"2026-04-13",status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4" },
  { id:"b4",from:"María Paz Juica",projectId:"p5",urgency:"media",task:"Gestionar Decreto modifica Comisión Evaluadora — licitación desierta.",requestDate:"2026-04-10",status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d3f351893aaf74" },
  { id:"b5",from:"Grace Arcos",projectId:"p5",urgency:"alta",task:"Reunión Opciones Sala Televigilancia — 15 abril 13:00 hrs.",requestDate:"2026-04-08",status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d6dc78c627480e" },
  { id:"b6",from:"Grace Arcos",projectId:"p1",urgency:"alta",task:"Seguimiento empalme eléctrico 6ta Comisaría — reunión 15 abril.",requestDate:"2026-04-13",status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d892c228474fcc" },
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

const COTIZ_SEED = [
  { empresa:"Scharfstein",   email:"smerino@scharfstein.cl",       estado:"sin_respuesta_urgente",totalEnviados:3,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Bionic Vision", email:"lvalero@bionicvision.cl",      estado:"respondido",           totalEnviados:2,totalRecibidos:1,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Grupo VSM",     email:"comunicaciones@grupovsm.cl",   estado:"sin_respuesta",        totalEnviados:1,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"RockTech",      email:"fabiana.rifo@rocktechla.com",  estado:"sin_respuesta",        totalEnviados:1,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Securitas",     email:"comercial@securitas.cl",       estado:"email_rebotado",       totalEnviados:1,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Prosegur",      email:"ventas.empresas@prosegur.com", estado:"email_rebotado",       totalEnviados:1,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Verkauf",       email:"@verkauf.cl",                  estado:"sin_enviar",           totalEnviados:0,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Dahua",         email:"@dahua.com",                   estado:"sin_enviar",           totalEnviados:0,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
  { empresa:"Hikvision",     email:"@hikvision.com",               estado:"sin_enviar",           totalEnviados:0,totalRecibidos:0,firstSent:null,lastSent:null,lastRecv:null,timeline:[] },
];

const CST = {
  sin_enviar:            { dot:"○", label:"Sin enviar",        color:C.dim },
  enviado:               { dot:"●", label:"Enviado",           color:C.blue },
  sin_respuesta:         { dot:"◆", label:"Sin respuesta",     color:C.amber },
  sin_respuesta_urgente: { dot:"⚠", label:"Urgente",           color:C.red },
  respondido:            { dot:"●", label:"Respondió",         color:C.green },
  cotizacion_recibida:   { dot:"✓", label:"Cotiz. recibida",   color:C.green },
  email_rebotado:        { dot:"✕", label:"Email rebotado",    color:C.red },
};

// ══════════════════════════════════════════════════════
// COMPONENTES BASE
// ══════════════════════════════════════════════════════
function useW(){const[w,s]=useState(900);useEffect(()=>{s(window.innerWidth);const h=()=>s(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return w;}

const Div = ({ch,...p})=><div {...p}>{ch}</div>;

function Card({children,style={},onClick}){
  return(
    <div onClick={onClick} style={{background:C.card,borderRadius:8,border:`1px solid ${C.border}`,padding:"12px 14px",...style,cursor:onClick?"pointer":"default"}}>
      {children}
    </div>
  );
}

function Btn({children,onClick,disabled,color=C.ink,outline,small,full,style:sx={}}){
  return(
    <button onClick={onClick} disabled={disabled} style={{
      display:"inline-flex",alignItems:"center",gap:5,cursor:disabled?"not-allowed":"pointer",
      borderRadius:6,fontWeight:600,fontSize:small?11:12,padding:small?"4px 10px":"8px 14px",
      border:outline?`1.5px solid ${color}`:"none",
      background:outline?"transparent":color,
      color:outline?color:"#fff",
      opacity:disabled?.5:1,width:full?"100%":undefined,
      justifyContent:full?"center":undefined,...sx,
    }}>{children}</button>
  );
}

const INP={padding:"9px 11px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",background:"#fff",color:C.text,fontFamily:"inherit"};
const LBL={fontSize:10,fontWeight:700,letterSpacing:0.5,color:C.sub,display:"block",marginBottom:4,textTransform:"uppercase"};

function Tag({children,color=C.blue}){
  return<span style={{display:"inline-flex",alignItems:"center",padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,color,background:color+"12",border:`1px solid ${color}20`}}>{children}</span>;
}

function Sect({title,action,children,mb=20}){
  return(
    <div style={{marginBottom:mb}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:C.sub}}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// BANDEJA
// ══════════════════════════════════════════════════════
function Bandeja({bandeja,follows,onFollow,onDiscard,onRefresh,loading}){
  const[exp,setExp]=useState(null);
  const discarded=lsGet("disc_v6",[]);
  const followedT=new Set((follows||[]).map(f=>f.threadId).filter(Boolean));
  const visible=(bandeja||[]).filter(m=>!discarded.includes(m.threadId)&&!followedT.has(m.threadId));
  const dc=d=>d>7?C.red:d>3?C.amber:C.green;

  return(
    <Sect title={`Bandeja${visible.length>0?" — "+visible.length+" correos":""}`}
      action={<Btn onClick={onRefresh} disabled={loading} small outline color={C.blue}>{loading?"···":"↻"}</Btn>}
    >
      {visible.length===0&&!loading&&(
        <Card style={{textAlign:"center",padding:"18px 0"}}>
          <div style={{fontSize:11,color:C.sub}}>Bandeja limpia</div>
        </Card>
      )}
      {visible.map(m=>{
        const isE=exp===m.threadId;
        return(
          <Card key={m.threadId} style={{marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:isE?"normal":"nowrap",marginBottom:3}}>
                  {m.subject}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:C.sub}}>{(m.fromName||"").slice(0,35)}</span>
                  <span style={{fontSize:10,padding:"1px 7px",borderRadius:8,background:dc(m.daysSinceLastMsg)+"14",color:dc(m.daysSinceLastMsg),fontWeight:700}}>
                    {m.daysSinceLastMsg===0?"hoy":`${m.daysSinceLastMsg}d`}
                  </span>
                </div>
                {isE&&m.snippet&&<div style={{marginTop:6,fontSize:11,color:C.sub,lineHeight:1.5}}>{m.snippet}</div>}
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <button onClick={()=>setExp(isE?null:m.threadId)} style={{fontSize:9,padding:"3px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",color:C.dim}}>{isE?"▲":"▼"}</button>
                {m.threadUrl&&<a href={m.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:9,padding:"3px 6px",borderRadius:4,background:C.blue+"10",color:C.blue,textDecoration:"none",fontWeight:700,border:`1px solid ${C.blue}20`}}>↗</a>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <Btn onClick={()=>onFollow(m)} small color={C.blue}>📌 Seguir</Btn>
              <Btn onClick={()=>onDiscard(m.threadId)} small outline color={C.dim}>Descartar</Btn>
            </div>
          </Card>
        );
      })}
    </Sect>
  );
}

// ══════════════════════════════════════════════════════
// SEGUIMIENTOS
// ══════════════════════════════════════════════════════
function Seguimientos({follows,projects,onResolve,onAdd}){
  const[showForm,setShowForm]=useState(false);
  const[nf,setNf]=useState({projectId:"",urgency:"media",subject:"",to:"",context:"",threadUrl:""});
  const[showDone,setShowDone]=useState(false);
  const active=[...follows.filter(f=>f.status==="activo")].sort((a,b)=>({crítica:0,alta:1,media:2}[a.urgency]??3)-({crítica:0,alta:1,media:2}[b.urgency]??3));
  const done=follows.filter(f=>f.status==="resuelto");

  const save=()=>{
    if(!nf.subject||!nf.to)return;
    onAdd({id:"m_"+uid(),...nf,sentDate:today(),daysPending:0,status:"activo",manual:true});
    setNf({projectId:"",urgency:"media",subject:"",to:"",context:"",threadUrl:""});
    setShowForm(false);
  };

  return(
    <Sect title={`Seguimientos${active.length>0?" — "+active.length:""}`}
      action={<Btn onClick={()=>setShowForm(x=>!x)} small outline color={showForm?C.sub:C.blue}>{showForm?"✕":"+ Agregar"}</Btn>}
    >
      {showForm&&(
        <Card style={{marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={LBL}>Proyecto</label>
              <select value={nf.projectId} onChange={e=>setNf(x=>({...x,projectId:e.target.value}))} style={INP}>
                <option value="">—</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name.slice(0,30)}</option>)}
              </select>
            </div>
            <div><label style={LBL}>Urgencia</label>
              <select value={nf.urgency} onChange={e=>setNf(x=>({...x,urgency:e.target.value}))} style={INP}>
                <option value="crítica">Crítica</option><option value="alta">Alta</option><option value="media">Media</option>
              </select>
            </div>
          </div>
          <div style={{marginBottom:8}}><label style={LBL}>Asunto *</label><input value={nf.subject} onChange={e=>setNf(x=>({...x,subject:e.target.value}))} style={INP}/></div>
          <div style={{marginBottom:8}}><label style={LBL}>Destinatario *</label><input value={nf.to} onChange={e=>setNf(x=>({...x,to:e.target.value}))} style={INP}/></div>
          <div style={{marginBottom:8}}><label style={LBL}>Contexto</label><textarea value={nf.context} onChange={e=>setNf(x=>({...x,context:e.target.value}))} rows={2} style={{...INP,resize:"vertical"}}/></div>
          <div style={{marginBottom:10}}><label style={LBL}>URL Gmail</label><input value={nf.threadUrl} onChange={e=>setNf(x=>({...x,threadUrl:e.target.value}))} placeholder="https://mail.google.com/..." style={INP}/></div>
          <Btn onClick={save} color={C.blue}>Guardar</Btn>
        </Card>
      )}
      {active.length===0&&<Card style={{textAlign:"center",padding:"16px 0"}}><div style={{fontSize:11,color:C.sub}}>Sin seguimientos activos</div></Card>}
      {active.map(f=>{
        const fp=projects.find(p=>p.id===f.projectId);
        const uc=UG[f.urgency]||C.dim;
        return(
          <Card key={f.id} style={{marginBottom:6,borderLeft:`3px solid ${uc}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3,lineHeight:1.3}}>
                  <span style={{color:uc,marginRight:5,fontSize:11}}>{f.urgency==="crítica"?"●":f.urgency==="alta"?"◆":"▲"}</span>
                  {f.subject}{f.manual&&<span style={{marginLeft:5,fontSize:9,color:C.blue}}>manual</span>}
                </div>
                <div style={{fontSize:11,color:C.sub}}>→ {f.to}</div>
                {fp&&<div style={{marginTop:3}}><Tag color={C.sub}>{fp.name.slice(0,28)}</Tag></div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:uc}}>{f.daysPending}d</div>
                <div style={{fontSize:10,color:C.dim}}>{fDate(f.sentDate)}</div>
              </div>
            </div>
            {f.context&&<div style={{fontSize:11,color:C.sub,lineHeight:1.5,padding:"5px 8px",background:C.bg,borderRadius:4,marginBottom:8}}>{f.context}</div>}
            <div style={{display:"flex",gap:5}}>
              {f.threadUrl&&<a href={f.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:11,padding:"4px 10px",borderRadius:5,background:C.blue+"10",color:C.blue,textDecoration:"none",fontWeight:700,border:`1px solid ${C.blue}20`}}>✉ Gmail</a>}
              <Btn onClick={()=>onResolve(f.id)} small color={C.green}>✓ Resuelto</Btn>
            </div>
          </Card>
        );
      })}
      {done.length>0&&(
        <button onClick={()=>setShowDone(x=>!x)} style={{fontSize:10,color:C.dim,background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>
          {showDone?"▲":"▼"} {done.length} resuelto(s)
        </button>
      )}
      {showDone&&done.slice(0,10).map(f=>(
        <Card key={f.id} style={{marginBottom:4,opacity:.65}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:C.sub,textDecoration:"line-through"}}>{f.subject}</div>
              <div style={{fontSize:10,color:C.dim}}>→ {f.to}</div>
            </div>
            <Btn onClick={()=>onResolve(f.id,"reopen")} small outline color={C.sub}>↩</Btn>
          </div>
        </Card>
      ))}
    </Sect>
  );
}

// ══════════════════════════════════════════════════════
// COTIZACIONES
// ══════════════════════════════════════════════════════
function Cotizaciones({cotiz,loading,onRefresh}){
  const[open,setOpen]=useState(null);
  const[filter,setFilter]=useState("all");
  const data=cotiz?.length>0?cotiz:COTIZ_SEED;
  const filt=filter==="all"?data:data.filter(c=>c.estado===filter);
  const conC=data.filter(c=>c.estado==="cotizacion_recibida").length;
  const urg=data.filter(c=>["sin_respuesta_urgente","email_rebotado"].includes(c.estado)).length;

  return(
    <Sect title="Cotizaciones SNSM 2025" action={<Btn onClick={onRefresh} disabled={loading} small outline color={C.blue}>{loading?"···":"↻"}</Btn>}>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {[["all",`Todas (${data.length})`],["cotizacion_recibida",`✓ ${conC}`],["sin_respuesta_urgente",`⚠ ${urg}`],["sin_enviar",`○ ${data.filter(c=>c.estado==="sin_enviar").length}`]].map(([fv,fl])=>(
          <button key={fv} onClick={()=>setFilter(fv)} style={{fontSize:10,padding:"3px 9px",borderRadius:10,border:`1px solid ${filter===fv?C.blue:C.border}`,background:filter===fv?C.blue:"transparent",color:filter===fv?"#fff":C.sub,cursor:"pointer",fontWeight:600}}>
            {fl}
          </button>
        ))}
      </div>
      {filt.map(c=>{
        const cfg=CST[c.estado]||CST.sin_enviar;
        const isO=open===c.empresa;
        return(
          <Card key={c.empresa} style={{marginBottom:5,borderLeft:`3px solid ${cfg.color}`}}>
            <div onClick={()=>setOpen(isO?null:c.empresa)} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:12,fontWeight:700}}>{c.empresa}</span>
                  <span style={{fontSize:10,color:cfg.color,fontWeight:700}}>{cfg.dot} {cfg.label}</span>
                  {c.diasSinResp!=null&&c.diasSinResp>0&&<span style={{fontSize:9,color:c.diasSinResp>7?C.red:C.amber,fontWeight:600}}>{c.diasSinResp}d</span>}
                </div>
                <div style={{fontSize:10,color:C.dim}}>↑{c.totalEnviados} ↓{c.totalRecibidos} · {c.email}</div>
              </div>
              <div style={{display:"flex",gap:4}}>
                {c.lastRecv?.url&&<a href={c.lastRecv.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:C.green+"10",color:C.green,textDecoration:"none",fontWeight:700,border:`1px solid ${C.green}20`}}>↓</a>}
                {!c.lastRecv&&c.lastSent?.url&&<a href={c.lastSent.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:C.blue+"10",color:C.blue,textDecoration:"none",fontWeight:700,border:`1px solid ${C.blue}20`}}>↑</a>}
                <span style={{fontSize:10,color:C.dim}}>{isO?"▲":"▼"}</span>
              </div>
            </div>
            {isO&&(
              <div style={{marginTop:8,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                {[c.firstSent&&{ic:"↑",lbl:"Primer envío",color:C.blue,...c.firstSent},c.lastSent&&c.lastSent.url!==c.firstSent?.url&&{ic:"↑",lbl:"Último envío",color:C.amber,...c.lastSent},c.lastRecv&&{ic:"↓",lbl:"Última respuesta",color:C.green,...c.lastRecv}].filter(Boolean).map((item,i)=>(
                  <div key={i} style={{marginBottom:6,padding:"6px 8px",background:C.bg,borderRadius:5,borderLeft:`2px solid ${item.color}`}}>
                    <div style={{fontSize:9,color:item.color,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{item.ic} {item.lbl}</div>
                    <div style={{fontSize:11,fontWeight:600}}>{item.subject}</div>
                    <div style={{fontSize:10,color:C.dim}}>{fDate(item.date?.slice(0,10)||"")}</div>
                    {item.snippet&&<div style={{fontSize:10,color:C.sub,fontStyle:"italic",marginTop:2}}>"{item.snippet.slice(0,90)}…"</div>}
                    {item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:10,color:item.color,fontWeight:600}}>abrir →</a>}
                  </div>
                ))}
                {c.timeline?.length>0&&(
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:9,color:C.dim,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Historial</div>
                    {c.timeline.map((m,i)=>(
                      <div key={i} style={{display:"flex",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:9,color:m.type==="sent"?C.blue:C.green,fontWeight:700}}>{m.type==="sent"?"↑":"↓"}</span>
                        <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.subject}</div><div style={{fontSize:9,color:C.dim}}>{fDate(m.date?.slice(0,10)||"")}</div></div>
                        {m.url&&<a href={m.url} target="_blank" rel="noreferrer" style={{fontSize:9,color:C.blue,flexShrink:0}}>↗</a>}
                      </div>
                    ))}
                  </div>
                )}
                {!c.firstSent&&c.totalEnviados===0&&<div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"5px 0"}}>Sin historial — presiona ↻ para sincronizar</div>}
              </div>
            )}
          </Card>
        );
      })}
    </Sect>
  );
}

// ══════════════════════════════════════════════════════
// RELOJ CONTROL
// ══════════════════════════════════════════════════════
function Reloj({clockData,loading,onSync,clockMeta}){
  const[month,setMonth]=useState(()=>today().slice(0,7));
  const[open,setOpen]=useState(false);
  const td=today();
  const prevWD=()=>{const d=new Date();d.setHours(12);do{d.setDate(d.getDate()-1);}while([0,6].includes(d.getDay()));return d.toISOString().slice(0,10);};
  const yd=prevWD();
  const months=[...new Set(clockData.map(r=>r.date.slice(0,7)))].sort().slice(-4);
  const monthData=clockData.filter(r=>r.date.startsWith(month));
  const now=new Date().getHours()*60+new Date().getMinutes();
  const days=monthData.map(r=>{
    const j=jorn(r.date),eM=toMin(r.entrada),sM=toMin(r.salida),isT=r.date===td;
    if(!eM&&!sM)return{...r,j,extra:null};
    if(!sM&&isT)return{...r,j,extra:null,live:Math.max(0,now-(eM+j)),expSal:eM+j};
    if(!sM)return{...r,j,extra:null};
    if(!eM)return{...r,j,extra:null};
    return{...r,j,extra:(sM-eM)-j};
  });
  const done=days.filter(d=>d.extra!==null);
  const totalExtra=done.reduce((a,d)=>a+(d.extra||0),0);
  const yearExtra=clockData.map(r=>{const j=jorn(r.date),eM=toMin(r.entrada),sM=toMin(r.salida);return eM&&sM?(sM-eM)-j:null;}).filter(x=>x!==null).reduce((a,v)=>a+v,0);
  const nc=totalExtra>=0?C.green:C.red;
  const yc=yearExtra>=0?C.green:C.red;
  const[,mo]=month.split("-").map(Number);
  const todayRec=days.find(d=>d.date===td);
  const hasYd=!!clockData.find(d=>d.date===yd);
  const missingYd=clockMeta&&clockMeta.hasYesterday===false&&!hasYd;

  return(
    <Sect title="Reloj Control 2026" action={<Btn onClick={onSync} disabled={loading} small outline color={C.blue}>{loading?"···":"↻"}</Btn>}>
      {missingYd&&<div style={{background:C.amber+"14",border:`1px solid ${C.amber}30`,borderRadius:6,padding:"7px 10px",marginBottom:8,fontSize:11,color:C.amber,fontWeight:600}}>⚠ Sin registro: {fDate(yd)}</div>}
      {todayRec?.live!=null&&todayRec.live>0&&(
        <Card style={{marginBottom:8,borderLeft:`3px solid ${C.blue}`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.blue}}>En jornada · {todayRec.entrada}</div>
          <div style={{fontSize:11,color:C.sub}}>Salida normal: {String(Math.floor(todayRec.expSal/60)).padStart(2,"0")}:{String(todayRec.expSal%60).padStart(2,"0")} · <span style={{color:"#7C3AED",fontWeight:700}}>+{fMin(todayRec.live)} ahora</span></div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:8}}>
        {[
          {l:MONTHS[mo],v:(totalExtra>=0?"+":"")+fMin(totalExtra),c:nc},
          {l:"Días",v:`${done.length}d`,c:C.blue},
          {l:"Acum.2026",v:(yearExtra>=0?"+":"")+fMin(yearExtra),c:yc},
          {l:"Hoy",v:todayRec?`${todayRec.entrada||"?"} / ${todayRec.salida||"⏳"}`:"—",c:C.sub},
        ].map(({l,v,c})=>(
          <div key={l} style={{background:C.bg,borderRadius:6,padding:"7px 8px",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.dim,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>{l}</div>
            <div style={{fontSize:12,fontWeight:800,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
        {months.map(m=>{const[,mm]=m.split("-").map(Number);return(
          <button key={m} onClick={()=>setMonth(m)} style={{fontSize:9,padding:"2px 8px",borderRadius:8,border:`1px solid ${month===m?C.blue:C.border}`,background:month===m?C.blue:"transparent",color:month===m?"#fff":C.sub,cursor:"pointer",fontWeight:600}}>
            {MONTHS_FULL[mm].slice(0,3)}
          </button>
        );})}
        <button onClick={()=>setOpen(o=>!o)} style={{fontSize:9,padding:"2px 8px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.sub,cursor:"pointer"}}>
          {open?"▲":"▼ tabla"}
        </button>
      </div>
      {open&&(
        <div style={{background:C.card,borderRadius:8,border:`1px solid ${C.border}`,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",padding:"6px 10px",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
            {["Fecha","J","Entr.","Sal.","Extra"].map(h=><div key={h} style={{fontSize:8,fontWeight:700,color:C.dim,textTransform:"uppercase"}}>{h}</div>)}
          </div>
          {[...days].reverse().map(d=>{
            const isT=d.date===td,isY=d.date===yd;
            const ec=d.extra>0?C.green:d.extra<0?C.red:C.sub;
            return(
              <div key={d.date} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",padding:"7px 10px",borderBottom:`1px solid ${C.border}`,background:isT?C.blue+"08":isY?C.amber+"08":"transparent"}}>
                <div style={{fontSize:10,fontWeight:isT||isY?700:400,color:isT?C.blue:isY?C.amber:C.text}}>
                  {fDate(d.date)}{isT&&<span style={{marginLeft:3,fontSize:8,color:C.blue}}>hoy</span>}{isFri(d.date)&&<span style={{marginLeft:3,fontSize:8,color:C.amber}}>vie</span>}
                </div>
                <div style={{fontSize:9,color:C.dim}}>{d.j===480?"8h":"9h"}</div>
                <div style={{fontSize:10}}>{d.entrada||"—"}</div>
                <div style={{fontSize:10,color:d.salida?C.text:C.amber}}>{d.salida||(d.date===td?"⏳":"—")}</div>
                <div style={{fontSize:11,fontWeight:700,color:d.extra!=null?ec:C.dim}}>
                  {d.extra!=null?(d.extra>0?`+${fMin(d.extra)}`:d.extra<0?`-${fMin(Math.abs(d.extra))}`:"="):"—"}
                </div>
              </div>
            );
          })}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",padding:"7px 10px",background:C.bg,borderTop:`1.5px solid ${C.border}`}}>
            <div style={{fontSize:10,fontWeight:700,gridColumn:"1/5"}}>Total {MONTHS_FULL[mo]}</div>
            <div style={{fontSize:12,fontWeight:900,color:nc}}>{totalExtra>=0?"+":""}{fMin(totalExtra)}</div>
          </div>
        </div>
      )}
    </Sect>
  );
}

// ══════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════
export default function Page(){
  const w=useW();
  const mob=w<768;
  const wide=w>=1200;

  // ── Persistencia cross-device ─────────────────────────
  const[projects, setProjects]=useDB("projects", SEED_P);
  const[follows,  setFollows] =useDB("follows",  SEED_FOLLOWS);
  const[boss,     setBoss]    =useDB("boss",      SEED_BOSS);
  const[clockData,setClockData]=useDB("clock",    CLOCK_SEED);
  const[cotiz,    setCotiz]   =useDB("cotiz",     []);
  const[bandeja,  setBandeja] =useDB("bandeja",   []);
  const[clockMeta,setClockMeta]=useDB("cmeta",    {});

  // ── UI (solo local) ───────────────────────────────────
  const[view,      setView]     =useState("dash");
  const[sel,       setSel]      =useState(null);
  const[projTab,   setProjTab]  =useState("overview");
  const[showForm,  setShowForm] =useState(false);
  const[form,      setForm]     =useState({name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""});
  const[editId,    setEditId]   =useState(null);
  const[notesDraft,setNotesDraft]=useState("");
  const[genSum,    setGenSum]   =useState(false);
  const[newTask,   setNewTask]  =useState("");
  const[emailForm, setEmailForm]=useState({from:"",subject:"",date:"",body:""});
  const[addEmail,  setAddEmail] =useState(false);
  const[renaming,  setRenaming] =useState(null);
  const[renameVal, setRenameVal]=useState("");
  const[extracting,setExtracting]=useState(false);
  const[licitL,    setLicitL]   =useState(null);
  const[loadR,     setLoadR]    =useState(false);
  const[loadG,     setLoadG]    =useState(false);
  const[loadC,     setLoadC]    =useState(false);
  const[msgs,      setMsgs]     =useState([{role:"assistant",content:"Hola Alexis 👋\n\nAsistente SECPLA activo.\n\n• ¿Qué urgencias tengo hoy?\n• ¿Qué empresas no cotizaron SNSM?\n• Resumen p5"}]);
  const[chatIn,    setChatIn]   =useState("");
  const[chatLoad,  setChatLoad] =useState(false);
  const chatRef=useRef(null);
  const fileRef=useRef(null);

  const proj=projects.find(p=>p.id===sel);
  const active=follows.filter(f=>f.status==="activo");
  const critical=active.filter(f=>f.urgency==="crítica");

  useEffect(()=>{if(sel){const p=projects.find(x=>x.id===sel);if(p)setNotesDraft(p.notes||"");}},[sel]);

  const upProj=fn=>setProjects(p=>p.map(x=>x.id===sel?fn(x):x));
  const saveNotes=()=>upProj(p=>({...p,notes:notesDraft}));
  const resolveFollow=(id,action="resolve")=>setFollows(p=>p.map(f=>f.id!==id?f:action==="reopen"?{...f,status:"activo",resolvedAt:null}:{...f,status:"resuelto",resolvedAt:today()}));
  const addFollow=nf=>setFollows(p=>[...p,nf]);

  const bandejaFollow=m=>{
    const id="bj_"+m.messageId;
    if(follows.find(f=>f.id===id))return;
    setFollows(p=>[...p,{id,projectId:m.projectId||"",urgency:"media",subject:m.subject,to:m.fromName||m.from,context:m.snippet||"",sentDate:today(),daysPending:m.daysSinceLastMsg||0,status:"activo",threadId:m.threadId,threadUrl:m.threadUrl}]);
    bandejaDiscard(m.threadId);
  };
  const bandejaDiscard=threadId=>{
    const prev=lsGet("disc_v6",[]);
    if(!prev.includes(threadId))lsSet("disc_v6",[...prev,threadId]);
    setBandeja(p=>[...p]);
  };

  // ── Sync — sin mensajes de error al usuario ───────────
  const syncReloj=async(silent=false)=>{
    setLoadR(true);
    const{ok,data}=await api({type:"clock_sync"});
    if(ok&&!data.error){
      const parsed=pj(data.text,[]);
      if(Array.isArray(parsed)&&parsed.length>0){
        const dates=new Set(parsed.map(r=>r.date));
        const hist=CLOCK_SEED.filter(r=>!dates.has(r.date));
        setClockData([...hist,...parsed].sort((a,b)=>a.date.localeCompare(b.date)));
        if(data.meta)setClockMeta(data.meta);
      }
    }
    setLoadR(false);
  };

  const syncGmail=async()=>{
    setLoadG(true);
    const KW=["SNSM","SPD","GORE","licitación","cotización","convenio","sala monitoreo","UV32","comisaría"];
    const since=new Date(Date.now()-8*86400000).toISOString().slice(0,10).replace(/-/g,"/");
    const{ok,data}=await api({type:"gmail_scan",since,keywords:KW});
    if(ok&&!data.error){
      const parsed=pj(data.text,[]);
      if(Array.isArray(parsed)&&parsed.length>0)setBandeja(parsed);
    }
    setLoadG(false);
  };

  const syncCotiz=async()=>{
    setLoadC(true);
    const{ok,data}=await api({type:"cotizaciones_track"});
    if(ok&&!data.error){
      const parsed=pj(data.text,[]);
      if(Array.isArray(parsed)&&parsed.length>0)setCotiz(parsed);
    }
    setLoadC(false);
  };

  // ── Scheduler — L-V cada hora, S-D 1 vez/día ─────────
  const syncRR=useRef(null);syncRR.current=syncReloj;
  const syncGR=useRef(null);syncGR.current=syncGmail;
  const syncCR=useRef(null);syncCR.current=syncCotiz;

  useEffect(()=>{
    const nowCLT=()=>{
      const d=new Date(new Date().toLocaleString("en-US",{timeZone:"America/Santiago"}));
      return{h:d.getHours(),m:d.getMinutes(),dow:d.getDay(),
        hhmm:`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
    };
    const did=(k,s)=>{const v=localStorage.getItem(`sc_ran_${k}_${s.replace(":","_")}`);return v&&(Date.now()-new Date(v).getTime())/60000<55;};
    const mark=(k,s)=>localStorage.setItem(`sc_ran_${k}_${s.replace(":","_")}`,new Date().toISOString());

    const tick=()=>{
      const{h,m,dow,hhmm}=nowCLT();
      const isWeekend=dow===0||dow===6;

      if(isWeekend){
        // S-D: una sola vez a las 10:00 CLT
        const s="10:00";
        if(hhmm===s&&!did("wknd",s)){mark("wknd",s);syncRR.current();syncGR.current();syncCR.current();}
      } else {
        // L-V: gmail cada hora 08-18
        if(h>=8&&h<=18&&m===0){
          const s=`${String(h).padStart(2,"0")}:00`;
          if(!did("gml",s)){mark("gml",s);syncGR.current();}
        }
        // L-V: reloj 3 veces
        for(const s of["08:00","13:30","17:30"]){if(hhmm===s&&!did("rel",s)){mark("rel",s);syncRR.current();}}
        // L-V: cotiz 2 veces
        for(const s of["09:30","15:30"]){if(hhmm===s&&!did("ctz",s)){mark("ctz",s);syncCR.current();}}
      }
    };
    tick();
    const iv=setInterval(tick,60000);
    return()=>clearInterval(iv);
  },[]);

  // ── Acciones proyecto ─────────────────────────────────
  const doSummary=async()=>{
    if(!proj||!notesDraft.trim())return;
    setGenSum(true);upProj(p=>({...p,notes:notesDraft}));
    const{ok,data}=await api({type:"summary",project:{name:proj.name,financier:proj.financier,program:proj.program,budget:fCLP(proj.budget),stage:proj.stage,status:proj.status},notes:notesDraft});
    if(ok)upProj(p=>({...p,notes:notesDraft,aiSummary:data.text||""}));
    setGenSum(false);
  };
  const doLicit=async p=>{
    if(!p?.licitId?.trim())return;
    setLicitL(p.id);
    const{ok,data}=await api({type:"licit",licitId:p.licitId});
    if(ok)setProjects(prev=>prev.map(x=>x.id===p.id?{...x,licitData:pj(data.text,{estado:"Desconocido"}),licitChecked:today()}:x));
    setLicitL(null);
  };
  const uploadDoc=async e=>{
    const file=e.target.files[0];if(!file||!proj)return;
    setExtracting(true);
    const reader=new FileReader();
    reader.onload=async ev=>{
      const b64=ev.target.result.split(",")[1];
      const{ok,data}=await api({type:"doc",b64,mediaType:file.type.startsWith("image/")?file.type:"application/pdf",isImg:file.type.startsWith("image/")});
      const ex=ok?pj(data.text,{summary:"—"}):{summary:"Error."};
      upProj(p=>({...p,docs:[...p.docs,{id:uid(),name:file.name,docType:ex.docType||"Documento",uploadedAt:today(),summary:ex.summary||"—",extracted:JSON.stringify(ex)}]}));
      setExtracting(false);
    };
    reader.readAsDataURL(file);e.target.value="";
  };
  const addTask=()=>{if(!newTask.trim()||!proj)return;upProj(p=>({...p,tasks:[...p.tasks,{id:uid(),text:newTask.trim(),status:"pending",createdAt:today()}]}));setNewTask("");};
  const toggleTask=id=>upProj(p=>({...p,tasks:p.tasks.map(t=>t.id===id?{...t,status:t.status==="pending"?"done":"pending"}:t)}));
  const delTask=id=>upProj(p=>({...p,tasks:p.tasks.filter(t=>t.id!==id)}));
  const saveEmail=()=>{if(!emailForm.subject||!proj)return;upProj(p=>({...p,emails:[...p.emails,{...emailForm,id:uid()}]}));setEmailForm({from:"",subject:"",date:"",body:""});setAddEmail(false);};
  const delEmail=id=>upProj(p=>({...p,emails:p.emails.filter(e=>e.id!==id)}));
  const delDoc=id=>upProj(p=>({...p,docs:p.docs.filter(d=>d.id!==id)}));
  const toggleBoss=id=>setBoss(p=>p.map(b=>b.id===id?{...b,status:b.status==="pendiente"?"completado":"pendiente",completedAt:today()}:b));

  const sendChat=async()=>{
    if(!chatIn.trim()||chatLoad)return;
    const nm=[...msgs,{role:"user",content:chatIn.trim()}];
    setMsgs(nm);setChatIn("");setChatLoad(true);
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),50);
    const ctx=projects.map(p=>`${p.name}|${p.stage}|${p.status}|${fCLP(p.budget)}|${p.financier}\n${(p.aiSummary||p.desc||"").slice(0,100)}`).join("\n\n");
    const{ok,data}=await api({type:"chat",messages:nm,context:ctx,follows:active.map(f=>`[${f.urgency}] ${f.subject}→${f.to}`).join("\n")});
    setMsgs(m=>[...m,{role:"assistant",content:ok?(data.text||"Sin respuesta."):"Error."}]);
    setChatLoad(false);
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100);
  };

  // ── Render helpers ─────────────────────────────────────
  const totalBudget=projects.reduce((a,p)=>a+(p.budget||0),0);
  const cotizData=cotiz?.length>0?cotiz:COTIZ_SEED;
  const conCotiz=cotizData.filter(c=>c.estado==="cotizacion_recibida").length;
  const MPC={Publicada:C.green,"En proceso":C.blue,Cerrada:C.amber,Adjudicada:"#6D28D9",Desierta:C.red,Revocada:C.red};

  // ── SYNC BAR MINIMALISTA ───────────────────────────────
  const SyncBar=()=>(
    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
      {[{k:"gmail",fn:syncGmail,loading:loadG,lbl:"Bandeja"},{k:"cotiz",fn:syncCotiz,loading:loadC,lbl:"Cotiz."},{k:"reloj",fn:syncReloj,loading:loadR,lbl:"Reloj"}].map(({k,fn,loading,lbl})=>(
        <Btn key={k} onClick={fn} disabled={loading} small color={C.ink}>
          {loading?"···":lbl}
        </Btn>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════
  // VISTAS
  // ══════════════════════════════════════════════════════

  const dashView=(
    <div style={{overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1,padding:mob?"14px 14px 80px":wide?"24px 32px":"20px 22px"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:11,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:2}}>SECPLA · Recoleta</div>
          <div style={{fontSize:mob?18:24,fontWeight:800,color:C.text,lineHeight:1.1}}>Dashboard</div>
          {critical.length>0&&<div style={{marginTop:3,fontSize:11,color:C.red,fontWeight:700}}>● {critical.length} crítica(s)</div>}
        </div>
        <SyncBar/>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:7,marginBottom:20}}>
        {[
          {l:"Inversión",v:fCLP(totalBudget),sub:"CLP",c:C.blue},
          {l:"Proyectos",v:`${projects.filter(p=>["En curso","Con alerta"].includes(p.status)).length}/${projects.length}`,sub:"activos",c:C.green},
          {l:"Seguimientos",v:active.length,sub:`${critical.length} críticos`,c:critical.length>0?C.red:C.text},
          {l:"Cotizaciones",v:`${conCotiz}/${cotizData.length}`,sub:"SNSM 2025",c:C.text},
        ].map(({l,v,sub,c})=>(
          <div key={l} style={{background:C.card,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.dim,textTransform:"uppercase",fontWeight:700,letterSpacing:0.5,marginBottom:4}}>{l}</div>
            <div style={{fontSize:mob?17:20,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
            <div style={{fontSize:9,color:C.dim,marginTop:2}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Layout: 2 cols en desktop */}
      <div style={{display:mob||w<1000?"block":"grid",gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start"}}>
        {/* Col izq */}
        <div>
          <Bandeja bandeja={bandeja} follows={follows} onFollow={bandejaFollow} onDiscard={bandejaDiscard} onRefresh={syncGmail} loading={loadG}/>
          <Seguimientos follows={follows} projects={projects} onResolve={resolveFollow} onAdd={addFollow}/>
          {/* Solicitudes Jefatura */}
          <Sect title="Solicitudes de Jefatura">
            {boss.filter(b=>b.status==="pendiente").map(b=>{
              const fp=projects.find(p=>p.id===b.projectId);
              const uc=UG[b.urgency]||C.dim;
              const fc=b.from.includes("Grace")?C.blue:C.text;
              return(
                <Card key={b.id} style={{marginBottom:6,borderLeft:`3px solid ${uc}`}}>
                  <div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>
                    <Tag color={fc}>{b.from}</Tag>
                    <Tag color={uc}>{b.urgency}</Tag>
                    {fp&&<Tag color={C.sub}>{fp.name.slice(0,20)}…</Tag>}
                    <span style={{fontSize:9,color:C.dim,marginLeft:"auto"}}>{fDate(b.requestDate)}</span>
                  </div>
                  <div style={{fontSize:12,color:C.text,lineHeight:1.4,marginBottom:7}}>{b.task}</div>
                  <div style={{display:"flex",gap:5}}>
                    <a href={b.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:11,padding:"4px 10px",borderRadius:5,background:C.blue+"10",color:C.blue,textDecoration:"none",fontWeight:700,border:`1px solid ${C.blue}20`}}>✉</a>
                    <Btn onClick={()=>toggleBoss(b.id)} small color={C.green}>✓</Btn>
                  </div>
                </Card>
              );
            })}
            {boss.filter(b=>b.status==="completado").length>0&&(
              <details><summary style={{fontSize:10,color:C.dim,cursor:"pointer",padding:"4px 0"}}>Ver completadas</summary>
                {boss.filter(b=>b.status==="completado").map(b=>(
                  <Card key={b.id} style={{marginBottom:4,opacity:.6}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontSize:10,color:C.green,fontWeight:700}}>✓ {b.from}</div><div style={{fontSize:11,color:C.sub,textDecoration:"line-through"}}>{b.task}</div></div>
                      <Btn onClick={()=>toggleBoss(b.id)} small outline color={C.sub}>↩</Btn>
                    </div>
                  </Card>
                ))}
              </details>
            )}
          </Sect>
        </div>

        {/* Col der */}
        <div>
          <Cotizaciones cotiz={cotiz} loading={loadC} onRefresh={syncCotiz}/>

          {/* SIEVAP */}
          {(()=>{
            const now=new Date(),start=new Date("2026-04-09T00:00:00"),deadline=new Date("2026-04-24T23:59:59"),total=15;
            const elapsed=Math.min(total,Math.max(0,Math.round((now-start)/86400000)));
            const remaining=Math.max(0,Math.round((deadline-now)/86400000));
            const ov=now>deadline;
            const bc=ov?C.red:remaining<=3?"#C05C00":C.amber;
            return(
              <Sect title="SIEVAP — Plazo">
                <Card style={{borderLeft:`3px solid ${bc}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:bc,marginBottom:2}}>{ov?"⚠ Vencido":remaining<=3?"⚠ Crítico":"Días restantes"}</div>
                      <div style={{fontSize:12,fontWeight:600}}>SNSM25-STP-0113</div>
                    </div>
                    <div style={{fontSize:ov?12:20,fontWeight:900,color:bc}}>{ov?`+${Math.abs(remaining)}d`:remaining}</div>
                  </div>
                  <div style={{background:C.border,borderRadius:6,height:5,overflow:"hidden",marginBottom:5}}>
                    <div style={{height:"100%",width:`${Math.min(100,Math.round(elapsed/total*100))}%`,background:bc,borderRadius:6}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.dim,marginBottom:5}}>
                    <span>{fDate("2026-04-09")}</span><span style={{fontWeight:700,color:bc}}>{elapsed}/{total}d</span><span>{fDate("2026-04-24")}</span>
                  </div>
                  <a href="https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" target="_blank" rel="noreferrer" style={{fontSize:10,color:C.blue,fontWeight:700}}>✉ Ver correo →</a>
                </Card>
              </Sect>
            );
          })()}

          {/* Cartera */}
          <Sect title="Proyectos" action={<Btn onClick={()=>{setForm({name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""});setEditId(null);setShowForm(true);}} small outline color={C.blue}>+ Nuevo</Btn>}>
            {projects.map(p=>(
              <Card key={p.id} onClick={()=>{setSel(p.id);setProjTab("overview");setView("project");}} style={{marginBottom:6,borderLeft:`3px solid ${ST[p.status]||C.sub}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:5}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,lineHeight:1.3}}>{p.name}</div>
                    <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                      <Tag color={ST[p.status]||C.sub}>{p.status}</Tag>
                      <Tag color={C.sub}>{p.stage}</Tag>
                      <Tag color={C.blue}>{p.financier}</Tag>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:C.blue}}>{fCLP(p.budget)}</div>
                    {follows.filter(f=>f.projectId===p.id&&f.status==="activo").length>0&&<div style={{fontSize:9,color:C.red,marginTop:2}}>● {follows.filter(f=>f.projectId===p.id&&f.status==="activo").length} seg.</div>}
                  </div>
                </div>
                {p.aiSummary&&<div style={{fontSize:11,color:C.sub,lineHeight:1.4,borderLeft:`2px solid ${C.border}`,paddingLeft:7}}>{p.aiSummary.slice(0,85)}…</div>}
              </Card>
            ))}
          </Sect>

          <Reloj clockData={clockData} loading={loadR} onSync={syncReloj} clockMeta={clockMeta}/>
        </div>
      </div>
    </div>
  );

  // ── VISTA PROYECTO ─────────────────────────────────────
  const projTabs=[["overview","Resumen"],["licit","Licitación"],["notes","Notas"],["docs","Docs"],["tasks","Tareas"],["emails","Correos"]];
  const projView=proj&&(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{display:"flex",gap:2,padding:"8px 14px",background:C.card,borderBottom:`1px solid ${C.border}`,overflowX:"auto",flexShrink:0}}>
        {projTabs.map(([k,l])=>{
          const badge=k==="docs"?proj.docs.length:k==="tasks"?proj.tasks.filter(t=>t.status==="pending").length:k==="emails"?proj.emails.length:null;
          return(
            <button key={k} onClick={()=>setProjTab(k)} style={{padding:"6px 10px",borderRadius:5,border:"none",background:projTab===k?C.blue:"transparent",color:projTab===k?"#fff":C.sub,cursor:"pointer",fontSize:11,fontWeight:projTab===k?700:500,whiteSpace:"nowrap"}}>
              {l}{badge!=null&&badge>0&&<span style={{marginLeft:3,fontSize:8,background:projTab===k?"#3b82f6":"#e2e8f0",color:projTab===k?"#fff":C.sub,borderRadius:7,padding:"0 4px"}}>{badge}</span>}
            </button>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:mob?"12px 14px 80px":"18px 22px"}}>
        {projTab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <Sect title="Ficha del Proyecto" mb={10}>
                {[["Estado",<Tag key="s" color={ST[proj.status]||C.sub}>{proj.status}</Tag>],["Etapa",proj.stage],["Presupuesto",`${fCLP(proj.budget)} CLP`],["Financiamiento",`${proj.financier} / ${proj.program||"—"}`],["Vencimiento",fDate(proj.deadline)]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`,gap:8}}>
                    <span style={{fontSize:11,color:C.sub}}>{k}</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.text,textAlign:"right"}}>{v}</span>
                  </div>
                ))}
                {proj.codigoProyecto&&<div style={{marginTop:8,fontSize:10,color:C.sub,padding:"4px 8px",background:C.bg,borderRadius:4,fontFamily:"monospace"}}>{proj.codigoProyecto}{proj.codigoSIGE&&` · SIGE: ${proj.codigoSIGE}`}</div>}
              </Sect>
              <Btn onClick={()=>{setForm({...proj,budget:proj.budget||""});setEditId(proj.id);setShowForm(true);}} outline color={C.sub} full>✏ Editar</Btn>
            </Card>
            {proj.aiSummary&&<Card style={{borderLeft:`3px solid ${C.blue}`}}><div style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",marginBottom:6}}>Resumen IA</div><p style={{fontSize:12,color:C.text,lineHeight:1.7,margin:0}}>{proj.aiSummary}</p></Card>}
            {proj.convenio&&<Card>
              <Sect title="Convenio & Plazos" mb={8}>
                {[["Vence ejecución",fDate(proj.convenio.plazoEjecucionFin)],["Vence convenio",fDate(proj.convenio.plazoConvenioFin)]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:11,color:C.sub}}>{k}</span><span style={{fontSize:12,fontWeight:700}}>{v}</span></div>
                ))}
              </Sect>
            </Card>}
            <Card><p style={{fontSize:11,color:C.sub,lineHeight:1.6,margin:0}}>{proj.desc}</p></Card>
          </div>
        )}
        {projTab==="licit"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <label style={LBL}>ID Licitación Mercado Público</label>
              <div style={{display:"flex",gap:7}}>
                <input value={proj.licitId||""} onChange={e=>setProjects(prev=>prev.map(p=>p.id===proj.id?{...p,licitId:e.target.value}:p))} placeholder="1431841-10-B226" style={{...INP,flex:1,fontFamily:"monospace"}}/>
                <Btn onClick={()=>doLicit(proj)} disabled={!proj.licitId||licitL===proj.id} color={C.ink}>{licitL===proj.id?"···":"🔍"}</Btn>
              </div>
            </Card>
            {proj.licitData&&(()=>{const ld=proj.licitData;return(
              <Card>
                <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}><Tag color={MPC[ld.estado]||C.sub}>{ld.estado}</Tag>{ld.nombre&&<span style={{fontSize:11,color:C.sub}}>{ld.nombre}</span>}</div>
                {ld.descripcion&&<p style={{fontSize:11,color:C.sub,margin:"0 0 8px",lineHeight:1.5,padding:"7px 9px",background:C.bg,borderRadius:5}}>{ld.descripcion}</p>}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                  {[["Cierre",fDate(ld.fechaCierre)],["Adjudicación",fDate(ld.fechaAdjudicacion)],["Monto",ld.monto||"—"]].map(([l,v])=>(
                    <div key={l} style={{background:C.bg,borderRadius:5,padding:"7px 8px"}}><div style={{fontSize:8,color:C.dim,textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontSize:11,fontWeight:700}}>{v}</div></div>
                  ))}
                </div>
                {ld.url&&<a href={ld.url} target="_blank" rel="noreferrer" style={{display:"block",marginTop:7,fontSize:10,color:C.blue}}>Ver en Mercado Público →</a>}
              </Card>
            );})()}
          </div>
        )}
        {projTab==="notes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <label style={LBL}>Notas de gestión</label>
              <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} onBlur={saveNotes} rows={10} placeholder="Notas, gestiones, pendientes…" style={{...INP,resize:"vertical",fontSize:12,lineHeight:1.6}}/>
              <div style={{display:"flex",gap:7,marginTop:9}}>
                <Btn onClick={saveNotes} small color={C.green}>💾 Guardar</Btn>
                <Btn onClick={doSummary} disabled={genSum||!notesDraft.trim()} small color={C.blue}>{genSum?"···":"✨ Resumen IA"}</Btn>
              </div>
            </Card>
            {proj.aiSummary&&<Card style={{borderLeft:`3px solid ${C.blue}`}}><p style={{fontSize:12,color:C.text,lineHeight:1.7,margin:0}}>{proj.aiSummary}</p></Card>}
          </div>
        )}
        {projTab==="docs"&&(
          <div>
            <Btn onClick={()=>fileRef.current?.click()} disabled={extracting} color={C.blue} full style={{marginBottom:12,padding:"10px 0"}}>{extracting?"⏳ Procesando…":"📎 Subir Documento"}</Btn>
            {proj.docs.length===0&&<div style={{textAlign:"center",padding:32,color:C.dim,border:`1.5px dashed ${C.border}`,borderRadius:8,fontSize:11}}>Sin documentos</div>}
            {proj.docs.map(d=>(<Card key={d.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div><div style={{fontWeight:700,fontSize:12}}>📄 {d.name}</div><div style={{fontSize:9,color:C.dim}}>{d.docType} · {fDate(d.uploadedAt)}</div></div>
                <button onClick={()=>delDoc(d.id)} style={{background:"none",border:"none",color:C.border,cursor:"pointer",fontSize:16}}>✕</button>
              </div>
              {d.summary&&<p style={{fontSize:11,color:C.sub,lineHeight:1.5,background:C.bg,padding:"7px 9px",borderRadius:5,margin:0}}>{d.summary}</p>}
            </Card>))}
          </div>
        )}
        {projTab==="tasks"&&(
          <div>
            <div style={{display:"flex",gap:7,marginBottom:12}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Nueva tarea…" style={{...INP,flex:1}}/>
              <Btn onClick={addTask} color={C.blue} style={{padding:"0 14px",fontSize:16}}>+</Btn>
            </div>
            {proj.tasks.length===0&&<div style={{textAlign:"center",padding:32,color:C.dim,border:`1.5px dashed ${C.border}`,borderRadius:8,fontSize:11}}>Sin tareas</div>}
            {["pending","done"].map(st=>{
              const ts=proj.tasks.filter(t=>t.status===st);if(!ts.length)return null;
              return(<div key={st} style={{marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{st==="pending"?"Pendientes":"Completadas"}</div>
                {ts.map(t=>(<div key={t.id} style={{background:C.card,borderRadius:6,padding:"9px 11px",border:`1px solid ${C.border}`,marginBottom:5,display:"flex",alignItems:"center",gap:9,opacity:st==="done"?.5:1}}>
                  <input type="checkbox" checked={st==="done"} onChange={()=>toggleTask(t.id)} style={{cursor:"pointer",width:15,height:15,accentColor:C.blue,flexShrink:0}}/>
                  <span style={{fontSize:12,flex:1,textDecoration:st==="done"?"line-through":"none",color:st==="done"?C.dim:C.text}}>{t.text}</span>
                  <button onClick={()=>delTask(t.id)} style={{background:"none",border:"none",color:C.border,cursor:"pointer",fontSize:14}}>✕</button>
                </div>))}
              </div>);
            })}
          </div>
        )}
        {projTab==="emails"&&(
          <div>
            <Btn onClick={()=>setAddEmail(true)} color={C.blue} full style={{marginBottom:12,padding:"10px 0"}}>+ Registrar Correo</Btn>
            {addEmail&&(<Card style={{marginBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><label style={LBL}>Remitente</label><input value={emailForm.from} onChange={e=>setEmailForm(f=>({...f,from:e.target.value}))} style={INP}/></div>
                <div><label style={LBL}>Fecha</label><input type="date" value={emailForm.date} onChange={e=>setEmailForm(f=>({...f,date:e.target.value}))} style={INP}/></div>
              </div>
              <div style={{marginBottom:8}}><label style={LBL}>Asunto</label><input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))} style={INP}/></div>
              <div style={{marginBottom:10}}><label style={LBL}>Contenido</label><textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))} rows={3} style={{...INP,resize:"vertical"}}/></div>
              <div style={{display:"flex",gap:7}}><Btn onClick={saveEmail} color={C.blue}>Guardar</Btn><Btn onClick={()=>setAddEmail(false)} outline color={C.sub}>Cancelar</Btn></div>
            </Card>)}
            {proj.emails.length===0&&!addEmail&&<div style={{textAlign:"center",padding:32,color:C.dim,border:`1.5px dashed ${C.border}`,borderRadius:8,fontSize:11}}>Sin correos</div>}
            {proj.emails.map(e=>(<Card key={e.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><div style={{fontWeight:700,fontSize:12}}>✉ {e.subject}</div><div style={{fontSize:9,color:C.dim,marginTop:2}}>De: {e.from} · {fDate(e.date)}</div></div>
                <button onClick={()=>delEmail(e.id)} style={{background:"none",border:"none",color:C.border,cursor:"pointer",fontSize:14}}>✕</button>
              </div>
              {e.body&&<p style={{fontSize:11,color:C.sub,marginTop:7,lineHeight:1.5,borderTop:`1px solid ${C.border}`,paddingTop:7}}>{e.body}</p>}
            </Card>))}
          </div>
        )}
      </div>
    </div>
  );

  // ── CHAT ──────────────────────────────────────────────
  const chatView=(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{padding:"7px 12px",background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["¿Qué urgencias tengo?","Empresas sin cotizar SNSM","Resumen p5","Extras acumulados"].map(q=>(
            <button key={q} onClick={()=>setChatIn(q)} style={{fontSize:10,padding:"3px 8px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,cursor:"pointer",color:C.sub}}>{q}</button>
          ))}
        </div>
      </div>
      <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:7}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"88%",padding:"9px 12px",borderRadius:9,background:m.role==="user"?C.ink:C.card,color:m.role==="user"?"#fff":C.text,fontSize:12,lineHeight:1.6,whiteSpace:"pre-wrap",border:m.role==="user"?"none":`1px solid ${C.border}`}}>{m.content}</div>
          </div>
        ))}
        {chatLoad&&<div style={{display:"flex"}}><div style={{padding:"9px 12px",borderRadius:9,background:C.card,fontSize:11,color:C.dim,border:`1px solid ${C.border}`}}>···</div></div>}
      </div>
      <div style={{padding:"9px 11px",borderTop:`1px solid ${C.border}`,display:"flex",gap:7,flexShrink:0,paddingBottom:mob?"calc(9px + env(safe-area-inset-bottom))":"9px"}}>
        <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()} placeholder="Pregunta sobre tu cartera…" style={{...INP,flex:1}}/>
        <Btn onClick={sendChat} disabled={chatLoad} color={C.ink} style={{padding:"0 13px",fontSize:16}}>→</Btn>
      </div>
    </div>
  );

  // ── MODAL PROYECTO ─────────────────────────────────────
  const modal=showForm&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",zIndex:300}}>
      <div style={{background:C.card,borderRadius:mob?"14px 14px 0 0":"10px",padding:18,width:mob?"100%":"460px",maxHeight:"90vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>{editId?"Editar Proyecto":"Nuevo Proyecto"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:12}}>
          <div><label style={LBL}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={INP}/></div>
          <div><label style={LBL}>Presupuesto (CLP)</label><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={INP} placeholder="100000000"/></div>
          {form.budget&&Number(form.budget)>0&&<div style={{fontSize:11,color:C.blue,fontWeight:700,padding:"3px 7px",background:C.blue+"10",borderRadius:4}}>→ {fCLP(Number(form.budget))}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div><label style={LBL}>Financiamiento</label><select value={form.financier} onChange={e=>setForm(f=>({...f,financier:e.target.value}))} style={INP}>{FINANCIERS.map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={LBL}>Vencimiento</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={INP}/></div>
          </div>
          <div><label style={LBL}>Programa / Fondo</label><input value={form.program||""} onChange={e=>setForm(f=>({...f,program:e.target.value}))} style={INP}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div><label style={LBL}>Etapa</label><select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={INP}>{STAGES.map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={LBL}>Estado</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={INP}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></div>
          </div>
          <div><label style={LBL}>ID Licitación MP</label><input value={form.licitId||""} onChange={e=>setForm(f=>({...f,licitId:e.target.value}))} style={{...INP,fontFamily:"monospace"}} placeholder="1431841-10-B226"/></div>
          <div><label style={LBL}>Descripción</label><textarea value={form.desc||""} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} rows={3} style={{...INP,resize:"vertical"}}/></div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <Btn onClick={()=>{setShowForm(false);setEditId(null);}} outline color={C.sub} style={{flex:1,justifyContent:"center"}}>Cancelar</Btn>
          {editId&&<Btn onClick={()=>{if(window.confirm("¿Eliminar?")){ setProjects(p=>p.filter(x=>x.id!==editId));setShowForm(false);setEditId(null);setSel(null);setView("dash");}}} color={C.red} style={{flex:0}}>🗑</Btn>}
          <Btn onClick={()=>{
            if(!form.name?.trim())return;
            const p={...form,id:editId||uid(),budget:parseFloat(form.budget)||0,docs:form.docs||[],emails:form.emails||[],tasks:form.tasks||[],notes:form.notes||"",aiSummary:form.aiSummary||"",licitData:form.licitData||null,licitChecked:form.licitChecked||""};
            setProjects(prev=>editId?prev.map(x=>x.id===editId?p:x):[...prev,p]);
            setSel(p.id);setProjTab("overview");setView("project");setShowForm(false);setEditId(null);
          }} color={C.blue} style={{flex:1,justifyContent:"center"}}>Guardar</Btn>
        </div>
      </div>
    </div>
  );

  // ── LAYOUT ─────────────────────────────────────────────
  const sidebar=!mob&&(
    <div style={{width:200,background:C.ink,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
      <div style={{padding:"14px 8px 8px"}}>
        <div style={{fontSize:9,color:"#475569",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,padding:"0 8px",marginBottom:2}}>SECPLA</div>
        <div style={{fontSize:13,color:"#e2e8f0",fontWeight:800,padding:"0 8px",marginBottom:10}}>Recoleta</div>
        <button onClick={()=>{setView("dash");setSel(null);}} style={{width:"100%",padding:"7px 10px",borderRadius:6,background:view==="dash"&&!sel?"#1e3a5f":"transparent",color:view==="dash"&&!sel?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:11,fontWeight:600,marginBottom:2}}>◈ Dashboard</button>
        <button onClick={()=>setView("chat")} style={{width:"100%",padding:"7px 10px",borderRadius:6,background:view==="chat"?"#1e3a5f":"transparent",color:view==="chat"?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:11,fontWeight:600}}>◉ Asistente</button>
      </div>
      {active.length>0&&<div style={{margin:"0 8px 7px",padding:"7px 10px",background:"#7f1d1d18",borderRadius:6,border:"1px solid #ef444420"}}>
        <div style={{fontSize:8,color:"#fca5a5",fontWeight:700,textTransform:"uppercase",marginBottom:1}}>Seguimientos</div>
        {critical.length>0&&<div style={{fontSize:10,color:"#ef4444",fontWeight:700}}>● {critical.length} crítico(s)</div>}
        <div style={{fontSize:9,color:"#94a3b8"}}>{active.length} activos</div>
      </div>}
      <div style={{padding:"0 8px",flex:1}}>
        <div style={{fontSize:8,color:"#334155",fontWeight:700,textTransform:"uppercase",padding:"6px 2px 4px",letterSpacing:1}}>Proyectos</div>
        {projects.map(p=>(
          <button key={p.id} onClick={()=>{setSel(p.id);setProjTab("overview");setView("project");}} style={{width:"100%",padding:"7px 9px",borderRadius:5,background:sel===p.id?"#1e3a5f":"transparent",border:sel===p.id?"1px solid #1d4ed830":"1px solid transparent",cursor:"pointer",textAlign:"left",marginBottom:2}}>
            <div style={{fontSize:10,fontWeight:sel===p.id?700:400,color:sel===p.id?"#e2e8f0":"#94a3b8",lineHeight:1.3,marginBottom:3}}>{p.name}</div>
            <span style={{fontSize:8,padding:"1px 5px",borderRadius:5,background:(ST[p.status]||C.sub)+"25",color:ST[p.status]||C.sub,fontWeight:700}}>{p.status}</span>
          </button>
        ))}
      </div>
      <div style={{padding:"8px"}}>
        <Btn onClick={()=>{setForm({name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""});setEditId(null);setShowForm(true);}} color="#1d4ed8" style={{width:"100%",justifyContent:"center",fontSize:10}}>+ Proyecto</Btn>
      </div>
    </div>
  );

  const hdr=(
    <div style={{background:C.ink,color:"#fff",padding:mob?"11px 14px":"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:7,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
        {mob&&(view==="project"||view==="chat")&&<button onClick={()=>{setView("dash");setSel(null);}} style={{background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",padding:0}}>←</button>}
        <div style={{flex:1,minWidth:0}}>
          {view==="project"&&proj?(
            renaming===proj.id?(
              <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onBlur={()=>{if(renameVal.trim())setProjects(p=>p.map(x=>x.id===renaming?{...x,name:renameVal.trim()}:x));setRenaming(null);}} onKeyDown={e=>{if(e.key==="Enter"&&renameVal.trim()){setProjects(p=>p.map(x=>x.id===renaming?{...x,name:renameVal.trim()}:x));setRenaming(null);}if(e.key==="Escape")setRenaming(null);}} style={{fontSize:13,fontWeight:800,background:"transparent",border:"none",borderBottom:"2px solid #3b82f6",color:"#fff",outline:"none",width:"100%"}}/>
            ):<div onClick={()=>{setRenaming(proj.id);setRenameVal(proj.name);}} style={{fontSize:13,fontWeight:800,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name} <span style={{fontSize:10,color:"#475569"}}>✏</span></div>
          ):(
            <div style={{fontSize:14,fontWeight:800}}>SECPLA</div>
          )}
          {critical.length>0&&view!=="project"&&<div style={{fontSize:9,color:"#fca5a5"}}>● {critical.length} crítica(s)</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:5}}>
        {view==="project"&&proj&&(<><input ref={fileRef} type="file" accept=".pdf,image/*" onChange={uploadDoc} style={{display:"none"}}/><Btn onClick={()=>fileRef.current?.click()} disabled={extracting} color="#1e3a5f" style={{padding:"5px 10px",fontSize:11}}>{extracting?"⏳":"📎"}</Btn></>)}
        {mob&&<Btn onClick={()=>setView(v=>v==="chat"?"dash":"chat")} color={view==="chat"?"#1d4ed8":"#1e293b"} style={{padding:"5px 10px",fontSize:12}}>🤖</Btn>}
        {!mob&&<Btn onClick={()=>setView(v=>v==="chat"?"dash":"chat")} color={view==="chat"?"#1d4ed8":"#1e293b"} style={{padding:"6px 12px",fontSize:11}}>{view==="chat"?"✕ Chat":"🤖 Asistente"}</Btn>}
      </div>
    </div>
  );

  const mobileNav=mob&&(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {[["dash","◈","Inicio"],["chat","◉","Asistente"]].map(([v,ic,lbl])=>(
        <button key={v} onClick={()=>{if(view!==v){if(v==="dash")setSel(null);setView(v);} }} style={{flex:1,padding:"10px 4px 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:17}}>{ic}</span>
          <span style={{fontSize:10,fontWeight:view===v?700:400,color:view===v?C.blue:C.dim}}>{lbl}</span>
          {view===v&&<div style={{width:16,height:2,background:C.blue,borderRadius:2}}/>}
        </button>
      ))}
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,overflow:"hidden",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      {hdr}
      <div style={{flex:1,overflow:"hidden",display:"flex"}}>
        {sidebar}
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {mob?(
            <div style={{flex:1,overflow:"hidden"}}>
              {view==="dash"&&dashView}
              {view==="project"&&proj&&projView}
              {view==="chat"&&chatView}
            </div>
          ):(
            <>
              {view==="dash"&&<div style={{flex:1,overflow:"hidden"}}>{dashView}</div>}
              {view==="project"&&proj&&projView}
              {view==="chat"&&(
                <div style={{width:340,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
                  <div style={{padding:"9px 13px",background:C.ink,color:"#fff",flexShrink:0}}>
                    <div style={{fontWeight:700,fontSize:11}}>◉ Asistente SECPLA</div>
                    <div style={{fontSize:9,color:"#475569",marginTop:1}}>Cartera · Seguimientos · Cotizaciones</div>
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
