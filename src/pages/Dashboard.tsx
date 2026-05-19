import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui/basic';
import { ChartCard } from '@/components/common/ChartCard';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { agingAP, agingAR, doctorSalesRanking, profitLoss, reportHighlight, revenueSummary } from '@/lib/calculations';
import { formatRupiah, monthNameID } from '@/lib/format';
import type { APItem, ARItem, Doctor, DoctorFee, PayrollRecord, RevenueTransaction, Settings } from '@/lib/types';
import { Activity, Banknote, CircleDollarSign, Download, Landmark, PlusCircle, Receipt, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { compareRevenuePeriods, filterRevenueByDateRange, formatCurrency, formatPercent, getMonthRange, groupRevenueByPayer } from '@/utils/chartData';

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
  const [compareKeys, setCompareKeys] = React.useState<string[]>([]);

  const invalidDate = startDate > endDate;
  const chartRows = invalidDate ? [] : filterRevenueByDateRange(revenue, startDate, endDate);
  const groupedPayers = groupRevenueByPayer(chartRows);
  const totalPayerRevenue = groupedPayers.reduce((sum, row) => sum + row.amount, 0);
  const biggestPayer = groupedPayers[0];

  const monthOptions = Array.from(new Set(revenue.map((row) => row.date.slice(0, 7)))).sort().reverse();
  const comparisonRows = compareKeys.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const monthRange = getMonthRange(y, m);
    return { key, label: monthRange.label, rows: filterRevenueByDateRange(revenue, monthRange.startDate, monthRange.endDate) };
  });
  const comparisons = compareRevenuePeriods(chartRows, comparisonRows);

  const s = revenueSummary(revenue, new Date(2026, 4, 17));
  const pl = profitLoss(revenue, fees, payroll);
  const high = reportHighlight(settings.targetRevenue, s.revenueCurrentMonth);
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: monthNameID(i + 1).slice(0, 3), Pendapatan: revenue.filter(r => new Date(r.date).getMonth() === i).reduce((a, b) => a + b.netAmount, 0), Pengeluaran: fees.filter(f => new Date(f.paymentDate || f.billDate).getMonth() === i).reduce((a, b) => a + b.netAmount, 0) + payroll.filter(p => p.period.endsWith(String(i + 1).padStart(2, '0'))).reduce((a, b) => a + b.takeHomePay, 0) }));
  const ranking = doctorSalesRanking(revenue, doctors, fees).slice(0, 10);
  const arA = agingAR(ar, new Date(2026, 4, 17));
  const apA = agingAP(ap, new Date(2026, 4, 17));
  const totalExpenses = fees.reduce((a, b) => a + b.netAmount, 0) + payroll.reduce((a, b) => a + b.takeHomePay, 0);
  const cashIn = revenue.filter((row) => ['Cash', 'Transfer', 'Debit Card', 'Credit Card', 'QRIS'].includes(row.paymentMethod)).reduce((a, b) => a + b.netAmount, 0);
  const cashOut = totalExpenses;
  const activities = [...revenue.slice(0, 3).map((row) => ({ title: row.receiptNo, desc: `${row.patientName} • ${row.serviceName}`, amount: row.netAmount })), ...fees.slice(0, 2).map((row) => ({ title: row.paymentNo || row.billNo, desc: `Jasa dokter • ${row.patientName}`, amount: row.netAmount }))];

  const resetFilter = () => {
    setStartDate(activeRange.startDate);
    setEndDate(activeRange.endDate);
    setCompareKeys([]);
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan eksekutif Finance Operations Klinik Utama Prime Mata untuk periode aktif Mei 2026." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Pendapatan Bulan Ini" value={formatRupiah(s.revenueCurrentMonth)} subtitle={`Target ${formatPercent(high.achievementPercentage)}`} icon={CircleDollarSign} tone="green" />
        <KpiCard title="Total Pengeluaran" value={formatRupiah(totalExpenses)} icon={TrendingDown} tone="red" />
        <KpiCard title="Piutang Outstanding" value={formatRupiah(ar.reduce((a, b) => a + b.outstandingAmount, 0))} icon={Receipt} tone="amber" />
        <KpiCard title="Hutang Vendor" value={formatRupiah(ap.reduce((a, b) => a + b.outstandingAmount, 0))} icon={Wallet} tone="red" />
        <KpiCard title="Kas Masuk" value={formatRupiah(cashIn)} icon={Banknote} tone="blue" /><KpiCard title="Kas Keluar" value={formatRupiah(cashOut)} icon={Landmark} tone="amber" />
        <KpiCard title="Growth vs Bulan Lalu" value={formatPercent(s.growthVsPrevious)} icon={TrendingUp} tone={s.growthVsPrevious >= 0 ? 'green' : 'red'} />
        <KpiCard title="Laba Bersih" value={formatRupiah(pl.labaRugiBersih)} icon={Activity} tone="green" />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_.9fr]">
        <ChartCard title="Tren Pendapatan dan Pengeluaran"><ResponsiveContainer height={300}><AreaChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Area dataKey="Pendapatan" stroke="#2563eb" fill="#bfdbfe" /><Area dataKey="Pengeluaran" stroke="#b49322" fill="#fde68a" /></AreaChart></ResponsiveContainer></ChartCard>
        <Card><CardHeader><CardTitle>Quick Actions</CardTitle><p className="text-sm text-slate-500">Aksi operasional finance yang paling sering dipakai.</p></CardHeader><CardContent className="grid gap-2"><Button onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'daily-revenue' }))}><PlusCircle size={16} />Input Pendapatan</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'voucher-bkk' }))}><ReceiptText size={16} />Buat Voucher</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'master-vendors' }))}><Landmark size={16} />Tambah Vendor</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:voucher-quick-export', { detail: { page: 'Overview Finance', chart: 'Pendapatan by Payer', startDate, endDate, comparisonPeriods: compareKeys, totalRevenue: totalPayerRevenue, groupedPayers } }))}><Download size={16} />Export Laporan</Button></CardContent></Card>
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
            {compareKeys.length > 0 && <div className="flex flex-wrap gap-2">{compareKeys.map((key) => <Badge key={key} variant="outline" className="cursor-pointer" onClick={() => setCompareKeys((prev) => prev.filter((v) => v !== key))}>{monthNameID(Number(key.slice(5, 7)))} {key.slice(0, 4)} ✕</Badge>)}</div>}
            <p className="text-xs text-slate-500">Menampilkan data {startDate} – {endDate}</p>
            {invalidDate && <p className="text-sm font-medium text-red-600">Tanggal awal tidak boleh lebih besar dari tanggal akhir.</p>}
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600"><p className="font-semibold">Belum ada data pendapatan</p><p>Input pendapatan terlebih dahulu untuk melihat distribusi payer.</p></div> : groupedPayers.length === 0 ? <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600"><p className="font-semibold">Tidak ada data pada periode yang dipilih</p><p>Coba ubah rentang tanggal atau periode pembanding.</p></div> : <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><div aria-label="Grafik pendapatan berdasarkan payer"><ResponsiveContainer height={280}><PieChart><Pie data={groupedPayers} dataKey="amount" nameKey="payer" outerRadius={105} labelLine={false} label={percentLabel}>{groupedPayers.map((entry) => <Cell key={entry.payer} fill={entry.color} />)}</Pie><Tooltip formatter={(value, _, item: any) => `${formatCurrency(Number(value))} • ${formatPercent(item.payload.percentage)}`} labelFormatter={(label) => `${label}:`} /></PieChart></ResponsiveContainer></div><div className="space-y-3">{groupedPayers.map((row) => <div key={row.payer} className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-900">{row.payer}</p><p className="text-sm text-slate-600">{formatCurrency(row.amount)} • {formatPercent(row.percentage)}</p></div>)}<div className="rounded-xl bg-slate-50 p-3 text-sm"><p>Total Pendapatan: <b>{formatCurrency(totalPayerRevenue)}</b></p><p>Payer Terbesar: <b>{biggestPayer?.payer || '-'}</b></p><p>Jumlah Payer: <b>{groupedPayers.length}</b></p></div></div></div>}
            {comparisons.length > 0 && <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm"><p className="mb-2 font-semibold">Summary Perbandingan</p>{comparisons.map((row) => <p key={row.period}>Dibanding {row.period}: <b className={row.direction === 'up' ? 'text-emerald-700' : 'text-red-700'}>{row.direction === 'up' ? '+' : '-'}{formatPercent(row.differencePercent)}</b> ({row.direction === 'up' ? '+' : '-'}{formatCurrency(Math.abs(row.differenceAmount))})</p>)}</div>}
          </CardContent>
        </Card>
        <ChartCard title="Top 10 Dokter by Revenue"><ResponsiveContainer height={260}><BarChart data={ranking}><XAxis dataKey="doctorName" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="total" fill="#0ea5e9" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="AR Aging"><ResponsiveContainer height={260}><BarChart data={arA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="AP Aging"><ResponsiveContainer height={260}><BarChart data={apA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader><CardContent className="space-y-3">{activities.map((item) => <div key={item.title} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><div><p className="font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-500">{item.desc}</p></div><span className="font-bold text-slate-900">{formatRupiah(item.amount)}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Finance Alerts</CardTitle></CardHeader><CardContent className="space-y-3"><Alert>Piutang jatuh tempo: <Badge variant="amber">{ar.filter((row) => row.status !== 'Paid').length} invoice</Badge> perlu follow-up.</Alert><Alert>Hutang jatuh tempo: <Badge variant="red">{ap.filter((row) => row.status !== 'Paid').length} vendor</Badge> perlu jadwal bayar.</Alert><Alert>Data belum rekonsiliasi: <Badge>{Math.max(1, Math.round(revenue.length * 0.08))} transaksi</Badge> perlu matching bank.</Alert></CardContent></Card></div>
    </div>
  );
}
