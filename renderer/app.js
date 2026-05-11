// Auto-detect API: Electron IPC bridge or HTTP (PWA)
const notesAPI = (typeof window !== 'undefined' && window.notesAPI) ? window.notesAPI : window.api;

// ── State ──
let currentDate = '';
let notes = [];
let activeFilter = null;
let lastDeleted = null;
let modalNote = null;

// ── DOM refs ──
const dateDisplay = document.getElementById('date-display');
const noteInput = document.getElementById('note-input');
const liveTime = document.getElementById('live-time');
const noteCount = document.getElementById('note-count');
const notesGrid = document.getElementById('notes-grid');
const searchInput = document.getElementById('search-input');
const activeFilterEl = document.getElementById('active-filter');
const toastEl = document.getElementById('toast');
const calendarPanel = document.getElementById('calendar-panel');
const calendarGrid = document.getElementById('calendar-grid');
const calendarTitle = document.getElementById('calendar-title');
const modalOverlay = document.getElementById('modal-overlay');
const modalCard = document.getElementById('modal-card');
const modalTime = document.querySelector('.modal-time');
const modalBody = document.querySelector('.modal-body');
const modalTags = document.querySelector('.modal-tags');

// ── Tag colors ──
function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 60%)`;
}

// ── Date helpers ──
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}
function getToday() { return toDateStr(new Date()); }
function shiftDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + delta));
}

// ── Live time ──
function updateLiveTime() {
  const now = new Date();
  liveTime.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ── Toast ──
let toastTimer = null;
function showToast(msg, actionLabel, actionFn) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.innerHTML = msg;
  if (actionLabel && actionFn) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { actionFn(); hideToast(); });
    toastEl.appendChild(btn);
  }
  toastEl.classList.add('visible');
  toastTimer = setTimeout(hideToast, 4000);
}
function hideToast() {
  toastEl.classList.remove('visible');
  if (toastTimer) clearTimeout(toastTimer);
}

// ── Filtered notes ──
function getFilteredNotes() {
  let result = activeFilter ? notes.filter((n) => n.tags.includes(activeFilter)) : notes;
  const term = searchInput.value.trim().toLowerCase();
  if (term) result = result.filter((n) => n.text.toLowerCase().includes(term) || n.tags.some((t) => t.toLowerCase().includes(term)));
  return result;
}

// ── Highlight ──
function highlightText(text, term) {
  if (!term) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
  const d = document.createElement('div'); d.textContent = text;
  const escaped = d.innerHTML;
  const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

// ── Get first meaningful character ──
function firstChar(text) {
  const cleaned = text.replace(/[^\w一-鿿]/g, '').trim();
  return cleaned ? cleaned[0] : text.trim()[0] || '·';
}

// ── Render grid ──
function renderNotes() {
  notesGrid.innerHTML = '';
  const filtered = getFilteredNotes();
  const searchTerm = searchInput.value.trim().toLowerCase();

  if (notes.length === 0) {
    const emptyMsg = isToday(currentDate) ? '今天还没有记录' : '这一天没有记录';
    const emptyHint = isToday(currentDate) ? '在上方写点东西，Enter 保存' : '点击"今天"回到今天编写';
    notesGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">${isToday(currentDate) ? '✍️' : '📖'}</div><div>${emptyMsg}</div><div class="empty-hint">${emptyHint}</div></div>`;
  } else if (filtered.length === 0) {
    notesGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div>没有匹配的笔记</div></div>';
  }

  filtered.forEach((n, idx) => {
    const card = document.createElement('div');
    card.className = 'note-widget';

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'widget-avatar';
    avatar.style.backgroundColor = hashColor(n.text);
    avatar.textContent = firstChar(n.text);

    // Content
    const content = document.createElement('div');
    content.className = 'widget-content';

    const preview = document.createElement('div');
    preview.className = 'widget-preview';
    const ptext = n.text.length > 60 ? n.text.slice(0, 60) + '...' : n.text;
    preview.innerHTML = highlightText(ptext, searchTerm);

    const meta = document.createElement('div');
    meta.className = 'widget-meta';
    const timeEl = document.createElement('span');
    timeEl.className = 'widget-time';
    timeEl.textContent = n.time;

    const dots = document.createElement('div');
    dots.className = 'widget-tag-dots';
    n.tags.forEach((t) => {
      const dot = document.createElement('span');
      dot.className = 'widget-tag-dot';
      dot.style.backgroundColor = hashColor(t);
      dot.title = `#${t}`;
      dot.addEventListener('click', (e) => { e.stopPropagation(); setFilter(t === activeFilter ? null : t); });
      dots.appendChild(dot);
    });

    meta.appendChild(timeEl);
    meta.appendChild(dots);
    content.appendChild(preview);
    content.appendChild(meta);

    card.appendChild(avatar);
    card.appendChild(content);

    card.addEventListener('click', () => openModal(n));

    notesGrid.appendChild(card);
  });

  const prefix = isToday(currentDate) ? '今天' : '这一天';
  noteCount.textContent = notes.length === 0 ? '还没有记录' : `${prefix}已有 ${notes.length} 条记录`;
}

