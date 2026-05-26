import * as React from 'react';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { exportToCSV, exportToExcel, exportToJSON, printVoucherTable, type ExportColumn } from '@/lib/export';
import { formatCurrency, formatDate } from '@/lib/format';
import type { InventoryItem, InventoryMovement } from '@/lib/types';

type InventoryAverageRow = InventoryItem & {
  inQty: number;
  outQty: number;
  adjustmentQty: number;
  expiredQty: number;
  endingQty: number;
  endingAmount: number;
  date: string;
};

const ALL_CATEGORY = 'Semua Kategori';
const DATE_KEYS = ['tanggal', 'transactionDate', 'mutationDate', 'tglTrans', 'date'] as const;

const normalizeDate = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : '');
const getMovementDate = (movement: InventoryMovement) => {
  for (const key of DATE_KEYS) {
    const raw = (movement as unknown as Record<string, unknown>)[key];
    const normalized = normalizeDate(raw);
    if (normalized) return normalized;
  }
  return '';
};

const calculateEndingQty = (row: { openingQty?: number; inQty?: number; outQty?: number; adjustmentQty?: number; expiredQty?: number }) =>
  Number(row.openingQty || 0) + Number(row.inQty || 0) - Number(row.outQty || 0) + Number(row.adjustmentQty || 0) - Number(row.expiredQty || 0);
const calculateEndingAmount = (row: { wacc?: number } & Parameters<typeof calculateEndingQty>[0]) => calculateEndingQty(row) * Number(row.wacc || 0);

