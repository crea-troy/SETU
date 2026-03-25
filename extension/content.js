/**
 * SETU Extension Content Script v6
 *
 * Two modes, user controls which:
 *   AUTO mode  — intercepts Enter key, rewrites silently, no popup ever
 *   MANUAL mode — original popup flow (click SETU button → see optimized → apply)
 *
 * Default is AUTO mode. User can toggle in the SETU popup or extension popup.
 */

const PLATFORM = (() => {
  const h = location.hostname;
  if (h.includes("claude.ai"))     return "claude";
  if (h.includes("perplexity.ai")) return "perplexity";
  if (h.includes("grok.com"))      return "grok";
  if (h.includes("gemini.google")) return "gemini";
  return "chatgpt";
})();

// ── Input selectors per platform ────────────────────
const SEL = {
  chatgpt:    ["#prompt-textarea", "textarea[data-id]", "textarea"],
  claude:     [".ProseMirror[contenteditable]", "[contenteditable='true']", "textarea"],
  perplexity: ["textarea", "[contenteditable='true']"],
  grok:       ["textarea", "[contenteditable='true']"],
  gemini:     [".ql-editor", "[contenteditable='true']", "textarea"],
};

// ── Send button selectors per platform ──────────────
// Used in auto mode to trigger the actual send after rewriting
const SEND_SEL = {
  chatgpt:    ["button[data-testid='send-button']", "button[aria-label='Send message']"],
  claude:     ["button[aria-label='Send message']", "button[type='submit']"],
  perplexity: ["button[aria-label='Submit']", "button[type='submit']"],
  grok:       ["button[type='submit']", "button[aria-label='Send']"],
  gemini:     ["button[aria-label='Send message']", ".send-button"],
};

function getInput() {
  for (const s of (SEL[PLATFORM] || ["textarea"])) {
    const el = document.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getSendBtn() {
  for (const s of (SEND_SEL[PLATFORM] || [])) {
    const el = document.querySelector(s);
    if (el && !el.disabled) return el;
  }
  return null;
}

function getText(el) {
  return (el ? (el.value || el.innerText || el.textContent || "") : "").trim();
}

function setText(el, text) {
  if (!el) return;
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (s) s.call(el, text); else el.value = text;
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  }
}

// ── Settings (persisted in chrome.storage) ──────────
let _autoMode   = true;   // intercept Enter silently
let _oneShotMode = false;

async function loadSettings() {
  const data = await chrome.storage.local.get(["setu_auto_mode", "setu_oneshot"]);
  _autoMode    = data.setu_auto_mode !== false; // default ON
  _oneShotMode = data.setu_oneshot   === true;  // default OFF
}

async function saveSettings() {
  await chrome.storage.local.set({
    setu_auto_mode: _autoMode,
    setu_oneshot:   _oneShotMode,
  });
}

// ── Auto mode: invisible intercept ──────────────────
// Hooks the Enter key. When user presses Enter:
//   1. Prevents original send
//   2. Rewrites question with KOVA (uses memory context)
//   3. Puts rewritten text back in the box
//   4. Triggers the real send
//
// The user just types and gets better answers. Zero extra steps.
let _interceptAttached = false;

function attachIntercept() {
  if (_interceptAttached) return;
  const el = getInput();
  if (!el) return;
  _interceptAttached = true;

  el.addEventListener("keydown", async (e) => {
    // Only intercept Enter (not Shift+Enter which is newline)
    if (e.key !== "Enter" || e.shiftKey || !_autoMode) return;

    const text = getText(el);
    if (!text || text.length < 3) return; // let empty/very short sends through

    e.preventDefault();
    e.stopImmediatePropagation();

    // Show subtle "SETU optimizing..." indicator — disappears on its own
    showAutoIndicator();

    try {
      const lang  = KOVA.detectLang(text);
      const topic = KOVA.detectTopic(text);
      const ctx   = await MEMU.getContext(text, topic, lang.code, 120);
      const res   = KOVA.optimize(text, PLATFORM, ctx, _oneShotMode);

      // Save to memory
      await MEMU.save({
        platform: PLATFORM, query: text, summary: text.slice(0, 150),
        topic: res.topic, lang: res.lang.code, intent: res.intent,
        expertise: res.expertise, tokSaved: res.saved || 0,
      });

      // Replace text in box with optimized version
      setText(el, res.optimized);

      // Brief flash on the input to show SETU acted
      el.style.outline = "2px solid #3fb950";
      setTimeout(() => { el.style.outline = ""; }, 800);

    } catch (err) {
      // If anything fails, fall through and send the original text
      setText(el, text);
    }

    // Trigger the send — slight delay so the React/Vue state updates
    setTimeout(() => triggerSend(el), 80);
  }, true); // capture phase — runs before any site listener
}

function triggerSend(el) {
  // Try clicking the send button
  const btn = getSendBtn();
  if (btn) { btn.click(); return; }

  // Fallback: dispatch Enter on the input element
  el.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter", code: "Enter", keyCode: 13,
    which: 13, bubbles: true, cancelable: true,
  }));
  el.dispatchEvent(new KeyboardEvent("keyup", {
    key: "Enter", code: "Enter", keyCode: 13,
    which: 13, bubbles: true,
  }));
}

