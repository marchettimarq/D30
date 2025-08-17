
const KEY="discipline30_v7";
const DEFAULT_TEMPLATE_ANCHORS=[
  {name:"Workout #1 (≥30 min)",key:"w1",optional:false},
  {name:"Workout #2 (≥30 min, preferably outdoors)",key:"w2",optional:false},
  {name:"10K Steps",key:"steps",optional:false},
  {name:"Drink 3L water",key:"water",optional:false},
  {name:"Log Food",key:"logfood",optional:false},
  {name:"Read 20+ minutes",key:"read",optional:false},
  {name:"Complete Writing Task",key:"write",optional:false},
  {name:"List one positive thing",key:"positive",optional:false},
  {name:"PCS/Admin Task (Mon–Fri, optional)",key:"pcs",optional:true,onlyWeekdays:true}
];
const DEFAULT_WEEKLY_PLAN={
  "Mon":["Run / Run-Walk","Yoga / Mobility (15–20m)"],
  "Tue":["Strength (20–30m)"],
  "Wed":["Run / Run-Walk"],
  "Thu":["Yoga / Mobility (15–20m)"],
  "Fri":["Speed/Tempo Run","Strength (20–30m)"],
  "Sat":["Long Walk","Writing Session (optional)","Spring Clean Task (optional)"],
  "Sun":["Long Run","Meal Prep","Writing Session (optional)","Spring Clean Task (optional)"]
};

function newState(){
  return {
    settings:{
      palette:"soft",
      programDaysTotal:180, phaseLength:30, startDate:null,
      weeklyPlan: JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN)),
      anchors: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_ANCHORS)),
      configured:false, phasesChosen:6, usedTemplate:true
    },
    logs:{}
  };
}
let STATE = JSON.parse(localStorage.getItem(KEY) || "null") || newState();
function save(){ localStorage.setItem(KEY, JSON.stringify(STATE)); }
function dateKey(d){ return d.toISOString().slice(0,10); }
function dayNumber(startISO,today){ const start=new Date(startISO+"T00:00:00"); return Math.max(1, Math.floor((today-start)/(1000*60*60*24))+1); }
function phaseOfDay(n,len){ return Math.ceil(n/len); }

// ---------------- THEME ----------------
function applyPalette(name){
  const root=document.documentElement.style;
  if(name==="dark"){
    root.setProperty('--bg','var(--bg-dark)');
    root.setProperty('--card','var(--card-dark)');
    root.setProperty('--ink','var(--ink-dark)');
    root.setProperty('--muted','var(--muted-dark)');
    root.setProperty('--line','var(--line-dark)');
    root.setProperty('--accent','var(--accent-dark)');
  }else if(name==="mid"){
    root.setProperty('--bg','var(--bg-mid)');
    root.setProperty('--card','var(--card-mid)');
    root.setProperty('--ink','var(--ink-mid)');
    root.setProperty('--muted','var(--muted-mid)');
    root.setProperty('--line','var(--line-mid)');
    root.setProperty('--accent','var(--accent-mid)');
  }else{
    root.setProperty('--bg','#f9f9f7');
    root.setProperty('--card','#ffffff');
    root.setProperty('--ink','#222529');
    root.setProperty('--muted','#6f7782');
    root.setProperty('--line','#e6e6e6');
    root.setProperty('--accent','#58bfa0');
  }
}
applyPalette(STATE.settings.palette);

// ---------------- HELPERS ----------------
function todaysAnchors(date){
  const dow=date.getDay();
  const list=[];
  for(const a of STATE.settings.anchors){
    if(a.onlySunday && dow!==0) continue;
    if(a.onlyWeekdays && (dow===0||dow===6)) continue;
    list.push(a);
  }
  return list;
}

// ---------------- RENDER ----------------
function renderPhaseDashboard(dayNum){
  const pills=document.getElementById("phasePills"); if(!pills) return;
  pills.innerHTML="";
  const total=STATE.settings.programDaysTotal;
  const len=STATE.settings.phaseLength;
  const currentPhase=Math.ceil(dayNum/len);
  for(let i=1;i<=total/len;i++){
    const span=document.createElement("div");
    span.className="phase-pill"+(i===currentPhase?" active":"");
    span.textContent=`P${i}`;
    pills.appendChild(span);
  }
}

