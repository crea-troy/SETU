/**
 * MEMU for browser extension — uses chrome.storage.local
 * Same logic as pwa/memu.js but storage is chrome.storage
 */
const MEMU = (() => {
  const MAX = 300;

  async function save(data) {
    const {memories} = await chrome.storage.local.get("memories");
    const list = memories || [];
    list.unshift({
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
    });
    if (list.length > MAX) list.splice(MAX);
    await chrome.storage.local.set({memories:list});
    extractFacts(data.query || "");
  }

  async function getContext(query, topic, lang, maxTok=120) {
    const {memories, facts, setu_profile} = await chrome.storage.local.get(["memories","facts","setu_profile"]);
    const mems = memories || [], f = facts || {}, profile = setu_profile || {};
    const qw   = new Set(query.toLowerCase().split(/\s+/).filter(w=>w.length>3));
    const now  = Date.now();

    const rel = mems.map(m=>{
      const mw=new Set((m.query+" "+(m.summary||"")).toLowerCase().split(/\s+/));
      const ov=[...qw].filter(w=>mw.has(w)).length;
      return{...m,_s:ov*0.5+(m.topic===topic?3:0)+(m.lang===lang?1:0)+Math.exp(-0.04*(now-m.ts)/3600000)*0.2};
    }).filter(m=>m._s>0.3).sort((a,b)=>b._s-a._s).slice(0,3);

    let parts=[], tokens=0;
    if (profile.topTopics?.length) {
      const line=`[user expertise: ${profile.topTopics.slice(0,2).join(", ")}]`;
      const lt=Math.ceil(line.length/4);
      if(tokens+lt<maxTok){parts.push(line);tokens+=lt;}
    }
    Object.entries(f).slice(0,2).forEach(([k,v])=>{
      const line=`[${k}: ${v.value}]`;const lt=Math.ceil(line.length/4);
      if(tokens+lt<maxTok){parts.push(line);tokens+=lt;}
    });
    rel.forEach(m=>{
      const ago=formatAge(m.ts);
      const line=`[${m.platform} ${ago}: ${(m.summary||m.query||"").slice(0,60)}]`;
      const lt=Math.ceil(line.length/4);
      if(tokens+lt<maxTok){parts.push(line);tokens+=lt;}
    });
    return parts.length?parts.join("\n"):"";
  }

  async function extractFacts(text) {
    const {facts} = await chrome.storage.local.get("facts");
    const f = facts || {}; let changed = false;
    const patterns=[
      [/my name is (\w+)/i,"name"],
      [/i work (?:at|for|in) ([\w ]+)/i,"works_at"],
      [/i prefer ([\w ]+)/i,"preference"],
      [/i live in ([\w ]+)/i,"location"],
      [/i use (python|javascript|react|typescript)/i,"primary_language"],
    ];
    for(const[rx,k]of patterns){
      const m=text.match(rx);
      if(m&&m[1]&&m[1].length>1&&m[1].length<50){f[k]={value:m[1].trim(),ts:Date.now()};changed=true;}
    }
    if(changed) await chrome.storage.local.set({facts:f});
  }

  async function getStats() {
    const {memories,facts} = await chrome.storage.local.get(["memories","facts"]);
    const mems=memories||[],plats={},langs={};
    mems.forEach(m=>{plats[m.platform]=(plats[m.platform]||0)+1;langs[m.lang]=(langs[m.lang]||0)+1;});
    return{
      total:mems.length,facts:Object.keys(facts||{}).length,
      platforms:Object.entries(plats).sort((a,b)=>b[1]-a[1]),
      langs:Object.entries(langs).sort((a,b)=>b[1]-a[1]),
      recent:mems.slice(0,8),
    };
  }

  function formatAge(ts){
    const s=Math.floor((Date.now()-ts)/1000);
    if(s<60)return"now";if(s<3600)return Math.floor(s/60)+"m";
    if(s<86400)return Math.floor(s/3600)+"h";return Math.floor(s/86400)+"d";
  }

  async function clearAll(){await chrome.storage.local.clear();}

  async function exportAll(){
    const data=await chrome.storage.local.get(null);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="setu-data.json";a.click();
    URL.revokeObjectURL(url);
  }

  return{save,getContext,extractFacts,getStats,clearAll,exportAll,formatAge};
})();
