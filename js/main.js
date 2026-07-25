/**
 * main.js
 * App state machine + phase orchestration.
 * Depends on: characters.js, speech.js, recorder.js, board.js, selfie.js,
 *             presentation.js, photo.js
 */

(async function () {

  // Order family members are picked in, one at a time.
  const SELECT_ORDER = ['grandfather', 'father', 'brother', 'grandmother', 'mother', 'sister'];

  // Real-art characters — shown only in the "Choose your Brother" step, never elsewhere.
  const BROTHER_CHAR_IDS = ['g06', 'g08', 'g14', 'g27', 'i02', 'i14', 'i27', 'i41', 'i49'];

  // ── State ─────────────────────────────────────────────────────────
  const state = {
    pool:           [],   // candidates currently shown for the role being picked
    rerollUsed:     false,
    roleIndex:      0,    // index into SELECT_ORDER for the choose phase
    pickedIds:      new Set(), // char ids already used by an earlier role
    selected:       [],   // 6 chars, in SELECT_ORDER order (set as choose phase proceeds)
    assignIndex:    0,    // index into selected[] / SELECT_ORDER currently being assigned
    assignments:    {},   // { role: { char, audioBlob, transcript } }
    selfieDataURL:  null,
    micOpen:        false,
  };

  // ── DOM refs ───────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // Phase containers
  const phases = {
    choose:       $('phase-choose'),
    assign:       $('phase-assign'),
    selfie:       $('phase-selfie'),
    presentation: $('phase-presentation'),
    photo:        $('phase-photo'),
  };

  // Choose phase
  const charGrid       = $('char-grid');
  const chooseCounter  = $('choose-counter');
  const chooseSubtitle = $('choose-subtitle');
  const rerollBtn      = $('reroll-btn');

  // Assign phase
  const assignCharImg  = $('assign-char-img');
  const assignPrompt   = $('assign-prompt');
  const micBtn         = $('mic-btn');
  const micLabel       = $('mic-label');
  const transcriptBox  = $('transcript-box');
  const feedbackMsg    = $('feedback-msg');
  const boardGrid      = $('board-grid');
  const undoBtn        = $('undo-btn');

  // Selfie phase
  const selfieVideo    = $('selfie-video');
  const selfiePreview  = $('selfie-preview');
  const selfieFeedback = $('selfie-feedback');
  const snapBtn        = $('snap-btn');
  const retakeBtn      = $('retake-btn');
  const selfieNextBtn  = $('selfie-next-btn');

  // Presentation phase
  const presFrame      = $('pres-char-frame');
  const presCharImg    = $('pres-char-img');
  const presRoleLabel  = $('pres-role-label');
  const presCharName   = $('pres-char-name');
  const presProgress   = $('pres-progress');

  // Photo phase
  const photoCanvas    = $('family-photo-canvas');
  const downloadBtn    = $('download-btn');
  const playAgainBtn   = $('play-again-btn');

  // ── Boot ───────────────────────────────────────────────────────────
  const loadingScreen = $('loading-screen');
  const loadingBar    = $('loading-bar');
  const loadingCount  = $('loading-count');

  await Characters.load((done, total) => {
    loadingCount.textContent    = `${done} / ${total}`;
    loadingBar.style.width      = `${Math.round(done / total * 100)}%`;
  });
  loadingScreen.style.display = 'none';

  Board.init(boardGrid);
  Presentation.init({
    charImg:   presCharImg,
    roleLabel: presRoleLabel,
    charName:  presCharName,
    progress:  presProgress,
    frame:     presFrame,
  });

  if (!Speech.isSupported()) {
    showGlobalWarning('⚠️ Speech recognition is not supported. Please open this page in Google Chrome.');
  }

  enterChoosePhase();

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 1 — CHOOSE  (one family member at a time, in SELECT_ORDER)
  // ══════════════════════════════════════════════════════════════════
  function enterChoosePhase() {
    state.roleIndex      = 0;
    state.pickedIds       = new Set();
    state.selected        = [];
    state.rerollUsed      = false;
    state.assignments     = {};
    state.selfieDataURL   = null;
    state.assignIndex     = 0;

    showPhase('choose');
    loadChooseStep();
  }

  function loadChooseStep() {
    const role   = SELECT_ORDER[state.roleIndex];
    const gender = Speech.ROLE_GENDER[role];

    state.pool       = buildPoolForRole(role, gender);
    state.rerollUsed = false;

    chooseSubtitle.textContent = `Choose your ${capitalize(role)}`;
    chooseCounter.textContent  = `${state.roleIndex + 1} / ${SELECT_ORDER.length}`;

    renderPool();
    updateChooseUI();
  }

  function buildPoolForRole(role, gender) {
    if (role === 'brother') {
      return Characters.shuffle(
        Characters.getAll().filter(c => BROTHER_CHAR_IDS.includes(c.id) && !state.pickedIds.has(c.id))
      );
    }
    const exclude = new Set([...state.pickedIds, ...BROTHER_CHAR_IDS]);
    return Characters.buildGenderedPool(gender, 6, exclude);
  }

  function renderPool() {
    charGrid.innerHTML = '';
    state.pool.forEach(char => {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.id = char.id;

      const imgEl = new Image();
      imgEl.src = Characters.imgUrl(char);
      imgEl.alt = char.name;
      card.appendChild(imgEl);

      card.addEventListener('click', () => pickCharacter(char, card));
      charGrid.appendChild(card);
    });
  }

  function pickCharacter(char, cardEl) {
    const role = SELECT_ORDER[state.roleIndex];
    cardEl.classList.add('selected');
    state.pickedIds.add(char.id);
    state.selected.push(char);

    // Briefly show the pick, then advance to the next role (or finish).
    setTimeout(() => {
      state.roleIndex++;
      if (state.roleIndex < SELECT_ORDER.length) {
        loadChooseStep();
      } else {
        enterAssignPhase();
      }
    }, 300);
  }

  function updateChooseUI() {
    const role = SELECT_ORDER[state.roleIndex];
    // Brother step already shows every real-art candidate — nothing to reroll.
    rerollBtn.style.display = role === 'brother' ? 'none' : '';
    rerollBtn.disabled = state.rerollUsed;
  }

  rerollBtn.addEventListener('click', () => {
    if (state.rerollUsed) return;
    state.rerollUsed = true;
    const role   = SELECT_ORDER[state.roleIndex];
    const gender = Speech.ROLE_GENDER[role];
    state.pool = buildPoolForRole(role, gender);
    renderPool();
    updateChooseUI();
  });

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 2 — ASSIGN
  // ══════════════════════════════════════════════════════════════════
  async function enterAssignPhase() {
    showPhase('assign');
    Board.init(boardGrid);

    // Open mic stream now (keep open for all 6 assignments)
    if (Recorder.isSupported() && !state.micOpen) {
      try {
        await Recorder.openStream();
        state.micOpen = true;
      } catch (e) {
        showFeedback('Microphone not available. Recording disabled.', 'error');
      }
    }

    state.assignIndex = 0;
    showCurrentChar();
  }

  function showCurrentChar() {
    const char = state.selected[state.assignIndex];

    // Large character image
    assignCharImg.src = Characters.imgUrl(char);
    assignCharImg.alt = char.name;

    assignPrompt.textContent = 'Who is this?';
    clearFeedback();
    transcriptBox.classList.remove('visible');
    transcriptBox.textContent = '';

    updateUndoBtn();

    // Start recording segment for this character
    if (state.micOpen) {
      try { Recorder.startSegment(); } catch (_) {}
    }
  }

  // Mic button
  let _listening = false;
  micBtn.addEventListener('click', () => {
    if (_listening) {
      stopListening();
    } else {
      startListening();
    }
  });

  function startListening() {
    _listening = true;
    micBtn.classList.add('listening');
    micLabel.textContent = 'Listening… tap to stop';
    clearFeedback();
    transcriptBox.classList.remove('visible');

    Speech.start(
      (result) => { _listening = false; micBtn.classList.remove('listening'); micLabel.textContent = 'Tap to speak'; handleSpeechResult(result); },
      (errMsg) => { _listening = false; micBtn.classList.remove('listening'); micLabel.textContent = 'Tap to speak'; showFeedback(errMsg, 'error'); },
      () => { if (state.micOpen) Recorder.markSpeechStart(); }
    );
  }

  function stopListening() {
    _listening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'Tap to speak';
    Speech.stop();
  }

  async function handleSpeechResult({ role, transcript, confidence, roleHint, genderMismatch }) {
    // Always show what was heard
    if (transcript) {
      transcriptBox.textContent = '"' + transcript + '"';
      transcriptBox.classList.add('visible');
    }

    const targetRole = SELECT_ORDER[state.assignIndex];
    const capTarget   = capitalize(targetRole);

    if (!role) {
      if (genderMismatch) {
        const cap     = capitalize(genderMismatch);
        const pronoun = Speech.ROLE_GENDER[genderMismatch] === 'male' ? 'He' : 'She';
        showFeedback(`Almost! Use "${pronoun} is my ${cap}." or "This is my ${cap}."`, 'info');
      } else if (roleHint) {
        const cap = capitalize(roleHint);
        showFeedback(`Good try! Say the full sentence: "This is my ${cap}."`, 'info');
      } else {
        showFeedback("Sorry, I didn't catch that. Can you say that again?", 'error');
      }
      return;
    }

    if (role !== targetRole) {
      showFeedback(`Not quite! This one is your ${capTarget}. Try: "This is my ${capTarget}."`, 'info');
      return;
    }

    // Valid assignment!
    const char = state.selected[state.assignIndex];

    // Stop recording and get the blob
    let audioBlob = new Blob([], { type: 'audio/webm' });
    if (state.micOpen) {
      try { audioBlob = await Recorder.stopSegment(); } catch (_) {}
    }

    state.assignments[targetRole] = { char, audioBlob, transcript };

    // Update board with fly-in
    Board.assign(targetRole, char);

    showFeedback(`${capTarget}! ✓`, 'success');

    state.assignIndex++;

    if (state.assignIndex >= state.selected.length) {
      // All 6 done
      setTimeout(() => enterSelfiePhase(), 900);
    } else {
      setTimeout(() => showCurrentChar(), 700);
    }
  }

  // Undo
  undoBtn.addEventListener('click', () => {
    if (state.assignIndex === 0) return;

    state.assignIndex--;
    const role = SELECT_ORDER[state.assignIndex];
    delete state.assignments[role];

    Board.unassign(role);

    // Re-start segment for this character
    if (state.micOpen) {
      try { Recorder.startSegment(); } catch (_) {}
    }

    clearFeedback();
    transcriptBox.classList.remove('visible');
    showCurrentChar();
  });

  function updateUndoBtn() {
    undoBtn.disabled = state.assignIndex === 0;
  }

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 3 — SELFIE
  // ══════════════════════════════════════════════════════════════════
  async function enterSelfiePhase() {
    // Close mic stream — we no longer need it
    if (state.micOpen) {
      Recorder.closeStream();
      state.micOpen = false;
    }

    showPhase('selfie');

    selfieFeedback.style.display = 'none';
    try {
      await Selfie.start(selfieVideo, selfiePreview);
      snapBtn.disabled       = false;
      retakeBtn.disabled     = true;
      selfieNextBtn.disabled = true;
    } catch (e) {
      console.error('Camera error:', e);
      const msg = e && e.name === 'NotFoundError'
        ? 'No camera found on this device. You can continue without a photo.'
        : e && e.name === 'NotAllowedError'
        ? 'Camera access was blocked. Check: Chrome address bar lock icon → Camera → Allow, then reload.'
        : e && e.name === 'NotReadableError'
        ? 'Camera is in use by another app. Close it and reload.'
        : `Camera error: ${e && e.message || e}. You can continue without a photo.`;
      selfieFeedback.textContent  = msg;
      selfieFeedback.style.display = 'block';
      snapBtn.disabled       = true;
      retakeBtn.disabled     = true;
      selfieNextBtn.disabled = false;
    }
  }

  snapBtn.addEventListener('click', () => {
    Selfie.capture();
    retakeBtn.disabled    = false;
    selfieNextBtn.disabled = false;
    snapBtn.disabled       = true;
  });

  retakeBtn.addEventListener('click', () => {
    Selfie.retake();
    snapBtn.disabled       = false;
    retakeBtn.disabled     = true;
    selfieNextBtn.disabled = true;
  });

  selfieNextBtn.addEventListener('click', () => {
    state.selfieDataURL = Selfie.getDataURL();
    Selfie.stop();
    enterPresentationPhase();
  });

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 4 — PRESENTATION
  // ══════════════════════════════════════════════════════════════════
  function enterPresentationPhase() {
    showPhase('presentation');
    Presentation.start(state.assignments, enterPhotoPhase);
  }

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 5 — FAMILY PHOTO
  // ══════════════════════════════════════════════════════════════════
  async function enterPhotoPhase() {
    showPhase('photo');

    // Start compositing immediately (hidden)
    photoCanvas.style.opacity = '0';
    photoCanvas.style.transition = 'none';
    const composePromise = Photo.compose(photoCanvas, state.assignments, state.selfieDataURL);

    // Fire flash + shutter sound
    playCameraClick();
    triggerFlash();

    // Wait for both compose and flash peak to settle, then fade in
    await composePromise;
    setTimeout(() => {
      photoCanvas.style.transition = 'opacity 1s ease-in';
      photoCanvas.style.opacity = '1';
      setTimeout(() => fireCelebration(), 700);
    }, 380);
  }

  function triggerFlash() {
    const overlay = $('flash-overlay');
    overlay.classList.remove('flashing');
    void overlay.offsetWidth;  // force reflow so animation re-fires
    overlay.classList.add('flashing');
  }

  function playCameraClick() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.1), ac.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / ac.sampleRate;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50);
      }
      const src  = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.4, ac.currentTime);
      src.connect(gain);
      gain.connect(ac.destination);
      src.start();
      src.onended = () => { try { ac.close(); } catch (_) {} };
    } catch (_) {}
  }

  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'my-family.png';
    link.href = photoCanvas.toDataURL('image/png');
    link.click();
  });

  playAgainBtn.addEventListener('click', () => {
    enterChoosePhase();
  });

  // ── ═══════════════════════════════════════════════════════════════
  //   Shared helpers
  // ══════════════════════════════════════════════════════════════════
  function showPhase(name) {
    Object.values(phases).forEach(el => el.classList.remove('active'));
    phases[name].classList.add('active');
  }

  function showFeedback(msg, type) {
    feedbackMsg.textContent = msg;
    feedbackMsg.className = 'feedback-msg ' + (type || '');
  }

  function clearFeedback() {
    feedbackMsg.textContent = '';
    feedbackMsg.className = 'feedback-msg';
  }

  function showGlobalWarning(msg) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#FEF3C7;color:#92400E;padding:10px 16px;font-size:.9rem;font-weight:700;z-index:1000;text-align:center;';
    banner.textContent = msg;
    document.body.prepend(banner);
  }

  // Celebration — simple confetti burst using CSS canvas
  function fireCelebration() {
    const cel = $('celebration');
    if (!cel) return;
    cel.classList.add('active');
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
    cel.innerHTML = '';
    cel.appendChild(c);

    const ctx = c.getContext('2d');
    const particles = Array.from({ length: 80 }, () => ({
      x:  Math.random() * c.width,
      y:  -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      color: `hsl(${Math.random() * 360},80%,60%)`,
      size: 6 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      rv:  (Math.random() - 0.5) * 0.2,
    }));

    let frame = 0;
    function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.rv;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      frame++;
      if (frame < 200) requestAnimationFrame(tick);
      else { cel.classList.remove('active'); cel.innerHTML = ''; }
    }
    requestAnimationFrame(tick);
  }

})();
