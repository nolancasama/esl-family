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
    { speaker: 'あなた', text: '「ここはどこ？」' },
    { speaker: 'あなた', text: '「さっきまで、松原市のベッドで寝ていたのに……」' },
    { speaker: 'ナレーション', text: 'どこからか、不思議な声が聞こえる……' },
    { speaker: '不思議な声', text: '「こんにちは。」' },
    { speaker: '不思議な声', text: '「わかりますか？」', button: 'はい' },
    { speaker: '不思議な声', text: '「よかった。」' },
    { speaker: '不思議な声', text: '「あなたの名前を教えてください。」', input: true },
    { speaker: '不思議な声', name: true }, // 「ようこそ、○○。」— built from the entered name
    { speaker: '不思議な声', text: '「あなたは異世界へやって来ました。」' },
    { speaker: '不思議な声', text: '「もう元の世界へ戻ることはできません。」' },
    { speaker: '不思議な声', text: '「新しい人生を始めるために……」' },
    { speaker: '不思議な声', text: '「新しい家族を選んでください。」' },
  ];

  let els        = {};
  let onDone     = null;
  let stepIndex  = 0;
  let typing     = false;
  let typeTimer  = null;
  let playerName = '';
  let completeCurrent = () => {};

  const MAX_NAME_LENGTH = 16;

  // Kept private so the game never reveals which term caused a retry.
  const ENGLISH_BLOCKLIST = [
    'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cock', 'cunt',
    'pussy', 'sex', 'porn', 'nude', 'boob', 'penis', 'vagina', 'whore',
    'slut', 'rape', 'nigger', 'faggot', 'retard', 'idiot', 'stupid',
    'loser', 'moron', 'wtf'
  ];
  const JAPANESE_BLOCKLIST = [
    'くそ', 'うんこ', 'ちんこ', 'ちんちん', 'まんこ', 'おっぱい',
    'せっくす', 'えっち', 'ぽるの', 'ぬーど', 'ばか', 'あほ', 'しね',
    'ころす', 'きもい', 'ぶす', 'でぶ', 'やりまん', 'きちがい',
    'めくら', 'つんぼ', 'かたわ'
  ];
  const JAPANESE_KANJI_BLOCKLIST = ['死ね', '殺す', '馬鹿'];

  function init(elements) {
    els = elements;
    els.tapZone.addEventListener('click', handleTap);
    els.yesBtn.addEventListener('click', () => advance());
    els.nextBtn.addEventListener('click', submitName);
    els.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });
    els.nameInput.addEventListener('input', hideNameError);
    els.skipBtn.addEventListener('click', skip);
    document.addEventListener('keydown', handleKey);
  }

  function start(doneCallback) {
    onDone     = doneCallback;
    stepIndex  = 0;
    playerName = '';
    els.nameInput.value = '';
    hideNameError();
    showStep(0);
  }

  function showStep(i) {
    const step = STEPS[i];
    if (!step) { finish(); return; }

    els.yesBtn.style.display    = 'none';
    els.inputWrap.style.display = 'none';
    // The tap-to-advance hint only applies to plain lines, not button/input steps.
    els.hint.style.display = (step.button || step.input) ? 'none' : '';
    const line = step.name ? `「ようこそ、${playerName}。」` : step.text;
    const text = step.speaker ? `${step.speaker}：\n${line}` : line;

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
    const result = validateName(els.nameInput.value);
    els.nameInput.value = result.name;
    if (!result.valid) {
      showNameError();
      shakeNameInput();
      return;
    }
    hideNameError();
    playerName = result.name;
    advance();
  }

  function validateName(value) {
    // NFKC folds half-width/full-width characters into one form. Internal
    // whitespace is made consistent, then only this cleaned name is stored.
    const name = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!name || [...name].length > MAX_NAME_LENGTH) return { valid: false, name };
    if (isKeyboardMash(name)) return { valid: false, name };
    if (containsBlockedEnglish(name) || containsBlockedJapanese(name)) return { valid: false, name };
    return { valid: true, name };
  }

  function containsBlockedEnglish(name) {
    const leet = name.toLowerCase()
      .replace(/[@4]/g, 'a').replace(/[3]/g, 'e').replace(/[1!|]/g, 'i')
      .replace(/[0]/g, 'o').replace(/[$5]/g, 's').replace(/[7+]/g, 't')
      .replace(/[8]/g, 'b');
    const compact = leet.replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
    return ENGLISH_BLOCKLIST.some(term => compact.includes(term));
  }

  function containsBlockedJapanese(name) {
    const compact = toHiragana(name).replace(/[\s\p{P}\p{S}]/gu, '').replace(/(.)\1+/g, '$1');
    return JAPANESE_BLOCKLIST.some(term => compact.includes(term)) ||
      JAPANESE_KANJI_BLOCKLIST.some(term => name.includes(term));
  }

  function toHiragana(value) {
    return value.replace(/[\u30A1-\u30F6]/g, char =>
      String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  function isKeyboardMash(name) {
    const compact = name.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
    if (/^(.)\1{5,}$/u.test(compact)) return true;
    return /^(?:asdf|qwer|zxcv|hjkl|poiuy|lkjh|mnbv){2,}$/i.test(compact);
  }

  function showNameError() {
    if (!els.nameError) return;
    els.nameError.textContent = 'ごめんなさい。\nこの名前は使えません。\nちがう名前を入力してください。';
    els.nameError.classList.add('visible');
  }

  function hideNameError() {
    if (!els.nameError) return;
    els.nameError.textContent = '';
    els.nameError.classList.remove('visible');
  }

  function shakeNameInput() {
    els.nameInput.classList.remove('shake');
    void els.nameInput.offsetWidth;
    els.nameInput.classList.add('shake');
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
