/**
 * SETU Extension Content Script v5
 * Features: Model-specific prompts, memory context, CO2 display,
 *           One Shot mode, expertise awareness, question quality score
 */

const PLATFORM = (() => {
  const h = location.hostname;
  if (h.includes("claude.ai"))     return "claude";
  if (h.includes("perplexity.ai")) return "perplexity";
  if (h.includes("grok.com"))      return "grok";
  if (h.includes("gemini.google")) return "gemini";
  return "chatgpt";
})();

const SEL = {
  chatgpt:    ["#prompt-textarea","textarea[data-id]","textarea"],
  claude:     [".ProseMirror[contenteditable]","[contenteditable='true']","textarea"],
  perplexity: ["textarea","[contenteditable='true']"],
  grok:       ["textarea","[contenteditable='true']"],
  gemini:     [".ql-editor","[contenteditable='true']","textarea"],
};

function getInput() {
  for (const s of (SEL[PLATFORM]||["textarea"])) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getText(el) { return (el?(el.value||el.innerText||el.textContent||""):"").trim(); }

function setText(el, text) {
  if (!el) return;
  if (el.tagName==="TEXTAREA"||el.tagName==="INPUT") {
    const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")?.set;
    if(s)s.call(el,text);else el.value=text;
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  } else {
    el.focus();
    document.execCommand("selectAll",false,null);
    document.execCommand("insertText",false,text);
    el.dispatchEvent(new InputEvent("input",{bubbles:true,data:text}));
  }
}

function createUI() {
  if (document.getElementById("setu-btn")) return;

  const btn = document.createElement("button");
  btn.id = "setu-btn";
  btn.innerHTML = `<span class="setu-dot"></span><span>SETU</span>`;
  btn.onclick = handleClick;
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "setu-panel";
  panel.innerHTML = `
    <div class="sp-hdr">
      <div>
        <div class="sp-logo">SETU</div>
        <div class="sp-sub">सेतु · ${PLATFORM.toUpperCase()} · ANY LANGUAGE</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <label style="font-size:10px;color:#484f58;cursor:pointer;display:flex;align-items:center;gap:4px">
          <input type="checkbox" id="sp-oneshot" style="width:12px;height:12px"> One Shot
        </label>
        <button class="sp-x" onclick="document.getElementById('setu-panel').style.display='none'">✕</button>
      </div>
    </div>
    <div id="sp-body"></div>`;
  document.body.appendChild(panel);
}

async function handleClick() {
  const el    = getInput();
  const text  = getText(el);
  const panel = document.getElementById("setu-panel");
  const body  = document.getElementById("sp-body");
  const oneShotMode = document.getElementById("sp-oneshot")?.checked || false;

  panel.style.display = "block";
  body.innerHTML = `<div class="sp-loading"><div class="sp-dots"><span></span><span></span><span></span></div><div>KOVA optimizing · MEMU checking memory...</div></div>`;

  if (!text || text.length < 2) {
    body.innerHTML = `<div class="sp-empty">Type your question first, then click SETU.</div>`;
    return;
  }

  const lang = KOVA.detectLang(text);
  const topic= KOVA.detectTopic(text);
  const ctx  = await MEMU.getContext(text, topic, lang.code, 120);
  const res  = KOVA.optimize(text, PLATFORM, ctx, oneShotMode);
  const cost = COST.preview(res.tokOrig, res.tokOpt, PLATFORM);

  // Energy impact
  const energyInfo = ENERGY.preview(Math.round(250*0.35), PLATFORM);

  await COST.record(PLATFORM, res.tokOrig, res.tokOpt);
  await MEMU.save({
    platform: PLATFORM, query: text, summary: text.slice(0,150),
    topic: res.topic, lang: res.lang.code, intent: res.intent,
    expertise: res.expertise, tokSaved: res.saved||0,
  });

  // Quality score
  const q = res.quality;
  const qColor = q.score >= 8 ? "#3fb950" : q.score >= 5 ? "#d29922" : "#f85149";

  const badges = [];
  if (res.lang.code !== "en") badges.push({t:res.lang.name, c:"pu"});
  if (res.contextUsed)        badges.push({t:"memory used", c:"pu"});
  if (res.expertise !== "intermediate") badges.push({t:res.expertise, c:"bl"});
  if (oneShotMode)            badges.push({t:"one shot", c:"gn"});
  badges.push({t:res.topic.replace(/_/g," "), c:"bl"});
  badges.push({t:res.intent, c:"gy"});

  body.innerHTML = `
    <div class="sp-qscore" style="background:rgba(${q.score>=8?'63,185,80':q.score>=5?'210,153,34':'248,81,73'},0.1);border:1px solid ${qColor};border-radius:6px;padding:6px 10px;display:flex;align-items:center;gap:8px;font-size:10px;color:${qColor}">
      <span style="font-size:14px;font-weight:700">${q.score}/10</span>
      <span>Question quality: ${q.label}${q.issues.length?" · "+q.issues[0]:""}</span>
    </div>

    <div class="sp-cbar">
      <div class="sp-cc"><div class="sp-cv r">${res.tokOrig}</div><div class="sp-cl">input tokens</div><div class="sp-cu">${cost.origUSD}</div></div>
      <div class="sp-ca">→</div>
      <div class="sp-cc"><div class="sp-cv">${res.tokOpt}</div><div class="sp-cl">optimized</div><div class="sp-cu">${cost.optUSD}</div></div>
      <div class="sp-ca">→</div>
      <div class="sp-cc"><div class="sp-cv g">~-${Math.round(250*0.35)}</div><div class="sp-cl">output saved</div><div class="sp-cu g">save ${cost.savedUSD}</div></div>
    </div>

    <div class="sp-energy">🌱 ${energyInfo.message}</div>

    <div>
      <div class="sp-lbl">Optimized for ${PLATFORM}${oneShotMode?" · One Shot mode":""}</div>
      <div class="sp-opt" id="sp-opt" contenteditable="true">${esc(res.optimized)}</div>
    </div>

    <div class="sp-badges">${badges.map(b=>`<span class="sp-badge ${b.c}">${b.t}</span>`).join("")}</div>
    ${res.contextUsed?`<div class="sp-mem">🧠 Memory from past conversations added</div>`:""}
    <div class="sp-note">${res.note}</div>

    <div class="sp-btns">
      <button class="sp-apply" id="sp-apply">✓ Use this prompt</button>
      <button class="sp-keep"  id="sp-keep">Keep original</button>
    </div>`;

  document.getElementById("sp-apply").onclick = () => {
    const opt = document.getElementById("sp-opt")?.textContent || res.optimized;
    setText(el, opt);
    document.getElementById("setu-panel").style.display = "none";
    if (el) { el.style.outline="2px solid #3fb950"; setTimeout(()=>{el.style.outline="";},1500); }
  };
  document.getElementById("sp-keep").onclick = () => {
    document.getElementById("setu-panel").style.display = "none";
  };
}

function esc(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/\n/g,"<br>");
}

function init() {
  if (document.getElementById("setu-btn")) return;
  createUI();
}

if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(init,1000));
else setTimeout(init,1000);

let _lastUrl = location.href;
new MutationObserver(()=>{
  if(location.href!==_lastUrl){_lastUrl=location.href;setTimeout(init,1500);}
}).observe(document.body||document.documentElement,{subtree:true,childList:true});
