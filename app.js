const REPORTS = [
  ["78","برنامه هفتگی دانشجو در طول ترم"],["88","برنامه هفتگی دانشجو در طول ترم"],
  ["73","برنامه هفتگی دانشجو جهت امتحان"],["206","برنامه امتحانات دروس"],
  ["212","لیست دروس ارائه‌شده ویژه دانشجو"],["211","دروس ارائه‌شده قبل از انتخاب واحد"],
  ["12100","ثبت نام اصلی (انتخاب واحد)"],["12370","ترمیم (حذف و اضافه)"],
  ["107","پیش‌نیاز، هم‌نیاز و معادل دروس"],["284","تطبیق دروس برای فارغ‌التحصیلی"],
  ["278","رتبه، معدل و واحد گذرانده"],["18090","بارگذاری مدارک توسط دانشجو"],
  ["1700","مشاهده مدارک بارگذاری‌شده"],["222","نقص مدارک پرونده دانشجو"],
  ["84","لیست نامه‌های دانشجو"],["428","کارت ورود به جلسه امتحان"],
  ["515","تأییدیه انتخاب واحد"],["79","کارنامه ترمی دانشجو"],
  ["1301","رسیدگی به مشکلات آموزشی"],["10190","تکمیل و تأیید اطلاعات شخصی"],
  ["11130","منوی کاربر"],["12140","حذف اضطراری"],
  ["12490","تقاضای مرخصی تحصیلی"],["13860","شرکت در فرآیند ارزشیابی"],
  ["15390","درخواست تجدیدنظر نمره"],["1665","اطلاع از اتمام ارزشیابی"],
  ["1950","غیبت‌های دانشجو"],["11160","تغییر شناسه کاربری و گذرواژه"],
  ["12310","اطلاع جامع دانشجو"],["21120","فارغ‌التحصیلی و انصراف"],
];

const DAYS = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه"];
let courses = [];
let settings = { examPeriodStart: null };
let calEvents = [];
let tasks = [];
let notes = [];
let dayPref = new Set();

function toFaDigits(n){
  const fa = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
  return String(n).replace(/[0-9]/g, d => fa[d]);
}
function toEnDigits(s){
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(s).replace(/[۰-۹]/g, d => fa.indexOf(d));
}
function parseTime(str){
  if(!str) return null;
  const nums = toEnDigits(str).match(/\d+(\.\d+)?/g);
  if(!nums || nums.length<2) return null;
  return { start: parseFloat(nums[0]), end: parseFloat(nums[1]) };
}
function overlap(s1,e1,s2,e2){ return s1 < e2 && s2 < e1; }

// ---------- persistence (browser localStorage — data stays on this device) ----------
function loadKey(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e){ return fallback; }
}
async function loadAll(){
  courses = loadKey('adib:courses', []);
  settings = loadKey('adib:settings', { examPeriodStart:null });
  calEvents = loadKey('adib:calendar', []);
  tasks = loadKey('adib:tasks', []);
  notes = loadKey('adib:notes', []);
  // migrate legacy course shape (day/time at top level) to options[]
  courses.forEach(c=>{
    if(!c.options){
      c.options = [{ day: c.day || DAYS[0], time: c.time || '' }];
      c.chosen = 0;
    }
    if(c.chosen===undefined) c.chosen = 0;
  });
  if(settings.examPeriodStart) document.getElementById('examPeriodStart').value = settings.examPeriodStart;
  renderAll();
}
async function save(key, data){ try{ localStorage.setItem(key, JSON.stringify(data)); }catch(e){ console.error(e); } }
const saveCourses = ()=>save('adib:courses', courses);
const saveSettings = ()=>save('adib:settings', settings);
const saveCal = ()=>save('adib:calendar', calEvents);
const saveTasks = ()=>save('adib:tasks', tasks);
const saveNotes = ()=>save('adib:notes', notes);

// ---------- tabs ----------
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('section.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.view).classList.add('active');
  });
});

// ---------- settings / countdown ----------
document.getElementById('saveSettings').addEventListener('click', async ()=>{
  settings.examPeriodStart = document.getElementById('examPeriodStart').value;
  await saveSettings();
  renderCountdown();
});

// ---------- courses ----------
function chosenSlot(c){ return c.options[c.chosen] || c.options[0]; }

