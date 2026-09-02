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
const JMONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const GRADE_COMPONENTS = [
  { key:'midterm',    label:'میان‌ترم',     defaultWeight:30 },
  { key:'final',      label:'پایان‌ترم',    defaultWeight:50 },
  { key:'project',    label:'پروژه',        defaultWeight:10 },
  { key:'attendance', label:'حضور و غیاب',  defaultWeight:10 },
];

let courses = [];
let settings = { examPeriodStart: null };
let calEvents = [];
let tasks = [];
let notes = [];
let profile = { name: '', major: '', photo: '' };
let dayPref = new Set();
let cSessions = [{ day: DAYS[0], time: '' }];   // جلسات درسِ در حال افزودن
let optionDraftSessions = {};                    // جلسات درافت برای «گزینه زمانی دیگر» هر درس، keyed by course id
let gradeDetailOpen = {};                        // کدوم دروس بخش «جزئیات نمره»شون بازه

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

// ---------- Jalali (Persian) calendar conversion ----------
function jdiv(a, b) { return Math.trunc(a / b); }
function jmod(a, b) { return a - Math.trunc(a / b) * b; }
function g2d(gy, gm, gd) {
  let jd = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4)
    + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408;
  jd = jd - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752;
  return jd;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = jdiv(jmod(j, 1461), 4) * 5 + 308;
  const gd = jdiv(jmod(i, 153), 5) + 1;
  const gm = jmod(jdiv(i, 153), 12) + 1;
  const gy = jdiv(j, 1461) - 100100 + jdiv(8 - gm, 6);
  return [gy, gm, gd];
}
function jalCal(jy) {
  const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4);
  if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + jdiv(jump, 33) * 33;
  let leap = jmod(jmod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  const gy = d2g(jdn)[0];
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) { jm = 1 + jdiv(k, 31); jd = jmod(k, 31) + 1; return [jy, jm, jd]; }
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + jdiv(k, 30);
  jd = jmod(k, 30) + 1;
  return [jy, jm, jd];
}
// jy,jm,jd (+ optional hh,mm) -> JS Date (local time)
function jalaliToDate(jy, jm, jd, hh, mm) {
  const [gy, gm, gd] = d2g(j2d(jy, jm, jd));
  return new Date(gy, gm - 1, gd, hh||0, mm||0);
}
function dateToJalali(date) {
  const [jy, jm, jd] = d2j(g2d(date.getFullYear(), date.getMonth()+1, date.getDate()));
  return { jy, jm, jd, hh: date.getHours(), mm: date.getMinutes() };
}

