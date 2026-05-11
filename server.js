const express = require('express');
const path = require('path');
const store = require('./notes-store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'renderer')));

// ── API Routes ──
app.get('/api/notes', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Missing date' });
  res.json(store.getNotes(date));
});

app.post('/api/notes', (req, res) => {
  const { date, text } = req.body;
  if (!date || !text) return res.status(400).json({ error: 'Missing date or text' });
  const note = store.addNote(date, text);
  res.json(note);
});

app.put('/api/notes', (req, res) => {
  const { date, index, text } = req.body;
  if (!date || index === undefined || !text) return res.status(400).json({ error: 'Missing date, index, or text' });
  const note = store.updateNote(date, index, text);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

app.delete('/api/notes', (req, res) => {
  const { date, index } = req.body;
  if (!date || index === undefined) return res.status(400).json({ error: 'Missing date or index' });
  store.deleteNote(date, index);
  res.json({ ok: true });
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  res.json(store.searchNotes(q));
});

app.get('/api/months', (_req, res) => {
  res.json(store.listMonths());
});

app.get('/api/root-dir', (_req, res) => {
  res.json(store.rootDir());
});

app.listen(PORT, () => {
  console.log(`Daily Notes server running at http://localhost:${PORT}`);
});
