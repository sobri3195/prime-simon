import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Clipboard, Columns3, Download, FileSpreadsheet, FileText, Printer, Search, Trash2, Pencil } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Table } from '../ui/basic';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';
import { copyTableToClipboard, exportToCSV, exportToExcel, exportToPDF, printTable, type ExportColumn } from '@/lib/export';
import { formatCurrency, formatDate, formatNumber, safeString } from '@/lib/format';
import { toast } from '@/lib/toast';

export type DataTableColumn<T> = {
  key: keyof T | string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  exportAccessor?: (row: T) => string | number;
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean;
  isDate?: boolean;
  isNumber?: boolean;
  enableSorting?: boolean;
  enableExport?: boolean;
  footer?: (rows: T[]) => React.ReactNode;
  exportFooter?: (rows: T[]) => string | number;
  className?: string;
  cell?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  total?: (rows: T[]) => React.ReactNode;
};

export type Column<T> = DataTableColumn<T>;

export type DataTableProps<T> = {
  title?: string;
  description?: string;
  data?: T[];
  rows?: T[];
  columns: DataTableColumn<T>[];
  filename?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  enableExport?: boolean;
  enableCopy?: boolean;
  enableCSV?: boolean;
  enableExcel?: boolean;
  enablePDF?: boolean;
  enablePrint?: boolean;
  enableColumnVisibility?: boolean;
  enablePagination?: boolean;
  enableSorting?: boolean;
  pageSize?: number;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  toolbarFilters?: React.ReactNode;
  getRowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
};

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

function getValueByPath(row: unknown, key: string) {
  return key.split('.').reduce<unknown>((value, part) => {
    if (value && typeof value === 'object' && part in value) return (value as Record<string, unknown>)[part];
    return undefined;
  }, row);
}

function renderPlainNode(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderPlainNode).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return renderPlainNode(node.props.children);
  return '';
}

function getRawValue<T>(row: T, column: DataTableColumn<T>) {
  if (column.exportAccessor) return column.exportAccessor(row);
  if (column.sortValue) return column.sortValue(row);
  const value = getValueByPath(row, String(column.key));
  if (value !== undefined) return value;
  return renderPlainNode((column.accessor || column.cell)?.(row));
}

function formatDisplayValue<T>(row: T, column: DataTableColumn<T>) {
  const custom = column.accessor || column.cell;
  if (custom) return custom(row);
  const value = getRawValue(row, column);
  if (value === null || value === undefined || value === '') return '-';
  if (column.isCurrency) return formatCurrency(Number(value));
  if (column.isNumber) return formatNumber(Number(value));
  if (column.isDate) return formatDate(value as string | Date);
  return safeString(value) || '-';
}

function searchableText<T>(row: T, columns: DataTableColumn<T>[]) {
  const columnValues = columns.map((column) => safeString(getRawValue(row, column))).join(' ');
  return `${columnValues} ${safeString(row)}`.toLowerCase();
}

function compareValues(a: unknown, b: unknown) {
  const aNumber = typeof a === 'number' ? a : Number(String(a).replace(/[^0-9.-]/g, ''));
  const bNumber = typeof b === 'number' ? b : Number(String(b).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && String(a) !== '' && String(b) !== '') return aNumber - bNumber;
  const aDate = Date.parse(String(a));
  const bDate = Date.parse(String(b));
  if (Number.isFinite(aDate) && Number.isFinite(bDate)) return aDate - bDate;
  return safeString(a).localeCompare(safeString(b), 'id-ID', { numeric: true, sensitivity: 'base' });
}

function toExportColumns<T>(columns: DataTableColumn<T>[]): ExportColumn<T>[] {
  return columns.map((column) => ({
    key: column.key,
    header: column.header,
    exportAccessor: column.exportAccessor || ((row: T) => {
      const value = getRawValue(row, column);
      if (column.isCurrency || column.isNumber) return Number(value) || 0;
      if (column.isDate) return formatDate(value as string | Date);
      return safeString(value);
    }),
    isCurrency: column.isCurrency,
    isDate: column.isDate,
    isNumber: column.isNumber,
    enableExport: column.enableExport,
    exportFooter: column.exportFooter || (column.total ? (rows: T[]) => renderPlainNode(column.total?.(rows)) : undefined),
  }));
}

