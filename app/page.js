"use client";
import { useState, useEffect, useRef } from "react";

const fCLP = n => !n ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`;
const fDate = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const uid = () => Math.random().toString(36).slice(2,9);
const STAGES = ["Formulación","Diseño","Licitación","Adjudicación","Ejecución","Recepción","Completado","Archivado"];
const STATUSES = ["En curso","Pendiente","Detenido","Completado","Con alerta"];
const FINANCIERS = ["GORE","SPD","Municipal","MININT","FNDR","Otro"];
const SC = {"En curso":"#3b82f6","Pendiente":"#f59e0b","Detenido":"#ef4444","Completado":"#22c55e","Con alerta":"#f97316"};
const MPC = {"Publicada":"#059669","En proceso":"#3b82f6","Cerrada":"#f59e0b","Adjudicada":"#7c3aed","Desierta":"#ef4444","Revocada":"#ef4444"};
const UC = {"crítica":"#ef4444","alta":"#f97316","media":"#f59e0b"};
const UL = {"crítica":"🔴","alta":"🟠","media":"🟡"};

const GMAIL_FOLLOWS_INIT = [
  {id:"gf1",projectId:"p2",urgency:"alta",subject:"Factibilidad uso Torre Telecom — Central Monitoreo",to:"Francisco Moscoso (fmoscoso@recoleta.cl)",context:"Solicitud de pronunciamiento y autorización para usar Torre Telecom del edificio consistorial como repetidor 5GHz para enlace Cerro Blanco → Central de Monitoreo. Solo llegaron acuses de lectura. Francisco Moscoso no ha respondido.",sentDate:"2026-04-01",daysPending:12,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#all/19d4aa05342a51ac"},
  {id:"gf2",projectId:"p2",urgency:"alta",subject:"Modificación Plazo SNSM23-STP-0039 — Ficha subsanada enviada a SPD",to:"Osvaldo Muñoz Vallejos — SPD (omunoz@minsegpublica.gob.cl)",context:"Ficha modificación con observaciones subsanadas enviada el 7 abril. SPD no ha confirmado aprobación ni cierre del SIGE 22004928.",sentDate:"2026-04-07",daysPending:6,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#all/19d1ab5d03fb53ce"},
  {id:"gf3",projectId:"p2",urgency:"alta",subject:"Cotización SNSM2025 — Scharfstein (3er seguimiento)",to:"Sebastian Merino / Cristobal Cruz (smerino@scharfstein.cl)",context:"Cotización solicitada el 11 marzo. 3er seguimiento enviado el 10 abril. Sin cotización aún. Respondieron el 1 abril que están evaluando precios por situación geopolítica.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#all/19cddd6313f40188"},
  {id:"gf4",projectId:"p2",urgency:"crítica",subject:"2do Llamado Trato Directo Sala Monitoreo — 2 correos fallidos",to:"Securitas.cl / Prosegur (emails rebotaron)",context:"Plazo límite 16 abril. 2 correos fallaron: comercial@securitas.cl (dominio no existe) y ventas.empresas@prosegur.com (usuario desconocido). Buscar correos correctos urgente.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#all/19d73316aebeb956"},
  {id:"gf5",projectId:"p2",urgency:"media",subject:"Cotización SNSM2025 — Grupo VSM",to:"comunicaciones@grupovsm.cl / contacto@grupovsm.cl",context:"Cotización enviada el 10 abril. Sin respuesta aún.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#search/in:sent subject:SNSM2025"},
  {id:"gf6",projectId:"p2",urgency:"media",subject:"Cotización SNSM2025 — RockTech",to:"fabiana.rifo@rocktechla.com / sergio@rocktechla.com",context:"Cotización enviada el 10 abril. Sin respuesta aún.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#search/in:sent subject:SNSM2025"},
  {id:"gf7",projectId:"p2",urgency:"alta",subject:"Supervisión Convenio IYT25-SET-0011 — Registrar acuerdos",to:"Daniel Galarce León — SPD (dgalarce@minsegpublica.gob.cl)",context:"Reunión de primera supervisión fue el 14 abril 16:00. Pendiente registrar acuerdos y compromisos.",sentDate:"2026-04-10",daysPending:3,status:"pendiente",threadUrl:"https://mail.google.com/mail/u/0/#all/19d77c3547e2747f"}
];

const INIT_PROJECTS = [
  {id:"p1",name:"Cámaras UV N°32 — GORE",budget:914000000,stage:"Licitación",status:"En curso",deadline:"",financier:"GORE",program:"FNDR",desc:"Sistema de cámaras de vigilancia urbana para sectores de Recoleta. Licitación activa en Mercado Público / SIEVAP.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p2",name:"Central Monitoreo SPD / SNSM2025",budget:98000000,stage:"Ejecución",status:"Con alerta",deadline:"2026-04-16",financier:"SPD",program:"FNSP",desc:"Central de monitoreo SPD y postaciones SNSM2025. Múltiples cotizaciones en curso. Ficha modificación plazo enviada a SPD pendiente aprobación.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p3",name:"Red Zona Norte/Sur Recoleta",budget:800000000,stage:"Diseño",status:"Pendiente",deadline:"",financier:"GORE",program:"FNDR",desc:"Diseño de red de seguridad para zonas norte y sur de Recoleta.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]},
  {id:"p4",name:"CCTV DISEHU — Ingeniería Procesos",budget:0,stage:"Completado",status:"Completado",deadline:"",financier:"Municipal",program:"Presupuesto Municipal",desc:"Modelo operativo integral Central CCTV. Completado y entregado.",notes:"",aiSummary:"",licitId:"",licitData:null,licitChecked:"",docs:[],emails:[],tasks:[]}
];

const EF = {name:"",budget:"",stage:"Formulación",status:"Pendiente",deadline:"",financier:"GORE",program:"",desc:"",notes:"",licitId:""};

function useW(){const[w,sw]=useState(900);useEffect(()=>{sw(window.innerWidth);const h=()=>sw(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return w;}

function storage(){
  const get=k=>{if(typeof window==="undefined")return null;try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}};
  const set=(k,v)=>{if(typeof window==="undefined")return;try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
  return{get,set};
}

export default function Page(){
  const w=useW();const mob=w<768;
  const st=storage();
  const[projects,setProjects]=useState(()=>st.get("secpla_projects")||INIT_PROJECTS);
  const[gmailFollows,setGmailFollows]=useState(()=>st.get("secpla_follows")||GMAIL_FOLLOWS_INIT);
  const[sel,setSel]=useState(null);const[tab,setTab]=useState("overview");const[view,setView]=useState("dash");
  const[msgs,setMsgs]=useState([{role:"assistant",content:"Hola Alexis 👋\n\nSoy tu Asistente SECPLA. Conozco tu cartera, seguimientos de Gmail, licitaciones y documentos.\n\nEjemplos:\n• ¿Qué seguimientos están críticos hoy?\n• ¿Cuándo vence el plazo de la sala de monitoreo?\n• Resumen ejecutivo para reunión con el Alcalde\n• ¿Qué proyectos financia el GORE?"}]);
  const[input,setInput]=useState("");const[loading,setLoading]=useState(false);
  const[showForm,setShowForm]=useState(false);const[form,setForm]=useState(EF);const[editId,setEditId]=useState(null);
  const[extracting,setExtracting]=useState(false);const[fetchingLicit,setFetchingLicit]=useState(null);
  const[renamingId,setRenamingId]=useState(null);const[renameVal,setRenameVal]=useState("");
  const[notesDraft,setNotesDraft]=useState("");const[genSum,setGenSum]=useState(false);
  const[newTask,setNewTask]=useState("");
  const[emailForm,setEmailForm]=useState({from:"",subject:"",date:"",body:""});const[addingEmail,setAddingEmail]=useState(false);
  const chatRef=useRef(null);const fileRef=useRef(null);

  useEffect(()=>{if(sel){const p=projects.find(x=>x.id===sel);if(p)setNotesDraft(p.notes||"");}},[sel]);

  const saveP=ps=>{setProjects(ps);st.set("secpla_projects",ps);};
  const saveF=fs=>{setGmailFollows(fs);st.set("secpla_follows",fs);};
  const proj=projects.find(p=>p.id===sel);

  const resolveFollow=(id,note="")=>{
    saveF(gmailFollows.map(f=>f.id===id?{...f,status:"resuelto",resolvedNote:note,resolvedAt:new Date().toISOString().slice(0,10)}:f));
  };

  const fetchLicitacion=async(p)=>{
    if(!p.licitId?.trim())return;
    setFetchingLicit(p.id);
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type:"licit",licitId:p.licitId})});
      const data=await res.json();
      let ld;try{ld=JSON.parse((data.text||"{}").replace(/```json|```/g,"").trim());}catch{ld={estado:"Desconocido",descripcion:"No se pudo extraer información."};}
      saveP(projects.map(x=>x.id===p.id?{...x,licitData:ld,licitChecked:new Date().toISOString().slice(0,10)}:x));
    }catch{console.error("Error licit");}
    setFetchingLicit(null);
  };

  const generateSummary=async()=>{
    if(!proj||!notesDraft.trim())return;setGenSum(true);
    const upd=projects.map(p=>p.id===proj.id?{...p,notes:notesDraft}:p);saveP(upd);
    try{
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type:"summary",project:{name:proj.name,financier:proj.financier,program:proj.program,budget:fCLP(proj.budget),stage:proj.stage,status:proj.status},notes:notesDraft})});
      const data=await res.json();
      saveP(upd.map(p=>p.id===proj.id?{...p,aiSummary:data.text||""}:p));
    }catch{}
    setGenSum(false);
  };

  const buildCtx=()=>projects.map(p=>{
    const ld=p.licitData;
    const pf=gmailFollows.filter(f=>f.projectId===p.id&&f.status==="pendiente");
    return `PROYECTO: ${p.name}\n- Presupuesto: ${fCLP(p.budget)} CLP\n- Financiamiento: ${p.financier} — ${p.program}\n- Etapa: ${p.stage} | Estado: ${p.status}\n- Vencimiento: ${fDate(p.deadline)}\n- Resumen: ${p.aiSummary||"—"}\n- Notas: ${p.notes||"—"}${p.licitId?`\n- Licitación MP (${p.licitId}): ${ld?`${ld.estado}, cierre ${fDate(ld.fechaCierre)}`:"Sin datos"}`:""}${pf.length?`\n- Seguimientos pendientes: ${pf.map(f=>`${f.subject} → ${f.to}`).join(" | ")}`:""}`;
  }).join("\n\n---\n\n");

  const send=async()=>{
    if(!input.trim()||loading)return;
    const um={role:"user",content:input.trim()};const nm=[...msgs,um];
    setMsgs(nm);setInput("");setLoading(true);
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),50);
    try{
      const follows=gmailFollows.filter(f=>f.status==="pendiente");
      const res=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({type:"chat",messages:nm,context:buildCtx(),follows:follows.map(f=>`[${f.urgency.toUpperCase()}] ${f.subject} → ${f.to} (${f.daysPending}d sin resp.)`).join("\n")})});
      const data=await res.json();
      setMsgs(m=>[...m,{role:"assistant",content:data.text||"Sin respuesta."}]);
    }catch{setMsgs(m=>[...m,{role:"assistant",content:"Error de conexión."}]);}
    setLoading(false);setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100);
  };

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

  const totalBudget=projects.reduce((a,p)=>a+(p.budget||0),0);
  const pendingFollows=gmailFollows.filter(f=>f.status==="pendiente");
  const criticalFollows=pendingFollows.filter(f=>f.urgency==="crítica");

  const inp={padding:"10px 12px",borderRadius:8,border:"1px solid #d1d5db",fontSize:14,width:"100%",boxSizing:"border-box",outline:"none",background:"white"};
  const btn=(bg,c="#fff",e={})=>({padding:"10px 16px",borderRadius:8,background:bg,color:c,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,...e});
  const lbl={fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:3};

  const LicitCard=({p})=>{
    const ld=p.licitData;const isFetching=fetchingLicit===p.id;
    if(!p.licitId)return null;
    return(
      <div style={{background:ld?"white":"#f8fafc",borderRadius:10,padding:14,border:`1px solid ${ld&&ld.estado!=="Desconocido"?(MPC[ld.estado]||"#e2e8f0")+"55":"#e2e8f0"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ld?10:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>🏛️</span>
            <div><div style={{fontSize:11,fontWeight:700,color:"#0f172a"}}>Mercado Público · {p.licitId}</div>{ld&&<div style={{fontSize:10,color:"#64748b",marginTop:1}}>{ld.nombre||"—"}</div>}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {ld&&<span style={{fontSize:10,padding:"3px 9px",borderRadius:8,background:(MPC[ld.estado]||"#94a3b8")+"18",color:MPC[ld.estado]||"#64748b",fontWeight:700}}>{ld.estado}</span>}
            <button onClick={()=>fetchLicitacion(p)} disabled={isFetching} style={{...btn(isFetching?"#94a3b8":"#0f172a"),fontSize:11,padding:"5px 10px",opacity:isFetching?0.6:1}}>
              {isFetching?"⏳":"🔄"}{mob?"":" Actualizar"}
            </button>
          </div>
        </div>
        {ld&&ld.estado!=="Desconocido"&&(
          <div>
            {ld.descripcion&&<p style={{fontSize:12,color:"#334155",lineHeight:1.5,margin:"0 0 10px",padding:"8px 10px",background:"#f8fafc",borderRadius:6}}>{ld.descripcion}</p>}
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(3,1fr)",gap:8}}>
              {[["Publicación",fDate(ld.fechaPublicacion),"📅"],["Cierre",fDate(ld.fechaCierre),"⏰"],["Adjudicación",fDate(ld.fechaAdjudicacion),"🏆"]].map(([l,v,ic])=>(
                <div key={l} style={{background:"#f1f5f9",borderRadius:7,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>{ic} {l}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#0f172a"}}>{v}</div>
                </div>
              ))}
            </div>
            {ld.url&&<a href={ld.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1d4ed8",marginTop:8,display:"block"}}>Ver en Mercado Público →</a>}
            {p.licitChecked&&<div style={{fontSize:10,color:"#94a3b8",marginTop:6}}>Última consulta: {fDate(p.licitChecked)}</div>}
          </div>
        )}
        {!ld&&!isFetching&&<div style={{fontSize:12,color:"#94a3b8",marginTop:8}}>Presiona "Actualizar" para consultar Mercado Público.</div>}
      </div>
    );
  };

  const header=(
    <div style={{background:"#0f172a",color:"white",padding:mob?"13px 16px":"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
        {mob&&view==="project"&&<button onClick={()=>{setView("dash");setSel(null);}} style={{background:"none",border:"none",color:"white",fontSize:22,cursor:"pointer",padding:0,lineHeight:1,flexShrink:0}}>←</button>}
        <div style={{flex:1,minWidth:0}}>
          {view==="project"&&proj?(
            renamingId===proj.id?(
              <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={e=>{if(e.key==="Enter")commitRename();if(e.key==="Escape")setRenamingId(null);}} style={{fontSize:mob?13:15,fontWeight:800,background:"transparent",border:"none",borderBottom:"2px solid #3b82f6",color:"white",outline:"none",width:"100%",padding:"2px 0"}}/>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}} onClick={()=>{setRenamingId(proj.id);setRenameVal(proj.name);}}>
                <div style={{fontSize:mob?13:15,fontWeight:800,letterSpacing:-0.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.name}</div>
                <span style={{fontSize:11,color:"#475569",flexShrink:0}}>✏️</span>
              </div>
            )
          ):(
            <div>
              <div style={{fontSize:mob?14:15,fontWeight:800,letterSpacing:-0.3}}>SECPLA Command</div>
              {criticalFollows.length>0&&<div style={{fontSize:10,color:"#fca5a5",marginTop:1}}>🔴 {criticalFollows.length} alerta crítica{criticalFollows.length>1?"s":""}</div>}
            </div>
          )}
          {view==="project"&&proj&&<div style={{fontSize:10,color:"#64748b",marginTop:1}}>{proj.financier} · {proj.stage} · {fCLP(proj.budget)}</div>}
          {view!=="project"&&!criticalFollows.length&&<div style={{fontSize:10,color:"#475569",marginTop:1}}>Municipalidad de Recoleta · Infraestructura de Seguridad</div>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
        {view==="project"&&proj&&(
          <><input ref={fileRef} type="file" accept=".pdf,image/*" onChange={uploadDoc} style={{display:"none"}}/>
          <button onClick={()=>fileRef.current?.click()} disabled={extracting} style={{...btn(extracting?"#334155":"#1e3a5f","#93c5fd"),fontSize:12,padding:"7px 12px"}}>
            {extracting?"⏳":"📎"}{mob?"":" Doc"}
          </button></>
        )}
        {!mob&&<button onClick={()=>setView(v=>v==="chat"?"dash":"chat")} style={{...btn(view==="chat"?"#1d4ed8":"#1e293b"),fontSize:12,padding:"7px 12px"}}>🤖 {view==="chat"?"Cerrar":"Asistente"}</button>}
      </div>
    </div>
  );

  const GmailPanel=()=>{
    const pending=pendingFollows;
    if(!pending.length)return null;
    const sorted=[...pending].sort((a,b)=>({crítica:0,alta:1,media:2}[a.urgency])-({crítica:0,alta:1,media:2}[b.urgency]));
    return(
      <div style={{marginTop:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:1}}>📬 Seguimientos Gmail — {pending.length} pendientes</div>
          <span style={{fontSize:10,color:"#94a3b8"}}>Solo lectura</span>
        </div>
        {sorted.map(f=>{
          const fp=projects.find(p=>p.id===f.projectId);
          return(
            <div key={f.id} style={{background:"white",borderRadius:10,padding:14,border:`1px solid ${UC[f.urgency]}33`,marginBottom:10,borderLeft:`4px solid ${UC[f.urgency]}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#0f172a",marginBottom:3}}>{UL[f.urgency]} {f.subject}</div>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>→ {f.to}</div>
                  {fp&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:"#f1f5f9",color:"#475569"}}>{fp.name}</span>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:UC[f.urgency]}}>{f.daysPending}d sin resp.</div>
                  <div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>{fDate(f.sentDate)}</div>
                </div>
              </div>
              <p style={{fontSize:11,color:"#475569",lineHeight:1.5,margin:"0 0 10px",padding:"6px 9px",background:"#f8fafc",borderRadius:5}}>{f.context}</p>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <a href={f.threadUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1d4ed8",padding:"5px 11px",borderRadius:6,background:"#eff6ff",textDecoration:"none",fontWeight:600}}>✉️ Abrir en Gmail</a>
                <button onClick={()=>resolveFollow(f.id)} style={{...btn("#dcfce7","#166534"),fontSize:11,padding:"5px 11px"}}>✅ Resuelto</button>
                <button onClick={()=>resolveFollow(f.id,"Descartado")} style={{...btn("#f1f5f9","#64748b"),fontSize:11,padding:"5px 11px"}}>✕ Descartar</button>
              </div>
            </div>
          );
        })}
        {gmailFollows.filter(f=>f.status==="resuelto").length>0&&(
          <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:4}}>
            {gmailFollows.filter(f=>f.status==="resuelto").length} resuelto(s) ·{" "}
            <span style={{cursor:"pointer",color:"#1d4ed8"}} onClick={()=>saveF(GMAIL_FOLLOWS_INIT)}>Restablecer todos</span>
          </div>
        )}
      </div>
    );
  };

  const dashContent=(
    <div style={{padding:mob?"14px 14px 90px":"24px"}}>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {[
          {l:"Inversión Total",v:fCLP(totalBudget),sub:"CLP",i:"💰",c:"#1d4ed8",bg:"#eff6ff"},
          {l:"En Ejecución",v:projects.filter(p=>p.status==="En curso"||p.status==="Con alerta").length,sub:`de ${projects.length}`,i:"🟢",c:"#059669",bg:"#f0fdf4"},
          {l:"Seguimientos Críticos",v:pendingFollows.length,sub:`${criticalFollows.length} crítico(s)`,i:"📬",c:"#dc2626",bg:"#fef2f2"},
          {l:"Tareas Pendientes",v:projects.flatMap(p=>p.tasks.filter(t=>t.status==="pending")).length,sub:"cartera total",i:"📋",c:"#d97706",bg:"#fffbeb"}
        ].map(({l,v,sub,i,c,bg})=>(
          <div key={l} style={{background:bg,borderRadius:10,padding:14,border:`1px solid ${c}22`}}>
            <div style={{fontSize:9,color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>{l}</div>
            <div style={{fontSize:mob?17:22,fontWeight:800,color:c,lineHeight:1}}>{i} {v}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>{sub}</div>
          </div>
        ))}
      </div>

      <GmailPanel/>

      <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:20}}>Cartera Completa</div>
      {projects.map(p=>(
        <div key={p.id} onClick={()=>{setSel(p.id);setTab("overview");setView("project");}} style={{background:"white",borderRadius:10,padding:14,border:"1px solid #e2e8f0",marginBottom:10,borderLeft:`4px solid ${SC[p.status]}`,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:"#0f172a",lineHeight:1.3,marginBottom:5}}>{p.name}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:SC[p.status]+"18",color:SC[p.status],fontWeight:700}}>{p.status}</span>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#f1f5f9",color:"#475569"}}>{p.stage}</span>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#e0f2fe",color:"#0369a1"}}>{p.financier}</span>
                {p.licitId&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#f5f3ff",color:"#7c3aed"}}>🏛️ MP</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:800,color:"#1d4ed8"}}>{fCLP(p.budget)}</div>
              <div style={{fontSize:9,color:"#94a3b8"}}>CLP</div>
            </div>
          </div>
          {p.aiSummary&&<p style={{fontSize:11,color:"#475569",lineHeight:1.5,margin:"0 0 8px",fontStyle:"italic",borderLeft:"2px solid #bfdbfe",paddingLeft:8}}>{p.aiSummary.slice(0,110)}…</p>}
          <div style={{display:"flex",gap:12,fontSize:10,color:"#94a3b8",borderTop:"1px solid #f8fafc",paddingTop:8}}>
            <span>📄 {p.docs.length}</span><span>✉️ {p.emails.length}</span>
            <span>✅ {p.tasks.filter(t=>t.status==="pending").length} pend.</span>
            {gmailFollows.filter(f=>f.projectId===p.id&&f.status==="pendiente").length>0&&<span style={{color:"#dc2626"}}>📬 {gmailFollows.filter(f=>f.projectId===p.id&&f.status==="pendiente").length} seguimiento(s)</span>}
          </div>
        </div>
      ))}
      <button onClick={()=>{setForm(EF);setEditId(null);setShowForm(true);}} style={{...btn("#0f172a"),width:"100%",marginTop:4,padding:12,fontSize:13}}>+ Nuevo Proyecto</button>
    </div>
  );

  const TABS=[["overview","📋 Resumen"],["licitacion","🏛️ Licitación"],["notes","📝 Notas"],["docs","📄 Docs"],["tasks","✅ Tareas"],["emails","✉️ Correos"]];

  const projDetail=proj&&(
    <div style={{paddingBottom:mob?90:0}}>
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"10px 14px",display:"flex",gap:5,overflowX:"auto"}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"7px 12px",borderRadius:7,border:"none",background:tab===k?"#1d4ed8":"#f1f5f9",color:tab===k?"white":"#64748b",cursor:"pointer",fontSize:12,fontWeight:tab===k?700:500,whiteSpace:"nowrap",flexShrink:0}}>
            {l}{k==="docs"?<span style={{marginLeft:3,fontSize:10,background:tab===k?"#3b82f6":"#e2e8f0",color:tab===k?"white":"#64748b",borderRadius:8,padding:"1px 5px"}}>{proj.docs.length}</span>:k==="tasks"?<span style={{marginLeft:3,fontSize:10,background:tab===k?"#3b82f6":"#e2e8f0",color:tab===k?"white":"#64748b",borderRadius:8,padding:"1px 5px"}}>{proj.tasks.filter(t=>t.status==="pending").length}</span>:k==="emails"?<span style={{marginLeft:3,fontSize:10,background:tab===k?"#3b82f6":"#e2e8f0",color:tab===k?"white":"#64748b",borderRadius:8,padding:"1px 5px"}}>{proj.emails.length}</span>:null}
          </button>
        ))}
      </div>
      <div style={{padding:mob?14:24}}>
        {tab==="overview"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Ficha del Proyecto</div>
              {[["Estado",<span key="s" style={{padding:"3px 10px",borderRadius:8,background:SC[proj.status]+"18",color:SC[proj.status],fontWeight:700,fontSize:11}}>{proj.status}</span>],["Etapa",proj.stage],["Presupuesto",`${fCLP(proj.budget)} CLP`],["Fuente",proj.financier||"—"],["Programa",proj.program||"—"],["Vencimiento",fDate(proj.deadline)]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f8fafc",gap:8}}>
                  <span style={{fontSize:12,color:"#64748b",flexShrink:0}}>{k}</span>
                  <span style={{fontSize:12,fontWeight:600,color:"#0f172a",textAlign:"right"}}>{v}</span>
                </div>
              ))}
              <button onClick={()=>{setForm({...proj,budget:proj.budget||""});setEditId(proj.id);setShowForm(true);}} style={{...btn("#f1f5f9","#374151"),width:"100%",marginTop:12,fontSize:12}}>✏️ Editar Proyecto</button>
            </div>
            {proj.aiSummary&&<div style={{background:"#eff6ff",borderRadius:10,padding:16,border:"1px solid #bfdbfe"}}><div style={{fontSize:9,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>✨ Resumen IA</div><p style={{fontSize:13,color:"#1e3a5f",lineHeight:1.7,margin:0}}>{proj.aiSummary}</p></div>}
            {proj.licitId&&<LicitCard p={proj}/>}
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}><div style={{fontSize:9,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Descripción Técnica</div><p style={{fontSize:13,color:"#334155",lineHeight:1.7,margin:0}}>{proj.desc}</p></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[{l:"Docs",v:proj.docs.length,i:"📄",c:"#0284c7"},{l:"Correos",v:proj.emails.length,i:"✉️",c:"#7c3aed"},{l:"Pendientes",v:proj.tasks.filter(t=>t.status==="pending").length,i:"✅",c:"#059669"}].map(({l,v,i,c})=>(
                <div key={l} style={{background:"white",borderRadius:10,padding:"14px 10px",border:"1px solid #e2e8f0",textAlign:"center"}}>
                  <div style={{fontSize:20}}>{i}</div><div style={{fontSize:22,fontWeight:800,color:c,lineHeight:1.2}}>{v}</div><div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab==="licitacion"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>ID Licitación — Mercado Público</div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Ingresa el código (ej: 1057-21-LE24). El sistema consultará y extraerá fechas y estado.</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={proj.licitId||""} onChange={e=>saveP(projects.map(p=>p.id===proj.id?{...p,licitId:e.target.value}:p))} placeholder="Ej: 1431841-10-B226" style={{...inp,flex:1,fontFamily:"monospace",fontWeight:600}}/>
                <button onClick={()=>fetchLicitacion(proj)} disabled={!proj.licitId||fetchingLicit===proj.id} style={{...btn(!proj.licitId||fetchingLicit===proj.id?"#94a3b8":"#7c3aed"),padding:"10px 14px",opacity:!proj.licitId?0.5:1}}>
                  {fetchingLicit===proj.id?"⏳":"🔍"}{mob?"":" Consultar"}
                </button>
              </div>
            </div>
            {proj.licitId&&<LicitCard p={proj}/>}
          </div>
        )}
        {tab==="notes"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Notas de Gestión</div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Escribe libremente. La IA generará un resumen ejecutivo estructurado.</div>
              <textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} onBlur={()=>saveP(projects.map(p=>p.id===proj.id?{...p,notes:notesDraft}:p))} rows={8} placeholder="Ej: Reunión con GORE el 10 abril. Pendiente firma resolución..." style={{...inp,resize:"vertical",fontSize:13,lineHeight:1.6}}/>
              <button onClick={generateSummary} disabled={genSum||!notesDraft.trim()} style={{...btn(genSum||!notesDraft.trim()?"#94a3b8":"#1d4ed8"),width:"100%",marginTop:10,padding:12,opacity:genSum||!notesDraft.trim()?0.6:1}}>
                {genSum?"✨ Generando…":"✨ Generar Resumen Ejecutivo con IA"}
              </button>
            </div>
            {proj.aiSummary&&<div style={{background:"#eff6ff",borderRadius:10,padding:16,border:"1px solid #bfdbfe"}}><div style={{fontSize:9,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>✨ Último Resumen</div><p style={{fontSize:13,color:"#1e3a5f",lineHeight:1.7,margin:0}}>{proj.aiSummary}</p><button onClick={generateSummary} disabled={genSum} style={{...btn("#e0f2fe","#0369a1"),marginTop:12,fontSize:11,padding:"6px 12px"}}>🔄 Actualizar</button></div>}
          </div>
        )}
        {tab==="docs"&&(
          <div>
            <button onClick={()=>fileRef.current?.click()} disabled={extracting} style={{...btn(extracting?"#94a3b8":"#0284c7"),width:"100%",marginBottom:14,padding:12}}>
              {extracting?"⏳ Procesando con IA…":"📎 Subir Documento (PDF / Imagen)"}
            </button>
            {proj.docs.length===0&&!extracting&&<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",color:"#94a3b8",border:"2px dashed #e2e8f0"}}><div style={{fontSize:40,marginBottom:10}}>📄</div><div>Sin documentos. Sube convenios, contratos, bases técnicas…</div></div>}
            {proj.docs.map(d=>{let ex={};try{ex=JSON.parse(d.extracted);}catch{}return(
              <div key={d.id} style={{background:"white",borderRadius:10,padding:14,border:"1px solid #e2e8f0",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div><div style={{fontWeight:700,fontSize:13}}> 📄 {d.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{d.docType} · {fDate(d.uploadedAt)}</div></div>
                  <button onClick={()=>delDoc(d.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:18,padding:0}}>✕</button>
                </div>
                {d.summary&&<p style={{fontSize:12,color:"#334155",lineHeight:1.6,background:"#f8fafc",padding:"8px 10px",borderRadius:6,margin:"0 0 8px"}}>{d.summary}</p>}
                {ex.dates?.length>0&&<div style={{marginBottom:6}}>{ex.dates.map((dt,i)=><div key={i} style={{fontSize:11,color:"#334155"}}>📅 {typeof dt==="object"?`${dt.date} — ${dt.description}`:dt}</div>)}</div>}
                {ex.obligations?.length>0&&<div style={{marginBottom:6}}>{ex.obligations.map((o,i)=><div key={i} style={{fontSize:11,color:"#334155"}}>▸ {o}</div>)}</div>}
                {ex.tasks?.length>0&&<div>{ex.tasks.map((t,i)=><div key={i} style={{fontSize:11,color:"#334155"}}>✔ {t}</div>)}</div>}
              </div>
            );})}
          </div>
        )}
        {tab==="tasks"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Nueva tarea…" style={{...inp,flex:1}}/>
              <button onClick={addTask} style={{...btn("#1d4ed8"),padding:"10px 14px"}}>+</button>
            </div>
            {proj.tasks.length===0&&<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",color:"#94a3b8",border:"2px dashed #e2e8f0"}}>Sin tareas.</div>}
            {["pending","done"].map(st=>{const ts=proj.tasks.filter(t=>t.status===st);if(!ts.length)return null;return(
              <div key={st} style={{marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>{st==="pending"?"Pendientes":"Completadas"}</div>
                {ts.map(t=>(
                  <div key={t.id} style={{background:"white",borderRadius:8,padding:"11px 14px",border:"1px solid #e2e8f0",marginBottom:6,display:"flex",alignItems:"center",gap:10,opacity:st==="done"?0.55:1}}>
                    <input type="checkbox" checked={st==="done"} onChange={()=>toggleTask(t.id)} style={{cursor:"pointer",width:18,height:18,accentColor:"#1d4ed8",flexShrink:0}}/>
                    <span style={{fontSize:13,flex:1,textDecoration:st==="done"?"line-through":"none",color:st==="done"?"#94a3b8":"#1e293b"}}>{t.text}</span>
                    <button onClick={()=>delTask(t.id)} style={{background:"none",border:"none",color:"#e2e8f0",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            );})}
          </div>
        )}
        {tab==="emails"&&(
          <div>
            <button onClick={()=>setAddingEmail(true)} style={{...btn("#1d4ed8"),width:"100%",marginBottom:14,padding:12}}>+ Registrar Correo</button>
            {addingEmail&&(
              <div style={{background:"white",borderRadius:10,padding:16,border:"1px solid #bfdbfe",marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><label style={lbl}>Remitente</label><input value={emailForm.from} onChange={e=>setEmailForm(f=>({...f,from:e.target.value}))} style={inp} placeholder="nombre@dominio.cl"/></div>
                  <div><label style={lbl}>Fecha</label><input type="date" value={emailForm.date} onChange={e=>setEmailForm(f=>({...f,date:e.target.value}))} style={inp}/></div>
                </div>
                <div style={{marginBottom:10}}><label style={lbl}>Asunto</label><input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))} style={inp}/></div>
                <div style={{marginBottom:12}}><label style={lbl}>Contenido</label><textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))} rows={4} style={{...inp,resize:"vertical"}}/></div>
                <div style={{display:"flex",gap:8}}><button onClick={saveEmail} style={btn("#1d4ed8")}>Guardar</button><button onClick={()=>setAddingEmail(false)} style={btn("#f1f5f9","#374151")}>Cancelar</button></div>
              </div>
            )}
            {proj.emails.length===0&&!addingEmail&&<div style={{background:"white",borderRadius:10,padding:40,textAlign:"center",color:"#94a3b8",border:"2px dashed #e2e8f0"}}><div style={{fontSize:36,marginBottom:8}}>✉️</div>Sin correos.</div>}
            {proj.emails.map(e=>(
              <div key={e.id} style={{background:"white",borderRadius:10,padding:14,border:"1px solid #e2e8f0",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><div style={{fontWeight:700,fontSize:13}}>✉️ {e.subject}</div><div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>De: {e.from} · {fDate(e.date)}</div></div>
                  <button onClick={()=>delEmail(e.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
                </div>
                {e.body&&<p style={{fontSize:12,color:"#334155",marginTop:8,lineHeight:1.6,borderTop:"1px solid #f8fafc",paddingTop:8}}>{e.body}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const chatPanel=(
    <div style={{display:"flex",flexDirection:"column",height:mob?"calc(100vh - 58px - 58px)":"100%",background:"white"}}>
      <div style={{padding:"8px 12px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",flexShrink:0}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {["¿Qué seguimientos están críticos?","Resumen para Alcalde","¿Cuándo cierra la licitación?","Estado de cotizaciones SNSM2025"].map(q=>(
            <button key={q} onClick={()=>setInput(q)} style={{fontSize:10,padding:"4px 9px",borderRadius:12,background:"white",border:"1px solid #e2e8f0",cursor:"pointer",color:"#475569"}}>{q}</button>
          ))}
        </div>
      </div>
      <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"86%",padding:"9px 12px",borderRadius:12,background:m.role==="user"?"#1d4ed8":"#f1f5f9",color:m.role==="user"?"white":"#1e293b",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",borderBottomRightRadius:m.role==="user"?2:12,borderBottomLeftRadius:m.role==="user"?12:2}}>{m.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex"}}><div style={{padding:"9px 12px",borderRadius:12,background:"#f1f5f9",fontSize:12,color:"#94a3b8"}}>Consultando cartera…</div></div>}
      </div>
      <div style={{padding:"10px 12px",borderTop:"1px solid #e2e8f0",display:"flex",gap:8,flexShrink:0,paddingBottom:mob?"calc(10px + env(safe-area-inset-bottom))":"10px"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Pregunta sobre tus proyectos…" style={{...inp,flex:1,fontSize:13}}/>
        <button onClick={send} disabled={loading} style={{...btn("#1d4ed8"),padding:"10px 14px",fontSize:16,opacity:loading?0.5:1,flexShrink:0}}>→</button>
      </div>
    </div>
  );

  const modal=showForm&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",zIndex:300}}>
      <div style={{background:"white",borderRadius:mob?"16px 16px 0 0":"12px",padding:20,width:mob?"100%":"520px",maxHeight:"92vh",overflowY:"auto",boxSizing:"border-box"}}>
        <div style={{fontWeight:700,fontSize:15,color:"#0f172a",marginBottom:18}}>{editId?"Editar Proyecto":"Nuevo Proyecto"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo del proyecto"/></div>
          <div><label style={lbl}>Presupuesto (CLP)</label><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={inp} placeholder="Ej: 914000000"/></div>
          {form.budget&&Number(form.budget)>0&&<div style={{fontSize:12,color:"#1d4ed8",fontWeight:600,padding:"4px 10px",background:"#eff6ff",borderRadius:6}}>→ {fCLP(Number(form.budget))} CLP</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={lbl}>Financiamiento</label><select value={form.financier} onChange={e=>setForm(f=>({...f,financier:e.target.value}))} style={inp}>{FINANCIERS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={lbl}>Vencimiento</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={inp}/></div>
          </div>
          <div><label style={lbl}>Programa / Fondo</label><input value={form.program||""} onChange={e=>setForm(f=>({...f,program:e.target.value}))} style={inp} placeholder="Ej: FNSP"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={lbl}>Etapa</label><select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={inp}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={lbl}>Estado</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inp}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label style={lbl}>ID Licitación MP (opcional)</label><input value={form.licitId||""} onChange={e=>setForm(f=>({...f,licitId:e.target.value}))} style={{...inp,fontFamily:"monospace"}} placeholder="Ej: 1431841-10-B226"/></div>
          <div><label style={lbl}>Descripción Técnica</label><textarea value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} rows={3} style={{...inp,resize:"vertical"}}/></div>
        </div>
        <div style={{display:"flex",gap:8}}>
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

  const mobileNav=mob&&(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #e2e8f0",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {[["dash","📊","Dashboard"],["projects","📁","Proyectos"],["chat","🤖","Asistente"]].map(([v,icon,label])=>(
        <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"12px 4px 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:20}}>{icon}</span>
          <span style={{fontSize:10,fontWeight:view===v?700:400,color:view===v?"#1d4ed8":"#94a3b8"}}>{label}</span>
          {view===v&&<div style={{width:20,height:2,background:"#1d4ed8",borderRadius:2,marginTop:1}}/>}
        </button>
      ))}
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#f1f5f9",overflow:"hidden"}}>
      {header}
      <div style={{flex:1,overflow:"hidden",display:"flex"}}>
        {mob?(
          <div style={{flex:1,overflowY:"auto"}}>
            {view==="dash"&&dashContent}
            {view==="projects"&&(
              <div style={{padding:"14px 14px 90px"}}>
                {projects.map(p=>(
                  <div key={p.id} onClick={()=>{setSel(p.id);setTab("overview");setView("project");}} style={{background:"white",borderRadius:10,padding:14,border:"1px solid #e2e8f0",marginBottom:10,borderLeft:`4px solid ${SC[p.status]}`,cursor:"pointer"}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:6}}>{p.name}</div>
                    <div style={{display:"flex",gap:5,justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:5}}>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:SC[p.status]+"18",color:SC[p.status],fontWeight:700}}>{p.status}</span>
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#e0f2fe",color:"#0369a1"}}>{p.financier}</span>
                      </div>
                      <span style={{fontSize:13,fontWeight:800,color:"#1d4ed8"}}>{fCLP(p.budget)}</span>
                    </div>
                  </div>
                ))}
                <button onClick={()=>{setForm(EF);setEditId(null);setShowForm(true);}} style={{...btn("#0f172a"),width:"100%",padding:12}}>+ Nuevo Proyecto</button>
              </div>
            )}
            {view==="project"&&proj&&projDetail}
            {view==="chat"&&chatPanel}
          </div>
        ):(
          <>
            <div style={{width:256,background:"#0f172a",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"10px 8px"}}>
                <button onClick={()=>{setSel(null);setView("dash");}} style={{width:"100%",padding:"9px 12px",borderRadius:7,background:view==="dash"?"#1e3a5f":"transparent",color:view==="dash"?"#93c5fd":"#64748b",border:"none",cursor:"pointer",textAlign:"left",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>📊 Dashboard General</button>
              </div>
              {pendingFollows.length>0&&(
                <div style={{margin:"0 8px 4px",padding:"8px 10px",background:"#7f1d1d22",borderRadius:7,border:"1px solid #ef444433"}}>
                  <div style={{fontSize:9,color:"#fca5a5",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>📬 Seguimientos</div>
                  {criticalFollows.length>0&&<div style={{fontSize:10,color:"#ef4444",fontWeight:600}}>🔴 {criticalFollows.length} crítico(s)</div>}
                  <div style={{fontSize:10,color:"#94a3b8"}}>{pendingFollows.length} pendiente(s) total</div>
                </div>
              )}
              <div style={{padding:"0 8px",flex:1}}>
                <div style={{fontSize:9,color:"#334155",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"8px 10px 6px"}}>Proyectos</div>
                {projects.map(p=>(
                  <button key={p.id} onClick={()=>{setSel(p.id);setTab("overview");setView("project");}} style={{width:"100%",padding:"10px 12px",borderRadius:7,background:sel===p.id?"#1e3a5f":"transparent",border:sel===p.id?"1px solid #1d4ed8":"1px solid transparent",cursor:"pointer",textAlign:"left",marginBottom:3}}>
                    <div style={{fontSize:11,fontWeight:sel===p.id?700:500,color:sel===p.id?"#e2e8f0":"#94a3b8",lineHeight:1.3,marginBottom:4}}>{p.name}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:SC[p.status]+"25",color:SC[p.status],fontWeight:700}}>{p.status}</span>
                      <span style={{fontSize:9,padding:"2px 5px",borderRadius:8,background:"#1e293b",color:"#64748b"}}>{p.financier}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{padding:"10px 8px"}}><button onClick={()=>{setForm(EF);setEditId(null);setShowForm(true);}} style={{...btn("#1d4ed8"),width:"100%",fontSize:12}}>+ Nuevo Proyecto</button></div>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {(view==="dash"||(!proj&&view!=="chat"))&&dashContent}
              {view==="project"&&proj&&projDetail}
            </div>
            {view==="chat"&&(
              <div style={{width:370,borderLeft:"1px solid #e2e8f0",display:"flex",flexDirection:"column",flexShrink:0}}>
                <div style={{padding:"12px 16px",background:"#0f172a",color:"white",flexShrink:0}}>
                  <div style={{fontWeight:700,fontSize:12}}>🤖 Asistente SECPLA</div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:1}}>Cartera · Gmail · Licitaciones · Docs</div>
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
