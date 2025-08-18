
// Discipline 30 – v3.8
// Fixes: day locking, daily confirmation flow, custom “Today’s Plan” presets
// Adds default presets: Writing Session, Spring Cleaning Task, Weigh-In, Walk

const KEY = "discipline30_v11";

const TEMPLATE_TASKS = [
  {name:"Workout #1 (≥30 min)", key:"w1", optional:false},
  {name:"Workout #2 (≥30 min, preferably outdoors)", key:"w2", optional:false},
  {name:"10K Steps", key:"steps", optional:false},
  {name:"Drink 3L water", key:"water", optional:false},
  {name:"Log Food", key:"logfood", optional:false},
  {name:"Read 20+ minutes", key:"read", optional:false}
];

const DEFAULT_PRESETS = [
  "Run","Long Run","Long Walk","Strength","Yoga/Mobility","Swim","Tempo/Speed",
  "Bike","Row","Meal Prep","Grocery Shop","Rest","Stretch",
  "Writing Session","Spring Cleaning Task","Weigh-In","Walk"
];

const DEFAULT_WEEKLY_PLAN = { Mon:[], Tue:[], Wed:[], Thu:[], Fri:[], Sat:[], Sun:[] };

function newState() {
  return {
    settings: {
      palette:"soft",
      programDaysTotal: 180,
      phaseLength: 30,
      startDate: null,              // yyyy-mm-dd
      currentUnlockedDate: null,    // yyyy-mm-dd (max date you can work on)
      weeklyPlan: JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN)),
      tasks: JSON.parse(JSON.stringify(TEMPLATE_TASKS)),
      planPresets: [...DEFAULT_PRESETS],
      configured: false,
      phasesChosen: 6,
      usedTemplate: true
    },
    progress: {
      lastCompletedDate: null       // yyyy-mm-dd (the most recent day marked complete)
    },
    logs: {}                        // { "yyyy-mm-dd": {tasks:{}, plan:{}, note:"", completed:boolean} }
  };
}

