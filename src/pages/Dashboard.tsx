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
import { calculateAlertSummary, formatAgingDays, formatCurrency as formatAlertCurrency, formatDateID, getDuePayables, getDueReceivables, getStatusBadgeClass, getUnreconciledTransactions, type DueReceivable } from '@/utils/financeAlerts';
import { toast } from '@/lib/toast';
import * as XLSX from 'xlsx';
import { exportToPDF, type ExportColumn } from '@/lib/export';

const AR_FILTER_PRESET_KEY = 'prime_finance_ar_filter_preset';

const DUMMY_PAYER_PERIOD_DATA: Record<string, Record<string, number>> = {
  '2026-04': { 'Perusahaan Mitra A': 2900000, 'Corporate Sample': 2100000, 'Asuransi Sehat A': 1800000, 'Pasien Umum': 950000 },
  '2026-05': { 'Perusahaan Mitra A': 3550000, 'Corporate Sample': 3550000, 'Asuransi Sehat A': 2400000, 'Pasien Umum': 1200000 },
  '2026-06': { 'Perusahaan Mitra A': 3200000, 'Corporate Sample': 2850000, 'Asuransi Sehat A': 2100000, 'Pasien Umum': 1450000 },
};

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
  const monthOptions = React.useMemo(() => {
    const keys = new Set<string>(revenue.map((row) => row.date.slice(0, 7)));
    Object.keys(DUMMY_PAYER_PERIOD_DATA).forEach((key) => keys.add(key));
    return Array.from(keys).sort().reverse();
  }, [revenue]);
  const payerPeriodSeries = React.useMemo(() => {
    const baseSeries = buildPayerPieSeriesByPeriods(revenue, compareKeys);
    return baseSeries.map((period) => {
      const dummyRows = DUMMY_PAYER_PERIOD_DATA[period.periodKey];
      if (!dummyRows) return period;
      const totalRevenue = Object.values(dummyRows).reduce((sum, amount) => sum + amount, 0);
      const payers = Object.entries(dummyRows)
        .map(([payer, amount]) => ({ payer, amount, percentage: totalRevenue <= 0 ? 0 : (amount / totalRevenue) * 100, color: period.payers.find((p) => p.payer === payer)?.color || '#64748b' }))
        .sort((a, b) => b.amount - a.amount);
      return {
        ...period,
        totalRevenue,
        payers,
        topPayer: payers[0]?.payer || '-',
        payerCount: payers.length,
      };
    });
  }, [revenue, compareKeys]);
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
  const [isExportingAlert, setIsExportingAlert] = React.useState(false);
  const [showDueReceivablesModal, setShowDueReceivablesModal] = React.useState(false);

  const financeAlerts = [
    { key: 'receivables' as const, title: 'Piutang jatuh tempo', count: dueReceivables.length, unit: 'invoice', description: 'Perlu follow-up payer dan penagihan.', severity: 'warning' as const, actionLabel: 'Buka Aging Piutang', nav: 'ar' },
    { key: 'payables' as const, title: 'Hutang jatuh tempo', count: duePayables.length, unit: 'vendor', description: 'Perlu penjadwalan pembayaran.', severity: 'danger' as const, actionLabel: 'Buka Aging Hutang', nav: 'ap' },
    { key: 'reconciliation' as const, title: 'Data belum rekonsiliasi', count: unreconciledTransactions.length, unit: 'transaksi', description: 'Perlu matching dengan mutasi bank.', severity: 'info' as const, actionLabel: 'Buka Rekonsiliasi', nav: 'reconciliation' },
  ];

  const dueReceivablesSummary = React.useMemo(() => calculateAlertSummary(dueReceivables, 'receivables'), [dueReceivables]);
  const dueReceivablesPeriod = dueReceivablesSummary.earliestDueDate && dueReceivablesSummary.latestDueDate
    ? `${formatDateID(dueReceivablesSummary.earliestDueDate)} – ${formatDateID(dueReceivablesSummary.latestDueDate)}`
    : '-';
  const dueReceivablesFilename = dueReceivablesSummary.earliestDueDate && dueReceivablesSummary.latestDueDate
    ? `piutang-jatuh-tempo-${dueReceivablesSummary.earliestDueDate}-sd-${dueReceivablesSummary.latestDueDate}`
    : 'piutang-jatuh-tempo';

  const dueReceivableExportColumns = React.useMemo<ExportColumn<DueReceivable>[]>(() => [
    { key: 'serviceDate', header: 'Tanggal Layanan', exportAccessor: (row) => row.serviceDate || '-', isDate: true },
    { key: 'invoiceDate', header: 'Tanggal Invoice', exportAccessor: (row) => row.invoiceDate || '-', isDate: true },
    { key: 'dueDate', header: 'Tanggal Jatuh Tempo', exportAccessor: (row) => row.dueDate || '-', isDate: true },
    { key: 'invoiceNo', header: 'Invoice', exportAccessor: (row) => row.invoiceNo || '-' },
    { key: 'payerName', header: 'Payer', exportAccessor: (row) => row.payerName || '-' },
    { key: 'patientName', header: 'Pasien', exportAccessor: (row) => row.patientName || '-' },
    { key: 'amount', header: 'Nominal Invoice', exportAccessor: (row) => Number(row.amount || 0), isCurrency: true },
    { key: 'outstandingAmount', header: 'Outstanding', exportAccessor: (row) => Number(row.outstandingAmount || 0), isCurrency: true, exportFooter: (rows) => rows.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0) },
    { key: 'agingDays', header: 'Aging', exportAccessor: (row) => Number(row.agingDays || 0), isNumber: true },
    { key: 'overdueStatus', header: 'Status', exportAccessor: (row) => row.overdueStatus },
  ], []);

  const exportDueReceivables = React.useCallback((format: 'excel' | 'pdf' = 'excel') => {
    if (dueReceivables.length === 0) {
      toast.warning('Belum ada piutang jatuh tempo untuk diekspor.');
      return;
    }

    const summaryRows = [
      ['Nama Klinik', 'Klinik Utama Prime Mata'],
      ['Jenis Laporan', 'Piutang Jatuh Tempo'],
      ['Periode Jatuh Tempo', dueReceivablesPeriod],
      ['Total Invoice', dueReceivablesSummary.count],
      ['Total Outstanding', dueReceivablesSummary.total],
      ['Payer Terbesar', dueReceivablesSummary.topEntity],
      ['Aging Terlama', dueReceivablesSummary.maxAging || 0],
      [],
    ];

    if (format === 'pdf') {
      exportToPDF({
        filename: dueReceivablesFilename,
        title: 'Piutang Jatuh Tempo',
        subtitle: `Periode jatuh tempo: ${dueReceivablesPeriod}`,
        rows: dueReceivables,
        columns: dueReceivableExportColumns,
        includeFooter: true,
        orientation: 'landscape',
        summary: [
          { label: 'Total Outstanding', value: formatAlertCurrency(dueReceivablesSummary.total) },
          { label: 'Jumlah Invoice', value: dueReceivablesSummary.count },
          { label: 'Payer Terbesar', value: dueReceivablesSummary.topEntity },
          { label: 'Aging Terlama', value: formatAgingDays(dueReceivablesSummary.maxAging || 0) },
        ],
      });
      toast.success('Data piutang jatuh tempo berhasil diekspor.');
      return;
    }

    const exportRows = dueReceivables.map((row) => ({
      'Tanggal Layanan': row.serviceDate || '',
      'Tanggal Invoice': row.invoiceDate || '',
      'Tanggal Jatuh Tempo': row.dueDate || '',
      Invoice: row.invoiceNo || '',
      Payer: row.payerName || '',
      Pasien: row.patientName || '',
      'Nominal Invoice': Number(row.amount || 0),
      Outstanding: Number(row.outstandingAmount || 0),
      Aging: Number(row.agingDays || 0),
      Status: row.overdueStatus,
    }));
    const footerRow = { 'Tanggal Layanan': 'Total Outstanding', 'Tanggal Invoice': '', 'Tanggal Jatuh Tempo': '', Invoice: '', Payer: '', Pasien: '', 'Nominal Invoice': '', Outstanding: dueReceivablesSummary.total, Aging: '', Status: '' };
    const sheet = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.sheet_add_json(sheet, [...exportRows, footerRow], { origin: 'A10', skipHeader: false });
    const firstDataRow = 11;
    for (let i = 0; i < exportRows.length + 1; i += 1) {
      const rowNo = firstDataRow + i;
      const invoiceAmountCell = sheet[`G${rowNo}`];
      const outstandingCell = sheet[`H${rowNo}`];
      const agingCell = sheet[`I${rowNo}`];
      if (invoiceAmountCell && typeof invoiceAmountCell.v === 'number') invoiceAmountCell.z = '[$Rp-421] #,##0';
      if (outstandingCell && typeof outstandingCell.v === 'number') outstandingCell.z = '[$Rp-421] #,##0';
      if (agingCell && typeof agingCell.v === 'number') agingCell.z = '0" hari"';
    }
    if (sheet.B5) sheet.B5.z = '[$Rp-421] #,##0';
    if (sheet.B7) sheet.B7.z = '0" hari"';
    sheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 26 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Piutang Jatuh Tempo');
    XLSX.writeFile(wb, `${dueReceivablesFilename}.xlsx`);
    toast.success('Data piutang jatuh tempo berhasil diekspor.');
  }, [dueReceivables, dueReceivablesFilename, dueReceivablesPeriod, dueReceivablesSummary, dueReceivableExportColumns]);

  const exportAlertRows = async () => {
    if (!activeAlert || isExportingAlert) return;
    if (activeAlert === 'receivables') {
      exportDueReceivables('excel');
      return;
    }
    const exportData = activeAlert === 'payables' ? duePayables : unreconciledTransactions;
    if (exportData.length === 0) {
      toast.warning(activeAlert === 'payables' ? 'Tidak ada data hutang jatuh tempo untuk diexport.' : 'Tidak ada data rekonsiliasi untuk diexport.');
      return;
    }

    setIsExportingAlert(true);
    try {
    const periodKey = `${activeYear}-${String(activeMonth).padStart(2, '0')}`;
    const periodLabel = `${monthNameID(activeMonth)} ${activeYear}`;
    const fileDateSuffix = `${activeYear}-${String(activeMonth).padStart(2, '0')}`;
    const typeName = activeAlert === 'payables' ? 'hutang-jatuh-tempo' : 'data-belum-rekonsiliasi';
    const summary = calculateAlertSummary(exportData, activeAlert);
    const exportRows = exportData.map((row: any, index: number) => activeAlert === 'reconciliation'
      ? ({ No: index + 1, Tanggal: formatDateID(row.date), Referensi: row.reference, Sumber: row.source, Deskripsi: row.description || '-', Nominal: Number(row.amount || 0), Status: row.reconciliationStatus || '-' })
      : ({ No: index + 1, 'Tanggal Invoice': formatDateID(row.invoiceDate), Invoice: row.invoiceNo, Vendor: row.vendorName, Outstanding: Number(row.outstandingAmount || 0), Aging: Number(row.aging || 0), Status: row.status || '-' }));

    const summaryRows = [
      ['Nama Klinik', 'Klinik Utama Prime Mata'],
      ['Jenis Laporan', activeAlert === 'payables' ? 'Hutang Jatuh Tempo' : 'Data Belum Rekonsiliasi'],
      ['Periode', `${periodLabel} (${periodKey})`],
      ['Total Invoice', summary.count],
      ['Total Outstanding', summary.total],
      [activeAlert === 'payables' ? 'Vendor Terbesar' : 'Sumber Terbanyak', summary.topEntity],
      ['Aging Terlama', activeAlert === 'reconciliation' ? '-' : summary.maxAging || 0],
    ];

    const sheet = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.sheet_add_json(sheet, exportRows, { origin: 'A10', skipHeader: false });
    const currencyColumn = activeAlert === 'reconciliation' ? 'F' : 'E';
    const agingColumn = activeAlert === 'reconciliation' ? '' : 'F';
    for (let i = 0; i < exportRows.length; i += 1) {
      const rowNo = i + 11;
      const currencyCell = sheet[`${currencyColumn}${rowNo}`];
      if (currencyCell) currencyCell.z = '[$Rp-421] #,##0';
      if (agingColumn) {
        const agingCell = sheet[`${agingColumn}${rowNo}`];
        if (agingCell) agingCell.z = '0" hari"';
      }
    }
    if (sheet.B5) sheet.B5.z = '[$Rp-421] #,##0';
    if (sheet.B7 && activeAlert !== 'reconciliation') sheet.B7.z = '0" hari"';
    sheet['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Finance Alerts');
    const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${typeName}-klinik-utama-prime-mata-${fileDateSuffix}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Export berhasil dibuat.');
    } finally {
      setIsExportingAlert(false);
    }
  };

  const openARAgingWithDuePreset = React.useCallback(() => {
    if (dueReceivablesSummary.earliestDueDate && dueReceivablesSummary.latestDueDate) {
      localStorage.setItem(AR_FILTER_PRESET_KEY, JSON.stringify({ from: dueReceivablesSummary.earliestDueDate, to: dueReceivablesSummary.latestDueDate, payer: 'ALL', source: 'finance-alert-due-receivables' }));
    }
    window.dispatchEvent(new CustomEvent('prime:navigate', { detail: 'ar' }));
  }, [dueReceivablesSummary.earliestDueDate, dueReceivablesSummary.latestDueDate]);

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
            {payerTableRows.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 p-3"><p className="mb-2 text-sm font-semibold">Perbandingan Payer Antar Periode</p><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="px-2 py-2">Payer</th>{payerPeriodSeries.map((period) => <th key={period.periodKey} className="px-2 py-2">{period.periodLabel}</th>)}<th className="px-2 py-2">Growth Apr-Mei</th><th className="px-2 py-2">Growth Mei-Jun</th></tr></thead><tbody>{payerTableRows.map((row) => { const apr = row.amounts['2026-04'] || 0; const mei = row.amounts['2026-05'] || 0; const jun = row.amounts['2026-06'] || 0; const growthAprMei = mei - apr; const growthMeiJun = jun - mei; return <tr key={row.payer} className="border-b"><td className="px-2 py-2 font-medium">{row.payer}</td>{payerPeriodSeries.map((period) => <td key={`${row.payer}-${period.periodKey}`} className="px-2 py-2">{formatCurrency(row.amounts[period.periodKey] || 0)}</td>)}<td className={`px-2 py-2 ${growthAprMei > 0 ? 'text-emerald-700' : growthAprMei < 0 ? 'text-red-700' : 'text-slate-600'}`}>{growthAprMei > 0 ? '+' : ''}{formatCurrency(growthAprMei)}</td><td className={`px-2 py-2 ${growthMeiJun > 0 ? 'text-emerald-700' : growthMeiJun < 0 ? 'text-red-700' : 'text-slate-600'}`}>{growthMeiJun > 0 ? '+' : ''}{formatCurrency(growthMeiJun)}</td></tr>; })}</tbody></table></div>}
          </CardContent>
        </Card>
        <Card className="min-h-80"><CardHeader className="space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Top 10 Dokter by Revenue</CardTitle><p className="text-sm text-slate-500">Peringkat dokter berdasarkan total pendapatan</p></div><Button variant="outline" onClick={resetDoctorFilter}>Reset Filter</Button></div><div className="grid gap-2 md:grid-cols-3"><label className="text-xs font-semibold text-slate-600">Dari<Input type="date" value={doctorStartDate} onChange={(e) => setDoctorStartDate(e.target.value)} aria-label="Tanggal mulai top 10 dokter by revenue" /></label><label className="text-xs font-semibold text-slate-600">Ke<Input type="date" value={doctorEndDate} onChange={(e) => setDoctorEndDate(e.target.value)} aria-label="Tanggal akhir top 10 dokter by revenue" /></label><label className="text-xs font-semibold text-slate-600">Payer<Select value={doctorPayer} onChange={(e) => setDoctorPayer(e.target.value)} aria-label="Filter payer top 10 dokter by revenue">{doctorPayerOptions.map((payer) => <option key={payer} value={payer}>{payer}</option>)}</Select></label></div><p className="text-xs text-slate-500">Menampilkan data {doctorStartDate} – {doctorEndDate} • Payer: {doctorPayer}</p>{doctorInvalidDate && <p className="text-sm font-medium text-red-600">Tanggal awal tidak boleh lebih besar dari tanggal akhir.</p>}</CardHeader><CardContent>{doctorInvalidDate ? null : ranking.length === 0 || doctorTotalRevenue <= 0 ? <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600"><p className="font-semibold">Belum ada data pendapatan dokter untuk kategori payer ini pada periode yang dipilih.</p><p>Coba ubah filter tanggal atau kategori payer.</p></div> : <div className="space-y-4"><div aria-label="Grafik Top 10 Dokter berdasarkan Revenue" className="w-full overflow-x-auto"><div className="min-w-[720px]"><ResponsiveContainer width="100%" height={360}><BarChart data={ranking} layout="vertical" margin={{ top: 12, right: 36, left: 160, bottom: 12 }}><XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} /><YAxis type="category" dataKey="doctorName" width={150} /><Tooltip content={doctorTooltip} /><Bar dataKey="totalRevenue" fill="#0ea5e9" radius={[0, 8, 8, 0]}><LabelList dataKey="percentage" position="insideRight" fill="#ffffff" formatter={(value: number) => formatPercent(Number(value))} /><LabelList dataKey="percentage" position="right" fill="#0f172a" formatter={(value: number) => Number(value) < 6 ? formatPercent(Number(value)) : ''} /></Bar></BarChart></ResponsiveContainer></div></div><div className="rounded-xl bg-slate-50 p-3 text-sm"><p>Total Revenue: <b>{formatCurrency(doctorTotalRevenue)}</b></p><p>Jumlah Dokter: <b>{ranking.length} dokter</b></p><p>Dokter Tertinggi: <b>{doctorTopName}</b></p><p>Payer: <b>{doctorPayer}</b></p></div></div>} </CardContent></Card><ChartCard title="AR Aging"><ResponsiveContainer height={260}><BarChart data={arA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="AP Aging"><ResponsiveContainer height={260}><BarChart data={apA}><XAxis dataKey="name" hide /><YAxis /><Tooltip formatter={(v) => formatRupiah(Number(v))} /><Bar dataKey="0-30" stackId="a" fill="#22c55e" /><Bar dataKey="31-60" stackId="a" fill="#f59e0b" /><Bar dataKey=">60" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></ChartCard>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader><CardContent className="space-y-3">{activities.map((item) => <div key={item.title} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><div><p className="font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-500">{item.desc}</p></div><span className="font-bold text-slate-900">{formatRupiah(item.amount)}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Finance Alerts</CardTitle></CardHeader><CardContent className="space-y-3">{financeAlerts.map((alertItem) => { const isActive = activeAlert === alertItem.key; const severityClass = alertItem.severity === 'warning' ? 'border-amber-200' : alertItem.severity === 'danger' ? 'border-rose-200' : 'border-sky-200'; return <button key={alertItem.key} type="button" aria-expanded={isActive} onClick={() => setActiveAlert((prev) => prev === alertItem.key ? null : alertItem.key)} className={`w-full rounded-xl border bg-white p-3 text-left transition hover:bg-slate-50 ${severityClass} ${isActive ? 'ring-2 ring-slate-300' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{alertItem.title}</p><p className="text-sm text-slate-600"><span className="font-semibold">{alertItem.count} {alertItem.unit}</span> • {alertItem.description}</p></div><ChevronDown size={18} className={`mt-1 shrink-0 text-slate-500 transition ${isActive ? 'rotate-180' : ''}`} /></div></button>; })}
{activeAlert && <div className="rounded-xl border border-slate-200 bg-white p-4 print:block">{(() => { const detailData = activeAlert === 'receivables' ? dueReceivables : activeAlert === 'payables' ? duePayables : unreconciledTransactions; const previewData = detailData.slice(0, 5); const summary = activeAlert === 'receivables' ? dueReceivablesSummary : calculateAlertSummary(detailData, activeAlert); return <><div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{activeAlert === 'receivables' ? 'Rincian Piutang Jatuh Tempo' : activeAlert === 'payables' ? 'Rincian Hutang Jatuh Tempo' : 'Rincian Data Belum Rekonsiliasi'}</p><p className="text-sm text-slate-500">{activeAlert === 'receivables' ? `Invoice yang melewati tanggal jatuh tempo dan perlu follow-up. Periode jatuh tempo: ${dueReceivablesPeriod}` : activeAlert === 'payables' ? 'Invoice vendor yang perlu dijadwalkan pembayarannya.' : 'Transaksi yang belum cocok dengan mutasi bank.'}</p></div><div className="flex gap-2 print:hidden"><Button variant="outline" disabled={isExportingAlert} onClick={() => void exportAlertRows()} aria-label="Export rincian finance alert">{isExportingAlert ? 'Exporting...' : 'Export'}</Button><Button variant="outline" onClick={() => activeAlert === 'receivables' ? setShowDueReceivablesModal(true) : window.dispatchEvent(new CustomEvent('prime:navigate', { detail: financeAlerts.find((item) => item.key === activeAlert)?.nav }))}>Lihat Semua</Button></div></div><div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'reconciliation' ? 'Total Nominal' : 'Total Outstanding'}</p><p className="font-semibold">{formatAlertCurrency(summary.total)}</p></div><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'reconciliation' ? 'Jumlah Transaksi' : 'Jumlah Invoice'}</p><p className="font-semibold">{summary.count}</p></div><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'receivables' ? 'Payer Terbesar' : activeAlert === 'payables' ? 'Vendor Terbesar' : 'Sumber Terbanyak'}</p><p className="font-semibold">{summary.topEntity}</p></div><div className="rounded-lg bg-slate-50 p-2 text-xs"><p className="text-slate-500">{activeAlert === 'reconciliation' ? 'Status Terbanyak' : 'Aging Terlama'}</p><p className="font-semibold">{activeAlert === 'reconciliation' ? summary.topStatus : formatAgingDays(summary.maxAging || 0)}</p></div></div>{detailData.length === 0 ? <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600"><p className="font-semibold">{activeAlert === 'receivables' ? 'Tidak ada piutang jatuh tempo pada periode ini.' : activeAlert === 'payables' ? 'Tidak ada hutang jatuh tempo.' : 'Tidak ada data yang perlu rekonsiliasi.'}</p><p>{activeAlert === 'receivables' ? 'Semua invoice piutang masih dalam batas pembayaran.' : activeAlert === 'payables' ? 'Tidak ada invoice vendor yang perlu tindakan segera.' : 'Semua transaksi sudah cocok dengan data bank.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500">{(activeAlert === 'receivables' ? ['Tanggal Layanan','Tanggal Invoice','Jatuh Tempo','Invoice','Payer','Pasien','Outstanding','Aging','Status'] : activeAlert === 'payables' ? ['Tanggal Invoice','Invoice','Vendor','Outstanding','Aging','Status','Aksi'] : ['Tanggal','Referensi','Sumber','Deskripsi','Nominal','Status Rekonsiliasi','Aksi']).map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead><tbody>{previewData.map((row:any) => activeAlert === 'receivables' ? <tr key={row.id} className="border-b"><td className="px-2 py-2">{formatDateID(row.serviceDate)}</td><td className="px-2 py-2">{formatDateID(row.invoiceDate)}</td><td className="px-2 py-2">{formatDateID(row.dueDate)}</td><td className="px-2 py-2 font-medium">{row.invoiceNo}</td><td className="px-2 py-2">{row.payerName}</td><td className="px-2 py-2">{row.patientName || '-'}</td><td className="px-2 py-2 text-right">{formatAlertCurrency(row.outstandingAmount)}</td><td className="px-2 py-2">{formatAgingDays(row.agingDays)}</td><td className="px-2 py-2"><span className={`rounded-full border px-2 py-1 text-xs ${getStatusBadgeClass(row.overdueStatus)}`}>{row.overdueStatus}</span></td></tr> : <tr key={row.id} className="border-b"><td className="px-2 py-2">{formatDateID(row.serviceDate || row.invoiceDate || row.date)}</td><td className="px-2 py-2">{row.invoiceNo || row.reference}</td><td className="px-2 py-2">{row.payerName || row.vendorName || row.source}</td><td className="px-2 py-2">{row.patientName || row.description || '-'}</td><td className="px-2 py-2">{formatAlertCurrency(row.outstandingAmount || row.amount)}</td><td className="px-2 py-2">{row.aging !== undefined ? formatAgingDays(row.aging) : '-'}</td><td className="px-2 py-2"><span className={`rounded-full border px-2 py-1 text-xs ${getStatusBadgeClass(row.status || row.reconciliationStatus || '')}`}>{row.status || row.reconciliationStatus}</span></td><td className="px-2 py-2"><Button variant="outline" className="h-7 px-2 text-xs">{activeAlert === 'payables' ? 'Jadwalkan Bayar' : 'Matching'}</Button></td></tr>)}</tbody></table></div>}</>; })()}</div>}</CardContent></Card></div>
      {showDueReceivablesModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="due-receivables-title"><div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Finance Alerts</p><h2 id="due-receivables-title" className="text-xl font-bold text-slate-900">Daftar Piutang Jatuh Tempo</h2><p className="text-sm text-slate-500">Invoice piutang yang sudah melewati tanggal jatuh tempo dan perlu follow-up.</p><p className="mt-1 text-xs font-medium text-slate-600">Periode jatuh tempo: {dueReceivablesPeriod}</p></div><Button variant="ghost" onClick={() => setShowDueReceivablesModal(false)} aria-label="Tutup daftar piutang jatuh tempo">✕</Button></div><div className="max-h-[calc(92vh-88px)] overflow-y-auto p-5"><div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Total Outstanding</p><p className="text-lg font-bold text-slate-900">{formatAlertCurrency(dueReceivablesSummary.total)}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Jumlah Invoice</p><p className="text-lg font-bold text-slate-900">{dueReceivablesSummary.count}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Payer Terbesar</p><p className="truncate text-lg font-bold text-slate-900" title={dueReceivablesSummary.topEntity}>{dueReceivablesSummary.topEntity}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Aging Terlama</p><p className="text-lg font-bold text-slate-900">{formatAgingDays(dueReceivablesSummary.maxAging || 0)}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Periode Jatuh Tempo</p><p className="text-sm font-bold text-slate-900">{dueReceivablesPeriod}</p></div></div>{dueReceivables.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600"><p className="font-semibold text-slate-900">Tidak ada piutang jatuh tempo pada periode ini.</p><p>Semua invoice piutang masih dalam batas pembayaran.</p></div> : <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-slate-50"><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Tanggal Layanan</th><th className="px-3 py-3">Tanggal Invoice</th><th className="px-3 py-3">Tanggal Jatuh Tempo</th><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Payer</th><th className="px-3 py-3">Pasien</th><th className="px-3 py-3 text-right">Nominal Invoice</th><th className="px-3 py-3 text-right">Outstanding</th><th className="px-3 py-3">Aging</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{dueReceivables.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-3 py-3">{formatDateID(row.serviceDate)}</td><td className="px-3 py-3">{formatDateID(row.invoiceDate)}</td><td className="px-3 py-3">{formatDateID(row.dueDate)}</td><td className="px-3 py-3 font-semibold text-slate-900">{row.invoiceNo}</td><td className="px-3 py-3">{row.payerName}</td><td className="px-3 py-3">{row.patientName || '-'}</td><td className="px-3 py-3 text-right">{formatAlertCurrency(row.amount)}</td><td className="px-3 py-3 text-right font-semibold">{formatAlertCurrency(row.outstandingAmount)}</td><td className="px-3 py-3">{formatAgingDays(row.agingDays)}</td><td className="px-3 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row.overdueStatus)}`}>{row.overdueStatus}</span></td></tr>)}</tbody><tfoot className="bg-slate-50"><tr><td colSpan={7} className="px-3 py-3 text-right font-semibold">Total Outstanding</td><td className="px-3 py-3 text-right font-bold">{formatAlertCurrency(dueReceivablesSummary.total)}</td><td colSpan={2}></td></tr></tfoot></table></div>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => exportDueReceivables('excel')}>Export Excel</Button><Button variant="outline" onClick={() => exportDueReceivables('pdf')}>Export PDF</Button><Button variant="secondary" onClick={openARAgingWithDuePreset}>Buka Aging Piutang</Button><Button onClick={() => setShowDueReceivablesModal(false)}>Tutup</Button></div></div></div></div>}
    </div>
  );
}
