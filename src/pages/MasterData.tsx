import * as React from 'react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Select, Textarea } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { addAudit, loadFromStorage, saveToStorage, writeStorage } from '@/lib/storage';
import type { ClinicProfile, COA, Doctor, Employee, Payer, Settings, Vendor } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { createCostCenterRows, createServiceCategoryRows, defaultTaxRateRows, localStorageKeys, moduleConfigs, type FormField, type ModuleConfig } from '@/data/moduleConfig';
import { CheckCircle2, Plus, RotateCcw, Save } from 'lucide-react';

type Row = Record<string, any> & { id: string };
type MasterKey = 'clinicProfile' | 'doctors' | 'employees' | 'vendors' | 'payers' | 'coa' | 'costCenters' | 'taxRates' | 'serviceCategories';

const routeToModule: Record<string, MasterKey> = {
  master: 'clinicProfile', 'master-profile': 'clinicProfile', 'master-doctors': 'doctors', 'master-employees': 'employees', 'master-vendors': 'vendors', 'master-payers': 'payers', 'master-coa': 'coa', 'master-cost-center': 'costCenters', 'master-tax': 'taxRates', 'master-service-category': 'serviceCategories',
};

function statusBadge(value: unknown) {
  const text = String(value ?? '-');
  const lower = text.toLowerCase();
  const variant = lower.includes('aktif') || lower.includes('active') || lower.includes('approved') ? 'green' : lower.includes('non') || lower.includes('berakhir') ? 'red' : lower.includes('review') || lower.includes('monitoring') || lower.includes('draft') ? 'amber' : 'default';
  return <Badge variant={variant as any}>{text}</Badge>;
}

function enrichRows(key: MasterKey, rows: Row[]): Row[] {
  return rows.map((row, index) => {
    if (key === 'doctors') return { tariff: 200000 + index * 50000, ...row };
    if (key === 'vendors') return { payableBalance: 1500000 + index * 750000, ...row };
    if (key === 'payers') return { paymentTerm: row.type === 'Umum' ? 'Cash' : '30 Hari', contractStatus: row.isActive ? 'Aktif' : 'Nonaktif', ...row };
    return row;
  });
}

function makeDefaultRow(config: ModuleConfig<any>, rows: Row[]): Row {
  const id = `${config.key}-${Date.now()}`;
  const draft: Row = { id };
  config.formFields?.forEach((field) => {
    if (field.key === 'id') draft.id = id;
    else if (field.type === 'toggle') draft[field.key] = true;
    else if (field.type === 'number' || field.type === 'currency') draft[field.key] = 0;
    else if (field.type === 'date') draft[field.key] = new Date().toISOString().slice(0, 10);
    else if (field.options?.length) draft[field.key] = field.options[0];
    else draft[field.key] = '';
  });
  if (config.key === 'costCenters') draft.code = `CC-${String(rows.length + 1).padStart(3, '0')}`;
  if (config.key === 'taxRates') draft.code = `TAX-${String(rows.length + 1).padStart(3, '0')}`;
  if (config.key === 'serviceCategories') draft.code = `LYN-${String(rows.length + 1).padStart(3, '0')}`;
  return draft;
}

function validateRow(config: ModuleConfig<any>, draft: Row) {
  const errors: Record<string, string> = {};
  config.formFields?.forEach((field) => {
    const value = draft[field.key];
    if (field.required && (value === undefined || value === null || value === '')) errors[field.key] = `${field.label} wajib diisi.`;
    if ((field.type === 'number' || field.type === 'currency') && value !== '' && !Number.isFinite(Number(value))) errors[field.key] = `${field.label} harus angka valid.`;
    if (field.required && field.type === 'currency' && Number(value) <= 0) errors[field.key] = `${field.label} harus lebih dari 0.`;
  });
  return errors;
}

function FieldInput({ field, draft, setDraft, error }: { field: FormField; draft: Row; setDraft: (row: Row) => void; error?: string }) {
  const value = draft[field.key];
  const common = 'w-full';
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{field.label}{field.required && <span className="text-red-500"> *</span>}</span>
      {field.type === 'textarea' ? <Textarea className={common} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} /> : field.type === 'select' ? <Select className={common} value={String(value ?? '')} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</Select> : field.type === 'toggle' ? <button type="button" className={`h-10 rounded-xl border px-3 text-left text-sm font-medium ${value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`} onClick={() => setDraft({ ...draft, [field.key]: !value })}>{value ? 'Aktif' : 'Nonaktif'}</button> : <Input className={common} type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => setDraft({ ...draft, [field.key]: field.type === 'number' || field.type === 'currency' ? Number(e.target.value) : e.target.value })} />}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </label>
  );
}

