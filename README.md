# ESL Family Speaking Activity

Browser-based ESL speaking activity for Japanese 5th-grade learners.
Target grammar: third-person family introductions ("This is my mother.", "He is my father.", etc.)

## Quick start

Requires a **secure context** (HTTPS or localhost) for mic + camera.

```bash
# Option A — Node (npx, no install)
npx serve esl-family

# Option B — Python
cd esl-family
python -m http.server 8080

# Option C — VS Code Live Server extension: open index.html, click "Go Live"
```

Open in **Chrome** (required for Web Speech API). Navigate to `http://localhost:PORT`.

## How to play

1. **Choose** — pick one family member at a time, in order: Grandfather, Father, Brother, Grandmother, Mother, Sister. Each step shows 3 candidates at a time; tap one to lock it in. "New Characters" pages through more options.
2. **Speak** — the 6 chosen characters appear one at a time, in the same order, with the target sentence shown on screen (e.g. "This is my father."). Say it aloud to confirm.
3. **Selfie** — take a photo for the family portrait.
4. **Replay** — hear your own English played back for each family member.
5. **Photo** — receive the composited family portrait. Download or play again.

### Accepted phrases

| Pattern | Example |
|---|---|
| This is my ___ | This is my father. |
| He/She is my ___ | She is my grandmother. |
| Natural variants | Dad, Mom, Grandpa, Grandma, Bro, Sis |

## Character art

Every character in `assets/characters.json` ships with real hand-picked art in
`assets/characters/` — there's no runtime generation or placeholder fallback.
Each of the 6 family roles (Grandfather, Father, Brother, Grandmother, Mother,
Sister) is scoped to its own fixed set of characters via `ROLE_CHAR_IDS` in
`js/main.js`, so a given portrait only ever appears for one role.

### Adding new characters

1. Add the PNG (transparent background, full body, centered) to `assets/characters/`.
2. Append an entry to `assets/characters.json`:
   ```json
   { "id": "g99", "name": "New Character", "category": "generic", "gender": "female", "img": "assets/characters/g99.png" }
   ```
3. Add its `id` to the relevant role's list in `ROLE_CHAR_IDS` (`js/main.js`).

## File structure

```
esl-family/
  index.html
  css/styles.css
  js/
    main.js          — app state machine
    intro.js         — text-only opening sequence (typewriter dialogue + name prompt)
    characters.js    — manifest loading + shuffle/lookup helpers
    speech.js        — Web Speech API wrapper + role parsing
    recorder.js      — MediaRecorder audio capture
    selfie.js        — camera capture
    presentation.js  — auto-replay phase
    photo.js         — canvas family portrait compositor
  assets/
    characters.json  — character manifest (source of truth)
    characters/      — character portrait art
    frames/          — picture-frame art for the final photo screen
    wallpaper.png     — backdrop texture for the final photo screen
    bodies/          — (empty) reserved for future body sprite assets
```

## Browser support

| Feature | Required | Browser |
|---|---|---|
| Web Speech API | Yes | Chrome / Edge only |
| MediaRecorder | Yes | Chrome, Edge, Firefox |
| getUserMedia | Yes (mic + camera) | All modern browsers over HTTPS |
| Canvas | Yes | All modern browsers |

> Safari does not support Web Speech API. The activity requires Chrome or Chromium-based browsers.

## Hosting as a static site

The app has no backend. Deploy the `esl-family/` folder to any static host:
- **Vercel**: `npx vercel esl-family`
- **Netlify**: drag-and-drop `esl-family/` into Netlify dashboard
- **GitHub Pages**: push to a repo, enable Pages on `main`
- Must be served over **HTTPS** in production (required for mic/camera APIs)

## Third-party assets

- `assets/frames/` — picture frame art from the [Portrait Frame Pack](https://opengameart.org/content/portrait-frame-pack) by Screaming Brain Studios (CC0, no attribution required).
- `assets/wallpaper.png` — ["Gray Floral"](https://www.toptal.com/designers/subtlepatterns/gray-floral/) pattern by Lauren, via Toptal Subtle Patterns (CC BY — attribution required, commercial use permitted).
