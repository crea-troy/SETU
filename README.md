# SETU — सेतु
### Bridge between humans and AI

> **Any language. Any model. Works invisibly. Free forever.**

SETU rewrites your question for the exact AI you're using — getting better answers automatically, in any language. Press Enter as normal. SETU intercepts, rewrites, and sends. You never see a popup.

**Hindi. Gujarati. Arabic. Chinese. German. English. 25+ languages.**

---

## Why SETU exists

Every AI prompt tool today assumes English. 1.5 billion people think in other languages first. And even English speakers waste time writing vague questions and getting vague answers.

SETU fixes both — invisibly, for free, for everyone.

---

## How it works

**You type normally. SETU works silently.**

```
You type:    "hey can you explain diabetes to me basically"

SETU sends:  <question>What is diabetes and how is it managed?</question>
             <cover>
             1. Definition: what happens in body (key/lock analogy)
             2. Type 1 vs Type 2: one key difference
             3. Main symptoms (max 4)
             4. Management: diet + medication + lifestyle
             </cover>
             <constraint>Max 200 words. No jargon. Not medical advice.</constraint>

You get:     A focused, structured answer. First try. No follow-ups.
```

Works in Hindi too — type in Hindi, SETU detects the language, adds `Respond in Hindi`, Claude replies in Hindi with perfect structure.

**Auto mode** (default): press Enter → SETU rewrites → sends. Zero extra steps.  
**Manual mode**: click SETU button → see the optimized prompt → choose to use it.

---

## Install

### Browser Extension (Chrome / Brave / Edge)

```
1. Download this repo (green button → Download ZIP)
2. Unzip it
3. Open chrome://extensions
4. Enable Developer Mode (top right)
5. Click "Load unpacked" → select the extension/ folder
6. Go to claude.ai or chatgpt.com
7. Type a question → press Enter → SETU works automatically
```

### Mobile PWA (any phone, no App Store needed)

```
1. Open crea-troy.github.io/SETU/pwa in your mobile browser
2. iOS:     tap Share → Add to Home Screen
   Android: tap the install prompt
3. Type or speak your question → optimize → copy to any AI
```

Works offline. No account needed.

---

## Features

| Feature | What it does |
|---|---|
| **Auto intercept** | Rewrites your prompt silently when you press Enter — no popup, no copy-paste |
| **KOVA v4** | Rewrites for the specific model — Claude gets XML, ChatGPT gets numbered lists |
| **25+ languages** | Detects Hindi, Gujarati, Arabic, Chinese, German, French, Spanish, Japanese, Korean + more |
| **Device memory** | Remembers your topics, expertise, facts across all AI sites (free, on your device) |
| **Cloud memory** | Sync memory across devices — Pro plan |
| **Import history** | Upload ChatGPT / Claude / Gemini / Grok export → SETU learns you instantly |
| **Question quality score** | 1–10 score before you send — tells you what's missing |
| **One Shot mode** | Complete answer in one message, no clarifying questions |
| **Expertise detection** | Detects beginner vs expert — adjusts depth automatically |
| **CO₂ dashboard** | Shows real energy saved per message |
| **Offline first** | KOVA runs entirely in your browser — no internet needed to optimize |

---

## Memory: free vs Pro

| | Free | Pro ($4/month) |
|---|---|---|
| Memory storage | On your device (browser) | Cloud — syncs across all devices |
| Import chat history | ✓ | ✓ + auto cloud sync |
| Cross-device | ✗ | ✓ |
| Memory lost if browser cleared | Yes | No |

Free users get full KOVA (the core engine) forever. Memory sync is the upgrade.

---

## Supported platforms

| Platform | Auto intercept | Template style |
|---|---|---|
| Claude | ✓ | XML structure |
| ChatGPT | ✓ | Numbered lists |
| Perplexity | ✓ | Web-search-aware |
| Gemini | ✓ | Context + examples |
| Grok | ✓ | Short and direct |

---

## Import your chat history

SETU reads your conversation history and extracts **insights** — not raw copy-paste.

It learns: topics you discuss most · your expertise level · your language · facts you've shared.

**How to export:**

| Platform | Steps |
|---|---|
| ChatGPT | Settings → Data Controls → Export Data → wait for email → extract ZIP → upload conversations.json |
| Claude | Settings → Privacy → Export conversations → upload JSON |
| Gemini | takeout.google.com → select Gemini Apps → export → find JSON |
| Grok | x.com → Settings → Privacy → Download archive → find grok.json |

---

## Project structure

```
setu/
├── extension/          ← Browser extension (Chrome, Brave, Edge)
│   ├── manifest.json
│   ├── kova.js         ← Prompt rewriter engine
│   ├── memu_ext.js     ← Memory (chrome.storage — works across all AI sites)
│   ├── content.js      ← Auto intercept + manual popup
│   ├── popup.html      ← Extension toolbar popup
│   └── background.js
│
├── pwa/                ← Mobile PWA (add to home screen)
│   ├── index.html      ← Full app: voice, import, sessions, CO₂
│   ├── kova.js         ← Same KOVA engine
│   ├── memu.js         ← Memory + smart import + cloud sync
│   └── sw.js           ← Offline support
│
├── website/            ← Landing page (crea-troy.github.io/setu)
│   └── index.html
│
├── supabase/           ← Database schema for self-hosters
│   └── schema.sql
│
└── docs/
    └── DEPLOY.md       ← Complete deployment guide
```

---

## Deploy yourself (free)

| Service | What | Cost |
|---|---|---|
| GitHub Pages | Website + PWA | Free forever |
| Render.com | API server | Free hobby tier |
| Supabase | Database + auth | Free up to 500MB |
| **Total** | | **$0/month** |

Full guide in [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Tech stack

- **KOVA** — pure JavaScript, runs in browser, zero dependencies, zero build step
- **MEMU** — chrome.storage (free) or cloud API (Pro), no server needed for basic use
- **Extension** — Chrome Manifest v3
- **PWA** — vanilla HTML/JS, offline-capable via service worker
- No React. No Node. No build step. Download and open.

---

## Contributing

All contributions welcome:

- **New language support** — improve detection for your language
- **New topic templates** — better prompts for your field
- **New model support** — Llama, Mistral, Cohere templates
- **Bug reports** — especially for edge cases in topic detection

```bash
git clone https://github.com/crea-troy/setu.git
cd setu
# Edit extension/kova.js for topic detection or templates
# Open a PR
```

---

## Business model — open core

The extension, PWA, and KOVA engine are MIT licensed and free forever.  
Revenue comes from Pro cloud memory sync ($4/month) and Enterprise (custom).

---

## Links

- **Website:** [crea-troy.github.io/SETU](https://crea-troy.github.io/SETU)
- **PWA:** [crea-troy.github.io/SETU/pwa](https://crea-troy.github.io/SETU/pwa)
- **Contact:** setu@crea-troy.com
- **Twitter:** [@crea_troy](https://twitter.com/crea_troy)

---

*Built with ♥ for the 1.5 billion people whose language AI forgot.*  
*Free forever. Open source. Bridge between humans and AI.*
