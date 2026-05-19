import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DoctorFee, PayrollRecord, RevenueTransaction } from './types';

export type ProfitLossFilterMode = 'dateRange' | 'monthRange';
export type ProfitLossDataRow = RevenueTransaction & { rowType: 'revenue' };

export const formatMonthLabel = (value: string) =>
  format(new Date(`${value}-01T00:00:00`), 'MMMM yyyy', { locale: id });

export const formatCurrency = (value: number) =>
  `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0)}`;

export const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0)}%`;

export const calculateMargin = (value: number, revenue: number) => (revenue ? (value / revenue) * 100 : 0);

export const filterTransactionsByDateRange = (rows: ProfitLossDataRow[], startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59`).getTime();
  return rows.filter((row) => {
    const time = new Date(row.date).getTime();
    return time >= start && time <= end;
  });
};

export const filterTransactionsByMonths = (rows: ProfitLossDataRow[], selectedMonths: string[]) => {
  if (!selectedMonths.length) return rows;
  const set = new Set(selectedMonths);
  return rows.filter((row) => set.has(row.date.slice(0, 7)));
};

const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

export function calculateProfitLoss(rows: ProfitLossDataRow[], fees: DoctorFee[], payroll: PayrollRecord[]) {
  const revenue = sum(rows.map((r) => r.netAmount));
  const directMedicalFees = sum(fees.map((f) => f.netAmount));
  const inventoryExpense = revenue * 0.1;
  const directExpense = directMedicalFees + inventoryExpense;
  const grossProfit = revenue - directExpense;

  const salaryExpense = sum(payroll.map((p) => p.grossSalary));
  const adminExpense = revenue * 0.06;
  const utilityExpense = revenue * 0.02;
  const depreciationExpense = revenue * 0.015;
  const otherOperational = revenue * 0.01;
  const operationalExpense = salaryExpense + adminExpense + utilityExpense + depreciationExpense + otherOperational;

  const ebitda = grossProfit - (salaryExpense + adminExpense + utilityExpense + otherOperational);
  const totalExpenses = directExpense + operationalExpense;
  const netProfit = revenue - totalExpenses;

  return {
    revenue,
    totalExpenses,
    grossProfit,
    ebitda,
    netProfit,
    netMargin: calculateMargin(netProfit, revenue),
    groups: {
      'Pendapatan Pelayanan Medis': sum(rows.filter((r) => ['Konsultasi', 'Tindakan Medis', 'Operasi', 'Laboratorium'].includes(r.serviceCategory)).map((r) => r.netAmount)),
      'Pendapatan Farmasi': sum(rows.filter((r) => r.serviceCategory === 'Farmasi').map((r) => r.netAmount)),
      'Pendapatan Lainnya': sum(rows.filter((r) => !['Konsultasi', 'Tindakan Medis', 'Operasi', 'Laboratorium', 'Farmasi'].includes(r.serviceCategory)).map((r) => r.netAmount)),
      'Beban Jasa Medis': directMedicalFees,
      'Beban Persediaan': inventoryExpense,
      'Beban Farmasi': revenue * 0.03,
      'Beban Gaji': salaryExpense,
      'Beban Administrasi': adminExpense,
      'Beban Utilitas': utilityExpense,
      'Beban Penyusutan': depreciationExpense,
      'Beban Lainnya': otherOperational,
    },
  };
}

export function groupProfitLossByMonth(rows: ProfitLossDataRow[], selectedMonths: string[], fees: DoctorFee[], payroll: PayrollRecord[]) {
  const months = [...selectedMonths].sort((a, b) => a.localeCompare(b));
  return months.map((periodKey) => {
    const monthRows = rows.filter((r) => r.date.slice(0, 7) === periodKey);
    const monthCalc = calculateProfitLoss(monthRows, fees.filter((f) => f.actionDate.slice(0, 7) === periodKey), payroll.filter((p) => p.period === periodKey));
    return {
      periodKey,
      periodLabel: formatMonthLabel(periodKey),
      revenue: monthCalc.revenue,
      expenses: monthCalc.totalExpenses,
      grossProfit: monthCalc.grossProfit,
      ebitda: monthCalc.ebitda,
      netProfit: monthCalc.netProfit,
      netMargin: monthCalc.netMargin,
      groups: monthCalc.groups,
    };
  });
}

export function calculateProfitLossSummary(rows: ReturnType<typeof groupProfitLossByMonth>) {
  const totalRevenue = sum(rows.map((r) => r.revenue));
  const totalExpenses = sum(rows.map((r) => r.expenses));
  const grossProfit = sum(rows.map((r) => r.grossProfit));
  const ebitda = sum(rows.map((r) => r.ebitda));
  const netProfit = sum(rows.map((r) => r.netProfit));
  return { totalRevenue, totalExpenses, grossProfit, ebitda, netProfit, netMargin: calculateMargin(netProfit, totalRevenue) };
}