let STATE = JSON.parse(localStorage.getItem(KEY) || "null") || newState();
function save(){ localStorage.setItem(KEY, JSON.stringify(STATE)); }
function todayKey(){ const d = new Date(); return dateKey(d); }
function dateKey(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function addDays(iso, days){
  const [Y,M,D] = iso.split("-").map(n=>+n);
  const d = new Date(Y, M-1, D); d.setDate(d.getDate()+days);
  return dateKey(d);
}
function cmpISO(a,b){ return a<b?-1:(a>b?1:0); }

function dayNumber(startISO, onDateISO){
  const [Y1,M1,D1]=startISO.split('-').map(n=>+n);
  const [Y2,M2,D2]=onDateISO.split('-').map(n=>+n);
  const d1=new Date(Y1,M1-1,D1), d2=new Date(Y2,M2-1,D2);
  d1.setHours(0,0,0,0); d2.setHours(0,0,0,0);
  return Math.max(1, Math.floor((d2-d1)/(1000*60*60*24))+1);
}
function phaseOfDay(n,len){ return Math.ceil(n/len); }

// THEME
function applyPalette(name){
  const r=document.documentElement.style;
  if(name==="dark"){
    r.setProperty('--bg','#0f1114'); r.setProperty('--card','#171a1f');
    r.setProperty('--ink','#e9edf2'); r.setProperty('--muted','#9aa3af');
    r.setProperty('--line','#2a2f36'); r.setProperty('--accent','#58bfa0');
  } else {
    r.setProperty('--bg','#0f1114'); r.setProperty('--card','#171a1f');
    r.setProperty('--ink','#e9edf2'); r.setProperty('--muted','#9aa3af');
    r.setProperty('--line','#2a2f36'); r.setProperty('--accent','#58bfa0');
  }
}
applyPalette(STATE.settings.palette);

// HELPERS
function todaysTasks(dateISO){
  const d = new Date(dateISO.replace(/-/g,'/'));
  const dow = d.getDay();
  const list=[];
  for(const t of STATE.settings.tasks){
    if(t.onlySunday && dow!==0) continue;
    if(t.onlyWeekdays && (dow===0||dow===6)) continue;
    list.push(t);
  }
  return list;
}

// DAY LOCKING
function ensureUnlockedDate(){
  const s=STATE.settings, p=STATE.progress;
  const tk = todayKey();

  if(!s.currentUnlockedDate){
    s.currentUnlockedDate = s.startDate;
  }

  if(p.lastCompletedDate){
    const next = addDays(p.lastCompletedDate, 1);
    s.currentUnlockedDate = cmpISO(next, tk) <= 0 ? next : tk;
  }

  if(cmpISO(s.currentUnlockedDate, tk) > 0) s.currentUnlockedDate = tk;

  save();
}
function isDayLocked(targetISO){
  const s=STATE.settings;
  return cmpISO(targetISO, s.currentUnlockedDate) > 0;
}

// RENDER
function renderPhaseHeader(activeISO){
  const s=STATE.settings;
  const dayNum=dayNumber(s.startDate, activeISO);
  const phaseNum=phaseOfDay(dayNum, s.phaseLength);
  document.getElementById("dayInfo").textContent =
    `Phase ${phaseNum} · Day ${((dayNum-1)%s.phaseLength)+1} / ${s.phaseLength}`;
  const pct = (((dayNum-1)%s.phaseLength)+1)/s.phaseLength*100;
  document.getElementById("progressBar").style.width = `${pct}%`;

  const pills=document.getElementById("phasePills"); pills.innerHTML="";
  for(let i=1;i<=s.programDaysTotal/s.phaseLength;i++){
    const el=document.createElement("div");
    el.className="phase-pill"+(i===phaseNum?" active":"");
    el.textContent=`P${i}`;
    pills.appendChild(el);
  }
}

function renderAll(){
  if(!STATE.settings.configured){ ensureOnboarding(); return; }

  ensureUnlockedDate();

  const s=STATE.settings, logs=STATE.logs;
  const tk = todayKey();

  const activeISO = cmpISO(tk, s.currentUnlockedDate) < 0 ? tk : s.currentUnlockedDate;
  const activeDate = new Date(activeISO.replace(/-/g,'/'));
  document.getElementById("dowBadge").textContent = activeDate.toLocaleDateString(undefined,{weekday:'long'});

  renderPhaseHeader(activeISO);

  const rec = logs[activeISO] || (logs[activeISO]={tasks:{},plan:{},note:"",completed:false});

  // Daily tasks
  const list = todaysTasks(activeISO);
  const box = document.getElementById("dailyList"); box.innerHTML="";
  list.forEach((t)=>{
    const id=`t_${t.key}`;
    const li=document.createElement("div"); li.className="card"+(rec.tasks[id]?" done":"")+(t.optional?" optional":"");
    const cb=document.createElement("div"); cb.className="checkbox";
    cb.innerHTML=`<svg viewBox="0 0 24 24"><circle class="circ" cx="12" cy="12" r="9"></circle><path class="tick" d="M7 12.5l3 3.5 7-8"></path></svg>`;
    cb.addEventListener("click",(e)=>{ e.stopPropagation(); if(rec.completed) return;
      rec.tasks[id]=!rec.tasks[id]; save(); renderAll(); });
    const title=document.createElement("div"); title.className="title"; title.textContent=t.name;
    const hint=document.createElement("div"); hint.className="hint"; hint.textContent=t.optional?"Optional":"Required";
    li.appendChild(cb); li.appendChild(title); li.appendChild(hint);
    li.addEventListener("click",()=>{ if(rec.completed) return; rec.tasks[id]=!rec.tasks[id]; save(); renderAll(); });
    if(rec.tasks[id]) li.classList.add("done"); else li.classList.remove("done");
    box.appendChild(li);
  });

  // Today's Plan (checklist)
  const planBox=document.getElementById("planList"); planBox.innerHTML="";
  const dLong=activeDate.toLocaleDateString(undefined,{weekday:'long'});
  const dShort=activeDate.toLocaleDateString(undefined,{weekday:'short'});
  const plan = (s.weeklyPlan[dShort] || s.weeklyPlan[dLong]) || [];
  plan.forEach((name, idx)=>{
    const id=`p_${idx}`;
    const li=document.createElement("div"); li.className="card"+(rec.plan&&rec.plan[id]?" done":"");
    const cb=document.createElement("div"); cb.className="checkbox";
    cb.innerHTML=`<svg viewBox="0 0 24 24"><circle class="circ" cx="12" cy="12" r="9"></circle><path class="tick" d="M7 12.5l3 3.5 7-8"></path></svg>`;
    cb.addEventListener("click",(e)=>{ e.stopPropagation(); if(rec.completed) return;
      rec.plan = rec.plan||{}; rec.plan[id]=!rec.plan[id]; save(); renderAll(); });
    const title=document.createElement("div"); title.className="title"; title.textContent=name;
    const hint=document.createElement("div"); hint.className="hint"; hint.textContent="Tap to toggle";
    li.appendChild(cb); li.appendChild(title); li.appendChild(hint);
    li.addEventListener("click",()=>{ if(rec.completed) return;
      rec.plan = rec.plan||{}; rec.plan[id]=!rec.plan[id]; save(); renderAll(); });
    if(rec.plan&&rec.plan[id]) li.classList.add("done"); else li.classList.remove("done");
    planBox.appendChild(li);
  });

  // Note
  const note=document.getElementById("noteBox");
  note.value=rec.note||"";
  note.oninput=()=>{ if(rec.completed) return; rec.note = note.value; save(); };

  // calendar
  buildCurrentMonthCalendar();
}

// FINISH FLOW
function requiredComplete(dateISO){
  const list=todaysTasks(dateISO);
  const rec=STATE.logs[dateISO] || {tasks:{}};
  for(const t of list){ if(t.optional) continue; if(!rec.tasks[`t_${t.key}`]) return false; }
  return true;
}
function highlightMissed(dateISO){
  const list=todaysTasks(dateISO);
  const rec=STATE.logs[dateISO] || {tasks:{}};
  const cards=[...document.getElementById("dailyList").children];
  cards.forEach((card, idx)=>{
    const t=list[idx]; const id=`t_${t.key}`;
    card.classList.remove("warn");
    if(!t.optional && !rec.tasks[id]) card.classList.add("warn");
  });
}

const confirmModal = {
  open(){
    const m=document.getElementById("confirmModal"); m.style.display="flex"; document.body.classList.add("no-scroll");
    m.querySelector("h3").textContent = "Did you complete all tasks?";
    m.querySelector("p").textContent  = "You haven’t completed all required tasks. Finish today or start over.";
  },
  close(){ const m=document.getElementById("confirmModal"); m.style.display="none"; document.body.classList.remove("no-scroll"); }
};

const recapModal = {
  open(){ document.getElementById("recapModal").style.display="flex"; document.body.classList.add("no-scroll"); },
  close(){ document.getElementById("recapModal").style.display="none"; document.body.classList.remove("no-scroll"); }
};

function buildTodayRecap(dateISO){
  const list=todaysTasks(dateISO);
  const rec=STATE.logs[dateISO] || (STATE.logs[dateISO]={tasks:{},plan:{},note:"",completed:false});
  const container=document.getElementById("recapList"); container.innerHTML="";
  list.forEach(t=>{
    const ok=!!rec.tasks[`t_${t.key}`];
    const row=document.createElement("div"); row.textContent=`${ok?"✓":"○"}  ${t.name}${t.optional?" (optional)":""}`;
    container.appendChild(row);
  });
  document.getElementById("recapPositive").value = rec.note||"";
}

function finishDay(){
  const s=STATE.settings;
  const activeISO = s.currentUnlockedDate;
  if(!requiredComplete(activeISO)){
    highlightMissed(activeISO);
    confirmModal.open();
    return;
  }
  buildTodayRecap(activeISO);
  recapModal.open();
}

function saveRecapAndComplete(){
  const s=STATE.settings, p=STATE.progress;
  const activeISO = s.currentUnlockedDate;
  const rec=STATE.logs[activeISO] || (STATE.logs[activeISO]={tasks:{},plan:{},note:"",completed:false});
  rec.note = document.getElementById("recapPositive").value || rec.note || "";
  rec.completed = true;
  p.lastCompletedDate = activeISO;
  const tk = todayKey();
  const next = addDays(activeISO, 1);
  s.currentUnlockedDate = (cmpISO(next, tk) <= 0) ? next : tk;
  save();
  recapModal.close();
  renderAll();
}

function wireConfirmButtons(){
  const completeBtn = document.getElementById("btnCompleteNow");
  const startOverBtn = document.getElementById("btnContinueAnyway");
  completeBtn.onclick = ()=> confirmModal.close();
  startOverBtn.onclick = ()=>{
    const tk = todayKey();
    STATE.settings.startDate = tk;
    STATE.settings.currentUnlockedDate = tk;
    STATE.progress.lastCompletedDate = null;
    STATE.logs = {};
    save();
    confirmModal.close();
    renderAll();
  };
}

// CALENDAR
function buildCurrentMonthCalendar(){
  const grid=document.getElementById("calendarGrid"); grid.innerHTML="";
  const logs=STATE.logs, s=STATE.settings;
  const now=new Date();
  const first=new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  document.getElementById("calTitle").textContent = now.toLocaleDateString(undefined,{month:'long',year:'numeric'});

  const weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  weekdays.forEach(w=>{ const h=document.createElement("div"); h.className="cal-head"; h.textContent=w; grid.appendChild(h); });

  const weekday = (first.getDay()+6)%7;
  for(let i=0;i<weekday;i++){ const b=document.createElement("div"); b.className="cal-cell"; b.style.visibility="hidden"; grid.appendChild(b); }

  const tk = todayKey();
  for(let d=1; d<=lastDay; d++){
    const dateObj = new Date(now.getFullYear(), now.getMonth(), d);
    const key = dateKey(dateObj);
    const rec=logs[key];
    const cell=document.createElement("div"); cell.className="cal-cell";
    if(key===tk) cell.classList.add("today");
    if(rec){
      if(rec.completed){ cell.classList.add("done"); cell.textContent=d+" ✓"; }
      else { cell.classList.add("past"); cell.classList.add("missed"); cell.textContent=d+" ×"; }
    } else { cell.textContent = d.toString(); }

    if(isDayLocked(key)) {
      cell.style.opacity = ".35";
      cell.style.pointerEvents = "none";
    } else {
      cell.addEventListener("click",()=>openPastDay(key));
    }

    if(STATE.settings.startDate && cmpISO(key, STATE.settings.startDate) < 0){
      cell.classList.add("past");
      cell.style.opacity=".3";
      cell.style.pointerEvents="none";
    }

    grid.appendChild(cell);
  }
}

function openPastDay(key){
  if(isDayLocked(key)) return;

  const dateObj=new Date(key.replace(/-/g,'/'));
  const rec = STATE.logs[key] || (STATE.logs[key]={tasks:{},plan:{},note:"",completed:false});
  const container=document.getElementById("recapList"); container.innerHTML="";
  const list = todaysTasks(key);
  list.forEach(t=>{
    const ok = !!rec.tasks[`t_${t.key}`];
    const row=document.createElement("div");
    row.textContent = `${ok?"✓":"○"}  ${t.name}${t.optional?" (optional)":""}`;
    row.addEventListener("click",()=>{ if(rec.completed) return; rec.tasks[`t_${t.key}`]=!ok; save(); openPastDay(key); });
    container.appendChild(row);
  });
  const pos=document.getElementById("recapPositive"); pos.value = rec.note||"";
  document.getElementById("btnRecapSave").onclick = ()=>{
    rec.note = pos.value||rec.note||""; rec.completed = true; save();
    if(key === STATE.settings.currentUnlockedDate){
      STATE.progress.lastCompletedDate = key;
      const tk=todayKey(), next=addDays(key,1);
      STATE.settings.currentUnlockedDate = (cmpISO(next, tk) <= 0) ? next : tk;
    }
    recapModal.close(); renderAll();
  };
  recapModal.open();
}

// SETTINGS (incl. custom presets)
function openSettings(){
  document.body.classList.add("no-scroll");
  document.getElementById("settingsModal").style.display="flex";

  const s=STATE.settings;
  const host=document.getElementById("settingsAnchors"); host.innerHTML="";
  s.tasks.forEach((t,idx)=>{
    const row=document.createElement("div"); row.className="settings-row";
    const nameInput=document.createElement("input"); nameInput.type="text"; nameInput.value=t.name;
    const toggle=document.createElement("button"); toggle.textContent=t.optional?"Optional":"Required"; toggle.className="icon-btn";
    toggle.addEventListener("click",()=>{ t.optional=!t.optional; toggle.textContent=t.optional?"Optional":"Required"; });
    const del=document.createElement("button"); del.textContent="Delete"; del.className="delete-btn";
    del.addEventListener("click",()=>{ s.tasks.splice(idx,1); save(); openSettings(); });
    row.appendChild(nameInput); row.appendChild(toggle); row.appendChild(del);
    nameInput.addEventListener("input",()=>{ t.name = nameInput.value; });
    host.appendChild(row);
  });

  const editor=document.getElementById("weeklyEditor"); editor.innerHTML="";
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  days.forEach(day=>{
    const row=document.createElement("div"); row.className="settings-row";
    const label=document.createElement("strong"); label.textContent=day;
    const input=document.createElement("input"); input.type="text"; input.value=(s.weeklyPlan[day]||[]).join(", ");
    const addBtn=document.createElement("button"); addBtn.className="icon-btn"; addBtn.textContent="+ Add preset";
    addBtn.onclick=()=>{
      const sel=document.createElement("select"); sel.className="select";
      s.planPresets.forEach(p=>{ const o=document.createElement("option"); o.value=p; o.textContent=p; sel.appendChild(o); });
      const ok=document.createElement("button"); ok.className="icon-btn"; ok.textContent="Add";
      const wrap=document.createElement("div"); wrap.className="inline"; wrap.appendChild(sel); wrap.appendChild(ok);
      row.appendChild(wrap);
      ok.onclick=()=>{
        const arr=input.value.split(",").map(x=>x.trim()).filter(Boolean);
        arr.push(sel.value); input.value=arr.join(", ");
        row.removeChild(wrap);
      };
    };
    row.appendChild(label); row.appendChild(input); row.appendChild(addBtn);
    editor.appendChild(row);
  });

  const pmHost = document.createElement("div");
  pmHost.style.marginTop = "10px";
  pmHost.innerHTML = `<h3>Manage Presets</h3>
    <div class="inline">
      <input id="newPresetName" type="text" placeholder="Add a new preset…">
      <button class="icon-btn" id="btnAddPreset">+ Add Preset</button>
    </div>
    <div id="presetChips" class="inline" style="margin-top:6px"></div>`;
  editor.parentElement.appendChild(pmHost);

  function renderPresetChips(){
    const chips = pmHost.querySelector("#presetChips");
    chips.innerHTML = "";
    s.planPresets.forEach((p,idx)=>{
      const chip=document.createElement("span"); chip.className="taskchip"; chip.textContent=p;
      const rm=document.createElement("button"); rm.className="rm"; rm.textContent="×";
      rm.onclick=()=>{ s.planPresets.splice(idx,1); save(); renderPresetChips(); };
      chip.appendChild(rm); chips.appendChild(chip);
    });
  }
  renderPresetChips();
  pmHost.querySelector("#btnAddPreset").onclick = ()=>{
    const v = pmHost.querySelector("#newPresetName").value.trim();
    if(!v) return; if(!s.planPresets.includes(v)) s.planPresets.push(v);
    pmHost.querySelector("#newPresetName").value=""; save(); renderPresetChips();
  };
}

function saveSettings(){
  const s=STATE.settings;
  const read=(input)=>input.value.split(",").map(x=>x.trim()).filter(Boolean);
  const rows=[...document.querySelectorAll("#weeklyEditor .settings-row")];
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  days.forEach((day,i)=>{ const input=rows[i].querySelector("input"); s.weeklyPlan[day]=read(input); });
  save(); closeSettings(); renderAll();
}
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; document.body.classList.remove("no-scroll"); }
function toggleNewTaskMode(){ const btn=document.getElementById("newTaskRequired"); btn.textContent = (btn.textContent==="Required") ? "Optional" : "Required"; }
function addTask(){
  const name=document.getElementById("newTaskName").value.trim(); if(!name) return;
  const req=document.getElementById("newTaskRequired").textContent==="Required";
  STATE.settings.tasks.push({name, key: name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20), optional:!req});
  document.getElementById("newTaskName").value=""; save(); openSettings();
}
function setPalette(name){ STATE.settings.palette=name; save(); applyPalette(name); }

