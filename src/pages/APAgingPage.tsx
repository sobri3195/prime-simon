import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { ChartCard } from '@/components/common/ChartCard';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { exportToCSV, exportToExcel, exportToJSON, printTable } from '@/lib/export';
import { formatDate, formatRupiah } from '@/lib/format';
import type { APItem } from '@/lib/types';

const APP_NAME = 'Klinik Utama Prime Mata';
const MODULE_NAME = 'Finance Operations';
const PAGE_NAME = 'Aging Hutang';
const ALL_VENDORS = 'Semua';

const toDate = (value: string) => new Date(`${value}T00:00:00`);
const formatDateID = (value: string) => formatDate(value);
const formatCurrency = (value: number) => formatRupiah(value);

function calculatePayableAgingBucket(invoiceDate: string, referenceDate: string) {
  const day = Math.max(0, Math.floor((toDate(referenceDate).getTime() - toDate(invoiceDate).getTime()) / 86400000));
  if (day <= 30) return { agingDays: day, bucket: '0–30 hari' };
  if (day <= 60) return { agingDays: day, bucket: '31–60 hari' };
  return { agingDays: day, bucket: '>60 hari' };
}

const filterPayablesByDateRange = (rows: APItem[], startDate: string, endDate: string) => rows.filter((row) => row.invoiceDate >= startDate && row.invoiceDate <= endDate);
const filterPayablesByVendor = (rows: APItem[], vendor: string) => (vendor === ALL_VENDORS ? rows : rows.filter((row) => row.vendorName === vendor));

