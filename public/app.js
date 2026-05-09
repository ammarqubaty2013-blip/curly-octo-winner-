let token = localStorage.getItem('erp_token') || '';
let dashboardCache = null;

function formatDate(value) {
  if (!value) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function statusLabel(status) {
  return {
    not_started: 'لم تبدأ',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتملة',
    delayed: 'متأخرة',
  }[status] || status || 'غير محدد';
}

function priorityLabel(priority) {
  return { urgent: 'عاجلة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }[priority] || priority || 'غير محددة';
}

function renderAiPlatformOverview(plan) {
  if (!plan) return;

  document.getElementById('aiPlatformName').textContent = plan.platformName;
  document.getElementById('aiPlatformDescription').textContent = `${plan.description} مع ربط دورة التطوير من التخطيط والبحث إلى الأتمتة وإدارة PMP ومراكز التكلفة.`;
  document.getElementById('aiPlatformStatus').innerHTML = `
    جميع المهام الأساسية في حالة <strong>${plan.status}</strong>، مع ${plan.urgent} مهام عاجلة تحتاج إلى بدء فوري وتوزيع واضح للمسؤوليات.
  `;

  const stats = [
    ['إجمالي المهام', plan.totalTasks],
    ['الأقسام', plan.sections],
    ['لم تبدأ', plan.notStarted],
    ['مهام عاجلة', plan.urgent],
    ['التكلفة المقدرة', money(plan.estimatedCost)],
  ];

  document.getElementById('aiProjectStats').innerHTML = stats
    .map(([label, value]) => `<div class="ai-stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');

  document.getElementById('urgentTasks').innerHTML = plan.urgentTasks
    .map((task) => `
      <li>
        <span>${task.title}</span>
        <small>${task.section} · ${priorityLabel(task.priority)} · ${statusLabel(task.status)}</small>
        <strong>استحقاق ${formatDate(task.due_date)}</strong>
      </li>
    `)
    .join('');

  document.getElementById('costCenters').innerHTML = plan.costCenters
    .map((task) => `<li><span>${task.title}</span><strong>${money(task.estimated_cost)}</strong></li>`)
    .join('');

  document.getElementById('aiFeatures').innerHTML = plan.features
    .map((feature) => `<li>${feature}</li>`)
    .join('');
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  token = data.token;
  localStorage.setItem('erp_token', token);
  await loadDashboard();
}

function money(value) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function renderKpis(kpis) {
  const items = [
    ['إجمالي المشاريع', kpis.totalProjects],
    ['المشاريع المتأخرة', kpis.delayedProjects],
    ['قيمة العقود', money(kpis.contractValue)],
    ['نسبة الإنجاز', `${kpis.averageProgress}%`],
    ['الإيرادات', money(kpis.revenue)],
    ['المصروفات', money(kpis.expenses)],
    ['الأرباح', money(kpis.profit)],
    ['مستخلصات معتمدة', kpis.approvedInvoices],
  ];
  document.getElementById('kpis').innerHTML = items.map(([label, value]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderProjects(projects) {
  document.getElementById('projectsTable').innerHTML = projects.map((p) => `
    <tr>
      <td><strong>${p.project_name}</strong></td>
      <td>${p.client_name || '-'}</td>
      <td>${money(p.contract_value)}</td>
      <td><div class="progress"><i style="width:${Number(p.progress || 0)}%"></i></div><small>${p.progress || 0}%</small></td>
      <td><span class="badge ${p.status === 'delayed' ? 'delayed' : ''}">${p.status === 'delayed' ? 'متأخر' : 'نشط'}</span></td>
    </tr>
  `).join('');
}

function renderCashFlow(ledger) {
  const max = Math.max(...ledger.map((x) => Math.abs(Number(x.amount || 0))), 1);
  document.getElementById('cashFlowBars').innerHTML = ledger.map((x) => {
    const height = Math.max(16, Math.round((Math.abs(Number(x.amount || 0)) / max) * 190));
    return `<div class="bar ${x.transaction_type === 'expense' ? 'expense' : ''}" style="height:${height}px"><small>${x.transaction_type === 'expense' ? 'مصروف' : 'إيراد'}</small></div>`;
  }).join('');
}

function renderProfit(kpis) {
  const margin = kpis.revenue ? Math.round((kpis.profit / kpis.revenue) * 100) : 0;
  document.getElementById('profitBox').innerHTML = `
    <div>الإيرادات: ${money(kpis.revenue)}</div>
    <div>المصروفات: ${money(kpis.expenses)}</div>
    <div>صافي الربح: <strong>${money(kpis.profit)}</strong></div>
    <div>هامش الربح: ${margin}%</div>
  `;
}

async function loadDashboard() {
  dashboardCache = await api('/api/dashboard');
  renderKpis(dashboardCache.kpis);
  renderProjects(dashboardCache.projects);
  renderCashFlow(dashboardCache.cashFlow);
  renderProfit(dashboardCache.kpis);
  renderAiPlatformOverview(dashboardCache.aiPlan);
}

async function createAiPlatformProject() {
  if (!token) {
    alert('سجّل الدخول أولًا لإنشاء مشروع من خطة الذكاء الاصطناعي.');
    return;
  }

  await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      project_name: 'منصة الذكاء الاصطناعي لدراسة المشاريع والمقاولات',
      client_name: 'مشروع داخلي',
      contract_value: dashboardCache?.aiPlan?.estimatedCost || 145000,
      start_date: '2026-05-20',
      end_date: '2026-12-31',
    }),
  });
  await loadDashboard();
}

async function createProject() {
  const index = Math.floor(Math.random() * 1000);
  await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      project_name: `مشروع جديد رقم ${index}`,
      client_name: 'عميل جديد',
      contract_value: 500000 + index * 1000,
      start_date: '2026-06-01',
      end_date: '2026-12-31',
    }),
  });
  await loadDashboard();
}

if (token) loadDashboard().catch(() => localStorage.removeItem('erp_token'));
