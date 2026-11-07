# Privacy: MMUUSD Labs

- The labs collect **no student data**.
- Headsets don't sign in, and nothing a student does is sent anywhere or saved.
- This includes predictions, readings, answers and settings. A reload starts fresh.
- There is no analytics, no camera or microphone access, and no network request other than loading this site's own files from GitHub Pages.
- The automated tests (`tests/static.test.mjs` and the headset tests) check this. They fail if the code ever uses network or storage functions, or asks another website for anything.
