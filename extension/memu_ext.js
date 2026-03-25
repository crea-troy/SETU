/**
 * MEMU v4 — Extension Memory
 * Storage:  chrome.storage.local (free, on-device, cross-platform in same browser)
 * Cloud:    Anonymous UUID sync to SETU API (no login required, cross-device)
 *
 * How anonymous sync works:
 *   - On first install a random setu_uid is generated and stored permanently
 *   - Every save/read also syncs to SETU API using that UUID as identity
 *   - User never logs in — memory just works everywhere they install the extension
 *   - If user later creates an account they can claim their UUID and keep full history
 */

const MEMU = (() => {
  const MAX        = 300;
  const API_BASE   = "https://setu-api-rk46.onrender.com"; // ← replace with your deployed URL
  const SYNC       = true; // set false to disable cloud sync during local development

  // ── Anonymous UUID ────────────────────────────────
  // Generated once, stored forever. This is the user's identity across devices.
  async function getUID() {
    const data = await chrome.storage.local.get("setu_uid");
    if (data.setu_uid) return data.setu_uid;
    const uid = "setu_" + crypto.randomUUID();
    await chrome.storage.local.set({ setu_uid: uid });
    return uid;
  }

  // ── API helpers (fire-and-forget, never block the UI) ──
  async function apiSave(uid, entry) {
    if (!SYNC) return;
    try {
      await fetch(`${API_BASE}/api/v1/save`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-SETU-Key": `sk_setu_${uid}` },
        body: JSON.stringify({
          user_id:   uid,
          platform:  entry.platform,
          query:     entry.query,
          summary:   entry.summary,
          topic:     entry.topic,
          lang:      entry.lang,
          intent:    entry.intent,
          tok_saved: entry.saved,
        }),
      });
    } catch { /* offline — local copy already saved safely */ }
  }

  async function apiGetContext(uid, query, topic, lang, maxTok) {
    if (!SYNC) return null;
    try {
      const r = await fetch(`${API_BASE}/api/v1/context`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-SETU-Key": `sk_setu_${uid}` },
        body: JSON.stringify({ user_id: uid, query, topic, lang, max_tokens: maxTok }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.context || null;
    } catch { return null; }
  }

  // ── Save interaction ──────────────────────────────
  // 1. Saves to chrome.storage.local immediately (instant, offline-safe)
  // 2. Syncs to cloud in background (non-blocking)
  async function save(data) {
    const entry = {
      id:        Date.now(),
      ts:        Date.now(),
      platform:  data.platform  || "setu",
      query:     (data.query    || "").slice(0, 200),
      summary:   (data.summary  || data.query || "").slice(0, 200),
      topic:     data.topic     || "general",
      lang:      data.lang      || "en",
      intent:    data.intent    || "explain",
      expertise: data.expertise || "intermediate",
      saved:     data.tokSaved  || 0,
    };

    // Local first — always instant
    const { memories } = await chrome.storage.local.get("memories");
    const list = memories || [];
    list.unshift(entry);
    if (list.length > MAX) list.splice(MAX);
    await chrome.storage.local.set({ memories: list });

    await extractFacts(data.query || "");

    // Cloud sync — background, non-blocking
    getUID().then(uid => apiSave(uid, entry));

    return entry;
  }

  // ── Get context ───────────────────────────────────
  // Tries cloud first (has cross-device history), falls back to local
  async function getContext(query, topic, lang, maxTok = 120) {
    try {
      const uid      = await getUID();
      const cloudCtx = await apiGetContext(uid, query, topic, lang, maxTok);
      if (cloudCtx && cloudCtx.length > 0) return cloudCtx;
    } catch { /* fall through */ }
    return localContext(query, topic, lang, maxTok);
  }

  // ── Local context builder ─────────────────────────
  async function localContext(query, topic, lang, maxTok) {
    const { memories, facts, setu_profile } = await chrome.storage.local.get([
      "memories", "facts", "setu_profile"
    ]);
    const mems    = memories    || [];
    const f       = facts       || {};
    const profile = setu_profile || {};
    const qw      = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const now     = Date.now();

    const rel = mems.map(m => {
      const mw = new Set((m.query + " " + (m.summary || "")).toLowerCase().split(/\s+/));
      const ov = [...qw].filter(w => mw.has(w)).length;
      return {
        ...m,
        _s: ov * 0.5
          + (m.topic === topic ? 3 : 0)
          + (m.lang  === lang  ? 1 : 0)
          + Math.exp(-0.04 * (now - m.ts) / 3600000) * 0.2,
      };
    }).filter(m => m._s > 0.3).sort((a, b) => b._s - a._s).slice(0, 3);

    const parts = []; let tokens = 0;

    if (profile.topTopics?.length) {
      const line = `[user expertise: ${profile.topTopics.slice(0, 2).join(", ")}]`;
      const lt   = Math.ceil(line.length / 4);
      if (tokens + lt < maxTok) { parts.push(line); tokens += lt; }
    }
    Object.entries(f).slice(0, 2).forEach(([k, v]) => {
      const line = `[${k}: ${v.value}]`;
      const lt   = Math.ceil(line.length / 4);
      if (tokens + lt < maxTok) { parts.push(line); tokens += lt; }
    });
    rel.forEach(m => {
      const line = `[${m.platform} ${formatAge(m.ts)}: ${(m.summary || m.query || "").slice(0, 60)}]`;
      const lt   = Math.ceil(line.length / 4);
      if (tokens + lt < maxTok) { parts.push(line); tokens += lt; }
    });

    return parts.length ? parts.join("\n") : "";
  }

  // ── Fact extraction ───────────────────────────────
  async function extractFacts(text) {
    const { facts } = await chrome.storage.local.get("facts");
    const f = facts || {}; let changed = false;
    const patterns = [
      [/my name is (\w+)/i,                           "name"],
      [/i work (?:at|for|in) ([\w ]+)/i,              "works_at"],
      [/i prefer ([\w ]+)/i,                          "preference"],
      [/i live in ([\w ]+)/i,                         "location"],
      [/i use (python|javascript|react|typescript)/i, "primary_language"],
    ];
    for (const [rx, k] of patterns) {
      const m = text.match(rx);
      if (m && m[1] && m[1].length > 1 && m[1].length < 50) {
        f[k] = { value: m[1].trim(), ts: Date.now() };
        changed = true;
      }
    }
    if (changed) await chrome.storage.local.set({ facts: f });
  }

  // ── Stats ─────────────────────────────────────────
  async function getStats() {
    const { memories, facts, setu_uid } = await chrome.storage.local.get([
      "memories", "facts", "setu_uid"
    ]);
    const mems = memories || {}; const plats = {}, langs = {};
    (Array.isArray(mems) ? mems : []).forEach(m => {
      plats[m.platform] = (plats[m.platform] || 0) + 1;
      langs[m.lang]     = (langs[m.lang]     || 0) + 1;
    });
    return {
      total:     Array.isArray(mems) ? mems.length : 0,
      facts:     Object.keys(facts || {}).length,
      platforms: Object.entries(plats).sort((a, b) => b[1] - a[1]),
      langs:     Object.entries(langs).sort((a, b) => b[1] - a[1]),
      recent:    Array.isArray(mems) ? mems.slice(0, 8) : [],
      uid:       setu_uid || null,
      synced:    SYNC,
    };
  }

  function formatAge(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return "now";
    if (s < 3600)  return Math.floor(s / 60)   + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return               Math.floor(s / 86400) + "d";
  }

  async function clearAll() { await chrome.storage.local.clear(); }

  async function exportAll() {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "setu-data.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return { save, getContext, extractFacts, getStats, clearAll, exportAll, formatAge, getUID };
})();
