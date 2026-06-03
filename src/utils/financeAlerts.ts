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

export type DueReceivable = ARItem & {
  dueDate: string;
  aging: number;
  agingDays: number;
  overdueStatus: 'Jatuh Tempo' | 'Perlu Follow-up' | 'Prioritas Tinggi';
};

export function getReceivableOverdueStatus(days: number): DueReceivable['overdueStatus'] {
  if (days > 60) return 'Prioritas Tinggi';
  if (days > 30) return 'Perlu Follow-up';
  return 'Jatuh Tempo';
}

export function getStatusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('prioritas tinggi')) return 'bg-red-100 text-red-700 border-red-200';
  if (normalized.includes('perlu follow-up')) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (normalized.includes('jatuh tempo')) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (normalized.includes('overdue') || normalized.includes('selisih')) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (normalized.includes('pending') || normalized.includes('open')) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-sky-100 text-sky-700 border-sky-200';
}

export function getDueReceivables(rows: ARItem[], referenceDate: Date): DueReceivable[] {
  return rows
    .map((row) => {
      const explicitDueDate = toDate((row as ARItem & { dueDate?: string }).dueDate);
      const invoiceDate = toDate(row.invoiceDate);
      const serviceDate = toDate(row.serviceDate);
      const baseDate = invoiceDate || serviceDate;
      const dueDate = explicitDueDate || (baseDate ? new Date(baseDate.getTime() + DEFAULT_TERM_DAYS * DAY) : referenceDate);
      const agingDays = daysDiff(referenceDate, dueDate);
      return {
        ...row,
        dueDate: dueDate.toISOString().slice(0, 10),
        aging: agingDays,
        agingDays,
        overdueStatus: getReceivableOverdueStatus(agingDays),
      };
    })
    .filter((row) => row.outstandingAmount > 0 && row.agingDays > 0)
    .sort((a, b) => (b.agingDays - a.agingDays) || (b.outstandingAmount - a.outstandingAmount));
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
    return {
      total: rows.reduce((sum, row) => sum + row.outstandingAmount, 0),
      count: rows.length,
      topEntity: top,
      maxAging: Math.max(0, ...rows.map((row) => row.agingDays || row.aging || 0)),
      earliestDueDate: rows.map((row) => row.dueDate).filter(Boolean).sort()[0] || '',
      latestDueDate: rows.map((row) => row.dueDate).filter(Boolean).sort().slice(-1)[0] || '',
    };
  }
  if (type === 'payables') {
    const byVendor = rows.reduce((acc, row) => { acc[row.vendorName] = (acc[row.vendorName] || 0) + row.outstandingAmount; return acc; }, {} as Record<string, number>);
    const top = Object.entries(byVendor).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-';
    return {
      total: rows.reduce((sum, row) => sum + row.outstandingAmount, 0),
      count: rows.length,
      topEntity: top,
      maxAging: Math.max(0, ...rows.map((row) => row.agingDays || row.aging || 0)),
      earliestDueDate: rows.map((row) => row.dueDate).filter(Boolean).sort()[0] || '',
      latestDueDate: rows.map((row) => row.dueDate).filter(Boolean).sort().slice(-1)[0] || '',
    };
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
