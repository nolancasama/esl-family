/**
 * intro.js
 * Text-only isekai-style opening: typewriter dialogue, a yes/no beat,
 * and a name prompt, then hands off to the existing family-selection flow.
 */

const Intro = (() => {

  const TYPE_MS = 55; // ms per character

  // Each step: { text } for a line, plus one of:
  //   button: 'はい'  → shows a button; click advances
  //   input: true      → shows the name field; submit advances
  //   (none)            → waits for a tap anywhere to advance
  const STEPS = [
    { text: 'どこからか、不思議な声が聞こえる……' },
    { text: '「こんにちは。」' },
    { text: '「わかりますか？」', button: 'はい' },
    { text: '「よかった。」' },
    { text: '「あなたの名前を教えてください。」', input: true },
    { name: true }, // 「ようこそ、○○。」— built from the entered name
    { text: '「あなたは異世界へやって来ました。」' },
    { text: '「もう元の世界へ戻ることはできません。」' },
    { text: '「新しい人生を始めるために……」' },
    { text: '「新しい家族を選んでください。」' },
  ];

  let els        = {};
  let onDone     = null;
  let stepIndex  = 0;
  let typing     = false;
  let typeTimer  = null;
  let playerName = '';
  let completeCurrent = () => {};

  function init(elements) {
    els = elements;
    els.tapZone.addEventListener('click', handleTap);
    els.yesBtn.addEventListener('click', () => advance());
    els.nextBtn.addEventListener('click', submitName);
    els.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });
    els.skipBtn.addEventListener('click', skip);
    document.addEventListener('keydown', handleKey);
  }

  function start(doneCallback) {
    onDone     = doneCallback;
    stepIndex  = 0;
    playerName = '';
    els.nameInput.value = '';
    showStep(0);
  }

  function showStep(i) {
    const step = STEPS[i];
    if (!step) { finish(); return; }

    els.yesBtn.style.display    = 'none';
    els.inputWrap.style.display = 'none';
    // The tap-to-advance hint only applies to plain lines, not button/input steps.
    els.hint.style.display = (step.button || step.input) ? 'none' : '';

    const text = step.name ? `「ようこそ、${playerName}。」` : step.text;

    typeLine(text, () => {
      if (step.button)      { els.yesBtn.style.display = ''; }
      else if (step.input)  { els.inputWrap.style.display = ''; els.nameInput.focus(); }
      // otherwise: wait for a generic tap to advance
    });
  }

  function typeLine(text, onComplete) {
    clearInterval(typeTimer);
    typing = true;
    els.lineEl.classList.add('typing');
    els.lineEl.textContent = '';
    els.lineEl.classList.remove('fade-in');
    void els.lineEl.offsetWidth; // restart the fade animation
    els.lineEl.classList.add('fade-in');

    let i = 0;
    const finishTyping = () => {
      clearInterval(typeTimer);
      els.lineEl.textContent = text;
      els.lineEl.classList.remove('typing');
      typing = false;
      onComplete();
    };
    typeTimer = setInterval(() => {
      i++;
      els.lineEl.textContent = text.slice(0, i);
      if (i >= text.length) finishTyping();
    }, TYPE_MS);
    completeCurrent = finishTyping;
  }

  function handleTap(e) {
    if (e.target.closest('button, input')) return;
    tapOrKeyAction();
  }

  function handleKey() {
    if (document.activeElement === els.nameInput) return; // let normal typing happen
    tapOrKeyAction();
  }

  function tapOrKeyAction() {
    if (typing) { completeCurrent(); return; }
    const step = STEPS[stepIndex];
    if (!step.button && !step.input) advance();
  }

  function advance() {
    stepIndex++;
    showStep(stepIndex);
  }

  function submitName() {
    const name = els.nameInput.value.trim().slice(0, 20);
    if (!name) {
      els.nameInput.classList.remove('shake');
      void els.nameInput.offsetWidth;
      els.nameInput.classList.add('shake');
      return;
    }
    playerName = name;
    advance();
  }

  function skip() {
    clearInterval(typeTimer);
    finish();
  }

  function finish() {
    clearInterval(typeTimer);
    const name = playerName;
    if (onDone) onDone(name);
  }

  return { init, start };
})();
