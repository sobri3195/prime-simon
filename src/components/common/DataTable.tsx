import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clipboard, Columns3, Download, FileSpreadsheet, FileText, Printer, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Pencil } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../ui/basic';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatNumber, safeString, toDate } from '@/lib/format';
import { copyTableToClipboard, exportToCSV, exportToExcel, exportToPDF, printTable } from '@/lib/export';
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
};

export type DataTableProps<T> = {
  title?: string;
  description?: string;
  data?: T[];
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
  emptyMessage?: string;
  getRowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
};

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  total?: (rows: T[]) => React.ReactNode;
};

type LegacyProps<T extends { id?: string; status?: string }> = {
  rows?: T[];
  columns: Column<T>[];
  onEdit?: (r: T) => void;
  onDelete?: (r: T) => void;
  searchPlaceholder?: string;
};

type SortState = { key: string; direction: 'asc' | 'desc' } | null;
const pageSizes = [10, 25, 50, 100];

function getNestedValue(row: unknown, path: string) {
  if (!row || !path) return undefined;
  return path.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), row);
}

function columnValue<T>(row: T, column: DataTableColumn<T>) {
  if (column.exportAccessor) return column.exportAccessor(row);
  return getNestedValue(row, String(column.key));
}

function displayValue<T>(row: T, column: DataTableColumn<T>) {
  if (column.accessor) return column.accessor(row);
  const value = columnValue(row, column);
  if (column.isCurrency) return formatCurrency(Number(value || 0));
  if (column.isNumber) return formatNumber(Number(value || 0));
  if (column.isDate) return formatDate(value as string | Date);
  return safeString(value) || '-';
}

function searchableValue<T>(row: T, column: DataTableColumn<T>) {
  const value = columnValue(row, column);
  if (column.isDate && value) return `${safeString(value)} ${formatDate(value as string | Date)}`;
  return safeString(value);
}

function compareValues<T>(a: T, b: T, column: DataTableColumn<T>) {
  const av = columnValue(a, column);
  const bv = columnValue(b, column);
  if (column.isDate) {
    return (toDate(av as string)?.getTime() || 0) - (toDate(bv as string)?.getTime() || 0);
  }
  if (column.isCurrency || column.isNumber || typeof av === 'number' || typeof bv === 'number') {
    return Number(av || 0) - Number(bv || 0);
  }
  return safeString(av).localeCompare(safeString(bv), 'id-ID', { numeric: true, sensitivity: 'base' });
}

