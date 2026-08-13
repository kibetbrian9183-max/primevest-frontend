# SEO setup — what these files do and what's still needed

## Files in this folder

- **index.html** — replaces your frontend's `index.html` (Vite project root, next to `package.json`). Has the title, description, Open Graph tags, Twitter card, and structured data search engines read.
- **robots.txt** — goes in `/public` (Vite copies anything in `public/` to the site root on build). Tells crawlers they're allowed to index everything and where the sitemap is.
- **sitemap.xml** — goes in `/public`. Currently lists just the landing page (`/`), since everything past login requires auth and isn't meant to be indexed. Add more `<url>` entries here if you add public pages later (a blog, a terms page, etc.).
- **site.webmanifest** — goes in `/public`. Lets PrimeVest be "added to home screen" on mobile with a proper icon and name.

## If `primevestbinary.com` isn't available

Every file above references that exact domain in a few places. Find-and-replace `primevestbinary.com` with whatever you actually buy — it appears in:
- `index.html`: canonical link, og:url, og:image, twitter:image, both JSON-LD blocks
- `robots.txt`: the Sitemap line
- `sitemap.xml`: the one `<loc>`

## Image assets

All generated and included in `public-images/` — drop the whole folder's contents into your `public/`:

| File | Size | Purpose |
|---|---|---|
| `og-image.png` | 1200×630 | Preview image shown when your link is shared on WhatsApp/Facebook/X |
| `logo.png` | 512×512 | Used in the Organization structured data |
| `favicon.ico` | 16/32/48 multi-size | Classic favicon fallback for older browsers |
| `favicon-32x32.png` / `favicon-16x16.png` | 32×32 / 16×16 | Browser tab icon |
| `apple-touch-icon.png` | 180×180 | iOS home-screen icon |
| `android-chrome-192x192.png` / `android-chrome-512x512.png` | 192×192 / 512×512 | Android home-screen icon |

These are a generated first pass — an amber-to-orange gradient mark with a trend-up glyph, matching the landing page's header logo and color palette. Good enough to ship with; swap in a professionally designed version later if you want something more distinctive.

## One more thing to verify

`index.html` has a `<link rel="preconnect">` pointing at `https://primevestbackend.onrender.com` — that's a guess based on your Render service name from earlier. Check it matches your actual backend URL (the one in `VITE_API_BASE_URL`) and fix it if not; a wrong preconnect URL is harmless, just a wasted optimization, not a bug.

## Steps once the domain is actually live

Buying the domain and deploying these files doesn't make Google show you at the top by itself — that takes time and a few more steps:

1. **Point the domain at your frontend host** (Vercel/Netlify/wherever `App.jsx` is deployed) via DNS.
2. **Google Search Console** (search.google.com/search-console) — add the domain as a property, verify ownership (usually a DNS TXT record), and submit `sitemap.xml` under Sitemaps.
3. **Bing Webmaster Tools** — same idea, smaller but free traffic.
4. Ranking "at the top" for a search of your own brand name ("PrimeVest") usually happens within days to a couple weeks once Google indexes you, *provided nothing else is already using that name*. Ranking for competitive terms like "online trading Kenya" is a much longer game (months, backlinks, content) — that's normal, not a sign something's broken.
5. Since this is a client-rendered React app (no server-side rendering), Google can generally still index it, but if you want the strongest possible SEO later, consider prerendering the landing page specifically (tools like `vite-plugin-prerender` or moving just the marketing page to static HTML) — not necessary to get started, just the next lever if rankings matter a lot to you.