// ONBOARDING
function ensureOnboarding(){
  const ob=document.getElementById("onboard");
  if(STATE.settings.configured){ ob.style.display="none"; return; }
  ob.style.display="block";

  const startInput=document.getElementById("startDateInput");
  const tk=todayKey();
  startInput.value = tk;

  const pc=document.getElementById("phaseChoices"); pc.innerHTML="";
  for(let i=1;i<=6;i++){
    const b=document.createElement("div"); b.className="pill"+(i===STATE.settings.phasesChosen?" active":""); b.textContent=i;
    b.addEventListener("click",()=>{ STATE.settings.phasesChosen=i; STATE.settings.programDaysTotal=i*30; save(); ensureOnboarding(); });
    pc.appendChild(b);
  }

  const useBtn=document.getElementById("useTemplate");
  const ownBtn=document.getElementById("createOwn");
  const customWrap=document.getElementById("customWrap");
  const chipsHost=document.getElementById("templateChips");

  function renderChips(){
    chipsHost.innerHTML="";
    TEMPLATE_TASKS.forEach(t=>{
      const chip=document.createElement("button");
      chip.className="icon-btn"; chip.textContent=`+ ${t.name}`;
      chip.onclick=()=>{
        if(STATE.settings.usedTemplate){ STATE.settings.usedTemplate=false; STATE.settings.tasks=[]; }
        STATE.settings.tasks.push({...t});
        customWrap.classList.remove("hidden");
        syncChoice(); renderCustomList();
      };
      chipsHost.appendChild(chip);
    });
  }
  function renderCustomList(){
    const list=document.getElementById("customList"); list.innerHTML="";
    STATE.settings.tasks.forEach((t,idx)=>{
      const chip=document.createElement("span"); chip.className="taskchip"; chip.textContent = t.name + (t.optional?" (optional)":"");
      const rm=document.createElement("button"); rm.className="rm"; rm.textContent="×";
      rm.onclick=()=>{ STATE.settings.tasks.splice(idx,1); save(); renderCustomList(); renderPreview(); };
      chip.appendChild(rm); list.appendChild(chip);
    });
  }
  function renderPreview(){
    const host=document.getElementById("templatePreview"); host.innerHTML="";
    (STATE.settings.tasks.length?STATE.settings.tasks:TEMPLATE_TASKS).forEach(t=>{
      const row=document.createElement("div"); row.className="card";
      const title=document.createElement("div"); title.className="title"; title.textContent=t.name;
      const hint=document.createElement("div"); hint.className="hint"; hint.textContent=t.optional?"Optional":"Required";
      row.appendChild(title); row.appendChild(hint); host.appendChild(row);
    });
  }
  function syncChoice(){
    useBtn.classList.toggle("selected", STATE.settings.usedTemplate);
    ownBtn.classList.toggle("selected", !STATE.settings.usedTemplate);
    if(STATE.settings.usedTemplate){
      STATE.settings.tasks = JSON.parse(JSON.stringify(TEMPLATE_TASKS));
      customWrap.classList.add("hidden");
    } else {
      customWrap.classList.remove("hidden");
    }
    renderPreview();
  }
  useBtn.onclick=()=>{ STATE.settings.usedTemplate=true; save(); syncChoice(); };
  ownBtn.onclick=()=>{ STATE.settings.usedTemplate=false; save(); syncChoice(); };
  document.getElementById("customReq").onclick = ()=>{
    const b=document.getElementById("customReq");
    b.textContent = (b.textContent==="Required") ? "Optional" : "Required";
  };
  document.getElementById("customAdd").onclick = ()=>{
    const name=document.getElementById("customName").value.trim(); if(!name) return;
    const req = document.getElementById("customReq").textContent==="Required";
    if(STATE.settings.usedTemplate){ STATE.settings.usedTemplate=false; STATE.settings.tasks=[]; }
    STATE.settings.tasks.push({name, key:name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20), optional:!req});
    document.getElementById("customName").value="";
    save(); renderCustomList(); renderPreview(); ownBtn.classList.add("selected"); useBtn.classList.remove("selected");
  };

  renderChips(); renderCustomList(); syncChoice();

  document.getElementById("startProgram").onclick = ()=>{
    STATE.settings.startDate = startInput.value || tk;
    STATE.settings.currentUnlockedDate = STATE.settings.startDate;
    STATE.progress.lastCompletedDate = null;
    STATE.settings.configured = true;
    save();
    ob.style.display="none";
    renderAll();
  };

  const summary=document.getElementById("summaryTxt");
  summary.textContent = `You’ll complete ${STATE.settings.phasesChosen} phase(s). Start date: ${tk}.`;
}

