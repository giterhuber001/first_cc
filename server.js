const express = require('express');
const path = require('path');
const crypto = require('crypto');
const store = require('./notes-store');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.NOTES_PASSWORD || 'everyday2026';
const tokens = new Set();

app.use(express.json());

// Handle /notes path prefix (set by Nginx proxy or direct access)
app.use((req, _res, next) => {
  if (req.path.startsWith('/notes')) {
    req.url = req.url.replace(/^\/notes/, '') || '/';
  }
  next();
});

// Auth middleware for API routes
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  if (token && tokens.has(token)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Login endpoint
app.post('/api/login', (req, res) => {
  if (req.body.password === PASSWORD) {
    const token = crypto.randomBytes(24).toString('hex');
    tokens.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  tokens.delete(token);
  res.json({ ok: true });
});

// Check auth status
app.get('/api/check', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// ── API Routes (protected) ──
app.get('/api/notes', requireAuth, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Missing date' });
  res.json(store.getNotes(date));
});

app.post('/api/notes', requireAuth, (req, res) => {
  const { date, text } = req.body;
  if (!date || !text) return res.status(400).json({ error: 'Missing date or text' });
  const note = store.addNote(date, text);
  res.json(note);
});

app.put('/api/notes', requireAuth, (req, res) => {
  const { date, index, text } = req.body;
  if (!date || index === undefined || !text) return res.status(400).json({ error: 'Missing date, index, or text' });
  const note = store.updateNote(date, index, text);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

app.delete('/api/notes', requireAuth, (req, res) => {
  const { date, index } = req.body;
  if (!date || index === undefined) return res.status(400).json({ error: 'Missing date or index' });
  store.deleteNote(date, index);
  res.json({ ok: true });
});

app.get('/api/search', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  res.json(store.searchNotes(q));
});

app.get('/api/months', requireAuth, (req, res) => {
  res.json(store.listMonths());
});

app.get('/api/root-dir', requireAuth, (_req, res) => {
  res.json(store.rootDir());
});

// Static files
app.use(express.static(path.join(__dirname, 'renderer')));

app.listen(PORT, () => {
  console.log(`Daily Notes server running at http://localhost:${PORT}`);
});
