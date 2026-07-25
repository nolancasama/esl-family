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

  let _charImgEl   = null;
  let _roleLabelEl = null;
  let _charNameEl  = null;
  let _progressEl  = null;
  let _frameEl     = null;

  function init(els) {
    _charImgEl   = els.charImg;
    _roleLabelEl = els.roleLabel;
    _charNameEl  = els.charName;
    _progressEl  = els.progress;
    _frameEl     = els.frame;
  }

  // assignments: Map of role → { char, audioBlob, transcript }
  function start(assignments, onDone) {
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
      if (_onDone) _onDone();
      return;
    }

    const role = orderedRoles[_index];
    const { char, audioBlob } = _assignments[role];

    // Update UI
    _charImgEl.src = Characters.imgUrl(char);
    _charImgEl.alt = char.name;
    _roleLabelEl.textContent = 'This is my ' + role + '.';
    _charNameEl.textContent  = char.name;
    _progressEl.textContent  = `${_index + 1} / ${orderedRoles.length}`;

    // Pop-in animation
    _frameEl.classList.remove('pop');
    void _frameEl.offsetWidth;
    _frameEl.classList.add('pop');

    // Play audio if we have it
    if (audioBlob && audioBlob.size > 0) {
      const url    = URL.createObjectURL(audioBlob);
      const audio  = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        // Pause briefly between members
        setTimeout(() => { _index++; _showNext(); }, 900);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setTimeout(() => { _index++; _showNext(); }, 1200);
      };
      // Small delay before playing so the animation settles
      setTimeout(() => audio.play().catch(() => {
        setTimeout(() => { _index++; _showNext(); }, 1200);
      }), 500);
    } else {
      // No audio — show for 2 seconds then advance
      setTimeout(() => { _index++; _showNext(); }, 2000);
    }
  }

  return { init, start };
})();
