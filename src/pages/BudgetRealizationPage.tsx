import { useMemo, useState } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { FilterBar } from '@/components/common/FilterBar';
import { MonthRangeFilter } from '@/components/common/MonthRangeFilter';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Card, CardContent, Select } from '@/components/ui/basic';
import { formatPercent, formatRupiah } from '@/lib/format';
import type { COA, RevenueTransaction } from '@/lib/types';

type AccountType = 'Revenue' | 'Expense';
type ProfitLossGroup = 'Pendapatan' | 'Beban Pokok' | 'Beban Operasional' | 'Beban Payroll' | 'Beban Pajak' | 'Beban Penyusutan';
type RabStatus = 'Tercapai' | 'Hampir Tercapai' | 'Tidak Tercapai' | 'Under Budget' | 'Over Budget' | 'Over Budget Tinggi';
type ViewMode = 'variance' | 'realisasi' | 'budget' | 'achievement';

type RabRow = {
  id: string;
  coaCode: string;
  coaName: string;
  profitLossGroup: ProfitLossGroup;
  accountType: AccountType;
  period: string;
  budget: number;
  realization: number;
  variance: number;
  achievementPercent: number;
  status: RabStatus;
};

const PROFIT_LOSS_CONFIG = [
  { keywords: ['pendapatan', 'medis', 'pelayanan', 'farmasi', 'optik', 'konsultasi', 'tindakan', 'laboratorium'], group: 'Pendapatan', accountType: 'Revenue' },
  { keywords: ['beban pokok', 'jasa medis', 'bmhp', 'alat kesehatan', 'persediaan', 'farmasi'], group: 'Beban Pokok', accountType: 'Expense' },
  { keywords: ['gaji', 'payroll'], group: 'Beban Payroll', accountType: 'Expense' },
  { keywords: ['pajak'], group: 'Beban Pajak', accountType: 'Expense' },
  { keywords: ['penyusutan', 'depresiasi'], group: 'Beban Penyusutan', accountType: 'Expense' },
  { keywords: ['honor dokter', 'administrasi', 'utilitas', 'sewa', 'marketing', 'maintenance', 'operasional'], group: 'Beban Operasional', accountType: 'Expense' },
] as const;

const STATUS_OPTIONS = ['Semua Status', 'Tercapai', 'Hampir Tercapai', 'Tidak Tercapai', 'Under Budget', 'Over Budget', 'Over Budget Tinggi'] as const;
const GROUP_OPTIONS = ['Semua Grup', 'Pendapatan', 'Beban Pokok', 'Beban Operasional', 'Beban Payroll', 'Beban Pajak', 'Beban Penyusutan'] as const;

const matchesKeyword = (source: string, keywords: readonly string[]) => keywords.some((keyword) => source.includes(keyword));

