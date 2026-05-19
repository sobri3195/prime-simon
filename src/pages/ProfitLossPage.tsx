import * as React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChartCard } from '@/components/common/ChartCard';
import { PageHeader } from '@/components/common/PageHeader';
import { formatRupiah } from '@/lib/format';
import type { DoctorFee, PayrollRecord, RevenueTransaction } from '@/lib/types';
import {
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

export function ProfitLossPage({ revenue, fees, payroll }: { revenue: RevenueTransaction[]; fees: DoctorFee[]; payroll: PayrollRecord[] }) {
  const activeMonth = '2026-05';
  const [filterMode, setFilterMode] = React.useState<ProfitLossFilterMode>('dateRange');
  const [startDate, setStartDate] = React.useState('2026-05-01');
  const [endDate, setEndDate] = React.useState('2026-05-31');
  const [selectedMonth, setSelectedMonth] = React.useState(activeMonth);
  const [selectedMonths, setSelectedMonths] = React.useState<string[]>([activeMonth]);

  const monthOptions = React.useMemo(() => {
    const keys = Array.from(new Set(revenue.map((r) => r.date.slice(0, 7)))).sort();
    return keys;
  }, [revenue]);

  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';
  const rows = React.useMemo(() => revenue.map((r) => ({ ...r, rowType: 'revenue' as const })), [revenue]);

  React.useEffect(() => {
    if (selectedMonth && !selectedMonths.includes(selectedMonth)) {
      setSelectedMonths((prev) => [...prev, selectedMonth].sort());
    }
  }, [selectedMonth, selectedMonths]);

  const dateFilteredRows = dateError ? [] : filterTransactionsByDateRange(rows, startDate, endDate);
  const monthFilteredRows = filterTransactionsByMonths(rows, selectedMonths);
  const effectiveRows = filterMode === 'monthRange' ? monthFilteredRows : dateFilteredRows;

  const effectiveFees = React.useMemo(() => {
    if (filterMode === 'monthRange') {
      const set = new Set(selectedMonths);
      return fees.filter((f) => set.has(f.actionDate.slice(0, 7)));
    }
    return fees.filter((f) => f.actionDate >= startDate && f.actionDate <= endDate);
  }, [fees, filterMode, selectedMonths, startDate, endDate]);

  const effectivePayroll = React.useMemo(() => {
    if (filterMode === 'monthRange') {
      const set = new Set(selectedMonths);
      return payroll.filter((p) => set.has(p.period));
    }
    const periodSet = new Set<string>();
    let cursor = new Date(`${startDate}T00:00:00`);
    const until = new Date(`${endDate}T00:00:00`);
    while (cursor <= until) {
      periodSet.add(format(cursor, 'yyyy-MM'));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return payroll.filter((p) => periodSet.has(p.period));
  }, [payroll, filterMode, selectedMonths, startDate, endDate]);

  const monthlyData = filterMode === 'monthRange'
    ? groupProfitLossByMonth(rows, selectedMonths, fees, payroll)
    : [{ periodKey: `${startDate}_${endDate}`, periodLabel: `${startDate} s/d ${endDate}`, ...calculateProfitLoss(effectiveRows, effectiveFees, effectivePayroll), expenses: calculateProfitLoss(effectiveRows, effectiveFees, effectivePayroll).totalExpenses }];

  const summary = filterMode === 'monthRange'
    ? calculateProfitLossSummary(monthlyData)
    : (() => {
      const calc = calculateProfitLoss(effectiveRows, effectiveFees, effectivePayroll);
      return { totalRevenue: calc.revenue, totalExpenses: calc.totalExpenses, grossProfit: calc.grossProfit, ebitda: calc.ebitda, netProfit: calc.netProfit, netMargin: calc.netMargin };
    })();

  const exportPayload = {
    appName: 'Klinik Utama Prime Mata',
    module: 'Finance Operations',
    page: 'Laba Rugi',
    filterMode,
    filters: { startDate, endDate, selectedMonths },
    summary,
    rows: monthlyData,
  };

  const exportFile = (type: 'csv' | 'json' | 'xls') => {
    const day = format(new Date(), 'yyyy-MM-dd');
    const filename = `laba-rugi-klinik-utama-prime-mata-${day}.${type}`;
    const data = type === 'json'
      ? JSON.stringify(exportPayload, null, 2)
      : [
          ['Periode', 'Pendapatan', 'Beban', 'Laba Kotor', 'EBITDA', 'Laba Bersih', 'Margin Bersih'],
          ...monthlyData.map((r) => [r.periodLabel, r.revenue, r.expenses, r.grossProfit, r.ebitda, r.netProfit, r.netMargin]),
        ].map((r) => r.join(',')).join('\n');
    const blob = new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const emptyMessage = revenue.length === 0 ? 'Belum ada data transaksi untuk menyusun laporan laba rugi.' : 'Tidak ada data laba rugi pada periode ini. Coba ubah rentang tanggal atau pilih bulan lain.';

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
        <div className="flex items-end gap-2">
          <label className="text-sm">Pilih Bulan<select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="ml-2 rounded border px-2 py-1">{monthOptions.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}</select></label>
          <button className="rounded border px-3 py-1" onClick={() => setSelectedMonths([activeMonth])}>Reset Filter</button>
        </div>
        <div className="flex flex-wrap gap-2">{selectedMonths.sort().map((m) => <button key={m} className="rounded-full bg-slate-100 px-3 py-1 text-xs" onClick={() => setSelectedMonths((prev) => prev.length === 1 ? prev : prev.filter((x) => x !== m))}>{formatMonthLabel(m)} ×</button>)}</div>
        <p className="text-xs text-slate-500">Menampilkan perbandingan: {selectedMonths.sort().map((m) => formatMonthLabel(m)).join(', ')}</p>
      </div>}
      {dateError && <p className="mt-2 text-sm text-red-600">{dateError}</p>}
      {filterMode === 'monthRange' && startDate && endDate && <p className="mt-2 text-xs text-slate-500">Mode perbandingan bulan aktif.</p>}
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      {[
        ['Total Pendapatan', summary.totalRevenue], ['Total Beban', summary.totalExpenses], ['Laba Kotor', summary.grossProfit], ['EBITDA', summary.ebitda], ['Laba Bersih', summary.netProfit], ['Margin Bersih', summary.netMargin, true],
      ].map(([label, value, isPercent]) => <div className="rounded-xl border p-3" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-bold ${label === 'Laba Bersih' && Number(value) < 0 ? 'text-red-600' : 'text-slate-900'}`}>{isPercent ? formatPercent(Number(value)) : formatCurrency(Number(value))}</p></div>)}
    </div>

    <ChartCard title="Trend Laba/Rugi Bersih">
      <ResponsiveContainer height={260}>
        <BarChart data={monthlyData}>
          <XAxis dataKey="periodLabel" />
          <YAxis tickFormatter={(v) => formatRupiah(Number(v)).replace('Rp ', 'Rp')} />
          <Tooltip formatter={(v: number, _n, item: any) => [formatCurrency(Number(v)), 'Laba Bersih']} labelFormatter={(_label, payload: any) => {
            const row = payload?.[0]?.payload;
            return `${row.periodLabel} | Pendapatan ${formatCurrency(row.revenue)} | Beban ${formatCurrency(row.expenses)} | Margin ${formatPercent(row.netMargin)}`;
          }} />
          <Bar dataKey="netProfit">{monthlyData.map((d) => <Cell key={d.periodKey} fill={d.netProfit >= 0 ? '#16a34a' : '#dc2626'} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>

    {effectiveRows.length === 0 || dateError ? <div className="rounded-xl border border-dashed p-6 text-sm text-slate-600">{emptyMessage}</div> : <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-[900px] w-full text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-3">Akun / Komponen</th>{filterMode === 'monthRange' ? selectedMonths.sort().map((m) => <th key={m} className="p-3 text-right">{formatMonthLabel(m)}</th>) : <th className="p-3 text-right">Nilai</th>}<th className="p-3 text-right">Total</th></tr></thead>
        <tbody>
          {['Pendapatan Pelayanan Medis', 'Pendapatan Farmasi', 'Pendapatan Lainnya', 'Beban Jasa Medis', 'Beban Persediaan', 'Beban Farmasi', 'Beban Gaji', 'Beban Administrasi', 'Beban Utilitas', 'Beban Penyusutan', 'Beban Lainnya', 'EBITDA', 'Laba Bersih', 'Margin Bersih'].map((name) => {
            const values = monthlyData.map((m) => name === 'EBITDA' ? m.ebitda : name === 'Laba Bersih' ? m.netProfit : name === 'Margin Bersih' ? m.netMargin : m.groups[name as keyof typeof m.groups] || 0);
            const total = name === 'Margin Bersih' ? summary.netMargin : values.reduce((a, b) => a + b, 0);
            return <tr key={name} className={`${name.includes('Laba') || name.includes('EBITDA') ? 'font-semibold' : ''}`}><td className="p-3">{name}</td>{values.map((v, i) => <td key={i} className="p-3 text-right">{name === 'Margin Bersih' ? formatPercent(v) : formatCurrency(v)}</td>)}<td className={`p-3 text-right font-semibold ${name === 'Laba Bersih' && total < 0 ? 'text-red-600' : ''}`}>{name === 'Margin Bersih' ? formatPercent(total) : formatCurrency(total)}</td></tr>;
          })}
        </tbody>
      </table>
    </div>}

    <div className="no-print flex gap-2">
      <button className="rounded border px-3 py-1" onClick={() => exportFile('csv')}>Export CSV</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('json')}>Export JSON</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('xls')}>Export XLS</button>
      <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={() => window.print()}>Print</button>
    </div>
  </div>;
}