function checkConflict(day, time, excludeId){
  const t = parseTime(time);
  if(!t) return null;
  for(const c of courses){
    if(c.id===excludeId) continue;
    const slot = chosenSlot(c);
    const st = parseTime(slot.time);
    if(!st) continue;
    if(slot.day===day && overlap(st.start,st.end,t.start,t.end)) return c;
  }
  return null;
}

document.getElementById('addCourse').addEventListener('click', async ()=>{
  const name = document.getElementById('cName').value.trim();
  const credit = parseFloat(document.getElementById('cCredit').value);
  const day = document.getElementById('cDay').value;
  const time = document.getElementById('cTime').value.trim();
  const term = document.getElementById('cTerm').value.trim();
  const exam = document.getElementById('cExam').value;
  const warnEl = document.getElementById('conflictWarning');
  if(!name || !credit){ alert('نام درس و تعداد واحد رو وارد کن.'); return; }

  const conflict = checkConflict(day, time, null);
  warnEl.innerHTML='';
  if(conflict){
    warnEl.innerHTML = `<div class="alert">تداخل زمانی با «${conflict.name}» (${chosenSlot(conflict).day} ${chosenSlot(conflict).time}). درس اضافه شد ولی بهتره روز/ساعت رو اصلاح کنی یا گزینه زمانی دیگه‌ای اضافه کنی.</div>`;
  }

  courses.push({ id: Date.now(), name, credit, term, exam, grade: null, options:[{day,time}], chosen:0 });
  ['cName','cCredit','cTime','cTerm','cExam'].forEach(id=>document.getElementById(id).value='');
  await saveCourses();
  renderAll();
});

function removeCourse(id){ courses = courses.filter(c=>c.id!==id); saveCourses(); renderAll(); }
function setGrade(id, val){ const c=courses.find(c=>c.id===id); if(c) c.grade = val===''?null:parseFloat(val); saveCourses(); renderGpa(); }
function chooseOption(cid, idx){ const c=courses.find(c=>c.id===cid); if(c){ c.chosen = idx; saveCourses(); renderAll(); } }
function addOption(cid){
  const day = document.getElementById('optDay_'+cid).value;
  const time = document.getElementById('optTime_'+cid).value.trim();
  if(!time) return;
  const c = courses.find(c=>c.id===cid);
  c.options.push({day,time});
  saveCourses(); renderAll();
}
function toggleSub(id){ document.getElementById(id).classList.toggle('open'); }
window.removeCourse=removeCourse; window.setGrade=setGrade; window.chooseOption=chooseOption;
window.addOption=addOption; window.toggleSub=toggleSub;

function renderCourseList(){
  const el = document.getElementById('courseList');
  if(!courses.length){ el.innerHTML='<div class="empty">هنوز درسی اضافه نکردی.</div>'; return; }
  el.innerHTML = courses.map(c=>{
    const slot = chosenSlot(c);
    const conflict = checkConflict(slot.day, slot.time, c.id);
    const optsHtml = c.options.map((o,i)=>`
      <label class="opt-row">
        <input type="radio" name="opt_${c.id}" ${i===c.chosen?'checked':''} onchange="chooseOption(${c.id},${i})">
        <span>${o.day} · ${o.time || '—'}</span>
      </label>`).join('');
    return `
    <div class="item" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="name">${c.name}${c.term?` <span style="color:var(--muted);font-weight:400;font-size:11px;">· ${c.term}</span>`:''}</div>
          <div class="meta">${slot.day} ${slot.time||''} · ${toFaDigits(c.credit)} واحد</div>
          ${conflict?`<div class="meta" style="color:var(--rose);">تداخل با ${conflict.name}</div>`:''}
        </div>
        <button class="btn ghost" onclick="removeCourse(${c.id})">حذف</button>
      </div>
      <span class="toggle-link" onclick="toggleSub('sub_${c.id}')">گزینه‌های زمانی (${toFaDigits(c.options.length)})</span>
      <div class="subform" id="sub_${c.id}">
        ${optsHtml}
        <div class="grid2" style="margin-top:8px;">
          <select id="optDay_${c.id}">${DAYS.map(d=>`<option ${d===slot.day?'selected':''}>${d}</option>`).join('')}</select>
          <input id="optTime_${c.id}" placeholder="مثلاً 14-16">
        </div>
        <button class="btn small secondary" onclick="addOption(${c.id})">افزودن گزینه</button>
      </div>
    </div>`;
  }).join('');
}

