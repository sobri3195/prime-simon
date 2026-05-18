import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Columns3, Download, FileSpreadsheet, FileText, Filter, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Badge, Button, Dialog, Input, Select, Textarea, Alert, Card, CardContent, CardHeader, CardTitle, Table } from '@/components/ui/basic';
import { generateDocumentNumber } from '@/lib/numbering';
import { rupiahTerbilang } from '@/lib/terbilang';
import { formatCurrency, formatDate, normalizeSearchText, parseAmount } from '@/lib/format';
import { exportToCsv, exportToExcel, exportToJson, printVoucherTable, type ExportColumn } from '@/lib/export';
import { addAudit, writeStorage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import type { AppData, Voucher } from '@/lib/types';

const APP_NAME = 'Klinik Utama Prime Mata';
const MODULE_NAME = 'Finance Operations';
const PERIOD = 'Mei 2026';
const title = 'Voucher BBK/BKK/KK/KKM/BKM/SB';
const description = 'Nomor otomatis, paid to, amount, terbilang, source ledger, dan print dokumen Excel-like.';
const voucherTypes: Voucher['type'][] = ['BBK', 'BKK', 'KK', 'KKM', 'BKM', 'SB'];
const visibleColumnsKey = 'prime_finance_voucher_visible_columns';
const rowsPerPageKey = 'prime_finance_voucher_rows_per_page';
const selectedTypeKey = 'prime_finance_voucher_selected_type';
const filenameDate = () => new Date().toISOString().slice(0, 10);
const voucherFilename = (extension: 'csv' | 'json' | 'xlsx' | 'xls') => `voucher-klinik-utama-prime-mata-${filenameDate()}.${extension}`;

type VoucherColumnKey = 'date' | 'voucherNo' | 'type' | 'paidTo' | 'amount' | 'amountInWords' | 'status';
type SortConfig = { key: VoucherColumnKey; direction: 'asc' | 'desc' } | null;
type RowsPerPage = 10 | 25 | 50 | 'all';

type VoucherColumn = {
  key: VoucherColumnKey;
  header: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render: (row: Voucher) => React.ReactNode;
  exportValue: (row: Voucher) => string | number;
  sortValue: (row: Voucher) => string | number;
};

const voucherColumns: VoucherColumn[] = [
  { key: 'date', header: 'Tanggal', sortable: true, className: 'w-[130px]', render: (row) => <span className="text-slate-500">{formatDate(row.date)}</span>, exportValue: (row) => formatDate(row.date), sortValue: (row) => Date.parse(row.date) || 0 },
  { key: 'voucherNo', header: 'Nomor', sortable: true, className: 'w-[170px]', render: (row) => <span className="font-mono text-[13px] font-semibold text-slate-800">{row.voucherNo}</span>, exportValue: (row) => row.voucherNo, sortValue: (row) => row.voucherNo },
  { key: 'type', header: 'Type', sortable: true, className: 'w-[92px]', render: (row) => <TypeBadge type={row.type} />, exportValue: (row) => row.type, sortValue: (row) => row.type },
  { key: 'paidTo', header: 'Paid To', sortable: true, className: 'min-w-[180px]', render: (row) => <span className="font-medium text-slate-800">{row.paidTo || '-'}</span>, exportValue: (row) => row.paidTo || '-', sortValue: (row) => row.paidTo || '' },
  { key: 'amount', header: 'Amount', sortable: true, align: 'right', className: 'w-[160px]', render: (row) => <span className="font-bold text-slate-950">{formatCurrency(row.amount)}</span>, exportValue: (row) => formatCurrency(row.amount), sortValue: (row) => parseAmount(row.amount) },
  { key: 'amountInWords', header: 'Terbilang', className: 'min-w-[240px] max-w-[300px]', render: (row) => <span title={row.amountInWords} className="block max-w-[280px] truncate text-slate-500">{row.amountInWords}</span>, exportValue: (row) => row.amountInWords || '-', sortValue: (row) => row.amountInWords || '' },
  { key: 'status', header: 'Status', sortable: true, className: 'w-[120px]', render: (row) => <StatusBadge status={row.status} />, exportValue: (row) => row.status || '-', sortValue: (row) => row.status || '' },
];

function createDefaultVoucher(): Voucher {
  const amount = 0;
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    voucherNo: generateDocumentNumber('BBK', new Date(), 1, { style: 'voucher' }),
    type: 'BBK',
    paidTo: '',
    amount,
    amountInWords: rupiahTerbilang(amount),
    paymentMethod: 'Transfer',
    chequeNo: '',
    description: '',
    sourceLedgerId: '',
    supplierId: '',
    status: 'Draft',
  };
}

