let token = localStorage.getItem('erp_token') || '';
let state = { projects: [], selectedProjectId: Number(localStorage.getItem('selected_project_id') || 0), loading: false };

const projectTypes = ['مباني', 'طرق', 'خزانات', 'هناجر', 'مصانع', 'بنية تحتية', 'توريدات', 'صيانة'];
const statuses = { active: 'نشط', delayed: 'متوقف/متأخر', high_risk: 'عالي المخاطر', completed: 'مكتمل', draft: 'مسودة' };
const priorities = { urgent: 'عاجلة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'تعذر تنفيذ الطلب');
  return data;
}

function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function safeClass(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function money(value, currency = 'ر.س') {
  return `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value || 0))} ${html(currency)}`;
}

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toast(message, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

async function login() {
  try {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    token = data.token;
    localStorage.setItem('erp_token', token);
    await loadProjects();
    toast('تم تسجيل الدخول بنجاح');
  } catch (error) { toast(error.message, 'error'); }
}

async function loadProjects() {
  if (!token) return renderLoginState();
  state.loading = true;
  render();
  try {
    state.projects = await api('/api/projects');
    if (!state.selectedProjectId && state.projects[0]) selectProject(state.projects[0].id, false);
  } catch (error) {
    localStorage.removeItem('erp_token');
    token = '';
    toast(error.message, 'error');
  } finally {
    state.loading = false;
    render();
  }
}

function selectProject(id, doRender = true) {
  state.selectedProjectId = Number(id || 0);
  localStorage.setItem('selected_project_id', String(state.selectedProjectId));
  if (doRender) render();
}

function currentProject() {
  return state.projects.find((p) => Number(p.id) === Number(state.selectedProjectId)) || state.projects[0] || null;
}

function route() {
  return (location.hash.replace('#/', '') || 'dashboard').split('/')[0];
}

function setActiveNav() {
  document.querySelectorAll('#mainNav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route()));
}

function render() {
  setActiveNav();
  const root = document.getElementById('appRoot');
  if (!token) { renderLoginState(); return; }
  if (state.loading) { root.innerHTML = '<div class="panel loading">جاري تحميل بيانات المشاريع...</div>'; return; }
  const views = { dashboard: renderDashboard, new: renderProjectForm, details: renderDetails, feasibility: renderFeasibility, costs: renderCosts, risks: renderRisks, reports: renderReports };
  root.innerHTML = (views[route()] || renderDashboard)();
}

function renderLoginState() {
  document.getElementById('appRoot').innerHTML = '<section class="panel hero"><h2>مرحبًا بك</h2><p>سجّل الدخول بالحساب التجريبي لبدء توليد وإدارة مشاريع المقاولات بالذكاء الاصطناعي.</p></section>';
}

function dashboardKpis() {
  const projects = state.projects;
  const totalCost = projects.reduce((s, p) => s + Number(p.total_estimated_cost || p.contract_value || 0), 0);
  return [
    ['إجمالي المشاريع', projects.length, '🏗️'],
    ['المشاريع النشطة', projects.filter((p) => p.status === 'active').length, '🟢'],
    ['إجمالي التكاليف التقديرية', money(totalCost), '💰'],
    ['تنبيهات عالية المخاطر/متوقفة', projects.filter((p) => ['delayed', 'high_risk'].includes(p.status)).length, '⚠️'],
  ];
}

function renderDashboard() {
  const projects = state.projects;
  const statusRows = Object.entries(statuses).map(([key, label]) => `<div><span>${html(label)}</span><strong>${projects.filter((p) => p.status === key).length}</strong></div>`).join('');
  const highRisk = projects.filter((p) => ['delayed', 'high_risk'].includes(p.status));
  return `
    <section class="kpis">${dashboardKpis().map(([label, value, icon], i) => `<article class="kpi fade" style="--i:${i}"><b>${html(icon)}</b><span>${html(label)}</span><strong>${value}</strong></article>`).join('')}</section>
    <section class="grid">
      <div class="panel wide"><div class="panel-head"><h2>آخر المشاريع المضافة</h2><a class="button" href="#/new">مشروع جديد بالذكاء الاصطناعي</a></div>${projectTable(projects.slice(0, 6))}</div>
      <div class="panel"><h2>عدد المشاريع حسب الحالة</h2><div class="status-list">${statusRows}</div><h3>تنبيهات</h3>${highRisk.length ? highRisk.map((p) => `<p class="alert">${html(p.project_name)} - ${html(statuses[p.status] || p.status)}</p>`).join('') : '<p class="muted">لا توجد تنبيهات حرجة حاليًا.</p>'}</div>
    </section>`;
}

function projectTable(projects) {
  const rows = projects.map((p) => `<tr><td><strong>${html(p.project_name)}</strong></td><td>${html(p.project_type || '-')}</td><td>${html(p.location || '-')}</td><td>${money(p.total_estimated_cost || p.contract_value, p.currency || 'ر.س')}</td><td><span class="badge ${safeClass(p.status)}">${html(statuses[p.status] || p.status)}</span></td><td><button class="secondary" onclick="selectProject(${Number(p.id)});location.hash='#/details'">فتح</button></td></tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>المشروع</th><th>النوع</th><th>الموقع</th><th>التكلفة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows || '<tr><td colspan="6">لا توجد مشاريع بعد.</td></tr>'}</tbody></table></div>`;
}

function renderProjectForm() {
  return `<section class="panel"><div class="panel-head"><h2>إنشاء مشروع بالذكاء الاصطناعي</h2><button class="secondary" onclick="autoFillProjectName()">اقتراح اسم تلقائي</button></div>
    <form class="form-grid" onsubmit="submitProject(event)">
      <label>اسم المشروع<input name="project_name" id="projectName" required placeholder="مثال: إنشاء مبنى إداري ذكي" /></label>
      <label>نوع المشروع<select name="project_type">${projectTypes.map((t) => `<option>${html(t)}</option>`).join('')}</select></label>
      <label>الموقع<input name="location" placeholder="المدينة / الحي" /></label>
      <label>المساحة المتوقعة<input name="area" type="number" min="1" placeholder="متر مربع" /></label>
      <label>مدة التنفيذ<input name="duration" placeholder="مثال: 12 شهر" /></label>
      <label>العملة<select name="currency"><option>ر.س</option><option>د.إ</option><option>د.ك</option><option>USD</option></select></label>
      <label class="full">وصف مختصر<textarea name="brief" rows="4" placeholder="اكتب وصفًا مختصرًا ليتم توليد النطاق والدراسة والتكاليف تلقائيًا"></textarea></label>
      <div class="full actions"><button type="submit">حفظ وتوليد الدراسة الأولية</button><button type="button" class="secondary" onclick="generateFullProjectFromForm()">توليد المشروع بالكامل</button></div>
    </form></section>`;
}

function collectForm() {
  const form = document.querySelector('form');
  return Object.fromEntries(new FormData(form).entries());
}

function autoFillProjectName() {
  const input = document.getElementById('projectName');
  if (!input.value) input.value = 'مجمع تجاري وإداري متكامل';
  toast('تم اقتراح اسم مشروع، أكمل البيانات أو اضغط توليد المشروع بالكامل');
}

async function generateFullProjectFromForm() {
  const form = document.querySelector('form');
  if (!form.reportValidity()) return;
  await createProject(collectForm(), true);
}

async function submitProject(event) {
  event.preventDefault();
  await createProject(collectForm(), true);
}

async function createProject(payload, fullGenerate) {
  try {
    const project = await api('/api/projects', { method: 'POST', body: JSON.stringify({ ...payload, generate_full: fullGenerate }) });
    state.projects.unshift(project);
    selectProject(project.id, false);
    toast('تم إنشاء المشروع وتوليد وحداته بنجاح');
    location.hash = '#/details';
  } catch (error) { toast(error.message, 'error'); }
}

function projectSelector() {
  return `<label class="project-picker">المشروع النشط<select onchange="selectProject(this.value)">${state.projects.map((p) => `<option value="${Number(p.id)}" ${Number(p.id) === Number(state.selectedProjectId) ? 'selected' : ''}>${html(p.project_name)}</option>`).join('')}</select></label>`;
}

function renderDetails() {
  const p = currentProject();
  if (!p) return '<section class="panel">لا يوجد مشروع محدد.</section>';
  const timeline = parseJson(p.timeline, []);
  return `<section class="panel">${projectSelector()}<div class="panel-head"><h2>${html(p.project_name)}</h2><button onclick="regenerateProject(${Number(p.id)})">توليد المشروع بالكامل</button></div><p>${html(p.project_description || p.feasibility_summary || 'لا يوجد وصف بعد.')}</p><div class="details-grid"><div><b>النوع</b><span>${html(p.project_type || '-')}</span></div><div><b>الموقع</b><span>${html(p.location || '-')}</span></div><div><b>المساحة</b><span>${html(p.area || 0)} م²</span></div><div><b>المدة</b><span>${html(p.duration || '-')}</span></div><div><b>الأولوية</b><span>${html(priorities[p.priority] || p.priority || 'متوسطة')}</span></div><div><b>التكلفة</b><span>${money(p.total_estimated_cost, p.currency || 'ر.س')}</span></div></div><h3>خطة تنفيذ PMP</h3>${taskTable(timeline)}</section>`;
}

function taskTable(timeline) {
  const rows = timeline.map((t) => `<tr><td>${html(t.task)}</td><td>${html(t.duration)}</td><td><div class="progress"><i style="width:${Math.min(100, Math.max(0, Number(t.progress || 0)))}%"></i></div><small>${html(t.progress || 0)}%</small></td><td>${html(t.owner)}</td><td>${html(t.status)}</td><td>${html(t.priority)}</td></tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>المرحلة/المهمة</th><th>المدة</th><th>الإنجاز</th><th>المسؤولية</th><th>الحالة</th><th>الأولوية</th></tr></thead><tbody>${rows || '<tr><td colspan="6">لم يتم توليد خطة تنفيذ بعد.</td></tr>'}</tbody></table></div>`;
}

function renderFeasibility() {
  const p = currentProject();
  if (!p) return '<section class="panel">اختر مشروعًا أولًا.</section>';
  const f = parseJson(p.financial_analysis, {});
  return `<section class="panel">${projectSelector()}<h2>دراسة الجدوى</h2><div class="report"><h3>الملخص التنفيذي</h3><p>${html(p.feasibility_summary || '-')}</p><h3>وصف المشروع</h3><p>${html(p.project_description || '-')}</p><h3>دراسة السوق</h3><p>${html(f.market_study || '-')}</p><h3>الدراسة الفنية</h3><p>${html(p.technical_scope || '-')}</p><h3>الدراسة التشغيلية</h3><p>${html(f.operational_study || '-')}</p><h3>الدراسة المالية</h3><div class="details-grid"><div><b>التكاليف الاستثمارية</b><span>${money(f.investment_costs, p.currency)}</span></div><div><b>المصاريف التشغيلية</b><span>${money(f.operating_expenses, p.currency)}</span></div><div><b>الإيرادات المتوقعة</b><span>${money(f.expected_revenue, p.currency)}</span></div><div><b>صافي الربح</b><span>${money(f.net_profit, p.currency)}</span></div><div><b>نقطة التعادل</b><span>${html(f.break_even || '-')}</span></div><div><b>فترة الاسترداد</b><span>${html(f.payback_period || '-')}</span></div></div><h3>المخاطر والتوصيات</h3><p>${html(f.recommendations || '-')}</p></div></section>`;
}

function renderCosts() {
  const p = currentProject();
  if (!p) return '<section class="panel">اختر مشروعًا أولًا.</section>';
  const centers = parseJson(p.cost_centers, []);
  const boq = parseJson(p.boq_items, []);
  const centerCards = centers.map((c) => `<article><span>${html(c.name)}</span><strong>${money(c.amount, p.currency)}</strong></article>`).join('');
  const rows = boq.map((b) => `<tr><td>${html(b.item)}</td><td>${html(b.unit)}</td><td>${html(b.quantity)}</td><td>${money(b.unit_cost, p.currency)}</td><td>${money(b.total_cost, p.currency)}</td></tr>`).join('');
  return `<section class="panel">${projectSelector()}<h2>التكاليف ومراكز التكلفة</h2><div class="cost-cards">${centerCards}</div><h3>جدول البنود والكميات الأولية</h3><div class="table-wrap"><table><thead><tr><th>البند</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لم يتم توليد بنود بعد.</td></tr>'}</tbody></table></div></section>`;
}

function renderRisks() {
  const p = currentProject();
  if (!p) return '<section class="panel">اختر مشروعًا أولًا.</section>';
  const risks = parseJson(p.risks, []);
  const cards = risks.map((r) => `<article><b>${html(r.title)}</b><span>${html(r.level)}</span><p>${html(r.mitigation)}</p></article>`).join('');
  return `<section class="panel">${projectSelector()}<h2>المخاطر</h2><div class="risk-grid">${cards || '<p class="muted">لا توجد مخاطر مسجلة.</p>'}</div></section>`;
}

function renderReports() {
  const p = currentProject();
  if (!p) return '<section class="panel">اختر مشروعًا أولًا.</section>';
  return `<section class="panel">${projectSelector()}<h2>التقارير والتصدير</h2><p>تصدير تقرير دراسة الجدوى، جدول الكميات، التكاليف، المخاطر، الجدول الزمني، ملخص المشروع، والعرض الاستثماري.</p><div class="export-grid"><button onclick="exportProject('doc')">Word</button><button onclick="exportProject('xls')">Excel</button><button onclick="exportProject('pdf')">PDF</button><button onclick="exportProject('ppt')">PowerPoint</button></div><pre class="report-preview">${html(buildReport(p))}</pre></section>`;
}

async function regenerateProject(id) {
  try {
    const updated = await api(`/api/projects/${id}/generate`, { method: 'POST' });
    state.projects = state.projects.map((p) => Number(p.id) === Number(id) ? updated : p);
    toast('تم توليد المشروع بالكامل وتحديث كل الوحدات');
    render();
  } catch (error) { toast(error.message, 'error'); }
}

function buildReport(p) {
  return `ملخص المشروع: ${p.project_name}\nالنوع: ${p.project_type}\nالموقع: ${p.location}\nالتكلفة التقديرية: ${money(p.total_estimated_cost, p.currency).replace(/&quot;/g, '"')}\n\nدراسة الجدوى:\n${p.feasibility_summary}\n\nالنطاق الفني:\n${p.technical_scope}\n\nالمخاطر:\n${parseJson(p.risks, []).map((r) => `- ${r.title}: ${r.mitigation}`).join('\n')}`;
}

function exportProject(format) {
  const p = currentProject();
  const content = buildReport(p);
  const mime = format === 'xls' ? 'application/vnd.ms-excel' : format === 'pdf' ? 'application/pdf' : format === 'ppt' ? 'application/vnd.ms-powerpoint' : 'application/msword';
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(p.project_name || 'project').replace(/[\\/:*?"<>|]/g, '-')}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`تم تجهيز ملف ${format.toUpperCase()} للتنزيل`);
}

window.addEventListener('hashchange', render);
if (token) loadProjects(); else renderLoginState();
