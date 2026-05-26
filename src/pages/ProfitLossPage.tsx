import * as React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ChartCard } from '@/components/common/ChartCard';
import { PageHeader } from '@/components/common/PageHeader';
import { formatRupiah } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { DoctorFee, PayrollRecord, RevenueTransaction } from '@/lib/types';
import {
  calculateMargin,
  calculateProfitLoss,
  calculateProfitLossSummary,
  filterTransactionsByDateRange,
  filterTransactionsByMonths,
  formatCurrency,
  formatMonthLabel,
  formatPercent,
  groupProfitLossByMonth,
  type ProfitLossFilterMode,
} from '@/lib/profitLossCalculations';

type MonthMetrics = { revenue: number; expenses: number; grossProfit: number; ebitda: number; netProfit: number; netMargin: number; directExpense: number; operationalExpense: number; nonOperationalExpense: number; tax: number };

const ACTIVE_MONTH = '2026-05';
const DUMMY_MONTHS: Record<string, Partial<MonthMetrics>> = {
  '2026-04': { revenue: 9500000, expenses: 65250000, grossProfit: 7800000, ebitda: -55750000, netProfit: -56100000, netMargin: -590.5 },
  '2026-05': { revenue: 10700000, expenses: 79610375, grossProfit: 8663125, ebitda: -68749875, netProfit: -68910375, netMargin: -644.0 },
  '2026-06': { revenue: 12300000, expenses: 72400000, grossProfit: 9900000, ebitda: -59850000, netProfit: -60100000, netMargin: -488.6 },
};

const monthComparisonRows = [
  { key: 'revenue', label: 'Pendapatan Operasional', field: 'revenue' as const },
  { key: 'directExpense', label: 'Beban Pokok / HPP', field: 'directExpense' as const },
  { key: 'grossProfit', label: 'Laba Kotor', field: 'grossProfit' as const },
  { key: 'operationalExpense', label: 'Beban Operasional', field: 'operationalExpense' as const },
  { key: 'ebitda', label: 'EBITDA', field: 'ebitda' as const },
  { key: 'nonOperationalExpense', label: 'Beban Non-Operasional', field: 'nonOperationalExpense' as const },
  { key: 'tax', label: 'Pajak', field: 'tax' as const },
  { key: 'netProfit', label: 'Laba Bersih', field: 'netProfit' as const },
  { key: 'netMargin', label: 'Margin Bersih', field: 'netMargin' as const, isPercent: true },
];

