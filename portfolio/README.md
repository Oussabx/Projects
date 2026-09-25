# Portfolio — UI/UX & Front-End

A single-page personal portfolio (Hero + About, Projects, Contact) with an admin dashboard at `/admin`.
Plain HTML/CSS/JS — no build step.

```
index.html          # page layout
styles.css          # design tokens, light/dark themes, layout
script.js           # renders content, theme toggle, nav, project filter, contact form
content/site.json   # hero, about, skills, contact info   ← edited from /admin
content/projects.json  # projects list                    ← edited from /admin
admin/              # Decap CMS dashboard (index.html + config.yml)
api/                # Vercel functions for the admin's GitHub login
assets/uploads/     # images uploaded from the admin
```

## Admin dashboard (`/admin`)

The dashboard is [Decap CMS](https://decapcms.org). Log in with GitHub, edit in forms, press **Publish** —
it commits the change to `content/*.json` in this repo and Vercel redeploys in about a minute.

What you can manage:
- **Projects** — add, edit, hide, delete, drag to reorder, upload screenshots, links
- **Site content** — name, job title, hero headline/intro/stats, availability badge, about text and photo, skills, email, social links
- **Contact messages** — the "Contact messages" button opens your Formspree inbox (see below)

### One-time setup

1. **Deploy on Vercel**: import the repo, set **Root Directory** to `portfolio`, no build command.
2. **Create a GitHub OAuth app**: GitHub → Settings → Developer settings → OAuth Apps → New.
   - Homepage URL: `https://<your-site>.vercel.app`
   - Authorization callback URL: `https://<your-site>.vercel.app/api/callback`
3. In Vercel → Project → Settings → Environment Variables add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
   from that OAuth app, then redeploy.
4. Open `https://<your-site>.vercel.app/admin` and log in with GitHub. Only accounts with write access to
   this repo can publish.

The admin saves to the `main` branch (`admin/config.yml` → `backend.branch`), so merge this portfolio into `main` first.
If you use a custom domain, update the OAuth app URLs to match it.

### Contact messages

1. Create a free form at [formspree.io](https://formspree.io) and copy its endpoint (`https://formspree.io/f/xxxx`).
2. In `/admin` → Site content → Contact → **Contact form endpoint**, paste it and publish.

Messages then arrive in your email and in the Formspree inbox. With no endpoint set, the form opens the
visitor's email app instead.

## Run locally

```bash
# Site only
python3 -m http.server 8000 -d portfolio        # http://localhost:8000

# Site + admin without GitHub login (edits files on disk directly)
npx decap-server                                # from the repo root, in a second terminal
# then open http://localhost:8000/admin/
```
