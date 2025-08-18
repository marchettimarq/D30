
// Discipline 30 v3.9 — default light, onboarding restored, phase/day fixed, polish
const KEY = "discipline30_v13";

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

function newState(){ return {
  settings:{
    palette:"soft",               // 'soft' = Zen Light (default first load)
    programDaysTotal: 180,
    phaseLength: 30,
    startDate: null,
    currentUnlockedDate: null,
    weeklyPlan: JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN)),
    tasks: JSON.parse(JSON.stringify(TEMPLATE_TASKS)),
    planPresets: [...DEFAULT_PRESETS],
    configured: false,
    phasesChosen: 6,
    usedTemplate: true
  },
  progress:{ lastCompletedDate:null },
  logs:{}
};}

let STATE = JSON.parse(localStorage.getItem(KEY) || "null") || newState();
function save(){ localStorage.setItem(KEY, JSON.stringify(STATE)); }
function todayKey(){ return dateKey(new Date()); }
function dateKey(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; }
function addDays(iso,days){ const [Y,M,D]=iso.split("-").map(Number); const d=new Date(Y,M-1,D); d.setDate(d.getDate()+days); return dateKey(d); }
function cmpISO(a,b){ return a<b?-1:(a>b?1:0); }
function dayNumber(startISO,onISO){ const s=new Date(startISO), t=new Date(onISO); s.setHours(0,0,0,0); t.setHours(0,0,0,0); return Math.max(1, Math.floor((t-s)/86400000)+1); }
function phaseOfDay(n,len){ return Math.ceil(n/len); }

// palette
function applyPalette(){
  document.body.classList.toggle('dark', STATE.settings.palette==='dark');
}
function setPalette(name){ STATE.settings.palette=name; save(); applyPalette(); }

// tasks
function todaysTasks(dateISO){
  const d=new Date(dateISO); const dow=d.getDay(); const list=[];
  for(const t of STATE.settings.tasks){
    if(t.onlySunday && dow!==0) continue;
    if(t.onlyWeekdays && (dow===0||dow===6)) continue;
    list.push(t);
  } return list;
}

// locking
function ensureUnlockedDate(){
  const s=STATE.settings, p=STATE.progress, tk=todayKey();
  if(!s.currentUnlockedDate) s.currentUnlockedDate=s.startDate;
  if(p.lastCompletedDate){ const next=addDays(p.lastCompletedDate,1); s.currentUnlockedDate = cmpISO(next, tk) <= 0 ? next : tk; }
  if(cmpISO(s.currentUnlockedDate, tk)>0) s.currentUnlockedDate=tk;
  save();
}
function isDayLocked(targetISO){ return cmpISO(targetISO, STATE.settings.currentUnlockedDate) > 0; }

