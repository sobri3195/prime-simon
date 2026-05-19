import { formatRupiah, monthNameID } from '@/lib/format';
import type { RevenueTransaction } from '@/lib/types';

const PAYER_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#b45309', '#8b5cf6', '#ec4899'];

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
  return rows.filter((row) => (row.payerName || row.payerType) === payer || row.payerType === payer);
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
