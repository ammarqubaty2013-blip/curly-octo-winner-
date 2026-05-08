# Construction ERP Roadmap

## الهدف
تحويل فكرة ERP المقاولات إلى نظام احترافي لإدارة المشاريع، الكميات، العقود، المستخلصات، الموردين، المخزون، المعدات، الموظفين، المالية، Cash Flow، P&L، وKPI Analytics.

## ما تم إنشاؤه

### 1. Backend
- Node.js + Express.
- JWT Authentication.
- Role based access control.
- APIs أولية:
  - `/api/auth/login`
  - `/api/dashboard`
  - `/api/projects`
  - `/api/projects/:id/boq`
  - `/api/finance/pnl`

### 2. Frontend
- واجهة عربية RTL.
- لوحة مؤشرات KPI.
- جدول مشاريع.
- عرض Cash Flow مبسط.
- عرض ملخص الربحية.

### 3. Database
- PostgreSQL schema كامل يشمل:
  - users
  - companies
  - projects
  - boq_items
  - activities
  - invoices
  - variation_orders
  - suppliers
  - purchase_orders
  - inventory_items
  - equipment
  - employees
  - ledger
  - audit_logs

## طريقة التشغيل

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:3000
```

بيانات الدخول التجريبية:

```text
admin@erp.local
admin123
```

## وضع التشغيل الحالي
النظام يعمل حاليًا في Demo Mode إذا لم يتم ضبط `DATABASE_URL`.
هذا يسمح بتجربة الواجهة والـ APIs مباشرة بدون قاعدة بيانات.

## المرحلة التالية المقترحة

### المرحلة 1: تثبيت الأساس
- إضافة CRUD كامل للمشاريع.
- إضافة CRUD كامل للكميات BOQ.
- إضافة CRUD للموردين والمخزون.
- تحسين شاشة إضافة مشروع بدل الإضافة التجريبية.

### المرحلة 2: المالية
- المستخلصات.
- المصروفات.
- الإيرادات.
- P&L.
- Cash Flow شهري.
- Retention وAdvance Payment.

### المرحلة 3: الجدولة
- WBS.
- Activities.
- Auto CPM.
- Critical Path.
- Delay Analysis.

### المرحلة 4: التقارير
- PDF Export.
- Excel Export.
- BOQ Report.
- Project Status Report.
- Financial Report.

### المرحلة 5: الذكاء والتحليل
- Auto Pricing.
- Supplier Comparison.
- Earned Value Management.
- Forecasting.
- KPI Analytics.

## الأدوار
- general_manager: صلاحية كاملة.
- project_manager: المشاريع والجدولة والمستخلصات.
- accountant: المالية والتقارير.
- site_engineer: نسب الإنجاز والتقارير اليومية.
- procurement: الموردين والمخزون وأوامر الشراء.
