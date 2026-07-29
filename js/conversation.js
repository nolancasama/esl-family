/**
 * conversation.js
 * Short interactive conversation with a family member, opened by tapping
 * their portrait on the final family photo screen. JRPG/visual-novel
 * presentation: fantasy backdrop, large portrait overlapping a bottom
 * dialogue box, and multiple-choice answer buttons.
 *
 * Flow per question:
 *   family member asks → player picks an answer → player's selfie and
 *   chosen sentence appear briefly → family member reacts → next question.
 */

const Conversation = (() => {

  const PLAYER_LINE_MS = 1900;  // how long the player's own line stays up

  let _data   = {};
  let els     = {};
  let _onDone = null;

  // Current run
  let _role       = '';
  let _script     = null;
  let _charImg    = '';
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
    els.box.addEventListener('click', (e) => {
      if (e.target.closest('.convo-answer')) return;  // answer buttons handle themselves
      if (_advance) { const go = _advance; _advance = null; clearTimeout(_timer); go(); }
    });
    els.closeBtn.addEventListener('click', () => finish());
  }

  function isOpen() { return _open; }

  /**
   * @param role        family role key ('mother', 'father', …)
   * @param speakerName display name for that character
   * @param charImgSrc  the character's portrait
   * @param playerImg   the player's selfie (may be null)
   * @param playerName  the player's entered name
   * @param onDone      called after the scene fades out
   */
  function start(role, speakerName, charImgSrc, playerImg, playerName, onDone) {
    _script = _data[role];
    if (!_script) { if (onDone) onDone(); return; }

    _role        = role;
    _speakerName = speakerName;
    _charImg     = charImgSrc;
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
    waitThenAdvance(text, next);
  }

  function showPlayerLine(text, next) {
    setSpeaker(_playerName, _playerImg, 'player');
    els.text.textContent = text;
    clearAnswers();
    say(text);
    // The player's own line is a brief beat, not something to tap through.
    els.hint.style.display = 'none';
    _advance = null;
    clearTimeout(_timer);
    _timer = setTimeout(next, PLAYER_LINE_MS);
  }

  function setSpeaker(name, imgSrc, who) {
    els.speaker.textContent = name;
    els.portraitFrame.classList.toggle('is-player', who === 'player');
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

  // Character lines auto-advance after a beat sized to the sentence, but a
  // tap anywhere in the box skips ahead immediately.
  function waitThenAdvance(text, next) {
    els.hint.style.display = '';
    _advance = next;
    clearTimeout(_timer);
    const ms = Math.min(6000, Math.max(2200, text.length * 95));
    _timer = setTimeout(() => {
      if (_advance) { _advance = null; next(); }
    }, ms);
  }

  function say(text) {
    if (window.Profile && Profile.say) Profile.say(text);
  }

  function finish() {
    if (!_open) return;   // no-op when nothing is open (e.g. on restart)
    clearTimeout(_timer);
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