function renderWeekTable(){
  const table = document.getElementById('weekTable');
  const hours = Array.from({length:12}, (_,i)=>8+i);
  let html = '<tr><th></th>' + DAYS.map(d=>`<th>${d}</th>`).join('') + '</tr>';
  hours.forEach(h=>{
    html += `<tr><th>${toFaDigits(h)}</th>`;
    DAYS.forEach(d=>{
      const match = courses.find(c=>{
        const s = chosenSlot(c);
        if(s.day!==d) return false;
        const t = parseTime(s.time);
        return t && Math.floor(t.start)===h;
      });
      let cellHtml = '';
      if(match){
        const s = chosenSlot(match);
        const conflict = checkConflict(s.day, s.time, match.id);
        cellHtml = `<div class="slot ${conflict?'conflict':''}">${match.name}<br>${s.time}</div>`;
      }
      html += `<td>${cellHtml}</td>`;
    });
    html += '</tr>';
  });
  table.innerHTML = html;
}

function renderExamList(){
  const el = document.getElementById('examList');
  const withExam = courses.filter(c=>c.exam).sort((a,b)=>new Date(a.exam)-new Date(b.exam));
  if(!withExam.length){ el.innerHTML='<div class="empty">امتحانی ثبت نشده.</div>'; return; }
  el.innerHTML = withExam.map(c=>{
    const d = new Date(c.exam);
    const str = d.toLocaleDateString('fa-IR') + ' ساعت ' + d.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});
    return `<div class="item"><div><div class="name">${c.name}</div><div class="meta">${str}</div></div></div>`;
  }).join('');
}

// day preference chips + suggestion
function renderDayChips(){
  const el = document.getElementById('dayPrefChips');
  el.innerHTML = DAYS.map(d=>`<span class="chip ${dayPref.has(d)?'active':''}" onclick="toggleDayPref('${d}')">${d}</span>`).join('');
}
function toggleDayPref(d){ dayPref.has(d) ? dayPref.delete(d) : dayPref.add(d); renderDayChips(); }
window.toggleDayPref = toggleDayPref;

document.getElementById('suggestBtn').addEventListener('click', ()=>{
  const resEl = document.getElementById('suggestResult');
  if(!courses.length){ resEl.innerHTML = '<div class="alert">اول چند درس اضافه کن.</div>'; return; }
  const prefs = Array.from(dayPref);
  const list = courses.filter(c=>c.options.some(o=>parseTime(o.time)));
  let best = null, bestScore = Infinity;
  function backtrack(idx, assignment, used){
    if(idx===list.length){
      const score = assignment.reduce((s,oi,i)=> s + (prefs.includes(list[i].options[oi].day)?1:0), 0);
      if(score < bestScore){ bestScore = score; best = assignment.slice(); }
      return;
    }
    const c = list[idx];
    for(let oi=0; oi<c.options.length; oi++){
      const opt = c.options[oi];
      const t = parseTime(opt.time);
      if(!t) continue;
      let conflict = used.some(u=>u.day===opt.day && overlap(u.start,u.end,t.start,t.end));
      if(conflict) continue;
      used.push({day:opt.day,start:t.start,end:t.end});
      assignment.push(oi);
      backtrack(idx+1, assignment, used);
      assignment.pop(); used.pop();
    }
  }
  backtrack(0, [], []);
  if(!best){
    resEl.innerHTML = '<div class="alert">با گزینه‌های زمانی فعلی، چیدمانِ کاملاً بدون تداخل پیدا نشد. یه گزینه زمانی دیگه برای یکی از درس‌ها اضافه کن.</div>';
    return;
  }
  list.forEach((c,i)=>{ c.chosen = best[i]; });
  saveCourses();
  renderAll();
  const msg = bestScore===0
    ? 'یه چیدمان بدون تداخل پیدا شد که کاملاً با روزهای خالی موردنظرت هم‌خونیه.'
    : `چیدمان بدون تداخل پیدا شد، ولی ${toFaDigits(bestScore)} مورد از دروس روی روزهای موردنظرت افتاده (نزدیک‌ترین گزینه ممکن بود).`;
  resEl.innerHTML = `<div class="alert ok">${msg}</div>`;
});

