/**
 * main.js
 * App state machine + phase orchestration.
 * Depends on: characters.js, speech.js, recorder.js, board.js, selfie.js,
 *             presentation.js, photo.js
 */

(async function () {

  // Order family members are picked in, one at a time.
  const SELECT_ORDER = ['grandfather', 'father', 'brother', 'grandmother', 'mother', 'sister'];
  const CHOOSE_INTRO_LINGER_MS = 4000;
  const SCENE_FADE_MS = 500;

  // Phases with their own background music. Only intro and the reflection
  // epilogue (handled separately, in reflection.js) currently play music —
  // choose/photo are disabled for now (not removed: their presets are
  // still defined in ambient.js, so add 'choose'/'photo' back here to
  // re-enable them).
  const PHASE_AMBIENT = { intro: 'intro' };

  // Japanese role names, used for the choose-screen narration line.
  const ROLE_JP = {
    grandfather: 'おじいさん',
    father:      'おとうさん',
    brother:     'おにいさん',
    grandmother: 'おばあさん',
    mother:      'おかあさん',
    sister:      'おねえさん',
  };

  // Real-art characters, scoped to a single role's choose step — never shown for any other role.
  const ROLE_CHAR_IDS = {
    brother:     ['g06', 'g08', 'g14', 'g27', 'i02', 'i14', 'i27', 'i41', 'i49'],
    grandfather: ['g04', 'g19', 'g34', 'g40', 'g42', 'g47', 'g48', 'i01', 'i03', 'i36', 'gf51', 'gf52'],
    sister:      ['g05', 'g07', 'g13', 'g18', 'g31', 'g41', 'i18', 'i22', 'i50'],
    father:      ['g02', 'g15', 'g20', 'g33', 'g39', 'g43', 'i05', 'i21', 'i40', 'i47', 'f51', 'f52', 'f53'],
    mother:      ['g21', 'g24', 'g28', 'g37', 'g38', 'g46', 'i13', 'i23', 'i37', 'i48', 'm51'],
    grandmother: ['g03', 'g30', 'g32', 'g36', 'g45', 'g49', 'i28', 'i35', 'i44', 'i46'],
  };

  // How many candidates are shown per choose-phase screen.
  const POOL_SIZE = 3;
  const THIS_IS_MY_AUDIO = {
    grandfather: 'assets/audio/this-is-my/01-grandfather.mp3',
    grandmother: 'assets/audio/this-is-my/02-grandmother.mp3',
    father:      'assets/audio/this-is-my/03-father.mp3',
    mother:      'assets/audio/this-is-my/04-mother.mp3',
    brother:     'assets/audio/this-is-my/05-brother.mp3',
    sister:      'assets/audio/this-is-my/06-sister.mp3',
  };
  const FAMILY_SELECTION_MUSIC = 'assets/audio/family-selection.mp3';
  const FAMILY_PHOTO_WALL_MUSIC = 'assets/audio/family-photo-wall.mp3';
  const SELECTION_MUSIC_VOLUME = 0.38;
  const SELECTION_MUSIC_DUCKED_VOLUME = 0.12;
  const PHOTO_WALL_MUSIC_VOLUME = 0.38;
  const PHOTO_WALL_MUSIC_DUCKED_VOLUME = 0.12;

  // ── State ─────────────────────────────────────────────────────────
  const state = {
    pool:           [],   // candidates currently shown for the role being picked
    roleIndex:      0,    // index into SELECT_ORDER for the choose phase
    pickedIds:      new Set(), // char ids already used by an earlier role
    scopedList:     null,  // full shuffled candidate list for the current role
    scopedPage:     0,     // current page (of POOL_SIZE) into scopedList
    selected:       [],   // 6 chars, in SELECT_ORDER order (set as choose phase proceeds)
    assignIndex:    0,    // index into selected[] / SELECT_ORDER currently being assigned
    assignments:    {},   // { role: { char, audioBlob, transcript } }
    selfieDataURL:  null,
    micOpen:        false,
    playerName:     '',
    talkedTo:       new Set(), // roles the player has finished a conversation with
    conversationIntroduced: new Set(), // roles that have shown the first-time background linger
    chooseIntroSeen: false,
    phase:          '',
  };
  let chooseIntroLingerTimer = null;
  let selectionMusic = null;
  let selectionMusicWanted = false;
  let selectionMusicRetryBound = false;
  let selectionMusicDucked = false;
  let photoWallMusic = null;
  let photoWallMusicWanted = false;
  let photoWallMusicRetryBound = false;
  let photoWallMusicDucked = false;

  function getSelectionMusic() {
    if (selectionMusic) return selectionMusic;
    selectionMusic = new Audio(FAMILY_SELECTION_MUSIC);
    selectionMusic.preload = 'auto';
    selectionMusic.loop = true; // Native looping restarts at the beginning without a gap.
    selectionMusic.volume = selectionMusicDucked ? SELECTION_MUSIC_DUCKED_VOLUME : SELECTION_MUSIC_VOLUME;
    return selectionMusic;
  }

  function startSelectionMusic() {
    selectionMusicWanted = true;
    const audio = getSelectionMusic();
    if (!audio.paused) return;
    audio.play().catch(() => {
      // Browsers may require one more direct gesture after the transition.
      // The next tap/key on the selection screen resumes the same track.
      if (selectionMusicRetryBound) return;
      selectionMusicRetryBound = true;
      const retry = () => {
        document.removeEventListener('pointerdown', retry);
        document.removeEventListener('keydown', retry);
        selectionMusicRetryBound = false;
        if (selectionMusicWanted) startSelectionMusic();
      };
      document.addEventListener('pointerdown', retry, { once: true, passive: true });
      document.addEventListener('keydown', retry, { once: true });
    });
  }

  function stopSelectionMusic() {
    selectionMusicWanted = false;
    selectionMusicDucked = false;
    if (!selectionMusic) return;
    selectionMusic.pause();
    selectionMusic.currentTime = 0;
  }

  function duckSelectionMusic() {
    selectionMusicDucked = true;
    if (selectionMusic) selectionMusic.volume = SELECTION_MUSIC_DUCKED_VOLUME;
  }

  function restoreSelectionMusic() {
    selectionMusicDucked = false;
    if (selectionMusic) selectionMusic.volume = SELECTION_MUSIC_VOLUME;
  }

  function getPhotoWallMusic() {
    if (photoWallMusic) return photoWallMusic;
    photoWallMusic = new Audio(FAMILY_PHOTO_WALL_MUSIC);
    photoWallMusic.preload = 'auto';
    photoWallMusic.loop = true;
    photoWallMusic.volume = photoWallMusicDucked ? PHOTO_WALL_MUSIC_DUCKED_VOLUME : PHOTO_WALL_MUSIC_VOLUME;
    return photoWallMusic;
  }

  function startPhotoWallMusic() {
    photoWallMusicWanted = true;
    const audio = getPhotoWallMusic();
    if (!audio.paused) return;
    audio.play().catch(() => {
      if (photoWallMusicRetryBound) return;
      photoWallMusicRetryBound = true;
      const retry = () => {
        document.removeEventListener('pointerdown', retry);
        document.removeEventListener('keydown', retry);
        photoWallMusicRetryBound = false;
        if (photoWallMusicWanted) startPhotoWallMusic();
      };
      document.addEventListener('pointerdown', retry, { once: true, passive: true });
      document.addEventListener('keydown', retry, { once: true });
    });
  }

  function stopPhotoWallMusic() {
    photoWallMusicWanted = false;
    photoWallMusicDucked = false;
    if (!photoWallMusic) return;
    photoWallMusic.pause();
    photoWallMusic.currentTime = 0;
  }

  function duckPhotoWallMusic() {
    photoWallMusicDucked = true;
    if (photoWallMusic) photoWallMusic.volume = PHOTO_WALL_MUSIC_DUCKED_VOLUME;
  }

  function restorePhotoWallMusic() {
    photoWallMusicDucked = false;
    if (photoWallMusic) photoWallMusic.volume = PHOTO_WALL_MUSIC_VOLUME;
  }

  // ── DOM refs ───────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // Phase containers
  const phases = {
    intro:        $('phase-intro'),
    choose:       $('phase-choose'),
    assign:       $('phase-assign'),
    selfie:       $('phase-selfie'),
    presentation: $('phase-presentation'),
    photo:        $('phase-photo'),
  };

  // Intro phase
  const introSkipBtn   = $('intro-skip-btn');
  const introTapZone   = $('intro-tap-zone');
  const introLine      = $('intro-line');
  const introHint      = $('intro-hint');
  const introYesBtn    = $('intro-yes-btn');
  const introInputWrap = $('intro-input-wrap');
  const introNameInput = $('intro-name-input');
  const introNameError = $('intro-name-error');
  const introNextBtn   = $('intro-next-btn');

  // Choose phase
  const charGrid       = $('char-grid');

  // Character profile card
  const profileOverlay = $('profile-overlay');
  const profileCard    = $('profile-card');
  const profilePortrait= $('profile-portrait');
  const profileSection = $('profile-section');
  const profileFields  = $('profile-fields');
  const profileActions = $('profile-actions');
  const profileBackBtn = $('profile-back-btn');
  const profileChooseBtn = $('profile-choose-btn');
  const chooseHeader   = $('choose-header');
  const chooseSubtitle = $('choose-subtitle');
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
  const hintBubble     = $('hint-bubble');
  const completionMarks= $('completion-marks');
  const meGlow         = $('me-glow');
  const blackFade      = $('black-fade');
  const eyeOpening     = $('eye-opening');
  const eyeOpeningMaskAnimation = $('eye-opening-mask-animation');

  // ── Boot ───────────────────────────────────────────────────────────
  const loadingScreen = $('loading-screen');

  await Promise.all([Characters.load(), Profile.load(), Conversation.load()]);
  loadingScreen.style.display = 'none';

  // Warm every family-selection card's portrait now, during the intro's
  // typewriter dialogue, so the choose phase's cards are already decoded
  // and cached by the time the player reaches them instead of painting in
  // progressively. Just setting .src only fetches the bytes — decode()
  // forces the browser to fully rasterize the bitmap ahead of time too.
  Characters.getAll().forEach(char => {
    const img = new Image();
    img.src = Characters.imgUrl(char);
    if (img.decode) img.decode().catch(() => {});
  });

  // Warm the bedroom backdrop so the reflection scene fades in already painted.
  new Image().src = 'assets/bedroom-bg.jpg';

  Profile.init({
    overlay:   profileOverlay,
    card:      profileCard,
    portrait:  profilePortrait,
    section:   profileSection,
    fields:    profileFields,
    actions:   profileActions,
    backBtn:   profileBackBtn,
    chooseBtn: profileChooseBtn,
  });

  Conversation.init({
    overlay:      $('convo-overlay'),
    portraitFrame: $('convo-portrait-frame'),
    portrait:     $('convo-portrait'),
    box:          $('convo-box'),
    speaker:      $('convo-speaker'),
    text:         $('convo-text'),
    answers:      $('convo-answers'),
    hint:         $('convo-hint'),
    closeBtn:     $('convo-close-btn'),
  });

  Reflection.init({
    overlay:      $('reflect-overlay'),
    box:          $('reflect-box'),
    portraitWrap: $('reflect-portrait-wrap'),
    portrait:     $('reflect-portrait'),
    speaker:      $('reflect-speaker'),
    text:         $('reflect-text'),
    choices:      $('reflect-choices'),
    hint:         $('reflect-hint'),
    end:          $('reflect-end'),
    replayBtn:    $('reflect-replay-btn'),
  }, () => enterChoosePhase());

  Presentation.init({
    charImg:  presCharImg,
    progress: presProgress,
    frame:    presFrame,
  });

  Intro.init({
    tapZone:   introTapZone,
    lineEl:    introLine,
    hint:      introHint,
    yesBtn:    introYesBtn,
    inputWrap: introInputWrap,
    nameInput: introNameInput,
    nameError: introNameError,
    nextBtn:   introNextBtn,
    skipBtn:   introSkipBtn,
  });

  if (!Speech.isSupported()) {
    showGlobalWarning('⚠️ おんせいにんしきが つかえません。Google Chromeで ひらいてください。');
  }

  showPhase('intro');
  Intro.start((name) => {
    state.playerName = name;
    eyeOpeningTransition(() => enterChoosePhase());
  });

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 1 — CHOOSE  (one family member at a time, in SELECT_ORDER)
  // ══════════════════════════════════════════════════════════════════
  function enterChoosePhase() {
    state.roleIndex      = 0;
    state.pickedIds       = new Set();
    state.selected        = [];
    state.assignments     = {};
    state.selfieDataURL   = null;
    state.assignIndex     = 0;
    state.talkedTo        = new Set();
    state.conversationIntroduced = new Set();

    Profile.close();
    Conversation.close();
    Reflection.close();
    stopHintRotation();
    clearCompletionMarks();
    hideMeGlow();

    const showIntroLinger = !state.chooseIntroSeen;
    state.chooseIntroSeen = true;
    clearTimeout(chooseIntroLingerTimer);

    showPhase('choose');
    phases.choose.classList.toggle('intro-linger', showIntroLinger);
    loadChooseStep();

    if (showIntroLinger) {
      // The scene-fade needs to clear first, then leave the untouched artwork
      // on-screen for the same 2.5-second reading pause as conversations.
      chooseIntroLingerTimer = setTimeout(() => {
        phases.choose.classList.remove('intro-linger');
        chooseIntroLingerTimer = null;
      }, SCENE_FADE_MS + CHOOSE_INTRO_LINGER_MS);
    }
  }

  function loadChooseStep() {
    const role      = SELECT_ORDER[state.roleIndex];
    const scopedIds = ROLE_CHAR_IDS[role];

    state.scopedList = Characters.shuffle(
      Characters.getAll().filter(c => scopedIds.includes(c.id) && !state.pickedIds.has(c.id))
    );
    state.scopedPage = 0;
    state.pool = state.scopedList.slice(0, POOL_SIZE);

    chooseHeader.textContent = `This is my ${role}.`;
    chooseSubtitle.textContent = `新しい${ROLE_JP[role]}に会いましょう。`;
    renderPool();
    updateChooseUI();
  }

  function renderPool() {
    charGrid.innerHTML = '';
    state.pool.forEach((char, i) => {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.id = char.id;
      // Stagger the entrance, and vary the idle rhythm so the portraits
      // don't breathe in lockstep.
      card.style.setProperty('--enter-delay', `${i * 130}ms`);
      card.style.setProperty('--idle-dur', `${3.6 + i * 0.45}s`);

      const imgEl = new Image();
      imgEl.src = Characters.imgUrl(char);
      imgEl.alt = char.name;
      imgEl.classList.toggle('crop-chest', !!char.fullBody);
      imgEl.classList.toggle('crop-close', char.portraitCrop === 'close');
      card.appendChild(imgEl);

      card.addEventListener('click', () => pickCharacter(char, card));
      charGrid.appendChild(card);
    });
  }

  // Tapping a portrait opens its profile card first — the character is only
  // added to the family once the player confirms with 「この人にする」.
  function pickCharacter(char, cardEl) {
    if (cardEl.classList.contains('picking')) return;

    // Let the tap land visibly (glow + enlarge + blip) before the profile
    // slides in, rather than snapping straight to the next screen.
    cardEl.classList.add('picking');
    Sfx.select();

    setTimeout(() => {
      Profile.open(char, Characters.imgUrl(char), {
        onBack:    () => cardEl.classList.remove('picking'),
        onConfirm: () => {
          cardEl.classList.remove('picking');
          confirmCharacter(char, cardEl);
        },
      });
    }, 320);
  }

  function confirmCharacter(char, cardEl) {
    const role = SELECT_ORDER[state.roleIndex];
    state.pickedIds.add(char.id);
    state.selected.push(char);

    // Highlight the chosen portrait and stamp a checkmark on it.
    cardEl.classList.add('selected');
    cardEl.appendChild(makeCheckmark());

    const advanceChooseStep = () => {
      state.roleIndex++;
      if (state.roleIndex < SELECT_ORDER.length) {
        loadChooseStep();
      } else {
        enterAssignPhase();
      }
    };

    // The supplied narrator clip replaces browser TTS for this grammar line.
    playThisIsMyAudio(role, advanceChooseStep);
  }

  function playThisIsMyAudio(role, onDone) {
    const src = THIS_IS_MY_AUDIO[role];
    if (!src) { setTimeout(onDone, 1700); return; }

    duckSelectionMusic();
    const audio = new Audio(src);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      restoreSelectionMusic();
      onDone();
    };
    const fallback = setTimeout(finish, 3500);
    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', finish, { once: true });
    audio.play().catch(finish);
  }

  function makeCheckmark() {
    const badge = document.createElement('div');
    badge.className = 'card-check';
    badge.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="20 6 9 17 4 12"/></svg>';
    return badge;
  }

  function updateChooseUI() {
    // Only show reroll if there are more candidates than fit on one page.
    rerollBtn.style.display = state.scopedList.length > POOL_SIZE ? '' : 'none';
    rerollBtn.disabled = false;
  }

  rerollBtn.addEventListener('click', () => {
    // Page through the fixed set in batches of POOL_SIZE, wrapping around.
    const pageCount = Math.ceil(state.scopedList.length / POOL_SIZE);
    state.scopedPage = (state.scopedPage + 1) % pageCount;
    const start = state.scopedPage * POOL_SIZE;
    state.pool = state.scopedList.slice(start, start + POOL_SIZE);
    renderPool();
  });

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── ═══════════════════════════════════════════════════════════════
  //   PHASE 2 — ASSIGN
  // ══════════════════════════════════════════════════════════════════
  async function enterAssignPhase(options = {}) {
    showPhase('assign');

    // Open mic stream now (keep open for all 6 assignments)
    if (!options.skipMic && Recorder.isSupported() && !state.micOpen) {
      try {
        await Recorder.openStream();
        state.micOpen = true;
      } catch (e) {
        showFeedback('マイクが つかえません。ろくおんは できません。', 'error');
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
    const useChestCrop = !!char.fullBody && !char.recordingFullBody;
    assignCharImg.classList.toggle('crop-chest', useChestCrop);
    assignCharImg.classList.toggle('crop-close', useChestCrop && char.portraitCrop === 'close');

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
    micLabel.textContent = 'きいています…タップで ストップ';
    clearFeedback();
    transcriptBox.classList.remove('visible');

    Speech.start(
      (result) => { _listening = false; micBtn.classList.remove('listening'); micLabel.textContent = 'タップして はなそう'; handleSpeechResult(result); },
      (errMsg) => { _listening = false; micBtn.classList.remove('listening'); micLabel.textContent = 'タップして はなそう'; showFeedback(errMsg, 'error'); },
      () => { if (state.micOpen) Recorder.markSpeechStart(); }
    );
  }

  function stopListening() {
    _listening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'タップして はなそう';
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
        showFeedback(`おしい！「${pronoun} is my ${cap}.」か「This is my ${cap}.」と言ってみて`, 'info');
      } else if (roleHint) {
        const cap = capitalize(roleHint);
        showFeedback(`いいちょうせん！ぶんぜんたいを 言ってみよう：「This is my ${cap}.」`, 'info');
      } else {
        showFeedback("ごめんね、聞き取れなかったよ。もう一度言ってみて？", 'error');
      }
      return;
    }

    if (role !== targetRole) {
      showFeedback(`ちがうよ！これは あなたの${capTarget}だよ。「This is my ${capTarget}.」と言ってみて`, 'info');
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
        ? 'カメラが 見つかりません。しゃしんなしで つづけられます。'
        : e && e.name === 'NotAllowedError'
        ? 'カメラへの アクセスが ブロックされました。Chromeの アドレスバーの鍵アイコン→カメラ→許可 にして、ページを再読み込みしてください。'
        : e && e.name === 'NotReadableError'
        ? 'カメラが 他のアプリで 使用中です。閉じてから 再読み込みしてください。'
        : `カメラエラー：${e && e.message || e}。しゃしんなしで つづけられます。`;
      selfieFeedback.textContent  = msg;
      selfieFeedback.style.display = 'block';
      snapBtn.disabled       = true;
      retakeBtn.disabled     = true;
      selfieNextBtn.disabled = false;
    }
  }

  snapBtn.addEventListener('click', () => {
    Selfie.capture();
    playCameraClick();
    triggerFlash();
    retakeBtn.disabled    = false;
    selfieNextBtn.disabled = false;
    snapBtn.disabled       = true;
  });

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
    await Photo.compose(photoCanvas, state.assignments, state.selfieDataURL, state.playerName);

    refreshCompletionMarks();
    startHintRotation();
  }

  // "Tap me!" bubble — invites the player toward a random family member,
  // rotating among them until a conversation actually starts.
  const HINT_SHOW_MS = 4000;
  const HINT_FADE_MS = 300;
  let _hintTimer = null;
  let _hintKey   = null;

  function startHintRotation() {
    stopHintRotation();
    hintCycle();
  }

  function hintCycle() {
    const keys = unfinishedTalkRoles();
    if (keys.length === 0) {
      _hintTimer = null;
      hintBubble.classList.remove('visible');
      return;
    }

    let next = keys[Math.floor(Math.random() * keys.length)];
    if (keys.length > 1 && next === _hintKey) {
      next = keys[(keys.indexOf(next) + 1) % keys.length];
    }
    _hintKey = next;
    positionHint(next);
    hintBubble.classList.add('visible');

    _hintTimer = setTimeout(() => {
      hintBubble.classList.remove('visible');
      _hintTimer = setTimeout(hintCycle, HINT_FADE_MS);
    }, HINT_SHOW_MS);
  }

  function positionHint(key) {
    const rect = Photo.getCardScreenRect(photoCanvas, key);
    if (!rect) { hintBubble.classList.remove('visible'); return; }
    hintBubble.style.left = `${rect.left + rect.width / 2}px`;
    hintBubble.style.top  = `${rect.top}px`;
  }

  function stopHintRotation() {
    clearTimeout(_hintTimer);
    _hintTimer = null;
    _hintKey   = null;
    hintBubble.classList.remove('visible');
  }

  window.addEventListener('resize', () => {
    if (_hintKey) positionHint(_hintKey);
    refreshCompletionMarks();
    if (meGlow.classList.contains('visible')) refreshMeGlow();
  });

  function unfinishedTalkRoles() {
    return Object.keys(state.assignments).filter(role => !state.talkedTo.has(role));
  }

  function refreshCompletionMarks() {
    clearCompletionMarks();
    Object.keys(state.assignments)
      .filter(role => state.talkedTo.has(role))
      .forEach(role => {
        const rect = Photo.getCardScreenRect(photoCanvas, role);
        if (!rect) return;
        // Scale the badge to the frame so it remains fully inside the
        // upper-right corner on both large and small portraits.  The inset
        // is deliberately a little larger than the old fixed value so the
        // circle has visible breathing room from both frame edges.
        const shortSide = Math.min(rect.width, rect.height);
        const markSize = Math.max(22, Math.min(36, Math.round(shortSide * 0.3)));
        const markPadding = Math.max(8, Math.round(markSize * 0.4));
        const markCenterInset = markSize / 2 + markPadding;
        const mark = document.createElement('div');
        mark.className = 'photo-complete-mark';
        mark.innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="20 6 9 17 4 12"/></svg>';
        mark.style.width = `${markSize}px`;
        mark.style.height = `${markSize}px`;
        mark.style.left = `${rect.left + rect.width - markCenterInset}px`;
        mark.style.top  = `${rect.top + markCenterInset}px`;
        completionMarks.appendChild(mark);
      });
  }

  function clearCompletionMarks() {
    completionMarks.innerHTML = '';
  }

  // ── Player-portrait glow: appears once every family member has been met ──
  function allFamilyTalkedTo() {
    const roles = Object.keys(state.assignments);
    return roles.length > 0 && roles.every(r => state.talkedTo.has(r));
  }

  function refreshMeGlow() {
    if (!allFamilyTalkedTo()) { meGlow.classList.remove('visible'); return; }
    const rect = Photo.getCardScreenRect(photoCanvas, 'me');
    if (!rect) { meGlow.classList.remove('visible'); return; }
    meGlow.style.left   = `${rect.left}px`;
    meGlow.style.top    = `${rect.top}px`;
    meGlow.style.width  = `${rect.width}px`;
    meGlow.style.height = `${rect.height}px`;
    meGlow.classList.add('visible');
  }

  function hideMeGlow() { meGlow.classList.remove('visible'); }

  // Activate one card on the final photo. Both the portrait itself and the
  // rotating "Let's talk!" bubble use this exact path.
  function activatePhotoCard(key) {
    if (!key || Conversation.isOpen() || Reflection.isOpen()) return;
    Photo.pulseCard(photoCanvas, key);

    // The player's own frame: once everyone has been met, it leads to the
    // reflection scene. Before that it's just a pulse.
    if (key === 'me') {
      if (allFamilyTalkedTo()) {
        stopHintRotation();
        hideMeGlow();
        stopPhotoWallMusic();
        enterReflection();
      }
      return;
    }

    const entry = state.assignments[key];
    if (!entry) return;

    stopHintRotation();
    hideMeGlow();
    duckPhotoWallMusic();
    const speakerName = Profile.displayNameWithReading(entry.char.id)
                     || Profile.displayName(entry.char.id)
                     || capitalize(key);
    const hasIntroLinger = !state.conversationIntroduced.has(key);
    state.conversationIntroduced.add(key);
    Conversation.start(
      key,
      speakerName,
      Characters.imgUrl(entry.char),
      state.selfieDataURL,
      state.playerName,
      (completed) => {
        if (completed) {
          state.talkedTo.add(key);
          refreshCompletionMarks();
        }
        // Keep the wall song in place for the conversation, then bring it
        // back up once the player returns to the portrait wall.
        restorePhotoWallMusic();
        startPhotoWallMusic();
        startHintRotation();
        refreshMeGlow();
      },
      entry.char,
      { hasIntroLinger }
    );
  }

  // Tap a framed portrait on the final photo to talk with that family member.
  photoCanvas.addEventListener('click', (e) => {
    const key = Photo.getCardAt(photoCanvas, e.clientX, e.clientY);
    activatePhotoCard(key);
  });

  hintBubble.addEventListener('click', () => {
    // The key is set at the same moment the visible bubble is positioned, so
    // it always opens the exact family member the bubble is attached to.
    activatePhotoCard(_hintKey);
  });

  // ── ═══════════════════════════════════════════════════════════════
  //   REFLECTION — the epilogue, after every family member has been met
  // ══════════════════════════════════════════════════════════════════
  function enterReflection() {
    // Fade to black, swap scenes behind the curtain, then fade back in.
    clearCompletionMarks();
    blackFade.classList.add('active');
    setTimeout(() => {
      Reflection.start(state.selfieDataURL, state.playerName);
      blackFade.classList.remove('active');
    }, 520);
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

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== 'd' || e.repeat) return;
    e.preventDefault();
    debugSkipCurrentPhase();
  });

  function debugSkipCurrentPhase() {
    console.info(`Debug skip: ${state.phase}`);
    if (Conversation.isOpen()) {
      Conversation.close();
    } else if (state.phase === 'choose') {
      debugSkipChoosePhase();
    } else if (state.phase === 'assign') {
      debugSkipAssignPhase();
    } else if (state.phase === 'presentation') {
      Presentation.skip();
    } else if (state.phase === 'photo') {
      debugSkipPhotoPhase();
    }
  }

  function debugSkipChoosePhase() {
    Profile.close();

    for (let i = state.roleIndex; i < SELECT_ORDER.length; i++) {
      const role = SELECT_ORDER[i];
      const char = debugPickCharacter(role);
      if (!char) continue;

      state.pickedIds.add(char.id);
      state.selected[i] = char;
    }

    state.selected = state.selected.slice(0, SELECT_ORDER.length);
    state.roleIndex = Math.min(state.selected.length, SELECT_ORDER.length);
    enterAssignPhase({ skipMic: true });
  }

  function debugPickCharacter(role) {
    const all = Characters.getAll();
    const ids = ROLE_CHAR_IDS[role] || [];
    return ids
      .map(id => all.find(c => c.id === id))
      .find(char => char && !state.pickedIds.has(char.id));
  }

  function debugSkipAssignPhase() {
    if (_listening) stopListening();
    if (state.micOpen) {
      Recorder.closeStream();
      state.micOpen = false;
    }

    for (let i = state.assignIndex; i < state.selected.length; i++) {
      const role = SELECT_ORDER[i];
      const char = state.selected[i];
      if (!role || !char) continue;

      state.assignments[role] = {
        char,
        audioBlob: null,
        transcript: '[debug skipped]',
        skipped: true,
      };
    }

    state.assignIndex = state.selected.length;
    enterSelfiePhase();
  }

  function debugSkipPhotoPhase() {
    stopHintRotation();
    Object.keys(state.assignments).forEach(role => state.talkedTo.add(role));
    refreshCompletionMarks();
    refreshMeGlow();
    hideMeGlow();
    enterReflection();
  }

  // ── ═══════════════════════════════════════════════════════════════
  //   Shared helpers
  // ══════════════════════════════════════════════════════════════════
  function showPhase(name) {
    state.phase = name;
    Object.values(phases).forEach(el => el.classList.remove('active'));
    phases[name].classList.add('active');

    if (PHASE_AMBIENT[name]) {
      Ambient.start(PHASE_AMBIENT[name]);
    } else {
      Ambient.stop();
    }

    if (name === 'choose') startSelectionMusic();
    else stopSelectionMusic();

    if (name === 'photo') startPhotoWallMusic();
    else stopPhotoWallMusic();
  }

  // Fades to white, runs the phase switch while the screen is fully white,
  // then fades back out — softens the cut between the intro and the game.
  function fadeTransition(midCallback) {
    const overlay = $('scene-fade');
    overlay.classList.add('active');
    setTimeout(() => {
      midCallback();
      requestAnimationFrame(() => overlay.classList.remove('active'));
    }, SCENE_FADE_MS);
  }

  // The very first move from the text intro into the castle is deliberately
  // different from ordinary phase fades: the scene is already running under
  // a pair of curved lids, as though the player is waking up there.
  let eyeOpeningTimer = null;
  function eyeOpeningTransition(midCallback) {
    clearTimeout(eyeOpeningTimer);
    eyeOpening.classList.remove('active');
    void eyeOpening.offsetWidth; // restart the CSS fade if this transition is replayed
    eyeOpening.classList.add('active'); // 0.0s: completely black
    if (eyeOpeningMaskAnimation && eyeOpeningMaskAnimation.beginElement) {
      eyeOpeningMaskAnimation.beginElement();
    }
    midCallback();
    phases.choose.classList.add('eye-opening');

    // 1.8s: lids have left the screen; the existing zoom/linger continues.
    eyeOpeningTimer = setTimeout(() => {
      eyeOpening.classList.remove('active');
      phases.choose.classList.remove('eye-opening');
      eyeOpeningTimer = null;
    }, 1800);
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
