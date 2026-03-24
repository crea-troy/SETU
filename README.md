# SETU — सेतु
### Bridge between humans and AI

> **Any language. Any model. Free forever.**

SETU rewrites your question for the exact AI model you're using — getting better answers in fewer tokens, in any language. Works on ChatGPT, Claude, Perplexity, Gemini, and Grok.

**Hindi. Gujarati. Arabic. Chinese. German. English. 25+ languages.**

---

## Why SETU exists

Eric Schmidt said: *"Why do we not have an AI system that just educates everyone in their own language, in the way that they learn?"*

SETU is the answer. Every AI prompt tool today assumes English. 1.5 billion people think in other languages first. SETU was built for them — and for everyone who wants better AI answers without learning prompt engineering.

---

## What it does

```
You type:    "Hey can you please explain diabetes to me basically"

SETU sends:  <question>What is diabetes and how is it managed?</question>
             <cover>
             1. Definition: what happens in body (simple analogy)
             2. Type 1 vs Type 2: key difference
             3. Main symptoms (max 4)
             4. Management: diet + medication + lifestyle
             5. Warning signs
             </cover>
             <constraint>Max 200 words. No jargon. Not medical advice.</constraint>

Result:      Focused answer, first try. No follow-ups needed.
             35% fewer output tokens. Real money saved.
```

Works in Hindi too:

```
You type:    "मुझे diabetes के बारे में बताओ"
SETU detects: Hindi → applies health template → adds "Respond in Hindi"
Claude replies in Hindi with perfect structure
```

---

## Install in 2 minutes

### Browser Extension (Brave / Chrome / Edge)

Works on ChatGPT, Claude, Perplexity, Grok, Gemini. SETU button appears automatically.

```
1. Download this repo (green button → Download ZIP)
2. Unzip it
3. Open brave://extensions (or chrome://extensions)
4. Enable Developer Mode (top right toggle)
5. Click "Load unpacked" → select the extension/ folder
6. Go to claude.ai or chatgpt.com
7. SETU button appears bottom-right — click it
```

### Mobile PWA (any phone, no App Store)

```
1. Open crea-troy.github.io/SETU in your mobile browser
2. iOS:     tap Share → Add to Home Screen
   Android: tap Install prompt
3. Type or speak your question → optimize → copy → paste
```

Works offline. No account needed.

---

## Features

| Feature | What it does |
|---|---|
| **KOVA v4** | Rewrites your question for the specific model — not just adds instructions |
| **25+ Languages** | Hindi, Gujarati, Arabic, Chinese, German, French, Spanish, Japanese, Korean, and more |
| **Cross-platform memory** | Ask on ChatGPT, follow up on Claude — SETU connects them |
| **One Shot mode** | "Give complete answer, don't ask for clarification" — perfect answer in one message |
| **Expertise detection** | Detects if you're beginner or expert — adjusts depth automatically |
| **Question quality score** | 1–10 score before you send — tells you what's missing |
| **Import history** | Upload ChatGPT/Claude/Gemini/Grok export JSON — SETU learns you instantly |
| **Save Q+A sessions** | Name and save full conversations — builds better prompts next time |
| **Energy / CO₂ dashboard** | Shows real CO₂ saved per message — makes the invisible visible |
| **Perplexity web-search** | Adds "as of 2025, use recent sources" — activates Perplexity's web search |
| **Offline first** | KOVA runs entirely in browser — no internet needed to optimize |

---

## Supported models

| Model | Template style |
|---|---|
| Claude | XML structure — `<question>`, `<cover>`, `<constraint>` |
| ChatGPT | Numbered lists with output constraints |
| Perplexity | Web-search-aware — current year reference, "use recent sources" |
| Gemini | Context + examples first |
| Grok | Short and direct |

---

## Topic detection (19/20 accuracy)

KOVA uses **combination detection** — not single keywords. This fixes the main problem with other prompt tools.

```
"build AI company"   → finance_business  ✓ (not code)
"build a python app" → code_python       ✓
"explain ML"         → science_ml        ✓ (not education)
"make money online"  → finance_business  ✓
"write a function"   → code_general      ✓
"write a cover letter" → career          ✓
```

**25+ topics covered:** business, code (Python, JS, DB, DevOps, Git, algorithms), ML/AI, physics, math, biology, chemistry, health (diabetes, mental, nutrition, fitness), finance (invest, personal, tax), career, language learning, travel, legal, education, and more.

---

## Import from any AI

SETU reads your conversation history and extracts **insights** — not raw copy-paste.

It learns:
- What topics you discuss most
- Your expertise level per topic
- What language you use
- Facts you've shared (name, role, location, tools)

Then every future prompt uses that context automatically.

**Supports:** ChatGPT export JSON, Claude export JSON, Gemini, Grok, any AI that exports JSON.

```
How to export from ChatGPT:
Settings → Data Controls → Export Data → wait for email → download ZIP → extract → upload conversations.json

How to export from Claude:
Settings → Privacy → Export conversations → upload the JSON file
```

---

## Developer API

Add SETU memory to any app in 3 lines. Free tier: 10,000 requests/month.

