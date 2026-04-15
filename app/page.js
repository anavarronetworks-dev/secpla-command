"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── ESCALA GLOBAL DE FUENTE ─────────────────────────────
const F = (n) => `${Math.round(n * 1.5)}px`;

// ── helpers ────────────────────────────────────────────
const fCLP = n => !n ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`;
const fDate = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fDateTime = iso => {
  if(!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}) + " " +
           d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
  } catch { return "—"; }
};
const uid = () => Math.random().toString(36).slice(2,9);

const STAGES = ["Formulación","Diseño","Licitación","Adjudicación","Ejecución","Recepción","Completado","Archivado"];
const STATUSES = ["En curso","Pendiente","Detenido","Completado","Con alerta"];
const FINANCIERS = ["GORE","SPD","Municipal","MININT","FNDR","Otro"];
const SC = {"En curso":"#3b82f6","Pendiente":"#f59e0b","Detenido":"#ef4444","Completado":"#22c55e","Con alerta":"#f97316"};
const MPC = {"Publicada":"#059669","En proceso":"#3b82f6","Cerrada":"#f59e0b","Adjudicada":"#7c3aed","Desierta":"#ef4444","Revocada":"#ef4444"};
const UC = {"crítica":"#ef4444","alta":"#f97316","media":"#f59e0b"};
const UL = {"crítica":"🔴","alta":"🟠","media":"🟡"};

// ── KEYWORDS por proyecto para clasificación auto ──────
// Usados para mapear correos/eventos de Gmail y Calendar
const PROJ_KEYWORDS = {
  p1: ["6ta comisaría","6ta comisaria","comisaría","comisaria","habilitación tecnológica","1431841-10-LE25","empalme eléctrico","ENEL"],
  p2: ["SNSM23-STP-0039","SNSM2025","SNSM25","integración cámaras","televigilancia","bionic vision","scharfstein","rocktech","grupovsm","ficha modificación plazo","SNSM25-STP-0113","sievap"],
  p3: ["CCTV centros culturales","centros culturales","CDP N°79","licitación CCTV"],
  p4: ["UV32","UV N°32","cámaras UV","BNUP","adjudicación UV","40066179"],
  p5: ["sala de monitoreo","consistorial","trato directo","securitas","prosegur","torre telecom","1431841-10-B226","sala monitoreo"],
};

// Detecta a qué proyecto pertenece un texto
const detectProject = (text="") => {
  const t = text.toLowerCase();
  for(const [pid, keywords] of Object.entries(PROJ_KEYWORDS)){
    if(keywords.some(k => t.includes(k.toLowerCase()))) return pid;
  }
  return null;
};

// ── SOLICITUDES DE JEFATURA ────────────────────────────
const BOSS_INIT = [
  {id:"b1",from:"María Paz Juica",email:"mjuica@recoleta.cl",projectId:"p5",urgency:"crítica",
   task:"Preparar presentación diagnóstico de las 3 salas de cámaras (pros y contras) para reunión Alcaldía el miércoles 15 abril 13:00 hrs.",
   requestDate:"2026-04-10",status:"pendiente",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d790219c18994c"},
  {id:"b2",from:"María Paz Juica",email:"mjuica@recoleta.cl",projectId:"p2",urgency:"alta",
   task:"Revisar y subsanar observaciones del proyecto código SNSM25-STP-0113. Plazo máximo: 15 días desde el 9 abril.",
   requestDate:"2026-04-09",status:"pendiente",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc"},
  {id:"b3",from:"María Paz Juica",email:"mjuica@recoleta.cl",projectId:"p2",urgency:"alta",
   task:"Confirmar recepción de Certificados BNUP del proyecto SNSM2025. Solo se tienen Certificados de Número. Los BNUP aún no han llegado según tu respuesta del 13 abr.",
   requestDate:"2026-04-13",status:"pendiente",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4"},
  {id:"b4",from:"María Paz Juica",email:"mjuica@recoleta.cl",projectId:"p5",urgency:"media",
   task:"Gestionar Decreto que modifica Comisión Evaluadora para poder procesar el Informe de licitación desierta Sala Monitoreo.",
   requestDate:"2026-04-10",status:"pendiente",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d3f351893aaf74"},
  {id:"b5",from:"María Paz Juica",email:"mjuica@recoleta.cl",projectId:"p1",urgency:"media",
   task:"Enviar antecedentes corregidos 6ta Comisaría con SECPLA como ITS del proyecto según indicación de Administración.",
   requestDate:"2026-04-06",status:"completado",completedNote:"Entregado el 8 abril con proyecto completo.",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d1c4a8a983aa5c"},
  {id:"b6",from:"María Paz Juica",email:"mjuica@recoleta.cl",projectId:"p3",urgency:"media",
   task:"Dejar documentos licitación CCTV Centros Culturales en carpeta 01_Licitacion y completar planilla LICITACIONES_Seguimiento.",
   requestDate:"2026-03-25",status:"completado",completedNote:"Subidos el mismo día 25 marzo.",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d2665ac1e575ac"},
  {id:"b7",from:"Grace Arcos",email:"garcos@recoleta.cl",projectId:"p5",urgency:"alta",
   task:"Reunión Opciones Sala de Televigilancia — miércoles 15 abril 13:00 hrs. Llevar diagnóstico de las 3 opciones según solicitud de María Paz.",
   requestDate:"2026-04-08",status:"pendiente",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d6dc78c627480e"},
  {id:"b8",from:"Grace Arcos",email:"garcos@recoleta.cl",projectId:"p1",urgency:"alta",
   task:"Seguimiento empalme eléctrico 6ta Comisaría — reunión miércoles 15 abril. Grace confirmó asistencia. DOM gestiona con ENEL con documentación del Alcalde.",
   requestDate:"2026-04-13",status:"pendiente",
   threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d892c228474fcc"},
];

// ── DÍAS CORRIDOS SIEVAP ───────────────────────────────
const SIEVAP_START    = new Date("2026-04-09T00:00:00");
const SIEVAP_DEADLINE = new Date("2026-04-24T23:59:59");
const SIEVAP_TOTAL    = 15;

function daysBetween(from, to){
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

// ── RELOJ CONTROL ─────────────────────────────────────
const JORNADA_MIN = 9 * 60;
const isFri = d => new Date(d+"T12:00:00").getDay()===5;
const jornada = d => isFri(d) ? 480 : 540;
const ALL_CLOCK = [
  {date:"2026-01-29",entrada:null,salida:"16:53"},
  {date:"2026-01-30",entrada:"07:43",salida:"15:46"},
  {date:"2026-02-04",entrada:"07:48",salida:"17:00"},
  {date:"2026-02-05",entrada:"07:42",salida:"16:44"},
  {date:"2026-02-06",entrada:"08:05",salida:"16:13"},
  {date:"2026-02-09",entrada:"08:15",salida:"17:21"},
  {date:"2026-02-10",entrada:"08:37",salida:"17:40"},
  {date:"2026-02-11",entrada:"07:44",salida:"16:56"},
  {date:"2026-02-12",entrada:"07:44",salida:"16:56"},
  {date:"2026-02-13",entrada:"08:15",salida:null},
  {date:"2026-02-16",entrada:"07:40",salida:"17:05"},
  {date:"2026-02-17",entrada:"07:42",salida:"16:52"},
  {date:"2026-02-18",entrada:"07:57",salida:"17:04"},
  {date:"2026-02-19",entrada:"07:26",salida:"16:34"},
  {date:"2026-02-20",entrada:"07:50",salida:"15:59"},
  {date:"2026-02-23",entrada:"07:45",salida:"16:50"},
  {date:"2026-02-24",entrada:"07:49",salida:"16:53"},
  {date:"2026-02-25",entrada:null,salida:"17:07"},
  {date:"2026-02-26",entrada:"07:41",salida:"16:54"},
  {date:"2026-02-27",entrada:"07:54",salida:"16:08"},
  {date:"2026-03-02",entrada:"08:35",salida:"17:38"},
  {date:"2026-03-03",entrada:"08:25",salida:"17:41"},
  {date:"2026-03-04",entrada:"08:29",salida:"17:36"},
  {date:"2026-03-05",entrada:"08:26",salida:"17:31"},
  {date:"2026-03-06",entrada:"08:21",salida:"16:28"},
  {date:"2026-03-09",entrada:"08:24",salida:"17:40"},
  {date:"2026-03-10",entrada:"08:36",salida:"17:40"},
  {date:"2026-03-11",entrada:"08:14",salida:"17:27"},
  {date:"2026-03-12",entrada:"08:34",salida:"17:44"},
  {date:"2026-03-13",entrada:"08:32",salida:"16:46"},
  {date:"2026-03-16",entrada:"08:26",salida:"17:29"},
  {date:"2026-03-17",entrada:"08:21",salida:"17:33"},
  {date:"2026-03-18",entrada:"08:18",salida:"17:28"},
  {date:"2026-03-19",entrada:"08:21",salida:"17:25"},
  {date:"2026-03-20",entrada:"08:16",salida:"16:12"},
  {date:"2026-03-23",entrada:"08:39",salida:"17:48"},
  {date:"2026-03-24",entrada:"08:19",salida:"17:24"},
  {date:"2026-03-25",entrada:"08:27",salida:"17:40"},
  {date:"2026-03-30",entrada:"08:33",salida:"17:36"},
  {date:"2026-03-31",entrada:"08:28",salida:"17:33"},
  {date:"2026-04-01",entrada:"08:31",salida:"17:36"},
  {date:"2026-04-02",entrada:"08:34",salida:"17:32"},
  {date:"2026-04-06",entrada:"08:18",salida:"17:25"},
  {date:"2026-04-07",entrada:"08:42",salida:"18:26"},
  {date:"2026-04-08",entrada:"08:26",salida:"17:28"},
  {date:"2026-04-09",entrada:"08:40",salida:"17:41"},
  {date:"2026-04-10",entrada:"08:21",salida:"16:34"},
  {date:"2026-04-13",entrada:"08:26",salida:"17:37"},
  {date:"2026-04-14",entrada:"08:30",salida:"17:36"},
  {date:"2026-04-15",entrada:"08:24",salida:null}
];

const toMin=t=>{if(!t)return null;const[h,m]=t.split(":").map(Number);return h*60+m;};
const fMin=m=>{const a=Math.abs(m);const h=Math.floor(a/60);const mn=a%60;return h>0?`${h}h ${mn}m`:`${mn}m`;};
const MONTHS_ES=["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const GF_INIT = [
  {id:"gf4",projectId:"p5",urgency:"crítica",subject:"2do Llamado Trato Directo — Sala Monitoreo Consistorial (2 emails fallidos)",to:"Securitas / Prosegur",context:"Plazo límite 16 abril. 2 correos rebotaron: comercial@securitas.cl (dominio no existe) y ventas.empresas@prosegur.com (usuario desconocido). Hay que encontrar emails correctos de ambas empresas HOY.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d73316aebeb956"},
  {id:"gf8",projectId:"p5",urgency:"alta",subject:"Factibilidad uso Torre Telecom — Sala Monitoreo Consistorial",to:"Francisco Moscoso (fmoscoso@recoleta.cl)",context:"Solicitud de pronunciamiento y autorización para usar Torre Telecom del edificio consistorial como repetidor 5GHz. Solo llegaron acuses de lectura de Elizabeth Nuñez y Hernan Aravena. Francisco Moscoso no ha respondido en 12 días.",sentDate:"2026-04-01",daysPending:12,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d4aa05342a51ac"},
  {id:"gf2",projectId:"p2",urgency:"alta",subject:"Modificación Plazo SNSM23-STP-0039 — Ficha subsanada enviada a SPD",to:"Osvaldo Muñoz Vallejos — SPD (omunoz@minsegpublica.gob.cl)",context:"Ficha modificación con observaciones subsanadas enviada el 7 abril. SPD no ha confirmado aprobación ni cierre del SIGE 22004928.",sentDate:"2026-04-07",daysPending:6,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d1ab5d03fb53ce"},
  {id:"gf3",projectId:"p2",urgency:"alta",subject:"Cotización SNSM2025 — Scharfstein (3er seguimiento sin respuesta)",to:"Sebastian Merino / Cristobal Cruz (smerino@scharfstein.cl)",context:"Cotización solicitada el 11 marzo. 3er seguimiento enviado el 10 abril. Aún sin cotización formal.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19cddd6313f40188"},
  {id:"gf5",projectId:"p2",urgency:"alta",subject:"Terreno Cotización SNSM2025 — Visita Bionic Vision el 16 abril",to:"Letxy Valero / Rocío Ponce — Bionic Vision (lvalero@bionicvision.cl)",context:"Bionic Vision confirmó visita técnica el jueves 16 abril. Punto de reunión: entrada edificio consistorial 12:00.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19cddcf7f6811369"},
  {id:"gf9",projectId:"p2",urgency:"media",subject:"Cotización SNSM2025 — Grupo VSM (sin respuesta)",to:"comunicaciones@grupovsm.cl / contacto@grupovsm.cl",context:"Cotización enviada el 10 abril. Sin respuesta aún.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#sent/19d7903232724e7a"},
  {id:"gf10",projectId:"p2",urgency:"media",subject:"Cotización SNSM2025 — RockTech (sin respuesta)",to:"fabiana.rifo@rocktechla.com / sergio@rocktechla.com",context:"Cotización enviada el 10 abril. Sin respuesta aún.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#sent/19d790b9da51a58a"},
  {id:"gf1",projectId:"p1",urgency:"alta",subject:"6ta Comisaría — Empalme eléctrico ENEL pendiente (reunión 15 abr)",to:"DOM / Grace Arcos (garcos@recoleta.cl)",context:"DOM se comprometió a gestionar empalme eléctrico con ENEL. Reunión de seguimiento 15 abril.",sentDate:"2026-03-30",daysPending:14,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d3f87fce8e5784"},
  {id:"gf11",projectId:"p1",urgency:"alta",subject:"6ta Comisaría — Corrección antecedentes: SECPLA como ITS del proyecto",to:"María Paz Juica (mjuica@recoleta.cl)",context:"Entregado el 8 abril. Confirmar si fue aceptado correctamente.",sentDate:"2026-04-08",daysPending:5,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d1c4a8a983aa5c"},
  {id:"gf6",projectId:"p3",urgency:"alta",subject:"CCTV Centros Culturales — CDP emitido, iniciar licitación en MP",to:"María Paz Juica / Alvaro Porzio (aporzio@recoleta.cl)",context:"CDP N°79 emitido el 1 abril. Pendiente confirmar ingreso a Mercado Público y fecha de publicación.",sentDate:"2026-04-01",daysPending:12,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d2665ac1e575ac"},
  {id:"gf7",projectId:"p4",urgency:"media",subject:"Cámaras UV N°32 — Certificados BNUP pendientes de respuesta",to:"María Paz Juica (mjuica@recoleta.cl)",context:"Al 13 abril solo hay Certificados de Número. Los BNUP aún no han llegado. Adjudicación programada para el 30 de abril.",sentDate:"2026-04-13",daysPending:0,status:"pendiente",threadUrl:"https://mail.google.com/a/recoleta.cl/#all/19d871327ac64df4"},
];

const INIT_P = [
  {id:"p1",name:"Servicio de Habilitación Tecnológica 6ta Comisaría",budget:40000000,stage:"Formulación",status:"En curso",deadline:"",financier:"SPD",program:"FNSP",desc:"Servicio de habilitación tecnológica sala de televigilancia en la Sexta Comisaría de Carabineros de Recoleta. ID convenio referencia: 1431841-10-LE25. Pendiente definición de ITS y empalme eléctrico con ENEL.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p2",name:"Integración de Cámaras de Televigilancia en la Comuna de Recoleta",budget:100000000,stage:"Licitación",status:"En curso",deadline:"",financier:"SPD",program:"SNSM 2025",codigoProyecto:"SNSM25-STP-0113",codigoSIGE:"22004928",desc:"Integración de cámaras de televigilancia. 7 postaciones nuevas galvanizadas 15m, cámaras PTZ reconocimiento facial y ANPR, transmisión inalámbrica. ID SPD: SNSM23-STP-0039. Ficha de modificación de plazo enviada a SPD pendiente aprobación.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p3",name:"Sistemas de CCTV, Centros Culturales",budget:26000000,stage:"Licitación",status:"En curso",deadline:"",financier:"SPD",program:"FNSP",codigoProyecto:"CDP N°79",desc:"Sistema de CCTV para centros culturales de Recoleta. CDP N°79 emitido. Antecedentes entregados a SECPLA el 25 marzo. Pendiente publicación en Mercado Público.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p4",name:"Cámaras de Televigilancia UV N°32",budget:914371153,stage:"Adjudicación",status:"En curso",deadline:"2026-04-30",financier:"GORE RM",program:"FNDR",codigoProyecto:"BIP 40066179-0",desc:"Cámaras de vigilancia urbana para sectores de Recoleta. Adjudicación programada para el 30 de abril. Pendiente recepción de BNUP.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p5",name:"Habilitación Sala de Monitoreo Edificio Consistorial e Integración Puntos de Cámaras",budget:100000000,stage:"Licitación",status:"Con alerta",deadline:"2026-06-30",financier:"SPD",program:"SNSM 2023",codigoProyecto:"SNSM23-STP-0039 / SNSM23-CMP-0010",codigoSIGE:"21460117",desc:"Habilitación sala de monitoreo en edificio consistorial e integración puntos de cámaras. Licitación pública LP25 desierta (dic 2025), LP26 revocada (feb 2026). Actualmente en trato directo. Convenio SPD aprobado REX 1347 (29-jun-2023).",notes:"",aiSummary:"",licitId:"1431841-68-LP25",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[],convenio:{suscripcion:"2023-06-05",plazoEjecucionFin:"2026-06-30",plazoConvenioFin:"2026-09-30",modificaciones:[{tipo:"Mod. técnica intraítem",oficio:"N°1258 SPD",aprobacion:"2025-05-20",estado:"aprobada"},{tipo:"Ampliación plazo 13 meses",oficio:"N°2321 SPD",aprobacion:"2025-09-04",estado:"aprobada"}]}}
];
const EF = {name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""};

// ── ESTADO INICIAL DRIVE ──────────────────────────────
// driveData: { projectId: { files:[], lastSync: iso } }
// calendarEvents: [ { id, title, start, time, description, projectId, url } ]
// answeredRequests: [ { id, taskId, subject, sentDate, sentTime, emailUrl, howAnswered, pendingReply } ]

function useW(){const[w,sw]=useState(900);useEffect(()=>{sw(window.innerWidth);const h=()=>sw(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return w;}

function st(){
  const get=k=>{if(typeof window==="undefined")return null;try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}};
  const set=(k,v)=>{if(typeof window==="undefined")return;try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
  return{get,set};
}

export default function Page(){
  const w=useW();const mob=w<768;const S=st();
  const[projects,setProjects]=useState(()=>S.get("sp_proj")||INIT_P);
  const[gf,setGf]=useState(()=>S.get("sp_gf")||GF_INIT);
  const[boss,setBoss]=useState(()=>S.get("sp_boss")||BOSS_INIT);
  // clockData: array dinámico. ALL_CLOCK es la semilla histórica,
  // se sobreescribe al sincronizar con Gmail via clock_sync
  const[clockData,setClockData]=useState(()=>{
    const saved=S.get("sp_clock_data");
    // Merge: usar guardado si es más reciente, sino usar ALL_CLOCK
    if(saved&&Array.isArray(saved)&&saved.length>=ALL_CLOCK.length) return saved;
    return ALL_CLOCK;
  });
  const[clockMonth,setClockMonth]=useState("2026-04");
  const[clockOpen,setClockOpen]=useState(false);
  const[clockLiveData,setClockLiveData]=useState(()=>S.get("sp_clock_live")||{});
  const[checkingClock,setCheckingClock]=useState(false);

  // ── SCHEDULER ─────────────────────────────────────────────────────
  // Horarios automáticos en hora Chile (America/Santiago)
  // Reloj: 08:00 · 13:30 · 17:30  →  3 veces/día L-V
  // Acuses: 08:05 · 11:00 · 14:00 · 17:35  →  4 veces/día L-V
  // Granularidad: el setInterval verifica cada minuto si toca ejecutar
  const CLOCK_SLOTS  = ["08:00","13:30","17:30"];
  const RECEIPT_SLOTS = ["08:05","11:00","14:00","17:35"];
  const schedulerRef = useRef(null);
  const[readReceipts,setReadReceipts]=useState(()=>S.get("sp_receipts")||[]);
  const[syncingReceipts,setSyncingReceipts]=useState(false);
  // schedLog: registro de cada ejecución del scheduler con resultado
  const[schedLog,setSchedLog]=useState(()=>S.get("sp_sched_log")||[]);
  const[showSchedLog,setShowSchedLog]=useState(false);
  const saveSchedLog = entries => { setSchedLog(entries); S.set("sp_sched_log",entries); };

  // ── syncClockFromGmail: lee TODOS los registros desde Gmail ─────────────
  // Se llama manualmente (botón Reloj) o automáticamente en ventanas 09:30/18:20 L-V
  const syncClockFromGmail = async (silent=false) => {
    if(!silent) setSyncStatus(p=>({...p,reloj:{state:"loading",ts:null,msg:"Leyendo Gmail..."}}));
    setCheckingClock(true);
    try {
      const res = await fetch("/api/ai", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ type: "clock_sync", since: "2026/01/01" })
      });
      if(!res.ok) {
        const errData = await res.json().catch(()=>({}));
        const code = errData.errorCode||res.status;
        setSyncStatus(p=>({...p,reloj:{state:"error",ts:new Date().toISOString(),msg:`Error ${code}: ${errData.errorMessage||"falla de red"}`,code}}));
        return;
      }
      const data = await res.json();
      if(data.error) {
        setSyncStatus(p=>({...p,reloj:{state:"error",ts:new Date().toISOString(),msg:`${data.errorCode}: ${data.errorMessage}`,code:data.errorCode}}));
        return;
      }
      let newData;
      try { newData = JSON.parse((data.text||"[]").replace(/```json|```/g,"").trim()); }
      catch { newData = []; }
      if(Array.isArray(newData) && newData.length > 0){
        // Merge: preservar entradas históricas no cubiertas por Gmail
        const gmailDates = new Set(newData.map(r=>r.date));
        const historical = ALL_CLOCK.filter(r=>!gmailDates.has(r.date));
        const merged = [...historical, ...newData].sort((a,b)=>a.date.localeCompare(b.date));
        setClockData(merged);
        S.set("sp_clock_data", merged);
        const today = newData.find(r=>r.date===new Date().toISOString().slice(0,10));
        const msg = today
          ? `✓ ${newData.length} días · Hoy: Entrada ${today.entrada||"—"} · Salida ${today.salida||"en curso"}`
          : `✓ ${newData.length} días sincronizados`;
        setSyncStatus(p=>({...p,reloj:{state:"ok",ts:new Date().toISOString(),msg}}));
      } else {
        setSyncStatus(p=>({...p,reloj:{state:"warn",ts:new Date().toISOString(),msg:"No se encontraron registros en Gmail"}}));
      }
    } catch(e) {
      setSyncStatus(p=>({...p,reloj:{state:"error",ts:new Date().toISOString(),msg:`Excepción: ${e.message}`,code:"EXCEPTION"}}));
    }
    setCheckingClock(false);
  };

  // ── syncReadReceipts: lee acuses de lectura desde Gmail ─────────────
  const syncReadReceipts = async (silent=false) => {
    if(!silent) setSyncStatus(p=>({...p,acuses:{state:"loading",ts:null,msg:"Leyendo acuses de lectura..."}}));
    setSyncingReceipts(true);
    const startTs = new Date().toISOString();
    try {
      const res = await fetch("/api/ai", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ type:"read_receipts_sync", since:"2026/01/01" })
      });
      if(!res.ok){
        const errData = await res.json().catch(()=>({}));
        const code = errData.errorCode||String(res.status);
        const msg = `HTTP_${code}: ${errData.errorMessage||res.statusText||"Error de red"}`;
        setSyncStatus(p=>({...p,acuses:{state:"error",ts:startTs,msg,code}}));
        addSchedLog("acuses","error",msg,code);
        return;
      }
      const data = await res.json();
      if(data.error){
        const msg = `${data.errorCode}: ${data.errorMessage}`;
        setSyncStatus(p=>({...p,acuses:{state:"error",ts:startTs,msg,code:data.errorCode}}));
        addSchedLog("acuses","error",msg,data.errorCode);
        return;
      }
      let receipts;
      try { receipts = JSON.parse((data.text||"[]").replace(/```json|```/g,"").trim()); }
      catch(parseErr) {
        const msg = `JSON_PARSE: ${parseErr.message} — respuesta: ${(data.text||"").slice(0,80)}`;
        setSyncStatus(p=>({...p,acuses:{state:"error",ts:startTs,msg,code:"JSON_PARSE"}}));
        addSchedLog("acuses","error",msg,"JSON_PARSE");
        return;
      }
      if(Array.isArray(receipts)){
        setReadReceipts(receipts);
        S.set("sp_receipts", receipts);
        const totalConf = receipts.reduce((a,e)=>a+(e.recipients?.filter(r=>r.readAt).length||0),0);
        const msg = `✓ ${receipts.length} correos · ${totalConf} confirmaciones de lectura`;
        setSyncStatus(p=>({...p,acuses:{state:"ok",ts:startTs,msg}}));
        addSchedLog("acuses","ok",msg,null);
      } else {
        const msg = "EMPTY: respuesta no es un array válido";
        setSyncStatus(p=>({...p,acuses:{state:"warn",ts:startTs,msg}}));
        addSchedLog("acuses","warn",msg,null);
      }
    } catch(e) {
      const code = e.name==="AbortError"?"TIMEOUT":e.name==="TypeError"?"NETWORK":e.code||"EXCEPTION";
      const msg = `${code}: ${e.message}`;
      setSyncStatus(p=>({...p,acuses:{state:"error",ts:startTs,msg,code}}));
      addSchedLog("acuses","error",msg,code);
    }
    setSyncingReceipts(false);
  };

  // ── addSchedLog: añade una entrada al registro de ejecuciones ─────
  const addSchedLog = (type, result, msg, code) => {
    const entry = {
      id: Math.random().toString(36).slice(2,7),
      type,         // "reloj" | "acuses"
      result,       // "ok" | "warn" | "error"
      msg,
      code: code||null,
      ts: new Date().toISOString(),
    };
    setSchedLog(prev => {
      const updated = [entry, ...prev].slice(0,50); // máximo 50 entradas
      S.set("sp_sched_log", updated);
      return updated;
    });
  };

  // ── MOTOR DE SCHEDULING AUTOMÁTICO ───────────────────────────────
  // Funciona como un cron interno: verifica cada 60 segundos si
  // la hora Chile actual coincide con algún slot configurado.
  // Si coincide Y no ejecutó ese slot en las últimas 50 minutos → ejecuta.
  // Usa refs para evitar closures stale.
  const syncClockRef = useRef(null);
  const syncReceiptsRef = useRef(null);
  syncClockRef.current = syncClockFromGmail;
  syncReceiptsRef.current = syncReadReceipts;

  useEffect(()=>{
    // Helper: hora actual en Chile "HH:MM"
    const nowChileHHMM = () => {
      const d = new Date(new Date().toLocaleString("en-US",{timeZone:"America/Santiago"}));
      return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    };
    // Helper: día de semana Chile (1=Lun … 5=Vie)
    const dowChile = () => {
      const d = new Date(new Date().toLocaleString("en-US",{timeZone:"America/Santiago"}));
      return d.getDay();
    };
    // Helper: ¿el slot ya ejecutó recientemente? (últimos 50 min)
    const alreadyRan = (type, slotHHMM) => {
      const key = `sp_last_auto_${type}_${slotHHMM.replace(":","_")}`;
      const last = localStorage.getItem(key);
      if(!last) return false;
      const mins = (Date.now()-new Date(last).getTime())/60000;
      return mins < 50;
    };
    const markRan = (type, slotHHMM) => {
      const key = `sp_last_auto_${type}_${slotHHMM.replace(":","_")}`;
      localStorage.setItem(key, new Date().toISOString());
    };

    const tick = () => {
      const dow = dowChile();
      if(dow<1||dow>5) return; // solo L-V
      const hhmm = nowChileHHMM();

      // ── Reloj: 08:00 · 13:30 · 17:30 ──
      for(const slot of ["08:00","13:30","17:30"]){
        if(hhmm===slot && !alreadyRan("reloj",slot)){
          markRan("reloj",slot);
          syncClockRef.current(true); // silent=true
        }
      }
      // ── Acuses: 08:05 · 11:00 · 14:00 · 17:35 ──
      for(const slot of ["08:05","11:00","14:00","17:35"]){
        if(hhmm===slot && !alreadyRan("acuses",slot)){
          markRan("acuses",slot);
          syncReceiptsRef.current(true);
        }
      }
    };

    // Ejecutar inmediatamente al montar (por si el tab se abrió justo en un slot)
    tick();
    // Luego verificar cada 60 segundos
    schedulerRef.current = setInterval(tick, 60000);
    return () => {
      if(schedulerRef.current) clearInterval(schedulerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const[sel,setSel]=useState(null);const[tab,setTab]=useState("overview");const[view,setView]=useState("dash");
  // ── NUEVOS ESTADOS ─────────────────────────────────
  const[mainTab,setMainTab]=useState("dash"); // "dash" | "answered" | "calendar"
  const[calendarEvents,setCalendarEvents]=useState(()=>S.get("sp_cal")||[]);
  const[answeredRequests,setAnsweredRequests]=useState(()=>S.get("sp_answered")||[]);
  const[driveSync,setDriveSync]=useState(()=>S.get("sp_drive")||{});
  const[syncingDrive,setSyncingDrive]=useState(false);
  const[syncingCal,setSyncingCal]=useState(false);
  const[verifyingTask,setVerifyingTask]=useState(null);
  // syncStatus: estado visual por cada botón de sincronización
  // state: "idle"|"loading"|"ok"|"warn"|"error"
  const[syncStatus,setSyncStatus]=useState(()=>S.get("sp_sync_status")||{
    drive:   {state:"idle",ts:null,msg:""},
    cal:     {state:"idle",ts:null,msg:""},
    gmail:   {state:"idle",ts:null,msg:""},
    reloj:   {state:"idle",ts:null,msg:""},
    convenio:{state:"idle",ts:null,msg:""},
    acuses:  {state:"idle",ts:null,msg:""},
  });
  const saveSyncStatus=s=>{setSyncStatus(s);S.set("sp_sync_status",s);};
  // ──────────────────────────────────────────────────
  const[msgs,setMsgs]=useState([{role:"assistant",content:"Hola Alexis 👋\n\nSoy tu Asistente SECPLA. Conozco tu cartera, seguimientos de Gmail, licitaciones y documentos.\n\nEjemplos:\n• ¿Qué seguimientos están críticos?\n• ¿Cuándo vence el plazo de la sala de monitoreo?\n• Resumen ejecutivo para reunión con el Alcalde"}]);
  const[input,setInput]=useState("");const[loading,setLoading]=useState(false);
  const[showForm,setShowForm]=useState(false);const[form,setForm]=useState(EF);const[editId,setEditId]=useState(null);
  const[extracting,setExtracting]=useState(false);const[fetchingLicit,setFetchingLicit]=useState(null);
  const[renamingId,setRenamingId]=useState(null);const[renameVal,setRenameVal]=useState("");
  const[notesDraft,setNotesDraft]=useState("");const[genSum,setGenSum]=useState(false);
  const[newTask,setNewTask]=useState("");
  const[emailForm,setEmailForm]=useState({from:"",subject:"",date:"",body:""});const[addingEmail,setAddingEmail]=useState(false);
  const chatRef=useRef(null);const fileRef=useRef(null);

  useEffect(()=>{if(sel){const p=projects.find(x=>x.id===sel);if(p)setNotesDraft(p.notes||"");}},[sel]);

  const saveP=ps=>{setProjects(ps);S.set("sp_proj",ps);};
  const saveGf=fs=>{setGf(fs);S.set("sp_gf",fs);};
  const saveBoss=bs=>{setBoss(bs);S.set("sp_boss",bs);};
  const saveCal=evs=>{setCalendarEvents(evs);S.set("sp_cal",evs);};
  const saveAnswered=ar=>{setAnsweredRequests(ar);S.set("sp_answered",ar);};
  const saveDriveSync=ds=>{setDriveSync(ds);S.set("sp_drive",ds);};

  const proj=projects.find(p=>p.id===sel);
  const resolveFollow=(id)=>saveGf(gf.map(f=>f.id===id?{...f,status:"resuelto",resolvedAt:new Date().toISOString().slice(0,10)}:f));

  // ── HELPERS ─────────────────────────────────────────
  const pendingGf=gf.filter(f=>f.status==="pendiente");
  const criticalGf=pendingGf.filter(f=>f.urgency==="crítica");
  const totalBudget=projects.reduce((a,p)=>a+(p.budget||0),0);

  // Eventos de calendario para un proyecto específico
  const eventsForProject = (projId) =>
    calendarEvents.filter(e => e.projectId === projId || detectProject((e.title||"")+(e.description||"")) === projId);

  // ── SINCRONIZAR DRIVE ─────────────────────────────
  // ── DRIVE SYNC — lee carpetas reales con feedback visual ────────────
  const syncDrive = async () => {
    setSyncingDrive(true);
    setSyncStatus(p=>({...p,drive:{state:"loading",ts:null,msg:"Leyendo carpetas Drive..."}}));
    try {
      const res = await fetch("/api/ai", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          type: "drive_sync",
          projects: projects.map(p=>({
            id: p.id,
            name: p.name,
            code: p.licitId||"",
            keywords: PROJ_KEYWORDS[p.id]||[]
          }))
        })
      });
      const data = await res.json();
      let updates;
      try { updates = JSON.parse((data.text||"[]").replace(/```json|```/g,"").trim()); }
      catch { updates = []; }
      if(Array.isArray(updates) && updates.length > 0){
        const now = new Date().toISOString();
        const newDs = {...driveSync};
        const upd = projects.map(p => {
          const u = updates.find(x=>x.projectId===p.id);
          if(!u) return p;
          newDs[p.id] = {
            lastSync: now, summary: u.summary||"",
            docsFound: u.docsFound||[], lastDocDate: u.lastDocDate||""
          };
          return {
            ...p,
            desc: u.desc || p.desc,
            stage: u.stage || p.stage,
            status: u.status || p.status,
            notes: u.notes
              ? (p.notes ? p.notes+"\n\n[Drive "+now.slice(0,10)+"] "+u.notes : u.notes)
              : p.notes,
          };
        });
        saveP(upd);
        saveDriveSync(newDs);
        const nProj=updates.length;
        setSyncStatus(p=>({...p,drive:{state:"ok",ts:new Date().toISOString(),msg:`✓ ${nProj} proyecto(s) actualizados desde Drive`}}));
      } else {
        setSyncStatus(p=>({...p,drive:{state:"warn",ts:new Date().toISOString(),msg:"Drive conectado pero sin datos nuevos"}}));
      }
    } catch(e){
      console.error("Drive sync error", e);
      setSyncStatus(p=>({...p,drive:{state:"error",ts:new Date().toISOString(),msg:`Error: ${e.message}`,code:"DRIVE_EXCEPTION"}}));
    }
    setSyncingDrive(false);
  };

  // ── SINCRONIZAR CALENDARIO ────────────────────────
  // Llama a /api/ai con type:"calendar_sync" → devuelve eventos de los próximos 30 días
  // clasificados por proyecto usando PROJ_KEYWORDS.
  const syncCalendar = async () => {
    setSyncingCal(true);
    setSyncStatus(p=>({...p,cal:{state:"loading",ts:null,msg:"Buscando reuniones en Gmail..."}}));
    try {
      const res = await fetch("/api/ai", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          type: "calendar_sync",
          projects: projects.map(p=>({
            id: p.id,
            name: p.name,
            keywords: PROJ_KEYWORDS[p.id]||[]
          }))
        })
      });
      const data = await res.json();
      let evs;
      try { evs = JSON.parse((data.text||"[]").replace(/```json|```/g,"").trim()); }
      catch { evs = []; }
      if(Array.isArray(evs)){
        const classified = evs.map(e => ({
          ...e,
          projectId: e.projectId || detectProject((e.title||"")+(e.description||""))
        }));
        // Preservar eventos agregados manualmente (sin messageId de Gmail)
        const manual = calendarEvents.filter(e => !e.id || e.id.startsWith("manual_"));
        const merged = [...manual, ...classified.filter(e => !manual.find(m=>m.title===e.title&&m.start===e.start))];
        saveCal(merged);
        setSyncStatus(p=>({...p,cal:{state:"ok",ts:new Date().toISOString(),msg:`✓ ${merged.length} evento(s) · ${merged.filter(e=>e.start>=new Date().toISOString().slice(0,10)).length} próximos`}}));
      } else {
        setSyncStatus(p=>({...p,cal:{state:"warn",ts:new Date().toISOString(),msg:"No se encontraron reuniones próximas"}}));
      }
    } catch(e){
      console.error("Calendar sync error", e);
      setSyncStatus(p=>({...p,cal:{state:"error",ts:new Date().toISOString(),msg:`Error: ${e.message}`,code:"CAL_EXCEPTION"}}));
    }
    setSyncingCal(false);
  };

  // ── GMAIL SCAN — escaneo periódico de correos nuevos ─────────────
  // Detecta correos que requieren acción y los agrega como seguimientos
  const[convenioData,setConvenioData]=useState(()=>S.get("sp_convenio")||[]);
  const[trackingConvenio,setTrackingConvenio]=useState(false);

  const trackConvenios = async () => {
    setTrackingConvenio(true);
    try {
      const res = await fetch("/api/ai", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          type: "convenio_track",
          projects: projects.map(p=>({
            id: p.id, name: p.name,
            codigoProyecto: p.codigoProyecto||"",
            plazoEjecucionFin: p.convenio?.plazoEjecucionFin||p.deadline||"",
            plazoConvenioFin: p.convenio?.plazoConvenioFin||""
          }))
        })
      });
      const data = await res.json();
      let result;
      try { result = JSON.parse((data.text||"[]").replace(/```json|```/g,"").trim()); }
      catch { result = []; }
      if(Array.isArray(result) && result.length > 0){
        setConvenioData(result);
        S.set("sp_convenio", result);
        // Actualizar deadline en proyectos si hay datos nuevos
        const upd = projects.map(p=>{
          const cd = result.find(c=>c.projectId===p.id);
          if(!cd) return p;
          return {
            ...p,
            deadline: cd.plazoEjecucionFin || p.deadline,
            convenio: { ...(p.convenio||{}),
              plazoEjecucionFin: cd.plazoEjecucionFin,
              plazoConvenioFin: cd.plazoConvenioFin,
              modificacionesPendientes: cd.modificacionesPendientes||[]
            }
          };
        });
        saveP(upd);
      }
    } catch(e){ console.error("Convenio track error", e); }
    setTrackingConvenio(false);
  };

  const[scanningGmail,setScanningGmail]=useState(false);
  const[lastGmailScan,setLastGmailScan]=useState(()=>S.get("sp_last_scan")||null);

  const scanGmail = async () => {
    setScanningGmail(true);
    setSyncStatus(p=>({...p,gmail:{state:"loading",ts:null,msg:"Escaneando correos SECPLA..."}}));
    try {
      const since = new Date(Date.now() - 7*86400000).toISOString().slice(0,10).replace(/-/g,"/");
      const res = await fetch("/api/ai", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          type: "gmail_scan",
          since,
          projects: projects.map(p=>({
            id: p.id, name: p.name,
            keywords: PROJ_KEYWORDS[p.id]||[]
          }))
        })
      });
      const data = await res.json();
      let found;
      try { found = JSON.parse((data.text||"[]").replace(/```json|```/g,"").trim()); }
      catch { found = []; }

      if(Array.isArray(found) && found.length > 0){
        // Agregar correos que requieren acción como nuevos seguimientos
        const newFollows = found
          .filter(m => m.requiresResponse && m.type !== "informativo")
          .filter(m => !gf.find(f => f.threadUrl?.includes(m.threadId||m.messageId)))
          .map(m => ({
            id: "scan_"+m.messageId,
            projectId: m.projectId||"",
            urgency: m.urgency||"media",
            subject: m.subject||"(sin asunto)",
            to: m.from||"",
            context: m.summary||"",
            sentDate: m.date||new Date().toISOString().slice(0,10),
            daysPending: Math.floor((Date.now()-new Date(m.date||Date.now()).getTime())/86400000),
            status: "pendiente",
            threadUrl: m.emailUrl||"https://mail.google.com/mail/u/0/#inbox/"+m.messageId,
            autoDetected: true,
          }));
        if(newFollows.length > 0) saveGf([...gf, ...newFollows]);
      }
      const now = new Date().toISOString();
      setLastGmailScan(now);
      S.set("sp_last_scan", now);
      const nNew = newFollows.length;
      const nFound = Array.isArray(found)?found.length:0;
      setSyncStatus(p=>({...p,gmail:{state:"ok",ts:now,msg:`✓ ${nFound} correos encontrados${nNew>0?` · ${nNew} nuevo(s) seguimiento(s)`:""}`}}));
    } catch(e){
      console.error("Gmail scan error", e);
      setSyncStatus(p=>({...p,gmail:{state:"error",ts:new Date().toISOString(),msg:`Error: ${e.message}`,code:"GMAIL_EXCEPTION"}}));
    }
    setScanningGmail(false);
  };

  // ── VERIFICAR TAREA COMPLETADA EN GMAIL ──────────
  // Cuando el usuario marca una tarea/solicitud como completada,
  // busca en Gmail enviados si hay correo relacionado.
  // Actualiza answeredRequests con la evidencia encontrada.
  const verifyCompletion = async (taskId, taskText, projId) => {
    setVerifyingTask(taskId);
    try {
      const res = await fetch("/api/ai", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          type: "verify_sent",
          taskId,
          taskText,
          projectId: projId,
          projectName: projects.find(p=>p.id===projId)?.name || "",
          // Keywords del proyecto para buscar en Gmail
          keywords: PROJ_KEYWORDS[projId] || []
        })
      });
      const data = await res.json();
      // Esperamos: { found: bool, subject, sentDate, sentTime, emailUrl, snippet, howAnswered, pendingReply }
      let result;
      try { result = JSON.parse((data.text||"{}").replace(/```json|```/g,"").trim()); }
      catch { result = {found:false}; }

      const entry = {
        id: uid(),
        taskId,
        taskText,
        projectId: projId,
        verifiedAt: new Date().toISOString(),
        found: result.found || false,
        subject: result.subject || "",
        sentDate: result.sentDate || "",
        sentTime: result.sentTime || "",
        emailUrl: result.emailUrl || "",
        snippet: result.snippet || "",
        howAnswered: result.howAnswered || "",
        pendingReply: result.pendingReply || false,
        pendingReplyNote: result.pendingReplyNote || "",
      };
      saveAnswered([...answeredRequests, entry]);
    } catch(e){ console.error("Verify error", e); }
    setVerifyingTask(null);
  };

  // ── TOGGLE BOSS con verificación ─────────────────
  const toggleBoss = (id, note="") => {
    const b = boss.find(x=>x.id===id);
    const newStatus = b?.status==="pendiente" ? "completado" : "pendiente";
    saveBoss(boss.map(x=>x.id===id ? {
      ...x,
      status: newStatus,
      completedNote: note||x.completedNote,
      completedAt: new Date().toISOString().slice(0,10)
    } : x));
    // Al completar → verificar en Gmail si envié algo
    if(newStatus === "completado" && b){
      verifyCompletion(id, b.task, b.projectId);
    }
  };

  // ── LICITACIÓN ────────────────────────────────────
  const fetchLicit=async(p)=>{
    if(!p.licitId?.trim())return;setFetchingLicit(p.id);
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"licit",licitId:p.licitId})});
      const data=await res.json();
      let ld;try{ld=JSON.parse((data.text||"{}").replace(/```json|```/g,"").trim());}catch{ld={estado:"Desconocido",descripcion:"No se pudo extraer información."};}
      saveP(projects.map(x=>x.id===p.id?{...x,licitData:ld,licitChecked:new Date().toISOString().slice(0,10)}:x));
    }catch{}
    setFetchingLicit(null);
  };

  // ── RESUMEN IA ────────────────────────────────────
  const genSummary=async()=>{
    if(!proj||!notesDraft.trim())return;setGenSum(true);
    const upd=projects.map(p=>p.id===proj.id?{...p,notes:notesDraft}:p);saveP(upd);
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"summary",project:{name:proj.name,financier:proj.financier,program:proj.program,budget:fCLP(proj.budget),stage:proj.stage,status:proj.status},notes:notesDraft})});
      const data=await res.json();
      saveP(upd.map(p=>p.id===proj.id?{...p,aiSummary:data.text||""}:p));
    }catch{}
    setGenSum(false);
  };

  // ── CHAT CONTEXT ──────────────────────────────────
  const buildCtx=()=>projects.map(p=>{
    const ld=p.licitData;
    const pf=gf.filter(f=>f.projectId===p.id&&f.status==="pendiente");
    const evs=eventsForProject(p.id);
    return `PROYECTO: ${p.name}\n- Presupuesto: ${fCLP(p.budget)} CLP\n- Financiamiento: ${p.financier} — ${p.program}\n- Etapa: ${p.stage} | Estado: ${p.status}\n- Vencimiento: ${fDate(p.deadline)}\n- Resumen: ${p.aiSummary||"—"}\n- Notas: ${p.notes||"—"}${p.licitId?`\n- Licitación: ${ld?`${ld.estado}, cierre ${fDate(ld.fechaCierre)}`:"sin datos"}`:""}${pf.length?`\n- Seguimientos pendientes: ${pf.map(f=>`${f.subject} → ${f.to}`).join(" | ")}`:""}${evs.length?`\n- Reuniones próximas: ${evs.map(e=>`${e.title} (${e.start})`).join(" | ")}`:""}`;
  }).join("\n\n---\n\n");

  const send=async()=>{
    if(!input.trim()||loading)return;
    const um={role:"user",content:input.trim()};const nm=[...msgs,um];
    setMsgs(nm);setInput("");setLoading(true);
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),50);
    try{
      const pf=gf.filter(f=>f.status==="pendiente");
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type:"chat",messages:nm,context:buildCtx(),follows:pf.map(f=>`[${f.urgency.toUpperCase()}] ${f.subject} → ${f.to} (${f.daysPending}d sin resp.)`).join("\n")})});
      const data=await res.json();
      setMsgs(m=>[...m,{role:"assistant",content:data.text||"Sin respuesta."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",content:"Error de conexión."}]);}
    setLoading(false);setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100);
  };

  // ── UPLOAD DOC ────────────────────────────────────
  const uploadDoc=async(e)=>{
    const file=e.target.files[0];if(!file||!proj)return;setExtracting(true);
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      const b64=ev.target.result.split(",")[1];const isImg=file.type.startsWith("image/");
      try{
        const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({type:"doc",b64,mediaType:isImg?file.type:"application/pdf",isImg})});
        const data=await res.json();
        let ex;try{ex=JSON.parse((data.text||"{}").replace(/```json|```/g,"").trim());}catch{ex={summary:data.text?.slice(0,400)||"—"};}
        saveP(projects.map(p=>p.id===proj.id?{...p,docs:[...p.docs,{id:uid(),name:file.name,docType:ex.docType||"Documento",uploadedAt:new Date().toISOString().slice(0,10),summary:ex.summary||"—",extracted:JSON.stringify(ex)}]}:p));
      }catch{saveP(projects.map(p=>p.id===proj.id?{...p,docs:[...p.docs,{id:uid(),name:file.name,docType:"Documento",uploadedAt:new Date().toISOString().slice(0,10),summary:"Error al procesar.",extracted:"{}"}]}:p));}
      setExtracting(false);
    };
    reader.readAsDataURL(file);e.target.value="";
  };

  const delDoc=id=>saveP(projects.map(p=>p.id===proj.id?{...p,docs:p.docs.filter(d=>d.id!==id)}:p));
  const addTask=()=>{if(!newTask.trim()||!proj)return;saveP(projects.map(p=>p.id===proj.id?{...p,tasks:[...p.tasks,{id:uid(),text:newTask.trim(),status:"pending",createdAt:new Date().toISOString().slice(0,10)}]}:p));setNewTask("");};
  const toggleTask=id=>saveP(projects.map(p=>p.id===proj.id?{...p,tasks:p.tasks.map(t=>t.id===id?{...t,status:t.status==="pending"?"done":"pending"}:t)}:p));
  const delTask=id=>saveP(projects.map(p=>p.id===proj.id?{...p,tasks:p.tasks.filter(t=>t.id!==id)}:p));
  const saveEmail=()=>{if(!emailForm.subject||!proj)return;saveP(projects.map(p=>p.id===proj.id?{...p,emails:[...p.emails,{...emailForm,id:uid()}]}:p));setEmailForm({from:"",subject:"",date:"",body:""});setAddingEmail(false);};
  const delEmail=id=>saveP(projects.map(p=>p.id===proj.id?{...p,emails:p.emails.filter(e=>e.id!==id)}:p));
  const commitRename=()=>{if(renameVal.trim())saveP(projects.map(p=>p.id===renamingId?{...p,name:renameVal.trim()}:p));setRenamingId(null);};

  // ── ESTILOS BASE ──────────────────────────────────
  const inp={padding:"14px 16px",borderRadius:8,border:"1px solid #d1d5db",fontSize:F(14),width:"100%",boxSizing:"border-box",outline:"none",background:"white"};
  const btn=(bg,c="#fff",e={})=>({padding:"13px 20px",borderRadius:8,background:bg,color:c,border:"none",cursor:"pointer",fontSize:F(13),fontWeight:700,...e});
  const lbl={fontSize:F(12),fontWeight:700,color:"#374151",display:"block",marginBottom:5};
  const scroll={overflowY:"auto",WebkitOverflowScrolling:"touch"};

  // ── LICITACIÓN CARD ───────────────────────────────
  const LicitCard=({p})=>{
    const ld=p.licitData;const isFetching=fetchingLicit===p.id;if(!p.licitId)return null;
    return(
      <div style={{background:"white",borderRadius:10,padding:16,border:`1px solid ${ld&&ld.estado!=="Desconocido"?(MPC[ld.estado]||"#e2e8f0")+"55":"#e2e8f0"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ld?12:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:F(16)}}>🏛️</span>
            <div><div style={{fontSize:F(13),fontWeight:700,color:"#0f172a"}}>Mercado Público · {p.licitId}</div>{ld&&<div style={{fontSize:F(11),color:"#64748b",marginTop:2}}>{ld.nombre||"—"}</div>}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {ld&&<span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,background:(MPC[ld.estado]||"#94a3b8")+"18",color:MPC[ld.estado]||"#64748b",fontWeight:700}}>{ld.estado}</span>}
            <button onClick={()=>fetchLicit(p)} disabled={isFetching} style={{...btn(isFetching?"#94a3b8":"#0f172a"),fontSize:F(12),padding:"7px 12px",opacity:isFetching?0.6:1}}>
              {isFetching?"⏳":"🔄"}{mob?"":" Actualizar"}
            </button>
          </div>
        </div>
        {ld&&ld.estado!=="Desconocido"&&(
          <div>
            {ld.descripcion&&<p style={{fontSize:F(12),color:"#334155",lineHeight:1.5,margin:"0 0 10px",padding:"8px 10px",background:"#f8fafc",borderRadius:6}}>{ld.descripcion}</p>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[["Publicación",fDate(ld.fechaPublicacion),"📅"],["Cierre",fDate(ld.fechaCierre),"⏰"],["Adjudicación",fDate(ld.fechaAdjudicacion),"🏆"]].map(([l,v,ic])=>(
                <div key={l} style={{background:"#f1f5f9",borderRadius:7,padding:"8px 10px"}}>
                  <div style={{fontSize:F(10),color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>{ic} {l}</div>
                  <div style={{fontSize:F(13),fontWeight:700,color:"#0f172a"}}>{v}</div>
                </div>
              ))}
            </div>
            {ld.url&&<a href={ld.url} target="_blank" rel="noreferrer" style={{fontSize:F(12),color:"#1d4ed8",marginTop:8,display:"block"}}>Ver en Mercado Público →</a>}
            {p.licitChecked&&<div style={{fontSize:F(10),color:"#94a3b8",marginTop:6}}>Última consulta: {fDate(p.licitChecked)}</div>}
          </div>
        )}
        {!ld&&!isFetching&&<div style={{fontSize:F(12),color:"#94a3b8",marginTop:8}}>Presiona "Actualizar" para consultar Mercado Público.</div>}
      </div>
    );
  };

  // ── CALENDARIO MINI (para card de proyecto) ───────
  const CalMini = ({projId}) => {
    const evs = eventsForProject(projId);
    if(!evs.length) return null;
    const upcoming = evs.filter(e => e.start >= new Date().toISOString().slice(0,10)).slice(0,3);
    if(!upcoming.length) return null;
    return(
      <div style={{marginTop:10,padding:"10px 12px",background:"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe"}}>
        <div style={{fontSize:F(10),fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>📅 Reuniones próximas</div>
        {upcoming.map(e=>(
          <div key={e.id||e.title} style={{fontSize:F(12),color:"#1e3a5f",marginBottom:4,display:"flex",gap:8,alignItems:"flex-start"}}>
            <span style={{color:"#3b82f6",flexShrink:0}}>▸</span>
            <div>
              <span style={{fontWeight:600}}>{e.title}</span>
              <span style={{color:"#64748b",marginLeft:6}}>{fDate(e.start)}{e.time?" "+e.time:""}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── PANEL SOLICITUDES RESPONDIDAS ─────────────────
  const AnsweredPanel = () => {
    const byProj = {};
    answeredRequests.forEach(a => {
      if(!byProj[a.projectId]) byProj[a.projectId] = [];
      byProj[a.projectId].push(a);
    });

    return(
      <div style={{padding:mob?"16px 16px 90px":"24px",...scroll}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:F(16),fontWeight:800,color:"#0f172a",marginBottom:3}}>✅ Solicitudes Respondidas</div>
            <div style={{fontSize:F(12),color:"#64748b"}}>Evidencia de correos enviados al completar solicitudes de jefatura</div>
          </div>
          <div style={{fontSize:F(11),color:"#94a3b8"}}>{answeredRequests.length} registro(s)</div>
        </div>

        {answeredRequests.length === 0 && (
          <div style={{background:"white",borderRadius:12,padding:40,textAlign:"center",border:"2px dashed #e2e8f0"}}>
            <div style={{fontSize:F(36),marginBottom:12}}>📭</div>
            <div style={{fontSize:F(14),color:"#64748b",fontWeight:600,marginBottom:6}}>Sin registros aún</div>
            <div style={{fontSize:F(12),color:"#94a3b8"}}>Cuando marques una solicitud como completada,<br/>el sistema verificará en Gmail si enviaste el correo correspondiente.</div>
          </div>
        )}

        {Object.entries(byProj).map(([projId, items]) => {
          const p = projects.find(x=>x.id===projId);
          return(
            <div key={projId} style={{marginBottom:24}}>
              <div style={{fontSize:F(12),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:10,paddingBottom:6,borderBottom:"1px solid #f1f5f9"}}>
                {p?.name || projId}
              </div>
              {items.map(a => (
                <div key={a.id} style={{background:"white",borderRadius:10,padding:16,border:`1px solid ${a.found?"#bbf7d0":"#fed7aa"}`,marginBottom:10,borderLeft:`4px solid ${a.found?"#22c55e":"#f97316"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:F(13),fontWeight:700,color:"#0f172a",marginBottom:4,lineHeight:1.4}}>{a.taskText}</div>
                      <div style={{fontSize:F(11),color:"#64748b"}}>Verificado el {fDateTime(a.verifiedAt)}</div>
                    </div>
                    <span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,fontWeight:700,background:a.found?"#f0fdf4":"#fff7ed",color:a.found?"#15803d":"#c2410c",flexShrink:0}}>
                      {a.found?"✅ Correo encontrado":"⚠️ Sin evidencia"}
                    </span>
                  </div>

                  {a.found ? (
                    <div style={{background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:"1px solid #e2e8f0"}}>
                      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:8,marginBottom:10}}>
                        <div>
                          <div style={{fontSize:F(10),color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>Asunto enviado</div>
                          <div style={{fontSize:F(12),fontWeight:600,color:"#0f172a"}}>{a.subject||"—"}</div>
                        </div>
                        <div>
                          <div style={{fontSize:F(10),color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>Fecha y hora de envío</div>
                          <div style={{fontSize:F(12),fontWeight:600,color:"#059669"}}>{a.sentDate||"—"} {a.sentTime ? "· "+a.sentTime : ""}</div>
                        </div>
                      </div>
                      {a.snippet && (
                        <div style={{fontSize:F(12),color:"#334155",lineHeight:1.5,padding:"8px 10px",background:"#eff6ff",borderRadius:6,marginBottom:10,borderLeft:"3px solid #3b82f6"}}>
                          "{a.snippet}"
                        </div>
                      )}
                      {a.howAnswered && (
                        <div style={{fontSize:F(12),color:"#475569",marginBottom:8}}>
                          <span style={{fontWeight:700,color:"#334155"}}>Cómo respondí: </span>{a.howAnswered}
                        </div>
                      )}
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        {a.emailUrl && (
                          <a href={a.emailUrl} target="_blank" rel="noreferrer"
                            style={{fontSize:F(12),color:"#1d4ed8",padding:"7px 14px",borderRadius:6,background:"#eff6ff",textDecoration:"none",fontWeight:700}}>
                            ✉️ Abrir correo →
                          </a>
                        )}
                        {a.pendingReply && (
                          <div style={{fontSize:F(11),padding:"5px 12px",borderRadius:6,background:"#fef9c3",color:"#854d0e",fontWeight:600,border:"1px solid #fde047"}}>
                            ⚠️ Pendiente respuesta adicional{a.pendingReplyNote ? ": "+a.pendingReplyNote : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  ):(
                    <div style={{padding:"10px 14px",background:"#fff7ed",borderRadius:8,border:"1px solid #fed7aa",fontSize:F(12),color:"#92400e"}}>
                      No se encontró correo enviado relacionado con esta tarea. Puede que se haya gestionado por otro medio o que el correo no esté en Gmail.
                    </div>
                  )}

                  <button
                    onClick={()=>saveAnswered(answeredRequests.filter(x=>x.id!==a.id))}
                    style={{marginTop:10,fontSize:F(11),color:"#94a3b8",background:"none",border:"none",cursor:"pointer",padding:0}}>
                    ✕ Eliminar registro
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ── PANEL CALENDARIO ──────────────────────────────
  const CalendarPanel = () => {
    const now = new Date().toISOString().slice(0,10);
    const upcoming = [...calendarEvents]
      .filter(e => e.start >= now)
      .sort((a,b)=>a.start.localeCompare(b.start));
    const past = [...calendarEvents]
      .filter(e => e.start < now)
      .sort((a,b)=>b.start.localeCompare(a.start))
      .slice(0,5);

    return(
      <div style={{padding:mob?"16px 16px 90px":"24px",...scroll}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:F(16),fontWeight:800,color:"#0f172a",marginBottom:3}}>📅 Calendario de Proyectos</div>
            <div style={{fontSize:F(12),color:"#64748b"}}>{upcoming.length} reunión(es) próxima(s) · {calendarEvents.length} total</div>
          </div>
          <button
            onClick={syncCalendar}
            disabled={syncingCal}
            style={{...btn(syncingCal?"#94a3b8":"#0284c7"),fontSize:F(12),padding:"9px 16px",opacity:syncingCal?0.7:1}}>
            {syncingCal?"⏳ Sincronizando…":"🔄 Sincronizar Google Calendar"}
          </button>
        </div>

        {calendarEvents.length === 0 && !syncingCal && (
          <div style={{background:"white",borderRadius:12,padding:40,textAlign:"center",border:"2px dashed #e2e8f0"}}>
            <div style={{fontSize:F(36),marginBottom:12}}>📆</div>
            <div style={{fontSize:F(14),color:"#64748b",fontWeight:600,marginBottom:6}}>Sin eventos sincronizados</div>
            <div style={{fontSize:F(12),color:"#94a3b8"}}>Presiona "Sincronizar Google Calendar" para cargar tus reuniones<br/>y asociarlas automáticamente a cada proyecto.</div>
            <button onClick={syncCalendar} style={{...btn("#0284c7"),marginTop:16,fontSize:F(13),padding:"11px 22px"}}>🔄 Sincronizar ahora</button>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div style={{fontSize:F(12),fontWeight:700,color:"#0284c7",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Próximas reuniones</div>
            {upcoming.map(e => {
              const p = e.projectId ? projects.find(x=>x.id===e.projectId) : null;
              const d = new Date(e.start+"T12:00:00");
              const isToday = e.start === now;
              const isTomorrow = e.start === new Date(Date.now()+86400000).toISOString().slice(0,10);
              return(
                <div key={e.id||e.title+e.start} style={{background:"white",borderRadius:10,padding:16,border:`1px solid ${isToday?"#3b82f6":"#e2e8f0"}`,marginBottom:10,borderLeft:`4px solid ${isToday?"#3b82f6":p?SC[p.status]:"#94a3b8"}`}}>
                  <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                    <div style={{textAlign:"center",minWidth:44,flexShrink:0}}>
                      <div style={{fontSize:F(22),fontWeight:800,color:isToday?"#1d4ed8":"#0f172a",lineHeight:1}}>{d.getDate()}</div>
                      <div style={{fontSize:F(10),color:"#64748b",textTransform:"uppercase"}}>{MONTHS_ES[d.getMonth()+1].slice(0,3)}</div>
                      {isToday&&<div style={{fontSize:F(9),color:"#1d4ed8",fontWeight:700,marginTop:2}}>HOY</div>}
                      {isTomorrow&&<div style={{fontSize:F(9),color:"#f97316",fontWeight:700,marginTop:2}}>MAÑANA</div>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:F(14),fontWeight:700,color:"#0f172a",marginBottom:4,lineHeight:1.3}}>{e.title}</div>
                      {e.time&&<div style={{fontSize:F(12),color:"#64748b",marginBottom:6}}>🕐 {e.time}</div>}
                      {e.description&&<div style={{fontSize:F(12),color:"#475569",lineHeight:1.5,marginBottom:8,padding:"6px 10px",background:"#f8fafc",borderRadius:6}}>{e.description}</div>}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {p ? (
                          <span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,background:SC[p.status]+"18",color:SC[p.status],fontWeight:700}}>{p.name.split(" ").slice(0,4).join(" ")}…</span>
                        ):(
                          <span style={{fontSize:F(11),padding:"3px 8px",borderRadius:8,background:"#f1f5f9",color:"#64748b"}}>Sin proyecto asociado</span>
                        )}
                        {e.url&&<a href={e.url} target="_blank" rel="noreferrer" style={{fontSize:F(11),color:"#1d4ed8",textDecoration:"none",fontWeight:600}}>📎 Ver evento →</a>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {past.length > 0 && (
          <details style={{marginTop:16}}>
            <summary style={{fontSize:F(12),color:"#94a3b8",cursor:"pointer",padding:"8px 0",fontWeight:600}}>
              Reuniones pasadas ({past.length} recientes)
            </summary>
            <div style={{marginTop:8}}>
              {past.map(e=>{
                const p = e.projectId ? projects.find(x=>x.id===e.projectId) : null;
                return(
                  <div key={e.id||e.title+e.start} style={{background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:"1px solid #e2e8f0",marginBottom:8,opacity:0.7}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:F(12),fontWeight:600,color:"#334155"}}>{e.title}</div>
                        <div style={{fontSize:F(11),color:"#94a3b8",marginTop:2}}>{fDate(e.start)}{e.time?" · "+e.time:""}</div>
                      </div>
                      {p&&<span style={{fontSize:F(10),padding:"2px 8px",borderRadius:6,background:"#f1f5f9",color:"#64748b",flexShrink:0}}>{p.name.split(" ").slice(0,3).join(" ")}…</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* ── Agregar evento manual ── */}
        <details style={{marginTop:20}}>
          <summary style={{fontSize:F(12),color:"#1d4ed8",cursor:"pointer",padding:"8px 0",fontWeight:700}}>+ Agregar evento manualmente</summary>
          <AddEventForm onAdd={(ev)=>saveCal([...calendarEvents,{...ev,id:uid()}])} projects={projects} />
        </details>
      </div>
    );
  };

  // ── FORMULARIO AGREGAR EVENTO MANUAL ─────────────
  const AddEventForm = ({onAdd, projects}) => {
    const[ev,setEv]=useState({title:"",start:"",time:"",description:"",projectId:"",url:""});
    return(
      <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #bfdbfe",marginTop:8}}>
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
          <div><label style={lbl}>Título *</label><input value={ev.title} onChange={e=>setEv(x=>({...x,title:e.target.value}))} style={inp} placeholder="Nombre del evento"/></div>
          <div><label style={lbl}>Fecha *</label><input type="date" value={ev.start} onChange={e=>setEv(x=>({...x,start:e.target.value}))} style={inp}/></div>
          <div><label style={lbl}>Hora</label><input value={ev.time} onChange={e=>setEv(x=>({...x,time:e.target.value}))} style={inp} placeholder="Ej: 13:00"/></div>
          <div><label style={lbl}>Proyecto</label>
            <select value={ev.projectId} onChange={e=>setEv(x=>({...x,projectId:e.target.value}))} style={inp}>
              <option value="">Sin asociar</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name.slice(0,50)}…</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:10}}><label style={lbl}>Descripción</label><textarea value={ev.description} onChange={e=>setEv(x=>({...x,description:e.target.value}))} rows={2} style={{...inp,resize:"vertical"}}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>URL evento (opcional)</label><input value={ev.url} onChange={e=>setEv(x=>({...x,url:e.target.value}))} style={inp} placeholder="https://"/></div>
        <button onClick={()=>{if(!ev.title||!ev.start)return;onAdd(ev);setEv({title:"",start:"",time:"",description:"",projectId:"",url:""}); }} style={btn("#0284c7")}>Agregar evento</button>
      </div>
    );
  };

  // ── HEADER ────────────────────────────────────────
  const header=(
    <div style={{background:"#0f172a",color:"white",padding:mob?"14px 16px":"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
        {mob&&view==="project"&&<button onClick={()=>{setView("dash");setSel(null);}} style={{background:"none",border:"none",color:"white",fontSize:F(20),cursor:"pointer",padding:0,flexShrink:0}}>←</button>}
        <div style={{flex:1,minWidth:0}}>
          {view==="project"&&proj?(
            renamingId===proj.id?(
              <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={e=>{if(e.key==="Enter")commitRename();if(e.key==="Escape")setRenamingId(null);}} style={{fontSize:F(15),fontWeight:800,background:"transparent",border:"none",borderBottom:"2px solid #3b82f6",color:"white",outline:"none",width:"100%",padding:"2px 0"}}/>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}} onClick={()=>{setRenamingId(proj.id);setRenameVal(proj.name);}}>
                <div style={{fontSize:F(15),fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name}</div>
                <span style={{fontSize:F(12),color:"#475569"}}>✏️</span>
              </div>
            )
          ):(
            <div>
              <div style={{fontSize:F(15),fontWeight:800,letterSpacing:-0.3}}>SECPLA Command</div>
              {criticalGf.length>0&&<div style={{fontSize:F(11),color:"#fca5a5",marginTop:1}}>🔴 {criticalGf.length} alerta crítica{criticalGf.length>1?"s":""}</div>}
            </div>
          )}
          {view==="project"&&proj&&<div style={{fontSize:F(11),color:"#64748b",marginTop:1}}>{proj.financier} · {proj.stage} · {fCLP(proj.budget)}</div>}
          {view!=="project"&&!criticalGf.length&&<div style={{fontSize:F(11),color:"#475569",marginTop:1}}>Municipalidad de Recoleta · Infraestructura de Seguridad</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
        {/* Botón sync Drive en header */}
        {!mob&&(
          <button onClick={syncDrive} disabled={syncingDrive} title="Sincronizar con Google Drive"
            style={{...btn(syncingDrive?"#334155":"#1e293b","#93c5fd"),fontSize:F(12),padding:"7px 12px",opacity:syncingDrive?0.6:1}}>
            {syncingDrive?"⏳":"📂"}{mob?"":" Drive"}
          </button>
        )}
        {view==="project"&&proj&&(
          <><input ref={fileRef} type="file" accept=".pdf,image/*" onChange={uploadDoc} style={{display:"none"}}/>
          <button onClick={()=>fileRef.current?.click()} disabled={extracting} style={{...btn(extracting?"#334155":"#1e3a5f","#93c5fd"),fontSize:F(12),padding:"7px 12px"}}>
            {extracting?"⏳":"📎"}{mob?"":" Doc"}
          </button></>
        )}
        {!mob&&<button onClick={()=>setView(v=>v==="chat"?"dash":"chat")} style={{...btn(view==="chat"?"#1d4ed8":"#1e293b"),fontSize:F(12),padding:"8px 14px"}}>🤖 {view==="chat"?"Cerrar":"Asistente"}</button>}
      </div>
    </div>
  );

  // ── GMAIL PANEL ───────────────────────────────────
  const GmailPanel=()=>{
    if(!pendingGf.length)return null;
    const sorted=[...pendingGf].sort((a,b)=>({crítica:0,alta:1,media:2}[a.urgency])-({crítica:0,alta:1,media:2}[b.urgency]));
    return(
      <div style={{marginTop:24}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:F(13),fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:1}}>📬 Seguimientos Gmail — {pendingGf.length} pendientes</div>
          <span style={{fontSize:F(11),color:"#94a3b8"}}>Solo lectura</span>
        </div>
        {sorted.map(f=>{
          const fp=projects.find(p=>p.id===f.projectId);
          return(
            <div key={f.id} style={{background:"white",borderRadius:10,padding:16,border:`1px solid ${UC[f.urgency]}33`,marginBottom:12,borderLeft:`4px solid ${UC[f.urgency]}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:F(14),color:"#0f172a",marginBottom:4}}>{UL[f.urgency]} {f.subject}</div>
                  <div style={{fontSize:F(12),color:"#64748b",marginBottom:4}}>→ {f.to}</div>
                  {fp&&<span style={{fontSize:F(11),padding:"3px 9px",borderRadius:6,background:"#f1f5f9",color:"#475569"}}>{fp.name}</span>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:F(13),fontWeight:700,color:UC[f.urgency]}}>{f.daysPending}d sin resp.</div>
                  <div style={{fontSize:F(11),color:"#94a3b8",marginTop:2}}>{fDate(f.sentDate)}</div>
                </div>
              </div>
              <p style={{fontSize:F(12),color:"#475569",lineHeight:1.6,margin:"0 0 12px",padding:"8px 10px",background:"#f8fafc",borderRadius:5}}>{f.context}</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <a href={f.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:F(12),color:"#1d4ed8",padding:"7px 14px",borderRadius:6,background:"#eff6ff",textDecoration:"none",fontWeight:700}}>✉️ Abrir en Gmail</a>
                <button onClick={()=>resolveFollow(f.id)} style={{...btn("#dcfce7","#166534"),fontSize:F(12),padding:"7px 14px"}}>✅ Resuelto</button>
                <button onClick={()=>resolveFollow(f.id)} style={{...btn("#f1f5f9","#64748b"),fontSize:F(12),padding:"7px 14px"}}>✕ Descartar</button>
              </div>
            </div>
          );
        })}
        {gf.filter(f=>f.status==="resuelto").length>0&&(
          <div style={{fontSize:F(11),color:"#94a3b8",textAlign:"center",marginTop:6}}>
            {gf.filter(f=>f.status==="resuelto").length} resuelto(s) · <span style={{cursor:"pointer",color:"#1d4ed8"}} onClick={()=>saveGf(GF_INIT)}>Restablecer</span>
          </div>
        )}
      </div>
    );
  };

  // ── DASHBOARD ─────────────────────────────────────
  const dashContent=(
    <div style={{padding:mob?"16px 16px 90px":"24px",...scroll}}>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          {l:"Inversión Total",v:fCLP(totalBudget),sub:"CLP",i:"💰",c:"#1d4ed8",bg:"#eff6ff"},
          {l:"En Ejecución",v:projects.filter(p=>p.status==="En curso"||p.status==="Con alerta").length,sub:`de ${projects.length}`,i:"🟢",c:"#059669",bg:"#f0fdf4"},
          {l:"Seguimientos",v:pendingGf.length,sub:`${criticalGf.length} crítico(s)`,i:"📬",c:"#dc2626",bg:"#fef2f2"},
          {l:"Tareas Pendientes",v:projects.flatMap(p=>p.tasks.filter(t=>t.status==="pending")).length,sub:"cartera total",i:"📋",c:"#d97706",bg:"#fffbeb"}
        ].map(({l,v,sub,i,c,bg})=>(
          <div key={l} style={{background:bg,borderRadius:10,padding:16,border:`1px solid ${c}22`}}>
            <div style={{fontSize:F(10),color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>{l}</div>
            <div style={{fontSize:mob?F(18):F(22),fontWeight:800,color:c,lineHeight:1}}>{i} {v}</div>
            <div style={{fontSize:F(11),color:"#94a3b8",marginTop:4}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Drive sync banner */}
      {/* Drive sync detail — mostrado solo cuando hay datos */}
      {Object.keys(driveSync).length > 0 && (
        <div style={{background:"#f0fdf4",borderRadius:8,padding:"10px 14px",border:"1px solid #bbf7d0",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <div style={{fontSize:F(12),color:"#15803d",fontWeight:600}}>
              📂 {Object.keys(driveSync).length} proyecto(s) sincronizados desde Drive
            </div>
          </div>
          {Object.entries(driveSync).map(([pid,ds])=>{
            const p=projects.find(x=>x.id===pid);
            if(!p||!ds.docsFound?.length) return null;
            return(
              <div key={pid} style={{marginTop:6,fontSize:F(11),color:"#064e3b"}}>
                <strong>{p.name.split(" ").slice(0,4).join(" ")}…</strong>: {ds.docsFound.slice(0,3).join(", ")}{ds.docsFound.length>3?` +${ds.docsFound.length-3} más`:""}
                {ds.lastDocDate&&<span style={{color:"#6ee7b7",marginLeft:6}}>· {ds.lastDocDate}</span>}
              </div>
            );
          })}
        </div>
      )}
      {/* ── Barra de sincronización con feedback visual por botón ── */}
      {(()=>{
        const SC = {
          idle:    {bg:"#1e293b",    color:"white",    icon:""},
          loading: {bg:"#94a3b8",    color:"white",    icon:"⏳"},
          ok:      {bg:"#059669",    color:"white",    icon:"✓"},
          warn:    {bg:"#d97706",    color:"white",    icon:"⚠️"},
          error:   {bg:"#dc2626",    color:"white",    icon:"✕"},
        };
        const SyncBtn = ({id,label,emoji,onClick,disabled,count,countColor})=>{
          const s=syncStatus[id]||{state:"idle",ts:null,msg:""};
          const c=SC[s.state]||SC.idle;
          const isLoading=s.state==="loading"||disabled;
          return(
            <div style={{position:"relative",display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <button onClick={onClick} disabled={isLoading}
                style={{...btn(isLoading?"#94a3b8":c.bg),fontSize:F(11),padding:"8px 12px",opacity:isLoading?0.7:1,display:"flex",alignItems:"center",gap:5,minWidth:72,justifyContent:"center"}}>
                <span style={{fontSize:F(14)}}>{isLoading?"⏳":emoji}</span>
                <span>{label}</span>
                {count!=null&&count>0&&<span style={{fontSize:F(9),background:countColor||"rgba(255,255,255,0.25)",color:"white",borderRadius:10,padding:"1px 5px"}}>{count}</span>}
                {!isLoading&&s.state!=="idle"&&<span style={{fontSize:F(10)}}>{c.icon}</span>}
              </button>
              {s.state!=="idle"&&s.msg&&(
                <div style={{
                  position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
                  background:s.state==="error"?"#991b1b":s.state==="warn"?"#78350f":"#0f172a",
                  color:"white",fontSize:F(10),padding:"5px 9px",borderRadius:6,
                  whiteSpace:"nowrap",zIndex:50,marginTop:4,maxWidth:260,
                  boxShadow:"0 2px 8px rgba(0,0,0,0.25)",lineHeight:1.4
                }}>
                  {s.msg}
                  {s.ts&&<div style={{opacity:0.6,marginTop:1}}>{new Date(s.ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</div>}
                  {s.code&&<div style={{opacity:0.5,fontSize:F(9),marginTop:1}}>cod: {s.code}</div>}
                </div>
              )}
            </div>
          );
        };
        return(
          <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 16px",border:"1px solid #e2e8f0",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div style={{fontSize:F(12),fontWeight:700,color:"#334155",paddingTop:8}}>Sincronización de datos</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <SyncBtn id="drive"    label="Drive"     emoji="📂" onClick={syncDrive}              disabled={syncingDrive}    count={Object.keys(driveSync).length||null} countColor="#15803d55"/>
                <SyncBtn id="cal"      label="Calendario" emoji="📅" onClick={syncCalendar}           disabled={syncingCal}      count={calendarEvents.length||null}/>
                <SyncBtn id="gmail"    label="Gmail"     emoji="📬" onClick={scanGmail}              disabled={scanningGmail}   count={pendingGf.filter(f=>f.autoDetected).length||null} countColor="#dc262655"/>
                <SyncBtn id="convenio" label="Convenios" emoji="📋" onClick={trackConvenios}         disabled={trackingConvenio} count={convenioData.filter(c=>c.modificacionesPendientes?.length>0).length||null} countColor="#f59e0b55"/>
                <SyncBtn id="reloj"    label="Reloj"     emoji="🕐" onClick={()=>syncClockFromGmail(false)} disabled={checkingClock} count={null}/>
                <SyncBtn id="acuses"   label="Acuses"    emoji="👁" onClick={()=>syncReadReceipts(false)}  disabled={syncingReceipts} count={readReceipts.length||null}/>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Próximas reuniones resumen */}
      {calendarEvents.filter(e=>e.start>=new Date().toISOString().slice(0,10)).length > 0 && (
        <div style={{background:"#eff6ff",borderRadius:8,padding:"10px 14px",border:"1px solid #bfdbfe",marginBottom:14}}>
          <div style={{fontSize:F(11),fontWeight:700,color:"#1d4ed8",marginBottom:6,display:"flex",justifyContent:"space-between"}}>
            <span>📅 Próximas reuniones</span>
            <span style={{cursor:"pointer",fontWeight:400}} onClick={()=>setMainTab("calendar")}>Ver todas →</span>
          </div>
          {calendarEvents.filter(e=>e.start>=new Date().toISOString().slice(0,10)).slice(0,3).map(e=>{
            const p=e.projectId?projects.find(x=>x.id===e.projectId):null;
            return(
              <div key={e.id||e.title} style={{fontSize:F(12),color:"#1e3a5f",marginBottom:3,display:"flex",gap:8}}>
                <span>▸ <strong>{fDate(e.start)}{e.time?" "+e.time:""}</strong> — {e.title}</span>
                {p&&<span style={{fontSize:F(10),color:"#64748b"}}>({p.name.split(" ").slice(0,3).join(" ")}…)</span>}
              </div>
            );
          })}
        </div>
      )}

      <GmailPanel/>

      {/* ── SIEVAP COUNTDOWN ── */}
      {(()=>{
        const now=new Date();
        const elapsed=Math.min(SIEVAP_TOTAL,Math.max(0,daysBetween(SIEVAP_START,now)));
        const remaining=Math.max(0,daysBetween(now,SIEVAP_DEADLINE));
        const pct=Math.min(100,Math.round((elapsed/SIEVAP_TOTAL)*100));
        const overdue=now>SIEVAP_DEADLINE;
        const critical=!overdue&&remaining<=3;
        const warning=!overdue&&remaining<=7&&remaining>3;
        const barColor=overdue?"#ef4444":critical?"#f97316":warning?"#f59e0b":"#3b82f6";
        const bgColor=overdue?"#fef2f2":critical?"#fff7ed":warning?"#fffbeb":"#eff6ff";
        const borderColor=overdue?"#ef4444":critical?"#f97316":warning?"#f59e0b":"#3b82f6";
        return(
          <div style={{background:bgColor,borderRadius:12,padding:18,border:`2px solid ${borderColor}`,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:F(18)}}>⏳</span>
                  <span style={{fontSize:F(13),fontWeight:800,color:borderColor,textTransform:"uppercase",letterSpacing:0.5}}>
                    {overdue?"⚠️ VENCIDO":critical?"🔴 PLAZO CRÍTICO":warning?"🟠 PLAZO PRÓXIMO":"Plazo SIEVAP"}
                  </span>
                </div>
                <div style={{fontSize:F(12),color:"#475569",lineHeight:1.5}}>
                  Subsanación observaciones <strong>SNSM25-STP-0113</strong><br/>
                  Integración de Cámaras de Televigilancia · SPD<br/>
                  <span style={{fontSize:F(10),color:"#94a3b8"}}>⚠️ 3ra instancia de observaciones — resolverlas en su totalidad</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:F(overdue?16:24),fontWeight:900,color:borderColor,lineHeight:1}}>
                  {overdue?`${Math.abs(remaining)} d.h. vencido`:`${remaining}`}
                </div>
                {!overdue&&<div style={{fontSize:F(11),color:"#64748b",marginTop:2}}>días hábiles restantes</div>}
              </div>
            </div>
            <div style={{background:"#e2e8f0",borderRadius:20,height:14,overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:20,transition:"width 0.5s ease"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:F(10),color:"#64748b",marginBottom:14}}>
              <span>Inicio: {fDate("2026-04-09")} (Día 1)</span>
              <span style={{fontWeight:700,color:borderColor}}>{elapsed}/{SIEVAP_TOTAL} días corridos</span>
              <span>Límite: {fDate("2026-04-24")}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[["Inicio solicitud",fDate("2026-04-09"),"📅","#64748b"],["Hoy",fDate(now.toISOString().slice(0,10)),"📍",borderColor],["Fecha límite",fDate("2026-04-24"),overdue?"🚨":"⏰",borderColor]].map(([l,v,ic,c])=>(
                <div key={l} style={{background:"white",borderRadius:8,padding:"9px 12px",border:`1px solid ${c}33`,textAlign:"center"}}>
                  <div style={{fontSize:F(14)}}>{ic}</div>
                  <div style={{fontSize:F(10),color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginTop:2}}>{l}</div>
                  <div style={{fontSize:F(12),fontWeight:700,color:c,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
            {(critical||overdue)&&(
              <div style={{marginTop:12,padding:"10px 14px",background:overdue?"#fee2e2":"#ffedd5",borderRadius:8,fontSize:F(12),color:overdue?"#991b1b":"#9a3412",fontWeight:600}}>
                {overdue?"⚠️ Plazo VENCIDO. Ingresar las observaciones al SIEVAP de inmediato y coordinar con SPD."
                  :`🚨 Quedan solo ${remaining} día${remaining!==1?"s":""} corrido${remaining!==1?"s":""} para subir las observaciones al SIEVAP. ¡Esta es la 3ra instancia!`}
              </div>
            )}
            <div style={{marginTop:10,padding:"8px 12px",background:"white",borderRadius:7,border:"1px solid #e2e8f0",fontSize:F(11),color:"#64748b"}}>
              📄 Fuente: <strong>Certificado de Revisión de Diseño - Observada.pdf</strong> · SIEVAP · 9 abr 2026
            </div>
            <a href="https://mail.google.com/a/recoleta.cl/#all/19d743c80d701dbc" target="_blank" rel="noreferrer"
              style={{display:"inline-block",marginTop:12,fontSize:F(12),color:"#1d4ed8",fontWeight:700,textDecoration:"none"}}>
              ✉️ Ver correo de solicitud (María Paz) →
            </a>
          </div>
        );
      })()}

      {/* ── SOLICITUDES JEFATURA ── */}
      {(()=>{
        const pending=boss.filter(b=>b.status==="pendiente");
        const done=boss.filter(b=>b.status==="completado");
        const BC={"crítica":"#dc2626","alta":"#f97316","media":"#f59e0b"};
        const BL={"crítica":"🔴","alta":"🟠","media":"🟡"};
        const fromColor={"María Paz Juica":"#7c3aed","Grace Arcos":"#0284c7"};
        const fromBg={"María Paz Juica":"#f5f3ff","Grace Arcos":"#eff6ff"};
        return(
          <div style={{marginTop:24}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:F(13),fontWeight:700,color:"#7c3aed",textTransform:"uppercase",letterSpacing:1}}>
                👩‍💼 Solicitudes de Jefatura — {pending.length} pendientes
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {answeredRequests.length>0&&(
                  <button onClick={()=>setMainTab("answered")} style={{fontSize:F(11),padding:"4px 10px",borderRadius:6,background:"#f0fdf4",color:"#15803d",border:"1px solid #bbf7d0",cursor:"pointer",fontWeight:700}}>
                    ✅ {answeredRequests.length} respondida(s)
                  </button>
                )}
                {done.length>0&&<span style={{fontSize:F(11),color:"#94a3b8"}}>{done.length} completadas</span>}
              </div>
            </div>
            {pending.map(b=>{
              const fp=projects.find(p=>p.id===b.projectId);
              const isVerifying = verifyingTask === b.id;
              return(
                <div key={b.id} style={{background:"white",borderRadius:10,padding:16,border:`2px solid ${fromColor[b.from]||"#7c3aed"}33`,marginBottom:12,borderLeft:`5px solid ${fromColor[b.from]||"#7c3aed"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
                        <span style={{fontSize:F(12),fontWeight:800,padding:"3px 10px",borderRadius:20,background:fromBg[b.from]||"#f5f3ff",color:fromColor[b.from]||"#7c3aed"}}>👩‍💼 {b.from}</span>
                        <span style={{fontSize:F(11),padding:"2px 8px",borderRadius:8,background:BC[b.urgency]+"15",color:BC[b.urgency],fontWeight:700}}>{BL[b.urgency]} {b.urgency}</span>
                        {fp&&<span style={{fontSize:F(10),padding:"2px 8px",borderRadius:6,background:"#f1f5f9",color:"#475569"}}>{fp.name.split(" ").slice(0,4).join(" ")}…</span>}
                      </div>
                      <div style={{fontSize:F(14),color:"#0f172a",lineHeight:1.5,fontWeight:500}}>{b.task}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:F(11),color:"#94a3b8"}}>{fDate(b.requestDate)}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4,alignItems:"center"}}>
                    <a href={b.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:F(12),color:"#1d4ed8",padding:"6px 14px",borderRadius:6,background:"#eff6ff",textDecoration:"none",fontWeight:700}}>✉️ Ver correo</a>
                    <button onClick={()=>toggleBoss(b.id)} disabled={isVerifying} style={{...btn("#dcfce7","#166534"),fontSize:F(12),padding:"6px 14px",opacity:isVerifying?0.7:1}}>
                      {isVerifying?"⏳ Verificando Gmail…":"✅ Marcar completado"}
                    </button>
                  </div>
                </div>
              );
            })}
            {done.length>0&&(
              <details style={{marginTop:4}}>
                <summary style={{fontSize:F(11),color:"#94a3b8",cursor:"pointer",padding:"6px 0"}}>Ver {done.length} solicitudes completadas</summary>
                {done.map(b=>{
                  // ¿Hay evidencia de correo enviado?
                  const ev = answeredRequests.find(a=>a.taskId===b.id);
                  return(
                  <div key={b.id} style={{background:"#f8fafc",borderRadius:8,padding:14,border:"1px solid #e2e8f0",marginBottom:8,opacity:0.75,borderLeft:`4px solid #22c55e`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <span style={{fontSize:F(11),fontWeight:700,color:"#059669",marginRight:8}}>✅ Completado</span>
                        <span style={{fontSize:F(11),color:"#64748b",fontWeight:600}}>{b.from}</span>
                        <div style={{fontSize:F(12),color:"#64748b",marginTop:4,textDecoration:"line-through"}}>{b.task}</div>
                        {b.completedNote&&<div style={{fontSize:F(11),color:"#059669",marginTop:3,fontStyle:"italic"}}>{b.completedNote}</div>}
                        {/* Evidencia de correo enviado */}
                        {ev && ev.found && (
                          <div style={{marginTop:8,padding:"8px 10px",background:"#f0fdf4",borderRadius:6,border:"1px solid #bbf7d0"}}>
                            <div style={{fontSize:F(11),color:"#15803d",fontWeight:700,marginBottom:4}}>📤 Correo verificado</div>
                            <div style={{fontSize:F(11),color:"#334155"}}>{ev.subject}</div>
                            <div style={{fontSize:F(10),color:"#64748b",marginTop:2}}>{ev.sentDate}{ev.sentTime?" · "+ev.sentTime:""}</div>
                            {ev.emailUrl&&<a href={ev.emailUrl} target="_blank" rel="noreferrer" style={{fontSize:F(11),color:"#1d4ed8",fontWeight:700}}>Ver correo →</a>}
                          </div>
                        )}
                        {ev && !ev.found && (
                          <div style={{marginTop:6,fontSize:F(11),color:"#92400e",padding:"4px 8px",background:"#fff7ed",borderRadius:5,border:"1px solid #fed7aa"}}>
                            ⚠️ No se encontró correo enviado en Gmail
                          </div>
                        )}
                      </div>
                      <button onClick={()=>toggleBoss(b.id)} style={{...btn("#fef2f2","#dc2626"),fontSize:F(11),padding:"4px 10px"}}>↩ Reabrir</button>
                    </div>
                  </div>
                );})}
              </details>
            )}
            <button onClick={()=>saveBoss(BOSS_INIT)} style={{fontSize:F(10),color:"#94a3b8",background:"none",border:"none",cursor:"pointer",marginTop:4,padding:0}}>↺ Restablecer solicitudes</button>
          </div>
        );
      })()}

      {/* Cartera */}
      <div style={{fontSize:F(12),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:10,marginTop:24}}>Cartera Completa</div>
      {projects.map(p=>{
        const projEvs = eventsForProject(p.id).filter(e=>e.start>=new Date().toISOString().slice(0,10));
        return(
        <div key={p.id} onClick={()=>{setSel(p.id);setTab("overview");setView("project");}} style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0",marginBottom:12,borderLeft:`4px solid ${SC[p.status]}`,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:F(15),color:"#0f172a",lineHeight:1.3,marginBottom:6}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,background:SC[p.status]+"18",color:SC[p.status],fontWeight:700}}>{p.status}</span>
                <span style={{fontSize:F(11),padding:"3px 9px",borderRadius:8,background:"#f1f5f9",color:"#475569"}}>{p.stage}</span>
                <span style={{fontSize:F(11),padding:"3px 9px",borderRadius:8,background:"#e0f2fe",color:"#0369a1"}}>{p.financier}</span>
                {driveSync[p.id]&&<span title={`Drive sync: ${driveSync[p.id].lastSync?.slice(0,10)}`} style={{fontSize:F(11),padding:"3px 8px",borderRadius:8,background:"#f0fdf4",color:"#15803d"}}>📂 Drive</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:F(16),fontWeight:800,color:"#1d4ed8"}}>{fCLP(p.budget)}</div>
              <div style={{fontSize:F(10),color:"#94a3b8"}}>CLP</div>
            </div>
          </div>
          {p.aiSummary&&<p style={{fontSize:F(12),color:"#475569",lineHeight:1.5,margin:"0 0 10px",fontStyle:"italic",borderLeft:"2px solid #bfdbfe",paddingLeft:8}}>{p.aiSummary.slice(0,110)}…</p>}
          {/* Reuniones próximas inline en card */}
          {projEvs.length>0&&(
            <div style={{marginBottom:8,padding:"6px 10px",background:"#eff6ff",borderRadius:6,fontSize:F(11),color:"#1e3a5f"}}>
              📅 {projEvs.map(e=>`${fDate(e.start)} — ${e.title}`).slice(0,2).join(" · ")}{projEvs.length>2?` +${projEvs.length-2} más`:""}
            </div>
          )}
          <div style={{display:"flex",gap:14,fontSize:F(11),color:"#94a3b8",borderTop:"1px solid #f8fafc",paddingTop:8}}>
            <span>📄 {p.docs.length}</span><span>✉️ {p.emails.length}</span>
            <span>✅ {p.tasks.filter(t=>t.status==="pending").length} pend.</span>
            {gf.filter(f=>f.projectId===p.id&&f.status==="pendiente").length>0&&<span style={{color:"#dc2626"}}>📬 {gf.filter(f=>f.projectId===p.id&&f.status==="pendiente").length}</span>}
            {projEvs.length>0&&<span style={{color:"#1d4ed8"}}>📅 {projEvs.length}</span>}
          </div>
        </div>
      );})}

      {/* RELOJ CONTROL (sin cambios, se mantiene igual) */}
      {(()=>{
        const today=new Date();const todayStr=today.toISOString().slice(0,10);const nowMin=today.getHours()*60+today.getMinutes();
        const months=[...new Set(clockData.map(r=>r.date.slice(0,7)))].sort();
        const selMonth=clockMonth;const monthData=clockData.filter(r=>r.date.startsWith(selMonth));
        const days=monthData.map(r=>{const j=jornada(r.date);const eMin=toMin(r.entrada);const sMin=toMin(r.salida);const isToday=r.date===todayStr;
          if(eMin===null&&sMin===null)return{...r,j,worked:null,extra:null,alert:"sin_registro"};
          if(sMin===null&&!isToday)return{...r,j,worked:null,extra:null,alert:"sin_salida_hist"};
          if(sMin===null&&isToday){const live=Math.max(0,nowMin-(eMin+j));return{...r,j,worked:null,extra:null,alert:"trabajando",expectedSalida:eMin+j,liveExtra:live};}
          if(eMin===null)return{...r,j,worked:null,extra:null,alert:"sin_entrada_hist"};
          const worked=sMin-eMin;const extra=worked-j;return{...r,j,worked,extra,alert:null};
        });
        const completed=days.filter(d=>d.extra!==null);const totalExtra=completed.reduce((a,d)=>a+(d.extra||0),0);
        const extraH=Math.floor(Math.abs(totalExtra)/60);const extraM=Math.abs(totalExtra)%60;
        const yearAll=clockData.map(r=>{const j=jornada(r.date);const eMin=toMin(r.entrada);const sMin=toMin(r.salida);if(!eMin||!sMin)return null;return sMin-eMin-j;}).filter(x=>x!==null);
        const yearTotal=yearAll.reduce((a,v)=>a+v,0);
        const todayRec=days.find(d=>d.date===todayStr);
        const netColor=totalExtra>=0?"#059669":"#ef4444";const yearColor=yearTotal>=0?"#059669":"#ef4444";
        const[,mo]=selMonth.split("-").map(Number);
        return(
          <div style={{marginTop:24}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:F(13),fontWeight:700,color:"#0284c7",textTransform:"uppercase",letterSpacing:1}}>🕐 Reloj Control 2026</div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                {months.map(m=>{const[,mm]=m.split("-").map(Number);return<button key={m} onClick={()=>setClockMonth(m)} style={{...btn(m===selMonth?"#0284c7":"#f1f5f9",m===selMonth?"white":"#374151"),fontSize:F(11),padding:"5px 10px"}}>{MONTHS_ES[mm]}</button>;})}
                <button onClick={()=>setClockOpen(o=>!o)} style={{...btn("#e0f2fe","#0369a1"),fontSize:F(11),padding:"5px 10px"}}>{clockOpen?"▲ Ocultar":"▼ Detalle"}</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:12}}>
              {[{l:`Extra ${MONTHS_ES[mo]}`,v:(totalExtra>=0?"+":"")+fMin(totalExtra),c:netColor,bg:totalExtra>=0?"#f0fdf4":"#fef2f2",i:"⏱️"},{l:"Horas completas",v:`${extraH}h ${extraM}m`,c:"#7c3aed",bg:"#f5f3ff",i:"✅"},{l:"Días registrados",v:`${completed.length}d`,c:"#0284c7",bg:"#eff6ff",i:"📅"},{l:"Acum. anual 2026",v:(yearTotal>=0?"+":"")+fMin(yearTotal),c:yearColor,bg:yearTotal>=0?"#f0fdf4":"#fef2f2",i:"📊"}].map(({l,v,c,bg,i})=>(
                <div key={l} style={{background:bg,borderRadius:10,padding:14,border:`1px solid ${c}22`}}>
                  <div style={{fontSize:F(10),color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:0.7,marginBottom:4}}>{l}</div>
                  <div style={{fontSize:F(17),fontWeight:800,color:c}}>{i} {v}</div>
                </div>
              ))}
            </div>
            {selMonth==="2026-04"&&todayRec&&todayRec.alert==="trabajando"&&(
              <div style={{padding:"12px 16px",background:"#eff6ff",border:"2px solid #0284c7",borderRadius:10,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                  <div>
                    <div style={{fontSize:F(13),fontWeight:800,color:"#0284c7",marginBottom:2}}>🟢 En jornada — Entrada {todayRec.entrada} · {isFri(todayStr)?"Viernes 8h":"9h"}</div>
                    <div style={{fontSize:F(12),color:"#475569"}}>Salida normal: <strong>{String(Math.floor(todayRec.expectedSalida/60)).padStart(2,"0")}:{String(todayRec.expectedSalida%60).padStart(2,"0")}</strong>{todayRec.liveExtra>0&&<span style={{color:"#7c3aed",fontWeight:700,marginLeft:10}}>· +{fMin(todayRec.liveExtra)} extra ahora</span>}</div>
                  </div>
                  {todayRec.liveExtra>0&&<div style={{fontSize:F(20),fontWeight:900,color:"#7c3aed"}}>+{fMin(todayRec.liveExtra)}</div>}
                </div>
              </div>
            )}
            {selMonth==="2026-04"&&!todayRec&&<div style={{padding:"12px 16px",background:"#fef2f2",border:"2px solid #ef4444",borderRadius:10,marginBottom:12,fontSize:F(13),color:"#991b1b",fontWeight:600}}>🚨 Hoy no hay registro de entrada. ¿Olvidaste marcar?</div>}
            {clockOpen&&(
              <div style={{background:"white",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden",marginTop:4}}>
                <div style={{padding:"9px 14px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:4}}>
                  {["Fecha","Jornada","Entrada","Salida","Extra"].map(h=><div key={h} style={{fontSize:F(10),fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>{h}</div>)}
                </div>
                {[...days].reverse().map(d=>{const isToday=d.date===todayStr;const ec=d.extra>0?"#059669":d.extra<0?"#ef4444":"#64748b";return(
                  <div key={d.date} style={{padding:"10px 14px",borderBottom:"1px solid #f8fafc",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:4,background:isToday?"#eff6ff":"white",alignItems:"center"}}>
                    <div style={{fontSize:F(12),fontWeight:isToday?700:400,color:isToday?"#0284c7":"#0f172a"}}>{fDate(d.date)}{isToday&&<span style={{fontSize:F(9),marginLeft:4,color:"#0284c7",fontWeight:700}}>HOY</span>}{isFri(d.date)&&<span style={{fontSize:F(9),marginLeft:4,color:"#d97706"}}>VIE</span>}</div>
                    <div style={{fontSize:F(11),color:"#94a3b8"}}>{d.j===480?"8h":"9h"}</div>
                    <div style={{fontSize:F(12),color:"#0f172a"}}>{d.entrada||"—"}</div>
                    <div style={{fontSize:F(12),color:d.salida?"#0f172a":"#f59e0b"}}>{d.salida||(isToday?"⏳":"—")}</div>
                    <div style={{fontSize:F(13),fontWeight:700,color:d.extra!=null?ec:"#94a3b8"}}>{d.extra!=null?(d.extra>0?`+${fMin(d.extra)}`:d.extra<0?`-${fMin(Math.abs(d.extra))}`:"="):"—"}</div>
                  </div>
                );})}
                <div style={{padding:"10px 14px",background:"#f1f5f9",borderTop:"2px solid #e2e8f0",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:4}}>
                  <div style={{fontSize:F(12),fontWeight:700,color:"#0f172a",gridColumn:"1/5"}}>TOTAL {MONTHS_ES[mo].toUpperCase()}</div>
                  <div style={{fontSize:F(14),fontWeight:900,color:netColor}}>{totalExtra>=0?"+":""}{fMin(totalExtra)}</div>
                </div>
              </div>
            )}
            <div style={{marginTop:10,padding:"10px 14px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0",fontSize:F(11),color:"#64748b"}}>
              💡 <strong style={{color:yearColor}}>{fMin(Math.abs(yearTotal))}</strong> {yearTotal>=0?"acumuladas en 2026":"a deber en 2026"} · {MONTHS_ES[mo]}: <strong style={{color:netColor}}>{totalExtra>=0?"+":""}{fMin(totalExtra)}</strong>
            </div>
          </div>
        );
      })()}

      <button onClick={()=>{setForm(EF);setEditId(null);setShowForm(true);}} style={{...btn("#0f172a"),width:"100%",marginTop:16,padding:14,fontSize:F(13)}}>+ Nuevo Proyecto</button>
    </div>
  );

  // ── TABS PROYECTO ─────────────────────────────────
  const TABS=[["overview","📋 Resumen"],["licitacion","🏛️ Licitación"],["notes","📝 Notas"],["docs","📄 Docs"],["tasks","✅ Tareas"],["emails","✉️ Correos"],["calendar","📅 Reuniones"]];

  const projDetail=proj&&(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"10px 14px",display:"flex",gap:5,overflowX:"auto",flexShrink:0,WebkitOverflowScrolling:"touch"}}>
        {TABS.map(([k,l])=>{
          const badge = k==="docs"?proj.docs.length:k==="tasks"?proj.tasks.filter(t=>t.status==="pending").length:k==="emails"?proj.emails.length:k==="calendar"?eventsForProject(proj.id).filter(e=>e.start>=new Date().toISOString().slice(0,10)).length:null;
          return(
            <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 14px",borderRadius:7,border:"none",background:tab===k?"#1d4ed8":"#f1f5f9",color:tab===k?"white":"#64748b",cursor:"pointer",fontSize:F(12),fontWeight:tab===k?700:500,whiteSpace:"nowrap",flexShrink:0}}>
              {l}{badge!==null&&<span style={{marginLeft:3,fontSize:F(10),background:tab===k?"#3b82f6":"#e2e8f0",color:tab===k?"white":"#64748b",borderRadius:8,padding:"1px 6px"}}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div style={{flex:1,...scroll,padding:mob?"16px":"24px",paddingBottom:mob?90:24}}>
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"white",borderRadius:10,padding:18,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:F(11),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>Ficha del Proyecto</div>
              {[["Estado",<span key="s" style={{padding:"4px 12px",borderRadius:8,background:SC[proj.status]+"18",color:SC[proj.status],fontWeight:700,fontSize:F(12)}}>{proj.status}</span>],["Etapa",proj.stage],["Presupuesto",`${fCLP(proj.budget)} CLP`],["Fuente",proj.financier||"—"],["Programa",proj.program||"—"],["Vencimiento",fDate(proj.deadline)]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:"1px solid #f8fafc",gap:8}}>
                  <span style={{fontSize:F(13),color:"#64748b"}}>{k}</span>
                  <span style={{fontSize:F(13),fontWeight:700,color:"#0f172a",textAlign:"right"}}>{v}</span>
                </div>
              ))}
              {driveSync[proj.id]&&<div style={{marginTop:10,padding:"6px 10px",background:"#f0fdf4",borderRadius:6,fontSize:F(11),color:"#15803d"}}>📂 Última sync Drive: {driveSync[proj.id].lastSync?.slice(0,10)}</div>}
              {proj.codigoProyecto&&(
                <div style={{marginTop:8,padding:"6px 10px",background:"#f8fafc",borderRadius:6,fontSize:F(11),color:"#334155"}}>
                  🔑 Código: <strong style={{fontFamily:"monospace"}}>{proj.codigoProyecto}</strong>
                  {proj.codigoSIGE&&<span style={{color:"#94a3b8",marginLeft:8}}>SIGE: {proj.codigoSIGE}</span>}
                </div>
              )}
              <button onClick={()=>{setForm({...proj,budget:proj.budget||""});setEditId(proj.id);setShowForm(true);}} style={{...btn("#f1f5f9","#374151"),width:"100%",marginTop:14,fontSize:F(13)}}>✏️ Editar Proyecto</button>
            </div>
            {proj.aiSummary&&<div style={{background:"#eff6ff",borderRadius:10,padding:16,border:"1px solid #bfdbfe"}}><div style={{fontSize:F(11),fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>✨ Resumen IA</div><p style={{fontSize:F(13),color:"#1e3a5f",lineHeight:1.7,margin:0}}>{proj.aiSummary}</p></div>}
            {proj.licitId&&<LicitCard p={proj}/>}
            {/* Panel convenio del proyecto */}
            {(proj.convenio||convenioData.find(c=>c.projectId===proj.id))&&(()=>{
              const cd = convenioData.find(c=>c.projectId===proj.id);
              const cv = proj.convenio||{};
              const fin = cd?.plazoEjecucionFin || cv.plazoEjecucionFin || proj.deadline;
              const cvFin = cd?.plazoConvenioFin || cv.plazoConvenioFin;
              const today = new Date().toISOString().slice(0,10);
              const daysLeft = fin ? Math.round((new Date(fin)-new Date())/(1000*60*60*24)) : null;
              const pendMods = cd?.modificacionesPendientes||cv.modificaciones?.filter(m=>m.estado!=="aprobada")||[];
              const alertColor = daysLeft===null?"#64748b":daysLeft<30?"#ef4444":daysLeft<90?"#f97316":"#059669";
              const alertBg = daysLeft===null?"#f8fafc":daysLeft<30?"#fef2f2":daysLeft<90?"#fff7ed":"#f0fdf4";
              return(
                <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:F(11),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1}}>📋 Convenio & Plazos</div>
                    <button onClick={trackConvenios} disabled={trackingConvenio} style={{...btn(trackingConvenio?"#94a3b8":"#7c3aed"),fontSize:F(10),padding:"4px 10px"}}>
                      {trackingConvenio?"⏳":"🔄"} Actualizar
                    </button>
                  </div>
                  {proj.codigoProyecto&&(
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                      <span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,background:"#f1f5f9",color:"#334155",fontWeight:700,fontFamily:"monospace"}}>
                        🔑 {proj.codigoProyecto}
                      </span>
                      {proj.codigoSIGE&&<span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,background:"#eff6ff",color:"#1e3a5f",fontFamily:"monospace"}}>SIGE: {proj.codigoSIGE}</span>}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
                    {fin&&(
                      <div style={{background:alertBg,borderRadius:8,padding:"10px 12px",border:`1px solid ${alertColor}33`}}>
                        <div style={{fontSize:F(10),color:"#64748b",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>Vence ejecución</div>
                        <div style={{fontSize:F(14),fontWeight:700,color:alertColor}}>{fDate(fin)}</div>
                        {daysLeft!==null&&<div style={{fontSize:F(11),color:alertColor,marginTop:2}}>
                          {daysLeft>0?`${daysLeft} días restantes`:daysLeft===0?"⚠️ Vence hoy":`⚠️ Vencido hace ${Math.abs(daysLeft)} días`}
                        </div>}
                      </div>
                    )}
                    {cvFin&&(
                      <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",border:"1px solid #e2e8f0"}}>
                        <div style={{fontSize:F(10),color:"#64748b",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>Vence convenio</div>
                        <div style={{fontSize:F(14),fontWeight:700,color:"#475569"}}>{fDate(cvFin)}</div>
                        <div style={{fontSize:F(11),color:"#94a3b8",marginTop:2}}>{Math.round((new Date(cvFin)-new Date())/(1000*60*60*24))} días</div>
                      </div>
                    )}
                  </div>
                  {/* Modificaciones */}
                  {(cv.modificaciones||[]).length>0&&(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:F(10),color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.7,marginBottom:6}}>Modificaciones</div>
                      {cv.modificaciones.map((m,i)=>(
                        <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:5,fontSize:F(12)}}>
                          <span style={{color:m.estado==="aprobada"?"#059669":"#f59e0b",flexShrink:0,marginTop:1}}>{m.estado==="aprobada"?"✅":"⏳"}</span>
                          <div>
                            <span style={{color:"#334155"}}>{m.tipo}</span>
                            {m.oficio&&<span style={{color:"#94a3b8",marginLeft:6}}>{m.oficio}</span>}
                            {m.aprobacion&&<span style={{color:"#64748b",marginLeft:6}}>· {fDate(m.aprobacion)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Trámites pendientes detectados por Gmail */}
                  {pendMods.length>0&&pendMods.map((pm,i)=>(
                    <div key={i} style={{background:"#fffbeb",borderRadius:8,padding:"10px 12px",border:"1px solid #fde68a",marginTop:6}}>
                      <div style={{fontSize:F(11),fontWeight:700,color:"#92400e",marginBottom:4}}>⏳ {pm.tipo} — EN TRÁMITE</div>
                      {pm.fechaSolicitud&&<div style={{fontSize:F(11),color:"#78350f"}}>Solicitado: {fDate(pm.fechaSolicitud)}</div>}
                      {pm.proximoPaso&&<div style={{fontSize:F(11),color:"#92400e",marginTop:3,fontWeight:600}}>→ {pm.proximoPaso}</div>}
                      {pm.emailUrl&&<a href={pm.emailUrl} target="_blank" rel="noreferrer" style={{fontSize:F(11),color:"#1d4ed8",fontWeight:700,marginTop:4,display:"block"}}>Ver correo →</a>}
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* Reuniones del proyecto en Overview */}
            <CalMini projId={proj.id}/>
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}><div style={{fontSize:F(11),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Descripción Técnica</div><p style={{fontSize:F(13),color:"#334155",lineHeight:1.7,margin:0}}>{proj.desc}</p></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {[{l:"Docs",v:proj.docs.length,i:"📄",c:"#0284c7"},{l:"Correos",v:proj.emails.length,i:"✉️",c:"#7c3aed"},{l:"Pendientes",v:proj.tasks.filter(t=>t.status==="pending").length,i:"✅",c:"#059669"},{l:"Reuniones",v:eventsForProject(proj.id).filter(e=>e.start>=new Date().toISOString().slice(0,10)).length,i:"📅",c:"#1d4ed8"}].map(({l,v,i,c})=>(
                <div key={l} style={{background:"white",borderRadius:10,padding:"16px 10px",border:"1px solid #e2e8f0",textAlign:"center"}}>
                  <div style={{fontSize:F(20)}}>{i}</div><div style={{fontSize:F(22),fontWeight:800,color:c,lineHeight:1.2}}>{v}</div><div style={{fontSize:F(11),color:"#94a3b8",marginTop:3}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Reuniones del Proyecto */}
        {tab==="calendar"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:F(13),fontWeight:700,color:"#1d4ed8"}}>Reuniones asociadas al proyecto</div>
              <button onClick={syncCalendar} disabled={syncingCal} style={{...btn(syncingCal?"#94a3b8":"#0284c7"),fontSize:F(11),padding:"6px 12px",opacity:syncingCal?0.7:1}}>
                {syncingCal?"⏳":"🔄"} Sync Calendar
              </button>
            </div>
            {eventsForProject(proj.id).length===0&&(
              <div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",border:"2px dashed #e2e8f0"}}>
                <div style={{fontSize:F(30),marginBottom:8}}>📅</div>
                <div style={{fontSize:F(13),color:"#94a3b8"}}>Sin reuniones asociadas.<br/>Sincroniza Google Calendar o agrega manualmente.</div>
              </div>
            )}
            {eventsForProject(proj.id).sort((a,b)=>b.start.localeCompare(a.start)).map(e=>{
              const isUpcoming = e.start >= new Date().toISOString().slice(0,10);
              return(
                <div key={e.id||e.title+e.start} style={{background:isUpcoming?"white":"#f8fafc",borderRadius:10,padding:14,border:`1px solid ${isUpcoming?"#bfdbfe":"#e2e8f0"}`,marginBottom:10,opacity:isUpcoming?1:0.7}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{textAlign:"center",minWidth:40,flexShrink:0}}>
                      <div style={{fontSize:F(18),fontWeight:800,color:isUpcoming?"#1d4ed8":"#94a3b8",lineHeight:1}}>
                        {new Date(e.start+"T12:00:00").getDate()}
                      </div>
                      <div style={{fontSize:F(10),color:"#94a3b8",textTransform:"uppercase"}}>
                        {MONTHS_ES[new Date(e.start+"T12:00:00").getMonth()+1].slice(0,3)}
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:F(13),fontWeight:700,color:"#0f172a",marginBottom:3}}>{e.title}</div>
                      {e.time&&<div style={{fontSize:F(11),color:"#64748b",marginBottom:4}}>🕐 {e.time}</div>}
                      {e.description&&<div style={{fontSize:F(12),color:"#475569",lineHeight:1.5,padding:"6px 10px",background:"#f8fafc",borderRadius:5,marginBottom:6}}>{e.description}</div>}
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {!isUpcoming&&<span style={{fontSize:F(10),color:"#94a3b8"}}>Pasada</span>}
                        {isUpcoming&&<span style={{fontSize:F(10),padding:"2px 7px",borderRadius:5,background:"#eff6ff",color:"#1d4ed8",fontWeight:700}}>Próxima</span>}
                        {e.url&&<a href={e.url} target="_blank" rel="noreferrer" style={{fontSize:F(11),color:"#1d4ed8",fontWeight:600}}>Ver evento →</a>}
                        <button onClick={()=>saveCal(calendarEvents.filter(x=>(x.id||x.title+x.start)!==(e.id||e.title+e.start)))} style={{marginLeft:"auto",background:"none",border:"none",color:"#e2e8f0",cursor:"pointer",fontSize:F(14),padding:0}}>✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{marginTop:12}}>
              <div style={{fontSize:F(12),fontWeight:700,color:"#64748b",marginBottom:8}}>+ Agregar reunión manualmente</div>
              <AddEventForm onAdd={(ev)=>saveCal([...calendarEvents,{...ev,id:uid(),projectId:proj.id}])} projects={projects}/>
            </div>
          </div>
        )}

        {tab==="licitacion"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:F(11),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>ID Licitación — Mercado Público</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={proj.licitId||""} onChange={e=>saveP(projects.map(p=>p.id===proj.id?{...p,licitId:e.target.value}:p))} placeholder="Ej: 1431841-10-B226" style={{...inp,flex:1,fontFamily:"monospace",fontWeight:700}}/>
                <button onClick={()=>fetchLicit(proj)} disabled={!proj.licitId||fetchingLicit===proj.id} style={{...btn(!proj.licitId||fetchingLicit===proj.id?"#94a3b8":"#7c3aed"),padding:"10px 16px",opacity:!proj.licitId?0.5:1}}>
                  {fetchingLicit===proj.id?"⏳":"🔍"}{mob?"":" Consultar"}
                </button>
              </div>
            </div>
            {proj.licitId&&<LicitCard p={proj}/>}
          </div>
        )}

        {tab==="notes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:F(11),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Notas de Gestión</div>
              <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} onBlur={()=>saveP(projects.map(p=>p.id===proj.id?{...p,notes:notesDraft}:p))} rows={8} placeholder="Ej: Reunión con GORE el 10 abril. Pendiente firma resolución..." style={{...inp,resize:"vertical",fontSize:F(13),lineHeight:1.6}}/>
              <button onClick={genSummary} disabled={genSum||!notesDraft.trim()} style={{...btn(genSum||!notesDraft.trim()?"#94a3b8":"#1d4ed8"),width:"100%",marginTop:12,padding:14,opacity:genSum||!notesDraft.trim()?0.6:1}}>
                {genSum?"✨ Generando…":"✨ Generar Resumen Ejecutivo con IA"}
              </button>
            </div>
            {proj.aiSummary&&<div style={{background:"#eff6ff",borderRadius:10,padding:16,border:"1px solid #bfdbfe"}}><div style={{fontSize:F(11),fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>✨ Último Resumen</div><p style={{fontSize:F(13),color:"#1e3a5f",lineHeight:1.7,margin:0}}>{proj.aiSummary}</p><button onClick={genSummary} disabled={genSum} style={{...btn("#e0f2fe","#0369a1"),marginTop:12,fontSize:F(12),padding:"7px 14px"}}>🔄 Actualizar</button></div>}
          </div>
        )}

        {tab==="docs"&&(
          <div>
            <button onClick={()=>fileRef.current?.click()} disabled={extracting} style={{...btn(extracting?"#94a3b8":"#0284c7"),width:"100%",marginBottom:16,padding:14}}>
              {extracting?"⏳ Procesando con IA…":"📎 Subir Documento (PDF / Imagen)"}
            </button>
            {proj.docs.length===0&&!extracting&&<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",color:"#94a3b8",border:"2px dashed #e2e8f0"}}><div style={{fontSize:F(36),marginBottom:10}}>📄</div><div style={{fontSize:F(13)}}>Sin documentos.</div></div>}
            {proj.docs.map(d=>{let ex={};try{ex=JSON.parse(d.extracted);}catch{}return(
              <div key={d.id} style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <div><div style={{fontWeight:700,fontSize:F(14)}}>📄 {d.name}</div><div style={{fontSize:F(11),color:"#94a3b8"}}>{d.docType} · {fDate(d.uploadedAt)}</div></div>
                  <button onClick={()=>delDoc(d.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:F(18),padding:0}}>✕</button>
                </div>
                {d.summary&&<p style={{fontSize:F(13),color:"#334155",lineHeight:1.6,background:"#f8fafc",padding:"10px 12px",borderRadius:6,margin:"0 0 10px"}}>{d.summary}</p>}
                {ex.dates?.length>0&&<div style={{marginBottom:8}}>{ex.dates.map((dt,i)=><div key={i} style={{fontSize:F(12),color:"#334155",padding:"2px 0"}}>📅 {typeof dt==="object"?`${dt.date} — ${dt.description}`:dt}</div>)}</div>}
              </div>
            );})}
          </div>
        )}

        {tab==="tasks"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Nueva tarea…" style={{...inp,flex:1}}/>
              <button onClick={addTask} style={{...btn("#1d4ed8"),padding:"10px 18px",fontSize:F(16)}}>+</button>
            </div>
            {proj.tasks.length===0&&<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",color:"#94a3b8",border:"2px dashed #e2e8f0",fontSize:F(13)}}>Sin tareas.</div>}
            {["pending","done"].map(st=>{const ts=proj.tasks.filter(t=>t.status===st);if(!ts.length)return null;return(
              <div key={st} style={{marginBottom:14}}>
                <div style={{fontSize:F(11),fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{st==="pending"?"Pendientes":"Completadas"}</div>
                {ts.map(t=>(
                  <div key={t.id} style={{background:"white",borderRadius:8,padding:"13px 16px",border:"1px solid #e2e8f0",marginBottom:7,display:"flex",alignItems:"center",gap:10,opacity:st==="done"?0.55:1}}>
                    <input type="checkbox" checked={st==="done"} onChange={()=>toggleTask(t.id)} style={{cursor:"pointer",width:20,height:20,accentColor:"#1d4ed8",flexShrink:0}}/>
                    <span style={{fontSize:F(14),flex:1,textDecoration:st==="done"?"line-through":"none",color:st==="done"?"#94a3b8":"#1e293b",lineHeight:1.4}}>{t.text}</span>
                    <button onClick={()=>delTask(t.id)} style={{background:"none",border:"none",color:"#e2e8f0",cursor:"pointer",fontSize:F(16),padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            );})}
          </div>
        )}

        {tab==="emails"&&(
          <div>
            <button onClick={()=>setAddingEmail(true)} style={{...btn("#1d4ed8"),width:"100%",marginBottom:16,padding:14}}>+ Registrar Correo</button>
            {addingEmail&&(
              <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #bfdbfe",marginBottom:16}}>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
                  <div><label style={lbl}>Remitente</label><input value={emailForm.from} onChange={e=>setEmailForm(f=>({...f,from:e.target.value}))} style={inp} placeholder="nombre@dominio.cl"/></div>
                  <div><label style={lbl}>Fecha</label><input type="date" value={emailForm.date} onChange={e=>setEmailForm(f=>({...f,date:e.target.value}))} style={inp}/></div>
                </div>
                <div style={{marginBottom:12}}><label style={lbl}>Asunto</label><input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))} style={inp}/></div>
                <div style={{marginBottom:14}}><label style={lbl}>Contenido</label><textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))} rows={4} style={{...inp,resize:"vertical"}}/></div>
                <div style={{display:"flex",gap:8}}><button onClick={saveEmail} style={btn("#1d4ed8")}>Guardar</button><button onClick={()=>setAddingEmail(false)} style={btn("#f1f5f9","#374151")}>Cancelar</button></div>
              </div>
            )}
            {proj.emails.length===0&&!addingEmail&&<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",color:"#94a3b8",border:"2px dashed #e2e8f0"}}><div style={{fontSize:F(30),marginBottom:8}}>✉️</div><div style={{fontSize:F(13)}}>Sin correos.</div></div>}
            {proj.emails.map(e=>(
              <div key={e.id} style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><div style={{fontWeight:700,fontSize:F(14)}}>✉️ {e.subject}</div><div style={{fontSize:F(11),color:"#94a3b8",marginTop:2}}>De: {e.from} · {fDate(e.date)}</div></div>
                  <button onClick={()=>delEmail(e.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:F(18),padding:0}}>✕</button>
                </div>
                {e.body&&<p style={{fontSize:F(13),color:"#334155",marginTop:10,lineHeight:1.6,borderTop:"1px solid #f8fafc",paddingTop:10}}>{e.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── PANEL ACUSES DE LECTURA ──────────────────────────────────────
  const AcusesPanel = () => {
    const[filter,setFilter]=useState("all");
    const[search,setSearch]=useState("");
    const PROJ_N={"p1":"6ta Comisaría","p2":"Integración Cámaras","p3":"CCTV Centuras","p4":"UV32","p5":"Sala Monitoreo"};
    const PROJ_C={"p1":"#dc2626","p2":"#185FA5","p3":"#059669","p4":"#d97706","p5":"#7c3aed"};
    const ini=name=>name.split(" ").filter(w=>w.length>2).slice(0,2).map(w=>w[0]).toUpperCase().join("");
    const fdt=iso=>{
      if(!iso)return"—";
      const d=new Date(iso.includes("T")?iso:iso.replace(" ","T"));
      return d.toLocaleDateString("es-CL",{day:"2-digit",month:"short"})+" "+d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
    };
    const getStatus=e=>{
      const total=(e.recipients||[]).length;
      const read=(e.recipients||[]).filter(r=>r.readAt).length;
      if(!total)return"pending";
      return read===total?"all_read":read>0?"partial":"pending";
    };
    const [expanded,setExpanded]=useState(new Set());
    const toggle=id=>setExpanded(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});

    // Datos: usa readReceipts (dinámico desde Gmail) o datos iniciales
    const INIT_RECEIPTS=[
      {id:"e1",subject:"Proyecto Central de Monitoreo -1 / Factibilidad uso de Torre Telecom",context:"Solicitud de pronunciamiento para usar Torre Telecom como repetidor 5GHz.",sentDate:"2026-04-01",sentTime:"17:14",threadUrl:"https://mail.google.com/mail/u/0/#all/19d4aa05342a51ac",project:"p5",recipients:[{name:"Elizabeth Nuñez",email:"enunez@recoleta.cl",readAt:"2026-04-01 15:26"},{name:"Hernan Aravena",email:"haravena@recoleta.cl",readAt:"2026-04-02 08:56"},{name:"Maria Paz Juica",email:"mjuica@recoleta.cl",readAt:"2026-04-15 12:49"},{name:"Francisco Moscoso",email:"fmoscoso@recoleta.cl",readAt:"2026-04-15 13:00"},{name:"Carolina Velásquez",email:"cvelasquez@recoleta.cl",readAt:"2026-04-15 15:25"}]},
      {id:"e2",subject:"Re: Proyecto Central de Monitoreo -1 / Factibilidad uso de Torre Telecom (seguimiento 15 abr)",context:"Seguimiento enviado el 15 abril 12:09.",sentDate:"2026-04-15",sentTime:"12:09",threadUrl:"https://mail.google.com/mail/u/0/#all/19d4aa05342a51ac",project:"p5",recipients:[{name:"Hernan Aravena",email:"haravena@recoleta.cl",readAt:"2026-04-15 12:15"},{name:"Elizabeth Nuñez",email:"enunez@recoleta.cl",readAt:"2026-04-15 12:30"},{name:"Maria Paz Juica",email:"mjuica@recoleta.cl",readAt:"2026-04-15 12:49"},{name:"Francisco Moscoso",email:"fmoscoso@recoleta.cl",readAt:"2026-04-15 13:00"},{name:"Carolina Velásquez",email:"cvelasquez@recoleta.cl",readAt:"2026-04-15 15:25"}]},
      {id:"e3",subject:"Re: Envia convenio MTT sobre acceso a imágenes de puntos de cámaras",context:"Acción requerida sobre convenio MTT. Enviado 15 abr 11:41.",sentDate:"2026-04-15",sentTime:"11:41",threadUrl:"https://mail.google.com/mail/u/0/#all/19d68379ad0c8606",project:"p5",recipients:[{name:"Hernan Aravena",email:"haravena@recoleta.cl",readAt:"2026-04-15 08:51"},{name:"Carolina Velásquez",email:"cvelasquez@recoleta.cl",readAt:"2026-04-15 08:54"},{name:"Maria Paz Juica",email:"mjuica@recoleta.cl",readAt:"2026-04-15 09:10"},{name:"Elizabeth Nuñez",email:"enunez@recoleta.cl",readAt:"2026-04-15 12:28"}]},
      {id:"e4",subject:"Re: Modificación Plazo SNSM23-STP-0039 Municipalidad Recoleta",context:"Seguimiento ficha modificación de plazo enviada a SPD. 14 abr 15:51.",sentDate:"2026-04-14",sentTime:"15:51",threadUrl:"https://mail.google.com/mail/u/0/#all/19d1ab5d03fb53ce",project:"p2",recipients:[{name:"Hernan Aravena",email:"haravena@recoleta.cl",readAt:"2026-04-15 09:12"},{name:"Osvaldo Muñoz (SPD)",email:"omunoz@minsegpublica.gob.cl",readAt:null},{name:"Maria Paz Juica",email:"mjuica@recoleta.cl",readAt:null},{name:"Genaro Cuadros",email:"gcuadros@recoleta.cl",readAt:null}]},
      {id:"e5",subject:"Proyecto Sala de Monitoreo Edificio Consistorial - Recoleta",context:"Correo 1 abril 13:58. Confirmaciones jefatura y Elizabeth Nuñez.",sentDate:"2026-04-01",sentTime:"13:58",threadUrl:"https://mail.google.com/mail/u/0/#all/19d49b7da102875b",project:"p5",recipients:[{name:"Hernan Aravena",email:"haravena@recoleta.cl",readAt:"2026-04-01 15:17"},{name:"Elizabeth Nuñez",email:"enunez@recoleta.cl",readAt:"2026-04-01 15:28"},{name:"Maria Paz Juica",email:"mjuica@recoleta.cl",readAt:"2026-04-02 13:59"}]},
    ];
    const data = readReceipts.length>0 ? readReceipts : INIT_RECEIPTS;
    let list=data;
    if(filter!=="all")list=list.filter(e=>getStatus(e)===filter);
    if(search)list=list.filter(e=>e.subject.toLowerCase().includes(search.toLowerCase())||
      (e.recipients||[]).some(r=>r.name.toLowerCase().includes(search.toLowerCase())));

    const totalConf=data.reduce((a,e)=>a+(e.recipients||[]).filter(r=>r.readAt).length,0);
    const totalRcpt=data.reduce((a,e)=>a+(e.recipients||[]).length,0);
    const ss=syncStatus.acuses||{state:"idle",ts:null,msg:""};
    const stateColor=ss.state==="ok"?"#059669":ss.state==="error"?"#dc2626":ss.state==="warn"?"#d97706":"#64748b";

    return(
      <div style={{padding:mob?"16px 16px 90px":"24px",...scroll}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:F(16),fontWeight:800,color:"#0f172a",marginBottom:3}}>👁 Acuses de Lectura</div>
            <div style={{fontSize:F(12),color:"#64748b"}}>Seguimiento de confirmaciones en correos enviados con solicitud de lectura</div>
          </div>
          <button onClick={()=>syncReadReceipts(false)} disabled={syncingReceipts}
            style={{...btn(syncingReceipts?"#94a3b8":"#7c3aed"),fontSize:F(12),padding:"9px 16px",opacity:syncingReceipts?0.7:1}}>
            {syncingReceipts?"⏳ Sincronizando…":"🔄 Actualizar desde Gmail"}
          </button>
        </div>

        {/* Estado de sincronización */}
        <div style={{background:ss.state==="error"?"#fef2f2":ss.state==="ok"?"#f0fdf4":"#f8fafc",borderRadius:8,padding:"10px 14px",border:`1px solid ${stateColor}33`,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
            <div style={{fontSize:F(12),color:stateColor,fontWeight:600}}>
              {ss.state==="loading"?"⏳":ss.state==="ok"?"✓":ss.state==="error"?"✕":ss.state==="warn"?"⚠":"○"} {ss.msg||"Sin sincronizar — presiona Actualizar o espera el horario automático"}
            </div>
            {ss.ts&&<div style={{fontSize:F(10),color:"#94a3b8"}}>{new Date(ss.ts).toLocaleDateString("es-CL")} {new Date(ss.ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</div>}
          </div>
          {ss.code&&<div style={{fontSize:F(10),color:"#dc2626",marginTop:4,fontFamily:"monospace"}}>Código de falla: {ss.code}</div>}
          <div style={{fontSize:F(10),color:"#94a3b8",marginTop:4}}>Actualización automática: 08:05 · 11:00 · 14:00 · 17:35 (L-V)</div>
        </div>

        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[
            {l:"Correos con acuse",v:data.length,c:"#7c3aed",bg:"#f5f3ff"},
            {l:"Confirmaciones",v:`${totalConf}/${totalRcpt}`,c:"#059669",bg:"#f0fdf4"},
            {l:"Leídos todos",v:data.filter(e=>getStatus(e)==="all_read").length,c:"#3B6D11",bg:"#EAF3DE"},
            {l:"Pendientes",v:data.filter(e=>getStatus(e)==="pending").length,c:"#A32D2D",bg:"#FCEBEB"},
          ].map(({l,v,c,bg})=>(
            <div key={l} style={{background:bg,borderRadius:8,padding:"12px 14px",border:`1px solid ${c}22`}}>
              <div style={{fontSize:F(10),color:"#64748b",textTransform:"uppercase",letterSpacing:.04,marginBottom:4}}>{l}</div>
              <div style={{fontSize:F(20),fontWeight:700,color:c}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          {[["all","Todos"],["all_read","Leídos todos"],["partial","Parcial"],["pending","Pendientes"]].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{fontSize:F(11),padding:"5px 12px",borderRadius:20,border:`0.5px solid ${filter===f?"#7c3aed":"var(--color-border-secondary)"}`,background:filter===f?"#7c3aed":"transparent",color:filter===f?"white":"var(--color-text-secondary)",cursor:"pointer"}}>
              {l}
            </button>
          ))}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar asunto o persona…" style={{flex:1,minWidth:140,fontSize:F(12),padding:"7px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}/>
        </div>

        {/* Lista */}
        {list.length===0&&<div style={{textAlign:"center",padding:"2rem",color:"#94a3b8",fontSize:F(13)}}>Sin resultados para el filtro actual.</div>}
        {list.map(email=>{
          const st=getStatus(email);
          const total=(email.recipients||[]).length;
          const readCount=(email.recipients||[]).filter(r=>r.readAt).length;
          const pct=total?Math.round((readCount/total)*100):0;
          const isOpen=expanded.has(email.id);
          const stBadgeC=st==="all_read"?"#27500A":st==="partial"?"#633806":"#791F1F";
          const stBadgeBg=st==="all_read"?"#EAF3DE":st==="partial"?"#FAEEDA":"#FCEBEB";
          const stLabel=st==="all_read"?"Leído por todos":st==="partial"?`${readCount}/${total} confirmados`:"Sin confirmaciones";
          const projColor=PROJ_C[email.project]||"#64748b";
          const projName=PROJ_N[email.project]||"General";
          return(
            <div key={email.id} style={{background:"white",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,marginBottom:10,overflow:"hidden"}}>
              <div onClick={()=>toggle(email.id)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",cursor:"pointer"}}>
                <span style={{fontSize:F(14),color:"var(--color-text-tertiary)",flexShrink:0,marginTop:2,transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"none"}}>▶</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:F(14),fontWeight:500,color:"var(--color-text-primary)",lineHeight:1.35,marginBottom:4}}>
                    {email.subject.length>85?email.subject.slice(0,85)+"…":email.subject}
                  </div>
                  <div style={{fontSize:F(12),color:"var(--color-text-secondary)",marginBottom:6,lineHeight:1.5}}>{email.context}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:F(11),padding:"3px 9px",borderRadius:8,background:stBadgeBg,color:stBadgeC,fontWeight:500}}>{stLabel}</span>
                    <span style={{fontSize:F(11),padding:"3px 8px",borderRadius:8,background:projColor+"15",color:projColor,fontWeight:500}}>{projName}</span>
                    <span style={{fontSize:F(11),color:"var(--color-text-tertiary)"}}>{email.sentDate} {email.sentTime}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:60,height:4,background:"var(--color-background-tertiary)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#639922":pct>0?"#EF9F27":"#E24B4A",borderRadius:2}}/>
                    </div>
                    <span style={{fontSize:F(11),color:"var(--color-text-secondary)",minWidth:28}}>{pct}%</span>
                  </div>
                  <span style={{fontSize:F(10),color:"var(--color-text-tertiary)"}}>{readCount}/{total}</span>
                </div>
              </div>
              {isOpen&&(
                <div>
                  <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",padding:"12px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                    <div style={{gridColumn:"1/-1",fontSize:F(10),color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:.05,marginBottom:4}}>Confirmaciones por destinatario</div>
                    {(email.recipients||[]).map(r=>{
                      const hasRead=!!r.readAt;
                      return(
                        <div key={r.email} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"var(--color-background-secondary)",borderRadius:8}}>
                          <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:F(11),fontWeight:500,flexShrink:0,background:hasRead?"#EAF3DE":"#FCEBEB",color:hasRead?"#27500A":"#791F1F"}}>{ini(r.name)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:F(12),fontWeight:500,color:"var(--color-text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</div>
                            <div style={{fontSize:F(10),color:"var(--color-text-secondary)",marginTop:1}}>{hasRead?`Leído ${fdt(r.readAt)}`:"Sin confirmación"}</div>
                          </div>
                          <span style={{fontSize:F(10),padding:"2px 7px",borderRadius:4,background:hasRead?"#EAF3DE":"var(--color-background-tertiary)",color:hasRead?"#3B6D11":"var(--color-text-secondary)",flexShrink:0}}>{hasRead?"Leído":"Pendiente"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",padding:"10px 16px",display:"flex",gap:8,alignItems:"center"}}>
                    <a href={email.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:F(12),color:"#185FA5",fontWeight:500}}>Abrir hilo en Gmail →</a>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Monitor de Scheduler */}
        <div style={{marginTop:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:F(12),fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:.05}}>Monitor de Sincronización Automática</div>
            <button onClick={()=>setShowSchedLog(v=>!v)} style={{fontSize:F(11),padding:"4px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",cursor:"pointer",color:"var(--color-text-secondary)"}}>
              {showSchedLog?"Ocultar":"Ver registro"}
            </button>
          </div>

          {/* Próximas ejecuciones */}
          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
            <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <div style={{fontSize:F(10),color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:.04,marginBottom:6}}>🕐 Reloj Control — 3 veces/día (L-V)</div>
              <div style={{fontSize:F(12),color:"var(--color-text-primary)"}}>08:00 · 13:30 · 17:30</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                {(()=>{
                  const s=syncStatus.reloj||{};
                  const c=s.state==="ok"?"#059669":s.state==="error"?"#dc2626":s.state==="warn"?"#d97706":"#64748b";
                  return(
                    <>
                      <span style={{fontSize:F(10),padding:"2px 7px",borderRadius:4,background:c+"15",color:c}}>{s.state==="ok"?"✓ OK":s.state==="error"?"✕ Error":s.state==="warn"?"⚠ Advertencia":"○ En espera"}</span>
                      {s.ts&&<span style={{fontSize:F(10),color:"var(--color-text-tertiary)"}}>Último: {new Date(s.ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</span>}
                      {s.code&&<span style={{fontSize:F(10),color:"#dc2626",fontFamily:"monospace"}}>cod: {s.code}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
            <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px 14px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <div style={{fontSize:F(10),color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:.04,marginBottom:6}}>👁 Acuses de Lectura — 4 veces/día (L-V)</div>
              <div style={{fontSize:F(12),color:"var(--color-text-primary)"}}>08:05 · 11:00 · 14:00 · 17:35</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                {(()=>{
                  const s=syncStatus.acuses||{};
                  const c=s.state==="ok"?"#059669":s.state==="error"?"#dc2626":s.state==="warn"?"#d97706":"#64748b";
                  return(
                    <>
                      <span style={{fontSize:F(10),padding:"2px 7px",borderRadius:4,background:c+"15",color:c}}>{s.state==="ok"?"✓ OK":s.state==="error"?"✕ Error":s.state==="warn"?"⚠ Advertencia":"○ En espera"}</span>
                      {s.ts&&<span style={{fontSize:F(10),color:"var(--color-text-tertiary)"}}>Último: {new Date(s.ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</span>}
                      {s.code&&<span style={{fontSize:F(10),color:"#dc2626",fontFamily:"monospace"}}>cod: {s.code}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Log de ejecuciones */}
          {showSchedLog&&(
            <div style={{background:"white",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8,overflow:"hidden"}}>
              <div style={{padding:"8px 14px",background:"var(--color-background-secondary)",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:F(11),fontWeight:500,color:"var(--color-text-secondary)"}}>Registro de ejecuciones ({schedLog.length})</div>
                <button onClick={()=>{saveSchedLog([]);}} style={{fontSize:F(10),color:"#94a3b8",background:"none",border:"none",cursor:"pointer"}}>Limpiar</button>
              </div>
              {schedLog.length===0&&<div style={{padding:"1rem",fontSize:F(12),color:"var(--color-text-tertiary)",textAlign:"center"}}>Sin ejecuciones registradas aún.</div>}
              {schedLog.slice(0,20).map(entry=>{
                const c=entry.result==="ok"?"#059669":entry.result==="error"?"#dc2626":"#d97706";
                return(
                  <div key={entry.id} style={{padding:"10px 14px",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:F(13),flexShrink:0,marginTop:1}}>{entry.result==="ok"?"✓":entry.result==="error"?"✕":"⚠"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2,flexWrap:"wrap"}}>
                        <span style={{fontSize:F(11),fontWeight:500,color:c,textTransform:"uppercase"}}>{entry.type}</span>
                        <span style={{fontSize:F(10),color:"var(--color-text-tertiary)"}}>{new Date(entry.ts).toLocaleDateString("es-CL")} {new Date(entry.ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}</span>
                        {entry.code&&<span style={{fontSize:F(10),color:"#dc2626",fontFamily:"monospace",background:"#fef2f2",padding:"1px 5px",borderRadius:3}}>{entry.code}</span>}
                      </div>
                      <div style={{fontSize:F(12),color:"var(--color-text-secondary)",lineHeight:1.4}}>{entry.msg}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── CHAT ──────────────────────────────────────────
  const chatPanel=(
    <div style={{display:"flex",flexDirection:"column",height:mob?"calc(100vh - 58px - 58px)":"100%",background:"white"}}>
      <div style={{padding:"10px 14px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",flexShrink:0}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {["¿Qué seguimientos están críticos?","Resumen para Alcalde","¿Cuándo cierra licitación?","Estado cotizaciones SNSM2025"].map(q=>(
            <button key={q} onClick={()=>setInput(q)} style={{fontSize:F(11),padding:"5px 11px",borderRadius:12,background:"white",border:"1px solid #e2e8f0",cursor:"pointer",color:"#475569"}}>{q}</button>
          ))}
        </div>
      </div>
      <div ref={chatRef} style={{flex:1,...scroll,padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"86%",padding:"11px 14px",borderRadius:12,background:m.role==="user"?"#1d4ed8":"#f1f5f9",color:m.role==="user"?"white":"#1e293b",fontSize:F(13),lineHeight:1.6,whiteSpace:"pre-wrap",borderBottomRightRadius:m.role==="user"?2:12,borderBottomLeftRadius:m.role==="user"?12:2}}>{m.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex"}}><div style={{padding:"11px 14px",borderRadius:12,background:"#f1f5f9",fontSize:F(12),color:"#94a3b8"}}>Consultando cartera…</div></div>}
      </div>
      <div style={{padding:"12px 14px",borderTop:"1px solid #e2e8f0",display:"flex",gap:8,flexShrink:0,paddingBottom:mob?"calc(12px + env(safe-area-inset-bottom))":"12px"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Pregunta sobre tus proyectos…" style={{...inp,flex:1}}/>
        <button onClick={send} disabled={loading} style={{...btn("#1d4ed8"),padding:"11px 16px",fontSize:F(16),opacity:loading?0.5:1,flexShrink:0}}>→</button>
      </div>
    </div>
  );

  // ── MODAL ─────────────────────────────────────────
  const modal=showForm&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",zIndex:300}}>
      <div style={{background:"white",borderRadius:mob?"16px 16px 0 0":"12px",padding:22,width:mob?"100%":"520px",maxHeight:"92vh",...scroll,boxSizing:"border-box"}}>
        <div style={{fontWeight:700,fontSize:F(16),color:"#0f172a",marginBottom:20}}>{editId?"Editar Proyecto":"Nuevo Proyecto"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp}/></div>
          <div><label style={lbl}>Presupuesto (CLP)</label><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={inp} placeholder="Ej: 914000000"/></div>
          {form.budget&&Number(form.budget)>0&&<div style={{fontSize:F(13),color:"#1d4ed8",fontWeight:700,padding:"5px 12px",background:"#eff6ff",borderRadius:6}}>→ {fCLP(Number(form.budget))} CLP</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Financiamiento</label><select value={form.financier} onChange={e=>setForm(f=>({...f,financier:e.target.value}))} style={inp}>{FINANCIERS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={lbl}>Vencimiento</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={inp}/></div>
          </div>
          <div><label style={lbl}>Programa / Fondo</label><input value={form.program||""} onChange={e=>setForm(f=>({...f,program:e.target.value}))} style={inp} placeholder="Ej: FNSP"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={lbl}>Etapa</label><select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={inp}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={lbl}>Estado</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inp}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label style={lbl}>ID Licitación MP (opcional)</label><input value={form.licitId||""} onChange={e=>setForm(f=>({...f,licitId:e.target.value}))} style={{...inp,fontFamily:"monospace"}} placeholder="Ej: 1431841-10-B226"/></div>
          <div><label style={lbl}>Descripción Técnica</label><textarea value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} rows={3} style={{...inp,resize:"vertical"}}/></div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setShowForm(false);setForm(EF);setEditId(null);}} style={{...btn("#f1f5f9","#374151"),flex:1}}>Cancelar</button>
          <button onClick={()=>{
            if(!form.name.trim())return;
            const upd={...form,id:editId||uid(),budget:parseFloat(form.budget)||0,docs:form.docs||[],emails:form.emails||[],tasks:form.tasks||[],notes:form.notes||"",aiSummary:form.aiSummary||"",licitData:form.licitData||null,licitChecked:form.licitChecked||""};
            saveP(editId?projects.map(p=>p.id===editId?upd:p):[...projects,upd]);
            setSel(upd.id);setTab("overview");setView("project");setShowForm(false);setForm(EF);setEditId(null);
          }} style={{...btn("#1d4ed8"),flex:1}}>Guardar</button>
        </div>
      </div>
    </div>
  );

  // ── MOBILE NAV ────────────────────────────────────
  const mobileNav=mob&&(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #e2e8f0",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {[["dash","📊","Dashboard"],["projects","📁","Proyectos"],["calendar","📅","Agenda"],["chat","🤖","Asistente"]].map(([v,icon,label])=>(
        <button key={v} onClick={()=>{if(v==="calendar"){setView("dash");setMainTab("calendar");}else{setView(v);setMainTab("dash");}}} style={{flex:1,padding:"12px 4px 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span style={{fontSize:F(20)}}>{icon}</span>
          <span style={{fontSize:F(11),fontWeight:(view===v||(v==="calendar"&&mainTab==="calendar"))?700:400,color:(view===v||(v==="calendar"&&mainTab==="calendar"))?"#1d4ed8":"#94a3b8"}}>{label}</span>
          {(view===v||(v==="calendar"&&mainTab==="calendar"))&&<div style={{width:22,height:2,background:"#1d4ed8",borderRadius:2}}/>}
        </button>
      ))}
    </div>
  );

  // ── SIDEBAR DESKTOP ───────────────────────────────
  const sidebar = !mob && (
    <div style={{width:270,background:"#0f172a",...scroll,flexShrink:0,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"10px 8px"}}>
        <button onClick={()=>{setSel(null);setView("dash");setMainTab("dash");}} style={{width:"100%",padding:"11px 14px",borderRadius:7,background:(view==="dash"&&mainTab==="dash")?"#1e3a5f":"transparent",color:(view==="dash"&&mainTab==="dash")?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:F(13),fontWeight:600,display:"flex",alignItems:"center",gap:8}}>📊 Dashboard General</button>
        {/* Nueva entrada: Respondidas */}
        <button onClick={()=>{setSel(null);setView("dash");setMainTab("answered");}} style={{width:"100%",padding:"11px 14px",borderRadius:7,background:mainTab==="answered"?"#1e3a5f":"transparent",color:mainTab==="answered"?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:F(13),fontWeight:600,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span>✅ Solicitudes Respondidas</span>
          {answeredRequests.length>0&&<span style={{fontSize:F(10),background:"#22c55e33",color:"#22c55e",padding:"1px 7px",borderRadius:10,fontWeight:700}}>{answeredRequests.length}</span>}
        </button>
        <button onClick={()=>{setSel(null);setView("dash");setMainTab("acuses");}} style={{width:"100%",padding:"11px 14px",borderRadius:7,background:mainTab==="acuses"?"#1e3a5f":"transparent",color:mainTab==="acuses"?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:F(13),fontWeight:600,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span>👁 Acuses de Lectura</span>
          {readReceipts.length>0&&<span style={{fontSize:F(10),background:"#7c3aed33",color:"#a78bfa",padding:"1px 7px",borderRadius:10,fontWeight:700}}>{readReceipts.length}</span>}
        </button>
        {/* Nueva entrada: Calendario */}
        <button onClick={()=>{setSel(null);setView("dash");setMainTab("calendar");}} style={{width:"100%",padding:"11px 14px",borderRadius:7,background:mainTab==="calendar"?"#1e3a5f":"transparent",color:mainTab==="calendar"?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:F(13),fontWeight:600,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span>📅 Calendario</span>
          {calendarEvents.filter(e=>e.start>=new Date().toISOString().slice(0,10)).length>0&&<span style={{fontSize:F(10),background:"#3b82f633",color:"#93c5fd",padding:"1px 7px",borderRadius:10,fontWeight:700}}>{calendarEvents.filter(e=>e.start>=new Date().toISOString().slice(0,10)).length}</span>}
        </button>
      </div>
      {pendingGf.length>0&&(
        <div style={{margin:"0 10px 6px",padding:"10px 12px",background:"#7f1d1d22",borderRadius:7,border:"1px solid #ef444433"}}>
          <div style={{fontSize:F(10),color:"#fca5a5",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>📬 Seguimientos</div>
          {criticalGf.length>0&&<div style={{fontSize:F(12),color:"#ef4444",fontWeight:700}}>🔴 {criticalGf.length} crítico(s)</div>}
          <div style={{fontSize:F(11),color:"#94a3b8"}}>{pendingGf.length} pendiente(s)</div>
        </div>
      )}
      <div style={{padding:"0 8px",flex:1}}>
        <div style={{fontSize:F(10),color:"#334155",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"10px 12px 6px"}}>Proyectos</div>
        {projects.map(p=>{
          const projEvs=eventsForProject(p.id).filter(e=>e.start>=new Date().toISOString().slice(0,10));
          return(
          <button key={p.id} onClick={()=>{setSel(p.id);setTab("overview");setView("project");setMainTab("dash");}} style={{width:"100%",padding:"11px 14px",borderRadius:7,background:sel===p.id?"#1e3a5f":"transparent",border:sel===p.id?"1px solid #1d4ed8":"1px solid transparent",cursor:"pointer",textAlign:"left",marginBottom:3}}>
            <div style={{fontSize:F(12),fontWeight:sel===p.id?700:500,color:sel===p.id?"#e2e8f0":"#94a3b8",lineHeight:1.3,marginBottom:5}}>{p.name}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <span style={{fontSize:F(10),padding:"2px 7px",borderRadius:8,background:SC[p.status]+"25",color:SC[p.status],fontWeight:700}}>{p.status}</span>
              <span style={{fontSize:F(10),padding:"2px 6px",borderRadius:8,background:"#1e293b",color:"#64748b"}}>{p.financier}</span>
              {projEvs.length>0&&<span style={{fontSize:F(10),padding:"2px 6px",borderRadius:8,background:"#172554",color:"#93c5fd"}}>📅 {projEvs.length}</span>}
            </div>
          </button>
        );})}
      </div>
      <div style={{padding:"10px 8px"}}><button onClick={()=>{setForm(EF);setEditId(null);setShowForm(true);}} style={{...btn("#1d4ed8"),width:"100%",fontSize:F(12)}}>+ Nuevo Proyecto</button></div>
    </div>
  );

  // ── RENDER PRINCIPAL ──────────────────────────────
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#f1f5f9",overflow:"hidden"}}>
      {header}
      <div style={{flex:1,overflow:"hidden",display:"flex"}}>
        {mob?(
          <div style={{flex:1,...scroll}}>
            {view==="dash"&&mainTab==="dash"&&dashContent}
            {view==="dash"&&mainTab==="answered"&&<AnsweredPanel/>}
            {view==="dash"&&mainTab==="calendar"&&<CalendarPanel/>}
            {view==="projects"&&(
              <div style={{padding:"16px 16px 90px"}}>
                {projects.map(p=>(
                  <div key={p.id} onClick={()=>{setSel(p.id);setTab("overview");setView("project");}} style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0",marginBottom:12,borderLeft:`4px solid ${SC[p.status]}`,cursor:"pointer"}}>
                    <div style={{fontWeight:700,fontSize:F(15),color:"#0f172a",marginBottom:8}}>{p.name}</div>
                    <div style={{display:"flex",gap:6,justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:6}}>
                        <span style={{fontSize:F(11),padding:"3px 10px",borderRadius:8,background:SC[p.status]+"18",color:SC[p.status],fontWeight:700}}>{p.status}</span>
                        <span style={{fontSize:F(11),padding:"3px 9px",borderRadius:8,background:"#e0f2fe",color:"#0369a1"}}>{p.financier}</span>
                      </div>
                      <span style={{fontSize:F(14),fontWeight:800,color:"#1d4ed8"}}>{fCLP(p.budget)}</span>
                    </div>
                  </div>
                ))}
                <button onClick={()=>{setForm(EF);setEditId(null);setShowForm(true);}} style={{...btn("#0f172a"),width:"100%",padding:14}}>+ Nuevo Proyecto</button>
              </div>
            )}
            {view==="project"&&proj&&projDetail}
            {view==="chat"&&chatPanel}
          </div>
        ):(
          <>
            {sidebar}
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
              {/* Render según mainTab */}
              {view!=="project"&&view!=="chat"&&mainTab==="dash"&&<div style={{flex:1,...scroll}}>{dashContent}</div>}
              {view!=="project"&&view!=="chat"&&mainTab==="answered"&&<div style={{flex:1,...scroll}}><AnsweredPanel/></div>}
              {view!=="project"&&view!=="chat"&&mainTab==="acuses"&&<div style={{flex:1,...scroll}}><AcusesPanel/></div>}
              {view!=="project"&&view!=="chat"&&mainTab==="calendar"&&<div style={{flex:1,...scroll}}><CalendarPanel/></div>}
              {view==="project"&&proj&&projDetail}
            </div>
            {view==="chat"&&(
              <div style={{width:390,borderLeft:"1px solid #e2e8f0",display:"flex",flexDirection:"column",flexShrink:0}}>
                <div style={{padding:"13px 18px",background:"#0f172a",color:"white",flexShrink:0}}>
                  <div style={{fontWeight:700,fontSize:F(13)}}>🤖 Asistente SECPLA</div>
                  <div style={{fontSize:F(11),color:"#64748b",marginTop:2}}>Cartera · Gmail · Licitaciones · Docs</div>
                </div>
                {chatPanel}
              </div>
            )}
          </>
        )}
      </div>
      {mobileNav}
      {modal}
    </div>
  );
}