// ---------- grades ----------
function renderGradeInputs(){
  const el = document.getElementById('gradeInputs');
  if(!courses.length){ el.innerHTML='<div class="empty">اول از بخش «انتخاب واحد» درس اضافه کن.</div>'; return; }
  el.innerHTML = courses.map(c=>`
    <div class="item">
      <div><div class="name">${c.name}</div><div class="meta">${c.term||'بدون ترم'} · ${toFaDigits(c.credit)} واحد</div></div>
      <input class="grade-input" type="number" min="0" max="20" step="0.25" value="${c.grade ?? ''}" placeholder="نمره" onchange="setGrade(${c.id}, this.value)">
    </div>`).join('');
}

function gpaOf(list){
  const graded = list.filter(c=>c.grade!==null && c.grade!==undefined && !isNaN(c.grade));
  const totalCredit = graded.reduce((s,c)=>s+c.credit,0);
  const totalPoints = graded.reduce((s,c)=>s+c.credit*c.grade,0);
  return { gpa: totalCredit? totalPoints/totalCredit : 0, totalCredit, totalPoints, graded };
}

function renderGpa(){
  const { gpa, graded } = gpaOf(courses);
  const gpaStr = toFaDigits(gpa.toFixed(2));
  document.getElementById('gpaVal').textContent = gpaStr;
  document.getElementById('dashGpa').textContent = gpaStr;

  const target = parseFloat(document.getElementById('targetGpa').value) || 17;
  let msg, cls;
  if(!graded.length){ msg='هنوز نمره‌ای ثبت نشده.'; cls=''; }
  else if(gpa >= target){ msg = `تبریک! ${toFaDigits((gpa-target).toFixed(2))} نمره بالاتر از هدفت (${toFaDigits(target)}) هستی.`; cls='good'; }
  else { msg = `${toFaDigits((target-gpa).toFixed(2))} نمره تا معدل ${toFaDigits(target)} فاصله داری.`; cls='warn'; }
  document.getElementById('gapMsg').textContent = msg;
  document.getElementById('gapMsg').className = 'gap-msg ' + cls;
  document.getElementById('dashGapMsg').textContent = msg;
  document.getElementById('dashGapMsg').className = 'gap-msg ' + cls;

  // term table
  const terms = {};
  graded.forEach(c=>{ const t=c.term||'بدون ترم'; (terms[t]=terms[t]||[]).push(c); });
  const rows = Object.keys(terms).map(t=>{
    const g = gpaOf(terms[t]);
    return `<tr><td>${t}</td><td>${toFaDigits(terms[t].length)}</td><td>${toFaDigits(g.totalCredit)}</td><td style="color:var(--gold-soft);font-weight:700;">${toFaDigits(g.gpa.toFixed(2))}</td></tr>`;
  }).join('');
  document.getElementById('termTable').innerHTML = rows
    ? `<tr><th>ترم</th><th>تعداد درس</th><th>واحد</th><th>معدل</th></tr>${rows}`
    : '<tr><td class="empty" colspan="4">هنوز نمره‌ای برای نمایش وجود نداره.</td></tr>';
}

document.getElementById('targetGpa').addEventListener('input', renderGpa);
document.getElementById('calcNeeded').addEventListener('click', ()=>{
  const remaining = parseFloat(document.getElementById('remainingCredits').value);
  const target = parseFloat(document.getElementById('targetGpa').value) || 17;
  const el = document.getElementById('neededMsg');
  el.style.display='block';
  if(!remaining || remaining<=0){ el.textContent='تعداد واحد باقی‌مانده رو وارد کن.'; el.className='gap-msg warn'; return; }
  const { totalCredit, totalPoints } = gpaOf(courses);
  const neededAvg = (target*(totalCredit+remaining) - totalPoints) / remaining;
  if(neededAvg > 20){ el.textContent = `با شرایط فعلی، رسیدن به معدل ${toFaDigits(target)} در واحدهای باقی‌مانده ممکن نیست (نیاز به میانگین ${toFaDigits(neededAvg.toFixed(1))}).`; el.className='gap-msg bad'; }
  else if(neededAvg <= 0){ el.textContent = `همین الان به معدل ${toFaDigits(target)} رسیدی یا بالاترش هستی.`; el.className='gap-msg good'; }
  else { el.textContent = `برای رسیدن به معدل ${toFaDigits(target)}، باید در واحدهای باقی‌مانده میانگین ${toFaDigits(neededAvg.toFixed(2))} بگیری.`; el.className='gap-msg warn'; }
});

