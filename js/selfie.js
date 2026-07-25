/**
 * selfie.js
 * Manages camera access, live video preview, and still capture for Phase SELFIE.
 */

const Selfie = (() => {

  let _stream     = null;
  let _videoEl    = null;
  let _previewEl  = null;
  let _dataURL    = null;

  async function start(videoEl, previewEl) {
    _videoEl   = videoEl;
    _previewEl = previewEl;
    _dataURL   = null;

    // Prefer front camera
    const constraints = {
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 854 } },
      audio: false,
    };

    try {
      _stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (_) {
      // Fall back to any camera
      _stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    _videoEl.srcObject = _stream;
    await _videoEl.play();

    _videoEl.style.display = 'block';
    _previewEl.style.display = 'none';
  }

  function capture() {
    const video = _videoEl;
    const canvas = document.createElement('canvas');
    // Mirror horizontally to match the CSS mirror on the video element
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 854;
    const ctx = canvas.getContext('2d');
    // Draw mirrored so the captured image matches what the student sees
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    _dataURL = canvas.toDataURL('image/png');

    _previewEl.src = _dataURL;
    _previewEl.style.display = 'block';
    _videoEl.style.display = 'none';

    return _dataURL;
  }

  function retake() {
    _dataURL = null;
    _previewEl.style.display = 'none';
    _videoEl.style.display = 'block';
  }

  function stop() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    if (_videoEl) {
      _videoEl.srcObject = null;
    }
  }

  function getDataURL() { return _dataURL; }

  return { start, capture, retake, stop, getDataURL };
})();