function renderAll(){
  const start = STATE.settings.startDate;
  if(!start){ ensureOnboarding(); return; }

  const today=new Date();
  const s=STATE.settings, logs=STATE.logs;
  const dayNum=dayNumber(start,today);
  const phaseNum=phaseOfDay(dayNum,s.phaseLength);
  document.getElementById("dayInfo").textContent=`Phase ${phaseNum} · Day ${((dayNum-1)%s.phaseLength)+1} / ${s.phaseLength}`;
  document.getElementById("dowBadge").textContent=today.toLocaleDateString(undefined,{weekday:'long'});
  document.getElementById("progressBar").style.width=`${(((dayNum-1)%s.phaseLength)+1)/s.phaseLength*100}%`;
  renderPhaseDashboard(dayNum);

  // anchors
  const key=dateKey(today);
  const rec = logs[key] || (logs[key]={anchors:{},plan:{},note:"",completed:false});
  const list = todaysAnchors(today);
  const box = document.getElementById("dailyList"); box.innerHTML="";
  list.forEach((a)=>{
    const id=`a_${a.key}`;
    const li=document.createElement("div"); li.className="card"+(rec.anchors[id]?" done":"")+(a.optional?" optional":"");
    const cb=document.createElement("div"); cb.className="checkbox";
    cb.innerHTML = `<svg viewBox="0 0 24 24"><circle class="circ" cx="12" cy="12" r="9"></circle><path class="tick" d="M7 12.5l3 3.5 7-8"></path></svg>`;
    cb.addEventListener("click",(e)=>{ e.stopPropagation(); rec.anchors[id]=!rec.anchors[id]; save(); renderAll(); });
    const title=document.createElement("div"); title.className="title"; title.textContent=a.name;
    const hint=document.createElement("div"); hint.className="hint"; hint.textContent=a.optional?"Optional":"Required";
    li.appendChild(cb); li.appendChild(title); li.appendChild(hint);
    li.addEventListener("click",()=>{ rec.anchors[id]=!rec.anchors[id]; save(); renderAll(); });
    if(rec.anchors[id]) li.classList.add("done"); else li.classList.remove("done");
    box.appendChild(li);
  });

  // plan
  const planBox=document.getElementById("planList"); planBox.innerHTML="";
  const dowLong=today.toLocaleDateString(undefined,{weekday:'long'});
  const dowShort=today.toLocaleDateString(undefined,{weekday:'short'});
  const plan = (s.weeklyPlan[dowShort] || s.weeklyPlan[dowLong]) || [];
  plan.forEach((name, idx)=>{
    const id=`p_${idx}`;
    const li=document.createElement("div"); li.className="card"+(rec.plan&&rec.plan[id]?" done":"");
    const cb=document.createElement("div"); cb.className="checkbox";
    cb.innerHTML = `<svg viewBox="0 0 24 24"><circle class="circ" cx="12" cy="12" r="9"></circle><path class="tick" d="M7 12.5l3 3.5 7-8"></path></svg>`;
    cb.addEventListener("click",(e)=>{ e.stopPropagation(); rec.plan = rec.plan||{}; rec.plan[id]=!rec.plan[id]; save(); renderAll(); });
    const title=document.createElement("div"); title.className="title"; title.textContent=name;
    const hint=document.createElement("div"); hint.className="hint"; hint.textContent="Tap to toggle";
    li.appendChild(cb); li.appendChild(title); li.appendChild(hint);
    li.addEventListener("click",()=>{ rec.plan = rec.plan||{}; rec.plan[id]=!rec.plan[id]; save(); renderAll(); });
    if(rec.plan&&rec.plan[id]) li.classList.add("done"); else li.classList.remove("done");
    planBox.appendChild(li);
  });

  // note
  const note=document.getElementById("noteBox");
  note.value=rec.note||"";
  note.oninput=()=>{ rec.note = note.value; save(); };

  // calendar
  buildCurrentMonthCalendar();
}