export function ProfitLossPage({ revenue, fees, payroll }: { revenue: RevenueTransaction[]; fees: DoctorFee[]; payroll: PayrollRecord[] }) {
  const [filterMode, setFilterMode] = React.useState<ProfitLossFilterMode>('monthRange');
  const [startDate, setStartDate] = React.useState('2026-05-01');
  const [endDate, setEndDate] = React.useState('2026-05-31');
  const [selectedMonth, setSelectedMonth] = React.useState(ACTIVE_MONTH);
  const [selectedMonths, setSelectedMonths] = React.useState<string[]>([ACTIVE_MONTH]);

  const monthOptions = React.useMemo(() => {
    const keys = Array.from(new Set([...revenue.map((r) => r.date.slice(0, 7)), ...Object.keys(DUMMY_MONTHS)])).sort();
    return keys;
  }, [revenue]);

  const rows = React.useMemo(() => revenue.map((r) => ({ ...r, rowType: 'revenue' as const })), [revenue]);
  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';

  React.useEffect(() => {
    if (filterMode === 'monthRange') {
      setStartDate('2026-05-01');
      setEndDate('2026-05-31');
    } else {
      setSelectedMonth(ACTIVE_MONTH);
      setSelectedMonths([ACTIVE_MONTH]);
    }
  }, [filterMode]);

  const monthlyData = React.useMemo(() => {
    const base = groupProfitLossByMonth(rows, selectedMonths, fees, payroll);
    return selectedMonths.slice().sort().map((m) => {
      const found = base.find((b) => b.periodKey === m);
      const fallback = DUMMY_MONTHS[m] || {};
      const revenueValue = fallback.revenue ?? found?.revenue ?? 0;
      const expenses = fallback.expenses ?? found?.expenses ?? 0;
      const grossProfit = fallback.grossProfit ?? found?.grossProfit ?? revenueValue - expenses;
      const ebitda = fallback.ebitda ?? found?.ebitda ?? grossProfit;
      const netProfit = fallback.netProfit ?? found?.netProfit ?? revenueValue - expenses;
      const netMargin = fallback.netMargin ?? found?.netMargin ?? calculateMargin(netProfit, revenueValue);
      const directExpense = fallback.directExpense ?? Math.max(revenueValue - grossProfit, 0);
      const operationalExpense = fallback.operationalExpense ?? Math.max(expenses - directExpense, 0);
      const nonOperationalExpense = fallback.nonOperationalExpense ?? Math.max((ebitda - netProfit) * 0.6, 0);
      const tax = fallback.tax ?? Math.max((ebitda - netProfit) * 0.4, 0);
      return { periodKey: m, periodLabel: formatMonthLabel(m), revenue: revenueValue, expenses, grossProfit, ebitda, netProfit, netMargin, groups: found?.groups || { 'Pendapatan Pelayanan Medis': 0, 'Pendapatan Farmasi': 0, 'Pendapatan Lainnya': 0, 'Beban Jasa Medis': 0, 'Beban Persediaan': 0, 'Beban Farmasi': 0, 'Beban Gaji': 0, 'Beban Administrasi': 0, 'Beban Utilitas': 0, 'Beban Penyusutan': 0, 'Beban Lainnya': 0 }, directExpense, operationalExpense, nonOperationalExpense, tax };
    });
  }, [fees, payroll, rows, selectedMonths]);

  const summary = filterMode === 'monthRange' ? calculateProfitLossSummary(monthlyData) : (() => {
    const dateFilteredRows = dateError ? [] : filterTransactionsByDateRange(rows, startDate, endDate);
    const effectiveFees = fees.filter((f) => f.actionDate >= startDate && f.actionDate <= endDate);
    const effectivePayroll = payroll.filter((p) => p.period >= startDate.slice(0, 7) && p.period <= endDate.slice(0, 7));
    const calc = calculateProfitLoss(dateFilteredRows, effectiveFees, effectivePayroll);
    return { totalRevenue: calc.revenue, totalExpenses: calc.totalExpenses, grossProfit: calc.grossProfit, ebitda: calc.ebitda, netProfit: calc.netProfit, netMargin: calc.netMargin };
  })();

  const effectiveRows = filterMode === 'monthRange' ? filterTransactionsByMonths(rows, selectedMonths) : (dateError ? [] : filterTransactionsByDateRange(rows, startDate, endDate));
  const selectedMonthsText = selectedMonths.slice().sort().map((m) => formatMonthLabel(m)).join(', ');

  const addMonth = () => {
    if (selectedMonths.includes(selectedMonth)) {
      toast.warning('Bulan tersebut sudah ditambahkan.');
      return;
    }
    setSelectedMonths((prev) => [...prev, selectedMonth].sort());
  };

  const resetMonthFilter = () => {
    setSelectedMonth(ACTIVE_MONTH);
    setSelectedMonths([ACTIVE_MONTH]);
  };

  const exportPayload = { title: filterMode === 'monthRange' ? 'Laporan Laba Rugi - Perbandingan Bulanan' : 'Laporan Laba Rugi', selectedMonths: selectedMonthsText, summary, rows: monthlyData };

  const exportFile = (type: 'csv' | 'json' | 'xls') => {
    const day = format(new Date(), 'yyyy-MM-dd');
    const filename = `laba-rugi-klinik-utama-prime-mata-${day}.${type}`;
    const data = type === 'json'
      ? JSON.stringify(exportPayload, null, 2)
      : [['Periode', 'Pendapatan', 'Beban', 'Laba Kotor', 'EBITDA', 'Laba Bersih', 'Margin Bersih'], ...monthlyData.map((r) => [r.periodLabel, r.revenue, r.expenses, r.grossProfit, r.ebitda, r.netProfit, r.netMargin])].map((r) => r.join(',')).join('\n');
    const blob = new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  return <div className="space-y-4" id="print-laba-rugi">
    <PageHeader title="Laba Rugi" description="Laporan laba rugi berdasarkan periode, pendapatan, beban, EBITDA, margin bruto, dan laba bersih." />
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex gap-2">
        <button className={`rounded-lg px-3 py-1 text-sm ${filterMode === 'dateRange' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => setFilterMode('dateRange')}>Filter Tanggal</button>
        <button className={`rounded-lg px-3 py-1 text-sm ${filterMode === 'monthRange' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => setFilterMode('monthRange')}>Range Month</button>
      </div>
      {filterMode === 'dateRange' ? <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">Dari<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
        <label className="text-sm">Ke<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
        <div className="flex items-end"><button className="rounded border px-3 py-1" onClick={() => { setStartDate('2026-05-01'); setEndDate('2026-05-31'); }}>Reset Filter</button></div>
      </div> : <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Pilih Bulan<select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="ml-2 rounded border px-2 py-1">{monthOptions.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}</select></label>
          <button className="rounded border px-3 py-1" onClick={addMonth}>Tambah Bulan</button>
          <button className="rounded border px-3 py-1" onClick={resetMonthFilter}>Reset Filter</button>
        </div>
        <div className="flex flex-wrap gap-2">{selectedMonths.slice().sort().map((m) => <button key={m} className="rounded-full bg-slate-100 px-3 py-1 text-xs" onClick={() => setSelectedMonths((prev) => prev.length === 1 ? prev : prev.filter((x) => x !== m))}>{formatMonthLabel(m)} ×</button>)}</div>
        <p className="text-xs text-slate-500">Menampilkan perbandingan: {selectedMonthsText}</p>
      </div>}
      {dateError && <p className="mt-2 text-sm text-red-600">{dateError}</p>}
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      {[['Total Pendapatan', summary.totalRevenue], ['Total Beban', summary.totalExpenses], ['Laba Kotor', summary.grossProfit], ['EBITDA', summary.ebitda], ['Laba Bersih', summary.netProfit], ['Margin Bersih', summary.netMargin, true]].map(([label, value, isPercent]) => <div className="rounded-xl border p-3" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-bold ${Number(value) < 0 ? 'text-red-600' : 'text-green-600'}`}>{isPercent ? formatPercent(Number(value)) : formatCurrency(Number(value))}</p></div>)}
    </div>

    <ChartCard title="Trend Laba/Rugi Bersih">
      <ResponsiveContainer height={260}>
        <BarChart data={monthlyData}>
          <XAxis dataKey="periodLabel" />
          <YAxis tickFormatter={(v) => formatRupiah(Number(v)).replace('Rp ', 'Rp')} />
          <Tooltip formatter={(v: number) => [formatCurrency(Number(v)), 'Laba Bersih']} />
          <Bar dataKey="netProfit">{monthlyData.map((d) => <Cell key={d.periodKey} fill={d.netProfit >= 0 ? '#16a34a' : '#dc2626'} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>

    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-[900px] w-full text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-3">Komponen</th>{selectedMonths.slice().sort().map((m) => <th key={m} className="p-3 text-right">{formatMonthLabel(m)}</th>)}<th className="p-3 text-right">Total</th><th className="p-3 text-right">Growth / Perubahan</th></tr></thead>
        <tbody>
          {monthComparisonRows.map((row) => {
            const values = monthlyData.map((m) => Number(m[row.field] || 0));
            const total = row.isPercent ? (summary.netMargin) : values.reduce((a, b) => a + b, 0);
            const first = values[0] || 0;
            const last = values[values.length - 1] || 0;
            const growth = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
            const improve = row.field === 'netProfit' || row.field === 'revenue' ? growth >= 0 : growth <= 0;
            return <tr key={row.key} className="border-t">
              <td className="p-3">{row.label}</td>
              {values.map((value, idx) => <td key={`${row.key}-${idx}`} className="p-3 text-right">{row.isPercent ? formatPercent(value) : formatCurrency(value)}{value === 0 && <span className="ml-2 text-xs text-slate-400">Belum ada data</span>}</td>)}
              <td className="p-3 text-right font-semibold">{row.isPercent ? formatPercent(total) : formatCurrency(total)}</td>
              <td className={`p-3 text-right font-medium ${improve ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(growth)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    {effectiveRows.length === 0 && <div className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Belum ada data transaksi rinci untuk bulan terpilih.</div>}

    <div className="no-print flex gap-2">
      <button className="rounded border px-3 py-1" onClick={() => exportFile('csv')}>Export CSV</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('json')}>Export JSON</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('xls')}>Export XLS</button>
      <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={() => window.print()}>Print</button>
    </div>
  </div>;
}
