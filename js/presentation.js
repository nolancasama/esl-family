/**
 * presentation.js
 * Auto-replay phase: shows each family member one at a time,
 * plays the student's recorded audio, then advances.
 */

const Presentation = (() => {

  const ROLE_ORDER = ['mother', 'father', 'brother', 'sister', 'grandfather', 'grandmother'];

  let _assignments = {};  // { role: { char, audioBlob, transcript } }
  let _index       = 0;
  let _onDone      = null;
  let _timer       = null;
  let _audio       = null;
  let _audioUrl    = '';

  let _charImgEl   = null;
  let _progressEl  = null;
  let _frameEl     = null;

  function init(els) {
    _charImgEl   = els.charImg;
    _progressEl  = els.progress;
    _frameEl     = els.frame;
  }

  // assignments: Map of role → { char, audioBlob, transcript }
  function start(assignments, onDone) {
    _clearPlayback();
    _assignments = assignments;
    _onDone      = onDone;
    _index       = 0;

    // Build ordered list of roles that were actually assigned
    _showNext();
  }

  function _showNext() {
    // Find the next assigned role in ROLE_ORDER
    const orderedRoles = ROLE_ORDER.filter(r => _assignments[r]);

    if (_index >= orderedRoles.length) {
      _clearPlayback();
      _finish();
      return;
    }

    const role = orderedRoles[_index];
    const { char, audioBlob, skipped } = _assignments[role];

    // Update UI
    _charImgEl.src = Characters.imgUrl(char);
    _charImgEl.alt = char.name;
    _progressEl.textContent = `${_index + 1} / ${orderedRoles.length}`;

    // Pop-in animation
    _frameEl.classList.remove('pop');
    void _frameEl.offsetWidth;
    _frameEl.classList.add('pop');

    if (skipped) {
      _queueNext(250);
      return;
    }

    // Play audio if we have it
    if (audioBlob && audioBlob.size > 0) {
      _audioUrl = URL.createObjectURL(audioBlob);
      _audio    = new Audio(_audioUrl);
      _audio.onended = () => {
        _clearPlayback();
        _queueNext(900);
      };
      _audio.onerror = () => {
        _clearPlayback();
        _queueNext(1200);
      };
      // Small delay before playing so the animation settles
      _timer = setTimeout(() => {
        _timer = null;
        _audio.play().catch(() => {
          _clearPlayback();
          _queueNext(1200);
        });
      }, 500);
    } else {
      // No audio — show for 2 seconds then advance
      _queueNext(2000);
    }
  }

  function _queueNext(delay) {
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      _timer = null;
      _index++;
      _showNext();
    }, delay);
  }

  function _clearPlayback() {
    clearTimeout(_timer);
    _timer = null;
    if (_audio) {
      try {
        _audio.pause();
        _audio.src = '';
        _audio.load();
      } catch (_) {}
      _audio = null;
    }
    if (_audioUrl) {
      URL.revokeObjectURL(_audioUrl);
      _audioUrl = '';
    }
  }

  function skip() {
    _clearPlayback();
    _finish();
  }

  function _finish() {
    const done = _onDone;
    _onDone = null;
    if (done) done();
  }

  return { init, start, skip };
})();
