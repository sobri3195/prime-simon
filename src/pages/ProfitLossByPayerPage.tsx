import * as React from 'react';
import { Download, Printer } from 'lucide-react';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert, Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { exportToCSV, exportToExcel, exportToJson, printVoucherTable, type ExportColumn } from '@/lib/export';
import { toast } from '@/lib/toast';
import type { RevenueTransaction } from '@/lib/types';

const APP_NAME = 'Klinik Utama Prime Mata';
const MODULE_NAME = 'Finance Operations';
const PAGE_NAME = 'Laba Rugi by Payer';

type FilterMode = 'dateRange' | 'monthRange';
type MonthView = 'profit' | 'revenue' | 'discount' | 'cogs' | 'margin';
type PayerAggregate = { payer: string; revenue: number; discountMedis: number; discountFarmasi: number; discountOptik: number; totalDiscount: number; netRevenue: number; cogs: number; profit: number; margin: number };
type MonthMetric = { revenue: number; discountMedis: number; discountFarmasi: number; discountOptik: number; totalDiscount: number; netRevenue: number; cogs: number; profit: number; margin: number };
type PayerMonthAggregate = { payer: string; months: Record<string, MonthMetric>; total: MonthMetric };

const cogsRate = 0.2;
const discountSplit = { medis: 0.5, farmasi: 0.3, optik: 0.2 };

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`;
const formatMonthLabel = (value: string) => new Date(`${value}-01`).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
const toMonthKey = (value: string) => value.slice(0, 7);
const calculateProfitMargin = (profit: number, netRevenue: number) => (netRevenue === 0 ? 0 : (profit / netRevenue) * 100);

const calculatePayerProfitLoss = (rowGroup: RevenueTransaction[]): PayerAggregate => {
  const revenue = rowGroup.reduce((acc, item) => acc + item.netAmount, 0);
  const totalDiscount = rowGroup.reduce((acc, item) => acc + item.discount, 0);
  const discountMedis = totalDiscount * discountSplit.medis;
  const discountFarmasi = totalDiscount * discountSplit.farmasi;
  const discountOptik = totalDiscount * discountSplit.optik;
  const netRevenue = revenue - totalDiscount;
  const cogs = revenue * cogsRate;
  const profit = netRevenue - cogs;
  return { payer: rowGroup[0]?.payerType ?? '-', revenue, discountMedis, discountFarmasi, discountOptik, totalDiscount, netRevenue, cogs, profit, margin: calculateProfitMargin(profit, netRevenue) };
};

const filterRowsByDateRange = (rows: RevenueTransaction[], startDate: string, endDate: string) => rows.filter((row) => row.date >= startDate && row.date <= endDate);
const filterRowsByMonths = (rows: RevenueTransaction[], selectedMonths: string[]) => rows.filter((row) => selectedMonths.includes(toMonthKey(row.date)));

const groupProfitLossByPayer = (rows: RevenueTransaction[]): PayerAggregate[] => {
  const groups = new Map<string, RevenueTransaction[]>();
  rows.forEach((row) => {
    const current = groups.get(row.payerType) ?? [];
    current.push(row);
    groups.set(row.payerType, current);
  });
  return [...groups.values()].map(calculatePayerProfitLoss).sort((a, b) => b.profit - a.profit);
};

const groupProfitLossByPayerAndMonth = (rows: RevenueTransaction[], selectedMonths: string[]): PayerMonthAggregate[] => {
  const payerMap = new Map<string, RevenueTransaction[]>();
  rows.forEach((row) => {
    const current = payerMap.get(row.payerType) ?? [];
    current.push(row);
    payerMap.set(row.payerType, current);
  });
  return [...payerMap.entries()].map(([payer, payerRows]) => {
    const months: Record<string, MonthMetric> = {};
    selectedMonths.forEach((month) => {
      const mRows = payerRows.filter((row) => toMonthKey(row.date) === month);
      const metric = calculatePayerProfitLoss(mRows.length ? mRows : [{ ...payerRows[0], netAmount: 0, discount: 0 }]);
      months[month] = { ...metric };
    });
    const total = calculatePayerProfitLoss(payerRows);
    return { payer, months, total: { ...total } };
  }).sort((a, b) => b.total.profit - a.total.profit);
};

export function ProfitLossByPayerPage({ revenue }: { revenue: RevenueTransaction[] }) {
  const allMonths = React.useMemo(() => [...new Set(revenue.map((row) => toMonthKey(row.date)))].sort(), [revenue]);
  const defaultMonth = allMonths[allMonths.length - 1] ?? new Date().toISOString().slice(0, 7);
  const defaultStartDate = `${defaultMonth}-01`;
  const defaultEndDate = new Date(Number(defaultMonth.slice(0, 4)), Number(defaultMonth.slice(5, 7)), 0).toISOString().slice(0, 10);
  const [filterMode, setFilterMode] = React.useState<FilterMode>('monthRange');
  const [startDate, setStartDate] = React.useState(defaultStartDate);
  const [endDate, setEndDate] = React.useState(defaultEndDate);
  const [selectedMonths, setSelectedMonths] = React.useState<string[]>([defaultMonth]);
  const [monthInput, setMonthInput] = React.useState(defaultMonth);
  const [monthView, setMonthView] = React.useState<MonthView>('profit');

  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';
  const selectedMonthsSorted = [...selectedMonths].sort();
  const filteredRows = filterMode === 'monthRange' ? filterRowsByMonths(revenue, selectedMonthsSorted) : filterRowsByDateRange(revenue, startDate, endDate);
  const byPayer = groupProfitLossByPayer(filteredRows);
  const byPayerAndMonth = groupProfitLossByPayerAndMonth(filteredRows, selectedMonthsSorted);
  const allPayers = React.useMemo(() => [...new Set(revenue.map((row) => row.payerType))], [revenue]);
  const byPayerAndMonthComplete = React.useMemo(() => {
    const mapped = new Map(byPayerAndMonth.map((row) => [row.payer, row]));
    return allPayers.map((payer) => mapped.get(payer) ?? { payer, months: Object.fromEntries(selectedMonthsSorted.map((m) => [m, { revenue: 0, discountMedis: 0, discountFarmasi: 0, discountOptik: 0, totalDiscount: 0, netRevenue: 0, cogs: 0, profit: 0, margin: 0 }])), total: { revenue: 0, discountMedis: 0, discountFarmasi: 0, discountOptik: 0, totalDiscount: 0, netRevenue: 0, cogs: 0, profit: 0, margin: 0 } });
  }, [allPayers, byPayerAndMonth, selectedMonthsSorted]);
  const hasMissingMonthData = React.useMemo(() => selectedMonthsSorted.some((month) => !revenue.some((row) => toMonthKey(row.date) === month)), [revenue, selectedMonthsSorted]);

  const summary = React.useMemo(() => {
    const totals = byPayer.reduce((acc, row) => ({ revenue: acc.revenue + row.revenue, discount: acc.discount + row.totalDiscount, cogs: acc.cogs + row.cogs, profit: acc.profit + row.profit, netRevenue: acc.netRevenue + row.netRevenue }), { revenue: 0, discount: 0, cogs: 0, profit: 0, netRevenue: 0 });
    const topPayer = byPayer[0]?.payer ?? '-';
    const monthProfit = selectedMonthsSorted.map((month) => ({ month, profit: byPayerAndMonthComplete.reduce((acc, payer) => acc + (payer.months[month]?.profit ?? 0), 0) }));
    const bestMonth = monthProfit.length ? monthProfit.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
    const lowestMonth = monthProfit.length ? monthProfit.reduce((a, b) => (b.profit < a.profit ? b : a)) : null;
    const growth = monthProfit.length > 1 && monthProfit[0].profit !== 0 ? ((monthProfit[monthProfit.length - 1].profit - monthProfit[0].profit) / Math.abs(monthProfit[0].profit)) * 100 : 0;
    return { ...totals, margin: calculateProfitMargin(totals.profit, totals.netRevenue), topPayer, bestMonth, lowestMonth, growth };
  }, [byPayer, byPayerAndMonthComplete, selectedMonthsSorted]);

  const filename = `laba-rugi-by-payer-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`;

  const exportColumns: ExportColumn<PayerAggregate>[] = [
    { key: 'payer', header: 'Payer' }, { key: 'revenue', header: 'Pendapatan', exportAccessor: (r) => r.revenue }, { key: 'discountMedis', header: 'Diskon Medis', exportAccessor: (r) => r.discountMedis },
    { key: 'discountFarmasi', header: 'Diskon Farmasi', exportAccessor: (r) => r.discountFarmasi }, { key: 'discountOptik', header: 'Diskon Optik', exportAccessor: (r) => r.discountOptik },
    { key: 'totalDiscount', header: 'Total Diskon', exportAccessor: (r) => r.totalDiscount }, { key: 'cogs', header: 'Beban Pokok', exportAccessor: (r) => r.cogs }, { key: 'profit', header: 'Laba', exportAccessor: (r) => r.profit }, { key: 'margin', header: 'Margin Laba (%)', exportAccessor: (r) => r.margin },
  ];

  const exportRows: Record<string, unknown>[] = filterMode === 'monthRange'
    ? byPayerAndMonth.map((row) => ({ payer: row.payer, ...Object.fromEntries(selectedMonthsSorted.map((month) => [formatMonthLabel(month), row.months[month]?.[monthView] ?? 0])), total: row.total[monthView] }))
    : byPayer.map((row) => ({ ...row }));
  const monthRangeColumns = [{ key: 'payer', header: 'Payer' }, ...selectedMonthsSorted.map((m) => ({ key: m, header: formatMonthLabel(m), exportAccessor: (r: Record<string, unknown>) => Number(r[formatMonthLabel(m)] ?? 0) })), { key: 'total', header: 'Total' }];

  const exportMeta = { appName: APP_NAME, module: MODULE_NAME, page: PAGE_NAME, filterMode, filters: { startDate, endDate, selectedMonths: selectedMonthsSorted }, summary: { totalRevenue: summary.revenue, totalDiscount: summary.discount, totalCogs: summary.cogs, totalProfit: summary.profit, profitMargin: summary.margin } };

  const resetFilter = () => { setFilterMode('monthRange'); setStartDate(defaultStartDate); setEndDate(defaultEndDate); setSelectedMonths([defaultMonth]); setMonthInput(defaultMonth); setMonthView('profit'); };
  const addMonth = () => {
    if (selectedMonths.includes(monthInput)) return toast.warning('Bulan tersebut sudah ditambahkan.');
    setSelectedMonths((prev) => [...prev, monthInput].sort());
  };
  const metricValue = (metric: MonthMetric) => (monthView === 'profit' ? metric.profit : monthView === 'revenue' ? metric.revenue : monthView === 'discount' ? metric.totalDiscount : monthView === 'cogs' ? metric.cogs : metric.margin);
  const chartData = selectedMonthsSorted.map((month) => {
    const row: Record<string, string | number> = { month: formatMonthLabel(month) };
    byPayerAndMonthComplete.forEach((payer) => { row[payer.payer] = metricValue(payer.months[month] ?? { revenue: 0, discountMedis: 0, discountFarmasi: 0, discountOptik: 0, totalDiscount: 0, netRevenue: 0, cogs: 0, profit: 0, margin: 0 }); });
    return row;
  });

  return <div className="space-y-4"><PageHeader title={PAGE_NAME} description="Analisis pendapatan, diskon, beban pokok, dan laba berdasarkan payer." />
    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex gap-2"><Button variant={filterMode === 'dateRange' ? 'default' : 'outline'} onClick={() => setFilterMode('dateRange')}>Filter Tanggal</Button><Button variant={filterMode === 'monthRange' ? 'default' : 'outline'} onClick={() => setFilterMode('monthRange')}>Range Month</Button></div>
      {filterMode === 'dateRange' ? <div className="flex flex-wrap items-end gap-2"><label className="text-sm">Dari <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label className="text-sm">Ke <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label><Button variant="secondary" onClick={resetFilter}>Reset Filter</Button></div> : <div className="space-y-2"><div className="flex flex-wrap items-end gap-2"><label className="text-sm">Pilih Bulan <Input type="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} /></label><Button onClick={addMonth}>+ Tambah Bulan</Button><Select value={monthView} onChange={(e) => setMonthView(e.target.value as MonthView)}><option value="profit">View: Laba</option><option value="revenue">View: Pendapatan</option><option value="discount">View: Diskon</option><option value="cogs">View: Beban Pokok</option><option value="margin">View: Margin</option></Select><Button variant="secondary" onClick={resetFilter}>Reset Filter</Button></div><div className="flex flex-wrap gap-2">{selectedMonthsSorted.map((month) => <button key={month} type="button" className="rounded-full bg-slate-100 px-3 py-1 text-xs" onClick={() => setSelectedMonths((prev) => prev.length === 1 ? prev : prev.filter((x) => x !== month))}>{formatMonthLabel(month)} ×</button>)}</div></div>}
      {selectedMonthsSorted.length > 0 && filterMode === 'monthRange' && <div className="text-sm text-blue-700">Mode perbandingan bulan aktif. Menampilkan perbandingan: {selectedMonthsSorted.map(formatMonthLabel).join(', ')}</div>}
      {hasMissingMonthData && filterMode === 'monthRange' && <div className="text-xs text-amber-700">Sebagian bulan belum memiliki data.</div>}
      {dateError ? <Alert className="border-red-200 bg-red-50 text-red-700">{dateError}</Alert> : null}
    </CardContent></Card>

    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">{[
      ['Total Pendapatan', formatCurrency(summary.revenue)], ['Total Diskon', formatCurrency(summary.discount)], ['Total Beban Pokok', formatCurrency(summary.cogs)], ['Total Laba', formatCurrency(summary.profit)], ['Margin Laba', formatPercent(summary.margin)], ['Payer Terbesar', summary.topPayer],
      ...(filterMode === 'monthRange' ? [['Bulan terbaik', summary.bestMonth ? `${formatMonthLabel(summary.bestMonth.month)} (${formatCurrency(summary.bestMonth.profit)})` : '-'], ['Bulan terendah', summary.lowestMonth ? `${formatMonthLabel(summary.lowestMonth.month)} (${formatCurrency(summary.lowestMonth.profit)})` : '-'], ['Growth laba antar bulan', formatPercent(summary.growth)]] : []),
    ].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><div className="text-xs text-slate-500">{label}</div><div className="text-lg font-semibold">{value}</div></CardContent></Card>)}</div>

    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex gap-2"><Button onClick={() => exportToCSV({ filename, rows: exportRows as any[], columns: (filterMode === 'monthRange' ? monthRangeColumns : exportColumns) as any[] })}><Download size={16}/>CSV</Button><Button onClick={() => exportToJson({ ...exportMeta, rows: exportRows }, `${filename}.json`)}><Download size={16}/>JSON</Button><Button onClick={() => exportToExcel({ filename, rows: exportRows as any[], columns: (filterMode === 'monthRange' ? monthRangeColumns : exportColumns) as any[], meta: { appName: APP_NAME, module: MODULE_NAME, page: PAGE_NAME, period: filterMode === 'monthRange' ? selectedMonthsSorted.map(formatMonthLabel).join(', ') : `${startDate} s/d ${endDate}`, exportedAt: new Date().toISOString(), totalRows: exportRows.length, totalAmount: formatCurrency(summary.profit) } })}><Download size={16}/>XLS</Button><Button onClick={() => printVoucherTable(exportRows as any[], (filterMode === 'monthRange' ? monthRangeColumns : exportColumns) as any[], { appName: APP_NAME, module: MODULE_NAME, title: PAGE_NAME, period: filterMode === 'monthRange' ? `Mode perbandingan bulan • ${selectedMonthsSorted.map(formatMonthLabel).join(', ')}` : `Mode filter tanggal • ${startDate} s/d ${endDate}`, totalAmount: formatCurrency(summary.profit), totalRows: exportRows.length })}><Printer size={16}/>Print</Button></div>

      {filterMode === 'monthRange' && <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><XAxis dataKey="month" /><YAxis tickFormatter={(v) => monthView === 'margin' ? formatPercent(Number(v)) : formatCurrency(Number(v)).replace('Rp', '')} /><Tooltip formatter={(v: number) => monthView === 'margin' ? formatPercent(Number(v)) : formatCurrency(Number(v))} /><Legend />{byPayerAndMonthComplete.map((p, i) => <Bar key={p.payer} dataKey={p.payer} fill={['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5]} />)}</BarChart></ResponsiveContainer></div>}
      {!filteredRows.length ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center"><p className="font-medium">Tidak ada data Laba Rugi by Payer pada periode ini.</p><p className="text-sm text-slate-500">Coba ubah rentang tanggal atau pilih bulan lain.</p></div> : filterMode === 'dateRange' ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Payer</th><th className="text-right">Pendapatan</th><th className="text-right">Diskon Medis</th><th className="text-right">Diskon Farmasi</th><th className="text-right">Diskon Optik</th><th className="text-right">Total Diskon</th><th className="text-right">Beban Pokok</th><th className="text-right">Laba</th><th className="text-right">Margin Laba</th></tr></thead><tbody>{byPayer.map((row) => <tr key={row.payer} className="border-b"><td>{row.payer}</td><td className="text-right">{formatCurrency(row.revenue)}</td><td className="text-right">{formatCurrency(row.discountMedis)}</td><td className="text-right">{formatCurrency(row.discountFarmasi)}</td><td className="text-right">{formatCurrency(row.discountOptik)}</td><td className="text-right">{formatCurrency(row.totalDiscount)}</td><td className="text-right">{formatCurrency(row.cogs)}</td><td className={`text-right font-semibold ${row.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(row.profit)}</td><td className="text-right">{formatPercent(row.margin)}</td></tr>)}</tbody></table></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Payer</th>{selectedMonthsSorted.map((month) => <th key={month} className="text-right">{formatMonthLabel(month)}</th>)}<th className="text-right">Total</th></tr></thead><tbody>{byPayerAndMonth.map((row) => <tr key={row.payer} className="border-b"><td>{row.payer}</td>{selectedMonthsSorted.map((month) => <td key={month} className="text-right"><div className={`font-semibold ${(row.months[month]?.profit ?? 0) < 0 ? 'text-red-600' : ''}`}>{monthView === 'profit' ? formatCurrency(row.months[month]?.profit ?? 0) : monthView === 'revenue' ? formatCurrency(row.months[month]?.revenue ?? 0) : formatPercent(row.months[month]?.margin ?? 0)}</div><div className="text-xs text-slate-500">{formatCurrency(row.months[month]?.profit ?? 0)} • {formatPercent(row.months[month]?.margin ?? 0)}</div></td>)}<td className="text-right font-bold">{monthView === 'profit' ? formatCurrency(row.total.profit) : monthView === 'revenue' ? formatCurrency(row.total.revenue) : formatPercent(row.total.margin)}</td></tr>)}</tbody></table></div>}
      {!filteredRows.length ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center"><p className="font-medium">Tidak ada data Laba Rugi by Payer pada periode ini.</p><p className="text-sm text-slate-500">Coba ubah rentang tanggal atau pilih bulan lain.</p></div> : filterMode === 'dateRange' ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Payer</th><th className="text-right">Pendapatan</th><th className="text-right">Diskon Medis</th><th className="text-right">Diskon Farmasi</th><th className="text-right">Diskon Optik</th><th className="text-right">Total Diskon</th><th className="text-right">Beban Pokok</th><th className="text-right">Laba</th><th className="text-right">Margin Laba</th></tr></thead><tbody>{byPayer.map((row) => <tr key={row.payer} className="border-b"><td>{row.payer}</td><td className="text-right">{formatCurrency(row.revenue)}</td><td className="text-right">{formatCurrency(row.discountMedis)}</td><td className="text-right">{formatCurrency(row.discountFarmasi)}</td><td className="text-right">{formatCurrency(row.discountOptik)}</td><td className="text-right">{formatCurrency(row.totalDiscount)}</td><td className="text-right">{formatCurrency(row.cogs)}</td><td className={`text-right font-semibold ${row.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(row.profit)}</td><td className="text-right">{formatPercent(row.margin)}</td></tr>)}</tbody></table></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Payer</th>{selectedMonthsSorted.map((month) => <th key={month} className="text-right">{formatMonthLabel(month)}</th>)}<th className="text-right">Total</th><th className="text-right">Growth</th></tr></thead><tbody>{byPayerAndMonthComplete.map((row) => { const first = metricValue(row.months[selectedMonthsSorted[0]] ?? { revenue: 0, discountMedis: 0, discountFarmasi: 0, discountOptik: 0, totalDiscount: 0, netRevenue: 0, cogs: 0, profit: 0, margin: 0 }); const last = metricValue(row.months[selectedMonthsSorted[selectedMonthsSorted.length - 1]] ?? { revenue: 0, discountMedis: 0, discountFarmasi: 0, discountOptik: 0, totalDiscount: 0, netRevenue: 0, cogs: 0, profit: 0, margin: 0 }); const growth = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100; return <tr key={row.payer} className="border-b"><td>{row.payer}</td>{selectedMonthsSorted.map((month) => <td key={month} className="text-right">{monthView === 'margin' ? formatPercent(metricValue(row.months[month])) : formatCurrency(metricValue(row.months[month]))}</td>)}<td className="text-right font-bold">{monthView === 'margin' ? formatPercent(row.total.margin) : formatCurrency(monthView === 'profit' ? row.total.profit : monthView === 'revenue' ? row.total.revenue : monthView === 'discount' ? row.total.totalDiscount : row.total.cogs)}</td><td className="text-right">{formatPercent(growth)}</td></tr>; })}</tbody></table></div>}
      {!revenue.length ? <Badge variant="amber">Belum ada data transaksi untuk menyusun Laba Rugi by Payer.</Badge> : null}
    </CardContent></Card>
  </div>;
}
