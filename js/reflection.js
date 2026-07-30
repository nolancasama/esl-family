/**
 * reflection.js
 * The game's quiet epilogue, unlocked once the player has talked with every
 * family member. The player sits in their castle bedroom, thinks back over
 * the day, picks how they feel, and the story closes.
 *
 * Also owns Ambient — a small synthesized music bed (no audio assets), so
 * the scene has something calm playing under it.
 */

const Reflection = (() => {

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
    els.box.addEventListener('click', (e) => {
      if (e.target.closest('.reflect-choice')) return;
      if (_advance) { const go = _advance; _advance = null; clearTimeout(_timer); go(); }
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
    Ambient.start();

    step(0);
  }

  // Walk the monologue, then offer the four feelings.
  function step(i) {
    if (i >= MONOLOGUE.length) { showChoices(); return; }
    const line = MONOLOGUE[i];
    const text = renderReflectionText(line);
    say(text);
    els.hint.style.display = '';
    _advance = () => step(i + 1);
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      if (_advance) { _advance = null; step(i + 1); }
    }, Math.max(2400, text.length * 95));
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
      _timer = setTimeout(fadeToEnd, 2000);
    }, 380);
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


/* ── Ambient music bed ──────────────────────────────────────────────
   A slow I–V–vi–IV progression on soft sine voices with a long attack
   and release, plus a gentle delay. Entirely synthesized, so the scene
   gets calm background music without shipping an audio file.           */
const Ambient = (() => {

  // I–V–vi–IV in C, voiced low and wide so it stays out of the way.
  const CHORDS = [
    [261.63, 329.63, 392.00],  // C  major
    [196.00, 293.66, 392.00],  // G  major
    [220.00, 261.63, 329.63],  // A  minor
    [174.61, 261.63, 349.23],  // F  major
  ];
  const CHORD_MS = 4200;

  let _ctx    = null;
  let _master = null;
  let _timer  = null;
  let _step   = 0;

  function start() {
    stop();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      _ctx = new AC();
      if (_ctx.state === 'suspended') _ctx.resume();

      _master = _ctx.createGain();
      _master.gain.setValueAtTime(0.0001, _ctx.currentTime);
      _master.gain.exponentialRampToValueAtTime(0.10, _ctx.currentTime + 3);

      // Soft echo, for a little air around the chords.
      const delay = _ctx.createDelay(1.0);
      delay.delayTime.value = 0.42;
      const feedback = _ctx.createGain();
      feedback.gain.value = 0.28;
      const tone = _ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1800;

      _master.connect(tone);
      tone.connect(_ctx.destination);
      tone.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(_ctx.destination);

      _step = 0;
      playChord();
      _timer = setInterval(playChord, CHORD_MS);
    } catch (_) { _ctx = null; }
  }

  function playChord() {
    if (!_ctx || !_master) return;
    const now = _ctx.currentTime;
    const chord = CHORDS[_step % CHORDS.length];
    _step++;

    chord.forEach((freq, i) => {
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Stagger the voices slightly so the chord blooms instead of stabbing.
      const t0 = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 1.4);          // slow swell
      gain.gain.linearRampToValueAtTime(0.0001, t0 + CHORD_MS / 1000);
      osc.connect(gain);
      gain.connect(_master);
      osc.start(t0);
      osc.stop(t0 + CHORD_MS / 1000 + 0.2);
    });
  }

  function fadeOut(ms) {
    if (!_ctx || !_master) return;
    try {
      const now = _ctx.currentTime;
      _master.gain.cancelScheduledValues(now);
      _master.gain.setValueAtTime(_master.gain.value, now);
      _master.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
    } catch (_) {}
    clearInterval(_timer);
    _timer = null;
    setTimeout(stop, ms + 200);
  }

  function stop() {
    clearInterval(_timer);
    _timer = null;
    if (_ctx) { try { _ctx.close(); } catch (_) {} }
    _ctx = null;
    _master = null;
  }

  return { start, fadeOut, stop };
})();