// ---------- calendar ----------
document.getElementById('addCal').addEventListener('click', async ()=>{
  const type = document.getElementById('calType').value;
  const date = document.getElementById('calDate').value;
  const title = document.getElementById('calTitle').value.trim() || type;
  if(!date){ alert('تاریخ رو وارد کن.'); return; }
  calEvents.push({ id:Date.now(), type, title, date });
  document.getElementById('calTitle').value='';
  await saveCal();
  renderCalendar();
  renderDashUpcoming();
});
function removeCal(id){ calEvents = calEvents.filter(e=>e.id!==id); saveCal(); renderCalendar(); renderDashUpcoming(); }
window.removeCal = removeCal;
function renderCalendar(){
  const el = document.getElementById('calList');
  if(!calEvents.length){ el.innerHTML='<div class="empty">هنوز رویدادی اضافه نکردی.</div>'; return; }
  const sorted = [...calEvents].sort((a,b)=>new Date(a.date)-new Date(b.date));
  el.innerHTML = sorted.map(e=>{
    const days = Math.ceil((new Date(e.date)-new Date())/86400000);
    const dLbl = days>=0 ? `${toFaDigits(days)} روز مانده` : 'گذشته';
    return `<div class="item"><div><div class="name">${e.title}</div><div class="meta">${e.type} · ${new Date(e.date).toLocaleDateString('fa-IR')} · ${dLbl}</div></div><button class="btn ghost" onclick="removeCal(${e.id})">حذف</button></div>`;
  }).join('');
}

// ---------- tasks ----------
function refreshCourseSelects(){
  const opts = '<option value="">— بدون درس —</option>' + courses.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('taskCourse').innerHTML = opts;
  document.getElementById('noteCourse').innerHTML = opts;
}
document.getElementById('addTask').addEventListener('click', async ()=>{
  const title = document.getElementById('taskTitle').value.trim();
  const courseId = document.getElementById('taskCourse').value;
  const deadline = document.getElementById('taskDeadline').value;
  const notesVal = document.getElementById('taskNotes').value.trim();
  if(!title || !deadline){ alert('عنوان و ددلاین رو وارد کن.'); return; }
  tasks.push({ id:Date.now(), title, courseId, deadline, notes:notesVal, done:false });
  document.getElementById('taskTitle').value='';
  document.getElementById('taskDeadline').value='';
  document.getElementById('taskNotes').value='';
  await saveTasks();
  renderTasks(); renderDashUpcoming();
});
function toggleTask(id){ const t=tasks.find(t=>t.id===id); if(t){ t.done=!t.done; saveTasks(); renderTasks(); } }
function removeTask(id){ tasks = tasks.filter(t=>t.id!==id); saveTasks(); renderTasks(); renderDashUpcoming(); }
window.toggleTask=toggleTask; window.removeTask=removeTask;
function renderTasks(){
  const el = document.getElementById('taskList');
  if(!tasks.length){ el.innerHTML='<div class="empty">تکلیفی ثبت نشده.</div>'; return; }
  const sorted = [...tasks].sort((a,b)=>new Date(a.deadline)-new Date(b.deadline));
  el.innerHTML = sorted.map(t=>{
    const course = courses.find(c=>c.id==t.courseId);
    const days = Math.ceil((new Date(t.deadline)-new Date())/86400000);
    const dLbl = t.done ? 'انجام‌شده' : (days<0 ? 'گذشته' : `${toFaDigits(days)} روز مانده`);
    return `<div class="item ${t.done?'done':''}">
      <div class="checkbox-row">
        <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${t.id})">
        <div><div class="name">${t.title}</div><div class="meta">${course?course.name+' · ':''}${new Date(t.deadline).toLocaleDateString('fa-IR')} · ${dLbl}</div></div>
      </div>
      <button class="btn ghost" onclick="removeTask(${t.id})">حذف</button>
    </div>`;
  }).join('');
}

