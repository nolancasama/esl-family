/**
 * photo.js — Group portrait compositor (no furniture)
 *
 * Layout: classic two-row family portrait
 *   • Back row  (4 family): large, fill upper frame
 *   • Front row (3: 2 family + student centre): slightly lower, large
 *   • Warm studio-style backdrop
 *   • Floating role name-tags above each head
 *   • "This is my family." banner at the bottom
 */

const Photo = (() => {

  const ROLE_ORDER = ['mother', 'father', 'brother', 'sister', 'grandfather', 'grandmother'];

  const CW = 840, CH = 560;

  /* ── Portrait geometry ──────────────────────────────────────────── */
  // Back row  (4 family, slightly smaller for depth)
  const BACK_W  = 162, BACK_H  = 280;
  const BACK_BOT = 355;                         // feet y of back row
  const BACK_CX  = [158, 328, 512, 682];        // 170px spacing, ~8px gaps

  // Front row (2 family + student, slightly larger / lower)
  const FRONT_W  = 175, FRONT_H  = 300;
  const FRONT_BOT = 440;                        // feet y of front row
  const FRONT_CX  = [248, 420, 592];            // student always at index 1

  const BANNER_H = 0;

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

  /* ── Backdrop ───────────────────────────────────────────────────── */
  function drawBackdrop(ctx) {
    // Warm studio gradient
    const bg = ctx.createRadialGradient(CW / 2, CH * 0.45, 80, CW / 2, CH * 0.45, CW * 0.85);
    bg.addColorStop(0,   '#8B6F47');
    bg.addColorStop(0.5, '#5C4033');
    bg.addColorStop(1,   '#2C1A0E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH - BANNER_H);

    // Subtle vignette
    const vig = ctx.createRadialGradient(CW / 2, CH * 0.4, CW * 0.25, CW / 2, CH * 0.4, CW * 0.78);
    vig.addColorStop(0,   'rgba(0,0,0,0)');
    vig.addColorStop(1,   'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CW, CH - BANNER_H);

    // Soft floor shadow line
    const floor = ctx.createLinearGradient(0, FRONT_BOT + 10, 0, FRONT_BOT + 60);
    floor.addColorStop(0, 'rgba(0,0,0,.35)');
    floor.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, FRONT_BOT + 10, CW, 50);
  }

  /* ── Per-character drop shadow ──────────────────────────────────── */
  function drawShadow(ctx, cx, botY, rx) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(cx, botY + 5, rx, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── Student body + selfie head ─────────────────────────────────── */
  async function drawStudent(ctx, cx, botY, w, h, selfieDataURL) {
    const x = cx - w / 2;
    const y = botY - h;

    // Legs
    ctx.fillStyle = '#3730A3';
    rr(ctx, cx - 21, y + h * 0.67, 17, h * 0.33, 6); ctx.fill();
    rr(ctx, cx + 4,  y + h * 0.67, 17, h * 0.33, 6); ctx.fill();
    // Shoes
    ctx.fillStyle = '#1E1B4B';
    rr(ctx, cx - 26, y + h * 0.94, 23, 10, 4); ctx.fill();
    rr(ctx, cx + 3,  y + h * 0.94, 23, 10, 4); ctx.fill();
    // Body
    ctx.fillStyle = '#4F46E5';
    rr(ctx, cx - 22, y + h * 0.31, 44, h * 0.40, 10); ctx.fill();
    // Arms
    ctx.fillStyle = '#4F46E5';
    rr(ctx, cx - 35, y + h * 0.33, 14, h * 0.30, 6); ctx.fill();
    rr(ctx, cx + 21, y + h * 0.33, 14, h * 0.30, 6); ctx.fill();
    // Hands
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath(); ctx.arc(cx - 28, y + h * 0.63, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 28, y + h * 0.63, 9, 0, Math.PI * 2); ctx.fill();
    // Collar
    ctx.fillStyle = '#FCD34D';
    rr(ctx, cx - 11, y + h * 0.31, 22, 13, 5); ctx.fill();

    // Head
    const headCY = y + h * 0.13;
    const headR  = Math.round(w * 0.22);

    if (selfieDataURL) {
      const selfieImg = await loadImage(selfieDataURL);
      if (selfieImg) {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI * 2); ctx.clip();
        const sw = selfieImg.width, sh = selfieImg.height;
        const sc = (headR * 2) / Math.min(sw, sh);
        ctx.drawImage(selfieImg, cx - sw * sc / 2, headCY - sh * sc / 2, sw * sc, sh * sc);
        ctx.restore();
        ctx.strokeStyle = '#FCD34D'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI * 2); ctx.stroke();
        return;
      }
    }
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#92400E';
    ctx.font = `${Math.round(headR * 1.1)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('😊', cx, headCY + 1);
  }

  /* ── Role name-tag ───────────────────────────────────────────────── */
  function drawTag(ctx, cx, headTopY, label, isStudent) {
    const maxLen = 11;
    const text   = label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
    const tagW   = Math.max(text.length * 7 + 16, 52);
    const tagH   = 20;
    const tagX   = cx - tagW / 2;
    const tagY   = headTopY - tagH - 7;

    ctx.fillStyle = isStudent ? '#7C3AED' : 'rgba(255,255,255,.90)';
    rr(ctx, tagX, tagY, tagW, tagH, 10); ctx.fill();

    // Arrow
    ctx.beginPath();
    ctx.moveTo(cx - 5, tagY + tagH);
    ctx.lineTo(cx + 5, tagY + tagH);
    ctx.lineTo(cx, tagY + tagH + 5);
    ctx.fillStyle = isStudent ? '#7C3AED' : 'rgba(255,255,255,.90)';
    ctx.fill();

    ctx.fillStyle = isStudent ? '#fff' : '#1E3A5F';
    ctx.font = `bold 11px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, tagY + tagH / 2);
  }

  /* ── Banner ─────────────────────────────────────────────────────── */
  function drawBanner(ctx) {
    ctx.fillStyle = '#1C1108';
    ctx.fillRect(0, CH - BANNER_H, CW, BANNER_H);

    // Thin gold line
    ctx.fillStyle = '#B45309';
    ctx.fillRect(0, CH - BANNER_H, CW, 2);

    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('This is my family.', CW / 2, CH - BANNER_H / 2);
  }

  /* ── Main compose ────────────────────────────────────────────────── */
  async function compose(canvasEl, assignments, selfieDataURL) {
    canvasEl.width  = CW;
    canvasEl.height = CH;
    const ctx = canvasEl.getContext('2d');

    const orderedRoles = ROLE_ORDER.filter(r => assignments[r]);
    // Back row: roles 0,1,4,5 — spread across upper frame
    // Front row: roles 2, student, 3 — student dead-centre
    const backRoles  = [orderedRoles[0], orderedRoles[1], orderedRoles[4], orderedRoles[5]];
    const frontRoles = [orderedRoles[2], null, orderedRoles[3]]; // null = student

    const backImgs  = await Promise.all(
      backRoles.map(r => r ? loadImage(Characters.imgUrl(assignments[r].char)) : Promise.resolve(null))
    );
    const frontImgs = await Promise.all(
      frontRoles.map(r => r ? loadImage(Characters.imgUrl(assignments[r].char)) : Promise.resolve(null))
    );

    // ── Backdrop
    drawBackdrop(ctx);

    // ── Back row
    for (let i = 0; i < 4; i++) {
      const cx = BACK_CX[i];
      drawShadow(ctx, cx, BACK_BOT, BACK_W * 0.32);
      if (backImgs[i]) {
        ctx.drawImage(backImgs[i], cx - BACK_W / 2, BACK_BOT - BACK_H, BACK_W, BACK_H);
      }
    }

    // ── Front row
    for (let i = 0; i < 3; i++) {
      const cx = FRONT_CX[i];
      drawShadow(ctx, cx, FRONT_BOT, FRONT_W * 0.33);
      if (frontRoles[i] === null) {
        await drawStudent(ctx, cx, FRONT_BOT, FRONT_W, FRONT_H, selfieDataURL);
      } else if (frontImgs[i]) {
        ctx.drawImage(frontImgs[i], cx - FRONT_W / 2, FRONT_BOT - FRONT_H, FRONT_W, FRONT_H);
      }
    }

    // ── Name tags — back row
    for (let i = 0; i < 4; i++) {
      const r = backRoles[i];
      if (!r) continue;
      const headTopY = BACK_BOT - BACK_H + BACK_H * 0.02;
      drawTag(ctx, BACK_CX[i], headTopY, r.charAt(0).toUpperCase() + r.slice(1), false);
    }

    // ── Name tags — front row
    for (let i = 0; i < 3; i++) {
      const cx = FRONT_CX[i];
      const headTopY = FRONT_BOT - FRONT_H + FRONT_H * 0.02;
      if (frontRoles[i] === null) {
        drawTag(ctx, cx, headTopY, 'Me!', true);
      } else if (frontRoles[i]) {
        drawTag(ctx, cx, headTopY, frontRoles[i].charAt(0).toUpperCase() + frontRoles[i].slice(1), false);
      }
    }

  }

  return { compose, CW, CH };
})();
