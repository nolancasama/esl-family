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

The app ships with **programmatically generated placeholder art** — no setup needed.
Characters are drawn at runtime by `js/characters.js` using a seeded algorithm.
Every character has a consistent full-body, front-facing design with transparent background.

### Swapping in real art (optional)

1. Prepare 100 PNG/WebP files:
   - Names: `g01.png` … `g50.png` (generic), `i01.png` … `i50.png` (imaginative)
   - 1024 × 1024 px, transparent background, full body, centered, no text/watermark
2. Place files in `assets/characters/`
3. In `assets/characters.json`, set each `"img"` field (path is relative to `index.html`, so it needs the `assets/` prefix):
   ```json
   { "id": "g01", "name": "Adult Woman", "category": "generic", "img": "assets/characters/g01.png" }
   ```
4. When `"img"` is set, the app uses your file instead of the generated placeholder.

### Adding new characters

Append rows to `assets/characters.json`. The session pool always picks 6 generic + 6 imaginative at random.

## File structure

```
esl-family/
  index.html
  css/styles.css
  js/
    main.js          — app state machine
    characters.js    — manifest + placeholder generator + session pool
    speech.js        — Web Speech API wrapper + role parsing
    recorder.js      — MediaRecorder audio capture
    selfie.js        — camera capture
    presentation.js  — auto-replay phase
    photo.js         — canvas family portrait compositor
  assets/
    characters.json  — 100-character manifest (source of truth)
    characters/      — (empty) drop real art PNG/WebP files here
    bodies/          — (empty) reserved for future body sprite assets
  tools/
    generate-placeholders.html  — optional: pre-bake 100 PNG files + updated manifest
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
