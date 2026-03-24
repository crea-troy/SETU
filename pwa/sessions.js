/**
 * SETU Sessions — Save full Q+A with AI answers
 * Name your sessions. Use them to build better next prompts.
 * Stores locally. Pro: syncs to cloud.
 */

const SESSIONS = (() => {
  const KEY = "setu_sessions_v1";
  const MAX = 100;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function persist(sessions) {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  }

  // ── Save a complete Q+A exchange ─────────────────
  function saveExchange(data) {
    const sessions = load();
    const existing = sessions.find(s => s.id === data.sessionId);

    const exchange = {
      ts:        Date.now(),
      model:     data.model      || "claude",
      platform:  data.platform   || "setu",
      question:  (data.question  || "").slice(0, 500),
      answer:    (data.answer    || "").slice(0, 1000),
      optimized: data.optimized  || "",
      topic:     data.topic      || "general",
      lang:      data.lang       || "en",
      tokOrig:   data.tokOrig    || 0,
      tokOpt:    data.tokOpt     || 0,
      useful:    data.useful     !== undefined ? data.useful : true,
    };

    if (existing) {
      // Add to existing named session
      existing.exchanges.push(exchange);
      existing.updated = Date.now();
      existing.exchanges = existing.exchanges.slice(-20);
      persist(sessions);
      return existing;
    }

    // Create new session
    const name = data.name ||
      (exchange.topic !== "general"
        ? exchange.topic.replace(/_/g," ") + " " + new Date().toLocaleDateString()
        : new Date().toLocaleDateString() + " session");

    const newSession = {
      id:        "sess_" + Date.now(),
      name,
      created:   Date.now(),
      updated:   Date.now(),
      model:     data.model || "claude",
      topic:     exchange.topic,
      lang:      exchange.lang,
      exchanges: [exchange],
      tags:      data.tags || [],
    };

    sessions.unshift(newSession);
    if (sessions.length > MAX) sessions.splice(MAX);
    persist(sessions);
    return newSession;
  }

  // ── Build prompt context from a session ──────────
  // This is the key value: next prompt uses what worked before
  function buildContextFromSession(sessionId, maxTokens = 150) {
    const sessions = load();
    const session  = sessions.find(s => s.id === sessionId);
    if (!session) return "";

    const useful = session.exchanges.filter(e => e.useful !== false);
    if (!useful.length) return "";

    const parts  = [];
    let   tokens = 0;

    // Session topic context
    const header = `[Session: "${session.name}" · ${session.topic.replace(/_/g," ")} · ${session.exchanges.length} exchanges]`;
    const ht     = Math.ceil(header.length / 4);
    if (tokens + ht < maxTokens) { parts.push(header); tokens += ht; }

    // Most useful Q+A pairs
    useful.slice(-3).forEach(e => {
      const q = `[Q: ${e.question.slice(0, 80)}]`;
      const a = `[A: ${e.answer.slice(0, 80)}...]`;
      const lt = Math.ceil((q.length + a.length) / 4);
      if (tokens + lt < maxTokens) {
        parts.push(q);
        parts.push(a);
        tokens += lt;
      }
    });

    return parts.join("\n");
  }

  // ── Get smart suggestions based on new question ──
  function getSuggestedSession(query, topic) {
    const sessions = load();
    if (!sessions.length) return null;
    const qw = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const scored = sessions.map(s => {
      const sw  = new Set(s.name.toLowerCase().split(/\s+/));
      const ex  = s.exchanges.map(e => e.question + " " + e.topic).join(" ").toLowerCase().split(/\s+/);
      const esw = new Set(ex);
      const ov  = [...qw].filter(w => sw.has(w) || esw.has(w)).length;
      const tm  = s.topic === topic ? 3 : 0;
      return { ...s, _score: ov * 0.5 + tm };
    }).filter(s => s._score > 0.5).sort((a,b) => b._score - a._score);
    return scored[0] || null;
  }

  // ── Rename a session ─────────────────────────────
  function rename(sessionId, newName) {
    const sessions = load();
    const s = sessions.find(s => s.id === sessionId);
    if (s) { s.name = newName; s.updated = Date.now(); persist(sessions); }
    return s;
  }

  // ── Delete a session ─────────────────────────────
  function deleteSession(sessionId) {
    const sessions = load().filter(s => s.id !== sessionId);
    persist(sessions);
  }

  // ── Mark an exchange as useful/not useful ────────
  function markExchange(sessionId, ts, useful) {
    const sessions = load();
    const s = sessions.find(s => s.id === sessionId);
    if (s) {
      const e = s.exchanges.find(e => e.ts === ts);
      if (e) { e.useful = useful; persist(sessions); }
    }
  }

  // ── Stats ─────────────────────────────────────────
  function getStats() {
    const sessions = load();
    const total    = sessions.length;
    const exchanges= sessions.reduce((n, s) => n + s.exchanges.length, 0);
    const topics   = {};
    sessions.forEach(s => { topics[s.topic] = (topics[s.topic] || 0) + 1; });
    return {
      total, exchanges,
      recent: sessions.slice(0, 8),
      topTopics: Object.entries(topics).sort((a,b) => b[1]-a[1]).slice(0,5),
    };
  }

  // ── Export all sessions ───────────────────────────
  function exportAll() {
    const data = { sessions: load(), exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "setu-sessions.json"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Format time ───────────────────────────────────
  function formatAge(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return "just now";
    if (s < 3600)  return Math.floor(s/60) + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago";
    return Math.floor(s/86400) + "d ago";
  }

  return {
    saveExchange, buildContextFromSession,
    getSuggestedSession, rename, deleteSession,
    markExchange, getStats, exportAll, formatAge, load,
  };
})();

if (typeof module !== "undefined") module.exports = SESSIONS;
