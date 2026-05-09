import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const PUBLIC_DIR = join(process.cwd(), 'public');

const users = [
  { id: 1, name: 'Admin', email: 'admin@erp.local', password: 'admin123', role: 'general_manager' },
];

function loadEnvFile() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '');
  }
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(payload) {
  const body = base64url({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 });
  const signature = createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token) {
  try {
    if (!token || !token.includes('.')) return null;
    const [body, signature] = token.split('.');
    const expected = createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateProjectPlan(input = {}) {
  const projectName = sanitizeText(input.project_name) || 'مشروع مقاولات ذكي';
  const type = sanitizeText(input.project_type) || suggestType(projectName);
  const area = safeNumber(input.area, suggestArea(type));
  const duration = sanitizeText(input.duration) || `${Math.max(4, Math.ceil(area / 900))} شهر`;
  const currency = sanitizeText(input.currency) || 'ر.س';
  const unitBase = { مباني: 1850, طرق: 420, خزانات: 1250, هناجر: 780, مصانع: 1450, 'بنية تحتية': 620, توريدات: 350, صيانة: 220 }[type] || 850;
  const directCost = area * unitBase;
  const material = Math.round(directCost * 0.46);
  const labor = Math.round(directCost * 0.22);
  const equipment = Math.round(directCost * 0.12);
  const transport = Math.round(directCost * 0.05);
  const admin = Math.round(directCost * 0.06);
  const reserve = Math.round(directCost * 0.05);
  const profit = Math.round(directCost * 0.14);
  const total = material + labor + equipment + transport + admin + reserve + profit;
  const boqItems = buildBoq(type, area, unitBase);
  const timeline = buildTimeline(duration, type);
  const risks = buildRisks(type);
  const location = sanitizeText(input.location) || 'غير محدد';
  const brief = sanitizeText(input.brief);

  return {
    project_name: projectName,
    project_type: type,
    location,
    area,
    duration,
    currency,
    status: sanitizeText(input.status) || 'active',
    priority: sanitizeText(input.priority) || 'high',
    total_estimated_cost: total,
    project_description: `مشروع ${type} باسم ${projectName} في ${location} بمساحة تقديرية ${area} م² ومدة تنفيذ ${duration}. ${brief}`.trim(),
    feasibility_summary: `تشير الدراسة الأولية إلى جدوى تنفيذ ${projectName} بشرط ضبط تكاليف المواد والتوريد ومراقبة البرنامج الزمني. التكلفة التقديرية ${total.toLocaleString('ar-EG')} ${currency} مع هامش ربح مستهدف يقارب 14%.`,
    technical_scope: 'يشمل نطاق العمل أعمال التصميم/المراجعة، التجهيزات، الأعمال المدنية، التوريدات، التنفيذ، اختبارات الجودة، التسليم الابتدائي والنهائي، وإدارة السلامة وفق خطة PMP مترابطة مع مراكز التكلفة.',
    financial_analysis: {
      market_study: `الطلب على مشاريع ${type} مستقر مع حساسية واضحة لأسعار المواد وسلاسل الإمداد، ويوصى بتأمين عروض أسعار مبكرة ومقارنة الموردين.`,
      operational_study: 'يعتمد التشغيل على مدير مشروع، مهندس موقع، مسؤول مشتريات، مراقب جودة، وفريق سلامة مع تقارير إنجاز أسبوعية.',
      investment_costs: total,
      operating_expenses: Math.round(total * 0.08),
      expected_revenue: Math.round(total * 1.22),
      net_profit: Math.round(total * 0.14),
      break_even: 'نحو 68% من قيمة الأعمال المعتمدة',
      payback_period: 'من 18 إلى 30 شهرًا حسب التدفقات النقدية',
      recommendations: 'تثبيت أسعار البنود الحرجة، اعتماد احتياطي مخاطر، وربط الصرف بنسبة الإنجاز والمستخلصات المعتمدة.',
    },
    risks,
    boq_items: boqItems,
    timeline,
    cost_centers: [
      { name: 'تكلفة المواد', amount: material },
      { name: 'تكلفة العمالة', amount: labor },
      { name: 'تكلفة المعدات', amount: equipment },
      { name: 'تكلفة النقل', amount: transport },
      { name: 'المصاريف الإدارية', amount: admin },
      { name: 'الاحتياطي', amount: reserve },
      { name: 'هامش الربح', amount: profit },
      { name: 'إجمالي التكلفة', amount: total },
    ],
  };
}

function sanitizeText(value) {
  return String(value || '').replace(/[<>]/g, '').trim();
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function suggestType(name = '') {
  if (/طريق|طرق|سفلت/.test(name)) return 'طرق';
  if (/خزان|مياه/.test(name)) return 'خزانات';
  if (/هنجر|مستودع/.test(name)) return 'هناجر';
  if (/مصنع|إنتاج/.test(name)) return 'مصانع';
  if (/بنية|شبكات|صرف/.test(name)) return 'بنية تحتية';
  if (/توريد/.test(name)) return 'توريدات';
  if (/صيانة/.test(name)) return 'صيانة';
  return 'مباني';
}

function suggestArea(type) {
  return { مباني: 2400, طرق: 12000, خزانات: 1800, هناجر: 3200, مصانع: 5200, 'بنية تحتية': 9000, توريدات: 1500, صيانة: 2200 }[type] || 2500;
}

function buildBoq(type, area, unitBase) {
  const items = [
    ['تجهيز الموقع والأعمال التحضيرية', 'مقطوعية', 1, Math.round(area * unitBase * 0.04)],
    ['أعمال الحفر والردم', 'م3', Math.round(area * 0.8), Math.round(unitBase * 0.09)],
    ['أعمال الخرسانة/الأساسات', 'م3', Math.round(area * 0.22), Math.round(unitBase * 0.75)],
    ['أعمال الهيكل أو الطبقات الرئيسية', 'م2', area, Math.round(unitBase * 0.34)],
    ['الأعمال الكهربائية والميكانيكية', 'م2', area, Math.round(unitBase * 0.18)],
    ['اختبارات الجودة والتسليم', 'مقطوعية', 1, Math.round(area * unitBase * 0.03)],
  ];
  if (type === 'طرق') items[3] = ['طبقات الرصف والأسفلت', 'م2', area, Math.round(unitBase * 0.46)];
  if (type === 'توريدات') items[3] = ['توريد وتركيب البنود الرئيسية', 'مقطوعية', 1, Math.round(area * unitBase * 0.52)];
  return items.map(([item, unit, quantity, unit_cost]) => ({ item, unit, quantity, unit_cost, total_cost: Number(quantity) * Number(unit_cost) }));
}

function buildTimeline(duration, type) {
  const totalMonths = Number(String(duration).match(/\d+/)?.[0] || 8);
  const tasks = ['البدء والتخطيط', 'التصميم واعتماد المخططات', 'المشتريات والتعاقدات', 'التنفيذ الرئيسي', 'الفحص والجودة', 'التسليم والإغلاق'];
  return tasks.map((task, index) => ({
    task: `${task} - ${type}`,
    duration: `${Math.max(1, Math.ceil(totalMonths * [0.08, 0.14, 0.16, 0.48, 0.09, 0.05][index]))} شهر`,
    progress: index === 0 ? 10 : 0,
    owner: ['مدير المشروع', 'المكتب الفني', 'المشتريات', 'مدير التنفيذ', 'ضبط الجودة', 'مدير المشروع'][index],
    status: index === 0 ? 'قيد التنفيذ' : 'لم تبدأ',
    priority: index < 3 ? 'عالية' : 'متوسطة',
    risks: index === 3 ? 'تأخر توريدات أو نقص عمالة' : 'ضمن السيطرة',
  }));
}

function buildRisks(type) {
  return [
    { title: 'تقلب أسعار المواد', level: 'عالية', mitigation: 'تثبيت عروض الموردين وإضافة بند احتياطي وتصعيد سعري عند الحاجة.' },
    { title: 'تأخر الاعتمادات أو التصاريح', level: 'متوسطة', mitigation: 'إنشاء سجل اعتماد ومتابعة أسبوعية مع المالك والاستشاري.' },
    { title: `مخاطر فنية في مشاريع ${type}`, level: 'متوسطة', mitigation: 'مراجعة التصميمات ورفع طلبات المعلومات قبل التنفيذ.' },
    { title: 'السلامة والجودة', level: 'متوسطة', mitigation: 'تطبيق خطة HSE وفحوصات جودة مرحلية قبل إغلاق البنود.' },
  ];
}

const demoData = {
  projects: [
    { id: 1, created_date: '2026-05-01', ...generateProjectPlan({ project_name: 'مشروع مبنى إداري', project_type: 'مباني', location: 'الرياض', area: 2400, duration: '12 شهر' }) },
    { id: 2, created_date: '2026-05-02', ...generateProjectPlan({ project_name: 'مشروع خزانات مياه', project_type: 'خزانات', location: 'جدة', area: 1800, duration: '8 أشهر', status: 'delayed' }) },
  ],
  ledger: [
    { id: 1, transaction_type: 'revenue', description: 'دفعة مستخلص', amount: 250000, created_at: '2026-05-01' },
    { id: 2, transaction_type: 'expense', description: 'مواد بناء', amount: 95000, created_at: '2026-05-02' },
  ],
};

function normalizeProject(row) {
  return {
    ...row,
    risks: parseMaybeJson(row.risks, []),
    boq_items: parseMaybeJson(row.boq_items, []),
    timeline: parseMaybeJson(row.timeline, []),
    cost_centers: parseMaybeJson(row.cost_centers, []),
    financial_analysis: parseMaybeJson(row.financial_analysis, {}),
    total_estimated_cost: Number(row.total_estimated_cost || row.contract_value || 0),
  };
}

function parseMaybeJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function getAuthUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return verify(token);
}

function requireAuth(req, res, roles = []) {
  const user = getAuthUser(req);
  if (!user) {
    json(res, 401, { error: 'Unauthorized' });
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    json(res, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, system: 'AI Construction Feasibility Platform', mode: 'demo' });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const { email, password } = await readJson(req);
    const user = users.find((item) => item.email === email);
    if (!user || user.password !== password) return json(res, 401, { error: 'Invalid email or password' });
    const token = sign({ id: user.id, name: user.name, email: user.email, role: user.role });
    return json(res, 200, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    if (!requireAuth(req, res)) return;
    const projects = demoData.projects.map(normalizeProject);
    const revenue = demoData.ledger.filter((x) => x.transaction_type === 'revenue').reduce((sum, x) => sum + Number(x.amount), 0);
    const expenses = demoData.ledger.filter((x) => x.transaction_type === 'expense').reduce((sum, x) => sum + Number(x.amount), 0);
    return json(res, 200, {
      kpis: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === 'active').length,
        delayedProjects: projects.filter((p) => ['delayed', 'high_risk'].includes(p.status)).length,
        contractValue: projects.reduce((sum, p) => sum + Number(p.total_estimated_cost || 0), 0),
        revenue,
        expenses,
        profit: revenue - expenses,
      },
      projects,
      cashFlow: demoData.ledger,
    });
  }

  if (req.method === 'GET' && pathname === '/api/projects') {
    if (!requireAuth(req, res)) return;
    return json(res, 200, demoData.projects.map(normalizeProject));
  }

  if (req.method === 'POST' && pathname === '/api/projects') {
    if (!requireAuth(req, res, ['general_manager', 'project_manager'])) return;
    const payload = await readJson(req);
    if (!sanitizeText(payload.project_name)) return json(res, 400, { error: 'project_name is required' });
    const project = { id: Date.now(), created_date: new Date().toISOString(), ...generateProjectPlan(payload) };
    demoData.projects.unshift(project);
    return json(res, 201, normalizeProject(project));
  }

  const projectMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
  if (req.method === 'GET' && projectMatch) {
    if (!requireAuth(req, res)) return;
    const project = demoData.projects.find((item) => item.id === Number(projectMatch[1]));
    if (!project) return json(res, 404, { error: 'Project not found' });
    return json(res, 200, normalizeProject(project));
  }

  const generateMatch = pathname.match(/^\/api\/projects\/(\d+)\/generate$/);
  if (req.method === 'POST' && generateMatch) {
    if (!requireAuth(req, res, ['general_manager', 'project_manager'])) return;
    const projectId = Number(generateMatch[1]);
    const current = demoData.projects.find((item) => item.id === projectId);
    if (!current) return json(res, 404, { error: 'Project not found' });
    const payload = await readJson(req);
    const updated = { ...current, ...generateProjectPlan({ ...current, ...payload }) };
    demoData.projects = demoData.projects.map((item) => item.id === projectId ? updated : item);
    return json(res, 200, normalizeProject(updated));
  }

  const boqMatch = pathname.match(/^\/api\/projects\/(\d+)\/boq$/);
  if (req.method === 'GET' && boqMatch) {
    if (!requireAuth(req, res)) return;
    const project = demoData.projects.find((item) => item.id === Number(boqMatch[1]));
    return json(res, 200, project?.boq_items || []);
  }

  if (req.method === 'GET' && pathname === '/api/finance/pnl') {
    if (!requireAuth(req, res, ['general_manager', 'accountant'])) return;
    const revenue = demoData.ledger.filter((x) => x.transaction_type === 'revenue').reduce((sum, x) => sum + Number(x.amount), 0);
    const expenses = demoData.ledger.filter((x) => x.transaction_type === 'expense').reduce((sum, x) => sum + Number(x.amount), 0);
    return json(res, 200, { revenue, expenses, grossProfit: revenue - expenses, margin: revenue ? Math.round(((revenue - expenses) / revenue) * 100) : 0, ledger: demoData.ledger });
  }

  return json(res, 404, { error: 'Not found' });
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
  try {
    const file = await readFile(filePath);
    const type = mimeType(extname(filePath));
    res.writeHead(200, { 'Content-Type': type });
    res.end(file);
  } catch {
    const index = await readFile(join(PUBLIC_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(index);
  }
}

function mimeType(extension) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.png': 'image/png',
  }[extension] || 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname);
    return await serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || 'Server error' });
  }
});

server.listen(PORT, () => console.log(`AI Construction Feasibility Platform running on port ${PORT}`));
