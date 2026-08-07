/**
 * ambient.js
 * Synthesized background music — no audio files, just layered Web Audio
 * oscillators. One engine, many presets: each scene gets a chord
 * progression, tempo, and timbre tuned to its mood, keyed by name.
 */

const Ambient = (() => {

  const C4 = 261.6256;
  function freq(semitonesFromC4) { return C4 * Math.pow(2, semitonesFromC4 / 12); }

  const INTERVALS = {
    maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
    maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
    sus2: [0, 2, 7], sus4: [0, 5, 7], power: [0, 7, 12],
  };
  function ch(root, quality) { return INTERVALS[quality].map(iv => freq(root + iv)); }

  // Each preset: a chord progression + the tempo/timbre/texture that gives
  // the scene its own character. arpeggio staggers notes into a roll
  // instead of a bloom; pulse adds a soft mechanical tick; sparkle adds
  // occasional high twinkle notes.
  const PRESETS = {
    // The original reflection-scene theme, unchanged — a warm, hand-voiced
    // I-V-vi-IV in C.
    reflection: {
      chords: [
        [261.63, 329.63, 392.00],
        [196.00, 293.66, 392.00],
        [220.00, 261.63, 329.63],
        [174.61, 261.63, 349.23],
      ],
      chordMs: 4200, wave: 'sine', filterHz: 1800, vol: 0.10, swellMs: 1400,
      delayTime: 0.42, feedback: 0.28,
    },
    intro: {
      chords: [ch(-3, 'min'), ch(-8, 'maj7'), ch(0, 'sus2'), ch(-1, 'dim')],
      chordMs: 6000, wave: 'sine', filterHz: 900, vol: 0.07, swellMs: 2500,
      delayTime: 0.6, feedback: 0.35,
    },
    choose: {
      // Pachelbel's Canon's own ground bass: I-V-vi-iii-IV-I-IV-V, on loop.
      chords: [
        [261.63, 329.63, 392.00],  // C   (I)
        [196.00, 293.66, 392.00],  // G   (V)
        [220.00, 261.63, 329.63],  // Am  (vi)
        [164.81, 196.00, 246.94],  // Em  (iii)
        [174.61, 220.00, 261.63],  // F   (IV)
        [261.63, 329.63, 392.00],  // C   (I)
        [174.61, 220.00, 261.63],  // F   (IV)
        [196.00, 293.66, 392.00],  // G   (V)
      ],
      // Brassy fanfare stab: sawtooth (closest a synth oscillator gets to a
      // trumpet's harmonics), near-instant attack, and a tight simultaneous
      // hit (small stagger) instead of a rolled arpeggio, for punch. melody
      // adds a repeating violin-like figure on top (the canon's other
      // voice), and the longer delay echoes it back a beat later — a cheap
      // stand-in for a second voice actually imitating the first.
      chordMs: 1900, wave: 'sawtooth', filterHz: 2400, vol: 0.11, swellMs: 60,
      delayTime: 0.95, feedback: 0.22, stagger: 0.025,
      bass: true, bassFromCycle: 1, melody: true, melodyFromCycle: 2,
    },
    photoWall: {
      chords: [ch(-8, 'maj'), ch(0, 'maj'), ch(-10, 'min'), ch(-2, 'maj')],
      chordMs: 4400, wave: 'sine', filterHz: 1900, vol: 0.09, swellMs: 1600,
      delayTime: 0.45, feedback: 0.3,
    },
    feast: {
      chords: [ch(0, 'maj'), ch(-8, 'maj'), ch(-5, 'dom7'), ch(0, 'maj')],
      chordMs: 3400, wave: 'triangle', filterHz: 2400, vol: 0.10, swellMs: 900,
      delayTime: 0.3, feedback: 0.22, arpeggio: true,
    },
    library: {
      chords: [ch(0, 'maj7'), ch(-3, 'min7'), ch(-8, 'maj7'), ch(-5, 'sus4')],
      chordMs: 5200, wave: 'sine', filterHz: 1500, vol: 0.06, swellMs: 2000,
      delayTime: 0.5, feedback: 0.3, arpeggio: true,
    },
    workshop: {
      chords: [ch(-3, 'min'), ch(-8, 'maj'), ch(-10, 'min7'), ch(-5, 'sus4')],
      chordMs: 4000, wave: 'triangle', filterHz: 1600, vol: 0.08, swellMs: 1300,
      delayTime: 0.3, feedback: 0.2, pulse: true,
    },
    workshopMissile: {
      chords: [ch(0, 'maj'), ch(-3, 'min'), ch(-8, 'maj'), ch(-5, 'sus4')],
      chordMs: 3600, wave: 'triangle', filterHz: 1900, vol: 0.08, swellMs: 1000,
      delayTime: 0.3, feedback: 0.22, pulse: true,
    },
    market: {
      chords: [ch(0, 'maj'), ch(-5, 'maj'), ch(-8, 'maj'), ch(-5, 'maj')],
      chordMs: 2800, wave: 'triangle', filterHz: 2600, vol: 0.09, swellMs: 700,
      delayTime: 0.25, feedback: 0.18, arpeggio: true,
    },
    gardenParty: {
      chords: [ch(0, 'maj'), ch(-3, 'min'), ch(-8, 'maj7'), ch(-5, 'maj')],
      chordMs: 4600, wave: 'sine', filterHz: 2000, vol: 0.08, swellMs: 1500,
      delayTime: 0.4, feedback: 0.28, arpeggio: true,
    },
    observatory: {
      chords: [ch(0, 'maj7'), ch(-5, 'sus2'), ch(-10, 'maj7'), ch(-3, 'sus2')],
      chordMs: 6000, wave: 'sine', filterHz: 2600, vol: 0.06, swellMs: 2600,
      delayTime: 0.65, feedback: 0.35, sparkle: true,
    },
    cottage: {
      chords: [ch(0, 'maj'), ch(-8, 'maj'), ch(-3, 'min'), ch(-5, 'maj')],
      chordMs: 5000, wave: 'sine', filterHz: 1400, vol: 0.07, swellMs: 2000,
      delayTime: 0.4, feedback: 0.25,
    },
    study: {
      chords: [ch(0, 'maj7'), ch(-8, 'maj7'), ch(-3, 'min7'), ch(-5, 'maj7')],
      chordMs: 5400, wave: 'sine', filterHz: 1700, vol: 0.07, swellMs: 2200,
      delayTime: 0.45, feedback: 0.28,
    },
    tavern: {
      chords: [ch(0, 'maj'), ch(-5, 'maj'), ch(-3, 'min'), ch(-5, 'dom7')],
      chordMs: 2600, wave: 'triangle', filterHz: 2800, vol: 0.10, swellMs: 600,
      delayTime: 0.22, feedback: 0.16, arpeggio: true,
    },
    alchemy: {
      chords: [ch(-3, 'min'), ch(0, 'aug'), ch(-10, 'min7'), ch(-1, 'dim')],
      chordMs: 4800, wave: 'sine', filterHz: 2100, vol: 0.07, swellMs: 1800,
      delayTime: 0.55, feedback: 0.32, arpeggio: true, sparkle: true,
    },
    bakery: {
      chords: [ch(12, 'maj'), ch(7, 'maj'), ch(9, 'min'), ch(5, 'maj')],
      chordMs: 3200, wave: 'triangle', filterHz: 2500, vol: 0.08, swellMs: 800,
      delayTime: 0.25, feedback: 0.18, arpeggio: true, sparkle: true,
    },
    yard: {
      chords: [ch(0, 'power'), ch(-5, 'power'), ch(-3, 'power'), ch(-8, 'power')],
      chordMs: 3000, wave: 'triangle', filterHz: 2300, vol: 0.09, swellMs: 700,
      delayTime: 0.25, feedback: 0.2, pulse: true,
    },
    roseGarden: {
      chords: [ch(0, 'sus2'), ch(-3, 'min'), ch(-8, 'maj'), ch(-5, 'sus2')],
      chordMs: 5200, wave: 'sine', filterHz: 1600, vol: 0.06, swellMs: 2200,
      delayTime: 0.5, feedback: 0.3,
    },
    stable: {
      chords: [ch(0, 'maj'), ch(-8, 'maj'), ch(-5, 'maj'), ch(0, 'maj')],
      chordMs: 2400, wave: 'triangle', filterHz: 2700, vol: 0.08, swellMs: 400,
      delayTime: 0.2, feedback: 0.15, arpeggio: true,
    },
  };

  let _ctx     = null;
  let _master  = null;
  let _timer   = null;
  let _pulseTimer   = null;
  let _sparkleTimer = null;
  let _step    = 0;
  let _preset  = null;

  // Browsers start a new AudioContext suspended until a real user gesture
  // happens — starting music on page load (e.g. the intro phase) means it
  // stays silent until the player's first tap. Listen once, globally, and
  // resume whatever context is current when that gesture arrives.
  let _resumeListenerAdded = false;
  function ensureResumeOnGesture() {
    if (_resumeListenerAdded) return;
    _resumeListenerAdded = true;
    const resume = () => { if (_ctx && _ctx.state === 'suspended') _ctx.resume(); };
    ['pointerdown', 'touchstart', 'keydown'].forEach(evt => {
      document.addEventListener(evt, resume, { passive: true });
    });
  }

  function start(presetKey) {
    stop();
    const preset = PRESETS[presetKey] || PRESETS.choose;
    _preset = preset;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ensureResumeOnGesture();
    try {
      _ctx = new AC();
      if (_ctx.state === 'suspended') _ctx.resume();

      _master = _ctx.createGain();
      _master.gain.setValueAtTime(0.0001, _ctx.currentTime);
      _master.gain.exponentialRampToValueAtTime(preset.vol, _ctx.currentTime + 3);

      // Soft echo, for a little air around the chords.
      const delay = _ctx.createDelay(1.2);
      delay.delayTime.value = preset.delayTime;
      const feedback = _ctx.createGain();
      feedback.gain.value = preset.feedback;
      const tone = _ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = preset.filterHz;

      _master.connect(tone);
      tone.connect(_ctx.destination);
      tone.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(_ctx.destination);

      _step = 0;
      playChord();
      _timer = setInterval(playChord, preset.chordMs);
      if (preset.pulse)   startPulse();
      if (preset.sparkle) startSparkle();
    } catch (_) { _ctx = null; }
  }

  function playChord() {
    if (!_ctx || !_master || !_preset) return;
    const now = _ctx.currentTime;
    const preset = _preset;
    const chord = preset.chords[_step % preset.chords.length];
    const cycle = Math.floor(_step / preset.chords.length);
    _step++;

    const stagger = preset.stagger ?? (preset.arpeggio ? 0.28 : 0.12);
    const holdMs = preset.chordMs / 1000;
    chord.forEach((f, i) => {
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = preset.wave;
      osc.frequency.value = f;
      const t0 = now + i * stagger;
      const swell = preset.arpeggio ? Math.min(preset.swellMs, 350) / 1000 : preset.swellMs / 1000;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + swell);
      gain.gain.linearRampToValueAtTime(0.0001, t0 + holdMs);
      osc.connect(gain);
      gain.connect(_master);
      osc.start(t0);
      osc.stop(t0 + holdMs + 0.2);
    });

    // An optional punchy bass thump under the chord's downbeat — one
    // octave below the lowest voice, short and percussive, so the
    // progression feels like a full small band instead of just chords.
    if (preset.bass && cycle >= (preset.bassFromCycle ?? 0)) {
      const bassFreq = chord[0] / 2;
      const bosc  = _ctx.createOscillator();
      const bgain = _ctx.createGain();
      bosc.type = 'triangle';
      bosc.frequency.value = bassFreq;
      const bassHold = Math.min(holdMs * 0.55, 0.85);
      bgain.gain.setValueAtTime(0.0001, now);
      bgain.gain.linearRampToValueAtTime(0.2, now + 0.025);
      bgain.gain.exponentialRampToValueAtTime(0.0001, now + bassHold);
      bosc.connect(bgain);
      bgain.connect(_master);
      bosc.start(now);
      bosc.stop(now + bassHold + 0.1);
    }

    // An optional repeating eighth-note-style figure through the chord's
    // own tones, one octave up on a softer voice — the canon's "other
    // voice" running continuously over the ground bass, Pachelbel-style.
    if (preset.melody && cycle >= (preset.melodyFromCycle ?? 0)) {
      const pattern = [0, 1, 2, 1];
      const noteMs = holdMs / pattern.length;
      pattern.forEach((idx, i) => {
        const f = chord[idx % chord.length] * 2;
        const t0 = now + i * noteMs;
        const osc  = _ctx.createOscillator();
        const gain = _ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.1, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteMs * 0.92);
        osc.connect(gain);
        gain.connect(_master);
        osc.start(t0);
        osc.stop(t0 + noteMs + 0.05);
      });
    }
  }

  // A soft, quiet mechanical tick — for workshop-flavored scenes.
  function startPulse() {
    const tick = () => {
      if (!_ctx || !_master) return;
      const now = _ctx.currentTime;
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(_master);
      osc.start(now);
      osc.stop(now + 0.12);
    };
    tick();
    _pulseTimer = setInterval(tick, 820);
  }

  // An occasional high, soft twinkle — for magical/starry scenes.
  function startSparkle() {
    const twinkle = () => {
      if (!_ctx || !_master) return;
      const now = _ctx.currentTime;
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq(12 + [0, 4, 7, 11, 12][Math.floor(Math.random() * 5)]);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      osc.connect(gain);
      gain.connect(_master);
      osc.start(now);
      osc.stop(now + 1.6);
      _sparkleTimer = setTimeout(twinkle, 2500 + Math.random() * 2500);
    };
    _sparkleTimer = setTimeout(twinkle, 1500);
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
    clearInterval(_pulseTimer);
    clearTimeout(_sparkleTimer);
    _timer = _pulseTimer = _sparkleTimer = null;
    setTimeout(stop, ms + 200);
  }

  function stop() {
    clearInterval(_timer);
    clearInterval(_pulseTimer);
    clearTimeout(_sparkleTimer);
    _timer = _pulseTimer = _sparkleTimer = null;
    if (_ctx) { try { _ctx.close(); } catch (_) {} }
    _ctx = null;
    _master = null;
    _preset = null;
  }

  return { start, fadeOut, stop };
})();