// render
function renderPhaseHeader(activeISO){
  const s=STATE.settings;
  const dayNum=dayNumber(s.startDate, activeISO);
  const phaseNum=phaseOfDay(dayNum, s.phaseLength);
  document.getElementById("dayInfo").textContent = `Phase ${phaseNum} · Day ${((dayNum-1)%s.phaseLength)+1} / ${s.phaseLength}`;
  document.getElementById("progressBar").style.width = `${((((dayNum-1)%s.phaseLength)+1)/s.phaseLength)*100}%`;
  const pills=document.getElementById("phasePills"); pills.innerHTML="";
  for(let i=1;i<=s.programDaysTotal/s.phaseLength;i++){
    const el=document.createElement("div"); el.className="phase-pill"+(i===phaseNum?" active":""); el.textContent=`P${i}`; pills.appendChild(el);
  }
}
function renderAll(){
  if(!STATE.settings.configured){ ensureOnboarding(); return; }
  ensureUnlockedDate();

  const s=STATE.settings, logs=STATE.logs, tk=todayKey();
  const activeISO = cmpISO(tk, s.currentUnlockedDate)<0 ? tk : s.currentUnlockedDate;
  const activeDate = new Date(activeISO);
  document.getElementById("dowBadge").textContent = activeDate.toLocaleDateString(undefined,{weekday:'long'});
  renderPhaseHeader(activeISO);

  const rec = logs[activeISO] || (logs[activeISO]={tasks:{},plan:{},note:"",completed:false});

  // tasks
  const list=todaysTasks(activeISO);
  const box=document.getElementById("dailyList"); box.innerHTML="";
  list.forEach(t=>{
    const id=`t_${t.key}`;
    const li=document.createElement("div"); li.className="card"+(rec.tasks[id]?" done":"")+(t.optional?" optional":"");
    const cb=document.createElement("div"); cb.className="checkbox";
    cb.innerHTML=`<svg viewBox="0 0 24 24"><circle class="circ" cx="12" cy="12" r="9"></circle><path class="tick" d="M7 12.5l3 3.5 7-8"></path></svg>`;
    cb.onclick=(e)=>{ e.stopPropagation(); if(rec.completed) return; rec.tasks[id]=!rec.tasks[id]; save(); renderAll(); };
    const title=document.createElement("div"); title.className="title"; title.textContent=t.name;
    const hint=document.createElement("div"); hint.className="hint"; hint.textContent=t.optional?"Optional":"Required";
    li.append(cb,title,hint); li.onclick=()=>{ if(rec.completed) return; rec.tasks[id]=!rec.tasks[id]; save(); renderAll(); };
    if(rec.tasks[id]) li.classList.add("done"); box.appendChild(li);
  });

  // plan
  const planBox=document.getElementById("planList"); planBox.innerHTML="";
  const dShort=activeDate.toLocaleDateString(undefined,{weekday:'short'});
  const dLong=activeDate.toLocaleDateString(undefined,{weekday:'long'});
  const plan=(s.weeklyPlan[dShort] || s.weeklyPlan[dLong]) || [];
  plan.forEach((name, idx)=>{
    const id=`p_${idx}`;
    const li=document.createElement("div"); li.className="card"+(rec.plan&&rec.plan[id]?" done":"");
    const cb=document.createElement("div"); cb.className="checkbox";
    cb.innerHTML=`<svg viewBox="0 0 24 24"><circle class="circ" cx="12" cy="12" r="9"></circle><path class="tick" d="M7 12.5l3 3.5 7-8"></path></svg>`;
    cb.onclick=(e)=>{ e.stopPropagation(); if(rec.completed) return; rec.plan=rec.plan||{}; rec.plan[id]=!rec.plan[id]; save(); renderAll(); };
    const title=document.createElement("div"); title.className="title"; title.textContent=name;
    const hint=document.createElement("div"); hint.className="hint"; hint.textContent="Tap to toggle";
    li.append(cb,title,hint); li.onclick=()=>{ if(rec.completed) return; rec.plan=rec.plan||{}; rec.plan[id]=!rec.plan[id]; save(); renderAll(); };
    if(rec.plan&&rec.plan[id]) li.classList.add("done"); planBox.appendChild(li);
  });

  // note
  const note=document.getElementById("noteBox"); note.value=rec.note||"";
  note.oninput=()=>{ if(rec.completed) return; rec.note=note.value; save(); };

  buildCurrentMonthCalendar();
}

// finish flow
function requiredComplete(dateISO){
  const list=todaysTasks(dateISO); const rec=STATE.logs[dateISO]||{tasks:{}};
  for(const t of list){ if(t.optional) continue; if(!rec.tasks[`t_${t.key}`]) return false; } return true;
}
function highlightMissed(dateISO){
  const list=todaysTasks(dateISO); const rec=STATE.logs[dateISO]||{tasks:{}};
  [...document.getElementById("dailyList").children].forEach((card,idx)=>{
    const t=list[idx]; const id=`t_${t.key}`; card.classList.remove("warn"); if(!t.optional && !rec.tasks[id]) card.classList.add("warn");
  });
}
const confirmModal={open(){document.getElementById("confirmModal").style.display="flex";}, close(){document.getElementById("confirmModal").style.display="none";}};
const recapModal={open(){document.getElementById("recapModal").style.display="flex";}, close(){document.getElementById("recapModal").style.display="none";}};
function buildTodayRecap(dateISO){
  const list=todaysTasks(dateISO); const rec=STATE.logs[dateISO]||(STATE.logs[dateISO]={tasks:{},plan:{},note:"",completed:false});
  const container=document.getElementById("recapList"); container.innerHTML="";
  list.forEach(t=>{ const ok=!!rec.tasks[`t_${t.key}`]; const row=document.createElement("div"); row.textContent=`${ok?"✓":"○"}  ${t.name}${t.optional?" (optional)":""}`; container.appendChild(row); });
  document.getElementById("recapPositive").value = rec.note||"";
}
function finishDay(){ const iso=STATE.settings.currentUnlockedDate; if(!requiredComplete(iso)){ highlightMissed(iso); confirmModal.open(); return; } buildTodayRecap(iso); recapModal.open(); }
function saveRecapAndComplete(){
  const s=STATE.settings, p=STATE.progress, iso=s.currentUnlockedDate;
  const rec=STATE.logs[iso]||(STATE.logs[iso]={tasks:{},plan:{},note:"",completed:false});
  rec.note=document.getElementById("recapPositive").value||rec.note||""; rec.completed=true;
  p.lastCompletedDate=iso; const tk=todayKey(), next=addDays(iso,1); s.currentUnlockedDate=(cmpISO(next,tk)<=0)?next:tk;
  save(); recapModal.close(); renderAll();
}
function wireConfirmButtons(){
  document.getElementById("btnCompleteNow").onclick=()=>confirmModal.close();
  document.getElementById("btnContinueAnyway").onclick=()=>{
    const tk=todayKey(); STATE.settings.startDate=tk; STATE.settings.currentUnlockedDate=tk; STATE.progress.lastCompletedDate=null; STATE.logs={}; save(); confirmModal.close(); renderAll();
  };
}

