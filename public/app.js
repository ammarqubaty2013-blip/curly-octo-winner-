let token = localStorage.getItem('erp_token') || '';
let dashboardCache = null;

const fashionStudioProfile = {
  suggestedIndicator: 'مركز إبداع لصناعة الأزياء والتطريز الحديث',
  sector: 'النسيج والملابس',
  projectType: 'وحدة إنتاجية مصغرة',
  capital: 2000,
  fixedAssets: 1700,
  workingCapital: 300,
  gracePeriod: '3 أشهر',
  repaymentPeriod: '20 شهراً',
  monthlyInstallment: 100,
  totalRepayment: 2000,
  targetProfitMargin: '25–35% صافي عند استقرار التشغيل',
  directJobs: '2–4',
  indirectJobs: '2–5',
  capitalTurnover: 'عالية',
  riskLevel: 'منخفض–متوسط',
  collateral: 'المعدات + عقد التمويل + كفالة/ضمان اجتماعي حسب نظام الصندوق',
  developmentSavings: '10% من صافي الأرباح',
  targetMarket: 'صنعاء ثم المحافظات والأسواق الرقمية',
  competitiveAdvantage: 'دمج التراث الصنعاني مع التصميم العصري',
  nextSteps: [
    'تجهيز هوية بصرية وكتالوج أولي للتصاميم الصنعانية الحديثة',
    'توقيع عقود توريد خامات صغيرة لتقليل المخزون الراكد',
    'إطلاق قناة بيع رقمية للطلبات حسب المقاس والمناسبات',
  ],
  monitoringIndicators: [
    'عدد القطع المنتجة والمباعة شهرياً',
    'نسبة الالتزام بالقسط الشهري خلال فترة السداد',
    'قيمة الادخار التطويري المتراكمة من صافي الأرباح',
  ],
};

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

function percent(part, total) {
  return total ? Math.round((Number(part || 0) / Number(total)) * 100) : 0;
}

function renderList(items) {
  return items.map((item) => `<li>${item}</li>`).join('');
}

function renderFashionStudioProfile() {
  const target = document.getElementById('fashionStudioProfile');
  if (!target) return;

  const fixedAssetsShare = percent(fashionStudioProfile.fixedAssets, fashionStudioProfile.capital);
  const workingCapitalShare = percent(fashionStudioProfile.workingCapital, fashionStudioProfile.capital);
  const financeItems = [
    ['رأس المال/القرض', `$${money(fashionStudioProfile.capital)}`],
    ['الأصول الثابتة', `$${money(fashionStudioProfile.fixedAssets)}`],
    ['رأس المال التشغيلي', `$${money(fashionStudioProfile.workingCapital)}`],
    ['القسط الشهري', `$${money(fashionStudioProfile.monthlyInstallment)}`],
  ];
  const detailItems = [
    ['القطاع', fashionStudioProfile.sector],
    ['نوع المشروع', fashionStudioProfile.projectType],
    ['فترة السماح', fashionStudioProfile.gracePeriod],
    ['مدة السداد', fashionStudioProfile.repaymentPeriod],
    ['إجمالي السداد', `$${money(fashionStudioProfile.totalRepayment)}`],
    ['هامش الربح المستهدف', fashionStudioProfile.targetProfitMargin],
    ['الوظائف المباشرة', fashionStudioProfile.directJobs],
    ['الوظائف غير المباشرة', fashionStudioProfile.indirectJobs],
    ['سرعة دوران رأس المال', fashionStudioProfile.capitalTurnover],
    ['مستوى المخاطر', fashionStudioProfile.riskLevel],
    ['الضمان الأساسي', fashionStudioProfile.collateral],
    ['نسبة الادخار التطويري', fashionStudioProfile.developmentSavings],
    ['السوق المستهدف', fashionStudioProfile.targetMarket],
    ['ميزة تنافسية', fashionStudioProfile.competitiveAdvantage],
  ];

  target.innerHTML = `
    <div class="profile-hero">
      <div>
        <span class="eyebrow">المؤشر المقترح</span>
        <h2>${fashionStudioProfile.suggestedIndicator}</h2>
        <p>${fashionStudioProfile.competitiveAdvantage}</p>
      </div>
      <div class="risk-pill">${fashionStudioProfile.riskLevel}</div>
    </div>
    <div class="allocation" aria-label="توزيع رأس المال">
      <span style="width:${fixedAssetsShare}%">الأصول ${fixedAssetsShare}%</span>
      <span style="width:${workingCapitalShare}%">تشغيلي ${workingCapitalShare}%</span>
    </div>
    <div class="finance-strip">
      ${financeItems.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}
    </div>
    <div class="profile-grid">
      ${detailItems.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}
    </div>
    <div class="profile-actions">
      <div>
        <h3>خطوات التنفيذ المقترحة</h3>
        <ul>${renderList(fashionStudioProfile.nextSteps)}</ul>
      </div>
      <div>
        <h3>مؤشرات المتابعة</h3>
        <ul>${renderList(fashionStudioProfile.monitoringIndicators)}</ul>
      </div>
    </div>
  `;
}

async function loadDashboard() {
  dashboardCache = await api('/api/dashboard');
  renderKpis(dashboardCache.kpis);
  renderProjects(dashboardCache.projects);
  renderCashFlow(dashboardCache.cashFlow);
  renderProfit(dashboardCache.kpis);
  renderFashionStudioProfile();
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

renderFashionStudioProfile();
if (token) loadDashboard().catch(() => localStorage.removeItem('erp_token'));
