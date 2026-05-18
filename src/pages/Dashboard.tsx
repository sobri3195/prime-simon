import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/basic';
import { ChartCard } from '@/components/common/ChartCard';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { agingAP, agingAR, doctorSalesRanking, profitLoss, reportHighlight, revenueSummary } from '@/lib/calculations';
import { formatPercent, formatRupiah, monthNameID } from '@/lib/format';
import type { APItem, ARItem, Doctor, DoctorFee, PayrollRecord, RevenueTransaction, Settings } from '@/lib/types';
import { Activity, ArrowUpRight, Banknote, CircleDollarSign, Download, Landmark, PlusCircle, Receipt, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

export function Dashboard({ revenue, doctors, fees, ar, ap, payroll, settings }: { revenue: RevenueTransaction[]; doctors: Doctor[]; fees: DoctorFee[]; ar: ARItem[]; ap: APItem[]; payroll: PayrollRecord[]; settings: Settings }) {
  const s = revenueSummary(revenue, new Date(2026, 4, 17));
  const pl = profitLoss(revenue, fees, payroll);
  const high = reportHighlight(settings.targetRevenue, s.revenueCurrentMonth);
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: monthNameID(i + 1).slice(0, 3), Pendapatan: revenue.filter(r => new Date(r.date).getMonth() === i).reduce((a, b) => a + b.netAmount, 0), Pengeluaran: fees.filter(f => new Date(f.paymentDate || f.billDate).getMonth() === i).reduce((a, b) => a + b.netAmount, 0) + payroll.filter(p => p.period.endsWith(String(i + 1).padStart(2, '0'))).reduce((a, b) => a + b.takeHomePay, 0) }));
  const ranking = doctorSalesRanking(revenue, doctors, fees).slice(0, 10);
  const biggestPayer = [...s.revenueByPayer].sort((a, b) => b.value - a.value)[0];
  const arA = agingAR(ar, new Date(2026, 4, 17));
  const apA = agingAP(ap, new Date(2026, 4, 17));
  const totalExpenses = fees.reduce((a, b) => a + b.netAmount, 0) + payroll.reduce((a, b) => a + b.takeHomePay, 0);
  const cashIn = revenue.filter((row) => ['Cash', 'Transfer', 'Debit Card', 'Credit Card', 'QRIS'].includes(row.paymentMethod)).reduce((a, b) => a + b.netAmount, 0);
  const cashOut = totalExpenses;
  const activities = [...revenue.slice(0, 3).map((row) => ({ title: row.receiptNo, desc: `${row.patientName} • ${row.serviceName}`, amount: row.netAmount })), ...fees.slice(0, 2).map((row) => ({ title: row.paymentNo || row.billNo, desc: `Jasa dokter • ${row.patientName}`, amount: row.netAmount }))];
  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan eksekutif Finance Operations Klinik Utama Prime Mata untuk periode aktif Mei 2026." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Pendapatan Bulan Ini" value={formatRupiah(s.revenueCurrentMonth)} subtitle={`Target ${formatPercent(high.achievementPercentage)}`} icon={CircleDollarSign} tone="green" />
        <KpiCard title="Total Pengeluaran" value={formatRupiah(totalExpenses)} icon={TrendingDown} tone="red" />
        <KpiCard title="Piutang Outstanding" value={formatRupiah(ar.reduce((a, b) => a + b.outstandingAmount, 0))} icon={Receipt} tone="amber" />
        <KpiCard title="Hutang Vendor" value={formatRupiah(ap.reduce((a, b) => a + b.outstandingAmount, 0))} icon={Wallet} tone="red" />
        <KpiCard title="Kas Masuk" value={formatRupiah(cashIn)} icon={Banknote} tone="blue" />
        <KpiCard title="Kas Keluar" value={formatRupiah(cashOut)} icon={Landmark} tone="amber" />
        <KpiCard title="Growth vs Bulan Lalu" value={formatPercent(s.growthVsPrevious)} icon={TrendingUp} tone={s.growthVsPrevious >= 0 ? 'green' : 'red'} />
        <KpiCard title="Laba Bersih" value={formatRupiah(pl.labaRugiBersih)} icon={Activity} tone="green" />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_.9fr]">
        <ChartCard title="Tren Pendapatan dan Pengeluaran"><ResponsiveContainer height={300}><AreaChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Area dataKey="Pendapatan" stroke="#2563eb" fill="#bfdbfe" /><Area dataKey="Pengeluaran" stroke="#b49322" fill="#fde68a" /></AreaChart></ResponsiveContainer></ChartCard>
        <Card><CardHeader><CardTitle>Quick Actions</CardTitle><p className="text-sm text-slate-500">Aksi operasional finance yang paling sering dipakai.</p></CardHeader><CardContent className="grid gap-2"><Button onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'daily-revenue' }))}><PlusCircle size={16} />Input Pendapatan</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'voucher-bkk' }))}><ReceiptText size={16} />Buat Voucher</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'master-vendors' }))}><Landmark size={16} />Tambah Vendor</Button><Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('prime:voucher-quick-export'))}><Download size={16} />Export Laporan</Button></CardContent></Card>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2"><ChartCard title="Pendapatan by Payer"><ResponsiveContainer height={260}><PieChart><Pie data={s.revenueByPayer} dataKey="value" nameKey="name" outerRadius={95}>{s.revenueByPayer.map((_, i) => <Cell key={i} fill={['#2563eb', '#06b6d4', '#10b981', '#b49322'][i % 4]} />)}</Pie><Tooltip formatter={(v) => formatRupiah(Number(v))} /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Top 10 Dokter by Revenue"><ResponsiveContainer height={260}><BarChart data={ranking}><XAxis dataKey="doctorName" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="total" fill="#0ea5e9" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="AR Aging"><ResponsiveContainer height={260}><BarChart data={arA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="AP Aging"><ResponsiveContainer height={260}><BarChart data={apA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader><CardContent className="space-y-3">{activities.map((item) => <div key={item.title} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><div><p className="font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-500">{item.desc}</p></div><span className="font-bold text-slate-900">{formatRupiah(item.amount)}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Finance Alerts</CardTitle></CardHeader><CardContent className="space-y-3"><Alert>Piutang jatuh tempo: <Badge variant="amber">{ar.filter((row) => row.status !== 'Paid').length} invoice</Badge> perlu follow-up.</Alert><Alert>Hutang jatuh tempo: <Badge variant="red">{ap.filter((row) => row.status !== 'Paid').length} vendor</Badge> perlu jadwal bayar.</Alert><Alert>Data belum rekonsiliasi: <Badge>{Math.max(1, Math.round(revenue.length * 0.08))} transaksi</Badge> perlu matching bank.</Alert></CardContent></Card></div>
      <Alert className="mt-6"><b>Insight otomatis:</b> Pendapatan bulan ini {s.growthVsPrevious >= 0 ? 'naik' : 'turun'} {formatPercent(Math.abs(s.growthVsPrevious))} vs bulan lalu. Payer terbesar adalah <Badge>{biggestPayer?.name}</Badge>. Dokter revenue tertinggi: <Badge variant="green">{ranking[0]?.doctorName}</Badge>. Status target: <Badge variant={high.status === 'Tercapai' ? 'green' : high.status === 'Perlu Perhatian' ? 'amber' : 'red'}>{high.status}</Badge>.</Alert>
    </div>
  );
}
