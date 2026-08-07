/**
 * reflection.js
 * The game's quiet epilogue, unlocked once the player has talked with every
 * family member. The player sits in their castle bedroom, thinks back over
 * the day, picks how they feel, and the story closes.
 *
 * Background music is Ambient (js/ambient.js), started with the
 * 'reflection' preset.
 */

const Reflection = (() => {

  const INDICATOR_DELAY_MS = 500;

  const MONOLOGUE = [
    { text: 'I had a wonderful day.', ja: 'すてきな一日だった。' },
    { text: 'I met my new family.', ja: '新しい家族に会った。' },
    { text: 'Everyone was so kind.', ja: 'みんなとてもやさしかった。' },
    { text: 'How do I feel?', ja: 'どんな気持ち？' },
  ];

  const CHOICES = [
    { text: "I'm happy." },
    { text: "I'm excited." },
    { text: 'I like my new family.' },
    { text: "I can't wait to explore tomorrow." },
  ];

  let els        = {};
  let _playerImg = '';
  let _advance   = null;
  let _timer     = null;
  let _open      = false;
  let _onReplay  = null;

  function init(elements, onReplay) {
    els = elements;
    _onReplay = onReplay;
    els.overlay.addEventListener('click', (e) => {
      if (e.target.closest('.reflect-choice, #reflect-replay-btn')) return;
      advanceDialogueNow();
    });
    els.replayBtn.addEventListener('click', () => {
      Ambient.stop();
      els.overlay.classList.remove('active');
      els.end.classList.remove('visible');
      _open = false;
      if (_onReplay) _onReplay();
    });
  }

  function isOpen() { return _open; }

  function start(playerImg, playerName) {
    _playerImg = playerImg || '';
    _open = true;

    els.end.classList.remove('visible');
    els.replayBtn.classList.remove('visible');
    els.box.classList.remove('hidden');
    els.speaker.textContent = playerName || 'Me';
    clearChoices();

    if (_playerImg) {
      els.portrait.src = _playerImg;
      els.portraitWrap.style.display = '';
    } else {
      els.portraitWrap.style.display = 'none';
    }

    els.overlay.classList.add('active');
    Ambient.start('reflection');

    step(0);
  }

  // Walk the monologue, then offer the four feelings.
  function step(i) {
    if (i >= MONOLOGUE.length) { showChoices(); return; }
    const line = MONOLOGUE[i];
    const text = renderReflectionText(line);
    say(text);
    waitForTap(() => step(i + 1));
  }

  function renderReflectionText(line) {
    const text = typeof line === 'string' ? line : line.text;
    els.text.innerHTML = '';

    const english = document.createElement('div');
    english.className = 'reflect-en';
    english.textContent = text;
    els.text.appendChild(english);

    if (line.ja) {
      const japanese = document.createElement('div');
      japanese.className = 'reflect-ja';
      japanese.textContent = line.ja;
      els.text.appendChild(japanese);
    }

    return text;
  }

  function showChoices() {
    els.hint.style.display = 'none';
    _advance = null;
    clearTimeout(_timer);
    els.choices.innerHTML = '';
    CHOICES.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'reflect-choice';
      btn.textContent = c.text;
      btn.addEventListener('click', () => choose(c));
      els.choices.appendChild(btn);
    });
    els.choices.style.display = '';
  }

  function choose(c) {
    if (els.choices.classList.contains('locked')) return;
    els.choices.classList.add('locked');
    Sfx.confirm();

    // Show only the chosen thought, hold on it, then close the story out.
    setTimeout(() => {
      clearChoices();
      els.text.textContent = c.text;
      say(c.text);
      waitForTap(fadeToEnd);
    }, 380);
  }

  function waitForTap(next) {
    clearTimeout(_timer);
    els.hint.style.display = 'none';
    _advance = next;
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

  function fadeToEnd() {
    els.box.classList.add('hidden');
    els.overlay.classList.add('ending');   // fades the scene to black
    Ambient.fadeOut(2600);

    setTimeout(() => {
      els.end.classList.add('visible');
      // Offer a way onward only after the title has had a moment to land.
      setTimeout(() => els.replayBtn.classList.add('visible'), 2600);
    }, 1100);
  }

  function clearChoices() {
    els.choices.innerHTML = '';
    els.choices.classList.remove('locked');
    els.choices.style.display = 'none';
  }

  function say(text) {
    if (window.Profile && Profile.say) Profile.say(text);
  }

  function close() {
    if (!_open) return;
    clearTimeout(_timer);
    els.hint.style.display = 'none';
    _advance = null;
    _open = false;
    Ambient.stop();
    try { window.speechSynthesis.cancel(); } catch (_) {}
    els.overlay.classList.remove('active', 'ending');
    els.end.classList.remove('visible');
    els.replayBtn.classList.remove('visible');
    clearChoices();
  }

  return { init, start, isOpen, close };
})();
