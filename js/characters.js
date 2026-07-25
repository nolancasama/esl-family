/**
 * characters.js
 * Loads the manifest, generates placeholder art for entries with img:null,
 * and builds the session pool (6 generic + 6 imaginative, shuffled).
 */

const Characters = (() => {

  // ── Seeded pseudo-random ─────────────────────────────────────────────
  function seededRng(seed) {
    let s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function idToSeed(id) {
    // e.g. "g01" → 1, "g50" → 50, "i01" → 51, "i50" → 100
    const cat = id[0] === 'g' ? 0 : 50;
    return cat + parseInt(id.slice(1), 10);
  }

  // ── Colour helpers ───────────────────────────────────────────────────
  function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }

  // 100 evenly spaced hues (one per character, by seed index 1-100)
  function baseHue(seed) { return ((seed - 1) * 3.6) % 360; }

  // ── Placeholder canvas drawing ───────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Special head shapes / features keyed by character id
  const FEATURES = {
    i01: 'robot',   i02: 'dragon',  i03: 'wizard',  i04: 'pirate',
    i05: 'ninja',   i06: 'alien',   i07: 'cape',    i08: 'monster',
    i09: 'cat',     i10: 'knight',  i11: 'fairy',   i12: 'adventurer',
    i13: 'explorer',i14: 'inventor',i15: 'ghost',   i16: 'dog',
    i17: 'zombie',  i18: 'vampire', i19: 'mermaid', i20: 'unicorn',
    i21: 'goggles', i22: 'cape',    i23: 'witch',   i24: 'elf',
    i25: 'troll',   i26: 'wings',   i27: 'samurai', i28: 'cat',
    i29: 'bunny',   i30: 'fox',     i31: 'bear',    i32: 'panda',
    i33: 'wolf',    i34: 'tiger',   i35: 'owl',     i36: 'frog',
    i37: 'robot',   i38: 'angel',   i39: 'genie',   i40: 'hat',
    i41: 'yeti',    i42: 'pirate',  i43: 'star',    i44: 'flames',
    i45: 'wizard',  i46: 'wings',   i47: 'ninja',   i48: 'wizard',
    i49: 'cape',    i50: 'leaves',
  };

  function generatePlaceholder(char) {
    const W = 200, H = 280;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const seed = idToSeed(char.id);
    const rng  = seededRng(seed);
    const hue  = baseHue(seed);

    // Palette
    const skinTones = [
      [25, 70, 75], [30, 60, 70], [28, 55, 65],
      [22, 45, 60], [20, 40, 52], [18, 35, 45],
    ];
    const stIdx  = Math.floor(rng() * skinTones.length);
    const [sh, ss, sl] = skinTones[stIdx];
    const skin   = hsl(sh, ss, sl);
    const outfit = hsl(hue, 70, 55);
    const accent = hsl((hue + 180) % 360, 70, 55);
    const pants  = hsl((hue + 90) % 360, 55, 38);
    const hair   = hsl((hue + 30) % 360, 55, 32);

    const cx = W / 2;
    const feature = FEATURES[char.id] || 'none';

    // ── Legs ──────────────────────────────────────────────────────────
    if (feature !== 'ghost' && feature !== 'mermaid' && feature !== 'genie') {
      ctx.fillStyle = pants;
      roundRect(ctx, cx - 26, 198, 22, 60, 6); ctx.fill();
      roundRect(ctx, cx + 4,  198, 22, 60, 6); ctx.fill();
      // Shoes
      ctx.fillStyle = hsl((hue + 60) % 360, 50, 30);
      roundRect(ctx, cx - 30, 250, 26, 12, 5); ctx.fill();
      roundRect(ctx, cx + 4,  250, 26, 12, 5); ctx.fill();
    }

    // ── Body ──────────────────────────────────────────────────────────
    if (feature === 'ghost') {
      // Wavy ghost body
      ctx.fillStyle = hsl(0, 0, 95);
      ctx.beginPath();
      ctx.ellipse(cx, 170, 42, 65, 0, 0, Math.PI * 2);
      ctx.fill();
      // wavy bottom
      ctx.beginPath();
      ctx.moveTo(cx - 42, 205);
      for (let i = 0; i <= 6; i++) {
        const x = cx - 42 + i * 14;
        const y = 210 + (i % 2 === 0 ? 8 : -4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(cx + 42, 180);
      ctx.closePath();
      ctx.fill();
    } else if (feature === 'mermaid') {
      ctx.fillStyle = outfit;
      roundRect(ctx, cx - 30, 140, 60, 55, 10); ctx.fill();
      // Tail
      ctx.fillStyle = hsl((hue + 120) % 360, 70, 55);
      ctx.beginPath();
      ctx.ellipse(cx, 220, 22, 50, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fins
      ctx.beginPath();
      ctx.moveTo(cx - 22, 258);
      ctx.lineTo(cx - 42, 278); ctx.lineTo(cx, 265);
      ctx.lineTo(cx + 42, 278); ctx.lineTo(cx + 22, 258);
      ctx.fill();
    } else if (feature === 'genie') {
      ctx.fillStyle = outfit;
      ctx.beginPath();
      ctx.ellipse(cx, 190, 38, 65, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (feature === 'dragon') {
      ctx.fillStyle = hsl(130, 70, 45);
      roundRect(ctx, cx - 32, 138, 64, 70, 12); ctx.fill();
      // Spines
      ctx.fillStyle = hsl(60, 80, 60);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 24 + i * 16, 138);
        ctx.lineTo(cx - 18 + i * 16, 118);
        ctx.lineTo(cx - 12 + i * 16, 138);
        ctx.fill();
      }
    } else if (feature === 'robot') {
      ctx.fillStyle = hsl(hue, 30, 65);
      roundRect(ctx, cx - 32, 138, 64, 68, 4); ctx.fill();
      // chest panel
      ctx.fillStyle = hsl(hue, 60, 45);
      roundRect(ctx, cx - 18, 152, 36, 28, 4); ctx.fill();
      // lights
      const lc = ['#FF4444', '#44FF44', '#4444FF'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = lc[i];
        ctx.beginPath();
        ctx.arc(cx - 10 + i * 10, 164, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (feature === 'knight') {
      ctx.fillStyle = hsl(0, 0, 70);
      roundRect(ctx, cx - 32, 138, 64, 68, 8); ctx.fill();
      ctx.fillStyle = hsl(0, 0, 55);
      roundRect(ctx, cx - 28, 158, 56, 10, 4); ctx.fill();
    } else {
      ctx.fillStyle = outfit;
      roundRect(ctx, cx - 30, 140, 60, 65, 12); ctx.fill();
      // Collar accent
      ctx.fillStyle = accent;
      roundRect(ctx, cx - 16, 140, 32, 16, 6); ctx.fill();
    }

    // ── Arms ──────────────────────────────────────────────────────────
    const armColor = ['ghost','dragon','robot','knight'].includes(feature)
      ? ctx.fillStyle : outfit;
    ctx.fillStyle = armColor;
    if (feature === 'ghost') {
      ctx.fillStyle = hsl(0, 0, 95);
    } else if (feature === 'dragon') {
      ctx.fillStyle = hsl(130, 70, 45);
    } else if (feature === 'robot') {
      ctx.fillStyle = hsl(hue, 30, 65);
    } else if (feature === 'knight') {
      ctx.fillStyle = hsl(0, 0, 70);
    } else {
      ctx.fillStyle = outfit;
    }
    roundRect(ctx, cx - 52, 142, 22, 52, 10); ctx.fill();
    roundRect(ctx, cx + 30, 142, 22, 52, 10); ctx.fill();
    // Hands
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(cx - 41, 198, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 41, 198, 11, 0, Math.PI * 2); ctx.fill();

    // ── Head ──────────────────────────────────────────────────────────
    const headY = 100;
    if (feature === 'robot') {
      ctx.fillStyle = hsl(hue, 30, 75);
      roundRect(ctx, cx - 30, headY - 30, 60, 56, 6); ctx.fill();
      // visor
      ctx.fillStyle = hsl(200, 70, 50);
      roundRect(ctx, cx - 20, headY - 20, 40, 18, 4); ctx.fill();
      // antenna
      ctx.fillStyle = hsl(hue, 60, 45);
      ctx.fillRect(cx - 3, headY - 44, 6, 18);
      ctx.beginPath(); ctx.arc(cx, headY - 47, 6, 0, Math.PI * 2); ctx.fill();
    } else if (feature === 'alien') {
      ctx.fillStyle = hsl(120 + hue * 0.1, 70, 55);
      ctx.beginPath();
      ctx.ellipse(cx, headY - 10, 35, 50, 0, 0, Math.PI * 2);
      ctx.fill();
      // big eyes
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx - 14, headY - 14, 10, 14, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 14, headY - 14, 10, 14, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx - 11, headY - 18, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 17, headY - 18, 4, 0, Math.PI * 2); ctx.fill();
      // antennae
      ctx.strokeStyle = hsl(120 + hue * 0.1, 70, 40);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 12, headY - 56); ctx.lineTo(cx - 20, headY - 72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 12, headY - 56); ctx.lineTo(cx + 20, headY - 72); ctx.stroke();
      ctx.fillStyle = hsl(60, 80, 60);
      ctx.beginPath(); ctx.arc(cx - 20, headY - 72, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 20, headY - 72, 5, 0, Math.PI * 2); ctx.fill();
    } else if (feature === 'dragon') {
      ctx.fillStyle = hsl(130, 70, 45);
      ctx.beginPath(); ctx.ellipse(cx, headY - 6, 34, 38, 0, 0, Math.PI * 2); ctx.fill();
      // horns
      ctx.fillStyle = hsl(60, 80, 55);
      ctx.beginPath(); ctx.moveTo(cx - 16, headY - 38); ctx.lineTo(cx - 26, headY - 62); ctx.lineTo(cx - 6, headY - 40); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 16, headY - 38); ctx.lineTo(cx + 26, headY - 62); ctx.lineTo(cx + 6, headY - 40); ctx.fill();
      // snout
      ctx.fillStyle = hsl(130, 60, 55);
      ctx.beginPath(); ctx.ellipse(cx, headY + 14, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
      // eyes
      ctx.fillStyle = '#ffee00';
      ctx.beginPath(); ctx.arc(cx - 14, headY - 12, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 14, headY - 12, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx - 14, headY - 12, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 14, headY - 12, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (feature === 'ghost') {
      ctx.fillStyle = hsl(0, 0, 95);
      ctx.beginPath(); ctx.ellipse(cx, headY - 10, 38, 42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#334';
      ctx.beginPath(); ctx.ellipse(cx - 12, headY - 16, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 12, headY - 16, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // Normal round head
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(cx, headY - 8, 36, 0, Math.PI * 2); ctx.fill();
    }

    // ── Hair / head features (non-special heads) ────────────────────
    const noHairFeatures = ['robot','alien','dragon','ghost','knight','zombie','vampire'];
    if (!noHairFeatures.includes(feature)) {
      // Hair style varies by hue quadrant
      const hairStyle = Math.floor(hue / 90);
      ctx.fillStyle = feature === 'panda' ? '#111' : hair;
      if (feature === 'bunny') {
        // bunny ears
        roundRect(ctx, cx - 22, headY - 76, 12, 36, 6); ctx.fill();
        roundRect(ctx, cx + 10, headY - 76, 12, 36, 6); ctx.fill();
        ctx.fillStyle = hsl(350, 60, 80);
        roundRect(ctx, cx - 19, headY - 72, 6, 26, 4); ctx.fill();
        roundRect(ctx, cx + 13, headY - 72, 6, 26, 4); ctx.fill();
      } else if (feature === 'cat' || feature === 'ninja_cat') {
        // cat ears
        ctx.beginPath(); ctx.moveTo(cx - 22, headY - 40); ctx.lineTo(cx - 34, headY - 62); ctx.lineTo(cx - 10, headY - 44); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + 22, headY - 40); ctx.lineTo(cx + 34, headY - 62); ctx.lineTo(cx + 10, headY - 44); ctx.fill();
      } else if (feature === 'bear' || feature === 'panda') {
        // round ears
        ctx.beginPath(); ctx.arc(cx - 28, headY - 38, 13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 28, headY - 38, 13, 0, Math.PI * 2); ctx.fill();
      } else if (feature === 'wolf' || feature === 'fox') {
        // pointy ears
        ctx.beginPath(); ctx.moveTo(cx - 18, headY - 40); ctx.lineTo(cx - 30, headY - 66); ctx.lineTo(cx - 4, headY - 42); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + 18, headY - 40); ctx.lineTo(cx + 30, headY - 66); ctx.lineTo(cx + 4, headY - 42); ctx.fill();
      } else if (feature === 'owl') {
        // feather tufts
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.ellipse(cx + i * 10, headY - 44, 6, 12, i * 0.2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (hairStyle === 0) {
        // Short hair cap
        ctx.beginPath(); ctx.arc(cx, headY - 16, 37, Math.PI, 0); ctx.fill();
      } else if (hairStyle === 1) {
        // Long flowing
        ctx.beginPath(); ctx.arc(cx, headY - 16, 37, Math.PI, 0); ctx.fill();
        roundRect(ctx, cx - 36, headY - 16, 14, 40, 6); ctx.fill();
        roundRect(ctx, cx + 22, headY - 16, 14, 40, 6); ctx.fill();
      } else if (hairStyle === 2) {
        // Curly
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.arc(cx + i * 10, headY - 40, 10, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // Spiky
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i * 11, headY - 36);
          ctx.lineTo(cx + i * 11 - 7, headY - 56);
          ctx.lineTo(cx + i * 11 + 7, headY - 56);
          ctx.fill();
        }
      }
    }

    // ── Special hats / features ──────────────────────────────────────
    if (feature === 'wizard' || feature === 'witch') {
      const hatColor = feature === 'witch' ? '#1a1a2e' : hsl(hue, 70, 40);
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.moveTo(cx - 36, headY - 38);
      ctx.lineTo(cx, headY - 88);
      ctx.lineTo(cx + 36, headY - 38);
      ctx.closePath(); ctx.fill();
      roundRect(ctx, cx - 44, headY - 42, 88, 14, 4); ctx.fill();
      ctx.fillStyle = hsl(60, 90, 65);
      roundRect(ctx, cx - 28, headY - 68, 56, 8, 2); ctx.fill();
    }

    if (feature === 'pirate') {
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, cx - 36, headY - 52, 72, 20, 4); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(cx - 8, headY - 50); ctx.lineTo(cx, headY - 64); ctx.lineTo(cx + 8, headY - 50);
      ctx.fill();
    }

    if (feature === 'knight') {
      ctx.fillStyle = hsl(0, 0, 70);
      roundRect(ctx, cx - 32, headY - 46, 64, 52, 6); ctx.fill();
      ctx.fillStyle = hsl(0, 0, 55);
      roundRect(ctx, cx - 28, headY - 22, 56, 12, 2); ctx.fill(); // visor slit
    }

    if (feature === 'ninja') {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(cx, headY - 8, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(cx, headY - 14, 28, 0, Math.PI); ctx.fill();
    }

    if (feature === 'samurai') {
      ctx.fillStyle = hsl(hue, 60, 35);
      roundRect(ctx, cx - 38, headY - 44, 76, 18, 4); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 34, headY - 44); ctx.lineTo(cx, headY - 70); ctx.lineTo(cx + 34, headY - 44);
      ctx.fill();
    }

    if (feature === 'unicorn') {
      ctx.fillStyle = hsl(320, 70, 70);
      ctx.beginPath();
      ctx.moveTo(cx - 4, headY - 46); ctx.lineTo(cx, headY - 74); ctx.lineTo(cx + 4, headY - 46);
      ctx.fill();
    }

    if (feature === 'fairy' || feature === 'angel' || feature === 'wings') {
      ctx.fillStyle = feature === 'angel' ? hsl(0, 0, 95) : hsl((hue + 120) % 360, 70, 75);
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.ellipse(cx - 50, 165, 24, 40, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 50, 165, 24, 40, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (feature === 'angel') {
        ctx.strokeStyle = hsl(50, 80, 70);
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, headY - 58, 18, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (feature === 'cape') {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(cx - 30, 140);
      ctx.quadraticCurveTo(cx - 60, 200, cx - 46, 262);
      ctx.lineTo(cx - 28, 260);
      ctx.quadraticCurveTo(cx - 38, 205, cx - 20, 158);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 30, 140);
      ctx.quadraticCurveTo(cx + 60, 200, cx + 46, 262);
      ctx.lineTo(cx + 28, 260);
      ctx.quadraticCurveTo(cx + 38, 205, cx + 20, 158);
      ctx.fill();
    }

    if (feature === 'astronaut' || feature === 'goggles') {
      ctx.fillStyle = hsl(0, 0, 90);
      ctx.beginPath(); ctx.arc(cx, headY - 8, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hsl(200, 60, 60);
      ctx.beginPath(); ctx.arc(cx, headY - 8, 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx - 8, headY - 18, 12, 8, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (feature === 'hat') {
      ctx.fillStyle = hsl(hue, 70, 40);
      roundRect(ctx, cx - 32, headY - 48, 64, 12, 4); ctx.fill();
      roundRect(ctx, cx - 22, headY - 68, 44, 24, 4); ctx.fill();
    }

    if (feature === 'star') {
      ctx.fillStyle = hsl(55, 90, 55);
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const b = ((i * 4 + 2) * Math.PI / 5) - Math.PI / 2;
        if (i === 0) {
          ctx.beginPath(); ctx.moveTo(cx + 24 * Math.cos(a), (headY - 70) + 24 * Math.sin(a));
        } else {
          ctx.lineTo(cx + 24 * Math.cos(a), (headY - 70) + 24 * Math.sin(a));
        }
        ctx.lineTo(cx + 10 * Math.cos(b), (headY - 70) + 10 * Math.sin(b));
      }
      ctx.closePath(); ctx.fill();
    }

    if (feature === 'flames') {
      const fc = ['#FF4500','#FF8C00','#FFD700'];
      for (let f = 0; f < 3; f++) {
        ctx.fillStyle = fc[f];
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 14, headY - 36);
          ctx.quadraticCurveTo(cx + i * 14 - 8, headY - 56 - f * 8, cx + i * 14, headY - 68 - f * 6);
          ctx.quadraticCurveTo(cx + i * 14 + 8, headY - 56 - f * 8, cx + i * 14, headY - 36);
          ctx.fill();
        }
      }
    }

    if (feature === 'leaves') {
      ctx.fillStyle = hsl(120, 60, 40);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(cx + i * 14, headY - 52, 8, 16, i * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Face (for non-special-face characters) ───────────────────────
    const noFaceFeatures = ['robot','alien','dragon','ghost','ninja','knight','astronaut','goggles'];
    if (!noFaceFeatures.includes(feature)) {
      // Eyes
      const eyeY = headY - 8;
      ctx.fillStyle = feature === 'zombie' ? '#aa0000' : '#1a1a2e';
      ctx.beginPath(); ctx.arc(cx - 12, eyeY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 12, eyeY, 5, 0, Math.PI * 2); ctx.fill();
      // Shine
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 10, eyeY - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 14, eyeY - 2, 2, 0, Math.PI * 2); ctx.fill();
      // Smile
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      if (feature === 'zombie') {
        ctx.beginPath(); ctx.moveTo(cx - 10, eyeY + 14); ctx.lineTo(cx + 10, eyeY + 14); ctx.stroke();
      } else if (feature === 'vampire') {
        ctx.beginPath(); ctx.arc(cx, eyeY + 10, 12, 0.1, Math.PI - 0.1); ctx.stroke();
        ctx.fillStyle = '#cc2222';
        ctx.beginPath(); ctx.moveTo(cx - 8, eyeY + 14); ctx.lineTo(cx - 6, eyeY + 20); ctx.lineTo(cx - 2, eyeY + 14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + 2, eyeY + 14); ctx.lineTo(cx + 6, eyeY + 20); ctx.lineTo(cx + 8, eyeY + 14); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx, eyeY + 10, 12, 0.1, Math.PI - 0.1); ctx.stroke();
      }
      // Rosy cheeks
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.ellipse(cx - 22, eyeY + 8, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 22, eyeY + 8, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ── Name badge (tiny, bottom strip) ──────────────────────────────
    // No text on the character art per spec — name is in char-name below the card.

    return canvas.toDataURL('image/png');
  }

  // ── Public API ───────────────────────────────────────────────────────
  let _all = [];

  // Generic characters get gender-matched adventurer; imaginative = no sex param (wildcard)
  function dicebearUrl(char) {
    const base = `https://api.dicebear.com/9.x/adventurer/svg?seed=${char.id}&size=300`;
    return char.category === 'generic' ? `${base}&sex[]=${char.gender}` : base;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function load(onProgress) {
    const res = await fetch('assets/characters.json');
    const raw = await res.json();

    // Generate canvas placeholders as offline fallback
    _all = raw.map(c => {
      c._placeholder = generatePlaceholder(c);
      return c;
    });

    // If characters.json already points to local files, skip all network fetching
    const needsFetch = _all.filter(c => !c.img);
    if (needsFetch.length === 0) {
      if (onProgress) onProgress(_all.length, _all.length);
      return _all;
    }

    // Fetch DiceBear images in batches of 10; cache as data URLs to avoid canvas CORS issues
    let done = _all.length - needsFetch.length;
    const BATCH = 10;
    for (let i = 0; i < needsFetch.length; i += BATCH) {
      await Promise.all(needsFetch.slice(i, i + BATCH).map(async c => {
        try {
          const r    = await fetch(dicebearUrl(c));
          const blob = await r.blob();
          c._dataUrl = await blobToDataUrl(blob);
        } catch (_) {
          c._dataUrl = null;  // fall back to canvas placeholder
        }
        done++;
        if (onProgress) onProgress(done, _all.length);
      }));
    }
    return _all;
  }

  function getAll() { return _all; }

  // _dataUrl preferred (DiceBear); falls back to canvas placeholder
  function imgUrl(char) {
    return char._dataUrl || char.img || char._placeholder;
  }

  function buildGenderedPool(gender, count, excludeIds) {
    const exclude = excludeIds ? new Set(excludeIds) : null;
    const pool = _all.filter(c => c.gender === gender && !(exclude && exclude.has(c.id)));
    return shuffle(pool).slice(0, count);
  }

  function buildPool() {
    const generic     = shuffle(_all.filter(c => c.category === 'generic'));
    const imaginative = shuffle(_all.filter(c => c.category === 'imaginative'));
    return shuffle([...generic.slice(0, 6), ...imaginative.slice(0, 6)]);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { load, getAll, imgUrl, buildPool, buildGenderedPool, shuffle };
})();
