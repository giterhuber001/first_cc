// ── API ──
const notesAPI = window.notesAPI || window.api;

// ── State ──
let currentDate = '';
let notes = [];
let activeFilter = null;
let lastDeleted = null;
let currentTab = 'notes';
let calDisplayYear, calDisplayMonth;
let allMonths = []; // { year, month, dayCount, days }

// ── DOM ──
const $ = (s) => document.querySelector(s);
const dateDisplay = $('#date-display');
const noteInput = $('#note-input');
const liveTime = $('#live-time');
const noteCount = $('#note-count');
const notesGrid = $('#notes-grid');
const searchInput = $('#search-input');
const activeFilterEl = $('#active-filter');
const toastEl = $('#toast');
const sheetOverlay = $('#sheet-overlay');
const sheetContent = $('#sheet-content');
const tabNotes = $('#tab-notes');
const tabCalendar = $('#tab-calendar');
const calGridFull = $('#calendar-grid-full');
const calTitleLarge = $('#cal-title-large');
const calDayList = $('#cal-day-list');
let sheetNote = null;

// ── Helpers ──
function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 60%)`;
}
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDisplay(ds) { const [y,m,d]=ds.split('-'); return `${y}年${parseInt(m)}月${parseInt(d)}日`; }
function getToday() { return toDateStr(new Date()); }
function shiftDate(ds, delta) { const [y,m,d]=ds.split('-').map(Number); return toDateStr(new Date(y,m-1,d+delta)); }
function isToday(ds) { return ds === getToday(); }
function firstChar(text) { const c=text.replace(/[^\w一-鿿]/g,'').trim(); return c?c[0]:text.trim()[0]||'·'; }
function escapeHtml(str) { const d=document.createElement('div');d.textContent=str;return d.innerHTML; }
function highlightText(text,term) {
  if(!term) return escapeHtml(text);
  const e=escapeHtml(text),p=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return e.replace(new RegExp(`(${p})`,'gi'),'<mark>$1</mark>');
}

// ── Live time ──
setInterval(()=>{const n=new Date();liveTime.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;},10000);
(function(){const n=new Date();liveTime.textContent=`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;})();

// ── Toast ──
let toastTimer=null;
function showToast(msg,label,fn){
  if(toastTimer)clearTimeout(toastTimer);
  toastEl.innerHTML=msg;
  if(label&&fn){const b=document.createElement('button');b.className='toast-action';b.textContent=label;b.onclick=()=>{fn();hideToast();};toastEl.appendChild(b);}
  toastEl.classList.add('visible');toastTimer=setTimeout(hideToast,4000);
}
function hideToast(){toastEl.classList.remove('visible');if(toastTimer)clearTimeout(toastTimer);}

// ── Filtered notes ──
function getFilteredNotes(){
  let r=activeFilter?notes.filter(n=>n.tags.includes(activeFilter)):notes;
  const t=searchInput.value.trim().toLowerCase();
  if(t)r=r.filter(n=>n.text.toLowerCase().includes(t)||n.tags.some(x=>x.toLowerCase().includes(t)));
  return r;
}

// ── Tab switching ──
function switchTab(tab){
  currentTab=tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  tabNotes.style.display=tab==='notes'?'':'none';
  tabCalendar.style.display=tab==='calendar'?'':'none';
  if(tab==='calendar') renderFullCalendar();
  if(tab==='notes') noteInput.focus();
}

document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click',()=>switchTab(b.dataset.tab));
});

// ── Render notes grid ──
function renderNotes(){
  notesGrid.innerHTML='';
  const filtered=getFilteredNotes();
  const st=searchInput.value.trim().toLowerCase();
  if(notes.length===0){
    notesGrid.innerHTML=`<div class="empty-state"><div class="empty-icon">${isToday(currentDate)?'✍️':'📖'}</div><div>${isToday(currentDate)?'今天还没有记录':'这一天没有记录'}</div><div class="empty-hint">${isToday(currentDate)?'在上方写点东西，Enter 保存':'点"今天"回到今天编写'}</div></div>`;
  }else if(filtered.length===0){
    notesGrid.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div>没有匹配的笔记</div></div>';
  }
  filtered.forEach(n=>{
    const card=document.createElement('div');
    card.className='note-widget';
    card.innerHTML=`
      <div class="widget-avatar" style="background:${hashColor(n.text)}">${escapeHtml(firstChar(n.text))}</div>
      <div class="widget-content">
        <div class="widget-preview">${highlightText(n.text.length>60?n.text.slice(0,60)+'...':n.text, st)}</div>
        <div class="widget-meta">
          <span class="widget-time">${n.time}</span>
          <div class="widget-tag-dots">${n.tags.map(t=>`<span class="widget-tag-dot" style="background:${hashColor(t)}" title="#${escapeHtml(t)}"></span>`).join('')}</div>
        </div>
      </div>`;
    card.addEventListener('click',()=>openSheet(n));
    card.querySelectorAll('.widget-tag-dot').forEach(dot=>{
      dot.addEventListener('click',e=>{e.stopPropagation();const t=dot.title.slice(1);setFilter(t===activeFilter?null:t);});
    });
    notesGrid.appendChild(card);
  });
  const prefix=isToday(currentDate)?'今天':'这一天';
  noteCount.textContent=notes.length===0?'还没有记录':`${prefix}已有 ${notes.length} 条记录`;
}