function ProfileSettings({ profile, setProfile }: { profile: ClinicProfile; setProfile: (value: ClinicProfile) => void }) {
  const config = moduleConfigs.clinicProfile;
  const [draft, setDraft] = React.useState<ClinicProfile>(profile);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => setDraft(profile), [profile]);
  const save = () => {
    const nextErrors = validateRow(config, draft as unknown as Row);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setProfile(draft);
    writeStorage('clinic-profile', draft);
    saveToStorage(localStorageKeys.clinicProfile, draft);
    addAudit('Profil Klinik', 'update', draft.clinicCode, draft.name, 'Profil Klinik disimpan');
    setSaved(true);
  };
  const reset = () => setDraft(profile);
  const primaryFields = config.formFields?.filter((field) => field.section === 'primary') ?? [];
  const secondaryFields = config.formFields?.filter((field) => field.section === 'secondary') ?? [];
  return (
    <div className="space-y-4">
      {saved && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 className="mr-2 inline" size={16} />Profil tersimpan lokal untuk Finance Operations.</Alert>}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informasi Klinik</CardTitle><p className="text-sm text-slate-500">Identitas yang muncul di dashboard, print, dan export.</p></CardHeader>
          <CardContent className="grid gap-3">{primaryFields.map((field) => <FieldInput key={field.key} field={field} draft={draft as unknown as Row} setDraft={(row) => setDraft(row as unknown as ClinicProfile)} error={errors[field.key]} />)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Kode & Legal</CardTitle><p className="text-sm text-slate-500">Kode dipakai untuk numbering finance dan audit trail.</p></CardHeader>
          <CardContent className="grid gap-3">{secondaryFields.map((field) => <FieldInput key={field.key} field={field} draft={draft as unknown as Row} setDraft={(row) => setDraft(row as unknown as ClinicProfile)} error={errors[field.key]} />)}</CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={reset}><RotateCcw size={16} />Reset Profil</Button><Button onClick={save}><Save size={16} />Simpan Profil</Button></div>
    </div>
  );
}

function ManagedTable({ config, rows, setRows }: { config: ModuleConfig<Row>; rows: Row[]; setRows: (rows: Row[]) => void }) {
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState('');
  const normalized = React.useMemo(() => enrichRows(config.key as MasterKey, rows), [config.key, rows]);
  const persist = (next: Row[]) => {
    setRows(next);
    if (config.localStorageKey) saveToStorage(config.localStorageKey, next);
    addAudit(config.title, 'update', config.key, config.title, `${config.title} diperbarui`);
  };
  const save = () => {
    if (!editing) return;
    const nextErrors = validateRow(config, editing);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const next = normalized.some((row) => row.id === editing.id) ? normalized.map((row) => row.id === editing.id ? editing : row) : [editing, ...normalized];
    persist(next);
    setEditing(null);
    setFeedback(`${config.title} berhasil disimpan.`);
  };
  const deleteRow = (row: Row) => { persist(normalized.filter((item) => item.id !== row.id)); setFeedback(`${config.title} berhasil dihapus.`); };
  const totalBudget = normalized.reduce((sum, row) => sum + Number(row.monthlyBudget || 0), 0);
  const totalRealization = normalized.reduce((sum, row) => sum + Number(row.realization || 0), 0);
  const columns = (config.columns ?? []).map((column) => ['isActive', 'status', 'contractStatus'].includes(String(column.key)) ? { ...column, accessor: (row: Row) => statusBadge(column.accessor ? column.accessor(row) : row[String(column.key)]) } : column);
  return (
    <div className="space-y-4">
      {feedback && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">{feedback}</Alert>}
      {config.key === 'costCenters' && <div className="grid gap-4 md:grid-cols-3"><Card><CardContent><p className="text-sm text-slate-500">Total Budget Bulanan</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(totalBudget)}</p></CardContent></Card><Card><CardContent><p className="text-sm text-slate-500">Total Realisasi</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(totalRealization)}</p></CardContent></Card><Card><CardContent><p className="text-sm text-slate-500">Progress Budget vs Realisasi</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#b49322]" style={{ width: `${Math.min(100, totalBudget ? (totalRealization / totalBudget) * 100 : 0)}%` }} /></div><p className="mt-2 text-sm font-semibold text-slate-700">{totalBudget ? Math.round((totalRealization / totalBudget) * 100) : 0}% terpakai</p></CardContent></Card></div>}
      <DataTable title={config.title} description={config.subtitle} rows={normalized} columns={columns} filename={config.exportFilename} emptyMessage={config.emptyState ?? `Belum ada data ${config.title}.`} onEdit={(row) => { setEditing({ ...(row as Row) }); setErrors({}); }} onDelete={(row) => deleteRow(row as Row)} emptyAction={<Button onClick={() => setEditing(makeDefaultRow(config, normalized))}><Plus size={16} />{config.primaryAction}</Button>} />
      <div className="flex justify-end"><Button onClick={() => { setEditing(makeDefaultRow(config, normalized)); setErrors({}); }}><Plus size={16} />{config.primaryAction}</Button></div>
      <Dialog open={!!editing}>{editing && <div className="space-y-4"><div><h2 className="text-lg font-bold">{config.primaryAction}</h2><p className="text-sm text-slate-500">Form dinamis mengikuti registry modul {config.title}.</p></div><div className="grid gap-3 md:grid-cols-2">{config.formFields?.map((field) => <FieldInput key={field.key} field={field} draft={editing} setDraft={setEditing} error={errors[field.key]} />)}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button onClick={save}><Save size={16} />Simpan</Button></div></div>}</Dialog>
    </div>
  );
}

