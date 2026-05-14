// API wrapper with auth token support
window.api = (function() {
  function token() { return sessionStorage.getItem('notes_token') || ''; }
  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (token()) h['Authorization'] = 'Bearer ' + token();
    return h;
  }
  async function handle(res) {
    if (res.status === 401) { sessionStorage.removeItem('notes_token'); location.reload(); return null; }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  return {
    login: async (password) => {
      const res = await fetch('api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (!res.ok) return null;
      const data = await res.json();
      sessionStorage.setItem('notes_token', data.token);
      return data.token;
    },
    logout: async () => {
      await fetch('api/logout', { method: 'POST', headers: headers() });
      sessionStorage.removeItem('notes_token');
    },
    checkAuth: async () => {
      const res = await fetch('api/check', { headers: headers() });
      return res.ok;
    },
    getNotes: async (dateStr) => handle(await fetch(`api/notes?date=${encodeURIComponent(dateStr)}`, { headers: headers() })),
    addNote: async (dateStr, text) => handle(await fetch('api/notes', { method: 'POST', headers: headers(), body: JSON.stringify({ date: dateStr, text }) })),
    updateNote: async (dateStr, index, text) => handle(await fetch('api/notes', { method: 'PUT', headers: headers(), body: JSON.stringify({ date: dateStr, index, text }) })),
    deleteNote: async (dateStr, index) => { await fetch('api/notes', { method: 'DELETE', headers: headers(), body: JSON.stringify({ date: dateStr, index }) }); },
    searchNotes: async (keyword) => handle(await fetch(`api/search?q=${encodeURIComponent(keyword)}`, { headers: headers() })),
    listMonths: async () => handle(await fetch('api/months', { headers: headers() })),
    getRootDir: async () => handle(await fetch('api/root-dir', { headers: headers() })),
  };
})();
