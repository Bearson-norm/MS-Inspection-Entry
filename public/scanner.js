(() => {
  const video = document.querySelector('#cameraVideo');
  const placeholder = document.querySelector('#cameraPlaceholder');
  const cameraButton = document.querySelector('#cameraButton');
  const cameraStatus = document.querySelector('#cameraStatus');
  const form = document.querySelector('#manualForm');
  const input = document.querySelector('#employeeInput');
  const manualButton = document.querySelector('#manualButton');
  const overlay = document.querySelector('#resultOverlay');
  const checkpointField = document.querySelector('#checkpointField');
  const checkpointSelect = document.querySelector('#checkpointSelect');
  const CHECKPOINT_STORAGE_KEY = 'inspection_checkpoint_selection';
  const CANVAS_MAX_WIDTH = 640;
  const SCAN_INTERVAL_MS = 140;

  let stream = null;
  let detector = null;
  let scanMode = null;
  let decodeCanvas = null;
  let decodeContext = null;
  let timer = null;
  let processing = false;
  let lastValue = '';
  let lastAt = 0;
  let activeCheckpoint = '';
  let checkpointSelectionRequired = false;

  const setStatus = (message) => { cameraStatus.textContent = message; };

  function ensureDecodeCanvas() {
    if (!decodeCanvas) {
      decodeCanvas = document.createElement('canvas');
      decodeCanvas.hidden = true;
      decodeCanvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(decodeCanvas);
      decodeContext = decodeCanvas.getContext('2d', { willReadFrequently: true });
    }
    return decodeContext;
  }

  async function resolveScanMode() {
    if (window.BarcodeDetector) {
      try {
        const formats = BarcodeDetector.getSupportedFormats
          ? await BarcodeDetector.getSupportedFormats()
          : ['qr_code'];
        if (formats.includes('qr_code')) return 'native';
      } catch (_) {}
    }
    if (typeof window.jsQR === 'function') return 'canvas';
    return null;
  }

  function decodeFromVideoFrame() {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return null;

    const scale = Math.min(1, CANVAS_MAX_WIDTH / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = ensureDecodeCanvas();
    if (!ctx) return null;

    decodeCanvas.width = width;
    decodeCanvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const result = window.jsQR(imageData.data, width, height);
    return result?.data || null;
  }

  async function readScannedValue() {
    if (scanMode === 'native' && detector) {
      const codes = await detector.detect(video);
      return codes[0]?.rawValue || null;
    }
    if (scanMode === 'canvas') return decodeFromVideoFrame();
    return null;
  }

  const stopCamera = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    detector = null;
    scanMode = null;
    placeholder.hidden = false;
    cameraButton.textContent = 'Aktifkan kamera';
  };

  const schedule = () => { if (stream) timer = setTimeout(detect, SCAN_INTERVAL_MS); };

  async function detect() {
    if (!processing && scanMode && video.readyState >= 2) {
      try {
        const value = await readScannedValue();
        if (value && !(value === lastValue && Date.now() - lastAt < 3000)) {
          lastValue = value;
          lastAt = Date.now();
          await submitScan(value, 'camera');
        }
      } catch (_) {}
    }
    schedule();
  }

  async function startCamera() {
    if (stream) {
      stopCamera();
      setStatus('Kamera dinonaktifkan');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Browser tidak mendukung kamera. Gunakan input manual.');
      input.focus();
      return;
    }

    cameraButton.disabled = true;
    setStatus('Menyiapkan kamera...');
    try {
      const mode = await resolveScanMode();
      if (!mode) {
        setStatus('Pemindai QR tidak tersedia. Gunakan input manual.');
        input.focus();
        return;
      }
      scanMode = mode;
      if (scanMode === 'native') {
        detector = new BarcodeDetector({ formats: ['qr_code'] });
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      await video.play();
      placeholder.hidden = true;
      cameraButton.textContent = 'Nonaktifkan kamera';
      setStatus('Kamera aktif. Arahkan ke QR karyawan.');
      schedule();
    } catch (error) {
      stopCamera();
      setStatus(
        error.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Izinkan kamera atau gunakan input manual.'
          : 'Kamera tidak dapat digunakan. Gunakan input manual.',
      );
    } finally {
      cameraButton.disabled = false;
    }
  }

  function showResult(data) {
    const state = data.code === 'GREEN' ? 'green' : data.code === 'RED' ? 'red' : 'error';
    overlay.className = `result-overlay ${state}`;
    overlay.hidden = false;
    document.querySelector('#resultLabel').textContent = data.code === 'GREEN' ? 'Green level' : data.code === 'RED' ? 'Red level' : 'Scan tidak berhasil';
    document.querySelector('#resultTitle').textContent = data.code === 'GREEN' ? 'Silakan masuk' : data.code === 'RED' ? 'Periksa' : 'Coba kembali';
    document.querySelector('#resultMessage').textContent = data.message;
    const details = document.querySelector('#employeeDetails');
    const checkpoint = data.checkpoint_location || activeCheckpoint || '-';
    const rows = [];
    if (data.employee) {
      rows.push(`<div><dt>Employee ID</dt><dd>${escapeHtml(data.employee.employee_id)}</dd></div>`);
      rows.push(`<div><dt>Nama</dt><dd>${escapeHtml(data.employee.name)}</dd></div>`);
      rows.push(`<div><dt>Departemen</dt><dd>${escapeHtml(data.employee.department)}</dd></div>`);
      rows.push(`<div><dt>Lokasi karyawan</dt><dd>${escapeHtml(data.employee.location || '-')}</dd></div>`);
    }
    rows.push(`<div><dt>Lokasi scan</dt><dd>${escapeHtml(checkpoint)}</dd></div>`);
    details.innerHTML = rows.join('');
  }

  function getSelectedCheckpoint() {
    if (checkpointField && !checkpointField.hidden && checkpointSelect) {
      return checkpointSelect.value.trim();
    }
    return activeCheckpoint.trim();
  }

  function readSavedCheckpoint() {
    try {
      return localStorage.getItem(CHECKPOINT_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function persistCheckpointSelection(value) {
    if (!value) return;
    try { localStorage.setItem(CHECKPOINT_STORAGE_KEY, value); } catch (_) {}
  }

  async function loadScannerConfig() {
    try {
      const response = await fetch('/api/inspection/scanner-config');
      const data = await response.json();
      activeCheckpoint = String(data.checkpoint_location || '').trim();
      const checkpoints = Array.isArray(data.checkpoints) ? data.checkpoints : [];
      checkpointSelectionRequired = Boolean(data.selection_required);

      if (!checkpoints.length) {
        if (checkpointField) checkpointField.hidden = true;
        return;
      }

      checkpointField.hidden = false;
      checkpointSelect.innerHTML = checkpoints.length > 1
        ? '<option value="">— Pilih lokasi —</option>'
        : '';
      checkpoints.forEach((name) => {
        checkpointSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`);
      });

      const saved = readSavedCheckpoint();
      if (saved && checkpoints.includes(saved)) checkpointSelect.value = saved;
      else if (checkpoints.length === 1) checkpointSelect.value = checkpoints[0];

      activeCheckpoint = checkpointSelect.value || activeCheckpoint;
      if (activeCheckpoint) persistCheckpointSelection(activeCheckpoint);
      checkpointSelect.addEventListener('change', () => {
        activeCheckpoint = checkpointSelect.value;
        persistCheckpointSelection(activeCheckpoint);
      });
    } catch (_) {}
  }

  async function submitScan(value, source) {
    if (processing) return;
    const checkpointLocation = getSelectedCheckpoint();
    if (checkpointSelectionRequired && !checkpointLocation) {
      setStatus('Pilih lokasi scan terlebih dahulu.');
      checkpointSelect?.focus();
      return;
    }
    processing = true;
    manualButton.disabled = true;
    cameraButton.disabled = true;
    setStatus('Memproses scan...');
    let data;
    try {
      const payload = { value, source };
      if (checkpointLocation) payload.checkpoint_location = checkpointLocation;
      const response = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await response.json();
      if (!data.code) throw new Error('INVALID_RESPONSE');
    } catch (_) {
      data = { code: 'NETWORK_ERROR', message: 'Tidak dapat terhubung ke server.', display_ms: 2000, checkpoint_location: activeCheckpoint };
    }
    showResult(data);
    await new Promise((resolve) => setTimeout(resolve, data.display_ms || 2000));
    overlay.hidden = true;
    processing = false;
    manualButton.disabled = false;
    cameraButton.disabled = false;
    input.value = '';
    setStatus(stream ? 'Kamera aktif. Arahkan ke QR karyawan.' : 'Siap memindai');
    if (!stream) input.focus();
  }

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  cameraButton.addEventListener('click', startCamera);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (value) submitScan(value, 'manual');
    else {
      setStatus('Masukkan Employee ID terlebih dahulu.');
      input.focus();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  window.addEventListener('pagehide', stopCamera);
  loadScannerConfig();
})();