```python
# Get memory context before calling your AI
ctx = requests.post("https://your-api.onrender.com/api/v1/context",
    headers={"X-SETU-Key": "sk_setu_your_key"},
    json={"user_id": "user_123", "query": user_message}
).json()["context"]

# Add to your prompt
prompt = ctx + "\n\nUser: " + user_message

# Save after responding
requests.post("https://your-api.onrender.com/api/v1/save",
    headers={"X-SETU-Key": "sk_setu_your_key"},
    json={"user_id": "user_123", "query": user_message, "response": ai_response}
)
```

### Deploy the API free (Render.com)

```bash
# 1. Fork this repo
# 2. render.com → New Web Service → connect your fork
# 3. Root directory: api/
# 4. Build command: pip install flask flask-cors supabase
# 5. Start command: python server.py
# 6. Add env vars: SUPABASE_URL, SUPABASE_KEY
# 7. Deploy — free hobby tier, always on
```

### API endpoints

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/v1/context` | Get memory context for a user + query |
| POST | `/api/v1/save` | Save interaction to memory |
| POST | `/api/v1/fact` | Add permanent fact about a user |
| DELETE | `/api/v1/user/:id` | Delete all user data (GDPR) |
| POST | `/api/v1/keys` | Generate free API key |

---

## Project structure

```
setu/
├── extension/          ← Browser extension (Brave, Chrome, Edge)
│   ├── manifest.json
│   ├── kova.js         ← Prompt rewriter
│   ├── memu_ext.js     ← Memory (chrome.storage)
│   ├── content.js      ← Injected into AI sites
│   ├── content.css
│   ├── popup.html      ← Extension toolbar popup
│   └── background.js
│
├── pwa/                ← Mobile PWA (add to home screen)
│   ├── index.html      ← Full app: voice, import, sessions, CO₂
│   ├── kova.js         ← Same KOVA engine
│   ├── memu.js         ← Memory + smart import
│   ├── energy.js       ← CO₂ tracker
│   ├── cost.js         ← Token cost tracker
│   ├── auth.js         ← Supabase login (optional)
│   ├── manifest.json
│   └── sw.js           ← Offline support
│
├── website/            ← Landing page
│   └── index.html      ← Warm multilingual design
│
├── api/                ← Developer API (deploy to Render.com)
│   └── server.py       ← Flask + Supabase
│
├── supabase/           ← Database schema
│   └── schema.sql      ← Paste in Supabase SQL Editor
│
└── docs/
    └── DEPLOY.md       ← Complete step-by-step guide
```

---

## Self-host in 5 minutes

```bash
# Clone
git clone https://github.com/crea-troy/setu.git
cd setu

# Run PWA locally
cd pwa
python3 -m http.server 8080
# Open http://localhost:8080

# Run API locally
cd ../api
pip install flask flask-cors
python server.py
# API at http://localhost:8000
```

---

## Deploy online (free)

| Service | What | Cost |
|---|---|---|
| GitHub Pages | Website + PWA | Free forever |
| Render.com | API server | Free hobby tier |
| Supabase | Database + auth | Free up to 500MB |
| **Total** | | **$0/month** |

Full instructions in [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Business model — open core

| Tier | Price | What's included |
|---|---|---|
| **Free** | $0 forever | Extension, PWA, KOVA, MEMU, energy dashboard, import |
| **Pro** | $4/month | Cross-device sync, developer API, advanced multilingual |
| **Enterprise** | Custom | Team memory, analytics, SLA, white label |

The core product is MIT licensed and free forever. Revenue comes from developers and enterprises — which funds the free tier for everyone.

---

## Stack

- **KOVA** — pure JavaScript, runs in browser, zero dependencies
- **MEMU** — localStorage (free) or Supabase (Pro), zero server needed for basic use
- **Extension** — Chrome Manifest v3, works in Brave/Chrome/Edge
- **PWA** — vanilla HTML/JS, offline-capable via service worker
- **API** — Python Flask, deployable on any free hosting

No React. No Node. No build step. Download and open.

---

## Contributing

All contributions welcome. Good first areas:

- **New language support** — improve detection for your language
- **New topic templates** — better prompts for your field
- **New model support** — Llama, Mistral, Cohere templates
- **Bug reports** — especially for edge cases in topic detection

```bash
git clone https://github.com/crea-troy/setu.git
cd setu
# Edit core/kova.js for topic detection or templates
# Test with node kova_test.js
# Open a PR
```

---

## Real test results

From actual Claude API responses:

| Question | Without SETU | With SETU | Output saved |
|---|---|---|---|
| Diabetes (Hindi) | Vague, 800 words | Structured, 200 words | ~38% |
| Python TypeError | Generic debug | Root cause first, no preamble | ~35% |
| Build AI company | Code template (wrong!) | Business template (v4 fix) | correct answer |
| Explain ML | Education template | science_ml template | better answer |

---

## License

MIT — free to use, modify, distribute.

---

## Links

- **Website:** [crea-troy.github.io/SETU](https://crea-troy.github.io/SETU)
- **PWA:** [crea-troy.github.io/SETU/pwa](https://crea-troy.github.io/SETU/pwa)
- **Contact:** setu@crea-troy.com
- **Twitter:** [@crea_troy](https://twitter.com/crea_troy)

---

*Built with ♥ for the 1.5 billion people whose language AI forgot.*
*Free forever. Open source. Bridge between humans and AI.*
