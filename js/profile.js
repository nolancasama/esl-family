/**
 * profile.js
 * RPG-style character profile card shown when a portrait is tapped in the
 * choose phase: a two-column, single-screen layout — portrait on the left,
 * the プロフィール list on the right.
 */

const Profile = (() => {

  let _profiles  = {};
  let els        = {};
  let _onConfirm = null;
  let _onBack    = null;

  async function load() {
    try {
      const res = await fetch('assets/profiles.json');
      _profiles = await res.json();
    } catch (_) {
      _profiles = {};
    }
    return _profiles;
  }

  function init(elements) {
    els = elements;
    els.backBtn.addEventListener('click', () => {
      Sfx.whoosh(true);
      close();
      if (_onBack) _onBack();
    });
    els.chooseBtn.addEventListener('click', () => {
      Sfx.confirm();
      const done = _onConfirm;
      close();
      if (done) done();
    });
  }

  function open(char, portraitSrc, { onConfirm, onBack }) {
    _onConfirm = onConfirm;
    _onBack    = onBack;

    const data = _profiles[char.id];
    els.portrait.src = portraitSrc;
    els.portrait.alt = char.name;
    els.portrait.classList.toggle('crop-chest', !!char.fullBody);

    // プロフィール — compact rows: bold Japanese label + English sentence.
    els.fields.innerHTML = '';
    ((data && data.fields) || []).forEach(([label, sentence]) => {
      const row = document.createElement('p');
      row.className = 'profile-field';
      const strong = document.createElement('strong');
      strong.textContent = label + '：';
      row.appendChild(strong);
      row.appendChild(document.createTextNode(' ' + sentence));
      els.fields.appendChild(row);
    });

    els.overlay.classList.add('active');
    Sfx.whoosh();
  }

  let _voice = null;
  function pickVoice() {
    if (_voice) return _voice;
    const voices = window.speechSynthesis.getVoices() || [];
    _voice = voices.find(v => /^en[-_]US/i.test(v.lang))
          || voices.find(v => /^en/i.test(v.lang))
          || null;
    return _voice;
  }

  function close() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
    els.overlay.classList.remove('active');
  }

  // Speak a one-off line (used for the target grammar sentence on confirm).
  function say(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      const voice = pickVoice();
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  // The character's personal name (e.g. "David"), for use outside the card.
  function displayName(charId) {
    const d = _profiles[charId];
    return d ? d.name : '';
  }

  function displayNameWithReading(charId) {
    const name = displayName(charId);
    const reading = nameReading(charId);
    return reading ? `${name}（${reading}）` : name;
  }

  function nameReading(charId) {
    const d = _profiles[charId];
    if (!d) return '';
    const fields = d.fields || [];
    const nameField = fields.find(([label]) => label === '名前');
    const sentence = nameField && nameField[1];
    const match = sentence && sentence.match(/（([^）]+)）/);
    return match ? match[1] : '';
  }

  return { load, init, open, close, say, displayName, displayNameWithReading };
})();


/* ── Small synthesized UI sound effects (no audio assets needed) ────── */
const Sfx = (() => {
  let _ctx = null;
  function ctx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_ctx) _ctx = new AC();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // Airy noise sweep — plays when the profile card slides in/out.
  function whoosh(reverse) {
    const ac = ctx();
    if (!ac) return;
    try {
      const dur = 0.32;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / d.length;
        const env = Math.sin(Math.PI * t);        // fade in and back out
        d[i] = (Math.random() * 2 - 1) * env * 0.5;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(reverse ? 1600 : 500, ac.currentTime);
      filter.frequency.exponentialRampToValueAtTime(reverse ? 500 : 1600, ac.currentTime + dur);
      filter.Q.value = 1.2;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.22, ac.currentTime);
      src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
      src.start();
    } catch (_) {}
  }

  // Soft single blip — plays when a portrait is tapped in the gallery.
  function select() {
    const ac = ctx();
    if (!ac) return;
    try {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ac.currentTime + 0.09);
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.2);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.22);
    } catch (_) {}
  }

  // Bright two-note chime — plays when a character is confirmed.
  function confirm() {
    const ac = ctx();
    if (!ac) return;
    try {
      [[784, 0], [1175, 0.12]].forEach(([freq, delay]) => {
        const osc  = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
        gain.gain.setValueAtTime(0.0001, ac.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + 0.32);
        osc.connect(gain); gain.connect(ac.destination);
        osc.start(ac.currentTime + delay);
        osc.stop(ac.currentTime + delay + 0.34);
      });
    } catch (_) {}
  }

  return { whoosh, select, confirm };
})();
