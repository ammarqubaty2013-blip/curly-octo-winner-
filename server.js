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
