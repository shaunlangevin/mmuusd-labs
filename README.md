# MMUUSD Labs

Interactive physics labs for the district's Quest 3 headsets (WebXR, passthrough). They're separate from the artifact exhibits (`mmuusd-xr`), so a lab update can never break an exhibit in use.

- **Site:** `https://shaunlangevin.github.io/mmuusd-labs/`
- **Lab 1: Cannon Recoil Lab.** Grade 6, Forces and Motion, Bend 1 (MS-PS2-2; Newton's 3rd law from MS-PS2-1).

## What students do

There are two paths. The teacher chooses, through the link.

**Guided (the default):** one sentence and one big button at a time, about 8 minutes, so students can work without constant help.

1. **Try it.** Pull the lanyard to fire once.
2. **Which push was bigger?** Guess, then watch slow motion. It stops on the two push arrows so students can compare them, and then gives the answer (Newton's 3rd law).
3. **Compare two settings.** A light cannon, then a heavy one (or another variable with `lock`). For each:
   - place a prediction flag
   - fire
   - **Record your results** (read the ruler, write it on the sheet, then press "I recorded it")
   - the crew rolls the cannon back to 0
4. **Explain.** Look at the two labelled flags, then tell a partner in one sentence which rolled back farther and why, and write it down.

**Full investigation (`path=full`):**

1. Try it.
2. Which push was bigger?
3. **Plan:** choose one variable. The panel lists what stays the same and gives sentence frames.
4. **Test:**
   - For each level: a prediction flag, then 3 trials.
   - After each shot, a **Record your results** step; "I recorded it" rolls the cannon back.
   - There's also a table, slow motion and arrows.
   - Partners swap roles after each row.
5. **Explain.**
6. **Challenge:** land the cannon on a target line.

**Slow motion** runs on one clock, so the ball and the cannon start moving at the same instant. The first 1/70 s is slowed about 160 times, then the roll plays 4 times slower than real life. With arrows on, it pauses on the two pushes, and the arrows fade slowly instead of vanishing. In a live shot with arrows on, they stay up for about 2 seconds.

**Options → Start over (next pair)** clears everything for the next students; it takes two taps, so it can't happen by accident.

**In the headset**

- **Firing:** students pull the lanyard handle. They can grab it with the controller's grip button, pinch it or pull the trigger at the handle, point at it from a distance, or grab it with a closed hand when hand tracking is on. A firm 12 cm tug fires; the handle lights up when a hand is close enough to grab it. The handle only appears when a shot is allowed.
- **Start line:** after "I recorded it", and before every shot, the cannon rolls back to the start line (0 cm), the way a crew pushed it back after recoil.
- **The ball:** it hits the sandbags, falls, bounces and rolls to a stop.
- **Powder:** cloth cartridge bags of 0.4 kg each, as in the Civil War, with a powder keg beside them. Three bags (1.2 kg) is about a real 12-pounder's full charge.
- **The panel:** it floats like a whiteboard above the lab, or beside it on the right when that would be too high, so it never covers the cannon. Its bottom edge stays put when its content changes.
- **Staying in place:** the lab is pinned to the real room with a WebXR anchor, and a copy is saved on the headset. If the headset loses the anchor (for example after it is taken off to write), the lab comes back to the same spot. The copy's reference code is kept only in memory.

## Link settings (ArborXR WebXR link)

| Setting | Example | What it does |
|---|---|---|
| `path` | `path=full` | the full investigation (planning, 3 trials per level, table, challenge); without it, the guided path |
| `lang` | `lang=es` | Spanish |
| `sizes` | `sizes=desk,half` | which sizes students may pick (desk 1:7, half 1:2, life 1:1) |
| `size` | `size=half` | the starting size |
| `lock` | `lock=powder` | the variable the class tests (guided: the variable compared; the default is the cannon's weight) |
| `text` | `text=big` | Bigger text |
| `calm` | `calm=on` | Calm mode: a soft pop, no smoke |
| `number` | `number=on` | Show number: the reading appears in the magnifier and table |
| `fire` | `fire=button` | no lanyard; Fire button only |
| `start` | `start=plan` | with `path=full`: skip "Try it" and the 3rd-law question (for day 2) |
| `debug` | `debug=1` | console logging |

## Files

```
index.html          start page (language, size, supports) and the preview
js/app.js           the lab: sessions, placement, input, the student flow, slow motion
js/physics.js       the physics model (see the comments at the top)
js/scene.js         the cannon, ruler, sandbags, flags, arrows and lanyard, in real-life metres
js/ui3d.js          the headset panels, the magnifier, the ruler texture
js/i18n.js          every word, in English and Spanish
js/audio.js         the boom (made in code, no sound file)
labs/cannon/cannon.glb   the cannon model (prepared for the Quest)
vendor/             three.js r170 (no CDNs)
tests/              node tests/run.mjs (needs Playwright with Chromium)
tools/package.py    builds an update zip
```

## Credits

- **Cannon model:** "Civil War Cannon" (https://sketchfab.com/3d-models/civil-war-cannon-77642765da02400cbc8db58b5532ff9e) by Zack_Hawley (https://sketchfab.com/Zack_Hawley), licensed under CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/).
  - Changes: simplified (about 858k to 127k triangles), small parts given plain colours, textures resized to 512, and the wheels set up to turn.
- **three.js:** MIT licence (`vendor/THREE-LICENSE.txt`).

## Privacy

Nothing is sent or saved. There are no accounts, no analytics and no network requests beyond loading the site's own files. See `PRIVACY.md`.