function buildCurrentMonthCalendar(){
  const grid=document.getElementById("calendarGrid"); grid.innerHTML="";
  const s=STATE.settings, logs=STATE.logs;
  const now=new Date();
  const first=new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  document.getElementById("calTitle").textContent = now.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  // headers
  const weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  weekdays.forEach(w=>{ const h=document.createElement("div"); h.className="cal-head"; h.textContent=w; grid.appendChild(h); });
  // blanks
  const weekday = (first.getDay()+6)%7; // Monday=0
  for(let i=0;i<weekday;i++){ const b=document.createElement("div"); b.className="cal-cell"; b.style.visibility="hidden"; grid.appendChild(b); }
  // days
  const todayKey = dateKey(new Date());
  for(let d=1; d<=lastDay; d++){
    const dateObj = new Date(now.getFullYear(), now.getMonth(), d);
    const key = dateKey(dateObj);
    const rec=logs[key];
    const cell=document.createElement("div"); cell.className="cal-cell";
    if(key===todayKey) cell.classList.add("today");
    if(dateObj < new Date(todayKey)){ cell.classList.add("past"); }
    if(rec){
      if(rec.completed){ cell.classList.add("done"); cell.textContent=d+" ✓"; }
      else { cell.classList.add("past"); cell.classList.add("missed"); cell.textContent=d+" ×"; }
    } else {
      cell.textContent = d.toString();
    }
    cell.addEventListener("click",()=>openPastDay(key));
    grid.appendChild(cell);
  }
}

// -------------- Finish Flow --------------
function requiredComplete(date){
  const list=todaysAnchors(date);
  const rec=STATE.logs[dateKey(date)] || {anchors:{}};
  for(const a of list){ if(a.optional) continue; if(!rec.anchors[`a_${a.key}`]) return false; }
  return true;
}
function highlightMissed(){
  const today=new Date();
  const list=todaysAnchors(today);
  const rec=STATE.logs[dateKey(today)] || {anchors:{}};
  const cards=[...document.getElementById("dailyList").children];
  cards.forEach((card, idx)=>{
    const a=list[idx]; const id=`a_${a.key}`;
    card.classList.remove("warn");
    if(!a.optional && !rec.anchors[id]) card.classList.add("warn");
  });
}
function finishDay(){
  const today=new Date();
  if(!requiredComplete(today)){ highlightMissed(); openConfirm(); return; }
  buildTodayRecap(); openRecap();
}
function buildTodayRecap(){
  const today=new Date(); const list=todaysAnchors(today);
  const rec=STATE.logs[dateKey(today)] || (STATE.logs[dateKey(today)]={anchors:{},plan:{},note:"",completed:false});
  const container=document.getElementById("recapList"); container.innerHTML="";
  list.forEach(a=>{
    const ok=!!rec.anchors[`a_${a.key}`];
    const row=document.createElement("div"); row.textContent=`${ok?"✓":"○"}  ${a.name}${a.optional?" (optional)":""}`; container.appendChild(row);
  });
  document.getElementById("recapPositive").value = rec.note||"";
}
function saveRecapAndComplete(){
  const today=new Date();
  const rec=STATE.logs[dateKey(today)] || (STATE.logs[dateKey(today)]={anchors:{},plan:{},note:"",completed:false});
  rec.note = document.getElementById("recapPositive").value || rec.note || "";
  rec.completed=true; save(); closeRecap(); renderAll();
}

// -------------- Calendar day open --------------
function openPastDay(key){
  const dateObj=new Date(key);
  const rec = STATE.logs[key] || (STATE.logs[key]={anchors:{},plan:{},note:"",completed:false});
  const container=document.getElementById("recapList"); container.innerHTML="";
  const list = todaysAnchors(dateObj);
  list.forEach(a=>{
    const ok = !!rec.anchors[`a_${a.key}`];
    const row=document.createElement("div");
    row.textContent = `${ok?"✓":"○"}  ${a.name}${a.optional?" (optional)":""}`;
    row.addEventListener("click",()=>{ rec.anchors[`a_${a.key}`]=!ok; save(); openPastDay(key); });
    container.appendChild(row);
  });
  const pos=document.getElementById("recapPositive"); pos.value = rec.note||"";
  document.getElementById("btnRecapSave").onclick = ()=>{
    rec.note = pos.value||rec.note||""; rec.completed = true; save(); closeRecap(); renderAll();
  };
  openRecap();
}

