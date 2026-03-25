# SETU Deployment Guide

Two repos. Three free services. Total cost: $0/month.

```
PUBLIC repo  (crea-troy/SETU)       → GitHub Pages (website + PWA)
PRIVATE repo (crea-troy/setu-api)   → Render.com (API server)
BOTH use                            → Supabase (database)
```

---

## Step 1 — Supabase (do this first)

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `setu-prod`, set a strong password
3. Wait ~2 minutes for provisioning
4. **SQL Editor** → paste entire `supabase/schema.sql` → Run
5. **Settings → API** → save these:
   - **Project URL** e.g. `https://xxxx.supabase.co`
   - **service_role key** — for API server only, never expose publicly
   - **anon key** — safe to put in `pwa/auth.js`
6. **Authentication → Providers → Google** → enable → add your Google OAuth credentials

---

## Step 2 — Update config files

In `pwa/auth.js`:
```javascript
const SUPABASE_URL      = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

In `extension/memu_ext.js` and `pwa/memu.js` (update after Step 3):
```javascript
const API_BASE = "https://YOUR_RENDER_URL.onrender.com";
```

---

## Step 3 — Render.com (private API repo)

1. Create a **private** GitHub repo called `setu-api`
2. Push the `repo_private/` folder contents to it
3. [render.com](https://render.com) → New → Web Service → connect `setu-api`
4. Settings:
   - Root directory: `api`
   - Build command: `pip install -r requirements.txt`
   - Start command: `python server.py`
   - Instance type: Free
5. Environment variables:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_KEY` = your **service_role key**
6. Deploy → wait ~3 min
7. Test: `https://your-render-url.onrender.com/api/v1/health` → should return `{"status":"ok"}`
8. Copy the URL → update `API_BASE` in both `memu_ext.js` and `pwa/memu.js`

---

## Step 4 — GitHub Pages (public repo)

1. Create a **public** GitHub repo called `SETU`
2. Push the `repo_public/` folder contents to it
3. Repo **Settings → Pages** → Source: branch `main`, folder `/ (root)` → Save
4. Wait ~1 minute → live at `https://crea-troy.github.io/SETU`

URLs that now work:
```
crea-troy.github.io/SETU           → website homepage
crea-troy.github.io/SETU/pwa       → mobile PWA
```

---

## Step 5 — Install extension for testing

1. `chrome://extensions` → enable **Developer Mode**
2. **Load unpacked** → select the `extension/` folder
3. Go to `claude.ai` → type a question → press Enter → SETU works

---

## Auto-deploy after setup

Every `git push` to `main`:
- GitHub Pages: redeploys website + PWA in ~60 seconds
- Render: redeploys API in ~2 minutes

No manual steps ever.

---

## Free tier limits

| Service | Free limit | Hits when |
|---|---|---|
| GitHub Pages | Unlimited | Never |
| Render | 750 hrs/month, sleeps after 15min idle | ~100 active users |
| Supabase | 500MB storage, 2GB bandwidth | ~500 Pro users |

When Render starts sleeping, upgrade to Render Starter ($7/month) — by then paying users cover it.

---

## Troubleshooting

**Extension not intercepting:**
Reload it at `chrome://extensions` → click reload icon on SETU.

**API errors:**
Check Render logs → verify `SUPABASE_URL` and `SUPABASE_KEY` env vars are set.

**PWA won't install on iPhone:**
Use Safari — Chrome on iOS doesn't support PWA install.

**Memory not syncing:**
Confirm `API_BASE` matches your Render URL exactly. Free users: memory is device-only by design.
