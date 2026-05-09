import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const demo = process.env.DEMO_MODE !== 'false';

const demoData = {
  users: [
    { id: 1, name: 'Admin', email: 'admin@erp.local', password: bcrypt.hashSync('admin123', 10), role: 'general_manager' },
  ],
  projects: [
    { id: 1, project_name: 'مشروع مبنى إداري', client_name: 'شركة تجريبية', contract_value: 2500000, start_date: '2026-01-01', end_date: '2026-12-31', progress: 42, status: 'active' },
    { id: 2, project_name: 'مشروع خزانات مياه', client_name: 'جهة حكومية', contract_value: 1200000, start_date: '2026-02-01', end_date: '2026-09-30', progress: 63, status: 'delayed' },
  ],
  boq_items: [
    { id: 1, project_id: 1, item_name: 'أعمال الحفر', unit: 'م3', quantity: 1200, unit_cost: 8, total_cost: 9600 },
    { id: 2, project_id: 1, item_name: 'خرسانة مسلحة', unit: 'م3', quantity: 500, unit_cost: 140, total_cost: 70000 },
  ],
  invoices: [
    { id: 1, project_id: 1, invoice_number: 'INV-001', amount: 300000, retention: 15000, paid_amount: 250000, status: 'approved' },
    { id: 2, project_id: 2, invoice_number: 'INV-002', amount: 180000, retention: 9000, paid_amount: 0, status: 'pending' },
  ],
  ledger: [
    { id: 1, transaction_type: 'revenue', description: 'دفعة مستخلص', amount: 250000, created_at: '2026-05-01' },
    { id: 2, transaction_type: 'expense', description: 'مواد بناء', amount: 95000, created_at: '2026-05-02' },
  ],
  aiRoadmap: {
    platformName: 'منصة الذكاء الاصطناعي لدراسة المشاريع والمقاولات',
    description: 'منصة مدعومة بالذكاء الاصطناعي لتحليل مشاريع المقاولات وإعداد دراسات الجدوى الاقتصادية والفنية تلقائيًا.',
    totalTasks: 31,
    sections: 12,
    status: 'لم تبدأ',
  },
  aiTasks: [
    { id: 1, section: 'التخطيط', title: 'تحديد متطلبات المنصة والميزات الأساسية', priority: 'urgent', status: 'not_started', due_date: '2026-05-20', assignee: null, estimated_cost: 0 },
    { id: 2, section: 'البحث', title: 'بحث تقنيات الذكاء الاصطناعي المناسبة', priority: 'urgent', status: 'not_started', due_date: '2026-05-25', assignee: null, estimated_cost: 0 },
    { id: 3, section: 'النمذجة', title: 'تطوير نموذج الذكاء الاصطناعي لتحليل التكاليف', priority: 'urgent', status: 'not_started', due_date: '2026-07-15', assignee: null, estimated_cost: 50000 },
    { id: 4, section: 'الأتمتة', title: 'أتمتة دراسات الجدوى الاقتصادية والفنية', priority: 'high', status: 'not_started', due_date: '2026-08-01', assignee: null, estimated_cost: 35000 },
    { id: 5, section: 'المخاطر', title: 'تطوير وحدة تقييم المخاطر', priority: 'high', status: 'not_started', due_date: '2026-08-15', assignee: null, estimated_cost: 25000 },
    { id: 6, section: 'البيانات', title: 'تصميم قاعدة بيانات المشاريع ومراكز التكلفة', priority: 'urgent', status: 'not_started', due_date: '2026-06-10', assignee: null, estimated_cost: 20000 },
    { id: 7, section: 'تجربة المستخدم', title: 'تصميم واجهة المستخدم وتجربة ضغطة زر واحدة', priority: 'high', status: 'not_started', due_date: '2026-06-20', assignee: null, estimated_cost: 15000 },
  ],
  aiFeatures: [
    'محرك توليد المشاريع التلقائي',
    'نظام التكامل بين الوحدات',
    'توليد التقارير التلقائي',
    'واجهة ضغطة زر واحدة لإنشاء المشروع بالكامل',
  ],
};

function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = jwt.verify(token, JWT_SECRET);
      if (requiredRoles.length && !requiredRoles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

async function dbQuery(sql, params = []) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const result = await pool.query(sql, params);
  return result.rows;
}

function buildAiPlan(tasks, features, roadmap = demoData.aiRoadmap) {
  const notStarted = tasks.filter((task) => task.status === 'not_started').length;
  const urgentTasks = tasks.filter((task) => task.priority === 'urgent');
  const estimatedCost = tasks.reduce((sum, task) => sum + Number(task.estimated_cost || 0), 0);

  return {
    ...roadmap,
    totalTasks: Number(roadmap.totalTasks || tasks.length),
    sections: Number(roadmap.sections || new Set(tasks.map((task) => task.section)).size),
    notStarted,
    urgent: urgentTasks.length,
    estimatedCost,
    urgentTasks: urgentTasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 5),
    costCenters: tasks
      .filter((task) => Number(task.estimated_cost || 0) > 0)
      .sort((a, b) => Number(b.estimated_cost || 0) - Number(a.estimated_cost || 0)),
    features,
  };
}

