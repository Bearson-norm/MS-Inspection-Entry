(() => {
  const loginView = document.querySelector('#loginView');
  const dashboardView = document.querySelector('#dashboardView');
  const toast = document.querySelector('#toast');
  const state = { logsPage:1, logsTotal:0, employeesPage:1, employeesTotal:0, limit:25 };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const formatTime = (value) => new Intl.DateTimeFormat('id-ID',{ timeZone:'Asia/Jakarta', dateStyle:'medium', timeStyle:'medium' }).format(new Date(value));
  const ymd = (date) => { const local = new Date(date.getTime() - date.getTimezoneOffset()*60000); return local.toISOString().slice(0,10); };
  async function api(url, options={}) {
    const response = await fetch(url, { credentials:'same-origin', ...options, headers:{ ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers||{}) } });
    const data = await response.json().catch(() => ({ success:false, message:'Respons server tidak valid.' }));
    if (response.status === 401) showLogin();
    if (!response.ok) throw new Error(data.message || 'Permintaan gagal.');
    return data;
  }
  function showLogin(){ loginView.hidden=false; dashboardView.hidden=true; }
  function showDashboard(username){ loginView.hidden=true; dashboardView.hidden=false; document.querySelector('#adminName').textContent=username; }
  function notify(message){ toast.textContent=message;toast.hidden=false;setTimeout(()=>{toast.hidden=true;},2500); }
  function showError(id,error){const el=document.querySelector(id);el.textContent=error.message;el.hidden=false;}
  function clearError(id){document.querySelector(id).hidden=true;}
  function reportParams(){ const data=new FormData(document.querySelector('#reportFilters')); const params=new URLSearchParams(); for(const [key,value] of data) if(value) params.set(key,value); return params; }
  function pageText(page,total){const pages=Math.max(1,Math.ceil(total/state.limit));return `Halaman ${page} dari ${pages} (${total} data)`;}

  async function init(){
    try {
      const session=await api('/api/auth/session'); showDashboard(session.username);
      const today=await api('/api/admin/today'); document.querySelector('#businessDate').textContent=today.business_date;
      const end=new Date(); if(end.getHours()<6) end.setDate(end.getDate()-1);
      const start=new Date(end);start.setDate(start.getDate()-6);
      document.querySelector('#startDate').value=ymd(start);document.querySelector('#endDate').value=ymd(end);
      await Promise.all([loadDepartments(),loadReports(),loadEmployees()]);
    } catch (_) { showLogin(); }
  }
  async function loadDepartments(){
    const result=await api('/api/admin/reports/departments');const select=document.querySelector('#department');
    result.data.forEach((value)=>select.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
  }
  async function loadReports(){
    clearError('#reportAlert'); const params=reportParams(); params.set('page',state.logsPage);params.set('limit',state.limit);
    try {
      const [summary,logs]=await Promise.all([api(`/api/admin/reports/summary?${params}`),api(`/api/admin/reports/logs?${params}`)]);
      document.querySelector('#metricTotal').textContent=summary.data.total;document.querySelector('#metricGreen').textContent=summary.data.green;document.querySelector('#metricRed').textContent=summary.data.red;document.querySelector('#metricErrors').textContent=summary.data.errors;
      state.logsTotal=logs.pagination.total; const body=document.querySelector('#logsBody');body.innerHTML='';
      logs.data.forEach((row)=>body.insertAdjacentHTML('beforeend',`<tr><td class="text-nowrap">${escapeHtml(formatTime(row.scanned_at))}</td><td><strong>${escapeHtml(row.employee_id||'-')}</strong><br><span class="text-secondary small">${escapeHtml(row.name||row.scanned_value)}</span></td><td>${escapeHtml(row.department||'-')}</td><td>${levelBadge(row.inspection_level)}</td><td><span class="badge-level badge-neutral">${escapeHtml(row.result_code)}</span></td><td>${escapeHtml(row.source)}</td></tr>`));
      document.querySelector('#logsEmpty').hidden=logs.data.length>0;document.querySelector('#logsPage').textContent=pageText(state.logsPage,state.logsTotal);
      document.querySelector('#logsPrev').disabled=state.logsPage<=1;document.querySelector('#logsNext').disabled=state.logsPage*state.limit>=state.logsTotal;
    } catch(error){showError('#reportAlert',error);}
  }
  const levelBadge=(level)=>level?`<span class="badge-level badge-${escapeHtml(level)}">${escapeHtml(level)}</span>`:'<span class="badge-level badge-neutral">-</span>';
  async function loadEmployees(){
    clearError('#employeeAlert');const params=new URLSearchParams({page:state.employeesPage,limit:state.limit});const search=document.querySelector('#employeeSearch').value.trim();const level=document.querySelector('#employeeLevel').value;if(search)params.set('search',search);if(level)params.set('level',level);
    try {
      const result=await api(`/api/admin/employees?${params}`);state.employeesTotal=result.pagination.total;const body=document.querySelector('#employeesBody');body.innerHTML='';
      result.data.forEach((row)=>body.insertAdjacentHTML('beforeend',`<tr><td><strong>${escapeHtml(row.employee_id)}</strong></td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.department)}</td><td>${row.is_active?'Aktif':'Nonaktif'}</td><td><select class="form-select form-select-sm level-select" data-employee-id="${escapeHtml(row.employee_id)}" aria-label="Level inspection ${escapeHtml(row.name)}"><option value="green" ${row.level==='green'?'selected':''}>Green</option><option value="red" ${row.level==='red'?'selected':''}>Red</option></select></td></tr>`));
      document.querySelector('#employeesEmpty').hidden=result.data.length>0;document.querySelector('#employeesPage').textContent=pageText(state.employeesPage,state.employeesTotal);
      document.querySelector('#employeesPrev').disabled=state.employeesPage<=1;document.querySelector('#employeesNext').disabled=state.employeesPage*state.limit>=state.employeesTotal;
    } catch(error){showError('#employeeAlert',error);}
  }
  document.querySelector('#loginForm').addEventListener('submit',async(event)=>{
    event.preventDefault();const errorEl=document.querySelector('#loginError');errorEl.hidden=true;const button=event.submitter;button.disabled=true;
    try {const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:document.querySelector('#username').value.trim(),password:document.querySelector('#password').value})});showDashboard(result.username);await init();}
    catch(error){errorEl.textContent=error.message;errorEl.hidden=false;}finally{button.disabled=false;}
  });
  document.querySelector('#logoutButton').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});}finally{showLogin();}});
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
  init();
})();
