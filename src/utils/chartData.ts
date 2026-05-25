import { formatRupiah, monthNameID } from '@/lib/format';
import type { RevenueTransaction } from '@/lib/types';

const PAYER_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#b45309', '#8b5cf6', '#ec4899'];
const DEFAULT_PAYER_COLOR = '#64748b';

export type GroupedPayerRevenue = { payer: string; amount: number; percentage: number; color: string };

export function filterRevenueByDateRange(rows: RevenueTransaction[], startDate: string, endDate: string) {
  return rows.filter((row) => row.date >= startDate && row.date <= endDate);
}

export function groupRevenueByPayer(rows: RevenueTransaction[]): GroupedPayerRevenue[] {
  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.payerName || row.payerType] = (acc[row.payerName || row.payerType] || 0) + row.netAmount;
    return acc;
  }, {});

  const data = Object.entries(grouped)
    .map(([payer, amount], index) => ({ payer, amount, percentage: 0, color: PAYER_COLORS[index % PAYER_COLORS.length] }))
    .sort((a, b) => b.amount - a.amount);

  return calculatePayerPercentages(data);
}

export function filterRevenueByMonth(rows: RevenueTransaction[], year: number, month: number) {
  const range = getMonthRange(year, month);
  return filterRevenueByDateRange(rows, range.startDate, range.endDate);
}

export function buildPayerColorMap(rows: RevenueTransaction[]) {
  const payerNames = Array.from(new Set(rows.map((row) => row.payerName || row.payerType).filter(Boolean))).sort();
  return payerNames.reduce<Record<string, string>>((acc, payer, index) => {
    acc[payer] = PAYER_COLORS[index % PAYER_COLORS.length];
    return acc;
  }, {});
}

export function groupRevenueByPayerWithColors(rows: RevenueTransaction[], payerColorMap: Record<string, string>) {
  const grouped = groupRevenueByPayer(rows);
  return grouped.map((row) => ({ ...row, color: payerColorMap[row.payer] || DEFAULT_PAYER_COLOR }));
}

export type PeriodPayerSeries = {
  periodKey: string;
  periodLabel: string;
  totalRevenue: number;
  payers: GroupedPayerRevenue[];
  topPayer: string;
  payerCount: number;
};

export function buildPayerPieSeriesByPeriods(rows: RevenueTransaction[], selectedPeriods: string[]) {
  const payerColorMap = buildPayerColorMap(rows);
  const sortedPeriods = [...selectedPeriods].sort();
  return sortedPeriods.map((key) => {
    const [year, month] = key.split('-').map(Number);
    const periodRows = filterRevenueByMonth(rows, year, month);
    const payers = groupRevenueByPayerWithColors(periodRows, payerColorMap);
    return {
      periodKey: key,
      periodLabel: `${monthNameID(month)} ${year}`,
      totalRevenue: payers.reduce((sum, row) => sum + row.amount, 0),
      payers,
      topPayer: payers[0]?.payer || '-',
      payerCount: payers.length,
    } satisfies PeriodPayerSeries;
  });
}

export function calculatePeriodComparison(selectedPeriodsData: PeriodPayerSeries[]) {
  return selectedPeriodsData.map((period, index) => {
    const previous = selectedPeriodsData[index - 1];
    if (!previous) {
      return { periodKey: period.periodKey, periodLabel: period.periodLabel, totalRevenue: period.totalRevenue, differenceAmount: 0, differencePercent: 0, direction: 'flat' as const };
    }
    const differenceAmount = period.totalRevenue - previous.totalRevenue;
    const differencePercent = previous.totalRevenue === 0 ? (period.totalRevenue > 0 ? 100 : 0) : (differenceAmount / previous.totalRevenue) * 100;
    return {
      periodKey: period.periodKey,
      periodLabel: period.periodLabel,
      totalRevenue: period.totalRevenue,
      previousPeriodLabel: previous.periodLabel,
      differenceAmount,
      differencePercent,
      direction: differenceAmount > 0 ? 'up' as const : differenceAmount < 0 ? 'down' as const : 'flat' as const,
    };
  });
}