const mapCoaToProfitLossSections = (coaRows: COA[]) => {
  return coaRows
    .filter((item) => item.category === 'Revenue' || item.category === 'Expense' || item.category === 'COGS')
    .map((item) => {
      const normalized = `${item.name} ${item.code}`.toLowerCase();
      const matched = PROFIT_LOSS_CONFIG.find((config) => matchesKeyword(normalized, config.keywords));
      if (!matched) return null;
      return {
        ...item,
        reportSection: 'ProfitLoss' as const,
        category: matched.accountType,
        profitLossGroup: matched.group,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

const getProfitLossCoaItems = (coaRows: COA[]) => mapCoaToProfitLossSections(coaRows);

const filterRabByDateRange = (rows: RabRow[], startDate: string, endDate: string) => {
  if (!startDate || !endDate) return rows;
  return rows.filter((row) => {
    const rowDate = `${row.period}-01`;
    return rowDate >= startDate && rowDate <= endDate;
  });
};

const filterRabByMonths = (rows: RabRow[], selectedFromMonth: string, selectedToMonth: string) => {
  if (!selectedFromMonth || !selectedToMonth) return rows;
  return rows.filter((row) => row.period >= selectedFromMonth && row.period <= selectedToMonth);
};

const calculateRabStatus = (row: Pick<RabRow, 'accountType' | 'budget' | 'realization' | 'achievementPercent'>): RabStatus => {
  if (row.accountType === 'Revenue') {
    if (row.realization >= row.budget) return 'Tercapai';
    if (row.achievementPercent >= 80) return 'Hampir Tercapai';
    return 'Tidak Tercapai';
  }
  if (row.achievementPercent > 120) return 'Over Budget Tinggi';
  if (row.realization > row.budget) return 'Over Budget';
  return 'Under Budget';
};

const calculateRabRealization = ({
  revenue,
  profitLossCoa,
}: {
  revenue: RevenueTransaction[];
  profitLossCoa: ReturnType<typeof getProfitLossCoaItems>;
}): RabRow[] => {
  return profitLossCoa.map((item, index) => {
    const relatedRevenue = revenue.filter((trx) => trx.serviceName.toLowerCase().includes(item.name.toLowerCase().split(' ')[1] || '') || trx.serviceCategory.toLowerCase().includes(((parts) => parts[parts.length - 1] || '')(item.name.toLowerCase().split(' '))));
    const realization = relatedRevenue.reduce((acc, trx) => acc + trx.netAmount, 0) || (index + 1) * 1_750_000;
    const budget = Math.round(realization * (item.category === 'Revenue' ? 1.1 : 0.9));
    const variance = realization - budget;
    const achievementPercent = budget === 0 ? 0 : (realization / budget) * 100;
    return {
      id: item.id,
      coaCode: item.code,
      coaName: item.name,
      profitLossGroup: item.profitLossGroup,
      accountType: item.category,
      period: '2026-05',
      budget,
      realization,
      variance,
      achievementPercent,
      status: calculateRabStatus({ accountType: item.category, budget, realization, achievementPercent }),
    };
  });
};

const calculateRabSummary = (rows: RabRow[]) => {
  const totalBudget = rows.reduce((acc, row) => acc + row.budget, 0);
  const totalRealization = rows.reduce((acc, row) => acc + row.realization, 0);
  const totalVariance = totalRealization - totalBudget;
  const achievementPercent = totalBudget === 0 ? 0 : (totalRealization / totalBudget) * 100;
  return {
    totalBudget,
    totalRealization,
    totalVariance,
    achievementPercent,
    overBudgetCount: rows.filter((row) => row.status === 'Over Budget' || row.status === 'Over Budget Tinggi').length,
    notAchievedCount: rows.filter((row) => row.status === 'Tidak Tercapai').length,
  };
};

export function BudgetRealizationPage({ coa, revenue }: { coa: COA[]; revenue: RevenueTransaction[] }) {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [fromMonth, setFromMonth] = useState('2026-01');
  const [toMonth, setToMonth] = useState('2026-12');
  const [selectedGroup, setSelectedGroup] = useState<(typeof GROUP_OPTIONS)[number]>('Semua Grup');
  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_OPTIONS)[number]>('Semua Status');
  const [viewMode, setViewMode] = useState<ViewMode>('variance');

  const profitLossCoa = useMemo(() => getProfitLossCoaItems(coa), [coa]);
  const allRows = useMemo(() => calculateRabRealization({ revenue, profitLossCoa }), [profitLossCoa, revenue]);

  const filteredRows = useMemo(() => {
    const byDate = filterRabByDateRange(allRows, startDate, endDate);
    const byMonth = filterRabByMonths(byDate, fromMonth, toMonth);
    return byMonth.filter((row) => {
      const matchGroup = selectedGroup === 'Semua Grup' || row.profitLossGroup === selectedGroup;
      const matchStatus = selectedStatus === 'Semua Status' || row.status === selectedStatus;
      return matchGroup && matchStatus;
    });
  }, [allRows, endDate, fromMonth, selectedGroup, selectedStatus, startDate, toMonth]);

  const summary = useMemo(() => calculateRabSummary(filteredRows), [filteredRows]);

  return (
    <div className="space-y-4">
      <PageHeader title="RAB vs Realisasi" description="Klinik Utama Prime Mata · Finance Operations" />
      <Card><CardContent className="pt-4 text-sm text-slate-600">COA yang ditampilkan mengikuti struktur Laporan Laba Rugi, yaitu akun pendapatan dan beban yang relevan untuk RAB.</CardContent></Card>
      <FilterBar>
        <DateRangeFilter from={startDate} to={endDate} onFrom={setStartDate} onTo={setEndDate} />
        <MonthRangeFilter from={fromMonth} to={toMonth} onFrom={setFromMonth} onTo={setToMonth} />
        <Select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value as (typeof GROUP_OPTIONS)[number])}>{GROUP_OPTIONS.map((group) => <option key={group} value={group}>{group}</option>)}</Select>
        <Select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</Select>
        <Select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}><option value="variance">View Variance</option><option value="realisasi">View Realisasi</option><option value="budget">View Budget</option><option value="achievement">View Achievement %</option></Select>
      </FilterBar>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Budget</p><p className="font-semibold">{formatRupiah(summary.totalBudget)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Realisasi</p><p className="font-semibold">{formatRupiah(summary.totalRealization)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total Variance</p><p className="font-semibold">{formatRupiah(summary.totalVariance)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Achievement Total</p><p className="font-semibold">{formatPercent(summary.achievementPercent)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Jumlah Over Budget</p><p className="font-semibold">{summary.overBudgetCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Jumlah Tidak Tercapai</p><p className="font-semibold">{summary.notAchievedCount}</p></CardContent></Card>
      </div>

      <DataTable
        title="RAB vs Realisasi"
        filename={`rab-vs-realisasi-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`}
        rows={filteredRows}
        columns={[
          { key: 'coaCode', header: 'Kode COA' },
          { key: 'coaName', header: 'Komponen Laba Rugi' },
          { key: 'profitLossGroup', header: 'Grup' },
          { key: 'budget', header: 'Budget', align: 'right', cell: (row) => formatRupiah(row.budget) },
          { key: 'realisasi', header: 'Realisasi', align: 'right', cell: (row) => formatRupiah(row.realization) },
          { key: 'achievementPercent', header: 'Achievement %', align: 'right', cell: (row) => formatPercent(row.achievementPercent) },
          { key: 'variance', header: viewMode === 'variance' ? 'Variance' : `Variance (${viewMode})`, align: 'right', cell: (row) => formatRupiah(row.variance) },
          {
            key: 'status',
            header: 'Status',
            cell: (row) => <Badge variant={row.status.includes('Over') || row.status === 'Tidak Tercapai' ? 'red' : 'green'}>{row.status}</Badge>,
          },
        ]}
      />
    </div>
  );
}
