# MMUUSD Labs

Interactive physics labs for the district's Quest 3 headsets (WebXR, passthrough). They're separate from the artifact exhibits (`mmuusd-xr`), so a lab update can never break an exhibit in use.

- **Site:** `https://shaunlangevin.github.io/mmuusd-labs/`
- **Lab 1: Cannon Recoil Lab.** Grade 6, Forces and Motion, Bend 1 (MS-PS2-2; Newton's 3rd law from MS-PS2-1).

## What students do

1. **Try it.** They pull the lanyard to fire once, with no instructions.
2. **Which push was bigger?** They guess, watch slow motion with force arrows, and learn that both pushes were the same (Newton's 3rd law).
3. **Plan.** They choose one variable: ball, cannon weight, powder or wheels. The panel lists what stays the same and gives sentence frames.
4. **Test.** For each level, they place a prediction flag, then fire 3 trials.
   - They read the ruler through the magnifier and call out the reading. The Recorder writes it in the paper table.
   - Faint flags mark earlier trials, and shots vary a little, as real ones do.
   - Slow motion steps frame by frame, and arrows can be turned on.
   - Partners swap roles after each row.
5. **Explain.** Sentence frames, the Rainy Morning word bank, and a new question.
6. **Challenge.** They set everything to land the cannon on a target line.

**Options → Start over (next pair)** clears everything for the next students; it takes two taps, so it can't happen by accident.

**In the headset**

- **Firing:** students pull the lanyard handle. They can grab it with the controller's grip button, pinch it or pull the trigger at the handle, point at it from a distance, or grab it with a closed hand when hand tracking is on. A firm 12 cm tug fires; the handle lights up when a hand is close enough to grab it.
- **Start line:** before every shot the cannon rolls back to the start line (0 cm), the way a crew pushed it back after recoil. Pressing Fire or pulling the lanyard during the roll-back fires as soon as it arrives.
- **The ball:** it hits the sandbags, falls, bounces and rolls to a stop, and stays there until the next shot.
- **Powder:** cloth cartridge bags of 0.4 kg each, as in the Civil War, with a powder keg beside them. Three bags (1.2 kg) is about a real 12-pounder's full charge.
- **The panel:** it floats like a whiteboard above the lab, or beside it on the right when that would be too high, so it never covers the cannon. Its bottom edge stays put when its content changes, so buttons don't move under the pointer.
- **Staying in place:** the lab is pinned to the real room with a WebXR anchor, and a copy is saved on the headset. If the headset loses the anchor (for example after it is taken off to write), the lab comes back to the same spot from that copy. The copy's reference code is kept only in memory.

## Link settings (ArborXR WebXR link)

| Setting | Example | What it does |
|---|---|---|
| `lang` | `lang=es` | Spanish |
| `sizes` | `sizes=desk,half` | which sizes students may pick (desk 1:7, half 1:2, life 1:1) |
| `size` | `size=half` | the starting size |
| `lock` | `lock=powder` | the whole class tests this variable |
| `text` | `text=big` | Bigger text |
| `calm` | `calm=on` | Calm mode: a soft pop, no smoke |
| `number` | `number=on` | Show number: the reading appears in the magnifier and table |
| `fire` | `fire=button` | no lanyard; Fire button only |
| `start` | `start=plan` | skip "Try it" and the 3rd-law question (for day 2) |
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