// ── Modal ──
function openModal(note) {
  modalNote = note;
  modalTime.textContent = note.time;
  modalBody.className = 'modal-body';
  modalBody.innerHTML = note.text;
  modalTags.innerHTML = '';
  note.tags.forEach((t) => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.style.backgroundColor = hashColor(t);
    pill.textContent = `#${t}`;
    pill.addEventListener('click', () => { closeModal(); setFilter(t); });
    modalTags.appendChild(pill);
  });
  // Show/hide edit/delete buttons based on read-only state
  const editBtn = document.querySelector('.modal-btn.edit-btn');
  const delBtn = document.querySelector('.modal-btn.delete-btn');
  const canEdit = isToday(currentDate);
  editBtn.style.display = canEdit ? '' : 'none';
  delBtn.style.display = canEdit ? '' : 'none';
  modalOverlay.style.display = 'flex';
}

function closeModal() {
  modalOverlay.classList.add('closing');
  setTimeout(() => {
    modalOverlay.style.display = 'none';
    modalOverlay.classList.remove('closing');
  }, 120);
  modalNote = null;
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Modal edit button
document.querySelector('.modal-btn.edit-btn').addEventListener('click', () => {
  if (!modalNote) return;
  const original = modalNote.text + ' ' + modalNote.tags.map((t) => `#${t}`).join(' ');
  modalBody.className = 'modal-body edit-mode';
  const ta = document.createElement('textarea');
  ta.className = 'edit-textarea';
  ta.value = original.trim();
  modalBody.innerHTML = '';
  modalBody.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(0, modalNote.text.length);

  async function commit() {
    const raw = ta.value.trim();
    if (!raw) { closeModal(); return; }
    const updated = await notesAPI.updateNote(currentDate, modalNote.index, raw);
    if (updated) {
      const idx = notes.findIndex((n) => n.index === modalNote.index);
      if (idx !== -1) notes[idx] = updated;
      modalNote = updated;
    }
    renderNotes();
    openModal(updated);
  }

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); openModal(modalNote); }
  });
});

// Modal delete button
document.querySelector('.modal-btn.delete-btn').addEventListener('click', () => {
  if (!modalNote) return;
  const noteToDelete = modalNote;
  closeModal();
  deleteNoteByIdx(noteToDelete);
});

// Modal close button
document.querySelector('.modal-btn.close-btn').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.style.display === 'flex') { closeModal(); return; }
});

// ── Delete ──
async function deleteNoteByIdx(note) {
  const noteIdx = notes.findIndex((n) => n.index === note.index);
  if (noteIdx === -1) return;
  const removed = notes[noteIdx];
  const filtered = getFilteredNotes();
  const cardIdx = filtered.findIndex((n) => n.index === note.index);
  if (cardIdx !== -1) {
    const cards = notesGrid.querySelectorAll('.note-widget');
    if (cards[cardIdx]) cards[cardIdx].classList.add('removing');
  }
  setTimeout(async () => {
    notes.splice(noteIdx, 1);
    await notesAPI.deleteNote(currentDate, note.index);
    renderNotes();
    lastDeleted = { note: removed, date: currentDate };
    showToast('笔记已删除', '撤销', async () => {
      await notesAPI.addNote(lastDeleted.date, lastDeleted.note.text);
      notes = await notesAPI.getNotes(currentDate);
      renderNotes();
    });
  }, 150);
}

// ── Filter ──
function setFilter(tag) {
  activeFilter = tag;
  if (tag) {
    activeFilterEl.innerHTML = `<span class="filter-tag" style="background:${hashColor(tag)}">#${tag} <span class="filter-clear">✕</span></span>`;
    activeFilterEl.querySelector('.filter-clear').addEventListener('click', () => setFilter(null));
  } else {
    activeFilterEl.innerHTML = '';
  }
  renderNotes();
}

// ── Read-only check ──
function isToday(dateStr) { return dateStr === getToday(); }

function updateInputState() {
  const today = isToday(currentDate);
  noteInput.disabled = !today;
  noteInput.placeholder = today ? '写下此刻的想法...（Enter 保存）' : '只能查看历史记录';
  document.getElementById('input-zone').classList.toggle('readonly', !today);
}

// ── Load date ──
async function loadDate(dateStr) {
  currentDate = dateStr;
  dateDisplay.textContent = formatDisplay(dateStr);
  notes = await notesAPI.getNotes(dateStr);
  activeFilter = null;
  activeFilterEl.innerHTML = '';
  searchInput.value = '';
  updateInputState();
  renderNotes();
  updateCalendarHighlight();
  if (isToday(currentDate)) noteInput.focus();
}