// -------------- Modals --------------
function openConfirm(){ document.getElementById("confirmModal").style.display="flex"; document.body.classList.add("no-scroll"); }
function closeConfirm(){ document.getElementById("confirmModal").style.display="none"; document.body.classList.remove("no-scroll"); }
function openRecap(){ document.getElementById("recapModal").style.display="flex"; document.body.classList.add("no-scroll"); }
function closeRecap(){ document.getElementById("recapModal").style.display="none"; document.body.classList.remove("no-scroll"); }

// -------------- Settings (existing) --------------
function openSettings(){
  document.body.classList.add("no-scroll");
  document.getElementById("settingsModal").style.display="flex";
  const s=STATE.settings;
  const host=document.getElementById("settingsAnchors"); host.innerHTML="";
  s.anchors.forEach((a,idx)=>{
    const row=document.createElement("div"); row.className="settings-row";
    const nameInput=document.createElement("input"); nameInput.type="text"; nameInput.value=a.name;
    const toggle=document.createElement("button"); toggle.textContent=a.optional?"Optional":"Required"; toggle.className="icon-btn";
    toggle.addEventListener("click",()=>{ a.optional=!a.optional; toggle.textContent=a.optional?"Optional":"Required"; });
    const del=document.createElement("button"); del.textContent="Delete"; del.className="delete-btn";
    del.addEventListener("click",()=>{ s.anchors.splice(idx,1); save(); openSettings(); });
    row.appendChild(nameInput); row.appendChild(toggle); row.appendChild(del);
    nameInput.addEventListener("input",()=>{ a.name = nameInput.value; });
    host.appendChild(row);
  });
  const set=(id,day)=>document.getElementById(id).value = s.weeklyPlan[day].join(", ");
  set("planMon","Mon"); set("planTue","Tue"); set("planWed","Wed"); set("planThu","Thu"); set("planFri","Fri"); set("planSat","Sat"); set("planSun","Sun");
}
function saveSettings(){
  const s=STATE.settings;
  const read=(id)=>document.getElementById(id).value.split(",").map(x=>x.trim()).filter(Boolean);
  s.weeklyPlan["Mon"]=read("planMon"); s.weeklyPlan["Tue"]=read("planTue"); s.weeklyPlan["Wed"]=read("planWed");
  s.weeklyPlan["Thu"]=read("planThu"); s.weeklyPlan["Fri"]=read("planFri"); s.weeklyPlan["Sat"]=read("planSat"); s.weeklyPlan["Sun"]=read("planSun");
  save(); closeSettings(); renderAll();
}
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; document.body.classList.remove("no-scroll"); }
function toggleNewTaskMode(){ const btn=document.getElementById("newTaskRequired"); btn.textContent = (btn.textContent==="Required") ? "Optional" : "Required"; }
function addTask(){
  const name=document.getElementById("newTaskName").value.trim(); if(!name) return;
  const req=document.getElementById("newTaskRequired").textContent==="Required";
  STATE.settings.anchors.push({name, key: name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20), optional:!req});
  document.getElementById("newTaskName").value=""; save(); openSettings();
}
function setPalette(name){ STATE.settings.palette=name; save(); applyPalette(name); }

