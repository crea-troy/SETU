/**
 * MEMU v4 — PWA Memory
 * Storage:  localStorage (offline-first, always works)
 * Cloud:    Anonymous UUID sync via SETU API (no login, cross-device)
 *
 * The PWA cannot use chrome.storage (that's extension-only).
 * Instead it uses the same anonymous UUID approach — generates a UUID,
 * stores it in localStorage, and syncs all memories through the API.
 * This means the PWA and extension share the same cloud memories when
 * both use the same UUID (user can copy their UUID from extension to PWA).
 */

const MEMU = (() => {
  const LK       = "setu_memories_v3";
  const FK       = "setu_facts_v3";
  const PK       = "setu_profile_v3";
  const UID_KEY  = "setu_uid";
  const MAX      = 500;
  const API_BASE = "https://your-api.onrender.com"; // ← replace with your deployed URL
  const SYNC     = true;

  let _sb = null, _uid_override = null, _pro = false;

  // ── For backward compat: init() still works if Supabase is passed ──
  function init(sb, uid, pro) { _sb = sb; _uid_override = uid; _pro = pro; }

  // ── Anonymous UUID ────────────────────────────────
  function getUID() {
    if (_uid_override) return _uid_override;
    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      uid = "setu_" + generateUUID();
      localStorage.setItem(UID_KEY, uid);
    }
    return uid;
  }

  function generateUUID() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ── Local storage helpers ─────────────────────────
  function loadLocal()   { try { return JSON.parse(localStorage.getItem(LK) || "[]"); }  catch { return []; } }
  function loadFacts()   { try { return JSON.parse(localStorage.getItem(FK) || "{}"); }  catch { return {}; } }
  function loadProfile() { try { return JSON.parse(localStorage.getItem(PK) || "{}"); }  catch { return {}; } }

  // ── API helpers ───────────────────────────────────
  async function apiSave(entry) {
    if (!SYNC) return;
    const uid = getUID();
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
    } catch { /* offline — local copy saved */ }
  }

  async function apiGetContext(query, topic, lang, maxTok) {
    if (!SYNC) return null;
    const uid = getUID();
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

  // Pulls cloud memories and merges into localStorage
  // Call this on PWA startup to sync any memories from extension
  async function syncFromCloud() {
    if (!SYNC) return;
    const uid = getUID();
    try {
      const r = await fetch(`${API_BASE}/api/v1/sync`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-SETU-Key": `sk_setu_${uid}` },
        body: JSON.stringify({ user_id: uid }),
      });
      if (!r.ok) return;
      const d = await r.json();

      if (d.memories?.length) {
        const local      = loadLocal();
        const localIds   = new Set(local.map(m => m.id));
        const incoming   = d.memories.map(m => ({
          id:        new Date(m.created_at).getTime(),
          ts:        new Date(m.created_at).getTime(),
          platform:  m.platform,
          query:     m.query,
          summary:   m.summary || m.query,
          topic:     m.topic,
          lang:      m.lang,
          intent:    m.intent,
          expertise: "intermediate",
          saved:     m.tok_saved || 0,
        })).filter(m => !localIds.has(m.id));

        const merged = [...incoming, ...local].slice(0, MAX);
        localStorage.setItem(LK, JSON.stringify(merged));
      }

      if (d.facts?.length) {
        const localFacts = loadFacts();
        d.facts.forEach(f => {
          if (!localFacts[f.concept]) {
            localFacts[f.concept] = { value: f.value, ts: Date.now() };
          }
        });
        localStorage.setItem(FK, JSON.stringify(localFacts));
      }
    } catch { /* offline — use local */ }
  }

  // ── Save interaction ──────────────────────────────
  async function save(data) {
    const e = {
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

    const list = loadLocal();
    list.unshift(e);
    if (list.length > MAX) list.splice(MAX);
    localStorage.setItem(LK, JSON.stringify(list));

    extractFacts(data.query || "");
    updateProfile(e);

    // Cloud sync in background
    apiSave(e);

    return e;
  }

  // ── Get context ───────────────────────────────────
  async function getContext(query, topic, lang, maxTok = 120) {
    // Try cloud first (has cross-device memories from extension)
    try {
      const cloudCtx = await apiGetContext(query, topic, lang, maxTok);
      if (cloudCtx && cloudCtx.length > 0) return cloudCtx;
    } catch { /* fall through */ }

    // Fall back to local context
    return buildLocalContext(query, topic, lang, maxTok);
  }

  async function buildLocalContext(query, topic, lang, maxTok) {
    const relevant = await getRelevant(query, topic, lang);
    const facts    = loadFacts();
    const profile  = loadProfile();
    const parts    = []; let tokens = 0;

    if (profile.topTopics?.length) {
      const line = `[user expertise: ${profile.topTopics.slice(0, 3).join(", ")}]`;
      const lt   = Math.ceil(line.length / 4);
      if (tokens + lt < maxTok) { parts.push(line); tokens += lt; }
    }
    Object.entries(facts).slice(0, 3).forEach(([k, v]) => {
      const line = `[${k.replace(/_/g, " ")}: ${v.value}]`;
      const lt   = Math.ceil(line.length / 4);
      if (tokens + lt < maxTok) { parts.push(line); tokens += lt; }
    });
    relevant.forEach(m => {
      const line = `[${m.platform} ${formatAge(m.ts || Date.now())}: ${(m.summary || m.query || "").slice(0, 70)}]`;
      const lt   = Math.ceil(line.length / 4);
      if (tokens + lt < maxTok) { parts.push(line); tokens += lt; }
    });

    return parts.length ? parts.join("\n") : "";
  }

  // ── Relevant memory scoring ───────────────────────
  async function getRelevant(query, topic, lang, limit = 4) {
    const mems = loadLocal();
    if (!mems.length) return [];
    const qw  = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const now = Date.now();
    return mems.map(m => {
      const mw  = new Set((m.query + " " + (m.summary || "")).toLowerCase().split(/\s+/));
      const ov  = [...qw].filter(w => mw.has(w)).length;
      const age = (now - (m.ts || now)) / 3600000;
      return { ...m, _s: ov*0.5 + (m.topic===topic?3:0) + (m.lang===lang?1:0) + Math.exp(-0.04*age)*0.2 };
    }).filter(m => m._s > 0.3).sort((a, b) => b._s - a._s).slice(0, limit);
  }

  // ── Profile tracking ──────────────────────────────
  function updateProfile(entry) {
    const profile = loadProfile();
    if (!profile.topicCounts)      profile.topicCounts      = {};
    if (!profile.langCounts)       profile.langCounts       = {};
    if (!profile.platformCounts)   profile.platformCounts   = {};
    if (!profile.expertisePerTopic) profile.expertisePerTopic = {};

    profile.topicCounts[entry.topic]       = (profile.topicCounts[entry.topic]       || 0) + 1;
    profile.langCounts[entry.lang]         = (profile.langCounts[entry.lang]         || 0) + 1;
    profile.platformCounts[entry.platform] = (profile.platformCounts[entry.platform] || 0) + 1;
    profile.expertisePerTopic[entry.topic] = entry.expertise;
    profile.lastSeen            = Date.now();
    profile.totalInteractions   = (profile.totalInteractions || 0) + 1;

    const langs        = Object.entries(profile.langCounts).sort((a, b) => b[1] - a[1]);
    profile.dominantLang = langs[0]?.[0] || "en";
    profile.topTopics  = Object.entries(profile.topicCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

    localStorage.setItem(PK, JSON.stringify(profile));
    return profile;
  }

  // ── Fact extraction ───────────────────────────────
  function extractFacts(text) {
    const facts = loadFacts(); let changed = false;
    const patterns = [
      [/my name is (\w+)/i,                                              "name"],
      [/i(?:'m| am) (?:a |an )?([\w ]+?) (?:at|in|from|and|who)/i,     "role"],
      [/i work (?:at|for|in) ([\w ]+)/i,                                "works_at"],
      [/i(?:'m| am) learning ([\w ]+)/i,                                "learning"],
      [/i prefer ([\w ]+)/i,                                            "preference"],
      [/i live in ([\w ]+)/i,                                           "location"],
      [/i speak ([\w ]+)/i,                                             "languages"],
      [/i(?:'m| am) (\d+) years? old/i,                                 "age"],
      [/i use (python|javascript|react|vue|typescript|java|golang|rust)/i, "primary_language"],
    ];
    for (const [rx, key] of patterns) {
      const m = text.match(rx);
      if (m && m[1] && m[1].length > 1 && m[1].length < 50) {
        facts[key] = { value: m[1].trim(), ts: Date.now() };
        changed = true;
      }
    }
    if (changed) localStorage.setItem(FK, JSON.stringify(facts));
  }

  // ── Smart import (unchanged from v3 — still excellent) ──
  function smartImport(json, filename) {
    try {
      let conversations = [];
      if (Array.isArray(json) && json[0]?.mapping) {
        conversations = json.map(conv => ({
          source:   "chatgpt",
          messages: Object.values(conv.mapping || {})
            .filter(n => n.message?.author?.role === "user" && n.message?.content)
            .map(n => extractText(n.message.content)).filter(t => t.length > 5),
          ts: conv.create_time ? conv.create_time * 1000 : Date.now(),
        }));
      } else if (Array.isArray(json) && json[0]?.chat_messages) {
        conversations = json.map(conv => ({
          source:   "claude",
          messages: (conv.chat_messages || [])
            .filter(m => m.sender === "human")
            .map(m => extractText(m.text || m.content || "")).filter(t => t.length > 5),
          ts: conv.created_at ? new Date(conv.created_at).getTime() : Date.now(),
        }));
      } else if (json.conversations) {
        return smartImport(json.conversations, filename);
      }
      if (!conversations.length) return null;

      const topicCounts = {}, langCounts = {}, expertiseHints = {}, extractedFacts = {};
      let totalMessages = 0;
      const recentMemories = [];

      for (const conv of conversations) {
        for (const msg of conv.messages) {
          if (!msg || msg.length < 5) continue;
          totalMessages++;
          const lang  = KOVA ? KOVA.detectLang(msg)    : { code: "en" };
          const topic = KOVA ? KOVA.detectTopic(msg)   : "general";
          const exp   = KOVA ? KOVA.detectExpertise(msg): "intermediate";
          langCounts[lang.code]  = (langCounts[lang.code]  || 0) + 1;
          topicCounts[topic]     = (topicCounts[topic]      || 0) + 1;
          expertiseHints[topic]  = exp;
          const ps = [
            [/my name is (\w+)/i, "name"],
            [/i work (?:at|for|in) ([\w ]+)/i, "works_at"],
            [/i live in ([\w ]+)/i, "location"],
            [/i use (python|javascript|react|typescript|java|golang|rust)/i, "primary_language"],
          ];
          for (const [rx, key] of ps) {
            const m = msg.match(rx);
            if (m && m[1] && m[1].length > 1 && m[1].length < 50)
              extractedFacts[key] = { value: m[1].trim(), ts: conv.ts };
          }
          if (recentMemories.length < 100 && msg.length > 15)
            recentMemories.push({ id: conv.ts + recentMemories.length, ts: conv.ts, platform: conv.source, query: msg.slice(0,200), summary: msg.slice(0,150), topic, lang: lang.code, intent: "explain", saved: 0 });
        }
      }

      const topTopics    = Object.entries(topicCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const topLangs     = Object.entries(langCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
      const dominantLang = topLangs[0]?.[0] || "en";
      const expScores    = { beginner:1, intermediate:2, expert:3 };
      const expVals      = Object.values(expertiseHints).map(e => expScores[e] || 2);
      const avgExp       = expVals.length ? expVals.reduce((a,b)=>a+b,0)/expVals.length : 2;
      const overallExp   = avgExp < 1.5 ? "beginner" : avgExp > 2.5 ? "expert" : "intermediate";

      return {
        source: conversations[0]?.source || "unknown", totalMessages,
        conversationCount: conversations.length,
        topTopics, topLangs, dominantLang, overallExpertise: overallExp,
        expertisePerTopic: expertiseHints, facts: extractedFacts,
        memories: recentMemories,
        profileSummary: `User primarily asks about ${topTopics.slice(0,3).map(([t])=>t.replace(/_/g," ")).join(", ")}. ${overallExp} level. Main language: ${dominantLang}.`,
      };
    } catch(e) { console.error("Smart import error:", e); return null; }
  }

  async function applyImport(parsed) {
    if (!parsed) return { ok: false, error: "Could not parse the file" };
    const existingFacts = loadFacts();
    localStorage.setItem(FK, JSON.stringify({ ...existingFacts, ...parsed.facts }));
    const profile = loadProfile();
    if (!profile.topicCounts) profile.topicCounts = {};
    if (!profile.langCounts)  profile.langCounts  = {};
    parsed.topTopics.forEach(([t,c]) => { profile.topicCounts[t] = (profile.topicCounts[t]||0)+c; });
    parsed.topLangs.forEach(([l,c])  => { profile.langCounts[l]  = (profile.langCounts[l] ||0)+c; });
    profile.expertisePerTopic  = { ...(profile.expertisePerTopic||{}), ...parsed.expertisePerTopic };
    profile.totalInteractions  = (profile.totalInteractions||0) + parsed.totalMessages;
    profile.dominantLang       = parsed.dominantLang;
    profile.topTopics          = Object.entries(profile.topicCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t])=>t);
    profile.importedFrom       = parsed.source;
    profile.importedAt         = Date.now();
    localStorage.setItem(PK, JSON.stringify(profile));
    const existing    = loadLocal();
    const existingIds = new Set(existing.map(m => m.id));
    const newMems     = parsed.memories.filter(m => !existingIds.has(m.id));
    localStorage.setItem(LK, JSON.stringify([...newMems, ...existing].slice(0, MAX)));
    return { ok: true, source: parsed.source, memoriesAdded: newMems.length, factsFound: Object.keys(parsed.facts).length, totalMessages: parsed.totalMessages, insights: { topTopics: parsed.topTopics, languages: parsed.topLangs, expertise: parsed.overallExpertise, profileSummary: parsed.profileSummary } };
  }

  // ── Stats ─────────────────────────────────────────
  async function getStats() {
    const list = loadLocal(), facts = loadFacts(), profile = loadProfile();
    const plats={}, langs={}, topics={}; let totalSaved=0;
    list.forEach(m => {
      plats[m.platform]  = (plats[m.platform]  || 0) + 1;
      langs[m.lang]      = (langs[m.lang]       || 0) + 1;
      topics[m.topic]    = (topics[m.topic]     || 0) + 1;
      totalSaved        += (m.saved || 0);
    });
    return { total: list.length, facts: Object.keys(facts).length, totalSaved, profile,
      platforms: Object.entries(plats).sort((a,b)=>b[1]-a[1]),
      langs:     Object.entries(langs).sort((a,b)=>b[1]-a[1]),
      topics:    Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,5),
      recent:    list.slice(0,10), uid: getUID(), synced: SYNC };
  }

  // ── Helpers ───────────────────────────────────────
  function extractText(content) {
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) return content.map(extractText).filter(Boolean).join(" ");
    if (content?.parts) return extractText(content.parts);
    if (content?.text)  return content.text.trim();
    return "";
  }

  function formatAge(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)    return "now";
    if (s < 3600)  return Math.floor(s/60)   + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago";
    return               Math.floor(s/86400) + "d ago";
  }

  function clearAll() {
    localStorage.removeItem(LK);
    localStorage.removeItem(FK);
    localStorage.removeItem(PK);
  }

  function exportAll() {
    const data = { memories: loadLocal(), facts: loadFacts(), profile: loadProfile(), uid: getUID(), exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "setu-memory.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function getSuggestions(query, topic) {
    const rel = await getRelevant(query, topic, "en", 3);
    return rel.filter(m => m.platform && m.platform !== "setu")
      .map(m => `You asked on ${m.platform}: "${(m.query||"").slice(0,60)}..." — related?`);
  }

  return {
    init, save, getContext, getRelevant, getSuggestions, getStats,
    extractFacts, smartImport, applyImport, clearAll, exportAll,
    formatAge, loadFacts, loadProfile, getUID, syncFromCloud,
  };
})();

if (typeof module !== "undefined") module.exports = MEMU;