async function loadAiPlan() {
  if (!process.env.DATABASE_URL) {
    return buildAiPlan(demoData.aiTasks, demoData.aiFeatures);
  }

  const tasks = await dbQuery('SELECT * FROM ai_platform_tasks ORDER BY due_date ASC, id ASC');
  const features = (await dbQuery('SELECT feature_name FROM ai_platform_features ORDER BY sort_order ASC, id ASC')).map((feature) => feature.feature_name);

  return buildAiPlan(tasks, features, {
    platformName: 'منصة الذكاء الاصطناعي لدراسة المشاريع والمقاولات',
    description: 'منصة مدعومة بالذكاء الاصطناعي لتحليل مشاريع المقاولات وإعداد دراسات الجدوى الاقتصادية والفنية تلقائيًا.',
    totalTasks: tasks.length,
    sections: new Set(tasks.map((task) => task.section)).size,
    status: tasks.some((task) => task.status !== 'not_started') ? 'قيد التنفيذ' : 'لم تبدأ',
  });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, system: 'Construction ERP', mode: process.env.DATABASE_URL ? 'database' : 'demo' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  let user;
  if (demo && !process.env.DATABASE_URL) {
    user = demoData.users.find((u) => u.email === email);
  } else {
    const rows = await dbQuery('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    user = rows[0];
  }
  if (!user || !bcrypt.compareSync(password || '', user.password)) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/dashboard', auth(), async (req, res) => {
  const projects = process.env.DATABASE_URL ? await dbQuery('SELECT * FROM projects ORDER BY id DESC') : demoData.projects;
  const invoices = process.env.DATABASE_URL ? await dbQuery('SELECT * FROM invoices ORDER BY id DESC') : demoData.invoices;
  const ledger = process.env.DATABASE_URL ? await dbQuery('SELECT * FROM ledger ORDER BY id DESC') : demoData.ledger;
  const aiPlan = await loadAiPlan();

  const revenue = ledger.filter((x) => x.transaction_type === 'revenue').reduce((s, x) => s + Number(x.amount), 0);
  const expenses = ledger.filter((x) => x.transaction_type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
  const contractValue = projects.reduce((s, p) => s + Number(p.contract_value || 0), 0);

  res.json({
    kpis: {
      totalProjects: projects.length,
      delayedProjects: projects.filter((p) => p.status === 'delayed').length,
      contractValue,
      revenue,
      expenses,
      profit: revenue - expenses,
      approvedInvoices: invoices.filter((i) => i.status === 'approved').length,
      averageProgress: Math.round(projects.reduce((s, p) => s + Number(p.progress || 0), 0) / Math.max(projects.length, 1)),
    },
    projects,
    invoices,
    cashFlow: ledger,
    aiPlan,
  });
});

app.get('/api/projects', auth(), async (req, res) => {
  const rows = process.env.DATABASE_URL ? await dbQuery('SELECT * FROM projects ORDER BY id DESC') : demoData.projects;
  res.json(rows);
});

app.post('/api/projects', auth(['general_manager', 'project_manager']), async (req, res) => {
  const { project_name, client_name, contract_value, start_date, end_date } = req.body;
  if (!project_name) return res.status(400).json({ error: 'project_name is required' });
  if (!process.env.DATABASE_URL) {
    const item = { id: Date.now(), project_name, client_name, contract_value: Number(contract_value || 0), start_date, end_date, progress: 0, status: 'active' };
    demoData.projects.unshift(item);
    return res.status(201).json(item);
  }
  const rows = await dbQuery(
    'INSERT INTO projects(project_name, client_name, contract_value, start_date, end_date, progress, status) VALUES($1,$2,$3,$4,$5,0,$6) RETURNING *',
    [project_name, client_name, contract_value || 0, start_date || null, end_date || null, 'active']
  );
  res.status(201).json(rows[0]);
});

app.get('/api/projects/:id/boq', auth(), async (req, res) => {
  const projectId = Number(req.params.id);
  const rows = process.env.DATABASE_URL ? await dbQuery('SELECT * FROM boq_items WHERE project_id = $1 ORDER BY id DESC', [projectId]) : demoData.boq_items.filter((x) => x.project_id === projectId);
  res.json(rows);
});

app.get('/api/finance/pnl', auth(['general_manager', 'accountant']), async (req, res) => {
  const ledger = process.env.DATABASE_URL ? await dbQuery('SELECT * FROM ledger ORDER BY created_at DESC') : demoData.ledger;
  const revenue = ledger.filter((x) => x.transaction_type === 'revenue').reduce((s, x) => s + Number(x.amount), 0);
  const expenses = ledger.filter((x) => x.transaction_type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
  res.json({ revenue, expenses, grossProfit: revenue - expenses, margin: revenue ? Math.round(((revenue - expenses) / revenue) * 100) : 0, ledger });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => console.log(`Construction ERP running on port ${PORT}`));
