import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Columns3, Download, FileSpreadsheet, FileText, Filter, Pencil, Plus, Printer, RotateCcw, Search, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Select, Table, Textarea } from '@/components/ui/basic';
import { exportToCsv, exportToExcel, exportToJson, printVoucherTable, type ExportColumn } from '@/lib/export';
import { formatCurrency, formatDate, normalizeSearchText, parseAmount } from '@/lib/format';
import { generateDocumentNumber } from '@/lib/numbering';
import { createSeedData } from '@/lib/seed';
import { addAudit, loadFromStorage, removeFromStorage, saveToStorage, writeStorage } from '@/lib/storage';
import { rupiahTerbilang } from '@/lib/terbilang';
import { cn } from '@/lib/utils';
import type { AppData, Voucher } from '@/lib/types';

const APP_NAME = 'Klinik Utama Prime Mata';
const MODULE_NAME = 'Finance Operations';
const PAGE_TITLE = 'Voucher BBK/BKK/KK/KKM/BKM/SB';
const DEFAULT_PERIOD = 'Mei 2026';
const VOUCHER_KEY = 'prime_finance_vouchers';
const VISIBLE_COLUMNS_KEY = 'prime_finance_voucher_visible_columns';
const ROWS_PER_PAGE_KEY = 'prime_finance_voucher_rows_per_page';
const SELECTED_TYPE_KEY = 'prime_finance_voucher_selected_type';
const SEARCH_KEY = 'prime_finance_voucher_search';
const SORT_KEY = 'prime_finance_voucher_sort';
const ACTIVE_PERIOD_KEY = 'prime_finance_active_period';
const voucherTypes = ['BBK', 'BKK', 'KK', 'KKM', 'BKM', 'SB'] as const;
const statuses = ['Approved', 'Draft', 'Pending', 'Rejected'] as const;
const filenameDate = () => new Date().toISOString().slice(0, 10);
const voucherFilename = (extension: 'csv' | 'json' | 'xlsx' | 'xls') => `voucher-klinik-utama-prime-mata-${filenameDate()}.${extension}`;

type VoucherType = typeof voucherTypes[number];
type VoucherStatus = typeof statuses[number];
type VoucherColumnKey = 'tanggal' | 'nomor' | 'type' | 'paidTo' | 'amount' | 'terbilang' | 'status';
type SortConfig = { key: VoucherColumnKey; direction: 'asc' | 'desc' };
type RowsPerPage = 10 | 25 | 50 | 'all';
type FormMode = 'create' | 'edit' | null;

type NormalizedVoucher = Voucher & {
  tanggal: string;
  nomor: string;
  terbilang: string;
  status: VoucherStatus;
  type: VoucherType;
  sourceLedger?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type VoucherColumn = {
  key: VoucherColumnKey;
  header: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render: (row: NormalizedVoucher) => React.ReactNode;
  exportValue: (row: NormalizedVoucher) => string | number;
  sortValue: (row: NormalizedVoucher) => string | number;
};

const defaultVisibleColumns: VoucherColumnKey[] = ['tanggal', 'nomor', 'type', 'paidTo', 'amount', 'terbilang', 'status'];
const defaultSort: SortConfig = { key: 'tanggal', direction: 'asc' };

const formSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi.'),
  type: z.enum(voucherTypes, { error: 'Type wajib dipilih.' }),
  paidTo: z.string().trim().min(1, 'Paid To wajib diisi.'),
  amount: z.number().positive('Amount harus angka positif.'),
  terbilang: z.string().trim().min(1, 'Terbilang wajib diisi.'),
  status: z.enum(statuses, { error: 'Status wajib dipilih.' }),
  sourceLedger: z.string().optional(),
  notes: z.string().optional(),
});

type FormErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

function isVoucherType(value: unknown): value is VoucherType { return typeof value === 'string' && voucherTypes.includes(value as VoucherType); }
function isVoucherStatus(value: unknown): value is VoucherStatus { return typeof value === 'string' && statuses.includes(value as VoucherStatus); }