export function calculatePayerPercentages(groupedRows: GroupedPayerRevenue[]) {
  const total = groupedRows.reduce((sum, row) => sum + row.amount, 0);
  if (total <= 0) return groupedRows.map((row) => ({ ...row, percentage: 0 }));
  return groupedRows.map((row) => ({ ...row, percentage: (row.amount / total) * 100 }));
}

export function getMonthRange(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
    label: `${monthNameID(month)} ${year}`,
    key: `${year}-${String(month).padStart(2, '0')}`,
  };
}

export function compareRevenuePeriods(currentRows: RevenueTransaction[], comparisonRows: { key: string; label: string; rows: RevenueTransaction[] }[]) {
  const currentTotal = currentRows.reduce((sum, row) => sum + row.netAmount, 0);
  return comparisonRows.map((comparison) => {
    const totalAmount = comparison.rows.reduce((sum, row) => sum + row.netAmount, 0);
    const differenceAmount = currentTotal - totalAmount;
    const differencePercent = totalAmount === 0 ? 100 : (differenceAmount / totalAmount) * 100;
    return {
      period: comparison.label,
      totalAmount,
      differenceAmount,
      differencePercent,
      direction: differenceAmount >= 0 ? 'up' : 'down',
    };
  });
}

export function formatCurrency(value: number) {
  return formatRupiah(value);
}

export function formatPercent(value: number) {
  const abs = Math.abs(value);
  return `${abs >= 10 ? abs.toFixed(0) : abs.toFixed(1)}%`;
}

export type GroupedDoctorRevenue = {
  doctorName: string;
  totalRevenue: number;
  percentage: number;
  payerBreakdown: Record<string, number>;
};

export function filterRevenueByPayer(rows: RevenueTransaction[], payer: string) {
  if (!payer || payer === 'All') return rows;

  const normalized = payer.trim().toLowerCase();
  return rows.filter((row) => {
    const payerType = (row.payerType || '').trim().toLowerCase();
    const payerName = (row.payerName || '').trim().toLowerCase();

    if (normalized === 'umum') {
      return payerType === 'umum' || payerName.includes('umum');
    }

    if (normalized === 'bpjs') {
      return payerType === 'bpjs' || payerName.includes('bpjs');
    }

    if (normalized === 'asuransi') {
      return payerType === 'asuransi' || payerName.includes('asuransi');
    }

    return (row.payerName || row.payerType) === payer || row.payerType === payer;
  });
}

export function groupRevenueByDoctor(rows: RevenueTransaction[]): GroupedDoctorRevenue[] {
  const grouped = rows.reduce<Record<string, GroupedDoctorRevenue>>((acc, row) => {
    const doctorName = (row as any).doctorName || row.doctorId || 'Dokter tidak diketahui';
    if (!acc[doctorName]) {
      acc[doctorName] = { doctorName, totalRevenue: 0, percentage: 0, payerBreakdown: {} };
    }
    const payerKey = row.payerName || row.payerType || 'Tidak diketahui';
    acc[doctorName].totalRevenue += row.netAmount;
    acc[doctorName].payerBreakdown[payerKey] = (acc[doctorName].payerBreakdown[payerKey] || 0) + row.netAmount;
    return acc;
  }, {});
  return Object.values(grouped);
}

export function calculateDoctorRevenuePercentage(groupedRows: GroupedDoctorRevenue[]) {
  const totalRevenue = groupedRows.reduce((sum, row) => sum + row.totalRevenue, 0);
  if (totalRevenue <= 0) return groupedRows.map((row) => ({ ...row, percentage: 0 }));
  return groupedRows.map((row) => ({ ...row, percentage: (row.totalRevenue / totalRevenue) * 100 }));
}

export function getTopDoctorsByRevenue(rows: GroupedDoctorRevenue[], limit = 10) {
  return [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
}
