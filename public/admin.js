(() => {
  const formatResult = (code) => (code === 'GREEN' || code === 'RED' ? 'PASS' : (code || '-'));
  const loginView = document.querySelector('#loginView');
  const dashboardView = document.querySelector('#dashboardView');
  const toast = document.querySelector('#toast');
  const METRICS_POLL_MS = 4000;
  const state = {
    logsPage:1, logsTotal:0, employeesPage:1, employeesTotal:0, limit:25,
    metrics:{ total:null, green:null, red:null, errors:null },
    metricsPollTimer:null, metricsPollInFlight:false
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatTime = (value) => new Intl.DateTimeFormat('id-ID',{ timeZone:'Asia/Jakarta', dateStyle:'medium', timeStyle:'medium' }).format(new Date(value));
  async function api(url, options={}) {
    const response = await fetch(url, { credentials:'same-origin', ...options, headers:{ ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers||{}) } });
    const data = await response.json().catch(() => ({ success:false, message:'Respons server tidak valid.' }));
    if (response.status === 401) showLogin();
    if (!response.ok) throw new Error(data.message || 'Permintaan gagal.');
    return data;
  }
  function showLogin(){ stopMetricsPolling(); loginView.hidden=false; dashboardView.hidden=true; }
  function showDashboard(username){ loginView.hidden=true; dashboardView.hidden=false; document.querySelector('#adminName').textContent=username; startMetricsPolling(); }
  function pulseMetricCard(metricKey){
    const card=document.querySelector(`.metric-card[data-metric="${metricKey}"]`);
    const strong=card?.querySelector('strong');
    if(!card||!strong)return;
    const flashClass=metricKey==='green'?'metric-flash-green':metricKey==='red'?'metric-flash-red':null;
    if(flashClass){ card.classList.remove(flashClass); void card.offsetWidth; card.classList.add(flashClass); card.addEventListener('animationend',()=>card.classList.remove(flashClass),{once:true}); }
    strong.classList.remove('metric-pop'); void strong.offsetWidth; strong.classList.add('metric-pop');
    strong.addEventListener('animationend',()=>strong.classList.remove('metric-pop'),{once:true});
  }
  function applySummaryMetrics(data,{animate=false}={}){
    const keys=['total','green','red','errors'];
    keys.forEach((key)=>{
      const el=document.querySelector(`#metric${key.charAt(0).toUpperCase()}${key.slice(1)}`);
      if(!el)return;
      const next=Number(data[key]);
      if(!Number.isFinite(next))return;
      const prev=state.metrics[key];
      el.textContent=String(next);
      if(animate&&Number.isFinite(prev)&&next>prev&&(key==='green'||key==='red'))pulseMetricCard(key);
      state.metrics[key]=next;
    });
  }
  function isLogsTabActive(){ const pane=document.querySelector('#logsPane'); return pane?.classList.contains('active')&&pane?.classList.contains('show'); }
  async function fetchSummaryOnly(){
    const params=reportParams();
    const summary=await api(`/api/admin/reports/summary?${params}`);
    return summary.data;
  }
  async function pollMetrics(){
    if(dashboardView.hidden||document.hidden||state.metricsPollInFlight)return;
    state.metricsPollInFlight=true;
    try {
      const data=await fetchSummaryOnly();
      const prevGreen=state.metrics.green; const prevRed=state.metrics.red;
      applySummaryMetrics(data,{animate:true});
      const scanHit=(Number.isFinite(prevGreen)&&data.green>prevGreen)||(Number.isFinite(prevRed)&&data.red>prevRed);
      if(scanHit&&isLogsTabActive()&&state.logsPage===1) await loadLogsTable();
    } catch (_) {} finally { state.metricsPollInFlight=false; }
  }
  function startMetricsPolling(){
    stopMetricsPolling();
    state.metricsPollTimer=setInterval(pollMetrics,METRICS_POLL_MS);
  }
  function stopMetricsPolling(){
    if(state.metricsPollTimer){ clearInterval(state.metricsPollTimer); state.metricsPollTimer=null; }
  }
  function notify(message){ toast.textContent=message;toast.hidden=false;setTimeout(()=>{toast.hidden=true;},2500); }
  function showError(id,error){const el=document.querySelector(id);el.textContent=error.message;el.hidden=false;}
  function clearError(id){document.querySelector(id).hidden=true;}
  function reportParams(){ const data=new FormData(document.querySelector('#reportFilters')); const params=new URLSearchParams(); for(const [key,value] of data) if(value) params.set(key,value); return params; }
  function pageText(page,total){const pages=Math.max(1,Math.ceil(total/state.limit));return `Halaman ${page} dari ${pages} (${total} data)`;}

  async function init(){
    try {
      const session=await api('/api/inspection/auth/session'); showDashboard(session.username);
      const today=await api('/api/admin/today');
      document.querySelector('#businessDate').textContent=today.business_date;
      document.querySelector('#startDate').value=today.business_date;
      document.querySelector('#endDate').value=today.business_date;
      await Promise.all([loadDepartments(),loadReportCheckpoints(),loadReports(),loadEmployees(),loadCheckpointSettings()]);
    } catch (_) { showLogin(); }
  }
  async function loadDepartments(){
    const result=await api('/api/admin/reports/departments');const select=document.querySelector('#department');
    result.data.forEach((value)=>select.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
  }
  async function loadReportCheckpoints(){
    const result=await api('/api/admin/reports/checkpoints');const select=document.querySelector('#checkpoint');
    result.data.forEach((value)=>select.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
  }
  async function loadCheckpointSettings(){
    clearError('#checkpointAlert');
    try {
      const result=await api('/api/admin/checkpoints');const body=document.querySelector('#checkpointsBody');body.innerHTML='';
      result.data.forEach((row)=>body.insertAdjacentHTML('beforeend',`<tr><td><input class="form-control form-control-sm checkpoint-name-input" data-id="${row.id}" value="${escapeHtml(row.name)}" maxlength="255" aria-label="Nama lokasi ${escapeHtml(row.name)}"></td><td><input class="form-control form-control-sm checkpoint-sort-input" data-id="${row.id}" type="number" value="${row.sort_order}" min="0" step="1" aria-label="Urutan ${escapeHtml(row.name)}"></td><td>${row.is_active?'Aktif':'Nonaktif'}</td><td><input class="form-check-input checkpoint-active-input" data-id="${row.id}" type="checkbox" ${row.is_active?'checked':''} aria-label="Aktifkan ${escapeHtml(row.name)}"></td></tr>`));
      document.querySelector('#checkpointsEmpty').hidden=result.data.length>0;
    } catch(error){showError('#checkpointAlert',error);}
  }
  async function loadLogsTable(){
    const params=reportParams(); params.set('page',state.logsPage);params.set('limit',state.limit);
    const logs=await api(`/api/admin/reports/logs?${params}`);
    state.logsTotal=logs.pagination.total; const body=document.querySelector('#logsBody');body.innerHTML='';
    logs.data.forEach((row)=>body.insertAdjacentHTML('beforeend',`<tr><td class="text-nowrap">${escapeHtml(formatTime(row.scanned_at))}</td><td><strong>${escapeHtml(row.employee_id||'-')}</strong><br><span class="text-secondary small">${escapeHtml(row.name||row.scanned_value)}</span></td><td>${escapeHtml(row.department||'-')}</td><td>${escapeHtml(row.employee_location||'-')}</td><td>${escapeHtml(row.checkpoint_location||'-')}</td><td>${levelBadge(row.inspection_level)}</td><td><span class="badge-level badge-neutral">${escapeHtml(formatResult(row.result_code))}</span></td><td>${escapeHtml(row.source)}</td></tr>`));
    document.querySelector('#logsEmpty').hidden=logs.data.length>0;document.querySelector('#logsPage').textContent=pageText(state.logsPage,state.logsTotal);
    document.querySelector('#logsPrev').disabled=state.logsPage<=1;document.querySelector('#logsNext').disabled=state.logsPage*state.limit>=state.logsTotal;
  }
  async function loadReports(){
    clearError('#reportAlert'); const params=reportParams();
    try {
      const [summary]=await Promise.all([api(`/api/admin/reports/summary?${params}`),loadLogsTable()]);
      applySummaryMetrics(summary.data,{animate:false});
    } catch(error){showError('#reportAlert',error);}
  }
  const levelBadge=(level)=>level?`<span class="badge-level badge-${escapeHtml(level)}">${escapeHtml(level)}</span>`:'<span class="badge-level badge-neutral">-</span>';
  async function loadEmployees(){
    clearError('#employeeAlert');const params=new URLSearchParams({page:state.employeesPage,limit:state.limit});const search=document.querySelector('#employeeSearch').value.trim();const level=document.querySelector('#employeeLevel').value;if(search)params.set('search',search);if(level)params.set('level',level);
    try {
      const result=await api(`/api/admin/employees?${params}`);state.employeesTotal=result.pagination.total;const body=document.querySelector('#employeesBody');body.innerHTML='';
      result.data.forEach((row)=>body.insertAdjacentHTML('beforeend',`<tr><td><strong>${escapeHtml(row.employee_id)}</strong></td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.department)}</td><td><input class="form-control form-control-sm location-input" type="text" maxlength="255" value="${escapeHtml(row.location||'')}" data-employee-id="${escapeHtml(row.employee_id)}" data-original="${escapeHtml(row.location||'')}" aria-label="Lokasi ${escapeHtml(row.name)}"></td><td>${row.is_active?'Aktif':'Nonaktif'}</td><td><select class="form-select form-select-sm level-select" data-employee-id="${escapeHtml(row.employee_id)}" aria-label="Level inspection ${escapeHtml(row.name)}"><option value="green" ${row.level==='green'?'selected':''}>Green</option><option value="red" ${row.level==='red'?'selected':''}>Red</option></select></td></tr>`));
      document.querySelector('#employeesEmpty').hidden=result.data.length>0;document.querySelector('#employeesPage').textContent=pageText(state.employeesPage,state.employeesTotal);
      document.querySelector('#employeesPrev').disabled=state.employeesPage<=1;document.querySelector('#employeesNext').disabled=state.employeesPage*state.limit>=state.employeesTotal;
    } catch(error){showError('#employeeAlert',error);}
  }
  document.querySelector('#loginForm').addEventListener('submit',async(event)=>{
    event.preventDefault();const errorEl=document.querySelector('#loginError');errorEl.hidden=true;const button=event.submitter;button.disabled=true;
    try {const result=await api('/api/inspection/auth/login',{method:'POST',body:JSON.stringify({username:document.querySelector('#username').value.trim(),password:document.querySelector('#password').value})});showDashboard(result.username);await init();}
    catch(error){errorEl.textContent=error.message;errorEl.hidden=false;}finally{button.disabled=false;}
  });
  document.querySelector('#logoutButton').addEventListener('click',async()=>{try{await api('/api/inspection/auth/logout',{method:'POST'});}finally{showLogin();}});
  document.addEventListener('visibilitychange',()=>{ if(!dashboardView.hidden){ if(document.hidden)stopMetricsPolling(); else startMetricsPolling(); } });
  document.querySelector('#reportFilters').addEventListener('submit',(event)=>{event.preventDefault();state.logsPage=1;loadReports();});
  document.querySelector('#exportButton').addEventListener('click',()=>{window.location.href=`/api/admin/reports/export?${reportParams()}`;});
  document.querySelector('#logsPrev').addEventListener('click',()=>{if(state.logsPage>1){state.logsPage--;loadReports();}});document.querySelector('#logsNext').addEventListener('click',()=>{if(state.logsPage*state.limit<state.logsTotal){state.logsPage++;loadReports();}});
  document.querySelector('#employeeFilters').addEventListener('submit',(event)=>{event.preventDefault();state.employeesPage=1;loadEmployees();});
  document.querySelector('#employeesPrev').addEventListener('click',()=>{if(state.employeesPage>1){state.employeesPage--;loadEmployees();}});document.querySelector('#employeesNext').addEventListener('click',()=>{if(state.employeesPage*state.limit<state.employeesTotal){state.employeesPage++;loadEmployees();}});
  document.querySelector('#employeesBody').addEventListener('change',async(event)=>{
    const select=event.target.closest('.level-select');if(!select)return;const previous=select.value==='green'?'red':'green';const employeeId=select.dataset.employeeId;
    if(!confirm(`Ubah level ${employeeId} menjadi ${select.value.toUpperCase()}?`)){select.value=previous;return;}select.disabled=true;
    try{await api(`/api/admin/employees/${encodeURIComponent(employeeId)}/level`,{method:'PATCH',body:JSON.stringify({level:select.value})});notify(`Level ${employeeId} berhasil diperbarui.`);await loadReports();}
    catch(error){select.value=previous;showError('#employeeAlert',error);}finally{select.disabled=false;}
  });
  document.querySelector('#employeesBody').addEventListener('change',async(event)=>{
    const input=event.target.closest('.location-input');if(!input)return;const employeeId=input.dataset.employeeId;const location=input.value.trim();const original=input.dataset.original||'';
    if(!location){input.value=original;showError('#employeeAlert',new Error('Lokasi wajib diisi.'));return;}
    if(location===original)return;input.disabled=true;
    try{await api(`/api/admin/employees/${encodeURIComponent(employeeId)}/location`,{method:'PATCH',body:JSON.stringify({location})});input.dataset.original=location;notify(`Lokasi ${employeeId} berhasil diperbarui.`);}
    catch(error){input.value=original;showError('#employeeAlert',error);}finally{input.disabled=false;}
  });
  document.querySelector('#checkpointAddForm').addEventListener('submit',async(event)=>{
    event.preventDefault();clearError('#checkpointAlert');const name=document.querySelector('#checkpointName').value.trim();const sortOrder=document.querySelector('#checkpointSort').value;
    try{await api('/api/admin/checkpoints',{method:'POST',body:JSON.stringify({name,sort_order:sortOrder})});document.querySelector('#checkpointName').value='';notify('Lokasi scan ditambahkan.');await loadCheckpointSettings();const filter=document.querySelector('#checkpoint');filter.innerHTML='<option value="">Semua</option>';await loadReportCheckpoints();}
    catch(error){showError('#checkpointAlert',error);}
  });
  document.querySelector('#checkpointsBody').addEventListener('change',async(event)=>{
    const target=event.target;const id=target.dataset.id;if(!id)return;
    if(target.classList.contains('checkpoint-active-input')){
      try{await api(`/api/admin/checkpoints/${id}`,{method:'PATCH',body:JSON.stringify({is_active:target.checked})});notify('Status lokasi diperbarui.');await loadCheckpointSettings();}
      catch(error){showError('#checkpointAlert',error);await loadCheckpointSettings();}
      return;
    }
    if(target.classList.contains('checkpoint-name-input')){
      const name=target.value.trim();if(!name){showError('#checkpointAlert',new Error('Nama lokasi wajib diisi.'));return;}
      try{await api(`/api/admin/checkpoints/${id}`,{method:'PATCH',body:JSON.stringify({name})});notify('Nama lokasi diperbarui.');}
      catch(error){showError('#checkpointAlert',error);await loadCheckpointSettings();}
      return;
    }
    if(target.classList.contains('checkpoint-sort-input')){
      try{await api(`/api/admin/checkpoints/${id}`,{method:'PATCH',body:JSON.stringify({sort_order:target.value})});notify('Urutan lokasi diperbarui.');}
      catch(error){showError('#checkpointAlert',error);await loadCheckpointSettings();}
    }
  });
  init();
})();
