import * as React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ChartCard } from '@/components/common/ChartCard';
import { PageHeader } from '@/components/common/PageHeader';
import { formatRupiah } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { DoctorFee, PayrollRecord, RevenueTransaction, TaxItem } from '@/lib/types';
import {
  calculateMargin,
  calculateProfitLoss,
  calculateProfitLossSummary,
  filterTransactionsByDateRange,
  filterTransactionsByMonths,
  formatMonthLabel,
  formatPercent,
  groupProfitLossByMonth,
  type ProfitLossFilterMode,
} from '@/lib/profitLossCalculations';

type MonthMetrics = { revenue: number; expenses: number; grossProfit: number; ebitda: number; netProfit: number; netMargin: number; directExpense: number; operationalExpense: number; nonOperationalExpense: number; tax: number };
type AccordionChildRow = { label: string; value: number; note?: string; bold?: boolean };
type AccordionRow = { key: string; label: string; value: number; total: number; formula?: string; children: AccordionChildRow[] };

const ACTIVE_MONTH = '2026-05';
const DUMMY_MONTHS: Record<string, Partial<MonthMetrics>> = {
  '2026-04': { revenue: 9500000, expenses: 65250000, grossProfit: 7800000, ebitda: -55750000, netProfit: -56100000, netMargin: -590.5 },
  '2026-05': { revenue: 10700000, expenses: 79610375, grossProfit: 8663125, ebitda: -68642875, netProfit: -68910375, netMargin: -644.0, tax: 107000 },
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

const formatSignedCurrency = (value: number) => {
  const safeValue = Number(value) || 0;
  const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(safeValue));
  return safeValue < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
};

const currencyClass = (value: number, positiveGreen = false) => {
  if (Number(value) < 0) return 'text-red-600';
  return positiveGreen ? 'text-green-600' : 'text-slate-900';
};

