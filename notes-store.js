const fs = require('fs');
const path = require('path');

const NOTES_ROOT = path.join(__dirname, 'data');

function rootDir() {
  return NOTES_ROOT;
}

function resolveDatePath(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return {
    dir: path.join(NOTES_ROOT, y, m),
    file: path.join(NOTES_ROOT, y, m, `${dateStr}.md`),
  };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseNoteLine(line, index) {
  const match = line.match(/^- \[(\d{2}:\d{2})]\s+(.*)/);
  if (!match) return null;
  const time = match[1];
  const body = match[2];
  const tags = [...body.matchAll(/#([^\s#]+)/g)].map((m) => m[1]);
  const text = body.replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
  return { index, time, text, tags };
}

function getNotes(dateStr) {
  const { file } = resolveDatePath(dateStr);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  return lines.map(parseNoteLine).filter(Boolean);
}

function addNote(dateStr, text) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const line = `- [${time}] ${text}\n`;

  const { dir, file } = resolveDatePath(dateStr);
  ensureDir(dir);
  fs.appendFileSync(file, line, 'utf-8');

  // Return the parsed note so renderer can use it
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  const index = lines.length - 1;
  return parseNoteLine(lines[index], index);
}

function updateNote(dateStr, index, newText) {
  const { file } = resolveDatePath(dateStr);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  if (index < 0 || index >= lines.length) return null;
  const parsed = parseNoteLine(lines[index], index);
  if (!parsed) return null;
  const line = `- [${parsed.time}] ${newText}\n`;
  lines[index] = line.trimEnd();
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf-8');
  return parseNoteLine(lines[index], index);
}

function deleteNote(dateStr, index) {
  const { file } = resolveDatePath(dateStr);
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  if (index < 0 || index >= lines.length) return;
  lines.splice(index, 1);
  fs.writeFileSync(file, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
}

function searchNotes(keyword) {
  const results = [];
  if (!fs.existsSync(NOTES_ROOT)) return results;
  const years = fs.readdirSync(NOTES_ROOT);
  for (const year of years) {
    const yearPath = path.join(NOTES_ROOT, year);
    if (!fs.statSync(yearPath).isDirectory()) continue;
    const months = fs.readdirSync(yearPath);
    for (const month of months) {
      const monthPath = path.join(yearPath, month);
      if (!fs.statSync(monthPath).isDirectory()) continue;
      const files = fs.readdirSync(monthPath);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const dateStr = file.replace('.md', '');
        const notes = getNotes(dateStr);
        const lowerKw = keyword.toLowerCase();
        const matched = notes.filter((n) =>
          n.text.toLowerCase().includes(lowerKw) || n.tags.some((t) => t.toLowerCase().includes(lowerKw))
        );
        for (const n of matched) {
          results.push({ date: dateStr, ...n });
        }
      }
    }
  }
  return results;
}

function listMonths() {
  const months = [];
  if (!fs.existsSync(NOTES_ROOT)) return months;
  const years = fs.readdirSync(NOTES_ROOT);
  for (const year of years) {
    const yearPath = path.join(NOTES_ROOT, year);
    if (!fs.statSync(yearPath).isDirectory()) continue;
    const monthDirs = fs.readdirSync(yearPath);
    for (const month of monthDirs) {
      const monthPath = path.join(yearPath, month);
      if (!fs.statSync(monthPath).isDirectory()) continue;
      const files = fs.readdirSync(monthPath).filter((f) => f.endsWith('.md'));
      const dayCount = files.length;
      const days = files.map((f) => f.replace('.md', '')).sort();
      months.push({ year: parseInt(year), month: parseInt(month), dayCount, days });
    }
  }
  return months.sort((a, b) => a.year - b.year || a.month - b.month);
}

module.exports = { getNotes, addNote, updateNote, deleteNote, searchNotes, listMonths, rootDir };