// ساخت یک گروه ورودی تاریخ شمسی (+ ساعت اختیاری) داخل یک کانتینر
function buildJalaliPicker(containerId, prefix, withTime){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = `
    <div class="grid3">
      <input type="number" id="${prefix}_y" placeholder="سال (مثلاً 1404)" inputmode="numeric">
      <select id="${prefix}_m">${JMONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select>
      <input type="number" id="${prefix}_d" placeholder="روز" min="1" max="31" inputmode="numeric">
    </div>
    ${withTime ? `<div class="grid2" style="margin-top:8px;">
      <input type="number" id="${prefix}_h" placeholder="ساعت (۰-۲۳)" min="0" max="23" inputmode="numeric">
      <input type="number" id="${prefix}_min" placeholder="دقیقه" min="0" max="59" inputmode="numeric">
    </div>` : ''}
  `;
}
function getJalaliDate(prefix, withTime){
  const y = parseInt(document.getElementById(prefix+'_y').value);
  const m = parseInt(document.getElementById(prefix+'_m').value);
  const d = parseInt(document.getElementById(prefix+'_d').value);
  if(!y || !m || !d) return null;
  const h = withTime ? (parseInt(document.getElementById(prefix+'_h').value)||0) : 0;
  const min = withTime ? (parseInt(document.getElementById(prefix+'_min').value)||0) : 0;
  try{ return jalaliToDate(y,m,d,h,min); }catch(e){ return null; }
}
function clearJalaliPicker(prefix, withTime){
  ['_y','_d'].forEach(s=>{ const e=document.getElementById(prefix+s); if(e) e.value=''; });
  if(withTime){ ['_h','_min'].forEach(s=>{ const e=document.getElementById(prefix+s); if(e) e.value=''; }); }
}
function setJalaliPickerFromDate(prefix, date, withTime){
  if(!date) return;
  const j = dateToJalali(date);
  document.getElementById(prefix+'_y').value = j.jy;
  document.getElementById(prefix+'_m').value = j.jm;
  document.getElementById(prefix+'_d').value = j.jd;
  if(withTime){
    document.getElementById(prefix+'_h').value = j.hh;
    document.getElementById(prefix+'_min').value = j.mm;
  }
}
function faDateStr(iso){
  if(!iso) return '';
  const d = new Date(iso);
  const j = dateToJalali(d);
  return `${toFaDigits(j.jd)} ${JMONTHS[j.jm-1]} ${toFaDigits(j.jy)}`;
}
function faDateTimeStr(iso){
  if(!iso) return '';
  const d = new Date(iso);
  const j = dateToJalali(d);
  const hh = String(j.hh).padStart(2,'0'), mm = String(j.mm).padStart(2,'0');
  return `${toFaDigits(j.jd)} ${JMONTHS[j.jm-1]} ${toFaDigits(j.jy)} ساعت ${toFaDigits(hh)}:${toFaDigits(mm)}`;
}

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
  profile = loadKey('adib:profile', { name:'', major:'', photo:'' });

  // migrate legacy option shapes:
  //  - very old: {day:'شنبه', time:'10-12'}
  //  - previous version: {days:['شنبه','دوشنبه'], time:'10-12'} (same time for all days)
  //  - current: {sessions:[{day,time}, ...]}
  courses.forEach(c=>{
    if(!c.options){
      c.options = [{ sessions: [{ day: c.day || DAYS[0], time: c.time || '' }] }];
      c.chosen = 0;
    }
    c.options.forEach(o=>{
      if(!o.sessions){
        if(o.days){ o.sessions = o.days.map(d=>({ day:d, time:o.time||'' })); }
        else if(o.day){ o.sessions = [{ day:o.day, time:o.time||'' }]; }
        else { o.sessions = [{ day:DAYS[0], time:'' }]; }
      }
      delete o.day; delete o.days; delete o.time;
    });
    if(c.chosen===undefined) c.chosen = 0;
    if(!c.breakdown){
      c.breakdown = {};
      GRADE_COMPONENTS.forEach(g=>{ c.breakdown[g.key] = { score:'', weight:g.defaultWeight }; });
    }
  });

  buildJalaliPicker('examPeriodPicker', 'examPeriod', false);
  if(settings.examPeriodStart) setJalaliPickerFromDate('examPeriod', new Date(settings.examPeriodStart), false);

  buildJalaliPicker('cExamPicker', 'cExam', true);
  buildJalaliPicker('calDatePicker', 'calDate', false);
  buildJalaliPicker('taskDeadlinePicker', 'taskDeadline', true);

  document.getElementById('profileName').value = profile.name || '';
  document.getElementById('profileMajor').value = profile.major || '';
  if(profile.photo) setPhotoPreview(profile.photo);

  renderAll();
  renderGreeting();
}
async function save(key, data){ try{ localStorage.setItem(key, JSON.stringify(data)); }catch(e){ console.error(e); } }
const saveCourses = ()=>save('adib:courses', courses);
const saveSettings = ()=>save('adib:settings', settings);
const saveCal = ()=>save('adib:calendar', calEvents);
const saveTasks = ()=>save('adib:tasks', tasks);
const saveNotes = ()=>save('adib:notes', notes);
const saveProfile = ()=>save('adib:profile', profile);

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
  const d = getJalaliDate('examPeriod', false);
  if(!d){ alert('تاریخ شمسی رو کامل وارد کن.'); return; }
  settings.examPeriodStart = d.toISOString();
  await saveSettings();
  renderCountdown();
});

// ---------- greeting ----------
function renderGreeting(){
  const hour = new Date().getHours();
  let greeting;
  if(hour >= 5 && hour < 12) greeting = 'صبح بخیر';
  else if(hour >= 12 && hour < 18) greeting = 'ظهر بخیر';
  else greeting = 'شب بخیر';
  const name = (profile.name || '').trim().split(' ')[0];
  document.getElementById('greetingLine').textContent = name ? `${greeting}، ${name}` : `${greeting} 👋`;
  document.getElementById('greetingSub').textContent = profile.major ? profile.major : 'دستیار دانشجویی گلستان';
}