function AccordionProfitLossRow({ row, isExpanded, onToggle }: { row: AccordionRow; isExpanded: boolean; onToggle: (key: string) => void }) {
  return <>
    <tr
      className={`cursor-pointer border-t transition hover:bg-blue-50 ${isExpanded ? 'bg-slate-50/80' : 'bg-white'}`}
      onClick={() => onToggle(row.key)}
      aria-expanded={isExpanded}
    >
      <td className="p-3">
        <div className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isExpanded ? 'bg-blue-50 text-slate-950 ring-1 ring-blue-100' : ''}`}>
          <span className="text-slate-500" aria-hidden="true">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
          <span className="font-semibold">{row.label}</span>
        </div>
      </td>
      <td className={`p-3 text-right font-semibold ${currencyClass(row.value, true)}`}>{formatSignedCurrency(row.value)}</td>
      <td className={`p-3 text-right font-semibold ${currencyClass(row.total, true)}`}>{formatSignedCurrency(row.total)}</td>
    </tr>
    {isExpanded && <tr className="border-t bg-slate-50/60">
      <td colSpan={3} className="p-0">
        <div className="m-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {row.formula && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-slate-600">Formula: {row.formula}</p>}
          <div className="space-y-2">
            {row.children.map((child) => <div key={`${row.key}-${child.label}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-dashed border-slate-100 pb-2 last:border-0 last:pb-0">
              <div className={`pl-7 text-sm ${child.bold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                {child.label}
                {child.note && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">{child.note}</span>}
              </div>
              <div className={`text-right text-sm ${child.bold ? 'font-bold' : 'font-medium'} ${currencyClass(child.value, child.bold)}`}>{formatSignedCurrency(child.value)}</div>
            </div>)}
          </div>
        </div>
      </td>
    </tr>}
  </>;
}

export function ProfitLossPage({ revenue, fees, payroll, taxes }: { revenue: RevenueTransaction[]; fees: DoctorFee[]; payroll: PayrollRecord[]; taxes: TaxItem[] }) {
  const [filterMode, setFilterMode] = React.useState<ProfitLossFilterMode>('monthRange');
  const [startDate, setStartDate] = React.useState('2026-05-01');
  const [endDate, setEndDate] = React.useState('2026-05-31');
  const [selectedMonth, setSelectedMonth] = React.useState(ACTIVE_MONTH);
  const [selectedMonths, setSelectedMonths] = React.useState<string[]>([ACTIVE_MONTH]);
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({ ebitda: true });

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
    const base = groupProfitLossByMonth(rows, selectedMonths, fees, payroll, taxes);
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
      const tax = fallback.tax ?? found?.tax ?? Math.max((ebitda - netProfit) * 0.4, 0);
      return { periodKey: m, periodLabel: formatMonthLabel(m), revenue: revenueValue, expenses, grossProfit, ebitda, netProfit, netMargin, groups: found?.groups || { 'Pendapatan Pelayanan Medis': 0, 'Pendapatan Farmasi': 0, 'Pendapatan Lainnya': 0, 'Beban Jasa Medis': 0, 'Beban Persediaan': 0, 'Beban Farmasi': 0, 'Beban Gaji': 0, 'Beban Administrasi': 0, 'Beban Utilitas': 0, 'Beban Penyusutan': 0, 'Beban Lainnya': 0, 'Beban Pajak': tax }, directExpense, operationalExpense, nonOperationalExpense, tax };
    });
  }, [fees, payroll, rows, selectedMonths, taxes]);

  const summary = filterMode === 'monthRange' ? calculateProfitLossSummary(monthlyData) : (() => {
    const dateFilteredRows = dateError ? [] : filterTransactionsByDateRange(rows, startDate, endDate);
    const effectiveFees = fees.filter((f) => f.actionDate >= startDate && f.actionDate <= endDate);
    const effectivePayroll = payroll.filter((p) => p.period >= startDate.slice(0, 7) && p.period <= endDate.slice(0, 7));
    const effectiveTaxes = taxes.filter((t) => t.date >= startDate && t.date <= endDate);
    const calc = calculateProfitLoss(dateFilteredRows, effectiveFees, effectivePayroll, effectiveTaxes);
    return { totalRevenue: calc.revenue, totalExpenses: calc.totalExpenses, grossProfit: calc.grossProfit, ebitda: calc.ebitda, netProfit: calc.netProfit, netMargin: calc.netMargin };
  })();

  const activeDetails = React.useMemo(() => {
    if (filterMode === 'dateRange') {
      const dateFilteredRows = dateError ? [] : filterTransactionsByDateRange(rows, startDate, endDate);
      const effectiveFees = fees.filter((f) => f.actionDate >= startDate && f.actionDate <= endDate);
      const effectivePayroll = payroll.filter((p) => p.period >= startDate.slice(0, 7) && p.period <= endDate.slice(0, 7));
      const effectiveTaxes = taxes.filter((t) => t.date >= startDate && t.date <= endDate);
      const calc = calculateProfitLoss(dateFilteredRows, effectiveFees, effectivePayroll, effectiveTaxes);
      return {
        groups: calc.groups,
        directExpense: (calc.groups['Beban Jasa Medis'] || 0) + (calc.groups['Beban Persediaan'] || 0),
        operationalExpense: Math.max(calc.totalExpenses - ((calc.groups['Beban Jasa Medis'] || 0) + (calc.groups['Beban Persediaan'] || 0)), 0),
        tax: calc.taxExpense,
        interest: calc.interestExpense,
        amortization: calc.amortizationExpense,
        depreciation: calc.groups['Beban Penyusutan'] || 0,
      };
    }

    const groups = monthlyData.reduce<Record<string, number>>((acc, month) => {
      Object.entries(month.groups || {}).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + (Number(value) || 0);
      });
      return acc;
    }, {});

    return {
      groups,
      directExpense: monthlyData.reduce((total, month) => total + (Number(month.directExpense) || 0), 0),
      operationalExpense: monthlyData.reduce((total, month) => total + (Number(month.operationalExpense) || 0), 0),
      tax: monthlyData.reduce((total, month) => total + (Number(month.tax) || 0), 0),
      interest: 0,
      amortization: 0,
      depreciation: groups['Beban Penyusutan'] || 0,
    };
  }, [dateError, endDate, fees, filterMode, monthlyData, payroll, rows, startDate, taxes]);

  const profitLossAccordionRows = React.useMemo<AccordionRow[]>(() => {
    const groups = activeDetails.groups;
    return [
      {
        key: 'revenue',
        label: 'Pendapatan Usaha',
        value: summary.totalRevenue,
        total: summary.totalRevenue,
        children: [
          { label: 'Pendapatan Pelayanan Medis', value: groups['Pendapatan Pelayanan Medis'] || 0 },
          { label: 'Pendapatan Farmasi', value: groups['Pendapatan Farmasi'] || 0 },
          { label: 'Pendapatan Lainnya', value: groups['Pendapatan Lainnya'] || 0 },
        ],
      },
      {
        key: 'directExpense',
        label: 'Beban Pokok / Beban Langsung',
        value: activeDetails.directExpense,
        total: activeDetails.directExpense,
        children: [
          { label: 'Beban Jasa Medis', value: groups['Beban Jasa Medis'] || 0 },
          { label: 'Beban Persediaan', value: groups['Beban Persediaan'] || 0 },
          { label: 'Beban Farmasi', value: groups['Beban Farmasi'] || 0 },
        ],
      },
      {
        key: 'operationalExpense',
        label: 'Beban Operasional',
        value: activeDetails.operationalExpense,
        total: activeDetails.operationalExpense,
        children: [
          { label: 'Beban Gaji', value: groups['Beban Gaji'] || 0 },
          { label: 'Beban Administrasi', value: groups['Beban Administrasi'] || 0 },
          { label: 'Beban Utilitas', value: groups['Beban Utilitas'] || 0 },
          { label: 'Beban Penyusutan', value: activeDetails.depreciation || 0 },
        ],
      },
      {
        key: 'ebitda',
        label: 'EBITDA',
        value: summary.ebitda,
        total: summary.ebitda,
        formula: 'EBITDA = Laba Bersih + Pajak + Bunga + Penyusutan + Amortisasi',
        children: [
          { label: 'Laba Bersih', value: summary.netProfit },
          { label: 'Pajak', value: activeDetails.tax || 0 },
          { label: 'Bunga', value: activeDetails.interest || 0, note: 'Belum tersedia' },
          { label: 'Penyusutan', value: activeDetails.depreciation || 0 },
          { label: 'Amortisasi', value: activeDetails.amortization || 0, note: 'Belum tersedia' },
          { label: 'EBITDA', value: summary.ebitda, bold: true },
        ],
      },
      {
        key: 'netProfit',
        label: 'Laba Bersih',
        value: summary.netProfit,
        total: summary.netProfit,
        children: [
          { label: 'Pendapatan Usaha', value: summary.totalRevenue },
          { label: 'Total Beban', value: summary.totalExpenses },
          { label: 'Pajak', value: activeDetails.tax || 0 },
          { label: 'Laba Bersih', value: summary.netProfit, bold: true },
        ],
      },
    ];
  }, [activeDetails, summary]);

  const effectiveRows = filterMode === 'monthRange' ? filterTransactionsByMonths(rows, selectedMonths) : (dateError ? [] : filterTransactionsByDateRange(rows, startDate, endDate));
  const selectedMonthsText = selectedMonths.slice().sort().map((m) => formatMonthLabel(m)).join(', ');
  const activePeriodText = filterMode === 'monthRange' ? selectedMonthsText : `${startDate} s.d. ${endDate}`;

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const growthChips = monthComparisonRows.map((row) => {
    const values = monthlyData.map((m) => Number(m[row.field] || 0));
    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;
    const growth = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
    const improve = row.field === 'netProfit' || row.field === 'revenue' ? growth >= 0 : growth <= 0;
    return { ...row, growth, improve };
  });

  const exportRows = profitLossAccordionRows.flatMap((row) => [
    { tipe: 'Parent', komponen: row.label, nilai: row.value, total: row.total, formula: row.formula || '', catatan: '' },
    ...(row.formula ? [{ tipe: 'Formula', komponen: `Formula: ${row.formula}`, nilai: '', total: '', formula: row.formula, catatan: '' }] : []),
    ...row.children.map((child) => ({ tipe: 'Detail', komponen: child.label, nilai: child.value, total: '', formula: '', catatan: child.note || '' })),
  ]);
  const exportPayload = { title: 'Laporan Laba Rugi - Accordion', periode: activePeriodText, summary, rows: exportRows };

  const exportFile = (type: 'csv' | 'json' | 'xls') => {
    const day = format(new Date(), 'yyyy-MM-dd');
    const filename = `laba-rugi-klinik-utama-prime-mata-${day}.${type}`;
    const data = type === 'json'
      ? JSON.stringify(exportPayload, null, 2)
      : [['Tipe', 'Komponen', 'Nilai', 'Total', 'Formula', 'Catatan'], ...exportRows.map((r) => [r.tipe, r.komponen, r.nilai, r.total, r.formula, r.catatan])]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
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
      {[['Total Pendapatan', summary.totalRevenue], ['Total Beban', summary.totalExpenses], ['Laba Kotor', summary.grossProfit], ['EBITDA', summary.ebitda], ['Laba Bersih', summary.netProfit], ['Margin Bersih', summary.netMargin, true]].map(([label, value, isPercent]) => <div className="rounded-xl border p-3" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-bold ${Number(value) < 0 ? 'text-red-600' : 'text-green-600'}`}>{isPercent ? formatPercent(Number(value)) : formatSignedCurrency(Number(value))}</p></div>)}
    </div>

    <ChartCard title="Trend Laba/Rugi Bersih">
      <ResponsiveContainer height={260}>
        <BarChart data={monthlyData}>
          <XAxis dataKey="periodLabel" />
          <YAxis tickFormatter={(v) => formatRupiah(Number(v)).replace('Rp -', '-Rp ')} />
          <Tooltip formatter={(v: number) => [formatSignedCurrency(Number(v)), 'Laba Bersih']} />
          <Bar dataKey="netProfit">{monthlyData.map((d) => <Cell key={d.periodKey} fill={d.netProfit >= 0 ? '#16a34a' : '#dc2626'} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>

    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="min-w-[900px] w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="p-3">Akun / Komponen</th>
            <th className="p-3 text-right">Nilai</th>
            <th className="p-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {profitLossAccordionRows.map((row) => <AccordionProfitLossRow key={row.key} row={row} isExpanded={Boolean(expandedRows[row.key])} onToggle={toggleRow} />)}
        </tbody>
      </table>
    </div>

    {filterMode === 'monthRange' && selectedMonths.length > 1 && <div className="rounded-xl border bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Growth / Perubahan (opsional)</p>
      <div className="flex flex-wrap gap-2">
        {growthChips.map((chip) => <span key={chip.key} className={`rounded-full px-3 py-1 text-xs font-medium ${chip.improve ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{chip.label}: {formatPercent(chip.growth)}</span>)}
      </div>
    </div>}

    {effectiveRows.length === 0 && <div className="rounded-xl border border-dashed p-4 text-sm text-slate-600">Belum ada data transaksi rinci untuk bulan terpilih.</div>}

    <div className="no-print flex gap-2">
      <button className="rounded border px-3 py-1" onClick={() => exportFile('csv')}>Export CSV</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('json')}>Export JSON</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('xls')}>Export XLS</button>
      <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={() => window.print()}>Print</button>
    </div>
  </div>;
}