function alignClass(align?: string) {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function isLegacyProps<T>(props: DataTableProps<T> | LegacyProps<any>): props is LegacyProps<any> {
  return 'rows' in props;
}

export function DataTable(props: LegacyProps<any>): React.ReactElement;
export function DataTable<T>(props: DataTableProps<T>): React.ReactElement;
export function DataTable<T>(props: DataTableProps<T> | LegacyProps<any>) {
  const legacy = isLegacyProps(props);
  const legacyActions = legacy && (props.onEdit || props.onDelete);
  const normalizedColumns = React.useMemo<DataTableColumn<T>[]>(() => {
    const base = props.columns.map((column: DataTableColumn<T> | Column<T>) => {
      if ('cell' in column) {
        return {
          key: column.key,
          header: column.header,
          accessor: column.cell,
          exportAccessor: column.sortValue || ((row: T) => safeString(column.cell(row))),
          footer: column.total,
          exportFooter: column.total ? (rows: T[]) => safeString(column.total?.(rows)) : undefined,
          enableSorting: true,
        } satisfies DataTableColumn<T>;
      }
      return column;
    });
    if (legacyActions) {
      base.push({
        key: '__actions',
        header: 'Aksi',
        enableExport: false,
        align: 'right',
        accessor: (row) => (
          <div className="flex justify-end gap-1">
            {props.onEdit && <Button variant="ghost" onClick={(event) => { event.stopPropagation(); props.onEdit?.(row); }}><Pencil size={14} /></Button>}
            {props.onDelete && <Button variant="ghost" onClick={(event) => { event.stopPropagation(); props.onDelete?.(row); }}><Trash2 size={14} /></Button>}
          </div>
        ),
      });
    }
    return base;
  }, [props.columns, legacyActions, legacy ? props.onEdit : undefined, legacy ? props.onDelete : undefined]);

  const data = React.useMemo<T[]>(() => (legacy ? (props.rows || []) : (props.data || [])), [legacy, props]);
  const title = legacy ? undefined : props.title;
  const description = legacy ? undefined : props.description;
  const filename = legacy ? 'data-table' : props.filename;
  const searchable = legacy ? true : props.searchable !== false;
  const enableExport = legacy ? true : props.enableExport !== false;
  const enableCopy = legacy ? true : props.enableCopy !== false;
  const enableCSV = legacy ? true : props.enableCSV !== false;
  const enableExcel = legacy ? true : props.enableExcel !== false;
  const enablePDF = legacy ? true : props.enablePDF !== false;
  const enablePrint = legacy ? true : props.enablePrint !== false;
  const enableColumnVisibility = legacy ? true : props.enableColumnVisibility !== false;
  const enablePagination = legacy ? true : props.enablePagination !== false;
  const enableSorting = legacy ? true : props.enableSorting !== false;
  const emptyMessage = legacy ? 'Belum ada data.' : props.emptyMessage || 'Belum ada data.';
  const onRowClick = legacy ? undefined : props.onRowClick;
  const getRowClassName = legacy ? undefined : props.getRowClassName;

  const [query, setQuery] = React.useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [sort, setSort] = React.useState<SortState>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(legacy ? 10 : props.pageSize || 10);
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>(() => Object.fromEntries(normalizedColumns.map((column) => [String(column.key), true])));
  const [exportOpen, setExportOpen] = React.useState(false);
  const [columnsOpen, setColumnsOpen] = React.useState(false);

  React.useEffect(() => {
    setColumnVisibility((current) => ({ ...Object.fromEntries(normalizedColumns.map((column) => [String(column.key), true])), ...current }));
  }, [normalizedColumns]);

  const visibleColumns = normalizedColumns.filter((column) => columnVisibility[String(column.key)] !== false);
  const searchColumns = visibleColumns.filter((column) => column.enableExport !== false);
  const hasFooter = visibleColumns.some((column) => column.footer);

  const filteredRows = React.useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    const needle = debouncedQuery.trim().toLowerCase();
    if (!searchable || !needle) return source;
    return source.filter((row) => searchColumns.some((column) => searchableValue(row, column).toLowerCase().includes(needle)));
  }, [data, debouncedQuery, searchColumns, searchable]);

  const sortedRows = React.useMemo(() => {
    if (!sort) return filteredRows;
    const column = visibleColumns.find((item) => String(item.key) === sort.key);
    if (!column) return filteredRows;
    return [...filteredRows].sort((a, b) => compareValues(a, b, column) * (sort.direction === 'asc' ? 1 : -1));
  }, [filteredRows, sort, visibleColumns]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = enablePagination ? sortedRows.slice((page - 1) * pageSize, page * pageSize) : sortedRows;
  const start = sortedRows.length ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, sortedRows.length);

  React.useEffect(() => setPage(1), [debouncedQuery, pageSize]);
  React.useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const exportColumns = visibleColumns.filter((column) => column.enableExport !== false);
  const canExport = () => {
    if (!sortedRows.length) {
      toast.warning('Tidak ada data untuk diexport.');
      return false;
    }
    return true;
  };
  const handleExport = (action: 'copy' | 'csv' | 'excel' | 'pdf' | 'print') => {
    setExportOpen(false);
    if (!canExport()) return;
    const args = { rows: sortedRows, columns: exportColumns, filename, title: title || 'Data', subtitle: description, includeFooter: true };
    if (action === 'copy') copyTableToClipboard(args);
    if (action === 'csv') exportToCSV(args);
    if (action === 'excel') exportToExcel({ ...args, sheetName: title || 'Data' });
    if (action === 'pdf') exportToPDF(args);
    if (action === 'print') printTable(args);
  };

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!enableSorting || column.enableSorting === false) return;
    const key = String(column.key);
    setSort((current) => current?.key !== key ? { key, direction: 'asc' } : current.direction === 'asc' ? { key, direction: 'desc' } : null);
  };

  return (
    <Card className="overflow-hidden">
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {searchable && (
              <div className="relative min-w-[220px] max-w-md flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={props.searchPlaceholder || 'Cari data...'} className="w-full pl-9" />
              </div>
            )}
            <Badge variant="outline">{sortedRows.length} data</Badge>
            {enablePagination && <Select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizes.map((size) => <option key={size} value={size}>{size} / halaman</option>)}</Select>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {enableExport && (
              <div className="relative">
                <Button variant="outline" onClick={() => setExportOpen((open) => !open)}><Download size={16} /> Export <ChevronDown size={14} /></Button>
                {exportOpen && <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl">
                  <div className="px-3 py-2 text-xs font-semibold uppercase text-slate-400">Export Semua Hasil Filter</div>
                  {enableCopy && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => handleExport('copy')}><Clipboard size={15} /> Copy</button>}
                  {enableCSV && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => handleExport('csv')}><FileText size={15} /> CSV</button>}
                  {enableExcel && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => handleExport('excel')}><FileSpreadsheet size={15} /> Excel / XLSX</button>}
                  {enablePDF && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => handleExport('pdf')}><FileText size={15} /> PDF</button>}
                  {enablePrint && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => handleExport('print')}><Printer size={15} /> Print</button>}
                  <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">Export Halaman Ini belum diaktifkan; default memakai semua hasil filter.</div>
                </div>}
              </div>
            )}
            {enableColumnVisibility && (
              <div className="relative">
                <Button variant="outline" onClick={() => setColumnsOpen((open) => !open)}><Columns3 size={16} /> Columns <ChevronDown size={14} /></Button>
                {columnsOpen && <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
                  {normalizedColumns.map((column) => <label key={String(column.key)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={columnVisibility[String(column.key)] !== false} onChange={(event) => setColumnVisibility((current) => ({ ...current, [String(column.key)]: event.target.checked }))} /> <span>{column.header}</span></label>)}
                </div>}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] text-sm print-table">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>{visibleColumns.map((column) => {
                const sortActive = sort?.key === String(column.key);
                return <th key={String(column.key)} onClick={() => toggleSort(column)} className={cn('whitespace-nowrap px-3 py-3 font-semibold text-slate-600', alignClass(column.align), enableSorting && column.enableSorting !== false && 'cursor-pointer select-none hover:bg-slate-100')}>
                  <span className={cn('inline-flex items-center gap-1', column.align === 'right' && 'justify-end')}>{column.header}{enableSorting && column.enableSorting !== false && (sortActive ? (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} className="text-slate-300" />)}</span>
                </th>;
              })}</tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? <tr><td colSpan={Math.max(1, visibleColumns.length)}><div className="py-8"><EmptyState title={emptyMessage} /></div></td></tr> : paginatedRows.map((row, index) => <tr key={(row as any).id || index} onClick={() => onRowClick?.(row)} className={cn('border-t border-slate-100 hover:bg-slate-50', onRowClick && 'cursor-pointer', getRowClassName?.(row))}>{visibleColumns.map((column) => <td key={String(column.key)} className={cn('px-3 py-3 align-top', alignClass(column.align), (column.isDate || column.isCurrency || column.isNumber) && 'whitespace-nowrap')}>{displayValue(row, column)}</td>)}</tr>)}
            </tbody>
            {hasFooter && <tfoot className="border-t bg-slate-50 font-semibold"><tr>{visibleColumns.map((column) => <td key={String(column.key)} className={cn('px-3 py-3', alignClass(column.align))}>{column.footer?.(sortedRows)}</td>)}</tr></tfoot>}
          </table>
        </div>

        {enablePagination && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Menampilkan {start}-{end} dari {sortedRows.length} data</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft size={14} /></Button>
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={14} /></Button>
            <span className="min-w-20 text-center text-sm text-slate-600">{page}/{totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight size={14} /></Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={14} /></Button>
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}