// ---------- profile ----------
function setPhotoPreview(dataUrl){
  const img = document.getElementById('profilePhotoPreview');
  const placeholder = document.getElementById('profilePhotoPlaceholder');
  img.src = dataUrl; img.style.display='block'; placeholder.style.display='none';
  document.getElementById('avatarMark').style.background = `center/cover url(${dataUrl})`;
  document.getElementById('avatarMark').textContent = '';
}
document.getElementById('profilePhotoInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = new Image();
    img.onload = ()=>{
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      profile.photo = dataUrl;
      setPhotoPreview(dataUrl);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById('saveProfile').addEventListener('click', async ()=>{
  profile.name = document.getElementById('profileName').value.trim();
  profile.major = document.getElementById('profileMajor').value.trim();
  await saveProfile();
  renderGreeting();
  const msg = document.getElementById('profileSavedMsg');
  msg.innerHTML = '<div class="alert ok">پروفایل ذخیره شد.</div>';
  setTimeout(()=>{ msg.innerHTML=''; }, 2500);
});

// ---------- courses: session rows (add-course form) ----------
function renderSessionRows(){
  const el = document.getElementById('cSessionsList');
  el.innerHTML = cSessions.map((s,i)=>`
    <div class="grid2" style="margin-top:6px;align-items:center;">
      <select onchange="updateSessionDay(${i},this.value)">
        ${DAYS.map(d=>`<option ${d===s.day?'selected':''}>${d}</option>`).join('')}
      </select>
      <div style="display:flex;gap:6px;">
        <input style="flex:1;" placeholder="مثلاً 15-17" value="${s.time}" oninput="updateSessionTime(${i},this.value)">
        ${cSessions.length>1?`<button class="btn ghost" type="button" onclick="removeSessionRow(${i})">حذف</button>`:''}
      </div>
    </div>
  `).join('');
}
function updateSessionDay(i,val){ cSessions[i].day = val; }
function updateSessionTime(i,val){ cSessions[i].time = val; }
function removeSessionRow(i){ cSessions.splice(i,1); renderSessionRows(); }
window.updateSessionDay=updateSessionDay; window.updateSessionTime=updateSessionTime; window.removeSessionRow=removeSessionRow;
document.getElementById('addSessionRow').addEventListener('click', ()=>{
  cSessions.push({ day: DAYS[0], time: '' });
  renderSessionRows();
});

// ---------- courses: core ----------
function chosenSlot(c){ return c.options[c.chosen] || c.options[0]; }
function slotLabel(slot){
  return slot.sessions.map(s=>`${s.day} ${s.time||'—'}`).join('، ');
}
// چک تداخل: هر جلسه‌ی slot جدید رو با هر جلسه‌ی هر درس دیگه مقایسه می‌کنه
function checkConflict(sessions, excludeId){
  const valid = sessions.filter(s=>parseTime(s.time));
  if(!valid.length) return null;
  for(const c of courses){
    if(c.id===excludeId) continue;
    const slot = chosenSlot(c);
    for(const os of slot.sessions){
      const ot = parseTime(os.time);
      if(!ot) continue;
      for(const ns of valid){
        const nt = parseTime(ns.time);
        if(ns.day===os.day && overlap(ot.start,ot.end,nt.start,nt.end)) return c;
      }
    }
  }
  return null;
}

document.getElementById('addCourse').addEventListener('click', async ()=>{
  const name = document.getElementById('cName').value.trim();
  const credit = parseFloat(document.getElementById('cCredit').value);
  const term = document.getElementById('cTerm').value.trim();
  const examDate = getJalaliDate('cExam', true);
  const warnEl = document.getElementById('conflictWarning');
  if(!name || !credit){ alert('نام درس و تعداد واحد رو وارد کن.'); return; }
  const sessions = cSessions.filter(s=>s.time.trim());
  if(!sessions.length){ alert('حداقل یک جلسه (روز و ساعت) وارد کن.'); return; }

  const conflict = checkConflict(sessions, null);
  warnEl.innerHTML='';
  if(conflict){
    const cs = chosenSlot(conflict);
    warnEl.innerHTML = `<div class="alert">تداخل زمانی با «${conflict.name}» (${slotLabel(cs)}). درس اضافه شد ولی بهتره روز/ساعت رو اصلاح کنی یا گزینه زمانی دیگه‌ای اضافه کنی.</div>`;
  }

  const breakdown = {};
  GRADE_COMPONENTS.forEach(g=>{ breakdown[g.key] = { score:'', weight:g.defaultWeight }; });

  courses.push({
    id: Date.now(), name, credit, term,
    exam: examDate ? examDate.toISOString() : '',
    grade: null, breakdown,
    options:[{ sessions }], chosen:0
  });
  ['cName','cCredit','cTerm'].forEach(id=>document.getElementById(id).value='');
  cSessions = [{ day: DAYS[0], time: '' }];
  renderSessionRows();
  clearJalaliPicker('cExam', true);
  await saveCourses();
  renderAll();
});

function removeCourse(id){ courses = courses.filter(c=>c.id!==id); saveCourses(); renderAll(); }
function setGrade(id, val){ const c=courses.find(c=>c.id===id); if(c) c.grade = val===''?null:parseFloat(val); saveCourses(); renderGpa(); }
function chooseOption(cid, idx){ const c=courses.find(c=>c.id===cid); if(c){ c.chosen = idx; saveCourses(); renderAll(); } }

function toggleOptionDraftDay(cid){
  if(!optionDraftSessions[cid]) optionDraftSessions[cid] = [{ day: DAYS[0], time: '' }];
}
function addDraftSessionRow(cid){
  toggleOptionDraftDay(cid);
  optionDraftSessions[cid].push({ day: DAYS[0], time: '' });
  renderCourseList();
  document.getElementById('sub_'+cid)?.classList.add('open');
}
function updateDraftSession(cid, i, field, val){
  optionDraftSessions[cid][i][field] = val;
}
function removeDraftSessionRow(cid, i){
  optionDraftSessions[cid].splice(i,1);
  renderCourseList();
  document.getElementById('sub_'+cid)?.classList.add('open');
}
window.addDraftSessionRow=addDraftSessionRow; window.updateDraftSession=updateDraftSession; window.removeDraftSessionRow=removeDraftSessionRow;

function addOption(cid){
  toggleOptionDraftDay(cid);
  const sessions = optionDraftSessions[cid].filter(s=>s.time && s.time.trim());
  if(!sessions.length){ alert('حداقل یک جلسه با روز و ساعت وارد کن.'); return; }
  const c = courses.find(c=>c.id===cid);
  c.options.push({ sessions });
  delete optionDraftSessions[cid];
  saveCourses(); renderAll();
  document.getElementById('sub_'+cid)?.classList.add('open');
}
function toggleSub(id){ document.getElementById(id).classList.toggle('open'); }
window.removeCourse=removeCourse; window.setGrade=setGrade; window.chooseOption=chooseOption;
window.addOption=addOption; window.toggleSub=toggleSub;

function renderCourseList(){
  const el = document.getElementById('courseList');
  if(!courses.length){ el.innerHTML='<div class="empty">هنوز درسی اضافه نکردی.</div>'; return; }
  el.innerHTML = courses.map(c=>{
    const slot = chosenSlot(c);
    const conflict = checkConflict(slot.sessions, c.id);
    const optsHtml = c.options.map((o,i)=>`
      <label class="opt-row">
        <input type="radio" name="opt_${c.id}" ${i===c.chosen?'checked':''} onchange="chooseOption(${c.id},${i})">
        <span>${slotLabel(o)}</span>
      </label>`).join('');
    if(!optionDraftSessions[c.id]) optionDraftSessions[c.id] = [{ day: DAYS[0], time: '' }];
    const draftRows = optionDraftSessions[c.id].map((s,i)=>`
      <div class="grid2" style="margin-top:6px;">
        <select onchange="updateDraftSession(${c.id},${i},'day',this.value)">
          ${DAYS.map(d=>`<option ${d===s.day?'selected':''}>${d}</option>`).join('')}
        </select>
        <div style="display:flex;gap:6px;">
          <input style="flex:1;" placeholder="مثلاً 14-16" value="${s.time}" oninput="updateDraftSession(${c.id},${i},'time',this.value)">
          ${optionDraftSessions[c.id].length>1?`<button class="btn ghost" type="button" onclick="removeDraftSessionRow(${c.id},${i})">حذف</button>`:''}
        </div>
      </div>`).join('');
    return `
    <div class="item" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="name">${c.name}${c.term?` <span style="color:var(--muted);font-weight:400;font-size:11px;">· ${c.term}</span>`:''}</div>
          <div class="meta">${slotLabel(slot)} · ${toFaDigits(c.credit)} واحد</div>
          ${c.exam?`<div class="meta">امتحان: ${faDateTimeStr(c.exam)}</div>`:''}
          ${conflict?`<div class="meta" style="color:var(--rose);">تداخل با ${conflict.name}</div>`:''}
        </div>
        <button class="btn ghost" onclick="removeCourse(${c.id})">حذف</button>
      </div>
      <span class="toggle-link" onclick="toggleSub('sub_${c.id}')">گزینه‌های زمانی (${toFaDigits(c.options.length)})</span>
      <div class="subform" id="sub_${c.id}">
        ${optsHtml}
        <div style="margin-top:8px;font-size:11.5px;color:var(--muted);">افزودن گزینه زمانی جدید (هر جلسه می‌تونه ساعت جدا داشته باشه):</div>
        ${draftRows}
        <button class="btn small secondary" type="button" onclick="addDraftSessionRow(${c.id})">+ جلسه دیگر</button>
        <button class="btn small" onclick="addOption(${c.id})">افزودن گزینه</button>
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
        return s.sessions.some(ses=>{
          if(ses.day!==d) return false;
          const t = parseTime(ses.time);
          return t && Math.floor(t.start)===h;
        });
      });
      let cellHtml = '';
      if(match){
        const s = chosenSlot(match);
        const ses = s.sessions.find(x=>x.day===d && parseTime(x.time) && Math.floor(parseTime(x.time).start)===h);
        const conflict = checkConflict(s.sessions, match.id);
        cellHtml = `<div class="slot ${conflict?'conflict':''}">${match.name}<br>${ses.time}</div>`;
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
  el.innerHTML = withExam.map(c=>`<div class="item"><div><div class="name">${c.name}</div><div class="meta">${faDateTimeStr(c.exam)}</div></div></div>`).join('');
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
  const list = courses.filter(c=>c.options.some(o=>o.sessions.some(s=>parseTime(s.time))));
  let best = null, bestScore = Infinity;
  function backtrack(idx, assignment, used){
    if(idx===list.length){
      const score = assignment.reduce((s,oi,i)=>{
        const sessions = list[i].options[oi].sessions;
        const hit = sessions.some(ses=>prefs.includes(ses.day));
        return s + (hit?1:0);
      }, 0);
      if(score < bestScore){ bestScore = score; best = assignment.slice(); }
      return;
    }
    const c = list[idx];
    for(let oi=0; oi<c.options.length; oi++){
      const opt = c.options[oi];
      const validSessions = opt.sessions.filter(s=>parseTime(s.time));
      if(!validSessions.length) continue;
      let conflict = false;
      for(const os of validSessions){
        const ot = parseTime(os.time);
        if(used.some(u=>u.day===os.day && overlap(u.start,u.end,ot.start,ot.end))){ conflict=true; break; }
      }
      if(conflict) continue;
      const pushed = validSessions.map(s=>{ const t=parseTime(s.time); return {day:s.day,start:t.start,end:t.end}; });
      used.push(...pushed);
      assignment.push(oi);
      backtrack(idx+1, assignment, used);
      assignment.pop();
      pushed.forEach(()=>used.pop());
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
function computeBreakdown(c){
  const parts = GRADE_COMPONENTS.map(g=>{
    const b = c.breakdown[g.key];
    return { ...g, score: parseFloat(b.score), weight: parseFloat(b.weight) || 0 };
  });
  const usable = parts.filter(p=>!isNaN(p.score));
  const totalWeight = usable.reduce((s,p)=>s+p.weight,0);
  const weighted = usable.reduce((s,p)=>s+p.score*p.weight,0);
  const final = totalWeight ? weighted/totalWeight : null;
  return { parts, final, totalWeight };
}
function updateBreakdown(cid, key, field, val){
  const c = courses.find(c=>c.id===cid);
  if(!c) return;
  c.breakdown[key][field] = val;
  saveCourses();
  renderGradeInputs();
}
function toggleGradeDetail(cid){
  gradeDetailOpen[cid] = !gradeDetailOpen[cid];
  renderGradeInputs();
}
function applyBreakdown(cid){
  const c = courses.find(c=>c.id===cid);
  if(!c) return;
  const { final } = computeBreakdown(c);
  if(final===null){ alert('حداقل یکی از نمره‌ها رو وارد کن.'); return; }
  c.grade = Math.round(final*100)/100;
  saveCourses();
  renderGradeInputs();
  renderGpa();
}
window.updateBreakdown=updateBreakdown; window.toggleGradeDetail=toggleGradeDetail; window.applyBreakdown=applyBreakdown;

function renderGradeInputs(){
  const el = document.getElementById('gradeInputs');
  if(!courses.length){ el.innerHTML='<div class="empty">اول از بخش «انتخاب واحد» درس اضافه کن.</div>'; return; }
  el.innerHTML = courses.map(c=>{
    const { parts, final } = computeBreakdown(c);
    const open = !!gradeDetailOpen[c.id];
    const rows = parts.map(p=>`
      <div class="grid2" style="margin-top:6px;align-items:center;">
        <div style="font-size:12px;color:var(--muted);">${p.label} <span style="opacity:.7;">(وزن ${toFaDigits(p.weight)}%)</span></div>
        <div style="display:flex;gap:6px;">
          <input type="number" min="0" max="20" step="0.25" style="flex:1;" placeholder="نمره از ۲۰" value="${p.score >= 0 && !isNaN(p.score) ? p.score : ''}"
            onchange="updateBreakdown(${c.id},'${p.key}','score',this.value)">
          <input type="number" min="0" max="100" style="width:70px;" value="${p.weight}"
            onchange="updateBreakdown(${c.id},'${p.key}','weight',this.value)">
        </div>
      </div>`).join('');
    return `
    <div class="item" style="display:block;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><div class="name">${c.name}</div><div class="meta">${c.term||'بدون ترم'} · ${toFaDigits(c.credit)} واحد</div></div>
        <input class="grade-input" type="number" min="0" max="20" step="0.25" value="${c.grade ?? ''}" placeholder="نمره" onchange="setGrade(${c.id}, this.value)">
      </div>
      <span class="toggle-link" onclick="toggleGradeDetail(${c.id})">جزئیات نمره (میان‌ترم، پایان‌ترم، پروژه، حضور و غیاب)</span>
      <div class="subform ${open?'open':''}">
        ${rows}
        <div class="gap-msg ${final!==null?'good':''}" style="margin-top:10px;">
          ${final!==null ? `نمره محاسبه‌شده: ${toFaDigits(final.toFixed(2))} از ۲۰` : 'هنوز هیچ نمره‌ای وارد نشده.'}
        </div>
        <button class="btn small secondary" onclick="applyBreakdown(${c.id})">استفاده به‌عنوان نمره نهایی درس</button>
      </div>
    </div>`;
  }).join('');
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
  const d = getJalaliDate('calDate', false);
  const title = document.getElementById('calTitle').value.trim() || type;
  if(!d){ alert('تاریخ شمسی رو کامل وارد کن.'); return; }
  calEvents.push({ id:Date.now(), type, title, date: d.toISOString() });
  document.getElementById('calTitle').value='';
  clearJalaliPicker('calDate', false);
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
    return `<div class="item"><div><div class="name">${e.title}</div><div class="meta">${e.type} · ${faDateStr(e.date)} · ${dLbl}</div></div><button class="btn ghost" onclick="removeCal(${e.id})">حذف</button></div>`;
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
  const d = getJalaliDate('taskDeadline', true);
  const notesVal = document.getElementById('taskNotes').value.trim();
  if(!title || !d){ alert('عنوان و ددلاین رو کامل وارد کن.'); return; }
  tasks.push({ id:Date.now(), title, courseId, deadline: d.toISOString(), notes:notesVal, done:false });
  document.getElementById('taskTitle').value='';
  document.getElementById('taskNotes').value='';
  clearJalaliPicker('taskDeadline', true);
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
        <div><div class="name">${t.title}</div><div class="meta">${course?course.name+' · ':''}${faDateStr(t.deadline)} · ${dLbl}</div></div>
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
    return `<div class="item"><div><div class="name">${i.label}</div><div class="meta">${i.sub} · ${faDateStr(i.date)}</div></div><div class="badge">${toFaDigits(days)} روز</div></div>`;
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
  renderSessionRows();
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
setInterval(()=>{ renderCountdown(); renderDashUpcoming(); renderGreeting(); }, 60000);
