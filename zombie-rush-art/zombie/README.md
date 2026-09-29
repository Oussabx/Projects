# Zombie walk sheet

`retarget_walk.py` puts the Mixamo "Walking" (zombie walk) motion capture onto `Mutant.obj`:
copies the Mixamo skeleton, moves its joints onto the Mutant, skins it (bone heat + rigid loose
parts), straightens it into the Mixamo T-pose, aligns bone rolls, then plays the mocap (forward
travel removed) and renders 16 front-view frames (200x250, foot at y=237.5).

    pip install bpy==4.2.0
    python retarget_walk.py -- test    # 4 preview angles
    python retarget_walk.py -- sheet   # 16 frames -> pack with ../soldier/sheet.py (16 columns)

Old hand-animated sheet: `assets/mutant_walk_v1.png` (set `MUTANT_V1 = true` in js/art.js).
