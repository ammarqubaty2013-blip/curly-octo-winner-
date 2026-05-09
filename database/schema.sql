CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('general_manager','project_manager','accountant','site_engineer','procurement')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(180) NOT NULL,
  tax_number VARCHAR(80),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  project_name VARCHAR(220) NOT NULL,
  project_type VARCHAR(80),
  location VARCHAR(220),
  area NUMERIC(14,2) DEFAULT 0,
  duration VARCHAR(80),
  status VARCHAR(50) DEFAULT 'active',
  priority VARCHAR(50) DEFAULT 'medium',
  total_estimated_cost NUMERIC(14,2) DEFAULT 0,
  feasibility_summary TEXT,
  technical_scope TEXT,
  financial_analysis JSONB DEFAULT '{}'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  boq_items JSONB DEFAULT '[]'::jsonb,
  timeline JSONB DEFAULT '[]'::jsonb,
  cost_centers JSONB DEFAULT '[]'::jsonb,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  currency VARCHAR(20) DEFAULT 'ر.س',
  project_description TEXT,
  client_name VARCHAR(180),
  contract_value NUMERIC(14,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  progress NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(80);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location VARCHAR(220);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS area NUMERIC(14,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS duration VARCHAR(80);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_estimated_cost NUMERIC(14,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS feasibility_summary TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS technical_scope TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS financial_analysis JSONB DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS risks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boq_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_centers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency VARCHAR(20) DEFAULT 'ر.س';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_description TEXT;


CREATE TABLE IF NOT EXISTS boq_items (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_code VARCHAR(80),
  item_name TEXT NOT NULL,
  unit VARCHAR(40),
  quantity NUMERIC(14,3) DEFAULT 0,
  unit_cost NUMERIC(14,2) DEFAULT 0,
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  predecessor VARCHAR(120),
  budget NUMERIC(14,2) DEFAULT 0,
  progress NUMERIC(5,2) DEFAULT 0,
  planned_start DATE,
  planned_finish DATE,
  actual_start DATE,
  actual_finish DATE
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number VARCHAR(80) NOT NULL,
  amount NUMERIC(14,2) DEFAULT 0,
  retention NUMERIC(14,2) DEFAULT 0,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(40) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS variation_orders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost_impact NUMERIC(14,2) DEFAULT 0,
  time_impact INTEGER DEFAULT 0,
  status VARCHAR(40) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  supplier_name VARCHAR(180) NOT NULL,
  category VARCHAR(120),
  phone VARCHAR(60),
  address TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES suppliers(id),
  project_id INTEGER REFERENCES projects(id),
  po_number VARCHAR(80) NOT NULL,
  amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(40) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(180) NOT NULL,
  category VARCHAR(120),
  unit VARCHAR(40),
  available_qty NUMERIC(14,3) DEFAULT 0,
  min_qty NUMERIC(14,3) DEFAULT 0,
  unit_cost NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  equipment_name VARCHAR(180) NOT NULL,
  plate_number VARCHAR(80),
  status VARCHAR(50) DEFAULT 'available',
  daily_cost NUMERIC(14,2) DEFAULT 0,
  assigned_project_id INTEGER REFERENCES projects(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_name VARCHAR(180) NOT NULL,
  job_title VARCHAR(120),
  phone VARCHAR(60),
  salary NUMERIC(14,2) DEFAULT 0,
  assigned_project_id INTEGER REFERENCES projects(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('revenue','expense','asset','liability','equity')),
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity VARCHAR(120),
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_date ON projects(created_date);
CREATE INDEX IF NOT EXISTS idx_boq_project ON boq_items(project_id);
CREATE INDEX IF NOT EXISTS idx_ledger_project_type ON ledger(project_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
