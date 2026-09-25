# Portfolio — UI/UX & Front-End

A single-page personal portfolio (Hero + About, Projects, Contact). Plain HTML/CSS/JS — no build step, no dependencies.

```
index.html      # page content
styles.css      # design tokens, light/dark themes, layout
script.js       # theme toggle, mobile nav, project rendering/filter, scroll reveal, contact form
projects.js     # ← your project list (edit this to add/remove work)
assets/         # favicon, social image, project thumbnails
```

## Run locally

```bash
python3 -m http.server 8000 -d portfolio
# open http://localhost:8000
```

## Personalise

Replace these placeholders:

- **you@example.com** — `index.html` (contact section) and `script.js` (contact form `mailto:`)
- **Your City**, bio text, skills — `index.html` `#about`
- **Social links** — `index.html` `.socials` (LinkedIn, Dribbble, Behance point to the homepages)
- **Portrait** — swap the `.avatar` div in `#about` for an `<img>`
- **Projects** — edit `projects.js`. Entries marked "Placeholder" are examples to replace. Drop screenshots (800×520 works well) into `assets/projects/`.

The contact form opens the visitor's email app (no backend). To collect messages instead, point the form at a service like Formspree.

## Deploy (Vercel)

Import the repo on Vercel and set **Root Directory** to `portfolio`. No build command needed.