function getStatusBadgeClass(status: string) {
  const normalized = normalizeSearchText(status);
  if (normalized.includes('approved') || normalized.includes('paid') || normalized.includes('final')) return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized.includes('draft')) return 'border border-blue-200 bg-blue-50 text-blue-700';
  if (normalized.includes('rejected') || normalized.includes('cancel')) return 'border border-red-200 bg-red-50 text-red-700';
  if (normalized.includes('pending') || normalized.includes('submitted')) return 'border border-amber-200 bg-amber-50 text-amber-700';
  return 'border border-slate-200 bg-slate-50 text-slate-700';
}

function TypeBadge({ type }: { type: Voucher['type'] }) {
  return <Badge className="border border-blue-100 bg-blue-50 text-blue-700">{type}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={getStatusBadgeClass(status)}>{status || '-'}</Badge>;
}

function SummaryMetricCard({ label, value, meta, tone = 'blue' }: { label: string; value: string; meta?: string; tone?: 'blue' | 'green' | 'slate' }) {
  const toneClass = tone === 'green' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : tone === 'slate' ? 'bg-slate-50 text-slate-700 ring-slate-100' : 'bg-blue-50 text-blue-700 ring-blue-100';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClass}`}>{label}</div>
      <p className="text-xl font-bold tracking-tight text-slate-950">{value}</p>
      {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
    </div>
  );
}

function readVisibleColumns(): VoucherColumnKey[] {
  const fallback = voucherColumns.map((column) => column.key);
  try {
    const parsed = JSON.parse(localStorage.getItem(visibleColumnsKey) || '[]') as VoucherColumnKey[];
    const valid = parsed.filter((key) => fallback.includes(key));
    return valid.length > 0 ? valid : fallback;
  } catch {
    return fallback;
  }
}

function readRowsPerPage(): RowsPerPage {
  const stored = localStorage.getItem(rowsPerPageKey);
  if (stored === 'all') return 'all';
  if (stored === '25') return 25;
  if (stored === '50') return 50;
  return 10;
}

function readSelectedType(): 'Semua' | Voucher['type'] {
  const stored = localStorage.getItem(selectedTypeKey);
  return stored && (stored === 'Semua' || voucherTypes.includes(stored as Voucher['type'])) ? stored as 'Semua' | Voucher['type'] : 'Semua';
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'id-ID', { numeric: true, sensitivity: 'base' });
}

function toExportColumns(columns: VoucherColumn[], totalAmount: number): ExportColumn<Voucher>[] {
  return columns.map((column) => ({
    key: column.key,
    header: column.header,
    exportAccessor: column.exportValue,
    exportFooter: column.key === 'amount' ? () => formatCurrency(totalAmount) : undefined,
  }));
}

function voucherSearchText(row: Voucher) {
  return normalizeSearchText([
    row.date,
    formatDate(row.date),
    row.voucherNo,
    row.type,
    row.paidTo,
    row.amount,
    formatCurrency(row.amount),
    row.amountInWords,
    row.status,
  ].join(' '));
}

export function VoucherPage({ rows, setRows }: { rows: Voucher[]; setRows: (r: Voucher[]) => void }) {
  const [editing, setEditing] = React.useState<Voucher | null>(null);
  const [error, setError] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<'Semua' | Voucher['type']>(() => readSelectedType());
  const [sortConfig, setSortConfig] = React.useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState<RowsPerPage>(() => readRowsPerPage());
  const [visibleColumns, setVisibleColumns] = React.useState<VoucherColumnKey[]>(() => readVisibleColumns());
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = React.useState(false);
  const [exportMessage, setExportMessage] = React.useState('');
  const schema = z.object({ id: z.string().min(1), amount: z.number().min(0) }).passthrough();

  const visibleColumnDefs = React.useMemo(() => voucherColumns.filter((column) => visibleColumns.includes(column.key)), [visibleColumns]);

  const filteredRows = React.useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return rows.filter((row) => {
      const matchesType = selectedType === 'Semua' || row.type === selectedType;
      const matchesSearch = !query || voucherSearchText(row).includes(query);
      return matchesType && matchesSearch;
    });
  }, [rows, searchQuery, selectedType]);

  const sortedRows = React.useMemo(() => {
    if (!sortConfig) return filteredRows;
    const column = voucherColumns.find((item) => item.key === sortConfig.key);
    if (!column) return filteredRows;
    return [...filteredRows].sort((a, b) => (sortConfig.direction === 'asc' ? 1 : -1) * compareValues(column.sortValue(a), column.sortValue(b)));
  }, [filteredRows, sortConfig]);

  const totalAmount = React.useMemo(() => sortedRows.reduce((sum, row) => sum + parseAmount(row.amount), 0), [sortedRows]);
  const approvedCount = React.useMemo(() => rows.filter((row) => normalizeSearchText(row.status).includes('approved')).length, [rows]);
  const totalPages = React.useMemo(() => rowsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(sortedRows.length / rowsPerPage)), [rowsPerPage, sortedRows.length]);
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = React.useMemo(() => rowsPerPage === 'all' ? sortedRows : sortedRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage), [rowsPerPage, safePage, sortedRows]);
  const rowCountText = React.useMemo(() => {
    const from = sortedRows.length === 0 ? 0 : rowsPerPage === 'all' ? 1 : (safePage - 1) * rowsPerPage + 1;
    const to = rowsPerPage === 'all' ? sortedRows.length : Math.min(safePage * rowsPerPage, sortedRows.length);
    return `Menampilkan ${from}–${to} dari ${sortedRows.length}`;
  }, [rowsPerPage, safePage, sortedRows.length]);
  const hasActiveFilter = searchQuery.trim() !== '' || selectedType !== 'Semua';

  React.useEffect(() => setCurrentPage(1), [searchQuery, selectedType, rowsPerPage]);
  React.useEffect(() => { localStorage.setItem(visibleColumnsKey, JSON.stringify(visibleColumns)); }, [visibleColumns]);
  React.useEffect(() => { localStorage.setItem(rowsPerPageKey, String(rowsPerPage)); }, [rowsPerPage]);
  React.useEffect(() => { localStorage.setItem(selectedTypeKey, selectedType); }, [selectedType]);

  const getExportMeta = React.useCallback(() => ({
    appName: APP_NAME,
    module: MODULE_NAME,
    exportedAt: new Date().toISOString(),
    period: PERIOD,
    totalRows: sortedRows.length,
    totalAmount,
    filters: { search: searchQuery, type: selectedType },
    visibleColumns,
  }), [searchQuery, selectedType, sortedRows.length, totalAmount, visibleColumns]);

  const runExport = React.useCallback((type: 'csv' | 'excel' | 'json' | 'print') => {
    setExportMessage('');
    setIsExportMenuOpen(false);
    if (sortedRows.length === 0) {
      setExportMessage('Tidak ada data untuk diekspor.');
      return;
    }
    try {
      const exportColumns = toExportColumns(visibleColumnDefs, totalAmount);
      const meta = getExportMeta();
      if (type === 'csv') exportToCsv(sortedRows, exportColumns, voucherFilename('csv'));
      if (type === 'excel') exportToExcel({ rows: sortedRows, columns: exportColumns, filename: voucherFilename('xlsx'), sheetName: 'Voucher', includeFooter: true });
      if (type === 'json') exportToJson({ ...meta, rows: sortedRows.map((row) => Object.fromEntries(visibleColumnDefs.map((column) => [column.key, column.exportValue(row)]))) }, voucherFilename('json'));
      if (type === 'print') printVoucherTable(sortedRows, exportColumns, { ...meta, title, totalAmount });
      setExportMessage('Export berhasil dibuat.');
    } catch (err) {
      console.error(err);
      setExportMessage('Export gagal. Coba lagi.');
    }
  }, [getExportMeta, sortedRows, totalAmount, visibleColumnDefs]);

  React.useEffect(() => {
    const handler = () => runExport('csv');
    window.addEventListener('prime:voucher-quick-export', handler);
    return () => window.removeEventListener('prime:voucher-quick-export', handler);
  }, [runExport]);

  const save = () => {
    if (!editing) return;
    const nextEditing = { ...editing, amount: parseAmount(editing.amount), amountInWords: rupiahTerbilang(parseAmount(editing.amount)) };
    const result = schema.safeParse(nextEditing);
    if (!result.success) {
      setError('ID dan field wajib harus valid. Amount tidak boleh negatif.');
      return;
    }
    const isUpdate = rows.some((row) => row.id === nextEditing.id);
    const next = isUpdate ? rows.map((row) => (row.id === nextEditing.id ? nextEditing : row)) : [nextEditing, ...rows];
    setRows(next);
    writeStorage('vouchers', next as unknown as AppData['vouchers']);
    addAudit(title, isUpdate ? 'update' : 'create', nextEditing.id, nextEditing.voucherNo, `${title} disimpan`);
    setEditing(null);
    setError('');
  };

  const remove = (row: Voucher) => {
    const next = rows.filter((item) => item.id !== row.id);
    setRows(next);
    writeStorage('vouchers', next as unknown as AppData['vouchers']);
    addAudit(title, 'delete', row.id, row.voucherNo, `${title} dihapus`);
  };

  const handleSort = (key: VoucherColumnKey) => {
    const column = voucherColumns.find((item) => item.key === key);
    if (!column?.sortable) return;
    setSortConfig((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const toggleColumn = (key: VoucherColumnKey) => {
    setVisibleColumns((current) => {
      if (current.includes(key) && current.length === 1) return current;
      return current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    });
  };

  const resetFilter = () => {
    setSearchQuery('');
    setSelectedType('Semua');
  };

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">{MODULE_NAME}</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button className="h-10 px-4 shadow-sm shadow-blue-600/20" onClick={() => setEditing(createDefaultVoucher())}><Plus size={16} />Tambah Voucher</Button>
            <Button variant="outline" className="h-10 border-slate-200 bg-white px-4" onClick={() => runExport('print')}><Printer size={16} /> Print</Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetricCard label="Total Voucher" value={`${sortedRows.length} dokumen`} meta={hasActiveFilter ? 'Mengikuti search/filter aktif' : 'Semua tipe voucher aktif'} />
        <SummaryMetricCard label="Total Amount" value={formatCurrency(totalAmount)} meta="Akumulasi nilai hasil filter" tone="slate" />
        <SummaryMetricCard label="Status" value={`${approvedCount} Approved`} meta="Badge status ditampilkan di tabel" tone="green" />
      </div>

      <Card className="overflow-visible shadow-sm shadow-slate-200/70">
        <CardHeader>
          <CardTitle>Daftar Voucher</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Kelola voucher pembayaran dan penerimaan dengan pencarian, filter tipe, print, dan export.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center">
              <label className="relative w-full max-w-xl">
                <span className="sr-only">Search data voucher</span>
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <Input aria-label="Search data voucher" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nomor, penerima, tipe, tanggal, status, atau nominal..." className="w-full pl-9" />
              </label>
              <label className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter size={14} /> Tipe</span>
                <Select aria-label="Filter tipe voucher" value={selectedType} onChange={(event) => setSelectedType(event.target.value as 'Semua' | Voucher['type'])} className="w-32">
                  <option>Semua</option>
                  {voucherTypes.map((type) => <option key={type}>{type}</option>)}
                </Select>
              </label>
              <Badge variant="outline" className="h-9 w-fit border-slate-200 bg-slate-50 px-3 text-slate-600">{sortedRows.length} baris</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <div className="relative">
                <Button type="button" variant="outline" className="w-full sm:w-auto" aria-expanded={isExportMenuOpen} onClick={() => setIsExportMenuOpen((open) => !open)}><Download size={16} /> Export <ChevronDown size={14} /></Button>
                {isExportMenuOpen && (
                  <div className="absolute right-0 z-30 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('csv')}><FileText size={15} /> Export CSV</button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('excel')}><FileSpreadsheet size={15} /> Export Excel</button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('json')}><FileText size={15} /> Export JSON</button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => runExport('print')}><Printer size={15} /> Print View</button>
                  </div>
                )}
              </div>
              <div className="relative">
                <Button type="button" variant="outline" className="w-full sm:w-auto" aria-expanded={isColumnMenuOpen} onClick={() => setIsColumnMenuOpen((open) => !open)}><Columns3 size={16} /> Columns <ChevronDown size={14} /></Button>
                {isColumnMenuOpen && (
                  <div className="absolute right-0 z-30 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tampilkan kolom</p>
                    {voucherColumns.map((column) => {
                      const checked = visibleColumns.includes(column.key);
                      return (
                        <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                          <input type="checkbox" checked={checked} disabled={checked && visibleColumns.length === 1} onChange={() => toggleColumn(column.key)} />
                          {column.header}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <Select aria-label="Rows per page" value={String(rowsPerPage)} onChange={(event) => setRowsPerPage(event.target.value === 'all' ? 'all' : Number(event.target.value) as RowsPerPage)} className="w-full sm:w-32">
                <option value="10">10/hal</option>
                <option value="25">25/hal</option>
                <option value="50">50/hal</option>
                <option value="all">Semua</option>
              </Select>
            </div>
          </div>

          {(hasActiveFilter || exportMessage) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
              <div>
                {hasActiveFilter && <span>Filter aktif: {searchQuery.trim() ? `Search “${searchQuery.trim()}”` : 'Search kosong'} • Tipe {selectedType}</span>}
                {exportMessage && <span className={hasActiveFilter ? 'ml-3 font-semibold' : 'font-semibold'}>{exportMessage}</span>}
              </div>
              {hasActiveFilter && <Button type="button" variant="outline" className="h-8 border-blue-200 bg-white px-3 text-xs" onClick={resetFilter}>Reset Filter</Button>}
            </div>
          )}

          {paginatedRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-lg font-bold text-slate-900">Data tidak ditemukan</p>
              <p className="mt-1 text-sm text-slate-500">Coba ubah kata kunci atau filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <Table className="min-w-[980px] print-table">
                <thead className="sticky top-0 z-10 bg-slate-50/95">
                  <tr>
                    {visibleColumnDefs.map((column) => {
                      const active = sortConfig?.key === column.key;
                      return (
                        <th key={column.key} aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => handleSort(column.key)} className={cn('whitespace-nowrap px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600', column.sortable && 'cursor-pointer select-none hover:bg-slate-100', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center', column.className)}>
                          <span className="inline-flex items-center gap-1">{column.header}{active && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</span>
                        </th>
                      );
                    })}
                    <th className="w-[120px] whitespace-nowrap px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id} className="h-14 border-t border-slate-100 transition-colors hover:bg-blue-50/35">
                      {visibleColumnDefs.map((column) => (
                        <td key={column.key} className={cn('whitespace-nowrap px-4 py-3 text-[13px] text-slate-700', column.align === 'right' && 'text-right tabular-nums', column.align === 'center' && 'text-center', column.className)}>{column.render(row)}</td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" className="h-10 w-10 px-0 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label={`Edit voucher ${row.voucherNo}`} onClick={() => setEditing(row)}><Pencil size={16} /></Button>
                          <Button type="button" variant="ghost" className="h-10 w-10 px-0 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus voucher ${row.voucherNo}`} onClick={() => remove(row)}><Trash2 size={16} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-blue-50/60 font-semibold text-slate-800">
                  <tr>
                    {visibleColumnDefs.map((column, index) => (
                      <td key={column.key} className={cn('whitespace-nowrap px-4 py-4 text-sm', column.align === 'right' && 'text-right tabular-nums', column.align === 'center' && 'text-center')}>
                        {column.key === 'amount' ? <span className="text-base font-extrabold text-slate-950">{formatCurrency(totalAmount)}</span> : index === 0 ? <span className="font-bold text-slate-900">Total</span> : ''}
                      </td>
                    ))}
                    <td className="px-4 py-4" />
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{rowCountText}</span>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={14} /> Previous</Button>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">{safePage}/{totalPages}</span>
              <Button type="button" variant="outline" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next <ChevronRight size={14} /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing}>
        {editing && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Form {title}</h2>
              <p className="text-sm text-slate-500">Nomor dokumen otomatis bisa diedit sebelum disimpan.</p>
            </div>
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className="text-sm font-medium">Tanggal</span><Input type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Nomor</span><Input value={editing.voucherNo} onChange={(event) => setEditing({ ...editing, voucherNo: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Tipe</span><Select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as Voucher['type'] })}>{voucherTypes.map((type) => <option key={type}>{type}</option>)}</Select></label>
              <label className="space-y-1"><span className="text-sm font-medium">Dibayar Kepada</span><Input value={editing.paidTo} onChange={(event) => setEditing({ ...editing, paidTo: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Amount</span><Input type="number" value={String(editing.amount)} onChange={(event) => setEditing({ ...editing, amount: Number(event.target.value), amountInWords: rupiahTerbilang(Number(event.target.value) || 0) })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Metode</span><Input value={editing.paymentMethod} onChange={(event) => setEditing({ ...editing, paymentMethod: event.target.value })} /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Deskripsi</span><Textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Status</span><Input value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditing(null); setError(''); }}>Batal</Button>
              <Button onClick={save}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
