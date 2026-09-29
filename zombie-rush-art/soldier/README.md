# Soldier sprite renders

Source model: `teci_pilot_b291.blend` (rigged pilot, IK arms/legs). Textures were not packed in the
.blend, so `soldier.py` replaces them with procedural olive/tan materials and adds a rifle.

Render with the `bpy` wheel (Python 3.11): `pip install bpy==4.2.0`, then

    python soldier.py -- back    # 16-frame run from behind  -> sheet 8x2  (soldier_back.png)
    python soldier.py -- front   # 3/4 standing pose               (soldier_front.png)
    python soldier.py -- arena   # 8 directions x 12 run frames    (soldier_arena.png)
    python sheet.py -- out.png <cols> frames...

The `FOOT` lines printed by each job give the foot/head positions used by `SOLDIER` in `js/art.js`.
Paths to the .blend and output folder at the top of `rcommon.py` / `soldier.py` need adjusting.