// ── Bottom Sheet ──
function openSheet(note){
  sheetNote=note;
  sheetContent.innerHTML=`
    <div class="sheet-header">
      <span class="sheet-time">${note.time}</span>
      <div class="sheet-actions">
        ${isToday(currentDate)?'<button class="sheet-btn edit-btn" title="编辑">✎</button><button class="sheet-btn delete-btn" title="删除">🗑</button>':''}
        <button class="sheet-btn close-btn" title="关闭">✕</button>
      </div>
    </div>
    <div class="sheet-body">${escapeHtml(note.text)}</div>
    <div class="sheet-tags">${note.tags.map(t=>`<span class="tag-pill" style="background:${hashColor(t)}">#${escapeHtml(t)}</span>`).join('')}</div>`;
  sheetContent.querySelector('.close-btn')?.addEventListener('click',closeSheet);
  sheetContent.querySelector('.edit-btn')?.addEventListener('click',startEdit);
  sheetContent.querySelector('.delete-btn')?.addEventListener('click',()=>{const nt=sheetNote;closeSheet();deleteNoteByIdx(nt);});
  sheetContent.querySelectorAll('.tag-pill').forEach(p=>{p.addEventListener('click',()=>{closeSheet();setFilter(p.textContent.slice(1));});});
  sheetOverlay.style.display='flex';
}

function closeSheet(){
  sheetOverlay.classList.add('closing');
  setTimeout(()=>{sheetOverlay.style.display='none';sheetOverlay.classList.remove('closing');sheetNote=null;},150);
}
sheetOverlay.addEventListener('click',e=>{if(e.target===sheetOverlay)closeSheet();});

function startEdit(){
  if(!sheetNote)return;
  const orig=sheetNote.text+' '+sheetNote.tags.map(t=>'#'+t).join(' ');
  const body=sheetContent.querySelector('.sheet-body');
  body.innerHTML=`<textarea class="edit-textarea">${escapeHtml(orig.trim())}</textarea>`;
  const ta=body.querySelector('textarea');
  ta.focus();ta.setSelectionRange(0,sheetNote.text.length);
  async function commit(){
    const raw=ta.value.trim();
    if(!raw){closeSheet();return;}
    const updated=await notesAPI.updateNote(currentDate,sheetNote.index,raw);
    if(updated){const idx=notes.findIndex(n=>n.index===sheetNote.index);if(idx!==-1)notes[idx]=updated;sheetNote=updated;}
    renderNotes();openSheet(updated);
  }
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();commit();}if(e.key==='Escape'){e.preventDefault();openSheet(sheetNote);}});
}

// ── Delete ──
async function deleteNoteByIdx(note){
  const idx=notes.findIndex(n=>n.index===note.index);
  if(idx===-1)return;
  const removed=notes[idx];
  const filtered=getFilteredNotes();
  const cIdx=filtered.findIndex(n=>n.index===note.index);
  if(cIdx!==-1){const cards=notesGrid.querySelectorAll('.note-widget');if(cards[cIdx])cards[cIdx].classList.add('removing');}
  setTimeout(async()=>{
    notes.splice(idx,1);
    await notesAPI.deleteNote(currentDate,note.index);
    renderNotes();lastDeleted={note:removed,date:currentDate};
    showToast('已删除','撤销',async()=>{await notesAPI.addNote(lastDeleted.date,lastDeleted.note.text);notes=await notesAPI.getNotes(currentDate);renderNotes();});
  },150);
}

// ── Filter ──
function setFilter(tag){
  activeFilter=tag;
  if(tag){activeFilterEl.innerHTML=`<span class="filter-tag" style="background:${hashColor(tag)}">#${escapeHtml(tag)} <span class="filter-clear">✕</span></span>`;activeFilterEl.querySelector('.filter-clear').addEventListener('click',()=>setFilter(null));}
  else activeFilterEl.innerHTML='';
  renderNotes();
}

// ── Load date ──
function updateInputState(){
  const today=isToday(currentDate);
  noteInput.disabled=!today;
  noteInput.placeholder=today?'记下此刻的想法...':'只能查看历史记录';
  $('#input-zone').classList.toggle('readonly',!today);
}
async function loadDate(ds){
  currentDate=ds;dateDisplay.textContent=formatDisplay(ds);
  notes=await notesAPI.getNotes(ds);
  activeFilter=null;activeFilterEl.innerHTML='';searchInput.value='';
  updateInputState();renderNotes();
  if(isToday(ds))noteInput.focus();
}