export function MasterData({ activeModule = 'master-profile', profile, setProfile, doctors, setDoctors, employees, setEmployees, vendors, setVendors, payers, setPayers, coa, setCoa, settings, setSettings }: { activeModule?: string; profile: ClinicProfile; setProfile: (v: ClinicProfile) => void; doctors: Doctor[]; setDoctors: (v: Doctor[]) => void; employees: Employee[]; setEmployees: (v: Employee[]) => void; vendors: Vendor[]; setVendors: (v: Vendor[]) => void; payers: Payer[]; setPayers: (v: Payer[]) => void; coa: COA[]; setCoa: (v: COA[]) => void; settings: Settings; setSettings: (v: Settings) => void }) {
  const moduleKey = routeToModule[activeModule] ?? 'clinicProfile';
  const config = moduleConfigs[moduleKey];
  const [costCenters, setCostCenters] = React.useState<Row[]>(() => loadFromStorage(localStorageKeys.costCenters, createCostCenterRows(settings.costCenters)));
  const [taxRates, setTaxRates] = React.useState<Row[]>(() => loadFromStorage(localStorageKeys.taxRates, defaultTaxRateRows()));
  const [serviceCategories, setServiceCategories] = React.useState<Row[]>(() => loadFromStorage(localStorageKeys.serviceCategories, createServiceCategoryRows(settings.serviceCategories)));
  React.useEffect(() => saveToStorage(localStorageKeys.settings, settings), [settings]);
  React.useEffect(() => { if (moduleKey === 'costCenters') { const nextSettings = { ...settings, costCenters: costCenters.map((row) => row.name) }; setSettings(nextSettings); writeStorage('settings', nextSettings); } }, [costCenters]);
  const tableMap: Record<Exclude<MasterKey, 'clinicProfile'>, { rows: Row[]; setRows: (rows: Row[]) => void }> = {
    doctors: { rows: doctors as unknown as Row[], setRows: (rows) => { setDoctors(rows as unknown as Doctor[]); writeStorage('doctors', rows as any); saveToStorage(localStorageKeys.doctors, rows); } },
    employees: { rows: employees as unknown as Row[], setRows: (rows) => { setEmployees(rows as unknown as Employee[]); writeStorage('employees', rows as any); saveToStorage(localStorageKeys.employees, rows); } },
    vendors: { rows: vendors as unknown as Row[], setRows: (rows) => { setVendors(rows as unknown as Vendor[]); writeStorage('vendors', rows as any); saveToStorage(localStorageKeys.vendors, rows); } },
    payers: { rows: payers as unknown as Row[], setRows: (rows) => { setPayers(rows as unknown as Payer[]); writeStorage('payers', rows as any); saveToStorage(localStorageKeys.payers, rows); } },
    coa: { rows: coa as unknown as Row[], setRows: (rows) => { setCoa(rows as unknown as COA[]); writeStorage('coa', rows as any); saveToStorage(localStorageKeys.coa, rows); } },
    costCenters: { rows: costCenters, setRows: setCostCenters },
    taxRates: { rows: taxRates, setRows: setTaxRates },
    serviceCategories: { rows: serviceCategories, setRows: setServiceCategories },
  };
  const tabs = Object.entries(routeToModule).filter(([route]) => route !== 'master').map(([route, key]) => ({ route, key, label: moduleConfigs[key].title }));
  return (
    <div>
      <PageHeader title={config.title} description={config.subtitle} />
      <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">{tabs.map((tab) => <Button key={tab.route} variant={moduleKey === tab.key ? 'default' : 'ghost'} className="shrink-0" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: tab.route }))}>{tab.label}</Button>)}</div>
      {moduleKey === 'clinicProfile' ? <ProfileSettings profile={profile} setProfile={setProfile} /> : <ManagedTable config={config as ModuleConfig<Row>} rows={tableMap[moduleKey as Exclude<MasterKey, 'clinicProfile'>].rows} setRows={tableMap[moduleKey as Exclude<MasterKey, 'clinicProfile'>].setRows} />}
    </div>
  );
}
