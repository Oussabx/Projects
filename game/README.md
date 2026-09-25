# Bubble Pup

A small single-player arcade game that runs entirely in the browser — no build step, no dependencies.

Catch falling bubbles to keep the pup clean, grab golden bones for bonus points, and dodge the mud. Three mud hits and it's game over. The pace speeds up the longer you survive, and your best score is saved in the browser.

## Play

Open `game/index.html` in any browser (double-click it), or serve the repo locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/game/
```

## Controls

| Action | Keys |
| --- | --- |
| Move | ← → or A / D, or drag / tap on touch screens |
| Pause / resume | P or Esc, or the pause button |
| Start / restart | Enter or Space |

## Scoring

- Bubble: +1
- Golden bone: +5
- Mud: lose a life