// calendar
function buildCurrentMonthCalendar(){
  const grid=document.getElementById("calendarGrid"); grid.innerHTML="";
  const logs=STATE.logs, s=STATE.settings; const now=new Date();
  const first=new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  document.getElementById("calTitle").textContent = now.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; weekdays.forEach(w=>{ const h=document.createElement("div"); h.className="cal-head"; h.textContent=w; grid.appendChild(h); });
  const weekday=(first.getDay()+6)%7; for(let i=0;i<weekday;i++){ const b=document.createElement("div"); b.className="cal-cell"; b.style.visibility="hidden"; grid.appendChild(b); }
  const tk=todayKey();
  for(let d=1; d<=lastDay; d++){
    const dateObj=new Date(now.getFullYear(), now.getMonth(), d); const key=dateKey(dateObj); const rec=logs[key];
    const cell=document.createElement("div"); cell.className="cal-cell"; if(key===tk) cell.classList.add("today");
    if(rec){ if(rec.completed){ cell.classList.add("done"); cell.textContent=d+" ✓"; } else { cell.classList.add("past","missed"); cell.textContent=d+" ×"; } }
    else { cell.textContent=String(d); }
    if(isDayLocked(key)){ cell.style.opacity=".35"; cell.style.pointerEvents="none"; } else { cell.onclick=()=>openPastDay(key); }
    if(s.startDate && cmpISO(key, s.startDate) < 0){ cell.classList.add("past"); cell.style.opacity=".3"; cell.style.pointerEvents="none"; }
    grid.appendChild(cell);
  }
}
function openPastDay(key){
  if(isDayLocked(key)) return;
  const rec=STATE.logs[key]||(STATE.logs[key]={tasks:{},plan:{},note:"",completed:false});
  const container=document.getElementById("recapList"); container.innerHTML="";
  const list=todaysTasks(key);
  list.forEach(t=>{ const ok=!!rec.tasks[`t_${t.key}`]; const row=document.createElement("div"); row.textContent=`${ok?"✓":"○"}  ${t.name}${t.optional?" (optional)":""}`; row.onclick=()=>{ if(rec.completed) return; rec.tasks[`t_${t.key}`]=!ok; save(); openPastDay(key); }; container.appendChild(row); });
  const pos=document.getElementById("recapPositive"); pos.value=rec.note||"";
  document.getElementById("btnRecapSave").onclick=()=>{ rec.note=pos.value||rec.note||""; rec.completed=true; save(); if(key===STATE.settings.currentUnlockedDate){ STATE.progress.lastCompletedDate=key; const tk=todayKey(), next=addDays(key,1); STATE.settings.currentUnlockedDate=(cmpISO(next,tk)<=0)?next:tk; } recapModal.close(); renderAll(); };
  recapModal.open();
}