function normalizeVoucher(row: Voucher | Partial<NormalizedVoucher>): NormalizedVoucher {
  const now = new Date().toISOString();
  const tanggal = String((row as any).tanggal || row.date || new Date().toISOString().slice(0, 10));
  const type = isVoucherType(row.type) ? row.type : 'BBK';
  const amount = parseAmount(row.amount);
  const nomor = String((row as any).nomor || row.voucherNo || generateVoucherNumber(type, tanggal, []));
  const terbilang = String((row as any).terbilang || row.amountInWords || rupiahTerbilang(amount));
  return {
    id: row.id || crypto.randomUUID(),
    tanggal,
    date: tanggal,
    nomor,
    voucherNo: nomor,
    type,
    paidTo: row.paidTo || '',
    amount,
    terbilang,
    amountInWords: terbilang,
    status: isVoucherStatus(row.status) ? row.status : 'Draft',
    sourceLedger: (row as any).sourceLedger || row.sourceLedgerId || '',
    notes: (row as any).notes || row.description || '',
    sourceLedgerId: row.sourceLedgerId || (row as any).sourceLedger || '',
    description: row.description || (row as any).notes || '',
    paymentMethod: row.paymentMethod || 'Transfer',
    chequeNo: row.chequeNo || '',
    supplierId: row.supplierId || '',
    createdAt: (row as any).createdAt || now,
    updatedAt: (row as any).updatedAt || now,
  };
}

function getDemoVouchers(): NormalizedVoucher[] { return createSeedData().vouchers.map(normalizeVoucher); }
function getInitialVouchers(propRows: Voucher[]) { return loadFromStorage<NormalizedVoucher[]>(VOUCHER_KEY, propRows?.length ? propRows.map(normalizeVoucher) : getDemoVouchers()).map(normalizeVoucher); }
function persistVouchers(rows: NormalizedVoucher[], setRows: (rows: Voucher[]) => void) { saveToStorage(VOUCHER_KEY, rows); setRows(rows); writeStorage('vouchers', rows as unknown as AppData['vouchers']); }

function readVisibleColumns() { return loadFromStorage<VoucherColumnKey[]>(VISIBLE_COLUMNS_KEY, defaultVisibleColumns).filter((key) => defaultVisibleColumns.includes(key)); }
function readRowsPerPage(): RowsPerPage { const value = loadFromStorage<RowsPerPage>(ROWS_PER_PAGE_KEY, 10); return value === 'all' || value === 25 || value === 50 || value === 10 ? value : 10; }
function readSelectedType(): 'Semua' | VoucherType { const value = loadFromStorage<'Semua' | VoucherType>(SELECTED_TYPE_KEY, 'Semua'); return value === 'Semua' || isVoucherType(value) ? value : 'Semua'; }
function readSort(): SortConfig { const value = loadFromStorage<SortConfig>(SORT_KEY, defaultSort); return value && defaultVisibleColumns.includes(value.key) && ['asc', 'desc'].includes(value.direction) ? value : defaultSort; }

