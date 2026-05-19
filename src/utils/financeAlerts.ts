import type { APItem, ARItem, RevenueTransaction } from '@/lib/types';

const DAY = 1000 * 60 * 60 * 24;
const DEFAULT_TERM_DAYS = 30;

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
const daysDiff = (end: Date, start: Date) => Math.floor((end.getTime() - start.getTime()) / DAY);

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

export function formatDateID(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

export function formatAgingDays(days: number) {
  return `${Math.max(0, Math.round(days))} hari`;
}

export function getStatusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('overdue') || normalized.includes('selisih')) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (normalized.includes('pending') || normalized.includes('open')) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-sky-100 text-sky-700 border-sky-200';
}

export function getDueReceivables(rows: ARItem[], referenceDate: Date) {
  return rows
    .map((row) => {
      const dueDate = toDate(row.invoiceDate) || toDate(row.serviceDate);
      const fallbackDue = dueDate ? new Date(dueDate.getTime() + DEFAULT_TERM_DAYS * DAY) : referenceDate;
      const aging = daysDiff(referenceDate, fallbackDue);
      return { ...row, dueDate: fallbackDue.toISOString().slice(0, 10), aging };
    })
    .filter((row) => row.outstandingAmount > 0 && (row.status.toLowerCase().includes('overdue') || row.aging > 0))
    .sort((a, b) => b.aging - a.aging);
}

export function getDuePayables(rows: APItem[], referenceDate: Date) {
  return rows
    .map((row) => {
      const invoiceDate = toDate(row.invoiceDate) || referenceDate;
      const dueDate = new Date(invoiceDate.getTime() + DEFAULT_TERM_DAYS * DAY);
      return { ...row, dueDate: dueDate.toISOString().slice(0, 10), aging: daysDiff(referenceDate, dueDate) };
    })
    .filter((row) => row.outstandingAmount > 0 && ['open', 'overdue', 'approved', 'submitted'].some((token) => row.status.toLowerCase().includes(token)) && row.aging > 0)
    .sort((a, b) => b.aging - a.aging);
}

export type ReconciliationRow = {
  id: string;
  date: string;
  reference: string;
  source: string;
  description: string;
  amount: number;
  reconciliationStatus: 'Belum Rekonsiliasi' | 'Pending Matching' | 'Selisih';
};

export function getUnreconciledTransactions(rows: RevenueTransaction[]): ReconciliationRow[] {
  return rows
    .filter((row) => ['Cash', 'Transfer', 'Debit Card', 'Credit Card', 'QRIS'].includes(row.paymentMethod))
    .map((row, idx) => ({
      id: `rec-${row.id}`,
      date: row.date,
      reference: row.receiptNo || row.invoiceNo || `TRX-${idx + 1}`,
      source: row.paymentMethod === 'Cash' ? 'Kasir Harian' : 'Debit/Kredit',
      description: row.paymentMethod === 'Cash' ? 'Setoran kas belum cocok' : 'Settlement belum cocok',
      amount: row.netAmount,
      reconciliationStatus: (idx % 3 === 0 ? 'Belum Rekonsiliasi' : idx % 3 === 1 ? 'Pending Matching' : 'Selisih') as ReconciliationRow['reconciliationStatus'],
    }))
    .filter((row) => ['Belum Rekonsiliasi', 'Pending Matching', 'Selisih'].includes(row.reconciliationStatus))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function calculateAlertSummary(rows: any[], type: 'receivables' | 'payables' | 'reconciliation') {
  if (type === 'receivables') {
    const byPayer = rows.reduce((acc, row) => { acc[row.payerName] = (acc[row.payerName] || 0) + row.outstandingAmount; return acc; }, {} as Record<string, number>);
    const top = Object.entries(byPayer).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-';
    return { total: rows.reduce((sum, row) => sum + row.outstandingAmount, 0), count: rows.length, topEntity: top, maxAging: Math.max(0, ...rows.map((row) => row.aging || 0)) };
  }
  if (type === 'payables') {
    const byVendor = rows.reduce((acc, row) => { acc[row.vendorName] = (acc[row.vendorName] || 0) + row.outstandingAmount; return acc; }, {} as Record<string, number>);
    const top = Object.entries(byVendor).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-';
    return { total: rows.reduce((sum, row) => sum + row.outstandingAmount, 0), count: rows.length, topEntity: top, maxAging: Math.max(0, ...rows.map((row) => row.aging || 0)) };
  }
  const bySource = rows.reduce((acc, row) => { acc[row.source] = (acc[row.source] || 0) + 1; return acc; }, {} as Record<string, number>);
  const byStatus = rows.reduce((acc, row) => { acc[row.reconciliationStatus] = (acc[row.reconciliationStatus] || 0) + 1; return acc; }, {} as Record<string, number>);
  return {
    total: rows.reduce((sum, row) => sum + row.amount, 0),
    count: rows.length,
    topEntity: Object.entries(bySource).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-',
    topStatus: Object.entries(byStatus).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-',
  };
}