function Dropdown({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  return (
    <details className="relative min-w-0">
      <summary className="list-none">
        <Button type="button" variant="outline" className="w-full cursor-pointer sm:w-auto">
          <Icon size={16} /> {label} <ChevronDown size={14} />
        </Button>
      </summary>
      <div className="absolute left-0 z-30 mt-2 min-w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1 shadow-lg sm:left-auto sm:right-0">
        {children}
      </div>
    </details>
  );
}

export function DataTable<T extends Record<string, unknown> | object>({
  title,
  description,
  data,
  rows,
  columns,
  filename,
  searchable = true,
  searchPlaceholder = 'Cari data...',
  enableExport = true,
  enableCopy = true,
  enableCSV = true,
  enableExcel = true,
  enablePDF = true,
  enablePrint = true,
  enableColumnVisibility = true,
  enablePagination = true,
  enableSorting = true,
  pageSize = 10,
  loading = false,
  error,
  emptyMessage = 'Tidak ada data yang ditemukan.',
  emptyDescription,
  emptyAction,
  toolbarFilters,
  getRowClassName,
  onRowClick,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  const sourceRows = React.useMemo(() => data ?? rows ?? [], [data, rows]);
  const allColumns = React.useMemo<DataTableColumn<T>[]>(() => {
    const base = columns.map((column) => ({ ...column, accessor: column.accessor || column.cell, footer: column.footer || column.total }));
    if (!onEdit && !onDelete) return base;
    return [
      ...base,
      {
        key: '__actions',
        header: 'Aksi',
        enableExport: false,
        enableSorting: false,
        align: 'right',
        accessor: (row: T) => (
          <div className="flex justify-end gap-1.5">
            {onEdit && <Button type="button" variant="ghost" className="h-8 w-8 px-0 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label="Edit baris" onClick={(event) => { event.stopPropagation(); onEdit(row); }}><Pencil size={16} /></Button>}
            {onDelete && <Button type="button" variant="ghost" className="h-8 w-8 px-0 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Hapus baris" onClick={(event) => { event.stopPropagation(); onDelete(row); }}><Trash2 size={16} /></Button>}
          </div>
        ),
      } satisfies DataTableColumn<T>,
    ];
  }, [columns, onDelete, onEdit]);
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<SortState>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [currentPageSize, setCurrentPageSize] = React.useState(pageSize);
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => setCurrentPage(1), [query, currentPageSize, sourceRows.length]);

  const visibleColumns = allColumns.filter((column) => visibility[String(column.key)] !== false);
  const searchableColumns = visibleColumns.filter((column) => column.enableExport !== false);
  const exportColumns = visibleColumns.filter((column) => column.enableExport !== false);
  const hasFooter = visibleColumns.some((column) => column.footer || column.exportFooter || column.total);

  const filteredRows = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!searchable || !normalized) return sourceRows;
    return sourceRows.filter((row) => searchableText(row, searchableColumns).includes(normalized));
  }, [query, searchable, searchableColumns, sourceRows]);

  const sortedRows = React.useMemo(() => {
    if (!sort || !enableSorting) return filteredRows;
    const column = allColumns.find((item) => String(item.key) === sort.key);
    if (!column || column.enableSorting === false) return filteredRows;
    return [...filteredRows].sort((a, b) => (sort.direction === 'asc' ? 1 : -1) * compareValues(getRawValue(a, column), getRawValue(b, column)));
  }, [allColumns, enableSorting, filteredRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / currentPageSize));
  const safePage = Math.min(currentPage, pageCount);
  const pageRows = enablePagination ? sortedRows.slice((safePage - 1) * currentPageSize, safePage * currentPageSize) : sortedRows;
  const from = sortedRows.length === 0 ? 0 : (safePage - 1) * currentPageSize + 1;
  const to = enablePagination ? Math.min(safePage * currentPageSize, sortedRows.length) : sortedRows.length;
  const exportFilename = filename || title?.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'data';
  const exportPayload = { filename: exportFilename, rows: sortedRows, columns: toExportColumns(exportColumns), includeFooter: hasFooter };

  const ensureHasData = () => {
    if (sortedRows.length > 0) return true;
    toast.error('Tidak ada data untuk diexport');
    return false;
  };

  const runExport = async (type: 'copy' | 'csv' | 'excel' | 'pdf' | 'print') => {
    if (!ensureHasData()) return;
    try {
      if (type === 'copy') { await copyTableToClipboard(exportPayload); toast.success('Data berhasil disalin ke clipboard'); }
      if (type === 'csv') { exportToCSV(exportPayload); toast.success('CSV berhasil diexport'); }
      if (type === 'excel') { exportToExcel({ ...exportPayload, sheetName: 'Data' }); toast.success('Excel berhasil diexport'); }
      if (type === 'pdf') { exportToPDF({ ...exportPayload, title: title || 'Data', subtitle: description }); toast.success('PDF berhasil diexport'); }
      if (type === 'print') { printTable({ ...exportPayload, title: title || 'Data', subtitle: description }); toast.success('Print dibuka'); }
    } catch (error) {
      console.error(error);
      toast.error(type === 'copy' ? 'Gagal menyalin data' : 'Tidak ada data untuk diexport');
    }
  };

  const handleSort = (column: DataTableColumn<T>) => {
    if (!enableSorting || column.enableSorting === false) return;
    const key = String(column.key);
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  return (
    <Card className="overflow-hidden shadow-sm shadow-slate-200/70">
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            {searchable && (
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="w-full pl-9" />
              </div>
            )}
            {toolbarFilters}
            <Badge variant="outline" className="h-9 border-slate-200 bg-slate-50 px-3 text-slate-600">{sortedRows.length} baris</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            {enableExport && (
              <Dropdown label="Export" icon={Download}>
                {enableCopy && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void runExport('copy')}><Clipboard size={15} /> Copy Clipboard</button>}
                {enableCSV && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void runExport('csv')}><FileText size={15} /> Export CSV</button>}
                {enableExcel && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void runExport('excel')}><FileSpreadsheet size={15} /> Export Excel</button>}
                {enablePDF && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void runExport('pdf')}><FileText size={15} /> Export PDF</button>}
                {enablePrint && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void runExport('print')}><Printer size={15} /> Print</button>}
              </Dropdown>
            )}
            {enableColumnVisibility && (
              <Dropdown label="Columns" icon={Columns3}>
                {allColumns.map((column) => (
                  <label key={String(column.key)} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={visibility[String(column.key)] !== false} onChange={(event) => setVisibility((current) => ({ ...current, [String(column.key)]: event.target.checked }))} />
                    {column.header}
                  </label>
                ))}
              </Dropdown>
            )}
            {enablePagination && (
              <Select value={String(currentPageSize)} onChange={(event) => setCurrentPageSize(Number(event.target.value))} className="w-full sm:w-28">
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}/hal</option>)}
              </Select>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
        ) : loading ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="space-y-3 bg-white p-4">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          </div>
        ) : pageRows.length === 0 ? (
          <EmptyState title={emptyMessage} description={emptyDescription} action={emptyAction} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <Table className="min-w-[980px] print-table">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr>
                  {visibleColumns.map((column) => {
                    const active = sort?.key === String(column.key);
                    return (
                      <th key={String(column.key)} onClick={() => handleSort(column)} className={cn('whitespace-nowrap px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600', enableSorting && column.enableSorting !== false && 'cursor-pointer select-none hover:bg-slate-100', (column.align === 'right' || column.isCurrency || column.isNumber) && 'text-right', column.align === 'center' && 'text-center', column.className)}>
                        <span className="inline-flex items-center gap-1">{column.header}{active && <span>{sort?.direction === 'asc' ? '▲' : '▼'}</span>}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rowIndex) => (
                  <tr key={(row as { id?: string | number }).id ?? rowIndex} onClick={() => onRowClick?.(row)} className={cn('h-14 border-t border-slate-100 transition-colors hover:bg-blue-50/35', onRowClick && 'cursor-pointer', getRowClassName?.(row))}>
                    {visibleColumns.map((column) => (
                      <td key={String(column.key)} className={cn('whitespace-nowrap px-4 py-3 text-[13px] text-slate-700', (column.align === 'right' || column.isCurrency || column.isNumber) && 'text-right tabular-nums', column.align === 'center' && 'text-center', column.className)}>
                        {formatDisplayValue(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {hasFooter && (
                <tfoot className="border-t border-slate-200 bg-blue-50/60 font-semibold text-slate-800">
                  <tr>
                    {visibleColumns.map((column, index) => (
                      <td key={String(column.key)} className={cn('whitespace-nowrap px-4 py-4 text-sm', (column.align === 'right' || column.isCurrency || column.isNumber) && 'text-right tabular-nums', column.align === 'center' && 'text-center')}>
                        {column.footer ? column.footer(sortedRows) : column.total ? column.total(sortedRows) : index === 0 ? <span className="font-bold text-slate-900">Total</span> : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </Table>
            </div>
          </>
        )}

        {enablePagination && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Menampilkan {from}–{to} dari {sortedRows.length}</span>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={14} /> Previous</Button>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">{safePage}/{pageCount}</span>
              <Button type="button" variant="outline" disabled={safePage >= pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>Next <ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
