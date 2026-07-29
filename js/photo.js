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
  const PORTRAIT_INSET = 0.08; // padding between portrait and frame's inner edge, as a fraction of the hole size

  // Each relation gets its own rectangular frame size — a gallery wall
  // of mismatched frames, not a uniform grid.
  const SIZE = {
    grandfather: { w: 128, h: 170 },
    grandmother: { w: 128, h: 170 },
    father:      { w: 115, h: 153 },
    mother:      { w: 115, h: 153 },
    brother:     { w: 98,  h: 132 },
    sister:      { w: 98,  h: 132 },
    me:          { w: 106, h: 145 },
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

  const BACKDROP_SRC = 'assets/photo-bg.jpg';

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

  /* ── Backdrop: castle wall scene, cover-fit ────────────────────────── */
  function drawBackdrop(ctx, backdropImg) {
    if (backdropImg) {
      drawCover(ctx, backdropImg, 0, 0, CW, CH, 0.4);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, '#F5E9D6');
      bg.addColorStop(1, '#E8D5B5');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);
    }

    // Gentle darken so the frames and nameplates stand out from the wall.
    const dim = ctx.createLinearGradient(0, 0, 0, CH);
    dim.addColorStop(0, 'rgba(20,14,8,.2)');
    dim.addColorStop(1, 'rgba(20,14,8,.36)');
    ctx.fillStyle = dim;
    ctx.fillRect(0, 0, CW, CH);
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
    // Inset the portrait within the hole so a bit of matting shows
    // between the picture and the frame's inner edge.
    const padX = holeW * PORTRAIT_INSET, padY = holeH * PORTRAIT_INSET;
    drawCover(ctx, portraitImg, holeX + padX, holeY + padY, holeW - padX * 2, holeH - padY * 2, biasY);
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
    const fitted = fitText(ctx, label, w - 16);
    ctx.fillText(fitted, x + w / 2, plateY + NAMEPLATE_H / 2 + 1);
  }

  // Truncate with an ellipsis if the label is wider than the nameplate
  // (arbitrary player-entered names can run longer than role words).
  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
      s = s.slice(0, -1);
    }
    return s + '…';
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

  function popIn(ctx, backdropImg, cards, index, durationMs) {
    return new Promise(resolve => {
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / durationMs);
        drawBackdrop(ctx, backdropImg);
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

  /* ── Click-to-play: hit-testing + a little tap feedback ────────────── */
  let _scene      = null;  // { cards, backdropImg } from the last compose()
  let _animating  = false; // true during the reveal or a pulse — ignore clicks

  // Maps a click's viewport coords to a card key, accounting for the
  // canvas's object-fit:contain letterboxing within its CSS box.
  function getCardAt(canvasEl, clientX, clientY) {
    if (_animating || !_scene) return null;
    const rect = canvasEl.getBoundingClientRect();
    const boxAspect = rect.width / rect.height;
    const imgAspect  = CW / CH;

    let renderW, renderH, offsetX, offsetY;
    if (boxAspect > imgAspect) {
      renderH = rect.height;
      renderW = renderH * imgAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = rect.width;
      renderH = renderW / imgAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    }

    const px = clientX - rect.left - offsetX;
    const py = clientY - rect.top - offsetY;
    if (px < 0 || py < 0 || px > renderW || py > renderH) return null;

    const x = (px / renderW) * CW;
    const y = (py / renderH) * CH;

    for (const card of _scene.cards) {
      const blockH = card.h + GAP + NAMEPLATE_H;
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + blockH) {
        return card.key;
      }
    }
    return null;
  }

  // Brief scale-up-and-back on the tapped card, as a visual "heard you" cue.
  function pulseCard(canvasEl, key) {
    if (_animating || !_scene) return;
    const { cards, backdropImg } = _scene;
    if (!cards.some(c => c.key === key)) return;

    _animating = true;
    const ctx = canvasEl.getContext('2d');
    const start = performance.now();
    const DURATION = 240;
    function tick(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const pulse = 1 + Math.sin(t * Math.PI) * 0.08;
      drawBackdrop(ctx, backdropImg);
      cards.forEach(c => drawCard(ctx, c, c.key === key ? pulse : 1));
      if (t < 1) requestAnimationFrame(tick);
      else _animating = false;
    }
    requestAnimationFrame(tick);
  }

  /* ── Main compose ────────────────────────────────────────────────── */
  async function compose(canvasEl, assignments, selfieDataURL, playerName) {
    // Render at a higher pixel density than the CSS display size (which can
    // be much larger than CW/CH on a wide screen) so the canvas isn't
    // blurrily upscaled by the browser.
    const scale = Math.max(window.devicePixelRatio || 1, 2);
    canvasEl.width  = CW * scale;
    canvasEl.height = CH * scale;
    const ctx = canvasEl.getContext('2d');
    ctx.scale(scale, scale);

    const orderedRoles = ROLE_ORDER.filter(r => assignments[r]);
    // Back row: parents + grandparents. Front row: siblings + student (centred).
    const backRoles  = [orderedRoles[0], orderedRoles[1], orderedRoles[4], orderedRoles[5]].filter(Boolean);
    const frontKeys  = [orderedRoles[2], 'me', orderedRoles[3]].filter(k => k === 'me' || k); // 'me' = student

    const [backdropImg, frameImgs, backImgs, frontImgs] = await Promise.all([
      loadImage(BACKDROP_SRC),
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
        label: k === 'me' ? (playerName || 'Me') : capitalize(k), biasY: k === 'me' ? 0.3 : 0.15,
      });
    });

    drawBackdrop(ctx, backdropImg);
    _scene = { cards, backdropImg };

    // Reveal one at a time — everyone else first, the student's own photo last.
    _animating = true;
    const revealOrder = [...cards.filter(c => c.key !== 'me'), ...cards.filter(c => c.key === 'me')];
    for (let i = 0; i < revealOrder.length; i++) {
      await popIn(ctx, backdropImg, revealOrder, i, 260);
      await sleep(i === revealOrder.length - 1 ? 0 : 90);
    }
    _animating = false;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return { compose, getCardAt, pulseCard, CW, CH };
})();