// settings
function openSettings(){
  document.getElementById("settingsModal").style.display="flex";
  const s=STATE.settings;
  const host=document.getElementById("settingsAnchors"); host.innerHTML="";
  s.tasks.forEach((t,idx)=>{
    const row=document.createElement("div"); row.className="inline";
    const name=document.createElement("input"); name.type="text"; name.value=t.name;
    const toggle=document.createElement("button"); toggle.className="icon-btn"; toggle.textContent=t.optional?"Optional":"Required";
    toggle.onclick=()=>{ t.optional=!t.optional; toggle.textContent=t.optional?"Optional":"Required"; };
    const del=document.createElement("button"); del.textContent="Delete"; del.className="icon-btn"; del.onclick=()=>{ s.tasks.splice(idx,1); save(); openSettings(); };
    row.append(name,toggle,del); name.oninput=()=>{ t.name=name.value; };
    host.appendChild(row);
  });

  const editor=document.getElementById("weeklyEditor"); editor.innerHTML="";
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  days.forEach(day=>{
    const row=document.createElement("div"); row.className="inline";
    const label=document.createElement("strong"); label.textContent=day;
    const input=document.createElement("input"); input.type="text"; input.value=(s.weeklyPlan[day]||[]).join(", ");
    const addBtn=document.createElement("button"); addBtn.className="icon-btn"; addBtn.textContent="+ Add preset";
    addBtn.onclick=()=>{
      const sel=document.createElement("select");
      s.planPresets.forEach(p=>{ const o=document.createElement("option"); o.value=p; o.textContent=p; sel.appendChild(o); });
      const ok=document.createElement("button"); ok.className="icon-btn"; ok.textContent="Add";
      const wrap=document.createElement("div"); wrap.className="inline"; wrap.append(sel,ok); row.appendChild(wrap);
      ok.onclick=()=>{ const arr=input.value.split(",").map(x=>x.trim()).filter(Boolean); arr.push(sel.value); input.value=arr.join(", "); row.removeChild(wrap); };
    };
    row.append(label,input,addBtn); editor.appendChild(row);
  });
}
function saveSettings(){
  const s=STATE.settings; const rows=[...document.querySelectorAll("#weeklyEditor .inline")];
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  days.forEach((day,i)=>{ const input=rows[i].querySelector("input[type=text]"); s.weeklyPlan[day]=input.value.split(",").map(x=>x.trim()).filter(Boolean); });
  save(); closeSettings(); renderAll();
}
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; }
function toggleNewTaskMode(){ const btn=document.getElementById("newTaskRequired"); btn.textContent=(btn.textContent==="Required")?"Optional":"Required"; }
function addTask(){ const name=document.getElementById("newTaskName").value.trim(); if(!name) return; const req=document.getElementById("newTaskRequired").textContent==="Required"; STATE.settings.tasks.push({name, key:name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20), optional:!req}); document.getElementById("newTaskName").value=""; save(); openSettings(); }