// -------------- Onboarding --------------
function ensureOnboarding(){
  const ob=document.getElementById("onboard");
  if(STATE.settings.configured){ ob.style.display="none"; return; }
  ob.style.display="block";
  const pc=document.getElementById("phaseChoices"); pc.innerHTML="";
  for(let i=1;i<=6;i++){
    const b=document.createElement("div"); b.className="pill"+(i===STATE.settings.phasesChosen?" active":""); b.textContent=i;
    b.addEventListener("click",()=>{ STATE.settings.phasesChosen=i; STATE.settings.programDaysTotal=i*30; save(); ensureOnboarding(); });
    pc.appendChild(b);
  }
  const summary=document.getElementById("summaryTxt");
  summary.textContent = `You’ll complete ${STATE.settings.phasesChosen} phase(s) using ${STATE.settings.usedTemplate?"the template anchors":"your custom anchors"}.`;

  // template/custom handlers
  document.getElementById("useTemplate").onclick = ()=>{
    STATE.settings.anchors = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_ANCHORS));
    STATE.settings.usedTemplate=true; save(); ensureOnboarding();
  };
  document.getElementById("createOwn").onclick = ()=>{
    STATE.settings.usedTemplate=false; save();
    document.getElementById("customWrap").classList.remove("hidden");
  };
  document.getElementById("customReq").onclick = ()=>{
    const b=document.getElementById("customReq");
    b.textContent = (b.textContent==="Required") ? "Optional" : "Required";
  };
  document.getElementById("customAdd").onclick = ()=>{
    const name=document.getElementById("customName").value.trim(); if(!name) return;
    const req = document.getElementById("customReq").textContent==="Required";
    if(STATE.settings.usedTemplate) STATE.settings.anchors=[];
    STATE.settings.usedTemplate=false;
    STATE.settings.anchors.push({name, key:name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20), optional:!req});
    document.getElementById("customName").value="";
    save(); ensureOnboarding();
  };
  // render custom list
  const list=document.getElementById("customList"); list.innerHTML="";
  if(!STATE.settings.usedTemplate && STATE.settings.anchors.length){
    STATE.settings.anchors.forEach((a,idx)=>{
      const chip=document.createElement("span"); chip.className="taskchip"; chip.textContent = a.name + (a.optional?" (optional)":"");
      const rm=document.createElement("button"); rm.className="rm"; rm.textContent="×";
      rm.onclick=()=>{ STATE.settings.anchors.splice(idx,1); save(); ensureOnboarding(); };
      chip.appendChild(rm); list.appendChild(chip);
    });
  }

  document.getElementById("obNext1").onclick = ()=>{}; // already on same page
  document.getElementById("startProgram").onclick = ()=>{
    STATE.settings.startDate = new Date().toISOString().slice(0,10);
    STATE.settings.configured=true; save();
    ob.style.display="none";
    renderAll();
  };
}

// -------------- INIT --------------
window.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("btnFinish").addEventListener("click", finishDay);
  document.getElementById("btnReset").addEventListener("click", ()=>{ const t=new Date(); STATE.logs[dateKey(t)]={anchors:{},plan:{},note:"",completed:false}; save(); renderAll(); });
  document.getElementById("btnClear").addEventListener("click", ()=>{ if(confirm("Erase ALL saved data?")){ STATE = newState(); save(); ensureOnboarding(); }});
  document.getElementById("btnCompleteNow").addEventListener("click", closeConfirm);
  document.getElementById("btnContinueAnyway").addEventListener("click", ()=>{ closeConfirm(); alert("Marked as incomplete. You can retry or adjust from the calendar."); });
  document.getElementById("btnRecapEdit").addEventListener("click", closeRecap);
  document.getElementById("btnRecapSave").addEventListener("click", saveRecapAndComplete);
  document.getElementById("btnSettings").addEventListener("click", openSettings);
  document.getElementById("btnSettingsCancel").addEventListener("click", closeSettings);
  document.getElementById("btnSettingsSave").addEventListener("click", saveSettings);
  document.getElementById("palSoft").addEventListener("click", ()=>setPalette("soft"));
  document.getElementById("palMid").addEventListener("click", ()=>setPalette("mid"));
  document.getElementById("palDark").addEventListener("click", ()=>setPalette("dark"));
  document.getElementById("newTaskRequired").addEventListener("click", toggleNewTaskMode);
  document.getElementById("btnAddTask").addEventListener("click", addTask);

  if(!STATE.settings.configured){ ensureOnboarding(); }
  else { renderAll(); }
});