// ── Add note ──
async function addNote(){
  const text=noteInput.value.trim();
  if(!text)return;
  const note=await notesAPI.addNote(currentDate,text);
  if(note){notes.push(note);renderNotes();}
  noteInput.value='';noteInput.style.height='auto';noteInput.focus();
}

// ── Full Calendar ──
async function renderFullCalendar(){
  const fy=calDisplayYear||parseInt(currentDate.split('-')[0]);
  const fm=calDisplayMonth||parseInt(currentDate.split('-')[1]);
  calDisplayYear=fy;calDisplayMonth=fm;
  calTitleLarge.textContent=`${fy}年${fm}月`;
  const firstDay=new Date(fy,fm-1,1),lastDay=new Date(fy,fm,0);
  const startDow=firstDay.getDay(),daysInMonth=lastDay.getDate(),todayStr=getToday();
  calGridFull.innerHTML='';
  ['日','一','二','三','四','五','六'].forEach(h=>{const c=document.createElement('div');c.className='cal-header';c.textContent=h;calGridFull.appendChild(c);});
  for(let i=0;i<startDow;i++)calGridFull.appendChild(document.createElement('div'));
  for(let d=1;d<=daysInMonth;d++){
    const cell=document.createElement('div');
    cell.className='cal-day-cell';cell.textContent=d;
    const ds=`${fy}-${String(fm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if(ds===currentDate)cell.classList.add('selected');
    if(ds===todayStr)cell.classList.add('today');
    cell.addEventListener('click',()=>{switchTab('notes');loadDate(ds);});
    calGridFull.appendChild(cell);
  }
  loadCalendarDotsAndList();
}
async function loadCalendarDotsAndList(){
  try{
    allMonths=await notesAPI.listMonths();
    const tm=allMonths.find(m=>m.year===calDisplayYear&&m.month===calDisplayMonth);
    calGridFull.querySelectorAll('.cal-day-cell').forEach(cell=>{
      const ds=`${calDisplayYear}-${String(calDisplayMonth).padStart(2,'0')}-${String(parseInt(cell.textContent)).padStart(2,'0')}`;
      cell.classList.toggle('has-notes',tm&&tm.days.includes(ds));
    });
    // Day list below calendar
    if(tm&&tm.days.length>0){
      calDayList.innerHTML=`<div style="padding:6px 0 4px;font-size:13px;color:var(--text-muted);font-weight:600;">有笔记的日期</div>`;
      tm.days.sort().reverse().forEach(ds=>{
        const div=document.createElement('div');
        div.className='cal-day-preview';
        div.innerHTML=`<span class="preview-date">${ds}</span><span class="preview-count">→</span>`;
        div.addEventListener('click',()=>{switchTab('notes');loadDate(ds);});
        calDayList.appendChild(div);
      });
    }else{calDayList.innerHTML='';}
  }catch(_){}
}
$('#cal-prev-month').addEventListener('click',()=>{if(calDisplayMonth===1){calDisplayMonth=12;calDisplayYear--;}else calDisplayMonth--;renderFullCalendar();});
$('#cal-next-month').addEventListener('click',()=>{if(calDisplayMonth===12){calDisplayMonth=1;calDisplayYear++;}else calDisplayMonth++;renderFullCalendar();});

// ── Events ──
noteInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();addNote();}});
noteInput.addEventListener('input',()=>{noteInput.style.height='auto';noteInput.style.height=Math.min(noteInput.scrollHeight,80)+'px';});
searchInput.addEventListener('input',()=>renderNotes());
$('#btn-prev').addEventListener('click',()=>loadDate(shiftDate(currentDate,-1)));
$('#btn-next').addEventListener('click',()=>loadDate(shiftDate(currentDate,1)));
$('#btn-today').addEventListener('click',()=>loadDate(getToday()));

document.addEventListener('keydown',e=>{
  if(sheetOverlay.style.display==='flex'){if(e.key==='Escape')closeSheet();return;}
  if(e.ctrlKey&&e.key==='ArrowLeft'){e.preventDefault();loadDate(shiftDate(currentDate,-1));}
  if(e.ctrlKey&&e.key==='ArrowRight'){e.preventDefault();loadDate(shiftDate(currentDate,1));}
  if(e.ctrlKey&&e.key==='t'){e.preventDefault();loadDate(getToday());}
  if(e.ctrlKey&&e.key==='z'&&lastDeleted){e.preventDefault();notesAPI.addNote(lastDeleted.date,lastDeleted.note.text);loadDate(currentDate);lastDeleted=null;hideToast();}
  if(e.key==='Escape'){noteInput.value='';noteInput.style.height='auto';setFilter(null);searchInput.value='';renderNotes();noteInput.focus();}
  if(e.ctrlKey&&e.key==='f'){e.preventDefault();searchInput.focus();}
});

// ── Init ──
calDisplayYear=parseInt(getToday().split('-')[0]);
calDisplayMonth=parseInt(getToday().split('-')[1]);
loadDate(getToday());
