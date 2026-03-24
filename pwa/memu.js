/**
 * MEMU v3 — Cross-Platform Memory + Smart Import
 *
 * Key improvements over v2:
 * - Smart import: extracts INSIGHTS not raw messages
 * - Cross-device sync for Pro users (Supabase)
 * - Expertise tracking per topic
 * - Proactive suggestions across platforms
 */

const MEMU = (() => {
  const LK = "setu_memories_v3";
  const FK = "setu_facts_v3";
  const PK = "setu_profile_v3"; // user profile built from history
  const MAX = 500;
  let _sb = null, _uid = null, _pro = false;

  function init(sb, uid, pro) { _sb=sb; _uid=uid; _pro=pro; }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LK)||"[]"); } catch { return []; } }
  function loadFacts()  { try { return JSON.parse(localStorage.getItem(FK)||"{}"); } catch { return {}; } }
  function loadProfile(){ try { return JSON.parse(localStorage.getItem(PK)||"{}"); } catch { return {}; } }

  // ── Save interaction ─────────────────────────────
  async function save(data) {
    const e = {
      id:       Date.now(),
      ts:       Date.now(),
      platform: data.platform  || "setu",
      query:    (data.query    || "").slice(0,200),
      summary:  (data.summary  || data.query || "").slice(0,200),
      topic:    data.topic     || "general",
      lang:     data.lang      || "en",
      intent:   data.intent    || "explain",
      expertise:data.expertise || "intermediate",
      saved:    data.tokSaved  || 0,
    };
    const list = loadLocal();
    list.unshift(e);
    if (list.length > MAX) list.splice(MAX);
    localStorage.setItem(LK, JSON.stringify(list));
    extractFacts(data.query || "");
    updateProfile(e);
    if (_pro && _sb && _uid) {
      try {
        await _sb.from("memories").insert({
          user_id:  _uid,
          platform: e.platform,
          query:    e.query,
          summary:  e.summary,
          topic:    e.topic,
          lang:     e.lang,
          intent:   e.intent,
          tok_saved:e.saved,
        });
      } catch {}
    }
    return e;
  }

  // ── Update user profile from each interaction ────
  function updateProfile(entry) {
    const profile = loadProfile();
    if (!profile.topicCounts) profile.topicCounts = {};
    if (!profile.langCounts)  profile.langCounts  = {};
    if (!profile.platformCounts) profile.platformCounts = {};
    if (!profile.expertisePerTopic) profile.expertisePerTopic = {};

    profile.topicCounts[entry.topic]     = (profile.topicCounts[entry.topic]     || 0) + 1;
    profile.langCounts[entry.lang]       = (profile.langCounts[entry.lang]       || 0) + 1;
    profile.platformCounts[entry.platform] = (profile.platformCounts[entry.platform] || 0) + 1;
    profile.expertisePerTopic[entry.topic] = entry.expertise;
    profile.lastSeen = Date.now();
    profile.totalInteractions = (profile.totalInteractions || 0) + 1;

    // Derive dominant language
    const langs = Object.entries(profile.langCounts).sort((a,b)=>b[1]-a[1]);
    profile.dominantLang = langs[0]?.[0] || "en";

    // Derive top topics
    profile.topTopics = Object.entries(profile.topicCounts)
      .sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t])=>t);

    localStorage.setItem(PK, JSON.stringify(profile));
    return profile;
  }

  // ── Get relevant memories ─────────────────────────
  async function getRelevant(query, topic, lang, limit=4) {
    let mems = [];
    if (_pro && _sb && _uid) {
      try {
        const {data} = await _sb.from("memories").select("*")
          .eq("user_id", _uid).order("created_at", {ascending:false}).limit(200);
        if (data) mems = data.map(m => ({...m, ts: new Date(m.created_at).getTime()}));
      } catch { mems = loadLocal(); }
    } else { mems = loadLocal(); }
    if (!mems.length) return [];
    const qw = new Set(query.toLowerCase().split(/\s+/).filter(w=>w.length>3));
    const now = Date.now();
    return mems.map(m => {
      const mw = new Set((m.query+" "+(m.summary||"")).toLowerCase().split(/\s+/));
      const ov = [...qw].filter(w=>mw.has(w)).length;
      const tm = m.topic===topic?3:0, lm = m.lang===lang?1:0;
      const age = (now-(m.ts||now))/3600000;
      return { ...m, _s: ov*0.5+tm+lm+Math.exp(-0.04*age)*0.2 };
    }).filter(m=>m._s>0.3).sort((a,b)=>b._s-a._s).slice(0,limit);
  }

  // ── Build context for KOVA ───────────────────────
  async function getContext(query, topic, lang, maxTok=120) {
    const relevant = await getRelevant(query, topic, lang);
    const facts    = loadFacts();
    const profile  = loadProfile();
    let parts = [], tokens = 0;

    // Profile insights first (most valuable)
    if (profile.topTopics?.length) {
      const line = `[user expertise: ${profile.topTopics.slice(0,3).join(", ")}]`;
      const lt = Math.ceil(line.length/4);
      if (tokens+lt < maxTok) { parts.push(line); tokens += lt; }
    }

    // Facts
    Object.entries(facts).slice(0,3).forEach(([k,v]) => {
      const line = `[${k.replace(/_/g," ")}: ${v.value}]`;
      const lt = Math.ceil(line.length/4);
      if (tokens+lt < maxTok) { parts.push(line); tokens += lt; }
    });

    // Recent relevant memories
    relevant.forEach(m => {
      const ago  = formatAge(m.ts || Date.now());
      const line = `[${m.platform} ${ago}: ${(m.summary||m.query||"").slice(0,70)}]`;
      const lt   = Math.ceil(line.length/4);
      if (tokens+lt < maxTok) { parts.push(line); tokens += lt; }
    });

    return parts.length ? parts.join("\n") : "";
  }

  // ── Extract permanent facts ───────────────────────
  function extractFacts(text) {
    const facts = loadFacts(); let changed = false;
    const patterns = [
      [/my name is (\w+)/i, "name"],
      [/i(?:'m| am) (?:a |an )?([\w ]+?) (?:at|in|from|and|who)/i, "role"],
      [/i work (?:at|for|in) ([\w ]+)/i, "works_at"],
      [/i(?:'m| am) learning ([\w ]+)/i, "learning"],
      [/i prefer ([\w ]+)/i, "preference"],
      [/i live in ([\w ]+)/i, "location"],
      [/i speak ([\w ]+)/i, "languages"],
      [/i(?:'m| am) (\d+) years? old/i, "age"],
      [/i(?:'m| am) studying ([\w ]+)/i, "studying"],
      [/i use (python|javascript|react|vue|typescript|java|golang|rust)/i, "primary_language"],
    ];
    for (const [rx, key] of patterns) {
      const m = text.match(rx);
      if (m && m[1] && m[1].length > 1 && m[1].length < 50) {
        facts[key] = { value: m[1].trim(), ts: Date.now() };
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(FK, JSON.stringify(facts));
      if (_pro && _sb && _uid) {
        Object.entries(facts).forEach(async ([concept, v]) => {
          try { await _sb.from("facts").upsert({user_id:_uid, concept, value:v.value}, {onConflict:"user_id,concept"}); } catch {}
        });
      }
    }
  }

  // ── SMART IMPORT — extracts insights not raw messages ──
  // This is the key fix: we don't copy-paste conversations
  // We extract what MATTERS: topics, expertise, style, facts
  function smartImport(json, filename) {
    try {
      let conversations = [];

      // Detect format
      if (Array.isArray(json) && json[0]?.mapping) {
        // ChatGPT format
        conversations = json.map(conv => ({
          source: "chatgpt",
          messages: Object.values(conv.mapping||{})
            .filter(n => n.message?.author?.role === "user" && n.message?.content)
            .map(n => extractText(n.message.content))
            .filter(t => t.length > 5),
          ts: conv.create_time ? conv.create_time*1000 : Date.now(),
        }));
      } else if (Array.isArray(json) && json[0]?.chat_messages) {
        // Claude format
        conversations = json.map(conv => ({
          source: "claude",
          messages: (conv.chat_messages||[])
            .filter(m => m.sender==="human")
            .map(m => extractText(m.text||m.content||""))
            .filter(t => t.length > 5),
          ts: conv.created_at ? new Date(conv.created_at).getTime() : Date.now(),
        }));
      } else if (json.conversations) {
        return smartImport(json.conversations, filename);
      }

      if (!conversations.length) return null;

      // ── Extract insights (NOT raw messages) ──────
      const topicCounts    = {};
      const langCounts     = {};
      const expertiseHints = {};
      const extractedFacts = {};
      let totalMessages    = 0;
      const recentMemories = [];

      for (const conv of conversations) {
        for (const msg of conv.messages) {
          if (!msg || msg.length < 5) continue;
          totalMessages++;

          const lang  = KOVA ? KOVA.detectLang(msg)   : {code:"en"};
          const topic = KOVA ? KOVA.detectTopic(msg)   : "general";
          const exp   = KOVA ? KOVA.detectExpertise(msg): "intermediate";

          langCounts[lang.code]  = (langCounts[lang.code]  || 0) + 1;
          topicCounts[topic]     = (topicCounts[topic]      || 0) + 1;
          expertiseHints[topic]  = exp;

          // Extract facts from messages
          const patterns = [
            [/my name is (\w+)/i, "name"],
            [/i(?:'m| am) (?:a |an )?([\w ]+?) (?:at|in|from|and)/i, "role"],
            [/i work (?:at|for|in) ([\w ]+)/i, "works_at"],
            [/i live in ([\w ]+)/i, "location"],
            [/i speak ([\w ]+)/i, "languages"],
            [/i use (python|javascript|react|typescript|java|golang|rust)/i, "primary_language"],
          ];
          for (const [rx, key] of patterns) {
            const m = msg.match(rx);
            if (m && m[1] && m[1].length > 1 && m[1].length < 50)
              extractedFacts[key] = { value: m[1].trim(), ts: conv.ts };
          }

          // Save only recent meaningful messages as memories
          if (recentMemories.length < 100 && msg.length > 15) {
            recentMemories.push({
              id:       conv.ts + recentMemories.length,
              ts:       conv.ts,
              platform: conv.source,
              query:    msg.slice(0, 200),
              summary:  msg.slice(0, 150),
              topic,
              lang:     lang.code,
              intent:   "explain",
              saved:    0,
            });
          }
        }
      }

      // ── Build profile insights ────────────────────
      const topTopics   = Object.entries(topicCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const topLangs    = Object.entries(langCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
      const dominantLang= topLangs[0]?.[0] || "en";

      // Infer overall expertise from hints
      const expScores   = {beginner:1, intermediate:2, expert:3};
      const expVals     = Object.values(expertiseHints).map(e=>expScores[e]||2);
      const avgExp      = expVals.length ? expVals.reduce((a,b)=>a+b,0)/expVals.length : 2;
      const overallExp  = avgExp < 1.5 ? "beginner" : avgExp > 2.5 ? "expert" : "intermediate";

      return {
        source:         conversations[0]?.source || "unknown",
        totalMessages,
        conversationCount: conversations.length,
        topTopics,
        topLangs,
        dominantLang,
        overallExpertise: overallExp,
        expertisePerTopic: expertiseHints,
        facts:          extractedFacts,
        memories:       recentMemories,
        profileSummary: `User primarily asks about ${topTopics.slice(0,3).map(([t])=>t.replace(/_/g," ")).join(", ")}. ${overallExp} level. Main language: ${dominantLang}.`,
      };
    } catch(e) {
      console.error("Smart import error:", e);
      return null;
    }
  }

  // ── Apply imported data to memory ────────────────
  async function applyImport(parsed) {
    if (!parsed) return { ok: false, error: "Could not parse the file" };

    // Save facts
    const existingFacts = loadFacts();
    const merged = { ...existingFacts, ...parsed.facts };
    localStorage.setItem(FK, JSON.stringify(merged));

    // Save profile insights
    const profile = loadProfile();
    if (!profile.topicCounts) profile.topicCounts = {};
    if (!profile.langCounts) profile.langCounts = {};

    parsed.topTopics.forEach(([t,c]) => {
      profile.topicCounts[t] = (profile.topicCounts[t]||0) + c;
    });
    parsed.topLangs.forEach(([l,c]) => {
      profile.langCounts[l] = (profile.langCounts[l]||0) + c;
    });
    profile.expertisePerTopic = { ...(profile.expertisePerTopic||{}), ...parsed.expertisePerTopic };
    profile.totalInteractions = (profile.totalInteractions||0) + parsed.totalMessages;
    profile.dominantLang = parsed.dominantLang;
    profile.topTopics = Object.entries(profile.topicCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t])=>t);
    profile.importedFrom = parsed.source;
    profile.importedAt   = Date.now();
    localStorage.setItem(PK, JSON.stringify(profile));

    // Save recent memories (merge, no duplicates)
    const existing    = loadLocal();
    const existingIds = new Set(existing.map(m=>m.id));
    const newMems     = parsed.memories.filter(m=>!existingIds.has(m.id));
    const mergedMems  = [...newMems, ...existing].slice(0,MAX);
    localStorage.setItem(LK, JSON.stringify(mergedMems));

    return {
      ok:            true,
      source:        parsed.source,
      memoriesAdded: newMems.length,
      factsFound:    Object.keys(parsed.facts).length,
      totalMessages: parsed.totalMessages,
      insights: {
        topTopics:       parsed.topTopics,
        languages:       parsed.topLangs,
        expertise:       parsed.overallExpertise,
        profileSummary:  parsed.profileSummary,
      },
    };
  }

  // ── Get proactive suggestions ────────────────────
  async function getSuggestions(query, topic) {
    const rel = await getRelevant(query, topic, "en", 3);
    return rel
      .filter(m => m.platform && m.platform !== "setu")
      .map(m => `You asked on ${m.platform}: "${(m.query||"").slice(0,60)}..." — related?`);
  }

  // ── Stats ────────────────────────────────────────
  async function getStats() {
    const list    = loadLocal();
    const facts   = loadFacts();
    const profile = loadProfile();
    const plats={}, langs={}, topics={};
    let totalSaved = 0;
    list.forEach(m => {
      plats[m.platform]  = (plats[m.platform]  || 0) + 1;
      langs[m.lang]      = (langs[m.lang]       || 0) + 1;
      topics[m.topic]    = (topics[m.topic]     || 0) + 1;
      totalSaved        += (m.saved || 0);
    });
    return {
      total:     list.length,
      facts:     Object.keys(facts).length,
      totalSaved,
      profile,
      platforms: Object.entries(plats).sort((a,b)=>b[1]-a[1]),
      langs:     Object.entries(langs).sort((a,b)=>b[1]-a[1]),
      topics:    Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,5),
      recent:    list.slice(0,10),
    };
  }

  // ── Helpers ──────────────────────────────────────
  function extractText(content) {
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) return content.map(extractText).filter(Boolean).join(" ");
    if (content?.parts) return extractText(content.parts);
    if (content?.text)  return content.text.trim();
    return "";
  }

  function formatAge(ts) {
    const s = Math.floor((Date.now()-ts)/1000);
    if (s < 60)    return "now";
    if (s < 3600)  return Math.floor(s/60)+"m ago";
    if (s < 86400) return Math.floor(s/3600)+"h ago";
    return Math.floor(s/86400)+"d ago";
  }

  function clearAll() {
    localStorage.removeItem(LK);
    localStorage.removeItem(FK);
    localStorage.removeItem(PK);
  }

  function exportAll() {
    const data = {
      memories: loadLocal(),
      facts:    loadFacts(),
      profile:  loadProfile(),
      exported: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "setu-memory.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return {
    init, save, getContext, getRelevant,
    getSuggestions, getStats, extractFacts,
    smartImport, applyImport,
    clearAll, exportAll, formatAge,
    loadFacts, loadProfile,
  };
})();

if (typeof module !== "undefined") module.exports = MEMU;
