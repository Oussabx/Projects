# Zombie Rush

A mobile-first zombie runner shooter that runs in the browser. There's no build step and no dependencies.

You play a cartoon soldier who runs down a city street and fires automatically. Drag to steer. Shoot the zombie hordes, pick the better gate, and break barrels for power-ups. Every level ends with a boss.

## Run it

- **On a computer:** open `zombie-rush/index.html` in a browser.
- **On a phone (same Wi-Fi):** from the repo root run `python3 -m http.server 8000`, find your computer's local IP, then open `http://<that-ip>:8000/zombie-rush/` on the phone. Use the browser's "Add to Home Screen" to get a fullscreen app icon.

Progress is saved in the browser's localStorage. You can wipe it from the Ranks tab with **Reset progress**.

## Features

- **Bottom navbar:** Shop · Gear · **Play** (center) · Skills · Ranks
- **Chapter 1 "Dead City":** 6 levels. Each level ends with a boss, and level 6 is the chapter boss. You earn 1–3 stars per level based on the HP you have left.
- **In-level power-ups**
  - Gates: pick a side. `+1 GUN`, `DMG +x%`, `FIRE +x%` and `HEAL`. Red (bad) gates get better as you shoot them.
  - Barrels: shoot the number down to 0 for Shield, Rage (x2 fire), Medkit, Grenade (clears the screen) or Coins.
- **Bosses:** they throw sludge at a red target ring, so move out of it. They also summon extra zombies.
- **Gear:** 4 slots.
  - Helmet: health
  - Rifle: damage
  - Gloves: fire speed
  - Scope: crit chance
  - Rarities are Common, Rare, Epic, Legendary and Mythic. Each tier multiplies the stat (x1, x1.6, x2.5, x4, x6.5).
- **Skills:** permanent coin upgrades for Health, Damage, Fire speed and Crit.
- **Shop:** 3 chests with different rarity odds, coin packs, and gem packs. Gem packs are **free in this test build**, and there are no real payments.
- **Leaderboard:** your total best score ranked against local test bots.

## Code layout

| File | What it holds |
| --- | --- |
| `js/data.js` | Rarities, gear, skills, chests, chapter/level/boss tuning |
| `js/save.js` | Save data, gear/chest logic, player stat formulas |
| `js/art.js` | All cartoon art (canvas) and SVG icons |
| `js/game.js` | Level gameplay, spawning, collisions, HUD |
| `js/ui.js` | Menus, navbar, modals, rewards |

Add chapters by appending to `CHAPTERS` in `js/data.js`.
