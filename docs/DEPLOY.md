# SETU v5 — Complete Deploy Guide
# GitHub Pages (free) · Zero cost · Live in 10 minutes

## Project structure

```
SETU-V5/
├── core/           ← Shared engine (KOVA, MEMU, COST, ENERGY)
├── pwa/            ← Mobile PWA → deploy to GitHub Pages
├── extension/      ← Browser extension → load in Brave/Chrome
├── website/        ← Landing page → deploy to GitHub Pages
├── api/            ← Developer API → deploy to Render.com (free)
├── supabase/       ← Database schema → paste in Supabase SQL Editor
└── docs/           ← This file
```

---

## Day 1 — GitHub Pages (1 hour, free forever)

### Step 1 — Create repo
```
github.com → New repository → name: setu → Public → Create
```

### Step 2 — Push code
```bash
cd SETU-V5
git init
git add .
git commit -m "SETU v5 - Bridge between humans and AI"
git remote add origin https://github.com/crea-troy/setu.git
git branch -M main
git push -u origin main
```
Use your GitHub token as password (Settings → Developer Settings → Personal Access Tokens).

### Step 3 — Enable GitHub Pages for website
```
github.com/crea-troy/setu → Settings → Pages
Source: Deploy from branch
Branch: main
Folder: /website
Save
```
Wait 2 minutes → website live at: https://crea-troy.github.io/setu

### Step 4 — Enable GitHub Pages for PWA
In repo settings → Pages → change Folder to /pwa
OR create a second repo called "setu-app" just for the PWA.

PWA URL: https://crea-troy.github.io/setu-app

---

## Day 2 — Install extension in Brave (5 minutes)

```
1. Download SETU-V5.zip from your computer
2. Extract the zip
3. Open brave://extensions
4. Enable Developer Mode (top right)
5. Click "Load unpacked"
6. Select the extension/ folder
7. Go to claude.ai or chatgpt.com
8. SETU button appears bottom-right
```

---

## Day 3 — Supabase (2 hours, free tier)

```
1. supabase.com → New Project
2. SQL Editor → paste contents of supabase/schema.sql → Run
3. Authentication → Providers → Enable Google
4. Settings → API → copy Project URL and anon key
5. Edit pwa/auth.js:
   const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
6. Push to GitHub → auto-deploys
```

---

## Day 4 — Developer API on Render.com (free)

```
1. render.com → New Web Service → Connect GitHub → select repo
2. Root directory: api/
3. Build command: pip install flask flask-cors supabase
4. Start command: python server.py
5. Add environment variables:
   SUPABASE_URL = your supabase URL
   SUPABASE_KEY = your supabase SERVICE ROLE key
6. Deploy → free tier, always on
```

---

## What's new in v5

KOVA v4:
- Fixed "build AI company" → now correctly → finance_business (not code)
- 25+ languages, 25+ topics, combination detection
- Model-specific: Claude=XML, ChatGPT=numbered, Perplexity=web-search-aware, Gemini=examples
- Expertise detection: beginner vs intermediate vs expert
- Question quality score 1-10 shown before optimizing
- One Shot mode: "give complete answer, don't ask clarifying questions"

MEMU v3:
- Smart import: extracts INSIGHTS not raw messages
- Supports ChatGPT, Claude, Gemini, Grok, ANY JSON format
- Builds user profile: topics, expertise, language, facts
- Cross-device sync for Pro users (Supabase)

ENERGY tracker:
- CO₂ per message (based on real kWh data)
- Equivalent shown: "like not driving 6m"
- Monthly total shown in stats
- Extension popup shows CO₂ saved

---

## Tagline
"Bridge between humans and AI"
"सेतु · Any language · Free forever"

## Business model
Free: extension, PWA, KOVA, MEMU, energy dashboard
Pro ($4/mo): cross-device sync, developer API, smart import
Enterprise: custom, team memory, SLA

## Revenue path
100 Pro users × $4 = $400/month
500 Pro users × $4 = $2,000/month
First customer: target ML developers who use Claude API daily

## Go-to-market (zero budget)
Week 1: r/LocalLLaMA, r/ChatGPT — post with before/after Hindi example
Week 2: Hacker News "Show HN: SETU — AI prompt optimizer in 25+ languages"
Week 3: Twitter/X — 60 second screen recording
Week 4: ProductHunt launch
Month 2: Hindi YouTube content — zero competition