// TABS & INIT
function showTasks(){ 
  document.getElementById("panelTasks").classList.remove("hidden"); 
  document.getElementById("panelCalendar").classList.add("hidden"); 
  document.getElementById("tabTasks").classList.add("active"); 
  document.getElementById("tabCalendar").classList.remove("active"); 
}
function showCalendar(){ 
  document.getElementById("panelCalendar").classList.remove("hidden"); 
  document.getElementById("panelTasks").classList.add("hidden"); 
  document.getElementById("tabCalendar").classList.add("active"); 
  document.getElementById("tabTasks").classList.remove("active"); 
  buildCurrentMonthCalendar();
}

window.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("btnFinish").addEventListener("click", finishDay);
  document.getElementById("btnReset").addEventListener("click", ()=>{
    const iso = STATE.settings.currentUnlockedDate;
    STATE.logs[iso] = {tasks:{},plan:{},note:"",completed:false}; save(); renderAll();
  });
  document.getElementById("btnClear").addEventListener("click", ()=>{
    if(confirm("Erase ALL saved data?")){ STATE = newState(); save(); ensureOnboarding(); }
  });
  document.getElementById("btnRecapEdit").addEventListener("click", ()=>recapModal.close());
  document.getElementById("btnRecapSave").addEventListener("click", saveRecapAndComplete);
  document.getElementById("btnSettings").addEventListener("click", openSettings);
  document.getElementById("btnSettingsCancel").addEventListener("click", closeSettings);
  document.getElementById("btnSettingsSave").addEventListener("click", saveSettings);
  document.getElementById("palSoft").addEventListener("click", ()=>setPalette("soft"));
  document.getElementById("palDark").addEventListener("click", ()=>setPalette("dark"));
  document.getElementById("newTaskRequired").addEventListener("click", toggleNewTaskMode);
  document.getElementById("btnAddTask").addEventListener("click", addTask);
  document.getElementById("tabTasks").addEventListener("click", showTasks);
  document.getElementById("tabCalendar").addEventListener("click", showCalendar);

  wireConfirmButtons();

  if(!STATE.settings.configured){ ensureOnboarding(); }
  else { renderAll(); }
});