export function InventoryPage({ items, movements }: { items: InventoryItem[]; movements: InventoryMovement[] }) {
  const movementDates = React.useMemo(() => movements.map(getMovementDate).filter(Boolean).sort(), [movements]);
  const defaultStart = movementDates[0] || new Date().toISOString().slice(0, 10);
  const defaultEnd = movementDates[movementDates.length - 1] || defaultStart;

  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);
  const [category, setCategory] = React.useState(ALL_CATEGORY);

  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';

  const categories = React.useMemo(
    () => [ALL_CATEGORY, ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [items],
  );

  const rows = React.useMemo<InventoryAverageRow[]>(() => {
    if (dateError) return [];
    return items
      .filter((item) => category === ALL_CATEGORY || item.category === category)
      .map((item) => {
        const itemMovements = movements.filter((movement) => movement.itemId === item.id);
        const inRangeMovements = itemMovements.filter((movement) => {
          const date = getMovementDate(movement);
          if (!date) return true;
          return date >= startDate && date <= endDate;
        });
        const qty = (type: InventoryMovement['movementType']) => inRangeMovements.filter((m) => m.movementType === type).reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
        const inQty = qty('Masuk');
        const outQty = qty('Keluar');
        const adjustmentQty = qty('Adjustment');
        const expiredQty = qty('Expired');
        const endingQty = calculateEndingQty({ openingQty: item.openingQty, inQty, outQty, adjustmentQty, expiredQty });
        return {
          ...item,
          inQty,
          outQty,
          adjustmentQty,
          expiredQty,
          endingQty,
          endingAmount: calculateEndingAmount({ openingQty: item.openingQty, inQty, outQty, adjustmentQty, expiredQty, wacc: item.wacc }),
          date: inRangeMovements[0] ? getMovementDate(inRangeMovements[0]) : '',
        };
      });
  }, [items, movements, startDate, endDate, category, dateError]);

  const hasAdjustmentOrExpired = rows.some((row) => row.adjustmentQty !== 0 || row.expiredQty !== 0);
  const summary = React.useMemo(() => {
    const totalEndingQty = rows.reduce((sum, row) => sum + row.endingQty, 0);
    const totalEndingAmount = rows.reduce((sum, row) => sum + row.endingAmount, 0);
    const highest = [...rows].sort((a, b) => b.endingAmount - a.endingAmount)[0];
    return { totalItems: rows.length, totalEndingQty, totalEndingAmount, topItem: highest?.itemName || '-' };
  }, [rows]);

  const filename = `laporan-persediaan-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`;

  const columns = React.useMemo<DataTableColumn<InventoryAverageRow>[]>(() => {
    const base: DataTableColumn<InventoryAverageRow>[] = [
      { key: 'itemCode', header: 'Kode', cell: (r) => r.itemCode },
      { key: 'itemName', header: 'Item', cell: (r) => r.itemName },
      { key: 'category', header: 'Kategori', cell: (r) => r.category },
      { key: 'wacc', header: 'WACC', cell: (r) => formatCurrency(r.wacc), sortValue: (r) => r.wacc, align: 'right' },
      { key: 'openingQty', header: 'Awal', isNumber: true, align: 'right' },
      { key: 'inQty', header: 'Masuk', isNumber: true, align: 'right' },
      { key: 'outQty', header: 'Keluar', isNumber: true, align: 'right' },
    ];
    if (hasAdjustmentOrExpired) {
      base.push({ key: 'adjustmentQty', header: 'Adjustment', isNumber: true, align: 'right' });
      base.push({ key: 'expiredQty', header: 'Expired', isNumber: true, align: 'right' });
    }
    base.push({ key: 'endingQty', header: 'Akhir', isNumber: true, align: 'right', sortValue: (r) => r.endingQty });
    base.push({ key: 'endingAmount', header: 'Ending Amount', isCurrency: true, align: 'right', sortValue: (r) => r.endingAmount, total: (rs) => formatCurrency(rs.reduce((a, b) => a + b.endingAmount, 0)) });
    return base;
  }, [hasAdjustmentOrExpired]);

  const exportColumns: ExportColumn<InventoryAverageRow>[] = columns.map((column) => ({ key: String(column.key), header: column.header, exportAccessor: (r) => { const value = column.sortValue?.(r) ?? (r as unknown as Record<string, unknown>)[String(column.key)] ?? ''; return typeof value === 'number' ? value : String(value); }, isCurrency: column.isCurrency, isNumber: column.isNumber }));

  const exportMeta = {
    appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', page: 'Laporan Persediaan',
    filters: { startDate, endDate, category },
    summary: { totalItems: summary.totalItems, totalEndingQty: summary.totalEndingQty, totalEndingAmount: summary.totalEndingAmount },
    formula: { endingQty: 'Awal + Masuk - Keluar + Adjustment - Expired', endingAmount: 'Akhir x WACC' },
  };

  return <div className="space-y-4"><PageHeader title="Laporan Persediaan" description="Metode average/WACC, awal, masuk, keluar, adjustment, expired, akhir, dan summary value." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => exportToCSV({ filename, rows, columns: exportColumns, includeFooter: true })}>Export CSV</Button><Button variant="outline" onClick={() => exportToJSON({ filename, rows, columns: exportColumns, includeFooter: true, meta: exportMeta })}>Export JSON</Button><Button variant="outline" onClick={() => exportToExcel({ filename, rows, columns: exportColumns, includeFooter: true, meta: { appName: exportMeta.appName, module: exportMeta.module, page: exportMeta.page, period: `${startDate} s/d ${endDate}`, exportedAt: new Date().toLocaleString('id-ID'), totalRows: rows.length, totalAmount: formatCurrency(summary.totalEndingAmount) } })}>Export XLS</Button><Button variant="outline" onClick={() => printVoucherTable(rows, exportColumns, { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', title: 'Laporan Persediaan', period: `${startDate} s/d ${endDate} | Kategori: ${category}`, totalAmount: formatCurrency(summary.totalEndingAmount), totalRows: rows.length })}>Print</Button></div>} />

    <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-5"><div><p className="text-xs text-slate-500">Total Item</p><p className="text-xl font-bold">{summary.totalItems}</p></div><div><p className="text-xs text-slate-500">Total Qty Akhir</p><p className="text-xl font-bold">{summary.totalEndingQty} unit</p></div><div><p className="text-xs text-slate-500">Total Nilai Persediaan</p><p className="text-xl font-bold">{formatCurrency(summary.totalEndingAmount)}</p></div><div><p className="text-xs text-slate-500">Kategori Aktif</p><Badge>{category}</Badge></div><div><p className="text-xs text-slate-500">Item Nilai Tertinggi</p><p className="text-xl font-bold">{summary.topItem}</p></div></CardContent></Card>

    <DataTable
      title="Laporan Persediaan"
      description={`Periode ${formatDate(startDate)} - ${formatDate(endDate)} • Kategori: ${category}`}
      rows={rows}
      columns={columns}
      filename={filename}
      enableExcel={false}
      enablePDF={false}
      toolbarFilters={<div className="grid w-full gap-2 sm:grid-cols-3"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Tanggal Dari" /><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="Tanggal Ke" /><Select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>{dateError ? <p className="text-xs text-red-600 sm:col-span-3">{dateError}</p> : null}</div>}
      emptyMessage={items.length === 0 ? 'Belum ada data persediaan.' : 'Tidak ada data persediaan pada filter ini.'}
      emptyDescription={items.length === 0 ? 'Data akan tampil setelah master dan mutasi persediaan tersedia.' : 'Coba ubah rentang tanggal atau kategori.'}
    />
  </div>;
}
