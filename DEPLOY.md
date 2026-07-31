# Deploying PrimeVest to Vercel

This is a standard Vite + React app. Vercel detects Vite projects
automatically — no config file needed.

## 1. Test it locally first

```bash
cd primevest-frontend
npm install
cp .env.example .env.local
# edit .env.local: put your Render backend URL + matching API key
npm run dev
```

Open the printed `localhost` URL and click through login → dashboard
→ deposit/withdraw. If your Daraja server isn't deployed yet, the
app still works — deposit/withdraw will just fail at the API call
until the backend is live (see the previous guide for that part).

## 2. Push the project to GitHub

Vercel deploys from a Git repo, not a raw folder upload.

```bash
cd primevest-frontend
git init
git add .
git commit -m "Initial commit"
```

Create an empty repo on GitHub (github.com/new), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/primevest-frontend.git
git branch -M main
git push -u origin main
```

## 3. Import the project into Vercel

1. Go to https://vercel.com and sign in (GitHub login is easiest).
2. **Add New… → Project**.
3. Select the `primevest-frontend` repo → **Import**.
4. Vercel auto-detects **Framework Preset: Vite**. Leave the build
   command (`vite build`) and output directory (`dist`) as the
   defaults — you don't need to touch these.

## 4. Set environment variables

Before clicking Deploy (or after, then redeploy), open
**Environment Variables** in the import screen (or later under
**Project → Settings → Environment Variables**) and add:

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | your Render backend URL, e.g. `https://primevest-daraja-server.onrender.com` |
| `VITE_API_KEY` | the same value as `FRONTEND_API_KEY` on the backend |

Apply both to **Production**, **Preview**, and **Development** so
preview deployments work too. Click **Deploy**.

## 5. Point the backend's CORS at your new domain

Vercel gives you a URL like `https://primevest-frontend.vercel.app`
(plus a unique one per preview deploy). Go back to your Render
service's environment variables and update:

```
CORS_ORIGIN=https://primevest-frontend.vercel.app
```

Redeploy the Render service so the new CORS origin takes effect —
otherwise the browser will block API calls with a CORS error.

## 6. Verify end-to-end

Open your `.vercel.app` URL, sign up for an account, and try a
deposit with a real phone number in **sandbox** mode first (small
test amount). Check:

- The browser network tab shows `POST /api/mpesa/stkpush` returning
  200, not a CORS or 401 error.
- Your phone gets the STK push prompt.
- The status polling flips the screen to the success state once you
  enter your PIN.

Once that works end-to-end in sandbox, flip the backend to
`MPESA_ENV=production` with your go-live credentials (see the
backend README) and redeploy Render — the frontend needs no changes
for that switch.

## 7. Custom domain (optional)

**Project → Settings → Domains → Add** on Vercel, then follow its
DNS instructions (usually a `CNAME` record at your registrar). SSL
is issued automatically.

## A note on `VITE_API_KEY`

Anything prefixed `VITE_` gets baked into the JavaScript bundle
Vercel serves — it is visible to anyone who opens dev tools, not a
true secret. It's fine as a basic filter against casual/automated
abuse of your endpoints, but don't treat it as real authentication.
For real production hardening, add proper user login sessions
(e.g. a JWT issued at sign-in) and check that server-side on every
`/api/mpesa/*` call instead of relying on the shared key alone.
