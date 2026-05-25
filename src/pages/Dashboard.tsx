import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui/basic';
import { ChartCard } from '@/components/common/ChartCard';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { agingAP, agingAR, profitLoss, reportHighlight, revenueSummary } from '@/lib/calculations';
import { formatRupiah, monthNameID } from '@/lib/format';
import type { APItem, ARItem, Doctor, DoctorFee, PayrollRecord, RevenueTransaction, Settings } from '@/lib/types';
import { Activity, Banknote, ChevronDown, CircleDollarSign, Download, Landmark, PlusCircle, Receipt, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { buildPayerPieSeriesByPeriods, calculateDoctorRevenuePercentage, calculatePeriodComparison, filterRevenueByDateRange, filterRevenueByPayer, formatCurrency, formatPercent, getMonthRange, getTopDoctorsByRevenue, groupRevenueByDoctor } from '@/utils/chartData';
import { calculateAlertSummary, formatAgingDays, formatCurrency as formatAlertCurrency, formatDateID, getDuePayables, getDueReceivables, getStatusBadgeClass, getUnreconciledTransactions } from '@/utils/financeAlerts';

function percentLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
  const p = percent * 100;
  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>{p >= 10 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`}</text>;
}

export function Dashboard({ revenue, doctors, fees, ar, ap, payroll, settings }: { revenue: RevenueTransaction[]; doctors: Doctor[]; fees: DoctorFee[]; ar: ARItem[]; ap: APItem[]; payroll: PayrollRecord[]; settings: Settings }) {
  const activeMonth = settings.activeMonth ?? settings.defaultMonth;
  const activeYear = settings.activeYear ?? settings.defaultYear;
  const activeRange = getMonthRange(activeYear, activeMonth);
  const [startDate, setStartDate] = React.useState(settings.activeDateFrom || activeRange.startDate);
  const [endDate, setEndDate] = React.useState(settings.activeDateTo || activeRange.endDate);
  const activePeriodKey = `${activeYear}-${String(activeMonth).padStart(2, '0')}`;
  const [compareKeys, setCompareKeys] = React.useState<string[]>([activePeriodKey]);
  const [doctorStartDate, setDoctorStartDate] = React.useState(settings.activeDateFrom || activeRange.startDate);
  const [doctorEndDate, setDoctorEndDate] = React.useState(settings.activeDateTo || activeRange.endDate);
  const [doctorPayer, setDoctorPayer] = React.useState('All');
  const doctorPayerOptions = ['All', 'Umum', 'BPJS', 'Asuransi'] as const;

  const invalidDate = startDate > endDate;
  const chartRows = invalidDate ? [] : filterRevenueByDateRange(revenue, startDate, endDate);
  const monthOptions = Array.from(new Set(revenue.map((row) => row.date.slice(0, 7)))).sort().reverse();
  const payerPeriodSeries = React.useMemo(() => buildPayerPieSeriesByPeriods(chartRows, compareKeys), [chartRows, compareKeys]);
  const periodComparisons = React.useMemo(() => calculatePeriodComparison(payerPeriodSeries), [payerPeriodSeries]);
  const hasAnyPayerData = payerPeriodSeries.some((period) => period.totalRevenue > 0);
  const payerTableRows = React.useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    payerPeriodSeries.forEach((period) => {
      period.payers.forEach((payer) => {
        const row = map.get(payer.payer) || {};
        row[period.periodKey] = payer.amount;
        map.set(payer.payer, row);
      });
    });
    return Array.from(map.entries()).map(([payer, amounts]) => ({ payer, amounts }));
  }, [payerPeriodSeries]);

  const s = revenueSummary(revenue, new Date(2026, 4, 17));
  const pl = profitLoss(revenue, fees, payroll);
  const high = reportHighlight(settings.targetRevenue, s.revenueCurrentMonth);
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: monthNameID(i + 1).slice(0, 3), Pendapatan: revenue.filter(r => new Date(r.date).getMonth() === i).reduce((a, b) => a + b.netAmount, 0), Pengeluaran: fees.filter(f => new Date(f.paymentDate || f.billDate).getMonth() === i).reduce((a, b) => a + b.netAmount, 0) + payroll.filter(p => p.period.endsWith(String(i + 1).padStart(2, '0'))).reduce((a, b) => a + b.takeHomePay, 0) }));
  const doctorInvalidDate = doctorStartDate > doctorEndDate;
  const revenueWithDoctorName = React.useMemo(
    () => revenue.map((row) => ({ ...row, doctorName: doctors.find((doc) => doc.id === row.doctorId)?.name || 'Dokter tidak diketahui' })),
    [revenue, doctors],
  );
  const doctorRowsByDate = doctorInvalidDate ? [] : filterRevenueByDateRange(revenueWithDoctorName, doctorStartDate, doctorEndDate);
  const doctorRowsFiltered = filterRevenueByPayer(doctorRowsByDate, doctorPayer);
  const doctorGrouped = groupRevenueByDoctor(doctorRowsFiltered);
  const doctorWithPercentage = calculateDoctorRevenuePercentage(doctorGrouped);
  const ranking = getTopDoctorsByRevenue(doctorWithPercentage, 10);
  const doctorTotalRevenue = ranking.reduce((sum, row) => sum + row.totalRevenue, 0);
  const doctorTopName = ranking[0]?.doctorName || '-';
  const arA = agingAR(ar, new Date(2026, 4, 17));
  const apA = agingAP(ap, new Date(2026, 4, 17));
  const totalExpenses = fees.reduce((a, b) => a + b.netAmount, 0) + payroll.reduce((a, b) => a + b.takeHomePay, 0);
  const cashIn = revenue.filter((row) => ['Cash', 'Transfer', 'Debit Card', 'Credit Card', 'QRIS'].includes(row.paymentMethod)).reduce((a, b) => a + b.netAmount, 0);
  const cashOut = totalExpenses;
  const activities = [...revenue.slice(0, 3).map((row) => ({ title: row.receiptNo, desc: `${row.patientName} • ${row.serviceName}`, amount: row.netAmount })), ...fees.slice(0, 2).map((row) => ({ title: row.paymentNo || row.billNo, desc: `Jasa dokter • ${row.patientName}`, amount: row.netAmount }))];

  const resetFilter = () => {
    setStartDate(activeRange.startDate);
    setEndDate(activeRange.endDate);
    setCompareKeys([activePeriodKey]);
  };
  const resetDoctorFilter = () => {
    setDoctorStartDate(activeRange.startDate);
    setDoctorEndDate(activeRange.endDate);
    setDoctorPayer('All');
  };

  const referenceDate = new Date(2026, 4, 19);
  const dueReceivables = React.useMemo(() => getDueReceivables(ar, referenceDate), [ar]);
  const duePayables = React.useMemo(() => getDuePayables(ap, referenceDate), [ap]);
  const unreconciledTransactions = React.useMemo(() => getUnreconciledTransactions(revenue), [revenue]);
  const [activeAlert, setActiveAlert] = React.useState<'receivables' | 'payables' | 'reconciliation' | null>(null);

  const financeAlerts = [
    { key: 'receivables' as const, title: 'Piutang jatuh tempo', count: dueReceivables.length, unit: 'invoice', description: 'Perlu follow-up payer dan penagihan.', severity: 'warning' as const, actionLabel: 'Buka Aging Piutang', nav: 'ar' },
    { key: 'payables' as const, title: 'Hutang jatuh tempo', count: duePayables.length, unit: 'vendor', description: 'Perlu penjadwalan pembayaran.', severity: 'danger' as const, actionLabel: 'Buka Aging Hutang', nav: 'ap' },
    { key: 'reconciliation' as const, title: 'Data belum rekonsiliasi', count: unreconciledTransactions.length, unit: 'transaksi', description: 'Perlu matching dengan mutasi bank.', severity: 'info' as const, actionLabel: 'Buka Rekonsiliasi', nav: 'reconciliation' },
  ];

  const exportAlertRows = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = activeAlert === 'receivables' ? dueReceivables : activeAlert === 'payables' ? duePayables : unreconciledTransactions;
    const headers = activeAlert === 'reconciliation' ? ['Tanggal','Referensi','Sumber','Deskripsi','Nominal','Status'] : activeAlert === 'payables' ? ['Tanggal Invoice','Invoice','Vendor','Outstanding','Aging','Status'] : ['Tanggal Layanan','Invoice','Payer','Pasien','Outstanding','Aging','Status'];
    const body = rows.slice(0, 5).map((row: any) => activeAlert === 'reconciliation' ? [row.date, row.reference, row.source, row.description, row.amount, row.reconciliationStatus] : activeAlert === 'payables' ? [row.invoiceDate, row.invoiceNo, row.vendorName, row.outstandingAmount, row.aging, row.status] : [row.serviceDate, row.invoiceNo, row.payerName, row.patientName, row.outstandingAmount, row.aging, row.status]);
    const csv = [headers.join(','), ...body.map((line:any[]) => line.join(','))].join('\n');
    const typeName = activeAlert === 'receivables' ? 'piutang-jatuh-tempo' : activeAlert === 'payables' ? 'hutang-jatuh-tempo' : 'data-belum-rekonsiliasi';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${typeName}-klinik-utama-prime-mata-${today}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const doctorTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{row.doctorName}</p>
      <p>Total: {formatCurrency(row.totalRevenue)}</p>
      <p>Kontribusi: {formatPercent(row.percentage)}</p>
      <p>Payer: {doctorPayer}</p>
    </div>;
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan eksekutif Finance Operations Klinik Utama Prime Mata untuk periode aktif Mei 2026." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Pendapatan Bulan Ini" value={formatRupiah(s.revenueCurrentMonth)} subtitle={`Target ${formatPercent(high.achievementPercentage)}`} icon={CircleDollarSign} tone="green" />
        <KpiCard title="Total Pengeluaran" value={formatRupiah(totalExpenses)} icon={TrendingDown} tone="red" />
        <KpiCard title="Piutang Outstanding" value={formatRupiah(ar.reduce((a, b) => a + b.outstandingAmount, 0))} icon={Receipt} tone="amber" />
        <KpiCard title="Hutang Outstanding" value={formatRupiah(ap.reduce((a, b) => a + b.outstandingAmount, 0))} icon={Wallet} tone="red" />
        <KpiCard title="Kas Masuk" value={formatRupiah(cashIn)} icon={Banknote} tone="blue" /><KpiCard title="Kas Keluar" value={formatRupiah(cashOut)} icon={Landmark} tone="amber" />
        <KpiCard title="Growth vs Bulan Lalu" value={formatPercent(s.growthVsPrevious)} icon={TrendingUp} tone={s.growthVsPrevious >= 0 ? 'green' : 'red'} />
        <KpiCard title="Laba Bersih" value={formatRupiah(pl.labaRugiBersih)} icon={Activity} tone="green" />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_.9fr]">
        <ChartCard title="Tren Pendapatan dan Pengeluaran"><ResponsiveContainer height={300}><AreaChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Area dataKey="Pendapatan" stroke="#2563eb" fill="#bfdbfe" /><Area dataKey="Pengeluaran" stroke="#b49322" fill="#fde68a" /></AreaChart></ResponsiveContainer></ChartCard>
        <Card><CardHeader><CardTitle>Quick Actions</CardTitle><p className="text-sm text-slate-500">Aksi operasional finance yang paling sering dipakai.</p></CardHeader><CardContent className="grid gap-2"><Button onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'daily-revenue' }))}><PlusCircle size={16} />Input Pendapatan</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'voucher-bkk' }))}><ReceiptText size={16} />Buat Voucher</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'master-vendors' }))}><Landmark size={16} />Tambah Vendor</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:voucher-quick-export', { detail: { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', page: 'Overview Finance', chart: 'Pendapatan by Payer', selectedPeriods: compareKeys, periodSummaries: payerPeriodSeries, generatedAt: new Date().toISOString(), payerChart: { startDate, endDate } } }))}><Download size={16} />Export Laporan</Button></CardContent></Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="min-h-80">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Pendapatan by Payer</CardTitle>
                <p className="text-sm text-slate-500">Distribusi pendapatan berdasarkan payer/asuransi</p>
              </div>
              <Button variant="outline" onClick={resetFilter}>Reset Filter</Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Dari<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Tanggal mulai pendapatan by payer" /></label>
              <label className="text-xs font-semibold text-slate-600">Ke<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="Tanggal akhir pendapatan by payer" /></label>
            </div>
            <label className="text-xs font-semibold text-slate-600">Bandingkan Periode
              <Select value="" onChange={(e) => e.target.value && !compareKeys.includes(e.target.value) && setCompareKeys((prev) => [...prev, e.target.value])} aria-label="Bandingkan periode pendapatan by payer">
                <option value="">+ Tambah Periode</option>
                {monthOptions.map((key) => <option key={key} value={key}>{monthNameID(Number(key.slice(5, 7)))} {key.slice(0, 4)}</option>)}
              </Select>
            </label>
            {compareKeys.length > 0 && <div className="flex flex-wrap gap-2">{compareKeys.map((key) => <Badge key={key} variant="outline" className="cursor-pointer" onClick={() => setCompareKeys((prev) => prev.length <= 1 ? prev : prev.filter((v) => v !== key))}>{monthNameID(Number(key.slice(5, 7)))} {key.slice(0, 4)} ✕</Badge>)}</div>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetFilter}>Reset Filter</Button>
              <Button variant="outline" onClick={() => setCompareKeys([activePeriodKey])}>Clear Comparison</Button>
            </div>
            <p className="text-xs text-slate-500">Menampilkan data {startDate} – {endDate}</p>
            {invalidDate && <p className="text-sm font-medium text-red-600">Tanggal awal tidak boleh lebih besar dari tanggal akhir.</p>}
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600"><p className="font-semibold">Belum ada data pendapatan</p><p>Input pendapatan terlebih dahulu untuk melihat distribusi payer.</p></div> : !hasAnyPayerData ? <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600"><p className="font-semibold">Tidak ada data untuk periode yang dipilih.</p><p>Coba pilih periode lain.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{payerPeriodSeries.map((period) => <div key={period.periodKey} className="rounded-xl border border-slate-200 p-3">{period.totalRevenue <= 0 ? <div className="space-y-2 text-sm text-slate-600"><p className="font-semibold text-slate-900">{period.periodLabel}</p><p>Tidak ada data pendapatan pada periode ini.</p></div> : <><p className="mb-2 font-semibold text-slate-900">{period.periodLabel}</p><div aria-label={`Grafik pendapatan berdasarkan payer ${period.periodLabel}`}><ResponsiveContainer height={220}><PieChart><Pie data={period.payers} dataKey="amount" nameKey="payer" outerRadius={85} labelLine={false} label={percentLabel}>{period.payers.map((entry) => <Cell key={entry.payer} fill={entry.color} />)}</Pie><Tooltip formatter={(value, _, item: any) => `${formatCurrency(Number(value))} • ${formatPercent(item.payload.percentage)}`} labelFormatter={(label) => `${label}:`} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{period.payers.map((row) => <div key={row.payer} className="rounded-lg border border-slate-200 p-2"><p className="font-semibold text-slate-900">{row.payer}</p><p className="text-sm text-slate-600">{formatCurrency(row.amount)} • {formatPercent(row.percentage)}</p></div>)}</div><div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p>Total Pendapatan: <b>{formatCurrency(period.totalRevenue)}</b></p><p>Payer Terbesar: <b>{period.topPayer}</b></p><p>Jumlah Payer: <b>{period.payerCount}</b></p></div></>}</div>)}</div>}
            {periodComparisons.length > 0 && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 text-sm"><p className="font-semibold">Summary Perbandingan</p>{periodComparisons.map((row, index) => <div key={row.periodKey}><p>{row.periodLabel}: <b>{formatCurrency(row.totalRevenue)}</b></p>{index > 0 && <p className={row.direction === 'up' ? 'text-emerald-700' : row.direction === 'down' ? 'text-red-700' : 'text-slate-600'}>{row.periodLabel} vs {(row as any).previousPeriodLabel}: {row.direction === 'up' ? '+' : row.direction === 'down' ? '-' : ''}{formatPercent(row.differencePercent)} ({row.direction === 'up' ? '+' : row.direction === 'down' ? '-' : ''}{formatCurrency(Math.abs(row.differenceAmount))})</p>}</div>)}</div>}
            {payerTableRows.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 p-3"><p className="mb-2 text-sm font-semibold">Perbandingan Payer Antar Periode</p><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="px-2 py-2">Payer</th>{payerPeriodSeries.map((period) => <th key={period.periodKey} className="px-2 py-2">{period.periodLabel}</th>)}</tr></thead><tbody>{payerTableRows.map((row) => <tr key={row.payer} className="border-b"><td className="px-2 py-2 font-medium">{row.payer}</td>{payerPeriodSeries.map((period) => <td key={`${row.payer}-${period.periodKey}`} className="px-2 py-2">{formatCurrency(row.amounts[period.periodKey] || 0)}</td>)}</tr>)}</tbody></table></div>}
          </CardContent>
        </Card>
        <Card className="min-h-80"><CardHeader className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Top 10 Dokter by Revenue</CardTitle><p className="text-sm text-slate-500">Peringkat dokter berdasarkan total pendapatan</p></div><Button variant="outline" onClick={resetDoctorFilter}>Reset Filter</Button></div><div className="grid gap-2 md:grid-cols-3"><label className="text-xs font-semibold text-slate-600">Dari<Input type="date" value={doctorStartDate} onChange={(e) => setDoctorStartDate(e.target.value)} aria-label="Tanggal mulai top 10 dokter by revenue" /></label><label className="text-xs font-semibold text-slate-600">Ke<Input type="date" value={doctorEndDate} onChange={(e) => setDoctorEndDate(e.target.value)} aria-label="Tanggal akhir top 10 dokter by revenue" /></label><label className="text-xs font-semibold text-slate-600">Payer<Select value={doctorPayer} onChange={(e) => setDoctorPayer(e.target.value)} aria-label="Filter payer top 10 dokter by revenue">{doctorPayerOptions.map((payer) => <option key={payer} value={payer}>{payer}</option>)}</Select></label></div><p className="text-xs text-slate-500">Menampilkan data {doctorStartDate} – {doctorEndDate} • Payer: {doctorPayer}</p>{doctorInvalidDate && <p className="text-sm font-medium text-red-600">Tanggal awal tidak boleh lebih besar dari tanggal akhir.</p>}</CardHeader><CardContent>{doctorInvalidDate ? null : ranking.length === 0 || doctorTotalRevenue <= 0 ? <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600"><p className="font-semibold">Belum ada data pendapatan dokter untuk kategori payer ini pada periode yang dipilih.</p><p>Coba ubah filter tanggal atau kategori payer.</p></div> : <div className="space-y-4"><div aria-label="Grafik Top 10 Dokter berdasarkan Revenue" className="w-full overflow-x-auto"><div className="min-w-[720px]"><ResponsiveContainer width="100%" height={360}><BarChart data={ranking} layout="vertical" margin={{ top: 12, right: 36, left: 160, bottom: 12 }}><XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} /><YAxis type="category" dataKey="doctorName" width={150} /><Tooltip content={doctorTooltip} /><Bar dataKey="totalRevenue" fill="#0ea5e9" radius={[0, 8, 8, 0]}><LabelList dataKey="percentage" position="insideRight" fill="#ffffff" formatter={(value: number) => formatPercent(Number(value))} /><LabelList dataKey="percentage" position="right" fill="#0f172a" formatter={(value: number) => Number(value) < 6 ? formatPercent(Number(value)) : ''} /></Bar></BarChart></ResponsiveContainer></div></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><p>Total Revenue: <b>{formatCurrency(doctorTotalRevenue)}</b></p><p>Jumlah Dokter: <b>{ranking.length} dokter</b></p><p>Dokter Tertinggi: <b>{doctorTopName}</b></p><p>Payer: <b>{doctorPayer}</b></p></div></div>} </CardContent></Card><ChartCard title="AR Aging"><ResponsiveContainer height={260}><BarChart data={arA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="AP Aging"><ResponsiveContainer height={260}><BarChart data={apA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader><CardContent className="space-y-3">{activities.map((item) => <div key={item.title} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><div><p className="font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-500">{item.desc}</p></div><span className="font-bold text-slate-900">{formatRupiah(item.amount)}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Finance Alerts</CardTitle></CardHeader><CardContent className="space-y-3">{financeAlerts.map((alertItem) => { const isActive = activeAlert === alertItem.key; const severityClass = alertItem.severity === 'warning' ? 'border-amber-200' : alertItem.severity === 'danger' ? 'border-rose-200' : 'border-sky-200'; return <button key={alertItem.key} type="button" aria-expanded={isActive} onClick={() => setActiveAlert((prev) => prev === alertItem.key ? null : alertItem.key)} className={`w-full rounded-xl border bg-white p-3 text-left transition hover:bg-slate-50 ${severityClass} ${isActive ? 'ring-2 ring-slate-300' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{alertItem.title}</p><p className="text-sm text-slate-600"><span className="font-semibold">{alertItem.count} {alertItem.unit}</span> • {alertItem.description}</p></div><ChevronDown size={18} className={`mt-1 shrink-0 text-slate-500 transition ${isActive ? 'rotate-180' : ''}`} /></div></button>; })}
{activeAlert && <div className="rounded-xl border border-slate-200 bg-white p-4 print:block"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{activeAlert === 'receivables' ? 'Rincian Piutang Jatuh Tempo' : activeAlert === 'payables' ? 'Rincian Hutang Jatuh Tempo' : 'Rincian Data Belum Rekonsiliasi'}</p><p className="text-sm text-slate-500">{activeAlert === 'receivables' ? 'Invoice yang melewati tanggal jatuh tempo dan perlu follow-up.' : activeAlert === 'payables' ? 'Invoice vendor yang perlu dijadwalkan pembayarannya.' : 'Transaksi yang belum cocok dengan mutasi bank.'}</p></div><div className="flex gap-2 print:hidden"><Button variant="outline" onClick={exportAlertRows} aria-label="Export rincian finance alert">Export</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: financeAlerts.find((item) => item.key === activeAlert)?.nav }))}>Lihat Semua</Button></div></div>{(() => { const rows = activeAlert === 'receivables' ? dueReceivables : activeAlert === 'payables' ? duePayables : unreconciledTransactions; const summary = calculateAlertSummary(rows, activeAlert); return <><div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'reconciliation' ? 'Total Nominal' : 'Total Outstanding'}</p><p className="font-semibold">{formatAlertCurrency(summary.total)}</p></div><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'reconciliation' ? 'Jumlah Transaksi' : 'Jumlah Invoice'}</p><p className="font-semibold">{summary.count}</p></div><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'receivables' ? 'Payer Terbesar' : activeAlert === 'payables' ? 'Vendor Terbesar' : 'Sumber Terbanyak'}</p><p className="font-semibold">{summary.topEntity}</p></div><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'reconciliation' ? 'Status Terbanyak' : 'Aging Terlama'}</p><p className="font-semibold">{activeAlert === 'reconciliation' ? summary.topStatus : formatAgingDays(summary.maxAging || 0)}</p></div></div>{rows.length === 0 ? <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600"><p className="font-semibold">{activeAlert === 'receivables' ? 'Tidak ada piutang jatuh tempo.' : activeAlert === 'payables' ? 'Tidak ada hutang jatuh tempo.' : 'Tidak ada data yang perlu rekonsiliasi.'}</p><p>{activeAlert === 'receivables' ? 'Semua invoice piutang masih dalam batas pembayaran.' : activeAlert === 'payables' ? 'Tidak ada invoice vendor yang perlu tindakan segera.' : 'Semua transaksi sudah cocok dengan data bank.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500">{(activeAlert === 'receivables' ? ['Tanggal Layanan','Invoice','Payer','Pasien','Outstanding','Aging','Status','Aksi'] : activeAlert === 'payables' ? ['Tanggal Invoice','Invoice','Vendor','Outstanding','Aging','Status','Aksi'] : ['Tanggal','Referensi','Sumber','Deskripsi','Nominal','Status Rekonsiliasi','Aksi']).map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead><tbody>{rows.slice(0,5).map((row:any) => <tr key={row.id} className="border-b"><td className="px-2 py-2">{formatDateID(row.serviceDate || row.invoiceDate || row.date)}</td><td className="px-2 py-2">{row.invoiceNo || row.reference}</td><td className="px-2 py-2">{row.payerName || row.vendorName || row.source}</td><td className="px-2 py-2">{row.patientName || row.description || '-'}</td><td className="px-2 py-2">{formatAlertCurrency(row.outstandingAmount || row.amount)}</td><td className="px-2 py-2">{row.aging !== undefined ? formatAgingDays(row.aging) : '-'}</td><td className="px-2 py-2"><span className={`rounded-full border px-2 py-1 text-xs ${getStatusBadgeClass(row.status || row.reconciliationStatus || '')}`}>{row.status || row.reconciliationStatus}</span></td><td className="px-2 py-2"><Button variant="outline" className="h-7 px-2 text-xs">{activeAlert === 'receivables' ? 'Lihat Detail' : activeAlert === 'payables' ? 'Jadwalkan Bayar' : 'Matching'}</Button></td></tr>)}</tbody></table></div>}</>; })()}</div>}</CardContent></Card></div>
    </div>
  );
}