export function APAgingPage({ rows }: { rows: APItem[] }) {
  const defaultStart = '2026-05-01';
  const defaultEnd = '2026-05-31';
  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);
  const [vendor, setVendor] = React.useState(ALL_VENDORS);

  const vendorOptions = React.useMemo(() => [ALL_VENDORS, ...Array.from(new Set(rows.map((row) => row.vendorName))).sort()], [rows]);
  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';

  const filteredRows = React.useMemo(() => {
    if (dateError) return [];
    const byDate = filterPayablesByDateRange(rows, startDate, endDate);
    return filterPayablesByVendor(byDate, vendor).map((row) => {
      const aging = calculatePayableAgingBucket(row.invoiceDate, endDate || defaultEnd);
      return { ...row, ...aging };
    });
  }, [rows, startDate, endDate, vendor, dateError]);

  const summary = React.useMemo(() => ({
    totalOutstanding: filteredRows.reduce((sum, row) => sum + row.outstandingAmount, 0),
    totalInvoice: filteredRows.length,
    overdueCount: filteredRows.filter((row) => row.status.toLowerCase() === 'overdue').length,
    openCount: filteredRows.filter((row) => row.status.toLowerCase() === 'open').length,
    vendorCount: new Set(filteredRows.map((row) => row.vendorName)).size,
  }), [filteredRows]);

  const chartData = React.useMemo(() => {
    const map = new Map<string, { vendor: string; ['0–30 hari']: number; ['31–60 hari']: number; ['>60 hari']: number; invoiceCount: number }>();
    filteredRows.forEach((row) => {
      const current = map.get(row.vendorName) || { vendor: row.vendorName, '0–30 hari': 0, '31–60 hari': 0, '>60 hari': 0, invoiceCount: 0 };
      current[row.bucket as '0–30 hari' | '31–60 hari' | '>60 hari'] += row.outstandingAmount;
      current.invoiceCount += 1;
      map.set(row.vendorName, current);
    });
    return Array.from(map.values());
  }, [filteredRows]);

  const exportColumns = [
    { key: 'invoiceDate', header: 'Tgl Invoice', exportAccessor: (r: (typeof filteredRows)[number]) => formatDateID(r.invoiceDate) },
    { key: 'invoiceNo', header: 'Invoice' },
    { key: 'vendorName', header: 'Vendor' },
    { key: 'amount', header: 'Amount' },
    { key: 'outstandingAmount', header: 'Outstanding' },
    { key: 'agingDays', header: 'Aging (hari)' },
    { key: 'bucket', header: 'Bucket Aging' },
    { key: 'status', header: 'Status' },
  ];

  const baseFilename = `aging-hutang-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`;

  const exportMeta = {
    appName: APP_NAME,
    module: MODULE_NAME,
    page: PAGE_NAME,
    period: `${startDate} s/d ${endDate}`,
    exportedAt: new Date().toISOString(),
    totalRows: filteredRows.length,
    totalAmount: summary.totalOutstanding,
  };

  return <div className="space-y-4">
    <PageHeader title={PAGE_NAME} description="Bucket 0–30, 31–60, >60 hari berdasarkan tanggal invoice." />

    <Card className="print:hidden"><CardContent className="grid gap-3 p-4 md:grid-cols-4">
      <label className="text-sm">Tanggal Dari<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm">Tanggal Ke<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <label className="text-sm">Vendor<Select value={vendor} onChange={(e) => setVendor(e.target.value)}>{vendorOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <div className="flex items-end"><Button type="button" variant="outline" onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); setVendor(ALL_VENDORS); }}>Reset Filter</Button></div>
    </CardContent></Card>

    {dateError ? <p className="text-sm text-red-600">{dateError}</p> : null}

    <Card><CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
      <div><p className="text-xs text-slate-500">Total Outstanding</p><p className="font-semibold">{formatCurrency(summary.totalOutstanding)}</p></div>
      <div><p className="text-xs text-slate-500">Total Invoice</p><p className="font-semibold">{summary.totalInvoice} invoice</p></div>
      <div><p className="text-xs text-slate-500">Overdue</p><p className="font-semibold">{summary.overdueCount} invoice</p></div>
      <div><p className="text-xs text-slate-500">Open</p><p className="font-semibold">{summary.openCount} invoice</p></div>
      <div><p className="text-xs text-slate-500">Vendor Aktif</p><p className="font-semibold">{vendor === ALL_VENDORS ? `${summary.vendorCount} vendor` : vendor}</p></div>
    </CardContent></Card>

    <p className="text-sm text-slate-600">Menampilkan hutang {formatDateID(startDate)} – {formatDateID(endDate)} • Vendor: {vendor}</p>

    {rows.length === 0 ? <EmptyState title="Belum ada data hutang." description="Data hutang akan tampil setelah invoice vendor atau transaksi hutang dicatat." /> : filteredRows.length === 0 ? <EmptyState title="Tidak ada data hutang pada filter ini." description="Coba ubah rentang tanggal atau pilih vendor lain." /> : <>
      <ChartCard title="Grafik Aging Hutang">
        <ResponsiveContainer height={280}>
          <BarChart data={chartData} aria-label="Grafik Aging Hutang berdasarkan bucket umur hutang">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vendor" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
            <Legend />
            <Bar dataKey="0–30 hari" stackId="a" fill="#22c55e" />
            <Bar dataKey="31–60 hari" stackId="a" fill="#f59e0b" />
            <Bar dataKey=">60 hari" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => exportToCSV({ filename: baseFilename, rows: filteredRows, columns: exportColumns })}>Export CSV</Button>
        <Button variant="outline" onClick={() => exportToJSON({ filename: baseFilename, rows: filteredRows, columns: exportColumns, meta: { ...exportMeta, filters: { startDate, endDate, vendor }, summary } })}>Export JSON</Button>
        <Button variant="outline" onClick={() => exportToExcel({ filename: baseFilename, rows: filteredRows, columns: exportColumns, meta: exportMeta })}>Export XLS</Button>
        <Button variant="outline" onClick={() => printTable({ title: PAGE_NAME, subtitle: `${APP_NAME} • ${MODULE_NAME} • ${formatDateID(startDate)} - ${formatDateID(endDate)} • Vendor: ${vendor}`, rows: filteredRows, columns: exportColumns })}>Print</Button>
      </div>

      <DataTable
        rows={filteredRows}
        filename={baseFilename}
        columns={[
          { key: 'invoiceDate', header: 'Tgl Invoice', cell: (r) => formatDateID(r.invoiceDate) },
          { key: 'invoiceNo', header: 'Invoice' },
          { key: 'vendorName', header: 'Vendor' },
          { key: 'amount', header: 'Amount', cell: (r) => formatCurrency(r.amount) },
          { key: 'outstandingAmount', header: 'Outstanding', cell: (r) => formatCurrency(r.outstandingAmount), total: (rs) => formatCurrency(rs.reduce((a, b) => a + (b as any).outstandingAmount, 0)) },
          { key: 'aging', header: 'Aging', cell: (r: any) => `${r.agingDays} hari (${r.bucket})` },
          { key: 'status', header: 'Status', cell: (r: any) => <Badge variant={r.status === 'Paid' ? 'green' : r.status === 'Overdue' ? 'red' : r.status === 'Partial' ? 'amber' : 'default'}>{r.status}</Badge> },
        ]}
        description={`${APP_NAME} • ${MODULE_NAME} • ${PAGE_NAME}`}
        emptyMessage="Tidak ada data hutang pada periode ini."
        emptyDescription="Coba ubah rentang tanggal atau vendor."
      />
    </>}
  </div>;
}
