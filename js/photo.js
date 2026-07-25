/**
 * photo.js — Portrait-wall compositor
 *
 * Layout: each family member (and the student's own selfie) is drawn
 * inside a real picture-frame asset, clipped into the frame's transparent
 * "hole", with the relation printed on a nameplate below the frame —
 * like a wall of framed photos. Frames are rectangular and vary in size
 * per relation, bottom-aligned within their row like frames on a shelf.
 *
 * Frame art: CC0 "Portrait Frame Pack" by Screaming Brain Studios
 * (opengameart.org/content/portrait-frame-pack). Wallpaper: "Gray Floral"
 * by Lauren, via Toptal Subtle Patterns (CC BY).
 */

const Photo = (() => {

  const ROLE_ORDER = ['mother', 'father', 'brother', 'sister', 'grandfather', 'grandmother'];

  const CW = 860, CH = 560;

  /* ── Frame geometry ─────────────────────────────────────────────── */
  const GAP          = 4;     // frame → nameplate gap
  const NAMEPLATE_H  = 34;
  const ROW_GAP       = 34;
  const COL_GAP       = 22;
  const TOP_MARGIN    = 30;

  // Each relation gets its own rectangular frame size — a gallery wall
  // of mismatched frames, not a uniform grid.
  const SIZE = {
    grandfather: { w: 150, h: 200 },
    grandmother: { w: 150, h: 200 },
    father:      { w: 135, h: 180 },
    mother:      { w: 135, h: 180 },
    brother:     { w: 115, h: 155 },
    sister:      { w: 115, h: 155 },
    me:          { w: 125, h: 170 },
  };

  // Each frame PNG's transparent "hole", as a fraction of the source
  // image's width/height (pre-computed from the magenta placeholder
  // region — applies independently of final render size).
  const FRAME_INFO = {
    grandfather: { src: 'assets/frames/frame-grandfather.png', hole: { x0: 0.1719, y0: 0.1719, x1: 0.8281, y1: 0.8281 } },
    grandmother: { src: 'assets/frames/frame-grandmother.png', hole: { x0: 0.1719, y0: 0.1719, x1: 0.8281, y1: 0.8281 } },
    father:      { src: 'assets/frames/frame-father.png',      hole: { x0: 0.1250, y0: 0.1250, x1: 0.8750, y1: 0.8789 } },
    mother:      { src: 'assets/frames/frame-mother.png',      hole: { x0: 0.1719, y0: 0.1719, x1: 0.8281, y1: 0.8281 } },
    brother:     { src: 'assets/frames/frame-brother.png',     hole: { x0: 0.1250, y0: 0.1250, x1: 0.8750, y1: 0.8750 } },
    sister:      { src: 'assets/frames/frame-sister.png',      hole: { x0: 0.1484, y0: 0.1484, x1: 0.8516, y1: 0.8516 } },
    me:          { src: 'assets/frames/frame-me.png',          hole: { x0: 0.1250, y0: 0.1250, x1: 0.8750, y1: 0.8750 } },
  };

  const WALLPAPER_SRC = 'assets/wallpaper.png';

  /* ── Helpers ────────────────────────────────────────────────────── */
  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Row width/positions from each card's own (variable) size.
  function layoutRow(roles) {
    const sizes  = roles.map(r => SIZE[r]);
    const rowW   = sizes.reduce((sum, s) => sum + s.w, 0) + COL_GAP * (roles.length - 1);
    const startX = (CW - rowW) / 2;
    const maxH   = Math.max(...sizes.map(s => s.h));
    let x = startX;
    const positions = sizes.map(s => {
      const pos = { x, w: s.w, h: s.h };
      x += s.w + COL_GAP;
      return pos;
    });
    return { positions, maxH };
  }

  /* ── Backdrop: warm wash + tiled floral wallpaper ─────────────────── */
  function drawBackdrop(ctx, wallpaperImg) {
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#F5E9D6');
    bg.addColorStop(1, '#E8D5B5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    if (wallpaperImg) {
      const pattern = ctx.createPattern(wallpaperImg, 'repeat');
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }
  }

  /* ── Cover-fit image draw (matches CSS object-fit:cover) ──────────── */
  function drawCover(ctx, img, x, y, w, h, biasY) {
    if (!img) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, w, h);
      return;
    }
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    const dx = x - (sw - w) * 0.5;
    const dy = y - (sh - h) * (biasY ?? 0.5);
    ctx.drawImage(img, dx, dy, sw, sh);
  }

  /* ── One framed portrait, with nameplate below ────────────────────── */
  function drawFrame(ctx, x, y, w, h, portraitImg, frameInfo, frameImg, label, biasY) {
    const hole = frameInfo.hole;
    const holeX = x + hole.x0 * w;
    const holeY = y + hole.y0 * h;
    const holeW = (hole.x1 - hole.x0) * w;
    const holeH = (hole.y1 - hole.y0) * h;

    // Portrait, clipped to the frame's hole
    ctx.save();
    ctx.beginPath();
    ctx.rect(holeX, holeY, holeW, holeH);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(holeX, holeY, holeW, holeH);
    drawCover(ctx, portraitImg, holeX, holeY, holeW, holeH, biasY);
    ctx.restore();

    // Frame art on top (transparent hole reveals the portrait), stretched
    // non-uniformly to this card's own rectangular size.
    if (frameImg) {
      ctx.drawImage(frameImg, x, y, w, h);
    }

    // Nameplate, matching this card's own width
    const plateY = y + h + GAP;
    rr(ctx, x, plateY, w, NAMEPLATE_H, 6);
    ctx.fillStyle = '#F3DFB8';
    ctx.fill();

    ctx.fillStyle = '#4A3620';
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, plateY + NAMEPLATE_H / 2 + 1);
  }

  /* ── Pop-in reveal animation ───────────────────────────────────────── */
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function drawCard(ctx, card, scale) {
    const blockH = card.h + GAP + NAMEPLATE_H;
    const cx = card.x + card.w / 2, cy = card.y + blockH / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.001, scale), Math.max(0.001, scale));
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = Math.min(1, scale * 1.3);
    drawFrame(ctx, card.x, card.y, card.w, card.h, card.img, card.frameInfo, card.frameImg, card.label, card.biasY);
    ctx.restore();
  }

  function popIn(ctx, wallpaperImg, cards, index, durationMs) {
    return new Promise(resolve => {
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / durationMs);
        drawBackdrop(ctx, wallpaperImg);
        for (let i = 0; i < index; i++) drawCard(ctx, cards[i], 1);
        drawCard(ctx, cards[index], easeOutBack(t));
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ── Main compose ────────────────────────────────────────────────── */
  async function compose(canvasEl, assignments, selfieDataURL) {
    canvasEl.width  = CW;
    canvasEl.height = CH;
    const ctx = canvasEl.getContext('2d');

    const orderedRoles = ROLE_ORDER.filter(r => assignments[r]);
    // Back row: parents + grandparents. Front row: siblings + student (centred).
    const backRoles  = [orderedRoles[0], orderedRoles[1], orderedRoles[4], orderedRoles[5]].filter(Boolean);
    const frontKeys  = [orderedRoles[2], 'me', orderedRoles[3]].filter(k => k === 'me' || k); // 'me' = student

    const [wallpaperImg, frameImgs, backImgs, frontImgs] = await Promise.all([
      loadImage(WALLPAPER_SRC),
      (async () => {
        const entries = await Promise.all(
          Object.keys(FRAME_INFO).map(async key => [key, await loadImage(FRAME_INFO[key].src)])
        );
        return Object.fromEntries(entries);
      })(),
      Promise.all(backRoles.map(r => loadImage(Characters.imgUrl(assignments[r].char)))),
      Promise.all(frontKeys.map(k => k === 'me' ? loadImage(selfieDataURL) : loadImage(Characters.imgUrl(assignments[k].char)))),
    ]);

    // Build card descriptors (position + art) for every frame.
    const cards = [];

    const back = layoutRow(backRoles);
    back.positions.forEach((pos, i) => {
      const r = backRoles[i];
      const y = TOP_MARGIN + (back.maxH - pos.h);
      cards.push({
        key: r, x: pos.x, y, w: pos.w, h: pos.h,
        img: backImgs[i], frameInfo: FRAME_INFO[r], frameImg: frameImgs[r],
        label: capitalize(r), biasY: 0.15,
      });
    });
    const row1Bottom = TOP_MARGIN + back.maxH + GAP + NAMEPLATE_H;

    const front = layoutRow(frontKeys);
    const row2Top = row1Bottom + ROW_GAP;
    front.positions.forEach((pos, i) => {
      const k = frontKeys[i];
      const y = row2Top + (front.maxH - pos.h);
      cards.push({
        key: k, x: pos.x, y, w: pos.w, h: pos.h,
        img: frontImgs[i], frameInfo: FRAME_INFO[k], frameImg: frameImgs[k],
        label: k === 'me' ? 'Me' : capitalize(k), biasY: k === 'me' ? 0.3 : 0.15,
      });
    });

    drawBackdrop(ctx, wallpaperImg);

    // Reveal one at a time — everyone else first, the student's own photo last.
    const revealOrder = [...cards.filter(c => c.key !== 'me'), ...cards.filter(c => c.key === 'me')];
    for (let i = 0; i < revealOrder.length; i++) {
      await popIn(ctx, wallpaperImg, revealOrder, i, 260);
      await sleep(i === revealOrder.length - 1 ? 0 : 90);
    }
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return { compose, CW, CH };
})();