// onboarding
function ensureOnboarding(){
  const ob=document.getElementById("onboard");
  if(STATE.settings.configured){ ob.style.display="none"; return; }
  ob.style.display="block";

  const tk=todayKey();
  const startInput=document.getElementById("startDateInput"); startInput.value=tk;

  const pc=document.getElementById("phaseChoices"); pc.innerHTML="";
  for(let i=1;i<=6;i++){
    const b=document.createElement("div"); b.className="pill"+(i===STATE.settings.phasesChosen?" active":""); b.textContent=i;
    b.onclick=()=>{ STATE.settings.phasesChosen=i; STATE.settings.programDaysTotal=i*30; save(); ensureOnboarding(); };
    pc.appendChild(b);
  }

  const useBtn=document.getElementById("useTemplate");
  const ownBtn=document.getElementById("createOwn");
  const chipsHost=document.getElementById("templateChips");
  const customWrap=document.getElementById("customWrap");

  function renderChips(){
    chipsHost.innerHTML="";
    TEMPLATE_TASKS.forEach(t=>{
      const chip=document.createElement("button"); chip.className="icon-btn"; chip.textContent=`+ ${t.name}`;
      chip.onclick=()=>{
        if(STATE.settings.usedTemplate){ STATE.settings.usedTemplate=false; STATE.settings.tasks=[]; }
        STATE.settings.tasks.push({...t}); customWrap.classList.remove("hidden");
        renderCustomList(); renderPreview(); ownBtn.classList.add("selected"); useBtn.classList.remove("selected");
      };
      chipsHost.appendChild(chip);
    });
  }
  function renderCustomList(){
    const list=document.getElementById("customList"); list.innerHTML="";
    STATE.settings.tasks.forEach((t,idx)=>{
      const chip=document.createElement("span"); chip.className="taskchip"; chip.textContent=t.name + (t.optional?" (optional)":"");
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
      row.append(title,hint); host.appendChild(row);
    });
  }
  function syncChoice(){
    useBtn.classList.toggle("selected", STATE.settings.usedTemplate);
    ownBtn.classList.toggle("selected", !STATE.settings.usedTemplate);
    if(STATE.settings.usedTemplate){ STATE.settings.tasks = JSON.parse(JSON.stringify(TEMPLATE_TASKS)); customWrap.classList.add("hidden"); }
    else { customWrap.classList.remove("hidden"); }
    renderPreview();
  }
  useBtn.onclick=()=>{ STATE.settings.usedTemplate=true; save(); syncChoice(); };
  ownBtn.onclick=()=>{ STATE.settings.usedTemplate=false; save(); syncChoice(); };
  document.getElementById("customReq").onclick=()=>{ const b=document.getElementById("customReq"); b.textContent=(b.textContent==="Required")?"Optional":"Required"; };
  document.getElementById("customAdd").onclick=()=>{
    const name=document.getElementById("customName").value.trim(); if(!name) return;
    const req=document.getElementById("customReq").textContent==="Required";
    if(STATE.settings.usedTemplate){ STATE.settings.usedTemplate=false; STATE.settings.tasks=[]; }
    STATE.settings.tasks.push({name, key:name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20), optional:!req});
    document.getElementById("customName").value="";
    save(); renderCustomList(); renderPreview(); ownBtn.classList.add("selected"); useBtn.classList.remove("selected");
  };

  renderChips(); renderCustomList(); syncChoice();

  document.getElementById("startProgram").onclick=()=>{
    STATE.settings.startDate = startInput.value || tk;
    STATE.settings.currentUnlockedDate = STATE.settings.startDate;
    STATE.progress.lastCompletedDate = null;
    STATE.settings.configured = true;
    save(); ob.style.display="none"; renderAll();
  };

  document.getElementById("summaryTxt").textContent = `You’ll complete ${STATE.settings.phasesChosen} phase(s). Start date: ${tk}.`;
}

// tabs/init
function showTasks(){ document.getElementById("panelTasks").classList.remove("hidden"); document.getElementById("panelCalendar").classList.add("hidden"); document.getElementById("tabTasks").classList.add("active"); document.getElementById("tabCalendar").classList.remove("active"); }
function showCalendar(){ document.getElementById("panelCalendar").classList.remove("hidden"); document.getElementById("panelTasks").classList.add("hidden"); document.getElementById("tabCalendar").classList.add("active"); document.getElementById("tabTasks").classList.remove("active"); buildCurrentMonthCalendar(); }

window.addEventListener("DOMContentLoaded",()=>{
  // Apply palette on load (default soft)
  applyPalette();

  document.getElementById("btnFinish").onclick=finishDay;
  document.getElementById("btnReset").onclick=()=>{ const iso=STATE.settings.currentUnlockedDate; STATE.logs[iso]={tasks:{},plan:{},note:"",completed:false}; save(); renderAll(); };
  document.getElementById("btnClear").onclick=()=>{ if(confirm("Erase ALL saved data?")){ STATE=newState(); save(); ensureOnboarding(); } };
  document.getElementById("btnRecapEdit").onclick=()=>recapModal.close();
  document.getElementById("btnRecapSave").onclick=saveRecapAndComplete;
  document.getElementById("btnSettings").onclick=openSettings;
  document.getElementById("btnSettingsCancel").onclick=closeSettings;
  document.getElementById("btnSettingsSave").onclick=saveSettings;
  document.getElementById("palSoft").onclick=()=>setPalette("soft");
  document.getElementById("palDark").onclick=()=>setPalette("dark");
  document.getElementById("newTaskRequired").onclick=toggleNewTaskMode;
  document.getElementById("btnAddTask").onclick=addTask;
  document.getElementById("tabTasks").onclick=showTasks;
  document.getElementById("tabCalendar").onclick=showCalendar;
  wireConfirmButtons();

  if(!STATE.settings.configured){ ensureOnboarding(); }
  else { renderAll(); }
});