// ---------- notes ----------
document.getElementById('addNote').addEventListener('click', async ()=>{
  const courseId = document.getElementById('noteCourse').value;
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  if(!title || !content){ alert('عنوان و لینک/متن رو وارد کن.'); return; }
  notes.push({ id:Date.now(), courseId, title, content, date:new Date().toISOString() });
  document.getElementById('noteTitle').value='';
  document.getElementById('noteContent').value='';
  await saveNotes();
  renderNotes();
});
function removeNote(id){ notes = notes.filter(n=>n.id!==id); saveNotes(); renderNotes(); }
window.removeNote = removeNote;
function renderNotes(){
  const el = document.getElementById('notesList');
  if(!notes.length){ el.innerHTML='<div class="empty">هنوز چیزی اضافه نکردی.</div>'; return; }
  const isUrl = s => /^https?:\/\//.test(s);
  el.innerHTML = notes.map(n=>{
    const course = courses.find(c=>c.id==n.courseId);
    const body = isUrl(n.content) ? `<a class="link-a" href="${n.content}" target="_blank" rel="noopener">${n.content}</a>` : `<div class="meta">${n.content}</div>`;
    return `<div class="item" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div class="name">${n.title}</div><div class="meta">${course?course.name:'بدون درس'}</div></div>
        <button class="btn ghost" onclick="removeNote(${n.id})">حذف</button>
      </div>
      <div style="margin-top:6px;">${body}</div>
    </div>`;
  }).join('');
}

// ---------- dashboard upcoming ----------
function renderDashUpcoming(){
  const el = document.getElementById('dashUpcoming');
  const now = new Date();
  const items = [];
  calEvents.forEach(e=>{ if(new Date(e.date)>=now) items.push({label:e.title, sub:e.type, date:e.date}); });
  tasks.filter(t=>!t.done).forEach(t=>{ if(new Date(t.deadline)>=now) items.push({label:t.title, sub:'تکلیف', date:t.deadline}); });
  courses.forEach(c=>{ if(c.exam && new Date(c.exam)>=now) items.push({label:c.name, sub:'امتحان', date:c.exam}); });
  items.sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(!items.length){ el.innerHTML='<div class="empty">چیزی برای نمایش نیست.</div>'; return; }
  el.innerHTML = items.slice(0,6).map(i=>{
    const days = Math.ceil((new Date(i.date)-now)/86400000);
    return `<div class="item"><div><div class="name">${i.label}</div><div class="meta">${i.sub} · ${new Date(i.date).toLocaleDateString('fa-IR')}</div></div><div class="badge">${toFaDigits(days)} روز</div></div>`;
  }).join('');
}

// ---------- countdown ----------
function renderCountdown(){
  const mainNum = document.getElementById('cdMain'), mainLbl = document.getElementById('cdMainLbl');
  const subNum = document.getElementById('cdSub'), subLbl = document.getElementById('cdSubLbl');
  const now = new Date();
  const nextExam = courses.filter(c=>c.exam && new Date(c.exam)>now).sort((a,b)=>new Date(a.exam)-new Date(b.exam))[0];

  if(settings.examPeriodStart){
    const periodStart = new Date(settings.examPeriodStart);
    if(now < periodStart){
      mainNum.textContent = toFaDigits(Math.ceil((periodStart-now)/86400000));
      mainLbl.textContent = 'روز تا شروع امتحانات';
    } else { mainNum.textContent = 'شروع شد'; mainLbl.textContent = 'بازه امتحانات'; }
  } else { mainNum.textContent = '--'; mainLbl.textContent = 'تاریخ شروع امتحانات را وارد کن'; }

  if(nextExam){
    subNum.textContent = toFaDigits(Math.ceil((new Date(nextExam.exam)-now)/86400000));
    subLbl.textContent = `تا امتحان ${nextExam.name}`;
  } else { subNum.textContent='--'; subLbl.textContent='امتحان بعدی ثبت نشده'; }
}

function renderReports(){
  document.getElementById('reportGrid').innerHTML = REPORTS.map(([code,title])=>`
    <div class="report-card"><div class="code">شماره ${toFaDigits(code)}</div><div class="title">${title}</div><div class="badge">در انتظار اتصال</div></div>
  `).join('');
}

function renderAll(){
  renderCourseList();
  renderWeekTable();
  renderExamList();
  renderDayChips();
  renderGradeInputs();
  renderGpa();
  renderCalendar();
  refreshCourseSelects();
  renderTasks();
  renderNotes();
  renderDashUpcoming();
  renderCountdown();
  renderReports();
}

loadAll();
setInterval(()=>{ renderCountdown(); renderDashUpcoming(); }, 60000);
