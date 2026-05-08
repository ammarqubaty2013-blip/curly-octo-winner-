const KEY = 'construction_erp_canvas_v3';
const empty = { projects: [], boq: [], ledger: [], suppliers: [], inventory: [] };
let state = load();
let edit = { type: null, id: null };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || structuredClone(empty); }
  catch { return structuredClone(empty); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function id() { return Date.now() + Math.floor(Math.random() * 9999); }
function val(id) { return document.getElementById(id).value; }
function setv(id, value) { document.getElementById(id).value = value ?? ''; }
function money(value) { return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value || 0)); }
function norm(value) { return String(value || '').toLowerCase(); }
function match(obj, query) { query = norm(query); return !query || Object.values(obj).some(v => norm(v).includes(query)); }
function pName(pid) { return state.projects.find(p => String(p.id) === String(pid))?.name || 'عام'; }
function sum(type) { return state.ledger.filter(x => x.type === type).reduce((s, x) => s + Number(x.amount || 0), 0); }
function statusLabel(s) { return s === 'delayed' ? 'متأخر' : s === 'completed' ? 'مكتمل' : 'نشط'; }

function seedData() {
  state = {
    projects: [
      { id: id(), name: 'مشروع مبنى إداري', client: 'شركة تجريبية', value: 2500000, progress: 42, start: '2026-05-01', status: 'active' },
      { id: id(), name: 'مشروع خزانات مياه', client: 'جهة حكومية', value: 1200000, progress: 63, start: '2026-04-10', status: 'delayed' },
      { id: id(), name: 'مشروع هناجر ومخازن', client: 'مستثمر خاص', value: 1800000, progress: 25, start: '2026-06-01', status: 'active' }
    ], boq: [], ledger: [], suppliers: [], inventory: []
  };
  state.boq = [
    { id: id(), project: state.projects[0].id, item: 'أعمال الحفر', unit: 'م3', qty: 1200, cost: 8 },
    { id: id(), project: state.projects[0].id, item: 'خرسانة مسلحة', unit: 'م3', qty: 500, cost: 140 },
    { id: id(), project: state.projects[1].id, item: 'عزل مائي', unit: 'م2', qty: 900, cost: 12 }
  ];
  state.ledger = [
    { id: id(), type: 'revenue', project: state.projects[0].id, desc: 'دفعة مستخلص', amount: 250000, date: '2026-05-01' },
    { id: id(), type: 'expense', project: state.projects[0].id, desc: 'مواد بناء', amount: 95000, date: '2026-05-02' },
    { id: id(), type: 'expense', project: state.projects[1].id, desc: 'أجور عمالة', amount: 42000, date: '2026-05-04' },
    { id: id(), type: 'revenue', project: state.projects[1].id, desc: 'دفعة عميل', amount: 180000, date: '2026-05-06' }
  ];
  state.suppliers = [{ id: id(), name: 'مورد الخرسانة', cat: 'خرسانة', phone: '0910000000', address: 'أديس أبابا' }];
  state.inventory = [
    { id: id(), name: 'حديد تسليح', unit: 'طن', qty: 35, min: 10, cost: 820 },
    { id: id(), name: 'اسمنت', unit: 'كيس', qty: 600, min: 150, cost: 8 }
  ];
  save(); render(); toast('تم توليد البيانات وحفظها');
}