// ── Auto mode indicator ──────────────────────────────
// Small non-intrusive toast that appears for 1.2s then fades
function showAutoIndicator() {
  let ind = document.getElementById("setu-auto-ind");
  if (!ind) {
    ind = document.createElement("div");
    ind.id = "setu-auto-ind";
    ind.style.cssText = `
      position:fixed;bottom:80px;right:16px;z-index:999999;
      background:#161b22;color:#3fb950;border:1px solid #3fb950;
      border-radius:8px;padding:6px 12px;font-size:12px;font-family:monospace;
      opacity:0;transition:opacity 0.2s;pointer-events:none;
    `;
    document.body.appendChild(ind);
  }
  ind.textContent = "⚡ SETU optimizing…";
  ind.style.opacity = "1";
  clearTimeout(ind._t);
  ind._t = setTimeout(() => { ind.style.opacity = "0"; }, 1200);
}

// ── MANUAL mode UI ────────────────────────────────────
// Original click-to-optimize popup — now also has Auto mode toggle
function createUI() {
  if (document.getElementById("setu-btn")) return;

  const btn = document.createElement("button");
  btn.id = "setu-btn";
  btn.innerHTML = `<span class="setu-dot"></span><span>SETU</span>`;
  btn.onclick = handleManualClick;
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "setu-panel";
  panel.innerHTML = `
    <div class="sp-hdr">
      <div>
        <div class="sp-logo">SETU</div>
        <div class="sp-sub">सेतु · ${PLATFORM.toUpperCase()} · ANY LANGUAGE</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
        <label style="font-size:10px;color:#8b949e;cursor:pointer;display:flex;align-items:center;gap:4px" title="Auto mode rewrites your prompt silently when you press Enter">
          <input type="checkbox" id="sp-auto" style="width:12px;height:12px"> Auto
        </label>
        <label style="font-size:10px;color:#8b949e;cursor:pointer;display:flex;align-items:center;gap:4px">
          <input type="checkbox" id="sp-oneshot" style="width:12px;height:12px"> One Shot
        </label>
        <button class="sp-x" onclick="document.getElementById('setu-panel').style.display='none'">✕</button>
      </div>
    </div>
    <div id="sp-body"></div>`;
  document.body.appendChild(panel);

  // Sync toggle state from storage
  loadSettings().then(() => {
    const autoChk = document.getElementById("sp-auto");
    const shotChk = document.getElementById("sp-oneshot");
    if (autoChk) { autoChk.checked = _autoMode; autoChk.onchange = e => { _autoMode = e.target.checked; saveSettings(); }; }
    if (shotChk) { shotChk.checked = _oneShotMode; shotChk.onchange = e => { _oneShotMode = e.target.checked; saveSettings(); }; }
  });
}