export function generateVoucherNumber(type: VoucherType, date: string, existingRows: Array<Pick<NormalizedVoucher, 'nomor' | 'type' | 'tanggal'> | Voucher>): string {
  const parsedDate = new Date(date || new Date().toISOString());
  const sequence = existingRows.reduce((max, row) => {
    const nomor = String((row as any).nomor || (row as any).voucherNo || '');
    const rowType = (row as any).type;
    const rowDate = String((row as any).tanggal || (row as any).date || '');
    const sameType = rowType === type;
    const sameMonth = rowDate.slice(0, 7) === date.slice(0, 7);
    const match = nomor.match(/NO\.\s*(\d+)\//i);
    return sameType && sameMonth && match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return generateDocumentNumber(type, Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate, sequence, { style: 'voucher' });
}

const voucherColumns: VoucherColumn[] = [
  { key: 'tanggal', header: 'Tanggal', sortable: true, className: 'w-[135px]', render: (row) => <span className="text-slate-600">{formatDate(row.tanggal)}</span>, exportValue: (row) => formatDate(row.tanggal), sortValue: (row) => Date.parse(row.tanggal) || 0 },
  { key: 'nomor', header: 'Nomor', sortable: true, className: 'w-[180px]', render: (row) => <span className="font-mono text-[13px] font-semibold text-slate-900">{row.nomor}</span>, exportValue: (row) => row.nomor, sortValue: (row) => row.nomor },
  { key: 'type', header: 'Type', sortable: true, className: 'w-[90px]', render: (row) => <TypeBadge type={row.type} />, exportValue: (row) => row.type, sortValue: (row) => row.type },
  { key: 'paidTo', header: 'Paid To', sortable: true, className: 'min-w-[180px]', render: (row) => <span className="font-medium text-slate-800">{row.paidTo}</span>, exportValue: (row) => row.paidTo, sortValue: (row) => row.paidTo },
  { key: 'amount', header: 'Amount', sortable: true, align: 'right', className: 'w-[170px]', render: (row) => <span className="font-bold tabular-nums text-slate-950">{formatCurrency(row.amount)}</span>, exportValue: (row) => formatCurrency(row.amount), sortValue: (row) => row.amount },
  { key: 'terbilang', header: 'Terbilang', className: 'min-w-[260px] max-w-[340px]', render: (row) => <span title={row.terbilang} className="block max-w-[320px] truncate text-slate-600">{row.terbilang}</span>, exportValue: (row) => row.terbilang, sortValue: (row) => row.terbilang },
  { key: 'status', header: 'Status', sortable: true, className: 'w-[125px]', render: (row) => <StatusBadge status={row.status} />, exportValue: (row) => row.status, sortValue: (row) => row.status },
];

function compareValues(a: string | number, b: string | number) { return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'id-ID', { numeric: true, sensitivity: 'base' }); }
function toExportColumns(columns: VoucherColumn[], totalAmount: number): ExportColumn<NormalizedVoucher>[] { return columns.map((column) => ({ key: column.key, header: column.header, exportAccessor: column.exportValue, exportFooter: column.key === 'amount' ? () => formatCurrency(totalAmount) : undefined })); }
function voucherSearchText(row: NormalizedVoucher) { return normalizeSearchText([row.tanggal, formatDate(row.tanggal), row.nomor, row.type, row.paidTo, row.amount, formatCurrency(row.amount), row.terbilang, row.status].join(' ')); }

function TypeBadge({ type }: { type: VoucherType }) { return <Badge className="border border-blue-100 bg-blue-50 text-blue-700">{type}</Badge>; }
function StatusBadge({ status }: { status: VoucherStatus }) {
  const map: Record<VoucherStatus, string> = { Approved: 'border border-emerald-200 bg-emerald-50 text-emerald-700', Draft: 'border border-blue-200 bg-blue-50 text-blue-700', Pending: 'border border-amber-200 bg-amber-50 text-amber-700', Rejected: 'border border-red-200 bg-red-50 text-red-700' };
  return <Badge className={map[status]}>{status}</Badge>;
}
function SummaryMetricCard({ label, value, meta, tone = 'blue' }: { label: string; value: string; meta?: string; tone?: 'blue' | 'green' | 'slate' }) {
  const toneClass = tone === 'green' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : tone === 'slate' ? 'bg-slate-50 text-slate-700 ring-slate-100' : 'bg-blue-50 text-blue-700 ring-blue-100';
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={cn('mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1', toneClass)}>{label}</div><p className="text-2xl font-extrabold text-slate-950">{value}</p>{meta && <p className="mt-1 text-sm text-slate-500">{meta}</p>}</div>;
}

function createBlankVoucher(rows: NormalizedVoucher[]): NormalizedVoucher {
  const tanggal = new Date().toISOString().slice(0, 10);
  const amount = 0;
  return normalizeVoucher({ id: crypto.randomUUID(), tanggal, date: tanggal, type: 'BBK', nomor: generateVoucherNumber('BBK', tanggal, rows), voucherNo: generateVoucherNumber('BBK', tanggal, rows), paidTo: '', amount, terbilang: '', amountInWords: '', status: 'Draft', sourceLedger: '', notes: '' });
}

export function VoucherPage({ rows, setRows }: { rows: Voucher[]; setRows: (r: Voucher[]) => void }) {
  const [vouchers, setVouchers] = React.useState<NormalizedVoucher[]>(() => getInitialVouchers(rows));
  const [searchQuery, setSearchQuery] = React.useState(() => loadFromStorage(SEARCH_KEY, ''));
  const [selectedType, setSelectedType] = React.useState<'Semua' | VoucherType>(() => readSelectedType());
  const [sortConfig, setSortConfig] = React.useState<SortConfig>(() => readSort());
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState<RowsPerPage>(() => readRowsPerPage());
  const [visibleColumns, setVisibleColumns] = React.useState<VoucherColumnKey[]>(() => { const cols = readVisibleColumns(); return cols.length ? cols : defaultVisibleColumns; });
  const [editingVoucher, setEditingVoucher] = React.useState<NormalizedVoucher | null>(null);
  const [deletingVoucher, setDeletingVoucher] = React.useState<NormalizedVoucher | null>(null);
  const [formMode, setFormMode] = React.useState<FormMode>(null);
  const [feedbackMessage, setFeedbackMessage] = React.useState('');
  const [exportMessage, setExportMessage] = React.useState('');
  const [formErrors, setFormErrors] = React.useState<FormErrors>({});
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = React.useState(false);
  const [activePeriod, setActivePeriod] = React.useState(() => loadFromStorage(ACTIVE_PERIOD_KEY, DEFAULT_PERIOD));

  const visibleColumnDefs = React.useMemo(() => voucherColumns.filter((column) => visibleColumns.includes(column.key)), [visibleColumns]);
  const filteredRows = React.useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return vouchers.filter((row) => (selectedType === 'Semua' || row.type === selectedType) && (!query || voucherSearchText(row).includes(query)));
  }, [vouchers, searchQuery, selectedType]);
  const sortedRows = React.useMemo(() => {
    const column = voucherColumns.find((item) => item.key === sortConfig.key);
    if (!column) return filteredRows;
    return [...filteredRows].sort((a, b) => (sortConfig.direction === 'asc' ? 1 : -1) * compareValues(column.sortValue(a), column.sortValue(b)));
  }, [filteredRows, sortConfig]);
  const totalAmount = React.useMemo(() => sortedRows.reduce((sum, row) => sum + row.amount, 0), [sortedRows]);
  const approvedCount = React.useMemo(() => sortedRows.filter((row) => row.status === 'Approved').length, [sortedRows]);
  const totalPages = React.useMemo(() => rowsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(sortedRows.length / rowsPerPage)), [rowsPerPage, sortedRows.length]);
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = React.useMemo(() => rowsPerPage === 'all' ? sortedRows : sortedRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage), [rowsPerPage, safePage, sortedRows]);
  const rowCountText = React.useMemo(() => {
    const from = sortedRows.length === 0 ? 0 : rowsPerPage === 'all' ? 1 : (safePage - 1) * rowsPerPage + 1;
    const to = rowsPerPage === 'all' ? sortedRows.length : Math.min(safePage * rowsPerPage, sortedRows.length);
    return `Menampilkan ${from}–${to} dari ${sortedRows.length}`;
  }, [rowsPerPage, safePage, sortedRows.length]);
  const hasActiveFilter = searchQuery.trim() !== '' || selectedType !== 'Semua';

  React.useEffect(() => { persistVouchers(vouchers, setRows); }, []); // migrate exact key once on mount
  React.useEffect(() => setCurrentPage(1), [searchQuery, selectedType, rowsPerPage]);
  React.useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  React.useEffect(() => saveToStorage(SEARCH_KEY, searchQuery), [searchQuery]);
  React.useEffect(() => saveToStorage(SELECTED_TYPE_KEY, selectedType), [selectedType]);
  React.useEffect(() => saveToStorage(SORT_KEY, sortConfig), [sortConfig]);
  React.useEffect(() => saveToStorage(ROWS_PER_PAGE_KEY, rowsPerPage), [rowsPerPage]);
  React.useEffect(() => saveToStorage(VISIBLE_COLUMNS_KEY, visibleColumns), [visibleColumns]);
  React.useEffect(() => saveToStorage(ACTIVE_PERIOD_KEY, activePeriod), [activePeriod]);

  const setAndPersistVouchers = React.useCallback((next: NormalizedVoucher[]) => { setVouchers(next); persistVouchers(next, setRows); }, [setRows]);
  const getExportMeta = React.useCallback(() => ({ appName: APP_NAME, module: MODULE_NAME, page: PAGE_TITLE, exportedAt: new Date().toISOString(), period: activePeriod, totalRows: sortedRows.length, totalAmount, filters: { search: searchQuery, type: selectedType }, sort: sortConfig, visibleColumns }), [activePeriod, searchQuery, selectedType, sortConfig, sortedRows.length, totalAmount, visibleColumns]);

  const runExport = React.useCallback((type: 'csv' | 'excel' | 'json' | 'print') => {
    setExportMessage(''); setIsExportMenuOpen(false);
    try {
      const exportColumns = toExportColumns(visibleColumnDefs, totalAmount);
      const meta = getExportMeta();
      if (type === 'csv') exportToCsv(sortedRows, exportColumns, voucherFilename('csv'));
      if (type === 'excel') exportToExcel({ rows: sortedRows, columns: exportColumns, filename: voucherFilename('xlsx'), sheetName: 'Voucher', includeFooter: true, meta });
      if (type === 'json') exportToJson({ ...meta, rows: sortedRows.map((row) => Object.fromEntries(visibleColumnDefs.map((column) => [column.key, column.exportValue(row)]))) }, voucherFilename('json'));
      if (type === 'print') printVoucherTable(sortedRows, exportColumns, { ...meta, title: PAGE_TITLE, totalAmount: formatCurrency(totalAmount) });
      setExportMessage(sortedRows.length === 0 ? 'Export dibuat tanpa data karena hasil aktif kosong.' : 'Export berhasil dibuat.');
    } catch (err) { console.error(err); setExportMessage('Export gagal. Coba lagi.'); }
  }, [getExportMeta, sortedRows, totalAmount, visibleColumnDefs]);

  React.useEffect(() => { const handler = () => runExport('csv'); window.addEventListener('prime:voucher-quick-export', handler); return () => window.removeEventListener('prime:voucher-quick-export', handler); }, [runExport]);

  const openCreate = () => { setEditingVoucher(createBlankVoucher(vouchers)); setFormMode('create'); setFormErrors({}); setFeedbackMessage(''); };
  const openEdit = (row: NormalizedVoucher) => { setEditingVoucher({ ...row }); setFormMode('edit'); setFormErrors({}); setFeedbackMessage(''); };
  const updateEditing = (patch: Partial<NormalizedVoucher>) => setEditingVoucher((current) => current ? { ...current, ...patch } : current);
  const updateAmount = (value: string) => { const amount = parseAmount(value); updateEditing({ amount, terbilang: amount > 0 ? rupiahTerbilang(amount) : '', amountInWords: amount > 0 ? rupiahTerbilang(amount) : '' }); };
  const validateEditing = (draft: NormalizedVoucher) => {
    const result = formSchema.safeParse(draft);
    if (result.success) return {};
    return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message])) as FormErrors;
  };
  const saveVoucher = () => {
    if (!editingVoucher || !formMode) return;
    const normalized = normalizeVoucher(editingVoucher);
    const errors = validateEditing(normalized);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    const previous = vouchers.find((row) => row.id === normalized.id);
    const shouldRegenerate = formMode === 'create' || !previous || previous.type !== normalized.type || previous.tanggal !== normalized.tanggal;
    const now = new Date().toISOString();
    const voucher = normalizeVoucher({ ...normalized, nomor: shouldRegenerate ? generateVoucherNumber(normalized.type, normalized.tanggal, vouchers.filter((row) => row.id !== normalized.id)) : normalized.nomor, voucherNo: shouldRegenerate ? generateVoucherNumber(normalized.type, normalized.tanggal, vouchers.filter((row) => row.id !== normalized.id)) : normalized.nomor, createdAt: previous?.createdAt || now, updatedAt: now, amountInWords: normalized.terbilang, date: normalized.tanggal, description: normalized.notes || '', sourceLedgerId: normalized.sourceLedger || '' });
    const next = formMode === 'edit' ? vouchers.map((row) => row.id === voucher.id ? voucher : row) : [voucher, ...vouchers];
    setAndPersistVouchers(next);
    addAudit(PAGE_TITLE, formMode === 'edit' ? 'update' : 'create', voucher.id, voucher.nomor, formMode === 'edit' ? 'Voucher berhasil diperbarui' : 'Voucher berhasil ditambahkan');
    setEditingVoucher(null); setFormMode(null); setFormErrors({}); setFeedbackMessage(formMode === 'edit' ? 'Voucher berhasil diperbarui.' : 'Voucher berhasil ditambahkan.');
  };
  const confirmDelete = () => {
    if (!deletingVoucher) return;
    const next = vouchers.filter((row) => row.id !== deletingVoucher.id);
    setAndPersistVouchers(next);
    addAudit(PAGE_TITLE, 'delete', deletingVoucher.id, deletingVoucher.nomor, 'Voucher berhasil dihapus');
    setDeletingVoucher(null); setFeedbackMessage('Voucher berhasil dihapus.');
  };
  const handleSort = (key: VoucherColumnKey) => { const column = voucherColumns.find((item) => item.key === key); if (!column?.sortable) return; setSortConfig((current) => current.key !== key ? { key, direction: 'asc' } : { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }); };
  const toggleColumn = (key: VoucherColumnKey) => setVisibleColumns((current) => current.includes(key) && current.length === 1 ? current : current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const resetFilter = () => { setSearchQuery(''); setSelectedType('Semua'); };
  const resetDemo = React.useCallback(() => { [VOUCHER_KEY, VISIBLE_COLUMNS_KEY, ROWS_PER_PAGE_KEY, SELECTED_TYPE_KEY, SEARCH_KEY, SORT_KEY, ACTIVE_PERIOD_KEY].forEach(removeFromStorage); const demo = getDemoVouchers(); setVouchers(demo); persistVouchers(demo, setRows); setSearchQuery(''); setSelectedType('Semua'); setSortConfig(defaultSort); setRowsPerPage(10); setVisibleColumns(defaultVisibleColumns); setCurrentPage(1); setActivePeriod(DEFAULT_PERIOD); setFeedbackMessage('Data demo berhasil direset.'); }, [setRows]);
  React.useEffect(() => { const handler = () => resetDemo(); window.addEventListener('prime:voucher-reset-demo', handler); return () => window.removeEventListener('prime:voucher-reset-demo', handler); }, [resetDemo]);

  return <section className="space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{APP_NAME} • {MODULE_NAME}</p><h1 className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">{PAGE_TITLE}</h1><p className="mt-2 text-sm leading-6 text-slate-500">CRUD lokal, search/filter/sort, pagination, visibilitas kolom, export, print, dan persistensi localStorage.</p></div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><Button className="h-10 px-4" onClick={openCreate}><Plus size={16} />Tambah Voucher</Button><Button variant="outline" className="h-10 bg-white px-4" onClick={() => runExport('print')}><Printer size={16} /> Print</Button><Button variant="outline" className="h-10 bg-white px-4" onClick={resetDemo}><RotateCcw size={16} /> Reset Demo</Button></div></div>
    </header>
    <div className="grid gap-4 md:grid-cols-3"><SummaryMetricCard label="Total Voucher" value={`${sortedRows.length} dokumen`} meta={hasActiveFilter ? 'Mengikuti search/filter aktif' : 'Semua tipe voucher aktif'} /><SummaryMetricCard label="Total Amount" value={formatCurrency(totalAmount)} meta="Akumulasi nilai hasil aktif" tone="slate" /><SummaryMetricCard label="Status" value={`${approvedCount} Approved`} meta="Mengikuti hasil aktif" tone="green" /></div>
    {(feedbackMessage || exportMessage) && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">{feedbackMessage || exportMessage}</Alert>}
    {deletingVoucher && <div role="dialog" aria-modal="false" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold">Hapus voucher {deletingVoucher.nomor}?</p><div className="flex gap-2"><Button variant="outline" className="bg-white" onClick={() => setDeletingVoucher(null)}>Batal</Button><Button variant="destructive" onClick={confirmDelete}>Hapus</Button></div></div></div>}
    <Card className="overflow-visible shadow-sm"><CardHeader><CardTitle>Daftar Voucher</CardTitle><p className="mt-1 text-sm text-slate-500">Data aktif disimpan lokal dengan key <code>{VOUCHER_KEY}</code>.</p></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center"><label className="relative w-full max-w-xl"><span className="sr-only">Search data voucher</span><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input aria-label="Search data voucher" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari tanggal, nomor, tipe, paid to, amount, terbilang, status..." className="w-full pl-9" /></label><label className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter size={14} /> Tipe</span><Select aria-label="Filter tipe voucher" value={selectedType} onChange={(event) => setSelectedType(event.target.value as 'Semua' | VoucherType)} className="w-32"><option>Semua</option>{voucherTypes.map((type) => <option key={type}>{type}</option>)}</Select></label><label className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periode</span><Input aria-label="Periode aktif" value={activePeriod} onChange={(event) => setActivePeriod(event.target.value)} className="w-36" /></label><Badge variant="outline" className="h-9 w-fit bg-slate-50 px-3 text-slate-600">{sortedRows.length} baris</Badge></div><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end"><div className="relative"><Button type="button" variant="outline" className="w-full sm:w-auto" aria-expanded={isExportMenuOpen} onClick={() => setIsExportMenuOpen((open) => !open)}><Download size={16} /> Export <ChevronDown size={14} /></Button>{isExportMenuOpen && <div className="absolute right-0 z-30 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('csv')}><FileText size={15} /> Export CSV</button><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('excel')}><FileSpreadsheet size={15} /> Export Excel</button><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('json')}><FileText size={15} /> Export JSON</button><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('print')}><Printer size={15} /> Print View</button></div>}</div><div className="relative"><Button type="button" variant="outline" className="w-full sm:w-auto" aria-expanded={isColumnMenuOpen} onClick={() => setIsColumnMenuOpen((open) => !open)}><Columns3 size={16} /> Columns <ChevronDown size={14} /></Button>{isColumnMenuOpen && <div className="absolute right-0 z-30 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tampilkan kolom</p>{voucherColumns.map((column) => { const checked = visibleColumns.includes(column.key); return <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><input type="checkbox" checked={checked} disabled={checked && visibleColumns.length === 1} onChange={() => toggleColumn(column.key)} />{column.header}</label>; })}</div>}</div><Select aria-label="Rows per page" value={String(rowsPerPage)} onChange={(event) => setRowsPerPage(event.target.value === 'all' ? 'all' : Number(event.target.value) as RowsPerPage)} className="w-full sm:w-32"><option value="10">10/hal</option><option value="25">25/hal</option><option value="50">50/hal</option><option value="all">Semua</option></Select></div></div>
      {hasActiveFilter && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800"><span>Filter aktif: {searchQuery.trim() ? `Search “${searchQuery.trim()}”` : 'Search kosong'} • Tipe {selectedType}</span><Button type="button" variant="outline" className="h-8 border-blue-200 bg-white px-3 text-xs" onClick={resetFilter}>Reset Filter</Button></div>}
      {paginatedRows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><p className="text-lg font-bold text-slate-900">Data tidak ditemukan</p><p className="mt-1 text-sm text-slate-500">Coba ubah kata kunci atau filter.</p></div> : <div className="overflow-x-auto rounded-2xl border border-slate-200"><Table className="min-w-[980px]"><thead className="sticky top-0 z-10 bg-slate-50/95"><tr>{visibleColumnDefs.map((column) => { const active = sortConfig.key === column.key; return <th key={column.key} aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort(column.key)} className={cn('whitespace-nowrap px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600', column.sortable && 'cursor-pointer select-none hover:bg-slate-100', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center', column.className)}><span className="inline-flex items-center gap-1">{column.header}{active && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</span></th>; })}<th className="w-[120px] whitespace-nowrap px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th></tr></thead><tbody>{paginatedRows.map((row) => <tr key={row.id} className="h-14 border-t border-slate-100 transition-colors hover:bg-blue-50/35">{visibleColumnDefs.map((column) => <td key={column.key} className={cn('whitespace-nowrap px-4 py-3 text-[13px] text-slate-700', column.align === 'right' && 'text-right tabular-nums', column.align === 'center' && 'text-center', column.className)}>{column.render(row)}</td>)}<td className="whitespace-nowrap px-4 py-3 text-right"><div className="flex justify-end gap-2"><Button type="button" variant="ghost" className="h-10 w-10 px-0 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label={`Edit voucher ${row.nomor}`} onClick={() => openEdit(row)}><Pencil size={16} /></Button><Button type="button" variant="ghost" className="h-10 w-10 px-0 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus voucher ${row.nomor}`} onClick={() => setDeletingVoucher(row)}><Trash2 size={16} /></Button></div></td></tr>)}</tbody><tfoot className="border-t border-slate-200 bg-blue-50/60 font-semibold text-slate-800"><tr>{visibleColumnDefs.map((column, index) => <td key={column.key} className={cn('whitespace-nowrap px-4 py-4 text-sm', column.align === 'right' && 'text-right tabular-nums', column.align === 'center' && 'text-center')}>{column.key === 'amount' ? <span className="text-base font-extrabold text-slate-950">{formatCurrency(totalAmount)}</span> : index === 0 ? <span className="font-bold text-slate-900">Total</span> : ''}</td>)}<td className="px-4 py-4" /></tr></tfoot></Table></div>}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>{rowCountText}</span><div className="flex items-center justify-end gap-2"><Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={14} /> Previous</Button><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">{safePage}/{totalPages}</span><Button type="button" variant="outline" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next <ChevronRight size={14} /></Button></div></div>
    </CardContent></Card>
    <Dialog open={!!editingVoucher}>{editingVoucher && <div className="space-y-4"><div><h2 className="text-lg font-bold text-slate-950">{formMode === 'edit' ? 'Edit' : 'Tambah'} Voucher</h2><p className="text-sm text-slate-500">Field wajib: tanggal, type, paid to, amount, terbilang, status. Nomor dibuat otomatis.</p></div><div className="grid gap-3 md:grid-cols-2"><FieldError label="Tanggal" error={formErrors.tanggal}><Input type="date" value={editingVoucher.tanggal} onChange={(event) => updateEditing({ tanggal: event.target.value, date: event.target.value })} /></FieldError><label className="space-y-1"><span className="text-sm font-medium">Nomor</span><Input value={editingVoucher.nomor} readOnly className="bg-slate-50" /></label><FieldError label="Type" error={formErrors.type}><Select value={editingVoucher.type} onChange={(event) => updateEditing({ type: event.target.value as VoucherType })}>{voucherTypes.map((type) => <option key={type}>{type}</option>)}</Select></FieldError><FieldError label="Paid To" error={formErrors.paidTo}><Input value={editingVoucher.paidTo} onChange={(event) => updateEditing({ paidTo: event.target.value })} /></FieldError><FieldError label="Amount" error={formErrors.amount}><Input inputMode="decimal" value={editingVoucher.amount ? String(editingVoucher.amount) : ''} onChange={(event) => updateAmount(event.target.value)} placeholder="Contoh: Rp 1.250.000" /></FieldError><FieldError label="Status" error={formErrors.status}><Select value={editingVoucher.status} onChange={(event) => updateEditing({ status: event.target.value as VoucherStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select></FieldError><label className="space-y-1"><span className="text-sm font-medium">Source Ledger</span><Input value={editingVoucher.sourceLedger || ''} onChange={(event) => updateEditing({ sourceLedger: event.target.value, sourceLedgerId: event.target.value })} /></label><FieldError label="Terbilang" error={formErrors.terbilang} className="md:col-span-2"><Textarea value={editingVoucher.terbilang} onChange={(event) => updateEditing({ terbilang: event.target.value, amountInWords: event.target.value })} /></FieldError><label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Notes</span><Textarea value={editingVoucher.notes || ''} onChange={(event) => updateEditing({ notes: event.target.value, description: event.target.value })} /></label></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setEditingVoucher(null); setFormMode(null); setFormErrors({}); }}>Batal</Button><Button onClick={saveVoucher}>Simpan</Button></div></div>}</Dialog>
  </section>;
}

function FieldError({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={cn('space-y-1', className)}><span className="text-sm font-medium">{label}</span>{children}{error && <span className="block text-xs font-medium text-red-600">{error}</span>}</label>;
}
