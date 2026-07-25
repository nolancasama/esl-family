/**
 * recorder.js
 * Manages a single MediaRecorder session across Phase ASSIGN.
 * One stream is opened at the start and kept open until all 6 assignments
 * are done. Each assignment gets its own recorded segment (start → stop).
 */

const Recorder = (() => {

  let stream            = null;
  let mediaRecorder     = null;
  let chunks            = [];
  let _mimeType         = '';
  let _segmentStartTime = 0;    // Date.now() when startSegment() was called
  let _speechOffset     = null; // seconds from segment start when speech was detected

  // Preferred mime types in priority order
  const PREFERRED = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];

  function chooseMime() {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
      for (const m of PREFERRED) {
        if (MediaRecorder.isTypeSupported(m)) return m;
      }
    }
    return '';
  }

  // Open mic stream. Call once at the start of Phase ASSIGN.
  async function openStream() {
    if (stream) return; // already open
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    _mimeType = chooseMime();
  }

  // Start recording a new segment.
  function startSegment() {
    if (!stream) throw new Error('Recorder stream not open');
    chunks = [];
    _speechOffset     = null;
    _segmentStartTime = Date.now();
    const opts = _mimeType ? { mimeType: _mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, opts);
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
  }

  // Call this when SpeechRecognition fires onspeechstart.
  function markSpeechStart() {
    _speechOffset = Math.max(0, (Date.now() - _segmentStartTime) / 1000 - 0.25);
  }

  // Stop recording. Returns a Promise that resolves with a trimmed audio Blob.
  function stopSegment() {
    return new Promise((resolve) => {
      const finish = (blob) => {
        if (_speechOffset && _speechOffset > 0.1) {
          trimBlob(blob, _speechOffset).then(resolve).catch(() => resolve(blob));
        } else {
          resolve(blob);
        }
      };

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        finish(new Blob(chunks, { type: _mimeType || 'audio/webm' }));
        return;
      }
      mediaRecorder.onstop = () => {
        finish(new Blob(chunks, { type: _mimeType || 'audio/webm' }));
      };
      mediaRecorder.stop();
    });
  }

  async function trimBlob(blob, startSeconds) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    const sr          = audioBuffer.sampleRate;
    const startSample = Math.floor(startSeconds * sr);
    const length      = Math.max(1, audioBuffer.length - startSample);
    const trimmed     = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      audioBuffer.numberOfChannels, length, sr
    );
    const buf = trimmed.createBuffer(audioBuffer.numberOfChannels, length, sr);
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      buf.copyToChannel(audioBuffer.getChannelData(c).subarray(startSample), c);
    }
    return audioBufferToWav(buf);
  }

  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sr          = buffer.sampleRate;
    const numSamples  = buffer.length;
    const dataSize    = numSamples * numChannels * 2;
    const ab          = new ArrayBuffer(44 + dataSize);
    const view        = new DataView(ab);

    const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
    ws(8, 'WAVE'); ws(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true); view.setUint32(24, sr, true);
    view.setUint32(28, sr * numChannels * 2, true); view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true); ws(36, 'data'); view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  // Close the mic stream entirely. Call when leaving Phase ASSIGN.
  function closeStream() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  return { openStream, startSegment, markSpeechStart, stopSegment, closeStream, isSupported };
})();