// ── Manual click handler (original popup flow) ───────
async function handleManualClick() {
  const el    = getInput();
  const text  = getText(el);
  const panel = document.getElementById("setu-panel");
  const body  = document.getElementById("sp-body");

  panel.style.display = "block";
  body.innerHTML = `<div class="sp-loading"><div class="sp-dots"><span></span><span></span><span></span></div><div>KOVA optimizing · MEMU checking memory...</div></div>`;

  if (!text || text.length < 2) {
    body.innerHTML = `<div class="sp-empty">Type your question first, then click SETU.</div>`;
    return;
  }

  const lang  = KOVA.detectLang(text);
  const topic = KOVA.detectTopic(text);
  const ctx   = await MEMU.getContext(text, topic, lang.code, 120);
  const res   = KOVA.optimize(text, PLATFORM, ctx, _oneShotMode);
  const cost  = COST.preview(res.tokOrig, res.tokOpt, PLATFORM);
  const energyInfo = ENERGY.preview(Math.round(250 * 0.35), PLATFORM);

  await COST.record(PLATFORM, res.tokOrig, res.tokOpt);
  await MEMU.save({
    platform: PLATFORM, query: text, summary: text.slice(0, 150),
    topic: res.topic, lang: res.lang.code, intent: res.intent,
    expertise: res.expertise, tokSaved: res.saved || 0,
  });

  const q = res.quality;
  const qColor = q.score >= 8 ? "#3fb950" : q.score >= 5 ? "#d29922" : "#f85149";

  const badges = [];
  if (res.lang.code !== "en")         badges.push({ t: res.lang.name,                c: "pu" });
  if (res.contextUsed)                badges.push({ t: "memory used",                c: "pu" });
  if (res.expertise !== "intermediate") badges.push({ t: res.expertise,              c: "bl" });
  if (_oneShotMode)                   badges.push({ t: "one shot",                   c: "gn" });
  badges.push({ t: res.topic.replace(/_/g, " "), c: "bl" });
  badges.push({ t: res.intent,                   c: "gy" });

  body.innerHTML = `
    <div class="sp-qscore" style="background:rgba(${q.score>=8?'63,185,80':q.score>=5?'210,153,34':'248,81,73'},0.1);border:1px solid ${qColor};border-radius:6px;padding:6px 10px;display:flex;align-items:center;gap:8px;font-size:10px;color:${qColor}">
      <span style="font-size:14px;font-weight:700">${q.score}/10</span>
      <span>Question quality: ${q.label}${q.issues.length ? " · " + q.issues[0] : ""}</span>
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
      <div class="sp-lbl">Optimized for ${PLATFORM}${_oneShotMode ? " · One Shot mode" : ""}</div>
      <div class="sp-opt" id="sp-opt" contenteditable="true">${esc(res.optimized)}</div>
    </div>

    <div class="sp-badges">${badges.map(b => `<span class="sp-badge ${b.c}">${b.t}</span>`).join("")}</div>
    ${res.contextUsed ? `<div class="sp-mem">🧠 Memory from past conversations added</div>` : ""}
    <div class="sp-note">${res.note}</div>

    <div class="sp-btns">
      <button class="sp-apply" id="sp-apply">✓ Use this prompt</button>
      <button class="sp-keep"  id="sp-keep">Keep original</button>
    </div>`;

  document.getElementById("sp-apply").onclick = () => {
    const opt = document.getElementById("sp-opt")?.textContent || res.optimized;
    setText(el, opt);
    document.getElementById("setu-panel").style.display = "none";
    if (el) { el.style.outline = "2px solid #3fb950"; setTimeout(() => { el.style.outline = ""; }, 1500); }
  };
  document.getElementById("sp-keep").onclick = () => {
    document.getElementById("setu-panel").style.display = "none";
  };
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

// ── Init ──────────────────────────────────────────────
async function init() {
  if (document.getElementById("setu-btn")) return;
  await loadSettings();
  createUI();
  attachIntercept();
}

// Re-attach intercept when input appears (SPAs replace the DOM on navigation)
function watchForInput() {
  const obs = new MutationObserver(() => {
    if (!_interceptAttached) attachIntercept();
  });
  obs.observe(document.body || document.documentElement, { subtree: true, childList: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1000));
} else {
  setTimeout(init, 1000);
}

// Re-init on SPA navigation (ChatGPT, Claude use pushState routing)
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    _interceptAttached = false;
    setTimeout(init, 1500);
  }
}).observe(document.body || document.documentElement, { subtree: true, childList: true });

watchForInput();