// ── Add note ──
async function addNote() {
  const text = noteInput.value.trim();
  if (!text) return;
  const note = await notesAPI.addNote(currentDate, text);
  if (note) { notes.push(note); renderNotes(); }
  noteInput.value = '';
  noteInput.style.height = 'auto';
  noteInput.focus();
}

// ── Events ──
noteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
});
noteInput.addEventListener('input', () => {
  noteInput.style.height = 'auto';
  noteInput.style.height = Math.min(noteInput.scrollHeight, 80) + 'px';
});
searchInput.addEventListener('input', () => renderNotes());
document.getElementById('btn-prev').addEventListener('click', () => loadDate(shiftDate(currentDate, -1)));
document.getElementById('btn-next').addEventListener('click', () => loadDate(shiftDate(currentDate, 1)));
document.getElementById('btn-today').addEventListener('click', () => loadDate(getToday()));

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (modalOverlay.style.display === 'flex') {
    if (e.key === 'Escape') closeModal();
    return;
  }
  if (e.ctrlKey && e.key === 'ArrowLeft')  { e.preventDefault(); loadDate(shiftDate(currentDate, -1)); }
  if (e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); loadDate(shiftDate(currentDate, 1)); }
  if (e.ctrlKey && e.key === 't')          { e.preventDefault(); loadDate(getToday()); }
  if (e.ctrlKey && e.key === 'z' && lastDeleted) {
    e.preventDefault();
    notesAPI.addNote(lastDeleted.date, lastDeleted.note.text);
    loadDate(currentDate);
    lastDeleted = null; hideToast();
  }
  if (e.key === 'Escape') {
    noteInput.value = ''; noteInput.style.height = 'auto';
    setFilter(null); searchInput.value = '';
    renderNotes(); noteInput.focus();
    calendarPanel.style.display = 'none';
  }
  if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchInput.focus(); }
});

// ── Calendar ──
let calYear, calMonth;
function toggleCalendar() {
  if (calendarPanel.style.display !== 'none') { calendarPanel.style.display = 'none'; return; }
  const [y, m] = currentDate.split('-').map(Number);
  calYear = y; calMonth = m;
  renderCalendar();
  calendarPanel.style.display = 'block';
}
function renderCalendar() {
  calendarTitle.textContent = `${calYear}年${calMonth}月`;
  const firstDay = new Date(calYear, calMonth - 1, 1);
  const lastDay = new Date(calYear, calMonth, 0);
  const startDow = firstDay.getDay();
  calendarGrid.innerHTML = '';
  ['日','一','二','三','四','五','六'].forEach((h) => {
    const c = document.createElement('div'); c.className = 'cal-header'; c.textContent = h; calendarGrid.appendChild(c);
  });
  for (let i = 0; i < startDow; i++) calendarGrid.appendChild(document.createElement('div'));
  const todayStr = getToday();
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day'; cell.textContent = d;
    const ds = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (ds === currentDate) cell.classList.add('selected');
    if (ds === todayStr) cell.classList.add('today');
    cell.addEventListener('click', () => { calendarPanel.style.display = 'none'; loadDate(ds); });
    calendarGrid.appendChild(cell);
  }
  loadCalendarDots();
}
async function loadCalendarDots() {
  try {
    const months = await notesAPI.listMonths();
    const tm = months.find((m) => m.year === calYear && m.month === calMonth);
    if (!tm) return;
    calendarGrid.querySelectorAll('.cal-day').forEach((cell) => {
      const d = parseInt(cell.textContent);
      const ds = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (tm.days.includes(ds)) cell.classList.add('has-notes');
    });
  } catch (_) {}
}
function updateCalendarHighlight() {
  if (calendarPanel.style.display === 'none') return;
  const [y, m] = currentDate.split('-').map(Number);
  if (y !== calYear || m !== calMonth) { calYear = y; calMonth = m; renderCalendar(); return; }
  calendarGrid.querySelectorAll('.cal-day').forEach((cell) => {
    const d = parseInt(cell.textContent);
    const ds = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cell.classList.toggle('selected', ds === currentDate);
  });
}
document.getElementById('btn-calendar').addEventListener('click', toggleCalendar);
document.getElementById('cal-prev').addEventListener('click', (e) => {
  e.stopPropagation();
  if (calMonth === 1) { calMonth = 12; calYear--; } else calMonth--;
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', (e) => {
  e.stopPropagation();
  if (calMonth === 12) { calMonth = 1; calYear++; } else calMonth++;
  renderCalendar();
});
document.addEventListener('click', (e) => {
  if (calendarPanel.style.display === 'block' && !calendarPanel.contains(e.target) && e.target.id !== 'btn-calendar')
    calendarPanel.style.display = 'none';
});
noteInput.addEventListener('focus', () => { calendarPanel.style.display = 'none'; });

// ── Init ──
setInterval(updateLiveTime, 10000);
updateLiveTime();
loadDate(getToday());
