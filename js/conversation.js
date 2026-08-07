/**
 * conversation.js
 * Short interactive conversation with a family member, opened by tapping
 * their portrait on the final family photo screen. JRPG/visual-novel
 * presentation: fantasy backdrop, large portrait overlapping a bottom
 * dialogue box, and multiple-choice answer buttons.
 *
 * Flow per question:
 *   family member asks → player picks an answer → player's selfie and
 *   chosen sentence waits for a tap → family member reacts → next question.
 */

const Conversation = (() => {

  const INDICATOR_DELAY_MS = 500;
  const AUTO_REACTION_MIN_MS = 2500;
  const AUTO_REACTION_MAX_MS = 6000;
  const AUTO_REACTION_WORD_MS = 650;
  const INTRO_LINGER_MS = 2500;
  const OVERLAY_FADE_IN_MS = 450;
  // Some scenes get a slower reveal (zoom in on a detail, pan across, then
  // zoom out) so they need more time than the usual linger. Keyed by the
  // background path; each maps to the CSS class that drives its animation.
  const SPECIAL_ZOOM_SCENES = {
    'assets/dining-bg.jpg':         { cls: 'feast-zoom',    ms: 5000 },
    'assets/library-bg.jpg':        { cls: 'library-zoom',  ms: 5500 },
    'assets/workshop-golem-bg.jpg': { cls: 'workshop-zoom', ms: 3550 },
    // These use the same unhurried reveal as the library, with a focal point
    // chosen for the important detail in each picture.
    'assets/market-bg.jpg':         { cls: 'market-zoom',      ms: 5500 },
    'assets/garden-bg.jpg':         { cls: 'garden-party-zoom', ms: 5500 },
    'assets/observatory-bg.jpg':    { cls: 'observatory-zoom', ms: 5500 },
    'assets/cottage-bg.jpg':        { cls: 'cottage-zoom',     ms: 5500 },
    'assets/study-bg.jpg':          { cls: 'study-zoom',       ms: 5500 },
  };

  // Conversation scenes have no background music for now (disabled, not
  // removed — flip this back on to resume using the tailored presets below).
  const MUSIC_ENABLED = false;

  // Every conversation background gets its own tailored Ambient preset
  // (js/ambient.js), whether or not it also has a SPECIAL_ZOOM_SCENES entry.
  const BG_AMBIENT = {
    'assets/dining-bg.jpg':            'feast',
    'assets/library-bg.jpg':           'library',
    'assets/workshop-golem-bg.jpg':    'workshop',
    'assets/workshop-missile-bg.jpg':  'workshopMissile',
    'assets/market-bg.jpg':            'market',
    'assets/garden-bg.jpg':            'gardenParty',
    'assets/observatory-bg.jpg':       'observatory',
    'assets/cottage-bg.jpg':           'cottage',
    'assets/study-bg.jpg':             'study',
    'assets/tavern-bg.jpg':            'tavern',
    'assets/alchemy-bg.jpg':           'alchemy',
    'assets/bakery-bg.jpg':            'bakery',
    'assets/yard-bg.jpg':              'yard',
    'assets/selfie-bg.jpg':            'roseGarden',
    'assets/stable-bg.png':            'stable',
  };

  let _data   = {};
  let els     = {};
  let _onDone = null;

  // Current run
  let _role       = '';
  let _script     = null;
  let _charImg    = '';
  let _charMeta   = {};
  let _speakerName = '';
  let _playerImg  = '';
  let _playerName = 'Me';
  let _qIndex     = 0;
  let _advance    = null;   // set when a line is waiting for a tap
  let _timer      = null;
  let _open       = false;

  async function load() {
    try {
      const res = await fetch('assets/conversations.json');
      _data = await res.json();
    } catch (_) {
      _data = {};
    }
    return _data;
  }

  function init(elements) {
    els = elements;
    els.overlay.addEventListener('click', (e) => {
      if (e.target.closest('.convo-answer, #convo-close-btn')) return;  // buttons handle themselves
      advanceDialogueNow();
    });
    els.closeBtn.addEventListener('click', () => finish(false));
    document.addEventListener('keydown', handleKeyAdvance);
  }

  function isOpen() { return _open; }

  /**
   * @param role        family role key ('mother', 'father', …)
   * @param speakerName display name for that character
   * @param charImgSrc  the character's portrait
   * @param playerImg   the player's selfie (may be null)
   * @param playerName  the player's entered name
   * @param onDone      called after the scene fades out
   * @param charMeta    optional character display metadata
   * @param options     optional scene behavior controls
   */
  function start(role, speakerName, charImgSrc, playerImg, playerName, onDone, charMeta = {}, options = {}) {
    _script = _data[role];
    if (!_script) { if (onDone) onDone(); return; }

    _role        = role;
    _speakerName = speakerName;
    _charImg     = charImgSrc;
    _charMeta    = charMeta || {};
    _playerImg   = playerImg || '';
    _playerName  = playerName || 'Me';
    _onDone      = onDone;
    _qIndex      = 0;
    _open        = true;

    const hasIntroLinger = !!options.hasIntroLinger;
    els.overlay.classList.toggle('intro-linger', hasIntroLinger);
    // The backdrop is always the original artwork. CSS supplies the normal
    // darkening layer, and removes it for a first-visit linger.
    // Some characters get their own scene instead of the role's default,
    // so their conversation feels tailored to who they are.
    const bg = (_script.charBg && _script.charBg[_charMeta.id]) || _script.bg;
    els.overlay.style.backgroundImage = `url('${bg}')`;
    const specialZoom = SPECIAL_ZOOM_SCENES[bg];
    Object.values(SPECIAL_ZOOM_SCENES).forEach(z => els.overlay.classList.remove(z.cls));
    if (specialZoom) els.overlay.classList.add(specialZoom.cls);
    els.overlay.classList.add('active');
    Sfx.whoosh();
    if (MUSIC_ENABLED) Ambient.start(BG_AMBIENT[bg] || 'choose');

    clearTimeout(_timer);
    if (hasIntroLinger) {
      // Count only after the overlay fade has completed, so the scene stays
      // bright and free of dialogue for the full requested linger.
      const lingerMs = specialZoom ? specialZoom.ms : INTRO_LINGER_MS;
      _timer = setTimeout(() => {
        if (!_open) return;
        els.overlay.classList.remove('intro-linger');
        showCharacterLine(_script.greeting, () => askQuestion(0));
      }, OVERLAY_FADE_IN_MS + lingerMs);
    } else {
      // Greeting, then the first question.
      showCharacterLine(_script.greeting, () => askQuestion(0));
    }
  }

  /* ── Speakers ───────────────────────────────────────────────────── */

  function showCharacterLine(text, next) {
    setSpeaker(_speakerName, _charImg, 'character');
    els.text.textContent = text;
    clearAnswers();
    say(text);
    waitThenAdvance(text, next, { autoClose: isAutoCloseLine(text) });
  }

  function showPlayerLine(text, next) {
    setSpeaker(_playerName, _playerImg, 'player');
    els.text.textContent = text;
    clearAnswers();
    say(text);
    waitThenAdvance(text, next, { autoClose: false });
  }

  function setSpeaker(name, imgSrc, who) {
    els.speaker.textContent = name;
    const isTransparentCharacter = who === 'character' && !!_charMeta.transparent;
    els.portraitFrame.classList.toggle('is-player', who === 'player');
    els.portraitFrame.classList.toggle('is-cutout', isTransparentCharacter);
    els.portraitFrame.classList.toggle('is-conversation-large',
      who === 'character' && _charMeta.conversationScale === 'large');
    els.portraitFrame.classList.toggle('is-full-body', who === 'character' && !!_charMeta.fullBody && !isTransparentCharacter);
    if (imgSrc) {
      els.portrait.src = imgSrc;
      els.portraitFrame.style.visibility = 'visible';
    } else {
      // No selfie taken — show the dialogue box alone rather than a broken image.
      els.portrait.removeAttribute('src');
      els.portraitFrame.style.visibility = 'hidden';
    }
    // Re-trigger the swap animation.
    els.portraitFrame.classList.remove('swap');
    void els.portraitFrame.offsetWidth;
    els.portraitFrame.classList.add('swap');
  }

  /* ── Questions ──────────────────────────────────────────────────── */

  function askQuestion(i) {
    if (i >= _script.questions.length) {
      showCharacterLine(_script.farewell, () => finish(true));
      return;
    }
    _qIndex = i;
    const q = _script.questions[i];

    setSpeaker(_speakerName, _charImg, 'character');
    els.text.textContent = q.text;
    say(q.text);

    // Answers appear right away so the question reads as a prompt.
    renderAnswers(q.answers);
    els.hint.style.display = 'none';
    _advance = null;
    clearTimeout(_timer);
  }

  function renderAnswers(answers) {
    clearAnswers();
    answers.forEach(ans => {
      const btn = document.createElement('button');
      btn.className = 'convo-answer';
      btn.textContent = ans.text;
      btn.addEventListener('click', () => chooseAnswer(btn, ans));
      els.answers.appendChild(btn);
    });
    els.answers.style.display = '';
  }

  function chooseAnswer(btn, ans) {
    if (els.answers.classList.contains('locked')) return;
    els.answers.classList.add('locked');
    btn.classList.add('chosen');
    Sfx.select();

    // Let the highlight register, then the player "says" their line.
    setTimeout(() => {
      showPlayerLine(ans.text, () => {
        showCharacterLine(ans.reply, () => askQuestion(_qIndex + 1));
      });
    }, 420);
  }

  function clearAnswers() {
    els.answers.innerHTML = '';
    els.answers.classList.remove('locked');
    els.answers.style.display = 'none';
  }

  /* ── Pacing ─────────────────────────────────────────────────────── */

  function waitThenAdvance(text, next, { autoClose = false } = {}) {
    clearTimeout(_timer);
    els.hint.style.display = 'none';
    _advance = next;

    if (autoClose) {
      _timer = setTimeout(advanceDialogueNow, autoCloseMs(text));
      return;
    }

    _timer = setTimeout(() => {
      if (_advance) els.hint.style.display = '';
    }, INDICATOR_DELAY_MS);
  }

  function advanceDialogueNow() {
    if (!_advance) return;
    const go = _advance;
    _advance = null;
    clearTimeout(_timer);
    els.hint.style.display = 'none';
    go();
  }

  function handleKeyAdvance(e) {
    if (!_open || (e.key !== ' ' && e.key !== 'Enter')) return;
    if (e.target.closest && e.target.closest('.convo-answer, #convo-close-btn')) return;
    e.preventDefault();
    advanceDialogueNow();
  }

  function isAutoCloseLine(text) {
    const words = countWords(text);
    return words > 0 && words <= 3 && text.trim().length <= 28;
  }

  function autoCloseMs(text) {
    const ms = Math.max(AUTO_REACTION_MIN_MS, countWords(text) * AUTO_REACTION_WORD_MS);
    return Math.min(AUTO_REACTION_MAX_MS, ms);
  }

  function countWords(text) {
    return (String(text).match(/[A-Za-z0-9']+/g) || []).length;
  }

  function say(text) {
    if (window.Profile && Profile.say) Profile.say(text);
  }

  function finish(completed = false) {
    if (!_open) return;   // no-op when nothing is open (e.g. on restart)
    clearTimeout(_timer);
    els.hint.style.display = 'none';
    _advance = null;
    _open    = false;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    Sfx.whoosh(true);
    els.overlay.classList.remove('active', 'intro-linger');
    clearAnswers();
    // Conversations are only ever opened from the family photo wall, so
    // that's always the right music to resume on close.
    if (MUSIC_ENABLED) Ambient.start('photoWall');
    const done = _onDone;
    _onDone = null;
    if (done) done(completed);
  }

  return { load, init, start, isOpen, close: finish };
})();
