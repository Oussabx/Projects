# Pet Hero — Mobile Pet Grooming Website

A single-page marketing site for **Pet Hero**, a mobile pet grooming van serving Beirut, Lebanon. Built as a dependency-free static site (plain HTML/CSS/JS) so it deploys instantly with zero build configuration.

## Structure

```
index.html      # all page content/sections
styles.css      # styling (dark theme, lavender/indigo brand palette)
script.js       # mobile nav toggle + footer year
assets/         # favicon and social share image (SVG)
robots.txt
vercel.json     # clean URLs config for Vercel
```

## Run locally

No build step needed — just serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000` (or the port `serve` prints).

## Deploy to Vercel

This repo is ready for a zero-config Vercel deployment (Vercel auto-detects it as a static site).

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import this GitHub repository.
3. Leave all build settings as default (no framework, no build command).
4. Click **Deploy**.

Vercel will give you a live `*.vercel.app` URL immediately, and you can attach a custom domain afterward under **Project Settings → Domains**.

## Editing content

- Update contact details, hours, and links in `index.html` (search for the `#contact` section).
- Swap testimonials in the `#reviews` section once real review text is available.
- Replace the illustrated SVG gallery tiles in `#gallery` with real photos by dropping images into `assets/` and updating the `<img>`/`<svg>` tags.

## Business info used

- **Name:** Pet Hero — Mobile Pet Grooming
- **Location:** Beirut, Lebanon
- **Phone / WhatsApp:** +961 79 450 883
- **Instagram:** [@pethero.lb](https://www.instagram.com/pethero.lb)
- **Rating:** 5.0★ (58 Google reviews)
