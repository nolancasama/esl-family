/**
 * speech.js
 * Wraps the Web Speech API (SpeechRecognition).
 * Exposes start/stop and emits results via callbacks.
 */

const Speech = (() => {

  const ALL_ROLES = ['mother', 'father', 'brother', 'sister', 'grandfather', 'grandmother'];

  const ROLE_GENDER = {
    mother:      'female',
    father:      'male',
    brother:     'male',
    sister:      'female',
    grandfather: 'male',
    grandmother: 'female',
  };

  // Synonyms and common mis-recognitions for each role
  const ROLE_PATTERNS = {
    mother:      /\b(mother|mom|mum|mama)\b/i,
    father:      /\b(father|dad|papa|daddy)\b/i,
    brother:     /\b(brother|bro)\b/i,
    sister:      /\b(sister|sis)\b/i,
    grandfather: /\b(grandfather|grandpa|grandad|granddad|grand father)\b/i,
    grandmother: /\b(grandmother|grandma|granny|grand mother)\b/i,
  };

  let recognition   = null;
  let _onResult     = null;   // callback({role, transcript, confidence, roleHint})
  let _onError      = null;   // callback(errorMessage)
  let _onSpeechStart= null;   // callback() — fired when speech is first detected
  let _active       = false;

  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function init() {
    if (!isSupported()) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onspeechstart = () => {
      if (_onSpeechStart) _onSpeechStart();
    };

    recognition.onresult = (event) => {
      const results = Array.from(event.results[0]);
      let bestRole        = null;
      let bestRoleHint    = null;   // role heard but sentence structure missing
      let bestGenderMiss  = null;   // role heard with structure but wrong pronoun
      let bestTranscript  = '';
      let bestConfidence  = 0;

      for (const alt of results) {
        const transcript = alt.transcript;
        const confidence = alt.confidence || 0.5;
        const t          = normalize(transcript);
        const anyRole    = detectRole(t);
        const hasStruct  = hasSentenceStructure(t);
        const agrees     = anyRole ? genderAgrees(t, anyRole) : true;
        const role       = hasStruct && anyRole && agrees ? anyRole : null;

        if (role && (confidence >= bestConfidence || !bestRole)) {
          bestRole       = role;
          bestTranscript = transcript;
          bestConfidence = confidence;
        }
        if (!bestRole) {
          if (hasStruct && anyRole && !agrees) bestGenderMiss = anyRole;
          else if (!hasStruct && anyRole)      bestRoleHint   = anyRole;
        }
        if (!bestTranscript) { bestTranscript = transcript; bestConfidence = confidence; }
      }

      if (bestRole) { bestRoleHint = null; bestGenderMiss = null; }

      _active = false;
      if (_onResult) _onResult({ role: bestRole, transcript: bestTranscript, confidence: bestConfidence, roleHint: bestRoleHint, genderMismatch: bestGenderMiss });
    };

    recognition.onerror = (event) => {
      _active = false;
      const msg = event.error === 'no-speech'
        ? "I didn't hear anything. Try again!"
        : event.error === 'not-allowed'
        ? "Microphone blocked. Please allow mic access."
        : "Sorry, I didn't catch that. Can you say that again?";
      if (_onError) _onError(msg);
    };

    recognition.onend = () => {
      if (_active) {
        // Recognition ended without firing onresult (e.g. silence timeout)
        _active = false;
        if (_onError) _onError("I didn't hear anything. Try again!");
      }
    };

    return true;
  }

  function normalize(transcript) {
    let t = transcript.toLowerCase();
    t = t.replace(/\bhe's\b/g, 'he is')
         .replace(/\bshe's\b/g, 'she is')
         .replace(/\bthat's\b/g, 'that is')
         .replace(/\bthis's\b/g, 'this is');
    return t.replace(/['']/g, "'").replace(/[^a-z ]/g, ' ');
  }

  function hasSentenceStructure(t) {
    return /\b(this|that|he|she|they|it)\b/.test(t)
        && /\bis\b/.test(t)
        && /\bmy\b/.test(t);
  }

  function detectRole(t) {
    for (const [role, pattern] of Object.entries(ROLE_PATTERNS)) {
      if (pattern.test(t)) return role;
    }
    return null;
  }

  // Returns false when a gendered pronoun (he/she) disagrees with the role's gender.
  // Neutral subjects (this, that, it, they) always agree.
  function genderAgrees(t, role) {
    const gender = ROLE_GENDER[role];
    if (!gender) return true;
    if (/\bhe\b/.test(t) && gender !== 'male')   return false;
    if (/\bshe\b/.test(t) && gender !== 'female') return false;
    return true;
  }

  // Full validation: sentence structure + gender agreement required.
  function parseRole(transcript) {
    const t = normalize(transcript);
    if (!hasSentenceStructure(t)) return null;
    const role = detectRole(t);
    if (!role || !genderAgrees(t, role)) return null;
    return role;
  }

  function start(onResult, onError, onSpeechStart) {
    if (!recognition && !init()) {
      if (onError) onError('Speech recognition is not supported in this browser. Please use Chrome.');
      return;
    }
    _onResult      = onResult;
    _onError       = onError;
    _onSpeechStart = onSpeechStart || null;
    _active        = true;
    try {
      recognition.start();
    } catch (e) {
      // If already running, abort and restart
      recognition.abort();
      setTimeout(() => {
        _active = true;
        recognition.start();
      }, 200);
    }
  }

  function stop() {
    _active = false;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
  }

  function abort() {
    _active = false;
    if (recognition) {
      try { recognition.abort(); } catch (_) {}
    }
  }

  return { isSupported, init, start, stop, abort, parseRole, ALL_ROLES, ROLE_GENDER };
})();
