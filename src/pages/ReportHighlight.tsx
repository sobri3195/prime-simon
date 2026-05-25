import { useMemo, useState } from 'react';
import { Alert, Badge, Card, CardContent, Select, Table } from '@/components/ui/basic';
import { PageHeader } from '@/components/common/PageHeader';
import { calculateAchievement, generateReportHighlightAnalysis, getAchievementStatus, reportHighlight } from '@/lib/calculations';
import { formatCurrency, formatGap, formatPercent, formatRupiah, getStatusBadgeClass, monthNameID } from '@/lib/format';
import type { ARItem, APItem, CashierDailyReport, RevenueTransaction, Settings } from '@/lib/types';

type BreakdownType = 'revenue' | 'cost' | 'receivable' | 'payable' | 'neutral';

type BreakdownInput = {
  key: string;
  label: string;
  type: BreakdownType;
  target: number;
  actual: number;
  description: string;
};

export function ReportHighlight({
  revenue,
  settings,
  arItems = [],
  apItems = [],
  cashierReports = [],
}: {
  revenue: RevenueTransaction[];
  settings: Settings;
  arItems?: ARItem[];
  apItems?: APItem[];
  cashierReports?: CashierDailyReport[];
}) {
  const [month, setMonth] = useState(settings.activeMonth || 5);
  const [year, setYear] = useState(settings.activeYear || 2026);
  const periodPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const monthRevenue = useMemo(() => revenue.filter((r) => r.date.startsWith(periodPrefix)), [revenue, periodPrefix]);
  const monthArItems = useMemo(() => arItems.filter((r) => (r.invoiceDate || r.serviceDate).startsWith(periodPrefix)), [arItems, periodPrefix]);
  const monthApItems = useMemo(() => apItems.filter((r) => r.invoiceDate.startsWith(periodPrefix)), [apItems, periodPrefix]);
  const monthCashier = useMemo(() => cashierReports.filter((r) => r.date.startsWith(periodPrefix)), [cashierReports, periodPrefix]);

  const hasPeriodData = monthRevenue.length > 0 || monthArItems.length > 0 || monthApItems.length > 0 || monthCashier.length > 0;
  const useMay2026Dummy = !hasPeriodData && month === 5 && year === 2026;

  const breakdownInputs = useMemo<BreakdownInput[]>(() => {
    const revenueByPayer = (name: string) => monthRevenue.filter((r) => r.payerType === name).reduce((a, b) => a + b.netAmount, 0);
    const generalRevenue = revenueByPayer('Umum');
    const bpjsRevenue = revenueByPayer('BPJS');
    const insuranceRevenue = monthRevenue.filter((r) => ['Asuransi', 'Perusahaan'].includes(r.payerType)).reduce((a, b) => a + b.netAmount, 0);

    if (useMay2026Dummy) {
      return [
        { key: 'umum', label: 'Capaian Umum', type: 'revenue', target: 25_000_000, actual: 1_200_000, description: 'Pendapatan pasien umum terhadap target bulan berjalan.' },
        { key: 'bpjs', label: 'Capaian BPJS', type: 'revenue', target: 20_000_000, actual: 5_350_000, description: 'Pendapatan dari klaim atau layanan BPJS.' },
        { key: 'asuransi', label: 'Capaian Asuransi', type: 'revenue', target: 39_000_000, actual: 13_540_000, description: 'Pendapatan dari asuransi dan payer perusahaan.' },
      ];
    }

    return [
      { key: 'umum', label: 'Capaian Umum', type: 'revenue', target: 25_000_000, actual: generalRevenue, description: 'Pendapatan pasien umum terhadap target bulan berjalan.' },
      { key: 'bpjs', label: 'Capaian BPJS', type: 'revenue', target: 20_000_000, actual: bpjsRevenue, description: 'Pendapatan dari klaim atau layanan BPJS.' },
      { key: 'asuransi', label: 'Capaian Asuransi', type: 'revenue', target: 39_000_000, actual: insuranceRevenue, description: 'Pendapatan dari asuransi dan payer perusahaan.' },
    ];
  }, [monthRevenue, useMay2026Dummy]);

  const totalTarget = breakdownInputs.reduce((a, b) => a + b.target, 0);
  const totalRealization = breakdownInputs.reduce((a, b) => a + b.actual, 0);
  const breakdowns = breakdownInputs.map((item) => ({
    ...item,
    ...calculateAchievement(item),
    contributionPercent: totalRealization > 0 ? (item.actual / totalRealization) * 100 : 0,
  }));

  const summary = reportHighlight(totalTarget || settings.targetRevenue, totalRealization);
  const status = getAchievementStatus(summary.achievementPercentage, 'revenue');
  const analysis = generateReportHighlightAnalysis(summary, breakdowns);

  return <div className="space-y-4 print-area"><PageHeader title="Report Highlight" description="Target vs realisasi dan analisis otomatis." actions={<div className="no-print flex items-center gap-2"><Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthNameID(i + 1)}</option>)}</Select><Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>{[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}</Select></div>} />
    {!hasPeriodData && !useMay2026Dummy ? <Alert>Belum ada data report highlight untuk periode ini.</Alert> : <>
      <Card className="print-card"><CardContent className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Klinik Utama Prime Mata · Finance Operations</p><p className="text-sm text-slate-500">Periode: {monthNameID(month)} {year}</p><div className="grid gap-4 md:grid-cols-4"><div><p>Total Target</p><b>{formatRupiah(summary.target)}</b></div><div><p>Total Realisasi</p><b>{formatRupiah(summary.realization)}</b></div><div><p>Capaian Total</p><b>{formatPercent(summary.achievementPercentage)}</b></div><div><p>Status Global</p><Badge className={getStatusBadgeClass(status)}>{status}</Badge></div></div><div className="h-2 rounded bg-slate-100"><div className={`h-2 rounded ${status === 'Tercapai' ? 'bg-emerald-500' : status === 'Hampir Tercapai' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(summary.achievementPercentage, 100)}%` }} /></div></CardContent></Card>

      <Card className="print-card"><CardContent className="space-y-1"><h3 className="text-lg font-semibold">Breakdown Capaian</h3><p className="text-sm text-slate-500">Rincian kontribusi dan gap masing-masing komponen terhadap target.</p><div className="grid gap-3 pt-2 md:grid-cols-2 xl:grid-cols-3">{breakdowns.map((item) => <Card key={item.key} className="border-slate-200"><CardContent className="space-y-2 p-4"><p className="font-semibold text-slate-900">{item.label}</p><p className="text-xs text-slate-500">{item.description}</p><div className="grid grid-cols-2 gap-1 text-sm"><span>Target</span><span className="text-right font-medium">{formatCurrency(item.target)}</span><span>Realisasi</span><span className="text-right font-medium">{formatCurrency(item.actual)}</span><span title="Capaian Target = Realisasi kategori / Target kategori x 100%">Capaian Target</span><span className="text-right font-medium">{formatPercent(item.achievementPercent)}</span><span title="Kontribusi Bulan Berjalan = Realisasi kategori / Total realisasi bulan berjalan x 100%">Kontribusi Bulan Berjalan</span><span className="text-right"><Badge className="bg-blue-100 text-blue-700">{formatPercent(item.contributionPercent)}</Badge></span><span>Selisih</span><span className="text-right font-medium">{formatGap(item.gap)}</span></div><div className="h-2 rounded bg-slate-100"><div className={`h-2 rounded ${item.status === 'Tercapai' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(item.achievementPercent, 100)}%` }} /></div><div className="flex items-center justify-between"><Badge className={item.status === 'Tercapai' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{item.status}</Badge><span className="text-xs text-slate-500">{item.insight}</span></div></CardContent></Card>)}</div>

      <div className="mt-4 overflow-x-auto"><Table className="print-table"><thead><tr className="text-left"><th>Komponen</th><th>Target</th><th>Realisasi</th><th>Capaian Target</th><th>Kontribusi</th><th>Selisih</th><th>Status</th></tr></thead><tbody>{breakdowns.map((row) => <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50"><td className="py-2">{row.label}</td><td>{formatCurrency(row.target)}</td><td>{formatCurrency(row.actual)}</td><td>{formatPercent(row.achievementPercent)}</td><td>{formatPercent(row.contributionPercent)}</td><td>{formatGap(row.gap)}</td><td><Badge className={getStatusBadgeClass(row.status)}>{row.status}</Badge></td></tr>)}</tbody></Table></div></CardContent></Card>

      <Card className="print-card"><CardContent><h3 className="mb-3 text-lg font-semibold">Analisis Otomatis</h3><ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">{analysis.map((line, idx) => <li key={idx}>{line}</li>)}</ul></CardContent></Card>
    </>}
  </div>;
}
