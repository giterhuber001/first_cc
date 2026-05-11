// API wrapper — same interface as window.notesAPI (Electron IPC),
// but uses HTTP fetch for the PWA / web version.
window.api = {
  async getNotes(dateStr) {
    const res = await fetch(`/api/notes?date=${encodeURIComponent(dateStr)}`);
    return res.json();
  },

  async addNote(dateStr, text) {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, text }),
    });
    return res.json();
  },

  async updateNote(dateStr, index, text) {
    const res = await fetch('/api/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, index, text }),
    });
    return res.json();
  },

  async deleteNote(dateStr, index) {
    await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, index }),
    });
  },

  async searchNotes(keyword) {
    const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
    return res.json();
  },

  async listMonths() {
    const res = await fetch('/api/months');
    return res.json();
  },

  async getRootDir() {
    const res = await fetch('/api/root-dir');
    return res.text().then((t) => JSON.parse(t));
  }
};
