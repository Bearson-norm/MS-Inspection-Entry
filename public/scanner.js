(() => {
  const video = document.querySelector('#cameraVideo');
  const placeholder = document.querySelector('#cameraPlaceholder');
  const cameraButton = document.querySelector('#cameraButton');
  const cameraStatus = document.querySelector('#cameraStatus');
  const form = document.querySelector('#manualForm');
  const input = document.querySelector('#employeeInput');
  const manualButton = document.querySelector('#manualButton');
  const overlay = document.querySelector('#resultOverlay');
  let stream = null; let detector = null; let timer = null; let processing = false; let lastValue = ''; let lastAt = 0;

  const setStatus = (message) => { cameraStatus.textContent = message; };
  const stopCamera = () => {
    if (timer) clearTimeout(timer); timer = null;
    if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null;
    video.srcObject = null; placeholder.hidden = false; cameraButton.textContent = 'Aktifkan kamera';
  };
  const schedule = () => { if (stream) timer = setTimeout(detect, 140); };
  async function detect() {
    if (!processing && detector && video.readyState >= 2) {
      try {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue;
        if (value && !(value === lastValue && Date.now() - lastAt < 3000)) {
          lastValue = value; lastAt = Date.now(); await submitScan(value, 'camera');
        }
      } catch (_) {}
    }
    schedule();
  }
  async function startCamera() {
    if (stream) { stopCamera(); setStatus('Kamera dinonaktifkan'); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
      setStatus('Browser tidak mendukung pemindai QR. Gunakan input manual.'); input.focus(); return;
    }
    cameraButton.disabled = true; setStatus('Menyiapkan kamera...');
    try {
      const formats = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : ['qr_code'];
      if (!formats.includes('qr_code')) throw new Error('QR_NOT_SUPPORTED');
      detector = new BarcodeDetector({ formats: ['qr_code'] });
      stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } } });
      video.srcObject = stream; await video.play(); placeholder.hidden = true;
      cameraButton.textContent = 'Nonaktifkan kamera'; setStatus('Kamera aktif. Arahkan ke QR karyawan.'); schedule();
    } catch (error) {
      stopCamera();
      setStatus(error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera atau gunakan input manual.' : 'Kamera tidak dapat digunakan. Gunakan input manual.');
    } finally { cameraButton.disabled = false; }
  }
  function showResult(data) {
    const state = data.code === 'GREEN' ? 'green' : data.code === 'RED' ? 'red' : 'error';
    overlay.className = `result-overlay ${state}`; overlay.hidden = false;
    document.querySelector('#resultLabel').textContent = data.code === 'GREEN' ? 'Green level' : data.code === 'RED' ? 'Red level' : 'Scan tidak berhasil';
    document.querySelector('#resultTitle').textContent = data.code === 'GREEN' ? 'Silakan masuk' : data.code === 'RED' ? 'Periksa' : 'Coba kembali';
    document.querySelector('#resultMessage').textContent = data.message;
    const details = document.querySelector('#employeeDetails');
    details.innerHTML = data.employee ? `<div><dt>Employee ID</dt><dd>${escapeHtml(data.employee.employee_id)}</dd></div><div><dt>Nama</dt><dd>${escapeHtml(data.employee.name)}</dd></div><div><dt>Departemen</dt><dd>${escapeHtml(data.employee.department)}</dd></div>` : '';
  }
  async function submitScan(value, source) {
    if (processing) return; processing = true; manualButton.disabled = true; cameraButton.disabled = true; setStatus('Memproses scan...');
    let data;
    try {
      const response = await fetch('/api/scans', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ value, source }) });
      data = await response.json();
      if (!data.code) throw new Error('INVALID_RESPONSE');
    } catch (_) { data = { code:'NETWORK_ERROR', message:'Tidak dapat terhubung ke server.', display_ms:2000 }; }
    showResult(data);
    await new Promise((resolve) => setTimeout(resolve, data.display_ms || 2000));
    overlay.hidden = true; processing = false; manualButton.disabled = false; cameraButton.disabled = false; input.value = '';
    setStatus(stream ? 'Kamera aktif. Arahkan ke QR karyawan.' : 'Siap memindai');
    if (!stream) input.focus();
  }
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  cameraButton.addEventListener('click', startCamera);
  form.addEventListener('submit', (event) => { event.preventDefault(); const value=input.value.trim(); if(value) submitScan(value,'manual'); else { setStatus('Masukkan Employee ID terlebih dahulu.'); input.focus(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  window.addEventListener('pagehide', stopCamera);
})();
