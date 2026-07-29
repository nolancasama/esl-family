/**
 * characters.js
 * Loads the character manifest and provides the shuffle/lookup helpers
 * used to build each choose-phase pool.
 */

const Characters = (() => {

  let _all = [];

  async function load() {
    const res = await fetch('assets/characters.json');
    _all = await res.json();
    return _all;
  }

  function getAll() { return _all; }

  function imgUrl(char) { return char.img; }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { load, getAll, imgUrl, shuffle };
})();
