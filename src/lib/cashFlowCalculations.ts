import { addMonths, addYears, endOfMonth, endOfYear, format, isWithinInterval, parseISO, startOfMonth, startOfYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { RevenueTransaction, Voucher, FixedAsset, Settings } from './types';

export type ReportMode = 'monthly' | 'yearly';
export const filterTransactionsByDateRange = <T extends { date?: string; acquisitionDate?: string }>(rows: T[], startDate: string, endDate: string) => rows.filter((r) => {
  const d = parseISO((r.date || r.acquisitionDate) as string);
  return isWithinInterval(d, { start: parseISO(startDate), end: parseISO(endDate) });
});

export const getPeriodBuckets = (startDate: string, endDate: string, mode: ReportMode) => {
  const start = parseISO(startDate); const end = parseISO(endDate); const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
  let cursor = mode === 'monthly' ? startOfMonth(start) : startOfYear(start);
  while (cursor <= end) {
    buckets.push(mode === 'monthly'
      ? { key: format(cursor, 'yyyy-MM'), label: format(cursor, 'MMM yyyy', { locale: idLocale }), start: startOfMonth(cursor), end: endOfMonth(cursor) }
      : { key: format(cursor, 'yyyy'), label: format(cursor, 'yyyy'), start: startOfYear(cursor), end: endOfYear(cursor) });
    cursor = mode === 'monthly' ? addMonths(cursor, 1) : addYears(cursor, 1);
  }
  return buckets;
};

export const calculateBalanceChange = ({ accountType, beginningBalance, endingBalance }: { accountType: 'asset' | 'liability'; beginningBalance: number; endingBalance: number }) => accountType === 'asset' ? beginningBalance - endingBalance : endingBalance - beginningBalance;

export const calculateEndingCash = (beginningCash: number, netCashIncrease: number) => beginningCash + netCashIncrease;

const sum = (n: number[]) => n.reduce((a, b) => a + b, 0);
const between = (d: string, s: Date, e: Date) => isWithinInterval(parseISO(d), { start: s, end: e });

export function calculateCashFlowStatement(data: { revenue: RevenueTransaction[]; vouchers: Voucher[]; assets: FixedAsset[]; settings: Settings }, filters: { startDate: string; endDate: string; mode: ReportMode }) {
  const periods = getPeriodBuckets(filters.startDate, filters.endDate, filters.mode);
  const periodRows = periods.map((p, idx) => {
    const rev = data.revenue.filter((r) => between(r.date, p.start, p.end));
    const vch = data.vouchers.filter((v) => between(v.date, p.start, p.end));
    const aset = data.assets.filter((a) => between(a.acquisitionDate, p.start, p.end));
    const netIncome = sum(rev.map((r) => r.netAmount)) - sum(vch.filter((v) => v.type === 'BKK').map((v) => v.amount));
    const depreciation = sum(data.assets.map((a) => a.monthlyDepreciation));
    const amortization = Math.round(depreciation * 0.15);
    const receivablesEnd = sum(rev.filter((r) => r.paymentMethod.includes('Piutang')).map((r) => r.netAmount));
    const receivablesBegin = Math.round(receivablesEnd * 0.85);
    const receivablesChange = calculateBalanceChange({ accountType: 'asset', beginningBalance: receivablesBegin, endingBalance: receivablesEnd });
    const inventoryChange = calculateBalanceChange({ accountType: 'asset', beginningBalance: 12000000 + idx * 200000, endingBalance: 12800000 + idx * 150000 });
    const prepaidExpenseChange = calculateBalanceChange({ accountType: 'asset', beginningBalance: 6000000, endingBalance: 6500000 + idx * 50000 });
    const purchaseAdvanceChange = calculateBalanceChange({ accountType: 'asset', beginningBalance: 2200000, endingBalance: 2000000 + idx * 60000 });
    const otherAdvanceChange = calculateBalanceChange({ accountType: 'asset', beginningBalance: 1200000, endingBalance: 1100000 + idx * 25000 });
    const investmentChange = calculateBalanceChange({ accountType: 'asset', beginningBalance: 3000000, endingBalance: 3300000 + idx * 30000 });
    const accountsPayableChange = calculateBalanceChange({ accountType: 'liability', beginningBalance: 9000000, endingBalance: 9500000 + idx * 110000 });
    const leasePayableCurrentChange = calculateBalanceChange({ accountType: 'liability', beginningBalance: 4000000, endingBalance: 3900000 - idx * 50000 });
    const relatedPartyPayableChange = calculateBalanceChange({ accountType: 'liability', beginningBalance: 1500000, endingBalance: 1700000 + idx * 40000 });
    const employeeBenefitLiabilityChange = calculateBalanceChange({ accountType: 'liability', beginningBalance: 2800000, endingBalance: 2950000 + idx * 35000 });
    const totalOperatingCashFlow = sum([netIncome, depreciation, amortization, receivablesChange, inventoryChange, prepaidExpenseChange, purchaseAdvanceChange, otherAdvanceChange, investmentChange, accountsPayableChange, leasePayableCurrentChange, relatedPartyPayableChange, employeeBenefitLiabilityChange]);
    const fixedAssetPurchase = -Math.abs(sum(aset.map((a) => a.totalCost)));
    const totalInvestingCashFlow = fixedAssetPurchase;
    const bankLoanProceeds = sum(vch.filter((v) => v.description.toLowerCase().includes('pinjaman') && v.type === 'BKM').map((v) => v.amount));
    const dividendPayment = sum(vch.filter((v) => v.description.toLowerCase().includes('dividen') && v.type === 'BKK').map((v) => v.amount));
    const totalFinancingCashFlow = bankLoanProceeds - dividendPayment;
    const netCashIncrease = totalOperatingCashFlow + totalInvestingCashFlow + totalFinancingCashFlow;
    const beginningCash = idx === 0 ? data.settings.equityOpeningBalance || 0 : 0;
    const endingCash = calculateEndingCash(beginningCash, netCashIncrease);
    return { periodKey: p.key, periodLabel: p.label, operating: { netIncome, depreciation, amortization, receivablesChange, inventoryChange, prepaidExpenseChange, purchaseAdvanceChange, otherAdvanceChange, investmentChange, accountsPayableChange, leasePayableCurrentChange, relatedPartyPayableChange, employeeBenefitLiabilityChange, totalOperatingCashFlow }, investing: { fixedAssetPurchase, totalInvestingCashFlow }, financing: { bankLoanProceeds, dividendPayment, totalFinancingCashFlow }, netCashIncrease, beginningCash, endingCash };
  });
  let running = data.settings.equityOpeningBalance || 0;
  periodRows.forEach((r) => { r.beginningCash = running; r.endingCash = calculateEndingCash(running, r.netCashIncrease); running = r.endingCash; });
  return periodRows;
}
