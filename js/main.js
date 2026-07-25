/**
 * main.js
 * App state machine + phase orchestration.
 * Depends on: characters.js, speech.js, recorder.js, board.js, selfie.js,
 *             presentation.js, photo.js
 */

(async function () {

  // Order family members are picked in, one at a time.
  const SELECT_ORDER = ['grandfather', 'father', 'brother', 'grandmother', 'mother', 'sister'];

  // Real-art characters, scoped to a single role's choose step — never shown for any other role.
  const ROLE_CHAR_IDS = {
    brother:     ['g06', 'g08', 'g14', 'g27', 'i02', 'i14', 'i27', 'i41', 'i49'],
    grandfather: ['g04', 'g19', 'g34', 'g40', 'g42', 'g47', 'g48', 'i01', 'i03', 'i36'],
  };
  const ALL_SCOPED_CHAR_IDS = Object.values(ROLE_CHAR_IDS).flat();

  // How many candidates are shown per choose-phase screen.
  const POOL_SIZE = 3;

  // ── State ─────────────────────────────────────────────────────────
  const state = {
    pool:           [],   // candidates currently shown for the role being picked
    rerollUsed:     false,
    roleIndex:      0,    // index into SELECT_ORDER for the choose phase
    pickedIds:      new Set(), // char ids already used by an earlier role
    scopedList:     null,  // full shuffled candidate list for a scoped-art role, else null
    scopedPage:     0,     // current page (of POOL_SIZE) into scopedList
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
  const progressSegs   = Array.from(document.querySelectorAll('#choose-progress .progress-seg'));
  const chooseHeader   = $('choose-header');
  const rerollBtn      = $('reroll-btn');

  // Assign phase
  const assignCharImg  = $('assign-char-img');
  const assignSentence = $('assign-sentence');
  const micBtn         = $('mic-btn');
  const micLabel       = $('mic-label');
  const transcriptBox  = $('transcript-box');
  const feedbackMsg    = $('feedback-msg');
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

  Presentation.init({
    charImg:  presCharImg,
    progress: presProgress,
    frame:    presFrame,
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
    const role     = SELECT_ORDER[state.roleIndex];
    const gender   = Speech.ROLE_GENDER[role];
    const scopedIds = ROLE_CHAR_IDS[role];

    if (scopedIds) {
      state.scopedList = Characters.shuffle(
        Characters.getAll().filter(c => scopedIds.includes(c.id) && !state.pickedIds.has(c.id))
      );
      state.scopedPage = 0;
      state.pool = state.scopedList.slice(0, POOL_SIZE);
    } else {
      state.scopedList = null;
      const exclude = new Set([...state.pickedIds, ...ALL_SCOPED_CHAR_IDS]);
      state.pool = Characters.buildGenderedPool(gender, POOL_SIZE, exclude);
    }
    state.rerollUsed = false;

    chooseHeader.textContent = `This is my ${role}.`;
    progressSegs.forEach((seg, i) => {
      seg.classList.toggle('done', i < state.roleIndex);
      seg.classList.toggle('active', i === state.roleIndex);
    });

    renderPool();
    updateChooseUI();
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
    if (state.scopedList) {
      // Only show reroll if there are more candidates than fit on one page.
      rerollBtn.style.display = state.scopedList.length > POOL_SIZE ? '' : 'none';
      rerollBtn.disabled = false;
    } else {
      rerollBtn.style.display = '';
      rerollBtn.disabled = state.rerollUsed;
    }
  }

  rerollBtn.addEventListener('click', () => {
    if (state.scopedList) {
      // Page through the fixed set in batches of 3, wrapping around.
      const pageCount = Math.ceil(state.scopedList.length / POOL_SIZE);
      state.scopedPage = (state.scopedPage + 1) % pageCount;
      const start = state.scopedPage * POOL_SIZE;
      state.pool = state.scopedList.slice(start, start + POOL_SIZE);
      renderPool();
      return;
    }
    if (state.rerollUsed) return;
    state.rerollUsed = true;
    const role   = SELECT_ORDER[state.roleIndex];
    const gender = Speech.ROLE_GENDER[role];
    const exclude = new Set([...state.pickedIds, ...ALL_SCOPED_CHAR_IDS]);
    state.pool = Characters.buildGenderedPool(gender, POOL_SIZE, exclude);
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
    const role = SELECT_ORDER[state.assignIndex];

    // Large character image
    assignCharImg.src = Characters.imgUrl(char);
    assignCharImg.alt = char.name;

    assignSentence.textContent = `This is my ${role}.`;
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

    // Canvas is visible from the start so the frames' pop-in reveal plays.
    photoCanvas.style.transition = 'none';
    photoCanvas.style.opacity = '1';

    // Frames pop in one at a time, the student's own photo last.
    await Photo.compose(photoCanvas, state.assignments, state.selfieDataURL);
  }

  // ── Shared audio context for UI sound effects ─────────────────────
  let _audioCtx = null;
  function getAudioContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  }

  // Short tap blip — plays on every button / character-card click
  function playClickSound() {
    const ac = getAudioContext();
    if (!ac) return;
    try {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ac.currentTime);
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.08);
    } catch (_) {}
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .char-card')) playClickSound();
  });

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

})();
