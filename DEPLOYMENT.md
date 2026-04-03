# 🚀 Lottong Pinoy — Banner Creator Studio
# Deployment Guide (Windows + Vercel + Hostinger)

## Prerequisites (install once)

1. **Node.js (LTS)** → https://nodejs.org → Download LTS, install with defaults
2. **Git** → https://git-scm.com → Download, install with defaults
3. **GitHub account** → https://github.com/signup (free)

---

## PART 1: Run Locally on Windows

```bash
# 1. Open Command Prompt or PowerShell
#    Right-click your project folder → "Open in Terminal"

# 2. Navigate to your project
cd C:\Users\YourName\projects\lottong-pinoy-banner-studio

# 3. Install dependencies (first time only)
npm install

# 4. Start dev server
npm run dev

# 5. Open browser
#    http://localhost:3000
```

### How the data works locally:
- `public/results.json` is served by the `/api/results` route
- No configuration needed — it just works
- Update `public/results.json` with new data anytime

---

## PART 2: Deploy to Vercel

### Step 1: Create a GitHub Repository

```bash
# In your project folder, open terminal:

# Initialize git (first time)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Banner Creator Studio"

# Create a GitHub repo at https://github.com/new
# Then connect it:
git remote add origin https://github.com/YourUsername/lottong-pinoy-banner-studio.git
git branch -M main
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to https://vercel.com/signup
2. Sign up with your **GitHub account** (easiest)
3. Click **"Add New Project"**
4. Select your **lottong-pinoy-banner-studio** repository
5. Click **"Import"**

### Step 3: Configure Vercel Environment Variables

On the Vercel import page, before deploying:

| Key | Value | What it does |
|-----|-------|-------------|
| `DATA_SOURCE_URL` | `https://lottong-pinoy.com/results.json` | Fetches lotto data from your Hostinger site |
| `NODE_ENV` | `production` | (auto-set by Vercel) |

**How to add:**
1. Scroll to **"Environment Variables"** section
2. Enter `DATA_SOURCE_URL` as the **Key**
3. Enter `https://lottong-pinoy.com/results.json` as the **Value**
4. Select all environments (Production, Preview, Development)
5. Click **"Add"**
6. Click **"Deploy"**

### Step 4: Done!

Your studio is live at: `https://lottong-pinoy-banner-studio.vercel.app`

To use a custom domain (e.g., `studio.lottong-pinoy.com`):
1. Vercel Dashboard → Settings → Domains
2. Add `studio.lottong-pinoy.com`
3. Add a **CNAME record** in your Hostinger DNS:
   - Name: `studio`
   - Target: `cname.vercel-dns.com`
4. Wait 5-10 minutes for DNS to propagate

---

## PART 3: Host results.json on Hostinger

### Step 1: Upload results.json

1. Log in to **Hostinger**
2. Go to **File Manager**
3. Navigate to `public_html/`
4. Upload `results.json` to `public_html/`
5. Verify: visit `https://lottong-pinoy.com/results.json` — you should see JSON data

### Step 2: Keep it updated

When you get new lotto data:

**Option A: Manual upload**
1. Replace `results.json` on Hostinger via File Manager
2. Vercel picks up the new data automatically (5-min cache)

**Option B: Auto-sync script** (future)
- A cron job on Hostinger that pulls data from PCSO API
- Updates results.json automatically
- The studio always has fresh data

### Step 3: CORS (if needed)

The Vercel API route fetches **server-side**, so CORS is not an issue.
Hostinger doesn't need any special CORS headers.

---

## PART 4: Data Flow Diagram

```
LOCAL DEVELOPMENT:
  Your PC → /api/results → reads public/results.json → Studio

VERCEL PRODUCTION:
  User → studio.lottong-pinoy.com → /api/results → fetches
         https://lottong-pinoy.com/results.json → Studio

  You update results.json on Hostinger → Both sites get fresh data
```

---

## PART 5: Common Tasks

### Update the studio code:
```bash
# Make changes locally
npm run dev  # test changes

# Push to GitHub
git add .
git commit -m "Your change description"
git push

# Vercel auto-deploys within 30 seconds!
```

### Update environment variables on Vercel:
1. Vercel Dashboard → your project → Settings → Environment Variables
2. Edit or add variables
3. Click Save → Redeploy

### Add a new banner type:
1. Create `src/components/banner/NewBanner.tsx`
2. Add a new tab in `src/app/page.tsx`
3. Push to GitHub → auto-deploys

### Change the data source:
- Just change `DATA_SOURCE_URL` in Vercel environment variables
- No code changes needed

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| "Loading Lotto Data..." forever | Check `DATA_SOURCE_URL` is correct in Vercel settings |
| Build fails | Check the Vercel deployment logs for errors |
| Data is outdated | Update results.json on Hostinger, wait 5 min for cache |
| Images not showing | Make sure `/banner-assets/logo.png` and `qrcode.png` exist in `public/` |
| Fonts look wrong | Montserrat loads from Google Fonts CDN — check internet connection |

---

## File Structure Reference

```
lottong-pinoy-banner-studio/
├── public/
│   ├── banner-assets/      ← logo.png, qrcode.png
│   ├── results.json        ← local data (for dev)
│   └── logo.svg
├── src/
│   ├── app/
│   │   ├── page.tsx        ← Main dashboard
│   │   ├── layout.tsx
│   │   └── api/results/    ← Smart data proxy route
│   ├── components/
│   │   ├── banner/         ← Banner templates
│   │   └── ui/             ← shadcn/ui components
│   └── lib/
│       └── banner/         ← Config, types, analysis engine
├── .env.example            ← Template for env vars
├── .env.local              ← Local dev config (not committed)
├── .gitignore
├── next.config.ts
├── package.json
└── DEPLOYMENT.md           ← This file
```
