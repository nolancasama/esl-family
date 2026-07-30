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
    els.closeBtn.addEventListener('click', () => finish());
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
   */
  function start(role, speakerName, charImgSrc, playerImg, playerName, onDone, charMeta = {}) {
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

    els.overlay.style.backgroundImage =
      `linear-gradient(rgba(8,10,22,.28), rgba(8,10,22,.45)), url('${_script.bg}')`;
    els.overlay.classList.add('active');
    Sfx.whoosh();

    // Greeting, then the first question.
    showCharacterLine(_script.greeting, () => askQuestion(0));
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
      showCharacterLine(_script.farewell, () => finish());
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

  function finish() {
    if (!_open) return;   // no-op when nothing is open (e.g. on restart)
    clearTimeout(_timer);
    els.hint.style.display = 'none';
    _advance = null;
    _open    = false;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    Sfx.whoosh(true);
    els.overlay.classList.remove('active');
    clearAnswers();
    const done = _onDone;
    _onDone = null;
    if (done) done();
  }

  return { load, init, start, isOpen, close: finish };
})();
