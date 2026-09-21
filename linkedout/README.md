# LinkedOut

**The world's largest professional de-networking platform.**

A parody of the professional-networking genre. The layout, the card stack and the
humblebrag cadence are all familiar — every word points the wrong way. You don't
apply for jobs here. You resign from them, including jobs you were never offered.

## What's in it

| Section | What it does |
|---|---|
| **Un-Profile** | Editable name, an `#OpenToNothing` ring, and a live-ticking unemployment streak with an "I got a job" button that destroys it. |
| **Unskills** | Skill bars that *regress*, each with a tick marking where you started. |
| **Quit Board** | Eight permanently-open listings ("0 applicants · 8,412 resignations"). One click files your resignation and thuds a `RESIGNED` stamp onto the card. Filterable; reversible, at a cost to your dignity. |
| **Letter Lab** | The generator. Company × tenure × final straw × tone (Corporate Poetry / Passive Aggressive / Scorched Earth / Influencer / Unhinged Sincerity) → a typewritten letter on paper, with signature and a randomised P.S. Copy it, or post it to the feed. |
| **Feed** | Resignation posts in full influencer voice. Reactions are Unlike / Relatable / Cringe / Burn / Un-repost. Greg Tamblin congratulates everything. |
| **Prestige** | A pricing table where paying more makes you less visible. |

## Files

```
index.html         # the page — full standalone document
styles.css         # tokens, light + dark themes, all components
app.js             # state, generator, feed, quit board (no dependencies)
build-artifact.py  # strips the doc wrapper for publishing as a Claude Artifact
```

State (your name, resignations, reactions, streak) is kept in `localStorage`, wrapped
so the page still works when storage is blocked. Nothing leaves the browser.

## Run it

No build step:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/linkedout/
```

## Design notes

Deliberately not corporate blue. The palette is manila folder and exit-sign rust
(`#BF3F12`) with one moss green reserved for the `#OpenToNothing` badge; the greys
are warmed toward the rust. Type does the work: **Archivo** for the wordmark and
headings, **Public Sans** for the interface, **Courier Prime** for the letters
themselves, **Caveat** for the signature. The recurring motif is an arrow escaping
a box.

## Legal-ish

Parody. Not affiliated with any professional networking platform. No listing is a
real job and no resignation issued here is binding.
