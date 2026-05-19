import { endOfMonth } from 'date-fns';
import { formatCurrency as baseFormatCurrency, formatDateID as baseFormatDateID } from '@/lib/format';

export type BalanceSheetCategory = 'Asset' | 'Liability' | 'Equity';

export interface BalanceSheetRow {
  id: string;
  date: string;
  category: BalanceSheetCategory;
  accountName: string;
  amount: number;
}

export function filterLedgerUntilDate(rows: BalanceSheetRow[], asOfDate: string): BalanceSheetRow[] {
  return rows.filter((row) => row.date <= asOfDate);
}

export function groupAccountsByCategory(rows: BalanceSheetRow[]): Record<BalanceSheetCategory, BalanceSheetRow[]> {
  return {
    Asset: rows.filter((row) => row.category === 'Asset'),
    Liability: rows.filter((row) => row.category === 'Liability'),
    Equity: rows.filter((row) => row.category === 'Equity'),
  };
}

const sumAmounts = (rows: BalanceSheetRow[]) => rows.reduce((acc, row) => acc + row.amount, 0);

export const calculateAssets = (rows: BalanceSheetRow[]) => sumAmounts(rows.filter((row) => row.category === 'Asset'));
export const calculateLiabilities = (rows: BalanceSheetRow[]) => sumAmounts(rows.filter((row) => row.category === 'Liability'));
export const calculateEquity = (rows: BalanceSheetRow[]) => sumAmounts(rows.filter((row) => row.category === 'Equity'));

export function calculateBalanceSheet(rows: BalanceSheetRow[], asOfDate: string) {
  const filteredRows = filterLedgerUntilDate(rows, asOfDate);
  const grouped = groupAccountsByCategory(filteredRows);
  const totalAssets = calculateAssets(filteredRows);
  const totalLiabilities = calculateLiabilities(filteredRows);
  const totalEquity = calculateEquity(filteredRows);
  const difference = totalAssets - (totalLiabilities + totalEquity);
  return {
    rows: filteredRows,
    grouped,
    summary: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      difference,
      status: difference === 0 ? 'Balance' : 'Tidak Balance',
    },
  };
}

export const formatCurrency = (value: number) => baseFormatCurrency(value);
export const formatDateID = (value: string) => baseFormatDateID(value);
export const getDefaultAsOfDate = (activeDateTo: string) => activeDateTo || endOfMonth(new Date()).toISOString().slice(0, 10);
