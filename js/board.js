/**
 * board.js
 * Renders and updates the 6-slot family board shown during Phase ASSIGN.
 * Handles the "fly-in" animation when a character is assigned a role.
 */

const Board = (() => {

  const ROLES = ['grandfather', 'grandmother', 'father', 'mother', 'brother', 'sister'];

  let _container = null;   // the .board-grid element
  let _slots     = {};     // { role: slotEl }

  function init(containerEl) {
    _container = containerEl;
    _container.innerHTML = '';
    _slots = {};

    ROLES.forEach(role => {
      const slot = document.createElement('div');
      slot.className = 'board-slot';
      slot.dataset.role = role;

      const label = document.createElement('div');
      label.className = 'slot-role';
      label.textContent = capitalize(role);
      slot.appendChild(label);

      const placeholder = document.createElement('div');
      placeholder.className = 'slot-empty-icon';
      placeholder.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="4 3"/>
        <text x="20" y="26" font-size="18" text-anchor="middle" fill="#CBD5E1">?</text>
      </svg>`;
      slot.appendChild(placeholder);

      _slots[role] = slot;
      _container.appendChild(slot);
    });
  }

  function assign(role, char) {
    const slot = _slots[role];
    if (!slot) return;

    slot.classList.remove('animate');
    // Trigger reflow to restart animation
    void slot.offsetWidth;

    // Clear previous content (keep label)
    while (slot.children.length > 1) slot.removeChild(slot.lastChild);

    const img = document.createElement('img');
    img.src = Characters.imgUrl(char);
    img.alt = char.name;
    img.width = 54;
    img.height = 76;
    slot.appendChild(img);

    const name = document.createElement('div');
    name.className = 'slot-name';
    name.textContent = char.name;
    slot.appendChild(name);

    slot.classList.add('filled', 'animate');

    // Remove animate class after it completes so it can re-trigger if needed
    slot.addEventListener('animationend', () => slot.classList.remove('animate'), { once: true });
  }

  function unassign(role) {
    const slot = _slots[role];
    if (!slot) return;

    slot.classList.remove('filled', 'animate');

    while (slot.children.length > 1) slot.removeChild(slot.lastChild);

    const placeholder = document.createElement('div');
    placeholder.className = 'slot-empty-icon';
    placeholder.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="19" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="4 3"/>
      <text x="20" y="26" font-size="18" text-anchor="middle" fill="#CBD5E1">?</text>
    </svg>`;
    slot.appendChild(placeholder);
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return { init, assign, unassign, ROLES };
})();