function render() { renderSelects(); renderKpis(); renderProjects(); renderBoq(); renderFinance(); renderSuppliers(); renderInventory(); renderReports(); }
function renderSelects() {
  const opts = '<option value="">عام</option>' + state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  ['bProject', 'lProject'].forEach(x => { const el = document.getElementById(x); if (el) el.innerHTML = opts; });
}
function renderKpis() {
  const revenue = sum('revenue'), expense = sum('expense');
  const contract = state.projects.reduce((s, p) => s + Number(p.value || 0), 0);
  const avg = Math.round(state.projects.reduce((s, p) => s + Number(p.progress || 0), 0) / Math.max(1, state.projects.length));
  const kpis = [['إجمالي المشاريع', state.projects.length], ['المتأخرة', state.projects.filter(p => p.status === 'delayed').length], ['قيمة العقود', money(contract)], ['متوسط الإنجاز', avg + '%'], ['الإيرادات', money(revenue)], ['المصروفات', money(expense)], ['صافي الربح', money(revenue - expense)], ['مواد مخزون', state.inventory.length]];
  document.getElementById('kpis').innerHTML = kpis.map(x => `<div class="card kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  const max = Math.max(1, ...state.ledger.map(x => Math.abs(Number(x.amount || 0))));
  document.getElementById('bars').innerHTML = state.ledger.map(x => `<div class="bar ${x.type === 'expense' ? 'exp' : ''}" style="height:${Math.max(15, Math.round(Math.abs(x.amount) / max * 185))}px"><small>${x.type === 'expense' ? 'مصروف' : 'إيراد'}</small></div>`).join('') || '<div class="empty">لا توجد حركات مالية</div>';
  document.getElementById('profit').innerHTML = `<p>الإيرادات: <b>${money(revenue)}</b></p><p>المصروفات: <b>${money(expense)}</b></p><p>صافي الربح: <b>${money(revenue - expense)}</b></p><p>هامش الربح: <b>${revenue ? Math.round((revenue - expense) / revenue * 100) : 0}%</b></p>`;
}
function projectRow(p, actions = true) {
  return `<tr><td><b>${p.name}</b></td><td>${p.client || '-'}</td><td>${money(p.value)}</td><td><div class="progress"><i style="width:${Number(p.progress || 0)}%"></i></div>${p.progress || 0}%</td><td><span class="badge ${p.status === 'delayed' ? 'delay' : ''}">${statusLabel(p.status)}</span></td>${actions ? `<td><div class="rowbtn"><button class="btn blue" onclick="editProject(${p.id})">تعديل</button><button class="btn red" onclick="del('projects',${p.id})">حذف</button></div></td>` : ''}</tr>`;
}
function renderProjects() {
  const q = val('projectSearch');
  document.getElementById('projectRows').innerHTML = state.projects.filter(p => match(p, q)).map(p => projectRow(p, true)).join('') || '<tr><td colspan="6" class="empty">لا توجد نتائج</td></tr>';
  document.getElementById('dashRows').innerHTML = state.projects.slice(0, 5).map(p => projectRow(p, false)).join('') || '<tr><td colspan="5" class="empty">لا توجد مشاريع</td></tr>';
}
function renderBoq() {
  const q = val('boqSearch');
  document.getElementById('boqRows').innerHTML = state.boq.filter(b => match({ ...b, projectName: pName(b.project) }, q)).map(b => `<tr><td>${pName(b.project)}</td><td>${b.item}</td><td>${b.unit}</td><td>${money(b.qty)}</td><td>${money(Number(b.qty) * Number(b.cost))}</td><td><div class="rowbtn"><button class="btn blue" onclick="editBoq(${b.id})">تعديل</button><button class="btn red" onclick="del('boq',${b.id})">حذف</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد نتائج</td></tr>';
}
function renderFinance() {
  const q = val('ledgerSearch');
  document.getElementById('ledgerRows').innerHTML = state.ledger.filter(l => match({ ...l, projectName: pName(l.project), typeAr: l.type === 'revenue' ? 'إيراد' : 'مصروف' }, q)).map(l => `<tr><td>${l.type === 'revenue' ? 'إيراد' : 'مصروف'}</td><td>${pName(l.project)}</td><td>${l.desc}</td><td>${money(l.amount)}</td><td>${l.date || '-'}</td><td><div class="rowbtn"><button class="btn blue" onclick="editLedger(${l.id})">تعديل</button><button class="btn red" onclick="del('ledger',${l.id})">حذف</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد نتائج</td></tr>';
}
function renderSuppliers() {
  const q = val('supplierSearch');
  document.getElementById('supplierRows').innerHTML = state.suppliers.filter(s => match(s, q)).map(s => `<tr><td>${s.name}</td><td>${s.cat}</td><td>${s.phone}</td><td>${s.address}</td><td><div class="rowbtn"><button class="btn blue" onclick="editSupplier(${s.id})">تعديل</button><button class="btn red" onclick="del('suppliers',${s.id})">حذف</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد نتائج</td></tr>';
}
function renderInventory() {
  const q = val('inventorySearch');
  document.getElementById('inventoryRows').innerHTML = state.inventory.filter(i => match(i, q)).map(i => `<tr><td>${i.name}</td><td>${i.unit}</td><td>${money(i.qty)}</td><td>${money(i.min)}</td><td>${money(i.cost)}</td><td><div class="rowbtn"><button class="btn blue" onclick="editInventory(${i.id})">تعديل</button><button class="btn red" onclick="del('inventory',${i.id})">حذف</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد نتائج</td></tr>';
}
function renderReports() {
  const boqTotal = state.boq.reduce((s, b) => s + Number(b.qty || 0) * Number(b.cost || 0), 0);
  document.getElementById('reportSummary').innerHTML = `<p>عدد المشاريع: <b>${state.projects.length}</b></p><p>إجمالي BOQ: <b>${money(boqTotal)}</b></p><p>عدد الموردين: <b>${state.suppliers.length}</b></p><p>عدد مواد المخزون: <b>${state.inventory.length}</b></p>`;
}
function upsert(list, obj) { if (edit.type === list && edit.id) { const i = state[list].findIndex(x => x.id === edit.id); if (i > -1) state[list][i] = { ...obj, id: edit.id }; } else state[list].unshift({ ...obj, id: id() }); edit = { type: null, id: null }; save(); render(); }
function saveProject() { upsert('projects', { name: val('pName') || 'مشروع جديد', client: val('pClient') || '', value: +val('pValue') || 0, progress: +val('pProgress') || 0, start: val('pStart'), status: val('pStatus') }); clearProjectForm(false); toast('تم حفظ المشروع'); }
function editProject(itemId) { const p = state.projects.find(x => x.id === itemId); if (!p) return; edit = { type: 'projects', id: itemId }; setProject(p); document.getElementById('projectFormTitle').innerHTML = 'تعديل مشروع <span class="editnote">نشط</span>'; }
function setProject(p) { setv('pName', p.name); setv('pClient', p.client); setv('pValue', p.value); setv('pProgress', p.progress); setv('pStart', p.start); setv('pStatus', p.status); }
function clearProjectForm(reset = true) { ['pName','pClient','pValue','pProgress','pStart'].forEach(x => setv(x,'')); setv('pStatus','active'); document.getElementById('projectFormTitle').textContent = 'إضافة مشروع'; if (reset) edit = { type: null, id: null }; }
function saveBoq() { upsert('boq', { project: val('bProject'), item: val('bItem') || 'بند جديد', unit: val('bUnit') || 'وحدة', qty: +val('bQty') || 0, cost: +val('bCost') || 0 }); clearBoqForm(false); toast('تم حفظ بند BOQ'); }
function editBoq(itemId) { const b = state.boq.find(x => x.id === itemId); if (!b) return; edit = { type: 'boq', id: itemId }; setv('bProject', b.project); setv('bItem', b.item); setv('bUnit', b.unit); setv('bQty', b.qty); setv('bCost', b.cost); document.getElementById('boqFormTitle').innerHTML = 'تعديل بند <span class="editnote">نشط</span>'; }
function clearBoqForm(reset = true) { ['bItem','bUnit','bQty','bCost'].forEach(x => setv(x,'')); setv('bProject',''); document.getElementById('boqFormTitle').textContent = 'إضافة بند BOQ'; if (reset) edit = { type: null, id: null }; }
function saveLedger() { upsert('ledger', { type: val('lType'), project: val('lProject'), desc: val('lDesc') || 'حركة مالية', amount: +val('lAmount') || 0, date: val('lDate') || new Date().toISOString().slice(0,10) }); clearLedgerForm(false); toast('تم حفظ الحركة'); }
function editLedger(itemId) { const l = state.ledger.find(x => x.id === itemId); if (!l) return; edit = { type: 'ledger', id: itemId }; setv('lType', l.type); setv('lProject', l.project); setv('lDesc', l.desc); setv('lAmount', l.amount); setv('lDate', l.date); document.getElementById('ledgerFormTitle').innerHTML = 'تعديل حركة <span class="editnote">نشط</span>'; }
function clearLedgerForm(reset = true) { ['lDesc','lAmount','lDate'].forEach(x => setv(x,'')); setv('lType','revenue'); setv('lProject',''); document.getElementById('ledgerFormTitle').textContent = 'إضافة حركة مالية'; if (reset) edit = { type: null, id: null }; }
function saveSupplier() { upsert('suppliers', { name: val('sName') || 'مورد جديد', cat: val('sCat') || '', phone: val('sPhone') || '', address: val('sAddress') || '' }); clearSupplierForm(false); toast('تم حفظ المورد'); }
function editSupplier(itemId) { const s = state.suppliers.find(x => x.id === itemId); if (!s) return; edit = { type: 'suppliers', id: itemId }; setv('sName', s.name); setv('sCat', s.cat); setv('sPhone', s.phone); setv('sAddress', s.address); document.getElementById('supplierFormTitle').innerHTML = 'تعديل مورد <span class="editnote">نشط</span>'; }
function clearSupplierForm(reset = true) { ['sName','sCat','sPhone','sAddress'].forEach(x => setv(x,'')); document.getElementById('supplierFormTitle').textContent = 'إضافة مورد'; if (reset) edit = { type: null, id: null }; }
function saveInventory() { upsert('inventory', { name: val('iName') || 'مادة جديدة', unit: val('iUnit') || 'وحدة', qty: +val('iQty') || 0, min: +val('iMin') || 0, cost: +val('iCost') || 0 }); clearInventoryForm(false); toast('تم حفظ المخزون'); }
function editInventory(itemId) { const i = state.inventory.find(x => x.id === itemId); if (!i) return; edit = { type: 'inventory', id: itemId }; setv('iName', i.name); setv('iUnit', i.unit); setv('iQty', i.qty); setv('iMin', i.min); setv('iCost', i.cost); document.getElementById('inventoryFormTitle').innerHTML = 'تعديل مخزون <span class="editnote">نشط</span>'; }
function clearInventoryForm(reset = true) { ['iName','iUnit','iQty','iMin','iCost'].forEach(x => setv(x,'')); document.getElementById('inventoryFormTitle').textContent = 'إضافة مادة مخزون'; if (reset) edit = { type: null, id: null }; }
function del(list, itemId) { if (confirm('تأكيد الحذف؟')) { state[list] = state[list].filter(x => Number(x.id) !== Number(itemId)); save(); render(); toast('تم الحذف'); } }
function resetAll() { if (confirm('هل تريد مسح كل البيانات؟')) { state = structuredClone(empty); save(); render(); toast('تم مسح البيانات'); } }
function exportJson() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = 'construction-erp-backup-v3.json'; a.click(); toast('تم تصدير النسخة الاحتياطية'); }
document.getElementById('importFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { state = JSON.parse(r.result); save(); render(); toast('تم الاستيراد'); } catch { toast('ملف غير صالح'); } }; r.readAsText(f); });
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2200); }
document.getElementById('nav').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') return; document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); document.querySelectorAll('.page').forEach(p => p.classList.add('hide')); document.getElementById(e.target.dataset.page).classList.remove('hide'); document.getElementById('title').textContent = e.target.textContent; });
if (!localStorage.getItem(KEY)) seedData(); else render();
